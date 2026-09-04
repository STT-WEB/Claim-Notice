/**
 * STT CLAIM · แท็บ 2-4 ของใบเคลม + บันทึกอัตโนมัติ + รายงาน
 * ─────────────────────────────────────────────────────────────
 * แท็บ 1 ใบแจ้งเคลม          → อยู่ใน CLAIM-Hub.js
 * แท็บ 2 คำตอบจาก Supplier   → ไฟล์นี้
 * แท็บ 3 ใบเรียกเก็บค่าเคลม   → ไฟล์นี้ (สกุลเงิน · เรทล็อก · กำไร · ค่าแรง)
 * แท็บ 4 รับของกลับ + QC     → ไฟล์นี้
 *
 * กฎเหล็กที่ไฟล์นี้ต้องรักษา
 *  · เรทแลกเปลี่ยน "ล็อกติดใบถาวร" — ใส่แล้วแก้ไม่ได้ (ADMIN เท่านั้นที่แก้ได้ และมีบันทึก)
 *  · ไม่มี VAT
 *  · จำนวนใส่มายังไงเก็บตามนั้น ไม่ปัดเอง · เงินปัด 2 ตำแหน่งเสมอ
 *  · บันทึกทีละช่อง ไม่ส่งทั้งใบ = จอไม่เด้ง (เบียร์: "เหมือนทำใน GGS")
 */

var HDR_RET = ['เลขที่เอกสาร','ลำดับ','รายการที่','วันที่รับกลับ','จำนวนที่รับ',
               'ผลตรวจ','ผู้ตรวจ','หมายเหตุ','เมื่อ'];

var CURRENCIES = ['USD','CNY','EUR','GBP'];

var _RT = null;
function retTab_(){
  if (!_RT) _RT = ensureTab_(ss_(), 'RETURN_' + yearBE_(), HDR_RET);
  return _RT;
}

/* ═══════════ บันทึกทีละช่อง (หัวใบเคลม) ═══════════ */
var CLAIM_FIELD_COL = {
  claimType:4, area:5, foreignKind:6, jobNo:7, jobName:8, model:9,
  chassisStt:10, chassisMaker:11, serialNo:12, jmc:13, deliveryNote:14,
  dept:16, wantDate:17,
  currency:18, rate:19, rateDate:20, billCase:21,
  status:22, result:23, resultDetail:24, supplierNote:25
};

function saveClaimField(docNo, field, value, auth){
  var me = requireAny_(auth, ['PRODUCTION','QC','DESIGN','STORE','PURCHASE','APPROVER']);
  var col = CLAIM_FIELD_COL[field];
  if (!col) throw new Error('ไม่รู้จักช่อง ' + field);

  var d = db_(), r = findClaimRow_(d.claims, norm_(docNo));
  if (r < 0) throw new Error('ไม่พบใบเคลม ' + docNo);
  var v = norm_(value);

  /* ── เรทแลกเปลี่ยน: ใส่ได้ครั้งเดียว ล็อกติดใบถาวร ── */
  if (field === 'rate'){
    var cur = norm_(d.claims.getRange(r, 19).getDisplayValue());
    var isAdmin = (me.roles || [me.role]).indexOf('ADMIN') >= 0;
    if (cur && cur !== v && !isAdmin){
      throw new Error('เรทของใบนี้ล็อกไว้ที่ ' + cur + ' แล้ว แก้ไม่ได้ — ถ้าเรทผิดจริง ให้ผู้บริหารเป็นคนแก้');
    }
    if (cur && cur !== v && isAdmin) log_('rateOverride', docNo, cur + ' → ' + v);
    v = v === '' ? '' : money_(v);
    if (v && !norm_(d.claims.getRange(r, 20).getDisplayValue())){
      d.claims.getRange(r, 20).setValue(fmtDMY_(new Date()));      // จำวันที่ล็อกเรทให้เอง
    }
  }
  if (field === 'currency'){
    v = v.toUpperCase();
    if (v && CURRENCIES.indexOf(v) < 0) throw new Error('สกุลเงินต้องเป็น ' + CURRENCIES.join(' / '));
  }
  if (field === 'wantDate' || field === 'rateDate') v = fmtDMY_(v);
  if (field === 'jobNo') v = v.toUpperCase();

  d.claims.getRange(r, col).setValue(v);
  d.claims.getRange(r, HDR_CLAIM.length).setValue(nowStamp_());
  return { ok:true };
}

/* ═══════════ บันทึกทีละช่อง (รายการในใบเคลม) ═══════════ */
var ITEM_FIELD_COL = {
  code:3, name:4, th:5, en:6, qty:7, unit:8, po:9, supplier:10, recv:11,
  cost:12, margin:13, price:14, acc:15, note:16
};

function itemRow_(d, docNo, seq){
  var lr = d.items.getLastRow(); if (lr < 2) return -1;
  var v = d.items.getRange(2,1,lr-1,2).getDisplayValues();
  for (var i = 0; i < v.length; i++){
    if (norm_(v[i][0]) === norm_(docNo) && norm_(v[i][1]) === String(seq)) return i + 2;
  }
  return -1;
}

/** กำไรใส่ได้ 2 แบบ: "15%" = บวกเป็นเปอร์เซ็นต์ · "500" = บวกเป็นบาทตรง ๆ */
function calcPrice_(cost, margin){
  var c = num_(cost);
  var m = norm_(margin);
  if (!m) return money_(c);
  if (m.charAt(m.length - 1) === '%') return money_(c * (1 + num_(m.slice(0, -1)) / 100));
  return money_(c + num_(m));
}

function saveItemField(docNo, seq, field, value, auth){
  requireAny_(auth, ['PRODUCTION','QC','DESIGN','STORE','PURCHASE','APPROVER']);
  var col = ITEM_FIELD_COL[field];
  if (!col) throw new Error('ไม่รู้จักช่อง ' + field);
  var d = db_(), r = itemRow_(d, docNo, seq);
  if (r < 0) throw new Error('ไม่พบรายการที่ ' + seq);

  var v = norm_(value);
  if (field === 'recv') v = fmtDMY_(v);
  if (field === 'qty')  v = v === '' ? '' : num_(v);          // จำนวนไม่ปัด
  if (field === 'cost' || field === 'price') v = v === '' ? '' : money_(v);
  if (field === 'acc')  v = v.toUpperCase();

  d.items.getRange(r, col).setValue(v);

  /* แก้ต้นทุนหรือกำไร → คิดราคาเรียกเก็บให้ใหม่ทันที ผู้ใช้ไม่ต้องคิดเอง */
  var price = null;
  if (field === 'cost' || field === 'margin'){
    var cost   = (field === 'cost')   ? v : d.items.getRange(r, 12).getDisplayValue();
    var margin = (field === 'margin') ? v : d.items.getRange(r, 13).getDisplayValue();
    price = norm_(cost) === '' ? '' : calcPrice_(cost, margin);
    d.items.getRange(r, 14).setValue(price);
  }
  d.claims.getRange(findClaimRow_(d.claims, norm_(docNo)), HDR_CLAIM.length).setValue(nowStamp_());
  return { ok:true, price:price };
}

/** เพิ่มรายการเคลม 1 บรรทัด */
function addClaimItem(docNo, auth){
  requireAny_(auth, ['PRODUCTION','QC','DESIGN','STORE','PURCHASE','APPROVER']);
  var d = db_(), lr = d.items.getLastRow(), seq = 1;
  if (lr > 1){
    var v = d.items.getRange(2,1,lr-1,2).getDisplayValues();
    for (var i = 0; i < v.length; i++){
      if (norm_(v[i][0]) === norm_(docNo)) seq = Math.max(seq, num_(v[i][1]) + 1);
    }
  }
  d.items.appendRow([norm_(docNo), seq, '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
  return { ok:true, seq:seq };
}

/** ลบรายการเคลม (ลบรูปของรายการนั้นออกจากใบด้วย ไฟล์ยังอยู่ Drive) */
function delClaimItem(docNo, seq, auth){
  requireAny_(auth, ['PRODUCTION','QC','DESIGN','STORE','PURCHASE','APPROVER']);
  var d = db_(), r = itemRow_(d, docNo, seq);
  if (r > 0) d.items.deleteRow(r);
  return { ok:true };
}

/* ═══════════ แท็บ 3 · ค่าแรง (ลงเป็นก้อน ระบุว่าครอบคลุมข้อไหน) ═══════════ */
function listLabour(docNo, auth){
  requireLogin_(auth);
  var d = db_(), lr = d.labour.getLastRow(); if (lr < 2) return [];
  var v = d.labour.getRange(2,1,lr-1,HDR_LAB.length).getDisplayValues(), out = [];
  for (var i = 0; i < v.length; i++){
    if (norm_(v[i][0]) !== norm_(docNo)) continue;
    out.push({ seq:norm_(v[i][1]), th:norm_(v[i][2]), en:norm_(v[i][3]),
               covers:norm_(v[i][4]), supplier:norm_(v[i][5]), amount:norm_(v[i][6]) });
  }
  return out;
}

/** ค่าแรงมีไม่กี่บรรทัดต่อใบ — เขียนทับทั้งชุดปลอดภัยกว่าไล่ merge */
function saveLabour(docNo, rows, auth){
  requireAny_(auth, ['PURCHASE','PRODUCTION','APPROVER']);
  docNo = norm_(docNo);
  var d = db_(), lr = d.labour.getLastRow();
  if (lr > 1){
    var col = d.labour.getRange(2,1,lr-1,1).getDisplayValues();
    for (var i = col.length - 1; i >= 0; i--) if (norm_(col[i][0]) === docNo) d.labour.deleteRow(i + 2);
  }
  rows = rows || [];
  var out = [];
  for (var k = 0; k < rows.length; k++){
    var x = rows[k] || {};
    if (!norm_(x.th) && !norm_(x.amount)) continue;
    out.push([docNo, out.length + 1, norm_(x.th), norm_(x.en),
              norm_(x.covers), norm_(x.supplier),
              norm_(x.amount) === '' ? '' : money_(x.amount)]);
  }
  if (out.length) d.labour.getRange(d.labour.getLastRow()+1, 1, out.length, HDR_LAB.length).setValues(out);
  return { ok:true, n:out.length };
}

/** ยอดรวมใบเรียกเก็บ — แยกตาม Supplier เพราะ 1 ใบเคลมมีได้หลายเจ้า */
function claimTotals(docNo, auth){
  requireLogin_(auth);
  docNo = norm_(docNo);
  var d = db_(), r = findClaimRow_(d.claims, docNo);
  if (r < 0) return null;
  var cur  = norm_(d.claims.getRange(r, 18).getDisplayValue());
  var rate = num_(d.claims.getRange(r, 19).getDisplayValue());

  var bySup = {}, grand = 0;
  var lr = d.items.getLastRow();
  if (lr > 1){
    var v = d.items.getRange(2,1,lr-1,HDR_ITEM.length).getDisplayValues();
    for (var i = 0; i < v.length; i++){
      if (norm_(v[i][0]) !== docNo) continue;
      var sup = norm_(v[i][9]) || '(ไม่ระบุ Supplier)';
      var amt = money_(num_(v[i][6]) * num_(v[i][13]));
      if (!bySup[sup]) bySup[sup] = { items:0, labour:0 };
      bySup[sup].items += amt; grand += amt;
    }
  }
  var lab = listLabour(docNo, auth);
  for (var k = 0; k < lab.length; k++){
    var s2 = norm_(lab[k].supplier) || '(ไม่ระบุ Supplier)';
    if (!bySup[s2]) bySup[s2] = { items:0, labour:0 };
    bySup[s2].labour += num_(lab[k].amount);
    grand += num_(lab[k].amount);
  }

  var list = [];
  for (var s in bySup){
    var t = money_(bySup[s].items + bySup[s].labour);
    list.push({ supplier:s, items:money_(bySup[s].items), labour:money_(bySup[s].labour),
                thb:t, foreign: rate > 0 ? money_(t / rate) : '' });
  }
  list.sort(function(a,b){ return b.thb - a.thb; });
  grand = money_(grand);
  return { currency:cur, rate:rate || '', bySupplier:list,
           thb:grand, foreign: rate > 0 ? money_(grand / rate) : '' };
}

/* ═══════════ แท็บ 4 · รับของกลับ + QC กด Accept ═══════════ */
function listReturns(docNo, auth){
  requireLogin_(auth);
  var sh = retTab_(), lr = sh.getLastRow(); if (lr < 2) return [];
  var v = sh.getRange(2,1,lr-1,HDR_RET.length).getDisplayValues(), out = [];
  for (var i = 0; i < v.length; i++){
    if (norm_(v[i][0]) !== norm_(docNo)) continue;
    out.push({ seq:norm_(v[i][1]), itemSeq:norm_(v[i][2]), date:norm_(v[i][3]),
               qty:norm_(v[i][4]), acc:norm_(v[i][5]).toUpperCase(),
               by:norm_(v[i][6]), note:norm_(v[i][7]), at:norm_(v[i][8]) });
  }
  return out;
}

/** บันทึกการรับของกลับ 1 รอบ — Production/QC เท่านั้นที่กด Accept ได้ */
function saveReturn(docNo, rec, auth){
  var me = requireAny_(auth, ['PRODUCTION','QC','APPROVER']);
  docNo = norm_(docNo); rec = rec || {};
  var sh = retTab_(), lr = sh.getLastRow(), seq = 1;
  if (lr > 1){
    var v = sh.getRange(2,1,lr-1,2).getDisplayValues();
    for (var i = 0; i < v.length; i++) if (norm_(v[i][0]) === docNo) seq = Math.max(seq, num_(v[i][1]) + 1);
  }
  var acc = norm_(rec.acc).toUpperCase();
  if (acc && acc !== 'ACC' && acc !== 'UNACC') throw new Error('ผลตรวจต้องเป็น ACC หรือ UNACC');
  sh.appendRow([docNo, seq, norm_(rec.itemSeq), fmtDMY_(rec.date) || fmtDMY_(new Date()),
                norm_(rec.qty), acc, me.name, norm_(rec.note), nowStamp_()]);
  log_('saveReturn', docNo, 'ข้อ ' + norm_(rec.itemSeq) + ' → ' + acc);
  return { ok:true, seq:seq };
}

/** ของที่ QC ไม่ Accept → วนกลับเป็นใบเคลมรอบใหม่ (ตามที่เบียร์สั่ง) */
function reclaimFromReturn(docNo, auth){
  var me = requireAny_(auth, ['PRODUCTION','QC','PURCHASE','APPROVER']);
  docNo = norm_(docNo);
  var rets = listReturns(docNo, auth), bad = {};
  for (var i = 0; i < rets.length; i++) if (rets[i].acc === 'UNACC') bad[rets[i].itemSeq] = rets[i];
  var seqs = Object.keys(bad);
  if (!seqs.length) throw new Error('ยังไม่มีรายการที่ QC กด Un-Accept — ไม่มีอะไรต้องเคลมรอบใหม่');

  var c = getClaim(docNo, auth);
  if (!c) throw new Error('ไม่พบใบเคลม ' + docNo);
  var H = c.head, items = [];
  for (var k = 0; k < c.items.length; k++){
    if (!bad[String(c.items[k].seq)]) continue;
    var it = c.items[k];
    items.push({ code:it.code, name:it.name,
      th:it.th + ' — ของที่ส่งกลับมายังใช้ไม่ได้ (' + norm_(bad[String(it.seq)].note) + ')',
      en:it.en, qty:it.qty, unit:it.unit, po:it.po, supplier:it.supplier, recv:it.recv,
      note:'เคลมรอบใหม่ ต่อจาก ' + docNo + ' ข้อ ' + it.seq });
  }
  var res = createClaim({
    claimType:H['ประเภทการเคลม'], area:H['พื้นที่'], foreignKind:H['ชนิดงานต่างประเทศ'],
    jobNo:H['เลขที่ JOB'], jobName:H['ชื่อลูกค้า'], model:H['MODEL'],
    chassisStt:H['CHASSIS NO. (STT)'], chassisMaker:H['CHASSIS NO. (ผู้ผลิต)'],
    serialNo:H['SERIAL NO.'], jmc:H['JMC ที่ผูก'], dept:'QC / รับของกลับ',
    items:items
  }, auth);
  copyPhotosToDoc_(docNo, res.docNo, seqs, me.name);
  log_('reclaimFromReturn', docNo, '→ ' + res.docNo);
  return { ok:true, claimNo:res.docNo, n:items.length };
}

/* ═══════════ กล่อง 3 · All Data and Report ═══════════ */

/** 3.2 สรุปงานเคลมตามจ๊อบงาน — เลขจ๊อบคือแกนหลักของทั้งระบบ */
function reportByJob(auth){
  requireLogin_(auth);
  var claims = listClaims({}, auth), insp = listInspections({}, auth);
  var job = {};
  function slot(j){
    j = norm_(j) || '(ไม่ระบุจ๊อบ)';
    if (!job[j]) job[j] = { jobNo:j, jobName:'', type:typeFromJobNo_(j),
                            claims:0, inspections:0, open:0, items:0, photos:0, docs:[] };
    return job[j];
  }
  for (var i = 0; i < claims.length; i++){
    var s = slot(claims[i].jobNo);
    if (!s.jobName) s.jobName = claims[i].jobName;
    s.claims++; s.items += (claims[i].nItem || 0); s.photos += (claims[i].nPhoto || 0);
    if (claims[i].status !== 'CLOSED') s.open++;
    s.docs.push({ kind:'CLM', docNo:claims[i].docNo, date:claims[i].date, status:claims[i].status });
  }
  for (var k = 0; k < insp.length; k++){
    var s2 = slot(insp[k].jobNo);
    if (!s2.jobName) s2.jobName = insp[k].jobName;
    s2.inspections++; s2.photos += (insp[k].nPhoto || 0);
    s2.docs.push({ kind:'INS', docNo:insp[k].docNo, date:insp[k].date, status:insp[k].status });
  }
  var out = [];
  for (var j in job) out.push(job[j]);
  out.sort(function(a,b){ return a.jobNo < b.jobNo ? 1 : -1; });
  return out;
}

/** 3.3 ทะเบียนเอกสารรวม — ใบตรวจ + ใบเคลม อยู่ในตารางเดียว */
function reportDocs(auth){
  requireLogin_(auth);
  var out = [], claims = listClaims({}, auth), insp = listInspections({}, auth);
  for (var i = 0; i < claims.length; i++){
    out.push({ kind:'ใบเคลม', docNo:claims[i].docNo, date:claims[i].date,
      jobNo:claims[i].jobNo, jobName:claims[i].jobName,
      detail:(claims[i].claimType === 'pre' ? 'ก่อนส่งมอบ' : 'หลังส่งมอบ') + ' · ' +
             (claims[i].area === 'for' ? 'ต่างประเทศ' : 'ในประเทศ'),
      n:claims[i].nItem, photos:claims[i].nPhoto, status:claims[i].status, by:claims[i].by });
  }
  for (var k = 0; k < insp.length; k++){
    out.push({ kind:'ใบตรวจรับ', docNo:insp[k].docNo, date:insp[k].date,
      jobNo:insp[k].jobNo, jobName:insp[k].jobName,
      detail:insp[k].template + ' · Acc ' + insp[k].acc + ' / Un-Acc ' + insp[k].un,
      n:insp[k].n, photos:insp[k].nPhoto, status:insp[k].status, by:insp[k].by });
  }
  out.sort(function(a,b){ return a.docNo < b.docNo ? 1 : -1; });
  return out;
}

/** 3.4 สรุปต้นทุนการเคลม — เห็นเงิน = จำกัดสิทธิ์ */
function reportCost(auth){
  var me = requireAny_(auth, ['APPROVER','PURCHASE']);
  var d = db_(), lr = d.claims.getLastRow();
  if (lr < 2) return { rows:[], grand:0, canSee:true };

  var hdr = d.claims.getRange(1,1,1,HDR_CLAIM.length).getDisplayValues()[0];
  var rows = d.claims.getRange(2,1,lr-1,HDR_CLAIM.length).getDisplayValues();

  /* อ่านรายการและค่าแรงทีเดียวทั้งชีต แล้วรวมยอดในหน่วยความจำ */
  var sumItem = {}, lrI = d.items.getLastRow();
  if (lrI > 1){
    var vi = d.items.getRange(2,1,lrI-1,HDR_ITEM.length).getDisplayValues();
    for (var i = 0; i < vi.length; i++){
      var dn = norm_(vi[i][0]); if (!dn) continue;
      sumItem[dn] = (sumItem[dn] || 0) + num_(vi[i][6]) * num_(vi[i][13]);
    }
  }
  var sumLab = {}, lrL = d.labour.getLastRow();
  if (lrL > 1){
    var vl = d.labour.getRange(2,1,lrL-1,HDR_LAB.length).getDisplayValues();
    for (var k = 0; k < vl.length; k++){
      var dl = norm_(vl[k][0]); if (!dl) continue;
      sumLab[dl] = (sumLab[dl] || 0) + num_(vl[k][6]);
    }
  }

  var out = [], grand = 0;
  for (var r = rows.length - 1; r >= 0; r--){
    var o = {};
    for (var c = 0; c < hdr.length; c++) o[hdr[c]] = norm_(rows[r][c]);
    var dn2 = o['เลขที่เอกสาร'];
    var it = money_(sumItem[dn2] || 0), lb = money_(sumLab[dn2] || 0), tot = money_(it + lb);
    if (!tot) continue;                                   // ยังไม่มีเงิน = ยังไม่ออกใบเรียกเก็บ
    grand += tot;
    var rate = num_(o['อัตราแลกเปลี่ยน']);
    out.push({ docNo:dn2, date:o['วันที่'], jobNo:o['เลขที่ JOB'], jobName:o['ชื่อลูกค้า'],
      jmc:o['JMC ที่ผูก'], currency:o['สกุลเงิน'], rate:o['อัตราแลกเปลี่ยน'],
      items:it, labour:lb, thb:tot, foreign: rate > 0 ? money_(tot / rate) : '',
      status:o['สถานะ'] });
  }
  return { rows:out, grand:money_(grand), canSee:true, who:me.name };
}

/** 3.1 รูปและวิดีโอทั้งระบบ — จัดกลุ่มตามจ๊อบ → เอกสาร */
function reportMedia(auth){
  requireLogin_(auth);
  var pt = photoTab_(), lr = pt.getLastRow();
  if (lr < 2) return [];
  var v = pt.getRange(2,1,lr-1,HDR_PHOTO.length).getDisplayValues();

  /* เอกสาร → จ๊อบ (อ่านจากทั้งใบเคลมและใบตรวจ) */
  var jobOf = {}, nameOf = {};
  var d = db_(), lrC = d.claims.getLastRow();
  if (lrC > 1){
    var vc = d.claims.getRange(2,1,lrC-1,8).getDisplayValues();
    for (var i = 0; i < vc.length; i++){ jobOf[norm_(vc[i][0])] = norm_(vc[i][6]); nameOf[norm_(vc[i][0])] = norm_(vc[i][7]); }
  }
  var di = inspDb_(), lrIn = di.head.getLastRow();
  if (lrIn > 1){
    var vin = di.head.getRange(2,1,lrIn-1,7).getDisplayValues();
    for (var k = 0; k < vin.length; k++){ jobOf[norm_(vin[k][0])] = norm_(vin[k][5]); nameOf[norm_(vin[k][0])] = norm_(vin[k][6]); }
  }

  var byJob = {};
  for (var p = 0; p < v.length; p++){
    if (norm_(v[p][7]).toUpperCase() === 'N') continue;
    var doc = norm_(v[p][0]); if (!doc) continue;
    var j = jobOf[doc] || '(ไม่ทราบจ๊อบ)';
    if (!byJob[j]) byJob[j] = { jobNo:j, jobName:nameOf[doc] || '', n:0, docs:{} };
    if (!byJob[j].docs[doc]) byJob[j].docs[doc] = { docNo:doc, kind:(doc.indexOf('INS') === 0 ? 'ใบตรวจรับ' : 'ใบเคลม'), photos:[] };
    byJob[j].n++;
    if (byJob[j].docs[doc].photos.length < 12){
      byJob[j].docs[doc].photos.push({ seq:norm_(v[p][1]), thumb:norm_(v[p][5]), view:norm_(v[p][6]) });
    }
  }
  var out = [];
  for (var jj in byJob){
    var o2 = byJob[jj], docs = [];
    for (var dd in o2.docs) docs.push(o2.docs[dd]);
    docs.sort(function(a,b){ return a.docNo < b.docNo ? 1 : -1; });
    out.push({ jobNo:o2.jobNo, jobName:o2.jobName, n:o2.n, docs:docs });
  }
  out.sort(function(a,b){ return a.jobNo < b.jobNo ? 1 : -1; });
  return out;
}

/** หน้าแรก 3 กล่อง — v0.4.0 อ่านทีเดียวจบ
 *  เดิมเรียก listInspections + listClaims + photoCountByDoc_ ซึ่งแต่ละตัวเปิดไฟล์ใหม่หมด
 *  ตอนนี้เปิดไฟล์ครั้งเดียว อ่านเฉพาะคอลัมน์ที่ต้องใช้ แล้วนับในหน่วยความจำ */
function getHome2(auth){
  var me = requireLogin_(auth);

  var cache = CacheService.getScriptCache();
  var hit = cache.get('CLAIM_HOME');
  if (hit){
    try { var o = JSON.parse(hit); o.name = me.name; o.role = me.role; o.roles = me.roles || []; return o; }
    catch(e){}
  }

  var d = db_(), di = inspDb_();
  var out = {
    version:VERSION, name:me.name, role:me.role, roles:me.roles || [], year:yearBE_(),
    ins:{ total:0, open:0, noPhoto:0 },
    clm:{ total:0, open:0, noPhoto:0 },
    rep:{ photos:0, jobs:0 }
  };
  var jobs = {};

  /* ── ใบเคลม: อ่านคอลัมน์ A(เลขที่) G(จ๊อบ) V(สถานะ) พอ ── */
  var lrC = d.claims.getLastRow();
  var claimSeq = {};                                   // เลขที่ใบ -> ชุดลำดับรายการ
  if (lrC > 1){
    var vc = d.claims.getRange(2,1,lrC-1,22).getDisplayValues();
    for (var i = 0; i < vc.length; i++){
      var dn = norm_(vc[i][0]); if (!dn) continue;
      out.clm.total++;
      if (norm_(vc[i][21]) !== 'CLOSED') out.clm.open++;
      var j = norm_(vc[i][6]); if (j) jobs[j] = 1;
      claimSeq[dn] = {};
    }
  }
  var lrI = d.items.getLastRow();
  if (lrI > 1){
    var vi = d.items.getRange(2,1,lrI-1,2).getDisplayValues();
    for (var k = 0; k < vi.length; k++){
      var dk = norm_(vi[k][0]);
      if (claimSeq[dk]) claimSeq[dk][norm_(vi[k][1])] = false;   // false = ยังไม่มีรูป
    }
  }

  /* ── ใบตรวจรับ ── */
  var lrH = di.head.getLastRow();
  var insDocs = {};
  if (lrH > 1){
    var vh = di.head.getRange(2,1,lrH-1,7).getDisplayValues();
    for (var h = 0; h < vh.length; h++){
      var dh = norm_(vh[h][0]); if (!dh) continue;
      out.ins.total++;
      var jh = norm_(vh[h][5]); if (jh) jobs[jh] = 1;
      insDocs[dh] = { todo:0, un:0, photo:0 };
    }
  }
  var lrIt = di.items.getLastRow();
  if (lrIt > 1){
    var vit = di.items.getRange(2,1,lrIt-1,6).getDisplayValues();
    for (var t = 0; t < vit.length; t++){
      var dt = norm_(vit[t][0]); if (!insDocs[dt]) continue;
      var a = norm_(vit[t][5]).toUpperCase();
      if (a === 'UNACC') insDocs[dt].un++;
      else if (a !== 'ACC') insDocs[dt].todo++;
    }
  }

  /* ── รูป: อ่านครั้งเดียว ใช้ตอบทั้ง 3 กล่อง ── */
  var pt = photoTab_(), lrP = pt.getLastRow();
  if (lrP > 1){
    var vp = pt.getRange(2,1,lrP-1,8).getDisplayValues();
    for (var p = 0; p < vp.length; p++){
      if (norm_(vp[p][7]).toUpperCase() === 'N') continue;
      var pd = norm_(vp[p][0]); if (!pd) continue;
      out.rep.photos++;
      if (claimSeq[pd] && claimSeq[pd][norm_(vp[p][1])] === false) claimSeq[pd][norm_(vp[p][1])] = true;
      if (insDocs[pd]) insDocs[pd].photo++;
    }
  }

  for (var c in claimSeq){
    var seqs = claimSeq[c], miss = 0;
    for (var sq in seqs) if (!seqs[sq]) miss++;
    if (miss) out.clm.noPhoto++;
  }
  for (var n in insDocs){
    if (insDocs[n].todo > 0) out.ins.open++;
    if (insDocs[n].un > 0 && insDocs[n].photo === 0) out.ins.noPhoto++;
  }
  out.rep.jobs = Object.keys(jobs).length;

  cache.put('CLAIM_HOME', JSON.stringify(out), 20);   // 20 วิพอ — กดรีเฟรชแล้วเห็นของใหม่ทันที
  return out;
}

/** เปิดใบเคลม 1 ใบ — ส่งทุกอย่างกลับในคำสั่งเดียว
 *  เดิมยิง 3 คำสั่งเรียงกัน (getClaim → listLabour → listReturns) = รอ 3 รอบ
 *  ทุกรอบของ google.script.run กิน 0.5-1.5 วิ ต่อให้เซิร์ฟเวอร์เร็วแค่ไหนก็ช้าอยู่ดี */
function getClaimFull(docNo, auth){
  requireLogin_(auth);
  var c = getClaim(docNo, auth);
  if (!c) return null;
  c.labour  = listLabour(docNo, auth);
  c.returns = listReturns(docNo, auth);
  c.vendors = listVendors();
  return c;
}

/** เปิดใบตรวจ 1 ใบ — คำสั่งเดียวเหมือนกัน */
function getInspFull(docNo, auth){
  requireLogin_(auth);
  var c = getInspection(docNo, auth);
  if (!c) return null;
  c.vendors = listVendors();
  return c;
}

/* ═══════════ เติมข้อมูลให้อัตโนมัติในตาราง (v0.4.0) ═══════════
 * เบียร์: "ถ้าใส่รหัสสินค้า ให้มีหน่วยขึ้นมาเองเลย · ถ้าใส่ PO ให้มีวันที่รับสินค้ามาเลย"
 * ทำเป็น "ถามทีเดียวทั้งตาราง" ไม่ใช่ถามทีละช่อง — วางทับ 20 แถวก็ยิงคำสั่งเดียว */

/** ทะเบียนสินค้าจาก MASTER แท็บ Data Good Code */
function goodsMap_(){
  var cache = CacheService.getScriptCache();
  var hit = cache.get('CLAIM_GOODS');
  if (hit){ try { return JSON.parse(hit); } catch(e){} }

  var rows = readTab_(CFG.MASTER, 'Data Good Code') || [];
  var map = {};
  if (rows.length){
    var hr  = findHeaderRow_(rows, ['goodcode','good code','รหัสสินค้า'], 8);
    var hdr = rows[hr];
    var iC = colIdx_(hdr, ['goodcode','good code','รหัสสินค้า']);
    var iN = colIdx_(hdr, ['goodname','good name','ชื่อสินค้า']);
    var iU = colIdx_(hdr, ['unit','หน่วย']);
    for (var r = hr + 1; r < rows.length; r++){
      var code = norm_(iC >= 0 ? rows[r][iC] : ''); if (!code) continue;
      if (map[code.toUpperCase()]) continue;
      map[code.toUpperCase()] = { name:norm_(iN >= 0 ? rows[r][iN] : ''),
                                  unit:norm_(iU >= 0 ? rows[r][iU] : '') };
    }
  }
  try { cache.put('CLAIM_GOODS', JSON.stringify(map), 1800); } catch(e){}   // ใหญ่เกิน cache ก็ไม่เป็นไร
  return map;
}

/** ใส่รหัสสินค้ามาเป็นชุด → คืนชื่อ + หน่วย */
function lookupGoods(codes, auth){
  requireLogin_(auth);
  var map = goodsMap_(), out = {};
  codes = codes || [];
  for (var i = 0; i < codes.length; i++){
    var c = norm_(codes[i]).toUpperCase(); if (!c) continue;
    if (map[c]) out[norm_(codes[i])] = map[c];
  }
  return out;
}

/** ใส่เลข PO มาเป็นชุด → คืนวันรับสินค้า (จาก PO Report ของปีนั้น)
 *  หาไม่เจอก็ไม่เป็นไร เบียร์พิมพ์วันที่เองได้ ช่องไม่ได้ล็อก */
function lookupPoDates(pos, auth){
  requireLogin_(auth);
  pos = pos || [];
  var want = {}, years = {};
  for (var i = 0; i < pos.length; i++){
    var po = norm_(pos[i]); if (!po) continue;
    want[po.toUpperCase()] = po;
    var m = po.match(/(\d\d)\s*\/|-(\d\d)\//);      // POR-69/0123 หรือ 69/0123
    var yy = m ? (m[1] || m[2]) : '';
    if (yy) years[2500 + parseInt(yy, 10)] = 1;
  }
  if (!Object.keys(want).length) return {};
  if (!Object.keys(years).length) years[yearBE_()] = 1;

  var out = {};
  for (var y in years){
    var fid = POREPORT[y]; if (!fid) continue;
    var rows;
    try { rows = readTab_(fid, 'PO Report') || readTab_(fid, 'Sheet1') || []; } catch(e){ continue; }
    if (!rows.length) continue;
    var hr  = findHeaderRow_(rows, ['po no','pono','เลขที่ po','por'], 8);
    var hdr = rows[hr];
    var iP = colIdx_(hdr, ['po no','pono','เลขที่ po','por']);
    var iD = colIdx_(hdr, ['วันที่รับ','receive','recv','rr date','วันรับ']);
    if (iP < 0 || iD < 0) continue;
    for (var r = hr + 1; r < rows.length; r++){
      var key = norm_(rows[r][iP]).toUpperCase();
      if (!want[key] || out[want[key]]) continue;
      var dt = fmtDMY_(rows[r][iD]);
      if (dt) out[want[key]] = dt;
    }
  }
  return out;
}

/* ═══════════ รูปแนบก่อนบันทึก (v0.4.0) ═══════════
 * เบียร์: "มันควรจะต้องมีให้ใส่รูปเลยไหม" — ต้องแนบรูปได้ตั้งแต่ยังไม่กดบันทึก
 * ปัญหา: ตอนนั้นยังไม่มีเลขที่เอกสาร แล้วจะผูกรูปกับอะไร
 * ทางที่เลือก: เก็บชั่วคราวใต้คีย์ DRAFT-xxxx แล้วตอนกดบันทึกค่อยย้ายมาเป็นเลขจริง
 *   → ไม่ต้องจองเลขเอกสารไว้ล่วงหน้า = เลขที่เอกสารไม่ขาดช่วงถ้าเปิดฟอร์มทิ้งไว้แล้วไม่บันทึก
 *     (กฎเลขเรียงของเบียร์ยังอยู่ครบ) */
function newDraftId(){
  return 'DRAFT-' + Utilities.getUuid().slice(0, 8).toUpperCase();
}

/** ย้ายรูปที่แนบไว้ตอนร่าง มาเป็นของเอกสารจริง + ย้ายโฟลเดอร์ใน Drive ตามไปด้วย
 *  seqMap = { รหัสแถวตอนร่าง : ลำดับรายการจริง } — แถวที่เว้นว่างไว้ถูกตัดออกตอนบันทึก
 *  ลำดับจึงเลื่อน ต้องแปลงให้ตรง ไม่งั้นรูปไปติดผิดรายการ */
function claimDraftPhotos_(draftId, docNo, jobNo, seqMap, byName){
  draftId = norm_(draftId); if (!draftId) return 0;
  seqMap = seqMap || {};
  var pt = photoTab_(), lr = pt.getLastRow();
  if (lr < 2) return 0;
  var v = pt.getRange(2,1,lr-1,HDR_PHOTO.length).getDisplayValues();
  var n = 0;
  for (var i = 0; i < v.length; i++){
    if (norm_(v[i][0]) !== draftId) continue;
    var newSeq = seqMap[norm_(v[i][1])];
    if (newSeq == null) continue;                     // แถวนั้นไม่ได้ถูกบันทึก = รูปไม่ต้องย้าย
    pt.getRange(i + 2, 1).setValue(docNo);
    pt.getRange(i + 2, 2).setValue(newSeq);
    n++;
    try {                                        // ย้ายไฟล์ไปโฟลเดอร์ของเลขจริง
      var f = DriveApp.getFileById(norm_(v[i][4]));
      var dest = mediaFolder_(jobNo, docNo);
      dest.addFile(f);
      var ps = f.getParents();
      while (ps.hasNext()){ var pf = ps.next(); if (pf.getId() !== dest.getId()) pf.removeFile(f); }
    } catch(e){}
  }
  if (n) log_('claimDraftPhotos', docNo, draftId + ' → ' + n + ' รูป');
  return n;
}

/** เปิดใบแจ้งเคลม พร้อมรูปที่แนบไว้ตั้งแต่ยังไม่บันทึก — จบในคำสั่งเดียว */
function createClaimWithPhotos(h, draftId, seqMap, auth){
  var res = createClaim(h, auth);
  if (res && res.ok && norm_(draftId)){
    var me = whoAmI_(auth);
    claimDraftPhotos_(draftId, res.docNo, norm_(h.jobNo).toUpperCase(), seqMap, me.name);
  }
  try { CacheService.getScriptCache().remove('CLAIM_HOME'); } catch(e){}
  return res;
}



/** v0.3.0 — แทนที่ตัวเดิม: นับเฉพาะรูปที่ผูกกับ "รายการจริง" ในใบเคลม
 *  ถ้านับรูปของกล่องอื่น (เช่นรูปของที่รับกลับ ซึ่งใช้คีย์ "R") ปนเข้ามา
 *  ใบที่รายการยังไม่มีรูปเลยจะกลายเป็น "รูปครบ" ทั้งที่ยังขาด — ผิดแบบเงียบ ๆ */
function photoCoverage_(){
  var res = { item:{}, photo:{}, noPhoto:{} };
  var seqOf = {};                                   // docNo -> { ลำดับรายการจริง: true }
  var d = db_();

  var lrI = d.items.getLastRow();
  if (lrI >= 2){
    var vi = d.items.getRange(2,1,lrI-1,2).getDisplayValues();
    for (var i = 0; i < vi.length; i++){
      var dn = norm_(vi[i][0]); if (!dn) continue;
      res.item[dn] = (res.item[dn] || 0) + 1;
      if (!seqOf[dn]) seqOf[dn] = {};
      seqOf[dn][norm_(vi[i][1])] = true;
    }
  }

  var seen = {}, pt = photoTab_(), lrP = pt.getLastRow();
  if (lrP >= 2){
    var vp = pt.getRange(2,1,lrP-1,HDR_PHOTO.length).getDisplayValues();
    for (var k = 0; k < vp.length; k++){
      if (norm_(vp[k][7]).toUpperCase() === 'N') continue;
      var dn2 = norm_(vp[k][0]); if (!dn2) continue;
      var sq  = norm_(vp[k][1]);
      if (!seqOf[dn2] || !seqOf[dn2][sq]) continue;          // ไม่ใช่รายการจริง = ไม่นับ
      res.photo[dn2] = (res.photo[dn2] || 0) + 1;
      if (!seen[dn2]) seen[dn2] = {};
      seen[dn2][sq] = true;
    }
  }

  for (var dk in res.item){
    var have = seen[dk] ? Object.keys(seen[dk]).length : 0;
    res.noPhoto[dk] = Math.max(0, res.item[dk] - have);
  }
  return res;
}

/* ═══════════ แปลไทย → อังกฤษ (v0.4.1) ═══════════
 * เบียร์: "Claim description (EN) จะแปลให้เลยปะ"
 *
 * ใช้ LanguageApp ที่ติดมากับ Apps Script — ฟรี ไม่ต้องต่อ API ข้างนอก ไม่ต้องมีบัตร
 * ข้อจำกัดที่ต้องรู้ (ไม่ปิดบัง):
 *   · ศัพท์ช่างเฉพาะทางมันแปลได้ไม่เนียน เช่น "ประเก็น" อาจได้ "gasket" (ถูก)
 *     แต่ "หน้าแปลน" บางทีได้ "front flange" (เพี้ยน) — เอกสารส่ง Supplier ต้องอ่านทวนก่อนส่งเสมอ
 *   · จึงมีปุ่ม "ตรวจคำแปล" แปลกลับเป็นไทยให้ดู ถ้าแปลกลับแล้วความหมายเพี้ยน = คำแปลนั้นใช้ไม่ได้
 *   · มีโควตาต่อวัน จึงแปลทีเดียวทั้งตาราง + จำคำที่เคยแปลไว้ ไม่ยิงซ้ำ
 * ทุกช่องยังพิมพ์ทับเองได้เสมอ ระบบไม่เคยล็อก                                        */

function tr_(text, from, to){
  text = norm_(text);
  if (!text) return '';
  var key = 'TR_' + from + to + '_' + Utilities.base64Encode(
              Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, text));
  var cache = CacheService.getScriptCache();
  var hit = cache.get(key);
  if (hit != null) return hit;
  var out = '';
  try { out = LanguageApp.translate(text, from, to); } catch(e){ out = ''; }
  if (out) { try { cache.put(key, out, 21600); } catch(e){} }   // จำไว้ 6 ชม.
  return out;
}

/** แปลทีเดียวหลายช่อง — ส่งมาเป็น array คืนเป็น array ตำแหน่งตรงกัน */
function translateBatch(texts, from, to, auth){
  requireLogin_(auth);
  texts = texts || [];
  var out = [];
  for (var i = 0; i < texts.length; i++) out.push(tr_(texts[i], from || 'th', to || 'en'));
  return out;
}

/** แปลกลับเป็นไทยให้ตรวจ — ถ้าแปลกลับแล้วความหมายเพี้ยน แปลว่าคำอังกฤษนั้นใช้ไม่ได้ */
function translateCheck(pairs, auth){
  requireLogin_(auth);
  pairs = pairs || [];
  var out = [];
  for (var i = 0; i < pairs.length; i++){
    var th = norm_(pairs[i].th), en = norm_(pairs[i].en);
    if (!en) continue;
    out.push({ seq:pairs[i].seq, th:th, en:en, back:tr_(en, 'en', 'th') });
  }
  return out;
}
