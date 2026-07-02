const express = require('express');
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '10kb' }));

const PORT = process.env.PORT || 5000;
const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';

// Token system
const PASS = crypto.randomBytes(6).toString('hex');
const TOKENS = new Map();

console.log('\n╔══════════════════════════════════════╗');
console.log('║       CRYSTAL TX SYSTEM              ║');
console.log('╠══════════════════════════════════════╣');
console.log(`║  Key:  ${PASS}                    ║`);
console.log('║  Link: /_login                     ║');
console.log('╚══════════════════════════════════════╝\n');

function createToken() {
    const token = crypto.randomBytes(48).toString('hex');
    TOKENS.set(token, Date.now() + 864000000);
    setTimeout(() => TOKENS.delete(token), 864000000);
    return token;
}

const checkAuth = (req, res, next) => {
    const token = req.query['_token'] || req.headers['x-token'];
    if (!token || !TOKENS.has(token)) return res.redirect('/_login?error=unauthorized');
    if (Date.now() > TOKENS.get(token)) { TOKENS.delete(token); return res.redirect('/_login?error=expired'); }
    next();
};

// Security
const ipMap = new Map();
const BLOCKED = new Set();
app.use((req, res, next) => {
    const ip = req.ip || 'unknown';
    const pub = ['/_login', '/_api/access', '/'];
    if (!pub.includes(req.path)) {
        if (BLOCKED.has(ip)) return res.status(403).end();
        const now = Date.now();
        if (!ipMap.has(ip)) ipMap.set(ip, []);
        const reqs = ipMap.get(ip).filter(t => now - t < 10000);
        if (reqs.length > 50) { BLOCKED.add(ip); return res.status(429).end(); }
        reqs.push(now); ipMap.set(ip, reqs);
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

// Data helpers
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
// 25 THUẬT TOÁN (giữ nguyên code, rút gọn khai báo)
// ============================================================
class QS { constructor() { this.db = new Map(); this.t = false; }
  ex(seq) { const s=seq.map(v=>v==='T'?1:-1); const f=[]; for(const p of[2,3,5,8,13,21,34,55]){if(s.length>=p){let si=0,co=0;for(let i=0;i<p;i++){const a=2*Math.PI*i/p;si+=s[s.length-p+i]*Math.sin(a);co+=s[s.length-p+i]*Math.cos(a);}f.push(Math.sqrt(si*si+co*co)/p);f.push(Math.atan2(si,co)/Math.PI);}} while(f.length<16)f.push(0);return f; }
  tr(data){for(let i=50;i<data.length;i++){const w=data.slice(i-50,i);const f=this.ex(w);const k=f.map(v=>Math.round(v*25)).join(',');if(!this.db.has(k))this.db.set(k,{T:0,X:0,t:0});const d=this.db.get(k);d[data[i]]=(d[data[i]]||0)+1;d.t++;}this.t=true;}
  pr(seq){if(!this.t||seq.length<50)return null;const f=this.ex(seq.slice(-50));const k=f.map(v=>Math.round(v*25)).join(',');const d=this.db.get(k);if(!d||d.t<5){let b=null,bd=Infinity;for(const[key,val] of this.db){if(val.t<10)continue;const parts=key.split(',').map(Number);const fp=f.map(v=>Math.round(v*25));let dist=0;for(let i=0;i<Math.min(parts.length,fp.length);i++)dist+=Math.abs(parts[i]-fp[i]);if(dist<bd){bd=dist;b=val;}}if(b)return{prob:b.T/b.t,conf:0.5};return null;}return{prob:Math.max(0.08,Math.min(0.92,d.T/d.t)),conf:Math.min(0.95,d.t/120)};}}
class BM { constructor() { this.db = new Map(); this.t = false; }
  tr(data){for(let i=40;i<data.length;i++){const w=data.slice(i-40,i);const k=w.slice(-6).join('');if(!this.db.has(k))this.db.set(k,{T:1,X:1,t:2});const d=this.db.get(k);d[data[i]]=(d[data[i]]||0)+1;d.t++;}this.t=true;}
  pr(seq){if(!this.t||seq.length<40)return null;const k=seq.slice(-6).join('');const d=this.db.get(k);if(!d||d.t<5)return null;return{prob:Math.max(0.08,Math.min(0.92,d.T/d.t)),conf:Math.min(0.9,d.t/60)};}}
class PF { constructor() { this.db = new Map(); this.t = false; }
  fp(seq){const t=seq.filter(s=>s==='T').length;const c=seq.filter((s,i,a)=>i>0&&s!==a[i-1]).length;let max=0,cur=1;for(let i=1;i<seq.length;i++){if(seq[i]===seq[i-1]){cur++;if(cur>max)max=cur;}else cur=1;}let e=0;const p=t/seq.length;if(p>0&&p<1)e=-p*Math.log2(p)-(1-p)*Math.log2(1-p);return`${seq.length}|${t}|${c}|${max}|${Math.round(e*100)}`;}
  tr(data){for(let i=25;i<data.length;i++){const w=data.slice(i-25,i);const f=this.fp(w.slice(-12));if(!this.db.has(f))this.db.set(f,{T:0,X:0,t:0});const d=this.db.get(f);d[data[i]]=(d[data[i]]||0)+1;d.t++;}this.t=true;}
  pr(seq){if(!this.t||seq.length<25)return null;const f=this.fp(seq.slice(-12));const d=this.db.get(f);if(!d||d.t<3)return null;return{prob:Math.max(0.08,Math.min(0.92,d.T/d.t)),conf:Math.min(0.9,d.t/40)};}}
class WB { constructor() { this.db = new Map(); this.t = false; }
  wb(x,sh,sc){if(x<=0)return 0;return 1-Math.exp(-Math.pow(x/sc,sh));}
  tr(data){for(let i=30;i<data.length;i++){const w=data.slice(i-30,i);const k=w.slice(-5).join('');if(!this.db.has(k))this.db.set(k,{T:0,X:0,t:0});const d=this.db.get(k);d[data[i]]=(d[data[i]]||0)+1;d.t++;}this.t=true;}
  pr(seq){if(!this.t||seq.length<30)return null;const k=seq.slice(-5).join('');const d=this.db.get(k);if(!d||d.t<5)return null;const sT=this.wb(d.T,1.5,2),sX=this.wb(d.X,1.5,2);return{prob:Math.max(0.08,Math.min(0.92,sT/(sT+sX+0.01))),conf:Math.min(0.9,d.t/60)};}}
class JS { constructor() { this.db = new Map(); this.t = false; this.eps=1e-10; }
  jsd(p,q){const m=p.map((pi,i)=>(pi+q[i])/2);let sum=0;for(let i=0;i<p.length;i++){const pi=p[i]+this.eps,qi=q[i]+this.eps,mi=m[i]+this.eps;sum+=pi*Math.log(pi/mi)+qi*Math.log(qi/mi);}return sum/2;}
  tr(data){for(let i=30;i<data.length;i++){const w=data.slice(i-30,i);const t=w.filter(s=>s==='T').length;const k=`${Math.round(t/30*10)}`;if(!this.db.has(k))this.db.set(k,{T:0,X:0,t:0});const d=this.db.get(k);d[data[i]]=(d[data[i]]||0)+1;d.t++;}this.t=true;}
  pr(seq){if(!this.t||seq.length<30)return null;const t=seq.slice(-30).filter(s=>s==='T').length;const k=`${Math.round(t/30*10)}`;const d=this.db.get(k);if(!d||d.t<5)return null;const p=[d.T/d.t,d.X/d.t],uncertainty=this.jsd(p,[0.5,0.5]);return{prob:Math.max(0.08,Math.min(0.92,(d.T/d.t)*(1-uncertainty)+0.5*uncertainty)),conf:Math.min(0.9,d.t/50)};}}
class MK { constructor() { this.db = new Map(); this.t = false; }
  tr(data){for(let order=1;order<=4;order++){for(let i=order;i<data.length;i++){const ctx=data.slice(i-order,i).join('');const k=`O${order}|${ctx}`;if(!this.db.has(k))this.db.set(k,{T:0,X:0,t:0});const d=this.db.get(k);d[data[i]]=(d[data[i]]||0)+1;d.t++;}}this.t=true;}
  pr(seq){if(!this.t)return null;let ps=0,ws=0;for(let order=1;order<=4;order++){if(seq.length>=order){const ctx=seq.slice(-order).join('');const k=`O${order}|${ctx}`;const d=this.db.get(k);if(d&&d.t>=5){const w=order;ps+=(d.T/d.t)*w;ws+=w;}}}if(ws===0)return null;return{prob:Math.max(0.08,Math.min(0.92,ps/ws)),conf:Math.min(0.85,ws/10)};}}
class EF { constructor() { this.db = new Map(); this.t = false; }
  calc(seq){const wins=[3,5,8,13,21,34];const ents=[];for(const w of wins){if(seq.length>=w){const sl=seq.slice(-w);const p=sl.filter(s=>s==='T').length/w;let e=0;if(p>0&&p<1)e=-p*Math.log2(p)-(1-p)*Math.log2(1-p);ents.push(e);}}return{avg:ents.reduce((a,b)=>a+b,0)/(ents.length||1),vr:ents.length>1?Math.max(...ents)-Math.min(...ents):0};}
  tr(data){for(let i=40;i<data.length;i++){const w=data.slice(i-40,i);const e=this.calc(w);const k=`${Math.round(e.avg*10)}|${Math.round(e.vr*10)}`;if(!this.db.has(k))this.db.set(k,{T:0,X:0,t:0});const d=this.db.get(k);d[data[i]]=(d[data[i]]||0)+1;d.t++;}this.t=true;}
  pr(seq){if(!this.t||seq.length<40)return null;const e=this.calc(seq.slice(-40));const k=`${Math.round(e.avg*10)}|${Math.round(e.vr*10)}`;const d=this.db.get(k);if(!d||d.t<5)return null;return{prob:Math.max(0.08,Math.min(0.92,d.T/d.t)),conf:Math.min(0.9,d.t/70)};}}
class MT { constructor() { this.db = new Map(); this.t = false; }
  calc(seq){const r3=seq.slice(-3).filter(s=>s==='T').length/3;const r8=seq.slice(-8).filter(s=>s==='T').length/8;const r21=seq.slice(-21).filter(s=>s==='T').length/21;return{sh:r3-r8,md:r8-r21};}
  tr(data){for(let i=40;i<data.length;i++){const w=data.slice(i-40,i);const m=this.calc(w);const k=`${Math.round(m.sh*10)}|${Math.round(m.md*10)}`;if(!this.db.has(k))this.db.set(k,{T:0,X:0,t:0});const d=this.db.get(k);d[data[i]]=(d[data[i]]||0)+1;d.t++;}this.t=true;}
  pr(seq){if(!this.t||seq.length<40)return null;const m=this.calc(seq.slice(-40));const k=`${Math.round(m.sh*10)}|${Math.round(m.md*10)}`;const d=this.db.get(k);if(!d||d.t<5)return null;return{prob:Math.max(0.08,Math.min(0.92,d.T/d.t)),conf:Math.min(0.9,d.t/70)};}}
class FG { constructor() { this.db = new Map(); this.t = false; }
  cd(seq){const scales=[2,3,4,6,8,12,16];const pts=[];for(const sc of scales){if(seq.length<sc)break;const s=new Set();for(let i=0;i<=seq.length-sc;i++)s.add(seq.slice(i,i+sc).join(''));pts.push({sc,ct:s.size});}if(pts.length<2)return 1;const n=pts.length;let sx=0,sy=0,sxy=0,sx2=0;for(const p of pts){const x=Math.log(1/p.sc),y=Math.log(p.ct);sx+=x;sy+=y;sxy+=x*y;sx2+=x*x;}return(n*sxy-sx*sy)/(n*sx2-sx*sx+0.001);}
  tr(data){for(let i=40;i<data.length;i++){const w=data.slice(i-40,i);const dim=Math.round(this.cd(w)*20);const k=String(dim);if(!this.db.has(k))this.db.set(k,{T:0,X:0,t:0});const d=this.db.get(k);d[data[i]]=(d[data[i]]||0)+1;d.t++;}this.t=true;}
  pr(seq){if(!this.t||seq.length<40)return null;const dim=Math.round(this.cd(seq.slice(-40))*20);const d=this.db.get(String(dim));if(!d||d.t<5)return null;return{prob:Math.max(0.08,Math.min(0.92,d.T/d.t)),conf:Math.min(0.9,d.t/80)};}}
class AS { constructor() { this.db = new Map(); this.t = false; }
  tr(data){for(let i=20;i<data.length;i++){const w=data.slice(i-20,i);const last=w[w.length-1];let st=1;for(let j=w.length-2;j>=0&&w[j]===last;j--)st++;const k=`${last}:${Math.min(st,20)}`;if(!this.db.has(k))this.db.set(k,{T:0,X:0,t:0});const d=this.db.get(k);d[data[i]]=(d[data[i]]||0)+1;d.t++;}this.t=true;}
  pr(seq){if(!this.t)return null;const last=seq[seq.length-1];let st=1;for(let j=seq.length-2;j>=0&&seq[j]===last;j--)st++;const k=`${last}:${Math.min(st,20)}`;const d=this.db.get(k);if(!d||d.t<5)return null;let prob=d.T/d.t;if(st>=10)prob=last==='T'?0.1:0.9;else if(st>=7)prob=last==='T'?0.2:0.8;else if(st>=5)prob=last==='T'?0.3:0.7;return{prob:Math.max(0.08,Math.min(0.92,prob)),conf:Math.min(0.95,d.t/50+st*0.02)};}}
class WR { constructor() { this.db = new Map(); this.t = false; }
  ex(seq){const s=seq.map(v=>v==='T'?1:-1);const f=[];for(const p of[5,8,13,21]){if(s.length>=p*2){let corr=0;for(let i=0;i<p;i++)corr+=s[s.length-p+i]*s[s.length-p*2+i];f.push(corr/p);}}while(f.length<8)f.push(0);return f;}
  tr(data){for(let i=40;i<data.length;i++){const w=data.slice(i-40,i);const f=this.ex(w);const k=f.map(v=>Math.round(v*10)).join(',');if(!this.db.has(k))this.db.set(k,{T:0,X:0,t:0});const d=this.db.get(k);d[data[i]]=(d[data[i]]||0)+1;d.t++;}this.t=true;}
  pr(seq){if(!this.t||seq.length<40)return null;const f=this.ex(seq.slice(-40));const k=f.map(v=>Math.round(v*10)).join(',');const d=this.db.get(k);if(!d||d.t<5)return null;return{prob:Math.max(0.08,Math.min(0.92,d.T/d.t)),conf:Math.min(0.85,d.t/60)};}}
class MR { constructor() { this.db = new Map(); this.t = false; }
  tr(data){for(let i=50;i<data.length;i++){const w=data.slice(i-50,i);const t=w.filter(s=>s==='T').length;const k=`${Math.round(t/50*10)}`;if(!this.db.has(k))this.db.set(k,{T:0,X:0,t:0});const d=this.db.get(k);d[data[i]]=(d[data[i]]||0)+1;d.t++;}this.t=true;}
  pr(seq){if(!this.t||seq.length<50)return null;const t=seq.slice(-50).filter(s=>s==='T').length;const ratio=t/50;const k=`${Math.round(ratio*10)}`;const d=this.db.get(k);if(!d||d.t<5)return null;let prob=d.T/d.t;if(ratio>0.7)prob*=0.55;else if(ratio<0.3)prob=Math.min(0.92,prob*1.5);return{prob:Math.max(0.08,Math.min(0.92,prob)),conf:Math.min(0.85,d.t/80)};}}
class LS { constructor() { this.db = new Map(); this.t = false; }
  sig(x){return 1/(1+Math.exp(-x));}tanh(x){return Math.tanh(x);}
  tr(data){for(let i=30;i<data.length;i++){const w=data.slice(i-30,i);const k=w.slice(-4).join('');if(!this.db.has(k))this.db.set(k,{h:0,c:0,wf:0.5,wi:0.5,wo:0.5,wc:0.5});const d=this.db.get(k);const x=w.filter(s=>s==='T').length/w.length;const target=data[i]==='T'?1:0;const fg=this.sig(x*d.wf+d.h*0.5),ig=this.sig(x*d.wi+d.h*0.5);const og=this.sig(x*d.wo+d.h*0.5),cc=this.tanh(x*d.wc+d.h*0.5);d.c=fg*d.c+ig*cc;d.h=og*this.tanh(d.c);const err=target-d.h;d.wf+=err*x*0.005;d.wi+=err*x*0.005;d.wo+=err*x*0.005;d.wc+=err*x*0.005;}this.t=true;}
  pr(seq){if(!this.t||seq.length<30)return null;const k=seq.slice(-4).join('');const d=this.db.get(k);if(!d)return null;const x=seq.slice(-30).filter(s=>s==='T').length/30;const fg=this.sig(x*d.wf+d.h*0.5),ig=this.sig(x*d.wi+d.h*0.5);const og=this.sig(x*d.wo+d.h*0.5),cc=this.tanh(x*d.wc+d.h*0.5);const h=og*this.tanh(fg*d.c+ig*cc);return{prob:Math.max(0.08,Math.min(0.92,(h+1)/2)),conf:0.6};}}
class GB { constructor() { this.trees=[]; this.t=false; this.lr=0.08; }
  bt(features,labels,residuals,depth){if(depth>4||features.length<5){return{pred:residuals.reduce((a,b)=>a+b,0)/(residuals.length||1)};}let bestGain=-1,bestF=0,bestV=0;for(let f=0;f<Math.min(features[0]?.length||0,8);f++){const vals=features.map(feat=>feat[f]).sort((a,b)=>a-b);for(let i=0;i<vals.length-1;i++){const split=(vals[i]+vals[i+1])/2;let lS=0,rS=0,lC=0,rC=0;for(let j=0;j<features.length;j++){if(features[j][f]<split){lS+=residuals[j];lC++;}else{rS+=residuals[j];rC++;}}const gain=(lS*lS)/(lC+0.001)+(rS*rS)/(rC+0.001);if(gain>bestGain){bestGain=gain;bestF=f;bestV=split;}}}if(bestGain===-1)return{pred:residuals.reduce((a,b)=>a+b,0)/(residuals.length||1)};const lF=[],lR=[],rF=[],rR=[];for(let j=0;j<features.length;j++){if(features[j][bestF]<bestV){lF.push(features[j]);lR.push(residuals[j]);}else{rF.push(features[j]);rR.push(residuals[j]);}}return{f:bestF,v:bestV,l:this.bt(lF,labels,lR,depth+1),r:this.bt(rF,labels,rR,depth+1)};}
  pt(tree,f){if(tree.pred!==undefined)return tree.pred;return f[tree.f]<tree.v?this.pt(tree.l,f):this.pt(tree.r,f);}
  tr(data){const allF=[],allL=[];for(let i=30;i<data.length;i++){const w=data.slice(i-30,i);const feat=[];for(const len of[3,5,8,13]){if(w.length>=len){const sl=w.slice(-len);feat.push(sl.filter(s=>s==='T').length/len);feat.push(sl.filter((s,i,a)=>i>0&&s!==a[i-1]).length/Math.max(1,len-1));}}while(feat.length<8)feat.push(0.5);allF.push(feat);allL.push(data[i]==='T'?1:0);}let residuals=[...allL];for(let iter=0;iter<60;iter++){this.trees.push(this.bt(allF,allL,residuals,0));for(let j=0;j<allF.length;j++)residuals[j]-=this.lr*this.pt(this.trees[this.trees.length-1],allF[j]);}this.t=true;}
  pr(seq){if(!this.t||seq.length<30)return null;const w=seq.slice(-30);const feat=[];for(const len of[3,5,8,13]){if(w.length>=len){const sl=w.slice(-len);feat.push(sl.filter(s=>s==='T').length/len);feat.push(sl.filter((s,i,a)=>i>0&&s!==a[i-1]).length/Math.max(1,len-1));}}while(feat.length<8)feat.push(0.5);let sum=0;for(const t of this.trees)sum+=this.lr*this.pt(t,feat);return{prob:Math.max(0.08,Math.min(0.92,sum)),conf:0.75};}}
class SV { constructor() { this.sv=[]; this.alphas=[]; this.b=0; this.t=false; }
  kernel(a,b){let dot=0;for(let i=0;i<Math.min(a.length,b.length);i++)dot+=a[i]*b[i];return Math.exp(-0.5*(2-2*dot));}
  tr(data){const allF=[],allL=[];for(let i=25;i<data.length;i++){const w=data.slice(i-25,i);const feat=[];for(const len of[3,5,8]){if(w.length>=len){const sl=w.slice(-len);feat.push(sl.filter(s=>s==='T').length/len);}}while(feat.length<5)feat.push(0.5);allF.push(feat);allL.push(data[i]==='T'?1:-1);}for(let i=0;i<Math.min(allF.length,100);i++){let sum=this.b;for(let j=0;j<this.sv.length;j++)sum+=this.alphas[j]*allL[j]*this.kernel(allF[i],this.sv[j]);if(allL[i]*sum<1){this.sv.push(allF[i]);this.alphas.push(1);}}this.t=true;}
  pr(seq){if(!this.t||seq.length<25)return null;const w=seq.slice(-25);const feat=[];for(const len of[3,5,8]){if(w.length>=len){const sl=w.slice(-len);feat.push(sl.filter(s=>s==='T').length/len);}}while(feat.length<5)feat.push(0.5);let sum=this.b;for(let j=0;j<this.sv.length;j++)sum+=this.alphas[j]*this.kernel(feat,this.sv[j]);const prob=1/(1+Math.exp(-sum));return{prob:Math.max(0.08,Math.min(0.92,prob)),conf:0.65};}}
class RF { constructor() { this.trees=[]; this.t=false; }
  bt(features,labels,depth){if(depth>5||features.length<3){const t=labels.filter(l=>l==='T').length;return{pred:t/labels.length};}const rf=Math.floor(Math.random()*Math.min(features[0]?.length||1,6));const vals=features.map(f=>f[rf]).sort((a,b)=>a-b);const median=vals[Math.floor(vals.length/2)];const lF=[],lL=[],rF=[],rL=[];for(let j=0;j<features.length;j++){if(features[j][rf]<median){lF.push(features[j]);lL.push(labels[j]);}else{rF.push(features[j]);rL.push(labels[j]);}}if(lF.length===0||rF.length===0){const t=labels.filter(l=>l==='T').length;return{pred:t/labels.length};}return{f:rf,v:median,l:this.bt(lF,lL,depth+1),r:this.bt(rF,rL,depth+1)};}
  pt(tree,f){if(tree.pred!==undefined)return tree.pred;return f[tree.f]<tree.v?this.pt(tree.l,f):this.pt(tree.r,f);}
  tr(data){const allF=[],allL=[];for(let i=25;i<data.length;i++){const w=data.slice(i-25,i);const feat=[];for(const len of[2,3,5,8]){if(w.length>=len)feat.push(w.slice(-len).filter(s=>s==='T').length/len);}while(feat.length<6)feat.push(0.5);allF.push(feat);allL.push(data[i]);}for(let t=0;t<40;t++){const sample=Array(allF.length).fill(0).map(()=>Math.floor(Math.random()*allF.length));this.trees.push(this.bt(sample.map(i=>allF[i]),sample.map(i=>allL[i]),0));}this.t=true;}
  pr(seq){if(!this.t||seq.length<25)return null;const w=seq.slice(-25);const feat=[];for(const len of[2,3,5,8]){if(w.length>=len)feat.push(w.slice(-len).filter(s=>s==='T').length/len);}while(feat.length<6)feat.push(0.5);let sum=0;for(const t of this.trees)sum+=this.pt(t,feat);return{prob:Math.max(0.08,Math.min(0.92,sum/this.trees.length)),conf:0.7};}}
class KN { constructor() { this.db=[]; this.t=false; this.k=15; }
  tr(data){for(let i=30;i<data.length;i++){const w=data.slice(i-30,i);const feat=[];for(const len of[3,5,8,13]){if(w.length>=len)feat.push(w.slice(-len).filter(s=>s==='T').length/len);}while(feat.length<6)feat.push(0.5);this.db.push({feat,label:data[i]});if(this.db.length>3000)this.db.shift();}this.t=true;}
  pr(seq){if(!this.t||seq.length<30)return null;const w=seq.slice(-30);const feat=[];for(const len of[3,5,8,13]){if(w.length>=len)feat.push(w.slice(-len).filter(s=>s==='T').length/len);}while(feat.length<6)feat.push(0.5);const distances=this.db.map((entry,i)=>({dist:feat.reduce((a,b,j)=>a+Math.abs(b-entry.feat[j]),0),label:entry.label}));distances.sort((a,b)=>a.dist-b.dist);const neighbors=distances.slice(0,this.k);let wT=0,wX=0;for(const n of neighbors){const w=1/(n.dist+0.01);if(n.label==='T')wT+=w;else wX+=w;}return{prob:Math.max(0.08,Math.min(0.92,wT/(wT+wX))),conf:0.65};}}
class XB { constructor() { this.trees=[]; this.t=false; this.lr=0.1; }
  bt(features,labels,residuals,depth){if(depth>5||features.length<5)return{pred:residuals.reduce((a,b)=>a+b,0)/(residuals.length||1)};let bestGain=-1,bestF=0,bestV=0;for(let f=0;f<Math.min(features[0]?.length||0,8);f++){const vals=features.map(feat=>feat[f]).sort((a,b)=>a-b);for(let i=0;i<vals.length-1;i++){const split=(vals[i]+vals[i+1])/2;let lS=0,rS=0,lC=0,rC=0;for(let j=0;j<features.length;j++){if(features[j][f]<split){lS+=residuals[j];lC++;}else{rS+=residuals[j];rC++;}}const gain=(lS*lS)/(lC+0.001)+(rS*rS)/(rC+0.001)+0.1*Math.sqrt(lC+rC);if(gain>bestGain){bestGain=gain;bestF=f;bestV=split;}}}if(bestGain===-1)return{pred:residuals.reduce((a,b)=>a+b,0)/(residuals.length||1)};const lF=[],lR=[],rF=[],rR=[];for(let j=0;j<features.length;j++){if(features[j][bestF]<bestV){lF.push(features[j]);lR.push(residuals[j]);}else{rF.push(features[j]);rR.push(residuals[j]);}}return{f:bestF,v:bestV,l:this.bt(lF,labels,lR,depth+1),r:this.bt(rF,labels,rR,depth+1)};}
  pt(tree,f){if(tree.pred!==undefined)return tree.pred;return f[tree.f]<tree.v?this.pt(tree.l,f):this.pt(tree.r,f);}
  tr(data){const allF=[],allL=[];for(let i=35;i<data.length;i++){const w=data.slice(i-35,i);const feat=[];for(const len of[3,5,8,13,21]){if(w.length>=len){const sl=w.slice(-len);feat.push(sl.filter(s=>s==='T').length/len);feat.push(sl.filter((s,i,a)=>i>0&&s!==a[i-1]).length/Math.max(1,len-1));}}while(feat.length<10)feat.push(0.5);allF.push(feat);allL.push(data[i]==='T'?1:0);}let residuals=[...allL];for(let iter=0;iter<80;iter++){this.trees.push(this.bt(allF,allL,residuals,0));for(let j=0;j<allF.length;j++)residuals[j]-=this.lr*this.pt(this.trees[this.trees.length-1],allF[j]);}this.t=true;}
  pr(seq){if(!this.t||seq.length<35)return null;const w=seq.slice(-35);const feat=[];for(const len of[3,5,8,13,21]){if(w.length>=len){const sl=w.slice(-len);feat.push(sl.filter(s=>s==='T').length/len);feat.push(sl.filter((s,i,a)=>i>0&&s!==a[i-1]).length/Math.max(1,len-1));}}while(feat.length<10)feat.push(0.5);let sum=0;for(const t of this.trees)sum+=this.lr*this.pt(t,feat);return{prob:Math.max(0.08,Math.min(0.92,sum)),conf:0.78};}}
class NN { constructor() { this.weights=new Map(); this.t=false; }
  sig(x){return 1/(1+Math.exp(-x));}
  fw(features,weights){let sum=weights.b||0;for(let i=0;i<Math.min(features.length,weights.w?.length||0);i++)sum+=features[i]*(weights.w?.[i]||0);return this.sig(sum);}
  tr(data){for(let epoch=0;epoch<3;epoch++){for(let i=35;i<data.length;i++){const w=data.slice(i-35,i);const feat=[];for(const len of[3,5,8,13]){if(w.length>=len)feat.push(w.slice(-len).filter(s=>s==='T').length/len);}while(feat.length<8)feat.push(0.5);const k=feat.map(v=>Math.round(v*15)).join('|');if(!this.weights.has(k))this.weights.set(k,{w:Array(8).fill(0).map(()=>Math.random()*0.1),b:0});const wt=this.weights.get(k);const target=data[i]==='T'?1:0;const pred=this.fw(feat,wt);const err=target-pred;for(let j=0;j<wt.w.length;j++)wt.w[j]+=0.01*err*feat[j];wt.b+=0.01*err;}}this.t=true;}
  pr(seq){if(!this.t||seq.length<35)return null;const w=seq.slice(-35);const feat=[];for(const len of[3,5,8,13]){if(w.length>=len)feat.push(w.slice(-len).filter(s=>s==='T').length/len);}while(feat.length<8)feat.push(0.5);const k=feat.map(v=>Math.round(v*15)).join('|');const wt=this.weights.get(k);if(!wt)return null;return{prob:Math.max(0.08,Math.min(0.92,this.fw(feat,wt))),conf:0.55};}}
class EN { constructor() { this.coeffs=new Map(); this.t=false; }
  tr(data){for(let i=35;i<data.length;i++){const w=data.slice(i-35,i);const feat=[];for(const len of[3,5,8,13]){if(w.length>=len)feat.push(w.slice(-len).filter(s=>s==='T').length/len);}while(feat.length<8)feat.push(0.5);const k=feat.map(v=>Math.round(v*15)).join('|');if(!this.coeffs.has(k))this.coeffs.set(k,{w:Array(8).fill(0),b:0.5});const c=this.coeffs.get(k);const target=data[i]==='T'?1:0;let pred=c.b;for(let j=0;j<feat.length;j++)pred+=c.w[j]*feat[j];const err=target-pred;for(let j=0;j<c.w.length;j++)c.w[j]+=0.005*(err*feat[j]-0.01*Math.sign(c.w[j])-0.01*c.w[j]);c.b+=0.005*err;}this.t=true;}
  pr(seq){if(!this.t||seq.length<35)return null;const w=seq.slice(-35);const feat=[];for(const len of[3,5,8,13]){if(w.length>=len)feat.push(w.slice(-len).filter(s=>s==='T').length/len);}while(feat.length<8)feat.push(0.5);const k=feat.map(v=>Math.round(v*15)).join('|');const c=this.coeffs.get(k);if(!c)return null;let pred=c.b;for(let j=0;j<feat.length;j++)pred+=c.w[j]*feat[j];return{prob:Math.max(0.08,Math.min(0.92,pred)),conf:0.55};}}
class GP { constructor() { this.db=[]; this.t=false; }
  kernel(a,b){let d=0;for(let i=0;i<Math.min(a.length,b.length);i++)d+=(a[i]-b[i])**2;return Math.exp(-d/2);}
  tr(data){for(let i=35;i<data.length;i++){const w=data.slice(i-35,i);const feat=[];for(const len of[3,5,8,13]){if(w.length>=len)feat.push(w.slice(-len).filter(s=>s==='T').length/len);}while(feat.length<6)feat.push(0.5);this.db.push({feat,label:data[i]==='T'?1:0});if(this.db.length>2000)this.db.shift();}this.t=true;}
  pr(seq){if(!this.t||seq.length<35)return null;const w=seq.slice(-35);const feat=[];for(const len of[3,5,8,13]){if(w.length>=len)feat.push(w.slice(-len).filter(s=>s==='T').length/len);}while(feat.length<6)feat.push(0.5);let wSum=0,tSum=0;for(const entry of this.db.slice(-500)){const sim=this.kernel(feat,entry.feat);wSum+=sim;tSum+=sim*entry.label;}if(wSum===0)return null;return{prob:Math.max(0.08,Math.min(0.92,tSum/wSum)),conf:0.6};}}
class AR { constructor() { this.coeffs=new Map(); this.t=false; }
  tr(data){for(let i=30;i<data.length;i++){const w=data.slice(i-30,i);const vals=w.map(s=>s==='T'?1:0);const k=w.slice(-4).join('');if(!this.coeffs.has(k))this.coeffs.set(k,{ar:[0.4,0.3,0.2,0.1]});const c=this.coeffs.get(k);const target=vals[vals.length-1];let pred=0;for(let j=0;j<c.ar.length&&j<vals.length-1;j++)pred+=c.ar[j]*vals[vals.length-2-j];const err=target-pred;for(let j=0;j<c.ar.length;j++)c.ar[j]+=0.01*err*(vals[vals.length-2-j]||0);}this.t=true;}
  pr(seq){if(!this.t||seq.length<30)return null;const w=seq.slice(-30);const vals=w.map(s=>s==='T'?1:0);const k=w.slice(-4).join('');const c=this.coeffs.get(k);if(!c)return null;let pred=0;for(let j=0;j<c.ar.length&&j<vals.length;j++)pred+=c.ar[j]*vals[vals.length-1-j];return{prob:Math.max(0.08,Math.min(0.92,pred)),conf:0.55};}}
class AB { constructor() { this.models=[]; this.t=false; }
  tr(data){const allF=[],allL=[];for(let i=30;i<data.length;i++){const w=data.slice(i-30,i);const feat=[];for(const len of[3,5,8]){if(w.length>=len)feat.push(w.slice(-len).filter(s=>s==='T').length/len);}while(feat.length<4)feat.push(0.5);allF.push(feat);allL.push(data[i]==='T'?1:-1);}const weights=Array(allF.length).fill(1/allF.length);for(let iter=0;iter<30;iter++){const stump={f:iter%4,v:0.5,dir:1};let err=0;for(let i=0;i<allF.length;i++){const pred=allF[i][stump.f]>stump.v?stump.dir:-stump.dir;if(pred!==allL[i])err+=weights[i];}if(err>0.5||err===0)continue;const alpha=0.5*Math.log((1-err)/(err+0.001));stump.alpha=alpha;let sumW=0;for(let i=0;i<allF.length;i++){const pred=allF[i][stump.f]>stump.v?stump.dir:-stump.dir;weights[i]*=Math.exp(-alpha*allL[i]*pred);sumW+=weights[i];}for(let i=0;i<weights.length;i++)weights[i]/=sumW;this.models.push(stump);}this.t=true;}
  pr(seq){if(!this.t||seq.length<30)return null;const w=seq.slice(-30);const feat=[];for(const len of[3,5,8]){if(w.length>=len)feat.push(w.slice(-len).filter(s=>s==='T').length/len);}while(feat.length<4)feat.push(0.5);let sum=0;for(const m of this.models){const pred=m.alpha*(feat[m.f]>m.v?m.dir:-m.dir);sum+=pred;}const prob=1/(1+Math.exp(-sum));return{prob:Math.max(0.08,Math.min(0.92,prob)),conf:0.6};}}
class LG { constructor() { this.trees=[]; this.t=false; this.lr=0.05; }
  bt(features,labels,residuals,depth){if(depth>6||features.length<5)return{pred:residuals.reduce((a,b)=>a+b,0)/(residuals.length||1)};let bestGain=-1,bestF=0,bestV=0;for(let f=0;f<Math.min(features[0]?.length||0,8);f++){const vals=features.map(feat=>feat[f]).sort((a,b)=>a-b);for(let i=0;i<vals.length-1;i++){const split=(vals[i]+vals[i+1])/2;let lS=0,rS=0,lC=0,rC=0;for(let j=0;j<features.length;j++){if(features[j][f]<split){lS+=residuals[j];lC++;}else{rS+=residuals[j];rC++;}}const gain=(lS*lS)/(lC+0.001)+(rS*rS)/(rC+0.001)-0.1*(lC+rC);if(gain>bestGain){bestGain=gain;bestF=f;bestV=split;}}}if(bestGain===-1)return{pred:residuals.reduce((a,b)=>a+b,0)/(residuals.length||1)};const lF=[],lR=[],rF=[],rR=[];for(let j=0;j<features.length;j++){if(features[j][bestF]<bestV){lF.push(features[j]);lR.push(residuals[j]);}else{rF.push(features[j]);rR.push(residuals[j]);}}return{f:bestF,v:bestV,l:this.bt(lF,labels,lR,depth+1),r:this.bt(rF,labels,rR,depth+1)};}
  pt(tree,f){if(tree.pred!==undefined)return tree.pred;return f[tree.f]<tree.v?this.pt(tree.l,f):this.pt(tree.r,f);}
  tr(data){const allF=[],allL=[];for(let i=30;i<data.length;i++){const w=data.slice(i-30,i);const feat=[];for(const len of[3,5,8,13,21]){if(w.length>=len){const sl=w.slice(-len);feat.push(sl.filter(s=>s==='T').length/len);feat.push(sl.filter((s,i,a)=>i>0&&s!==a[i-1]).length/Math.max(1,len-1));}}while(feat.length<10)feat.push(0.5);allF.push(feat);allL.push(data[i]==='T'?1:0);}let residuals=[...allL];for(let iter=0;iter<100;iter++){this.trees.push(this.bt(allF,allL,residuals,0));for(let j=0;j<allF.length;j++)residuals[j]-=this.lr*this.pt(this.trees[this.trees.length-1],allF[j]);}this.t=true;}
  pr(seq){if(!this.t||seq.length<30)return null;const w=seq.slice(-30);const feat=[];for(const len of[3,5,8,13,21]){if(w.length>=len){const sl=w.slice(-len);feat.push(sl.filter(s=>s==='T').length/len);feat.push(sl.filter((s,i,a)=>i>0&&s!==a[i-1]).length/Math.max(1,len-1));}}while(feat.length<10)feat.push(0.5);let sum=0;for(const t of this.trees)sum+=this.lr*this.pt(t,feat);return{prob:Math.max(0.08,Math.min(0.92,sum)),conf:0.8};}}
class CB { constructor() { this.trees=[]; this.t=false; this.lr=0.06; }
  bt(features,labels,residuals,depth){if(depth>5||features.length<5)return{pred:residuals.reduce((a,b)=>a+b,0)/(residuals.length||1)};let bestGain=-1,bestF=0,bestV=0;for(let f=0;f<Math.min(features[0]?.length||0,8);f++){const vals=[...new Set(features.map(feat=>feat[f]))].sort((a,b)=>a-b);for(const split of vals){let lS=0,rS=0,lC=0,rC=0;for(let j=0;j<features.length;j++){if(features[j][f]<=split){lS+=residuals[j];lC++;}else{rS+=residuals[j];rC++;}}if(lC<3||rC<3)continue;const gain=(lS*lS)/(lC+0.001)+(rS*rS)/(rC+0.001);if(gain>bestGain){bestGain=gain;bestF=f;bestV=split;}}}if(bestGain===-1)return{pred:residuals.reduce((a,b)=>a+b,0)/(residuals.length||1)};const lF=[],lR=[],rF=[],rR=[];for(let j=0;j<features.length;j++){if(features[j][bestF]<=bestV){lF.push(features[j]);lR.push(residuals[j]);}else{rF.push(features[j]);rR.push(residuals[j]);}}return{f:bestF,v:bestV,l:this.bt(lF,labels,lR,depth+1),r:this.bt(rF,labels,rR,depth+1)};}
  pt(tree,f){if(tree.pred!==undefined)return tree.pred;return f[tree.f]<=tree.v?this.pt(tree.l,f):this.pt(tree.r,f);}
  tr(data){const allF=[],allL=[];for(let i=30;i<data.length;i++){const w=data.slice(i-30,i);const feat=[];for(const len of[3,5,8,13]){if(w.length>=len){const sl=w.slice(-len);feat.push(sl.filter(s=>s==='T').length/len);feat.push(sl.filter((s,i,a)=>i>0&&s!==a[i-1]).length/Math.max(1,len-1));}}while(feat.length<8)feat.push(0.5);allF.push(feat);allL.push(data[i]==='T'?1:0);}let residuals=[...allL];for(let iter=0;iter<80;iter++){this.trees.push(this.bt(allF,allL,residuals,0));for(let j=0;j<allF.length;j++)residuals[j]-=this.lr*this.pt(this.trees[this.trees.length-1],allF[j]);}this.t=true;}
  pr(seq){if(!this.t||seq.length<30)return null;const w=seq.slice(-30);const feat=[];for(const len of[3,5,8,13]){if(w.length>=len){const sl=w.slice(-len);feat.push(sl.filter(s=>s==='T').length/len);feat.push(sl.filter((s,i,a)=>i>0&&s!==a[i-1]).length/Math.max(1,len-1));}}while(feat.length<8)feat.push(0.5);let sum=0;for(const t of this.trees)sum+=this.lr*this.pt(t,feat);return{prob:Math.max(0.08,Math.min(0.92,sum)),conf:0.77};}}

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
            { n:'QUANTUM', e:new QS(), w:3.8 },{ n:'BAYESIAN', e:new BM(), w:3.2 },{ n:'PATTERN', e:new PF(), w:3.0 },{ n:'WEIBULL', e:new WB(), w:2.8 },{ n:'JSD', e:new JS(), w:2.5 },{ n:'MARKOV', e:new MK(), w:2.2 },{ n:'ENTROPY', e:new EF(), w:2.0 },{ n:'MOMENTUM', e:new MT(), w:1.8 },{ n:'FRACTAL', e:new FG(), w:1.7 },{ n:'STREAK', e:new AS(), w:1.6 },{ n:'WAVE', e:new WR(), w:1.5 },{ n:'MEANREV', e:new MR(), w:1.4 },{ n:'LSTM', e:new LS(), w:1.3 },{ n:'GBOOST', e:new GB(), w:1.4 },{ n:'SVM', e:new SV(), w:1.2 },{ n:'RANDFOR', e:new RF(), w:1.3 },{ n:'KNN', e:new KN(), w:1.1 },{ n:'XGBOOST', e:new XB(), w:1.4 },{ n:'NEURAL', e:new NN(), w:1.0 },{ n:'ELASTIC', e:new EN(), w:0.9 },{ n:'GAUSSIAN', e:new GP(), w:0.9 },{ n:'ARIMA', e:new AR(), w:0.8 },{ n:'ADABOOST', e:new AB(), w:0.9 },{ n:'LIGHTGBM', e:new LG(), w:1.5 },{ n:'CATBOOST', e:new CB(), w:1.4 }
        ];
    }
    train(data) { if (data.length < 50) return false; try { for (const eng of this.engines) eng.e.tr(data); this.trained = true; return true; } catch(e) { return false; } }
    predict(data) {
        if (!data || data.length < 10) return this.fb();
        const seq = data.map(d => d==='T'?'T':'X');
        let sT=0,sX=0,sw=0; const dt=[];
        for (const eng of this.engines) { try { const r = eng.e.pr(seq); if (r) { const w = eng.w*r.conf; sT += r.prob*w; sX += (1-r.prob)*w; sw += w; dt.push(`${eng.n}:${Math.round(r.prob*100)}`); } } catch(e) {} }
        const last = seq[seq.length-1]; let streak = 1;
        for (let j=seq.length-2; j>=0&&seq[j]===last; j--) streak++;
        if (streak>=10) { if (last==='T'){sX+=8;dt.push('BREAK-T10');}else{sT+=8;dt.push('BREAK-X10');} sw+=8; }
        else if (streak>=7) { if (last==='T'){sX+=5;dt.push('BREAK-T7');}else{sT+=5;dt.push('BREAK-X7');} sw+=5; }
        else if (streak>=5) { if (last==='T'){sX+=3;dt.push('BREAK-T5');}else{sT+=3;dt.push('BREAK-X5');} sw+=3; }
        const lt = seq.filter(s=>s==='T').length/seq.length;
        if (lt>0.75) { sX+=5; dt.push('BAL+'); sw+=5; } else if (lt<0.25) { sT+=5; dt.push('BAL-'); sw+=5; }
        if (sw===0) return this.fb();
        const prob = sT/(sT+sX); const dd = prob>0.5?'TÀI':'XỈU';
        let tc = Math.round(Math.max(prob,1-prob)*100);
        if (dt.length>=20) tc=Math.min(99,tc+15); else if (dt.length>=15) tc=Math.min(99,tc+12); else if (dt.length>=10) tc=Math.min(99,tc+8); else if (dt.length>=5) tc=Math.min(99,tc+5);
        tc = Math.min(99, Math.max(55, tc));
        return {duDoan:dd,doTinCay:tc,chiTiet:dt.slice(0,8).join(' | '),soMau:dt.length};
    }
    fb() { if (this.stats.total>50) return {duDoan:this.stats.dung>this.stats.sai?'TÀI':'XỈU',doTinCay:52,chiTiet:'TREND',soMau:0}; return {duDoan:'TÀI',doTinCay:51,chiTiet:'INIT',soMau:0}; }
    update(prediction, actual) { const pr = prediction==='TÀI'?'T':'X'; const ac = actual==='TÀI'?'T':'X'; const ok = pr===ac; this.stats.total++; if (ok) { this.stats.dung++; this.stats.chuoi = this.stats.chuoi>=0?this.stats.chuoi+1:1; if (this.stats.chuoi>this.stats.chuoi_dai) this.stats.chuoi_dai=this.stats.chuoi; this.stats.chuoi_thang_hientai++; this.stats.chuoi_thua_hientai=0; this.stats.homnay.dung++; } else { this.stats.sai++; this.stats.chuoi = this.stats.chuoi<=0?this.stats.chuoi-1:-1; if (Math.abs(this.stats.chuoi)>this.stats.chuoi_thua_dai) this.stats.chuoi_thua_dai=Math.abs(this.stats.chuoi); this.stats.chuoi_thua_hientai++; this.stats.chuoi_thang_hientai=0; this.stats.homnay.sai++; } this.stats.homnay.tong++; this.stats.tyle = this.stats.total>0?Math.round((this.stats.dung/this.stats.total)*100):0; }
    save() { try { fs.writeFileSync(`.${this.type}_data`, JSON.stringify({history:this.history.slice(0,2000),stats:this.stats,lastPhien:this.lastPhien,trained:this.trained}), 'utf8'); } catch(e) {} }
    load() { try { const f = `.${this.type}_data`; if (fs.existsSync(f)) { const d = JSON.parse(fs.readFileSync(f,'utf8')); if (d.history) this.history = d.history; if (d.stats) this.stats = d.stats; if (d.lastPhien) this.lastPhien = d.lastPhien; if (d.trained) this.trained = d.trained; } } catch(e) {} }
}

const brainHU = new PredictionCore('hu');
const brainMD5 = new PredictionCore('md5');
brainHU.load();
brainMD5.load();

// ============================================================
// AUTO
// ============================================================
async function processGame(brain, type) { try { const data = await fetchData(type); if (!data||data.length===0) return; const cur = data[0].phien; if (brain.lastPhien===cur) return; for (const r of brain.history) { if (r.status&&r.status!=='') continue; const a = data.find(d=>d.phien.toString()===r.phien_hien_tai); if (a) { r.status=(r.prediction===a.result)?'✅':'❌'; r.actual=a.result; brain.update(r.prediction,a.result); } } const ex = brain.history.find(h=>h.phien_hien_tai===(cur+1).toString()); if (ex) return; const hd = data.map(d=>d.result==='TÀI'?'T':'X'); if (hd.length>=50) brain.train(hd); const result = brain.predict(hd); const rec = {phien:data[0].phien,phien_hien_tai:(data[0].phien+1).toString(),dice:`${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`,total:data[0].total,actual:data[0].result,prediction:result.duDoan,confidence:result.doTinCay,detail:result.chiTiet,status:'',timestamp:new Date().toISOString(),soMau:result.soMau||0}; brain.history.unshift(rec); if (brain.history.length>2000) brain.history = brain.history.slice(0,2000); brain.lastPhien = cur; brain.save(); } catch(e) {} }
async function autoProcess() { await Promise.all([processGame(brainHU,'hu'),processGame(brainMD5,'md5')]); }
function startAuto() { setTimeout(autoProcess,3000); setInterval(autoProcess,5000); }

// ============================================================
// HTML PAGES
// ============================================================
function loginPage() {
    return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>CRYSTAL TX - Đăng Nhập</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#010314;--bg2:#060b24;--bg3:#0d1335;--b:rgba(255,255,255,0.06);--t:#e2e8f0;--t2:#8899b8;--t3:#4a5578;--g:linear-gradient(135deg,#7b61ff,#3b82f6,#06b6d4);--ok:#22c55e;--no:#ef4444}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--t);min-height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden}
.stars{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none}
.star{position:absolute;background:#fff;border-radius:50%;animation:tw 3s infinite}
@keyframes tw{0%,100%{opacity:0.15}50%{opacity:0.7}}
.nebula{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none}
.n1{position:absolute;width:700px;height:700px;background:rgba(123,97,255,0.12);border-radius:50%;filter:blur(130px);top:-250px;left:-150px;animation:f1 25s infinite}
.n2{position:absolute;width:600px;height:600px;background:rgba(6,182,212,0.08);border-radius:50%;filter:blur(130px);bottom:-200px;right:-100px;animation:f2 30s infinite}
@keyframes f1{0%,100%{transform:translate(0,0)}50%{transform:translate(100px,60px)}}
@keyframes f2{0%,100%{transform:translate(0,0)}50%{transform:translate(-80px,-40px)}}
.card{position:relative;z-index:1;background:rgba(13,19,53,0.7);backdrop-filter:blur(40px);border:1px solid var(--b);border-radius:24px;padding:44px 36px;width:100%;max-width:460px;box-shadow:0 50px 120px rgba(0,0,0,0.6);animation:slideUp 0.6s ease-out}
@keyframes slideUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
@keyframes glow{0%,100%{filter:drop-shadow(0 0 10px rgba(123,97,255,0.4))}50%{filter:drop-shadow(0 0 30px rgba(123,97,255,0.8))}}
input{width:100%;padding:12px 16px;background:var(--bg2);border:1px solid var(--b);border-radius:10px;color:var(--t);font-size:13px;font-family:'JetBrains Mono',monospace;outline:none}
input:focus{border-color:rgba(123,97,255,0.3);box-shadow:0 0 0 3px rgba(123,97,255,0.1)}
.btn{width:100%;padding:14px;background:var(--g);border:none;border-radius:10px;color:#fff;font-weight:700;font-size:14px;cursor:pointer;transition:all 0.3s}
.btn:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(123,97,255,0.4)}
.tg{background:var(--g);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
</style></head><body>
<div class="stars">${Array(60).fill(0).map((_,i)=>`<div class="star" style="left:${Math.random()*100}%;top:${Math.random()*100}%;width:${1+Math.random()*2}px;height:${1+Math.random()*2}px;animation-delay:${Math.random()*3}s"></div>`).join('')}</div>
<div class="nebula"><div class="n1"></div><div class="n2"></div></div>
<div class="card">
<div style="text-align:center;margin-bottom:32px"><div style="font-size:56px;animation:glow 3s infinite;display:inline-block">💎</div><h1 style="font-family:'Orbitron',sans-serif;font-size:28px;font-weight:900;margin-top:12px"><span class="tg">CRYSTAL TX</span></h1><p style="font-size:10px;color:var(--t3);font-family:'Space Grotesk',sans-serif;letter-spacing:3px;margin-top:6px">25 Engines</p></div>
<form onsubmit="login(event)"><div style="margin-bottom:24px"><label style="display:block;font-size:9px;color:var(--t2);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600">Access Key</label><input type="password" id="p" autocomplete="off" required></div>
<button type="submit" class="btn">🔐 Access System</button></form>
<div id="res" style="margin-top:24px"></div></div>
<script>
async function login(e){e.preventDefault();
const p=document.getElementById('p').value.trim(),r=document.getElementById('res');
if(!p){r.innerHTML='<div style="background:rgba(239,68,68,0.1);padding:14px;border-radius:10px;color:#ef4444;font-size:13px">Vui long nhap key</div>';return}
r.innerHTML='<div style="background:rgba(6,182,212,0.1);padding:14px;border-radius:10px;color:#06b6d4;font-size:13px">Dang xac thuc...</div>';
try{const rs=await fetch('/_api/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:p})});
const d=await rs.json();
if(rs.ok&&d.token){window.location.href='/_home?_token='+d.token}
else{r.innerHTML='<div style="background:rgba(239,68,68,0.1);padding:14px;border-radius:10px;color:#ef4444;font-size:13px">Sai key</div>'}}
catch(ex){r.innerHTML='<div style="background:rgba(239,68,68,0.1);padding:14px;border-radius:10px;color:#ef4444;font-size:13px">Loi ket noi</div>'}}</script></body></html>`;
}

function homePage(token) {
    return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>CRYSTAL TX - Trang Chủ</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#010314;--bg2:#060b24;--bg3:#0d1335;--b:rgba(255,255,255,0.06);--t:#e2e8f0;--t2:#8899b8;--t3:#4a5578;--g:linear-gradient(135deg,#7b61ff,#3b82f6,#06b6d4);--ok:#22c55e;--p:#7b61ff;--c:#06b6d4}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--t);min-height:100vh;overflow-x:hidden}
.stars{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none}
.star{position:absolute;background:#fff;border-radius:50%;animation:tw 3s infinite}
@keyframes tw{0%,100%{opacity:0.15}50%{opacity:0.7}}
.nebula{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none}
.n1{position:absolute;width:700px;height:700px;background:rgba(123,97,255,0.12);border-radius:50%;filter:blur(130px);top:-250px;left:-150px;animation:f1 25s infinite}
.n2{position:absolute;width:600px;height:600px;background:rgba(6,182,212,0.08);border-radius:50%;filter:blur(130px);bottom:-200px;right:-100px;animation:f2 30s infinite}
@keyframes f1{0%,100%{transform:translate(0,0)}50%{transform:translate(100px,60px)}}
@keyframes f2{0%,100%{transform:translate(0,0)}50%{transform:translate(-80px,-40px)}}
.grid{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px);background-size:60px 60px;mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 15%,transparent 70%)}
.app{position:relative;z-index:1;max-width:900px;margin:0 auto;padding:30px 20px}
.hero{text-align:center;margin-bottom:40px;animation:fadeIn 0.8s}
@keyframes fadeIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.hero .icon{font-size:80px;animation:glow 3s infinite;display:inline-block}
@keyframes glow{0%,100%{filter:drop-shadow(0 0 15px rgba(123,97,255,0.4))}50%{filter:drop-shadow(0 0 40px rgba(123,97,255,0.8))}}
.hero h1{font-family:'Orbitron',sans-serif;font-size:38px;font-weight:900;margin-top:16px;background:var(--g);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hero .tagline{font-size:12px;color:var(--t2);margin-top:10px;letter-spacing:3px;text-transform:uppercase;font-family:'Space Grotesk',sans-serif}
.hero .desc{font-size:11px;color:var(--t3);margin-top:16px;line-height:1.8;max-width:650px;margin-left:auto;margin-right:auto;font-family:'Space Grotesk',sans-serif}
.cards{display:grid;grid-template-columns:repeat(2,1fr);gap:20px;max-width:650px;margin:0 auto 30px}
@media(max-width:500px){.cards{grid-template-columns:1fr}}
.card{background:rgba(13,19,53,0.6);backdrop-filter:blur(20px);border:1px solid var(--b);border-radius:24px;padding:40px 30px;text-align:center;cursor:pointer;transition:all 0.4s;text-decoration:none;color:var(--t);position:relative;overflow:hidden}
.card::before{content:'';position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;transition:opacity 0.4s}
.card-hu::before{background:radial-gradient(circle at 50% 50%,rgba(123,97,255,0.15),transparent 70%)}
.card-md5::before{background:radial-gradient(circle at 50% 50%,rgba(6,182,212,0.15),transparent 70%)}
.card:hover::before{opacity:1}
.card:hover{transform:translateY(-8px);border-color:rgba(123,97,255,0.4);box-shadow:0 25px 70px rgba(0,0,0,0.5)}
.card .ci{font-size:60px;margin-bottom:16px;position:relative;z-index:1}
.card h2{font-family:'Orbitron',sans-serif;font-size:22px;font-weight:700;margin-bottom:10px;position:relative;z-index:1}
.card .sub{font-size:10px;color:var(--t3);font-family:'JetBrains Mono',monospace;letter-spacing:1px;position:relative;z-index:1}
.features{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;max-width:650px;margin:0 auto 30px}
@media(max-width:600px){.features{grid-template-columns:repeat(2,1fr)}}
.feat{background:rgba(13,19,53,0.4);border:1px solid var(--b);border-radius:16px;padding:20px;text-align:center;transition:all 0.3s}
.feat:hover{border-color:rgba(123,97,255,0.3);transform:translateY(-3px)}
.feat .fi{font-size:30px;margin-bottom:8px}
.feat .ft{font-size:11px;color:var(--t2);font-family:'Space Grotesk',sans-serif;font-weight:600}
.feat .fs{font-size:9px;color:var(--t3);margin-top:4px;font-family:'JetBrains Mono',monospace}
.footer{text-align:center;font-size:7px;color:var(--t3);font-family:'JetBrains Mono',monospace;line-height:1.8;max-width:650px;margin:0 auto;animation:fadeIn 1.2s}
.logout-btn{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:40px;color:#ef4444;text-decoration:none;font-size:10px;font-weight:600;transition:all 0.3s;margin-bottom:20px}
.logout-btn:hover{background:rgba(239,68,68,0.2)}
</style></head><body>
<div class="stars">${Array(70).fill(0).map((_,i)=>`<div class="star" style="left:${Math.random()*100}%;top:${Math.random()*100}%;width:${1+Math.random()*2}px;height:${1+Math.random()*2}px;animation-delay:${Math.random()*3}s"></div>`).join('')}</div>
<div class="nebula"><div class="n1"></div><div class="n2"></div></div><div class="grid"></div>
<div class="app">
<div style="text-align:right;margin-bottom:10px"><a href="/_login" class="logout-btn">🚪 Thoat / Dang xuat</a></div>
<div class="hero"><div class="icon">💎</div><h1>CRYSTAL TX</h1><div class="tagline">He Thong Du Doan Tai Xiu</div><div class="desc">Nen tang phan tich du lieu su dung 25 thuat toan du doan tien tien bao gom Quantum Spectral, Bayesian Meta, Pattern Fingerprint, Weibull Survival, JSD Uncertainty, Markov Chain, Entropy Flow, Momentum Trend, Fractal Geometry, LSTM, Gradient Boost, XGBoost, LightGBM, CatBoost va nhieu engine khac. Tu dong cap nhat moi 5 giay voi do chinh xac cao. Lich su luu tru len den 1000 phien.</div></div>
<div class="cards">
<a href="/_hu?_token=${token}" class="card card-hu"><div class="ci">🎰</div><h2>TAI XIU HU</h2><div class="sub">Live Prediction • Auto 5s • 1K History</div></a>
<a href="/_md5?_token=${token}" class="card card-md5"><div class="ci">🔮</div><h2>TAI XIU MD5</h2><div class="sub">Live Prediction • Auto 5s • 1K History</div></a></div>
<div class="features">
<div class="feat"><div class="fi">⚡</div><div class="ft">25 Engines</div><div class="fs">Real-time Analysis</div></div>
<div class="feat"><div class="fi">🎯</div><div class="ft">High Accuracy</div><div class="fs">Multi-model Ensemble</div></div>
<div class="feat"><div class="fi">🔄</div><div class="ft">Auto Update</div><div class="fs">Every 5 Seconds</div></div>
<div class="feat"><div class="fi">📊</div><div class="ft">1K History</div><div class="fs">Full Tracking</div></div></div>
<div class="footer">💎 CRYSTAL TX • QUANTUM • BAYESIAN • PATTERN • WEIBULL • JSD • MARKOV • ENTROPY • MOMENTUM • FRACTAL • STREAK • WAVE • MEANREV • LSTM • GBOOST • SVM • RANDFOR • KNN • XGBOOST • NEURAL • ELASTIC • GAUSSIAN • ARIMA • ADABOOST • LIGHTGBM • CATBOOST</div></div></body></html>`;
}

function dashboardPage(brain, type, token) {
    const s = brain.stats; const all = (brain.history||[]);
    const recent = all.slice(0,15); const all1000 = all.slice(0,1000);
    let td=0,ts=0,td1k=0,ts1k=0;
    for(const r of recent){if(r.status==='✅')td++;else if(r.status==='❌')ts++;}
    for(const r of all1000){if(r.status==='✅')td1k++;else if(r.status==='❌')ts1k++;}
    
    let histHTML = '';
    for(const r of all1000.slice(0,50)){
        const st=r.status||'⏳'; const cls=st==='✅'?'tai-text':st==='❌'?'xiu-text':'';
        const pred=r.prediction||'--'; const conf=r.confidence||0;
        histHTML += `<div class="hl-item"><span class="hl-phien">#${r.phien_hien_tai||'-'}</span><span class="${cls}" style="font-weight:700;font-size:14px">${pred}</span><span class="hl-conf">${conf}%</span><span class="hl-time">${(r.timestamp||'').substring(11,16)||'--:--'}</span></div>`;
    }
    
    let dots1k = '';
    for(const r of all1000.slice(0,200)){
        const st=r.status||'⏳',c=st==='✅'?'s':st==='❌'?'d':'w',t=st==='✅'?'W':st==='❌'?'L':'?';
        dots1k += `<span class="dot dot-${c}" title="#${r.phien_hien_tai}: ${r.prediction} → ${r.actual||'?'}">${t}</span>`;
    }
    
    const phien = recent[0]?.phien_hien_tai || '---';
    const pred = recent[0]?.prediction || '...';
    const conf = recent[0]?.confidence || 0;
    const cls = pred==='TÀI'?'tai':pred==='XỈU'?'xiu':'loading';
    const confBarCls = pred==='TÀI'?'tai-bar':pred==='XỈU'?'xiu-bar':'def-bar';
    const gameName = type==='hu'?'Tai Xiu Hu':'Tai Xiu MD5';
    const wr=s.tyle;const wc=wr>=70?'#2dd4a8':wr>=60?'#facc15':'#f87171';
    
    return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=yes"><title>${gameName} | CRYSTAL TX</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0b0e14;color:#eef2f6;font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;min-height:100vh;display:flex;flex-direction:column}
:root{--bg:#0b0e14;--bg2:#131a24;--card:#0f1620;--border:#1e2a3a;--border2:#2d3d52;--text:#f0f4fa;--sub:#b8cce0;--muted:#7a8fa3;--primary:#5b9aff;--accent:#b084f7;--gold:#facc15;--green:#2dd4a8;--red:#f87171;--r:24px;--r-sm:14px;--shadow:0 20px 60px rgba(0,0,0,0.7)}
.game-page{max-width:700px;margin:0 auto;padding:24px 16px 40px;width:100%;flex:1}
.robot-card{background:var(--card);border:1px solid var(--border2);border-radius:var(--r);overflow:hidden;box-shadow:var(--shadow);backdrop-filter:blur(4px);transition:0.3s}
.rc-header{padding:18px 22px;background:linear-gradient(145deg,rgba(91,154,255,0.07),rgba(176,132,247,0.04));border-bottom:1px solid var(--border);display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.rc-icon-fb{width:48px;height:48px;border-radius:16px;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff;font-weight:700;font-family:'Inter',sans-serif;flex-shrink:0;box-shadow:0 6px 16px rgba(91,154,255,0.25)}
.rc-name{font-size:18px;font-weight:700;color:var(--text);letter-spacing:-0.3px;background:linear-gradient(135deg,#fff,#b8cce0);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
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
.stat-item{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r-sm);padding:14px 6px;text-align:center;transition:0.2s}
.stat-item:hover{border-color:var(--border2)}
.si-val{font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:700;color:var(--text)}
.si-lbl{font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-top:4px;font-weight:600}
.rc-footer{padding:12px 20px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--muted);flex-wrap:wrap;gap:6px;background:rgba(0,0,0,0.15)}
.hist-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);margin-top:18px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.3)}
.hist-head{padding:14px 20px;border-bottom:1px solid var(--border);font-size:13px;font-weight:700;color:var(--sub);display:flex;align-items:center;justify-content:space-between;gap:10px;background:rgba(255,255,255,0.02);flex-wrap:wrap}
.hist-body{padding:12px 14px 14px;max-height:500px;overflow-y:auto}
.hl-item{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:var(--bg2);border-radius:var(--r-sm);border:1px solid var(--border);margin-bottom:6px;font-size:12px;transition:0.15s}
.hl-item:hover{border-color:var(--border2)}
.hl-phien{font-family:'JetBrains Mono',monospace;color:var(--muted);font-size:10px;font-weight:600}
.hl-conf{font-size:10px;color:var(--gold);font-family:'JetBrains Mono',monospace;font-weight:700}
.hl-time{font-size:10px;color:var(--muted)}
.tai-text{color:#2dd4a8;font-weight:700}
.xiu-text{color:#f87171;font-weight:700}
.back-btn{display:inline-flex;align-items:center;gap:6px;color:var(--primary);text-decoration:none;font-size:11px;font-weight:600;padding:8px 16px;background:rgba(91,154,255,0.08);border:1px solid rgba(91,154,255,0.2);border-radius:40px;transition:all 0.3s}
.back-btn:hover{background:rgba(91,154,255,0.15)}
.dot{width:17px;height:17px;border-radius:3px;font-size:6px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;margin:1px;font-family:'JetBrains Mono',monospace;transition:all 0.2s}
.dot-s{background:rgba(45,212,168,0.15);color:var(--green);border:1px solid rgba(45,212,168,0.2)}
.dot-d{background:rgba(248,113,113,0.15);color:var(--red);border:1px solid rgba(248,113,113,0.2)}
.dot-w{background:rgba(250,204,21,0.15);color:var(--gold);border:1px solid rgba(250,204,21,0.2)}
.dot:hover{transform:scale(1.3);z-index:2}
.dots-grid{display:flex;flex-wrap:wrap;gap:2px;padding:10px 14px;max-height:200px;overflow-y:auto}
@media(max-width:480px){.game-page{padding:16px 12px 30px}.rc-header{padding:14px 16px;gap:10px}.rc-name{font-size:15px}.stats-row{gap:6px;padding:0 14px 14px;grid-template-columns:repeat(2,1fr)}.stat-item{padding:10px 4px}.si-val{font-size:14px}.pred-display{padding:22px 12px 14px}}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:var(--bg)}::-webkit-scrollbar-thumb{background:var(--border2);border-radius:10px}
</style></head><body>
<div class="game-page">
<div class="robot-card">
<div class="rc-header">
<div class="rc-icon-fb"><i class="fas fa-robot"></i></div>
<div><div class="rc-name">${gameName}</div><div class="rc-type"><i class="fas fa-brain"></i> 25 Engines · Real-time</div></div>
<div class="rc-live"><i class="fas fa-circle"></i> LIVE</div></div>
<div class="pred-display">
<div class="pd-label"><i class="fas fa-bullseye"></i> Du doan phien tiep theo</div>
<div class="pd-phien">Phien #${phien}</div>
<div class="pd-result ${cls}">${pred}</div>
<div class="conf-track"><div class="conf-fill ${confBarCls}"></div></div>
<div class="conf-pct">${conf}%</div>
<div class="conf-lbl">DO TIN CAY</div></div>
<div class="stats-row">
<div class="stat-item"><div class="si-val">${phien}</div><div class="si-lbl">Phien</div></div>
<div class="stat-item"><div class="si-val">${conf}%</div><div class="si-lbl">Tin cay</div></div>
<div class="stat-item"><div class="si-val" style="color:${wc}">${wr}%</div><div class="si-lbl">Win Rate</div></div>
<div class="stat-item"><div class="si-val">${td1k}W/${ts1k}L</div><div class="si-lbl">1K History</div></div></div>
<div class="rc-footer">
<a href="/_home?_token=${token}" class="back-btn"><i class="fas fa-arrow-left"></i> Trang chu</a>
<span><i class="fas fa-sync-alt fa-fw"></i> Auto 5s</span>
<span style="color:var(--green)"><i class="fas fa-check-circle"></i> Online</span></div></div>
<div class="hist-card">
<div class="hist-head"><span><i class="fas fa-chart-bar"></i> Thong ke 200 phien</span><span style="font-size:10px;color:var(--muted)">${td1k}W/${ts1k}L</span></div>
<div class="dots-grid">${dots1k||'Dang tai...'}</div></div>
<div class="hist-card" style="margin-top:14px">
<div class="hist-head"><span><i class="fas fa-clock-rotate-left"></i> Lich su chi tiet (${all1000.length} phien)</span></div>
<div class="hist-body">${histHTML||'<div style="color:var(--muted);font-size:12px;text-align:center;padding:6px 0">Dang tai...</div>'}</div></div></div>
<script>setTimeout(()=>location.reload(),5000);</script></body></html>`;
}

// ============================================================
// API ENDPOINTS
// ============================================================
app.get('/_login', (req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.send(loginPage()); });
app.get('/', (req, res) => res.redirect('/_login'));
app.post('/_api/access', (req, res) => { const { key } = req.body || {}; if (!key) return res.status(400).json({ error: 'Thieu key' }); if (key === PASS) { const token = createToken(); return res.json({ token }); } return res.status(401).json({ error: 'Sai key' }); });
app.get('/_home', checkAuth, (req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.send(homePage(req.query['_token'])); });
app.get('/_hu', checkAuth, async (req, res) => { const data = await fetchData('hu'); if (data) { for (const r of brainHU.history) { if (r.status && r.status !== '') continue; const a = data.find(d => d.phien.toString() === r.phien_hien_tai); if (a) { r.status = (r.prediction === a.result) ? '✅' : '❌'; r.actual = a.result; brainHU.update(r.prediction, a.result); } } brainHU.save(); } res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.send(dashboardPage(brainHU, 'hu', req.query['_token'])); });
app.get('/_md5', checkAuth, async (req, res) => { const data = await fetchData('md5'); if (data) { for (const r of brainMD5.history) { if (r.status && r.status !== '') continue; const a = data.find(d => d.phien.toString() === r.phien_hien_tai); if (a) { r.status = (r.prediction === a.result) ? '✅' : '❌'; r.actual = a.result; brainMD5.update(r.prediction, a.result); } } brainMD5.save(); } res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.send(dashboardPage(brainMD5, 'md5', req.query['_token'])); });
app.get('/_hu/json', checkAuth, async (req, res) => { try { const data = await fetchData('hu'); if (!data || data.length === 0) { const r = brainHU.fb(); return res.json({ prediction: r.duDoan, confidence: r.doTinCay, detail: r.chiTiet }); } const exist = brainHU.history.find(h => h.phien_hien_tai === (data[0].phien + 1).toString()); if (exist) return res.json(exist); const hd = data.map(d => d.result === 'TÀI' ? 'T' : 'X'); if (hd.length >= 50) brainHU.train(hd); const result = brainHU.predict(hd); const rec = { phien: data[0].phien, phien_hien_tai: (data[0].phien + 1).toString(), dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`, total: data[0].total, actual: data[0].result, prediction: result.duDoan, confidence: result.doTinCay, detail: result.chiTiet, status: '', timestamp: new Date().toISOString(), soMau: result.soMau || 0 }; brainHU.history.unshift(rec); if (brainHU.history.length > 2000) brainHU.history = brainHU.history.slice(0, 2000); brainHU.save(); res.json(rec); } catch (e) { res.status(500).json({ error: 'Loi' }); } });
app.get('/_md5/json', checkAuth, async (req, res) => { try { const data = await fetchData('md5'); if (!data || data.length === 0) { const r = brainMD5.fb(); return res.json({ prediction: r.duDoan, confidence: r.doTinCay, detail: r.chiTiet }); } const exist = brainMD5.history.find(h => h.phien_hien_tai === (data[0].phien + 1).toString()); if (exist) return res.json(exist); const hd = data.map(d => d.result === 'TÀI' ? 'T' : 'X'); if (hd.length >= 50) brainMD5.train(hd); const result = brainMD5.predict(hd); const rec = { phien: data[0].phien, phien_hien_tai: (data[0].phien + 1).toString(), dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`, total: data[0].total, actual: data[0].result, prediction: result.duDoan, confidence: result.doTinCay, detail: result.chiTiet, status: '', timestamp: new Date().toISOString(), soMau: result.soMau || 0 }; brainMD5.history.unshift(rec); if (brainMD5.history.length > 2000) brainMD5.history = brainMD5.history.slice(0, 2000); brainMD5.save(); res.json(rec); } catch (e) { res.status(500).json({ error: 'Loi' }); } });
app.get('/_stats', checkAuth, (req, res) => { const total = brainHU.stats.total + brainMD5.stats.total; const dung = brainHU.stats.dung + brainMD5.stats.dung; res.json({ hu: brainHU.stats, md5: brainMD5.stats, combined: { total, dung, sai: total-dung, tyle: total>0?Math.round((dung/total)*100):0 } }); });
app.get('/_reset', checkAuth, (req, res) => { ['hu','md5'].forEach(type => { const brain = type==='hu'?brainHU:brainMD5; brain.stats = { total:0,dung:0,sai:0,tyle:0,chuoi:0,chuoi_dai:0,chuoi_thua_dai:0,chuoi_thang_hientai:0,chuoi_thua_hientai:0,homnay:{dung:0,sai:0,tong:0} }; brain.history=[]; brain.lastPhien=null; brain.save(); }); res.json({ message: 'Done' }); });
app.use((req, res) => res.status(404).end());
app.use((err, req, res, next) => { res.status(500).end(); });

app.listen(PORT, '0.0.0.0', () => { console.log(`\n✅ CRYSTAL TX - Port ${PORT} - 25 ENGINES\n`); startAuto(); });
