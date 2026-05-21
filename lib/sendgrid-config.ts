/** SendGrid が Vercel / .env.local で使えるか */
export function isSendGridConfigured(): boolean {
  const key = process.env.SENDGRID_API_KEY?.trim() ?? "";
  const from = process.env.SENDGRID_FROM_EMAIL?.trim() ?? "";
  return Boolean(key && from && key.startsWith("SG."));
}
