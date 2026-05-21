/**
 * 永田塾 入退室 — Google Apps Script（スプレッドシートに紐づけてデプロイ）
 *
 * 【最初にだけ】下の CONFIG をあなたの値に書き換えてください。
 * 【生徒マスタ】A生徒ID B氏名 C保護者メール DQR値 E備考 F学年（空は名前選択画面で「（未設定）」）
 * 【入退室ログ】Aタイムスタンプ B生徒ID C生徒氏名 D種別 E送信ステータス F学年（記録時にマスタのFを自動で書き込む）
 * スクリプトをスプレッドシートに紐づけた「コンテナバインド」のときは、SPREADSHEET_ID が空でも親ブックを開きます。
 * その後：拡張機能 → Apps Script → 貼り付け → デプロイ → 新しいデプロイ
 *   → 種類「ウェブアプリ」→ 次のユーザーとして実行「自分」→ アクセスできるユーザー「全員」
 * → デプロイ → ウェブアプリの URL をコピーして .env.local の GOOGLE_APPS_SCRIPT_URL に貼る
 *
 * Next.js 側の .env.local に同じ APPS_SCRIPT_SECRET を設定してください。
 */

var CONFIG = {
  /** このスクリプトと Next.js の APPS_SCRIPT_SECRET を同じにする（長めのランダム文字列推奨） */
  DEPLOY_SECRET: "Monntitti0818Monntitti",

  /** スプレッドシートID（URLの /d/ と /edit の間）。コンテナバインドなら空文字でも可 */
  SPREADSHEET_ID: "1ObfpbEarx-EaZBG8-XTu2poAASt2EE_5Itybyq2-pBk",

  /** SendGrid（メール）。空にするとメール送信をスキップし送信ステータスはエラー扱い */
  SENDGRID_API_KEY: "",
  SENDGRID_FROM: "",
};

var SHEET_MASTER = "生徒マスタ";
var SHEET_LOG = "入退室ログ";

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function err_(message, status) {
  return jsonOut_({ ok: false, error: message, httpStatus: status || 400 });
}

function assertSecret_(body) {
  if (!body || body.secret !== CONFIG.DEPLOY_SECRET) {
    return "unauthorized";
  }
  return "";
}

function openSheets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    var id = String(CONFIG.SPREADSHEET_ID || "").trim();
    if (!id) {
      throw new Error(
        "スプレッドシートを開けません。スクリプトを表計算に紐づけるか、CONFIG.SPREADSHEET_ID を設定してください。"
      );
    }
    ss = SpreadsheetApp.openById(id);
  }
  var master = ss.getSheetByName(SHEET_MASTER);
  var log = ss.getSheetByName(SHEET_LOG);
  if (!master || !log) {
    throw new Error("シートが見つかりません（生徒マスタ / 入退室ログ）");
  }
  return { ss: ss, master: master, log: log };
}

function formatTokyo_(date) {
  return Utilities.formatDate(date, "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
}

function formatIsoTokyo_(date) {
  return Utilities.formatDate(date, "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ss");
}

function todayPrefixTokyo_() {
  return Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");
}

function parseLogTs_(cell) {
  var s = String(cell || "").trim();
  var m = s.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{1,2}):(\d{1,2})/
  );
  if (!m) return 0;
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6])
  ).getTime();
}

/** A〜F の 6 列に揃える（getValues で列が欠ける場合の保険） */
function rowCellsAF_(r) {
  var row = r || [];
  var out = [];
  for (var j = 0; j < 6; j++) {
    out.push(j < row.length ? row[j] : "");
  }
  return out;
}

/** 生徒マスタ列: A生徒ID B氏名 C保護者メール DQR値 E備考 F学年 */
function rowToStudent_(r, rowIndex) {
  return {
    rowIndex: rowIndex,
    studentId: String(r[0] || "").trim(),
    name: String(r[1] || "").trim(),
    parentEmail: String(r[2] || "").trim(),
    qrValue: String(r[3] || "").trim(),
    note: String(r[4] || "").trim(),
    grade: String(r[5] || "").trim(),
  };
}

function findStudentByQr_(master, qrValue) {
  var trimmed = String(qrValue || "").trim();
  if (!trimmed) return null;
  var values = master.getRange("A2:F").getValues();
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    var qr = String(r[3] || "").trim();
    if (qr === trimmed) return rowToStudent_(rowCellsAF_(r), i + 2);
  }
  return null;
}

function findStudentByStudentId_(master, studentId) {
  var id = String(studentId || "").trim();
  if (!id) return null;
  var values = master.getRange("A2:F").getValues();
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (String(r[0] || "").trim() === id) return rowToStudent_(rowCellsAF_(r), i + 2);
  }
  return null;
}

function getLatestLogType_(log, studentId) {
  var values = log.getRange("A2:F").getValues();
  var best = null;
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    var sid = String(r[1] || "").trim();
    if (sid !== studentId) continue;
    var ts = parseLogTs_(r[0]);
    var type = String(r[3] || "").trim();
    if (type !== "入室" && type !== "退室") continue;
    if (ts === 0) continue;
    if (!best || ts >= best.t) best = { t: ts, type: type };
  }
  return best ? best.type : null;
}

function nextEntryType_(last) {
  if (last === "入室") return "退室";
  return "入室";
}

function sendGrid_(to, subject, body) {
  var key = String(CONFIG.SENDGRID_API_KEY || "").trim();
  var from = String(CONFIG.SENDGRID_FROM || "").trim();
  if (!key || !from) return false;
  var payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: from, name: "永田塾" },
    subject: subject,
    content: [{ type: "text/plain", value: body }],
  };
  var res = UrlFetchApp.fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + key },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  return res.getResponseCode() >= 200 && res.getResponseCode() < 300;
}

function handleScan_(body) {
  var qrValue = String(body.qrValue || "").trim();
  var studentId = String(body.studentId || "").trim();
  if (!qrValue && !studentId) {
    return jsonOut_({
      success: false,
      error: "QRの値か生徒IDのどちらかが必要です",
    });
  }
  var sh = openSheets_();
  var st = studentId
    ? findStudentByStudentId_(sh.master, studentId)
    : findStudentByQr_(sh.master, qrValue);
  if (!st) {
    return jsonOut_({ success: false, error: "生徒が見つかりませんでした" });
  }
  var last = getLatestLogType_(sh.log, st.studentId);
  var explicit = String(body.entryType || "").trim();
  var type;
  if (explicit === "入室" || explicit === "退室") {
    if (explicit === "入室") {
      if (last === "入室") {
        return jsonOut_({
          success: false,
          error: "直前の記録が入室のため、退室を押してから入室を記録してください。",
        });
      }
      type = "入室";
    } else {
      if (last !== "入室") {
        return jsonOut_({
          success: false,
          error: "直前の記録が入室ではないため、入室を押してから退室を記録してください。",
        });
      }
      type = "退室";
    }
  } else {
    type = nextEntryType_(last);
  }
  var at = new Date();
  var sheetTs = formatTokyo_(at);

  var emailViaServer = body.emailHandledByServer === true;
  var sendStatus = "送信済み";
  if (!st.parentEmail) {
    sendStatus = "エラー";
  } else if (emailViaServer) {
    sendStatus = "エラー";
  } else {
    var timeStr = sheetTs;
    var ok = false;
    if (String(CONFIG.SENDGRID_API_KEY || "").trim()) {
      var subject =
        type === "入室"
          ? "【永田塾】" + st.name + "さんが入室しました"
          : "【永田塾】" + st.name + "さんが退室しました";
      var textBody =
        type === "入室"
          ? st.name +
            "さんが永田塾に入室しました。\n\n入室時刻：" +
            timeStr +
            "\n\n永田塾"
          : st.name +
            "さんが永田塾を退室しました。\n\n退室時刻：" +
            timeStr +
            "\n\n永田塾";
      ok = sendGrid_(st.parentEmail, subject, textBody);
    }
    if (!ok) sendStatus = "エラー";
  }

  sh.log.appendRow([
    sheetTs,
    st.studentId,
    st.name,
    type,
    sendStatus,
    String(st.grade || "").trim(),
  ]);

  return jsonOut_({
    success: true,
    studentName: st.name,
    type: type,
    timestamp: formatIsoTokyo_(at),
    sheetTimestamp: sheetTs,
    studentId: st.studentId,
    parentEmail: st.parentEmail,
  });
}

function handleUpdateLogSendStatus_(body) {
  var studentId = String(body.studentId || "").trim();
  var sheetTs = String(body.sheetTimestamp || "").trim();
  var sendStatus = String(body.sendStatus || "").trim();
  if (!studentId || !sheetTs || !sendStatus) {
    return err_("パラメータ不足です");
  }
  var sh = openSheets_();
  var values = sh.log.getRange("A2:F").getValues();
  for (var i = values.length - 1; i >= 0; i--) {
    var r = values[i];
    if (String(r[1] || "").trim() === studentId && String(r[0] || "").trim() === sheetTs) {
      sh.log.getRange(i + 2, 5).setValue(sendStatus);
      return jsonOut_({ ok: true });
    }
  }
  return err_("ログ行が見つかりません");
}

function handleStudents_() {
  var sh = openSheets_();
  var values = sh.master.getRange("A2:F").getValues();
  var students = [];
  for (var i = 0; i < values.length; i++) {
    students.push(rowToStudent_(rowCellsAF_(values[i]), i + 2));
  }
  return jsonOut_({ students: students });
}

function handleLogsToday_() {
  var sh = openSheets_();
  var values = sh.log.getRange("A2:F").getValues();
  var prefix = todayPrefixTokyo_();
  var logs = [];
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    var ts = String(r[0] || "");
    if (ts.indexOf(prefix) !== 0) continue;
    logs.push({
      timestamp: ts,
      studentId: String(r[1] || ""),
      studentName: String(r[2] || ""),
      type: String(r[3] || ""),
      sendStatus: String(r[4] || ""),
      grade: String(r[5] || ""),
    });
  }
  return jsonOut_({ logs: logs });
}

function handleUpdateStudent_(body) {
  var rowIndex = Number(body.rowIndex);
  if (!rowIndex || rowIndex < 2) {
    return err_("不正な行番号です");
  }
  var sh = openSheets_();
  sh.master
    .getRange(rowIndex, 1, rowIndex, 6)
    .setValues([
      [
        String(body.studentId || ""),
        String(body.name || ""),
        String(body.parentEmail || ""),
        String(body.qrValue || ""),
        String(body.note || ""),
        String(body.grade || ""),
      ],
    ]);
  return jsonOut_({ ok: true });
}

function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    var bad = assertSecret_(body);
    if (bad) return err_("認証に失敗しました", 401);

    var action = String(body.action || "scan");
    if (action === "scan") return handleScan_(body);
    if (action === "students") return handleStudents_();
    if (action === "logsToday") return handleLogsToday_();
    if (action === "updateStudent") return handleUpdateStudent_(body);
    if (action === "updateLogSendStatus") return handleUpdateLogSendStatus_(body);
    return err_("未知の action です: " + action);
  } catch (ex) {
    return jsonOut_({
      ok: false,
      error: String(ex && ex.message ? ex.message : ex),
      httpStatus: 500,
    });
  }
}

function doGet() {
  return jsonOut_({ ok: true, message: "Nagata Juku Apps Script proxy is running" });
}