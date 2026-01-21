// src/app/api/status/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getSheetsClient, rowsFromValues } from "@/lib/google/sheets";

function toText(v: unknown) {
  return String(v ?? "").trim();
}

function cleanUrl(v: unknown) {
  const s = toText(v);
  if (!s) return "";
  if (!/^https?:\/\/.+/i.test(s)) return "";
  return s;
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

  // ✅ AUTHZ comes from allowlist table ("access"), not from having rows in the sheet
  const { data: accessRow, error: accessErr } = await supabaseServer
    .from("access")
    .select("client_name,email")
    .eq("email", email)
    .maybeSingle();

  if (accessErr) {
    return NextResponse.json(
      { ok: false, reason: "access_lookup_failed", error: accessErr.message },
      { status: 500 }
    );
  }

  if (!accessRow?.email) {
    return NextResponse.json({ ok: false, reason: "not_allowed" }, { status: 403 });
  }

  const allowlistedClientName = toText(accessRow.client_name);

  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;

  // ✅ include column L now
  const updatesResp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "updates!A:L",
  });

  const values = updatesResp.data.values as string[][] | undefined;

  // If sheet has no data, still allow login (empty portal)
  if (!values?.length) {
    return NextResponse.json({
      ok: true,
      client_name: allowlistedClientName,
      last_updated: "",
      project_files_url: "",
      rows: [],
    });
  }

  // rowsFromValues should return objects keyed by your headers
  const allRows = rowsFromValues(values);

  // Filter to this user’s rows
  const clientRows = allRows.filter((r: any) => toText(r.email).toLowerCase() === email);

  // ✅ IMPORTANT: If they have zero projects, do NOT 403 — return empty rows.
  if (!clientRows.length) {
    return NextResponse.json({
      ok: true,
      client_name: allowlistedClientName,
      last_updated: "",
      project_files_url: "",
      rows: [],
    });
  }

  // Prefer client name from sheet if present, else allowlist value
  const clientName = toText(clientRows[0]?.client_name) || allowlistedClientName;

  // Last updated: pick the last non-empty (simple/robust)
  const lastUpdated =
    [...clientRows]
      .map((r: any) => toText(r.last_updated))
      .filter(Boolean)
      .slice(-1)[0] || "";

  // Column L: try common header names; fall back to empty if absent
  const projectFilesUrl =
    cleanUrl((clientRows[0] as any).project_files_url) ||
    cleanUrl((clientRows[0] as any).project_files) ||
    cleanUrl((clientRows[0] as any).files_url) ||
    "";

  const rows = clientRows.map((r: any) => ({
    project: toText(r.project),
    task: toText(r.task),
    status: toText(r.status),
    estimated_completion: toText(r.estimated_completion),
    actual_completion: toText(r.actual_completion),
  }));

  return NextResponse.json({
    ok: true,
    client_name: clientName,
    last_updated: lastUpdated,
    project_files_url: projectFilesUrl,
    rows,
  });
}
