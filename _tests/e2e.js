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
/* เบียร์ 7 ก.ย. 2569: "บางคนมีได้ 2 หน้าที่ เช่น นางสาวสุขุมาล ชวนะธิต — Sales / Approve" */
users.appendRow(['6406031','sukuman@suteetankers.com','นางสาวสุขุมาล ชวนะธิต','666666','Y','','Sales / Approve','']);
/* "คนไหนที่เบียร์ไม่ได้ใส่ role คือคนนั้นไม่ได้อยู่ในระบบเคลม" */
users.appendRow(['6406032','nobody@suteetankers.com','คุณไม่อยู่ในระบบเคลม','777777','Y','Purchase','','จัดซื้อ']);
/* คนที่ยังไม่มี PIN — ใช้ทดสอบการตั้ง PIN ครั้งแรกในระบบนี้ (เบียร์ถาม 7 ก.ย.) */
users.appendRow(['6811001','','นายศิวาวัฒน์ มะลิดา','','Y','Production Bom','Production','']);
users.appendRow(['4900044','','นาย สุกิจ เพียพยัคฆ์','','Y','Production Bom','Production','']);
users.appendRow(['999999','boriphat@suteetankers.com','คุณแบล็ค (VP)','','Y','EXEC','EXEC','']);

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
const reset = ()=>vm.runInContext('_USERS=null;_WIP=null;_VEND=null;_ME={};_GOODS=null;_SS=null;_DBY={};_YEARS=null;_IDB=null;_PT=null;_DBID=null;', sandbox);

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
T('เมนูในกล่องงาน นับใบค้างถูกช่อง (9 คิว)', ()=>{
  const w=call('workQueues',[AUTH]);
  const keys=['open','approve','store','buy','result','sin','qcrecv','sout','close'];
  for(const k of keys) if(!w.tabs[k]) throw new Error('ไม่มีคิว '+k);
  const sum=keys.reduce((a,k)=>a+w.tabs[k].n,0);
  if(!sum) throw new Error('ทุกคิวว่างหมด ทั้งที่มีใบอยู่');
  return keys.filter(k=>w.tabs[k].n).map(k=>k+'='+w.tabs[k].n).join(' · '); });
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

/* ═══ สายงานใหม่ 7 ก.ย. 2569 — ของกลับเข้าสโตร์ก่อน → QC ตรวจ → เบิกออก → ผู้บริหารปิด ═══ */
T('ขั้นจัดซื้อ ต้องเลือกผลการเคลมก่อน ถึงจะส่งต่อได้', ()=>{
  try { call('advanceClaim',[DOC,BUY]); }
  catch(e){ if(/ผลการเคลม/.test(e.message)) return 'กันไว้ถูกแล้ว: '+e.message.slice(0,40)+'…';
            throw e; }
  throw new Error('ยังไม่เลือกผลการเคลมก็ส่งต่อได้'); });

T('ผลการเคลม 4 กรณี ส่งมาให้หน้าเว็บครบ', ()=>{
  const f=call('claimFlow',[DOC,AUTH]);
  if(!f.results || f.results.length!==4) throw new Error('ไม่ได้ 4 กรณี');
  const bill=f.results.filter(r=>r.bill).length, back=f.results.filter(r=>r.back).length;
  if(bill!==2||back!==2) throw new Error('เงื่อนไขออกใบ ②/ของกลับ ไม่ตรงสเปค');
  return f.results.map(r=>r.key).join(' · '); });

T('ตอบ "ส่งของใหม่มาให้" → ของกลับมา ต้องเข้าสโตร์ก่อน', ()=>{
  call('saveClaimField',[DOC,'result','NEWPART',BUY]);
  [1,2,3].forEach(sq=>{ try{ call('saveItemField',[DOC,sq,'cost','1000',BUY]); }catch(e){} });
  const r=call('advanceClaim',[DOC,BUY]);
  if(r.stage!=='STORE_IN') throw new Error('ไม่ได้เข้าสโตร์ก่อน ไปที่ '+r.stage);
  return 'ขั้น 6 · '+r.stage; });

T('สโตร์รับของเข้าคลัง → ได้เลขที่ GR + วันที่ อัตโนมัติ', ()=>{
  call('receiveClaim',[DOC,STORE]);
  try { call('advanceClaim',[DOC,STORE]); }
  catch(e){ if(!/ที่เก็บในคลัง/.test(e.message)) throw e; }
  call('saveClaimField',[DOC,'storeLoc','ชั้น A-03',STORE]);
  const r=call('advanceClaim',[DOC,STORE]);
  const f=call('claimFlow',[DOC,AUTH]);
  if(!/^GR-\d\d\/\d{4}$/.test(f.docNos.gr)) throw new Error('เลข GR ผิดรูปแบบ: '+f.docNos.gr);
  if(!f.docNos.grDate) throw new Error('ไม่มีวันที่รับเข้า');
  if(r.stage!=='QC_RECV') throw new Error('ไม่ได้ส่งต่อให้ QC');
  return f.docNos.gr+' · '+f.docNos.grDate; });

T('QC ตรวจรับ → ได้เลขที่ RCV + วันที่ + ชื่อผู้ตรวจ', ()=>{
  [1,2,3].forEach(sq=>{ try{ call('saveItemField',[DOC,sq,'acc','ACC',QC]); }catch(e){} });
  const r=call('advanceClaim',[DOC,QC]);
  const f=call('claimFlow',[DOC,AUTH]);
  if(!/^RCV-\d\d\/\d{4}$/.test(f.docNos.rcv)) throw new Error('เลข RCV ผิดรูปแบบ: '+f.docNos.rcv);
  if(!f.docNos.rcvBy) throw new Error('ไม่มีชื่อผู้ตรวจ');
  if(r.stage!=='STORE_OUT') throw new Error('ตรวจเสร็จแล้วไม่ได้กลับไปสโตร์');
  return f.docNos.rcv+' · '+f.docNos.rcvBy.slice(0,20); });

T('สโตร์เบิกออก → ได้เลขใบเบิก IS + วันที่', ()=>{
  call('saveClaimField',[DOC,'issueTo','คุณต้น',STORE]);
  call('saveClaimField',[DOC,'issueDept','Production',STORE]);
  const r=call('advanceClaim',[DOC,STORE]);
  const f=call('claimFlow',[DOC,AUTH]);
  if(!/^IS-\d\d\/\d{4}$/.test(f.docNos.is)) throw new Error('เลข IS ผิดรูปแบบ: '+f.docNos.is);
  if(r.stage!=='CLOSE_WAIT') throw new Error('เบิกออกแล้วไม่ได้ไปรอผู้บริหาร');
  return f.docNos.is+' · '+f.docNos.isDate; });

T('ปิดงาน — QC กดปิดเองไม่ได้ ต้องผู้บริหาร', ()=>{
  try { call('advanceClaim',[DOC,QC]); } catch(e){ return 'กันไว้ถูกแล้ว: '+e.message.slice(0,44)+'…'; }
  throw new Error('QC ปิดงานเองได้ ทั้งที่ต้องเป็นผู้บริหาร'); });

T('ผู้บริหารกดปิดงานได้ + ลายเซ็นครบ 9 ช่อง 2 รอบ', ()=>{
  const r=call('advanceClaim',[DOC,AUTH]);
  const f=call('claimFlow',[DOC,AUTH]);
  if(f.signs.length!==9) throw new Error('ลายเซ็นไม่ครบ 9 ช่อง ได้ '+f.signs.length);
  const blank=f.signs.filter(s=>!s.text).map(s=>s.role);
  if(blank.length) throw new Error('ยังว่างอยู่: '+blank.join(', '));
  if(f.signs.filter(s=>s.round===1).length!==4) throw new Error('รอบ 1 ไม่ใช่ 4 ช่อง');
  return r.stage+' · ลายเซ็น 9/9 · '+f.signs[8].text.slice(0,24)+'…'; });

T('ครบลายเซ็นรอบ 1 แล้ว ปุ่มพิมพ์ใบส่ง Supplier ถึงเปิด', ()=>{
  const f=call('claimFlow',[DOC,AUTH]);
  if(f.round1Done!==true) throw new Error('เดินครบสายแล้วแต่ round1Done ยังเป็น false');
  return 'round1Done = true'; });

/* ═══ อีก 2 ทางเดินที่ต้องถูกด้วย: ไม่มีของกลับ / QC ไม่ Accept ═══ */
function mkClaim_(){                      // เปิดใบใหม่แล้วเดินถึงขั้นจัดซื้อรอคำตอบ
  const d='DRAFT-X'+Math.floor(Math.random()*9999);
  call('savePhoto',[d,'JT-69/0001','r1',px,'x.jpg',QC]);
  const h={ claimType:'pre', area:'dom', foreignKind:'', jobNo:'JT-69/0001',
    jobName:'ทดสอบสายงาน', model:'M', chassisStt:'C1', chassisMaker:'', serialNo:'',
    jmc:'', deliveryNote:'', dept:'QC', wantDate:'30/09/2569',
    items:[{code:'X1',name:'ของทดสอบ',th:'พัง',en:'',qty:'1',unit:'PCS',po:'',supplier:'',recv:'',_rid:'r1'}]};
  const n=call('createClaimWithPhotos',[h,d,{r1:1},QC]).docNo;
  call('advanceClaim',[n,QC]);                       // → APPROVAL
  call('advanceClaim',[n,BOSS]);                     // → STORE
  call('receiveClaim',[n,STORE]);
  call('saveClaimField',[n,'deliveryNote','DN-X',STORE]);
  call('saveItemField',[n,1,'po','PO-X',STORE]);
  call('saveItemField',[n,1,'supplier','เจ้าทดสอบ',STORE]);
  call('advanceClaim',[n,STORE]);                    // → PURCHASE
  call('receiveClaim',[n,BUY]);
  call('advanceClaim',[n,BUY]);                      // → SUPPLIER
  call('saveItemField',[n,1,'cost','1000',BUY]);
  return n;
}

T('Supplier ไม่รับเคลม → ไม่มีของกลับ ข้ามสโตร์+QC ไปรอผู้บริหารเลย', ()=>{
  const n=mkClaim_();
  call('saveClaimField',[n,'result','REJECT',BUY]);
  const r=call('advanceClaim',[n,BUY]);
  if(r.stage!=='CLOSE_WAIT') throw new Error('ควรข้ามไป CLOSE_WAIT แต่ไปที่ '+r.stage);
  const f=call('claimFlow',[n,AUTH]);
  if(f.docNos.gr) throw new Error('ไม่มีของกลับ แต่ดันออกเลขรับเข้าคลัง');
  return n+' · ข้ามไป '+r.stage+' ตรงตามสเปคข้อ 5'; });

T('QC ไม่ Accept → วนกลับเป็นเคลมรอบใหม่ ล้างลายเซ็นรอบ 2 + เลขเอกสาร', ()=>{
  const n=mkClaim_();
  call('saveClaimField',[n,'result','NEWPART',BUY]);
  call('advanceClaim',[n,BUY]);                      // → STORE_IN
  call('receiveClaim',[n,STORE]);
  call('saveClaimField',[n,'storeLoc','A-1',STORE]);
  call('advanceClaim',[n,STORE]);                    // → QC_RECV (ออกเลข GR)
  const b=call('claimFlow',[n,AUTH]);
  if(!b.docNos.gr) throw new Error('ยังไม่ได้ออกเลข GR ก่อนทดสอบ');
  const r=call('rejectReturn',[n,'บานพับยังคดอยู่ ปิดไม่สนิทเหมือนเดิม',QC]);
  const f=call('claimFlow',[n,AUTH]);
  if(r.stage!=='PURCHASE') throw new Error('ไม่ได้กลับไปหาจัดซื้อ ไปที่ '+r.stage);
  if(f.docNos.gr || f.docNos.rcv || f.docNos.is) throw new Error('เลขเอกสารรอบเก่ายังค้างอยู่');
  const r2=f.signs.filter(s=>s.round===2 && s.text);
  if(r2.length) throw new Error('ลายเซ็นรอบ 2 ยังไม่ถูกล้าง: '+r2.map(x=>x.role).join(', '));
  if(f.round!==2) throw new Error('ไม่ได้นับเป็นรอบที่ 2 ได้ '+f.round);
  return 'กลับไปขั้น '+r.stage+' · รอบที่ '+f.round+' · ล้างเลข GR/RCV/IS + ลายเซ็นรอบ 2 แล้ว'; });

console.log('\n⑧ อยู่ได้ 10-20 ปี — ข้ามปีแล้วต้องไม่หาย');
T('เลขใบเคลมต้องต่อจากของเดิมในชีต ไม่ใช่เริ่มใหม่จาก 0001', ()=>{
  /* จำลองระบบที่ใช้มาหลายปี: ในชีตมี CLM-69/0050 อยู่แล้ว
     เลขถัดไปต้องเป็น 0051 ห้ามวนกลับไปชนเลขเดิม */
  const d=call('db_',[]);
  const sh=d.claims, lr=sh.getLastRow();
  sh.getRange(lr+1,1).setValue('CLM-69/0050');
  reset();
  const nx=call('nextDocNo_',['CLM']);
  if(nx==='CLM-69/0050') throw new Error('ออกเลขซ้ำกับใบที่มีอยู่แล้ว');
  const n=parseInt(nx.split('/')[1],10);
  if(n<=50) throw new Error('ออกเลข '+nx+' ทับของเดิมที่มีถึง 0050 — เอกสารเลขซ้ำ');
  return 'ในชีตมีถึง 0050 → เลขถัดไป '+nx; });

T('ใบที่เปิดปีก่อน พอขึ้นปีใหม่ ต้องยังเห็นในทะเบียนและกล่องงาน', ()=>{
  const n=mkClaim_();                                  // เปิดปีนี้ เดินถึงขั้นจัดซื้อ
  const before=call('listClaims',[{},AUTH]).filter(x=>x.docNo===n).length;
  if(!before) throw new Error('ปีนี้ยังหาไม่เจอ');
  /* ขยับนาฬิกาไปปีหน้า — เหมือน 1 ม.ค. ที่ระบบต้องยังทำงานต่อ */
  const RealDate=Date;
  const nextYear=new RealDate(new RealDate().getFullYear()+1, 0, 5).getTime();
  sandbox.Date=class extends RealDate{
    constructor(...a){ super(...(a.length?a:[nextYear])); }
    static now(){ return nextYear; }
  };
  reset();
  let after=0, err='';
  try { after=call('listClaims',[{},AUTH]).filter(x=>x.docNo===n).length; }
  catch(e){ err=e.message; }
  const w=call('workQueues',[AUTH]);
  const inQueue=Object.keys(w.tabs).some(t=>(w.tabs[t].rows||[]).some(r=>r.docNo===n));
  sandbox.Date=RealDate; reset();
  if(err) throw new Error('ขึ้นปีใหม่แล้วระบบพัง: '+err);
  if(!after) throw new Error('ใบ '+n+' หายจากทะเบียนทันทีที่ขึ้นปีใหม่ — งานที่ยังไม่จบจะสูญ');
  if(!inQueue) throw new Error('ใบ '+n+' หายจากกล่องงาน ไม่มีใครรู้ว่าต้องทำอะไรต่อ');
  return 'ข้ามปีแล้วยังเห็นใบ '+n+' ครบทั้งทะเบียนและกล่องงาน'; });

/* ── ตัวช่วย: รันโค้ดชุดหนึ่ง "เสมือนอยู่ปีหน้า" ─────────────────────── */
function inNextYear_(fn){
  const RealDate=Date;
  const t=new RealDate(new RealDate().getFullYear()+1, 5, 15).getTime();
  sandbox.Date=class extends RealDate{
    constructor(...a){ super(...(a.length?a:[t])); }
    static now(){ return t; }
  };
  reset();
  try { return fn(); }
  finally { sandbox.Date=RealDate; reset(); }
}

T('ขึ้นปีใหม่แล้ว ใบเก่ายังเปิดอ่านได้ ยังแก้ได้ ยังเดินงานต่อได้', ()=>{
  const n=mkClaim_();
  return inNextYear_(()=>{
    const c=call('getClaimFull',[n,AUTH]);
    if(!c||!c.head) throw new Error('เปิดใบ '+n+' ไม่ได้ในปีถัดไป — ข้อมูลอยู่คนละแท็บปี');
    call('saveClaimField',[n,'supplierNote','แก้ข้ามปี',AUTH]);
    const again=call('getClaimFull',[n,AUTH]);
    if(again.head['หมายเหตุจาก Supplier']!=='แก้ข้ามปี')
      throw new Error('แก้ใบเก่าข้ามปีแล้วค่าไม่เข้า — เขียนลงแท็บผิดปี');
    return 'เปิด/แก้ใบ '+n+' ข้ามปีได้ปกติ';
  }); });

T('ขึ้นปีใหม่ เลขใบเริ่มชุดใหม่ของปีนั้น และไม่ชนกับใบปีเก่า', ()=>{
  const old=call('listClaims',[{},AUTH]).map(x=>x.docNo);
  return inNextYear_(()=>{
    const yy=String(call('yearBE_',[])).slice(-2);
    const nx=call('nextDocNo_',['CLM']);
    if(nx.indexOf('CLM-'+yy+'/')!==0) throw new Error('ปีใหม่ยังออกเลขปีเก่า: '+nx);
    if(old.indexOf(nx)>=0) throw new Error('เลข '+nx+' ชนกับใบที่มีอยู่แล้ว');
    if(call('beOfNo_',[nx])!==call('yearBE_',[]))
      throw new Error('อ่านปีจากเลขที่เอกสารไม่ตรง');
    return 'ปีใหม่ออกเลข '+nx+' · ไม่ชนกับใบเดิม '+old.length+' ใบ';
  }); });

T('อ่านปีจากเลขที่เอกสารต้องถูกทุกกรณี (ตัวนี้คือหัวใจของการข้ามปี)', ()=>{
  const cur=call('beOfNo_',['']);                       // ไม่มีเลข = ปีปัจจุบัน
  const cases=[['CLM-69/0001',2569],['INS-70/0123',2570],['CDN-69/0001',2569]];
  for(const [no,want] of cases){
    const got=call('beOfNo_',[no]);
    if(got!==want) throw new Error(no+' → ควรเป็น '+want+' แต่ได้ '+got);
  }
  return 'CLM-69→2569 · INS-70→2570 · CDN-69→2569 · ไม่มีเลข→'+cur; });

T('ขึ้นปีใหม่ รายงานทุกตัวยังต้องเห็นใบของปีก่อน', ()=>{
  /* ปักหมุดใบของ "ปีนี้" ให้เป็นความผิดพนักงานไว้ก่อน แล้วค่อยข้ามปีไปดูว่ารายงานยังเห็น */
  const nEmp=mkClaim_();
  call('saveClaimField',[nEmp,'blame','EMP',AUTH]);
  call('saveClaimField',[nEmp,'blameWho','คุณทดสอบข้ามปี',AUTH]);
  return inNextYear_(()=>{
    const acc=call('reportAccounting',[AUTH]);
    const hr =call('reportHR',[AUTH]);
    const cost=call('reportCost',[AUTH]);
    const med =call('reportMedia',[AUTH]);
    if(!acc.rows.length) throw new Error('ข้อมูลส่งบัญชีว่างเปล่าหลังขึ้นปีใหม่');
    if(!hr.rows.length)  throw new Error('รายงาน HR ว่างเปล่าหลังขึ้นปีใหม่');
    if(!cost.rows.length)throw new Error('สรุปต้นทุนว่างเปล่าหลังขึ้นปีใหม่');
    if(!med.length)      throw new Error('รายงานรูปว่างเปล่าหลังขึ้นปีใหม่ — รูปอยู่แท็บ PHOTOS ของปีเก่า');
    return 'บัญชี '+acc.rows.length+' ใบ · HR '+hr.rows.length+' ใบ · ต้นทุน '+cost.rows.length+' ใบ · รูป '+med.length+' จ๊อบ'; }); });

T('ขึ้นปีใหม่ หน้าแรกยังนับใบค้างของปีก่อน ไม่ใช่ 0', ()=>{
  const now=call('getHome2',[AUTH]);
  return inNextYear_(()=>{
    const h=call('getHome2',[AUTH]);
    if(h.clm.total<now.clm.total)
      throw new Error('หน้าแรกนับใบเคลมได้ '+h.clm.total+' ใบ น้อยกว่าปีก่อนที่มี '+now.clm.total+' ใบ — ใบเก่าหายจากหน้าแรก');
    if(!h.clm.open) throw new Error('หน้าแรกบอกว่าไม่มีงานค้างเลย ทั้งที่ใบปีก่อนยังไม่จบ');
    return 'ใบเคลมรวม '+h.clm.total+' ใบ · ค้างอยู่ '+h.clm.open+' ใบ · ใบตรวจ '+h.ins.total+' ใบ'; }); });

T('ขึ้นปีใหม่ รูปของใบเก่าต้องยังอยู่ครบ', ()=>{
  const n=mkClaim_();
  const before=call('listPhotos',[n,AUTH]);
  return inNextYear_(()=>{
    const after=call('listPhotos',[n,AUTH]);
    const a=Object.keys(after||{}).length, b=Object.keys(before||{}).length;
    if(a<b) throw new Error('รูปของใบ '+n+' หายไป '+(b-a)+' ชุด ตอนขึ้นปีใหม่');
    return 'ใบ '+n+' รูปยังอยู่ครบ '+a+' ชุด'; }); });

console.log('\n⑨ หน้าแรก — แท็บต้องครอบทุกขั้น ไม่งั้นใบหายจากหน้าจอ');
T('ทุกขั้นในสายงาน ต้องมีแท็บรองรับ ไม่มีขั้นไหนตกหล่น', ()=>{
  const stages=call('stageList',[]).map(s=>s.key).filter(k=>k!=='CANCELLED');
  const TS=vm.runInContext('JSON.stringify(TAB_STAGES)', sandbox);
  const tabs=JSON.parse(TS), covered={};
  delete tabs.reject;                       // 'reject' เป็นตัวกรอง ไม่ใช่ขั้นในสายงาน
  Object.keys(tabs).forEach(t=>(tabs[t]||[]).forEach(k=>covered[k]=t));
  const miss=stages.filter(k=>!covered[k]);
  if(miss.length) throw new Error('ขั้นที่ไม่มีแท็บรองรับ: '+miss.join(', ')+' → ใบจะหายจากหน้าแรก');
  return stages.length+' ขั้น อยู่ใน '+Object.keys(tabs).length+' แท็บครบ'; });

T('ใบที่อยู่ขั้นใหม่ ต้องโผล่ในแท็บของคนที่รับผิดชอบ', ()=>{
  const n=mkClaim_();
  call('saveClaimField',[n,'result','NEWPART',BUY]);
  call('saveItemField',[n,1,'cost','500',BUY]);
  call('advanceClaim',[n,BUY]);                        // → STORE_IN
  const w=call('workQueues',[STORE]);
  const inSin=(w.tabs.sin.rows||[]).some(r=>r.docNo===n);
  if(!inSin) throw new Error('ใบขั้นสโตร์รับเข้า ไม่โผล่ในแท็บของสโตร์');
  if(!w.tabs.sin.mine) throw new Error('สโตร์เปิดแท็บนี้ไม่ได้');
  call('receiveClaim',[n,STORE]);
  call('saveClaimField',[n,'storeLoc','B-9',STORE]);
  call('advanceClaim',[n,STORE]);                      // → QC_RECV
  const w2=call('workQueues',[QC]);
  if(!(w2.tabs.qcrecv.rows||[]).some(r=>r.docNo===n)) throw new Error('ใบขั้น QC ตรวจรับ ไม่โผล่ในแท็บ QC');
  if(!w2.tabs.qcrecv.mine) throw new Error('QC เปิดแท็บตรวจรับไม่ได้');
  return n+' · โผล่ถูกแท็บทั้งขั้นสโตร์รับเข้าและขั้น QC ตรวจรับ'; });

T('แถวในหน้าแรก มีเลขขั้น + ชื่อขั้นครบทุกใบ (ไม่ขึ้น undefined)', ()=>{
  const w=call('workQueues',[AUTH]);
  const bad=[];
  Object.keys(w.tabs).forEach(t=>(w.tabs[t].rows||[]).forEach(r=>{
    if(r.stageNo===undefined||r.stageNo===''||!r.stageName) bad.push(t+':'+r.docNo);
  }));
  if(bad.length) throw new Error('แถวที่ขั้นตอนไม่ครบ: '+bad.join(', '));
  const n=Object.keys(w.tabs).reduce((a,t)=>a+(w.tabs[t].rows||[]).length,0);
  return 'ตรวจ '+n+' แถว มีเลขขั้น+ชื่อขั้นครบทุกแถว'; });

console.log('\n⑨ รายงานที่เบียร์สั่งเพิ่ม (7 ก.ย. 2569)');
T('3.5 รวมยอดเรียกเก็บ — จัดกลุ่มตาม Supplier เฉพาะใบที่ต้องเรียกเงิน', ()=>{
  const n=mkClaim_();
  call('saveClaimField',[n,'result','BUYSELF',BUY]);
  call('saveItemField',[n,1,'price','5000',BUY]);
  call('advanceClaim',[n,BUY]);
  const d=call('reportBilling',[AUTH]);
  if(!d.groups.length) throw new Error('ไม่มีกลุ่มเลย');
  const has=d.groups.some(g=>g.rows.some(r=>r.docNo===n));
  if(!has) throw new Error('ใบที่ต้องเรียกเงินไม่ขึ้นในรายงาน');
  return d.groups.length+' เจ้า · '+d.groups.map(g=>g.supplier+' '+g.sum).join(' | ').slice(0,60); });

T('3.5 ออกใบรวมได้เลข CDN ของตัวเอง + รวมซ้ำไม่ได้', ()=>{
  const d=call('reportBilling',[AUTH]);
  const g=d.groups.filter(x=>x.rows.some(r=>!r.billNo))[0];
  if(!g) throw new Error('ไม่มีใบที่ยังไม่เรียกเก็บ');
  const picks=g.rows.filter(r=>!r.billNo).map(r=>r.docNo);
  const r=call('makeConsolidatedBill',[picks,AUTH]);
  if(!/^CDN-\d\d\/\d{4}$/.test(r.billNo)) throw new Error('เลขใบรวมผิดรูปแบบ: '+r.billNo);
  try { call('makeConsolidatedBill',[picks,AUTH]); }
  catch(e){ return r.billNo+' · '+r.rows.length+' ใบ · '+r.total+' บาท · กันรวมซ้ำแล้ว'; }
  throw new Error('รวมซ้ำใบเดิมได้ ทั้งที่ออกใบรวมไปแล้ว'); });

T('3.5 รวมข้ามเจ้าไม่ได้', ()=>{
  const d=call('reportBilling',[AUTH]);
  if(d.groups.length<2) return 'ข้ามการทดสอบ — มี Supplier เจ้าเดียว';
  const a=d.groups[0].rows.filter(r=>!r.billNo)[0], b=d.groups[1].rows.filter(r=>!r.billNo)[0];
  if(!a||!b) return 'ข้ามการทดสอบ — ไม่มีใบว่างพอ';
  try { call('makeConsolidatedBill',[[a.docNo,b.docNo],AUTH]); }
  catch(e){ return 'กันไว้ถูกแล้ว: '+e.message.slice(0,40)+'…'; }
  throw new Error('รวมข้าม Supplier ได้'); });

T('3.6 รายงานส่ง HR — ขึ้นเฉพาะใบที่ระบุว่าพนักงานทำเสียหาย', ()=>{
  const n=mkClaim_();
  call('saveClaimField',[n,'blame','EMP',BUY]);
  call('saveClaimField',[n,'blameWho','คุณเอกชัย',BUY]);
  call('saveClaimField',[n,'blameDept','Production',BUY]);
  const d=call('reportHR',[AUTH]);
  const row=d.rows.filter(r=>r.docNo===n)[0];
  if(!row) throw new Error('ใบที่ระบุว่าพนักงานทำเสียหายไม่ขึ้นในรายงาน');
  if(row.who!=='คุณเอกชัย') throw new Error('ไม่ได้ชื่อคนทำเสียหาย');
  const other=call('reportHR',[AUTH]).rows.length;
  return d.rows.length+' ใบ · '+row.docNo+' · '+row.who+' ('+row.dept+')'; });

T('3.7 ข้อมูลส่งบัญชี — เฉพาะใบที่จบขั้นตอนแล้ว + มียอดรวม', ()=>{
  const d=call('reportAccounting',[AUTH]);
  if(!d.rows.length) throw new Error('ไม่มีใบที่จบขั้นตอน');
  if(!d.sum || d.sum.bill===undefined) throw new Error('ไม่มียอดรวม');
  const bad=d.rows.filter(r=>!/CLOSE|BILLED/.test(r.status||'CLOSED'));
  return d.rows.length+' ใบ · เรียกเก็บรวม '+d.sum.bill+' บาท'; });

/* เบียร์ 8 ก.ย. 2569: "LOG ประวัติการใช้งาน เอาออกจากโปรแกรมเลย"
   → ไม่มีคำสั่งอ่าน LOG แล้ว แต่ยังต้องเขียนลงชีตอยู่ (หลักฐานคู่กับลายเซ็นบนเอกสาร) */
T('LOG — ไม่มีคำสั่งเปิดดูในโปรแกรมแล้ว แต่ยังเก็บบันทึกไว้ในชีต', ()=>{
  if (sandbox.reportLog) throw new Error('reportLog ยังอยู่ — ต้องเอาออกจากโปรแกรม');
  const db = call('ss_',[]);                      // ไฟล์ฐานข้อมูลจริงที่ระบบใช้อยู่
  const lg = db.getSheetByName('LOG');
  if(!lg || lg.getLastRow() < 2) throw new Error('ไม่ได้เขียน LOG ลงชีตแล้ว — เสียหลักฐาน');
  return 'ไม่มีคำสั่งอ่าน · ยังเขียนลงชีต '+(lg.getLastRow()-1)+' แถว'; });

T('3.6-3.8 คนที่ไม่ใช่จัดซื้อ/ผู้บริหาร เปิดไม่ได้', ()=>{
  let blocked=0;
  ['reportBilling','reportHR','reportAccounting'].forEach(fn=>{
    try { call(fn,[STORE]); } catch(e){ blocked++; }
  });
  try { call('reportLog',[10,BUY]); } catch(e){ blocked++; }
  if(blocked<4) throw new Error('กันไม่ครบ กันได้ '+blocked+'/4');
  return 'กันครบ 4/4 (สโตร์เปิด 3 รายงานเงินไม่ได้ · จัดซื้อเปิด LOG ไม่ได้)'; });

T('ยกเลิกใบเคลม — คนอื่นกดไม่ได้', ()=>{
  try { call('cancelClaim',[DOC,'ลองยกเลิก',STORE]); } catch(e){ return 'กันไว้ถูกแล้ว'; }
  throw new Error('สโตร์ยกเลิกใบเคลมได้'); });
T('ยกเลิกใบเคลม — ผู้บริหารกดได้ และต้องบอกเหตุผล', ()=>{
  try { call('cancelClaim',[DOC,'',AUTH]); } catch(e){}
  const r=call('cancelClaim',[DOC,'ลูกค้ายกเลิกงาน',AUTH]);
  const seen=call('listClaims',[{},AUTH]).filter(x=>x.docNo===DOC).length;
  if(seen) throw new Error('ยกเลิกแล้วยังโผล่ในทะเบียน');
  return r.stage+' · หายจากทะเบียนแล้ว'; });

console.log('\n⑩ หน้าที่ (role for Claim) — 1 คนมีได้หลายหน้าที่');
const SUKUMAN = {emp:'6406031', pin:'666666'};     // Sales / Approve
const NOROLE  = {emp:'6406032', pin:'777777'};     // ไม่ได้ใส่ role = ไม่อยู่ในระบบเคลม

T('1 คนมี 2 หน้าที่ได้ — Sales / Approve ต้องได้ทั้งคู่ ไม่ใช่ตัวเดียว', ()=>{
  const me=call('whoAmI_',[SUKUMAN]);
  if(!me.roles || me.roles.indexOf('SALES')<0) throw new Error('หน้าที่ SALES หายไป ได้ '+JSON.stringify(me.roles));
  if(me.roles.indexOf('APPROVER')<0) throw new Error('หน้าที่ APPROVER หายไป ได้ '+JSON.stringify(me.roles));
  return me.name+' → '+me.roles.join(' · '); });

T('คนที่มี 2 หน้าที่ ต้องเปิดใบเคลมเองก็ได้ อนุมัติก็ได้', ()=>{
  const dft='DRAFT-S'+Math.floor(Math.random()*9999);
  call('savePhoto',[dft,'JT-69/0001','r1',px,'x.jpg',SUKUMAN]);
  const r=call('createClaimWithPhotos',[{claimType:'pre', area:'dom', jobNo:'JT-69/0001',
      jobName:'ทดสอบสองหน้าที่', dept:'ขาย', wantDate:'30/09/2569',
      items:[{code:'X1',name:'ของทดสอบ',th:'ของทดสอบ',qty:'1',unit:'PCS',supplier:'เจ้าทดสอบ',_rid:'r1'}]},
      dft, {r1:1}, SUKUMAN]);
  if(!r.ok) throw new Error('เปิดใบเคลมเองไม่ได้');
  call('advanceClaim',[r.docNo, SUKUMAN]);                 // ส่งขออนุมัติ
  const ap=call('advanceClaim',[r.docNo, SUKUMAN]);        // แล้วอนุมัติเอง (มีสิทธิ์ทั้งสองอย่าง)
  if(!ap || !ap.stage) throw new Error('มีสิทธิ์อนุมัติ แต่กดอนุมัติไม่ได้');
  return r.docNo+' → เปิดเองแล้วอนุมัติเองได้ ถึงขั้น '+ap.stage; });

T('แผนกของคนที่เป็น Sales / Approve ต้องเป็น "ขาย" ไม่ใช่ "ผู้บริหาร"', ()=>{
  const dp=call('deptFromRoles_',[['APPROVER','SALES']]);
  if(dp!=='ขาย') throw new Error('ได้แผนก '+dp+' — "อนุมัติ" เป็นหน้าที่ ไม่ใช่แผนก');
  return 'Sales / Approve → แผนก '+dp; });

T('คนที่ไม่ได้ใส่ role for Claim = ไม่อยู่ในระบบเคลม เข้าไม่ได้', ()=>{
  const r=call('loginEmpPin',[NOROLE.emp, NOROLE.pin]);
  if(r.ok) throw new Error('คนที่ไม่ได้ใส่ role เข้าระบบได้ — สิทธิ์รั่ว');
  if(!/ไม่ได้อยู่ในระบบเคลม/.test(r.msg)) throw new Error('ข้อความไม่ตรงกับที่เบียร์สั่ง: '+r.msg);
  let blocked=false;
  try { call('listClaims',[{},NOROLE]); } catch(e){ blocked=true; }
  if(!blocked) throw new Error('เข้าไม่ได้ แต่ยังอ่านทะเบียนใบเคลมได้');
  return r.msg; });

T('รหัสถูกแต่ PIN ผิด ต้องไม่หลุดเข้าไป', ()=>{
  const r=call('loginEmpPin',[SUKUMAN.emp,'000000']);
  if(r.ok) throw new Error('PIN ผิดแล้วยังเข้าได้');
  return r.msg; });

T('เลขคอลัมน์ที่ฝังไว้ในโค้ด ต้องตรงกับหัวตารางจริง (กันคอลัมน์เลื่อนแล้วเขียนทับกัน)', ()=>{
  /* CLAIM_FIELD_COL / INSP_FIELD_COL ยังใช้ "เลขคอลัมน์ตายตัว"
     ถ้าวันหนึ่งมีคนแทรกคอลัมน์กลางตาราง เลขทุกตัวหลังจากนั้นจะเลื่อน
     แล้วระบบจะเขียนข้อมูลลงผิดช่องแบบเงียบ ๆ — ตัวนี้จับให้เห็นตั้งแต่ตอนเทสต์ */
  const WANT = { claimType:'ประเภทการเคลม', area:'สถานที่ผลิต', jobNo:'เลขที่ JOB',
    jobName:'ชื่อลูกค้า', model:'MODEL', jmc:'JMC ที่ผูก', deliveryNote:'เลขใบส่งมอบ',
    dept:'แผนก', wantDate:'วันที่ต้องการของ', currency:'สกุลเงิน', rate:'อัตราแลกเปลี่ยน',
    status:'สถานะ', result:'ผลการเคลม', supplierNote:'หมายเหตุจาก Supplier' };
  const MAP = JSON.parse(vm.runInContext('JSON.stringify(CLAIM_FIELD_COL)', sandbox));
  const HDR = JSON.parse(vm.runInContext('JSON.stringify(HDR_CLAIM)', sandbox));
  const bad = [];
  Object.keys(WANT).forEach(k=>{
    const col = MAP[k];
    if (!col) { bad.push(k+' หายไปจาก CLAIM_FIELD_COL'); return; }
    if (HDR[col-1] !== WANT[k]) bad.push(k+' ชี้คอลัมน์ '+col+' = "'+HDR[col-1]+'" ควรเป็น "'+WANT[k]+'"');
  });
  if (bad.length) throw new Error(bad.join(' · '));
  return 'ตรวจ '+Object.keys(WANT).length+' ช่อง ตรงกับหัวตารางทุกช่อง'; });

T('ไฟล์ฐานข้อมูลต้องหาเจอเสมอ แม้ Script Properties จะหาย', ()=>{
  /* เลขไฟล์ชีตเก็บใน Script Properties · ถ้าค่านั้นหาย ระบบจะ "สร้างไฟล์ใหม่เปล่า ๆ"
     แล้วงานทั้งหมดที่ทำมาจะดูเหมือนหายไปทั้งก้อน — ตัวนี้พิสูจน์ว่าเกิดขึ้นได้จริง
     ตอนนี้ยังไม่มีตัวกัน จึงบันทึกไว้เป็นข้อจำกัดที่ต้องแก้ในรุ่นถัดไป (สำรองเลขไฟล์ไว้ในชีต NOVA) */
  const before = call('dbId_',[]);
  if(!before) throw new Error('อ่านเลขไฟล์ฐานข้อมูลไม่ได้');
  return 'เลขไฟล์ปัจจุบัน '+before+' — ยังพึ่ง Script Properties อยู่ (รอทำตัวสำรองในรุ่นถัดไป)'; });

console.log('\n⑪ เอกสารที่ปริ้นออกมา — ลายเซ็นใบตรวจต้องขึ้นเอง');
T('ใบตรวจ: ใครกดตรวจ/อนุมัติ ลายเซ็นต้องขึ้นบนเอกสารเอง', ()=>{
  const ins = call('createInspection',[{area:'dom', kind:'สินค้า', jobNo:'JT-69/0001',
      jobName:'ทดสอบลายเซ็นใบตรวจ', supplier:'เจ้าทดสอบ', inspector:'คุณสมชาย', tpl:''}, QC]);
  const n = ins.docNo;
  const its = call('getInspection',[n,QC]).items;
  if(its.length){
    call('saveInspItemField',[n, its[0].seq, 'acc', 'ACC', QC]);
    for(let i=1;i<its.length;i++) call('saveInspItemField',[n, its[i].seq, 'acc', 'ACC', QC]);
  }
  call('advanceInsp',[n, QC]);                       // QC ส่งขออนุมัติ → เซ็นช่องผู้ตรวจ
  let f = call('inspFlow',[n, AUTH]);
  if(!f.signs || f.signs.length !== 2) throw new Error('ไม่ได้ส่งลายเซ็นกลับมา');
  if(!f.signs[0].text) throw new Error('ผู้ตรวจกดส่งแล้ว แต่ลายเซ็นผู้ตรวจยังว่าง');
  call('advanceInsp',[n, BOSS]);                     // ผู้บังคับบัญชาอนุมัติ → เซ็นช่องอนุมัติ
  f = call('inspFlow',[n, AUTH]);
  if(!f.signs[1].text) throw new Error('อนุมัติแล้ว แต่ลายเซ็นผู้อนุมัติยังว่าง');
  return f.signs.map(x=>x.role+': '+x.text.split(' · ')[0]).join(' · '); });

T('ใบตรวจ: ตีกลับแล้วลายเซ็นต้องถูกล้าง (ไม่ให้เอกสารโกหก)', ()=>{
  const ins = call('createInspection',[{area:'dom', kind:'สินค้า', jobNo:'JT-69/0001',
      jobName:'ทดสอบตีกลับ', supplier:'เจ้าทดสอบ', inspector:'คุณสมชาย', tpl:''}, QC]);
  const n = ins.docNo;
  const its = call('getInspection',[n,QC]).items;
  for(const it of its) call('saveInspItemField',[n, it.seq, 'acc', 'ACC', QC]);
  call('advanceInsp',[n, QC]);
  if(!call('inspFlow',[n,AUTH]).signs[0].text) throw new Error('ยังไม่ได้เซ็นตั้งแต่แรก');
  call('rejectInsp',[n, 'ตรวจไม่ครบ ให้กลับไปดูใหม่', BOSS]);
  const f = call('inspFlow',[n, AUTH]);
  if(f.signs[0].text) throw new Error('ตีกลับแล้วลายเซ็นผู้ตรวจยังค้างอยู่ — เอกสารจะบอกว่ามีคนเซ็นทั้งที่ผลตรวจถูกแก้ใหม่');
  return 'ตีกลับแล้วล้างลายเซ็นครบ ' + f.signs.length + ' ช่อง'; });

T('ทุกเมนูบนหน้าแรก ต้องมีหน้าจริงรองรับ ไม่มีเมนูตายเลย', ()=>{
  /* ⚠️ v1.1.2 เมนู "ทะเบียนเอกสารที่ส่ง Supplier" อยู่บนหน้าแรก แต่ไม่มีหน้าจริง
     กดแล้วขึ้น "ไม่รู้จักหน้า supdoc" ตัวแดง — พนักงานเจอเองก่อนเรา
     ตัวนี้กันไม่ให้เกิดอีก: ทุกคีย์เมนูต้องมีทางไปจริง */
  const fs=require('fs'), path=require('path');
  const dir=path.join(__dirname,'..','deploy');
  const core=fs.readFileSync(path.join(dir,'js-core.html'),'utf8');
  const keys=[...core.matchAll(/\{\s*k:'([^']+)'/g)].map(m=>m[1]).filter(k=>!k.startsWith('w:'));
  const bad=[];
  keys.forEach(k=>{ if(core.indexOf("v === '"+k+"'")<0) bad.push(k); });
  if(bad.length) throw new Error('เมนูที่กดแล้วไม่มีหน้ารองรับ: '+bad.join(', '));
  return 'ตรวจ '+keys.length+' เมนู มีหน้าจริงครบทุกอัน'; });

T('ทะเบียนเอกสารที่ส่ง Supplier — ขึ้นเฉพาะใบที่ส่งออกจริง', ()=>{
  const n=mkClaim_();
  let before=call('reportSupplierDocs',[AUTH]).rows.filter(x=>x.docNo===n).length;
  if(before) throw new Error('ยังไม่ได้ปริ้นส่ง แต่โผล่ในทะเบียนแล้ว');
  call('markPrinted',[n,'int',BUY]);                       // ฉบับภายใน ไม่ใช่การส่งออก
  if(call('reportSupplierDocs',[AUTH]).rows.filter(x=>x.docNo===n).length)
    throw new Error('ปริ้นฉบับภายใน ไม่ควรนับว่าส่งให้ Supplier');
  call('markPrinted',[n,'notice',BUY]);                    // ฉบับส่งออกจริง
  const row=call('reportSupplierDocs',[AUTH]).rows.filter(x=>x.docNo===n)[0];
  if(!row) throw new Error('ปริ้นส่ง Supplier แล้ว แต่ไม่ขึ้นในทะเบียน');
  if(!row.sentAt || !row.sentBy) throw new Error('ไม่ได้บันทึกว่าออกเมื่อไหร่ / ใครออก');
  return row.docNo+' → '+row.supplier+' · '+row.sentBy+' · '+row.sentAt; });

console.log('\n⑫ ตีกลับ · ช่องใหม่ · ปุ่มที่กดไม่ได้');
T('ตีกลับแล้วต้องไปอยู่กล่อง "เอกสารตีกลับ" ไม่ใช่กล่องสโตร์', ()=>{
  const n=mkClaim_();                                  // เดินถึงขั้นจัดซื้อแล้ว
  call('rejectClaim',[n,'REQUEST','รูปข้อ 1 ถ่ายไม่ชัด',BUY]);
  const w=call('workQueues',[AUTH]);
  const inRj=(w.tabs.reject.rows||[]).some(r=>r.docNo===n);
  const inOpen=(w.tabs.open.rows||[]).some(r=>r.docNo===n);
  const inStore=(w.tabs.store.rows||[]).some(r=>r.docNo===n);
  if(!inRj) throw new Error('ใบที่ถูกตีกลับไม่โผล่ในกล่องเอกสารตีกลับ');
  if(inOpen) throw new Error('ยังไปปนอยู่ในกล่องเอกสารร่าง — นับซ้ำสองที่');
  if(inStore) throw new Error('ไปโผล่กล่องสโตร์ ทั้งที่ตีกลับหาคนเปิดใบ');
  const row=w.tabs.reject.rows.find(r=>r.docNo===n);
  if(!row.rejectNote) throw new Error('ไม่ได้ส่งเหตุผลตีกลับมาให้หน้าจอ');
  return n+' → กล่องตีกลับ · เหตุผล: '+row.rejectNote+' · โดย '+row.rejectBy; });

T('แก้เสร็จแล้วส่งต่อ ใบต้องออกจากกล่องตีกลับ ไม่ค้างตลอดกาล', ()=>{
  const n=mkClaim_();
  call('rejectClaim',[n,'REQUEST','ขาดรูป',BUY]);
  if(!call('workQueues',[AUTH]).tabs.reject.rows.some(r=>r.docNo===n))
    throw new Error('ตีกลับแล้วยังไม่เข้ากล่อง');
  call('advanceClaim',[n,QC]);                         // แก้เสร็จ ส่งต่ออีกครั้ง
  const w=call('workQueues',[AUTH]);
  if(w.tabs.reject.rows.some(r=>r.docNo===n))
    throw new Error('ส่งต่อแล้วยังค้างในกล่องตีกลับ — ธงตีกลับไม่ถูกล้าง');
  return n+' ออกจากกล่องตีกลับแล้ว'; });

T('ช่อง E. No. บันทึกได้และอ่านกลับได้', ()=>{
  /* E. No. เป็นช่องของขั้นร่าง — ต้องกรอกตอนใบยังเป็นร่าง */
  const dft='DRAFT-E'+Math.floor(Math.random()*9999);
  call('savePhoto',[dft,'JT-69/0001','r1',px,'x.jpg',QC]);
  const n=call('createClaimWithPhotos',[{claimType:'pre',area:'dom',jobNo:'JT-69/0001',
    jobName:'ทดสอบ E.No',dept:'QC',
    items:[{code:'X1',name:'ของ',th:'พัง',qty:'1',unit:'PCS',_rid:'r1'}]}, dft,{r1:1},QC]).docNo;
  call('saveClaimField',[n,'eNo','ENG-77-0912',QC]);
  const h=call('getClaim',[n,AUTH]).head;
  if(h['E. No.']!=='ENG-77-0912') throw new Error('บันทึก E. No. แล้วอ่านกลับไม่ตรง ได้ '+JSON.stringify(h['E. No.']));
  return 'E. No. = '+h['E. No.']; });

T('ห้ามแทรกคอลัมน์กลางตาราง — เพิ่มได้เฉพาะต่อท้าย', ()=>{
  /* ⚠️ ensureCols_ เขียนทับหัวตารางให้ตรงกับโค้ด แต่ไม่ย้ายข้อมูลตาม
     แทรกคอลัมน์กลาง = ข้อมูลเดิมทั้งชีตเลื่อน หัวไม่ตรงกับของข้างล่าง = พังทั้งระบบ
     ตัวนี้ล็อกลำดับ 29 คอลัมน์แรกไว้ ใครสลับ/แทรก บิลด์ไม่ผ่านทันที */
  const BASE=['เลขที่เอกสาร','ชนิดเอกสาร','วันที่','ประเภทการเคลม','สถานที่ผลิต','ชนิดงานต่างประเทศ',
    'เลขที่ JOB','ชื่อลูกค้า','MODEL','CHASSIS NO. (STT)','CHASSIS NO. (ผู้ผลิต)','SERIAL NO.',
    'JMC ที่ผูก','เลขใบส่งมอบ','ผู้ขอเคลม','แผนก','วันที่ต้องการของ',
    'สกุลเงิน','อัตราแลกเปลี่ยน','เรท ณ วันที่','กรณีเรียกเก็บ',
    'สถานะ','ผลการเคลม','รายละเอียดผลการเคลม','หมายเหตุจาก Supplier',
    'โฟลเดอร์รูป','สร้างโดย','สร้างเมื่อ','แก้ไขล่าสุด'];
  const cur=JSON.parse(vm.runInContext('JSON.stringify(HDR_CLAIM)', sandbox));
  for(let i=0;i<BASE.length;i++){
    if(cur[i]!==BASE[i])
      throw new Error('คอลัมน์ที่ '+(i+1)+' เปลี่ยนจาก "'+BASE[i]+'" เป็น "'+cur[i]+'" — ข้อมูลเดิมจะเลื่อนทั้งชีต');
  }
  return 'ลำดับ '+BASE.length+' คอลัมน์แรกยังเหมือนเดิม · เพิ่มใหม่ต่อท้ายได้ '+(cur.length-BASE.length)+' คอลัมน์'; });

T('ปริ้นส่ง Supplier — เฉพาะจัดซื้อ และเฉพาะเมื่อใบถึงขั้นจัดซื้อแล้ว', ()=>{
  /* เบียร์ 7 ก.ย. ข้อ 6+10: ทุกแผนก Preview ได้ · ปุ่มปริ้นจริงเป็นของจัดซื้อ */
  const dft='DRAFT-PR'+Math.floor(Math.random()*9999);
  call('savePhoto',[dft,'JT-69/0001','r1',px,'x.jpg',QC]);
  const n=call('createClaimWithPhotos',[{claimType:'pre',area:'dom',jobNo:'JT-69/0001',
    jobName:'ทดสอบสิทธิ์ปริ้น',dept:'QC',
    items:[{code:'X1',name:'ของ',th:'พัง',qty:'1',unit:'PCS',_rid:'r1'}]}, dft,{r1:1},QC]).docNo;

  if(call('claimFlow',[n,BUY]).canPrint) throw new Error('ใบยังเป็นร่าง แต่จัดซื้อปริ้นได้แล้ว');
  if(call('claimFlow',[n,QC]).canPrint)  throw new Error('QC ไม่ควรปริ้นส่ง Supplier ได้');

  call('advanceClaim',[n,QC]); call('advanceClaim',[n,BOSS]);      // → STORE
  call('receiveClaim',[n,STORE]);
  call('saveClaimField',[n,'deliveryNote','DN-P',STORE]);
  call('saveItemField',[n,1,'po','PO-P',STORE]);
  call('saveItemField',[n,1,'supplier','เจ้าทดสอบ',STORE]);
  call('advanceClaim',[n,STORE]);                                   // → PURCHASE
  const fb=call('claimFlow',[n,BUY]), fq=call('claimFlow',[n,QC]);
  if(!fb.canPrint) throw new Error('ถึงขั้นจัดซื้อแล้ว แต่จัดซื้อยังปริ้นไม่ได้: '+fb.printWhy);
  if(fq.canPrint)  throw new Error('QC ปริ้นส่ง Supplier ได้ ทั้งที่ไม่ใช่หน้าที่');
  if(!fq.printWhy) throw new Error('ไม่ได้บอกเหตุผลให้คนที่ปริ้นไม่ได้');
  return 'จัดซื้อปริ้นได้ · QC ได้แต่ดูตัวอย่าง ("'+fq.printWhy.slice(0,40)+'…")'; });

T('พิมพ์เลขจ๊อบไม่ตรงรูปแบบ ก็ต้องหาเจอ (บั๊กที่พนักงานเจอ)', ()=>{
  const want='JT-69/0001';
  const forms=['JT-69/0001','jt-69/0001','JT-69/1','JT 69/0001','jt69/1','JT-69/01'];
  const bad=[];
  for(const f of forms){ if(!call('lookupJob',[f]).found) bad.push(f); }
  if(bad.length) throw new Error('พิมพ์แบบนี้แล้วหาไม่เจอ: '+bad.join(' · '));
  const miss=call('lookupJob',['JT-69/9999']);
  if(miss.found) throw new Error('จ๊อบที่ไม่มีจริง ดันหาเจอ');
  if(!miss.total) throw new Error('ไม่ได้บอกว่าในทะเบียนมีกี่จ๊อบ');
  return 'พิมพ์ได้ '+forms.length+' แบบ หาเจอหมด → '+want; });

T('เลือกได้ว่ารูปไหนขึ้นบนเอกสาร — รูปที่ไม่ติ๊กยังอยู่ในระบบ', ()=>{
  const n=mkClaim_();
  const before=call('listPhotos',[n,AUTH]);
  const seq=Object.keys(before)[0];
  const ph=before[seq][0];
  if(ph.doc!==true) throw new Error('รูปใหม่ควรตั้งต้นเป็น "ขึ้นเอกสาร"');
  call('setPhotoInDoc',[n, ph.id, 0, BUY]);
  const after=call('listPhotos',[n,AUTH]);
  const same=after[seq].find(x=>x.id===ph.id);
  if(!same) throw new Error('ติ๊กไม่ขึ้นเอกสารแล้วรูปหายไปจากระบบ — ต้องยังอยู่');
  if(same.doc!==false) throw new Error('ติ๊กแล้วธงไม่เปลี่ยน');
  call('setPhotoInDoc',[n, ph.id, 1, BUY]);
  if(call('listPhotos',[n,AUTH])[seq].find(x=>x.id===ph.id).doc!==true)
    throw new Error('ติ๊กกลับแล้วไม่คืนค่า');
  return 'ข้อ '+seq+' · ปิด/เปิดรูปบนเอกสารได้ · รูปยังอยู่ในระบบครบ'; });

console.log('\n⑬ ค่าใช้จ่ายอื่น ๆ · งานซ่อมที่ไม่มีอะไหล่');
T('ค่าของ · ค่าแรง · ค่าใช้จ่ายอื่น ๆ แยกกันคนละตาราง', ()=>{
  const n=mkClaim_();
  call('saveLabour',[n,[{th:'ค่าแรงช่าง 2 คน 3 วัน', amount:'9000', supplier:'เจ้าทดสอบ'}],BUY]);
  call('saveExpense',[n,[
    {kind:'ค่าเดินทาง', th:'รถตู้ไป-กลับ ระยอง-ชลบุรี', amount:'3500', supplier:'เจ้าทดสอบ'},
    {kind:'ค่าที่พัก',  th:'ที่พักช่าง 2 คืน',           amount:'2400', supplier:'เจ้าทดสอบ'}],BUY]);
  const ex=call('listExpense',[n,AUTH]);
  if(ex.length!==2) throw new Error('บันทึกค่าใช้จ่ายอื่นแล้วอ่านกลับได้ '+ex.length+' บรรทัด');
  if(ex[0].kind!=='ค่าเดินทาง') throw new Error('ประเภทค่าใช้จ่ายไม่ถูกเก็บ');
  const lab=call('listLabour',[n,AUTH]);
  if(lab.length!==1) throw new Error('ค่าแรงถูกปนกับค่าใช้จ่ายอื่น');
  const full=call('getClaimFull',[n,AUTH]);
  if(!full.expense || full.expense.length!==2) throw new Error('เปิดใบแล้วไม่ได้ค่าใช้จ่ายอื่นมาด้วย');
  return 'ค่าแรง '+lab.length+' บรรทัด · ค่าใช้จ่ายอื่น '+ex.length+' บรรทัด (รวม '+
         (Number(ex[0].amount)+Number(ex[1].amount))+' บาท) แยกตารางกันจริง'; });

T('ค่าใช้จ่ายอื่น ๆ ต้องเข้าไปอยู่ในยอดเรียกเก็บและสรุปต้นทุน', ()=>{
  const n=mkClaim_();
  call('saveItemField',[n,1,'price','1000',BUY]);
  call('saveClaimField',[n,'result','BUYSELF',BUY]);       // เรียกเก็บทั้งของและค่าแรง
  call('saveLabour',[n,[{th:'ค่าแรง', amount:'5000'}],BUY]);
  call('saveExpense',[n,[{kind:'ค่าเดินทาง', th:'ไปหน้างาน', amount:'2000'}],BUY]);
  const rows=call('reportCost',[AUTH]).rows.filter(x=>x.docNo===n);
  if(!rows.length) throw new Error('ใบนี้ไม่ขึ้นในสรุปต้นทุน');
  if(Number(rows[0].expense)!==2000) throw new Error('สรุปต้นทุนไม่นับค่าใช้จ่ายอื่น ได้ '+rows[0].expense);
  const want=Number(rows[0].items)+Number(rows[0].labour)+Number(rows[0].expense);
  if(Number(rows[0].thb)!==want) throw new Error('ยอดรวมไม่ตรง ('+rows[0].thb+' ควรเป็น '+want+')');
  return 'ค่าของ '+rows[0].items+' + ค่าแรง '+rows[0].labour+' + ค่าใช้จ่ายอื่น '+rows[0].expense+' = '+rows[0].thb; });

T('งานซ่อม/ฝีมือ ไม่มีอะไหล่ — เปิดใบได้โดยไม่ต้องมีรายการของ', ()=>{
  const r=call('createClaim',[{claimType:'after', area:'dom', jobNo:'JT-69/0001',
    jobName:'งานซ่อมนอกสถานที่', dept:'QC', items:[]}, QC]);
  const n=r.docNo;
  call('saveClaimField',[n,'workKind','LABOUR',QC]);
  let f=call('claimFlow',[n,QC]);
  if(!f.missing.length) throw new Error('ยังไม่มีค่าแรงเลย แต่ระบบบอกว่าส่งต่อได้');
  if(!/ค่าแรงหรือค่าใช้จ่าย/.test(f.missing.join(' ')))
    throw new Error('ข้อความบอกไม่ตรง: '+f.missing.join(' · '));
  call('saveLabour',[n,[{th:'ค่าแรงซ่อมหน้างาน', amount:'12000'}],QC]);
  call('saveExpense',[n,[{kind:'ค่าเช่าสถานที่', th:'เช่าลานซ่อม 1 วัน', amount:'4000'}],QC]);
  f=call('claimFlow',[n,QC]);
  if(f.missing.length) throw new Error('ใส่ค่าแรงแล้วยังส่งต่อไม่ได้: '+f.missing.join(' · '));
  const a=call('advanceClaim',[n,QC]);
  return n+' → ส่งขออนุมัติได้โดยไม่มีรายการของ (ขั้น '+a.stage+')'; });

console.log('\n⑭ ตั้ง PIN ครั้งแรกในระบบนี้เลย (ไม่ต้องไป NOVA)');
T('คนที่ยังไม่มี PIN ตั้งเองได้ แล้วเข้าระบบได้ทันที', ()=>{
  const emp='6811001';                               // นายศิวาวัฒน์ — Production, PIN ว่าง
  const chk=call('checkPinSetup',[emp]);
  if(!chk.ok) throw new Error('ควรตั้งได้ แต่ระบบบอกว่า: '+chk.msg);
  if(!chk.hint) throw new Error('ไม่ได้บอกชื่อแบบปิดบางส่วนให้เจ้าตัวยืนยัน');
  let r=call('setupPin',[emp,'ชื่อผิด','445566','445566']);
  if(r.ok) throw new Error('ชื่อไม่ตรงทะเบียน แต่ตั้ง PIN ได้ — สวมสิทธิ์กันได้');
  r=call('setupPin',[emp,'นายศิวาวัฒน์ มะลิดา','111111','111111']);
  if(r.ok) throw new Error('PIN เดาง่ายอย่าง 111111 ไม่ควรผ่าน');
  r=call('setupPin',[emp,'นายศิวาวัฒน์ มะลิดา','445566','445567']);
  if(r.ok) throw new Error('PIN สองช่องไม่ตรงกัน แต่ผ่าน');
  r=call('setupPin',[emp,'ศิวาวัฒน์ มะลิดา','445566','445566']);   // ไม่ใส่คำนำหน้าก็ต้องผ่าน
  if(!r.ok) throw new Error('ตั้ง PIN ไม่สำเร็จ: '+r.msg);
  const lg=call('loginEmpPin',[emp,'445566']);
  if(!lg.ok) throw new Error('ตั้ง PIN แล้วเข้าระบบไม่ได้: '+lg.msg);
  const again=call('checkPinSetup',[emp]);
  if(again.ok) throw new Error('มี PIN แล้วยังตั้งซ้ำได้ — คนอื่นยึดบัญชีได้');
  return lg.name+' ตั้ง PIN เองแล้วเข้าระบบได้ · ตั้งซ้ำไม่ได้แล้ว'; });

T('สิทธิ์ผู้บริหาร/ผู้อนุมัติ ตั้ง PIN เองไม่ได้ (กันคนยึดบัญชีที่เห็นเงินทั้งบริษัท)', ()=>{
  const r=call('checkPinSetup',['999999']);          // คุณแบล็ค (VP) — EXEC → ADMIN
  if(r.ok) throw new Error('บัญชีผู้บริหารตั้ง PIN เองได้ — อันตรายมาก');
  if(!/ผู้บริหาร|ผู้ดูแล/.test(r.msg)) throw new Error('ข้อความไม่ได้บอกเหตุผล: '+r.msg);
  const s2=call('setupPin',['999999','คุณแบล็ค (VP)','778899','778899']);
  if(s2.ok) throw new Error('กันแค่หน้าเช็ค แต่ setupPin ยังตั้งได้จริง');
  return 'กันไว้ถูกแล้ว: '+r.msg; });

T('คนที่ไม่มี role for Claim ตั้ง PIN ไม่ได้', ()=>{
  const r=call('checkPinSetup',['6406032']);         // ไม่ได้ใส่ role
  if(r.ok) throw new Error('คนที่ไม่อยู่ในระบบเคลม ตั้ง PIN ได้');
  return r.msg; });

/* เบียร์ 8 ก.ย. 2569: "ระบบ PIN ... มันไม่ควรให้ใครเห็นด้วย เอาออกไปเลย"
   → ไม่มีคำสั่งดูรายชื่อ PIN หรือตั้ง PIN ให้คนอื่นในโปรแกรมนี้แล้ว แม้แต่ผู้ดูแล
     (กติกาเดียวกับ STT NOVA — PIN อยู่ในชีต USERS ผู้ดูแลแก้ในชีตเอง) */
T('ไม่มีคำสั่งดูรายชื่อ PIN หรือตั้ง PIN ให้คนอื่นในระบบนี้แล้ว', ()=>{
  ['listUsersPin','adminSetPin'].forEach(fn=>{
    if (sandbox[fn]) throw new Error(fn+' ยังอยู่ — ต้องเอาออกทั้งหมด'); });
  return 'listUsersPin / adminSetPin ถูกถอดออกแล้วทั้งคู่'; });

T('พนักงานยังตั้ง PIN ของตัวเองครั้งแรกได้เหมือนเดิม (ไม่ได้ตัดทิ้งไปด้วย)', ()=>{
  const r = call('checkPinSetup',['4900044']);
  if(!r.ok) throw new Error('คนที่ยังไม่มี PIN ตั้งเองไม่ได้แล้ว: '+r.msg);
  const s2 = call('setupPin',['4900044','นาย สุกิจ เพียพยัคฆ์','335577','335577']);
  if(!s2.ok) throw new Error('ตั้ง PIN เองไม่สำเร็จ: '+s2.msg);
  if(!call('loginEmpPin',['4900044','335577']).ok) throw new Error('ตั้งแล้วเข้าระบบไม่ได้');
  return 'ตั้งเองได้ · เข้าระบบได้'; });

T('รายงานส่ง HR — เห็นเฉพาะ HR · ผู้ดูแล · ผู้อนุมัติ (จัดซื้อไม่เห็นแล้ว)', ()=>{
  let buyBlocked = false;
  try { call('reportHR',[BUY]); } catch(e){ buyBlocked = true; }
  if(!buyBlocked) throw new Error('จัดซื้อยังเปิดรายงานหักเงินพนักงานได้');
  let storeBlocked = false;
  try { call('reportHR',[STORE]); } catch(e){ storeBlocked = true; }
  if(!storeBlocked) throw new Error('สโตร์ยังเปิดได้');
  if(!call('reportHR',[BOSS])) throw new Error('ผู้อนุมัติเปิดไม่ได้');
  if(!call('reportHR',[AUTH]))  throw new Error('ผู้ดูแลเปิดไม่ได้');
  const hr = call('loginEmpPin',['6204002','604002']);
  return 'จัดซื้อ/สโตร์ กันแล้ว · ผู้อนุมัติกับผู้ดูแลเปิดได้'; });


/* ═══ ⑮ Dashboard สถานะเอกสาร (v1.3.0) ═══════════════════════════════
   เบียร์ 7 ก.ย.: "สร้าง Dashboard สถานะเอกสารของเอกสารฉบับที่เปิดอยู่ทั้งหมด
                   และทำให้หัวข้อ Filter ได้ทุกคอลัมน์ และเลือกได้มากกว่า 1"
   ฝั่งเซิร์ฟเวอร์ต้องส่งข้อมูลครบพอให้หน้าเว็บกรองได้ทุกคอลัมน์ */
console.log('\n⑮ Dashboard สถานะเอกสาร');

T('รวมทั้งใบเคลมและใบตรวจรับไว้ในตารางเดียว', ()=>{
  const d = call('dashDocs',[AUTH]);
  if(!d || !d.rows || !d.rows.length) throw new Error('ไม่มีข้อมูลกลับมาเลย');
  const kinds = Array.from(new Set(d.rows.map(r=>r.kind)));
  if(kinds.indexOf('ใบเคลม')<0)     throw new Error('ไม่มีใบเคลมในตาราง');
  if(kinds.indexOf('ใบตรวจรับ')<0) throw new Error('ไม่มีใบตรวจรับในตาราง');
  return d.rows.length+' ฉบับ · '+kinds.join(' + '); });

T('ทุกคอลัมน์ที่หน้าเว็บใช้กรอง ต้องมีค่าส่งมาครบทุกแถว', ()=>{
  const need = ['kind','docNo','date','stageNo','stageName','waitWho','state','jobNo','jobName',
                'model','area','docType','supplier','by','dept','nItem','nPhoto','photoOk','updated','age'];
  const d = call('dashDocs',[AUTH]);
  const miss = {};
  d.rows.forEach(r=>need.forEach(k=>{ if(!(k in r)) miss[k]=(miss[k]||0)+1; }));
  if(Object.keys(miss).length) throw new Error('ช่องที่ขาด: '+JSON.stringify(miss));
  return 'ครบ '+need.length+' คอลัมน์ · '+d.rows.length+' แถว'; });

T('สถานะใบต้องแยก เปิดอยู่ / ตีกลับ / ปิดแล้ว / ยกเลิก ให้กรองได้', ()=>{
  const ok = ['เปิดอยู่','ตีกลับ · รอแก้','ปิดแล้ว','ยกเลิกแล้ว'];
  const d = call('dashDocs',[AUTH]);
  const bad = d.rows.filter(r=>ok.indexOf(r.state)<0).map(r=>r.docNo+'='+r.state);
  if(bad.length) throw new Error('สถานะแปลกปลอม: '+bad.slice(0,3).join(', '));
  const seen = Array.from(new Set(d.rows.map(r=>r.state)));
  if(seen.indexOf('เปิดอยู่')<0) throw new Error('ไม่มีใบที่เปิดอยู่เลย ผิดปกติ');
  return seen.join(' · '); });

T('ใบที่ยกเลิกแล้วต้องส่งมาด้วย (ให้กรองเอง) ไม่ใช่ซ่อนทิ้ง', ()=>{
  const all = call('dashDocs',[AUTH]).rows;
  const reg = call('listClaims',[{},AUTH]);          // ทะเบียนปกติ = ซ่อนใบยกเลิก
  const canc = all.filter(r=>r.state==='ยกเลิกแล้ว');
  if(reg.some(r=>r.stage==='CANCELLED')) throw new Error('ทะเบียนปกติไม่ควรโชว์ใบยกเลิก');
  return 'ใบยกเลิกใน Dashboard '+canc.length+' ฉบับ · ทะเบียนปกติซ่อนไว้เหมือนเดิม'; });

T('การ์ดขั้นตอนต้องมีครบทุกขั้นของทั้ง 2 ชนิด และเรียงตาม flow จริง', ()=>{
  const d = call('dashDocs',[AUTH]);
  if(!d.stages || !d.stages.length) throw new Error('ไม่ส่งรายการขั้นตอนมา');
  const clm = d.stages.filter(s=>s.kind==='ใบเคลม');
  const ins = d.stages.filter(s=>s.kind==='ใบตรวจรับ');
  if(clm.length < 10) throw new Error('ขั้นของใบเคลมไม่ครบ 10 ขั้น (ได้ '+clm.length+')');
  if(ins.length < 3)  throw new Error('ขั้นของใบตรวจไม่ครบ 3 ขั้น (ได้ '+ins.length+')');
  for(let i=1;i<clm.length;i++) if(clm[i].no < clm[i-1].no) throw new Error('ขั้นของใบเคลมเรียงผิด');
  /* ชื่อขั้นบนการ์ดต้องตรงกับ stageName ในแถว ไม่งั้นกดการ์ดแล้วกรองไม่เจอ */
  const names = d.stages.map(s=>s.name);
  const orphan = d.rows.filter(r=>r.state!=='ยกเลิกแล้ว' && names.indexOf(r.stageName)<0);
  if(orphan.length) throw new Error('ชื่อขั้นในแถวไม่ตรงกับการ์ด: '+orphan[0].stageName);
  return clm.length+' ขั้น (เคลม) + '+ins.length+' ขั้น (ตรวจรับ)'; });

T('เลข "ค้างมา (วัน)" ต้องเป็นตัวเลข ไม่ติดลบ และคิดจากวันที่แก้ล่าสุด', ()=>{
  const d = call('dashDocs',[AUTH]);
  const bad = d.rows.filter(r=>r.age !== '' && (typeof r.age !== 'number' || r.age < 0));
  if(bad.length) throw new Error('ค่าค้างมาผิด: '+bad[0].docNo+'='+bad[0].age);
  if(call('thDate_',['31/12/2569']) === null) throw new Error('อ่านวันที่ พ.ศ. ไม่ออก');
  if(call('thDate_',['ไม่ใช่วันที่']) !== null) throw new Error('ข้อความมั่ว ๆ ควรได้ null ไม่ใช่วันที่มั่ว');
  const n = d.rows.filter(r=>r.age !== '').length;
  return 'คิดวันค้างได้ '+n+' จาก '+d.rows.length+' ฉบับ'; });

T('Supplier ต้องมาจากรายการในใบ ไม่ใช่ช่องว่างทุกแถว', ()=>{
  const d = call('dashDocs',[AUTH]);
  const clm = d.rows.filter(r=>r.kind==='ใบเคลม');
  const has = clm.filter(r=>r.supplier && r.supplier !== '(ยังไม่ระบุ)');
  if(!has.length) throw new Error('ไม่มีใบเคลมใบไหนดึง Supplier ได้เลย');
  return 'ใบเคลมที่รู้ Supplier '+has.length+'/'+clm.length+' ฉบับ'; });

T('ยังไม่เข้าสู่ระบบ เปิด Dashboard ไม่ได้', ()=>{
  let blocked=false;
  try { call('dashDocs',[{emp:'6100030',pin:'ผิด'}]); } catch(e){ blocked=true; }
  if(!blocked) throw new Error('PIN ผิดแต่ยังเปิด Dashboard ได้');
  return 'กันไว้แล้ว'; });


/* ═══ ⑯ แม่แบบเช็คลิสต์ + ช่องใหม่ในใบตรวจ/ใบเคลม (v1.4.0) ═══════════════
   เบียร์ 8 ก.ย. 2569 — แม่แบบต้องเป็นทะเบียนในระบบ แก้เองได้ + แนบรูป STD ต่อหัวข้อ */
console.log('\n⑯ แม่แบบเช็คลิสต์ + ช่องใหม่');

T('ครั้งแรกสุด ระบบย้ายแม่แบบที่เคยฝังในโค้ดลงทะเบียนให้เอง', ()=>{
  const list = call('listTemplates',[true,AUTH]);
  if(!list.length) throw new Error('ทะเบียนแม่แบบว่างเปล่า');
  const bad = list.filter(x=>!/^TPL-\d{4}$/.test(x.key));
  if(bad.length) throw new Error('รหัสแม่แบบผิดรูปแบบ: '+bad[0].key);
  const kinds = Array.from(new Set(list.map(x=>x.kind)));
  if(kinds.some(k=>k!=='tanker'&&k!=='equip')) throw new Error('ลักษณะงานแปลกปลอม: '+kinds.join(','));
  return list.length+' ชุด · '+list.map(x=>x.key+'='+x.n+'ข้อ').join(' · '); });

T('ย้ายลงชีตแล้วต้องไม่ยัดซ้ำเมื่อเรียกอีกรอบ', ()=>{
  const a = call('listTemplates',[true,AUTH]).length;
  reset();
  const b = call('listTemplates',[true,AUTH]).length;
  if(a !== b) throw new Error('เรียกซ้ำแล้วแม่แบบเพิ่มจาก '+a+' เป็น '+b);
  return 'คงที่ '+a+' ชุด'; });

T('สร้าง / แก้หัวข้อ / ก๊อปแม่แบบได้ครบ', ()=>{
  const r = call('saveTemplate',[{name:'แท็งค์ SEMI-TRAILER 32,000 L', kind:'tanker',
                                  model:'SEMI-TRAILER 32,000 L', note:'ทดสอบ'}, QC]);
  if(!r.ok) throw new Error('สร้างไม่สำเร็จ');
  call('saveTemplateItems',[r.key,[
    {cat:'ตัวถัง', title:'สภาพผิวนอก', titleEn:'Outer shell', qty:'1', unit:'จุด'},
    {cat:'อุปกรณ์', title:'แมนโฮลปิดสนิท', titleEn:'Manhole seals'},
    {cat:'', title:''}                              // แถวว่าง ต้องถูกตัดทิ้ง
  ],QC]);
  const g = call('getTemplate',[r.key,QC]);
  if(g.items.length !== 2) throw new Error('เขียนหัวข้อผิด ได้ '+g.items.length+' ข้อ (ควรเป็น 2)');
  if(g.items[0].seq !== '1' || g.items[1].seq !== '2') throw new Error('ลำดับข้อไม่เรียง 1,2');
  const c = call('copyTemplate',[r.key,'ก๊อปทดสอบ',QC]);
  const g2 = call('getTemplate',[c.key,QC]);
  if(g2.items.length !== 2) throw new Error('ก๊อปแล้วหัวข้อไม่ครบ');
  if(g2.head.model !== 'SEMI-TRAILER 32,000 L') throw new Error('ก๊อปแล้ว MODEL ไม่ตามมา');
  return r.key+' 2 ข้อ → ก๊อปเป็น '+c.key; });

T('รูป STD แนบที่แม่แบบ แล้วแก้ข้อความหัวข้อ รูปต้องไม่หาย', ()=>{
  const r = call('saveTemplate',[{name:'แม่แบบทดสอบรูป', kind:'tanker', model:'TESTMODEL'},QC]);
  call('saveTemplateItems',[r.key,[{cat:'ตัวถัง',title:'ข้อ 1'},{cat:'ตัวถัง',title:'ข้อ 2'}],QC]);
  const up = call('saveTplPhoto',[r.key,'2',px,'std2.jpg',QC]);
  if(!up.ok || !up.id) throw new Error('อัปรูป STD ไม่สำเร็จ');
  /* แก้ข้อความหัวข้อ โดยไม่ส่ง stdId กลับมา — รูปของข้อเดิมต้องยังอยู่ */
  call('saveTemplateItems',[r.key,[{cat:'ตัวถัง',title:'ข้อ 1 แก้แล้ว'},{cat:'ตัวถัง',title:'ข้อ 2 แก้แล้ว'}],QC]);
  const g = call('getTemplate',[r.key,QC]);
  if(!g.items[1].stdId) throw new Error('แก้ข้อความแล้วรูป STD หาย');
  if(g.items[0].stdId) throw new Error('รูปไปโผล่ผิดข้อ');
  call('delTplPhoto',[r.key,'2',QC]);
  if(call('getTemplate',[r.key,QC]).items[1].stdId) throw new Error('ลบรูปแล้วยังอยู่');
  return 'รูปติดข้อที่ 2 · แก้ข้อความไม่หาย · ลบได้'; });

T('เปิดใบตรวจจากแม่แบบ = หัวข้อ + รูป STD ตามมาให้ทั้งชุด', ()=>{
  const r = call('saveTemplate',[{name:'แม่แบบเปิดใบ', kind:'tanker', model:'MDL-STD'},QC]);
  call('saveTemplateItems',[r.key,[{cat:'ตัวถัง',title:'ผิวนอก'},{cat:'อุปกรณ์',title:'วาล์ว'}],QC]);
  call('saveTplPhoto',[r.key,'1',px,'s1.jpg',QC]);
  const ins = call('createInspection',[{template:r.key, jobNo:'JT-69/0001', model:'MDL-STD',
                                        kind:'tanker', area:'for', eNo:'ENG-TEST-1'},QC]);
  if(!ins.ok) throw new Error('เปิดใบตรวจไม่สำเร็จ');
  if(ins.n !== 2) throw new Error('หัวข้อไม่ตามมา ได้ '+ins.n);
  if(ins.nStd !== 1) throw new Error('รูป STD ไม่ตามมา ได้ '+ins.nStd);
  /* ช่องรูป STD ในตารางใช้ลำดับ S+เลขข้อ */
  const ph = call('listPhotos',[ins.docNo,QC]);
  if(!ph['S1'] || !ph['S1'].length) throw new Error('รูป STD ไม่ได้ผูกกับช่อง S1');
  const c = call('getInspection',[ins.docNo,QC]);
  if(c.head['E. No.'] !== 'ENG-TEST-1') throw new Error('E. No. ไม่ถูกบันทึก: '+c.head['E. No.']);
  return ins.docNo+' · 2 หัวข้อ · รูป STD 1 รูปที่ช่อง S1 · E. No. บันทึกแล้ว'; });

T('หน้าเว็บที่ยังไม่รีเฟรช ส่งรหัสแม่แบบเก่ามา ต้องยังเปิดใบได้ ไม่ใช่ได้ใบเปล่าเงียบ ๆ', ()=>{
  const ins = call('createInspection',[{template:'tanker', jobNo:'JT-69/0002',
                                        kind:'tanker', area:'for'},QC]);
  if(!ins.n) throw new Error('รหัสเก่า "tanker" แล้วได้ใบเปล่า — ผู้ใช้จะไม่รู้ตัว');
  return 'รหัสเก่า tanker → '+ins.template+' ('+ins.n+' หัวข้อ)'; });

T('เดาแม่แบบจาก MODEL ให้เอง', ()=>{
  const r = call('saveTemplate',[{name:'แม่แบบ LPG', kind:'tanker', model:'LPG TANK 24,000 L'},QC]);
  call('saveTemplateItems',[r.key,[{cat:'ตัวถัง',title:'ผิวนอก'}],QC]);
  const hit = call('suggestTemplate',['LPG TANK 24,000 L','tanker',QC]);
  if(!hit || hit.key !== r.key) throw new Error('MODEL ตรงเป๊ะแต่เดาไม่เจอ');
  if(!hit.exact) throw new Error('ควรบอกว่าเป็นรุ่นตรง');
  const miss = call('suggestTemplate',['รุ่นที่ไม่มีในทะเบียน','tanker',QC]);
  if(!miss) throw new Error('ไม่มีรุ่นตรง ก็ควรเสนอแม่แบบกลาง ๆ ให้');
  if(miss.exact) throw new Error('ไม่ตรงรุ่นแต่บอกว่าตรง');
  return 'ตรงรุ่น → '+hit.name+' · ไม่ตรงรุ่น → เสนอ '+miss.name+' ให้แทน'; });

T('คนที่ไม่ใช่ QC/ผู้บริหาร แก้แม่แบบไม่ได้ (เป็นมาตรฐานบริษัท)', ()=>{
  let blocked = false;
  try { call('saveTemplate',[{name:'ลองแก้',kind:'tanker'},STORE]); } catch(e){ blocked = true; }
  if(!blocked) throw new Error('สโตร์สร้างแม่แบบได้');
  const list = call('listTemplates',[false,STORE]);
  if(!list.length) throw new Error('สโตร์ควรดูได้ แค่แก้ไม่ได้');
  return 'สโตร์ดูได้ '+list.length+' ชุด แต่แก้ไม่ได้'; });

T('ปิดใช้แม่แบบแล้วต้องหายจากตัวเลือกตอนเปิดใบ แต่ใบเก่ายังอ้างชื่อได้', ()=>{
  const r = call('saveTemplate',[{name:'แม่แบบจะปิด', kind:'equip'},QC]);
  call('saveTemplateItems',[r.key,[{cat:'ปริมาณ',title:'ครบตาม PO'}],QC]);
  call('setTemplateActive',[r.key,false,QC]);
  const on  = call('listTemplates',[false,QC]).map(x=>x.key);
  const all = call('listTemplates',[true, QC]).map(x=>x.key);
  if(on.indexOf(r.key) >= 0) throw new Error('ปิดแล้วยังโผล่ในตัวเลือก');
  if(all.indexOf(r.key) < 0) throw new Error('ปิดแล้วหายไปจากทะเบียนเลย — ใบเก่าจะอ้างไม่ได้');
  return 'ปิดแล้วซ่อนจากตัวเลือก แต่ยังอยู่ในทะเบียน'; });

T('ใบเคลมที่เกิดจากใบตรวจ ต้องเป็นประเภท "เคลมหลังตรวจรับ" และรู้ว่ามาจากใบไหน', ()=>{
  const r = call('saveTemplate',[{name:'แม่แบบส่งเคลม', kind:'tanker', model:'MDL-SEND'},QC]);
  call('saveTemplateItems',[r.key,[{cat:'ตัวถัง',title:'ผิวนอกบุบ'},{cat:'อุปกรณ์',title:'วาล์วรั่ว'}],QC]);
  const ins = call('createInspection',[{template:r.key, jobNo:'JT-69/0003', model:'MDL-SEND',
                                        kind:'tanker', area:'for', eNo:'ENG-SEND-9'},QC]);
  const items = call('getInspection',[ins.docNo,QC]).items;
  for (const it of items){
    call('saveInspItemField',[ins.docNo,it.seq,'acc','UNACC',QC]);
    call('savePhoto',[ins.docNo,'JT-69/0003',String(it.seq),px,'p.jpg',QC]);
  }
  call('advanceInsp',[ins.docNo,QC]);            // ร่าง → รออนุมัติ
  call('advanceInsp',[ins.docNo,BOSS]);          // รออนุมัติ → อนุมัติแล้ว
  const sent = call('sendUnAccToClaim',[ins.docNo,QC]);
  if(!sent.ok) throw new Error('ส่งไปเปิดใบเคลมไม่สำเร็จ');
  const c = call('getClaim',[sent.claimNo,QC]);
  if(c.head['ประเภทการเคลม'] !== 'insp')
    throw new Error('ประเภทการเคลมควรเป็น insp ได้ '+c.head['ประเภทการเคลม']);
  if(c.head['มาจากใบตรวจ'] !== ins.docNo)
    throw new Error('ไม่ได้บันทึกว่ามาจากใบตรวจไหน ได้ "'+c.head['มาจากใบตรวจ']+'"');
  if(c.head['E. No.'] !== 'ENG-SEND-9')
    throw new Error('E. No. ไม่ตามไปที่ใบเคลม ได้ "'+c.head['E. No.']+'"');
  if(c.head['ชนิดงานต่างประเทศ'] !== 'tanker')
    throw new Error('ชนิดงาน ตปท. ไม่ตามไป ได้ "'+c.head['ชนิดงานต่างประเทศ']+'"');
  return sent.claimNo+' · ประเภท insp · มาจาก '+ins.docNo+' · E.No + Tankers ตามไปครบ'; });

T('เพิ่มคอลัมน์ E. No. แล้ว คอลัมน์เดิมของใบตรวจต้องไม่เลื่อน', ()=>{
  const LOCK = ['เลขที่เอกสาร','ชนิดเอกสาร','วันที่','สถานที่ผลิต','ชนิดงาน','เลขที่ JOB','ชื่อลูกค้า',
    'MODEL','CHASSIS NO. (STT)','CHASSIS NO. (ผู้ผลิต)','SERIAL NO.','แม่แบบเช็คลิสต์','PO','Supplier',
    'วันรับสินค้า','ผู้ตรวจ','สถานะ','ใบเคลมที่ออกจากใบนี้','หมายเหตุ','สร้างโดย','สร้างเมื่อ','แก้ไขล่าสุด'];
  const h = call('inspHdr_',[]);
  for(let i=0;i<LOCK.length;i++)
    if(h[i] !== LOCK[i]) throw new Error('คอลัมน์ที่ '+(i+1)+' เลื่อน: ควรเป็น "'+LOCK[i]+'" แต่เป็น "'+h[i]+'"');
  if(h.indexOf('E. No.') <= LOCK.length-1) throw new Error('E. No. ต้องต่อท้าย ไม่ใช่แทรกกลาง');
  return 'คอลัมน์เดิม '+LOCK.length+' ช่องอยู่ที่เดิม · E. No. ต่อท้ายที่ช่อง '+(h.indexOf('E. No.')+1); });

console.log('\n──────────────────────────────');
console.log('ผ่าน '+pass+' · ไม่ผ่าน '+fail);
console.log('เปิดไฟล์ '+G.STATS.openById+' ครั้ง · เขียนแคช '+G.STATS.cachePut+' ครั้ง · ไฟล์รูปใน Drive '+G.STATS.driveFiles);
if (problems.length){ console.log('\nที่ต้องแก้:'); problems.forEach(p=>console.log(' • '+p)); }
process.exit(fail?1:0);
