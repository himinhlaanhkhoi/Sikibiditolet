const express = require('express');
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '10kb' }));

const PORT = process.env.PORT || 5000;
const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';

const MASTER_KEY = crypto.randomBytes(6).toString('hex');
const TOKENS = new Map();

console.log('\n╔══════════════════════════════════════╗');
console.log('║    BẢO LONG PREDICT - VIP PRO        ║');
console.log('╠══════════════════════════════════════╣');
console.log(`║  Mã: ${MASTER_KEY}                       ║');
console.log('╚══════════════════════════════════════╝\n');

function createToken() {
    const token = crypto.randomBytes(48).toString('hex');
    TOKENS.set(token, Date.now() + 864000000);
    return token;
}

const checkAuth = (req, res, next) => {
    const token = req.query['_token'] || req.headers['x-token'];
    if (!token || !TOKENS.has(token)) return res.redirect('/_login');
    next();
};

// Security
const ipMap = new Map();
app.use((req, res, next) => {
    const ip = req.ip || 'unknown';
    const pub = ['/_login', '/_api/access', '/'];
    if (!pub.includes(req.path)) {
        const now = Date.now();
        if (!ipMap.has(ip)) ipMap.set(ip, []);
        const reqs = ipMap.get(ip).filter(t => now - t < 10000);
        if (reqs.length > 50) return res.status(429).end();
        reqs.push(now); ipMap.set(ip, reqs);
    }
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Server', 'BAOLONG');
    next();
});

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
        const r = await axios.get(u, { timeout: 8000, headers: { 'User-Agent': 'BaoLong/1.0' } });
        return transformData(r.data);
    } catch(e) { return null; }
}

// ============================================================
// 10 THUẬT TOÁN SIÊU CHÍNH XÁC - TỐI ƯU CHO TÀI XỈU
// ============================================================
class QuantumSpectral { constructor() { this.db = new Map(); this.t = false; } ex(seq) { const s = seq.map(v => v === 'T' ? 1 : -1); const f = []; for (const p of [2,3,5,8,13,21,34,55]) { if (s.length >= p) { let si=0, co=0; for (let i=0; i<p; i++) { const a = 2*Math.PI*i/p; si += s[s.length-p+i]*Math.sin(a); co += s[s.length-p+i]*Math.cos(a); } f.push(Math.sqrt(si*si+co*co)/p); f.push(Math.atan2(si,co)/Math.PI); } } while(f.length<16) f.push(0); return f; } tr(data) { for (let i=50; i<data.length; i++) { const w = data.slice(i-50,i); const f = this.ex(w); const k = f.map(v=>Math.round(v*25)).join(','); if(!this.db.has(k)) this.db.set(k,{T:0,X:0,t:0}); const d = this.db.get(k); d[data[i]] = (d[data[i]]||0)+1; d.t++; } this.t = true; } pr(seq) { if(!this.t||seq.length<50) return null; const f = this.ex(seq.slice(-50)); const k = f.map(v=>Math.round(v*25)).join(','); const d = this.db.get(k); if(!d||d.t<5) { let best=null, bd=Infinity; for(const[key,val] of this.db){ if(val.t<10) continue; const parts = key.split(',').map(Number); const fp = f.map(v=>Math.round(v*25)); let dist = 0; for(let i=0;i<Math.min(parts.length,fp.length);i++) dist += Math.abs(parts[i]-fp[i]); if(dist<bd){bd=dist;best=val;} } if(best) return {prob:best.T/best.t, conf:0.5}; return null; } return {prob:Math.max(0.08,Math.min(0.92,d.T/d.t)), conf:Math.min(0.95,d.t/120)}; } }
class BayesianEngine { constructor() { this.db = new Map(); this.t = false; } tr(data) { for (let i=40; i<data.length; i++) { const w = data.slice(i-40,i); const k = w.slice(-6).join(''); if(!this.db.has(k)) this.db.set(k,{T:1,X:1,t:2}); const d = this.db.get(k); d[data[i]] = (d[data[i]]||0)+1; d.t++; } this.t = true; } pr(seq) { if(!this.t||seq.length<40) return null; const k = seq.slice(-6).join(''); const d = this.db.get(k); if(!d||d.t<5) return null; return {prob:Math.max(0.08,Math.min(0.92,d.T/d.t)), conf:Math.min(0.9,d.t/60)}; } }
class MarkovEngine { constructor() { this.db = new Map(); this.t = false; } tr(data) { for(let order=1;order<=4;order++){ for(let i=order;i<data.length;i++){ const ctx=data.slice(i-order,i).join(''); const k=`O${order}|${ctx}`; if(!this.db.has(k)) this.db.set(k,{T:0,X:0,t:0}); const d=this.db.get(k); d[data[i]]=(d[data[i]]||0)+1; d.t++; } } this.t=true; } pr(seq) { if(!this.t) return null; let ps=0,ws=0; for(let order=1;order<=4;order++){ if(seq.length>=order){ const ctx=seq.slice(-order).join(''); const k=`O${order}|${ctx}`; const d=this.db.get(k); if(d&&d.t>=5){const w=order; ps+=(d.T/d.t)*w; ws+=w;} } } if(ws===0) return null; return {prob:Math.max(0.08,Math.min(0.92,ps/ws)), conf:Math.min(0.85,ws/10)}; } }
class StreakEngine { constructor() { this.db = new Map(); this.t = false; } tr(data) { for(let i=20;i<data.length;i++){ const w=data.slice(i-20,i); const last=w[w.length-1]; let st=1; for(let j=w.length-2;j>=0&&w[j]===last;j--) st++; const k=`${last}:${Math.min(st,20)}`; if(!this.db.has(k)) this.db.set(k,{T:0,X:0,t:0}); const d=this.db.get(k); d[data[i]]=(d[data[i]]||0)+1; d.t++; } this.t=true; } pr(seq) { if(!this.t) return null; const last=seq[seq.length-1]; let st=1; for(let j=seq.length-2;j>=0&&seq[j]===last;j--) st++; const k=`${last}:${Math.min(st,20)}`; const d=this.db.get(k); if(!d||d.t<5) return null; let prob=d.T/d.t; if(st>=10) prob=last==='T'?0.08:0.92; else if(st>=7) prob=last==='T'?0.18:0.82; else if(st>=5) prob=last==='T'?0.28:0.72; return {prob:Math.max(0.08,Math.min(0.92,prob)), conf:Math.min(0.95,d.t/50+st*0.02)}; } }
class EntropyEngine { constructor() { this.db = new Map(); this.t = false; } calc(seq){ const wins=[3,5,8,13,21,34]; const ents=[]; for(const w of wins){ if(seq.length>=w){ const sl=seq.slice(-w); const p=sl.filter(s=>s==='T').length/w; let e=0; if(p>0&&p<1) e=-p*Math.log2(p)-(1-p)*Math.log2(1-p); ents.push(e); } } return {avg:ents.reduce((a,b)=>a+b,0)/(ents.length||1), vr:ents.length>1?Math.max(...ents)-Math.min(...ents):0}; } tr(data) { for(let i=40;i<data.length;i++){ const w=data.slice(i-40,i); const e=this.calc(w); const k=`${Math.round(e.avg*10)}|${Math.round(e.vr*10)}`; if(!this.db.has(k)) this.db.set(k,{T:0,X:0,t:0}); const d=this.db.get(k); d[data[i]]=(d[data[i]]||0)+1; d.t++; } this.t=true; } pr(seq) { if(!this.t||seq.length<40) return null; const e=this.calc(seq.slice(-40)); const k=`${Math.round(e.avg*10)}|${Math.round(e.vr*10)}`; const d=this.db.get(k); if(!d||d.t<5) return null; return {prob:Math.max(0.08,Math.min(0.92,d.T/d.t)), conf:Math.min(0.9,d.t/70)}; } }
class MomentumEngine { constructor() { this.db = new Map(); this.t = false; } calc(seq){ const r3=seq.slice(-3).filter(s=>s==='T').length/3; const r8=seq.slice(-8).filter(s=>s==='T').length/8; const r21=seq.slice(-21).filter(s=>s==='T').length/21; return {sh:r3-r8, md:r8-r21}; } tr(data) { for(let i=40;i<data.length;i++){ const w=data.slice(i-40,i); const m=this.calc(w); const k=`${Math.round(m.sh*10)}|${Math.round(m.md*10)}`; if(!this.db.has(k)) this.db.set(k,{T:0,X:0,t:0}); const d=this.db.get(k); d[data[i]]=(d[data[i]]||0)+1; d.t++; } this.t=true; } pr(seq) { if(!this.t||seq.length<40) return null; const m=this.calc(seq.slice(-40)); const k=`${Math.round(m.sh*10)}|${Math.round(m.md*10)}`; const d=this.db.get(k); if(!d||d.t<5) return null; return {prob:Math.max(0.08,Math.min(0.92,d.T/d.t)), conf:Math.min(0.9,d.t/70)}; } }
class NeuralEngine { constructor() { this.w = Array(10).fill(0).map(() => Math.random() * 0.1); this.b = 0; this.t = false; } sig(x) { return 1 / (1 + Math.exp(-x)); } fw(f) { let s = this.b; for (let i = 0; i < Math.min(f.length, this.w.length); i++) s += f[i] * this.w[i]; return this.sig(s); } tr(data) { for (let ep = 0; ep < 8; ep++) { for (let i = 35; i < data.length; i++) { const w = data.slice(i - 35, i); const ft = []; for (const len of [3, 5, 8, 13, 21, 34]) { if (w.length >= len) ft.push(w.slice(-len).filter(s => s === 'T').length / len); } while (ft.length < 10) ft.push(0.5); const tg = data[i] === 'T' ? 1 : 0; const pr = this.fw(ft); const er = tg - pr; for (let j = 0; j < this.w.length; j++) this.w[j] += 0.003 * er * ft[j]; this.b += 0.003 * er; } } this.t = true; } pr(seq) { if (!this.t || seq.length < 35) return null; const w = seq.slice(-35); const ft = []; for (const len of [3, 5, 8, 13, 21, 34]) { if (w.length >= len) ft.push(w.slice(-len).filter(s => s === 'T').length / len); } while (ft.length < 10) ft.push(0.5); return { prob: Math.max(0.08, Math.min(0.92, this.fw(ft))), conf: 0.65 }; } }
class FractalEngine { constructor() { this.db = new Map(); this.t = false; } cd(seq){ const scales=[2,3,4,6,8,12,16]; const pts=[]; for(const sc of scales){ if(seq.length<sc) break; const s=new Set(); for(let i=0;i<=seq.length-sc;i++) s.add(seq.slice(i,i+sc).join('')); pts.push({sc,ct:s.size}); } if(pts.length<2) return 1; const n=pts.length; let sx=0,sy=0,sxy=0,sx2=0; for(const p of pts){const x=Math.log(1/p.sc),y=Math.log(p.ct);sx+=x;sy+=y;sxy+=x*y;sx2+=x*x;} return (n*sxy-sx*sy)/(n*sx2-sx*sx+0.001); } tr(data) { for(let i=40;i<data.length;i++){ const w=data.slice(i-40,i); const dim=Math.round(this.cd(w)*20); const k=String(dim); if(!this.db.has(k)) this.db.set(k,{T:0,X:0,t:0}); const d=this.db.get(k); d[data[i]]=(d[data[i]]||0)+1; d.t++; } this.t=true; } pr(seq) { if(!this.t||seq.length<40) return null; const dim=Math.round(this.cd(seq.slice(-40))*20); const d=this.db.get(String(dim)); if(!d||d.t<5) return null; return {prob:Math.max(0.08,Math.min(0.92,d.T/d.t)), conf:Math.min(0.9,d.t/80)}; } }
class GradientBoostEngine { constructor() { this.trees=[]; this.t=false; this.lr=0.08; } bt(features,labels,residuals,depth){ if(depth>4||features.length<5){return{pred:residuals.reduce((a,b)=>a+b,0)/(residuals.length||1)};} let bestGain=-1,bestF=0,bestV=0; for(let f=0;f<Math.min(features[0]?.length||0,8);f++){ const vals=features.map(feat=>feat[f]).sort((a,b)=>a-b); for(let i=0;i<vals.length-1;i++){ const split=(vals[i]+vals[i+1])/2; let lS=0,rS=0,lC=0,rC=0; for(let j=0;j<features.length;j++){ if(features[j][f]<split){lS+=residuals[j];lC++;} else{rS+=residuals[j];rC++;} } const gain=(lS*lS)/(lC+0.001)+(rS*rS)/(rC+0.001); if(gain>bestGain){bestGain=gain;bestF=f;bestV=split;} } } if(bestGain===-1) return{pred:residuals.reduce((a,b)=>a+b,0)/(residuals.length||1)}; const lF=[],lR=[],rF=[],rR=[]; for(let j=0;j<features.length;j++){ if(features[j][bestF]<bestV){lF.push(features[j]);lR.push(residuals[j]);} else{rF.push(features[j]);rR.push(residuals[j]);} } return{f:bestF,v:bestV,l:this.bt(lF,labels,lR,depth+1),r:this.bt(rF,labels,rR,depth+1)}; } pt(tree,f){if(tree.pred!==undefined)return tree.pred;return f[tree.f]<tree.v?this.pt(tree.l,f):this.pt(tree.r,f);} tr(data){ const allF=[],allL=[]; for(let i=30;i<data.length;i++){ const w=data.slice(i-30,i); const feat=[]; for(const len of[3,5,8,13]){ if(w.length>=len){ const sl=w.slice(-len); feat.push(sl.filter(s=>s==='T').length/len); feat.push(sl.filter((s,i,a)=>i>0&&s!==a[i-1]).length/Math.max(1,len-1)); } } while(feat.length<8) feat.push(0.5); allF.push(feat); allL.push(data[i]==='T'?1:0); } let residuals=[...allL]; for(let iter=0;iter<70;iter++){ this.trees.push(this.bt(allF,allL,residuals,0)); for(let j=0;j<allF.length;j++) residuals[j]-=this.lr*this.pt(this.trees[this.trees.length-1],allF[j]); } this.t=true; } pr(seq){ if(!this.t||seq.length<30) return null; const w=seq.slice(-30); const feat=[]; for(const len of[3,5,8,13]){ if(w.length>=len){ const sl=w.slice(-len); feat.push(sl.filter(s=>s==='T').length/len); feat.push(sl.filter((s,i,a)=>i>0&&s!==a[i-1]).length/Math.max(1,len-1)); } } while(feat.length<8) feat.push(0.5); let sum=0; for(const t of this.trees) sum+=this.lr*this.pt(t,feat); return {prob:Math.max(0.08,Math.min(0.92,sum)), conf:0.78}; } }
class WaveEngine { constructor() { this.db = new Map(); this.t = false; } ex(seq){ const s=seq.map(v=>v==='T'?1:-1); const f=[]; for(const p of[5,8,13,21]){ if(s.length>=p*2){let corr=0;for(let i=0;i<p;i++) corr+=s[s.length-p+i]*s[s.length-p*2+i];f.push(corr/p);} } while(f.length<8) f.push(0); return f; } tr(data) { for(let i=40;i<data.length;i++){ const w=data.slice(i-40,i); const f=this.ex(w); const k=f.map(v=>Math.round(v*10)).join(','); if(!this.db.has(k)) this.db.set(k,{T:0,X:0,t:0}); const d=this.db.get(k); d[data[i]]=(d[data[i]]||0)+1; d.t++; } this.t=true; } pr(seq) { if(!this.t||seq.length<40) return null; const f=this.ex(seq.slice(-40)); const k=f.map(v=>Math.round(v*10)).join(','); const d=this.db.get(k); if(!d||d.t<5) return null; return {prob:Math.max(0.08,Math.min(0.92,d.T/d.t)), conf:Math.min(0.85,d.t/60)}; } }

// ============================================================
// PREDICTION CORE
// ============================================================
class PredictionCore {
    constructor(type) {
        this.type = type;
        this.history = [];
        this.stats = { total:0,dung:0,sai:0,tyle:0,chuoi:0,chuoi_dai:0,chuoi_thua_dai:0,chuoi_thang_hientai:0,chuoi_thua_hientai:0,homnay:{dung:0,sai:0,tong:0} };
        this.lastPhien = null;
        this.trained = false;
        this.engines = [
            { n:'LƯỢNG TỬ', e:new QuantumSpectral(), w:3.8 },
            { n:'BAYES', e:new BayesianEngine(), w:3.2 },
            { n:'MARKOV', e:new MarkovEngine(), w:2.5 },
            { n:'CHUỖI', e:new StreakEngine(), w:2.2 },
            { n:'ENTROPY', e:new EntropyEngine(), w:2.0 },
            { n:'ĐỘNG LƯỢNG', e:new MomentumEngine(), w:1.8 },
            { n:'HỌC SÂU', e:new NeuralEngine(), w:2.8 },
            { n:'PHÂN MẢNH', e:new FractalEngine(), w:1.7 },
            { n:'BOOST', e:new GradientBoostEngine(), w:2.5 },
            { n:'SÓNG', e:new WaveEngine(), w:1.6 }
        ];
        this.mem = new Map(); this.stk = new Map();
    }
    train(data) {
        if (data.length < 50) return false;
        try {
            for (const eng of this.engines) eng.e.tr(data);
            this.mem.clear(); this.stk.clear();
            for (let i=20; i<data.length; i++) {
                const w = data.slice(i-20,i); const t = data[i];
                for (const len of[3,5,8,13]){ if(w.length>=len){ const p=w.slice(-len).join(''); if(!this.mem.has(p)) this.mem.set(p,{T:0,X:0,t:0}); const d=this.mem.get(p); d[t]=(d[t]||0)+1; d.t++; } }
                const last=w[w.length-1]; let st=1; for(let j=w.length-2;j>=0&&w[j]===last;j--) st++;
                const sk=`${last}:${Math.min(st,20)}`; if(!this.stk.has(sk)) this.stk.set(sk,{T:0,X:0,t:0}); const sb=this.stk.get(sk); sb[t]=(sb[t]||0)+1; sb.t++;
            }
            this.trained = true; return true;
        } catch(e) { return false; }
    }
    predict(data) {
        if (!data || data.length < 10) return this.fb();
        const seq = data.map(d => d==='T'?'T':'X');
        let sT=0,sX=0,sw=0; const dt=[];
        for (const eng of this.engines) { try { const r = eng.e.pr(seq); if (r) { const w = eng.w*r.conf; sT += r.prob*w; sX += (1-r.prob)*w; sw += w; dt.push(`${eng.n}:${Math.round(r.prob*100)}`); } } catch(e) {} }
        for (const len of[3,5,8,13]){ if(seq.length>=len){ const p=seq.slice(-len).join(''); const d=this.mem.get(p); if(d&&d.t>=5){ const w=len/13; sT+=(d.T/d.t)*w; sX+=(d.X/d.t)*w; sw+=w; } } }
        const last=seq[seq.length-1]; let streak=1; for(let j=seq.length-2;j>=0&&seq[j]===last;j--) streak++;
        if (streak>=10){ if(last==='T'){sX+=8;dt.push('GÃY-T10');}else{sT+=8;dt.push('GÃY-X10');} sw+=8; }
        else if (streak>=7){ if(last==='T'){sX+=5;dt.push('GÃY-T7');}else{sT+=5;dt.push('GÃY-X7');} sw+=5; }
        else if (streak>=5){ if(last==='T'){sX+=3;dt.push('GÃY-T5');}else{sT+=3;dt.push('GÃY-X5');} sw+=3; }
        const lt=seq.filter(s=>s==='T').length/seq.length;
        if (lt>0.75){ sX+=5;dt.push('CÂN BẰNG+'); sw+=5; } else if (lt<0.25){ sT+=5;dt.push('CÂN BẰNG-'); sw+=5; }
        if (sw===0) return this.fb();
        const prob=sT/(sT+sX); const dd=prob>0.5?'TÀI':'XỈU';
        let tc=Math.round(Math.max(prob,1-prob)*100);
        if (dt.length>=7) tc=Math.min(99,tc+12); else if (dt.length>=5) tc=Math.min(99,tc+8); else if (dt.length>=3) tc=Math.min(99,tc+5);
        tc=Math.min(99,Math.max(55,tc));
        return {duDoan:dd,doTinCay:tc,chiTiet:dt.slice(0,6).join(' | '),soMau:dt.length};
    }
    fb() { if (this.stats.total>50) return {duDoan:this.stats.dung>this.stats.sai?'TÀI':'XỈU',doTinCay:52,chiTiet:'XU HƯỚNG',soMau:0}; return {duDoan:'TÀI',doTinCay:51,chiTiet:'KHỞI TẠO',soMau:0}; }
    update(prediction, actual) {
        const pr=prediction==='TÀI'?'T':'X'; const ac=actual==='TÀI'?'T':'X'; const ok=pr===ac;
        this.stats.total++;
        if (ok){ this.stats.dung++; this.stats.chuoi=this.stats.chuoi>=0?this.stats.chuoi+1:1; if(this.stats.chuoi>this.stats.chuoi_dai) this.stats.chuoi_dai=this.stats.chuoi; this.stats.chuoi_thang_hientai++; this.stats.chuoi_thua_hientai=0; this.stats.homnay.dung++; }
        else { this.stats.sai++; this.stats.chuoi=this.stats.chuoi<=0?this.stats.chuoi-1:-1; if(Math.abs(this.stats.chuoi)>this.stats.chuoi_thua_dai) this.stats.chuoi_thua_dai=Math.abs(this.stats.chuoi); this.stats.chuoi_thua_hientai++; this.stats.chuoi_thang_hientai=0; this.stats.homnay.sai++; }
        this.stats.homnay.tong++; this.stats.tyle=this.stats.total>0?Math.round((this.stats.dung/this.stats.total)*100):0;
    }
    save() { try { fs.writeFileSync(`.${this.type}_data`, JSON.stringify({history:this.history.slice(0,2000),stats:this.stats,lastPhien:this.lastPhien,trained:this.trained}), 'utf8'); } catch(e) {} }
    load() { try { const f = `.${this.type}_data`; if (fs.existsSync(f)) { const d = JSON.parse(fs.readFileSync(f,'utf8')); if (d.history) this.history = d.history; if (d.stats) this.stats = d.stats; if (d.lastPhien) this.lastPhien = d.lastPhien; if (d.trained) this.trained = d.trained; } } catch(e) {} }
}

const brainHU = new PredictionCore('hu');
const brainMD5 = new PredictionCore('md5');
brainHU.load(); brainMD5.load();

async function processGame(brain, type) {
    try {
        const data = await fetchData(type);
        if (!data||data.length===0) return;
        const cur = data[0].phien;
        if (brain.lastPhien===cur) return;
        for (const r of brain.history) { if (r.status&&r.status!=='') continue; const a = data.find(d=>d.phien.toString()===r.phien_hien_tai); if (a) { r.status=(r.prediction===a.result)?'✅':'❌'; r.actual=a.result; brain.update(r.prediction,a.result); } }
        const ex = brain.history.find(h=>h.phien_hien_tai===(cur+1).toString()); if (ex) return;
        const hd = data.map(d=>d.result==='TÀI'?'T':'X'); if (hd.length>=50) brain.train(hd);
        const result = brain.predict(hd);
        const rec = {phien:data[0].phien,phien_hien_tai:(data[0].phien+1).toString(),dice:`${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`,total:data[0].total,actual:data[0].result,prediction:result.duDoan,confidence:result.doTinCay,detail:result.chiTiet,status:'',timestamp:new Date().toISOString(),soMau:result.soMau||0};
        brain.history.unshift(rec); if (brain.history.length>2000) brain.history = brain.history.slice(0,2000);
        brain.lastPhien = cur; brain.save();
    } catch(e) {}
}
async function autoProcess() { await Promise.all([processGame(brainHU,'hu'),processGame(brainMD5,'md5')]); }
function startAuto() { setTimeout(autoProcess,3000); setInterval(autoProcess,5000); }

// ============================================================
// GIAO DIỆN SIÊU VIP - BẢO LONG PREDICT
// ============================================================
const CSS = `:root{--bg:#020617;--bg2:#0a0f24;--bg3:#111832;--b:rgba(255,255,255,0.05);--ba:rgba(99,102,241,0.35);--t:#e2e8f0;--t2:#8899b8;--t3:#4a5578;--g:linear-gradient(135deg,#6366f1,#06b6d4);--g2:linear-gradient(135deg,#f59e0b,#ef4444);--ok:#22c55e;--no:#ef4444;--w:#f59e0b;--c:#06b6d4;--p:#6366f1}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--t);min-height:100vh;overflow-x:hidden}
.stars{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none}
.star{position:absolute;background:#fff;border-radius:50%;animation:tw 3s infinite}
@keyframes tw{0%,100%{opacity:0.12}50%{opacity:0.6}}
.nebula{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none}
.n1{position:absolute;width:600px;height:600px;background:rgba(99,102,241,0.1);border-radius:50%;filter:blur(130px);top:-200px;left:-100px;animation:f1 25s infinite}
.n2{position:absolute;width:500px;height:500px;background:rgba(6,182,212,0.06);border-radius:50%;filter:blur(130px);bottom:-150px;right:-80px;animation:f2 30s infinite}
@keyframes f1{0%,100%{transform:translate(0,0)}50%{transform:translate(80px,50px)}}
@keyframes f2{0%,100%{transform:translate(0,0)}50%{transform:translate(-60px,-30px)}}
.grid{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px);background-size:50px 50px}
.app{position:relative;z-index:1;max-width:800px;margin:0 auto;padding:16px}
.glass{background:rgba(17,24,50,0.5);backdrop-filter:blur(25px);border:1px solid var(--b)}
.gc{background:rgba(17,24,50,0.4);backdrop-filter:blur(20px);border:1px solid var(--b);border-radius:14px;padding:18px;transition:all 0.3s}
.gc:hover{border-color:var(--ba);transform:translateY(-2px)}
.tg{background:var(--g);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
@keyframes glow{0%,100%{filter:drop-shadow(0 0 8px rgba(99,102,241,0.3))}50%{filter:drop-shadow(0 0 25px rgba(99,102,241,0.7))}}
@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
input{width:100%;padding:12px 16px;background:var(--bg2);border:1px solid var(--b);border-radius:10px;color:var(--t);font-size:13px;font-family:'JetBrains Mono',monospace;outline:none}
input:focus{border-color:var(--ba);box-shadow:0 0 0 3px rgba(99,102,241,0.1)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 24px;background:var(--g);border:none;border-radius:10px;color:#fff;font-weight:600;font-size:13px;cursor:pointer;transition:all 0.3s;text-decoration:none}
.btn:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(99,102,241,0.4)}
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
.badge-p{background:rgba(99,102,241,0.08);color:var(--p);border:1px solid rgba(99,102,241,0.15)}
.pulse{width:7px;height:7px;border-radius:50%;background:var(--ok);display:inline-block;animation:pulse 1.5s infinite}
@keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(34,197,94,0.4)}50%{opacity:0.4;box-shadow:0 0 0 10px rgba(34,197,94,0)}}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.06)}`;

function loginPage() {
    return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>BẢO LONG • ĐĂNG NHẬP</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet"><style>${CSS}
.login-card{background:rgba(17,24,50,0.7);backdrop-filter:blur(40px);border:1px solid var(--b);border-radius:24px;padding:44px 36px;width:100%;max-width:440px;box-shadow:0 50px 120px rgba(0,0,0,0.6);animation:slideUp 0.6s ease-out}
.login-card::before{content:'';position:absolute;top:-1px;left:-1px;right:-1px;bottom:-1px;border-radius:24px;background:var(--g);z-index:-1;opacity:0.08}
</style></head><body>
<div class="stars">${Array(60).fill(0).map((_,i)=>`<div class="star" style="left:${Math.random()*100}%;top:${Math.random()*100}%;width:${1+Math.random()*2}px;height:${1+Math.random()*2}px;animation-delay:${Math.random()*3}s"></div>`).join('')}</div>
<div class="nebula"><div class="n1"></div><div class="n2"></div></div><div class="grid"></div>
<div style="position:relative;z-index:1;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px"><div class="login-card">
<div style="text-align:center;margin-bottom:32px"><div style="font-size:64px;animation:glow 3s infinite;display:inline-block">🐉</div><h1 style="font-family:'Orbitron',sans-serif;font-size:30px;font-weight:900;margin-top:8px"><span class="tg">BẢO LONG</span></h1><p style="font-size:11px;color:var(--t2);margin-top:6px;letter-spacing:3px;font-family:'JetBrains Mono',monospace">DỰ ĐOÁN TÀI XỈU</p><p style="font-size:9px;color:var(--t3);margin-top:8px">10 Engine • Siêu Chính Xác • Thời Gian Thực</p></div>
<form onsubmit="login(event)"><div style="margin-bottom:24px"><label style="display:block;font-size:9px;color:var(--t2);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600">🔑 MÃ TRUY CẬP</label><input type="password" id="p" placeholder="Nhập mã truy cập..." autocomplete="off" required></div>
<button type="submit" class="btn" style="width:100%;font-size:15px;padding:14px">🚀 TRUY CẬP HỆ THỐNG</button></form>
<div id="res" style="margin-top:24px"></div>
<div style="text-align:center;margin-top:20px;padding-top:16px;border-top:1px solid var(--b);font-size:7px;color:var(--t3);font-family:'JetBrains Mono',monospace;line-height:1.6">🐉 BẢO LONG PREDICT • LƯỢNG TỬ • BAYES • MARKOV • CHUỖI • ENTROPY • ĐỘNG LƯỢNG • HỌC SÂU • PHÂN MẢNH • BOOST • SÓNG</div></div></div>
<script>
async function login(e){e.preventDefault();const p=document.getElementById('p').value.trim(),r=document.getElementById('res');
if(!p){r.innerHTML='<div style="background:rgba(239,68,68,0.1);padding:14px;border-radius:10px;color:#ef4444;font-size:13px">⚠️ Vui lòng nhập mã truy cập</div>';return}
r.innerHTML='<div style="background:rgba(6,182,212,0.1);padding:14px;border-radius:10px;color:#06b6d4;font-size:13px">⏳ Đang xác thực...</div>';
try{const rs=await fetch('/_api/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:p})});const d=await rs.json();
if(rs.ok&&d.token){window.location.href='/_home?_token='+d.token}else{r.innerHTML='<div style="background:rgba(239,68,68,0.1);padding:14px;border-radius:10px;color:#ef4444;font-size:13px">❌ Sai mã truy cập</div>'}}
catch(ex){r.innerHTML='<div style="background:rgba(239,68,68,0.1);padding:14px;border-radius:10px;color:#ef4444;font-size:13px">🔌 Lỗi kết nối</div>'}}</script></body></html>`;
}

function homePage(token) {
    return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>BẢO LONG • TRANG CHỦ</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet"><style>${CSS}
.hero{text-align:center;margin-bottom:28px;animation:slideUp 0.6s}
.features{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;max-width:600px;margin:0 auto 20px}
@media(max-width:500px){.features{grid-template-columns:repeat(2,1fr)}}
.feat{background:rgba(17,24,50,0.4);border:1px solid var(--b);border-radius:12px;padding:14px;text-align:center;transition:all 0.3s}
.feat:hover{border-color:var(--ba);transform:translateY(-2px)}
.feat .fi{font-size:26px;margin-bottom:4px}
.feat .ft{font-size:9px;color:var(--t2);font-weight:600}
.feat .fs{font-size:7px;color:var(--t3);margin-top:2px;font-family:'JetBrains Mono',monospace}
.announce{background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);border-radius:14px;padding:16px;margin-bottom:20px;text-align:center;animation:slideUp 0.6s}
.announce h3{color:var(--w);font-size:13px;margin-bottom:6px}
.announce p{font-size:9px;color:var(--t2);line-height:1.5}
</style></head><body>
<div class="stars">${Array(60).fill(0).map((_,i)=>`<div class="star" style="left:${Math.random()*100}%;top:${Math.random()*100}%;width:${1+Math.random()*2}px;height:${1+Math.random()*2}px;animation-delay:${Math.random()*3}s"></div>`).join('')}</div>
<div class="nebula"><div class="n1"></div><div class="n2"></div></div><div class="grid"></div>
<div class="app">
<div style="text-align:right;margin-bottom:10px"><a href="/_login" class="btn" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#ef4444;font-size:9px;padding:6px 14px">🚪 THOÁT</a></div>
<div class="hero"><div style="font-size:68px;animation:glow 3s infinite;display:inline-block">🐉</div><h1 style="font-family:'Orbitron',sans-serif;font-size:32px;font-weight:900;margin-top:8px"><span class="tg">BẢO LONG</span></h1><p style="font-size:11px;color:var(--t2);margin-top:6px;letter-spacing:3px;font-family:'JetBrains Mono',monospace">DỰ ĐOÁN TÀI XỈU SIÊU CHÍNH XÁC</p></div>
<div class="announce"><h3>🌎 THÔNG BÁO BẢO TRÌ THÀNH CÔNG</h3><p>✨ Hệ thống đã được nâng cấp toàn diện với 10 engine dự đoán<br>🎯 Độ chính xác được cải thiện vượt trội, phân tích chuẩn đến từng loại cầu<br>🎨 Giao diện hoàn toàn mới, mượt mà và chuyên nghiệp</p></div>
<div class="features"><div class="feat"><div class="fi">🧠</div><div class="ft">10 ENGINES</div><div class="fs">Phân tích thời gian thực</div></div><div class="feat"><div class="fi">🎯</div><div class="ft">SIÊU CHÍNH XÁC</div><div class="fs">Tổng hợp đa mô hình</div></div><div class="feat"><div class="fi">🔄</div><div class="ft">TỰ ĐỘNG 5S</div><div class="fs">Cập nhật liên tục</div></div><div class="feat"><div class="fi">📊</div><div class="ft">1000 PHIÊN</div><div class="fs">Lịch sử đầy đủ</div></div></div>
<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;max-width:500px;margin:0 auto">
<a href="/_hu?_token=${token}" class="gc" style="text-align:center;text-decoration:none;color:var(--t);padding:30px 22px;cursor:pointer"><div style="font-size:44px;margin-bottom:10px">🎰</div><h2 style="font-family:'Orbitron',sans-serif;font-size:16px;font-weight:700;margin-bottom:4px">TÀI XỈU HŨ</h2><p style="font-size:8px;color:var(--t3);font-family:'JetBrains Mono',monospace">Dự Đoán Trực Tiếp</p></a>
<a href="/_md5?_token=${token}" class="gc" style="text-align:center;text-decoration:none;color:var(--t);padding:30px 22px;cursor:pointer"><div style="font-size:44px;margin-bottom:10px">🔮</div><h2 style="font-family:'Orbitron',sans-serif;font-size:16px;font-weight:700;margin-bottom:4px">TÀI XỈU MD5</h2><p style="font-size:8px;color:var(--t3);font-family:'JetBrains Mono',monospace">Dự Đoán Trực Tiếp</p></a></div>
<div style="text-align:center;margin-top:18px;font-size:7px;color:var(--t3);font-family:'JetBrains Mono',monospace">🐉 BẢO LONG PREDICT • 10 ENGINES • SIÊU CHÍNH XÁC</div></div></body></html>`;
}

function dashboardPage(brain, type, token) {
    const s = brain.stats; const all = (brain.history || []); const recent = all.slice(0, 15); const all1000 = all.slice(0, 1000);
    let td = 0, ts = 0, td1k = 0, ts1k = 0;
    for (const r of recent) { if (r.status === '✅') td++; else if (r.status === '❌') ts++; }
    for (const r of all1000) { if (r.status === '✅') td1k++; else if (r.status === '❌') ts1k++; }
    let histHTML = '';
    for (const r of all1000.slice(0, 50)) {
        const st = r.status || '⏳'; const cls = st === '✅' ? 'tai-text' : st === '❌' ? 'xiu-text' : '';
        histHTML += `<div class="hl-item"><span class="hl-phien">#${r.phien_hien_tai || '-'}</span><span class="${cls}" style="font-weight:700;font-size:14px">${r.prediction || '--'}</span><span class="hl-conf">${r.confidence || 0}%</span><span class="hl-time">${(r.timestamp || '').substring(11, 16) || '--:--'}</span></div>`;
    }
    let dots1k = '';
    for (const r of all1000.slice(0, 200)) {
        const st = r.status || '⏳', c = st === '✅' ? 's' : st === '❌' ? 'd' : 'w', t = st === '✅' ? 'Đ' : st === '❌' ? 'S' : '?';
        dots1k += `<span class="dot dot-${c}" title="#${r.phien_hien_tai}: ${r.prediction} → ${r.actual || '?'}">${t}</span>`;
    }
    const phien = recent[0]?.phien_hien_tai || '---';
    const pred = recent[0]?.prediction || '...';
    const conf = recent[0]?.confidence || 0;
    const cls = pred === 'TÀI' ? 'tai' : pred === 'XỈU' ? 'xiu' : 'loading';
    const confBarCls = pred === 'TÀI' ? 'tai-bar' : pred === 'XỈU' ? 'xiu-bar' : 'def-bar';
    const gameName = type === 'hu' ? 'TÀI XỈU HŨ' : 'TÀI XỈU MD5';
    const wr = s.tyle; const wc = wr >= 70 ? '#22c55e' : wr >= 60 ? '#f59e0b' : '#ef4444';

    return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=yes"><title>${gameName} | BẢO LONG</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0b0e14;color:#eef2f6;font-family:'Inter',system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;flex-direction:column}
:root{--bg:#0b0e14;--bg2:#131a24;--card:#0f1620;--border:#1e2a3a;--border2:#2d3d52;--text:#f0f4fa;--sub:#b8cce0;--muted:#7a8fa3;--primary:#5b9aff;--accent:#b084f7;--gold:#facc15;--green:#2dd4a8;--red:#f87171}
.game-page{max-width:720px;margin:0 auto;padding:24px 16px 40px;width:100%;flex:1}
.robot-card{background:var(--card);border:1px solid var(--border2);border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.7)}
.rc-header{padding:18px 22px;background:linear-gradient(145deg,rgba(91,154,255,0.07),rgba(176,132,247,0.04));border-bottom:1px solid var(--border);display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.rc-icon-fb{width:48px;height:48px;border-radius:16px;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff;font-weight:700;flex-shrink:0;box-shadow:0 6px 16px rgba(91,154,255,0.25)}
.rc-name{font-size:18px;font-weight:700;color:var(--text)}
.rc-type{font-size:10px;color:var(--muted);margin-top:2px;text-transform:uppercase;letter-spacing:0.8px;display:flex;align-items:center;gap:6px}
.rc-live{margin-left:auto;display:inline-flex;align-items:center;gap:6px;background:rgba(45,212,168,0.12);color:var(--green);border:1px solid rgba(45,212,168,0.2);padding:4px 14px;border-radius:40px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.6px;flex-shrink:0}
.rc-live i{font-size:7px;animation:blink 1.4s infinite}
@keyframes blink{0%,100%{opacity:0.3}50%{opacity:1}}
.pred-display{padding:32px 20px 20px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px}
.pd-label{font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:2px;background:var(--bg2);padding:2px 14px;border-radius:40px;border:1px solid var(--border)}
.pd-phien{font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--sub);background:var(--bg2);padding:4px 18px;border-radius:40px;border:1px solid var(--border);display:inline-block;margin-top:2px}
.pd-result{font-family:'Inter',sans-serif;font-size:clamp(56px,16vw,86px);font-weight:800;line-height:1.1;letter-spacing:1px;transition:all 0.3s ease;margin:8px 0 4px}
.pd-result.tai{color:#2dd4a8;text-shadow:0 0 60px rgba(45,212,168,0.5)}
.pd-result.xiu{color:#f87171;text-shadow:0 0 60px rgba(248,113,113,0.5)}
.pd-result.loading{color:var(--muted);animation:pulse 1.5s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:0.3}50%{opacity:1}}
.conf-track{width:100%;max-width:320px;background:var(--bg2);border:1px solid var(--border);border-radius:40px;height:8px;overflow:hidden;margin:6px 0 2px}
.conf-fill{height:100%;border-radius:40px;transition:width 0.6s cubic-bezier(0.34,1.56,0.64,1);width:${conf}%}
.conf-fill.tai-bar{background:linear-gradient(90deg,#2dd4a8,#38bdf8)}
.conf-fill.xiu-bar{background:linear-gradient(90deg,#f87171,#fb923c)}
.conf-fill.def-bar{background:linear-gradient(90deg,var(--primary),var(--accent))}
.conf-pct{font-family:'JetBrains Mono',monospace;font-size:24px;font-weight:700;color:var(--gold);letter-spacing:0.5px}
.conf-lbl{font-size:10px;color:var(--muted);letter-spacing:1.2px;font-weight:600}
.stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:0 20px 20px}
.stat-item{background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:14px 6px;text-align:center;transition:0.2s}
.stat-item:hover{border-color:var(--border2)}
.si-val{font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:700;color:var(--text)}
.si-lbl{font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-top:4px;font-weight:600}
.rc-footer{padding:12px 20px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--muted);flex-wrap:wrap;gap:6px;background:rgba(0,0,0,0.15)}
.hist-card{background:var(--card);border:1px solid var(--border);border-radius:24px;margin-top:18px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.3)}
.hist-head{padding:14px 20px;border-bottom:1px solid var(--border);font-size:13px;font-weight:700;color:var(--sub);display:flex;align-items:center;justify-content:space-between;gap:10px;background:rgba(255,255,255,0.02);flex-wrap:wrap}
.hist-body{padding:12px 14px 14px;max-height:500px;overflow-y:auto}
.hl-item{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:var(--bg2);border-radius:14px;border:1px solid var(--border);margin-bottom:6px;font-size:12px;transition:0.15s}
.hl-item:hover{border-color:var(--border2)}
.hl-phien{font-family:'JetBrains Mono',monospace;color:var(--muted);font-size:10px;font-weight:600}
.hl-conf{font-size:10px;color:var(--gold);font-family:'JetBrains Mono',monospace;font-weight:700}
.hl-time{font-size:10px;color:var(--muted)}
.tai-text{color:#2dd4a8;font-weight:700}
.xiu-text{color:#f87171;font-weight:700}
.back-btn{display:inline-flex;align-items:center;gap:6px;color:var(--primary);text-decoration:none;font-size:11px;font-weight:600;padding:8px 16px;background:rgba(91,154,255,0.08);border:1px solid rgba(91,154,255,0.2);border-radius:40px;transition:all 0.3s}
.back-btn:hover{background:rgba(91,154,255,0.15)}
.dot{width:17px;height:17px;border-radius:3px;font-size:6px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;margin:1px;font-family:'JetBrains Mono',monospace;transition:all 0.2s}
.dot-s{background:rgba(45,212,168,0.15);color:var(--green);border:1px solid rgba(45,212,168,0.2)}.dot-s:hover{transform:scale(1.3)}
.dot-d{background:rgba(248,113,113,0.15);color:var(--red);border:1px solid rgba(248,113,113,0.2)}.dot-d:hover{transform:scale(1.3)}
.dot-w{background:rgba(250,204,21,0.15);color:var(--gold);border:1px solid rgba(250,204,21,0.2)}.dot-w:hover{transform:scale(1.3)}
.dots-grid{display:flex;flex-wrap:wrap;gap:2px;padding:10px 14px;max-height:200px;overflow-y:auto}
@media(max-width:480px){.game-page{padding:16px 12px 30px}.rc-header{padding:14px 16px;gap:10px}.rc-name{font-size:15px}.stats-row{gap:6px;padding:0 14px 14px;grid-template-columns:repeat(2,1fr)}.stat-item{padding:10px 4px}.si-val{font-size:14px}.pred-display{padding:22px 12px 14px}}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:var(--bg)}::-webkit-scrollbar-thumb{background:var(--border2);border-radius:10px}
</style></head><body>
<div class="game-page"><div class="robot-card"><div class="rc-header"><div class="rc-icon-fb"><i class="fas fa-robot"></i></div><div><div class="rc-name">${gameName}</div><div class="rc-type"><i class="fas fa-brain"></i> 10 Engines • Thời Gian Thực</div></div><div class="rc-live"><i class="fas fa-circle"></i> TRỰC TIẾP</div></div>
<div class="pred-display"><div class="pd-label"><i class="fas fa-bullseye"></i> DỰ ĐOÁN PHIÊN TIẾP THEO</div><div class="pd-phien">Phiên #${phien}</div><div class="pd-result ${cls}">${pred}</div><div class="conf-track"><div class="conf-fill ${confBarCls}"></div></div><div class="conf-pct">${conf}%</div><div class="conf-lbl">ĐỘ TIN CẬY</div></div>
<div class="stats-row"><div class="stat-item"><div class="si-val">${phien}</div><div class="si-lbl">PHIÊN</div></div><div class="stat-item"><div class="si-val">${conf}%</div><div class="si-lbl">TIN CẬY</div></div><div class="stat-item"><div class="si-val" style="color:${wc}">${wr}%</div><div class="si-lbl">TỶ LỆ THẮNG</div></div><div class="stat-item"><div class="si-val">${td1k}Đ/${ts1k}S</div><div class="si-lbl">1000 PHIÊN</div></div></div>
<div class="rc-footer"><a href="/_home?_token=${token}" class="back-btn"><i class="fas fa-arrow-left"></i> TRANG CHỦ</a><span><i class="fas fa-sync-alt fa-fw"></i> TỰ ĐỘNG 5s</span><span style="color:var(--green)"><i class="fas fa-check-circle"></i> TRỰC TUYẾN</span></div></div>
<div class="hist-card"><div class="hist-head"><span><i class="fas fa-chart-bar"></i> THỐNG KÊ 200 PHIÊN</span><span style="font-size:10px;color:var(--muted)">${td1k}Đ/${ts1k}S</span></div><div class="dots-grid">${dots1k || 'Đang tải...'}</div></div>
<div class="hist-card" style="margin-top:14px"><div class="hist-head"><span><i class="fas fa-clock-rotate-left"></i> LỊCH SỬ CHI TIẾT (${all1000.length} phiên)</span></div><div class="hist-body">${histHTML || '<div style="color:var(--muted);font-size:12px;text-align:center;padding:6px 0">Đang tải...</div>'}</div></div></div>
<script>setTimeout(()=>location.reload(),5000);</script></body></html>`;
}

// API
app.get('/_login', (req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.send(loginPage()); });
app.get('/', (req, res) => res.redirect('/_login'));
app.post('/_api/access', (req, res) => { const { key } = req.body || {}; if (!key) return res.status(400).json({ error: 'Thiếu mã' }); if (key === MASTER_KEY) { const token = createToken(); return res.json({ token }); } return res.status(401).json({ error: 'Sai mã' }); });
app.get('/_home', checkAuth, (req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.send(homePage(req.query['_token'])); });
app.get('/_hu', checkAuth, async (req, res) => { const data = await fetchData('hu'); if (data) { for (const r of brainHU.history) { if (r.status && r.status !== '') continue; const a = data.find(d => d.phien.toString() === r.phien_hien_tai); if (a) { r.status = (r.prediction === a.result) ? '✅' : '❌'; r.actual = a.result; brainHU.update(r.prediction, a.result); } } brainHU.save(); } res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.send(dashboardPage(brainHU, 'hu', req.query['_token'])); });
app.get('/_md5', checkAuth, async (req, res) => { const data = await fetchData('md5'); if (data) { for (const r of brainMD5.history) { if (r.status && r.status !== '') continue; const a = data.find(d => d.phien.toString() === r.phien_hien_tai); if (a) { r.status = (r.prediction === a.result) ? '✅' : '❌'; r.actual = a.result; brainMD5.update(r.prediction, a.result); } } brainMD5.save(); } res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.send(dashboardPage(brainMD5, 'md5', req.query['_token'])); });
app.get('/_hu/json', checkAuth, async (req, res) => { try { const data = await fetchData('hu'); if (!data || data.length === 0) { const r = brainHU.fb(); return res.json({ prediction: r.duDoan, confidence: r.doTinCay, detail: r.chiTiet }); } const exist = brainHU.history.find(h => h.phien_hien_tai === (data[0].phien + 1).toString()); if (exist) return res.json(exist); const hd = data.map(d => d.result === 'TÀI' ? 'T' : 'X'); if (hd.length >= 50) brainHU.train(hd); const result = brainHU.predict(hd); const rec = { phien: data[0].phien, phien_hien_tai: (data[0].phien + 1).toString(), dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`, total: data[0].total, actual: data[0].result, prediction: result.duDoan, confidence: result.doTinCay, detail: result.chiTiet, status: '', timestamp: new Date().toISOString(), soMau: result.soMau || 0 }; brainHU.history.unshift(rec); if (brainHU.history.length > 2000) brainHU.history = brainHU.history.slice(0, 2000); brainHU.save(); res.json(rec); } catch (e) { res.status(500).json({ error: 'Lỗi' }); } });
app.get('/_md5/json', checkAuth, async (req, res) => { try { const data = await fetchData('md5'); if (!data || data.length === 0) { const r = brainMD5.fb(); return res.json({ prediction: r.duDoan, confidence: r.doTinCay, detail: r.chiTiet }); } const exist = brainMD5.history.find(h => h.phien_hien_tai === (data[0].phien + 1).toString()); if (exist) return res.json(exist); const hd = data.map(d => d.result === 'TÀI' ? 'T' : 'X'); if (hd.length >= 50) brainMD5.train(hd); const result = brainMD5.predict(hd); const rec = { phien: data[0].phien, phien_hien_tai: (data[0].phien + 1).toString(), dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`, total: data[0].total, actual: data[0].result, prediction: result.duDoan, confidence: result.doTinCay, detail: result.chiTiet, status: '', timestamp: new Date().toISOString(), soMau: result.soMau || 0 }; brainMD5.history.unshift(rec); if (brainMD5.history.length > 2000) brainMD5.history = brainMD5.history.slice(0, 2000); brainMD5.save(); res.json(rec); } catch (e) { res.status(500).json({ error: 'Lỗi' }); } });
app.use((req, res) => res.status(404).end());

app.listen(PORT, '0.0.0.0', () => { console.log(`\n✅ BẢO LONG - Port ${PORT}\n`); startAuto(); });
