/**
 * Job Search 2027 → private JSON feed for the dashboard.
 *
 * Setup (once):
 *  1. In the sheet: Extensions → Apps Script. Paste this whole file, save.
 *  2. Pick "createToken" in the function dropdown and press Run. Approve the permissions.
 *     Open View → Logs (or Execution log) and copy the token it prints.
 *  3. Deploy → New deployment → type "Web app".
 *       Execute as: Me
 *       Who has access: Anyone
 *     Copy the Web app URL (ends in /exec).
 *  4. In Vercel, add JOBS_SHEET_URL (the /exec URL) and JOBS_SHEET_TOKEN (the token).
 *
 * "Anyone" only means the URL can be called; without the token it returns nothing.
 */

function doGet(e) {
  var expected = PropertiesService.getScriptProperties().getProperty('HUB_TOKEN');
  var given = e && e.parameter ? e.parameter.token : '';
  if (!expected || given !== expected) return json_({ error: 'unauthorized' });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var settings = {};
  var st = ss.getSheetByName('Settings');
  if (st) {
    st.getRange('A1:B10').getDisplayValues().forEach(function (r) {
      if (r[0]) settings[r[0]] = r[1];
    });
  }
  return json_({
    updatedAt: new Date().toISOString(),
    jobs: readTab_(ss, 'Jobs'),
    outreach: readTab_(ss, 'Outreach'),
    settings: settings,
  });
}

function readTab_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) return [];
  var values = sh.getDataRange().getDisplayValues();
  var head = values.shift();
  return values
    .filter(function (r) { return r.some(function (c) { return c !== ''; }); })
    .map(function (r) {
      var o = {};
      head.forEach(function (h, i) { if (h) o[h] = r[i]; });
      return o;
    });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function createToken() {
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('HUB_TOKEN', token);
  Logger.log('Your token: ' + token);
}
