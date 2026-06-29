const express = require('express');
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 5000;

const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';

// ============================================================
// 🔐 ADMIN SYSTEM - HIỂN THỊ MẶC ĐỊNH KHI KHỞI ĐỘNG
// ============================================================
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = crypto.randomBytes(8).toString('hex');
const ADMIN_TOKENS = new Map();

// Hiển thị thông tin đăng nhập RÕ RÀNG khi khởi động
console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║  🔐 CRYSTAL TX - THÔNG TIN ĐĂNG NHẬP               ║');
console.log('╠══════════════════════════════════════════════════════╣');
console.log(`║  👤 Username: ${ADMIN_USERNAME}                              ║`);
console.log(`║  🔑 Password: ${ADMIN_PASSWORD}                        ║`);
console.log('╠══════════════════════════════════════════════════════╣');
console.log('║  📍 Truy cập trang login để lấy token               ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

const generateAdminToken = () => {
    const token = crypto.randomBytes(48).toString('hex');
    ADMIN_TOKENS.set(token, Date.now() + 86400000);
    setTimeout(() => ADMIN_TOKENS.delete(token), 86400000);
    return token;
};

const adminAuth = (req, res, next) => {
    const token = req.headers['x-admin-token'] || req.query['_token'] || req.query['_admin'];
    if (!token || !ADMIN_TOKENS.has(token)) {
        return res.redirect('/_login?error=unauthorized');
    }
    if (Date.now() > ADMIN_TOKENS.get(token)) {
        ADMIN_TOKENS.delete(token);
        return res.redirect('/_login?error=expired');
    }
    next();
};

// ============================================================
// 🛡️ SECURITY
// ============================================================
app.use((req, res, next) => {
    const blocked = ['/admin','/wp-admin','/phpmyadmin','/.env','/.git','/config','/backup','/shell','/api','/graphql','/actuator','/swagger','/debug','/wp-login','/xmlrpc.php'];
    if (blocked.some(b => req.path.toLowerCase().startsWith(b))) return res.status(404).end();
    
    const ua = (req.get('User-Agent') || '').toLowerCase();
    const blockedUA = ['sqlmap','nikto','nmap','burp','acunetix','nessus','metasploit','hydra','gobuster','dirbuster','wpscan','zap'];
    if (blockedUA.some(b => ua.includes(b))) return res.status(403).end();
    
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Server', 'CRYSTAL-TX');
    next();
});

// Rate limiter
const rateLimitMap = new Map();
app.use((req, res, next) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    if (!rateLimitMap.has(ip)) rateLimitMap.set(ip, []);
    const requests = rateLimitMap.get(ip).filter(t => now - t < 60000);
    if (requests.length > 120) return res.status(429).send('Too Many Requests');
    requests.push(now);
    rateLimitMap.set(ip, requests);
    next();
});

// ============================================================
// 🔐 ENCRYPTION
// ============================================================
const MASTER_KEY = crypto.createHash('sha512').update('crystal-tx-ultimate-secure-key-2024').digest();

function secureEncrypt(text) {
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY.slice(0, 32), iv);
        let encrypted = cipher.update(String(text), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const tag = cipher.getAuthTag().toString('hex');
        return iv.toString('hex') + ':' + tag + ':' + encrypted;
    } catch (e) { return null; }
}

function secureDecrypt(text) {
    try {
        const parts = text.split(':');
        if (parts.length !== 3) return null;
        const iv = Buffer.from(parts[0], 'hex');
        const tag = Buffer.from(parts[1], 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_KEY.slice(0, 32), iv);
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(parts[2], 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) { return null; }
}

// ============================================================
// 🧬 5 ENGINE DỰ ĐOÁN SIÊU CHÍNH XÁC
// ============================================================

class QuantumSpectralEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    
    extractSpectrum(seq) {
        const signal = seq.map(v => v === 'T' ? 1 : -1);
        const features = [];
        for (const period of [3, 5, 8, 13, 21, 34, 55]) {
            if (signal.length >= period) {
                let sinSum = 0, cosSum = 0;
                for (let i = 0; i < period; i++) {
                    const angle = (2 * Math.PI * i) / period;
                    sinSum += signal[signal.length - period + i] * Math.sin(angle);
                    cosSum += signal[signal.length - period + i] * Math.cos(angle);
                }
                features.push(Math.sqrt(sinSum * sinSum + cosSum * cosSum) / period);
                features.push(Math.atan2(sinSum, cosSum) / Math.PI);
            }
        }
        while (features.length < 14) features.push(0);
        return features;
    }
    
    train(data) {
        for (let i = 60; i < data.length; i++) {
            const window = data.slice(i - 60, i);
            const spectrum = this.extractSpectrum(window);
            const key = spectrum.map(v => Math.round(v * 20)).join(',');
            if (!this.db.has(key)) this.db.set(key, { T: 0, X: 0, total: 0 });
            const d = this.db.get(key);
            d[data[i]] = (d[data[i]] || 0) + 1;
            d.total++;
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (seq.length < 60 || !this.trained) return null;
        const spectrum = this.extractSpectrum(seq.slice(-60));
        const key = spectrum.map(v => Math.round(v * 20)).join(',');
        const d = this.db.get(key);
        if (!d || d.total < 5) return null;
        return { prob: Math.max(0.08, Math.min(0.92, d.T / d.total)), conf: Math.min(0.95, d.total / 120) };
    }
}

class FractalGeometryEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    
    calcDimension(seq) {
        const scales = [2, 3, 4, 6, 8, 12, 16];
        const points = [];
        for (const sc of scales) {
            if (seq.length < sc) break;
            const patterns = new Set();
            for (let i = 0; i <= seq.length - sc; i++) patterns.add(seq.slice(i, i + sc).join(''));
            points.push({ scale: sc, count: patterns.size });
        }
        if (points.length < 2) return 1;
        const n = points.length;
        let sx = 0, sy = 0, sxy = 0, sx2 = 0;
        for (const p of points) {
            const x = Math.log(1 / p.scale), y = Math.log(p.count);
            sx += x; sy += y; sxy += x * y; sx2 += x * x;
        }
        return (n * sxy - sx * sy) / (n * sx2 - sx * sx + 0.001);
    }
    
    train(data) {
        for (let i = 45; i < data.length; i++) {
            const window = data.slice(i - 45, i);
            const dim = Math.round(this.calcDimension(window) * 20);
            const key = String(dim);
            if (!this.db.has(key)) this.db.set(key, { T: 0, X: 0, total: 0 });
            const d = this.db.get(key);
            d[data[i]] = (d[data[i]] || 0) + 1;
            d.total++;
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (seq.length < 45 || !this.trained) return null;
        const dim = Math.round(this.calcDimension(seq.slice(-45)) * 20);
        const d = this.db.get(String(dim));
        if (!d || d.total < 5) return null;
        return { prob: Math.max(0.08, Math.min(0.92, d.T / d.total)), conf: Math.min(0.9, d.total / 90) };
    }
}

class EntropyFlowEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    
    calcEntropy(seq) {
        const wins = [3, 5, 8, 13, 21];
        const entropies = [];
        for (const w of wins) {
            if (seq.length >= w) {
                const sl = seq.slice(-w);
                const p = sl.filter(s => s === 'T').length / w;
                let e = 0;
                if (p > 0 && p < 1) e = -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
                entropies.push(e);
            }
        }
        const avgE = entropies.reduce((a, b) => a + b, 0) / (entropies.length || 1);
        const stability = 1 - (entropies.length > 1 ? Math.max(...entropies) - Math.min(...entropies) : 0);
        return { entropy: avgE, stability };
    }
    
    train(data) {
        for (let i = 45; i < data.length; i++) {
            const window = data.slice(i - 45, i);
            const ent = this.calcEntropy(window);
            const key = `${Math.round(ent.entropy * 10)}|${Math.round(ent.stability * 10)}`;
            if (!this.db.has(key)) this.db.set(key, { T: 0, X: 0, total: 0 });
            const d = this.db.get(key);
            d[data[i]] = (d[data[i]] || 0) + 1;
            d.total++;
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (seq.length < 45 || !this.trained) return null;
        const ent = this.calcEntropy(seq.slice(-45));
        const key = `${Math.round(ent.entropy * 10)}|${Math.round(ent.stability * 10)}`;
        const d = this.db.get(key);
        if (!d || d.total < 5) return null;
        const prob = d.T / d.total;
        return { prob: Math.max(0.08, Math.min(0.92, prob * 0.7 + (ent.stability > 0.5 ? 0.3 : 0))), conf: Math.min(0.9, d.total / 80) };
    }
}

class MomentumTrendEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    
    calcMomentum(seq) {
        const r3 = seq.slice(-3).filter(s => s === 'T').length / 3;
        const r8 = seq.slice(-8).filter(s => s === 'T').length / 8;
        const r21 = seq.slice(-21).filter(s => s === 'T').length / 21;
        return { short: r3 - 0.5, medium: r8 - 0.5, long: r21 - 0.5 };
    }
    
    train(data) {
        for (let i = 40; i < data.length; i++) {
            const window = data.slice(i - 40, i);
            const mom = this.calcMomentum(window);
            const key = `${Math.round(mom.short * 10)}|${Math.round(mom.medium * 10)}`;
            if (!this.db.has(key)) this.db.set(key, { T: 0, X: 0, total: 0 });
            const d = this.db.get(key);
            d[data[i]] = (d[data[i]] || 0) + 1;
            d.total++;
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (seq.length < 40 || !this.trained) return null;
        const mom = this.calcMomentum(seq.slice(-40));
        const key = `${Math.round(mom.short * 10)}|${Math.round(mom.medium * 10)}`;
        const d = this.db.get(key);
        if (!d || d.total < 5) return null;
        return { prob: Math.max(0.08, Math.min(0.92, d.T / d.total)), conf: Math.min(0.9, d.total / 70) };
    }
}

class PatternRecognitionEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    
    train(data) {
        for (let i = 20; i < data.length; i++) {
            const window = data.slice(i - 20, i);
            for (const len of [3, 5, 8, 13]) {
                if (window.length >= len) {
                    const pattern = window.slice(-len).join('');
                    if (!this.db.has(pattern)) this.db.set(pattern, { T: 0, X: 0, total: 0 });
                    const d = this.db.get(pattern);
                    d[data[i]] = (d[data[i]] || 0) + 1;
                    d.total++;
                }
            }
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained) return null;
        let probSum = 0, weightSum = 0;
        for (const len of [3, 5, 8, 13]) {
            if (seq.length >= len) {
                const pattern = seq.slice(-len).join('');
                const d = this.db.get(pattern);
                if (d && d.total >= 5) {
                    const w = len / 13;
                    probSum += (d.T / d.total) * w;
                    weightSum += w;
                }
            }
        }
        if (weightSum === 0) return null;
        return { prob: Math.max(0.08, Math.min(0.92, probSum / weightSum)), conf: Math.min(0.85, weightSum) };
    }
}

// ============================================================
// 🧠 PREDICTION SYSTEM
// ============================================================

class PredictionSystem {
    constructor(type) {
        this.type = type;
        this.history = [];
        this.stats = { total: 0, dung: 0, sai: 0, tyle: 0, chuoi: 0, chuoi_dai: 0, homnay: { dung: 0, sai: 0, tong: 0 } };
        this.lastPhien = null;
        this.trained = false;
        
        this.engines = [
            { name: 'QS', engine: new QuantumSpectralEngine(), weight: 3.5 },
            { name: 'FG', engine: new FractalGeometryEngine(), weight: 2.8 },
            { name: 'EF', engine: new EntropyFlowEngine(), weight: 2.5 },
            { name: 'MT', engine: new MomentumTrendEngine(), weight: 2.2 },
            { name: 'PR', engine: new PatternRecognitionEngine(), weight: 2.0 }
        ];
        
        this.streakBank = new Map();
    }
    
    train(data) {
        if (data.length < 60) return false;
        try {
            for (const e of this.engines) e.engine.train(data);
            this.streakBank.clear();
            for (let i = 20; i < data.length; i++) {
                const window = data.slice(i - 20, i);
                const last = window[window.length - 1];
                let streak = 1;
                for (let j = window.length - 2; j >= 0 && window[j] === last; j--) streak++;
                const sk = `${last}:${Math.min(streak, 15)}`;
                if (!this.streakBank.has(sk)) this.streakBank.set(sk, { T: 0, X: 0, total: 0 });
                const sb = this.streakBank.get(sk);
                sb[data[i]] = (sb[data[i]] || 0) + 1;
                sb.total++;
            }
            this.trained = true;
            return true;
        } catch (e) { return false; }
    }
    
    predict(data) {
        if (!data || data.length < 10) return this.fallback();
        const seq = data.map(d => d === 'T' ? 'T' : 'X');
        let sT = 0, sX = 0, sw = 0;
        const details = [];
        
        for (const e of this.engines) {
            const r = e.engine.predict(seq);
            if (r) {
                const w = e.weight * r.conf;
                sT += r.prob * w;
                sX += (1 - r.prob) * w;
                sw += w;
                details.push(`${e.name}:${Math.round(r.prob * 100)}`);
            }
        }
        
        const last = seq[seq.length - 1];
        let streak = 1;
        for (let j = seq.length - 2; j >= 0 && seq[j] === last; j--) streak++;
        const sk = `${last}:${Math.min(streak, 15)}`;
        const sb = this.streakBank.get(sk);
        if (sb && sb.total >= 5) {
            const w = 1.8;
            sT += (sb.T / sb.total) * w;
            sX += (sb.X / sb.total) * w;
            sw += w;
            details.push(`ST:${Math.min(streak, 15)}`);
        }
        
        if (streak >= 8) {
            if (last === 'T') { sX += 4.0; details.push('BREAK-T'); }
            else { sT += 4.0; details.push('BREAK-X'); }
            sw += 4.0;
        } else if (streak >= 5) {
            if (last === 'T') { sX += 2.5; details.push('WEAK-T'); }
            else { sT += 2.5; details.push('WEAK-X'); }
            sw += 2.5;
        }
        
        const longT = seq.filter(s => s === 'T').length / seq.length;
        if (longT > 0.68) { sX += 2.5; details.push('BAL-T'); sw += 2.5; }
        else if (longT < 0.32) { sT += 2.5; details.push('BAL-X'); sw += 2.5; }
        
        if (sw === 0) return this.fallback();
        const prob = sT / (sT + sX);
        const duDoan = prob > 0.5 ? 'TÀI' : 'XỈU';
        let doTinCay = Math.round(Math.max(prob, 1 - prob) * 100);
        if (details.length >= 8) doTinCay = Math.min(99, doTinCay + 10);
        else if (details.length >= 5) doTinCay = Math.min(99, doTinCay + 6);
        doTinCay = Math.min(99, Math.max(55, doTinCay));
        
        return { duDoan, doTinCay, chiTiet: details.slice(0, 6).join(' | '), soMau: details.length };
    }
    
    fallback() {
        if (this.stats.total > 50) {
            return { duDoan: this.stats.dung > this.stats.sai ? 'TÀI' : 'XỈU', doTinCay: 52, chiTiet: 'TREND', soMau: 0 };
        }
        return { duDoan: 'TÀI', doTinCay: 51, chiTiet: 'DEFAULT', soMau: 0 };
    }
    
    updateResult(prediction, actual) {
        const pred = prediction === 'TÀI' ? 'T' : 'X';
        const act = actual === 'TÀI' ? 'T' : 'X';
        const dung = pred === act;
        this.stats.total++;
        if (dung) {
            this.stats.dung++;
            this.stats.chuoi = this.stats.chuoi >= 0 ? this.stats.chuoi + 1 : 1;
            if (this.stats.chuoi > this.stats.chuoi_dai) this.stats.chuoi_dai = this.stats.chuoi;
            this.stats.homnay.dung++;
        } else {
            this.stats.sai++;
            this.stats.chuoi = this.stats.chuoi <= 0 ? this.stats.chuoi - 1 : -1;
            this.stats.homnay.sai++;
        }
        this.stats.homnay.tong++;
        this.stats.tyle = this.stats.total > 0 ? Math.round((this.stats.dung / this.stats.total) * 100) : 0;
    }
    
    save() {
        try {
            const data = secureEncrypt(JSON.stringify({
                streakBank: Array.from(this.streakBank.entries()),
                trained: this.trained, stats: this.stats, lastPhien: this.lastPhien,
                history: this.history.slice(0, 1000)
            }));
            if (data) fs.writeFileSync(`.${this.type}_data`, data);
        } catch (e) {}
    }
    
    load() {
        try {
            const file = `.${this.type}_data`;
            if (fs.existsSync(file)) {
                const decrypted = secureDecrypt(fs.readFileSync(file, 'utf8'));
                if (decrypted) {
                    const d = JSON.parse(decrypted);
                    if (d.streakBank) this.streakBank = new Map(d.streakBank);
                    if (d.trained) this.trained = d.trained;
                    if (d.stats) this.stats = d.stats;
                    if (d.lastPhien) this.lastPhien = d.lastPhien;
                    if (d.history) this.history = d.history;
                }
            }
        } catch (e) {}
    }
}

const brainHU = new PredictionSystem('hu');
const brainMD5 = new PredictionSystem('md5');
brainHU.load();
brainMD5.load();

// ============================================================
// 📊 DATA
// ============================================================
function transformData(apiData) {
    if (!apiData || !apiData.list) return null;
    return apiData.list.map(item => ({
        phien: item.id,
        result: item.resultTruyenThong === 'TAI' ? 'TÀI' : 'XỈU',
        dice1: item.dices[0], dice2: item.dices[1], dice3: item.dices[2],
        total: item.point
    }));
}

async function fetchData(type) {
    try {
        const url = type === 'hu' ? API_URL_HU : API_URL_MD5;
        const r = await axios.get(url, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } });
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
            const actual = data.find(d => d.phien.toString() === r.phien_hien_tai);
            if (actual) {
                r.status = (r.prediction === actual.result) ? '✅' : '❌';
                r.actual = actual.result;
                brain.updateResult(r.prediction, actual.result);
            }
        }
        
        const exist = brain.history.find(h => h.phien_hien_tai === (cur + 1).toString());
        if (exist) return;
        
        const hd = data.map(d => d.result === 'TÀI' ? 'T' : 'X');
        if (hd.length >= 60) brain.train(hd);
        
        const result = brain.predict(hd);
        const rec = {
            phien: data[0].phien, phien_hien_tai: (data[0].phien + 1).toString(),
            dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`,
            total: data[0].total, actual: data[0].result,
            prediction: result.duDoan, confidence: result.doTinCay,
            detail: result.chiTiet, status: '',
            timestamp: new Date().toISOString(), soMau: result.soMau || 0
        };
        brain.history.unshift(rec);
        if (brain.history.length > 1000) brain.history = brain.history.slice(0, 1000);
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
// 🎨 GIAO DIỆN WEB CÔNG NGHỆ CAO
// ============================================================

function getBaseHTML(title, content, extraHead = '') {
    return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | CRYSTAL TX</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #030712;
            --bg2: #0a0f1e;
            --bg3: #111827;
            --bg4: #1a1f35;
            --border: rgba(255,255,255,0.04);
            --border-active: rgba(123,97,255,0.25);
            --text: #e2e8f0;
            --text2: #8899b8;
            --text3: #4a5578;
            --gradient: linear-gradient(135deg, #7b61ff 0%, #3b82f6 50%, #06b6d4 100%);
            --gradient2: linear-gradient(135deg, #7b61ff, #8b5cf6, #6366f1);
            --success: #22c55e;
            --danger: #ef4444;
            --warning: #f59e0b;
            --info: #06b6d4;
            --purple: #7b61ff;
            --glow: 0 0 40px rgba(123,97,255,0.1);
        }
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased}
        
        .ambient-bg{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none}
        .ambient-bg .orb{position:absolute;border-radius:50%;filter:blur(120px);opacity:0.4}
        .ambient-bg .orb1{width:600px;height:600px;background:rgba(123,97,255,0.08);top:-200px;left:-100px;animation:float1 20s ease-in-out infinite}
        .ambient-bg .orb2{width:500px;height:500px;background:rgba(6,182,212,0.06);bottom:-150px;right:-100px;animation:float2 25s ease-in-out infinite}
        .ambient-bg .orb3{width:400px;height:400px;background:rgba(139,92,246,0.05);top:50%;left:50%;transform:translate(-50%,-50%);animation:float3 30s ease-in-out infinite}
        @keyframes float1{0%,100%{transform:translate(0,0)}50%{transform:translate(100px,50px)}}
        @keyframes float2{0%,100%{transform:translate(0,0)}50%{transform:translate(-80px,-40px)}}
        @keyframes float3{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.2)}}
        
        .grid-overlay{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px);background-size:50px 50px;mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 15%,transparent 70%)}
        
        .app{position:relative;z-index:1;max-width:1200px;margin:0 auto;padding:16px 20px}
        
        .glass-card{background:rgba(17,24,39,0.7);backdrop-filter:blur(20px);border:1px solid var(--border);border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.3)}
        
        .btn-primary{display:inline-flex;align-items:center;gap:8px;padding:10px 24px;background:var(--gradient);border:none;border-radius:10px;color:#fff;font-weight:600;font-size:13px;cursor:pointer;letter-spacing:0.5px;transition:all 0.3s;font-family:'Space Grotesk',sans-serif}
        .btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(123,97,255,0.3)}
        
        .btn-outline{display:inline-flex;align-items:center;gap:8px;padding:10px 24px;background:transparent;border:1px solid var(--border-active);border-radius:10px;color:var(--purple);font-weight:600;font-size:13px;cursor:pointer;letter-spacing:0.5px;transition:all 0.3s;font-family:'Space Grotesk',sans-serif}
        .btn-outline:hover{background:rgba(123,97,255,0.05);box-shadow:0 4px 20px rgba(123,97,255,0.1)}
        
        input[type="text"],input[type="password"]{width:100%;padding:12px 16px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;font-family:'JetBrains Mono',monospace;outline:none;transition:all 0.3s}
        input:focus{border-color:var(--border-active);box-shadow:0 0 0 3px rgba(123,97,255,0.1)}
        
        .alert{padding:14px 18px;border-radius:10px;font-size:13px;font-weight:500;display:flex;align-items:center;gap:10px}
        .alert-success{background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);color:var(--success)}
        .alert-error{background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);color:var(--danger)}
        .alert-info{background:rgba(6,182,212,0.08);border:1px solid rgba(6,182,212,0.2);color:var(--info)}
        
        .badge{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:20px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px}
        .badge-success{background:rgba(34,197,94,0.08);color:var(--success);border:1px solid rgba(34,197,94,0.15)}
        .badge-info{background:rgba(6,182,212,0.08);color:var(--info);border:1px solid rgba(6,182,212,0.15)}
        .badge-purple{background:rgba(123,97,255,0.08);color:var(--purple);border:1px solid rgba(123,97,255,0.15)}
        
        .pulse-dot{width:8px;height:8px;border-radius:50%;background:var(--success);animation:pulse 1.5s ease-in-out infinite;box-shadow:0 0 12px rgba(34,197,94,0.4);display:inline-block}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.7)}}
        
        .fade-in{animation:fadeIn 0.5s ease-out}
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        
        .slide-up{animation:slideUp 0.5s ease-out}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        
        ::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.06);border-radius:2px}
        
        .text-gradient{background:var(--gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        
        ${extraHead}
    </style>
</head>
<body>
    <div class="ambient-bg">
        <div class="orb orb1"></div>
        <div class="orb orb2"></div>
        <div class="orb orb3"></div>
    </div>
    <div class="grid-overlay"></div>
    <div class="app">
        ${content}
    </div>
</body>
</html>`;
}

function generateLoginPage(errorMsg = '') {
    const errorHTML = errorMsg ? `<div class="alert alert-error fade-in"><span>⚠️</span> ${errorMsg}</div>` : '';
    
    const content = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh">
        <div class="glass-card slide-up" style="width:100%;max-width:440px;padding:40px 32px">
            <div style="text-align:center;margin-bottom:32px">
                <div style="font-size:48px;margin-bottom:12px;animation:float 3s ease-in-out infinite">💎</div>
                <h1 style="font-family:'Orbitron',sans-serif;font-size:26px;font-weight:900;margin-bottom:4px"><span class="text-gradient">CRYSTAL TX</span></h1>
                <p style="font-size:11px;color:var(--text3);font-family:'JetBrains Mono',monospace;letter-spacing:2px;text-transform:uppercase">Admin Console • By Anh Khôi</p>
            </div>
            
            ${errorHTML}
            
            <form id="loginForm" onsubmit="handleLogin(event)" style="margin-top:20px">
                <div style="margin-bottom:16px">
                    <label style="display:block;font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;font-weight:600">👤 Username</label>
                    <input type="text" id="username" placeholder="Nhập username admin" required autocomplete="off">
                </div>
                <div style="margin-bottom:20px">
                    <label style="display:block;font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;font-weight:600">🔒 Password</label>
                    <input type="password" id="password" placeholder="Nhập password admin" required autocomplete="off">
                </div>
                <button type="submit" class="btn-primary" style="width:100%;justify-content:center;font-size:14px;padding:14px">
                    <span>🔐</span> Đăng Nhập Hệ Thống
                </button>
            </form>
            
            <div id="resultArea" style="margin-top:20px;display:none"></div>
            
            <div style="text-align:center;margin-top:24px;padding-top:20px;border-top:1px solid var(--border)">
                <p style="font-size:9px;color:var(--text3);font-family:'JetBrains Mono',monospace">
                    💎 <span style="color:var(--purple)">CRYSTAL TX</span> • Hệ Thống Dự Đoán Độc Quyền • v70.0
                </p>
            </div>
        </div>
    </div>
    
    <script>
    async function handleLogin(e) {
        e.preventDefault();
        const u = document.getElementById('username').value.trim();
        const p = document.getElementById('password').value.trim();
        const resultArea = document.getElementById('resultArea');
        
        if (!u || !p) {
            resultArea.style.display = 'block';
            resultArea.innerHTML = '<div class="alert alert-error fade-in"><span>⚠️</span> Vui lòng nhập đầy đủ username và password</div>';
            return;
        }
        
        resultArea.style.display = 'block';
        resultArea.innerHTML = '<div class="alert alert-info fade-in"><span>⏳</span> Đang xác thực...</div>';
        
        try {
            const r = await fetch('/_api/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({username: u, password: p})
            });
            const d = await r.json();
            
            if (r.ok && d.token) {
                const expireDate = new Date(d.expires).toLocaleString('vi-VN');
                resultArea.innerHTML = \`
                    <div class="alert alert-success fade-in">
                        <span>✅</span> Đăng nhập thành công!
                    </div>
                    <div class="glass-card" style="margin-top:16px;padding:20px">
                        <p style="font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;font-weight:600">🔑 Token Admin (24h)</p>
                        <div style="background:var(--bg3);padding:12px;border-radius:8px;margin-bottom:12px">
                            <code style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--success);word-break:break-all">\${d.token}</code>
                        </div>
                        <p style="font-size:9px;color:var(--text3);margin-bottom:16px">⏰ Hết hạn: \${expireDate}</p>
                        
                        <p style="font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;font-weight:600">📡 Đường Dẫn Truy Cập</p>
                        <div style="display:flex;flex-direction:column;gap:8px;font-family:'JetBrains Mono',monospace;font-size:10px">
                            <a href="/_hu?_token=\${d.token}" style="color:var(--info);text-decoration:none;padding:8px 12px;background:var(--bg3);border-radius:6px;border:1px solid var(--border);transition:all 0.3s" onmouseover="this.style.borderColor='var(--border-active)'" onmouseout="this.style.borderColor='var(--border)'">📊 Dashboard HU →</a>
                            <a href="/_md5?_token=\${d.token}" style="color:var(--info);text-decoration:none;padding:8px 12px;background:var(--bg3);border-radius:6px;border:1px solid var(--border);transition:all 0.3s" onmouseover="this.style.borderColor='var(--border-active)'" onmouseout="this.style.borderColor='var(--border)'">📊 Dashboard MD5 →</a>
                            <a href="/_hu/json?_token=\${d.token}" style="color:var(--purple);text-decoration:none;padding:8px 12px;background:var(--bg3);border-radius:6px;border:1px solid var(--border);transition:all 0.3s" onmouseover="this.style.borderColor='var(--border-active)'" onmouseout="this.style.borderColor='var(--border)'">📡 JSON API HU →</a>
                            <a href="/_md5/json?_token=\${d.token}" style="color:var(--purple);text-decoration:none;padding:8px 12px;background:var(--bg3);border-radius:6px;border:1px solid var(--border);transition:all 0.3s" onmouseover="this.style.borderColor='var(--border-active)'" onmouseout="this.style.borderColor='var(--border)'">📡 JSON API MD5 →</a>
                        </div>
                    </div>
                \`;
            } else {
                resultArea.innerHTML = \`<div class="alert alert-error fade-in"><span>❌</span> \${d.error || 'Sai thông tin đăng nhập'}</div>\`;
            }
        } catch(ex) {
            resultArea.innerHTML = '<div class="alert alert-error fade-in"><span>🔌</span> Lỗi kết nối đến máy chủ</div>';
        }
    }
    </script>
    <style>
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
    </style>
    `;
    
    return getBaseHTML('Đăng Nhập Admin', content);
}

function generateDashboardPage(brain, type) {
    const s = brain.stats;
    const recent = (brain.history || []).slice(0, 50);
    
    let td = 0, ts = 0, cht = 0, cdn = 0, ct = 0;
    for (const r of recent) {
        if (r.status === '✅') { td++; ct++; if (ct > cdn) cdn = ct; }
        else if (r.status === '❌') { ts++; ct = 0; }
    }
    cht = ct;
    const wr = s.tyle;
    const wc = wr >= 70 ? 'var(--success)' : wr >= 60 ? 'var(--warning)' : 'var(--danger)';
    const wrLabel = wr >= 70 ? 'Xuất sắc' : wr >= 60 ? 'Tốt' : 'Đang cải thiện';
    
    let rows = '';
    for (const r of recent) {
        const st = r.status || '⏳';
        const cls = st === '✅' ? 's' : st === '❌' ? 'd' : 'w';
        const txt = st === '✅' ? 'WIN' : st === '❌' ? 'LOSE' : 'WAIT';
        rows += `<tr class="row-${cls}">
            <td class="mono">#${r.phien_hien_tai || '-'}</td>
            <td><span class="pred pred-${r.prediction === 'TÀI' ? 't' : 'x'}">${r.prediction || '-'}</span></td>
            <td><div class="conf-bar"><div class="conf-fill" style="width:${r.confidence || 0}%"></div></div><span class="conf-text">${r.confidence || 0}%</span></td>
            <td><span class="status status-${cls}">${txt}</span></td>
            <td>${r.actual || '-'}</td>
            <td class="detail">${(r.detail || '-').substring(0, 30)}</td>
        </tr>`;
    }
    
    const content = `
    <div style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px">
            <div style="display:flex;align-items:center;gap:12px">
                <div style="font-size:32px">💎</div>
                <div>
                    <h1 style="font-family:'Orbitron',sans-serif;font-size:22px;font-weight:800"><span class="text-gradient">CRYSTAL TX</span></h1>
                    <p style="font-size:9px;color:var(--text3);font-family:'JetBrains Mono',monospace;letter-spacing:2px">${type.toUpperCase()} • By Anh Khôi • v70.0</p>
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:16px">
                <div class="badge badge-success"><span class="pulse-dot"></span> LIVE</div>
                <div style="text-align:right">
                    <div style="font-family:'Orbitron',monospace;font-size:28px;font-weight:800;color:${wc}">${wr}%</div>
                    <div style="font-size:8px;color:var(--text3);text-transform:uppercase;letter-spacing:1px">Tỷ lệ thắng</div>
                </div>
                <svg width="52" height="52" viewBox="0 0 52 52" style="transform:rotate(-90deg)">
                    <circle cx="26" cy="26" r="23" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="4"/>
                    <circle cx="26" cy="26" r="23" fill="none" stroke="${wc}" stroke-width="4" stroke-linecap="round" 
                        stroke-dasharray="144.5" stroke-dashoffset="${144.5 - (144.5 * wr / 100)}" style="transition:stroke-dashoffset 1s ease"/>
                </svg>
            </div>
        </div>
    </div>
    
    <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:20px">
        <div class="glass-card" style="padding:14px;text-align:center">
            <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Tổng</div>
            <div style="font-family:'Orbitron',monospace;font-size:20px;font-weight:700">${s.total}</div>
        </div>
        <div class="glass-card" style="padding:14px;text-align:center">
            <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Đúng</div>
            <div style="font-family:'Orbitron',monospace;font-size:20px;font-weight:700;color:var(--success)">${s.dung}</div>
        </div>
        <div class="glass-card" style="padding:14px;text-align:center">
            <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Sai</div>
            <div style="font-family:'Orbitron',monospace;font-size:20px;font-weight:700;color:var(--danger)">${s.sai}</div>
        </div>
        <div class="glass-card" style="padding:14px;text-align:center">
            <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Chuỗi</div>
            <div style="font-family:'Orbitron',monospace;font-size:20px;font-weight:700;color:${s.chuoi>0?'var(--success)':s.chuoi<0?'var(--danger)':'var(--warning)'}">${s.chuoi>0?'+'+s.chuoi:s.chuoi}</div>
        </div>
        <div class="glass-card" style="padding:14px;text-align:center">
            <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Kỷ Lục</div>
            <div style="font-family:'Orbitron',monospace;font-size:20px;font-weight:700;color:var(--purple)">${s.chuoi_dai}</div>
        </div>
        <div class="glass-card" style="padding:14px;text-align:center">
            <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Đánh Giá</div>
            <div style="font-family:'Orbitron',monospace;font-size:20px;font-weight:700;color:${wc}">${wrLabel}</div>
        </div>
    </div>
    
    <div class="glass-card" style="overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--border)">
            <h3 style="font-family:'Orbitron',monospace;font-size:12px;font-weight:600">📊 Lịch Sử 50 Phiên</h3>
            <div style="display:flex;gap:8px;align-items:center">
                <span style="font-size:9px;color:var(--text3);font-family:'JetBrains Mono',monospace">${recent.length} phiên</span>
                <span class="badge badge-purple">5 Engines</span>
            </div>
        </div>
        <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:10px">
                <thead>
                    <tr style="background:rgba(255,255,255,0.01)">
                        <th style="padding:8px 12px;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:1px;color:var(--text3)">Phiên</th>
                        <th style="padding:8px 12px;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:1px;color:var(--text3)">Dự Đoán</th>
                        <th style="padding:8px 12px;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:1px;color:var(--text3)">Độ Tin</th>
                        <th style="padding:8px 12px;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:1px;color:var(--text3)">KQ</th>
                        <th style="padding:8px 12px;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:1px;color:var(--text3)">Thực Tế</th>
                        <th style="padding:8px 12px;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:1px;color:var(--text3)">Engines</th>
                    </tr>
                </thead>
                <tbody>${rows || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3)">Đang tải dữ liệu...</td></tr>'}</tbody>
            </table>
        </div>
    </div>
    
    <div style="text-align:center;margin-top:16px;padding:12px;font-size:8px;color:var(--text3);font-family:'JetBrains Mono',monospace">
        💎 <span style="color:var(--purple)">CRYSTAL TX</span> • QS • FG • EF • MT • PR • By Anh Khôi • ${new Date().toLocaleString('vi-VN')}
    </div>
    
    <style>
        .mono{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text2)}
        .pred{display:inline-block;padding:3px 10px;border-radius:6px;font-weight:700;font-size:9px}
        .pred-t{background:rgba(34,197,94,0.08);color:var(--success)}
        .pred-x{background:rgba(239,68,68,0.08);color:var(--danger)}
        .conf-bar{display:inline-block;width:40px;height:3px;background:rgba(255,255,255,0.05);border-radius:2px;vertical-align:middle;margin-right:6px}
        .conf-fill{height:100%;border-radius:2px;background:var(--gradient)}
        .conf-text{font-weight:600;color:var(--info);font-size:9px}
        .status{display:inline-block;padding:2px 8px;border-radius:4px;font-weight:700;font-size:7px;text-transform:uppercase;letter-spacing:1px}
        .status-s{background:rgba(34,197,94,0.08);color:var(--success)}
        .status-d{background:rgba(239,68,68,0.08);color:var(--danger)}
        .status-w{background:rgba(245,158,11,0.08);color:var(--warning)}
        .detail{font-size:8px;color:var(--text3);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        tr:hover td{background:rgba(255,255,255,0.01)}
        .row-s{border-left:2px solid transparent}.row-s:hover{border-left-color:rgba(34,197,94,0.25)}
        .row-d{border-left:2px solid transparent}.row-d:hover{border-left-color:rgba(239,68,68,0.25)}
        .row-w{border-left:2px solid transparent}.row-w:hover{border-left-color:rgba(245,158,11,0.25)}
        @media(max-width:768px){.pred,.status{font-size:7px}.conf-text{font-size:7px}}
    </style>
    <script>setTimeout(()=>location.reload(),5000);</script>
    `;
    
    return getBaseHTML(`${type.toUpperCase()} Dashboard`, content);
}

// ============================================================
// 🔌 API ENDPOINTS
// ============================================================

// Trang login - QUAN TRỌNG: set Content-Type để trình duyệt hiển thị
app.get('/_login', (req, res) => {
    const error = req.query.error === 'unauthorized' ? 'Bạn cần đăng nhập để truy cập' :
                  req.query.error === 'expired' ? 'Token đã hết hạn, vui lòng đăng nhập lại' : '';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(generateLoginPage(error));
});

// Redirect root đến login
app.get('/', (req, res) => {
    res.redirect('/_login');
});

// API Login
app.post('/_api/login', (req, res) => {
    const { username, password } = req.body || {};
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Thiếu username hoặc password' });
    }
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = generateAdminToken();
        return res.json({ 
            token: token, 
            expires: Date.now() + 86400000,
            message: 'Đăng nhập thành công' 
        });
    }
    
    return res.status(401).json({ error: 'Sai username hoặc password' });
});

// Dashboard + JSON API
app.get('/_hu', adminAuth, async (req, res) => {
    const data = await fetchData('hu');
    if (data) {
        for (const r of brainHU.history) {
            if (r.status && r.status !== '') continue;
            const a = data.find(d => d.phien.toString() === r.phien_hien_tai);
            if (a) { r.status = (r.prediction === a.result) ? '✅' : '❌'; r.actual = a.result; brainHU.updateResult(r.prediction, a.result); }
        }
        brainHU.save();
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(generateDashboardPage(brainHU, 'hu'));
});

app.get('/_md5', adminAuth, async (req, res) => {
    const data = await fetchData('md5');
    if (data) {
        for (const r of brainMD5.history) {
            if (r.status && r.status !== '') continue;
            const a = data.find(d => d.phien.toString() === r.phien_hien_tai);
            if (a) { r.status = (r.prediction === a.result) ? '✅' : '❌'; r.actual = a.result; brainMD5.updateResult(r.prediction, a.result); }
        }
        brainMD5.save();
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(generateDashboardPage(brainMD5, 'md5'));
});

app.get('/_hu/json', adminAuth, async (req, res) => {
    try {
        const data = await fetchData('hu');
        if (!data || data.length === 0) { const r = brainHU.fallback(); return res.json({ prediction: r.duDoan, confidence: r.doTinCay, detail: r.chiTiet }); }
        const exist = brainHU.history.find(h => h.phien_hien_tai === (data[0].phien + 1).toString());
        if (exist) return res.json(exist);
        const hd = data.map(d => d.result === 'TÀI' ? 'T' : 'X');
        if (hd.length >= 60) brainHU.train(hd);
        const result = brainHU.predict(hd);
        const rec = { phien: data[0].phien, phien_hien_tai: (data[0].phien + 1).toString(), dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`, total: data[0].total, actual: data[0].result, prediction: result.duDoan, confidence: result.doTinCay, detail: result.chiTiet, status: '', timestamp: new Date().toISOString(), soMau: result.soMau || 0 };
        brainHU.history.unshift(rec);
        if (brainHU.history.length > 1000) brainHU.history = brainHU.history.slice(0, 1000);
        brainHU.save();
        res.json(rec);
    } catch (e) { res.status(500).json({ error: 'Lỗi hệ thống' }); }
});

app.get('/_md5/json', adminAuth, async (req, res) => {
    try {
        const data = await fetchData('md5');
        if (!data || data.length === 0) { const r = brainMD5.fallback(); return res.json({ prediction: r.duDoan, confidence: r.doTinCay, detail: r.chiTiet }); }
        const exist = brainMD5.history.find(h => h.phien_hien_tai === (data[0].phien + 1).toString());
        if (exist) return res.json(exist);
        const hd = data.map(d => d.result === 'TÀI' ? 'T' : 'X');
        if (hd.length >= 60) brainMD5.train(hd);
        const result = brainMD5.predict(hd);
        const rec = { phien: data[0].phien, phien_hien_tai: (data[0].phien + 1).toString(), dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`, total: data[0].total, actual: data[0].result, prediction: result.duDoan, confidence: result.doTinCay, detail: result.chiTiet, status: '', timestamp: new Date().toISOString(), soMau: result.soMau || 0 };
        brainMD5.history.unshift(rec);
        if (brainMD5.history.length > 1000) brainMD5.history = brainMD5.history.slice(0, 1000);
        brainMD5.save();
        res.json(rec);
    } catch (e) { res.status(500).json({ error: 'Lỗi hệ thống' }); }
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
        brain.history = [];
        brain.lastPhien = null;
        brain.save();
    });
    res.json({ message: 'Đã reset toàn bộ hệ thống' });
});

app.use((req, res) => res.status(404).send('Not Found'));
app.use((err, req, res, next) => { console.error(err); res.status(500).send('Server Error'); });

// ============================================================
// 🚀 START
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ CRYSTAL TX v70.0 đã khởi động trên cổng ${PORT}`);
    console.log(`🌐 Truy cập: http://localhost:${PORT}/_login\n`);
    startAuto();
});
