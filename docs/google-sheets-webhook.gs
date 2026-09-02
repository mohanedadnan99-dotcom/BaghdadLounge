const SPREADSHEET_ID = "1MDNnsv9akz2y9ADL0Dmi285hjjlG5mv9HSzqP3O8sHQ";
const SHEET_NAME = "سجل العمليات";
const TOKEN_PROPERTY = "OPS_SYNC_TOKEN";
const COLUMN_COUNT = 20;

function doPost(event) {
  const lock = LockService.getScriptLock();

  try {
    if (!lock.tryLock(30000)) {
      return jsonResponse({ ok: false, error: "المزامنة مشغولة؛ حاول مرة ثانية" });
    }

    const body = JSON.parse((event.postData && event.postData.contents) || "{}");
    const expectedToken = PropertiesService.getScriptProperties().getProperty(TOKEN_PROPERTY);

    if (!expectedToken) {
      return jsonResponse({ ok: false, error: "رمز مزامنة Google Sheet غير مهيأ" });
    }

    if (!body.token || body.token !== expectedToken) {
      return jsonResponse({ ok: false, error: "رمز مزامنة Google Sheet غير صحيح" });
    }

    if (body.spreadsheetId !== SPREADSHEET_ID || body.sheetName !== SHEET_NAME) {
      return jsonResponse({ ok: false, error: "ملف أو تبويب Google Sheet غير صحيح" });
    }

    if (!Array.isArray(body.row) || body.row.length !== COLUMN_COUNT) {
      return jsonResponse({ ok: false, error: "عدد أعمدة العملية غير صحيح" });
    }

    const row = body.row.map(safeCellValue);
    const reference = String(row[0] || "").trim();
    if (!reference) {
      return jsonResponse({ ok: false, error: "رقم العملية مطلوب" });
    }

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) {
      return jsonResponse({ ok: false, error: "تبويب سجل العمليات غير موجود" });
    }

    const dataRowCount = Math.max(0, sheet.getLastRow() - 1);
    const existing = dataRowCount
      ? sheet.getRange(2, 1, dataRowCount, 1).createTextFinder(reference).matchEntireCell(true).findNext()
      : null;

    if (existing) {
      sheet.getRange(existing.getRow(), 1, 1, COLUMN_COUNT).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    SpreadsheetApp.flush();
    return jsonResponse({ ok: true, action: existing ? "updated" : "inserted", reference });
  } catch (error) {
    return jsonResponse({ ok: false, error: error && error.message ? error.message : "تعذر حفظ العملية" });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function safeCellValue(value) {
  if (typeof value === "string" && /^[=+\-@]/.test(value)) return "'" + value;
  return value;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
