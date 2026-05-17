/**
 * .env.local の必須キーが埋まっているか確認します（値の中身は表示しません）。
 * 使い方: npm run check-env
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env.local");

/** 常に必須（管理画面ログイン用） */
const REQUIRED_KEYS = ["ADMIN_PIN"];

/** 未設定でもスキャン→スプレッドシート記録は可能。設定すると保護者メール送信が有効 */
const OPTIONAL_SENDGRID = ["SENDGRID_API_KEY", "SENDGRID_FROM_EMAIL"];

const SA_KEYS = [
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "GOOGLE_SPREADSHEET_ID",
];

/** URL はコード内デフォルト。SECRET だけ必須 */
const APPS_KEYS = ["APPS_SCRIPT_SECRET"];
const APPS_OPTIONAL = ["GOOGLE_APPS_SCRIPT_URL"];

function parseEnvFile(content) {
  const out = {};
  let i = 0;
  const lines = content.split(/\r?\n/);
  while (i < lines.length) {
    const raw = lines[i];
    i += 1;
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (!key) continue;
    if (val.startsWith('"')) {
      let buf = val.slice(1);
      while (!buf.endsWith('"') && i < lines.length) {
        buf += "\n" + lines[i];
        i += 1;
      }
      if (buf.endsWith('"')) buf = buf.slice(0, -1);
      val = buf.replace(/\\n/g, "\n").replace(/\\"/g, '"');
    }
    out[key] = val;
  }
  return out;
}

function loadMergedEnv() {
  const base = { ...process.env };
  if (!fs.existsSync(envPath)) {
    return { merged: base, loadedFile: false };
  }
  const parsed = parseEnvFile(fs.readFileSync(envPath, "utf8"));
  return { merged: { ...base, ...parsed }, loadedFile: true };
}

function filled(merged, key) {
  return Boolean(merged[key] && String(merged[key]).trim() !== "");
}

function main() {
  const { merged, loadedFile } = loadMergedEnv();

  console.log("永田塾 入退室アプリ — 環境変数チェック\n");
  if (!loadedFile) {
    console.log("※ .env.local が見つかりません。プロジェクト直下に作成してください。\n");
  } else {
    console.log("※ .env.local を読み込みました。\n");
  }

  const appsOk = APPS_KEYS.every((k) => filled(merged, k));
  const saOk = SA_KEYS.every((k) => filled(merged, k));

  console.log("【共通・必須】");
  let ok = true;
  for (const key of REQUIRED_KEYS) {
    const is = filled(merged, key);
    if (!is) ok = false;
    console.log(`  ${is ? "✓" : "✗"} ${key}`);
  }

  console.log("\n【メール（任意・空なら送信はスキップ／ログは記録されます）】");
  for (const key of OPTIONAL_SENDGRID) {
    const is = filled(merged, key);
    console.log(`  ${is ? "✓" : "△"} ${key}`);
  }

  console.log("\n【スプレッドシート接続（どちらか一方）】");
  console.log("  A) サービスアカウント（JSON鍵）");
  for (const key of SA_KEYS) {
    const is = filled(merged, key);
    console.log(`    ${is ? "✓" : "○"} ${key}`);
  }
  console.log("  B) Apps Script 中継（鍵不要・URLはコード内デフォルト可）");
  for (const key of APPS_KEYS) {
    const is = filled(merged, key);
    if (!is) ok = false;
    console.log(`    ${is ? "✓" : "✗"} ${key}`);
  }
  for (const key of APPS_OPTIONAL) {
    const is = filled(merged, key);
    console.log(`    ${is ? "✓" : "○"} ${key}（任意）`);
  }

  if (!appsOk && !saOk) {
    ok = false;
    console.log(
      "\n  ※ A か B のどちらかを、すべて ✓ にしてください（A と B の同時設定は不要です）。"
    );
  }

  if (merged.GOOGLE_PRIVATE_KEY && !merged.GOOGLE_PRIVATE_KEY.includes("BEGIN")) {
    console.log(
      "\n  注意: GOOGLE_PRIVATE_KEY に PEM の先頭（BEGIN）が見えていません。引用符や改行（\\n）を確認してください。"
    );
  }

  console.log("");
  if (ok && (appsOk || saOk)) {
    console.log(
      "必須項目は揃っています。Apps Script 方式なら `apps-script/README.md` のデプロイも完了させてください。\n"
    );
    process.exit(0);
  } else {
    console.log("不足があります。.env.example と apps-script/README.md を参照してください。\n");
    process.exit(1);
  }
}

main();
