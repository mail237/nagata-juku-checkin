# SendGrid 設定（永田塾 入退室）

メール送信は **Vercel の環境変数だけ** で動きます（Apps Script に SendGrid を入れなくてOK）。

## あなたがやること（ここだけ）

### 1. SendGrid でキーと送信元を用意

1. https://sendgrid.com/ でアカウント作成
2. **Settings → API Keys → Create API Key**（権限: Mail Send）
3. **Settings → Sender Authentication → Single Sender Verification**
   - 送信に使うメールアドレスを登録し、確認メールで認証

### 2. Vercel に2つ追加

**nagata-juku-checkin** → **Settings** → **Environment Variables**

| Key | Value |
|-----|--------|
| `SENDGRID_API_KEY` | `SG.xxxxx`（APIキー） |
| `SENDGRID_FROM_EMAIL` | 認証した送信元メール |

→ **Save** → **Deployments** → **Redeploy**

### 3. Apps Script を1回だけ更新

スプレッドシート → **拡張機能 → Apps Script**  
`Code.gs` をリポジトリの最新と同じにして **新バージョンで再デプロイ**  
（メールは Vercel が送るが、ログの「送信済み」更新に新 action が必要）

### 4. テスト

- 生徒マスタ **C列** に届くメールアドレスがある生徒で入室
- 入退室ログ **E列** が `送信済み` になるか
- 保護者メールに届くか（迷惑メールも確認）

## ローカルで試す場合

`.env.local` に同じ2行を追加して `npm run dev` を再起動。
