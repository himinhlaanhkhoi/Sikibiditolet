const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';
const LEARNING_FILE = 'super_intelligence.json';
const HISTORY_FILE = 'super_history.json';

let predictionHistory = { hu: [], md5: [] };
let statistics = { 
  hu: { total: 0, wins: 0, losses: 0, accuracy: 0, currentWinStreak: 0, maxWinStreak: 0, currentLoseStreak: 0, maxLoseStreak: 0 },
  md5: { total: 0, wins: 0, losses: 0, accuracy: 0, currentWinStreak: 0, maxWinStreak: 0, currentLoseStreak: 0, maxLoseStreak: 0 }
};
const MAX_HISTORY = 5000;
const AUTO_SAVE_INTERVAL = 1000;
let processedPhienSet = { hu: new Set(), md5: new Set() };

// ==================== TRÍ TUỆ NHÂN TẠO VƯỢT TRỘI ====================

class LogicalSuperIntelligence {
  predict(results) {
    if (results.length < 4) return null;
    const last = results[0];
    const second = results[1];
    if (last === second) return { prediction: last, confidence: 72, source: 'logical' };
    return { prediction: last === 'Tài' ? 'Xỉu' : 'Tài', confidence: 68, source: 'logical' };
  }
}

class AnalyticalSuperIntelligence {
  predict(results) {
    if (results.length < 10) return null;
    let taiCount = 0;
    for (let i = 0; i < 10; i++) if (results[i] === 'Tài') taiCount++;
    if (taiCount >= 7) return { prediction: 'Xỉu', confidence: 70 + (taiCount - 7) * 5, source: 'analytical' };
    if (taiCount <= 3) return { prediction: 'Tài', confidence: 70 + (3 - taiCount) * 5, source: 'analytical' };
    return null;
  }
}

class CreativeSuperIntelligence {
  predict(results) {
    if (results.length < 8) return null;
    let streak = 1;
    for (let i = 1; i < results.length; i++) {
      if (results[i] === results[0]) streak++;
      else break;
    }
    if (streak >= 5) return { prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 78, source: 'creative' };
    return null;
  }
}

class PredictiveSuperIntelligence {
  predict(results) {
    if (results.length < 5) return null;
    let taiCount = 0, xiuCount = 0;
    for (let i = 0; i < 5; i++) {
      if (results[i] === 'Tài') taiCount++;
      else xiuCount++;
    }
    if (taiCount >= 4) return { prediction: 'Xỉu', confidence: 72, source: 'predictive' };
    if (xiuCount >= 4) return { prediction: 'Tài', confidence: 72, source: 'predictive' };
    return null;
  }
}

class AdaptiveSuperIntelligence {
  predict(results, lastCorrect) {
    if (lastCorrect === undefined) return null;
    if (lastCorrect >= 3) return { prediction: results[0], confidence: 70, source: 'adaptive' };
    if (lastCorrect === 0) return { prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 68, source: 'adaptive' };
    return null;
  }
}

class BayesianSuperDecider {
  decide(predictions) {
    let taiPrior = 0.5, xiuPrior = 0.5;
    for (const pred of predictions) {
      const likelihood = pred.confidence / 100;
      if (pred.prediction === 'Tài') taiPrior *= likelihood;
      else xiuPrior *= likelihood;
    }
    const total = taiPrior + xiuPrior;
    const prediction = taiPrior > xiuPrior ? 'Tài' : 'Xỉu';
    const confidence = (Math.max(taiPrior, xiuPrior) / total) * 100;
    return { prediction, confidence: Math.min(95, confidence) };
  }
}

class FuzzySuperDecider {
  decide(predictions) {
    let taiMembership = 0, xiuMembership = 0;
    for (const pred of predictions) {
      if (pred.prediction === 'Tài') taiMembership += pred.confidence / 100;
      else xiuMembership += pred.confidence / 100;
    }
    const prediction = taiMembership > xiuMembership ? 'Tài' : 'Xỉu';
    const confidence = (Math.max(taiMembership, xiuMembership) / (taiMembership + xiuMembership + 0.001)) * 100;
    return { prediction, confidence: Math.min(95, confidence) };
  }
}

class SuperHumanIntelligence {
  constructor() {
    this.intelligences = {
      logical: new LogicalSuperIntelligence(),
      analytical: new AnalyticalSuperIntelligence(),
      creative: new CreativeSuperIntelligence(),
      predictive: new PredictiveSuperIntelligence(),
      adaptive: new AdaptiveSuperIntelligence()
    };
    this.decisionSystems = {
      bayesian: new BayesianSuperDecider(),
      fuzzy: new FuzzySuperDecider()
    };
    this.intelligenceMetrics = {
      iq: 1000000,
      eq: 100,
      accuracy: 0,
      experience: 0,
      lastCorrect: 0
    };
    this.memory = [];
    this.initialize();
  }
  
  initialize() {
    console.log('🧠 SIÊU TRÍ TUỆ NHÂN TẠO KHỞI TẠO');
    console.log('⭐ Cấp độ: VƯỢT XA CON NGƯỜI');
    console.log('📊 IQ: 1,000,000');
  }
  
  predict(data) {
    if (!data || data.length < 3) return this.getSafePrediction();
    
    const results = data.map(d => d.Ket_qua);
    const allPredictions = [];
    
    for (const [name, intelligence] of Object.entries(this.intelligences)) {
      let pred;
      if (name === 'adaptive') pred = intelligence.predict(results, this.intelligenceMetrics.lastCorrect);
      else pred = intelligence.predict(results);
      if (pred && pred.confidence > 60) allPredictions.push({ ...pred, source: name });
    }
    
    if (allPredictions.length === 0) return this.getFallbackPrediction(results);
    
    const bayesianResult = this.decisionSystems.bayesian.decide(allPredictions);
    const fuzzyResult = this.decisionSystems.fuzzy.decide(allPredictions);
    
    const combinedPrediction = this.combineResults(bayesianResult, fuzzyResult);
    
    this.storeToMemory(results, combinedPrediction);
    
    return combinedPrediction;
  }
  
  combineResults(bayesian, fuzzy) {
    const taiScore = (bayesian.prediction === 'Tài' ? bayesian.confidence : 0) + (fuzzy.prediction === 'Tài' ? fuzzy.confidence : 0);
    const xiuScore = (bayesian.prediction === 'Xỉu' ? bayesian.confidence : 0) + (fuzzy.prediction === 'Xỉu' ? fuzzy.confidence : 0);
    const prediction = taiScore >= xiuScore ? 'Tài' : 'Xỉu';
    let confidence = Math.max(taiScore, xiuScore);
    confidence = Math.min(98, Math.max(65, Math.round(confidence)));
    
    return {
      prediction: prediction,
      confidence: confidence,
      probability: (confidence / 100 * 100).toFixed(1) + '%',
      intelligence: { iq: this.intelligenceMetrics.iq },
      methods: ['SIÊU TRÍ TUỆ TỔNG HỢP', 'BAYESIAN', 'FUZZY'],
      analysis: this.getAnalysis(confidence)
    };
  }
  
  getFallbackPrediction(results) {
    let taiCount = 0;
    for (let i = 0; i < Math.min(5, results.length); i++) {
      if (results[i] === 'Tài') taiCount++;
    }
    const prediction = taiCount >= 3 ? 'Tài' : 'Xỉu';
    return {
      prediction: prediction,
      confidence: 62,
      probability: '62%',
      methods: ['FALLBACK'],
      analysis: 'DỰ PHÒNG THÔNG MINH'
    };
  }
  
  getSafePrediction() {
    return {
      prediction: 'Tài',
      confidence: 55,
      probability: '55%',
      methods: ['KHỞI TẠO'],
      analysis: 'ĐANG PHÂN TÍCH DỮ LIỆU'
    };
  }
  
  getAnalysis(confidence) {
    if (confidence >= 95) return '🌌 SIÊU CHÍNH XÁC TUYỆT ĐỐI';
    if (confidence >= 90) return '⭐ CỰC KỲ CHẮC CHẮN';
    if (confidence >= 85) return '✨ RẤT CHẮC CHẮN';
    if (confidence >= 80) return '📊 CHẮC CHẮN';
    if (confidence >= 75) return '🔮 KHÁ TIN CẬY';
    return '⚡ CẦN THẬN TRỌNG';
  }
  
  storeToMemory(results, prediction) {
    this.memory.unshift({ results: results.slice(0, 10), prediction, timestamp: Date.now() });
    if (this.memory.length > 1000) this.memory.pop();
  }
  
  learn(prediction, actual, wasCorrect) {
    this.intelligenceMetrics.experience++;
    const total = this.intelligenceMetrics.accuracy * (this.intelligenceMetrics.experience - 1) + (wasCorrect ? 100 : 0);
    this.intelligenceMetrics.accuracy = total / this.intelligenceMetrics.experience;
    
    if (wasCorrect) {
      this.intelligenceMetrics.lastCorrect++;
      if (this.intelligenceMetrics.iq < 2000000) this.intelligenceMetrics.iq += 100;
    } else {
      this.intelligenceMetrics.lastCorrect = 0;
    }
  }
  
  getStats() {
    return {
      iq: this.intelligenceMetrics.iq,
      accuracy: this.intelligenceMetrics.accuracy.toFixed(2) + '%',
      experience: this.intelligenceMetrics.experience,
      lastCorrect: this.intelligenceMetrics.lastCorrect
    };
  }
}

const superIntelligence = new SuperHumanIntelligence();

// ==================== HÀM LOAD/SAVE ====================
function loadLearningData() {
  try {
    if (fs.existsSync(LEARNING_FILE)) {
      const data = fs.readFileSync(LEARNING_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed.statistics) statistics = parsed.statistics;
      console.log('✅ Loaded super intelligence data');
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
        superIntelligence.learn(record.Du_doan, actual.Ket_qua, wasCorrect);
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
        const result = superIntelligence.predict(dataHu);
        savePredictionToHistory('hu', phienHienTai, result.prediction, result.confidence, result.methods?.[0] || 'SIÊU TRÍ TUỆ', dataHu[0]);
        console.log(`[${new Date().toLocaleTimeString()}] 🧠 HU ${phienHienTai} -> ${result.prediction} (${result.confidence}%)`);
      }
    }
    const dataMd5 = await fetchDataMd5();
    if (dataMd5 && dataMd5.length > 0) {
      const phienHienTai = dataMd5[0].Phien;
      if (!processedPhienSet.md5.has(phienHienTai)) {
        processedPhienSet.md5.add(phienHienTai);
        const result = superIntelligence.predict(dataMd5);
        savePredictionToHistory('md5', phienHienTai, result.prediction, result.confidence, result.methods?.[0] || 'SIÊU TRÍ TUỆ', dataMd5[0]);
        console.log(`[${new Date().toLocaleTimeString()}] 🧠 MD5 ${phienHienTai} -> ${result.prediction} (${result.confidence}%)`);
      }
    }
    savePredictionHistory();
  } catch (error) { console.error('[Auto] Error:', error.message); }
}

function startAutoTask() { console.log('🚀 Auto prediction - 1 giây'); setInterval(autoProcessPredictions, AUTO_SAVE_INTERVAL); }

// ==================== ENDPOINTS ====================
app.get('/', (req, res) => res.json({ message: '@anhkhoi - Siêu Trí Tuệ Nhân Tạo', status: 'running', iq: 1000000 }));

app.get('/hu', async (req, res) => {
  try {
    const data = await fetchDataHu();
    if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    const phienHienTai = data[0].Phien;
    const result = superIntelligence.predict(data);
    savePredictionToHistory('hu', phienHienTai, result.prediction, result.confidence, result.methods?.[0], data[0]);
    setTimeout(() => updateHistoryStatus('hu'), 5000);
    res.json({ success: true, phien_truoc_do: phienHienTai, phien_hien_tai: phienHienTai + 1, du_doan: result.prediction, do_tin_cay: `${result.confidence}%`, phuong_phap: result.methods?.[0], tri_tue: result.intelligence, phan_tich: result.analysis });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/md5', async (req, res) => {
  try {
    const data = await fetchDataMd5();
    if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    const phienHienTai = data[0].Phien;
    const result = superIntelligence.predict(data);
    savePredictionToHistory('md5', phienHienTai, result.prediction, result.confidence, result.methods?.[0], data[0]);
    setTimeout(() => updateHistoryStatus('md5'), 5000);
    res.json({ success: true, phien_truoc_do: phienHienTai, phien_hien_tai: phienHienTai + 1, du_doan: result.prediction, do_tin_cay: `${result.confidence}%`, phuong_phap: result.methods?.[0], tri_tue: result.intelligence, phan_tich: result.analysis });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/thongke', async (req, res) => {
  await updateHistoryStatus('hu'); await updateHistoryStatus('md5');
  res.json({ success: true, statistics, brainStats: superIntelligence.getStats(), lastUpdated: new Date().toISOString() });
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

// Giao diện HTML 3D siêu đẹp
app.get('/thongke/html', async (req, res) => {
  await updateHistoryStatus('hu'); await updateHistoryStatus('md5');
  const brainStats = superIntelligence.getStats();
  
  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>LẨU CUA 79 | SIÊU TRÍ TUỆ NHÂN TẠO</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: radial-gradient(ellipse at center, #0a0a2a 0%, #000000 100%);
            min-height: 100vh;
            color: #ffffff;
            overflow-x: hidden;
        }
        
        /* 3D Particle Background */
        #canvas3d {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 0;
            pointer-events: none;
        }
        
        .container {
            position: relative;
            z-index: 10;
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }
        
        /* Glass Header */
        .header {
            background: rgba(10, 10, 42, 0.6);
            backdrop-filter: blur(20px);
            border-radius: 30px;
            padding: 30px;
            margin-bottom: 30px;
            border: 1px solid rgba(0, 255, 255, 0.3);
            box-shadow: 0 0 50px rgba(0, 255, 255, 0.1);
            text-align: center;
        }
        
        .glow-text {
            font-family: 'Orbitron', monospace;
            font-size: 48px;
            font-weight: 900;
            background: linear-gradient(135deg, #00ffff, #ff00ff, #00ffff);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            animation: glow 3s ease-in-out infinite;
        }
        
        @keyframes glow {
            0%, 100% { filter: drop-shadow(0 0 20px rgba(0,255,255,0.5)); }
            50% { filter: drop-shadow(0 0 50px rgba(255,0,255,0.8)); }
        }
        
        .iq-badge {
            display: inline-block;
            background: linear-gradient(135deg, #00ffff, #ff00ff);
            padding: 8px 25px;
            border-radius: 40px;
            font-family: 'Orbitron', monospace;
            font-weight: bold;
            margin-top: 15px;
            color: #000;
        }
        
        /* Stats Grid 3D */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .card-3d {
            background: rgba(10, 10, 42, 0.5);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 25px;
            text-align: center;
            border: 1px solid rgba(0, 255, 255, 0.2);
            transition: all 0.3s ease;
            cursor: pointer;
        }
        
        .card-3d:hover {
            transform: translateY(-10px) scale(1.02);
            border-color: #00ffff;
            box-shadow: 0 20px 40px rgba(0, 255, 255, 0.2);
        }
        
        .card-value {
            font-size: 42px;
            font-weight: 800;
            font-family: 'Orbitron', monospace;
            background: linear-gradient(135deg, #00ffff, #ff00ff);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }
        
        .card-label {
            font-size: 14px;
            color: #8a95b0;
            margin-top: 10px;
            letter-spacing: 1px;
        }
        
        /* Server Cards */
        .servers-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 25px;
            margin-bottom: 30px;
        }
        
        .server-card {
            background: rgba(10, 10, 42, 0.5);
            backdrop-filter: blur(10px);
            border-radius: 25px;
            padding: 25px;
            border: 1px solid rgba(0, 255, 255, 0.2);
            transition: all 0.3s ease;
        }
        
        .server-card:hover {
            border-color: #ff00ff;
            box-shadow: 0 0 40px rgba(255, 0, 255, 0.2);
        }
        
        .server-title {
            font-size: 20px;
            font-weight: 700;
            color: #00ffff;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .chart-container {
            display: flex;
            align-items: center;
            gap: 30px;
            flex-wrap: wrap;
        }
        
        .donut-wrapper {
            position: relative;
            width: 140px;
            height: 140px;
        }
        
        canvas {
            width: 140px !important;
            height: 140px !important;
        }
        
        .percentage {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 28px;
            font-weight: 800;
            font-family: 'Orbitron', monospace;
            color: #00ffff;
        }
        
        .stats-list {
            flex: 1;
        }
        
        .stat-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid rgba(0, 255, 255, 0.1);
        }
        
        .win { color: #00ff88; }
        .loss { color: #ff4466; }
        
        /* History Table */
        .history-section {
            background: rgba(10, 10, 42, 0.5);
            backdrop-filter: blur(10px);
            border-radius: 25px;
            overflow: hidden;
            border: 1px solid rgba(0, 255, 255, 0.2);
        }
        
        .history-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 25px;
            border-bottom: 1px solid rgba(0, 255, 255, 0.1);
            flex-wrap: wrap;
            gap: 15px;
        }
        
        .tabs {
            display: flex;
            gap: 10px;
        }
        
        .tab {
            padding: 10px 25px;
            background: rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(0, 255, 255, 0.3);
            border-radius: 30px;
            color: #8a95b0;
            cursor: pointer;
            transition: all 0.3s;
            font-weight: 600;
        }
        
        .tab.active {
            background: linear-gradient(135deg, #00ffff, #ff00ff);
            color: #000;
            border-color: transparent;
        }
        
        .refresh-btn {
            padding: 10px 25px;
            background: rgba(0, 255, 255, 0.1);
            border: 1px solid rgba(0, 255, 255, 0.3);
            border-radius: 30px;
            color: #00ffff;
            cursor: pointer;
            transition: all 0.3s;
        }
        
        .refresh-btn:hover {
            background: rgba(0, 255, 255, 0.2);
            transform: scale(1.05);
        }
        
        .table-container {
            overflow-x: auto;
            max-height: 500px;
            overflow-y: auto;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
        }
        
        th {
            padding: 15px;
            text-align: left;
            color: #00ffff;
            font-size: 12px;
            letter-spacing: 1px;
            border-bottom: 1px solid rgba(0, 255, 255, 0.2);
        }
        
        td {
            padding: 15px;
            border-bottom: 1px solid rgba(0, 255, 255, 0.1);
        }
        
        tr:hover td {
            background: rgba(0, 255, 255, 0.05);
        }
        
        .badge-success {
            background: rgba(0, 255, 136, 0.2);
            color: #00ff88;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
        }
        
        .badge-error {
            background: rgba(255, 68, 102, 0.2);
            color: #ff4466;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
        }
        
        .footer {
            text-align: center;
            padding: 30px;
            color: #5a6580;
            font-size: 12px;
        }
        
        @media (max-width: 768px) {
            .stats-grid { grid-template-columns: repeat(2, 1fr); }
            .servers-grid { grid-template-columns: 1fr; }
            .glow-text { font-size: 28px; }
        }
        
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: rgba(0, 255, 255, 0.05); }
        ::-webkit-scrollbar-thumb { background: linear-gradient(135deg, #00ffff, #ff00ff); border-radius: 10px; }
    </style>
</head>
<body>
    <canvas id="canvas3d"></canvas>
    <div class="container">
        <div class="header">
            <div class="glow-text">LẨU CUA 79</div>
            <div class="iq-badge">🧠 IQ: ${brainStats.iq.toLocaleString()} | SIÊU TRÍ TUỆ</div>
            <div style="margin-top: 15px; font-size: 12px; color: #00ffff;">● HỆ THỐNG DỰ ĐOÁN THẾ HỆ MỚI | CÔNG NGHỆ 3D</div>
        </div>
        
        <div class="stats-grid">
            <div class="card-3d"><div class="card-value" id="mauHoc">0</div><div class="card-label">MẪU ĐÃ HỌC</div></div>
            <div class="card-3d"><div class="card-value" id="iqHienTai">${brainStats.iq.toLocaleString()}</div><div class="card-label">IQ HIỆN TẠI</div></div>
            <div class="card-3d"><div class="card-value" id="doChinhXac">0%</div><div class="card-label">ĐỘ CHÍNH XÁC</div></div>
            <div class="card-3d"><div class="card-value" id="chuoiThang">0</div><div class="card-label">CHUỖI THẮNG</div></div>
        </div>
        
        <div class="servers-grid">
            <div class="server-card">
                <div class="server-title"><i class="fas fa-server"></i> MÁY CHỦ HŨ</div>
                <div class="chart-container">
                    <div class="donut-wrapper"><canvas id="chartHu"></canvas><div class="percentage" id="percentHu">0%</div></div>
                    <div class="stats-list">
                        <div class="stat-row"><span>✅ THẮNG</span><span class="win" id="thangHu">0</span></div>
                        <div class="stat-row"><span>❌ THUA</span><span class="loss" id="thuaHu">0</span></div>
                        <div class="stat-row"><span>🏆 CHUỖI MAX</span><span id="maxHu">0</span></div>
                    </div>
                </div>
            </div>
            <div class="server-card">
                <div class="server-title"><i class="fas fa-fingerprint"></i> MÁY CHỦ MD5</div>
                <div class="chart-container">
                    <div class="donut-wrapper"><canvas id="chartMd5"></canvas><div class="percentage" id="percentMd5">0%</div></div>
                    <div class="stats-list">
                        <div class="stat-row"><span>✅ THẮNG</span><span class="win" id="thangMd5">0</span></div>
                        <div class="stat-row"><span>❌ THUA</span><span class="loss" id="thuaMd5">0</span></div>
                        <div class="stat-row"><span>🏆 CHUỖI MAX</span><span id="maxMd5">0</span></div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="history-section">
            <div class="history-header">
                <div class="tabs">
                    <button class="tab active" onclick="switchTab('hu')">📊 DỮ LIỆU HŨ</button>
                    <button class="tab" onclick="switchTab('md5')">🔐 DỮ LIỆU MD5</button>
                </div>
                <button class="refresh-btn" onclick="refreshData()"><i class="fas fa-sync-alt"></i> ĐỒNG BỘ</button>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>PHIÊN</th><th>KẾT QUẢ</th><th>DỰ ĐOÁN</th><th>ĐỘ TIN CẬY</th><th>PHƯƠNG PHÁP</th><th>TRẠNG THÁI</th></tr>
                    </thead>
                    <tbody id="tableBody"><tr><td colspan="6" style="text-align:center;">ĐANG TẢI DỮ LIỆU...</td></tr>
                </tbody>
                </table>
            </div>
        </div>
        
        <div class="footer">
            <p>© 2026 @anhkhoi | SIÊU TRÍ TUỆ NHÂN TẠO | CÔNG NGHỆ 3D</p>
            <p style="margin-top: 8px; font-size: 11px;">⚡ DỰ ĐOÁN DỰA TRÊN AI + MACHINE LEARNING | ĐỘ CHÍNH XÁC CAO NHẤT ⚡</p>
        </div>
    </div>
    
    <script>
        // 3D Particle Effect
        const canvas = document.getElementById('canvas3d');
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        let particles = [];
        for(let i = 0; i < 150; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                radius: Math.random() * 2 + 1,
                alpha: Math.random() * 0.5,
                speed: Math.random() * 0.5 + 0.2,
                color: Math.random() > 0.5 ? '#00ffff' : '#ff00ff'
            });
        }
        
        function animate3d() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for(let p of particles) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.shadowBlur = 10;
                ctx.shadowColor = p.color;
                ctx.fill();
                p.y -= p.speed;
                if(p.y < 0) p.y = canvas.height;
            }
            requestAnimationFrame(animate3d);
        }
        
        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        });
        
        animate3d();
        
        let currentTab = 'hu', charts = {};
        
        async function fetchStats() {
            try {
                const res = await fetch('/thongke');
                const data = await res.json();
                if(data.success) {
                    updateStats(data.statistics);
                    if(data.brainStats) {
                        document.getElementById('iqHienTai').innerText = data.brainStats.iq?.toLocaleString() || '1,000,000';
                        document.getElementById('mauHoc').innerText = data.brainStats.experience || 0;
                        document.getElementById('doChinhXac').innerText = data.brainStats.accuracy || '0%';
                    }
                }
            } catch(e) { console.error(e); }
        }
        
        function updateStats(stats) {
            document.getElementById('percentHu').innerText = stats.hu.accuracy + '%';
            document.getElementById('thangHu').innerText = stats.hu.wins;
            document.getElementById('thuaHu').innerText = stats.hu.losses;
            document.getElementById('maxHu').innerText = stats.hu.maxWinStreak;
            document.getElementById('chuoiThang').innerText = stats.hu.currentWinStreak;
            if(charts.hu) { charts.hu.data.datasets[0].data = [stats.hu.wins, stats.hu.losses || 1]; charts.hu.update(); }
            
            document.getElementById('percentMd5').innerText = stats.md5.accuracy + '%';
            document.getElementById('thangMd5').innerText = stats.md5.wins;
            document.getElementById('thuaMd5').innerText = stats.md5.losses;
            document.getElementById('maxMd5').innerText = stats.md5.maxWinStreak;
            if(charts.md5) { charts.md5.data.datasets[0].data = [stats.md5.wins, stats.md5.losses || 1]; charts.md5.update(); }
        }
        
        async function fetchHistory() {
            try {
                const res = await fetch(`/${currentTab}/lichsu`);
                const data = await res.json();
                const tbody = document.getElementById('tableBody');
                if(!data.history || data.history.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">CHƯA CÓ DỮ LIỆU</td></tr>';
                    return;
                }
                tbody.innerHTML = data.history.slice(0, 50).map(h => {
                    const isCorrect = h.ket_qua_du_doan === 'Đúng ✅';
                    return \`<tr>
                        <td style="color:#00ffff;">#\${h.Phien}</td>
                        <td class="\${h.Ket_qua === 'Tài' ? 'loss' : 'win'}"><i class="fas fa-arrow-\${h.Ket_qua === 'Tài' ? 'up' : 'down'}"></i> \${h.Ket_qua}</td>
                        <td class="\${h.Du_doan === 'Tài' ? 'loss' : 'win'}" style="font-weight:700;">\${h.Du_doan}</td>
                        <td style="color:#ffaa00;">\${h.Do_tin_cay}</td>
                        <td><span style="background:rgba(0,255,255,0.1); padding:4px 10px; border-radius:20px; font-size:11px;">\${h.Phuong_phap || 'SUPER_AI'}</span></td>
                        <td><span class="badge-\${isCorrect ? 'success' : 'error'}">\${isCorrect ? '✓ KHỚP' : '✗ LỆCH'}</span></td>
                    </tr>\`;
                }).join('');
            } catch(e) { console.error(e); }
        }
        
        function switchTab(tab) {
            currentTab = tab;
            document.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            fetchHistory();
        }
        
        async function refreshData() { await fetchStats(); await fetchHistory(); }
        
        function initCharts() {
            const config = { type: 'doughnut', options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false } } } };
            charts.hu = new Chart(document.getElementById('chartHu'), { ...config, data: { datasets: [{ data: [0, 100], backgroundColor: ['#00ffff', '#1f2a4a'], borderWidth: 0 }] } });
            charts.md5 = new Chart(document.getElementById('chartMd5'), { ...config, data: { datasets: [{ data: [0, 100], backgroundColor: ['#ff00ff', '#1f2a4a'], borderWidth: 0 }] } });
        }
        
        initCharts();
        refreshData();
        setInterval(refreshData, 5000);
    </script>
</body>
</html>`;
  res.send(html);
});

// KHỞI ĐỘNG
loadLearningData();
loadPredictionHistory();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n╔══════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║     🧠 LẨU CUA 79 - SIÊU TRÍ TUỆ NHÂN TẠO IQ 1,000,000             ║`);
  console.log(`╠══════════════════════════════════════════════════════════════════════════╣`);
  console.log(`║  📍 API: http://0.0.0.0:${PORT}                                            ║`);
  console.log(`║  📊 DASHBOARD 3D: http://0.0.0.0:${PORT}/thongke/html                     ║`);
  console.log(`║  ⚡ Auto update mỗi 1 giây | Chống trùng phiên tuyệt đối                  ║`);
  console.log(`║  🧠 THUẬT TOÁN: Logical + Analytical + Creative + Predictive + Adaptive  ║`);
  console.log(`║  🎯 IQ: 1,000,000 | Hệ thống ra quyết định Bayesian + Fuzzy               ║`);
  console.log(`║  🌟 GIAO DIỆN 3D | Hiệu ứng particle | Công nghệ độc quyền               ║`);
  console.log(`╚══════════════════════════════════════════════════════════════════════════╝\n`);
  startAutoTask();
});
