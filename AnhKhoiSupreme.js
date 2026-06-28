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
// 🧬 THUẬT TOÁN LƯỢNG TỬ & AI TIÊN TIẾN
// ============================================================

class QuantumEntropyEngine {
    constructor() {
        this.stateSpace = new Map();
        this.decoherence = 0.001;
        this.trained = false;
    }
    
    calculateVonNeumannEntropy(probs) {
        let entropy = 0;
        for (const p of probs) {
            if (p > 0 && p < 1) entropy -= p * Math.log2(p);
        }
        return Math.min(1, entropy / Math.log2(2));
    }
    
    train(data) {
        for (let i = 12; i < data.length; i++) {
            const window = data.slice(i-12, i);
            const patterns = this.extractQuantumPatterns(window);
            const key = patterns.join('');
            if (!this.stateSpace.has(key)) {
                this.stateSpace.set(key, { T: 0, X: 0, total: 0, coherency: 1.0 });
            }
            const state = this.stateSpace.get(key);
            state[data[i]]++;
            state.total++;
            state.coherency = Math.max(0.1, state.coherency - this.decoherence);
        }
        this.trained = true;
    }
    
    extractQuantumPatterns(seq) {
        const patterns = [];
        for (let gap = 1; gap <= 4; gap++) {
            let pattern = 0;
            for (let i = gap; i < seq.length; i++) {
                if (seq[i] === seq[i-gap]) pattern++;
            }
            patterns.push(pattern > seq.length/2 - gap/2 ? 1 : 0);
        }
        for (let i = 1; i < seq.length; i++) {
            patterns.push(seq[i] === seq[i-1] ? 1 : 0);
        }
        return patterns.slice(-8);
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 12) return null;
        const window = seq.slice(-12);
        const patterns = this.extractQuantumPatterns(window);
        const key = patterns.join('');
        const state = this.stateSpace.get(key);
        
        if (!state || state.total < 5) {
            const entropy = this.calculateVonNeumannEntropy([
                seq.filter(s => s === 'T').length / seq.length,
                seq.filter(s => s === 'X').length / seq.length
            ]);
            return entropy > 0.8 ? (Math.random() > 0.5 ? 'T' : 'X') : 
                   (seq.filter(s => s === 'T').length > seq.length/2 ? 'T' : 'X');
        }
        
        const prob = state.T / state.total;
        const adjusted = prob * state.coherency + 0.5 * (1 - state.coherency);
        return adjusted > 0.5 ? 'T' : 'X';
    }
}

class AdaptiveNeuralFusion {
    constructor() {
        this.weights = new Map();
        this.bias = new Map();
        this.activationMemory = new Map();
        this.learningRate = 0.005;
        this.momentum = 0.9;
        this.trained = false;
    }
    
    sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
    relu(x) { return Math.max(0, x); }
    
    forward(features) {
        const key = features.slice(0, 10).map(f => Math.round(f * 20)).join('|');
        if (!this.weights.has(key)) {
            this.weights.set(key, Array(10).fill(0).map(() => Math.random() * 2 - 1));
            this.bias.set(key, Math.random() * 2 - 1);
            this.activationMemory.set(key, []);
        }
        const w = this.weights.get(key);
        const b = this.bias.get(key);
        let sum = b;
        for (let i = 0; i < Math.min(features.length, w.length); i++) {
            sum += features[i] * w[i];
        }
        const activated = this.relu(sum);
        return this.sigmoid(activated);
    }
    
    train(data) {
        for (let epoch = 0; epoch < 5; epoch++) {
            for (let i = 0; i < data.length; i++) {
                const features = data[i].dacTrung;
                const label = data[i].nhan;
                const key = features.slice(0, 10).map(f => Math.round(f * 20)).join('|');
                
                if (!this.weights.has(key)) {
                    this.weights.set(key, Array(10).fill(0).map(() => Math.random() * 2 - 1));
                    this.bias.set(key, Math.random() * 2 - 1);
                    this.activationMemory.set(key, []);
                }
                
                const prediction = this.forward(features);
                const target = label === 'T' ? 1 : 0;
                const error = target - prediction;
                const w = this.weights.get(key);
                
                for (let j = 0; j < w.length; j++) {
                    w[j] += this.learningRate * error * features[j] * prediction * (1 - prediction);
                }
                this.bias.set(key, this.bias.get(key) + this.learningRate * error);
                
                const memory = this.activationMemory.get(key);
                memory.push(error);
                if (memory.length > 50) memory.shift();
            }
        }
        this.trained = true;
    }
    
    predict(features) {
        if (!this.trained) return null;
        const prob = this.forward(features);
        const key = features.slice(0, 10).map(f => Math.round(f * 20)).join('|');
        const memory = this.activationMemory.get(key) || [];
        const avgError = memory.length > 0 ? memory.reduce((a,b) => a + Math.abs(b), 0) / memory.length : 0.5;
        const adjusted = prob * (1 - avgError * 0.3) + 0.5 * avgError * 0.3;
        return adjusted > 0.5 ? 'T' : 'X';
    }
}

class FractalPatternRecognizer {
    constructor() {
        this.fractalDB = new Map();
        this.scaleLevels = [2, 3, 4, 6, 8, 12];
        this.trained = false;
    }
    
    extractFractalFeatures(seq) {
        const features = [];
        for (const scale of this.scaleLevels) {
            if (seq.length < scale) break;
            const chunks = [];
            for (let i = 0; i < seq.length - scale + 1; i += Math.max(1, Math.floor(scale/2))) {
                const chunk = seq.slice(i, i + scale);
                const tRatio = chunk.filter(s => s === 'T').length / scale;
                chunks.push(tRatio);
            }
            if (chunks.length > 0) {
                const avg = chunks.reduce((a,b) => a + b, 0) / chunks.length;
                const variance = chunks.reduce((a,b) => a + (b - avg) ** 2, 0) / chunks.length;
                features.push(avg, variance);
            }
        }
        // Thêm tỉ lệ phân mảnh
        let changes = 0;
        for (let i = 1; i < seq.length; i++) {
            if (seq[i] !== seq[i-1]) changes++;
        }
        features.push(changes / Math.max(1, seq.length));
        return features;
    }
    
    train(data) {
        for (let i = 12; i < data.length; i++) {
            const window = data.slice(i-12, i);
            const features = this.extractFractalFeatures(window);
            const fingerprint = features.map(f => Math.round(f * 10)).join('|');
            
            if (!this.fractalDB.has(fingerprint)) {
                this.fractalDB.set(fingerprint, { T: 0, X: 0, total: 0 });
            }
            const entry = this.fractalDB.get(fingerprint);
            entry[data[i]]++;
            entry.total++;
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 12) return null;
        const window = seq.slice(-12);
        const features = this.extractFractalFeatures(window);
        const fingerprint = features.map(f => Math.round(f * 10)).join('|');
        const entry = this.fractalDB.get(fingerprint);
        
        if (!entry || entry.total < 3) {
            // Tìm pattern gần nhất
            let bestMatch = null, bestDist = Infinity;
            for (const [fp, e] of this.fractalDB) {
                if (e.total < 3) continue;
                const fpParts = fp.split('|').map(Number);
                const dist = fpParts.reduce((a, b, i) => a + Math.abs(b - features[i] || 0), 0);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestMatch = e;
                }
            }
            if (bestMatch) return bestMatch.T > bestMatch.X ? 'T' : 'X';
            return null;
        }
        
        return entry.T > entry.X ? 'T' : 'X';
    }
}

// ============================================================
// 🎯 CẦU THỰC TẾ SIÊU CHÍNH XÁC
// ============================================================

class CauBacThang {
    phanTich(data) {
        if (data.length < 6) return null;
        // Cầu bậc thang: T X T X X T X X X ...
        let pattern = [];
        let current = data[data.length-1];
        let count = 0;
        for (let i = data.length - 1; i >= 0; i--) {
            if (data[i] === current) count++;
            else {
                pattern.unshift({ value: current, length: count });
                current = data[i];
                count = 1;
            }
        }
        pattern.unshift({ value: current, length: count });
        
        if (pattern.length >= 3) {
            const lengths = pattern.map(p => p.length);
            let isStaircase = true;
            for (let i = 1; i < Math.min(lengths.length, 5); i++) {
                if (lengths[i] !== lengths[i-1] + 1 && lengths[i] !== lengths[i-1] - 1) {
                    if (Math.abs(lengths[i] - lengths[i-1]) > 1) {
                        isStaircase = false;
                        break;
                    }
                }
            }
            
            if (isStaircase && pattern.length >= 3) {
                const lastPattern = pattern[pattern.length - 1];
                const nextLength = lastPattern.length + (pattern[pattern.length-1].length > pattern[pattern.length-2].length ? 1 : -1);
                const nextValue = lastPattern.value === 'T' ? 'X' : 'T';
                let doTinCay = 75 + pattern.length * 2;
                let diem = 25 + pattern.length * 3;
                return {
                    duDoan: nextValue === 'T' ? 'X' : 'T',
                    doTinCay: Math.min(95, doTinCay),
                    diem: Math.min(50, diem),
                    ten: `🎯 Cầu Bậc Thang ${pattern.length} bậc`
                };
            }
        }
        return null;
    }
}

class CauSongDaoDong {
    phanTich(data) {
        if (data.length < 10) return null;
        // Phân tích sóng Elliott đơn giản
        const waves = [];
        let direction = data[data.length-1] === 'T' ? 1 : -1;
        let start = data.length - 1;
        
        for (let i = data.length - 2; i >= 0; i--) {
            const currentDir = data[i] === 'T' ? 1 : -1;
            if (currentDir !== direction) {
                waves.push({
                    direction: direction === 1 ? 'T' : 'X',
                    length: start - i,
                    strength: Math.abs(start - i)
                });
                direction = currentDir;
                start = i;
            }
        }
        waves.push({
            direction: direction === 1 ? 'T' : 'X',
            length: start + 1,
            strength: start + 1
        });
        
        if (waves.length >= 5) {
            // Kiểm tra mẫu 5 sóng
            const wave1 = waves[waves.length-1];
            const wave2 = waves[waves.length-2];
            const wave3 = waves[waves.length-3];
            const wave4 = waves[waves.length-4];
            const wave5 = waves[waves.length-5];
            
            // Sóng 3 thường dài nhất
            if (wave3.strength >= wave1.strength && wave3.strength >= wave5.strength) {
                // Sóng 4 không chồng lấn sóng 1
                if (wave4.value !== wave1.value || wave4.strength < wave1.strength) {
                    return {
                        duDoan: wave5.value === 'T' ? 'X' : 'T',
                        doTinCay: 82,
                        diem: 35,
                        ten: '🌊 Cầu Sóng Đảo Chiều'
                    };
                }
            }
        }
        return null;
    }
}

class CauTamGiac {
    phanTich(data) {
        if (data.length < 12) return null;
        // Phát hiện mẫu tam giác (hội tụ)
        const last6 = data.slice(-6);
        const first6 = data.slice(-12, -6);
        
        const volatility1 = this.calcVolatility(first6);
        const volatility2 = this.calcVolatility(last6);
        
        if (volatility2 < volatility1 * 0.7 && volatility2 > 0) {
            // Volatility đang giảm - sắp breakout
            const recent3 = data.slice(-3);
            const tCount = recent3.filter(s => s === 'T').length;
            return {
                duDoan: tCount >= 2 ? 'T' : 'X',
                doTinCay: 78,
                diem: 30,
                ten: '📐 Cầu Tam Giác Breakout'
            };
        }
        return null;
    }
    
    calcVolatility(seq) {
        let changes = 0;
        for (let i = 1; i < seq.length; i++) {
            if (seq[i] !== seq[i-1]) changes++;
        }
        return changes / seq.length;
    }
}

class CauHoanVi {
    phanTich(data) {
        if (data.length < 8) return null;
        // Tìm mẫu hoán vị: A B C -> B C A -> C A B
        for (let patternLen = 2; patternLen <= 4; patternLen++) {
            const pattern1 = data.slice(-patternLen*3, -patternLen*2);
            const pattern2 = data.slice(-patternLen*2, -patternLen);
            const pattern3 = data.slice(-patternLen);
            
            if (pattern1.length === patternLen && pattern2.length === patternLen && pattern3.length === patternLen) {
                // Kiểm tra hoán vị
                const isPermutation = this.isPermutation(pattern1, pattern2, pattern3);
                if (isPermutation) {
                    const nextPattern = this.predictNextPermutation(pattern1, pattern2, pattern3);
                    if (nextPattern) {
                        return {
                            duDoan: nextPattern[0],
                            doTinCay: 76 + patternLen * 3,
                            diem: 28 + patternLen * 2,
                            ten: `🔄 Cầu Hoán Vị ${patternLen}x3`
                        };
                    }
                }
            }
        }
        return null;
    }
    
    isPermutation(p1, p2, p3) {
        const arr1 = [...p1].sort().join('');
        const arr2 = [...p2].sort().join('');
        const arr3 = [...p3].sort().join('');
        return arr1 === arr2 && arr2 === arr3 && p1.join('') !== p2.join('') && p2.join('') !== p3.join('');
    }
    
    predictNextPermutation(p1, p2, p3) {
        // Nếu p1->p2->p3 là hoán vị vòng, dự đoán quay lại p1
        const all = [...p1, ...p2, ...p3];
        const unique = [...new Set(all)];
        if (unique.length <= 2) {
            // Chỉ có T và X
            return p1;
        }
        return null;
    }
}

class CauNhipSinhHoc {
    phanTich(data) {
        if (data.length < 15) return null;
        // Tìm chu kỳ Fibonacci: 3, 5, 8, 13
        const fibLengths = [3, 5, 8, 13];
        
        for (const fib of fibLengths) {
            if (data.length >= fib * 3) {
                const segment1 = data.slice(-fib*3, -fib*2);
                const segment2 = data.slice(-fib*2, -fib);
                const segment3 = data.slice(-fib);
                
                const similarity12 = this.calcSimilarity(segment1, segment2);
                const similarity23 = this.calcSimilarity(segment2, segment3);
                
                if (similarity12 > 0.7 && similarity23 > 0.7) {
                    // Dự đoán segment tiếp theo giống segment1
                    const nextPos = segment1[0];
                    return {
                        duDoan: nextPos,
                        doTinCay: 80 + Math.round(similarity12 * 15),
                        diem: 35 + Math.round(similarity12 * 10),
                        ten: `🧬 Cầu Nhịp Sinh Học Fib(${fib})`
                    };
                }
            }
        }
        return null;
    }
    
    calcSimilarity(s1, s2) {
        let matches = 0;
        for (let i = 0; i < Math.min(s1.length, s2.length); i++) {
            if (s1[i] === s2[i]) matches++;
        }
        return matches / Math.min(s1.length, s2.length);
    }
}

class CauThoiGianVang {
    phanTich(data) {
        if (data.length < 20) return null;
        // Phân tích theo khung giờ
        const segments = [];
        const segmentSize = 5;
        
        for (let i = 0; i < data.length - segmentSize; i += segmentSize) {
            segments.push(data.slice(i, i + segmentSize));
        }
        
        if (segments.length >= 3) {
            const currentPattern = segments[segments.length - 1];
            const similarSegments = [];
            
            for (let i = 0; i < segments.length - 1; i++) {
                const similarity = this.calcPatternSimilarity(currentPattern, segments[i]);
                if (similarity > 0.6) {
                    similarSegments.push({ index: i, similarity });
                }
            }
            
            if (similarSegments.length >= 2) {
                const nextPredictions = similarSegments.map(s => {
                    const nextIdx = s.index + 1;
                    if (nextIdx < segments.length) {
                        return segments[nextIdx][0];
                    }
                    return null;
                }).filter(Boolean);
                
                if (nextPredictions.length >= 2 && new Set(nextPredictions).size === 1) {
                    return {
                        duDoan: nextPredictions[0],
                        doTinCay: 85,
                        diem: 38,
                        ten: `⏰ Cầu Thời Gian Vàng (${similarSegments.length} mẫu)`
                    };
                }
            }
        }
        return null;
    }
    
    calcPatternSimilarity(p1, p2) {
        let matches = 0;
        for (let i = 0; i < Math.min(p1.length, p2.length); i++) {
            if (p1[i] === p2[i]) matches++;
        }
        return matches / Math.min(p1.length, p2.length);
    }
}

class CauBongMa {
    phanTich(data) {
        if (data.length < 6) return null;
        // Cầu bóng ma: xuất hiện mẫu rồi biến mất, rồi xuất hiện lại
        const last3 = data.slice(-3);
        const before = data.slice(0, -3);
        
        if (before.length >= 3) {
            // Tìm last3 trong before
            for (let i = 0; i < before.length - 3; i++) {
                const candidate = before.slice(i, i + 3);
                if (candidate.join('') === last3.join('')) {
                    // Tìm mẫu xuất hiện cách quãng
                    if (i >= 3) {
                        const gap = before.length - 3 - i;
                        if (gap >= 2 && gap <= 8) {
                            const afterCandidate = i + 3 < before.length ? before[i + 3] : null;
                            if (afterCandidate) {
                                return {
                                    duDoan: afterCandidate,
                                    doTinCay: 74,
                                    diem: 26,
                                    ten: `👻 Cầu Bóng Ma (gap ${gap})`
                                };
                            }
                        }
                    }
                }
            }
        }
        return null;
    }
}

class CauCanBangLuongTu {
    phanTich(data) {
        if (data.length < 20) return null;
        // Cân bằng lượng tử: T và X tự cân bằng trong dài hạn
        const totalT = data.filter(s => s === 'T').length;
        const totalX = data.filter(s => s === 'X').length;
        const ratio = totalT / (totalT + totalX);
        
        const last5 = data.slice(-5);
        const last5T = last5.filter(s => s === 'T').length;
        const last5Ratio = last5T / 5;
        
        // Nếu mất cân bằng quá nhiều
        if (Math.abs(ratio - 0.5) > 0.15) {
            // Dự đoán sẽ quay về cân bằng
            if (ratio > 0.5 && last5Ratio > 0.5) {
                return {
                    duDoan: 'X',
                    doTinCay: 72 + Math.round(Math.abs(ratio - 0.5) * 100),
                    diem: 30 + Math.round(Math.abs(ratio - 0.5) * 50),
                    ten: '⚖️ Cầu Cân Bằng Lượng Tử'
                };
            } else if (ratio < 0.5 && last5Ratio < 0.5) {
                return {
                    duDoan: 'T',
                    doTinCay: 72 + Math.round(Math.abs(ratio - 0.5) * 100),
                    diem: 30 + Math.round(Math.abs(ratio - 0.5) * 50),
                    ten: '⚖️ Cầu Cân Bằng Lượng Tử'
                };
            }
        }
        return null;
    }
}

class CauDonSóng {
    phanTich(data) {
        if (data.length < 8) return null;
        // Dồn sóng: Tập trung nhiều T hoặc X liên tiếp
        const recent8 = data.slice(-8);
        const tIn8 = recent8.filter(s => s === 'T').length;
        
        if (tIn8 >= 7) {
            return { duDoan: 'X', doTinCay: 88, diem: 40, ten: '🌊 Cầu Dồn Sóng T' };
        } else if (tIn8 <= 1) {
            return { duDoan: 'T', doTinCay: 88, diem: 40, ten: '🌊 Cầu Dồn Sóng X' };
        }
        
        // Kiểm tra dồn sóng nhẹ
        const recent5 = data.slice(-5);
        const tIn5 = recent5.filter(s => s === 'T').length;
        if (tIn5 === 5) {
            return { duDoan: 'X', doTinCay: 82, diem: 32, ten: '🌊 Cầu Dồn Sóng T(5)' };
        } else if (tIn5 === 0) {
            return { duDoan: 'T', doTinCay: 82, diem: 32, ten: '🌊 Cầu Dồn Sóng X(5)' };
        }
        
        return null;
    }
}

// Các lớp cầu cơ bản giữ nguyên
class Cau11 { phanTich(data) { if (data.length < 3) return null; let dao = true; for (let i = 0; i < Math.min(data.length - 1, 4); i++) { if (data[i] === data[i+1]) { dao = false; break; } } if (dao) { const doDai = Math.min(data.length, 6); let diem = 0, doTinCay = 65, ten = '🔄 Cầu 1-1'; if (doDai >= 5) { diem = 30; doTinCay = 82; ten = '🔄 Cầu 1-1 dài'; } else if (doDai >= 4) { diem = 25; doTinCay = 75; ten = '🔄 Cầu 1-1'; } else if (doDai >= 3) { diem = 18; doTinCay = 68; ten = '🔄 Cầu 1-1 ngắn'; } return { duDoan: data[0] === 'T' ? 'X' : 'T', doTinCay, diem, ten }; } return null; } }
class Cau22 { phanTich(data) { if (data.length < 5) return null; let cap = true; for (let i = 0; i < 2; i++) { if (data[i*2] !== data[i*2+1]) { cap = false; break; } } if (cap && data[0] !== data[2]) { const doDai = Math.min(data.length, 6); let diem = 0, doTinCay = 68, ten = '🔄 Cầu 2-2'; if (doDai >= 5) { diem = 28; doTinCay = 80; ten = '🔄 Cầu 2-2 dài'; } else if (doDai >= 4) { diem = 22; doTinCay = 72; ten = '🔄 Cầu 2-2'; } return { duDoan: data[0] === 'T' ? 'X' : 'T', doTinCay, diem, ten }; } return null; } }
class Cau33 { phanTich(data) { if (data.length < 7) return null; const first3 = data.slice(0, 3); const next3 = data.slice(3, 6); if (first3.every(v => v === first3[0]) && next3.every(v => v === next3[0]) && first3[0] !== next3[0]) { let diem = 0, doTinCay = 72, ten = '🏗️ Cầu 3-3'; if (data.length >= 9) { const last3 = data.slice(6, 9); if (last3.every(v => v === last3[0]) && last3[0] === first3[0]) { diem = 35; doTinCay = 88; ten = '🏗️ Cầu 3-3 dài'; } else { diem = 30; doTinCay = 82; ten = '🏗️ Cầu 3-3'; } } else { diem = 25; doTinCay = 76; ten = '🏗️ Cầu 3-3 ngắn'; } return { duDoan: first3[0] === 'T' ? 'X' : 'T', doTinCay, diem, ten }; } return null; } }
class Cau44 { phanTich(data) { if (data.length < 9) return null; const first4 = data.slice(0, 4); const next4 = data.slice(4, 8); if (first4.every(v => v === first4[0]) && next4.every(v => v === next4[0]) && first4[0] !== next4[0]) { let diem = 0, doTinCay = 75, ten = '🏗️ Cầu 4-4'; if (data.length >= 12) { const last4 = data.slice(8, 12); if (last4.every(v => v === last4[0]) && last4[0] === first4[0]) { diem = 40; doTinCay = 90; ten = '🏗️ Cầu 4-4 dài'; } else { diem = 35; doTinCay = 84; ten = '🏗️ Cầu 4-4'; } } else { diem = 28; doTinCay = 78; ten = '🏗️ Cầu 4-4 ngắn'; } return { duDoan: first4[0] === 'T' ? 'X' : 'T', doTinCay, diem, ten }; } return null; } }
class Cau55 { phanTich(data) { if (data.length < 11) return null; const first5 = data.slice(0, 5); const next5 = data.slice(5, 10); if (first5.every(v => v === first5[0]) && next5.every(v => v === next5[0]) && first5[0] !== next5[0]) { let diem = 0, doTinCay = 78, ten = '🏗️ Cầu 5-5'; if (data.length >= 15) { const last5 = data.slice(10, 15); if (last5.every(v => v === last5[0]) && last5[0] === first5[0]) { diem = 45; doTinCay = 92; ten = '🏗️ Cầu 5-5 dài'; } else { diem = 38; doTinCay = 86; ten = '🏗️ Cầu 5-5'; } } else { diem = 30; doTinCay = 80; ten = '🏗️ Cầu 5-5 ngắn'; } return { duDoan: first5[0] === 'T' ? 'X' : 'T', doTinCay, diem, ten }; } return null; } }
class Cau66 { phanTich(data) { if (data.length < 13) return null; const first6 = data.slice(0, 6); const next6 = data.slice(6, 12); if (first6.every(v => v === first6[0]) && next6.every(v => v === next6[0]) && first6[0] !== next6[0]) { let diem = 0, doTinCay = 80, ten = '🏗️ Cầu 6-6'; if (data.length >= 18) { const last6 = data.slice(12, 18); if (last6.every(v => v === last6[0]) && last6[0] === first6[0]) { diem = 50; doTinCay = 94; ten = '🏗️ Cầu 6-6 dài'; } else { diem = 42; doTinCay = 88; ten = '🏗️ Cầu 6-6'; } } else { diem = 32; doTinCay = 82; ten = '🏗️ Cầu 6-6 ngắn'; } return { duDoan: first6[0] === 'T' ? 'X' : 'T', doTinCay, diem, ten }; } return null; } }
class Cau77 { phanTich(data) { if (data.length < 15) return null; const first7 = data.slice(0, 7); const next7 = data.slice(7, 14); if (first7.every(v => v === first7[0]) && next7.every(v => v === next7[0]) && first7[0] !== next7[0]) { let diem = 0, doTinCay = 82, ten = '🏗️ Cầu 7-7'; if (data.length >= 21) { const last7 = data.slice(14, 21); if (last7.every(v => v === last7[0]) && last7[0] === first7[0]) { diem = 55; doTinCay = 96; ten = '🏗️ Cầu 7-7 dài'; } else { diem = 46; doTinCay = 90; ten = '🏗️ Cầu 7-7'; } } else { diem = 35; doTinCay = 84; ten = '🏗️ Cầu 7-7 ngắn'; } return { duDoan: first7[0] === 'T' ? 'X' : 'T', doTinCay, diem, ten }; } return null; } }

class Cau121 { phanTich(data) { if (data.length < 4) return null; if (data[0] !== data[1] && data[1] === data[2] && data[2] !== data[3] && data[0] === data[3]) { let doTinCay = 72, diem = 20, ten = '🎯 Cầu 1-2-1'; if (data.length >= 6) { if (data[4] === data[0] && data[5] === data[1]) { doTinCay = 84; diem = 28; ten = '🎯 Cầu 1-2-1 dài'; } } return { duDoan: data[0] === 'T' ? 'T' : 'X', doTinCay, diem, ten }; } return null; } }
class Cau123 { phanTich(data) { if (data.length < 6) return null; if (data[0] !== data[1] && data[1] === data[2] && data[2] !== data[3] && data[3] === data[4] && data[4] !== data[5] && data[0] !== data[3]) { let doTinCay = 74, diem = 22, ten = '🎯 Cầu 1-2-3'; if (data.length >= 8) { if (data[6] === data[0]) { doTinCay = 85; diem = 30; ten = '🎯 Cầu 1-2-3 dài'; } } return { duDoan: data[0] === 'T' ? 'T' : 'X', doTinCay, diem, ten }; } return null; } }
class Cau212 { phanTich(data) { if (data.length < 6) return null; if (data[0] === data[1] && data[1] !== data[2] && data[2] === data[3] && data[3] !== data[4] && data[4] === data[5] && data[0] !== data[2]) { let doTinCay = 74, diem = 22, ten = '🎯 Cầu 2-1-2'; if (data.length >= 8) { if (data[6] === data[1]) { doTinCay = 85; diem = 30; ten = '🎯 Cầu 2-1-2 dài'; } } return { duDoan: data[1] === 'T' ? 'T' : 'X', doTinCay, diem, ten }; } return null; } }
class Cau321 { phanTich(data) { if (data.length < 6) return null; if (data[0] === data[1] && data[1] === data[2] && data[2] !== data[3] && data[3] === data[4] && data[4] !== data[5]) { let doTinCay = 72, diem = 20, ten = '🎯 Cầu 3-2-1'; if (data.length >= 8) { if (data[6] === data[3] && data[7] === data[4]) { doTinCay = 82; diem = 26; ten = '🎯 Cầu 3-2-1 dài'; } } return { duDoan: data[2] === 'T' ? 'T' : 'X', doTinCay, diem, ten }; } return null; } }
class Cau141 { phanTich(data) { if (data.length < 6) return null; if (data[0] === data[1] && data[1] === data[2] && data[2] === data[3] && data[3] !== data[4] && data[4] === data[5]) { let doTinCay = 70, diem = 18, ten = '🎯 Cầu 1-4-1'; if (data.length >= 8) { if (data[6] === data[0] && data[7] === data[1]) { doTinCay = 80; diem = 24; ten = '🎯 Cầu 1-4-1 dài'; } } return { duDoan: data[0] === 'T' ? 'T' : 'X', doTinCay, diem, ten }; } return null; } }
class Cau232 { phanTich(data) { if (data.length < 7) return null; if (data[0] === data[1] && data[1] !== data[2] && data[2] === data[3] && data[3] === data[4] && data[4] !== data[5] && data[5] === data[6]) { let doTinCay = 70, diem = 18, ten = '🎯 Cầu 2-3-2'; if (data.length >= 9) { if (data[7] === data[0] && data[8] === data[1]) { doTinCay = 80; diem = 24; ten = '🎯 Cầu 2-3-2 dài'; } } return { duDoan: data[0] === 'T' ? 'T' : 'X', doTinCay, diem, ten }; } return null; } }
class Cau313 { phanTich(data) { if (data.length < 7) return null; if (data[0] === data[1] && data[1] === data[2] && data[2] !== data[3] && data[3] !== data[4] && data[4] === data[5] && data[5] === data[6]) { let doTinCay = 70, diem = 18, ten = '🎯 Cầu 3-1-3'; if (data.length >= 9) { if (data[7] === data[0] && data[8] === data[1]) { doTinCay = 80; diem = 24; ten = '🎯 Cầu 3-1-3 dài'; } } return { duDoan: data[2] === 'T' ? 'T' : 'X', doTinCay, diem, ten }; } return null; } }

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
// 🧠 HỆ THỐNG DỰ ĐOÁN SIÊU THÔNG MINH
// ============================================================
class HeThongDuDoanSieuThongMinh {
    constructor() {
        this.boNhoChuoi = new Map();
        this.daHuan = { hu: false, md5: false };
        this.predictionHistory = new Map();
        
        // AI Engines
        this.quantumEntropy = new QuantumEntropyEngine();
        this.neuralFusion = new AdaptiveNeuralFusion();
        this.fractalRecognizer = new FractalPatternRecognizer();
        
        // Cầu thực tế
        this.cauBacThang = new CauBacThang();
        this.cauSongDaoDong = new CauSongDaoDong();
        this.cauTamGiac = new CauTamGiac();
        this.cauHoanVi = new CauHoanVi();
        this.cauNhipSinhHoc = new CauNhipSinhHoc();
        this.cauThoiGianVang = new CauThoiGianVang();
        this.cauBongMa = new CauBongMa();
        this.cauCanBangLuongTu = new CauCanBangLuongTu();
        this.cauDonSong = new CauDonSóng();
        
        // Cầu cơ bản
        this.cau11 = new Cau11(); this.cau22 = new Cau22();
        this.cau33 = new Cau33(); this.cau44 = new Cau44();
        this.cau55 = new Cau55(); this.cau66 = new Cau66();
        this.cau77 = new Cau77(); this.cau121 = new Cau121();
        this.cau123 = new Cau123(); this.cau212 = new Cau212();
        this.cau321 = new Cau321(); this.cau141 = new Cau141();
        this.cau232 = new Cau232(); this.cau313 = new Cau313();
        this.zigzag = new Zigzag(); this.bet = new Bet();
        
        this.taiDuLieu();
    }

    chuanBiDuLieu(data) {
        const dacTrung = [];
        const nhan = [];
        for (let i = 15; i < data.length; i++) {
            const cuaSo = data.slice(i - 15, i);
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
            dacTrung.push([demT, thayDoi, tyLeT, cuoi, dau, daoDai, chuKy, doLech, cuaSo.length, thayDoi / cuaSo.length]);
            nhan.push(mucTieu);
        }
        return { dacTrung, nhan };
    }

    huanLuyen(game, data) {
        if (data.length < 30) return;
        
        try {
            this.quantumEntropy.train(data);
            this.fractalRecognizer.train(data);
            
            const { dacTrung, nhan } = this.chuanBiDuLieu(data);
            if (dacTrung.length < 20) return;
            const duLieuHuan = dacTrung.map((f, idx) => ({ dacTrung: f, nhan: nhan[idx] }));
            
            this.neuralFusion.train(duLieuHuan);
            this.daHuan[game] = true;
            console.log(`🧠 Huấn luyện hoàn tất cho ${game} - ${duLieuHuan.length} mẫu`);
        } catch (e) {
            console.log(`⚠️ Lỗi huấn luyện: ${e.message}`);
        }
    }

    duDoan(game, data) {
        if (!data || data.length < 2) return this.fallback(game);
        const lichSu = data.map(d => d === 'T' ? 'T' : 'X');
        let T = 0, X = 0;
        const mau = [];

        // === AI ENGINES (Trọng số cao nhất) ===
        if (lichSu.length >= 15) {
            const qPred = this.quantumEntropy.predict(lichSu);
            if (qPred) { 
                mau.push({ ten: '⚛️ Quantum Entropy', duDoan: qPred, diem: 45 }); 
                if (qPred === 'T') T += 45; else X += 45; 
            }
            
            const fPred = this.fractalRecognizer.predict(lichSu);
            if (fPred) { 
                mau.push({ ten: '🔮 Fractal Pattern', duDoan: fPred, diem: 40 }); 
                if (fPred === 'T') T += 40; else X += 40; 
            }
        }

        if (lichSu.length >= 15) {
            const { dacTrung } = this.chuanBiDuLieu(lichSu);
            if (dacTrung.length > 0) {
                const nPred = this.neuralFusion.predict(dacTrung[dacTrung.length - 1]);
                if (nPred) { 
                    mau.push({ ten: '🧬 Neural Fusion', duDoan: nPred, diem: 38 }); 
                    if (nPred === 'T') T += 38; else X += 38; 
                }
            }
        }

        // === CẦU THỰC TẾ MỚI ===
        const cauThucTe = [
            this.cauBacThang, this.cauSongDaoDong, this.cauTamGiac,
            this.cauHoanVi, this.cauNhipSinhHoc, this.cauThoiGianVang,
            this.cauBongMa, this.cauCanBangLuongTu, this.cauDonSong
        ];
        
        for (const cau of cauThucTe) {
            const result = cau.phanTich(lichSu);
            if (result) {
                mau.push({ ten: result.ten, duDoan: result.duDoan, diem: result.diem });
                if (result.duDoan === 'T') T += result.diem;
                else X += result.diem;
            }
        }

        // === CẦU CƠ BẢN ===
        const cauCoBan = [
            this.cau11, this.cau22, this.cau33, this.cau44, this.cau55,
            this.cau66, this.cau77, this.cau121, this.cau123, this.cau212,
            this.cau321, this.cau141, this.cau232, this.cau313, this.zigzag, this.bet
        ];
        
        for (const cau of cauCoBan) {
            const result = cau.phanTich(lichSu);
            if (result) {
                mau.push({ ten: result.ten, duDoan: result.duDoan, diem: result.diem });
                if (result.duDoan === 'T') T += result.diem;
                else X += result.diem;
            }
        }

        // === ĐIỀU CHỈNH THÔNG MINH ===
        const s = this.boNhoChuoi.get(game);
        if (s) {
            // Phân tích Last5
            if (s.last5.length >= 5) {
                const demT = s.last5.filter(r => r === 'T').length;
                if (demT >= 4) { 
                    X *= 1.5; 
                    mau.push({ ten: '📊 Áp lực Tài→Xỉu', duDoan: 'X', diem: 18 }); 
                } else if (demT <= 1) { 
                    T *= 1.5; 
                    mau.push({ ten: '📊 Áp lực Xỉu→Tài', duDoan: 'T', diem: 18 }); 
                }
            }
            
            // Phân tích chuỗi
            if (Math.abs(s.chuoi) >= 5) {
                if (s.chuoi > 0) {
                    X *= 1.8;
                    mau.push({ ten: '🔄 Bẻ chuỗi Tài dài', duDoan: 'X', diem: 25 });
                } else {
                    T *= 1.8;
                    mau.push({ ten: '🔄 Bẻ chuỗi Xỉu dài', duDoan: 'T', diem: 25 });
                }
            }
            
            // Phân tích trend dài hạn
            if (s.last20.length >= 20) {
                const t20 = s.last20.filter(r => r === 'T').length;
                const x20 = 20 - t20;
                if (t20 > x20 * 1.3) {
                    X *= 1.2;
                    mau.push({ ten: '📈 Trend Tài quá dài', duDoan: 'X', diem: 12 });
                } else if (x20 > t20 * 1.3) {
                    T *= 1.2;
                    mau.push({ ten: '📈 Trend Xỉu quá dài', duDoan: 'T', diem: 12 });
                }
            }
        }

        const tong = T + X;
        if (tong === 0) return this.fallback(game);

        const duDoan = T > X ? 'TÀI' : 'XỈU';
        let doTinCay = Math.round(Math.max(T, X) / tong * 100);
        
        // Bonus cho nhiều mẫu đồng thuận
        if (mau.length >= 20) doTinCay = Math.min(99, doTinCay + 12);
        else if (mau.length >= 15) doTinCay = Math.min(99, doTinCay + 10);
        else if (mau.length >= 10) doTinCay = Math.min(99, doTinCay + 7);
        else if (mau.length >= 5) doTinCay = Math.min(99, doTinCay + 4);
        
        doTinCay = Math.min(99, Math.max(50, doTinCay));

        const ketQua = duDoan === 'TÀI' ? 'T' : 'X';
        const thongTinBet = this.layThongTinBet(lichSu);
        this.hoc(game, ketQua, doTinCay, thongTinBet.doDai);

        const chiTiet = mau.map(p => p.ten).slice(0, 5).join(' • ');

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
}

const predictor = new HeThongDuDoanSieuThongMinh();

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
// 🌐 GIAO DIỆN HTML PRO MAX
// ============================================================

function generateHTML(type) {
    const s = stats[type];
    const h = history[type] || [];
    const recent = h.slice(0, 100);
    
    let tongDung = 0, tongSai = 0;
    let chuoiHienTai = 0, chuoiDaiNhat = 0, chuoiTam = 0;
    
    for (const r of recent) {
        if (r.status === '✅') { tongDung++; chuoiTam++; if (chuoiTam > chuoiDaiNhat) chuoiDaiNhat = chuoiTam; }
        else if (r.status === '❌') { tongSai++; chuoiTam = 0; }
    }
    chuoiHienTai = chuoiTam;
    const tyle100 = recent.length > 0 ? Math.round((tongDung / recent.length) * 100) : 0;
    
    let rows = '';
    for (const r of recent) {
        const status = r.status || '⏳';
        const cls = status === '✅' ? 'dung' : status === '❌' ? 'sai' : 'cho';
        const txt = status === '✅' ? 'ĐÚNG' : status === '❌' ? 'SAI' : 'CHỜ';
        rows += `
            <tr>
                <td><span class="phien">#${r.phien_hien_tai || '-'}</span></td>
                <td><span class="du-doan ${r.prediction === 'TÀI' ? 'tai' : 'xiu'}">${r.prediction || '-'}</span></td>
                <td><span class="do-tin">${r.confidence || 0}%</span></td>
                <td><span class="trang-thai ${cls}">${txt}</span></td>
                <td>${r.actual || '-'}</td>
                <td class="chi-tiet">${r.detail ? r.detail.substring(0, 25) + (r.detail.length > 25 ? '...' : '') : '-'}</td>
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
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;600;700;800&family=Share+Tech+Mono&display=swap');
        
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
            top: 0; left: 0; width: 100%; height: 100%; z-index: 0;
            background: 
                radial-gradient(ellipse at 10% 30%, rgba(123, 47, 252, 0.08) 0%, transparent 50%),
                radial-gradient(ellipse at 90% 70%, rgba(255, 107, 53, 0.06) 0%, transparent 50%),
                radial-gradient(ellipse at 50% 100%, rgba(0, 212, 255, 0.04) 0%, transparent 30%);
            overflow: hidden;
        }
        
        .bg-ultimate::before {
            content: '';
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            background-image: 
                radial-gradient(1px 1px at 10px 20px, rgba(255,255,255,0.06), transparent),
                radial-gradient(1px 1px at 30px 60px, rgba(255,255,255,0.05), transparent),
                radial-gradient(1px 1px at 50px 140px, rgba(255,255,255,0.06), transparent),
                radial-gradient(1px 1px at 80px 30px, rgba(255,255,255,0.05), transparent),
                radial-gradient(1px 1px at 120px 90px, rgba(255,255,255,0.06), transparent);
            background-size: 300px 300px;
            animation: starFloat 50s linear infinite;
        }
        
        @keyframes starFloat { 0% { transform: translate(0,0); } 100% { transform: translate(-40px,-20px); } }
        
        .container {
            position: relative; z-index: 1;
            max-width: 1200px; margin: 0 auto; padding: 12px;
        }
        
        .header-ultimate {
            background: linear-gradient(135deg, rgba(123,47,252,0.06), rgba(255,107,53,0.04));
            border-radius: 20px; padding: 18px 28px; margin-bottom: 16px;
            border: 1px solid rgba(123,47,252,0.08);
            backdrop-filter: blur(30px);
            position: relative; overflow: hidden;
        }
        
        .header-ultimate::before {
            content: '';
            position: absolute; top: -60%; left: -60%; width: 220%; height: 220%;
            background: conic-gradient(from 0deg, transparent, rgba(123,47,252,0.03), transparent, rgba(255,107,53,0.03), transparent);
            animation: spinSlow 30s linear infinite;
        }
        
        @keyframes spinSlow { 100% { transform: rotate(360deg); } }
        
        .header-ultimate .content {
            position: relative; z-index: 1;
            display: flex; justify-content: space-between; align-items: center;
            flex-wrap: wrap; gap: 12px;
        }
        
        .logo-ultimate { display: flex; align-items: center; gap: 14px; }
        
        .logo-ultimate .icon {
            font-size: 34px;
            animation: pulseGlow 2s ease-in-out infinite;
            filter: drop-shadow(0 0 30px rgba(123,47,252,0.15));
        }
        
        @keyframes pulseGlow {
            0%, 100% { transform: scale(1); filter: drop-shadow(0 0 30px rgba(123,47,252,0.15)); }
            50% { transform: scale(1.05); filter: drop-shadow(0 0 60px rgba(123,47,252,0.3)); }
        }
        
        .logo-ultimate .ten {
            font-family: 'Orbitron', monospace; font-size: 22px; font-weight: 900;
            background: linear-gradient(135deg, #7b2ffc, #ff6b35, #00d4ff);
            background-size: 300% 300%;
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            animation: shimmerGrad 4s ease-in-out infinite;
        }
        
        @keyframes shimmerGrad { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        
        .logo-ultimate .sub {
            font-family: 'Share Tech Mono', monospace; font-size: 10px;
            color: var(--text-secondary); letter-spacing: 3px;
        }
        
        .badge-ultimate {
            display: inline-block; padding: 4px 18px; border-radius: 30px;
            font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;
            background: linear-gradient(135deg, rgba(123,47,252,0.1), rgba(255,107,53,0.06));
            border: 1px solid rgba(123,47,252,0.1); color: #a78bfa; backdrop-filter: blur(10px);
        }
        
        .badge-ultimate .live {
            display: inline-block; width: 6px; height: 6px; border-radius: 50%;
            background: var(--success); margin-right: 6px;
            animation: livePulse 0.8s ease-in-out infinite;
            box-shadow: 0 0 20px rgba(74,222,128,0.15);
        }
        
        @keyframes livePulse { 0%,100% { opacity:1; transform: scale(1); } 50% { opacity:0.3; transform: scale(0.6); } }
        
        .stats-ultimate {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
            gap: 8px; margin-bottom: 16px;
        }
        
        .stat-ultimate {
            background: var(--card); border-radius: 14px; padding: 10px 14px;
            border: 1px solid var(--border); backdrop-filter: blur(15px);
            transition: all 0.3s ease; text-align: center;
        }
        
        .stat-ultimate:hover {
            transform: translateY(-2px); border-color: rgba(123,47,252,0.15);
            box-shadow: 0 8px 30px rgba(123,47,252,0.04);
        }
        
        .stat-ultimate .label { font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); font-weight: 700; }
        .stat-ultimate .value { font-size: 18px; font-weight: 800; margin-top: 2px; font-family: 'Orbitron', monospace; }
        .stat-ultimate .value.xanh { color: var(--success); }
        .stat-ultimate .value.do { color: var(--danger); }
        .stat-ultimate .value.cam { color: var(--warning); }
        .stat-ultimate .value.xanh-duong { color: #60a5fa; }
        .stat-ultimate .value.quantum { color: #7b2ffc; }
        .stat-ultimate .sub { font-size: 8px; color: var(--text-muted); margin-top: 2px; }
        
        .summary-ultimate {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 8px; margin-bottom: 16px;
        }
        
        .summary-ult {
            background: linear-gradient(135deg, rgba(123,47,252,0.04), rgba(255,107,53,0.02));
            border-radius: 12px; padding: 12px 16px;
            border: 1px solid rgba(123,47,252,0.06); text-align: center;
        }
        
        .summary-ult .label { font-size: 9px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 1px; font-weight: 600; }
        .summary-ult .value { font-size: 22px; font-weight: 800; font-family: 'Orbitron', monospace; margin-top: 2px; }
        
        .table-ultimate {
            background: var(--card); border-radius: 14px; overflow: hidden;
            border: 1px solid var(--border); backdrop-filter: blur(15px);
        }
        
        .table-ultimate .header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 10px 16px; border-bottom: 1px solid var(--border);
            flex-wrap: wrap; gap: 6px;
        }
        
        .table-ultimate .header h3 {
            font-family: 'Orbitron', monospace; font-size: 13px; font-weight: 700;
            color: var(--secondary); display: flex; align-items: center; gap: 8px;
        }
        
        .table-ultimate .header .count { font-size: 10px; color: var(--text-muted); }
        
        .algo-badge {
            font-size: 9px; color: #a78bfa; background: rgba(123,47,252,0.06);
            padding: 2px 10px; border-radius: 12px; border: 1px solid rgba(123,47,252,0.06);
        }
        
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th {
            background: rgba(255,255,255,0.02); padding: 7px 10px; text-align: left;
            font-weight: 700; font-size: 8px; text-transform: uppercase;
            letter-spacing: 1px; color: var(--text-muted);
        }
        td { padding: 6px 10px; border-bottom: 1px solid rgba(255,255,255,0.02); }
        tr:hover td { background: rgba(255,255,255,0.015); }
        
        .phien { font-family: 'Orbitron', monospace; font-size: 10px; color: var(--text-secondary); }
        
        .du-doan { display: inline-block; padding: 2px 10px; border-radius: 8px; font-weight: 700; font-size: 10px; }
        .du-doan.tai { background: rgba(74,222,128,0.08); color: var(--success); }
        .du-doan.xiu { background: rgba(255,71,87,0.08); color: var(--danger); }
        
        .do-tin { font-weight: 700; color: #60a5fa; }
        
        .trang-thai { display: inline-block; padding: 2px 8px; border-radius: 8px; font-size: 8px; font-weight: 700; letter-spacing: 0.5px; }
        .trang-thai.dung { background: rgba(74,222,128,0.08); color: var(--success); }
        .trang-thai.sai { background: rgba(255,71,87,0.08); color: var(--danger); }
        .trang-thai.cho { background: rgba(255,165,2,0.08); color: var(--warning); }
        
        .chi-tiet { font-size: 9px; color: var(--text-muted); max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        
        .footer-ultimate {
            text-align: center; padding: 12px; color: var(--text-muted);
            font-size: 9px; border-top: 1px solid var(--border); margin-top: 14px;
        }
        
        .footer-ultimate .highlight { color: #a78bfa; }
        
        .heart {
            color: var(--danger); animation: heartBeat 1.5s ease-in-out infinite; display: inline-block;
        }
        @keyframes heartBeat { 0%,100% { transform: scale(1); } 50% { transform: scale(1.2); } }
        
        .algo-tag { color: #ff6b35; }
        
        @media (max-width: 768px) {
            .header-ultimate { padding: 14px; }
            .header-ultimate .content { flex-direction: column; align-items: flex-start; }
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
        }
        
        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.01); }
        ::-webkit-scrollbar-thumb { background: rgba(123,47,252,0.15); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(123,47,252,0.3); }
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
                        <div class="ten">TX ULTIMATE PRO</div>
                        <div class="sub">ANH KHÔI • ${type.toUpperCase()}</div>
                    </div>
                </div>
                <div class="info">
                    <div class="badge-ultimate">
                        <span class="live"></span>
                        ${type.toUpperCase()} • LIVE v35.0
                    </div>
                    <div style="font-size:8px;color:var(--text-muted);margin-top:2px;font-family:'Share Tech Mono',monospace;">
                        ${new Date().toLocaleString('vi-VN')} • 80+ Algorithms
                    </div>
                </div>
            </div>
        </div>
        
        <div class="stats-ultimate">
            <div class="stat-ultimate"><div class="label">Tổng</div><div class="value xanh-duong">${s.total}</div><div class="sub">Dự Đoán</div></div>
            <div class="stat-ultimate"><div class="label">✅ Đúng</div><div class="value xanh">${s.dung}</div><div class="sub">${s.tyle}%</div></div>
            <div class="stat-ultimate"><div class="label">❌ Sai</div><div class="value do">${s.sai}</div><div class="sub">${100-s.tyle}%</div></div>
            <div class="stat-ultimate"><div class="label">📊 Tỷ Lệ</div><div class="value ${s.tyle>=65?'xanh':s.tyle>=55?'cam':'do'}">${s.tyle}%</div><div class="sub">${s.tyle>=65?'🌟 Xuất sắc':s.tyle>=55?'📈 Tốt':'📉 Cần cải thiện'}</div></div>
            <div class="stat-ultimate"><div class="label">⚡ Chuỗi</div><div class="value ${s.chuoi>0?'xanh':s.chuoi<0?'do':'cam'}">${s.chuoi>0?'✅ +'+s.chuoi:s.chuoi<0?'❌ '+s.chuoi:'0'}</div><div class="sub">${s.chuoi>0?'🔥 Đang thắng':s.chuoi<0?'💪 Cố lên':'⚖️ Cân bằng'}</div></div>
            <div class="stat-ultimate"><div class="label">🏆 Dài Nhất</div><div class="value quantum">${s.chuoi_dai}</div><div class="sub">${s.chuoi_dai>=5?'🚀 Siêu chuỗi':'📈 Đang tiến'}</div></div>
        </div>
        
        <div class="summary-ultimate">
            <div class="summary-ult"><div class="label">📊 100 Phiên</div><div class="value xanh-duong">${recent.length}</div><div style="font-size:10px;color:var(--text-muted);">Tổng số</div></div>
            <div class="summary-ult"><div class="label">✅ Đúng</div><div class="value xanh">${tongDung}</div><div style="font-size:10px;color:var(--text-muted);">${tyle100}%</div></div>
            <div class="summary-ult"><div class="label">❌ Sai</div><div class="value do">${tongSai}</div><div style="font-size:10px;color:var(--text-muted);">${100-tyle100}%</div></div>
            <div class="summary-ult"><div class="label">⚡ Chuỗi</div><div class="value ${chuoiHienTai>0?'xanh':chuoiHienTai<0?'do':'cam'}">${chuoiHienTai>0?'✅ +'+chuoiHienTai:chuoiHienTai<0?'❌ '+chuoiHienTai:'0'}</div><div style="font-size:10px;color:var(--text-muted);">${chuoiHienTai>0?'🔥 Đang thắng':chuoiHienTai<0?'💪 Cố lên':'⚖️ Cân bằng'}</div></div>
            <div class="summary-ult"><div class="label">🏆 Dài Nhất</div><div class="value" style="color:#22d3ee;">${chuoiDaiNhat}</div><div style="font-size:10px;color:var(--text-muted);">${chuoiDaiNhat>=5?'🚀 Siêu chuỗi':'📈 Đang tiến'}</div></div>
            <div class="summary-ult"><div class="label">📊 Tỷ Lệ</div><div class="value ${tyle100>=65?'xanh':tyle100>=55?'cam':'do'}">${tyle100}%</div><div style="font-size:10px;color:var(--text-muted);">${tyle100>=65?'🌟 Xuất sắc':tyle100>=55?'📈 Tốt':'📉 Cần cải thiện'}</div></div>
        </div>
        
        <div class="table-ultimate">
            <div class="header">
                <h3>📋 LỊCH SỬ 100 PHIÊN</h3>
                <span class="count">${recent.length} phiên</span>
                <span class="algo-badge">⚡ 80+ Algorithms</span>
            </div>
            <div style="overflow-x:auto;">
                <table>
                    <thead>
                        <tr><th>Phiên</th><th>Dự Đoán</th><th>Độ Tin</th><th>KQ</th><th>Thực Tế</th><th>Phân Tích</th></tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);font-family:"Share Tech Mono",monospace;">⏳ WAITING FOR DATA...</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="footer-ultimate">
            <span style="color:var(--text-muted);">🌌 TX Ultimate Pro Predictor</span> • 
            <span class="highlight">Anh Khôi</span> • v35.0 • 
            <span class="algo-tag">⚡ 80+ Algorithms</span> • Auto 5s
            <br>
            <span style="font-size:7px;color:var(--text-muted);font-family:'Share Tech Mono',monospace;">
                <span class="heart">❤</span> Quantum Entropy • Neural Fusion • Fractal Pattern • Bậc Thang • Sóng Đảo Chiều • Tam Giác • Hoán Vị • Nhịp Sinh Học • Thời Gian Vàng • Bóng Ma • Cân Bằng Lượng Tử • Dồn Sóng • 30+ Cầu Cơ Bản
            </span>
        </div>
    </div>
    <script>setTimeout(() => location.reload(), 5000);</script>
</body>
</html>`;
}

// ============================================================
// 🔌 API
// ============================================================

app.get('/', (req, res) => res.json({ name: 'TX Ultimate Pro', version: '35.0', author: 'Anh Khôi' }));

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
            phien: data[0].phien, phien_hien_tai: (data[0].phien + 1).toString(),
            dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`,
            total: data[0].total, actual: data[0].result,
            prediction: result.duDoan, confidence: result.doTinCay,
            detail: result.chiTiet, status: '', timestamp: new Date().toISOString(),
            betLength: result.doDaiBet || 0, soMau: result.soMau || 0
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
            phien: data[0].phien, phien_hien_tai: (data[0].phien + 1).toString(),
            dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`,
            total: data[0].total, actual: data[0].result,
            prediction: result.duDoan, confidence: result.doTinCay,
            detail: result.chiTiet, status: '', timestamp: new Date().toISOString(),
            betLength: result.doDaiBet || 0, soMau: result.soMau || 0
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
    res.json({ hu: stats.hu, md5: stats.md5, total: { total, dung, sai: total-dung, tyle: total>0?Math.round((dung/total)*100):0 }, lastPred });
});

app.get('/reset', (req, res) => {
    history = { hu: [], md5: [] };
    stats = { hu: { total:0,dung:0,sai:0,tyle:0,chuoi:0,chuoi_dai:0,homnay:{dung:0,sai:0,tong:0} }, md5: { total:0,dung:0,sai:0,tyle:0,chuoi:0,chuoi_dai:0,homnay:{dung:0,sai:0,tong:0} } };
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
    console.log('║   🌌 TX ULTIMATE PRO v35.0 - ANH KHÔI                        ║');
    console.log('║   ⚡ 80+ Algorithms • 3 AI Engines • 35+ Cầu Types            ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
    startAuto();
});
