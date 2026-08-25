import { sendParentEmail } from "@/lib/send-parent-email";
import { isSendGridConfigured } from "@/lib/sendgrid-config";

function parseParentEmails(raw: string): string[] {
  return raw
    .split(/[,，、;\s]+/g)
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

  // 1件でも届けば「送信済み」。全員失敗のときだけ「エラー」
  let okCount = 0;
  for (const to of toList) {
    try {
      await sendParentEmail({ to, studentName, type, at });
      okCount += 1;
    } catch (e) {
      console.error("SendGrid:", to, e);
    }
  }
  return okCount > 0 ? "送信済み" : "エラー";
}
