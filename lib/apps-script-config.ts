/**
 * Apps Script ウェブアプリ URL（デプロイし直したらここも更新）
 * GOOGLE_APPS_SCRIPT_URL があればそちらを優先（Vercel / .env.local）
 */
export const APPS_SCRIPT_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbwESRlXvF8cGEOTgwuJM3CFMgMGFGuPunKF_PrSdZ2lw0pijynZy_umXDS9-2j8GI4C-A/exec";

export function resolveAppsScriptUrl(): string {
  const fromEnv = process.env.GOOGLE_APPS_SCRIPT_URL?.trim();
  if (fromEnv && fromEnv.includes("/macros/s/") && fromEnv.endsWith("/exec")) {
    return fromEnv;
  }
  return APPS_SCRIPT_WEB_APP_URL;
}
