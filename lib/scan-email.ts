import { sendParentEmail } from "@/lib/send-parent-email";
import { isSendGridConfigured } from "@/lib/sendgrid-config";

function parseParentEmails(raw: string): string[] {
  return raw
    .split(/[,\s;]+/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s.includes("@"));
}

export async function resolveSendStatusForParent(
  parentEmail: string,
  studentName: string,
  type: "入室" | "退室",
  at: Date
): Promise<"送信済み" | "エラー"> {
  const toList = parseParentEmails(parentEmail);
  if (toList.length === 0) return "エラー";
  if (!isSendGridConfigured()) return "エラー";
  try {
    await sendParentEmail({ to: toList, studentName, type, at });
    return "送信済み";
  } catch (e) {
    console.error("SendGrid:", e);
    return "エラー";
  }
}
