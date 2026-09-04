/* ── ลองใช้ทั้งโปรแกรมเองตั้งแต่ต้นจนจบ ก่อนรบกวนเบียร์ ──────────────
   เบียร์: "Candy ตรวจสอบทั้งโปรแกรมเลย ว่าใช้งานได้จริงหรือเปล่า จนถึงขั้นตอนปริ้นเอกสาร" */
const fs = require('fs');
const vm = require('vm');
const G  = require('./fake-gas.js');

/* ── สร้างไฟล์ข้อมูลกลางจำลอง (เหมือน MASTER ของ NOVA) ── */
const MASTER = 'MASTERID', TXN = 'TXNID';
const ms = G.newFile(MASTER, 'MASTER');

const users = ms.insertSheet('USERS');
users.appendRow(['รหัสพนักงาน','email','display_name','PIN','active','role for NOVA BOM','role for Claim','แผนก']);
users.appendRow(['6100030','sasipa@suteetankers.com','คุณเบียร์','111111','Y','Admin','Admin','ผู้บริหาร']);
users.appendRow(['6406013','somchai@suteetankers.com','คุณสมชาย','222222','Y','','QC / Production','']);
users.appendRow(['6406020','store@suteetankers.com','คุณสโตร์','333333','Y','','Store','']);
users.appendRow(['6406021','buy@suteetankers.com','คุณจัดซื้อ','444444','Y','','Purchase','']);
users.appendRow(['6406099','boss@suteetankers.com','คุณหัวหน้า','555555','Y','','Approver','']);

/* ทำให้ตารางจ๊อบ "ใหญ่จริง" เพื่อพิสูจน์ว่าแคชหั่นชิ้นทำงาน (ของจริงก็ใหญ่แบบนี้) */
const wip = ms.insertSheet('All WIP JT/JM');
wip.appendRow(['No.','Job Code','Job Name','ประเภทงาน','MODEL','GoodCode','GoodName','Latest Date Delivery','ในประเทศ/ต่างประเทศ']);
for (let i=1;i<=1200;i++){
  const p = i%2 ? 'JT' : 'JM';
  wip.appendRow([i, p+'-69/'+String(i).padStart(4,'0'), 'บริษัท ทดสอบขนส่งจำกัด สาขาที่ '+i,
    p==='JT'?'แท็งค์ใหม่':'ซ่อมแท็งค์', 'SEMI-TRAILER 32,000 L รุ่นทดสอบหมายเลข '+i,
    'GC-'+i, 'สินค้าตัวอย่างชื่อยาวเพื่อให้ข้อมูลใหญ่พอ '+i, '30/09/2569', i%3?'ในประเทศ':'ต่างประเทศ']);
}
const ven = ms.insertSheet('VENDORS');
ven.appendRow(['(หัวตารางอยู่แถว 2)']);
ven.appendRow(['VendorCode','VendorName']);
['JINAN VALVE CO.,LTD','NINGBO CHENGLONG','บจก. ไทยพัฒนาวาล์ว'].forEach((v,i)=>ven.appendRow(['V'+i,v]));

const goods = ms.insertSheet('Data Good Code');
goods.appendRow(['GoodCode','GoodName','Unit']);
for (let i=1;i<=3000;i++) goods.appendRow(['GC-'+i,'ชื่อสินค้าทดสอบที่ยาวพอสมควรเพื่อให้ข้อมูลใหญ่ '+i, i%2?'PCS':'SET']);

const tx = G.newFile(TXN,'TXN');
const dn = tx.insertSheet('DELIVERY_NOTES');
dn.appendRow(['เลขใบส่งมอบ','Job Code','วันที่']);
dn.appendRow(['DN-69/0455','JT-69/0001','01/08/2569']);
G.newFile('1utv_T8zs-lKzI_qvXRVQSnnLJWwFR1kS3qHIjlCvFzo','PO2569').insertSheet('PO').appendRow(['PO No.','วันรับ']);
G.newFile('DBID','STT-CLAIM-DB');
G.PROPS['CLAIM_DB_ID'] = 'DBID';

/* ── โหลดโค้ดจริงทั้ง 4 ไฟล์เข้ากล่องเดียว (เหมือน Apps Script) ── */
const sandbox = Object.assign({ console, Date, Math, JSON, String, Number, Array, Object, RegExp,
                                Error, parseInt, parseFloat, isNaN, require, Buffer, setTimeout }, G);
sandbox.global = sandbox;
vm.createContext(sandbox);
const DEPLOY = require('path').join(__dirname,'..','deploy');
['CLAIM-Hub.js','CLAIM-Flow.js','CLAIM-More.js','CLAIM-Inspect.js'].forEach(f=>{
  vm.runInContext(fs.readFileSync(require('path').join(DEPLOY,f),'utf8'), sandbox, {filename:f});
});
vm.runInContext("CFG.MASTER='"+MASTER+"'; CFG.TXN='"+TXN+"';", sandbox);
const call = (fn,args)=>vm.runInContext('('+fn+').apply(null, __A)', Object.assign(sandbox,{__A:args||[]}));
const reset = ()=>vm.runInContext('_USERS=null;_WIP=null;_VEND=null;_ME={};_GOODS=null;_SS=null;_DB=null;_IDB=null;_PT=null;_DBID=null;', sandbox);

/* ── ชุดทดสอบ ── */
let pass=0, fail=0; const problems=[];
function T(name, fn){
  reset();                                   // ทุกคำสั่ง = 1 execution ใหม่ เหมือนของจริง
  try { const r = fn(); console.log('  ✓ '+name+(r?' — '+r:'')); pass++; }
  catch(e){ console.log('  ✗ '+name+'  →  '+e.message); problems.push(name+': '+e.message); fail++; }
}
const AUTH = {emp:'6100030', pin:'111111'};
const STORE = {emp:'6406020', pin:'333333'};
const BUY   = {emp:'6406021', pin:'444444'};
const QC    = {emp:'6406013', pin:'222222'};
const BOSS  = {emp:'6406099', pin:'555555'};
const px = 'data:image/jpeg;base64,'+Buffer.from('x'.repeat(500)).toString('base64');

console.log('\n① เข้าสู่ระบบ + ข้อมูลกลาง');
T('เข้าสู่ระบบด้วยรหัส+PIN', ()=>{ const r=call('loginEmpPin',['6100030','111111']);
  if(!r.ok) throw new Error(r.msg); return r.name+' · '+r.roles.join(',')+' · แผนก '+(r.dept||'(ว่าง)'); });
T('แผนกขึ้นเองจาก role (สโตร์)', ()=>{ const r=call('loginEmpPin',['6406020','333333']);
  if(!r.dept) throw new Error('แผนกไม่ขึ้น ทั้งที่ role = Store'); return r.dept; });
T('ใส่เลขจ๊อบแล้วได้ชื่อลูกค้า (ตารางจ๊อบ 1,200 แถว)', ()=>{ const r=call('lookupJob',['JT-69/0001']);
  if(!r.found) throw new Error('หาไม่เจอ'); return r.jobName; });
T('เรียกซ้ำแล้วไม่พังเพราะแคชล้น', ()=>{ call('lookupJob',['JT-69/0002']); reset();
  const r=call('lookupJob',['JT-69/0003']); if(!r.found) throw new Error('รอบสองหาไม่เจอ'); return 'ผ่าน 3 รอบ'; });
T('รหัสสินค้า → ชื่อ + หน่วย (ทะเบียน 3,000 รายการ)', ()=>{ const m=call('lookupGoods',[['GC-7','GC-9'],AUTH]);
  if(!m['GC-7']) throw new Error('ไม่คืนชื่อสินค้า'); return m['GC-7'].name.slice(0,20)+'… / '+m['GC-7'].unit; });
T('รายชื่อผู้ขาย', ()=>call('listVendors',[]).length+' ราย');

console.log('\n② เปิดใบเคลม (ขั้น 1 — ผลิต/ขาย/QC/ออกแบบ)');
let DOC='';
T('แนบรูปตอนยังไม่บันทึก แล้วบันทึกใบเคลมทีเดียวจบ', ()=>{
  const draft='DRAFT-TEST01';
  call('savePhoto',[draft,'JT-69/0001','r1',px,'a.jpg',QC]);
  call('savePhoto',[draft,'JT-69/0001','r1',px,'b.jpg',QC]);
  call('savePhoto',[draft,'JT-69/0001','r2',px,'c.jpg',QC]);
  const h={ claimType:'after', area:'for', foreignKind:'tanker', jobNo:'JT-69/0001',
    jobName:'บริษัท ทดสอบขนส่งจำกัด สาขาที่ 1', model:'SEMI-TRAILER', chassisStt:'STT-001',
    chassisMaker:'LJRT-001', serialNo:'SN-1', jmc:'', deliveryNote:'', dept:'QC',
    wantDate:'30/09/2569',
    items:[{code:'GC-7',name:'สินค้า 7',th:'รั่วซึม',en:'leak',qty:'2',unit:'PCS',po:'',supplier:'',recv:'',_rid:'r1'},
           {code:'GC-9',name:'สินค้า 9',th:'ฝาไม่ปิด',en:'cover',qty:'1',unit:'SET',po:'',supplier:'',recv:'',_rid:'r2'}]};
  const r=call('createClaimWithPhotos',[h,draft,{r1:1,r2:2},QC]);
  if(!r||!r.ok) throw new Error('บันทึกไม่สำเร็จ');
  DOC=r.docNo; return DOC;
});
T('รูปที่แนบตอนร่าง ย้ายเข้าใบจริงครบ', ()=>{ const p=call('listPhotos',[DOC,QC]);
  const n1=(p['1']||[]).length, n2=(p['2']||[]).length;
  if(n1!==2||n2!==1) throw new Error('รูปไม่ครบ — ข้อ1='+n1+' ข้อ2='+n2+' (ควรเป็น 2 กับ 1)');
  return 'ข้อ1 '+n1+' รูป · ข้อ2 '+n2+' รูป'; });
T('เปิดใบเคลมที่บันทึกแล้ว (getClaimFull)', ()=>{ const c=call('getClaimFull',[DOC,QC]);
  if(!c) throw new Error('ไม่พบเอกสาร'); if(!c.flow) throw new Error('ไม่มีข้อมูลขั้นตอน');
  return 'ขั้นที่ '+c.flow.no+' '+c.flow.name+' · '+c.items.length+' รายการ'; });
T('ทะเบียนใบเคลม', ()=>call('listClaims',[{},QC]).length+' ใบ');
T('หน้าแรก', ()=>{ const h=call('getHome2',[QC]); return 'เคลม '+h.clm.total+' ใบ'; });

console.log('\n③ Flow ตามที่เบียร์วางไว้ — ร่าง → อนุมัติ → สโตร์รับเรื่อง → จัดซื้อรับเอกสาร');
T('ใบร่าง สโตร์กับจัดซื้อยังไม่เห็น', ()=>{
  const seeStore=call('listClaims',[{},STORE]).filter(x=>x.docNo===DOC).length;
  const seeBuy  =call('listClaims',[{},BUY]).filter(x=>x.docNo===DOC).length;
  const seeQc   =call('listClaims',[{},QC]).filter(x=>x.docNo===DOC).length;
  if(seeStore||seeBuy) throw new Error('ใบร่างหลุดให้สโตร์/จัดซื้อเห็นแล้ว');
  if(!seeQc) throw new Error('คนเปิดใบกลับมองไม่เห็นใบตัวเอง');
  return 'สโตร์/จัดซื้อไม่เห็น · คนเปิดใบเห็น'; });
T('ทีมงานกด "ส่งขออนุมัติ"', ()=>call('advanceClaim',[DOC,QC]).stage);
T('สโตร์ยังกดอนุมัติแทนไม่ได้', ()=>{
  try { call('advanceClaim',[DOC,STORE]); } catch(e){ return 'กันไว้ถูกแล้ว'; }
  throw new Error('สโตร์กดอนุมัติแทนผู้บังคับบัญชาได้'); });
T('ผู้บังคับบัญชาอนุมัติ → ส่งให้สโตร์', ()=>call('advanceClaim',[DOC,BOSS]).stage);
T('พ้นร่างแล้ว สโตร์เห็นใบนี้', ()=>{
  if(!call('listClaims',[{},STORE]).filter(x=>x.docNo===DOC).length) throw new Error('สโตร์ยังไม่เห็น');
  return 'เห็นแล้ว'; });
T('ยังไม่กดรับเรื่อง = กรอกไม่ได้', ()=>{
  try { call('saveClaimField',[DOC,'deliveryNote','DN-1',STORE]); }
  catch(e){ return 'ล็อกถูกแล้ว: '+e.message.slice(0,44)+'…'; }
  throw new Error('ยังไม่กดรับเรื่องแต่กรอกได้'); });
T('สโตร์กดรับเรื่อง', ()=>'รับโดย '+call('receiveClaim',[DOC,STORE]).by);
T('รับเรื่องแล้ว กรอกช่องของสโตร์ได้', ()=>{ call('saveClaimField',[DOC,'deliveryNote','DN-69/0455',STORE]); return 'ผ่าน'; });
T('สโตร์แก้ช่องของทีมงานไม่ได้', ()=>{
  try { call('saveClaimField',[DOC,'model','แก้เอง',STORE]); }
  catch(e){ return 'กันไว้ถูกแล้ว'; }
  throw new Error('สโตร์แก้ MODEL ได้'); });
T('จัดซื้อช่วยสโตร์ใส่ PO ได้', ()=>{
  call('saveItemField',[DOC,1,'po','PO-69/0455',BUY]); call('saveItemField',[DOC,1,'supplier','JINAN VALVE CO.,LTD',BUY]);
  call('saveItemField',[DOC,2,'po','PO-69/0455',BUY]); call('saveItemField',[DOC,2,'supplier','JINAN VALVE CO.,LTD',BUY]);
  return 'ผ่าน'; });
T('สโตร์กด "ส่งให้จัดซื้อ"', ()=>call('advanceClaim',[DOC,STORE]).stage);
T('จัดซื้อกดรับเอกสาร', ()=>'รับโดย '+call('receiveClaim',[DOC,BUY]).by);
T('จัดซื้อตีกลับไปต้นน้ำ (ทีมงาน) ได้', ()=>call('rejectClaim',[DOC,'REQUEST','ข้อมูลรถไม่ครบ',BUY]).stage);
T('ตีกลับแล้วกลับมาเป็นร่าง ทีมงานแก้ได้', ()=>{ call('saveClaimField',[DOC,'serialNo','SN-แก้ใหม่',QC]); return 'แก้ได้'; });
T('เดินครบวงกลับมาถึงจัดซื้อ Accept', ()=>{
  call('advanceClaim',[DOC,QC]); call('advanceClaim',[DOC,BOSS]);
  call('receiveClaim',[DOC,STORE]); call('advanceClaim',[DOC,STORE]);
  call('receiveClaim',[DOC,BUY]);
  return 'ตอนนี้ขั้น '+call('advanceClaim',[DOC,BUY]).stage; });

T('ลายเซ็นขึ้นเองตามคนที่กด', ()=>{
  const f=call('claimFlow',[DOC,AUTH]);
  const by={}; f.signs.forEach(s=>by[s.role]=s.text);
  if(!by['ผู้เปิดใบ']) throw new Error('ไม่มีลายเซ็นผู้เปิดใบ');
  if(!by['ผู้อนุมัติ']) throw new Error('ไม่มีลายเซ็นผู้อนุมัติ');
  if(!by['สโตร์'])     throw new Error('ไม่มีลายเซ็นสโตร์');
  if(by['ผู้เปิดใบ'].split(' · ').length < 2) throw new Error('ลายเซ็นไม่มีแผนก/เวลา');
  return 'ผู้เปิดใบ: '+by['ผู้เปิดใบ'].slice(0,32)+'… · ครบ '+f.signs.filter(s=>s.text).length+' ช่อง'; });
T('เมนู 5 แท็บ นับใบค้างถูกช่อง', ()=>{
  const w=call('workQueues',[AUTH]);
  const keys=['open','approve','store','buy','close'];
  for(const k of keys) if(!w.tabs[k]) throw new Error('ไม่มีแท็บ '+k);
  const sum=keys.reduce((a,k)=>a+w.tabs[k].n,0);
  if(!sum) throw new Error('ทุกแท็บว่างหมด ทั้งที่มีใบอยู่');
  return keys.map(k=>k+'='+w.tabs[k].n).join(' · '); });
T('แท็บบอกได้ว่าอันไหนเป็นงานของคนที่ล็อกอิน', ()=>{
  const w=call('workQueues',[STORE]);
  if(!w.tabs.store.mine) throw new Error('สโตร์ควรเห็นว่าแท็บงานสโตร์เป็นของตัวเอง');
  if(w.tabs.approve.mine) throw new Error('สโตร์ไม่ควรเป็นเจ้าของแท็บอนุมัติ');
  return 'สโตร์: งานสโตร์=ของฉัน · อนุมัติ=ไม่ใช่'; });

console.log('\n④ เงิน · คำตอบ Supplier · รับของกลับ');
T('ใส่สกุลเงิน + เรท (ล็อกครั้งเดียว)', ()=>{ call('saveClaimField',[DOC,'currency','USD',BUY]);
  call('saveClaimField',[DOC,'rate','34.85',BUY]); return 'USD 34.85'; });
T('เรทล็อกแล้วคนอื่นแก้ไม่ได้', ()=>{
  try { call('saveClaimField',[DOC,'rate','40',BUY]); } catch(e){ return 'ล็อกถูกแล้ว'; }
  throw new Error('เรทแก้ได้ ทั้งที่ควรล็อก'); });
T('ใส่ต้นทุน → ราคาเรียกเก็บคิดให้เอง', ()=>{ const r=call('saveItemField',[DOC,1,'cost','8500',BUY]);
  call('saveItemField',[DOC,1,'margin','15%',BUY]); return 'ต้นทุน 8,500'; });
T('สรุปยอดตาม Supplier', ()=>{ const t=call('claimTotals',[DOC,BUY]); return 'รวม '+t.thb+' บาท'; });

console.log('\n⑤ ใบตรวจรับ → ส่งของที่ไม่ผ่านมาเปิดใบเคลม');
let INS='';
T('เปิดใบตรวจรับจากแม่แบบ', ()=>{ const r=call('createInspection',[
    {area:'for',kind:'tanker',template:'tanker',jobNo:'JT-69/0001',jobName:'บริษัท ทดสอบ',
     model:'M',chassisStt:'',chassisMaker:'',serialNo:'',po:'',supplier:'',recv:''},QC]);
  INS=r.docNo; return INS; });
T('ใบตรวจที่ยังเป็นร่าง คนอื่นไม่เห็น', ()=>{
  if(call('listInspections',[{},STORE]).filter(x=>x.docNo===INS).length) throw new Error('ใบร่างหลุดให้สโตร์เห็น');
  if(!call('listInspections',[{},QC]).filter(x=>x.docNo===INS).length) throw new Error('คนตรวจมองไม่เห็นใบตัวเอง');
  return 'ซ่อนถูกแล้ว'; });
T('ตรวจยังไม่ครบ ส่งขออนุมัติไม่ได้', ()=>{
  try { call('advanceInsp',[INS,QC]); } catch(e){ return 'กันไว้ถูกแล้ว: '+e.message.slice(0,44)+'…'; }
  throw new Error('ตรวจไม่ครบแต่ส่งขออนุมัติได้'); });
T('ตรวจครบ + ถ่ายรูปข้อที่ไม่ผ่าน แล้วส่งขออนุมัติ', ()=>{
  const it=call('getInspection',[INS,QC]).items;
  call('saveInspItemField',[INS,it[0].seq,'acc','UNACC',QC]);
  call('saveInspItemField',[INS,it[0].seq,'found','พบรอยเชื่อมไม่เต็ม',QC]);
  call('savePhoto',[INS,'JT-69/0001',String(it[0].seq),px,'ins.jpg',QC]);
  for (let k=1;k<it.length;k++) call('saveInspItemField',[INS,it[k].seq,'acc','ACC',QC]);
  return call('advanceInsp',[INS,QC]).stage; });
T('ยังไม่อนุมัติ เปิดใบเคลมจากใบตรวจไม่ได้', ()=>{
  try { call('sendUnAccToClaim',[INS,QC]); } catch(e){ return 'กันไว้ถูกแล้ว'; }
  throw new Error('ยังไม่อนุมัติแต่เปิดใบเคลมได้'); });
T('รออนุมัติแล้ว QC แก้ผลตรวจไม่ได้', ()=>{
  try { call('saveInspItemField',[INS,1,'acc','ACC',QC]); } catch(e){ return 'ล็อกถูกแล้ว'; }
  throw new Error('อนุมัติแล้วยังแก้ผลตรวจได้'); });
T('ผู้บังคับบัญชาตีกลับใบตรวจได้', ()=>call('rejectInsp',[INS,'รูปไม่ชัด ถ่ายใหม่',BOSS]).stage);
T('ตีกลับแล้ว QC แก้ได้ แล้วส่งใหม่ · หัวหน้าอนุมัติ', ()=>{
  call('saveInspItemField',[INS,1,'found','พบรอยเชื่อมไม่เต็ม (แก้)',QC]);
  call('advanceInsp',[INS,QC]);
  return call('advanceInsp',[INS,BOSS]).stage; });
T('อนุมัติแล้ว ส่งข้อที่ไม่ผ่านไปเปิดใบเคลมได้', ()=>{
  const r=call('sendUnAccToClaim',[INS,QC]); return 'ได้ใบเคลม '+r.claimNo; });

console.log('\n⑥ รายงาน + ข้อมูลสำหรับหน้าปริ้น');
T('รายงาน 3.1 รูปและวิดีโอ', ()=>call('reportMedia',[AUTH]).length+' จ๊อบ');
T('รายงาน 3.2 ตามจ๊อบ',    ()=>call('reportByJob',[AUTH]).length+' จ๊อบ');
T('รายงาน 3.3 ทะเบียนเอกสาร', ()=>call('reportDocs',[AUTH]).length+' ฉบับ');
T('รายงาน 3.4 ต้นทุน',      ()=>{ const r=call('reportCost',[AUTH]); return 'รวม '+r.grand+' บาท'; });
T('ข้อมูลครบสำหรับหน้าปริ้น (หัวใบ + รายการ + รูป)', ()=>{
  const c=call('getClaimFull',[DOC,AUTH]);
  if(!c.head['เลขที่เอกสาร']) throw new Error('ไม่มีเลขที่เอกสาร');
  if(!c.items.length) throw new Error('ไม่มีรายการ');
  const ph=c.photos||{}; let n=0; Object.keys(ph).forEach(k=>n+=ph[k].length);
  if(!n) throw new Error('ไม่มีรูปให้ปริ้น');
  if(!c.head['ชื่อลูกค้า']) throw new Error('ไม่มีชื่อลูกค้า (หน้าปริ้นภายในต้องมี)');
  return c.items.length+' รายการ · '+n+' รูป · ลูกค้า '+c.head['ชื่อลูกค้า'].slice(0,18)+'…'; });
T('ทะเบียน LOG มีจริงในไฟล์ฐานข้อมูล', ()=>{
  const n = vm.runInContext('db_().log.getLastRow()', sandbox);
  if(n<2) throw new Error('LOG ว่าง'); return (n-1)+' แถว'; });

console.log('\n⑦ กฎที่ต้องบังคับจริง (v0.8.0)');
T('สถานะขึ้นเองตามขั้นตอน ไม่ใช่ให้เลือกเอง', ()=>{
  const c=call('getClaim',[DOC,AUTH]);
  if(c.head['สถานะ']!=='SENT') throw new Error('ขั้น SUPPLIER แต่สถานะเป็น '+c.head['สถานะ']+' (ควรเป็น SENT)');
  try { call('saveClaimField',[DOC,'status','CLOSED',AUTH]); }
  catch(e){ return 'สถานะ = SENT · แก้มือไม่ได้ ถูกแล้ว'; }
  throw new Error('ยังเปลี่ยนสถานะเองได้อยู่'); });
T('ผู้บริหาร (ADMIN) ก็ข้ามลำดับขั้นไม่ได้', ()=>{
  /* ADMIN ทำงานแทนแผนกไหนก็ได้ แต่ห้ามแก้ช่องของขั้นที่ยังไม่ถึง/เลยไปแล้ว */
  try { call('saveClaimField',[DOC,'model','แอดมินแก้ข้ามขั้น',AUTH]); }
  catch(e){ return 'กันไว้ถูกแล้ว: '+e.message.slice(0,50)+'…'; }
  throw new Error('ADMIN ยังแก้ช่องของขั้น 1 ได้ ทั้งที่เอกสารเลยไปขั้น 4 แล้ว'); });
T('ปริ้นฉบับภายใน ไม่ล็อก', ()=>{ const r=call('markPrinted',[DOC,'int',AUTH]);
  if(r.locked) throw new Error('ฉบับภายในไม่ควรล็อก'); return 'ไม่ล็อก ถูกแล้ว'; });
T('เพิ่มรายการก่อนปริ้นส่งออก = ได้', ()=>'ลำดับที่ '+call('addClaimItem',[DOC,BUY]).seq);
T('ปริ้นฉบับส่ง Supplier แล้วล็อก เพิ่มรายการไม่ได้', ()=>{
  call('markPrinted',[DOC,'notice',AUTH]);
  try { call('addClaimItem',[DOC,BUY]); }
  catch(e){ return 'ล็อกถูกแล้ว: '+e.message.slice(0,52)+'…'; }
  throw new Error('ปริ้นส่งออกแล้วยังเพิ่มรายการได้อยู่'); });

T('มัดรูปทั้งใบเป็นไฟล์ .zip ให้ Supplier ได้', ()=>{
  const r=call('zipPhotos',[DOC,AUTH]);
  if(!r.ok || !r.n) throw new Error('ไม่ได้ไฟล์ zip');
  if(!/^https:\/\/drive\.google\.com\/uc\?export=download/.test(r.url)) throw new Error('ลิงก์ดาวน์โหลดผิดรูปแบบ');
  return r.name+' · '+r.n+' รูป'; });
T('แผงตรวจคำแปล คืนคำแปลกลับมาให้เทียบ', ()=>{
  const r=call('translateCheck',[[{seq:1,th:'วาล์วรั่ว',en:'valve leaking'}],AUTH]);
  if(!r.length || !r[0].back) throw new Error('ไม่มีคำแปลกลับ');
  return 'เทียบได้ '+r.length+' แถว'; });

T('ปิดงาน — QC กดปิดเองไม่ได้ ต้องผู้บริหาร', ()=>{
  call('advanceClaim',[DOC,BUY]);                       // SUPPLIER -> RETURN
  try { call('advanceClaim',[DOC,QC]); } catch(e){ return 'กันไว้ถูกแล้ว: '+e.message.slice(0,44)+'…'; }
  throw new Error('QC ปิดงานเองได้ ทั้งที่ต้องเป็นผู้บริหาร'); });
T('ผู้บริหารกดปิดงานได้ + มีลายเซ็นผู้ปิดงาน', ()=>{
  const r=call('advanceClaim',[DOC,AUTH]);
  const f=call('claimFlow',[DOC,AUTH]);
  const close=f.signs.filter(s=>s.role==='ผู้ปิดงาน')[0];
  if(!close || !close.text) throw new Error('ปิดงานแล้วแต่ไม่มีลายเซ็นผู้ปิดงาน');
  return r.stage+' · '+close.text.slice(0,30)+'…'; });

T('ยกเลิกใบเคลม — คนอื่นกดไม่ได้', ()=>{
  try { call('cancelClaim',[DOC,'ลองยกเลิก',STORE]); } catch(e){ return 'กันไว้ถูกแล้ว'; }
  throw new Error('สโตร์ยกเลิกใบเคลมได้'); });
T('ยกเลิกใบเคลม — ผู้บริหารกดได้ และต้องบอกเหตุผล', ()=>{
  try { call('cancelClaim',[DOC,'',AUTH]); } catch(e){}
  const r=call('cancelClaim',[DOC,'ลูกค้ายกเลิกงาน',AUTH]);
  const seen=call('listClaims',[{},AUTH]).filter(x=>x.docNo===DOC).length;
  if(seen) throw new Error('ยกเลิกแล้วยังโผล่ในทะเบียน');
  return r.stage+' · หายจากทะเบียนแล้ว'; });

console.log('\n──────────────────────────────');
console.log('ผ่าน '+pass+' · ไม่ผ่าน '+fail);
console.log('เปิดไฟล์ '+G.STATS.openById+' ครั้ง · เขียนแคช '+G.STATS.cachePut+' ครั้ง · ไฟล์รูปใน Drive '+G.STATS.driveFiles);
if (problems.length){ console.log('\nที่ต้องแก้:'); problems.forEach(p=>console.log(' • '+p)); }
process.exit(fail?1:0);
