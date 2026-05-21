import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-constants";
import {
  AppsScriptError,
  appsScriptCall,
  appsScriptSheetsEnabled,
} from "@/lib/apps-script-client";
import { invalidateStudentsCache } from "@/lib/apps-script-student";
import { verifyAdminSessionToken } from "@/lib/admin-session";
import { getAllStudents, updateStudentRow } from "@/lib/sheets";

async function assertAdmin() {
  const jar = await cookies();
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
  if (!verifyAdminSessionToken(token)) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const denied = await assertAdmin();
  if (denied) return denied;
  try {
    if (appsScriptSheetsEnabled()) {
      const data = await appsScriptCall<{ students: unknown[] }>({
        action: "students",
      });
      return NextResponse.json(data);
    }
    const students = await getAllStudents();
    return NextResponse.json({ students });
  } catch (e) {
    console.error(e);
    const status = e instanceof AppsScriptError ? e.statusCode : 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "生徒マスタの取得に失敗しました" },
      { status }
    );
  }
}

export async function PATCH(req: Request) {
  const denied = await assertAdmin();
  if (denied) return denied;
  try {
    const body = await req.json();
    const rowIndex = Number(body.rowIndex);
    if (!Number.isInteger(rowIndex) || rowIndex < 2) {
      return NextResponse.json({ error: "不正な行番号です" }, { status: 400 });
    }
    if (appsScriptSheetsEnabled()) {
      await appsScriptCall({ action: "updateStudent", ...body });
      invalidateStudentsCache();
      return NextResponse.json({ ok: true });
    }
    await updateStudentRow(rowIndex, {
      studentId: String(body.studentId ?? ""),
      name: String(body.name ?? ""),
      parentEmail: String(body.parentEmail ?? ""),
      qrValue: String(body.qrValue ?? ""),
      note: String(body.note ?? ""),
      grade: String(body.grade ?? ""),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    const status = e instanceof AppsScriptError ? e.statusCode : 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "更新に失敗しました" },
      { status }
    );
  }
}
