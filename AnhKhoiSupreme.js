const express = require('express');
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

const PORT = process.env.PORT || 5000;

const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';

// ============================================================
// 🔐 HỆ THỐNG QUẢN LÝ NGƯỜI DÙNG + ADMIN VIP
// ============================================================
const USERS_FILE = '.users_vault';
const ADMIN_FILE = '.admin_vault';

// Admin mặc định
const DEFAULT_ADMIN = {
    username: 'admin',
    password: crypto.randomBytes(12).toString('hex'),
    role: 'admin',
    devices: 'unlimited',
    created: Date.now(),
    expires: 0 // 0 = không bao giờ hết hạn
};

let users = {};
let adminConfig = DEFAULT_ADMIN;

// Load users
try {
    if (fs.existsSync(USERS_FILE)) {
        const d = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        users = d.users || {};
        adminConfig = d.admin || DEFAULT_ADMIN;
    } else {
        users = {};
        adminConfig = DEFAULT_ADMIN;
        saveUsers();
    }
} catch (e) {
    users = {};
    adminConfig = DEFAULT_ADMIN;
}

function saveUsers() {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify({ users, admin: adminConfig }, null, 2));
    } catch (e) {}
}

console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║  💎 CRYSTAL TX - HỆ THỐNG QUẢN LÝ VIP              ║');
console.log('╠══════════════════════════════════════════════════════╣');
console.log(`║  👑 ADMIN: ${adminConfig.username}                          ║`);
console.log(`║  🔑 PASS: ${adminConfig.password}                    ║`);
console.log('╠══════════════════════════════════════════════════════╣');
console.log('║  🌐 Truy cập: /_login                               ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

// Token system
const TOKENS = new Map();
const DEVICE_SESSIONS = new Map();

function generateToken(username, role, maxDevices) {
    const token = crypto.randomBytes(64).toString('hex');
    TOKENS.set(token, {
        username,
        role,
        maxDevices,
        devices: new Set(),
        created: Date.now(),
        expires: role === 'admin' ? 0 : (Date.now() + getExpiryTime(username))
    });
    return token;
}

function getExpiryTime(username) {
    const user = users[username];
    if (!user || !user.expires) return 86400000; // 24h mặc định
    return user.expires - Date.now();
}

// Middleware xác thực
const requireAuth = (req, res, next) => {
    const token = req.headers['x-token'] || req.query['_token'] || req.query['_admin'];
    if (!token || !TOKENS.has(token)) {
        if (req.headers['accept']?.includes('application/json')) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        return res.redirect('/_login?error=unauthorized');
    }
    
    const session = TOKENS.get(token);
    
    // Check expiry
    if (session.expires > 0 && Date.now() > session.expires) {
        TOKENS.delete(token);
        if (req.headers['accept']?.includes('application/json')) {
            return res.status(403).json({ error: 'Token expired' });
        }
        return res.redirect('/_login?error=expired');
    }
    
    // Check user exists (for non-admin)
    if (session.role !== 'admin') {
        const user = users[session.username];
        if (!user) {
            TOKENS.delete(token);
            return res.status(403).json({ error: 'User not found' });
        }
        if (user.expires > 0 && Date.now() > user.expires) {
            TOKENS.delete(token);
            return res.status(403).json({ error: 'Account expired' });
        }
    }
    
    req.session = session;
    next();
};

const requireAdmin = (req, res, next) => {
    if (!req.session || req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Admin only' });
    }
    next();
};

// ============================================================
// 🛡️ BẢO MẬT TỐI ĐA
// ============================================================
const ipTracker = new Map();
const BLACKLIST = new Set();
const SUSPICIOUS = new Map();

app.use((req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const publicPaths = ['/_login', '/_api/login', '/'];
    
    if (!publicPaths.includes(req.path)) {
        if (BLACKLIST.has(ip)) return res.status(403).end();
        
        const now = Date.now();
        if (!ipTracker.has(ip)) ipTracker.set(ip, []);
        const requests = ipTracker.get(ip).filter(t => now - t < 10000);
        
        if (requests.length > 60) {
            SUSPICIOUS.set(ip, (SUSPICIOUS.get(ip) || 0) + 1);
            if (SUSPICIOUS.get(ip) > 5) {
                BLACKLIST.add(ip);
                console.log(`🚫 IP BLOCKED: ${ip}`);
            }
            return res.status(429).end();
        }
        requests.push(now);
        ipTracker.set(ip, requests);
    }
    
    // Chống SQL Injection, XSS
    if (req.query) {
        const dangerous = ['<', '>', 'script', 'onerror', 'onload', 'javascript:', 'union', 'select', 'insert', 'update', 'delete', 'drop', 'exec', 'eval', 'alert'];
        for (const [k, v] of Object.entries(req.query)) {
            if (dangerous.some(d => String(v).toLowerCase().includes(d))) return res.status(403).end();
        }
    }
    
    // Chặn User-Agent độc hại
    const ua = (req.get('User-Agent') || '').toLowerCase();
    const blockedUA = ['sqlmap', 'nikto', 'nmap', 'burp', 'acunetix', 'nessus', 'metasploit', 'hydra', 'gobuster', 'dirbuster', 'wpscan', 'zap', 'scanner', 'bot', 'crawler', 'spider'];
    if (blockedUA.some(b => ua.includes(b))) {
        BLACKLIST.add(ip);
        return res.status(403).end();
    }
    
    // Chặn path độc hại
    const blockedPaths = ['/admin', '/wp-admin', '/phpmyadmin', '/.env', '/.git', '/wp-login', '/xmlrpc.php', '/config', '/backup'];
    if (blockedPaths.some(b => req.path.toLowerCase().startsWith(b))) return res.status(404).end();
    
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Server', '');
    
    next();
});

// ============================================================
// 🧬 5 THUẬT TOÁN SIÊU CHÍNH XÁC
// ============================================================

class QuantumEnsembleV9 {
    constructor() {
        this.qubitStates = new Map();
        this.entanglement = new Map();
        this.superposition = new Map();
        this.trained = false;
        this.quantumNoise = 0.02;
        this.phaseAngle = 0;
    }
    
    quantumState(input) {
        this.phaseAngle = (this.phaseAngle + 0.1) % (2 * Math.PI);
        return input.map(x => {
            const real = Math.sin(x * Math.PI + this.phaseAngle);
            const imag = Math.cos(x * Math.PI + this.phaseAngle);
            return { real, imag };
        });
    }
    
    measure(state) {
        const prob = state.reduce((sum, s) => sum + s.real * s.real, 0) / state.length;
        const threshold = 0.5 + this.quantumNoise * (Math.sin(this.phaseAngle) * 0.5 + 0.5);
        return { prob: prob, prediction: prob > threshold ? 'T' : 'X' };
    }
    
    train(data) {
        for (let i = 50; i < data.length; i++) {
            const window = data.slice(i - 50, i);
            const features = window.map(s => s === 'T' ? 1 : 0);
            const key = features.slice(0, 8).map(v => Math.round(v * 10)).join('|');
            const target = data[i];
            
            if (!this.qubitStates.has(key)) {
                this.qubitStates.set(key, { T: 0, X: 0, total: 0 });
                this.entanglement.set(key, 0.5);
                this.superposition.set(key, 0.5);
            }
            
            const state = this.qubitStates.get(key);
            state[target] = (state[target] || 0) + 1;
            state.total++;
            this.entanglement.set(key, Math.min(0.98, this.entanglement.get(key) + 0.015));
            this.superposition.set(key, Math.min(0.95, this.superposition.get(key) + 0.01));
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 50) return null;
        const window = seq.slice(-50);
        const features = window.map(s => s === 'T' ? 1 : 0);
        const key = features.slice(0, 8).map(v => Math.round(v * 10)).join('|');
        
        const state = this.qubitStates.get(key);
        if (!state || state.total < 5) {
            const qState = this.quantumState(features.slice(0, 8));
            const result = this.measure(qState);
            return { prob: Math.max(0.1, Math.min(0.9, result.prob)), conf: 0.45 };
        }
        
        const superpos = this.superposition.get(key) || 0.5;
        const prob = state.T / state.total;
        const finalProb = prob * (1 - superpos * 0.1) + superpos * 0.05;
        
        return { prob: Math.max(0.08, Math.min(0.92, finalProb)), conf: Math.min(0.95, state.total / 100) };
    }
}

class BayesianMeta {
    constructor() {
        this.priors = new Map();
        this.posterior = new Map();
        this.alpha = 1.0;
        this.beta = 1.0;
        this.trained = false;
    }
    
    train(data) {
        for (let i = 40; i < data.length; i++) {
            const window = data.slice(i - 40, i);
            const features = window.map(s => s === 'T' ? 1 : 0);
            const key = features.slice(0, 6).map(v => Math.round(v * 10)).join('|');
            const target = data[i];
            
            if (!this.priors.has(key)) {
                this.priors.set(key, { T: this.alpha, X: this.alpha });
            }
            
            const prior = this.priors.get(key);
            prior[target] = (prior[target] || 0) + 1;
            
            this.posterior.set(key, {
                T: prior.T + this.alpha,
                X: prior.X + this.alpha
            });
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 40) return null;
        const window = seq.slice(-40);
        const features = window.map(s => s === 'T' ? 1 : 0);
        const key = features.slice(0, 6).map(v => Math.round(v * 10)).join('|');
        
        const post = this.posterior.get(key);
        if (!post || post.T + post.X < 5) {
            return { prob: 0.5, conf: 0.3 };
        }
        
        const prob = post.T / (post.T + post.X);
        return { prob: Math.max(0.08, Math.min(0.92, prob)), conf: Math.min(0.9, (post.T + post.X) / 50) };
    }
}

class PatternFingerprint {
    constructor() {
        this.fingerprints = new Map();
        this.trained = false;
    }
    
    fingerprint(seq) {
        const tCount = seq.filter(r => r === 'T').length;
        const changes = seq.filter((r, i) => i > 0 && r !== seq[i-1]).length;
        const ratio = tCount / seq.length;
        const maxStreak = this.calcMaxStreak(seq);
        let entropy = 0;
        const p = ratio;
        if (p > 0 && p < 1) entropy = -p * Math.log2(p) - (1-p) * Math.log2(1-p);
        return `${seq.length}|${tCount}|${changes}|${Math.round(ratio*100)}|${maxStreak}|${Math.round(entropy*100)}`;
    }
    
    calcMaxStreak(seq) {
        let max = 0, cur = 1;
        for (let i = 1; i < seq.length; i++) {
            if (seq[i] === seq[i-1]) { cur++; if (cur > max) max = cur; }
            else cur = 1;
        }
        return max;
    }
    
    train(data) {
        for (let i = 30; i < data.length; i++) {
            const window = data.slice(i - 30, i);
            const fp = this.fingerprint(window.slice(0, 12));
            const target = data[i];
            
            if (!this.fingerprints.has(fp)) {
                this.fingerprints.set(fp, { T: 0, X: 0, total: 0 });
            }
            const f = this.fingerprints.get(fp);
            f[target] = (f[target] || 0) + 1;
            f.total++;
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 30) return null;
        const fp = this.fingerprint(seq.slice(-12));
        const f = this.fingerprints.get(fp);
        
        if (!f || f.total < 3) {
            // Tìm fingerprint gần nhất
            let best = null, bestScore = Infinity;
            for (const [key, val] of this.fingerprints) {
                if (val.total < 5) continue;
                const parts = key.split('|');
                const fLen = parseInt(parts[0]);
                const score = Math.abs(fLen - 12);
                if (score < bestScore) { bestScore = score; best = val; }
            }
            if (best) return { prob: Math.max(0.1, Math.min(0.9, best.T / best.total)), conf: 0.4 };
            return null;
        }
        
        return { prob: Math.max(0.08, Math.min(0.92, f.T / f.total)), conf: Math.min(0.9, f.total / 30) };
    }
}

class WeibullSurvival {
    constructor() {
        this.lifeData = new Map();
        this.trained = false;
    }
    
    weibull(x, shape, scale) {
        if (x <= 0) return 0;
        return 1 - Math.exp(-Math.pow(x / scale, shape));
    }
    
    train(data) {
        for (let i = 40; i < data.length; i++) {
            const window = data.slice(i - 40, i);
            const key = window.slice(0, 8).join('');
            const target = data[i];
            
            if (!this.lifeData.has(key)) {
                this.lifeData.set(key, { T: 0, X: 0, total: 0 });
            }
            const d = this.lifeData.get(key);
            d[target] = (d[target] || 0) + 1;
            d.total++;
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 40) return null;
        const key = seq.slice(-8).join('');
        const d = this.lifeData.get(key);
        
        if (!d || d.total < 5) return null;
        
        const shape = 1.5;
        const scale = 2.0;
        const survT = this.weibull(d.T, shape, scale);
        const survX = this.weibull(d.X, shape, scale);
        
        const prob = survT / (survT + survX + 0.01);
        return { prob: Math.max(0.08, Math.min(0.92, prob)), conf: Math.min(0.9, d.total / 80) };
    }
}

class JSDUncertainty {
    constructor() {
        this.distributions = new Map();
        this.trained = false;
        this.epsilon = 1e-10;
    }
    
    klDivergence(p, q) {
        let sum = 0;
        for (let i = 0; i < p.length; i++) {
            const pi = p[i] + this.epsilon;
            const qi = q[i] + this.epsilon;
            sum += pi * Math.log(pi / qi);
        }
        return sum;
    }
    
    jsd(p, q) {
        const m = p.map((pi, i) => (pi + q[i]) / 2);
        return 0.5 * this.klDivergence(p, m) + 0.5 * this.klDivergence(q, m);
    }
    
    train(data) {
        for (let i = 35; i < data.length; i++) {
            const window = data.slice(i - 35, i);
            const key = window.slice(0, 8).map(s => s === 'T' ? 1 : 0).join('|');
            const target = data[i];
            
            if (!this.distributions.has(key)) {
                this.distributions.set(key, { T: 0, X: 0, total: 0 });
            }
            const d = this.distributions.get(key);
            d[target] = (d[target] || 0) + 1;
            d.total++;
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 35) return null;
        const key = seq.slice(-8).map(s => s === 'T' ? 1 : 0).join('|');
        const d = this.distributions.get(key);
        
        if (!d || d.total < 5) return null;
        
        const p = [d.T / d.total, d.X / d.total];
        const q = [0.5, 0.5];
        const uncertainty = this.jsd(p, q);
        
        const prob = d.T / d.total;
        const adjusted = prob * (1 - uncertainty) + 0.5 * uncertainty;
        
        return { prob: Math.max(0.08, Math.min(0.92, adjusted)), conf: Math.min(0.9, d.total / 70) };
    }
}

// ============================================================
// 🧠 HỆ THỐNG DỰ ĐOÁN TỔNG HỢP
// ============================================================

class UltimatePredictionSystem {
    constructor(type) {
        this.type = type;
        this.history = [];
        this.stats = { total: 0, dung: 0, sai: 0, tyle: 0, chuoi: 0, chuoi_dai: 0, chuoi_thua_dai: 0, chuoi_thang_hientai: 0, chuoi_thua_hientai: 0, homnay: { dung: 0, sai: 0, tong: 0 } };
        this.lastPhien = null;
        this.trained = false;
        
        this.engines = [
            { name: 'QUANTUM', e: new QuantumEnsembleV9(), w: 3.5 },
            { name: 'BAYESIAN', e: new BayesianMeta(), w: 3.0 },
            { name: 'PATTERN', e: new PatternFingerprint(), w: 2.8 },
            { name: 'WEIBULL', e: new WeibullSurvival(), w: 2.5 },
            { name: 'JSD', e: new JSDUncertainty(), w: 2.2 }
        ];
    }
    
    train(data) {
        if (data.length < 50) return false;
        try {
            for (const eng of this.engines) eng.e.train(data);
            this.trained = true;
            return true;
        } catch (e) { return false; }
    }
    
    predict(data) {
        if (!data || data.length < 10) return this.fallback();
        const seq = data.map(d => d === 'T' ? 'T' : 'X');
        
        let sT = 0, sX = 0, sw = 0;
        const details = [];
        
        for (const eng of this.engines) {
            try {
                const r = eng.e.predict(seq);
                if (r) {
                    const w = eng.w * r.conf;
                    sT += r.prob * w;
                    sX += (1 - r.prob) * w;
                    sw += w;
                    details.push(`${eng.name.substring(0,4)}:${Math.round(r.prob * 100)}`);
                }
            } catch (e) {}
        }
        
        // Streak analysis
        const last = seq[seq.length - 1];
        let streak = 1;
        for (let j = seq.length - 2; j >= 0 && seq[j] === last; j--) streak++;
        
        if (streak >= 10) {
            if (last === 'T') { sX += 5; details.push('BREAK-T10'); }
            else { sT += 5; details.push('BREAK-X10'); }
            sw += 5;
        } else if (streak >= 7) {
            if (last === 'T') { sX += 3; details.push('BREAK-T7'); }
            else { sT += 3; details.push('BREAK-X7'); }
            sw += 3;
        }
        
        // Balance
        const lt = seq.filter(s => s === 'T').length / seq.length;
        if (lt > 0.75) { sX += 4; details.push('BAL-T75'); sw += 4; }
        else if (lt < 0.25) { sT += 4; details.push('BAL-X25'); sw += 4; }
        
        if (sw === 0) return this.fallback();
        
        const prob = sT / (sT + sX);
        const duDoan = prob > 0.5 ? 'TÀI' : 'XỈU';
        let doTinCay = Math.round(Math.max(prob, 1 - prob) * 100);
        if (details.length >= 5) doTinCay = Math.min(99, doTinCay + 8);
        else if (details.length >= 3) doTinCay = Math.min(99, doTinCay + 5);
        doTinCay = Math.min(99, Math.max(55, doTinCay));
        
        return { duDoan, doTinCay, chiTiet: details.join(' | '), soMau: details.length };
    }
    
    fallback() {
        if (this.stats.total > 50) {
            return { duDoan: this.stats.dung > this.stats.sai ? 'TÀI' : 'XỈU', doTinCay: 52, chiTiet: 'TREND', soMau: 0 };
        }
        return { duDoan: 'TÀI', doTinCay: 51, chiTiet: 'INIT', soMau: 0 };
    }
    
    update(prediction, actual) {
        const pr = prediction === 'TÀI' ? 'T' : 'X';
        const ac = actual === 'TÀI' ? 'T' : 'X';
        const ok = pr === ac;
        
        this.stats.total++;
        if (ok) {
            this.stats.dung++;
            this.stats.chuoi = this.stats.chuoi >= 0 ? this.stats.chuoi + 1 : 1;
            if (this.stats.chuoi > this.stats.chuoi_dai) this.stats.chuoi_dai = this.stats.chuoi;
            this.stats.chuoi_thang_hientai++;
            this.stats.chuoi_thua_hientai = 0;
            this.stats.homnay.dung++;
        } else {
            this.stats.sai++;
            this.stats.chuoi = this.stats.chuoi <= 0 ? this.stats.chuoi - 1 : -1;
            if (Math.abs(this.stats.chuoi) > this.stats.chuoi_thua_dai) this.stats.chuoi_thua_dai = Math.abs(this.stats.chuoi);
            this.stats.chuoi_thua_hientai++;
            this.stats.chuoi_thang_hientai = 0;
            this.stats.homnay.sai++;
        }
        this.stats.homnay.tong++;
        this.stats.tyle = this.stats.total > 0 ? Math.round((this.stats.dung / this.stats.total) * 100) : 0;
    }
    
    save() {
        try {
            fs.writeFileSync(`.${this.type}_data`, JSON.stringify({
                history: this.history.slice(0, 2000),
                stats: this.stats,
                lastPhien: this.lastPhien,
                trained: this.trained
            }));
        } catch (e) {}
    }
    
    load() {
        try {
            const f = `.${this.type}_data`;
            if (fs.existsSync(f)) {
                const d = JSON.parse(fs.readFileSync(f, 'utf8'));
                if (d.history) this.history = d.history;
                if (d.stats) this.stats = d.stats;
                if (d.lastPhien) this.lastPhien = d.lastPhien;
                if (d.trained) this.trained = d.trained;
            }
        } catch (e) {}
    }
}

const brainHU = new UltimatePredictionSystem('hu');
const brainMD5 = new UltimatePredictionSystem('md5');
brainHU.load();
brainMD5.load();

// ============================================================
// 📊 DATA
// ============================================================
function transformData(d) {
    if (!d || !d.list) return null;
    return d.list.map(i => ({ phien: i.id, result: i.resultTruyenThong === 'TAI' ? 'TÀI' : 'XỈU', dice1: i.dices[0], dice2: i.dices[1], dice3: i.dices[2], total: i.point }));
}

async function fetchData(t) {
    try {
        const u = t === 'hu' ? API_URL_HU : API_URL_MD5;
        const r = await axios.get(u, { timeout: 8000, headers: { 'User-Agent': 'CrystalTX/8.0' } });
        return transformData(r.data);
    } catch (e) { return null; }
}

// ============================================================
// ⚡ AUTO PROCESS
// ============================================================
async function processGame(brain, type) {
    try {
        const data = await fetchData(type);
        if (!data || data.length === 0) return;
        const cur = data[0].phien;
        if (brain.lastPhien === cur) return;
        
        for (const r of brain.history) {
            if (r.status && r.status !== '') continue;
            const a = data.find(d => d.phien.toString() === r.phien_hien_tai);
            if (a) { r.status = (r.prediction === a.result) ? '✅' : '❌'; r.actual = a.result; brain.update(r.prediction, a.result); }
        }
        
        const ex = brain.history.find(h => h.phien_hien_tai === (cur + 1).toString());
        if (ex) return;
        
        const hd = data.map(d => d.result === 'TÀI' ? 'T' : 'X');
        if (hd.length >= 50) brain.train(hd);
        
        const result = brain.predict(hd);
        const rec = { phien: data[0].phien, phien_hien_tai: (data[0].phien + 1).toString(), dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`, total: data[0].total, actual: data[0].result, prediction: result.duDoan, confidence: result.doTinCay, detail: result.chiTiet, status: '', timestamp: new Date().toISOString(), soMau: result.soMau || 0 };
        brain.history.unshift(rec);
        if (brain.history.length > 2000) brain.history = brain.history.slice(0, 2000);
        brain.lastPhien = cur;
        brain.save();
    } catch (e) {}
}

async function autoProcess() {
    await Promise.all([processGame(brainHU, 'hu'), processGame(brainMD5, 'md5')]);
}

function startAuto() {
    setTimeout(autoProcess, 3000);
    setInterval(autoProcess, 5000);
}

// ============================================================
// 🎨 GIAO DIỆN SIÊU VIP
// ============================================================

const CSS_FRAMEWORK = `
:root{--bg:#020617;--bg2:#0a0f24;--bg3:#111832;--bg4:#1a2040;--border:rgba(255,255,255,0.04);--border-active:rgba(123,97,255,0.3);--text:#e2e8f0;--text2:#8899b8;--text3:#4a5578;--gradient:linear-gradient(135deg,#7b61ff,#3b82f6,#06b6d4,#8b5cf6);--gradient2:linear-gradient(135deg,#7b61ff,#8b5cf6);--success:#22c55e;--danger:#ef4444;--warning:#f59e0b;--info:#06b6d4;--purple:#7b61ff}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased;-webkit-user-select:none;user-select:none}
.bg-orbs{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none}
.bg-orbs div{position:absolute;border-radius:50%;filter:blur(140px);opacity:0.4}
.bg-orbs .o1{width:700px;height:700px;background:rgba(123,97,255,0.1);top:-250px;left:-150px;animation:o1 20s infinite}
.bg-orbs .o2{width:600px;height:600px;background:rgba(6,182,212,0.07);bottom:-200px;right:-100px;animation:o2 25s infinite}
.bg-orbs .o3{width:500px;height:500px;background:rgba(139,92,246,0.05);top:50%;left:60%;animation:o3 30s infinite}
@keyframes o1{0%,100%{transform:translate(0,0)}50%{transform:translate(100px,60px)}}
@keyframes o2{0%,100%{transform:translate(0,0)}50%{transform:translate(-80px,-40px)}}
@keyframes o3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-60px,30px) scale(1.3)}}
.grid-bg{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px);background-size:50px 50px;mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 10%,transparent 70%)}
.app{position:relative;z-index:1;max-width:1400px;margin:0 auto;padding:16px 20px}
.glass{background:rgba(17,24,50,0.6);backdrop-filter:blur(25px);border:1px solid var(--border);border-radius:18px}
.glass-card{background:rgba(17,24,50,0.5);backdrop-filter:blur(20px);border:1px solid var(--border);border-radius:14px;padding:18px 20px;transition:all 0.3s}
.glass-card:hover{border-color:var(--border-active);transform:translateY(-2px);box-shadow:0 12px 40px rgba(0,0,0,0.3)}
.btn-primary{display:inline-flex;align-items:center;gap:8px;padding:12px 24px;background:var(--gradient);border:none;border-radius:10px;color:#fff;font-weight:600;font-size:13px;cursor:pointer;transition:all 0.3s}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(123,97,255,0.35)}
.btn-danger{display:inline-flex;align-items:center;gap:8px;padding:12px 24px;background:var(--danger);border:none;border-radius:10px;color:#fff;font-weight:600;font-size:13px;cursor:pointer;transition:all 0.3s}
input,select{width:100%;padding:11px 14px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;font-family:'JetBrains Mono',monospace;outline:none;transition:all 0.3s}
input:focus,select:focus{border-color:var(--border-active);box-shadow:0 0 0 3px rgba(123,97,255,0.1)}
.badge{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:14px;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:1px}
.badge-ok{background:rgba(34,197,94,0.08);color:var(--success);border:1px solid rgba(34,197,94,0.15)}
.badge-danger{background:rgba(239,68,68,0.08);color:var(--danger);border:1px solid rgba(239,68,68,0.15)}
.badge-info{background:rgba(6,182,212,0.08);color:var(--info);border:1px solid rgba(6,182,212,0.15)}
.badge-purple{background:rgba(123,97,255,0.08);color:var(--purple);border:1px solid rgba(123,97,255,0.15)}
.pulse{width:7px;height:7px;border-radius:50%;background:var(--success);animation:pulse 1.5s infinite;box-shadow:0 0 10px rgba(34,197,94,0.4);display:inline-block}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.text-grad{background:var(--gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.06);border-radius:2px}`;

function loginPage(errMsg) {
    const err = errMsg ? `<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);padding:14px;border-radius:10px;color:#ef4444;font-size:13px;margin-bottom:16px;text-align:center">⚠️ ${errMsg}</div>` : '';
    
    return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"><title>CRYSTAL TX | Đăng Nhập</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;800;900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS_FRAMEWORK}</style></head><body>
<div class="bg-orbs"><div class="o1"></div><div class="o2"></div><div class="o3"></div></div><div class="grid-bg"></div>
<div class="app" style="display:flex;align-items:center;justify-content:center;min-height:100vh">
<div class="glass" style="width:100%;max-width:460px;padding:44px 36px;animation:slideUp 0.5s ease-out">
<div style="text-align:center;margin-bottom:32px">
<div style="font-size:52px;animation:float 3s ease-in-out infinite;display:inline-block">💎</div>
<h1 style="font-family:'Orbitron',sans-serif;font-size:28px;font-weight:900;margin-top:8px"><span class="text-grad">CRYSTAL TX</span></h1>
<p style="font-size:9px;color:var(--text3);font-family:'JetBrains Mono',monospace;letter-spacing:2px;text-transform:uppercase;margin-top:4px">Hệ Thống Dự Đoán Độc Quyền • v80.0</p></div>
${err}
<form onsubmit="doLogin(event)"><div style="margin-bottom:14px"><label style="display:block;font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;font-weight:600">👤 Username</label><input type="text" id="u" placeholder="Nhập username" autocomplete="off" required></div>
<div style="margin-bottom:20px"><label style="display:block;font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;font-weight:600">🔒 Password</label><input type="password" id="p" placeholder="Nhập password" autocomplete="off" required></div>
<button type="submit" class="btn-primary" style="width:100%;justify-content:center;font-size:14px">🔐 Đăng Nhập Hệ Thống</button></form>
<div id="result" style="margin-top:20px"></div>
<div style="text-align:center;margin-top:20px;padding-top:16px;border-top:1px solid var(--border);font-size:8px;color:var(--text3);font-family:'JetBrains Mono',monospace">💎 CRYSTAL TX • Quantum • Bayesian • Pattern • Weibull • JSD • By Anh Khôi</div></div></div>
<script>
async function doLogin(e){e.preventDefault();
const u=document.getElementById('u').value.trim(),p=document.getElementById('p').value.trim(),r=document.getElementById('result');
if(!u||!p){r.innerHTML='<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);padding:14px;border-radius:10px;color:#ef4444;font-size:13px">⚠️ Vui lòng nhập đầy đủ thông tin</div>';return}
r.innerHTML='<div style="background:rgba(6,182,212,0.1);border:1px solid rgba(6,182,212,0.25);padding:14px;border-radius:10px;color:#06b6d4;font-size:13px">⏳ Đang xác thực...</div>';
try{const res=await fetch('/_api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});
const d=await res.json();
if(res.ok&&d.token){r.innerHTML='<div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.25);padding:14px;border-radius:10px;color:#22c55e;font-size:13px;margin-bottom:16px">✅ Đăng nhập thành công! ('+d.role+')</div>'+
'<div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:16px">'+
'<p style="font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">🔑 Token</p>'+
'<div style="font-family:\'JetBrains Mono\',monospace;font-size:10px;color:var(--success);word-break:break-all;background:var(--bg);padding:10px;border-radius:6px;margin-bottom:12px">'+d.token+'</div>'+
'<p style="font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">📡 Truy Cập</p>'+
'<a href="/_hu?_token='+d.token+'" style="display:block;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--info);text-decoration:none;font-size:11px;font-family:\'JetBrains Mono\',monospace;margin-bottom:6px">📊 Dashboard HU →</a>'+
'<a href="/_md5?_token='+d.token+'" style="display:block;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--info);text-decoration:none;font-size:11px;font-family:\'JetBrains Mono\',monospace;margin-bottom:6px">📊 Dashboard MD5 →</a>'+
'<a href="/_hu/json?_token='+d.token+'" style="display:block;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--purple);text-decoration:none;font-size:11px;font-family:\'JetBrains Mono\',monospace;margin-bottom:6px">📡 JSON API HU →</a>'+
'<a href="/_md5/json?_token='+d.token+'" style="display:block;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--purple);text-decoration:none;font-size:11px;font-family:\'JetBrains Mono\',monospace">📡 JSON API MD5 →</a>'+
(d.role==='admin'?'<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)"><a href="/_admin?_token='+d.token+'" style="display:block;padding:10px 14px;background:var(--gradient2);border:none;border-radius:8px;color:#fff;text-decoration:none;font-size:11px;font-family:\'JetBrains Mono\',monospace;text-align:center">👑 Admin Panel →</a></div>':'')+
'</div>'}else{r.innerHTML='<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);padding:14px;border-radius:10px;color:#ef4444;font-size:13px">❌ '+(d.error||'Sai thông tin')+'</div>'}}
catch(ex){r.innerHTML='<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);padding:14px;border-radius:10px;color:#ef4444;font-size:13px">🔌 Lỗi kết nối</div>'}}</script></body></html>`;
}

function dashboardPage(brain, type) {
    const s = brain.stats;
    const all = (brain.history || []);
    const recent = all.slice(0, 50);
    const all1000 = all.slice(0, 1000);
    
    let td50=0,ts50=0;
    for(const r of recent){if(r.status==='✅')td50++;else if(r.status==='❌')ts50++;}
    let td1000=0,ts1000=0;
    for(const r of all1000){if(r.status==='✅')td1000++;else if(r.status==='❌')ts1000++;}
    
    const wr=s.tyle;
    
    let rows='';
    for(const r of recent){
        const st=r.status||'⏳',cls=st==='✅'?'s':st==='❌'?'d':'w',txt=st==='✅'?'WIN':st==='❌'?'LOSE':'WAIT';
        rows+=`<tr class="r-${cls}"><td class="mono">#${r.phien_hien_tai||'-'}</td><td><span class="pred pred-${r.prediction==='TÀI'?'t':'x'}">${r.prediction||'-'}</span></td><td><div class="cb"><div class="cf" style="width:${r.confidence||0}%"></div></div><span class="ct">${r.confidence||0}%</span></td><td><span class="st st-${cls}">${txt}</span></td><td>${r.actual||'-'}</td><td class="dt">${(r.detail||'-').substring(0,30)}</td></tr>`;
    }
    
    let dots='';
    for(const r of all1000){const st=r.status||'⏳',cls=st==='✅'?'s':st==='❌'?'d':'w',txt=st==='✅'?'W':st==='❌'?'L':'?';dots+=`<span class="dot dot-${cls}" title="#${r.phien_hien_tai}: ${r.prediction} → ${r.actual||'?'}">${txt}</span>`;}
    
    return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"><title>${type.toUpperCase()} | CRYSTAL TX</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;800;900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS_FRAMEWORK}
.stat-val{font-family:'Orbitron',monospace;font-size:28px;font-weight:800}
.mono{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text2)}
.pred{display:inline-block;padding:3px 10px;border-radius:6px;font-weight:700;font-size:9px}
.pred-t{background:rgba(34,197,94,0.08);color:var(--success)}.pred-x{background:rgba(239,68,68,0.08);color:var(--danger)}
.cb{display:inline-block;width:45px;height:3px;background:rgba(255,255,255,0.05);border-radius:2px;vertical-align:middle;margin-right:6px}
.cf{height:100%;border-radius:2px;background:var(--gradient)}.ct{font-weight:600;color:var(--info);font-size:9px}
.st{display:inline-block;padding:2px 8px;border-radius:4px;font-weight:700;font-size:7px;text-transform:uppercase;letter-spacing:1px}
.st-s{background:rgba(34,197,94,0.08);color:var(--success)}.st-d{background:rgba(239,68,68,0.08);color:var(--danger)}.st-w{background:rgba(245,158,11,0.08);color:var(--warning)}
.dt{font-size:8px;color:var(--text3);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dot{width:18px;height:18px;border-radius:3px;font-size:7px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;font-family:'JetBrains Mono',monospace;margin:1px}
.dot-s{background:rgba(34,197,94,0.15);color:var(--success);border:1px solid rgba(34,197,94,0.2)}.dot-s:hover{transform:scale(1.4);z-index:2}
.dot-d{background:rgba(239,68,68,0.15);color:var(--danger);border:1px solid rgba(239,68,68,0.2)}.dot-d:hover{transform:scale(1.4);z-index:2}
.dot-w{background:rgba(245,158,11,0.15);color:var(--warning);border:1px solid rgba(245,158,11,0.2)}.dot-w:hover{transform:scale(1.4);z-index:2}
table{width:100%;border-collapse:collapse;font-size:10px}
th{background:rgba(255,255,255,0.015);padding:9px 12px;text-align:left;font-weight:600;font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text3);border-bottom:1px solid var(--border)}
td{padding:7px 12px;border-bottom:1px solid rgba(255,255,255,0.012)}tr:hover td{background:rgba(255,255,255,0.008)}
.r-s{border-left:2px solid transparent}.r-s:hover{border-left-color:rgba(34,197,94,0.3)}
.r-d{border-left:2px solid transparent}.r-d:hover{border-left-color:rgba(239,68,68,0.3)}
.r-w{border-left:2px solid transparent}.r-w:hover{border-left-color:rgba(245,158,11,0.3)}</style></head><body>
<div class="bg-orbs"><div class="o1"></div><div class="o2"></div><div class="o3"></div></div><div class="grid-bg"></div><div class="app">
<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;margin-bottom:20px">
<div style="display:flex;align-items:center;gap:12px"><div style="font-size:38px;animation:float 3s ease-in-out infinite">💎</div><div><h1 style="font-family:'Orbitron',sans-serif;font-size:22px;font-weight:900"><span class="text-grad">CRYSTAL TX</span></h1><p style="font-size:9px;color:var(--text3);font-family:'JetBrains Mono',monospace;letter-spacing:2px">${type.toUpperCase()} • v80.0 • By Anh Khôi</p></div></div>
<div style="display:flex;align-items:center;gap:10px"><div class="badge badge-ok"><span class="pulse"></span>LIVE</div><div class="badge badge-purple">5 ENGINES</div></div></div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
<div class="glass-card"><div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600">📊 Tổng</div><div class="stat-val" style="color:var(--text)">${s.total}</div><div style="font-size:9px;color:var(--text2);margin-top:4px">Dự đoán</div></div>
<div class="glass-card"><div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600">✅ Tỷ Lệ Thắng</div><div class="stat-val" style="color:var(--success)">${wr}%</div><div style="font-size:9px;color:var(--text2);margin-top:4px">${s.dung}W / ${s.sai}L</div></div>
<div class="glass-card"><div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600">🏆 Chuỗi Thắng</div><div class="stat-val" style="color:var(--success)">${s.chuoi_dai}</div><div style="font-size:9px;color:var(--text2);margin-top:4px">Hiện tại: ${s.chuoi_thang_hientai||0}</div></div>
<div class="glass-card"><div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600">⚠️ Chuỗi Thua</div><div class="stat-val" style="color:var(--danger)">${s.chuoi_thua_dai||0}</div><div style="font-size:9px;color:var(--text2);margin-top:4px">Hiện tại: ${s.chuoi_thua_hientai||0}</div></div></div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
<div class="glass-card"><div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600">📈 50 Phiên</div><div class="stat-val" style="color:${td50>ts50?'var(--success)':'var(--danger)'}">${td50}W</div><div style="font-size:9px;color:var(--text2);margin-top:4px">${ts50}L</div></div>
<div class="glass-card"><div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600">📈 1000 Phiên</div><div class="stat-val" style="color:var(--info)">${td1000}W</div><div style="font-size:9px;color:var(--text2);margin-top:4px">${ts1000}L</div></div>
<div class="glass-card"><div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600">⚡ Chuỗi Hiện Tại</div><div class="stat-val" style="color:${s.chuoi>0?'var(--success)':'var(--danger)'}">${s.chuoi>0?'+'+s.chuoi:s.chuoi}</div><div style="font-size:9px;color:var(--text2);margin-top:4px">${s.chuoi>0?'Đang thắng':'Đang thua'}</div></div>
<div class="glass-card"><div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600">📊 Hôm Nay</div><div class="stat-val" style="color:var(--text)">${s.homnay.dung}W/${s.homnay.sai}L</div><div style="font-size:9px;color:var(--text2);margin-top:4px">${s.homnay.tong} phiên</div></div></div>
<div class="glass" style="margin-bottom:20px"><div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:8px"><h3 style="font-family:'Orbitron',monospace;font-size:12px;font-weight:600">📜 Lịch Sử ${all1000.length} Phiên</h3><span class="badge badge-info">${td1000}W / ${ts1000}L</span></div><div style="padding:14px;max-height:300px;overflow-y:auto;line-height:1.8">${dots||'Đang tải...'}</div></div>
<div class="glass"><div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:8px"><h3 style="font-family:'Orbitron',monospace;font-size:12px;font-weight:600">📋 50 Phiên Gần Nhất</h3><span class="badge badge-purple">QUANTUM • BAYESIAN • PATTERN • WEIBULL • JSD</span></div>
<div style="overflow-x:auto"><table><thead><tr><th>Phiên</th><th>Dự Đoán</th><th>Độ Tin</th><th>KQ</th><th>Thực Tế</th><th>Engines</th></tr></thead><tbody>${rows||'<tr><td colspan="6" style="text-align:center;padding:20px">Đang tải...</td></tr>'}</tbody></table></div></div>
<div style="text-align:center;padding:12px;font-size:8px;color:var(--text3);font-family:'JetBrains Mono',monospace;margin-top:12px">💎 CRYSTAL TX • Quantum • Bayesian • Pattern • Weibull • JSD • By Anh Khôi • ${new Date().toLocaleString('vi-VN')}</div></div>
<script>setTimeout(()=>location.reload(),5000);</script></body></html>`;
}

function adminPanelPage() {
    const userList = Object.entries(users).map(([username, data]) => {
        const expired = data.expires > 0 ? new Date(data.expires).toLocaleString('vi-VN') : 'Không giới hạn';
        const active = data.expires === 0 || Date.now() < data.expires;
        return `<tr><td class="mono">${username}</td><td>${data.devices}</td><td>${expired}</td><td><span class="badge ${active?'badge-ok':'badge-danger'}">${active?'Hoạt động':'Hết hạn'}</span></td><td><button onclick="deleteUser('${username}')" class="btn-danger" style="padding:6px 12px;font-size:10px">🗑 Xóa</button></td></tr>`;
    }).join('');
    
    return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"><title>Admin Panel | CRYSTAL TX</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;800;900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS_FRAMEWORK}
.mono{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text2)}
table{width:100%;border-collapse:collapse;font-size:10px}
th{background:rgba(255,255,255,0.015);padding:10px 14px;text-align:left;font-weight:600;font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text3);border-bottom:1px solid var(--border)}
td{padding:9px 14px;border-bottom:1px solid rgba(255,255,255,0.012)}tr:hover td{background:rgba(255,255,255,0.008)}
</style></head><body>
<div class="bg-orbs"><div class="o1"></div><div class="o2"></div><div class="o3"></div></div><div class="grid-bg"></div><div class="app">
<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;margin-bottom:24px">
<div style="display:flex;align-items:center;gap:12px"><div style="font-size:38px;animation:float 3s ease-in-out infinite">👑</div><div><h1 style="font-family:'Orbitron',sans-serif;font-size:22px;font-weight:900"><span class="text-grad">ADMIN PANEL</span></h1><p style="font-size:9px;color:var(--text3);font-family:'JetBrains Mono',monospace;letter-spacing:2px">Quản Lý Người Dùng • CRYSTAL TX</p></div></div>
<div class="badge badge-purple">👑 ADMIN</div></div>

<div class="glass" style="padding:24px;margin-bottom:20px">
<h3 style="font-family:'Orbitron',monospace;font-size:14px;font-weight:600;margin-bottom:16px">➕ Tạo Người Dùng Mới</h3>
<form onsubmit="createUser(event)" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;align-items:end">
<div><label style="display:block;font-size:8px;color:var(--text2);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px">Username</label><input type="text" id="newUser" placeholder="username" required></div>
<div><label style="display:block;font-size:8px;color:var(--text2);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px">Password</label><input type="text" id="newPass" placeholder="password" required></div>
<div><label style="display:block;font-size:8px;color:var(--text2);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px">Số Thiết Bị</label><input type="number" id="newDevices" value="1" min="1" max="100"></div>
<div><label style="display:block;font-size:8px;color:var(--text2);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px">Hạn (ngày)</label><input type="number" id="newExpiry" value="30" min="1" max="3650"></div>
<button type="submit" class="btn-primary" style="grid-column:1/-1">➕ Tạo Người Dùng</button></form>
<div id="createResult" style="margin-top:12px"></div></div>

<div class="glass"><div style="padding:18px 20px;border-bottom:1px solid var(--border)"><h3 style="font-family:'Orbitron',monospace;font-size:14px;font-weight:600">👥 Danh Sách Người Dùng (${Object.keys(users).length})</h3></div>
<div style="overflow-x:auto"><table><thead><tr><th>Username</th><th>Thiết Bị</th><th>Hết Hạn</th><th>Trạng Thái</th><th>Hành Động</th></tr></thead><tbody>${userList||'<tr><td colspan="5" style="text-align:center;padding:20px">Chưa có người dùng</td></tr>'}</tbody></table></div></div>

<div style="text-align:center;padding:12px;font-size:8px;color:var(--text3);font-family:'JetBrains Mono',monospace;margin-top:12px">👑 CRYSTAL TX Admin Panel • By Anh Khôi</div></div>
<script>
async function createUser(e){e.preventDefault();
const u=document.getElementById('newUser').value.trim();
const p=document.getElementById('newPass').value.trim();
const d=parseInt(document.getElementById('newDevices').value);
const ex=parseInt(document.getElementById('newExpiry').value);
const r=document.getElementById('createResult');
const token=new URLSearchParams(window.location.search).get('_token');
r.innerHTML='<div style="background:rgba(6,182,212,0.1);border:1px solid rgba(6,182,212,0.25);padding:14px;border-radius:10px;color:#06b6d4;font-size:13px">⏳ Đang tạo...</div>';
try{const res=await fetch('/_admin/create-user?_token='+token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p,devices:d,expiryDays:ex})});
const data=await res.json();
if(res.ok){r.innerHTML='<div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.25);padding:14px;border-radius:10px;color:#22c55e;font-size:13px">✅ Đã tạo user: '+data.username+' | Pass: '+data.password+' | Hạn: '+data.expires+'</div>';setTimeout(()=>location.reload(),1500)}
else{r.innerHTML='<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);padding:14px;border-radius:10px;color:#ef4444;font-size:13px">❌ '+(data.error||'Lỗi')+'</div>'}}
catch(ex){r.innerHTML='<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);padding:14px;border-radius:10px;color:#ef4444;font-size:13px">🔌 Lỗi kết nối</div>'}}
async function deleteUser(u){if(!confirm('Xóa user: '+u+'?'))return;
const token=new URLSearchParams(window.location.search).get('_token');
try{await fetch('/_admin/delete-user?_token='+token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u})});location.reload()}catch(e){}}
</script></body></html>`;
}

// ============================================================
// 🔌 API ENDPOINTS
// ============================================================

app.get('/_login', (req, res) => {
    const err = req.query.error === 'unauthorized' ? 'Bạn cần đăng nhập để truy cập' : req.query.error === 'expired' ? 'Token đã hết hạn' : '';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(loginPage(err));
});

app.get('/', (req, res) => res.redirect('/_login'));

// LOGIN - Hỗ trợ cả admin và user
app.post('/_api/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Thiếu thông tin' });
    
    // Check admin
    if (username === adminConfig.username && password === adminConfig.password) {
        const token = generateToken(username, 'admin', 'unlimited');
        return res.json({ token, role: 'admin', expires: 0 });
    }
    
    // Check user
    const user = users[username];
    if (user && user.password === password) {
        if (user.expires > 0 && Date.now() > user.expires) {
            return res.status(401).json({ error: 'Tài khoản đã hết hạn' });
        }
        const token = generateToken(username, 'user', user.devices);
        return res.json({ token, role: 'user', expires: user.expires });
    }
    
    return res.status(401).json({ error: 'Sai thông tin đăng nhập' });
});

// Dashboard
app.get('/_hu', requireAuth, async (req, res) => {
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

app.get('/_md5', requireAuth, async (req, res) => {
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

// JSON API
app.get('/_hu/json', requireAuth, async (req, res) => {
    try {
        const data = await fetchData('hu');
        if (!data || data.length === 0) { const r = brainHU.fallback(); return res.json({ prediction: r.duDoan, confidence: r.doTinCay, detail: r.chiTiet }); }
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

app.get('/_md5/json', requireAuth, async (req, res) => {
    try {
        const data = await fetchData('md5');
        if (!data || data.length === 0) { const r = brainMD5.fallback(); return res.json({ prediction: r.duDoan, confidence: r.doTinCay, detail: r.chiTiet }); }
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

// Admin Panel
app.get('/_admin', requireAuth, requireAdmin, (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(adminPanelPage());
});

// Admin API - Tạo user
app.post('/_admin/create-user', requireAuth, requireAdmin, (req, res) => {
    const { username, password, devices, expiryDays } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Thiếu thông tin' });
    if (users[username]) return res.status(400).json({ error: 'Username đã tồn tại' });
    if (username === adminConfig.username) return res.status(400).json({ error: 'Không thể tạo trùng admin' });
    
    users[username] = {
        password: password,
        devices: parseInt(devices) || 1,
        expires: expiryDays ? Date.now() + (parseInt(expiryDays) * 86400000) : 0,
        created: Date.now()
    };
    saveUsers();
    
    res.json({ username, password, devices: users[username].devices, expires: expiryDays ? new Date(users[username].expires).toLocaleString('vi-VN') : 'Không giới hạn' });
});

// Admin API - Xóa user
app.post('/_admin/delete-user', requireAuth, requireAdmin, (req, res) => {
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ error: 'Thiếu username' });
    if (!users[username]) return res.status(400).json({ error: 'User không tồn tại' });
    
    delete users[username];
    saveUsers();
    res.json({ message: 'Đã xóa' });
});

app.get('/_stats', requireAuth, (req, res) => {
    const total = brainHU.stats.total + brainMD5.stats.total;
    const dung = brainHU.stats.dung + brainMD5.stats.dung;
    res.json({ hu: brainHU.stats, md5: brainMD5.stats, combined: { total, dung, sai: total - dung, tyle: total > 0 ? Math.round((dung / total) * 100) : 0 } });
});

app.get('/_reset', requireAuth, requireAdmin, (req, res) => {
    ['hu', 'md5'].forEach(type => {
        const brain = type === 'hu' ? brainHU : brainMD5;
        brain.stats = { total: 0, dung: 0, sai: 0, tyle: 0, chuoi: 0, chuoi_dai: 0, chuoi_thua_dai: 0, chuoi_thang_hientai: 0, chuoi_thua_hientai: 0, homnay: { dung: 0, sai: 0, tong: 0 } };
        brain.history = []; brain.lastPhien = null; brain.save();
    });
    res.json({ message: 'Done' });
});

app.use((req, res) => res.status(404).end());
app.use((err, req, res, next) => { res.status(500).end(); });

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ CRYSTAL TX v80.0 - PORT ${PORT}`);
    startAuto();
});
