#!/bin/bash
# 永田塾スプレッドシート用 Code.gs をクリップボードにコピーし、表を開く
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GAS_FILE="$ROOT/apps-script/Code.gs"
SHEET_URL="https://docs.google.com/spreadsheets/d/1ZUflh0k7gkZa2_1sb-uD0PhQ9znooItHQTgCKQC4fdc/edit"

if [[ ! -f "$GAS_FILE" ]]; then
  echo "Code.gs が見つかりません: $GAS_FILE"
  exit 1
fi

pbcopy < "$GAS_FILE"
echo "✓ Code.gs をクリップボードにコピーしました（$(wc -l < "$GAS_FILE" | tr -d ' ') 行）"
open "$SHEET_URL"
echo ""
echo "【あと30秒だけ】塾アカウントでログインしたブラウザで:"
echo "  1. 拡張機能 → Apps Script"
echo "  2. コード.gs を全選択 → 貼り付け（Cmd+V）"
echo "  3. 保存 → デプロイ → デプロイを管理 → 鉛筆 → 新バージョン → デプロイ"
echo ""
echo "※ CONFIG の SENDGRID_* は空のままでOK（メールは Google の MailApp / 塾Gmail から送ります）"
