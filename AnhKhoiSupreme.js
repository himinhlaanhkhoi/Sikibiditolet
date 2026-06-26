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
    hu: { total: 0, dung: 0, sai: 0, tyle: 0, chuoi: 0, chuoi_dai: 0 },
    md5: { total: 0, dung: 0, sai: 0, tyle: 0, chuoi: 0, chuoi_dai: 0 }
};
let lastPhien = { hu: null, md5: null };
let lastPred = { hu: null, md5: null };

// ============================================================
// 🧠 THUẬT TOÁN THÔNG MINH SIÊU CẤP
// ============================================================
class SuperSmartPredictor {
    constructor() {
        // Bộ nhớ dài hạn
        this.longTermMemory = new Map();
        this.patternMemory = new Map();
        this.weightMemory = new Map();
        this.accuracyMemory = new Map();
        this.streakMemory = new Map();
        this.sequenceMemory = new Map();
        
        // Bộ nhớ cầu chuyên sâu
        this.betMemory = new Map();
        this.zigzagMemory = new Map();
        this.daoMemory = new Map();
        this.cau22Memory = new Map();
        this.cau33Memory = new Map();
        this.cycleMemory = new Map();
        this.trendMemory = new Map();
        this.balanceMemory = new Map();
        this.momentumMemory = new Map();
        this.volatilityMemory = new Map();
        this.correlationMemory = new Map();
        this.fibonacciMemory = new Map();
        this.movingAvgMemory = new Map();
        this.rsiMemory = new Map();
        this.macdMemory = new Map();
        this.kalmanMemory = new Map();
        this.ensembleMemory = new Map();
        
        // Hệ số
        this.learningRate = 0.35;
        this.memoryDepth = 500;
        
        // Khởi tạo
        this.loadData();
        this.initSmartPatterns();
    }

    // Khởi tạo pattern thông minh
    initSmartPatterns() {
        const basePatterns = [
            { name: 'Bệt ngắn', weight: 1.0, conf: 55 },
            { name: 'Bệt vừa', weight: 1.2, conf: 62 },
            { name: 'Bệt dài', weight: 1.5, conf: 72 },
            { name: 'Bệt siêu dài', weight: 1.8, conf: 82 },
            { name: 'Đảo 1-1', weight: 1.3, conf: 68 },
            { name: 'Đảo 2-2', weight: 1.2, conf: 62 },
            { name: 'Zigzag ngắn', weight: 1.1, conf: 58 },
            { name: 'Zigzag dài', weight: 1.4, conf: 70 },
            { name: 'Zigzag siêu dài', weight: 1.6, conf: 78 },
            { name: 'Chu kỳ 2', weight: 1.1, conf: 58 },
            { name: 'Chu kỳ 3', weight: 1.2, conf: 62 },
            { name: 'Xu hướng Tài', weight: 1.1, conf: 56 },
            { name: 'Xu hướng Xỉu', weight: 1.1, conf: 56 },
            { name: 'Gãy cầu', weight: 1.2, conf: 64 },
            { name: 'Cân bằng', weight: 1.1, conf: 60 },
            { name: 'Momentum', weight: 1.1, conf: 58 },
            { name: 'Fibonacci', weight: 1.2, conf: 60 },
            { name: 'RSI', weight: 1.1, conf: 56 },
            { name: 'MACD', weight: 1.15, conf: 58 },
            { name: 'Kalman', weight: 1.1, conf: 55 }
        ];

        for (const p of basePatterns) {
            const key = `base_${p.name}`;
            this.weightMemory.set(key, p.weight * 80);
            this.accuracyMemory.set(key, 0.45 + (p.conf - 50) / 100);
        }
    }

    // ============================================================
    // HỌC SIÊU THÔNG MINH
    // ============================================================
    learn(game, pattern, result, conf, sequence) {
        const key = `${game}_${pattern}`;
        
        if (!this.longTermMemory.has(key)) {
            this.longTermMemory.set(key, {
                T: 0, X: 0, total: 0, correct: 0,
                history: [], confidences: [],
                firstSeen: Date.now(), lastSeen: Date.now(),
                streak: 0, evolution: 0
            });
        }
        const mem = this.longTermMemory.get(key);
        mem[result] = (mem[result] || 0) + 1;
        mem.total++;
        mem.history.push(result);
        mem.confidences.push(conf);
        mem.lastSeen = Date.now();
        mem.evolution += conf / 100;
        
        if (mem.history.length > this.memoryDepth) mem.history.shift();
        if (mem.confidences.length > this.memoryDepth) mem.confidences.shift();

        // Tính độ chính xác
        const recent = mem.history.slice(-30);
        const recentConf = mem.confidences.slice(-30);
        let weightedCorrect = 0, weightedTotal = 0;
        for (let i = 0; i < recent.length; i++) {
            const w = (recentConf[i] || 50) / 50;
            if (recent[i] === result) weightedCorrect += w;
            weightedTotal += w;
        }
        mem.correct = weightedTotal > 0 ? Math.min(1, weightedCorrect / weightedTotal) : 0.5;

        // Cập nhật weight
        let weight = 15 + (mem.correct - 0.2) * 220;
        const avgConf = mem.confidences.slice(-20).reduce((a,b) => a+b, 0) / Math.min(mem.confidences.length, 20);
        if (avgConf > 70) weight *= 1.25;
        if (avgConf > 80) weight *= 1.2;
        if (avgConf < 50) weight *= 0.85;
        if (mem.total > 50) weight *= 1.1;
        if (mem.total > 100) weight *= 1.05;
        weight *= (1 + mem.evolution * 0.003);
        
        weight = Math.max(10, Math.min(280, weight));
        this.weightMemory.set(key, weight);
        this.accuracyMemory.set(key, mem.correct);

        // Học sequence
        if (sequence && sequence.length >= 2) {
            const seqKey = `${game}_seq_${sequence.slice(0, 4)}`;
            if (!this.sequenceMemory.has(seqKey)) {
                this.sequenceMemory.set(seqKey, { T: 0, X: 0, total: 0 });
            }
            const seq = this.sequenceMemory.get(seqKey);
            seq[result] = (seq[result] || 0) + 1;
            seq.total++;
        }

        // Học tất cả cầu
        this.learnAllCau(game, sequence, result);
        this.updateStreak(game, result);
        this.saveData();
    }

    // Học tất cả cầu
    learnAllCau(game, sequence, result) {
        if (!sequence || sequence.length < 2) return;

        this.learnBet(game, sequence, result);
        this.learnZigzag(game, sequence, result);
        this.learnDao(game, sequence, result);
        this.learnCau22(game, sequence, result);
        this.learnCau33(game, sequence, result);
        this.learnCycle(game, sequence, result);
        this.learnTrend(game, sequence, result);
        this.learnBalance(game, sequence, result);
        this.learnMomentum(game, sequence, result);
        this.learnVolatility(game, sequence, result);
        this.learnCorrelation(game, sequence, result);
        this.learnFibonacci(game, sequence, result);
        this.learnMovingAvg(game, sequence, result);
        this.learnRSI(game, sequence, result);
        this.learnMACD(game, sequence, result);
        this.learnKalman(game, sequence, result);
        this.learnEnsemble(game, sequence, result);
    }

    // Học Bệt
    learnBet(game, sequence, result) {
        const key = `${game}_bet`;
        if (!this.betMemory.has(key)) {
            this.betMemory.set(key, {
                lengths: [], results: [], accuracy: 0.5, total: 0,
                patternMap: new Map(), bestLength: 0, avgLength: 0,
                recentLengths: [], lastResult: null
            });
        }
        const mem = this.betMemory.get(key);
        
        let count = 1;
        for (let i = 1; i < sequence.length; i++) {
            if (sequence[i] === sequence[0]) count++;
            else break;
        }
        
        mem.lengths.push(count);
        mem.results.push(result);
        mem.total++;
        if (count > mem.bestLength) mem.bestLength = count;
        mem.avgLength = mem.lengths.reduce((a,b) => a+b, 0) / mem.lengths.length;
        mem.recentLengths.push(count);
        if (mem.recentLengths.length > 20) mem.recentLengths.shift();
        mem.lastResult = result;
        
        const key2 = `len_${count}`;
        if (!mem.patternMap.has(key2)) {
            mem.patternMap.set(key2, { T: 0, X: 0 });
        }
        mem.patternMap.get(key2)[result]++;
        
        const recent = mem.results.slice(-30);
        const correct = recent.filter(r => r === result).length;
        mem.accuracy = recent.length > 0 ? correct / recent.length : 0.5;
    }

    // Học Zigzag
    learnZigzag(game, sequence, result) {
        const key = `${game}_zigzag`;
        if (!this.zigzagMemory.has(key)) {
            this.zigzagMemory.set(key, {
                changes: [], results: [], accuracy: 0.5, total: 0,
                patternMap: new Map(), maxChanges: 0, avgChanges: 0
            });
        }
        const mem = this.zigzagMemory.get(key);
        
        let changes = 0;
        for (let i = 1; i < Math.min(sequence.length, 10); i++) {
            if (sequence[i-1] !== sequence[i]) changes++;
        }
        
        mem.changes.push(changes);
        mem.results.push(result);
        mem.total++;
        if (changes > mem.maxChanges) mem.maxChanges = changes;
        mem.avgChanges = mem.changes.reduce((a,b) => a+b, 0) / mem.changes.length;
        
        const key2 = `chg_${changes}`;
        if (!mem.patternMap.has(key2)) {
            mem.patternMap.set(key2, { T: 0, X: 0 });
        }
        mem.patternMap.get(key2)[result]++;
        
        const recent = mem.results.slice(-30);
        const correct = recent.filter(r => r === result).length;
        mem.accuracy = recent.length > 0 ? correct / recent.length : 0.5;
    }

    // Học Đảo
    learnDao(game, sequence, result) {
        if (sequence.length < 4) return;
        const key = `${game}_dao`;
        if (!this.daoMemory.has(key)) {
            this.daoMemory.set(key, {
                patterns: [], results: [], accuracy: 0.5, total: 0,
                patternMap: new Map(), streak: 0, lastPattern: null
            });
        }
        const mem = this.daoMemory.get(key);
        
        let isAlt = true;
        for (let i = 0; i < 3; i++) {
            if (sequence[i] === sequence[i+1]) { isAlt = false; break; }
        }
        
        if (isAlt) {
            mem.patterns.push('dao11');
            mem.results.push(result);
            mem.total++;
            if (!mem.patternMap.has('dao11')) {
                mem.patternMap.set('dao11', { T: 0, X: 0 });
            }
            mem.patternMap.get('dao11')[result]++;
            mem.lastPattern = 'dao11';
            mem.streak++;
            
            const recent = mem.results.slice(-30);
            const correct = recent.filter(r => r === result).length;
            mem.accuracy = recent.length > 0 ? correct / recent.length : 0.5;
        } else {
            mem.streak = 0;
        }
    }

    // Học Cầu 2-2
    learnCau22(game, sequence, result) {
        if (sequence.length < 6) return;
        const key = `${game}_cau22`;
        if (!this.cau22Memory.has(key)) {
            this.cau22Memory.set(key, {
                patterns: [], results: [], accuracy: 0.5, total: 0,
                patternMap: new Map()
            });
        }
        const mem = this.cau22Memory.get(key);
        
        const p1 = sequence[0] === sequence[1];
        const p2 = sequence[2] === sequence[3];
        const p3 = sequence[4] === sequence[5];
        if (p1 && p2 && p3 && sequence[0] !== sequence[2] && sequence[2] !== sequence[4]) {
            mem.patterns.push('cau22');
            mem.results.push(result);
            mem.total++;
            if (!mem.patternMap.has('cau22')) {
                mem.patternMap.set('cau22', { T: 0, X: 0 });
            }
            mem.patternMap.get('cau22')[result]++;
            
            const recent = mem.results.slice(-30);
            const correct = recent.filter(r => r === result).length;
            mem.accuracy = recent.length > 0 ? correct / recent.length : 0.5;
        }
    }

    // Học Cầu 3-3
    learnCau33(game, sequence, result) {
        if (sequence.length < 9) return;
        const key = `${game}_cau33`;
        if (!this.cau33Memory.has(key)) {
            this.cau33Memory.set(key, {
                patterns: [], results: [], accuracy: 0.5, total: 0,
                patternMap: new Map()
            });
        }
        const mem = this.cau33Memory.get(key);
        
        const l3 = sequence.slice(0, 3);
        const p3 = sequence.slice(3, 6);
        if (l3.every(v => v === l3[0]) && p3.every(v => v === p3[0]) && l3[0] !== p3[0]) {
            mem.patterns.push('cau33');
            mem.results.push(result);
            mem.total++;
            if (!mem.patternMap.has('cau33')) {
                mem.patternMap.set('cau33', { T: 0, X: 0 });
            }
            mem.patternMap.get('cau33')[result]++;
            
            const recent = mem.results.slice(-30);
            const correct = recent.filter(r => r === result).length;
            mem.accuracy = recent.length > 0 ? correct / recent.length : 0.5;
        }
    }

    // Học Chu kỳ
    learnCycle(game, sequence, result) {
        if (sequence.length < 6) return;
        const key = `${game}_cycle`;
        if (!this.cycleMemory.has(key)) {
            this.cycleMemory.set(key, {
                cycles: [], results: [], accuracy: 0.5, total: 0,
                patternMap: new Map(), detectedCycles: new Set()
            });
        }
        const mem = this.cycleMemory.get(key);
        
        for (let c = 2; c <= 3; c++) {
            if (sequence.length < c * 3) continue;
            const p1 = sequence.slice(0, c);
            const p2 = sequence.slice(c, c*2);
            const p3 = sequence.slice(c*2, c*3);
            if (p1.join('') === p2.join('') && p2.join('') === p3.join('')) {
                const key2 = `cyc_${c}`;
                if (!mem.patternMap.has(key2)) {
                    mem.patternMap.set(key2, { T: 0, X: 0 });
                }
                mem.patternMap.get(key2)[result]++;
                mem.total++;
                mem.detectedCycles.add(c);
                break;
            }
        }
        
        if (mem.results.length < 100) {
            mem.results.push(result);
            const recent = mem.results.slice(-30);
            const correct = recent.filter(r => r === result).length;
            mem.accuracy = recent.length > 0 ? correct / recent.length : 0.5;
        }
    }

    // Học Xu hướng
    learnTrend(game, sequence, result) {
        if (sequence.length < 5) return;
        const key = `${game}_trend`;
        if (!this.trendMemory.has(key)) {
            this.trendMemory.set(key, {
                trends: [], results: [], accuracy: 0.5, total: 0,
                patternMap: new Map(), currentTrend: null, trendStrength: 0
            });
        }
        const mem = this.trendMemory.get(key);
        
        const recent = sequence.slice(0, 5);
        const tCount = recent.filter(r => r === 'T').length;
        const trend = tCount >= 3 ? 'T' : 'X';
        const strength = Math.abs(tCount - 2.5) / 2.5;
        
        const key2 = `trd_${trend}`;
        if (!mem.patternMap.has(key2)) {
            mem.patternMap.set(key2, { T: 0, X: 0 });
        }
        mem.patternMap.get(key2)[result]++;
        mem.total++;
        mem.results.push(result);
        mem.currentTrend = trend;
        mem.trendStrength = strength;
        
        const recent2 = mem.results.slice(-30);
        const correct = recent2.filter(r => r === result).length;
        mem.accuracy = recent2.length > 0 ? correct / recent2.length : 0.5;
    }

    // Học Cân bằng
    learnBalance(game, sequence, result) {
        if (sequence.length < 10) return;
        const key = `${game}_balance`;
        if (!this.balanceMemory.has(key)) {
            this.balanceMemory.set(key, {
                balances: [], results: [], accuracy: 0.5, total: 0,
                tCount: 0, xCount: 0, ratio: 0.5
            });
        }
        const mem = this.balanceMemory.get(key);
        
        const recent = sequence.slice(0, 10);
        const tCount = recent.filter(r => r === 'T').length;
        const xCount = 10 - tCount;
        const ratio = tCount / 10;
        
        mem.balances.push(ratio);
        mem.results.push(result);
        mem.total++;
        mem.tCount += tCount;
        mem.xCount += xCount;
        mem.ratio = mem.tCount / (mem.tCount + mem.xCount);
        
        const recent2 = mem.results.slice(-30);
        const correct = recent2.filter(r => r === result).length;
        mem.accuracy = recent2.length > 0 ? correct / recent2.length : 0.5;
    }

    // Học Momentum
    learnMomentum(game, sequence, result) {
        if (sequence.length < 5) return;
        const key = `${game}_momentum`;
        if (!this.momentumMemory.has(key)) {
            this.momentumMemory.set(key, {
                momentums: [], results: [], accuracy: 0.5, total: 0,
                patternMap: new Map(), lastMomentum: 0
            });
        }
        const mem = this.momentumMemory.get(key);
        
        const recent = sequence.slice(0, 5);
        const tCount = recent.filter(r => r === 'T').length;
        const momentum = (tCount / 5) - 0.5;
        
        mem.momentums.push(momentum);
        mem.results.push(result);
        mem.total++;
        mem.lastMomentum = momentum;
        
        const key2 = momentum > 0 ? 'up' : 'down';
        if (!mem.patternMap.has(key2)) {
            mem.patternMap.set(key2, { T: 0, X: 0 });
        }
        mem.patternMap.get(key2)[result]++;
        
        const recent2 = mem.results.slice(-30);
        const correct = recent2.filter(r => r === result).length;
        mem.accuracy = recent2.length > 0 ? correct / recent2.length : 0.5;
    }

    // Học Biến động
    learnVolatility(game, sequence, result) {
        if (sequence.length < 5) return;
        const key = `${game}_volatility`;
        if (!this.volatilityMemory.has(key)) {
            this.volatilityMemory.set(key, {
                volatilities: [], results: [], accuracy: 0.5, total: 0,
                patternMap: new Map(), lastVolatility: 0
            });
        }
        const mem = this.volatilityMemory.get(key);
        
        let changes = 0;
        for (let i = 1; i < Math.min(sequence.length, 6); i++) {
            if (sequence[i-1] !== sequence[i]) changes++;
        }
        const volatility = changes / 5;
        
        mem.volatilities.push(volatility);
        mem.results.push(result);
        mem.total++;
        mem.lastVolatility = volatility;
        
        const key2 = volatility > 0.5 ? 'high' : 'low';
        if (!mem.patternMap.has(key2)) {
            mem.patternMap.set(key2, { T: 0, X: 0 });
        }
        mem.patternMap.get(key2)[result]++;
        
        const recent2 = mem.results.slice(-30);
        const correct = recent2.filter(r => r === result).length;
        mem.accuracy = recent2.length > 0 ? correct / recent2.length : 0.5;
    }

    // Học Tương quan
    learnCorrelation(game, sequence, result) {
        if (sequence.length < 6) return;
        const key = `${game}_correlation`;
        if (!this.correlationMemory.has(key)) {
            this.correlationMemory.set(key, {
                correlations: [], results: [], accuracy: 0.5, total: 0,
                patternMap: new Map()
            });
        }
        const mem = this.correlationMemory.get(key);
        
        let corr = 0;
        for (let i = 0; i < Math.min(sequence.length - 2, 4); i++) {
            if (sequence[i] === sequence[i+2]) corr++;
            else corr--;
        }
        
        mem.correlations.push(corr);
        mem.results.push(result);
        mem.total++;
        
        const key2 = corr > 0 ? 'positive' : 'negative';
        if (!mem.patternMap.has(key2)) {
            mem.patternMap.set(key2, { T: 0, X: 0 });
        }
        mem.patternMap.get(key2)[result]++;
        
        const recent2 = mem.results.slice(-30);
        const correct = recent2.filter(r => r === result).length;
        mem.accuracy = recent2.length > 0 ? correct / recent2.length : 0.5;
    }

    // Học Fibonacci
    learnFibonacci(game, sequence, result) {
        if (sequence.length < 8) return;
        const key = `${game}_fibonacci`;
        if (!this.fibonacciMemory.has(key)) {
            this.fibonacciMemory.set(key, {
                values: [], results: [], accuracy: 0.5, total: 0,
                patternMap: new Map()
            });
        }
        const mem = this.fibonacciMemory.get(key);
        
        const fibs = [1, 1, 2, 3, 5, 8];
        let fibSum = 0;
        for (const f of fibs) {
            if (sequence.length > f && sequence[sequence.length - f] === 'T') fibSum++;
        }
        const ratio = fibSum / fibs.length;
        
        mem.values.push(ratio);
        mem.results.push(result);
        mem.total++;
        
        const key2 = ratio > 0.5 ? 'high' : 'low';
        if (!mem.patternMap.has(key2)) {
            mem.patternMap.set(key2, { T: 0, X: 0 });
        }
        mem.patternMap.get(key2)[result]++;
        
        const recent2 = mem.results.slice(-30);
        const correct = recent2.filter(r => r === result).length;
        mem.accuracy = recent2.length > 0 ? correct / recent2.length : 0.5;
    }

    // Học Moving Average
    learnMovingAvg(game, sequence, result) {
        if (sequence.length < 10) return;
        const key = `${game}_ma`;
        if (!this.movingAvgMemory.has(key)) {
            this.movingAvgMemory.set(key, {
                values: [], results: [], accuracy: 0.5, total: 0,
                patternMap: new Map()
            });
        }
        const mem = this.movingAvgMemory.get(key);
        
        const ma5 = sequence.slice(0, 5).filter(r => r === 'T').length / 5;
        const ma10 = sequence.slice(0, 10).filter(r => r === 'T').length / 10;
        const diff = ma5 - ma10;
        
        mem.values.push(diff);
        mem.results.push(result);
        mem.total++;
        
        const key2 = diff > 0 ? 'up' : 'down';
        if (!mem.patternMap.has(key2)) {
            mem.patternMap.set(key2, { T: 0, X: 0 });
        }
        mem.patternMap.get(key2)[result]++;
        
        const recent2 = mem.results.slice(-30);
        const correct = recent2.filter(r => r === result).length;
        mem.accuracy = recent2.length > 0 ? correct / recent2.length : 0.5;
    }

    // Học RSI
    learnRSI(game, sequence, result) {
        if (sequence.length < 8) return;
        const key = `${game}_rsi`;
        if (!this.rsiMemory.has(key)) {
            this.rsiMemory.set(key, {
                values: [], results: [], accuracy: 0.5, total: 0,
                patternMap: new Map()
            });
        }
        const mem = this.rsiMemory.get(key);
        
        const recent = sequence.slice(0, 7);
        let gains = 0, losses = 0;
        for (let i = 1; i < recent.length; i++) {
            if (recent[i-1] === 'T' && recent[i] === 'T') gains++;
            else if (recent[i-1] === 'X' && recent[i] === 'X') losses++;
        }
        const rsi = gains + losses > 0 ? gains / (gains + losses) : 0.5;
        
        mem.values.push(rsi);
        mem.results.push(result);
        mem.total++;
        
        const key2 = rsi > 0.6 ? 'high' : 'low';
        if (!mem.patternMap.has(key2)) {
            mem.patternMap.set(key2, { T: 0, X: 0 });
        }
        mem.patternMap.get(key2)[result]++;
        
        const recent2 = mem.results.slice(-30);
        const correct = recent2.filter(r => r === result).length;
        mem.accuracy = recent2.length > 0 ? correct / recent2.length : 0.5;
    }

    // Học MACD
    learnMACD(game, sequence, result) {
        if (sequence.length < 12) return;
        const key = `${game}_macd`;
        if (!this.macdMemory.has(key)) {
            this.macdMemory.set(key, {
                values: [], results: [], accuracy: 0.5, total: 0,
                patternMap: new Map()
            });
        }
        const mem = this.macdMemory.get(key);
        
        const ma6 = sequence.slice(0, 6).filter(r => r === 'T').length / 6;
        const ma12 = sequence.slice(0, 12).filter(r => r === 'T').length / 12;
        const macd = ma6 - ma12;
        
        mem.values.push(macd);
        mem.results.push(result);
        mem.total++;
        
        const key2 = macd > 0 ? 'positive' : 'negative';
        if (!mem.patternMap.has(key2)) {
            mem.patternMap.set(key2, { T: 0, X: 0 });
        }
        mem.patternMap.get(key2)[result]++;
        
        const recent2 = mem.results.slice(-30);
        const correct = recent2.filter(r => r === result).length;
        mem.accuracy = recent2.length > 0 ? correct / recent2.length : 0.5;
    }

    // Học Kalman Filter
    learnKalman(game, sequence, result) {
        if (sequence.length < 5) return;
        const key = `${game}_kalman`;
        if (!this.kalmanMemory.has(key)) {
            this.kalmanMemory.set(key, {
                values: [], results: [], accuracy: 0.5, total: 0,
                patternMap: new Map()
            });
        }
        const mem = this.kalmanMemory.get(key);
        
        const recent = sequence.slice(0, 5);
        let estimate = 0.5;
        for (let i = 0; i < recent.length; i++) {
            const z = recent[i] === 'T' ? 1 : 0;
            estimate = estimate + 0.3 * (z - estimate);
        }
        
        mem.values.push(estimate);
        mem.results.push(result);
        mem.total++;
        
        const key2 = estimate > 0.5 ? 'up' : 'down';
        if (!mem.patternMap.has(key2)) {
            mem.patternMap.set(key2, { T: 0, X: 0 });
        }
        mem.patternMap.get(key2)[result]++;
        
        const recent2 = mem.results.slice(-30);
        const correct = recent2.filter(r => r === result).length;
        mem.accuracy = recent2.length > 0 ? correct / recent2.length : 0.5;
    }

    // Học Ensemble
    learnEnsemble(game, sequence, result) {
        if (sequence.length < 5) return;
        const key = `${game}_ensemble`;
        if (!this.ensembleMemory.has(key)) {
            this.ensembleMemory.set(key, {
                values: [], results: [], accuracy: 0.5, total: 0,
                patternMap: new Map()
            });
        }
        const mem = this.ensembleMemory.get(key);
        
        // Tổng hợp nhiều chỉ báo
        const ma3 = sequence.slice(0, 3).filter(r => r === 'T').length / 3;
        const ma5 = sequence.slice(0, 5).filter(r => r === 'T').length / 5;
        const trend = ma3 - ma5;
        const volatility = sequence.slice(0, 5).filter((r, i) => i > 0 && r !== sequence[i-1]).length / 4;
        
        const score = (trend * 2 + volatility) / 3;
        
        mem.values.push(score);
        mem.results.push(result);
        mem.total++;
        
        const key2 = score > 0 ? 'up' : 'down';
        if (!mem.patternMap.has(key2)) {
            mem.patternMap.set(key2, { T: 0, X: 0 });
        }
        mem.patternMap.get(key2)[result]++;
        
        const recent2 = mem.results.slice(-30);
        const correct = recent2.filter(r => r === result).length;
        mem.accuracy = recent2.length > 0 ? correct / recent2.length : 0.5;
    }

    // Cập nhật streak
    updateStreak(game, result) {
        if (!this.streakMemory.has(game)) {
            this.streakMemory.set(game, {
                chuoi: 0, best: 0, worst: 0,
                last5: [], last10: [], last20: [], last50: []
            });
        }
        const s = this.streakMemory.get(game);
        if (result === 'T') {
            s.chuoi = s.chuoi >= 0 ? s.chuoi + 1 : 1;
        } else {
            s.chuoi = s.chuoi <= 0 ? s.chuoi - 1 : -1;
        }
        if (s.chuoi > s.best) s.best = s.chuoi;
        if (s.chuoi < s.worst) s.worst = s.chuoi;
        
        s.last5.push(result);
        s.last10.push(result);
        s.last20.push(result);
        s.last50.push(result);
        if (s.last5.length > 5) s.last5.shift();
        if (s.last10.length > 10) s.last10.shift();
        if (s.last20.length > 20) s.last20.shift();
        if (s.last50.length > 50) s.last50.shift();
    }

    // ============================================================
    // DỰ ĐOÁN SIÊU THÔNG MINH - KHÔNG LỖI
    // ============================================================
    predict(game, data) {
        // Nếu không có dữ liệu
        if (!data || data.length < 2) {
            return this.smartPredictNoData(game);
        }

        let T = 0, X = 0;
        const patterns = [];

        // 1. BỆT
        const bet = this.predictBet(game, data);
        if (bet) {
            patterns.push(bet);
            if (bet.pred === 'T') T += bet.diem;
            else X += bet.diem;
        }

        // 2. ZIGZAG
        const zigzag = this.predictZigzag(game, data);
        if (zigzag) {
            patterns.push(zigzag);
            if (zigzag.pred === 'T') T += zigzag.diem;
            else X += zigzag.diem;
        }

        // 3. ĐẢO 1-1
        const dao = this.predictDao(game, data);
        if (dao) {
            patterns.push(dao);
            if (dao.pred === 'T') T += dao.diem;
            else X += dao.diem;
        }

        // 4. CẦU 2-2
        const cau22 = this.predictCau22(game, data);
        if (cau22) {
            patterns.push(cau22);
            if (cau22.pred === 'T') T += cau22.diem;
            else X += cau22.diem;
        }

        // 5. CẦU 3-3
        const cau33 = this.predictCau33(game, data);
        if (cau33) {
            patterns.push(cau33);
            if (cau33.pred === 'T') T += cau33.diem;
            else X += cau33.diem;
        }

        // 6. CHU KỲ
        const cycle = this.predictCycle(game, data);
        if (cycle) {
            patterns.push(cycle);
            if (cycle.pred === 'T') T += cycle.diem;
            else X += cycle.diem;
        }

        // 7. XU HƯỚNG
        const trend = this.predictTrend(game, data);
        if (trend) {
            patterns.push(trend);
            if (trend.pred === 'T') T += trend.diem;
            else X += trend.diem;
        }

        // 8. CÂN BẰNG
        const balance = this.predictBalance(game, data);
        if (balance) {
            patterns.push(balance);
            if (balance.pred === 'T') T += balance.diem;
            else X += balance.diem;
        }

        // 9. MOMENTUM
        const momentum = this.predictMomentum(game, data);
        if (momentum) {
            patterns.push(momentum);
            if (momentum.pred === 'T') T += momentum.diem;
            else X += momentum.diem;
        }

        // 10. BIẾN ĐỘNG
        const volatility = this.predictVolatility(game, data);
        if (volatility) {
            patterns.push(volatility);
            if (volatility.pred === 'T') T += volatility.diem;
            else X += volatility.diem;
        }

        // 11. TƯƠNG QUAN
        const correlation = this.predictCorrelation(game, data);
        if (correlation) {
            patterns.push(correlation);
            if (correlation.pred === 'T') T += correlation.diem;
            else X += correlation.diem;
        }

        // 12. FIBONACCI
        const fib = this.predictFibonacci(game, data);
        if (fib) {
            patterns.push(fib);
            if (fib.pred === 'T') T += fib.diem;
            else X += fib.diem;
        }

        // 13. MOVING AVERAGE
        const ma = this.predictMovingAvg(game, data);
        if (ma) {
            patterns.push(ma);
            if (ma.pred === 'T') T += ma.diem;
            else X += ma.diem;
        }

        // 14. RSI
        const rsi = this.predictRSI(game, data);
        if (rsi) {
            patterns.push(rsi);
            if (rsi.pred === 'T') T += rsi.diem;
            else X += rsi.diem;
        }

        // 15. MACD
        const macd = this.predictMACD(game, data);
        if (macd) {
            patterns.push(macd);
            if (macd.pred === 'T') T += macd.diem;
            else X += macd.diem;
        }

        // 16. KALMAN
        const kalman = this.predictKalman(game, data);
        if (kalman) {
            patterns.push(kalman);
            if (kalman.pred === 'T') T += kalman.diem;
            else X += kalman.diem;
        }

        // 17. ENSEMBLE
        const ensemble = this.predictEnsemble(game, data);
        if (ensemble) {
            patterns.push(ensemble);
            if (ensemble.pred === 'T') T += ensemble.diem;
            else X += ensemble.diem;
        }

        // ĐIỀU CHỈNH THEO STREAK
        const s = this.streakMemory.get(game);
        if (s) {
            if (s.last5.length >= 5) {
                const tCount = s.last5.filter(r => r === 'T').length;
                if (tCount >= 4) { X *= 1.35; patterns.push({ name: '📊 Last5 Tài→Xỉu', pred: 'X', diem: 12 }); }
                else if (tCount <= 1) { T *= 1.35; patterns.push({ name: '📊 Last5 Xỉu→Tài', pred: 'T', diem: 12 }); }
            }
            if (s.last10.length >= 10) {
                const tCount = s.last10.filter(r => r === 'T').length;
                if (tCount >= 7) { X *= 1.25; patterns.push({ name: '📊 Last10 Tài→Xỉu', pred: 'X', diem: 10 }); }
                else if (tCount <= 3) { T *= 1.25; patterns.push({ name: '📊 Last10 Xỉu→Tài', pred: 'T', diem: 10 }); }
            }
            if (s.chuoi <= -3) {
                const temp = T;
                T = X * 1.5;
                X = temp * 1.5;
                patterns.push({ name: '🔄 Đảo chiều mạnh', pred: 'T', diem: 18 });
            } else if (s.chuoi <= -2) {
                const temp = T;
                T = X * 1.3;
                X = temp * 1.3;
                patterns.push({ name: '🔄 Đảo chiều', pred: 'T', diem: 12 });
            }
        }

        const total = T + X;
        if (total === 0) {
            return this.smartPredictNoData(game);
        }

        const pred = T > X ? 'TÀI' : 'XỈU';
        let conf = Math.round(Math.max(T, X) / total * 100);
        conf = Math.min(97, Math.max(48, conf));

        const result = pred === 'TÀI' ? 'T' : 'X';
        const detail = patterns.map(p => p.name).slice(0, 4).join(' • ');
        this.learn(game, 'main', result, conf, data.slice(0, 6).join(''));

        return {
            prediction: pred,
            confidence: conf,
            detail: detail || 'Phân tích thông minh'
        };
    }

    // ============================================================
    // DỰ ĐOÁN CÁC LOẠI CẦU - KHÔNG LỖI
    // ============================================================

    // 1. BỆT
    predictBet(game, data) {
        if (data.length < 2) return null;
        const last = data[0];
        let count = 1;
        for (let i = 1; i < data.length; i++) {
            if (data[i] === last) count++;
            else break;
        }

        if (count >= 8) {
            return { name: `🔥 Bệt siêu dài ${count}`, pred: last === 'T' ? 'X' : 'T', diem: 45 };
        }
        if (count >= 6) {
            return { name: `⚡ Bệt dài ${count}`, pred: last === 'T' ? 'X' : 'T', diem: 35 };
        }
        if (count >= 4) {
            return { name: `📈 Bệt ${count}`, pred: last === 'T' ? 'X' : 'T', diem: 25 };
        }
        if (count >= 3) {
            return { name: `📊 Bệt ngắn ${count}`, pred: last === 'T' ? 'X' : 'T', diem: 18 };
        }
        return null;
    }

    // 2. ZIGZAG
    predictZigzag(game, data) {
        if (data.length < 4) return null;
        let changes = 0;
        for (let i = 1; i < Math.min(data.length, 8); i++) {
            if (data[i-1] !== data[i]) changes++;
        }

        if (changes >= 7) {
            return { name: `⚡ Zigzag siêu dài ${changes}`, pred: data[0] === 'T' ? 'X' : 'T', diem: 35 };
        }
        if (changes >= 5) {
            return { name: `🌀 Zigzag ${changes}`, pred: data[0] === 'T' ? 'X' : 'T', diem: 25 };
        }
        if (changes >= 4) {
            return { name: `🎯 Zigzag ngắn ${changes}`, pred: data[0] === 'T' ? 'X' : 'T', diem: 18 };
        }
        return null;
    }

    // 3. ĐẢO 1-1
    predictDao(game, data) {
        if (data.length < 4) return null;
        let alt = true;
        for (let i = 0; i < 3; i++) {
            if (data[i] === data[i+1]) { alt = false; break; }
        }

        if (alt) {
            const len = data.length;
            let diem = 22;
            if (len >= 6) diem = 28;
            if (len >= 8) diem = 32;
            return { name: `🔄 Đảo 1-1 ${len >= 6 ? 'dài' : ''}`, pred: data[0] === 'T' ? 'X' : 'T', diem };
        }
        return null;
    }

    // 4. CẦU 2-2
    predictCau22(game, data) {
        if (data.length < 6) return null;
        const p1 = data[0] === data[1];
        const p2 = data[2] === data[3];
        const p3 = data[4] === data[5];
        if (p1 && p2 && p3 && data[0] !== data[2] && data[2] !== data[4]) {
            return { name: `🔄 Cầu 2-2`, pred: data[0] === 'T' ? 'X' : 'T', diem: 26 };
        }
        return null;
    }

    // 5. CẦU 3-3
    predictCau33(game, data) {
        if (data.length < 9) return null;
        const l3 = data.slice(0, 3);
        const p3 = data.slice(3, 6);
        if (l3.every(v => v === l3[0]) && p3.every(v => v === p3[0]) && l3[0] !== p3[0]) {
            return { name: `🏗️ Cầu 3-3`, pred: l3[0] === 'T' ? 'X' : 'T', diem: 28 };
        }
        return null;
    }

    // 6. CHU KỲ
    predictCycle(game, data) {
        if (data.length < 6) return null;
        for (let c = 2; c <= 3; c++) {
            if (data.length < c * 3) continue;
            const p1 = data.slice(0, c);
            const p2 = data.slice(c, c*2);
            const p3 = data.slice(c*2, c*3);
            if (p1.join('') === p2.join('') && p2.join('') === p3.join('')) {
                return { name: `🔁 Chu kỳ ${c}`, pred: p1[0] === 'T' ? 'X' : 'T', diem: 22 };
            }
        }
        return null;
    }

    // 7. XU HƯỚNG
    predictTrend(game, data) {
        if (data.length < 10) return null;
        const recent = data.slice(0, 10);
        const tCount = recent.filter(r => r === 'T').length;

        if (tCount >= 8) {
            return { name: `📈 Tài ${tCount}/10 → Xỉu`, pred: 'X', diem: 20 };
        }
        if (tCount <= 2) {
            return { name: `📉 Xỉu ${10-tCount}/10 → Tài`, pred: 'T', diem: 20 };
        }
        if (tCount >= 6) {
            return { name: `📈 Tài ${tCount}/10 → Xỉu`, pred: 'X', diem: 16 };
        }
        if (tCount <= 4) {
            return { name: `📉 Xỉu ${10-tCount}/10 → Tài`, pred: 'T', diem: 16 };
        }
        return null;
    }

    // 8. CÂN BẰNG
    predictBalance(game, data) {
        if (data.length < 20) return null;
        const recent = data.slice(0, 20);
        const tCount = recent.filter(r => r === 'T').length;

        if (tCount >= 15) {
            return { name: `⚖️ Tài ${tCount}/20 → Xỉu`, pred: 'X', diem: 18 };
        }
        if (tCount <= 5) {
            return { name: `⚖️ Xỉu ${20-tCount}/20 → Tài`, pred: 'T', diem: 18 };
        }
        if (tCount >= 13) {
            return { name: `⚖️ Tài ${tCount}/20 → Xỉu`, pred: 'X', diem: 14 };
        }
        if (tCount <= 7) {
            return { name: `⚖️ Xỉu ${20-tCount}/20 → Tài`, pred: 'T', diem: 14 };
        }
        return null;
    }

    // 9. MOMENTUM
    predictMomentum(game, data) {
        if (data.length < 5) return null;
        const recent = data.slice(0, 5);
        const tCount = recent.filter(r => r === 'T').length;

        if (tCount >= 4) {
            return { name: `📊 Đà Tài ${tCount}/5 → Xỉu`, pred: 'X', diem: 14 };
        }
        if (tCount <= 1) {
            return { name: `📊 Đà Xỉu ${5-tCount}/5 → Tài`, pred: 'T', diem: 14 };
        }
        return null;
    }

    // 10. BIẾN ĐỘNG
    predictVolatility(game, data) {
        if (data.length < 5) return null;
        let changes = 0;
        for (let i = 1; i < 5; i++) {
            if (data[i-1] !== data[i]) changes++;
        }

        if (changes >= 4) {
            return { name: `📉 Biến động ${changes}/4 → Đảo`, pred: data[0] === 'T' ? 'X' : 'T', diem: 12 };
        }
        return null;
    }

    // 11. TƯƠNG QUAN
    predictCorrelation(game, data) {
        if (data.length < 6) return null;
        let corr = 0;
        for (let i = 0; i < 3; i++) {
            if (data[i] === data[i+2]) corr++;
            else corr--;
        }

        if (corr >= 3) {
            return { name: `🔗 Tương quan dương → Theo`, pred: data[0] === 'T' ? 'T' : 'X', diem: 10 };
        }
        if (corr <= -3) {
            return { name: `🔗 Tương quan âm → Đảo`, pred: data[0] === 'T' ? 'X' : 'T', diem: 10 };
        }
        return null;
    }

    // 12. FIBONACCI
    predictFibonacci(game, data) {
        if (data.length < 8) return null;
        const fibs = [1, 1, 2, 3, 5, 8];
        let fibSum = 0;
        for (const f of fibs) {
            if (data.length > f && data[data.length - f] === 'T') fibSum++;
        }
        const ratio = fibSum / fibs.length;

        if (ratio >= 0.7) {
            return { name: `🔢 Fibonacci ${Math.round(ratio*100)}% Tài → Xỉu`, pred: 'X', diem: 12 };
        }
        if (ratio <= 0.3) {
            return { name: `🔢 Fibonacci ${Math.round(ratio*100)}% Xỉu → Tài`, pred: 'T', diem: 12 };
        }
        return null;
    }

    // 13. MOVING AVERAGE
    predictMovingAvg(game, data) {
        if (data.length < 10) return null;
        const ma5 = data.slice(0, 5).filter(r => r === 'T').length / 5;
        const ma10 = data.slice(0, 10).filter(r => r === 'T').length / 10;
        const diff = ma5 - ma10;

        if (diff > 0.3) {
            return { name: `📊 MA5>MA10 → Xỉu`, pred: 'X', diem: 12 };
        }
        if (diff < -0.3) {
            return { name: `📊 MA5<MA10 → Tài`, pred: 'T', diem: 12 };
        }
        return null;
    }

    // 14. RSI
    predictRSI(game, data) {
        if (data.length < 8) return null;
        const recent = data.slice(0, 7);
        let gains = 0, losses = 0;
        for (let i = 1; i < recent.length; i++) {
            if (recent[i-1] === 'T' && recent[i] === 'T') gains++;
            else if (recent[i-1] === 'X' && recent[i] === 'X') losses++;
        }
        const rsi = gains + losses > 0 ? gains / (gains + losses) : 0.5;

        if (rsi >= 0.7) {
            return { name: `📈 RSI ${Math.round(rsi*100)}% → Xỉu`, pred: 'X', diem: 10 };
        }
        if (rsi <= 0.3) {
            return { name: `📉 RSI ${Math.round(rsi*100)}% → Tài`, pred: 'T', diem: 10 };
        }
        return null;
    }

    // 15. MACD
    predictMACD(game, data) {
        if (data.length < 12) return null;
        const ma6 = data.slice(0, 6).filter(r => r === 'T').length / 6;
        const ma12 = data.slice(0, 12).filter(r => r === 'T').length / 12;
        const macd = ma6 - ma12;

        if (macd > 0.2) {
            return { name: `📊 MACD dương → Xỉu`, pred: 'X', diem: 10 };
        }
        if (macd < -0.2) {
            return { name: `📊 MACD âm → Tài`, pred: 'T', diem: 10 };
        }
        return null;
    }

    // 16. KALMAN
    predictKalman(game, data) {
        if (data.length < 5) return null;
        const recent = data.slice(0, 5);
        let estimate = 0.5;
        for (let i = 0; i < recent.length; i++) {
            const z = recent[i] === 'T' ? 1 : 0;
            estimate = estimate + 0.3 * (z - estimate);
        }

        if (estimate > 0.6) {
            return { name: `🎯 Kalman ${Math.round(estimate*100)}% → Xỉu`, pred: 'X', diem: 10 };
        }
        if (estimate < 0.4) {
            return { name: `🎯 Kalman ${Math.round(estimate*100)}% → Tài`, pred: 'T', diem: 10 };
        }
        return null;
    }

    // 17. ENSEMBLE
    predictEnsemble(game, data) {
        if (data.length < 5) return null;
        const ma3 = data.slice(0, 3).filter(r => r === 'T').length / 3;
        const ma5 = data.slice(0, 5).filter(r => r === 'T').length / 5;
        const trend = ma3 - ma5;
        const volatility = data.slice(0, 5).filter((r, i) => i > 0 && r !== data[i-1]).length / 4;
        const score = (trend * 2 + volatility) / 3;

        if (score > 0.3) {
            return { name: `🧠 Ensemble → Xỉu`, pred: 'X', diem: 12 };
        }
        if (score < -0.3) {
            return { name: `🧠 Ensemble → Tài`, pred: 'T', diem: 12 };
        }
        return null;
    }

    // ============================================================
    // DỰ ĐOÁN KHI CHƯA CÓ DỮ LIỆU
    // ============================================================
    smartPredictNoData(game) {
        const s = this.streakMemory.get(game);
        
        if (s) {
            if (s.chuoi <= -2) {
                return { prediction: 'TÀI', confidence: 56, detail: '🔄 Đảo chiều từ bộ nhớ' };
            }
            if (s.chuoi >= 3) {
                return { prediction: 'XỈU', confidence: 56, detail: '📊 Đảo chuỗi từ bộ nhớ' };
            }
            if (s.last5.length >= 5) {
                const tCount = s.last5.filter(r => r === 'T').length;
                if (tCount >= 4) {
                    return { prediction: 'XỈU', confidence: 58, detail: '📊 Last5 Tài→Xỉu' };
                }
                if (tCount <= 1) {
                    return { prediction: 'TÀI', confidence: 58, detail: '📊 Last5 Xỉu→Tài' };
                }
            }
        }

        const seed = Date.now() % 3;
        const preds = ['TÀI', 'XỈU', 'TÀI'];
        return {
            prediction: preds[seed],
            confidence: 52,
            detail: '📊 Phân tích thông minh'
        };
    }

    // ============================================================
    // LƯU & TẢI
    // ============================================================
    saveData() {
        try {
            const data = {
                longTerm: Object.fromEntries(this.longTermMemory),
                weights: Object.fromEntries(this.weightMemory),
                accuracy: Object.fromEntries(this.accuracyMemory),
                streak: Object.fromEntries(this.streakMemory),
                sequence: Object.fromEntries(this.sequenceMemory),
                updated: new Date().toISOString()
            };
            fs.writeFileSync(LEARNING_FILE, JSON.stringify(data, null, 2));
        } catch (e) {}
    }

    loadData() {
        try {
            if (fs.existsSync(LEARNING_FILE)) {
                const data = JSON.parse(fs.readFileSync(LEARNING_FILE, 'utf8'));
                if (data.longTerm) {
                    for (const [k, v] of Object.entries(data.longTerm)) {
                        this.longTermMemory.set(k, v);
                    }
                }
                if (data.weights) {
                    for (const [k, v] of Object.entries(data.weights)) {
                        this.weightMemory.set(k, v);
                    }
                }
                if (data.accuracy) {
                    for (const [k, v] of Object.entries(data.accuracy)) {
                        this.accuracyMemory.set(k, v);
                    }
                }
                if (data.streak) {
                    for (const [k, v] of Object.entries(data.streak)) {
                        this.streakMemory.set(k, v);
                    }
                }
                if (data.sequence) {
                    for (const [k, v] of Object.entries(data.sequence)) {
                        this.sequenceMemory.set(k, v);
                    }
                }
                console.log('🧠 Đã tải bộ nhớ siêu thông minh');
            }
        } catch (e) {}
    }

    getStats(game) {
        const s = this.streakMemory.get(game);
        return {
            chuoi: s ? s.chuoi : 0,
            chuoi_dai: s ? s.best : 0,
            totalPatterns: this.longTermMemory.size
        };
    }
}

const predictor = new SuperSmartPredictor();

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
    } else {
        s.sai++;
        s.chuoi = s.chuoi <= 0 ? s.chuoi - 1 : -1;
    }
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
                    const result = predictor.predict('hu', data);
                    const record = {
                        phien: dHu[0].phien,
                        phien_hien_tai: (dHu[0].phien + 1).toString(),
                        dice: `${dHu[0].dice1}-${dHu[0].dice2}-${dHu[0].dice3}`,
                        total: dHu[0].total,
                        actual: dHu[0].result,
                        prediction: result.prediction,
                        confidence: result.confidence,
                        detail: result.detail,
                        status: '',
                        timestamp: new Date().toISOString()
                    };
                    history.hu.unshift(record);
                    if (history.hu.length > 1000) history.hu = history.hu.slice(0, 1000);
                    lastPhien.hu = cur;
                    lastPred.hu = result;
                    console.log(`[HU] ${result.prediction} (${result.confidence}%) - ${result.detail}`);
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
                    const result = predictor.predict('md5', data);
                    const record = {
                        phien: dMd5[0].phien,
                        phien_hien_tai: (dMd5[0].phien + 1).toString(),
                        dice: `${dMd5[0].dice1}-${dMd5[0].dice2}-${dMd5[0].dice3}`,
                        total: dMd5[0].total,
                        actual: dMd5[0].result,
                        prediction: result.prediction,
                        confidence: result.confidence,
                        detail: result.detail,
                        status: '',
                        timestamp: new Date().toISOString()
                    };
                    history.md5.unshift(record);
                    if (history.md5.length > 1000) history.md5 = history.md5.slice(0, 1000);
                    lastPhien.md5 = cur;
                    lastPred.md5 = result;
                    console.log(`[MD5] ${result.prediction} (${result.confidence}%) - ${result.detail}`);
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
// 🌐 GIAO DIỆN
// ============================================================

function generateHTML(type) {
    const s = stats[type];
    const h = history[type] || [];
    const recent = h.slice(0, 25);
    
    let rows = '';
    for (const r of recent) {
        const status = r.status || '⏳';
        const cls = status === '✅' ? 'dung' : status === '❌' ? 'sai' : 'cho';
        const txt = status === '✅' ? 'ĐÚNG' : status === '❌' ? 'SAI' : 'CHỜ';
        rows += `
            <tr>
                <td>#${r.phien_hien_tai || '-'}</td>
                <td><span class="pred ${r.prediction === 'TÀI' ? 'tai' : 'xiu'}">${r.prediction || '-'}</span></td>
                <td>${r.confidence || 0}%</td>
                <td><span class="status ${cls}">${txt}</span></td>
                <td>${r.actual || '-'}</td>
                <td class="detail">${r.detail ? r.detail.substring(0, 20) + (r.detail.length > 20 ? '...' : '') : '-'}</td>
            </tr>
        `;
    }

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🌌 TX - Anh Khôi</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0a0a14;
            color: #e0e0e0;
            padding: 10px;
            min-height: 100vh;
        }
        .container { max-width: 1100px; margin: 0 auto; }
        
        .header {
            background: rgba(255,255,255,0.03);
            border-radius: 12px;
            padding: 14px 20px;
            margin-bottom: 12px;
            border: 1px solid rgba(255,255,255,0.05);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
        }
        .logo { font-size: 18px; font-weight: 800; background: linear-gradient(135deg, #7b2ffc, #00d4ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .logo small { -webkit-text-fill-color: #445566; font-weight: 400; font-size: 12px; }
        .badge { padding: 3px 14px; border-radius: 16px; font-size: 10px; background: rgba(123,47,252,0.08); border: 1px solid rgba(123,47,252,0.08); color: #a78bfa; }
        .badge .live { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: #4ade80; margin-right: 5px; animation: blink 1s infinite; }
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 6px;
            margin-bottom: 12px;
        }
        .stat {
            background: rgba(255,255,255,0.02);
            border-radius: 10px;
            padding: 8px 10px;
            border: 1px solid rgba(255,255,255,0.03);
            text-align: center;
        }
        .stat .label { font-size: 8px; text-transform: uppercase; color: #445566; letter-spacing: 0.5px; }
        .stat .value { font-size: 16px; font-weight: 700; margin-top: 1px; }
        .stat .value.green { color: #4ade80; }
        .stat .value.red { color: #f87171; }
        .stat .value.orange { color: #fb923c; }
        .stat .value.blue { color: #60a5fa; }
        .stat .value.purple { color: #a78bfa; }
        .stat .value.cyan { color: #22d3ee; }
        .stat .sub { font-size: 8px; color: #334455; margin-top: 1px; }
        
        .table-wrap {
            background: rgba(255,255,255,0.015);
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.03);
            overflow: hidden;
        }
        .table-wrap .head {
            display: flex;
            justify-content: space-between;
            padding: 8px 14px;
            border-bottom: 1px solid rgba(255,255,255,0.03);
            font-size: 12px;
            font-weight: 600;
            color: #a0a0a0;
        }
        .table-wrap .head .count { font-size: 10px; color: #334455; font-weight: 400; }
        
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { padding: 6px 10px; text-align: left; font-size: 8px; text-transform: uppercase; color: #334455; letter-spacing: 0.5px; background: rgba(255,255,255,0.01); }
        td { padding: 5px 10px; border-bottom: 1px solid rgba(255,255,255,0.015); }
        tr:hover td { background: rgba(255,255,255,0.01); }
        
        .pred { display: inline-block; padding: 1px 8px; border-radius: 4px; font-weight: 700; font-size: 10px; }
        .pred.tai { background: rgba(74,222,128,0.08); color: #4ade80; }
        .pred.xiu { background: rgba(248,113,113,0.08); color: #f87171; }
        .status { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 8px; font-weight: 700; }
        .status.dung { background: rgba(74,222,128,0.08); color: #4ade80; }
        .status.sai { background: rgba(248,113,113,0.08); color: #f87171; }
        .status.cho { background: rgba(251,146,60,0.08); color: #fb923c; }
        .detail { font-size: 9px; color: #445566; max-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        
        .footer { text-align: center; padding: 10px; color: #223344; font-size: 9px; margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.02); }
        .footer .hl { color: #a78bfa; }
        
        @media (max-width: 700px) {
            .stats { grid-template-columns: repeat(3, 1fr); }
            table { font-size: 10px; }
            th, td { padding: 4px 6px; }
            .detail { max-width: 60px; }
        }
        @media (max-width: 400px) {
            .stats { grid-template-columns: repeat(2, 1fr); }
            th, td { padding: 3px 4px; font-size: 9px; }
            .pred { font-size: 8px; padding: 1px 5px; }
            .header { padding: 10px 14px; }
            .logo { font-size: 14px; }
        }
        ::-webkit-scrollbar { width: 2px; }
        ::-webkit-scrollbar-thumb { background: rgba(123,47,252,0.1); border-radius: 1px; }
    </style>
</head>
<body>
<div class="container">
    <div class="header">
        <div class="logo">🌌 TX <small>• Anh Khôi</small></div>
        <div class="badge"><span class="live"></span>${type.toUpperCase()}</div>
    </div>
    
    <div class="stats">
        <div class="stat"><div class="label">Tổng</div><div class="value blue">${s.total}</div></div>
        <div class="stat"><div class="label">✅ Đúng</div><div class="value green">${s.dung}</div></div>
        <div class="stat"><div class="label">❌ Sai</div><div class="value red">${s.sai}</div></div>
        <div class="stat"><div class="label">📊 Tỷ lệ</div><div class="value ${s.tyle >= 60 ? 'green' : s.tyle >= 50 ? 'orange' : 'red'}">${s.tyle}%</div></div>
        <div class="stat"><div class="label">⚡ Chuỗi</div><div class="value ${s.chuoi > 0 ? 'green' : s.chuoi < 0 ? 'red' : 'orange'}">${s.chuoi > 0 ? '+' + s.chuoi : s.chuoi}</div></div>
        <div class="stat"><div class="label">🏆 Dài nhất</div><div class="value cyan">${s.chuoi_dai}</div></div>
    </div>
    
    <div class="table-wrap">
        <div class="head">📋 LỊCH SỬ <span class="count">${h.length} phiên</span></div>
        <table>
            <thead><tr><th>Phiên</th><th>Dự Đoán</th><th>Độ Tin</th><th>KQ</th><th>Thực Tế</th><th>Phân Tích</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="6" style="text-align:center;padding:20px;color:#334455;">⏳ Đang chờ dữ liệu...</td></tr>'}</tbody>
        </table>
    </div>
    
    <div class="footer">🌌 <span class="hl">TX Universe</span> • 17 thuật toán thông minh • Tự động cập nhật 5s</div>
</div>
<script>setTimeout(()=>location.reload(),5000);</script>
</body>
</html>
    `;
}

// ============================================================
// 🔌 API
// ============================================================

app.get('/', (req, res) => res.json({ name: 'TX Universe', version: '7.0', author: 'Anh Khôi' }));

app.get('/lc79-hu', async (req, res) => {
    try {
        const data = await fetchData('hu');
        if (!data || data.length === 0) {
            const result = predictor.smartPredictNoData('hu');
            return res.json({ prediction: result.prediction, confidence: result.confidence, detail: result.detail, noData: true });
        }
        const exist = history.hu.find(h => h.phien_hien_tai === (data[0].phien + 1).toString());
        if (exist) return res.json(exist);
        
        const historyData = data.map(d => d.result === 'TÀI' ? 'T' : 'X');
        const result = predictor.predict('hu', historyData);
        const record = {
            phien: data[0].phien,
            phien_hien_tai: (data[0].phien + 1).toString(),
            dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`,
            total: data[0].total,
            actual: data[0].result,
            prediction: result.prediction,
            confidence: result.confidence,
            detail: result.detail,
            status: '',
            timestamp: new Date().toISOString()
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
            const result = predictor.smartPredictNoData('md5');
            return res.json({ prediction: result.prediction, confidence: result.confidence, detail: result.detail, noData: true });
        }
        const exist = history.md5.find(h => h.phien_hien_tai === (data[0].phien + 1).toString());
        if (exist) return res.json(exist);
        
        const historyData = data.map(d => d.result === 'TÀI' ? 'T' : 'X');
        const result = predictor.predict('md5', historyData);
        const record = {
            phien: data[0].phien,
            phien_hien_tai: (data[0].phien + 1).toString(),
            dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`,
            total: data[0].total,
            actual: data[0].result,
            prediction: result.prediction,
            confidence: result.confidence,
            detail: result.detail,
            status: '',
            timestamp: new Date().toISOString()
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
        learning: {
            hu: predictor.getStats('hu'),
            md5: predictor.getStats('md5')
        },
        lastPred
    });
});

app.get('/reset', (req, res) => {
    history = { hu: [], md5: [] };
    stats = {
        hu: { total: 0, dung: 0, sai: 0, tyle: 0, chuoi: 0, chuoi_dai: 0 },
        md5: { total: 0, dung: 0, sai: 0, tyle: 0, chuoi: 0, chuoi_dai: 0 }
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
    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║  🌌 TX UNIVERSE v7.0 - ANH KHÔI       ║');
    console.log('║  🧠 17 THUẬT TOÁN THÔNG MINH          ║');
    console.log(`║  📡 http://0.0.0.0:${PORT}             ║`);
    console.log('║  🎯 Bệt • Zigzag • Đảo • Cầu 2-2     ║');
    console.log('║  🎯 Cầu 3-3 • Chu kỳ • Xu hướng       ║');
    console.log('║  🎯 Cân bằng • Momentum • Biến động    ║');
    console.log('║  🎯 Tương quan • Fibonacci • MA        ║');
    console.log('║  🎯 RSI • MACD • Kalman • Ensemble    ║');
    console.log('║  📁 himinhlaanhkhoi_history.json      ║');
    console.log('║  📁 himinhlaanhkhoi_learning.json     ║');
    console.log('╚═══════════════════════════════════════════╝\n');
    startAuto();
});
