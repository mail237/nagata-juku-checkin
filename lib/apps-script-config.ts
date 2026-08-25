/**
 * Apps Script ウェブアプリ URL（デプロイし直したらここも更新）
 * GOOGLE_APPS_SCRIPT_URL があればそちらを優先（Vercel / .env.local）
 */
export const APPS_SCRIPT_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbxACq3D9EW2a_f0FBaKQlxSLcSvTXPQADAdiPZmC1UbiCTCJx-02sNcIPvEKOq5SQ/exec";

/** 古いデプロイ（使わない） */
const DEPRECATED_DEPLOYMENT_IDS = [
  "AKfycbwESRlXvF8cGEOTgwuJM3CFMgMGFGuPunKF_PrSdZ2lw0pijynZy_umXDS9-2j8GI4C-A",
  "AKfycbyAp6ulPabn0CPlpP6cWMcHVsgfRA15wBY-MG7tPW8DbqBlLQcl4ZN8S8RmO5dYTvL-uQ",
  "AKfycbzaQpP_cDjd8PoS5Pd2I_j0dChC0KZEJi4n-jtONk7EESDSfCwNwmFFpS3Ba0F4xV-9bg",
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
