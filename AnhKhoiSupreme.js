/**
 * ════════════════════════════════════════════════════════════════════
 * ║  🚀 TX PREDICTOR v6 - ĐẠI CA KHÔI @2026                      ║
 * ║  🧠 30+ CẦU + 18+ TREND + DICE + ENSEMBLE                   ║
 * ║  📊 TÍCH HỢP 1 FILE - GIAO DIỆN SIÊU ĐẸP                    ║
 * ════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// ============================================================
// CẤU HÌNH
// ============================================================
const CONFIG = {
    API_URL_HU: 'https://wtx.tele68.com/v1/tx/sessions',
    API_URL_MD5: 'https://wtxmd52.tele68.com/v1/txmd5/sessions',
    SAVE_PATH: './tx_brain.json',
    MIN_CONF: 46,
    NOISE: 0.05,
    ERROR_STREAK_THRESHOLD: 2,
    MAX_PATTERN: 30,
    ADAPT_INTERVAL: 7,
    MAX_HISTORY: 1000
};

// ============================================================
// THUẬT TOÁN TX PREDICTOR v6
// ============================================================
class TXMemory {
    constructor() {
        this.patterns = {};
        this.dicePatterns = { 1: {}, 2: {}, 3: {} };
        this.sumPatterns = {};
        this.valuePatterns = {};
        this.methods = {};
        this.cau = {};
        this.transitions = {};
        this.fractalPatterns = {};
        this.attractor = [];
        this.multiStep = {};
        this.diceHistory = [];
        this.session = 0;
        this.correct = 0;
        this.total = 0;
        this.bestAcc = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.errorStreak = 0;
    }

    _getPattern(key) {
        if (!this.patterns[key]) this.patterns[key] = { T: 0, X: 0, w: 1.0, n: 0, success: 0 };
        return this.patterns[key];
    }
    _getMethod(key) {
        if (!this.methods[key]) this.methods[key] = { w: 0, l: 0, wt: 1.0, r: [], streak: 0, best: 0 };
        return this.methods[key];
    }
    _getCau(key) {
        if (!this.cau[key]) this.cau[key] = { w: 0, l: 0, wt: 1.0, r: [], streak: 0 };
        return this.cau[key];
    }
    _getDicePattern(vi, key) {
        if (!this.dicePatterns[vi][key]) this.dicePatterns[vi][key] = {};
        return this.dicePatterns[vi][key];
    }
    _getSumPattern(key) {
        if (!this.sumPatterns[key]) this.sumPatterns[key] = {};
        return this.sumPatterns[key];
    }
    _getValuePattern(key) {
        if (!this.valuePatterns[key]) this.valuePatterns[key] = { s: 0, n: 0, vals: [] };
        return this.valuePatterns[key];
    }
    _getFractalPattern(key) {
        if (!this.fractalPatterns[key]) this.fractalPatterns[key] = {};
        return this.fractalPatterns[key];
    }
    _getMultiStep(L, key) {
        if (!this.multiStep[L]) this.multiStep[L] = {};
        if (!this.multiStep[L][key]) this.multiStep[L][key] = { T: 0, X: 0 };
        return this.multiStep[L][key];
    }
    _getTransition(key) {
        if (!this.transitions[key]) this.transitions[key] = { T: 0, X: 0 };
        return this.transitions[key];
    }

    update(d1, d2, d3) {
        this.diceHistory.push([d1, d2, d3]);
        const total = d1 + d2 + d3;
        this.session++;

        for (let vi = 0; vi < 3; vi++) {
            const dv = [d1, d2, d3][vi];
            for (const L of [2, 3, 4, 5, 6]) {
                if (this.diceHistory.length >= L + 1) {
                    const recent = [];
                    for (let j = this.diceHistory.length - L - 1; j < this.diceHistory.length - 1; j++) recent.push(this.diceHistory[j][vi]);
                    const key = recent.join(',');
                    const pat = this._getDicePattern(vi + 1, key);
                    pat[dv] = (pat[dv] || 0) + 1;
                }
            }
        }

        for (const L of [2, 3, 5, 8, 13, 21]) {
            if (this.diceHistory.length >= L + 1) {
                const recent = [];
                for (let j = this.diceHistory.length - L - 1; j < this.diceHistory.length - 1; j++) {
                    recent.push(this.diceHistory[j][0] + this.diceHistory[j][1] + this.diceHistory[j][2]);
                }
                const key = recent.join(',');
                const pat = this._getSumPattern(key);
                pat[total] = (pat[total] || 0) + 1;
            }
        }

        if (this.diceHistory.length >= 6) {
            for (let d = 2; d <= 5; d++) {
                const step = Math.pow(2, d - 1);
                const indices = [];
                for (let j = this.diceHistory.length - 1; j >= Math.max(-1, this.diceHistory.length - Math.pow(2, d) - 1); j -= step) indices.push(j);
                if (indices.length >= 2) {
                    const vals = indices.slice(0, d).map(i => this.diceHistory[i][0] + this.diceHistory[i][1] + this.diceHistory[i][2]);
                    const key = vals.join(',');
                    const pat = this._getFractalPattern(key);
                    pat[total] = (pat[total] || 0) + 1;
                }
            }
        }

        if (this.diceHistory.length >= 5) {
            const pt = [];
            for (let i = 1; i <= 5; i++) {
                const h = this.diceHistory[this.diceHistory.length - i];
                pt.push(h[0] + h[1] + h[2]);
            }
            this.attractor.push(pt);
            if (this.attractor.length > 500) this.attractor.shift();
        }

        for (const step of [1, 2, 3, 4, 5]) {
            for (const L of [3, 5, 8, 13]) {
                if (this.diceHistory.length >= L + step) {
                    const past = [];
                    for (let j = this.diceHistory.length - L - step; j < this.diceHistory.length - step; j++) {
                        past.push(this.diceHistory[j][0] + this.diceHistory[j][1] + this.diceHistory[j][2]);
                    }
                    const key = past.join(',');
                    const future = this.diceHistory[this.diceHistory.length - step];
                    const futureTotal = future[0] + future[1] + future[2];
                    const outcome = futureTotal > 10 ? 'T' : 'X';
                    const ms = this._getMultiStep(L, key);
                    ms[outcome] = (ms[outcome] || 0) + 1;
                }
            }
        }
    }

    adapt() {
        const all = { ...this.methods, ...this.cau };
        for (const [name, d] of Object.entries(all)) {
            const t = (d.w || 0) + (d.l || 0);
            if (t >= 5) {
                const r = (d.r || []).slice(-40);
                if (r.length > 0) {
                    const weights = r.map((_, i) => Math.exp(-0.02 * (r.length - 1 - i)));
                    const wSum = weights.reduce((a, b) => a + b, 0);
                    const ra = r.reduce((a, v, i) => a + v * weights[i], 0) / wSum;
                    const oa = (d.w || 0) / t;
                    const streakBonus = Math.min((d.streak || 0) * 0.08, 0.5);
                    const volumeBonus = Math.min(t / 50, 0.3);
                    d.wt = Math.max(0.01, Math.min(5.0, (ra * 0.55 + oa * 0.25 + 0.2) * (1 + streakBonus + volumeBonus)));
                }
            }
        }
    }

    getAcc() { return this.total === 0 ? 50 : this.correct / this.total * 100; }

    save(filepath) {
        const data = {
            ses: this.session, corr: this.correct, tot: this.total,
            bestAcc: this.bestAcc, bestStreak: this.bestStreak, errorStreak: this.errorStreak,
            m: {}, c: {}
        };
        for (const [k, v] of Object.entries(this.methods)) data.m[k] = { w: v.w, l: v.l, wt: v.wt, streak: v.streak, best: v.best };
        for (const [k, v] of Object.entries(this.cau)) data.c[k] = { w: v.w, l: v.l, wt: v.wt, streak: v.streak };
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filepath, JSON.stringify(data));
    }

    load(filepath) {
        if (!fs.existsSync(filepath)) return false;
        const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        this.session = data.ses || 0;
        this.correct = data.corr || 0;
        this.total = data.tot || 0;
        this.bestAcc = data.bestAcc || 0;
        this.bestStreak = data.bestStreak || 0;
        this.errorStreak = data.errorStreak || 0;
        for (const [k, v] of Object.entries(data.m || {})) { this._getMethod(k); Object.assign(this.methods[k], v); }
        for (const [k, v] of Object.entries(data.c || {})) { this._getCau(k); Object.assign(this.cau[k], v); }
        return true;
    }
}

class TXDetector {
    constructor(L, V, M) { this.L = L; this.V = V; this.M = M; }

    _streak() {
        if (!this.L.length) return [0, null];
        const last = this.L[this.L.length - 1];
        let s = 1;
        for (let i = this.L.length - 2; i >= 0; i--) { if (this.L[i] === last) s++; else break; }
        return [s, last];
    }

    _linreg(y) {
        const n = y.length;
        let sx = 0, sy = 0, sxy = 0, sx2 = 0;
        for (let i = 0; i < n; i++) { sx += i; sy += y[i]; sxy += i * y[i]; sx2 += i * i; }
        return (n * sxy - sx * sy) / (n * sx2 - sx * sx);
    }

    // 30+ LOẠI CẦU
    bet() {
        const [s, l] = this._streak();
        if (s >= 7) return { pred: l === 'T' ? 'X' : 'T', conf: 93, strength: s, reason: 'Be Bet Rong' };
        if (s >= 5) return { pred: l === 'T' ? 'X' : 'T', conf: 82, strength: s, reason: 'Be Bet Dai' };
        if (s >= 3) return { pred: l, conf: 72, strength: s, reason: 'Du Bet' };
        if (s >= 2) return { pred: l, conf: 60, strength: s, reason: 'Bet Nhe' };
        return null;
    }

    noi_1_1() {
        if (this.L.length < 6) return null;
        const s = this.L.slice(-6);
        if (s.every((v, i) => i === 0 || v !== s[i - 1])) return { pred: s[5] === 'T' ? 'X' : 'T', conf: 82, strength: 6, reason: 'Cau Noi 1-1' };
        return null;
    }

    ziczac() {
        if (this.L.length < 10) return null;
        const s = this.L.slice(-10);
        if (s.every((v, i) => i === 0 || v !== s[i - 1])) return { pred: s[9] === 'T' ? 'X' : 'T', conf: 80, strength: 10, reason: 'Zic Zac' };
        return null;
    }

    doi_2_2() {
        if (this.L.length < 4) return null;
        const s = this.L.slice(-4);
        if (s[0] === s[1] && s[2] === s[3] && s[0] !== s[2]) return { pred: s[2], conf: 78, strength: 4, reason: 'Cau 2-2' };
        return null;
    }

    doi_3_3() {
        if (this.L.length < 6) return null;
        const s = this.L.slice(-6);
        if (s[0] === s[1] && s[1] === s[2] && s[3] === s[4] && s[4] === s[5] && s[0] !== s[3]) return { pred: s[3], conf: 80, strength: 6, reason: 'Cau 3-3' };
        return null;
    }

    doi_2_1() {
        if (this.L.length < 6) return null;
        const s = this.L.slice(-6);
        const c1 = s.slice(0, 3).join(''), c2 = s.slice(3, 6).join('');
        if ((c1 === 'TTX' || c1 === 'XXT') && c1 === c2) return { pred: c1 === 'TTX' ? 'T' : 'X', conf: 87, strength: 6, reason: 'Cau 2-1' };
        return null;
    }

    doi_3_1() {
        if (this.L.length < 8) return null;
        const s = this.L.slice(-8);
        const c1 = s.slice(0, 4).join(''), c2 = s.slice(4, 8).join('');
        if ((c1 === 'TTTX' || c1 === 'XXXT') && c1 === c2) return { pred: c1 === 'TTTX' ? 'T' : 'X', conf: 87, strength: 8, reason: 'Cau 3-1' };
        return null;
    }

    doi_1_2() {
        if (this.L.length < 9) return null;
        const s = this.L.slice(-9);
        const c1 = s.slice(0, 3).join(''), c2 = s.slice(3, 6).join(''), c3 = s.slice(6, 9).join('');
        if (c1 === c2 && c2 === c3 && (c1 === 'TXX' || c1 === 'XTT')) return { pred: c1 === 'TXX' ? 'T' : 'X', conf: 80, strength: 9, reason: 'Cau 1-2' };
        return null;
    }

    doi_1_3() {
        if (this.L.length < 8) return null;
        const s = this.L.slice(-8);
        const c1 = s.slice(0, 4).join(''), c2 = s.slice(4, 8).join('');
        if ((c1 === 'TXXX' || c1 === 'XTTT') && c1 === c2) return { pred: c1 === 'TXXX' ? 'T' : 'X', conf: 80, strength: 8, reason: 'Cau 1-3' };
        return null;
    }

    gay_3_2() {
        if (this.L.length < 5) return null;
        const s = this.L.slice(-5);
        if (s[0] === s[1] && s[1] === s[2] && s[2] !== s[3] && s[3] === s[4]) return { pred: s[3], conf: 74, strength: 5, reason: 'Gay 3-2' };
        return null;
    }

    gay_2_3() {
        if (this.L.length < 5) return null;
        const s = this.L.slice(-5);
        if (s[0] === s[1] && s[1] !== s[2] && s[2] === s[3] && s[3] === s[4]) return { pred: s[2], conf: 74, strength: 5, reason: 'Gay 2-3' };
        return null;
    }

    gay_1_2_1() {
        if (this.L.length < 4) return null;
        const s = this.L.slice(-4);
        if (s[0] !== s[1] && s[1] === s[2] && s[2] !== s[3] && s[0] === s[3]) return { pred: s[1], conf: 72, strength: 4, reason: 'Gay 1-2-1' };
        return null;
    }

    gay_2_1_2() {
        if (this.L.length < 5) return null;
        const s = this.L.slice(-5);
        if (s[0] === s[1] && s[1] !== s[2] && s[2] !== s[3] && s[3] === s[4] && s[0] === s[4]) return { pred: s[2], conf: 72, strength: 5, reason: 'Gay 2-1-2' };
        return null;
    }

    mau_lap() {
        if (this.L.length < 6) return null;
        const arr = this.L.slice(-15);
        for (let Ln = 2; Ln <= 5; Ln++) {
            const pat = arr.slice(0, Ln);
            for (let i = Ln; i < arr.length - Ln + 1; i++) {
                const sub = arr.slice(i, i + Ln);
                if (JSON.stringify(sub) === JSON.stringify(pat) && i > 0) return { pred: arr[i - 1], conf: 88, strength: Ln, reason: `Mau Lap ${pat.join('')}` };
            }
        }
        return null;
    }

    vi_cuc_tri() {
        if (this.V.length < 5) return null;
        const pts = this.V.slice(-8);
        const last = pts[pts.length - 1];
        const prev = pts[pts.length - 2];
        const avg = pts.reduce((a, b) => a + b, 0) / pts.length;
        const std = Math.sqrt(pts.reduce((a, b) => a + (b - avg) ** 2, 0) / pts.length);
        if (last >= 16) return { pred: 'X', conf: 78, strength: 1, reason: 'Vi Cuc Dai' };
        if (last <= 4) return { pred: 'T', conf: 78, strength: 1, reason: 'Vi Cuc Tieu' };
        if (last > avg + 2 * std) return { pred: 'X', conf: 72, strength: 1, reason: 'Vi Dot Bien Cao' };
        if (last < avg - 2 * std) return { pred: 'T', conf: 72, strength: 1, reason: 'Vi Dot Bien Thap' };
        if (avg > 11 && last > prev) return { pred: 'X', conf: 68, strength: 1, reason: 'Vi Bao Hoa' };
        if (avg < 10 && last < prev) return { pred: 'T', conf: 68, strength: 1, reason: 'Vi Can Kiet' };
        if (avg >= 11 && last >= 11 && last <= 13) return { pred: 'T', conf: 65, strength: 1, reason: 'Vi On Dinh Tai' };
        if (avg <= 9 && last >= 7 && last <= 9) return { pred: 'X', conf: 65, strength: 1, reason: 'Vi On Dinh Xiu' };
        return null;
    }

    cycle() {
        if (this.L.length < 10) return null;
        for (const p of [4, 5, 6, 7, 8, 10, 12, 15, 20]) {
            if (this.L.length >= 2 * p) {
                const a = this.L.slice(-2 * p, -p), b = this.L.slice(-p);
                if (JSON.stringify(a) === JSON.stringify(b)) return { pred: b[b.length - 1] === 'T' ? 'X' : 'T', conf: 85, strength: p, reason: `Tuan Hoan ${p}` };
            }
        }
        return null;
    }

    nhay() {
        if (this.L.length < 8) return null;
        const s = this.L.slice(-10);
        let ch = 0;
        for (let i = 1; i < s.length; i++) if (s[i] !== s[i - 1]) ch++;
        if (ch >= 7) return { pred: s[s.length - 1] === 'T' ? 'X' : 'T', conf: 79, strength: ch, reason: 'Cau Nhay Manh' };
        if (ch >= 5) return { pred: s[s.length - 1] === 'T' ? 'X' : 'T', conf: 70, strength: ch, reason: 'Cau Nhay' };
        return null;
    }

    tam_giac() {
        if (this.L.length < 7) return null;
        const v = this.L.slice(-7).map(x => x === 'T' ? 1 : 0);
        let peak = 0, maxVal = v[0];
        for (let i = 1; i < v.length; i++) { if (v[i] > maxVal) { maxVal = v[i]; peak = i; } }
        if (peak > 0 && peak < v.length - 1) {
            const lf = v.slice(0, peak), rt = v.slice(peak + 1);
            let lfOk = true, rtOk = true;
            for (let i = 0; i < lf.length - 1; i++) if (lf[i] > lf[i + 1]) lfOk = false;
            for (let i = 0; i < rt.length - 1; i++) if (rt[i] < rt[i + 1]) rtOk = false;
            if (lfOk && rtOk) return { pred: this.L[this.L.length - 1] === 'T' ? 'X' : 'T', conf: 72, strength: peak, reason: 'Tam Giac' };
        }
        return null;
    }

    balance() {
        if (this.L.length < 6) return null;
        const s = this.L.slice(-6);
        const c = s.filter(x => x === 'T').length;
        if (c === 3) return { pred: s[5] === 'T' ? 'X' : 'T', conf: 67, strength: 3, reason: 'Can Bang' };
        return null;
    }

    peak() {
        if (this.L.length < 10) return null;
        const v = this.L.slice(-12).map(x => x === 'T' ? 1 : 0);
        const peaks = [];
        for (let i = 1; i < v.length - 1; i++) { if (v[i] > v[i - 1] && v[i] > v[i + 1]) peaks.push(i); }
        if (peaks.length >= 3) return { pred: this.L[this.L.length - 1] === 'T' ? 'X' : 'T', conf: 72, strength: peaks.length, reason: 'Dinh Nui' };
        if (peaks.length >= 2) return { pred: this.L[this.L.length - 1] === 'T' ? 'X' : 'T', conf: 68, strength: peaks.length, reason: 'Dinh Nui Nhe' };
        return null;
    }

    valley() {
        if (this.L.length < 10) return null;
        const v = this.L.slice(-12).map(x => x === 'T' ? 1 : 0);
        const vals = [];
        for (let i = 1; i < v.length - 1; i++) { if (v[i] < v[i - 1] && v[i] < v[i + 1]) vals.push(i); }
        if (vals.length >= 3) return { pred: this.L[this.L.length - 1] === 'X' ? 'T' : 'X', conf: 72, strength: vals.length, reason: 'Day Thung' };
        if (vals.length >= 2) return { pred: this.L[this.L.length - 1] === 'X' ? 'T' : 'X', conf: 68, strength: vals.length, reason: 'Day Thung Nhe' };
        return null;
    }

    reversal() {
        if (this.L.length < 12) return null;
        const last = this.L[this.L.length - 1];
        const opp = last === 'T' ? 'X' : 'T';
        const recent6 = this.L.slice(-6);
        const recent10 = this.L.slice(-10);
        if (recent6.filter(x => x === opp).length >= 4) return { pred: opp, conf: 70, strength: 4, reason: 'Hoi Phuc Manh' };
        if (recent10.filter(x => x === opp).length >= 6) return { pred: opp, conf: 66, strength: 6, reason: 'Hoi Phuc' };
        return null;
    }

    divergence() {
        if (this.V.length < 10) return null;
        const rv = this.V.slice(-12);
        const rl = this.L.slice(-12).map(x => x === 'T' ? 1 : 0);
        const vt = this._linreg(rv);
        const lt = this._linreg(rl);
        if (vt > 0.3 && lt < -0.05) return { pred: 'X', conf: 73, strength: 1, reason: 'Phan Ky' };
        if (vt < -0.3 && lt > 0.05) return { pred: 'T', conf: 73, strength: 1, reason: 'Phan Ky' };
        return null;
    }

    fractal() {
        if (this.L.length < 12) return null;
        for (const lv of [2, 3, 4, 6, 8]) {
            if (this.L.length >= lv * 2) {
                const a = this.L.slice(-lv), b = this.L.slice(-2 * lv, -lv);
                let m = 0;
                for (let i = 0; i < lv; i++) if (a[i] === b[i]) m++;
                m /= lv;
                if (m > 0.7) return { pred: this.L[this.L.length - 1] === 'T' ? 'X' : 'T', conf: 62 + m * 25, strength: lv, reason: 'Fractal' };
            }
        }
        return null;
    }

    entropy() {
        if (this.L.length < 15) return null;
        const s = this.L.slice(-20);
        const p = s.filter(x => x === 'T').length / 20;
        let ent = 0;
        if (p > 0 && p < 1) ent = -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
        if (ent < 0.25) return { pred: p > 0.5 ? 'T' : 'X', conf: 76, strength: 1, reason: 'Entropy Rat Thap' };
        if (ent < 0.4) return { pred: p > 0.5 ? 'T' : 'X', conf: 68, strength: 1, reason: 'Entropy Thap' };
        if (ent > 0.9) return { pred: s[19] === 'T' ? 'X' : 'T', conf: 71, strength: 1, reason: 'Entropy Cao' };
        return null;
    }

    chaos() {
        if (this.M.attractor.length < 25) return null;
        const pts = this.M.attractor.slice(-40);
        const cur = pts[pts.length - 1];
        const dists = pts.slice(0, -1).map(p => {
            let sum = 0;
            for (let i = 0; i < p.length; i++) sum += (p[i] - cur[i]) ** 2;
            return Math.sqrt(sum);
        });
        const near = dists.map((d, i) => ({ d, i })).sort((a, b) => a.d - b.d).slice(0, 7);
        const preds = near.filter(n => n.i + 1 < pts.length).map(n => pts[n.i + 1][pts[n.i + 1].length - 1]);
        if (preds.length >= 3) {
            const avg = preds.reduce((a, b) => a + b, 0) / preds.length;
            return { pred: avg > 10 ? 'T' : 'X', conf: 61, strength: preds.length, reason: 'Chaos' };
        }
        return null;
    }

    gann() {
        if (this.L.length < 20) return null;
        const periods = [7, 9, 12, 14, 18, 21, 24, 28];
        let best = null;
        for (const p of periods) {
            if (this.L.length >= p * 2) {
                const a = this.L.slice(-p), b = this.L.slice(-2 * p, -p);
                let m = 0;
                for (let i = 0; i < p; i++) if (a[i] === b[i]) m++;
                m /= p;
                if (m > 0.6 && (!best || m > best.match)) best = { period: p, match: m };
            }
        }
        if (best && best.match > 0.65) return { pred: this.L[this.L.length - best.period], conf: 62 + best.match * 22, strength: best.period, reason: `Gann ${best.period}` };
        return null;
    }

    song() {
        if (this.L.length < 14) return null;
        const s = this.L.slice(-14);
        let ch = 0;
        for (let i = 1; i < s.length; i++) if (s[i] !== s[i - 1]) ch++;
        if (ch >= 6 && ch <= 9) return { pred: s[s.length - 1] === 'T' ? 'X' : 'T', conf: 67, strength: ch, reason: 'Song' };
        return null;
    }

    bac_thang() {
        if (this.L.length < 8) return null;
        const streaks = [];
        let curr = 1;
        for (let i = 1; i < this.L.slice(-10).length; i++) {
            if (this.L.slice(-10)[i] === this.L.slice(-10)[i - 1]) curr++;
            else { streaks.push(curr); curr = 1; }
        }
        streaks.push(curr);
        if (streaks.length >= 3) {
            let ok = true;
            for (let i = 0; i < streaks.length - 1; i++) { if (streaks[i] < streaks[i + 1]) ok = false; }
            if (ok) return { pred: this.L[this.L.length - 1] === 'T' ? 'X' : 'T', conf: 73, strength: streaks.length, reason: 'Bac Thang' };
        }
        return null;
    }

    detectAll() {
        const detectors = [
            ['mau_lap', () => this.mau_lap()],
            ['noi_1_1', () => this.noi_1_1()],
            ['ziczac', () => this.ziczac()],
            ['doi_2_2', () => this.doi_2_2()],
            ['doi_3_3', () => this.doi_3_3()],
            ['doi_2_1', () => this.doi_2_1()],
            ['doi_3_1', () => this.doi_3_1()],
            ['doi_1_2', () => this.doi_1_2()],
            ['doi_1_3', () => this.doi_1_3()],
            ['gay_3_2', () => this.gay_3_2()],
            ['gay_2_3', () => this.gay_2_3()],
            ['gay_1_2_1', () => this.gay_1_2_1()],
            ['gay_2_1_2', () => this.gay_2_1_2()],
            ['bet', () => this.bet()],
            ['vi', () => this.vi_cuc_tri()],
            ['cycle', () => this.cycle()],
            ['nhay', () => this.nhay()],
            ['tam_giac', () => this.tam_giac()],
            ['balance', () => this.balance()],
            ['peak', () => this.peak()],
            ['valley', () => this.valley()],
            ['reversal', () => this.reversal()],
            ['divergence', () => this.divergence()],
            ['fractal', () => this.fractal()],
            ['entropy', () => this.entropy()],
            ['chaos', () => this.chaos()],
            ['gann', () => this.gann()],
            ['song', () => this.song()],
            ['bac_thang', () => this.bac_thang()],
        ];
        const results = [];
        for (const [name, fn] of detectors) {
            const r = fn();
            if (r) {
                const cauData = this.M._getCau(name);
                results.push({
                    name: `c_${name}`,
                    pred: r.pred === 'T' ? 'TAI' : 'XIU',
                    conf: r.conf * (cauData.wt || 1.0),
                    strength: r.strength,
                    reason: r.reason
                });
            }
        }
        return results;
    }
}

class TXTrend {
    constructor(L, V, M) { this.L = L; this.V = V; this.M = M; }

    _linreg(y) {
        const n = y.length;
        let sx = 0, sy = 0, sxy = 0, sx2 = 0;
        for (let i = 0; i < n; i++) { sx += i; sy += y[i]; sxy += i * y[i]; sx2 += i * i; }
        return (n * sxy - sx * sy) / (n * sx2 - sx * sx);
    }

    short() {
        if (this.V.length < 5) return null;
        const avg = this.V.slice(-5).reduce((a, b) => a + b, 0) / 5;
        if (avg > 12) return { pred: 'X', conf: 72, reason: 'Short OB' };
        if (avg < 8) return { pred: 'T', conf: 72, reason: 'Short OS' };
        return null;
    }

    med() {
        if (this.V.length < 10) return null;
        const slope = this._linreg(this.V.slice(-10));
        if (Math.abs(slope) > 0.5) return { pred: slope > 0 ? 'T' : 'X', conf: 67, reason: 'Medium Trend' };
        return null;
    }

    long() {
        if (this.V.length < 30) return null;
        const slope = this._linreg(this.V.slice(-30));
        if (Math.abs(slope) > 0.2) return { pred: slope > 0 ? 'T' : 'X', conf: 60, reason: 'Long Trend' };
        return null;
    }

    rev() {
        if (this.V.length < 20) return null;
        const r = this.V.slice(-20);
        const avg = r.reduce((a, b) => a + b, 0) / r.length;
        const last = r[r.length - 1];
        if (last > avg + 3) return { pred: 'X', conf: 77, reason: 'Mean Reversion' };
        if (last < avg - 3) return { pred: 'T', conf: 77, reason: 'Mean Reversion' };
        if (last > avg + 2) return { pred: 'X', conf: 67, reason: 'Mean Rev Nhe' };
        if (last < avg - 2) return { pred: 'T', conf: 67, reason: 'Mean Rev Nhe' };
        return null;
    }

    bal() {
        if (this.L.length < 15) return null;
        const r = this.L.slice(-15).filter(x => x === 'T').length / 15;
        if (r > 0.7) return { pred: 'X', conf: 72, reason: 'Balance Over' };
        if (r < 0.3) return { pred: 'T', conf: 72, reason: 'Balance Under' };
        if (r > 0.6) return { pred: 'X', conf: 62, reason: 'Balance Light' };
        if (r < 0.4) return { pred: 'T', conf: 62, reason: 'Balance Light' };
        return null;
    }

    mom() {
        if (this.V.length < 6) return null;
        const d = this.V.slice(-3).reduce((a, b) => a + b, 0) / 3 - this.V.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;
        if (Math.abs(d) > 1.5) return { pred: d > 0 ? 'T' : 'X', conf: 67, reason: 'Momentum' };
        if (Math.abs(d) > 0.8) return { pred: d > 0 ? 'T' : 'X', conf: 60, reason: 'Momentum Nhe' };
        return null;
    }

    pmem() {
        if (this.L.length < 5) return null;
        let bs = 0, bp = null;
        for (const Ln of [3, 5, 8, 13, 21]) {
            if (this.L.length >= Ln) {
                const pat = this.L.slice(-Ln).join(',');
                const p = this.M._getPattern(pat);
                const t = (p.T || 0) + (p.X || 0);
                if (t >= 2) {
                    const c = Math.max(p.T || 0, p.X || 0) / t;
                    const pred = (p.T || 0) > (p.X || 0) ? 'T' : 'X';
                    const s = c * (p.w || 1.0);
                    if (s > bs) { bs = s; bp = pred; }
                }
            }
        }
        if (bp && bs > 0.5) return { pred: bp, conf: Math.min(bs * 100, 92), reason: 'Pattern Mem' };
        return null;
    }

    rsi() {
        if (this.V.length < 14) return null;
        const r = this.V.slice(-14);
        let gains = 0, losses = 0;
        for (let i = 1; i < 14; i++) {
            const diff = r[i] - r[i - 1];
            if (diff > 0) gains += diff;
            else losses += Math.abs(diff);
        }
        const ag = gains / 14, al = losses / 14 || 0.001;
        const rs = ag / al;
        const rsiVal = 100 - (100 / (1 + rs));
        if (rsiVal > 75) return { pred: 'X', conf: 74, reason: 'RSI OB' };
        if (rsiVal < 25) return { pred: 'T', conf: 74, reason: 'RSI OS' };
        if (rsiVal > 65) return { pred: 'X', conf: 64, reason: 'RSI High' };
        if (rsiVal < 35) return { pred: 'T', conf: 64, reason: 'RSI Low' };
        return null;
    }

    boll() {
        if (this.V.length < 20) return null;
        const r = this.V.slice(-20);
        const m = r.reduce((a, b) => a + b, 0) / 20;
        const s = Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / 20);
        if (r[19] > m + 2 * s) return { pred: 'X', conf: 77, reason: 'Boll OB' };
        if (r[19] < m - 2 * s) return { pred: 'T', conf: 77, reason: 'Boll OS' };
        if (r[19] > m + 1.5 * s) return { pred: 'X', conf: 67, reason: 'Boll High' };
        if (r[19] < m - 1.5 * s) return { pred: 'T', conf: 67, reason: 'Boll Low' };
        return null;
    }

    macd() {
        if (this.V.length < 26) return null;
        const r = this.V.slice(-26);
        const e12 = r.slice(-12).reduce((a, b) => a + b, 0) / 12;
        const e26 = r.reduce((a, b) => a + b, 0) / 26;
        const sig = e12 - e26;
        if (sig > 2) return { pred: 'T', conf: 67, reason: 'MACD Up' };
        if (sig < -2) return { pred: 'X', conf: 67, reason: 'MACD Down' };
        return null;
    }

    stoch() {
        if (this.V.length < 14) return null;
        const r = this.V.slice(-14);
        const h = Math.max(...r), l = Math.min(...r);
        if (h === l) return null;
        const k = (r[13] - l) / (h - l) * 100;
        if (k > 85) return { pred: 'X', conf: 70, reason: 'Stoch OB' };
        if (k < 15) return { pred: 'T', conf: 70, reason: 'Stoch OS' };
        return null;
    }

    atr() {
        if (this.V.length < 14) return null;
        const r = this.V.slice(-14);
        let trSum = 0;
        for (let i = 1; i < 14; i++) trSum += Math.abs(r[i] - r[i - 1]);
        const atrVal = trSum / 13;
        if (atrVal > 5) return { pred: r[13] > 10 ? 'X' : 'T', conf: 62, reason: 'ATR High' };
        return null;
    }

    fib() {
        if (this.V.length < 20) return null;
        const r = this.V.slice(-20);
        const h = Math.max(...r), l = Math.min(...r);
        const d = h - l;
        const last = r[19];
        if (last < l + 0.236 * d) return { pred: 'T', conf: 64, reason: 'Fib Support' };
        if (last > h - 0.236 * d) return { pred: 'X', conf: 64, reason: 'Fib Resistance' };
        return null;
    }

    vpred() {
        if (this.V.length < 5) return null;
        for (const Ln of [3, 5, 8, 13]) {
            if (this.V.length >= Ln + 1) {
                const k = this.V.slice(-Ln - 1, -1).join(',');
                const vp = this.M._getValuePattern(k);
                if (vp.n >= 3) {
                    const a = vp.s / vp.n;
                    const std = vp.vals.length > 1 ? Math.sqrt(vp.vals.reduce((s, x) => s + (x - a) ** 2, 0) / vp.vals.length) : 0;
                    const conf = 57 + Math.abs(a - 10) * 5 - std * 2;
                    return { pred: a > 10 ? 'T' : 'X', conf: Math.max(50, Math.min(85, conf)), reason: 'Value Pred' };
                }
            }
        }
        return null;
    }

    kal() {
        if (this.V.length < 5) return null;
        const r = this.V.slice(-5);
        const st = r[4];
        const v = r.length >= 2 ? r[4] - r[3] : 0;
        const a = r.length >= 3 ? (r[4] - 2 * r[3] + r[2]) : 0;
        const j = r.length >= 4 ? (r[4] - 3 * r[3] + 3 * r[2] - r[1]) : 0;
        const pred = st + v + 0.5 * a + j / 6;
        return { pred: pred > 10 ? 'T' : 'X', conf: Math.max(50, Math.min(80, 57 + Math.abs(pred - 10) * 4)), reason: 'Kalman' };
    }

    bayes() {
        if (this.L.length < 10) return null;
        const tc = this.L.slice(-10).filter(x => x === 'T').length;
        const prob = (1 + tc) / (2 + 10);
        return { pred: prob > 0.5 ? 'T' : 'X', conf: Math.abs(prob - 0.5) * 200, reason: 'Bayes' };
    }

    expSmooth() {
        if (this.V.length < 8) return null;
        const r = this.V.slice(-8);
        const weights = r.map((_, i) => Math.exp(-0.3 * (7 - i)));
        const wSum = weights.reduce((a, b) => a + b, 0);
        const pred = r.reduce((a, v, i) => a + v * weights[i], 0) / wSum;
        return { pred: pred > 10 ? 'T' : 'X', conf: 55 + Math.abs(pred - 10) * 4, reason: 'Exp Smooth' };
    }

    hurst() {
        if (this.V.length < 30) return null;
        const r = this.V.slice(-40);
        const n = r.length;
        const lags = [2, 3, 4, 5, 6, 8, 10];
        const rsVals = [];
        for (const lag of lags) {
            const chunks = [];
            for (let i = 0; i < n - lag + 1; i += lag) {
                const c = r.slice(i, i + lag);
                if (c.length === lag) chunks.push(c);
            }
            if (chunks.length >= 2) {
                const rs = chunks.map(c => {
                    const m = c.reduce((a, b) => a + b, 0) / c.length;
                    const cumDev = c.map(x => x - m).map((s => x => s += x)(0));
                    const range = Math.max(...cumDev) - Math.min(...cumDev);
                    const std = Math.sqrt(c.reduce((a, x) => a + (x - m) ** 2, 0) / c.length) || 0.001;
                    return range / std;
                });
                rsVals.push(Math.log(rs.reduce((a, b) => a + b, 0) / rs.length));
            }
        }
        if (rsVals.length >= 4) {
            const logLags = lags.slice(0, rsVals.length).map(Math.log);
            const slope = this._linreg(logLags.map((x, i) => rsVals[i]));
            if (slope > 0.6) return { pred: r.slice(-5).reduce((a, b) => a + b, 0) / 5 > 10 ? 'T' : 'X', conf: 64, reason: 'Hurst Trend' };
            if (slope < 0.4) return { pred: r.slice(-5).reduce((a, b) => a + b, 0) / 5 > 10 ? 'X' : 'T', conf: 64, reason: 'Hurst Rev' };
        }
        return null;
    }

    analyzeAll() {
        const methods = [
            ['short', () => this.short()], ['med', () => this.med()], ['long', () => this.long()],
            ['rev', () => this.rev()], ['bal', () => this.bal()], ['mom', () => this.mom()],
            ['pmem', () => this.pmem()], ['rsi', () => this.rsi()], ['boll', () => this.boll()],
            ['macd', () => this.macd()], ['stoch', () => this.stoch()], ['atr', () => this.atr()],
            ['fib', () => this.fib()], ['vpred', () => this.vpred()], ['kal', () => this.kal()],
            ['bayes', () => this.bayes()], ['exp', () => this.expSmooth()], ['hurst', () => this.hurst()],
        ];
        const results = [];
        for (const [name, fn] of methods) {
            const r = fn();
            if (r) {
                const mData = this.M._getMethod(name);
                results.push({
                    name: `t_${name}`,
                    pred: r.pred === 'T' ? 'TAI' : 'XIU',
                    conf: r.conf * (mData.wt || 1.0),
                    strength: 2,
                    reason: r.reason
                });
            }
        }
        return results;
    }
}

class TXDice {
    constructor(memory, diceHistory) { this.M = memory; this.dice = diceHistory; }

    total() {
        if (this.dice.length < 5) return [null, 0];
        const preds = [];
        for (const L of [3, 5, 8, 13, 21]) {
            if (this.dice.length >= L + 1) {
                const recent = [];
                for (let j = this.dice.length - L - 1; j < this.dice.length - 1; j++) recent.push(this.dice[j][0] + this.dice[j][1] + this.dice[j][2]);
                const key = recent.join(',');
                const pat = this.M._getSumPattern(key);
                const entries = Object.entries(pat);
                if (entries.length > 0) {
                    const total = entries.reduce((a, b) => a + b[1], 0);
                    const best = entries.reduce((a, b) => b[1] > a[1] ? b : a, entries[0]);
                    preds.push({ val: parseInt(best[0]), conf: best[1] / total, L });
                }
            }
        }
        if (preds.length > 0) {
            let ws = 0, wt = 0;
            for (const p of preds) { ws += p.val * p.conf * p.L; wt += p.conf * p.L; }
            return [wt > 0 ? ws / wt : null, 74];
        }
        return [null, 0];
    }

    indiv() {
        const res = {};
        for (let vi = 0; vi < 3; vi++) {
            for (const L of [3, 4, 5, 6]) {
                if (this.dice.length >= L + 1) {
                    const recent = [];
                    for (let j = this.dice.length - L - 1; j < this.dice.length - 1; j++) recent.push(this.dice[j][vi]);
                    const key = recent.join(',');
                    const pat = this.M._getDicePattern(vi + 1, key);
                    const entries = Object.entries(pat);
                    if (entries.length > 0) {
                        const total = entries.reduce((a, b) => a + b[1], 0);
                        const best = entries.reduce((a, b) => b[1] > a[1] ? b : a, entries[0]);
                        res[`d${vi + 1}_L${L}`] = [parseInt(best[0]), best[1] / total * 100];
                    }
                }
            }
        }
        return res;
    }

    multi(steps = 5) {
        const preds = {};
        for (const step of [1, 2, 3, 4, 5]) {
            for (const L of [5, 8, 13]) {
                if (this.dice.length >= L + step) {
                    const past = [];
                    for (let j = this.dice.length - L - step; j < this.dice.length - step; j++) {
                        past.push(this.dice[j][0] + this.dice[j][1] + this.dice[j][2]);
                    }
                    const key = past.join(',');
                    const ms = this.M._getMultiStep(L, key);
                    const total = (ms.T || 0) + (ms.X || 0);
                    if (total > 0) {
                        const best = (ms.T || 0) > (ms.X || 0) ? 'T' : 'X';
                        preds[`s${step}_L${L}`] = [best, Math.max(ms.T || 0, ms.X || 0) / total * 100];
                    }
                }
            }
        }
        return preds;
    }

    fractal() {
        if (this.dice.length < 6) return [null, 0];
        const preds = [];
        for (let d = 2; d <= 5; d++) {
            const step = Math.pow(2, d - 1);
            const indices = [];
            for (let j = this.dice.length - 1; j >= Math.max(-1, this.dice.length - Math.pow(2, d) - 1); j -= step) indices.push(j);
            if (indices.length >= 2) {
                const vals = indices.slice(0, d).map(i => this.dice[i][0] + this.dice[i][1] + this.dice[i][2]);
                const key = vals.join(',');
                const pat = this.M._getFractalPattern(key);
                const entries = Object.entries(pat);
                if (entries.length > 0) {
                    const total = entries.reduce((a, b) => a + b[1], 0);
                    const best = entries.reduce((a, b) => b[1] > a[1] ? b : a, entries[0]);
                    preds.push({ val: parseInt(best[0]), conf: best[1] / total, d });
                }
            }
        }
        if (preds.length > 0) {
            let ws = 0, wt = 0;
            for (const p of preds) { ws += p.val * p.conf * p.d; wt += p.conf * p.d; }
            return [wt > 0 ? ws / wt : null, 69];
        }
        return [null, 0];
    }
}

class TXEnsemble {
    constructor(memory) { this.M = memory; }

    predict(signals) {
        if (signals.length === 0) return { pred: null, conf: 50, signals: [] };
        let tai = 0, tot = 0;
        for (const s of signals) {
            let w = 1.0;
            if (s.name.startsWith('c_')) w = (this.M.cau[s.name.replace('c_', '')] || {}).wt || 1.0;
            else if (s.name.startsWith('t_')) w = (this.M.methods[s.name.replace('t_', '')] || {}).wt || 1.0;
            else if (s.name.includes('dice') || s.name.includes('step')) w = 1.6;
            const weight = s.conf / 100 * s.strength * w;
            if (s.pred === 'TAI') tai += weight;
            tot += weight;
        }
        if (tot === 0) return { pred: null, conf: 50, signals };
        let ratio = tai / tot;
        if (this.M.errorStreak >= CONFIG.ERROR_STREAK_THRESHOLD) ratio = 1 - ratio;
        if (this.M.streak >= 6) ratio = ratio * 0.8 + 0.1;
        else if (this.M.streak >= 4) ratio = ratio * 0.85 + 0.075;
        else if (this.M.streak >= 2) ratio = ratio * 0.9 + 0.05;
        if (Math.abs(ratio - 0.5) < CONFIG.NOISE) return { pred: null, conf: 50, signals };
        const pred = ratio > 0.5 ? 'TAI' : 'XIU';
        const conf = Math.min(Math.abs(ratio - 0.5) * 200, 99.5);
        return { pred, conf, signals };
    }
}

class TXPredictor {
    constructor() {
        this.history = []; this.labels = []; this.values = []; this.diceHistory = [];
        this.memory = new TXMemory(); this.ensemble = new TXEnsemble(this.memory);
        this.accHistory = []; this._lastPred = null; this._lastSignals = [];
        this.startTime = new Date(); this.totalPredsMade = 0; this.predictionStarted = false;
        this.memory.load(CONFIG.SAVE_PATH);
    }

    add(d1, d2, d3) {
        const t = d1 + d2 + d3; const r = t > 10 ? 'T' : 'X';
        this.history.push(t); this.labels.push(r); this.values.push(t); this.diceHistory.push([d1, d2, d3]);
        this.memory.update(d1, d2, d3); this._learn(); this._evaluate(r);
    }

    _evaluate(r) {
        if (!this._lastPred) return;
        const actual = r === 'T' ? 'TAI' : 'XIU';
        const correct = this._lastPred === actual;
        this.accHistory.push(correct ? 1 : 0);
        this.memory.total++;
        if (correct) { this.memory.correct++; this.memory.streak++; this.memory.errorStreak = 0; }
        else { this.memory.streak = 0; this.memory.errorStreak++; }
        this.memory.bestStreak = Math.max(this.memory.bestStreak, this.memory.streak);
        this.memory.bestAcc = Math.max(this.memory.bestAcc, this.memory.getAcc());
        for (const s of this._lastSignals) {
            const ic = s.pred === actual;
            if (s.name.startsWith('c_')) {
                const cn = s.name.replace('c_', ''); const c = this.memory._getCau(cn);
                c.r = c.r || []; c.r.push(ic ? 1 : 0);
                if (ic) { c.w = (c.w || 0) + 1; c.streak = (c.streak || 0) + 1; }
                else { c.l = (c.l || 0) + 1; c.streak = 0; }
            } else if (s.name.startsWith('t_')) {
                const mn = s.name.replace('t_', ''); const m = this.memory._getMethod(mn);
                m.r = m.r || []; m.r.push(ic ? 1 : 0);
                if (ic) { m.w = (m.w || 0) + 1; m.streak = (m.streak || 0) + 1; m.best = Math.max(m.best || 0, m.streak); }
                else { m.l = (m.l || 0) + 1; m.streak = 0; }
            }
        }
        if (this.memory.session % CONFIG.ADAPT_INTERVAL === 0) this.memory.adapt();
    }

    _learn() {
        const n = this.labels.length;
        for (let L = 2; L < Math.min(CONFIG.MAX_PATTERN, n); L++) {
            for (let i = 0; i < n - L; i++) {
                const pat = this.labels.slice(i, i + L).join(',');
                const p = this.memory._getPattern(pat);
                if (this.labels[i + L] === 'T') p.T = (p.T || 0) + 1;
                else p.X = (p.X || 0) + 1;
                p.n = (p.n || 0) + 1;
            }
        }
        for (const L of [3, 5, 8, 13]) {
            if (this.values.length >= L + 1) {
                const k = this.values.slice(-L - 1, -1).join(',');
                const vp = this.memory._getValuePattern(k);
                vp.s += this.values[this.values.length - 1];
                vp.n += 1;
                vp.vals = vp.vals || [];
                vp.vals.push(this.values[this.values.length - 1]);
                if (vp.vals.length > 30) vp.vals.shift();
            }
        }
        if (this.labels.length >= 2) {
            const t = this.memory._getTransition(this.labels[this.labels.length - 2]);
            t[this.labels[this.labels.length - 1]] = (t[this.labels[this.labels.length - 1]] || 0) + 1;
        }
    }

    predict() {
        if (this.history.length < 3) return this._fallback();
        this.totalPredsMade++; this.predictionStarted = true;
        const detector = new TXDetector(this.labels, this.values, this.memory);
        const trend = new TXTrend(this.labels, this.values, this.memory);
        const dice = this.diceHistory.length > 0 ? new TXDice(this.memory, this.diceHistory) : null;
        let signals = [];
        signals = signals.concat(detector.detectAll().filter(s => s.conf >= CONFIG.MIN_CONF));
        signals = signals.concat(trend.analyzeAll().filter(s => s.conf >= CONFIG.MIN_CONF));
        if (dice) {
            const [tv, tc] = dice.total();
            if (tv !== null && tc >= 50) signals.push({ name: 'dice_tot', pred: tv > 10 ? 'TAI' : 'XIU', conf: tc, strength: 3, reason: 'Dice Total' });
            for (const [n, [v, c]] of Object.entries(dice.indiv())) {
                if (c >= 55) signals.push({ name: `dice_${n}`, pred: v > 3 ? 'TAI' : 'XIU', conf: c, strength: 1, reason: 'Dice Indiv' });
            }
            for (const [n, [p, c]] of Object.entries(dice.multi(5))) {
                if (c >= 50) signals.push({ name: `ms_${n}`, pred: p === 'T' ? 'TAI' : 'XIU', conf: c, strength: 2, reason: 'Multi-step' });
            }
            const [fv, fc] = dice.fractal();
            if (fv !== null && fc >= 50) signals.push({ name: 'dice_frac', pred: fv > 10 ? 'TAI' : 'XIU', conf: fc, strength: 2, reason: 'Dice Fractal' });
        }
        const result = this.ensemble.predict(signals);
        if (result.pred === null) return this._fallback();
        this._lastPred = result.pred; this._lastSignals = result.signals;
        return result;
    }

    _fallback() {
        let p;
        if (this.history.length < 3) p = !this.history.length || this.history[this.history.length - 1] > 10 ? 'TAI' : 'XIU';
        else { const l5 = this.labels.slice(-5); p = l5.filter(x => x === 'T').length >= 3 ? 'TAI' : 'XIU'; }
        this._lastPred = p;
        this._lastSignals = [{ name: 'fb', pred: p, conf: 50, strength: 1, reason: 'Fallback' }];
        return { pred: p, conf: 50, signals: this._lastSignals };
    }

    quality() {
        if (!this._lastSignals.length || this._lastSignals[0].name === 'fb') return 'KHONG TIN HIEU';
        const n = this._lastSignals.length;
        const avg = this._lastSignals.reduce((a, s) => a + s.conf, 0) / n;
        if (n >= 12 && avg >= 80) return 'GOD TIER';
        if (n >= 8 && avg >= 70) return 'RAT MANH';
        if (n >= 5 && avg >= 62) return 'MANH';
        if (n >= 3 && avg >= 55) return 'KHA';
        return 'YEU';
    }

    stats() {
        const acc = this.accHistory.length === 0 ? 50 : this.accHistory.reduce((a, b) => a + b, 0) / this.accHistory.length * 100;
        return {
            phien: this.memory.session, doChinhXac: acc.toFixed(1) + '%',
            totNhat: this.memory.bestAcc.toFixed(1) + '%', streakTotNhat: this.memory.bestStreak,
            errorStreak: this.memory.errorStreak, patterns: Object.keys(this.memory.patterns).length,
            tongDuDoan: this.memory.total, tongDung: this.memory.correct,
            tongDuDoanDaLam: this.totalPredsMade, chatLuong: this.quality(),
            topCau: Object.entries(this.memory.cau).sort((a, b) => (b[1].wt || 0) - (a[1].wt || 0)).slice(0, 5).map(([k, v]) => ({ name: k, wt: (v.wt || 1).toFixed(3) })),
            topMethod: Object.entries(this.memory.methods).sort((a, b) => (b[1].wt || 0) - (a[1].wt || 0)).slice(0, 5).map(([k, v]) => ({ name: k, wt: (v.wt || 1).toFixed(3) })),
        };
    }

    save() { this.memory.save(CONFIG.SAVE_PATH); }
}

// ============================================================
// KHỞI TẠO PREDICTOR
// ============================================================
const predictor = new TXPredictor();

// ============================================================
// LẤY DỮ LIỆU API
// ============================================================
function transformData(apiData) {
    if (!apiData || !apiData.list) return null;
    const result = [];
    for (let i = 0; i < apiData.list.length; i++) {
        const item = apiData.list[i];
        result.push({
            Phien: item.id,
            Ket_qua: item.resultTruyenThong === 'TAI' ? 'T' : 'X',
            d1: item.dices[0],
            d2: item.dices[1],
            d3: item.dices[2],
            Tong: item.point
        });
    }
    return result;
}

async function fetchHu() {
    try {
        const res = await axios.get(CONFIG.API_URL_HU, { timeout: 10000 });
        return transformData(res.data);
    } catch (e) {
        console.log('HU fetch error:', e.message);
        return null;
    }
}

async function fetchMd5() {
    try {
        const res = await axios.get(CONFIG.API_URL_MD5, { timeout: 10000 });
        return transformData(res.data);
    } catch (e) {
        console.log('MD5 fetch error:', e.message);
        return null;
    }
}

// ============================================================
// LƯU LỊCH SỬ
// ============================================================
let historyData = { hu: [], md5: [] };
const HISTORY_FILE = './history.json';

function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
            historyData = data;
        }
    } catch (e) { console.log('Load history error:', e.message); }
}

function saveHistory() {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(historyData, null, 2));
    } catch (e) { console.log('Save history error:', e.message); }
}

// ============================================================
// HÀM DỰ ĐOÁN
// ============================================================
function calculatePrediction(data, type) {
    for (const item of data) {
        if (item.d1 !== undefined && item.d2 !== undefined && item.d3 !== undefined) {
            predictor.add(item.d1, item.d2, item.d3);
        }
    }

    const result = predictor.predict();
    const stats = predictor.stats();

    const record = {
        phien: data[0]?.Phien || 0,
        duDoan: result.pred,
        doTinCay: result.conf.toFixed(0) + '%',
        ketQua: data[0]?.Ket_qua === 'T' ? 'TAI' : 'XIU',
        trangThai: 'PENDING',
        loai: type.toUpperCase(),
        thoiGian: new Date().toISOString()
    };

    if (data[0]?.Ket_qua) {
        const actual = data[0].Ket_qua === 'T' ? 'TAI' : 'XIU';
        record.ketQua = actual;
        record.trangThai = result.pred === actual ? 'WIN' : 'LOSE';
    }

    historyData[type].unshift(record);
    if (historyData[type].length > CONFIG.MAX_HISTORY) {
        historyData[type] = historyData[type].slice(0, CONFIG.MAX_HISTORY);
    }
    saveHistory();

    return {
        prediction: result.pred || 'TAI',
        confidence: result.conf || 50,
        signals: result.signals || [],
        stats: stats,
        quality: predictor.quality()
    };
}

// ============================================================
// SERVER - GIAO DIỆN TÍCH HỢP 1 FILE
// ============================================================

// Trang chủ - Tổng hợp
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>TX PREDICTOR v6 - ĐẠI CA KHÔI</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Roboto', sans-serif;
            background: #0a0a1a;
            color: #fff;
            min-height: 100vh;
            overflow-x: hidden;
            user-select: none;
        }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        ::-webkit-scrollbar-thumb { background: #7c4dff; border-radius: 10px; }

        .bg-glow {
            position: fixed; top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: 0;
            background: radial-gradient(ellipse at 30% 20%, rgba(124,77,255,0.06), transparent 50%),
                        radial-gradient(ellipse at 70% 80%, rgba(0,245,255,0.04), transparent 50%);
        }

        .container { position: relative; z-index: 1; max-width: 1200px; margin: 0 auto; padding: 16px; min-height: 100vh; }

        .header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px 24px;
            background: rgba(255,255,255,0.03);
            backdrop-filter: blur(20px);
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.04);
            margin-bottom: 16px;
            flex-wrap: wrap;
            gap: 10px;
        }
        .logo { display: flex; align-items: center; gap: 12px; }
        .logo-icon {
            width: 44px; height: 44px;
            background: linear-gradient(135deg, #7c4dff, #b388ff);
            border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; font-weight: 900; color: #fff;
            font-family: 'Orbitron', sans-serif;
            box-shadow: 0 0 40px rgba(124,77,255,0.15);
        }
        .logo-text {
            font-family: 'Orbitron', sans-serif;
            font-size: 20px; font-weight: 700;
            background: linear-gradient(135deg, #b388ff, #7c4dff);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .logo-sub { font-size: 9px; color: rgba(255,255,255,0.3); letter-spacing: 2px; text-transform: uppercase; }
        .header-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .status-badge {
            display: flex; align-items: center; gap: 6px;
            padding: 4px 14px; background: rgba(0,255,136,0.06);
            border-radius: 20px; font-size: 10px; color: rgba(255,255,255,0.5);
            border: 1px solid rgba(0,255,136,0.06);
        }
        .status-dot { width: 7px; height: 7px; border-radius: 50%; background: #00ff88; animation: dotPulse 1.5s ease-in-out infinite; }
        @keyframes dotPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.2; transform: scale(0.6); } }
        .speed-badge {
            background: rgba(124,77,255,0.06); color: #b388ff;
            padding: 2px 12px; border-radius: 20px;
            font-size: 8px; font-weight: 700; font-family: 'Orbitron', sans-serif;
            border: 1px solid rgba(124,77,255,0.06);
        }
        .header-time { font-size: 11px; color: rgba(255,255,255,0.3); font-family: 'Orbitron', sans-serif; }

        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        @media (max-width: 992px) { .grid { grid-template-columns: 1fr; } }

        .card {
            background: rgba(255,255,255,0.02);
            border-radius: 16px; border: 1px solid rgba(255,255,255,0.04);
            padding: 20px; transition: all 0.3s ease;
        }
        .card:hover { border-color: rgba(124,77,255,0.08); box-shadow: 0 0 60px rgba(124,77,255,0.03); }
        .card-title {
            font-family: 'Orbitron', sans-serif;
            font-size: 10px; color: rgba(255,255,255,0.3);
            margin-bottom: 12px; display: flex; align-items: center; gap: 8px;
            letter-spacing: 1px;
        }
        .card-title i { font-size: 13px; color: #b388ff; }
        .card-badge {
            margin-left: auto; background: rgba(124,77,255,0.06);
            color: #b388ff; padding: 2px 12px; border-radius: 20px;
            font-size: 7px; font-weight: 600; text-transform: uppercase;
        }

        .pred-result {
            font-size: 72px; font-weight: 900; font-family: 'Orbitron', sans-serif;
            margin: 0 0 6px; transition: all 0.5s ease; line-height: 1; min-height: 80px;
            letter-spacing: 4px; text-align: center;
        }
        .pred-result.tai { color: #4fc3f7; text-shadow: 0 0 80px rgba(79,195,247,0.15); }
        .pred-result.xiu { color: #ef5350; text-shadow: 0 0 80px rgba(239,83,80,0.15); }
        .pred-result.waiting { color: rgba(255,255,255,0.06); animation: textPulse 1.8s ease-in-out infinite; font-size: 24px; font-family: 'Orbitron', sans-serif; letter-spacing: 6px; }
        @keyframes textPulse { 0%,100% { opacity: 0.2; } 50% { opacity: 0.5; } }

        .pred-meta { display: flex; justify-content: center; gap: 24px; flex-wrap: wrap; margin: 4px 0 6px; }
        .meta-item { display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .meta-item .label { font-size: 8px; color: rgba(255,255,255,0.15); text-transform: uppercase; letter-spacing: 1px; }
        .meta-item .value { font-size: 18px; font-weight: 700; font-family: 'Orbitron', sans-serif; }
        .meta-item .value.confidence { color: #4fc3f7; }
        .meta-item .value.quality { color: #ffd54f; }

        .bar-track { width: 100%; height: 4px; background: rgba(255,255,255,0.03); border-radius: 10px; overflow: hidden; margin-top: 4px; }
        .bar-fill { height: 100%; border-radius: 10px; background: linear-gradient(90deg, #ef5350, #ffd54f, #4fc3f7); transition: width 0.8s ease; width: 0%; }

        .signals { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; margin-top: 8px; min-height: 20px; }
        .signal-tag {
            background: rgba(255,255,255,0.02); padding: 2px 10px; border-radius: 20px;
            font-size: 7px; color: rgba(255,255,255,0.4); border: 1px solid rgba(255,255,255,0.02);
            transition: all 0.3s ease;
        }
        .signal-tag:hover { background: rgba(124,77,255,0.04); border-color: rgba(124,77,255,0.06); color: #b388ff; }
        .signal-tag.highlight { background: rgba(124,77,255,0.05); border-color: rgba(124,77,255,0.08); color: #b388ff; }

        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px; }
        @media (max-width: 600px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
        .stat-card {
            background: rgba(255,255,255,0.01); border-radius: 12px;
            padding: 8px 4px; text-align: center;
            border: 1px solid rgba(255,255,255,0.01);
            transition: all 0.3s ease;
        }
        .stat-card:hover { background: rgba(255,255,255,0.02); border-color: rgba(124,77,255,0.03); }
        .stat-number { font-size: 22px; font-weight: 700; font-family: 'Orbitron', sans-serif; color: #b388ff; }
        .stat-number.good { color: #66bb6a; }
        .stat-number.bad { color: #ef5350; }
        .stat-number.winrate { color: #ffd54f; }
        .stat-label { font-size: 7px; color: rgba(255,255,255,0.15); text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }

        .history-tabs { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
        .tab-btn {
            padding: 4px 16px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.06);
            background: rgba(255,255,255,0.02); color: rgba(255,255,255,0.4);
            font-size: 9px; font-weight: 500; cursor: pointer;
            transition: all 0.3s ease; font-family: 'Orbitron', sans-serif;
            text-transform: uppercase; letter-spacing: 0.5px;
        }
        .tab-btn:hover { border-color: #b388ff; color: #b388ff; }
        .tab-btn.active { background: rgba(124,77,255,0.06); border-color: #b388ff; color: #b388ff; }

        .history-container { max-height: 350px; overflow-y: auto; margin-top: 4px; }
        .history-table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .history-table thead { position: sticky; top: 0; z-index: 2; }
        .history-table th {
            text-align: left; padding: 4px 6px;
            color: rgba(255,255,255,0.12); font-size: 7px; text-transform: uppercase;
            letter-spacing: 1px; border-bottom: 1px solid rgba(255,255,255,0.03);
            background: rgba(10,10,26,0.95); backdrop-filter: blur(10px);
            font-weight: 500;
        }
        .history-table td { padding: 4px 6px; border-bottom: 1px solid rgba(255,255,255,0.01); color: rgba(255,255,255,0.35); font-size: 9px; }
        .history-table tr:hover td { background: rgba(255,255,255,0.01); }
        .history-table .phien { color: #fff; font-family: 'Orbitron', sans-serif; font-size: 8px; }
        .history-table .win { color: #66bb6a; font-weight: 600; }
        .history-table .lose { color: #ef5350; font-weight: 600; }
        .history-table .pending { color: #ffd54f; }

        .scroll-hint { text-align: center; padding: 4px; color: rgba(255,255,255,0.04); font-size: 7px; letter-spacing: 1px; }

        .footer { text-align: center; padding: 14px 20px 6px; color: rgba(255,255,255,0.04); font-size: 8px; border-top: 1px solid rgba(255,255,255,0.02); margin-top: 12px; font-family: 'Orbitron', sans-serif; letter-spacing: 1px; }
        .footer strong { color: #b388ff; }

        @media (max-width: 768px) {
            .container { padding: 8px; }
            .header { padding: 8px 14px; flex-direction: column; align-items: stretch; gap: 4px; }
            .logo-text { font-size: 16px; }
            .logo-icon { width: 36px; height: 36px; font-size: 16px; }
            .header-right { justify-content: space-between; }
            .pred-result { font-size: 44px; min-height: 50px; }
            .pred-meta { gap: 14px; }
            .meta-item .value { font-size: 15px; }
            .card { padding: 14px; }
            .stat-number { font-size: 18px; }
            .history-table { font-size: 8px; }
            .history-table th, .history-table td { padding: 2px 4px; }
        }
        @media (max-width: 480px) {
            .container { padding: 4px; }
            .pred-result { font-size: 32px; min-height: 38px; }
            .stats-grid { gap: 4px; }
            .stat-number { font-size: 14px; }
            .stat-card { padding: 4px 2px; }
            .history-table { font-size: 7px; }
            .history-table th, .history-table td { padding: 1px 3px; }
            .signal-tag { font-size: 6px; padding: 1px 6px; }
        }
    </style>
</head>
<body>

<div class="bg-glow"></div>

<div class="container">

    <header class="header">
        <div class="logo">
            <div class="logo-icon">TX</div>
            <div>
                <div class="logo-text">PREDICTOR v6</div>
                <div class="logo-sub">ĐẠI CA KHÔI <span style="color:#b388ff;">@2026</span></div>
            </div>
        </div>
        <div class="header-right">
            <span class="speed-badge"><i class="fas fa-bolt"></i> 0.1s</span>
            <div class="status-badge">
                <span class="status-dot"></span>
                <span>Live</span>
            </div>
            <span class="header-time" id="clockDisplay">--:--:--</span>
        </div>
    </header>

    <div class="grid">

        <div class="card">
            <div class="card-title">
                <i class="fas fa-dice-d6"></i> TÀI XỈU HŨ
                <span class="card-badge">LIVE</span>
            </div>
            <div class="pred-area">
                <div class="pred-result waiting" id="huResult">---</div>
                <div class="pred-meta">
                    <div class="meta-item">
                        <span class="label">Độ tin cậy</span>
                        <span class="value confidence" id="huConf">0%</span>
                    </div>
                    <div class="meta-item">
                        <span class="label">Chất lượng</span>
                        <span class="value quality" id="huQuality">---</span>
                    </div>
                    <div class="meta-item">
                        <span class="label">Phiên</span>
                        <span class="value" id="huPhien" style="color:rgba(255,255,255,0.3);font-size:14px;">---</span>
                    </div>
                </div>
                <div class="bar-track">
                    <div class="bar-fill" id="huBar"></div>
                </div>
                <div class="signals" id="huSignals">
                    <span class="signal-tag">Đang phân tích...</span>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-title">
                <i class="fas fa-dice-d6"></i> TÀI XỈU MD5
                <span class="card-badge">LIVE</span>
            </div>
            <div class="pred-area">
                <div class="pred-result waiting" id="md5Result">---</div>
                <div class="pred-meta">
                    <div class="meta-item">
                        <span class="label">Độ tin cậy</span>
                        <span class="value confidence" id="md5Conf">0%</span>
                    </div>
                    <div class="meta-item">
                        <span class="label">Chất lượng</span>
                        <span class="value quality" id="md5Quality">---</span>
                    </div>
                    <div class="meta-item">
                        <span class="label">Phiên</span>
                        <span class="value" id="md5Phien" style="color:rgba(255,255,255,0.3);font-size:14px;">---</span>
                    </div>
                </div>
                <div class="bar-track">
                    <div class="bar-fill" id="md5Bar"></div>
                </div>
                <div class="signals" id="md5Signals">
                    <span class="signal-tag">Đang phân tích...</span>
                </div>
            </div>
        </div>

    </div>

    <div class="card" style="margin-bottom:12px;">
        <div class="card-title">
            <i class="fas fa-chart-line"></i> THỐNG KÊ SIÊU VIP
            <span class="card-badge">REAL-TIME</span>
        </div>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number" id="totalPreds">0</div>
                <div class="stat-label">Tổng dự đoán</div>
            </div>
            <div class="stat-card">
                <div class="stat-number good" id="totalCorrect">0</div>
                <div class="stat-label">Đúng</div>
            </div>
            <div class="stat-card">
                <div class="stat-number winrate" id="accuracy">0%</div>
                <div class="stat-label">Độ chính xác</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="patternsCount">0</div>
                <div class="stat-label">Patterns học</div>
            </div>
        </div>
        <div class="stats-grid" style="margin-top:6px;">
            <div class="stat-card">
                <div class="stat-number good" id="bestStreak">0</div>
                <div class="stat-label">Streak tốt nhất</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="bestAcc">0%</div>
                <div class="stat-label">Acc tốt nhất</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="qualityText">---</div>
                <div class="stat-label">Chất lượng hiện tại</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="sessionCount">0</div>
                <div class="stat-label">Phiên đã học</div>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="card-title">
            <i class="fas fa-history"></i> LỊCH SỬ THẮNG THUA
            <span class="card-badge">1000 phiên</span>
        </div>
        <div class="history-tabs">
            <button class="tab-btn active" data-tab="all">📊 Tất cả</button>
            <button class="tab-btn" data-tab="hu">🎲 HŨ</button>
            <button class="tab-btn" data-tab="md5">🎲 MD5</button>
        </div>
        <div class="history-container">
            <table class="history-table">
                <thead>
                    <tr>
                        <th>Phiên</th>
                        <th>Loại</th>
                        <th>Dự đoán</th>
                        <th>Kết quả</th>
                        <th>Độ tin cậy</th>
                        <th>Trạng thái</th>
                    </tr>
                </thead>
                <tbody id="historyBody">
                    <tr>
                        <td colspan="6" style="text-align:center;padding:15px;color:rgba(255,255,255,0.06);font-size:9px;">
                            <i class="fas fa-spinner fa-spin"></i> Đang tải...
                        </td>
                    </tr>
                </tbody>
            </table>
            <div class="scroll-hint">↓ Cuộn để xem thêm</div>
        </div>
    </div>

    <div class="footer">
        <p>🚀 <strong>TX PREDICTOR v6</strong> © 2026 · ĐẠI CA KHÔI</p>
        <p style="font-size:6px;color:rgba(255,255,255,0.03);margin-top:2px;">30+ Cầu + 18+ Trend + Dice + Ensemble</p>
    </div>

</div>

<script>
// Anti-zoom
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('touchstart', e => { if (e.touches.length > 1) e.preventDefault(); });
let lastTouchEnd = 0;
document.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
}, false);
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key)) || (e.ctrlKey && e.key === 'U')) {
        e.preventDefault();
        return false;
    }
});

// Clock
function updateClock() {
    document.getElementById('clockDisplay').textContent = new Date().toLocaleTimeString('vi-VN', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

// API
async function fetchAPI(endpoint) {
    try {
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error('Network error');
        return await res.json();
    } catch (e) {
        console.error('API Error:', e);
        return null;
    }
}

let currentTab = 'all';
let historyCache = {};

async function fetchPrediction(type) {
    const data = await fetchAPI('/api/' + type);
    if (data) {
        updatePrediction(type, data);
        updateStats(data.thongKe);
    }
}

async function fetchStats() {
    const data = await fetchAPI('/api/stats');
    if (data) updateStats(data);
}

async function fetchHistory(type) {
    const data = await fetchAPI('/api/history/' + type);
    if (data) {
        historyCache[type] = data.history || [];
        renderHistory(type);
    }
}

function updatePrediction(type, data) {
    const prefix = type.toLowerCase();
    const resultEl = document.getElementById(prefix + 'Result');
    const confEl = document.getElementById(prefix + 'Conf');
    const qualityEl = document.getElementById(prefix + 'Quality');
    const phienEl = document.getElementById(prefix + 'Phien');
    const barEl = document.getElementById(prefix + 'Bar');
    const signalsEl = document.getElementById(prefix + 'Signals');

    if (!resultEl) return;

    resultEl.textContent = data.duDoan || '---';
    resultEl.className = 'pred-result';
    if (data.duDoan === 'TAI') resultEl.classList.add('tai');
    else if (data.duDoan === 'XIU') resultEl.classList.add('xiu');
    else resultEl.classList.add('waiting');

    confEl.textContent = data.doTinCay || '0%';
    qualityEl.textContent = data.chatLuong || '---';
    phienEl.textContent = '#' + data.phien || '---';

    const conf = parseInt(data.doTinCay) || 0;
    barEl.style.width = Math.min(100, conf) + '%';

    if (data.tinHieu && data.tinHieu.length > 0) {
        signalsEl.innerHTML = data.tinHieu.slice(0, 6).map((s, i) => 
            `<span class="signal-tag${i === 0 ? ' highlight' : ''}">${s.ten}: ${s.duDoan} (${s.doTinCay})</span>`
        ).join('');
    } else {
        signalsEl.innerHTML = '<span class="signal-tag">Đang phân tích...</span>';
    }
}

function updateStats(data) {
    if (!data) return;
    document.getElementById('totalPreds').textContent = data.tongDuDoan || 0;
    document.getElementById('totalCorrect').textContent = data.tongDung || 0;
    document.getElementById('accuracy').textContent = data.doChinhXac || '0%';
    document.getElementById('patternsCount').textContent = data.patterns || 0;
    document.getElementById('bestStreak').textContent = data.streakTotNhat || 0;
    document.getElementById('bestAcc').textContent = data.totNhat || '0%';
    document.getElementById('qualityText').textContent = data.chatLuong || '---';
    document.getElementById('sessionCount').textContent = data.phien || 0;
}

function renderHistory(type) {
    const tbody = document.getElementById('historyBody');
    let history = [];
    
    if (type === 'all') {
        const hu = historyCache['all'] || [];
        const md5 = historyCache['all'] || [];
        history = [...hu, ...md5];
        history.sort((a, b) => b.phien - a.phien);
    } else {
        history = historyCache[type] || [];
    }

    if (!history || history.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:15px;color:rgba(255,255,255,0.06);">Chưa có dữ liệu</td></tr>`;
        return;
    }

    const rows = history.slice(0, 50).map(r => {
        const statusClass = r.trangThai === 'WIN' ? 'win' : (r.trangThai === 'LOSE' ? 'lose' : 'pending');
        const statusText = r.trangThai === 'WIN' ? '✅ THẮNG' : (r.trangThai === 'LOSE' ? '❌ THUA' : '⏳ CHỜ');
        return `<tr>
            <td class="phien">#${r.phien}</td>
            <td>${r.loai || 'HU'}</td>
            <td class="${r.duDoan === 'TAI' ? 'tai' : 'xiu'}">${r.duDoan || '---'}</td>
            <td class="${r.ketQua === 'TAI' ? 'tai' : 'xiu'}">${r.ketQua || '---'}</td>
            <td>${r.do_tin_cay || '0%'}</td>
            <td class="${statusClass}">${statusText}</td>
        </tr>`;
    }).join('');
    tbody.innerHTML = rows || `<tr><td colspan="6" style="text-align:center;padding:15px;color:rgba(255,255,255,0.06);">Chưa có dữ liệu</td></tr>`;
}

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentTab = this.dataset.tab;
        fetchHistory(currentTab);
    });
});

// Refresh
let isRefreshing = false;

async function refreshAll() {
    if (isRefreshing) return;
    isRefreshing = true;

    try {
        await Promise.all([
            fetchPrediction('hu'),
            fetchPrediction('md5'),
            fetchStats(),
            fetchHistory(currentTab)
        ]);
    } catch (e) {
        console.error('Refresh error:', e);
    }

    isRefreshing = false;
}

// Init
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 TX PREDICTOR v6 - ĐẠI CA KHÔI');
    console.log('🧠 30+ Cầu + 18+ Trend + Dice + Ensemble');

    refreshAll();
    setInterval(refreshAll, 5000);

    setTimeout(function() {
        document.querySelector('.status-badge').innerHTML = '<span class="status-dot"></span><span>Ready</span>';
    }, 1000);
});
</script>
</body>
</html>
    `);
});

// API Dự đoán HU - Giao diện riêng
app.get('/api/hu', async (req, res) => {
    try {
        const data = await fetchHu();
        if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu HU' });
        const result = calculatePrediction(data, 'hu');
        res.json({
            phien: data[0]?.Phien + 1 || 0,
            duDoan: result.prediction,
            doTinCay: result.confidence.toFixed(0) + '%',
            chatLuong: result.quality,
            tinHieu: result.signals.slice(0, 10).map(s => ({
                ten: s.name,
                duDoan: s.pred,
                doTinCay: s.conf.toFixed(0) + '%',
                lyDo: s.reason || ''
            })),
            thongKe: result.stats
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API Dự đoán MD5 - Giao diện riêng
app.get('/api/md5', async (req, res) => {
    try {
        const data = await fetchMd5();
        if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu MD5' });
        const result = calculatePrediction(data, 'md5');
        res.json({
            phien: data[0]?.Phien + 1 || 0,
            duDoan: result.prediction,
            doTinCay: result.confidence.toFixed(0) + '%',
            chatLuong: result.quality,
            tinHieu: result.signals.slice(0, 10).map(s => ({
                ten: s.name,
                duDoan: s.pred,
                doTinCay: s.conf.toFixed(0) + '%',
                lyDo: s.reason || ''
            })),
            thongKe: result.stats
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Lịch sử
app.get('/api/history/:type', (req, res) => {
    const type = req.params.type;
    if (type === 'all') {
        const all = [...historyData.hu, ...historyData.md5];
        all.sort((a, b) => b.phien - a.phien);
        res.json({ history: all, total: all.length });
    } else {
        res.json({ history: historyData[type] || [], total: (historyData[type] || []).length });
    }
});

// Thống kê
app.get('/api/stats', (req, res) => {
    const stats = predictor.stats();
    res.json(stats);
});

// Reset
app.get('/api/reset', (req, res) => {
    historyData = { hu: [], md5: [] };
    saveHistory();
    res.json({ message: 'Reset thành công' });
});

// ============================================================
// KHỞI ĐỘNG SERVER
// ============================================================
loadHistory();
app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('🚀 TX PREDICTOR v6 - ĐẠI CA KHÔI');
    console.log('🧠 30+ CẦU + 18+ TREND + DICE + ENSEMBLE');
    console.log('Server: http://0.0.0.0:' + PORT);
    console.log('========================================');
});
