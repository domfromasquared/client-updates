import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getSheetsClient } from "@/lib/google/sheets";
import { sendGmailConfirmationEmail } from "@/lib/google/gmail";

type NotesBody = {
  client_name?: string;
  project?: string;
  task?: string;
  note?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function safeTrim(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function parseIsoDate(v: string) {
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : NaN;
}

function isValidHttpUrl(url: string) {
  return /^https?:\/\/.+/i.test(url);
}

export async function POST(req: Request) {
  // ---- Auth: Bearer token ----
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

  const userEmail = userData.user.email.toLowerCase();

  // ---- Allowlist: Supabase table `access` ----
  // Must exist already (you’re using it).
  const { data: accessRow, error: accessErr } = await supabaseServer
    .from("access")
    .select("email, client_name")
    .eq("email", userEmail)
    .maybeSingle();

  if (accessErr) {
    return NextResponse.json({ ok: false, reason: "access_lookup_failed" }, { status: 500 });
  }

  if (!accessRow?.email) {
    return NextResponse.json({ ok: false, reason: "not_allowed" }, { status: 403 });
  }

  // ---- Body validation ----
  const body = (await req.json().catch(() => ({}))) as NotesBody;

  const client_name = safeTrim(body.client_name) || safeTrim(accessRow.client_name) || "";
  const project = safeTrim(body.project);
  const task = safeTrim(body.task);
  const noteRaw = safeTrim(body.note);

  if (!noteRaw) {
    return NextResponse.json({ ok: false, reason: "missing_note" }, { status: 400 });
  }

  // 1000 characters max (your requirement)
  if (noteRaw.length > 1000) {
    return NextResponse.json({ ok: false, reason: "too_long" }, { status: 400 });
  }

  // ---- Sheets: rate limit + dedupe check using `client_notes` tab ----
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;
  const notesTab = process.env.GOOGLE_NOTES_TAB_NAME || "client_notes";

  // We will read recent notes (lightweight; fine for ~20 clients).
  // Expected columns we write: timestamp, email, client_name, project, task, note
  // (If your tab has headers, keep them in row 1 — this code handles either.)
  const existingResp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${notesTab}!A:F`,
  });

  const values = (existingResp.data.values || []) as string[][];

  // Identify if first row looks like headers
  const startIdx =
    values.length &&
    values[0].some((c) => String(c || "").toLowerCase().includes("timestamp") || String(c || "").toLowerCase() === "email")
      ? 1
      : 0;

  const now = Date.now();
  const windowMs = 5 * 60 * 1000; // 5 min dedupe window (your 1B preference)
  const dayMs = 24 * 60 * 60 * 1000;

  let notesLast24h = 0;
  let isDuplicate = false;

  // Walk from the end to efficiently check the most recent entries
  for (let i = values.length - 1; i >= startIdx; i--) {
    const row = values[i] || [];
    const ts = safeTrim(row[0]);
    const email = safeTrim(row[1]).toLowerCase();
    const rProject = safeTrim(row[3]);
    const rTask = safeTrim(row[4]);
    const rNote = safeTrim(row[5]);

    if (!email || email !== userEmail) continue;

    const t = parseIsoDate(ts);
    if (!Number.isFinite(t)) continue;

    const age = now - t;

    // Count notes in last 24h (rate limit)
    if (age <= dayMs) {
      notesLast24h += 1;
    } else {
      // since we're iterating backwards, once we hit >24h, we can stop counting
      // but still might want dedupe check only within 5 min, so we can break
      // after age > 24h because older can't be in 5 min window either.
      break;
    }

    // Dedupe check (same content within 5 min)
    if (
      age <= windowMs &&
      rProject === project &&
      rTask === task &&
      rNote === noteRaw
    ) {
      isDuplicate = true;
      break;
    }
  }

  // Rate limit: 5 per 24h
  if (notesLast24h >= 5) {
    return NextResponse.json(
      { ok: false, reason: "rate_limited" },
      { status: 429 }
    );
  }

  // If duplicate: accept but do NOT append or email
  if (isDuplicate) {
    return NextResponse.json({
      ok: true,
      email_sent: false,
      reason: "duplicate",
    });
  }

  // ---- Append note to Sheets first (source of truth) ----
  const timestamp = nowIso();

  const appendResp = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${notesTab}!A:F`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[timestamp, userEmail, client_name, project, task, noteRaw]],
    },
  });

  const updatedRange = appendResp.data.updates?.updatedRange || "";

  // ---- Send branded confirmation email via Gmail API (Workspace DWD) ----
  // Only send if write succeeded and not duplicate/rate-limited (we already ensured).
  const impersonateAs = process.env.GMAIL_IMPERSONATE_AS || "dom@asquaredpro.com";
  const fromLabel = process.env.GMAIL_FROM_LABEL || "A Squared";
  const replyTo = process.env.GMAIL_REPLY_TO || impersonateAs;

  // Minimal email (your 2A preference: no sensitive data, no sheet links)
  const subject = `We received your note${project ? `: ${project}` : ""}`;
  const textLines = [
    `Hi${client_name ? ` ${client_name}` : ""},`,
    ``,
    `We received your note and logged it successfully.`,
    ``,
    project ? `Project: ${project}` : "",
    task ? `Task: ${task}` : "",
    `Time: ${new Date(timestamp).toLocaleString()}`,
    ``,
    `If you have more context to add, reply to this email.`,
    ``,
    `— ${fromLabel}`,
  ].filter(Boolean);

  try {
    await sendGmailConfirmationEmail(impersonateAs, {
      from: `${fromLabel} <${impersonateAs}>`,
      to: userEmail,
      subject,
      text: textLines.join("\n"),
      replyTo,
    });

    return NextResponse.json({
      ok: true,
      updatedRange,
      email_sent: true,
      reason: "sent",
    });
  } catch (e: any) {
    // If email fails, we still consider the note successfully logged.
    return NextResponse.json({
      ok: true,
      updatedRange,
      email_sent: false,
      reason: "email_failed",
      error: e?.message || "email_failed",
    });
  }
}
