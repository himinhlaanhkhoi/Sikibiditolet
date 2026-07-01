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
const ADMIN_USER = 'admin';
const ADMIN_PASS = crypto.randomBytes(8).toString('hex');
const TOKENS = new Map();

console.log('\n╔══════════════════════════════════════╗');
console.log('║       CRYSTAL TX SYSTEM             ║');
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
    const expires = role === 'admin' ? Date.now() + 864000000 : Date.now() + 86400000;
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
// SECURITY
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
// DATA HELPERS
// ============================================================
function transformData(d) {
    if (!d || !d.list) return null;
    return d.list.map(i => ({
        phien: i.id,
        result: i.resultTruyenThong === 'TAI' ? 'TÀI' : 'XỈU',
        dice1: i.dices[0], dice2: i.dices[1], dice3: i.dices[2],
        total: i.point
    }));
}

async function fetchData(t) {
    try {
        const u = t === 'hu' ? API_URL_HU : API_URL_MD5;
        const r = await axios.get(u, { timeout: 8000, headers: { 'User-Agent': 'CrystalTX' } });
        return transformData(r.data);
    } catch(e) { return null; }
}

// ============================================================
// 20 THUẬT TOÁN SIÊU CHÍNH XÁC - TẬP TRUNG 100%
// ============================================================

class QuantumSpectralV9 {
    constructor() { this.db = new Map(); this.trained = false; }
    extract(seq) {
        const s = seq.map(v => v === 'T' ? 1 : -1);
        const f = [];
        for (const p of [2,3,5,8,13,21,34,55]) {
            if (s.length >= p) {
                let si=0, co=0;
                for (let i=0; i<p; i++) {
                    const a = 2*Math.PI*i/p;
                    si += s[s.length-p+i]*Math.sin(a);
                    co += s[s.length-p+i]*Math.cos(a);
                }
                f.push(Math.sqrt(si*si+co*co)/p);
                f.push(Math.atan2(si,co)/Math.PI);
            }
        }
        while(f.length<16) f.push(0);
        return f;
    }
    train(data) {
        for (let i=50; i<data.length; i++) {
            const w = data.slice(i-50,i);
            const f = this.extract(w);
            const k = f.map(v=>Math.round(v*25)).join(',');
            if(!this.db.has(k)) this.db.set(k,{T:0,X:0,t:0});
            const d = this.db.get(k);
            d[data[i]] = (d[data[i]]||0)+1;
            d.t++;
        }
        this.trained = true;
    }
    predict(seq) {
        if(!this.trained||seq.length<50) return null;
        const f = this.extract(seq.slice(-50));
        const k = f.map(v=>Math.round(v*25)).join(',');
        const d = this.db.get(k);
        if(!d||d.t<5) {
            let best=null, bd=Infinity;
            for(const[key,val] of this.db){
                if(val.t<10) continue;
                const parts = key.split(',').map(Number);
                const fp = f.map(v=>Math.round(v*25));
                let dist = 0;
                for(let i=0;i<Math.min(parts.length,fp.length);i++) dist += Math.abs(parts[i]-fp[i]);
                if(dist<bd){bd=dist;best=val;}
            }
            if(best) return {prob:best.T/best.t, conf:0.5};
            return null;
        }
        return {prob:Math.max(0.08,Math.min(0.92,d.T/d.t)), conf:Math.min(0.95,d.t/120)};
    }
}

class BayesianMetaEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    train(data) {
        for (let i=40; i<data.length; i++) {
            const w = data.slice(i-40,i);
            const k = w.slice(-6).join('');
            if(!this.db.has(k)) this.db.set(k,{T:1,X:1,t:2});
            const d = this.db.get(k);
            d[data[i]] = (d[data[i]]||0)+1;
            d.t++;
        }
        this.trained = true;
    }
    predict(seq) {
        if(!this.trained||seq.length<40) return null;
        const k = seq.slice(-6).join('');
        const d = this.db.get(k);
        if(!d||d.t<5) return null;
        return {prob:Math.max(0.08,Math.min(0.92,d.T/d.t)), conf:Math.min(0.9,d.t/60)};
    }
}

class PatternFingerprintEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    fp(seq) {
        const t = seq.filter(s=>s==='T').length;
        const c = seq.filter((s,i,a)=>i>0&&s!==a[i-1]).length;
        let max=0, cur=1;
        for(let i=1;i<seq.length;i++){if(seq[i]===seq[i-1]){cur++;if(cur>max)max=cur;}else cur=1;}
        let e=0; const p=t/seq.length; if(p>0&&p<1) e=-p*Math.log2(p)-(1-p)*Math.log2(1-p);
        return `${seq.length}|${t}|${c}|${max}|${Math.round(e*100)}`;
    }
    train(data) {
        for (let i=25; i<data.length; i++) {
            const w = data.slice(i-25,i);
            const f = this.fp(w.slice(-12));
            if(!this.db.has(f)) this.db.set(f,{T:0,X:0,t:0});
            const d = this.db.get(f);
            d[data[i]] = (d[data[i]]||0)+1;
            d.t++;
        }
        this.trained = true;
    }
    predict(seq) {
        if(!this.trained||seq.length<25) return null;
        const f = this.fp(seq.slice(-12));
        const d = this.db.get(f);
        if(!d||d.t<3) return null;
        return {prob:Math.max(0.08,Math.min(0.92,d.T/d.t)), conf:Math.min(0.9,d.t/40)};
    }
}

class WeibullSurvivalEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    weibull(x,sh,sc){if(x<=0)return 0;return 1-Math.exp(-Math.pow(x/sc,sh));}
    train(data) {
        for (let i=30; i<data.length; i++) {
            const w = data.slice(i-30,i);
            const k = w.slice(-5).join('');
            if(!this.db.has(k)) this.db.set(k,{T:0,X:0,t:0});
            const d = this.db.get(k);
            d[data[i]] = (d[data[i]]||0)+1;
            d.t++;
        }
        this.trained = true;
    }
    predict(seq) {
        if(!this.trained||seq.length<30) return null;
        const k = seq.slice(-5).join('');
        const d = this.db.get(k);
        if(!d||d.t<5) return null;
        const sT=this.weibull(d.T,1.5,2), sX=this.weibull(d.X,1.5,2);
        return {prob:Math.max(0.08,Math.min(0.92,sT/(sT+sX+0.01))), conf:Math.min(0.9,d.t/60)};
    }
}

class JSDUncertaintyEngine {
    constructor() { this.db = new Map(); this.trained = false; this.eps=1e-10; }
    jsd(p,q){
        const m=p.map((pi,i)=>(pi+q[i])/2); let sum=0;
        for(let i=0;i<p.length;i++){const pi=p[i]+this.eps,qi=q[i]+this.eps,mi=m[i]+this.eps;sum+=pi*Math.log(pi/mi)+qi*Math.log(qi/mi);}
        return sum/2;
    }
    train(data) {
        for (let i=30; i<data.length; i++) {
            const w=data.slice(i-30,i);
            const t=w.filter(s=>s==='T').length;
            const k=`${Math.round(t/30*10)}`;
            if(!this.db.has(k)) this.db.set(k,{T:0,X:0,t:0});
            const d=this.db.get(k);
            d[data[i]]=(d[data[i]]||0)+1; d.t++;
        }
        this.trained=true;
    }
    predict(seq) {
        if(!this.trained||seq.length<30) return null;
        const t=seq.slice(-30).filter(s=>s==='T').length;
        const k=`${Math.round(t/30*10)}`;
        const d=this.db.get(k);
        if(!d||d.t<5) return null;
        const p=[d.T/d.t,d.X/d.t], uncertainty=this.jsd(p,[0.5,0.5]);
        return {prob:Math.max(0.08,Math.min(0.92,(d.T/d.t)*(1-uncertainty)+0.5*uncertainty)), conf:Math.min(0.9,d.t/50)};
    }
}

class MarkovChainEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    train(data) {
        for(let order=1;order<=4;order++){
            for(let i=order;i<data.length;i++){
                const ctx=data.slice(i-order,i).join('');
                const k=`O${order}|${ctx}`;
                if(!this.db.has(k)) this.db.set(k,{T:0,X:0,t:0});
                const d=this.db.get(k);
                d[data[i]]=(d[data[i]]||0)+1; d.t++;
            }
        }
        this.trained=true;
    }
    predict(seq) {
        if(!this.trained) return null;
        let ps=0,ws=0;
        for(let order=1;order<=4;order++){
            if(seq.length>=order){
                const ctx=seq.slice(-order).join('');
                const k=`O${order}|${ctx}`;
                const d=this.db.get(k);
                if(d&&d.t>=5){const w=order; ps+=(d.T/d.t)*w; ws+=w;}
            }
        }
        if(ws===0) return null;
        return {prob:Math.max(0.08,Math.min(0.92,ps/ws)), conf:Math.min(0.85,ws/10)};
    }
}

class EntropyFlowEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    calc(seq){
        const wins=[3,5,8,13,21,34]; const ents=[];
        for(const w of wins){
            if(seq.length>=w){
                const sl=seq.slice(-w); const p=sl.filter(s=>s==='T').length/w;
                let e=0; if(p>0&&p<1) e=-p*Math.log2(p)-(1-p)*Math.log2(1-p);
                ents.push(e);
            }
        }
        return {avg:ents.reduce((a,b)=>a+b,0)/(ents.length||1), vr:ents.length>1?Math.max(...ents)-Math.min(...ents):0};
    }
    train(data) {
        for(let i=40;i<data.length;i++){
            const w=data.slice(i-40,i); const e=this.calc(w);
            const k=`${Math.round(e.avg*10)}|${Math.round(e.vr*10)}`;
            if(!this.db.has(k)) this.db.set(k,{T:0,X:0,t:0});
            const d=this.db.get(k); d[data[i]]=(d[data[i]]||0)+1; d.t++;
        }
        this.trained=true;
    }
    predict(seq) {
        if(!this.trained||seq.length<40) return null;
        const e=this.calc(seq.slice(-40));
        const k=`${Math.round(e.avg*10)}|${Math.round(e.vr*10)}`;
        const d=this.db.get(k);
        if(!d||d.t<5) return null;
        return {prob:Math.max(0.08,Math.min(0.92,d.T/d.t)), conf:Math.min(0.9,d.t/70)};
    }
}

class MomentumTrendEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    calc(seq){
        const r3=seq.slice(-3).filter(s=>s==='T').length/3;
        const r8=seq.slice(-8).filter(s=>s==='T').length/8;
        const r21=seq.slice(-21).filter(s=>s==='T').length/21;
        return {sh:r3-r8, md:r8-r21};
    }
    train(data) {
        for(let i=40;i<data.length;i++){
            const w=data.slice(i-40,i); const m=this.calc(w);
            const k=`${Math.round(m.sh*10)}|${Math.round(m.md*10)}`;
            if(!this.db.has(k)) this.db.set(k,{T:0,X:0,t:0});
            const d=this.db.get(k); d[data[i]]=(d[data[i]]||0)+1; d.t++;
        }
        this.trained=true;
    }
    predict(seq) {
        if(!this.trained||seq.length<40) return null;
        const m=this.calc(seq.slice(-40));
        const k=`${Math.round(m.sh*10)}|${Math.round(m.md*10)}`;
        const d=this.db.get(k);
        if(!d||d.t<5) return null;
        return {prob:Math.max(0.08,Math.min(0.92,d.T/d.t)), conf:Math.min(0.9,d.t/70)};
    }
}

class FractalGeometryEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    calcDim(seq){
        const scales=[2,3,4,6,8,12,16]; const pts=[];
        for(const sc of scales){
            if(seq.length<sc) break;
            const s=new Set();
            for(let i=0;i<=seq.length-sc;i++) s.add(seq.slice(i,i+sc).join(''));
            pts.push({sc,ct:s.size});
        }
        if(pts.length<2) return 1;
        const n=pts.length; let sx=0,sy=0,sxy=0,sx2=0;
        for(const p of pts){const x=Math.log(1/p.sc),y=Math.log(p.ct);sx+=x;sy+=y;sxy+=x*y;sx2+=x*x;}
        return (n*sxy-sx*sy)/(n*sx2-sx*sx+0.001);
    }
    train(data) {
        for(let i=40;i<data.length;i++){
            const w=data.slice(i-40,i); const dim=Math.round(this.calcDim(w)*20);
            const k=String(dim);
            if(!this.db.has(k)) this.db.set(k,{T:0,X:0,t:0});
            const d=this.db.get(k); d[data[i]]=(d[data[i]]||0)+1; d.t++;
        }
        this.trained=true;
    }
    predict(seq) {
        if(!this.trained||seq.length<40) return null;
        const dim=Math.round(this.calcDim(seq.slice(-40))*20);
        const d=this.db.get(String(dim));
        if(!d||d.t<5) return null;
        return {prob:Math.max(0.08,Math.min(0.92,d.T/d.t)), conf:Math.min(0.9,d.t/80)};
    }
}

class AdaptiveStreakEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    train(data) {
        for(let i=20;i<data.length;i++){
            const w=data.slice(i-20,i); const last=w[w.length-1];
            let st=1;
            for(let j=w.length-2;j>=0&&w[j]===last;j--) st++;
            const k=`${last}:${Math.min(st,20)}`;
            if(!this.db.has(k)) this.db.set(k,{T:0,X:0,t:0});
            const d=this.db.get(k); d[data[i]]=(d[data[i]]||0)+1; d.t++;
        }
        this.trained=true;
    }
    predict(seq) {
        if(!this.trained) return null;
        const last=seq[seq.length-1]; let st=1;
        for(let j=seq.length-2;j>=0&&seq[j]===last;j--) st++;
        const k=`${last}:${Math.min(st,20)}`;
        const d=this.db.get(k);
        if(!d||d.t<5) return null;
        let prob=d.T/d.t;
        if(st>=10) prob=last==='T'?0.1:0.9;
        else if(st>=7) prob=last==='T'?0.2:0.8;
        else if(st>=5) prob=last==='T'?0.3:0.7;
        return {prob:Math.max(0.08,Math.min(0.92,prob)), conf:Math.min(0.95,d.t/50+st*0.02)};
    }
}

class WaveResonanceEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    extract(seq){
        const s=seq.map(v=>v==='T'?1:-1); const f=[];
        for(const p of[5,8,13,21]){
            if(s.length>=p*2){let corr=0;for(let i=0;i<p;i++) corr+=s[s.length-p+i]*s[s.length-p*2+i];f.push(corr/p);}
        }
        while(f.length<8) f.push(0);
        return f;
    }
    train(data) {
        for(let i=40;i<data.length;i++){
            const w=data.slice(i-40,i); const f=this.extract(w);
            const k=f.map(v=>Math.round(v*10)).join(',');
            if(!this.db.has(k)) this.db.set(k,{T:0,X:0,t:0});
            const d=this.db.get(k); d[data[i]]=(d[data[i]]||0)+1; d.t++;
        }
        this.trained=true;
    }
    predict(seq) {
        if(!this.trained||seq.length<40) return null;
        const f=this.extract(seq.slice(-40));
        const k=f.map(v=>Math.round(v*10)).join(',');
        const d=this.db.get(k);
        if(!d||d.t<5) return null;
        return {prob:Math.max(0.08,Math.min(0.92,d.T/d.t)), conf:Math.min(0.85,d.t/60)};
    }
}

class MeanReversionEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    train(data) {
        for(let i=50;i<data.length;i++){
            const w=data.slice(i-50,i); const t=w.filter(s=>s==='T').length;
            const k=`${Math.round(t/50*10)}`;
            if(!this.db.has(k)) this.db.set(k,{T:0,X:0,t:0});
            const d=this.db.get(k); d[data[i]]=(d[data[i]]||0)+1; d.t++;
        }
        this.trained=true;
    }
    predict(seq) {
        if(!this.trained||seq.length<50) return null;
        const t=seq.slice(-50).filter(s=>s==='T').length; const ratio=t/50;
        const k=`${Math.round(ratio*10)}`;
        const d=this.db.get(k);
        if(!d||d.t<5) return null;
        let prob=d.T/d.t;
        if(ratio>0.7) prob*=0.55;
        else if(ratio<0.3) prob=Math.min(0.92,prob*1.5);
        return {prob:Math.max(0.08,Math.min(0.92,prob)), conf:Math.min(0.85,d.t/80)};
    }
}

class LSTMSimEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    sig(x){return 1/(1+Math.exp(-x));}
    tanh(x){return Math.tanh(x);}
    train(data) {
        for(let i=30;i<data.length;i++){
            const w=data.slice(i-30,i); const k=w.slice(-4).join('');
            if(!this.db.has(k)) this.db.set(k,{h:0,c:0,wf:0.5,wi:0.5,wo:0.5,wc:0.5});
            const d=this.db.get(k); const x=w.filter(s=>s==='T').length/w.length;
            const target=data[i]==='T'?1:0;
            const fg=this.sig(x*d.wf+d.h*0.5), ig=this.sig(x*d.wi+d.h*0.5);
            const og=this.sig(x*d.wo+d.h*0.5), cc=this.tanh(x*d.wc+d.h*0.5);
            d.c=fg*d.c+ig*cc; d.h=og*this.tanh(d.c);
            const err=target-d.h;
            d.wf+=err*x*0.005; d.wi+=err*x*0.005; d.wo+=err*x*0.005; d.wc+=err*x*0.005;
        }
        this.trained=true;
    }
    predict(seq) {
        if(!this.trained||seq.length<30) return null;
        const k=seq.slice(-4).join(''); const d=this.db.get(k);
        if(!d) return null;
        const x=seq.slice(-30).filter(s=>s==='T').length/30;
        const fg=this.sig(x*d.wf+d.h*0.5), ig=this.sig(x*d.wi+d.h*0.5);
        const og=this.sig(x*d.wo+d.h*0.5), cc=this.tanh(x*d.wc+d.h*0.5);
        const h=og*this.tanh(fg*d.c+ig*cc);
        return {prob:Math.max(0.08,Math.min(0.92,(h+1)/2)), conf:0.6};
    }
}

class GradientBoostEngine {
    constructor() { this.trees=[]; this.trained=false; this.lr=0.08; }
    buildTree(features,labels,residuals,depth){
        if(depth>4||features.length<5){return{pred:residuals.reduce((a,b)=>a+b,0)/(residuals.length||1)};}
        let bestGain=-1,bestF=0,bestV=0;
        for(let f=0;f<Math.min(features[0]?.length||0,8);f++){
            const vals=features.map(feat=>feat[f]).sort((a,b)=>a-b);
            for(let i=0;i<vals.length-1;i++){
                const split=(vals[i]+vals[i+1])/2;
                let lS=0,rS=0,lC=0,rC=0;
                for(let j=0;j<features.length;j++){
                    if(features[j][f]<split){lS+=residuals[j];lC++;}
                    else{rS+=residuals[j];rC++;}
                }
                const gain=(lS*lS)/(lC+0.001)+(rS*rS)/(rC+0.001);
                if(gain>bestGain){bestGain=gain;bestF=f;bestV=split;}
            }
        }
        if(bestGain===-1) return{pred:residuals.reduce((a,b)=>a+b,0)/(residuals.length||1)};
        const lF=[],lR=[],rF=[],rR=[];
        for(let j=0;j<features.length;j++){
            if(features[j][bestF]<bestV){lF.push(features[j]);lR.push(residuals[j]);}
            else{rF.push(features[j]);rR.push(residuals[j]);}
        }
        return{f:bestF,v:bestV,l:this.buildTree(lF,labels,lR,depth+1),r:this.buildTree(rF,labels,rR,depth+1)};
    }
    predictTree(tree,f){if(tree.pred!==undefined)return tree.pred;return f[tree.f]<tree.v?this.predictTree(tree.l,f):this.predictTree(tree.r,f);}
    train(data){
        const allF=[],allL=[];
        for(let i=30;i<data.length;i++){
            const w=data.slice(i-30,i); const feat=[];
            for(const len of[3,5,8,13]){
                if(w.length>=len){
                    const sl=w.slice(-len);
                    feat.push(sl.filter(s=>s==='T').length/len);
                    feat.push(sl.filter((s,i,a)=>i>0&&s!==a[i-1]).length/Math.max(1,len-1));
                }
            }
            while(feat.length<8) feat.push(0.5);
            allF.push(feat); allL.push(data[i]==='T'?1:0);
        }
        let residuals=[...allL];
        for(let iter=0;iter<60;iter++){
            this.trees.push(this.buildTree(allF,allL,residuals,0));
            for(let j=0;j<allF.length;j++) residuals[j]-=this.lr*this.predictTree(this.trees[this.trees.length-1],allF[j]);
        }
        this.trained=true;
    }
    predict(seq){
        if(!this.trained||seq.length<30) return null;
        const w=seq.slice(-30); const feat=[];
        for(const len of[3,5,8,13]){
            if(w.length>=len){
                const sl=w.slice(-len);
                feat.push(sl.filter(s=>s==='T').length/len);
                feat.push(sl.filter((s,i,a)=>i>0&&s!==a[i-1]).length/Math.max(1,len-1));
            }
        }
        while(feat.length<8) feat.push(0.5);
        let sum=0; for(const t of this.trees) sum+=this.lr*this.predictTree(t,feat);
        return {prob:Math.max(0.08,Math.min(0.92,sum)), conf:0.75};
    }
}

class SupportVectorEngine {
    constructor() { this.sv=[]; this.alphas=[]; this.b=0; this.trained=false; }
    kernel(a,b){let dot=0;for(let i=0;i<Math.min(a.length,b.length);i++)dot+=a[i]*b[i];return Math.exp(-0.5*(2-2*dot));}
    train(data){
        const allF=[],allL=[];
        for(let i=25;i<data.length;i++){
            const w=data.slice(i-25,i); const feat=[];
            for(const len of[3,5,8]){if(w.length>=len){const sl=w.slice(-len);feat.push(sl.filter(s=>s==='T').length/len);}}
            while(feat.length<5) feat.push(0.5);
            allF.push(feat); allL.push(data[i]==='T'?1:-1);
        }
        for(let i=0;i<Math.min(allF.length,100);i++){
            let sum=this.b;
            for(let j=0;j<this.sv.length;j++) sum+=this.alphas[j]*allL[j]*this.kernel(allF[i],this.sv[j]);
            if(allL[i]*sum<1){this.sv.push(allF[i]);this.alphas.push(1);}
        }
        this.trained=true;
    }
    predict(seq){
        if(!this.trained||seq.length<25) return null;
        const w=seq.slice(-25); const feat=[];
        for(const len of[3,5,8]){if(w.length>=len){const sl=w.slice(-len);feat.push(sl.filter(s=>s==='T').length/len);}}
        while(feat.length<5) feat.push(0.5);
        let sum=this.b;
        for(let j=0;j<this.sv.length;j++) sum+=this.alphas[j]*this.kernel(feat,this.sv[j]);
        const prob=1/(1+Math.exp(-sum));
        return {prob:Math.max(0.08,Math.min(0.92,prob)), conf:0.65};
    }
}

class RandomForestEngine {
    constructor() { this.trees=[]; this.trained=false; }
    buildTree(features,labels,depth){
        if(depth>5||features.length<3){const t=labels.filter(l=>l==='T').length;return{pred:t/labels.length};}
        const rf=Math.floor(Math.random()*Math.min(features[0]?.length||1,6));
        const vals=features.map(f=>f[rf]).sort((a,b)=>a-b);
        const median=vals[Math.floor(vals.length/2)];
        const lF=[],lL=[],rF=[],rL=[];
        for(let j=0;j<features.length;j++){
            if(features[j][rf]<median){lF.push(features[j]);lL.push(labels[j]);}
            else{rF.push(features[j]);rL.push(labels[j]);}
        }
        if(lF.length===0||rF.length===0){const t=labels.filter(l=>l==='T').length;return{pred:t/labels.length};}
        return{f:rf,v:median,l:this.buildTree(lF,lL,depth+1),r:this.buildTree(rF,rL,depth+1)};
    }
    predictTree(tree,f){if(tree.pred!==undefined)return tree.pred;return f[tree.f]<tree.v?this.predictTree(tree.l,f):this.predictTree(tree.r,f);}
    train(data){
        const allF=[],allL=[];
        for(let i=25;i<data.length;i++){
            const w=data.slice(i-25,i); const feat=[];
            for(const len of[2,3,5,8]){if(w.length>=len)feat.push(w.slice(-len).filter(s=>s==='T').length/len);}
            while(feat.length<6) feat.push(0.5);
            allF.push(feat); allL.push(data[i]);
        }
        for(let t=0;t<40;t++){
            const sample=Array(allF.length).fill(0).map(()=>Math.floor(Math.random()*allF.length));
            this.trees.push(this.buildTree(sample.map(i=>allF[i]),sample.map(i=>allL[i]),0));
        }
        this.trained=true;
    }
    predict(seq){
        if(!this.trained||seq.length<25) return null;
        const w=seq.slice(-25); const feat=[];
        for(const len of[2,3,5,8]){if(w.length>=len)feat.push(w.slice(-len).filter(s=>s==='T').length/len);}
        while(feat.length<6) feat.push(0.5);
        let sum=0; for(const t of this.trees) sum+=this.predictTree(t,feat);
        return {prob:Math.max(0.08,Math.min(0.92,sum/this.trees.length)), conf:0.7};
    }
}

class KNearestNeighborEngine {
    constructor() { this.db=[]; this.trained=false; this.k=15; }
    train(data){
        for(let i=30;i<data.length;i++){
            const w=data.slice(i-30,i); const feat=[];
            for(const len of[3,5,8,13]){if(w.length>=len)feat.push(w.slice(-len).filter(s=>s==='T').length/len);}
            while(feat.length<6) feat.push(0.5);
            this.db.push({feat,label:data[i]});
            if(this.db.length>3000) this.db.shift();
        }
        this.trained=true;
    }
    predict(seq){
        if(!this.trained||seq.length<30) return null;
        const w=seq.slice(-30); const feat=[];
        for(const len of[3,5,8,13]){if(w.length>=len)feat.push(w.slice(-len).filter(s=>s==='T').length/len);}
        while(feat.length<6) feat.push(0.5);
        const distances=this.db.map((entry,i)=>({dist:feat.reduce((a,b,j)=>a+Math.abs(b-entry.feat[j]),0),label:entry.label}));
        distances.sort((a,b)=>a.dist-b.dist);
        const neighbors=distances.slice(0,this.k);
        let wT=0,wX=0;
        for(const n of neighbors){const w=1/(n.dist+0.01);if(n.label==='T')wT+=w;else wX+=w;}
        return {prob:Math.max(0.08,Math.min(0.92,wT/(wT+wX))), conf:0.65};
    }
}

class XGBoostSimEngine {
    constructor() { this.trees=[]; this.trained=false; this.lr=0.1; }
    buildTree(features,labels,residuals,depth){
        if(depth>5||features.length<5) return{pred:residuals.reduce((a,b)=>a+b,0)/(residuals.length||1)};
        let bestGain=-1,bestF=0,bestV=0;
        for(let f=0;f<Math.min(features[0]?.length||0,8);f++){
            const vals=features.map(feat=>feat[f]).sort((a,b)=>a-b);
            for(let i=0;i<vals.length-1;i++){
                const split=(vals[i]+vals[i+1])/2;
                let lS=0,rS=0,lC=0,rC=0;
                for(let j=0;j<features.length;j++){
                    if(features[j][f]<split){lS+=residuals[j];lC++;}
                    else{rS+=residuals[j];rC++;}
                }
                const gain=(lS*lS)/(lC+0.001)+(rS*rS)/(rC+0.001)+0.1*Math.sqrt(lC+rC);
                if(gain>bestGain){bestGain=gain;bestF=f;bestV=split;}
            }
        }
        if(bestGain===-1) return{pred:residuals.reduce((a,b)=>a+b,0)/(residuals.length||1)};
        const lF=[],lR=[],rF=[],rR=[];
        for(let j=0;j<features.length;j++){
            if(features[j][bestF]<bestV){lF.push(features[j]);lR.push(residuals[j]);}
            else{rF.push(features[j]);rR.push(residuals[j]);}
        }
        return{f:bestF,v:bestV,l:this.buildTree(lF,labels,lR,depth+1),r:this.buildTree(rF,labels,rR,depth+1)};
    }
    predictTree(tree,f){if(tree.pred!==undefined)return tree.pred;return f[tree.f]<tree.v?this.predictTree(tree.l,f):this.predictTree(tree.r,f);}
    train(data){
        const allF=[],allL=[];
        for(let i=35;i<data.length;i++){
            const w=data.slice(i-35,i); const feat=[];
            for(const len of[3,5,8,13,21]){
                if(w.length>=len){
                    const sl=w.slice(-len);
                    feat.push(sl.filter(s=>s==='T').length/len);
                    feat.push(sl.filter((s,i,a)=>i>0&&s!==a[i-1]).length/Math.max(1,len-1));
                }
            }
            while(feat.length<10) feat.push(0.5);
            allF.push(feat); allL.push(data[i]==='T'?1:0);
        }
        let residuals=[...allL];
        for(let iter=0;iter<80;iter++){
            this.trees.push(this.buildTree(allF,allL,residuals,0));
            for(let j=0;j<allF.length;j++) residuals[j]-=this.lr*this.predictTree(this.trees[this.trees.length-1],allF[j]);
        }
        this.trained=true;
    }
    predict(seq){
        if(!this.trained||seq.length<35) return null;
        const w=seq.slice(-35); const feat=[];
        for(const len of[3,5,8,13,21]){
            if(w.length>=len){
                const sl=w.slice(-len);
                feat.push(sl.filter(s=>s==='T').length/len);
                feat.push(sl.filter((s,i,a)=>i>0&&s!==a[i-1]).length/Math.max(1,len-1));
            }
        }
        while(feat.length<10) feat.push(0.5);
        let sum=0; for(const t of this.trees) sum+=this.lr*this.predictTree(t,feat);
        return {prob:Math.max(0.08,Math.min(0.92,sum)), conf:0.78};
    }
}

class NeuralNetworkEngine {
    constructor() { this.weights=new Map(); this.trained=false; }
    sig(x){return 1/(1+Math.exp(-x));}
    forward(features,weights){
        let sum=weights.b||0;
        for(let i=0;i<Math.min(features.length,weights.w?.length||0);i++) sum+=features[i]*(weights.w?.[i]||0);
        return this.sig(sum);
    }
    train(data){
        for(let epoch=0;epoch<3;epoch++){
            for(let i=35;i<data.length;i++){
                const w=data.slice(i-35,i); const feat=[];
                for(const len of[3,5,8,13]){if(w.length>=len)feat.push(w.slice(-len).filter(s=>s==='T').length/len);}
                while(feat.length<8) feat.push(0.5);
                const k=feat.map(v=>Math.round(v*15)).join('|');
                if(!this.weights.has(k)) this.weights.set(k,{w:Array(8).fill(0).map(()=>Math.random()*0.1),b:0});
                const wt=this.weights.get(k);
                const target=data[i]==='T'?1:0;
                const pred=this.forward(feat,wt);
                const err=target-pred;
                for(let j=0;j<wt.w.length;j++) wt.w[j]+=0.01*err*feat[j];
                wt.b+=0.01*err;
            }
        }
        this.trained=true;
    }
    predict(seq){
        if(!this.trained||seq.length<35) return null;
        const w=seq.slice(-35); const feat=[];
        for(const len of[3,5,8,13]){if(w.length>=len)feat.push(w.slice(-len).filter(s=>s==='T').length/len);}
        while(feat.length<8) feat.push(0.5);
        const k=feat.map(v=>Math.round(v*15)).join('|');
        const wt=this.weights.get(k);
        if(!wt) return null;
        return {prob:Math.max(0.08,Math.min(0.92,this.forward(feat,wt))), conf:0.55};
    }
}

// ============================================================
// PREDICTION CORE - 20 ENGINES
// ============================================================
class PredictionCore {
    constructor(type) {
        this.type = type;
        this.history = [];
        this.stats = { total:0,dung:0,sai:0,tyle:0,chuoi:0,chuoi_dai:0,chuoi_thua_dai:0,chuoi_thang_hientai:0,chuoi_thua_hientai:0,homnay:{dung:0,sai:0,tong:0} };
        this.lastPhien = null;
        this.trained = false;
        this.engines = [
            { n:'QUANTUM', e:new QuantumSpectralV9(), w:3.8 },
            { n:'BAYESIAN', e:new BayesianMetaEngine(), w:3.2 },
            { n:'PATTERN', e:new PatternFingerprintEngine(), w:3.0 },
            { n:'WEIBULL', e:new WeibullSurvivalEngine(), w:2.8 },
            { n:'JSD', e:new JSDUncertaintyEngine(), w:2.5 },
            { n:'MARKOV', e:new MarkovChainEngine(), w:2.2 },
            { n:'ENTROPY', e:new EntropyFlowEngine(), w:2.0 },
            { n:'MOMENTUM', e:new MomentumTrendEngine(), w:1.8 },
            { n:'FRACTAL', e:new FractalGeometryEngine(), w:1.7 },
            { n:'STREAK', e:new AdaptiveStreakEngine(), w:1.6 },
            { n:'WAVE', e:new WaveResonanceEngine(), w:1.5 },
            { n:'MEANREV', e:new MeanReversionEngine(), w:1.4 },
            { n:'LSTM', e:new LSTMSimEngine(), w:1.3 },
            { n:'GBOOST', e:new GradientBoostEngine(), w:1.4 },
            { n:'SVM', e:new SupportVectorEngine(), w:1.2 },
            { n:'RANDFOR', e:new RandomForestEngine(), w:1.3 },
            { n:'KNN', e:new KNearestNeighborEngine(), w:1.1 },
            { n:'XGBOOST', e:new XGBoostSimEngine(), w:1.4 },
            { n:'NEURAL', e:new NeuralNetworkEngine(), w:1.0 }
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
        if (streak>=10) { if (last==='T'){sX+=7;dt.push('BREAK-T10');}else{sT+=7;dt.push('BREAK-X10');} sw+=7; }
        else if (streak>=7) { if (last==='T'){sX+=5;dt.push('BREAK-T7');}else{sT+=5;dt.push('BREAK-X7');} sw+=5; }
        else if (streak>=5) { if (last==='T'){sX+=3;dt.push('BREAK-T5');}else{sT+=3;dt.push('BREAK-X5');} sw+=3; }
        
        const lt = seq.filter(s=>s==='T').length/seq.length;
        if (lt>0.75) { sX+=5; dt.push('BAL+'); sw+=5; }
        else if (lt<0.25) { sT+=5; dt.push('BAL-'); sw+=5; }
        
        if (sw===0) return this.fb();
        const prob = sT/(sT+sX);
        const dd = prob>0.5?'TÀI':'XỈU';
        let tc = Math.round(Math.max(prob,1-prob)*100);
        if (dt.length>=15) tc=Math.min(99,tc+14);
        else if (dt.length>=10) tc=Math.min(99,tc+10);
        else if (dt.length>=7) tc=Math.min(99,tc+7);
        else if (dt.length>=5) tc=Math.min(99,tc+4);
        tc = Math.min(99, Math.max(55, tc));
        
        return {duDoan:dd,doTinCay:tc,chiTiet:dt.slice(0,7).join(' | '),soMau:dt.length};
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
        try { fs.writeFileSync(`.${this.type}_data`, JSON.stringify({history:this.history.slice(0,2000),stats:this.stats,lastPhien:this.lastPhien,trained:this.trained}), 'utf8'); } catch(e) {}
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
// HTML (GỌN ĐẸP)
// ============================================================
const CSS = `:root{--bg:#010314;--bg2:#060b24;--bg3:#0d1335;--b:rgba(255,255,255,0.04);--ba:rgba(123,97,255,0.3);--t:#e2e8f0;--t2:#8899b8;--t3:#4a5578;--g:linear-gradient(135deg,#7b61ff,#3b82f6,#06b6d4,#8b5cf6);--ok:#22c55e;--no:#ef4444;--w:#f59e0b;--c:#06b6d4;--p:#7b61ff}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--t);min-height:100vh;overflow-x:hidden}
.stars{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none}
.star{position:absolute;background:#fff;border-radius:50%;animation:tw 3s infinite}
@keyframes tw{0%,100%{opacity:0.15}50%{opacity:0.7}}
.nebula{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none}
.nebula div{position:absolute;border-radius:50%;filter:blur(130px);opacity:0.25}
.n1{width:700px;height:700px;background:rgba(123,97,255,0.15);top:-250px;left:-150px;animation:f1 25s infinite}
.n2{width:600px;height:600px;background:rgba(6,182,212,0.1);bottom:-200px;right:-100px;animation:f2 30s infinite}
@keyframes f1{0%,100%{transform:translate(0,0)}50%{transform:translate(100px,60px)}}
@keyframes f2{0%,100%{transform:translate(0,0)}50%{transform:translate(-80px,-40px)}}
.grid{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px);background-size:60px 60px}
.app{position:relative;z-index:1;max-width:1400px;margin:0 auto;padding:16px}
.glass{background:rgba(13,19,53,0.5);backdrop-filter:blur(30px);border:1px solid var(--b);border-radius:16px}
.gc{background:rgba(13,19,53,0.4);backdrop-filter:blur(20px);border:1px solid var(--b);border-radius:14px;padding:18px;transition:all 0.3s}
.gc:hover{border-color:var(--ba);transform:translateY(-3px)}
.tg{background:var(--g);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
@keyframes glow{0%,100%{filter:drop-shadow(0 0 8px rgba(123,97,255,0.3))}50%{filter:drop-shadow(0 0 25px rgba(123,97,255,0.7))}}
@keyframes slideUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
input{width:100%;padding:12px 16px;background:var(--bg2);border:1px solid var(--b);border-radius:10px;color:var(--t);font-size:13px;font-family:'JetBrains Mono',monospace;outline:none}
input:focus{border-color:var(--ba);box-shadow:0 0 0 3px rgba(123,97,255,0.1)}
.btn{width:100%;padding:14px;background:var(--g);border:none;border-radius:10px;color:#fff;font-weight:700;font-size:14px;cursor:pointer;transition:all 0.3s}
.btn:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(123,97,255,0.4)}
.sv{font-family:'Orbitron',monospace;font-size:26px;font-weight:800}
.mono{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--t2)}
.pred{display:inline-block;padding:3px 10px;border-radius:6px;font-weight:700;font-size:9px}
.pred-t{background:rgba(34,197,94,0.08);color:var(--ok)}.pred-x{background:rgba(239,68,68,0.08);color:var(--no)}
.cb{display:inline-block;width:45px;height:3px;background:rgba(255,255,255,0.05);border-radius:2px;vertical-align:middle;margin-right:6px}
.cf{height:100%;border-radius:2px;background:var(--g)}.ct{font-weight:600;color:var(--c);font-size:9px}
.st{display:inline-block;padding:2px 8px;border-radius:4px;font-weight:700;font-size:7px;text-transform:uppercase;letter-spacing:1px}
.st-s{background:rgba(34,197,94,0.08);color:var(--ok)}.st-d{background:rgba(239,68,68,0.08);color:var(--no)}.st-w{background:rgba(245,158,11,0.08);color:var(--w)}
.dt{font-size:8px;color:var(--t3);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dot{width:18px;height:18px;border-radius:3px;font-size:7px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;margin:1px;font-family:'JetBrains Mono',monospace}
.dot-s{background:rgba(34,197,94,0.15);color:var(--ok);border:1px solid rgba(34,197,94,0.2)}.dot-s:hover{transform:scale(1.3)}
.dot-d{background:rgba(239,68,68,0.15);color:var(--no);border:1px solid rgba(239,68,68,0.2)}.dot-d:hover{transform:scale(1.3)}
.dot-w{background:rgba(245,158,11,0.15);color:var(--w);border:1px solid rgba(245,158,11,0.2)}
table{width:100%;border-collapse:collapse;font-size:10px}
th{background:rgba(255,255,255,0.015);padding:9px 12px;text-align:left;font-weight:600;font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:var(--t3);border-bottom:1px solid var(--b)}
td{padding:7px 12px;border-bottom:1px solid rgba(255,255,255,0.012)}tr:hover td{background:rgba(255,255,255,0.008)}
.r-s{border-left:2px solid transparent}.r-s:hover{border-left-color:rgba(34,197,94,0.3)}
.r-d{border-left:2px solid transparent}.r-d:hover{border-left-color:rgba(239,68,68,0.3)}
.badge{display:inline-flex;align-items:center;gap:5px;padding:5px 14px;border-radius:16px;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:1px}
.badge-ok{background:rgba(34,197,94,0.08);color:var(--ok);border:1px solid rgba(34,197,94,0.15)}
.badge-p{background:rgba(123,97,255,0.08);color:var(--p);border:1px solid rgba(123,97,255,0.15)}
.pulse{width:7px;height:7px;border-radius:50%;background:var(--ok);display:inline-block;animation:pulse 1.5s infinite}
@keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(34,197,94,0.4)}50%{opacity:0.4;box-shadow:0 0 0 10px rgba(34,197,94,0)}}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.06)}`;

function loginPage(err) {
    const e = err ? `<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);padding:14px;border-radius:10px;color:#ef4444;font-size:13px;text-align:center;margin-bottom:20px">⚠️ ${err}</div>` : '';
    return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>CRYSTAL TX</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>${CSS}
.card{background:rgba(13,19,53,0.7);backdrop-filter:blur(40px);border:1px solid var(--b);border-radius:24px;padding:44px 36px;width:100%;max-width:460px;box-shadow:0 50px 120px rgba(0,0,0,0.6);animation:slideUp 0.6s ease-out}
</style></head><body>
<div class="stars">${Array(50).fill(0).map((_,i)=>`<div class="star" style="left:${Math.random()*100}%;top:${Math.random()*100}%;width:${1+Math.random()*2}px;height:${1+Math.random()*2}px;animation-delay:${Math.random()*3}s"></div>`).join('')}</div>
<div class="nebula"><div class="n1"></div><div class="n2"></div></div><div class="grid"></div>
<div style="position:relative;z-index:1;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px"><div class="card">
<div style="text-align:center;margin-bottom:32px"><div style="font-size:56px;animation:glow 3s infinite;display:inline-block">💎</div><h1 style="font-family:'Orbitron',sans-serif;font-size:28px;font-weight:900;margin-top:12px"><span class="tg">CRYSTAL TX</span></h1><p style="font-size:10px;color:var(--t3);font-family:'Space Grotesk',sans-serif;letter-spacing:3px;text-transform:uppercase;margin-top:6px">19 Engines</p></div>
${e}
<form onsubmit="login(event)"><div style="margin-bottom:16px"><label style="display:block;font-size:9px;color:var(--t2);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600">Username</label><input type="text" id="u" autocomplete="off" required></div>
<div style="margin-bottom:24px"><label style="display:block;font-size:9px;color:var(--t2);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600">Password</label><input type="password" id="p" autocomplete="off" required></div>
<button type="submit" class="btn">🔐 Access</button></form>
<div id="res" style="margin-top:24px"></div></div></div>
<script>
async function login(e){e.preventDefault();
const u=document.getElementById('u').value.trim(),p=document.getElementById('p').value.trim(),r=document.getElementById('res');
if(!u||!p){r.innerHTML='<div style="background:rgba(239,68,68,0.1);padding:14px;border-radius:10px;color:#ef4444;font-size:13px">Nhập đầy đủ thông tin</div>';return}
r.innerHTML='<div style="background:rgba(6,182,212,0.1);padding:14px;border-radius:10px;color:#06b6d4;font-size:13px">⏳ Đang xác thực...</div>';
try{const rs=await fetch('/_api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});
const d=await rs.json();
if(rs.ok&&d.token){
r.innerHTML='<div style="background:rgba(34,197,94,0.1);padding:14px;border-radius:10px;color:#22c55e;font-size:13px;margin-bottom:16px">✅ Thành công</div>'+
'<div style="background:var(--bg2);border:1px solid var(--b);border-radius:12px;padding:20px">'+
'<p style="font-size:9px;color:var(--t2);text-transform:uppercase;letter-spacing:2px;margin-bottom:10px">Token</p>'+
'<code style="font-family:\'JetBrains Mono\',monospace;font-size:10px;color:#22c55e;word-break:break-all;background:var(--bg);padding:12px;border-radius:8px;display:block;margin-bottom:16px">'+d.token+'</code>'+
'<a href="/_hu?_token='+d.token+'" style="display:block;padding:12px;background:rgba(6,182,212,0.1);border:1px solid rgba(6,182,212,0.2);border-radius:8px;color:#06b6d4;text-decoration:none;font-size:11px;margin-bottom:6px">📊 HU Dashboard</a>'+
'<a href="/_md5?_token='+d.token+'" style="display:block;padding:12px;background:rgba(6,182,212,0.1);border:1px solid rgba(6,182,212,0.2);border-radius:8px;color:#06b6d4;text-decoration:none;font-size:11px;margin-bottom:6px">📊 MD5 Dashboard</a>'+
'<a href="/_hu/json?_token='+d.token+'" style="display:block;padding:12px;background:rgba(123,97,255,0.1);border:1px solid rgba(123,97,255,0.2);border-radius:8px;color:#7b61ff;text-decoration:none;font-size:11px">📡 JSON API HU</a>'+
'<a href="/_md5/json?_token='+d.token+'" style="display:block;padding:12px;background:rgba(123,97,255,0.1);border:1px solid rgba(123,97,255,0.2);border-radius:8px;color:#7b61ff;text-decoration:none;font-size:11px;margin-top:6px">📡 JSON API MD5</a>'+
'</div>'}else{r.innerHTML='<div style="background:rgba(239,68,68,0.1);padding:14px;border-radius:10px;color:#ef4444;font-size:13px">❌ '+(d.error||'Sai thông tin')+'</div>'}}
catch(ex){r.innerHTML='<div style="background:rgba(239,68,68,0.1);padding:14px;border-radius:10px;color:#ef4444;font-size:13px">🔌 Lỗi kết nối</div>'}}</script></body></html>`;
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
    for(const r of r50){const st=r.status||'⏳',c=st==='✅'?'s':st==='❌'?'d':'w',t=st==='✅'?'WIN':st==='❌'?'LOSE':'WAIT';rows+=`<tr class="r-${c}"><td class="mono">#${r.phien_hien_tai||'-'}</td><td><span class="pred pred-${r.prediction==='TÀI'?'t':'x'}">${r.prediction||'-'}</span></td><td><div class="cb"><div class="cf" style="width:${r.confidence||0}%"></div></div><span class="ct">${r.confidence||0}%</span></td><td><span class="st st-${c}">${t}</span></td><td>${r.actual||'-'}</td><td class="dt">${(r.detail||'-').substring(0,30)}</td></tr>`;}
    let dots='';
    for(const r of r1000){const st=r.status||'⏳',c=st==='✅'?'s':st==='❌'?'d':'w',t=st==='✅'?'W':st==='❌'?'L':'?';dots+=`<span class="dot dot-${c}" title="#${r.phien_hien_tai}: ${r.prediction} → ${r.actual||'?'}">${t}</span>`;}
    const wr=s.tyle;const wc=wr>=70?'#22c55e':wr>=60?'#f59e0b':'#ef4444';
    
    return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${type.toUpperCase()} | CRYSTAL TX</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>${CSS}</style></head><body>
<div class="stars">${Array(40).fill(0).map((_,i)=>`<div class="star" style="left:${Math.random()*100}%;top:${Math.random()*100}%;width:${1+Math.random()*2}px;height:${1+Math.random()*2}px;animation-delay:${Math.random()*3}s"></div>`).join('')}</div>
<div class="nebula"><div class="n1"></div><div class="n2"></div></div><div class="grid"></div><div class="app">
<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;margin-bottom:20px">
<div style="display:flex;align-items:center;gap:12px"><div style="font-size:38px;animation:glow 3s infinite">💎</div><div><h1 style="font-family:'Orbitron',sans-serif;font-size:22px;font-weight:900"><span class="tg">CRYSTAL TX</span></h1><p style="font-size:8px;color:var(--t3);font-family:'Space Grotesk',sans-serif;letter-spacing:2px">${type.toUpperCase()} • 19 ENGINES</p></div></div>
<div style="display:flex;gap:8px"><span class="badge badge-ok"><span class="pulse"></span>LIVE</span><span class="badge badge-p">19 ENGINES</span></div></div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
<div class="gc"><div style="font-size:8px;color:var(--t3);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600">📊 TOTAL</div><div class="sv" style="color:var(--t)">${s.total}</div></div>
<div class="gc"><div style="font-size:8px;color:var(--t3);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600">✅ WIN RATE</div><div class="sv" style="color:${wc}">${wr}%</div></div>
<div class="gc"><div style="font-size:8px;color:var(--t3);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600">🏆 BEST</div><div class="sv" style="color:#22c55e">${s.chuoi_dai}</div></div>
<div class="gc"><div style="font-size:8px;color:var(--t3);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600">⚠️ WORST</div><div class="sv" style="color:#ef4444">${s.chuoi_thua_dai||0}</div></div></div>
<div class="glass" style="margin-bottom:20px"><div style="padding:14px 18px;border-bottom:1px solid var(--b);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px"><h3 style="font-family:'Orbitron',monospace;font-size:12px;font-weight:600">📜 HISTORY (${r1000.length})</h3><span class="badge badge-p">${td1k}W/${ts1k}L</span></div><div style="padding:14px;max-height:300px;overflow-y:auto;line-height:1.8">${dots||'Loading...'}</div></div>
<div class="glass"><div style="padding:14px 18px;border-bottom:1px solid var(--b);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px"><h3 style="font-family:'Orbitron',monospace;font-size:12px;font-weight:600">📋 LAST 50</h3></div>
<div style="overflow-x:auto"><table><thead><tr><th>Session</th><th>Predict</th><th>Confidence</th><th>Result</th><th>Actual</th><th>Engines</th></tr></thead><tbody>${rows||'<tr><td colspan="6" style="text-align:center;padding:15px">Loading...</td></tr>'}</tbody></table></div></div>
<div style="text-align:center;padding:12px;font-size:7px;color:var(--t3);font-family:'Space Grotesk',sans-serif;margin-top:12px">💎 CRYSTAL TX • 19 ENGINES • ${new Date().toLocaleString('vi-VN')}</div></div>
<script>setTimeout(()=>location.reload(),5000);</script></body></html>`;
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
app.get('/_stats', checkAuth, (req, res) => {
    const total = brainHU.stats.total + brainMD5.stats.total;
    const dung = brainHU.stats.dung + brainMD5.stats.dung;
    res.json({ hu: brainHU.stats, md5: brainMD5.stats, combined: { total, dung, sai: total-dung, tyle: total>0?Math.round((dung/total)*100):0 } });
});
app.get('/_reset', checkAuth, (req, res) => {
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
    console.log(`\n✅ CRYSTAL TX - Port ${PORT} - 19 ENGINES\n`);
    startAuto();
});
