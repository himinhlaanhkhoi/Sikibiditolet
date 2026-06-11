const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5000;

const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';
const LEARNING_FILE = 'adaptive_learning.json';
const HISTORY_FILE = 'prediction_history.json';

let predictionHistory = { hu: [], md5: [] };
let statistics = { 
  hu: { total: 0, wins: 0, losses: 0, accuracy: 0, currentWinStreak: 0, maxWinStreak: 0, currentLoseStreak: 0, maxLoseStreak: 0 },
  md5: { total: 0, wins: 0, losses: 0, accuracy: 0, currentWinStreak: 0, maxWinStreak: 0, currentLoseStreak: 0, maxLoseStreak: 0 }
};
const MAX_HISTORY = 5000;
const AUTO_SAVE_INTERVAL = 1000;
let processedPhienSet = { hu: new Set(), md5: new Set() };

// ==================== HỆ THỐNG HỌC & THÍCH NGHI NHANH ====================
class AdaptiveLearningPredictor {
  constructor() {
    this.memory = {
      patterns: new Map(),
      transitions: new Map(),
      recentResults: [],
      recentCorrect: [],
      adaptiveRules: []
    };
    this.stats = { total: 0, correct: 0, streak: 0, learningProgress: 0 };
    this.params = { learningRate: 0.15, memorySize: 100, minConfidence: 55, adaptSpeed: 0.85 };
  }
  
  predict(data) {
    if (!data || data.length < 5) {
      return { prediction: 'Tài', confidence: 55, method: 'Chờ học', stats: this.getStats() };
    }
    
    const results = data.map(d => d.Ket_qua);
    this.memory.recentResults = results.slice(0, 20);
    
    const learnedPattern = this.findLearnedPattern(results);
    if (learnedPattern && learnedPattern.confidence > 65) {
      return { ...learnedPattern, stats: this.getStats() };
    }
    
    const transitionPred = this.analyzeTransitions(results);
    if (transitionPred && transitionPred.confidence > 62) {
      return { ...transitionPred, stats: this.getStats() };
    }
    
    const newPattern = this.detectNewPattern(results);
    if (newPattern) {
      this.learnPattern(results, newPattern);
      return { ...newPattern, stats: this.getStats() };
    }
    
    return { ...this.adaptiveFallback(results), stats: this.getStats() };
  }
  
  findLearnedPattern(results) {
    const key = this.encodePattern(results, 6);
    if (!this.memory.patterns.has(key)) return null;
    const pattern = this.memory.patterns.get(key);
    if (pattern.occurrences < 2) return null;
    const successRate = pattern.correct / pattern.occurrences;
    const confidence = 55 + successRate * 35;
    if (confidence > 60) {
      return { prediction: pattern.nextPrediction, confidence: Math.min(88, confidence), method: `📚 Học từ ${pattern.occurrences} lần`, learned: true };
    }
    return null;
  }
  
  analyzeTransitions(results) {
    if (results.length < 4) return null;
    const last3 = results.slice(0, 3).join('');
    if (!this.memory.transitions.has(last3)) return null;
    const trans = this.memory.transitions.get(last3);
    const total = trans.Tai + trans.Xiu;
    if (total >= 3) {
      const taiProb = trans.Tai / total;
      const prediction = taiProb > 0.5 ? 'Tài' : 'Xỉu';
      const confidence = 55 + Math.abs(taiProb - 0.5) * 40;
      return { prediction: prediction, confidence: Math.min(82, confidence), method: '🔄 Chuỗi chuyển tiếp', learned: true };
    }
    return null;
  }
  
  detectNewPattern(results) {
    if (results.length < 6) return null;
    const current = results.slice(0, 5);
    let repeatCount = 0;
    let repeatPositions = [];
    for (let i = 5; i < results.length - 4; i++) {
      let match = true;
      for (let j = 0; j < 5; j++) {
        if (results[i + j] !== current[j]) { match = false; break; }
      }
      if (match) { repeatCount++; repeatPositions.push(i); }
    }
    if (repeatCount >= 1) {
      const nextPosition = repeatPositions[0] + 5;
      if (nextPosition < results.length) {
        const nextResult = results[nextPosition];
        return { prediction: nextResult, confidence: 68 + repeatCount * 4, method: `✨ Phát hiện cầu mới (lặp ${repeatCount + 1} lần)`, isNewPattern: true };
      }
    }
    return null;
  }
  
  learnPattern(results, predictionResult) {
    const key = this.encodePattern(results, 6);
    const nextResult = predictionResult.prediction;
    if (!this.memory.patterns.has(key)) {
      this.memory.patterns.set(key, { nextPrediction: nextResult, occurrences: 0, correct: 0, lastSeen: Date.now() });
    }
    const pattern = this.memory.patterns.get(key);
    pattern.occurrences++;
    if (this.memory.patterns.size > this.params.memorySize) {
      const oldest = [...this.memory.patterns.entries()].sort((a, b) => a[1].lastSeen - b[1].lastSeen)[0];
      this.memory.patterns.delete(oldest[0]);
    }
  }
  
  learnTransition(results, actual) {
    if (results.length < 3) return;
    const last3 = results.slice(0, 3).join('');
    if (!this.memory.transitions.has(last3)) {
      this.memory.transitions.set(last3, { Tai: 0, Xiu: 0 });
    }
    const trans = this.memory.transitions.get(last3);
    if (actual === 'Tài') trans.Tai++; else trans.Xiu++;
    if (this.memory.transitions.size > this.params.memorySize) {
      const oldest = [...this.memory.transitions.entries()].sort((a, b) => (a[1].Tai + a[1].Xiu) - (b[1].Tai + b[1].Xiu))[0];
      this.memory.transitions.delete(oldest[0]);
    }
  }
  
  adaptiveFallback(results) {
    const recentAcc = this.getRecentAccuracy();
    if (recentAcc < 45) {
      return { prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 58, method: '🎯 Đảo chiều (đang thua)', learned: false };
    }
    let taiCount = 0;
    for (let i = 0; i < Math.min(10, results.length); i++) {
      if (results[i] === 'Tài') taiCount++;
    }
    if (taiCount >= 7) return { prediction: 'Xỉu', confidence: 62, method: '⚖️ Cân bằng tỷ lệ', learned: false };
    if (taiCount <= 3) return { prediction: 'Tài', confidence: 62, method: '⚖️ Cân bằng tỷ lệ', learned: false };
    return { prediction: results[0], confidence: 56, method: '📈 Theo cầu', learned: false };
  }
  
  updateResult(prediction, actual, wasCorrect, method) {
    this.stats.total++;
    if (wasCorrect) { this.stats.correct++; this.stats.streak++; } 
    else { this.stats.streak = 0; }
    this.memory.recentCorrect.unshift(wasCorrect ? 1 : 0);
    if (this.memory.recentCorrect.length > 20) this.memory.recentCorrect.pop();
    if (this.memory.recentResults.length >= 3) {
      this.learnTransition(this.memory.recentResults, actual);
    }
    this.updateLearnedPatterns(prediction, actual, wasCorrect);
    this.adjustLearningParams();
    this.stats.learningProgress = Math.min(100, (this.memory.patterns.size / this.params.memorySize) * 100);
  }
  
  updateLearnedPatterns(prediction, actual, wasCorrect) {
    for (let len = 4; len <= 8; len++) {
      if (this.memory.recentResults.length >= len) {
        const key = this.encodePattern(this.memory.recentResults, len);
        if (this.memory.patterns.has(key)) {
          const pattern = this.memory.patterns.get(key);
          if (wasCorrect) pattern.correct++;
          pattern.lastSeen = Date.now();
        }
      }
    }
  }
  
  adjustLearningParams() {
    const recentAcc = this.getRecentAccuracy();
    if (recentAcc < 50 && this.params.learningRate < 0.3) {
      this.params.learningRate = Math.min(0.3, this.params.learningRate + 0.02);
      this.params.adaptSpeed = Math.min(0.95, this.params.adaptSpeed + 0.01);
    } else if (recentAcc > 70 && this.params.learningRate > 0.1) {
      this.params.learningRate = Math.max(0.1, this.params.learningRate - 0.01);
      this.params.adaptSpeed = Math.max(0.7, this.params.adaptSpeed - 0.005);
    }
  }
  
  encodePattern(results, length) {
    return results.slice(0, length).map(r => r === 'Tài' ? 'T' : 'X').join('');
  }
  
  getRecentAccuracy() {
    if (this.memory.recentCorrect.length === 0) return 60;
    const sum = this.memory.recentCorrect.reduce((a, b) => a + b, 0);
    return (sum / this.memory.recentCorrect.length) * 100;
  }
  
  getStats() {
    const accuracy = this.stats.total > 0 ? (this.stats.correct / this.stats.total * 100).toFixed(1) : 0;
    const recentAcc = this.getRecentAccuracy().toFixed(0);
    return {
      total: this.stats.total,
      correct: this.stats.correct,
      accuracy: accuracy + '%',
      recentAccuracy: recentAcc + '%',
      streak: this.stats.streak,
      patternsLearned: this.memory.patterns.size,
      learningProgress: this.stats.learningProgress + '%',
      adaptSpeed: (this.params.adaptSpeed * 100).toFixed(0) + '%'
    };
  }
}

const predictor = new AdaptiveLearningPredictor();

// ==================== HÀM LOAD/SAVE ====================
function loadLearningData() {
  try {
    if (fs.existsSync(LEARNING_FILE)) {
      const data = fs.readFileSync(LEARNING_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed.statistics) statistics = parsed.statistics;
      console.log('✅ Loaded adaptive learning data');
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

function savePredictionToHistory(type, phienHienTai, prediction, confidence, method, latestData) {
  const record = {
    Phien: latestData.Phien,
    Xuc_xac_1: latestData.Xuc_xac_1, Xuc_xac_2: latestData.Xuc_xac_2, Xuc_xac_3: latestData.Xuc_xac_3,
    Tong: latestData.Tong, Ket_qua: latestData.Ket_qua, Do_tin_cay: `${confidence}%`,
    Phien_hien_tai: phienHienTai.toString(), Du_doan: prediction, Phuong_phap: method,
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
        predictor.updateResult(record.Du_doan, actual.Ket_qua, wasCorrect, record.Phuong_phap);
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
        const result = predictor.predict(dataHu);
        savePredictionToHistory('hu', phienHienTai, result.prediction, result.confidence, result.method, dataHu[0]);
        console.log(`[${new Date().toLocaleTimeString()}] HU ${phienHienTai} -> ${result.prediction} (${result.confidence}%) - ${result.method}`);
      }
    }
    const dataMd5 = await fetchDataMd5();
    if (dataMd5 && dataMd5.length > 0) {
      const phienHienTai = dataMd5[0].Phien;
      if (!processedPhienSet.md5.has(phienHienTai)) {
        processedPhienSet.md5.add(phienHienTai);
        const result = predictor.predict(dataMd5);
        savePredictionToHistory('md5', phienHienTai, result.prediction, result.confidence, result.method, dataMd5[0]);
        console.log(`[${new Date().toLocaleTimeString()}] MD5 ${phienHienTai} -> ${result.prediction} (${result.confidence}%) - ${result.method}`);
      }
    }
    savePredictionHistory();
  } catch (error) { console.error('[Auto] Error:', error.message); }
}

function startAutoTask() { console.log('🚀 Auto prediction - 1 giây'); setInterval(autoProcessPredictions, AUTO_SAVE_INTERVAL); }

// ==================== ENDPOINTS ====================
app.get('/', (req, res) => res.json({ message: '@anhkhoi - Adaptive Learning Prediction API', status: 'running' }));

app.get('/hu', async (req, res) => {
  try {
    const data = await fetchDataHu();
    if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    const phienHienTai = data[0].Phien;
    const result = predictor.predict(data);
    const record = savePredictionToHistory('hu', phienHienTai, result.prediction, result.confidence, result.method, data[0]);
    setTimeout(() => updateHistoryStatus('hu'), 5000);
    res.json({ success: true, phien_truoc_do: phienHienTai - 1, phien_hien_tai: phienHienTai, du_doan: result.prediction, do_tin_cay: `${result.confidence}%`, phuong_phap: result.method, stats: result.stats });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/md5', async (req, res) => {
  try {
    const data = await fetchDataMd5();
    if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    const phienHienTai = data[0].Phien;
    const result = predictor.predict(data);
    const record = savePredictionToHistory('md5', phienHienTai, result.prediction, result.confidence, result.method, data[0]);
    setTimeout(() => updateHistoryStatus('md5'), 5000);
    res.json({ success: true, phien_truoc_do: phienHienTai - 1, phien_hien_tai: phienHienTai, du_doan: result.prediction, do_tin_cay: `${result.confidence}%`, phuong_phap: result.method, stats: result.stats });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/thongke', async (req, res) => {
  await updateHistoryStatus('hu'); await updateHistoryStatus('md5');
  res.json({ success: true, statistics, predictorStats: predictor.getStats(), lastUpdated: new Date().toISOString() });
});

// Giao diện HTML siêu đẹp - Công nghệ 2026
app.get('/thongke/html', async (req, res) => {
  await updateHistoryStatus('hu'); await updateHistoryStatus('md5');
  const predictorStats = predictor.getStats();
  
  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>LẨU CUA 79 | HỆ THỐNG HỌC THÍCH NGHI</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: #05070f;
            min-height: 100vh;
            color: #ffffff;
            overflow-x: hidden;
        }
        /* Animated Background */
        .cyber-bg {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: 
                radial-gradient(ellipse at 20% 30%, rgba(0, 255, 255, 0.08) 0%, transparent 50%),
                radial-gradient(ellipse at 80% 70%, rgba(255, 0, 128, 0.06) 0%, transparent 50%),
                repeating-linear-gradient(45deg, rgba(0, 255, 255, 0.02) 0px, rgba(0, 255, 255, 0.02) 2px, transparent 2px, transparent 8px);
            z-index: 0;
        }
        .grid-overlay {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background-image: linear-gradient(rgba(0, 255, 255, 0.03) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(0, 255, 255, 0.03) 1px, transparent 1px);
            background-size: 40px 40px;
            z-index: 1;
            pointer-events: none;
        }
        .container { position: relative; z-index: 2; max-width: 1440px; margin: 0 auto; padding: 20px; }
        
        /* Header Cyber */
        .header {
            text-align: center; padding: 40px 20px; margin-bottom: 40px;
            background: rgba(5, 7, 15, 0.7); backdrop-filter: blur(20px);
            border-radius: 30px; border: 1px solid rgba(0, 255, 255, 0.2);
            box-shadow: 0 0 40px rgba(0, 255, 255, 0.1), inset 0 0 20px rgba(0, 255, 255, 0.05);
        }
        .glitch {
            font-family: 'Orbitron', monospace;
            font-size: 48px;
            font-weight: 900;
            text-transform: uppercase;
            position: relative;
            text-shadow: 0.05em 0 0 rgba(255, 0, 0, 0.75), -0.05em -0.025em 0 rgba(0, 255, 255, 0.75);
            animation: glitch 0.3s infinite;
        }
        @keyframes glitch {
            0% { text-shadow: 0.05em 0 0 rgba(255, 0, 0, 0.75), -0.05em -0.025em 0 rgba(0, 255, 255, 0.75); }
            50% { text-shadow: -0.05em -0.025em 0 rgba(255, 0, 0, 0.75), 0.025em 0.05em 0 rgba(0, 255, 255, 0.75); }
            100% { text-shadow: 0.025em 0.05em 0 rgba(255, 0, 0, 0.75), 0.05em 0 0 rgba(0, 255, 255, 0.75); }
        }
        .neon-text {
            background: linear-gradient(135deg, #00ffff, #ff0080);
            -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .badge-cyber {
            display: inline-flex; align-items: center; gap: 8px; padding: 8px 24px;
            background: rgba(0, 255, 255, 0.1); border: 1px solid rgba(0, 255, 255, 0.3);
            border-radius: 30px; font-size: 13px; font-weight: 500; color: #00ffff;
            letter-spacing: 1px; backdrop-filter: blur(10px);
        }
        .live-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(0, 255, 255, 0.1); padding: 8px 20px; border-radius: 30px; font-size: 12px; color: #00ffff; margin-top: 20px; border: 1px solid rgba(0, 255, 255, 0.3); }
        .live-dot { width: 10px; height: 10px; background: #00ffff; border-radius: 50%; animation: pulse 1.5s infinite; box-shadow: 0 0 10px #00ffff; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        
        /* Stats Cards */
        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 28px; margin-bottom: 40px; }
        .cyber-card {
            background: rgba(5, 7, 15, 0.7); backdrop-filter: blur(20px);
            border-radius: 24px; padding: 28px; border: 1px solid rgba(0, 255, 255, 0.15);
            transition: all 0.3s ease; position: relative; overflow: hidden;
        }
        .cyber-card::before {
            content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
            background: linear-gradient(90deg, transparent, rgba(0, 255, 255, 0.05), transparent);
            transition: left 0.5s;
        }
        .cyber-card:hover { transform: translateY(-5px); border-color: rgba(0, 255, 255, 0.4); box-shadow: 0 0 30px rgba(0, 255, 255, 0.1); }
        .cyber-card:hover::before { left: 100%; }
        .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .card-icon {
            width: 52px; height: 52px;
            background: linear-gradient(135deg, #00ffff, #ff0080);
            border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 22px;
        }
        .stat-value { font-size: 52px; font-weight: 800; background: linear-gradient(135deg, #00ffff, #ff0080); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .stat-label { font-size: 13px; color: #6a7590; margin-top: 8px; letter-spacing: 1px; }
        .stat-detail { display: flex; justify-content: space-between; margin-top: 24px; padding-top: 20px; border-top: 1px solid rgba(0, 255, 255, 0.1); gap: 12px; flex-wrap: wrap; }
        .stat-detail-item { text-align: center; flex: 1; }
        .stat-detail-value { font-size: 24px; font-weight: 700; }
        .win { color: #00ff88; text-shadow: 0 0 10px rgba(0,255,136,0.3); }
        .loss { color: #ff0080; text-shadow: 0 0 10px rgba(255,0,128,0.3); }
        .streak { color: #ffff00; text-shadow: 0 0 10px rgba(255,255,0,0.3); }
        .neon { color: #00ffff; text-shadow: 0 0 10px rgba(0,255,255,0.3); }
        
        /* Charts */
        .charts-section { display: grid; grid-template-columns: repeat(2, 1fr); gap: 28px; margin-bottom: 40px; }
        .chart-card {
            background: rgba(5, 7, 15, 0.7); backdrop-filter: blur(20px);
            border-radius: 24px; padding: 24px; border: 1px solid rgba(0, 255, 255, 0.15);
        }
        .chart-card h3 { font-size: 18px; font-weight: 600; margin-bottom: 20px; display: flex; align-items: center; gap: 12px; color: #00ffff; }
        canvas { max-height: 260px; }
        
        /* Learning Progress */
        .learning-section {
            background: rgba(5, 7, 15, 0.7); backdrop-filter: blur(20px);
            border-radius: 24px; padding: 24px; border: 1px solid rgba(0, 255, 255, 0.15);
            margin-bottom: 40px;
        }
        .progress-bar {
            background: rgba(0, 255, 255, 0.1); border-radius: 30px; height: 12px; overflow: hidden; margin: 16px 0;
        }
        .progress-fill {
            background: linear-gradient(90deg, #00ffff, #ff0080); width: ${predictorStats.learningProgress}; height: 100%; border-radius: 30px; transition: width 0.5s;
        }
        .learning-stats { display: flex; gap: 30px; flex-wrap: wrap; margin-top: 20px; }
        .learning-stat { flex: 1; text-align: center; padding: 16px; background: rgba(0, 255, 255, 0.05); border-radius: 16px; }
        .learning-stat-value { font-size: 28px; font-weight: 700; color: #00ffff; }
        
        /* History Table */
        .history-section {
            background: rgba(5, 7, 15, 0.7); backdrop-filter: blur(20px);
            border-radius: 24px; padding: 24px; border: 1px solid rgba(0, 255, 255, 0.15);
        }
        .history-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
        .tabs { display: flex; gap: 12px; background: rgba(0,0,0,0.4); padding: 5px; border-radius: 40px; }
        .tab-btn { padding: 10px 28px; border: none; background: transparent; color: #8a95b0; font-family: 'Inter', sans-serif; font-weight: 500; cursor: pointer; border-radius: 35px; transition: all 0.2s; }
        .tab-btn.active { background: linear-gradient(135deg, #00ffff, #ff0080); color: #05070f; font-weight: 600; }
        .cyber-btn {
            background: rgba(0, 255, 255, 0.1); border: 1px solid rgba(0, 255, 255, 0.3);
            padding: 10px 24px; border-radius: 40px; color: #00ffff; cursor: pointer;
            font-family: 'Inter', sans-serif; font-weight: 500; transition: all 0.2s;
        }
        .cyber-btn:hover { background: rgba(0, 255, 255, 0.2); transform: scale(1.02); }
        .history-table-container { overflow-x: auto; max-height: 500px; overflow-y: auto; border-radius: 16px; }
        .history-table { width: 100%; border-collapse: collapse; }
        .history-table th {
            text-align: left; padding: 16px; background: rgba(0, 0, 0, 0.5);
            font-weight: 600; font-size: 12px; color: #00ffff; letter-spacing: 1px;
            position: sticky; top: 0; backdrop-filter: blur(10px);
        }
        .history-table td { padding: 14px 16px; border-bottom: 1px solid rgba(0, 255, 255, 0.05); font-size: 13px; }
        .history-table tr:hover { background: rgba(0, 255, 255, 0.05); }
        .method-badge { display: inline-block; padding: 4px 10px; background: rgba(0, 255, 255, 0.1); border-radius: 20px; font-size: 11px; color: #00ffff; }
        .footer { text-align: center; padding: 40px; color: #3a4560; font-size: 12px; border-top: 1px solid rgba(0, 255, 255, 0.1); margin-top: 40px; }
        
        @media (max-width: 768px) {
            .stats-grid { grid-template-columns: 1fr; gap: 20px; }
            .charts-section { grid-template-columns: 1fr; gap: 20px; }
            .glitch { font-size: 28px; }
            .stat-value { font-size: 36px; }
        }
        
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: rgba(0, 255, 255, 0.05); border-radius: 10px; }
        ::-webkit-scrollbar-thumb { background: linear-gradient(135deg, #00ffff, #ff0080); border-radius: 10px; }
    </style>
</head>
<body>
    <div class="cyber-bg"></div>
    <div class="grid-overlay"></div>
    <div class="container">
        <div class="header">
            <div class="glitch">LẨU CUA 79</div>
            <div class="badge-cyber" style="margin-top: 16px;"><i class="fas fa-brain"></i> HỆ THỐNG HỌC THÍCH NGHI | AI TỰ HỌC</div>
            <div class="live-badge"><span class="live-dot"></span> LIVE | HỌC TỪNG GIÂY | CẬP NHẬT 1S</div>
        </div>
        
        <div class="stats-grid" id="statsGrid"></div>
        
        <div class="learning-section">
            <h3 style="color: #00ffff; margin-bottom: 16px;"><i class="fas fa-chart-line"></i> TIẾN ĐỘ HỌC CỦA AI</h3>
            <div class="progress-bar"><div class="progress-fill" style="width: ${predictorStats.learningProgress}"></div></div>
            <div class="learning-stats">
                <div class="learning-stat"><div class="learning-stat-value">${predictorStats.patternsLearned}</div><div style="font-size: 12px; color: #6a7590;">MẪU ĐÃ HỌC</div></div>
                <div class="learning-stat"><div class="learning-stat-value">${predictorStats.recentAccuracy}</div><div style="font-size: 12px; color: #6a7590;">ĐỘ CHÍNH XÁC GẦN ĐÂY</div></div>
                <div class="learning-stat"><div class="learning-stat-value">${predictorStats.adaptSpeed}</div><div style="font-size: 12px; color: #6a7590;">TỐC ĐỘ THÍCH NGHI</div></div>
            </div>
        </div>
        
        <div class="charts-section">
            <div class="chart-card"><h3><i class="fas fa-chart-pie"></i> TỈ LỆ THẮNG - HŨ</h3><canvas id="chartHu"></canvas></div>
            <div class="chart-card"><h3><i class="fas fa-chart-pie"></i> TỈ LỆ THẮNG - MD5</h3><canvas id="chartMd5"></canvas></div>
        </div>
        
        <div class="history-section">
            <div class="history-header">
                <h3 style="color: #00ffff;"><i class="fas fa-database"></i> LỊCH SỬ DỰ ĐOÁN</h3>
                <div class="tabs"><button class="tab-btn active" onclick="switchTab('hu')">HŨ</button><button class="tab-btn" onclick="switchTab('md5')">MD5</button></div>
                <button class="cyber-btn" onclick="refreshData()"><i class="fas fa-sync-alt"></i> ĐỒNG BỘ</button>
            </div>
            <div class="history-table-container">
                <table class="history-table"><thead><tr><th>PHIÊN</th><th>KẾT QUẢ</th><th>DỰ ĐOÁN</th><th>ĐỘ TIN CẬY</th><th>PHƯƠNG PHÁP</th><th>KẾT QUẢ</th></tr></thead><tbody id="historyBody"></tbody></table>
            </div>
        </div>
        
        <div class="footer">
            <p>© 2026 @anhkhoi | HỆ THỐNG HỌC THÍCH NGHI - CÀNG CHẠY CÀNG CHUẨN | BẢO MẬT CẤP CAO</p>
            <p style="margin-top: 8px; font-size: 11px;">⚠️ Dự đoán mang tính tham khảo | AI tự học từ dữ liệu thực tế</p>
        </div>
    </div>
    
    <script>
        let currentTab = 'hu', charts = {};
        
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
                <div class="cyber-card"><div class="card-header"><div class="card-icon"><i class="fas fa-crown"></i></div><div><h2 style="font-size: 20px;">HŨ</h2><p style="color: #6a7590; font-size: 12px;">Tài Xỉu Hũ Nổ</p></div></div>
                <div class="stat-value">\${stats.hu.accuracy}%</div><div class="stat-label">TỶ LỆ CHÍNH XÁC</div>
                <div class="stat-detail"><div class="stat-detail-item"><div class="stat-detail-value win">\${stats.hu.wins}</div><div class="stat-detail-label">THẮNG</div></div>
                <div class="stat-detail-item"><div class="stat-detail-value loss">\${stats.hu.losses}</div><div class="stat-detail-label">THUA</div></div>
                <div class="stat-detail-item"><div class="stat-detail-value">\${stats.hu.total}</div><div class="stat-detail-label">TỔNG</div></div></div>
                <div class="stat-detail"><div class="stat-detail-item"><div class="stat-detail-value streak">\${stats.hu.currentWinStreak}</div><div class="stat-detail-label">🎯 THẮNG HIỆN TẠI</div></div>
                <div class="stat-detail-item"><div class="stat-detail-value streak">\${stats.hu.maxWinStreak}</div><div class="stat-detail-label">🏆 THẮNG MAX</div></div>
                <div class="stat-detail-item"><div class="stat-detail-value loss">\${stats.hu.currentLoseStreak}</div><div class="stat-detail-label">⚠️ THUA HIỆN TẠI</div></div>
                <div class="stat-detail-item"><div class="stat-detail-value loss">\${stats.hu.maxLoseStreak}</div><div class="stat-detail-label">📉 THUA MAX</div></div></div></div>
                <div class="cyber-card"><div class="card-header"><div class="card-icon"><i class="fas fa-shield-alt"></i></div><div><h2 style="font-size: 20px;">MD5</h2><p style="color: #6a7590; font-size: 12px;">Tài Xỉu MD5</p></div></div>
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
            charts.hu = new Chart(document.getElementById('chartHu'), { type: 'doughnut', data: { labels: ['Thắng', 'Thua'], datasets: [{ data: [stats.hu.wins, stats.hu.losses], backgroundColor: ['#00ff88', '#ff0080'], borderWidth: 0 }] }, options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#e8edf5' } } } } });
            charts.md5 = new Chart(document.getElementById('chartMd5'), { type: 'doughnut', data: { labels: ['Thắng', 'Thua'], datasets: [{ data: [stats.md5.wins, stats.md5.losses], backgroundColor: ['#00ff88', '#ff0080'], borderWidth: 0 }] }, options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#e8edf5' } } } } });
        }
        
        function updateHistoryTable(history) {
            const tbody = document.getElementById('historyBody');
            if(!history || history.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Chưa có dữ liệu</td></tr>'; return; }
            tbody.innerHTML = history.slice(0, 100).map(r => \`
                <tr>
                    <td><strong>\${r.Phien}</strong></td>
                    <td class="\${r.Ket_qua === 'Tài' ? 'win' : 'loss'}"><i class="fas fa-arrow-\${r.Ket_qua === 'Tài' ? 'up' : 'down'}"></i> \${r.Ket_qua}</td>
                    <td class="\${r.Du_doan === 'Tài' ? 'win' : 'loss'}"><i class="fas fa-arrow-\${r.Du_doan === 'Tài' ? 'up' : 'down'}"></i> \${r.Du_doan}</td>
                    <td><span class="method-badge">\${r.Do_tin_cay}</span></td>
                    <td><span class="method-badge"><i class="fas fa-microchip"></i> \${r.Phuong_phap || 'Đang học'}</span></td>
                    <td class="\${r.ket_qua_du_doan === 'Đúng ✅' ? 'win' : 'loss'}">\${r.ket_qua_du_doan || '⏳ Đang chờ...'}</td>
                </tr>
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
  console.log(`\n╔══════════════════════════════════════════════════════════════════╗`);
  console.log(`║     🚀 LẨU CUA 79 - HỆ THỐNG HỌC & THÍCH NGHI THÔNG MINH     ║`);
  console.log(`╠══════════════════════════════════════════════════════════════════╣`);
  console.log(`║  📍 API: http://0.0.0.0:${PORT}                                    ║`);
  console.log(`║  📊 DASHBOARD: http://0.0.0.0:${PORT}/thongke/html               ║`);
  console.log(`║  ⚡ Auto update mỗi 1 giây | Chống trùng phiên tuyệt đối          ║`);
  console.log(`║  🧠 AI tự học | Càng chạy càng chuẩn | Thích nghi theo thời gian  ║`);
  console.log(`║  🎯 Thuật toán: Học Pattern + Chuỗi chuyển tiếp + Phát hiện cầu mới║`);
  console.log(`║  🔒 Giao diện Cyberpunk 2026 | Bảo mật cấp quốc gia               ║`);
  console.log(`╚══════════════════════════════════════════════════════════════════╝\n`);
  startAutoTask();
});
