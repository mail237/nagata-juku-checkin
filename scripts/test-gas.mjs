#!/usr/bin/env node
/**
 * Apps Script の action が使えるか確認
 * 使い方: node scripts/test-gas.mjs
 */
import fs from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const envPath = path.join(root, ".env.local");
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const url = env.GOOGLE_APPS_SCRIPT_URL;
const secret = env.APPS_SCRIPT_SECRET;

async function call(action, extra = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret, action, ...extra }),
    redirect: "follow",
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { action, error: text.slice(0, 120) };
  }
  return { action, ...data };
}

const actions = [
  ["getStudent", { studentId: "S0001" }],
  ["getLastLogType", { studentId: "S0001" }],
  ["students", {}],
  ["scan", { studentId: "S0001", entryType: "入室", emailHandledByServer: true, sendStatus: "送信済み" }],
];

console.log("URL:", url);
for (const [action, extra] of actions) {
  const r = await call(action, extra);
  const ok =
    r.ok === true ||
    r.success === true ||
    Array.isArray(r.students) ||
    r.student;
  console.log(action, ok ? "OK" : "NG", r.error || "");
}
