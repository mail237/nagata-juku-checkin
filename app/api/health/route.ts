import { NextResponse } from "next/server";
import { appsScriptSheetsEnabled } from "@/lib/apps-script-client";

function isSet(v: string | undefined): boolean {
  return Boolean(v && String(v).trim() !== "");
}

function googleServiceAccountReady(): boolean {
  return (
    isSet(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) &&
    isSet(process.env.GOOGLE_PRIVATE_KEY) &&
    isSet(process.env.GOOGLE_SPREADSHEET_ID)
  );
}

/**
 * デプロイ先の生存確認用。秘密は返しません。
 */
export async function GET() {
  const appsScript = appsScriptSheetsEnabled();
  const checks = {
    sendgrid: isSet(process.env.SENDGRID_API_KEY) && isSet(process.env.SENDGRID_FROM_EMAIL),
    googleSheets: appsScript || googleServiceAccountReady(),
    appsScriptProxy: appsScript,
    adminPin: isSet(process.env.ADMIN_PIN),
  };
  const ready = checks.sendgrid && checks.googleSheets && checks.adminPin;
  return NextResponse.json(
    {
      ok: true,
      ready,
      checks,
    },
    { status: ready ? 200 : 503 }
  );
}
