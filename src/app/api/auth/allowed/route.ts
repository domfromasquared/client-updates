import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getSheetsClient, rowsFromValues } from "@/lib/google/sheets";

type AllowlistRow = Record<string, unknown> | null;
type SheetRow = Record<string, string>;

function normalizeEmail(input: string) {
  return input.trim().toLowerCase();
}

function readRowValue(row: SheetRow, keys: string[]) {
  const direct = keys.map((k) => (row[k] || "").trim()).find(Boolean);
  if (direct) return direct;

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

function allowlistEnabled() {
  const raw = (process.env.ENABLE_SUPABASE_ALLOWLIST || "true").toLowerCase().trim();
  return raw !== "false" && raw !== "0" && raw !== "off";
}

function rowIsAllowlisted(row: AllowlistRow) {
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

async function allowedViaSupabaseAllowlist(email: string) {
  if (!allowlistEnabled()) return { mode: "disabled" as const, allowed: false };

  // GitHub Pages build won't have server env vars; Vercel will.
  // If the server client isn't available, we fall back to Sheets below.
  if (!supabaseServer) return { mode: "missing_env" as const, allowed: false };

  const table = process.env.SUPABASE_ALLOWLIST_TABLE || "portal_allowlist";
  const { data, error } = await supabaseServer
    .from(table)
    .select("*")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (error) {
    if ((error as { code?: string }).code === "42P01") {
      return { mode: "missing_table" as const, allowed: false };
    }
    throw error;
  }

  return { mode: "table" as const, allowed: rowIsAllowlisted((data || null) as AllowlistRow) };
}

async function allowedViaSheet(email: string) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) return false;

  const sheets = await getSheetsClient();

  const updatesResp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "updates!A:L",
  });

  const values = updatesResp.data.values as string[][] | undefined;
  if (!values?.length) return false;

  const rows = rowsFromValues(values) as SheetRow[];
  return rows.some((r) => {
    const rowEmail = readRowValue(r, ["email", "client_email", "user_email"]);
    return normalizeEmail(rowEmail) === email;
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as null | { email?: string };
  const email = normalizeEmail(body?.email || "");

  if (!email) {
    return NextResponse.json({ ok: false, reason: "missing_email" }, { status: 400 });
  }

  try {
    const allowlist = await allowedViaSupabaseAllowlist(email);

    if (allowlist.mode === "table") {
      return NextResponse.json({ ok: true, allowed: allowlist.allowed });
    }

    // Fallback when allowlist is disabled, env is missing, or table doesn't exist yet.
    const allowedFromSheet = await allowedViaSheet(email);
    return NextResponse.json({ ok: true, allowed: allowedFromSheet });
  } catch {
    return NextResponse.json({ ok: false, reason: "allowlist_check_failed" }, { status: 500 });
  }
}
