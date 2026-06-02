import sgMail from "@sendgrid/mail";
import { requireEnv } from "./env";
import { formatTimestampTokyo } from "./time";

export async function sendParentEmail(params: {
  to: string | string[];
  studentName: string;
  type: "入室" | "退室";
  at: Date;
}): Promise<void> {
  const apiKey = requireEnv("SENDGRID_API_KEY");
  const from = requireEnv("SENDGRID_FROM_EMAIL");
  sgMail.setApiKey(apiKey);

  const { studentName, type, at } = params;
  const timeStr = formatTimestampTokyo(at);

  if (type === "入室") {
    await sgMail.send({
      to: params.to,
      from: { email: from, name: "永田塾" },
      subject: `【永田塾】${studentName}さんが入室しました`,
      text: `${studentName}さんが永田塾に入室しました。\n\n入室時刻：${timeStr}\n\n永田塾`,
    });
    return;
  }

  await sgMail.send({
    to: params.to,
    from: { email: from, name: "永田塾" },
    subject: `【永田塾】${studentName}さんが退室しました`,
    text: `${studentName}さんが永田塾を退室しました。\n\n退室時刻：${timeStr}\n\n永田塾`,
  });
}
