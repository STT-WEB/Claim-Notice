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

var HDR_INSP = ['เลขที่เอกสาร','ชนิดเอกสาร','วันที่','พื้นที่','ชนิดงาน',
  'เลขที่ JOB','ชื่อลูกค้า','MODEL','CHASSIS NO. (STT)','CHASSIS NO. (ผู้ผลิต)','SERIAL NO.',
  'แม่แบบเช็คลิสต์','PO','Supplier','วันรับสินค้า','ผู้ตรวจ',
  'สถานะ','ใบเคลมที่ออกจากใบนี้','หมายเหตุ','สร้างโดย','สร้างเมื่อ','แก้ไขล่าสุด'];

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

function inspDb_(){
  if (_IDB) return _IDB;                    // v0.4.0 — เปิดไฟล์ครั้งเดียวต่อคำสั่ง
  var ss = ss_(), be = yearBE_();
  _IDB = {
    ss    : ss,
    head  : ensureTab_(ss, 'INSP_'    + be, HDR_INSP),
    items : ensureTab_(ss, 'INSPIT_'  + be, HDR_INSPIT)
  };
  return _IDB;
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
  var tplKey = norm_(h.template) || 'equipment';
  var tpl = INSP_TEMPLATES[tplKey] || INSP_TEMPLATES.equipment;

  d.head.appendRow([
    docNo, 'INSPECTION', fmtDMY_(new Date()), norm_(h.area) || 'for', norm_(h.kind) || 'tanker',
    norm_(h.jobNo).toUpperCase(), norm_(h.jobName), norm_(h.model),
    norm_(h.chassisStt), norm_(h.chassisMaker), norm_(h.serialNo),
    tpl.name, norm_(h.po), norm_(h.supplier), fmtDMY_(h.recv), me.name,
    'DRAFT', '', '', me.name, nowStamp_(), nowStamp_()
  ]);

  var rows = [];
  for (var i = 0; i < tpl.items.length; i++){
    rows.push([docNo, i + 1, tpl.items[i][0], tpl.items[i][1], tpl.items[i][2],
               '', '', '', '', '', '', '', '']);
  }
  if (rows.length) d.items.getRange(d.items.getLastRow()+1, 1, rows.length, HDR_INSPIT.length).setValues(rows);

  log_('createInspection', docNo, norm_(h.jobNo) + ' · ' + tpl.name);
  return { ok:true, docNo:docNo, n:rows.length };
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
  var d = inspDb_(), r = findInspRow_(d.head, docNo);
  if (r < 0) return null;
  var hdr = d.head.getRange(1,1,1,HDR_INSP.length).getDisplayValues()[0];
  var row = d.head.getRange(r,1,1,HDR_INSP.length).getDisplayValues()[0];
  var head = {};
  for (var i = 0; i < hdr.length; i++) head[hdr[i]] = norm_(row[i]);
  return { head:head, items:inspItemsOf_(d, docNo), photos:listPhotos(docNo, auth) };
}

/** ทะเบียนใบตรวจ + นับผลตรวจให้เห็นตั้งแต่ยังไม่เปิดใบ */
function listInspections(filter, auth){
  requireLogin_(auth);
  filter = filter || {};
  var d = inspDb_(), lr = d.head.getLastRow();
  if (lr < 2) return [];
  var hdr = d.head.getRange(1,1,1,HDR_INSP.length).getDisplayValues()[0];
  var rows = d.head.getRange(2,1,lr-1,HDR_INSP.length).getDisplayValues();

  /* นับผลตรวจของทุกใบทีเดียว แล้วค่อยแจก — ไม่วนอ่านทีละใบ */
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
  var pho = photoCountByDoc_();

  var out = [];
  for (var i = rows.length - 1; i >= 0; i--){
    var o = {};
    for (var j = 0; j < hdr.length; j++) o[hdr[j]] = norm_(rows[i][j]);
    if (filter.jobNo && o['เลขที่ JOB'].toUpperCase() !== norm_(filter.jobNo).toUpperCase()) continue;
    if (filter.q){
      var q = norm_(filter.q).toLowerCase();
      var hay = (o['เลขที่เอกสาร'] + ' ' + o['เลขที่ JOB'] + ' ' + o['ชื่อลูกค้า'] + ' ' + o['Supplier']).toLowerCase();
      if (hay.indexOf(q) < 0) continue;
    }
    var c = cnt[o['เลขที่เอกสาร']] || { n:0, acc:0, un:0, todo:0 };
    out.push({
      docNo:o['เลขที่เอกสาร'], date:o['วันที่'], area:o['พื้นที่'], kind:o['ชนิดงาน'],
      jobNo:o['เลขที่ JOB'], jobName:o['ชื่อลูกค้า'], model:o['MODEL'],
      supplier:o['Supplier'], template:o['แม่แบบเช็คลิสต์'], status:o['สถานะ'],
      claimNo:o['ใบเคลมที่ออกจากใบนี้'], by:o['สร้างโดย'],
      n:c.n, acc:c.acc, un:c.un, todo:c.todo,
      nPhoto:(pho[o['เลขที่เอกสาร']] || 0)
    });
    if (out.length >= 500) break;
  }
  return out;
}

/** นับรูปต่อเอกสาร (ใช้ได้ทั้ง CLM และ INS) */
function photoCountByDoc_(){
  var out = {}, pt = photoTab_(), lr = pt.getLastRow();
  if (lr < 2) return out;
  var v = pt.getRange(2,1,lr-1,HDR_PHOTO.length).getDisplayValues();
  for (var i = 0; i < v.length; i++){
    if (norm_(v[i][7]).toUpperCase() === 'N') continue;
    var dn = norm_(v[i][0]); if (!dn) continue;
    out[dn] = (out[dn] || 0) + 1;
  }
  return out;
}

/* ─────────── บันทึกทีละช่อง (แบบ Google Sheets) ───────────
 * เบียร์: "เมื่อพิมแล้ว ต้องบันทึกเองเลย เหมือนทำใน GGS · ห้ามเด้งขึ้นลงเอง"
 * → ทุกฟังก์ชันนี้เขียนแค่ "ช่องเดียว" แล้วจบ ไม่ส่งข้อมูลทั้งใบกลับมา
 *   หน้าเว็บจึงไม่ต้องวาดใหม่ = จอไม่เด้ง focus ไม่หลุด                */
var INSP_FIELD_COL = {
  area:4, kind:5, jobNo:6, jobName:7, model:8, chassisStt:9, chassisMaker:10,
  serialNo:11, po:13, supplier:14, recv:15, inspector:16, status:17, note:19
};
function saveInspHeadField(docNo, field, value, auth){
  requireAny_(auth, ['QC','PRODUCTION','STORE','PURCHASE','DESIGN','APPROVER']);
  var col = INSP_FIELD_COL[field];
  if (!col) throw new Error('ไม่รู้จักช่อง ' + field);
  var d = inspDb_(), r = findInspRow_(d.head, norm_(docNo));
  if (r < 0) throw new Error('ไม่พบใบตรวจ ' + docNo);
  var v = norm_(value);
  if (field === 'recv') v = fmtDMY_(v);
  if (field === 'jobNo') v = v.toUpperCase();
  d.head.getRange(r, col).setValue(v);
  d.head.getRange(r, HDR_INSP.length).setValue(nowStamp_());
  return { ok:true };
}

var INSPIT_FIELD_COL = { cat:3, title:4, titleEn:5, acc:6, found:7, foundEn:8, qty:9, unit:10 };
function saveInspItemField(docNo, seq, field, value, auth){
  var me = requireAny_(auth, ['QC','PRODUCTION','STORE','PURCHASE','DESIGN','APPROVER']);
  var col = INSPIT_FIELD_COL[field];
  if (!col) throw new Error('ไม่รู้จักช่อง ' + field);
  var d = inspDb_(), lr = d.items.getLastRow();
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
  var d = inspDb_(), list = inspItemsOf_(d, norm_(docNo));
  var seq = 1;
  for (var i = 0; i < list.length; i++) seq = Math.max(seq, num_(list[i].seq) + 1);
  d.items.appendRow([norm_(docNo), seq, '', '', '', '', '', '', '', '', '', '', '']);
  return { ok:true, seq:seq };
}

/** ลบหัวข้อตรวจ (ลบได้เฉพาะข้อที่ยังไม่ได้ส่งไปเคลม) */
function delInspItem(docNo, seq, auth){
  requireAny_(auth, ['QC','PRODUCTION','STORE','PURCHASE','DESIGN','APPROVER']);
  var d = inspDb_(), lr = d.items.getLastRow();
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
function inspCheck(docNo, auth){
  requireLogin_(auth);
  docNo = norm_(docNo);
  var items = inspItemsOf_(inspDb_(), docNo);
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
  var me = requireAny_(auth, ['QC','PRODUCTION','STORE','PURCHASE','APPROVER']);
  docNo = norm_(docNo);
  var chk = inspCheck(docNo, auth);
  if (!chk.ok) throw new Error(chk.msg);

  var d = inspDb_(), r = findInspRow_(d.head, docNo);
  if (r < 0) throw new Error('ไม่พบใบตรวจ ' + docNo);
  var hdr = d.head.getRange(1,1,1,HDR_INSP.length).getDisplayValues()[0];
  var hrow = d.head.getRange(r,1,1,HDR_INSP.length).getDisplayValues()[0];
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

  var res = createClaim({
    claimType:'pre', area:H['พื้นที่'], foreignKind:H['ชนิดงาน'],
    jobNo:H['เลขที่ JOB'], jobName:H['ชื่อลูกค้า'], model:H['MODEL'],
    chassisStt:H['CHASSIS NO. (STT)'], chassisMaker:H['CHASSIS NO. (ผู้ผลิต)'],
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
  d.head.getRange(r, 18).setValue(res.docNo);
  d.head.getRange(r, 17).setValue('ส่งเคลมแล้ว');
  d.head.getRange(r, HDR_INSP.length).setValue(nowStamp_());

  log_('sendUnAccToClaim', docNo, '→ ' + res.docNo + ' (' + claimItems.length + ' ข้อ)');
  return { ok:true, claimNo:res.docNo, n:claimItems.length };
}

/** ก๊อปแถวรูปจากเอกสารหนึ่งไปอีกเอกสาร — ชี้ไฟล์ Drive เดิม ไม่สร้างไฟล์ใหม่ */
function copyPhotosToDoc_(fromDoc, toDoc, seqList, byName){
  var pt = photoTab_(), lr = pt.getLastRow();
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
