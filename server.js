const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5000;

const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';
const LEARNING_FILE = 'anhkhoi.json';
const HISTORY_FILE = 'anhkhoi1.json';

let predictionHistory = { hu: [], md5: [] };
let statistics = { hu: { total: 0, wins: 0, losses: 0, accuracy: 0, streak: 0, maxStreak: 0 }, md5: { total: 0, wins: 0, losses: 0, accuracy: 0, streak: 0, maxStreak: 0 } };
const MAX_HISTORY = 5000;
const AUTO_SAVE_INTERVAL = 1000;
let lastProcessedPhien = { hu: null, md5: null };

// ==================== HỆ THỐNG DỰ ĐOÁN TOÀN DIỆN NHẤT ====================

// 1. THỐNG KÊ CƠ BẢN VÀ NÂNG CAO
class StatisticalAnalyzer {
  constructor() {
    this.mean = 0;
    this.variance = 0;
    this.stdDev = 0;
    this.autocorrelation = [];
    this.partialAutocorrelation = [];
  }

  calculateStatistics(results) {
    const numerical = results.map(r => r === 'Tài' ? 1 : 0);
    const n = numerical.length;
    
    this.mean = numerical.reduce((a,b) => a+b, 0) / n;
    this.variance = numerical.reduce((a,b) => a + Math.pow(b - this.mean, 2), 0) / n;
    this.stdDev = Math.sqrt(this.variance);
    
    return { mean: this.mean, variance: this.variance, stdDev: this.stdDev };
  }

  calculateAutocorrelation(results, lag = 5) {
    const numerical = results.map(r => r === 'Tài' ? 1 : 0);
    const n = numerical.length;
    const mean = numerical.reduce((a,b) => a+b, 0) / n;
    
    this.autocorrelation = [];
    for (let l = 1; l <= lag; l++) {
      let numerator = 0, denominator = 0;
      for (let i = 0; i < n - l; i++) {
        numerator += (numerical[i] - mean) * (numerical[i + l] - mean);
      }
      for (let i = 0; i < n; i++) {
        denominator += Math.pow(numerical[i] - mean, 2);
      }
      this.autocorrelation.push(numerator / denominator);
    }
    return this.autocorrelation;
  }

  detectSeasonality(results) {
    const pacf = this.calculatePartialAutocorrelation(results, 10);
    let seasonLength = 0;
    let maxValue = -Infinity;
    
    for (let i = 2; i <= 7; i++) {
      if (Math.abs(pacf[i-1]) > maxValue && Math.abs(pacf[i-1]) > 0.3) {
        maxValue = Math.abs(pacf[i-1]);
        seasonLength = i;
      }
    }
    
    return seasonLength > 0 ? { period: seasonLength, strength: maxValue } : null;
  }

  calculatePartialAutocorrelation(results, maxLag = 5) {
    const acf = this.calculateAutocorrelation(results, maxLag);
    const pacf = [];
    
    for (let k = 1; k <= maxLag; k++) {
      if (k === 1) {
        pacf.push(acf[0]);
      } else {
        let numerator = acf[k-1];
        let denominator = 1;
        for (let j = 1; j < k; j++) {
          numerator -= pacf[j-1] * acf[k-1-j];
          denominator -= pacf[j-1] * acf[j-1];
        }
        pacf.push(numerator / denominator);
      }
    }
    return pacf;
  }
}

// 2. ARIMA Model
class ARIMAModel {
  constructor(p = 1, d = 1, q = 1) {
    this.p = p;
    this.d = d;
    this.q = q;
    this.arParams = Array(p).fill(0.1);
    this.maParams = Array(q).fill(0.1);
    this.residuals = [];
  }

  difference(series, order = 1) {
    let diffed = [...series];
    for (let d = 0; d < order; d++) {
      const temp = [];
      for (let i = 1; i < diffed.length; i++) {
        temp.push(diffed[i] - diffed[i-1]);
      }
      diffed = temp;
    }
    return diffed;
  }

  inverseDifference(original, predicted, order = 1) {
    let result = [...predicted];
    for (let d = 0; d < order; d++) {
      const temp = [];
      const base = original[original.length - result.length - 1];
      temp.push(base + result[0]);
      for (let i = 1; i < result.length; i++) {
        temp.push(temp[i-1] + result[i]);
      }
      result = temp;
    }
    return result;
  }

  predict(series) {
    if (!series || series.length < 5) return null;
    const numerical = series.map(s => s === 'Tài' ? 1 : 0);
    const diffed = this.difference(numerical, this.d);
    
    if (diffed.length < Math.max(this.p, this.q)) return null;
    
    const lastValue = diffed[diffed.length - 1] || 0.5;
    const prediction = lastValue > 0.5 ? 'Tài' : 'Xỉu';
    const confidence = 55 + Math.abs(lastValue - 0.5) * 30;
    
    return { prediction, confidence: Math.min(85, confidence), name: 'ARIMA' };
  }
}

// 3. GARCH Model
class GARCHModel {
  constructor(p = 1, q = 1) {
    this.p = p;
    this.q = q;
    this.omega = 0.1;
    this.alphas = Array(p).fill(0.1);
    this.betas = Array(q).fill(0.8);
    this.conditionalVariances = [];
  }

  predict(results) {
    if (!results || results.length < 10) return null;
    
    const returns = [];
    for (let i = 1; i < results.length; i++) {
      returns.push(results[i-1] === results[i] ? 0 : (results[i] === 'Tài' ? 1 : -1));
    }
    
    const avgVol = Math.abs(returns.reduce((a,b) => a+b, 0)) / returns.length;
    const lastResult = results[0];
    
    if (avgVol > 0.5) {
      return { prediction: lastResult === 'Tài' ? 'Xỉu' : 'Tài', confidence: 65, name: 'GARCH' };
    }
    return null;
  }
}

// 4. Monte Carlo Simulation
class MonteCarloSimulator {
  constructor(nSimulations = 1000, horizon = 3) {
    this.nSimulations = nSimulations;
    this.horizon = horizon;
  }

  predict(results) {
    if (!results || results.length < 10) return null;
    
    let tt = 0, tx = 0, xt = 0, xx = 0;
    for (let i = 1; i < results.length; i++) {
      if (results[i-1] === 'Tài' && results[i] === 'Tài') tt++;
      else if (results[i-1] === 'Tài' && results[i] === 'Xỉu') tx++;
      else if (results[i-1] === 'Xỉu' && results[i] === 'Tài') xt++;
      else xx++;
    }
    
    const probTT = tt / (tt + tx + 1);
    const probXT = xt / (xt + xx + 1);
    
    const startState = results[0];
    let taiCount = 0;
    
    for (let sim = 0; sim < this.nSimulations; sim++) {
      let state = startState;
      for (let step = 0; step < this.horizon; step++) {
        const prob = state === 'Tài' ? probTT : probXT;
        state = Math.random() < prob ? 'Tài' : 'Xỉu';
      }
      if (state === 'Tài') taiCount++;
    }
    
    const taiProb = taiCount / this.nSimulations;
    const prediction = taiProb > 0.5 ? 'Tài' : 'Xỉu';
    const confidence = 50 + Math.abs(taiProb - 0.5) * 70;
    
    return { prediction, confidence: Math.min(88, confidence), name: 'MonteCarlo' };
  }
}

// 5. Hidden Markov Model
class HiddenMarkovModel {
  constructor(nStates = 3) {
    this.nStates = nStates;
    this.transitionMatrix = Array(nStates).fill().map(() => Array(nStates).fill(1/nStates));
    this.emissionMatrix = Array(nStates).fill().map(() => [0.5, 0.5]);
    this.currentState = 0;
    this.observations = [];
  }

  addObservation(obs) {
    this.observations.push(obs === 'Tài' ? 0 : 1);
    if (this.observations.length > 50) this.observations.shift();
    this.updateState();
  }

  updateState() {
    if (this.observations.length < 2) return;
    const lastObs = this.observations[this.observations.length - 1];
    let maxProb = 0;
    for (let i = 0; i < this.nStates; i++) {
      const prob = this.emissionMatrix[i][lastObs] * this.transitionMatrix[this.currentState][i];
      if (prob > maxProb) {
        maxProb = prob;
        this.currentState = i;
      }
    }
  }

  predictNext() {
    let nextState = 0;
    let maxProb = 0;
    for (let i = 0; i < this.nStates; i++) {
      if (this.transitionMatrix[this.currentState][i] > maxProb) {
        maxProb = this.transitionMatrix[this.currentState][i];
        nextState = i;
      }
    }
    const probTai = this.emissionMatrix[nextState][0];
    const prediction = probTai > 0.5 ? 'Tài' : 'Xỉu';
    const confidence = 50 + Math.abs(probTai - 0.5) * 70;
    
    return { prediction, confidence: Math.min(85, confidence), name: 'HMM' };
  }
}

// 6. LSTM Simulator
class LSTMSimulator {
  constructor() {
    this.hiddenState = 0;
    this.cellState = 0;
    this.weights = { input: 0.5, forget: 0.8, output: 0.7 };
  }

  train(results, steps = 3) {
    if (!results || results.length < 2) return;
    const input = results[0] === 'Tài' ? 1 : 0;
    this.forgetGate = this.weights.forget;
    this.inputGate = this.weights.input;
    this.outputGate = this.weights.output;
    
    this.cellState = this.forgetGate * this.cellState + this.inputGate * input;
    this.hiddenState = this.outputGate * Math.tanh(this.cellState);
  }

  predict(results) {
    if (!results || results.length < 2) return null;
    this.train(results);
    const prediction = this.hiddenState > 0 ? 'Tài' : 'Xỉu';
    const confidence = 50 + Math.abs(this.hiddenState) * 40;
    
    return { prediction, confidence: Math.min(85, confidence), name: 'LSTM' };
  }
}

// 7. Pattern Recognition Advanced
class PatternRecognitionAdvanced {
  constructor() {
    this.patterns = [];
    this.successRates = {};
  }

  predict(results) {
    if (!results || results.length < 10) return null;
    
    let taiCount = 0, xiuCount = 0;
    for (let i = 0; i < Math.min(10, results.length); i++) {
      if (results[i] === 'Tài') taiCount++;
      else xiuCount++;
    }
    
    if (taiCount >= 7) {
      return { prediction: 'Xỉu', confidence: 72, name: 'PatternOverTai' };
    } else if (xiuCount >= 7) {
      return { prediction: 'Tài', confidence: 72, name: 'PatternOverXiu' };
    }
    
    let streakLength = 1;
    for (let i = 1; i < results.length; i++) {
      if (results[i] === results[0]) streakLength++;
      else break;
    }
    
    if (streakLength >= 5 && streakLength <= 8) {
      return { prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 75, name: 'PatternBreak' };
    }
    
    return null;
  }
}

// Các hàm phân tích cầu truyền thống
function analyzeCauBet(results) {
  if (!results || results.length < 3) return null;
  let streakType = results[0];
  let streakLength = 1;
  for (let i = 1; i < results.length; i++) {
    if (results[i] === streakType) streakLength++;
    else break;
  }
  if (streakLength >= 3) {
    let shouldBreak = streakLength >= 5;
    let confidence = streakLength >= 7 ? 85 : (streakLength >= 5 ? 75 : 68);
    return {
      prediction: shouldBreak ? (streakType === 'Tài' ? 'Xỉu' : 'Tài') : streakType,
      confidence: confidence,
      name: `Cầu Bệt ${streakLength}p`
    };
  }
  return null;
}

function analyzeCauDao11(results) {
  if (!results || results.length < 4) return null;
  let alternatingLength = 1;
  for (let i = 1; i < Math.min(results.length, 10); i++) {
    if (results[i] !== results[i - 1]) alternatingLength++;
    else break;
  }
  if (alternatingLength >= 4) {
    let confidence = Math.min(80, 65 + alternatingLength * 2);
    return {
      prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài',
      confidence: confidence,
      name: `Cầu Đảo 1-1`
    };
  }
  return null;
}

function analyzeCau22(results) {
  if (!results || results.length < 6) return null;
  let pairCount = 0, i = 0;
  while (i < results.length - 1 && pairCount < 3) {
    if (results[i] === results[i + 1]) {
      pairCount++;
      i += 2;
    } else break;
  }
  if (pairCount >= 2) {
    return { prediction: results[0], confidence: 70, name: `Cầu 2-2` };
  }
  return null;
}

function analyzeCau33(results) {
  if (!results || results.length < 6) return null;
  let tripleCount = 0, i = 0;
  while (i < results.length - 2 && tripleCount < 2) {
    if (results[i] === results[i + 1] && results[i + 1] === results[i + 2]) {
      tripleCount++;
      i += 3;
    } else break;
  }
  if (tripleCount >= 1) {
    return { prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 72, name: `Cầu 3-3` };
  }
  return null;
}

function analyzeCauNhayCoc(results) {
  if (!results || results.length < 6) return null;
  const skipPattern = [];
  for (let i = 0; i < Math.min(results.length, 10); i += 2) skipPattern.push(results[i]);
  if (skipPattern.length >= 3 && skipPattern[0] === skipPattern[1] && skipPattern[1] === skipPattern[2]) {
    return { prediction: skipPattern[0], confidence: 68, name: 'Cầu Nhảy Cóc' };
  }
  return null;
}

function analyzeBreakStreak(results) {
  if (!results || results.length < 5) return null;
  let streakLength = 1;
  for (let i = 1; i < results.length; i++) {
    if (results[i] === results[0]) streakLength++;
    else break;
  }
  if (streakLength >= 5) {
    return { prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 78, name: `Bẻ Chuỗi ${streakLength}` };
  }
  return null;
}

function analyzeXuHuongManh(results) {
  if (!results || results.length < 8) return null;
  const taiCount = results.slice(0, 8).filter(r => r === 'Tài').length;
  if (taiCount >= 6) return { prediction: 'Xỉu', confidence: 75, name: 'XH Mạnh → Xỉu' };
  if (taiCount <= 2) return { prediction: 'Tài', confidence: 75, name: 'XH Mạnh → Tài' };
  return null;
}

// Ultimate Predictor
class UltimatePredictor {
  constructor() {
    this.statisticalAnalyzer = new StatisticalAnalyzer();
    this.arimaModel = new ARIMAModel(2, 1, 2);
    this.garchModel = new GARCHModel(1, 1);
    this.monteCarlo = new MonteCarloSimulator(2000, 3);
    this.hmmModel = new HiddenMarkovModel(3);
    this.lstmModel = new LSTMSimulator();
    this.patternLibrary = new PatternRecognitionAdvanced();
    this.weights = {
      arima: 1.0, garch: 0.8, montecarlo: 0.9,
      hmm: 1.0, lstm: 0.9, pattern: 0.85, traditional: 1.0
    };
  }

  predict(data, type) {
    const results = data.map(d => d.Ket_qua);
    const sums = data.map(d => d.Tong);
    
    if (results.length < 5) {
      return { prediction: 'Tài', confidence: 55, factors: ['Insufficient data'], allPatterns: [], detailedAnalysis: {} };
    }
    
    const predictions = [];
    
    const arimaPred = this.arimaModel.predict(results);
    if (arimaPred) predictions.push({ ...arimaPred, model: 'arima', weight: this.weights.arima });
    
    const garchPred = this.garchModel.predict(results);
    if (garchPred) predictions.push({ ...garchPred, model: 'garch', weight: this.weights.garch });
    
    const montePred = this.monteCarlo.predict(results);
    if (montePred) predictions.push({ ...montePred, model: 'montecarlo', weight: this.weights.montecarlo });
    
    this.hmmModel.addObservation(results[0]);
    const hmmPred = this.hmmModel.predictNext();
    if (hmmPred) predictions.push({ ...hmmPred, model: 'hmm', weight: this.weights.hmm });
    
    const lstmPred = this.lstmModel.predict(results);
    if (lstmPred) predictions.push({ ...lstmPred, model: 'lstm', weight: this.weights.lstm });
    
    const patternPred = this.patternLibrary.predict(results);
    if (patternPred) predictions.push({ ...patternPred, model: 'pattern', weight: this.weights.pattern });
    
    const traditionalPatterns = [
      analyzeCauBet, analyzeCauDao11, analyzeCau22, analyzeCau33,
      analyzeCauNhayCoc, analyzeBreakStreak, analyzeXuHuongManh
    ];
    
    for (let fn of traditionalPatterns) {
      let p = fn(results);
      if (p) {
        predictions.push({ ...p, model: 'traditional', weight: this.weights.traditional });
      }
    }
    
    if (predictions.length === 0) {
      const taiCount = results.slice(0, 5).filter(r => r === 'Tài').length;
      return {
        prediction: taiCount >= 3 ? 'Tài' : 'Xỉu',
        confidence: 55,
        factors: ['Default prediction'],
        allPatterns: [],
        detailedAnalysis: { totalModels: 0 }
      };
    }
    
    let taiScore = 0, xiuScore = 0;
    for (const pred of predictions) {
      const weight = pred.weight || 0.5;
      const confWeight = pred.confidence / 100;
      const finalWeight = weight * confWeight;
      
      if (pred.prediction === 'Tài') taiScore += finalWeight;
      else xiuScore += finalWeight;
    }
    
    const finalPrediction = taiScore >= xiuScore ? 'Tài' : 'Xỉu';
    const totalScore = Math.max(taiScore, xiuScore);
    const totalWeight = taiScore + xiuScore;
    let confidence = (totalScore / totalWeight) * 100;
    confidence = Math.min(94, Math.max(58, Math.round(confidence)));
    
    const topPatterns = predictions.sort((a,b) => b.confidence - a.confidence).slice(0, 3).map(p => p.name);
    const factors = predictions.slice(0, 5).map(p => `${p.name}(${p.confidence}%)`);
    
    const stats = this.statisticalAnalyzer.calculateStatistics(results);
    const seasonality = this.statisticalAnalyzer.detectSeasonality(results);
    
    return {
      prediction: finalPrediction,
      confidence: confidence,
      factors: factors.slice(0, 6),
      allPatterns: topPatterns,
      detailedAnalysis: {
        totalModels: predictions.length,
        topModels: predictions.slice(0, 3).map(p => p.name),
        stats: { mean: stats.mean.toFixed(2), stdDev: stats.stdDev.toFixed(2) },
        seasonality: seasonality ? `period ${seasonality.period}` : 'none'
      }
    };
  }
}

const ultimatePredictor = new UltimatePredictor();

// === HÀM LOAD/SAVE ===
function loadLearningData() {
  try {
    if (fs.existsSync(LEARNING_FILE)) {
      const data = fs.readFileSync(LEARNING_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed.statistics) statistics = parsed.statistics;
      console.log('✅ Loaded learning data from', LEARNING_FILE);
    }
  } catch (error) {
    console.error('Error loading learning data:', error.message);
  }
}

function saveLearningData() {
  try {
    const state = { statistics, lastSaved: new Date().toISOString(), version: '5.0' };
    fs.writeFileSync(LEARNING_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('Error saving learning data:', error.message);
  }
}

function loadPredictionHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      const parsed = JSON.parse(data);
      predictionHistory = parsed.history || { hu: [], md5: [] };
      lastProcessedPhien = parsed.lastProcessedPhien || { hu: null, md5: null };
      if (parsed.statistics) statistics = parsed.statistics;
      updateStatisticsFromHistory();
      console.log('✅ Loaded prediction history from', HISTORY_FILE);
    }
  } catch (error) {
    console.error('Error loading prediction history:', error.message);
  }
}

function updateStatisticsFromHistory() {
  for (const type of ['hu', 'md5']) {
    let wins = 0, losses = 0, currentStreak = 0, maxStreak = 0;
    for (const record of predictionHistory[type]) {
      if (record.ket_qua_du_doan === 'Đúng ✅') {
        wins++;
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else if (record.ket_qua_du_doan === 'Sai ❌') {
        losses++;
        currentStreak = 0;
      }
    }
    statistics[type] = {
      total: wins + losses,
      wins: wins,
      losses: losses,
      accuracy: wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(2) : 0,
      streak: currentStreak,
      maxStreak: maxStreak
    };
  }
}

function savePredictionHistory() {
  try {
    const dataToSave = {
      history: predictionHistory,
      lastProcessedPhien,
      statistics: statistics,
      lastSaved: new Date().toISOString()
    };
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(dataToSave, null, 2));
  } catch (error) {
    console.error('Error saving prediction history:', error.message);
  }
}

// === HÀM LẤY DỮ LIỆU API ===
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
    const response = await axios.get(API_URL_HU, { timeout: 10000 });
    return transformApiData(response.data);
  } catch (error) {
    console.error('Error fetching HU data:', error.message);
    return null;
  }
}

async function fetchDataMd5() {
  try {
    const response = await axios.get(API_URL_MD5, { timeout: 10000 });
    return transformApiData(response.data);
  } catch (error) {
    console.error('Error fetching MD5 data:', error.message);
    return null;
  }
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
    id: '@anhkhoi',
    timestamp: new Date().toISOString()
  };
  predictionHistory[type].unshift(record);
  if (predictionHistory[type].length > MAX_HISTORY) predictionHistory[type].pop();
  return record;
}

async function updateHistoryStatus(type) {
  try {
    let data = (type === 'hu') ? await fetchDataHu() : await fetchDataMd5();
    if (!data) return;
    
    let updated = false;
    for (let record of predictionHistory[type]) {
      if (record.ket_qua_du_doan && record.ket_qua_du_doan !== '') continue;
      const actual = data.find(d => d.Phien.toString() === record.Phien_hien_tai);
      if (actual) {
        const wasCorrect = record.Du_doan === actual.Ket_qua;
        record.ket_qua_du_doan = wasCorrect ? 'Đúng ✅' : 'Sai ❌';
        updated = true;
      }
    }
    
    if (updated) {
      updateStatisticsFromHistory();
      savePredictionHistory();
      saveLearningData();
    }
  } catch (error) {
    console.error('Error updating history status:', error);
  }
}

async function autoProcessPredictions() {
  try {
    const dataHu = await fetchDataHu();
    if (dataHu && dataHu.length > 0) {
      const nextPhien = dataHu[0].Phien + 1;
      if (lastProcessedPhien.hu !== nextPhien) {
        const result = ultimatePredictor.predict(dataHu, 'hu');
        savePredictionToHistory('hu', nextPhien, result.prediction, result.confidence, dataHu[0]);
        lastProcessedPhien.hu = nextPhien;
        console.log(`[${new Date().toLocaleTimeString()}] HU ${nextPhien}: ${result.prediction} (${result.confidence}%)`);
      }
    }
    
    const dataMd5 = await fetchDataMd5();
    if (dataMd5 && dataMd5.length > 0) {
      const nextPhien = dataMd5[0].Phien + 1;
      if (lastProcessedPhien.md5 !== nextPhien) {
        const result = ultimatePredictor.predict(dataMd5, 'md5');
        savePredictionToHistory('md5', nextPhien, result.prediction, result.confidence, dataMd5[0]);
        lastProcessedPhien.md5 = nextPhien;
        console.log(`[${new Date().toLocaleTimeString()}] MD5 ${nextPhien}: ${result.prediction} (${result.confidence}%)`);
      }
    }
    
    savePredictionHistory();
  } catch (error) {
    console.error('[Auto] Error:', error.message);
  }
}

function startAutoSaveTask() {
  console.log('🚀 Auto prediction started - checking every 1 second');
  setInterval(autoProcessPredictions, AUTO_SAVE_INTERVAL);
}

// ==================== ENDPOINTS ====================
app.get('/', (req, res) => {
  res.json({ 
    message: 't.me/anhkhoi - Tài Xỉu Prediction API', 
    status: 'running',
    auto_update: '1 giây',
    endpoints: ['/hu', '/md5', '/hu/lichsu', '/md5/lichsu', '/thongke', '/thongke/html']
  });
});

app.get('/hu', async (req, res) => {
  try {
    const data = await fetchDataHu();
    if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    const nextPhien = data[0].Phien + 1;
    const result = ultimatePredictor.predict(data, 'hu');
    const record = savePredictionToHistory('hu', nextPhien, result.prediction, result.confidence, data[0]);
    setTimeout(() => updateHistoryStatus('hu'), 5000);
    res.json({
      success: true,
      phien_hien_tai: data[0].Phien,
      phien_du_doan: nextPhien,
      du_doan: result.prediction,
      do_tin_cay: `${result.confidence}%`,
      cac_cau: result.allPatterns,
      phan_tich: result.detailedAnalysis,
      yeu_to: result.factors
    });
  } catch (error) {
    console.error('Error in /hu:', error);
    res.status(500).json({ error: 'Lỗi server: ' + error.message });
  }
});

app.get('/md5', async (req, res) => {
  try {
    const data = await fetchDataMd5();
    if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    const nextPhien = data[0].Phien + 1;
    const result = ultimatePredictor.predict(data, 'md5');
    const record = savePredictionToHistory('md5', nextPhien, result.prediction, result.confidence, data[0]);
    setTimeout(() => updateHistoryStatus('md5'), 5000);
    res.json({
      success: true,
      phien_hien_tai: data[0].Phien,
      phien_du_doan: nextPhien,
      du_doan: result.prediction,
      do_tin_cay: `${result.confidence}%`,
      cac_cau: result.allPatterns,
      phan_tich: result.detailedAnalysis,
      yeu_to: result.factors
    });
  } catch (error) {
    console.error('Error in /md5:', error);
    res.status(500).json({ error: 'Lỗi server: ' + error.message });
  }
});

app.get('/hu/lichsu', async (req, res) => {
  try {
    await updateHistoryStatus('hu');
    res.json({ type: 'Tài Xỉu Hũ', history: predictionHistory.hu, total: predictionHistory.hu.length, stats: statistics.hu, id: '@anhkhoi' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/md5/lichsu', async (req, res) => {
  try {
    await updateHistoryStatus('md5');
    res.json({ type: 'Tài Xỉu MD5', history: predictionHistory.md5, total: predictionHistory.md5.length, stats: statistics.md5, id: '@anhkhoi' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/thongke', async (req, res) => {
  try {
    await updateHistoryStatus('hu');
    await updateHistoryStatus('md5');
    res.json({ success: true, statistics: statistics, lastUpdated: new Date().toISOString(), id: '@anhkhoi' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// HTML Thống kê siêu đẹp
app.get('/thongke/html', async (req, res) => {
  try {
    await updateHistoryStatus('hu');
    await updateHistoryStatus('md5');
    
    const totalHu = predictionHistory.hu.length;
    const totalMd5 = predictionHistory.md5.length;
    const recentHu = predictionHistory.hu.slice(0, 20);
    const recentMd5 = predictionHistory.md5.slice(0, 20);
    
    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>Lẩu Cua 79 - Thống Kê Tài Xỉu | @anhkhoi</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700;14..32,800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #0a0f1a 0%, #0d1525 50%, #0a0f1a 100%);
            min-height: 100vh;
            color: #e8edf5;
        }
        
        /* Animated background */
        .bg-animation {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 0;
            overflow: hidden;
        }
        
        .bg-animation::before {
            content: '';
            position: absolute;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle at 20% 40%, rgba(255,107,107,0.08) 0%, transparent 50%),
                        radial-gradient(circle at 80% 60%, rgba(78,205,196,0.08) 0%, transparent 50%);
            animation: rotate 20s linear infinite;
        }
        
        @keyframes rotate {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .container {
            position: relative;
            z-index: 1;
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }
        
        /* Header */
        .header {
            text-align: center;
            padding: 30px 20px;
            margin-bottom: 30px;
            background: rgba(10, 15, 26, 0.6);
            backdrop-filter: blur(20px);
            border-radius: 48px;
            border: 1px solid rgba(255,255,255,0.08);
        }
        
        .logo {
            display: inline-flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
        }
        
        .logo-icon {
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, #ff6b6b, #ff8e53);
            border-radius: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            box-shadow: 0 8px 32px rgba(255,107,107,0.3);
        }
        
        .logo h1 {
            font-size: 32px;
            font-weight: 800;
            background: linear-gradient(135deg, #fff, #ffb347);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }
        
        .badge {
            display: inline-block;
            padding: 6px 16px;
            background: rgba(255,107,107,0.15);
            border-radius: 40px;
            font-size: 13px;
            font-weight: 500;
            color: #ff8e53;
            border: 1px solid rgba(255,107,107,0.3);
            margin-top: 12px;
        }
        
        /* Stats Grid */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 24px;
            margin-bottom: 40px;
        }
        
        .stat-card {
            background: rgba(15, 25, 45, 0.6);
            backdrop-filter: blur(10px);
            border-radius: 32px;
            padding: 24px;
            border: 1px solid rgba(255,255,255,0.06);
            transition: all 0.3s ease;
        }
        
        .stat-card:hover {
            transform: translateY(-4px);
            border-color: rgba(255,107,107,0.3);
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        
        .card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 24px;
        }
        
        .card-title {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .card-icon {
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, #ff6b6b, #ff8e53);
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
        }
        
        .card-title h2 {
            font-size: 20px;
            font-weight: 600;
        }
        
        .card-title p {
            font-size: 12px;
            color: #8a95b0;
            margin-top: 4px;
        }
        
        .stat-value {
            font-size: 48px;
            font-weight: 800;
            background: linear-gradient(135deg, #fff, #ffb347);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }
        
        .stat-label {
            font-size: 14px;
            color: #8a95b0;
            margin-top: 8px;
        }
        
        .stat-detail {
            display: flex;
            justify-content: space-between;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid rgba(255,255,255,0.06);
        }
        
        .stat-detail-item {
            text-align: center;
            flex: 1;
        }
        
        .stat-detail-value {
            font-size: 24px;
            font-weight: 700;
        }
        
        .stat-detail-label {
            font-size: 11px;
            color: #8a95b0;
            margin-top: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .win { color: #4cd964; }
        .loss { color: #ff3b30; }
        
        /* Charts */
        .charts-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin-bottom: 40px;
        }
        
        .chart-card {
            background: rgba(15, 25, 45, 0.6);
            backdrop-filter: blur(10px);
            border-radius: 32px;
            padding: 24px;
            border: 1px solid rgba(255,255,255,0.06);
        }
        
        .chart-card h3 {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        canvas {
            max-height: 300px;
        }
        
        /* History Table */
        .history-section {
            background: rgba(15, 25, 45, 0.6);
            backdrop-filter: blur(10px);
            border-radius: 32px;
            padding: 24px;
            border: 1px solid rgba(255,255,255,0.06);
            margin-bottom: 40px;
        }
        
        .history-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            flex-wrap: wrap;
            gap: 16px;
        }
        
        .history-header h3 {
            font-size: 18px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .tabs {
            display: flex;
            gap: 12px;
            background: rgba(0,0,0,0.3);
            padding: 6px;
            border-radius: 60px;
        }
        
        .tab-btn {
            padding: 8px 24px;
            border: none;
            background: transparent;
            color: #8a95b0;
            font-family: 'Inter', sans-serif;
            font-weight: 500;
            cursor: pointer;
            border-radius: 40px;
            transition: all 0.2s ease;
        }
        
        .tab-btn.active {
            background: linear-gradient(135deg, #ff6b6b, #ff8e53);
            color: white;
        }
        
        .history-table-container {
            overflow-x: auto;
        }
        
        .history-table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .history-table th {
            text-align: left;
            padding: 16px 12px;
            background: rgba(0,0,0,0.2);
            font-weight: 600;
            font-size: 13px;
            color: #8a95b0;
            letter-spacing: 0.5px;
        }
        
        .history-table td {
            padding: 14px 12px;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            font-size: 14px;
        }
        
        .history-table tr:hover {
            background: rgba(255,255,255,0.03);
        }
        
        .result-tai {
            color: #4cd964;
            font-weight: 600;
        }
        
        .result-xiu {
            color: #ff3b30;
            font-weight: 600;
        }
        
        .pred-correct {
            color: #4cd964;
        }
        
        .pred-wrong {
            color: #ff3b30;
        }
        
        .confidence-badge {
            display: inline-block;
            padding: 4px 10px;
            background: rgba(255,107,107,0.15);
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
        }
        
        /* Footer */
        .footer {
            text-align: center;
            padding: 30px;
            color: #5a6580;
            font-size: 13px;
            border-top: 1px solid rgba(255,255,255,0.05);
        }
        
        @media (max-width: 768px) {
            .stats-grid {
                grid-template-columns: 1fr;
            }
            .charts-section {
                grid-template-columns: 1fr;
            }
            .stat-value {
                font-size: 36px;
            }
            .container {
                padding: 12px;
            }
            .header {
                padding: 20px;
            }
            .logo h1 {
                font-size: 24px;
            }
        }
        
        .refresh-btn {
            background: rgba(255,107,107,0.15);
            border: 1px solid rgba(255,107,107,0.3);
            padding: 10px 20px;
            border-radius: 40px;
            color: #ff8e53;
            cursor: pointer;
            font-family: 'Inter', sans-serif;
            font-weight: 500;
            transition: all 0.2s ease;
        }
        
        .refresh-btn:hover {
            background: rgba(255,107,107,0.25);
        }
        
        .live-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(76, 217, 100, 0.15);
            padding: 4px 12px;
            border-radius: 40px;
            font-size: 11px;
            color: #4cd964;
        }
        
        .live-dot {
            width: 8px;
            height: 8px;
            background: #4cd964;
            border-radius: 50%;
            animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.2); }
        }
    </style>
</head>
<body>
    <div class="bg-animation"></div>
    <div class="container">
        <div class="header">
            <div class="logo">
                <div class="logo-icon">
                    <i class="fas fa-dice-d6"></i>
                </div>
                <h1>LẨU CUA 79</h1>
            </div>
            <div class="badge">
                <i class="fas fa-chart-line"></i> HỆ THỐNG DỰ ĐOÁN THẾ HỆ MỚI 2026
            </div>
            <div style="margin-top: 20px;">
                <span class="live-badge"><span class="live-dot"></span> LIVE | Cập nhật tự động 1s</span>
            </div>
        </div>
        
        <div class="stats-grid" id="statsGrid">
            <!-- Stats sẽ được cập nhật bằng JS -->
        </div>
        
        <div class="charts-section">
            <div class="chart-card">
                <h3><i class="fas fa-chart-pie" style="color: #ff8e53;"></i> Tỉ lệ thắng/thua - HŨ</h3>
                <canvas id="chartHu"></canvas>
            </div>
            <div class="chart-card">
                <h3><i class="fas fa-chart-pie" style="color: #ff8e53;"></i> Tỉ lệ thắng/thua - MD5</h3>
                <canvas id="chartMd5"></canvas>
            </div>
        </div>
        
        <div class="history-section">
            <div class="history-header">
                <h3><i class="fas fa-history"></i> LỊCH SỬ DỰ ĐOÁN</h3>
                <div class="tabs">
                    <button class="tab-btn active" onclick="switchTab('hu')">HŨ</button>
                    <button class="tab-btn" onclick="switchTab('md5')">MD5</button>
                </div>
                <button class="refresh-btn" onclick="refreshData()"><i class="fas fa-sync-alt"></i> Làm mới</button>
            </div>
            <div class="history-table-container">
                <table class="history-table" id="historyTable">
                    <thead>
                        <tr><th>Phiên</th><th>Kết quả</th><th>Dự đoán</th><th>Độ tin cậy</th><th>Xúc xắc</th><th>Kết quả dự đoán</th></tr>
                    </thead>
                    <tbody id="historyBody"></tbody>
                </table>
            </div>
        </div>
        
        <div class="footer">
            <p>© 2026 @anhkhoi | Hệ thống dự đoán tích hợp AI | Dữ liệu được cập nhật liên tục</p>
            <p style="margin-top: 8px; font-size: 11px;">⚠️ Dự đoán mang tính tham khảo, không đảm bảo chính xác tuyệt đối</p>
        </div>
    </div>
    
    <script>
        let currentTab = 'hu';
        let charts = {};
        
        async function fetchStats() {
            try {
                const response = await fetch('/thongke');
                const data = await response.json();
                if (data.success) {
                    updateStatsUI(data.statistics);
                    updateCharts(data.statistics);
                }
            } catch (error) {
                console.error('Error fetching stats:', error);
            }
        }
        
        async function fetchHistory() {
            try {
                const response = await fetch(\`/\${currentTab}/lichsu\`);
                const data = await response.json();
                updateHistoryTable(data.history);
            } catch (error) {
                console.error('Error fetching history:', error);
            }
        }
        
        function updateStatsUI(stats) {
            const statsGrid = document.getElementById('statsGrid');
            statsGrid.innerHTML = \`
                <div class="stat-card">
                    <div class="card-header">
                        <div class="card-title">
                            <div class="card-icon"><i class="fas fa-crown"></i></div>
                            <div><h2>HŨ</h2><p>Tài Xỉu Hũ Nổ</p></div>
                        </div>
                    </div>
                    <div class="stat-value">\${stats.hu.accuracy}%</div>
                    <div class="stat-label">Tỷ lệ chính xác</div>
                    <div class="stat-detail">
                        <div class="stat-detail-item"><div class="stat-detail-value win">\${stats.hu.wins}</div><div class="stat-detail-label">THẮNG</div></div>
                        <div class="stat-detail-item"><div class="stat-detail-value loss">\${stats.hu.losses}</div><div class="stat-detail-label">THUA</div></div>
                        <div class="stat-detail-item"><div class="stat-detail-value">\${stats.hu.total}</div><div class="stat-detail-label">TỔNG</div></div>
                    </div>
                    <div class="stat-detail">
                        <div class="stat-detail-item"><div class="stat-detail-value">\${stats.hu.streak}</div><div class="stat-detail-label">CHUỖI HIỆN TẠI</div></div>
                        <div class="stat-detail-item"><div class="stat-detail-value">\${stats.hu.maxStreak}</div><div class="stat-detail-label">CHUỖI CAO NHẤT</div></div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="card-header">
                        <div class="card-title">
                            <div class="card-icon"><i class="fas fa-shield-alt"></i></div>
                            <div><h2>MD5</h2><p>Tài Xỉu MD5</p></div>
                        </div>
                    </div>
                    <div class="stat-value">\${stats.md5.accuracy}%</div>
                    <div class="stat-label">Tỷ lệ chính xác</div>
                    <div class="stat-detail">
                        <div class="stat-detail-item"><div class="stat-detail-value win">\${stats.md5.wins}</div><div class="stat-detail-label">THẮNG</div></div>
                        <div class="stat-detail-item"><div class="stat-detail-value loss">\${stats.md5.losses}</div><div class="stat-detail-label">THUA</div></div>
                        <div class="stat-detail-item"><div class="stat-detail-value">\${stats.md5.total}</div><div class="stat-detail-label">TỔNG</div></div>
                    </div>
                    <div class="stat-detail">
                        <div class="stat-detail-item"><div class="stat-detail-value">\${stats.md5.streak}</div><div class="stat-detail-label">CHUỖI HIỆN TẠI</div></div>
                        <div class="stat-detail-item"><div class="stat-detail-value">\${stats.md5.maxStreak}</div><div class="stat-detail-label">CHUỖI CAO NHẤT</div></div>
                    </div>
                </div>
            \`;
        }
        
        function updateCharts(stats) {
            if (charts.hu) charts.hu.destroy();
            if (charts.md5) charts.md5.destroy();
            
            const ctxHu = document.getElementById('chartHu').getContext('2d');
            const ctxMd5 = document.getElementById('chartMd5').getContext('2d');
            
            charts.hu = new Chart(ctxHu, {
                type: 'doughnut',
                data: {
                    labels: ['Thắng', 'Thua'],
                    datasets: [{
                        data: [stats.hu.wins, stats.hu.losses],
                        backgroundColor: ['#4cd964', '#ff3b30'],
                        borderWidth: 0,
                        borderRadius: 10,
                        spacing: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#e8edf5', font: { size: 12 } } }
                    }
                }
            });
            
            charts.md5 = new Chart(ctxMd5, {
                type: 'doughnut',
                data: {
                    labels: ['Thắng', 'Thua'],
                    datasets: [{
                        data: [stats.md5.wins, stats.md5.losses],
                        backgroundColor: ['#4cd964', '#ff3b30'],
                        borderWidth: 0,
                        borderRadius: 10,
                        spacing: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#e8edf5', font: { size: 12 } } }
                    }
                }
            });
        }
        
        function updateHistoryTable(history) {
            const tbody = document.getElementById('historyBody');
            if (!history || history.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Chưa có dữ liệu</td></tr>';
                return;
            }
            
            tbody.innerHTML = history.slice(0, 100).map(record => \`
                <tr>
                    <td><strong>\${record.Phien}</strong></td>
                    <td class="\${record.Ket_qua === 'Tài' ? 'result-tai' : 'result-xiu'}"><i class="fas fa-\${record.Ket_qua === 'Tài' ? 'arrow-up' : 'arrow-down'}"></i> \${record.Ket_qua}</td>
                    <td class="\${record.Du_doan === 'Tài' ? 'result-tai' : 'result-xiu'}"><i class="fas fa-\${record.Du_doan === 'Tài' ? 'arrow-up' : 'arrow-down'}"></i> \${record.Du_doan}</td>
                    <td><span class="confidence-badge">\${record.Do_tin_cay}</span></td>
                    <td>\${record.Xuc_xac_1} - \${record.Xuc_xac_2} - \${record.Xuc_xac_3}</td>
                    <td class="\${record.ket_qua_du_doan === 'Đúng ✅' ? 'pred-correct' : 'pred-wrong'}">\${record.ket_qua_du_doan || '⏳ Đang chờ...'}</td>
                </tr>
            \`).join('');
        }
        
        function switchTab(tab) {
            currentTab = tab;
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            fetchHistory();
        }
        
        async function refreshData() {
            await fetchStats();
            await fetchHistory();
        }
        
        // Auto refresh mỗi 5 giây
        setInterval(() => {
            fetchStats();
            fetchHistory();
        }, 5000);
        
        // Initial load
        fetchStats();
        fetchHistory();
    </script>
</body>
</html>`;
    
    res.send(html);
  } catch (error) {
    console.error('Error in /thongke/html:', error);
    res.status(500).send('<h1>Lỗi</h1><p>' + error.message + '</p>');
  }
});

app.get('/hu/thamso', async (req, res) => {
  try {
    const data = await fetchDataHu();
    if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    const result = ultimatePredictor.predict(data, 'hu');
    res.json({ success: true, prediction: result.prediction, confidence: result.confidence, factors: result.factors, patterns: result.allPatterns, analysis: result.detailedAnalysis });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/md5/thamso', async (req, res) => {
  try {
    const data = await fetchDataMd5();
    if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    const result = ultimatePredictor.predict(data, 'md5');
    res.json({ success: true, prediction: result.prediction, confidence: result.confidence, factors: result.factors, patterns: result.allPatterns, analysis: result.detailedAnalysis });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/resetdata', (req, res) => {
  predictionHistory = { hu: [], md5: [] };
  statistics = { hu: { total: 0, wins: 0, losses: 0, accuracy: 0, streak: 0, maxStreak: 0 }, md5: { total: 0, wins: 0, losses: 0, accuracy: 0, streak: 0, maxStreak: 0 } };
  lastProcessedPhien = { hu: null, md5: null };
  savePredictionHistory();
  saveLearningData();
  res.json({ message: 'Đã reset toàn bộ dữ liệu', id: '@anhkhoi' });
});

// KHỞI ĐỘNG
loadLearningData();
loadPredictionHistory();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================`);
  console.log(`🚀 Server @anhkhoi running on http://0.0.0.0:${PORT}`);
  console.log(`✅ Ultimate Predictor V5.0 - Toàn diện nhất!`);
  console.log(`⏱️ Auto prediction: Mỗi 1 giây`);
  console.log(`📊 Thống kê: http://0.0.0.0:${PORT}/thongke/html`);
  console.log(`========================================\n`);
  startAutoSaveTask();
});
