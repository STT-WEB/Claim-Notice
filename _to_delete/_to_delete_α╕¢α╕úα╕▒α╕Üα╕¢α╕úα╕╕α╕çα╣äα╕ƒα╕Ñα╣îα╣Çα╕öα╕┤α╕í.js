/* แก้ CLAIM-Hub.js ที่มีอยู่แล้วให้เข้ากับ v0.3.0
   1. เลื่อนเวอร์ชันเป็น v0.3.0
   2. เอา photoCoverage_ ตัวเก่าออก — ตัวใหม่ย้ายไปอยู่ CLAIM-More.js แล้ว
      (ถ้าเหลือ 2 ตัวชื่อเดียวกันคนละไฟล์ Apps Script จะเลือกตัวไหนก็ได้ = พังแบบเดาไม่ได้)
   รันจากในโฟลเดอร์โปรเจกต์:  node "deploy\ปรับปรุงไฟล์เดิม.js"                      */
var fs = require('fs'), path = require('path');
var p = path.join(__dirname, 'CLAIM-Hub.js');
var s = fs.readFileSync(p, 'utf8');
var before = s.length, notes = [];

if (/var VERSION = 'v0\.3\.0';/.test(s)) notes.push('- เวอร์ชันเป็น v0.3.0 อยู่แล้ว');
else { s = s.replace(/var VERSION = '[^']*';/, "var VERSION = 'v0.3.0';"); notes.push('- เลื่อนเวอร์ชันเป็น v0.3.0'); }

var i = s.indexOf('function photoCoverage_(');
if (i < 0) notes.push('- ไม่พบ photoCoverage_ ตัวเก่า (ดีแล้ว)');
else {
  var start = i;
  var c = s.lastIndexOf('/**', i);                       // เก็บคอมเมนต์หัวฟังก์ชันไปด้วย
  if (c >= 0 && s.slice(c, i).indexOf('function ') < 0) start = c;
  var depth = 0, j = s.indexOf('{', i), end = -1;
  for (var k = j; k < s.length; k++){
    if (s[k] === '{') depth++;
    else if (s[k] === '}'){ depth--; if (depth === 0){ end = k + 1; break; } }
  }
  if (end < 0) { console.error('!! หา } ปิดฟังก์ชันไม่เจอ — ไม่แก้อะไรเลย'); process.exit(1); }
  s = s.slice(0, start) + '/* photoCoverage_ ย้ายไปอยู่ CLAIM-More.js แล้ว (v0.3.0) */\n' + s.slice(end);
  notes.push('- เอา photoCoverage_ ตัวเก่าออกแล้ว');
}

fs.writeFileSync(p, s, 'utf8');
console.log('CLAIM-Hub.js: ' + before + ' -> ' + s.length + ' ตัวอักษร');
notes.forEach(function(n){ console.log(n); });
console.log('เสร็จแล้ว — รัน "อัปเดตระบบเคลม.bat" ต่อได้เลย');
