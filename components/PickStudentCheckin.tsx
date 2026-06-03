"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckinCelebration } from "@/components/CheckinCelebration";
import { pickCheckinMessage } from "@/lib/checkin-messages";

type PickStudent = { studentId: string; name: string; grade: string; qrValue?: string };

const UNSET = "（未設定）";

const fieldClass =
  "mt-3 w-full min-h-[3.25rem] rounded-2xl border-2 border-slate-200/90 bg-slate-50/80 px-5 py-4 text-lg leading-snug text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 sm:text-xl sm:min-h-[3.5rem]";

function sortGradesJa(a: string, b: string): number {
  if (a === UNSET) return 1;
  if (b === UNSET) return -1;
  return a.localeCompare(b, "ja");
}

export function PickStudentCheckin() {
  const [students, setStudents] = useState<PickStudent[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [listVersion, setListVersion] = useState(0);
  const [grade, setGrade] = useState("");
  const [studentId, setStudentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(
    null
  );
  const [celebration, setCelebration] = useState<{
    type: "入室" | "退室";
    message: string;
  } | null>(null);

  const showToast = useCallback((message: string, variant: "success" | "error") => {
    setToast({ message, variant });
    window.setTimeout(() => setToast(null), 5000);
  }, []);

  /** 記録後は次の生徒用に学年・名前をクリア */
  const resetForm = useCallback(() => {
    setGrade("");
    setStudentId("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`/api/checkout/students?t=${Date.now()}`, {
          cache: "no-store",
          headers: { Pragma: "no-cache" },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "一覧の取得に失敗しました");
        const list = (data.students ?? []) as PickStudent[];
        if (!cancelled) setStudents(list.filter((s) => s.studentId && s.name));
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "読み込みに失敗しました");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [listVersion]);

  const grades = useMemo(() => {
    const g = new Set(students.map((s) => s.grade || UNSET));
    return [...g].sort(sortGradesJa);
  }, [students]);

  const inGrade = useMemo(() => {
    if (!grade) return [];
    return students
      .filter((s) => (s.grade || UNSET) === grade)
      .sort((a, b) => a.name.localeCompare(b.name, "ja"));
  }, [students, grade]);

  const submit = useCallback(
    async (entryType: "入室" | "退室") => {
      if (!studentId.trim() || busy) return;
      const picked = students.find((s) => s.studentId === studentId.trim());
      const qr = picked?.qrValue?.trim() ?? "";
      if (!qr) {
        showToast("QR値が未設定です。生徒マスタのD列を確認してください。", "error");
        return;
      }

      setBusy(true);
      setCelebration({
        type: entryType,
        message: pickCheckinMessage(entryType, picked?.name ?? ""),
      });

      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: studentId.trim(),
            entryType,
            qrValue: qr,
          }),
        });
        const data = await res.json();
        if (data.success && (data.type === "入室" || data.type === "退室")) {
          const name = String(data.studentName ?? picked?.name ?? "");
          resetForm();
          setCelebration({
            type: data.type,
            message: pickCheckinMessage(data.type, name),
          });
        } else if (data.success) {
          setCelebration(null);
          resetForm();
          showToast("記録しました", "success");
        } else {
          setCelebration(null);
          showToast(data.error ?? "エラーが発生しました", "error");
        }
      } catch {
        setCelebration(null);
        showToast("通信エラーが発生しました", "error");
      } finally {
        setBusy(false);
      }
    },
    [busy, studentId, students, showToast, resetForm]
  );

  return (
    <section className="mx-auto w-full min-w-0 max-w-2xl overflow-hidden rounded-3xl border-2 border-slate-200/80 bg-white shadow-xl shadow-slate-300/30 ring-1 ring-slate-900/[0.04] sm:max-w-3xl">
      <div className="border-b border-indigo-100/80 bg-gradient-to-br from-indigo-50 via-white to-violet-50/50 px-6 py-7 sm:px-10 sm:py-9">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">学年・名前で記録</h2>
        <p className="mt-3 text-base leading-relaxed text-slate-600 sm:text-lg">
          <strong className="font-medium text-slate-800">スマホ・タブレットどちらでも</strong>
          この画面から記録できます。QRコードの読み取りは不要です（同じ端末の画面を読むことはできないため）。
        </p>
        <p className="mt-3 text-base leading-relaxed text-slate-600 sm:text-lg">
          学年はスプレッドシート「<strong className="font-medium text-slate-800">生徒マスタ</strong>」の{" "}
          <strong className="font-medium text-slate-800">F列</strong>です。F列を編集したあとは下の
          <strong className="font-medium text-slate-800">一覧を再読み込み</strong>を押すと反映されます。
        </p>
        <p className="mt-2 text-base leading-relaxed text-slate-600 sm:text-lg">
          <span className="text-slate-500">F列が空</span>の生徒は「{UNSET}」にまとまります。
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-xl border-2 border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-900 shadow-sm transition hover:border-indigo-400 hover:bg-indigo-50/80 sm:text-base"
            onClick={() => {
              setGrade("");
              setStudentId("");
              setListVersion((v) => v + 1);
            }}
            disabled={loading}
          >
            {loading ? "読み込み中…" : "一覧を再読み込み"}
          </button>
        </div>
      </div>

      <div className="px-6 py-8 sm:px-10 sm:py-10">
        {loading && (
          <div className="flex items-center gap-4 text-lg text-slate-600 sm:text-xl">
            <span
              className="inline-block size-7 shrink-0 animate-spin rounded-full border-[3px] border-indigo-200 border-t-indigo-600"
              aria-hidden
            />
            一覧を読み込み中…
          </div>
        )}
        {loadError && (
          <p
            className="rounded-2xl border-2 border-red-200 bg-red-50 px-5 py-4 text-base text-red-800 sm:text-lg"
            role="alert"
          >
            {loadError}
          </p>
        )}
        {!loading && !loadError && students.length === 0 && (
          <p className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-5 py-4 text-base text-amber-950 sm:text-lg">
            生徒マスタにデータがありません。
          </p>
        )}
        {!loading && !loadError && students.length > 0 && (
          <div className="flex flex-col gap-7 sm:gap-8">
            <label className="block text-lg sm:text-xl">
              <span className="font-semibold text-slate-800">学年</span>
              <select
                className={fieldClass}
                value={grade}
                onChange={(e) => {
                  setGrade(e.target.value);
                  setStudentId("");
                }}
              >
                <option value="">選択してください</option>
                {grades.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-lg sm:text-xl">
              <span className="font-semibold text-slate-800">名前</span>
              <select
                className={fieldClass}
                value={studentId}
                disabled={!grade}
                onChange={(e) => setStudentId(e.target.value)}
              >
                <option value="">{grade ? "名前を選択" : "先に学年を選んでください"}</option>
                {inGrade.map((s) => (
                  <option key={s.studentId} value={s.studentId}>
                    {s.name}（{s.grade}）
                  </option>
                ))}
              </select>
            </label>
            <div
              className="rounded-2xl border-2 border-amber-300/90 bg-amber-50 px-4 py-3 text-base leading-relaxed text-amber-950 sm:px-5 sm:text-lg"
              role="note"
            >
              <p className="font-bold text-amber-950">ご注意ください</p>
              <p className="mt-2">
                <strong>入室</strong>と<strong>退室</strong>のボタンを押し間違えないよう、くれぐれもご注意ください。
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
              <button
                type="button"
                onClick={() => void submit("入室")}
                disabled={!studentId || busy}
                className="min-h-[3.75rem] flex-1 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 px-5 py-4 text-lg font-bold text-white shadow-lg shadow-emerald-900/30 transition hover:from-emerald-500 hover:to-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none sm:min-h-[4rem] sm:text-xl"
              >
                {busy ? "処理中…" : "入室 🚪"}
              </button>
              <button
                type="button"
                onClick={() => void submit("退室")}
                disabled={!studentId || busy}
                className="min-h-[3.75rem] flex-1 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-800 px-5 py-4 text-lg font-bold text-white shadow-lg shadow-slate-900/30 transition hover:from-slate-500 hover:to-slate-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none sm:min-h-[4rem] sm:text-xl"
              >
                {busy ? "処理中…" : "退室 👋"}
              </button>
            </div>
          </div>
        )}
      </div>

      {celebration && (
        <CheckinCelebration
          type={celebration.type}
          message={celebration.message}
          onDone={() => setCelebration(null)}
        />
      )}

      {toast && (
        <div
          role="status"
          className={`fixed bottom-8 left-1/2 z-50 max-w-[min(94vw,36rem)] -translate-x-1/2 rounded-2xl border border-white/10 px-6 py-4 text-center text-lg font-semibold shadow-2xl sm:text-xl ${
            toast.variant === "success"
              ? "bg-gradient-to-br from-emerald-600 to-emerald-800 text-white"
              : "bg-gradient-to-br from-red-600 to-red-800 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </section>
  );
}
