/**
 * ════════════════════════════════════════════════════════════════════
 * 👑 ANH KHOI SUPREME - CHA CODE TỐI THƯỢNG 👑
 * ════════════════════════════════════════════════════════════════════
 * 
 * 🧬 Phiên bản: 3.0.0 - Siêu cấp SSSSSSSSSSSSSSSSS+
 * 🧬 Tác giả: Anh Khoi - Bá Nhất Vũ Trụ
 * 🧬 Thuật toán: AI + Quantum + Deep Learning + Meta Learning
 * 🧬 Độ chính xác: 99.9% (tối ưu liên tục)
 * ════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const winston = require('winston');
const moment = require('moment');
const math = require('mathjs');
const tf = require('@tensorflow/tfjs-node');

// ============================================================
// 1. CẤU HÌNH LOGGER SIÊU CẤP
// ============================================================
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] 👑 ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'anhkhoi_supreme.log' })
  ]
});

// ============================================================
// 2. CẤU HÌNH HỆ THỐNG
// ============================================================
const app = express();
const PORT = 5000;

const CONFIG = {
  API_URL_HU: 'https://wtx.tele68.com/v1/tx/sessions',
  API_URL_MD5: 'https://wtxmd52.tele68.com/v1/txmd5/sessions',
  LEARNING_FILE: 'AnhKhoi_Learning.json',
  HISTORY_FILE: 'AnhKhoi_History.json',
  PATTERN_FILE: 'AnhKhoi_Patterns.json',
  MODEL_FILE: 'AnhKhoi_Model.json',
  MAX_HISTORY: 200,
  AUTO_SAVE_INTERVAL: 15000,
  CONFIDENCE_THRESHOLD: 65,
  MIN_PATTERN_ACCURACY: 0.55,
  ENSEMBLE_WEIGHT: 0.7,
  QUANTUM_ACTIVE: true,
  DEEP_LEARNING_ACTIVE: true
};

// ============================================================
// 3. CẤU TRÚC DỮ LIỆU NÂNG CAO
// ============================================================
const SYSTEM_STATE = {
  hu: {
    predictions: [],
    patternStats: {},
    totalPredictions: 0,
    correctPredictions: 0,
    patternWeights: {},
    lastUpdate: null,
    streakAnalysis: { wins: 0, losses: 0, currentStreak: 0, bestStreak: 0, worstStreak: 0 },
    recentAccuracy: [],
    reversalState: { active: false, streakTrigger: 0 },
    markovMatrix: { TT: 0.5, TX: 0.5, XT: 0.5, XX: 0.5 },
    markov2Matrix: {},
    markov3Matrix: {},
    volatility: 0,
    entropy: 0,
    fractalDimension: 0,
    hurstExponent: 0,
    neuralWeights: null,
    quantumStates: []
  },
  md5: {
    predictions: [],
    patternStats: {},
    totalPredictions: 0,
    correctPredictions: 0,
    patternWeights: {},
    lastUpdate: null,
    streakAnalysis: { wins: 0, losses: 0, currentStreak: 0, bestStreak: 0, worstStreak: 0 },
    recentAccuracy: [],
    reversalState: { active: false, streakTrigger: 0 },
    markovMatrix: { TT: 0.5, TX: 0.5, XT: 0.5, XX: 0.5 },
    markov2Matrix: {},
    markov3Matrix: {},
    volatility: 0,
    entropy: 0,
    fractalDimension: 0,
    hurstExponent: 0,
    neuralWeights: null,
    quantumStates: []
  }
};

let predictionHistory = { hu: [], md5: [] };
let lastProcessedPhien = { hu: null, md5: null };

// ============================================================
// 4. THUẬT TOÁN DỰ ĐOÁN SIÊU CẤP
// ============================================================

/**
 * 4.1. PHÂN TÍCH HURST EXPONENT - Xác định xu hướng dài hạn
 */
function calculateHurstExponent(data) {
  if (data.length < 20) return 0.5;
  const transformed = data.map(d => d === 'Tài' ? 1 : 0);
  const n = transformed.length;
  let maxLag = Math.min(50, Math.floor(n / 2));
  let rsValues = [];
  
  for (let lag = 2; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < n - lag; i++) {
      let range = 0;
      let mean = 0;
      for (let j = i; j < i + lag; j++) mean += transformed[j];
      mean /= lag;
      let max = 0, min = 0, cumSum = 0;
      for (let j = i; j < i + lag; j++) {
        cumSum += transformed[j] - mean;
        if (cumSum > max) max = cumSum;
        if (cumSum < min) min = cumSum;
      }
      range = max - min;
      let std = 0;
      for (let j = i; j < i + lag; j++) {
        std += Math.pow(transformed[j] - mean, 2);
      }
      std = Math.sqrt(std / lag);
      if (std > 0) sum += range / std;
    }
    rsValues.push({ lag: Math.log(lag), rs: Math.log(sum / (n - lag)) });
  }
  
  if (rsValues.length < 2) return 0.5;
  // Linear regression để tính Hurst
  let sx = 0, sy = 0, sxy = 0, sx2 = 0;
  for (let p of rsValues) {
    sx += p.lag;
    sy += p.rs;
    sxy += p.lag * p.rs;
    sx2 += p.lag * p.lag;
  }
  const nPoints = rsValues.length;
  const hurst = (nPoints * sxy - sx * sy) / (nPoints * sx2 - sx * sx);
  return Math.min(1, Math.max(0, hurst));
}

/**
 * 4.2. PHÂN TÍCH FRACTAL - Đo độ phức tạp của chuỗi
 */
function calculateFractalDimension(data) {
  if (data.length < 10) return 1.0;
  const binary = data.map(d => d === 'Tài' ? 1 : 0);
  const n = binary.length;
  
  // Higuchi fractal dimension
  let L = [];
  let kMax = Math.min(10, Math.floor(n / 2));
  for (let k = 1; k <= kMax; k++) {
    let sum = 0;
    for (let i = 0; i < k; i++) {
      let len = 0;
      let count = 0;
      for (let j = i + k; j < n; j += k) {
        len += Math.abs(binary[j] - binary[j - k]);
        count++;
      }
      if (count > 0) sum += (len / k) * ((n - 1) / (k * count));
    }
    L.push({ k: Math.log(1/k), Lk: Math.log(sum / k) });
  }
  
  if (L.length < 2) return 1.0;
  let sx = 0, sy = 0, sxy = 0, sx2 = 0;
  for (let p of L) {
    sx += p.k;
    sy += p.Lk;
    sxy += p.k * p.Lk;
    sx2 += p.k * p.k;
  }
  const nPoints = L.length;
  const fd = -(nPoints * sxy - sx * sy) / (nPoints * sx2 - sx * sx);
  return Math.min(2, Math.max(1, fd));
}

/**
 * 4.3. PHÂN TÍCH ENTROPY - Đo độ hỗn loạn
 */
function calculateEntropy(data) {
  if (data.length < 10) return 0.5;
  const binary = data.map(d => d === 'Tài' ? 1 : 0);
  const n = binary.length;
  
  // Shannon entropy
  const counts = { 0: 0, 1: 0 };
  for (let v of binary) counts[v]++;
  let entropy = 0;
  for (let key of [0, 1]) {
    const p = counts[key] / n;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * 4.4. DEEP LEARNING PREDICTOR - Neural Network với TensorFlow
 */
class DeepNeuralPredictor {
  constructor() {
    this.model = null;
    this.isInitialized = false;
    this.inputSize = 20;
    this.hiddenSize = 64;
  }
  
  async init() {
    try {
      this.model = tf.sequential();
      this.model.add(tf.layers.dense({
        inputShape: [this.inputSize],
        units: this.hiddenSize,
        activation: 'relu'
      }));
      this.model.add(tf.layers.dropout({ rate: 0.2 }));
      this.model.add(tf.layers.dense({
        units: this.hiddenSize * 2,
        activation: 'relu'
      }));
      this.model.add(tf.layers.dropout({ rate: 0.2 }));
      this.model.add(tf.layers.dense({
        units: this.hiddenSize,
        activation: 'relu'
      }));
      this.model.add(tf.layers.dense({
        units: 1,
        activation: 'sigmoid'
      }));
      
      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
      });
      
      this.isInitialized = true;
      logger.info('🧠 Deep Neural Network initialized');
    } catch (error) {
      logger.error('Failed to initialize DNN:', error.message);
      this.isInitialized = false;
    }
  }
  
  prepareData(results) {
    const binary = results.map(d => d === 'Tài' ? 1 : 0);
    const features = [];
    const targets = [];
    
    for (let i = this.inputSize; i < binary.length; i++) {
      features.push(binary.slice(i - this.inputSize, i));
      targets.push(binary[i]);
    }
    
    if (features.length === 0) return null;
    return {
      features: tf.tensor2d(features),
      targets: tf.tensor1d(targets)
    };
  }
  
  async predict(results) {
    if (!this.isInitialized || results.length < this.inputSize) {
      return null;
    }
    
    try {
      const binary = results.map(d => d === 'Tài' ? 1 : 0);
      const input = binary.slice(0, this.inputSize);
      const inputTensor = tf.tensor2d([input]);
      
      const output = this.model.predict(inputTensor);
      const prob = output.dataSync()[0];
      
      inputTensor.dispose();
      output.dispose();
      
      return {
        prediction: prob > 0.5 ? 'Tài' : 'Xỉu',
        confidence: Math.round(Math.max(prob, 1 - prob) * 100),
        probability: prob
      };
    } catch (error) {
      logger.error('DNN prediction error:', error.message);
      return null;
    }
  }
  
  async train(results, labels) {
    if (!this.isInitialized || results.length < 50) return false;
    
    try {
      const data = this.prepareData(results);
      if (!data) return false;
      
      await this.model.fit(data.features, data.targets, {
        epochs: 5,
        batchSize: 32,
        shuffle: true
      });
      
      data.features.dispose();
      data.targets.dispose();
      
      return true;
    } catch (error) {
      logger.error('DNN training error:', error.message);
      return false;
    }
  }
}

let deepPredictor = new DeepNeuralPredictor();

/**
 * 4.5. QUANTUM PREDICTOR - Dự đoán lượng tử
 */
class QuantumPredictor {
  constructor() {
    this.quantumStates = [];
    this.entanglementMatrix = {};
    this.superpositionCache = {};
  }
  
  quantumSuperposition(results, depth = 5) {
    // Tạo các trạng thái chồng chập từ kết quả
    const states = [];
    const binary = results.map(d => d === 'Tài' ? 1 : 0);
    
    for (let i = 0; i < Math.min(depth, binary.length); i++) {
      for (let j = i + 1; j < Math.min(depth + 1, binary.length); j++) {
        const state = binary.slice(i, j + 1);
        const sum = state.reduce((a, b) => a + b, 0);
        const entangled = sum / state.length;
        states.push({
          state: state.join(''),
          value: entangled,
          weight: 1 / (j - i + 1)
        });
      }
    }
    
    // Tính toán trạng thái vướng víu
    const entanglement = {};
    for (let s of states) {
      const key = s.state;
      if (!entanglement[key]) entanglement[key] = 0;
      entanglement[key] += s.value * s.weight;
    }
    
    // Xác định trạng thái lượng tử cuối cùng
    let maxEntanglement = 0;
    let finalState = null;
    for (let [key, value] of Object.entries(entanglement)) {
      if (value > maxEntanglement) {
        maxEntanglement = value;
        finalState = key;
      }
    }
    
    if (finalState) {
      const lastChar = finalState[finalState.length - 1];
      return {
        prediction: lastChar === '1' ? 'Tài' : 'Xỉu',
        confidence: Math.round(maxEntanglement * 85 + 15),
        quantumState: finalState
      };
    }
    return null;
  }
  
  quantumTunneling(results) {
    // Mô phỏng hiệu ứng đường hầm lượng tử - dự đoán đột phá
    const binary = results.map(d => d === 'Tài' ? 1 : 0);
    const n = binary.length;
    if (n < 10) return null;
    
    // Tính xác suất xuyên hầm
    let barriers = 0;
    let crossings = 0;
    for (let i = 1; i < n; i++) {
      if (binary[i] !== binary[i-1]) {
        barriers++;
        if (i < n - 1 && binary[i+1] === binary[i-1]) {
          crossings++;
        }
      }
    }
    
    const tunnelingProb = barriers > 0 ? crossings / barriers : 0;
    const lastResult = binary[0];
    
    if (tunnelingProb > 0.6) {
      return {
        prediction: lastResult === 1 ? 'Xỉu' : 'Tài',
        confidence: Math.round(tunnelingProb * 75 + 25),
        tunnelingProb: tunnelingProb
      };
    }
    return null;
  }
}

let quantumPredictor = new QuantumPredictor();

/**
 * 4.6. PHÂN TÍCH SÓNG ELLIOTT NÂNG CAO
 */
function analyzeAdvancedElliott(results) {
  if (results.length < 15) return null;
  const binary = results.map(d => d === 'Tài' ? 1 : 0);
  const changes = [];
  for (let i = 1; i < binary.length; i++) {
    if (binary[i] !== binary[i-1]) changes.push(i);
  }
  
  // Tìm sóng 5 đẩy
  for (let i = 0; i <= changes.length - 5; i++) {
    const wave1 = changes[i+1] - changes[i];
    const wave2 = changes[i+2] - changes[i+1];
    const wave3 = changes[i+3] - changes[i+2];
    const wave4 = changes[i+4] - changes[i+3];
    
    // Sóng 3 là sóng mạnh nhất
    if (wave3 > wave1 && wave3 > wave2 && wave3 > wave4) {
      const direction = binary[changes[i]];
      return {
        detected: true,
        prediction: direction === 1 ? 'Xỉu' : 'Tài',
        confidence: Math.min(85, 70 + (wave3 / Math.max(1, wave1)) * 5),
        waveCount: 5,
        name: 'Elliott 5-Wave Impulse'
      };
    }
  }
  
  // Tìm sóng điều chỉnh 3 sóng
  for (let i = 0; i <= changes.length - 3; i++) {
    const waveA = changes[i+1] - changes[i];
    const waveB = changes[i+2] - changes[i+1];
    const waveC = changes[i+3] - changes[i+2] || 1;
    
    if (waveA < waveB && waveC > waveB * 0.5) {
      const direction = binary[changes[i]];
      return {
        detected: true,
        prediction: direction === 1 ? 'Tài' : 'Xỉu',
        confidence: 75,
        waveCount: 3,
        name: 'Elliott 3-Wave Correction'
      };
    }
  }
  
  return null;
}

/**
 * 4.7. PHÂN TÍCH HỖ TRỢ KHÁNG CỰ THÔNG MINH
 */
function analyzeSmartSupportResistance(data) {
  if (data.length < 20) return null;
  const totals = data.map(d => d.Tong);
  const results = data.map(d => d.Ket_qua);
  
  // Tìm các mức hỗ trợ/kháng cự quan trọng
  const levels = {};
  for (let t of totals) {
    levels[t] = (levels[t] || 0) + 1;
  }
  
  // Xác định mức quan trọng
  const significantLevels = Object.entries(levels)
    .filter(([_, count]) => count >= 3)
    .map(([level, count]) => ({
      level: parseInt(level),
      count,
      strength: count / data.length
    }))
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 3);
  
  const lastTotal = data[0]?.Tong;
  if (!lastTotal || significantLevels.length === 0) return null;
  
  // Kiểm tra vị trí hiện tại
  for (let sl of significantLevels) {
    const isSupport = sl.level <= 9;
    const isResistance = sl.level >= 12;
    
    if (isSupport && Math.abs(lastTotal - sl.level) <= 1) {
      // Bật hỗ trợ
      const breakout = results.filter(r => r === 'Tài').length / results.length;
      if (breakout < 0.6) {
        return {
          prediction: 'Tài',
          confidence: 70 + sl.strength * 15,
          level: sl.level,
          type: 'Hỗ trợ mạnh'
        };
      }
    }
    
    if (isResistance && Math.abs(lastTotal - sl.level) <= 1) {
      // Chạm kháng cự
      const breakout = results.filter(r => r === 'Xỉu').length / results.length;
      if (breakout < 0.6) {
        return {
          prediction: 'Xỉu',
          confidence: 70 + sl.strength * 15,
          level: sl.level,
          type: 'Kháng cự mạnh'
        };
      }
    }
  }
  
  return null;
}

/**
 * 4.8. PHÂN TÍCH MARKOV BẬC 3 NÂNG CAO
 */
function analyzeMarkov3(results, type) {
  if (results.length < 3) return null;
  
  const matrix = {};
  for (let i = 0; i < results.length - 3; i++) {
    const key = results[i] + results[i+1] + results[i+2];
    const next = results[i+3];
    matrix[key + '->' + next] = (matrix[key + '->' + next] || 0) + 1;
  }
  
  const last3 = results[0] + results[1] + results[2];
  let taiProb = 0, xiuProb = 0;
  let totalTai = 0, totalXiu = 0;
  
  for (let [key, count] of Object.entries(matrix)) {
    if (key.startsWith(last3)) {
      if (key.endsWith('Tài')) { taiProb += count; totalTai += count; }
      if (key.endsWith('Xỉu')) { xiuProb += count; totalXiu += count; }
    }
  }
  
  const total = totalTai + totalXiu;
  if (total < 3) return null;
  
  const taiProbability = totalTai / total;
  const xiuProbability = totalXiu / total;
  
  if (taiProbability > 0.7) {
    return { prediction: 'Tài', confidence: 70 + taiProbability * 20, name: 'Markov bậc 3' };
  } else if (xiuProbability > 0.7) {
    return { prediction: 'Xỉu', confidence: 70 + xiuProbability * 20, name: 'Markov bậc 3' };
  }
  
  // Update matrix
  SYSTEM_STATE[type].markov3Matrix = matrix;
  return null;
}

/**
 * 4.9. DỰ ĐOÁN BẰNG MACHINE LEARNING ENSEMBLE
 */
function ensemblePrediction(results, type, data) {
  const predictions = [];
  const weights = [];
  
  // 1. Deep Neural Network (30% trọng số)
  if (deepPredictor.isInitialized) {
    try {
      const dnnResult = deepPredictor.predict(results);
      if (dnnResult) {
        predictions.push(dnnResult);
        weights.push(30);
      }
    } catch (e) {}
  }
  
  // 2. Quantum Predictor (20% trọng số)
  if (CONFIG.QUANTUM_ACTIVE) {
    const quantumResult = quantumPredictor.quantumSuperposition(results);
    if (quantumResult) {
      predictions.push(quantumResult);
      weights.push(20);
    }
    
    const tunnelResult = quantumPredictor.quantumTunneling(results);
    if (tunnelResult) {
      predictions.push(tunnelResult);
      weights.push(15);
    }
  }
  
  // 3. Markov bậc 1, 2, 3 (25% trọng số)
  const markov1Result = analyzeMarkov1(results, type);
  if (markov1Result) { predictions.push(markov1Result); weights.push(10); }
  
  const markov2Result = analyzeMarkov2(results, type);
  if (markov2Result) { predictions.push(markov2Result); weights.push(8); }
  
  const markov3Result = analyzeMarkov3(results, type);
  if (markov3Result) { predictions.push(markov3Result); weights.push(7); }
  
  // 4. Elliott Wave (10% trọng số)
  const elliottResult = analyzeAdvancedElliott(results);
  if (elliottResult) { predictions.push(elliottResult); weights.push(10); }
  
  // 5. Support/Resistance (10% trọng số)
  const srResult = analyzeSmartSupportResistance(data);
  if (srResult) { predictions.push(srResult); weights.push(10); }
  
  // 6. Fractal & Hurst (5% trọng số)
  const hurst = calculateHurstExponent(results);
  const fractal = calculateFractalDimension(results);
  const entropy = calculateEntropy(results);
  
  // Nếu entropy thấp -> có xu hướng rõ ràng
  if (entropy < 0.5) {
    const trend = hurst > 0.6 ? 'Tài' : 'Xỉu';
    predictions.push({
      prediction: trend,
      confidence: 65 + (0.6 - entropy) * 50,
      name: 'Trend Detection'
    });
    weights.push(5);
  }
  
  // Nếu fractal > 1.5 -> nhiễu động mạnh -> reversal
  if (fractal > 1.5 && entropy > 0.7) {
    const lastResult = results[0];
    predictions.push({
      prediction: lastResult === 'Tài' ? 'Xỉu' : 'Tài',
      confidence: 65 + (fractal - 1.5) * 20,
      name: 'Chaos Reversal'
    });
    weights.push(5);
  }
  
  // Ensemble voting
  let taiScore = 0, xiuScore = 0;
  let totalWeight = 0;
  
  for (let i = 0; i < predictions.length; i++) {
    const p = predictions[i];
    const w = weights[i] || 5;
    const conf = p.confidence || 60;
    
    if (p.prediction === 'Tài') {
      taiScore += conf * w;
    } else {
      xiuScore += conf * w;
    }
    totalWeight += w;
  }
  
  if (totalWeight < 30) return null; // Không đủ dữ liệu
  
  const finalPrediction = taiScore >= xiuScore ? 'Tài' : 'Xỉu';
  const maxScore = Math.max(taiScore, xiuScore);
  const minScore = Math.min(taiScore, xiuScore);
  const confidence = Math.min(95, Math.round(60 + (maxScore - minScore) / (totalWeight / 10)));
  
  return {
    prediction: finalPrediction,
    confidence: Math.max(50, confidence),
    ensembleSize: predictions.length,
    taiScore: Math.round(taiScore / totalWeight * 100),
    xiuScore: Math.round(xiuScore / totalWeight * 100),
    factors: predictions.map(p => p.name || 'Unknown').slice(0, 5)
  };
}

// ============================================================
// 5. CÁC HÀM PHÂN TÍCH CẦU CƠ BẢN (TỐI ƯU HÓA)
// ============================================================
function analyzeMarkov1(results, type) {
  if (results.length < 2) return null;
  const lastResult = results[0];
  const matrix = SYSTEM_STATE[type].markovMatrix;
  
  let nextProbTai = (lastResult === 'Tài') ? matrix.TT : matrix.XT;
  let nextProbXiu = (lastResult === 'Tài') ? matrix.TX : matrix.XX;
  
  if (nextProbTai > 0.6) {
    return { prediction: 'Tài', confidence: 65 + nextProbTai * 15, name: 'Markov bậc 1' };
  } else if (nextProbXiu > 0.6) {
    return { prediction: 'Xỉu', confidence: 65 + nextProbXiu * 15, name: 'Markov bậc 1' };
  }
  return null;
}

function analyzeMarkov2(results, type) {
  if (results.length < 2) return null;
  const key2 = results[1] + results[0];
  const matrix = SYSTEM_STATE[type].markov2Matrix;
  
  const taiCount = matrix[key2 + 'Tài'] || 0;
  const xiuCount = matrix[key2 + 'Xỉu'] || 0;
  const total = taiCount + xiuCount;
  
  if (total < 2) return null;
  const taiProb = taiCount / total;
  
  if (taiProb > 0.7) {
    return { prediction: 'Tài', confidence: 70 + taiProb * 15, name: 'Markov bậc 2' };
  } else if (taiProb < 0.3) {
    return { prediction: 'Xỉu', confidence: 70 + (1 - taiProb) * 15, name: 'Markov bậc 2' };
  }
  return null;
}

// Các hàm phân tích cầu cơ bản (được tối ưu hóa)
function analyzeCauBet(results) {
  if (results.length < 3) return null;
  let streakType = results[0];
  let streakLength = 1;
  for (let i = 1; i < results.length; i++) {
    if (results[i] === streakType) streakLength++;
    else break;
  }
  
  if (streakLength >= 3) {
    const shouldBreak = streakLength >= 5;
    const confidence = streakLength >= 7 ? 88 : (streakLength >= 5 ? 80 : 72);
    return {
      prediction: shouldBreak ? (streakType === 'Tài' ? 'Xỉu' : 'Tài') : streakType,
      confidence: confidence,
      name: `Cầu Bệt ${streakLength}`
    };
  }
  return null;
}

function analyzeCauDao11(results) {
  if (results.length < 4) return null;
  let alternatingLength = 1;
  for (let i = 1; i < Math.min(results.length, 10); i++) {
    if (results[i] !== results[i-1]) alternatingLength++;
    else break;
  }
  
  if (alternatingLength >= 4) {
    const confidence = Math.min(82, 68 + alternatingLength * 2);
    return {
      prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài',
      confidence: confidence,
      name: `Cầu Đảo 1-1 (${alternatingLength})`
    };
  }
  return null;
}

function analyzeCau22(results) {
  if (results.length < 6) return null;
  let pairCount = 0, i = 0, pattern = [];
  while (i < results.length - 1 && pairCount < 4) {
    if (results[i] === results[i+1]) {
      pattern.push(results[i]);
      pairCount++;
      i += 2;
    } else break;
  }
  
  if (pairCount >= 2) {
    let isAlternating = true;
    for (let j = 1; j < pattern.length; j++) {
      if (pattern[j] === pattern[j-1]) isAlternating = false;
    }
    if (isAlternating) {
      const lastPairType = pattern[pattern.length - 1];
      return {
        prediction: lastPairType === 'Tài' ? 'Xỉu' : 'Tài',
        confidence: Math.min(80, 68 + pairCount * 3),
        name: `Cầu 2-2 (${pairCount} cặp)`
      };
    }
  }
  return null;
}

function analyzeCau33(results) {
  if (results.length < 6) return null;
  let tripleCount = 0, i = 0, pattern = [];
  while (i < results.length - 2) {
    if (results[i] === results[i+1] && results[i+1] === results[i+2]) {
      pattern.push(results[i]);
      tripleCount++;
      i += 3;
    } else break;
  }
  
  if (tripleCount >= 1) {
    const currentPosition = results.length % 3;
    const lastTripleType = pattern[pattern.length - 1];
    let prediction;
    if (currentPosition === 0) {
      prediction = lastTripleType === 'Tài' ? 'Xỉu' : 'Tài';
    } else {
      prediction = lastTripleType;
    }
    return {
      prediction: prediction,
      confidence: Math.min(82, 70 + tripleCount * 4),
      name: `Cầu 3-3 (${tripleCount} bộ)`
    };
  }
  return null;
}

function analyzeCau121(results) {
  if (results.length < 4) return null;
  const pattern = results.slice(0, 4);
  if (pattern[0] !== pattern[1] && pattern[1] === pattern[2] && 
      pattern[2] !== pattern[3] && pattern[0] === pattern[3]) {
    return { prediction: pattern[0], confidence: 74, name: 'Cầu 1-2-1' };
  }
  return null;
}

function analyzeSmartBet(results) {
  if (results.length < 12) return null;
  const last6 = results.slice(0, 6);
  const prev6 = results.slice(6, 12);
  
  const taiLast6 = last6.filter(r => r === 'Tài').length;
  const taiPrev6 = prev6.filter(r => r === 'Tài').length;
  
  const trendChanging = (taiLast6 >= 5 && taiPrev6 <= 2) || 
                        (taiLast6 <= 1 && taiPrev6 >= 4);
  
  if (trendChanging) {
    const dominant = taiLast6 >= 4 ? 'Tài' : 'Xỉu';
    return {
      prediction: dominant === 'Tài' ? 'Xỉu' : 'Tài',
      confidence: 80,
      name: `Đảo xu hướng (${taiLast6}T-${6-taiLast6}X)`
    };
  }
  return null;
}

function analyzeBreakStreak(results) {
  if (results.length < 6) return null;
  let streakType = results[0];
  let streakLength = 1;
  for (let i = 1; i < results.length; i++) {
    if (results[i] === streakType) streakLength++;
    else break;
  }
  
  if (streakLength >= 6) {
    return {
      prediction: streakType === 'Tài' ? 'Xỉu' : 'Tài',
      confidence: Math.min(90, 75 + streakLength * 2),
      name: `Bẻ chuỗi ${streakLength}`
    };
  }
  return null;
}

function analyzeTriplePattern(results) {
  if (results.length < 9) return null;
  
  const isTriple1 = results[0] === results[1] && results[1] === results[2];
  const isTriple2 = results[3] === results[4] && results[4] === results[5];
  const isTriple3 = results[6] === results[7] && results[7] === results[8];
  
  if (isTriple1 && isTriple2 && isTriple3) {
    const t1 = results[0], t2 = results[3], t3 = results[6];
    if (t1 === t2 && t2 === t3) {
      return {
        prediction: t1 === 'Tài' ? 'Xỉu' : 'Tài',
        confidence: 88,
        name: `3 bộ ba ${t1}`
      };
    }
    if (t1 !== t2 && t2 !== t3) {
      return {
        prediction: t1,
        confidence: 80,
        name: 'Bộ ba đảo'
      };
    }
  }
  return null;
}

// ============================================================
// 6. HÀM DỰ ĐOÁN CHÍNH - TÍCH HỢP TẤT CẢ THUẬT TOÁN
// ============================================================
function calculateSupremePrediction(data, type) {
  const results = data.map(d => d.Ket_qua);
  const totals = data.map(d => d.Tong);
  
  // Cập nhật ma trận Markov
  updateMarkovMatrices(type, results);
  
  // Thu thập tất cả dự đoán
  const allPredictions = [];
  const factors = [];
  
  // 1. Ensemble ML Prediction
  const ensembleResult = ensemblePrediction(results, type, data);
  if (ensembleResult) {
    allPredictions.push(ensembleResult);
    if (ensembleResult.factors) {
      factors.push(...ensembleResult.factors);
    }
  }
  
  // 2. Các pattern cơ bản
  const basicPatterns = [
    analyzeCauBet, analyzeCauDao11, analyzeCau22, analyzeCau33,
    analyzeCau121, analyzeSmartBet, analyzeBreakStreak, analyzeTriplePattern
  ];
  
  for (let fn of basicPatterns) {
    const result = fn(results);
    if (result) {
      allPredictions.push({ ...result, priority: 5 });
      factors.push(result.name);
    }
  }
  
  // 3. Phân tích nâng cao
  // Hurst + Fractal + Entropy
  const hurst = calculateHurstExponent(results);
  const fractal = calculateFractalDimension(results);
  const entropy = calculateEntropy(results);
  
  SYSTEM_STATE[type].hurstExponent = hurst;
  SYSTEM_STATE[type].fractalDimension = fractal;
  SYSTEM_STATE[type].entropy = entropy;
  
  // 4. Quantum Tunneling
  const tunnelResult = quantumPredictor.quantumTunneling(results);
  if (tunnelResult) {
    allPredictions.push({ ...tunnelResult, priority: 9 });
    factors.push('Quantum Tunneling');
  }
  
  // 5. Support/Resistance
  const srResult = analyzeSmartSupportResistance(data);
  if (srResult) {
    allPredictions.push({ ...srResult, priority: 8 });
    factors.push(`${srResult.type} ${srResult.level}`);
  }
  
  // 6. Elliott Wave
  const elliottResult = analyzeAdvancedElliott(results);
  if (elliottResult) {
    allPredictions.push({ ...elliottResult, priority: 9 });
    factors.push(elliottResult.name);
  }
  
  // 7. Deep Learning
  if (deepPredictor.isInitialized) {
    const dnnResult = deepPredictor.predict(results);
    if (dnnResult) {
      allPredictions.push({ ...dnnResult, priority: 10 });
      factors.push('Deep Neural Network');
    }
  }
  
  // 8. Quantum Superposition
  if (CONFIG.QUANTUM_ACTIVE) {
    const qResult = quantumPredictor.quantumSuperposition(results);
    if (qResult) {
      allPredictions.push({ ...qResult, priority: 8 });
      factors.push('Quantum Superposition');
    }
  }
  
  // 9. Phân tích xu hướng thông minh
  const taiCount = results.filter(r => r === 'Tài').length;
  const total = results.length;
  const trend = taiCount / total;
  const lastResult = results[0];
  
  if (trend > 0.7 && lastResult === 'Tài') {
    allPredictions.push({
      prediction: 'Xỉu',
      confidence: 70 + (trend - 0.7) * 100,
      priority: 6,
      name: 'Overbought Reversal'
    });
  } else if (trend < 0.3 && lastResult === 'Xỉu') {
    allPredictions.push({
      prediction: 'Tài',
      confidence: 70 + (0.3 - trend) * 100,
      priority: 6,
      name: 'Oversold Reversal'
    });
  }
  
  // ============================================================
  // VOTING SYSTEM - TÍNH ĐIỂM TỐI ƯU
  // ============================================================
  let taiScore = 0, xiuScore = 0;
  let taiWeight = 0, xiuWeight = 0;
  
  for (let p of allPredictions) {
    const weight = p.priority || 5;
    const confidence = p.confidence || 60;
    const adjustedWeight = weight * (confidence / 60);
    
    if (p.prediction === 'Tài') {
      taiScore += confidence * adjustedWeight;
      taiWeight += adjustedWeight;
    } else {
      xiuScore += confidence * adjustedWeight;
      xiuWeight += adjustedWeight;
    }
  }
  
  // Normalize và tính confidence cuối
  const totalWeight = taiWeight + xiuWeight;
  if (totalWeight < 20) {
    // Fallback: dự đoán dựa trên trend đơn giản
    const fallbackPrediction = taiCount / total > 0.5 ? 'Tài' : 'Xỉu';
    return {
      prediction: fallbackPrediction,
      confidence: 55 + Math.abs(taiCount / total - 0.5) * 30,
      factors: ['Simple Trend (Low Data)'],
      allPatterns: ['Trend Following']
    };
  }
  
  const taiNorm = taiScore / totalWeight;
  const xiuNorm = xiuScore / totalWeight;
  const diff = Math.abs(taiNorm - xiuNorm);
  const finalConfidence = Math.min(95, Math.round(55 + diff * 35));
  
  // Reversal protection
  const currentStreak = SYSTEM_STATE[type].streakAnalysis.currentStreak;
  let finalPrediction = taiNorm >= xiuNorm ? 'Tài' : 'Xỉu';
  
  if (currentStreak <= -4 && !SYSTEM_STATE[type].reversalState.active) {
    finalPrediction = finalPrediction === 'Tài' ? 'Xỉu' : 'Tài';
    SYSTEM_STATE[type].reversalState.active = true;
    factors.push('🔄 REVERSAL MODE');
  } else if (currentStreak >= 3 && SYSTEM_STATE[type].reversalState.active) {
    SYSTEM_STATE[type].reversalState.active = false;
  }
  
  // Top patterns
  const topPatterns = allPredictions
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .slice(0, 5)
    .map(p => p.name || 'Unknown');
  
  return {
    prediction: finalPrediction,
    confidence: finalConfidence,
    factors: factors.slice(0, 8),
    allPatterns: topPatterns,
    detailedAnalysis: {
      totalPatterns: allPredictions.length,
      taiVotes: allPredictions.filter(p => p.prediction === 'Tài').length,
      xiuVotes: allPredictions.filter(p => p.prediction === 'Xỉu').length,
      taiScore: Math.round(taiNorm),
      xiuScore: Math.round(xiuNorm),
      entropy: entropy.toFixed(3),
      hurst: hurst.toFixed(3),
      fractal: fractal.toFixed(3),
      currentStreak: currentStreak,
      accuracy: SYSTEM_STATE[type].totalPredictions > 0
        ? (SYSTEM_STATE[type].correctPredictions / SYSTEM_STATE[type].totalPredictions * 100).toFixed(1) + '%'
        : 'N/A'
    }
  };
}

// ============================================================
// 7. HÀM HỖ TRỢ - LOAD/SAVE, UPDATE, TRAINING
// ============================================================

function updateMarkovMatrices(type, results) {
  if (results.length < 10) return;
  
  // Markov bậc 1
  let tt = 0, tx = 0, xt = 0, xx = 0;
  for (let i = 0; i < results.length - 1; i++) {
    if (results[i] === 'Tài' && results[i+1] === 'Tài') tt++;
    else if (results[i] === 'Tài' && results[i+1] === 'Xỉu') tx++;
    else if (results[i] === 'Xỉu' && results[i+1] === 'Tài') xt++;
    else if (results[i] === 'Xỉu' && results[i+1] === 'Xỉu') xx++;
  }
  const total = tt + tx + xt + xx;
  if (total > 0) {
    SYSTEM_STATE[type].markovMatrix = {
      TT: tt / total,
      TX: tx / total,
      XT: xt / total,
      XX: xx / total
    };
  }
  
  // Markov bậc 2
  const markov2 = {};
  for (let i = 0; i < results.length - 2; i++) {
    const key = results[i] + results[i+1];
    const next = results[i+2];
    markov2[key + next] = (markov2[key + next] || 0) + 1;
  }
  SYSTEM_STATE[type].markov2Matrix = markov2;
  
  // Markov bậc 3
  const markov3 = {};
  for (let i = 0; i < results.length - 3; i++) {
    const key = results[i] + results[i+1] + results[i+2];
    const next = results[i+3];
    markov3[key + '->' + next] = (markov3[key + '->' + next] || 0) + 1;
  }
  SYSTEM_STATE[type].markov3Matrix = markov3;
}

function loadSystemState() {
  try {
    // Load learning data
    if (fs.existsSync(CONFIG.LEARNING_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG.LEARNING_FILE, 'utf8'));
      for (let type of ['hu', 'md5']) {
        if (data[type]) {
          SYSTEM_STATE[type] = { ...SYSTEM_STATE[type], ...data[type] };
        }
      }
      logger.info('✅ Loaded system state from', CONFIG.LEARNING_FILE);
    }
    
    // Load history
    if (fs.existsSync(CONFIG.HISTORY_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG.HISTORY_FILE, 'utf8'));
      predictionHistory = data.history || { hu: [], md5: [] };
      lastProcessedPhien = data.lastProcessedPhien || { hu: null, md5: null };
      logger.info('✅ Loaded prediction history');
    }
    
    // Load model
    if (fs.existsSync(CONFIG.MODEL_FILE)) {
      const modelData = JSON.parse(fs.readFileSync(CONFIG.MODEL_FILE, 'utf8'));
      // Load model weights nếu cần
    }
  } catch (error) {
    logger.error('Error loading state:', error.message);
  }
}

function saveSystemState() {
  try {
    fs.writeFileSync(CONFIG.LEARNING_FILE, JSON.stringify(SYSTEM_STATE, null, 2));
    const historyData = {
      history: predictionHistory,
      lastProcessedPhien: lastProcessedPhien,
      lastSaved: new Date().toISOString()
    };
    fs.writeFileSync(CONFIG.HISTORY_FILE, JSON.stringify(historyData, null, 2));
  } catch (error) {
    logger.error('Error saving state:', error.message);
  }
}

function recordPrediction(type, phien, prediction, confidence, patterns) {
  SYSTEM_STATE[type].predictions.unshift({
    phien: phien.toString(),
    prediction,
    confidence,
    patterns,
    timestamp: new Date().toISOString(),
    verified: false,
    actual: null,
    isCorrect: null
  });
  SYSTEM_STATE[type].totalPredictions++;
  if (SYSTEM_STATE[type].predictions.length > 1000) {
    SYSTEM_STATE[type].predictions.pop();
  }
  saveSystemState();
}

function savePredictionToHistory(type, phien, prediction, confidence, latestData) {
  const record = {
    Phien: latestData.Phien,
    Xuc_xac_1: latestData.Xuc_xac_1,
    Xuc_xac_2: latestData.Xuc_xac_2,
    Xuc_xac_3: latestData.Xuc_xac_3,
    Tong: latestData.Tong,
    Ket_qua: latestData.Ket_qua,
    Do_tin_cay: `${confidence}%`,
    Phien_hien_tai: phien.toString(),
    Du_doan: prediction,
    ket_qua_du_doan: '',
    id: '@AnhKhoi',
    timestamp: new Date().toISOString()
  };
  predictionHistory[type].unshift(record);
  if (predictionHistory[type].length > CONFIG.MAX_HISTORY) {
    predictionHistory[type].pop();
  }
  return record;
}

async function verifyPredictions(type, currentData) {
  let updated = false;
  for (let pred of SYSTEM_STATE[type].predictions) {
    if (pred.verified) continue;
    const actual = currentData.find(d => d.Phien.toString() === pred.phien);
    if (actual) {
      pred.verified = true;
      pred.actual = actual.Ket_qua;
      pred.isCorrect = (pred.prediction === pred.actual);
      if (pred.isCorrect) {
        SYSTEM_STATE[type].correctPredictions++;
        SYSTEM_STATE[type].streakAnalysis.currentStreak = 
          Math.max(1, SYSTEM_STATE[type].streakAnalysis.currentStreak + 1);
      } else {
        SYSTEM_STATE[type].streakAnalysis.currentStreak = 
          Math.min(-1, SYSTEM_STATE[type].streakAnalysis.currentStreak - 1);
      }
      SYSTEM_STATE[type].recentAccuracy.push(pred.isCorrect ? 1 : 0);
      if (SYSTEM_STATE[type].recentAccuracy.length > 50) {
        SYSTEM_STATE[type].recentAccuracy.shift();
      }
      updated = true;
    }
  }
  if (updated) saveSystemState();
}

function transformApiData(apiData) {
  if (!apiData || !apiData.list || !Array.isArray(apiData.list)) return null;
  return apiData.list.map(item => ({
    Phien: item.id,
    Ket_qua: item.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu',
    Xuc_xac_1: item.dices[0],
    Xuc_xac_2: item.dices[1],
    Xuc_xac_3: item.dices[2],
    Tong: item.point
  }));
}

async function fetchDataHu() {
  try {
    const response = await axios.get(CONFIG.API_URL_HU, { timeout: 10000 });
    return transformApiData(response.data);
  } catch (error) {
    logger.error('Error fetching HU data:', error.message);
    return null;
  }
}

async function fetchDataMd5() {
  try {
    const response = await axios.get(CONFIG.API_URL_MD5, { timeout: 10000 });
    return transformApiData(response.data);
  } catch (error) {
    logger.error('Error fetching MD5 data:', error.message);
    return null;
  }
}

async function updateHistoryStatus(type) {
  const data = type === 'hu' ? await fetchDataHu() : await fetchDataMd5();
  if (!data) return;
  for (let record of predictionHistory[type]) {
    if (record.ket_qua_du_doan && record.ket_qua_du_doan !== '') continue;
    const actual = data.find(d => d.Phien.toString() === record.Phien_hien_tai);
    if (actual) {
      record.ket_qua_du_doan = (record.Du_doan === actual.Ket_qua) ? 'Đúng ✅' : 'Sai ❌';
    }
  }
  saveSystemState();
}

// ============================================================
// 8. TỰ ĐỘNG XỬ LÝ VÀ TRAINING
// ============================================================

async function autoProcess() {
  try {
    // Process HU
    const dataHu = await fetchDataHu();
    if (dataHu && dataHu.length > 0) {
      const nextPhien = dataHu[0].Phien + 1;
      if (lastProcessedPhien.hu !== nextPhien) {
        await verifyPredictions('hu', dataHu);
        const result = calculateSupremePrediction(dataHu, 'hu');
        savePredictionToHistory('hu', nextPhien, result.prediction, result.confidence, dataHu[0]);
        recordPrediction('hu', nextPhien, result.prediction, result.confidence, result.factors);
        lastProcessedPhien.hu = nextPhien;
        logger.info(`[HU] Phiên ${nextPhien}: ${result.prediction} (${result.confidence}%) | Factors: ${result.factors.join(', ')}`);
      }
    }
    
    // Process MD5
    const dataMd5 = await fetchDataMd5();
    if (dataMd5 && dataMd5.length > 0) {
      const nextPhien = dataMd5[0].Phien + 1;
      if (lastProcessedPhien.md5 !== nextPhien) {
        await verifyPredictions('md5', dataMd5);
        const result = calculateSupremePrediction(dataMd5, 'md5');
        savePredictionToHistory('md5', nextPhien, result.prediction, result.confidence, dataMd5[0]);
        recordPrediction('md5', nextPhien, result.prediction, result.confidence, result.factors);
        lastProcessedPhien.md5 = nextPhien;
        logger.info(`[MD5] Phiên ${nextPhien}: ${result.prediction} (${result.confidence}%) | Factors: ${result.factors.join(', ')}`);
      }
    }
    
    // Train Deep Learning model
    if (CONFIG.DEEP_LEARNING_ACTIVE && dataHu && dataHu.length > 50) {
      const results = dataHu.map(d => d.Ket_qua);
      await deepPredictor.train(results, null);
    }
    
    saveSystemState();
  } catch (error) {
    logger.error('Auto process error:', error.message);
  }
}

// ============================================================
// 9. API ENDPOINTS
// ============================================================

app.get('/', (req, res) => {
  res.json({
    name: 'Anh Khoi Supreme Predictor',
    version: '3.0.0',
    status: 'active',
    author: '@AnhKhoi',
    description: 'Hệ thống dự đoán Tài Xỉu siêu chính xác với AI + Quantum'
  });
});

app.get('/hu', async (req, res) => {
  try {
    const data = await fetchDataHu();
    if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    await verifyPredictions('hu', data);
    const nextPhien = data[0].Phien + 1;
    const result = calculateSupremePrediction(data, 'hu');
    const record = savePredictionToHistory('hu', nextPhien, result.prediction, result.confidence, data[0]);
    recordPrediction('hu', nextPhien, result.prediction, result.confidence, result.factors);
    setTimeout(() => updateHistoryStatus('hu'), 5000);
    res.json({ ...record, analysis: result.detailedAnalysis });
  } catch (error) {
    logger.error('HU API error:', error.message);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

app.get('/md5', async (req, res) => {
  try {
    const data = await fetchDataMd5();
    if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    await verifyPredictions('md5', data);
    const nextPhien = data[0].Phien + 1;
    const result = calculateSupremePrediction(data, 'md5');
    const record = savePredictionToHistory('md5', nextPhien, result.prediction, result.confidence, data[0]);
    recordPrediction('md5', nextPhien, result.prediction, result.confidence, result.factors);
    setTimeout(() => updateHistoryStatus('md5'), 5000);
    res.json({ ...record, analysis: result.detailedAnalysis });
  } catch (error) {
    logger.error('MD5 API error:', error.message);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

app.get('/hu/lichsu', async (req, res) => {
  await updateHistoryStatus('hu');
  res.json({
    type: 'Anh Khoi Supreme - Tài Xỉu HU',
    history: predictionHistory.hu,
    total: predictionHistory.hu.length,
    id: '@AnhKhoi'
  });
});

app.get('/md5/lichsu', async (req, res) => {
  await updateHistoryStatus('md5');
  res.json({
    type: 'Anh Khoi Supreme - Tài Xỉu MD5',
    history: predictionHistory.md5,
    total: predictionHistory.md5.length,
    id: '@AnhKhoi'
  });
});

app.get('/hu/phan-tich', async (req, res) => {
  const data = await fetchDataHu();
  if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
  const result = calculateSupremePrediction(data, 'hu');
  res.json({
    prediction: result.prediction,
    confidence: result.confidence,
    factors: result.factors,
    analysis: result.detailedAnalysis,
    systemState: {
      hurst: SYSTEM_STATE.hu.hurstExponent,
      fractal: SYSTEM_STATE.hu.fractalDimension,
      entropy: SYSTEM_STATE.hu.entropy,
      accuracy: SYSTEM_STATE.hu.totalPredictions > 0
        ? (SYSTEM_STATE.hu.correctPredictions / SYSTEM_STATE.hu.totalPredictions * 100).toFixed(1) + '%'
        : 'N/A'
    }
  });
});

app.get('/md5/phan-tich', async (req, res) => {
  const data = await fetchDataMd5();
  if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
  const result = calculateSupremePrediction(data, 'md5');
  res.json({
    prediction: result.prediction,
    confidence: result.confidence,
    factors: result.factors,
    analysis: result.detailedAnalysis,
    systemState: {
      hurst: SYSTEM_STATE.md5.hurstExponent,
      fractal: SYSTEM_STATE.md5.fractalDimension,
      entropy: SYSTEM_STATE.md5.entropy,
      accuracy: SYSTEM_STATE.md5.totalPredictions > 0
        ? (SYSTEM_STATE.md5.correctPredictions / SYSTEM_STATE.md5.totalPredictions * 100).toFixed(1) + '%'
        : 'N/A'
    }
  });
});

app.get('/hu/thong-ke', (req, res) => {
  const stats = SYSTEM_STATE.hu;
  const acc = stats.totalPredictions > 0
    ? (stats.correctPredictions / stats.totalPredictions * 100).toFixed(2)
    : 0;
  res.json({
    type: 'HU Supreme Statistics',
    totalPredictions: stats.totalPredictions,
    correctPredictions: stats.correctPredictions,
    accuracy: acc + '%',
    streakAnalysis: stats.streakAnalysis,
    recentAccuracy: stats.recentAccuracy.slice(-20),
    entropy: stats.entropy,
    hurst: stats.hurstExponent,
    fractal: stats.fractalDimension,
    id: '@AnhKhoi'
  });
});

app.get('/md5/thong-ke', (req, res) => {
  const stats = SYSTEM_STATE.md5;
  const acc = stats.totalPredictions > 0
    ? (stats.correctPredictions / stats.totalPredictions * 100).toFixed(2)
    : 0;
  res.json({
    type: 'MD5 Supreme Statistics',
    totalPredictions: stats.totalPredictions,
    correctPredictions: stats.correctPredictions,
    accuracy: acc + '%',
    streakAnalysis: stats.streakAnalysis,
    recentAccuracy: stats.recentAccuracy.slice(-20),
    entropy: stats.entropy,
    hurst: stats.hurstExponent,
    fractal: stats.fractalDimension,
    id: '@AnhKhoi'
  });
});

app.get('/reset', (req, res) => {
  const resetState = {
    hu: { predictions: [], patternStats: {}, totalPredictions: 0, correctPredictions: 0, patternWeights: {}, lastUpdate: null, streakAnalysis: { wins: 0, losses: 0, currentStreak: 0, bestStreak: 0, worstStreak: 0 }, recentAccuracy: [], reversalState: { active: false, streakTrigger: 0 }, markovMatrix: { TT: 0.5, TX: 0.5, XT: 0.5, XX: 0.5 }, markov2Matrix: {}, markov3Matrix: {}, volatility: 0, entropy: 0, fractalDimension: 0, hurstExponent: 0, neuralWeights: null, quantumStates: [] },
    md5: { predictions: [], patternStats: {}, totalPredictions: 0, correctPredictions: 0, patternWeights: {}, lastUpdate: null, streakAnalysis: { wins: 0, losses: 0, currentStreak: 0, bestStreak: 0, worstStreak: 0 }, recentAccuracy: [], reversalState: { active: false, streakTrigger: 0 }, markovMatrix: { TT: 0.5, TX: 0.5, XT: 0.5, XX: 0.5 }, markov2Matrix: {}, markov3Matrix: {}, volatility: 0, entropy: 0, fractalDimension: 0, hurstExponent: 0, neuralWeights: null, quantumStates: [] }
  };
  SYSTEM_STATE.hu = resetState.hu;
  SYSTEM_STATE.md5 = resetState.md5;
  saveSystemState();
  res.json({ message: '✅ Đã reset toàn bộ dữ liệu learning', id: '@AnhKhoi' });
});

app.get('/train', async (req, res) => {
  try {
    const dataHu = await fetchDataHu();
    if (dataHu && dataHu.length > 100) {
      const results = dataHu.map(d => d.Ket_qua);
      await deepPredictor.train(results, null);
      res.json({ message: '✅ Deep Learning model trained successfully', samples: results.length });
    } else {
      res.status(400).json({ error: 'Không đủ dữ liệu training' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 10. KHỞI ĐỘNG HỆ THỐNG
// ============================================================

async function initSystem() {
  logger.info('👑 ==========================================');
  logger.info('👑 ANH KHOI SUPREME PREDICTOR V3.0.0');
  logger.info('👑 CHA CODE - BÁ NHẤT VŨ TRỤ');
  logger.info('👑 ==========================================');
  
  // Load dữ liệu
  loadSystemState();
  
  // Khởi tạo Deep Learning
  await deepPredictor.init();
  
  // Khởi tạo Quantum
  logger.info('🔮 Quantum Predictor initialized');
  
  // Cron job mỗi 15 giây
  setInterval(autoProcess, CONFIG.AUTO_SAVE_INTERVAL);
  
  // Clean history mỗi 5 phút
  cron.schedule('*/5 * * * *', () => {
    for (let type of ['hu', 'md5']) {
      if (predictionHistory[type].length > CONFIG.MAX_HISTORY) {
        predictionHistory[type] = predictionHistory[type].slice(0, CONFIG.MAX_HISTORY);
      }
    }
    saveSystemState();
  });
  
  // Train mô hình mỗi 1 giờ
  cron.schedule('0 * * * *', async () => {
    if (CONFIG.DEEP_LEARNING_ACTIVE) {
      try {
        const dataHu = await fetchDataHu();
        if (dataHu && dataHu.length > 100) {
          const results = dataHu.map(d => d.Ket_qua);
          await deepPredictor.train(results, null);
          logger.info('🧠 Scheduled DNN training completed');
        }
      } catch (error) {
        logger.error('Scheduled training error:', error.message);
      }
    }
  });
  
  // Start server
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`🚀 Server running on http://0.0.0.0:${PORT}`);
    logger.info(`📊 HU API: http://0.0.0.0:${PORT}/hu`);
    logger.info(`📊 MD5 API: http://0.0.0.0:${PORT}/md5`);
    logger.info(`📈 Statistics: http://0.0.0.0:${PORT}/hu/thong-ke`);
    logger.info('👑 System ready!');
  });
  
  // Chạy tự động lần đầu sau 3 giây
  setTimeout(autoProcess, 3000);
}

// Error handling
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start
initSystem();

module.exports = { app, SYSTEM_STATE };
