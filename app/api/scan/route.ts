import { after, NextResponse } from "next/server";
import {
  AppsScriptError,
  appsScriptCall,
  appsScriptSheetsEnabled,
} from "@/lib/apps-script-client";
import {
  findStudentViaGas,
  getLastLogTypeViaGas,
} from "@/lib/apps-script-student";
import {
  appendLogRow,
  explicitEntryTypeError,
  findStudentByQr,
  findStudentByStudentId,
  getLatestLogTypeForStudent,
  nextEntryType,
  type StudentRow,
} from "@/lib/sheets";
import { resolveSendStatusForParent } from "@/lib/scan-email";
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

function buildScanBody(
  st: { qrValue: string; studentId: string },
  type: "入室" | "退室",
  sendStatus?: "送信済み" | "エラー"
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    action: "scan",
    entryType: type,
  };
  if (sendStatus) {
    body.emailHandledByServer = true;
    body.sendStatus = sendStatus;
  }
  if (st.qrValue) body.qrValue = st.qrValue;
  else if (st.studentId) body.studentId = st.studentId;
  return body;
}

async function scanViaAppsScript(
  studentId: string,
  qrValue: string,
  entryExplicit: "入室" | "退室" | null
) {
  const st = await findStudentViaGas(studentId, qrValue);
  if (!st) {
    return NextResponse.json({
      success: false,
      error: "生徒が見つかりませんでした",
    });
  }

  if (!st.qrValue && !st.studentId) {
    return NextResponse.json({
      success: false,
      error: "生徒マスタに QR 値が未設定です（D列）",
    });
  }

  let type: "入室" | "退室";
  if (entryExplicit) {
    type = entryExplicit;
  } else {
    const last = await getLastLogTypeViaGas(st.studentId);
    type = nextEntryType(last);
  }

  const at = new Date();
  const parentEmail = st.parentEmail;
  const studentName = st.name;
  const sid = st.studentId;

  // 1) 先にスプレッドシートへ記録（ここまで待つ → 画面を早く返す）
  const data = await appsScriptCall<{
    success?: boolean;
    error?: string;
    studentName?: string;
    type?: string;
    timestamp?: string;
    sheetTimestamp?: string;
  }>(buildScanBody(st, type));

  if (data.success === false) {
    return NextResponse.json(data);
  }

  const sheetTs =
    typeof data.sheetTimestamp === "string"
      ? data.sheetTimestamp
      : formatTimestampTokyo(at);

  // 2) メール送信と E列更新は応答後に実行（体感的な待ち時間を短縮）
  if (isSendGridConfigured() && parentEmail) {
    after(async () => {
      const sendStatus = await resolveSendStatusForParent(
        parentEmail,
        studentName,
        type,
        at
      );
      if (sendStatus !== "送信済み") return;
      try {
        await appsScriptCall({
          action: "updateLogSendStatus",
          studentId: sid,
          sheetTimestamp: sheetTs,
          sendStatus,
        });
      } catch {
        /* 旧 GAS は未対応 */
      }
    });
  }

  return NextResponse.json(data);
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
        if (isSendGridConfigured()) {
          return await scanViaAppsScript(studentId, qrValue, entryExplicit);
        }

        const st = await findStudentViaGas(studentId, qrValue);
        if (!st) {
          return NextResponse.json({
            success: false,
            error: "生徒が見つかりませんでした",
          });
        }
        const data = await appsScriptCall(
          buildScanBody(st, entryExplicit ?? "入室")
        );
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
