/**
 * STT CLAIM · โมดูลตรวจรับสินค้า (Inspection)
 * ─────────────────────────────────────────────────────────────
 * เลขที่เอกสาร INS-YY/NNNN — คนละชุดกับ CLM (ห้ามรวมกัน)
 * ใช้ได้ทั้งงานต่างประเทศ (แท็งค์นำเข้า) และงานในประเทศ
 *   เบียร์ 3 ก.ย. 2569: "งาน Inspec ภายในประเทศ ก็มีนะ
 *                        บางอันที่มันเป็นแบบสินค้าที่ต้องตรวจโดยเฉพาะ"
 *   → เช็คลิสต์จึงเป็น "แม่แบบ" เลือกได้ ไม่ใช่ชุดเดียวตายตัว
 * รูป: ใช้ระบบเดียวกับใบเคลม (ชีต PHOTOS_ + โฟลเดอร์ Drive เดียวกัน)
 *      ไม่เขียนระบบรูปซ้ำ — ตรวจกับเคลมใช้กลไกเดียวกันตามที่ตกลงไว้
 */

var HDR_INSP = ['เลขที่เอกสาร','ชนิดเอกสาร','วันที่','สถานที่ผลิต','ชนิดงาน',
  'เลขที่ JOB','ชื่อลูกค้า','MODEL','CHASSIS NO. (STT)','CHASSIS NO. (ผู้ผลิต)','SERIAL NO.',
  'แม่แบบเช็คลิสต์','PO','Supplier','วันรับสินค้า','ผู้ตรวจ',
  'สถานะ','ใบเคลมที่ออกจากใบนี้','หมายเหตุ','สร้างโดย','สร้างเมื่อ','แก้ไขล่าสุด',
  /* ⚠️ เพิ่มทีหลัง "ต่อท้ายเท่านั้น" ห้ามแทรกกลาง — ensureCols_ เขียนทับหัวตาราง แต่ไม่ย้ายข้อมูลตาม
     เบียร์ 8 ก.ย. 2569: "ต้องมี E. No หลัง CHASSIS ผู้ผลิต"
     (ตำแหน่งบนหน้าจอวางไว้หลัง CHASSIS ผู้ผลิต ไม่ต้องตรงกับลำดับคอลัมน์ในชีต) */
  'E. No.','รหัสแม่แบบ'];

/* ═══ ขั้นตอนของใบตรวจรับ (v0.9.2) ═══════════════════════════
 * เบียร์: "ในเรื่องของ Inspection ก็เหมือนกัน" — คอนเซ็ปต์เดียวกับใบเคลม
 *   1 ร่าง · QC ตรวจ  (สโตร์/จัดซื้อยังไม่เห็น · ถ่ายรูปหน้างานแล้วค่อยมากรอกต่อได้)
 *   2 รอผู้บังคับบัญชาอนุมัติ  (อนุมัติ หรือ ตีกลับให้ตรวจใหม่)
 *   3 อนุมัติแล้ว → ถึงจะส่งข้อที่ไม่ผ่านไปเปิดใบเคลมได้                        */
var INS_STAGES = [
  { key:'IDRAFT', no:1, name:'ร่าง · QC ตรวจ', who:'QC / Production', draft:true,
    roles:['QC','PRODUCTION','DESIGN'],
    todo:'ตรวจทีละหัวข้อ ติ๊ก Acc / Un-Acc พร้อมถ่ายรูป · เซฟค้างไว้ก่อนได้',
    next:'IAPPROVAL', nextLabel:'➜ ส่งขออนุมัติ', lineKey:'APPROVER' },
  { key:'IAPPROVAL', no:2, name:'รอผู้บังคับบัญชาอนุมัติ', who:'ผู้บังคับบัญชา (Approver)',
    roles:['APPROVER'],
    todo:'ตรวจว่าผลตรวจครบและถูกต้องไหม · อนุมัติแล้วถึงเปิดใบเคลมจากข้อที่ไม่ผ่านได้',
    next:'IDONE', nextLabel:'✓ อนุมัติผลตรวจ', lineKey:'QC' },
  { key:'IDONE', no:3, name:'อนุมัติแล้ว', who:'—', roles:[],
    todo:'ผลตรวจถูกอนุมัติแล้ว · ข้อที่ Un-Acc กดส่งไปเปิดใบเคลมได้', next:'', nextLabel:'', lineKey:'' }
];
/* ลายเซ็นใบตรวจ — หลักการเดียวกับใบเคลม: ใครกดขั้นไหน ชื่อ-แผนก-วันเวลาขึ้นบนเอกสารเอง
   เอกสารที่ปริ้นออกมาต้องบอกได้ว่า "ใครตรวจ ใครอนุมัติ เมื่อไหร่" ไม่งั้นเก็บไว้ 10-20 ปีก็พิสูจน์อะไรไม่ได้ */
var INS_SIGN = ['ลายเซ็น ผู้ตรวจ','ลายเซ็น ผู้อนุมัติผลตรวจ'];
var INS_SIGN_SLOT = { IDRAFT:'ลายเซ็น ผู้ตรวจ', IAPPROVAL:'ลายเซ็น ผู้อนุมัติผลตรวจ' };
var INS_SIGN_ROLE = { 'ลายเซ็น ผู้ตรวจ':'ผู้ตรวจ (QC)', 'ลายเซ็น ผู้อนุมัติผลตรวจ':'ผู้อนุมัติผลตรวจ' };

var HDR_INSP_FLOW = ['ขั้นตอน','รอใครทำ','เหตุผลที่ตีกลับ','ตีกลับโดย','ตีกลับเมื่อ','ประวัติขั้นตอน'].concat(INS_SIGN);

/** ประทับลายเซ็นของขั้นที่ "เพิ่งทำเสร็จ" — เซ็นแล้วไม่ทับซ้ำ */
function signInsStage_(sh, row, stageKey, me){
  var name = INS_SIGN_SLOT[norm_(stageKey)];
  if (!name) return '';
  var c = colOfI_(name);
  if (c < 0) return '';
  var cur = norm_(sh.getRange(row, c).getDisplayValue());
  if (cur) return cur;
  var txt = me.name + (me.dept ? ' · ' + me.dept : '') + ' · ' + nowStamp_();
  sh.getRange(row, c).setValue(txt);
  return txt;
}

/** อ่านลายเซ็นทั้งใบ ส่งให้หน้าปริ้น */
function insSigns_(sh, row){
  var out = [];
  for (var i = 0; i < INS_SIGN.length; i++){
    var c = colOfI_(INS_SIGN[i]);
    out.push({ role: INS_SIGN_ROLE[INS_SIGN[i]],
               text: c > 0 ? norm_(sh.getRange(row, c).getDisplayValue()) : '' });
  }
  return out;
}
function inspHdr_(){ return HDR_INSP.concat(HDR_INSP_FLOW); }
function insStage_(key){
  key = norm_(key) || 'IDRAFT';
  for (var i = 0; i < INS_STAGES.length; i++) if (INS_STAGES[i].key === key) return INS_STAGES[i];
  return INS_STAGES[0];
}
function insStageList(){
  return INS_STAGES.map(function(s){ return { key:s.key, no:s.no, name:s.name, who:s.who,
                                              todo:s.todo, nextLabel:s.nextLabel, draft:!!s.draft }; });
}
/** ⚠️ ห้ามใช้ HDR_INSP.length เป็นเลขคอลัมน์อีก — พอเพิ่มคอลัมน์ขั้นตอนแล้วมันจะเขียนผิดช่องเงียบ ๆ */
function colOfI_(name){
  var h = inspHdr_();
  for (var i = 0; i < h.length; i++) if (h[i] === name) return i + 1;
  throw new Error('ไม่รู้จักคอลัมน์ ' + name + ' ในใบตรวจรับ');
}
function insStageOf_(sh, row){
  return norm_(sh.getRange(row, colOfI_('ขั้นตอน')).getDisplayValue()) || 'IDRAFT';
}
function setInsStage_(sh, row, key, me, note){
  var st = insStage_(key);
  var hist = norm_(sh.getRange(row, colOfI_('ประวัติขั้นตอน')).getDisplayValue());
  sh.getRange(row, colOfI_('ขั้นตอน')).setValue(key);
  sh.getRange(row, colOfI_('รอใครทำ')).setValue(st.who);
  sh.getRange(row, colOfI_('ประวัติขั้นตอน'))
    .setValue((hist ? hist + '\n' : '') + nowStamp_() + ' · ' + st.name + ' · ' + (me ? me.name : '') + (note ? ' · ' + note : ''));
  sh.getRange(row, colOfI_('แก้ไขล่าสุด')).setValue(nowStamp_());
}

var HDR_INSPIT = ['เลขที่เอกสาร','ลำดับ','หมวด','หัวข้อตรวจ','หัวข้อ (EN)','ผลตรวจ',
  'สิ่งที่พบ (ไทย)','สิ่งที่พบ (EN)','จำนวน','หน่วย','ส่งไปเคลมแล้ว','ผู้ตรวจ','เมื่อ'];

/* ─────────── แม่แบบเช็คลิสต์ ───────────
 * เป็นแค่ "ตัวตั้งต้น" — เปิดใบแล้วเพิ่ม/ลบ/แก้หัวข้อได้ทุกข้อ
 * เบียร์บอกหัวข้อจริงมาเมื่อไหร่ แก้ที่นี่ที่เดียว                       */
var INSP_TEMPLATES = {
  tanker: {
    name: 'แท็งค์นำเข้า (Tankers)',
    note: 'ใช้กับแท็งค์ที่นำเข้าจากต่างประเทศ ไม่ผ่านสโตร์',
    items: [
      ['ตัวถัง', 'สภาพผิวนอกตัวถัง — รอยบุบ รอยขีด สนิม', 'Outer shell condition — dents, scratches, rust'],
      ['ตัวถัง', 'สภาพผิวในตัวถัง — ความสะอาด รอยเชื่อม', 'Inner shell — cleanliness, welding'],
      ['ตัวถัง', 'ความหนาเหล็กตรงตามสเปค', 'Plate thickness as specified'],
      ['อุปกรณ์', 'แมนโฮล (Manhole) ปิดสนิท บานพับปกติ', 'Manhole seals properly, hinge OK'],
      ['อุปกรณ์', 'วาล์วจ่าย / API valve ไม่รั่วซึม', 'Discharge / API valve — no leak'],
      ['อุปกรณ์', 'วาล์วก้นถัง (Footvalve) ทำงานปกติ', 'Footvalve operates normally'],
      ['อุปกรณ์', 'ท่อทางจ่ายและข้อต่อครบ ไม่รั่ว', 'Piping and fittings complete, no leak'],
      ['ระบบ', 'ทดสอบแรงดัน (Pressure test) ผ่าน', 'Pressure test passed'],
      ['ระบบ', 'ระบบลม / ระบบเบรกทำงานปกติ', 'Air and brake system OK'],
      ['ระบบ', 'ระบบไฟและสายไฟครบถ้วน', 'Electrical system and wiring complete'],
      ['เอกสาร', 'CHASSIS NO. ตรงกับเอกสารนำเข้า', 'Chassis no. matches import documents'],
      ['เอกสาร', 'อะไหล่และคู่มือแนบมาครบ', 'Spare parts and manuals complete']
    ]
  },
  equipment: {
    name: 'อุปกรณ์ประกอบแท็งค์ (ผ่านสโตร์)',
    note: 'ใช้กับอุปกรณ์ที่สั่งซื้อเข้าสโตร์ ทั้งในและต่างประเทศ',
    items: [
      ['ปริมาณ', 'จำนวนตรงกับ PO', 'Quantity matches PO'],
      ['ปริมาณ', 'รุ่น / ขนาด ตรงกับที่สั่ง', 'Model / size as ordered'],
      ['สภาพ', 'บรรจุภัณฑ์ไม่ชำรุด', 'Packaging undamaged'],
      ['สภาพ', 'ตัวสินค้าไม่มีรอยบุบ แตก ร้าว', 'No dents, cracks or breakage'],
      ['สภาพ', 'ไม่มีสนิมหรือคราบผิดปกติ', 'No rust or abnormal stains'],
      ['การใช้งาน', 'ทดลองใช้งานเบื้องต้นผ่าน', 'Basic function test passed'],
      ['เอกสาร', 'ใบรับรอง / Certificate แนบครบ', 'Certificates attached']
    ]
  },
  domestic: {
    name: 'สินค้าในประเทศที่ต้องตรวจเฉพาะ',
    note: 'เบียร์: "บางอันที่มันเป็นแบบสินค้าที่ต้องตรวจโดยเฉพาะ" — รอเบียร์บอกหัวข้อจริง',
    items: [
      ['ปริมาณ', 'จำนวนตรงกับ PO', 'Quantity matches PO'],
      ['สภาพ', 'สภาพสินค้าโดยรวมเรียบร้อย', 'Overall condition acceptable'],
      ['สเปค', 'ตรงตามสเปคที่กำหนด', 'Meets specification'],
      ['การใช้งาน', 'ทดลองใช้งานผ่าน', 'Function test passed'],
      ['เอกสาร', 'เอกสารรับรองครบ', 'Documents complete']
    ]
  },
  blank: { name: 'เริ่มจากใบเปล่า (พิมพ์หัวข้อเอง)', note: 'ไม่มีหัวข้อตั้งต้น', items: [] }
};

/** ให้หน้าเว็บดึงรายชื่อแม่แบบไปทำ dropdown */
function listInspTemplates(){
  var out = [];
  for (var k in INSP_TEMPLATES){
    out.push({ key:k, name:INSP_TEMPLATES[k].name, note:INSP_TEMPLATES[k].note,
               n:INSP_TEMPLATES[k].items.length });
  }
  return out;
}

/* ═══ แท็บใบตรวจรับ แยกตามปี — กติกาเดียวกับฝั่งใบเคลม (ดู CLAIM-Hub.js) ═══
 *   • เปิดใบใหม่        → inspDb_()          (ปีปัจจุบัน)
 *   • ทำงานกับใบใด ๆ     → inspDbOf_(docNo)   (ปีที่ระบุในเลขที่เอกสาร)
 *   • ทะเบียน / รายงาน  → eachInspYear_()    (กวาดทุกปี)
 * ⚠️ ห้ามกลับไปใช้ปีปัจจุบันตายตัว ไม่งั้นขึ้นปีใหม่แล้วใบตรวจปีก่อนหายทั้งหมด */
function inspDbY_(be, create){
  be = be || yearBE_();
  var k = String(be) + (create ? 'C' : 'R');
  if (!_IDB) _IDB = {};
  if (_IDB[k]) return _IDB[k];
  var ss = ss_();
  if (!create && !ss.getSheetByName('INSP_' + be)) return null;
  _IDB[k] = {
    ss    : ss,
    be    : be,
    head  : ensureCols_(ensureTab_(ss, 'INSP_' + be, inspHdr_()), inspHdr_()),
    items : ensureTab_(ss, 'INSPIT_'  + be, HDR_INSPIT)
  };
  return _IDB[k];
}
function inspDb_(){ return inspDbY_(yearBE_(), true); }
function inspDbOf_(docNo){
  var be = beOfNo_(docNo);
  return inspDbY_(be, be === yearBE_()) || inspDb_();
}
/** ปีทั้งหมดที่มีใบตรวจรับ (รวมปีปัจจุบันเสมอ) */
function inspYearsBE_(){
  var shs = ss_().getSheets(), out = [];
  for (var i = 0; i < shs.length; i++){
    var m = shs[i].getName().match(/^INSP_(\d{4})$/);
    if (m) out.push(parseInt(m[1], 10));
  }
  var cur = yearBE_();
  if (out.indexOf(cur) < 0) out.push(cur);
  out.sort(function(a, b){ return b - a; });
  return out;
}
function eachInspYear_(fn){
  var ys = inspYearsBE_();
  for (var i = 0; i < ys.length; i++){
    var d = inspDbY_(ys[i], ys[i] === yearBE_());
    if (d) fn(d, ys[i]);
  }
}

/** เลขที่ INS-YY/NNNN — นับจากชีต INSP ของตัวเอง ไม่ปนกับ CLM */
function nextInspNo_(){
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = inspDb_().head, yy = yy_(yearBE_()), lr = sh.getLastRow(), max = 0;
    if (lr > 1){
      var col = sh.getRange(2,1,lr-1,1).getDisplayValues();
      var re = new RegExp('^INS-' + yy + '\\/(\\d+)$');
      for (var i = 0; i < col.length; i++){
        var m = norm_(col[i][0]).match(re);
        if (m) max = Math.max(max, parseInt(m[1],10));
      }
    }
    var n = String(max + 1);
    while (n.length < 4) n = '0' + n;
    return 'INS-' + yy + '/' + n;
  } finally { lock.releaseLock(); }
}

function findInspRow_(sh, docNo){
  var lr = sh.getLastRow(); if (lr < 2) return -1;
  var col = sh.getRange(2,1,lr-1,1).getDisplayValues();
  for (var i = 0; i < col.length; i++) if (norm_(col[i][0]) === docNo) return i + 2;
  return -1;
}

/** เปิดใบตรวจรับใหม่ — ดึงหัวข้อจากแม่แบบมาให้เลย ไม่ต้องพิมพ์เอง */
function createInspection(h, auth){
  var me = requireAny_(auth, ['QC','PRODUCTION','STORE','PURCHASE','DESIGN','APPROVER']);
  h = h || {};
  if (!norm_(h.jobNo)) throw new Error('ต้องระบุเลขที่ JOB');

  var docNo = nextInspNo_(), d = inspDb_();
  /* แม่แบบมาจากทะเบียนในชีต (แก้เองได้) ไม่ใช่ฝังในโค้ดแล้ว */
  var tpl = resolveTemplate_(h.template, h.model, h.kind, auth);
  var tplName = tpl ? tpl.head.name : 'ใบเปล่า (พิมพ์หัวข้อเอง)';
  var tplKey  = tpl ? tpl.head.key  : '';
  var tItems  = tpl ? tpl.items : [];

  d.head.appendRow([
    docNo, 'INSPECTION', fmtDMY_(new Date()), norm_(h.area) || 'for', norm_(h.kind) || 'tanker',
    norm_(h.jobNo).toUpperCase(), norm_(h.jobName), norm_(h.model),
    norm_(h.chassisStt), norm_(h.chassisMaker), norm_(h.serialNo),
    tplName, norm_(h.po), norm_(h.supplier), fmtDMY_(h.recv), me.name,
    'DRAFT', '', '', me.name, nowStamp_(), nowStamp_()
  ]);
  ensureCols_(d.head, inspHdr_());
  var nr = findInspRow_(d.head, docNo);
  var cE = colOfI_('E. No.');      if (cE > 0) d.head.getRange(nr, cE).setValue(norm_(h.eNo));
  var cT = colOfI_('รหัสแม่แบบ');   if (cT > 0) d.head.getRange(nr, cT).setValue(tplKey);

  var rows = [];
  for (var i = 0; i < tItems.length; i++){
    rows.push([docNo, i + 1, tItems[i].cat, tItems[i].title, tItems[i].titleEn,
               '', '', '', tItems[i].qty, tItems[i].unit, '', '', '']);
  }
  if (rows.length) d.items.getRange(d.items.getLastRow()+1, 1, rows.length, HDR_INSPIT.length).setValues(rows);

  /* รูป STD ประจำรุ่นตามมาจากแม่แบบทันที — ช่องรูป STD ในตารางใช้ลำดับ "S" + เลขข้อ
     เบียร์: "เผื่อวันนึงเรามีรูป STD ก็ใส่ไว้ได้เลย" → ใส่ไว้ที่แม่แบบครั้งเดียว ใช้ได้ทุกใบ */
  var nStd = copyStdFromTemplate_(docNo, tItems, me.name);

  log_('createInspection', docNo, norm_(h.jobNo) + ' · ' + tplName + ' · รูป STD ' + nStd);
  setInsStage_(d.head, nr, 'IDRAFT', me, 'เปิดใบตรวจ');
  return { ok:true, docNo:docNo, n:rows.length, nStd:nStd, template:tplName };
}

function inspItemsOf_(d, docNo){
  var lr = d.items.getLastRow(); if (lr < 2) return [];
  var vals = d.items.getRange(2,1,lr-1,HDR_INSPIT.length).getDisplayValues();
  var out = [];
  for (var i = 0; i < vals.length; i++){
    if (norm_(vals[i][0]) !== docNo) continue;
    out.push({ row:i+2, seq:norm_(vals[i][1]), cat:norm_(vals[i][2]),
      title:norm_(vals[i][3]), titleEn:norm_(vals[i][4]), acc:norm_(vals[i][5]).toUpperCase(),
      found:norm_(vals[i][6]), foundEn:norm_(vals[i][7]), qty:norm_(vals[i][8]), unit:norm_(vals[i][9]),
      sentTo:norm_(vals[i][10]), by:norm_(vals[i][11]), at:norm_(vals[i][12]) });
  }
  out.sort(function(a,b){ return num_(a.seq) - num_(b.seq); });
  return out;
}

/** อ่านใบตรวจ 1 ใบ (หัว + หัวข้อตรวจ + รูป) */
function getInspection(docNo, auth){
  requireLogin_(auth);
  docNo = norm_(docNo);
  var d = inspDbOf_(docNo), r = findInspRow_(d.head, docNo);
  if (r < 0) return null;
  var hdr = d.head.getRange(1,1,1,HDR_INSP.length).getDisplayValues()[0];
  var row = d.head.getRange(r,1,1,HDR_INSP.length).getDisplayValues()[0];
  var head = {};
  for (var i = 0; i < hdr.length; i++) head[hdr[i]] = norm_(row[i]);
  return { head:head, items:inspItemsOf_(d, docNo), photos:listPhotos(docNo, auth) };
}

/** ทะเบียนใบตรวจ + นับผลตรวจให้เห็นตั้งแต่ยังไม่เปิดใบ */
function listInspections(filter, auth){
  var meL = requireLogin_(auth);
  filter = filter || {};
  var full = inspHdr_();
  var pho  = photoCountByDoc_();
  var out  = [];
  /* ⚠️ ต้องกวาดทุกปี — ใบตรวจที่ยังไม่จบของปีก่อน ห้ามหายตอนขึ้นปีใหม่ */
  eachInspYear_(function(d){
    var lr = d.head.getLastRow(); if (lr < 2) return;
    listInspYear_(d, lr, full, filter, meL, pho, out);
  });
  return out;
}

function listInspYear_(d, lr, full, filter, meL, pho, out){
  /* ⚠️ ต้องอ่านหัวตาราง "เต็มความยาว" เหมือนฝั่งใบเคลม — ไม่งั้นคอลัมน์สายงาน
     (เหตุผลที่ตีกลับ · แก้ไขล่าสุด) จะหลุดหายไปเงียบ ๆ ตอนเอาไปทำ Dashboard */
  var hdr = d.head.getRange(1,1,1,full.length).getDisplayValues()[0];
  var rows = d.head.getRange(2,1,lr-1,full.length).getDisplayValues();
  var iSt = colOfI_('ขั้นตอน') - 1;

  /* นับผลตรวจของทุกใบในปีนี้ทีเดียว แล้วค่อยแจก — ไม่วนอ่านทีละใบ */
  var cnt = {}, lrI = d.items.getLastRow();
  if (lrI >= 2){
    var vi = d.items.getRange(2,1,lrI-1,6).getDisplayValues();
    for (var k = 0; k < vi.length; k++){
      var dn = norm_(vi[k][0]); if (!dn) continue;
      if (!cnt[dn]) cnt[dn] = { n:0, acc:0, un:0, todo:0 };
      cnt[dn].n++;
      var a = norm_(vi[k][5]).toUpperCase();
      if (a === 'ACC') cnt[dn].acc++;
      else if (a === 'UNACC') cnt[dn].un++;
      else cnt[dn].todo++;
    }
  }

  for (var i = rows.length - 1; i >= 0; i--){
    var o = {};
    for (var j = 0; j < hdr.length; j++) if (hdr[j]) o[hdr[j]] = norm_(rows[i][j]);
    var stg = norm_(rows[i][iSt]) || 'IDRAFT';
    /* ใบตรวจที่ยังเป็นร่าง เห็นเฉพาะคนตรวจ · แผนกเดียวกัน · ผู้บังคับบัญชา · ผู้บริหาร */
    if (insStage_(stg).draft && !canSeeDraft_(meL, o['สร้างโดย'], 'QC')) continue;
    o.stage = stg; o.stageNo = insStage_(stg).no; o.stageName = insStage_(stg).name;
    if (filter.jobNo && o['เลขที่ JOB'].toUpperCase() !== norm_(filter.jobNo).toUpperCase()) continue;
    if (filter.q){
      var q = norm_(filter.q).toLowerCase();
      var hay = (o['เลขที่เอกสาร'] + ' ' + o['เลขที่ JOB'] + ' ' + o['ชื่อลูกค้า'] + ' ' + o['Supplier']).toLowerCase();
      if (hay.indexOf(q) < 0) continue;
    }
    var c = cnt[o['เลขที่เอกสาร']] || { n:0, acc:0, un:0, todo:0 };
    out.push({
      docNo:o['เลขที่เอกสาร'], date:o['วันที่'], area:o['สถานที่ผลิต'], kind:o['ชนิดงาน'],
      jobNo:o['เลขที่ JOB'], jobName:o['ชื่อลูกค้า'], model:o['MODEL'],
      supplier:o['Supplier'], template:o['แม่แบบเช็คลิสต์'], status:o['สถานะ'],
      claimNo:o['ใบเคลมที่ออกจากใบนี้'], by:o['สร้างโดย'],
      stage:o.stage, stageNo:o.stageNo, stageName:o.stageName,
      n:c.n, acc:c.acc, un:c.un, todo:c.todo,
      nPhoto:(pho[o['เลขที่เอกสาร']] || 0),
      /* เพิ่ม 7 ก.ย. 2569 — Dashboard สถานะเอกสารใช้ (ตีกลับไหม · แก้ล่าสุดเมื่อไหร่) */
      rejected: !!o['เหตุผลที่ตีกลับ'], rejectNote:o['เหตุผลที่ตีกลับ'] || '',
      updatedAt:o['แก้ไขล่าสุด'] || '', createdAt:o['สร้างเมื่อ'] || ''
    });
    if (out.length >= 500) break;
  }
  return out;
}

/** นับรูปต่อเอกสาร (ใช้ได้ทั้ง CLM และ INS) */
function photoCountByDoc_(){
  var out = {};
  /* รูปเก็บแยกแท็บตามปีเหมือนตัวเอกสาร จึงต้องนับทุกปี
     ไม่งั้นใบปีก่อนจะขึ้นว่า "ไม่มีรูป" ทั้งที่รูปยังอยู่ครบ */
  eachPhotoYear_(function(pt){
    var lr = pt.getLastRow(); if (lr < 2) return;
    var v = pt.getRange(2,1,lr-1,HDR_PHOTO.length).getDisplayValues();
    for (var i = 0; i < v.length; i++){
      if (norm_(v[i][7]).toUpperCase() === 'N') continue;
      var dn = norm_(v[i][0]); if (!dn) continue;
      out[dn] = (out[dn] || 0) + 1;
    }
  });
  return out;
}

/* ─────────── บันทึกทีละช่อง (แบบ Google Sheets) ───────────
 * เบียร์: "เมื่อพิมแล้ว ต้องบันทึกเองเลย เหมือนทำใน GGS · ห้ามเด้งขึ้นลงเอง"
 * → ทุกฟังก์ชันนี้เขียนแค่ "ช่องเดียว" แล้วจบ ไม่ส่งข้อมูลทั้งใบกลับมา
 *   หน้าเว็บจึงไม่ต้องวาดใหม่ = จอไม่เด้ง focus ไม่หลุด                */
/* ⚠️ อย่าใช้เลขคอลัมน์ตายตัวอีก — ใช้ "ชื่อหัวตาราง" แทน เพิ่มคอลัมน์ทีหลังก็ไม่พัง
   (เลขเดิม: area:4 kind:5 … note:19 — เคยเป็นชนวนบั๊กเขียนผิดช่องแบบเงียบ ๆ) */
var INSP_FIELD_NAME = {
  area:'สถานที่ผลิต', kind:'ชนิดงาน', jobNo:'เลขที่ JOB', jobName:'ชื่อลูกค้า', model:'MODEL',
  chassisStt:'CHASSIS NO. (STT)', chassisMaker:'CHASSIS NO. (ผู้ผลิต)', serialNo:'SERIAL NO.',
  po:'PO', supplier:'Supplier', recv:'วันรับสินค้า', inspector:'ผู้ตรวจ', status:'สถานะ',
  note:'หมายเหตุ', eNo:'E. No.'
};
function saveInspHeadField(docNo, field, value, auth){
  requireAny_(auth, ['QC','PRODUCTION','STORE','PURCHASE','DESIGN','APPROVER']);
  var name = INSP_FIELD_NAME[field];
  if (!name) throw new Error('ไม่รู้จักช่อง ' + field);
  var col = colOfI_(name);
  var d = inspDbOf_(docNo);
  var r = insEditable_(d, docNo, null);       // อนุมัติแล้วแก้ไม่ได้
  if (r < 0) throw new Error('ไม่พบใบตรวจ ' + docNo);
  var v = norm_(value);
  if (field === 'recv') v = fmtDMY_(v);
  if (field === 'jobNo') v = v.toUpperCase();
  d.head.getRange(r, col).setValue(v);
  d.head.getRange(r, colOfI_('แก้ไขล่าสุด')).setValue(nowStamp_());
  return { ok:true };
}

var INSPIT_FIELD_COL = { cat:3, title:4, titleEn:5, acc:6, found:7, foundEn:8, qty:9, unit:10 };
/** แก้ผลตรวจได้เฉพาะตอนยังเป็นร่าง — อนุมัติแล้วต้องให้ตีกลับก่อน */
function insEditable_(d, docNo, me){
  var r = findInspRow_(d.head, norm_(docNo));
  if (r < 0) throw new Error('ไม่พบใบตรวจ ' + docNo);
  var key = insStageOf_(d.head, r);
  if (key !== 'IDRAFT'){
    throw new Error('ใบนี้อยู่ขั้น "' + insStage_(key).name + '" แล้ว แก้ไม่ได้ — ' +
                    'ถ้าต้องแก้ ให้ผู้บังคับบัญชาตีกลับมาก่อน');
  }
  return r;
}

function saveInspItemField(docNo, seq, field, value, auth){
  var me = requireAny_(auth, ['QC','PRODUCTION','STORE','PURCHASE','DESIGN','APPROVER']);
  var col = INSPIT_FIELD_COL[field];
  if (!col) throw new Error('ไม่รู้จักช่อง ' + field);
  var d = inspDbOf_(docNo);
  insEditable_(d, docNo, me);                 // อนุมัติแล้วแก้ไม่ได้
  var lr = d.items.getLastRow();
  if (lr < 2) throw new Error('ไม่พบหัวข้อตรวจ');
  var v = d.items.getRange(2,1,lr-1,2).getDisplayValues();
  for (var i = 0; i < v.length; i++){
    if (norm_(v[i][0]) === norm_(docNo) && norm_(v[i][1]) === String(seq)){
      var row = i + 2;
      d.items.getRange(row, col).setValue(field === 'acc' ? norm_(value).toUpperCase() : norm_(value));
      d.items.getRange(row, 12).setValue(me.name);
      d.items.getRange(row, 13).setValue(nowStamp_());
      return { ok:true };
    }
  }
  throw new Error('ไม่พบหัวข้อที่ ' + seq);
}

/** เพิ่มหัวข้อตรวจ 1 บรรทัด */
function addInspItem(docNo, auth){
  requireAny_(auth, ['QC','PRODUCTION','STORE','PURCHASE','DESIGN','APPROVER']);
  var d = inspDbOf_(docNo), list = inspItemsOf_(d, norm_(docNo));
  var seq = 1;
  for (var i = 0; i < list.length; i++) seq = Math.max(seq, num_(list[i].seq) + 1);
  d.items.appendRow([norm_(docNo), seq, '', '', '', '', '', '', '', '', '', '', '']);
  return { ok:true, seq:seq };
}

/** ลบหัวข้อตรวจ (ลบได้เฉพาะข้อที่ยังไม่ได้ส่งไปเคลม) */
function delInspItem(docNo, seq, auth){
  requireAny_(auth, ['QC','PRODUCTION','STORE','PURCHASE','DESIGN','APPROVER']);
  var d = inspDbOf_(docNo), lr = d.items.getLastRow();
  if (lr < 2) return { ok:true };
  var v = d.items.getRange(2,1,lr-1,11).getDisplayValues();
  for (var i = 0; i < v.length; i++){
    if (norm_(v[i][0]) === norm_(docNo) && norm_(v[i][1]) === String(seq)){
      if (norm_(v[i][10])) throw new Error('ข้อนี้ส่งไปใบเคลม ' + norm_(v[i][10]) + ' แล้ว ลบไม่ได้');
      d.items.deleteRow(i + 2);
      return { ok:true };
    }
  }
  return { ok:true };
}

/** ตรวจว่าใบนี้พร้อมส่งเคลมไหม — ทุกข้อที่ Un-Acc ต้องมีรูป */
/** ข้อมูลขั้นตอนของใบตรวจ สำหรับหน้าเว็บ */
function inspFlow(docNo, auth){
  var me = requireLogin_(auth);
  var d = inspDbOf_(docNo), r = findInspRow_(d.head, norm_(docNo));
  if (r < 0) return null;
  var key = insStageOf_(d.head, r), st = insStage_(key);
  var mine = (me.roles && me.roles.length) ? me.roles : [me.role];
  var isAdmin = mine.indexOf('ADMIN') >= 0;
  var isOwner = isAdmin;
  for (var i = 0; i < mine.length; i++) if (st.roles.indexOf(mine[i]) >= 0) isOwner = true;
  var miss = insMissing_(d, norm_(docNo), key);
  return {
    stage:key, no:st.no, name:st.name, who:st.who, todo:st.todo,
    next:st.next, nextLabel:st.nextLabel, isOwner:isOwner, isDraft:!!st.draft,
    canReject: key === 'IAPPROVAL' && isOwner,
    needReceive:false, received:true, canCancel:false,
    rejectNote: norm_(d.head.getRange(r, colOfI_('เหตุผลที่ตีกลับ')).getDisplayValue()),
    rejectBy:   norm_(d.head.getRange(r, colOfI_('ตีกลับโดย')).getDisplayValue()),
    rejectAt:   norm_(d.head.getRange(r, colOfI_('ตีกลับเมื่อ')).getDisplayValue()),
    history:    norm_(d.head.getRange(r, colOfI_('ประวัติขั้นตอน')).getDisplayValue()),
    stages: insStageList(), lock:{}, missing:miss, signs: insSigns_(d.head, r),
    canEdit: (key === 'IDRAFT') && isOwner,
    canSendClaim: key === 'IDONE'
  };
}

/** ยังตรวจไม่ครบตรงไหน — บอกก่อนกดส่งขออนุมัติ */
function insMissing_(d, docNo, key){
  var miss = [];
  if (key !== 'IDRAFT') return miss;
  var items = inspItemsOf_(d, docNo), todo = [], noPhoto = [];
  var ph = photosOf_(docNo);
  for (var i = 0; i < items.length; i++){
    if (!norm_(items[i].acc)) todo.push(items[i].seq);
    else if (norm_(items[i].acc) === 'UNACC' && (!ph[String(items[i].seq)] || !ph[String(items[i].seq)].length))
      noPhoto.push(items[i].seq);
  }
  if (!items.length) miss.push('ยังไม่มีหัวข้อตรวจ');
  if (todo.length)    miss.push('ข้อ ' + todo.join(', ') + ' ยังไม่ได้ติ๊กผลตรวจ');
  if (noPhoto.length) miss.push('ข้อ ' + noPhoto.join(', ') + ' ไม่ผ่านแต่ยังไม่มีรูป');
  return miss;
}

/** ส่งใบตรวจไปขั้นถัดไป */
function advanceInsp(docNo, auth){
  var me = requireLogin_(auth);
  docNo = norm_(docNo);
  var d = inspDbOf_(docNo), r = findInspRow_(d.head, docNo);
  if (r < 0) throw new Error('ไม่พบใบตรวจ ' + docNo);
  var key = insStageOf_(d.head, r), st = insStage_(key);
  if (!st.next) throw new Error('ใบนี้อนุมัติแล้ว');

  var mine = (me.roles && me.roles.length) ? me.roles : [me.role];
  var ok = mine.indexOf('ADMIN') >= 0;
  for (var i = 0; i < mine.length; i++) if (st.roles.indexOf(mine[i]) >= 0) ok = true;
  if (!ok) throw new Error('ขั้นนี้เป็นหน้าที่ของ ' + st.who + ' — สิทธิ์ของคุณคือ ' + mine.join(', '));

  var miss = insMissing_(d, docNo, key);
  if (miss.length) throw new Error('ยังส่งต่อไม่ได้ — ' + miss.join(' · '));

  signInsStage_(d.head, r, key, me);        // เซ็นขั้นที่เพิ่งทำเสร็จ ก่อนย้ายไปขั้นถัดไป
  setInsStage_(d.head, r, st.next, me, '');
  d.head.getRange(r, colOfI_('เหตุผลที่ตีกลับ')).setValue('');
  d.head.getRange(r, colOfI_('สถานะ')).setValue(st.next === 'IDONE' ? 'อนุมัติแล้ว' : 'รออนุมัติ');
  if (st.lineKey){
    var nx = insStage_(st.next);
    lineToStage_(st.lineKey, '🔍 ใบตรวจรับถึงคิวคุณแล้ว\nเลขที่ ' + docNo +
      '\nขั้นที่ ' + nx.no + ' ' + nx.name + '\nส่งต่อโดย ' + me.name);
  }
  log_('advanceInsp', docNo, key + ' → ' + st.next);
  try { CacheService.getScriptCache().remove('CLAIM_HOME'); } catch(e){}
  return { ok:true, stage:st.next };
}

/** ตีกลับใบตรวจให้ QC ตรวจใหม่ */
function rejectInsp(docNo, reason, auth){
  var me = requireLogin_(auth);
  reason = norm_(reason);
  if (!reason) throw new Error('ต้องบอกเหตุผลที่ตีกลับ');
  var mine = (me.roles && me.roles.length) ? me.roles : [me.role];
  if (mine.indexOf('ADMIN') < 0 && mine.indexOf('APPROVER') < 0)
    throw new Error('ตีกลับใบตรวจได้เฉพาะผู้บังคับบัญชา');

  docNo = norm_(docNo);
  var d = inspDbOf_(docNo), r = findInspRow_(d.head, docNo);
  if (r < 0) throw new Error('ไม่พบใบตรวจ ' + docNo);
  setInsStage_(d.head, r, 'IDRAFT', me, 'ตีกลับ: ' + reason);
  /* ตีกลับแล้วต้องล้างลายเซ็น — ของเดิมที่เซ็นไว้ใช้กับ "ผลตรวจชุดเก่า"
     ถ้าไม่ล้าง แก้ผลตรวจใหม่แล้วลายเซ็นเดิมยังค้าง = เอกสารโกหก */
  for (var si = 0; si < INS_SIGN.length; si++){
    var sc = colOfI_(INS_SIGN[si]);
    if (sc > 0) d.head.getRange(r, sc).setValue('');
  }
  d.head.getRange(r, colOfI_('เหตุผลที่ตีกลับ')).setValue(reason);
  d.head.getRange(r, colOfI_('ตีกลับโดย')).setValue(me.name);
  d.head.getRange(r, colOfI_('ตีกลับเมื่อ')).setValue(nowStamp_());
  d.head.getRange(r, colOfI_('สถานะ')).setValue('ถูกตีกลับ');
  lineToStage_('QC', '↩ ใบตรวจ ' + docNo + ' ถูกตีกลับ\nเหตุผล: ' + reason + '\nโดย ' + me.name);
  log_('rejectInsp', docNo, reason);
  return { ok:true, stage:'IDRAFT' };
}

function inspCheck(docNo, auth){
  requireLogin_(auth);
  docNo = norm_(docNo);
  var items = inspItemsOf_(inspDbOf_(docNo), docNo);
  var ph = listPhotos(docNo, auth);
  var un = [], noPhoto = [], todo = [];
  for (var i = 0; i < items.length; i++){
    if (!items[i].acc) todo.push(items[i].seq);
    if (items[i].acc === 'UNACC'){
      un.push(items[i]);
      if (!ph[String(items[i].seq)] || !ph[String(items[i].seq)].length) noPhoto.push(items[i].seq);
    }
  }
  return {
    n:items.length, un:un.length, todo:todo.length,
    todoList:todo, noPhoto:noPhoto,
    ok: (un.length > 0 && noPhoto.length === 0),
    msg: un.length === 0
        ? 'ยังไม่มีข้อที่ Un-Acc — ไม่มีอะไรต้องเคลม'
        : (noPhoto.length
            ? 'ข้อที่ Un-Acc ยังไม่มีรูป: ข้อ ' + noPhoto.join(', ') + ' — ต้องมีรูปทุกข้อก่อนส่งเคลม'
            : 'พร้อมส่งเคลม ' + un.length + ' ข้อ')
  };
}

/** ส่งข้อที่ Un-Acc ไปเปิดใบเคลมให้อัตโนมัติ + ก๊อปรูปตามไปด้วย */
function sendUnAccToClaim(docNo, auth){
  /* เบียร์: Inspection ก็ต้องผ่านอนุมัติก่อน ถึงจะเปิดใบเคลมจากข้อที่ไม่ผ่านได้ */
  (function(){
    var dd = inspDbOf_(docNo), rr = findInspRow_(dd.head, norm_(docNo));
    if (rr >= 0 && insStageOf_(dd.head, rr) !== 'IDONE')
      throw new Error('ใบตรวจนี้ยังไม่ได้รับอนุมัติ — ให้ผู้บังคับบัญชาอนุมัติก่อน แล้วค่อยเปิดใบเคลม');
  })();
  var me = requireAny_(auth, ['QC','PRODUCTION','STORE','PURCHASE','APPROVER']);
  docNo = norm_(docNo);
  var chk = inspCheck(docNo, auth);
  if (!chk.ok) throw new Error(chk.msg);

  var d = inspDbOf_(docNo), r = findInspRow_(d.head, docNo);
  if (r < 0) throw new Error('ไม่พบใบตรวจ ' + docNo);
  var fullI = inspHdr_();
  var hdr = d.head.getRange(1,1,1,fullI.length).getDisplayValues()[0];
  var hrow = d.head.getRange(r,1,1,fullI.length).getDisplayValues()[0];
  var H = {};
  for (var i = 0; i < hdr.length; i++) H[hdr[i]] = norm_(hrow[i]);

  if (H['ใบเคลมที่ออกจากใบนี้']) throw new Error('ใบนี้ออกใบเคลม ' + H['ใบเคลมที่ออกจากใบนี้'] + ' ไปแล้ว');

  var items = inspItemsOf_(d, docNo), claimItems = [], fromSeq = [];
  for (var k = 0; k < items.length; k++){
    if (items[k].acc !== 'UNACC') continue;
    claimItems.push({
      code:'', name:items[k].title,
      th:items[k].found || items[k].title, en:items[k].foundEn || items[k].titleEn,
      qty:items[k].qty || '1', unit:items[k].unit,
      po:H['PO'], supplier:H['Supplier'], recv:H['วันรับสินค้า'],
      note:'มาจากใบตรวจ ' + docNo + ' ข้อ ' + items[k].seq
    });
    fromSeq.push(items[k].seq);
  }

  /* เบียร์ 8 ก.ย. 2569: "ประเภทการเคลม มันต้องมีว่า เคลมหลังจาก inspection แท็งค์ด้วย
     ในกรณีที่มันเชื่อมมาจากใบ Inspection" — ระบบตั้งให้เอง คนเลือกเองไม่ได้ */
  var res = createClaim({
    claimType:'insp', fromInsp:docNo,
    area:H['สถานที่ผลิต'], foreignKind:H['ชนิดงาน'],
    jobNo:H['เลขที่ JOB'], jobName:H['ชื่อลูกค้า'], model:H['MODEL'],
    chassisStt:H['CHASSIS NO. (STT)'], chassisMaker:H['CHASSIS NO. (ผู้ผลิต)'],
    eNo:H['E. No.'], workKind:'PART',
    serialNo:H['SERIAL NO.'], dept:'QC / ตรวจรับ',
    items:claimItems
  }, auth);

  /* ก๊อปรูปตามไปใบเคลมด้วย — ใช้ไฟล์เดิมใน Drive ไม่อัปซ้ำ ไม่กินที่ */
  copyPhotosToDoc_(docNo, res.docNo, fromSeq, me.name);

  /* ประทับกลับที่ใบตรวจ ว่าข้อไหนไปอยู่ใบเคลมไหน */
  for (var m = 0; m < items.length; m++){
    if (items[m].acc !== 'UNACC') continue;
    d.items.getRange(items[m].row, 11).setValue(res.docNo);
  }
  /* ⚠️ ห้ามใช้เลขคอลัมน์ตายตัว — เพิ่มคอลัมน์ทีไรจะเขียนผิดช่องแบบเงียบ ๆ */
  d.head.getRange(r, colOfI_('ใบเคลมที่ออกจากใบนี้')).setValue(res.docNo);
  d.head.getRange(r, colOfI_('สถานะ')).setValue('ส่งเคลมแล้ว');
  d.head.getRange(r, colOfI_('แก้ไขล่าสุด')).setValue(nowStamp_());

  log_('sendUnAccToClaim', docNo, '→ ' + res.docNo + ' (' + claimItems.length + ' ข้อ)');
  return { ok:true, claimNo:res.docNo, n:claimItems.length };
}

/** ก๊อปแถวรูปจากเอกสารหนึ่งไปอีกเอกสาร — ชี้ไฟล์ Drive เดิม ไม่สร้างไฟล์ใหม่ */
function copyPhotosToDoc_(fromDoc, toDoc, seqList, byName){
  var pt = photoTabOf_(fromDoc), lr = pt.getLastRow();
  if (lr < 2) return 0;
  var v = pt.getRange(2,1,lr-1,HDR_PHOTO.length).getDisplayValues();
  var want = {};
  for (var i = 0; i < seqList.length; i++) want[String(seqList[i])] = i + 1;   // ข้อเดิม → ลำดับใหม่ในใบเคลม
  var out = [];
  for (var k = 0; k < v.length; k++){
    if (norm_(v[k][0]) !== fromDoc) continue;
    if (norm_(v[k][7]).toUpperCase() === 'N') continue;
    var newSeq = want[norm_(v[k][1])];
    if (!newSeq) continue;
    out.push([toDoc, newSeq, out.length + 1, norm_(v[k][3]), norm_(v[k][4]),
              norm_(v[k][5]), norm_(v[k][6]), 'Y', byName, nowStamp_()]);
  }
  if (out.length) pt.getRange(pt.getLastRow()+1, 1, out.length, HDR_PHOTO.length).setValues(out);
  return out.length;
}


/* ═══════════════════════════════════════════════════════════════════════════
 * ทะเบียนแม่แบบเช็คลิสต์  (v1.4.0 · เบียร์ 8 ก.ย. 2569)
 *   "แม่แบบเช็คลิสต์ >> มันเหมือนต้องเป็นไฟล์ที่ต้องสร้างขึ้นมาในระบบไหม
 *    ว่าอันนี้คือแม่แบบมาตรฐานของแต่ละโมเดลไหม ให้เลือกว่าจะใช้แม่แบบอะไร
 *    (ต้องมี Template ให้เบียร์กรอกข้อมูล เช่น การตรวจแท็งค์ model นี้ ต้องตรวจอะไรบ้าง + รูปภาพ เป็นหัวข้อ ๆ)"
 *
 * ออกแบบยังไง
 *   • เก็บใน 2 แท็บ  TPL (หัวแม่แบบ) + TPLIT (หัวข้อตรวจ)  — เบียร์แก้เองได้จากในระบบ
 *   • ไม่แบ่งตามปี — แม่แบบเป็น "ข้อมูลหลัก" ไม่ใช่ธุรกรรม ใช้ข้ามปีตลอดไป
 *   • ผูกกับ MODEL ได้ → เปิดใบตรวจ พิมพ์ MODEL แล้วระบบเลือกแม่แบบให้เอง
 *   • รูป STD แนบไว้ที่ "หัวข้อ" ในแม่แบบ (ข้อละ 1 รูป)
 *     เปิดใบตรวจจากแม่แบบ = รูป STD ตามไปทุกข้อทันที ไม่ต้องแนบใหม่ทุกใบ
 *     ← นี่คือคลังรูป STD ประจำรุ่นที่ค้างไว้ตั้งแต่รอบก่อน
 * ═════════════════════════════════════════════════════════════════════════ */

var HDR_TPL   = ['รหัสแม่แบบ','ชื่อแม่แบบ','ลักษณะงาน','MODEL','คำอธิบาย','ใช้งาน',
                 'สร้างโดย','สร้างเมื่อ','แก้ไขล่าสุด'];
var HDR_TPLIT = ['รหัสแม่แบบ','ลำดับ','หมวด','หัวข้อตรวจ','หัวข้อ (EN)','จำนวน','หน่วย',
                 'รูป STD file id','รูป STD ลิงก์','รูป STD ลิงก์เต็ม','หมายเหตุ'];

var _TPLDB = null;
function tplDb_(){
  if (_TPLDB) return _TPLDB;
  var ss = ss_();
  _TPLDB = { ss:ss,
    tpl  : ensureCols_(ensureTab_(ss, 'TPL',   HDR_TPL),   HDR_TPL),
    items: ensureCols_(ensureTab_(ss, 'TPLIT', HDR_TPLIT), HDR_TPLIT) };
  seedTemplates_(_TPLDB);
  return _TPLDB;
}

/** ครั้งแรกสุด: ย้ายแม่แบบที่เคยฝังอยู่ในโค้ดลงชีตให้ เบียร์จะได้มีตัวตั้งต้นไว้แก้
 *  ทำครั้งเดียว — มีแถวในชีตแล้วจะไม่ยัดซ้ำ */
function seedTemplates_(d){
  if (d.tpl.getLastRow() > 1) return;
  var order = ['tanker','equipment','domestic','blank'];
  var kindOf = { tanker:'tanker', equipment:'equip', domestic:'equip', blank:'equip' };
  var n = 0;
  for (var i = 0; i < order.length; i++){
    var k = order[i], t = INSP_TEMPLATES[k];
    if (!t) continue;
    var key = 'TPL-' + ('000' + (++n)).slice(-4);
    d.tpl.appendRow([key, t.name, kindOf[k], '', t.note, 'Y', 'ระบบ', nowStamp_(), nowStamp_()]);
    var rows = [];
    for (var j = 0; j < t.items.length; j++)
      rows.push([key, j + 1, t.items[j][0], t.items[j][1], t.items[j][2], '', '', '', '', '', '']);
    if (rows.length)
      d.items.getRange(d.items.getLastRow() + 1, 1, rows.length, HDR_TPLIT.length).setValues(rows);
  }
}

function nextTplNo_(){
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch(e){ throw new Error('ระบบกำลังออกเลขให้คนอื่นอยู่ ลองใหม่อีกครั้ง'); }
  try {
    var d = tplDb_(), lr = d.tpl.getLastRow(), max = 0;
    if (lr > 1){
      var v = d.tpl.getRange(2, 1, lr - 1, 1).getDisplayValues();
      for (var i = 0; i < v.length; i++){
        var m = norm_(v[i][0]).match(/^TPL-(\d+)$/);
        if (m) max = Math.max(max, parseInt(m[1], 10));
      }
    }
    return 'TPL-' + ('000' + (max + 1)).slice(-4);
  } finally { try { lock.releaseLock(); } catch(e){} }
}

function tplRow_(d, key){
  var lr = d.tpl.getLastRow(); if (lr < 2) return -1;
  var v = d.tpl.getRange(2, 1, lr - 1, 1).getDisplayValues();
  for (var i = 0; i < v.length; i++) if (norm_(v[i][0]) === key) return i + 2;
  return -1;
}

/** หัวข้อทั้งหมดของแม่แบบหนึ่ง เรียงตามลำดับ */
function tplItemsOf_(d, key){
  var lr = d.items.getLastRow(); if (lr < 2) return [];
  var v = d.items.getRange(2, 1, lr - 1, HDR_TPLIT.length).getDisplayValues();
  var out = [];
  for (var i = 0; i < v.length; i++){
    if (norm_(v[i][0]) !== key) continue;
    out.push({ row:i + 2, seq:norm_(v[i][1]), cat:norm_(v[i][2]),
      title:norm_(v[i][3]), titleEn:norm_(v[i][4]), qty:norm_(v[i][5]), unit:norm_(v[i][6]),
      stdId:norm_(v[i][7]), stdThumb:norm_(v[i][8]), stdView:norm_(v[i][9]), note:norm_(v[i][10]) });
  }
  out.sort(function(a, b){ return num_(a.seq) - num_(b.seq); });
  return out;
}

/** รายชื่อแม่แบบ — ใช้ทั้งหน้าเปิดใบตรวจและหน้าจัดการแม่แบบ */
function listTemplates(withOff, auth){
  requireLogin_(auth);
  var d = tplDb_(), lr = d.tpl.getLastRow();
  if (lr < 2) return [];
  var v = d.tpl.getRange(2, 1, lr - 1, HDR_TPL.length).getDisplayValues();
  /* นับหัวข้อ + นับรูป STD ทีเดียวทั้งชีต ไม่วนอ่านทีละแม่แบบ */
  var cnt = {}, std = {}, li = d.items.getLastRow();
  if (li > 1){
    var vi = d.items.getRange(2, 1, li - 1, 8).getDisplayValues();
    for (var i = 0; i < vi.length; i++){
      var k = norm_(vi[i][0]); if (!k) continue;
      cnt[k] = (cnt[k] || 0) + 1;
      if (norm_(vi[i][7])) std[k] = (std[k] || 0) + 1;
    }
  }
  var out = [];
  for (var r = 0; r < v.length; r++){
    var key = norm_(v[r][0]); if (!key) continue;
    var on = norm_(v[r][5]).toUpperCase() !== 'N';
    if (!on && !withOff) continue;
    out.push({ key:key, name:norm_(v[r][1]), kind:norm_(v[r][2]) || 'equip', model:norm_(v[r][3]),
               note:norm_(v[r][4]), active:on, n:(cnt[key] || 0), nStd:(std[key] || 0),
               by:norm_(v[r][6]), at:norm_(v[r][8]) });
  }
  return out;
}

function getTemplate(key, auth){
  requireLogin_(auth);
  key = norm_(key);
  var d = tplDb_(), r = tplRow_(d, key);
  if (r < 0) return null;
  var v = d.tpl.getRange(r, 1, 1, HDR_TPL.length).getDisplayValues()[0];
  return { head:{ key:norm_(v[0]), name:norm_(v[1]), kind:norm_(v[2]) || 'equip', model:norm_(v[3]),
                  note:norm_(v[4]), active:norm_(v[5]).toUpperCase() !== 'N' },
           items: tplItemsOf_(d, key) };
}

/** สร้าง/แก้หัวแม่แบบ — QC กับผู้ดูแลเท่านั้น (เป็นมาตรฐานของบริษัท ไม่ใช่ใครก็แก้ได้) */
function saveTemplate(h, auth){
  var me = requireAny_(auth, ['QC','APPROVER','ADMIN']);
  h = h || {};
  if (!norm_(h.name)) throw new Error('ต้องตั้งชื่อแม่แบบก่อน');
  var d = tplDb_(), key = norm_(h.key), r = key ? tplRow_(d, key) : -1;
  var kind = (norm_(h.kind) === 'tanker') ? 'tanker' : 'equip';
  if (r < 0){
    key = nextTplNo_();
    d.tpl.appendRow([key, norm_(h.name), kind, norm_(h.model), norm_(h.note),
                     h.active === false ? 'N' : 'Y', me.name, nowStamp_(), nowStamp_()]);
    log_('saveTemplate', key, 'สร้าง · ' + norm_(h.name));
  } else {
    d.tpl.getRange(r, 2, 1, 5).setValues([[norm_(h.name), kind, norm_(h.model), norm_(h.note),
                                           h.active === false ? 'N' : 'Y']]);
    d.tpl.getRange(r, 9).setValue(nowStamp_());
    log_('saveTemplate', key, 'แก้ไข · ' + norm_(h.name));
  }
  return { ok:true, key:key };
}

/** เขียนหัวข้อทั้งชุดใหม่ — เก็บรูป STD เดิมไว้ตามลำดับข้อที่ยังอยู่
 *  (ลบแล้วเขียนใหม่ทั้งชุด แม่แบบหนึ่งมีไม่กี่สิบข้อ ปลอดภัยกว่าไล่ merge ทีละแถว) */
function saveTemplateItems(key, items, auth){
  requireAny_(auth, ['QC','APPROVER','ADMIN']);
  key = norm_(key);
  if (!key) throw new Error('ไม่รู้ว่าเป็นหัวข้อของแม่แบบไหน');
  var d = tplDb_();
  if (tplRow_(d, key) < 0) throw new Error('ไม่พบแม่แบบ ' + key);

  var old = tplItemsOf_(d, key), keepStd = {};
  for (var o = 0; o < old.length; o++) keepStd[old[o].seq] = old[o];

  var lr = d.items.getLastRow();
  if (lr > 1){
    var v = d.items.getRange(2, 1, lr - 1, 1).getDisplayValues();
    for (var i = v.length - 1; i >= 0; i--) if (norm_(v[i][0]) === key) d.items.deleteRow(i + 2);
  }
  items = items || [];
  var rows = [];
  for (var k = 0; k < items.length; k++){
    var it = items[k] || {};
    if (!norm_(it.title) && !norm_(it.cat)) continue;
    /* รูป STD ผูกกับ "ลำดับข้อ" ที่ส่งมา — ถ้าหน้าเว็บส่ง stdId มาก็ใช้ตัวนั้น
       ไม่ส่งมาก็หยิบของเดิมที่ลำดับเดียวกันไว้ให้ ไม่ให้รูปหายเพราะแก้ข้อความ */
    var prev = keepStd[String(k + 1)] || {};
    var sid = (it.stdId !== undefined) ? norm_(it.stdId) : norm_(prev.stdId);
    var sth = (it.stdId !== undefined) ? norm_(it.stdThumb) : norm_(prev.stdThumb);
    var svw = (it.stdId !== undefined) ? norm_(it.stdView)  : norm_(prev.stdView);
    rows.push([key, k + 1, norm_(it.cat), norm_(it.title), norm_(it.titleEn),
               norm_(it.qty), norm_(it.unit), sid, sth, svw, norm_(it.note)]);
  }
  if (rows.length)
    d.items.getRange(d.items.getLastRow() + 1, 1, rows.length, HDR_TPLIT.length).setValues(rows);
  d.tpl.getRange(tplRow_(d, key), 9).setValue(nowStamp_());
  log_('saveTemplateItems', key, rows.length + ' หัวข้อ');
  return { ok:true, n:rows.length };
}

/** ปิดใช้งานแม่แบบ — ไม่ลบทิ้ง เพราะใบตรวจเก่าอ้างชื่อแม่แบบนี้อยู่ */
function setTemplateActive(key, on, auth){
  requireAny_(auth, ['QC','APPROVER','ADMIN']);
  var d = tplDb_(), r = tplRow_(d, norm_(key));
  if (r < 0) throw new Error('ไม่พบแม่แบบ ' + key);
  d.tpl.getRange(r, 6).setValue(on ? 'Y' : 'N');
  d.tpl.getRange(r, 9).setValue(nowStamp_());
  log_('setTemplateActive', norm_(key), on ? 'เปิดใช้' : 'ปิดใช้');
  return { ok:true };
}

/** ก๊อปแม่แบบทั้งชุด (รวมรูป STD) — ใช้ตอนทำรุ่นใหม่ที่คล้ายของเดิม */
function copyTemplate(key, newName, auth){
  var me = requireAny_(auth, ['QC','APPROVER','ADMIN']);
  var src = getTemplate(key, auth);
  if (!src) throw new Error('ไม่พบแม่แบบ ' + key);
  var d = tplDb_(), nk = nextTplNo_();
  d.tpl.appendRow([nk, norm_(newName) || (src.head.name + ' (สำเนา)'), src.head.kind, src.head.model,
                   src.head.note, 'Y', me.name, nowStamp_(), nowStamp_()]);
  var rows = [];
  for (var i = 0; i < src.items.length; i++){
    var it = src.items[i];
    rows.push([nk, i + 1, it.cat, it.title, it.titleEn, it.qty, it.unit,
               it.stdId, it.stdThumb, it.stdView, it.note]);
  }
  if (rows.length)
    d.items.getRange(d.items.getLastRow() + 1, 1, rows.length, HDR_TPLIT.length).setValues(rows);
  log_('copyTemplate', nk, 'ก๊อปจาก ' + key);
  return { ok:true, key:nk, n:rows.length };
}

/** แนบรูป STD ให้หัวข้อในแม่แบบ — เก็บใน Drive โฟลเดอร์ "แม่แบบเช็คลิสต์" */
function saveTplPhoto(key, seq, dataUrl, fname, auth){
  var me = requireAny_(auth, ['QC','APPROVER','ADMIN']);
  key = norm_(key); seq = norm_(seq);
  var d = tplDb_(), items = tplItemsOf_(d, key), hit = null;
  for (var i = 0; i < items.length; i++) if (items[i].seq === seq) hit = items[i];
  if (!hit) throw new Error('ไม่พบหัวข้อที่ ' + seq + ' ในแม่แบบ ' + key);

  var m = String(dataUrl || '').match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (!m) throw new Error('ไฟล์รูปไม่ถูกต้อง');
  var safe = key + '_ข้อ' + seq + '_' + new Date().getTime() + '.jpg';
  var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], norm_(fname) || safe);
  var f = mediaFolder_('แม่แบบเช็คลิสต์', key).createFile(blob);
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e){}

  var id = f.getId();
  var thumb = 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1000';
  var view  = 'https://drive.google.com/file/d/' + id + '/view';
  d.items.getRange(hit.row, 8, 1, 3).setValues([[id, thumb, view]]);
  d.tpl.getRange(tplRow_(d, key), 9).setValue(nowStamp_());
  log_('saveTplPhoto', key, 'ข้อ ' + seq);
  return { ok:true, id:id, thumb:thumb, view:view };
}

function delTplPhoto(key, seq, auth){
  requireAny_(auth, ['QC','APPROVER','ADMIN']);
  var d = tplDb_(), items = tplItemsOf_(d, norm_(key));
  for (var i = 0; i < items.length; i++){
    if (items[i].seq !== norm_(seq)) continue;
    d.items.getRange(items[i].row, 8, 1, 3).setValues([['', '', '']]);
    log_('delTplPhoto', norm_(key), 'ข้อ ' + seq);
    return { ok:true };
  }
  throw new Error('ไม่พบหัวข้อที่ ' + seq);
}

/** เดาแม่แบบให้จาก MODEL + ลักษณะงาน — ตรงรุ่นมาก่อน ไม่ตรงค่อยใช้ตัวกลาง ๆ ของลักษณะงานนั้น */
function suggestTemplate(model, kind, auth){
  var list = listTemplates(false, auth);
  model = norm_(model).toUpperCase();
  kind  = (norm_(kind) === 'tanker') ? 'tanker' : 'equip';
  var exact = null, sameKind = null;
  for (var i = 0; i < list.length; i++){
    var t = list[i];
    if (t.kind !== kind) continue;
    if (!sameKind) sameKind = t;
    var mm = norm_(t.model).toUpperCase();
    if (mm && model && (model.indexOf(mm) >= 0 || mm.indexOf(model) >= 0)){ exact = t; break; }
  }
  var pick = exact || sameKind;
  return pick ? { key:pick.key, name:pick.name, n:pick.n, exact:!!exact } : null;
}


/** ก๊อปรูป STD จากแม่แบบมาลงใบตรวจใบใหม่ — ชี้ไฟล์ Drive เดิม ไม่อัปซ้ำ ไม่กินที่
 *  ช่องรูป STD ในตารางตรวจใช้ลำดับ "S" + เลขข้อ (ดู opt.photos2 ใน js-grid.html) */
function copyStdFromTemplate_(docNo, tItems, byName){
  var out = [];
  for (var i = 0; i < tItems.length; i++){
    var it = tItems[i];
    if (!it.stdId) continue;
    out.push([docNo, 'S' + (i + 1), 1, 'STD_' + (i + 1) + '.jpg',
              it.stdId, it.stdThumb, it.stdView, 'Y', byName, nowStamp_(), 'Y']);
  }
  if (!out.length) return 0;
  var pt = photoTabOf_(docNo);
  pt.getRange(pt.getLastRow() + 1, 1, out.length, HDR_PHOTO.length).setValues(out);
  return out.length;
}


/** หาแม่แบบให้ได้เสมอ แม้หน้าเว็บส่งชื่อเก่ามา
 *  ลำดับ: รหัส TPL-xxxx ตรง ๆ → ชื่อแม่แบบตรง → รหัสเก่าที่เคยฝังในโค้ด (tanker/equipment/domestic)
 *         → เดาจาก MODEL + ลักษณะงาน → ตัวแรกของลักษณะงานนั้น
 *  เหตุผล: หน้าเว็บที่ยังไม่รีเฟรชจะส่งรหัสเก่ามา ห้ามให้เปิดใบแล้วได้ใบเปล่าโดยไม่มีใครรู้ */
function resolveTemplate_(key, model, kind, auth){
  key = norm_(key);
  if (key){
    var byKey = getTemplate(key, auth);
    if (byKey) return byKey;
  }
  var list = listTemplates(false, auth);
  var legacy = { tanker:'แท็งค์นำเข้า', equipment:'อุปกรณ์ประกอบแท็งค์', domestic:'สินค้าในประเทศ', blank:'ใบเปล่า' };
  var want = legacy[key] || key;
  for (var i = 0; i < list.length; i++){
    if (want && list[i].name.indexOf(want) >= 0) return getTemplate(list[i].key, auth);
  }
  var sug = suggestTemplate(model, kind, auth);
  return sug ? getTemplate(sug.key, auth) : null;
}
