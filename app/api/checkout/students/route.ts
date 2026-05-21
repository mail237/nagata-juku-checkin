import { NextResponse } from "next/server";
import {
  AppsScriptError,
  appsScriptSheetsEnabled,
} from "@/lib/apps-script-client";
import { loadStudentsCached } from "@/lib/apps-script-student";
import { getAllStudents } from "@/lib/sheets";

const UNSET = "（未設定）";

/** シート更新直後も古い一覧が返らないようにする */
export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

/** 入退室画面用: 学年・氏名の選択に必要な最小限の一覧（認証なし） */
export async function GET() {
  try {
    if (appsScriptSheetsEnabled()) {
      const raw = await loadStudentsCached();
      const students = raw.map((s) => ({
        studentId: s.studentId,
        name: s.name,
        grade: s.grade || UNSET,
        qrValue: s.qrValue,
      }));
      return NextResponse.json({ students }, { headers: noStoreHeaders });
    }
    const rows = await getAllStudents();
    const students = rows.map((s) => ({
      studentId: s.studentId.trim(),
      name: s.name.trim(),
      grade: s.grade.trim() || UNSET,
    }));
    return NextResponse.json({ students }, { headers: noStoreHeaders });
  } catch (e) {
    console.error(e);
    const status = e instanceof AppsScriptError ? e.statusCode : 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "生徒一覧の取得に失敗しました" },
      { status, headers: noStoreHeaders }
    );
  }
}
