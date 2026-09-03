/* ชุดทดสอบกันพัง v0.1.0 — เขียนเป็น "กติกาที่ต้องจริงเสมอ" ไม่ล็อกค่าเป๊ะ
   รันด้วย: node _tests/guard-v0100.js */
var fs = require('fs'), path = require('path'), vm = require('vm');
var SRC = fs.readFileSync(path.join(__dirname, '..', 'deploy', 'CLAIM-Hub.js'), 'utf8');

// จำลองของที่มีเฉพาะบน Apps Script เท่าที่ฟังก์ชันบริสุทธิ์ต้องใช้
var sandbox = {
  Session:{ getActiveUser:function(){ return { getEmail:function(){ return ''; } }; } },
  CacheService:{ getScriptCache:function(){ return { get:function(){return null;}, put:function(){}, removeAll:function(){} }; } },
  PropertiesService:{ getScriptProperties:function(){ return { getProperty:function(){return '';}, setProperty:function(){} }; } },
  SpreadsheetApp:{}, DriveApp:{}, HtmlService:{}, LockService:{}, UrlFetchApp:{}, LanguageApp:{},
  console: console
};
vm.createContext(sandbox);
new vm.Script(SRC, { filename:'CLAIM-Hub.js' }).runInContext(sandbox);

var pass = 0, fail = 0;
function T(name, got, want){
  var ok = String(got) === String(want);
  if (ok) pass++; else { fail++; console.error('FAIL  ' + name + '\n      ได้ ' + got + '  ควรได้ ' + want); }
}
function TT(name, cond){ if (cond) pass++; else { fail++; console.error('FAIL  ' + name); } }

/* กติกา 1 — วันที่ทั้งระบบต้องเป็น DD/MM/YYYY เสมอ */
T('วันที่ 6/3/2026 → เติมศูนย์หน้า', sandbox.fmtDMY_('6/3/2026'), '06/03/2026');
T('วันที่ 06/03/2026 → คงเดิม',      sandbox.fmtDMY_('06/03/2026'), '06/03/2026');
T('ปี พ.ศ. 2569 → แปลงเป็น ค.ศ.',    sandbox.fmtDMY_('6/3/2569'), '06/03/2026');
T('ปี 2 หลัก 6/3/26',               sandbox.fmtDMY_('6/3/26'), '06/03/2026');
T('ว่าง → ว่าง',                     sandbox.fmtDMY_(''), '');
T('Date object',                    sandbox.fmtDMY_(new Date(2026,2,6)), '06/03/2026');

/* กติกา 2 — เงินต้อง 2 ตำแหน่งเสมอ และห้ามเพี้ยนจากคอมมา */
T('เงิน 2 ตำแหน่ง',        sandbox.money_('1,234.567'), 1234.57);
T('เงินเป็นศูนย์ได้',      sandbox.money_(''), 0);
T('เงินติดคอมมา',          sandbox.money_('2,220'), 2220);
T('จำนวนไม่ปัดเอง',        sandbox.num_('54'), 54);
T('จำนวนทศนิยมคงไว้',      sandbox.num_('5.15'), 5.15);

/* กติกา 3 — หาคอลัมน์ด้วยชื่อหัวตาราง ขยับคอลัมน์แล้วต้องไม่พัง
   และห้ามหยิบ "role for Claim" มาใช้เป็น role ของ NOVA โดยพลาด */
var hdr = ['email','display_name','role for NOVA BOM','role for Claim','active','PIN','รหัสพนักงาน'];
T('หา role for claim ได้ถูกช่อง', sandbox.colIdx_(hdr, ['role for claim']), 3);
T('หา email',                    sandbox.colIdx_(hdr, ['email']), 0);
T('หา รหัสพนักงาน',               sandbox.colIdx_(hdr, ['รหัสพนักงาน']), 6);
T('ไม่เจอ คืน -1',                sandbox.colIdx_(hdr, ['ไม่มีคอลัมน์นี้']), -1);
var hdr2 = ['(ว่าง)','email','ใหม่แทรก','display_name','role for NOVA BOM','role for Claim','active','PIN','รหัสพนักงาน'];
T('แทรกคอลัมน์แล้วยังหาเจอ',      sandbox.colIdx_(hdr2, ['role for claim']), 5);

/* กติกา 4 — แปลงคำในชีตเป็นรหัสสิทธิ์
   ⚠️ ทดสอบด้วย "ค่าที่มีอยู่จริงในชีต USERS" ทั้ง 9 แบบ ไม่ใช่ค่าที่คิดขึ้นเอง */
T('ADMIN_EXEC → ADMIN',            sandbox.normRole_('ADMIN_EXEC'), 'ADMIN');
T('EXEC → ADMIN',                  sandbox.normRole_('EXEC'), 'ADMIN');
T('Production → PRODUCTION',       sandbox.normRole_('Production'), 'PRODUCTION');
T('PURCHASE → PURCHASE',           sandbox.normRole_('PURCHASE'), 'PURCHASE');
T('QC → QC',                       sandbox.normRole_('QC'), 'QC');
T('STORE → STORE',                 sandbox.normRole_('STORE'), 'STORE');
T('Design & Estimate → DESIGN',    sandbox.normRole_('Design & Estimate'), 'DESIGN');
T('ว่าง → GUEST',                   sandbox.normRole_(''), 'GUEST');
T('คำแปลก → GUEST',                 sandbox.normRole_('อะไรก็ไม่รู้'), 'GUEST');

/* กติกา 4b — 1 คนมีได้หลายสิทธิ์ ต้องได้ครบ ไม่ใช่เหลือตัวเดียว
   เคสจริงในชีต: "Sales / Production / QC" — ถ้าคืนแค่ QC สิทธิ์ผลิตกับขายหายเงียบ */
var multi = sandbox.rolesOf_('Sales / Production / QC');
TT('Sales/Production/QC → ได้ SALES',      multi.indexOf('SALES') >= 0);
TT('Sales/Production/QC → ได้ PRODUCTION', multi.indexOf('PRODUCTION') >= 0);
TT('Sales/Production/QC → ได้ QC',         multi.indexOf('QC') >= 0);
T('Sales/Production/QC → ได้ครบ 3 สิทธิ์',  multi.length, 3);
T('ADMIN_EXEC ได้สิทธิ์เดียว',              sandbox.rolesOf_('ADMIN_EXEC').length, 1);
T('ว่าง → ไม่มีสิทธิ์เลย',                   sandbox.rolesOf_('').length, 0);
TT('QC ต้องไม่ไปโดนคำอื่นที่มี qc ปน',       sandbox.rolesOf_('Purchase').indexOf('QC') < 0);

/* กติกา 5 — อ่านประเภทงานจากเลขจ๊อบได้ถูก รวมถึงเลขแปลก ๆ ที่มีจริงในระบบ */
T('JT', sandbox.typeFromJobNo_('JT-69/0009'), 'JT');
T('JM', sandbox.typeFromJobNo_('JM-69/0123'), 'JM');
T('JMC', sandbox.typeFromJobNo_('JMC-69/0020'), 'JMC');
T('JMS', sandbox.typeFromJobNo_('JMS-69/0001'), 'JMS');
T('FG',  sandbox.typeFromJobNo_('FG-68/0017'), 'FG');

/* กติกา 6 — ปีเอกสารต้องเป็นปี พ.ศ. และตัวย่อ 2 หลัก */
TT('ปี พ.ศ. = ค.ศ. + 543', sandbox.yearBE_() === new Date().getFullYear() + 543);
T('ตัวย่อปี 2569 → 69', sandbox.yy_(2569), '69');

/* กติกา 7 — ห้ามเขียนลงไฟล์ของ NOVA (ตรวจจากซอร์สโดยตรง) */
var NOVA = ['1ZCKb_KRECWRSRaObBQz4nDUmwazvV2lhoPMj2O5j744','1ziLS_xidTu4z6B0DvscAgfOO_5V7hF0WxZYDTBqgPrs'];
var writeWords = /setValue|setValues|appendRow|insertSheet|deleteSheet|deleteRow|clearContent/;
var bad = 0;
SRC.split('\n').forEach(function(ln){
  NOVA.forEach(function(id){ if (ln.indexOf(id) >= 0 && writeWords.test(ln)) bad++; });
});
TT('ไม่มีคำสั่งเขียนลงไฟล์ NOVA เลย', bad === 0);
TT('readTab_ ใช้ getDisplayValues (อ่านอย่างเดียว)', /function readTab_[\s\S]{0,400}getDisplayValues/.test(SRC));


/* กติกา 8 — appsscript.json ต้องเป็นเว็บแอปเสมอ
   🚨 บทเรียนจริง v0.1.3: `clasp create` ดาวน์โหลด appsscript.json ตัวเปล่าจาก Google
   มาทับไฟล์ของเราในเครื่อง แล้ว push ตัวเปล่ากลับขึ้นไป → deployment ไม่ใช่เว็บแอป
   → เปิด /exec ขึ้น "Sorry, unable to open the file at this time" ทั้งที่ deploy สำเร็จทุกครั้ง
   เทสนี้จับได้ก่อน push เสมอ */
var MANI = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'deploy', 'appsscript.json'), 'utf8'));
TT('appsscript.json ต้องมีส่วน webapp',        !!MANI.webapp);
T ('เว็บแอปต้องรันในนามเจ้าของ',                MANI.webapp && MANI.webapp.executeAs, 'USER_DEPLOYING');
T ('เว็บแอปต้องเปิดให้พนักงานเข้าได้',           MANI.webapp && MANI.webapp.access, 'ANYONE');
T ('เขตเวลาต้องเป็นไทย',                       MANI.timeZone, 'Asia/Bangkok');
TT('ต้องเปิดบริการ Sheets',                    JSON.stringify(MANI.dependencies || {}).indexOf('sheets') >= 0);
['spreadsheets','drive','userinfo.email','script.external_request'].forEach(function(sc){
  TT('ต้องขอสิทธิ์ ' + sc, (MANI.oauthScopes || []).join(' ').indexOf(sc) >= 0);
});

console.log('รวมทั้งหมด: ผ่าน ' + pass + ' · ไม่ผ่าน ' + fail);
process.exit(fail ? 1 : 0);
