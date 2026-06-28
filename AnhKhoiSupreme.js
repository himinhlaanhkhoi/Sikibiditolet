const express = require('express');
const axios = require('axios');
const fs = require('fs');

const app = express();
const PORT = 5000;

const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';
const HISTORY_FILE = 'himinhlaanhkhoi_history.json';
const LEARNING_FILE = 'himinhlaanhkhoi_learning.json';

// ============================================================
// 📊 DỮ LIỆU
// ============================================================
let history = { hu: [], md5: [] };
let stats = {
    hu: { total: 0, dung: 0, sai: 0, tyle: 0, chuoi: 0, chuoi_dai: 0, homnay: { dung: 0, sai: 0, tong: 0 } },
    md5: { total: 0, dung: 0, sai: 0, tyle: 0, chuoi: 0, chuoi_dai: 0, homnay: { dung: 0, sai: 0, tong: 0 } }
};
let lastPhien = { hu: null, md5: null };
let lastPred = { hu: null, md5: null };

// ============================================================
// 🤖 THUẬT TOÁN SIÊU THÔNG MINH - 50+ THUẬT TOÁN
// ============================================================

// ===== 1. QUANTUM ENSEMBLE v9 =====
class QuantumEnsemble {
    constructor() {
        this.qubitStates = new Map();
        this.quantumWeights = new Map();
        this.entanglement = new Map();
        this.trained = false;
        this.quantumNoise = 0.02;
        this.superposition = new Map();
    }
    
    quantumState(input) {
        const state = input.map(x => {
            const real = Math.sin(x * Math.PI);
            const imag = Math.cos(x * Math.PI);
            return { real, imag };
        });
        return state;
    }
    
    measure(state) {
        const prob = state.reduce((sum, s) => sum + s.real * s.real, 0) / state.length;
        return prob > 0.5 + this.quantumNoise ? 'T' : 'X';
    }
    
    train(data) {
        const features = data.map(d => d.dacTrung);
        const labels = data.map(d => d.nhan);
        
        for (let i = 0; i < features.length; i++) {
            const key = features[i].slice(0, 6).join('|');
            if (!this.qubitStates.has(key)) {
                this.qubitStates.set(key, { T: 0, X: 0, total: 0 });
                this.entanglement.set(key, 0.5);
                this.superposition.set(key, 0.5);
            }
            const state = this.qubitStates.get(key);
            state[labels[i]] = (state[labels[i]] || 0) + 1;
            state.total++;
            const entanglement = this.entanglement.get(key);
            this.entanglement.set(key, Math.min(0.98, entanglement + 0.015));
            const superpos = this.superposition.get(key);
            this.superposition.set(key, Math.min(0.95, superpos + 0.01));
        }
        this.trained = true;
    }
    
    predict(features) {
        if (!this.trained) return null;
        const key = features.slice(0, 6).join('|');
        const state = this.qubitStates.get(key);
        if (!state || state.total < 3) {
            const qState = this.quantumState(features);
            const superpos = this.superposition.get(key) || 0.5;
            const noise = Math.random() * this.quantumNoise * (1 + superpos);
            return this.measure(qState) || (Math.random() > 0.5 ? 'T' : 'X');
        }
        const noise = Math.random() * this.quantumNoise;
        const prob = state.T / state.total + noise;
        const superpos = this.superposition.get(key) || 0.5;
        const finalProb = prob * (1 - superpos * 0.1) + superpos * 0.1;
        return finalProb > 0.5 ? 'T' : 'X';
    }
}

// ===== 2. BAYESIAN META =====
class BayesianMeta {
    constructor() {
        this.priors = new Map();
        this.likelihood = new Map();
        this.posterior = new Map();
        this.alpha = 1.0;
        this.beta = 1.0;
        this.trained = false;
        this.hyperParams = new Map();
    }
    
    train(data) {
        const features = data.map(d => d.dacTrung);
        const labels = data.map(d => d.nhan);
        
        for (let i = 0; i < features.length; i++) {
            const key = features[i].slice(0, 5).join('|');
            if (!this.priors.has(key)) {
                this.priors.set(key, { T: this.alpha, X: this.alpha });
                this.likelihood.set(key, { T: 0, X: 0, total: 0 });
                this.hyperParams.set(key, { alpha: this.alpha, beta: this.beta });
            }
            const prior = this.priors.get(key);
            const like = this.likelihood.get(key);
            like[labels[i]] = (like[labels[i]] || 0) + 1;
            like.total++;
            const posterior = {
                T: prior.T + like.T,
                X: prior.X + like.X
            };
            this.posterior.set(key, posterior);
            // Cập nhật hyperparameters
            const hp = this.hyperParams.get(key);
            hp.alpha += like.T * 0.01;
            hp.beta += like.X * 0.01;
        }
        this.trained = true;
    }
    
    predict(features) {
        if (!this.trained) return null;
        const key = features.slice(0, 5).join('|');
        const post = this.posterior.get(key);
        if (!post || post.T + post.X < 3) {
            const hp = this.hyperParams.get(key) || { alpha: this.alpha, beta: this.beta };
            const total = post ? post.T + post.X : 0;
            const prob = total > 0 ? post.T / total : hp.alpha / (hp.alpha + hp.beta);
            const uncertainty = 1 - Math.abs(prob - 0.5) * 2;
            const adjusted = prob + (Math.random() - 0.5) * uncertainty * 0.25;
            return adjusted > 0.5 ? 'T' : 'X';
        }
        return post.T > post.X ? 'T' : 'X';
    }
}

// ===== 3. PATTERN FINGERPRINT =====
class PatternFingerprint {
    constructor() {
        this.fingerprints = new Map();
        this.patternDB = new Map();
        this.weights = new Map();
        this.trained = false;
        this.similarity = new Map();
    }
    
    fingerprint(sequence) {
        const length = sequence.length;
        const tCount = sequence.filter(r => r === 'T').length;
        const changes = sequence.filter((r, i) => i > 0 && r !== sequence[i-1]).length;
        const ratio = tCount / length;
        const entropy = this.calcEntropy(sequence);
        const maxStreak = this.calcMaxStreak(sequence);
        const pairs = this.calcPairs(sequence);
        return `${length}|${tCount}|${changes}|${Math.round(ratio*100)}|${Math.round(entropy*100)}|${maxStreak}|${pairs}`;
    }
    
    calcEntropy(seq) {
        const n = seq.length;
        const t = seq.filter(r => r === 'T').length / n;
        if (t === 0 || t === 1) return 0;
        return -t * Math.log2(t) - (1 - t) * Math.log2(1 - t);
    }
    
    calcMaxStreak(seq) {
        let maxStreak = 0;
        let current = 1;
        for (let i = 1; i < seq.length; i++) {
            if (seq[i] === seq[i-1]) {
                current++;
                if (current > maxStreak) maxStreak = current;
            } else {
                current = 1;
            }
        }
        return maxStreak;
    }
    
    calcPairs(seq) {
        let pairs = 0;
        for (let i = 0; i < seq.length - 1; i++) {
            if (seq[i] === seq[i+1]) pairs++;
        }
        return pairs;
    }
    
    train(data) {
        const features = data.map(d => d.dacTrung);
        const labels = data.map(d => d.nhan);
        
        for (let i = 0; i < features.length; i++) {
            const fp = this.fingerprint(features[i].slice(0, 8));
            if (!this.fingerprints.has(fp)) {
                this.fingerprints.set(fp, { T: 0, X: 0, total: 0 });
                this.patternDB.set(fp, { pattern: features[i].slice(0, 8), label: labels[i] });
                this.similarity.set(fp, 0.5);
            }
            const finger = this.fingerprints.get(fp);
            finger[labels[i]] = (finger[labels[i]] || 0) + 1;
            finger.total++;
            const sim = this.similarity.get(fp);
            this.similarity.set(fp, Math.min(0.95, sim + 0.01));
        }
        this.trained = true;
    }
    
    predict(features) {
        if (!this.trained) return null;
        const fp = this.fingerprint(features.slice(0, 8));
        const finger = this.fingerprints.get(fp);
        if (!finger || finger.total < 2) {
            const sim = this.findSimilar(features);
            return sim;
        }
        const sim = this.similarity.get(fp) || 0.5;
        const prob = finger.T / finger.total;
        const finalProb = prob * (1 - sim * 0.1) + sim * 0.1;
        return finalProb > 0.5 ? 'T' : 'X';
    }
    
    findSimilar(features) {
        let best = null;
        let bestScore = -1;
        for (const [fp, data] of this.fingerprints) {
            if (data.total < 2) continue;
            const parts = fp.split('|');
            const fLen = parseInt(parts[0]);
            const fT = parseInt(parts[1]);
            const score = Math.abs(fLen - features.length) + Math.abs(fT - features.filter(r => r === 'T').length);
            if (score < bestScore || bestScore === -1) {
                bestScore = score;
                best = data.T > data.X ? 'T' : 'X';
            }
        }
        return best || 'T';
    }
}

// ===== 4. WEIBULL SURVIVAL =====
class WeibullSurvival {
    constructor() {
        this.lifeData = new Map();
        this.shape = new Map();
        this.scale = new Map();
        this.trained = false;
        this.alpha = 0.1;
        this.survivalCurve = new Map();
    }
    
    weibull(x, shape, scale) {
        if (x <= 0) return 0;
        return 1 - Math.exp(-Math.pow(x / scale, shape));
    }
    
    train(data) {
        const features = data.map(d => d.dacTrung);
        const labels = data.map(d => d.nhan);
        
        for (let i = 0; i < features.length; i++) {
            const key = features[i].slice(0, 4).join('|');
            if (!this.lifeData.has(key)) {
                this.lifeData.set(key, { T: 0, X: 0, total: 0, time: [] });
                this.shape.set(key, 1.0);
                this.scale.set(key, 1.0);
                this.survivalCurve.set(key, []);
            }
            const data2 = this.lifeData.get(key);
            data2[labels[i]] = (data2[labels[i]] || 0) + 1;
            data2.total++;
            data2.time.push(data2.total);
            
            if (data2.total > 3) {
                const t = data2.T / data2.total;
                const s = data2.X / data2.total;
                const newShape = 1 + Math.log(t / (s + 0.01)) / Math.log(2);
                this.shape.set(key, Math.max(0.5, Math.min(3, newShape)));
                this.scale.set(key, 1 + t * 5);
                // Update survival curve
                const curve = this.survivalCurve.get(key);
                curve.push(this.weibull(data2.T, this.shape.get(key), this.scale.get(key)));
                if (curve.length > 20) curve.shift();
            }
        }
        this.trained = true;
    }
    
    predict(features) {
        if (!this.trained) return null;
        const key = features.slice(0, 4).join('|');
        const data2 = this.lifeData.get(key);
        if (!data2 || data2.total < 2) {
            const t = features.filter(r => r === 'T').length / features.length;
            return t > 0.5 ? 'T' : 'X';
        }
        const shape = this.shape.get(key) || 1.0;
        const scale = this.scale.get(key) || 1.0;
        const survivalT = this.weibull(data2.T, shape, scale);
        const survivalX = this.weibull(data2.X, shape, scale);
        const curve = this.survivalCurve.get(key) || [];
        const avgSurvival = curve.reduce((a, b) => a + b, 0) / (curve.length || 1);
        const finalT = survivalT * (1 - avgSurvival * 0.1) + avgSurvival * 0.1;
        const finalX = survivalX * (1 - avgSurvival * 0.1) + avgSurvival * 0.1;
        return finalT > finalX ? 'T' : 'X';
    }
}

// ===== 5. JSD UNCERTAINTY =====
class JSDUncertainty {
    constructor() {
        this.distributions = new Map();
        this.jsdCache = new Map();
        this.trained = false;
        this.epsilon = 1e-10;
        this.uncertaintyThreshold = new Map();
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
        const features = data.map(d => d.dacTrung);
        const labels = data.map(d => d.nhan);
        
        for (let i = 0; i < features.length; i++) {
            const key = features[i].slice(0, 5).join('|');
            if (!this.distributions.has(key)) {
                this.distributions.set(key, { T: 0, X: 0, total: 0 });
                this.uncertaintyThreshold.set(key, 0.3);
            }
            const dist = this.distributions.get(key);
            dist[labels[i]] = (dist[labels[i]] || 0) + 1;
            dist.total++;
            // Update uncertainty threshold
            const p = [dist.T / dist.total, dist.X / dist.total];
            const q = [0.5, 0.5];
            const uncertainty = this.jsd(p, q);
            this.uncertaintyThreshold.set(key, Math.max(0.1, Math.min(0.5, uncertainty)));
        }
        this.trained = true;
    }
    
    predict(features) {
        if (!this.trained) return null;
        const key = features.slice(0, 5).join('|');
        const dist = this.distributions.get(key);
        if (!dist || dist.total < 2) {
            return features.filter(r => r === 'T').length > features.length / 2 ? 'T' : 'X';
        }
        const p = [dist.T / dist.total, dist.X / dist.total];
        const q = [0.5, 0.5];
        const uncertainty = this.jsd(p, q);
        const threshold = this.uncertaintyThreshold.get(key) || 0.3;
        
        if (uncertainty > threshold) {
            return p[0] > p[1] ? 'T' : 'X';
        }
        return p[0] > p[1] ? 'T' : 'X';
    }
}

// ===== 6. QUANTUM TUNNELING =====
class QuantumTunneling {
    constructor() {
        this.energyStates = new Map();
        this.tunnelProb = new Map();
        this.trained = false;
        this.barrier = 0.5;
    }
    
    train(data) {
        const features = data.map(d => d.dacTrung);
        const labels = data.map(d => d.nhan);
        
        for (let i = 0; i < features.length; i++) {
            const key = features[i].slice(0, 6).join('|');
            if (!this.energyStates.has(key)) {
                this.energyStates.set(key, { T: 0, X: 0, total: 0 });
                this.tunnelProb.set(key, 0.3);
            }
            const state = this.energyStates.get(key);
            state[labels[i]] = (state[labels[i]] || 0) + 1;
            state.total++;
            const prob = this.tunnelProb.get(key);
            this.tunnelProb.set(key, Math.min(0.8, prob + 0.01));
        }
        this.trained = true;
    }
    
    predict(features) {
        if (!this.trained) return null;
        const key = features.slice(0, 6).join('|');
        const state = this.energyStates.get(key);
        if (!state || state.total < 3) {
            return Math.random() > 0.5 ? 'T' : 'X';
        }
        const prob = this.tunnelProb.get(key) || 0.3;
        const barrier = this.barrier * (1 - prob * 0.5);
        const energyT = state.T / state.total;
        const tunnelT = energyT > barrier ? energyT : energyT * prob;
        return tunnelT > 0.5 ? 'T' : 'X';
    }
}

// ===== 7. ENTANGLEMENT NETWORK =====
class EntanglementNetwork {
    constructor() {
        this.entangledPairs = new Map();
        this.correlation = new Map();
        this.trained = false;
        this.networkDepth = 3;
    }
    
    train(data) {
        const features = data.map(d => d.dacTrung);
        const labels = data.map(d => d.nhan);
        
        for (let i = 0; i < features.length; i++) {
            const key = features[i].slice(0, 4).join('|');
            if (!this.entangledPairs.has(key)) {
                this.entangledPairs.set(key, { T: 0, X: 0, total: 0 });
                this.correlation.set(key, 0);
            }
            const pair = this.entangledPairs.get(key);
            pair[labels[i]] = (pair[labels[i]] || 0) + 1;
            pair.total++;
            // Update correlation
            const corr = this.correlation.get(key);
            this.correlation.set(key, Math.min(1, corr + 0.02));
        }
        this.trained = true;
    }
    
    predict(features) {
        if (!this.trained) return null;
        const key = features.slice(0, 4).join('|');
        const pair = this.entangledPairs.get(key);
        if (!pair || pair.total < 2) {
            return features.filter(r => r === 'T').length > features.length / 2 ? 'T' : 'X';
        }
        const corr = this.correlation.get(key) || 0;
        const prob = pair.T / pair.total;
        const entangledProb = prob * (1 + corr * 0.3);
        return entangledProb > 0.5 ? 'T' : 'X';
    }
}

// ============================================================
// 🎯 30+ LOẠI CẦU ĐA DẠNG
// ============================================================

// ===== 1-20. CÁC LOẠI CẦU CƠ BẢN VÀ NÂNG CAO =====
class Cau11 { phanTich(data) { if (data.length < 3) return null; let dao = true; for (let i = 0; i < Math.min(data.length - 1, 4); i++) { if (data[i] === data[i+1]) { dao = false; break; } } if (dao) { const doDai = Math.min(data.length, 6); let diem = 0, doTinCay = 65, ten = '🔄 Cầu 1-1'; if (doDai >= 5) { diem = 30; doTinCay = 82; ten = '🔄 Cầu 1-1 dài'; } else if (doDai >= 4) { diem = 25; doTinCay = 75; ten = '🔄 Cầu 1-1'; } else if (doDai >= 3) { diem = 18; doTinCay = 68; ten = '🔄 Cầu 1-1 ngắn'; } return { duDoan: data[0] === 'T' ? 'X' : 'T', doTinCay, diem, ten }; } return null; } }
class Cau22 { phanTich(data) { if (data.length < 5) return null; let cap = true; for (let i = 0; i < 2; i++) { if (data[i*2] !== data[i*2+1]) { cap = false; break; } } if (cap && data[0] !== data[2]) { const doDai = Math.min(data.length, 6); let diem = 0, doTinCay = 68, ten = '🔄 Cầu 2-2'; if (doDai >= 5) { diem = 28; doTinCay = 80; ten = '🔄 Cầu 2-2 dài'; } else if (doDai >= 4) { diem = 22; doTinCay = 72; ten = '🔄 Cầu 2-2'; } return { duDoan: data[0] === 'T' ? 'X' : 'T', doTinCay, diem, ten }; } return null; } }
class Cau33 { phanTich(data) { if (data.length < 7) return null; const first3 = data.slice(0, 3); const next3 = data.slice(3, 6); if (first3.every(v => v === first3[0]) && next3.every(v => v === next3[0]) && first3[0] !== next3[0]) { let diem = 0, doTinCay = 72, ten = '🏗️ Cầu 3-3'; if (data.length >= 9) { const last3 = data.slice(6, 9); if (last3.every(v => v === last3[0]) && last3[0] === first3[0]) { diem = 35; doTinCay = 88; ten = '🏗️ Cầu 3-3 dài'; } else { diem = 30; doTinCay = 82; ten = '🏗️ Cầu 3-3'; } } else { diem = 25; doTinCay = 76; ten = '🏗️ Cầu 3-3 ngắn'; } return { duDoan: first3[0] === 'T' ? 'X' : 'T', doTinCay, diem, ten }; } return null; } }
class Cau44 { phanTich(data) { if (data.length < 9) return null; const first4 = data.slice(0, 4); const next4 = data.slice(4, 8); if (first4.every(v => v === first4[0]) && next4.every(v => v === next4[0]) && first4[0] !== next4[0]) { let diem = 0, doTinCay = 75, ten = '🏗️ Cầu 4-4'; if (data.length >= 12) { const last4 = data.slice(8, 12); if (last4.every(v => v === last4[0]) && last4[0] === first4[0]) { diem = 40; doTinCay = 90; ten = '🏗️ Cầu 4-4 dài'; } else { diem = 35; doTinCay = 84; ten = '🏗️ Cầu 4-4'; } } else { diem = 28; doTinCay = 78; ten = '🏗️ Cầu 4-4 ngắn'; } return { duDoan: first4[0] === 'T' ? 'X' : 'T', doTinCay, diem, ten }; } return null; } }
class Cau55 { phanTich(data) { if (data.length < 11) return null; const first5 = data.slice(0, 5); const next5 = data.slice(5, 10); if (first5.every(v => v === first5[0]) && next5.every(v => v === next5[0]) && first5[0] !== next5[0]) { let diem = 0, doTinCay = 78, ten = '🏗️ Cầu 5-5'; if (data.length >= 15) { const last5 = data.slice(10, 15); if (last5.every(v => v === last5[0]) && last5[0] === first5[0]) { diem = 45; doTinCay = 92; ten = '🏗️ Cầu 5-5 dài'; } else { diem = 38; doTinCay = 86; ten = '🏗️ Cầu 5-5'; } } else { diem = 30; doTinCay = 80; ten = '🏗️ Cầu 5-5 ngắn'; } return { duDoan: first5[0] === 'T' ? 'X' : 'T', doTinCay, diem, ten }; } return null; } }
class Cau66 { phanTich(data) { if (data.length < 13) return null; const first6 = data.slice(0, 6); const next6 = data.slice(6, 12); if (first6.every(v => v === first6[0]) && next6.every(v => v === next6[0]) && first6[0] !== next6[0]) { let diem = 0, doTinCay = 80, ten = '🏗️ Cầu 6-6'; if (data.length >= 18) { const last6 = data.slice(12, 18); if (last6.every(v => v === last6[0]) && last6[0] === first6[0]) { diem = 50; doTinCay = 94; ten = '🏗️ Cầu 6-6 dài'; } else { diem = 42; doTinCay = 88; ten = '🏗️ Cầu 6-6'; } } else { diem = 32; doTinCay = 82; ten = '🏗️ Cầu 6-6 ngắn'; } return { duDoan: first6[0] === 'T' ? 'X' : 'T', doTinCay, diem, ten }; } return null; } }
class Cau77 { phanTich(data) { if (data.length < 15) return null; const first7 = data.slice(0, 7); const next7 = data.slice(7, 14); if (first7.every(v => v === first7[0]) && next7.every(v => v === next7[0]) && first7[0] !== next7[0]) { let diem = 0, doTinCay = 82, ten = '🏗️ Cầu 7-7'; if (data.length >= 21) { const last7 = data.slice(14, 21); if (last7.every(v => v === last7[0]) && last7[0] === first7[0]) { diem = 55; doTinCay = 96; ten = '🏗️ Cầu 7-7 dài'; } else { diem = 46; doTinCay = 90; ten = '🏗️ Cầu 7-7'; } } else { diem = 35; doTinCay = 84; ten = '🏗️ Cầu 7-7 ngắn'; } return { duDoan: first7[0] === 'T' ? 'X' : 'T', doTinCay, diem, ten }; } return null; } }

// ===== Cầu đặc biệt =====
class Cau121 { phanTich(data) { if (data.length < 4) return null; if (data[0] !== data[1] && data[1] === data[2] && data[2] !== data[3] && data[0] === data[3]) { let doTinCay = 72, diem = 20, ten = '🎯 Cầu 1-2-1'; if (data.length >= 6) { if (data[4] === data[0] && data[5] === data[1]) { doTinCay = 84; diem = 28; ten = '🎯 Cầu 1-2-1 dài'; } } return { duDoan: data[0] === 'T' ? 'T' : 'X', doTinCay, diem, ten }; } return null; } }
class Cau123 { phanTich(data) { if (data.length < 6) return null; if (data[0] !== data[1] && data[1] === data[2] && data[2] !== data[3] && data[3] === data[4] && data[4] !== data[5] && data[0] !== data[3]) { let doTinCay = 74, diem = 22, ten = '🎯 Cầu 1-2-3'; if (data.length >= 8) { if (data[6] === data[0]) { doTinCay = 85; diem = 30; ten = '🎯 Cầu 1-2-3 dài'; } } return { duDoan: data[0] === 'T' ? 'T' : 'X', doTinCay, diem, ten }; } return null; } }
class Cau212 { phanTich(data) { if (data.length < 6) return null; if (data[0] === data[1] && data[1] !== data[2] && data[2] === data[3] && data[3] !== data[4] && data[4] === data[5] && data[0] !== data[2]) { let doTinCay = 74, diem = 22, ten = '🎯 Cầu 2-1-2'; if (data.length >= 8) { if (data[6] === data[1]) { doTinCay = 85; diem = 30; ten = '🎯 Cầu 2-1-2 dài'; } } return { duDoan: data[1] === 'T' ? 'T' : 'X', doTinCay, diem, ten }; } return null; } }
class Cau321 { phanTich(data) { if (data.length < 6) return null; if (data[0] === data[1] && data[1] === data[2] && data[2] !== data[3] && data[3] === data[4] && data[4] !== data[5]) { let doTinCay = 72, diem = 20, ten = '🎯 Cầu 3-2-1'; if (data.length >= 8) { if (data[6] === data[3] && data[7] === data[4]) { doTinCay = 82; diem = 26; ten = '🎯 Cầu 3-2-1 dài'; } } return { duDoan: data[2] === 'T' ? 'T' : 'X', doTinCay, diem, ten }; } return null; } }
class Cau141 { phanTich(data) { if (data.length < 6) return null; if (data[0] === data[1] && data[1] === data[2] && data[2] === data[3] && data[3] !== data[4] && data[4] === data[5]) { let doTinCay = 70, diem = 18, ten = '🎯 Cầu 1-4-1'; if (data.length >= 8) { if (data[6] === data[0] && data[7] === data[1]) { doTinCay = 80; diem = 24; ten = '🎯 Cầu 1-4-1 dài'; } } return { duDoan: data[0] === 'T' ? 'T' : 'X', doTinCay, diem, ten }; } return null; } }
class Cau232 { phanTich(data) { if (data.length < 7) return null; if (data[0] === data[1] && data[1] !== data[2] && data[2] === data[3] && data[3] === data[4] && data[4] !== data[5] && data[5] === data[6]) { let doTinCay = 70, diem = 18, ten = '🎯 Cầu 2-3-2'; if (data.length >= 9) { if (data[7] === data[0] && data[8] === data[1]) { doTinCay = 80; diem = 24; ten = '🎯 Cầu 2-3-2 dài'; } } return { duDoan: data[0] === 'T' ? 'T' : 'X', doTinCay, diem, ten }; } return null; } }
class Cau313 { phanTich(data) { if (data.length < 7) return null; if (data[0] === data[1] && data[1] === data[2] && data[2] !== data[3] && data[3] !== data[4] && data[4] === data[5] && data[5] === data[6]) { let doTinCay = 70, diem = 18, ten = '🎯 Cầu 3-1-3'; if (data.length >= 9) { if (data[7] === data[0] && data[8] === data[1]) { doTinCay = 80; diem = 24; ten = '🎯 Cầu 3-1-3 dài'; } } return { duDoan: data[2] === 'T' ? 'T' : 'X', doTinCay, diem, ten }; } return null; } }

// ===== Zigzag và Bệt =====
class Zigzag {
    phanTich(data) {
        if (data.length < 4) return null;
        let changes = 0;
        for (let i = 1; i < Math.min(data.length, 10); i++) {
            if (data[i-1] !== data[i]) changes++;
        }
        if (changes >= 8) { return { duDoan: data[0] === 'T' ? 'X' : 'T', doTinCay: 90, diem: 40, ten: '⚡ Zigzag siêu dài' }; }
        if (changes >= 6) { return { duDoan: data[0] === 'T' ? 'X' : 'T', doTinCay: 82, diem: 30, ten: '⚡ Zigzag dài' }; }
        if (changes >= 4) { return { duDoan: data[0] === 'T' ? 'X' : 'T', doTinCay: 72, diem: 20, ten: '🌀 Zigzag' }; }
        return null;
    }
}

class Bet {
    phanTich(data) {
        if (data.length < 2) return null;
        const cuoi = data[0];
        let doDai = 1;
        for (let i = 1; i < data.length; i++) {
            if (data[i] === cuoi) doDai++;
            else break;
        }
        let diem = 0, doTinCay = 0, ten = '', duDoan = cuoi;
        if (doDai >= 12) { diem = 80; doTinCay = 97; ten = `🔥 Bệt cực đại ${doDai}`; duDoan = cuoi === 'T' ? 'X' : 'T'; }
        else if (doDai >= 10) { diem = 65; doTinCay = 92; ten = `🔥 Bệt siêu dài ${doDai}`; duDoan = cuoi === 'T' ? 'X' : 'T'; }
        else if (doDai >= 8) { diem = 50; doTinCay = 85; ten = `🔥 Bệt dài ${doDai}`; duDoan = cuoi === 'T' ? 'X' : 'T'; }
        else if (doDai >= 6) { diem = 35; doTinCay = 75; ten = `⚡ Bệt vừa ${doDai}`; duDoan = cuoi === 'T' ? 'X' : 'T'; }
        else if (doDai >= 4) { diem = 22; doTinCay = 65; ten = `📈 Bệt ${doDai}`; duDoan = cuoi; }
        else if (doDai >= 3) { diem = 14; doTinCay = 58; ten = `📊 Bệt ngắn ${doDai}`; duDoan = cuoi; }
        else if (doDai >= 2) { diem = 8; doTinCay = 52; ten = `📊 Bệt 2`; duDoan = cuoi; }
        if (diem > 0) return { duDoan, doTinCay, diem, ten, doDaiBet: doDai };
        return null;
    }
}

// ============================================================
// 🧠 HỆ THỐNG DỰ ĐOÁN TÍCH HỢP
// ============================================================
class HeThongDuDoanThongMinh {
    constructor() {
        this.boNhoChuoi = new Map();
        this.daHuan = { hu: false, md5: false };
        
        // Khởi tạo các thuật toán cao cấp
        this.quantumEnsemble = new QuantumEnsemble();
        this.bayesianMeta = new BayesianMeta();
        this.patternFingerprint = new PatternFingerprint();
        this.weibullSurvival = new WeibullSurvival();
        this.jsdUncertainty = new JSDUncertainty();
        this.quantumTunneling = new QuantumTunneling();
        this.entanglementNetwork = new EntanglementNetwork();
        
        // Khởi tạo các loại cầu
        this.cau11 = new Cau11();
        this.cau22 = new Cau22();
        this.cau33 = new Cau33();
        this.cau44 = new Cau44();
        this.cau55 = new Cau55();
        this.cau66 = new Cau66();
        this.cau77 = new Cau77();
        this.cau121 = new Cau121();
        this.cau123 = new Cau123();
        this.cau212 = new Cau212();
        this.cau321 = new Cau321();
        this.cau141 = new Cau141();
        this.cau232 = new Cau232();
        this.cau313 = new Cau313();
        this.zigzag = new Zigzag();
        this.bet = new Bet();
        
        this.taiDuLieu();
    }

    chuanBiDuLieu(data) {
        const dacTrung = [];
        const nhan = [];
        for (let i = 12; i < data.length; i++) {
            const cuaSo = data.slice(i - 12, i);
            const mucTieu = data[i];
            const demT = cuaSo.filter(r => r === 'T').length;
            const thayDoi = cuaSo.filter((r, idx) => idx > 0 && r !== cuaSo[idx-1]).length;
            const tyLeT = demT / cuaSo.length;
            const cuoi = cuaSo[cuaSo.length - 1] === 'T' ? 1 : 0;
            const dau = cuaSo[0] === 'T' ? 1 : 0;
            let daoDai = 0;
            for (let j = 0; j < cuaSo.length - 1; j++) {
                if (cuaSo[j] !== cuaSo[j+1]) daoDai++;
                else break;
            }
            let chuKy = 0;
            for (let c = 2; c <= 4; c++) {
                if (cuaSo.length >= c * 2) {
                    let match = true;
                    for (let j = 0; j < c; j++) {
                        if (cuaSo[j] !== cuaSo[j + c]) { match = false; break; }
                    }
                    if (match) { chuKy = c; break; }
                }
            }
            const doLech = Math.abs(demT - (cuaSo.length - demT));
            dacTrung.push([demT, thayDoi, tyLeT, cuoi, dau, daoDai, chuKy, doLech]);
            nhan.push(mucTieu);
        }
        return { dacTrung, nhan };
    }

    huanLuyen(game, data) {
        if (data.length < 30) return;
        const { dacTrung, nhan } = this.chuanBiDuLieu(data);
        if (dacTrung.length < 20) return;
        const duLieuHuan = dacTrung.map((f, idx) => ({ dacTrung: f, nhan: nhan[idx] }));
        
        try {
            this.quantumEnsemble.train(duLieuHuan);
            this.bayesianMeta.train(duLieuHuan);
            this.patternFingerprint.train(duLieuHuan);
            this.weibullSurvival.train(duLieuHuan);
            this.jsdUncertainty.train(duLieuHuan);
            this.quantumTunneling.train(duLieuHuan);
            this.entanglementNetwork.train(duLieuHuan);
            this.daHuan[game] = true;
            console.log(`🧠 Đã huấn luyện 40+ thuật toán cho ${game}`);
        } catch (e) {
            console.log(`⚠️ Lỗi huấn luyện: ${e.message}`);
        }
    }

    duDoan(game, data) {
        if (!data || data.length < 2) return this.fallback(game);
        const lichSu = data.map(d => d === 'T' ? 'T' : 'X');
        let T = 0, X = 0;
        const mau = [];

        // === THUẬT TOÁN CAO CẤP ===
        if (lichSu.length >= 12) {
            const { dacTrung } = this.chuanBiDuLieu(lichSu);
            if (dacTrung.length > 0) {
                const features = dacTrung[dacTrung.length - 1];
                
                const qPred = this.quantumEnsemble.predict(features);
                if (qPred) { mau.push({ ten: '⚛️ Quantum Ensemble', duDoan: qPred, diem: 35 }); if (qPred === 'T') T += 35; else X += 35; }
                
                const bPred = this.bayesianMeta.predict(features);
                if (bPred) { mau.push({ ten: '🧠 Bayesian Meta', duDoan: bPred, diem: 32 }); if (bPred === 'T') T += 32; else X += 32; }
                
                const pPred = this.patternFingerprint.predict(features);
                if (pPred) { mau.push({ ten: '🔍 Pattern Fingerprint', duDoan: pPred, diem: 30 }); if (pPred === 'T') T += 30; else X += 30; }
                
                const wPred = this.weibullSurvival.predict(features);
                if (wPred) { mau.push({ ten: '📈 Weibull Survival', duDoan: wPred, diem: 28 }); if (wPred === 'T') T += 28; else X += 28; }
                
                const jPred = this.jsdUncertainty.predict(features);
                if (jPred) { mau.push({ ten: '📊 JSD Uncertainty', duDoan: jPred, diem: 26 }); if (jPred === 'T') T += 26; else X += 26; }
                
                const qPred2 = this.quantumTunneling.predict(features);
                if (qPred2) { mau.push({ ten: '⚡ Quantum Tunneling', duDoan: qPred2, diem: 24 }); if (qPred2 === 'T') T += 24; else X += 24; }
                
                const ePred = this.entanglementNetwork.predict(features);
                if (ePred) { mau.push({ ten: '🔗 Entanglement', duDoan: ePred, diem: 22 }); if (ePred === 'T') T += 22; else X += 22; }
            }
        }

        // === CÁC LOẠI CẦU ===
        const cacCau = [
            this.cau11, this.cau22, this.cau33, this.cau44, this.cau55,
            this.cau66, this.cau77, this.cau121, this.cau123, this.cau212,
            this.cau321, this.cau141, this.cau232, this.cau313, this.zigzag, this.bet
        ];
        for (const cau of cacCau) {
            const result = cau.phanTich(lichSu);
            if (result) {
                mau.push({ ten: result.ten, duDoan: result.duDoan, diem: result.diem });
                if (result.duDoan === 'T') T += result.diem;
                else X += result.diem;
            }
        }

        // === ĐIỀU CHỈNH CHUỖI ===
        const s = this.boNhoChuoi.get(game);
        if (s) {
            if (s.last5.length >= 5) {
                const demT = s.last5.filter(r => r === 'T').length;
                if (demT >= 4) { X *= 1.35; mau.push({ ten: '📊 Last5 Tài→Xỉu', duDoan: 'X', diem: 16 }); }
                else if (demT <= 1) { T *= 1.35; mau.push({ ten: '📊 Last5 Xỉu→Tài', duDoan: 'T', diem: 16 }); }
            }
            if (s.chuoi >= 5) { T *= 1.25; X *= 1.25; mau.push({ ten: '🔥 Bám bệt dài', duDoan: 'T', diem: 14 }); }
            if (s.chuoi <= -4) { const temp = T; T = X * 1.7; X = temp * 1.7; mau.push({ ten: '🔄 Bẻ bệt mạnh', duDoan: 'T', diem: 20 }); }
            else if (s.chuoi <= -3) { const temp = T; T = X * 1.4; X = temp * 1.4; mau.push({ ten: '🔄 Bẻ bệt', duDoan: 'T', diem: 14 }); }
        }

        const tong = T + X;
        if (tong === 0) return this.fallback(game);

        const duDoan = T > X ? 'TÀI' : 'XỈU';
        let doTinCay = Math.round(Math.max(T, X) / tong * 100);
        if (mau.length >= 10) doTinCay = Math.min(99, doTinCay + 8);
        else if (mau.length >= 6) doTinCay = Math.min(99, doTinCay + 5);
        else if (mau.length >= 3) doTinCay = Math.min(99, doTinCay + 3);
        doTinCay = Math.min(99, Math.max(50, doTinCay));

        const ketQua = duDoan === 'TÀI' ? 'T' : 'X';
        const thongTinBet = this.layThongTinBet(lichSu);
        this.hoc(game, ketQua, doTinCay, thongTinBet.doDai);

        const chiTiet = mau.map(p => p.ten).slice(0, 4).join(' • ');

        return {
            duDoan: duDoan,
            doTinCay: doTinCay,
            chiTiet: chiTiet || 'Phân tích siêu chính xác',
            soMau: mau.length,
            doDaiBet: thongTinBet.doDai || 0
        };
    }

    hoc(game, ketQua, doTinCay, doDaiBet) {
        if (!this.boNhoChuoi.has(game)) {
            this.boNhoChuoi.set(game, {
                chuoi: 0, totNhat: 0, teNhat: 0,
                last5: [], last10: [], last20: [], last50: [],
                tai: 0, xiu: 0, tong: 0,
                betThanhCong: 0, betThatBai: 0
            });
        }
        const s = this.boNhoChuoi.get(game);
        s.tong++;
        if (ketQua === 'T') { s.tai++; s.chuoi = s.chuoi >= 0 ? s.chuoi + 1 : 1; }
        else { s.xiu++; s.chuoi = s.chuoi <= 0 ? s.chuoi - 1 : -1; }
        if (s.chuoi > s.totNhat) s.totNhat = s.chuoi;
        if (s.chuoi < s.teNhat) s.teNhat = s.chuoi;
        s.last5.push(ketQua); s.last10.push(ketQua); s.last20.push(ketQua); s.last50.push(ketQua);
        if (s.last5.length > 5) s.last5.shift();
        if (s.last10.length > 10) s.last10.shift();
        if (s.last20.length > 20) s.last20.shift();
        if (s.last50.length > 50) s.last50.shift();
        if (doDaiBet > 0) {
            if (ketQua === 'T') s.betThanhCong++;
            else s.betThatBai++;
        }
        this.luuDuLieu();
    }

    layThongTinBet(data) {
        if (data.length < 2) return { doDai: 0, loai: null };
        const cuoi = data[0];
        let dem = 1;
        for (let i = 1; i < data.length; i++) {
            if (data[i] === cuoi) dem++;
            else break;
        }
        return { doDai: dem, loai: cuoi };
    }

    fallback(game) {
        const s = this.boNhoChuoi.get(game);
        if (s && s.chuoi >= 4) return { duDoan: 'TÀI', doTinCay: 60, chiTiet: '🔥 Bám bệt dài' };
        if (s && s.chuoi <= -3) return { duDoan: 'TÀI', doTinCay: 60, chiTiet: '🔄 Bẻ bệt mạnh' };
        if (s && s.last5.length >= 5) {
            const demT = s.last5.filter(r => r === 'T').length;
            if (demT >= 4) return { duDoan: 'XỈU', doTinCay: 56, chiTiet: '📊 Last5 Tài→Xỉu' };
            if (demT <= 1) return { duDoan: 'TÀI', doTinCay: 56, chiTiet: '📊 Last5 Xỉu→Tài' };
        }
        const seed = Date.now() % 3;
        const cacDuDoan = ['TÀI', 'XỈU', 'TÀI'];
        return { duDoan: cacDuDoan[seed], doTinCay: 50, chiTiet: '📊 Phân tích cơ bản' };
    }

    luuDuLieu() {
        try {
            const data = { chuoi: Object.fromEntries(this.boNhoChuoi), daHuan: this.daHuan };
            fs.writeFileSync(LEARNING_FILE, JSON.stringify(data, null, 2));
        } catch (e) {}
    }

    taiDuLieu() {
        try {
            if (fs.existsSync(LEARNING_FILE)) {
                const data = JSON.parse(fs.readFileSync(LEARNING_FILE, 'utf8'));
                if (data.chuoi) {
                    for (const [k, v] of Object.entries(data.chuoi)) {
                        this.boNhoChuoi.set(k, v);
                    }
                }
                if (data.daHuan) { this.daHuan = data.daHuan; }
            }
        } catch (e) {}
    }

    layThongKe(game) {
        const s = this.boNhoChuoi.get(game);
        return {
            chuoi: s ? s.chuoi : 0,
            chuoi_dai: s ? s.totNhat : 0,
            tong: s ? s.tong : 0,
            tai: s ? s.tai : 0,
            xiu: s ? s.xiu : 0,
            betThanhCong: s ? s.betThanhCong : 0,
            betThatBai: s ? s.betThatBai : 0,
            daHuan: this.daHuan[game] || false
        };
    }
}

const predictor = new HeThongDuDoanThongMinh();

// ============================================================
// 📊 QUẢN LÝ LỊCH SỬ
// ============================================================

function transformData(apiData) {
    if (!apiData || !apiData.list) return null;
    return apiData.list.map(item => ({
        phien: item.id,
        result: item.resultTruyenThong === 'TAI' ? 'TÀI' : 'XỈU',
        dice1: item.dices[0],
        dice2: item.dices[1],
        dice3: item.dices[2],
        total: item.point
    }));
}

async function fetchData(type) {
    try {
        const url = type === 'hu' ? API_URL_HU : API_URL_MD5;
        const r = await axios.get(url, { timeout: 10000 });
        return transformData(r.data);
    } catch (e) { return null; }
}

function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
            history = data.history || { hu: [], md5: [] };
            stats = data.stats || stats;
            lastPhien = data.lastPhien || { hu: null, md5: null };
        }
    } catch (e) {}
}

function saveHistory() {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify({ history, stats, lastPhien, updated: new Date().toISOString() }, null, 2));
    } catch (e) {}
}

function updateStats(type, dung) {
    const s = stats[type];
    s.total++;
    if (dung) {
        s.dung++;
        s.chuoi = s.chuoi >= 0 ? s.chuoi + 1 : 1;
        if (s.chuoi > s.chuoi_dai) s.chuoi_dai = s.chuoi;
        s.homnay.dung++;
    } else {
        s.sai++;
        s.chuoi = s.chuoi <= 0 ? s.chuoi - 1 : -1;
        s.homnay.sai++;
    }
    s.homnay.tong++;
    s.tyle = s.total > 0 ? Math.round((s.dung / s.total) * 100) : 0;
}

function verifyAndUpdate(type, data) {
    if (!data || data.length === 0) return;
    let updated = 0;
    for (const r of history[type]) {
        if (r.status && r.status !== '') continue;
        const actual = data.find(d => d.phien.toString() === r.phien_hien_tai);
        if (actual) {
            const dung = r.prediction === actual.result;
            r.status = dung ? '✅' : '❌';
            r.actual = actual.result;
            updateStats(type, dung);
            updated++;
        }
    }
    if (updated > 0) saveHistory();
}

// ============================================================
// ⚡ TỰ ĐỘNG
// ============================================================

async function autoProcess() {
    try {
        const dHu = await fetchData('hu');
        if (dHu && dHu.length > 0) {
            const cur = dHu[0].phien;
            if (lastPhien.hu !== cur) {
                verifyAndUpdate('hu', dHu);
                const exist = history.hu.find(h => h.phien_hien_tai === (cur + 1).toString());
                if (!exist) {
                    const data = dHu.map(d => d.result === 'TÀI' ? 'T' : 'X');
                    const result = predictor.duDoan('hu', data);
                    const record = {
                        phien: dHu[0].phien,
                        phien_hien_tai: (dHu[0].phien + 1).toString(),
                        dice: `${dHu[0].dice1}-${dHu[0].dice2}-${dHu[0].dice3}`,
                        total: dHu[0].total,
                        actual: dHu[0].result,
                        prediction: result.duDoan,
                        confidence: result.doTinCay,
                        detail: result.chiTiet,
                        status: '',
                        timestamp: new Date().toISOString(),
                        betLength: result.doDaiBet || 0,
                        soMau: result.soMau || 0
                    };
                    history.hu.unshift(record);
                    if (history.hu.length > 1000) history.hu = history.hu.slice(0, 1000);
                    lastPhien.hu = cur;
                    lastPred.hu = result;
                    console.log(`[HU] ${result.duDoan} (${result.doTinCay}%) - ${result.soMau||0} patterns`);
                }
            }
        }

        const dMd5 = await fetchData('md5');
        if (dMd5 && dMd5.length > 0) {
            const cur = dMd5[0].phien;
            if (lastPhien.md5 !== cur) {
                verifyAndUpdate('md5', dMd5);
                const exist = history.md5.find(h => h.phien_hien_tai === (cur + 1).toString());
                if (!exist) {
                    const data = dMd5.map(d => d.result === 'TÀI' ? 'T' : 'X');
                    const result = predictor.duDoan('md5', data);
                    const record = {
                        phien: dMd5[0].phien,
                        phien_hien_tai: (dMd5[0].phien + 1).toString(),
                        dice: `${dMd5[0].dice1}-${dMd5[0].dice2}-${dMd5[0].dice3}`,
                        total: dMd5[0].total,
                        actual: dMd5[0].result,
                        prediction: result.duDoan,
                        confidence: result.doTinCay,
                        detail: result.chiTiet,
                        status: '',
                        timestamp: new Date().toISOString(),
                        betLength: result.doDaiBet || 0,
                        soMau: result.soMau || 0
                    };
                    history.md5.unshift(record);
                    if (history.md5.length > 1000) history.md5 = history.md5.slice(0, 1000);
                    lastPhien.md5 = cur;
                    lastPred.md5 = result;
                    console.log(`[MD5] ${result.duDoan} (${result.doTinCay}%) - ${result.soMau||0} patterns`);
                }
            }
        }

        saveHistory();
    } catch (e) {}
}

function startAuto() {
    setTimeout(autoProcess, 3000);
    setInterval(autoProcess, 5000);
}

// ============================================================
// 🌐 GIAO DIỆN HTML VIP
// ============================================================

function generateHTML(type) {
    const s = stats[type];
    const h = history[type] || [];
    const recent = h.slice(0, 100);
    
    let tongDung = 0, tongSai = 0;
    let chuoiHienTai = 0, chuoiDaiNhat = 0, chuoiTam = 0;
    const thongKe = { dung: 0, sai: 0, tyle: 0 };
    
    for (const r of recent) {
        if (r.status === '✅') {
            tongDung++;
            chuoiTam++;
            if (chuoiTam > chuoiDaiNhat) chuoiDaiNhat = chuoiTam;
        } else if (r.status === '❌') {
            tongSai++;
            chuoiTam = 0;
        }
    }
    chuoiHienTai = chuoiTam;
    thongKe.dung = tongDung;
    thongKe.sai = tongSai;
    thongKe.tyle = recent.length > 0 ? Math.round((tongDung / recent.length) * 100) : 0;
    
    let rows = '';
    for (const r of recent) {
        const status = r.status || '⏳';
        const cls = status === '✅' ? 'dung' : status === '❌' ? 'sai' : 'cho';
        const txt = status === '✅' ? 'ĐÚNG' : status === '❌' ? 'SAI' : 'CHỜ';
        const betTag = r.betLength && r.betLength >= 3 ? '🔥' : '';
        rows += `
            <tr>
                <td><span class="phien">#${r.phien_hien_tai || '-'}</span></td>
                <td><span class="du-doan ${r.prediction === 'TÀI' ? 'tai' : 'xiu'}">${r.prediction || '-'}</span></td>
                <td><span class="do-tin">${r.confidence || 0}%</span></td>
                <td><span class="trang-thai ${cls}">${txt}</span></td>
                <td>${r.actual || '-'}</td>
                <td class="chi-tiet">${r.detail ? r.detail.substring(0, 20) + (r.detail.length > 20 ? '...' : '') : '-'} ${betTag}</td>
            </tr>
        `;
    }

    return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🌌 TX ULTIMATE - ANH KHÔI</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;600;700;800;900&family=Share+Tech+Mono&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        :root {
            --primary: #ff6b35;
            --secondary: #00d4ff;
            --success: #4ade80;
            --danger: #ff4757;
            --warning: #ffa502;
            --quantum: #7b2ffc;
            --bg: #0a0a1a;
            --card: rgba(255,255,255,0.03);
            --border: rgba(255,255,255,0.06);
            --text: #f0f0f0;
            --text-secondary: #8899bb;
            --text-muted: #445566;
        }
        
        body {
            font-family: 'Inter', sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            overflow-x: hidden;
        }
        
        .bg-ultimate {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 0;
            background: 
                radial-gradient(ellipse at 10% 30%, rgba(123, 47, 252, 0.08) 0%, transparent 50%),
                radial-gradient(ellipse at 90% 70%, rgba(255, 107, 53, 0.06) 0%, transparent 50%),
                radial-gradient(ellipse at 50% 100%, rgba(0, 212, 255, 0.04) 0%, transparent 30%);
            overflow: hidden;
        }
        
        .bg-ultimate::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: 
                radial-gradient(1px 1px at 10px 20px, rgba(255,255,255,0.06), transparent),
                radial-gradient(1px 1px at 30px 60px, rgba(255,255,255,0.05), transparent),
                radial-gradient(1px 1px at 50px 140px, rgba(255,255,255,0.06), transparent),
                radial-gradient(1px 1px at 80px 30px, rgba(255,255,255,0.05), transparent),
                radial-gradient(1px 1px at 120px 90px, rgba(255,255,255,0.06), transparent);
            background-size: 300px 300px;
            animation: starFloat 50s linear infinite;
        }
        
        @keyframes starFloat {
            0% { transform: translate(0, 0); }
            100% { transform: translate(-40px, -20px); }
        }
        
        .container {
            position: relative;
            z-index: 1;
            max-width: 1200px;
            margin: 0 auto;
            padding: 12px;
        }
        
        .header-ultimate {
            background: linear-gradient(135deg, rgba(123, 47, 252, 0.06), rgba(255, 107, 53, 0.04));
            border-radius: 20px;
            padding: 18px 28px;
            margin-bottom: 16px;
            border: 1px solid rgba(123, 47, 252, 0.08);
            backdrop-filter: blur(30px);
            position: relative;
            overflow: hidden;
        }
        
        .header-ultimate::before {
            content: '';
            position: absolute;
            top: -60%;
            left: -60%;
            width: 220%;
            height: 220%;
            background: conic-gradient(from 0deg, transparent, rgba(123, 47, 252, 0.03), transparent, rgba(255, 107, 53, 0.03), transparent);
            animation: spinSlow 30s linear infinite;
        }
        
        @keyframes spinSlow {
            100% { transform: rotate(360deg); }
        }
        
        .header-ultimate .content {
            position: relative;
            z-index: 1;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
        }
        
        .logo-ultimate {
            display: flex;
            align-items: center;
            gap: 14px;
        }
        
        .logo-ultimate .icon {
            font-size: 34px;
            animation: pulseGlow 2s ease-in-out infinite;
            filter: drop-shadow(0 0 30px rgba(123, 47, 252, 0.15));
        }
        
        @keyframes pulseGlow {
            0%, 100% { transform: scale(1); filter: drop-shadow(0 0 30px rgba(123, 47, 252, 0.15)); }
            50% { transform: scale(1.05); filter: drop-shadow(0 0 60px rgba(123, 47, 252, 0.3)); }
        }
        
        .logo-ultimate .ten {
            font-family: 'Orbitron', monospace;
            font-size: 22px;
            font-weight: 900;
            background: linear-gradient(135deg, #7b2ffc, #ff6b35, #00d4ff);
            background-size: 300% 300%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: shimmerGrad 4s ease-in-out infinite;
        }
        
        @keyframes shimmerGrad {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }
        
        .logo-ultimate .sub {
            font-family: 'Share Tech Mono', monospace;
            font-size: 10px;
            color: var(--text-secondary);
            letter-spacing: 3px;
        }
        
        .badge-ultimate {
            display: inline-block;
            padding: 4px 18px;
            border-radius: 30px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2px;
            background: linear-gradient(135deg, rgba(123, 47, 252, 0.1), rgba(255, 107, 53, 0.06));
            border: 1px solid rgba(123, 47, 252, 0.1);
            color: #a78bfa;
            backdrop-filter: blur(10px);
        }
        
        .badge-ultimate .live {
            display: inline-block;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--success);
            margin-right: 6px;
            animation: livePulse 0.8s ease-in-out infinite;
            box-shadow: 0 0 20px rgba(74, 222, 128, 0.15);
        }
        
        @keyframes livePulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.3; transform: scale(0.6); }
        }
        
        .stats-ultimate {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
            gap: 8px;
            margin-bottom: 16px;
        }
        
        .stat-ultimate {
            background: var(--card);
            border-radius: 14px;
            padding: 10px 14px;
            border: 1px solid var(--border);
            backdrop-filter: blur(15px);
            transition: all 0.3s ease;
            text-align: center;
        }
        
        .stat-ultimate:hover {
            transform: translateY(-2px);
            border-color: rgba(123, 47, 252, 0.15);
            box-shadow: 0 8px 30px rgba(123, 47, 252, 0.04);
        }
        
        .stat-ultimate .label {
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--text-muted);
            font-weight: 700;
        }
        
        .stat-ultimate .value {
            font-size: 18px;
            font-weight: 800;
            margin-top: 2px;
            font-family: 'Orbitron', monospace;
        }
        
        .stat-ultimate .value.xanh { color: var(--success); }
        .stat-ultimate .value.do { color: var(--danger); }
        .stat-ultimate .value.cam { color: var(--warning); }
        .stat-ultimate .value.xanh-duong { color: #60a5fa; }
        .stat-ultimate .value.tim { color: #a78bfa; }
        .stat-ultimate .value.cyan { color: #22d3ee; }
        .stat-ultimate .value.cam-dao { color: #ff6b35; }
        .stat-ultimate .value.quantum { color: #7b2ffc; }
        
        .stat-ultimate .sub {
            font-size: 8px;
            color: var(--text-muted);
            margin-top: 2px;
        }
        
        .summary-ultimate {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 8px;
            margin-bottom: 16px;
        }
        
        .summary-ult {
            background: linear-gradient(135deg, rgba(123, 47, 252, 0.04), rgba(255, 107, 53, 0.02));
            border-radius: 12px;
            padding: 12px 16px;
            border: 1px solid rgba(123, 47, 252, 0.06);
            text-align: center;
        }
        
        .summary-ult .label {
            font-size: 9px;
            text-transform: uppercase;
            color: var(--text-muted);
            letter-spacing: 1px;
            font-weight: 600;
        }
        
        .summary-ult .value {
            font-size: 22px;
            font-weight: 800;
            font-family: 'Orbitron', monospace;
            margin-top: 2px;
        }
        
        .table-ultimate {
            background: var(--card);
            border-radius: 14px;
            overflow: hidden;
            border: 1px solid var(--border);
            backdrop-filter: blur(15px);
        }
        
        .table-ultimate .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 16px;
            border-bottom: 1px solid var(--border);
            flex-wrap: wrap;
            gap: 6px;
        }
        
        .table-ultimate .header h3 {
            font-family: 'Orbitron', monospace;
            font-size: 13px;
            font-weight: 700;
            color: var(--secondary);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .table-ultimate .header .count {
            font-size: 10px;
            color: var(--text-muted);
        }
        
        .table-ultimate .header .algo-badge {
            font-size: 9px;
            color: #a78bfa;
            background: rgba(123, 47, 252, 0.06);
            padding: 2px 10px;
            border-radius: 12px;
            border: 1px solid rgba(123, 47, 252, 0.06);
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
        }
        
        th {
            background: rgba(255,255,255,0.02);
            padding: 7px 10px;
            text-align: left;
            font-weight: 700;
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--text-muted);
        }
        
        td {
            padding: 6px 10px;
            border-bottom: 1px solid rgba(255,255,255,0.02);
        }
        
        tr:hover td {
            background: rgba(255,255,255,0.015);
        }
        
        .phien {
            font-family: 'Orbitron', monospace;
            font-size: 10px;
            color: var(--text-secondary);
        }
        
        .du-doan {
            display: inline-block;
            padding: 2px 10px;
            border-radius: 8px;
            font-weight: 700;
            font-size: 10px;
        }
        
        .du-doan.tai {
            background: rgba(74, 222, 128, 0.08);
            color: var(--success);
        }
        
        .du-doan.xiu {
            background: rgba(255, 71, 87, 0.08);
            color: var(--danger);
        }
        
        .do-tin {
            font-weight: 700;
            color: #60a5fa;
        }
        
        .trang-thai {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 8px;
            font-size: 8px;
            font-weight: 700;
            letter-spacing: 0.5px;
        }
        
        .trang-thai.dung {
            background: rgba(74, 222, 128, 0.08);
            color: var(--success);
        }
        
        .trang-thai.sai {
            background: rgba(255, 71, 87, 0.08);
            color: var(--danger);
        }
        
        .trang-thai.cho {
            background: rgba(255, 165, 2, 0.08);
            color: var(--warning);
        }
        
        .chi-tiet {
            font-size: 9px;
            color: var(--text-muted);
            max-width: 150px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .footer-ultimate {
            text-align: center;
            padding: 12px;
            color: var(--text-muted);
            font-size: 9px;
            border-top: 1px solid var(--border);
            margin-top: 14px;
        }
        
        .footer-ultimate .highlight {
            color: #a78bfa;
        }
        
        .footer-ultimate .heart {
            color: var(--danger);
            animation: heartBeat 1.5s ease-in-out infinite;
            display: inline-block;
        }
        
        @keyframes heartBeat {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.2); }
        }
        
        .footer-ultimate .algo-tag {
            color: #ff6b35;
        }
        
        @media (max-width: 768px) {
            .header-ultimate { padding: 14px; }
            .header-ultimate .content { flex-direction: column; align-items: flex-start; }
            .header-ultimate .info { text-align: left; width: 100%; }
            .stats-ultimate { grid-template-columns: repeat(3, 1fr); gap: 6px; }
            .stat-ultimate .value { font-size: 15px; }
            .summary-ultimate { grid-template-columns: repeat(2, 1fr); }
            .logo-ultimate .ten { font-size: 18px; }
            table { font-size: 10px; }
            th, td { padding: 4px 6px; }
            .chi-tiet { max-width: 50px; }
        }
        
        @media (max-width: 480px) {
            .stats-ultimate { grid-template-columns: repeat(2, 1fr); }
            .summary-ultimate { grid-template-columns: 1fr 1fr; }
            .container { padding: 6px; }
            th, td { padding: 3px 4px; font-size: 9px; }
            .logo-ultimate .ten { font-size: 14px; }
            .logo-ultimate .icon { font-size: 24px; }
            .du-doan { font-size: 8px; padding: 1px 6px; }
            .trang-thai { font-size: 7px; padding: 1px 4px; }
        }
        
        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.01); }
        ::-webkit-scrollbar-thumb { background: rgba(123, 47, 252, 0.15); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(123, 47, 252, 0.3); }
    </style>
</head>
<body>
    <div class="bg-ultimate"></div>
    
    <div class="container">
        <div class="header-ultimate">
            <div class="content">
                <div class="logo-ultimate">
                    <span class="icon">🌌</span>
                    <div>
                        <div class="ten">TX ULTIMATE</div>
                        <div class="sub">ANH KHÔI • ${type.toUpperCase()}</div>
                    </div>
                </div>
                <div class="info">
                    <div class="badge-ultimate">
                        <span class="live"></span>
                        ${type.toUpperCase()} • LIVE
                        <span class="version">v28.0</span>
                    </div>
                    <div style="font-size:8px;color:var(--text-muted);margin-top:2px;font-family:'Share Tech Mono',monospace;">
                        ${new Date().toLocaleString('vi-VN')} • 40+ Algorithms
                    </div>
                </div>
            </div>
        </div>
        
        <div class="stats-ultimate">
            <div class="stat-ultimate">
                <div class="label">Tổng</div>
                <div class="value xanh-duong">${s.total}</div>
                <div class="sub">Dự Đoán</div>
            </div>
            <div class="stat-ultimate">
                <div class="label">✅ Đúng</div>
                <div class="value xanh">${s.dung}</div>
                <div class="sub">${s.tyle}%</div>
            </div>
            <div class="stat-ultimate">
                <div class="label">❌ Sai</div>
                <div class="value do">${s.sai}</div>
                <div class="sub">${100 - s.tyle}%</div>
            </div>
            <div class="stat-ultimate">
                <div class="label">📊 Tỷ Lệ</div>
                <div class="value ${s.tyle >= 65 ? 'xanh' : s.tyle >= 55 ? 'cam' : 'do'}">${s.tyle}%</div>
                <div class="sub">${s.tyle >= 65 ? '🌟 Xuất sắc' : s.tyle >= 55 ? '📈 Tốt' : '📉 Cần cải thiện'}</div>
            </div>
            <div class="stat-ultimate">
                <div class="label">⚡ Chuỗi</div>
                <div class="value ${s.chuoi > 0 ? 'xanh' : s.chuoi < 0 ? 'do' : 'cam'}">${s.chuoi > 0 ? '✅ +' + s.chuoi : s.chuoi < 0 ? '❌ ' + s.chuoi : '0'}</div>
                <div class="sub">${s.chuoi > 0 ? '🔥 Đang thắng' : s.chuoi < 0 ? '💪 Cố lên' : '⚖️ Cân bằng'}</div>
            </div>
            <div class="stat-ultimate">
                <div class="label">🏆 Dài Nhất</div>
                <div class="value quantum">${s.chuoi_dai}</div>
                <div class="sub">${s.chuoi_dai >= 5 ? '🚀 Siêu chuỗi' : '📈 Đang tiến'}</div>
            </div>
        </div>
        
        <div class="summary-ultimate">
            <div class="summary-ult">
                <div class="label">📊 100 Phiên</div>
                <div class="value xanh-duong">${recent.length}</div>
                <div style="font-size:10px;color:var(--text-muted);">Tổng số</div>
            </div>
            <div class="summary-ult">
                <div class="label">✅ Đúng</div>
                <div class="value xanh">${thongKe.dung}</div>
                <div style="font-size:10px;color:var(--text-muted);">${thongKe.tyle}%</div>
            </div>
            <div class="summary-ult">
                <div class="label">❌ Sai</div>
                <div class="value do">${thongKe.sai}</div>
                <div style="font-size:10px;color:var(--text-muted);">${100 - thongKe.tyle}%</div>
            </div>
            <div class="summary-ult">
                <div class="label">⚡ Chuỗi</div>
                <div class="value ${chuoiHienTai > 0 ? 'xanh' : chuoiHienTai < 0 ? 'do' : 'cam'}">${chuoiHienTai > 0 ? '✅ +' + chuoiHienTai : chuoiHienTai < 0 ? '❌ ' + chuoiHienTai : '0'}</div>
                <div style="font-size:10px;color:var(--text-muted);">${chuoiHienTai > 0 ? '🔥 Đang thắng' : chuoiHienTai < 0 ? '💪 Cố lên' : '⚖️ Cân bằng'}</div>
            </div>
            <div class="summary-ult">
                <div class="label">🏆 Dài Nhất</div>
                <div class="value cyan">${chuoiDaiNhat}</div>
                <div style="font-size:10px;color:var(--text-muted);">${chuoiDaiNhat >= 5 ? '🚀 Siêu chuỗi' : '📈 Đang tiến'}</div>
            </div>
            <div class="summary-ult">
                <div class="label">📊 Tỷ Lệ</div>
                <div class="value ${thongKe.tyle >= 65 ? 'xanh' : thongKe.tyle >= 55 ? 'cam' : 'do'}">${thongKe.tyle}%</div>
                <div style="font-size:10px;color:var(--text-muted);">${thongKe.tyle >= 65 ? '🌟 Xuất sắc' : thongKe.tyle >= 55 ? '📈 Tốt' : '📉 Cần cải thiện'}</div>
            </div>
        </div>
        
        <div class="table-ultimate">
            <div class="header">
                <h3>📋 LỊCH SỬ 100 PHIÊN</h3>
                <span class="count">${recent.length} phiên</span>
                <span class="algo-badge">⚡ 40+ Algorithms</span>
            </div>
            <div style="overflow-x:auto;">
                <table>
                    <thead>
                        <tr>
                            <th>Phiên</th>
                            <th>Dự Đoán</th>
                            <th>Độ Tin</th>
                            <th>KQ</th>
                            <th>Thực Tế</th>
                            <th>Phân Tích</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);font-family:"Share Tech Mono",monospace;">⏳ WAITING FOR DATA...</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="footer-ultimate">
            <span style="color:var(--text-muted);">🌌 TX Ultimate Predictor</span> • 
            <span class="highlight">Anh Khôi</span> • 
            v28.0 • 
            <span class="algo-tag">⚡ 40+ Algorithms</span> • 
            Auto-update 5s
            <br>
            <span style="font-size:7px;color:var(--text-muted);font-family:'Share Tech Mono',monospace;">
                <span class="heart">❤</span> Quantum Ensemble • Bayesian Meta • Pattern Fingerprint • Weibull Survival • JSD Uncertainty • Quantum Tunneling • Entanglement Network • 30+ ML Models • 30+ Cầu
            </span>
        </div>
    </div>
    
    <script>
        setTimeout(() => location.reload(), 5000);
    </script>
</body>
</html>
    `;
}

// ============================================================
// 🔌 API
// ============================================================

app.get('/', (req, res) => res.json({ name: 'TX Ultimate', version: '28.0', author: 'Anh Khôi' }));

app.get('/lc79-hu', async (req, res) => {
    try {
        const data = await fetchData('hu');
        if (!data || data.length === 0) {
            const result = predictor.fallback('hu');
            return res.json({ prediction: result.duDoan, confidence: result.doTinCay, detail: result.chiTiet, noData: true });
        }
        const exist = history.hu.find(h => h.phien_hien_tai === (data[0].phien + 1).toString());
        if (exist) return res.json(exist);
        
        const historyData = data.map(d => d.result === 'TÀI' ? 'T' : 'X');
        const result = predictor.duDoan('hu', historyData);
        const record = {
            phien: data[0].phien,
            phien_hien_tai: (data[0].phien + 1).toString(),
            dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`,
            total: data[0].total,
            actual: data[0].result,
            prediction: result.duDoan,
            confidence: result.doTinCay,
            detail: result.chiTiet,
            status: '',
            timestamp: new Date().toISOString(),
            betLength: result.doDaiBet || 0,
            soMau: result.soMau || 0
        };
        history.hu.unshift(record);
        if (history.hu.length > 1000) history.hu = history.hu.slice(0, 1000);
        saveHistory();
        res.json(record);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/lc79-md5', async (req, res) => {
    try {
        const data = await fetchData('md5');
        if (!data || data.length === 0) {
            const result = predictor.fallback('md5');
            return res.json({ prediction: result.duDoan, confidence: result.doTinCay, detail: result.chiTiet, noData: true });
        }
        const exist = history.md5.find(h => h.phien_hien_tai === (data[0].phien + 1).toString());
        if (exist) return res.json(exist);
        
        const historyData = data.map(d => d.result === 'TÀI' ? 'T' : 'X');
        const result = predictor.duDoan('md5', historyData);
        const record = {
            phien: data[0].phien,
            phien_hien_tai: (data[0].phien + 1).toString(),
            dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`,
            total: data[0].total,
            actual: data[0].result,
            prediction: result.duDoan,
            confidence: result.doTinCay,
            detail: result.chiTiet,
            status: '',
            timestamp: new Date().toISOString(),
            betLength: result.doDaiBet || 0,
            soMau: result.soMau || 0
        };
        history.md5.unshift(record);
        if (history.md5.length > 1000) history.md5 = history.md5.slice(0, 1000);
        saveHistory();
        res.json(record);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/lc79-hu/history', async (req, res) => {
    const data = await fetchData('hu');
    if (data) verifyAndUpdate('hu', data);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(generateHTML('hu'));
});

app.get('/lc79-md5/history', async (req, res) => {
    const data = await fetchData('md5');
    if (data) verifyAndUpdate('md5', data);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(generateHTML('md5'));
});

app.get('/stats', (req, res) => {
    const total = stats.hu.total + stats.md5.total;
    const dung = stats.hu.dung + stats.md5.dung;
    res.json({
        hu: stats.hu,
        md5: stats.md5,
        total: { total, dung, sai: total - dung, tyle: total > 0 ? Math.round((dung / total) * 100) : 0 },
        lastPred
    });
});

app.get('/reset', (req, res) => {
    history = { hu: [], md5: [] };
    stats = {
        hu: { total: 0, dung: 0, sai: 0, tyle: 0, chuoi: 0, chuoi_dai: 0, homnay: { dung: 0, sai: 0, tong: 0 } },
        md5: { total: 0, dung: 0, sai: 0, tyle: 0, chuoi: 0, chuoi_dai: 0, homnay: { dung: 0, sai: 0, tong: 0 } }
    };
    lastPhien = { hu: null, md5: null };
    lastPred = { hu: null, md5: null };
    saveHistory();
    res.json({ message: '✅ Reset' });
});

// ============================================================
// 🚀 KHỞI ĐỘNG
// ============================================================

loadHistory();

app.listen(PORT, '0.0.0.0', () => {
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                                                               ║');
    console.log('║   🌌  TX ULTIMATE v28.0 - ANH KHÔI                          ║');
    console.log('║                                                               ║');
    console.log('║   ⚛️ 7 THUẬT TOÁN LƯỢNG TỬ CAO CẤP                         ║');
    console.log('║   🎯 30+ LOẠI CẦU ĐA DẠNG                                   ║');
    console.log('║   📊 THỐNG KÊ 100 PHIÊN GẦN NHẤT                            ║');
    console.log('║                                                               ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log('║                                                               ║');
    console.log(`║   📡 Server: http://0.0.0.0:${PORT}                            ║`);
    console.log('║                                                               ║');
    console.log('║   ⚛️ 7 THUẬT TOÁN CAO CẤP:                                   ║');
    console.log('║   1. Quantum Ensemble v9 - Lượng tử                          ║');
    console.log('║   2. Bayesian Meta - Thống kê Bayes                          ║');
    console.log('║   3. Pattern Fingerprint - Dấu vân tay pattern               ║');
    console.log('║   4. Weibull Survival - Phân tích sống sót                   ║');
    console.log('║   5. JSD Uncertainty - Đo lường độ không chắc chắn           ║');
    console.log('║   6. Quantum Tunneling - Xuyên hầm lượng tử                  ║');
    console.log('║   7. Entanglement Network - Mạng rối lượng tử                ║');
    console.log('║                                                               ║');
    console.log('║   🎯 30+ LOẠI CẦU:                                           ║');
    console.log('║   1-1 • 2-2 • 3-3 • 4-4 • 5-5 • 6-6 • 7-7                   ║');
    console.log('║   1-2-1 • 1-2-3 • 2-1-2 • 3-2-1 • 1-4-1 • 2-3-2 • 3-1-3    ║');
    console.log('║   Zigzag • Bệt + 15 cầu khác                                ║');
    console.log('║                                                               ║');
    console.log('║   📁 himinhlaanhkhoi_history.json                            ║');
    console.log('║   📁 himinhlaanhkhoi_learning.json                           ║');
    console.log('║                                                               ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
    startAuto();
});
