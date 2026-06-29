const express = require('express');
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');

const app = express();

// QUAN TRỌNG: Phải có dòng này để parse JSON body
app.use(express.json());

const PORT = process.env.PORT || 5000;

const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';
const HISTORY_FILE_HU = '.hu_data';
const HISTORY_FILE_MD5 = '.md5_data';
const BRAIN_FILE_HU = '.hu_brain';
const BRAIN_FILE_MD5 = '.md5_brain';

// ============================================================
// 🔐 ADMIN SYSTEM
// ============================================================
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = crypto.randomBytes(12).toString('hex');
const ADMIN_TOKENS = new Map();

console.log('\n============================================');
console.log('  ◆ CRYSTAL TX - BY ANH KHOI');
console.log(`  ◆ Username: ${ADMIN_USERNAME}`);
console.log(`  ◆ Password: ${ADMIN_PASSWORD}`);
console.log(`  ◆ Login: POST /_admin/login`);
console.log('============================================\n');

const generateAdminToken = () => {
    const token = crypto.randomBytes(48).toString('hex');
    ADMIN_TOKENS.set(token, Date.now() + 86400000);
    setTimeout(() => ADMIN_TOKENS.delete(token), 86400000);
    return token;
};

const adminAuth = (req, res, next) => {
    const token = req.headers['x-admin-token'] || req.query['_admin'];
    if (!token || !ADMIN_TOKENS.has(token)) {
        return res.status(403).send(generateLoginHTML());
    }
    if (Date.now() > ADMIN_TOKENS.get(token)) {
        ADMIN_TOKENS.delete(token);
        return res.status(403).send(generateLoginHTML());
    }
    next();
};

// ============================================================
// 🛡️ BẢO MẬT CƠ BẢN
// ============================================================
app.use((req, res, next) => {
    const blocked = ['/admin','/wp-admin','/phpmyadmin','/.env','/.git','/config','/backup','/login','/shell','/api','/graphql','/actuator','/swagger','/debug'];
    if (blocked.some(b => req.path.toLowerCase().startsWith(b))) return res.status(404).end();
    
    if (req.query) {
        const dangerous = ['<','>','script','onerror','onload','javascript:','union','select','insert','update','delete','drop','exec','eval','alert'];
        for (const [k,v] of Object.entries(req.query)) {
            if (dangerous.some(d => String(v).toLowerCase().includes(d))) return res.status(403).end();
        }
    }
    
    const ua = (req.get('User-Agent') || '').toLowerCase();
    const blockedUA = ['sqlmap','nikto','nmap','burp','acunetix','nessus','metasploit','hydra','gobuster','dirbuster','wpscan','zap','scanner'];
    if (blockedUA.some(b => ua.includes(b))) return res.status(403).end();
    
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Server', '');
    next();
});

// Rate limiter
const rateLimitMap = new Map();
app.use((req, res, next) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    if (!rateLimitMap.has(ip)) rateLimitMap.set(ip, []);
    const requests = rateLimitMap.get(ip).filter(t => now - t < 60000);
    if (requests.length > 100) return res.status(429).json({ error: 'Qua nhieu yeu cau' });
    requests.push(now);
    rateLimitMap.set(ip, requests);
    next();
});

// ============================================================
// 🔐 MÃ HÓA
// ============================================================
const MASTER_KEY = crypto.createHash('sha512').update('crystal-tx-secure-key-2024').digest();

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
// 🧬 3 ENGINE DỰ ĐOÁN
// ============================================================

class SpectralAnalyzer {
    constructor() { this.spectralDB = new Map(); this.trained = false; }
    
    extractSpectrum(seq) {
        const signal = seq.map(v => v === 'T' ? 1 : -1);
        const features = [];
        for (const period of [3, 5, 8, 13, 21, 34]) {
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
        while (features.length < 12) features.push(0);
        return features;
    }
    
    train(data) {
        for (let i = 60; i < data.length; i++) {
            const window = data.slice(i - 60, i);
            const spectrum = this.extractSpectrum(window);
            const key = spectrum.map(v => Math.round(v * 20)).join(',');
            if (!this.spectralDB.has(key)) this.spectralDB.set(key, { T: 0, X: 0, total: 0 });
            const db = this.spectralDB.get(key);
            db[data[i]] = (db[data[i]] || 0) + 1;
            db.total++;
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (seq.length < 60 || !this.trained) return null;
        const spectrum = this.extractSpectrum(seq.slice(-60));
        const key = spectrum.map(v => Math.round(v * 20)).join(',');
        const db = this.spectralDB.get(key);
        if (!db || db.total < 5) return null;
        const prob = db.T / db.total;
        return { prob: Math.max(0.1, Math.min(0.9, prob)), confidence: Math.min(0.95, db.total / 120) };
    }
}

class GeometricAnalyzer {
    constructor() { this.geoDB = new Map(); this.trained = false; }
    
    calcFractalDim(seq) {
        const scales = [2, 3, 4, 6, 8, 12];
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
            const dim = Math.round(this.calcFractalDim(window) * 20);
            const key = String(dim);
            if (!this.geoDB.has(key)) this.geoDB.set(key, { T: 0, X: 0, total: 0 });
            const db = this.geoDB.get(key);
            db[data[i]] = (db[data[i]] || 0) + 1;
            db.total++;
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (seq.length < 45 || !this.trained) return null;
        const dim = Math.round(this.calcFractalDim(seq.slice(-45)) * 20);
        const db = this.geoDB.get(String(dim));
        if (!db || db.total < 5) return null;
        const prob = db.T / db.total;
        return { prob: Math.max(0.1, Math.min(0.9, prob)), confidence: Math.min(0.9, db.total / 90) };
    }
}

class FlowAnalyzer {
    constructor() { this.flowDB = new Map(); this.trained = false; }
    
    calcFlow(seq) {
        const wins = [3, 5, 8, 13];
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
            const flow = this.calcFlow(window);
            const key = `${Math.round(flow.entropy * 10)}|${Math.round(flow.stability * 10)}`;
            if (!this.flowDB.has(key)) this.flowDB.set(key, { T: 0, X: 0, total: 0 });
            const db = this.flowDB.get(key);
            db[data[i]] = (db[data[i]] || 0) + 1;
            db.total++;
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (seq.length < 45 || !this.trained) return null;
        const flow = this.calcFlow(seq.slice(-45));
        const key = `${Math.round(flow.entropy * 10)}|${Math.round(flow.stability * 10)}`;
        const db = this.flowDB.get(key);
        if (!db || db.total < 5) return null;
        const prob = db.T / db.total;
        const adjusted = prob * 0.7 + (flow.stability > 0.5 ? 0.3 : 0);
        return { prob: Math.max(0.1, Math.min(0.9, adjusted)), confidence: Math.min(0.9, db.total / 80) };
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
        this.spectral = new SpectralAnalyzer();
        this.geometric = new GeometricAnalyzer();
        this.flow = new FlowAnalyzer();
        this.memoryBank = new Map();
        this.streakBank = new Map();
    }
    
    train(data) {
        if (data.length < 60) return false;
        try {
            this.spectral.train(data);
            this.geometric.train(data);
            this.flow.train(data);
            this.memoryBank.clear();
            this.streakBank.clear();
            
            for (let i = 20; i < data.length; i++) {
                const window = data.slice(i - 20, i);
                const target = data[i];
                
                for (const len of [3, 5, 8]) {
                    if (window.length >= len) {
                        const pattern = window.slice(-len).join('');
                        if (!this.memoryBank.has(pattern)) this.memoryBank.set(pattern, { T: 0, X: 0, total: 0 });
                        const mb = this.memoryBank.get(pattern);
                        mb[target] = (mb[target] || 0) + 1;
                        mb.total++;
                    }
                }
                
                const last = window[window.length - 1];
                let streak = 1;
                for (let j = window.length - 2; j >= 0 && window[j] === last; j--) streak++;
                const sk = `${last}:${Math.min(streak, 15)}`;
                if (!this.streakBank.has(sk)) this.streakBank.set(sk, { T: 0, X: 0, total: 0 });
                const sb = this.streakBank.get(sk);
                sb[target] = (sb[target] || 0) + 1;
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
        
        const sp = this.spectral.predict(seq);
        if (sp) { const w = 3.5 * sp.confidence; sT += sp.prob * w; sX += (1 - sp.prob) * w; sw += w; details.push(`SP:${Math.round(sp.prob * 100)}`); }
        
        const gm = this.geometric.predict(seq);
        if (gm) { const w = 2.8 * gm.confidence; sT += gm.prob * w; sX += (1 - gm.prob) * w; sw += w; details.push(`GM:${Math.round(gm.prob * 100)}`); }
        
        const fl = this.flow.predict(seq);
        if (fl) { const w = 2.5 * fl.confidence; sT += fl.prob * w; sX += (1 - fl.prob) * w; sw += w; details.push(`FL:${Math.round(fl.prob * 100)}`); }
        
        for (const len of [3, 5, 8]) {
            if (seq.length >= len) {
                const pattern = seq.slice(-len).join('');
                const mb = this.memoryBank.get(pattern);
                if (mb && mb.total >= 5) { const w = 1.5; sT += (mb.T / mb.total) * w; sX += (mb.X / mb.total) * w; sw += w; details.push(`M${len}`); }
            }
        }
        
        const last = seq[seq.length - 1];
        let streak = 1;
        for (let j = seq.length - 2; j >= 0 && seq[j] === last; j--) streak++;
        const sk = `${last}:${Math.min(streak, 15)}`;
        const sb = this.streakBank.get(sk);
        if (sb && sb.total >= 5) { const w = 1.8; sT += (sb.T / sb.total) * w; sX += (sb.X / sb.total) * w; sw += w; details.push(`C${Math.min(streak, 15)}`); }
        
        if (streak >= 8) {
            if (last === 'T') { sX += 3.5; details.push('DC-T'); }
            else { sT += 3.5; details.push('DC-X'); }
            sw += 3.5;
        } else if (streak >= 5) {
            if (last === 'T') { sX += 2.0; details.push('BT'); }
            else { sT += 2.0; details.push('BX'); }
            sw += 2.0;
        }
        
        const longT = seq.filter(s => s === 'T').length / seq.length;
        if (longT > 0.65) { sX += 1.8; details.push('CBT'); sw += 1.8; }
        else if (longT < 0.35) { sT += 1.8; details.push('CBX'); sw += 1.8; }
        
        if (sw === 0) return this.fallback();
        const prob = sT / (sT + sX);
        const duDoan = prob > 0.5 ? 'TÀI' : 'XỈU';
        let doTinCay = Math.round(Math.max(prob, 1 - prob) * 100);
        if (details.length >= 7) doTinCay = Math.min(99, doTinCay + 8);
        else if (details.length >= 4) doTinCay = Math.min(99, doTinCay + 5);
        doTinCay = Math.min(99, Math.max(55, doTinCay));
        
        return { duDoan, doTinCay, chiTiet: details.slice(0, 5).join(' | '), soMau: details.length };
    }
    
    fallback() {
        if (this.stats.total > 50) {
            const trend = this.stats.dung > this.stats.sai ? 'TÀI' : 'XỈU';
            return { duDoan: trend, doTinCay: 52, chiTiet: 'XH', soMau: 0 };
        }
        return { duDoan: 'TÀI', doTinCay: 51, chiTiet: 'MD', soMau: 0 };
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
            const bf = this.type === 'hu' ? BRAIN_FILE_HU : BRAIN_FILE_MD5;
            const hf = this.type === 'hu' ? HISTORY_FILE_HU : HISTORY_FILE_MD5;
            const bd = secureEncrypt(JSON.stringify({
                memoryBank: Array.from(this.memoryBank.entries()).slice(-5000),
                streakBank: Array.from(this.streakBank.entries()),
                trained: this.trained, stats: this.stats, lastPhien: this.lastPhien
            }));
            const hd = secureEncrypt(JSON.stringify({
                history: this.history.slice(0, 1000), stats: this.stats,
                lastPhien: this.lastPhien, updated: new Date().toISOString()
            }));
            if (bd) fs.writeFileSync(bf, bd);
            if (hd) fs.writeFileSync(hf, hd);
        } catch (e) {}
    }
    
    load() {
        try {
            const bf = this.type === 'hu' ? BRAIN_FILE_HU : BRAIN_FILE_MD5;
            const hf = this.type === 'hu' ? HISTORY_FILE_HU : HISTORY_FILE_MD5;
            if (fs.existsSync(bf)) {
                const dc = secureDecrypt(fs.readFileSync(bf, 'utf8'));
                if (dc) {
                    const d = JSON.parse(dc);
                    if (d.memoryBank) this.memoryBank = new Map(d.memoryBank);
                    if (d.streakBank) this.streakBank = new Map(d.streakBank);
                    if (d.trained) this.trained = d.trained;
                    if (d.stats) this.stats = d.stats;
                    if (d.lastPhien) this.lastPhien = d.lastPhien;
                }
            }
            if (fs.existsSync(hf)) {
                const dc = secureDecrypt(fs.readFileSync(hf, 'utf8'));
                if (dc) {
                    const d = JSON.parse(dc);
                    if (d.history) this.history = d.history;
                    if (d.stats) this.stats = d.stats;
                    if (d.lastPhien) this.lastPhien = d.lastPhien;
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
// ⚡ AUTO
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
// 🎨 GIAO DIỆN
// ============================================================

function generateLoginHTML() {
    return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>CRYSTAL TX - Dang Nhap</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Inter',sans-serif;background:#040410;color:#e8eaf2;min-height:100vh;display:flex;align-items:center;justify-content:center}
        .bg{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;background:radial-gradient(ellipse 80% 60% at 30% 30%,rgba(123,97,255,0.06) 0%,transparent 60%),radial-gradient(ellipse 60% 80% at 70% 70%,rgba(6,182,212,0.05) 0%,transparent 60%)}
        .box{position:relative;z-index:1;background:#0e102a;border:1px solid rgba(255,255,255,0.03);border-radius:16px;padding:32px 28px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,0.4)}
        .logo{text-align:center;margin-bottom:24px}
        .logo .ic{font-size:36px;animation:float 3s ease-in-out infinite}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        .logo h1{font-family:'Orbitron',sans-serif;font-size:20px;font-weight:800;background:linear-gradient(135deg,#7b61ff,#3b82f6,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .logo span{font-family:'JetBrains Mono',monospace;font-size:8px;color:#8890b8;letter-spacing:2px;text-transform:uppercase}
        .grp{margin-bottom:14px}
        .grp label{display:block;font-size:8px;color:#8890b8;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;font-weight:600}
        .grp input{width:100%;padding:10px 14px;background:#0a0c1c;border:1px solid rgba(255,255,255,0.03);border-radius:8px;color:#e8eaf2;font-size:13px;font-family:'JetBrains Mono',monospace;outline:none}
        .grp input:focus{border-color:rgba(123,97,255,0.2);box-shadow:0 0 0 3px rgba(123,97,255,0.1)}
        .btn{width:100%;padding:10px;background:linear-gradient(135deg,#7b61ff,#3b82f6);border:none;border-radius:8px;color:#fff;font-weight:700;font-size:12px;cursor:pointer;font-family:'Orbitron',monospace;text-transform:uppercase;letter-spacing:1px}
        .btn:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(123,97,255,0.25)}
        .tok{display:none;margin-top:20px;padding:14px;background:#0a0c1c;border:1px solid rgba(255,255,255,0.03);border-radius:8px}
        .tok.show{display:block}
        .tok .l{font-size:8px;color:#8890b8;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px}
        .tok .v{font-family:'JetBrains Mono',monospace;font-size:10px;color:#22c55e;word-break:break-all;background:#040410;padding:8px;border-radius:4px}
        .tok .i{font-size:8px;color:#4a5080;margin-top:8px;line-height:1.6}
        .err{color:#ef4444;font-size:10px;margin-top:8px;text-align:center;display:none}
        .err.show{display:block}
        .ft{text-align:center;font-size:7px;color:#4a5080;margin-top:20px;font-family:'JetBrains Mono',monospace}
        .ft span{color:#7b61ff}
    </style>
</head>
<body>
<div class="bg"></div>
<div class="box">
    <div class="logo"><div class="ic">◆</div><h1>CRYSTAL TX</h1><span>Admin VIP • By Anh Khoi</span></div>
    <div class="grp"><label>Username</label><input type="text" id="u" placeholder="admin"></div>
    <div class="grp"><label>Password</label><input type="password" id="p" placeholder="••••"></div>
    <button class="btn" onclick="doLogin()">◆ Dang Nhap</button>
    <div class="err" id="e"></div>
    <div class="tok" id="t">
        <div class="l">Token Admin (24h)</div>
        <div class="v" id="tv"></div>
        <div class="i" id="ti"></div>
    </div>
    <div class="ft">◆ <span>CRYSTAL TX</span> • By Anh Khoi</div>
</div>
<script>
async function doLogin(){
    var u = document.getElementById('u').value;
    var p = document.getElementById('p').value;
    var er = document.getElementById('e');
    var tb = document.getElementById('t');
    er.classList.remove('show');
    tb.classList.remove('show');
    
    if(!u || !p) {
        er.textContent = 'Vui long nhap day du thong tin';
        er.classList.add('show');
        return;
    }
    
    try {
        var r = await fetch('/_admin/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: u, password: p})
        });
        var d = await r.json();
        
        if(r.ok && d.token) {
            document.getElementById('tv').textContent = d.token;
            document.getElementById('ti').innerHTML = 
                'Het han: ' + new Date(d.expires).toLocaleString('vi-VN') + '<br><br>' +
                '<b>Dashboard:</b><br>' +
                '/_hu?_admin=' + d.token + '<br>' +
                '/_md5?_admin=' + d.token + '<br><br>' +
                '<b>JSON API:</b><br>' +
                '/_hu/json?_admin=' + d.token + '<br>' +
                '/_md5/json?_admin=' + d.token;
            tb.classList.add('show');
        } else {
            er.textContent = d.error || 'Sai thong tin dang nhap';
            er.classList.add('show');
        }
    } catch(ex) {
        er.textContent = 'Loi ket noi den may chu';
        er.classList.add('show');
    }
}
</script>
</body></html>`;
}

function generateDashboardHTML(brain, type) {
    const s = brain.stats;
    const h = brain.history || [];
    const recent = h.slice(0, 50);
    let td = 0, ts = 0, cht = 0, cdn = 0, ct = 0;
    
    for (const r of recent) {
        if (r.status === '✅') { td++; ct++; if (ct > cdn) cdn = ct; }
        else if (r.status === '❌') { ts++; ct = 0; }
    }
    cht = ct;
    const wr = s.tyle;
    const wc = wr >= 70 ? '#22c55e' : wr >= 60 ? '#f59e0b' : '#ef4444';
    
    let rows = '';
    for (const r of recent.slice(0, 50)) {
        const st = r.status || '⏳';
        const cls = st === '✅' ? 'w' : st === '❌' ? 'l' : 'p';
        const txt = st === '✅' ? 'WIN' : st === '❌' ? 'LOSE' : 'WAIT';
        rows += `<tr class="r-${cls}"><td class="sid">#${r.phien_hien_tai || '-'}</td><td><span class="pr pr-${r.prediction === 'TÀI' ? 't' : 'x'}">${r.prediction || '-'}</span></td><td><div class="cb"><div class="cf" style="width:${r.confidence || 0}%"></div></div><span class="ct">${r.confidence || 0}%</span></td><td><span class="st st-${cls}">${txt}</span></td><td>${r.actual || '-'}</td><td class="dt">${(r.detail || '-').substring(0, 25)}</td></tr>`;
    }
    
    return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>◆ ${type.toUpperCase()}</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#040410;color:#e8eaf2;min-height:100vh;overflow-x:hidden}
.bg1{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;background:radial-gradient(ellipse 80% 60% at 20% 30%,rgba(123,97,255,0.05) 0%,transparent 60%),radial-gradient(ellipse 60% 80% at 80% 70%,rgba(6,182,212,0.04) 0%,transparent 60%)}
.bg2{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,0.012) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.012) 1px,transparent 1px);background-size:40px 40px;mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 10%,transparent 70%)}
.app{position:relative;z-index:1;max-width:1100px;margin:0 auto;padding:10px 14px}
.tb{display:flex;justify-content:space-between;align-items:center;padding:10px 0;flex-wrap:wrap;gap:8px}
.brd{display:flex;align-items:center;gap:8px}
.brd .ic{font-size:22px;animation:float 3s ease-in-out infinite}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
.brd h1{font-family:'Orbitron',sans-serif;font-size:16px;font-weight:800;background:linear-gradient(135deg,#7b61ff,#3b82f6,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.brd span{font-size:8px;color:#8890b8;font-family:'JetBrains Mono',monospace;letter-spacing:1px}
.wr{display:flex;align-items:center;gap:8px}
.wr svg{transform:rotate(-90deg)}
.wr .bc{fill:none;stroke:rgba(255,255,255,0.04);stroke-width:4}
.wr .fc{fill:none;stroke:${wc};stroke-width:4;stroke-linecap:round;stroke-dasharray:138.2;stroke-dashoffset:${138.2 - (138.2 * wr / 100)};transition:stroke-dashoffset 1s ease}
.wr .tx{font-family:'Orbitron',monospace;font-size:10px;font-weight:700;fill:${wc};text-anchor:middle;dominant-baseline:central}
.wr .lb{font-size:8px;color:#4a5080}
.cards{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:10px}
@media(max-width:800px){.cards{grid-template-columns:repeat(3,1fr)}}
@media(max-width:500px){.cards{grid-template-columns:repeat(2,1fr)}}
.card{background:#0e102a;border:1px solid rgba(255,255,255,0.03);border-radius:10px;padding:8px 10px;text-align:center;transition:all 0.3s}
.card:hover{background:#121538;border-color:rgba(123,97,255,0.2)}
.card .v{font-family:'Orbitron',monospace;font-size:15px;font-weight:700}
.card .l{font-size:7px;color:#4a5080;text-transform:uppercase;letter-spacing:1px;margin-top:2px}
.g{color:#22c55e}.r{color:#ef4444}.y{color:#f59e0b}.c{color:#06b6d4}.p{color:#7b61ff}.w{color:#e8eaf2}
.tbl{background:#0e102a;border:1px solid rgba(255,255,255,0.03);border-radius:12px;overflow:hidden}
.tbl-h{display:flex;justify-content:space-between;align-items:center;padding:8px 14px;border-bottom:1px solid rgba(255,255,255,0.03)}
.tbl-h h3{font-family:'Orbitron',monospace;font-size:11px;font-weight:600}
.tbl-h .cnt{font-size:7px;color:#4a5080;font-family:'JetBrains Mono',monospace}
.tag{font-size:7px;color:#7b61ff;background:rgba(123,97,255,0.05);padding:2px 8px;border-radius:10px;border:1px solid rgba(123,97,255,0.08)}
.tw{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:9px}
th{background:rgba(255,255,255,0.01);padding:6px 8px;text-align:left;font-weight:600;font-size:7px;text-transform:uppercase;letter-spacing:1px;color:#4a5080;border-bottom:1px solid rgba(255,255,255,0.03)}
td{padding:5px 8px;border-bottom:1px solid rgba(255,255,255,0.01)}
tr:hover td{background:rgba(255,255,255,0.006)}
.r-w{border-left:1px solid transparent}.r-w:hover{border-left-color:rgba(34,197,94,0.2)}
.r-l{border-left:1px solid transparent}.r-l:hover{border-left-color:rgba(239,68,68,0.2)}
.r-p{border-left:1px solid transparent}.r-p:hover{border-left-color:rgba(245,158,11,0.2)}
.sid{font-family:'Orbitron',monospace;font-size:8px;color:#8890b8}
.pr{display:inline-block;padding:2px 6px;border-radius:4px;font-weight:700;font-size:7px}
.pr-t{background:rgba(34,197,94,0.07);color:#22c55e}
.pr-x{background:rgba(239,68,68,0.07);color:#ef4444}
.cb{display:inline-block;width:32px;height:2px;background:rgba(255,255,255,0.04);border-radius:1px;vertical-align:middle;margin-right:3px}
.cf{height:100%;border-radius:1px;background:linear-gradient(90deg,#7b61ff,#06b6d4)}
.ct{font-weight:600;color:#06b6d4;font-size:7px}
.st-w{display:inline-block;padding:1px 5px;border-radius:3px;font-weight:700;font-size:6px;text-transform:uppercase;letter-spacing:1px;background:rgba(34,197,94,0.07);color:#22c55e}
.st-l{display:inline-block;padding:1px 5px;border-radius:3px;font-weight:700;font-size:6px;text-transform:uppercase;letter-spacing:1px;background:rgba(239,68,68,0.07);color:#ef4444}
.st-p{display:inline-block;padding:1px 5px;border-radius:3px;font-weight:700;font-size:6px;text-transform:uppercase;letter-spacing:1px;background:rgba(245,158,11,0.07);color:#f59e0b}
.dt{font-size:7px;color:#4a5080;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ftr{text-align:center;padding:8px;font-size:7px;color:#4a5080;font-family:'JetBrains Mono',monospace}
.ftr span{color:#7b61ff}
::-webkit-scrollbar{width:2px;height:2px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.03)}
@keyframes scan{0%{transform:translateY(-100%)}100%{transform:translateY(100%)}}
.scan{position:fixed;top:0;left:0;width:100%;height:1px;background:linear-gradient(90deg,transparent,rgba(123,97,255,0.1),transparent);z-index:2;pointer-events:none;animation:scan 5s linear infinite}
</style></head><body>
<div class="bg1"></div><div class="bg2"></div><div class="scan"></div>
<div class="app">
<div class="tb">
<div class="brd"><div class="ic">◆</div><div><h1>CRYSTAL TX</h1><span>${type.toUpperCase()} • By Anh Khoi</span></div></div>
<div class="wr"><div class="lb">Ty le</div><svg width="48" height="48" viewBox="0 0 48 48"><circle class="bc" cx="24" cy="24" r="22"/><circle class="fc" cx="24" cy="24" r="22"/><text class="tx" x="24" y="24">${wr}%</text></svg></div>
</div>
<div class="cards">
<div class="card"><div class="v w">${s.total}</div><div class="l">Tong</div></div>
<div class="card"><div class="v g">${s.dung}</div><div class="l">Dung</div></div>
<div class="card"><div class="v r">${s.sai}</div><div class="l">Sai</div></div>
<div class="card"><div class="v ${s.chuoi>0?'g':s.chuoi<0?'r':'y'}">${s.chuoi>0?'+'+s.chuoi:s.chuoi<0?''+s.chuoi:'0'}</div><div class="l">Chuoi</div></div>
<div class="card"><div class="v p">${s.chuoi_dai}</div><div class="l">Ky Luc</div></div>
<div class="card"><div class="v ${wr>=70?'g':wr>=60?'y':'r'}">${wr}%</div><div class="l">Ty Le</div></div>
</div>
<div class="tbl">
<div class="tbl-h"><h3>◆ Lich Su 50 Phien</h3><span class="cnt">${recent.length} phien</span><span class="tag">◆ Anh Khoi</span></div>
<div class="tw"><table><thead><tr><th>Phien</th><th>Du Doan</th><th>Do Tin</th><th>KQ</th><th>Thuc Te</th><th>Engine</th></tr></thead>
<tbody>${rows || '<tr><td colspan="6" style="text-align:center;padding:15px;">Dang tai...</td></tr>'}</tbody></table></div>
</div>
<div class="ftr">◆ <span>CRYSTAL TX</span> • Spectral • Geometric • Flow • By Anh Khoi • ${new Date().toLocaleString('vi-VN')}</div>
</div>
<script>setTimeout(()=>location.reload(),5000);</script>
</body></html>`;
}

// ============================================================
// 🔌 API ENDPOINTS
// ============================================================

// LOGIN - Đây là endpoint quan trọng nhất để lấy token
app.post('/_admin/login', (req, res) => {
    console.log('Login attempt:', req.body);
    const { username, password } = req.body || {};
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Thieu username hoac password' });
    }
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = generateAdminToken();
        console.log('Login successful, token generated');
        return res.json({ 
            token: token, 
            expires: Date.now() + 86400000,
            message: 'Dang nhap thanh cong' 
        });
    }
    
    return res.status(401).json({ error: 'Sai username hoac password' });
});

// Dashboard
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
    res.send(generateDashboardHTML(brainHU, 'hu'));
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
    res.send(generateDashboardHTML(brainMD5, 'md5'));
});

// JSON API
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
    } catch (e) { res.status(500).json({ error: 'Loi' }); }
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
    } catch (e) { res.status(500).json({ error: 'Loi' }); }
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
    res.json({ message: 'Da reset' });
});

// 404 handler
app.use((req, res) => res.status(404).end());

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err.message);
    res.status(500).end();
});

// ============================================================
// 🚀 START
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n◆ CRYSTAL TX running on port ${PORT}`);
    console.log(`◆ Login: POST /_admin/login with JSON body {username, password}\n`);
    startAuto();
});
