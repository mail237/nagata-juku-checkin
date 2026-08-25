import { after, NextResponse } from "next/server";
import {
  AppsScriptError,
  appsScriptCall,
  appsScriptSheetsEnabled,
} from "@/lib/apps-script-client";
import { findStudentViaGas, loadStudentsCached } from "@/lib/apps-script-student";
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

function buildRecordBody(
  st: { qrValue: string; studentId: string },
  type: "入室" | "退室",
  sendStatus: "送信済み" | "エラー"
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    action: "recordEntry",
    entryType: type,
    emailHandledByServer: true,
    sendStatus,
  };
  if (st.qrValue) body.qrValue = st.qrValue;
  else body.studentId = st.studentId;
  return body;
}

const CHECKOUT_ORDER_ERROR =
  "直前の記録が入室ではないため、入室を押してから退室を記録してください。";

async function gasRecordEntry<T extends { success?: boolean; error?: string }>(
  st: { qrValue: string; studentId: string },
  type: "入室" | "退室",
  sendStatus: "送信済み" | "エラー"
): Promise<T> {
  try {
    return await appsScriptCall<T>(buildRecordBody(st, type, sendStatus));
  } catch (e) {
    const msg = e instanceof AppsScriptError ? e.message : "";
    if (!msg.includes("recordEntry")) throw e;
    const scanBody: Record<string, unknown> = {
      action: "scan",
      entryType: type,
      emailHandledByServer: true,
      sendStatus,
    };
    if (st.qrValue) scanBody.qrValue = st.qrValue;
    else scanBody.studentId = st.studentId;
    return appsScriptCall<T>(scanBody);
  }
}

async function scanViaAppsScript(
  studentId: string,
  qrValue: string,
  entryExplicit: "入室" | "退室" | null
) {
  const rosterPromise = loadStudentsCached();
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

  const type = entryExplicit ?? nextEntryType(null);
  const at = new Date();

  let sendStatus: "送信済み" | "エラー" = "エラー";
  if (isSendGridConfigured() && st.parentEmail) {
    sendStatus = await resolveSendStatusForParent(
      st.parentEmail,
      st.name,
      type,
      at
    );
  }

  const data = await gasRecordEntry<{
    success?: boolean;
    error?: string;
    studentName?: string;
    type?: string;
    timestamp?: string;
    sheetTimestamp?: string;
  }>(st, type, sendStatus);

  if (data.success === false) {
    return NextResponse.json(data);
  }

  const sheetTs =
    typeof data.sheetTimestamp === "string"
      ? data.sheetTimestamp
      : formatTimestampTokyo(at);

  if (sendStatus === "送信済み") {
    after(async () => {
      try {
        await appsScriptCall({
          action: "updateLogSendStatus",
          studentId: st.studentId,
          sheetTimestamp: sheetTs,
          sendStatus: "送信済み",
        });
      } catch {
        /* 旧 GAS では未対応 → 下の deploy:gas で Code.gs を新バージョンデプロイ */
      }
    });
  }

  return NextResponse.json({
    ...data,
    sendStatus,
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
        const scanBody: Record<string, unknown> = {
          action: "scan",
          ...(entryExplicit ? { entryType: entryExplicit } : {}),
        };
        if (st.qrValue) scanBody.qrValue = st.qrValue;
        else scanBody.studentId = st.studentId;
        const data = await appsScriptCall(scanBody);
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
