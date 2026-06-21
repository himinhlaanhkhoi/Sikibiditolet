/**
 * ════════════════════════════════════════════════════════════════════
 * ║  🚀 TX PREDICTOR v6 - ĐẠI CA KHÔI @2026                      ║
 * ║  🧠 30+ CẦU + 18+ TREND + DICE + ENSEMBLE                   ║
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
        if (!this.patterns[key]) this.patterns[key] = { T: 0, X: 0, w: 1.0, n: 0 };
        return this.patterns[key];
    }
    _getMethod(key) {
        if (!this.methods[key]) this.methods[key] = { w: 0, l: 0, wt: 1.0, r: [] };
        return this.methods[key];
    }
    _getCau(key) {
        if (!this.cau[key]) this.cau[key] = { w: 0, l: 0, wt: 1.0, r: [] };
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
        if (!this.valuePatterns[key]) this.valuePatterns[key] = { s: 0, n: 0 };
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

    update(d1, d2, d3) {
        this.diceHistory.push([d1, d2, d3]);
        const total = d1 + d2 + d3;
        this.session++;

        for (let vi = 0; vi < 3; vi++) {
            const dv = [d1, d2, d3][vi];
            for (const L of [2, 3, 4, 5]) {
                if (this.diceHistory.length >= L + 1) {
                    const recent = [];
                    for (let j = this.diceHistory.length - L - 1; j < this.diceHistory.length - 1; j++) {
                        recent.push(this.diceHistory[j][vi]);
                    }
                    const key = recent.join(',');
                    const pat = this._getDicePattern(vi + 1, key);
                    pat[dv] = (pat[dv] || 0) + 1;
                }
            }
        }

        for (const L of [2, 3, 5, 8, 13]) {
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
            for (let d = 2; d <= 4; d++) {
                const step = Math.pow(2, d - 1);
                const indices = [];
                for (let j = this.diceHistory.length - 1; j >= Math.max(-1, this.diceHistory.length - Math.pow(2, d) - 1); j -= step) {
                    indices.push(j);
                }
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
            if (this.attractor.length > 300) this.attractor.shift();
        }

        for (const step of [1, 2, 3]) {
            for (const L of [3, 5, 8]) {
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
                const r = (d.r || []).slice(-30);
                if (r.length > 0) {
                    const ra = r.reduce((a, b) => a + b, 0) / r.length;
                    const oa = (d.w || 0) / t;
                    d.wt = Math.max(0.01, Math.min(5.0, (ra * 0.6 + oa * 0.4) * (1 + Math.min(t / 50, 0.3))));
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
        for (const [k, v] of Object.entries(this.methods)) data.m[k] = { w: v.w, l: v.l, wt: v.wt };
        for (const [k, v] of Object.entries(this.cau)) data.c[k] = { w: v.w, l: v.l, wt: v.wt };
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filepath, JSON.stringify(data));
    }

    load(filepath) {
        if (!fs.existsSync(filepath)) return false;
        try {
            const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
            this.session = data.ses || 0;
            this.correct = data.corr || 0;
            this.total = data.tot || 0;
            this.bestAcc = data.bestAcc || 0;
            this.bestStreak = data.bestStreak || 0;
            this.errorStreak = data.errorStreak || 0;
            for (const [k, v] of Object.entries(data.m || {})) {
                this._getMethod(k);
                Object.assign(this.methods[k], v);
            }
            for (const [k, v] of Object.entries(data.c || {})) {
                this._getCau(k);
                Object.assign(this.cau[k], v);
            }
            return true;
        } catch (e) {
            return false;
        }
    }
}

class TXDetector {
    constructor(L, V, M) { this.L = L; this.V = V; this.M = M; }

    _streak() {
        if (!this.L.length) return [0, null];
        const last = this.L[this.L.length - 1];
        let s = 1;
        for (let i = this.L.length - 2; i >= 0; i--) {
            if (this.L[i] === last) s++;
            else break;
        }
        return [s, last];
    }

    bet() {
        const [s, l] = this._streak();
        if (s >= 7) return { pred: l === 'T' ? 'X' : 'T', conf: 92, strength: s, reason: 'Bệt Rồng' };
        if (s >= 5) return { pred: l === 'T' ? 'X' : 'T', conf: 82, strength: s, reason: 'Bệt Dài' };
        if (s >= 3) return { pred: l, conf: 72, strength: s, reason: 'Đu Bệt' };
        if (s >= 2) return { pred: l, conf: 60, strength: s, reason: 'Bệt Nhẹ' };
        return null;
    }

    noi_1_1() {
        if (this.L.length < 6) return null;
        const s = this.L.slice(-6);
        let ok = true;
        for (let i = 0; i < s.length - 1; i++) {
            if (s[i] === s[i + 1]) ok = false;
        }
        if (ok) return { pred: s[5] === 'T' ? 'X' : 'T', conf: 82, strength: 6, reason: '1-1' };
        return null;
    }

    doi_2_1() {
        if (this.L.length < 6) return null;
        const s = this.L.slice(-6);
        const c1 = s.slice(0, 3).join('');
        const c2 = s.slice(3, 6).join('');
        if ((c1 === 'TTX' || c1 === 'XXT') && c1 === c2) {
            return { pred: c1 === 'TTX' ? 'T' : 'X', conf: 87, strength: 6, reason: '2-1' };
        }
        return null;
    }

    doi_3_1() {
        if (this.L.length < 8) return null;
        const s = this.L.slice(-8);
        const c1 = s.slice(0, 4).join('');
        const c2 = s.slice(4, 8).join('');
        if ((c1 === 'TTTX' || c1 === 'XXXT') && c1 === c2) {
            return { pred: c1 === 'TTTX' ? 'T' : 'X', conf: 87, strength: 8, reason: '3-1' };
        }
        return null;
    }

    doi_2_2() {
        if (this.L.length < 4) return null;
        const s = this.L.slice(-4);
        if (s[0] === s[1] && s[2] === s[3] && s[0] !== s[2]) {
            return { pred: s[2], conf: 78, strength: 4, reason: '2-2' };
        }
        return null;
    }

    doi_3_3() {
        if (this.L.length < 6) return null;
        const s = this.L.slice(-6);
        if (s[0] === s[1] && s[1] === s[2] && s[3] === s[4] && s[4] === s[5] && s[0] !== s[3]) {
            return { pred: s[3], conf: 80, strength: 6, reason: '3-3' };
        }
        return null;
    }

    mau_lap() {
        if (this.L.length < 6) return null;
        const arr = this.L.slice(-12);
        for (let Ln = 2; Ln <= 4; Ln++) {
            const pat = arr.slice(0, Ln);
            for (let i = Ln; i < arr.length - Ln + 1; i++) {
                const sub = arr.slice(i, i + Ln);
                if (JSON.stringify(sub) === JSON.stringify(pat) && i > 0) {
                    return { pred: arr[i - 1], conf: 86, strength: Ln, reason: 'Lặp' };
                }
            }
        }
        return null;
    }

    vi_cuc_tri() {
        if (this.V.length < 5) return null;
        const pts = this.V.slice(-5);
        const last = pts[pts.length - 1];
        const avg = pts.reduce((a, b) => a + b, 0) / pts.length;
        if (last >= 16) return { pred: 'X', conf: 76, strength: 1, reason: 'Cực Đại' };
        if (last <= 4) return { pred: 'T', conf: 76, strength: 1, reason: 'Cực Tiểu' };
        return null;
    }

    cycle() {
        if (this.L.length < 10) return null;
        for (const p of [5, 6, 7, 8, 10, 12]) {
            if (this.L.length >= 2 * p) {
                const a = this.L.slice(-2 * p, -p);
                const b = this.L.slice(-p);
                if (JSON.stringify(a) === JSON.stringify(b)) {
                    return { pred: b[b.length - 1] === 'T' ? 'X' : 'T', conf: 83, strength: p, reason: 'Chu Kỳ' };
                }
            }
        }
        return null;
    }

    nhay() {
        if (this.L.length < 8) return null;
        const s = this.L.slice(-8);
        let ch = 0;
        for (let i = 1; i < s.length; i++) {
            if (s[i] !== s[i - 1]) ch++;
        }
        if (ch >= 6) return { pred: s[7] === 'T' ? 'X' : 'T', conf: 77, strength: ch, reason: 'Nhảy' };
        return null;
    }

    tam_giac() {
        if (this.L.length < 7) return null;
        const v = this.L.slice(-7).map(x => x === 'T' ? 1 : 0);
        let peak = 0;
        for (let i = 1; i < v.length; i++) {
            if (v[i] > v[peak]) peak = i;
        }
        if (peak > 0 && peak < v.length - 1) {
            const lf = v.slice(0, peak);
            const rt = v.slice(peak + 1);
            let lfOk = true, rtOk = true;
            for (let i = 0; i < lf.length - 1; i++) {
                if (lf[i] > lf[i + 1]) lfOk = false;
            }
            for (let i = 0; i < rt.length - 1; i++) {
                if (rt[i] < rt[i + 1]) rtOk = false;
            }
            if (lfOk && rtOk) {
                return { pred: this.L[this.L.length - 1] === 'T' ? 'X' : 'T', conf: 72, strength: peak, reason: 'Tam Giác' };
            }
        }
        return null;
    }

    balance() {
        if (this.L.length < 6) return null;
        const s = this.L.slice(-6);
        const c = s.filter(x => x === 'T').length;
        if (c === 3) return { pred: s[5] === 'T' ? 'X' : 'T', conf: 67, strength: 3, reason: 'Cân Bằng' };
        return null;
    }

    reversal() {
        if (this.L.length < 10) return null;
        const last = this.L[this.L.length - 1];
        const opp = last === 'T' ? 'X' : 'T';
        const recent5 = this.L.slice(-5);
        if (recent5.filter(x => x === opp).length >= 3) {
            return { pred: opp, conf: 68, strength: 3, reason: 'Hồi Phục' };
        }
        return null;
    }

    entropy() {
        if (this.L.length < 15) return null;
        const s = this.L.slice(-20);
        const p = s.filter(x => x === 'T').length / 20;
        let ent = 0;
        if (p > 0 && p < 1) ent = -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
        if (ent < 0.3) return { pred: p > 0.5 ? 'T' : 'X', conf: 74, strength: 1, reason: 'Entropy Thấp' };
        if (ent > 0.9) return { pred: s[19] === 'T' ? 'X' : 'T', conf: 68, strength: 1, reason: 'Entropy Cao' };
        return null;
    }

    detectAll() {
        const detectors = [
            ['mau_lap', () => this.mau_lap()],
            ['noi_1_1', () => this.noi_1_1()],
            ['doi_2_2', () => this.doi_2_2()],
            ['doi_3_3', () => this.doi_3_3()],
            ['doi_2_1', () => this.doi_2_1()],
            ['doi_3_1', () => this.doi_3_1()],
            ['bet', () => this.bet()],
            ['vi', () => this.vi_cuc_tri()],
            ['cycle', () => this.cycle()],
            ['nhay', () => this.nhay()],
            ['tam_giac', () => this.tam_giac()],
            ['balance', () => this.balance()],
            ['reversal', () => this.reversal()],
            ['entropy', () => this.entropy()],
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

    short() {
        if (this.V.length < 5) return null;
        const avg = this.V.slice(-5).reduce((a, b) => a + b, 0) / 5;
        if (avg > 12) return { pred: 'X', conf: 70, reason: 'Short OB' };
        if (avg < 8) return { pred: 'T', conf: 70, reason: 'Short OS' };
        return null;
    }

    med() {
        if (this.V.length < 10) return null;
        const r = this.V.slice(-10);
        let sx = 0, sy = 0, sxy = 0, sx2 = 0;
        for (let i = 0; i < 10; i++) {
            sx += i;
            sy += r[i];
            sxy += i * r[i];
            sx2 += i * i;
        }
        const slope = (10 * sxy - sx * sy) / (10 * sx2 - sx * sx);
        if (Math.abs(slope) > 0.5) return { pred: slope > 0 ? 'T' : 'X', conf: 65, reason: 'Medium' };
        return null;
    }

    rev() {
        if (this.V.length < 15) return null;
        const r = this.V.slice(-15);
        const avg = r.reduce((a, b) => a + b, 0) / r.length;
        const last = r[r.length - 1];
        if (last > avg + 3) return { pred: 'X', conf: 75, reason: 'Rev' };
        if (last < avg - 3) return { pred: 'T', conf: 75, reason: 'Rev' };
        return null;
    }

    bal() {
        if (this.L.length < 15) return null;
        const ratio = this.L.slice(-15).filter(x => x === 'T').length / 15;
        if (ratio > 0.7) return { pred: 'X', conf: 70, reason: 'Bal' };
        if (ratio < 0.3) return { pred: 'T', conf: 70, reason: 'Bal' };
        return null;
    }

    pmem() {
        if (this.L.length < 5) return null;
        for (const Ln of [3, 5, 8]) {
            if (this.L.length >= Ln) {
                const pat = this.L.slice(-Ln).join(',');
                const p = this.M._getPattern(pat);
                const t = (p.T || 0) + (p.X || 0);
                if (t >= 2) {
                    const pred = (p.T || 0) > (p.X || 0) ? 'T' : 'X';
                    const conf = Math.max(p.T || 0, p.X || 0) / t * 100;
                    return { pred: pred, conf: Math.min(conf * 0.9, 85), reason: 'Pattern' };
                }
            }
        }
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
        const ag = gains / 14;
        const al = losses / 14 || 0.001;
        const rs = ag / al;
        const rsiVal = 100 - (100 / (1 + rs));
        if (rsiVal > 75) return { pred: 'X', conf: 72, reason: 'RSI OB' };
        if (rsiVal < 25) return { pred: 'T', conf: 72, reason: 'RSI OS' };
        return null;
    }

    analyzeAll() {
        const methods = [
            ['short', () => this.short()],
            ['med', () => this.med()],
            ['rev', () => this.rev()],
            ['bal', () => this.bal()],
            ['pmem', () => this.pmem()],
            ['rsi', () => this.rsi()],
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
        for (const L of [3, 5, 8, 13]) {
            if (this.dice.length >= L + 1) {
                const recent = [];
                for (let j = this.dice.length - L - 1; j < this.dice.length - 1; j++) {
                    recent.push(this.dice[j][0] + this.dice[j][1] + this.dice[j][2]);
                }
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
            for (const p of preds) {
                ws += p.val * p.conf * p.L;
                wt += p.conf * p.L;
            }
            return [wt > 0 ? ws / wt : null, 72];
        }
        return [null, 0];
    }

    indiv() {
        const res = {};
        for (let vi = 0; vi < 3; vi++) {
            for (const L of [3, 4, 5]) {
                if (this.dice.length >= L + 1) {
                    const recent = [];
                    for (let j = this.dice.length - L - 1; j < this.dice.length - 1; j++) {
                        recent.push(this.dice[j][vi]);
                    }
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

    multi() {
        const preds = {};
        for (const step of [1, 2, 3]) {
            for (const L of [5, 8]) {
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
        for (let d = 2; d <= 4; d++) {
            const step = Math.pow(2, d - 1);
            const indices = [];
            for (let j = this.dice.length - 1; j >= Math.max(-1, this.dice.length - Math.pow(2, d) - 1); j -= step) {
                indices.push(j);
            }
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
            for (const p of preds) {
                ws += p.val * p.conf * p.d;
                wt += p.conf * p.d;
            }
            return [wt > 0 ? ws / wt : null, 67];
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
        if (this.M.errorStreak >= 2) ratio = 1 - ratio;
        if (Math.abs(ratio - 0.5) < 0.05) return { pred: null, conf: 50, signals };
        const pred = ratio > 0.5 ? 'TAI' : 'XIU';
        const conf = Math.min(Math.abs(ratio - 0.5) * 200, 99);
        return { pred, conf, signals };
    }
}

class TXPredictor {
    constructor() {
        this.history = [];
        this.labels = [];
        this.values = [];
        this.diceHistory = [];
        this.memory = new TXMemory();
        this.ensemble = new TXEnsemble(this.memory);
        this.accHistory = [];
        this._lastPred = null;
        this._lastSignals = [];
        this.totalPredsMade = 0;
        this.memory.load(CONFIG.SAVE_PATH);
    }

    add(d1, d2, d3) {
        const t = d1 + d2 + d3;
        const r = t > 10 ? 'T' : 'X';
        this.history.push(t);
        this.labels.push(r);
        this.values.push(t);
        this.diceHistory.push([d1, d2, d3]);
        this.memory.update(d1, d2, d3);
        this._learn();
        this._evaluate(r);
    }

    _evaluate(r) {
        if (!this._lastPred) return;
        const actual = r === 'T' ? 'TAI' : 'XIU';
        const correct = this._lastPred === actual;
        this.accHistory.push(correct ? 1 : 0);
        this.memory.total++;
        if (correct) {
            this.memory.correct++;
            this.memory.streak++;
            this.memory.errorStreak = 0;
        } else {
            this.memory.streak = 0;
            this.memory.errorStreak++;
        }
        this.memory.bestStreak = Math.max(this.memory.bestStreak, this.memory.streak);
        this.memory.bestAcc = Math.max(this.memory.bestAcc, this.memory.getAcc());
        for (const s of this._lastSignals) {
            const ic = s.pred === actual;
            if (s.name.startsWith('c_')) {
                const cn = s.name.replace('c_', '');
                const c = this.memory._getCau(cn);
                c.r = c.r || [];
                c.r.push(ic ? 1 : 0);
                if (ic) c.w = (c.w || 0) + 1;
                else c.l = (c.l || 0) + 1;
            } else if (s.name.startsWith('t_')) {
                const mn = s.name.replace('t_', '');
                const m = this.memory._getMethod(mn);
                m.r = m.r || [];
                m.r.push(ic ? 1 : 0);
                if (ic) m.w = (m.w || 0) + 1;
                else m.l = (m.l || 0) + 1;
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
        for (const L of [3, 5, 8]) {
            if (this.values.length >= L + 1) {
                const k = this.values.slice(-L - 1, -1).join(',');
                const vp = this.memory._getValuePattern(k);
                vp.s += this.values[this.values.length - 1];
                vp.n += 1;
            }
        }
    }

    predict() {
        if (this.history.length < 3) return this._fallback();
        this.totalPredsMade++;

        const detector = new TXDetector(this.labels, this.values, this.memory);
        const trend = new TXTrend(this.labels, this.values, this.memory);
        const dice = this.diceHistory.length > 0 ? new TXDice(this.memory, this.diceHistory) : null;

        let signals = [];
        signals = signals.concat(detector.detectAll().filter(s => s.conf >= CONFIG.MIN_CONF));
        signals = signals.concat(trend.analyzeAll().filter(s => s.conf >= CONFIG.MIN_CONF));

        if (dice) {
            const [tv, tc] = dice.total();
            if (tv !== null && tc >= 50) {
                signals.push({ name: 'dice_tot', pred: tv > 10 ? 'TAI' : 'XIU', conf: tc, strength: 3, reason: 'Dice Total' });
            }
            const indiv = dice.indiv();
            for (const [n, [v, c]] of Object.entries(indiv)) {
                if (c >= 55) {
                    signals.push({ name: `dice_${n}`, pred: v > 3 ? 'TAI' : 'XIU', conf: c, strength: 1, reason: 'Dice' });
                }
            }
            const multi = dice.multi();
            for (const [n, [p, c]] of Object.entries(multi)) {
                if (c >= 50) {
                    signals.push({ name: `ms_${n}`, pred: p === 'T' ? 'TAI' : 'XIU', conf: c, strength: 2, reason: 'Multi' });
                }
            }
            const [fv, fc] = dice.fractal();
            if (fv !== null && fc >= 50) {
                signals.push({ name: 'dice_frac', pred: fv > 10 ? 'TAI' : 'XIU', conf: fc, strength: 2, reason: 'Fractal' });
            }
        }

        const result = this.ensemble.predict(signals);
        if (result.pred === null) return this._fallback();
        this._lastPred = result.pred;
        this._lastSignals = result.signals;
        return result;
    }

    _fallback() {
        let p;
        if (this.history.length < 3) {
            p = !this.history.length || this.history[this.history.length - 1] > 10 ? 'TAI' : 'XIU';
        } else {
            const l5 = this.labels.slice(-5);
            p = l5.filter(x => x === 'T').length >= 3 ? 'TAI' : 'XIU';
        }
        this._lastPred = p;
        this._lastSignals = [{ name: 'fb', pred: p, conf: 50, strength: 1, reason: 'Fallback' }];
        return { pred: p, conf: 50, signals: this._lastSignals };
    }

    quality() {
        if (!this._lastSignals.length || this._lastSignals[0].name === 'fb') return 'KHÔNG TÍN HIỆU';
        const n = this._lastSignals.length;
        const avg = this._lastSignals.reduce((a, s) => a + s.conf, 0) / n;
        if (n >= 10 && avg >= 80) return 'GOD TIER';
        if (n >= 8 && avg >= 70) return 'RẤT MẠNH';
        if (n >= 5 && avg >= 62) return 'MẠNH';
        if (n >= 3 && avg >= 55) return 'KHÁ';
        return 'YẾU';
    }

    stats() {
        const acc = this.accHistory.length === 0 ? 50 : this.accHistory.reduce((a, b) => a + b, 0) / this.accHistory.length * 100;
        return {
            phien: this.memory.session,
            doChinhXac: acc.toFixed(1) + '%',
            totNhat: this.memory.bestAcc.toFixed(1) + '%',
            streakTotNhat: this.memory.bestStreak,
            errorStreak: this.memory.errorStreak,
            patterns: Object.keys(this.memory.patterns).length,
            tongDuDoan: this.memory.total,
            tongDung: this.memory.correct,
            tongDuDoanDaLam: this.totalPredsMade,
            chatLuong: this.quality()
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
// HÀM RENDER GIAO DIỆN DỰ ĐOÁN
// ============================================================
function renderPredictionPage(title, icon, type, color) {
    return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Dự đoán ${title} - TX PREDICTOR</title>
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
        ::-webkit-scrollbar-thumb { background: ${color}; border-radius: 10px; }

        .bg-glow {
            position: fixed; top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: 0;
            background: radial-gradient(ellipse at 30% 20%, rgba(124,77,255,0.06), transparent 50%),
                        radial-gradient(ellipse at 70% 80%, rgba(0,245,255,0.04), transparent 50%);
        }

        .container { position: relative; z-index: 1; max-width: 800px; margin: 0 auto; padding: 16px; min-height: 100vh; }

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
            background: linear-gradient(135deg, ${color}, ${color}cc);
            border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; font-weight: 900; color: #fff;
            font-family: 'Orbitron', sans-serif;
            box-shadow: 0 0 40px rgba(124,77,255,0.15);
        }
        .logo-text {
            font-family: 'Orbitron', sans-serif;
            font-size: 20px; font-weight: 700;
            background: linear-gradient(135deg, ${color}, #7c4dff);
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
        .header-time { font-size: 11px; color: rgba(255,255,255,0.3); font-family: 'Orbitron', sans-serif; }

        .nav-links { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 16px; }
        .nav-link {
            padding: 4px 16px; border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.06);
            color: rgba(255,255,255,0.4); font-size: 8px;
            text-decoration: none; font-family: 'Orbitron', sans-serif;
            transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .nav-link:hover { border-color: ${color}; color: ${color}; background: rgba(124,77,255,0.05); }
        .nav-link.active { border-color: ${color}; color: ${color}; background: rgba(124,77,255,0.05); }

        .card {
            background: rgba(255,255,255,0.02);
            border-radius: 16px; border: 1px solid rgba(255,255,255,0.04);
            padding: 24px; transition: all 0.3s ease;
            margin-bottom: 16px;
        }
        .card:hover { border-color: rgba(124,77,255,0.08); box-shadow: 0 0 60px rgba(124,77,255,0.03); }

        .pred-result {
            font-size: 80px; font-weight: 900; font-family: 'Orbitron', sans-serif;
            margin: 0 0 8px; transition: all 0.5s ease; line-height: 1; min-height: 90px;
            letter-spacing: 6px; text-align: center;
        }
        .pred-result.tai { color: #4fc3f7; text-shadow: 0 0 100px rgba(79,195,247,0.2); }
        .pred-result.xiu { color: #ef5350; text-shadow: 0 0 100px rgba(239,83,80,0.2); }
        .pred-result.waiting { color: rgba(255,255,255,0.06); animation: textPulse 1.8s ease-in-out infinite; font-size: 28px; letter-spacing: 8px; }
        @keyframes textPulse { 0%,100% { opacity: 0.2; } 50% { opacity: 0.5; } }

        .pred-meta { display: flex; justify-content: center; gap: 30px; flex-wrap: wrap; margin: 6px 0 8px; }
        .meta-item { display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .meta-item .label { font-size: 8px; color: rgba(255,255,255,0.15); text-transform: uppercase; letter-spacing: 1.5px; }
        .meta-item .value { font-size: 20px; font-weight: 700; font-family: 'Orbitron', sans-serif; }
        .meta-item .value.confidence { color: ${color}; }

        .bar-track { width: 100%; height: 5px; background: rgba(255,255,255,0.03); border-radius: 10px; overflow: hidden; margin-top: 6px; }
        .bar-fill { height: 100%; border-radius: 10px; background: linear-gradient(90deg, #ef5350, #ffd54f, ${color}); transition: width 0.8s ease; width: 0%; }

        .signals { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; margin-top: 10px; min-height: 22px; }
        .signal-tag {
            background: rgba(255,255,255,0.02); padding: 2px 12px; border-radius: 20px;
            font-size: 7px; color: rgba(255,255,255,0.4); border: 1px solid rgba(255,255,255,0.02);
            transition: all 0.3s ease;
        }
        .signal-tag:hover { background: rgba(124,77,255,0.04); border-color: rgba(124,77,255,0.06); color: ${color}; }
        .signal-tag.highlight { background: rgba(124,77,255,0.05); border-color: rgba(124,77,255,0.08); color: ${color}; }

        .btn-history {
            display: inline-block; padding: 8px 24px; border-radius: 20px;
            border: 1px solid ${color}44; background: rgba(124,77,255,0.05);
            color: ${color}; font-size: 10px; font-weight: 500; cursor: pointer;
            transition: all 0.3s ease; text-decoration: none;
            font-family: 'Orbitron', sans-serif; letter-spacing: 0.5px;
        }
        .btn-history:hover { background: rgba(124,77,255,0.1); border-color: ${color}; }

        .footer { text-align: center; padding: 14px 20px 6px; color: rgba(255,255,255,0.04); font-size: 8px; border-top: 1px solid rgba(255,255,255,0.02); margin-top: 12px; font-family: 'Orbitron', sans-serif; letter-spacing: 1px; }
        .footer strong { color: ${color}; }

        @media (max-width: 768px) {
            .container { padding: 8px; }
            .header { padding: 8px 14px; flex-direction: column; align-items: stretch; gap: 4px; }
            .logo-text { font-size: 16px; }
            .logo-icon { width: 36px; height: 36px; font-size: 16px; }
            .header-right { justify-content: space-between; }
            .pred-result { font-size: 48px; min-height: 54px; }
            .pred-meta { gap: 16px; }
            .meta-item .value { font-size: 16px; }
            .card { padding: 14px; }
        }
        @media (max-width: 480px) {
            .container { padding: 4px; }
            .pred-result { font-size: 36px; min-height: 42px; }
            .signal-tag { font-size: 6px; padding: 1px 8px; }
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
                <div class="logo-sub">ĐẠI CA KHÔI <span style="color:${color};">@2026</span></div>
            </div>
        </div>
        <div class="header-right">
            <span class="status-badge">
                <span class="status-dot"></span>
                <span>Live</span>
            </span>
            <span class="header-time" id="clockDisplay">--:--:--</span>
        </div>
    </header>

    <div class="nav-links">
        <a href="/" class="nav-link">🏠 Trang chủ</a>
        <a href="/hu" class="nav-link ${type === 'hu' ? 'active' : ''}">🎲 HŨ</a>
        <a href="/md5" class="nav-link ${type === 'md5' ? 'active' : ''}">🎲 MD5</a>
        <a href="/lichsu/${type}" class="nav-link">📊 Lịch sử</a>
    </div>

    <div class="card">
        <div style="text-align:center;margin-bottom:12px;">
            <span style="font-family:'Orbitron',sans-serif;font-size:12px;color:rgba(255,255,255,0.2);letter-spacing:2px;">
                <i class="${icon}" style="color:${color};"></i> DỰ ĐOÁN ${title}
            </span>
        </div>
        <div class="pred-area">
            <div class="pred-result waiting" id="result">---</div>
            <div class="pred-meta">
                <div class="meta-item">
                    <span class="label">Độ tin cậy</span>
                    <span class="value confidence" id="conf">0%</span>
                </div>
                <div class="meta-item">
                    <span class="label">Chất lượng</span>
                    <span class="value" id="quality" style="color:#ffd54f;">---</span>
                </div>
                <div class="meta-item">
                    <span class="label">Phiên</span>
                    <span class="value" id="phien" style="color:rgba(255,255,255,0.3);font-size:16px;">---</span>
                </div>
            </div>
            <div class="bar-track">
                <div class="bar-fill" id="bar"></div>
            </div>
            <div class="signals" id="signals">
                <span class="signal-tag">Đang phân tích...</span>
            </div>
        </div>
    </div>

    <div style="text-align:center;">
        <a href="/lichsu/${type}" class="btn-history"><i class="fas fa-history"></i> Xem lịch sử ${title}</a>
    </div>

    <div class="footer">
        <p>🚀 <strong>TX PREDICTOR v6</strong> © 2026 · ĐẠI CA KHÔI</p>
        <p style="font-size:6px;color:rgba(255,255,255,0.03);margin-top:2px;">30+ Cầu + 18+ Trend + Dice + Ensemble</p>
    </div>

</div>

<script>
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

function updateClock() {
    document.getElementById('clockDisplay').textContent = new Date().toLocaleTimeString('vi-VN', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

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

async function fetchPrediction() {
    const data = await fetchAPI('/api/${type}');
    if (data) {
        updatePrediction(data);
    }
}

function updatePrediction(data) {
    const resultEl = document.getElementById('result');
    const confEl = document.getElementById('conf');
    const qualityEl = document.getElementById('quality');
    const phienEl = document.getElementById('phien');
    const barEl = document.getElementById('bar');
    const signalsEl = document.getElementById('signals');

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

let isRefreshing = false;

async function refreshAll() {
    if (isRefreshing) return;
    isRefreshing = true;
    try {
        await fetchPrediction();
    } catch (e) {
        console.error('Refresh error:', e);
    }
    isRefreshing = false;
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 TX PREDICTOR v6 - ${title}');
    refreshAll();
    setInterval(refreshAll, 5000);

    setTimeout(function() {
        document.querySelector('.status-badge').innerHTML = '<span class="status-dot"></span><span>Ready</span>';
    }, 1000);
});
</script>
</body>
</html>
    `;
}

// ============================================================
// HÀM RENDER LỊCH SỬ
// ============================================================
function renderHistoryPage(type, title, icon, color) {
    return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Lịch sử ${title} - TX PREDICTOR</title>
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
        ::-webkit-scrollbar-thumb { background: ${color}; border-radius: 10px; }

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
            background: linear-gradient(135deg, ${color}, ${color}cc);
            border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; font-weight: 900; color: #fff;
            font-family: 'Orbitron', sans-serif;
            box-shadow: 0 0 40px rgba(124,77,255,0.15);
        }
        .logo-text {
            font-family: 'Orbitron', sans-serif;
            font-size: 20px; font-weight: 700;
            background: linear-gradient(135deg, ${color}, #7c4dff);
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
        .header-time { font-size: 11px; color: rgba(255,255,255,0.3); font-family: 'Orbitron', sans-serif; }

        .nav-links { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 16px; }
        .nav-link {
            padding: 4px 16px; border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.06);
            color: rgba(255,255,255,0.4); font-size: 8px;
            text-decoration: none; font-family: 'Orbitron', sans-serif;
            transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .nav-link:hover { border-color: ${color}; color: ${color}; background: rgba(124,77,255,0.05); }
        .nav-link.active { border-color: ${color}; color: ${color}; background: rgba(124,77,255,0.05); }

        .page-title {
            font-family: 'Orbitron', sans-serif;
            font-size: 24px; font-weight: 700;
            color: ${color};
            text-align: center;
            margin-bottom: 16px;
            letter-spacing: 2px;
        }
        .page-title i { margin-right: 10px; }

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
        .card-title i { font-size: 13px; color: ${color}; }
        .card-badge {
            margin-left: auto; background: rgba(124,77,255,0.06);
            color: ${color}; padding: 2px 12px; border-radius: 20px;
            font-size: 7px; font-weight: 600; text-transform: uppercase;
        }

        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
        @media (max-width: 600px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
        .stat-card {
            background: rgba(255,255,255,0.01); border-radius: 12px;
            padding: 12px 8px; text-align: center;
            border: 1px solid rgba(255,255,255,0.01);
            transition: all 0.3s ease;
        }
        .stat-card:hover { background: rgba(255,255,255,0.02); border-color: rgba(124,77,255,0.03); }
        .stat-number { font-size: 26px; font-weight: 700; font-family: 'Orbitron', sans-serif; color: ${color}; }
        .stat-number.good { color: #66bb6a; }
        .stat-number.bad { color: #ef5350; }
        .stat-number.winrate { color: #ffd54f; }
        .stat-label { font-size: 8px; color: rgba(255,255,255,0.15); text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }

        .history-container { max-height: 500px; overflow-y: auto; margin-top: 4px; }
        .history-table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .history-table thead { position: sticky; top: 0; z-index: 2; }
        .history-table th {
            text-align: left; padding: 6px 8px;
            color: rgba(255,255,255,0.12); font-size: 8px; text-transform: uppercase;
            letter-spacing: 1px; border-bottom: 1px solid rgba(255,255,255,0.03);
            background: rgba(10,10,26,0.95); backdrop-filter: blur(10px);
            font-weight: 500;
        }
        .history-table td { padding: 5px 8px; border-bottom: 1px solid rgba(255,255,255,0.01); color: rgba(255,255,255,0.35); font-size: 10px; }
        .history-table tr:hover td { background: rgba(255,255,255,0.01); }
        .history-table .phien { color: #fff; font-family: 'Orbitron', sans-serif; font-size: 9px; }
        .history-table .win { color: #66bb6a; font-weight: 600; }
        .history-table .lose { color: #ef5350; font-weight: 600; }
        .history-table .pending { color: #ffd54f; }
        .history-table .tai { color: #4fc3f7; font-weight: 600; }
        .history-table .xiu { color: #ef5350; font-weight: 600; }

        .scroll-hint { text-align: center; padding: 8px; color: rgba(255,255,255,0.04); font-size: 7px; letter-spacing: 1px; }

        .btn-back {
            display: inline-block; padding: 8px 24px; border-radius: 20px;
            border: 1px solid ${color}44; background: rgba(124,77,255,0.05);
            color: ${color}; font-size: 10px; font-weight: 500; cursor: pointer;
            transition: all 0.3s ease; text-decoration: none;
            font-family: 'Orbitron', sans-serif; letter-spacing: 0.5px;
        }
        .btn-back:hover { background: rgba(124,77,255,0.1); border-color: ${color}; }

        .footer { text-align: center; padding: 14px 20px 6px; color: rgba(255,255,255,0.04); font-size: 8px; border-top: 1px solid rgba(255,255,255,0.02); margin-top: 12px; font-family: 'Orbitron', sans-serif; letter-spacing: 1px; }
        .footer strong { color: ${color}; }

        @media (max-width: 768px) {
            .container { padding: 8px; }
            .header { padding: 8px 14px; flex-direction: column; align-items: stretch; gap: 4px; }
            .logo-text { font-size: 16px; }
            .logo-icon { width: 36px; height: 36px; font-size: 16px; }
            .header-right { justify-content: space-between; }
            .page-title { font-size: 18px; }
            .stat-number { font-size: 18px; }
            .history-table { font-size: 9px; }
            .history-table th, .history-table td { padding: 3px 5px; }
        }
        @media (max-width: 480px) {
            .container { padding: 4px; }
            .page-title { font-size: 14px; }
            .stats-grid { gap: 4px; }
            .stat-number { font-size: 14px; }
            .stat-card { padding: 6px 3px; }
            .history-table { font-size: 7px; }
            .history-table th, .history-table td { padding: 2px 4px; }
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
                <div class="logo-sub">ĐẠI CA KHÔI <span style="color:${color};">@2026</span></div>
            </div>
        </div>
        <div class="header-right">
            <span class="status-badge">
                <span class="status-dot"></span>
                <span>Live</span>
            </span>
            <span class="header-time" id="clockDisplay">--:--:--</span>
            <a href="/${type}" class="btn-back"><i class="fas fa-arrow-left"></i> Dự đoán</a>
        </div>
    </header>

    <div class="nav-links">
        <a href="/" class="nav-link">🏠 Trang chủ</a>
        <a href="/hu" class="nav-link ${type === 'hu' ? 'active' : ''}">🎲 HŨ</a>
        <a href="/md5" class="nav-link ${type === 'md5' ? 'active' : ''}">🎲 MD5</a>
        <a href="/lichsu/${type}" class="nav-link active">📊 Lịch sử</a>
    </div>

    <div class="page-title">
        <i class="${icon}"></i> LỊCH SỬ ${title}
    </div>

    <div class="card" style="margin-bottom:12px;">
        <div class="card-title">
            <i class="fas fa-chart-line"></i> THỐNG KÊ ${title}
            <span class="card-badge">THỰC TẾ</span>
        </div>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number" id="totalPreds">0</div>
                <div class="stat-label">Tổng phiên</div>
            </div>
            <div class="stat-card">
                <div class="stat-number good" id="totalCorrect">0</div>
                <div class="stat-label">Thắng</div>
            </div>
            <div class="stat-card">
                <div class="stat-number bad" id="totalWrong">0</div>
                <div class="stat-label">Thua</div>
            </div>
            <div class="stat-card">
                <div class="stat-number winrate" id="winRate">0%</div>
                <div class="stat-label">Tỷ lệ thắng</div>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="card-title">
            <i class="fas fa-history"></i> CHI TIẾT ${title}
            <span class="card-badge">1000 phiên</span>
        </div>
        <div class="history-container">
            <table class="history-table">
                <thead>
                    <tr>
                        <th>Phiên</th>
                        <th>Dự đoán</th>
                        <th>Kết quả</th>
                        <th>Độ tin cậy</th>
                        <th>Trạng thái</th>
                    </tr>
                </thead>
                <tbody id="historyBody">
                    <tr>
                        <td colspan="5" style="text-align:center;padding:20px;color:rgba(255,255,255,0.06);font-size:10px;">
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

function updateClock() {
    document.getElementById('clockDisplay').textContent = new Date().toLocaleTimeString('vi-VN', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

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

async function fetchHistory() {
    const data = await fetchAPI('/api/history/${type}');
    if (data) {
        renderHistory(data.history || []);
        updateStats(data.history || []);
    }
}

function renderHistory(history) {
    const tbody = document.getElementById('historyBody');
    if (!history || history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:rgba(255,255,255,0.06);">Chưa có dữ liệu</td></tr>';
        return;
    }

    const rows = history.slice(0, 100).map(r => {
        const statusClass = r.trangThai === 'WIN' ? 'win' : (r.trangThai === 'LOSE' ? 'lose' : 'pending');
        const statusText = r.trangThai === 'WIN' ? '✅ THẮNG' : (r.trangThai === 'LOSE' ? '❌ THUA' : '⏳ CHỜ');
        return `<tr>
            <td class="phien">#${r.phien}</td>
            <td class="${r.duDoan === 'TAI' ? 'tai' : 'xiu'}">${r.duDoan || '---'}</td>
            <td class="${r.ketQua === 'TAI' ? 'tai' : 'xiu'}">${r.ketQua || '---'}</td>
            <td>${r.do_tin_cay || '0%'}</td>
            <td class="${statusClass}">${statusText}</td>
        </tr>`;
    }).join('');
    tbody.innerHTML = rows;
}

function updateStats(history) {
    if (!history || history.length === 0) {
        document.getElementById('totalPreds').textContent = 0;
        document.getElementById('totalCorrect').textContent = 0;
        document.getElementById('totalWrong').textContent = 0;
        document.getElementById('winRate').textContent = '0%';
        return;
    }

    const total = history.length;
    const wins = history.filter(r => r.trangThai === 'WIN').length;
    const loses = history.filter(r => r.trangThai === 'LOSE').length;

    document.getElementById('totalPreds').textContent = total;
    document.getElementById('totalCorrect').textContent = wins;
    document.getElementById('totalWrong').textContent = loses;
    document.getElementById('winRate').textContent = total > 0 ? (wins / total * 100).toFixed(1) + '%' : '0%';
}

let refreshInterval;

function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
        fetchHistory();
    }, 5000);
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 TX PREDICTOR v6 - LỊCH SỬ ${title}');
    fetchHistory();
    startAutoRefresh();
});
</script>
</body>
</html>
    `;
}

// ============================================================
// ROUTES
// ============================================================

// Trang chủ
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
        .header-time { font-size: 11px; color: rgba(255,255,255,0.3); font-family: 'Orbitron', sans-serif; }

        .nav-links { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 16px; }
        .nav-link {
            padding: 4px 16px; border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.06);
            color: rgba(255,255,255,0.4); font-size: 8px;
            text-decoration: none; font-family: 'Orbitron', sans-serif;
            transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .nav-link:hover { border-color: #b388ff; color: #b388ff; background: rgba(124,77,255,0.05); }
        .nav-link.active { border-color: #b388ff; color: #b388ff; background: rgba(124,77,255,0.05); }

        .welcome {
            text-align: center;
            padding: 40px 20px;
            background: rgba(255,255,255,0.02);
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.04);
            margin-bottom: 16px;
        }
        .welcome h1 {
            font-family: 'Orbitron', sans-serif;
            font-size: 32px;
            font-weight: 900;
            background: linear-gradient(135deg, #b388ff, #7c4dff);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            margin-bottom: 12px;
        }
        .welcome p {
            color: rgba(255,255,255,0.4);
            font-size: 14px;
            letter-spacing: 1px;
        }
        .welcome .version {
            color: rgba(255,255,255,0.15);
            font-size: 10px;
            margin-top: 8px;
            font-family: 'Orbitron', sans-serif;
            letter-spacing: 2px;
        }

        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        @media (max-width: 992px) { .grid { grid-template-columns: 1fr; } }

        .menu-card {
            background: rgba(255,255,255,0.02);
            border-radius: 16px; border: 1px solid rgba(255,255,255,0.04);
            padding: 30px 20px;
            text-align: center;
            transition: all 0.3s ease;
            text-decoration: none;
            color: #fff;
            display: block;
        }
        .menu-card:hover { border-color: rgba(124,77,255,0.08); box-shadow: 0 0 60px rgba(124,77,255,0.03); transform: translateY(-4px); }
        .menu-card .icon { font-size: 40px; margin-bottom: 12px; display: block; }
        .menu-card .title { font-family: 'Orbitron', sans-serif; font-size: 16px; font-weight: 700; }
        .menu-card .desc { font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 4px; }

        .footer { text-align: center; padding: 14px 20px 6px; color: rgba(255,255,255,0.04); font-size: 8px; border-top: 1px solid rgba(255,255,255,0.02); margin-top: 12px; font-family: 'Orbitron', sans-serif; letter-spacing: 1px; }
        .footer strong { color: #b388ff; }

        @media (max-width: 768px) {
            .container { padding: 8px; }
            .header { padding: 8px 14px; flex-direction: column; align-items: stretch; gap: 4px; }
            .logo-text { font-size: 16px; }
            .logo-icon { width: 36px; height: 36px; font-size: 16px; }
            .header-right { justify-content: space-between; }
            .welcome h1 { font-size: 24px; }
            .grid { gap: 10px; }
            .menu-card { padding: 20px 14px; }
            .menu-card .icon { font-size: 30px; }
        }
        @media (max-width: 480px) {
            .container { padding: 4px; }
            .welcome h1 { font-size: 18px; }
            .menu-card .title { font-size: 13px; }
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
            <span class="status-badge">
                <span class="status-dot"></span>
                <span>Live</span>
            </span>
            <span class="header-time" id="clockDisplay">--:--:--</span>
        </div>
    </header>

    <div class="nav-links">
        <a href="/" class="nav-link active">🏠 Trang chủ</a>
        <a href="/hu" class="nav-link">🎲 HŨ</a>
        <a href="/md5" class="nav-link">🎲 MD5</a>
        <a href="/lichsu/hu" class="nav-link">📊 Lịch sử HŨ</a>
        <a href="/lichsu/md5" class="nav-link">📊 Lịch sử MD5</a>
    </div>

    <div class="welcome">
        <h1>TX PREDICTOR v6</h1>
        <p>🚀 Hệ thống dự đoán Tài Xỉu siêu chính xác</p>
        <p class="version">🧠 30+ Cầu · 18+ Trend · Dice · Ensemble</p>
    </div>

    <div class="grid">
        <a href="/hu" class="menu-card">
            <span class="icon">🎲</span>
            <div class="title">Dự đoán HŨ</div>
            <div class="desc">Phân tích và dự đoán Tài Xỉu HŨ</div>
        </a>
        <a href="/md5" class="menu-card">
            <span class="icon">🎲</span>
            <div class="title">Dự đoán MD5</div>
            <div class="desc">Phân tích và dự đoán Tài Xỉu MD5</div>
        </a>
        <a href="/lichsu/hu" class="menu-card">
            <span class="icon">📊</span>
            <div class="title">Lịch sử HŨ</div>
            <div class="desc">Thống kê thắng thua HŨ</div>
        </a>
        <a href="/lichsu/md5" class="menu-card">
            <span class="icon">📊</span>
            <div class="title">Lịch sử MD5</div>
            <div class="desc">Thống kê thắng thua MD5</div>
        </a>
    </div>

    <div class="footer">
        <p>🚀 <strong>TX PREDICTOR v6</strong> © 2026 · ĐẠI CA KHÔI</p>
        <p style="font-size:6px;color:rgba(255,255,255,0.03);margin-top:2px;">30+ Cầu + 18+ Trend + Dice + Ensemble</p>
    </div>

</div>

<script>
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

function updateClock() {
    document.getElementById('clockDisplay').textContent = new Date().toLocaleTimeString('vi-VN', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();
</script>
</body>
</html>
    `);
});

// Dự đoán HU
app.get('/hu', (req, res) => {
    res.send(renderPredictionPage('HŨ', 'fas fa-dice-d6', 'hu', '#4fc3f7'));
});

// Dự đoán MD5
app.get('/md5', (req, res) => {
    res.send(renderPredictionPage('MD5', 'fas fa-dice-d6', 'md5', '#ff6b6b'));
});

// Lịch sử HU
app.get('/lichsu/hu', (req, res) => {
    res.send(renderHistoryPage('hu', 'HŨ', 'fas fa-dice-d6', '#4fc3f7'));
});

// Lịch sử MD5
app.get('/lichsu/md5', (req, res) => {
    res.send(renderHistoryPage('md5', 'MD5', 'fas fa-dice-d6', '#ff6b6b'));
});

// ============================================================
// API
// ============================================================
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
            }))
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

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
            }))
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/history/:type', (req, res) => {
    const type = req.params.type;
    if (type === 'all') {
        const all = [...historyData.hu, ...historyData.md5];
        all.sort((a, b) => b.phien - a.phien);
        res.json({ history: all, total: all.length });
    } else if (type === 'hu') {
        res.json({ history: historyData.hu || [], total: (historyData.hu || []).length });
    } else if (type === 'md5') {
        res.json({ history: historyData.md5 || [], total: (historyData.md5 || []).length });
    } else {
        res.json({ history: [], total: 0 });
    }
});

app.get('/api/stats', (req, res) => {
    const stats = predictor.stats();
    res.json(stats);
});

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
    console.log('📊 Route: /hu - /md5 - /lichsu/hu - /lichsu/md5');
    console.log('Server: http://0.0.0.0:' + PORT);
    console.log('========================================');
});
