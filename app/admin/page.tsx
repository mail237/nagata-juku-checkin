"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Student = {
  rowIndex: number;
  studentId: string;
  name: string;
  grade: string;
  parentEmail: string;
  qrValue: string;
  note: string;
};

type Log = {
  timestamp: string;
  studentId: string;
  studentName: string;
  type: string;
  sendStatus: string;
};

export default function AdminPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Student | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [sRes, lRes] = await Promise.all([
        fetch("/api/admin/students", { cache: "no-store" }),
        fetch("/api/admin/logs", { cache: "no-store" }),
      ]);
      if (!sRes.ok) {
        const j = await sRes.json().catch(() => ({}));
        throw new Error(j.error ?? "生徒データの取得に失敗しました");
      }
      if (!lRes.ok) {
        const j = await lRes.json().catch(() => ({}));
        throw new Error(j.error ?? "ログの取得に失敗しました");
      }
      const sJson = await sRes.json();
      const lJson = await lRes.json();
      setStudents(
        (sJson.students ?? []).map((s: Student) => ({
          ...s,
          grade: typeof s.grade === "string" ? s.grade : "",
        }))
      );
      setLogs(lJson.logs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function saveStudent() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/students", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "保存に失敗しました");
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <div className="min-h-full bg-slate-50">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">永田塾 管理</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void load()}
            className="text-sm text-slate-600 underline-offset-4 hover:underline"
          >
            再読込
          </button>
          <Link
            href="/"
            className="text-sm text-slate-600 underline-offset-4 hover:underline"
          >
            スキャン画面
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            ログアウト
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 p-4 pb-16">
        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}

        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-800">
            生徒マスタ（スプレッドシート連携）
          </h2>
          {loading ? (
            <p className="text-sm text-slate-500">読み込み中…</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">行</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">生徒ID</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">学年</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">氏名</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">保護者メール</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">QR値</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">備考</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.rowIndex} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 text-slate-500">{s.rowIndex}</td>
                      <td className="px-3 py-2">{s.studentId}</td>
                      <td className="px-3 py-2 text-slate-700">{s.grade || "—"}</td>
                      <td className="px-3 py-2 font-medium">{s.name}</td>
                      <td className="max-w-[12rem] truncate px-3 py-2 text-slate-600">
                        {s.parentEmail}
                      </td>
                      <td className="max-w-[10rem] truncate px-3 py-2 font-mono text-xs text-slate-600">
                        {s.qrValue}
                      </td>
                      <td className="max-w-[8rem] truncate px-3 py-2 text-slate-500">
                        {s.note}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-slate-700 underline-offset-2 hover:underline"
                          onClick={() => setEditing({ ...s })}
                        >
                          編集
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-800">
            当日の入退室ログ
          </h2>
          {loading ? (
            <p className="text-sm text-slate-500">読み込み中…</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-slate-500">本日のログはまだありません</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">時刻</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">生徒ID</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">氏名</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">種別</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">送信</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={`${log.timestamp}-${i}`} className="border-b border-slate-100 last:border-0">
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                        {log.timestamp}
                      </td>
                      <td className="px-3 py-2">{log.studentId}</td>
                      <td className="px-3 py-2">{log.studentName}</td>
                      <td className="px-3 py-2">{log.type}</td>
                      <td className="px-3 py-2">{log.sendStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {editing && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">生徒を編集</h3>
            <p className="mt-1 text-xs text-slate-500">スプレッドシート行 {editing.rowIndex}</p>
            <div className="mt-4 flex flex-col gap-3">
              <label className="text-sm">
                <span className="font-medium text-slate-700">生徒ID</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={editing.studentId}
                  onChange={(e) =>
                    setEditing({ ...editing, studentId: e.target.value })
                  }
                />
              </label>
              <label className="text-sm">
                <span className="font-medium text-slate-700">学年（F列）</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="例: 中2"
                  value={editing.grade}
                  onChange={(e) => setEditing({ ...editing, grade: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="font-medium text-slate-700">氏名</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <span className="font-medium text-slate-700">保護者メール</span>
                <input
                  type="email"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={editing.parentEmail}
                  onChange={(e) =>
                    setEditing({ ...editing, parentEmail: e.target.value })
                  }
                />
              </label>
              <label className="text-sm">
                <span className="font-medium text-slate-700">QRコード値</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                  value={editing.qrValue}
                  onChange={(e) =>
                    setEditing({ ...editing, qrValue: e.target.value })
                  }
                />
              </label>
              <label className="text-sm">
                <span className="font-medium text-slate-700">備考</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={editing.note}
                  onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
                onClick={() => setEditing(null)}
                disabled={saving}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
                onClick={() => void saveStudent()}
                disabled={saving}
              >
                {saving ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
