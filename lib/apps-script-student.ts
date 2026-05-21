import { AppsScriptError, appsScriptCall } from "@/lib/apps-script-client";

export type AppsScriptStudent = {
  studentId: string;
  name: string;
  parentEmail: string;
  grade: string;
  qrValue: string;
};

/** 新 GAS（getStudent）→ 旧 GAS（students 一覧）の順で生徒を探す */
export async function findStudentViaGas(
  studentId: string,
  qrValue: string
): Promise<AppsScriptStudent | null> {
  try {
    const info = await appsScriptCall<{
      ok?: boolean;
      student?: AppsScriptStudent;
    }>(
      studentId
        ? { action: "getStudent", studentId }
        : { action: "getStudent", qrValue }
    );
    if (info.ok && info.student) return normalizeStudent(info.student);
  } catch (e) {
    const msg = e instanceof AppsScriptError ? e.message : "";
    if (!msg.includes("getStudent")) throw e;
  }

  const data = await appsScriptCall<{
    students?: Array<
      AppsScriptStudent & { qrValue?: string }
    >;
  }>({ action: "students" });

  const list = data.students ?? [];
  if (studentId) {
    const id = studentId.trim();
    const hit = list.find((s) => s.studentId === id);
    return hit ? normalizeStudent(hit) : null;
  }
  const qr = qrValue.trim();
  const hit = list.find((s) => String(s.qrValue ?? "").trim() === qr);
  return hit ? normalizeStudent(hit) : null;
}

function normalizeStudent(
  s: AppsScriptStudent & { qrValue?: string }
): AppsScriptStudent {
  return {
    studentId: s.studentId,
    name: s.name,
    parentEmail: s.parentEmail ?? "",
    grade: s.grade ?? "",
    qrValue: String(s.qrValue ?? "").trim(),
  };
}

/** 新 GAS の getLastLogType。無い場合は null（呼び出し側で入室扱いなど） */
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
