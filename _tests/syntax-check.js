/* ตรวจไวยากรณ์ทุกไฟล์โค้ดก่อน push — ถ้าพังตรงไหน หยุดทันที ไม่ให้ขึ้นระบบจริง
   รันด้วย: node _tests/syntax-check.js   (อัปเดตระบบเคลม.bat เรียกให้อัตโนมัติ) */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var DEPLOY = path.join(ROOT, 'deploy');
var fail = 0, checked = 0;

function check(label, code) {
  checked++;
  try { new vm.Script(code, { filename: label }); }
  catch (e) { fail++; console.error('SYNTAX ERROR  ' + label + '\n   ' + e.message); }
}

fs.readdirSync(DEPLOY).forEach(function (f) {
  var p = path.join(DEPLOY, f);
  if (!fs.statSync(p).isFile()) return;
  var src = fs.readFileSync(p, 'utf8');

  if (/\.(js|gs)$/i.test(f)) { check(f, src); return; }

  if (/\.html$/i.test(f)) {
    // ห้ามมี ?> ในไฟล์ (ชน template ของ Apps Script) — บทเรียนจาก NOVA
    if (f !== 'CLAIM-Index.html' && src.indexOf('?' + '>') >= 0) { fail++; console.error('FOUND "?>" in ' + f + ' (breaks Apps Script template)'); }
    // ดึงเฉพาะก้อน <script> มาตรวจไวยากรณ์
    var re = /<script[^>]*>([\s\S]*?)<\/script>/gi, m, i = 0;
    while ((m = re.exec(src))) { i++; check(f + ' <script#' + i + '>', m[1]); }
  }
});

// กติกาเหล็ก: โปรแกรมเคลมห้ามเขียนลงไฟล์ของ NOVA
var NOVA_IDS = ['1ZCKb_KRECWRSRaObBQz4nDUmwazvV2lhoPMj2O5j744', '1ziLS_xidTu4z6B0DvscAgfOO_5V7hF0WxZYDTBqgPrs'];
fs.readdirSync(DEPLOY).forEach(function (f) {
  if (!/\.(js|gs)$/i.test(f)) return;
  var src = fs.readFileSync(path.join(DEPLOY, f), 'utf8');
  var lines = src.split('\n');
  lines.forEach(function (ln, i) {
    NOVA_IDS.forEach(function (id) {
      if (ln.indexOf(id) >= 0 && /setValue|setValues|appendRow|insertSheet|deleteSheet|clear\(/.test(ln)) {
        fail++; console.error('FORBIDDEN WRITE to a NOVA file at ' + f + ':' + (i + 1));
      }
    });
  });
});

console.log('checked ' + checked + ' script blocks, ' + fail + ' problem(s)');
process.exit(fail ? 1 : 0);
