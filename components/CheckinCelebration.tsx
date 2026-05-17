"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { checkinEmoji } from "@/lib/checkin-messages";

const CONFETTI_COLORS = [
  "#34d399",
  "#6366f1",
  "#fbbf24",
  "#f472b6",
  "#38bdf8",
  "#a78bfa",
];

type Props = {
  type: "入室" | "退室";
  message: string;
  onDone: () => void;
};

export function CheckinCelebration({ type, message, onDone }: Props) {
  const [particles] = useState(() =>
    Array.from({ length: 28 }, (_, i) => ({
      id: i,
      left: `${8 + Math.random() * 84}%`,
      delay: `${Math.random() * 0.35}s`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
      rotate: `${Math.random() * 360}deg`,
      size: 6 + Math.floor(Math.random() * 6),
    }))
  );

  useEffect(() => {
    const t = window.setTimeout(onDone, 2400);
    return () => window.clearTimeout(t);
  }, [onDone]);

  const isEntry = type === "入室";

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="status"
      aria-live="polite"
    >
      <div className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px] animate-fade-in" />
      {particles.map((p) => (
        <span
          key={p.id}
          className="confetti-piece absolute top-[18%]"
          style={
            {
              left: p.left,
              width: p.size,
              height: p.size * 1.4,
              backgroundColor: p.color,
              animationDelay: p.delay,
              ["--confetti-rotate" as string]: p.rotate,
            } as CSSProperties
          }
        />
      ))}
      <div
        className={`relative max-w-md rounded-3xl border-4 px-8 py-10 text-center shadow-2xl animate-celebration-pop ${
          isEntry
            ? "border-emerald-300 bg-gradient-to-br from-emerald-50 to-white"
            : "border-slate-300 bg-gradient-to-br from-slate-50 to-white"
        }`}
      >
        <p className="text-6xl sm:text-7xl" aria-hidden>
          {checkinEmoji(type)}
        </p>
        <p
          className={`mt-4 text-2xl font-black tracking-tight sm:text-3xl ${
            isEntry ? "text-emerald-800" : "text-slate-800"
          }`}
        >
          {type}しました！
        </p>
        <p className="mt-4 text-lg font-medium leading-relaxed text-slate-700 sm:text-xl">
          {message}
        </p>
      </div>
    </div>
  );
}
