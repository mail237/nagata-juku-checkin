import { appsScriptCall } from "@/lib/apps-script-client";
import { isSendGridConfigured } from "@/lib/sendgrid-config";
import { sendParentEmail } from "@/lib/send-parent-email";

type ScanSuccess = {
  success: true;
  studentName: string;
  type: "入室" | "退室";
  timestamp?: string;
  studentId?: string;
  parentEmail?: string;
  sheetTimestamp?: string;
};

/** Apps Script で記録したあと、Vercel 上の SendGrid で保護者メールを送り、ログの E 列を更新 */
export async function sendParentEmailAfterAppsScriptScan(
  data: ScanSuccess,
  fallbackStudentId: string
): Promise<void> {
  if (!isSendGridConfigured()) return;

  const parentEmail = String(data.parentEmail ?? "").trim();
  const sheetTimestamp = String(data.sheetTimestamp ?? "").trim();
  const studentId = String(data.studentId ?? fallbackStudentId).trim();
  if (!parentEmail || !sheetTimestamp || !studentId) return;

  let sendStatus: "送信済み" | "エラー" = "エラー";
  try {
    await sendParentEmail({
      to: parentEmail,
      studentName: data.studentName,
      type: data.type,
      at: data.timestamp ? new Date(data.timestamp) : new Date(),
    });
    sendStatus = "送信済み";
  } catch (e) {
    console.error("SendGrid:", e);
  }

  try {
    await appsScriptCall({
      action: "updateLogSendStatus",
      studentId,
      sheetTimestamp,
      sendStatus,
    });
  } catch (e) {
    console.error("updateLogSendStatus:", e);
  }
}
