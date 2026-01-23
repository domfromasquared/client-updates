import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getSheetsClient } from "@/lib/google/sheets";

export async function POST(req: Request) {
  try {
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

    const userEmail = userData.user.email.toLowerCase();

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { ok: false, reason: "invalid_body" },
        { status: 400 }
      );
    }

    const {
      client_name,
      project,
      task,
      note,
    }: {
      client_name?: string;
      project?: string;
      task?: string;
      note?: string;
    } = body;

    const noteRaw = (note || "").trim();
    if (!noteRaw) {
      return NextResponse.json(
        { ok: false, reason: "empty_note" },
        { status: 400 }
      );
    }

    // Basic length protection (prevents abuse / accidental paste)
    if (noteRaw.length > 2000) {
      return NextResponse.json(
        { ok: false, reason: "note_too_long" },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();

    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID!;

    // Expected columns in client_notes:
    // A timestamp
    // B email
    // C client_name
    // D project
    // E task
    // F note
    const appendResp = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "client_notes!A:F",
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          timestamp,
          userEmail,
          client_name || "",
          project || "",
          task || "",
          noteRaw,
        ]],
      },
    });

    return NextResponse.json({
      ok: true,
      updatedRange: appendResp.data.updates?.updatedRange,
    });
  } catch (err) {
    console.error("NOTES API ERROR:", err);
    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500 }
    );
  }
}
