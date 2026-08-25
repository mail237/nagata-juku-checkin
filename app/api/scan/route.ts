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
  opts?: { emailHandledByServer?: boolean; sendStatus?: "送信済み" | "エラー" }
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    action: "recordEntry",
    entryType: type,
  };
  if (opts?.emailHandledByServer) {
    body.emailHandledByServer = true;
    body.sendStatus = opts.sendStatus ?? "エラー";
  }
  if (st.qrValue) body.qrValue = st.qrValue;
  else body.studentId = st.studentId;
  return body;
}

async function gasRecordEntry<T extends { success?: boolean; error?: string }>(
  st: { qrValue: string; studentId: string },
  type: "入室" | "退室",
  opts?: { emailHandledByServer?: boolean; sendStatus?: "送信済み" | "エラー" }
): Promise<T> {
  try {
    return await appsScriptCall<T>(buildRecordBody(st, type, opts));
  } catch (e) {
    const msg = e instanceof AppsScriptError ? e.message : "";
    if (!msg.includes("recordEntry")) throw e;
    const scanBody: Record<string, unknown> = {
      action: "scan",
      entryType: type,
    };
    if (opts?.emailHandledByServer) {
      scanBody.emailHandledByServer = true;
      scanBody.sendStatus = opts.sendStatus ?? "エラー";
    }
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
  let sendError: string | undefined;
  const useVercelSendGrid = isSendGridConfigured() && Boolean(st.parentEmail.trim());

  if (useVercelSendGrid) {
    const result = await resolveSendStatusForParent(
      st.parentEmail,
      st.name,
      type,
      at
    );
    sendStatus = result.status;
    sendError = result.error;
  } else if (!st.parentEmail.trim()) {
    sendError = "保護者メールが空です";
  }

  const data = await gasRecordEntry<{
    success?: boolean;
    error?: string;
    studentName?: string;
    type?: string;
    timestamp?: string;
    sheetTimestamp?: string;
    sendStatus?: string;
  }>(
    st,
    type,
    useVercelSendGrid
      ? { emailHandledByServer: true, sendStatus }
      : undefined
  );

  if (data.success === false) {
    return NextResponse.json({ ...data, sendStatus, sendError });
  }

  if (!useVercelSendGrid) {
    sendStatus = data.sendStatus === "送信済み" ? "送信済み" : "エラー";
    if (sendStatus === "エラー" && !sendError) {
      sendError = "メール送信に失敗しました（Apps Script / Gmail）";
    }
  }

  const sheetTs =
    typeof data.sheetTimestamp === "string"
      ? data.sheetTimestamp
      : formatTimestampTokyo(at);

  if (useVercelSendGrid && sendStatus === "送信済み") {
    after(async () => {
      try {
        await appsScriptCall({
          action: "updateLogSendStatus",
          studentId: st.studentId,
          sheetTimestamp: sheetTs,
          sendStatus: "送信済み",
        });
      } catch {
        /* 旧 GAS では未対応 */
      }
    });
  }

  void rosterPromise;
  return NextResponse.json({
    ...data,
    sendStatus,
    sendError,
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
        return await scanViaAppsScript(studentId, qrValue, entryExplicit);
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
