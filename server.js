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
const MAX_HISTORY = 3000;
let processedPhienSet = { hu: new Set(), md5: new Set() };

// ==================== 20 THUẬT TOÁN DỰ ĐOÁN ====================

// 1. Cầu Bệt
function algorithmBet(results) {
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

// 2. Cầu Đảo
function algorithmDao(results) {
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

// 3. Cầu 2-2
function algorithmPair22(results) {
  if (results.length < 6) return null;
  if (results[0] === results[1] && results[2] === results[3] && results[0] !== results[2]) {
    let pred = results[4] === results[5] ? (results[4] === 'Tài' ? 'Xỉu' : 'Tài') : (results[2] === 'Tài' ? 'Xỉu' : 'Tài');
    return { prediction: pred, confidence: 76, name: 'PAIR22' };
  }
  return null;
}

// 4. Cầu 3-3
function algorithmPair33(results) {
  if (results.length < 9) return null;
  if (results[0] === results[1] && results[1] === results[2] &&
      results[3] === results[4] && results[4] === results[5] &&
      results[0] !== results[3]) {
    let pred = results[6] === results[7] && results[7] === results[8] ? (results[6] === 'Tài' ? 'Xỉu' : 'Tài') : (results[3] === 'Tài' ? 'Xỉu' : 'Tài');
    return { prediction: pred, confidence: 80, name: 'PAIR33' };
  }
  return null;
}

// 5. Cầu 1-2-1
function algorithm121(results) {
  if (results.length < 4) return null;
  if (results[0] !== results[1] && results[1] === results[2] && results[2] !== results[3] && results[0] === results[3]) {
    return { prediction: results[0], confidence: 78, name: '121' };
  }
  return null;
}

// 6. Cầu 1-2-3
function algorithm123(results) {
  if (results.length < 6) return null;
  if (results[0] === results[1] && results[1] === results[2] && results[3] === results[4] && results[0] !== results[3]) {
    return { prediction: results[5], confidence: 76, name: '123' };
  }
  return null;
}

// 7. Cầu 3-2-1
function algorithm321(results) {
  if (results.length < 6) return null;
  if (results[3] === results[4] && results[4] === results[5] && results[1] === results[2] && results[3] !== results[1]) {
    return { prediction: results[1], confidence: 77, name: '321' };
  }
  return null;
}

// 8. Cầu Kim Cương
function algorithmDiamond(results) {
  if (results.length < 7) return null;
  if (results[0] !== results[1] && results[1] === results[2] && results[2] !== results[3] &&
      results[3] === results[4] && results[4] !== results[5] && results[5] === results[6]) {
    return { prediction: results[6] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 78, name: 'DIAMOND' };
  }
  return null;
}

// 9. Cầu Sóng
function algorithmWave(results) {
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

// 10. Cầu Zigzag
function algorithmZigzag(results) {
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

// 11. Cầu Bướm
function algorithmButterfly(results) {
  if (results.length < 8) return null;
  if (results[0] === results[7] && results[1] === results[6] && results[2] === results[5] && results[3] === results[4]) {
    return { prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 82, name: 'BUTTERFLY' };
  }
  return null;
}

// 12. Cầu Lốc Xoáy
function algorithmTornado(results) {
  if (results.length < 7) return null;
  let center = results[3];
  if (results[0] !== center && results[1] !== center && results[2] !== center &&
      results[4] !== center && results[5] !== center && results[6] !== center) {
    return { prediction: center === 'Tài' ? 'Xỉu' : 'Tài', confidence: 78, name: 'TORNADO' };
  }
  return null;
}

// 13. Cầu Sao Chép Thông Minh
function algorithmSmartCopy(results) {
  if (results.length < 6) return null;
  if (results[0] === results[3] && results[1] === results[4] && results[2] === results[5]) {
    return { prediction: results[3] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 80, name: 'SMART_COPY' };
  }
  return null;
}

// 14. Hồi quy trung bình
function algorithmMeanReversion(results) {
  let tai = 0;
  for (let i = 0; i < Math.min(10, results.length); i++) {
    if (results[i] === 'Tài') tai++;
  }
  if (tai >= 8) return { prediction: 'Xỉu', confidence: 74, name: 'MEAN_REVERSION' };
  if (tai <= 2) return { prediction: 'Tài', confidence: 74, name: 'MEAN_REVERSION' };
  return null;
}

// 15. Chuỗi Markov
function algorithmMarkov(results) {
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

// 16. Monte Carlo
function algorithmMonteCarlo(results) {
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

// 17. Hồi quy tuyến tính
function algorithmLinearRegression(results) {
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
  return { prediction: pred, confidence: Math.min(85, conf), name: 'LINEAR_REG' };
}

// 18. Phân tích xu hướng
function algorithmTrend(results) {
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

// 19. Phân tích biến động
function algorithmVolatility(results) {
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

// 20. Suy luận Bayes
function algorithmBayesian(results) {
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

// Danh sách tất cả thuật toán
const algorithms = [
  algorithmBet, algorithmDao, algorithmPair22, algorithmPair33,
  algorithm121, algorithm123, algorithm321, algorithmDiamond,
  algorithmWave, algorithmZigzag, algorithmButterfly, algorithmTornado,
  algorithmSmartCopy, algorithmMeanReversion, algorithmMarkov,
  algorithmMonteCarlo, algorithmLinearRegression, algorithmTrend,
  algorithmVolatility, algorithmBayesian
];

const algorithmNames = [
  'BET', 'DAO', '22', '33', '121', '123', '321', 'DIAMOND',
  'WAVE', 'ZIGZAG', 'BUTTERFLY', 'TORNADO', 'COPY', 'MEAN_REV',
  'MARKOV', 'MONTE_CARLO', 'LINEAR_REG', 'TREND', 'VOLATILITY', 'BAYES'
];

// Bộ não dự đoán
let totalPredictions = 0;
let correctPredictions = 0;
let history = [];

function predict(data) {
  if (!data || data.length < 5) {
    return { prediction: 'Tài', confidence: 60, probability: '60%', algorithmsUsed: 0, topAlgorithms: ['SAFE'] };
  }
  
  const results = data.map(d => d.Ket_qua);
  let predictions = [];
  
  for (let i = 0; i < algorithms.length; i++) {
    try {
      let pred = algorithms[i](results);
      if (pred && pred.prediction) {
        predictions.push({
          name: pred.name || algorithmNames[i],
          prediction: pred.prediction,
          confidence: pred.confidence
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
      topAlgorithms: ['FALLBACK']
    };
  }
  
  let taiScore = 0, xiuScore = 0;
  for (let p of predictions) {
    let w = p.confidence / 100;
    if (p.prediction === 'Tài') taiScore += w;
    else xiuScore += w;
  }
  
  let finalPred = taiScore >= xiuScore ? 'Tài' : 'Xỉu';
  let finalConf = (Math.max(taiScore, xiuScore) / (taiScore + xiuScore)) * 100;
  finalConf = Math.min(96, Math.max(60, Math.round(finalConf)));
  
  let prob = (finalPred === 'Tài' ? taiScore / (taiScore + xiuScore) : xiuScore / (taiScore + xiuScore)) * 100;
  let topAlgos = predictions.sort((a,b) => b.confidence - a.confidence).slice(0, 8).map(p => p.name);
  
  return {
    prediction: finalPred,
    confidence: finalConf,
    probability: prob.toFixed(1) + '%',
    algorithmsUsed: predictions.length,
    topAlgorithms: topAlgos
  };
}

function learn(prediction, actual, wasCorrect) {
  totalPredictions++;
  if (wasCorrect) correctPredictions++;
  history.push({ prediction, actual, wasCorrect, time: Date.now() });
  if (history.length > 500) history.shift();
}

function getStats() {
  let acc = totalPredictions > 0 ? (correctPredictions / totalPredictions * 100).toFixed(1) : '0';
  let recent = history.slice(-20).filter(h => h.wasCorrect).length * 5;
  return {
    total: totalPredictions,
    correct: correctPredictions,
    accuracy: acc + '%',
    recentAccuracy: recent + '%',
    activeAlgorithms: algorithms.length
  };
}

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
      if (parsed.brainStats) {
        totalPredictions = parsed.brainStats.total || 0;
        correctPredictions = parsed.brainStats.correct || 0;
      }
      updateStatsFromHistory();
      console.log('LOADED HISTORY');
    }
  } catch (error) { console.error('Load error:', error.message); }
}

function saveHistory() {
  try {
    const processedObj = { hu: Array.from(processedPhienSet.hu), md5: Array.from(processedPhienSet.md5) };
    fs.writeFileSync(HISTORY_FILE, JSON.stringify({ 
      history: predictionHistory, 
      processedPhien: processedObj, 
      statistics,
      brainStats: { total: totalPredictions, correct: correctPredictions },
      lastSaved: new Date().toISOString() 
    }, null, 2));
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
    Phuong_phap: methods?.slice(0, 3).join(', ') || 'ABSOLUTE',
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
        learn(record.Du_doan, actual.Ket_qua, wasCorrect);
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
        const result = predict(dataHu);
        saveToHistory('hu', phien, result.prediction, result.confidence, result.topAlgorithms, dataHu[0]);
        console.log(`HU ${phien} -> ${result.prediction} (${result.confidence}%)`);
      }
    }
    const dataMd5 = await fetchData(API_URL_MD5);
    if (dataMd5 && dataMd5.length > 0) {
      const phien = dataMd5[0].Phien;
      if (!processedPhienSet.md5.has(phien)) {
        processedPhienSet.md5.add(phien);
        const result = predict(dataMd5);
        saveToHistory('md5', phien, result.prediction, result.confidence, result.topAlgorithms, dataMd5[0]);
        console.log(`MD5 ${phien} -> ${result.prediction} (${result.confidence}%)`);
      }
    }
    saveHistory();
  } catch (error) { console.error('Auto error:', error.message); }
}

// ==================== ENDPOINTS ====================
app.get('/', (req, res) => res.json({ name: 'ABSOLUTE BRAIN', version: '5.0', algorithms: 20 }));

app.get('/hu', async (req, res) => {
  try {
    const data = await fetchData(API_URL_HU);
    if (!data) return res.status(500).json({ error: 'API ERROR' });
    const phien = data[0].Phien;
    const result = predict(data);
    saveToHistory('hu', phien, result.prediction, result.confidence, result.topAlgorithms, data[0]);
    setTimeout(() => updateHistory('hu'), 5000);
    res.json({ 
      success: true, 
      phien_truoc_do: phien, 
      phien_hien_tai: phien + 1, 
      du_doan: result.prediction, 
      do_tin_cay: `${result.confidence}%`, 
      xac_suat: result.probability,
      thuat_toan: result.topAlgorithms?.slice(0, 5),
      tong_thuat_toan: result.algorithmsUsed
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/md5', async (req, res) => {
  try {
    const data = await fetchData(API_URL_MD5);
    if (!data) return res.status(500).json({ error: 'API ERROR' });
    const phien = data[0].Phien;
    const result = predict(data);
    saveToHistory('md5', phien, result.prediction, result.confidence, result.topAlgorithms, data[0]);
    setTimeout(() => updateHistory('md5'), 5000);
    res.json({ 
      success: true, 
      phien_truoc_do: phien, 
      phien_hien_tai: phien + 1, 
      du_doan: result.prediction, 
      do_tin_cay: `${result.confidence}%`, 
      xac_suat: result.probability,
      thuat_toan: result.topAlgorithms?.slice(0, 5),
      tong_thuat_toan: result.algorithmsUsed
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/stats', async (req, res) => {
  await updateHistory('hu'); await updateHistory('md5');
  res.json({ success: true, statistics, brainStats: getStats() });
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
  totalPredictions = 0;
  correctPredictions = 0;
  history = [];
  statistics = { 
    hu: { total: 0, wins: 0, losses: 0, accuracy: 0, currentWinStreak: 0, maxWinStreak: 0, currentLoseStreak: 0, maxLoseStreak: 0 },
    md5: { total: 0, wins: 0, losses: 0, accuracy: 0, currentWinStreak: 0, maxWinStreak: 0, currentLoseStreak: 0, maxLoseStreak: 0 }
  };
  saveHistory();
  res.json({ message: 'RESET COMPLETE' });
});

// GIAO DIỆN ĐẸP
app.get('/dashboard', async (req, res) => {
  await updateHistory('hu'); await updateHistory('md5');
  const brainStats = getStats();
  
  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>ABSOLUTE BRAIN | AI PREDICTOR</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #0a0a2a 0%, #000000 100%);
            min-height: 100vh;
            color: #fff;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header { text-align: center; padding: 40px; margin-bottom: 30px; background: rgba(255,255,255,0.03); border-radius: 30px; border: 1px solid rgba(100,100,255,0.2); }
        .title { font-size: 48px; font-weight: 800; background: linear-gradient(135deg, #fff, #8080ff); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .badge { display: inline-block; margin-top: 15px; padding: 6px 24px; background: rgba(128,128,255,0.1); border-radius: 40px; font-size: 12px; border: 1px solid rgba(128,128,255,0.3); }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: rgba(255,255,255,0.03); border-radius: 20px; padding: 25px; text-align: center; border: 1px solid rgba(255,255,255,0.05); transition: 0.3s; }
        .stat-card:hover { transform: translateY(-5px); border-color: rgba(128,128,255,0.3); }
        .stat-value { font-size: 40px; font-weight: 800; background: linear-gradient(135deg, #fff, #8080ff); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .stat-label { font-size: 13px; color: #8a95b0; margin-top: 10px; }
        .servers-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 25px; margin-bottom: 30px; }
        .server-card { background: rgba(255,255,255,0.03); border-radius: 25px; padding: 25px; border: 1px solid rgba(255,255,255,0.05); transition: 0.3s; }
        .server-card:hover { border-color: rgba(255,128,128,0.3); }
        .server-title { font-size: 20px; font-weight: 700; margin-bottom: 20px; color: #8080ff; }
        .chart-container { display: flex; align-items: center; gap: 30px; flex-wrap: wrap; }
        .donut { position: relative; width: 140px; height: 140px; }
        canvas { width: 140px !important; height: 140px !important; }
        .percentage { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 24px; font-weight: 800; }
        .stats-list { flex: 1; }
        .stat-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .win { color: #80ffaa; }
        .loss { color: #ff8080; }
        .ai-panel { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
        .ai-card { background: rgba(255,255,255,0.03); border-radius: 16px; padding: 18px; text-align: center; }
        .ai-value { font-size: 24px; font-weight: 700; color: #8080ff; }
        .ai-label { font-size: 11px; color: #6a7590; margin-top: 8px; }
        .history-section { background: rgba(255,255,255,0.03); border-radius: 25px; overflow: hidden; }
        .history-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 25px; border-bottom: 1px solid rgba(255,255,255,0.05); flex-wrap: wrap; gap: 15px; }
        .tabs { display: flex; gap: 12px; }
        .tab { padding: 8px 28px; background: transparent; border: 1px solid rgba(128,128,255,0.3); border-radius: 40px; color: #8a95b0; cursor: pointer; transition: 0.3s; }
        .tab.active { background: linear-gradient(135deg, #8080ff, #ff8080); color: #000; border-color: transparent; }
        .refresh-btn { padding: 8px 28px; background: rgba(128,128,255,0.1); border: 1px solid rgba(128,128,255,0.3); border-radius: 40px; color: #8080ff; cursor: pointer; }
        .table-container { overflow-x: auto; max-height: 450px; overflow-y: auto; }
        table { width: 100%; border-collapse: collapse; }
        th { padding: 15px; text-align: left; color: #8080ff; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        td { padding: 13px 15px; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 13px; }
        .method-tag { background: rgba(128,128,255,0.15); padding: 4px 12px; border-radius: 20px; font-size: 11px; display: inline-block; }
        .result-correct { color: #80ffaa; }
        .result-wrong { color: #ff8080; }
        .footer { text-align: center; padding: 30px; color: #5a6580; font-size: 12px; margin-top: 30px; }
        @media (max-width: 768px) {
            .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 15px; }
            .servers-grid { grid-template-columns: 1fr; gap: 20px; }
            .ai-panel { grid-template-columns: repeat(2, 1fr); }
            .title { font-size: 32px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header"><div class="title">ABSOLUTE BRAIN</div><div class="badge">20 ALGORITHMS | AI POWERED</div></div>
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-value" id="algoCount">20</div><div class="stat-label">ALGORITHMS</div></div>
            <div class="stat-card"><div class="stat-value" id="accuracy">${brainStats.accuracy}</div><div class="stat-label">ACCURACY</div></div>
            <div class="stat-card"><div class="stat-value" id="recentAcc">${brainStats.recentAccuracy}</div><div class="stat-label">RECENT</div></div>
            <div class="stat-card"><div class="stat-value" id="totalPred">${brainStats.total}</div><div class="stat-label">TOTAL</div></div>
        </div>
        <div class="servers-grid" id="serversGrid"></div>
        <div class="ai-panel">
            <div class="ai-card"><div class="ai-value" id="activeNow">${brainStats.activeAlgorithms}</div><div class="ai-label">ACTIVE</div></div>
            <div class="ai-card"><div class="ai-value" id="learning">${Math.min(100, Math.floor(brainStats.total / 10))}%</div><div class="ai-label">LEARNING</div></div>
            <div class="ai-card"><div class="ai-value" id="streak">0</div><div class="ai-label">STREAK</div></div>
            <div class="ai-card"><div class="ai-value" id="maxStreak">0</div><div class="ai-label">MAX STREAK</div></div>
        </div>
        <div class="history-section">
            <div class="history-header"><div class="tabs"><button class="tab active" onclick="switchTab('hu')">HU</button><button class="tab" onclick="switchTab('md5')">MD5</button></div><button class="refresh-btn" onclick="refreshData()">SYNC</button></div>
            <div class="table-container"><table><thead><tr><th>SESSION</th><th>RESULT</th><th>PREDICTION</th><th>CONFIDENCE</th><th>METHODS</th><th>STATUS</th></tr></thead><tbody id="tableBody"><tr><td colspan="6" style="text-align:center;">LOADING...</td></tr></tbody></table></div>
        </div>
        <div class="footer">ABSOLUTE BRAIN v5.0 | 20 ALGORITHMS | ULTIMATE AI PREDICTOR</div>
    </div>
    <script>
        let currentTab = 'hu', charts = {};
        async function fetchStats() { try { const res = await fetch('/stats'); const data = await res.json(); if(data.success) { updateServers(data.statistics); document.getElementById('accuracy').innerText = data.statistics.hu.accuracy + '%'; document.getElementById('totalPred').innerText = data.brainStats.total; document.getElementById('recentAcc').innerText = data.brainStats.recentAccuracy; document.getElementById('activeNow').innerText = data.brainStats.activeAlgorithms; document.getElementById('streak').innerText = data.statistics.hu.currentWinStreak; document.getElementById('maxStreak').innerText = data.statistics.hu.maxWinStreak; document.getElementById('learning').innerText = Math.min(100, Math.floor(data.brainStats.total / 10)) + '%'; } } catch(e) {} }
        function updateServers(stats) { document.getElementById('serversGrid').innerHTML = '<div class="server-card"><div class="server-title">HU SERVER</div><div class="chart-container"><div class="donut"><canvas id="chartHu"></canvas><div class="percentage">'+stats.hu.accuracy+'%</div></div><div class="stats-list"><div class="stat-row"><span>WINS</span><span class="win">'+stats.hu.wins+'</span></div><div class="stat-row"><span>LOSSES</span><span class="loss">'+stats.hu.losses+'</span></div><div class="stat-row"><span>MAX STREAK</span><span>'+stats.hu.maxWinStreak+'</span></div><div class="stat-row"><span>TOTAL</span><span>'+stats.hu.total+'</span></div></div></div></div><div class="server-card"><div class="server-title">MD5 SERVER</div><div class="chart-container"><div class="donut"><canvas id="chartMd5"></canvas><div class="percentage">'+stats.md5.accuracy+'%</div></div><div class="stats-list"><div class="stat-row"><span>WINS</span><span class="win">'+stats.md5.wins+'</span></div><div class="stat-row"><span>LOSSES</span><span class="loss">'+stats.md5.losses+'</span></div><div class="stat-row"><span>MAX STREAK</span><span>'+stats.md5.maxWinStreak+'</span></div><div class="stat-row"><span>TOTAL</span><span>'+stats.md5.total+'</span></div></div></div></div>'; if(charts.hu) charts.hu.destroy(); if(charts.md5) charts.md5.destroy(); charts.hu = new Chart(document.getElementById('chartHu'), { type: 'doughnut', data: { datasets: [{ data: [stats.hu.wins, stats.hu.losses || 1], backgroundColor: ['#80ffaa', '#ff8080'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false } } } }); charts.md5 = new Chart(document.getElementById('chartMd5'), { type: 'doughnut', data: { datasets: [{ data: [stats.md5.wins, stats.md5.losses || 1], backgroundColor: ['#80ffaa', '#ff8080'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false } } } }); }
        async function fetchHistory() { try { const res = await fetch(`/${currentTab}/history`); const data = await res.json(); const tbody = document.getElementById('tableBody'); if(!data.history || data.history.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">NO DATA</td></tr>'; return; } tbody.innerHTML = data.history.slice(0, 30).map(h => '<tr><td style="color:#8080ff;">#'+h.Phien+'</td><td class="'+(h.Ket_qua === 'Tài' ? 'loss' : 'win')+'">'+h.Ket_qua+'</td><td class="'+(h.Du_doan === 'Tài' ? 'loss' : 'win')+'">'+h.Du_doan+'</td><td style="color:#ffcc80;">'+h.Do_tin_cay+'</td><td><span class="method-tag">'+(h.Phuong_phap || 'ABSOLUTE')+'</span></td><td class="'+(h.result === 'CORRECT' ? 'result-correct' : 'result-wrong')+'">'+(h.result === 'CORRECT' ? 'CORRECT' : (h.result === 'WRONG' ? 'WRONG' : 'PENDING'))+'</td></tr>').join(''); } catch(e) {} }
        function switchTab(tab) { currentTab = tab; document.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active')); event.target.classList.add('active'); fetchHistory(); }
        async function refreshData() { await fetchStats(); await fetchHistory(); }
        fetchStats(); fetchHistory(); setInterval(() => { fetchStats(); fetchHistory(); }, 5000);
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
  console.log(`ABSOLUTE BRAIN v5.0 - AI PREDICTION SYSTEM`);
  console.log(`PORT: ${PORT}`);
  console.log(`ALGORITHMS: 20 ACTIVE`);
  console.log(`DASHBOARD: http://0.0.0.0:${PORT}/dashboard`);
  console.log(`================================================================\n`);
});
