import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getSheetsClient, rowsFromValues } from "@/lib/google/sheets";

function toISODateValue(v: string) {
  // works if your sheet uses YYYY-MM-DD; if not, we’ll just treat it as text
  return (v || "").trim();
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

  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;

  const updatesResp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "updates!A:K",
  });

  const values = updatesResp.data.values as string[][] | undefined;
  if (!values?.length) {
    return NextResponse.json({ ok: true, client_name: "", last_updated: "", rows: [] });
  }

  const allRows = rowsFromValues(values);

  // Filter to the logged-in user's rows
  const clientRows = allRows.filter((r) => (r.email || "").toLowerCase() === email);

  if (!clientRows.length) {
    // logged in but not in sheet (or email mismatch)
    return NextResponse.json({ ok: false, reason: "not_allowed" }, { status: 403 });
  }

  const clientName = (clientRows[0].client_name || "").trim();

  // Compute "last updated" as the most recent non-empty last_updated string (simple + robust)
  // If you use real dates, we can sort by date later; for now pick the latest non-empty by appearance.
  const lastUpdated =
    [...clientRows]
      .map((r) => (r.last_updated || "").trim())
      .filter(Boolean)
      .slice(-1)[0] || "";

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
    rows,
  });
}
