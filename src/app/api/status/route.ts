import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getSheetsClient, rowsFromValues } from "@/lib/google/sheets";

function toISODateValue(v: string) {
  return (v || "").trim();
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer (.+)$/);

  if (!match) {
    return NextResponse.json(
      { ok: false, reason: "missing_bearer" },
      { status: 401 }
    );
  }

  const token = match[1];
  const { data: userData, error: userErr } =
    await supabaseServer.auth.getUser(token);

  if (userErr || !userData?.user?.email) {
    return NextResponse.json(
      { ok: false, reason: "invalid_token" },
      { status: 401 }
    );
  }

  const email = userData.user.email.toLowerCase();

  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;

  const updatesResp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "updates!A:K",
  });

  const values = updatesResp.data.values as string[][] | undefined;

  if (!values || values.length < 2) {
    // Sheet exists but has no data rows yet
    return NextResponse.json({
      ok: true,
      client_name: "",
      last_updated: "",
      rows: [],
    });
  }

  const allRows = rowsFromValues(values);

  // Rows matching this user
  const clientRows = allRows.filter(
    (r) => (r.email || "").toLowerCase() === email
  );

  // 🚨 IMPORTANT FIX:
  // Only deny if the email NEVER appears in the sheet at all
  const emailExistsAnywhere = allRows.some(
    (r) => (r.email || "").toLowerCase() === email
  );

  if (!emailExistsAnywhere) {
    return NextResponse.json(
      { ok: false, reason: "not_allowed" },
      { status: 403 }
    );
  }

  // Client is valid but has zero active projects
  if (!clientRows.length) {
    return NextResponse.json({
      ok: true,
      client_name: "",
      last_updated: "",
      rows: [],
    });
  }

  const clientName = (clientRows[0].client_name || "").trim();

  const lastUpdated =
    [...clientRows]
      .map((r) => (r.last_updated || "").trim())
      .filter(Boolean)
      .slice(-1)[0] || "";

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
    rows,
  });
}