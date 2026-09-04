/**
 *  STT CLAIM — ระบบงานเคลม / ตรวจรับ (Claim & Inspection)
 *  โปรแกรมแยกจาก STT NOVA คนละโปรเจกต์ คนละไฟล์ คนละ deployment
 *
 *  ⛔ กติกาเหล็ก: โปรแกรมนี้ "อ่าน" ข้อมูลกลางของ NOVA ได้ แต่ "ห้ามเขียน" ลงไฟล์ของ NOVA เด็ดขาด
 *     เขียนได้เฉพาะไฟล์ฐานข้อมูลของตัวเอง (STT-CLAIM-DB) และโฟลเดอร์ Drive ของงานเคลมเท่านั้น
 *     มีตัวตรวจอัตโนมัติใน _tests/syntax-check.js กันไว้อีกชั้น
 *
 *  ประวัติเวอร์ชันเต็มอยู่ที่ deploy/CHANGELOG.md
 */
var VERSION = 'v0.4.0';

/* ─────────── ค่าคงที่ของระบบ ─────────── */
var CFG = {
  // ไฟล์ของ NOVA — อ่านอย่างเดียวเท่านั้น
  MASTER : '1ZCKb_KRECWRSRaObBQz4nDUmwazvV2lhoPMj2O5j744',   // USERS / VENDORS / All WIP / Data Good Code
  TXN    : '1ziLS_xidTu4z6B0DvscAgfOO_5V7hF0WxZYDTBqgPrs',   // DELIVERY_NOTES

  // โฟลเดอร์ Drive ของงานเคลม (เบียร์สร้างไว้แล้ว)
  FOLDER_ROOT  : '1OESE3WzwKGWS5PZxoWQ_Q6jRfIX4UkBT',
  FOLDER_PDF   : '1HMXuH_hGzrciCJCse3AQtqhGRUxn9omn',
  FOLDER_MEDIA : '1mt6SaqgUbwCprIWYGz0WonezLHPLjDOQ',

  // คีย์เก็บ id ไฟล์ฐานข้อมูลของเราเอง (สร้างอัตโนมัติครั้งแรก)
  DB_PROP : 'CLAIM_DB_ID',
  DB_NAME : 'STT-CLAIM-DB'
};

// PO Report แยกตามปี พ.ศ. (ใช้ดูวันรับสินค้าจากเลข POR)
var POREPORT = {
  2569:'1utv_T8zs-lKzI_qvXRVQSnnLJWwFR1kS3qHIjlCvFzo',
  2568:'14GRC1iN44HOca5JfGW0cN4tKQG7A0Hn57yrrHQqcY1Y',
  2567:'1AZqtOj0uyZmxML1sFBdhGUJPOQrisXQdCZulD6G3Gts',
  2565:'1RtP5IPbvhSIImbkQOD-BI2XcXHCnhjLsrTnoYkkvYS8',
  2564:'1dd4hL1x_kaOVERmU_vZLaZ7rRuRmAxlI3wsFhpWvtQg',
  2563:'10_HM0u46TphJ4FT78ohueS14dIT2qup3MlNu9lAtpvs'
};

var AUTO_ADMIN = ['sasipa@suteetankers.com','boriphat@suteetankers.com'];

/* ─────────── หน้าเว็บ ─────────── */
function doGet() {
  return HtmlService.createTemplateFromFile('CLAIM-Index').evaluate()
    .setTitle('STT CLAIM — งานเคลม / ตรวจรับ')
    .addMetaTag('viewport','width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function include(f){ return HtmlService.createHtmlOutputFromFile(f).getContent(); }
function getVersion(){ return VERSION; }

/* ─────────── ตัวช่วยพื้นฐาน ─────────── */
function norm_(v){ return String(v == null ? '' : v).trim(); }
function num_(v){
  if (v === '' || v == null) return 0;
  var n = Number(String(v).replace(/,/g,''));
  return isNaN(n) ? 0 : n;
}
function money_(v){ return Math.round(num_(v) * 100) / 100; }   // เงิน 2 ตำแหน่งเสมอ

function toDate_(v){
  if (v instanceof Date && !isNaN(v)) return v;
  var s = norm_(v); if (!s) return null;
  var m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m){
    var d = +m[1], mo = +m[2], y = +m[3];
    if (y < 100) y += 2000;
    if (y > 2400) y -= 543;                 // เผลอใส่ปี พ.ศ. มา
    var dt = new Date(y, mo-1, d);
    return isNaN(dt) ? null : dt;
  }
  var dt2 = new Date(s);
  return isNaN(dt2) ? null : dt2;
}
/** วันที่ทั้งระบบ = DD/MM/YYYY เสมอ (กฎเหล็กของเบียร์) */
function fmtDMY_(v){
  var d = toDate_(v); if (!d) return norm_(v);
  var p = function(n){ return (n<10?'0':'') + n; };
  return p(d.getDate()) + '/' + p(d.getMonth()+1) + '/' + d.getFullYear();
}
function nowStamp_(){
  var d = new Date(), p = function(n){ return (n<10?'0':'') + n; };
  return p(d.getDate())+'/'+p(d.getMonth()+1)+'/'+d.getFullYear()+' '+p(d.getHours())+':'+p(d.getMinutes());
}
function yearBE_(){ return new Date().getFullYear() + 543; }
function yy_(be){ return String(be).slice(-2); }

/** หาคอลัมน์จาก "ชื่อหัวตาราง" ไม่ผูกตำแหน่ง — ขยับคอลัมน์แล้วระบบไม่พัง */
function colIdx_(hdr, names){
  for (var i = 0; i < hdr.length; i++){
    var h = norm_(hdr[i]).toLowerCase();
    if (!h) continue;
    for (var k = 0; k < names.length; k++){
      if (h.indexOf(String(names[k]).toLowerCase()) >= 0) return i;
    }
  }
  return -1;
}
/** หาแถวหัวตาราง (บางชีตหัวไม่ได้อยู่แถวแรก) */
function findHeaderRow_(rows, names, maxScan){
  var lim = Math.min(rows.length, maxScan || 8);
  for (var r = 0; r < lim; r++){
    if (colIdx_(rows[r], names) >= 0) return r;
  }
  return 0;
}

/* ─────────── อ่านไฟล์ของ NOVA (อ่านอย่างเดียว) ─────────── */
function readTab_(fileId, tabName){
  var ss = SpreadsheetApp.openById(fileId);
  var sh = ss.getSheetByName(tabName);
  if (!sh) return null;
  var lr = sh.getLastRow(), lc = sh.getLastColumn();
  if (lr < 1 || lc < 1) return [];
  return sh.getRange(1, 1, lr, lc).getDisplayValues();
}

/* ─────────── ผู้ใช้ + สิทธิ์ (อ่านจาก USERS ของ NOVA) ─────────── */
var ROLES = ['ADMIN','APPROVER','PURCHASE','STORE','QC','PRODUCTION','DESIGN','SALES','HR','PICKER','GUEST'];

/** 1 คนมีได้หลายสิทธิ์ — ในชีตเขียนคั่นกันได้ เช่น "Sales / Production / QC"
 *  คืนเป็น "รายการสิทธิ์ทั้งหมด" ไม่ใช่ตัวเดียว ไม่งั้นสิทธิ์ที่เหลือหายเงียบ ๆ */
function rolesOf_(v){
  var s = norm_(v).toLowerCase();
  if (!s) return [];
  var out = [];
  function add(r){ if (out.indexOf(r) < 0) out.push(r); }
  if (/admin|exec|ผู้บริหาร|ผบห/.test(s)) add('ADMIN');
  if (/approve|อนุมัติ/.test(s))          add('APPROVER');
  if (/purchase|จัดซื้อ/.test(s))          add('PURCHASE');
  if (/store|สโตร์|คลัง/.test(s))          add('STORE');
  if (/\bqc\b|คุณภาพ/.test(s))            add('QC');
  if (/product|ผลิต/.test(s))             add('PRODUCTION');
  if (/design|ออกแบบ|เขียนแบบ/.test(s))    add('DESIGN');
  if (/sale|ขาย/.test(s))                 add('SALES');
  if (/\bhr\b|บุคคล/.test(s))             add('HR');
  if (/pick|เบิก/.test(s))                add('PICKER');
  return out;
}

/** สิทธิ์หลัก (ไว้โชว์ชื่อ) = ตัวที่สูงสุดตามลำดับใน ROLES */
function normRole_(v){
  var rs = rolesOf_(v);
  if (!rs.length) return 'GUEST';
  for (var i = 0; i < ROLES.length; i++) if (rs.indexOf(ROLES[i]) >= 0) return ROLES[i];
  return 'GUEST';
}

function getUsers_(){
  var cache = CacheService.getScriptCache();
  var hit = cache.get('CLAIM_USERS');
  if (hit) { try { return JSON.parse(hit); } catch(e){} }

  var rows = readTab_(CFG.MASTER, 'USERS') || [];
  if (!rows.length) return [];
  var hr  = findHeaderRow_(rows, ['email','อีเมล'], 5);
  var hdr = rows[hr];

  // ⚠️ ต้องหา 'role for claim' ให้เจอก่อน ไม่งั้นไปโดน 'role for NOVA BOM'
  var iRole = colIdx_(hdr, ['role for claim','role claim','บทบาทเคลม']);
  if (iRole < 0) iRole = colIdx_(hdr, ['role','บทบาท','สิทธิ์']);

  var iMail = colIdx_(hdr, ['email','อีเมล']);
  var iName = colIdx_(hdr, ['display_name','display name','ชื่อ']);
  var iAct  = colIdx_(hdr, ['active','ใช้งาน']);
  var iPin  = colIdx_(hdr, ['pin','รหัสผ่าน']);
  var iEmp  = colIdx_(hdr, ['รหัสพนักงาน','employee','emp']);

  var out = [];
  for (var r = hr + 1; r < rows.length; r++){
    var v = rows[r];
    if (!norm_(v[iMail]) && !norm_(iEmp >= 0 ? v[iEmp] : '')) continue;
    out.push({
      email : norm_(iMail >= 0 ? v[iMail] : '').toLowerCase(),
      name  : norm_(iName >= 0 ? v[iName] : ''),
      role  : normRole_(iRole >= 0 ? v[iRole] : ''),
      roles : rolesOf_(iRole >= 0 ? v[iRole] : []),
      roleRaw: norm_(iRole >= 0 ? v[iRole] : ''),
      active: norm_(iAct >= 0 ? v[iAct] : 'Y').toUpperCase() !== 'N',
      pin   : norm_(iPin >= 0 ? v[iPin] : ''),
      emp   : norm_(iEmp >= 0 ? v[iEmp] : '')
    });
  }
  cache.put('CLAIM_USERS', JSON.stringify(out), 300);
  return out;
}

function getEmail_(){
  try { return norm_(Session.getActiveUser().getEmail()).toLowerCase(); } catch(e){ return ''; }
}

/** เข้าระบบด้วยรหัสพนักงาน + PIN (ต้องตรงทั้งคู่ = กันใช้ PIN ของเพื่อน) */
function loginEmpPin(emp, pin){
  emp = norm_(emp); pin = norm_(pin);
  if (!emp || !pin) return { ok:false, msg:'กรอกรหัสพนักงานและ PIN ให้ครบ' };
  var us = getUsers_();
  for (var i = 0; i < us.length; i++){
    if (us[i].emp && us[i].emp === emp && us[i].pin && us[i].pin === pin){
      if (!us[i].active) return { ok:false, msg:'รหัสพนักงานนี้ถูกปิดการใช้งานแล้ว' };
      if (us[i].role === 'GUEST') return { ok:false, msg:'ยังไม่ได้กำหนดสิทธิ์งานเคลมให้รหัสนี้ (ช่อง role for Claim ในชีต USERS ว่างอยู่)' };
      log_('login', emp, us[i].name + ' / ' + us[i].roles.join(','));
      return { ok:true, name:us[i].name, role:us[i].role, roles:us[i].roles, emp:us[i].emp };
    }
  }
  return { ok:false, msg:'รหัสพนักงานหรือ PIN ไม่ถูกต้อง' };
}

/** ใครเป็นใคร — เชื่อ PIN ก่อน แล้วค่อย fallback อีเมลบริษัท (บทเรียน v0.38 ของ NOVA) */
function whoAmI_(auth){
  if (auth && auth.emp && auth.pin){
    var r = loginEmpPin(auth.emp, auth.pin);
    if (r.ok) return { name:r.name, role:r.role, emp:r.emp };
  }
  var em = getEmail_();
  if (em && AUTO_ADMIN.indexOf(em) >= 0) return { name:em.split('@')[0], role:'ADMIN', roles:['ADMIN'], emp:'' };
  return { name:'', role:'GUEST', roles:[], emp:'' };
}

/** เข้าระบบด้วยบัญชี Google ของบริษัท (เบียร์ + พี่แบล็ค) — ไม่ต้องมี PIN
 *  คนอื่นที่ไม่ใช่ 2 อีเมลนี้ จะได้ GUEST เสมอ = ต้องใส่ PIN (ปลอดภัยเหมือน NOVA v0.27.2) */
function loginByEmail(){
  var em = getEmail_();
  if (em && AUTO_ADMIN.indexOf(em) >= 0){
    var nm = em.split('@')[0];
    var us = getUsers_();
    for (var i = 0; i < us.length; i++) if (us[i].email === em && us[i].name) { nm = us[i].name; break; }
    return { ok:true, name:nm, role:'ADMIN', roles:['ADMIN'], emp:'', via:'google' };
  }
  return { ok:false, email:em };
}

function getContext(auth){
  var me = whoAmI_(auth);
  return { version:VERSION, name:me.name, role:me.role, roles:me.roles || [], emp:me.emp, year:yearBE_() };
}

/* ─────────── ข้อมูลจ๊อบ (อ่านจาก MASTER — All WIP JT/JM) ─────────── */
function wipRows_(){
  var cache = CacheService.getScriptCache();
  var hit = cache.get('CLAIM_WIP');
  if (hit) { try { return JSON.parse(hit); } catch(e){} }

  var rows = readTab_(CFG.MASTER, 'All WIP JT/JM') || [];
  if (!rows.length) return [];
  var hr  = findHeaderRow_(rows, ['job code','jobcode'], 8);
  var hdr = rows[hr];
  var iJob   = colIdx_(hdr, ['job code','jobcode']);
  var iName  = colIdx_(hdr, ['job name','jobname']);
  var iDue   = colIdx_(hdr, ['latest date delivery','กำหนดส่งมอบ']);
  var iType  = colIdx_(hdr, ['ประเภทงาน']);
  var iModel = colIdx_(hdr, ['model']);
  var iGCode = colIdx_(hdr, ['goodcode']);
  var iGName = colIdx_(hdr, ['goodname']);
  var iLoc   = colIdx_(hdr, ['ในประเทศ','ต่างประเทศ']);

  var out = [];
  for (var r = hr + 1; r < rows.length; r++){
    var v = rows[r];
    var job = norm_(iJob >= 0 ? v[iJob] : '');
    if (!/^[A-Z]{2,4}-\d\d\/\d+/.test(job)) continue;
    out.push({
      jobNo : job,
      jobName : norm_(iName  >= 0 ? v[iName]  : ''),
      due     : fmtDMY_(iDue >= 0 ? v[iDue]   : ''),
      type    : norm_(iType  >= 0 ? v[iType]  : '') || typeFromJobNo_(job),
      model   : norm_(iModel >= 0 ? v[iModel] : ''),
      goodcode: norm_(iGCode >= 0 ? v[iGCode] : ''),
      goodname: norm_(iGName >= 0 ? v[iGName] : ''),
      loc     : norm_(iLoc   >= 0 ? v[iLoc]   : '')
    });
  }
  cache.put('CLAIM_WIP', JSON.stringify(out), 600);
  return out;
}

function typeFromJobNo_(job){
  var m = norm_(job).toUpperCase().match(/^([A-Z]{2,4})-/);
  return m ? m[1] : '';
}

/** ใส่เลขจ๊อบแล้วเด้งข้อมูลรถให้อัตโนมัติ */
function lookupJob(jobNo){
  var job = norm_(jobNo).toUpperCase();
  if (!job) return { found:false };
  var all = wipRows_();
  for (var i = 0; i < all.length; i++){
    if (all[i].jobNo.toUpperCase() === job){
      var w = all[i];
      return {
        found:true, jobNo:w.jobNo, jobName:w.jobName, due:w.due, type:w.type,
        model: w.model || w.goodcode, goodname:w.goodname, loc:w.loc
      };
    }
  }
  return { found:false, type:typeFromJobNo_(job) };
}

/** รายชื่อจ๊อบสำหรับ dropdown (กรองตามประเภทงานได้) */
function listJobs(type){
  var t = norm_(type).toUpperCase();
  var all = wipRows_(), out = [];
  for (var i = 0; i < all.length; i++){
    if (t && typeFromJobNo_(all[i].jobNo).toUpperCase() !== t) continue;
    out.push({ jobNo:all[i].jobNo, jobName:all[i].jobName });
  }
  out.sort(function(a,b){ return a.jobNo < b.jobNo ? 1 : -1; });   // ใหม่ก่อน
  return out.slice(0, 800);
}

/** รายชื่อผู้ขาย (อ่านจาก MASTER แท็บ VENDORS — หัวตารางอยู่แถว 2) */
function listVendors(){
  var cache = CacheService.getScriptCache();
  var hit = cache.get('CLAIM_VENDORS');
  if (hit) { try { return JSON.parse(hit); } catch(e){} }
  var rows = readTab_(CFG.MASTER, 'VENDORS') || [];
  if (!rows.length) return [];
  var hr = findHeaderRow_(rows, ['vendorname','vendor name','ชื่อผู้ขาย'], 6);
  var iV = colIdx_(rows[hr], ['vendorname','vendor name','ชื่อผู้ขาย']);
  var out = [];
  for (var r = hr + 1; r < rows.length; r++){
    var v = norm_(iV >= 0 ? rows[r][iV] : '');
    if (v && out.indexOf(v) < 0) out.push(v);
  }
  out.sort();
  CacheService.getScriptCache().put('CLAIM_VENDORS', JSON.stringify(out), 1800);
  return out;
}

/* ─────────── ฐานข้อมูลของเราเอง (STT-CLAIM-DB) ─────────── */
/* โครง 1 ไฟล์ แท็บแยกตามปี พ.ศ. → ขึ้นปีใหม่ระบบสร้างแท็บเองอัตโนมัติ ใช้ได้ 10-20 ปี */

var HDR_CLAIM = ['เลขที่เอกสาร','ชนิดเอกสาร','วันที่','ประเภทการเคลม','พื้นที่','ชนิดงานต่างประเทศ',
  'เลขที่ JOB','ชื่อลูกค้า','MODEL','CHASSIS NO. (STT)','CHASSIS NO. (ผู้ผลิต)','SERIAL NO.',
  'JMC ที่ผูก','เลขใบส่งมอบ','ผู้ขอเคลม','แผนก','วันที่ต้องการของ',
  'สกุลเงิน','อัตราแลกเปลี่ยน','เรท ณ วันที่','กรณีเรียกเก็บ',
  'สถานะ','ผลการเคลม','รายละเอียดผลการเคลม','หมายเหตุจาก Supplier',
  'โฟลเดอร์รูป','สร้างโดย','สร้างเมื่อ','แก้ไขล่าสุด'];

var HDR_ITEM = ['เลขที่เอกสาร','ลำดับ','รหัสสินค้า','ชื่อสินค้า','รายละเอียด (ไทย)','รายละเอียด (EN)',
  'จำนวน','หน่วย','PO','Supplier','วันรับสินค้า','ต้นทุน/หน่วย','กำไร','ราคาเรียกเก็บ/หน่วย','ผลตรวจ','หมายเหตุ'];

var HDR_LAB  = ['เลขที่เอกสาร','ลำดับ','รายละเอียด (ไทย)','รายละเอียด (EN)','มาจากข้อ','Supplier','จำนวนเงิน'];

var HDR_ACK  = ['เลขที่เอกสาร','ขั้น','บทบาท','ชื่อผู้ลงนาม','ตำแหน่ง','วันเวลา','หมายเหตุ'];

var HDR_LOG  = ['วันเวลา','ผู้ใช้','การกระทำ','อ้างอิง','รายละเอียด'];

/* ═══ ความเร็ว (v0.4.0) ═══
 * ปัญหาเดิม: เปิดหน้าแรก 1 ครั้ง ระบบสั่ง SpreadsheetApp.openById() ถึง 6-7 รอบ
 *   (dbId_ เปิดทิ้งเพื่อเช็คว่าไฟล์มีจริง 1 · db_ 2 ครั้ง · photoTab_ 3 ครั้ง · inspDb_ 1)
 *   openById แต่ละครั้งกิน 0.5-1.5 วินาที → ยังไม่มีข้อมูลเลยก็ช้าแล้ว
 * แก้: จำไว้ในตัวแปรกลาง ภายใน 1 คำสั่งเปิดไฟล์ครั้งเดียวพอ
 *   (ตัวแปรกลางของ Apps Script อยู่แค่ในคำสั่งนั้น คำสั่งถัดไปเริ่มใหม่ = ไม่มีข้อมูลค้าง) */
var _DBID = null, _SS = null, _DB = null, _IDB = null, _PT = null;

function ss_(){
  if (!_SS) _SS = SpreadsheetApp.openById(dbId_());
  return _SS;
}

function dbId_(){
  if (_DBID) return _DBID;
  var pr = PropertiesService.getScriptProperties();
  var id = norm_(pr.getProperty(CFG.DB_PROP));
  if (id){ _DBID = id; return id; }        // เชื่อค่าที่เก็บไว้ · ถ้าไฟล์หายจริง openById จะ error ให้เห็นเอง
  var ss = SpreadsheetApp.create(CFG.DB_NAME);
  id = ss.getId();
  try {
    var f = DriveApp.getFileById(id);
    DriveApp.getFolderById(CFG.FOLDER_ROOT).addFile(f);
    DriveApp.getRootFolder().removeFile(f);
  } catch(e){}
  pr.setProperty(CFG.DB_PROP, id);
  _DBID = id;
  return id;
}

function ensureTab_(ss, name, header){
  var sh = ss.getSheetByName(name);
  if (!sh){
    sh = ss.insertSheet(name);
    sh.getRange(1,1,1,header.length).setValues([header])
      .setFontWeight('bold').setBackground('#efefef');
    sh.setFrozenRows(1);
  } else if (sh.getLastRow() === 0){
    sh.getRange(1,1,1,header.length).setValues([header]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function db_(){
  if (_DB) return _DB;
  var ss = ss_();
  var be = yearBE_();
  var o = {
    ss     : ss,
    claims : ensureTab_(ss, 'CLAIMS_' + be, HDR_CLAIM),
    items  : ensureTab_(ss, 'ITEMS_'  + be, HDR_ITEM),
    labour : ensureTab_(ss, 'LABOUR_' + be, HDR_LAB),
    ack    : ensureTab_(ss, 'ACK_'    + be, HDR_ACK),
    log    : ensureTab_(ss, 'LOG',          HDR_LOG)
  };
  _DB = o;
  return o;
}

function log_(action, ref, detail){
  try {
    var me = getEmail_() || 'unknown';
    db_().log.appendRow([nowStamp_(), me, norm_(action), norm_(ref), norm_(detail)]);
  } catch(e){}
}

/* ─────────── เลขที่เอกสาร ─────────── */
/*  CLM-YY/NNNN = ใบเคลม (ใบแจ้งเคลม + ใบเรียกเก็บ ใช้เลขเดียวกัน)
 *  INS-YY/NNNN = ใบตรวจรับแท็งค์ (คนละชุด ห้ามรวมกัน)                     */
function nextDocNo_(prefix){
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var d = db_(), be = yearBE_(), yy = yy_(be);
    var lr = d.claims.getLastRow(), max = 0;
    if (lr > 1){
      var col = d.claims.getRange(2, 1, lr - 1, 1).getDisplayValues();
      var re = new RegExp('^' + prefix + '-' + yy + '\\/(\\d+)$');
      for (var i = 0; i < col.length; i++){
        var m = norm_(col[i][0]).match(re);
        if (m) max = Math.max(max, parseInt(m[1], 10));
      }
    }
    var n = String(max + 1);
    while (n.length < 4) n = '0' + n;
    return prefix + '-' + yy + '/' + n;
  } finally { lock.releaseLock(); }
}

/* ─────────── สิทธิ์ ─────────── */
function requireLogin_(auth){
  var me = whoAmI_(auth);
  if (me.role === 'GUEST') throw new Error('กรุณาเข้าสู่ระบบก่อน');
  return me;
}
function requireAny_(auth, roles){
  var me = requireLogin_(auth);
  var mine = me.roles && me.roles.length ? me.roles : [me.role];
  if (mine.indexOf('ADMIN') >= 0) return me;
  for (var i = 0; i < mine.length; i++) if (roles.indexOf(mine[i]) >= 0) return me;
  throw new Error('สิทธิ์ของคุณ (' + mine.join(', ') + ') ทำรายการนี้ไม่ได้');
}

/* ─────────── สร้าง / อ่าน / บันทึก ใบเคลม ─────────── */
function claimRowObj_(hdr, row){
  var o = {};
  for (var i = 0; i < hdr.length; i++) o[hdr[i]] = norm_(row[i]);
  return o;
}
function findClaimRow_(sh, docNo){
  var lr = sh.getLastRow(); if (lr < 2) return -1;
  var col = sh.getRange(2,1,lr-1,1).getDisplayValues();
  for (var i = 0; i < col.length; i++) if (norm_(col[i][0]) === docNo) return i + 2;
  return -1;
}

/** เปิดใบแจ้งเคลมใหม่ */
function createClaim(h, auth){
  var me = requireAny_(auth, ['PRODUCTION','QC','DESIGN','STORE','PURCHASE','APPROVER']);
  h = h || {};
  if (!norm_(h.jobNo)) throw new Error('ต้องระบุเลขที่ JOB');

  var docNo = nextDocNo_('CLM');
  var d = db_();
  var row = [
    docNo, 'CLAIM', fmtDMY_(new Date()), norm_(h.claimType) || 'after', norm_(h.area) || 'dom', norm_(h.foreignKind),
    norm_(h.jobNo).toUpperCase(), norm_(h.jobName), norm_(h.model), norm_(h.chassisStt), norm_(h.chassisMaker), norm_(h.serialNo),
    norm_(h.jmc), norm_(h.deliveryNote), me.name, norm_(h.dept), fmtDMY_(h.wantDate),
    norm_(h.currency), h.rate ? money_(h.rate) : '', fmtDMY_(h.rateDate), '',
    'DRAFT', '', '', '',
    '', me.name, nowStamp_(), nowStamp_()
  ];
  d.claims.appendRow(row);
  saveItems_(d, docNo, h.items || []);
  log_('createClaim', docNo, norm_(h.jobNo));
  return { ok:true, docNo:docNo };
}

function saveItems_(d, docNo, items){
  // ลบของเดิมของใบนี้ก่อน แล้วเขียนใหม่ทั้งชุด (ใบเดียวรายการไม่เยอะ ทำแบบนี้ปลอดภัยกว่า merge)
  var lr = d.items.getLastRow();
  if (lr > 1){
    var col = d.items.getRange(2,1,lr-1,1).getDisplayValues();
    for (var i = col.length - 1; i >= 0; i--){
      if (norm_(col[i][0]) === docNo) d.items.deleteRow(i + 2);
    }
  }
  var out = [];
  for (var k = 0; k < items.length; k++){
    var it = items[k] || {};
    if (!norm_(it.name) && !norm_(it.code)) continue;
    out.push([ docNo, out.length + 1, norm_(it.code), norm_(it.name),
      norm_(it.th), norm_(it.en), num_(it.qty), norm_(it.unit),
      norm_(it.po), norm_(it.supplier), fmtDMY_(it.recv),
      it.cost === '' || it.cost == null ? '' : money_(it.cost),
      norm_(it.margin),
      it.price === '' || it.price == null ? '' : money_(it.price),
      norm_(it.acc), norm_(it.note) ]);
  }
  if (out.length) d.items.getRange(d.items.getLastRow() + 1, 1, out.length, HDR_ITEM.length).setValues(out);
  return out.length;
}

/** แก้ไขใบเคลมที่เปิดไว้แล้ว */
function saveClaim(docNo, h, auth){
  var me = requireAny_(auth, ['PRODUCTION','QC','DESIGN','STORE','PURCHASE','APPROVER']);
  docNo = norm_(docNo);
  var d = db_(), r = findClaimRow_(d.claims, docNo);
  if (r < 0) throw new Error('ไม่พบเอกสาร ' + docNo);

  var hdr = d.claims.getRange(1,1,1,HDR_CLAIM.length).getDisplayValues()[0];
  function put(name, val){
    var i = hdr.indexOf(name);
    if (i >= 0) d.claims.getRange(r, i + 1).setValue(val);
  }
  put('ประเภทการเคลม', norm_(h.claimType));
  put('พื้นที่', norm_(h.area));
  put('ชนิดงานต่างประเทศ', norm_(h.foreignKind));
  put('เลขที่ JOB', norm_(h.jobNo).toUpperCase());
  put('ชื่อลูกค้า', norm_(h.jobName));
  put('MODEL', norm_(h.model));
  put('CHASSIS NO. (STT)', norm_(h.chassisStt));
  put('CHASSIS NO. (ผู้ผลิต)', norm_(h.chassisMaker));
  put('SERIAL NO.', norm_(h.serialNo));
  put('JMC ที่ผูก', norm_(h.jmc));
  put('เลขใบส่งมอบ', norm_(h.deliveryNote));
  put('แผนก', norm_(h.dept));
  put('วันที่ต้องการของ', fmtDMY_(h.wantDate));
  put('สกุลเงิน', norm_(h.currency));
  put('อัตราแลกเปลี่ยน', h.rate === '' || h.rate == null ? '' : money_(h.rate));
  put('เรท ณ วันที่', fmtDMY_(h.rateDate));
  put('หมายเหตุจาก Supplier', norm_(h.supplierRemark));
  put('แก้ไขล่าสุด', nowStamp_());
  saveItems_(d, docNo, h.items || []);
  log_('saveClaim', docNo, me.name);
  return { ok:true, docNo:docNo };
}

/** อ่านใบเคลม 1 ใบ (หัว + รายการ) */
function getClaim(docNo, auth){
  requireLogin_(auth);
  docNo = norm_(docNo);
  var d = db_();
  var lr = d.claims.getLastRow(); if (lr < 2) return null;
  var hdr = d.claims.getRange(1,1,1,HDR_CLAIM.length).getDisplayValues()[0];
  var r = findClaimRow_(d.claims, docNo);
  if (r < 0) return null;
  var head = claimRowObj_(hdr, d.claims.getRange(r,1,1,HDR_CLAIM.length).getDisplayValues()[0]);

  var items = [];
  var ilr = d.items.getLastRow();
  if (ilr > 1){
    var iv = d.items.getRange(2,1,ilr-1,HDR_ITEM.length).getDisplayValues();
    for (var i = 0; i < iv.length; i++){
      if (norm_(iv[i][0]) !== docNo) continue;
      items.push({ seq:num_(iv[i][1]), code:iv[i][2], name:iv[i][3], th:iv[i][4], en:iv[i][5],
        qty:num_(iv[i][6]), unit:iv[i][7], po:iv[i][8], supplier:iv[i][9], recv:iv[i][10],
        cost:iv[i][11], margin:iv[i][12], price:iv[i][13], acc:iv[i][14], note:iv[i][15] });
    }
  }
  items.sort(function(a,b){ return a.seq - b.seq; });
  return { head:head, items:items, photos:listPhotos(docNo, auth) };
}

/** ทะเบียนเอกสารทั้งหมด */
function listClaims(filter, auth){
  requireLogin_(auth);
  filter = filter || {};
  var d = db_(), lr = d.claims.getLastRow();
  if (lr < 2) return [];
  var hdr = d.claims.getRange(1,1,1,HDR_CLAIM.length).getDisplayValues()[0];
  var rows = d.claims.getRange(2,1,lr-1,HDR_CLAIM.length).getDisplayValues();
  var pho = photoCoverage_();          // v0.2.0 — รูปครบไหม ดูได้ตั้งแต่หน้าทะเบียน
  var out = [];
  for (var i = rows.length - 1; i >= 0; i--){      // ใหม่อยู่บน
    var o = claimRowObj_(hdr, rows[i]);
    if (filter.jobNo && o['เลขที่ JOB'].toUpperCase() !== norm_(filter.jobNo).toUpperCase()) continue;
    if (filter.type && typeFromJobNo_(o['เลขที่ JOB']).toUpperCase() !== norm_(filter.type).toUpperCase()) continue;
    if (filter.q){
      var q = norm_(filter.q).toLowerCase();
      var hay = (o['เลขที่เอกสาร'] + ' ' + o['เลขที่ JOB'] + ' ' + o['ชื่อลูกค้า']).toLowerCase();
      if (hay.indexOf(q) < 0) continue;
    }
    out.push({
      docNo:o['เลขที่เอกสาร'], docKind:o['ชนิดเอกสาร'], date:o['วันที่'],
      claimType:o['ประเภทการเคลม'], area:o['พื้นที่'],
      jobNo:o['เลขที่ JOB'], jobName:o['ชื่อลูกค้า'], model:o['MODEL'],
      status:o['สถานะ'], by:o['สร้างโดย'],
      nItem: (pho.item[o['เลขที่เอกสาร']] || 0),
      nPhoto:(pho.photo[o['เลขที่เอกสาร']] || 0),
      nNoPhoto:(pho.noPhoto[o['เลขที่เอกสาร']] === undefined
                  ? (pho.item[o['เลขที่เอกสาร']] || 0)
                  : pho.noPhoto[o['เลขที่เอกสาร']])
    });
    if (out.length >= 500) break;
  }
  return out;
}

/** หน้าแรก: นับงานคร่าว ๆ */
function getHome(auth){
  var me = requireLogin_(auth);
  var list = [];
  try { list = listClaims({}, auth); } catch(e){}
  var draft = 0;
  for (var i = 0; i < list.length; i++) if (list[i].status === 'DRAFT') draft++;
  return { version:VERSION, name:me.name, role:me.role, roles:me.roles || [], total:list.length, draft:draft, year:yearBE_() };
}

/** ล้างแคช (ปุ่มรีเฟรช) */
function clearCaches(){
  var c = CacheService.getScriptCache();
  c.removeAll(['CLAIM_USERS','CLAIM_WIP','CLAIM_VENDORS']);
  return 'ล้างแคชแล้ว';
}

/** ให้เบียร์กดดูได้ว่าไฟล์ฐานข้อมูลอยู่ไหน */
function getDbLink(auth){
  requireLogin_(auth);
  return 'https://docs.google.com/spreadsheets/d/' + dbId_() + '/edit';
}

/* ═══════════════════════════════════════════════════════════════
   v0.2.0 — ระบบรูปถ่าย  (รูป = หลักฐาน · ไม่มีรูป เคลมไม่ได้)
   วิธีทำงาน: ย่อรูปในเครื่องก่อนส่ง → อัปขึ้น Drive โฟลเดอร์
   "รูป-วิดีโอ / <เลขจ๊อบ> / <เลขที่เอกสาร>" → เก็บทะเบียนไว้ในไฟล์ของเราเอง
   (ใช้วิธีเดียวกับ saveConsignPhoto ของ NOVA ที่ใช้งานจริงมาแล้ว)
   ═══════════════════════════════════════════════════════════════ */

var HDR_PHOTO = ['เลขที่เอกสาร','รายการที่','ลำดับรูป','ชื่อไฟล์','file id','ลิงก์รูป','ลิงก์เปิดเต็ม','ใช้งาน','โดย','เมื่อ'];

function photoTab_(){
  if (!_PT) _PT = ensureTab_(ss_(), 'PHOTOS_' + yearBE_(), HDR_PHOTO);
  return _PT;
}

/** โฟลเดอร์ Drive: รูป-วิดีโอ / <เลขจ๊อบ> / <เลขที่เอกสาร>  (ชื่อโฟลเดอร์ใช้ / ได้ ไม่ต้องแปลง) */
function mediaFolder_(jobNo, docNo){
  var root = DriveApp.getFolderById(CFG.FOLDER_MEDIA);
  var jn = norm_(jobNo) || 'ไม่ระบุจ๊อบ';
  var it = root.getFoldersByName(jn);
  var jf = it.hasNext() ? it.next() : root.createFolder(jn);
  var dn = norm_(docNo) || 'ไม่ระบุเอกสาร';
  var it2 = jf.getFoldersByName(dn);
  return it2.hasNext() ? it2.next() : jf.createFolder(dn);
}

/** ลิงก์โฟลเดอร์ของใบนี้ (ให้กดเปิด Drive ไปอัปวิดีโอใหญ่ ๆ เอง) */
function getMediaFolderLink(docNo, jobNo, auth){
  requireLogin_(auth);
  return 'https://drive.google.com/drive/folders/' + mediaFolder_(jobNo, docNo).getId();
}

/** บันทึกรูป 1 ใบ — dataUrl มาจากฝั่งเว็บที่ย่อรูปแล้ว */
function savePhoto(docNo, jobNo, seq, dataUrl, fname, auth){
  var me = requireLogin_(auth);
  docNo = norm_(docNo); jobNo = norm_(jobNo); seq = num_(seq);
  if (!docNo) throw new Error('ยังไม่มีเลขที่เอกสาร — บันทึกใบเคลมก่อนแล้วค่อยแนบรูป');

  var m = String(dataUrl || '').match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (!m) throw new Error('ไฟล์รูปไม่ถูกต้อง');

  var safe = docNo.replace(/[^\w]+/g,'-') + '_ข้อ' + seq + '_' + new Date().getTime() + '.jpg';
  var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], norm_(fname) || safe);
  var f = mediaFolder_(jobNo, docNo).createFile(blob);
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e){}

  var id  = f.getId();
  var thumb = 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1000';
  var view  = 'https://drive.google.com/file/d/' + id + '/view';

  var sh = photoTab_();
  var no = 1, lr = sh.getLastRow();
  if (lr > 1){
    var v = sh.getRange(2,1,lr-1,3).getDisplayValues();
    for (var i = 0; i < v.length; i++){
      if (norm_(v[i][0]) === docNo && num_(v[i][1]) === seq) no = Math.max(no, num_(v[i][2]) + 1);
    }
  }
  sh.appendRow([docNo, seq, no, f.getName(), id, thumb, view, 'Y', me.name, nowStamp_()]);
  log_('savePhoto', docNo, 'ข้อ ' + seq + ' · ' + f.getName());
  return { ok:true, id:id, thumb:thumb, view:view, seq:seq, no:no };
}

/** รูปทั้งหมดของใบนี้ (จัดกลุ่มตามรายการ) */
function listPhotos(docNo, auth){
  requireLogin_(auth);
  docNo = norm_(docNo);
  var sh = photoTab_(), lr = sh.getLastRow();
  var out = {};
  if (lr < 2) return out;
  var v = sh.getRange(2,1,lr-1,HDR_PHOTO.length).getDisplayValues();
  for (var i = 0; i < v.length; i++){
    if (norm_(v[i][0]) !== docNo) continue;
    if (norm_(v[i][7]).toUpperCase() === 'N') continue;          // ถูกเอาออกแล้ว
    var s = String(num_(v[i][1]));
    if (!out[s]) out[s] = [];
    out[s].push({ id:v[i][4], thumb:v[i][5], view:v[i][6], name:v[i][3], by:v[i][8], at:v[i][9] });
  }
  return out;
}

/** เอารูปออกจากใบ — ไม่ลบไฟล์ทิ้ง แค่ปิดใช้งาน (ข้อมูลห้ามหาย) */
function removePhoto(docNo, fileId, auth){
  var me = requireLogin_(auth);
  docNo = norm_(docNo); fileId = norm_(fileId);
  var sh = photoTab_(), lr = sh.getLastRow();
  if (lr < 2) return { ok:false };
  var v = sh.getRange(2,1,lr-1,HDR_PHOTO.length).getDisplayValues();
  for (var i = 0; i < v.length; i++){
    if (norm_(v[i][0]) === docNo && norm_(v[i][4]) === fileId){
      sh.getRange(i+2, 8).setValue('N');
      log_('removePhoto', docNo, fileId + ' โดย ' + me.name);
      return { ok:true };
    }
  }
  return { ok:false };
}

/** นับรูปต่อรายการ — ใช้ตรวจว่า "ทุกรายการมีรูปครบไหม" ก่อนส่งเคลม */
function photoCheck(docNo, auth){
  requireLogin_(auth);
  var c = getClaim(docNo, auth);
  if (!c) return { ok:false, msg:'ไม่พบเอกสาร' };
  var ph = listPhotos(docNo, auth);
  var missing = [];
  for (var i = 0; i < c.items.length; i++){
    var s = String(c.items[i].seq);
    if (!ph[s] || !ph[s].length) missing.push(c.items[i].seq + '. ' + c.items[i].name);
  }
  return {
    ok: missing.length === 0,
    missing: missing,
    msg: missing.length ? ('ยังไม่มีรูปหลักฐาน ' + missing.length + ' รายการ : ' + missing.join(' · ')) : 'มีรูปครบทุกรายการแล้ว'
  };
}

/* photoCoverage_ ย้ายไปอยู่ CLAIM-More.js แล้ว (v0.3.0) */

