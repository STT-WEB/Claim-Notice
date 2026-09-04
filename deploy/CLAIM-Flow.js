/**
 * STT CLAIM · ขั้นตอนงานและหน้าที่ (v0.5.0)
 * ─────────────────────────────────────────────────────────────
 * เบียร์ออกแบบ 4 ก.ย. 2569:
 *   ขั้น 1  Production / Sales / QC / Design  → กรอกข้อมูลที่ตัวเองรู้ + รายการที่เคลม
 *   ขั้น 2  สโตร์                              → เลขใบส่งมอบ · PO · Supplier   (เด้ง LINE)
 *   ขั้น 3  จัดซื้อ                            → ตรวจว่าครบไหม → Accept หรือ ตีกลับ (เด้ง LINE)
 *   ขั้น 4  จัดซื้อ                            → ส่ง Supplier · รับคำตอบ · ออกใบเรียกเก็บ
 *   ขั้น 5  QC / Production                    → รับของกลับ ตรวจรับ
 *   ขั้น 6  ปิดงาน
 *
 * หลักที่เบียร์วางไว้ (ต่างจาก NOVA ที่แบ่งด้วยเมนู):
 *   · เอกสารใบเดียว **ทุกคนเห็นข้อมูลทั้งหมด** ไม่มีใครถูกซ่อนอะไร
 *   · แต่ **ทำงานแทนกันไม่ได้** — แก้ได้เฉพาะช่องของขั้นตัวเอง
 *   · ยกเว้น **สโตร์กับจัดซื้อช่วยกันได้** (เบียร์สั่งไว้ชัด)
 *   · ตีกลับได้ ระบุเหตุผล แล้วเอกสารเด้งกลับไปขั้นนั้นให้แก้
 */

/* ─────────── นิยามขั้นตอน ─────────── */
var STAGES = [
  { key:'REQUEST', no:1, name:'แจ้งเคลม',
    who:'Production / Sales / QC / Design',
    roles:['PRODUCTION','SALES','QC','DESIGN'],
    todo:'กรอกข้อมูลรถและรายการที่เคลม พร้อมแนบรูปทุกรายการ',
    next:'STORE', nextLabel:'➜ ส่งให้สโตร์เติม PO', lineKey:'STORE' },

  { key:'STORE', no:2, name:'สโตร์เติมข้อมูล',
    who:'สโตร์ (จัดซื้อช่วยได้)',
    roles:['STORE','PURCHASE'],
    todo:'เติมเลขใบส่งมอบ · PO · Supplier ของแต่ละรายการ',
    next:'PURCHASE', nextLabel:'➜ ส่งให้จัดซื้อตรวจ', lineKey:'PURCHASE' },

  { key:'PURCHASE', no:3, name:'จัดซื้อตรวจข้อมูล',
    who:'จัดซื้อ (สโตร์ช่วยได้)',
    roles:['PURCHASE','STORE'],
    todo:'ตรวจว่าข้อมูลตรงและครบหรือยัง ถ้าครบกด Accept ถ้าไม่ครบตีกลับพร้อมเหตุผล',
    next:'SUPPLIER', nextLabel:'✓ Accept — ข้อมูลครบ พร้อมส่ง Supplier', lineKey:'' },

  { key:'SUPPLIER', no:4, name:'ส่ง Supplier · รอคำตอบ',
    who:'จัดซื้อ (สโตร์ช่วยได้)',
    roles:['PURCHASE','STORE'],
    todo:'ส่งเอกสารให้ Supplier · บันทึกคำตอบที่ได้ · ออกใบเรียกเก็บถ้า STT ต้องซื้อ/ซ่อมเอง',
    next:'RETURN', nextLabel:'➜ ของกลับมาแล้ว ส่งให้ QC ตรวจรับ', lineKey:'QC' },

  { key:'RETURN', no:5, name:'รับของกลับ + QC',
    who:'QC / Production',
    roles:['QC','PRODUCTION'],
    todo:'ถ่ายรูปของที่ได้กลับมา แล้วกด Accept / ไม่ Accept',
    next:'CLOSED', nextLabel:'✓ ปิดงานเคลม', lineKey:'' },

  { key:'CLOSED', no:6, name:'ปิดงานแล้ว',
    who:'—', roles:[], todo:'งานนี้จบแล้ว', next:'', nextLabel:'', lineKey:'' }
];

function stageDef_(key){
  key = norm_(key) || 'REQUEST';
  for (var i = 0; i < STAGES.length; i++) if (STAGES[i].key === key) return STAGES[i];
  return STAGES[0];
}

/* ─────────── ช่องไหนเป็นของขั้นไหน ───────────
 * 'ALWAYS:<ขั้น>' = เจ้าของคือคนขั้นนั้น แต่แก้ได้ทุกเมื่อ ไม่ต้องรอถึงขั้น
 *   ใช้กับ JMC — เบียร์: "ใส่ข้อมูล JMC ที่ผูก อันนี้มันจะมาทีหลังเลย" และคนเปิดใบเป็นคนใส่
 * '*' = ใครก็ได้ที่ล็อกอิน                                                       */
var FIELD_STAGE = {
  claimType:'REQUEST', area:'REQUEST', foreignKind:'REQUEST',
  jobNo:'REQUEST', jobName:'REQUEST', model:'REQUEST',
  chassisStt:'REQUEST', chassisMaker:'REQUEST', serialNo:'REQUEST',
  dept:'REQUEST', wantDate:'REQUEST',
  jmc:'ALWAYS:REQUEST',

  deliveryNote:'STORE',

  currency:'SUPPLIER', rate:'SUPPLIER', rateDate:'SUPPLIER', billCase:'SUPPLIER',
  result:'SUPPLIER', resultDetail:'SUPPLIER', supplierNote:'SUPPLIER',

  status:'*'
};

var ITEM_STAGE = {
  code:'REQUEST', name:'REQUEST', th:'REQUEST', en:'REQUEST',
  qty:'REQUEST', unit:'REQUEST', recv:'REQUEST',
  po:'STORE', supplier:'STORE',
  cost:'SUPPLIER', margin:'SUPPLIER', price:'SUPPLIER',
  acc:'*', note:'*'
};

/** ตัดสินว่าคนนี้แก้ช่องนี้ได้ไหม ณ ขั้นตอนปัจจุบัน — เหตุผลบอกเป็นภาษาคน */
function canEditField_(curStage, field, map, me){
  var mine = (me.roles && me.roles.length) ? me.roles : [me.role];
  if (mine.indexOf('ADMIN') >= 0) return { ok:true };

  var spec = map[field];
  if (!spec) return { ok:false, why:'ไม่รู้จักช่องนี้' };
  if (spec === '*') return { ok:true };

  var always = false, key = spec;
  if (spec.indexOf('ALWAYS:') === 0){ always = true; key = spec.slice(7); }

  var owner = stageDef_(key);
  var isOwner = false;
  for (var i = 0; i < mine.length; i++) if (owner.roles.indexOf(mine[i]) >= 0) isOwner = true;
  if (!isOwner){
    return { ok:false, why:'ช่องนี้เป็นหน้าที่ของ ' + owner.who + ' — สิทธิ์ของคุณคือ ' + mine.join(', ') };
  }
  if (always) return { ok:true };

  if (norm_(curStage) !== key){
    var cur = stageDef_(curStage);
    return { ok:false, why:'ตอนนี้เอกสารอยู่ขั้น ' + cur.no + ' (' + cur.name + ') แล้ว ' +
                           'ช่องนี้เป็นของขั้น ' + owner.no + ' (' + owner.name + ') — ถ้าต้องแก้ ให้จัดซื้อตีกลับมาก่อน' };
  }
  return { ok:true };
}

/* ─────────── คอลัมน์ใหม่ที่เพิ่มเข้ามาในชีตใบเคลม ───────────
 * ต่อท้ายของเดิม แล้วเติมหัวตารางให้ชีตเก่าอัตโนมัติ (ensureCols_)
 * ⚠️ ห้ามใช้ HDR_CLAIM.length เป็น "คอลัมน์แก้ไขล่าสุด" อีกต่อไป
 *    เพราะพอเพิ่มคอลัมน์ ตัวเลขนั้นจะเลื่อนไปทับคอลัมน์ใหม่ — ใช้ colOf_() แทน */
var HDR_FLOW = ['ขั้นตอน','รอใครทำ','เหตุผลที่ตีกลับ','ตีกลับโดย','ตีกลับเมื่อ','ประวัติขั้นตอน'];

function claimHdr_(){ return HDR_CLAIM.concat(HDR_FLOW); }

/** ชื่อหัวตาราง → เลขคอลัมน์ (เริ่มที่ 1) */
function colOf_(name){
  var h = claimHdr_();
  for (var i = 0; i < h.length; i++) if (h[i] === name) return i + 1;
  return -1;
}

/** ชีตที่สร้างไว้ก่อนหน้ายังไม่มีคอลัมน์ใหม่ — เติมหัวให้ ไม่แตะข้อมูลเดิมสักแถว */
function ensureCols_(sh, header){
  var have = sh.getLastColumn();
  if (have >= header.length){
    var cur = sh.getRange(1,1,1,header.length).getDisplayValues()[0];
    var fix = false;
    for (var i = 0; i < header.length; i++) if (norm_(cur[i]) !== header[i]){ fix = true; break; }
    if (fix) sh.getRange(1,1,1,header.length).setValues([header]).setFontWeight('bold');
    return sh;
  }
  if (sh.getMaxColumns() < header.length) sh.insertColumnsAfter(sh.getMaxColumns(), header.length - sh.getMaxColumns());
  sh.getRange(1,1,1,header.length).setValues([header]).setFontWeight('bold');
  return sh;
}

/* ─────────── อ่าน / เขียน ขั้นตอน ─────────── */
function claimStage_(sh, row){
  var c = colOf_('ขั้นตอน');
  var v = norm_(sh.getRange(row, c).getDisplayValue());
  return v || 'REQUEST';                       // ใบเก่าที่ยังไม่มีค่า = เพิ่งแจ้ง
}

function setStage_(sh, row, key, me, note){
  var hist = norm_(sh.getRange(row, colOf_('ประวัติขั้นตอน')).getDisplayValue());
  var line = nowStamp_() + ' · ' + stageDef_(key).name + ' · ' + (me ? me.name : '') + (note ? ' · ' + note : '');
  sh.getRange(row, colOf_('ขั้นตอน')).setValue(key);
  sh.getRange(row, colOf_('รอใครทำ')).setValue(stageDef_(key).who);
  sh.getRange(row, colOf_('ประวัติขั้นตอน')).setValue((hist ? hist + '\n' : '') + line);
  sh.getRange(row, colOf_('แก้ไขล่าสุด')).setValue(nowStamp_());
}

/** ข้อมูลขั้นตอนสำหรับหน้าเว็บ — บอกได้เลยว่าใครทำอะไรต่อ และคนที่เปิดดูทำอะไรได้ */
function claimFlow(docNo, auth){
  var me = requireLogin_(auth);
  var d = db_(), r = findClaimRow_(d.claims, norm_(docNo));
  if (r < 0) return null;
  ensureCols_(d.claims, claimHdr_());

  var key = claimStage_(d.claims, r), st = stageDef_(key);
  var mine = (me.roles && me.roles.length) ? me.roles : [me.role];
  var isAdmin = mine.indexOf('ADMIN') >= 0;
  var isOwner = isAdmin;
  for (var i = 0; i < mine.length; i++) if (st.roles.indexOf(mine[i]) >= 0) isOwner = true;

  return {
    stage:key, no:st.no, name:st.name, who:st.who, todo:st.todo,
    next:st.next, nextLabel:st.nextLabel,
    isOwner:isOwner,
    canReject: (key === 'PURCHASE' || key === 'SUPPLIER') && isOwner,
    rejectNote: norm_(d.claims.getRange(r, colOf_('เหตุผลที่ตีกลับ')).getDisplayValue()),
    rejectBy:   norm_(d.claims.getRange(r, colOf_('ตีกลับโดย')).getDisplayValue()),
    rejectAt:   norm_(d.claims.getRange(r, colOf_('ตีกลับเมื่อ')).getDisplayValue()),
    history:    norm_(d.claims.getRange(r, colOf_('ประวัติขั้นตอน')).getDisplayValue()),
    stages: STAGES.map(function(s){ return { key:s.key, no:s.no, name:s.name, who:s.who }; }),
    lock: lockMap_(key, me),
    missing: claimMissing_(d, norm_(docNo), key)
  };
}

/** ช่องไหนคนนี้แก้ไม่ได้บ้าง + เพราะอะไร — ส่งให้หน้าเว็บทำเป็นช่องสีเทาพร้อมเหตุผล
 *  ส่งเฉพาะ "ช่องที่ล็อก" ไม่ต้องส่งทั้งหมด ข้อมูลจะได้ไม่บวม */
function lockMap_(stageKey, me){
  var out = {};
  var f;
  for (f in FIELD_STAGE){
    var g = canEditField_(stageKey, f, FIELD_STAGE, me);
    if (!g.ok) out[f] = g.why;
  }
  for (f in ITEM_STAGE){
    var g2 = canEditField_(stageKey, f, ITEM_STAGE, me);
    if (!g2.ok) out['item.' + f] = g2.why;
  }
  return out;
}

/** ส่งงานต่อขั้นถัดไป — ตรวจให้ครบก่อน ไม่ให้ส่งของที่ยังขาด */
function advanceClaim(docNo, auth){
  var me = requireLogin_(auth);
  docNo = norm_(docNo);
  var d = db_(), r = findClaimRow_(d.claims, docNo);
  if (r < 0) throw new Error('ไม่พบใบเคลม ' + docNo);
  ensureCols_(d.claims, claimHdr_());

  var key = claimStage_(d.claims, r), st = stageDef_(key);
  if (!st.next) throw new Error('เอกสารนี้ปิดงานแล้ว');

  var mine = (me.roles && me.roles.length) ? me.roles : [me.role];
  if (mine.indexOf('ADMIN') < 0){
    var ok = false;
    for (var i = 0; i < mine.length; i++) if (st.roles.indexOf(mine[i]) >= 0) ok = true;
    if (!ok) throw new Error('ขั้นนี้เป็นหน้าที่ของ ' + st.who + ' — สิทธิ์ของคุณคือ ' + mine.join(', '));
  }

  var miss = claimMissing_(d, docNo, key);
  if (miss.length) throw new Error('ยังส่งต่อไม่ได้ — ' + miss.join(' · '));

  setStage_(d.claims, r, st.next, me, '');
  d.claims.getRange(r, colOf_('เหตุผลที่ตีกลับ')).setValue('');    // ส่งต่อได้ = เคลียร์เหตุผลเดิม

  var nx = stageDef_(st.next);
  if (st.lineKey){
    var head = claimRowObj_(d.claims.getRange(1,1,1,HDR_CLAIM.length).getDisplayValues()[0],
                            d.claims.getRange(r,1,1,HDR_CLAIM.length).getDisplayValues()[0]);
    lineToStage_(st.lineKey,
      '📋 งานเคลมถึงคิวคุณแล้ว\n' +
      'เลขที่ ' + docNo + '\n' +
      'จ๊อบ ' + head['เลขที่ JOB'] + ' · ' + head['ชื่อลูกค้า'] + '\n' +
      'ขั้นที่ ' + nx.no + ' ' + nx.name + '\n' +
      'สิ่งที่ต้องทำ: ' + nx.todo + '\n' +
      'ส่งต่อโดย ' + me.name);
  }
  log_('advanceClaim', docNo, key + ' → ' + st.next);
  try { CacheService.getScriptCache().remove('CLAIM_HOME'); } catch(e){}
  return { ok:true, stage:st.next };
}

/** ตีกลับ — จัดซื้อเลือกได้ว่าจะส่งกลับหาใคร พร้อมเหตุผล (บังคับ) */
function rejectClaim(docNo, toStage, reason, auth){
  var me = requireLogin_(auth);
  docNo = norm_(docNo); reason = norm_(reason);
  if (!reason) throw new Error('ต้องบอกเหตุผลที่ตีกลับ ไม่งั้นคนรับไม่รู้ว่าต้องแก้อะไร');

  var d = db_(), r = findClaimRow_(d.claims, docNo);
  if (r < 0) throw new Error('ไม่พบใบเคลม ' + docNo);
  ensureCols_(d.claims, claimHdr_());

  var cur = claimStage_(d.claims, r);
  var mine = (me.roles && me.roles.length) ? me.roles : [me.role];
  if (mine.indexOf('ADMIN') < 0 && mine.indexOf('PURCHASE') < 0 && mine.indexOf('STORE') < 0){
    throw new Error('ตีกลับได้เฉพาะจัดซื้อและสโตร์');
  }
  var to = stageDef_(toStage);
  if (to.key !== 'REQUEST' && to.key !== 'STORE') throw new Error('ตีกลับได้เฉพาะขั้น 1 (คนเปิดใบ) หรือขั้น 2 (สโตร์)');

  setStage_(d.claims, r, to.key, me, 'ตีกลับ: ' + reason);
  d.claims.getRange(r, colOf_('เหตุผลที่ตีกลับ')).setValue(reason);
  d.claims.getRange(r, colOf_('ตีกลับโดย')).setValue(me.name);
  d.claims.getRange(r, colOf_('ตีกลับเมื่อ')).setValue(nowStamp_());

  var head = claimRowObj_(d.claims.getRange(1,1,1,HDR_CLAIM.length).getDisplayValues()[0],
                          d.claims.getRange(r,1,1,HDR_CLAIM.length).getDisplayValues()[0]);
  lineToStage_(to.key === 'REQUEST' ? 'PRODUCTION' : 'STORE',
    '↩ ใบเคลมถูกตีกลับ\n' +
    'เลขที่ ' + docNo + '\n' +
    'จ๊อบ ' + head['เลขที่ JOB'] + ' · ' + head['ชื่อลูกค้า'] + '\n' +
    'กลับไปขั้นที่ ' + to.no + ' ' + to.name + '\n' +
    'เหตุผล: ' + reason + '\n' +
    'ตีกลับโดย ' + me.name);

  log_('rejectClaim', docNo, cur + ' ↩ ' + to.key + ' : ' + reason);
  try { CacheService.getScriptCache().remove('CLAIM_HOME'); } catch(e){}
  return { ok:true, stage:to.key };
}

/** ขั้นนี้ยังขาดอะไรบ้าง — เช็คก่อนยอมให้ส่งต่อ */
function claimMissing_(d, docNo, stageKey){
  var hdr = d.claims.getRange(1,1,1,HDR_CLAIM.length).getDisplayValues()[0];
  var r = findClaimRow_(d.claims, docNo);
  var h = claimRowObj_(hdr, d.claims.getRange(r,1,1,HDR_CLAIM.length).getDisplayValues()[0]);
  var items = [], lr = d.items.getLastRow();
  if (lr > 1){
    var v = d.items.getRange(2,1,lr-1,HDR_ITEM.length).getDisplayValues();
    for (var i = 0; i < v.length; i++) if (norm_(v[i][0]) === docNo) items.push(v[i]);
  }
  var miss = [];

  if (stageKey === 'REQUEST'){
    if (!norm_(h['เลขที่ JOB']))  miss.push('ยังไม่ใส่เลขที่ JOB');
    if (!items.length)            miss.push('ยังไม่มีรายการที่เคลม');
    var noPhoto = [];
    var ph = photosOf_(docNo);   // ห้ามเรียก listPhotos ที่นี่ มันบังคับล็อกอิน
    for (var k = 0; k < items.length; k++){
      var sq = norm_(items[k][1]);
      if (!ph[sq] || !ph[sq].length) noPhoto.push(sq);
    }
    if (noPhoto.length) miss.push('รายการที่ ' + noPhoto.join(', ') + ' ยังไม่มีรูป');
  }

  if (stageKey === 'STORE'){
    var noPo = [], noSup = [];
    for (var m = 0; m < items.length; m++){
      if (!norm_(items[m][8]))  noPo.push(norm_(items[m][1]));    // PO
      if (!norm_(items[m][9]))  noSup.push(norm_(items[m][1]));   // Supplier
    }
    if (noPo.length)  miss.push('รายการที่ ' + noPo.join(', ') + ' ยังไม่มี PO');
    if (noSup.length) miss.push('รายการที่ ' + noSup.join(', ') + ' ยังไม่มี Supplier');
  }

  return miss;
}

/* ═══════════ แจ้งเตือน LINE ═══════════
 * ยกวิธีเดียวกับ STT NOVA มาใช้ — LINE Messaging API แบบ push
 * (LINE Notify ปิดบริการไปแล้วตั้งแต่ 31 มี.ค. 2568 ใช้ไม่ได้อีก)
 * ตั้งค่าใน Script Properties:
 *   LINE_TOKEN หรือ (LINE_CHANNEL_ID + LINE_CHANNEL_SECRET)
 *   LINE_GROUP              กลุ่มกลาง (ใช้เมื่อไม่ได้ตั้งกลุ่มเฉพาะแผนก)
 *   LINE_GROUP_PRODUCTION · LINE_GROUP_STORE · LINE_GROUP_PURCHASE · LINE_GROUP_QC
 * ยังไม่ตั้งค่า = ระบบทำงานปกติทุกอย่าง แค่ไม่ส่ง LINE (ไม่ error ไม่ค้าง)          */
function lineToken_(){
  var p = PropertiesService.getScriptProperties();
  var raw = norm_(p.getProperty('LINE_TOKEN'));
  if (raw) return raw;
  var id = norm_(p.getProperty('LINE_CHANNEL_ID')), sec = norm_(p.getProperty('LINE_CHANNEL_SECRET'));
  if (!id || !sec) return '';
  var cached = norm_(p.getProperty('LINE_TOKEN_CACHE')), exp = num_(p.getProperty('LINE_TOKEN_EXP'));
  if (cached && exp > Date.now() + 60000) return cached;
  try {
    var res = UrlFetchApp.fetch('https://api.line.me/v2/oauth/accessToken', {
      method:'post', muteHttpExceptions:true,
      payload:{ grant_type:'client_credentials', client_id:id, client_secret:sec }
    });
    var o = JSON.parse(res.getContentText());
    if (!o.access_token) return '';
    p.setProperty('LINE_TOKEN_CACHE', o.access_token);
    p.setProperty('LINE_TOKEN_EXP', String(Date.now() + (num_(o.expires_in) || 2592000) * 1000));
    return o.access_token;
  } catch(e){ return ''; }
}

function lineGroup_(key){
  var p = PropertiesService.getScriptProperties();
  return norm_(p.getProperty('LINE_GROUP_' + norm_(key).toUpperCase())) || norm_(p.getProperty('LINE_GROUP'));
}

/** ส่งข้อความเข้ากลุ่มไลน์ของแผนกนั้น — ส่งไม่ได้ก็ไม่ทำให้งานหลักพัง */
function lineToStage_(groupKey, msg){
  try {
    var token = lineToken_(), to = lineGroup_(groupKey);
    if (!token || !to){ log_('lineSkip', groupKey, 'ยังไม่ได้ตั้งค่า LINE'); return false; }
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method:'post', contentType:'application/json', muteHttpExceptions:true,
      headers:{ Authorization:'Bearer ' + token },
      payload: JSON.stringify({ to:to, messages:[{ type:'text', text:String(msg).slice(0, 4900) }] })
    });
    log_('lineSent', groupKey, String(msg).split('\n')[0]);
    return true;
  } catch(e){ log_('lineFail', groupKey, e.message); return false; }
}

/** ปุ่มทดสอบ LINE — เบียร์กดเช็คได้ว่าตั้งค่าถูกไหม ก่อนใช้งานจริง */
function testLine(groupKey, auth){
  requireAny_(auth, ['APPROVER']);
  var token = lineToken_(), to = lineGroup_(groupKey);
  if (!token) return { ok:false, msg:'ยังไม่ได้ตั้ง LINE_TOKEN หรือ LINE_CHANNEL_ID + LINE_CHANNEL_SECRET' };
  if (!to)    return { ok:false, msg:'ยังไม่ได้ตั้ง LINE_GROUP_' + norm_(groupKey).toUpperCase() + ' หรือ LINE_GROUP' };
  var ok = lineToStage_(groupKey, '🔔 ทดสอบการแจ้งเตือนจากระบบ STT CLAIM — ถ้าเห็นข้อความนี้แปลว่าตั้งค่าถูกแล้ว');
  return { ok:ok, msg: ok ? 'ส่งแล้ว ลองดูในกลุ่ม LINE' : 'ส่งไม่สำเร็จ ตรวจ token กับ group id อีกที' };
}
