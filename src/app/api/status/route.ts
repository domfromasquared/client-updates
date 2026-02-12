import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getSheetsClient, rowsFromValues } from "@/lib/google/sheets";

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

function projectFilesFromRow(row: Record<string, string>) {
  return firstNonEmpty([
    row.project_files_folder,
    row.project_files_link,
    row.project_files_url,
    row.project_files,
    row.folder_link,
    row.project_folder,
    row.column_l,
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
  if (!allowlistEnabled()) return { mode: "disabled" as const, row: null };

  const table = process.env.SUPABASE_ALLOWLIST_TABLE || "portal_allowlist";
  const { data, error } = await supabaseServer
    .from(table)
    .select("*")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (error) {
    // If table is not provisioned yet, keep current behavior by falling back to sheet-based access.
    if ((error as { code?: string }).code === "42P01") {
      return { mode: "missing_table" as const, row: null };
    }
    throw error;
  }

  return { mode: "table" as const, row: (data || null) as Record<string, unknown> | null };
}

export async function GET(req: Request) {
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
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;

  const updatesResp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "updates!A:L",
  });

  const values = updatesResp.data.values as string[][] | undefined;
  if (!values?.length) {
    return NextResponse.json({ ok: true, client_name: "", last_updated: "", rows: [] });
  }

  const allRows = rowsFromValues(values);

  // Filter to the logged-in user's rows
  const clientRows = allRows.filter((r) => (r.email || "").toLowerCase() === email);

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

    // When no allowlist table exists yet, preserve previous behavior:
    // access requires at least one matching sheet row.
    return NextResponse.json({ ok: false, reason: "not_allowed" }, { status: 403 });
  }

  const clientName = firstNonEmpty([clientRows[0].client_name, allowlistClientName]);

  // Compute "last updated" as the most recent non-empty last_updated string (simple + robust)
  // If you use real dates, we can sort by date later; for now pick the latest non-empty by appearance.
  const lastUpdated =
    [...clientRows]
      .map((r) => (r.last_updated || "").trim())
      .filter(Boolean)
      .slice(-1)[0] || "";

  const projectFilesUrl = firstNonEmpty([
    ...clientRows.map((r) => projectFilesFromRow(r)),
    allowlistProjectFilesUrl,
  ]);

  // Shape table rows (don’t include email/client_id/next_due_date in the response unless you want it later)
  const rows = clientRows.map((r) => ({
    project: (r.project || "").trim(),
    task: (r.task || "").trim(),
    status: (r.status || "").trim(),
    estimated_completion: toISODateValue(r.estimated_completion || ""),
    actual_completion: toISODateValue(r.actual_completion || ""),
  }));

  return NextResponse.json({
    ok: true,
    client_name: clientName,
    last_updated: lastUpdated,
    project_files_url: projectFilesUrl,
    no_active_projects: false,
    rows,
  });
}
