// src/lib/google/sheets.ts
import { google } from "googleapis";

function normalizePrivateKey(key: string) {
  return key.replace(/\\n/g, "\n");
}

export async function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const privateKey = normalizePrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!);

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    // WRITE scope (required for appending notes)
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

export function rowsFromValues(values: string[][]) {
  const [header, ...data] = values;
  return data.map((row) =>
    Object.fromEntries(header.map((h, i) => [h, row[i] ?? ""]))
  ) as Record<string, string>[];
}
