/* วัดว่าคำสั่งไหนกินเวลา/กินการอ่านชีตเท่าไหร่ — ไม่เดา
   ตัวชี้วัดที่แม่นที่สุดใน Apps Script คือ "จำนวนครั้งที่แตะชีต" (getRange/getValues)
   เพราะแต่ละครั้งคือการวิ่งข้ามเครือข่ายไปหา Google Sheets */
const B = require('./_boot.js');
const G = B.G;

const AUTH = { emp:'6100030', pin:'111111' };
const QC   = { emp:'6406013', pin:'222222' };
const px   = 'data:image/jpeg;base64,' + Buffer.from('x'.repeat(300)).toString('base64');

/* สร้างข้อมูลให้เหมือนใช้จริงสัก 25 ใบ */
for (let i = 1; i <= 25; i++){
  const dft = 'D' + i;
  B.call('savePhoto', [dft, 'JT-69/000' + (i % 9), 'r1', px, 'a.jpg', QC]);
  B.call('createClaimWithPhotos', [{ claimType:'pre', area:'dom', jobNo:'JT-69/000' + (i % 9),
    jobName:'ลูกค้า ' + i, dept:'QC',
    items:[{code:'C'+i, name:'ของ '+i, th:'พัง '+i, qty:'1', unit:'PCS', _rid:'r1'}] }, dft, {r1:1}, QC]);
}

function measure(label, fn){
  B.reset();
  const before = { get: G.STATS.getRange || 0, open: G.STATS.openById || 0 };
  const t0 = Date.now();
  let err = '';
  try { fn(); } catch(e){ err = ' ✗ ' + e.message; }
  const ms = Date.now() - t0;
  const got = (G.STATS.getRange || 0) - before.get;
  const opn = (G.STATS.openById || 0) - before.open;
  console.log((label + '                              ').slice(0, 30) +
    ' แตะชีต ' + String(got).padStart(5) + ' ครั้ง · เปิดไฟล์ ' + String(opn).padStart(3) +
    ' · ' + String(ms).padStart(5) + ' ms' + err);
  return got;
}

console.log('\nวัดคำสั่งที่คนกดบ่อยที่สุด (ข้อมูล 25 ใบ + 25 รูป)\n');
const list = B.call('listClaims', [{}, AUTH]);
const one  = list[0].docNo;

measure('เปิดหน้าแรก getHome2', () => B.call('getHome2', [AUTH]));
measure('หน้าแรก workQueues',   () => B.call('workQueues', [AUTH]));
measure('ทะเบียน listClaims',   () => B.call('listClaims', [{}, AUTH]));
measure('เปิดใบ getClaimFull',  () => B.call('getClaimFull', [one, AUTH]));
measure('แถบสถานะ claimFlow',   () => B.call('claimFlow', [one, AUTH]));
measure('เช็คสด claimGate',     () => B.call('claimGate', [one, AUTH]));
measure('บันทึก 1 ช่อง',        () => B.call('saveClaimField', [one, 'model', 'M1', AUTH]));
measure('Dashboard dashDocs',   () => B.call('dashDocs', [AUTH]));
measure('รูปทั้งระบบ photoCoverage_', () => B.call('photoCoverage_', []));
console.log('');

/* กันไม่ให้ช้ากลับไปอีก — ถ้ามีใครเผลอกลับไปอ่านทีละช่อง เทสต์นี้จะแดง */
const LIMIT = { claimFlow:16, getClaimFull:26, claimGate:14, listClaims:10, getHome2:12, dashDocs:14 };
let bad = 0;
console.log('เพดานที่ยอมให้ (กันช้ากลับไปอีก)');
Object.keys(LIMIT).forEach(fn => {
  B.reset();
  const before = G.STATS.getRange;
  try { B.call(fn, fn === 'listClaims' ? [{}, AUTH] : (fn === 'getHome2' || fn === 'dashDocs' ? [AUTH] : [one, AUTH])); } catch(e){}
  const got = G.STATS.getRange - before;
  const ok = got <= LIMIT[fn];
  if (!ok) bad++;
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + (fn + '                    ').slice(0,22) +
              got + ' / ' + LIMIT[fn] + ' ครั้ง');
});
console.log(bad ? '\n✗ ช้ากว่าเพดาน ' + bad + ' คำสั่ง' : '\n✓ ทุกคำสั่งอยู่ในเพดาน');
process.exit(bad ? 1 : 0);
