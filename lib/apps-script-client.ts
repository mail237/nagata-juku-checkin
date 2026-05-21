/**
 * Google Apps Script Web アプリ経由でスプレッドシートを操作する（SA鍵不要）。
 * APPS_SCRIPT_SECRET + 下記 URL（コード内デフォルト）で動作。
 */

import { resolveAppsScriptUrl } from "./apps-script-config";

export class AppsScriptError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

function requireAppsScriptEnv(): { url: string; secret: string } {
  const secret = process.env.APPS_SCRIPT_SECRET?.trim();
  if (!secret) {
    throw new Error("Apps Script が未設定です（APPS_SCRIPT_SECRET）");
  }
  return { url: resolveAppsScriptUrl(), secret };
}

export function appsScriptSheetsEnabled(): boolean {
  return Boolean(process.env.APPS_SCRIPT_SECRET?.trim());
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
    signal: AbortSignal.timeout(12_000),
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
