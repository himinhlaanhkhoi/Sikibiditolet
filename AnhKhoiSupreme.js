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
// 🔐 ADMIN SYSTEM
// ============================================================
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = crypto.randomBytes(10).toString('hex');
const ADMIN_TOKENS = new Map();
const SESSION_SECRET = crypto.randomBytes(32).toString('hex');

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  💎 CRYSTAL TX - THÔNG TIN ĐĂNG NHẬP                    ║');
console.log('╠══════════════════════════════════════════════════════════╣');
console.log(`║  👤 Username : ${ADMIN_USERNAME}                                      ║`);
console.log(`║  🔑 Password : ${ADMIN_PASSWORD}                            ║`);
console.log('╠══════════════════════════════════════════════════════════╣');
console.log('║  🌐 Truy cập trang login để lấy token                   ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

const generateAdminToken = () => {
    const token = crypto.randomBytes(64).toString('hex');
    ADMIN_TOKENS.set(token, Date.now() + 86400000);
    setTimeout(() => ADMIN_TOKENS.delete(token), 86400000);
    return token;
};

const adminAuth = (req, res, next) => {
    const token = req.headers['x-admin-token'] || req.query['_token'] || req.query['_admin'] || req.cookies?.admin_token;
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
// 🛡️ BẢO MẬT TỐI ĐA - CHỐNG DDoS, CHỐNG CRACK
// ============================================================

// Anti-DDoS: Theo dõi IP
const ipTracker = new Map();
const BLACKLIST = new Set();
const SUSPICIOUS_IPS = new Map();

app.use((req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    
    // Block blacklisted IPs
    if (BLACKLIST.has(ip)) {
        return res.status(403).end();
    }
    
    // Track requests
    if (!ipTracker.has(ip)) ipTracker.set(ip, []);
    const requests = ipTracker.get(ip).filter(t => now - t < 10000);
    
    // Phát hiện DDoS: >50 requests trong 10 giây
    if (requests.length > 50) {
        SUSPICIOUS_IPS.set(ip, (SUSPICIOUS_IPS.get(ip) || 0) + 1);
        if (SUSPICIOUS_IPS.get(ip) > 3) {
            BLACKLIST.add(ip);
            console.log(`🚫 IP bị chặn vĩnh viễn: ${ip}`);
        }
        return res.status(429).end();
    }
    
    requests.push(now);
    ipTracker.set(ip, requests);
    
    // Cleanup old entries
    if (ipTracker.size > 10000) {
        const keys = Array.from(ipTracker.keys());
        for (let i = 0; i < 1000; i++) ipTracker.delete(keys[i]);
    }
    
    next();
});

// Chặn User-Agent độc hại
app.use((req, res, next) => {
    const ua = (req.get('User-Agent') || '').toLowerCase();
    const blockedPatterns = [
        'sqlmap', 'nikto', 'nmap', 'burp', 'acunetix', 'nessus',
        'metasploit', 'hydra', 'gobuster', 'dirbuster', 'wpscan',
        'zap', 'scanner', 'bot', 'crawler', 'spider', 'semrush',
        'ahrefs', 'mj12bot', 'dotbot', 'petalbot', 'seznambot',
        'zgrab', 'gospider', 'headless', 'phantom', 'selenium'
    ];
    
    if (blockedPatterns.some(b => ua.includes(b))) {
        const ip = req.ip;
        BLACKLIST.add(ip);
        return res.status(403).end();
    }
    
    next();
});

// Chặn path độc hại
app.use((req, res, next) => {
    const path = req.path.toLowerCase();
    const blockedPaths = [
        '/admin', '/wp-admin', '/phpmyadmin', '/.env', '/.git',
        '/config', '/backup', '/login', '/shell', '/api', '/graphql',
        '/actuator', '/swagger', '/debug', '/test', '/dev',
        '/wp-login', '/xmlrpc.php', '/wp-content', '/wp-includes',
        '/vendor', '/node_modules', '/src', '/dist', '/build',
        '/.well-known', '/cgi-bin', '/server-status'
    ];
    
    if (blockedPaths.some(b => path.startsWith(b))) {
        return res.status(404).end();
    }
    
    // Chặn query injection
    if (req.query && Object.keys(req.query).length > 0) {
        const dangerous = [
            '<', '>', 'script', 'onerror', 'onload', 'javascript:',
            'union', 'select', 'insert', 'update', 'delete', 'drop',
            'exec', 'eval', 'alert', 'document', 'window', 'fetch(',
            'XMLHttpRequest', 'Function(', 'constructor', '__proto__',
            'require(', 'import(', 'process.', 'global.', 'Buffer(',
            'setTimeout', 'setInterval', 'then(', 'catch('
        ];
        for (const [key, value] of Object.entries(req.query)) {
            const str = String(value).toLowerCase();
            if (dangerous.some(d => str.includes(d))) {
                return res.status(403).end();
            }
        }
    }
    
    next();
});

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Server', 'CRYSTAL');
    next();
});

// ============================================================
// 🔐 MÃ HÓA AES-256-GCM
// ============================================================
const MASTER_KEY = crypto.createHash('sha512').update('crystal-tx-vip-ultimate-key-2024-secure').digest();

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
// 🧬 6 ENGINE DỰ ĐOÁN SIÊU CHÍNH XÁC
// ============================================================

class AdaptiveSpectralEngine {
    constructor() { this.db = new Map(); this.trained = false; this.accuracy = 0.5; }
    
    extractSpectrum(seq) {
        const signal = seq.map(v => v === 'T' ? 1 : -1);
        const features = [];
        for (const period of [2, 3, 5, 8, 13, 21, 34, 55]) {
            if (signal.length >= period) {
                let sinSum = 0, cosSum = 0;
                for (let i = 0; i < period; i++) {
                    const angle = (2 * Math.PI * i) / period;
                    const idx = signal.length - period + i;
                    sinSum += signal[idx] * Math.sin(angle);
                    cosSum += signal[idx] * Math.cos(angle);
                }
                features.push(Math.sqrt(sinSum * sinSum + cosSum * cosSum) / period);
                features.push(Math.atan2(sinSum, cosSum) / Math.PI);
            }
        }
        while (features.length < 16) features.push(0);
        return features;
    }
    
    train(data) {
        if (data.length < 60) return;
        for (let i = 60; i < data.length; i++) {
            const window = data.slice(i - 60, i);
            const spectrum = this.extractSpectrum(window);
            const key = spectrum.map(v => Math.round(v * 25)).join(',');
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
        const key = spectrum.map(v => Math.round(v * 25)).join(',');
        const d = this.db.get(key);
        if (!d || d.total < 5) {
            // Tìm pattern gần nhất
            let best = null, bestDist = Infinity;
            for (const [k, v] of this.db) {
                if (v.total < 10) continue;
                const parts = k.split(',').map(Number);
                const spectrumParts = spectrum.map(v => Math.round(v * 25));
                let dist = 0;
                for (let i = 0; i < Math.min(parts.length, spectrumParts.length); i++) {
                    dist += Math.abs(parts[i] - spectrumParts[i]);
                }
                if (dist < bestDist) { bestDist = dist; best = v; }
            }
            if (best) return { prob: Math.max(0.1, Math.min(0.9, best.T / best.total)), conf: 0.5 };
            return null;
        }
        const prob = d.T / d.total;
        return { prob: Math.max(0.08, Math.min(0.92, prob)), conf: Math.min(0.95, d.total / 150) };
    }
}

class AdaptiveGeometricEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    
    calcDimension(seq) {
        const scales = [2, 3, 4, 6, 8, 12, 16, 24];
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
        if (data.length < 50) return;
        for (let i = 50; i < data.length; i++) {
            const window = data.slice(i - 50, i);
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
        if (seq.length < 50 || !this.trained) return null;
        const dim = Math.round(this.calcDimension(seq.slice(-50)) * 20);
        const d = this.db.get(String(dim));
        if (!d || d.total < 5) return null;
        return { prob: Math.max(0.08, Math.min(0.92, d.T / d.total)), conf: Math.min(0.9, d.total / 100) };
    }
}

class AdaptiveEntropyEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    
    calcEntropy(seq) {
        const windows = [3, 5, 8, 13, 21, 34];
        const entropies = [];
        for (const w of windows) {
            if (seq.length >= w) {
                const sl = seq.slice(-w);
                const p = sl.filter(s => s === 'T').length / w;
                let e = 0;
                if (p > 0 && p < 1) e = -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
                entropies.push(e);
            }
        }
        return {
            avg: entropies.reduce((a, b) => a + b, 0) / (entropies.length || 1),
            var: entropies.length > 1 ? Math.max(...entropies) - Math.min(...entropies) : 0
        };
    }
    
    train(data) {
        if (data.length < 50) return;
        for (let i = 50; i < data.length; i++) {
            const window = data.slice(i - 50, i);
            const ent = this.calcEntropy(window);
            const key = `${Math.round(ent.avg * 10)}|${Math.round(ent.var * 10)}`;
            if (!this.db.has(key)) this.db.set(key, { T: 0, X: 0, total: 0 });
            const d = this.db.get(key);
            d[data[i]] = (d[data[i]] || 0) + 1;
            d.total++;
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (seq.length < 50 || !this.trained) return null;
        const ent = this.calcEntropy(seq.slice(-50));
        const key = `${Math.round(ent.avg * 10)}|${Math.round(ent.var * 10)}`;
        const d = this.db.get(key);
        if (!d || d.total < 5) return null;
        return { prob: Math.max(0.08, Math.min(0.92, d.T / d.total)), conf: Math.min(0.9, d.total / 90) };
    }
}

class AdaptiveMomentumEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    
    calcMomentum(seq) {
        const r3 = seq.slice(-3).filter(s => s === 'T').length / 3;
        const r5 = seq.slice(-5).filter(s => s === 'T').length / 5;
        const r8 = seq.slice(-8).filter(s => s === 'T').length / 8;
        const r13 = seq.slice(-13).filter(s => s === 'T').length / 13;
        const r21 = seq.slice(-21).filter(s => s === 'T').length / 21;
        return { short: r3 - r8, medium: r5 - r13, long: r8 - r21 };
    }
    
    train(data) {
        if (data.length < 45) return;
        for (let i = 45; i < data.length; i++) {
            const window = data.slice(i - 45, i);
            const mom = this.calcMomentum(window);
            const key = `${Math.round(mom.short * 10)}|${Math.round(mom.medium * 10)}|${Math.round(mom.long * 10)}`;
            if (!this.db.has(key)) this.db.set(key, { T: 0, X: 0, total: 0 });
            const d = this.db.get(key);
            d[data[i]] = (d[data[i]] || 0) + 1;
            d.total++;
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (seq.length < 45 || !this.trained) return null;
        const mom = this.calcMomentum(seq.slice(-45));
        const key = `${Math.round(mom.short * 10)}|${Math.round(mom.medium * 10)}|${Math.round(mom.long * 10)}`;
        const d = this.db.get(key);
        if (!d || d.total < 5) return null;
        return { prob: Math.max(0.08, Math.min(0.92, d.T / d.total)), conf: Math.min(0.9, d.total / 80) };
    }
}

class AdaptivePatternEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    
    train(data) {
        if (data.length < 25) return;
        for (let i = 25; i < data.length; i++) {
            const window = data.slice(i - 25, i);
            for (const len of [3, 5, 8, 13, 21]) {
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
        for (const len of [3, 5, 8, 13, 21]) {
            if (seq.length >= len) {
                const pattern = seq.slice(-len).join('');
                const d = this.db.get(pattern);
                if (d && d.total >= 5) {
                    const w = len;
                    probSum += (d.T / d.total) * w;
                    weightSum += w;
                }
            }
        }
        if (weightSum === 0) return null;
        return { prob: Math.max(0.08, Math.min(0.92, probSum / weightSum)), conf: Math.min(0.85, weightSum / 50) };
    }
}

class AdaptiveStreakEngine {
    constructor() { this.db = new Map(); this.trained = false; }
    
    train(data) {
        if (data.length < 20) return;
        for (let i = 20; i < data.length; i++) {
            const window = data.slice(i - 20, i);
            const last = window[window.length - 1];
            let streak = 1;
            for (let j = window.length - 2; j >= 0 && window[j] === last; j--) streak++;
            const sk = `${last}:${Math.min(streak, 20)}`;
            if (!this.db.has(sk)) this.db.set(sk, { T: 0, X: 0, total: 0 });
            const d = this.db.get(sk);
            d[data[i]] = (d[data[i]] || 0) + 1;
            d.total++;
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained) return null;
        const last = seq[seq.length - 1];
        let streak = 1;
        for (let j = seq.length - 2; j >= 0 && seq[j] === last; j--) streak++;
        const sk = `${last}:${Math.min(streak, 20)}`;
        const d = this.db.get(sk);
        if (!d || d.total < 5) return null;
        
        let prob = d.T / d.total;
        // Logic: nếu streak quá dài (>8) thì khả năng đảo chiều cao
        if (streak >= 10) prob = last === 'T' ? 0.15 : 0.85;
        else if (streak >= 7) prob = last === 'T' ? 0.25 : 0.75;
        else if (streak >= 5) prob = last === 'T' ? 0.35 : 0.65;
        
        return { prob: Math.max(0.08, Math.min(0.92, prob)), conf: Math.min(0.95, d.total / 50 + streak * 0.02) };
    }
}

// ============================================================
// 🧠 HỆ THỐNG DỰ ĐOÁN TỔNG HỢP
// ============================================================

class UltimatePredictionSystem {
    constructor(type) {
        this.type = type;
        this.history = [];
        this.stats = { total: 0, dung: 0, sai: 0, tyle: 0, chuoi: 0, chuoi_dai: 0, homnay: { dung: 0, sai: 0, tong: 0 } };
        this.lastPhien = null;
        this.trained = false;
        
        this.engines = [
            { name: 'SPECTRAL', engine: new AdaptiveSpectralEngine(), weight: 3.5 },
            { name: 'GEOMETRIC', engine: new AdaptiveGeometricEngine(), weight: 2.8 },
            { name: 'ENTROPY', engine: new AdaptiveEntropyEngine(), weight: 2.5 },
            { name: 'MOMENTUM', engine: new AdaptiveMomentumEngine(), weight: 2.2 },
            { name: 'PATTERN', engine: new AdaptivePatternEngine(), weight: 2.0 },
            { name: 'STREAK', engine: new AdaptiveStreakEngine(), weight: 1.8 }
        ];
        
        this.enginePerformance = new Map();
        this.engines.forEach(e => this.enginePerformance.set(e.name, { correct: 0, total: 0 }));
    }
    
    train(data) {
        if (data.length < 60) return false;
        try {
            for (const e of this.engines) e.engine.train(data);
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
            try {
                const r = e.engine.predict(seq);
                if (r) {
                    // Điều chỉnh weight theo performance
                    const perf = this.enginePerformance.get(e.name);
                    const perfWeight = perf && perf.total > 10 ? perf.correct / perf.total : 0.5;
                    const adjustedWeight = e.weight * (0.5 + perfWeight);
                    
                    const w = adjustedWeight * r.conf;
                    sT += r.prob * w;
                    sX += (1 - r.prob) * w;
                    sw += w;
                    details.push(`${e.name.substring(0,3)}:${Math.round(r.prob * 100)}`);
                }
            } catch (err) {}
        }
        
        // Long-term balance
        const longT = seq.filter(s => s === 'T').length / seq.length;
        if (longT > 0.7) { sX += 3.0; details.push('BAL:T>70'); sw += 3.0; }
        else if (longT < 0.3) { sT += 3.0; details.push('BAL:T<30'); sw += 3.0; }
        else if (longT > 0.6) { sX += 1.5; details.push('BAL:T>60'); sw += 1.5; }
        else if (longT < 0.4) { sT += 1.5; details.push('BAL:T<40'); sw += 1.5; }
        
        if (sw === 0) return this.fallback();
        
        const prob = sT / (sT + sX);
        const duDoan = prob > 0.5 ? 'TÀI' : 'XỈU';
        let doTinCay = Math.round(Math.max(prob, 1 - prob) * 100);
        
        // Bonus cho nhiều engines đồng thuận
        if (details.length >= 5) doTinCay = Math.min(99, doTinCay + 8);
        else if (details.length >= 3) doTinCay = Math.min(99, doTinCay + 5);
        
        doTinCay = Math.min(99, Math.max(55, doTinCay));
        
        return { duDoan, doTinCay, chiTiet: details.join(' | '), soMau: details.length, prob };
    }
    
    fallback() {
        if (this.stats.total > 50) {
            return { duDoan: this.stats.dung > this.stats.sai ? 'TÀI' : 'XỈU', doTinCay: 52, chiTiet: 'TREND', soMau: 0 };
        }
        return { duDoan: 'TÀI', doTinCay: 51, chiTiet: 'INIT', soMau: 0 };
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
        
        // Update engine performance
        if (this.lastPrediction) {
            const details = this.lastPrediction.chiTiet || '';
            for (const e of this.engines) {
                if (details.includes(e.name.substring(0, 3))) {
                    const perf = this.enginePerformance.get(e.name);
                    if (perf) {
                        perf.total++;
                        if (dung) perf.correct++;
                    }
                }
            }
        }
    }
    
    save() {
        try {
            const data = secureEncrypt(JSON.stringify({
                history: this.history.slice(0, 2000),
                stats: this.stats,
                lastPhien: this.lastPhien,
                trained: this.trained,
                enginePerformance: Array.from(this.enginePerformance.entries())
            }));
            if (data) fs.writeFileSync(`.${this.type}_vip`, data);
        } catch (e) {}
    }
    
    load() {
        try {
            const file = `.${this.type}_vip`;
            if (fs.existsSync(file)) {
                const decrypted = secureDecrypt(fs.readFileSync(file, 'utf8'));
                if (decrypted) {
                    const d = JSON.parse(decrypted);
                    if (d.history) this.history = d.history;
                    if (d.stats) this.stats = d.stats;
                    if (d.lastPhien) this.lastPhien = d.lastPhien;
                    if (d.trained) this.trained = d.trained;
                    if (d.enginePerformance) this.enginePerformance = new Map(d.enginePerformance);
                }
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
        const r = await axios.get(url, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0 CrystalTX/7.0' } });
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
        brain.lastPrediction = result;
        
        const rec = {
            phien: data[0].phien, phien_hien_tai: (data[0].phien + 1).toString(),
            dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`,
            total: data[0].total, actual: data[0].result,
            prediction: result.duDoan, confidence: result.doTinCay,
            detail: result.chiTiet, status: '',
            timestamp: new Date().toISOString(), soMau: result.soMau || 0
        };
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
// 🎨 GIAO DIỆN VIP PREMIUM
// ============================================================

function generateLoginPage(errorMsg = '') {
    const errorHTML = errorMsg ? `<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);padding:14px;border-radius:10px;color:#ef4444;font-size:13px;margin-bottom:16px;text-align:center;animation:fadeIn 0.3s"><span>⚠️</span> ${errorMsg}</div>` : '';
    
    return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>CRYSTAL TX | Admin Console</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #020617;
            --bg2: #0a0f24;
            --bg3: #111832;
            --bg4: #1a2040;
            --border: rgba(255,255,255,0.04);
            --border-active: rgba(123,97,255,0.3);
            --text: #e2e8f0;
            --text2: #8899b8;
            --text3: #4a5578;
            --gradient: linear-gradient(135deg, #7b61ff 0%, #3b82f6 30%, #06b6d4 60%, #8b5cf6 100%);
            --success: #22c55e;
            --danger: #ef4444;
            --warning: #f59e0b;
            --info: #06b6d4;
            --purple: #7b61ff;
        }
        *{margin:0;padding:0;box-sizing:border-box}
        body {
            font-family:'Inter',sans-serif;
            background:var(--bg);
            color:var(--text);
            min-height:100vh;
            display:flex;
            align-items:center;
            justify-content:center;
            overflow-x:hidden;
            -webkit-font-smoothing:antialiased;
            -webkit-user-select:none;
            user-select:none;
            -webkit-touch-callout:none;
        }
        
        .bg-orbs {position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none}
        .bg-orbs div {position:absolute;border-radius:50%;filter:blur(140px);opacity:0.5}
        .bg-orbs .o1 {width:700px;height:700px;background:rgba(123,97,255,0.1);top:-250px;left:-150px;animation:orb1 25s ease-in-out infinite}
        .bg-orbs .o2 {width:600px;height:600px;background:rgba(6,182,212,0.08);bottom:-200px;right:-150px;animation:orb2 30s ease-in-out infinite}
        .bg-orbs .o3 {width:500px;height:500px;background:rgba(139,92,246,0.06);top:50%;left:60%;animation:orb3 35s ease-in-out infinite}
        @keyframes orb1 {0%,100%{transform:translate(0,0)}50%{transform:translate(120px,80px)}}
        @keyframes orb2 {0%,100%{transform:translate(0,0)}50%{transform:translate(-100px,-60px)}}
        @keyframes orb3 {0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-80px,40px) scale(1.3)}}
        
        .grid-bg {position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;
            background-image:linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px);
            background-size:50px 50px;mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 10%,transparent 70%)}
        
        .login-card {
            position:relative;z-index:1;
            background:rgba(17,24,50,0.8);backdrop-filter:blur(30px);
            border:1px solid var(--border);border-radius:20px;
            padding:40px 32px;width:100%;max-width:440px;
            box-shadow:0 30px 80px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.02);
            animation:slideUp 0.6s ease-out;
        }
        @keyframes slideUp {from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn {from{opacity:0}to{opacity:1}}
        
        .logo-area {text-align:center;margin-bottom:28px}
        .logo-icon {font-size:52px;margin-bottom:12px;animation:float 3s ease-in-out infinite;display:inline-block}
        @keyframes float {0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        .logo-title {font-family:'Orbitron',sans-serif;font-size:28px;font-weight:900;background:var(--gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .logo-sub {font-size:10px;color:var(--text3);font-family:'JetBrains Mono',monospace;letter-spacing:3px;text-transform:uppercase;margin-top:4px}
        
        .form-group {margin-bottom:16px}
        .form-group label {display:block;font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600}
        .form-group input {
            width:100%;padding:12px 16px;background:var(--bg3);border:1px solid var(--border);
            border-radius:10px;color:var(--text);font-size:14px;font-family:'JetBrains Mono',monospace;
            outline:none;transition:all 0.3s
        }
        .form-group input:focus {border-color:var(--border-active);box-shadow:0 0 0 4px rgba(123,97,255,0.1)}
        
        .btn-login {
            width:100%;padding:14px;background:var(--gradient);border:none;border-radius:10px;
            color:#fff;font-weight:700;font-size:14px;cursor:pointer;
            font-family:'Space Grotesk',sans-serif;text-transform:uppercase;letter-spacing:1.5px;
            transition:all 0.3s;margin-top:8px
        }
        .btn-login:hover {transform:translateY(-2px);box-shadow:0 12px 40px rgba(123,97,255,0.35)}
        
        .result-box {margin-top:20px;display:none}
        .alert {padding:14px 16px;border-radius:10px;font-size:13px;font-weight:500;animation:fadeIn 0.3s}
        .alert-success {background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);color:var(--success)}
        .alert-error {background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);color:var(--danger)}
        .alert-info {background:rgba(6,182,212,0.08);border:1px solid rgba(6,182,212,0.2);color:var(--info)}
        
        .token-display {margin-top:16px;padding:16px;background:var(--bg3);border:1px solid var(--border);border-radius:10px}
        .token-label {font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600}
        .token-value {font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--success);word-break:break-all;background:var(--bg);padding:10px;border-radius:6px;margin-bottom:12px}
        .link-list {display:flex;flex-direction:column;gap:6px}
        .link-list a {
            display:block;padding:10px 14px;background:var(--bg);border:1px solid var(--border);
            border-radius:8px;color:var(--text2);text-decoration:none;font-size:11px;
            font-family:'JetBrains Mono',monospace;transition:all 0.3s
        }
        .link-list a:hover {border-color:var(--border-active);color:var(--text);background:var(--bg2)}
        
        .footer-text {text-align:center;margin-top:20px;padding-top:16px;border-top:1px solid var(--border);font-size:8px;color:var(--text3);font-family:'JetBrains Mono',monospace}
        
        @media(max-width:480px){.login-card{padding:28px 20px;border-radius:14px}.logo-title{font-size:22px}.btn-login{font-size:12px}}
    </style>
</head>
<body>
    <div class="bg-orbs"><div class="o1"></div><div class="o2"></div><div class="o3"></div></div>
    <div class="grid-bg"></div>
    
    <div class="login-card">
        <div class="logo-area">
            <div class="logo-icon">💎</div>
            <div class="logo-title">CRYSTAL TX</div>
            <div class="logo-sub">Admin Console • v70.0</div>
        </div>
        
        ${errorHTML}
        
        <form id="loginForm" onsubmit="handleLogin(event)">
            <div class="form-group">
                <label>👤 Username</label>
                <input type="text" id="username" placeholder="admin" autocomplete="off" required>
            </div>
            <div class="form-group">
                <label>🔒 Password</label>
                <input type="password" id="password" placeholder="••••••••" autocomplete="off" required>
            </div>
            <button type="submit" class="btn-login">🔐 Đăng Nhập</button>
        </form>
        
        <div class="result-box" id="resultBox"></div>
        
        <div class="footer-text">💎 <span style="color:var(--purple)">CRYSTAL TX</span> • Hệ Thống Dự Đoán Độc Quyền • By Anh Khôi</div>
    </div>
    
    <script>
    async function handleLogin(e) {
        e.preventDefault();
        const u = document.getElementById('username').value.trim();
        const p = document.getElementById('password').value.trim();
        const box = document.getElementById('resultBox');
        
        if (!u || !p) {
            box.style.display = 'block';
            box.innerHTML = '<div class="alert alert-error">⚠️ Vui lòng nhập đầy đủ thông tin</div>';
            return;
        }
        
        box.style.display = 'block';
        box.innerHTML = '<div class="alert alert-info">⏳ Đang xác thực...</div>';
        
        try {
            const r = await fetch('/_api/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({username: u, password: p})
            });
            const d = await r.json();
            
            if (r.ok && d.token) {
                box.innerHTML = \`
                    <div class="alert alert-success">✅ Đăng nhập thành công!</div>
                    <div class="token-display">
                        <div class="token-label">🔑 Token Admin (24h)</div>
                        <div class="token-value">\${d.token}</div>
                        <div class="token-label">📡 Đường Dẫn Truy Cập</div>
                        <div class="link-list">
                            <a href="/_hu?_token=\${d.token}">📊 Dashboard HU →</a>
                            <a href="/_md5?_token=\${d.token}">📊 Dashboard MD5 →</a>
                            <a href="/_hu/json?_token=\${d.token}">📡 JSON API HU →</a>
                            <a href="/_md5/json?_token=\${d.token}">📡 JSON API MD5 →</a>
                        </div>
                    </div>
                \`;
            } else {
                box.innerHTML = \`<div class="alert alert-error">❌ \${d.error || 'Sai thông tin đăng nhập'}</div>\`;
            }
        } catch(ex) {
            box.innerHTML = '<div class="alert alert-error">🔌 Lỗi kết nối đến máy chủ</div>';
        }
    }
    </script>
</body>
</html>`;
}

function generateDashboardPage(brain, type) {
    const s = brain.stats;
    const allHistory = (brain.history || []);
    const recent50 = allHistory.slice(0, 50);
    const recent1000 = allHistory.slice(0, 1000);
    
    let td50 = 0, ts50 = 0, cht50 = 0, cdn50 = 0, ct50 = 0;
    for (const r of recent50) {
        if (r.status === '✅') { td50++; ct50++; if (ct50 > cdn50) cdn50 = ct50; }
        else if (r.status === '❌') { ts50++; ct50 = 0; }
    }
    cht50 = ct50;
    
    let td1000 = 0, ts1000 = 0;
    for (const r of recent1000) {
        if (r.status === '✅') td1000++;
        else if (r.status === '❌') ts1000++;
    }
    const wr1000 = recent1000.length > 0 ? Math.round((td1000 / (td1000 + ts1000 || 1)) * 100) : 0;
    
    const wr = s.tyle;
    const wc = wr >= 70 ? 'var(--success)' : wr >= 60 ? 'var(--warning)' : 'var(--danger)';
    
    let rows50 = '';
    for (const r of recent50) {
        const st = r.status || '⏳';
        const cls = st === '✅' ? 's' : st === '❌' ? 'd' : 'w';
        const txt = st === '✅' ? 'WIN' : st === '❌' ? 'LOSE' : 'WAIT';
        rows50 += `<tr class="row-${cls}">
            <td class="mono">#${r.phien_hien_tai || '-'}</td>
            <td><span class="pred pred-${r.prediction === 'TÀI' ? 't' : 'x'}">${r.prediction || '-'}</span></td>
            <td><div class="conf-bar"><div class="conf-fill" style="width:${r.confidence || 0}%"></div></div><span class="conf-text">${r.confidence || 0}%</span></td>
            <td><span class="status status-${cls}">${txt}</span></td>
            <td>${r.actual || '-'}</td>
            <td class="detail">${(r.detail || '-').substring(0, 30)}</td>
        </tr>`;
    }
    
    let rows1000 = '';
    for (const r of recent1000) {
        const st = r.status || '⏳';
        const cls = st === '✅' ? 's' : st === '❌' ? 'd' : 'w';
        const txt = st === '✅' ? 'W' : st === '❌' ? 'L' : '?';
        rows1000 += `<span class="mini-dot mini-${cls}" title="#${r.phien_hien_tai}: ${r.prediction} → ${r.actual || '?'}">${txt}</span>`;
    }
    
    return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>CRYSTAL TX | ${type.toUpperCase()} Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg:#020617;--bg2:#0a0f24;--bg3:#111832;--bg4:#1a2040;
            --border:rgba(255,255,255,0.04);--border-active:rgba(123,97,255,0.3);
            --text:#e2e8f0;--text2:#8899b8;--text3:#4a5578;
            --gradient:linear-gradient(135deg,#7b61ff 0%,#3b82f6 30%,#06b6d4 60%,#8b5cf6 100%);
            --success:#22c55e;--danger:#ef4444;--warning:#f59e0b;--info:#06b6d4;--purple:#7b61ff;
        }
        *{margin:0;padding:0;box-sizing:border-box}
        body {
            font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);
            min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased;
            -webkit-user-select:none;user-select:none;-webkit-touch-callout:none;
        }
        .bg-orbs{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none}
        .bg-orbs div{position:absolute;border-radius:50%;filter:blur(140px);opacity:0.4}
        .bg-orbs .o1{width:600px;height:600px;background:rgba(123,97,255,0.1);top:-200px;left:-100px;animation:o1 20s infinite}
        .bg-orbs .o2{width:500px;height:500px;background:rgba(6,182,212,0.07);bottom:-150px;right:-80px;animation:o2 25s infinite}
        @keyframes o1{0%,100%{transform:translate(0,0)}50%{transform:translate(80px,50px)}}
        @keyframes o2{0%,100%{transform:translate(0,0)}50%{transform:translate(-60px,-30px)}}
        .grid-bg{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;
            background-image:linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px);
            background-size:50px 50px;mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 10%,transparent 70%)}
        
        .app{position:relative;z-index:1;max-width:1300px;margin:0 auto;padding:16px 20px}
        
        .topbar{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;margin-bottom:20px}
        .brand{display:flex;align-items:center;gap:12px}
        .brand-icon{font-size:36px;animation:float 3s ease-in-out infinite}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        .brand h1{font-family:'Orbitron',sans-serif;font-size:24px;font-weight:900}
        .brand .sub{font-size:9px;color:var(--text3);font-family:'JetBrains Mono',monospace;letter-spacing:2px}
        .text-gradient{background:var(--gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        
        .stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
        @media(max-width:900px){.stats-row{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:500px){.stats-row{grid-template-columns:1fr}}
        
        .stat-card{
            background:rgba(17,24,50,0.6);backdrop-filter:blur(20px);
            border:1px solid var(--border);border-radius:16px;padding:18px 20px;
            transition:all 0.3s
        }
        .stat-card:hover{border-color:var(--border-active);transform:translateY(-2px);box-shadow:0 10px 40px rgba(0,0,0,0.3)}
        .stat-card .sc-label{font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;font-weight:600}
        .stat-card .sc-value{font-family:'Orbitron',monospace;font-size:32px;font-weight:800}
        .stat-card .sc-sub{font-size:9px;color:var(--text2);margin-top:4px}
        
        .glass-card{
            background:rgba(17,24,50,0.6);backdrop-filter:blur(20px);
            border:1px solid var(--border);border-radius:16px;overflow:hidden;margin-bottom:20px
        }
        .card-header{
            display:flex;justify-content:space-between;align-items:center;
            padding:14px 18px;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:8px
        }
        .card-header h3{font-family:'Orbitron',monospace;font-size:12px;font-weight:600}
        .card-header .count{font-size:9px;color:var(--text3);font-family:'JetBrains Mono',monospace}
        .badge{
            display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:16px;
            font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:1px
        }
        .badge-info{background:rgba(6,182,212,0.08);color:var(--info);border:1px solid rgba(6,182,212,0.15)}
        .badge-purple{background:rgba(123,97,255,0.08);color:var(--purple);border:1px solid rgba(123,97,255,0.15)}
        .badge-success{background:rgba(34,197,94,0.08);color:var(--success);border:1px solid rgba(34,197,94,0.15)}
        .pulse-dot{width:6px;height:6px;border-radius:50%;background:var(--success);animation:pulse 1.5s infinite;box-shadow:0 0 10px rgba(34,197,94,0.4);display:inline-block}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        
        .mini-grid{display:flex;flex-wrap:wrap;gap:3px;padding:14px;max-height:300px;overflow-y:auto}
        .mini-dot{width:18px;height:18px;border-radius:3px;font-size:7px;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;font-family:'JetBrains Mono',monospace}
        .mini-s{background:rgba(34,197,94,0.15);color:var(--success);border:1px solid rgba(34,197,94,0.2)}
        .mini-d{background:rgba(239,68,68,0.15);color:var(--danger);border:1px solid rgba(239,68,68,0.2)}
        .mini-w{background:rgba(245,158,11,0.15);color:var(--warning);border:1px solid rgba(245,158,11,0.2)}
        .mini-s:hover,.mini-d:hover,.mini-w:hover{transform:scale(1.3);z-index:2}
        
        table{width:100%;border-collapse:collapse;font-size:10px}
        th{background:rgba(255,255,255,0.015);padding:9px 12px;text-align:left;font-weight:600;font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text3);border-bottom:1px solid var(--border)}
        td{padding:7px 12px;border-bottom:1px solid rgba(255,255,255,0.012)}
        tr:hover td{background:rgba(255,255,255,0.008)}
        .row-s{border-left:2px solid transparent}.row-s:hover{border-left-color:rgba(34,197,94,0.3)}
        .row-d{border-left:2px solid transparent}.row-d:hover{border-left-color:rgba(239,68,68,0.3)}
        .row-w{border-left:2px solid transparent}.row-w:hover{border-left-color:rgba(245,158,11,0.3)}
        .mono{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text2)}
        .pred{display:inline-block;padding:3px 10px;border-radius:6px;font-weight:700;font-size:9px}
        .pred-t{background:rgba(34,197,94,0.08);color:var(--success)}
        .pred-x{background:rgba(239,68,68,0.08);color:var(--danger)}
        .conf-bar{display:inline-block;width:45px;height:3px;background:rgba(255,255,255,0.05);border-radius:2px;vertical-align:middle;margin-right:6px}
        .conf-fill{height:100%;border-radius:2px;background:var(--gradient)}
        .conf-text{font-weight:600;color:var(--info);font-size:9px}
        .status{display:inline-block;padding:2px 8px;border-radius:4px;font-weight:700;font-size:7px;text-transform:uppercase;letter-spacing:1px}
        .status-s{background:rgba(34,197,94,0.08);color:var(--success)}
        .status-d{background:rgba(239,68,68,0.08);color:var(--danger)}
        .status-w{background:rgba(245,158,11,0.08);color:var(--warning)}
        .detail{font-size:8px;color:var(--text3);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        
        .footer{text-align:center;padding:12px;font-size:8px;color:var(--text3);font-family:'JetBrains Mono',monospace}
        ::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.05);border-radius:2px}
        
        @media(max-width:768px){.brand h1{font-size:18px}.stat-card .sc-value{font-size:24px}table{font-size:9px}th,td{padding:5px 8px}}
    </style>
</head>
<body>
    <div class="bg-orbs"><div class="o1"></div><div class="o2"></div></div>
    <div class="grid-bg"></div>
    
    <div class="app">
        <div class="topbar">
            <div class="brand">
                <div class="brand-icon">💎</div>
                <div>
                    <h1><span class="text-gradient">CRYSTAL TX</span></h1>
                    <div class="sub">${type.toUpperCase()} • v70.0 • By Anh Khôi</div>
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:12px">
                <div class="badge badge-success"><span class="pulse-dot"></span>LIVE</div>
                <div class="badge badge-purple">6 ENGINES</div>
            </div>
        </div>
        
        <div class="stats-row">
            <div class="stat-card">
                <div class="sc-label">📊 Tổng Dự Đoán</div>
                <div class="sc-value" style="color:var(--text)">${s.total}</div>
                <div class="sc-sub">Tất cả thời gian</div>
            </div>
            <div class="stat-card">
                <div class="sc-label">✅ Chính Xác</div>
                <div class="sc-value" style="color:var(--success)">${s.dung}</div>
                <div class="sc-sub">Tỷ lệ: ${s.tyle}%</div>
            </div>
            <div class="stat-card">
                <div class="sc-label">⚡ Chuỗi Thắng</div>
                <div class="sc-value" style="color:${s.chuoi>0?'var(--success)':'var(--danger)'}">${s.chuoi>0?'+'+s.chuoi:s.chuoi}</div>
                <div class="sc-sub">Kỷ lục: ${s.chuoi_dai}</div>
            </div>
            <div class="stat-card">
                <div class="sc-label">📈 Tỷ Lệ 1000</div>
                <div class="sc-value" style="color:${wr1000>=70?'var(--success)':wr1000>=60?'var(--warning)':'var(--danger)'}">${wr1000}%</div>
                <div class="sc-sub">${recent1000.length} phiên gần nhất</div>
            </div>
        </div>
        
        <div class="glass-card">
            <div class="card-header">
                <h3>📜 Lịch Sử ${recent1000.length} Phiên (Click để xem chi tiết)</h3>
                <span class="badge badge-info">${td1000}W / ${ts1000}L</span>
            </div>
            <div class="mini-grid">${rows1000 || 'Đang tải...'}</div>
        </div>
        
        <div class="glass-card">
            <div class="card-header">
                <h3>📋 50 Phiên Gần Nhất</h3>
                <span class="count">${recent50.length} phiên</span>
                <span class="badge badge-purple">6 Engines</span>
            </div>
            <div style="overflow-x:auto">
                <table>
                    <thead><tr><th>Phiên</th><th>Dự Đoán</th><th>Độ Tin</th><th>KQ</th><th>Thực Tế</th><th>Engines</th></tr></thead>
                    <tbody>${rows50 || '<tr><td colspan="6" style="text-align:center;padding:20px">Đang tải...</td></tr>'}</tbody>
                </table>
            </div>
        </div>
        
        <div class="footer">💎 <span style="color:var(--purple)">CRYSTAL TX</span> • SPECTRAL • GEOMETRIC • ENTROPY • MOMENTUM • PATTERN • STREAK • By Anh Khôi • ${new Date().toLocaleString('vi-VN')}</div>
    </div>
    <script>setTimeout(()=>location.reload(),5000);</script>
</body></html>`;
}

// ============================================================
// 🔌 API ENDPOINTS
// ============================================================

app.get('/_login', (req, res) => {
    const error = req.query.error === 'unauthorized' ? 'Bạn cần đăng nhập để truy cập hệ thống' :
                  req.query.error === 'expired' ? 'Token đã hết hạn, vui lòng đăng nhập lại' : '';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(generateLoginPage(error));
});

app.get('/', (req, res) => res.redirect('/_login'));

app.post('/_api/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Thiếu thông tin đăng nhập' });
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = generateAdminToken();
        return res.json({ token, expires: Date.now() + 86400000, message: 'Đăng nhập thành công' });
    }
    return res.status(401).json({ error: 'Sai username hoặc password' });
});

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
        brainHU.lastPrediction = result;
        const rec = { phien: data[0].phien, phien_hien_tai: (data[0].phien + 1).toString(), dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`, total: data[0].total, actual: data[0].result, prediction: result.duDoan, confidence: result.doTinCay, detail: result.chiTiet, status: '', timestamp: new Date().toISOString(), soMau: result.soMau || 0 };
        brainHU.history.unshift(rec);
        if (brainHU.history.length > 2000) brainHU.history = brainHU.history.slice(0, 2000);
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
        brainMD5.lastPrediction = result;
        const rec = { phien: data[0].phien, phien_hien_tai: (data[0].phien + 1).toString(), dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`, total: data[0].total, actual: data[0].result, prediction: result.duDoan, confidence: result.doTinCay, detail: result.chiTiet, status: '', timestamp: new Date().toISOString(), soMau: result.soMau || 0 };
        brainMD5.history.unshift(rec);
        if (brainMD5.history.length > 2000) brainMD5.history = brainMD5.history.slice(0, 2000);
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

app.use((req, res) => res.status(404).end());
app.use((err, req, res, next) => { console.error(err); res.status(500).end(); });

// ============================================================
// 🚀 START
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ CRYSTAL TX v70.0 - Đã khởi động trên cổng ${PORT}`);
    console.log(`🌐 Truy cập: http://localhost:${PORT}/_login\n`);
    startAuto();
});
