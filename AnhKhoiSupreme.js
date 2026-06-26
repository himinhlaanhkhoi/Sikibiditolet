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
// 📊 LỊCH SỬ
// ============================================================
let history = {
    hu: [],
    md5: []
};

let stats = {
    hu: { total: 0, correct: 0, wrong: 0, accuracy: 0, streak: 0, bestStreak: 0, worstStreak: 0, last10: [], last50: [] },
    md5: { total: 0, correct: 0, wrong: 0, accuracy: 0, streak: 0, bestStreak: 0, worstStreak: 0, last10: [], last50: [] }
};

const MAX_HISTORY = 1000;
const AUTO_SAVE_INTERVAL = 6000;
let lastPhien = { hu: null, md5: null };
let processing = { hu: false, md5: false };
let lastPredictions = { hu: null, md5: null };

// ============================================================
// 🧠 HỆ THỐNG THÍCH NGHI SIÊU CẤP - KHÔNG CẦN DỮ LIỆU
// ============================================================
class SuperAdaptiveEngine {
    constructor() {
        // Bộ nhớ chính
        this.patternDB = new Map();
        this.sequenceDB = new Map();
        this.weightDB = new Map();
        this.accuracyDB = new Map();
        this.streakDB = new Map();
        this.patternHistory = new Map();
        
        // Bộ nhớ chuyên biệt
        this.betMemory = new Map();
        this.zigzagMemory = new Map();
        this.dao11Memory = new Map();
        this.dao22Memory = new Map();
        this.cycleMemory = new Map();
        this.trendMemory = new Map();
        this.breakMemory = new Map();
        this.balanceMemory = new Map();
        
        // Bộ nhớ dự đoán siêu cấp - KHÔNG CẦN DỮ LIỆU
        this.smartFallback = new Map();
        this.emergencyPatterns = [];
        this.predictionCache = new Map();
        this.confidenceHistory = new Map();
        
        // Hệ số tiến hoá
        this.evolutionFactor = 0;
        this.learningSpeed = 0.25;
        this.balanceThreshold = 0.6;
        
        // Khởi tạo pattern dự phòng siêu cấp
        this.initSuperPatterns();
        
        // Tải dữ liệu học
        this.loadLearningData();
    }

    // Khởi tạo pattern dự phòng để dự đoán KHÔNG CẦN DỮ LIỆU
    initSuperPatterns() {
        this.emergencyPatterns = [
            { pattern: 'bet_short', weight: 0.7, confidence: 58, desc: 'Bệt ngắn' },
            { pattern: 'bet_medium', weight: 0.8, confidence: 65, desc: 'Bệt vừa' },
            { pattern: 'bet_long', weight: 0.9, confidence: 72, desc: 'Bệt dài' },
            { pattern: 'dao_11', weight: 0.85, confidence: 68, desc: 'Đảo 1-1' },
            { pattern: 'dao_22', weight: 0.8, confidence: 62, desc: 'Đảo 2-2' },
            { pattern: 'zigzag_short', weight: 0.75, confidence: 60, desc: 'Zigzag ngắn' },
            { pattern: 'zigzag_long', weight: 0.85, confidence: 68, desc: 'Zigzag dài' },
            { pattern: 'cycle_2', weight: 0.7, confidence: 58, desc: 'Chu kỳ 2' },
            { pattern: 'cycle_3', weight: 0.75, confidence: 62, desc: 'Chu kỳ 3' },
            { pattern: 'trend_tai', weight: 0.7, confidence: 56, desc: 'Xu hướng Tài' },
            { pattern: 'trend_xiu', weight: 0.7, confidence: 56, desc: 'Xu hướng Xỉu' },
            { pattern: 'break_after_bet', weight: 0.8, confidence: 64, desc: 'Gãy sau bệt' }
        ];
        
        // Khởi tạo weight mặc định
        for (const p of this.emergencyPatterns) {
            const key = `emergency_${p.pattern}`;
            this.weightDB.set(key, p.weight * 100);
            this.accuracyDB.set(key, 0.5 + (p.confidence - 50) / 100);
        }
    }

    // Tải dữ liệu học từ file
    loadLearningData() {
        try {
            if (fs.existsSync(LEARNING_FILE)) {
                const data = JSON.parse(fs.readFileSync(LEARNING_FILE, 'utf8'));
                if (data.patternDB) {
                    for (const [key, value] of Object.entries(data.patternDB)) {
                        this.patternDB.set(key, value);
                    }
                }
                if (data.weightDB) {
                    for (const [key, value] of Object.entries(data.weightDB)) {
                        this.weightDB.set(key, value);
                    }
                }
                if (data.accuracyDB) {
                    for (const [key, value] of Object.entries(data.accuracyDB)) {
                        this.accuracyDB.set(key, value);
                    }
                }
                console.log('🧠 Đã tải dữ liệu học siêu cấp');
            }
        } catch (error) {
            console.log('📝 Chưa có dữ liệu học, sử dụng pattern dự phòng');
        }
    }

    // Lưu dữ liệu học
    saveLearningData() {
        try {
            const data = {
                patternDB: Object.fromEntries(this.patternDB),
                weightDB: Object.fromEntries(this.weightDB),
                accuracyDB: Object.fromEntries(this.accuracyDB),
                updated: new Date().toISOString()
            };
            fs.writeFileSync(LEARNING_FILE, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Lỗi lưu dữ liệu học:', error.message);
        }
    }

    // Học siêu cấp
    learn(gameId, pattern, result, confidence, sequence, totalPatterns) {
        const key = `${gameId}_${pattern}`;
        
        // Cập nhật Pattern DB
        if (!this.patternDB.has(key)) {
            this.patternDB.set(key, { 
                T: 0, X: 0, total: 0, correct: 0, 
                history: [], confidence: [],
                lastResult: null, streak: 0, evolution: 0,
                firstSeen: Date.now(), lastSeen: Date.now()
            });
        }
        const db = this.patternDB.get(key);
        db[result] = (db[result] || 0) + 1;
        db.total++;
        db.history.push(result);
        db.confidence.push(confidence);
        db.lastResult = result;
        db.lastSeen = Date.now();
        db.evolution += confidence / 100;
        
        if (db.history.length > 100) db.history.shift();
        if (db.confidence.length > 100) db.confidence.shift();

        // Tính độ chính xác với trọng số thời gian
        const recent = db.history.slice(-20);
        const recentConf = db.confidence.slice(-20);
        let weightedCorrect = 0;
        let weightedTotal = 0;
        for (let i = 0; i < recent.length; i++) {
            const w = (recentConf[i] || 50) / 50;
            if (recent[i] === result) weightedCorrect += w;
            weightedTotal += w;
        }
        db.correct = weightedTotal > 0 ? Math.min(1, weightedCorrect / weightedTotal) : 0.5;

        // Học các loại cầu đặc biệt
        this.learnSuperPatterns(gameId, sequence, result);

        // Cập nhật weight siêu thông minh
        let weight = 20 + (db.correct - 0.3) * 200;
        const avgConf = db.confidence.slice(-10).reduce((a,b) => a+b, 0) / Math.min(db.confidence.length, 10);
        if (avgConf > 70) weight *= 1.2;
        if (avgConf > 80) weight *= 1.15;
        if (avgConf < 50) weight *= 0.85;
        if (db.total > 30) weight *= 1.08;
        if (db.total > 50) weight *= 1.05;
        weight *= (1 + db.evolution * 0.003);
        
        weight = Math.max(10, Math.min(250, weight));
        this.weightDB.set(key, weight);
        this.accuracyDB.set(key, db.correct);

        // Cập nhật streak
        this.updateSuperStreak(gameId, result);

        // Lưu pattern history
        if (!this.patternHistory.has(gameId)) {
            this.patternHistory.set(gameId, []);
        }
        const ph = this.patternHistory.get(gameId);
        ph.push({ pattern, result, confidence, time: Date.now(), weight, evolution: db.evolution });
        if (ph.length > 500) ph.shift();

        // Cập nhật cache dự đoán
        const cacheKey = `${gameId}_${sequence || 'none'}`;
        this.predictionCache.set(cacheKey, { result, confidence, time: Date.now() });

        // Lưu dữ liệu học
        this.saveLearningData();
    }

    // Học các pattern đặc biệt siêu cấp
    learnSuperPatterns(gameId, sequence, result) {
        if (!sequence || sequence.length < 2) return;

        // Học Bệt siêu cấp
        this.learnSuperBet(gameId, sequence, result);
        
        // Học Zigzag siêu cấp
        this.learnSuperZigzag(gameId, sequence, result);
        
        // Học Đảo 1-1 siêu cấp
        this.learnSuperDao11(gameId, sequence, result);
        
        // Học Đảo 2-2 siêu cấp
        this.learnSuperDao22(gameId, sequence, result);
        
        // Học Chu kỳ siêu cấp
        this.learnSuperCycle(gameId, sequence, result);
        
        // Học Xu hướng siêu cấp
        this.learnSuperTrend(gameId, sequence, result);
        
        // Học Gãy cầu siêu cấp
        this.learnSuperBreak(gameId, sequence, result);
        
        // Học Cân bằng siêu cấp
        this.learnSuperBalance(gameId, sequence, result);
    }

    // Học Bệt siêu cấp
    learnSuperBet(gameId, sequence, result) {
        const key = `${gameId}_bet`;
        if (!this.betMemory.has(key)) {
            this.betMemory.set(key, { 
                lengths: [], results: [], accuracy: 0.5, total: 0,
                patternMap: new Map(),
                bestLength: 0, worstLength: 999,
                avgLength: 0, lastLength: 0
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
        mem.lastLength = count;
        if (count > mem.bestLength) mem.bestLength = count;
        if (count < mem.worstLength) mem.worstLength = count;
        mem.avgLength = mem.lengths.reduce((a,b) => a+b, 0) / mem.lengths.length;
        
        const key2 = `len_${count}`;
        if (!mem.patternMap.has(key2)) {
            mem.patternMap.set(key2, { T: 0, X: 0 });
        }
        mem.patternMap.get(key2)[result]++;
        
        const recent = mem.results.slice(-30);
        const correct = recent.filter(r => r === result).length;
        mem.accuracy = recent.length > 0 ? correct / recent.length : 0.5;
    }

    // Học Zigzag siêu cấp
    learnSuperZigzag(gameId, sequence, result) {
        const key = `${gameId}_zigzag`;
        if (!this.zigzagMemory.has(key)) {
            this.zigzagMemory.set(key, { 
                changes: [], results: [], accuracy: 0.5, total: 0,
                patternMap: new Map(),
                maxChanges: 0, avgChanges: 0
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

    // Học Đảo 1-1 siêu cấp
    learnSuperDao11(gameId, sequence, result) {
        if (sequence.length < 4) return;
        const key = `${gameId}_dao11`;
        if (!this.dao11Memory.has(key)) {
            this.dao11Memory.set(key, { 
                patterns: [], results: [], accuracy: 0.5, total: 0,
                patternMap: new Map(),
                lastPattern: null, streak: 0
            });
        }
        const mem = this.dao11Memory.get(key);
        
        let isAlt = true;
        for (let i = 0; i < 3; i++) {
            if (sequence[i] === sequence[i+1]) { isAlt = false; break; }
        }
        
        if (isAlt) {
            mem.patterns.push('11');
            mem.results.push(result);
            mem.total++;
            if (!mem.patternMap.has('11')) {
                mem.patternMap.set('11', { T: 0, X: 0 });
            }
            mem.patternMap.get('11')[result]++;
            mem.lastPattern = '11';
            mem.streak++;
            
            const recent = mem.results.slice(-30);
            const correct = recent.filter(r => r === result).length;
            mem.accuracy = recent.length > 0 ? correct / recent.length : 0.5;
        } else {
            mem.streak = 0;
        }
    }

    // Học Đảo 2-2 siêu cấp
    learnSuperDao22(gameId, sequence, result) {
        if (sequence.length < 6) return;
        const key = `${gameId}_dao22`;
        if (!this.dao22Memory.has(key)) {
            this.dao22Memory.set(key, { 
                patterns: [], results: [], accuracy: 0.5, total: 0,
                patternMap: new Map(),
                lastPattern: null, streak: 0
            });
        }
        const mem = this.dao22Memory.get(key);
        
        let isPair = true;
        for (let i = 0; i < 3; i++) {
            if (sequence[i*2] !== sequence[i*2+1]) { isPair = false; break; }
        }
        if (isPair && sequence[0] !== sequence[2]) {
            mem.patterns.push('22');
            mem.results.push(result);
            mem.total++;
            if (!mem.patternMap.has('22')) {
                mem.patternMap.set('22', { T: 0, X: 0 });
            }
            mem.patternMap.get('22')[result]++;
            mem.lastPattern = '22';
            mem.streak++;
            
            const recent = mem.results.slice(-30);
            const correct = recent.filter(r => r === result).length;
            mem.accuracy = recent.length > 0 ? correct / recent.length : 0.5;
        } else {
            mem.streak = 0;
        }
    }

    // Học Chu kỳ siêu cấp
    learnSuperCycle(gameId, sequence, result) {
        if (sequence.length < 6) return;
        const key = `${gameId}_cycle`;
        if (!this.cycleMemory.has(key)) {
            this.cycleMemory.set(key, { 
                cycles: [], results: [], accuracy: 0.5, total: 0,
                patternMap: new Map(),
                detectedCycles: new Set()
            });
        }
        const mem = this.cycleMemory.get(key);
        
        for (let cycle = 2; cycle <= 4; cycle++) {
            if (sequence.length < cycle * 3) continue;
            const p1 = sequence.slice(0, cycle);
            const p2 = sequence.slice(cycle, cycle*2);
            const p3 = sequence.slice(cycle*2, cycle*3);
            if (p1.join('') === p2.join('') && p2.join('') === p3.join('')) {
                const key2 = `cyc_${cycle}`;
                if (!mem.patternMap.has(key2)) {
                    mem.patternMap.set(key2, { T: 0, X: 0 });
                }
                mem.patternMap.get(key2)[result]++;
                mem.total++;
                mem.detectedCycles.add(cycle);
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

    // Học Xu hướng siêu cấp
    learnSuperTrend(gameId, sequence, result) {
        if (sequence.length < 5) return;
        const key = `${gameId}_trend`;
        if (!this.trendMemory.has(key)) {
            this.trendMemory.set(key, { 
                trends: [], results: [], accuracy: 0.5, total: 0,
                patternMap: new Map(),
                currentTrend: null, trendStrength: 0
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

    // Học Gãy cầu siêu cấp
    learnSuperBreak(gameId, sequence, result) {
        if (sequence.length < 4) return;
        const key = `${gameId}_break`;
        if (!this.breakMemory.has(key)) {
            this.breakMemory.set(key, { 
                breaks: [], results: [], accuracy: 0.5, total: 0,
                patternMap: new Map(),
                breakTypes: new Set()
            });
        }
        const mem = this.breakMemory.get(key);
        
        const first = sequence[0];
        let count = 1;
        for (let i = 1; i < sequence.length; i++) {
            if (sequence[i] === first) count++;
            else break;
        }
        if (count >= 3 && sequence.length > count + 1) {
            const breakResult = sequence[count];
            if (breakResult !== first) {
                const key2 = `${first}->${breakResult}`;
                if (!mem.patternMap.has(key2)) {
                    mem.patternMap.set(key2, { T: 0, X: 0 });
                }
                mem.patternMap.get(key2)[result]++;
                mem.total++;
                mem.results.push(result);
                mem.breakTypes.add(key2);
                
                const recent = mem.results.slice(-30);
                const correct = recent.filter(r => r === result).length;
                mem.accuracy = recent.length > 0 ? correct / recent.length : 0.5;
            }
        }
    }

    // Học Cân bằng siêu cấp
    learnSuperBalance(gameId, sequence, result) {
        if (sequence.length < 10) return;
        const key = `${gameId}_balance`;
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

    // Cập nhật streak siêu cấp
    updateSuperStreak(gameId, result) {
        if (!this.streakDB.has(gameId)) {
            this.streakDB.set(gameId, { streak: 0, best: 0, worst: 0, last5: [], last10: [], last20: [] });
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
        streak.last20.push(result);
        if (streak.last5.length > 5) streak.last5.shift();
        if (streak.last10.length > 10) streak.last10.shift();
        if (streak.last20.length > 20) streak.last20.shift();
    }

    // ============================================================
    // DỰ ĐOÁN SIÊU CẤP - KHÔNG CẦN DỮ LIỆU
    // ============================================================
    superPredict(gameId, patterns, historyData) {
        // Nếu không có pattern, dùng dự đoán thông minh không cần dữ liệu
        if (!patterns || patterns.length === 0) {
            return this.superPredictNoData(gameId, historyData);
        }

        let tScore = 0, xScore = 0;
        let tWeight = 0, xWeight = 0;
        let totalWeight = 0;
        const usedPatterns = [];
        let patternCount = 0;
        let totalConfidence = 0;

        // Phân tích từng pattern
        for (const p of patterns) {
            const key = `${gameId}_${p.pattern}`;
            const weight = this.weightDB.get(key) || 50;
            const accuracy = this.accuracyDB.get(key) || 0.5;
            
            // Điều chỉnh weight siêu thông minh
            let finalWeight = weight * (0.2 + accuracy * 0.8);
            
            // Điều chỉnh confidence siêu cấp
            let conf = p.confidence;
            if (accuracy > 0.7) conf *= 1.25;
            else if (accuracy > 0.6) conf *= 1.1;
            else if (accuracy > 0.5) conf *= 1.0;
            else if (accuracy > 0.4) conf *= 0.9;
            else conf *= 0.75;
            
            // Boost cho pattern đang hot
            const cacheKey = `${gameId}_${p.pattern}`;
            if (this.confidenceHistory.has(cacheKey)) {
                const history = this.confidenceHistory.get(cacheKey);
                const recentAvg = history.slice(-5).reduce((a,b) => a+b, 0) / Math.min(history.length, 5);
                if (recentAvg > 65) conf *= 1.1;
            }
            
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
            patternCount++;
        }

        // ====== BẮT CÁC LOẠI CẦU ĐẶC BIỆT SIÊU CẤP ======
        
        // 1. BẮT CẦU BỆT SIÊU CẤP
        const betResult = this.superPredictBet(gameId, historyData);
        if (betResult) {
            const w = 1.35;
            if (betResult === 'T') {
                tScore *= w;
                tWeight *= w;
            } else {
                xScore *= w;
                xWeight *= w;
            }
            usedPatterns.push(`🔥 Bệt: ${betResult === 'T' ? 'Tài' : 'Xỉu'}`);
        }

        // 2. BẮT CẦU ZIGZAG SIÊU CẤP
        const zigzagResult = this.superPredictZigzag(gameId, historyData);
        if (zigzagResult) {
            const w = 1.3;
            if (zigzagResult === 'T') {
                tScore *= w;
                tWeight *= w;
            } else {
                xScore *= w;
                xWeight *= w;
            }
            usedPatterns.push(`⚡ Zigzag: ${zigzagResult === 'T' ? 'Tài' : 'Xỉu'}`);
        }

        // 3. BẮT CẦU 1-1 SIÊU CẤP
        const dao11Result = this.superPredictDao11(gameId, historyData);
        if (dao11Result) {
            const w = 1.25;
            if (dao11Result === 'T') {
                tScore *= w;
                tWeight *= w;
            } else {
                xScore *= w;
                xWeight *= w;
            }
            usedPatterns.push(`🔄 Đảo 1-1: ${dao11Result === 'T' ? 'Tài' : 'Xỉu'}`);
        }

        // 4. BẮT CẦU 2-2 SIÊU CẤP
        const dao22Result = this.superPredictDao22(gameId, historyData);
        if (dao22Result) {
            const w = 1.2;
            if (dao22Result === 'T') {
                tScore *= w;
                tWeight *= w;
            } else {
                xScore *= w;
                xWeight *= w;
            }
            usedPatterns.push(`🔄 Đảo 2-2: ${dao22Result === 'T' ? 'Tài' : 'Xỉu'}`);
        }

        // 5. BẮT CHU KỲ SIÊU CẤP
        const cycleResult = this.superPredictCycle(gameId, historyData);
        if (cycleResult) {
            const w = 1.15;
            if (cycleResult === 'T') {
                tScore *= w;
                tWeight *= w;
            } else {
                xScore *= w;
                xWeight *= w;
            }
            usedPatterns.push(`🔁 Chu kỳ: ${cycleResult === 'T' ? 'Tài' : 'Xỉu'}`);
        }

        // 6. BẮT XU HƯỚNG SIÊU CẤP
        const trendResult = this.superPredictTrend(gameId, historyData);
        if (trendResult) {
            const w = 1.15;
            if (trendResult === 'T') {
                tScore *= w;
                tWeight *= w;
            } else {
                xScore *= w;
                xWeight *= w;
            }
            usedPatterns.push(`📈 Xu hướng: ${trendResult === 'T' ? 'Tài' : 'Xỉu'}`);
        }

        // 7. BẮT GÃY CẦU SIÊU CẤP
        const breakResult = this.superPredictBreak(gameId, historyData);
        if (breakResult) {
            const w = 1.15;
            if (breakResult === 'T') {
                tScore *= w;
                tWeight *= w;
            } else {
                xScore *= w;
                xWeight *= w;
            }
            usedPatterns.push(`💥 Gãy cầu: ${breakResult === 'T' ? 'Tài' : 'Xỉu'}`);
        }

        // 8. BẮT CÂN BẰNG SIÊU CẤP
        const balanceResult = this.superPredictBalance(gameId, historyData);
        if (balanceResult) {
            const w = 1.1;
            if (balanceResult === 'T') {
                tScore *= w;
                tWeight *= w;
            } else {
                xScore *= w;
                xWeight *= w;
            }
            usedPatterns.push(`⚖️ Cân bằng: ${balanceResult === 'T' ? 'Tài' : 'Xỉu'}`);
        }

        // ====== ĐIỀU CHỈNH SIÊU CẤP ======
        
        // Điều chỉnh theo streak siêu thông minh
        const streak = this.streakDB.get(gameId);
        if (streak) {
            // Phân tích last5
            if (streak.last5.length >= 5) {
                const tCount = streak.last5.filter(r => r === 'T').length;
                if (tCount >= 4) {
                    xScore *= 1.2;
                    usedPatterns.push('📊 Last5 Tài nhiều → Xỉu');
                } else if (tCount <= 1) {
                    tScore *= 1.2;
                    usedPatterns.push('📊 Last5 Xỉu nhiều → Tài');
                }
            }
            
            // Phân tích last10
            if (streak.last10.length >= 10) {
                const tCount = streak.last10.filter(r => r === 'T').length;
                if (tCount >= 7) {
                    xScore *= 1.15;
                    usedPatterns.push('📊 Last10 Tài áp đảo → Xỉu');
                } else if (tCount <= 3) {
                    tScore *= 1.15;
                    usedPatterns.push('📊 Last10 Xỉu áp đảo → Tài');
                }
            }
            
            // Phân tích last20
            if (streak.last20.length >= 20) {
                const tCount = streak.last20.filter(r => r === 'T').length;
                if (tCount >= 14) {
                    xScore *= 1.1;
                    usedPatterns.push('📊 Last20 Tài quá nhiều → Xỉu');
                } else if (tCount <= 6) {
                    tScore *= 1.1;
                    usedPatterns.push('📊 Last20 Xỉu quá nhiều → Tài');
                }
            }

            // Điều chỉnh theo streak
            if (streak.streak <= -3) {
                const temp = tScore;
                tScore = xScore * 1.35;
                xScore = temp * 1.35;
                usedPatterns.push('🔄 Đảo chiều mạnh do thua');
            } else if (streak.streak <= -2) {
                const temp = tScore;
                tScore = xScore * 1.2;
                xScore = temp * 1.2;
                usedPatterns.push('🔄 Đảo chiều do thua');
            } else if (streak.streak >= 5) {
                tScore *= 1.1;
                xScore *= 1.1;
                usedPatterns.push('🔥 Đang thắng lớn');
            }
        }

        // Tính tổng và quyết định
        const total = tScore + xScore;
        if (total === 0) {
            return this.superPredictNoData(gameId, historyData);
        }

        let prediction = tScore > xScore ? 'TÀI' : 'XỈU';
        let confidence = Math.round(Math.max(tScore, xScore) / total * 100);
        
        // Điều chỉnh confidence siêu cấp
        if (totalWeight > 0) {
            const avgWeight = totalWeight / Math.max(1, patternCount);
            if (avgWeight > 80) confidence = Math.min(99, confidence + 10);
            else if (avgWeight > 60) confidence = Math.min(97, confidence + 6);
            else if (avgWeight < 30) confidence = Math.max(45, confidence - 6);
        }

        // Điều chỉnh confidence dựa trên số pattern
        if (patternCount >= 5) confidence = Math.min(99, confidence + 3);
        if (patternCount >= 3) confidence = Math.min(97, confidence + 2);

        // Giới hạn confidence
        confidence = Math.min(99, Math.max(45, confidence));

        // Lưu confidence history        const confKey = `${gameId}_${prediction}`;
        if (!this.confidenceHistory.has(confKey)) {
            this.confidenceHistory.set(confKey, []);
        }
        const confHist = this.confidenceHistory.get(confKey);
        confHist.push(confidence);
        if (confHist.length > 50) confHist.shift();

        // Lưu vào học
        const result = prediction === 'TÀI' ? 'T' : 'X';
        const patternKey = usedPatterns.join('|') || 'basic';
        this.learn(gameId, patternKey, result, confidence, historyData.slice(0, 8).join(''), patternCount);

        return {
            prediction,
            confidence,
            patterns: usedPatterns.slice(0, 5),
            detail: usedPatterns.slice(0, 3).join(' • '),
            totalPatterns: patternCount,
            tScore: Math.round(tScore),
            xScore: Math.round(xScore),
            usedPatterns: usedPatterns.length
        };
    }

    // ============================================================
    // DỰ ĐOÁN KHÔNG CẦN DỮ LIỆU - SIÊU CẤP
    // ============================================================
    superPredictNoData(gameId, historyData) {
        // Nếu có dữ liệu lịch sử, phân tích ngay cả khi không có pattern
        if (historyData && historyData.length >= 2) {
            return this.analyzeFromHistory(gameId, historyData);
        }

        // Hoàn toàn không có dữ liệu - dùng pattern dự phòng
        return this.emergencyPredict(gameId);
    }

    // Phân tích từ lịch sử ngay cả khi không có pattern
    analyzeFromHistory(gameId, history) {
        if (history.length < 2) {
            return this.emergencyPredict(gameId);
        }

        const last = history[0];
        let count = 1;
        for (let i = 1; i < history.length; i++) {
            if (history[i] === last) count++;
            else break;
        }

        // Phân tích bệt
        if (count >= 6) {
            const pred = last === 'T' ? 'XỈU' : 'TÀI';
            return {
                prediction: pred,
                confidence: 78 + count,
                patterns: ['🔥 Bệt siêu dài'],
                detail: `Bệt ${count} phiên`,
                totalPatterns: 1,
                tScore: last === 'T' ? 22 : 78,
                xScore: last === 'T' ? 78 : 22,
                usedPatterns: 1
            };
        }
        if (count >= 4) {
            const pred = last === 'T' ? 'XỈU' : 'TÀI';
            return {
                prediction: pred,
                confidence: 68 + count * 2,
                patterns: ['⚡ Bệt dài'],
                detail: `Bệt ${count} phiên`,
                totalPatterns: 1,
                tScore: last === 'T' ? 32 : 68,
                xScore: last === 'T' ? 68 : 32,
                usedPatterns: 1
            };
        }
        if (count >= 3) {
            const pred = last === 'T' ? 'XỈU' : 'TÀI';
            return {
                prediction: pred,
                confidence: 62 + count * 2,
                patterns: ['📈 Bệt vừa'],
                detail: `Bệt ${count} phiên`,
                totalPatterns: 1,
                tScore: last === 'T' ? 38 : 62,
                xScore: last === 'T' ? 62 : 38,
                usedPatterns: 1
            };
        }

        // Phân tích đảo 1-1
        if (count === 1 && history.length >= 4) {
            let isAlt = true;
            for (let i = 0; i < 3; i++) {
                if (history[i] === history[i+1]) { isAlt = false; break; }
            }
            if (isAlt) {
                const pred = last === 'T' ? 'XỈU' : 'TÀI';
                let conf = 70;
                if (history.length >= 6) conf = 78;
                if (history.length >= 8) conf = 85;
                return {
                    prediction: pred,
                    confidence: conf,
                    patterns: ['🔄 Đảo 1-1'],
                    detail: `Đảo 1-1 ${history.length >= 6 ? 'dài' : ''}`,
                    totalPatterns: 1,
                    tScore: last === 'T' ? 30 : 70,
                    xScore: last === 'T' ? 70 : 30,
                    usedPatterns: 1
                };
            }
        }

        // Phân tích zigzag
        if (history.length >= 5) {
            let changes = 0;
            for (let i = 1; i < Math.min(history.length, 8); i++) {
                if (history[i-1] !== history[i]) changes++;
            }
            if (changes >= 5) {
                const pred = last === 'T' ? 'XỈU' : 'TÀI';
                return {
                    prediction: pred,
                    confidence: 72,
                    patterns: ['⚡ Zigzag'],
                    detail: `Zigzag ${changes} lần`,
                    totalPatterns: 1,
                    tScore: last === 'T' ? 28 : 72,
                    xScore: last === 'T' ? 72 : 28,
                    usedPatterns: 1
                };
            }
            if (changes >= 3) {
                const pred = last === 'T' ? 'XỈU' : 'TÀI';
                return {
                    prediction: pred,
                    confidence: 64,
                    patterns: ['🌀 Zigzag ngắn'],
                    detail: `Zigzag ${changes} lần`,
                    totalPatterns: 1,
                    tScore: last === 'T' ? 36 : 64,
                    xScore: last === 'T' ? 64 : 36,
                    usedPatterns: 1
                };
            }
        }

        // Phân tích xu hướng
        if (history.length >= 10) {
            const tCount = history.slice(0, 10).filter(r => r === 'T').length;
            if (tCount >= 8) {
                return {
                    prediction: 'XỈU',
                    confidence: 68,
                    patterns: ['📈 Xu hướng Tài mạnh'],
                    detail: `Tài ${tCount}/10`,
                    totalPatterns: 1,
                    tScore: 32,
                    xScore: 68,
                    usedPatterns: 1
                };
            }
            if (tCount >= 6) {
                return {
                    prediction: 'XỈU',
                    confidence: 60,
                    patterns: ['📈 Xu hướng Tài'],
                    detail: `Tài ${tCount}/10`,
                    totalPatterns: 1,
                    tScore: 40,
                    xScore: 60,
                    usedPatterns: 1
                };
            }
            if (tCount <= 2) {
                return {
                    prediction: 'TÀI',
                    confidence: 68,
                    patterns: ['📉 Xu hướng Xỉu mạnh'],
                    detail: `Xỉu ${10-tCount}/10`,
                    totalPatterns: 1,
                    tScore: 68,
                    xScore: 32,
                    usedPatterns: 1
                };
            }
            if (tCount <= 4) {
                return {
                    prediction: 'TÀI',
                    confidence: 60,
                    patterns: ['📉 Xu hướng Xỉu'],
                    detail: `Xỉu ${10-tCount}/10`,
                    totalPatterns: 1,
                    tScore: 60,
                    xScore: 40,
                    usedPatterns: 1
                };
            }
        }

        // Theo chuỗi với cân bằng
        const tCount = history.slice(0, 5).filter(r => r === 'T').length;
        if (tCount >= 4) {
            return {
                prediction: 'XỈU',
                confidence: 58,
                patterns: ['📊 Theo chuỗi Tài'],
                detail: 'Tài 4/5 → Xỉu',
                totalPatterns: 1,
                tScore: 42,
                xScore: 58,
                usedPatterns: 1
            };
        }
        if (tCount <= 1) {
            return {
                prediction: 'TÀI',
                confidence: 58,
                patterns: ['📊 Theo chuỗi Xỉu'],
                detail: 'Xỉu 4/5 → Tài',
                totalPatterns: 1,
                tScore: 58,
                xScore: 42,
                usedPatterns: 1
            };
        }

        // Fallback cuối cùng
        const pred = last === 'T' ? 'TÀI' : 'XỈU';
        return {
            prediction: pred,
            confidence: 52,
            patterns: ['📊 Theo chuỗi'],
            detail: `Theo ${last === 'T' ? 'Tài' : 'Xỉu'}`,
            totalPatterns: 1,
            tScore: last === 'T' ? 52 : 48,
            xScore: last === 'T' ? 48 : 52,
            usedPatterns: 1
        };
    }

    // Dự đoán khẩn cấp - KHÔNG CÓ DỮ LIỆU
    emergencyPredict(gameId) {
        // Sử dụng pattern dự phòng với phân tích thông minh
        const bestPattern = this.emergencyPatterns.reduce((best, current) => {
            return current.weight > best.weight ? current : best;
        });

        // Luân phiên giữa Tài và Xỉu để tránh lệch
        const seed = Date.now() % 2;
        const pred = seed === 0 ? 'TÀI' : 'XỈU';
        
        return {
            prediction: pred,
            confidence: bestPattern.confidence || 55,
            patterns: [`📊 ${bestPattern.desc}`],
            detail: `Chưa có dữ liệu - ${bestPattern.desc}`,
            totalPatterns: 0,
            tScore: pred === 'TÀI' ? 55 : 45,
            xScore: pred === 'TÀI' ? 45 : 55,
            usedPatterns: 1
        };
    }

    // ============================================================
    // DỰ ĐOÁN CÁC LOẠI CẦU ĐẶC BIỆT SIÊU CẤP
    // ============================================================

    // Dự đoán Bệt siêu cấp
    superPredictBet(gameId, history) {
        if (history.length < 3) return null;
        const key = `${gameId}_bet`;
        const mem = this.betMemory.get(key);
        
        let count = 1;
        for (let i = 1; i < history.length; i++) {
            if (history[i] === history[0]) count++;
            else break;
        }
        
        // Bệt siêu dài
        if (count >= 7) {
            return history[0] === 'T' ? 'X' : 'T';
        }
        if (count >= 5) {
            if (mem && mem.accuracy > 0.55) {
                return history[0] === 'T' ? 'X' : 'T';
            }
        }
        if (count >= 4) {
            return history[0] === 'T' ? 'X' : 'T';
        }
        if (count >= 3) {
            if (mem && mem.accuracy > 0.6) {
                return history[0] === 'T' ? 'X' : 'T';
            }
            // Dự đoán theo pattern
            const key2 = `len_${count}`;
            if (mem && mem.patternMap.has(key2)) {
                const data = mem.patternMap.get(key2);
                const total = data.T + data.X;
                if (total >= 3) {
                    return data.T > data.X ? 'T' : 'X';
                }
            }
        }
        return null;
    }

    // Dự đoán Zigzag siêu cấp
    superPredictZigzag(gameId, history) {
        if (history.length < 4) return null;
        const key = `${gameId}_zigzag`;
        const mem = this.zigzagMemory.get(key);
        
        let changes = 0;
        for (let i = 1; i < Math.min(history.length, 10); i++) {
            if (history[i-1] !== history[i]) changes++;
        }
        
        if (changes >= 7) {
            return history[0] === 'T' ? 'X' : 'T';
        }
        if (changes >= 5) {
            if (mem && mem.accuracy > 0.55) {
                return history[0] === 'T' ? 'X' : 'T';
            }
        }
        if (changes >= 4) {
            const key2 = `chg_${changes}`;
            if (mem && mem.patternMap.has(key2)) {
                const data = mem.patternMap.get(key2);
                const total = data.T + data.X;
                if (total >= 3) {
                    return data.T > data.X ? 'T' : 'X';
                }
            }
        }
        return null;
    }

    // Dự đoán Đảo 1-1 siêu cấp
    superPredictDao11(gameId, history) {
        if (history.length < 4) return null;
        const key = `${gameId}_dao11`;
        const mem = this.dao11Memory.get(key);
        
        let isAlt = true;
        for (let i = 0; i < 3; i++) {
            if (history[i] === history[i+1]) { isAlt = false; break; }
        }
        
        if (isAlt) {
            if (mem && mem.accuracy > 0.6) {
                return history[0] === 'T' ? 'X' : 'T';
            }
            if (mem && mem.patternMap.has('11')) {
                const data = mem.patternMap.get('11');
                return data.T > data.X ? 'T' : 'X';
            }
            return history[0] === 'T' ? 'X' : 'T';
        }
        return null;
    }

    // Dự đoán Đảo 2-2 siêu cấp
    superPredictDao22(gameId, history) {
        if (history.length < 6) return null;
        const key = `${gameId}_dao22`;
        const mem = this.dao22Memory.get(key);
        
        let isPair = true;
        for (let i = 0; i < 3; i++) {
            if (history[i*2] !== history[i*2+1]) { isPair = false; break; }
        }
        if (isPair && history[0] !== history[2]) {
            if (mem && mem.accuracy > 0.55) {
                return history[0] === 'T' ? 'X' : 'T';
            }
            return history[0] === 'T' ? 'X' : 'T';
        }
        return null;
    }

    // Dự đoán Chu kỳ siêu cấp
    superPredictCycle(gameId, history) {
        if (history.length < 6) return null;
        const key = `${gameId}_cycle`;
        const mem = this.cycleMemory.get(key);
        
        for (let cycle = 2; cycle <= 3; cycle++) {
            if (history.length < cycle * 3) continue;
            const p1 = history.slice(0, cycle);
            const p2 = history.slice(cycle, cycle*2);
            const p3 = history.slice(cycle*2, cycle*3);
            if (p1.join('') === p2.join('') && p2.join('') === p3.join('')) {
                if (mem && mem.accuracy > 0.55) {
                    return p1[0] === 'T' ? 'X' : 'T';
                }
                return p1[0] === 'T' ? 'X' : 'T';
            }
        }
        return null;
    }

    // Dự đoán Xu hướng siêu cấp
    superPredictTrend(gameId, history) {
        if (history.length < 5) return null;
        const key = `${gameId}_trend`;
        const mem = this.trendMemory.get(key);
        
        const recent = history.slice(0, 5);
        const tCount = recent.filter(r => r === 'T').length;
        const trend = tCount >= 3 ? 'T' : 'X';
        
        const key2 = `trd_${trend}`;
        if (mem && mem.patternMap.has(key2)) {
            const data = mem.patternMap.get(key2);
            const total = data.T + data.X;
            if (total >= 3) {
                return data.T > data.X ? 'T' : 'X';
            }
        }
        return null;
    }

    // Dự đoán Gãy cầu siêu cấp
    superPredictBreak(gameId, history) {
        if (history.length < 4) return null;
        const key = `${gameId}_break`;
        const mem = this.breakMemory.get(key);
        
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
                if (mem && mem.patternMap.has(key2)) {
                    const data = mem.patternMap.get(key2);
                    const total = data.T + data.X;
                    if (total >= 3) {
                        return data.T > data.X ? 'T' : 'X';
                    }
                }
                return breakResult === 'T' ? 'T' : 'X';
            }
        }
        return null;
    }

    // Dự đoán Cân bằng siêu cấp
    superPredictBalance(gameId, history) {
        if (history.length < 10) return null;
        const key = `${gameId}_balance`;
        const mem = this.balanceMemory.get(key);
        
        const recent = history.slice(0, 10);
        const tCount = recent.filter(r => r === 'T').length;
        
        if (tCount >= 8) {
            return 'X';
        }
        if (tCount <= 2) {
            return 'T';
        }
        
        // Kiểm tra 20 phiên
        if (history.length >= 20) {
            const recent20 = history.slice(0, 20);
            const tCount20 = recent20.filter(r => r === 'T').length;
            if (tCount20 >= 15) return 'X';
            if (tCount20 <= 5) return 'T';
        }
        
        return null;
    }

    // Lấy thống kê
    getStats(gameId) {
        const streak = this.streakDB.get(gameId);
        const patternHistory = this.patternHistory.get(gameId) || [];
        const recent = patternHistory.slice(-20);
        const correct = recent.filter(p => p.result === 'T').length;
        const recentAccuracy = recent.length > 0 ? Math.round((correct / recent.length) * 100) : 0;
        
        const betMem = this.betMemory.get(`${gameId}_bet`);
        const zigzagMem = this.zigzagMemory.get(`${gameId}_zigzag`);
        const dao11Mem = this.dao11Memory.get(`${gameId}_dao11`);
        
        return {
            streak: streak ? streak.streak : 0,
            bestStreak: streak ? streak.best : 0,
            worstStreak: streak ? streak.worst : 0,
            recentAccuracy,
            patternCount: this.patternDB.size,
            totalLearned: patternHistory.length,
            betAccuracy: betMem ? Math.round(betMem.accuracy * 100) : 0,
            zigzagAccuracy: zigzagMem ? Math.round(zigzagMem.accuracy * 100) : 0,
            dao11Accuracy: dao11Mem ? Math.round(dao11Mem.accuracy * 100) : 0,
            emergencyPatterns: this.emergencyPatterns.length
        };
    }
}

const adaptiveEngine = new SuperAdaptiveEngine();

// ============================================================
// 🔍 PHÂN TÍCH CẦU SIÊU CẤP
// ============================================================
class SuperCauAnalyzer {
    analyze(history) {
        const patterns = [];

        // 1. Bệt siêu cấp
        const bet = this.analyzeSuperBet(history);
        if (bet) patterns.push(bet);

        // 2. Zigzag siêu cấp
        const zigzag = this.analyzeSuperZigzag(history);
        if (zigzag) patterns.push(zigzag);

        // 3. Đảo 1-1 siêu cấp
        const dao11 = this.analyzeSuperDao11(history);
        if (dao11) patterns.push(dao11);

        // 4. Đảo 2-2 siêu cấp
        const dao22 = this.analyzeSuperDao22(history);
        if (dao22) patterns.push(dao22);

        // 5. Cầu 3-3
        const cau33 = this.analyzeCau33(history);
        if (cau33) patterns.push(cau33);

        // 6. Cầu 4-4
        const cau44 = this.analyzeCau44(history);
        if (cau44) patterns.push(cau44);

        // 7. Chu kỳ siêu cấp
        const cycle = this.analyzeSuperCycle(history);
        if (cycle) patterns.push(cycle);

        // 8. Xu hướng siêu cấp
        const trend = this.analyzeSuperTrend(history);
        if (trend) patterns.push(trend);

        // 9. Cân bằng siêu cấp
        const balance = this.analyzeSuperBalance(history);
        if (balance) patterns.push(balance);

        // 10. Gãy cầu siêu cấp
        const breakPattern = this.analyzeSuperBreak(history);
        if (breakPattern) patterns.push(breakPattern);

        return patterns;
    }

    analyzeSuperBet(history) {
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
                detail: `🔥 Bệt siêu dài ${count}`
            };
        }
        if (count >= 6) {
            return {
                pattern: 'bet',
                prediction: last === 'T' ? 'X' : 'T',
                confidence: 90,
                weight: count,
                detail: `⚡ Bệt dài ${count}`
            };
        }
        if (count >= 4) {
            return {
                pattern: 'bet',
                prediction: last === 'T' ? 'X' : 'T',
                confidence: 80,
                weight: count,
                detail: `📈 Bệt ${count}`
            };
        }
        if (count >= 3) {
            return {
                pattern: 'bet',
                prediction: last === 'T' ? 'X' : 'T',
                confidence: 70,
                weight: count,
                detail: `📊 Bệt ngắn ${count}`
            };
        }
        if (count >= 2) {
            return {
                pattern: 'bet',
                prediction: last,
                confidence: 58,
                weight: count,
                detail: `📊 Bệt 2`
            };
        }
        return null;
    }

    analyzeSuperZigzag(history) {
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
                detail: `⚡ Zigzag siêu dài ${changes}`
            };
        }
        if (changes >= 6) {
            return {
                pattern: 'zigzag',
                prediction: history[0] === 'T' ? 'X' : 'T',
                confidence: 85,
                weight: 1.4,
                detail: `🌀 Zigzag ${changes}`
            };
        }
        if (changes >= 4) {
            return {
                pattern: 'zigzag',
                prediction: history[0] === 'T' ? 'X' : 'T',
                confidence: 75,
                weight: 1.2,
                detail: `🎯 Zigzag ngắn ${changes}`
            };
        }
        return null;
    }

    analyzeSuperDao11(history) {
        if (history.length < 4) return null;
        let isAlt = true;
        for (let i = 0; i < Math.min(history.length-1, 5); i++) {
            if (history[i] === history[i+1]) { isAlt = false; break; }
        }
        if (isAlt) {
            const len = Math.min(history.length, 10);
            let conf = 75;
            if (len >= 8) conf = 92;
            else if (len >= 6) conf = 85;
            return {
                pattern: 'dao11',
                prediction: history[0] === 'T' ? 'X' : 'T',
                confidence: conf,
                weight: 1.5,
                detail: `🔄 Đảo 1-1 ${len >= 6 ? 'dài' : ''}`
            };
        }
        return null;
    }

    analyzeSuperDao22(history) {
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

    analyzeCau33(history) {
        if (history.length < 9) return null;
        const last3 = history.slice(0, 3);
        const prev3 = history.slice(3, 6);
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

    analyzeSuperCycle(history) {
        if (history.length < 9) return null;
        for (let cycle = 2; cycle <= 3; cycle++) {
            if (history.length < cycle * 3) continue;
            const p1 = history.slice(0, cycle);
            const p2 = history.slice(cycle, cycle*2);
            const p3 = history.slice(cycle*2, cycle*3);
            if (p1.join('') === p2.join('') && p2.join('') === p3.join('')) {
                return {
                    pattern: 'cycle',
                    prediction: p1[0] === 'T' ? 'X' : 'T',
                    confidence: 82,
                    weight: 1.5,
                    detail: `🔄 Chu kỳ ${cycle}`
                };
            }
        }
        return null;
    }

    analyzeSuperTrend(history) {
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

    analyzeSuperBalance(history) {
        if (history.length < 20) return null;
        const recent = history.slice(0, 20);
        const tCount = recent.filter(v => v === 'T').length;
        
        if (tCount >= 16) {
            return {
                pattern: 'balance',
                prediction: 'X',
                confidence: 78,
                weight: 1.2,
                detail: `⚖️ Mất cân bằng cực độ Tài ${tCount}/20`
            };
        }
        if (tCount >= 14) {
            return {
                pattern: 'balance',
                prediction: 'X',
                confidence: 72,
                weight: 1.1,
                detail: `⚖️ Mất cân bằng Tài ${tCount}/20`
            };
        }
        if (tCount <= 4) {
            return {
                pattern: 'balance',
                prediction: 'T',
                confidence: 78,
                weight: 1.2,
                detail: `⚖️ Mất cân bằng cực độ Xỉu ${20-tCount}/20`
            };
        }
        if (tCount <= 6) {
            return {
                pattern: 'balance',
                prediction: 'T',
                confidence: 72,
                weight: 1.1,
                detail: `⚖️ Mất cân bằng Xỉu ${20-tCount}/20`
            };
        }
        return null;
    }

    analyzeSuperBreak(history) {
        if (history.length < 6) return null;
        const last = history[0];
        let count = 1;
        for (let i = 1; i < history.length; i++) {
            if (history[i] === last) count++;
            else break;
        }
        if (count >= 3 && history.length > count + 1) {
            const breakResult = history[count];
            if (breakResult !== last) {
                return {
                    pattern: 'break',
                    prediction: breakResult === 'T' ? 'T' : 'X',
                    confidence: 74,
                    weight: 1.2,
                    detail: `💥 Gãy cầu ${last}→${breakResult}`
                };
            }
        }
        return null;
    }
}

const superAnalyzer = new SuperCauAnalyzer();

// ============================================================
// 🎯 DỰ ĐOÁN SIÊU CẤP
// ============================================================
class SuperPredictor {
    async predict(gameId) {
        try {
            const url = gameId === 'hu' ? API_URL_HU : API_URL_MD5;
            const response = await axios.get(url, { timeout: 10000 });
            const data = response.data;
            
            if (!data || !data.list || data.list.length === 0) {
                return adaptiveEngine.superPredictNoData(gameId, []);
            }

            const items = data.list.slice(0, 100).reverse();
            const historyData = items.map(item => {
                const r = (item.resultTruyenThong || '').toUpperCase();
                return r.includes('TAI') ? 'T' : r.includes('XIU') ? 'X' : null;
            }).filter(r => r !== null);

            // Luôn có dữ liệu để phân tích
            const patterns = superAnalyzer.analyze(historyData);
            const result = adaptiveEngine.superPredict(gameId, patterns, historyData);
            
            return {
                prediction: result.prediction,
                confidence: result.confidence,
                patterns: result.patterns || [],
                detail: result.detail || 'Phân tích siêu cấp',
                totalPatterns: patterns.length,
                tScore: result.tScore || 0,
                xScore: result.xScore || 0,
                usedPatterns: result.usedPatterns || 0
            };

        } catch (error) {
            console.error(`Lỗi dự đoán ${gameId}:`, error.message);
            return adaptiveEngine.superPredictNoData(gameId, []);
        }
    }
}

const superPredictor = new SuperPredictor();

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
                updateStats(type, isCorrect);
                
                const result = record.prediction === 'TÀI' ? 'T' : 'X';
                adaptiveEngine.learn(type, 'verified', result, record.confidence, [], 1);
                updated++;
            }
        }
        
        if (updated > 0) {
            saveHistory();
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
        const dataHu = await fetchData('hu');
        if (dataHu && dataHu.length > 0) {
            const currentPhien = dataHu[0].phien;
            if (lastPhien.hu !== currentPhien) {
                verifyAndUpdate('hu', dataHu);
                
                const existing = history.hu.find(h => h.phien_hien_tai === (currentPhien + 1).toString());
                if (!existing) {
                    const result = await superPredictor.predict('hu');
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
                    console.log(`[Auto] HU: ${result.prediction} (${result.confidence}%) - ${result.detail}`);
                }
            }
        }

        const dataMd5 = await fetchData('md5');
        if (dataMd5 && dataMd5.length > 0) {
            const currentPhien = dataMd5[0].phien;
            if (lastPhien.md5 !== currentPhien) {
                verifyAndUpdate('md5', dataMd5);
                
                const existing = history.md5.find(h => h.phien_hien_tai === (currentPhien + 1).toString());
                if (!existing) {
                    const result = await superPredictor.predict('md5');
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
                    console.log(`[Auto] MD5: ${result.prediction} (${result.confidence}%) - ${result.detail}`);
                }
            }
        }

        saveHistory();
    } catch (error) {
        console.error('[Auto] Lỗi:', error.message);
    }
}

function startAutoTask() {
    console.log(`⏰ Tự động xử lý mỗi ${AUTO_SAVE_INTERVAL/1000}s`);
    setTimeout(autoProcess, 3000);
    setInterval(autoProcess, AUTO_SAVE_INTERVAL);
}

// ============================================================
// 🌐 GIAO DIỆN SIÊU WEB - TỰ ĐỘNG LOAD
// ============================================================

function generateSuperWebHTML(type) {
    const s = stats[type];
    const h = history[type] || [];
    const recent = h.slice(0, 30);
    const learningStats = adaptiveEngine.getStats(type);
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
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;600;700;800;900&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Inter', sans-serif;
            background: #04040a;
            color: #e8e8e8;
            min-height: 100vh;
            overflow-x: hidden;
        }
        
        .bg-super {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 0;
            background: 
                radial-gradient(ellipse at 10% 30%, rgba(123, 47, 252, 0.12) 0%, transparent 50%),
                radial-gradient(ellipse at 90% 70%, rgba(0, 212, 255, 0.08) 0%, transparent 50%),
                radial-gradient(ellipse at 50% 100%, rgba(123, 47, 252, 0.04) 0%, transparent 30%);
            overflow: hidden;
        }
        
        .bg-super::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: 
                radial-gradient(1px 1px at 10px 20px, rgba(255,255,255,0.08), transparent),
                radial-gradient(1px 1px at 30px 60px, rgba(255,255,255,0.06), transparent),
                radial-gradient(1px 1px at 50px 140px, rgba(255,255,255,0.07), transparent),
                radial-gradient(1px 1px at 80px 30px, rgba(255,255,255,0.06), transparent),
                radial-gradient(1px 1px at 120px 90px, rgba(255,255,255,0.07), transparent),
                radial-gradient(1px 1px at 180px 50px, rgba(255,255,255,0.05), transparent),
                radial-gradient(1px 1px at 250px 110px, rgba(255,255,255,0.06), transparent),
                radial-gradient(1px 1px at 300px 70px, rgba(255,255,255,0.04), transparent);
            background-size: 350px 350px;
            animation: starsFloat 50s linear infinite;
        }
        
        @keyframes starsFloat {
            0% { transform: translate(0, 0); }
            100% { transform: translate(-40px, -30px); }
        }
        
        .bg-super::after {
            content: '✦ ✧ ✦ ✧ ✦';
            position: absolute;
            top: 3%;
            right: 3%;
            font-size: 80px;
            color: rgba(123, 47, 252, 0.03);
            letter-spacing: 30px;
            animation: spinSlow 60s linear infinite;
        }
        
        @keyframes spinSlow {
            0% { transform: rotate(0deg) scale(1); }
            50% { transform: rotate(180deg) scale(1.1); }
            100% { transform: rotate(360deg) scale(1); }
        }
        
        .container {
            position: relative;
            z-index: 1;
            max-width: 1400px;
            margin: 0 auto;
            padding: 12px;
        }
        
        /* Header */
        .header-super {
            background: linear-gradient(135deg, rgba(123, 47, 252, 0.10), rgba(0, 212, 255, 0.05));
            border-radius: 18px;
            padding: 20px 28px;
            margin-bottom: 16px;
            border: 1px solid rgba(123, 47, 252, 0.12);
            backdrop-filter: blur(30px);
            position: relative;
            overflow: hidden;
        }
        
        .header-super::before {
            content: '';
            position: absolute;
            top: -80%;
            left: -80%;
            width: 260%;
            height: 260%;
            background: conic-gradient(from 0deg, transparent, rgba(123, 47, 252, 0.03), transparent, rgba(0, 212, 255, 0.03), transparent);
            animation: spinFast 35s linear infinite;
        }
        
        @keyframes spinFast {
            100% { transform: rotate(360deg); }
        }
        
        .header-super .content {
            position: relative;
            z-index: 1;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
        }
        
        .logo-super {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .logo-super .icon {
            font-size: 32px;
            animation: glowPulse 2s ease-in-out infinite;
            filter: drop-shadow(0 0 30px rgba(123, 47, 252, 0.15));
        }
        
        @keyframes glowPulse {
            0%, 100% { transform: scale(1); filter: drop-shadow(0 0 30px rgba(123, 47, 252, 0.15)); }
            50% { transform: scale(1.05); filter: drop-shadow(0 0 60px rgba(123, 47, 252, 0.3)); }
        }
        
        .logo-super .ten {
            font-family: 'Orbitron', monospace;
            font-size: 24px;
            font-weight: 900;
            background: linear-gradient(135deg, #7b2ffc, #00d4ff, #7b2ffc);
            background-size: 200% 200%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: shimmerFast 3s ease-in-out infinite;
        }
        
        @keyframes shimmerFast {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }
        
        .logo-super .sub {
            font-size: 11px;
            color: #556677;
            letter-spacing: 3px;
            font-weight: 300;
        }
        
        .header-super .info {
            text-align: right;
        }
        
        .badge-super {
            display: inline-block;
            padding: 4px 18px;
            border-radius: 30px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2px;
            background: linear-gradient(135deg, rgba(123, 47, 252, 0.15), rgba(0, 212, 255, 0.08));
            border: 1px solid rgba(123, 47, 252, 0.15);
            color: #a78bfa;
            backdrop-filter: blur(10px);
        }
        
        .badge-super .live {
            display: inline-block;
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #4ade80;
            margin-right: 8px;
            animation: livePulse 1s ease-in-out infinite;
            box-shadow: 0 0 20px rgba(74, 222, 128, 0.2);
        }
        
        @keyframes livePulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.3; transform: scale(0.6); }
        }
        
        /* Stats */
        .stats-super {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
            gap: 10px;
            margin-bottom: 16px;
        }
        
        .stat-super {
            background: rgba(255,255,255,0.02);
            border-radius: 12px;
            padding: 12px 14px;
            border: 1px solid rgba(255,255,255,0.04);
            backdrop-filter: blur(15px);
            transition: all 0.4s ease;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        
        .stat-super:hover {
            transform: translateY(-2px);
            border-color: rgba(123, 47, 252, 0.12);
            box-shadow: 0 6px 25px rgba(123, 47, 252, 0.04);
        }
        
        .stat-super .label {
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #445566;
            font-weight: 700;
        }
        
        .stat-super .value {
            font-size: 20px;
            font-weight: 800;
            margin-top: 2px;
            font-family: 'Orbitron', monospace;
        }
        
        .stat-super .value.xanh { color: #4ade80; }
        .stat-super .value.do { color: #f87171; }
        .stat-super .value.cam { color: #fb923c; }
        .stat-super .value.xanh-duong { color: #60a5fa; }
        .stat-super .value.tim { color: #a78bfa; }
        .stat-super .value.cyan { color: #22d3ee; }
        
        .stat-super .sub {
            font-size: 9px;
            color: #334455;
            margin-top: 2px;
        }
        
        /* Table */
        .table-super {
            background: rgba(255,255,255,0.015);
            border-radius: 12px;
            overflow: hidden;
            border: 1px solid rgba(255,255,255,0.03);
            backdrop-filter: blur(15px);
        }
        
        .table-super .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 18px;
            border-bottom: 1px solid rgba(255,255,255,0.03);
            flex-wrap: wrap;
            gap: 6px;
        }
        
        .table-super .header h3 {
            font-size: 13px;
            font-weight: 700;
            color: #c0c0c0;
        }
        
        .table-super .header .count {
            font-size: 10px;
            color: #334455;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }
        
        th {
            background: rgba(255,255,255,0.02);
            padding: 8px 12px;
            text-align: left;
            font-weight: 700;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #334455;
        }
        
        td {
            padding: 7px 12px;
            border-bottom: 1px solid rgba(255,255,255,0.02);
        }
        
        tr:hover td {
            background: rgba(255,255,255,0.015);
        }
        
        .phien {
            font-family: 'Orbitron', monospace;
            font-size: 11px;
            color: #556677;
        }
        
        .du-doan {
            display: inline-block;
            padding: 2px 12px;
            border-radius: 8px;
            font-weight: 700;
            font-size: 11px;
        }
        
        .du-doan.tai {
            background: rgba(74, 222, 128, 0.10);
            color: #4ade80;
        }
        
        .du-doan.xiu {
            background: rgba(248, 113, 113, 0.10);
            color: #f87171;
        }
        
        .do-tin {
            font-weight: 700;
            color: #60a5fa;
        }
        
        .trang-thai {
            display: inline-block;
            padding: 2px 10px;
            border-radius: 8px;
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.5px;
        }
        
        .trang-thai.dung {
            background: rgba(74, 222, 128, 0.10);
            color: #4ade80;
        }
        
        .trang-thai.sai {
            background: rgba(248, 113, 113, 0.10);
            color: #f87171;
        }
        
        .trang-thai.cho {
            background: rgba(251, 146, 60, 0.10);
            color: #fb923c;
        }
        
        .chi-tiet {
            font-size: 10px;
            color: #334455;
            max-width: 180px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        /* Footer */
        .footer-super {
            text-align: center;
            padding: 14px;
            color: #223344;
            font-size: 11px;
            border-top: 1px solid rgba(255,255,255,0.02);
            margin-top: 16px;
        }
        
        .footer-super .highlight {
            color: #a78bfa;
        }
        
        .footer-super .heart {
            color: #f87171;
            animation: heartbeat 1.5s ease-in-out infinite;
            display: inline-block;
        }
        
        @keyframes heartbeat {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.2); }
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .header-super { padding: 14px; }
            .header-super .content { flex-direction: column; align-items: flex-start; }
            .header-super .info { text-align: left; width: 100%; }
            .stats-super { grid-template-columns: repeat(3, 1fr); gap: 6px; }
            .stat-super .value { font-size: 16px; }
            .logo-super .ten { font-size: 18px; }
            table { font-size: 10px; }
            th, td { padding: 5px 6px; }
            .chi-tiet { max-width: 60px; }
        }
        
        @media (max-width: 480px) {
            .stats-super { grid-template-columns: repeat(2, 1fr); }
            .container { padding: 6px; }
            th, td { padding: 3px 4px; font-size: 9px; }
            .logo-super .ten { font-size: 14px; }
            .logo-super .icon { font-size: 24px; }
            .du-doan { font-size: 9px; padding: 1px 8px; }
        }
        
        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.01); }
        ::-webkit-scrollbar-thumb { background: rgba(123, 47, 252, 0.15); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(123, 47, 252, 0.3); }
    </style>
</head>
<body>
    <div class="bg-super"></div>
    
    <div class="container">
        <div class="header-super">
            <div class="content">
                <div class="logo-super">
                    <span class="icon">🌌</span>
                    <div>
                        <div class="ten">TX UNIVERSE</div>
                        <div class="sub">BỞI ANH KHÔI • ${type.toUpperCase()}</div>
                    </div>
                </div>
                <div class="info">
                    <div class="badge-super">
                        <span class="live"></span>
                        ${type.toUpperCase()} • TRỰC TIẾP
                        <span style="font-weight:400;color:#445566;letter-spacing:1px;">v6.0</span>
                    </div>
                    <div style="font-size:9px;color:#223344;margin-top:3px;">
                        ${new Date().toLocaleString('vi-VN')}
                    </div>
                </div>
            </div>
        </div>
        
        <div class="stats-super">
            <div class="stat-super">
                <div class="label">Tổng</div>
                <div class="value xanh-duong">${s.total}</div>
                <div class="sub">Dự đoán</div>
            </div>
            <div class="stat-super">
                <div class="label">✅ Đúng</div>
                <div class="value xanh">${s.correct}</div>
                <div class="sub">${s.accuracy}%</div>
            </div>
            <div class="stat-super">
                <div class="label">❌ Sai</div>
                <div class="value do">${s.wrong}</div>
                <div class="sub">${100 - s.accuracy}%</div>
            </div>
            <div class="stat-super">
                <div class="label">📊 Tỷ Lệ</div>
                <div class="value ${s.accuracy >= 65 ? 'xanh' : s.accuracy >= 55 ? 'cam' : 'do'}">${s.accuracy}%</div>
                <div class="sub">${s.accuracy >= 65 ? '🌟 Xuất sắc' : s.accuracy >= 55 ? '📈 Tốt' : '📉 Cần cải thiện'}</div>
            </div>
            <div class="stat-super">
                <div class="label">⚡ Chuỗi</div>
                <div class="value ${s.streak > 0 ? 'xanh' : s.streak < 0 ? 'do' : 'cam'}">${s.streak > 0 ? '✅ +' + s.streak : s.streak < 0 ? '❌ ' + s.streak : '0'}</div>
                <div class="sub">${s.streak > 0 ? '🔥 Đang thắng' : s.streak < 0 ? '💪 Cố lên' : '⚖️ Cân bằng'}</div>
            </div>
            <div class="stat-super">
                <div class="label">🏆 Dài Nhất</div>
                <div class="value cyan">${s.bestStreak}</div>
                <div class="sub">${s.bestStreak >= 5 ? '🚀 Siêu chuỗi' : '📈 Đang tiến'}</div>
            </div>
        </div>
        
        <div class="table-super">
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
                    ${rows || '<tr><td colspan="6" style="text-align:center;padding:30px;color:#223344;">⏳ Đang chờ dữ liệu...</td></tr>'}
                </tbody>
            </table>
        </div>
        
        <div class="footer-super">
            <span style="color:#334455;">🌌 TX Universe Predictor</span> • 
            <span class="highlight">Anh Khôi</span> • 
            Phiên bản 6.0 • 
            Tự động cập nhật mỗi 6s
            <br>
            <span style="font-size:9px;color:#223344;">
                <span class="heart">❤️</span> Bệt • Zigzag • 1-1 • 2-2 • Chu kỳ • Xu hướng • Gãy cầu • Cân bằng
                <span style="color:#334455;letter-spacing:2px;">✦ ✧ ✦</span>
            </span>
        </div>
    </div>
    
    <script>
        // Tự động reload mỗi 6 giây - tối ưu cho theo dõi
        setTimeout(function() {
            location.reload();
        }, 6000);
        
        // Hiển thị thời gian còn lại
        let countdown = 6;
        setInterval(function() {
            countdown--;
            if (countdown <= 0) countdown = 6;
        }, 1000);
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
        version: '6.0',
        author: 'Anh Khôi',
        status: '🚀 Siêu chính xác - Không cần dữ liệu',
        endpoints: ['/lc79-hu', '/lc79-md5', '/lc79-hu/history', '/lc79-md5/history', '/stats', '/analysis', '/dashboard']
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
            background: #04040a;
            color: #e0e0e0;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            background: radial-gradient(ellipse at 20% 50%, rgba(123, 47, 252, 0.06) 0%, transparent 60%),
                        radial-gradient(ellipse at 80% 50%, rgba(0, 212, 255, 0.04) 0%, transparent 60%);
        }
        .container { text-align: center; padding: 30px; max-width: 500px; }
        .logo { font-size: 56px; margin-bottom: 10px; animation: glowBig 3s ease-in-out infinite; }
        @keyframes glowBig {
            0%, 100% { transform: scale(1); filter: drop-shadow(0 0 30px rgba(123, 47, 252, 0.15)); }
            50% { transform: scale(1.05); filter: drop-shadow(0 0 60px rgba(123, 47, 252, 0.3)); }
        }
        h1 {
            font-size: 30px;
            font-weight: 900;
            background: linear-gradient(135deg, #7b2ffc, #00d4ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-family: 'Orbitron', sans-serif;
            margin-bottom: 4px;
        }
        .sub {
            color: #445566;
            font-size: 14px;
            margin-bottom: 24px;
        }
        .sub strong { color: #a78bfa; }
        .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 24px;
        }
        .card {
            background: rgba(255,255,255,0.02);
            border-radius: 12px;
            padding: 18px;
            border: 1px solid rgba(255,255,255,0.04);
            text-decoration: none;
            color: #e0e0e0;
            transition: all 0.4s ease;
            backdrop-filter: blur(10px);
        }
        .card:hover {
            transform: translateY(-4px);
            border-color: rgba(123, 47, 252, 0.2);
            box-shadow: 0 8px 30px rgba(123, 47, 252, 0.06);
        }
        .card .icon { font-size: 28px; margin-bottom: 4px; }
        .card .title { font-weight: 700; font-size: 13px; }
        .card .desc { font-size: 10px; color: #334455; margin-top: 2px; }
        .footer {
            color: #223344;
            font-size: 11px;
        }
        .footer .highlight { color: #a78bfa; }
        .footer .heart { color: #f87171; animation: heartBeat 1.5s ease-in-out infinite; display: inline-block; }
        @keyframes heartBeat {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.2); }
        }
        @media (max-width: 500px) {
            h1 { font-size: 22px; }
            .grid { gap: 8px; }
            .card { padding: 12px; }
            .card .icon { font-size: 22px; }
            .card .title { font-size: 11px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🌌</div>
        <h1>TX UNIVERSE</h1>
        <div class="sub">Bởi <strong>Anh Khôi</strong> • Dự đoán siêu chính xác</div>
        
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
            ⚡ <span class="highlight">TX Universe Predictor v6.0</span> • 
            Bệt • Zigzag • 1-1 • 2-2 • Chu kỳ • Xu hướng • Gãy cầu • Cân bằng
            <br>
            <span style="font-size:9px;color:#223344;">
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
        const result = await superPredictor.predict('hu');
        const data = await fetchData('hu');
        if (!data || data.length === 0) {
            return res.json({
                phien_hien_tai: '?',
                prediction: result.prediction,
                confidence: `${result.confidence}%`,
                detail: result.detail,
                patterns: result.patterns,
                status: '⏳ Chờ dữ liệu',
                noData: true
            });
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
            xScore: result.xScore,
            usedPatterns: result.usedPatterns
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Dự đoán MD5
app.get('/lc79-md5', async (req, res) => {
    try {
        const result = await superPredictor.predict('md5');
        const data = await fetchData('md5');
        if (!data || data.length === 0) {
            return res.json({
                phien_hien_tai: '?',
                prediction: result.prediction,
                confidence: `${result.confidence}%`,
                detail: result.detail,
                patterns: result.patterns,
                status: '⏳ Chờ dữ liệu',
                noData: true
            });
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
            xScore: result.xScore,
            usedPatterns: result.usedPatterns
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Lịch sử HU
app.get('/lc79-hu/history', async (req, res) => {
    const data = await fetchData('hu');
    if (data) verifyAndUpdate('hu', data);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(generateSuperWebHTML('hu'));
});

// Lịch sử MD5
app.get('/lc79-md5/history', async (req, res) => {
    const data = await fetchData('md5');
    if (data) verifyAndUpdate('md5', data);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(generateSuperWebHTML('md5'));
});

// JSON
app.get('/lc79-hu/json', async (req, res) => {
    const data = await fetchData('hu');
    if (data) verifyAndUpdate('hu', data);
    res.json({ type: 'HU', total: history.hu.length, stats: stats.hu, records: history.hu.slice(0, 50) });
});

app.get('/lc79-md5/json', async (req, res) => {
    const data = await fetchData('md5');
    if (data) verifyAndUpdate('md5', data);
    res.json({ type: 'MD5', total: history.md5.length, stats: stats.md5, records: history.md5.slice(0, 50) });
});

// Thống kê
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
            hu: adaptiveEngine.getStats('hu'),
            md5: adaptiveEngine.getStats('md5')
        },
        lastPredictions: lastPredictions
    });
});

// Phân tích
app.get('/analysis', async (req, res) => {
    const [hu, md5] = await Promise.all([
        superPredictor.predict('hu'),
        superPredictor.predict('md5')
    ]);
    
    res.json({
        hu: {
            prediction: hu.prediction,
            confidence: hu.confidence,
            patterns: hu.patterns,
            detail: hu.detail,
            totalPatterns: hu.totalPatterns,
            tScore: hu.tScore,
            xScore: hu.xScore,
            usedPatterns: hu.usedPatterns
        },
        md5: {
            prediction: md5.prediction,
            confidence: md5.confidence,
            patterns: md5.patterns,
            detail: md5.detail,
            totalPatterns: md5.totalPatterns,
            tScore: md5.tScore,
            xScore: md5.xScore,
            usedPatterns: md5.usedPatterns
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
    console.log('║   🌌  TX UNIVERSE PREDICTOR v6.0 - ANH KHÔI                 ║');
    console.log('║                                                               ║');
    console.log('║   🚀 Siêu chính xác - Không cần dữ liệu                      ║');
    console.log('║   ⚡ Học thích nghi siêu cấp                                 ║');
    console.log('║                                                               ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log('║                                                               ║');
    console.log(`║   📡 Server: http://0.0.0.0:${PORT}                            ║`);
    console.log('║                                                               ║');
    console.log('║   🔗 ENDPOINTS:                                              ║');
    console.log('║   📊 /dashboard       - Trang chủ Công Nghệ                  ║');
    console.log('║   📈 /lc79-hu         - Dự đoán HU                           ║');
    console.log('║   📈 /lc79-md5        - Dự đoán MD5                          ║');
    console.log('║   🎯 /lc79-hu/history - Thống kê HU (Tự động load 6s)        ║');
    console.log('║   🎯 /lc79-md5/history - Thống kê MD5 (Tự động load 6s)      ║');
    console.log('║   📋 /stats           - Thống kê tổng hợp                    ║');
    console.log('║   🔍 /analysis        - Phân tích chi tiết                   ║');
    console.log('║                                                               ║');
    console.log('║   🧠 THUẬT TOÁN SIÊU CẤP:                                   ║');
    console.log('║   🔥 Bắt cầu Bệt siêu chính xác                              ║');
    console.log('║   ⚡ Bắt cầu Zigzag siêu chính xác                           ║');
    console.log('║   🔄 Bắt cầu 1-1 siêu chính xác                              ║');
    console.log('║   🔄 Bắt cầu 2-2                                             ║');
    console.log('║   🔁 Bắt chu kỳ                                              ║');
    console.log('║   📈 Bắt xu hướng                                            ║');
    console.log('║   💥 Bắt gãy cầu                                             ║');
    console.log('║   ⚖️ Bắt cân bằng tránh lệch                                 ║');
    console.log('║   🆘 Dự đoán không cần dữ liệu                               ║');
    console.log('║                                                               ║');
    console.log('║   📁 himinhlaanhkhoi_history.json                            ║');
    console.log('║   📁 himinhlaanhkhoi_learning.json                           ║');
    console.log('║                                                               ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
    
    startAutoTask();
});
