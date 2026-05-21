import { NextResponse } from "next/server";
import {
  AppsScriptError,
  appsScriptCall,
  appsScriptSheetsEnabled,
} from "@/lib/apps-script-client";
import {
  appendLogRow,
  explicitEntryTypeError,
  findStudentByQr,
  findStudentByStudentId,
  getLatestLogTypeForStudent,
  nextEntryType,
  type StudentRow,
} from "@/lib/sheets";
import { sendParentEmailAfterAppsScriptScan } from "@/lib/scan-email";
import { isSendGridConfigured } from "@/lib/sendgrid-config";
import { sendParentEmail } from "@/lib/send-parent-email";
import { formatIsoTokyo, formatTimestampTokyo } from "@/lib/time";

async function checkInWithStudent(student: StudentRow, type: "入室" | "退室") {
  const at = new Date();
  const sheetTs = formatTimestampTokyo(at);

  let sendStatus: "送信済み" | "エラー" = "送信済み";
  if (!student.parentEmail.trim()) {
    sendStatus = "エラー";
  } else {
    try {
      await sendParentEmail({
        to: student.parentEmail.trim(),
        studentName: student.name,
        type,
        at,
      });
    } catch {
      sendStatus = "エラー";
    }
  }

  await appendLogRow([
    sheetTs,
    student.studentId,
    student.name,
    type,
    sendStatus,
    student.grade.trim(),
  ]);

  return NextResponse.json({
    success: true,
    studentName: student.name,
    type,
    timestamp: formatIsoTokyo(at),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
    const qrValue = typeof body.qrValue === "string" ? body.qrValue.trim() : "";
    const rawEntry = typeof body.entryType === "string" ? body.entryType.trim() : "";
    const entryExplicit: "入室" | "退室" | null =
      rawEntry === "入室" || rawEntry === "退室" ? rawEntry : null;

    if (!studentId && !qrValue) {
      return NextResponse.json(
        { success: false, error: "QRの値か生徒IDのどちらかが必要です" },
        { status: 400 }
      );
    }

    if (appsScriptSheetsEnabled()) {
      try {
        const payload = studentId
          ? {
              action: "scan" as const,
              studentId,
              emailHandledByServer: isSendGridConfigured(),
              ...(entryExplicit ? { entryType: entryExplicit } : {}),
            }
          : {
              action: "scan" as const,
              qrValue,
              emailHandledByServer: isSendGridConfigured(),
              ...(entryExplicit ? { entryType: entryExplicit } : {}),
            };
        const data = await appsScriptCall<{
          success?: boolean;
          error?: string;
          studentName?: string;
          type?: string;
          timestamp?: string;
          studentId?: string;
          parentEmail?: string;
          sheetTimestamp?: string;
        }>(payload);
        if (
          data.success &&
          data.studentName &&
          (data.type === "入室" || data.type === "退室")
        ) {
          await sendParentEmailAfterAppsScriptScan(
            {
              success: true,
              studentName: data.studentName,
              type: data.type,
              timestamp: data.timestamp,
              studentId: data.studentId,
              parentEmail: data.parentEmail,
              sheetTimestamp: data.sheetTimestamp,
            },
            studentId
          );
        }
        return NextResponse.json(data);
      } catch (e) {
        if (e instanceof AppsScriptError) {
          return NextResponse.json(
            { success: false, error: e.message },
            { status: e.statusCode >= 400 && e.statusCode < 600 ? e.statusCode : 500 }
          );
        }
        throw e;
      }
    }

    const student = studentId
      ? await findStudentByStudentId(studentId)
      : await findStudentByQr(qrValue);
    if (!student) {
      return NextResponse.json({
        success: false,
        error: "生徒が見つかりませんでした",
      });
    }

    const last = await getLatestLogTypeForStudent(student.studentId);
    let type: "入室" | "退室";
    if (entryExplicit) {
      const err = explicitEntryTypeError(last, entryExplicit);
      if (err) {
        return NextResponse.json({ success: false, error: err });
      }
      type = entryExplicit;
    } else {
      type = nextEntryType(last);
    }

    return checkInWithStudent(student, type);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      {
        success: false,
        error: "サーバーでエラーが発生しました",
      },
      { status: 500 }
    );
  }
}
