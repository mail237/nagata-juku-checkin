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

function scheduleParentEmail(
  studentId: string,
  type: "入室" | "退室",
  at: Date,
  sheetTs: string,
  rosterPromise: Promise<Awaited<ReturnType<typeof loadStudentsCached>>>
) {
  if (!isSendGridConfigured()) return;

  after(async () => {
    const list = await rosterPromise;
    const st = list.find((s) => s.studentId === studentId);
    if (!st?.parentEmail) return;

    const sendStatus = await resolveSendStatusForParent(
      st.parentEmail,
      st.name,
      type,
      at
    );
    try {
      await appsScriptCall({
        action: "updateLogSendStatus",
        studentId: st.studentId,
        sheetTimestamp: sheetTs,
        sendStatus,
      });
    } catch {
      /* 旧 GAS（updateLogSendStatus 未実装）では E列は手動か GAS 再デプロイが必要 */
    }
  });
}

/** 名前選択画面: GAS へ scan だけ（1回）。生徒検索はしない */
async function scanFastPath(
  studentId: string,
  qrValue: string,
  entryType: "入室" | "退室"
) {
  const at = new Date();
  const rosterPromise = loadStudentsCached();

  const scanPayload: Record<string, unknown> = {
    action: "scan",
    qrValue,
    entryType,
  };
  if (isSendGridConfigured()) {
    scanPayload.emailHandledByServer = true;
    scanPayload.sendStatus = "送信済み";
  }

  const data = await appsScriptCall<{
    success?: boolean;
    error?: string;
    studentName?: string;
    type?: string;
    timestamp?: string;
    sheetTimestamp?: string;
  }>(scanPayload);

  if (data.success === false) {
    return NextResponse.json(data);
  }

  const sheetTs =
    typeof data.sheetTimestamp === "string"
      ? data.sheetTimestamp
      : formatTimestampTokyo(at);

  scheduleParentEmail(studentId, entryType, at, sheetTs, rosterPromise);
  return NextResponse.json(data);
}

async function scanViaAppsScript(
  studentId: string,
  qrValue: string,
  entryExplicit: "入室" | "退室" | null
) {
  if (qrValue && entryExplicit && studentId) {
    return scanFastPath(studentId, qrValue, entryExplicit);
  }

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
  const rosterPromise = loadStudentsCached();

  const body: Record<string, unknown> = {
    action: "scan",
    entryType: type,
  };
  if (isSendGridConfigured()) {
    body.emailHandledByServer = true;
    body.sendStatus = "送信済み";
  }
  if (st.qrValue) body.qrValue = st.qrValue;
  else body.studentId = st.studentId;

  const data = await appsScriptCall<{
    success?: boolean;
    error?: string;
    studentName?: string;
    type?: string;
    timestamp?: string;
    sheetTimestamp?: string;
  }>(body);

  if (data.success === false) {
    return NextResponse.json(data);
  }

  const sheetTs =
    typeof data.sheetTimestamp === "string"
      ? data.sheetTimestamp
      : formatTimestampTokyo(at);

  scheduleParentEmail(st.studentId, type, at, sheetTs, rosterPromise);
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
