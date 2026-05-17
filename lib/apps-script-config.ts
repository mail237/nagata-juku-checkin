/**
 * Apps Script ウェブアプリ URL（デプロイし直したらここも更新）
 * Vercel の GOOGLE_APPS_SCRIPT_URL は typo しやすいため、コード側を正とする。
 */
export const APPS_SCRIPT_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbyAp6ulPabn0CPlpP6cWMcHVsgfRA15wBY-MG7tPW8DbqBlLQcl4ZN8S8RmO5dYTvL-uQ/exec";

const DEPLOYMENT_ID = "AKfycbyAp6ulPabn0CPlpP6cWMcHVsgfRA15wBY-MG7tPW8DbqBlLQcl4ZN8S8RmO5dYTvL-uQ";

export function resolveAppsScriptUrl(): string {
  const fromEnv = process.env.GOOGLE_APPS_SCRIPT_URL?.trim();
  if (fromEnv && fromEnv.includes(DEPLOYMENT_ID)) return fromEnv;
  return APPS_SCRIPT_WEB_APP_URL;
}
