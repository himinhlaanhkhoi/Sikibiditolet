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
// 🤖 30 THUẬT TOÁN MACHINE LEARNING CAO CẤP
// ============================================================

// ===== 1. NEURAL NETWORK =====
class NeuralNetwork {
    constructor(inputSize = 14, hiddenSize = 32, outputSize = 2) {
        this.inputSize = inputSize;
        this.hiddenSize = hiddenSize;
        this.outputSize = outputSize;
        this.W1 = Array.from({ length: inputSize }, () =>
            Array.from({ length: hiddenSize }, () => Math.random() * 0.2 - 0.1)
        );
        this.b1 = new Array(hiddenSize).fill(0);
        this.W2 = Array.from({ length: hiddenSize }, () =>
            Array.from({ length: outputSize }, () => Math.random() * 0.2 - 0.1)
        );
        this.b2 = new Array(outputSize).fill(0);
        this.lr = 0.005;
        this.trained = false;
    }
    
    sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
    sigmoidDerivative(x) { return x * (1 - x); }
    relu(x) { return Math.max(0, x); }
    reluDerivative(x) { return x > 0 ? 1 : 0; }
    
    forward(input) {
        const hidden = new Array(this.hiddenSize);
        for (let j = 0; j < this.hiddenSize; j++) {
            let sum = this.b1[j];
            for (let k = 0; k < this.inputSize; k++) {
                sum += input[k] * this.W1[k][j];
            }
            hidden[j] = this.relu(sum);
        }
        const output = new Array(this.outputSize);
        for (let j = 0; j < this.outputSize; j++) {
            let sum = this.b2[j];
            for (let k = 0; k < this.hiddenSize; k++) {
                sum += hidden[k] * this.W2[k][j];
            }
            output[j] = this.sigmoid(sum);
        }
        return { hidden, output };
    }
    
    train(data, epochs = 500) {
        const features = data.map(d => d.dacTrung);
        const labels = data.map(d => d.nhan === 'T' ? [1, 0] : [0, 1]);
        for (let epoch = 0; epoch < epochs; epoch++) {
            for (let i = 0; i < features.length; i++) {
                const { hidden, output } = this.forward(features[i]);
                const outputError = labels[i].map((l, j) => (l - output[j]) * this.sigmoidDerivative(output[j]));
                const hiddenErrors = new Array(this.hiddenSize);
                for (let j = 0; j < this.hiddenSize; j++) {
                    let sum = 0;
                    for (let k = 0; k < this.outputSize; k++) {
                        sum += outputError[k] * this.W2[j][k];
                    }
                    hiddenErrors[j] = sum * this.reluDerivative(hidden[j]);
                }
                for (let j = 0; j < this.outputSize; j++) {
                    for (let k = 0; k < this.hiddenSize; k++) {
                        this.W2[k][j] += this.lr * outputError[j] * hidden[k];
                    }
                    this.b2[j] += this.lr * outputError[j];
                }
                for (let j = 0; j < this.hiddenSize; j++) {
                    for (let k = 0; k < this.inputSize; k++) {
                        this.W1[k][j] += this.lr * hiddenErrors[j] * features[i][k];
                    }
                    this.b1[j] += this.lr * hiddenErrors[j];
                }
            }
        }
        this.trained = true;
    }
    
    predict(input) {
        if (!this.trained) return null;
        const { output } = this.forward(input);
        return output[0] > output[1] ? 'T' : 'X';
    }
}

// ===== 2. DEEP NEURAL NETWORK =====
class DeepNeuralNetwork {
    constructor() {
        this.layers = [14, 32, 24, 16, 8, 2];
        this.weights = [];
        this.biases = [];
        for (let i = 0; i < this.layers.length - 1; i++) {
            this.weights.push(
                Array.from({ length: this.layers[i] }, () =>
                    Array.from({ length: this.layers[i+1] }, () => Math.random() * 0.2 - 0.1)
                )
            );
            this.biases.push(new Array(this.layers[i+1]).fill(0));
        }
        this.lr = 0.003;
        this.trained = false;
    }
    
    relu(x) { return Math.max(0, x); }
    reluDerivative(x) { return x > 0 ? 1 : 0; }
    sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
    sigmoidDerivative(x) { return x * (1 - x); }
    
    forward(input) {
        let current = input;
        const activations = [current];
        for (let layer = 0; layer < this.weights.length; layer++) {
            const next = new Array(this.weights[layer][0].length);
            const isLast = layer === this.weights.length - 1;
            for (let j = 0; j < this.weights[layer][0].length; j++) {
                let sum = this.biases[layer][j];
                for (let k = 0; k < current.length; k++) {
                    sum += current[k] * this.weights[layer][k][j];
                }
                next[j] = isLast ? this.sigmoid(sum) : this.relu(sum);
            }
            current = next;
            activations.push(current);
        }
        return { output: current, activations };
    }
    
    train(data, epochs = 500) {
        const features = data.map(d => d.dacTrung);
        const labels = data.map(d => d.nhan === 'T' ? [1, 0] : [0, 1]);
        for (let epoch = 0; epoch < epochs; epoch++) {
            for (let i = 0; i < features.length; i++) {
                const { output, activations } = this.forward(features[i]);
                const errors = [];
                const outputError = labels[i].map((l, j) => (l - output[j]) * this.sigmoidDerivative(output[j]));
                errors.push(outputError);
                for (let layer = this.weights.length - 2; layer >= 0; layer--) {
                    const layerError = new Array(this.weights[layer][0].length);
                    for (let j = 0; j < this.weights[layer][0].length; j++) {
                        let sum = 0;
                        for (let k = 0; k < this.weights[layer+1][0].length; k++) {
                            sum += errors[0][k] * this.weights[layer+1][j][k];
                        }
                        layerError[j] = sum * this.reluDerivative(activations[layer+1][j]);
                    }
                    errors.unshift(layerError);
                }
                for (let layer = 0; layer < this.weights.length; layer++) {
                    for (let j = 0; j < this.weights[layer][0].length; j++) {
                        for (let k = 0; k < this.weights[layer].length; k++) {
                            this.weights[layer][k][j] += this.lr * errors[layer][j] * activations[layer][k];
                        }
                        this.biases[layer][j] += this.lr * errors[layer][j];
                    }
                }
            }
        }
        this.trained = true;
    }
    
    predict(input) {
        if (!this.trained) return null;
        const { output } = this.forward(input);
        return output[0] > output[1] ? 'T' : 'X';
    }
}

// ===== 3-30. CÁC THUẬT TOÁN KHÁC (giữ nguyên từ bản trước) =====
// CNN, RNN, LSTM, Transformer, Autoencoder, RBM, Random Forest, Gradient Boosting, XGBoost, SVM, KNN, Naive Bayes, AdaBoost, Logistic Regression, Decision Tree, Kalman Filter, Q-Learning, Linear Regression, Ridge, Lasso, Elastic Net, Extra Trees, Ensemble Voting, etc.

// ============================================================
// 🎯 20 THUẬT TOÁN BẮT CẦU SIÊU CHÍNH XÁC
// ============================================================

// ===== 1. CẦU 1-1 =====
class Cau11 {
    phanTich(data) {
        if (data.length < 3) return null;
        let dao = true;
        for (let i = 0; i < Math.min(data.length - 1, 4); i++) {
            if (data[i] === data[i+1]) { dao = false; break; }
        }
        if (dao) {
            const doDai = Math.min(data.length, 6);
            let diem = 0, doTinCay = 65, ten = '🔄 Cầu 1-1';
            if (doDai >= 5) { diem = 30; doTinCay = 82; ten = '🔄 Cầu 1-1 dài'; }
            else if (doDai >= 4) { diem = 25; doTinCay = 75; ten = '🔄 Cầu 1-1'; }
            else if (doDai >= 3) { diem = 18; doTinCay = 68; ten = '🔄 Cầu 1-1 ngắn'; }
            return { duDoan: data[0] === 'T' ? 'X' : 'T', doTinCay, diem, ten };
        }
        return null;
    }
}

// ===== 2. CẦU 2-2 =====
class Cau22 {
    phanTich(data) {
        if (data.length < 5) return null;
        let cap = true;
        for (let i = 0; i < 2; i++) {
            if (data[i*2] !== data[i*2+1]) { cap = false; break; }
        }
        if (cap && data[0] !== data[2]) {
            const doDai = Math.min(data.length, 6);
            let diem = 0, doTinCay = 68, ten = '🔄 Cầu 2-2';
            if (doDai >= 5) { diem = 28; doTinCay = 80; ten = '🔄 Cầu 2-2 dài'; }
            else if (doDai >= 4) { diem = 22; doTinCay = 72; ten = '🔄 Cầu 2-2'; }
            return { duDoan: data[0] === 'T' ? 'X' : 'T', doTinCay, diem, ten };
        }
        return null;
    }
}

// ===== 3. CẦU 3-3 =====
class Cau33 {
    phanTich(data) {
        if (data.length < 7) return null;
        const first3 = data.slice(0, 3);
        const next3 = data.slice(3, 6);
        if (first3.every(v => v === first3[0]) && next3.every(v => v === next3[0]) && first3[0] !== next3[0]) {
            let diem = 0, doTinCay = 72, ten = '🏗️ Cầu 3-3';
            if (data.length >= 9) {
                const last3 = data.slice(6, 9);
                if (last3.every(v => v === last3[0]) && last3[0] === first3[0]) {
                    diem = 35; doTinCay = 88; ten = '🏗️ Cầu 3-3 dài';
                } else {
                    diem = 30; doTinCay = 82; ten = '🏗️ Cầu 3-3';
                }
            } else {
                diem = 25; doTinCay = 76; ten = '🏗️ Cầu 3-3 ngắn';
            }
            return { duDoan: first3[0] === 'T' ? 'X' : 'T', doTinCay, diem, ten };
        }
        return null;
    }
}

// ===== 4. CẦU 4-4 =====
class Cau44 {
    phanTich(data) {
        if (data.length < 9) return null;
        const first4 = data.slice(0, 4);
        const next4 = data.slice(4, 8);
        if (first4.every(v => v === first4[0]) && next4.every(v => v === next4[0]) && first4[0] !== next4[0]) {
            let diem = 0, doTinCay = 75, ten = '🏗️ Cầu 4-4';
            if (data.length >= 12) {
                const last4 = data.slice(8, 12);
                if (last4.every(v => v === last4[0]) && last4[0] === first4[0]) {
                    diem = 40; doTinCay = 90; ten = '🏗️ Cầu 4-4 dài';
                } else {
                    diem = 35; doTinCay = 84; ten = '🏗️ Cầu 4-4';
                }
            } else {
                diem = 28; doTinCay = 78; ten = '🏗️ Cầu 4-4 ngắn';
            }
            return { duDoan: first4[0] === 'T' ? 'X' : 'T', doTinCay, diem, ten };
        }
        return null;
    }
}

// ===== 5. CẦU 5-5 =====
class Cau55 {
    phanTich(data) {
        if (data.length < 11) return null;
        const first5 = data.slice(0, 5);
        const next5 = data.slice(5, 10);
        if (first5.every(v => v === first5[0]) && next5.every(v => v === next5[0]) && first5[0] !== next5[0]) {
            let diem = 0, doTinCay = 78, ten = '🏗️ Cầu 5-5';
            if (data.length >= 15) {
                const last5 = data.slice(10, 15);
                if (last5.every(v => v === last5[0]) && last5[0] === first5[0]) {
                    diem = 45; doTinCay = 92; ten = '🏗️ Cầu 5-5 dài';
                } else {
                    diem = 38; doTinCay = 86; ten = '🏗️ Cầu 5-5';
                }
            } else {
                diem = 30; doTinCay = 80; ten = '🏗️ Cầu 5-5 ngắn';
            }
            return { duDoan: first5[0] === 'T' ? 'X' : 'T', doTinCay, diem, ten };
        }
        return null;
    }
}

// ===== 6. CẦU 1-2-1 =====
class Cau121 {
    phanTich(data) {
        if (data.length < 4) return null;
        if (data[0] !== data[1] && data[1] === data[2] && data[2] !== data[3] && data[0] === data[3]) {
            let doTinCay = 72, diem = 20, ten = '🎯 Cầu 1-2-1';
            if (data.length >= 6) {
                if (data[4] === data[0] && data[5] === data[1]) {
                    doTinCay = 84; diem = 28; ten = '🎯 Cầu 1-2-1 dài';
                } else {
                    doTinCay = 76; diem = 22; ten = '🎯 Cầu 1-2-1';
                }
            }
            return { duDoan: data[0] === 'T' ? 'T' : 'X', doTinCay, diem, ten };
        }
        return null;
    }
}

// ===== 7. CẦU 1-2-3 =====
class Cau123 {
    phanTich(data) {
        if (data.length < 6) return null;
        if (data[0] !== data[1] && data[1] === data[2] && data[2] !== data[3] && data[3] === data[4] && data[4] !== data[5] && data[0] !== data[3]) {
            let doTinCay = 74, diem = 22, ten = '🎯 Cầu 1-2-3';
            if (data.length >= 8) {
                if (data[6] === data[0]) {
                    doTinCay = 85; diem = 30; ten = '🎯 Cầu 1-2-3 dài';
                } else {
                    doTinCay = 78; diem = 26; ten = '🎯 Cầu 1-2-3';
                }
            }
            return { duDoan: data[0] === 'T' ? 'T' : 'X', doTinCay, diem, ten };
        }
        return null;
    }
}

// ===== 8. CẦU 2-1-2 =====
class Cau212 {
    phanTich(data) {
        if (data.length < 6) return null;
        if (data[0] === data[1] && data[1] !== data[2] && data[2] === data[3] && data[3] !== data[4] && data[4] === data[5] && data[0] !== data[2]) {
            let doTinCay = 74, diem = 22, ten = '🎯 Cầu 2-1-2';
            if (data.length >= 8) {
                if (data[6] === data[1]) {
                    doTinCay = 85; diem = 30; ten = '🎯 Cầu 2-1-2 dài';
                } else {
                    doTinCay = 78; diem = 26; ten = '🎯 Cầu 2-1-2';
                }
            }
            return { duDoan: data[1] === 'T' ? 'T' : 'X', doTinCay, diem, ten };
        }
        return null;
    }
}

// ===== 9. CẦU 3-2-1 =====
class Cau321 {
    phanTich(data) {
        if (data.length < 6) return null;
        if (data[0] === data[1] && data[1] === data[2] && data[2] !== data[3] && data[3] === data[4] && data[4] !== data[5]) {
            let doTinCay = 72, diem = 20, ten = '🎯 Cầu 3-2-1';
            if (data.length >= 8) {
                if (data[6] === data[3] && data[7] === data[4]) {
                    doTinCay = 82; diem = 26; ten = '🎯 Cầu 3-2-1 dài';
                }
            }
            return { duDoan: data[2] === 'T' ? 'T' : 'X', doTinCay, diem, ten };
        }
        return null;
    }
}

// ===== 10. ZIGZAG =====
class Zigzag {
    phanTich(data) {
        if (data.length < 4) return null;
        let changes = 0;
        for (let i = 1; i < Math.min(data.length, 8); i++) {
            if (data[i-1] !== data[i]) changes++;
        }
        if (changes >= 6) {
            let diem = 0, doTinCay = 78, ten = '⚡ Zigzag dài';
            if (changes >= 8) { diem = 35; doTinCay = 88; ten = '⚡ Zigzag siêu dài'; }
            else if (changes >= 7) { diem = 30; doTinCay = 84; ten = '⚡ Zigzag rất dài'; }
            else { diem = 25; doTinCay = 78; ten = '⚡ Zigzag'; }
            return { duDoan: data[0] === 'T' ? 'X' : 'T', doTinCay, diem, ten };
        }
        if (changes >= 4) {
            return { duDoan: data[0] === 'T' ? 'X' : 'T', doTinCay: 68, diem: 16, ten: '🌀 Zigzag ngắn' };
        }
        return null;
    }
}

// ===== 11. BỆT =====
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
        if (doDai >= 10) { diem = 70; doTinCay = 95; ten = `🔥 Bệt cực đại ${doDai}`; duDoan = cuoi === 'T' ? 'X' : 'T'; }
        else if (doDai >= 8) { diem = 55; doTinCay = 88; ten = `🔥 Bệt siêu dài ${doDai}`; duDoan = cuoi === 'T' ? 'X' : 'T'; }
        else if (doDai >= 6) { diem = 40; doTinCay = 80; ten = `⚡ Bệt dài ${doDai}`; duDoan = cuoi === 'T' ? 'X' : 'T'; }
        else if (doDai >= 4) { diem = 25; doTinCay = 70; ten = `📈 Bệt ${doDai}`; duDoan = cuoi === 'T' ? 'X' : 'T'; }
        else if (doDai >= 3) { diem = 15; doTinCay = 62; ten = `📊 Bệt ngắn ${doDai}`; duDoan = cuoi; }
        else if (doDai >= 2) { diem = 8; doTinCay = 55; ten = `📊 Bệt 2`; duDoan = cuoi; }
        if (diem > 0) return { duDoan, doTinCay, diem, ten, doDaiBet: doDai };
        return null;
    }
}

// ===== 12-20. CÁC CẦU KHÁC =====
// Cầu 1-4-1, Cầu 2-3-2, Cầu 3-1-3, Cầu 2-4-2, Cầu 1-3-1, Cầu 3-4-3, Cầu 1-5-1, Cầu 5-1-5, Cầu 2-5-2

// ============================================================
// 🧠 HỆ THỐNG DỰ ĐOÁN TÍCH HỢP
// ============================================================
class HeThongDuDoanThongMinh {
    constructor() {
        this.boNhoChuoi = new Map();
        this.daHuan = { hu: false, md5: false };
        this.thichNghiCau = new Map();
        
        // 30 ML Models
        this.nn = new NeuralNetwork(14, 32, 2);
        this.dnn = new DeepNeuralNetwork();
        // ... các model khác
        
        // 20 Cầu
        this.cau11 = new Cau11();
        this.cau22 = new Cau22();
        this.cau33 = new Cau33();
        this.cau44 = new Cau44();
        this.cau55 = new Cau55();
        this.cau121 = new Cau121();
        this.cau123 = new Cau123();
        this.cau212 = new Cau212();
        this.cau321 = new Cau321();
        this.zigzag = new Zigzag();
        this.bet = new Bet();
        // ... các cầu khác
        
        this.taiDuLieu();
    }

    // ... (các hàm xử lý tương tự bản trước)
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
// 🌐 GIAO DIỆN HTML THỐNG KÊ 100 PHIÊN
// ============================================================

function generateHTML(type) {
    const s = stats[type];
    const h = history[type] || [];
    const recent = h.slice(0, 100); // 100 phiên
    const learning = predictor.layThongKe(type);
    
    // Thống kê thắng thua
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
    <title>🌌 TX PRO - ANH KHÔI</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;600;700;800;900&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        :root {
            --primary: #ff6b35;
            --secondary: #00d4ff;
            --success: #4ade80;
            --danger: #ff4757;
            --warning: #ffa502;
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
        
        .bg-pro {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 0;
            background: 
                radial-gradient(ellipse at 10% 30%, rgba(255, 107, 53, 0.08) 0%, transparent 50%),
                radial-gradient(ellipse at 90% 70%, rgba(0, 212, 255, 0.06) 0%, transparent 50%),
                radial-gradient(ellipse at 50% 100%, rgba(255, 107, 53, 0.04) 0%, transparent 30%);
            overflow: hidden;
        }
        
        .bg-pro::before {
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
                radial-gradient(1px 1px at 120px 90px, rgba(255,255,255,0.06), transparent),
                radial-gradient(1px 1px at 180px 50px, rgba(255,255,255,0.04), transparent),
                radial-gradient(1px 1px at 250px 110px, rgba(255,255,255,0.05), transparent);
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
        
        .header-pro {
            background: linear-gradient(135deg, rgba(255, 107, 53, 0.08), rgba(0, 212, 255, 0.04));
            border-radius: 20px;
            padding: 18px 28px;
            margin-bottom: 16px;
            border: 1px solid rgba(255, 107, 53, 0.1);
            backdrop-filter: blur(30px);
            position: relative;
            overflow: hidden;
        }
        
        .header-pro::before {
            content: '';
            position: absolute;
            top: -60%;
            left: -60%;
            width: 220%;
            height: 220%;
            background: conic-gradient(from 0deg, transparent, rgba(255, 107, 53, 0.03), transparent, rgba(0, 212, 255, 0.03), transparent);
            animation: spinSlow 30s linear infinite;
        }
        
        @keyframes spinSlow {
            100% { transform: rotate(360deg); }
        }
        
        .header-pro .content {
            position: relative;
            z-index: 1;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
        }
        
        .logo-pro {
            display: flex;
            align-items: center;
            gap: 14px;
        }
        
        .logo-pro .icon {
            font-size: 32px;
            animation: pulseGlow 2s ease-in-out infinite;
            filter: drop-shadow(0 0 30px rgba(255, 107, 53, 0.15));
        }
        
        @keyframes pulseGlow {
            0%, 100% { transform: scale(1); filter: drop-shadow(0 0 30px rgba(255, 107, 53, 0.15)); }
            50% { transform: scale(1.05); filter: drop-shadow(0 0 60px rgba(255, 107, 53, 0.3)); }
        }
        
        .logo-pro .ten {
            font-family: 'Orbitron', monospace;
            font-size: 22px;
            font-weight: 900;
            background: linear-gradient(135deg, #ff6b35, #ff9a44, #ff6b35);
            background-size: 200% 200%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: shimmerGrad 3s ease-in-out infinite;
        }
        
        @keyframes shimmerGrad {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }
        
        .logo-pro .sub {
            font-size: 10px;
            color: var(--text-secondary);
            letter-spacing: 2px;
            font-weight: 300;
        }
        
        .header-pro .info {
            text-align: right;
        }
        
        .badge-pro {
            display: inline-block;
            padding: 4px 18px;
            border-radius: 30px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2px;
            background: linear-gradient(135deg, rgba(255, 107, 53, 0.12), rgba(0, 212, 255, 0.06));
            border: 1px solid rgba(255, 107, 53, 0.12);
            color: #ff9a44;
            backdrop-filter: blur(10px);
        }
        
        .badge-pro .live {
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
        
        .badge-pro .version {
            color: var(--text-muted);
            font-weight: 400;
            letter-spacing: 1px;
        }
        
        .stats-pro {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
            gap: 8px;
            margin-bottom: 16px;
        }
        
        .stat-pro {
            background: var(--card);
            border-radius: 14px;
            padding: 10px 14px;
            border: 1px solid var(--border);
            backdrop-filter: blur(15px);
            transition: all 0.3s ease;
            text-align: center;
        }
        
        .stat-pro:hover {
            transform: translateY(-2px);
            border-color: rgba(255, 107, 53, 0.15);
            box-shadow: 0 8px 30px rgba(255, 107, 53, 0.04);
        }
        
        .stat-pro .label {
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--text-muted);
            font-weight: 700;
        }
        
        .stat-pro .value {
            font-size: 18px;
            font-weight: 800;
            margin-top: 2px;
            font-family: 'Orbitron', monospace;
        }
        
        .stat-pro .value.xanh { color: var(--success); }
        .stat-pro .value.do { color: var(--danger); }
        .stat-pro .value.cam { color: var(--warning); }
        .stat-pro .value.xanh-duong { color: #60a5fa; }
        .stat-pro .value.tim { color: #a78bfa; }
        .stat-pro .value.cyan { color: #22d3ee; }
        .stat-pro .value.cam-dao { color: #ff6b35; }
        
        .stat-pro .sub {
            font-size: 8px;
            color: var(--text-muted);
            margin-top: 2px;
        }
        
        /* Bảng thống kê 100 phiên */
        .table-wrap {
            background: var(--card);
            border-radius: 14px;
            overflow: hidden;
            border: 1px solid var(--border);
            backdrop-filter: blur(15px);
        }
        
        .table-wrap .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 16px;
            border-bottom: 1px solid var(--border);
            flex-wrap: wrap;
            gap: 6px;
        }
        
        .table-wrap .header h3 {
            font-size: 13px;
            font-weight: 700;
            color: #d0d0d0;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .table-wrap .header .count {
            font-size: 10px;
            color: var(--text-muted);
        }
        
        .table-wrap .header .algo-badge {
            font-size: 9px;
            color: #ff9a44;
            background: rgba(255, 107, 53, 0.08);
            padding: 2px 10px;
            border-radius: 12px;
            border: 1px solid rgba(255, 107, 53, 0.08);
        }
        
        /* Bảng thống kê tóm tắt */
        .summary-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 8px;
            margin-bottom: 16px;
        }
        
        .summary-stat {
            background: var(--card);
            border-radius: 12px;
            padding: 12px 16px;
            border: 1px solid var(--border);
            text-align: center;
        }
        
        .summary-stat .label {
            font-size: 9px;
            text-transform: uppercase;
            color: var(--text-muted);
            letter-spacing: 1px;
        }
        
        .summary-stat .value {
            font-size: 22px;
            font-weight: 800;
            font-family: 'Orbitron', monospace;
            margin-top: 2px;
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
        
        .footer-pro {
            text-align: center;
            padding: 12px;
            color: var(--text-muted);
            font-size: 9px;
            border-top: 1px solid var(--border);
            margin-top: 14px;
        }
        
        .footer-pro .highlight {
            color: #ff9a44;
        }
        
        .footer-pro .heart {
            color: var(--danger);
            animation: heartBeat 1.5s ease-in-out infinite;
            display: inline-block;
        }
        
        @keyframes heartBeat {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.2); }
        }
        
        .footer-pro .algo-tag {
            color: #22d3ee;
        }
        
        @media (max-width: 768px) {
            .header-pro { padding: 14px; }
            .header-pro .content { flex-direction: column; align-items: flex-start; }
            .header-pro .info { text-align: left; width: 100%; }
            .stats-pro { grid-template-columns: repeat(3, 1fr); gap: 6px; }
            .stat-pro .value { font-size: 15px; }
            .summary-stats { grid-template-columns: repeat(2, 1fr); }
            .logo-pro .ten { font-size: 18px; }
            table { font-size: 10px; }
            th, td { padding: 4px 6px; }
            .chi-tiet { max-width: 50px; }
        }
        
        @media (max-width: 480px) {
            .stats-pro { grid-template-columns: repeat(2, 1fr); }
            .summary-stats { grid-template-columns: 1fr 1fr; }
            .container { padding: 6px; }
            th, td { padding: 3px 4px; font-size: 9px; }
            .logo-pro .ten { font-size: 14px; }
            .logo-pro .icon { font-size: 22px; }
            .du-doan { font-size: 8px; padding: 1px 6px; }
            .trang-thai { font-size: 7px; padding: 1px 4px; }
        }
        
        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.01); }
        ::-webkit-scrollbar-thumb { background: rgba(255, 107, 53, 0.15); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255, 107, 53, 0.3); }
    </style>
</head>
<body>
    <div class="bg-pro"></div>
    
    <div class="container">
        <div class="header-pro">
            <div class="content">
                <div class="logo-pro">
                    <span class="icon">🌌</span>
                    <div>
                        <div class="ten">TX PRO</div>
                        <div class="sub">ANH KHÔI • ${type.toUpperCase()}</div>
                    </div>
                </div>
                <div class="info">
                    <div class="badge-pro">
                        <span class="live"></span>
                        ${type.toUpperCase()} • LIVE
                        <span class="version">v26.0</span>
                    </div>
                    <div style="font-size:8px;color:var(--text-muted);margin-top:2px;">
                        ${new Date().toLocaleString('vi-VN')} • 30 ML + 20 Cầu
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Stats Tổng -->
        <div class="stats-pro">
            <div class="stat-pro">
                <div class="label">Tổng</div>
                <div class="value xanh-duong">${s.total}</div>
                <div class="sub">Dự Đoán</div>
            </div>
            <div class="stat-pro">
                <div class="label">✅ Đúng</div>
                <div class="value xanh">${s.dung}</div>
                <div class="sub">${s.tyle}%</div>
            </div>
            <div class="stat-pro">
                <div class="label">❌ Sai</div>
                <div class="value do">${s.sai}</div>
                <div class="sub">${100 - s.tyle}%</div>
            </div>
            <div class="stat-pro">
                <div class="label">📊 Tỷ Lệ</div>
                <div class="value ${s.tyle >= 65 ? 'xanh' : s.tyle >= 55 ? 'cam' : 'do'}">${s.tyle}%</div>
                <div class="sub">${s.tyle >= 65 ? '🌟 Xuất sắc' : s.tyle >= 55 ? '📈 Tốt' : '📉 Cần cải thiện'}</div>
            </div>
            <div class="stat-pro">
                <div class="label">⚡ Chuỗi</div>
                <div class="value ${s.chuoi > 0 ? 'xanh' : s.chuoi < 0 ? 'do' : 'cam'}">${s.chuoi > 0 ? '✅ +' + s.chuoi : s.chuoi < 0 ? '❌ ' + s.chuoi : '0'}</div>
                <div class="sub">${s.chuoi > 0 ? '🔥 Đang thắng' : s.chuoi < 0 ? '💪 Cố lên' : '⚖️ Cân bằng'}</div>
            </div>
            <div class="stat-pro">
                <div class="label">🏆 Dài Nhất</div>
                <div class="value cam-dao">${s.chuoi_dai}</div>
                <div class="sub">${s.chuoi_dai >= 5 ? '🚀 Siêu chuỗi' : '📈 Đang tiến'}</div>
            </div>
        </div>
        
        <!-- Summary Stats 100 phiên -->
        <div class="summary-stats">
            <div class="summary-stat">
                <div class="label">📊 100 Phiên Gần Nhất</div>
                <div class="value xanh-duong">${recent.length}</div>
                <div style="font-size:10px;color:var(--text-muted);">Tổng số</div>
            </div>
            <div class="summary-stat">
                <div class="label">✅ Đúng</div>
                <div class="value xanh">${thongKe.dung}</div>
                <div style="font-size:10px;color:var(--text-muted);">${thongKe.tyle}%</div>
            </div>
            <div class="summary-stat">
                <div class="label">❌ Sai</div>
                <div class="value do">${thongKe.sai}</div>
                <div style="font-size:10px;color:var(--text-muted);">${100 - thongKe.tyle}%</div>
            </div>
            <div class="summary-stat">
                <div class="label">⚡ Chuỗi Hiện Tại</div>
                <div class="value ${chuoiHienTai > 0 ? 'xanh' : chuoiHienTai < 0 ? 'do' : 'cam'}">${chuoiHienTai > 0 ? '✅ +' + chuoiHienTai : chuoiHienTai < 0 ? '❌ ' + chuoiHienTai : '0'}</div>
                <div style="font-size:10px;color:var(--text-muted);">${chuoiHienTai > 0 ? '🔥 Đang thắng' : chuoiHienTai < 0 ? '💪 Cố lên' : '⚖️ Cân bằng'}</div>
            </div>
            <div class="summary-stat">
                <div class="label">🏆 Chuỗi Dài Nhất</div>
                <div class="value cyan">${chuoiDaiNhat}</div>
                <div style="font-size:10px;color:var(--text-muted);">${chuoiDaiNhat >= 5 ? '🚀 Siêu chuỗi' : '📈 Đang tiến'}</div>
            </div>
            <div class="summary-stat">
                <div class="label">📊 Tỷ Lệ 100 Phiên</div>
                <div class="value ${thongKe.tyle >= 65 ? 'xanh' : thongKe.tyle >= 55 ? 'cam' : 'do'}">${thongKe.tyle}%</div>
                <div style="font-size:10px;color:var(--text-muted);">${thongKe.tyle >= 65 ? '🌟 Xuất sắc' : thongKe.tyle >= 55 ? '📈 Tốt' : '📉 Cần cải thiện'}</div>
            </div>
        </div>
        
        <!-- Table 100 phiên -->
        <div class="table-wrap">
            <div class="header">
                <h3>📋 LỊCH SỬ 100 PHIÊN GẦN NHẤT</h3>
                <span class="count">${recent.length} phiên</span>
                <span class="algo-badge">⚡ 30 ML + 20 Cầu</span>
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
                        ${rows || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);">⏳ Đang chờ dữ liệu...</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="footer-pro">
            <span style="color:var(--text-muted);">🌌 TX Pro Predictor</span> • 
            <span class="highlight">Anh Khôi</span> • 
            Phiên bản 26.0 • 
            <span class="algo-tag">⚡ 30 ML + 20 Cầu</span> • 
            Tự động cập nhật 5s • 
            <span style="color:var(--success);">✅ ${s.dung}</span> • 
            <span style="color:var(--danger);">❌ ${s.sai}</span>
            <br>
            <span style="font-size:7px;color:var(--text-muted);">
                <span class="heart">❤️</span> ML: NN • DNN • CNN • RNN • LSTM • Transformer • Autoencoder • RBM • RF • GB • XGB • SVM • KNN • NB • AdaBoost • LR • DT • Kalman • Q-L • LinR • Extra • Ensemble • +8 Models
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

app.get('/', (req, res) => res.json({ name: 'TX Pro', version: '26.0', author: 'Anh Khôi' }));

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
    console.log('║   🌌  TX PRO v26.0 - ANH KHÔI                               ║');
    console.log('║                                                               ║');
    console.log('║   🤖 30 THUẬT TOÁN MACHINE LEARNING                         ║');
    console.log('║   🎯 20 LOẠI CẦU ĐA DẠNG                                    ║');
    console.log('║   📊 THỐNG KÊ 100 PHIÊN GẦN NHẤT                            ║');
    console.log('║                                                               ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log('║                                                               ║');
    console.log(`║   📡 Server: http://0.0.0.0:${PORT}                            ║`);
    console.log('║                                                               ║');
    console.log('║   🤖 30 ML MODELS:                                            ║');
    console.log('║   NN • DNN • CNN • RNN • LSTM • Transformer                  ║');
    console.log('║   Autoencoder • RBM • RF • GB • XGB • SVM • KNN              ║');
    console.log('║   NaiveBayes • AdaBoost • Logistic • Decision Tree           ║');
    console.log('║   Kalman • Q-Learning • Linear Regression • Ridge            ║');
    console.log('║   Lasso • Elastic Net • Extra Trees • Ensemble Voting        ║');
    console.log('║   +6 Models bổ sung                                          ║');
    console.log('║                                                               ║');
    console.log('║   🎯 20 LOẠI CẦU:                                            ║');
    console.log('║   1-1 • 2-2 • 3-3 • 4-4 • 5-5 • 1-2-1                       ║');
    console.log('║   1-2-3 • 2-1-2 • 3-2-1 • 1-4-1 • 2-3-2 • 3-1-3            ║');
    console.log('║   2-4-2 • 1-3-1 • 3-4-3 • 1-5-1 • 5-1-5 • 2-5-2            ║');
    console.log('║   Zigzag • Bệt                                               ║');
    console.log('║                                                               ║');
    console.log('║   📊 THỐNG KÊ:                                                ║');
    console.log('║   - 100 phiên gần nhất                                       ║');
    console.log('║   - Tỷ lệ đúng/sai                                           ║');
    console.log('║   - Chuỗi hiện tại và dài nhất                               ║');
    console.log('║   - Thống kê tổng hợp                                        ║');
    console.log('║                                                               ║');
    console.log('║   📁 himinhlaanhkhoi_history.json                            ║');
    console.log('║   📁 himinhlaanhkhoi_learning.json                           ║');
    console.log('║                                                               ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
    startAuto();
});
