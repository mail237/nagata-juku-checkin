import { sendParentEmail } from "@/lib/send-parent-email";
import { isSendGridConfigured } from "@/lib/sendgrid-config";

export async function resolveSendStatusForParent(
  parentEmail: string,
  studentName: string,
  type: "入室" | "退室",
  at: Date
): Promise<"送信済み" | "エラー"> {
  const to = parentEmail.trim();
  if (!to) return "エラー";
  if (!isSendGridConfigured()) return "エラー";
  try {
    await sendParentEmail({ to, studentName, type, at });
    return "送信済み";
  } catch (e) {
    console.error("SendGrid:", e);
    return "エラー";
  }
}
