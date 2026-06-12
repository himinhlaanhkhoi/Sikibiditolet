const express = require('express');
const axios = require('axios');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';
const HISTORY_FILE = 'history.json';

let predictionHistory = { hu: [], md5: [] };
let statistics = { 
  hu: { total: 0, wins: 0, losses: 0, accuracy: 0, currentWinStreak: 0, maxWinStreak: 0, currentLoseStreak: 0, maxLoseStreak: 0 },
  md5: { total: 0, wins: 0, losses: 0, accuracy: 0, currentWinStreak: 0, maxWinStreak: 0, currentLoseStreak: 0, maxLoseStreak: 0 }
};
const MAX_HISTORY = 2000;
let processedPhienSet = { hu: new Set(), md5: new Set() };

// ==================== TRÍ TUỆ NHÂN TẠO ====================

class IntelligentPredictor {
  constructor() {
    this.experience = 0;
    this.accuracy = 0;
    this.lastCorrect = 0;
    this.memory = [];
  }
  
  predict(data) {
    if (!data || data.length < 3) {
      return { prediction: 'Tài', confidence: 55, methods: ['KHỞI TẠO'], analysis: 'ĐANG PHÂN TÍCH' };
    }
    
    const results = data.map(d => d.Ket_qua);
    const predictions = [];
    
    // 1. LOGIC PREDICTOR
    const logicPred = this.logicPredict(results);
    if (logicPred) predictions.push(logicPred);
    
    // 2. ANALYTICAL PREDICTOR
    const analyticPred = this.analyticPredict(results);
    if (analyticPred) predictions.push(analyticPred);
    
    // 3. TREND PREDICTOR
    const trendPred = this.trendPredict(results);
    if (trendPred) predictions.push(trendPred);
    
    // 4. PATTERN PREDICTOR
    const patternPred = this.patternPredict(results);
    if (patternPred) predictions.push(patternPred);
    
    // 5. STREAK PREDICTOR
    const streakPred = this.streakPredict(results);
    if (streakPred) predictions.push(streakPred);
    
    if (predictions.length === 0) {
      return this.fallbackPredict(results);
    }
    
    return this.ensemblePredict(predictions);
  }
  
  logicPredict(results) {
    if (results.length < 4) return null;
    const last = results[0];
    const second = results[1];
    const third = results[2];
    
    if (last === second && second === third) {
      return { prediction: last === 'Tài' ? 'Xỉu' : 'Tài', confidence: 75, source: 'LOGIC ĐẢO' };
    }
    if (last !== second && second === third) {
      return { prediction: last, confidence: 70, source: 'LOGIC THEO' };
    }
    return null;
  }
  
  analyticPredict(results) {
    if (results.length < 10) return null;
    let taiCount = 0;
    for (let i = 0; i < 10; i++) {
      if (results[i] === 'Tài') taiCount++;
    }
    if (taiCount >= 7) {
      return { prediction: 'Xỉu', confidence: 68 + (taiCount - 7) * 4, source: 'PHÂN TÍCH' };
    }
    if (taiCount <= 3) {
      return { prediction: 'Tài', confidence: 68 + (3 - taiCount) * 4, source: 'PHÂN TÍCH' };
    }
    return null;
  }
  
  trendPredict(results) {
    if (results.length < 8) return null;
    let trend = 0;
    for (let i = 1; i < 8; i++) {
      if (results[i] === results[i-1]) trend++;
      else trend--;
    }
    if (Math.abs(trend) >= 4) {
      const prediction = trend > 0 ? results[0] : (results[0] === 'Tài' ? 'Xỉu' : 'Tài');
      return { prediction: prediction, confidence: 65 + Math.abs(trend) * 2, source: 'XU HƯỚNG' };
    }
    return null;
  }
  
  patternPredict(results) {
    if (results.length < 6) return null;
    // Phát hiện cầu 1-2-1
    if (results[0] !== results[1] && results[1] === results[2] && results[2] !== results[3] && results[0] === results[3]) {
      return { prediction: results[0], confidence: 72, source: 'CẦU 1-2-1' };
    }
    // Phát hiện cầu 2-2
    if (results.length >= 6 && results[0] === results[1] && results[2] === results[3] && results[0] !== results[2]) {
      return { prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 70, source: 'CẦU 2-2' };
    }
    return null;
  }
  
  streakPredict(results) {
    if (results.length < 5) return null;
    let streak = 1;
    for (let i = 1; i < results.length; i++) {
      if (results[i] === results[0]) streak++;
      else break;
    }
    if (streak >= 4) {
      return { prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 68 + Math.min(15, streak * 2), source: `BẺ CẦU ${streak}` };
    }
    return null;
  }
  
  ensemblePredict(predictions) {
    let taiScore = 0, xiuScore = 0;
    for (const pred of predictions) {
      const weight = pred.confidence / 100;
      if (pred.prediction === 'Tài') taiScore += weight;
      else xiuScore += weight;
    }
    const total = taiScore + xiuScore;
    if (total === 0) return this.fallbackPredict([]);
    
    const prediction = taiScore >= xiuScore ? 'Tài' : 'Xỉu';
    let confidence = (Math.max(taiScore, xiuScore) / total) * 100;
    confidence = Math.min(96, Math.max(60, Math.round(confidence)));
    
    const methods = predictions.slice(0, 3).map(p => p.source);
    
    return {
      prediction: prediction,
      confidence: confidence,
      methods: methods,
      analysis: this.getAnalysis(confidence)
    };
  }
  
  fallbackPredict(results) {
    let taiCount = 0;
    for (let i = 0; i < Math.min(5, results.length); i++) {
      if (results[i] === 'Tài') taiCount++;
    }
    const prediction = taiCount >= 3 ? 'Tài' : 'Xỉu';
    return {
      prediction: prediction,
      confidence: 60,
      methods: ['DỰ PHÒNG'],
      analysis: 'DỰ ĐOÁN CƠ BẢN'
    };
  }
  
  getAnalysis(confidence) {
    if (confidence >= 90) return '🌌 SIÊU CHÍNH XÁC';
    if (confidence >= 85) return '⭐ RẤT CHẮC CHẮN';
    if (confidence >= 80) return '✨ KHÁ CHẮC CHẮN';
    if (confidence >= 75) return '📊 TIN CẬY CAO';
    if (confidence >= 70) return '🔮 KHẢ QUAN';
    return '⚡ CẦN THẬN TRỌNG';
  }
  
  learn(prediction, actual, wasCorrect) {
    this.experience++;
    if (wasCorrect) {
      this.lastCorrect++;
      const total = this.accuracy * (this.experience - 1) + 100;
      this.accuracy = total / this.experience;
    } else {
      this.lastCorrect = 0;
      const total = this.accuracy * (this.experience - 1) + 0;
      this.accuracy = total / this.experience;
    }
    this.memory.unshift({ prediction, actual, wasCorrect, time: Date.now() });
    if (this.memory.length > 500) this.memory.pop();
  }
  
  getStats() {
    return {
      accuracy: this.accuracy.toFixed(2) + '%',
      experience: this.experience,
      streak: this.lastCorrect
    };
  }
}

const predictor = new IntelligentPredictor();

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
      console.log('✅ Loaded history');
    }
  } catch (error) { console.error('Load error:', error.message); }
}

function saveHistory() {
  try {
    const processedPhienObj = { 
      hu: Array.from(processedPhienSet.hu), 
      md5: Array.from(processedPhienSet.md5) 
    };
    fs.writeFileSync(HISTORY_FILE, JSON.stringify({ 
      history: predictionHistory, 
      processedPhien: processedPhienObj, 
      statistics, 
      lastSaved: new Date().toISOString() 
    }, null, 2));
  } catch (error) { console.error('Save error:', error.message); }
}

function updateStatsFromHistory() {
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

// === HÀM API ===
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

function saveToHistory(type, phien, prediction, confidence, method, latestData) {
  const record = {
    Phien: latestData.Phien,
    Ket_qua: latestData.Ket_qua,
    Xuc_xac: `${latestData.Xuc_xac_1}-${latestData.Xuc_xac_2}-${latestData.Xuc_xac_3}`,
    Tong: latestData.Tong,
    Do_tin_cay: `${confidence}%`,
    Phien_hien_tai: phien.toString(),
    Du_doan: prediction,
    Phuong_phap: method,
    ket_qua_du_doan: '',
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
      if (record.ket_qua_du_doan && record.ket_qua_du_doan !== '') continue;
      const actual = data.find(d => d.Phien.toString() === record.Phien_hien_tai);
      if (actual) {
        const wasCorrect = record.Du_doan === actual.Ket_qua;
        record.ket_qua_du_doan = wasCorrect ? 'Đúng ✅' : 'Sai ❌';
        predictor.learn(record.Du_doan, actual.Ket_qua, wasCorrect);
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
        const result = predictor.predict(dataHu);
        saveToHistory('hu', phien, result.prediction, result.confidence, result.methods?.[0] || 'AI', dataHu[0]);
        console.log(`[${new Date().toLocaleTimeString()}] HU ${phien} -> ${result.prediction} (${result.confidence}%)`);
      }
    }
    
    const dataMd5 = await fetchData(API_URL_MD5);
    if (dataMd5 && dataMd5.length > 0) {
      const phien = dataMd5[0].Phien;
      if (!processedPhienSet.md5.has(phien)) {
        processedPhienSet.md5.add(phien);
        const result = predictor.predict(dataMd5);
        saveToHistory('md5', phien, result.prediction, result.confidence, result.methods?.[0] || 'AI', dataMd5[0]);
        console.log(`[${new Date().toLocaleTimeString()}] MD5 ${phien} -> ${result.prediction} (${result.confidence}%)`);
      }
    }
    saveHistory();
  } catch (error) { console.error('Auto error:', error.message); }
}

// ==================== ENDPOINTS ====================
app.get('/', (req, res) => res.json({ message: '@anhkhoi - AI Predictor', status: 'running' }));

app.get('/hu', async (req, res) => {
  try {
    const data = await fetchData(API_URL_HU);
    if (!data) return res.status(500).json({ error: 'API error' });
    const phien = data[0].Phien;
    const result = predictor.predict(data);
    saveToHistory('hu', phien, result.prediction, result.confidence, result.methods?.[0] || 'AI', data[0]);
    setTimeout(() => updateHistory('hu'), 5000);
    res.json({ 
      success: true, 
      phien_truoc_do: phien, 
      phien_hien_tai: phien + 1, 
      du_doan: result.prediction, 
      do_tin_cay: `${result.confidence}%`, 
      phuong_phap: result.methods?.[0],
      phan_tich: result.analysis 
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/md5', async (req, res) => {
  try {
    const data = await fetchData(API_URL_MD5);
    if (!data) return res.status(500).json({ error: 'API error' });
    const phien = data[0].Phien;
    const result = predictor.predict(data);
    saveToHistory('md5', phien, result.prediction, result.confidence, result.methods?.[0] || 'AI', data[0]);
    setTimeout(() => updateHistory('md5'), 5000);
    res.json({ 
      success: true, 
      phien_truoc_do: phien, 
      phien_hien_tai: phien + 1, 
      du_doan: result.prediction, 
      do_tin_cay: `${result.confidence}%`, 
      phuong_phap: result.methods?.[0],
      phan_tich: result.analysis 
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/thongke', async (req, res) => {
  await updateHistory('hu'); await updateHistory('md5');
  res.json({ success: true, statistics, aiStats: predictor.getStats() });
});

app.get('/hu/lichsu', async (req, res) => {
  await updateHistory('hu');
  res.json({ history: predictionHistory.hu, total: predictionHistory.hu.length, stats: statistics.hu });
});

app.get('/md5/lichsu', async (req, res) => {
  await updateHistory('md5');
  res.json({ history: predictionHistory.md5, total: predictionHistory.md5.length, stats: statistics.md5 });
});

app.get('/reset', (req, res) => {
  predictionHistory = { hu: [], md5: [] };
  processedPhienSet = { hu: new Set(), md5: new Set() };
  statistics = { 
    hu: { total: 0, wins: 0, losses: 0, accuracy: 0, currentWinStreak: 0, maxWinStreak: 0, currentLoseStreak: 0, maxLoseStreak: 0 },
    md5: { total: 0, wins: 0, losses: 0, accuracy: 0, currentWinStreak: 0, maxWinStreak: 0, currentLoseStreak: 0, maxLoseStreak: 0 }
  };
  saveHistory();
  res.json({ message: 'Reset done' });
});

// Giao diện HTML đẹp
app.get('/dashboard', async (req, res) => {
  await updateHistory('hu'); await updateHistory('md5');
  const aiStats = predictor.getStats();
  
  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>LẨU CUA 79 | AI PREDICTOR</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css">
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
        .container { max-width: 1200px; margin: 0 auto; }
        .header {
            text-align: center;
            padding: 40px 20px;
            background: rgba(255,255,255,0.05);
            border-radius: 30px;
            margin-bottom: 30px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(0,255,255,0.3);
        }
        .glow {
            font-family: 'Orbitron', monospace;
            font-size: 42px;
            font-weight: 900;
            background: linear-gradient(135deg, #00ffff, #ff00ff);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: rgba(255,255,255,0.05);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 25px;
            text-align: center;
            border: 1px solid rgba(0,255,255,0.2);
            transition: 0.3s;
        }
        .stat-card:hover { transform: translateY(-5px); border-color: #00ffff; }
        .stat-value { font-size: 36px; font-weight: 800; font-family: 'Orbitron', monospace; color: #00ffff; }
        .stat-label { font-size: 12px; color: #8a95b0; margin-top: 10px; }
        .servers-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 25px; margin-bottom: 30px; }
        .server-card {
            background: rgba(255,255,255,0.05);
            backdrop-filter: blur(10px);
            border-radius: 25px;
            padding: 25px;
            border: 1px solid rgba(0,255,255,0.2);
        }
        .server-title { font-size: 20px; font-weight: 700; color: #00ffff; margin-bottom: 20px; }
        .chart-wrap { display: flex; align-items: center; gap: 30px; flex-wrap: wrap; }
        .donut { position: relative; width: 140px; height: 140px; }
        canvas { width: 140px !important; height: 140px !important; }
        .percent { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 24px; font-weight: 800; font-family: 'Orbitron', monospace; }
        .stats-list { flex: 1; }
        .stat-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(0,255,255,0.1); }
        .win { color: #00ff88; }
        .loss { color: #ff4466; }
        .history-section {
            background: rgba(255,255,255,0.05);
            backdrop-filter: blur(10px);
            border-radius: 25px;
            overflow: hidden;
        }
        .history-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            border-bottom: 1px solid rgba(0,255,255,0.1);
            flex-wrap: wrap;
            gap: 15px;
        }
        .tabs { display: flex; gap: 10px; }
        .tab {
            padding: 8px 25px;
            background: rgba(0,0,0,0.5);
            border: 1px solid rgba(0,255,255,0.3);
            border-radius: 30px;
            cursor: pointer;
            transition: 0.3s;
        }
        .tab.active { background: linear-gradient(135deg, #00ffff, #ff00ff); color: #000; border-color: transparent; }
        .refresh-btn {
            padding: 8px 25px;
            background: rgba(0,255,255,0.1);
            border: 1px solid rgba(0,255,255,0.3);
            border-radius: 30px;
            color: #00ffff;
            cursor: pointer;
        }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 15px; text-align: left; border-bottom: 1px solid rgba(0,255,255,0.1); }
        th { color: #00ffff; font-size: 12px; }
        .badge-correct { background: rgba(0,255,136,0.2); color: #00ff88; padding: 4px 12px; border-radius: 20px; font-size: 11px; }
        .badge-wrong { background: rgba(255,68,102,0.2); color: #ff4466; padding: 4px 12px; border-radius: 20px; font-size: 11px; }
        .footer { text-align: center; padding: 30px; color: #5a6580; font-size: 12px; }
        @media (max-width: 768px) {
            .stats-grid { grid-template-columns: repeat(2, 1fr); }
            .servers-grid { grid-template-columns: 1fr; }
            .glow { font-size: 28px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="glow">LẨU CUA 79</div>
            <div style="margin-top: 15px;">🧠 AI PREDICTOR | ĐỘ CHÍNH XÁC: <span id="aiAcc">${aiStats.accuracy}</span></div>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-value" id="exp">${aiStats.experience}</div><div class="stat-label">KINH NGHIỆM</div></div>
            <div class="stat-card"><div class="stat-value" id="streak">${aiStats.streak}</div><div class="stat-label">CHUỖI THẮNG</div></div>
            <div class="stat-card"><div class="stat-value" id="totalAcc">0%</div><div class="stat-label">TỔNG ĐỘ CHÍNH XÁC</div></div>
            <div class="stat-card"><div class="stat-value" id="totalBet">0</div><div class="stat-label">TỔNG PHIÊN</div></div>
        </div>
        
        <div class="servers-grid" id="serversGrid"></div>
        
        <div class="history-section">
            <div class="history-header">
                <div class="tabs"><button class="tab active" onclick="switchTab('hu')">HŨ</button><button class="tab" onclick="switchTab('md5')">MD5</button></div>
                <button class="refresh-btn" onclick="refresh()"><i class="fas fa-sync-alt"></i> LÀM MỚI</button>
            </div>
            <div style="overflow-x: auto; max-height: 400px;">
                <table><thead><tr><th>PHIÊN</th><th>KẾT QUẢ</th><th>DỰ ĐOÁN</th><th>ĐỘ TIN CẬY</th><th>PHƯƠNG PHÁP</th><th>KẾT QUẢ</th></tr></thead><tbody id="tableBody"><tr><td colspan="6" style="text-align:center;">ĐANG TẢI...</td></tr></tbody></table>
            </div>
        </div>
        
        <div class="footer">© 2026 @anhkhoi | HỆ THỐNG DỰ ĐOÁN AI | CÔNG NGHỆ ĐỘC QUYỀN</div>
    </div>
    
    <script>
        let currentTab = 'hu', charts = {};
        
        async function fetchStats() {
            try {
                const res = await fetch('/thongke');
                const data = await res.json();
                if(data.success) {
                    document.getElementById('totalAcc').innerText = data.statistics.hu.accuracy + '%';
                    document.getElementById('totalBet').innerText = data.statistics.hu.total;
                    document.getElementById('exp').innerText = data.aiStats.experience || 0;
                    document.getElementById('streak').innerText = data.aiStats.streak || 0;
                    document.getElementById('aiAcc').innerHTML = data.aiStats.accuracy || '0%';
                    updateServers(data.statistics);
                }
            } catch(e) { console.error(e); }
        }
        
        function updateServers(stats) {
            document.getElementById('serversGrid').innerHTML = \`
                <div class="server-card"><div class="server-title"><i class="fas fa-server"></i> MÁY CHỦ HŨ</div>
                <div class="chart-wrap"><div class="donut"><canvas id="chartHu"></canvas><div class="percent">\${stats.hu.accuracy}%</div></div>
                <div class="stats-list"><div class="stat-row"><span>✅ THẮNG</span><span class="win">\${stats.hu.wins}</span></div>
                <div class="stat-row"><span>❌ THUA</span><span class="loss">\${stats.hu.losses}</span></div>
                <div class="stat-row"><span>🏆 CHUỖI MAX</span><span>\${stats.hu.maxWinStreak}</span></div></div></div></div>
                <div class="server-card"><div class="server-title"><i class="fas fa-fingerprint"></i> MÁY CHỦ MD5</div>
                <div class="chart-wrap"><div class="donut"><canvas id="chartMd5"></canvas><div class="percent">\${stats.md5.accuracy}%</div></div>
                <div class="stats-list"><div class="stat-row"><span>✅ THẮNG</span><span class="win">\${stats.md5.wins}</span></div>
                <div class="stat-row"><span>❌ THUA</span><span class="loss">\${stats.md5.losses}</span></div>
                <div class="stat-row"><span>🏆 CHUỖI MAX</span><span>\${stats.md5.maxWinStreak}</span></div></div></div></div>
            \`;
            if(charts.hu) charts.hu.destroy();
            if(charts.md5) charts.md5.destroy();
            charts.hu = new Chart(document.getElementById('chartHu'), { type: 'doughnut', data: { datasets: [{ data: [stats.hu.wins, stats.hu.losses || 1], backgroundColor: ['#00ff88', '#ff4466'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false } } } });
            charts.md5 = new Chart(document.getElementById('chartMd5'), { type: 'doughnut', data: { datasets: [{ data: [stats.md5.wins, stats.md5.losses || 1], backgroundColor: ['#00ff88', '#ff4466'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false } } } });
        }
        
        async function fetchHistory() {
            try {
                const res = await fetch(\`/\${currentTab}/lichsu\`);
                const data = await res.json();
                const tbody = document.getElementById('tableBody');
                if(!data.history || data.history.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">CHƯA CÓ DỮ LIỆU</td></tr>'; return; }
                tbody.innerHTML = data.history.slice(0, 30).map(h => \`
                    <tr><td style="color:#00ffff;">#\${h.Phien}</td>
                    <td class="\${h.Ket_qua === 'Tài' ? 'loss' : 'win'}">\${h.Ket_qua}</td>
                    <td class="\${h.Du_doan === 'Tài' ? 'loss' : 'win'}">\${h.Du_doan}</td>
                    <td style="color:#ffaa00;">\${h.Do_tin_cay}</td>
                    <td><span style="background:rgba(0,255,255,0.1); padding:4px 10px; border-radius:20px; font-size:11px;">\${h.Phuong_phap || 'AI'}</span></td>
                    <td><span class="badge-\${h.ket_qua_du_doan === 'Đúng ✅' ? 'correct' : 'wrong'}">\${h.ket_qua_du_doan || '⏳'}</span></td></tr>
                \`).join('');
            } catch(e) { console.error(e); }
        }
        
        function switchTab(tab) { currentTab = tab; document.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active')); event.target.classList.add('active'); fetchHistory(); }
        async function refresh() { await fetchStats(); await fetchHistory(); }
        
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
  console.log(`\n========================================`);
  console.log(`🚀 SERVER @anhkhoi - AI PREDICTOR`);
  console.log(`📍 PORT: ${PORT}`);
  console.log(`📊 DASHBOARD: http://0.0.0.0:${PORT}/dashboard`);
  console.log(`========================================\n`);
});
