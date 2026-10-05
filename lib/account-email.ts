import { createHash } from "node:crypto";
import { Resend } from "resend";

type AccountEmailKind = "verify-email" | "reset-password";

export function isAccountEmailDeliveryConfigured() {
  return process.env.AUTH_EMAIL_DELIVERY_ENABLED === "true"
    && Boolean(process.env.RESEND_API_KEY)
    && Boolean(process.env.AUTH_EMAIL_FROM);
}

function emailConfiguration() {
  if (!isAccountEmailDeliveryConfigured()) {
    throw new Error("Account email delivery is not configured.");
  }
  return {
    apiKey: process.env.RESEND_API_KEY as string,
    from: process.env.AUTH_EMAIL_FROM as string
  };
}

function emailMarkup(kind: AccountEmailKind, url: string) {
  const verification = kind === "verify-email";
  const heading = verification ? "Verify your AEROSFORGE email" : "Reset your AEROSFORGE password";
  const action = verification ? "Verify email" : "Reset password";
  const expiry = verification ? "60 minutes" : "30 minutes";
  const safeUrl = url.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return `<!doctype html><html><body style="margin:0;background:#071018;color:#ecf4f8;font-family:Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:40px 24px"><p style="color:#f4b942;font-weight:700;letter-spacing:.12em">AEROSFORGE ONE</p><h1 style="font-size:28px">${heading}</h1><p style="line-height:1.6;color:#c8d5dc">Use the secure link below to continue. This link expires in ${expiry}.</p><p style="margin:32px 0"><a href="${safeUrl}" style="display:inline-block;background:#f4b942;color:#071018;padding:14px 20px;border-radius:8px;text-decoration:none;font-weight:700">${action}</a></p><p style="line-height:1.6;color:#8ea3ad;font-size:13px">If you did not request this, you can safely ignore this email. AEROSFORGE will never ask you to send your password by email.</p></div></body></html>`;
}

export async function sendAccountEmail(input: { kind: AccountEmailKind; to: string; url: string }) {
  const { apiKey, from } = emailConfiguration();
  const verification = input.kind === "verify-email";
  const idempotencyKey = createHash("sha256").update(input.url).digest("hex").slice(0, 32);
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject: verification ? "Verify your AEROSFORGE ONE email" : "Reset your AEROSFORGE ONE password",
    html: emailMarkup(input.kind, input.url)
  }, { idempotencyKey: `aerosforge-${input.kind}-${idempotencyKey}` });
  if (error) throw new Error(`Account email delivery failed: ${error.message}`);
}
