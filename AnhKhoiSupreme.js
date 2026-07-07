const express = require('express');
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '16kb' }));

const PORT = process.env.PORT || 10000;
const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';

const MASTER_KEY = crypto.randomBytes(4).toString('hex');
const TOKEN_STORE = new Map();
const MASTER_TOKEN = crypto.randomBytes(32).toString('hex');

TOKEN_STORE.set(MASTER_TOKEN, { role: 'admin', created: Date.now(), permanent: true });

console.log('\n==========================================');
console.log('  ANH KHOI - SIEU DU DOAN');
console.log('==========================================');
console.log('  Ma truy cap: ' + MASTER_KEY);
console.log('  Duong dan: /_login');
console.log('==========================================\n');

const checkAuth = (req, res, next) => {
    const token = req.query['_token'] || req.headers['x-token'];
    if (!token || !TOKEN_STORE.has(token)) return res.redirect('/_login');
    next();
};

app.use((req, res, next) => {
    const ip = req.ip || 'unknown';
    const publicPaths = ['/_login', '/_api/access', '/'];
    if (!publicPaths.includes(req.path)) {
        const now = Date.now();
        if (!app._ipMap) app._ipMap = new Map();
        const reqs = (app._ipMap.get(ip) || []).filter(function(t) { return now - t < 10000; });
        if (reqs.length > 60) return res.status(429).end();
        reqs.push(now);
        app._ipMap.set(ip, reqs);
    }
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Server', '');
    next();
});

function transformData(d) {
    if (!d || !d.list) return null;
    return d.list.map(function(item) {
        return {
            sessionId: item.id,
            result: item.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu',
            totalScore: item.point,
            d1: item.dices[0],
            d2: item.dices[1],
            d3: item.dices[2],
            timestamp: new Date().toISOString()
        };
    });
}

async function fetchData(type) {
    try {
        var url = type === 'hu' ? API_URL_HU : API_URL_MD5;
        var response = await axios.get(url, {
            timeout: 15000,
            headers: { 'User-Agent': 'AnhKhoi/1.0', 'Accept': 'application/json' }
        });
        return transformData(response.data);
    } catch (err) {
        return null;
    }
}

// ============================================================
// MATH HELPERS
// ============================================================
function mathMean(arr) {
    if (!arr || arr.length === 0) return 0;
    var sum = 0;
    for (var i = 0; i < arr.length; i++) sum += arr[i];
    return sum / arr.length;
}

function mathStd(arr) {
    if (!arr || arr.length < 2) return 0;
    var m = mathMean(arr);
    var sum = 0;
    for (var i = 0; i < arr.length; i++) sum += (arr[i] - m) * (arr[i] - m);
    return Math.sqrt(sum / arr.length);
}

function mathAutocorr(arr, lag) {
    if (!arr || arr.length < lag + 2) return 0;
    lag = lag || 1;
    var n = arr.length;
    var m = mathMean(arr);
    var num = 0;
    var den = 0;
    for (var i = 0; i < n; i++) den += (arr[i] - m) * (arr[i] - m);
    if (den === 0) return 0;
    for (var i = 0; i < n - lag; i++) num += (arr[i] - m) * (arr[i + lag] - m);
    return num / den;
}

function mathEntropy(arr) {
    if (!arr || arr.length === 0) return 0;
    var freq = {};
    for (var i = 0; i < arr.length; i++) {
        var key = String(arr[i]);
        freq[key] = (freq[key] || 0) + 1;
    }
    var n = arr.length;
    var e = 0;
    var keys = Object.keys(freq);
    for (var j = 0; j < keys.length; j++) {
        var p = freq[keys[j]] / n;
        if (p > 0) e -= p * Math.log2(p);
    }
    return e;
}

function mathSigmoid(x) {
    if (x > 700) return 1;
    if (x < -700) return 0;
    return 1 / (1 + Math.exp(-x));
}

function mathEma(arr, alpha) {
    if (!arr || arr.length === 0) return 0;
    alpha = alpha || 0.3;
    var e = arr[0];
    for (var i = 1; i < arr.length; i++) e = alpha * arr[i] + (1 - alpha) * e;
    return e;
}

function mathRsi(arr, period) {
    if (arr.length < period + 1) return 50;
    period = period || 14;
    var gains = 0;
    var losses = 0;
    for (var i = 0; i < period; i++) {
        var change = arr[i] - arr[i + 1];
        if (change > 0) gains += change;
        else losses -= change;
    }
    var avgG = gains / period;
    var avgL = losses / period;
    if (avgL === 0) return 100;
    return 100 - (100 / (1 + avgG / avgL));
}

function mathHurst(arr) {
    if (!arr || arr.length < 30) return 0.5;
    var n = arr.length;
    var m = mathMean(arr);
    var dev = [];
    for (var i = 0; i < n; i++) dev.push(arr[i] - m);
    var cumSum = 0;
    var rsMax = -Infinity;
    var rsMin = Infinity;
    for (var i = 0; i < n; i++) {
        cumSum += dev[i];
        if (cumSum > rsMax) rsMax = cumSum;
        if (cumSum < rsMin) rsMin = cumSum;
    }
    var r = rsMax - rsMin;
    var s = mathStd(arr);
    if (s === 0) return 0.5;
    var result = Math.log(r / s) / Math.log(n);
    if (result > 1) result = 1;
    if (result < 0) result = 0;
    return result;
}

// ============================================================
// PREDICTION CORE
// ============================================================
function PredictionCore() {
    this.history = [];
    this.stats = { total: 0, correct: 0, wrong: 0, winRate: 0 };
    this.lastSession = null;
}

PredictionCore.prototype.deepPattern = function(history) {
    if (history.length < 10) return null;
    var results = [];
    for (var i = 0; i < history.length; i++) {
        results.push(history[i].result === 'Tài' ? 'T' : 'X');
    }
    for (var depth = 3; depth <= 6; depth++) {
        if (results.length < depth + 2) continue;
        var pattern = results.slice(0, depth).join('');
        var matches = 0;
        var taiAfter = 0;
        var limit = Math.min(results.length - 1, 100);
        for (var i = depth; i < limit; i++) {
            if (results.slice(i, i + depth).join('') === pattern) {
                matches++;
                if (results[i - 1] === 'T') taiAfter++;
            }
        }
        if (matches >= 3 && Math.abs(taiAfter - matches / 2) / matches > 0.2) {
            var pred = taiAfter > matches / 2 ? 'Tài' : 'Xỉu';
            var conf = Math.min((Math.abs(taiAfter - matches / 2) / matches) * 150, 85);
            return { prediction: pred, confidence: conf, reason: '[Pattern] ' + matches + ' matches' };
        }
    }
    return null;
};

PredictionCore.prototype.bayesian = function(history) {
    if (history.length < 15) return null;
    var alpha = 1;
    var beta = 1;
    for (var i = 0; i < history.length; i++) {
        var w = Math.exp(-i / 30);
        if (history[i].result === 'Tài') alpha += w;
        else beta += w;
    }
    var prob = alpha / (alpha + beta);
    var std = Math.sqrt((alpha * beta) / ((alpha + beta) * (alpha + beta) * (alpha + beta + 1)));
    if (Math.abs(prob - 0.5) > std * 1.5) {
        return {
            prediction: prob > 0.5 ? 'Tài' : 'Xỉu',
            confidence: Math.min(Math.abs(prob - 0.5) * 200, 82),
            reason: '[Bayes] P=' + (prob * 100).toFixed(1) + '%'
        };
    }
    return null;
};

PredictionCore.prototype.neural = function(history) {
    if (history.length < 10) return null;
    var totals = [];
    var results = [];
    for (var i = 0; i < Math.min(history.length, 20); i++) {
        totals.push(history[i].totalScore || 0);
        results.push(history[i].result === 'Tài' ? 1 : 0);
    }
    var w5r = 0;
    var count = 0;
    for (var i = 0; i < Math.min(5, results.length); i++) {
        w5r += results[i];
        count++;
    }
    w5r = count > 0 ? w5r / count : 0.5;
    var score = Math.tanh((w5r - 0.5) * 3) * 0.8;
    var prob = mathSigmoid(score);
    if (Math.abs(prob - 0.5) > 0.1) {
        return {
            prediction: prob > 0.5 ? 'Tài' : 'Xỉu',
            confidence: Math.min(Math.abs(prob - 0.5) * 200, 82),
            reason: '[Neural] Score=' + score.toFixed(3)
        };
    }
    return null;
};

PredictionCore.prototype.trendBridge = function(history) {
    if (history.length < 6) return null;
    var results = [];
    for (var i = 0; i < history.length; i++) {
        results.push(history[i].result === 'Tài' ? 'T' : 'X');
    }
    var cur = results[0];
    var streak = 1;
    for (var i = 1; i < results.length && results[i] === cur; i++) streak++;
    if (streak >= 4) {
        var breakProb = Math.min(streak / 12 + 0.3, 0.85);
        return {
            prediction: breakProb > 0.6 ? (cur === 'T' ? 'Xỉu' : 'Tài') : (cur === 'T' ? 'Tài' : 'Xỉu'),
            confidence: 60 + streak * 3,
            reason: '[Trend] ' + cur + ' streak ' + streak
        };
    }
    return null;
};

PredictionCore.prototype.patternBridge = function(history) {
    if (history.length < 8) return null;
    var results = [];
    for (var i = 0; i < history.length; i++) {
        results.push(history[i].result === 'Tài' ? 'T' : 'X');
    }
    var patterns = {
        'TTXTTX': 'T',
        'XXTXXT': 'X',
        'TTXXTT': 'X',
        'XXTTXX': 'T'
    };
    var keys = Object.keys(patterns);
    for (var k = 0; k < keys.length; k++) {
        var p = keys[k];
        if (results.slice(0, p.length).join('') === p) {
            return {
                prediction: patterns[p] === 'T' ? 'Tài' : 'Xỉu',
                confidence: 68,
                reason: '[PatternBridge] ' + p
            };
        }
    }
    return null;
};

PredictionCore.prototype.phaseSpace = function(history) {
    if (history.length < 30) return null;
    var totals = [];
    for (var i = 0; i < Math.min(history.length, 50); i++) {
        totals.push(history[i].totalScore || 0);
    }
    var points = [];
    for (var i = 0; i < totals.length - 4; i++) {
        points.push([totals[i], totals[i + 2], totals[i + 4]]);
    }
    if (points.length < 5) return null;
    var last = points[points.length - 1];
    var nearestDist = Infinity;
    var nearestIdx = -1;
    for (var i = 0; i < points.length - 3; i++) {
        var dist = Math.sqrt(
            (points[i][0] - last[0]) * (points[i][0] - last[0]) +
            (points[i][1] - last[1]) * (points[i][1] - last[1]) +
            (points[i][2] - last[2]) * (points[i][2] - last[2])
        );
        if (dist < nearestDist && dist > 0.001) {
            nearestDist = dist;
            nearestIdx = i;
        }
    }
    if (nearestIdx >= 0 && nearestIdx < totals.length - 1) {
        var next = totals[nearestIdx + 1];
        return {
            prediction: next > 10.5 ? 'Tài' : 'Xỉu',
            confidence: Math.min(90 - nearestDist * 15, 80),
            reason: '[Phase] Dist=' + nearestDist.toFixed(3)
        };
    }
    return null;
};

PredictionCore.prototype.predict = function(gameData) {
    if (!gameData || gameData.length < 3) {
        return { prediction: 'Chờ dữ liệu', confidence: 0, reason: 'Cần thêm dữ liệu' };
    }

    var algos = [
        this.deepPattern(gameData),
        this.bayesian(gameData),
        this.neural(gameData),
        this.trendBridge(gameData),
        this.patternBridge(gameData),
        this.phaseSpace(gameData)
    ];

    var results = [];
    for (var i = 0; i < algos.length; i++) {
        if (algos[i]) results.push(algos[i]);
    }

    if (results.length === 0) {
        var r = [];
        for (var i = 0; i < gameData.length; i++) r.push(gameData[i].result === 'Tài' ? 'T' : 'X');
        var tCount = 0;
        for (var i = 0; i < r.length; i++) if (r[i] === 'T') tCount++;
        return {
            prediction: tCount > r.length / 2 ? 'Tài' : 'Xỉu',
            confidence: 40,
            reason: 'Xu hướng chung'
        };
    }

    var taiScore = 0;
    var xiuScore = 0;
    var totalWeight = 0;
    for (var i = 0; i < results.length; i++) {
        var w = results[i].confidence / 100;
        if (results[i].prediction === 'Tài') taiScore += w;
        else xiuScore += w;
        totalWeight += w;
    }

    var pred = taiScore > xiuScore ? 'Tài' : 'Xỉu';
    var conf = Math.round(totalWeight > 0 ? (Math.abs(taiScore - xiuScore) / totalWeight) * 100 : 50);

    return {
        prediction: pred,
        confidence: Math.min(conf, 95),
        reason: results.slice(0, 3).map(function(r) { return r.reason; }).join(' | '),
        engineCount: results.length
    };
};

PredictionCore.prototype.updateStats = function(prediction, actual) {
    var pred = prediction === 'Tài' ? 'T' : 'X';
    var act = actual === 'Tài' ? 'T' : 'X';
    this.stats.total++;
    if (pred === act) this.stats.correct++;
    else this.stats.wrong++;
    this.stats.winRate = Math.round((this.stats.correct / this.stats.total) * 100);
};

PredictionCore.prototype.save = function() {
    try {
        var data = JSON.stringify({
            history: this.history.slice(0, 2000),
            stats: this.stats,
            lastSession: this.lastSession
        });
        fs.writeFileSync('.' + this.gameType + '_data', data, 'utf8');
    } catch (e) {}
};

PredictionCore.prototype.load = function() {
    try {
        var filePath = '.' + this.gameType + '_data';
        if (fs.existsSync(filePath)) {
            var data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (data.history) this.history = data.history;
            if (data.stats) this.stats = data.stats;
            if (data.lastSession) this.lastSession = data.lastSession;
        }
    } catch (e) {}
};

var brainHU = new PredictionCore();
brainHU.gameType = 'hu';
brainHU.load();

var brainMD5 = new PredictionCore();
brainMD5.gameType = 'md5';
brainMD5.load();

async function processGame(brain, gameType) {
    try {
        var gameData = await fetchData(gameType);
        if (!gameData || gameData.length === 0) return;

        var cur = gameData[0].sessionId;
        if (brain.lastSession === cur) return;

        for (var i = 0; i < brain.history.length; i++) {
            var r = brain.history[i];
            if (r.status && r.status !== '') continue;
            var a = null;
            for (var j = 0; j < gameData.length; j++) {
                if (gameData[j].sessionId.toString() === r.nextSession) { a = gameData[j]; break; }
            }
            if (a) {
                r.status = (r.prediction === a.result) ? 'ĐÚNG' : 'SAI';
                r.actual = a.result;
                brain.updateStats(r.prediction, a.result);
            }
        }

        var ns = cur + 1;
        var exists = false;
        for (var i = 0; i < brain.history.length; i++) {
            if (brain.history[i].nextSession === ns.toString()) { exists = true; break; }
        }
        if (exists) return;

        var result = brain.predict(gameData);
        var rec = {
            session: gameData[0].sessionId,
            nextSession: ns.toString(),
            dice: gameData[0].d1 + '-' + gameData[0].d2 + '-' + gameData[0].d3,
            total: gameData[0].totalScore,
            actual: gameData[0].result,
            prediction: result.prediction,
            confidence: result.confidence,
            detail: result.reason,
            status: '',
            timestamp: new Date().toISOString(),
            engineCount: result.engineCount || 0
        };

        brain.history.unshift(rec);
        if (brain.history.length > 2000) brain.history = brain.history.slice(0, 2000);
        brain.lastSession = cur;
        brain.save();
    } catch (err) {}
}

async function autoProcess() {
    await Promise.all([processGame(brainHU, 'hu'), processGame(brainMD5, 'md5')]);
}

function startAuto() {
    setTimeout(autoProcess, 3000);
    setInterval(autoProcess, 5000);
}

// ============================================================
// CSS SHARED
// ============================================================
var SHARED_CSS = ':root{--bg:#010a1a;--text:#e8f0fe;--text2:#8aa0c0;--w1:#0ea5e9;--w2:#38bdf8;--w3:#0284c7;--gradient-water:linear-gradient(180deg,#7dd3fc 0%,#0ea5e9 40%,#0369a1 80%,#0ea5e9 100%);--gradient-btn:linear-gradient(135deg,#0284c7,#0369a1,#0ea5e9);--shadow:0 25px 60px rgba(0,0,0,0.85);--r:32px;--r2:20px;--r3:14px}*{margin:0;padding:0;box-sizing:border-box}html{touch-action:manipulation}body{font-family:"Inter",system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;overflow-x:hidden}.bg-water{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}.wave{position:absolute;width:200%;height:200%;top:-50%;left:-50%;background:radial-gradient(ellipse at 30% 70%,rgba(14,165,233,0.05) 0%,transparent 60%),radial-gradient(ellipse at 70% 30%,rgba(56,189,248,0.03) 0%,transparent 55%);animation:waveMove 22s infinite linear}@keyframes waveMove{0%{transform:translate(0,0) rotate(0deg)}100%{transform:translate(-2%,-1.5%) rotate(2deg)}}.bubble{position:absolute;border-radius:50%;background:rgba(125,211,252,0.06);animation:rise 9s infinite}@keyframes rise{0%{transform:translateY(110vh) scale(0);opacity:0}20%{opacity:1}100%{transform:translateY(-20vh) scale(1);opacity:0}}.app{position:relative;z-index:10;width:100%;max-width:430px;margin:10px}.panel{background:rgba(6,21,37,0.5);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);border:1px solid rgba(14,165,233,0.1);border-radius:var(--r);padding:30px 22px 26px;box-shadow:var(--shadow),0 0 60px rgba(14,165,233,0.05);transition:all .25s ease;position:relative;overflow:hidden}.panel::before{content:"";position:absolute;inset:-1px;border-radius:inherit;padding:1px;background:linear-gradient(135deg,rgba(14,165,233,0.45),rgba(56,189,248,0.18),rgba(14,165,233,0.45));-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:borderShine 4.5s ease infinite;z-index:-1}@keyframes borderShine{0%{opacity:.4}50%{opacity:1}100%{opacity:.4}}.logo-wrap{display:flex;flex-direction:column;align-items:center;margin-bottom:14px;perspective:400px}.logo-3d{position:relative;display:inline-block;transform-style:preserve-3d;animation:logoFloat 3s ease-in-out infinite}@keyframes logoFloat{0%,100%{transform:translateY(0) rotateX(0)}40%{transform:translateY(-2px) rotateX(1.5deg)}70%{transform:translateY(-1px) rotateX(-1deg)}}.logo-front{font-family:"Orbitron",sans-serif;font-size:38px;font-weight:900;letter-spacing:5px;text-transform:uppercase;background:var(--gradient-water);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 2px 3px rgba(0,0,0,.9)) drop-shadow(0 5px 14px rgba(14,165,233,.35)) drop-shadow(0 14px 28px rgba(56,189,248,.2));z-index:3;position:relative;line-height:1.1}.logo-back{position:absolute;top:5px;left:5px;font-family:"Orbitron",sans-serif;font-size:38px;font-weight:900;letter-spacing:5px;text-transform:uppercase;background:linear-gradient(180deg,rgba(3,105,161,.4),rgba(0,0,0,.5));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;z-index:1;filter:blur(3px);transform:translateZ(-14px)}.logo-line{width:55px;height:2px;background:linear-gradient(90deg,var(--w1),var(--w2),var(--w1));border-radius:2px;margin:5px 0 4px;box-shadow:0 0 10px rgba(14,165,233,.5)}.logo-badge{font-family:"JetBrains Mono",monospace;font-size:6.5px;font-weight:600;letter-spacing:2px;color:#7dd3fc;background:rgba(14,165,233,.08);padding:3px 10px;border-radius:20px;backdrop-filter:blur(6px);border:.5px solid rgba(56,189,248,.2)}input{width:100%;padding:12px 14px;background:rgba(0,0,0,.25);border:1px solid rgba(14,165,233,.1);border-radius:var(--r3);color:#fff;font-size:13px;font-family:"JetBrains Mono",monospace;text-align:center;letter-spacing:1px;outline:none;transition:.2s}input:focus{border-color:var(--w2);box-shadow:0 0 16px rgba(14,165,233,.22)}.btn{width:100%;padding:12px;border:none;border-radius:var(--r3);background:var(--gradient-btn);color:#fff;font-weight:700;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;margin-top:14px;box-shadow:0 8px 22px rgba(14,165,233,.35);transition:.2s;touch-action:manipulation}.btn:hover{transform:translateY(-1px);box-shadow:0 14px 30px rgba(56,189,248,.5)}.foot{margin-top:16px;text-align:center;font-family:"JetBrains Mono",monospace;font-size:6px;color:#4a607a;letter-spacing:.6px;border-top:1px solid rgba(14,165,233,.03);padding-top:12px}.game-cards{display:flex;flex-direction:column;gap:8px;margin-top:12px}.gcard{background:rgba(14,165,233,.025);border:1px solid rgba(14,165,233,.08);border-radius:var(--r2);padding:15px 13px;backdrop-filter:blur(8px);cursor:pointer;transition:.22s;display:flex;align-items:center;gap:10px;touch-action:manipulation}.gcard:hover{border-color:var(--w2);background:rgba(14,165,233,.07);transform:translateY(-2px);box-shadow:0 10px 25px rgba(0,0,0,.5)}.gic{font-size:30px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:rgba(14,165,233,.08);border-radius:12px;filter:drop-shadow(0 0 8px rgba(14,165,233,.4))}.gn{font-weight:700;font-size:14px;color:#bae6fd;letter-spacing:.3px}.gd{font-size:9px;color:#8aa0c0}.pmenu{background:rgba(0,0,0,.28);border:1px solid rgba(14,165,233,.18);border-radius:var(--r2);padding:18px 15px;backdrop-filter:blur(14px);animation:fadeUp .25s;margin-top:10px}@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}.phead{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.ptitle{font-family:"Orbitron",sans-serif;font-size:10px;color:#7dd3fc;letter-spacing:1.5px}.pbadge{background:rgba(14,165,233,.1);border:.5px solid rgba(56,189,248,.2);padding:2px 8px;border-radius:10px;font-size:7.5px;color:#7dd3fc}.pmain{display:flex;align-items:center;gap:12px;margin-bottom:10px}.picon{font-size:38px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:rgba(14,165,233,.1);border-radius:14px;animation:pulse 2s ease-in-out infinite}@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}.presult{font-size:36px;font-weight:900;animation:pop .3s}@keyframes pop{0%{transform:scale(.1);opacity:0}100%{transform:scale(1);opacity:1}}.tai{color:#22c55e;text-shadow:0 0 22px rgba(34,197,94,.5)}.xiu{color:#ef4444;text-shadow:0 0 22px rgba(239,68,68,.5)}.pbar{background:rgba(255,255,255,.03);border-radius:8px;height:5px;overflow:hidden;margin:8px 0}.pbarfill{height:100%;border-radius:8px;background:linear-gradient(90deg,var(--w1),var(--w2));transition:width .4s}.pstats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}.stat{background:rgba(14,165,233,.03);border:1px solid rgba(14,165,233,.06);border-radius:12px;padding:8px 10px;text-align:center}.statv{font-weight:700;font-size:14px;color:#bae6fd}.statl{font-size:7px;color:#7a9cc0;letter-spacing:.6px;margin-top:2px}.history-box{margin-top:10px;background:rgba(0,0,0,.22);border:1px solid rgba(14,165,233,.12);border-radius:16px;padding:14px;backdrop-filter:blur(10px)}.history-title{font-size:9px;color:#7dd3fc;letter-spacing:2px;text-align:center;margin-bottom:10px;font-family:"Orbitron",sans-serif}.history-list{max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:5px}.history-item{display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:rgba(14,165,233,.02);border:1px solid rgba(14,165,233,.06);border-radius:12px;font-size:9px;transition:.2s}.h-left{display:flex;align-items:center;gap:8px}.h-session{color:#7dd3fc;font-family:"JetBrains Mono",monospace;font-size:8px;font-weight:700;min-width:28px}.h-type{color:#8aa0c0;font-size:7px;background:rgba(14,165,233,.08);padding:2px 6px;border-radius:6px}.h-time{color:#7a9cc0;font-family:"JetBrains Mono",monospace;font-size:7.5px}.h-result{font-weight:700;font-size:10px;padding:3px 10px;border-radius:8px;min-width:44px;text-align:center}.h-tai{background:rgba(34,197,94,.12);color:#22c55e;box-shadow:0 0 10px rgba(34,197,94,.15)}.h-xiu{background:rgba(239,68,68,.12);color:#ef4444;box-shadow:0 0 10px rgba(239,68,68,.15)}.h-status{font-size:9px;font-weight:700;min-width:50px;text-align:center;padding:2px 6px;border-radius:6px}.h-correct{background:rgba(34,197,94,.08);color:#22c55e}.h-wrong{background:rgba(239,68,68,.08);color:#ef4444}.h-pending{background:rgba(251,191,36,.08);color:#fbbf24}.win-rate{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px;margin-top:10px;padding:8px 12px;background:rgba(14,165,233,.04);border-radius:12px;font-size:8px;color:#bae6fd}.rate-item{display:flex;align-items:center;gap:4px}.rate-dot{width:7px;height:7px;border-radius:50%}.rate-dot.win{background:#22c55e;box-shadow:0 0 10px rgba(34,197,94,.6)}.rate-dot.lose{background:#ef4444;box-shadow:0 0 10px rgba(239,68,68,.6)}.rate-dot.pending{background:#fbbf24;box-shadow:0 0 10px rgba(251,191,36,.6)}.pbtns{display:flex;gap:8px;margin-top:12px}.btnh{flex:1;padding:8px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.02);color:#b0c8e0;font-weight:600;font-size:9.5px;cursor:pointer;transition:.2s;text-align:center;touch-action:manipulation}.btnh:hover{background:rgba(255,255,255,.04);border-color:rgba(14,165,233,.3)}.btn-back{background:none;border:1px solid rgba(14,165,233,.15);color:#7dd3fc;padding:5px 12px;border-radius:16px;cursor:pointer;font-size:9px;margin-bottom:8px;transition:.2s;touch-action:manipulation}.btn-back:hover{background:rgba(14,165,233,.05)}';

function renderLoginPage() {
    var bubblesJS = '';
    for (var i = 0; i < 20; i++) {
        var size = Math.floor(Math.random() * 25) + 8;
        var left = Math.floor(Math.random() * 100);
        var delay = (Math.random() * 9).toFixed(2);
        var duration = (5 + Math.random() * 9).toFixed(2);
        bubblesJS += '<div class="bubble" style="width:' + size + 'px;height:' + size + 'px;left:' + left + '%;animation-delay:' + delay + 's;animation-duration:' + duration + 's"></div>';
    }

    return '<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"><title>ANH KHOI</title><link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>' + SHARED_CSS + '</style></head><body><div class="bg-water"><div class="wave"></div>' + bubblesJS + '</div><div class="app"><div class="panel"><div class="logo-wrap"><div class="logo-3d"><div class="logo-back">ANH KHOI</div><div class="logo-front">ANH KHOI</div></div><div class="logo-line"></div><div class="logo-badge">DOC QUYEN TU LENH</div></div><form onsubmit="return doLogin(event)"><label style="display:block;text-align:center;font-size:7.5px;color:#7a9cc0;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-weight:600">Ma truy cap</label><input type="password" id="accessKey" placeholder="Nhap ma bi mat..." autocomplete="off" required><button type="submit" class="btn">Truy cap he thong</button></form><div id="loginMsg"></div><div class="foot">ANH KHOI · 6 AI · BAO MAT</div></div></div><script>function doLogin(e){e.preventDefault();var k=document.getElementById("accessKey").value.trim();var m=document.getElementById("loginMsg");if(!k){m.innerHTML="<span style=\\"color:#f87171\\">Vui long nhap ma</span>";return false}m.innerHTML="<span style=\\"color:#4ade80\\">Dang xac thuc...</span>";fetch("/_api/access",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:k})}).then(function(r){return r.json()}).then(function(d){if(d.token){window.location.href="/_home?_token="+d.token}else{m.innerHTML="<span style=\\"color:#fbbf24\\">Sai ma</span>"}}).catch(function(){m.innerHTML="<span style=\\"color:#f87171\\">Loi ket noi</span>"});return false}</script></body></html>';
}

function renderHomePage(token) {
    var bubblesJS = '';
    for (var i = 0; i < 20; i++) {
        var size = Math.floor(Math.random() * 25) + 8;
        var left = Math.floor(Math.random() * 100);
        var delay = (Math.random() * 9).toFixed(2);
        var duration = (5 + Math.random() * 9).toFixed(2);
        bubblesJS += '<div class="bubble" style="width:' + size + 'px;height:' + size + 'px;left:' + left + '%;animation-delay:' + delay + 's;animation-duration:' + duration + 's"></div>';
    }

    return '<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"><title>ANH KHOI</title><link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>' + SHARED_CSS + '</style></head><body><div class="bg-water"><div class="wave"></div>' + bubblesJS + '</div><div class="app"><div class="panel"><div class="logo-wrap" style="margin-bottom:8px"><div class="logo-3d"><div class="logo-back" style="font-size:28px;letter-spacing:3px">ANH KHOI</div><div class="logo-front" style="font-size:28px;letter-spacing:3px">ANH KHOI</div></div><div class="logo-line"></div><div class="logo-badge">CHAO MUNG TU LENH</div></div><div style="text-align:center;color:#b0c8e0;margin:4px 0 8px;font-size:10px;line-height:1.45"><span style="background:rgba(14,165,233,.12);color:#7dd3fc;padding:1px 6px;border-radius:4px;font-weight:600">ANH KHOI</span> · Cong cu du doan tai xiu the he moi<br><strong>6 dong co AI</strong> · Ti le thang <strong>~70%</strong></div><div class="game-cards"><div class="gcard" onclick="location.href=\'/_hu?_token=' + token + '\'"><span class="gic">🎰</span><div><div class="gn">Tai xiu hu</div><div class="gd">Du doan ket qua no hu</div></div></div><div class="gcard" onclick="location.href=\'/_md5?_token=' + token + '\'"><span class="gic">🔐</span><div><div class="gn">Tai xiu MD5</div><div class="gd">Giai ma & du doan chuoi MD5</div></div></div></div><div style="display:flex;justify-content:center;margin-top:12px"><button style="background:none;border:1px solid rgba(14,165,233,.12);color:#8aa0c0;padding:5px 14px;border-radius:18px;cursor:pointer;font-size:8px;transition:.2s" onclick="location.href=\'/_login\'">Dang xuat</button></div><div class="foot">ANH KHOI · DOI NGU CHUYEN NGHIEP</div></div></div></body></html>';
}

function renderDashboardPage(brain, gameType, token) {
    var s = brain.stats;
    var all = brain.history || [];
    var recent = all.slice(0, 15);
    var all1000 = all.slice(0, 1000);

    var td = 0, ts = 0, td1k = 0, ts1k = 0;
    for (var i = 0; i < recent.length; i++) {
        if (recent[i].status === 'ĐÚNG') td++;
        else if (recent[i].status === 'SAI') ts++;
    }
    for (var i = 0; i < all1000.length; i++) {
        if (all1000[i].status === 'ĐÚNG') td1k++;
        else if (all1000[i].status === 'SAI') ts1k++;
    }

    var histHTML = '';
    for (var i = 0; i < Math.min(all1000.length, 30); i++) {
        var r = all1000[i];
        var st = r.status || 'CHỜ';
        var cls = st === 'ĐÚNG' ? 'h-correct' : st === 'SAI' ? 'h-wrong' : 'h-pending';
        var resCls = r.prediction === 'Tài' ? 'h-tai' : r.prediction === 'Xỉu' ? 'h-xiu' : '';
        var typeLabel = gameType === 'hu' ? 'Hũ' : 'MD5';
        histHTML += '<div class="history-item"><div class="h-left"><span class="h-session">#' + (r.nextSession || '-') + '</span><span class="h-type">' + typeLabel + '</span><span class="h-status ' + cls + '">' + st + '</span></div><span class="h-time">' + ((r.timestamp || '').substring(11, 16) || '--:--') + '</span><span class="h-result ' + resCls + '">' + (r.prediction || '--') + '</span></div>';
    }

    var phien = recent.length > 0 ? (recent[0].nextSession || '---') : '---';
    var pred = recent.length > 0 ? (recent[0].prediction || '...') : '...';
    var conf = recent.length > 0 ? (recent[0].confidence || 0) : 0;
    var cls = pred === 'Tài' ? 'tai' : pred === 'Xỉu' ? 'xiu' : '';
    var gameName = gameType === 'hu' ? 'TAI XIU HU' : 'TAI XIU MD5';
    var wr = s.winRate;
    var wc = wr >= 70 ? '#22c55e' : wr >= 55 ? '#fbbf24' : '#ef4444';

    var bubblesJS = '';
    for (var i = 0; i < 20; i++) {
        var size = Math.floor(Math.random() * 25) + 8;
        var left = Math.floor(Math.random() * 100);
        var delay = (Math.random() * 9).toFixed(2);
        var duration = (5 + Math.random() * 9).toFixed(2);
        bubblesJS += '<div class="bubble" style="width:' + size + 'px;height:' + size + 'px;left:' + left + '%;animation-delay:' + delay + 's;animation-duration:' + duration + 's"></div>';
    }

    return '<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"><title>' + gameName + ' | ANH KHOI</title><link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>' + SHARED_CSS + '</style></head><body><div class="bg-water"><div class="wave"></div>' + bubblesJS + '</div><div class="app"><div class="panel"><button class="btn-back" onclick="location.href=\'/_home?_token=' + token + '\'">← Quay lai</button><div class="logo-wrap" style="margin-bottom:6px"><div class="logo-3d"><div class="logo-back" style="font-size:24px;letter-spacing:3px">ANH KHOI</div><div class="logo-front" style="font-size:24px;letter-spacing:3px">ANH KHOI</div></div><div class="logo-badge">' + gameName + '</div></div><div class="pmenu"><div class="phead"><span class="ptitle">DU DOAN ' + gameName + '</span><span class="pbadge">' + (recent.length > 0 ? (recent[0].engineCount || 6) : 6) + ' engine</span></div><div class="pmain"><span class="picon">' + (gameType === 'hu' ? '🎰' : '🔐') + '</span><span class="presult ' + cls + '">' + pred + '</span></div><div class="pbar"><div class="pbarfill" style="width:' + conf + '%"></div></div><div class="pstats"><div class="stat"><div class="statv">' + conf + '%</div><div class="statl">DO TIN CAY</div></div><div class="stat"><div class="statv" style="color:' + wc + '">' + wr + '%</div><div class="statl">TY LE THANG</div></div></div><div class="pstats"><div class="stat"><div class="statv">' + s.correct + '</div><div class="statl">DUNG</div></div><div class="stat"><div class="statv">' + s.wrong + '</div><div class="statl">SAI</div></div></div><div class="pbtns"><div class="btnh" onclick="location.href=\'/_home?_token=' + token + '\'">Trang chu</div><div class="btnh" onclick="location.reload()">Lam moi</div></div></div><div class="history-box"><div class="history-title">📋 LICH SU PHIEN DU DOAN</div><div class="history-list">' + (histHTML || '<div style="text-align:center;color:#7a9cc0;font-size:8.5px;padding:12px">Chua co lich su</div>') + '</div><div class="win-rate"><div class="rate-item"><span class="rate-dot win"></span> Dung: <strong>' + td1k + '</strong></div><div class="rate-item"><span class="rate-dot lose"></span> Sai: <strong>' + ts1k + '</strong></div><div class="rate-item">Ti le: <strong>' + wr + '%</strong></div></div></div><div class="foot">ANH KHOI · DU DOAN & THONG KE</div></div></div><script>setTimeout(function(){location.reload()},5000);</script></body></html>';
}

// API ENDPOINTS
app.get('/_login', function(req, res) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderLoginPage());
});

app.get('/', function(req, res) {
    res.redirect('/_login');
});

app.post('/_api/access', function(req, res) {
    var key = (req.body || {}).key;
    if (!key) return res.status(400).json({ error: 'Thiếu mã' });
    if (key === MASTER_KEY) return res.json({ token: MASTER_TOKEN });
    return res.status(401).json({ error: 'Sai mã' });
});

app.get('/_home', checkAuth, function(req, res) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderHomePage(req.query['_token']));
});

app.get('/_hu', checkAuth, async function(req, res) {
    var data = await fetchData('hu');
    if (data) {
        for (var i = 0; i < brainHU.history.length; i++) {
            var r = brainHU.history[i];
            if (r.status && r.status !== '') continue;
            var a = null;
            for (var j = 0; j < data.length; j++) {
                if (data[j].sessionId.toString() === r.nextSession) { a = data[j]; break; }
            }
            if (a) {
                r.status = (r.prediction === a.result) ? 'ĐÚNG' : 'SAI';
                r.actual = a.result;
                brainHU.updateStats(r.prediction, a.result);
            }
        }
        brainHU.save();
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderDashboardPage(brainHU, 'hu', req.query['_token']));
});

app.get('/_md5', checkAuth, async function(req, res) {
    var data = await fetchData('md5');
    if (data) {
        for (var i = 0; i < brainMD5.history.length; i++) {
            var r = brainMD5.history[i];
            if (r.status && r.status !== '') continue;
            var a = null;
            for (var j = 0; j < data.length; j++) {
                if (data[j].sessionId.toString() === r.nextSession) { a = data[j]; break; }
            }
            if (a) {
                r.status = (r.prediction === a.result) ? 'ĐÚNG' : 'SAI';
                r.actual = a.result;
                brainMD5.updateStats(r.prediction, a.result);
            }
        }
        brainMD5.save();
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderDashboardPage(brainMD5, 'md5', req.query['_token']));
});

app.get('/_hu/json', checkAuth, async function(req, res) {
    try {
        var data = await fetchData('hu');
        if (!data || data.length === 0) {
            var r = brainHU.predict([]);
            return res.json({ prediction: r.prediction, confidence: r.confidence, detail: r.reason });
        }
        var ns = data[0].sessionId + 1;
        for (var i = 0; i < brainHU.history.length; i++) {
            if (brainHU.history[i].nextSession === ns.toString()) return res.json(brainHU.history[i]);
        }
        var result = brainHU.predict(data);
        var rec = {
            session: data[0].sessionId, nextSession: ns.toString(),
            dice: data[0].d1 + '-' + data[0].d2 + '-' + data[0].d3,
            total: data[0].totalScore, actual: data[0].result,
            prediction: result.prediction, confidence: result.confidence,
            detail: result.reason, status: '',
            timestamp: new Date().toISOString(), engineCount: result.engineCount || 0
        };
        brainHU.history.unshift(rec);
        if (brainHU.history.length > 2000) brainHU.history = brainHU.history.slice(0, 2000);
        brainHU.save();
        res.json(rec);
    } catch (e) { res.status(500).json({ error: 'Lỗi' }); }
});

app.get('/_md5/json', checkAuth, async function(req, res) {
    try {
        var data = await fetchData('md5');
        if (!data || data.length === 0) {
            var r = brainMD5.predict([]);
            return res.json({ prediction: r.prediction, confidence: r.confidence, detail: r.reason });
        }
        var ns = data[0].sessionId + 1;
        for (var i = 0; i < brainMD5.history.length; i++) {
            if (brainMD5.history[i].nextSession === ns.toString()) return res.json(brainMD5.history[i]);
        }
        var result = brainMD5.predict(data);
        var rec = {
            session: data[0].sessionId, nextSession: ns.toString(),
            dice: data[0].d1 + '-' + data[0].d2 + '-' + data[0].d3,
            total: data[0].totalScore, actual: data[0].result,
            prediction: result.prediction, confidence: result.confidence,
            detail: result.reason, status: '',
            timestamp: new Date().toISOString(), engineCount: result.engineCount || 0
        };
        brainMD5.history.unshift(rec);
        if (brainMD5.history.length > 2000) brainMD5.history = brainMD5.history.slice(0, 2000);
        brainMD5.save();
        res.json(rec);
    } catch (e) { res.status(500).json({ error: 'Lỗi' }); }
});

app.use(function(req, res) {
    res.status(404).end();
});

app.listen(PORT, '0.0.0.0', function() {
    console.log('\n✅ ANH KHOI da khoi dong - Cong ' + PORT + '\n');
    startAuto();
});
