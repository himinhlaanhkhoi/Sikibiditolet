const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5000;

const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';
const LEARNING_FILE = 'tiendat.json';
const HISTORY_FILE = 'tiendat1.json';

let predictionHistory = {
  hu: [],
  md5: []
};

const MAX_HISTORY = 100;
const AUTO_SAVE_INTERVAL = 30000;
let lastProcessedPhien = { hu: null, md5: null };

let learningData = {
  hu: {
    predictions: [],
    patternStats: {},
    totalPredictions: 0,
    correctPredictions: 0,
    patternWeights: {},
    lastUpdate: null,
    streakAnalysis: { wins: 0, losses: 0, currentStreak: 0, bestStreak: 0, worstStreak: 0 },
    adaptiveThresholds: {},
    recentAccuracy: []
  },
  md5: {
    predictions: [],
    patternStats: {},
    totalPredictions: 0,
    correctPredictions: 0,
    patternWeights: {},
    lastUpdate: null,
    streakAnalysis: { wins: 0, losses: 0, currentStreak: 0, bestStreak: 0, worstStreak: 0 },
    adaptiveThresholds: {},
    recentAccuracy: []
  }
};

const DEFAULT_PATTERN_WEIGHTS = {
  'cau_bet': 1.0,
  'cau_dao_11': 1.0,
  'cau_22': 1.0,
  'cau_33': 1.0,
  'cau_121': 1.0,
  'cau_123': 1.0,
  'cau_321': 1.0,
  'cau_nhay_coc': 1.0,
  'cau_nhip_nghieng': 1.0,
  'cau_3van1': 1.0,
  'cau_be_cau': 1.0,
  'cau_chu_ky': 1.0,
  'distribution': 1.0,
  'dice_pattern': 1.0,
  'sum_trend': 1.0,
  'edge_cases': 1.0,
  'momentum': 1.0,
  'cau_tu_nhien': 1.0,
  'dice_trend_line': 1.0,
  'dice_trend_line_md5': 1.0,
  'break_pattern_hu': 1.0,
  'break_pattern_md5': 1.0,
  'fibonacci': 1.0,
  'resistance_support': 1.0,
  'wave': 1.0,
  'golden_ratio': 1.0,
  'day_gay': 1.0,
  'day_gay_md5': 1.0,
  'cau_44': 1.0,
  'cau_55': 1.0,
  'cau_212': 1.0,
  'cau_1221': 1.0,
  'cau_2112': 1.0,
  'cau_gap': 1.0,
  'cau_ziczac': 1.0,
  'cau_doi': 1.0,
  'cau_rong': 1.0,
  'smart_bet': 1.0,
  'break_pattern_advanced': 1.0,
  'break_streak': 1.0,
  'alternating_break': 1.0,
  'double_pair_break': 1.0,
  'triple_pattern': 1.0,
  'tong_phan_tich': 1.5,
  'xu_huong_manh': 1.3,
  'dao_chieu': 1.4
};

// ============================================================
// 🌌 TX_UNIVERSE_PREDICTOR — HỆ THỐNG LỚN NHẤT THẾ GIỚI
// ============================================================
// 8 MODULE — 100+ THUẬT TOÁN — ĐA GAME — SIÊU CHUẨN
// ============================================================

// ============================================================
// 📦 GLOBAL STORAGE
// ============================================================
let gameCache = {};
let actualHistory = {};
let pendingPredictions = {};
let globalPatternBank = new Map();
let crossGameCorrelations = new Map();

// ============================================================
// 🔧 UNIVERSAL UTILS
// ============================================================
const U = {
    ma: (d, w) => d.length < w ? d.reduce((a,b)=>a+b,0)/d.length : d.slice(-w).reduce((a,b)=>a+b,0)/w,
    std: (d, m=null) => { if(d.length===0) return 0; if(m===null) m=d.reduce((a,b)=>a+b,0)/d.length; return Math.sqrt(d.reduce((s,x)=>s+Math.pow(x-m,2),0)/d.length); },
    sigmoid: x => 1/(1+Math.exp(-x)),
    tanh: x => Math.tanh(x),
    relu: x => Math.max(0,x),
    softmax: arr => { const max=Math.max(...arr); const exp=arr.map(x=>Math.exp(x-max)); const sum=exp.reduce((a,b)=>a+b,0); return exp.map(e=>e/sum); },
    entropy: arr => { const n=arr.length; const t=arr.filter(x=>x==='T').length/n; if(t===0||t===1) return 0; return -t*Math.log2(t)-(1-t)*Math.log2(1-t); },
    correlation: (a,b) => { const n=Math.min(a.length,b.length); if(n<5) return 0; let sx=0,sy=0,sxy=0,sx2=0,sy2=0; for(let i=0;i<n;i++){ const x=a[i]==='T'?1:0; const y=b[i]==='T'?1:0; sx+=x; sy+=y; sxy+=x*y; sx2+=x*x; sy2+=y*y; } const den=Math.sqrt((n*sx2-sx*sx)*(n*sy2-sy*sy)); return den===0?0:(n*sxy-sx*sy)/den; }
};

async function fetchData(url) { try { const r=await axios.get(url,{timeout:10000}); return r.data; } catch(e){ return null; } }
async function fetchAndCache(gameId) { const c=GAME_CONFIG[gameId]; if(!c) return null; const d=await fetchData(c.api_url); if(d) gameCache[gameId]={data:d,ts:new Date().toISOString()}; return d; }
async function getCachedData(gameId) { if(gameCache[gameId]) return gameCache[gameId].data; return await fetchAndCache(gameId); }

function parseSession(item, gameType) {
    if(gameType==="legacy"){ const r=(item.resultTruyenThong||"").toUpperCase(); return { result:r.includes("TAI")?"T":r.includes("XIU")?"X":null, point:item.point||0, dices:item.dices||[0,0,0], sessionId:item.id }; }
    return { result:item.BetSide===0?"T":item.BetSide===1?"X":null, point:item.DiceSum||0, dices:[item.FirstDice||0,item.SecondDice||0,item.ThirdDice||0], sessionId:item.SessionId };
}

function buildHistory(dataList, gameType, maxLen=120) {
    if(!dataList) return { history:"", totals:[], dices:[] };
    const items=dataList.list||dataList;
    const recent=items.slice(0,maxLen).reverse();
    let history="", totals=[], dices=[];
    for(const item of recent){ const {result,point,dices:d}=parseSession(item,gameType); if(result){ history+=result; totals.push(point); dices.push(d); } }
    return { history, totals, dices };
}

// ============================================================
// 🛡️ ERROR GUARD SYSTEM
// ============================================================
class ErrorGuard {
    constructor(){ this.errors=new Map(); this.disabled=new Set(); this.recoveryLog=[]; }
    validate(p){ return p&&(p==='T'||p==='X'); }
    validateConf(c){ return typeof c==='number'&&c>=0&&c<=100&&!isNaN(c); }
    report(name,err){ if(!this.errors.has(name)) this.errors.set(name,0); this.errors.set(name,this.errors.get(name)+1); if(this.errors.get(name)>=5){ this.disabled.add(name); this.recoveryLog.push({time:new Date().toISOString(),algo:name,reason:err}); } }
    isEnabled(name){ return !this.disabled.has(name); }
    safeRun(name,fn){ if(!this.isEnabled(name)) return null; try { const r=fn(); if(r&&typeof r==='string'&&!this.validate(r)){ this.report(name,'Invalid'); return null; } return r; } catch(e){ this.report(name,e.message); return null; } }
    getStatus(){ return { disabled:[...this.disabled], totalErrors:this.errors.size, recoveryLog:this.recoveryLog.slice(-20) }; }
}
const guard = new ErrorGuard();

// ============================================================
// 🧠 SELF-LEARNING ENGINE
// ============================================================
class SelfLearningEngine {
    constructor(){ this.weights=new Map(); this.history=new Map(); this.streaks=new Map(); }
    update(name,gameId,correct){
        const key=`${gameId}_${name}`;
        if(!this.history.has(key)) this.history.set(key,[]);
        const h=this.history.get(key); h.push(correct?1:0); if(h.length>500) h.shift();
        let bestAcc=0.5;
        for(const w of[10,25,50,100,200]){ const s=h.slice(-w); if(s.length>=5){ const a=s.reduce((a,b)=>a+b,0)/s.length; bestAcc=Math.max(bestAcc,Math.max(a,1-a)); } }
        let streak=0; for(let i=h.length-1;i>=0;i--){ if(h[i]===1) streak++; else break; }
        this.streaks.set(key,streak);
        let nw=30+bestAcc*90; if(streak>=5) nw+=10; if(streak>=10) nw+=20; nw=Math.max(10,Math.min(180,nw));
        const ow=this.weights.get(key)||50; this.weights.set(key,ow*0.85+nw*0.15);
    }
    getWeight(name,gameId){ const key=`${gameId}_${name}`; let w=this.weights.get(key)||50; const s=this.streaks.get(key)||0; if(s>=5) w+=8; if(s>=10) w+=15; return Math.min(180,w); }
    getTop(gameId,n=15){ const a=[]; for(const[k,w] of this.weights){ if(k.startsWith(`${gameId}_`)) a.push({name:k.replace(`${gameId}_`,''),weight:w.toFixed(1)}); } return a.sort((a,b)=>parseFloat(b.weight)-parseFloat(a.weight)).slice(0,n); }
}
const learner = new SelfLearningEngine();

// ============================================================
// 🌌 MODULE 1: CẦU CƠ BẢN (15 thuật toán)
// ============================================================
class Module1_BasicCau {
    static bet(h){ if(h.length<2) return null; const l=h[h.length-1]; let r=1; for(let i=h.length-2;i>=0;i--){ if(h[i]===l) r++; else break; } if(r>=14) return{ p:l==='T'?'X':'T',c:97,n:'Siêu Bệt' }; if(r>=12) return{ p:l==='T'?'X':'T',c:94,n:'Bệt 12' }; if(r>=10) return{ p:l==='T'?'X':'T',c:90,n:'Bệt 10' }; if(r>=8) return{ p:l==='T'?'X':'T',c:85,n:'Bệt 8' }; if(r>=6) return{ p:l==='T'?'X':'T',c:75,n:'Bệt 6' }; if(r>=4) return{ p:l,c:65,n:'Bệt 4 Theo' }; if(r>=2) return{ p:l,c:55,n:'Bệt 2' }; return null; }
    static cau11(h){ if(h.length<4) return null; let c=0; for(let i=0;i<Math.min(h.length-1,10);i++){ if(h[h.length-1-i]!==h[h.length-2-i]) c++; else break; } if(c>=9) return{ p:h[h.length-1]==='T'?'X':'T',c:94,n:'1-1 Siêu Dài' }; if(c>=7) return{ p:h[h.length-1]==='T'?'X':'T',c:90,n:'1-1 Dài' }; if(c>=5) return{ p:h[h.length-1]==='T'?'X':'T',c:85,n:'1-1' }; if(c>=4) return{ p:h[h.length-1]==='T'?'X':'T',c:80,n:'1-1 Ngắn' }; return null; }
    static cau22(h){ if(h.length<4) return null; if(h[h.length-1]===h[h.length-2]&&h[h.length-3]===h[h.length-4]&&h[h.length-1]!==h[h.length-3]) return{ p:h[h.length-1],c:82,n:'2-2' }; return null; }
    static cau33(h){ if(h.length<6) return null; const l=h[h.length-1]; if(h[h.length-2]===l&&h[h.length-3]===l&&h[h.length-4]!==l&&h[h.length-5]!==l&&h[h.length-6]!==l) return{ p:l,c:84,n:'3-3' }; return null; }
    static cau44(h){ if(h.length<8) return null; const l=h[h.length-1]; if(h[h.length-2]===l&&h[h.length-3]===l&&h[h.length-4]===l&&h[h.length-5]!==l&&h[h.length-6]!==l&&h[h.length-7]!==l&&h[h.length-8]!==l) return{ p:l,c:86,n:'4-4' }; return null; }
    static cau55(h){ if(h.length<10) return null; const l=h[h.length-1]; if(h[h.length-2]===l&&h[h.length-3]===l&&h[h.length-4]===l&&h[h.length-5]===l&&h[h.length-6]!==l&&h[h.length-7]!==l&&h[h.length-8]!==l&&h[h.length-9]!==l&&h[h.length-10]!==l) return{ p:l,c:88,n:'5-5' }; return null; }
    static gay32(h){ if(h.length<5) return null; const l5=h.slice(-5).join(''); if(l5==='TTTXX'||l5==='XXXTT') return{ p:h[h.length-1],c:78,n:'Gãy 3-2' }; return null; }
    static gay23(h){ if(h.length<5) return null; const l5=h.slice(-5).join(''); if(l5==='TTXXX'||l5==='XXTTT') return{ p:h[h.length-1],c:78,n:'Gãy 2-3' }; return null; }
    static abba(h){ if(h.length<4) return null; const l4=h.slice(-4).join(''); if(l4==='TXXT') return{ p:'X',c:76,n:'ABBA' }; if(l4==='XTTX') return{ p:'T',c:76,n:'ABBA' }; return null; }
    static triangle(h){ if(h.length<5) return null; const l5=h.slice(-5).join(''); if(l5==='TXTXT') return{ p:'X',c:80,n:'Tam Giác T' }; if(l5==='XTXTX') return{ p:'T',c:80,n:'Tam Giác X' }; return null; }
    static zigzag(h){ if(h.length<4) return null; let c=0; for(let i=1;i<Math.min(h.length,10);i++){ if(h[h.length-i]!==h[h.length-i-1]) c++; else break; } if(c>=8) return{ p:h[h.length-1]==='T'?'X':'T',c:92,n:'Zigzag 9' }; if(c>=6) return{ p:h[h.length-1]==='T'?'X':'T',c:86,n:'Zigzag 7' }; if(c>=4) return{ p:h[h.length-1]==='T'?'X':'T',c:80,n:'Zigzag 5' }; return null; }
    static dragon(h){ let r=0; for(let i=h.length-1;i>=0;i--){ if(h[i]==='T') r++; else break; } if(r>=8) return{ p:'X',c:88,n:`Rồng ${r}` }; if(r>=6) return{ p:'X',c:80,n:`Rồng ${r}` }; if(r>=4) return{ p:'T',c:68,n:`Rồng ${r} Theo` }; return null; }
    static tiger(h){ let r=0; for(let i=h.length-1;i>=0;i--){ if(h[i]==='X') r++; else break; } if(r>=8) return{ p:'T',c:88,n:`Hổ ${r}` }; if(r>=6) return{ p:'T',c:80,n:`Hổ ${r}` }; if(r>=4) return{ p:'X',c:68,n:`Hổ ${r} Theo` }; return null; }
    static cycle(h){ for(let c=2;c<=8;c++){ if(h.length<c*3) continue; const p1=h.slice(-c).join(''),p2=h.slice(-c*2,-c).join(''),p3=h.slice(-c*3,-c*2).join(''); if(p1===p2&&p2===p3) return{ p:p1[0]==='T'?'X':'T',c:84,n:`Chu Kỳ ${c}` }; } return null; }
    static mirror(h){ if(h.length<6) return null; const l6=h.slice(-6); const rev=[...l6].reverse(); if(l6.join('')===rev.join('')) return{ p:l6[0]==='T'?'X':'T',c:80,n:'Gương' }; return null; }

    static runAll(h,gid){ const r=[]; const algos=[ {f:()=>Module1_BasicCau.bet(h),n:'Bet'},{f:()=>Module1_BasicCau.cau11(h),n:'Cau11'},{f:()=>Module1_BasicCau.cau22(h),n:'Cau22'},{f:()=>Module1_BasicCau.cau33(h),n:'Cau33'},{f:()=>Module1_BasicCau.cau44(h),n:'Cau44'},{f:()=>Module1_BasicCau.cau55(h),n:'Cau55'},{f:()=>Module1_BasicCau.gay32(h),n:'Gay32'},{f:()=>Module1_BasicCau.gay23(h),n:'Gay23'},{f:()=>Module1_BasicCau.abba(h),n:'ABBA'},{f:()=>Module1_BasicCau.triangle(h),n:'Triangle'},{f:()=>Module1_BasicCau.zigzag(h),n:'Zigzag'},{f:()=>Module1_BasicCau.dragon(h),n:'Dragon'},{f:()=>Module1_BasicCau.tiger(h),n:'Tiger'},{f:()=>Module1_BasicCau.cycle(h),n:'Cycle'},{f:()=>Module1_BasicCau.mirror(h),n:'Mirror'} ];
        for(const a of algos){ const res=guard.safeRun(a.n,a.f); if(res){ const w=learner.getWeight(a.n,gid); r.push({prediction:res.p,confidence:res.c||60,weight:w,name:a.n,type:res.n}); } } return r;
    }
}

// ============================================================
// 🌌 MODULE 2: CẦU NÂNG CAO (15 thuật toán)
// ============================================================
class Module2_AdvancedCau {
    static phoenix(h){ if(h.length<10) return null; const f5=h.slice(-10,-5); const l5=h.slice(-5); const rev=f5.map(c=>c==='T'?'X':'T'); if(l5.join('')===rev.join('')) return{ p:f5[0],c:88,n:'Phượng Hoàng' }; return null; }
    static staircase(h){ if(h.length<9) return null; const segs=[]; for(let i=0;i<3;i++) segs.push(h.slice(-3*(i+1),-3*i||undefined).join('')); if(new Set(segs).size===1&&segs[0].length===3) return{ p:segs[0][0]==='T'?'X':'T',c:80,n:'Bậc Thang' }; return null; }
    static tornado(h){ if(h.length<8) return null; let s=0; for(let i=1;i<8;i++){ if(h[h.length-i]!==h[h.length-i-1]) s++; } if(s>=6) return{ p:h[h.length-1]==='T'?'X':'T',c:84,n:'Lốc Xoáy' }; return null; }
    static butterfly(h){ if(h.length<5) return null; const l5=h.slice(-5).join(''); if(l5==='TXXTT'||l5==='XTTXX') return{ p:l5[l5.length-1]==='T'?'X':'T',c:78,n:'Bướm' }; return null; }
    static diamond(h){ if(h.length<7) return null; const l7=h.slice(-7).join(''); if(l7==='TXXTXXT'||l7==='XTTXTTX') return{ p:l7[l7.length-1]==='T'?'X':'T',c:82,n:'Kim Cương' }; return null; }
    static cross(h){ if(h.length<5) return null; const l5=h.slice(-5).join(''); if(l5==='TXTXT'||l5==='XTXTX') return{ p:l5[l5.length-1]==='T'?'X':'T',c:84,n:'Thánh Giá' }; return null; }
    static supernova(h){ if(h.length<8) return null; const l8=h.slice(-8).join(''); const t=l8.split('T').length-1; if(t>=7) return{ p:'X',c:90,n:'Siêu Tân Tinh T' }; if(t<=1) return{ p:'T',c:90,n:'Siêu Tân Tinh X' }; return null; }
    static comet(h){ if(h.length<7) return null; const l=h[h.length-1]; let t=0; for(let i=h.length-1;i>=0;i--){ if(h[i]===l) t++; else break; } if(t>=4) return{ p:l==='T'?'X':'T',c:78,n:'Sao Chổi' }; return null; }
    static eclipse(h){ if(h.length<9) return null; const l9=h.slice(-9).join(''); if(l9==='TTTXTTTXT'||l9==='XXXTXXXTX') return{ p:l9[l9.length-1]==='T'?'X':'T',c:80,n:'Nhật Thực' }; return null; }
    static pulse(h){ if(h.length<6) return null; const l6=h.slice(-6).join(''); if(l6==='TTXTTX'||l6==='XXTXXT') return{ p:l6[l6.length-1]==='T'?'X':'T',c:79,n:'Nhịp Đập' }; return null; }
    static magnet(h){ if(h.length<6) return null; const l6=h.slice(-6).join(''); if(l6==='TXTTXT'||l6==='XTXXTX') return{ p:l6[l6.length-1]==='T'?'X':'T',c:76,n:'Nam Châm' }; return null; }
    static spring(h){ if(h.length<5) return null; let c=0; const l=h[h.length-1]; for(let i=h.length-2;i>=0;i--){ if(h[i]!==l) c++; else break; } if(c>=5) return{ p:l,c:80,n:'Lò Xo' }; return null; }
    static anchor(h){ if(h.length<8) return null; const l8=h.slice(-8).join(''); if(l8==='TTXXTTXX'||l8==='XXTTXXTT') return{ p:l8[l8.length-1]==='T'?'X':'T',c:79,n:'Mỏ Neo' }; return null; }
    static fractal(h){ if(h.length<16) return null; const half=Math.floor(h.length/2); const f=h.slice(0,half).join(''); const s=h.slice(half,half*2).join(''); if(f===s) return{ p:h[half],c:84,n:'Phân Dạng' }; return null; }
    static wave(h){ if(h.length<8) return null; const n=h.slice(-8).map(c=>c==='T'?1:0); let p=0,t=0; for(let i=1;i<n.length-1;i++){ if(n[i]>n[i-1]&&n[i]>n[i+1]) p++; if(n[i]<n[i-1]&&n[i]<n[i+1]) t++; } if(p>=2&&t>=2) return{ p:n[n.length-1]===1?'X':'T',c:77,n:'Sóng' }; return null; }

    static runAll(h,gid){ const r=[]; const algos=[ {f:()=>Module2_AdvancedCau.phoenix(h),n:'Phoenix'},{f:()=>Module2_AdvancedCau.staircase(h),n:'Staircase'},{f:()=>Module2_AdvancedCau.tornado(h),n:'Tornado'},{f:()=>Module2_AdvancedCau.butterfly(h),n:'Butterfly'},{f:()=>Module2_AdvancedCau.diamond(h),n:'Diamond'},{f:()=>Module2_AdvancedCau.cross(h),n:'Cross'},{f:()=>Module2_AdvancedCau.supernova(h),n:'Supernova'},{f:()=>Module2_AdvancedCau.comet(h),n:'Comet'},{f:()=>Module2_AdvancedCau.eclipse(h),n:'Eclipse'},{f:()=>Module2_AdvancedCau.pulse(h),n:'Pulse'},{f:()=>Module2_AdvancedCau.magnet(h),n:'Magnet'},{f:()=>Module2_AdvancedCau.spring(h),n:'Spring'},{f:()=>Module2_AdvancedCau.anchor(h),n:'Anchor'},{f:()=>Module2_AdvancedCau.fractal(h),n:'Fractal'},{f:()=>Module2_AdvancedCau.wave(h),n:'Wave'} ];
        for(const a of algos){ const res=guard.safeRun(a.n,a.f); if(res){ const w=learner.getWeight(a.n,gid); r.push({prediction:res.p,confidence:res.c||60,weight:w,name:a.n,type:res.n}); } } return r;
    }
}

// ============================================================
// 🌌 MODULE 3: THỐNG KÊ CỔ ĐIỂN (12 thuật toán)
// ============================================================
class Module3_ClassicalStats {
    static markov2(h){ if(h.length<3) return null; const l2=h.slice(-2).join(''); const t=new Map(); for(let i=0;i<h.length-2;i++){ const k=h.slice(i,i+2).join(''); const n=h[i+2]; if(!t.has(k)) t.set(k,{T:0,X:0}); t.get(k)[n]++; } const s=t.get(l2); if(s&&s.T+s.X>=3) return s.T>s.X?'T':'X'; return null; }
    static markov3(h){ if(h.length<4) return null; const l3=h.slice(-3).join(''); const t=new Map(); for(let i=0;i<h.length-3;i++){ const k=h.slice(i,i+3).join(''); const n=h[i+3]; if(!t.has(k)) t.set(k,{T:0,X:0}); t.get(k)[n]++; } const s=t.get(l3); if(s&&s.T+s.X>=3) return s.T>s.X?'T':'X'; return null; }
    static markov4(h){ if(h.length<5) return null; const l4=h.slice(-4).join(''); const t=new Map(); for(let i=0;i<h.length-4;i++){ const k=h.slice(i,i+4).join(''); const n=h[i+4]; if(!t.has(k)) t.set(k,{T:0,X:0}); t.get(k)[n]++; } const s=t.get(l4); if(s&&s.T+s.X>=3) return s.T>s.X?'T':'X'; return null; }
    static weightedFreq(h){ if(h.length<10) return null; const r=h.slice(-25); let wt=0,wx=0; for(let i=0;i<r.length;i++){ const w=i+1; if(r[r.length-1-i]==='T') wt+=w; else wx+=w; } return wt>wx?'T':'X'; }
    static simpleMajority(h){ if(h.length<15) return null; const t=h.slice(-15).filter(c=>c==='T').length; return t>7?'T':'X'; }
    static movingAvgCross(h){ if(h.length<20) return null; const s=h.slice(-5).filter(c=>c==='T').length/5; const l=h.slice(-15).filter(c=>c==='T').length/15; if(s>l+0.2) return 'T'; if(l>s+0.2) return 'X'; return null; }
    static entropyPred(h){ if(h.length<12) return null; const r=h.slice(-12); const e=U.entropy(r); if(e>0.95) return r[r.length-1]==='T'?'X':'T'; return r[r.length-1]; }
    static fibonacci(h){ if(h.length<9) return null; const fibs=[1,1,2,3,5,8]; let t=0; for(const f of fibs){ if(h.length>f&&h[h.length-f]==='T') t++; } if(t>=4) return 'X'; if(t<=2) return 'T'; return null; }
    static cumulativeImbalance(h){ if(h.length<30) return null; const r=h.slice(-30); const im=r.filter(c=>c==='T').length-15; if(im>8) return 'X'; if(im<-8) return 'T'; return null; }
    static regressionBreak(h){ if(h.length<10) return null; const n=h.slice(-10).map(c=>c==='T'?1:0); const ma5=U.ma(n,5); const ma10=U.ma(n,10); if(Math.abs(ma5-ma10)>0.3) return n[n.length-1]===0?'T':'X'; return null; }
    static gapAnalysis(h){ if(h.length<6) return null; let g=0; for(let i=1;i<Math.min(h.length,10);i++){ if(h[h.length-i]!==h[h.length-i-1]) g++; } if(g>=7) return h[h.length-1]==='T'?'X':'T'; return null; }
    static patternExhaustion(h){ if(h.length<8) return null; const l8=h.slice(-8).join(''); if(['TXTXTXTX','XTXTXTXT','TTXXTTXX','XXTTXXTT'].includes(l8)) return h[h.length-1]==='T'?'X':'T'; return null; }

    static runAll(h,gid){ const r=[]; const algos=[ {f:()=>Module3_ClassicalStats.markov2(h),n:'Markov2'},{f:()=>Module3_ClassicalStats.markov3(h),n:'Markov3'},{f:()=>Module3_ClassicalStats.markov4(h),n:'Markov4'},{f:()=>Module3_ClassicalStats.weightedFreq(h),n:'WeightFreq'},{f:()=>Module3_ClassicalStats.simpleMajority(h),n:'Majority'},{f:()=>Module3_ClassicalStats.movingAvgCross(h),n:'MACross'},{f:()=>Module3_ClassicalStats.entropyPred(h),n:'Entropy'},{f:()=>Module3_ClassicalStats.fibonacci(h),n:'Fibonacci'},{f:()=>Module3_ClassicalStats.cumulativeImbalance(h),n:'CumImb'},{f:()=>Module3_ClassicalStats.regressionBreak(h),n:'RegBreak'},{f:()=>Module3_ClassicalStats.gapAnalysis(h),n:'Gap'},{f:()=>Module3_ClassicalStats.patternExhaustion(h),n:'PatExhaust'} ];
        for(const a of algos){ const res=guard.safeRun(a.n,a.f); if(res){ const p=typeof res==='string'?res:res.p; const w=learner.getWeight(a.n,gid); r.push({prediction:p,confidence:typeof res==='string'?60:(res.c||60),weight:w,name:a.n,type:typeof res==='string'?'stat':'pattern'}); } } return r;
    }
}

// ============================================================
// 🌌 MODULE 4: TECHNICAL INDICATORS (12 thuật toán)
// ============================================================
class Module4_TechnicalIndicators {
    static rsi(h,p=7){ if(h.length<p) return null; const n=h.slice(-p).map(c=>c==='T'?1:0); let g=0,l=0; for(let i=1;i<n.length;i++){ const d=n[i]-n[i-1]; if(d>0) g+=d; else l+=Math.abs(d); } if(l===0) return 'X'; const rsi=100-(100/(1+g/l)); if(rsi>80) return 'X'; if(rsi<20) return 'T'; if(rsi>65) return 'X'; if(rsi<35) return 'T'; return null; }
    static bollinger(h,p=12){ if(h.length<p) return null; const n=h.slice(-p).map(c=>c==='T'?1:0); const m=n.reduce((a,b)=>a+b,0)/p; const s=U.std(n,m); const lst=n[n.length-1]; if(lst>m+2*s) return 'X'; if(lst<m-2*s) return 'T'; if(lst>m+1.5*s) return 'X'; if(lst<m-1.5*s) return 'T'; return null; }
    static macd(h,s=6,l=13,sig=4){ if(h.length<l+sig) return null; const n=h.map(c=>c==='T'?1:0); const es=U.ma(n.slice(-s),s); const el=U.ma(n.slice(-l),l); const macd=es-el; const mh=[]; for(let i=n.length-sig;i<n.length;i++){ const sl=n.slice(0,i+1); mh.push(U.ma(sl.slice(-s),Math.min(s,sl.length))-U.ma(sl.slice(-l),Math.min(l,sl.length))); } const sl=U.ma(mh,Math.min(sig,mh.length)); if(macd>sl+0.05) return 'T'; if(macd<sl-0.05) return 'X'; return null; }
    static stochastic(h,p=7){ if(h.length<p) return null; const n=h.slice(-p).map(c=>c==='T'?1:0); const hi=Math.max(...n); const lo=Math.min(...n); if(hi===lo) return null; const k=(n[n.length-1]-lo)/(hi-lo)*100; if(k>80) return 'X'; if(k<20) return 'T'; return null; }
    static williamsR(h,p=7){ if(h.length<p) return null; const n=h.slice(-p).map(c=>c==='T'?1:0); const hi=Math.max(...n); const lo=Math.min(...n); if(hi===lo) return null; const wr=(hi-n[n.length-1])/(hi-lo)*(-100); if(wr<-80) return 'T'; if(wr>-20) return 'X'; return null; }
    static cci(h,p=10){ if(h.length<p) return null; const n=h.slice(-p).map(c=>c==='T'?1:0); const m=n.reduce((a,b)=>a+b,0)/p; const mad=n.reduce((s,x)=>s+Math.abs(x-m),0)/p; if(mad===0) return null; const cci=(n[n.length-1]-m)/(0.015*mad); if(cci>100) return 'X'; if(cci<-100) return 'T'; return null; }
    static adx(h,p=10){ if(h.length<p+1) return null; const n=h.map(c=>c==='T'?1:0); const pd=[],md=[]; for(let i=1;i<n.length;i++){ const d=n[i]-n[i-1]; if(d>0){ pd.push(d); md.push(0); } else if(d<0){ pd.push(0); md.push(Math.abs(d)); } else{ pd.push(0); md.push(0); } } if(pd.length<p) return null; const tr=[]; for(let i=1;i<n.length;i++) tr.push(Math.abs(n[i]-n[i-1])); const atr=U.ma(tr.slice(-p),p); if(atr===0) return null; const pdi=U.ma(pd.slice(-p),p)/atr*100; const mdi=U.ma(md.slice(-p),p)/atr*100; const dx=Math.abs(pdi-mdi)/(pdi+mdi)*100; if(dx>40) return pdi>mdi?'T':'X'; return null; }
    static atr(h,p=10){ if(h.length<p+1) return null; const n=h.map(c=>c==='T'?1:0); const tr=[]; for(let i=1;i<n.length;i++) tr.push(Math.abs(n[i]-n[i-1])); if(tr.length<p) return null; const atr=U.ma(tr.slice(-p),p); const lst=tr[tr.length-1]; if(lst>atr*2) return h[h.length-1]==='T'?'X':'T'; return null; }
    static momentum(h,p=5){ if(h.length<p+1) return null; const n=h.slice(-p-1).map(c=>c==='T'?1:0); const mom=n[n.length-1]-n[0]; if(mom>0.6) return 'X'; if(mom<-0.6) return 'T'; return null; }
    static obv(h){ if(h.length<10) return null; let obv=0; for(let i=1;i<Math.min(h.length,15);i++){ if(h[h.length-i]==='T') obv++; else obv--; } if(obv>5) return 'X'; if(obv<-5) return 'T'; return null; }
    static keltner(h,p=10){ if(h.length<p) return null; const n=h.slice(-p).map(c=>c==='T'?1:0); const m=n.reduce((a,b)=>a+b,0)/p; const atr=U.ma(n.map((x,i)=>i>0?Math.abs(x-n[i-1]):0).slice(1),p-1); const u=m+2*atr; const l=m-2*atr; if(n[n.length-1]>u) return 'X'; if(n[n.length-1]<l) return 'T'; return null; }
    static donchian(h,p=10){ if(h.length<p) return null; const n=h.slice(-p).map(c=>c==='T'?1:0); const hi=Math.max(...n); const lo=Math.min(...n); if(n[n.length-1]>=hi) return 'X'; if(n[n.length-1]<=lo) return 'T'; return null; }

    static runAll(h,gid){ const r=[]; const algos=[ {f:()=>Module4_TechnicalIndicators.rsi(h),n:'RSI'},{f:()=>Module4_TechnicalIndicators.bollinger(h),n:'Bollinger'},{f:()=>Module4_TechnicalIndicators.macd(h),n:'MACD'},{f:()=>Module4_TechnicalIndicators.stochastic(h),n:'Stoch'},{f:()=>Module4_TechnicalIndicators.williamsR(h),n:'WillR'},{f:()=>Module4_TechnicalIndicators.cci(h),n:'CCI'},{f:()=>Module4_TechnicalIndicators.adx(h),n:'ADX'},{f:()=>Module4_TechnicalIndicators.atr(h),n:'ATR'},{f:()=>Module4_TechnicalIndicators.momentum(h),n:'Momentum'},{f:()=>Module4_TechnicalIndicators.obv(h),n:'OBV'},{f:()=>Module4_TechnicalIndicators.keltner(h),n:'Keltner'},{f:()=>Module4_TechnicalIndicators.donchian(h),n:'Donchian'} ];
        for(const a of algos){ const res=guard.safeRun(a.n,a.f); if(res){ const p=typeof res==='string'?res:res.p; const w=learner.getWeight(a.n,gid); r.push({prediction:p,confidence:typeof res==='string'?60:(res.c||60),weight:w,name:a.n,type:'tech'}); } } return r;
    }
}

// ============================================================
// 🌌 MODULE 5: MACHINE LEARNING (15 thuật toán)
// ============================================================
class Module5_MachineLearning {
    static linearReg(h,w=12){ if(h.length<w) return null; const y=h.slice(-w).map(c=>c==='T'?1:0); const x=Array.from({length:w},(_,i)=>i); const n=w,sx=x.reduce((a,b)=>a+b,0),sy=y.reduce((a,b)=>a+b,0),sxy=x.reduce((s,xi,i)=>s+xi*y[i],0),sx2=x.reduce((s,xi)=>s+xi*xi,0); const d=n*sx2-sx*sx; if(d===0) return null; const sl=(n*sxy-sx*sy)/d; const ic=(sy-sl*sx)/n; return(sl*w+ic)>0.5?'T':'X'; }
    static knn(h,k=5,lb=10){ if(h.length<lb+k) return null; const q=h.slice(-lb); const ds=[]; for(let i=0;i<h.length-lb-1;i++){ let d=0; for(let j=0;j<lb;j++){ if(h[i+j]!==q[j]) d++; } ds.push({d,next:h[i+lb]}); } ds.sort((a,b)=>a.d-b.d); const nb=ds.slice(0,k); return nb.filter(n=>n.next==='T').length>k/2?'T':'X'; }
    static naiveBayes(h,w=15){ if(h.length<w) return null; const pT=h.filter(c=>c==='T').length/h.length; const l5=h.slice(-5); let ct=0,cx=0,tt=0,tx=0; for(let i=0;i<h.length-5;i++){ if(h.slice(i,i+5).join('')===l5.join('')){ if(h[i+5]==='T'){ ct++; tt++; } else{ cx++; tx++; } } } ct/=Math.max(1,tt); cx/=Math.max(1,tx); return pT*ct>(1-pT)*cx?'T':'X'; }
    static decisionTree(h){ if(h.length<8) return null; const l=h[h.length-1],l2=h[h.length-2],l3=h[h.length-3]; const t5=h.slice(-5).filter(c=>c==='T').length; if(l==='T'&&l2==='T'&&l3==='T') return 'X'; if(l==='X'&&l2==='X'&&l3==='X') return 'T'; if(t5>=4) return 'X'; if(t5<=1) return 'T'; return l; }
    static randomForest(h){ if(h.length<12) return null; const v=[]; const ws=[5,8,10,12]; for(const w of ws){ if(h.length>=w){ const t=h.slice(-w).filter(c=>c==='T').length/w; if(t>0.6) v.push('X'); else if(t<0.4) v.push('T'); else v.push(h[h.length-1]); } } if(v.length===0) return null; return v.filter(x=>x==='T').length>v.length/2?'T':'X'; }
    static adaboost(h){ if(h.length<8) return null; const wl=[(h)=>h.slice(-2).filter(c=>c==='T').length>=1?'T':'X',(h)=>h.slice(-4).filter(c=>c==='X').length>=3?'X':'T',(h)=>h[h.length-5]==='T'?'T':'X']; const ws=[0.5,0.3,0.2]; let tw=0,xw=0; for(let i=0;i<wl.length;i++){ const p=wl[i](h); if(p==='T') tw+=ws[i]; else xw+=ws[i]; } return tw>xw?'T':'X'; }
    static gradientBoost(h){ if(h.length<10) return null; const n=h.slice(-10).map(c=>c==='T'?1:0); let p=0; p+=(n.slice(-3).filter(v=>v===1).length>=2?0.3:-0.3); p+=(n.slice(-5).reduce((a,b)=>a+b,0)/5>0.5?0.2:-0.2); p+=(n[n.length-1]===1?0.1:-0.1); return p>0?'T':'X'; }
    static xgboost(h){ if(h.length<12) return null; const n=h.slice(-12).map(c=>c==='T'?1:0); let s=0; s+=(n.slice(-2).filter(v=>v===1).length>=1?0.4:-0.4); s+=(n.slice(-4).reduce((a,b)=>a+b,0)/4>0.5?0.3:-0.3); s+=(n.slice(-8).reduce((a,b)=>a+b,0)/8>0.5?0.2:-0.2); s+=(n[n.length-1]!==n[n.length-2]?0.1:-0.1); return s>0?'T':'X'; }
    static neuralNet(h){ if(h.length<10) return null; const n=h.slice(-10).map(c=>c==='T'?1:0); const h1=U.ma(n.slice(-3),3); const h2=U.ma(n.slice(-5),5); const h3=U.ma(n.slice(-8),8); return(0.4*h1+0.35*h2+0.25*h3)>0.5?'T':'X'; }
    static deepLearn(h){ if(h.length<15) return null; const ls=[3,5,7,9,11,13]; let tp=0,c=0; for(const l of ls){ if(h.length>=l){ tp+=h.slice(-l).filter(c=>c==='T').length/l; c++; } } return(tp/c)>0.5?'T':'X'; }
    static lstm(h){ if(h.length<10) return null; const s=h.slice(-10); const l3=s.slice(-3); if(l3[0]===l3[1]&&l3[1]===l3[2]) return l3[0]==='T'?'X':'T'; let cs=0; for(let i=1;i<Math.min(6,s.length);i++){ if(s[s.length-i]===s[s.length-i-1]) cs++; else break; } if(cs>=3) return s[s.length-1]; return s[s.length-1]==='T'?'X':'T'; }
    static transformer(h){ if(h.length<12) return null; const r=h.slice(-6); const o=h.slice(-12,-6); let a=0; for(let i=0;i<6;i++){ if(r[i]===o[i]) a++; } a/=6; if(a>0.7) return r[r.length-1]; if(a<0.3) return r[r.length-1]==='T'?'X':'T'; return null; }
    static svm(h){ if(h.length<12) return null; const n=h.slice(-12).map(c=>c==='T'?1:-1); const f=[U.ma(n.slice(-3),3),U.ma(n.slice(-6),6),U.ma(n.slice(-9),9)]; const ws=[0.5,0.3,0.2]; return f.reduce((s,fi,i)=>s+fi*ws[i],0)>0?'T':'X'; }
    static kalman(h){ if(h.length<15) return null; const n=h.slice(-15).map(c=>c==='T'?1:0); let e=0.5,ec=0.1; for(const z of n){ ec+=0.01; const kg=ec/(ec+0.1); e=e+kg*(z-e); ec=(1-kg)*ec; } return e>0.5?'T':'X'; }
    static genetic(h){ if(h.length<15) return null; const st=[{w:0.3,f:(h)=>h.slice(-3).filter(c=>c==='T').length>=2?'T':'X'},{w:0.25,f:(h)=>h.slice(-5).filter(c=>c==='X').length>=3?'X':'T'},{w:0.2,f:(h)=>h[h.length-1]===h[h.length-2]?h[h.length-1]:(h[h.length-1]==='T'?'X':'T')},{w:0.15,f:(h)=>h.slice(-7).filter(c=>c==='T').length>=4?'T':'X'},{w:0.1,f:(h)=>h[0]}]; let ts=0,xs=0; for(const s of st){ const p=s.f(h); if(p==='T') ts+=s.w; else xs+=s.w; } return ts>xs?'T':'X'; }

    static runAll(h,gid){ const r=[]; const algos=[ {f:()=>Module5_MachineLearning.linearReg(h),n:'LinearReg'},{f:()=>Module5_MachineLearning.knn(h),n:'KNN'},{f:()=>Module5_MachineLearning.naiveBayes(h),n:'NaiveBayes'},{f:()=>Module5_MachineLearning.decisionTree(h),n:'DecTree'},{f:()=>Module5_MachineLearning.randomForest(h),n:'RandForest'},{f:()=>Module5_MachineLearning.adaboost(h),n:'AdaBoost'},{f:()=>Module5_MachineLearning.gradientBoost(h),n:'GradBoost'},{f:()=>Module5_MachineLearning.xgboost(h),n:'XGBoost'},{f:()=>Module5_MachineLearning.neuralNet(h),n:'Neural'},{f:()=>Module5_MachineLearning.deepLearn(h),n:'DeepLearn'},{f:()=>Module5_MachineLearning.lstm(h),n:'LSTM'},{f:()=>Module5_MachineLearning.transformer(h),n:'Transformer'},{f:()=>Module5_MachineLearning.svm(h),n:'SVM'},{f:()=>Module5_MachineLearning.kalman(h),n:'Kalman'},{f:()=>Module5_MachineLearning.genetic(h),n:'Genetic'} ];
        for(const a of algos){ const res=guard.safeRun(a.n,a.f); if(res){ const p=typeof res==='string'?res:res.p; const w=learner.getWeight(a.n,gid); r.push({prediction:p,confidence:typeof res==='string'?60:(res.c||60),weight:w,name:a.n,type:'ml'}); } } return r;
    }
}

// ============================================================
// 🌌 MODULE 6: ADVANCED AI (12 thuật toán)
// ============================================================
class Module6_AdvancedAI {
    static monteCarlo(h){ if(h.length<20) return null; const tr=h.slice(-20).filter(c=>c==='T').length/20; let tw=0; for(let i=0;i<200;i++){ if(Math.random()<tr) tw++; } return tw>100?'T':'X'; }
    static chaosTheory(h){ if(h.length<10) return null; let c=0; for(let i=1;i<10;i++){ if(h[h.length-i]!==h[h.length-i-1]) c++; } if(c>=7) return h[h.length-1]==='T'?'X':'T'; if(c<=2) return h[h.length-1]; return null; }
    static fractalAnalysis(h){ if(h.length<20) return null; const sc=[4,5,10]; let fs=0,c=0; for(const s of sc){ if(h.length>=s*2){ const f=h.slice(-s*2,-s); const se=h.slice(-s); let m=0; for(let i=0;i<s;i++){ if(f[i]===se[i]) m++; } fs+=m/s; c++; } } fs/=c; return fs>0.6?h[h.length-1]:(h[h.length-1]==='T'?'X':'T'); }
    static quantum(h){ if(h.length<8) return null; const s=h.slice(-8).map(c=>c==='T'?1:-1); let sp=0; for(let i=0;i<s.length;i++) sp+=s[i]*Math.cos(i*Math.PI/4); return U.sigmoid(sp)>0.5?'T':'X'; }
    static fuzzy(h){ if(h.length<10) return null; const t5=h.slice(-5).filter(c=>c==='T').length/5; const t10=h.slice(-10).filter(c=>c==='T').length/10; const l=h[h.length-1]==='T'?1:0; let mt=0,mx=0; if(t5>0.7) mx+=0.4; else if(t5<0.3) mt+=0.4; if(t10>0.7) mx+=0.3; else if(t10<0.3) mt+=0.3; if(l===1&&t5>0.6) mx+=0.3; else if(l===0&&t5<0.4) mt+=0.3; return mt>mx?'T':'X'; }
    static bayesianNet(h){ if(h.length<8) return null; const l3=h.slice(-3).join(''); const pT=h.filter(c=>c==='T').length/h.length; let mt=0,mx=0; for(let i=0;i<h.length-3;i++){ if(h.slice(i,i+3).join('')===l3){ if(h[i+3]==='T') mt++; else mx++; } } const t=mt+mx; if(t<2) return null; return(mt/t)*pT>(mx/t)*(1-pT)?'T':'X'; }
    static hiddenMarkov(h){ if(h.length<10) return null; const s=[]; for(let i=1;i<h.length;i++) s.push(h[i]===h[i-1]?'S':'C'); const l3=s.slice(-3).join(''); let sc=0,cc=0; for(let i=0;i<s.length-3;i++){ if(s.slice(i,i+3).join('')===l3){ if(s[i+3]==='S') sc++; else cc++; } } if(sc+cc>=2){ if(sc>cc) return h[h.length-1]; else return h[h.length-1]==='T'?'X':'T'; } return null; }
    static arima(h){ if(h.length<12) return null; const n=h.slice(-12).map(c=>c==='T'?1:0); const d=[]; for(let i=1;i<n.length;i++) d.push(n[i]-n[i-1]); const ma=U.ma(d,3); const pv=n[n.length-1]+ma*0.7+d[d.length-1]*0.3; return pv>0.5?'T':'X'; }
    static garch(h){ if(h.length<15) return null; const n=h.slice(-15).map(c=>c==='T'?1:0); const ret=[]; for(let i=1;i<n.length;i++) ret.push(n[i]-n[i-1]); const vr=ret.reduce((s,r)=>s+r*r,0)/ret.length; const pv=n[n.length-1]+ret[ret.length-1]*0.5; return pv>0.5?'T':'X'; }
    static metaLearn(h,gid){ if(h.length<10) return null; const voters=[ ()=>Module5_MachineLearning.neuralNet(h), ()=>Module4_TechnicalIndicators.rsi(h), ()=>Module3_ClassicalStats.markov3(h), ()=>Module5_MachineLearning.knn(h), ()=>Module4_TechnicalIndicators.bollinger(h) ]; const v=[]; for(const vo of voters){ const p=vo(); if(p) v.push(p); } if(v.length===0) return null; const t=v.filter(x=>x==='T').length; return t>v.length-t?'T':'X'; }
    static ensembleVote(h){ const voters=[ ()=>Module3_ClassicalStats.markov3(h), ()=>Module4_TechnicalIndicators.rsi(h), ()=>Module4_TechnicalIndicators.bollinger(h), ()=>Module5_MachineLearning.knn(h), ()=>Module5_MachineLearning.decisionTree(h), ()=>Module5_MachineLearning.neuralNet(h), ()=>Module3_ClassicalStats.weightedFreq(h) ]; const v=[]; for(const vo of voters){ const p=vo(); if(p) v.push(p); } if(v.length===0) return null; return v.filter(x=>x==='T').length>v.length/2?'T':'X'; }
    static reinforcementLearn(h,gid){ if(!actualHistory[gid]||actualHistory[gid].length<10) return null; const rr=actualHistory[gid].slice(-30); if(rr.length<10) return null; const pwr=new Map(); for(let i=0;i<rr.length-1;i++){ const pat=rr[i]; const nxt=rr[i+1]; if(!pwr.has(pat)) pwr.set(pat,{w:0,t:0}); const s=pwr.get(pat); s.t++; if(nxt==='T') s.w++; } const cp=h.slice(-5).join(''); if(!pwr.has(cp)||pwr.get(cp).t<3) return null; return pwr.get(cp).w/pwr.get(cp).t>0.5?'T':'X'; }

    static runAll(h,gid){ const r=[]; const algos=[ {f:()=>Module6_AdvancedAI.monteCarlo(h),n:'MonteCarlo'},{f:()=>Module6_AdvancedAI.chaosTheory(h),n:'Chaos'},{f:()=>Module6_AdvancedAI.fractalAnalysis(h),n:'Fractal'},{f:()=>Module6_AdvancedAI.quantum(h),n:'Quantum'},{f:()=>Module6_AdvancedAI.fuzzy(h),n:'Fuzzy'},{f:()=>Module6_AdvancedAI.bayesianNet(h),n:'BayesNet'},{f:()=>Module6_AdvancedAI.hiddenMarkov(h),n:'HidMarkov'},{f:()=>Module6_AdvancedAI.arima(h),n:'ARIMA'},{f:()=>Module6_AdvancedAI.garch(h),n:'GARCH'},{f:()=>Module6_AdvancedAI.metaLearn(h,gid),n:'MetaLearn'},{f:()=>Module6_AdvancedAI.ensembleVote(h),n:'EnsembleVote'},{f:()=>Module6_AdvancedAI.reinforcementLearn(h,gid),n:'Reinforce'} ];
        for(const a of algos){ const res=guard.safeRun(a.n,a.f); if(res){ const p=typeof res==='string'?res:res.p; const w=learner.getWeight(a.n,gid); r.push({prediction:p,confidence:typeof res==='string'?60:(res.c||60),weight:w,name:a.n,type:'ai'}); } } return r;
    }
}

// ============================================================
// 🌌 MODULE 7: PHÂN TÍCH ĐIỂM & XÚC XẮC (12 thuật toán)
// ============================================================
class Module7_DiceAnalysis {
    static extremePoint(totals,h){ if(totals.length<1) return null; const l=totals[0]; if(l>=17) return{ p:'X',c:95,n:'Cực Đại 17+' }; if(l>=16) return{ p:'X',c:90,n:'Cực Đại 16' }; if(l>=15) return{ p:'X',c:82,n:'Cực Đại 15' }; if(l<=4) return{ p:'T',c:95,n:'Cực Tiểu 4-' }; if(l<=5) return{ p:'T',c:88,n:'Cực Tiểu 5' }; if(l<=6) return{ p:'T',c:80,n:'Cực Tiểu 6' }; return null; }
    static pointBollinger(totals){ if(totals.length<12) return null; const l=totals[0]; const a12=totals.slice(0,12); const m=a12.reduce((a,b)=>a+b,0)/12; const s=U.std(a12,m); if(l>m+2.5*s) return{ p:'X',c:82,n:'Điểm Bollinger Trên' }; if(l<m-2.5*s) return{ p:'T',c:82,n:'Điểm Bollinger Dưới' }; return null; }
    static pointRSI(totals){ if(totals.length<14) return null; const p=totals.slice(0,14); let g=0,ls=0; for(let i=0;i<p.length-1;i++){ const d=p[i]-p[i+1]; if(d>0) g+=d; else ls+=Math.abs(d); } if(ls===0) return{ p:'X',c:75,n:'Điểm RSI Max' }; const rsi=100-(100/(1+g/ls)); if(rsi>75) return{ p:'X',c:75,n:'Điểm RSI Overbought' }; if(rsi<25) return{ p:'T',c:75,n:'Điểm RSI Oversold' }; return null; }
    static pointTrend(totals){ if(totals.length<6) return null; const s=U.ma(totals.slice(0,3),3); const l=U.ma(totals.slice(0,6),6); if(s>l+2) return{ p:'X',c:72,n:'Điểm Tăng Mạnh' }; if(s<l-2) return{ p:'T',c:72,n:'Điểm Giảm Mạnh' }; return null; }
    static pointMomentum(totals){ if(totals.length<5) return null; const l=totals[0]; const p5=totals[4]; const mom=l-p5; if(mom>4) return{ p:'X',c:75,n:'Điểm Momentum Tăng' }; if(mom<-4) return{ p:'T',c:75,n:'Điểm Momentum Giảm' }; return null; }
    static diceHotCold(dices,history){ if(!dices||dices.length<10) return null; const hot={}; for(const d of dices.slice(0,20)){ for(const f of d){ if(f>=1&&f<=6) hot[f]=(hot[f]||0)+1; } } const cold=[]; for(let i=1;i<=6;i++){ if(!hot[i]||hot[i]<=2) cold.push(i); } if(cold.filter(c=>c>=4).length>=2) return{ p:'T',c:65,n:'Số Cao Lạnh' }; if(cold.filter(c=>c<=3).length>=2) return{ p:'X',c:65,n:'Số Thấp Lạnh' }; return null; }
    static dicePair(dices){ if(!dices||dices.length<1) return null; const ld=dices[0]; if(!ld||ld.length<3) return null; const s=ld.sort((a,b)=>a-b); if(s[0]===s[1]&&s[1]===s[2]) return{ p:s[0]>=4?'X':'T',c:78,n:'Bộ 3 Giống' }; if(s[0]===s[1]||s[1]===s[2]) return{ p:s[2]>=5?'X':'T',c:68,n:'Có Đôi' }; return null; }
    static diceTotal(totals,history){ if(totals.length<5||history.length<5) return null; const lt=totals[0]; const la=history[history.length-1]; if(lt>=14&&la==='T') return{ p:'X',c:78,n:'Tổng Cao + Tài' }; if(lt<=7&&la==='X') return{ p:'T',c:78,n:'Tổng Thấp + Xỉu' }; return null; }
    static oddEvenPattern(totals){ if(totals.length<8) return null; const r=totals.slice(0,8); const e=r.filter(t=>t%2===0).length; if(e>=7) return{ p:'X',c:72,n:'Chẵn Dài' }; if(e<=1) return{ p:'T',c:72,n:'Lẻ Dài' }; return null; }
    static totalCycle(totals){ for(let c=2;c<=5;c++){ if(totals.length<c*3) continue; const p1=totals.slice(0,c).join(','); const p2=totals.slice(c,c*2).join(','); const p3=totals.slice(c*2,c*3).join(','); if(p1===p2&&p2===p3){ const np=totals[c-1]; return{ p:np>=11?'T':'X',c:74,n:'Chu Kỳ Tổng' }; } } return null; }
    static diceStreak(dices){ if(!dices||dices.length<5) return null; const rf=dices.slice(0,10); let high=0,low=0; for(const d of rf){ const s=d.reduce((a,b)=>a+b,0); if(s>=11) high++; else low++; } if(high>=8) return{ p:'X',c:72,n:'Tổng Cao Dài' }; if(low>=8) return{ p:'T',c:72,n:'Tổng Thấp Dài' }; return null; }
    static pointSupportResist(totals){ if(totals.length<15) return null; const r=totals.slice(0,15); const hi=Math.max(...r); const lo=Math.min(...r); const l=totals[0]; if(l>=hi-1) return{ p:'X',c:74,n:'Chạm Kháng Cự' }; if(l<=lo+1) return{ p:'T',c:74,n:'Chạm Hỗ Trợ' }; return null; }

    static runAll(totals,dices,history,gid){ const r=[]; const algos=[ {f:()=>Module7_DiceAnalysis.extremePoint(totals,history),n:'ExtPoint'},{f:()=>Module7_DiceAnalysis.pointBollinger(totals),n:'PtBoll'},{f:()=>Module7_DiceAnalysis.pointRSI(totals),n:'PtRSI'},{f:()=>Module7_DiceAnalysis.pointTrend(totals),n:'PtTrend'},{f:()=>Module7_DiceAnalysis.pointMomentum(totals),n:'PtMom'},{f:()=>Module7_DiceAnalysis.diceHotCold(dices,history),n:'DiceHot'},{f:()=>Module7_DiceAnalysis.dicePair(dices),n:'DicePair'},{f:()=>Module7_DiceAnalysis.diceTotal(totals,history),n:'DiceTot'},{f:()=>Module7_DiceAnalysis.oddEvenPattern(totals),n:'OddEven'},{f:()=>Module7_DiceAnalysis.totalCycle(totals),n:'TotCycle'},{f:()=>Module7_DiceAnalysis.diceStreak(dices),n:'DiceStr'},{f:()=>Module7_DiceAnalysis.pointSupportResist(totals),n:'PtSupRes'} ];
        for(const a of algos){ const res=guard.safeRun(a.n,a.f); if(res){ const w=learner.getWeight(a.n,gid); r.push({prediction:res.p,confidence:res.c||60,weight:w,name:a.n,type:'dice'}); } } return r;
    }
}

// ============================================================
// 🌌 MODULE 8: CROSS-GAME & GLOBAL PATTERNS (12 thuật toán)
// ============================================================
class Module8_CrossGame {
    static globalTrend(gameIds){ if(gameIds.length<2) return null; let tC=0,xC=0; for(const gid of gameIds){ const d=gameCache[gid]; if(!d) continue; const {history}=buildHistory(d.data,GAME_CONFIG[gid]?.game_type,10); if(history.length<5) continue; if(history[history.length-1]==='T') tC++; else xC++; } if(tC+xC<2) return null; return tC>xC?'X':'T'; }
    static crossCorrelation(gameId,gameIds){ if(gameIds.length<2) return null; const {history:h1}=buildHistory(gameCache[gameId]?.data,GAME_CONFIG[gameId]?.game_type,30); if(!h1||h1.length<10) return null; let bestCorr=0,bestPred=null; for(const gid of gameIds){ if(gid===gameId) continue; const {history:h2}=buildHistory(gameCache[gid]?.data,GAME_CONFIG[gid]?.game_type,30); if(!h2||h2.length<10) continue; const corr=U.correlation(h1,h2); if(Math.abs(corr)>Math.abs(bestCorr)&&Math.abs(corr)>0.4){ bestCorr=corr; bestPred=corr>0?h2[h2.length-1]:(h2[h2.length-1]==='T'?'X':'T'); } } return bestPred?{ p:bestPred,c:Math.round(60+Math.abs(bestCorr)*25),n:'CrossGame' }:null; }
    static patternSync(gameIds){ const patterns=[]; for(const gid of gameIds){ const {history}=buildHistory(gameCache[gid]?.data,GAME_CONFIG[gid]?.game_type,6); if(history.length>=6) patterns.push(history.slice(-6).join('')); } if(patterns.length<3) return null; const unique=new Set(patterns); if(unique.size===1) return{ p:patterns[0][patterns[0].length-1]==='T'?'X':'T',c:82,n:'Đồng Bộ Pattern' }; return null; }
    static majorityVote(gameIds){ let t=0,x=0; for(const gid of gameIds){ const p=pendingPredictions[gid]; if(!p) continue; if(p.prediction==='TÀI') t++; else x++; } if(t+x<3) return null; return t>x?'T':'X'; }
    static timeBasedPattern(h){ const hr=new Date().getHours(); const r=h.slice(-10); const t=r.filter(c=>c==='T').length; if(hr>=6&&hr<=12&&t>=6) return{ p:'T',c:65,n:'Sáng Tài' }; if(hr>=18&&hr<=23&&t<=4) return{ p:'X',c:65,n:'Tối Xỉu' }; return null; }
    static globalBalance(gameIds){ let tT=0,tX=0; for(const gid of gameIds){ const {history}=buildHistory(gameCache[gid]?.data,GAME_CONFIG[gid]?.game_type,10); if(history.length<5) continue; tT+=history.slice(-10).filter(c=>c==='T').length; tX+=history.slice(-10).filter(c=>c==='X').length; } if(tT+tX<20) return null; if(tT>tX*1.5) return 'X'; if(tX>tT*1.5) return 'T'; return null; }
    static sequentialPattern(h,gameIds){ if(gameIds.length<3) return null; const seq=[]; for(const gid of gameIds){ const {history}=buildHistory(gameCache[gid]?.data,GAME_CONFIG[gid]?.game_type,1); if(history.length>0) seq.push(history[history.length-1]); } if(seq.length<3) return null; const l3=seq.slice(-3).join(''); if(l3==='TTT') return 'X'; if(l3==='XXX') return 'T'; return null; }
    static anomalyDetection(h){ if(h.length<20) return null; const t=h.slice(-20).filter(c=>c==='T').length/20; if(t>0.85||t<0.15) return{ p:t>0.5?'X':'T',c:80,n:'Bất Thường' }; return null; }
    static volatilityBreak(h){ if(h.length<15) return null; let c=0; for(let i=1;i<15;i++){ if(h[h.length-i]!==h[h.length-i-1]) c++; } if(c>=12) return{ p:h[h.length-1]==='T'?'X':'T',c:78,n:'Biến Động Cực Đại' }; if(c<=2) return{ p:h[h.length-1],c:78,n:'Biến Động Cực Tiểu' }; return null; }
    static divergenceDetect(h,totals){ if(h.length<10||totals.length<10) return null; const pt=totals[0]-totals[9]; const ct=h.slice(-10).filter(c=>c==='T').length/10-0.5; if(pt>3&&ct<0) return{ p:'X',c:74,n:'Phân Kỳ Tăng' }; if(pt<-3&&ct>0) return{ p:'T',c:74,n:'Phân Kỳ Giảm' }; return null; }
    static smartEnsemble(allVotes){ if(allVotes.length===0) return null; const s=[...allVotes].sort((a,b)=>b.weight-a.weight); const top=Math.max(8,Math.ceil(s.length*0.65)); const tv=s.slice(0,top); let wT=0,wX=0; for(const v of tv){ const ew=v.weight*(v.confidence/100); if(v.prediction==='T') wT+=ew; else wX+=ew; } const total=wT+wX; const f=wT>wX?'T':'X'; const c=total>0?Math.round(Math.max(wT,wX)/total*100):50; const agree=tv.filter(v=>v.prediction===f).length/tv.length; let ac=c; if(agree>=0.8&&tv.length>=10) ac=Math.min(99,c+8); else if(agree>=0.65) ac=Math.min(95,c+3); else if(agree<0.45) ac=Math.max(50,c-5); return{ p:f,c:ac,n:'SmartEnsemble' }; }
    static finalConsensus(moduleResults,gameIds){ const allVotes=[]; for(const mr of moduleResults){ if(mr&&Array.isArray(mr)) allVotes.push(...mr); } if(allVotes.length===0) return{ p:'T',c:50,n:'NoConsensus',totalVotes:0 }; const smart=Module8_CrossGame.smartEnsemble(allVotes); if(smart) return{ ...smart,totalVotes:allVotes.length,usedVotes:Math.max(8,Math.ceil(allVotes.length*0.65)) }; return{ p:'T',c:50,n:'Fallback',totalVotes:0 }; }

    static runAll(h,totals,dices,gameId,gameIds){ const r=[]; const algos=[ {f:()=>Module8_CrossGame.timeBasedPattern(h),n:'TimeBased'},{f:()=>Module8_CrossGame.anomalyDetection(h),n:'Anomaly'},{f:()=>Module8_CrossGame.volatilityBreak(h),n:'VolBreak'},{f:()=>Module8_CrossGame.divergenceDetect(h,totals),n:'Divergence'},{f:()=>Module8_CrossGame.globalTrend(gameIds),n:'GlobalTrend'},{f:()=>Module8_CrossGame.majorityVote(gameIds),n:'Majority'},{f:()=>Module8_CrossGame.sequentialPattern(h,gameIds),n:'Sequential'},{f:()=>Module8_CrossGame.globalBalance(gameIds),n:'GlobBalance'} ];
        for(const a of algos){ const res=guard.safeRun(a.n,a.f); if(res){ const p=typeof res==='string'?res:res.p; const w=learner.getWeight(a.n,gameId); r.push({prediction:p,confidence:typeof res==='string'?60:(res.c||60),weight:w,name:a.n,type:'cross'}); } }
        const cross=Module8_CrossGame.crossCorrelation(gameId,gameIds); if(cross){ const w=learner.getWeight('CrossCorr',gameId); r.push({prediction:cross.p,confidence:cross.c,weight:w,name:'CrossCorr',type:'cross'}); }
        const sync=Module8_CrossGame.patternSync(gameIds); if(sync){ const w=learner.getWeight('PatSync',gameId); r.push({prediction:sync.p,confidence:sync.c,weight:w,name:'PatSync',type:'cross'}); }
        return r;
    }
}

// ============================================================
// 🌌 GAME CONFIG
// ============================================================
const GAME_CONFIG = {
    hu: { api_url: API_URL_HU, game_type: 'legacy' },
    md5: { api_url: API_URL_MD5, game_type: 'legacy' }
};

// ============================================================
// 🌌 UNIVERSE PREDICTOR — MAIN ENGINE
// ============================================================
class UniversePredictor {
    async predict(gameId, allGameIds=[]) {
        try {
            const config=GAME_CONFIG[gameId];
            if(!config) return this.fallback(gameId,'No config');
            const data=await getCachedData(gameId);
            if(!data) return this.fallback(gameId,'No data');
            const {history,totals,dices}=buildHistory(data,config.game_type,120);
            if(history.length<3) return this.fallback(gameId,'Short history');

            // Chạy tất cả 8 module
            const allVotes=[];
            const m1=Module1_BasicCau.runAll(history,gameId); if(m1) allVotes.push(...m1);
            const m2=Module2_AdvancedCau.runAll(history,gameId); if(m2) allVotes.push(...m2);
            const m3=Module3_ClassicalStats.runAll(history,gameId); if(m3) allVotes.push(...m3);
            const m4=Module4_TechnicalIndicators.runAll(history,gameId); if(m4) allVotes.push(...m4);
            const m5=Module5_MachineLearning.runAll(history,gameId); if(m5) allVotes.push(...m5);
            const m6=Module6_AdvancedAI.runAll(history,gameId); if(m6) allVotes.push(...m6);
            const m7=Module7_DiceAnalysis.runAll(totals,dices,history,gameId); if(m7) allVotes.push(...m7);
            const m8=Module8_CrossGame.runAll(history,totals,dices,gameId,allGameIds); if(m8) allVotes.push(...m8);

            // Final Consensus
            const result=Module8_CrossGame.finalConsensus([allVotes],allGameIds);

            const items=data.list||data;
            const session=parseSession(items[0],config.game_type);

            pendingPredictions[gameId]={
                sessionId:session.sessionId,
                prediction:result.p==='T'?'TÀI':'XỈU',
                confidence:result.c,
                timestamp:new Date().toISOString(),
                totalVotes:result.totalVotes||allVotes.length
            };

            return {
                gameId,
                sessionId:session.sessionId,
                prediction:result.p==='T'?'TÀI':'XỈU',
                confidence:result.c,
                totalVotes:result.totalVotes||allVotes.length,
                usedVotes:result.usedVotes||Math.max(8,Math.ceil((result.totalVotes||allVotes.length)*0.65)),
                moduleBreakdown:{
                    m1:m1?.length||0,m2:m2?.length||0,m3:m3?.length||0,m4:m4?.length||0,
                    m5:m5?.length||0,m6:m6?.length||0,m7:m7?.length||0,m8:m8?.length||0
                }
            };
        } catch(e){ return this.fallback(gameId,e.message); }
    }

    fallback(gameId,error){ return { gameId,error,prediction:'TÀI',confidence:50,totalVotes:0,usedVotes:0 }; }
}

const universePredictor=new UniversePredictor();

// ============================================================
// 🌐 GLOBAL API
// ============================================================
async function predictGame(gameId,allGameIds=[]){ return await universePredictor.predict(gameId,allGameIds); }
async function predictAllGames(gameIds){ const results={}; for(const gid of gameIds){ results[gid]=await predictGame(gid,gameIds); } return results; }

function updateResult(gameId,sessionId,actualResult){
    if(!actualHistory[gameId]) actualHistory[gameId]=[];
    actualHistory[gameId].push(actualResult==='TÀI'?'T':'X');
    if(pendingPredictions[gameId]&&pendingPredictions[gameId].sessionId===sessionId){
        const pred=pendingPredictions[gameId];
        const correct=pred.prediction===actualResult;
        const allNames=[];
        for(const m of[Module1_BasicCau,Module2_AdvancedCau,Module3_ClassicalStats,Module4_TechnicalIndicators,Module5_MachineLearning,Module6_AdvancedAI,Module7_DiceAnalysis,Module8_CrossGame]){
            if(m.runAll) allNames.push(m.name||'Unknown');
        }
        for(const name of allNames){ learner.update(name,gameId,correct); }
        delete pendingPredictions[gameId];
    }
}

function getUniverseStatus(){
    return {
        cachedGames:Object.keys(gameCache).length,
        pending:Object.keys(pendingPredictions).length,
        learningEntries:learner.weights.size,
        disabledAlgos:guard.getStatus().disabled,
        totalErrors:guard.getStatus().totalErrors,
        topAlgos:learner.getTop(Object.keys(gameCache)[0]||'default',20),
        crossCorrelations:crossGameCorrelations.size
    };
}

if(typeof module!=='undefined'&&module.exports){
    module.exports={predictGame,predictAllGames,updateResult,getUniverseStatus,gameCache,actualHistory,learner,guard};
}

// ============================================================
// CÁC HÀM HỖ TRỢ CHO API CŨ
// ============================================================

function loadLearningData() {
  try {
    if (fs.existsSync(LEARNING_FILE)) {
      const data = fs.readFileSync(LEARNING_FILE, 'utf8');
      const parsed = JSON.parse(data);
      learningData = { ...learningData, ...parsed };
      console.log('Learning data loaded successfully from tiendat.json');
    }
  } catch (error) {
    console.error('Error loading learning data:', error.message);
  }
}

function saveLearningData() {
  try {
    fs.writeFileSync(LEARNING_FILE, JSON.stringify(learningData, null, 2));
  } catch (error) {
    console.error('Error saving learning data:', error.message);
  }
}

function loadPredictionHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      const parsed = JSON.parse(data);
      predictionHistory = parsed.history || { hu: [], md5: [] };
      lastProcessedPhien = parsed.lastProcessedPhien || { hu: null, md5: null };
      console.log('Prediction history loaded successfully from tiendat1.json');
      console.log(`  - Hu: ${predictionHistory.hu.length} records`);
      console.log(`  - MD5: ${predictionHistory.md5.length} records`);
    }
  } catch (error) {
    console.error('Error loading prediction history:', error.message);
  }
}

function savePredictionHistory() {
  try {
    const dataToSave = {
      history: predictionHistory,
      lastProcessedPhien,
      lastSaved: new Date().toISOString()
    };
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(dataToSave, null, 2));
  } catch (error) {
    console.error('Error saving prediction history:', error.message);
  }
}

function transformApiData(apiData) {
  if (!apiData || !apiData.list || !Array.isArray(apiData.list)) {
    return null;
  }
  
  return apiData.list.map(item => {
    const result = item.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu';
    return {
      Phien: item.id,
      Ket_qua: result,
      Xuc_xac_1: item.dices[0],
      Xuc_xac_2: item.dices[1],
      Xuc_xac_3: item.dices[2],
      Tong: item.point
    };
  });
}

async function fetchDataHu() {
  try {
    const response = await axios.get(API_URL_HU, { timeout: 10000 });
    return transformApiData(response.data);
  } catch (error) {
    console.error('Error fetching HU data:', error.message);
    return null;
  }
}

async function fetchDataMd5() {
  try {
    const response = await axios.get(API_URL_MD5, { timeout: 10000 });
    return transformApiData(response.data);
  } catch (error) {
    console.error('Error fetching MD5 data:', error.message);
    return null;
  }
}

function normalizeResult(result) {
  if (result === 'Tài' || result === 'tài') return 'TÀI';
  if (result === 'Xỉu' || result === 'xỉu') return 'XỈU';
  return result;
}

// ============================================================
// CÁC HÀM DỰ ĐOÁN SỬ DỤNG UNIVERSE PREDICTOR
// ============================================================

async function predictWithUniverse(type) {
  try {
    const gameId = type === 'hu' ? 'hu' : 'md5';
    const allGameIds = ['hu', 'md5'];
    
    // Lấy dữ liệu hiện tại để lấy phiên
    let data = null;
    if (type === 'hu') {
      data = await fetchDataHu();
    } else {
      data = await fetchDataMd5();
    }
    
    if (!data || data.length === 0) {
      return null;
    }
    
    // Dự đoán bằng Universe Predictor
    const result = await predictGame(gameId, allGameIds);
    
    return {
      Phien: data[0].Phien,
      Xuc_xac_1: data[0].Xuc_xac_1,
      Xuc_xac_2: data[0].Xuc_xac_2,
      Xuc_xac_3: data[0].Xuc_xac_3,
      Tong: data[0].Tong,
      Ket_qua: data[0].Ket_qua,
      Do_tin_cay: `${result.confidence}%`,
      Phien_hien_tai: (data[0].Phien + 1).toString(),
      Du_doan: result.prediction,
      ket_qua_du_doan: '',
      id: '@tiendataox',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error in predictWithUniverse ${type}:`, error.message);
    return null;
  }
}

async function autoProcessPredictions() {
  try {
    const dataHu = await fetchDataHu();
    if (dataHu && dataHu.length > 0) {
      const latestHuPhien = dataHu[0].Phien;
      const nextHuPhien = latestHuPhien + 1;
      
      if (lastProcessedPhien.hu !== nextHuPhien) {
        const result = await predictWithUniverse('hu');
        if (result) {
          predictionHistory.hu.unshift(result);
          if (predictionHistory.hu.length > MAX_HISTORY) {
            predictionHistory.hu = predictionHistory.hu.slice(0, MAX_HISTORY);
          }
          lastProcessedPhien.hu = nextHuPhien;
          console.log(`[Auto] Hu phien ${nextHuPhien}: ${result.Du_doan} (${result.Do_tin_cay})`);
        }
      }
    }
    
    const dataMd5 = await fetchDataMd5();
    if (dataMd5 && dataMd5.length > 0) {
      const latestMd5Phien = dataMd5[0].Phien;
      const nextMd5Phien = latestMd5Phien + 1;
      
      if (lastProcessedPhien.md5 !== nextMd5Phien) {
        const result = await predictWithUniverse('md5');
        if (result) {
          predictionHistory.md5.unshift(result);
          if (predictionHistory.md5.length > MAX_HISTORY) {
            predictionHistory.md5 = predictionHistory.md5.slice(0, MAX_HISTORY);
          }
          lastProcessedPhien.md5 = nextMd5Phien;
          console.log(`[Auto] MD5 phien ${nextMd5Phien}: ${result.Du_doan} (${result.Do_tin_cay})`);
        }
      }
    }
    
    await updateHistoryStatus('hu');
    await updateHistoryStatus('md5');
    
    savePredictionHistory();
    saveLearningData();
    
  } catch (error) {
    console.error('[Auto] Error processing predictions:', error.message);
  }
}

async function updateHistoryStatus(type) {
  try {
    let data = null;
    if (type === 'hu') {
      data = await fetchDataHu();
    } else {
      data = await fetchDataMd5();
    }
    
    if (!data || data.length === 0) return;
    
    let updated = false;
    for (const record of predictionHistory[type]) {
      if (record.ket_qua_du_doan && record.ket_qua_du_doan !== '') continue;
      
      const actualResult = data.find(d => d.Phien.toString() === record.Phien_hien_tai);
      if (actualResult) {
        const duDoanNormalized = record.Du_doan;
        const ketQuaThucTe = actualResult.Ket_qua;
        
        if (duDoanNormalized === ketQuaThucTe) {
          record.ket_qua_du_doan = 'Đúng ✅';
        } else {
          record.ket_qua_du_doan = 'Sai ❌';
        }
        updated = true;
      }
    }
    
    if (updated) {
      savePredictionHistory();
    }
  } catch (error) {
    console.error(`Error updating ${type} history status:`, error.message);
  }
}

function startAutoSaveTask() {
  console.log(`Auto-save task started (every ${AUTO_SAVE_INTERVAL/1000}s)`);
  
  setTimeout(() => {
    autoProcessPredictions();
  }, 5000);
  
  setInterval(() => {
    autoProcessPredictions();
  }, AUTO_SAVE_INTERVAL);
}

// ============================================================
// ENDPOINTS
// ============================================================

app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send('t.me/CuTools');
});

app.get('/lc79-hu', async (req, res) => {
  try {
    const result = await predictWithUniverse('hu');
    if (!result) {
      return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    }
    
    predictionHistory.hu.unshift(result);
    if (predictionHistory.hu.length > MAX_HISTORY) {
      predictionHistory.hu = predictionHistory.hu.slice(0, MAX_HISTORY);
    }
    savePredictionHistory();
    
    res.json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

app.get('/lc79-md5', async (req, res) => {
  try {
    const result = await predictWithUniverse('md5');
    if (!result) {
      return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    }
    
    predictionHistory.md5.unshift(result);
    if (predictionHistory.md5.length > MAX_HISTORY) {
      predictionHistory.md5 = predictionHistory.md5.slice(0, MAX_HISTORY);
    }
    savePredictionHistory();
    
    res.json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

app.get('/lc79-hu/lichsu', async (req, res) => {
  try {
    await updateHistoryStatus('hu');
    res.json({
      type: 'Lẩu Cua 79 - Tài Xỉu Hũ',
      history: predictionHistory.hu,
      total: predictionHistory.hu.length
    });
  } catch (error) {
    res.json({
      type: 'Lẩu Cua 79 - Tài Xỉu Hũ',
      history: predictionHistory.hu,
      total: predictionHistory.hu.length
    });
  }
});

app.get('/lc79-md5/lichsu', async (req, res) => {
  try {
    await updateHistoryStatus('md5');
    res.json({
      type: 'Lẩu Cua 79 - Tài Xỉu MD5',
      history: predictionHistory.md5,
      total: predictionHistory.md5.length
    });
  } catch (error) {
    res.json({
      type: 'Lẩu Cua 79 - Tài Xỉu MD5',
      history: predictionHistory.md5,
      total: predictionHistory.md5.length
    });
  }
});

app.get('/lc79-hu/analysis', async (req, res) => {
  try {
    const data = await fetchDataHu();
    if (!data || data.length === 0) {
      return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    }
    
    const result = await predictGame('hu', ['hu', 'md5']);
    res.json({
      prediction: result.prediction,
      confidence: result.confidence,
      totalVotes: result.totalVotes,
      usedVotes: result.usedVotes,
      moduleBreakdown: result.moduleBreakdown
    });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

app.get('/lc79-md5/analysis', async (req, res) => {
  try {
    const data = await fetchDataMd5();
    if (!data || data.length === 0) {
      return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    }
    
    const result = await predictGame('md5', ['hu', 'md5']);
    res.json({
      prediction: result.prediction,
      confidence: result.confidence,
      totalVotes: result.totalVotes,
      usedVotes: result.usedVotes,
      moduleBreakdown: result.moduleBreakdown
    });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

app.get('/lc79-hu/learning', (req, res) => {
  const stats = learningData.hu;
  const accuracy = stats.totalPredictions > 0 
    ? (stats.correctPredictions / stats.totalPredictions * 100).toFixed(2)
    : 0;
  
  res.json({
    type: 'Lẩu Cua 79 - Tài Xỉu Hũ - Learning Stats',
    totalPredictions: stats.totalPredictions,
    correctPredictions: stats.correctPredictions,
    overallAccuracy: `${accuracy}%`,
    streakAnalysis: stats.streakAnalysis
  });
});

app.get('/lc79-md5/learning', (req, res) => {
  const stats = learningData.md5;
  const accuracy = stats.totalPredictions > 0 
    ? (stats.correctPredictions / stats.totalPredictions * 100).toFixed(2)
    : 0;
  
  res.json({
    type: 'Lẩu Cua 79 - Tài Xỉu MD5 - Learning Stats',
    totalPredictions: stats.totalPredictions,
    correctPredictions: stats.correctPredictions,
    overallAccuracy: `${accuracy}%`,
    streakAnalysis: stats.streakAnalysis
  });
});

app.get('/universe-status', (req, res) => {
  res.json(getUniverseStatus());
});

app.get('/reset-learning', (req, res) => {
  learningData = {
    hu: {
      predictions: [],
      patternStats: {},
      totalPredictions: 0,
      correctPredictions: 0,
      patternWeights: { ...DEFAULT_PATTERN_WEIGHTS },
      lastUpdate: null,
      streakAnalysis: { wins: 0, losses: 0, currentStreak: 0, bestStreak: 0, worstStreak: 0 },
      adaptiveThresholds: {},
      recentAccuracy: []
    },
    md5: {
      predictions: [],
      patternStats: {},
      totalPredictions: 0,
      correctPredictions: 0,
      patternWeights: { ...DEFAULT_PATTERN_WEIGHTS },
      lastUpdate: null,
      streakAnalysis: { wins: 0, losses: 0, currentStreak: 0, bestStreak: 0, worstStreak: 0 },
      adaptiveThresholds: {},
      recentAccuracy: []
    }
  };
  saveLearningData();
  res.json({ message: 'Learning data reset successfully' });
});

// ============================================================
// KHỞI ĐỘNG SERVER
// ============================================================

loadLearningData();
loadPredictionHistory();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log('Lau Cua 79 - TX_UNIVERSE_PREDICTOR v1.0');
  console.log('');
  console.log('🌌 8 MODULE — 100+ THUẬT TOÁN — ĐA GAME — SIÊU CHUẨN');
  console.log('  - Module 1: Cầu Cơ Bản (15 thuật toán)');
  console.log('  - Module 2: Cầu Nâng Cao (15 thuật toán)');
  console.log('  - Module 3: Thống Kê Cổ Điển (12 thuật toán)');
  console.log('  - Module 4: Technical Indicators (12 thuật toán)');
  console.log('  - Module 5: Machine Learning (15 thuật toán)');
  console.log('  - Module 6: Advanced AI (12 thuật toán)');
  console.log('  - Module 7: Phân Tích Điểm & Xúc Xắc (12 thuật toán)');
  console.log('  - Module 8: Cross-Game & Global Patterns (12 thuật toán)');
  console.log('');
  console.log('FILE: tiendat.json, tiendat1.json');
  console.log('ID: @himinhlakhoi');
  
  startAutoSaveTask();
});
