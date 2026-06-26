const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5000;

const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';
const HISTORY_FILE = 'himinhlaanhkhoi_history.json';
const LEARNING_FILE = 'himinhlaanhkhoi_learning.json';

// ============================================================
// 📊 LỊCH SỬ 1000 PHIÊN
// ============================================================
let history = {
    hu: [],
    md5: []
};

let stats = {
    hu: { total: 0, correct: 0, wrong: 0, accuracy: 0, streak: 0, bestStreak: 0, worstStreak: 0, last10: [], last50: [] },
    md5: { total: 0, correct: 0, wrong: 0, accuracy: 0, streak: 0, bestStreak: 0, worstStreak: 0, last10: [], last50: [] }
};

let learning = {
    hu: { patterns: {}, sequences: {}, weights: {}, history: [], adapt: {} },
    md5: { patterns: {}, sequences: {}, weights: {}, history: [], adapt: {} }
};

const MAX_HISTORY = 1000;
const AUTO_SAVE_INTERVAL = 8000;
let lastPhien = { hu: null, md5: null };
let processing = { hu: false, md5: false };
let lastPredictions = { hu: null, md5: null };

// ============================================================
// 🧠 HỆ THỐNG HỌC TIẾN HOÁ - BẮT CẦU SIÊU CHÍNH XÁC
// ============================================================
class EvolutionLearningEngine {
    constructor() {
        // Lưu trữ pattern
        this.patternDB = new Map();
        this.sequenceDB = new Map();
        this.weightDB = new Map();
        this.accuracyDB = new Map();
        this.streakDB = new Map();
        this.patternHistory = new Map();
        
        // Bộ nhớ đặc biệt cho các cầu quan trọng
        this.betMemory = new Map();      // Bộ nhớ cầu Bệt
        this.zigzagMemory = new Map();   // Bộ nhớ cầu Zigzag
        this.dao11Memory = new Map();    // Bộ nhớ cầu 1-1
        this.dao22Memory = new Map();    // Bộ nhớ cầu 2-2
        this.cycleMemory = new Map();    // Bộ nhớ cầu Chu kỳ
        this.trendMemory = new Map();    // Bộ nhớ Xu hướng
        this.breakMemory = new Map();    // Bộ nhớ Gãy cầu
        
        // Hệ số tiến hoá
        this.evolutionFactor = 1.0;
        this.adaptationRate = 0.15;
        this.confidenceBoost = new Map();
    }

    // Học từ kết quả với trọng số tiến hoá
    learn(gameId, pattern, result, confidence, sequence, totalPatterns) {
        const key = `${gameId}_${pattern}`;
        
        // Cập nhật Pattern DB
        if (!this.patternDB.has(key)) {
            this.patternDB.set(key, { 
                T: 0, X: 0, total: 0, correct: 0, 
                history: [], confidence: [], weights: [],
                evolution: 0, lastCorrect: false
            });
        }
        const db = this.patternDB.get(key);
        db[result] = (db[result] || 0) + 1;
        db.total++;
        db.history.push(result);
        db.confidence.push(confidence);
        db.weights.push(totalPatterns || 1);
        db.evolution += confidence / 100;
        
        if (db.history.length > 100) db.history.shift();
        if (db.confidence.length > 100) db.confidence.shift();
        if (db.weights.length > 100) db.weights.shift();

        // Tính độ chính xác tiến hoá
        const recent = db.history.slice(-20);
        const recentWeights = db.weights.slice(-20);
        let weightedCorrect = 0;
        let weightedTotal = 0;
        for (let i = 0; i < recent.length; i++) {
            const w = recentWeights[i] || 1;
            if (recent[i] === result) weightedCorrect += w * (1 + db.evolution * 0.01);
            weightedTotal += w;
        }
        db.correct = weightedTotal > 0 ? Math.min(1, weightedCorrect / weightedTotal) : 0.5;

        // Học cầu Bệt
        this.learnBet(gameId, sequence, result);
        
        // Học cầu Zigzag
        this.learnZigzag(gameId, sequence, result);
        
        // Học cầu 1-1
        this.learnDao11(gameId, sequence, result);
        
        // Học cầu 2-2
        this.learnDao22(gameId, sequence, result);
        
        // Học chu kỳ
        this.learnCycle(gameId, sequence, result);
        
        // Học xu hướng
        this.learnTrend(gameId, sequence, result);
        
        // Học gãy cầu
        this.learnBreak(gameId, sequence, result);

        // Cập nhật weight tiến hoá
        let weight = 25 + (db.correct - 0.35) * 200;
        const avgConf = db.confidence.slice(-10).reduce((a,b) => a+b, 0) / Math.min(db.confidence.length, 10);
        if (avgConf > 70) weight *= 1.2;
        if (avgConf > 80) weight *= 1.15;
        if (avgConf < 50) weight *= 0.8;
        if (db.total > 30) weight *= 1.08;
        weight *= (1 + db.evolution * 0.005);
        
        weight = Math.max(15, Math.min(220, weight));
        this.weightDB.set(key, weight);
        this.accuracyDB.set(key, db.correct);
        db.lastCorrect = true;

        // Cập nhật streak
        this.updateStreak(gameId, result);

        // Lưu pattern history
        if (!this.patternHistory.has(gameId)) {
            this.patternHistory.set(gameId, []);
        }
        const ph = this.patternHistory.get(gameId);
        ph.push({ pattern, result, confidence, time: Date.now(), weight, evolution: db.evolution });
        if (ph.length > 500) ph.shift();
    }

    // Học cầu Bệt chuyên sâu
    learnBet(gameId, sequence, result) {
        if (!sequence || sequence.length < 3) return;
        const key = `${gameId}_bet`;
        if (!this.betMemory.has(key)) {
            this.betMemory.set(key, { 
                lengths: [], results: [], accuracy: 0.5, total: 0,
                streakCount: {}, lastResult: null
            });
        }
        const mem = this.betMemory.get(key);
        // Đếm độ dài bệt
        let count = 1;
        for (let i = 1; i < sequence.length; i++) {
            if (sequence[i] === sequence[0]) count++;
            else break;
        }
        mem.lengths.push(count);
        mem.results.push(result);
        mem.total++;
        if (!mem.streakCount[count]) mem.streakCount[count] = { T: 0, X: 0 };
        mem.streakCount[count][result]++;
        
        // Tính độ chính xác
        const recentResults = mem.results.slice(-30);
        const correct = recentResults.filter(r => r === result).length;
        mem.accuracy = recentResults.length > 0 ? correct / recentResults.length : 0.5;
        mem.lastResult = result;
    }

    // Học cầu Zigzag chuyên sâu
    learnZigzag(gameId, sequence, result) {
        if (!sequence || sequence.length < 4) return;
        const key = `${gameId}_zigzag`;
        if (!this.zigzagMemory.has(key)) {
            this.zigzagMemory.set(key, { 
                changes: [], results: [], accuracy: 0.5, total: 0,
                patternCount: {}, lastResult: null
            });
        }
        const mem = this.zigzagMemory.get(key);
        // Đếm số lần đổi
        let changes = 0;
        for (let i = 1; i < Math.min(sequence.length, 8); i++) {
            if (sequence[i-1] !== sequence[i]) changes++;
        }
        mem.changes.push(changes);
        mem.results.push(result);
        mem.total++;
        const key2 = `${changes}`;
        if (!mem.patternCount[key2]) mem.patternCount[key2] = { T: 0, X: 0 };
        mem.patternCount[key2][result]++;
        
        const recentResults = mem.results.slice(-30);
        const correct = recentResults.filter(r => r === result).length;
        mem.accuracy = recentResults.length > 0 ? correct / recentResults.length : 0.5;
        mem.lastResult = result;
    }

    // Học cầu 1-1 chuyên sâu
    learnDao11(gameId, sequence, result) {
        if (!sequence || sequence.length < 4) return;
        const key = `${gameId}_dao11`;
        if (!this.dao11Memory.has(key)) {
            this.dao11Memory.set(key, { 
                patterns: [], results: [], accuracy: 0.5, total: 0,
                patternCount: {}, lastResult: null
            });
        }
        const mem = this.dao11Memory.get(key);
        // Kiểm tra đảo 1-1
        let isAlt = true;
        for (let i = 0; i < 3; i++) {
            if (sequence[i] === sequence[i+1]) { isAlt = false; break; }
        }
        if (isAlt) {
            mem.patterns.push('11');
            mem.results.push(result);
            mem.total++;
            if (!mem.patternCount['11']) mem.patternCount['11'] = { T: 0, X: 0 };
            mem.patternCount['11'][result]++;
        }
        
        const recentResults = mem.results.slice(-30);
        const correct = recentResults.filter(r => r === result).length;
        mem.accuracy = recentResults.length > 0 ? correct / recentResults.length : 0.5;
        mem.lastResult = result;
    }

    // Học cầu 2-2
    learnDao22(gameId, sequence, result) {
        if (!sequence || sequence.length < 6) return;
        const key = `${gameId}_dao22`;
        if (!this.dao22Memory.has(key)) {
            this.dao22Memory.set(key, { 
                patterns: [], results: [], accuracy: 0.5, total: 0,
                patternCount: {}, lastResult: null
            });
        }
        const mem = this.dao22Memory.get(key);
        // Kiểm tra đảo 2-2
        let isPair = true;
        for (let i = 0; i < 3; i++) {
            if (sequence[i*2] !== sequence[i*2+1]) { isPair = false; break; }
        }
        if (isPair && sequence[0] !== sequence[2]) {
            mem.patterns.push('22');
            mem.results.push(result);
            mem.total++;
            if (!mem.patternCount['22']) mem.patternCount['22'] = { T: 0, X: 0 };
            mem.patternCount['22'][result]++;
        }
        
        const recentResults = mem.results.slice(-30);
        const correct = recentResults.filter(r => r === result).length;
        mem.accuracy = recentResults.length > 0 ? correct / recentResults.length : 0.5;
        mem.lastResult = result;
    }

    // Học chu kỳ
    learnCycle(gameId, sequence, result) {
        if (!sequence || sequence.length < 6) return;
        const key = `${gameId}_cycle`;
        if (!this.cycleMemory.has(key)) {
            this.cycleMemory.set(key, { 
                cycles: [], results: [], accuracy: 0.5, total: 0,
                cycleCount: {}, lastResult: null
            });
        }
        const mem = this.cycleMemory.get(key);
        for (let cycle = 2; cycle <= 3; cycle++) {
            if (sequence.length < cycle * 3) continue;
            const p1 = sequence.slice(0, cycle);
            const p2 = sequence.slice(cycle, cycle*2);
            const p3 = sequence.slice(cycle*2, cycle*3);
            if (p1.join('') === p2.join('') && p2.join('') === p3.join('')) {
                mem.cycles.push(cycle);
                mem.results.push(result);
                mem.total++;
                const key2 = `c${cycle}`;
                if (!mem.cycleCount[key2]) mem.cycleCount[key2] = { T: 0, X: 0 };
                mem.cycleCount[key2][result]++;
            }
        }
        
        const recentResults = mem.results.slice(-30);
        const correct = recentResults.filter(r => r === result).length;
        mem.accuracy = recentResults.length > 0 ? correct / recentResults.length : 0.5;
        mem.lastResult = result;
    }

    // Học xu hướng
    learnTrend(gameId, sequence, result) {
        if (!sequence || sequence.length < 5) return;
        const key = `${gameId}_trend`;
        if (!this.trendMemory.has(key)) {
            this.trendMemory.set(key, { 
                trends: [], results: [], accuracy: 0.5, total: 0,
                trendCount: {}, lastResult: null
            });
        }
        const mem = this.trendMemory.get(key);
        const recent = sequence.slice(0, 5);
        const tCount = recent.filter(r => r === 'T').length;
        const trend = tCount >= 3 ? 'T' : 'X';
        mem.trends.push(trend);
        mem.results.push(result);
        mem.total++;
        if (!mem.trendCount[trend]) mem.trendCount[trend] = { T: 0, X: 0 };
        mem.trendCount[trend][result]++;
        
        const recentResults = mem.results.slice(-30);
        const correct = recentResults.filter(r => r === result).length;
        mem.accuracy = recentResults.length > 0 ? correct / recentResults.length : 0.5;
        mem.lastResult = result;
    }

    // Học gãy cầu
    learnBreak(gameId, sequence, result) {
        if (!sequence || sequence.length < 4) return;
        const key = `${gameId}_break`;
        if (!this.breakMemory.has(key)) {
            this.breakMemory.set(key, { 
                breaks: [], results: [], accuracy: 0.5, total: 0,
                breakCount: {}, lastResult: null
            });
        }
        const mem = this.breakMemory.get(key);
        // Kiểm tra gãy cầu
        const first = sequence[0];
        let count = 1;
        for (let i = 1; i < sequence.length; i++) {
            if (sequence[i] === first) count++;
            else break;
        }
        if (count >= 3 && sequence.length > count + 1) {
            const breakResult = sequence[count];
            if (breakResult !== first) {
                mem.breaks.push(`${first}->${breakResult}`);
                mem.results.push(result);
                mem.total++;
                const key2 = `${first}->${breakResult}`;
                if (!mem.breakCount[key2]) mem.breakCount[key2] = { T: 0, X: 0 };
                mem.breakCount[key2][result]++;
            }
        }
        
        const recentResults = mem.results.slice(-30);
        const correct = recentResults.filter(r => r === result).length;
        mem.accuracy = recentResults.length > 0 ? correct / recentResults.length : 0.5;
        mem.lastResult = result;
    }

    // Cập nhật streak
    updateStreak(gameId, result) {
        if (!this.streakDB.has(gameId)) {
            this.streakDB.set(gameId, { streak: 0, best: 0, worst: 0, last5: [], last10: [] });
        }
        const streak = this.streakDB.get(gameId);
        if (result === 'T') {
            streak.streak = streak.streak >= 0 ? streak.streak + 1 : 1;
        } else {
            streak.streak = streak.streak <= 0 ? streak.streak - 1 : -1;
        }
        if (streak.streak > streak.best) streak.best = streak.streak;
        if (streak.streak < streak.worst) streak.worst = streak.streak;
        
        streak.last5.push(result);
        streak.last10.push(result);
        if (streak.last5.length > 5) streak.last5.shift();
        if (streak.last10.length > 10) streak.last10.shift();
        this.streakDB.set(gameId, streak);
    }

    // Dự đoán siêu chính xác với tiến hoá
    predict(gameId, patterns, historyData) {
        if (!patterns || patterns.length === 0) {
            return this.superEvolutionFallback(gameId, historyData);
        }

        let tScore = 0, xScore = 0;
        let tWeight = 0, xWeight = 0;
        let totalWeight = 0;
        const usedPatterns = [];
        let totalConfidence = 0;

        for (const p of patterns) {
            const key = `${gameId}_${p.pattern}`;
            const weight = this.weightDB.get(key) || 50;
            const accuracy = this.accuracyDB.get(key) || 0.5;
            
            // Weight tiến hoá
            let finalWeight = weight * (0.25 + accuracy * 0.75);
            const boost = this.confidenceBoost.get(key) || 1;
            finalWeight *= boost;
            
            // Điều chỉnh confidence theo accuracy
            let conf = p.confidence;
            if (accuracy > 0.7) conf *= 1.2;
            else if (accuracy > 0.6) conf *= 1.08;
            else if (accuracy < 0.4) conf *= 0.8;
            else if (accuracy < 0.3) conf *= 0.65;
            
            const score = finalWeight * (conf / 100);
            
            if (p.prediction === 'T') {
                tScore += score;
                tWeight += finalWeight;
            } else {
                xScore += score;
                xWeight += finalWeight;
            }
            totalWeight += finalWeight;
            totalConfidence += conf;
            usedPatterns.push(p.detail);
        }

        // ===== BẮT CẦU ĐẶC BIỆT =====
        
        // 1. BẮT CẦU BỆT SIÊU CHÍNH XÁC
        const betResult = this.predictBet(gameId, historyData);
        if (betResult) {
            const betWeight = 1.3;
            if (betResult === 'T') {
                tScore *= betWeight;
                tWeight *= betWeight;
            } else {
                xScore *= betWeight;
                xWeight *= betWeight;
            }
            usedPatterns.push(`🔥 Bệt: ${betResult === 'T' ? 'Tài' : 'Xỉu'}`);
        }

        // 2. BẮT CẦU ZIGZAG SIÊU CHÍNH XÁC
        const zigzagResult = this.predictZigzag(gameId, historyData);
        if (zigzagResult) {
            const zzWeight = 1.25;
            if (zigzagResult === 'T') {
                tScore *= zzWeight;
                tWeight *= zzWeight;
            } else {
                xScore *= zzWeight;
                xWeight *= zzWeight;
            }
            usedPatterns.push(`⚡ Zigzag: ${zigzagResult === 'T' ? 'Tài' : 'Xỉu'}`);
        }

        // 3. BẮT CẦU 1-1 SIÊU CHÍNH XÁC
        const dao11Result = this.predictDao11(gameId, historyData);
        if (dao11Result) {
            const d11Weight = 1.2;
            if (dao11Result === 'T') {
                tScore *= d11Weight;
                tWeight *= d11Weight;
            } else {
                xScore *= d11Weight;
                xWeight *= d11Weight;
            }
            usedPatterns.push(`🔄 Đảo 1-1: ${dao11Result === 'T' ? 'Tài' : 'Xỉu'}`);
        }

        // 4. BẮT CẦU 2-2
        const dao22Result = this.predictDao22(gameId, historyData);
        if (dao22Result) {
            const d22Weight = 1.15;
            if (dao22Result === 'T') {
                tScore *= d22Weight;
                tWeight *= d22Weight;
            } else {
                xScore *= d22Weight;
                xWeight *= d22Weight;
            }
            usedPatterns.push(`🔄 Đảo 2-2: ${dao22Result === 'T' ? 'Tài' : 'Xỉu'}`);
        }

        // 5. BẮT CHU KỲ
        const cycleResult = this.predictCycle(gameId, historyData);
        if (cycleResult) {
            const cycWeight = 1.15;
            if (cycleResult === 'T') {
                tScore *= cycWeight;
                tWeight *= cycWeight;
            } else {
                xScore *= cycWeight;
                xWeight *= cycWeight;
            }
            usedPatterns.push(`🔁 Chu kỳ: ${cycleResult === 'T' ? 'Tài' : 'Xỉu'}`);
        }

        // 6. BẮT XU HƯỚNG
        const trendResult = this.predictTrend(gameId, historyData);
        if (trendResult) {
            const trWeight = 1.1;
            if (trendResult === 'T') {
                tScore *= trWeight;
                tWeight *= trWeight;
            } else {
                xScore *= trWeight;
                xWeight *= trWeight;
            }
            usedPatterns.push(`📈 Xu hướng: ${trendResult === 'T' ? 'Tài' : 'Xỉu'}`);
        }

        // 7. BẮT GÃY CẦU
        const breakResult = this.predictBreak(gameId, historyData);
        if (breakResult) {
            const brWeight = 1.12;
            if (breakResult === 'T') {
                tScore *= brWeight;
                tWeight *= brWeight;
            } else {
                xScore *= brWeight;
                xWeight *= brWeight;
            }
            usedPatterns.push(`💥 Gãy cầu: ${breakResult === 'T' ? 'Tài' : 'Xỉu'}`);
        }

        // Điều chỉnh theo streak siêu thông minh
        const streak = this.streakDB.get(gameId);
        if (streak) {
            if (streak.streak >= 5) {
                tScore *= 1.15;
                xScore *= 1.15;
            } else if (streak.streak >= 3) {
                tScore *= 1.08;
                xScore *= 1.08;
            } else if (streak.streak <= -3) {
                const temp = tScore;
                tScore = xScore * 1.4;
                xScore = temp * 1.4;
            } else if (streak.streak <= -2) {
                const temp = tScore;
                tScore = xScore * 1.2;
                xScore = temp * 1.2;
            }

            // Phân tích last5
            if (streak.last5.length >= 5) {
                const tCount = streak.last5.filter(r => r === 'T').length;
                if (tCount >= 4) {
                    xScore *= 1.15;
                } else if (tCount <= 1) {
                    tScore *= 1.15;
                }
            }
        }

        const total = tScore + xScore;
        if (total === 0) {
            return this.superEvolutionFallback(gameId, historyData);
        }

        let prediction = tScore > xScore ? 'TÀI' : 'XỈU';
        let confidence = Math.round(Math.max(tScore, xScore) / total * 100);
        
        // Điều chỉnh confidence cuối cùng
        if (totalWeight > 0) {
            const avgWeight = totalWeight / patterns.length;
            if (avgWeight > 80) confidence = Math.min(99, confidence + 10);
            else if (avgWeight > 60) confidence = Math.min(97, confidence + 6);
            else if (avgWeight < 30) confidence = Math.max(45, confidence - 6);
        }

        confidence = Math.min(99, Math.max(45, confidence));

        // Lưu học
        const result = prediction === 'TÀI' ? 'T' : 'X';
        const patternKey = usedPatterns.join('|') || 'basic';
        this.learn(gameId, patternKey, result, confidence, historyData.slice(0, 8).join(''), patterns.length);

        return {
            prediction,
            confidence,
            patterns: usedPatterns.slice(0, 5),
            detail: usedPatterns.slice(0, 3).join(' • '),
            totalPatterns: patterns.length,
            tScore: Math.round(tScore),
            xScore: Math.round(xScore)
        };
    }

    // Dự đoán cầu Bệt
    predictBet(gameId, history) {
        if (history.length < 3) return null;
        const key = `${gameId}_bet`;
        const mem = this.betMemory.get(key);
        if (!mem || mem.total < 5) return null;
        
        // Phân tích độ dài bệt hiện tại
        let count = 1;
        for (let i = 1; i < history.length; i++) {
            if (history[i] === history[0]) count++;
            else break;
        }
        
        // Nếu bệt dài >= 4, dự đoán đảo
        if (count >= 5) {
            return history[0] === 'T' ? 'X' : 'T';
        }
        if (count >= 4) {
            // Kiểm tra độ chính xác
            const acc = mem.accuracy || 0.5;
            if (acc > 0.55) {
                return history[0] === 'T' ? 'X' : 'T';
            }
        }
        if (count >= 3) {
            // Dự đoán theo xu hướng bệt
            const streakData = mem.streakCount[count];
            if (streakData) {
                const total = streakData.T + streakData.X;
                if (total >= 3) {
                    return streakData.T > streakData.X ? 'T' : 'X';
                }
            }
        }
        return null;
    }

    // Dự đoán cầu Zigzag
    predictZigzag(gameId, history) {
        if (history.length < 4) return null;
        const key = `${gameId}_zigzag`;
        const mem = this.zigzagMemory.get(key);
        if (!mem || mem.total < 5) return null;
        
        // Đếm số lần đổi
        let changes = 0;
        for (let i = 1; i < Math.min(history.length, 8); i++) {
            if (history[i-1] !== history[i]) changes++;
        }
        
        // Nếu zigzag dài >= 6, dự đoán đảo
        if (changes >= 6) {
            return history[0] === 'T' ? 'X' : 'T';
        }
        if (changes >= 4) {
            const acc = mem.accuracy || 0.5;
            if (acc > 0.55) {
                return history[0] === 'T' ? 'X' : 'T';
            }
        }
        
        // Dự đoán theo pattern
        const patternKey = `${changes}`;
        const patternData = mem.patternCount[patternKey];
        if (patternData) {
            const total = patternData.T + patternData.X;
            if (total >= 3) {
                return patternData.T > patternData.X ? 'T' : 'X';
            }
        }
        return null;
    }

    // Dự đoán cầu 1-1
    predictDao11(gameId, history) {
        if (history.length < 4) return null;
        const key = `${gameId}_dao11`;
        const mem = this.dao11Memory.get(key);
        if (!mem || mem.total < 5) return null;
        
        // Kiểm tra đảo 1-1
        let isAlt = true;
        for (let i = 0; i < 3; i++) {
            if (history[i] === history[i+1]) { isAlt = false; break; }
        }
        
        if (isAlt) {
            const acc = mem.accuracy || 0.5;
            if (acc > 0.6) {
                return history[0] === 'T' ? 'X' : 'T';
            }
            if (acc > 0.5) {
                const patternData = mem.patternCount['11'];
                if (patternData) {
                    return patternData.T > patternData.X ? 'T' : 'X';
                }
            }
        }
        return null;
    }

    // Dự đoán cầu 2-2
    predictDao22(gameId, history) {
        if (history.length < 6) return null;
        const key = `${gameId}_dao22`;
        const mem = this.dao22Memory.get(key);
        if (!mem || mem.total < 5) return null;
        
        let isPair = true;
        for (let i = 0; i < 3; i++) {
            if (history[i*2] !== history[i*2+1]) { isPair = false; break; }
        }
        
        if (isPair && history[0] !== history[2]) {
            const acc = mem.accuracy || 0.5;
            if (acc > 0.55) {
                return history[0] === 'T' ? 'X' : 'T';
            }
        }
        return null;
    }

    // Dự đoán chu kỳ
    predictCycle(gameId, history) {
        if (history.length < 6) return null;
        const key = `${gameId}_cycle`;
        const mem = this.cycleMemory.get(key);
        if (!mem || mem.total < 5) return null;
        
        for (let cycle = 2; cycle <= 3; cycle++) {
            if (history.length < cycle * 3) continue;
            const p1 = history.slice(0, cycle);
            const p2 = history.slice(cycle, cycle*2);
            const p3 = history.slice(cycle*2, cycle*3);
            if (p1.join('') === p2.join('') && p2.join('') === p3.join('')) {
                const acc = mem.accuracy || 0.5;
                if (acc > 0.55) {
                    return p1[0] === 'T' ? 'X' : 'T';
                }
            }
        }
        return null;
    }

    // Dự đoán xu hướng
    predictTrend(gameId, history) {
        if (history.length < 5) return null;
        const key = `${gameId}_trend`;
        const mem = this.trendMemory.get(key);
        if (!mem || mem.total < 5) return null;
        
        const recent = history.slice(0, 5);
        const tCount = recent.filter(r => r === 'T').length;
        const trend = tCount >= 3 ? 'T' : 'X';
        
        const trendData = mem.trendCount[trend];
        if (trendData) {
            const total = trendData.T + trendData.X;
            if (total >= 3) {
                return trendData.T > trendData.X ? 'T' : 'X';
            }
        }
        return null;
    }

    // Dự đoán gãy cầu
    predictBreak(gameId, history) {
        if (history.length < 4) return null;
        const key = `${gameId}_break`;
        const mem = this.breakMemory.get(key);
        if (!mem || mem.total < 5) return null;
        
        const first = history[0];
        let count = 1;
        for (let i = 1; i < history.length; i++) {
            if (history[i] === first) count++;
            else break;
        }
        if (count >= 3 && history.length > count + 1) {
            const breakResult = history[count];
            if (breakResult !== first) {
                const key2 = `${first}->${breakResult}`;
                const breakData = mem.breakCount[key2];
                if (breakData) {
                    const total = breakData.T + breakData.X;
                    if (total >= 3) {
                        return breakData.T > breakData.X ? 'T' : 'X';
                    }
                }
            }
        }
        return null;
    }

    // Fallback siêu tiến hoá
    superEvolutionFallback(gameId, history) {
        if (history.length < 2) {
            return { prediction: 'TÀI', confidence: 50, patterns: [], detail: 'Chưa đủ dữ liệu', totalPatterns: 0 };
        }
        
        const last = history[0];
        let count = 1;
        for (let i = 1; i < history.length; i++) {
            if (history[i] === last) count++;
            else break;
        }

        // Bệt siêu dài
        if (count >= 6) {
            const pred = last === 'T' ? 'XỈU' : 'TÀI';
            return { 
                prediction: pred, 
                confidence: 75 + count, 
                patterns: ['🔥 Bệt siêu dài'], 
                detail: `Bệt ${count} phiên`,
                totalPatterns: 1
            };
        }
        if (count >= 4) {
            const pred = last === 'T' ? 'XỈU' : 'TÀI';
            return { 
                prediction: pred, 
                confidence: 68 + count * 2, 
                patterns: ['⚡ Bệt dài'], 
                detail: `Bệt ${count} phiên`,
                totalPatterns: 1
            };
        }

        // Đảo 1-1
        if (count === 1 && history.length >= 4) {
            let isAlt = true;
            for (let i = 0; i < 3; i++) {
                if (history[i] === history[i+1]) { isAlt = false; break; }
            }
            if (isAlt) {
                const pred = last === 'T' ? 'XỈU' : 'TÀI';
                return {
                    prediction: pred,
                    confidence: 72,
                    patterns: ['🔄 Đảo 1-1'],
                    detail: 'Đảo chiều 1-1',
                    totalPatterns: 1
                };
            }
        }

        // Zigzag
        if (history.length >= 6) {
            let changes = 0;
            for (let i = 1; i < 6; i++) {
                if (history[i-1] !== history[i]) changes++;
            }
            if (changes >= 5) {
                const pred = last === 'T' ? 'XỈU' : 'TÀI';
                return {
                    prediction: pred,
                    confidence: 70,
                    patterns: ['⚡ Zigzag'],
                    detail: `Zigzag ${changes} lần`,
                    totalPatterns: 1
                };
            }
        }

        // Xu hướng
        const tCount = history.slice(0, 10).filter(r => r === 'T').length;
        if (tCount >= 7) {
            return {
                prediction: 'XỈU',
                confidence: 64,
                patterns: ['📈 Xu hướng Tài'],
                detail: `Tài ${tCount}/10`,
                totalPatterns: 1
            };
        }
        if (tCount <= 3) {
            return {
                prediction: 'TÀI',
                confidence: 64,
                patterns: ['📉 Xu hướng Xỉu'],
                detail: `Xỉu ${10-tCount}/10`,
                totalPatterns: 1
            };
        }

        // Theo chuỗi
        return {
            prediction: last === 'T' ? 'TÀI' : 'XỈU',
            confidence: 55,
            patterns: ['📊 Theo chuỗi'],
            detail: `Theo ${last === 'T' ? 'Tài' : 'Xỉu'}`,
            totalPatterns: 1
        };
    }

    getStats(gameId) {
        const streak = this.streakDB.get(gameId);
        const patternHistory = this.patternHistory.get(gameId) || [];
        const recent = patternHistory.slice(-20);
        const correct = recent.filter(p => p.result === 'T').length;
        const recentAccuracy = recent.length > 0 ? Math.round((correct / recent.length) * 100) : 0;
        
        return {
            streak: streak ? streak.streak : 0,
            bestStreak: streak ? streak.best : 0,
            worstStreak: streak ? streak.worst : 0,
            recentAccuracy,
            patternCount: this.patternDB.size,
            sequenceCount: this.sequenceDB.size,
            totalLearned: patternHistory.length,
            betAccuracy: this.betMemory.get(`${gameId}_bet`)?.accuracy || 0,
            zigzagAccuracy: this.zigzagMemory.get(`${gameId}_zigzag`)?.accuracy || 0,
            dao11Accuracy: this.dao11Memory.get(`${gameId}_dao11`)?.accuracy || 0
        };
    }
}

const evolutionEngine = new EvolutionLearningEngine();

// ============================================================
// 🔍 PHÂN TÍCH CẦU TIẾN HOÁ
// ============================================================
class EvolutionCauAnalyzer {
    analyze(history) {
        const patterns = [];

        // 1. BẮT CẦU BỆT
        const bet = this.analyzeBet(history);
        if (bet) patterns.push(bet);

        // 2. BẮT CẦU ZIGZAG
        const zigzag = this.analyzeZigzag(history);
        if (zigzag) patterns.push(zigzag);

        // 3. BẮT CẦU 1-1
        const dao11 = this.analyzeDao11(history);
        if (dao11) patterns.push(dao11);

        // 4. BẮT CẦU 2-2
        const dao22 = this.analyzeDao22(history);
        if (dao22) patterns.push(dao22);

        // 5. BẮT CẦU 3-3
        const cau33 = this.analyzeCau33(history);
        if (cau33) patterns.push(cau33);

        // 6. BẮT CẦU 4-4
        const cau44 = this.analyzeCau44(history);
        if (cau44) patterns.push(cau44);

        // 7. BẮT CHU KỲ
        const cycle = this.analyzeCycle(history);
        if (cycle) patterns.push(cycle);

        // 8. BẮT XU HƯỚNG
        const trend = this.analyzeTrend(history);
        if (trend) patterns.push(trend);

        // 9. BẮT CÂN BẰNG
        const balance = this.analyzeBalance(history);
        if (balance) patterns.push(balance);

        // 10. BẮT GÃY CẦU
        const breakPattern = this.analyzeBreak(history);
        if (breakPattern) patterns.push(breakPattern);

        // 11. BẮT CẦU 1-2-1
        const cau121 = this.analyzeCau121(history);
        if (cau121) patterns.push(cau121);

        // 12. BẮT CẦU 2-1-2
        const cau212 = this.analyzeCau212(history);
        if (cau212) patterns.push(cau212);

        return patterns;
    }

    // BẮT CẦU BỆT SIÊU CHÍNH XÁC
    analyzeBet(history) {
        if (history.length < 2) return null;
        const last = history[0];
        let count = 1;
        for (let i = 1; i < history.length; i++) {
            if (history[i] === last) count++;
            else break;
        }

        if (count >= 8) {
            return {
                pattern: 'bet',
                prediction: last === 'T' ? 'X' : 'T',
                confidence: 96,
                weight: count,
                detail: '🔥 Bệt siêu dài 8+'
            };
        }
        if (count >= 6) {
            return {
                pattern: 'bet',
                prediction: last === 'T' ? 'X' : 'T',
                confidence: 90,
                weight: count,
                detail: `⚡ Bệt dài ${count} phiên`
            };
        }
        if (count >= 4) {
            return {
                pattern: 'bet',
                prediction: last === 'T' ? 'X' : 'T',
                confidence: 80,
                weight: count,
                detail: `📈 Bệt ${count} phiên`
            };
        }
        if (count >= 3) {
            return {
                pattern: 'bet',
                prediction: last,
                confidence: 68,
                weight: count,
                detail: `📊 Bệt ngắn ${count} phiên`
            };
        }
        return null;
    }

    // BẮT CẦU ZIGZAG
    analyzeZigzag(history) {
        if (history.length < 4) return null;
        let changes = 0;
        for (let i = 1; i < Math.min(history.length, 10); i++) {
            if (history[i-1] !== history[i]) changes++;
        }
        if (changes >= 8) {
            return {
                pattern: 'zigzag',
                prediction: history[0] === 'T' ? 'X' : 'T',
                confidence: 92,
                weight: 1.6,
                detail: '⚡ Zigzag siêu dài 8+'
            };
        }
        if (changes >= 6) {
            return {
                pattern: 'zigzag',
                prediction: history[0] === 'T' ? 'X' : 'T',
                confidence: 85,
                weight: 1.4,
                detail: `🌀 Zigzag ${changes} lần`
            };
        }
        if (changes >= 4) {
            return {
                pattern: 'zigzag',
                prediction: history[0] === 'T' ? 'X' : 'T',
                confidence: 75,
                weight: 1.2,
                detail: `🎯 Zigzag ${changes} lần`
            };
        }
        return null;
    }

    // BẮT CẦU 1-1
    analyzeDao11(history) {
        if (history.length < 4) return null;
        let isAlternating = true;
        for (let i = 0; i < Math.min(history.length-1, 5); i++) {
            if (history[i] === history[i+1]) {
                isAlternating = false;
                break;
            }
        }
        if (isAlternating) {
            const len = Math.min(history.length, 10);
            let confidence = 78;
            if (len >= 8) confidence = 92;
            else if (len >= 6) confidence = 85;
            return {
                pattern: 'dao11',
                prediction: history[0] === 'T' ? 'X' : 'T',
                confidence,
                weight: 1.5,
                detail: `🔄 Đảo 1-1 ${len >= 6 ? 'dài' : ''}`
            };
        }
        return null;
    }

    // BẮT CẦU 2-2
    analyzeDao22(history) {
        if (history.length < 6) return null;
        const pairs = [];
        for (let i = 0; i < 3; i++) {
            if (i*2+1 < history.length && history[i*2] === history[i*2+1]) {
                pairs.push(history[i*2]);
            } else break;
        }
        if (pairs.length >= 2 && pairs[0] !== pairs[1]) {
            return {
                pattern: 'dao22',
                prediction: pairs[1] === 'T' ? 'X' : 'T',
                confidence: 86,
                weight: 1.8,
                detail: '🔄 Đảo 2-2'
            };
        }
        return null;
    }

    // BẮT CẦU 3-3
    analyzeCau33(history) {
        if (history.length < 9) return null;
        const last3 = history.slice(0, 3);
        const prev3 = history.slice(3, 6);
        const prevPrev3 = history.slice(6, 9);
        
        if (last3.every(v => v === last3[0]) && 
            prev3.every(v => v === prev3[0]) &&
            last3[0] !== prev3[0]) {
            return {
                pattern: 'cau33',
                prediction: last3[0] === 'T' ? 'X' : 'T',
                confidence: 87,
                weight: 1.8,
                detail: '🏗️ Cầu 3-3'
            };
        }
        return null;
    }

    // BẮT CẦU 4-4
    analyzeCau44(history) {
        if (history.length < 12) return null;
        const last4 = history.slice(0, 4);
        const prev4 = history.slice(4, 8);
        
        if (last4.every(v => v === last4[0]) && 
            prev4.every(v => v === prev4[0]) &&
            last4[0] !== prev4[0]) {
            return {
                pattern: 'cau44',
                prediction: last4[0] === 'T' ? 'X' : 'T',
                confidence: 91,
                weight: 2.2,
                detail: '🏗️ Cầu 4-4'
            };
        }
        return null;
    }

    // BẮT CHU KỲ
    analyzeCycle(history) {
        if (history.length < 9) return null;
        for (let cycle = 2; cycle <= 4; cycle++) {
            if (history.length < cycle * 3) continue;
            const p1 = history.slice(0, cycle);
            const p2 = history.slice(cycle, cycle*2);
            const p3 = history.slice(cycle*2, cycle*3);
            
            if (p1.join('') === p2.join('') && p2.join('') === p3.join('')) {
                return {
                    pattern: 'cycle',
                    prediction: p1[0] === 'T' ? 'X' : 'T',
                    confidence: 83,
                    weight: 1.5,
                    detail: `🔄 Chu kỳ ${cycle}`
                };
            }
        }
        return null;
    }

    // BẮT XU HƯỚNG
    analyzeTrend(history) {
        if (history.length < 12) return null;
        const recent = history.slice(0, 12);
        const tCount = recent.filter(v => v === 'T').length;
        
        if (tCount >= 10) {
            return {
                pattern: 'trend',
                prediction: 'X',
                confidence: 82,
                weight: 1.4,
                detail: `📈 Tài áp đảo ${tCount}/12`
            };
        }
        if (tCount >= 8) {
            return {
                pattern: 'trend',
                prediction: 'X',
                confidence: 74,
                weight: 1.3,
                detail: `📈 Xu hướng Tài ${tCount}/12`
            };
        }
        if (tCount <= 2) {
            return {
                pattern: 'trend',
                prediction: 'T',
                confidence: 82,
                weight: 1.4,
                detail: `📉 Xỉu áp đảo ${12-tCount}/12`
            };
        }
        if (tCount <= 4) {
            return {
                pattern: 'trend',
                prediction: 'T',
                confidence: 74,
                weight: 1.3,
                detail: `📉 Xu hướng Xỉu ${12-tCount}/12`
            };
        }
        return null;
    }

    // BẮT CÂN BẰNG
    analyzeBalance(history) {
        if (history.length < 20) return null;
        const recent = history.slice(0, 20);
        const tCount = recent.filter(v => v === 'T').length;
        
        if (tCount >= 16) {
            return {
                pattern: 'balance',
                prediction: 'X',
                confidence: 77,
                weight: 1.2,
                detail: `⚖️ Mất cân bằng cực độ Tài ${tCount}/20`
            };
        }
        if (tCount >= 14) {
            return {
                pattern: 'balance',
                prediction: 'X',
                confidence: 70,
                weight: 1.1,
                detail: `⚖️ Mất cân bằng Tài ${tCount}/20`
            };
        }
        if (tCount <= 4) {
            return {
                pattern: 'balance',
                prediction: 'T',
                confidence: 77,
                weight: 1.2,
                detail: `⚖️ Mất cân bằng cực độ Xỉu ${20-tCount}/20`
            };
        }
        if (tCount <= 6) {
            return {
                pattern: 'balance',
                prediction: 'T',
                confidence: 70,
                weight: 1.1,
                detail: `⚖️ Mất cân bằng Xỉu ${20-tCount}/20`
            };
        }
        return null;
    }

    // BẮT GÃY CẦU
    analyzeBreak(history) {
        if (history.length < 6) return null;
        const last = history[0];
        let count = 1;
        for (let i = 1; i < history.length; i++) {
            if (history[i] === last) count++;
            else break;
        }
        
        if (count >= 4 && history.length > count + 1) {
            const breakResult = history[count];
            const nextResult = history[count + 1];
            if (breakResult !== last && nextResult === breakResult) {
                return {
                    pattern: 'break',
                    prediction: breakResult === 'T' ? 'T' : 'X',
                    confidence: 76,
                    weight: 1.2,
                    detail: `💥 Gãy cầu ${last} → ${breakResult}`
                };
            }
        }
        return null;
    }

    // BẮT CẦU 1-2-1
    analyzeCau121(history) {
        if (history.length < 4) return null;
        const p1 = history[0];
        const p2 = history[1];
        const p3 = history[2];
        const p4 = history[3];
        
        if (p1 !== p2 && p2 === p3 && p3 !== p4 && p1 === p4) {
            return {
                pattern: 'cau121',
                prediction: p1 === 'T' ? 'T' : 'X',
                confidence: 78,
                weight: 1.3,
                detail: '🎯 Cầu 1-2-1'
            };
        }
        return null;
    }

    // BẮT CẦU 2-1-2
    analyzeCau212(history) {
        if (history.length < 4) return null;
        const p1 = history[0];
        const p2 = history[1];
        const p3 = history[2];
        const p4 = history[3];
        
        if (p1 === p2 && p2 !== p3 && p3 === p4 && p1 !== p4) {
            return {
                pattern: 'cau212',
                prediction: p2 === 'T' ? 'T' : 'X',
                confidence: 78,
                weight: 1.3,
                detail: '🎯 Cầu 2-1-2'
            };
        }
        return null;
    }
}

const evolutionAnalyzer = new EvolutionCauAnalyzer();

// ============================================================
// 🎯 DỰ ĐOÁN TIẾN HOÁ
// ============================================================
class EvolutionPredictor {
    async predict(gameId) {
        try {
            const url = gameId === 'hu' ? API_URL_HU : API_URL_MD5;
            const response = await axios.get(url, { timeout: 10000 });
            const data = response.data;
            
            if (!data || !data.list || data.list.length === 0) {
                return this.fallback('Không có dữ liệu');
            }

            // Lấy lịch sử
            const items = data.list.slice(0, 100).reverse();
            const historyData = items.map(item => {
                const r = (item.resultTruyenThong || '').toUpperCase();
                return r.includes('TAI') ? 'T' : r.includes('XIU') ? 'X' : null;
            }).filter(r => r !== null);

            if (historyData.length < 3) {
                return this.fallback('Lịch sử quá ngắn');
            }

            // Phân tích cầu tiến hoá
            const patterns = evolutionAnalyzer.analyze(historyData);
            
            // Dự đoán bằng engine tiến hoá
            const result = evolutionEngine.predict(gameId, patterns, historyData);
            
            return {
                prediction: result.prediction,
                confidence: result.confidence,
                patterns: result.patterns || [],
                detail: result.detail || 'Phân tích tiến hoá',
                totalPatterns: patterns.length,
                tScore: result.tScore || 0,
                xScore: result.xScore || 0
            };

        } catch (error) {
            console.error(`Lỗi dự đoán ${gameId}:`, error.message);
            return this.fallback(error.message);
        }
    }

    fallback(error) {
        return {
            prediction: 'TÀI',
            confidence: 50,
            patterns: [],
            detail: `Fallback: ${error}`,
            totalPatterns: 0,
            tScore: 0,
            xScore: 0
        };
    }
}

const evolutionPredictor = new EvolutionPredictor();

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
        const response = await axios.get(url, { timeout: 10000 });
        return transformData(response.data);
    } catch (error) {
        console.error(`Lỗi fetch ${type}:`, error.message);
        return null;
    }
}

function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
            history = data.history || { hu: [], md5: [] };
            stats = data.stats || stats;
            lastPhien = data.lastPhien || { hu: null, md5: null };
            console.log('📂 Đã tải lịch sử: HU=' + history.hu.length + ', MD5=' + history.md5.length);
        }
        if (fs.existsSync(LEARNING_FILE)) {
            const data = JSON.parse(fs.readFileSync(LEARNING_FILE, 'utf8'));
            learning = data;
            console.log('🧠 Đã tải dữ liệu học');
        }
    } catch (error) {
        console.error('Lỗi tải dữ liệu:', error.message);
    }
}

function saveHistory() {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify({ 
            history, 
            stats, 
            lastPhien,
            updated: new Date().toISOString()
        }, null, 2));
    } catch (error) {
        console.error('Lỗi lưu lịch sử:', error.message);
    }
}

function saveLearning() {
    try {
        fs.writeFileSync(LEARNING_FILE, JSON.stringify(learning, null, 2));
    } catch (error) {
        console.error('Lỗi lưu học:', error.message);
    }
}

function updateStats(type, isCorrect) {
    const s = stats[type];
    s.total++;
    if (isCorrect) {
        s.correct++;
        s.streak = s.streak >= 0 ? s.streak + 1 : 1;
        if (s.streak > s.bestStreak) s.bestStreak = s.streak;
    } else {
        s.wrong++;
        s.streak = s.streak <= 0 ? s.streak - 1 : -1;
        if (s.streak < s.worstStreak) s.worstStreak = s.streak;
    }
    s.accuracy = Math.round((s.correct / s.total) * 100);
    
    s.last10.push(isCorrect ? 1 : 0);
    s.last50.push(isCorrect ? 1 : 0);
    if (s.last10.length > 10) s.last10.shift();
    if (s.last50.length > 50) s.last50.shift();
}

function verifyAndUpdate(type, data) {
    if (!data || data.length === 0 || processing[type]) return;
    processing[type] = true;
    
    try {
        let updated = 0;
        for (const record of history[type]) {
            if (record.status && record.status !== '') continue;
            
            const actual = data.find(d => d.phien.toString() === record.phien_hien_tai);
            if (actual) {
                const isCorrect = record.prediction === actual.result;
                record.status = isCorrect ? '✅' : '❌';
                record.actual = actual.result;
                record.actual_time = new Date().toISOString();
                updateStats(type, isCorrect);
                
                const patternKey = record.patterns ? record.patterns.join('|') : 'basic';
                const result = record.prediction === 'TÀI' ? 'T' : 'X';
                evolutionEngine.learn(type, patternKey, result, record.confidence, [], 1);
                
                updated++;
            }
        }
        
        if (updated > 0) {
            saveHistory();
            saveLearning();
        }
    } finally {
        processing[type] = false;
    }
}

// ============================================================
// ⚡ TỰ ĐỘNG XỬ LÝ
// ============================================================

async function autoProcess() {
    try {
        // Xử lý HU
        const dataHu = await fetchData('hu');
        if (dataHu && dataHu.length > 0) {
            const currentPhien = dataHu[0].phien;
            if (lastPhien.hu !== currentPhien) {
                verifyAndUpdate('hu', dataHu);
                
                const existing = history.hu.find(h => h.phien_hien_tai === (currentPhien + 1).toString());
                if (!existing) {
                    const result = await evolutionPredictor.predict('hu');
                    const newRecord = {
                        phien: dataHu[0].phien,
                        phien_hien_tai: (dataHu[0].phien + 1).toString(),
                        dice: `${dataHu[0].dice1}-${dataHu[0].dice2}-${dataHu[0].dice3}`,
                        total: dataHu[0].total,
                        actual: dataHu[0].result,
                        prediction: result.prediction,
                        confidence: result.confidence,
                        patterns: result.patterns,
                        detail: result.detail,
                        status: '',
                        timestamp: new Date().toISOString()
                    };
                    
                    history.hu.unshift(newRecord);
                    if (history.hu.length > MAX_HISTORY) {
                        history.hu = history.hu.slice(0, MAX_HISTORY);
                    }
                    
                    lastPhien.hu = currentPhien;
                    lastPredictions.hu = result;
                    console.log(`[Tự động] HU: ${result.prediction} (${result.confidence}%) - ${result.detail}`);
                }
            }
        }

        // Xử lý MD5
        const dataMd5 = await fetchData('md5');
        if (dataMd5 && dataMd5.length > 0) {
            const currentPhien = dataMd5[0].phien;
            if (lastPhien.md5 !== currentPhien) {
                verifyAndUpdate('md5', dataMd5);
                
                const existing = history.md5.find(h => h.phien_hien_tai === (currentPhien + 1).toString());
                if (!existing) {
                    const result = await evolutionPredictor.predict('md5');
                    const newRecord = {
                        phien: dataMd5[0].phien,
                        phien_hien_tai: (dataMd5[0].phien + 1).toString(),
                        dice: `${dataMd5[0].dice1}-${dataMd5[0].dice2}-${dataMd5[0].dice3}`,
                        total: dataMd5[0].total,
                        actual: dataMd5[0].result,
                        prediction: result.prediction,
                        confidence: result.confidence,
                        patterns: result.patterns,
                        detail: result.detail,
                        status: '',
                        timestamp: new Date().toISOString()
                    };
                    
                    history.md5.unshift(newRecord);
                    if (history.md5.length > MAX_HISTORY) {
                        history.md5 = history.md5.slice(0, MAX_HISTORY);
                    }
                    
                    lastPhien.md5 = currentPhien;
                    lastPredictions.md5 = result;
                    console.log(`[Tự động] MD5: ${result.prediction} (${result.confidence}%) - ${result.detail}`);
                }
            }
        }

        saveHistory();
        saveLearning();
    } catch (error) {
        console.error('[Tự động] Lỗi:', error.message);
    }
}

function startAutoTask() {
    console.log(`⏰ Tự động xử lý mỗi ${AUTO_SAVE_INTERVAL/1000}s`);
    setTimeout(autoProcess, 3000);
    setInterval(autoProcess, AUTO_SAVE_INTERVAL);
}

// ============================================================
// 🌐 GIAO DIỆN VIP - ANH KHÔI
// ============================================================

function generateVIPHTML(type) {
    const s = stats[type];
    const h = history[type] || [];
    const recent = h.slice(0, 30);
    const learningStats = evolutionEngine.getStats(type);
    const lastPred = lastPredictions[type];
    
    let rows = '';
    for (const r of recent) {
        const status = r.status || '⏳';
        const statusClass = status === '✅' ? 'dung' : status === '❌' ? 'sai' : 'cho';
        const statusText = status === '✅' ? 'ĐÚNG' : status === '❌' ? 'SAI' : 'CHỜ';
        rows += `
            <tr>
                <td><span class="phien">#${r.phien_hien_tai || '-'}</span></td>
                <td><span class="du-doan ${r.prediction === 'TÀI' ? 'tai' : 'xiu'}">${r.prediction || '-'}</span></td>
                <td><span class="do-tin">${r.confidence || 0}%</span></td>
                <td><span class="trang-thai ${statusClass}">${statusText}</span></td>
                <td>${r.actual || '-'}</td>
                <td class="chi-tiet">${r.detail || '-'}</td>
            </tr>
        `;
    }

    const total = stats.hu.total + stats.md5.total;
    const correct = stats.hu.correct + stats.md5.correct;
    const totalAccuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🌌 TX Universe - Anh Khôi</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;600;700;800&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Inter', sans-serif;
            background: #06060e;
            color: #e8e8e8;
            min-height: 100vh;
            overflow-x: hidden;
        }
        
        /* Nền động siêu đẹp */
        .bg-anh-khoi {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 0;
            background: 
                radial-gradient(ellipse at 20% 50%, rgba(123, 47, 252, 0.12) 0%, transparent 60%),
                radial-gradient(ellipse at 80% 50%, rgba(0, 212, 255, 0.08) 0%, transparent 60%),
                radial-gradient(ellipse at 50% 100%, rgba(123, 47, 252, 0.06) 0%, transparent 40%);
            overflow: hidden;
        }
        
        .bg-anh-khoi::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: 
                radial-gradient(2px 2px at 20px 30px, rgba(255,255,255,0.06), transparent),
                radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.05), transparent),
                radial-gradient(2px 2px at 50px 160px, rgba(255,255,255,0.06), transparent),
                radial-gradient(2px 2px at 90px 40px, rgba(255,255,255,0.05), transparent),
                radial-gradient(2px 2px at 130px 80px, rgba(255,255,255,0.06), transparent),
                radial-gradient(2px 2px at 180px 120px, rgba(255,255,255,0.04), transparent),
                radial-gradient(2px 2px at 220px 50px, rgba(255,255,255,0.05), transparent);
            background-size: 250px 250px;
            animation: saoBay 60s linear infinite;
        }
        
        @keyframes saoBay {
            0% { transform: translate(0, 0) rotate(0deg); }
            100% { transform: translate(-50px, -30px) rotate(360deg); }
        }
        
        .bg-anh-khoi::after {
            content: '🌌';
            position: absolute;
            top: 10%;
            right: 10%;
            font-size: 120px;
            opacity: 0.04;
            animation: xoayNgang 30s linear infinite;
        }
        
        @keyframes xoayNgang {
            0% { transform: rotate(0deg) scale(1); }
            50% { transform: rotate(180deg) scale(1.2); }
            100% { transform: rotate(360deg) scale(1); }
        }
        
        .container {
            position: relative;
            z-index: 1;
            max-width: 1400px;
            margin: 0 auto;
            padding: 16px;
        }
        
        /* Header VIP */
        .header-vip {
            background: linear-gradient(135deg, rgba(123, 47, 252, 0.15), rgba(0, 212, 255, 0.08));
            border-radius: 24px;
            padding: 28px 36px;
            margin-bottom: 20px;
            border: 1px solid rgba(123, 47, 252, 0.2);
            backdrop-filter: blur(30px);
            position: relative;
            overflow: hidden;
        }
        
        .header-vip::before {
            content: '';
            position: absolute;
            top: -60%;
            left: -60%;
            width: 220%;
            height: 220%;
            background: conic-gradient(from 0deg, transparent, rgba(123, 47, 252, 0.05), transparent, rgba(0, 212, 255, 0.05), transparent);
            animation: xoayVong 25s linear infinite;
        }
        
        @keyframes xoayVong {
            100% { transform: rotate(360deg); }
        }
        
        .header-vip .content {
            position: relative;
            z-index: 1;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 16px;
        }
        
        .logo-vip {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        
        .logo-vip .icon {
            font-size: 40px;
            animation: lungLinh 3s ease-in-out infinite;
        }
        
        @keyframes lungLinh {
            0%, 100% { transform: scale(1) rotate(0deg); }
            50% { transform: scale(1.1) rotate(5deg); }
        }
        
        .logo-vip .ten {
            font-family: 'Orbitron', monospace;
            font-size: 30px;
            font-weight: 900;
            background: linear-gradient(135deg, #7b2ffc, #00d4ff, #7b2ffc);
            background-size: 200% 200%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: sang 4s ease-in-out infinite;
            text-shadow: 0 0 60px rgba(123, 47, 252, 0.2);
        }
        
        @keyframes sang {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }
        
        .logo-vip .sub {
            font-size: 13px;
            color: #7788aa;
            letter-spacing: 3px;
            font-weight: 300;
        }
        
        .header-vip .info {
            text-align: right;
        }
        
        .badge-vip {
            display: inline-block;
            padding: 6px 22px;
            border-radius: 30px;
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2px;
            background: linear-gradient(135deg, rgba(123, 47, 252, 0.25), rgba(0, 212, 255, 0.15));
            border: 1px solid rgba(123, 47, 252, 0.3);
            color: #a78bfa;
            backdrop-filter: blur(10px);
        }
        
        .badge-vip .live {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #4ade80;
            margin-right: 10px;
            animation: nhapNhay 1.2s ease-in-out infinite;
            box-shadow: 0 0 20px rgba(74, 222, 128, 0.3);
        }
        
        @keyframes nhapNhay {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.7); }
        }
        
        /* Thống kê VIP */
        .stats-vip {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 14px;
            margin-bottom: 20px;
        }
        
        .stat-vip {
            background: rgba(255,255,255,0.03);
            border-radius: 16px;
            padding: 16px 18px;
            border: 1px solid rgba(255,255,255,0.05);
            backdrop-filter: blur(15px);
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        
        .stat-vip::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(135deg, rgba(123, 47, 252, 0.05), transparent);
            opacity: 0;
            transition: opacity 0.4s ease;
        }
        
        .stat-vip:hover {
            transform: translateY(-4px) scale(1.02);
            border-color: rgba(123, 47, 252, 0.2);
            box-shadow: 0 12px 40px rgba(123, 47, 252, 0.08);
        }
        
        .stat-vip:hover::before {
            opacity: 1;
        }
        
        .stat-vip .label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #667788;
            font-weight: 600;
            position: relative;
            z-index: 1;
        }
        
        .stat-vip .value {
            font-size: 26px;
            font-weight: 800;
            margin-top: 4px;
            font-family: 'Orbitron', monospace;
            position: relative;
            z-index: 1;
        }
        
        .stat-vip .value.xanh { color: #4ade80; }
        .stat-vip .value.do { color: #f87171; }
        .stat-vip .value.cam { color: #fb923c; }
        .stat-vip .value.xanh-duong { color: #60a5fa; }
        .stat-vip .value.tim { color: #a78bfa; }
        .stat-vip .value.cyan { color: #22d3ee; }
        .stat-vip .value.vang { color: #fbbf24; }
        
        .stat-vip .sub {
            font-size: 11px;
            color: #556677;
            margin-top: 4px;
            position: relative;
            z-index: 1;
        }
        
        /* Bảng VIP */
        .table-vip {
            background: rgba(255,255,255,0.02);
            border-radius: 16px;
            overflow: hidden;
            border: 1px solid rgba(255,255,255,0.05);
            backdrop-filter: blur(15px);
        }
        
        .table-vip .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 14px 22px;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .table-vip .header h3 {
            font-size: 15px;
            font-weight: 700;
            color: #e0e0e0;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .table-vip .header .count {
            font-size: 12px;
            color: #556677;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }
        
        th {
            background: rgba(255,255,255,0.04);
            padding: 12px 14px;
            text-align: left;
            font-weight: 700;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #556677;
        }
        
        td {
            padding: 10px 14px;
            border-bottom: 1px solid rgba(255,255,255,0.03);
        }
        
        tr:hover td {
            background: rgba(255,255,255,0.03);
        }
        
        .phien {
            font-family: 'Orbitron', monospace;
            font-size: 12px;
            color: #7788aa;
        }
        
        .du-doan {
            display: inline-block;
            padding: 3px 14px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 12px;
        }
        
        .du-doan.tai {
            background: rgba(74, 222, 128, 0.15);
            color: #4ade80;
        }
        
        .du-doan.xiu {
            background: rgba(248, 113, 113, 0.15);
            color: #f87171;
        }
        
        .do-tin {
            font-weight: 700;
            color: #60a5fa;
        }
        
        .trang-thai {
            display: inline-block;
            padding: 2px 12px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.5px;
        }
        
        .trang-thai.dung {
            background: rgba(74, 222, 128, 0.15);
            color: #4ade80;
        }
        
        .trang-thai.sai {
            background: rgba(248, 113, 113, 0.15);
            color: #f87171;
        }
        
        .trang-thai.cho {
            background: rgba(251, 146, 60, 0.15);
            color: #fb923c;
        }
        
        .chi-tiet {
            font-size: 11px;
            color: #556677;
            max-width: 200px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        /* Footer */
        .footer-vip {
            text-align: center;
            padding: 20px;
            color: #334455;
            font-size: 12px;
            border-top: 1px solid rgba(255,255,255,0.04);
            margin-top: 20px;
        }
        
        .footer-vip .brand {
            color: #556677;
            font-weight: 600;
        }
        
        .footer-vip .highlight {
            color: #a78bfa;
        }
        
        .footer-vip .heart {
            color: #f87171;
            animation: tim 1.5s ease-in-out infinite;
            display: inline-block;
        }
        
        @keyframes tim {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.3); }
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .header-vip { padding: 18px 20px; }
            .header-vip .content { flex-direction: column; align-items: flex-start; }
            .header-vip .info { text-align: left; width: 100%; }
            .stats-vip { grid-template-columns: repeat(3, 1fr); gap: 10px; }
            .stat-vip .value { font-size: 20px; }
            .logo-vip .ten { font-size: 22px; }
            table { font-size: 11px; }
            th, td { padding: 6px 8px; }
            .chi-tiet { max-width: 80px; }
        }
        
        @media (max-width: 480px) {
            .stats-vip { grid-template-columns: repeat(2, 1fr); }
            .container { padding: 8px; }
            th, td { padding: 4px 6px; font-size: 10px; }
            .logo-vip .ten { font-size: 18px; }
            .logo-vip .icon { font-size: 28px; }
        }
        
        /* Scrollbar */
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        ::-webkit-scrollbar-thumb { background: rgba(123, 47, 252, 0.3); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(123, 47, 252, 0.5); }
        
        /* Hiệu ứng loading cho bảng */
        .shimmer {
            background: linear-gradient(90deg, #222, #333, #222);
            background-size: 200% 100%;
            animation: shimmerText 2s infinite;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        
        @keyframes shimmerText {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
        }
    </style>
</head>
<body>
    <div class="bg-anh-khoi"></div>
    
    <div class="container">
        <!-- Header VIP -->
        <div class="header-vip">
            <div class="content">
                <div class="logo-vip">
                    <span class="icon">🌌</span>
                    <div>
                        <div class="ten">TX UNIVERSE</div>
                        <div class="sub">BỞI ANH KHÔI • ${type.toUpperCase()}</div>
                    </div>
                </div>
                <div class="info">
                    <div class="badge-vip">
                        <span class="live"></span>
                        ${type.toUpperCase()} • TRỰC TIẾP
                    </div>
                    <div style="font-size:11px;color:#445566;margin-top:4px;">
                        ${new Date().toLocaleString('vi-VN')}
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Stats VIP -->
        <div class="stats-vip">
            <div class="stat-vip">
                <div class="label">Tổng Dự Đoán</div>
                <div class="value xanh-duong">${s.total}</div>
                <div class="sub">${type.toUpperCase()}</div>
            </div>
            <div class="stat-vip">
                <div class="label">✅ Đúng</div>
                <div class="value xanh">${s.correct}</div>
                <div class="sub">${s.accuracy}%</div>
            </div>
            <div class="stat-vip">
                <div class="label">❌ Sai</div>
                <div class="value do">${s.wrong}</div>
                <div class="sub">${100 - s.accuracy}%</div>
            </div>
            <div class="stat-vip">
                <div class="label">📊 Tỷ Lệ Đúng</div>
                <div class="value ${s.accuracy >= 65 ? 'xanh' : s.accuracy >= 55 ? 'cam' : 'do'}">${s.accuracy}%</div>
                <div class="sub">${s.accuracy >= 65 ? '🌟 Xuất sắc' : s.accuracy >= 55 ? '📈 Tốt' : '📉 Cần cải thiện'}</div>
            </div>
            <div class="stat-vip">
                <div class="label">⚡ Chuỗi Hiện Tại</div>
                <div class="value ${s.streak > 0 ? 'xanh' : s.streak < 0 ? 'do' : 'cam'}">${s.streak > 0 ? '✅ +' + s.streak : s.streak < 0 ? '❌ ' + s.streak : '0'}</div>
                <div class="sub">${s.streak > 0 ? '🔥 Đang thắng' : s.streak < 0 ? '💪 Cố lên' : '⚖️ Cân bằng'}</div>
            </div>
            <div class="stat-vip">
                <div class="label">🏆 Chuỗi Dài Nhất</div>
                <div class="value cyan">${s.bestStreak}</div>
                <div class="sub">${s.bestStreak >= 5 ? '🚀 Siêu chuỗi' : '📈 Đang tiến'}</div>
            </div>
        </div>
        
        <!-- Table VIP -->
        <div class="table-vip">
            <div class="header">
                <h3>📋 LỊCH SỬ DỰ ĐOÁN</h3>
                <span class="count">${h.length} phiên • Hiển thị ${Math.min(30, h.length)} gần nhất</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Phiên</th>
                        <th>Dự Đoán</th>
                        <th>Độ Tin</th>
                        <th>Kết Quả</th>
                        <th>Thực Tế</th>
                        <th>Phân Tích</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="6" style="text-align:center;padding:40px;color:#445566;">⏳ Đang chờ dữ liệu...</td></tr>'}
                </tbody>
            </table>
        </div>
        
        <!-- Footer -->
        <div class="footer-vip">
            <span class="brand">🌌 TX Universe Predictor</span> • 
            <span class="highlight">Anh Khôi</span> • 
            Phiên bản 5.0 • 
            Tự động cập nhật mỗi 8s • 
            <span style="color:#445566;">⚡ Siêu chính xác</span>
            <br>
            <span style="font-size:11px;color:#334455;">
                <span class="heart">❤️</span> Bắt cầu Bệt • Zigzag • 1-1 • 2-2 • Chu kỳ • Xu hướng • Gãy cầu
            </span>
        </div>
    </div>
    
    <script>
        // Tự động refresh mỗi 12s
        setTimeout(() => {
            location.reload();
        }, 12000);
    </script>
</body>
</html>
    `;
}

// ============================================================
// 🔌 API ENDPOINTS
// ============================================================

app.get('/', (req, res) => {
    res.json({
        name: 'TX Universe Predictor',
        version: '5.0',
        author: 'Anh Khôi',
        status: '🚀 Siêu chính xác',
        endpoints: [
            '/lc79-hu',
            '/lc79-md5',
            '/lc79-hu/history',
            '/lc79-md5/history',
            '/stats',
            '/analysis',
            '/dashboard'
        ]
    });
});

// Dashboard
app.get('/dashboard', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🌌 TX Universe - Anh Khôi</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: #06060e;
            color: #e0e0e0;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            background: radial-gradient(ellipse at 20% 50%, rgba(123, 47, 252, 0.08) 0%, transparent 60%),
                        radial-gradient(ellipse at 80% 50%, rgba(0, 212, 255, 0.06) 0%, transparent 60%);
        }
        .container { text-align: center; padding: 30px; max-width: 600px; }
        .logo { font-size: 72px; margin-bottom: 16px; animation: lungLinh 3s ease-in-out infinite; }
        @keyframes lungLinh {
            0%, 100% { transform: scale(1) rotate(0deg); }
            50% { transform: scale(1.1) rotate(5deg); }
        }
        h1 {
            font-size: 42px;
            font-weight: 900;
            background: linear-gradient(135deg, #7b2ffc, #00d4ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 8px;
            font-family: 'Orbitron', sans-serif;
        }
        .sub {
            color: #667788;
            font-size: 16px;
            margin-bottom: 30px;
        }
        .sub strong { color: #a78bfa; }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
            margin-bottom: 30px;
        }
        .card {
            background: rgba(255,255,255,0.04);
            border-radius: 16px;
            padding: 22px;
            border: 1px solid rgba(255,255,255,0.06);
            text-decoration: none;
            color: #e0e0e0;
            transition: all 0.4s ease;
            backdrop-filter: blur(10px);
        }
        .card:hover {
            transform: translateY(-6px);
            border-color: rgba(123, 47, 252, 0.3);
            box-shadow: 0 12px 40px rgba(123, 47, 252, 0.1);
        }
        .card .icon { font-size: 36px; margin-bottom: 8px; }
        .card .title { font-weight: 700; font-size: 15px; }
        .card .desc { font-size: 12px; color: #556677; margin-top: 4px; }
        .footer {
            color: #334455;
            font-size: 13px;
        }
        .footer .highlight { color: #a78bfa; }
        .footer .heart { color: #f87171; }
        @media (max-width: 500px) {
            h1 { font-size: 28px; }
            .grid { grid-template-columns: 1fr 1fr; }
            .card { padding: 16px; }
            .card .icon { font-size: 28px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🌌</div>
        <h1>TX UNIVERSE</h1>
        <div class="sub">Bởi <strong>Anh Khôi</strong> • Hệ thống dự đoán siêu chính xác</div>
        
        <div class="grid">
            <a href="/lc79-hu/history" class="card">
                <div class="icon">🎯</div>
                <div class="title">Lẩu Cua 79 - HU</div>
                <div class="desc">Dự đoán Tài Xỉu Hũ</div>
            </a>
            <a href="/lc79-md5/history" class="card">
                <div class="icon">🎯</div>
                <div class="title">Lẩu Cua 79 - MD5</div>
                <div class="desc">Dự đoán Tài Xỉu MD5</div>
            </a>
            <a href="/stats" class="card">
                <div class="icon">📊</div>
                <div class="title">Thống Kê</div>
                <div class="desc">Xem thống kê tổng hợp</div>
            </a>
            <a href="/analysis" class="card">
                <div class="icon">🔍</div>
                <div class="title">Phân Tích</div>
                <div class="desc">Phân tích chi tiết</div>
            </a>
        </div>
        
        <div class="footer">
            ⚡ <span class="highlight">TX Universe Predictor v5.0</span> • 
            Bắt cầu Bệt • Zigzag • 1-1 • 2-2 • Chu kỳ • Xu hướng • Gãy cầu
            <br>
            <span style="font-size:11px;color:#334455;">
                <span class="heart">❤️</span> Anh Khôi - Siêu chính xác
            </span>
        </div>
    </div>
</body>
</html>
    `);
});

// Dự đoán HU
app.get('/lc79-hu', async (req, res) => {
    try {
        const result = await evolutionPredictor.predict('hu');
        const data = await fetchData('hu');
        if (!data || data.length === 0) {
            return res.status(500).json({ error: 'Không có dữ liệu' });
        }

        const existing = history.hu.find(h => h.phien_hien_tai === (data[0].phien + 1).toString());
        if (existing) {
            return res.json({
                phien_hien_tai: existing.phien_hien_tai,
                prediction: existing.prediction,
                confidence: existing.confidence + '%',
                detail: existing.detail,
                status: existing.status || '⏳ Chờ',
                cached: true
            });
        }

        const record = {
            phien: data[0].phien,
            phien_hien_tai: (data[0].phien + 1).toString(),
            dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`,
            total: data[0].total,
            actual: data[0].result,
            prediction: result.prediction,
            confidence: result.confidence,
            patterns: result.patterns,
            detail: result.detail,
            status: '',
            timestamp: new Date().toISOString()
        };

        history.hu.unshift(record);
        if (history.hu.length > MAX_HISTORY) {
            history.hu = history.hu.slice(0, MAX_HISTORY);
        }
        saveHistory();

        res.json({
            phien_hien_tai: record.phien_hien_tai,
            prediction: record.prediction,
            confidence: `${record.confidence}%`,
            detail: record.detail,
            patterns: record.patterns,
            status: '⏳ Chờ kết quả',
            dice: record.dice,
            total: record.total,
            tScore: result.tScore,
            xScore: result.xScore
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Dự đoán MD5
app.get('/lc79-md5', async (req, res) => {
    try {
        const result = await evolutionPredictor.predict('md5');
        const data = await fetchData('md5');
        if (!data || data.length === 0) {
            return res.status(500).json({ error: 'Không có dữ liệu' });
        }

        const existing = history.md5.find(h => h.phien_hien_tai === (data[0].phien + 1).toString());
        if (existing) {
            return res.json({
                phien_hien_tai: existing.phien_hien_tai,
                prediction: existing.prediction,
                confidence: existing.confidence + '%',
                detail: existing.detail,
                status: existing.status || '⏳ Chờ',
                cached: true
            });
        }

        const record = {
            phien: data[0].phien,
            phien_hien_tai: (data[0].phien + 1).toString(),
            dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`,
            total: data[0].total,
            actual: data[0].result,
            prediction: result.prediction,
            confidence: result.confidence,
            patterns: result.patterns,
            detail: result.detail,
            status: '',
            timestamp: new Date().toISOString()
        };

        history.md5.unshift(record);
        if (history.md5.length > MAX_HISTORY) {
            history.md5 = history.md5.slice(0, MAX_HISTORY);
        }
        saveHistory();

        res.json({
            phien_hien_tai: record.phien_hien_tai,
            prediction: record.prediction,
            confidence: `${record.confidence}%`,
            detail: record.detail,
            patterns: record.patterns,
            status: '⏳ Chờ kết quả',
            dice: record.dice,
            total: record.total,
            tScore: result.tScore,
            xScore: result.xScore
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Lịch sử HU - HTML VIP
app.get('/lc79-hu/history', async (req, res) => {
    const data = await fetchData('hu');
    if (data) verifyAndUpdate('hu', data);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(generateVIPHTML('hu'));
});

// Lịch sử MD5 - HTML VIP
app.get('/lc79-md5/history', async (req, res) => {
    const data = await fetchData('md5');
    if (data) verifyAndUpdate('md5', data);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(generateVIPHTML('md5'));
});

// Lịch sử JSON
app.get('/lc79-hu/json', async (req, res) => {
    const data = await fetchData('hu');
    if (data) verifyAndUpdate('hu', data);
    res.json({
        type: 'HU',
        total: history.hu.length,
        stats: stats.hu,
        records: history.hu.slice(0, 50)
    });
});

app.get('/lc79-md5/json', async (req, res) => {
    const data = await fetchData('md5');
    if (data) verifyAndUpdate('md5', data);
    res.json({
        type: 'MD5',
        total: history.md5.length,
        stats: stats.md5,
        records: history.md5.slice(0, 50)
    });
});

// Thống kê tổng hợp
app.get('/stats', (req, res) => {
    const total = stats.hu.total + stats.md5.total;
    const correct = stats.hu.correct + stats.md5.correct;
    res.json({
        hu: stats.hu,
        md5: stats.md5,
        total: {
            predictions: total,
            correct: correct,
            wrong: total - correct,
            accuracy: total > 0 ? Math.round((correct / total) * 100) : 0
        },
        learning: {
            hu: evolutionEngine.getStats('hu'),
            md5: evolutionEngine.getStats('md5')
        },
        lastPredictions: lastPredictions
    });
});

// Phân tích
app.get('/analysis', async (req, res) => {
    const [hu, md5] = await Promise.all([
        evolutionPredictor.predict('hu'),
        evolutionPredictor.predict('md5')
    ]);
    
    res.json({
        hu: {
            prediction: hu.prediction,
            confidence: hu.confidence,
            patterns: hu.patterns,
            detail: hu.detail,
            totalPatterns: hu.totalPatterns,
            tScore: hu.tScore,
            xScore: hu.xScore
        },
        md5: {
            prediction: md5.prediction,
            confidence: md5.confidence,
            patterns: md5.patterns,
            detail: md5.detail,
            totalPatterns: md5.totalPatterns,
            tScore: md5.tScore,
            xScore: md5.xScore
        }
    });
});

// Reset
app.get('/reset', (req, res) => {
    history = { hu: [], md5: [] };
    stats = {
        hu: { total: 0, correct: 0, wrong: 0, accuracy: 0, streak: 0, bestStreak: 0, worstStreak: 0, last10: [], last50: [] },
        md5: { total: 0, correct: 0, wrong: 0, accuracy: 0, streak: 0, bestStreak: 0, worstStreak: 0, last10: [], last50: [] }
    };
    lastPhien = { hu: null, md5: null };
    lastPredictions = { hu: null, md5: null };
    saveHistory();
    res.json({ message: '✅ Reset thành công' });
});

// ============================================================
// 🚀 KHỞI ĐỘNG
// ============================================================

loadHistory();

app.listen(PORT, '0.0.0.0', () => {
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                                                               ║');
    console.log('║   🌌  TX UNIVERSE PREDICTOR v5.0 - ANH KHÔI                 ║');
    console.log('║                                                               ║');
    console.log('║   🚀 Siêu chính xác - Giao diện VIP độc quyền               ║');
    console.log('║                                                               ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log('║                                                               ║');
    console.log(`║   📡 Server: http://0.0.0.0:${PORT}                            ║`);
    console.log('║                                                               ║');
    console.log('║   🔗 ENDPOINTS:                                              ║');
    console.log('║   📊 /dashboard       - Trang chủ VIP                        ║');
    console.log('║   📈 /lc79-hu         - Dự đoán HU                           ║');
    console.log('║   📈 /lc79-md5        - Dự đoán MD5                          ║');
    console.log('║   🎯 /lc79-hu/history - Thống kê HU (Giao diện VIP)          ║');
    console.log('║   🎯 /lc79-md5/history - Thống kê MD5 (Giao diện VIP)        ║');
    console.log('║   📋 /stats           - Thống kê tổng hợp                    ║');
    console.log('║   🔍 /analysis        - Phân tích chi tiết                   ║');
    console.log('║                                                               ║');
    console.log('║   🧠 THUẬT TOÁN TIẾN HOÁ:                                   ║');
    console.log('║   🔥 Bắt cầu Bệt siêu chính xác                              ║');
    console.log('║   ⚡ Bắt cầu Zigzag siêu chính xác                           ║');
    console.log('║   🔄 Bắt cầu 1-1 siêu chính xác                              ║');
    console.log('║   🔄 Bắt cầu 2-2                                             ║');
    console.log('║   🔁 Bắt chu kỳ                                              ║');
    console.log('║   📈 Bắt xu hướng                                            ║');
    console.log('║   💥 Bắt gãy cầu                                             ║');
    console.log('║                                                               ║');
    console.log('║   📁 himinhlaanhkhoi_history.json                            ║');
    console.log('║   📁 himinhlaanhkhoi_learning.json                           ║');
    console.log('║                                                               ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
    
    startAutoTask();
});
