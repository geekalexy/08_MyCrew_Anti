/**
 * MyCrew 분양 신청 폼 - Google Sheets Web App 수신 스크립트
 *
 * 사용법 (geekalexy@gmail.com 계정):
 * 1. Google Sheets에서 새 스프레드시트 생성 (파일명: mycrew - 신청 폼 응답)
 * 2. 시트 2개 준비: "applications", "waitlist"
 * 3. 확장 프로그램 → Apps Script 클릭
 * 4. 기존 코드를 이 스크립트로 교체
 * 5. SHEET_ID를 스프레드시트 ID로 변경
 * 6. 배포 → 새 배포 → 웹 앱 선택
 *    - 실행 사용자: 나
 *    - 액세스 권한: 모든 사용자
 * 7. 배포 후 URL을 index.html의 APPS_SCRIPT_URL에 입력
 */

var SHEET_ID = '여기에_스프레드시트_ID_입력';

function doPost(e) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var data = JSON.parse(e.postData.contents);
  var type = data.type || 'applications';

  if (type === 'waitlist') {
    var sheet = ss.getSheetByName('waitlist');
    if (!sheet) {
      sheet = ss.insertSheet('waitlist');
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['timestamp', 'type', 'email']);
    }
    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.waitlistType || 'email',
      data.email || ''
    ]);
  } else {
    var sheet = ss.getSheetByName('applications');
    if (!sheet) {
      sheet = ss.insertSheet('applications');
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'timestamp', 'useMac', 'claudePlan', 'macosVersion',
        'telegramId', 'companyName', 'industry', 'product',
        'targetCustomer', 'tasks', 'character'
      ]);
    }
    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.useMac || '',
      data.claudePlan || '',
      data.macosVersion || '',
      data.telegramId || '',
      data.companyName || '',
      data.industry || '',
      data.product || '',
      data.targetCustomer || '',
      data.tasks || '',
      data.character || ''
    ]);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', type: type }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'MyCrew 신청 폼 Web App' }))
    .setMimeType(ContentService.MimeType.JSON);
}
