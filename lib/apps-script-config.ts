/**
 * Apps Script ウェブアプリ URL（デプロイし直したらここも更新）
 * GOOGLE_APPS_SCRIPT_URL があればそちらを優先（Vercel / .env.local）
 */
export const APPS_SCRIPT_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbwESRlXvF8cGEOTgwuJM3CFMgMGFGuPunKF_PrSdZ2lw0pijynZy_umXDS9-2j8GI4C-A/exec";

/** 壊れている・古いデプロイ ID（Vercel env に残っていても使わない） */
const DEPRECATED_DEPLOYMENT_IDS = [
  "AKfycbyAp6ulPabn0CPlpP6cWMcHVsgfRA15wBY-MG7tPW8DbqBlLQcl4ZN8S8RmO5dYTvL-uQ",
];

export function resolveAppsScriptUrl(): string {
  const fromEnv = process.env.GOOGLE_APPS_SCRIPT_URL?.trim();
  if (fromEnv && fromEnv.includes("/macros/s/") && fromEnv.endsWith("/exec")) {
    for (const bad of DEPRECATED_DEPLOYMENT_IDS) {
      if (fromEnv.includes(bad)) return APPS_SCRIPT_WEB_APP_URL;
    }
    return fromEnv;
  }
  return APPS_SCRIPT_WEB_APP_URL;
}
