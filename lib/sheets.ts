import { google } from "googleapis";
import { getPrivateKey, requireEnv } from "./env";

export const SHEET_MASTER = "生徒マスタ";
export const SHEET_LOG = "入退室ログ";

export type StudentRow = {
  rowIndex: number;
  studentId: string;
  name: string;
  parentEmail: string;
  qrValue: string;
  note: string;
  /** 生徒マスタ F列（空のときは ""） */
  grade: string;
};

function getSpreadsheetId(): string {
  return requireEnv("GOOGLE_SPREADSHEET_ID");
}

export async function getSheets() {
  const auth = new google.auth.JWT({
    email: requireEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    key: getPrivateKey(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}

export async function findStudentByQr(qrValue: string): Promise<StudentRow | null> {
  const sheets = await getSheets();
  const spreadsheetId = getSpreadsheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${SHEET_MASTER}'!A2:F`,
  });
  const rows = res.data.values ?? [];
  const trimmed = qrValue.trim();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const qr = (r[3] ?? "").toString().trim();
    if (qr === trimmed) {
      const rowIndex = i + 2;
      return {
        rowIndex,
        studentId: (r[0] ?? "").toString().trim(),
        name: (r[1] ?? "").toString().trim(),
        parentEmail: (r[2] ?? "").toString().trim(),
        qrValue: qr,
        note: (r[4] ?? "").toString().trim(),
        grade: (r[5] ?? "").toString().trim(),
      };
    }
  }
  return null;
}

export async function findStudentByStudentId(
  studentId: string
): Promise<StudentRow | null> {
  const sheets = await getSheets();
  const spreadsheetId = getSpreadsheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${SHEET_MASTER}'!A2:F`,
  });
  const rows = res.data.values ?? [];
  const id = studentId.trim();
  if (!id) return null;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const sid = (r[0] ?? "").toString().trim();
    if (sid === id) {
      const rowIndex = i + 2;
      return {
        rowIndex,
        studentId: sid,
        name: (r[1] ?? "").toString().trim(),
        parentEmail: (r[2] ?? "").toString().trim(),
        qrValue: (r[3] ?? "").toString().trim(),
        note: (r[4] ?? "").toString().trim(),
        grade: (r[5] ?? "").toString().trim(),
      };
    }
  }
  return null;
}

function parseLogTimestamp(cell: string): number {
  const s = cell.trim();
  const m = s.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{1,2}):(\d{1,2})/
  );
  if (!m) return 0;
  const [, y, mo, d, h, mi, se] = m;
  return new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(se)
  ).getTime();
}

export async function getLatestLogTypeForStudent(
  studentId: string
): Promise<"入室" | "退室" | null> {
  const sheets = await getSheets();
  const spreadsheetId = getSpreadsheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${SHEET_LOG}'!A2:F`,
  });
  const rows = res.data.values ?? [];
  let best: { t: number; type: "入室" | "退室" } | null = null;
  for (const r of rows) {
    const sid = (r[1] ?? "").toString().trim();
    if (sid !== studentId) continue;
    const ts = parseLogTimestamp((r[0] ?? "").toString());
    const type = (r[3] ?? "").toString().trim();
    if (type !== "入室" && type !== "退室") continue;
    if (ts === 0) continue;
    if (!best || ts >= best.t) {
      best = { t: ts, type };
    }
  }
  return best?.type ?? null;
}

export function nextEntryType(
  last: "入室" | "退室" | null
): "入室" | "退室" {
  if (last === "入室") return "退室";
  return "入室";
}

/** 明示ボタン用。不正な順序ならエラーメッセージを返す */
export function explicitEntryTypeError(
  last: "入室" | "退室" | null,
  requested: "入室" | "退室"
): string | null {
  if (requested === "入室") {
    if (last === "入室") return "直前の記録が入室のため、退室を押してから入室を記録してください。";
    return null;
  }
  return null;
}

export async function appendLogRow(values: string[]): Promise<void> {
  const sheets = await getSheets();
  const spreadsheetId = getSpreadsheetId();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${SHEET_LOG}'!A:F`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
}

export async function getAllStudents(): Promise<StudentRow[]> {
  const sheets = await getSheets();
  const spreadsheetId = getSpreadsheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${SHEET_MASTER}'!A2:F`,
  });
  const rows = res.data.values ?? [];
  return rows.map((r, i) => {
    const row = Array.isArray(r) ? r : [];
    /** A〜F の 6 列ぶんに揃える（API が行末の空を省略すると列がずれるのを防ぐ） */
    const c = (j: number) => (row[j] ?? "").toString().trim();
    return {
      rowIndex: i + 2,
      studentId: c(0),
      name: c(1),
      parentEmail: c(2),
      qrValue: c(3),
      note: c(4),
      grade: c(5),
    };
  });
}

export async function updateStudentRow(
  rowIndex: number,
  fields: {
    studentId: string;
    name: string;
    parentEmail: string;
    qrValue: string;
    note: string;
    grade: string;
  }
): Promise<void> {
  const sheets = await getSheets();
  const spreadsheetId = getSpreadsheetId();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${SHEET_MASTER}'!A${rowIndex}:F${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          fields.studentId,
          fields.name,
          fields.parentEmail,
          fields.qrValue,
          fields.note,
          fields.grade,
        ],
      ],
    },
  });
}

function todayPrefixTokyo(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export async function getTodayLogs(): Promise<string[][]> {
  const sheets = await getSheets();
  const spreadsheetId = getSpreadsheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${SHEET_LOG}'!A2:F`,
  });
  const rows = res.data.values ?? [];
  const prefix = todayPrefixTokyo();
  return rows.filter((r) => {
    const ts = (r[0] ?? "").toString();
    return ts.startsWith(prefix);
  });
}
