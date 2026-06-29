const express = require('express');
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

const PORT = process.env.PORT || 5000;

const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';

// ============================================================
// 🔐 ADMIN
// ============================================================
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = crypto.randomBytes(10).toString('hex');
const ADMIN_TOKENS = new Map();

console.log('\n╔══════════════════════════════════════════╗');
console.log('║  💎 CRYSTAL TX - THÔNG TIN              ║');
console.log(`║  👤 User: ${ADMIN_USERNAME}                          ║`);
console.log(`║  🔑 Pass: ${ADMIN_PASSWORD}                    ║`);
console.log('╚══════════════════════════════════════════╝\n');

const generateAdminToken = () => {
    const token = crypto.randomBytes(64).toString('hex');
    ADMIN_TOKENS.set(token, Date.now() + 86400000);
    setTimeout(() => ADMIN_TOKENS.delete(token), 86400000);
    return token;
};

const adminAuth = (req, res, next) => {
    const token = req.headers['x-admin-token'] || req.query['_token'] || req.query['_admin'];
    if (!token || !ADMIN_TOKENS.has(token)) {
        if (req.headers['accept']?.includes('application/json')) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        return res.redirect('/_login?error=unauthorized');
    }
    if (Date.now() > ADMIN_TOKENS.get(token)) {
        ADMIN_TOKENS.delete(token);
        if (req.headers['accept']?.includes('application/json')) {
            return res.status(403).json({ error: 'Token expired' });
        }
        return res.redirect('/_login?error=expired');
    }
    next();
};

// ============================================================
// 🛡️ BẢO MẬT
// ============================================================
const ipTracker = new Map();
const BLACKLIST = new Set();
const SUSPICIOUS = new Map();

app.use((req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    if (BLACKLIST.has(ip)) return res.status(403).end();
    
    const now = Date.now();
    if (!ipTracker.has(ip)) ipTracker.set(ip, []);
    const requests = ipTracker.get(ip).filter(t => now - t < 10000);
    if (requests.length > 40) {
        SUSPICIOUS.set(ip, (SUSPICIOUS.get(ip) || 0) + 1);
        if (SUSPICIOUS.get(ip) > 3) { BLACKLIST.add(ip); }
        return res.status(429).end();
    }
    requests.push(now);
    ipTracker.set(ip, requests);
    if (ipTracker.size > 10000) {
        const keys = Array.from(ipTracker.keys());
        for (let i = 0; i < 1000; i++) ipTracker.delete(keys[i]);
    }
    
    const ua = (req.get('User-Agent') || '').toLowerCase();
    const blockedUA = ['sqlmap','nikto','nmap','burp','acunetix','nessus','metasploit','hydra','gobuster','dirbuster','wpscan','zap','scanner','bot','crawler','spider'];
    if (blockedUA.some(b => ua.includes(b))) { BLACKLIST.add(ip); return res.status(403).end(); }
    
    const blockedPaths = ['/admin','/wp-admin','/phpmyadmin','/.env','/.git','/config','/backup','/login','/shell','/api','/graphql','/actuator','/swagger','/debug','/wp-login','/xmlrpc.php'];
    if (blockedPaths.some(b => req.path.toLowerCase().startsWith(b))) return res.status(404).end();
    
    if (req.query) {
        const dangerous = ['<','>','script','onerror','onload','javascript:','union','select','insert','update','delete','drop','exec','eval'];
        for (const [k,v] of Object.entries(req.query)) {
            if (dangerous.some(d => String(v).toLowerCase().includes(d))) return res.status(403).end();
        }
    }
    
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Server', '');
    next();
});

// ============================================================
// 🔐 MÃ HÓA
// ============================================================
const MK = crypto.createHash('sha512').update('crystal-tx-key-2024').digest();

function enc(text) {
    try {
        const iv = crypto.randomBytes(16);
        const c = crypto.createCipheriv('aes-256-gcm', MK.slice(0,32), iv);
        let e = c.update(String(text), 'utf8', 'hex');
        e += c.final('hex');
        const t = c.getAuthTag().toString('hex');
        return iv.toString('hex') + ':' + t + ':' + e;
    } catch(e) { return null; }
}

function dec(text) {
    try {
        const p = text.split(':');
        if(p.length !== 3) return null;
        const iv = Buffer.from(p[0], 'hex');
        const t = Buffer.from(p[1], 'hex');
        const d = crypto.createDecipheriv('aes-256-gcm', MK.slice(0,32), iv);
        d.setAuthTag(t);
        let r = d.update(p[2], 'hex', 'utf8');
        r += d.final('utf8');
        return r;
    } catch(e) { return null; }
}

// ============================================================
// 🧬 5 ENGINE DỰ ĐOÁN
// ============================================================

class SpectralEngine {
    constructor() { this.db = new Map(); }
    extract(seq) {
        const s = seq.map(v => v === 'T' ? 1 : -1);
        const f = [];
        for(const p of [2,3,5,8,13,21,34,55]) {
            if(s.length >= p) {
                let si=0,co=0;
                for(let i=0;i<p;i++) {
                    const a=2*Math.PI*i/p;
                    si+=s[s.length-p+i]*Math.sin(a);
                    co+=s[s.length-p+i]*Math.cos(a);
                }
                f.push(Math.sqrt(si*si+co*co)/p);
                f.push(Math.atan2(si,co)/Math.PI);
            }
        }
        while(f.length<16) f.push(0);
        return f;
    }
    train(data) {
        for(let i=60;i<data.length;i++) {
            const w=data.slice(i-60,i);
            const f=this.extract(w);
            const k=f.map(v=>Math.round(v*25)).join(',');
            if(!this.db.has(k)) this.db.set(k,{T:0,X:0,t:0});
            const d=this.db.get(k);
            d[data[i]]=(d[data[i]]||0)+1;
            d.t++;
        }
    }
    predict(seq) {
        if(seq.length<60) return null;
        const f=this.extract(seq.slice(-60));
        const k=f.map(v=>Math.round(v*25)).join(',');
        const d=this.db.get(k);
        if(!d||d.t<5) return null;
        return {prob:Math.max(0.08,Math.min(0.92,d.T/d.t)),conf:Math.min(0.95,d.t/150)};
    }
}

class GeometricEngine {
    constructor() { this.db = new Map(); }
    calcDim(seq) {
        const scales=[2,3,4,6,8,12,16,24];
        const pts=[];
        for(const sc of scales) {
            if(seq.length<sc) break;
            const s=new Set();
            for(let i=0;i<=seq.length-sc;i++) s.add(seq.slice(i,i+sc).join(''));
            pts.push({sc,ct:s.size});
        }
        if(pts.length<2) return 1;
        const n=pts.length;
        let sx=0,sy=0,sxy=0,sx2=0;
        for(const p of pts) {
            const x=Math.log(1/p.sc),y=Math.log(p.ct);
            sx+=x;sy+=y;sxy+=x*y;sx2+=x*x;
        }
        return (n*sxy-sx*sy)/(n*sx2-sx*sx+0.001);
    }
    train(data) {
        for(let i=50;i<data.length;i++) {
            const w=data.slice(i-50,i);
            const d=Math.round(this.calcDim(w)*20);
            const k=String(d);
            if(!this.db.has(k)) this.db.set(k,{T:0,X:0,t:0});
            const db=this.db.get(k);
            db[data[i]]=(db[data[i]]||0)+1;
            db.t++;
        }
    }
    predict(seq) {
        if(seq.length<50) return null;
        const d=Math.round(this.calcDim(seq.slice(-50))*20);
        const db=this.db.get(String(d));
        if(!db||db.t<5) return null;
        return {prob:Math.max(0.08,Math.min(0.92,db.T/db.t)),conf:Math.min(0.9,db.t/100)};
    }
}

class EntropyEngine {
    constructor() { this.db = new Map(); }
    calc(seq) {
        const wins=[3,5,8,13,21,34];
        const ents=[];
        for(const w of wins) {
            if(seq.length>=w) {
                const sl=seq.slice(-w);
                const p=sl.filter(s=>s==='T').length/w;
                let e=0;
                if(p>0&&p<1) e=-p*Math.log2(p)-(1-p)*Math.log2(1-p);
                ents.push(e);
            }
        }
        return {avg:ents.reduce((a,b)=>a+b,0)/(ents.length||1),vr:ents.length>1?Math.max(...ents)-Math.min(...ents):0};
    }
    train(data) {
        for(let i=50;i<data.length;i++) {
            const w=data.slice(i-50,i);
            const e=this.calc(w);
            const k=`${Math.round(e.avg*10)}|${Math.round(e.vr*10)}`;
            if(!this.db.has(k)) this.db.set(k,{T:0,X:0,t:0});
            const d=this.db.get(k);
            d[data[i]]=(d[data[i]]||0)+1;
            d.t++;
        }
    }
    predict(seq) {
        if(seq.length<50) return null;
        const e=this.calc(seq.slice(-50));
        const k=`${Math.round(e.avg*10)}|${Math.round(e.vr*10)}`;
        const d=this.db.get(k);
        if(!d||d.t<5) return null;
        return {prob:Math.max(0.08,Math.min(0.92,d.T/d.t)),conf:Math.min(0.9,d.t/90)};
    }
}

class MomentumEngine {
    constructor() { this.db = new Map(); }
    calc(seq) {
        const r3=seq.slice(-3).filter(s=>s==='T').length/3;
        const r8=seq.slice(-8).filter(s=>s==='T').length/8;
        const r21=seq.slice(-21).filter(s=>s==='T').length/21;
        return {sh:r3-r8,md:r8-r21};
    }
    train(data) {
        for(let i=45;i<data.length;i++) {
            const w=data.slice(i-45,i);
            const m=this.calc(w);
            const k=`${Math.round(m.sh*10)}|${Math.round(m.md*10)}`;
            if(!this.db.has(k)) this.db.set(k,{T:0,X:0,t:0});
            const d=this.db.get(k);
            d[data[i]]=(d[data[i]]||0)+1;
            d.t++;
        }
    }
    predict(seq) {
        if(seq.length<45) return null;
        const m=this.calc(seq.slice(-45));
        const k=`${Math.round(m.sh*10)}|${Math.round(m.md*10)}`;
        const d=this.db.get(k);
        if(!d||d.t<5) return null;
        return {prob:Math.max(0.08,Math.min(0.92,d.T/d.t)),conf:Math.min(0.9,d.t/80)};
    }
}

class PatternEngine {
    constructor() { this.db = new Map(); }
    train(data) {
        for(let i=20;i<data.length;i++) {
            const w=data.slice(i-20,i);
            for(const len of[3,5,8,13]) {
                if(w.length>=len) {
                    const p=w.slice(-len).join('');
                    if(!this.db.has(p)) this.db.set(p,{T:0,X:0,t:0});
                    const d=this.db.get(p);
                    d[data[i]]=(d[data[i]]||0)+1;
                    d.t++;
                }
            }
        }
    }
    predict(seq) {
        let ps=0,ws=0;
        for(const len of[3,5,8,13]) {
            if(seq.length>=len) {
                const p=seq.slice(-len).join('');
                const d=this.db.get(p);
                if(d&&d.t>=5) { const w=len; ps+=(d.T/d.t)*w; ws+=w; }
            }
        }
        if(ws===0) return null;
        return {prob:Math.max(0.08,Math.min(0.92,ps/ws)),conf:Math.min(0.85,ws/50)};
    }
}

// ============================================================
// 🧠 HỆ THỐNG DỰ ĐOÁN
// ============================================================

class PredictionCore {
    constructor(type) {
        this.type = type;
        this.history = [];
        this.stats = { total: 0, dung: 0, sai: 0, tyle: 0, chuoi: 0, chuoi_dai: 0, homnay: { dung: 0, sai: 0, tong: 0 } };
        this.lastPhien = null;
        this.trained = false;
        
        this.engines = [
            { name: 'SP', e: new SpectralEngine(), w: 3.5 },
            { name: 'GE', e: new GeometricEngine(), w: 2.8 },
            { name: 'EN', e: new EntropyEngine(), w: 2.5 },
            { name: 'MO', e: new MomentumEngine(), w: 2.2 },
            { name: 'PA', e: new PatternEngine(), w: 2.0 }
        ];
    }
    
    train(data) {
        if(data.length < 60) return false;
        try { for(const eng of this.engines) eng.e.train(data); this.trained=true; return true; } catch(e) { return false; }
    }
    
    predict(data) {
        if(!data||data.length<10) return this.fb();
        const seq = data.map(d => d==='T'?'T':'X');
        let sT=0,sX=0,sw=0;
        const dt=[];
        
        for(const eng of this.engines) {
            try {
                const r = eng.e.predict(seq);
                if(r) { const w=eng.w*r.conf; sT+=r.prob*w; sX+=(1-r.prob)*w; sw+=w; dt.push(`${eng.name}:${Math.round(r.prob*100)}`); }
            } catch(e) {}
        }
        
        const last = seq[seq.length-1];
        let streak = 1;
        for(let j=seq.length-2;j>=0&&seq[j]===last;j--) streak++;
        if(streak>=10) { if(last==='T') { sX+=4; dt.push('BRK-T'); } else { sT+=4; dt.push('BRK-X'); } sw+=4; }
        else if(streak>=7) { if(last==='T') { sX+=3; dt.push('HI-T'); } else { sT+=3; dt.push('HI-X'); } sw+=3; }
        else if(streak>=5) { if(last==='T') { sX+=2; dt.push('MD-T'); } else { sT+=2; dt.push('MD-X'); } sw+=2; }
        
        const lt = seq.filter(s=>s==='T').length/seq.length;
        if(lt>0.7) { sX+=3; dt.push('BAL+'); sw+=3; }
        else if(lt<0.3) { sT+=3; dt.push('BAL-'); sw+=3; }
        
        if(sw===0) return this.fb();
        const prob = sT/(sT+sX);
        const dd = prob>0.5?'TÀI':'XỈU';
        let tc = Math.round(Math.max(prob,1-prob)*100);
        if(dt.length>=4) tc=Math.min(99,tc+6);
        tc=Math.min(99,Math.max(55,tc));
        
        return {duDoan:dd,doTinCay:tc,chiTiet:dt.join(' | '),soMau:dt.length};
    }
    
    fb() {
        if(this.stats.total>50) return {duDoan:this.stats.dung>this.stats.sai?'TÀI':'XỈU',doTinCay:52,chiTiet:'TREND',soMau:0};
        return {duDoan:'TÀI',doTinCay:51,chiTiet:'INIT',soMau:0};
    }
    
    update(prediction, actual) {
        const pr=prediction==='TÀI'?'T':'X';
        const ac=actual==='TÀI'?'T':'X';
        const ok=pr===ac;
        this.stats.total++;
        if(ok) { this.stats.dung++; this.stats.chuoi=this.stats.chuoi>=0?this.stats.chuoi+1:1; if(this.stats.chuoi>this.stats.chuoi_dai) this.stats.chuoi_dai=this.stats.chuoi; this.stats.homnay.dung++; }
        else { this.stats.sai++; this.stats.chuoi=this.stats.chuoi<=0?this.stats.chuoi-1:-1; this.stats.homnay.sai++; }
        this.stats.homnay.tong++;
        this.stats.tyle=this.stats.total>0?Math.round((this.stats.dung/this.stats.total)*100):0;
    }
    
    save() {
        try {
            const d=enc(JSON.stringify({history:this.history.slice(0,2000),stats:this.stats,lastPhien:this.lastPhien,trained:this.trained}));
            if(d) fs.writeFileSync(`.${this.type}_core`,d);
        } catch(e) {}
    }
    
    load() {
        try {
            const f=`.${this.type}_core`;
            if(fs.existsSync(f)) {
                const d=dec(fs.readFileSync(f,'utf8'));
                if(d) { const p=JSON.parse(d); if(p.history) this.history=p.history; if(p.stats) this.stats=p.stats; if(p.lastPhien) this.lastPhien=p.lastPhien; if(p.trained) this.trained=p.trained; }
            }
        } catch(e) {}
    }
}

const brainHU = new PredictionCore('hu');
const brainMD5 = new PredictionCore('md5');
brainHU.load();
brainMD5.load();

// ============================================================
// 📊 DATA
// ============================================================
function transformData(d) {
    if(!d||!d.list) return null;
    return d.list.map(i=>({phien:i.id,result:i.resultTruyenThong==='TAI'?'TÀI':'XỈU',dice1:i.dices[0],dice2:i.dices[1],dice3:i.dices[2],total:i.point}));
}

async function fetchData(t) {
    try {
        const u=t==='hu'?API_URL_HU:API_URL_MD5;
        const r=await axios.get(u,{timeout:8000,headers:{'User-Agent':'CrystalTX/7.0'}});
        return transformData(r.data);
    } catch(e) { return null; }
}

// ============================================================
// ⚡ AUTO
// ============================================================
async function processGame(brain, type) {
    try {
        const data=await fetchData(type);
        if(!data||data.length===0) return;
        const cur=data[0].phien;
        if(brain.lastPhien===cur) return;
        
        for(const r of brain.history) {
            if(r.status&&r.status!=='') continue;
            const a=data.find(d=>d.phien.toString()===r.phien_hien_tai);
            if(a) { r.status=(r.prediction===a.result)?'✅':'❌'; r.actual=a.result; brain.update(r.prediction,a.result); }
        }
        
        const ex=brain.history.find(h=>h.phien_hien_tai===(cur+1).toString());
        if(ex) return;
        
        const hd=data.map(d=>d.result==='TÀI'?'T':'X');
        if(hd.length>=60) brain.train(hd);
        
        const result=brain.predict(hd);
        const rec={phien:data[0].phien,phien_hien_tai:(data[0].phien+1).toString(),dice:`${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`,total:data[0].total,actual:data[0].result,prediction:result.duDoan,confidence:result.doTinCay,detail:result.chiTiet,status:'',timestamp:new Date().toISOString(),soMau:result.soMau||0};
        brain.history.unshift(rec);
        if(brain.history.length>2000) brain.history=brain.history.slice(0,2000);
        brain.lastPhien=cur;
        brain.save();
    } catch(e) {}
}

async function autoProcess() {
    await Promise.all([processGame(brainHU,'hu'),processGame(brainMD5,'md5')]);
}

function startAuto() {
    setTimeout(autoProcess,3000);
    setInterval(autoProcess,5000);
}

// ============================================================
// 🎨 GIAO DIỆN - ĐẢM BẢO KHÔNG TRANG TRẮNG
// ============================================================

const CSS_FRAMEWORK = `
:root {
    --bg: #020617; --bg2: #0a0f24; --bg3: #111832; --bg4: #1a2040;
    --border: rgba(255,255,255,0.04); --border-active: rgba(123,97,255,0.3);
    --text: #e2e8f0; --text2: #8899b8; --text3: #4a5578;
    --gradient: linear-gradient(135deg, #7b61ff 0%, #3b82f6 30%, #06b6d4 60%, #8b5cf6 100%);
    --success: #22c55e; --danger: #ef4444; --warning: #f59e0b; --info: #06b6d4; --purple: #7b61ff;
}
*{margin:0;padding:0;box-sizing:border-box}
body{
    font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);
    min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased;
    -webkit-user-select:none;user-select:none;
}
.bg-orbs{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none}
.bg-orbs .o1{position:absolute;width:600px;height:600px;background:rgba(123,97,255,0.08);border-radius:50%;filter:blur(140px);top:-200px;left:-100px;animation:o1 20s infinite}
.bg-orbs .o2{position:absolute;width:500px;height:500px;background:rgba(6,182,212,0.06);border-radius:50%;filter:blur(140px);bottom:-150px;right:-80px;animation:o2 25s infinite}
@keyframes o1{0%,100%{transform:translate(0,0)}50%{transform:translate(80px,50px)}}
@keyframes o2{0%,100%{transform:translate(0,0)}50%{transform:translate(-60px,-30px)}}
.grid-bg{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;
    background-image:linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px);
    background-size:50px 50px;mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 10%,transparent 70%)}
.app{position:relative;z-index:1;max-width:1300px;margin:0 auto;padding:16px 20px}
.glass{background:rgba(17,24,50,0.6);backdrop-filter:blur(20px);border:1px solid var(--border);border-radius:16px}
.btn-primary{display:inline-flex;align-items:center;gap:8px;padding:12px 24px;background:var(--gradient);border:none;border-radius:10px;color:#fff;font-weight:600;font-size:13px;cursor:pointer;letter-spacing:0.5px;transition:all 0.3s}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(123,97,255,0.3)}
input[type="text"],input[type="password"]{width:100%;padding:12px 16px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;font-family:'JetBrains Mono',monospace;outline:none;transition:all 0.3s}
input:focus{border-color:var(--border-active);box-shadow:0 0 0 3px rgba(123,97,255,0.1)}
.badge{display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:16px;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:1px}
.badge-ok{background:rgba(34,197,94,0.08);color:var(--success);border:1px solid rgba(34,197,94,0.15)}
.badge-info{background:rgba(6,182,212,0.08);color:var(--info);border:1px solid rgba(6,182,212,0.15)}
.badge-purple{background:rgba(123,97,255,0.08);color:var(--purple);border:1px solid rgba(123,97,255,0.15)}
.pulse{width:7px;height:7px;border-radius:50%;background:var(--success);animation:pulse 1.5s infinite;box-shadow:0 0 10px rgba(34,197,94,0.4);display:inline-block}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.text-grad{background:var(--gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.05);border-radius:2px}`;

function loginPage(errorMsg) {
    const err = errorMsg ? `<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);padding:14px;border-radius:10px;color:#ef4444;font-size:13px;margin-bottom:16px;text-align:center;animation:fadeIn 0.3s">⚠️ ${errorMsg}</div>` : '';
    
    return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
    <title>CRYSTAL TX | Admin</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;800;900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>${CSS_FRAMEWORK}</style>
</head>
<body>
<div class="bg-orbs"><div class="o1"></div><div class="o2"></div></div>
<div class="grid-bg"></div>
<div class="app" style="display:flex;align-items:center;justify-content:center;min-height:100vh">
    <div class="glass" style="width:100%;max-width:440px;padding:40px 32px;animation:slideUp 0.5s ease-out">
        <div style="text-align:center;margin-bottom:28px">
            <div style="font-size:48px;animation:float 3s ease-in-out infinite;display:inline-block">💎</div>
            <h1 style="font-family:'Orbitron',sans-serif;font-size:26px;font-weight:900;margin-top:8px"><span class="text-grad">CRYSTAL TX</span></h1>
            <p style="font-size:9px;color:var(--text3);font-family:'JetBrains Mono',monospace;letter-spacing:2px;text-transform:uppercase;margin-top:4px">Admin Console • v70.0</p>
        </div>
        ${err}
        <form onsubmit="doLogin(event)">
            <div style="margin-bottom:14px">
                <label style="display:block;font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;font-weight:600">👤 Username</label>
                <input type="text" id="u" placeholder="admin" autocomplete="off" required>
            </div>
            <div style="margin-bottom:20px">
                <label style="display:block;font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;font-weight:600">🔒 Password</label>
                <input type="password" id="p" placeholder="••••••••" autocomplete="off" required>
            </div>
            <button type="submit" class="btn-primary" style="width:100%;justify-content:center;font-size:14px">🔐 Đăng Nhập</button>
        </form>
        <div id="result" style="margin-top:20px"></div>
        <div style="text-align:center;margin-top:20px;padding-top:16px;border-top:1px solid var(--border);font-size:8px;color:var(--text3);font-family:'JetBrains Mono',monospace">💎 CRYSTAL TX • By Anh Khôi</div>
    </div>
</div>
<script>
async function doLogin(e){
    e.preventDefault();
    const u=document.getElementById('u').value.trim();
    const p=document.getElementById('p').value.trim();
    const r=document.getElementById('result');
    if(!u||!p){r.innerHTML='<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);padding:14px;border-radius:10px;color:#ef4444;font-size:13px;animation:fadeIn 0.3s">⚠️ Vui lòng nhập đầy đủ</div>';return;}
    r.innerHTML='<div style="background:rgba(6,182,212,0.08);border:1px solid rgba(6,182,212,0.2);padding:14px;border-radius:10px;color:#06b6d4;font-size:13px;animation:fadeIn 0.3s">⏳ Đang xác thực...</div>';
    try{
        const res=await fetch('/_api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});
        const d=await res.json();
        if(res.ok&&d.token){
            r.innerHTML='<div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);padding:14px;border-radius:10px;color:#22c55e;font-size:13px;margin-bottom:16px;animation:fadeIn 0.3s">✅ Đăng nhập thành công!</div>'+
            '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:16px">'+
            '<p style="font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">🔑 Token (24h)</p>'+
            '<div style="font-family:\'JetBrains Mono\',monospace;font-size:11px;color:var(--success);word-break:break-all;background:var(--bg);padding:10px;border-radius:6px;margin-bottom:12px">'+d.token+'</div>'+
            '<p style="font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">📡 Truy Cập</p>'+
            '<a href="/_hu?_token='+d.token+'" style="display:block;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--info);text-decoration:none;font-size:11px;font-family:\'JetBrains Mono\',monospace;margin-bottom:6px">📊 Dashboard HU →</a>'+
            '<a href="/_md5?_token='+d.token+'" style="display:block;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--info);text-decoration:none;font-size:11px;font-family:\'JetBrains Mono\',monospace;margin-bottom:6px">📊 Dashboard MD5 →</a>'+
            '<a href="/_hu/json?_token='+d.token+'" style="display:block;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--purple);text-decoration:none;font-size:11px;font-family:\'JetBrains Mono\',monospace">📡 JSON API HU →</a>'+
            '<a href="/_md5/json?_token='+d.token+'" style="display:block;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--purple);text-decoration:none;font-size:11px;font-family:\'JetBrains Mono\',monospace;margin-top:6px">📡 JSON API MD5 →</a>'+
            '</div>';
        }else{r.innerHTML='<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);padding:14px;border-radius:10px;color:#ef4444;font-size:13px;animation:fadeIn 0.3s">❌ '+(d.error||'Sai thông tin')+'</div>';}
    }catch(ex){r.innerHTML='<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);padding:14px;border-radius:10px;color:#ef4444;font-size:13px;animation:fadeIn 0.3s">🔌 Lỗi kết nối</div>';}
}
</script>
</body></html>`;
}

function dashboardPage(brain, type) {
    const s = brain.stats;
    const all = (brain.history || []);
    const recent = all.slice(0, 50);
    const all1000 = all.slice(0, 1000);
    
    let td50=0,ts50=0,ch50=0,cd50=0,ct50=0;
    for(const r of recent) {
        if(r.status==='✅'){td50++;ct50++;if(ct50>cd50)cd50=ct50;}
        else if(r.status==='❌'){ts50++;ct50=0;}
    }
    ch50=ct50;
    
    let td1000=0,ts1000=0;
    for(const r of all1000){if(r.status==='✅')td1000++;else if(r.status==='❌')ts1000++;}
    const wr1000=all1000.length>0?Math.round((td1000/(td1000+ts1000||1))*100):0;
    
    const wr=s.tyle;
    const wc=wr>=70?'var(--success)':wr>=60?'var(--warning)':'var(--danger)';
    
    let rows50='';
    for(const r of recent){
        const st=r.status||'⏳';
        const cls=st==='✅'?'s':st==='❌'?'d':'w';
        const txt=st==='✅'?'WIN':st==='❌'?'LOSE':'WAIT';
        rows50+=`<tr class="r-${cls}"><td class="mono">#${r.phien_hien_tai||'-'}</td><td><span class="pred pred-${r.prediction==='TÀI'?'t':'x'}">${r.prediction||'-'}</span></td><td><div class="cb"><div class="cf" style="width:${r.confidence||0}%"></div></div><span class="ct">${r.confidence||0}%</span></td><td><span class="st st-${cls}">${txt}</span></td><td>${r.actual||'-'}</td><td class="dt">${(r.detail||'-').substring(0,28)}</td></tr>`;
    }
    
    let dots1000='';
    for(const r of all1000){
        const st=r.status||'⏳';
        const cls=st==='✅'?'s':st==='❌'?'d':'w';
        const txt=st==='✅'?'W':st==='❌'?'L':'?';
        dots1000+=`<span class="dot dot-${cls}" title="#${r.phien_hien_tai}: ${r.prediction} → ${r.actual||'?'}">${txt}</span>`;
    }
    
    return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
    <title>${type.toUpperCase()} | CRYSTAL TX</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;800;900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        ${CSS_FRAMEWORK}
        .stat-card{background:rgba(17,24,50,0.6);backdrop-filter:blur(20px);border:1px solid var(--border);border-radius:16px;padding:18px 20px;transition:all 0.3s}
        .stat-card:hover{border-color:var(--border-active);transform:translateY(-2px);box-shadow:0 10px 30px rgba(0,0,0,0.3)}
        .stat-card .l{font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600}
        .stat-card .v{font-family:'Orbitron',monospace;font-size:30px;font-weight:800}
        .stat-card .s{font-size:9px;color:var(--text2);margin-top:4px}
        .dot{width:18px;height:18px;border-radius:3px;font-size:7px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;font-family:'JetBrains Mono',monospace;margin:1px}
        .dot-s{background:rgba(34,197,94,0.15);color:var(--success);border:1px solid rgba(34,197,94,0.2)}
        .dot-d{background:rgba(239,68,68,0.15);color:var(--danger);border:1px solid rgba(239,68,68,0.2)}
        .dot-w{background:rgba(245,158,11,0.15);color:var(--warning);border:1px solid rgba(245,158,11,0.2)}
        .dot:hover{transform:scale(1.4);z-index:2}
        table{width:100%;border-collapse:collapse;font-size:10px}
        th{background:rgba(255,255,255,0.015);padding:9px 12px;text-align:left;font-weight:600;font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text3);border-bottom:1px solid var(--border)}
        td{padding:7px 12px;border-bottom:1px solid rgba(255,255,255,0.012)}
        tr:hover td{background:rgba(255,255,255,0.008)}
        .r-s{border-left:2px solid transparent}.r-s:hover{border-left-color:rgba(34,197,94,0.3)}
        .r-d{border-left:2px solid transparent}.r-d:hover{border-left-color:rgba(239,68,68,0.3)}
        .r-w{border-left:2px solid transparent}.r-w:hover{border-left-color:rgba(245,158,11,0.3)}
        .mono{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text2)}
        .pred{display:inline-block;padding:3px 10px;border-radius:6px;font-weight:700;font-size:9px}
        .pred-t{background:rgba(34,197,94,0.08);color:var(--success)}
        .pred-x{background:rgba(239,68,68,0.08);color:var(--danger)}
        .cb{display:inline-block;width:45px;height:3px;background:rgba(255,255,255,0.05);border-radius:2px;vertical-align:middle;margin-right:6px}
        .cf{height:100%;border-radius:2px;background:var(--gradient)}
        .ct{font-weight:600;color:var(--info);font-size:9px}
        .st{display:inline-block;padding:2px 8px;border-radius:4px;font-weight:700;font-size:7px;text-transform:uppercase;letter-spacing:1px}
        .st-s{background:rgba(34,197,94,0.08);color:var(--success)}
        .st-d{background:rgba(239,68,68,0.08);color:var(--danger)}
        .st-w{background:rgba(245,158,11,0.08);color:var(--warning)}
        .dt{font-size:8px;color:var(--text3);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        @media(max-width:768px){.stat-card .v{font-size:22px}}
    </style>
</head>
<body>
<div class="bg-orbs"><div class="o1"></div><div class="o2"></div></div>
<div class="grid-bg"></div>
<div class="app">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:12px">
            <div style="font-size:36px;animation:float 3s ease-in-out infinite">💎</div>
            <div>
                <h1 style="font-family:'Orbitron',sans-serif;font-size:22px;font-weight:900"><span class="text-grad">CRYSTAL TX</span></h1>
                <p style="font-size:9px;color:var(--text3);font-family:'JetBrains Mono',monospace;letter-spacing:2px">${type.toUpperCase()} • v70.0 • By Anh Khôi</p>
            </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
            <div class="badge badge-ok"><span class="pulse"></span>LIVE</div>
            <div class="badge badge-purple">5 ENGINES</div>
        </div>
    </div>
    
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
        <div class="stat-card"><div class="l">📊 Tổng</div><div class="v" style="color:var(--text)">${s.total}</div><div class="s">Dự đoán</div></div>
        <div class="stat-card"><div class="l">✅ Đúng</div><div class="v" style="color:var(--success)">${s.dung}</div><div class="s">${s.tyle}%</div></div>
        <div class="stat-card"><div class="l">⚡ Chuỗi</div><div class="v" style="color:${s.chuoi>0?'var(--success)':'var(--danger)'}">${s.chuoi>0?'+'+s.chuoi:s.chuoi}</div><div class="s">Kỷ lục: ${s.chuoi_dai}</div></div>
        <div class="stat-card"><div class="l">📈 1000 Phiên</div><div class="v" style="color:${wr1000>=70?'var(--success)':wr1000>=60?'var(--warning)':'var(--danger)'}">${wr1000}%</div><div class="s">${td1000}W / ${ts1000}L</div></div>
    </div>
    
    <div class="glass" style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:8px">
            <h3 style="font-family:'Orbitron',monospace;font-size:12px;font-weight:600">📜 Lịch Sử ${all1000.length} Phiên</h3>
            <span class="badge badge-info">${td1000}W / ${ts1000}L</span>
        </div>
        <div style="padding:14px;max-height:300px;overflow-y:auto;line-height:1.8">${dots1000||'Đang tải...'}</div>
    </div>
    
    <div class="glass">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:8px">
            <h3 style="font-family:'Orbitron',monospace;font-size:12px;font-weight:600">📋 50 Phiên Gần Nhất</h3>
            <span class="badge badge-purple">5 Engines</span>
        </div>
        <div style="overflow-x:auto">
            <table><thead><tr><th>Phiên</th><th>Dự Đoán</th><th>Độ Tin</th><th>KQ</th><th>Thực Tế</th><th>Engines</th></tr></thead>
            <tbody>${rows50||'<tr><td colspan="6" style="text-align:center;padding:20px">Đang tải...</td></tr>'}</tbody></table>
        </div>
    </div>
    
    <div style="text-align:center;padding:12px;font-size:8px;color:var(--text3);font-family:'JetBrains Mono',monospace;margin-top:12px">💎 CRYSTAL TX • SP • GE • EN • MO • PA • By Anh Khôi • ${new Date().toLocaleString('vi-VN')}</div>
</div>
<script>setTimeout(()=>location.reload(),5000);</script>
</body></html>`;
}

// ============================================================
// 🔌 API
// ============================================================

app.get('/_login', (req, res) => {
    const err = req.query.error === 'unauthorized' ? 'Bạn cần đăng nhập để truy cập' : req.query.error === 'expired' ? 'Token đã hết hạn' : '';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(loginPage(err));
});

app.get('/', (req, res) => res.redirect('/_login'));

app.post('/_api/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Thiếu thông tin' });
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = generateAdminToken();
        return res.json({ token, expires: Date.now() + 86400000 });
    }
    return res.status(401).json({ error: 'Sai username hoặc password' });
});

app.get('/_hu', adminAuth, async (req, res) => {
    const data = await fetchData('hu');
    if (data) {
        for (const r of brainHU.history) {
            if (r.status && r.status !== '') continue;
            const a = data.find(d => d.phien.toString() === r.phien_hien_tai);
            if (a) { r.status = (r.prediction === a.result) ? '✅' : '❌'; r.actual = a.result; brainHU.update(r.prediction, a.result); }
        }
        brainHU.save();
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(dashboardPage(brainHU, 'hu'));
});

app.get('/_md5', adminAuth, async (req, res) => {
    const data = await fetchData('md5');
    if (data) {
        for (const r of brainMD5.history) {
            if (r.status && r.status !== '') continue;
            const a = data.find(d => d.phien.toString() === r.phien_hien_tai);
            if (a) { r.status = (r.prediction === a.result) ? '✅' : '❌'; r.actual = a.result; brainMD5.update(r.prediction, a.result); }
        }
        brainMD5.save();
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(dashboardPage(brainMD5, 'md5'));
});

app.get('/_hu/json', adminAuth, async (req, res) => {
    try {
        const data = await fetchData('hu');
        if (!data || data.length === 0) { const r = brainHU.fb(); return res.json({ prediction: r.duDoan, confidence: r.doTinCay, detail: r.chiTiet }); }
        const exist = brainHU.history.find(h => h.phien_hien_tai === (data[0].phien + 1).toString());
        if (exist) return res.json(exist);
        const hd = data.map(d => d.result === 'TÀI' ? 'T' : 'X');
        if (hd.length >= 60) brainHU.train(hd);
        const result = brainHU.predict(hd);
        const rec = { phien: data[0].phien, phien_hien_tai: (data[0].phien + 1).toString(), dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`, total: data[0].total, actual: data[0].result, prediction: result.duDoan, confidence: result.doTinCay, detail: result.chiTiet, status: '', timestamp: new Date().toISOString(), soMau: result.soMau || 0 };
        brainHU.history.unshift(rec);
        if (brainHU.history.length > 2000) brainHU.history = brainHU.history.slice(0, 2000);
        brainHU.save();
        res.json(rec);
    } catch (e) { res.status(500).json({ error: 'Lỗi' }); }
});

app.get('/_md5/json', adminAuth, async (req, res) => {
    try {
        const data = await fetchData('md5');
        if (!data || data.length === 0) { const r = brainMD5.fb(); return res.json({ prediction: r.duDoan, confidence: r.doTinCay, detail: r.chiTiet }); }
        const exist = brainMD5.history.find(h => h.phien_hien_tai === (data[0].phien + 1).toString());
        if (exist) return res.json(exist);
        const hd = data.map(d => d.result === 'TÀI' ? 'T' : 'X');
        if (hd.length >= 60) brainMD5.train(hd);
        const result = brainMD5.predict(hd);
        const rec = { phien: data[0].phien, phien_hien_tai: (data[0].phien + 1).toString(), dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`, total: data[0].total, actual: data[0].result, prediction: result.duDoan, confidence: result.doTinCay, detail: result.chiTiet, status: '', timestamp: new Date().toISOString(), soMau: result.soMau || 0 };
        brainMD5.history.unshift(rec);
        if (brainMD5.history.length > 2000) brainMD5.history = brainMD5.history.slice(0, 2000);
        brainMD5.save();
        res.json(rec);
    } catch (e) { res.status(500).json({ error: 'Lỗi' }); }
});

app.get('/_stats', adminAuth, (req, res) => {
    const total = brainHU.stats.total + brainMD5.stats.total;
    const dung = brainHU.stats.dung + brainMD5.stats.dung;
    res.json({ hu: brainHU.stats, md5: brainMD5.stats, combined: { total, dung, sai: total - dung, tyle: total > 0 ? Math.round((dung / total) * 100) : 0 } });
});

app.get('/_reset', adminAuth, (req, res) => {
    ['hu', 'md5'].forEach(type => {
        const brain = type === 'hu' ? brainHU : brainMD5;
        brain.stats = { total: 0, dung: 0, sai: 0, tyle: 0, chuoi: 0, chuoi_dai: 0, homnay: { dung: 0, sai: 0, tong: 0 } };
        brain.history = []; brain.lastPhien = null; brain.save();
    });
    res.json({ message: 'Done' });
});

app.use((req, res) => res.status(404).end());
app.use((err, req, res, next) => { res.status(500).end(); });

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ CRYSTAL TX v70.0 chạy trên cổng ${PORT}`);
    startAuto();
});
