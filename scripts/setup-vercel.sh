#!/usr/bin/env bash
# Vercel に環境変数を入れて本番デプロイする（Mac ターミナルで1回実行）
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE="vercel-production.env"

echo "=========================================="
echo " 永田塾チェックイン — Vercel セットアップ"
echo "=========================================="
echo ""

if [[ ! -f "$ENV_FILE" ]]; then
  echo "エラー: $ENV_FILE がありません"
  exit 1
fi

if ! command -v vercel >/dev/null 2>&1; then
  echo "Vercel CLI をインストールします..."
  npm install -g vercel
fi

echo "【1/4】Vercel にログイン（ブラウザが開きます）"
echo "      ログインできたらターミナルに戻ってください"
vercel login

echo ""
echo "【2/4】プロジェクト nagata-juku-checkin にリンク"
vercel link --yes --project nagata-juku-checkin 2>/dev/null || vercel link

echo ""
echo "【3/4】環境変数を登録（vercel-production.env から）"
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" =~ ^# ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  echo "  → $key"
  vercel env rm "$key" production -y 2>/dev/null || true
  vercel env rm "$key" preview -y 2>/dev/null || true
  printf '%s' "$val" | vercel env add "$key" production
  printf '%s' "$val" | vercel env add "$key" preview
done < "$ENV_FILE"

echo ""
echo "【4/4】本番デプロイ"
vercel deploy --prod

echo ""
echo "=========================================="
echo " 完了！ 表示された URL をブラウザで開いてください"
echo "=========================================="
