// src/app/api/notes/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getSheetsClient } from "@/lib/google/sheets";

const NOTES_SHEET_TITLE = "client_notes";
const NOTES_HEADERS = ["timestamp", "client_name", "project", "task", "note", "submitted_by"];

async function ensureNotesSheetExists(sheets: any, spreadsheetId: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets?.some((s: any) => s.properties?.title === NOTES_SHEET_TITLE);

  if (existing) return;

  // 1) Create sheet
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: NOTES_SHEET_TITLE } } }],
    },
  });

  // 2) Add header row
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${NOTES_SHEET_TITLE}!A1:F1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [NOTES_HEADERS] },
  });
}

export async function POST(req: Request) {
  // Verify bearer token
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

  const submittedBy = userData.user.email.toLowerCase();

  const body = (await req.json().catch(() => null)) as null | {
    client_name?: string;
    project?: string;
    task?: string;
    note?: string;
  };

  const clientName = (body?.client_name || "").trim();
  const project = (body?.project || "").trim();
  const task = (body?.task || "").trim();
  const note = (body?.note || "").trim();

  if (!clientName || !project || !note) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields (client_name, project, note)" },
      { status: 400 }
    );
  }

  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;
  const timestamp = new Date().toISOString();

  try {
    const sheets = await getSheetsClient();

    // Ensure tab exists + has headers
    await ensureNotesSheetExists(sheets, spreadsheetId);

    // Append note
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${NOTES_SHEET_TITLE}!A:F`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[timestamp, clientName, project, task, note, submittedBy]],
      },
    });

    return NextResponse.json({
      ok: true,
      spreadsheetId,
      updatedRange: result.data?.updates?.updatedRange || null,
      updatedRows: result.data?.updates?.updatedRows || null,
    });
  } catch (e: any) {
    // This will surface permission issues, wrong sheet ID, etc.
    return NextResponse.json(
      { ok: false, error: e?.message || "Sheets append failed" },
      { status: 500 }
    );
  }
}
