import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getSheetsClient, rowsFromValues } from "@/lib/google/sheets";

type SheetRow = Record<string, string>;

function toISODateValue(v: string) {
  // works if your sheet uses YYYY-MM-DD; if not, we’ll just treat it as text
  return (v || "").trim();
}

function titleFromEmail(email: string) {
  const local = (email.split("@")[0] || "").replace(/[._-]+/g, " ").trim();
  return local
    .split(" ")
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(" ");
}

function firstNonEmpty(values: Array<string | null | undefined>) {
  return values.map((v) => (v || "").trim()).find(Boolean) || "";
}

function readRowValue(row: SheetRow, keys: string[]) {
  const direct = keys.map((k) => (row[k] || "").trim()).find(Boolean);
  if (direct) return direct;

  // Fallback for headers like "Client Name", "EMAIL", etc.
  const normalizedMap = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, ""),
      (v || "").trim(),
    ])
  );

  return (
    keys
      .map((k) =>
        k
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "")
      )
      .map((k) => normalizedMap[k] || "")
      .find(Boolean) || ""
  );
}

function projectFilesFromRow(row: SheetRow) {
  return readRowValue(row, [
    "project_files_folder",
    "project_files_link",
    "project_files_url",
    "project_files",
    "folder_link",
    "project_folder",
    "column_l",
  ]);
}

function rowEmail(row: SheetRow) {
  return readRowValue(row, ["email", "client_email", "user_email"]).toLowerCase();
}

function rowClientName(row: SheetRow) {
  return readRowValue(row, ["client_name", "client", "name"]);
}

function rowLastUpdated(row: SheetRow) {
  return readRowValue(row, ["last_updated", "updated_at", "last_update"]);
}

function rowProject(row: SheetRow) {
  return readRowValue(row, ["project", "project_name"]);
}

function rowTask(row: SheetRow) {
  return readRowValue(row, ["task", "item", "deliverable"]);
}

function rowStatus(row: SheetRow) {
  return readRowValue(row, ["status", "project_status"]);
}

function rowEstimatedCompletion(row: SheetRow) {
  return readRowValue(row, ["estimated_completion", "estimated_completion_date", "eta"]);
}

function rowActualCompletion(row: SheetRow) {
  return firstNonEmpty([
    readRowValue(row, ["actual_completion", "actual_completion_date", "completed_at"]),
  ]);
}

function allowlistEnabled() {
  const raw = (process.env.ENABLE_SUPABASE_ALLOWLIST || "true").toLowerCase().trim();
  return raw !== "false" && raw !== "0" && raw !== "off";
}

function rowIsAllowlisted(row: Record<string, unknown> | null) {
  if (!row) return false;

  if (typeof row.is_active === "boolean") return row.is_active;
  if (typeof row.active === "boolean") return row.active;
  if (typeof row.enabled === "boolean") return row.enabled;
  if (typeof row.disabled === "boolean") return !row.disabled;

  if (typeof row.status === "string") {
    const status = row.status.toLowerCase().trim();
    return ["active", "enabled", "approved", "allowlisted"].includes(status);
  }

  return true;
}

async function getAllowlistRecord(email: string) {
  // If allowlist is disabled, or server env isn't available (GH Pages build),
  // treat as unavailable and fall back to Sheets behavior.
  if (!allowlistEnabled()) return { mode: "disabled" as const, row: null };
  if (!supabaseServer) return { mode: "missing_env" as const, row: null };

  const table = process.env.SUPABASE_ALLOWLIST_TABLE || "portal_allowlist";
  const { data, error } = await supabaseServer
    .from(table)
    .select("*")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (error) {
    const code = (error as { code?: string }).code;
    // If allowlist table (or expected email column) is not provisioned yet,
    // fall back to sheet-based access instead of failing the request.
    if (code === "42P01" || code === "42703") {
      return { mode: "allowlist_unavailable" as const, row: null };
    }
    return { mode: "allowlist_query_error" as const, row: null };
  }

  return { mode: "table" as const, row: (data || null) as Record<string, unknown> | null };
}

export async function GET(req: Request) {
  try {
    // IMPORTANT:
    // GitHub Pages static export runs `next build` without server env vars.
    // Guard server-only dependencies so build doesn't crash.
    if (!supabaseServer) {
      return NextResponse.json({ ok: false, reason: "server_env_missing" }, { status: 500 });
    }

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      return NextResponse.json({ ok: false, reason: "missing_google_sheet_id" }, { status: 500 });
    }

    const auth = req.headers.get("authorization") || "";
    const match = auth.match(/^Bearer (.+)$/);

    if (!match) {
      return NextResponse.json({ ok: false, reason: "missing_bearer" }, { status: 401 });
    }

    const token = match[1];
    const { data: userData, error: userErr } = await supabaseServer.auth.getUser(token);

    if (userErr || !userData?.user?.email) {
      return NextResponse.json({ ok: false, reason: "invalid_token" }, { status: 401 });
    }

    const email = userData.user.email.toLowerCase();
    const allowlist = await getAllowlistRecord(email);

    if (allowlist.mode === "table" && !rowIsAllowlisted(allowlist.row)) {
      return NextResponse.json({ ok: false, reason: "not_allowed" }, { status: 403 });
    }

    const allowlistClientName = firstNonEmpty([
      String(allowlist.row?.client_name || ""),
      String(allowlist.row?.name || ""),
      titleFromEmail(email),
    ]);
    const allowlistProjectFilesUrl = firstNonEmpty([
      String(allowlist.row?.project_files_url || ""),
      String(allowlist.row?.project_files_folder || ""),
      String(allowlist.row?.project_files_link || ""),
    ]);

    const sheets = await getSheetsClient();

    const updatesResp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "updates!A:L",
    });

    const values = updatesResp.data.values as string[][] | undefined;
    if (!values?.length) {
      return NextResponse.json({ ok: true, client_name: "", last_updated: "", rows: [] });
    }

    const allRows = rowsFromValues(values) as SheetRow[];

    // Filter to the logged-in user's rows
    const clientRows = allRows.filter((r) => rowEmail(r) === email);

    if (!clientRows.length) {
      // If allowlisted, return a friendly empty payload instead of unauthorized.
      if (allowlist.mode === "table" && rowIsAllowlisted(allowlist.row)) {
        return NextResponse.json({
          ok: true,
          client_name: allowlistClientName || titleFromEmail(email),
          last_updated: "",
          project_files_url: allowlistProjectFilesUrl,
          no_active_projects: true,
          rows: [],
        });
      }

      // When allowlist isn't available, preserve current sheet-based access behavior:
      // access requires at least one matching sheet row.
      return NextResponse.json({ ok: false, reason: "not_allowed" }, { status: 403 });
    }

    const clientName = firstNonEmpty([rowClientName(clientRows[0]), allowlistClientName]);

    // Compute "last updated" as the most recent non-empty last_updated string (simple + robust)
    const lastUpdated =
      [...clientRows]
        .map((r) => rowLastUpdated(r))
        .filter(Boolean)
        .slice(-1)[0] || "";

    const projectFilesUrl = firstNonEmpty([
      ...clientRows.map((r) => projectFilesFromRow(r)),
      allowlistProjectFilesUrl,
    ]);

    // Shape table rows (don’t include email/client_id/next_due_date in response)
    const rows = clientRows.map((r) => ({
      project: rowProject(r),
      task: rowTask(r),
      status: rowStatus(r),
      estimated_completion: toISODateValue(rowEstimatedCompletion(r)),
      actual_completion: toISODateValue(rowActualCompletion(r)),
    }));

    return NextResponse.json({
      ok: true,
      client_name: clientName,
      last_updated: lastUpdated,
      project_files_url: projectFilesUrl,
      no_active_projects: false,
      rows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json(
      { ok: false, reason: "status_load_failed", error: message },
      { status: 500 }
    );
  }
}
