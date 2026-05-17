# 永田塾 入退室管理アプリ

**スマホ・タブレット**で **学年・名前を選んで** **入室・退室を Google スプレッドシートに記録**し、**保護者へメール通知**する Next.js アプリです。

※ 同じスマホの画面に出たQRを、そのスマホで読むことはできません。日常の運用は **学年・名前の選択** です。生徒用QR（印刷カード）は、別途タブレットで読む想定のマスタ列（D列）として残しています。

## すぐにやること（短い版）

1. リポジトリのフォルダに移動: `cd nagata-juku-checkin`
2. `npm install`
3. **GoogleのJSON鍵が作れない場合**は、まず **[apps-script/README.md](./apps-script/README.md)**（鍵なし）
4. それ以外は **[SETUP.md](./SETUP.md)** を上から順に実行
5. `npm run check-env` → 問題なければ `npm run dev`

## 主なURL

| 用途 | パス |
|------|------|
| 入退室画面 | `/` |
| 管理画面 | `/admin`（PIN） |
| スキャンAPI | `POST /api/scan` |
| 設定確認（秘密は返さない） | `GET /api/health` |

## 環境変数

`.env.example` を参照し、同じキーを **`.env.local`**（ローカル）または **Vercel の Environment Variables**（本番）に設定します。

## 技術スタック

Next.js（App Router）、`googleapis`、`@sendgrid/mail`。ホスティング想定は Vercel。

## ライセンス

利用先の方針に合わせてください（未指定）。
