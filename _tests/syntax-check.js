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


/* ── v0.6.3 · เวอร์ชันหน้าเว็บต้องตรงกับเวอร์ชันเซิร์ฟเวอร์ ──
   ป้ายเวอร์ชันเดิมอ่านจากเซิร์ฟเวอร์อย่างเดียว เบราว์เซอร์แคชหน้าเก่าไว้ก็ไม่มีใครรู้
   เสียเวลาไปแล้ว 2 รอบเพราะเรื่องนี้ — ถ้า 2 ค่าไม่ตรง ห้าม push
   ⚠️ ต้องอยู่ "ก่อน" process.exit ไม่งั้นโค้ดนี้ไม่เคยทำงานเลย (เจอมาแล้ว) */
(function(){
  var _dir = path.join(__dirname, '..', 'deploy');
  var hub  = fs.readFileSync(path.join(_dir, 'CLAIM-Hub.js'), 'utf8');
  var core = fs.readFileSync(path.join(_dir, 'js-core.html'), 'utf8');
  var a = (hub.match(/var VERSION\s*=\s*'([^']+)'/) || [])[1];
  var b = (core.match(/var CLIENT_VER\s*=\s*'([^']+)'/) || [])[1];
  if (!a || !b){
    console.error('!! หาเวอร์ชันไม่เจอ — VERSION=' + a + ' CLIENT_VER=' + b);
    fail++;
    return;
  }
  if (a !== b){
    console.error('!! เวอร์ชันไม่ตรงกัน — CLAIM-Hub.js = ' + a + ' แต่ js-core.html = ' + b);
    console.error('   แก้ CLIENT_VER ใน js-core.html ให้เป็น ' + a + ' ก่อน push');
    fail++;
    return;
  }
  console.log('version match: ' + a + ' (server = client)');
})();

console.log('checked ' + checked + ' script blocks, ' + fail + ' problem(s)');
process.exit(fail ? 1 : 0);
