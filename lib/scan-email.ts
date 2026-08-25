import { sendParentEmail } from "@/lib/send-parent-email";
import { isSendGridConfigured } from "@/lib/sendgrid-config";

function parseParentEmails(raw: string): string[] {
  return raw
    .split(/[,，、;\s]+/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s.includes("@"));
}

export type ParentSendResult = {
  status: "送信済み" | "エラー";
  error?: string;
  sentTo?: number;
};

export async function resolveSendStatusForParent(
  parentEmail: string,
  studentName: string,
  type: "入室" | "退室",
  at: Date
): Promise<ParentSendResult> {
  const toList = parseParentEmails(parentEmail);
  if (toList.length === 0) {
    return { status: "エラー", error: "保護者メールが空です" };
  }
  if (!isSendGridConfigured()) {
    return { status: "エラー", error: "SendGrid 環境変数が未設定です" };
  }

  let okCount = 0;
  let lastError = "";
  for (const to of toList) {
    try {
      await sendParentEmail({ to, studentName, type, at });
      okCount += 1;
    } catch (e) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? JSON.stringify(
              (e as { response?: { body?: unknown } }).response?.body ?? e
            ).slice(0, 400)
          : e instanceof Error
            ? e.message
            : String(e);
      console.error("SendGrid:", to, msg);
      lastError = msg;
    }
  }
  if (okCount > 0) return { status: "送信済み", sentTo: okCount };
  return { status: "エラー", error: lastError || "SendGrid送信に失敗しました", sentTo: 0 };
}
