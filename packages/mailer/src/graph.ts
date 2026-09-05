import { env } from "@receivingX/env/server";

export class MailerNotConfiguredError extends Error {
  constructor() {
    super("Microsoft Graph mailer is not configured (MS_TENANT_ID/MS_CLIENT_ID/MS_CLIENT_SECRET/MS_SENDER_UPN)");
  }
}

export function graphConfigured(): boolean {
  return Boolean(env.MS_TENANT_ID && env.MS_CLIENT_ID && env.MS_CLIENT_SECRET && env.MS_SENDER_UPN);
}

let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * Client-credentials (app-only) OAuth2 token for Microsoft Graph. Requires an
 * app registration with the application permission `Mail.Send`, admin
 * consented, ideally scoped to the sender mailbox via an Application Access
 * Policy. See docs/PLAN.md section "Open items".
 */
async function getAccessToken(): Promise<string> {
  if (!graphConfigured()) throw new MailerNotConfiguredError();
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  const res = await fetch(`https://login.microsoftonline.com/${env.MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.MS_CLIENT_ID!,
      client_secret: env.MS_CLIENT_SECRET!,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to get Graph token: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export type GraphAttachment = {
  name: string;
  contentType: string;
  contentBytes: string; // base64
};

export type SendMailParams = {
  subject: string;
  html: string;
  text: string;
  to: string[];
  cc?: string[];
  attachments?: GraphAttachment[];
};

export type SendMailResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Sends via POST /users/{upn}/sendMail. Graph's sendMail doesn't return a
 * message id directly (202 Accepted, no body); callers should still record
 * the send attempt for the resend/audit UI.
 */
export async function sendGraphMail(params: SendMailParams): Promise<SendMailResult> {
  if (!graphConfigured()) {
    return { ok: false, error: "Mailer not configured" };
  }
  try {
    const token = await getAccessToken();
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(env.MS_SENDER_UPN!)}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            subject: params.subject,
            body: { contentType: "HTML", content: params.html },
            toRecipients: params.to.map((address) => ({ emailAddress: { address } })),
            ccRecipients: (params.cc ?? []).map((address) => ({ emailAddress: { address } })),
            attachments: (params.attachments ?? []).map((a) => ({
              "@odata.type": "#microsoft.graph.fileAttachment",
              name: a.name,
              contentType: a.contentType,
              contentBytes: a.contentBytes,
            })),
          },
          saveToSentItems: true,
        }),
        signal: AbortSignal.timeout(30000),
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Graph sendMail ${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
