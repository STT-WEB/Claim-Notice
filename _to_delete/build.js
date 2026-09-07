/* สร้างหน้าเว็บจริงเป็นไฟล์เดียว (แทน HtmlService) เพื่อเอาไปเรนเดอร์ตรวจด้วยตา
   ไม่แตะไฟล์ในโฟลเดอร์ deploy — อ่านอย่างเดียว */
const fs = require('fs'), path = require('path');
const D = path.join(__dirname, '..', 'deploy');
const rd = f => fs.readFileSync(path.join(D, f), 'utf8');
let html = rd('CLAIM-Index.html');
html = html.replace(/<\?!=\s*include\('([^']+)'\);\s*\?>/g, (_, f) => rd(f + '.html'));
fs.writeFileSync(path.join(__dirname, 'app.html'), html);
console.log('เขียน _render/app.html แล้ว ' + html.length + ' ตัวอักษร');
