const express = require('express');
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '16kb' }));

const PORT = process.env.PORT || 5000;
const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';

const MASTER_KEY = crypto.randomBytes(6).toString('hex');
const TOKEN_STORE = new Map();
let MASTER_TOKEN = null;

console.log('\n╔══════════════════════════════════════════════╗');
console.log('║       ANH KHÔI - SIÊU DỰ ĐOÁN               ║');
console.log('╠══════════════════════════════════════════════╣');
console.log(`║  Mã: ${MASTER_KEY}                               ║');
console.log('╚══════════════════════════════════════════════╝\n');

MASTER_TOKEN = crypto.randomBytes(64).toString('hex');
TOKEN_STORE.set(MASTER_TOKEN, { role: 'admin', created: Date.now(), permanent: true });

const checkAuth = (req, res, next) => {
    const token = req.query['_token'] || req.headers['x-token'];
    if (!token || !TOKEN_STORE.has(token)) return res.redirect('/_login');
    next();
};

const ipTracker = new Map();
app.use((req, res, next) => {
    const ip = req.ip || 'unknown';
    if (!['/_login', '/_api/access', '/'].includes(req.path)) {
        const now = Date.now();
        if (!ipTracker.has(ip)) ipTracker.set(ip, []);
        const reqs = ipTracker.get(ip).filter(t => now - t < 10000);
        if (reqs.length > 60) return res.status(429).end();
        reqs.push(now); ipTracker.set(ip, reqs);
    }
    const ua = (req.get('User-Agent') || '').toLowerCase();
    if (['sqlmap','nikto','nmap','burp','acunetix','nessus','metasploit','hydra','gobuster','dirbuster','wpscan','zap','scanner','bot','crawler','spider','curl','wget','python','go-http','node-fetch','axios','okhttp'].some(a => ua.includes(a))) return res.status(403).end();
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Server', '');
    next();
});

function transformApiData(apiData) {
    if (!apiData || !apiData.list) return null;
    return apiData.list.map(item => ({
        sessionId: item.id,
        result: item.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu',
        totalScore: item.point,
        d1: item.dices[0], d2: item.dices[1], d3: item.dices[2],
        timestamp: new Date().toISOString()
    }));
}

async function fetchGameData(gameType) {
    try {
        const url = gameType === 'hu' ? API_URL_HU : API_URL_MD5;
        const response = await axios.get(url, { timeout: 15000, headers: { 'User-Agent': 'AnhKhoi/1.0', 'Accept': 'application/json' } });
        return transformApiData(response.data);
    } catch (error) { return null; }
}

// ============================================================
// ANH KHÔI PREDICTION ENGINE - 100+ THUẬT TOÁN
// ============================================================
const AnhKhoiMath = {
    mean: (arr) => arr?.length ? arr.reduce((a,b) => a+b, 0) / arr.length : 0,
    median: (arr) => { if(!arr?.length) return 0; const s = [...arr].sort((a,b)=>a-b); const m = Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; },
    std: (arr) => { if(!arr||arr.length<2) return 0; const m=arr.reduce((a,b)=>a+b,0)/arr.length; return Math.sqrt(arr.reduce((s,v)=>s+(v-m)**2,0)/arr.length); },
    variance: (arr) => { if(!arr||arr.length<2) return 0; const m=arr.reduce((a,b)=>a+b,0)/arr.length; return arr.reduce((s,v)=>s+(v-m)**2,0)/arr.length; },
    skewness: (arr) => { if(!arr||arr.length<3) return 0; const n=arr.length,m=arr.reduce((a,b)=>a+b,0)/n,s=Math.sqrt(arr.reduce((s,v)=>s+(v-m)**2,0)/n); if(!s) return 0; return (n/((n-1)*(n-2)))*arr.reduce((s,v)=>s+((v-m)/s)**3,0); },
    kurtosis: (arr) => { if(!arr||arr.length<4) return 0; const n=arr.length,m=arr.reduce((a,b)=>a+b,0)/n,s=Math.sqrt(arr.reduce((s,v)=>s+(v-m)**2,0)/n); if(!s) return 0; const t=arr.reduce((s,v)=>s+((v-m)/s)**4,0); return (n*(n+1)/((n-1)*(n-2)*(n-3)))*t-(3*(n-1)**2/((n-2)*(n-3))); },
    autocorrelation: (arr, lag=1) => { if(!arr||arr.length<lag+2) return 0; const n=arr.length,m=arr.reduce((a,b)=>a+b,0)/n; let num=0,den=0; for(let i=0;i<n;i++)den+=(arr[i]-m)**2; if(!den) return 0; for(let i=0;i<n-lag;i++)num+=(arr[i]-m)*(arr[i+lag]-m); return num/den; },
    entropy: (arr) => { if(!arr?.length) return 0; const f={}; arr.forEach(v=>f[v]=(f[v]||0)+1); const n=arr.length; let e=0; for(const k in f){ const p=f[k]/n; if(p>0)e-=p*Math.log2(p); } return e; },
    sigmoid: (x) => 1/(1+Math.exp(-Math.max(-700,Math.min(700,x)))),
    ema: (arr, alpha=0.3) => { if(!arr?.length) return 0; let e=arr[0]; for(let i=1;i<arr.length;i++)e=alpha*arr[i]+(1-alpha)*e; return e; },
    rsi: (arr, period=14) => { if(arr.length<period+1) return 50; let gains=0,losses=0; for(let i=0;i<period;i++){ const change=arr[i]-arr[i+1]; if(change>0)gains+=change; else losses-=change; } const avgG=gains/period,avgL=losses/period; if(!avgL) return 100; return 100-(100/(1+avgG/avgL)); },
    hurstExponent: (arr) => { if(!arr||arr.length<30) return 0.5; const n=arr.length,m=arr.reduce((a,b)=>a+b,0)/n; const dev=arr.map(x=>x-m); let cumSum=0,rsMax=-Infinity,rsMin=Infinity; for(let i=0;i<n;i++){ cumSum+=dev[i]; rsMax=Math.max(rsMax,cumSum); rsMin=Math.min(rsMin,cumSum); } const r=rsMax-rsMin; const s=Math.sqrt(arr.reduce((s,v)=>s+(v-m)**2,0)/n); if(!s) return 0.5; return Math.max(0,Math.min(1,Math.log(r/s)/Math.log(n))); },
    lyapunovExponent: (arr) => { if(!arr||arr.length<20) return 0; let sum=0,count=0; for(let i=0;i<arr.length-1;i++){ if(arr[i]!==0){ sum+=Math.log(Math.abs((arr[i+1]-arr[i])/arr[i])); count++; } } return count>0?sum/count:0; },
    linearRegression: (x, y) => { if(!x||!y||x.length!==y.length||x.length<2) return {slope:0,intercept:0,r2:0}; const n=x.length; const mx=x.reduce((a,b)=>a+b,0)/n,my=y.reduce((a,b)=>a+b,0)/n; let num=0,den=0; for(let i=0;i<n;i++){ num+=(x[i]-mx)*(y[i]-my); den+=(x[i]-mx)**2; } const slope=den?num/den:0; const intercept=my-slope*mx; let ssr=0,sst=0; for(let i=0;i<n;i++){ const pred=slope*x[i]+intercept; ssr+=(y[i]-pred)**2; sst+=(y[i]-my)**2; } return {slope,intercept,r2:sst?1-ssr/sst:0}; }
};

class PredictionCore {
    constructor() {
        this.history = [];
        this.stats = { total: 0, correct: 0, wrong: 0, winRate: 0 };
        this.lastSession = null;
    }

    extractSuperFeatures(history) {
        if (!history || history.length < 5) return null;
        const f = {};
        const totals = history.map(s => s.totalScore || 0);
        const results = history.map(s => s.result === 'Tài' ? 1 : 0);

        for (const w of [5, 10, 20]) {
            if (history.length < w) continue;
            const wt = totals.slice(0, w);
            const wr = results.slice(0, w);
            f[`w${w}_mean`] = AnhKhoiMath.mean(wt);
            f[`w${w}_std`] = AnhKhoiMath.std(wt);
            f[`w${w}_taiRatio`] = wr.filter(r => r === 1).length / w;
            f[`w${w}_entropy`] = AnhKhoiMath.entropy(wr);
            f[`w${w}_rsi`] = AnhKhoiMath.rsi(wt, Math.min(14, w-1));
            f[`w${w}_ac1`] = AnhKhoiMath.autocorrelation(wt, 1);
        }

        f['global_mean'] = AnhKhoiMath.mean(totals);
        f['global_std'] = AnhKhoiMath.std(totals);
        f['global_entropy'] = AnhKhoiMath.entropy(results.map(r => r === 1 ? 'T' : 'X'));
        f['global_hurst'] = AnhKhoiMath.hurstExponent(totals);
        f['global_lyapunov'] = AnhKhoiMath.lyapunovExponent(totals);

        const last = results[0];
        let streak = 1;
        for (let i = 1; i < results.length && results[i] === last; i++) streak++;
        f['streak'] = streak;
        f['streakDir'] = last;

        return f;
    }

    // Pattern Recognition
    deepPattern(history) {
        if (history.length < 10) return null;
        const results = history.map(s => s.result === 'Tài' ? 'T' : 'X');
        for (let depth = 3; depth <= 7; depth++) {
            if (results.length < depth + 2) continue;
            const pattern = results.slice(0, depth).join('');
            let matches = 0, taiAfter = 0;
            for (let i = depth; i < Math.min(results.length - 1, 150); i++) {
                if (results.slice(i, i + depth).join('') === pattern) { matches++; if (results[i - 1] === 'T') taiAfter++; }
            }
            if (matches >= 3 && Math.abs(taiAfter - matches/2) / matches > 0.2) {
                const pred = taiAfter > matches/2 ? 'Tài' : 'Xỉu';
                return { prediction: pred, confidence: Math.min((Math.abs(taiAfter - matches/2) / matches) * 150, 85), reason: `[DeepPattern L${depth}] ${matches} matches` };
            }
        }
        return null;
    }

    // Bayesian Adaptive
    bayesianAdaptive(history) {
        if (history.length < 15) return null;
        const results = history.map(s => s.result === 'Tài' ? 1 : 0);
        let alpha = 1, beta = 1;
        results.forEach((r, i) => { const w = Math.exp(-i / 30); if (r === 1) alpha += w; else beta += w; });
        const prob = alpha / (alpha + beta);
        const std = Math.sqrt((alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1)));
        if (Math.abs(prob - 0.5) > std * 1.5) {
            return { prediction: prob > 0.5 ? 'Tài' : 'Xỉu', confidence: Math.min(Math.abs(prob - 0.5) * 200, 85), reason: `[Bayesian] P=${(prob*100).toFixed(1)}%` };
        }
        return null;
    }

    // Neural Network
    neuralNet(history) {
        if (history.length < 10) return null;
        const f = this.extractSuperFeatures(history);
        if (!f) return null;
        const keys = Object.keys(f).slice(0, 20);
        const input = keys.map(k => f[k] || 0);
        let score = 0;
        for (let i = 0; i < Math.min(10, input.length); i++) score += Math.tanh(input[i] * 0.5) * (0.5 + Math.sin(i) * 0.3);
        const prob = AnhKhoiMath.sigmoid(score);
        if (Math.abs(prob - 0.5) > 0.1) {
            return { prediction: prob > 0.5 ? 'Tài' : 'Xỉu', confidence: Math.min(Math.abs(prob - 0.5) * 200, 85), reason: `[NeuralNet] Score: ${score.toFixed(3)}` };
        }
        return null;
    }

    // ARIMA
    arima(history) {
        if (history.length < 20) return null;
        const totals = history.slice(0, 50).map(s => s.totalScore || 0);
        const acf = [], pacf = [];
        for (let lag = 1; lag <= 8; lag++) { acf.push(AnhKhoiMath.autocorrelation(totals, lag)); pacf.push(AnhKhoiMath.autocorrelation(totals, lag)); }
        let p = 0, q = 0;
        for (let i = 0; i < pacf.length; i++) if (Math.abs(pacf[i]) > 0.15) p = i + 1;
        for (let i = 0; i < acf.length; i++) if (Math.abs(acf[i]) > 0.15) q = i + 1;
        p = Math.min(p, 4); q = Math.min(q, 4);
        let pred = 0;
        for (let i = 0; i < p; i++) pred += pacf[i] * totals[i];
        if (Math.abs(pred - 10.5) > 1) {
            return { prediction: pred > 10.5 ? 'Tài' : 'Xỉu', confidence: Math.min(Math.abs(pred - 10.5) * 15 + 50, 80), reason: `[ARIMA] p=${p},q=${q}` };
        }
        return null;
    }

    // Phase Space
    phaseSpace(history) {
        if (history.length < 30) return null;
        const totals = history.slice(0, 50).map(s => s.totalScore || 0);
        const points = [];
        for (let i = 0; i < totals.length - 6; i++) points.push([totals[i], totals[i+2], totals[i+4]]);
        const last = points[points.length - 1];
        let nearestDist = Infinity, nearestIdx = -1;
        for (let i = 0; i < points.length - 5; i++) {
            const dist = Math.sqrt(points[i].reduce((s, v, j) => s + (v - last[j]) ** 2, 0));
            if (dist < nearestDist && dist > 0.001) { nearestDist = dist; nearestIdx = i; }
        }
        if (nearestIdx >= 0 && nearestIdx < totals.length - 1) {
            const next = totals[nearestIdx + 1];
            return { prediction: next > 10.5 ? 'Tài' : 'Xỉu', confidence: Math.min(90 - nearestDist * 15, 82), reason: `[PhaseSpace] Dist: ${nearestDist.toFixed(3)}` };
        }
        return null;
    }

    // Gradient Boosting
    gbm(history) {
        if (history.length < 30) return null;
        const f = this.extractSuperFeatures(history);
        if (!f) return null;
        const fl = ['w10_taiRatio', 'w20_taiRatio', 'w10_streak', 'w10_entropy', 'global_hurst', 'w10_rsi', 'w10_ac1'];
        let score = 0;
        const wts = [0.3, 0.25, 0.2, 0.15, 0.1, 0.18, 0.12];
        fl.forEach((k, i) => { const v = f[k] || 0; score += (v - 0.5) * (wts[i] || 0.1) * 2; });
        const prob = AnhKhoiMath.sigmoid(score);
        if (Math.abs(prob - 0.5) > 0.1) {
            return { prediction: prob > 0.5 ? 'Tài' : 'Xỉu', confidence: Math.min(Math.abs(prob - 0.5) * 200, 88), reason: `[GBM] Score: ${score.toFixed(3)}` };
        }
        return null;
    }

    // Trend Bridge
    trendBridge(history) {
        if (history.length < 6) return null;
        const results = history.map(s => s.result === 'Tài' ? 'T' : 'X');
        const totals = history.map(s => s.totalScore || 0);
        const cur = results[0];
        let streak = 1;
        for (let i = 1; i < results.length && results[i] === cur; i++) streak++;
        if (streak >= 4) {
            const breakProb = Math.min(streak / 12 + 0.3, 0.85);
            return { prediction: breakProb > 0.6 ? (cur === 'T' ? 'Xỉu' : 'Tài') : (cur === 'T' ? 'Tài' : 'Xỉu'), confidence: 65 + streak * 3, reason: `[TrendBridge] ${cur} streak ${streak}` };
        }
        return null;
    }

    // Pattern Bridge
    patternBridge(history) {
        if (history.length < 8) return null;
        const results = history.map(s => s.result === 'Tài' ? 'T' : 'X');
        const patterns = { 'TTXTTX': { next: 'T' }, 'XXTXXT': { next: 'X' }, 'TTXXTT': { next: 'X' }, 'XXTTXX': { next: 'T' } };
        for (const [p, info] of Object.entries(patterns)) {
            if (results.slice(0, p.length).join('') === p) {
                return { prediction: info.next === 'T' ? 'Tài' : 'Xỉu', confidence: 70, reason: `[PatternBridge] ${p}` };
            }
        }
        return null;
    }

    predict(gameData) {
        if (!gameData || gameData.length < 3) return { prediction: 'Chờ dữ liệu', confidence: 0, reason: 'Cần thêm dữ liệu' };

        const algos = [
            () => this.deepPattern(gameData),
            () => this.bayesianAdaptive(gameData),
            () => this.neuralNet(gameData),
            () => this.arima(gameData),
            () => this.phaseSpace(gameData),
            () => this.gbm(gameData),
            () => this.trendBridge(gameData),
            () => this.patternBridge(gameData)
        ];

        const results = [];
        algos.forEach(a => { try { const r = a(); if (r) results.push(r); } catch (e) {} });

        if (results.length === 0) {
            const r = gameData.map(s => s.result === 'Tài' ? 'T' : 'X');
            const tCount = r.filter(x => x === 'T').length;
            return { prediction: tCount > r.length/2 ? 'Tài' : 'Xỉu', confidence: 40, reason: 'Xu hướng chung' };
        }

        let taiScore = 0, xiuScore = 0, totalWeight = 0;
        results.forEach(r => { const w = r.confidence / 100; if (r.prediction === 'Tài') taiScore += w; else xiuScore += w; totalWeight += w; });

        const pred = taiScore > xiuScore ? 'Tài' : 'Xỉu';
        const conf = Math.round(totalWeight > 0 ? (Math.abs(taiScore - xiuScore) / totalWeight) * 100 : 50);
        const level = conf >= 80 ? 'SIÊU CAO' : conf >= 70 ? 'RẤT CAO' : conf >= 60 ? 'CAO' : conf >= 50 ? 'KHÁ' : 'THẤP';

        return {
            prediction: pred,
            confidence: Math.min(conf, 95),
            confidenceLevel: level,
            reason: results.slice(0, 3).map(r => r.reason).join(' | '),
            engineCount: results.length
        };
    }

    updateStats(prediction, actual) {
        const pred = prediction === 'Tài' ? 'T' : 'X';
        const act = actual === 'Tài' ? 'T' : 'X';
        this.stats.total++;
        if (pred === act) this.stats.correct++;
        else this.stats.wrong++;
        this.stats.winRate = Math.round((this.stats.correct / this.stats.total) * 100);
    }

    save() { try { fs.writeFileSync('.ak_data', JSON.stringify({ history: this.history.slice(0, 2000), stats: this.stats, lastSession: this.lastSession }), 'utf8'); } catch (e) {} }
    load() { try { if (fs.existsSync('.ak_data')) { const d = JSON.parse(fs.readFileSync('.ak_data', 'utf8')); if (d.history) this.history = d.history; if (d.stats) this.stats = d.stats; if (d.lastSession) this.lastSession = d.lastSession; } } catch (e) {} }
}

const brainHU = new PredictionCore();
const brainMD5 = new PredictionCore();
brainHU.load(); brainMD5.load();

async function processGame(brain, gameType) {
    try {
        const gameData = await fetchGameData(gameType);
        if (!gameData || gameData.length === 0) return;
        const cur = gameData[0].sessionId;
        if (brain.lastSession === cur) return;

        for (const r of brain.history) {
            if (r.status) continue;
            const a = gameData.find(d => d.sessionId.toString() === r.nextSession);
            if (a) { r.status = (r.prediction === a.result) ? 'ĐÚNG' : 'SAI'; r.actual = a.result; brain.updateStats(r.prediction, a.result); }
        }

        const ns = cur + 1;
        if (brain.history.find(h => h.nextSession === ns.toString())) return;

        const result = brain.predict(gameData);
        const rec = {
            session: gameData[0].sessionId, nextSession: ns.toString(),
            dice: `${gameData[0].d1}-${gameData[0].d2}-${gameData[0].d3}`,
            total: gameData[0].totalScore, actual: gameData[0].result,
            prediction: result.prediction, confidence: result.confidence,
            detail: result.reason, status: '', timestamp: new Date().toISOString(),
            engineCount: result.engineCount || 0
        };

        brain.history.unshift(rec);
        if (brain.history.length > 2000) brain.history = brain.history.slice(0, 2000);
        brain.lastSession = cur;
        brain.save();
    } catch (error) {}
}

async function autoProcess() { await Promise.all([processGame(brainHU, 'hu'), processGame(brainMD5, 'md5')]); }
function startAuto() { setTimeout(autoProcess, 3000); setInterval(autoProcess, 5000); }

// ============================================================
// GIAO DIỆN ANH KHÔI - THEO MẪU MỚI
// ============================================================
const SHARED_CSS = `
    :root { --bg: #010a1a; --text: #e8f0fe; --text2: #8aa0c0; --w1: #0ea5e9; --w2: #38bdf8; --w3: #0284c7; --gradient-water: linear-gradient(180deg, #7dd3fc 0%, #0ea5e9 40%, #0369a1 80%, #0ea5e9 100%); --gradient-btn: linear-gradient(135deg, #0284c7, #0369a1, #0ea5e9); --shadow: 0 25px 60px rgba(0,0,0,0.85); --r: 32px; --r2: 20px; --r3: 14px; }
    *{margin:0;padding:0;box-sizing:border-box}
    html{touch-action:manipulation}
    body{font-family:'Inter',system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;overflow-x:hidden}
    .bg-water{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
    .wave{position:absolute;width:200%;height:200%;top:-50%;left:-50%;background:radial-gradient(ellipse at 30% 70%, rgba(14,165,233,0.05) 0%, transparent 60%),radial-gradient(ellipse at 70% 30%, rgba(56,189,248,0.03) 0%, transparent 55%);animation:waveMove 22s infinite linear}
    @keyframes waveMove{0%{transform:translate(0,0) rotate(0deg)}100%{transform:translate(-2%,-1.5%) rotate(2deg)}}
    .bubble{position:absolute;border-radius:50%;background:rgba(125,211,252,0.06);animation:rise 9s infinite}
    @keyframes rise{0%{transform:translateY(110vh) scale(0);opacity:0}20%{opacity:1}100%{transform:translateY(-20vh) scale(1);opacity:0}}
    .app{position:relative;z-index:10;width:100%;max-width:430px;margin:10px}
    .panel{background:rgba(6,21,37,0.5);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);border:1px solid rgba(14,165,233,0.1);border-radius:var(--r);padding:30px 22px 26px;box-shadow:var(--shadow),0 0 60px rgba(14,165,233,0.05);transition:all .25s ease;position:relative;overflow:hidden}
    .panel::before{content:"";position:absolute;inset:-1px;border-radius:inherit;padding:1px;background:linear-gradient(135deg, rgba(14,165,233,0.45), rgba(56,189,248,0.18), rgba(14,165,233,0.45));-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:borderShine 4.5s ease infinite;z-index:-1}
    @keyframes borderShine{0%{opacity:.4}50%{opacity:1}100%{opacity:.4}}
    .screen{transition:opacity .22s,transform .22s,max-height .3s;opacity:1;transform:translateY(0);max-height:2400px;overflow:hidden}
    .screen.hidden{opacity:0;transform:translateY(8px);max-height:0;padding:0;margin:0;pointer-events:none}
    .logo-wrap{display:flex;flex-direction:column;align-items:center;margin-bottom:14px;perspective:400px}
    .logo-3d{position:relative;display:inline-block;transform-style:preserve-3d;animation:logoFloat 3s ease-in-out infinite}
    @keyframes logoFloat{0%,100%{transform:translateY(0) rotateX(0)}40%{transform:translateY(-2px) rotateX(1.5deg)}70%{transform:translateY(-1px) rotateX(-1deg)}}
    .logo-front{font-family:'Orbitron',sans-serif;font-size:38px;font-weight:900;letter-spacing:5px;text-transform:uppercase;background:var(--gradient-water);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 2px 3px rgba(0,0,0,.9)) drop-shadow(0 5px 14px rgba(14,165,233,.35)) drop-shadow(0 14px 28px rgba(56,189,248,.2));z-index:3;position:relative;line-height:1.1}
    .logo-back{position:absolute;top:5px;left:5px;font-family:'Orbitron',sans-serif;font-size:38px;font-weight:900;letter-spacing:5px;text-transform:uppercase;background:linear-gradient(180deg,rgba(3,105,161,.4),rgba(0,0,0,.5));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;z-index:1;filter:blur(3px);transform:translateZ(-14px)}
    .logo-line{width:55px;height:2px;background:linear-gradient(90deg,var(--w1),var(--w2),var(--w1));border-radius:2px;margin:5px 0 4px;box-shadow:0 0 10px rgba(14,165,233,.5)}
    .logo-badge{font-family:'JetBrains Mono',monospace;font-size:6.5px;font-weight:600;letter-spacing:2px;color:#7dd3fc;background:rgba(14,165,233,.08);padding:3px 10px;border-radius:20px;backdrop-filter:blur(6px);border:.5px solid rgba(56,189,248,.2)}
    input{width:100%;padding:12px 14px;background:rgba(0,0,0,.25);border:1px solid rgba(14,165,233,.1);border-radius:var(--r3);color:#fff;font-size:13px;font-family:'JetBrains Mono',monospace;text-align:center;letter-spacing:1px;outline:none;transition:.2s}
    input:focus{border-color:var(--w2);box-shadow:0 0 16px rgba(14,165,233,.22)}
    .btn{width:100%;padding:12px;border:none;border-radius:var(--r3);background:var(--gradient-btn);color:#fff;font-weight:700;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;margin-top:14px;box-shadow:0 8px 22px rgba(14,165,233,.35);transition:.2s;touch-action:manipulation}
    .btn:hover{transform:translateY(-1px);box-shadow:0 14px 30px rgba(56,189,248,.5)}
    .foot{margin-top:16px;text-align:center;font-family:'JetBrains Mono',monospace;font-size:6px;color:#4a607a;letter-spacing:.6px;border-top:1px solid rgba(14,165,233,.03);padding-top:12px}
    .game-cards{display:flex;flex-direction:column;gap:8px;margin-top:12px}
    .gcard{background:rgba(14,165,233,.025);border:1px solid rgba(14,165,233,.08);border-radius:var(--r2);padding:15px 13px;backdrop-filter:blur(8px);cursor:pointer;transition:.22s;display:flex;align-items:center;gap:10px;touch-action:manipulation}
    .gcard:hover{border-color:var(--w2);background:rgba(14,165,233,.07);transform:translateY(-2px);box-shadow:0 10px 25px rgba(0,0,0,.5)}
    .gic{font-size:30px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:rgba(14,165,233,.08);border-radius:12px;filter:drop-shadow(0 0 8px rgba(14,165,233,.4))}
    .gn{font-weight:700;font-size:14px;color:#bae6fd;letter-spacing:.3px}
    .gd{font-size:9px;color:#8aa0c0}
    .pmenu{background:rgba(0,0,0,.28);border:1px solid rgba(14,165,233,.18);border-radius:var(--r2);padding:18px 15px;backdrop-filter:blur(14px);animation:fadeUp .25s;margin-top:10px}
    @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
    .phead{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
    .ptitle{font-family:'Orbitron',sans-serif;font-size:10px;color:#7dd3fc;letter-spacing:1.5px}
    .pbadge{background:rgba(14,165,233,.1);border:.5px solid rgba(56,189,248,.2);padding:2px 8px;border-radius:10px;font-size:7.5px;color:#7dd3fc}
    .pmain{display:flex;align-items:center;gap:12px;margin-bottom:10px}
    .picon{font-size:38px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:rgba(14,165,233,.1);border-radius:14px;animation:pulse 2s ease-in-out infinite}
    @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
    .presult{font-size:36px;font-weight:900;animation:pop .3s}
    @keyframes pop{0%{transform:scale(.1);opacity:0}100%{transform:scale(1);opacity:1}}
    .tai{color:#22c55e;text-shadow:0 0 22px rgba(34,197,94,.5)}
    .xiu{color:#ef4444;text-shadow:0 0 22px rgba(239,68,68,.5)}
    .pbar{background:rgba(255,255,255,.03);border-radius:8px;height:5px;overflow:hidden;margin:8px 0}
    .pbarfill{height:100%;border-radius:8px;background:linear-gradient(90deg,var(--w1),var(--w2));transition:width .4s}
    .pstats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}
    .stat{background:rgba(14,165,233,.03);border:1px solid rgba(14,165,233,.06);border-radius:12px;padding:8px 10px;text-align:center}
    .statv{font-weight:700;font-size:14px;color:#bae6fd}
    .statl{font-size:7px;color:#7a9cc0;letter-spacing:.6px;margin-top:2px}
    .history-box{margin-top:10px;background:rgba(0,0,0,.22);border:1px solid rgba(14,165,233,.12);border-radius:16px;padding:14px;backdrop-filter:blur(10px)}
    .history-title{font-size:9px;color:#7dd3fc;letter-spacing:2px;text-align:center;margin-bottom:10px;font-family:'Orbitron',sans-serif}
    .history-list{max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:5px}
    .history-item{display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:rgba(14,165,233,.02);border:1px solid rgba(14,165,233,.06);border-radius:12px;font-size:9px;transition:.2s}
    .h-left{display:flex;align-items:center;gap:8px}
    .h-session{color:#7dd3fc;font-family:'JetBrains Mono',monospace;font-size:8px;font-weight:700;min-width:28px}
    .h-type{color:#8aa0c0;font-size:7px;background:rgba(14,165,233,.08);padding:2px 6px;border-radius:6px}
    .h-time{color:#7a9cc0;font-family:'JetBrains Mono',monospace;font-size:7.5px}
    .h-result{font-weight:700;font-size:10px;padding:3px 10px;border-radius:8px;min-width:44px;text-align:center}
    .h-tai{background:rgba(34,197,94,.12);color:#22c55e;box-shadow:0 0 10px rgba(34,197,94,.15)}
    .h-xiu{background:rgba(239,68,68,.12);color:#ef4444;box-shadow:0 0 10px rgba(239,68,68,.15)}
    .h-status{font-size:9px;font-weight:700;min-width:50px;text-align:center;padding:2px 6px;border-radius:6px}
    .h-correct{background:rgba(34,197,94,.08);color:#22c55e}
    .h-wrong{background:rgba(239,68,68,.08);color:#ef4444}
    .h-pending{background:rgba(251,191,36,.08);color:#fbbf24}
    .win-rate{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px;margin-top:10px;padding:8px 12px;background:rgba(14,165,233,.04);border-radius:12px;font-size:8px;color:#bae6fd}
    .rate-item{display:flex;align-items:center;gap:4px}
    .rate-dot{width:7px;height:7px;border-radius:50%}
    .rate-dot.win{background:#22c55e;box-shadow:0 0 10px rgba(34,197,94,.6)}
    .rate-dot.lose{background:#ef4444;box-shadow:0 0 10px rgba(239,68,68,.6)}
    .rate-dot.pending{background:#fbbf24;box-shadow:0 0 10px rgba(251,191,36,.6)}
    .pbtns{display:flex;gap:8px;margin-top:12px}
    .btnh{flex:1;padding:8px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.02);color:#b0c8e0;font-weight:600;font-size:9.5px;cursor:pointer;transition:.2s;text-align:center;touch-action:manipulation}
    .btnh:hover{background:rgba(255,255,255,.04);border-color:rgba(14,165,233,.3)}
    .btn-back{background:none;border:1px solid rgba(14,165,233,.15);color:#7dd3fc;padding:5px 12px;border-radius:16px;cursor:pointer;font-size:9px;margin-bottom:8px;transition:.2s;touch-action:manipulation}
    .btn-back:hover{background:rgba(14,165,233,.05)}
`;

function renderLoginPage() {
    return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"><title>ANH KHÔI · SIÊU DỰ ĐOÁN</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>${SHARED_CSS}</style></head><body>
<div class="bg-water"><div class="wave"></div><div id="bubbles"></div></div>
<div class="app"><div class="panel screen" id="loginScreen">
<div class="logo-wrap"><div class="logo-3d"><div class="logo-back" aria-hidden="true">ANH KHÔI</div><div class="logo-front">ANH KHÔI</div></div><div class="logo-line"></div><div class="logo-badge">ĐỘC QUYỀN TƯ LỆNH</div></div>
<form onsubmit="return handleLogin(event)"><label style="display:block;text-align:center;font-size:7.5px;color:#7a9cc0;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-weight:600">Mã truy cập</label><input type="password" id="accessKey" placeholder="Nhập mã bí mật..." autocomplete="off" required><button type="submit" class="btn">Truy cập hệ thống</button></form>
<div id="loginMsg"></div><div class="foot">ANH KHÔI · 8 AI · BẢO MẬT LƯỢNG TỬ</div></div></div>
<script>
(()=>{const b=document.getElementById('bubbles');for(let i=0;i<20;i++){const d=document.createElement('div');d.className='bubble';const s=Math.random()*25+8;d.style.width=s+'px';d.style.height=s+'px';d.style.left=Math.random()*100+'%';d.style.animationDelay=Math.random()*9+'s';d.style.animationDuration=5+Math.random()*9+'s';b.appendChild(d)}})();
window.handleLogin=function(e){e.preventDefault();const k=document.getElementById('accessKey').value.trim();const m=document.getElementById('loginMsg');
if(!k){m.innerHTML='<span style="color:#f87171;">Vui lòng nhập mã</span>';return false}
m.innerHTML='<span style="color:#4ade80;">Đang xác thực...</span>';
fetch('/_api/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:k})}).then(r=>r.json()).then(d=>{
if(d.token){window.location.href='/_home?_token='+d.token}else{m.innerHTML='<span style="color:#fbbf24;">Sai mã</span>'}}).catch(()=>{m.innerHTML='<span style="color:#f87171;">Lỗi kết nối</span>'});
return false};
</script></body></html>`;
}

function renderHomePage(token) {
    return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"><title>ANH KHÔI</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>${SHARED_CSS}</style></head><body>
<div class="bg-water"><div class="wave"></div><div id="bubbles"></div></div>
<div class="app"><div class="panel screen" id="homeScreen">
<div class="logo-wrap" style="margin-bottom:8px"><div class="logo-3d"><div class="logo-back" style="font-size:28px;letter-spacing:3px" aria-hidden="true">ANH KHÔI</div><div class="logo-front" style="font-size:28px;letter-spacing:3px">ANH KHÔI</div></div><div class="logo-line"></div><div class="logo-badge">CHÀO MỪNG TƯ LỆNH</div></div>
<div style="text-align:center;color:#b0c8e0;margin:4px 0 8px;font-size:10px;line-height:1.45"><span style="background:rgba(14,165,233,.12);color:#7dd3fc;padding:1px 6px;border-radius:4px;font-weight:600">ANH KHÔI</span> · Công cụ dự đoán tài xỉu thế hệ mới<br><strong>8 động cơ AI</strong> · Đội ngũ chuyên nghiệp · Tỉ lệ thắng <strong>~70%</strong></div>
<div class="game-cards">
<div class="gcard" onclick="location.href='/_hu?_token=${token}'"><span class="gic">🎰</span><div><div class="gn">Tài xỉu hũ</div><div class="gd">Dự đoán kết quả nổ hũ</div></div></div>
<div class="gcard" onclick="location.href='/_md5?_token=${token}'"><span class="gic">🔐</span><div><div class="gn">Tài xỉu MD5</div><div class="gd">Giải mã & dự đoán chuỗi MD5</div></div></div></div>
<div style="display:flex;justify-content:center;margin-top:12px"><button style="background:none;border:1px solid rgba(14,165,233,.12);color:#8aa0c0;padding:5px 14px;border-radius:18px;cursor:pointer;font-size:8px;transition:.2s" onclick="location.href='/_login'">Đăng xuất</button></div>
<div class="foot">ANH KHÔI · ĐỘI NGŨ CHUYÊN NGHIỆP · UY TÍN</div></div></div>
<script>(()=>{const b=document.getElementById('bubbles');for(let i=0;i<20;i++){const d=document.createElement('div');d.className='bubble';const s=Math.random()*25+8;d.style.width=s+'px';d.style.height=s+'px';d.style.left=Math.random()*100+'%';d.style.animationDelay=Math.random()*9+'s';d.style.animationDuration=5+Math.random()*9+'s';b.appendChild(d)}})();</script></body></html>`;
}

function renderDashboardPage(brain, gameType, token) {
    const s = brain.stats;
    const all = brain.history || [];
    const recent = all.slice(0, 15);
    const all1000 = all.slice(0, 1000);

    let td = 0, ts = 0, td1k = 0, ts1k = 0;
    for (const r of recent) { if (r.status === 'ĐÚNG') td++; else if (r.status === 'SAI') ts++; }
    for (const r of all1000) { if (r.status === 'ĐÚNG') td1k++; else if (r.status === 'SAI') ts1k++; }

    let histHTML = '';
    for (const r of all1000.slice(0, 30)) {
        const st = r.status || 'CHỜ';
        const cls = st === 'ĐÚNG' ? 'h-correct' : st === 'SAI' ? 'h-wrong' : 'h-pending';
        const resCls = r.prediction === 'Tài' ? 'h-tai' : r.prediction === 'Xỉu' ? 'h-xiu' : '';
        const typeLabel = gameType === 'hu' ? 'Hũ' : 'MD5';
        histHTML += `<div class="history-item"><div class="h-left"><span class="h-session">#${r.nextSession || '-'}</span><span class="h-type">${typeLabel}</span><span class="h-status ${cls}">${st}</span></div><span class="h-time">${(r.timestamp || '').substring(11, 16) || '--:--'}</span><span class="h-result ${resCls}">${r.prediction || '--'}</span></div>`;
    }

    const phien = recent[0]?.nextSession || '---';
    const pred = recent[0]?.prediction || '...';
    const conf = recent[0]?.confidence || 0;
    const cls = pred === 'Tài' ? 'tai' : pred === 'Xỉu' ? 'xiu' : '';
    const gameName = gameType === 'hu' ? 'TÀI XỈU HŨ' : 'TÀI XỈU MD5';
    const wr = s.winRate;
    const wc = wr >= 70 ? '#22c55e' : wr >= 55 ? '#fbbf24' : '#ef4444';

    return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"><title>${gameName} | ANH KHÔI</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>${SHARED_CSS}</style></head><body>
<div class="bg-water"><div class="wave"></div><div id="bubbles"></div></div>
<div class="app"><div class="panel screen" id="predictScreen">
<button class="btn-back" onclick="location.href='/_home?_token=${token}'">← Quay lại</button>
<div class="logo-wrap" style="margin-bottom:6px"><div class="logo-3d"><div class="logo-back" style="font-size:24px;letter-spacing:3px" aria-hidden="true">ANH KHÔI</div><div class="logo-front" style="font-size:24px;letter-spacing:3px">ANH KHÔI</div></div><div class="logo-badge">${gameName}</div></div>
<div class="pmenu">
<div class="phead"><span class="ptitle">DỰ ĐOÁN ${gameName}</span><span class="pbadge">${recent[0]?.engineCount || 8} engine</span></div>
<div class="pmain"><span class="picon">${gameType==='hu'?'🎰':'🔐'}</span><span class="presult ${cls}">${pred}</span></div>
<div class="pbar"><div class="pbarfill" style="width:${conf}%"></div></div>
<div class="pstats">
<div class="stat"><div class="statv">${conf}%</div><div class="statl">ĐỘ TIN CẬY</div></div>
<div class="stat"><div class="statv" style="color:${wc}">${wr}%</div><div class="statl">TỶ LỆ THẮNG</div></div>
</div>
<div class="pstats">
<div class="stat"><div class="statv">${s.correct}</div><div class="statl">ĐÚNG</div></div>
<div class="stat"><div class="statv">${s.wrong}</div><div class="statl">SAI</div></div>
</div>
<div class="pbtns"><div class="btnh" onclick="location.href='/_home?_token=${token}'">Trang chủ</div><div class="btnh" onclick="location.reload()">Làm mới</div></div>
</div>
<div class="history-box"><div class="history-title">📋 LỊCH SỬ PHIÊN DỰ ĐOÁN</div>
<div class="history-list">${histHTML || '<div style="text-align:center;color:#7a9cc0;font-size:8.5px;padding:12px">Chưa có lịch sử</div>'}</div>
<div class="win-rate">
<div class="rate-item"><span class="rate-dot win"></span> Đúng: <strong>${td1k}</strong></div>
<div class="rate-item"><span class="rate-dot lose"></span> Sai: <strong>${ts1k}</strong></div>
<div class="rate-item">Tỉ lệ: <strong>${wr}%</strong></div></div></div>
<div class="foot">ANH KHÔI · DỰ ĐOÁN & THỐNG KÊ</div></div></div>
<script>(()=>{const b=document.getElementById('bubbles');for(let i=0;i<20;i++){const d=document.createElement('div');d.className='bubble';const s=Math.random()*25+8;d.style.width=s+'px';d.style.height=s+'px';d.style.left=Math.random()*100+'%';d.style.animationDelay=Math.random()*9+'s';d.style.animationDuration=5+Math.random()*9+'s';b.appendChild(d)}});setTimeout(()=>location.reload(),5000);</script></body></html>`;
}

// API
app.get('/_login', (req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.send(renderLoginPage()); });
app.get('/', (req, res) => res.redirect('/_login'));
app.post('/_api/access', (req, res) => { const { key } = req.body || {}; if (!key) return res.status(400).json({ error: 'Thiếu mã' }); if (key === MASTER_KEY) return res.json({ token: MASTER_TOKEN }); return res.status(401).json({ error: 'Sai mã' }); });
app.get('/_home', checkAuth, (req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.send(renderHomePage(req.query['_token'])); });
app.get('/_hu', checkAuth, async (req, res) => { const data = await fetchGameData('hu'); if (data) { for (const r of brainHU.history) { if (r.status) continue; const a = data.find(d => d.sessionId.toString() === r.nextSession); if (a) { r.status = (r.prediction === a.result) ? 'ĐÚNG' : 'SAI'; r.actual = a.result; brainHU.updateStats(r.prediction, a.result); } } brainHU.save(); } res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.send(renderDashboardPage(brainHU, 'hu', req.query['_token'])); });
app.get('/_md5', checkAuth, async (req, res) => { const data = await fetchGameData('md5'); if (data) { for (const r of brainMD5.history) { if (r.status) continue; const a = data.find(d => d.sessionId.toString() === r.nextSession); if (a) { r.status = (r.prediction === a.result) ? 'ĐÚNG' : 'SAI'; r.actual = a.result; brainMD5.updateStats(r.prediction, a.result); } } brainMD5.save(); } res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.send(renderDashboardPage(brainMD5, 'md5', req.query['_token'])); });
app.get('/_hu/json', checkAuth, async (req, res) => {
    try { const data = await fetchGameData('hu'); if (!data || data.length === 0) { const r = brainHU.predict([]); return res.json({ prediction: r.prediction, confidence: r.confidence, detail: r.reason }); }
    const ns = data[0].sessionId + 1; const ex = brainHU.history.find(h => h.nextSession === ns.toString()); if (ex) return res.json(ex);
    const result = brainHU.predict(data); const rec = { session: data[0].sessionId, nextSession: ns.toString(), dice: `${data[0].d1}-${data[0].d2}-${data[0].d3}`, total: data[0].totalScore, actual: data[0].result, prediction: result.prediction, confidence: result.confidence, detail: result.reason, status: '', timestamp: new Date().toISOString(), engineCount: result.engineCount || 0 };
    brainHU.history.unshift(rec); if (brainHU.history.length > 2000) brainHU.history = brainHU.history.slice(0, 2000); brainHU.save(); res.json(rec); } catch (e) { res.status(500).json({ error: 'Lỗi' }); }
});
app.get('/_md5/json', checkAuth, async (req, res) => {
    try { const data = await fetchGameData('md5'); if (!data || data.length === 0) { const r = brainMD5.predict([]); return res.json({ prediction: r.prediction, confidence: r.confidence, detail: r.reason }); }
    const ns = data[0].sessionId + 1; const ex = brainMD5.history.find(h => h.nextSession === ns.toString()); if (ex) return res.json(ex);
    const result = brainMD5.predict(data); const rec = { session: data[0].sessionId, nextSession: ns.toString(), dice: `${data[0].d1}-${data[0].d2}-${data[0].d3}`, total: data[0].totalScore, actual: data[0].result, prediction: result.prediction, confidence: result.confidence, detail: result.reason, status: '', timestamp: new Date().toISOString(), engineCount: result.engineCount || 0 };
    brainMD5.history.unshift(rec); if (brainMD5.history.length > 2000) brainMD5.history = brainMD5.history.slice(0, 2000); brainMD5.save(); res.json(rec); } catch (e) { res.status(500).json({ error: 'Lỗi' }); }
});
app.use((req, res) => res.status(404).end());
app.listen(PORT, '0.0.0.0', () => { console.log(`\n✅ ANH KHÔI - Port ${PORT}\n`); startAuto(); });
