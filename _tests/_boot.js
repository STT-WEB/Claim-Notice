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


module.exports = { call, reset, sandbox, G, vm };
