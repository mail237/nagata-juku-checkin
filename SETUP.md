# 永田塾 入退室アプリ — セットアップ手順（順番どおり）

このファイルは **初回セットアップだけ** を、画面のように一歩ずつ書いています。途中で詰まったら、その番号だけ教えてください。

---

## 0. 事前に用意するもの

- Google アカウント（スプレッドシート用）
- SendGrid アカウント（メール送信用）
- このアプリのフォルダでターミナルを開けること

---

## 1. プロジェクトに入る

ターミナルで次を実行します。

```bash
cd /Users/tomohiro/nagata-juku-checkin
```

---

## 2. 依存パッケージを入れる（まだなら）

```bash
npm install
```

---

## 3. Google スプレッドシートを作る

1. [Google スプレッドシート](https://sheets.google.com) で新規ブックを作成します。
2. **1枚目のシート名**を **`生徒マスタ`** に変更します。
3. **1行目**に、次の6列の見出しを入れます（A〜F）。

   | A列 | B列 | C列 | D列 | E列 | F列 |
   |-----|-----|-----|-----|-----|-----|
   | 生徒ID | 生徒氏名 | 保護者メールアドレス | QRコード値 | 備考 | 学年 |

4. **2行目以降**に、テスト用の生徒を1人入れます。例：

   - A2: `S001`
   - B2: `永田 太郎`
   - C2: 実際に届くメールアドレス
   - D2: `nagata-juku-S001`（QRに埋める文字列）
   - E2: 空欄でも可
   - F2: 学年（例: `小1`）。空なら入退室画面では「（未設定）」になります。

5. 画面下の **「＋」** でシートを追加し、**シート名**を **`入退室ログ`** にします。
6. **入退室ログ** の **1行目**に、次の6列の見出しを入れます。

   | A列 | B列 | C列 | D列 | E列 | F列 |
   |-----|-----|-----|-----|-----|-----|
   | タイムスタンプ | 生徒ID | 生徒氏名 | 種別 | 送信ステータス | 学年 |

7. ブラウザのアドレス欄の URL から **スプレッドシートID** を控えます。  
   `https://docs.google.com/spreadsheets/d/【ここがID】/edit` の **【ここがID】** です。

---

## 4. Google Cloud で Sheets API とサービスアカウント

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成（または既存を選択）。
2. メニュー **「APIとサービス」→「ライブラリ」** で **「Google Sheets API」** を検索し、**有効化**します。
3. **「IAMと管理」→「サービスアカウント」** で **サービスアカウントを作成**します。
4. 作成したサービスアカウントを開き、**「キー」タブ →「鍵を追加」→「JSON」** でキーをダウンロードします。
5. ダウンロードした JSON を開き、次の2つをメモします。
   - `client_email` → これが **GOOGLE_SERVICE_ACCOUNT_EMAIL**
   - `private_key` → これが **GOOGLE_PRIVATE_KEY**（改行は `\n` のまま1行で `.env.local` に書くのがおすすめ）
6. 手順3で作った **スプレッドシート** を開き、**共有**に、手順5の **`client_email`** を **編集者** で追加します。

---

## 5. SendGrid

1. [SendGrid](https://sendgrid.com/) で API キーを発行します（Mail Send 権限があれば可）。
2. **送信元メール** `SENDGRID_FROM_EMAIL` は、SendGrid で **Sender Authentication**（ドメインまたは単一送信者）済みのアドレスにします。

---

## 6. `.env.local` を作る

プロジェクト直下（`package.json` と同じ場所）に **`.env.local`** を新規作成し、次を自分の値で埋めます。  
（雛形は `.env.example` をコピーしてもよいです。）

```
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_SPREADSHEET_ID=
ADMIN_PIN=
```

- **GOOGLE_PRIVATE_KEY** は JSON の `private_key` を、そのまま **ダブルクォートで囲み**、改行は `\n` にします。例:  
  `GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"`
- **ADMIN_PIN** は管理画面 `/admin` 用の暗証番号です（数字でも文字列でも可）。

**Google Cloud の鍵が作れない場合**は、サービスアカウントの代わりに **Apps Script 中継**が使えます。手順3のスプレッドシート構成は同じです。詳しくは **`apps-script/README.md`** を開いてください（`GOOGLE_APPS_SCRIPT_URL` と `APPS_SCRIPT_SECRET` を `.env.local` に足します）。

---

## 7. 環境変数が足りているか確認

```bash
npm run check-env
```

すべて ✓ になれば次へ進めます。

---

## 8. ローカルで動かす

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

- **スキャン画面**: トップ `/`
- **管理画面**: `/admin`（PIN入力後）

動作確認用 URL（秘密は出ません）:

- `http://localhost:3000/api/health`  
  `ready: true` なら本番と同じ環境変数が揃っています。

---

## 9. Vercel に載せる（本番・スマホ／タブレット用）

**スマホでの使い方:** トップ画面で **学年 → 名前 → 入室／退室** をタップするだけです。QRの読み取りは不要です。

1. [Vercel](https://vercel.com/) にログインし、**このフォルダの Git リポジトリ**を連携して新規プロジェクトを作ります。
2. プロジェクトの **Settings → Environment Variables** に、手順6と **同じ名前・同じ値** を **Production（と必要なら Preview）** に登録します。
3. **Deploy** します。表示された **https://～** をスマホやタブレットのブラウザで開きます（本番は **HTTPS** 推奨）。

---

## 10. うまくいかないとき

- **記録されない・生徒が見つからない**: 学年・名前で選んだか確認する／F列（学年）が空なら「（未設定）」に入っているか確認する。
- **スマホでQRが読めない**: 同じ端末の画面を読むことはできません。**学年・名前で記録**してください（通常の使い方です）。
- **スプレッドシートエラー**: シート名が **`生徒マスタ`** と **`入退室ログ`** と完全一致か、サービスアカウントに共有しているか確認する。**Apps Script 方式**のときは、コードを直したあと **ウェブアプリの再デプロイ**を忘れていないか確認する（`apps-script/README.md`）。

---

以上で、仕様書の「開発手順」に相当する作業は一通り完了です。
