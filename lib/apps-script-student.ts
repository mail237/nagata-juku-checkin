import { AppsScriptError, appsScriptCall } from "@/lib/apps-script-client";

export type AppsScriptStudent = {
  studentId: string;
  name: string;
  parentEmail: string;
  grade: string;
  qrValue: string;
};

const STUDENTS_CACHE_TTL_MS = 60_000;
let studentsCache: { at: number; list: AppsScriptStudent[] } | null = null;
let gasSupportsGetStudent: boolean | null = null;

function normalizeStudent(
  s: AppsScriptStudent & { qrValue?: string }
): AppsScriptStudent {
  return {
    studentId: String(s.studentId ?? "").trim(),
    name: String(s.name ?? "").trim(),
    parentEmail: String(s.parentEmail ?? "").trim(),
    grade: String(s.grade ?? "").trim(),
    qrValue: String(s.qrValue ?? "").trim(),
  };
}

/** 生徒マスタ一覧（60秒キャッシュ。入室のたびに全件取得しない） */
export async function loadStudentsCached(): Promise<AppsScriptStudent[]> {
  const now = Date.now();
  if (studentsCache && now - studentsCache.at < STUDENTS_CACHE_TTL_MS) {
    return studentsCache.list;
  }

  const data = await appsScriptCall<{
    students?: Array<AppsScriptStudent & { qrValue?: string }>;
  }>({ action: "students" });

  const list = (data.students ?? [])
    .map(normalizeStudent)
    .filter((s) => s.studentId && s.name);

  studentsCache = { at: now, list };
  return list;
}

export function invalidateStudentsCache(): void {
  studentsCache = null;
}

/** getStudent（1件）→ キャッシュ一覧の順で探す */
export async function findStudentViaGas(
  studentId: string,
  qrValue: string
): Promise<AppsScriptStudent | null> {
  if (gasSupportsGetStudent !== false) {
    try {
      const info = await appsScriptCall<{
        ok?: boolean;
        student?: AppsScriptStudent;
      }>(
        studentId
          ? { action: "getStudent", studentId }
          : { action: "getStudent", qrValue }
      );
      if (info.ok && info.student) {
        gasSupportsGetStudent = true;
        return normalizeStudent(info.student);
      }
    } catch (e) {
      const msg = e instanceof AppsScriptError ? e.message : "";
      if (msg.includes("getStudent")) {
        gasSupportsGetStudent = false;
      } else {
        throw e;
      }
    }
  }

  const list = await loadStudentsCached();
  if (studentId) {
    const id = studentId.trim();
    return list.find((s) => s.studentId === id) ?? null;
  }
  const qr = qrValue.trim();
  return list.find((s) => s.qrValue === qr) ?? null;
}

/** 新 GAS の getLastLogType。無い場合は null */
export async function getLastLogTypeViaGas(
  studentId: string
): Promise<"入室" | "退室" | null> {
  try {
    const res = await appsScriptCall<{ type?: "入室" | "退室" | null }>({
      action: "getLastLogType",
      studentId,
    });
    return res.type ?? null;
  } catch (e) {
    const msg = e instanceof AppsScriptError ? e.message : "";
    if (msg.includes("getLastLogType")) return null;
    throw e;
  }
}
