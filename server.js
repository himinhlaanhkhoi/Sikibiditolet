const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5000;

const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';

let predictionHistory = { hu: [], md5: [] };
let statistics = { 
  hu: { total: 0, wins: 0, losses: 0, accuracy: 0, currentStreak: 0, maxStreak: 0 },
  md5: { total: 0, wins: 0, losses: 0, accuracy: 0, currentStreak: 0, maxStreak: 0 }
};

// ==================== 20 THUẬT TOÁN DỰ ĐOÁN ====================

function algBet(results) {
  let streak = 1;
  for (let i = 1; i < results.length; i++) {
    if (results[i] === results[0]) streak++;
    else break;
  }
  if (streak === 3) return { pred: results[0], conf: 74, name: 'BET3' };
  if (streak === 4) return { pred: results[0], conf: 78, name: 'BET4' };
  if (streak === 5) return { pred: results[0] === 'Tài' ? 'Xỉu' : 'Tài', conf: 76, name: 'BET5' };
  if (streak === 6) return { pred: results[0] === 'Tài' ? 'Xỉu' : 'Tài', conf: 82, name: 'BET6' };
  if (streak >= 7) return { pred: results[0] === 'Tài' ? 'Xỉu' : 'Tài', conf: 86, name: 'BET7' };
  return null;
}

function algDao(results) {
  let alt = 1;
  for (let i = 1; i < Math.min(10, results.length); i++) {
    if (results[i] !== results[i-1]) alt++;
    else break;
  }
  if (alt === 4) return { pred: results[0] === 'Tài' ? 'Xỉu' : 'Tài', conf: 72, name: 'DAO4' };
  if (alt === 5) return { pred: results[0] === 'Tài' ? 'Xỉu' : 'Tài', conf: 76, name: 'DAO5' };
  if (alt >= 6) return { pred: results[0] === 'Tài' ? 'Xỉu' : 'Tài', conf: 80, name: 'DAO6' };
  return null;
}

function alg22(results) {
  if (results.length < 6) return null;
  if (results[0] === results[1] && results[2] === results[3] && results[0] !== results[2]) {
    return { pred: results[2] === 'Tài' ? 'Xỉu' : 'Tài', conf: 76, name: '22' };
  }
  return null;
}

function alg33(results) {
  if (results.length < 9) return null;
  if (results[0] === results[1] && results[1] === results[2] &&
      results[3] === results[4] && results[4] === results[5] &&
      results[0] !== results[3]) {
    return { pred: results[3] === 'Tài' ? 'Xỉu' : 'Tài', conf: 80, name: '33' };
  }
  return null;
}

function alg121(results) {
  if (results.length < 4) return null;
  if (results[0] !== results[1] && results[1] === results[2] && results[2] !== results[3] && results[0] === results[3]) {
    return { pred: results[0], conf: 78, name: '121' };
  }
  return null;
}

function alg123(results) {
  if (results.length < 6) return null;
  if (results[0] === results[1] && results[1] === results[2] && results[3] === results[4] && results[0] !== results[3]) {
    return { pred: results[5], conf: 76, name: '123' };
  }
  return null;
}

function alg321(results) {
  if (results.length < 6) return null;
  if (results[3] === results[4] && results[4] === results[5] && results[1] === results[2] && results[3] !== results[1]) {
    return { pred: results[1], conf: 77, name: '321' };
  }
  return null;
}

function algDiamond(results) {
  if (results.length < 7) return null;
  if (results[0] !== results[1] && results[1] === results[2] && results[2] !== results[3] &&
      results[3] === results[4] && results[4] !== results[5] && results[5] === results[6]) {
    return { pred: results[6] === 'Tài' ? 'Xỉu' : 'Tài', conf: 78, name: 'DIAMOND' };
  }
  return null;
}

function algWave(results) {
  if (results.length < 8) return null;
  let up = 0, down = 0;
  for (let i = 1; i < 8; i++) {
    if (results[i] !== results[i-1]) {
      if (results[i] === 'Tài') up++;
      else down++;
    }
  }
  if (Math.abs(up - down) <= 1 && up + down >= 5) {
    return { pred: results[0] === 'Tài' ? 'Xỉu' : 'Tài', conf: 74, name: 'WAVE' };
  }
  return null;
}

function algZigzag(results) {
  if (results.length < 5) return null;
  let isZigzag = true;
  for (let i = 1; i < 5; i++) {
    if (results[i] === results[i-1]) isZigzag = false;
  }
  if (isZigzag) {
    return { pred: results[0] === 'Tài' ? 'Xỉu' : 'Tài', conf: 74, name: 'ZIGZAG' };
  }
  return null;
}

function algButterfly(results) {
  if (results.length < 8) return null;
  if (results[0] === results[7] && results[1] === results[6] && results[2] === results[5] && results[3] === results[4]) {
    return { pred: results[0] === 'Tài' ? 'Xỉu' : 'Tài', conf: 82, name: 'BUTTERFLY' };
  }
  return null;
}

function algTornado(results) {
  if (results.length < 7) return null;
  let center = results[3];
  if (results[0] !== center && results[1] !== center && results[2] !== center &&
      results[4] !== center && results[5] !== center && results[6] !== center) {
    return { pred: center === 'Tài' ? 'Xỉu' : 'Tài', conf: 78, name: 'TORNADO' };
  }
  return null;
}

function algCopy(results) {
  if (results.length < 6) return null;
  if (results[0] === results[3] && results[1] === results[4] && results[2] === results[5]) {
    return { pred: results[3] === 'Tài' ? 'Xỉu' : 'Tài', conf: 80, name: 'COPY' };
  }
  return null;
}

function algMeanRev(results) {
  let tai = 0;
  for (let i = 0; i < Math.min(10, results.length); i++) {
    if (results[i] === 'Tài') tai++;
  }
  if (tai >= 8) return { pred: 'Xỉu', conf: 74, name: 'MEAN_REV' };
  if (tai <= 2) return { pred: 'Tài', conf: 74, name: 'MEAN_REV' };
  return null;
}

function algMarkov(results) {
  if (results.length < 5) return null;
  let tt = 0, tx = 0, xt = 0, xx = 0;
  for (let i = 0; i < results.length - 1; i++) {
    if (results[i] === 'Tài' && results[i+1] === 'Tài') tt++;
    else if (results[i] === 'Tài' && results[i+1] === 'Xỉu') tx++;
    else if (results[i] === 'Xỉu' && results[i+1] === 'Tài') xt++;
    else xx++;
  }
  const last = results[0];
  let prob = (last === 'Tài') ? tt / (tt + tx + 1) : xt / (xt + xx + 1);
  if (prob > 0.6) return { pred: 'Tài', conf: 65 + prob * 15, name: 'MARKOV' };
  if (prob < 0.4) return { pred: 'Xỉu', conf: 65 + (1 - prob) * 15, name: 'MARKOV' };
  return null;
}

function algMonteCarlo(results) {
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
  let pred = Math.random() < prob ? 'Tài' : 'Xỉu';
  return { pred: pred, conf: 65, name: 'MONTE' };
}

function algLinearReg(results) {
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
  return { pred: pred, conf: Math.min(85, conf), name: 'LINEAR' };
}

function algTrend(results) {
  if (results.length < 8) return null;
  let trend = 0;
  for (let i = 1; i < 8; i++) {
    if (results[i] === results[i-1]) trend++;
    else trend--;
  }
  if (trend >= 5) return { pred: results[0] === 'Tài' ? 'Xỉu' : 'Tài', conf: 76, name: 'TREND_REV' };
  if (trend <= -5) return { pred: results[0], conf: 76, name: 'TREND_CONT' };
  return null;
}

function algVolatility(results) {
  if (results.length < 10) return null;
  let changes = 0;
  for (let i = 1; i < 10; i++) {
    if (results[i] !== results[i-1]) changes++;
  }
  let vol = changes / 9;
  if (vol > 0.7) return { pred: results[0] === 'Tài' ? 'Xỉu' : 'Tài', conf: 70, name: 'HIGH_VOL' };
  if (vol < 0.3) return { pred: results[0], conf: 72, name: 'LOW_VOL' };
  return null;
}

function algBayesian(results) {
  if (results.length < 15) return null;
  let likelihood = 0;
  for (let i = 0; i < 10; i++) {
    if (results[i] === 'Tài') likelihood += 0.55;
    else likelihood += 0.45;
  }
  let posterior = (0.5 * likelihood) / (0.5 * likelihood + 0.5 * (1 - likelihood));
  let pred = posterior > 0.5 ? 'Tài' : 'Xỉu';
  let conf = 60 + Math.abs(posterior - 0.5) * 60;
  return { pred: pred, conf: Math.min(88, conf), name: 'BAYES' };
}

const algorithms = [
  algBet, algDao, alg22, alg33, alg121, alg123, alg321, algDiamond,
  algWave, algZigzag, algButterfly, algTornado, algCopy, algMeanRev,
  algMarkov, algMonteCarlo, algLinearReg, algTrend, algVolatility, algBayesian
];

// ==================== DỰ ĐOÁN ====================
function getPrediction(data) {
  if (!data || data.length < 5) {
    return { prediction: 'Tài', confidence: 60, algorithms: 0, methods: [] };
  }
  
  const results = data.map(d => d.Ket_qua);
  let predictions = [];
  
  for (let algo of algorithms) {
    try {
      let p = algo(results);
      if (p && p.pred) {
        predictions.push(p);
      }
    } catch(e) {}
  }
  
  if (predictions.length === 0) {
    let tai = results.slice(0, 5).filter(r => r === 'Tài').length;
    return { prediction: tai >= 3 ? 'Tài' : 'Xỉu', confidence: 60, algorithms: 0, methods: [] };
  }
  
  let taiScore = 0, xiuScore = 0;
  for (let p of predictions) {
    if (p.pred === 'Tài') taiScore += p.conf;
    else xiuScore += p.conf;
  }
  
  let finalPred = taiScore >= xiuScore ? 'Tài' : 'Xỉu';
  let finalConf = Math.max(taiScore, xiuScore) / (taiScore + xiuScore) * 100;
  finalConf = Math.min(96, Math.max(60, Math.round(finalConf)));
  let topMethods = predictions.slice(0, 5).map(p => p.name);
  
  return {
    prediction: finalPred,
    confidence: finalConf,
    methods: topMethods,
    totalAlgorithms: predictions.length
  };
}

// ==================== CẬP NHẬT THỐNG KÊ ====================
function updateStats(type, wasCorrect) {
  const stats = statistics[type];
  stats.total++;
  if (wasCorrect) {
    stats.wins++;
    stats.currentStreak++;
    if (stats.currentStreak > stats.maxStreak) {
      stats.maxStreak = stats.currentStreak;
    }
  } else {
    stats.losses++;
    stats.currentStreak = 0;
  }
  stats.accuracy = (stats.wins / stats.total * 100).toFixed(2);
}

// ==================== HÀM GỌI API ====================
function transformData(apiData) {
  if (!apiData || !apiData.list) return null;
  return apiData.list.map(item => ({
    Phien: item.id,
    Ket_qua: item.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu',
    Xuc_xac_1: item.dices[0],
    Xuc_xac_2: item.dices[1],
    Xuc_xac_3: item.dices[2],
    Tong: item.point
  }));
}

async function fetchHu() {
  try {
    const res = await axios.get(API_URL_HU, { timeout: 10000 });
    return transformData(res.data);
  } catch (error) {
    console.error('HU fetch error:', error.message);
    return null;
  }
}

async function fetchMd5() {
  try {
    const res = await axios.get(API_URL_MD5, { timeout: 10000 });
    return transformData(res.data);
  } catch (error) {
    console.error('MD5 fetch error:', error.message);
    return null;
  }
}

// ==================== ENDPOINTS ====================
app.get('/', (req, res) => {
  res.json({ 
    name: 'LC79 Prediction Server',
    version: '1.0.0',
    author: '@AnhKhoi',
    algorithms: 20,
    status: 'running'
  });
});

app.get('/hu', async (req, res) => {
  try {
    const data = await fetchHu();
    if (!data || data.length === 0) {
      return res.status(500).json({ error: 'Cannot fetch data from API' });
    }
    
    const currentPhien = data[0].Phien;
    const result = getPrediction(data);
    
    const record = {
      Phien: currentPhien,
      Ket_qua: data[0].Ket_qua,
      Xuc_xac: `${data[0].Xuc_xac_1}-${data[0].Xuc_xac_2}-${data[0].Xuc_xac_3}`,
      Tong: data[0].Tong,
      Do_tin_cay: `${result.confidence}%`,
      Phien_hien_tai: (currentPhien + 1).toString(),
      Du_doan: result.prediction,
      Phuong_phap: result.methods[0] || 'ABSOLUTE',
      ket_qua_du_doan: '',
      id: '@AnhKhoi',
      timestamp: new Date().toISOString()
    };
    
    predictionHistory.hu.unshift(record);
    if (predictionHistory.hu.length > 100) predictionHistory.hu.pop();
    
    // Kiểm tra kết quả sau 5 giây
    setTimeout(async () => {
      const checkData = await fetchHu();
      if (checkData && checkData.length > 0) {
        const actual = checkData.find(d => d.Phien === currentPhien);
        if (actual && record.ket_qua_du_doan === '') {
          const wasCorrect = record.Du_doan === actual.Ket_qua;
          record.ket_qua_du_doan = wasCorrect ? 'Đúng ✅' : 'Sai ❌';
          updateStats('hu', wasCorrect);
        }
      }
    }, 5000);
    
    res.json({
      success: true,
      phien_truoc_do: currentPhien,
      phien_hien_tai: currentPhien + 1,
      du_doan: result.prediction,
      do_tin_cay: `${result.confidence}%`,
      cac_cau: result.methods,
      yeu_to: result.methods,
      id: '@AnhKhoi'
    });
  } catch (error) {
    console.error('HU endpoint error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

app.get('/md5', async (req, res) => {
  try {
    const data = await fetchMd5();
    if (!data || data.length === 0) {
      return res.status(500).json({ error: 'Cannot fetch data from API' });
    }
    
    const currentPhien = data[0].Phien;
    const result = getPrediction(data);
    
    const record = {
      Phien: currentPhien,
      Ket_qua: data[0].Ket_qua,
      Xuc_xac: `${data[0].Xuc_xac_1}-${data[0].Xuc_xac_2}-${data[0].Xuc_xac_3}`,
      Tong: data[0].Tong,
      Do_tin_cay: `${result.confidence}%`,
      Phien_hien_tai: (currentPhien + 1).toString(),
      Du_doan: result.prediction,
      Phuong_phap: result.methods[0] || 'ABSOLUTE',
      ket_qua_du_doan: '',
      id: '@AnhKhoi',
      timestamp: new Date().toISOString()
    };
    
    predictionHistory.md5.unshift(record);
    if (predictionHistory.md5.length > 100) predictionHistory.md5.pop();
    
    setTimeout(async () => {
      const checkData = await fetchMd5();
      if (checkData && checkData.length > 0) {
        const actual = checkData.find(d => d.Phien === currentPhien);
        if (actual && record.ket_qua_du_doan === '') {
          const wasCorrect = record.Du_doan === actual.Ket_qua;
          record.ket_qua_du_doan = wasCorrect ? 'Đúng ✅' : 'Sai ❌';
          updateStats('md5', wasCorrect);
        }
      }
    }, 5000);
    
    res.json({
      success: true,
      phien_truoc_do: currentPhien,
      phien_hien_tai: currentPhien + 1,
      du_doan: result.prediction,
      do_tin_cay: `${result.confidence}%`,
      cac_cau: result.methods,
      yeu_to: result.methods,
      id: '@AnhKhoi'
    });
  } catch (error) {
    console.error('MD5 endpoint error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

app.get('/thongke', (req, res) => {
  res.json({ 
    success: true, 
    statistics: statistics,
    predictor: {
      activeAlgorithms: 20,
      version: '1.0.0'
    },
    lastUpdated: new Date().toISOString(),
    id: '@AnhKhoi'
  });
});

app.get('/hu/lichsu', (req, res) => {
  res.json({ 
    type: 'Lau Cua 79 - Tai Xiu Prediction',
    history: predictionHistory.hu,
    total: predictionHistory.hu.length,
    stats: statistics.hu,
    id: '@AnhKhoi'
  });
});

app.get('/md5/lichsu', (req, res) => {
  res.json({ 
    type: 'Lau Cua 79 - Tai Xiu MD5',
    history: predictionHistory.md5,
    total: predictionHistory.md5.length,
    stats: statistics.md5,
    id: '@AnhKhoi'
  });
});

app.get('/reset', (req, res) => {
  predictionHistory = { hu: [], md5: [] };
  statistics = { 
    hu: { total: 0, wins: 0, losses: 0, accuracy: 0, currentStreak: 0, maxStreak: 0 },
    md5: { total: 0, wins: 0, losses: 0, accuracy: 0, currentStreak: 0, maxStreak: 0 }
  };
  res.json({ message: 'Data reset successfully', id: '@AnhKhoi' });
});

// Dashboard HTML
app.get('/dashboard', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LC79 - AI Prediction Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #0a0a2a, #000); color: #fff; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; padding: 40px; background: rgba(255,255,255,0.05); border-radius: 20px; margin-bottom: 30px; }
        h1 { font-size: 48px; background: linear-gradient(135deg, #fff, #00aaff); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
        .card { background: rgba(255,255,255,0.05); padding: 20px; border-radius: 15px; text-align: center; transition: 0.3s; }
        .card:hover { transform: translateY(-5px); background: rgba(255,255,255,0.1); }
        .value { font-size: 36px; font-weight: bold; color: #00aaff; }
        .label { font-size: 12px; color: #888; margin-top: 10px; }
        .servers { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
        .server { background: rgba(255,255,255,0.05); padding: 20px; border-radius: 15px; }
        .server h3 { color: #00aaff; margin-bottom: 15px; }
        .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .win { color: #00ff88; }
        .loss { color: #ff4444; }
        .history { background: rgba(255,255,255,0.05); border-radius: 15px; overflow: hidden; }
        .history-header { display: flex; justify-content: space-between; padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); flex-wrap: wrap; gap: 10px; }
        .tabs { display: flex; gap: 10px; }
        .tab { padding: 8px 20px; background: transparent; border: 1px solid #00aaff; border-radius: 20px; cursor: pointer; color: #fff; transition: 0.3s; }
        .tab.active { background: #00aaff; color: #000; }
        .refresh { padding: 8px 20px; background: rgba(0,170,255,0.2); border: 1px solid #00aaff; border-radius: 20px; cursor: pointer; color: #00aaff; transition: 0.3s; }
        .refresh:hover { background: rgba(0,170,255,0.4); }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .correct { color: #00ff88; }
        .wrong { color: #ff4444; }
        .pending { color: #ffaa00; }
        @media (max-width: 768px) { .stats { grid-template-columns: repeat(2, 1fr); } .servers { grid-template-columns: 1fr; } h1 { font-size: 32px; } }
        .footer { text-align: center; padding: 30px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header"><h1>LC79 AI PREDICTOR</h1><p style="margin-top: 10px;">20 ALGORITHMS | ULTIMATE ACCURACY</p></div>
        <div class="stats" id="stats"></div>
        <div class="servers" id="servers"></div>
        <div class="history">
            <div class="history-header">
                <div class="tabs"><button class="tab active" onclick="switchTab('hu')">HU SERVER</button><button class="tab" onclick="switchTab('md5')">MD5 SERVER</button></div>
                <button class="refresh" onclick="loadData()">SYNC DATA</button>
            </div>
            <div style="overflow-x: auto;">
                <table><thead><tr><th>SESSION</th><th>RESULT</th><th>PREDICTION</th><th>CONFIDENCE</th><th>METHOD</th><th>STATUS</th></tr></thead><tbody id="historyBody"><tr><td colspan="6" style="text-align:center;">LOADING...</td></tr></tbody></table>
            </div>
        </div>
        <div class="footer">© 2026 @AnhKhoi | LC79 Prediction Server | 20 Active Algorithms</div>
    </div>
    <script>
        let currentTab = 'hu';
        async function loadData() {
            try {
                const statsRes = await fetch('/thongke');
                const statsData = await statsRes.json();
                if(statsData.success) {
                    document.getElementById('stats').innerHTML = '<div class="card"><div class="value">20</div><div class="label">ALGORITHMS</div></div><div class="card"><div class="value">'+statsData.statistics.hu.accuracy+'%</div><div class="label">ACCURACY</div></div><div class="card"><div class="value">'+statsData.statistics.hu.currentStreak+'</div><div class="label">STREAK</div></div><div class="card"><div class="value">'+statsData.statistics.hu.total+'</div><div class="label">TOTAL</div></div>';
                    document.getElementById('servers').innerHTML = '<div class="server"><h3>HU SERVER</h3><div class="row"><span>WINS</span><span class="win">'+statsData.statistics.hu.wins+'</span></div><div class="row"><span>LOSSES</span><span class="loss">'+statsData.statistics.hu.losses+'</span></div><div class="row"><span>MAX STREAK</span><span>'+statsData.statistics.hu.maxStreak+'</span></div><div class="row"><span>TOTAL</span><span>'+statsData.statistics.hu.total+'</span></div></div><div class="server"><h3>MD5 SERVER</h3><div class="row"><span>WINS</span><span class="win">'+statsData.statistics.md5.wins+'</span></div><div class="row"><span>LOSSES</span><span class="loss">'+statsData.statistics.md5.losses+'</span></div><div class="row"><span>MAX STREAK</span><span>'+statsData.statistics.md5.maxStreak+'</span></div><div class="row"><span>TOTAL</span><span>'+statsData.statistics.md5.total+'</span></div></div>';
                }
                const historyRes = await fetch(`/${currentTab}/lichsu`);
                const historyData = await historyRes.json();
                const tbody = document.getElementById('historyBody');
                if(historyData.history && historyData.history.length > 0) {
                    tbody.innerHTML = historyData.history.slice(0, 30).map(h => '<tr><td>#'+h.Phien+'</td><td class="'+(h.Ket_qua === 'Tài' ? 'loss' : 'win')+'">'+h.Ket_qua+'</td><td class="'+(h.Du_doan === 'Tài' ? 'loss' : 'win')+'">'+h.Du_doan+'</td><td>'+h.Do_tin_cay+'</td><td><span style="background:rgba(0,170,255,0.2);padding:4px 8px;border-radius:12px;font-size:11px;">'+h.Phuong_phap+'</span></td><td class="'+(h.ket_qua_du_doan === 'Đúng ✅' ? 'correct' : (h.ket_qua_du_doan === 'Sai ❌' ? 'wrong' : 'pending'))+'">'+(h.ket_qua_du_doan || 'PENDING')+'</td></tr>').join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">NO DATA</td></tr>';
                }
            } catch(e) { console.error(e); }
        }
        function switchTab(tab) { currentTab = tab; document.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active')); event.target.classList.add('active'); loadData(); }
        loadData(); setInterval(loadData, 5000);
    </script>
</body>
</html>`;
  res.send(html);
});

// KHỞI ĐỘNG SERVER
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================`);
  console.log(`LC79 PREDICTION SERVER`);
  console.log(`Author: @AnhKhoi`);
  console.log(`PORT: ${PORT}`);
  console.log(`Algorithms: 20 Active`);
  console.log(`Dashboard: http://0.0.0.0:${PORT}/dashboard`);
  console.log(`API: http://0.0.0.0:${PORT}/hu`);
  console.log(`========================================\n`);
});
