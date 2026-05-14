/**
 * Google Apps Script Web アプリ経由でスプレッドシートを操作する（SA鍵不要）。
 * GOOGLE_APPS_SCRIPT_URL + APPS_SCRIPT_SECRET が設定されているときに使用する。
 */

export class AppsScriptError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

function requireAppsScriptEnv(): { url: string; secret: string } {
  const url = process.env.GOOGLE_APPS_SCRIPT_URL?.trim();
  const secret = process.env.APPS_SCRIPT_SECRET?.trim();
  if (!url || !secret) {
    throw new Error("Apps Script が未設定です（GOOGLE_APPS_SCRIPT_URL / APPS_SCRIPT_SECRET）");
  }
  return { url, secret };
}

export function appsScriptSheetsEnabled(): boolean {
  const url = process.env.GOOGLE_APPS_SCRIPT_URL?.trim();
  const secret = process.env.APPS_SCRIPT_SECRET?.trim();
  return Boolean(url && secret);
}

export async function appsScriptCall<T>(
  payload: Record<string, unknown>
): Promise<T> {
  const { url, secret } = requireAppsScriptEnv();
  const res = await fetch(url, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret, ...payload }),
  });
  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new AppsScriptError(
      `Apps Script の応答が JSON ではありません（先頭: ${text.slice(0, 120)}）`,
      502
    );
  }
  if (data.ok === false) {
    throw new AppsScriptError(
      String(data.error || "Apps Script error"),
      Number(data.httpStatus) || 400
    );
  }
  return data as T;
}
