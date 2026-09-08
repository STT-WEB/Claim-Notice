/* ═══════════════════════════════════════════════════════════════════════════
 * ทดสอบ "หน้าเว็บจริง + โค้ดหลังบ้านจริง" ต่อกันจริง ๆ
 *
 * ต่างจากเทสต์เดิมยังไง
 *   · e2e.js       = เรียกฟังก์ชันหลังบ้านตรง ๆ ไม่ผ่านหน้าจอ
 *   · rend/*.mjs   = เรนเดอร์หน้าจอ แต่หลังบ้านเป็นข้อมูลปลอม (สตับ)
 *   · live.mjs     = กดปุ่มบนหน้าจอจริง แล้ววิ่งไปเรียกโค้ดหลังบ้านจริง
 *                    → บั๊กแบบ "กดแล้วไม่บันทึก" / "ข้อมูลครบแล้วปุ่มไม่ขึ้น"
 *                      จับได้เฉพาะแบบนี้เท่านั้น
 * ═════════════════════════════════════════════════════════════════════════ */
import { chromium } from 'playwright';
import { createRequire } from 'module';
import path from 'path';
const require = createRequire(import.meta.url);
const BOOT = require('./_boot.js');

const AUTH  = { emp:'6100030', pin:'111111' };
const QC    = { emp:'6406013', pin:'222222' };
const STORE = { emp:'6406020', pin:'333333' };
const BUY   = { emp:'6406021', pin:'444444' };
const BOSS  = { emp:'6406099', pin:'555555' };

let pass = 0, fail = 0; const problems = [];
function T(name, ok, detail){
  if (ok){ console.log('  ✓ ' + name + (detail ? ' — ' + detail : '')); pass++; }
  else { console.log('  ✗ ' + name + '  →  ' + detail); problems.push(name + ': ' + detail); fail++; }
}

const APP = 'file://' + path.resolve(process.env.APPHTML ||
  '/tmp/claude-0/-home-claude/7beff84d-22cc-5acd-a682-54d416dcd7d8/scratchpad/rend/app.html');

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport:{ width:1500, height:1000 } });
const errs = [], dialogs = [];
p.on('pageerror', e => errs.push('JS: ' + e.message));
p.on('console', m => { const t = m.text(); if (m.type() === 'error' && t.indexOf('ERR_') < 0) errs.push('console: ' + t); });
p.on('dialog', d => { dialogs.push(d.message()); d.accept().catch(()=>{}); });

/* สะพาน: หน้าเว็บเรียก google.script.run.<fn>() → วิ่งมาที่โค้ดหลังบ้านจริงใน Node */
const CALLS = [];
await p.exposeFunction('__srv', (fn, args) => {
  CALLS.push(fn);
  BOOT.reset();                       // ทุกคำสั่ง = 1 execution ใหม่ เหมือน Apps Script ของจริง
  try { return { ok:true, v: BOOT.call(fn, args) }; }
  catch (e){ return { ok:false, e: e.message }; }
});
await p.addInitScript(() => {
  const fresh = () => {
    let ok = null, bad = null;
    const api = new Proxy({}, { get(_, fn){
      if (fn === 'withSuccessHandler') return h => { ok = h; return api; };
      if (fn === 'withFailureHandler') return h => { bad = h; return api; };
      return (...a) => {
        window.__srv(String(fn), a).then(r => {
          if (r.ok) { try { ok && ok(r.v); } catch(e){ console.error('handler: ' + e.message); } }
          else bad && bad(new Error(r.e));
        });
      };
    }});
    return api;
  };
  window.google = { script:{ get run(){ return fresh(); }, host:{ setHeight(){} } } };
});
await p.goto(APP);
await p.waitForTimeout(400);

async function login(who, roles, name){
  await p.evaluate(a => { AUTH = a.auth;
    enterApp({ name:a.name, dept:'-', role:a.roles[0], roles:a.roles, emp:a.auth.emp }, 'ทดสอบ'); },
    { auth:who, roles:roles, name:name });
  await p.waitForTimeout(500);
}
const wait = ms => p.waitForTimeout(ms || 700);
const val  = sel => p.evaluate(s => { const e = document.querySelector(s); return e ? e.value : null; }, sel);
const txt  = sel => p.evaluate(s => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; }, sel);

/* ══════════════ ① ใบเคลม: บันทึกร่างแล้วแก้ต่อได้เรื่อย ๆ ══════════════ */
console.log('\n① ใบเคลม — บันทึกร่างแล้วแก้ต่อได้เรื่อย ๆ');
await login(QC, ['QC'], 'คุณสมชาย');
await p.evaluate(() => go('newclaim'));
await wait(900);
await p.evaluate(() => {
  $('f_jobNo').value = 'JT-69/0001';
  $('f_model').value = 'MDL-TEST';
  const g = GNEW;
  g.rows[0].code = 'GC-1'; g.rows[0].name = 'ของทดสอบ'; g.rows[0].th = 'พังตรงนี้';
  g.redraw();
});
await wait(400);
await p.evaluate(() => submitClaim(0));          // บันทึกร่าง
await wait(1500);
const docNo = await p.evaluate(() => CURDOC);
T('กดบันทึกร่างแล้วได้เลขใบจริง', /^CLM-\d\d\/\d+$/.test(docNo || ''), docNo);

const hasSaveBtn = await p.evaluate(() =>
  Array.from(document.querySelectorAll('button')).some(x => /บันทึกร่าง|บันทึกไว้ก่อน/.test(x.textContent)));
T('หน้าใบร่างต้องมีปุ่มบันทึกให้กดเองด้วย (ไม่ใช่มีแต่ส่งอนุมัติ)', hasSaveBtn,
  hasSaveBtn ? 'มีปุ่ม' : 'ไม่มีปุ่มบันทึกเลย — เบียร์เจอปัญหานี้');

/* แก้ข้อมูลต่อในใบร่าง แล้วดูว่าลงชีตจริงไหม */
await p.evaluate(() => { const e = $('c_serialNo'); if (e){ e.value = 'SN-DRAFT-1'; e.dispatchEvent(new Event('change')); } });
await wait(900);
let sv = BOOT.call('getClaim', [docNo, AUTH]);
T('แก้ช่องหัวใบตอนเป็นร่าง แล้วบันทึกลงชีตจริง', sv && sv.head['SERIAL NO.'] === 'SN-DRAFT-1',
  'SERIAL ในชีต = ' + (sv && sv.head['SERIAL NO.']));

/* แก้ในตารางรายการ */
await p.evaluate(() => {
  const g = GEDIT; if (!g) return;
  g.rows[0].qty = '3';
  const el = document.querySelector('#' + g.id + ' [data-r="0"][data-c="' + colIndexOf(g,'qty') + '"]');
  if (el){ el.value = '3'; el.dispatchEvent(new Event('change', {bubbles:true})); }
});
await wait(1000);
sv = BOOT.call('getClaim', [docNo, AUTH]);
T('แก้ตารางรายการตอนเป็นร่าง แล้วบันทึกลงชีตจริง',
  sv && sv.items[0] && String(sv.items[0].qty) === '3', 'จำนวนในชีต = ' + (sv && sv.items[0] && sv.items[0].qty));

/* ══════════════ ② มีรูปแต่ไม่มีข้อมูล ต้องส่งไม่ได้ ══════════════ */
console.log('\n② รายการที่มีแต่รูป ไม่มีชื่อสินค้า — ต้องส่งไม่ได้ และไม่ควรตามไปหลอกสโตร์');
const px = 'data:image/jpeg;base64,' + Buffer.from('x'.repeat(400)).toString('base64');
BOOT.call('savePhoto', [docNo, 'JT-69/0001', '2', px, 'ph2.jpg', QC]);   // แนบรูปให้ "รายการที่ 2" ที่ยังไม่มีข้อมูล
const chk = BOOT.call('claimGate', [docNo, QC]);
T('รายการที่มีแต่รูป ไม่มีชื่อสินค้า ต้องถูกจับได้ก่อนส่งอนุมัติ',
  !chk.ok, chk.ok ? 'ระบบยอมให้ส่ง ทั้งที่ข้อมูลไม่ครบ' : chk.missing.join(' · '));

/* ══════════════ ③ Inspection: ติ๊กผลตรวจแล้วต้องบันทึกจริง ══════════════ */
console.log('\n③ ใบตรวจรับ — ติ๊กผลตรวจแล้วต้องบันทึกลงชีตจริง');
const tpl = BOOT.call('saveTemplate', [{ name:'แม่แบบทดสอบสด', kind:'tanker', model:'MDL-LIVE' }, QC]);
BOOT.call('saveTemplateItems', [tpl.key,
  [{cat:'ตัวถัง',title:'ข้อ 1'},{cat:'ตัวถัง',title:'ข้อ 2'},{cat:'อุปกรณ์',title:'ข้อ 3'}], QC]);
const ins = BOOT.call('createInspection', [{ template:tpl.key, jobNo:'JT-69/0001',
  model:'MDL-LIVE', kind:'tanker', area:'for' }, QC]);
await p.evaluate(n => go('ins', n), ins.docNo);
await wait(1400);

const nRows = await p.evaluate(() => document.querySelectorAll('table.xt tbody tr').length);
T('เปิดใบตรวจแล้วเห็นหัวข้อจากแม่แบบ', nRows >= 3, nRows + ' แถว');

/* กดปุ่ม ✓ ผ่าน ทุกแถว เหมือนคนใช้จริง */
await p.evaluate(() => {
  const btns = document.querySelectorAll('table.xt tbody tr .accbtn.ok, table.xt tbody tr button');
  for (const el of document.querySelectorAll('table.xt tbody tr')){
    const ok = Array.from(el.querySelectorAll('button')).find(x => x.textContent.trim() === '✓');
    if (ok) ok.click();
  }
});
await wait(1600);
const after = BOOT.call('getInspection', [ins.docNo, QC]);
const ticked = after.items.filter(x => x.acc).length;
T('กดปุ่ม ✓ บนหน้าจอ แล้วผลตรวจลงชีตครบทุกข้อ', ticked === after.items.length,
  'ติ๊กลงชีต ' + ticked + ' / ' + after.items.length + ' ข้อ');

const ic = BOOT.call('inspCheck', [ins.docNo, QC]);
T('ติ๊กครบแล้ว ระบบต้องไม่บอกว่า "ยังไม่ได้ติ๊กผลตรวจ"',
  ic.ok || !/ยังไม่ได้ติ๊ก/.test(ic.msg || ''), ic.ok ? 'ส่งต่อได้' : ic.msg);

/* ══════════════ ④ ปุ่มส่งต่อ ต้องอัปเดตเองหลังกรอกครบ ══════════════ */
console.log('\n④ กรอกครบแล้ว ปุ่มส่งต่อต้องขึ้นเอง ไม่ต้องกดรีเฟรช');
const gate = await p.evaluate(() => typeof refreshGate === 'function');
T('มีกลไกเช็คซ้ำว่าครบหรือยัง หลังแก้ข้อมูล', gate,
  gate ? 'มี refreshGate()' : 'ไม่มี — ต้องกดรีเฟรชเองถึงจะขึ้นปุ่ม (เบียร์เจอปัญหานี้)');

/* ══════════════ ⑤ สิทธิ์ปริ้น ══════════════ */
console.log('\n⑤ สิทธิ์ปริ้นเอกสาร');
let f = BOOT.call('claimFlow', [docNo, STORE]);
T('สโตร์ต้องปริ้นไม่ได้', !f.canPrint, f.canPrint ? 'สโตร์ปริ้นได้ — ผิด' : (f.printWhy || 'กันแล้ว'));

console.log('\n──────────────────────────────');
console.log('ผ่าน ' + pass + ' · ไม่ผ่าน ' + fail);
console.log('JS error ' + errs.length + ' · alert ' + dialogs.length);
errs.slice(0,5).forEach(e => console.log('   ' + e));
dialogs.slice(0,5).forEach(e => console.log('   ALERT: ' + e));
if (problems.length){ console.log('\nที่ต้องแก้:'); problems.forEach(x => console.log(' • ' + x)); }
await b.close();
process.exit(fail ? 1 : 0);
