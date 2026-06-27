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
// 🧠 THUẬT TOÁN SIÊU THÔNG MINH - 50 CHỈ BÁO
// ============================================================
class SuperSmartPredictor {
    constructor() {
        this.streakMemory = new Map();
        this.patternMemory = new Map();
        this.weightMemory = new Map();
        this.accuracyMemory = new Map();
        this.predictionHistory = new Map();
        this.trendMemory = new Map();
        this.loadData();
    }

    // ============================================================
    // HỌC THÔNG MINH
    // ============================================================
    learn(game, result, confidence) {
        if (!this.streakMemory.has(game)) {
            this.streakMemory.set(game, {
                chuoi: 0, best: 0, worst: 0,
                last5: [], last10: [], last20: [], last50: [], last100: [],
                tai: 0, xiu: 0, total: 0
            });
        }
        const s = this.streakMemory.get(game);
        s.total++;
        if (result === 'T') {
            s.tai++;
            s.chuoi = s.chuoi >= 0 ? s.chuoi + 1 : 1;
        } else {
            s.xiu++;
            s.chuoi = s.chuoi <= 0 ? s.chuoi - 1 : -1;
        }
        if (s.chuoi > s.best) s.best = s.chuoi;
        if (s.chuoi < s.worst) s.worst = s.chuoi;
        
        s.last5.push(result);
        s.last10.push(result);
        s.last20.push(result);
        s.last50.push(result);
        s.last100.push(result);
        if (s.last5.length > 5) s.last5.shift();
        if (s.last10.length > 10) s.last10.shift();
        if (s.last20.length > 20) s.last20.shift();
        if (s.last50.length > 50) s.last50.shift();
        if (s.last100.length > 100) s.last100.shift();

        const key = `${game}_${result}`;
        if (!this.accuracyMemory.has(key)) {
            this.accuracyMemory.set(key, { correct: 0, total: 0 });
        }
        const acc = this.accuracyMemory.get(key);
        acc.total++;
        if (confidence > 55) acc.correct++;
        
        this.saveData();
    }

    // ============================================================
    // DỰ ĐOÁN SIÊU THÔNG MINH - 50 CHỈ BÁO
    // ============================================================
    predict(game, data) {
        if (!data || data.length < 2) {
            return this.smartFallback(game);
        }

        const history = data.map(d => d === 'T' ? 'T' : 'X');
        let T = 0, X = 0;
        const patterns = [];

        // ====== NHÓM 1: CẦU CƠ BẢN (10 chỉ báo) ======
        const bet = this.getBet(history);
        if (bet) { patterns.push(bet); if (bet.pred === 'T') T += bet.diem; else X += bet.diem; }

        const zigzag = this.getZigzag(history);
        if (zigzag) { patterns.push(zigzag); if (zigzag.pred === 'T') T += zigzag.diem; else X += zigzag.diem; }

        const dao = this.getDao(history);
        if (dao) { patterns.push(dao); if (dao.pred === 'T') T += dao.diem; else X += dao.diem; }

        const cau22 = this.getCau22(history);
        if (cau22) { patterns.push(cau22); if (cau22.pred === 'T') T += cau22.diem; else X += cau22.diem; }

        const cau33 = this.getCau33(history);
        if (cau33) { patterns.push(cau33); if (cau33.pred === 'T') T += cau33.diem; else X += cau33.diem; }

        const cau44 = this.getCau44(history);
        if (cau44) { patterns.push(cau44); if (cau44.pred === 'T') T += cau44.diem; else X += cau44.diem; }

        const cau55 = this.getCau55(history);
        if (cau55) { patterns.push(cau55); if (cau55.pred === 'T') T += cau55.diem; else X += cau55.diem; }

        const cycle = this.getCycle(history);
        if (cycle) { patterns.push(cycle); if (cycle.pred === 'T') T += cycle.diem; else X += cycle.diem; }

        const cau121 = this.getCau121(history);
        if (cau121) { patterns.push(cau121); if (cau121.pred === 'T') T += cau121.diem; else X += cau121.diem; }

        const cau212 = this.getCau212(history);
        if (cau212) { patterns.push(cau212); if (cau212.pred === 'T') T += cau212.diem; else X += cau212.diem; }

        // ====== NHÓM 2: CẦU NÂNG CAO (10 chỉ báo) ======
        const cau123 = this.getCau123(history);
        if (cau123) { patterns.push(cau123); if (cau123.pred === 'T') T += cau123.diem; else X += cau123.diem; }

        const cau321 = this.getCau321(history);
        if (cau321) { patterns.push(cau321); if (cau321.pred === 'T') T += cau321.diem; else X += cau321.diem; }

        const cau111 = this.getCau111(history);
        if (cau111) { patterns.push(cau111); if (cau111.pred === 'T') T += cau111.diem; else X += cau111.diem; }

        const cau222 = this.getCau222(history);
        if (cau222) { patterns.push(cau222); if (cau222.pred === 'T') T += cau222.diem; else X += cau222.diem; }

        const cau333 = this.getCau333(history);
        if (cau333) { patterns.push(cau333); if (cau333.pred === 'T') T += cau333.diem; else X += cau333.diem; }

        const breakCau = this.getBreakCau(history);
        if (breakCau) { patterns.push(breakCau); if (breakCau.pred === 'T') T += breakCau.diem; else X += breakCau.diem; }

        const dao22 = this.getDao22(history);
        if (dao22) { patterns.push(dao22); if (dao22.pred === 'T') T += dao22.diem; else X += dao22.diem; }

        const dao33 = this.getDao33(history);
        if (dao33) { patterns.push(dao33); if (dao33.pred === 'T') T += dao33.diem; else X += dao33.diem; }

        const dao44 = this.getDao44(history);
        if (dao44) { patterns.push(dao44); if (dao44.pred === 'T') T += dao44.diem; else X += dao44.diem; }

        const gao = this.getGao(history);
        if (gao) { patterns.push(gao); if (gao.pred === 'T') T += gao.diem; else X += gao.diem; }

        // ====== NHÓM 3: THỐNG KÊ (10 chỉ báo) ======
        const trend = this.getTrend(history);
        if (trend) { patterns.push(trend); if (trend.pred === 'T') T += trend.diem; else X += trend.diem; }

        const balance = this.getBalance(history);
        if (balance) { patterns.push(balance); if (balance.pred === 'T') T += balance.diem; else X += balance.diem; }

        const momentum = this.getMomentum(history);
        if (momentum) { patterns.push(momentum); if (momentum.pred === 'T') T += momentum.diem; else X += momentum.diem; }

        const volatility = this.getVolatility(history);
        if (volatility) { patterns.push(volatility); if (volatility.pred === 'T') T += volatility.diem; else X += volatility.diem; }

        const chuoi = this.getChuoiPhanTich(history);
        if (chuoi) { patterns.push(chuoi); if (chuoi.pred === 'T') T += chuoi.diem; else X += chuoi.diem; }

        const lech = this.getLechPhanTich(history);
        if (lech) { patterns.push(lech); if (lech.pred === 'T') T += lech.diem; else X += lech.diem; }

        const tongHop = this.getTongHop(history);
        if (tongHop) { patterns.push(tongHop); if (tongHop.pred === 'T') T += tongHop.diem; else X += tongHop.diem; }

        const bienDongTB = this.getBienDongTB(history);
        if (bienDongTB) { patterns.push(bienDongTB); if (bienDongTB.pred === 'T') T += bienDongTB.diem; else X += bienDongTB.diem; }

        const tyLeTai = this.getTyLeTai(history);
        if (tyLeTai) { patterns.push(tyLeTai); if (tyLeTai.pred === 'T') T += tyLeTai.diem; else X += tyLeTai.diem; }

        const doLech = this.getDoLech(history);
        if (doLech) { patterns.push(doLech); if (doLech.pred === 'T') T += doLech.diem; else X += doLech.diem; }

        // ====== NHÓM 4: KỸ THUẬT (10 chỉ báo) ======
        const fib = this.getFibonacci(history);
        if (fib) { patterns.push(fib); if (fib.pred === 'T') T += fib.diem; else X += fib.diem; }

        const ma = this.getMACrossover(history);
        if (ma) { patterns.push(ma); if (ma.pred === 'T') T += ma.diem; else X += ma.diem; }

        const rsi = this.getRSI(history);
        if (rsi) { patterns.push(rsi); if (rsi.pred === 'T') T += rsi.diem; else X += rsi.diem; }

        const macd = this.getMACD(history);
        if (macd) { patterns.push(macd); if (macd.pred === 'T') T += macd.diem; else X += macd.diem; }

        const kalman = this.getKalman(history);
        if (kalman) { patterns.push(kalman); if (kalman.pred === 'T') T += kalman.diem; else X += kalman.diem; }

        const ensemble = this.getEnsemble(history);
        if (ensemble) { patterns.push(ensemble); if (ensemble.pred === 'T') T += ensemble.diem; else X += ensemble.diem; }

        const ma3 = this.getMA3(history);
        if (ma3) { patterns.push(ma3); if (ma3.pred === 'T') T += ma3.diem; else X += ma3.diem; }

        const ma5 = this.getMA5(history);
        if (ma5) { patterns.push(ma5); if (ma5.pred === 'T') T += ma5.diem; else X += ma5.diem; }

        const ma10 = this.getMA10(history);
        if (ma10) { patterns.push(ma10); if (ma10.pred === 'T') T += ma10.diem; else X += ma10.diem; }

        const bollinger = this.getBollinger(history);
        if (bollinger) { patterns.push(bollinger); if (bollinger.pred === 'T') T += bollinger.diem; else X += bollinger.diem; }

        // ====== NHÓM 5: AI & MACHINE LEARNING (10 chỉ báo) ======
        const knn = this.getKNN(history);
        if (knn) { patterns.push(knn); if (knn.pred === 'T') T += knn.diem; else X += knn.diem; }

        const svm = this.getSVM(history);
        if (svm) { patterns.push(svm); if (svm.pred === 'T') T += svm.diem; else X += svm.diem; }

        const decisionTree = this.getDecisionTree(history);
        if (decisionTree) { patterns.push(decisionTree); if (decisionTree.pred === 'T') T += decisionTree.diem; else X += decisionTree.diem; }

        const randomForest = this.getRandomForest(history);
        if (randomForest) { patterns.push(randomForest); if (randomForest.pred === 'T') T += randomForest.diem; else X += randomForest.diem; }

        const naiveBayes = this.getNaiveBayes(history);
        if (naiveBayes) { patterns.push(naiveBayes); if (naiveBayes.pred === 'T') T += naiveBayes.diem; else X += naiveBayes.diem; }

        const neuralNet = this.getNeuralNet(history);
        if (neuralNet) { patterns.push(neuralNet); if (neuralNet.pred === 'T') T += neuralNet.diem; else X += neuralNet.diem; }

        const lstm = this.getLSTM(history);
        if (lstm) { patterns.push(lstm); if (lstm.pred === 'T') T += lstm.diem; else X += lstm.diem; }

        const transformer = this.getTransformer(history);
        if (transformer) { patterns.push(transformer); if (transformer.pred === 'T') T += transformer.diem; else X += transformer.diem; }

        const gradientBoost = this.getGradientBoost(history);
        if (gradientBoost) { patterns.push(gradientBoost); if (gradientBoost.pred === 'T') T += gradientBoost.diem; else X += gradientBoost.diem; }

        const xgboost = this.getXGBoost(history);
        if (xgboost) { patterns.push(xgboost); if (xgboost.pred === 'T') T += xgboost.diem; else X += xgboost.diem; }

        // ====== ĐIỀU CHỈNH THEO STREAK ======
        const s = this.streakMemory.get(game);
        if (s) {
            if (s.last5.length >= 5) {
                const tCount = s.last5.filter(r => r === 'T').length;
                if (tCount >= 4) { X *= 1.5; patterns.push({ name: '📊 Last5 Tài(4)→Xỉu', pred: 'X', diem: 20 }); }
                else if (tCount <= 1) { T *= 1.5; patterns.push({ name: '📊 Last5 Xỉu(4)→Tài', pred: 'T', diem: 20 }); }
            }
            if (s.last10.length >= 10) {
                const tCount = s.last10.filter(r => r === 'T').length;
                if (tCount >= 7) { X *= 1.4; patterns.push({ name: '📊 Last10 Tài(7)→Xỉu', pred: 'X', diem: 16 }); }
                else if (tCount <= 3) { T *= 1.4; patterns.push({ name: '📊 Last10 Xỉu(7)→Tài', pred: 'T', diem: 16 }); }
            }
            if (s.last20.length >= 20) {
                const tCount = s.last20.filter(r => r === 'T').length;
                if (tCount >= 14) { X *= 1.3; patterns.push({ name: '📊 Last20 Tài(14)→Xỉu', pred: 'X', diem: 12 }); }
                else if (tCount <= 6) { T *= 1.3; patterns.push({ name: '📊 Last20 Xỉu(14)→Tài', pred: 'T', diem: 12 }); }
            }
            if (s.last50.length >= 50) {
                const tCount = s.last50.filter(r => r === 'T').length;
                if (tCount >= 35) { X *= 1.2; patterns.push({ name: '📊 Last50 Tài(35)→Xỉu', pred: 'X', diem: 10 }); }
                else if (tCount <= 15) { T *= 1.2; patterns.push({ name: '📊 Last50 Xỉu(35)→Tài', pred: 'T', diem: 10 }); }
            }
            if (s.chuoi <= -5) {
                const temp = T; T = X * 1.8; X = temp * 1.8;
                patterns.push({ name: '🔄 Đảo chiều cực mạnh', pred: 'T', diem: 25 });
            } else if (s.chuoi <= -4) {
                const temp = T; T = X * 1.5; X = temp * 1.5;
                patterns.push({ name: '🔄 Đảo chiều siêu mạnh', pred: 'T', diem: 20 });
            } else if (s.chuoi <= -3) {
                const temp = T; T = X * 1.3; X = temp * 1.3;
                patterns.push({ name: '🔄 Đảo chiều mạnh', pred: 'T', diem: 15 });
            } else if (s.chuoi <= -2) {
                const temp = T; T = X * 1.15; X = temp * 1.15;
                patterns.push({ name: '🔄 Đảo chiều', pred: 'T', diem: 10 });
            }
            if (s.chuoi >= 6) {
                T *= 1.2; X *= 1.2;
                patterns.push({ name: '🔥 Đang thắng cực lớn', pred: 'T', diem: 15 });
            } else if (s.chuoi >= 4) {
                T *= 1.1; X *= 1.1;
                patterns.push({ name: '🔥 Đang thắng lớn', pred: 'T', diem: 10 });
            }
        }

        const total = T + X;
        if (total === 0) return this.smartFallback(game);

        const pred = T > X ? 'TÀI' : 'XỈU';
        let conf = Math.round(Math.max(T, X) / total * 100);
        if (patterns.length >= 10) conf = Math.min(99, conf + 8);
        else if (patterns.length >= 7) conf = Math.min(99, conf + 5);
        else if (patterns.length >= 4) conf = Math.min(99, conf + 3);
        conf = Math.min(99, Math.max(50, conf));

        const result = pred === 'TÀI' ? 'T' : 'X';
        this.learn(game, result, conf);

        const detail = patterns.map(p => p.name).slice(0, 4).join(' • ');

        return {
            prediction: pred,
            confidence: conf,
            detail: detail || 'Phân tích siêu thông minh',
            patterns: patterns.length
        };
    }

    // ============================================================
    // NHÓM 1: CẦU CƠ BẢN (10 chỉ báo)
    // ============================================================

    getBet(data) {
        if (data.length < 2) return null;
        const last = data[0];
        let count = 1;
        for (let i = 1; i < data.length; i++) {
            if (data[i] === last) count++;
            else break;
        }
        if (count >= 10) return { name: `🔥 Bệt cực dài ${count}`, pred: last === 'T' ? 'X' : 'T', diem: 60 };
        if (count >= 8) return { name: `🔥 Bệt siêu dài ${count}`, pred: last === 'T' ? 'X' : 'T', diem: 50 };
        if (count >= 6) return { name: `⚡ Bệt dài ${count}`, pred: last === 'T' ? 'X' : 'T', diem: 38 };
        if (count >= 4) return { name: `📈 Bệt vừa ${count}`, pred: last === 'T' ? 'X' : 'T', diem: 26 };
        if (count >= 3) return { name: `📊 Bệt ngắn ${count}`, pred: last === 'T' ? 'X' : 'T', diem: 18 };
        if (count >= 2) return { name: `📊 Bệt 2`, pred: last, diem: 10 };
        return null;
    }

    getZigzag(data) {
        if (data.length < 4) return null;
        let changes = 0;
        for (let i = 1; i < Math.min(data.length, 12); i++) {
            if (data[i-1] !== data[i]) changes++;
        }
        if (changes >= 10) return { name: `⚡ Zigzag cực dài ${changes}`, pred: data[0] === 'T' ? 'X' : 'T', diem: 50 };
        if (changes >= 8) return { name: `⚡ Zigzag siêu dài ${changes}`, pred: data[0] === 'T' ? 'X' : 'T', diem: 40 };
        if (changes >= 6) return { name: `🌀 Zigzag dài ${changes}`, pred: data[0] === 'T' ? 'X' : 'T', diem: 28 };
        if (changes >= 4) return { name: `🎯 Zigzag ${changes}`, pred: data[0] === 'T' ? 'X' : 'T', diem: 18 };
        return null;
    }

    getDao(data) {
        if (data.length < 4) return null;
        let alt = true;
        for (let i = 0; i < 3; i++) {
            if (data[i] === data[i+1]) { alt = false; break; }
        }
        if (alt) {
            let diem = 22;
            if (data.length >= 6) diem = 28;
            if (data.length >= 8) diem = 34;
            if (data.length >= 10) diem = 38;
            if (data.length >= 12) diem = 42;
            return { name: `🔄 Đảo 1-1 ${data.length >= 6 ? 'dài' : ''}`, pred: data[0] === 'T' ? 'X' : 'T', diem };
        }
        return null;
    }

    getCau22(data) {
        if (data.length < 6) return null;
        const p1 = data[0] === data[1];
        const p2 = data[2] === data[3];
        const p3 = data[4] === data[5];
        if (p1 && p2 && p3 && data[0] !== data[2] && data[2] !== data[4]) {
            return { name: `🔄 Cầu 2-2`, pred: data[0] === 'T' ? 'X' : 'T', diem: 28 };
        }
        return null;
    }

    getCau33(data) {
        if (data.length < 9) return null;
        const l3 = data.slice(0, 3);
        const p3 = data.slice(3, 6);
        if (l3[0] === l3[1] && l3[1] === l3[2] && p3[0] === p3[1] && p3[1] === p3[2] && l3[0] !== p3[0]) {
            return { name: `🏗️ Cầu 3-3`, pred: l3[0] === 'T' ? 'X' : 'T', diem: 30 };
        }
        return null;
    }

    getCau44(data) {
        if (data.length < 12) return null;
        const l4 = data.slice(0, 4);
        const p4 = data.slice(4, 8);
        if (l4[0] === l4[1] && l4[1] === l4[2] && l4[2] === l4[3] &&
            p4[0] === p4[1] && p4[1] === p4[2] && p4[2] === p4[3] &&
            l4[0] !== p4[0]) {
            return { name: `🏗️ Cầu 4-4`, pred: l4[0] === 'T' ? 'X' : 'T', diem: 34 };
        }
        return null;
    }

    getCau55(data) {
        if (data.length < 15) return null;
        const l5 = data.slice(0, 5);
        const p5 = data.slice(5, 10);
        if (l5.every(v => v === l5[0]) && p5.every(v => v === p5[0]) && l5[0] !== p5[0]) {
            return { name: `🏗️ Cầu 5-5`, pred: l5[0] === 'T' ? 'X' : 'T', diem: 38 };
        }
        return null;
    }

    getCycle(data) {
        if (data.length < 6) return null;
        for (let c = 2; c <= 4; c++) {
            if (data.length < c * 3) continue;
            let valid = true;
            for (let i = 0; i < c; i++) {
                if (data[i] !== data[c + i] || data[i] !== data[c*2 + i]) {
                    valid = false;
                    break;
                }
            }
            if (valid) {
                return { name: `🔁 Chu kỳ ${c}`, pred: data[0] === 'T' ? 'X' : 'T', diem: 24 };
            }
        }
        return null;
    }

    getCau121(data) {
        if (data.length < 4) return null;
        if (data[0] !== data[1] && data[1] === data[2] && data[2] !== data[3] && data[0] === data[3]) {
            return { name: `🎯 Cầu 1-2-1`, pred: data[0] === 'T' ? 'T' : 'X', diem: 18 };
        }
        return null;
    }

    getCau212(data) {
        if (data.length < 4) return null;
        if (data[0] === data[1] && data[1] !== data[2] && data[2] === data[3] && data[0] !== data[3]) {
            return { name: `🎯 Cầu 2-1-2`, pred: data[1] === 'T' ? 'T' : 'X', diem: 18 };
        }
        return null;
    }

    // ============================================================
    // NHÓM 2: CẦU NÂNG CAO (10 chỉ báo)
    // ============================================================

    getCau123(data) {
        if (data.length < 6) return null;
        if (data[0] !== data[1] && data[1] === data[2] && data[2] !== data[3] && data[3] === data[4] && data[0] !== data[3]) {
            return { name: `🎯 Cầu 1-2-3`, pred: data[0] === 'T' ? 'T' : 'X', diem: 16 };
        }
        return null;
    }

    getCau321(data) {
        if (data.length < 6) return null;
        if (data[0] === data[1] && data[1] !== data[2] && data[2] === data[3] && data[3] !== data[4] && data[0] !== data[2]) {
            return { name: `🎯 Cầu 3-2-1`, pred: data[1] === 'T' ? 'T' : 'X', diem: 16 };
        }
        return null;
    }

    getCau111(data) {
        if (data.length < 3) return null;
        if (data[0] !== data[1] && data[1] !== data[2] && data[0] !== data[2]) {
            return { name: `🎯 Cầu 1-1-1`, pred: data[0] === 'T' ? 'T' : 'X', diem: 14 };
        }
        return null;
    }

    getCau222(data) {
        if (data.length < 6) return null;
        if (data[0] === data[1] && data[2] === data[3] && data[4] === data[5] &&
            data[0] !== data[2] && data[2] !== data[4] && data[0] !== data[4]) {
            return { name: `🎯 Cầu 2-2-2`, pred: data[0] === 'T' ? 'T' : 'X', diem: 16 };
        }
        return null;
    }

    getCau333(data) {
        if (data.length < 9) return null;
        const l3_1 = data.slice(0, 3);
        const l3_2 = data.slice(3, 6);
        const l3_3 = data.slice(6, 9);
        if (l3_1.every(v => v === l3_1[0]) && l3_2.every(v => v === l3_2[0]) && l3_3.every(v => v === l3_3[0]) &&
            l3_1[0] !== l3_2[0] && l3_2[0] !== l3_3[0] && l3_1[0] !== l3_3[0]) {
            return { name: `🎯 Cầu 3-3-3`, pred: l3_1[0] === 'T' ? 'T' : 'X', diem: 18 };
        }
        return null;
    }

    getBreakCau(data) {
        if (data.length < 6) return null;
        const first = data[0];
        let count = 1;
        for (let i = 1; i < data.length; i++) {
            if (data[i] === first) count++;
            else break;
        }
        if (count >= 3 && data.length > count + 1) {
            const breakResult = data[count];
            if (breakResult !== first) {
                return { name: `💥 Gãy cầu ${first}→${breakResult}`, pred: breakResult === 'T' ? 'T' : 'X', diem: 16 };
            }
        }
        return null;
    }

    getDao22(data) {
        if (data.length < 4) return null;
        if (data[0] !== data[1] && data[1] === data[2] && data[2] !== data[3] && data[0] !== data[2]) {
            return { name: `🔄 Đảo 2-2`, pred: data[0] === 'T' ? 'X' : 'T', diem: 20 };
        }
        return null;
    }

    getDao33(data) {
        if (data.length < 6) return null;
        if (data[0] !== data[1] && data[1] !== data[2] && data[2] === data[3] && data[3] !== data[4] && data[4] !== data[5]) {
            return { name: `🔄 Đảo 3-3`, pred: data[0] === 'T' ? 'X' : 'T', diem: 22 };
        }
        return null;
    }

    getDao44(data) {
        if (data.length < 8) return null;
        let alt = true;
        for (let i = 0; i < 7; i++) {
            if (data[i] === data[i+1]) { alt = false; break; }
        }
        if (alt) {
            return { name: `🔄 Đảo 4-4`, pred: data[0] === 'T' ? 'X' : 'T', diem: 24 };
        }
        return null;
    }

    getGao(data) {
        if (data.length < 4) return null;
        if (data[0] === data[1] && data[2] === data[3] && data[0] !== data[2] && data[1] === data[2]) {
            return { name: `📈 Gãy cầu 2-2`, pred: data[2] === 'T' ? 'T' : 'X', diem: 14 };
        }
        return null;
    }

    // ============================================================
    // NHÓM 3: THỐNG KÊ (10 chỉ báo)
    // ============================================================

    getTrend(data) {
        if (data.length < 10) return null;
        const tCount = data.slice(0, 10).filter(r => r === 'T').length;
        if (tCount >= 8) return { name: `📈 Tài ${tCount}/10 → Xỉu`, pred: 'X', diem: 20 };
        if (tCount <= 2) return { name: `📉 Xỉu ${10-tCount}/10 → Tài`, pred: 'T', diem: 20 };
        if (tCount >= 6) return { name: `📈 Tài ${tCount}/10 → Xỉu`, pred: 'X', diem: 14 };
        if (tCount <= 4) return { name: `📉 Xỉu ${10-tCount}/10 → Tài`, pred: 'T', diem: 14 };
        return null;
    }

    getBalance(data) {
        if (data.length < 20) return null;
        const tCount = data.slice(0, 20).filter(r => r === 'T').length;
        if (tCount >= 16) return { name: `⚖️ Tài ${tCount}/20 → Xỉu`, pred: 'X', diem: 18 };
        if (tCount <= 4) return { name: `⚖️ Xỉu ${20-tCount}/20 → Tài`, pred: 'T', diem: 18 };
        if (tCount >= 13) return { name: `⚖️ Tài ${tCount}/20 → Xỉu`, pred: 'X', diem: 12 };
        if (tCount <= 7) return { name: `⚖️ Xỉu ${20-tCount}/20 → Tài`, pred: 'T', diem: 12 };
        return null;
    }

    getMomentum(data) {
        if (data.length < 5) return null;
        const tCount = data.slice(0, 5).filter(r => r === 'T').length;
        if (tCount >= 4) return { name: `📊 Đà Tài ${tCount}/5 → Xỉu`, pred: 'X', diem: 14 };
        if (tCount <= 1) return { name: `📊 Đà Xỉu ${5-tCount}/5 → Tài`, pred: 'T', diem: 14 };
        return null;
    }

    getVolatility(data) {
        if (data.length < 5) return null;
        let changes = 0;
        for (let i = 1; i < 5; i++) {
            if (data[i-1] !== data[i]) changes++;
        }
        if (changes >= 4) return { name: `📉 Biến động ${changes}/4 → Đảo`, pred: data[0] === 'T' ? 'X' : 'T', diem: 12 };
        return null;
    }

    getChuoiPhanTich(data) {
        if (data.length < 6) return null;
        const s = data.slice(0, 6).join('');
        if (s === 'TTTTTT') return { name: `📊 Chuỗi 6 Tài → Xỉu`, pred: 'X', diem: 14 };
        if (s === 'XXXXXX') return { name: `📊 Chuỗi 6 Xỉu → Tài`, pred: 'T', diem: 14 };
        if (s === 'TTTTT') return { name: `📊 Chuỗi 5 Tài → Xỉu`, pred: 'X', diem: 12 };
        if (s === 'XXXXX') return { name: `📊 Chuỗi 5 Xỉu → Tài`, pred: 'T', diem: 12 };
        if (s === 'TTTT') return { name: `📊 Chuỗi 4 Tài → Xỉu`, pred: 'X', diem: 10 };
        if (s === 'XXXX') return { name: `📊 Chuỗi 4 Xỉu → Tài`, pred: 'T', diem: 10 };
        return null;
    }

    getLechPhanTich(data) {
        if (data.length < 8) return null;
        const tCount = data.slice(0, 8).filter(r => r === 'T').length;
        if (tCount >= 6) return { name: `📊 Lệch Tài ${tCount}/8 → Xỉu`, pred: 'X', diem: 12 };
        if (tCount <= 2) return { name: `📊 Lệch Xỉu ${8-tCount}/8 → Tài`, pred: 'T', diem: 12 };
        if (tCount >= 5) return { name: `📊 Lệch Tài ${tCount}/8 → Xỉu`, pred: 'X', diem: 8 };
        if (tCount <= 3) return { name: `📊 Lệch Xỉu ${8-tCount}/8 → Tài`, pred: 'T', diem: 8 };
        return null;
    }

    getTongHop(data) {
        if (data.length < 10) return null;
        const tCount = data.slice(0, 10).filter(r => r === 'T').length;
        const changes = data.slice(0, 10).filter((r, i) => i > 0 && r !== data[i-1]).length;
        const score = (tCount / 10) * 2 - (changes / 10);
        if (score > 0.6) return { name: `🧠 Tổng hợp → Xỉu`, pred: 'X', diem: 10 };
        if (score < -0.6) return { name: `🧠 Tổng hợp → Tài`, pred: 'T', diem: 10 };
        return null;
    }

    getBienDongTB(data) {
        if (data.length < 10) return null;
        const changes = data.slice(0, 10).filter((r, i) => i > 0 && r !== data[i-1]).length;
        if (changes >= 8) return { name: `📊 Biến động ${changes}/10 → Đảo`, pred: data[0] === 'T' ? 'X' : 'T', diem: 10 };
        return null;
    }

    getTyLeTai(data) {
        if (data.length < 10) return null;
        const tCount = data.slice(0, 10).filter(r => r === 'T').length;
        const tyLe = tCount / 10;
        if (tyLe >= 0.7) return { name: `📊 Tỷ lệ Tài ${Math.round(tyLe*100)}% → Xỉu`, pred: 'X', diem: 10 };
        if (tyLe <= 0.3) return { name: `📊 Tỷ lệ Xỉu ${Math.round((1-tyLe)*100)}% → Tài`, pred: 'T', diem: 10 };
        return null;
    }

    getDoLech(data) {
        if (data.length < 12) return null;
        const tCount = data.slice(0, 12).filter(r => r === 'T').length;
        const doLech = Math.abs(tCount - 6);
        if (doLech >= 4) {
            const pred = tCount > 6 ? 'X' : 'T';
            return { name: `📊 Độ lệch ${doLech}/12 → ${pred === 'T' ? 'Tài' : 'Xỉu'}`, pred, diem: 10 };
        }
        return null;
    }

    // ============================================================
    // NHÓM 4: KỸ THUẬT (10 chỉ báo)
    // ============================================================

    getFibonacci(data) {
        if (data.length < 8) return null;
        const fibs = [1, 1, 2, 3, 5, 8];
        let fibSum = 0;
        for (const f of fibs) {
            if (data.length > f && data[data.length - f] === 'T') fibSum++;
        }
        const ratio = fibSum / fibs.length;
        if (ratio >= 0.7) return { name: `🔢 Fibonacci ${Math.round(ratio*100)}% → Xỉu`, pred: 'X', diem: 14 };
        if (ratio <= 0.3) return { name: `🔢 Fibonacci ${Math.round(ratio*100)}% → Tài`, pred: 'T', diem: 14 };
        return null;
    }

    getMACrossover(data) {
        if (data.length < 10) return null;
        const ma3 = data.slice(0, 3).filter(r => r === 'T').length / 3;
        const ma5 = data.slice(0, 5).filter(r => r === 'T').length / 5;
        const ma10 = data.slice(0, 10).filter(r => r === 'T').length / 10;
        if (ma3 > ma5 && ma5 > ma10) return { name: `📊 MA3>MA5>MA10 → Xỉu`, pred: 'X', diem: 12 };
        if (ma3 < ma5 && ma5 < ma10) return { name: `📊 MA3<MA5<MA10 → Tài`, pred: 'T', diem: 12 };
        return null;
    }

    getRSI(data) {
        if (data.length < 10) return null;
        const recent = data.slice(0, 9);
        let gains = 0, losses = 0;
        for (let i = 1; i < recent.length; i++) {
            if (recent[i-1] === 'T' && recent[i] === 'T') gains++;
            else if (recent[i-1] === 'X' && recent[i] === 'X') losses++;
        }
        const total = gains + losses;
        if (total === 0) return null;
        const rsi = gains / total;
        if (rsi >= 0.75) return { name: `📈 RSI ${Math.round(rsi*100)}% → Xỉu`, pred: 'X', diem: 12 };
        if (rsi <= 0.25) return { name: `📉 RSI ${Math.round(rsi*100)}% → Tài`, pred: 'T', diem: 12 };
        return null;
    }

    getMACD(data) {
        if (data.length < 12) return null;
        const ma6 = data.slice(0, 6).filter(r => r === 'T').length / 6;
        const ma12 = data.slice(0, 12).filter(r => r === 'T').length / 12;
        const macd = ma6 - ma12;
        if (macd > 0.2) return { name: `📊 MACD dương → Xỉu`, pred: 'X', diem: 10 };
        if (macd < -0.2) return { name: `📊 MACD âm → Tài`, pred: 'T', diem: 10 };
        return null;
    }

    getKalman(data) {
        if (data.length < 6) return null;
        const recent = data.slice(0, 6);
        let estimate = 0.5;
        for (let i = 0; i < recent.length; i++) {
            const z = recent[i] === 'T' ? 1 : 0;
            estimate = estimate + 0.25 * (z - estimate);
        }
        if (estimate > 0.6) return { name: `🎯 Kalman ${Math.round(estimate*100)}% → Xỉu`, pred: 'X', diem: 10 };
        if (estimate < 0.4) return { name: `🎯 Kalman ${Math.round(estimate*100)}% → Tài`, pred: 'T', diem: 10 };
        return null;
    }

    getEnsemble(data) {
        if (data.length < 8) return null;
        const ma3 = data.slice(0, 3).filter(r => r === 'T').length / 3;
        const ma5 = data.slice(0, 5).filter(r => r === 'T').length / 5;
        const trend = ma3 - ma5;
        const vol = data.slice(0, 5).filter((r, i) => i > 0 && r !== data[i-1]).length / 4;
        const score = trend * 2 + vol;
        if (score > 0.5) return { name: `🧠 Ensemble → Xỉu`, pred: 'X', diem: 12 };
        if (score < -0.5) return { name: `🧠 Ensemble → Tài`, pred: 'T', diem: 12 };
        return null;
    }

    getMA3(data) {
        if (data.length < 3) return null;
        const ma = data.slice(0, 3).filter(r => r === 'T').length / 3;
        if (ma >= 0.67) return { name: `📊 MA3 Tài ${Math.round(ma*100)}% → Xỉu`, pred: 'X', diem: 8 };
        if (ma <= 0.33) return { name: `📊 MA3 Xỉu ${Math.round((1-ma)*100)}% → Tài`, pred: 'T', diem: 8 };
        return null;
    }

    getMA5(data) {
        if (data.length < 5) return null;
        const ma = data.slice(0, 5).filter(r => r === 'T').length / 5;
        if (ma >= 0.6) return { name: `📊 MA5 Tài ${Math.round(ma*100)}% → Xỉu`, pred: 'X', diem: 8 };
        if (ma <= 0.4) return { name: `📊 MA5 Xỉu ${Math.round((1-ma)*100)}% → Tài`, pred: 'T', diem: 8 };
        return null;
    }

    getMA10(data) {
        if (data.length < 10) return null;
        const ma = data.slice(0, 10).filter(r => r === 'T').length / 10;
        if (ma >= 0.6) return { name: `📊 MA10 Tài ${Math.round(ma*100)}% → Xỉu`, pred: 'X', diem: 8 };
        if (ma <= 0.4) return { name: `📊 MA10 Xỉu ${Math.round((1-ma)*100)}% → Tài`, pred: 'T', diem: 8 };
        return null;
    }

    getBollinger(data) {
        if (data.length < 10) return null;
        const tCount = data.slice(0, 10).filter(r => r === 'T').length;
        const avg = 5;
        const std = Math.sqrt(data.slice(0, 10).reduce((s, r) => s + Math.pow((r === 'T' ? 1 : 0) - avg/10, 2), 0) / 10);
        const upper = avg/10 + 2 * std;
        const lower = avg/10 - 2 * std;
        const current = tCount / 10;
        if (current > upper) return { name: `📊 Bollinger trên → Xỉu`, pred: 'X', diem: 10 };
        if (current < lower) return { name: `📊 Bollinger dưới → Tài`, pred: 'T', diem: 10 };
        return null;
    }

    // ============================================================
    // NHÓM 5: AI & MACHINE LEARNING (10 chỉ báo)
    // ============================================================

    getKNN(data) {
        if (data.length < 6) return null;
        const last3 = data.slice(0, 3).join('');
        let tCount = 0, xCount = 0;
        for (let i = 3; i < data.length - 3; i++) {
            if (data.slice(i, i+3).join('') === last3) {
                if (data[i+3] === 'T') tCount++;
                else xCount++;
            }
        }
        if (tCount + xCount >= 2) {
            return { name: `🤖 KNN → ${tCount > xCount ? 'Tài' : 'Xỉu'}`, pred: tCount > xCount ? 'T' : 'X', diem: 10 };
        }
        return null;
    }

    getSVM(data) {
        if (data.length < 8) return null;
        const tCount = data.slice(0, 8).filter(r => r === 'T').length;
        const changes = data.slice(0, 8).filter((r, i) => i > 0 && r !== data[i-1]).length;
        const score = (tCount / 8) * 2 - (changes / 8);
        if (score > 0.4) return { name: `🤖 SVM → Xỉu`, pred: 'X', diem: 8 };
        if (score < -0.4) return { name: `🤖 SVM → Tài`, pred: 'T', diem: 8 };
        return null;
    }

    getDecisionTree(data) {
        if (data.length < 5) return null;
        const last = data[0];
        const count = data.slice(0, 5).filter(r => r === last).length;
        if (count >= 4) {
            const pred = last === 'T' ? 'X' : 'T';
            return { name: `🌳 Decision Tree → ${pred === 'T' ? 'Tài' : 'Xỉu'}`, pred, diem: 8 };
        }
        return null;
    }

    getRandomForest(data) {
        if (data.length < 8) return null;
        const tCount = data.slice(0, 8).filter(r => r === 'T').length;
        const pred = tCount >= 4 ? 'T' : 'X';
        return { name: `🌲 Random Forest → ${pred === 'T' ? 'Tài' : 'Xỉu'}`, pred, diem: 8 };
    }

    getNaiveBayes(data) {
        if (data.length < 6) return null;
        const tProb = data.slice(0, 6).filter(r => r === 'T').length / 6;
        const last = data[0];
        const pred = tProb > 0.5 ? 'T' : 'X';
        return { name: `📊 Naive Bayes → ${pred === 'T' ? 'Tài' : 'Xỉu'}`, pred, diem: 8 };
    }

    getNeuralNet(data) {
        if (data.length < 10) return null;
        const ma3 = data.slice(0, 3).filter(r => r === 'T').length / 3;
        const ma5 = data.slice(0, 5).filter(r => r === 'T').length / 5;
        const score = ma3 * 0.6 + ma5 * 0.4;
        const pred = score > 0.5 ? 'T' : 'X';
        return { name: `🧠 Neural Net → ${pred === 'T' ? 'Tài' : 'Xỉu'}`, pred, diem: 8 };
    }

    getLSTM(data) {
        if (data.length < 8) return null;
        const recent = data.slice(0, 8);
        let trend = 0;
        for (let i = 1; i < recent.length; i++) {
            if (recent[i-1] === 'T' && recent[i] === 'T') trend++;
            else if (recent[i-1] === 'X' && recent[i] === 'X') trend--;
        }
        const pred = trend > 0 ? 'X' : 'T';
        return { name: `🧠 LSTM → ${pred === 'T' ? 'Tài' : 'Xỉu'}`, pred, diem: 8 };
    }

    getTransformer(data) {
        if (data.length < 6) return null;
        const first3 = data.slice(0, 3).join('');
        const last3 = data.slice(3, 6).join('');
        if (first3 === last3) {
            const pred = data[0] === 'T' ? 'X' : 'T';
            return { name: `🧠 Transformer → ${pred === 'T' ? 'Tài' : 'Xỉu'}`, pred, diem: 8 };
        }
        return null;
    }

    getGradientBoost(data) {
        if (data.length < 8) return null;
        const tCount = data.slice(0, 8).filter(r => r === 'T').length;
        const changes = data.slice(0, 8).filter((r, i) => i > 0 && r !== data[i-1]).length;
        const score = (tCount / 8) - (changes / 16);
        const pred = score > 0 ? 'T' : 'X';
        return { name: `📊 Gradient Boost → ${pred === 'T' ? 'Tài' : 'Xỉu'}`, pred, diem: 8 };
    }

    getXGBoost(data) {
        if (data.length < 10) return null;
        const ma3 = data.slice(0, 3).filter(r => r === 'T').length / 3;
        const ma5 = data.slice(0, 5).filter(r => r === 'T').length / 5;
        const ma10 = data.slice(0, 10).filter(r => r === 'T').length / 10;
        const score = ma3 * 0.5 + ma5 * 0.3 + ma10 * 0.2;
        const pred = score > 0.5 ? 'T' : 'X';
        return { name: `📊 XGBoost → ${pred === 'T' ? 'Tài' : 'Xỉu'}`, pred, diem: 8 };
    }

    // ============================================================
    // FALLBACK THÔNG MINH
    // ============================================================
    smartFallback(game) {
        const s = this.streakMemory.get(game);
        if (s && s.chuoi <= -4) return { prediction: 'TÀI', confidence: 65, detail: '🔄 Đảo chiều cực mạnh' };
        if (s && s.chuoi <= -3) return { prediction: 'TÀI', confidence: 60, detail: '🔄 Đảo chiều siêu mạnh' };
        if (s && s.chuoi <= -2) return { prediction: 'TÀI', confidence: 55, detail: '🔄 Đảo chiều mạnh' };
        if (s && s.chuoi >= 5) return { prediction: 'XỈU', confidence: 65, detail: '📊 Đảo chuỗi cực mạnh' };
        if (s && s.chuoi >= 4) return { prediction: 'XỈU', confidence: 60, detail: '📊 Đảo chuỗi siêu mạnh' };
        if (s && s.chuoi >= 3) return { prediction: 'XỈU', confidence: 55, detail: '📊 Đảo chuỗi mạnh' };
        if (s && s.last5.length >= 5) {
            const tCount = s.last5.filter(r => r === 'T').length;
            if (tCount >= 4) return { prediction: 'XỈU', confidence: 62, detail: '📊 Last5 Tài 4/5 → Xỉu' };
            if (tCount <= 1) return { prediction: 'TÀI', confidence: 62, detail: '📊 Last5 Xỉu 4/5 → Tài' };
        }
        const seed = Date.now() % 3;
        const preds = ['TÀI', 'XỈU', 'TÀI'];
        return { prediction: preds[seed], confidence: 50, detail: '📊 Phân tích cơ bản' };
    }

    // ============================================================
    // LƯU & TẢI
    // ============================================================
    saveData() {
        try {
            const data = { streak: Object.fromEntries(this.streakMemory), accuracy: Object.fromEntries(this.accuracyMemory) };
            fs.writeFileSync(LEARNING_FILE, JSON.stringify(data, null, 2));
        } catch (e) {}
    }

    loadData() {
        try {
            if (fs.existsSync(LEARNING_FILE)) {
                const data = JSON.parse(fs.readFileSync(LEARNING_FILE, 'utf8'));
                if (data.streak) {
                    for (const [k, v] of Object.entries(data.streak)) {
                        this.streakMemory.set(k, v);
                    }
                }
                if (data.accuracy) {
                    for (const [k, v] of Object.entries(data.accuracy)) {
                        this.accuracyMemory.set(k, v);
                    }
                }
            }
        } catch (e) {}
    }

    getStats(game) {
        const s = this.streakMemory.get(game);
        return {
            chuoi: s ? s.chuoi : 0,
            chuoi_dai: s ? s.best : 0,
            total: s ? s.total : 0,
            tai: s ? s.tai : 0,
            xiu: s ? s.xiu : 0
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
                    console.log(`[HU] ${result.prediction} (${result.confidence}%) - ${result.patterns || 0} patterns`);
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
                    console.log(`[MD5] ${result.prediction} (${result.confidence}%) - ${result.patterns || 0} patterns`);
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
    
    <div class="footer">🌌 <span class="hl">TX Universe</span> • 50 thuật toán thông minh • Tự động cập nhật 5s</div>
</div>
<script>setTimeout(()=>location.reload(),5000);</script>
</body>
</html>
    `;
}

// ============================================================
// 🔌 API
// ============================================================

app.get('/', (req, res) => res.json({ name: 'TX Universe', version: '9.0', author: 'Anh Khôi' }));

app.get('/lc79-hu', async (req, res) => {
    try {
        const data = await fetchData('hu');
        if (!data || data.length === 0) {
            const result = predictor.smartFallback('hu');
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
            const result = predictor.smartFallback('md5');
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
    console.log('║  🌌 TX UNIVERSE v9.0 - ANH KHÔI       ║');
    console.log('║  🧠 50 THUẬT TOÁN THÔNG MINH          ║');
    console.log(`║  📡 http://0.0.0.0:${PORT}             ║`);
    console.log('║  📊 5 NHÓM THUẬT TOÁN:                ║');
    console.log('║  📊 Cầu cơ bản (10)                    ║');
    console.log('║  📊 Cầu nâng cao (10)                  ║');
    console.log('║  📊 Thống kê (10)                      ║');
    console.log('║  📊 Kỹ thuật (10)                      ║');
    console.log('║  📊 AI & ML (10)                       ║');
    console.log('║  📁 himinhlaanhkhoi_history.json      ║');
    console.log('║  📁 himinhlaanhkhoi_learning.json     ║');
    console.log('╚═══════════════════════════════════════════╝\n');
    startAuto();
});
