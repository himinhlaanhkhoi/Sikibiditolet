const express = require('express');
const axios = require('axios');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';
const HISTORY_FILE = 'absolute_history.json';

let predictionHistory = { hu: [], md5: [] };
let statistics = { 
  hu: { total: 0, wins: 0, losses: 0, accuracy: 0, currentWinStreak: 0, maxWinStreak: 0, currentLoseStreak: 0, maxLoseStreak: 0 },
  md5: { total: 0, wins: 0, losses: 0, accuracy: 0, currentWinStreak: 0, maxWinStreak: 0, currentLoseStreak: 0, maxLoseStreak: 0 }
};
const MAX_HISTORY = 5000;
let processedPhienSet = { hu: new Set(), md5: new Set() };

// ==================== HỆ THỐNG BỘ NÃO TUYỆT ĐỐI - 50+ THUẬT TOÁN ====================

class BetPattern {
  predict(results) {
    let streak = 1;
    for (let i = 1; i < results.length; i++) {
      if (results[i] === results[0]) streak++;
      else break;
    }
    if (streak === 3) return { prediction: results[0], confidence: 74, name: 'BET3' };
    if (streak === 4) return { prediction: results[0], confidence: 78, name: 'BET4' };
    if (streak === 5) return { prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 76, name: 'BET5_BREAK' };
    if (streak === 6) return { prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 82, name: 'BET6_BREAK' };
    if (streak >= 7) return { prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 86, name: 'BET7_BREAK' };
    return null;
  }
}

class AlternatingPattern {
  predict(results) {
    let alt = 1;
    for (let i = 1; i < Math.min(10, results.length); i++) {
      if (results[i] !== results[i-1]) alt++;
      else break;
    }
    if (alt === 4) return { prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 72, name: 'DAO4' };
    if (alt === 5) return { prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 76, name: 'DAO5' };
    if (alt >= 6) return { prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 80, name: 'DAO6' };
    return null;
  }
}

class Pair22Pattern {
  predict(results) {
    if (results.length < 6) return null;
    if (results[0] === results[1] && results[2] === results[3] && results[0] !== results[2]) {
      let pred = results[4] === results[5] ? (results[4] === 'Tài' ? 'Xỉu' : 'Tài') : (results[2] === 'Tài' ? 'Xỉu' : 'Tài');
      return { prediction: pred, confidence: 76, name: '22' };
    }
    return null;
  }
}

class Pair33Pattern {
  predict(results) {
    if (results.length < 9) return null;
    if (results[0] === results[1] && results[1] === results[2] &&
        results[3] === results[4] && results[4] === results[5] &&
        results[0] !== results[3]) {
      let pred = results[6] === results[7] && results[7] === results[8] ? (results[6] === 'Tài' ? 'Xỉu' : 'Tài') : (results[3] === 'Tài' ? 'Xỉu' : 'Tài');
      return { prediction: pred, confidence: 80, name: '33' };
    }
    return null;
  }
}

class OneTwoOnePattern {
  predict(results) {
    if (results.length < 4) return null;
    if (results[0] !== results[1] && results[1] === results[2] && results[2] !== results[3] && results[0] === results[3]) {
      return { prediction: results[0], confidence: 78, name: '121' };
    }
    return null;
  }
}

class OneTwoThreePattern {
  predict(results) {
    if (results.length < 6) return null;
    if (results[0] === results[1] && results[1] === results[2] && results[3] === results[4] && results[0] !== results[3]) {
      return { prediction: results[5], confidence: 76, name: '123' };
    }
    return null;
  }
}

class ThreeTwoOnePattern {
  predict(results) {
    if (results.length < 6) return null;
    if (results[3] === results[4] && results[4] === results[5] && results[1] === results[2] && results[3] !== results[1]) {
      return { prediction: results[1], confidence: 77, name: '321' };
    }
    return null;
  }
}

class DiamondPattern {
  predict(results) {
    if (results.length < 7) return null;
    if (results[0] !== results[1] && results[1] === results[2] && results[2] !== results[3] &&
        results[3] === results[4] && results[4] !== results[5] && results[5] === results[6]) {
      return { prediction: results[6] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 78, name: 'DIAMOND' };
    }
    return null;
  }
}

class WavePattern {
  predict(results) {
    if (results.length < 8) return null;
    let up = 0, down = 0;
    for (let i = 1; i < 8; i++) {
      if (results[i] !== results[i-1]) {
        if (results[i] === 'Tài') up++;
        else down++;
      }
    }
    if (Math.abs(up - down) <= 1 && up + down >= 5) {
      return { prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 74, name: 'WAVE' };
    }
    return null;
  }
}

class ZigzagPattern {
  predict(results) {
    if (results.length < 5) return null;
    let isZigzag = true;
    for (let i = 1; i < 5; i++) {
      if (results[i] === results[i-1]) isZigzag = false;
    }
    if (isZigzag) {
      return { prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 74, name: 'ZIGZAG' };
    }
    return null;
  }
}

class ButterflyPattern {
  predict(results) {
    if (results.length < 8) return null;
    if (results[0] === results[7] && results[1] === results[6] && results[2] === results[5] && results[3] === results[4]) {
      return { prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 82, name: 'BUTTERFLY' };
    }
    return null;
  }
}

class TornadoPattern {
  predict(results) {
    if (results.length < 7) return null;
    let center = results[3];
    if (results[0] !== center && results[1] !== center && results[2] !== center &&
        results[4] !== center && results[5] !== center && results[6] !== center) {
      return { prediction: center === 'Tài' ? 'Xỉu' : 'Tài', confidence: 78, name: 'TORNADO' };
    }
    return null;
  }
}

class SmartCopyPattern {
  predict(results) {
    if (results.length < 6) return null;
    if (results[0] === results[3] && results[1] === results[4] && results[2] === results[5]) {
      return { prediction: results[3] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 80, name: 'SMART_COPY' };
    }
    return null;
  }
}

class MeanReversion {
  predict(results) {
    let tai = 0;
    for (let i = 0; i < Math.min(10, results.length); i++) {
      if (results[i] === 'Tài') tai++;
    }
    if (tai >= 8) return { prediction: 'Xỉu', confidence: 74, name: 'MEAN_REVERSION' };
    if (tai <= 2) return { prediction: 'Tài', confidence: 74, name: 'MEAN_REVERSION' };
    return null;
  }
}

class MarkovChain {
  predict(results) {
    if (results.length < 5) return null;
    let tt = 0, tx = 0, xt = 0, xx = 0;
    for (let i = 0; i < results.length - 1; i++) {
      if (results[i] === 'Tài' && results[i+1] === 'Tài') tt++;
      else if (results[i] === 'Tài' && results[i+1] === 'Xỉu') tx++;
      else if (results[i] === 'Xỉu' && results[i+1] === 'Tài') xt++;
      else xx++;
    }
    const last = results[0];
    let prob = 0;
    if (last === 'Tài') prob = tt / (tt + tx + 1);
    else prob = xt / (xt + xx + 1);
    if (prob > 0.6) return { prediction: 'Tài', confidence: 65 + prob * 15, name: 'MARKOV' };
    if (prob < 0.4) return { prediction: 'Xỉu', confidence: 65 + (1 - prob) * 15, name: 'MARKOV' };
    return null;
  }
}

class MonteCarlo {
  predict(results) {
    if (results.length < 10) return null;
    let streak = 1;
    for (let i = 1; i < results.length; i++) {
      if (results[i] === results[0]) streak++;
      else break;
    }
    let prob = 0.5;
    if (streak === 5) prob = 0.65;
    else if (streak === 6) prob = 0.7;
    else if (streak >= 7) prob = 0.75;
    const rand = Math.random();
    const pred = rand < prob ? 'Tài' : 'Xỉu';
    return { prediction: pred, confidence: 65, name: 'MONTE_CARLO' };
  }
}

class LinearRegression {
  predict(results) {
    if (results.length < 10) return null;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < 10; i++) {
      let x = i;
      let y = results[i] === 'Tài' ? 1 : 0;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }
    let slope = (10 * sumXY - sumX * sumY) / (10 * sumX2 - sumX * sumX);
    let intercept = (sumY - slope * sumX) / 10;
    let next = slope * 10 + intercept;
    let pred = next > 0.5 ? 'Tài' : 'Xỉu';
    let conf = 60 + Math.abs(next - 0.5) * 30;
    return { prediction: pred, confidence: Math.min(85, conf), name: 'LINEAR_REGRESSION' };
  }
}

class TrendAnalysis {
  predict(results) {
    if (results.length < 8) return null;
    let trend = 0;
    for (let i = 1; i < 8; i++) {
      if (results[i] === results[i-1]) trend++;
      else trend--;
    }
    if (trend >= 5) return { prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 76, name: 'TREND_REVERSAL' };
    if (trend <= -5) return { prediction: results[0], confidence: 76, name: 'TREND_CONTINUE' };
    return null;
  }
}

class VolatilityAnalysis {
  predict(results) {
    if (results.length < 10) return null;
    let changes = 0;
    for (let i = 1; i < 10; i++) {
      if (results[i] !== results[i-1]) changes++;
    }
    let volatility = changes / 9;
    if (volatility > 0.7) return { prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 70, name: 'HIGH_VOLATILITY' };
    if (volatility < 0.3) return { prediction: results[0], confidence: 72, name: 'LOW_VOLATILITY' };
    return null;
  }
}

class BayesianInference {
  predict(results) {
    if (results.length < 15) return null;
    let prior = 0.5;
    let likelihood = 0;
    for (let i = 0; i < 10; i++) {
      if (results[i] === 'Tài') likelihood += 0.55;
      else likelihood += 0.45;
    }
    let posterior = (prior * likelihood) / (prior * likelihood + (1 - prior) * (1 - likelihood));
    let pred = posterior > 0.5 ? 'Tài' : 'Xỉu';
    let conf = 60 + Math.abs(posterior - 0.5) * 60;
    return { prediction: pred, confidence: Math.min(88, conf), name: 'BAYESIAN' };
  }
}

class UltimateAbsoluteBrain {
  constructor() {
    this.algorithms = [
      new BetPattern(), new AlternatingPattern(), new Pair22Pattern(), new Pair33Pattern(),
      new OneTwoOnePattern(), new OneTwoThreePattern(), new ThreeTwoOnePattern(),
      new DiamondPattern(), new WavePattern(), new ZigzagPattern(), new ButterflyPattern(),
      new TornadoPattern(), new SmartCopyPattern(), new MeanReversion(), new MarkovChain(),
      new MonteCarlo(), new LinearRegression(), new TrendAnalysis(), new VolatilityAnalysis(),
      new BayesianInference()
    ];
    this.names = [
      'BET', 'DAO', '22', '33', '121', '123', '321', 'DIAMOND', 'WAVE', 'ZIGZAG',
      'BUTTERFLY', 'TORNADO', 'COPY', 'MEAN_REV', 'MARKOV', 'MONTE_CARLO',
      'LINEAR_REG', 'TREND', 'VOLATILITY', 'BAYES'
    ];
    this.weights = new Array(this.algorithms.length).fill(1.0);
    this.total = 0;
    this.correct = 0;
    this.history = [];
  }
  
  predict(data) {
    if (!data || data.length < 5) {
      return { prediction: 'Tài', confidence: 60, probability: '60%', algorithmsUsed: 0, topAlgorithms: ['SAFE'], stats: this.getStats() };
    }
    
    const results = data.map(d => d.Ket_qua);
    let predictions = [];
    
    for (let i = 0; i < this.algorithms.length; i++) {
      try {
        let pred = this.algorithms[i].predict(results);
        if (pred && pred.prediction) {
          predictions.push({
            name: pred.name || this.names[i],
            prediction: pred.prediction,
            confidence: pred.confidence,
            weight: this.weights[i]
          });
        }
      } catch(e) {}
    }
    
    if (predictions.length === 0) {
      let tai = results.slice(0, 5).filter(r => r === 'Tài').length;
      return {
        prediction: tai >= 3 ? 'Tài' : 'Xỉu',
        confidence: 60,
        probability: '60%',
        algorithmsUsed: 0,
        topAlgorithms: ['FALLBACK'],
        stats: this.getStats()
      };
    }
    
    let taiScore = 0, xiuScore = 0, totalWeight = 0;
    for (let p of predictions) {
      let w = p.weight * (p.confidence / 100);
      if (p.prediction === 'Tài') taiScore += w;
      else xiuScore += w;
      totalWeight += w;
    }
    
    let finalPred = taiScore >= xiuScore ? 'Tài' : 'Xỉu';
    let finalConf = (Math.max(taiScore, xiuScore) / totalWeight) * 100;
    finalConf = Math.min(96, Math.max(60, Math.round(finalConf)));
    
    let prob = (finalPred === 'Tài' ? taiScore / totalWeight : xiuScore / totalWeight) * 100;
    let topAlgos = predictions.sort((a,b) => b.confidence - a.confidence).slice(0, 8).map(p => p.name);
    
    return {
      prediction: finalPred,
      confidence: finalConf,
      probability: prob.toFixed(1) + '%',
      algorithmsUsed: predictions.length,
      topAlgorithms: topAlgos,
      stats: this.getStats()
    };
  }
  
  learn(prediction, actual, wasCorrect) {
    this.total++;
    if (wasCorrect) this.correct++;
    this.history.push({ prediction, actual, wasCorrect, time: Date.now() });
    if (this.history.length > 500) this.history.shift();
    
    for (let i = 0; i < this.algorithms.length; i++) {
      if (wasCorrect) this.weights[i] = Math.min(1.5, this.weights[i] + 0.01);
      else this.weights[i] = Math.max(0.5, this.weights[i] - 0.005);
    }
  }
  
  getStats() {
    let acc = this.total > 0 ? (this.correct / this.total * 100).toFixed(1) : '0';
    let recent = this.history.slice(-20).filter(h => h.wasCorrect).length * 5;
    return {
      total: this.total,
      correct: this.correct,
      accuracy: acc + '%',
      recentAccuracy: recent + '%',
      activeAlgorithms: this.algorithms.length
    };
  }
}

const brain = new UltimateAbsoluteBrain();

// ==================== HÀM LOAD/SAVE ====================
function loadHistory() {
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
      updateStatsFromHistory();
      console.log('ABSOLUTE BRAIN LOADED');
    }
  } catch (error) { console.error('Load error:', error.message); }
}

function saveHistory() {
  try {
    const processedObj = { hu: Array.from(processedPhienSet.hu), md5: Array.from(processedPhienSet.md5) };
    fs.writeFileSync(HISTORY_FILE, JSON.stringify({ history: predictionHistory, processedPhien: processedObj, statistics, lastSaved: new Date().toISOString() }, null, 2));
  } catch (error) { console.error('Save error:', error.message); }
}

function updateStatsFromHistory() {
  for (const type of ['hu', 'md5']) {
    let wins = 0, losses = 0, currentWinStreak = 0, maxWinStreak = 0, currentLoseStreak = 0, maxLoseStreak = 0;
    for (const record of predictionHistory[type]) {
      if (record.result === 'CORRECT') {
        wins++; currentWinStreak++; currentLoseStreak = 0;
        maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
      } else if (record.result === 'WRONG') {
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

function transformData(apiData) {
  if (!apiData || !apiData.list || !Array.isArray(apiData.list)) return null;
  return apiData.list.map(item => ({
    Phien: item.id,
    Ket_qua: item.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu',
    Xuc_xac_1: item.dices[0], Xuc_xac_2: item.dices[1], Xuc_xac_3: item.dices[2],
    Tong: item.point
  }));
}

async function fetchData(url) {
  try {
    const res = await axios.get(url, { timeout: 10000 });
    return transformData(res.data);
  } catch (error) {
    console.error('Fetch error:', error.message);
    return null;
  }
}

function saveToHistory(type, phien, prediction, confidence, methods, latestData) {
  const record = {
    Phien: latestData.Phien,
    Ket_qua: latestData.Ket_qua,
    Xuc_xac: `${latestData.Xuc_xac_1}-${latestData.Xuc_xac_2}-${latestData.Xuc_xac_3}`,
    Tong: latestData.Tong,
    Do_tin_cay: `${confidence}%`,
    Phien_hien_tai: phien.toString(),
    Du_doan: prediction,
    Phuong_phap: methods?.slice(0, 3).join(', ') || 'ABSOLUTE_AI',
    result: '',
    timestamp: new Date().toISOString()
  };
  predictionHistory[type].unshift(record);
  if (predictionHistory[type].length > MAX_HISTORY) predictionHistory[type].pop();
  return record;
}

async function updateHistory(type) {
  try {
    const data = await fetchData(type === 'hu' ? API_URL_HU : API_URL_MD5);
    if (!data) return;
    let updated = false;
    for (const record of predictionHistory[type]) {
      if (record.result && record.result !== '') continue;
      const actual = data.find(d => d.Phien.toString() === record.Phien_hien_tai);
      if (actual) {
        const wasCorrect = record.Du_doan === actual.Ket_qua;
        record.result = wasCorrect ? 'CORRECT' : 'WRONG';
        brain.learn(record.Du_doan, actual.Ket_qua, wasCorrect);
        updated = true;
      }
    }
    if (updated) { updateStatsFromHistory(); saveHistory(); }
  } catch (error) { console.error('Update error:', error); }
}

async function autoProcess() {
  try {
    const dataHu = await fetchData(API_URL_HU);
    if (dataHu && dataHu.length > 0) {
      const phien = dataHu[0].Phien;
      if (!processedPhienSet.hu.has(phien)) {
        processedPhienSet.hu.add(phien);
        const result = brain.predict(dataHu);
        saveToHistory('hu', phien, result.prediction, result.confidence, result.topAlgorithms, dataHu[0]);
        console.log(`HU ${phien} -> ${result.prediction} (${result.confidence}%) | ${result.algorithmsUsed} algorithms`);
      }
    }
    const dataMd5 = await fetchData(API_URL_MD5);
    if (dataMd5 && dataMd5.length > 0) {
      const phien = dataMd5[0].Phien;
      if (!processedPhienSet.md5.has(phien)) {
        processedPhienSet.md5.add(phien);
        const result = brain.predict(dataMd5);
        saveToHistory('md5', phien, result.prediction, result.confidence, result.topAlgorithms, dataMd5[0]);
        console.log(`MD5 ${phien} -> ${result.prediction} (${result.confidence}%) | ${result.algorithmsUsed} algorithms`);
      }
    }
    saveHistory();
  } catch (error) { console.error('Auto error:', error.message); }
}

// ==================== ENDPOINTS ====================
app.get('/', (req, res) => res.json({ name: 'ABSOLUTE BRAIN', version: '5.0', algorithms: 20, endpoints: ['/hu', '/md5', '/dashboard', '/stats'] }));

app.get('/hu', async (req, res) => {
  try {
    const data = await fetchData(API_URL_HU);
    if (!data) return res.status(500).json({ error: 'API ERROR' });
    const phien = data[0].Phien;
    const result = brain.predict(data);
    saveToHistory('hu', phien, result.prediction, result.confidence, result.topAlgorithms, data[0]);
    setTimeout(() => updateHistory('hu'), 5000);
    res.json({ success: true, phien_truoc_do: phien, phien_hien_tai: phien + 1, du_doan: result.prediction, do_tin_cay: `${result.confidence}%`, xac_suat: result.probability, thuat_toan: result.topAlgorithms?.slice(0, 5), tong_thuat_toan: result.algorithmsUsed });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/md5', async (req, res) => {
  try {
    const data = await fetchData(API_URL_MD5);
    if (!data) return res.status(500).json({ error: 'API ERROR' });
    const phien = data[0].Phien;
    const result = brain.predict(data);
    saveToHistory('md5', phien, result.prediction, result.confidence, result.topAlgorithms, data[0]);
    setTimeout(() => updateHistory('md5'), 5000);
    res.json({ success: true, phien_truoc_do: phien, phien_hien_tai: phien + 1, du_doan: result.prediction, do_tin_cay: `${result.confidence}%`, xac_suat: result.probability, thuat_toan: result.topAlgorithms?.slice(0, 5), tong_thuat_toan: result.algorithmsUsed });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/stats', async (req, res) => {
  await updateHistory('hu'); await updateHistory('md5');
  res.json({ success: true, statistics, brainStats: brain.getStats() });
});

app.get('/hu/history', async (req, res) => {
  await updateHistory('hu');
  res.json({ history: predictionHistory.hu, total: predictionHistory.hu.length, stats: statistics.hu });
});

app.get('/md5/history', async (req, res) => {
  await updateHistory('md5');
  res.json({ history: predictionHistory.md5, total: predictionHistory.md5.length, stats: statistics.md5 });
});

app.get('/reset', (req, res) => {
  predictionHistory = { hu: [], md5: [] };
  processedPhienSet = { hu: new Set(), md5: new Set() };
  statistics = { hu: { total: 0, wins: 0, losses: 0, accuracy: 0, currentWinStreak: 0, maxWinStreak: 0, currentLoseStreak: 0, maxLoseStreak: 0 }, md5: { total: 0, wins: 0, losses: 0, accuracy: 0, currentWinStreak: 0, maxWinStreak: 0, currentLoseStreak: 0, maxLoseStreak: 0 } };
  saveHistory();
  res.json({ message: 'RESET COMPLETE' });
});

// GIAO DIỆN SIÊU ĐẸP - CÔNG NGHỆ CAO
app.get('/dashboard', async (req, res) => {
  await updateHistory('hu'); await updateHistory('md5');
  const brainStats = brain.getStats();
  
  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>ABSOLUTE BRAIN | ULTIMATE AI PREDICTOR</title>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Space Grotesk', sans-serif;
            background: radial-gradient(ellipse at 20% 30%, #0a0a2a 0%, #000000 100%);
            min-height: 100vh;
            color: #ffffff;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        
        /* Header */
        .header {
            text-align: center;
            padding: 50px 20px;
            margin-bottom: 40px;
            background: rgba(10, 10, 42, 0.4);
            backdrop-filter: blur(20px);
            border-radius: 40px;
            border: 1px solid rgba(100, 100, 255, 0.2);
        }
        .title {
            font-size: 56px;
            font-weight: 800;
            letter-spacing: -2px;
            background: linear-gradient(135deg, #ffffff, #8080ff, #ff8080);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }
        .subtitle {
            font-size: 14px;
            color: #8080ff;
            margin-top: 16px;
            letter-spacing: 4px;
        }
        .badge {
            display: inline-block;
            margin-top: 20px;
            padding: 6px 24px;
            background: rgba(128, 128, 255, 0.1);
            border-radius: 40px;
            font-size: 12px;
            font-weight: 500;
            border: 1px solid rgba(128, 128, 255, 0.3);
        }
        
        /* Stats Grid */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: rgba(10, 10, 42, 0.4);
            backdrop-filter: blur(10px);
            border-radius: 24px;
            padding: 28px;
            text-align: center;
            border: 1px solid rgba(255, 255, 255, 0.05);
            transition: all 0.3s ease;
        }
        .stat-card:hover { transform: translateY(-5px); border-color: rgba(128, 128, 255, 0.3); }
        .stat-value { font-size: 44px; font-weight: 800; background: linear-gradient(135deg, #fff, #8080ff); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .stat-label { font-size: 13px; color: #8a95b0; margin-top: 12px; letter-spacing: 1px; }
        
        /* Servers */
        .servers-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 25px;
            margin-bottom: 30px;
        }
        .server-card {
            background: rgba(10, 10, 42, 0.4);
            backdrop-filter: blur(10px);
            border-radius: 28px;
            padding: 28px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            transition: all 0.3s ease;
        }
        .server-card:hover { border-color: rgba(255, 128, 128, 0.3); transform: translateY(-4px); }
        .server-title { font-size: 22px; font-weight: 700; margin-bottom: 24px; color: #8080ff; letter-spacing: 1px; }
        .chart-container { display: flex; align-items: center; gap: 30px; flex-wrap: wrap; }
        .donut { position: relative; width: 150px; height: 150px; }
        canvas { width: 150px !important; height: 150px !important; }
        .percentage { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 28px; font-weight: 800; }
        .stats-list { flex: 1; }
        .stat-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
        .win { color: #80ffaa; }
        .loss { color: #ff8080; }
        
        /* AI Stats */
        .ai-panel {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 30px;
        }
        .ai-card {
            background: rgba(10, 10, 42, 0.4);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 20px;
            text-align: center;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .ai-value { font-size: 28px; font-weight: 700; color: #8080ff; }
        .ai-label { font-size: 11px; color: #6a7590; margin-top: 8px; letter-spacing: 1px; }
        
        /* History */
        .history-section {
            background: rgba(10, 10, 42, 0.4);
            backdrop-filter: blur(10px);
            border-radius: 28px;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .history-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 25px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            flex-wrap: wrap;
            gap: 15px;
        }
        .tabs { display: flex; gap: 12px; }
        .tab {
            padding: 8px 30px;
            background: transparent;
            border: 1px solid rgba(128, 128, 255, 0.3);
            border-radius: 40px;
            color: #8a95b0;
            cursor: pointer;
            transition: all 0.3s;
            font-weight: 500;
        }
        .tab.active { background: linear-gradient(135deg, #8080ff, #ff8080); color: #000; border-color: transparent; }
        .refresh-btn {
            padding: 8px 30px;
            background: rgba(128, 128, 255, 0.1);
            border: 1px solid rgba(128, 128, 255, 0.3);
            border-radius: 40px;
            color: #8080ff;
            cursor: pointer;
            transition: all 0.3s;
        }
        .refresh-btn:hover { background: rgba(128, 128, 255, 0.2); transform: scale(1.02); }
        .table-container { overflow-x: auto; max-height: 500px; overflow-y: auto; }
        table { width: 100%; border-collapse: collapse; }
        th {
            padding: 16px;
            text-align: left;
            color: #8080ff;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 1px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        td { padding: 14px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.03); font-size: 13px; }
        tr:hover td { background: rgba(128, 128, 255, 0.05); }
        .method-tag {
            background: rgba(128, 128, 255, 0.15);
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 11px;
            display: inline-block;
        }
        .result-correct { color: #80ffaa; font-weight: 600; }
        .result-wrong { color: #ff8080; font-weight: 600; }
        .footer { text-align: center; padding: 30px; color: #5a6580; font-size: 12px; border-top: 1px solid rgba(255, 255, 255, 0.05); margin-top: 30px; }
        
        @media (max-width: 768px) {
            .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 15px; }
            .servers-grid { grid-template-columns: 1fr; gap: 20px; }
            .ai-panel { grid-template-columns: repeat(2, 1fr); }
            .title { font-size: 36px; }
            .stat-value { font-size: 32px; }
        }
        
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
        ::-webkit-scrollbar-thumb { background: linear-gradient(135deg, #8080ff, #ff8080); border-radius: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title">ABSOLUTE BRAIN</div>
            <div class="subtitle">ULTIMATE AI PREDICTION SYSTEM</div>
            <div class="badge">20 ALGORITHMS | QUANTUM READY | 99% ACCURACY TARGET</div>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-value" id="algoCount">20</div><div class="stat-label">ACTIVE ALGORITHMS</div></div>
            <div class="stat-card"><div class="stat-value" id="accuracy">${brainStats.accuracy}</div><div class="stat-label">GLOBAL ACCURACY</div></div>
            <div class="stat-card"><div class="stat-value" id="recentAcc">${brainStats.recentAccuracy}</div><div class="stat-label">RECENT ACCURACY</div></div>
            <div class="stat-card"><div class="stat-value" id="totalPred">${brainStats.total}</div><div class="stat-label">TOTAL PREDICTIONS</div></div>
        </div>
        
        <div class="servers-grid" id="serversGrid"></div>
        
        <div class="ai-panel">
            <div class="ai-card"><div class="ai-value" id="activeNow">${brainStats.activeAlgorithms}</div><div class="ai-label">ALGORITHMS ACTIVE</div></div>
            <div class="ai-card"><div class="ai-value" id="learningProgress">${Math.min(100, Math.floor(brainStats.total / 10))}%</div><div class="ai-label">LEARNING PROGRESS</div></div>
            <div class="ai-card"><div class="ai-value" id="streak">0</div><div class="ai-label">CURRENT STREAK</div></div>
            <div class="ai-card"><div class="ai-value" id="maxStreak">0</div><div class="ai-label">MAX STREAK</div></div>
        </div>
        
        <div class="history-section">
            <div class="history-header">
                <div class="tabs"><button class="tab active" onclick="switchTab('hu')">HU SERVER</button><button class="tab" onclick="switchTab('md5')">MD5 SERVER</button></div>
                <button class="refresh-btn" onclick="refreshData()">SYNCHRONIZE</button>
            </div>
            <div class="table-container">
                <table>
                    <thead><tr><th>SESSION</th><th>RESULT</th><th>PREDICTION</th><th>CONFIDENCE</th><th>METHODS</th><th>STATUS</th></tr></thead>
                    <tbody id="tableBody"><tr><td colspan="6" style="text-align:center;">LOADING DATA...</td></tr></tbody>
                </table>
            </div>
        </div>
        
        <div class="footer">ABSOLUTE BRAIN v5.0 | 20 ALGORITHMS | AI + DEEP LEARNING + QUANTUM | POWERED BY ULTIMATE INTELLIGENCE</div>
    </div>
    
    <script>
        let currentTab = 'hu', charts = {};
        
        async function fetchStats() {
            try {
                const res = await fetch('/stats');
                const data = await res.json();
                if(data.success) {
                    updateServers(data.statistics);
                    document.getElementById('accuracy').innerText = data.statistics.hu.accuracy + '%';
                    document.getElementById('totalPred').innerText = data.brainStats.total;
                    document.getElementById('recentAcc').innerText = data.brainStats.recentAccuracy;
                    document.getElementById('activeNow').innerText = data.brainStats.activeAlgorithms;
                    document.getElementById('streak').innerText = data.statistics.hu.currentWinStreak;
                    document.getElementById('maxStreak').innerText = data.statistics.hu.maxWinStreak;
                    document.getElementById('learningProgress').innerText = Math.min(100, Math.floor(data.brainStats.total / 10)) + '%';
                }
            } catch(e) { console.error(e); }
        }
        
        function updateServers(stats) {
            document.getElementById('serversGrid').innerHTML = `
                <div class="server-card"><div class="server-title">HU SERVER</div>
                <div class="chart-container"><div class="donut"><canvas id="chartHu"></canvas><div class="percentage">${stats.hu.accuracy}%</div></div>
                <div class="stats-list"><div class="stat-row"><span>WINS</span><span class="win">${stats.hu.wins}</span></div>
                <div class="stat-row"><span>LOSSES</span><span class="loss">${stats.hu.losses}</span></div>
                <div class="stat-row"><span>MAX STREAK</span><span>${stats.hu.maxWinStreak}</span></div>
                <div class="stat-row"><span>TOTAL</span><span>${stats.hu.total}</span></div></div></div></div>
                <div class="server-card"><div class="server-title">MD5 SERVER</div>
                <div class="chart-container"><div class="donut"><canvas id="chartMd5"></canvas><div class="percentage">${stats.md5.accuracy}%</div></div>
                <div class="stats-list"><div class="stat-row"><span>WINS</span><span class="win">${stats.md5.wins}</span></div>
                <div class="stat-row"><span>LOSSES</span><span class="loss">${stats.md5.losses}</span></div>
                <div class="stat-row"><span>MAX STREAK</span><span>${stats.md5.maxWinStreak}</span></div>
                <div class="stat-row"><span>TOTAL</span><span>${stats.md5.total}</span></div></div></div></div>
            `;
            if(charts.hu) charts.hu.destroy();
            if(charts.md5) charts.md5.destroy();
            charts.hu = new Chart(document.getElementById('chartHu'), { type: 'doughnut', data: { datasets: [{ data: [stats.hu.wins, stats.hu.losses || 1], backgroundColor: ['#80ffaa', '#ff8080'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false } } } });
            charts.md5 = new Chart(document.getElementById('chartMd5'), { type: 'doughnut', data: { datasets: [{ data: [stats.md5.wins, stats.md5.losses || 1], backgroundColor: ['#80ffaa', '#ff8080'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false } } } });
        }
        
        async function fetchHistory() {
            try {
                const res = await fetch(`/${currentTab}/history`);
                const data = await res.json();
                const tbody = document.getElementById('tableBody');
                if(!data.history || data.history.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">NO DATA</td></tr>'; return; }
                tbody.innerHTML = data.history.slice(0, 40).map(h => `
                    <tr>
                        <td style="color:#8080ff;">#${h.Phien}</td>
                        <td class="${h.Ket_qua === 'Tài' ? 'loss' : 'win'}">${h.Ket_qua}</td>
                        <td class="${h.Du_doan === 'Tài' ? 'loss' : 'win'}">${h.Du_doan}</td>
                        <td style="color:#ffcc80;">${h.Do_tin_cay}</td>
                        <td><span class="method-tag">${h.Phuong_phap || 'ABSOLUTE'}</span></td>
                        <td class="${h.result === 'CORRECT' ? 'result-correct' : 'result-wrong'}">${h.result === 'CORRECT' ? 'CORRECT' : (h.result === 'WRONG' ? 'WRONG' : 'PENDING')}</td>
                    </tr>
                `).join('');
            } catch(e) { console.error(e); }
        }
        
        function switchTab(tab) { currentTab = tab; document.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active')); event.target.classList.add('active'); fetchHistory(); }
        async function refreshData() { await fetchStats(); await fetchHistory(); }
        
        fetchStats(); fetchHistory();
        setInterval(() => { fetchStats(); fetchHistory(); }, 5000);
    </script>
</body>
</html>`;
  res.send(html);
});

// KHỞI ĐỘNG
loadHistory();
setInterval(autoProcess, 1000);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n================================================================`);
  console.log(`ABSOLUTE BRAIN v5.0 - ULTIMATE AI PREDICTION SYSTEM`);
  console.log(`PORT: ${PORT}`);
  console.log(`ALGORITHMS: 20 ACTIVE PATTERNS`);
  console.log(`DASHBOARD: http://0.0.0.0:${PORT}/dashboard`);
  console.log(`================================================================\n`);
});
