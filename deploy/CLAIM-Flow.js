/**
 * STT CLAIM · ขั้นตอนงานและหน้าที่ (v0.5.0)
 * ─────────────────────────────────────────────────────────────
 * เบียร์แก้โครงใหม่ 4 ก.ย. 2569 (ให้เหมือน BOM ใน NOVA):
 *   ขั้น 1  ทีมงาน (Production/Sales/QC/Design) → กรอกข้อมูลตัวเอง + รูป · **เก็บเป็นร่างไว้ก่อนได้**
 *                                                  ร่าง = สโตร์กับจัดซื้อยังไม่เห็น
 *   ขั้น 2  ผู้บังคับบัญชา                        → อนุมัติ (หรือตีกลับให้แก้)
 *   ขั้น 3  สโตร์        → **กดรับเรื่อง** ก่อน แล้วเติม เลขใบส่งมอบ · PO · Supplier → ส่งต่อ
 *   ขั้น 4  จัดซื้อ      → **กดรับเอกสาร** ก่อน แล้วตรวจ → Accept หรือ ตีกลับไปต้นน้ำ
 *   ขั้น 5  จัดซื้อ      → ส่ง Supplier · รับคำตอบ · ออกใบเรียกเก็บ
 *   ขั้น 6  QC / Production → รับของกลับ ตรวจรับ
 *   ขั้น 7  ปิดงาน       (+ สถานะพิเศษ "ยกเลิกแล้ว" ซึ่งเบียร์เท่านั้นที่สั่งได้)
 *
 * หลักที่เบียร์วางไว้:
 *   · พ้นขั้นร่างแล้ว เอกสารใบเดียว **ทุกคนเห็นข้อมูลทั้งหมด**
 *   · แต่ **ทำงานแทนกันไม่ได้** — แก้ได้เฉพาะช่องของขั้นตัวเอง
 *   · ยกเว้น **สโตร์กับจัดซื้อช่วยกันได้** (เบียร์สั่งไว้ชัด)
 *   · ตีกลับได้ ระบุเหตุผล แล้วเอกสารเด้งกลับไปขั้นนั้นให้แก้
 */

/* ─────────── นิยามขั้นตอน ─────────── */
var STAGES = [
  { key:'REQUEST', no:1, name:'ร่าง · ทีมงานกรอก',
    who:'Production / Sales / QC / Design',
    roles:['PRODUCTION','SALES','QC','DESIGN'],
    draft:true,                                   // ร่าง = สโตร์/จัดซื้อยังไม่เห็นใบนี้
    todo:'กรอกข้อมูลของตัวเองให้ครบ + แนบรูปทุกรายการ · ช่องของสโตร์ยังไม่ต้องกรอก · เซฟค้างไว้ก่อนได้',
    next:'APPROVAL', nextLabel:'➜ ส่งขออนุมัติ', lineKey:'APPROVER' },

  { key:'APPROVAL', no:2, name:'รอผู้บังคับบัญชาอนุมัติ',
    who:'ผู้บังคับบัญชา (Approver)',
    roles:['APPROVER'],
    todo:'ตรวจว่าเคลมนี้สมควรออกไหม · อนุมัติแล้วเอกสารจะวิ่งไปหาสโตร์',
    next:'STORE', nextLabel:'✓ อนุมัติ — ส่งให้สโตร์', lineKey:'STORE' },

  { key:'STORE', no:3, name:'สโตร์รับเรื่อง · เติมข้อมูล',
    who:'สโตร์ (จัดซื้อช่วยได้)',
    roles:['STORE','PURCHASE'],
    needReceive:true, receiveLabel:'📥 กดรับเรื่อง',
    todo:'กดรับเรื่องก่อน แล้วเติมเลขใบส่งมอบ · PO · Supplier ของแต่ละรายการ',
    next:'PURCHASE', nextLabel:'➜ ส่งให้จัดซื้อ', lineKey:'PURCHASE' },

  { key:'PURCHASE', no:4, name:'จัดซื้อรับเอกสาร · ตรวจ',
    who:'จัดซื้อ (สโตร์ช่วยได้)',
    roles:['PURCHASE','STORE'],
    needReceive:true, receiveLabel:'📥 กดรับเอกสาร',
    todo:'กดรับเอกสารก่อน แล้วตรวจว่าข้อมูลครบไหม · ครบแล้วกด Accept · ไม่ครบตีกลับไปต้นน้ำพร้อมเหตุผล',
    next:'SUPPLIER', nextLabel:'✓ Accept — ข้อมูลครบ พร้อมส่ง Supplier', lineKey:'' },

  { key:'SUPPLIER', no:5, name:'ส่ง Supplier · รอคำตอบ',
    who:'จัดซื้อ (สโตร์ช่วยได้)',
    roles:['PURCHASE','STORE'],
    todo:'ส่งเอกสารให้ Supplier · เลือกผลการเคลม 1 ใน 4 กรณี · ใส่ต้นทุน ค่าแรง กำไร · ออกใบเรียกเก็บถ้าต้องเรียกเงิน',
    next:'STORE_IN', nextLabel:'📝 บันทึกผลการเคลม', lineKey:'STORE' },

  /* เบียร์ 7 ก.ย. 2569: "ของเข้ามาแล้ว ก็ต้องไปที่สโตร์ก่อน สโตร์มีการแจ้ง QC ให้มาตรวจรับสินค้า
     และเบิกออก มีเลขที่เอกสารและวันที่ด้วย ... เหมือน Inspection สินค้าของงานนั้น ๆ เลย"
     → ขั้นเดิม RETURN แตกเป็น 3 ขั้น สโตร์รับเข้า → QC ตรวจรับ → สโตร์เบิกออก */
  { key:'STORE_IN', no:6, name:'ของกลับเข้าคลัง · สโตร์รับเข้า',
    who:'สโตร์',
    roles:['STORE'],
    needReceive:true, receiveLabel:'📥 กดรับของเข้าคลัง',
    todo:'ของจาก Supplier มาถึงคลัง — ใส่ที่เก็บ · จำนวนที่มาถึง · รูปตอนแกะกล่อง แล้วกดแจ้ง QC มาตรวจ',
    next:'QC_RECV', nextLabel:'📥 รับของเข้าคลัง + แจ้ง QC มาตรวจ', lineKey:'QC' },

  { key:'QC_RECV', no:7, name:'สโตร์แจ้งแล้ว · รอ QC มาตรวจรับ',
    who:'Production / QC',
    roles:['QC','PRODUCTION'],
    todo:'ไปตรวจที่คลัง ถ่ายรูปของที่ได้กลับมา ติ๊ก Accept / ไม่ Accept ทุกข้อ แล้วออกใบตรวจรับของกลับ',
    next:'STORE_OUT', nextLabel:'✓ ตรวจเสร็จ + ออกใบตรวจรับของกลับ', lineKey:'STORE' },

  { key:'STORE_OUT', no:8, name:'ตรวจผ่านแล้ว · รอสโตร์เบิกออก',
    who:'สโตร์',
    roles:['STORE'],
    todo:'QC ตรวจผ่านแล้ว — ใส่ผู้รับของหน้างาน · แผนกที่เบิกไปใช้ แล้วจ่ายของออก',
    next:'CLOSE_WAIT', nextLabel:'📤 เบิกออกให้หน้างาน', lineKey:'PURCHASE' },

  { key:'CLOSE_WAIT', no:9, name:'รอผู้บริหารอนุมัติปิด',
    who:'ผู้บริหาร (เบียร์ / คุณแบล็ค / คุณประดิษฐ์)',
    roles:['ADMIN','APPROVER'],
    todo:'ตรวจครั้งสุดท้ายแล้วกดปิดใบเคลม — ระบบส่งข้อมูลให้บัญชีและ HR ต่อให้เอง',
    next:'CLOSED', nextLabel:'🏁 อนุมัติปิดใบเคลม',
    nextRoles:['ADMIN','APPROVER'], lineKey:'' },

  { key:'CLOSED', no:10, name:'ปิดงานแล้ว',
    who:'—', roles:[], todo:'งานนี้จบแล้ว', next:'', nextLabel:'', lineKey:'' },

  /* ยกเลิก — ไม่ใช่ขั้นตอนปกติ ไม่โชว์ในแถบขั้นตอน · เบียร์เท่านั้นที่กดได้ */
  { key:'CANCELLED', no:0, name:'ยกเลิกแล้ว', hidden:true,
    who:'—', roles:[], todo:'ใบนี้ถูกยกเลิก', next:'', nextLabel:'', lineKey:'' }
];

/** รายชื่อขั้นตอนสำหรับหน้าเว็บ — **แหล่งเดียว** คือ STAGES ข้างบนนี้เท่านั้น
 *  ห้ามก๊อปรายชื่อขั้นตอนไปเขียนซ้ำในไฟล์หน้าเว็บอีก (เคยพลาดมาแล้ว v0.9.0:
 *  แก้ขั้นตอนฝั่งเซิร์ฟเวอร์ครบ แต่หน้าเปิดใบใหม่ยังโชว์ของเก่าเพราะมีลิสต์ซ้ำอยู่ใน js-flow.html) */
function stageList(){
  return STAGES.filter(function(s){ return !s.hidden; })
               .map(function(s){ return { key:s.key, no:s.no, name:s.name, who:s.who, todo:s.todo,
                                          nextLabel:s.nextLabel, draft:!!s.draft }; });
}

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

  /* ขั้นใหม่ 7 ก.ย. — ของกลับเข้าสโตร์ก่อน → QC ตรวจ → เบิกออก */
  storeLoc:'STORE_IN', storeTrk:'STORE_IN',
  issueTo:'STORE_OUT', issueDept:'STORE_OUT',
  blame:'SUPPLIER', blameWho:'SUPPLIER', blameDept:'SUPPLIER',

  currency:'SUPPLIER', rate:'SUPPLIER', rateDate:'SUPPLIER', billCase:'SUPPLIER',
  result:'SUPPLIER', resultDetail:'SUPPLIER', supplierNote:'SUPPLIER',

  status:'AUTO'          // ขึ้นเองตามขั้นตอน ไม่มีใครเลือกเอง
};

var ITEM_STAGE = {
  code:'REQUEST', name:'REQUEST', th:'REQUEST', en:'REQUEST',
  qty:'REQUEST', unit:'REQUEST', recv:'REQUEST',
  po:'STORE', supplier:'STORE',
  cost:'SUPPLIER', margin:'SUPPLIER', price:'SUPPLIER',
  acc:'*', note:'*'
};

/** ตัดสินว่าคนนี้แก้ช่องนี้ได้ไหม ณ ขั้นตอนปัจจุบัน — เหตุผลบอกเป็นภาษาคน */
/** ขั้นนี้ต้องกดรับเรื่องก่อนไหม และรับหรือยัง */
/** ขั้นปัจจุบันของแถวนี้ ถูกกดรับเรื่องแล้วหรือยัง */
function claimReceived_(d, row){
  var key = claimStage_(d.claims, row);
  if (!stageDef_(key).needReceive) return true;
  return !!norm_(d.claims.getRange(row, colOf_('รับเรื่องเมื่อ')).getDisplayValue());
}

function needReceive_(key){ return !!stageDef_(key).needReceive; }

function canEditField_(curStage, field, map, me, received){
  /* เบียร์: "ถึงเบียร์จะเป็น Admin ก็ต้องล้อตามกฎที่วางไว้นะ"
     → ผู้บริหารทำงานแทนแผนกไหนก็ได้ (จะได้ช่วยงานได้เวลาคนไม่อยู่)
       แต่ **ข้ามลำดับขั้นไม่ได้** เหมือนกันทุกคน
       ของเดิม Admin ผ่านทุกอย่าง = กฎที่วางไว้ไม่มีผลกับคนที่ทดสอบระบบ
       เลยดูเหมือนระบบไม่มีขั้นตอน */
  var mine = (me.roles && me.roles.length) ? me.roles : [me.role];
  var isAdmin = mine.indexOf('ADMIN') >= 0;

  var spec = map[field];
  if (!spec) return { ok:false, why:'ไม่รู้จักช่องนี้' };
  if (spec === '*') return { ok:true };
  if (spec === 'AUTO') return { ok:false, why:'สถานะขึ้นเองตามขั้นตอน ไม่ต้องเปลี่ยนเอง — กดปุ่มส่งต่อขั้นถัดไปแทน' };

  var always = false, key = spec;
  if (spec.indexOf('ALWAYS:') === 0){ always = true; key = spec.slice(7); }

  var owner = stageDef_(key);
  var isOwner = isAdmin;
  for (var i = 0; i < mine.length; i++) if (owner.roles.indexOf(mine[i]) >= 0) isOwner = true;
  if (!isOwner){
    return { ok:false, why:'ช่องนี้เป็นหน้าที่ของ ' + owner.who + ' — สิทธิ์ของคุณคือ ' + mine.join(', ') };
  }
  if (always) return { ok:true };

  if (norm_(curStage) === key && needReceive_(key) && received === false){
    return { ok:false, why:'ยังไม่ได้กดรับเรื่อง — กดปุ่ม "' + stageDef_(key).receiveLabel + '" ข้างบนก่อน แล้วช่องจะเปิดให้กรอก' };
  }
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
var HDR_FLOW = ['ขั้นตอน','รอใครทำ','เหตุผลที่ตีกลับ','ตีกลับโดย','ตีกลับเมื่อ','ประวัติขั้นตอน',
  'ปริ้นส่งออกแล้วเมื่อ','ปริ้นโดย','รับเรื่องเมื่อ','รับเรื่องโดย','เหตุผลยกเลิก',
  /* ลายเซ็น — เบียร์: "ลายเซ็นตั้งแต่ผู้เปิดใบ ผู้อนุมัติ ก็จะขึ้นมาเลย
     พอถึงสโตร์กด ก็จะมีลายเซ็นสโตร์คนนั้นได้เลย"
     เก็บเป็นข้อความ "ชื่อ · แผนก · วันเวลา" ช่องละคน ไม่ต้องเซ็นมือ */
  'ลายเซ็น ผู้เปิดใบ','ลายเซ็น ผู้อนุมัติ','ลายเซ็น สโตร์','ลายเซ็น จัดซื้อ',
  /* รอบ 2 — เบียร์เพิ่ม 7 ก.ย. 2569 (ของกลับเข้าสโตร์ก่อน → QC ตรวจ → เบิกออก) */
  'ลายเซ็น จัดซื้อ ผลเคลม','ลายเซ็น สโตร์รับของเข้า','ลายเซ็น QC ตรวจรับ','ลายเซ็น สโตร์เบิกออก',
  'ลายเซ็น ผู้ปิดงาน',
  /* เลขเอกสารที่ระบบออกให้ในแต่ละขั้น พร้อมวันที่ */
  'เลขที่รับของเข้าคลัง','วันที่รับของเข้าคลัง','ที่เก็บในคลัง','ขนส่ง/เลขพัสดุ',
  'เลขที่ใบตรวจรับของกลับ','วันที่ตรวจรับของกลับ','ผู้ตรวจรับของกลับ',
  'เลขที่ใบเบิกออก','วันที่เบิกออก','ผู้รับของหน้างาน','แผนกที่เบิกไปใช้',
  /* ปิดจบ ต้นทุนไปทางไหน + ใบเรียกเก็บรวม */
  'ความรับผิดชอบ','ชื่อผู้ทำเสียหาย','แผนกผู้ทำเสียหาย','รอบเคลม',
  'เลขที่ใบเรียกเก็บรวม','วันที่ใบเรียกเก็บรวม'];

/* ลายเซ็น 9 ช่อง 2 รอบ (สเปคข้อ 7 + ที่เบียร์เพิ่ม 7 ก.ย.)
   รอบ 1 ครบ 4 ช่อง → ปุ่มพิมพ์ใบส่ง Supplier ถึงจะเปิดใช้ได้ */
var SIGN_SLOT = { REQUEST:'ลายเซ็น ผู้เปิดใบ', APPROVAL:'ลายเซ็น ผู้อนุมัติ',
                  STORE:'ลายเซ็น สโตร์', PURCHASE:'ลายเซ็น จัดซื้อ',
                  SUPPLIER:'ลายเซ็น จัดซื้อ ผลเคลม', STORE_IN:'ลายเซ็น สโตร์รับของเข้า',
                  QC_RECV:'ลายเซ็น QC ตรวจรับ', STORE_OUT:'ลายเซ็น สโตร์เบิกออก',
                  CLOSE_WAIT:'ลายเซ็น ผู้ปิดงาน' };
var SIGN_R1 = ['ลายเซ็น ผู้เปิดใบ','ลายเซ็น ผู้อนุมัติ','ลายเซ็น สโตร์','ลายเซ็น จัดซื้อ'];
var SIGN_R2 = ['ลายเซ็น จัดซื้อ ผลเคลม','ลายเซ็น สโตร์รับของเข้า','ลายเซ็น QC ตรวจรับ',
               'ลายเซ็น สโตร์เบิกออก','ลายเซ็น ผู้ปิดงาน'];

/** ครบลายเซ็นรอบ 1 ทั้ง 4 ช่องหรือยัง — ปุ่มพิมพ์ใบส่ง Supplier ใช้ตัวนี้ตัดสิน */
function round1Done_(sh, row){
  for (var i = 0; i < SIGN_R1.length; i++){
    if (!norm_(sh.getRange(row, colOf_(SIGN_R1[i])).getDisplayValue())) return false;
  }
  return true;
}

/* ═══ คำตอบจาก Supplier 4 กรณี (สเปคข้อ 5) ═══════════════════
 * คำตอบเป็นตัวตัดสินว่า ① ต้องออกใบเรียกเก็บไหม  ② มีของกลับมาให้ QC ตรวจไหม */
var CLAIM_RESULTS = {
  BUYSELF:{ t:'Supplier ไม่มีของส่งให้ → STT ซื้อเอง ติดตั้งเอง', goods:'เรียกเก็บ', labor:'เรียกเก็บ', bill:true,  back:false },
  NEWPART:{ t:'Supplier ส่งของใหม่มาให้ → STT ติดตั้งเอง',        goods:'ไม่คิด',   labor:'เรียกเก็บ', bill:true,  back:true  },
  SWAP:   { t:'อุปกรณ์เปลี่ยนกลับมาแล้วจบ',                        goods:'—',       labor:'—',        bill:false, back:true  },
  REJECT: { t:'Supplier ไม่รับเคลม (เลยประกัน / เหตุผลอื่น)',       goods:'—',       labor:'—',        bill:false, back:false }
};
function resultList(){
  return Object.keys(CLAIM_RESULTS).map(function(k){
    var r = CLAIM_RESULTS[k];
    return { key:k, text:r.t, goods:r.goods, labor:r.labor, bill:r.bill, back:r.back };
  });
}
/** ขั้นถัดไปจริง — ขั้น SUPPLIER แยกทางตามคำตอบ ไม่มีของกลับก็ข้ามสโตร์/QC/เบิกออกไปเลย */
function nextStage_(sh, row, key){
  var st = stageDef_(key);
  if (key !== 'SUPPLIER') return st.next;
  var res = norm_(sh.getRange(row, colOf_('ผลการเคลม')).getDisplayValue());
  var R = CLAIM_RESULTS[res];
  return (R && R.back) ? 'STORE_IN' : 'CLOSE_WAIT';
}
/** ออกเลขเอกสารของขั้นงาน (GR · RCV · IS · CDN) — เลขต้องอยู่ได้ 10-20 ปี ห้ามซ้ำ
 *  ⚠️ ห้ามตั้งชื่อ nextDocNo_ ซ้ำกับตัวใน CLAIM-Hub.js
 *     Apps Script เอาไฟล์ทุกไฟล์มารวมใน scope เดียว ชื่อซ้ำ = ตัวที่โหลดทีหลังทับตัวแรกเงียบ ๆ
 *     (เคยพลาดมาแล้ว v1.1.x — เลขใบเคลมเกือบวนกลับไปชนเลขเดิม)
 *  หลักการ: **นับจากชีตเสมอ** ไม่พึ่ง Script Properties
 *     Properties หายได้ (ย้ายโปรเจกต์ · ล้างค่า) แต่ชีตคือของจริง นับจากชีตจึงไม่มีทางซ้ำ
 *  ล็อกสคริปต์ไว้ — คนสองคนกดพร้อมกันจะไม่ได้เลขเดียวกัน                                */
function nextFlowNo_(prefix, headerName){
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var d = db_(), yy = yy_(yearBE_());
    var sh = d.claims, lr = sh.getLastRow(), max = 0;
    var c = colOf_(headerName);
    if (lr > 1 && c > 0){
      var col = sh.getRange(2, c, lr - 1, 1).getDisplayValues();
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

/** เซ็นชื่อลงช่องของขั้นนั้น — ชื่อ · แผนก · วันเวลา · เซ็นแล้วไม่ทับซ้ำ */
function signStage_(sh, row, stageKey, me){
  var col = SIGN_SLOT[norm_(stageKey)];
  if (!col) return '';
  var c = colOf_(col);
  var cur = norm_(sh.getRange(row, c).getDisplayValue());
  if (cur) return cur;
  var txt = me.name + (me.dept ? ' · ' + me.dept : '') + ' · ' + nowStamp_();
  sh.getRange(row, c).setValue(txt);
  return txt;
}

/** ลายเซ็นทั้งใบ สำหรับหน้าเว็บและหน้าปริ้น */
function signsOf_(sh, row){
  var out = [], keys = SIGN_R1.concat(SIGN_R2);
  var lab = ['ผู้เปิดใบ','ผู้อนุมัติ','สโตร์','จัดซื้อ',
             'จัดซื้อ (ผลเคลม)','สโตร์รับของเข้า','QC ตรวจรับ','สโตร์เบิกออก','ผู้บริหาร'];
  for (var i = 0; i < keys.length; i++){
    out.push({ role:lab[i], text:norm_(sh.getRange(row, colOf_(keys[i])).getDisplayValue()),
               round: i < SIGN_R1.length ? 1 : 2 });
  }
  return out;
}

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

/** สถานะของใบ = ผลของขั้นตอน ไม่ใช่ของที่ใครมานั่งเลือกเอง
 *  เบียร์ถามว่า "สถานะคืออะไร ใครต้องเป็นคนเปลี่ยน" — คำตอบคือ ไม่มีใครเปลี่ยน ระบบเปลี่ยนให้ */
var STAGE_STATUS = { REQUEST:'DRAFT', APPROVAL:'WAIT_APPROVE', STORE:'IN_STORE', PURCHASE:'IN_PURCHASE',
                     SUPPLIER:'SENT', STORE_IN:'REPLIED', QC_RECV:'REPLIED', STORE_OUT:'REPLIED',
                     CLOSE_WAIT:'BILLED', CLOSED:'CLOSED', CANCELLED:'CANCELLED' };
function statusOfStage_(key){ return STAGE_STATUS[norm_(key)] || 'DRAFT'; }

function setStage_(sh, row, key, me, note){
  var hist = norm_(sh.getRange(row, colOf_('ประวัติขั้นตอน')).getDisplayValue());
  var line = nowStamp_() + ' · ' + stageDef_(key).name + ' · ' + (me ? me.name : '') + (note ? ' · ' + note : '');
  sh.getRange(row, colOf_('ขั้นตอน')).setValue(key);
  sh.getRange(row, colOf_('รับเรื่องเมื่อ')).setValue('');    // ขั้นใหม่ = ต้องกดรับเรื่องใหม่
  sh.getRange(row, colOf_('รับเรื่องโดย')).setValue('');
  sh.getRange(row, colOf_('สถานะ')).setValue(statusOfStage_(key));   // สถานะเดินตามขั้นตอนเสมอ
  sh.getRange(row, colOf_('รอใครทำ')).setValue(stageDef_(key).who);
  sh.getRange(row, colOf_('ประวัติขั้นตอน')).setValue((hist ? hist + '\n' : '') + line);
  sh.getRange(row, colOf_('แก้ไขล่าสุด')).setValue(nowStamp_());
}

/** ข้อมูลขั้นตอนสำหรับหน้าเว็บ — บอกได้เลยว่าใครทำอะไรต่อ และคนที่เปิดดูทำอะไรได้ */
function claimFlow(docNo, auth){
  var me = requireLogin_(auth);
  var d = dbOf_(docNo), r = findClaimRow_(d.claims, norm_(docNo));
  if (r < 0) return null;
  ensureCols_(d.claims, claimHdr_());

  var key = claimStage_(d.claims, r), st = stageDef_(key);
  var mine = (me.roles && me.roles.length) ? me.roles : [me.role];
  var isAdmin = mine.indexOf('ADMIN') >= 0;
  var isOwner = isAdmin;
  for (var i = 0; i < mine.length; i++) if (st.roles.indexOf(mine[i]) >= 0) isOwner = true;

  var rcvAt = norm_(d.claims.getRange(r, colOf_('รับเรื่องเมื่อ')).getDisplayValue());
  var received = st.needReceive ? !!rcvAt : true;

  return {
    needReceive: !!st.needReceive, receiveLabel: st.receiveLabel || '📥 กดรับเรื่อง',
    received: received,
    receivedAt: rcvAt,
    receivedBy: norm_(d.claims.getRange(r, colOf_('รับเรื่องโดย')).getDisplayValue()),
    isDraft: !!st.draft,
    canCancel: isAdmin && key !== 'CANCELLED' && key !== 'CLOSED',
    cancelReason: norm_(d.claims.getRange(r, colOf_('เหตุผลยกเลิก')).getDisplayValue()),
    stage:key, no:st.no, name:st.name, who:st.who, todo:st.todo,
    next:st.next, nextLabel:st.nextLabel,
    isOwner:isOwner,
    canReject: (['APPROVAL','STORE','PURCHASE','SUPPLIER'].indexOf(key) >= 0) && isOwner,
    canRejectReturn: (key === 'QC_RECV') && isOwner,
    round1Done: round1Done_(d.claims, r),
    results: resultList(),
    docNos: { gr:norm_(d.claims.getRange(r, colOf_('เลขที่รับของเข้าคลัง')).getDisplayValue()),
              grDate:norm_(d.claims.getRange(r, colOf_('วันที่รับของเข้าคลัง')).getDisplayValue()),
              rcv:norm_(d.claims.getRange(r, colOf_('เลขที่ใบตรวจรับของกลับ')).getDisplayValue()),
              rcvDate:norm_(d.claims.getRange(r, colOf_('วันที่ตรวจรับของกลับ')).getDisplayValue()),
              rcvBy:norm_(d.claims.getRange(r, colOf_('ผู้ตรวจรับของกลับ')).getDisplayValue()),
              is:norm_(d.claims.getRange(r, colOf_('เลขที่ใบเบิกออก')).getDisplayValue()),
              isDate:norm_(d.claims.getRange(r, colOf_('วันที่เบิกออก')).getDisplayValue()),
              cdn:norm_(d.claims.getRange(r, colOf_('เลขที่ใบเรียกเก็บรวม')).getDisplayValue()) },
    round: num_(d.claims.getRange(r, colOf_('รอบเคลม')).getDisplayValue()) || 1,
    rejectNote: norm_(d.claims.getRange(r, colOf_('เหตุผลที่ตีกลับ')).getDisplayValue()),
    rejectBy:   norm_(d.claims.getRange(r, colOf_('ตีกลับโดย')).getDisplayValue()),
    rejectAt:   norm_(d.claims.getRange(r, colOf_('ตีกลับเมื่อ')).getDisplayValue()),
    history:    norm_(d.claims.getRange(r, colOf_('ประวัติขั้นตอน')).getDisplayValue()),
    signs: signsOf_(d.claims, r),
    printedAt:  norm_(d.claims.getRange(r, colOf_('ปริ้นส่งออกแล้วเมื่อ')).getDisplayValue()),
    printedBy:  norm_(d.claims.getRange(r, colOf_('ปริ้นโดย')).getDisplayValue()),
    stages: STAGES.filter(function(s){ return !s.hidden; })
                  .map(function(s){ return { key:s.key, no:s.no, name:s.name, who:s.who }; }),
    lock: lockMap_(key, me, received),
    missing: claimMissing_(d, norm_(docNo), key)
  };
}

/** ช่องไหนคนนี้แก้ไม่ได้บ้าง + เพราะอะไร — ส่งให้หน้าเว็บทำเป็นช่องสีเทาพร้อมเหตุผล
 *  ส่งเฉพาะ "ช่องที่ล็อก" ไม่ต้องส่งทั้งหมด ข้อมูลจะได้ไม่บวม */
function lockMap_(stageKey, me, received){
  var out = {};
  var f;
  for (f in FIELD_STAGE){
    var g = canEditField_(stageKey, f, FIELD_STAGE, me, received);
    if (!g.ok) out[f] = g.why;
  }
  for (f in ITEM_STAGE){
    var g2 = canEditField_(stageKey, f, ITEM_STAGE, me, received);
    if (!g2.ok) out['item.' + f] = g2.why;
  }
  return out;
}

/* ═══ กดรับเรื่อง / กดรับเอกสาร ═══════════════════════════════
 * เบียร์: "ส่งต่อให้สโตร์ รับเรื่อง กรอก ... แล้วก็กดส่งหา จัดซื้อกดรับเอกสาร"
 * ก่อนกดรับ = ช่องของขั้นนั้นยังล็อกอยู่ · กดรับแล้วถึงเปิด และรู้ว่าใครเป็นคนรับ เมื่อไหร่ */
function receiveClaim(docNo, auth){
  var me = requireLogin_(auth);
  docNo = norm_(docNo);
  var d = dbOf_(docNo), r = findClaimRow_(d.claims, docNo);
  if (r < 0) throw new Error('ไม่พบใบเคลม ' + docNo);
  ensureCols_(d.claims, claimHdr_());

  var key = claimStage_(d.claims, r), st = stageDef_(key);
  if (!st.needReceive) throw new Error('ขั้นนี้ไม่ต้องกดรับเรื่อง');
  if (norm_(d.claims.getRange(r, colOf_('รับเรื่องเมื่อ')).getDisplayValue()))
    throw new Error('ขั้นนี้มีคนกดรับไปแล้ว');

  var mine = (me.roles && me.roles.length) ? me.roles : [me.role];
  var ok = mine.indexOf('ADMIN') >= 0;
  for (var i = 0; i < mine.length; i++) if (st.roles.indexOf(mine[i]) >= 0) ok = true;
  if (!ok) throw new Error('ขั้นนี้เป็นหน้าที่ของ ' + st.who + ' — สิทธิ์ของคุณคือ ' + mine.join(', '));

  d.claims.getRange(r, colOf_('รับเรื่องเมื่อ')).setValue(nowStamp_());
  d.claims.getRange(r, colOf_('รับเรื่องโดย')).setValue(me.name);
  signStage_(d.claims, r, key, me);          // กดรับ = เซ็นชื่อทันที เบียร์สั่งไว้
  var hist = norm_(d.claims.getRange(r, colOf_('ประวัติขั้นตอน')).getDisplayValue());
  d.claims.getRange(r, colOf_('ประวัติขั้นตอน'))
   .setValue((hist ? hist + '\n' : '') + nowStamp_() + ' · ' + st.name + ' · ' + me.name + ' · รับเรื่องแล้ว');
  log_('receiveClaim', docNo, key + ' · ' + me.name);
  try { CacheService.getScriptCache().remove('CLAIM_HOME'); } catch(e){}
  return { ok:true, at:nowStamp_(), by:me.name };
}

/* ═══ ยกเลิกใบเคลม — เบียร์เท่านั้น ═══════════════════════════
 * เบียร์: "สามารถกดยกเลิกใบเคลมได้ จากเบียร์เท่านั้น"                */
function cancelClaim(docNo, reason, auth){
  var me = requireLogin_(auth);
  var mine = (me.roles && me.roles.length) ? me.roles : [me.role];
  if (mine.indexOf('ADMIN') < 0) throw new Error('ยกเลิกใบเคลมได้เฉพาะผู้บริหารเท่านั้น');
  reason = norm_(reason);
  if (!reason) throw new Error('ต้องบอกเหตุผลที่ยกเลิก จะได้รู้ทีหลังว่าทำไมถึงยกเลิก');

  docNo = norm_(docNo);
  var d = dbOf_(docNo), r = findClaimRow_(d.claims, docNo);
  if (r < 0) throw new Error('ไม่พบใบเคลม ' + docNo);
  ensureCols_(d.claims, claimHdr_());
  if (claimStage_(d.claims, r) === 'CANCELLED') throw new Error('ใบนี้ยกเลิกไปแล้ว');

  setStage_(d.claims, r, 'CANCELLED', me, 'ยกเลิก: ' + reason);
  d.claims.getRange(r, colOf_('เหตุผลยกเลิก')).setValue(reason);
  log_('cancelClaim', docNo, reason);
  try { CacheService.getScriptCache().remove('CLAIM_HOME'); } catch(e){}
  return { ok:true, stage:'CANCELLED' };
}

/* ═══ QC ไม่ Accept ของที่ Supplier ส่งกลับมา → วนกลับเป็นเคลมรอบใหม่ ═══
 * สเปคข้อ 4.5 · เบียร์: "ไม่ Accept = ระบบเปิดใบเคลมรอบใหม่ให้"
 * ใบเดิม เลขเดิม แต่ล้างลายเซ็นรอบ 2 และเลขเอกสาร GR/RCV/IS ทิ้ง แล้วกลับไปหาจัดซื้อ */
function rejectReturn(docNo, reason, auth){
  var me = requireLogin_(auth);
  docNo = norm_(docNo); reason = norm_(reason);
  if (!reason) throw new Error('ต้องบอกเหตุผลที่ไม่ Accept จะได้บอก Supplier ได้ว่าไม่ผ่านตรงไหน');

  var d = dbOf_(docNo), r = findClaimRow_(d.claims, docNo);
  if (r < 0) throw new Error('ไม่พบใบเคลม ' + docNo);
  ensureCols_(d.claims, claimHdr_());

  var key = claimStage_(d.claims, r);
  if (key !== 'QC_RECV') throw new Error('ปุ่มนี้ใช้ได้เฉพาะตอนที่ใบอยู่ขั้น QC ตรวจรับของกลับ');
  var mine = (me.roles && me.roles.length) ? me.roles : [me.role];
  var ok = mine.indexOf('ADMIN') >= 0;
  for (var i = 0; i < mine.length; i++) if (['QC','PRODUCTION'].indexOf(mine[i]) >= 0) ok = true;
  if (!ok) throw new Error('ตรวจรับของกลับได้เฉพาะ QC และ Production');

  for (var j = 0; j < SIGN_R2.length; j++) d.claims.getRange(r, colOf_(SIGN_R2[j])).setValue('');
  ['เลขที่รับของเข้าคลัง','วันที่รับของเข้าคลัง','เลขที่ใบตรวจรับของกลับ','วันที่ตรวจรับของกลับ',
   'ผู้ตรวจรับของกลับ','เลขที่ใบเบิกออก','วันที่เบิกออก']
    .forEach(function(c){ d.claims.getRange(r, colOf_(c)).setValue(''); });
  d.claims.getRange(r, colOf_('ผลการเคลม')).setValue('');

  var rnd = num_(d.claims.getRange(r, colOf_('รอบเคลม')).getDisplayValue()) || 1;
  d.claims.getRange(r, colOf_('รอบเคลม')).setValue(rnd + 1);
  setStage_(d.claims, r, 'PURCHASE', me, 'QC ไม่ Accept ของที่ส่งกลับมา — รอบที่ ' + (rnd + 1));
  d.claims.getRange(r, colOf_('เหตุผลที่ตีกลับ'))
   .setValue('QC ไม่ Accept ของที่ Supplier ส่งกลับมา — ' + reason);
  d.claims.getRange(r, colOf_('ตีกลับโดย')).setValue(me.name);
  d.claims.getRange(r, colOf_('ตีกลับเมื่อ')).setValue(nowStamp_());

  lineToStage_('PURCHASE',
    '↩ ของที่ส่งกลับมา QC ไม่ Accept\n' +
    'เลขที่ ' + docNo + ' · รอบที่ ' + (rnd + 1) + '\n' +
    'เหตุผล: ' + reason + '\n' +
    'กลับไปคุยกับ Supplier ใหม่ — โดย ' + me.name);
  log_('rejectReturn', docNo, reason);
  try { CacheService.getScriptCache().remove('CLAIM_HOME'); } catch(e){}
  return { ok:true, stage:'PURCHASE', round:rnd + 1 };
}

/** ส่งงานต่อขั้นถัดไป — ตรวจให้ครบก่อน ไม่ให้ส่งของที่ยังขาด */
function advanceClaim(docNo, auth){
  var me = requireLogin_(auth);
  docNo = norm_(docNo);
  var d = dbOf_(docNo), r = findClaimRow_(d.claims, docNo);
  if (r < 0) throw new Error('ไม่พบใบเคลม ' + docNo);
  ensureCols_(d.claims, claimHdr_());

  var key = claimStage_(d.claims, r), st = stageDef_(key);
  if (!st.next) throw new Error('เอกสารนี้ปิดงานแล้ว');

  var mine = (me.roles && me.roles.length) ? me.roles : [me.role];
  var allow = st.nextRoles || st.roles;          // บางขั้น คนกดส่งต่อไม่ใช่คนเดียวกับคนกรอก
  var ok = (!st.nextRoles) && mine.indexOf('ADMIN') >= 0;
  for (var i = 0; i < mine.length; i++) if (allow.indexOf(mine[i]) >= 0) ok = true;
  if (!ok) throw new Error(st.nextRoles
      ? 'ขั้นนี้ต้องให้ผู้บริหารเป็นคนกด — สิทธิ์ของคุณคือ ' + mine.join(', ')
      : 'ขั้นนี้เป็นหน้าที่ของ ' + st.who + ' — สิทธิ์ของคุณคือ ' + mine.join(', '));

  if (st.needReceive && !norm_(d.claims.getRange(r, colOf_('รับเรื่องเมื่อ')).getDisplayValue()))
    throw new Error('ยังไม่ได้กด "' + st.receiveLabel + '" — ต้องกดรับก่อนถึงจะส่งต่อได้');

  var miss = claimMissing_(d, docNo, key);
  if (miss.length) throw new Error('ยังส่งต่อไม่ได้ — ' + miss.join(' · '));

  /* ระบบออกเลขเอกสาร + วันที่ให้ตรงขั้นที่เพิ่งทำเสร็จ (เบียร์สั่ง 7 ก.ย.) */
  var today = nowStamp_().split(' ')[0], emit = '';
  if (key === 'STORE_IN' && !norm_(d.claims.getRange(r, colOf_('เลขที่รับของเข้าคลัง')).getDisplayValue())){
    emit = nextFlowNo_('GR', 'เลขที่รับของเข้าคลัง');
    d.claims.getRange(r, colOf_('เลขที่รับของเข้าคลัง')).setValue(emit);
    d.claims.getRange(r, colOf_('วันที่รับของเข้าคลัง')).setValue(today);
  }
  if (key === 'QC_RECV' && !norm_(d.claims.getRange(r, colOf_('เลขที่ใบตรวจรับของกลับ')).getDisplayValue())){
    emit = nextFlowNo_('RCV', 'เลขที่ใบตรวจรับของกลับ');
    d.claims.getRange(r, colOf_('เลขที่ใบตรวจรับของกลับ')).setValue(emit);
    d.claims.getRange(r, colOf_('วันที่ตรวจรับของกลับ')).setValue(today);
    d.claims.getRange(r, colOf_('ผู้ตรวจรับของกลับ')).setValue(me.name + (me.dept ? ' · ' + me.dept : ''));
  }
  if (key === 'STORE_OUT' && !norm_(d.claims.getRange(r, colOf_('เลขที่ใบเบิกออก')).getDisplayValue())){
    emit = nextFlowNo_('IS', 'เลขที่ใบเบิกออก');
    d.claims.getRange(r, colOf_('เลขที่ใบเบิกออก')).setValue(emit);
    d.claims.getRange(r, colOf_('วันที่เบิกออก')).setValue(today);
  }

  var goTo = nextStage_(d.claims, r, key);   // ขั้น SUPPLIER แยกทางตามคำตอบ Supplier
  signStage_(d.claims, r, key, me);          // เซ็นชื่อขั้นที่เพิ่งทำเสร็จ
  setStage_(d.claims, r, goTo, me, emit ? ('ออกเลขที่ ' + emit) : '');
  d.claims.getRange(r, colOf_('เหตุผลที่ตีกลับ')).setValue('');    // ส่งต่อได้ = เคลียร์เหตุผลเดิม

  var nx = stageDef_(goTo);
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
  log_('advanceClaim', docNo, key + ' → ' + goTo + (emit ? ' · ' + emit : ''));
  try { CacheService.getScriptCache().remove('CLAIM_HOME'); } catch(e){}
  return { ok:true, stage:goTo, docNo:emit };
}

/** ตีกลับ — จัดซื้อเลือกได้ว่าจะส่งกลับหาใคร พร้อมเหตุผล (บังคับ) */
function rejectClaim(docNo, toStage, reason, auth){
  var me = requireLogin_(auth);
  docNo = norm_(docNo); reason = norm_(reason);
  if (!reason) throw new Error('ต้องบอกเหตุผลที่ตีกลับ ไม่งั้นคนรับไม่รู้ว่าต้องแก้อะไร');

  var d = dbOf_(docNo), r = findClaimRow_(d.claims, docNo);
  if (r < 0) throw new Error('ไม่พบใบเคลม ' + docNo);
  ensureCols_(d.claims, claimHdr_());

  var cur = claimStage_(d.claims, r);
  var mine = (me.roles && me.roles.length) ? me.roles : [me.role];
  if (mine.indexOf('ADMIN') < 0 && mine.indexOf('PURCHASE') < 0 && mine.indexOf('STORE') < 0
      && mine.indexOf('APPROVER') < 0){
    throw new Error('ตีกลับได้เฉพาะผู้บังคับบัญชา สโตร์ และจัดซื้อ');
  }
  var to = stageDef_(toStage);
  if (to.key !== 'REQUEST' && to.key !== 'STORE') throw new Error('ตีกลับได้เฉพาะไปหาต้นน้ำ (ทีมงานที่เปิดใบ) หรือสโตร์');

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
    if (!norm_(h['เลขใบส่งมอบ'])) miss.push('ยังไม่ใส่เลขใบส่งมอบ');
    var noPo = [], noSup = [];
    for (var m = 0; m < items.length; m++){
      if (!norm_(items[m][8]))  noPo.push(norm_(items[m][1]));    // PO
      if (!norm_(items[m][9]))  noSup.push(norm_(items[m][1]));   // Supplier
    }
    if (noPo.length)  miss.push('รายการที่ ' + noPo.join(', ') + ' ยังไม่มี PO');
    if (noSup.length) miss.push('รายการที่ ' + noSup.join(', ') + ' ยังไม่มี Supplier');
  }

  /* ขั้นจัดซื้อบันทึกผล — ต้องเลือกคำตอบ Supplier ก่อน ไม่งั้นระบบไม่รู้ว่าจะเดินทางไหนต่อ */
  if (stageKey === 'SUPPLIER'){
    var res = norm_(h['ผลการเคลม']);
    if (!CLAIM_RESULTS[res]) miss.push('ยังไม่ได้เลือกผลการเคลมจาก Supplier (4 กรณี)');
    var noCost = [];
    for (var c = 0; c < items.length; c++) if (!norm_(items[c][11])) noCost.push(norm_(items[c][1]));
    if (CLAIM_RESULTS[res] && CLAIM_RESULTS[res].bill && noCost.length)
      miss.push('รายการที่ ' + noCost.join(', ') + ' ยังไม่ได้ใส่ต้นทุน');
  }

  if (stageKey === 'STORE_IN'){
    if (!norm_(d.claims.getRange(r, colOf_('ที่เก็บในคลัง')).getDisplayValue()))
      miss.push('ยังไม่ได้ระบุที่เก็บในคลัง (Location)');
  }

  if (stageKey === 'QC_RECV'){
    var noAcc = [], notOk = [];
    for (var q = 0; q < items.length; q++){
      var a = norm_(items[q][14]);                       // ผลตรวจ (Accept ของที่ได้กลับมา)
      if (!a) noAcc.push(norm_(items[q][1]));
      else if (a === 'NO' || a === 'ไม่ Accept') notOk.push(norm_(items[q][1]));
    }
    if (noAcc.length) miss.push('ของที่ได้กลับมา รายการที่ ' + noAcc.join(', ') + ' ยังไม่ได้ตรวจรับ');
    if (notOk.length) miss.push('รายการที่ ' + notOk.join(', ') + ' ไม่ Accept — ต้องกดปุ่ม "วนกลับเป็นเคลมรอบใหม่"');
  }

  if (stageKey === 'STORE_OUT'){
    if (!norm_(d.claims.getRange(r, colOf_('ผู้รับของหน้างาน')).getDisplayValue()))
      miss.push('ยังไม่ได้ระบุผู้รับของหน้างาน');
    if (!norm_(d.claims.getRange(r, colOf_('แผนกที่เบิกไปใช้')).getDisplayValue()))
      miss.push('ยังไม่ได้ระบุแผนกที่เบิกไปใช้');
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
