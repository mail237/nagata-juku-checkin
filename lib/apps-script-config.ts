/**
 * Apps Script ウェブアプリ URL（デプロイし直したらここも更新）
 * GOOGLE_APPS_SCRIPT_URL があればそちらを優先（Vercel / .env.local）
 *
 * 塾スプレッドシート用の新デプロイ（AKfycbw…）に Code.gs 全文＋新バージョン
 * デプロイが完了したら、下の DEFAULT をそちらの /exec に差し替えてください。
 */
export const APPS_SCRIPT_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbyAp6ulPabn0CPlpP6cWMcHVsgfRA15wBY-MG7tPW8DbqBlLQcl4ZN8S8RmO5dYTvL-uQ/exec";

/** 学年（F列）が返らない古いデプロイ（使わない） */
const DEPRECATED_DEPLOYMENT_IDS = [
  "AKfycbwESRlXvF8cGEOTgwuJM3CFMgMGFGuPunKF_PrSdZ2lw0pijynZy_umXDS9-2j8GI4C-A",
];

const KNOWN_GOOD_IDS = [
  "AKfycbyAp6ulPabn0CPlpP6cWMcHVsgfRA15wBY-MG7tPW8DbqBlLQcl4ZN8S8RmO5dYTvL-uQ",
];

export function resolveAppsScriptUrl(): string {
  const fromEnv = process.env.GOOGLE_APPS_SCRIPT_URL?.trim();
  if (fromEnv && fromEnv.includes("/macros/s/") && fromEnv.endsWith("/exec")) {
    for (const bad of DEPRECATED_DEPLOYMENT_IDS) {
      if (fromEnv.includes(bad)) return APPS_SCRIPT_WEB_APP_URL;
    }
    for (const good of KNOWN_GOOD_IDS) {
      if (fromEnv.includes(good)) return fromEnv;
    }
  }
  return APPS_SCRIPT_WEB_APP_URL;
}
