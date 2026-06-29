const express = require('express');
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const app = express();
const PORT = 5000;

const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';
const HISTORY_FILE_HU = '.hu_cache';
const HISTORY_FILE_MD5 = '.md5_cache';
const BRAIN_FILE_HU = '.hu_core';
const BRAIN_FILE_MD5 = '.md5_core';
const ADMIN_FILE = '.admin_vault';

// ============================================================
// 🔐 HỆ THỐNG ADMIN VIP
// ============================================================

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = crypto.randomBytes(12).toString('hex');
const ADMIN_TOKENS = new Map();

console.log('╔══════════════════════════════════════════════╗');
console.log('║  🔑 THÔNG TIN ADMIN VIP                      ║');
console.log('╠══════════════════════════════════════════════╣');
console.log(`║  Username: ${ADMIN_USERNAME}                          ║`);
console.log(`║  Password: ${ADMIN_PASSWORD}      ║`);
console.log('║  Login: POST /_admin/login                    ║');
console.log('╚══════════════════════════════════════════════╝\n');

const generateAdminToken = () => {
    const token = crypto.randomBytes(48).toString('hex');
    const expires = Date.now() + 86400000;
    ADMIN_TOKENS.set(token, { expires, createdAt: Date.now() });
    return { token, expires };
};

const adminAuth = (req, res, next) => {
    const token = req.headers['x-admin-token'] || req.query['_admin'];
    if (!token || !ADMIN_TOKENS.has(token)) return res.status(403).json({ error: 'Yêu cầu quyền Admin VIP' });
    const data = ADMIN_TOKENS.get(token);
    if (Date.now() > data.expires) { ADMIN_TOKENS.delete(token); return res.status(403).json({ error: 'Token hết hạn' }); }
    next();
};

// ============================================================
// 🛡️ BẢO MẬT
// ============================================================

app.use(helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], styleSrc: ["'self'","'unsafe-inline'","https://fonts.googleapis.com"], fontSrc: ["'self'","https://fonts.gstatic.com"], scriptSrc: ["'self'","'unsafe-inline'"], imgSrc: ["'self'","data:"], connectSrc: ["'self'"], frameSrc: ["'none'"], objectSrc: ["'none'"] } },
    crossOriginEmbedderPolicy: true, crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-origin" }, dnsPrefetchControl: { allow: false },
    frameguard: { action: "deny" }, hidePoweredBy: true,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    ieNoOpen: true, noSniff: true, originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
    referrerPolicy: { policy: "no-referrer" }, xssFilter: true
}));

app.use(cors({ origin: false, methods: ['GET','POST'], allowedHeaders: ['Content-Type','X-Admin-Token','X-Access-Token'] }));
app.use(rateLimit({ windowMs: 60000, max: 80, standardHeaders: true, legacyHeaders: false, message: 'Quá nhiều yêu cầu' }));

app.use((req, res, next) => {
    const blocked = ['/admin','/wp-admin','/phpmyadmin','/.env','/.git','/config','/backup','/login','/shell','/api','/graphql','/actuator','/swagger','/debug'];
    if (blocked.some(b => req.path.toLowerCase().startsWith(b))) return res.status(404).end();
    const dangerous = ['<','>','script','onerror','onload','javascript:','union','select','insert','update','delete','drop','exec','eval','alert'];
    if (req.query) for (const [k,v] of Object.entries(req.query)) { if (dangerous.some(d => String(v).toLowerCase().includes(d))) return res.status(403).end(); }
    const blockedUA = ['sqlmap','nikto','nmap','burp','acunetix','nessus','metasploit','hydra','gobuster','dirbuster','wpscan','zap','scanner'];
    if (blockedUA.some(b => (req.get('User-Agent')||'').toLowerCase().includes(b))) return res.status(403).end();
    res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('X-Frame-Options','DENY');
    res.setHeader('X-XSS-Protection','1; mode=block'); res.setHeader('Cache-Control','no-store'); res.setHeader('Server','');
    next();
});

// ============================================================
// 🔐 MÃ HÓA AES-256
// ============================================================

const MK = crypto.createHash('sha512').update('crystal-tx-anh-khoi-exclusive-vault').digest();
function enc(text) { try { const iv = crypto.randomBytes(16); const c = crypto.createCipheriv('aes-256-gcm', MK.slice(0,32), iv); let e = c.update(String(text),'utf8','hex'); e += c.final('hex'); const t = c.getAuthTag().toString('hex'); return iv.toString('hex')+':'+t+':'+e; } catch(e) { return null; } }
function dec(text) { try { const p = text.split(':'); if(p.length!==3) return null; const iv = Buffer.from(p[0],'hex'); const t = Buffer.from(p[1],'hex'); const d = crypto.createDecipheriv('aes-256-gcm', MK.slice(0,32), iv); d.setAuthTag(t); let r = d.update(p[2],'hex','utf8'); r += d.final('utf8'); return r; } catch(e) { return null; } }

// ============================================================
// 🧬 3 ENGINE ĐỘC QUYỀN BY ANH KHÔI
// ============================================================

class WaveResonanceEngine {
    constructor() { this.waveDB = new Map(); this.phaseDB = new Map(); this.trained = false; }
    encode(seq) {
        const s = seq.map(v => v === 'T' ? 1 : -1); const f = [];
        for (const p of [3,5,8,13,21,34]) { if(s.length>=p) { let si=0,co=0; for(let i=0;i<p;i++) { const a=2*Math.PI*i/p; si+=s[s.length-p+i]*Math.sin(a); co+=s[s.length-p+i]*Math.cos(a); } f.push(Math.sqrt(si*si+co*co)/p, Math.atan2(si,co)/Math.PI); } }
        while(f.length<12) f.push(0); return f;
    }
    train(data) { for(let i=60;i<data.length;i++) { const w=data.slice(i-60,i); const f=this.encode(w); const k=f.map(v=>Math.round(v*20)).join(','); if(!this.waveDB.has(k)) { this.waveDB.set(k,{T:0,X:0,t:0}); this.phaseDB.set(k,[]); } const d=this.waveDB.get(k); d[data[i]]++; d.t++; this.phaseDB.get(k).push(data[i]==='T'?1:-1); if(this.phaseDB.get(k).length>25) this.phaseDB.get(k).shift(); } this.trained=true; }
    predict(seq) { if(seq.length<60||!this.trained) return null; const f=this.encode(seq.slice(-60)); const k=f.map(v=>Math.round(v*20)).join(','); const d=this.waveDB.get(k); if(!d||d.t<5) return null; const p=d.T/d.t; const ph=this.phaseDB.get(k)||[]; const s=ph.length>0?ph.reduce((a,b)=>a+b,0)/ph.length:0; const fp=p*0.55+((s+1)/2)*0.3+0.15; return {prob:Math.max(0.08,Math.min(0.92,fp)),conf:Math.min(0.95,d.t/120)}; }
}

class FractalGeometryEngine {
    constructor() { this.fractalDB = new Map(); this.trained = false; }
    calcDim(seq) { const scales=[2,3,4,6,8,12]; const pts=[]; for(const sc of scales) { if(seq.length<sc) break; const s=new Set(); for(let i=0;i<=seq.length-sc;i++) s.add(seq.slice(i,i+sc).join('')); pts.push({sc,ct:s.size}); } if(pts.length<2) return 1; const n=pts.length; let sx=0,sy=0,sxy=0,sx2=0; for(const p of pts) { const x=Math.log(1/p.sc),y=Math.log(p.ct); sx+=x;sy+=y;sxy+=x*y;sx2+=x*x; } return (n*sxy-sx*sy)/(n*sx2-sx*sx+0.001); }
    train(data) { for(let i=45;i<data.length;i++) { const w=data.slice(i-45,i); const d=Math.round(this.calcDim(w)*20); const k=String(d); if(!this.fractalDB.has(k)) this.fractalDB.set(k,{T:0,X:0,t:0}); const fd=this.fractalDB.get(k); fd[data[i]]++; fd.t++; } this.trained=true; }
    predict(seq) { if(seq.length<45||!this.trained) return null; const d=Math.round(this.calcDim(seq.slice(-45))*20); const fd=this.fractalDB.get(String(d)); if(!fd||fd.t<5) return null; const p=fd.T/fd.t; return {prob:Math.max(0.08,Math.min(0.92,p)),conf:Math.min(0.9,fd.t/90)}; }
}

class EntropyFlowEngine {
    constructor() { this.entropyDB = new Map(); this.flowDB = new Map(); this.trained = false; }
    calcEntropy(seq) { const wins=[3,5,8,13]; const ents=[]; for(const w of wins) { if(seq.length>=w) { const sl=seq.slice(-w); const p=sl.filter(s=>s==='T').length/w; let e=0; if(p>0&&p<1) e=-p*Math.log2(p)-(1-p)*Math.log2(1-p); ents.push(e); } } const ae=ents.reduce((a,b)=>a+b,0)/(ents.length||1); const st=1-(ents.length>1?Math.max(...ents)-Math.min(...ents):0); const tr=seq.slice(-5).filter(s=>s==='T').length/5-seq.slice(-13).filter(s=>s==='T').length/13; return {e:ae,s:st,t:tr}; }
    train(data) { for(let i=45;i<data.length;i++) { const w=data.slice(i-45,i); const ent=this.calcEntropy(w); const k=`${Math.round(ent.e*10)}|${Math.round(ent.s*10)}`; if(!this.entropyDB.has(k)) { this.entropyDB.set(k,{T:0,X:0,t:0}); this.flowDB.set(k,[]); } const ed=this.entropyDB.get(k); ed[data[i]]++; ed.t++; this.flowDB.get(k).push(data[i]==='T'?1:-1); if(this.flowDB.get(k).length>20) this.flowDB.get(k).shift(); } this.trained=true; }
    predict(seq) { if(seq.length<45||!this.trained) return null; const ent=this.calcEntropy(seq.slice(-45)); const k=`${Math.round(ent.e*10)}|${Math.round(ent.s*10)}`; const ed=this.entropyDB.get(k); if(!ed||ed.t<5) return null; const bp=ed.T/ed.t; const fl=this.flowDB.get(k)||[]; const fs=fl.length>0?fl.reduce((a,b)=>a+b,0)/fl.length:0; const fp=bp*0.5+((fs+1)/2)*0.3+(ent.s>0.5?0.2:0); return {prob:Math.max(0.08,Math.min(0.92,fp)),conf:Math.min(0.9,ed.t/80+ent.s*0.5)}; }
}

// ============================================================
// 🧠 HỆ THỐNG DỰ ĐOÁN BY ANH KHÔI
// ============================================================

class AnhKhoiPredictionSystem {
    constructor(type) {
        this.type = type;
        this.history = [];
        this.stats = { total:0,dung:0,sai:0,tyle:0,chuoi:0,chuoi_dai:0,homnay:{dung:0,sai:0,tong:0} };
        this.lastPhien = null; this.trained = false;
        this.wave = new WaveResonanceEngine();
        this.fractal = new FractalGeometryEngine();
        this.entropy = new EntropyFlowEngine();
        this.memBank = new Map(); this.streakBank = new Map();
    }
    train(data) {
        if(data.length<60) return false;
        this.wave.train(data); this.fractal.train(data); this.entropy.train(data);
        this.memBank.clear(); this.streakBank.clear();
        for(let i=20;i<data.length;i++) {
            const w=data.slice(i-20,i); const t=data[i];
            for(const len of[3,5,8]) { if(w.length>=len) { const p=w.slice(-len).join(''); if(!this.memBank.has(p)) this.memBank.set(p,{T:0,X:0,total:0}); const mb=this.memBank.get(p); mb[t]++; mb.total++; } }
            const last=w[w.length-1]; let st=1; for(let j=w.length-2;j>=0&&w[j]===last;j--) st++;
            const sk=`${last}:${Math.min(st,15)}`; if(!this.streakBank.has(sk)) this.streakBank.set(sk,{T:0,X:0,total:0}); this.streakBank.get(sk)[t]++; this.streakBank.get(sk).total++;
        }
        this.trained=true; return true;
    }
    predict(data) {
        if(!data||data.length<10) return this.fallback();
        const seq=data.map(d=>d==='T'?'T':'X');
        let sT=0,sX=0,sw=0; const dt=[];
        const wr=this.wave.predict(seq); if(wr){const w=3.5*wr.conf;sT+=wr.prob*w;sX+=(1-wr.prob)*w;sw+=w;dt.push(`SC:${Math.round(wr.prob*100)}`);}
        const fr=this.fractal.predict(seq); if(fr){const w=2.8*fr.conf;sT+=fr.prob*w;sX+=(1-fr.prob)*w;sw+=w;dt.push(`PM:${Math.round(fr.prob*100)}`);}
        const er=this.entropy.predict(seq); if(er){const w=2.5*er.conf;sT+=er.prob*w;sX+=(1-er.prob)*w;sw+=w;dt.push(`ET:${Math.round(er.prob*100)}`);}
        for(const len of[3,5,8]){if(seq.length>=len){const p=seq.slice(-len).join('');const mb=this.memBank.get(p);if(mb&&mb.total>=5){const w=1.5;sT+=(mb.T/mb.total)*w;sX+=(mb.X/mb.total)*w;sw+=w;dt.push(`M${len}`);}}}
        const last=seq[seq.length-1];let st=1;for(let j=seq.length-2;j>=0&&seq[j]===last;j--)st++;
        const sk=`${last}:${Math.min(st,15)}`;const sb=this.streakBank.get(sk);if(sb&&sb.total>=5){const w=1.8;sT+=(sb.T/sb.total)*w;sX+=(sb.X/sb.total)*w;sw+=w;dt.push(`C${Math.min(st,15)}`);}
        if(st>=8){if(last==='T'){sX+=3.5;dt.push('DC-T');}else{sT+=3.5;dt.push('DC-X');}sw+=3.5;}
        else if(st>=5){if(last==='T'){sX+=2.0;dt.push('BT');}else{sT+=2.0;dt.push('BX');}sw+=2.0;}
        const lt=seq.filter(s=>s==='T').length/seq.length;
        if(lt>0.65){sX+=1.8;dt.push('CBT');sw+=1.8;}else if(lt<0.35){sT+=1.8;dt.push('CBX');sw+=1.8;}
        if(sw===0) return this.fallback();
        const prob=sT/(sT+sX);const dd=prob>0.5?'TÀI':'XỈU';
        let tc=Math.round(Math.max(prob,1-prob)*100);
        if(dt.length>=7) tc=Math.min(99,tc+8);else if(dt.length>=4) tc=Math.min(99,tc+5);
        tc=Math.min(99,Math.max(55,tc));
        return {duDoan:dd,doTinCay:tc,chiTiet:dt.slice(0,5).join(' | '),soMau:dt.length};
    }
    fallback() { if(this.stats.total>50){const td=this.stats.dung>this.stats.sai?'TÀI':'XỈU';return{duDoan:td,doTinCay:52,chiTiet:'XH',soMau:0};} return{duDoan:'TÀI',doTinCay:51,chiTiet:'MD',soMau:0}; }
    updateResult(p,a){const pr=p==='TÀI'?'T':'X';const ac=a==='TÀI'?'T':'X';const d=pr===ac;this.stats.total++;if(d){this.stats.dung++;this.stats.chuoi=this.stats.chuoi>=0?this.stats.chuoi+1:1;if(this.stats.chuoi>this.stats.chuoi_dai) this.stats.chuoi_dai=this.stats.chuoi;this.stats.homnay.dung++;}else{this.stats.sai++;this.stats.chuoi=this.stats.chuoi<=0?this.stats.chuoi-1:-1;this.stats.homnay.sai++;}this.stats.homnay.tong++;this.stats.tyle=this.stats.total>0?Math.round((this.stats.dung/this.stats.total)*100):0;}
    save(){
        try{
            const bf=this.type==='hu'?BRAIN_FILE_HU:BRAIN_FILE_MD5;
            const hf=this.type==='hu'?HISTORY_FILE_HU:HISTORY_FILE_MD5;
            const bd=enc(JSON.stringify({memBank:Array.from(this.memBank.entries()).slice(-5000),streakBank:Array.from(this.streakBank.entries()),trained:this.trained,stats:this.stats,lastPhien:this.lastPhien}));
            const hd=enc(JSON.stringify({history:this.history.slice(0,1000),stats:this.stats,lastPhien:this.lastPhien,updated:new Date().toISOString()}));
            if(bd) fs.writeFileSync(bf,bd); if(hd) fs.writeFileSync(hf,hd);
        }catch(e){}
    }
    load(){
        try{
            const bf=this.type==='hu'?BRAIN_FILE_HU:BRAIN_FILE_MD5;
            const hf=this.type==='hu'?HISTORY_FILE_HU:HISTORY_FILE_MD5;
            if(fs.existsSync(bf)){const dc=dec(fs.readFileSync(bf,'utf8'));if(dc){const d=JSON.parse(dc);if(d.memBank) this.memBank=new Map(d.memBank);if(d.streakBank) this.streakBank=new Map(d.streakBank);if(d.trained) this.trained=d.trained;if(d.stats) this.stats=d.stats;if(d.lastPhien) this.lastPhien=d.lastPhien;}}
            if(fs.existsSync(hf)){const dc=dec(fs.readFileSync(hf,'utf8'));if(dc){const d=JSON.parse(dc);if(d.history) this.history=d.history;if(d.stats) this.stats=d.stats;if(d.lastPhien) this.lastPhien=d.lastPhien;}}
        }catch(e){}
    }
}

const brainHU = new AnhKhoiPredictionSystem('hu');
const brainMD5 = new AnhKhoiPredictionSystem('md5');
brainHU.load(); brainMD5.load();

// ============================================================
// 📊 DATA
// ============================================================

function transformData(d) { if(!d||!d.list) return null; return d.list.map(i=>({phien:i.id,result:i.resultTruyenThong==='TAI'?'TÀI':'XỈU',dice1:i.dices[0],dice2:i.dices[1],dice3:i.dices[2],total:i.point})); }
async function fetchData(t) { try{const u=t==='hu'?API_URL_HU:API_URL_MD5;const r=await axios.get(u,{timeout:8000,headers:{'User-Agent':'Mozilla/5.0'}});return transformData(r.data);}catch(e){return null;} }

// ============================================================
// ⚡ AUTO
// ============================================================

async function processGame(brain,type) {
    try{
        const data=await fetchData(type); if(!data||data.length===0) return;
        const cur=data[0].phien; if(brain.lastPhien===cur) return;
        for(const r of brain.history){if(r.status&&r.status!=='') continue;const a=data.find(d=>d.phien.toString()===r.phien_hien_tai);if(a){r.status=(r.prediction===a.result)?'✅':'❌';r.actual=a.result;brain.updateResult(r.prediction,a.result);}}
        const ex=brain.history.find(h=>h.phien_hien_tai===(cur+1).toString()); if(ex) return;
        const hd=data.map(d=>d.result==='TÀI'?'T':'X'); if(hd.length>=60) brain.train(hd);
        const result=brain.predict(hd);
        const rec={phien:data[0].phien,phien_hien_tai:(data[0].phien+1).toString(),dice:`${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`,total:data[0].total,actual:data[0].result,prediction:result.duDoan,confidence:result.doTinCay,detail:result.chiTiet,status:'',timestamp:new Date().toISOString(),soMau:result.soMau||0};
        brain.history.unshift(rec); if(brain.history.length>1000) brain.history=brain.history.slice(0,1000);
        brain.lastPhien=cur; brain.save();
    }catch(e){}
}
async function auto(){await Promise.all([processGame(brainHU,'hu'),processGame(brainMD5,'md5')]);}
function startAuto(){setTimeout(auto,3000);setInterval(auto,5000);}

// ============================================================
// 🎨 GIAO DIỆN VIP - ADMIN TOKEN
// ============================================================

function generateLoginHTML() {
    return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>CRYSTAL TX • Admin VIP</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--b0:#040410;--b1:#0a0c1c;--b2:#0e102a;--b3:#121538;--b4:rgba(255,255,255,0.03);--b5:rgba(255,255,255,0.06);--b6:rgba(123,97,255,0.2);--t0:#e8eaf2;--t1:#8890b8;--t2:#4a5080;--g:linear-gradient(135deg,#7b61ff,#3b82f6,#06b6d4,#8b5cf6);--ok:#22c55e;--no:#ef4444;--w:#f59e0b;--q:#7b61ff;--cy:#06b6d4}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:var(--b0);color:var(--t0);min-height:100vh;display:flex;align-items:center;justify-content:center;-webkit-font-smoothing:antialiased}
.bg1{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;background:radial-gradient(ellipse 80% 60% at 30% 30%,rgba(123,97,255,0.06) 0%,transparent 60%),radial-gradient(ellipse 60% 80% at 70% 70%,rgba(6,182,212,0.05) 0%,transparent 60%)}
.bg2{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;background-image:linear-gradient(rgba(255,255,255,0.012) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.012) 1px,transparent 1px);background-size:40px 40px;mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 10%,transparent 70%)}
.login-box{position:relative;z-index:1;background:var(--b2);border:1px solid var(--b4);border-radius:16px;padding:32px 28px;width:100%;max-width:400px;backdrop-filter:blur(20px);box-shadow:0 20px 60px rgba(0,0,0,0.4)}
.logo{text-align:center;margin-bottom:24px}
.logo .icon{font-size:36px;margin-bottom:8px;display:inline-block;animation:float 3s ease-in-out infinite}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
.logo h1{font-family:'Orbitron',sans-serif;font-size:20px;font-weight:800;background:var(--g);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:-0.5px}
.logo .sub{font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--t1);letter-spacing:2px;text-transform:uppercase;margin-top:4px}
.input-group{margin-bottom:14px}
.input-group label{display:block;font-size:8px;color:var(--t1);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;font-weight:600}
.input-group input{width:100%;padding:10px 14px;background:var(--b1);border:1px solid var(--b4);border-radius:8px;color:var(--t0);font-size:13px;font-family:'JetBrains Mono',monospace;outline:none;transition:all 0.3s}
.input-group input:focus{border-color:var(--b6);box-shadow:0 0 0 3px rgba(123,97,255,0.1)}
.btn{width:100%;padding:10px;background:var(--g);border:none;border-radius:8px;color:#fff;font-weight:700;font-size:12px;cursor:pointer;letter-spacing:1px;text-transform:uppercase;font-family:'Orbitron',monospace;transition:all 0.3s}
.btn:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(123,97,255,0.25)}
.token-display{display:none;margin-top:20px;padding:14px;background:var(--b1);border:1px solid var(--b4);border-radius:8px}
.token-display.show{display:block}
.token-display .t-label{font-size:8px;color:var(--t1);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px}
.token-display .t-value{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--ok);word-break:break-all;background:var(--b0);padding:8px;border-radius:4px}
.token-display .t-info{font-size:8px;color:var(--t2);margin-top:8px}
.err{color:var(--no);font-size:10px;margin-top:8px;text-align:center;display:none}
.err.show{display:block}
.ftr{text-align:center;font-size:7px;color:var(--t2);margin-top:20px;font-family:'JetBrains Mono',monospace}
.ftr span{color:var(--q)}
</style></head><body>
<div class="bg1"></div><div class="bg2"></div>
<div class="login-box">
<div class="logo"><div class="icon">◆</div><h1>CRYSTAL TX</h1><div class="sub">Admin VIP • By Anh Khôi</div></div>
<div class="input-group"><label>Username</label><input type="text" id="username" placeholder="Nhập username admin"></div>
<div class="input-group"><label>Password</label><input type="password" id="password" placeholder="Nhập password admin"></div>
<button class="btn" onclick="login()">◆ Đăng Nhập</button>
<div class="err" id="error"></div>
<div class="token-display" id="tokenBox">
<div class="t-label">Token Admin (Có hiệu lực 24h)</div>
<div class="t-value" id="tokenValue"></div>
<div class="t-info" id="tokenInfo"></div>
</div>
<div class="ftr">◆ <span>CRYSTAL TX</span> • Hệ Thống Độc Quyền • By Anh Khôi</div>
</div>
<script>
async function login(){
const u=document.getElementById('username').value;
const p=document.getElementById('password').value;
const e=document.getElementById('error');
const tb=document.getElementById('tokenBox');
e.classList.remove('show');tb.classList.remove('show');
try{
const r=await fetch('/_admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});
const d=await r.json();
if(r.ok){
document.getElementById('tokenValue').textContent=d.token;
document.getElementById('tokenInfo').innerHTML='Hết hạn: '+new Date(d.expires).toLocaleString('vi-VN')+'<br>Thêm header: <b>X-Admin-Token</b> hoặc query: <b>?_admin=TOKEN</b>';
tb.classList.add('show');
}else{e.textContent=d.error||'Sai thông tin';e.classList.add('show');}
}catch(ex){e.textContent='Lỗi kết nối';e.classList.add('show');}
}
</script></body></html>`;
}

function generateDashboardHTML(brain, type, token) {
    const s = brain.stats; const h = brain.history || []; const recent = h.slice(0, 50);
    let td=0,ts=0,cht=0,cdn=0,ct=0;
    for(const r of recent){if(r.status==='✅'){td++;ct++;if(ct>cdn) cdn=ct;}else if(r.status==='❌'){ts++;ct=0;}} cht=ct;
    const tr=recent.length>0?Math.round((td/recent.length)*100):0;
    const wr=s.tyle; const wrc=wr>=70?'#22c55e':wr>=60?'#f59e0b':'#ef4444';

    let rows='';
    for(const r of recent.slice(0,50)){
        const st=r.status||'⏳';const cls=st==='✅'?'w':st==='❌'?'l':'p';const txt=st==='✅'?'WIN':st==='❌'?'LOSE':'WAIT';
        rows+=`<tr class="r-${cls}"><td class="sid">#${r.phien_hien_tai||'-'}</td><td><span class="pr pr-${r.prediction==='TÀI'?'t':'x'}">${r.prediction||'-'}</span></td><td><div class="cb"><div class="cf" style="width:${r.confidence||0}%"></div></div><span class="ct">${r.confidence||0}%</span></td><td><span class="stt stt-${cls}">${txt}</span></td><td>${r.actual||'-'}</td><td class="dt">${(r.detail||'-').substring(0,25)}</td></tr>`;
    }

    return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>CRYSTAL TX • ${type.toUpperCase()}</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--b0:#040410;--b1:#0a0c1c;--b2:#0e102a;--b3:#121538;--b4:rgba(255,255,255,0.03);--b5:rgba(255,255,255,0.06);--b6:rgba(123,97,255,0.2);--t0:#e8eaf2;--t1:#8890b8;--t2:#4a5080;--g:linear-gradient(135deg,#7b61ff,#3b82f6,#06b6d4,#8b5cf6);--ok:#22c55e;--no:#ef4444;--w:#f59e0b;--q:#7b61ff;--cy:#06b6d4}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:var(--b0);color:var(--t0);min-height:100vh;-webkit-font-smoothing:antialiased;overflow-x:hidden}
.bg1{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;background:radial-gradient(ellipse 80% 60% at 20% 30%,rgba(123,97,255,0.05) 0%,transparent 60%),radial-gradient(ellipse 60% 80% at 80% 70%,rgba(6,182,212,0.04) 0%,transparent 60%)}
.bg2{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,0.012) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.012) 1px,transparent 1px);background-size:40px 40px;mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 10%,transparent 70%)}
.app{position:relative;z-index:1;max-width:1100px;margin:0 auto;padding:10px 14px}
.topbar{display:flex;justify-content:space-between;align-items:center;padding:10px 0;flex-wrap:wrap;gap:8px}
.topbar .brand{display:flex;align-items:center;gap:8px}
.topbar .brand .ic{font-size:22px;animation:float 3s ease-in-out infinite}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
.topbar .brand h1{font-family:'Orbitron',sans-serif;font-size:16px;font-weight:800;background:var(--g);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.topbar .brand span{font-size:8px;color:var(--t1);font-family:'JetBrains Mono',monospace;letter-spacing:1px}
.topbar .wr{display:flex;align-items:center;gap:8px}
.topbar .wr .ring{width:48px;height:48px}
.topbar .wr .ring svg{transform:rotate(-90deg)}
.topbar .wr .ring .bc{fill:none;stroke:rgba(255,255,255,0.04);stroke-width:4}
.topbar .wr .ring .fc{fill:none;stroke:${wrc};stroke-width:4;stroke-linecap:round;stroke-dasharray:138.2;stroke-dashoffset:${138.2-(138.2*wr/100)};transition:stroke-dashoffset 1s ease}
.topbar .wr .ring .tx{font-family:'Orbitron',monospace;font-size:10px;font-weight:700;fill:${wrc};text-anchor:middle;dominant-baseline:central}
.topbar .wr .lb{font-size:8px;color:var(--t2)}
.cards{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:10px}
@media(max-width:800px){.cards{grid-template-columns:repeat(3,1fr)}}
@media(max-width:500px){.cards{grid-template-columns:repeat(2,1fr)}}
.card{background:var(--b2);border:1px solid var(--b4);border-radius:10px;padding:8px 10px;text-align:center;transition:all 0.3s}
.card:hover{background:var(--b3);border-color:var(--b6)}
.card .v{font-family:'Orbitron',monospace;font-size:15px;font-weight:700}
.card .l{font-size:7px;color:var(--t2);text-transform:uppercase;letter-spacing:1px;margin-top:2px}
.g{color:var(--ok)}.r{color:var(--no)}.y{color:var(--w)}.c{color:var(--cy)}.p{color:var(--q)}.w{color:var(--t0)}
.tbl{background:var(--b2);border:1px solid var(--b4);border-radius:12px;overflow:hidden}
.tbl-h{display:flex;justify-content:space-between;align-items:center;padding:8px 14px;border-bottom:1px solid var(--b4)}
.tbl-h h3{font-family:'Orbitron',monospace;font-size:11px;font-weight:600;color:var(--t0)}
.tbl-h .cnt{font-size:7px;color:var(--t2);font-family:'JetBrains Mono',monospace}
.tag{font-size:7px;color:var(--q);background:rgba(123,97,255,0.05);padding:2px 8px;border-radius:10px;border:1px solid rgba(123,97,255,0.08)}
.tw{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:9px}
th{background:rgba(255,255,255,0.01);padding:6px 8px;text-align:left;font-weight:600;font-size:7px;text-transform:uppercase;letter-spacing:1px;color:var(--t2);border-bottom:1px solid var(--b4)}
td{padding:5px 8px;border-bottom:1px solid rgba(255,255,255,0.01)}
tr:hover td{background:rgba(255,255,255,0.006)}
.r-w{border-left:1px solid transparent}.r-w:hover{border-left-color:rgba(34,197,94,0.2)}
.r-l{border-left:1px solid transparent}.r-l:hover{border-left-color:rgba(239,68,68,0.2)}
.r-p{border-left:1px solid transparent}.r-p:hover{border-left-color:rgba(245,158,11,0.2)}
.sid{font-family:'Orbitron',monospace;font-size:8px;color:var(--t1)}
.pr{display:inline-block;padding:2px 6px;border-radius:4px;font-weight:700;font-size:7px}
.pr-t{background:rgba(34,197,94,0.07);color:var(--ok)}
.pr-x{background:rgba(239,68,68,0.07);color:var(--no)}
.cb{display:inline-block;width:32px;height:2px;background:rgba(255,255,255,0.04);border-radius:1px;vertical-align:middle;margin-right:3px}
.cf{height:100%;border-radius:1px;background:linear-gradient(90deg,var(--q),var(--cy))}
.ct{font-weight:600;color:var(--cy);font-size:7px}
.stt-w{display:inline-block;padding:1px 5px;border-radius:3px;font-weight:700;font-size:6px;text-transform:uppercase;letter-spacing:1px;background:rgba(34,197,94,0.07);color:var(--ok)}
.stt-l{display:inline-block;padding:1px 5px;border-radius:3px;font-weight:700;font-size:6px;text-transform:uppercase;letter-spacing:1px;background:rgba(239,68,68,0.07);color:var(--no)}
.stt-p{display:inline-block;padding:1px 5px;border-radius:3px;font-weight:700;font-size:6px;text-transform:uppercase;letter-spacing:1px;background:rgba(245,158,11,0.07);color:var(--w)}
.dt{font-size:7px;color:var(--t2);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ftr{text-align:center;padding:8px;font-size:7px;color:var(--t2);font-family:'JetBrains Mono',monospace}
.ftr span{color:var(--q)}
::-webkit-scrollbar{width:2px;height:2px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.03)}
@keyframes scan{0%{transform:translateY(-100%)}100%{transform:translateY(100%)}}
.scan{position:fixed;top:0;left:0;width:100%;height:1px;background:linear-gradient(90deg,transparent,rgba(123,97,255,0.1),transparent);z-index:2;pointer-events:none;animation:scan 5s linear infinite}
</style></head><body>
<div class="bg1"></div><div class="bg2"></div><div class="scan"></div>
<div class="app">
<div class="topbar">
<div class="brand"><div class="ic">◆</div><div><h1>CRYSTAL TX</h1><span>${type.toUpperCase()} • By Anh Khôi</span></div></div>
<div class="wr">
<div class="lb">Tỷ lệ</div>
<svg class="ring" viewBox="0 0 48 48"><circle class="bc" cx="24" cy="24" r="22"/><circle class="fc" cx="24" cy="24" r="22"/><text class="tx" x="24" y="24">${wr}%</text></svg>
</div>
</div>
<div class="cards">
<div class="card"><div class="v w">${s.total}</div><div class="l">Tổng</div></div>
<div class="card"><div class="v g">${s.dung}</div><div class="l">Đúng</div></div>
<div class="card"><div class="v r">${s.sai}</div><div class="l">Sai</div></div>
<div class="card"><div class="v ${s.chuoi>0?'g':s.chuoi<0?'r':'y'}">${s.chuoi>0?'+'+s.chuoi:s.chuoi<0?''+s.chuoi:'0'}</div><div class="l">Chuỗi</div></div>
<div class="card"><div class="v p">${s.chuoi_dai}</div><div class="l">Kỷ Lục</div></div>
<div class="card"><div class="v ${wr>=70?'g':wr>=60?'y':'r'}">${wr}%</div><div class="l">Tỷ Lệ</div></div>
</div>
<div class="tbl">
<div class="tbl-h"><h3>◆ Lịch Sử 50 Phiên</h3><span class="cnt">${recent.length} phiên</span><span class="tag">◆ Anh Khôi</span></div>
<div class="tw"><table><thead><tr><th>Phiên</th><th>Dự Đoán</th><th>Độ Tin</th><th>KQ</th><th>Thực Tế</th><th>Engine</th></tr></thead>
<tbody>${rows||'<tr><td colspan="6" style="text-align:center;padding:15px;">Đang tải...</td></tr>'}</tbody></table></div>
</div>
<div class="ftr">◆ <span>CRYSTAL TX</span> • Cộng Hưởng • Phân Mảnh • Entropy • By Anh Khôi • ${new Date().toLocaleString('vi-VN')}</div>
</div>
<script>setTimeout(()=>location.reload(),5000);</script>
</body></html>`;
}

// ============================================================
// 🔌 API ENDPOINTS
// ============================================================

app.post('/_admin/login', (req, res) => {
    const { username, password } = req.body || {};
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const { token, expires } = generateAdminToken();
        return res.json({ token, expires, message: 'Đăng nhập thành công' });
    }
    return res.status(401).json({ error: 'Sai thông tin đăng nhập' });
});

app.get('/_admin', adminAuth, (req, res) => {
    res.send(generateLoginHTML());
});

const adminAuth = (req, res, next) => {
    const token = req.headers['x-admin-token'] || req.query['_admin'];
    if (!token || !ADMIN_TOKENS.has(token)) return res.status(403).send(generateLoginHTML());
    const data = ADMIN_TOKENS.get(token);
    if (Date.now() > data.expires) { ADMIN_TOKENS.delete(token); return res.status(403).send(generateLoginHTML()); }
    next();
};

app.get('/_hu', adminAuth, async (req, res) => {
    const data = await fetchData('hu');
    if (data) { for (const r of brainHU.history) { if (r.status && r.status!=='') continue; const a=data.find(d=>d.phien.toString()===r.phien_hien_tai); if(a){r.status=(r.prediction===a.result)?'✅':'❌';r.actual=a.result;brainHU.updateResult(r.prediction,a.result);} } brainHU.save(); }
    const token = req.headers['x-admin-token'] || req.query['_admin'];
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.send(generateDashboardHTML(brainHU, 'hu', token));
});

app.get('/_md5', adminAuth, async (req, res) => {
    const data = await fetchData('md5');
    if (data) { for (const r of brainMD5.history) { if (r.status && r.status!=='') continue; const a=data.find(d=>d.phien.toString()===r.phien_hien_tai); if(a){r.status=(r.prediction===a.result)?'✅':'❌';r.actual=a.result;brainMD5.updateResult(r.prediction,a.result);} } brainMD5.save(); }
    const token = req.headers['x-admin-token'] || req.query['_admin'];
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.send(generateDashboardHTML(brainMD5, 'md5', token));
});

app.get('/_hu/json', adminAuth, async (req, res) => {
    try {
        const data = await fetchData('hu');
        if (!data||data.length===0) { const r=brainHU.fallback(); return res.json({prediction:r.duDoan,confidence:r.doTinCay,detail:r.chiTiet}); }
        const ex=brainHU.history.find(h=>h.phien_hien_tai===(data[0].phien+1).toString()); if(ex) return res.json(ex);
        const hd=data.map(d=>d.result==='TÀI'?'T':'X'); if(hd.length>=60) brainHU.train(hd);
        const result=brainHU.predict(hd);
        const rec={phien:data[0].phien,phien_hien_tai:(data[0].phien+1).toString(),dice:`${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`,total:data[0].total,actual:data[0].result,prediction:result.duDoan,confidence:result.doTinCay,detail:result.chiTiet,status:'',timestamp:new Date().toISOString(),soMau:result.soMau||0};
        brainHU.history.unshift(rec); if(brainHU.history.length>1000) brainHU.history=brainHU.history.slice(0,1000); brainHU.save();
        res.json(rec);
    }catch(e){res.status(500).json({error:'Lỗi'});}
});

app.get('/_md5/json', adminAuth, async (req, res) => {
    try {
        const data = await fetchData('md5');
        if (!data||data.length===0) { const r=brainMD5.fallback(); return res.json({prediction:r.duDoan,confidence:r.doTinCay,detail:r.chiTiet}); }
        const ex=brainMD5.history.find(h=>h.phien_hien_tai===(data[0].phien+1).toString()); if(ex) return res.json(ex);
        const hd=data.map(d=>d.result==='TÀI'?'T':'X'); if(hd.length>=60) brainMD5.train(hd);
        const result=brainMD5.predict(hd);
        const rec={phien:data[0].phien,phien_hien_tai:(data[0].phien+1).toString(),dice:`${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`,total:data[0].total,actual:data[0].result,prediction:result.duDoan,confidence:result.doTinCay,detail:result.chiTiet,status:'',timestamp:new Date().toISOString(),soMau:result.soMau||0};
        brainMD5.history.unshift(rec); if(brainMD5.history.length>1000) brainMD5.history=brainMD5.history.slice(0,1000); brainMD5.save();
        res.json(rec);
    }catch(e){res.status(500).json({error:'Lỗi'});}
});

app.get('/_stats', adminAuth, (req, res) => {
    const total=brainHU.stats.total+brainMD5.stats.total;
    const dung=brainHU.stats.dung+brainMD5.stats.dung;
    res.json({hu:brainHU.stats,md5:brainMD5.stats,combined:{total,dung,sai:total-dung,tyle:total>0?Math.round((dung/total)*100):0}});
});

app.get('/_reset', adminAuth, (req, res) => {
    ['hu','md5'].forEach(t=>{const b=t==='hu'?brainHU:brainMD5;b.stats={total:0,dung:0,sai:0,tyle:0,chuoi:0,chuoi_dai:0,homnay:{dung:0,sai:0,tong:0}};b.history=[];b.lastPhien=null;b.save();});
    res.json({message:'Đã reset'});
});

app.use((req, res) => res.status(404).end());
app.use((err, req, res, next) => res.status(500).end());

// ============================================================
// 🚀 START
// ============================================================

app.listen(PORT, '0.0.0.0', () => {
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║  ◆ CRYSTAL TX • BY ANH KHÔI                  ║');
    console.log('║  Admin: POST /_admin/login                   ║');
    console.log('║  Web HU: /_hu?_admin=TOKEN                   ║');
    console.log('║  Web MD5: /_md5?_admin=TOKEN                 ║');
    console.log('╚══════════════════════════════════════════════╝');
    startAuto();
});
