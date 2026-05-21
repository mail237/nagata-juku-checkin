import { unstable_cache, revalidateTag } from "next/cache";
import { appsScriptCall } from "@/lib/apps-script-client";

export type AppsScriptStudent = {
  studentId: string;
  name: string;
  parentEmail: string;
  grade: string;
  qrValue: string;
};

const CACHE_TAG = "gas-students";

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

async function fetchStudentsFromGas(): Promise<AppsScriptStudent[]> {
  const data = await appsScriptCall<{
    students?: Array<AppsScriptStudent & { qrValue?: string }>;
  }>({ action: "students" });

  return (data.students ?? [])
    .map(normalizeStudent)
    .filter((s) => s.studentId && s.name);
}

/** Vercel 全体で60秒共有（生徒マスタ） */
export async function loadStudentsCached(): Promise<AppsScriptStudent[]> {
  return unstable_cache(fetchStudentsFromGas, ["nagata-juku-gas-students"], {
    revalidate: 60,
    tags: [CACHE_TAG],
  })();
}

export function invalidateStudentsCache(): void {
  revalidateTag(CACHE_TAG, "max");
}

export async function findStudentViaGas(
  studentId: string,
  qrValue: string
): Promise<AppsScriptStudent | null> {
  const list = await loadStudentsCached();
  if (studentId) {
    const id = studentId.trim();
    return list.find((s) => s.studentId === id) ?? null;
  }
  const qr = qrValue.trim();
  return list.find((s) => s.qrValue === qr) ?? null;
}
