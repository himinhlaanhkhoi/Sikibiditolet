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
// ADMIN
// ============================================================
const USERS_FILE = '.users_db';
const ADMIN_USER = 'admin';
const ADMIN_PASS = crypto.randomBytes(8).toString('hex');
const TOKENS = new Map();
let users = {};

try {
    if (fs.existsSync(USERS_FILE)) {
        const d = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        users = d.users || {};
    } else {
        fs.writeFileSync(USERS_FILE, JSON.stringify({ users }));
    }
} catch(e) {
    users = {};
    try { fs.writeFileSync(USERS_FILE, JSON.stringify({ users })); } catch(e) {}
}

function saveUsers() {
    try { fs.writeFileSync(USERS_FILE, JSON.stringify({ users })); } catch(e) {}
}

console.log('\n╔══════════════════════════════════════╗');
console.log('║  💎 CRYSTAL TX                       ║');
console.log('╠══════════════════════════════════════╣');
console.log(`║  Admin: ${ADMIN_USER}                       ║`);
console.log(`║  Pass:  ${ADMIN_PASS}                ║`);
console.log('║  Link:  /_login                     ║');
console.log('╚══════════════════════════════════════╝\n');

function createToken(username, role) {
    for (const [k, v] of TOKENS) {
        if (v.username === username) TOKENS.delete(k);
    }
    const token = crypto.randomBytes(48).toString('hex');
    const expires = role === 'admin' ? Date.now() + 864000000 : (users[username]?.expires || Date.now() + 86400000);
    TOKENS.set(token, { username, role, expires });
    setTimeout(() => TOKENS.delete(token), expires - Date.now());
    return { token, expires };
}

const checkAuth = (req, res, next) => {
    const token = req.query['_token'] || req.query['_admin'] || req.headers['x-token'];
    if (!token || !TOKENS.has(token)) return res.redirect('/_login?error=unauthorized');
    const session = TOKENS.get(token);
    if (Date.now() > session.expires) { TOKENS.delete(token); return res.redirect('/_login?error=expired'); }
    req.session = session;
    next();
};

const checkAdmin = (req, res, next) => {
    if (!req.session || req.session.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    next();
};

// ============================================================
// BẢO MẬT
// ============================================================
const ipMap = new Map();
const BLOCKED = new Set();

app.use((req, res, next) => {
    const ip = req.ip || 'unknown';
    const pub = ['/_login', '/_api/login', '/'];
    if (!pub.includes(req.path)) {
        if (BLOCKED.has(ip)) return res.status(403).end();
        const now = Date.now();
        if (!ipMap.has(ip)) ipMap.set(ip, []);
        const reqs = ipMap.get(ip).filter(t => now - t < 10000);
        if (reqs.length > 50) { BLOCKED.add(ip); return res.status(429).end(); }
        reqs.push(now);
        ipMap.set(ip, reqs);
    }
    const ua = (req.get('User-Agent') || '').toLowerCase();
    if (['sqlmap','nikto','nmap','burp','acunetix','nessus','metasploit','hydra','gobuster','dirbuster'].some(b => ua.includes(b))) {
        BLOCKED.add(ip); return res.status(403).end();
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Server', '');
    next();
});

// ============================================================
// 10+ THUẬT TOÁN SIÊU THÔNG MINH
// ============================================================

class QuantumSpectralEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    
    extract(seq) {
        const s = seq.map(v => v === 'T' ? 1 : -1);
        const f = [];
        for (const p of [2, 3, 5, 8, 13, 21, 34, 55]) {
            if (s.length >= p) {
                let si = 0, co = 0;
                for (let i = 0; i < p; i++) {
                    const a = 2 * Math.PI * i / p;
                    si += s[s.length - p + i] * Math.sin(a);
                    co += s[s.length - p + i] * Math.cos(a);
                }
                f.push(Math.sqrt(si*si+co*co)/p);
                f.push(Math.atan2(si,co)/Math.PI);
            }
        }
        while (f.length < 16) f.push(0);
        return f;
    }
    
    train(data) {
        for (let i = 50; i < data.length; i++) {
            const w = data.slice(i-50, i);
            const f = this.extract(w);
            const k = f.map(v => Math.round(v*25)).join(',');
            if (!this.db.has(k)) this.db.set(k, {T:0,X:0,t:0});
            const d = this.db.get(k);
            d[data[i]] = (d[data[i]]||0) + 1;
            d.t++;
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 50) return null;
        const f = this.extract(seq.slice(-50));
        const k = f.map(v => Math.round(v*25)).join(',');
        const d = this.db.get(k);
        if (!d || d.t < 5) {
            let best = null, bd = Infinity;
            for (const [key, val] of this.db) {
                if (val.t < 10) continue;
                const parts = key.split(',').map(Number);
                const fp = f.map(v => Math.round(v*25));
                let dist = 0;
                for (let i=0; i<Math.min(parts.length, fp.length); i++) dist += Math.abs(parts[i]-fp[i]);
                if (dist < bd) { bd = dist; best = val; }
            }
            if (best) return { prob: best.T/best.t, conf: 0.5 };
            return null;
        }
        return { prob: Math.max(0.08, Math.min(0.92, d.T/d.t)), conf: Math.min(0.95, d.t/120) };
    }
}

class BayesianMetaEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    
    train(data) {
        for (let i = 40; i < data.length; i++) {
            const w = data.slice(i-40, i);
            const k = w.slice(-6).join('');
            if (!this.db.has(k)) this.db.set(k, {T:1,X:1,t:2});
            const d = this.db.get(k);
            d[data[i]] = (d[data[i]]||0) + 1;
            d.t++;
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 40) return null;
        const k = seq.slice(-6).join('');
        const d = this.db.get(k);
        if (!d || d.t < 5) return null;
        return { prob: Math.max(0.08, Math.min(0.92, d.T/d.t)), conf: Math.min(0.9, d.t/60) };
    }
}

class PatternFingerprintEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    
    fp(seq) {
        const t = seq.filter(s => s==='T').length;
        const c = seq.filter((s,i,a) => i>0 && s!==a[i-1]).length;
        let max = 0, cur = 1;
        for (let i=1; i<seq.length; i++) {
            if (seq[i]===seq[i-1]) { cur++; if (cur>max) max=cur; }
            else cur = 1;
        }
        return `${seq.length}|${t}|${c}|${max}`;
    }
    
    train(data) {
        for (let i = 25; i < data.length; i++) {
            const w = data.slice(i-25, i);
            const f = this.fp(w.slice(-12));
            if (!this.db.has(f)) this.db.set(f, {T:0,X:0,t:0});
            const d = this.db.get(f);
            d[data[i]] = (d[data[i]]||0) + 1;
            d.t++;
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 25) return null;
        const f = this.fp(seq.slice(-12));
        const d = this.db.get(f);
        if (!d || d.t < 3) return null;
        return { prob: Math.max(0.08, Math.min(0.92, d.T/d.t)), conf: Math.min(0.9, d.t/40) };
    }
}

class WeibullSurvivalEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    
    weibull(x, sh, sc) { if (x <= 0) return 0; return 1 - Math.exp(-Math.pow(x/sc, sh)); }
    
    train(data) {
        for (let i = 30; i < data.length; i++) {
            const w = data.slice(i-30, i);
            const k = w.slice(-5).join('');
            if (!this.db.has(k)) this.db.set(k, {T:0,X:0,t:0});
            const d = this.db.get(k);
            d[data[i]] = (d[data[i]]||0) + 1;
            d.t++;
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 30) return null;
        const k = seq.slice(-5).join('');
        const d = this.db.get(k);
        if (!d || d.t < 5) return null;
        const sT = this.weibull(d.T, 1.5, 2);
        const sX = this.weibull(d.X, 1.5, 2);
        const prob = sT / (sT + sX + 0.01);
        return { prob: Math.max(0.08, Math.min(0.92, prob)), conf: Math.min(0.9, d.t/60) };
    }
}

class JSDUncertaintyEngine {
    constructor() { this.db = new Map(); this.trained = false; this.eps = 1e-10; }
    
    jsd(p, q) {
        const m = p.map((pi,i) => (pi+q[i])/2);
        let sum = 0;
        for (let i=0; i<p.length; i++) {
            const pi = p[i]+this.eps, qi = q[i]+this.eps, mi = m[i]+this.eps;
            sum += pi*Math.log(pi/mi) + qi*Math.log(qi/mi);
        }
        return sum/2;
    }
    
    train(data) {
        for (let i = 30; i < data.length; i++) {
            const w = data.slice(i-30, i);
            const t = w.filter(s => s==='T').length;
            const k = `${Math.round(t/30*10)}`;
            if (!this.db.has(k)) this.db.set(k, {T:0,X:0,t:0});
            const d = this.db.get(k);
            d[data[i]] = (d[data[i]]||0) + 1;
            d.t++;
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 30) return null;
        const t = seq.slice(-30).filter(s => s==='T').length;
        const k = `${Math.round(t/30*10)}`;
        const d = this.db.get(k);
        if (!d || d.t < 5) return null;
        const p = [d.T/d.t, d.X/d.t];
        const q = [0.5, 0.5];
        const uncertainty = this.jsd(p, q);
        const prob = d.T/d.t;
        return { prob: Math.max(0.08, Math.min(0.92, prob*(1-uncertainty)+0.5*uncertainty)), conf: Math.min(0.9, d.t/50) };
    }
}

class MarkovChainEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    
    train(data) {
        for (let order = 1; order <= 3; order++) {
            for (let i = order; i < data.length; i++) {
                const ctx = data.slice(i-order, i).join('');
                const k = `O${order}|${ctx}`;
                if (!this.db.has(k)) this.db.set(k, {T:0,X:0,t:0});
                const d = this.db.get(k);
                d[data[i]] = (d[data[i]]||0) + 1;
                d.t++;
            }
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained) return null;
        let ps = 0, ws = 0;
        for (let order = 1; order <= 3; order++) {
            if (seq.length >= order) {
                const ctx = seq.slice(-order).join('');
                const k = `O${order}|${ctx}`;
                const d = this.db.get(k);
                if (d && d.t >= 5) { const w = order; ps += (d.T/d.t)*w; ws += w; }
            }
        }
        if (ws === 0) return null;
        return { prob: Math.max(0.08, Math.min(0.92, ps/ws)), conf: Math.min(0.85, ws/6) };
    }
}

class EntropyFlowEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    
    calc(seq) {
        const wins = [3,5,8,13,21];
        const ents = [];
        for (const w of wins) {
            if (seq.length >= w) {
                const sl = seq.slice(-w);
                const p = sl.filter(s => s==='T').length/w;
                let e = 0;
                if (p>0 && p<1) e = -p*Math.log2(p)-(1-p)*Math.log2(1-p);
                ents.push(e);
            }
        }
        return { avg: ents.reduce((a,b)=>a+b,0)/(ents.length||1), var: ents.length>1?Math.max(...ents)-Math.min(...ents):0 };
    }
    
    train(data) {
        for (let i = 40; i < data.length; i++) {
            const w = data.slice(i-40, i);
            const e = this.calc(w);
            const k = `${Math.round(e.avg*10)}|${Math.round(e.var*10)}`;
            if (!this.db.has(k)) this.db.set(k, {T:0,X:0,t:0});
            const d = this.db.get(k);
            d[data[i]] = (d[data[i]]||0) + 1;
            d.t++;
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 40) return null;
        const e = this.calc(seq.slice(-40));
        const k = `${Math.round(e.avg*10)}|${Math.round(e.var*10)}`;
        const d = this.db.get(k);
        if (!d || d.t < 5) return null;
        return { prob: Math.max(0.08, Math.min(0.92, d.T/d.t)), conf: Math.min(0.9, d.t/70) };
    }
}

class MomentumTrendEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    
    calc(seq) {
        const r3 = seq.slice(-3).filter(s=>s==='T').length/3;
        const r8 = seq.slice(-8).filter(s=>s==='T').length/8;
        const r21 = seq.slice(-21).filter(s=>s==='T').length/21;
        return { sh: r3-r8, md: r8-r21 };
    }
    
    train(data) {
        for (let i = 40; i < data.length; i++) {
            const w = data.slice(i-40, i);
            const m = this.calc(w);
            const k = `${Math.round(m.sh*10)}|${Math.round(m.md*10)}`;
            if (!this.db.has(k)) this.db.set(k, {T:0,X:0,t:0});
            const d = this.db.get(k);
            d[data[i]] = (d[data[i]]||0) + 1;
            d.t++;
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 40) return null;
        const m = this.calc(seq.slice(-40));
        const k = `${Math.round(m.sh*10)}|${Math.round(m.md*10)}`;
        const d = this.db.get(k);
        if (!d || d.t < 5) return null;
        return { prob: Math.max(0.08, Math.min(0.92, d.T/d.t)), conf: Math.min(0.9, d.t/70) };
    }
}

class FractalGeometryEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    
    calcDim(seq) {
        const scales = [2,3,4,6,8,12];
        const pts = [];
        for (const sc of scales) {
            if (seq.length < sc) break;
            const s = new Set();
            for (let i=0; i<=seq.length-sc; i++) s.add(seq.slice(i,i+sc).join(''));
            pts.push({ sc, ct: s.size });
        }
        if (pts.length < 2) return 1;
        const n = pts.length;
        let sx=0,sy=0,sxy=0,sx2=0;
        for (const p of pts) { const x=Math.log(1/p.sc),y=Math.log(p.ct); sx+=x;sy+=y;sxy+=x*y;sx2+=x*x; }
        return (n*sxy-sx*sy)/(n*sx2-sx*sx+0.001);
    }
    
    train(data) {
        for (let i = 40; i < data.length; i++) {
            const w = data.slice(i-40, i);
            const dim = Math.round(this.calcDim(w)*20);
            const k = String(dim);
            if (!this.db.has(k)) this.db.set(k, {T:0,X:0,t:0});
            const d = this.db.get(k);
            d[data[i]] = (d[data[i]]||0) + 1;
            d.t++;
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 40) return null;
        const dim = Math.round(this.calcDim(seq.slice(-40))*20);
        const d = this.db.get(String(dim));
        if (!d || d.t < 5) return null;
        return { prob: Math.max(0.08, Math.min(0.92, d.T/d.t)), conf: Math.min(0.9, d.t/80) };
    }
}

class AdaptiveStreakEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    
    train(data) {
        for (let i = 20; i < data.length; i++) {
            const w = data.slice(i-20, i);
            const last = w[w.length-1];
            let st = 1;
            for (let j=w.length-2; j>=0 && w[j]===last; j--) st++;
            const k = `${last}:${Math.min(st,20)}`;
            if (!this.db.has(k)) this.db.set(k, {T:0,X:0,t:0});
            const d = this.db.get(k);
            d[data[i]] = (d[data[i]]||0) + 1;
            d.t++;
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained) return null;
        const last = seq[seq.length-1];
        let st = 1;
        for (let j=seq.length-2; j>=0 && seq[j]===last; j--) st++;
        const k = `${last}:${Math.min(st,20)}`;
        const d = this.db.get(k);
        if (!d || d.t < 5) return null;
        let prob = d.T/d.t;
        if (st >= 10) prob = last === 'T' ? 0.15 : 0.85;
        else if (st >= 7) prob = last === 'T' ? 0.25 : 0.75;
        else if (st >= 5) prob = last === 'T' ? 0.35 : 0.65;
        return { prob: Math.max(0.08, Math.min(0.92, prob)), conf: Math.min(0.95, d.t/50+st*0.02) };
    }
}

// ============================================================
// HỆ THỐNG DỰ ĐOÁN TỔNG HỢP
// ============================================================

class PredictionCore {
    constructor(type) {
        this.type = type;
        this.history = [];
        this.stats = { total:0,dung:0,sai:0,tyle:0,chuoi:0,chuoi_dai:0,chuoi_thua_dai:0,chuoi_thang_hientai:0,chuoi_thua_hientai:0,homnay:{dung:0,sai:0,tong:0} };
        this.lastPhien = null;
        this.trained = false;
        this.engines = [
            { n:'QUANTUM', e:new QuantumSpectralEngine(), w:3.5 },
            { n:'BAYESIAN', e:new BayesianMetaEngine(), w:3.0 },
            { n:'PATTERN', e:new PatternFingerprintEngine(), w:2.8 },
            { n:'WEIBULL', e:new WeibullSurvivalEngine(), w:2.5 },
            { n:'JSD', e:new JSDUncertaintyEngine(), w:2.2 },
            { n:'MARKOV', e:new MarkovChainEngine(), w:2.0 },
            { n:'ENTROPY', e:new EntropyFlowEngine(), w:1.8 },
            { n:'MOMENTUM', e:new MomentumTrendEngine(), w:1.6 },
            { n:'FRACTAL', e:new FractalGeometryEngine(), w:1.5 },
            { n:'STREAK', e:new AdaptiveStreakEngine(), w:1.4 }
        ];
    }
    
    train(data) {
        if (data.length < 50) return false;
        try { for (const eng of this.engines) eng.e.train(data); this.trained = true; return true; } catch(e) { return false; }
    }
    
    predict(data) {
        if (!data || data.length < 10) return this.fb();
        const seq = data.map(d => d==='T'?'T':'X');
        let sT=0,sX=0,sw=0;
        const dt=[];
        
        for (const eng of this.engines) {
            try {
                const r = eng.e.predict(seq);
                if (r) { const w = eng.w*r.conf; sT += r.prob*w; sX += (1-r.prob)*w; sw += w; dt.push(`${eng.n}:${Math.round(r.prob*100)}`); }
            } catch(e) {}
        }
        
        const last = seq[seq.length-1];
        let streak = 1;
        for (let j=seq.length-2; j>=0&&seq[j]===last; j--) streak++;
        if (streak>=10) { if (last==='T'){sX+=5;dt.push('BREAK-T10');}else{sT+=5;dt.push('BREAK-X10');} sw+=5; }
        else if (streak>=7) { if (last==='T'){sX+=3;dt.push('BREAK-T7');}else{sT+=3;dt.push('BREAK-X7');} sw+=3; }
        else if (streak>=5) { if (last==='T'){sX+=2;dt.push('BREAK-T5');}else{sT+=2;dt.push('BREAK-X5');} sw+=2; }
        
        const lt = seq.filter(s=>s==='T').length/seq.length;
        if (lt>0.7) { sX+=3; dt.push('BAL+'); sw+=3; }
        else if (lt<0.3) { sT+=3; dt.push('BAL-'); sw+=3; }
        
        if (sw===0) return this.fb();
        const prob = sT/(sT+sX);
        const dd = prob>0.5?'TÀI':'XỈU';
        let tc = Math.round(Math.max(prob,1-prob)*100);
        if (dt.length>=8) tc=Math.min(99,tc+10);
        else if (dt.length>=5) tc=Math.min(99,tc+7);
        else if (dt.length>=3) tc=Math.min(99,tc+4);
        tc = Math.min(99, Math.max(55, tc));
        
        return {duDoan:dd,doTinCay:tc,chiTiet:dt.slice(0,6).join(' | '),soMau:dt.length};
    }
    
    fb() {
        if (this.stats.total>50) return {duDoan:this.stats.dung>this.stats.sai?'TÀI':'XỈU',doTinCay:52,chiTiet:'TREND',soMau:0};
        return {duDoan:'TÀI',doTinCay:51,chiTiet:'INIT',soMau:0};
    }
    
    update(prediction, actual) {
        const pr = prediction==='TÀI'?'T':'X';
        const ac = actual==='TÀI'?'T':'X';
        const ok = pr===ac;
        this.stats.total++;
        if (ok) {
            this.stats.dung++;
            this.stats.chuoi = this.stats.chuoi>=0?this.stats.chuoi+1:1;
            if (this.stats.chuoi>this.stats.chuoi_dai) this.stats.chuoi_dai=this.stats.chuoi;
            this.stats.chuoi_thang_hientai++;
            this.stats.chuoi_thua_hientai=0;
            this.stats.homnay.dung++;
        } else {
            this.stats.sai++;
            this.stats.chuoi = this.stats.chuoi<=0?this.stats.chuoi-1:-1;
            if (Math.abs(this.stats.chuoi)>this.stats.chuoi_thua_dai) this.stats.chuoi_thua_dai=Math.abs(this.stats.chuoi);
            this.stats.chuoi_thua_hientai++;
            this.stats.chuoi_thang_hientai=0;
            this.stats.homnay.sai++;
        }
        this.stats.homnay.tong++;
        this.stats.tyle = this.stats.total>0?Math.round((this.stats.dung/this.stats.total)*100):0;
    }
    
    save() {
        try { fs.writeFileSync(`.${this.type}_data`, JSON.stringify({history:this.history.slice(0,2000),stats:this.stats,lastPhien:this.lastPhien,trained:this.trained})); } catch(e) {}
    }
    
    load() {
        try {
            const f = `.${this.type}_data`;
            if (fs.existsSync(f)) {
                const d = JSON.parse(fs.readFileSync(f,'utf8'));
                if (d.history) this.history = d.history;
                if (d.stats) this.stats = d.stats;
                if (d.lastPhien) this.lastPhien = d.lastPhien;
                if (d.trained) this.trained = d.trained;
            }
        } catch(e) {}
    }
}

const brainHU = new PredictionCore('hu');
const brainMD5 = new PredictionCore('md5');
brainHU.load();
brainMD5.load();

// ============================================================
// DATA
// ============================================================
function transformData(d) {
    if (!d||!d.list) return null;
    return d.list.map(i=>({phien:i.id,result:i.resultTruyenThong==='TAI'?'TÀI':'XỈU',dice1:i.dices[0],dice2:i.dices[1],dice3:i.dices[2],total:i.point}));
}

async function fetchData(t) {
    try {
        const u = t==='hu'?API_URL_HU:API_URL_MD5;
        const r = await axios.get(u, {timeout:8000,headers:{'User-Agent':'CrystalTX'}});
        return transformData(r.data);
    } catch(e) { return null; }
}

// ============================================================
// AUTO
// ============================================================
async function processGame(brain, type) {
    try {
        const data = await fetchData(type);
        if (!data||data.length===0) return;
        const cur = data[0].phien;
        if (brain.lastPhien===cur) return;
        for (const r of brain.history) {
            if (r.status&&r.status!=='') continue;
            const a = data.find(d=>d.phien.toString()===r.phien_hien_tai);
            if (a) { r.status=(r.prediction===a.result)?'✅':'❌'; r.actual=a.result; brain.update(r.prediction,a.result); }
        }
        const ex = brain.history.find(h=>h.phien_hien_tai===(cur+1).toString());
        if (ex) return;
        const hd = data.map(d=>d.result==='TÀI'?'T':'X');
        if (hd.length>=50) brain.train(hd);
        const result = brain.predict(hd);
        const rec = {phien:data[0].phien,phien_hien_tai:(data[0].phien+1).toString(),dice:`${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`,total:data[0].total,actual:data[0].result,prediction:result.duDoan,confidence:result.doTinCay,detail:result.chiTiet,status:'',timestamp:new Date().toISOString(),soMau:result.soMau||0};
        brain.history.unshift(rec);
        if (brain.history.length>2000) brain.history = brain.history.slice(0,2000);
        brain.lastPhien = cur;
        brain.save();
    } catch(e) {}
}

async function autoProcess() { await Promise.all([processGame(brainHU,'hu'),processGame(brainMD5,'md5')]); }
function startAuto() { setTimeout(autoProcess,3000); setInterval(autoProcess,5000); }

// ============================================================
// GIAO DIỆN SIÊU VIP - CÔNG NGHỆ CAO
// ============================================================

const CSS = `
:root{--bg:#020617;--bg2:#0a0f24;--bg3:#111832;--b:rgba(255,255,255,0.04);--ba:rgba(123,97,255,0.3);--t:#e2e8f0;--t2:#8899b8;--t3:#4a5578;--g:linear-gradient(135deg,#7b61ff,#3b82f6,#06b6d4,#8b5cf6);--ok:#22c55e;--no:#ef4444;--w:#f59e0b;--c:#06b6d4;--p:#7b61ff}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--t);min-height:100vh;overflow-x:hidden}
.scan{position:fixed;top:0;left:0;width:100%;height:2px;background:linear-gradient(90deg,transparent,rgba(123,97,255,0.3),transparent);z-index:999;pointer-events:none;animation:scan 3s linear infinite}
@keyframes scan{0%{transform:translateY(-100vh)}100%{transform:translateY(100vh)}}
.particles{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none}
.particle{position:absolute;width:2px;height:2px;background:rgba(123,97,255,0.5);border-radius:50%;animation:float 6s infinite}
@keyframes float{0%{transform:translateY(100vh) scale(0);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateY(-10vh) scale(1);opacity:0}}
.glass{background:rgba(17,24,50,0.5);backdrop-filter:blur(30px);border:1px solid var(--b)}
.glass-card{background:rgba(17,24,50,0.4);backdrop-filter:blur(20px);border:1px solid var(--b);transition:all 0.3s}
.glass-card:hover{border-color:var(--ba);transform:translateY(-3px);box-shadow:0 20px 60px rgba(0,0,0,0.4)}
input{width:100%;padding:12px 16px;background:var(--bg3);border:1px solid var(--b);border-radius:10px;color:var(--t);font-size:13px;font-family:'JetBrains Mono',monospace;outline:none;transition:all 0.3s}
input:focus{border-color:var(--ba);box-shadow:0 0 0 4px rgba(123,97,255,0.1)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 24px;background:var(--g);border:none;border-radius:10px;color:#fff;font-weight:600;font-size:13px;cursor:pointer;transition:all 0.3s;text-decoration:none}
.btn:hover{transform:translateY(-2px);box-shadow:0 10px 40px rgba(123,97,255,0.4)}
.tg{background:var(--g);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.mono{font-family:'JetBrains Mono',monospace}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.06);border-radius:2px}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(123,97,255,0.4)}50%{box-shadow:0 0 0 15px rgba(123,97,255,0)}}
@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes glow{0%,100%{filter:drop-shadow(0 0 5px rgba(123,97,255,0.3))}50%{filter:drop-shadow(0 0 20px rgba(123,97,255,0.6))}}`;

function loginPage(err) {
    const e = err ? `<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);padding:14px;border-radius:10px;color:#ef4444;font-size:13px;text-align:center;margin-bottom:20px;animation:fadeIn 0.3s">⚠️ ${err}</div>` : '';
    
    return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>CRYSTAL TX</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}
.login-card{position:relative;z-index:1;background:rgba(17,24,50,0.7);backdrop-filter:blur(40px);border:1px solid var(--b);border-radius:24px;padding:44px 36px;width:100%;max-width:460px;box-shadow:0 40px 100px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.02);animation:fadeIn 0.5s}
.login-card::before{content:'';position:absolute;top:-1px;left:-1px;right:-1px;bottom:-1px;border-radius:24px;background:var(--g);z-index:-1;opacity:0.1}
.logo-icon{font-size:56px;animation:glow 3s infinite;display:inline-block}
</style></head><body>
<div class="scan"></div>
<div class="particles">${Array(20).fill(0).map((_,i) => `<div class="particle" style="left:${Math.random()*100}%;animation-delay:${Math.random()*6}s;animation-duration:${4+Math.random()*4}s"></div>`).join('')}</div>
<div style="position:relative;z-index:1;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px">
<div class="login-card">
<div style="text-align:center;margin-bottom:32px">
<div class="logo-icon">💎</div>
<h1 style="font-family:'Orbitron',sans-serif;font-size:28px;font-weight:900;margin-top:12px"><span class="tg">CRYSTAL TX</span></h1>
<p style="font-size:10px;color:var(--t3);font-family:'Space Grotesk',sans-serif;letter-spacing:3px;text-transform:uppercase;margin-top:6px">Prediction System</p></div>
${e}
<form onsubmit="go(event)">
<div style="margin-bottom:16px"><label style="display:block;font-size:9px;color:var(--t2);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600">Username</label><input type="text" id="u" autocomplete="off" required></div>
<div style="margin-bottom:24px"><label style="display:block;font-size:9px;color:var(--t2);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600">Password</label><input type="password" id="p" autocomplete="off" required></div>
<button type="submit" class="btn" style="width:100%;font-size:15px;padding:14px">🔐 Access System</button></form>
<div id="res" style="margin-top:24px"></div>
<div style="text-align:center;margin-top:24px;padding-top:20px;border-top:1px solid var(--b)"><p style="font-size:8px;color:var(--t3);font-family:'Space Grotesk',sans-serif;letter-spacing:2px">💎 CRYSTAL TX • QUANTUM • BAYESIAN • PATTERN • WEIBULL • JSD • MARKOV • ENTROPY • MOMENTUM • FRACTAL • STREAK</p></div></div></div>
<script>
async function go(e){e.preventDefault();
const u=document.getElementById('u').value.trim(),p=document.getElementById('p').value.trim(),r=document.getElementById('res');
if(!u||!p){r.innerHTML='<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);padding:14px;border-radius:10px;color:#ef4444;font-size:13px;animation:fadeIn 0.3s">Vui lòng nhập đầy đủ thông tin</div>';return}
r.innerHTML='<div style="background:rgba(6,182,212,0.1);border:1px solid rgba(6,182,212,0.3);padding:14px;border-radius:10px;color:#06b6d4;font-size:13px;animation:fadeIn 0.3s">⏳ Đang xác thực...</div>';
try{const rs=await fetch('/_api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});
const d=await rs.json();
if(rs.ok&&d.token){
const links=d.role==='admin'?`<a href="/_admin?_token=${d.token}" class="btn" style="background:linear-gradient(135deg,#7b61ff,#8b5cf6);margin-bottom:8px">👑 Admin Panel</a>`:'';
r.innerHTML='<div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);padding:14px;border-radius:10px;color:#22c55e;font-size:13px;margin-bottom:16px;animation:fadeIn 0.3s">✅ Xác thực thành công</div>'+
'<div style="background:var(--bg3);border:1px solid var(--b);border-radius:12px;padding:20px;animation:fadeIn 0.3s">'+
'<p style="font-size:9px;color:var(--t2);text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;font-weight:600">Token</p>'+
'<div style="font-family:\'JetBrains Mono\',monospace;font-size:10px;color:#22c55e;word-break:break-all;background:var(--bg);padding:12px;border-radius:8px;margin-bottom:16px">'+d.token+'</div>'+
'<p style="font-size:9px;color:var(--t2);text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;font-weight:600">Dashboard</p>'+links+
'<a href="/_hu?_token='+d.token+'" class="btn" style="width:100%;margin-bottom:8px;background:rgba(6,182,212,0.2);border:1px solid rgba(6,182,212,0.3);color:#06b6d4">📊 HU Dashboard</a>'+
'<a href="/_md5?_token='+d.token+'" class="btn" style="width:100%;margin-bottom:8px;background:rgba(6,182,212,0.2);border:1px solid rgba(6,182,212,0.3);color:#06b6d4">📊 MD5 Dashboard</a>'+
'<p style="font-size:9px;color:var(--t2);text-transform:uppercase;letter-spacing:2px;margin:12px 0 10px;font-weight:600">API</p>'+
'<a href="/_hu/json?_token='+d.token+'" class="btn" style="width:100%;margin-bottom:8px;background:rgba(123,97,255,0.2);border:1px solid rgba(123,97,255,0.3);color:#7b61ff">📡 HU JSON API</a>'+
'<a href="/_md5/json?_token='+d.token+'" class="btn" style="width:100%;background:rgba(123,97,255,0.2);border:1px solid rgba(123,97,255,0.3);color:#7b61ff">📡 MD5 JSON API</a>'+
'</div>'}else{r.innerHTML='<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);padding:14px;border-radius:10px;color:#ef4444;font-size:13px;animation:fadeIn 0.3s">❌ '+(d.error||'Sai thông tin')+'</div>'}}
catch(ex){r.innerHTML='<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);padding:14px;border-radius:10px;color:#ef4444;font-size:13px;animation:fadeIn 0.3s">🔌 Lỗi kết nối</div>'}}</script></body></html>`;
}

function dashboardPage(brain, type) {
    const s = brain.stats;
    const all = (brain.history||[]);
    const r50 = all.slice(0,50);
    const r1000 = all.slice(0,1000);
    
    let td50=0,ts50=0,td1k=0,ts1k=0;
    for(const r of r50){if(r.status==='✅')td50++;else if(r.status==='❌')ts50++;}
    for(const r of r1000){if(r.status==='✅')td1k++;else if(r.status==='❌')ts1k++;}
    
    let rows='';
    for(const r of r50){
        const st=r.status||'⏳',c=st==='✅'?'s':st==='❌'?'d':'w',t=st==='✅'?'WIN':st==='❌'?'LOSE':'WAIT';
        rows+=`<tr class="r-${c}"><td class="mono">#${r.phien_hien_tai||'-'}</td><td><span class="pr pr-${r.prediction==='TÀI'?'t':'x'}">${r.prediction||'-'}</span></td><td><div class="cb"><div class="cf" style="width:${r.confidence||0}%"></div></div><span class="ct">${r.confidence||0}%</span></td><td><span class="st st-${c}">${t}</span></td><td>${r.actual||'-'}</td><td class="dt">${(r.detail||'-').substring(0,30)}</td></tr>`;
    }
    
    let dots='';
    for(const r of r1000){const st=r.status||'⏳',c=st==='✅'?'s':st==='❌'?'d':'w',t=st==='✅'?'W':st==='❌'?'L':'?';dots+=`<span class="dot dot-${c}" title="#${r.phien_hien_tai}: ${r.prediction} → ${r.actual||'?'}">${t}</span>`;}
    
    const wr=s.tyle;
    const wc=wr>=70?'#22c55e':wr>=60?'#f59e0b':'#ef4444';
    
    return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${type.toUpperCase()} | CRYSTAL TX</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}
.sv{font-family:'Orbitron',monospace;font-size:26px;font-weight:800}
.pr{display:inline-block;padding:3px 10px;border-radius:6px;font-weight:700;font-size:9px}
.pr-t{background:rgba(34,197,94,0.08);color:var(--ok)}.pr-x{background:rgba(239,68,68,0.08);color:var(--no)}
.cb{display:inline-block;width:45px;height:3px;background:rgba(255,255,255,0.05);border-radius:2px;vertical-align:middle;margin-right:6px}
.cf{height:100%;border-radius:2px;background:var(--g)}.ct{font-weight:600;color:var(--c);font-size:9px}
.st{display:inline-block;padding:2px 8px;border-radius:4px;font-weight:700;font-size:7px;text-transform:uppercase;letter-spacing:1px}
.st-s{background:rgba(34,197,94,0.08);color:var(--ok)}.st-d{background:rgba(239,68,68,0.08);color:var(--no)}.st-w{background:rgba(245,158,11,0.08);color:var(--w)}
.dt{font-size:8px;color:var(--t3);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dot{width:18px;height:18px;border-radius:3px;font-size:7px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;margin:1px;font-family:'JetBrains Mono',monospace;transition:all 0.2s}
.dot-s{background:rgba(34,197,94,0.15);color:var(--ok);border:1px solid rgba(34,197,94,0.2)}.dot-s:hover{transform:scale(1.4);z-index:2}
.dot-d{background:rgba(239,68,68,0.15);color:var(--no);border:1px solid rgba(239,68,68,0.2)}.dot-d:hover{transform:scale(1.4);z-index:2}
.dot-w{background:rgba(245,158,11,0.15);color:var(--w);border:1px solid rgba(245,158,11,0.2)}.dot-w:hover{transform:scale(1.4);z-index:2}
table{width:100%;border-collapse:collapse;font-size:10px}
th{background:rgba(255,255,255,0.015);padding:9px 12px;text-align:left;font-weight:600;font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:var(--t3);border-bottom:1px solid var(--b)}
td{padding:7px 12px;border-bottom:1px solid rgba(255,255,255,0.012)}tr:hover td{background:rgba(255,255,255,0.008)}
.r-s{border-left:2px solid transparent}.r-s:hover{border-left-color:rgba(34,197,94,0.3)}
.r-d{border-left:2px solid transparent}.r-d:hover{border-left-color:rgba(239,68,68,0.3)}
.r-w{border-left:2px solid transparent}.r-w:hover{border-left-color:rgba(245,158,11,0.3)}
.badge{display:inline-flex;align-items:center;gap:5px;padding:5px 14px;border-radius:16px;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:1px}
.badge-ok{background:rgba(34,197,94,0.08);color:var(--ok);border:1px solid rgba(34,197,94,0.15)}
.badge-p{background:rgba(123,97,255,0.08);color:var(--p);border:1px solid rgba(123,97,255,0.15)}
.badge-i{background:rgba(6,182,212,0.08);color:var(--c);border:1px solid rgba(6,182,212,0.15)}
.pulse{width:7px;height:7px;border-radius:50%;background:var(--ok);display:inline-block;animation:pulse 1.5s infinite}
@keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(34,197,94,0.4)}50%{opacity:0.5;box-shadow:0 0 0 8px rgba(34,197,94,0)}}
</style></head><body>
<div class="scan"></div>
<div class="particles">${Array(30).fill(0).map((_,i) => `<div class="particle" style="left:${Math.random()*100}%;animation-delay:${Math.random()*6}s;animation-duration:${4+Math.random()*4}s"></div>`).join('')}</div>
<div style="position:relative;z-index:1;max-width:1400px;margin:0 auto;padding:16px">
<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;margin-bottom:20px">
<div style="display:flex;align-items:center;gap:12px"><div style="font-size:38px;animation:glow 3s infinite">💎</div><div><h1 style="font-family:'Orbitron',sans-serif;font-size:22px;font-weight:900"><span class="tg">CRYSTAL TX</span></h1><p style="font-size:8px;color:var(--t3);font-family:'Space Grotesk',sans-serif;letter-spacing:2px">${type.toUpperCase()} • 10 Engines</p></div></div>
<div style="display:flex;gap:8px"><span class="badge badge-ok"><span class="pulse"></span>LIVE</span><span class="badge badge-p">10 ENGINES</span></div></div>

<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
<div class="glass-card" style="padding:18px;border-radius:14px"><div style="font-size:8px;color:var(--t3);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600">📊 Tổng</div><div class="sv" style="color:var(--t)">${s.total}</div><div style="font-size:8px;color:var(--t2);margin-top:4px">Dự đoán</div></div>
<div class="glass-card" style="padding:18px;border-radius:14px"><div style="font-size:8px;color:var(--t3);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600">✅ Tỷ Lệ</div><div class="sv" style="color:${wc}">${wr}%</div><div style="font-size:8px;color:var(--t2);margin-top:4px">${s.dung}W / ${s.sai}L</div></div>
<div class="glass-card" style="padding:18px;border-radius:14px"><div style="font-size:8px;color:var(--t3);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600">🏆 Thắng Dài</div><div class="sv" style="color:#22c55e">${s.chuoi_dai}</div><div style="font-size:8px;color:var(--t2);margin-top:4px">Hiện: ${s.chuoi_thang_hientai||0}</div></div>
<div class="glass-card" style="padding:18px;border-radius:14px"><div style="font-size:8px;color:var(--t3);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600">⚠️ Thua Dài</div><div class="sv" style="color:#ef4444">${s.chuoi_thua_dai||0}</div><div style="font-size:8px;color:var(--t2);margin-top:4px">Hiện: ${s.chuoi_thua_hientai||0}</div></div></div>

<div class="glass" style="border-radius:16px;margin-bottom:20px"><div style="padding:14px 18px;border-bottom:1px solid var(--b);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px"><h3 style="font-family:'Orbitron',monospace;font-size:12px;font-weight:600">📜 Lịch Sử ${r1000.length} Phiên</h3><span class="badge badge-i">${td1k}W/${ts1k}L</span></div><div style="padding:14px;max-height:300px;overflow-y:auto;line-height:1.8">${dots||'Đang tải...'}</div></div>

<div class="glass" style="border-radius:16px"><div style="padding:14px 18px;border-bottom:1px solid var(--b);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px"><h3 style="font-family:'Orbitron',monospace;font-size:12px;font-weight:600">📋 50 Phiên Gần Nhất</h3><span class="badge badge-p">QUANTUM • BAYESIAN • PATTERN • WEIBULL • JSD • MARKOV • ENTROPY • MOMENTUM • FRACTAL • STREAK</span></div>
<div style="overflow-x:auto"><table><thead><tr><th>Phiên</th><th>Dự Đoán</th><th>Độ Tin</th><th>KQ</th><th>Thực Tế</th><th>Engines</th></tr></thead><tbody>${rows||'<tr><td colspan="6" style="text-align:center;padding:15px">Đang tải...</td></tr>'}</tbody></table></div></div>

<div style="text-align:center;padding:12px;font-size:7px;color:var(--t3);font-family:'Space Grotesk',sans-serif;margin-top:12px">💎 CRYSTAL TX • 10 Engines • ${new Date().toLocaleString('vi-VN')}</div></div>
<script>setTimeout(()=>location.reload(),5000);</script></body></html>`;
}

function adminPage() {
    const list = Object.entries(users).map(([u, d]) => {
        const exp = d.expires > 0 ? new Date(d.expires).toLocaleString('vi-VN') : 'Vĩnh viễn';
        const active = d.expires === 0 || Date.now() < d.expires;
        return `<tr><td class="mono">${u}</td><td>${d.devices||1}</td><td>${exp}</td><td><span class="badge ${active?'badge-ok':'badge" style="background:rgba(239,68,68,0.08);color:#ef4444;border:1px solid rgba(239,68,68,0.15)"'}">${active?'Active':'Expired'}</span></td><td><button onclick="del('${u}')" style="background:#ef4444;border:none;color:#fff;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:10px">Xóa</button></td></tr>`;
    }).join('');
    
    return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin | CRYSTAL TX</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}
.sv{font-family:'Orbitron',monospace;font-size:26px;font-weight:800}
.badge{display:inline-flex;padding:4px 12px;border-radius:12px;font-size:7px;font-weight:600;text-transform:uppercase;letter-spacing:1px}
.badge-ok{background:rgba(34,197,94,0.08);color:var(--ok);border:1px solid rgba(34,197,94,0.15)}
table{width:100%;border-collapse:collapse;font-size:10px}
th{background:rgba(255,255,255,0.015);padding:10px 14px;text-align:left;font-weight:600;font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:var(--t3);border-bottom:1px solid var(--b)}
td{padding:9px 14px;border-bottom:1px solid rgba(255,255,255,0.012)}tr:hover td{background:rgba(255,255,255,0.008)}
</style></head><body>
<div class="scan"></div>
<div style="position:relative;z-index:1;max-width:1000px;margin:0 auto;padding:16px">
<div style="display:flex;align-items:center;gap:12px;margin-bottom:24px"><div style="font-size:38px;animation:glow 3s infinite">👑</div><div><h1 style="font-family:'Orbitron',sans-serif;font-size:22px;font-weight:900"><span class="tg">ADMIN PANEL</span></h1><p style="font-size:8px;color:var(--t3);font-family:'Space Grotesk',sans-serif;letter-spacing:2px">User Management</p></div></div>

<div class="glass" style="border-radius:16px;padding:24px;margin-bottom:20px">
<h3 style="font-family:'Orbitron',monospace;font-size:13px;font-weight:600;margin-bottom:16px">➕ Create User</h3>
<form onsubmit="create(event)" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
<div><label style="font-size:8px;color:var(--t2);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Username</label><input type="text" id="nu" required></div>
<div><label style="font-size:8px;color:var(--t2);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Password</label><input type="text" id="np" required></div>
<div><label style="font-size:8px;color:var(--t2);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Devices</label><input type="number" id="nd" value="1" min="1"></div>
<div><label style="font-size:8px;color:var(--t2);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">Days</label><input type="number" id="ne" value="30" min="1"></div>
<button type="submit" class="btn" style="grid-column:1/-1">➕ Create User</button></form>
<div id="cr" style="margin-top:12px;font-size:12px"></div></div>

<div class="glass" style="border-radius:16px;padding:24px"><h3 style="font-family:'Orbitron',monospace;font-size:13px;font-weight:600;margin-bottom:16px">👥 Users (${Object.keys(users).length})</h3>
<div style="overflow-x:auto"><table><thead><tr><th>Username</th><th>Devices</th><th>Expires</th><th>Status</th><th></th></tr></thead><tbody>${list||'<tr><td colspan="5" style="text-align:center;padding:15px">No users</td></tr>'}</tbody></table></div></div>
</div>
<script>
async function create(e){e.preventDefault();
const u=document.getElementById('nu').value.trim(),p=document.getElementById('np').value.trim();
const d=document.getElementById('nd').value,ex=document.getElementById('ne').value;
const r=document.getElementById('cr'),tk=new URLSearchParams(location.search).get('_token');
r.innerHTML='Creating...';
try{const rs=await fetch('/_admin/create-user?_token='+tk,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p,devices:parseInt(d),expiryDays:parseInt(ex)})});
const data=await rs.json();
if(rs.ok){r.innerHTML='<span style="color:#22c55e">✅ Created: '+data.username+' | Pass: '+data.password+'</span>';setTimeout(()=>location.reload(),1000)}
else{r.innerHTML='<span style="color:#ef4444">❌ '+(data.error||'Error')+'</span>'}}catch(e){r.innerHTML='<span style="color:#ef4444">Error</span>'}}
async function del(u){if(!confirm('Delete '+u+'?'))return;const tk=new URLSearchParams(location.search).get('_token');
await fetch('/_admin/delete-user?_token='+tk,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u})});location.reload()}
</script></body></html>`;
}

// ============================================================
// API
// ============================================================

app.get('/_login', (req, res) => {
    const err = req.query.error === 'unauthorized' ? 'Vui lòng đăng nhập' : req.query.error === 'expired' ? 'Token hết hạn' : '';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(loginPage(err));
});

app.get('/', (req, res) => res.redirect('/_login'));

app.post('/_api/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Thiếu thông tin' });
    if (username === ADMIN_USER && password === ADMIN_PASS) {
        const { token } = createToken(username, 'admin');
        return res.json({ token, role: 'admin' });
    }
    const user = users[username];
    if (user && user.password === password) {
        if (user.expires > 0 && Date.now() > user.expires) return res.status(401).json({ error: 'Tài khoản hết hạn' });
        const { token } = createToken(username, 'user');
        return res.json({ token, role: 'user' });
    }
    return res.status(401).json({ error: 'Sai thông tin' });
});

app.get('/_hu', checkAuth, async (req, res) => {
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

app.get('/_md5', checkAuth, async (req, res) => {
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

app.get('/_hu/json', checkAuth, async (req, res) => {
    try {
        const data = await fetchData('hu');
        if (!data || data.length === 0) { const r = brainHU.fb(); return res.json({ prediction: r.duDoan, confidence: r.doTinCay, detail: r.chiTiet }); }
        const exist = brainHU.history.find(h => h.phien_hien_tai === (data[0].phien + 1).toString());
        if (exist) return res.json(exist);
        const hd = data.map(d => d.result === 'TÀI' ? 'T' : 'X');
        if (hd.length >= 50) brainHU.train(hd);
        const result = brainHU.predict(hd);
        const rec = { phien: data[0].phien, phien_hien_tai: (data[0].phien + 1).toString(), dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`, total: data[0].total, actual: data[0].result, prediction: result.duDoan, confidence: result.doTinCay, detail: result.chiTiet, status: '', timestamp: new Date().toISOString(), soMau: result.soMau || 0 };
        brainHU.history.unshift(rec);
        if (brainHU.history.length > 2000) brainHU.history = brainHU.history.slice(0, 2000);
        brainHU.save();
        res.json(rec);
    } catch (e) { res.status(500).json({ error: 'Lỗi' }); }
});

app.get('/_md5/json', checkAuth, async (req, res) => {
    try {
        const data = await fetchData('md5');
        if (!data || data.length === 0) { const r = brainMD5.fb(); return res.json({ prediction: r.duDoan, confidence: r.doTinCay, detail: r.chiTiet }); }
        const exist = brainMD5.history.find(h => h.phien_hien_tai === (data[0].phien + 1).toString());
        if (exist) return res.json(exist);
        const hd = data.map(d => d.result === 'TÀI' ? 'T' : 'X');
        if (hd.length >= 50) brainMD5.train(hd);
        const result = brainMD5.predict(hd);
        const rec = { phien: data[0].phien, phien_hien_tai: (data[0].phien + 1).toString(), dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`, total: data[0].total, actual: data[0].result, prediction: result.duDoan, confidence: result.doTinCay, detail: result.chiTiet, status: '', timestamp: new Date().toISOString(), soMau: result.soMau || 0 };
        brainMD5.history.unshift(rec);
        if (brainMD5.history.length > 2000) brainMD5.history = brainMD5.history.slice(0, 2000);
        brainMD5.save();
        res.json(rec);
    } catch (e) { res.status(500).json({ error: 'Lỗi' }); }
});

app.get('/_admin', checkAuth, checkAdmin, (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(adminPage());
});

app.post('/_admin/create-user', checkAuth, checkAdmin, (req, res) => {
    const { username, password, devices, expiryDays } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Thiếu thông tin' });
    if (users[username] || username === ADMIN_USER) return res.status(400).json({ error: 'Username exists' });
    users[username] = { password, devices: parseInt(devices)||1, expires: expiryDays ? Date.now()+(parseInt(expiryDays)*86400000) : 0, created: Date.now() };
    saveUsers();
    res.json({ username, password });
});

app.post('/_admin/delete-user', checkAuth, checkAdmin, (req, res) => {
    const { username } = req.body || {};
    if (!username || !users[username]) return res.status(400).json({ error: 'User not found' });
    delete users[username];
    saveUsers();
    res.json({ message: 'Deleted' });
});

app.get('/_stats', checkAuth, (req, res) => {
    const total = brainHU.stats.total + brainMD5.stats.total;
    const dung = brainHU.stats.dung + brainMD5.stats.dung;
    res.json({ hu: brainHU.stats, md5: brainMD5.stats, combined: { total, dung, sai: total-dung, tyle: total>0?Math.round((dung/total)*100):0 } });
});

app.get('/_reset', checkAuth, checkAdmin, (req, res) => {
    ['hu','md5'].forEach(type => {
        const brain = type==='hu'?brainHU:brainMD5;
        brain.stats = { total:0,dung:0,sai:0,tyle:0,chuoi:0,chuoi_dai:0,chuoi_thua_dai:0,chuoi_thang_hientai:0,chuoi_thua_hientai:0,homnay:{dung:0,sai:0,tong:0} };
        brain.history=[]; brain.lastPhien=null; brain.save();
    });
    res.json({ message: 'Done' });
});

app.use((req, res) => res.status(404).end());
app.use((err, req, res, next) => { res.status(500).end(); });

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ CRYSTAL TX - Port ${PORT}\n`);
    startAuto();
});
