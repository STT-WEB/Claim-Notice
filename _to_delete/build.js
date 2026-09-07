const fs=require('fs'),path=require('path');
const D=path.join(__dirname,'..','deploy'); const rd=f=>fs.readFileSync(path.join(D,f),'utf8');
let h=rd('CLAIM-Index.html').replace(/<\?!=\s*include\('([^']+)'\);\s*\?>/g,(_,f)=>rd(f+'.html'));
fs.writeFileSync(path.join(__dirname,'app.html'),h); console.log('ok '+h.length);
