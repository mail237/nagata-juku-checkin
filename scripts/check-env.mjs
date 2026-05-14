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

const CORE_KEYS = ["SENDGRID_API_KEY", "SENDGRID_FROM_EMAIL", "ADMIN_PIN"];

const SA_KEYS = [
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "GOOGLE_SPREADSHEET_ID",
];

const APPS_KEYS = ["GOOGLE_APPS_SCRIPT_URL", "APPS_SCRIPT_SECRET"];

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

  console.log("【共通】");
  let ok = true;
  for (const key of CORE_KEYS) {
    const is = filled(merged, key);
    if (!is) ok = false;
    console.log(`  ${is ? "✓" : "✗"} ${key}`);
  }

  console.log("\n【スプレッドシート接続（どちらか一方）】");
  console.log("  A) サービスアカウント（JSON鍵）");
  for (const key of SA_KEYS) {
    const is = filled(merged, key);
    console.log(`    ${is ? "✓" : "○"} ${key}`);
  }
  console.log("  B) Apps Script 中継（鍵不要）");
  for (const key of APPS_KEYS) {
    const is = filled(merged, key);
    console.log(`    ${is ? "✓" : "○"} ${key}`);
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
