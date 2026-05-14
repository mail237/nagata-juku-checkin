import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-constants";
import {
  AppsScriptError,
  appsScriptCall,
  appsScriptSheetsEnabled,
} from "@/lib/apps-script-client";
import { verifyAdminSessionToken } from "@/lib/admin-session";
import { getTodayLogs } from "@/lib/sheets";

export async function GET() {
  const jar = await cookies();
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
  if (!verifyAdminSessionToken(token)) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  try {
    if (appsScriptSheetsEnabled()) {
      const data = await appsScriptCall<{ logs: unknown[] }>({
        action: "logsToday",
      });
      return NextResponse.json(data);
    }
    const rows = await getTodayLogs();
    const logs = rows.map((r) => ({
      timestamp: r[0] ?? "",
      studentId: r[1] ?? "",
      studentName: r[2] ?? "",
      type: r[3] ?? "",
      sendStatus: r[4] ?? "",
      grade: r[5] ?? "",
    }));
    return NextResponse.json({ logs });
  } catch (e) {
    console.error(e);
    const status = e instanceof AppsScriptError ? e.statusCode : 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "ログの取得に失敗しました" },
      { status }
    );
  }
}
