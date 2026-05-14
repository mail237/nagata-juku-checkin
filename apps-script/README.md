# サービスアカウント鍵なしで動かす（Google Apps Script）

Google Cloud で **JSON鍵の作成が禁止**されているときでも、この方法なら **スプレッドシートに読み書き**できます。

## あなたがやること（順番どおり）

### 1) スクリプトを開く

1. **入退室で使うスプレッドシート**を開く  
2. メニュー **「拡張機能」→「Apps Script」**

### 2) コードを貼る

1. 左の `コード.gs` の中身を **ぜんぶ消す**  
2. このフォルダの **`Code.gs`** の中身を **そのままコピーして貼る**

### 3) 上の `CONFIG` を編集する

`Code.gs` の先頭にある `CONFIG` を、次のように直します。

| 項目 | 内容 |
|------|------|
| `DEPLOY_SECRET` | **長めのランダム文字列**（例：英数字20文字以上）。後で `.env.local` の `APPS_SCRIPT_SECRET` と **同じ**にします |
| `SPREADSHEET_ID` | スプレッドシートURLの `/d/` と `/edit/` のあいだの文字列 |
| `SENDGRID_API_KEY` | SendGridのAPIキー（`SG.` で始まるもの） |
| `SENDGRID_FROM` | SendGridで認証済みの送信元メールアドレス |

※ SendGridを空のままにすると、メールは送れず **送信ステータスはエラー**になります（ログ自体は残ります）。

### 4) 保存する

Apps Script 左上の **ディスク（保存）** を押します。

### 5) ウェブアプリとしてデプロイする

1. 右上の **「デプロイ」** → **「新しいデプロイ」**  
2. 歯車アイコンの **「種類の選択」** → **「ウェブアプリ」**  
3. 設定はだいたい次のとおり  
   - **次のユーザーとして実行**: **自分**  
   - **アクセスできるユーザー**: **全員**（タブレットやVercelから呼ぶため。組織制約で無理なら管理者に相談）  
4. **デプロイ** → 初回は承認画面が出たら進める  
5. **ウェブアプリのURL**（`https://script.google.com/macros/s/.../exec`）をコピーする

### 6) Next.js の `.env.local` に書く

プロジェクトの `.env.local` に、次を追加します（**URLとSECRETはあなたの値**）。

```env
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/xxxx/exec
APPS_SCRIPT_SECRET=（CONFIGのDEPLOY_SECRETと同じ文字列）
```

### 7) 動作確認

```bash
npm run dev
```

ブラウザでスキャンし、スプレッドシートの **入退室ログ** に行が増えるか確認します。

## この方式で不要になるもの

`.env.local` に **`GOOGLE_APPS_SCRIPT_URL` と `APPS_SCRIPT_SECRET` を入れているあいだ**、Next.js は **Googleサービスアカウント（`GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` / `GOOGLE_SPREADSHEET_ID`）を使いません**。

SendGrid と `ADMIN_PIN` は、これまでどおり必要です。
