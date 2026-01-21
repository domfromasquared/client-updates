import { google } from "googleapis";
import { JWT } from "google-auth-library";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

/**
 * Expects GOOGLE_SERVICE_ACCOUNT_JSON to contain the full service account JSON
 * (the same one you use for Sheets). Keep it ONLY in Vercel env vars.
 */
function getServiceAccountFromEnv() {
  const raw = requireEnv("GOOGLE_SERVICE_ACCOUNT_JSON");

  // Support either raw JSON or base64 JSON (optional convenience)
  let jsonStr = raw.trim();
  if (!jsonStr.startsWith("{")) {
    // try base64
    jsonStr = Buffer.from(jsonStr, "base64").toString("utf8");
  }

  const creds = JSON.parse(jsonStr);

  if (!creds.client_email || !creds.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON missing client_email/private_key");
  }

  return creds as { client_email: string; private_key: string };
}

/**
 * Create a Gmail API client that impersonates a Workspace user (domain-wide delegation).
 * The Workspace admin must authorize the service account client_id + scopes.
 */
export function getGmailClientImpersonating(subjectEmail: string) {
  const creds = getServiceAccountFromEnv();

  const auth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/gmail.send"],
    subject: subjectEmail, // <-- DWD impersonation
  });

  return google.gmail({ version: "v1", auth });
}

/**
 * Gmail API expects the RFC 2822 message encoded as base64url.
 */
function base64UrlEncode(input: string) {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

type SendEmailArgs = {
  from: string;          // ex: "A Squared <dom@asquaredpro.com>"
  to: string;            // recipient email
  subject: string;
  text: string;          // plain text body
  replyTo?: string;      // optional
};

/**
 * Sends a plain-text email via Gmail API.
 * `impersonateAs` should be the real Workspace mailbox (dom@asquaredpro.com).
 */
export async function sendGmailConfirmationEmail(
  impersonateAs: string,
  { from, to, subject, text, replyTo }: SendEmailArgs
) {
  const gmail = getGmailClientImpersonating(impersonateAs);

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
  ];

  if (replyTo) headers.splice(1, 0, `Reply-To: ${replyTo}`);

  const rawMessage = `${headers.join("\r\n")}\r\n\r\n${text}\r\n`;
  const raw = base64UrlEncode(rawMessage);

  await gmail.users.messages.send({
    userId: "me", // "me" == impersonated subject user
    requestBody: { raw },
  });
}
