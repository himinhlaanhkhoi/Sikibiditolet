const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5000;

const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';
const LEARNING_FILE = 'anhkhoi_system.json';
const HISTORY_FILE = 'anhkhoi_history.json';

let predictionHistory = { hu: [], md5: [] };
let statistics = { 
  hu: { total: 0, wins: 0, losses: 0, accuracy: 0, currentWinStreak: 0, maxWinStreak: 0, currentLoseStreak: 0, maxLoseStreak: 0 },
  md5: { total: 0, wins: 0, losses: 0, accuracy: 0, currentWinStreak: 0, maxWinStreak: 0, currentLoseStreak: 0, maxLoseStreak: 0 }
};
const MAX_HISTORY = 5000;
const AUTO_SAVE_INTERVAL = 1000;
let processedPhienSet = { hu: new Set(), md5: new Set() };

// ==================== HỆ THỐNG KẾT HỢP THÔNG MINH ====================
class UltimateHybridPredictor {
  constructor() {
    this.history = { results: [], predictions: [], actuals: [] };
    this.memory = { patterns: new Map(), transitions: new Map(), accuracy: new Map() };
    this.stats = { total: 0, correct: 0, streak: 0 };
    this.noiseFilter = { threshold: 0.3, currentNoise: 0, isNoisy: false };
  }
  
  predict(data, type) {
    if (!data || data.length < 3) return this.response('Tài', 55, ['Đang phân tích'], []);
    const results = data.map(d => d.Ket_qua);
    const sums = data.map(d => d.Tong);
    
    const cauResult = this.analyzeMainCau(results);
    const supportResults = this.runSupportAlgorithms(results, sums);
    this.calculateNoiseLevel(results);
    const finalResult = this.combineResults(cauResult, supportResults, results);
    this.savePredictionLog(results, finalResult);
    return finalResult;
  }
  
  analyzeMainCau(results) {
    const cauPredictions = [];
    const bet = this.detectBetCau(results);
    if (bet) cauPredictions.push({ ...bet, type: 'bet', priority: 100 });
    const dao = this.detectDaoCau(results);
    if (dao) cauPredictions.push({ ...dao, type: 'dao', priority: 90 });
    const pair22 = this.detectPair22(results);
    if (pair22) cauPredictions.push({ ...pair22, type: 'pair22', priority: 85 });
    const oneTwoOne = this.detectOneTwoOne(results);
    if (oneTwoOne) cauPredictions.push({ ...oneTwoOne, type: '121', priority: 80 });
    const triple33 = this.detectTriple33(results);
    if (triple33) cauPredictions.push({ ...triple33, type: '33', priority: 75 });
    if (cauPredictions.length === 0) return null;
    cauPredictions.sort((a, b) => b.priority - a.priority);
    const best = cauPredictions[0];
    return { prediction: best.prediction, confidence: best.confidence, cauType: best.type, details: best.details };
  }
  
  runSupportAlgorithms(results, sums) {
    const supports = [];
    const probResult = this.probabilityAlgorithm(results);
    if (probResult) supports.push(probResult);
    const markovResult = this.markovAlgorithm(results);
    if (markovResult) supports.push(markovResult);
    const volResult = this.volatilityAlgorithm(results);
    if (volResult) supports.push(volResult);
    const sumResult = this.sumAlgorithm(results, sums);
    if (sumResult) supports.push(sumResult);
    const statResult = this.statisticsAlgorithm(results);
    if (statResult) supports.push(statResult);
    const biasResult = this.biasAlgorithm(results);
    if (biasResult) supports.push(biasResult);
    const reversalResult = this.reversalAlgorithm(results);
    if (reversalResult) supports.push(reversalResult);
    const historyResult = this.historyAlgorithm(results);
    if (historyResult) supports.push(historyResult);
    return supports;
  }
  
  probabilityAlgorithm(results) {
    if (results.length < 10) return null;
    const last10 = results.slice(0, 10);
    const taiCount = last10.filter(r => r === 'Tài').length;
    const probability = taiCount / 10;
    if (probability >= 0.7) return { prediction: 'Xỉu', confidence: 65 + (probability - 0.5) * 30, name: 'Xác suất', weight: 0.7 };
    if (probability <= 0.3) return { prediction: 'Tài', confidence: 65 + (0.5 - probability) * 30, name: 'Xác suất', weight: 0.7 };
    return null;
  }
  
  markovAlgorithm(results) {
    if (results.length < 4) return null;
    const last2 = results.slice(0, 2);
    const key = last2.join('');
    if (!this.memory.transitions.has(key)) this.memory.transitions.set(key, { Tai: 0, Xiu: 0 });
    const trans = this.memory.transitions.get(key);
    const total = trans.Tai + trans.Xiu;
    if (total >= 5) {
      const taiProb = trans.Tai / total;
      const prediction = taiProb > 0.5 ? 'Tài' : 'Xỉu';
      const confidence = 55 + Math.abs(taiProb - 0.5) * 50;
      return { prediction: prediction, confidence: Math.min(82, confidence), name: 'Markov', weight: 0.8 };
    }
    return null;
  }
  
  volatilityAlgorithm(results) {
    if (results.length < 8) return null;
    let changes = 0;
    for (let i = 1; i < 8; i++) if (results[i] !== results[i-1]) changes++;
    const volatility = changes / 7;
    if (volatility > 0.7) return { prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 65, name: 'Biến động', weight: 0.6 };
    if (volatility < 0.3) return { prediction: results[0], confidence: 68, name: 'Biến động', weight: 0.7 };
    return null;
  }
  
  sumAlgorithm(results, sums) {
    if (!sums || sums.length < 10) return null;
    const last5Sums = sums.slice(0, 5);
    const avgSum = last5Sums.reduce((a, b) => a + b, 0) / 5;
    if (avgSum > 12) return { prediction: 'Xỉu', confidence: 62, name: 'Tổng điểm', weight: 0.6 };
    if (avgSum < 9) return { prediction: 'Tài', confidence: 62, name: 'Tổng điểm', weight: 0.6 };
    return null;
  }
  
  statisticsAlgorithm(results) {
    if (results.length < 15) return null;
    const numerical = results.map(r => r === 'Tài' ? 1 : 0);
    const mean = numerical.reduce((a, b) => a + b, 0) / numerical.length;
    const variance = numerical.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / numerical.length;
    const stdDev = Math.sqrt(variance);
    const zScore = Math.abs(mean - 0.5) / (stdDev + 0.001);
    if (zScore > 1.5) {
      const prediction = mean > 0.5 ? 'Xỉu' : 'Tài';
      return { prediction: prediction, confidence: 60 + Math.min(20, zScore * 5), name: 'Thống kê', weight: 0.7 };
    }
    return null;
  }
  
  biasAlgorithm(results) {
    if (results.length < 10) return null;
    const last20 = results.slice(0, 20);
    const taiCount = last20.filter(r => r === 'Tài').length;
    const xiuCount = 20 - taiCount;
    const bias = Math.abs(taiCount - xiuCount);
    if (bias >= 6) {
      const prediction = taiCount > xiuCount ? 'Xỉu' : 'Tài';
      return { prediction: prediction, confidence: 60 + Math.min(20, bias), name: 'Độ lệch', weight: 0.75 };
    }
    return null;
  }
  
  reversalAlgorithm(results) {
    if (results.length < 4) return null;
    const a = results[0], b = results[1], c = results[2], d = results[3];
    if (a !== b && b === c && c !== d && a === d) {
      return { prediction: results[0], confidence: 70, name: 'Đảo chiều', weight: 0.85 };
    }
    return null;
  }
  
  historyAlgorithm(results) {
    if (this.history.results.length < 20) return null;
    const currentPattern = results.slice(0, 5).join('');
    let bestMatch = null, bestScore = 0;
    for (let i = 0; i <= this.history.results.length - 6; i++) {
      const historicPattern = this.history.results[i].slice(0, 5).join('');
      let matchScore = 0;
      for (let j = 0; j < 5; j++) if (currentPattern[j] === historicPattern[j]) matchScore++;
      if (matchScore >= 4 && matchScore > bestScore) {
        bestScore = matchScore;
        const nextResult = this.history.results[i]?.[5];
        if (nextResult) bestMatch = nextResult;
      }
    }
    if (bestMatch && bestScore >= 4) {
      return { prediction: bestMatch, confidence: 60 + bestScore * 5, name: 'Lịch sử', weight: 0.7 };
    }
    return null;
  }
  
  detectBetCau(results) {
    if (results.length < 3) return null;
    let streak = 1;
    const streakType = results[0];
    for (let i = 1; i < results.length; i++) { if (results[i] === streakType) streak++; else break; }
    if (streak === 3 || streak === 4) return { prediction: streakType, confidence: 68, details: { streakLength: streak, action: 'continue' } };
    if (streak === 5) return { prediction: streakType === 'Tài' ? 'Xỉu' : 'Tài', confidence: 70, details: { streakLength: 5, action: 'break' } };
    if (streak === 6) return { prediction: streakType === 'Tài' ? 'Xỉu' : 'Tài', confidence: 74, details: { streakLength: 6, action: 'break' } };
    if (streak >= 7) return { prediction: streakType === 'Tài' ? 'Xỉu' : 'Tài', confidence: 80 + Math.min(10, streak - 7), details: { streakLength: streak, action: 'break' } };
    return null;
  }
  
  detectDaoCau(results) {
    if (results.length < 4) return null;
    let altLength = 1;
    for (let i = 1; i < Math.min(8, results.length); i++) { if (results[i] !== results[i-1]) altLength++; else break; }
    if (altLength >= 4) {
      let confidence = altLength >= 6 ? 76 : (altLength >= 5 ? 72 : 68);
      return { prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: confidence, details: { altLength: altLength } };
    }
    return null;
  }
  
  detectPair22(results) {
    if (results.length < 6) return null;
    const isPair1 = results[0] === results[1];
    const isPair2 = results[2] === results[3];
    const isPair3 = results[4] === results[5];
    if (isPair1 && isPair2 && results[0] !== results[2]) {
      let nextPred = isPair3 ? (results[4] === 'Tài' ? 'Xỉu' : 'Tài') : (results[2] === 'Tài' ? 'Xỉu' : 'Tài');
      return { prediction: nextPred, confidence: 68, details: { pairsCount: isPair3 ? 3 : 2 } };
    }
    return null;
  }
  
  detectOneTwoOne(results) {
    if (results.length < 4) return null;
    if (results[0] !== results[1] && results[1] === results[2] && results[2] !== results[3] && results[0] === results[3]) {
      return { prediction: results[0], confidence: 72, details: { pattern: '121' } };
    }
    return null;
  }
  
  detectTriple33(results) {
    if (results.length < 6) return null;
    const triple1 = results[0] === results[1] && results[1] === results[2];
    const triple2 = results[3] === results[4] && results[4] === results[5];
    if (triple1 && triple2 && results[0] !== results[3]) {
      return { prediction: results[3] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 70, details: { pattern: '33' } };
    }
    return null;
  }
  
  calculateNoiseLevel(results) {
    if (results.length < 10) return;
    let changes = 0;
    for (let i = 1; i < 10; i++) if (results[i] !== results[i-1]) changes++;
    this.noiseFilter.currentNoise = changes / 9;
    this.noiseFilter.isNoisy = this.noiseFilter.currentNoise > this.noiseFilter.threshold;
  }
  
  combineResults(cauResult, supportResults, results) {
    if (!cauResult) {
      if (supportResults.length === 0) {
        const fallback = this.smartFallback(results);
        return this.response(fallback.prediction, fallback.confidence, ['Dự phòng'], results);
      }
      const combined = this.weightedVote(supportResults);
      return this.response(combined.prediction, combined.confidence, supportResults.map(s => s.name), results);
    }
    
    let finalConfidence = cauResult.confidence;
    let finalPrediction = cauResult.prediction;
    let agreeCount = 0;
    for (const support of supportResults) if (support.prediction === cauResult.prediction) agreeCount++;
    
    if (agreeCount >= 3) finalConfidence = Math.min(92, finalConfidence + 8);
    else if (agreeCount <= 1 && supportResults.length >= 3) finalConfidence = Math.max(58, finalConfidence - 8);
    
    if (this.noiseFilter.isNoisy && supportResults.length >= 2) {
      const supportVote = this.weightedVote(supportResults);
      if (supportVote.confidence > finalConfidence + 5) {
        finalPrediction = supportVote.prediction;
        finalConfidence = supportVote.confidence;
      }
    }
    
    const methods = [`Cầu ${cauResult.cauType || 'chính'}`];
    for (const s of supportResults.slice(0, 3)) methods.push(s.name);
    return this.response(finalPrediction, Math.round(finalConfidence), methods, results);
  }
  
  weightedVote(predictions) {
    let taiScore = 0, xiuScore = 0, totalWeight = 0;
    for (const p of predictions) {
      const weight = (p.weight || 0.7) * (p.confidence / 100);
      if (p.prediction === 'Tài') taiScore += weight;
      else xiuScore += weight;
      totalWeight += weight;
    }
    if (totalWeight === 0) return { prediction: 'Tài', confidence: 55 };
    const taiProb = taiScore / totalWeight;
    const prediction = taiProb > 0.5 ? 'Tài' : 'Xỉu';
    return { prediction, confidence: Math.min(88, 50 + Math.abs(taiProb - 0.5) * 80) };
  }
  
  smartFallback(results) {
    const lastResult = results[0];
    let streak = 1;
    for (let i = 1; i < results.length; i++) { if (results[i] === lastResult) streak++; else break; }
    if (streak >= 4) return { prediction: lastResult === 'Tài' ? 'Xỉu' : 'Tài', confidence: 60 };
    let altLength = 1;
    for (let i = 1; i < results.length; i++) { if (results[i] !== results[i-1]) altLength++; else break; }
    if (altLength >= 4) return { prediction: lastResult === 'Tài' ? 'Xỉu' : 'Tài', confidence: 62 };
    return { prediction: lastResult, confidence: 58 };
  }
  
  savePredictionLog(results, result) {
    this.history.results.unshift([...results]);
    if (this.history.results.length > 100) this.history.results.pop();
    this.history.predictions.unshift({ prediction: result.prediction, confidence: result.confidence, timestamp: Date.now() });
    if (this.history.predictions.length > 100) this.history.predictions.pop();
  }
  
  updateResult(prediction, actual, wasCorrect) {
    this.stats.total++;
    if (wasCorrect) { this.stats.correct++; this.stats.streak++; }
    else { this.stats.streak = 0; }
    this.history.actuals.unshift(wasCorrect);
    if (this.history.actuals.length > 100) this.history.actuals.pop();
    if (this.history.results.length >= 2 && this.history.results[0] && this.history.results[0].length >= 2) {
      const key = this.history.results[0].slice(0, 2).join('');
      if (!this.memory.transitions.has(key)) this.memory.transitions.set(key, { Tai: 0, Xiu: 0 });
      const trans = this.memory.transitions.get(key);
      if (actual === 'Tài') trans.Tai++; else trans.Xiu++;
    }
  }
  
  getStats() {
    const accuracy = this.stats.total > 0 ? (this.stats.correct / this.stats.total * 100).toFixed(1) : 0;
    const recentAcc = this.history.actuals.slice(0, 10).filter(a => a).length * 10;
    return { total: this.stats.total, correct: this.stats.correct, accuracy: accuracy + '%', recentAccuracy: recentAcc + '%', streak: this.stats.streak, noiseLevel: (this.noiseFilter.currentNoise * 100).toFixed(0) + '%' };
  }
  
  response(prediction, confidence, methods, results) {
    return { prediction, confidence, factors: methods, allPatterns: methods.slice(0, 5), stats: this.getStats(), analysis: { noiseLevel: (this.noiseFilter.currentNoise * 100).toFixed(0) + '%', isNoisy: this.noiseFilter.isNoisy } };
  }
}

const predictor = new UltimateHybridPredictor();

// ==================== HÀM LOAD/SAVE ====================
function loadLearningData() {
  try {
    if (fs.existsSync(LEARNING_FILE)) {
      const data = fs.readFileSync(LEARNING_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed.statistics) statistics = parsed.statistics;
      console.log('✅ Loaded learning data');
    }
  } catch (error) { console.error('Error loading:', error.message); }
}

function saveLearningData() {
  try {
    fs.writeFileSync(LEARNING_FILE, JSON.stringify({ statistics, lastSaved: new Date().toISOString() }, null, 2));
  } catch (error) { console.error('Error saving:', error.message); }
}

function loadPredictionHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      const parsed = JSON.parse(data);
      predictionHistory = parsed.history || { hu: [], md5: [] };
      if (parsed.processedPhien) {
        if (parsed.processedPhien.hu) processedPhienSet.hu = new Set(parsed.processedPhien.hu);
        if (parsed.processedPhien.md5) processedPhienSet.md5 = new Set(parsed.processedPhien.md5);
      }
      if (parsed.statistics) statistics = parsed.statistics;
      updateStatisticsFromHistory();
      console.log('✅ Loaded history');
    }
  } catch (error) { console.error('Error loading history:', error.message); }
}

function updateStatisticsFromHistory() {
  for (const type of ['hu', 'md5']) {
    let wins = 0, losses = 0, currentWinStreak = 0, maxWinStreak = 0, currentLoseStreak = 0, maxLoseStreak = 0;
    for (const record of predictionHistory[type]) {
      if (record.ket_qua_du_doan === 'Đúng ✅') {
        wins++; currentWinStreak++; currentLoseStreak = 0;
        maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
      } else if (record.ket_qua_du_doan === 'Sai ❌') {
        losses++; currentLoseStreak++; currentWinStreak = 0;
        maxLoseStreak = Math.max(maxLoseStreak, currentLoseStreak);
      }
    }
    statistics[type] = {
      total: wins + losses, wins, losses,
      accuracy: wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(2) : 0,
      currentWinStreak, maxWinStreak, currentLoseStreak, maxLoseStreak
    };
  }
}

function savePredictionHistory() {
  try {
    const processedPhienObj = { hu: Array.from(processedPhienSet.hu), md5: Array.from(processedPhienSet.md5) };
    fs.writeFileSync(HISTORY_FILE, JSON.stringify({ history: predictionHistory, processedPhien: processedPhienObj, statistics, lastSaved: new Date().toISOString() }, null, 2));
  } catch (error) { console.error('Error saving history:', error.message); }
}

// === HÀM LẤY DỮ LIỆU API ===
function transformApiData(apiData) {
  if (!apiData || !apiData.list || !Array.isArray(apiData.list)) return null;
  return apiData.list.map(item => ({
    Phien: item.id,
    Ket_qua: item.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu',
    Xuc_xac_1: item.dices[0], Xuc_xac_2: item.dices[1], Xuc_xac_3: item.dices[2],
    Tong: item.point
  }));
}

async function fetchDataHu() {
  try { const res = await axios.get(API_URL_HU, { timeout: 10000 }); return transformApiData(res.data); }
  catch (error) { console.error('HU error:', error.message); return null; }
}

async function fetchDataMd5() {
  try { const res = await axios.get(API_URL_MD5, { timeout: 10000 }); return transformApiData(res.data); }
  catch (error) { console.error('MD5 error:', error.message); return null; }
}

function savePredictionToHistory(type, phienHienTai, prediction, confidence, latestData) {
  const record = {
    Phien: latestData.Phien,
    Xuc_xac_1: latestData.Xuc_xac_1, Xuc_xac_2: latestData.Xuc_xac_2, Xuc_xac_3: latestData.Xuc_xac_3,
    Tong: latestData.Tong, Ket_qua: latestData.Ket_qua, Do_tin_cay: `${confidence}%`,
    Phien_hien_tai: phienHienTai.toString(), Du_doan: prediction,
    ket_qua_du_doan: '', id: '@anhkhoi', timestamp: new Date().toISOString()
  };
  predictionHistory[type].unshift(record);
  if (predictionHistory[type].length > MAX_HISTORY) predictionHistory[type].pop();
  return record;
}

async function updateHistoryStatus(type) {
  try {
    const data = (type === 'hu') ? await fetchDataHu() : await fetchDataMd5();
    if (!data) return;
    let updated = false;
    for (const record of predictionHistory[type]) {
      if (record.ket_qua_du_doan && record.ket_qua_du_doan !== '') continue;
      const actual = data.find(d => d.Phien.toString() === record.Phien_hien_tai);
      if (actual) {
        const wasCorrect = record.Du_doan === actual.Ket_qua;
        record.ket_qua_du_doan = wasCorrect ? 'Đúng ✅' : 'Sai ❌';
        predictor.updateResult(record.Du_doan, actual.Ket_qua, wasCorrect);
        updated = true;
      }
    }
    if (updated) { updateStatisticsFromHistory(); savePredictionHistory(); saveLearningData(); }
  } catch (error) { console.error('Update error:', error); }
}

async function autoProcessPredictions() {
  try {
    const dataHu = await fetchDataHu();
    if (dataHu && dataHu.length > 0) {
      const phienHienTai = dataHu[0].Phien;
      if (!processedPhienSet.hu.has(phienHienTai)) {
        processedPhienSet.hu.add(phienHienTai);
        const result = predictor.predict(dataHu, 'hu');
        savePredictionToHistory('hu', phienHienTai, result.prediction, result.confidence, dataHu[0]);
        console.log(`[${new Date().toLocaleTimeString()}] HU ${phienHienTai} -> Dự đoán: ${result.prediction} (${result.confidence}%)`);
      }
    }
    
    const dataMd5 = await fetchDataMd5();
    if (dataMd5 && dataMd5.length > 0) {
      const phienHienTai = dataMd5[0].Phien;
      if (!processedPhienSet.md5.has(phienHienTai)) {
        processedPhienSet.md5.add(phienHienTai);
        const result = predictor.predict(dataMd5, 'md5');
        savePredictionToHistory('md5', phienHienTai, result.prediction, result.confidence, dataMd5[0]);
        console.log(`[${new Date().toLocaleTimeString()}] MD5 ${phienHienTai} -> Dự đoán: ${result.prediction} (${result.confidence}%)`);
      }
    }
    savePredictionHistory();
  } catch (error) { console.error('[Auto] Error:', error.message); }
}

function startAutoTask() { console.log('🚀 Auto prediction - 1 giây'); setInterval(autoProcessPredictions, AUTO_SAVE_INTERVAL); }

// ==================== ENDPOINTS ====================
app.get('/', (req, res) => res.json({ message: '@anhkhoi - Tài Xỉu Prediction API', status: 'running', endpoints: ['/hu', '/md5', '/thongke/html'] }));

app.get('/hu', async (req, res) => {
  try {
    const data = await fetchDataHu();
    if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    const phienHienTai = data[0].Phien;
    const result = predictor.predict(data, 'hu');
    const record = savePredictionToHistory('hu', phienHienTai, result.prediction, result.confidence, data[0]);
    setTimeout(() => updateHistoryStatus('hu'), 5000);
    res.json({ success: true, phien_truoc_do: phienHienTai - 1, phien_hien_tai: phienHienTai, du_doan: result.prediction, do_tin_cay: `${result.confidence}%`, cac_cau: result.allPatterns, yeu_to: result.factors, stats: result.stats });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/md5', async (req, res) => {
  try {
    const data = await fetchDataMd5();
    if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    const phienHienTai = data[0].Phien;
    const result = predictor.predict(data, 'md5');
    const record = savePredictionToHistory('md5', phienHienTai, result.prediction, result.confidence, data[0]);
    setTimeout(() => updateHistoryStatus('md5'), 5000);
    res.json({ success: true, phien_truoc_do: phienHienTai - 1, phien_hien_tai: phienHienTai, du_doan: result.prediction, do_tin_cay: `${result.confidence}%`, cac_cau: result.allPatterns, yeu_to: result.factors, stats: result.stats });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/thongke', async (req, res) => {
  await updateHistoryStatus('hu'); await updateHistoryStatus('md5');
  res.json({ success: true, statistics, lastUpdated: new Date().toISOString() });
});

// Giao diện HTML siêu đẹp - Công nghệ 2026
app.get('/thongke/html', async (req, res) => {
  await updateHistoryStatus('hu'); await updateHistoryStatus('md5');
  
  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>LẨU CUA 79 | HỆ THỐNG DỰ ĐOÁN TÀI XỈU THẾ HỆ MỚI</title>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Space Grotesk', sans-serif;
            background: #0a0c15;
            min-height: 100vh;
            color: #ffffff;
        }
        /* Animated Gradient Background */
        .bg-gradient {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(ellipse at 20% 30%, rgba(255,107,107,0.15) 0%, transparent 50%),
                        radial-gradient(ellipse at 80% 70%, rgba(78,205,196,0.1) 0%, transparent 50%),
                        linear-gradient(135deg, #0a0c15 0%, #121624 50%, #0a0c15 100%);
            z-index: 0;
        }
        /* Particle Canvas */
        #particles {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 1;
            pointer-events: none;
        }
        .container { position: relative; z-index: 2; max-width: 1440px; margin: 0 auto; padding: 20px; }
        
        /* Glass Header */
        .header {
            text-align: center; padding: 40px 20px; margin-bottom: 40px;
            background: rgba(10, 12, 21, 0.6); backdrop-filter: blur(20px);
            border-radius: 60px; border: 1px solid rgba(255,255,255,0.08);
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
        }
        .logo { display: inline-flex; align-items: center; gap: 16px; margin-bottom: 20px; }
        .logo-icon {
            width: 60px; height: 60px;
            background: linear-gradient(135deg, #ff6b6b, #ff8e53);
            border-radius: 30px; display: flex; align-items: center; justify-content: center;
            font-size: 28px; box-shadow: 0 0 30px rgba(255,107,107,0.4);
            animation: pulse 2s infinite;
        }
        @keyframes pulse { 0%, 100% { box-shadow: 0 0 30px rgba(255,107,107,0.4); } 50% { box-shadow: 0 0 60px rgba(255,107,107,0.6); } }
        .logo h1 { font-size: 42px; font-weight: 700; background: linear-gradient(135deg, #fff, #ffb347, #ff6b6b); -webkit-background-clip: text; background-clip: text; color: transparent; letter-spacing: -1px; }
        .badge {
            display: inline-flex; align-items: center; gap: 8px; padding: 8px 24px;
            background: linear-gradient(135deg, rgba(255,107,107,0.2), rgba(255,142,83,0.1));
            border-radius: 60px; font-size: 13px; font-weight: 500;
            border: 1px solid rgba(255,107,107,0.3); backdrop-filter: blur(10px);
        }
        .live-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(76, 217, 100, 0.15); padding: 8px 20px; border-radius: 60px; font-size: 12px; color: #4cd964; margin-top: 20px; }
        .live-dot { width: 10px; height: 10px; background: #4cd964; border-radius: 50%; animation: livePulse 1.5s infinite; }
        @keyframes livePulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.2); } }
        
        /* Stats Grid */
        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 28px; margin-bottom: 40px; }
        .stat-card {
            background: rgba(18, 22, 36, 0.7); backdrop-filter: blur(20px);
            border-radius: 40px; padding: 28px; border: 1px solid rgba(255,255,255,0.05);
            transition: all 0.4s cubic-bezier(0.2, 0.9, 0.4, 1.1);
            position: relative; overflow: hidden;
        }
        .stat-card::before {
            content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: linear-gradient(135deg, rgba(255,107,107,0.05), transparent);
            opacity: 0; transition: opacity 0.4s;
        }
        .stat-card:hover { transform: translateY(-8px) scale(1.02); border-color: rgba(255,107,107,0.3); box-shadow: 0 30px 50px -20px rgba(0,0,0,0.5); }
        .stat-card:hover::before { opacity: 1; }
        .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; }
        .card-title { display: flex; align-items: center; gap: 16px; }
        .card-icon {
            width: 56px; height: 56px;
            background: linear-gradient(135deg, #ff6b6b, #ff8e53);
            border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 24px;
        }
        .card-title h2 { font-size: 22px; font-weight: 600; }
        .card-title p { font-size: 13px; color: #8a95b0; margin-top: 6px; }
        .stat-value { font-size: 56px; font-weight: 800; background: linear-gradient(135deg, #fff, #ffb347); -webkit-background-clip: text; background-clip: text; color: transparent; line-height: 1; }
        .stat-label { font-size: 14px; color: #8a95b0; margin-top: 12px; letter-spacing: 0.5px; }
        .stat-detail { display: flex; justify-content: space-between; margin-top: 28px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.06); gap: 16px; flex-wrap: wrap; }
        .stat-detail-item { text-align: center; flex: 1; min-width: 70px; }
        .stat-detail-value { font-size: 28px; font-weight: 700; }
        .stat-detail-label { font-size: 11px; color: #6a7590; margin-top: 6px; text-transform: uppercase; letter-spacing: 1px; }
        .win { color: #4cd964; text-shadow: 0 0 10px rgba(76,217,100,0.3); }
        .loss { color: #ff3b30; text-shadow: 0 0 10px rgba(255,59,48,0.3); }
        .streak { color: #ffcc00; text-shadow: 0 0 10px rgba(255,204,0,0.3); }
        
        /* Charts */
        .charts-section { display: grid; grid-template-columns: repeat(2, 1fr); gap: 28px; margin-bottom: 40px; }
        .chart-card {
            background: rgba(18, 22, 36, 0.7); backdrop-filter: blur(20px);
            border-radius: 40px; padding: 28px; border: 1px solid rgba(255,255,255,0.05);
            transition: transform 0.3s;
        }
        .chart-card:hover { transform: translateY(-5px); border-color: rgba(255,107,107,0.2); }
        .chart-card h3 { font-size: 18px; font-weight: 600; margin-bottom: 24px; display: flex; align-items: center; gap: 12px; }
        canvas { max-height: 280px; }
        
        /* History Table */
        .history-section {
            background: rgba(18, 22, 36, 0.7); backdrop-filter: blur(20px);
            border-radius: 40px; padding: 28px; border: 1px solid rgba(255,255,255,0.05);
            margin-bottom: 40px;
        }
        .history-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; flex-wrap: wrap; gap: 16px; }
        .history-header h3 { font-size: 20px; font-weight: 600; display: flex; align-items: center; gap: 12px; }
        .tabs { display: flex; gap: 12px; background: rgba(0,0,0,0.4); padding: 6px; border-radius: 50px; }
        .tab-btn { padding: 10px 28px; border: none; background: transparent; color: #8a95b0; font-family: 'Space Grotesk', sans-serif; font-weight: 500; cursor: pointer; border-radius: 40px; transition: all 0.2s; font-size: 14px; }
        .tab-btn.active { background: linear-gradient(135deg, #ff6b6b, #ff8e53); color: white; box-shadow: 0 4px 15px rgba(255,107,107,0.3); }
        .refresh-btn {
            background: rgba(255,107,107,0.15); border: 1px solid rgba(255,107,107,0.3);
            padding: 10px 24px; border-radius: 40px; color: #ff8e53; cursor: pointer;
            font-family: 'Space Grotesk', sans-serif; font-weight: 500; transition: all 0.2s;
        }
        .refresh-btn:hover { background: rgba(255,107,107,0.25); transform: scale(1.05); }
        .history-table-container { overflow-x: auto; max-height: 550px; overflow-y: auto; border-radius: 24px; }
        .history-table { width: 100%; border-collapse: collapse; }
        .history-table th {
            text-align: left; padding: 18px 16px; background: rgba(0,0,0,0.4);
            font-weight: 600; font-size: 13px; color: #8a95b0; letter-spacing: 0.5px;
            position: sticky; top: 0; backdrop-filter: blur(10px);
        }
        .history-table td { padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 14px; }
        .history-table tr:hover { background: rgba(255,255,255,0.03); }
        .result-tai { color: #4cd964; font-weight: 600; }
        .result-xiu { color: #ff3b30; font-weight: 600; }
        .pred-correct { color: #4cd964; } .pred-wrong { color: #ff3b30; }
        .confidence-badge { display: inline-block; padding: 5px 12px; background: linear-gradient(135deg, rgba(255,107,107,0.2), rgba(255,142,83,0.1)); border-radius: 30px; font-size: 12px; font-weight: 500; }
        .footer { text-align: center; padding: 40px; color: #5a6580; font-size: 13px; border-top: 1px solid rgba(255,255,255,0.05); }
        .copyright { font-size: 11px; color: #3a4560; margin-top: 12px; letter-spacing: 0.5px; }
        
        @media (max-width: 768px) {
            .stats-grid { grid-template-columns: 1fr; gap: 20px; }
            .charts-section { grid-template-columns: 1fr; gap: 20px; }
            .stat-value { font-size: 40px; }
            .logo h1 { font-size: 28px; }
            .container { padding: 16px; }
            .header { padding: 24px; margin-bottom: 24px; }
        }
        
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 10px; }
        ::-webkit-scrollbar-thumb { background: linear-gradient(135deg, #ff6b6b, #ff8e53); border-radius: 10px; }
    </style>
</head>
<body>
    <div class="bg-gradient"></div>
    <canvas id="particles"></canvas>
    <div class="container">
        <div class="header">
            <div class="logo"><div class="logo-icon"><i class="fas fa-dice-d6"></i></div><h1>LẨU CUA 79</h1></div>
            <div class="badge"><i class="fas fa-microchip"></i> HỆ THỐNG DỰ ĐOÁN THẾ HỆ MỚI 2026 | CẤP ĐỘ QUỐC GIA</div>
            <div class="live-badge"><span class="live-dot"></span> LIVE | Cập nhật tự động 3 giây | Bảo mật cấp cao</div>
        </div>
        
        <div class="stats-grid" id="statsGrid"></div>
        
        <div class="charts-section">
            <div class="chart-card"><h3><i class="fas fa-chart-pie" style="color: #ff8e53;"></i> TỈ LỆ THẮNG - HŨ</h3><canvas id="chartHu"></canvas></div>
            <div class="chart-card"><h3><i class="fas fa-chart-pie" style="color: #ff8e53;"></i> TỈ LỆ THẮNG - MD5</h3><canvas id="chartMd5"></canvas></div>
        </div>
        
        <div class="history-section">
            <div class="history-header">
                <h3><i class="fas fa-chart-line"></i> LỊCH SỬ DỰ ĐOÁN</h3>
                <div class="tabs"><button class="tab-btn active" onclick="switchTab('hu')">HŨ</button><button class="tab-btn" onclick="switchTab('md5')">MD5</button></div>
                <button class="refresh-btn" onclick="refreshData()"><i class="fas fa-sync-alt"></i> Làm mới</button>
            </div>
            <div class="history-table-container"><table class="history-table"><thead><tr><th>Phiên</th><th>Kết quả</th><th>Dự đoán</th><th>Độ tin cậy</th><th>Xúc xắc</th><th>Kết quả</th></tr></thead><tbody id="historyBody"></tbody></table></div>
        </div>
        
        <div class="footer">
            <p>© 2026 @anhkhoi | Bảo vệ bản quyền cấp quốc gia | Hệ thống không thể sao chép</p>
            <p class="copyright">⚠️ Dự đoán mang tính tham khảo | Kết hợp phân tích cầu + AI + Thuật toán thông minh</p>
        </div>
    </div>
    
    <script>
        let currentTab = 'hu', charts = {};
        
        // Particle effect
        const canvas = document.getElementById('particles');
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        let particles = [];
        for(let i = 0; i < 80; i++) { particles.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, radius: Math.random() * 2 + 1, alpha: Math.random() * 0.5, speed: Math.random() * 0.5 + 0.2 }); }
        function animateParticles() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for(let p of particles) {
                ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = \`rgba(255, 107, 107, \${p.alpha})\`; ctx.fill();
                p.y -= p.speed; if(p.y < 0) p.y = canvas.height;
            }
            requestAnimationFrame(animateParticles);
        }
        window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });
        animateParticles();
        
        async function fetchStats() {
            try { const res = await fetch('/thongke'); const data = await res.json(); if(data.success) updateStatsUI(data.statistics); }
            catch(e) { console.error(e); }
        }
        async function fetchHistory() {
            try { const res = await fetch(\`/\${currentTab}/lichsu\`); const data = await res.json(); updateHistoryTable(data.history); }
            catch(e) { console.error(e); }
        }
        function updateStatsUI(stats) {
            document.getElementById('statsGrid').innerHTML = \`
                <div class="stat-card"><div class="card-header"><div class="card-title"><div class="card-icon"><i class="fas fa-crown"></i></div><div><h2>HŨ</h2><p>Tài Xỉu Hũ Nổ</p></div></div></div>
                <div class="stat-value">\${stats.hu.accuracy}%</div><div class="stat-label">TỶ LỆ CHÍNH XÁC</div>
                <div class="stat-detail"><div class="stat-detail-item"><div class="stat-detail-value win">\${stats.hu.wins}</div><div class="stat-detail-label">THẮNG</div></div>
                <div class="stat-detail-item"><div class="stat-detail-value loss">\${stats.hu.losses}</div><div class="stat-detail-label">THUA</div></div>
                <div class="stat-detail-item"><div class="stat-detail-value">\${stats.hu.total}</div><div class="stat-detail-label">TỔNG</div></div></div>
                <div class="stat-detail"><div class="stat-detail-item"><div class="stat-detail-value streak">\${stats.hu.currentWinStreak}</div><div class="stat-detail-label">🎯 THẮNG HIỆN TẠI</div></div>
                <div class="stat-detail-item"><div class="stat-detail-value streak">\${stats.hu.maxWinStreak}</div><div class="stat-detail-label">🏆 THẮNG MAX</div></div>
                <div class="stat-detail-item"><div class="stat-detail-value loss">\${stats.hu.currentLoseStreak}</div><div class="stat-detail-label">⚠️ THUA HIỆN TẠI</div></div>
                <div class="stat-detail-item"><div class="stat-detail-value loss">\${stats.hu.maxLoseStreak}</div><div class="stat-detail-label">📉 THUA MAX</div></div></div></div>
                <div class="stat-card"><div class="card-header"><div class="card-title"><div class="card-icon"><i class="fas fa-shield-alt"></i></div><div><h2>MD5</h2><p>Tài Xỉu MD5</p></div></div></div>
                <div class="stat-value">\${stats.md5.accuracy}%</div><div class="stat-label">TỶ LỆ CHÍNH XÁC</div>
                <div class="stat-detail"><div class="stat-detail-item"><div class="stat-detail-value win">\${stats.md5.wins}</div><div class="stat-detail-label">THẮNG</div></div>
                <div class="stat-detail-item"><div class="stat-detail-value loss">\${stats.md5.losses}</div><div class="stat-detail-label">THUA</div></div>
                <div class="stat-detail-item"><div class="stat-detail-value">\${stats.md5.total}</div><div class="stat-detail-label">TỔNG</div></div></div>
                <div class="stat-detail"><div class="stat-detail-item"><div class="stat-detail-value streak">\${stats.md5.currentWinStreak}</div><div class="stat-detail-label">🎯 THẮNG HIỆN TẠI</div></div>
                <div class="stat-detail-item"><div class="stat-detail-value streak">\${stats.md5.maxWinStreak}</div><div class="stat-detail-label">🏆 THẮNG MAX</div></div>
                <div class="stat-detail-item"><div class="stat-detail-value loss">\${stats.md5.currentLoseStreak}</div><div class="stat-detail-label">⚠️ THUA HIỆN TẠI</div></div>
                <div class="stat-detail-item"><div class="stat-detail-value loss">\${stats.md5.maxLoseStreak}</div><div class="stat-detail-label">📉 THUA MAX</div></div></div></div>
            \`;
            if(charts.hu) charts.hu.destroy(); if(charts.md5) charts.md5.destroy();
            charts.hu = new Chart(document.getElementById('chartHu'), { type: 'doughnut', data: { labels: ['Thắng', 'Thua'], datasets: [{ data: [stats.hu.wins, stats.hu.losses], backgroundColor: ['#4cd964', '#ff3b30'], borderWidth: 0 }] }, options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#e8edf5' } } } } });
            charts.md5 = new Chart(document.getElementById('chartMd5'), { type: 'doughnut', data: { labels: ['Thắng', 'Thua'], datasets: [{ data: [stats.md5.wins, stats.md5.losses], backgroundColor: ['#4cd964', '#ff3b30'], borderWidth: 0 }] }, options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#e8edf5' } } } } });
        }
        function updateHistoryTable(history) {
            const tbody = document.getElementById('historyBody');
            if(!history || history.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Chưa có dữ liệu</td></tr>'; return; }
            tbody.innerHTML = history.slice(0, 100).map(r => \`
                <tr><td><strong>\${r.Phien}</strong></td>
                <td class="result-\${r.Ket_qua === 'Tài' ? 'tai' : 'xiu'}"><i class="fas fa-arrow-\${r.Ket_qua === 'Tài' ? 'up' : 'down'}"></i> \${r.Ket_qua}</td>
                <td class="result-\${r.Du_doan === 'Tài' ? 'tai' : 'xiu'}"><i class="fas fa-arrow-\${r.Du_doan === 'Tài' ? 'up' : 'down'}"></i> \${r.Du_doan}</td>
                <td><span class="confidence-badge">\${r.Do_tin_cay}</span></td>
                <td>\${r.Xuc_xac_1}-\${r.Xuc_xac_2}-\${r.Xuc_xac_3}</td>
                <td class="\${r.ket_qua_du_doan === 'Đúng ✅' ? 'pred-correct' : 'pred-wrong'}">\${r.ket_qua_du_doan || '⏳ Đang chờ...'}</td></tr>
            \`).join('');
        }
        function switchTab(tab) { currentTab = tab; document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active')); event.target.classList.add('active'); fetchHistory(); }
        async function refreshData() { await fetchStats(); await fetchHistory(); }
        setInterval(() => { fetchStats(); fetchHistory(); }, 3000);
        fetchStats(); fetchHistory();
    </script>
</body>
</html>`;
  res.send(html);
});

app.get('/hu/lichsu', async (req, res) => {
  await updateHistoryStatus('hu');
  res.json({ history: predictionHistory.hu, total: predictionHistory.hu.length, stats: statistics.hu });
});

app.get('/md5/lichsu', async (req, res) => {
  await updateHistoryStatus('md5');
  res.json({ history: predictionHistory.md5, total: predictionHistory.md5.length, stats: statistics.md5 });
});

app.get('/resetdata', (req, res) => {
  predictionHistory = { hu: [], md5: [] };
  processedPhienSet = { hu: new Set(), md5: new Set() };
  statistics = { hu: { total: 0, wins: 0, losses: 0, accuracy: 0, currentWinStreak: 0, maxWinStreak: 0, currentLoseStreak: 0, maxLoseStreak: 0 }, md5: { total: 0, wins: 0, losses: 0, accuracy: 0, currentWinStreak: 0, maxWinStreak: 0, currentLoseStreak: 0, maxLoseStreak: 0 } };
  savePredictionHistory(); saveLearningData();
  res.json({ message: 'Đã reset toàn bộ dữ liệu', id: '@anhkhoi' });
});

// KHỞI ĐỘNG
loadLearningData();
loadPredictionHistory();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     🚀 LẨU CUA 79 - HỆ THỐNG DỰ ĐOÁN THẾ HỆ MỚI      ║`);
  console.log(`╠════════════════════════════════════════════════════════════╣`);
  console.log(`║  📍 API: http://0.0.0.0:${PORT}                              ║`);
  console.log(`║  📊 THỐNG KÊ: http://0.0.0.0:${PORT}/thongke/html           ║`);
  console.log(`║  ⚡ Auto update mỗi 1 giây | Chống trùng phiên tuyệt đối    ║`);
  console.log(`║  🎯 Thuật toán: Cầu Bệt, Đảo, 2-2, 1-2-1, 3-3 + AI Support ║`);
  console.log(`║  🔒 Bảo mật cấp quốc gia | Giao diện công nghệ 2026         ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);
  startAutoTask();
});
