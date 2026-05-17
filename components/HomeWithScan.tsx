"use client";

import Link from "next/link";
import { useState } from "react";
import { PickStudentCheckin } from "@/components/PickStudentCheckin";
import { timeGreetingTokyo } from "@/lib/checkin-messages";

export function HomeWithScan() {
  const [greeting] = useState(() => timeGreetingTokyo());

  return (
    <div className="flex min-h-full min-w-0 w-full flex-1 flex-col">
      <header className="shrink-0 border-b border-indigo-950/15 bg-gradient-to-r from-indigo-950 via-indigo-900 to-indigo-950 text-white shadow-md shadow-indigo-950/20">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-5 sm:px-8 sm:py-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200/95 sm:text-sm">
              Nagata Juku
            </p>
            <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">永田塾 入退室</h1>
            <p className="mt-1 truncate text-sm font-medium text-indigo-100/90 sm:text-base">
              {greeting}
            </p>
          </div>
          <Link
            href="/admin"
            className="shrink-0 rounded-full border-2 border-white/30 bg-white/10 px-5 py-2.5 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 sm:px-6 sm:py-3 sm:text-lg"
          >
            管理画面
          </Link>
        </div>
      </header>

      <main className="mx-auto flex min-w-0 w-full max-w-3xl flex-1 flex-col items-stretch gap-8 overflow-y-auto px-4 py-8 pb-20 sm:px-8 sm:py-12">
        <PickStudentCheckin />
      </main>
    </div>
  );
}
