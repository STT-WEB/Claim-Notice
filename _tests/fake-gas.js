/* ── จำลอง Google Apps Script ให้รันโค้ดจริงในเครื่องได้ ────────────────
   มีไว้เพื่อ "ลองใช้ทั้งโปรแกรมเอง" ก่อนจะรบกวนเบียร์ให้ deploy
   จำลองเฉพาะที่โปรแกรมนี้ใช้จริง: Spreadsheet · Cache · Properties · Drive ·
   Utilities · Session · Lock · LanguageApp
   จุดสำคัญ: CacheService จำลอง **ข้อจำกัด 100KB ต่อค่า** ด้วย เพื่อให้จับบั๊กแบบเดียว
   กับที่เกิดบนของจริงได้ (Argument too large: value)                       */

function colLetterCount(){ return 60; }

class Range {
  constructor(sh, r, c, nr, nc){ this.sh=sh; this.r=r; this.c=c; this.nr=nr; this.nc=nc; }
  _cell(i,j){ const row=this.sh._grid[this.r-1+i]||[]; const v=row[this.c-1+j]; return v===undefined?'':v; }
  getValues(){ const o=[]; for(let i=0;i<this.nr;i++){ const rr=[]; for(let j=0;j<this.nc;j++) rr.push(this._cell(i,j)); o.push(rr);} return o; }
  getDisplayValues(){ return this.getValues().map(r=>r.map(v=>v===null||v===undefined?'':String(v))); }
  getValue(){ return this._cell(0,0); }
  getDisplayValue(){ const v=this._cell(0,0); return v===null||v===undefined?'':String(v); }
  setValues(vals){
    for(let i=0;i<vals.length;i++){
      const R=this.r-1+i; while(this.sh._grid.length<=R) this.sh._grid.push([]);
      for(let j=0;j<vals[i].length;j++) this.sh._grid[R][this.c-1+j]=vals[i][j];
    }
    return this;
  }
  setValue(v){ return this.setValues([[v]]); }
  setFontWeight(){ return this; } setBackground(){ return this; }
  setNumberFormat(){ return this; } setWrap(){ return this; }
  setHorizontalAlignment(){ return this; } setVerticalAlignment(){ return this; }
  setFontSize(){ return this; } setBorder(){ return this; } merge(){ return this; }
  clearContent(){ const z=[]; for(let i=0;i<this.nr;i++) z.push(new Array(this.nc).fill('')); return this.setValues(z); }
}

class Sheet {
  constructor(ss,name){ this.ss=ss; this.name=name; this._grid=[]; this._maxCols=60; }
  getName(){ return this.name; }
  getLastRow(){ let n=0; this._grid.forEach((r,i)=>{ if(r && r.some(v=>v!==''&&v!==null&&v!==undefined)) n=i+1; }); return n; }
  getLastColumn(){ let n=0; this._grid.forEach(r=>{ if(!r) return; for(let j=r.length-1;j>=0;j--) if(r[j]!==''&&r[j]!==null&&r[j]!==undefined){ n=Math.max(n,j+1); break; } }); return n; }
  getMaxColumns(){ return this._maxCols; }
  getMaxRows(){ return Math.max(this._grid.length, 1000); }
  insertColumnsAfter(a,n){ this._maxCols+=n; return this; }
  setFrozenRows(){ return this; } setColumnWidth(){ return this; } autoResizeColumn(){ return this; }
  getRange(r,c,nr,nc){
    if (typeof r==='string'){ throw new Error('A1 notation ไม่ได้จำลองไว้: '+r); }
    return new Range(this, r, c, nr===undefined?1:nr, nc===undefined?1:nc);
  }
  appendRow(vals){ const r=this.getLastRow()+1; this.getRange(r,1,1,vals.length).setValues([vals]); return this; }
  deleteRow(r){ this._grid.splice(r-1,1); return this; }
  getDataRange(){ return this.getRange(1,1,Math.max(this.getLastRow(),1),Math.max(this.getLastColumn(),1)); }
  sort(){ return this; }
}

class Spreadsheet {
  constructor(id,name){ this.id=id; this.name=name; this._sheets=[]; }
  getId(){ return this.id; } getName(){ return this.name; } getUrl(){ return 'https://sheet/'+this.id; }
  getSheetByName(n){ return this._sheets.find(s=>s.name===n)||null; }
  getSheets(){ return this._sheets; }
  insertSheet(n){ const s=new Sheet(this,n); this._sheets.push(s); return s; }
  deleteSheet(s){ this._sheets=this._sheets.filter(x=>x!==s); }
}

const FILES = {};
function newFile(id,name){ const ss=new Spreadsheet(id,name); FILES[id]=ss; return ss; }

const SpreadsheetApp = {
  openById(id){ if(!FILES[id]) throw new Error('เปิดไฟล์ไม่ได้: '+id); STATS.openById++; return FILES[id]; },
  create(name){ const id='NEW-'+Object.keys(FILES).length; return newFile(id,name); },
  flush(){}
};

/* ── Cache: จำลองข้อจำกัดจริงของ Google ─────────────────────────── */
const CACHE = {};
const MAXV = 100*1024;
const cacheObj = {
  get(k){ const e=CACHE[k]; if(!e) return null; if(Date.now()>e.exp){ delete CACHE[k]; return null;} return e.v; },
  getAll(keys){ const o={}; keys.forEach(k=>{ const v=this.get(k); if(v!==null) o[k]=v; }); return o; },
  put(k,v,ttl){
    if (typeof v!=='string') v=String(v);
    if (v.length>MAXV) throw new Error('Argument too large: value');   // ← ของจริงพังตรงนี้
    STATS.cachePut++;
    CACHE[k]={v,exp:Date.now()+(ttl||600)*1000};
  },
  putAll(obj,ttl){ Object.keys(obj).forEach(k=>this.put(k,obj[k],ttl)); },
  remove(k){ delete CACHE[k]; },
  removeAll(ks){ ks.forEach(k=>delete CACHE[k]); }
};
const CacheService = { getScriptCache:()=>cacheObj, getUserCache:()=>cacheObj };

const PROPS = {};
const PropertiesService = { getScriptProperties:()=>({
  getProperty:k=>(k in PROPS?PROPS[k]:null), setProperty:(k,v)=>{PROPS[k]=String(v);}, deleteProperty:k=>{delete PROPS[k];}
})};

/* ── Drive ── */
let DRIVE_N = 0;
const DFILES = {};
class DFile{
  constructor(name,blob){ this.id='F'+(++DRIVE_N); this.name=name; this.blob=blob; this.parents=[]; DFILES[this.id]=this; }
  getId(){ return this.id; } getName(){ return this.name; }
  setSharing(){ return this; } setTrashed(){ this.trashed=true; return this; }
  getBlob(){ const b=this.blob; return { getName:()=>b?b.getName():this.name, setName(n){ this._n=n; return this; },
                                         getBytes:()=>b?b.getBytes():[], getContentType:()=>'image/jpeg' }; }
  getParents(){ let i=0,p=this.parents; return { hasNext:()=>i<p.length, next:()=>p[i++] }; }
}
class DFolder{
  constructor(name){ this.id='D'+(++DRIVE_N); this.name=name; this.folders=[]; this.files=[]; }
  getId(){ return this.id; } getName(){ return this.name; } getUrl(){ return 'https://drive/'+this.id; }
  createFolder(n){ const f=new DFolder(n); this.folders.push(f); return f; }
  getFoldersByName(n){ const m=this.folders.filter(f=>f.name===n); let i=0; return { hasNext:()=>i<m.length, next:()=>m[i++] }; }
  getFilesByName(n){ const m=this.files.filter(f=>f.name===n); let i=0; return { hasNext:()=>i<m.length, next:()=>m[i++] }; }
  createFile(blob){ const f=new DFile(blob.getName(),blob); f.parents.push(this); this.files.push(f); STATS.driveFiles++; return f; }
  addFile(f){ if(!f.parents.includes(this)){ f.parents.push(this); this.files.push(f);} return this; }
  removeFile(f){ f.parents=f.parents.filter(p=>p!==this); this.files=this.files.filter(x=>x!==f); return this; }
}
const ROOTF = {};
const DriveApp = {
  getFolderById(id){ if(!ROOTF[id]) ROOTF[id]=new DFolder('ROOT-'+id); return ROOTF[id]; },
  getFileById(id){ if(!DFILES[id]) throw new Error('ไม่พบไฟล์ '+id); return DFILES[id]; },
  Access:{ANYONE_WITH_LINK:'A'}, Permission:{VIEW:'V'}
};

/* ── Utilities / Session / Lock / อื่น ๆ ── */
const Utilities = {
  getUuid:()=>'uuid-'+Math.random().toString(36).slice(2,12),
  base64Encode:s=>Buffer.from(String(s)).toString('base64'),
  base64Decode:s=>Buffer.from(String(s),'base64'),
  computeDigest:(a,t)=>Buffer.from(String(t)),
  DigestAlgorithm:{MD5:'MD5'},
  newBlob:(bytes,type,name)=>({ getName:()=>name, getBytes:()=>bytes, getContentType:()=>type }),
  formatDate:(d,tz,f)=>{
    const p=n=>String(n).padStart(2,'0');
    return f.replace('yyyy',d.getFullYear()).replace('MM',p(d.getMonth()+1)).replace('dd',p(d.getDate()))
            .replace('HH',p(d.getHours())).replace('mm',p(d.getMinutes())).replace('ss',p(d.getSeconds()));
  },
  sleep(){},
  zip:(blobs,name)=>({ getName:()=>name, getBytes:()=>[], getContentType:()=>'application/zip' })
};
/* ⚠️ ของจริง: Web App ที่ deploy แบบ "ใครก็เข้าได้" Session.getActiveUser().getEmail()
   คืนค่าว่าง เกือบทุกกรณี  ถ้าจำลองให้คืนอีเมล = ซ่อนบั๊กที่ของจริงพัง (เคยพลาดมาแล้ว) */
const FAKE_EMAIL = { v: '' };
const Session = { getActiveUser:()=>({getEmail:()=>FAKE_EMAIL.v}),
                  getScriptTimeZone:()=>'Asia/Bangkok', getEffectiveUser:()=>({getEmail:()=>FAKE_EMAIL.v}) };
const LockService = { getScriptLock:()=>({ waitLock(){}, releaseLock(){}, tryLock(){return true;} }) };
const LanguageApp = { translate:(t,f,to)=>'[EN] '+t };
const UrlFetchApp = { fetch:()=>({ getResponseCode:()=>200, getContentText:()=>'{}' }) };
const MailApp = { sendEmail(){} };
const HtmlService = {
  createTemplateFromFile:()=>({ evaluate:()=>({ setTitle(){return this;}, addMetaTag(){return this;}, setXFrameOptionsMode(){return this;} }) }),
  createHtmlOutputFromFile:f=>({ getContent:()=>require('fs').readFileSync(f+'.html','utf8') }),
  XFrameOptionsMode:{ALLOWALL:'A'}
};
const ContentService = {
  createTextOutput:t=>({ setMimeType(){ return this; }, getContent:()=>t }),
  MimeType:{JSON:'json'}
};
const STATS = { openById:0, cachePut:0, driveFiles:0 };

module.exports = { SpreadsheetApp, CacheService, PropertiesService, DriveApp, Utilities, Session,
                   LockService, LanguageApp, UrlFetchApp, MailApp, HtmlService, ContentService,
                   FILES, newFile, STATS, CACHE, PROPS, DFILES, FAKE_EMAIL };
