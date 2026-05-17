/** 入室・退室成功時のランダムメッセージ（遊び心用） */

const ENTRY_LINES = [
  (name: string) => `${name}さん、いらっしゃい！今日もいっしょにがんばろう 📚`,
  (name: string) => `${name}さん、入室！いい一日になりますように ✨`,
  (name: string) => `ようこそ、${name}さん！準備はバッチリ 🎒`,
  (name: string) => `${name}さん、来てくれてうれしい！集中モード ON 🧠`,
  (name: string) => `${name}さん、入室記録しました。がんばってね 💪`,
  (name: string) => `${name}さん、今日もよろしく！一歩ずついこう 🌱`,
];

const EXIT_LINES = [
  (name: string) => `${name}さん、おつかれさま！気をつけて帰ってね 👋`,
  (name: string) => `${name}さん、退室！今日もありがとう 🌟`,
  (name: string) => `${name}さん、お疲れ様でした。またね 🏠`,
  (name: string) => `${name}さん、帰り道ゆっくりね。また来てね 🚶`,
  (name: string) => `${name}さん、退室記録 OK！ゆっくり休んでね 😊`,
  (name: string) => `${name}さん、今日もえらかった！また明日 📖`,
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function pickCheckinMessage(type: "入室" | "退室", studentName: string): string {
  const lines = type === "入室" ? ENTRY_LINES : EXIT_LINES;
  return pick(lines)(studentName);
}

export function checkinEmoji(type: "入室" | "退室"): string {
  return type === "入室" ? "🎉" : "👋";
}

/** 日本時間の 0:00 からの経過分 */
function tokyoMinutesSinceMidnight(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const minute = Number(parts.find((p) => p.type === "minute")?.value);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 12 * 60;
  return hour * 60 + minute;
}

/** ヘッダー用の時間帯あいさつ（日本時間） */
export function timeGreetingTokyo(): string {
  const m = tokyoMinutesSinceMidnight();
  const at = (h: number, min = 0) => h * 60 + min;

  if (m >= at(5) && m < at(11)) return "おはよう！今日もよろしくね ☀️";
  if (m >= at(11) && m < at(17)) return "こんにちは！いい学習時間を 🌤️";
  if (m >= at(17) && m < at(18, 30)) return "おつかれさま！夕方もがんばろう 🌆";
  if (m >= at(18, 30) && m < at(19, 30)) return "おつかれさま！そろそろ夜の部だね 🌇";
  if (m >= at(19, 30) && m < at(22)) return "こんばんは！おつかれさま 🌙";
  return "夜おそいね。無理しないでね 🌠";
}
