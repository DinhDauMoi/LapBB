// ============================================================
// Google Apps Script - Paste this into your Google Apps Script editor
// ============================================================
// Sheet structure:
// Column A: STT
// Column B: Mã Biên Bản (L001, L002, ...)
// Column C: Mã Vận Đơn
// Column D: Thời Gian
// Column E: Mã SP
// Column F: Tên SP
// Column G: Số Lượng
// Column H: ĐVT
// Column I: Tình Trạng
// Column J: Số Chứng Từ
// Column K: Vị Trí Lập
// ============================================================

function doGet(e) {
  var action = e.parameter.action;
  
  if (action === 'getNextCode') {
    return getNextCode();
  }
  
  if (action === 'lookup') {
    var code = e.parameter.code;
    return lookupBB(code);
  }
  
  return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Unknown action'}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    if (data.action === 'save') {
      return saveBB(data);
    }
    
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Unknown action'}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: err.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getNextCode() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var maxNum = 0;
  
  for (var i = 1; i < data.length; i++) {
    var code = String(data[i][1]); // Column B = Mã BB
    if (code.startsWith('L')) {
      var num = parseInt(code.substring(1));
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }
  
  var nextCode = 'L' + String(maxNum + 1).padStart(3, '0');
  
  return ContentService.createTextOutput(JSON.stringify({status: 'ok', code: nextCode}))
    .setMimeType(ContentService.MimeType.JSON);
}

function saveBB(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // Add header if sheet is empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['STT', 'Mã BB', 'Mã Vận Đơn', 'Thời Gian', 'Mã SP', 'Tên SP', 'Số Lượng', 'ĐVT', 'Tình Trạng', 'Số Chứng Từ', 'Vị Trí Lập']);
  }

  // Delete existing rows with this BB code to prevent duplicates
  if (data.bbCode) {
    var sheetData = sheet.getDataRange().getValues();
    // Start from the end so row deletion doesn't offset indices
    for (var i = sheetData.length - 1; i >= 1; i--) {
      if (String(sheetData[i][1]).toUpperCase() === data.bbCode.toUpperCase()) {
        sheet.deleteRow(i + 1);
      }
    }
  }
  
  var rows = data.rows;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    sheet.appendRow([
      r.stt,
      data.bbCode,
      "'" + r.maVanDon,
      r.thoiGian,
      "'" + r.maSP,
      r.tenSP,
      r.soLuong,
      r.donViTinh,
      r.tinhTrang,
      "'" + r.soChungTu,
      r.viTriLap
    ]);
  }
  
  return ContentService.createTextOutput(JSON.stringify({status: 'ok', code: data.bbCode}))
    .setMimeType(ContentService.MimeType.JSON);
}

function lookupBB(code) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var results = [];
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).toUpperCase() === code.toUpperCase()) {
      results.push({
        stt: data[i][0],
        bbCode: data[i][1],
        maVanDon: data[i][2],
        thoiGian: data[i][3],
        maSP: data[i][4],
        tenSP: data[i][5],
        soLuong: data[i][6],
        donViTinh: data[i][7],
        tinhTrang: data[i][8],
        soChungTu: data[i][9],
        viTriLap: data[i][10] || ''
      });
    }
  }
  
  if (results.length > 0) {
    return ContentService.createTextOutput(JSON.stringify({status: 'ok', rows: results}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Không tìm thấy'}))
    .setMimeType(ContentService.MimeType.JSON);
}
