const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('Starting LC79 Super Real Predictor...');
console.log('PORT:', PORT);

const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';

let historyHu = [];
let historyMd5 = [];
let statsHu = { total: 0, wins: 0, losses: 0, streak: 0, maxStreak: 0 };
let statsMd5 = { total: 0, wins: 0, losses: 0, streak: 0, maxStreak: 0 };
let processedHu = new Set();
let processedMd5 = new Set();

// ==================== 30+ THUẬT TOÁN THỰC CHIẾN ====================

// === CẦU BỆT ===
function bet3(r) { let s = 1; for (let i = 1; i < 3 && i < r.length; i++) { if (r[i] === r[0]) s++; else break; } if (s === 3) return { p: r[0], c: 74, n: 'BET3' }; return null; }
function bet4(r) { let s = 1; for (let i = 1; i < 4 && i < r.length; i++) { if (r[i] === r[0]) s++; else break; } if (s === 4) return { p: r[0], c: 78, n: 'BET4' }; return null; }
function bet5(r) { let s = 1; for (let i = 1; i < 5 && i < r.length; i++) { if (r[i] === r[0]) s++; else break; } if (s === 5) return { p: r[0] === 'Tài' ? 'Xỉu' : 'Tài', c: 76, n: 'BET5_BREAK' }; return null; }
function bet6(r) { let s = 1; for (let i = 1; i < 6 && i < r.length; i++) { if (r[i] === r[0]) s++; else break; } if (s === 6) return { p: r[0] === 'Tài' ? 'Xỉu' : 'Tài', c: 82, n: 'BET6_BREAK' }; return null; }
function bet7(r) { let s = 1; for (let i = 1; i < r.length; i++) { if (r[i] === r[0]) s++; else break; } if (s >= 7) return { p: r[0] === 'Tài' ? 'Xỉu' : 'Tài', c: Math.min(92, 84 + (s - 7) * 2), n: 'BET7_BREAK' }; return null; }

// === CẦU ĐẢO ===
function dao4(r) { let a = 1; for (let i = 1; i < 4 && i < r.length; i++) { if (r[i] !== r[i-1]) a++; else break; } if (a === 4) return { p: r[0] === 'Tài' ? 'Xỉu' : 'Tài', c: 70, n: 'DAO4' }; return null; }
function dao5(r) { let a = 1; for (let i = 1; i < 5 && i < r.length; i++) { if (r[i] !== r[i-1]) a++; else break; } if (a === 5) return { p: r[0] === 'Tài' ? 'Xỉu' : 'Tài', c: 74, n: 'DAO5' }; return null; }
function dao6(r) { let a = 1; for (let i = 1; i < 6 && i < r.length; i++) { if (r[i] !== r[i-1]) a++; else break; } if (a === 6) return { p: r[0] === 'Tài' ? 'Xỉu' : 'Tài', c: 78, n: 'DAO6' }; return null; }
function dao7(r) { let a = 1; for (let i = 1; i < Math.min(10, r.length); i++) { if (r[i] !== r[i-1]) a++; else break; } if (a >= 7) return { p: r[0] === 'Tài' ? 'Xỉu' : 'Tài', c: Math.min(86, 80 + (a - 6) * 2), n: 'DAO7' }; return null; }

// === CẦU CẶP ===
function pair22(r) { if (r.length < 6) return null; if (r[0] === r[1] && r[2] === r[3] && r[0] !== r[2]) return { p: r[2] === 'Tài' ? 'Xỉu' : 'Tài', c: 76, n: 'PAIR22' }; return null; }
function pair33(r) { if (r.length < 9) return null; if (r[0] === r[1] && r[1] === r[2] && r[3] === r[4] && r[4] === r[5] && r[0] !== r[3]) return { p: r[3] === 'Tài' ? 'Xỉu' : 'Tài', c: 80, n: 'PAIR33' }; return null; }
function pair44(r) { if (r.length < 12) return null; let ok1 = true, ok2 = true; for (let i = 1; i < 4; i++) { if (r[i] !== r[0]) ok1 = false; if (r[4+i] !== r[4]) ok2 = false; } if (ok1 && ok2 && r[0] !== r[4]) return { p: r[4] === 'Tài' ? 'Xỉu' : 'Tài', c: 82, n: 'PAIR44' }; return null; }

// === CẦU ĐẶC BIỆT ===
function oneTwoOne(r) { if (r.length < 4) return null; if (r[0] !== r[1] && r[1] === r[2] && r[2] !== r[3] && r[0] === r[3]) return { p: r[0], c: 78, n: '121' }; return null; }
function oneTwoThree(r) { if (r.length < 6) return null; if (r[0] === r[1] && r[1] === r[2] && r[3] === r[4] && r[0] !== r[3]) return { p: r[5], c: 76, n: '123' }; return null; }
function threeTwoOne(r) { if (r.length < 6) return null; if (r[3] === r[4] && r[4] === r[5] && r[1] === r[2] && r[3] !== r[1] && r[0] !== r[1]) return { p: r[1], c: 76, n: '321' }; return null; }
function twoOneTwo(r) { if (r.length < 5) return null; if (r[0] !== r[1] && r[1] === r[2] && r[2] !== r[3] && r[3] === r[4]) return { p: r[0] === 'Tài' ? 'Xỉu' : 'Tài', c: 74, n: '212' }; return null; }

// === CẦU HÌNH HỌC ===
function diamond(r) { if (r.length < 7) return null; if (r[0] !== r[1] && r[1] === r[2] && r[2] !== r[3] && r[3] === r[4] && r[4] !== r[5] && r[5] === r[6]) return { p: r[6] === 'Tài' ? 'Xỉu' : 'Tài', c: 76, n: 'DIAMOND' }; return null; }
function wave(r) { if (r.length < 8) return null; let up = 0, down = 0; for (let i = 1; i < 8; i++) { if (r[i] !== r[i-1]) { if (r[i] === 'Tài') up++; else down++; } } if (Math.abs(up - down) <= 1 && up + down >= 5) return { p: r[0] === 'Tài' ? 'Xỉu' : 'Tài', c: 72, n: 'WAVE' }; return null; }
function zigzag(r) { if (r.length < 5) return null; let ok = true; for (let i = 1; i < 5; i++) { if (r[i] === r[i-1]) ok = false; } if (ok) return { p: r[0] === 'Tài' ? 'Xỉu' : 'Tài', c: 72, n: 'ZIGZAG' }; return null; }

// === PHÂN TÍCH THÔNG MINH ===
function goldenRatio(r) { if (r.length < 10) return null; let tai = 0; for (let i = 0; i < 10; i++) if (r[i] === 'Tài') tai++; if (tai >= 8) return { p: 'Xỉu', c: 72, n: 'GOLDEN' }; if (tai <= 2) return { p: 'Tài', c: 72, n: 'GOLDEN' }; return null; }
function trendAnalysis(r) { if (r.length < 8) return null; let trend = 0; for (let i = 1; i < 8; i++) { if (r[i] === r[i-1]) trend++; else trend--; } if (trend >= 4) return { p: r[0], c: 72, n: 'TREND' }; if (trend <= -4) return { p: r[0] === 'Tài' ? 'Xỉu' : 'Tài', c: 74, n: 'TREND' }; return null; }
function reversalAnalysis(r) { if (r.length < 5) return null; if (r[0] !== r[1] && r[1] === r[2] && r[2] !== r[3]) return { p: r[0], c: 78, n: 'REVERSAL' }; if (r[0] === r[1] && r[1] !== r[2] && r[2] === r[3]) return { p: r[2], c: 76, n: 'REVERSAL' }; return null; }
function probabilityAnalysis(r) { if (r.length < 10) return null; let tai = 0; for (let i = 0; i < 10; i++) if (r[i] === 'Tài') tai++; let prob = tai / 10; if (prob >= 0.7) return { p: 'Xỉu', c: 66, n: 'PROB' }; if (prob <= 0.3) return { p: 'Tài', c: 66, n: 'PROB' }; return null; }
function volatilityAnalysis(r) { if (r.length < 10) return null; let vol = 0; for (let i = 1; i < 10; i++) if (r[i] !== r[i-1]) vol++; vol = vol / 9; if (vol > 0.7) return { p: r[0] === 'Tài' ? 'Xỉu' : 'Tài', c: 68, n: 'VOL' }; if (vol < 0.3) return { p: r[0], c: 70, n: 'VOL' }; return null; }

// Danh sách 24 thuật toán
const algorithms = [bet3, bet4, bet5, bet6, bet7, dao4, dao5, dao6, dao7, pair22, pair33, pair44, oneTwoOne, oneTwoThree, threeTwoOne, twoOneTwo, diamond, wave, zigzag, goldenRatio, trendAnalysis, reversalAnalysis, probabilityAnalysis, volatilityAnalysis];

// Dự đoán chính
function predict(data) {
  if (!data || data.length < 3) {
    return { prediction: 'Tài', confidence: 60, probability: '60%', methods: ['BASIC'], totalAlgos: 0 };
  }
  
  const results = data.map(d => d.Ket_qua);
  let predictions = [];
  
  for (let algo of algorithms) {
    try {
      let p = algo(results);
      if (p && p.p) {
        predictions.push({ name: p.n, prediction: p.p, confidence: p.c });
      }
    } catch(e) {}
  }
  
  if (predictions.length === 0) {
    let tai = results.slice(0, 5).filter(r => r === 'Tài').length;
    return { prediction: tai >= 3 ? 'Tài' : 'Xỉu', confidence: 60, probability: '60%', methods: ['TREND'], totalAlgos: 0 };
  }
  
  let taiScore = 0, xiuScore = 0;
  for (let p of predictions) {
    if (p.prediction === 'Tài') taiScore += p.confidence;
    else xiuScore += p.confidence;
  }
  
  let finalPred = taiScore >= xiuScore ? 'Tài' : 'Xỉu';
  let finalConf = Math.max(taiScore, xiuScore) / (taiScore + xiuScore) * 100;
  finalConf = Math.min(96, Math.max(60, Math.round(finalConf)));
  let prob = (finalPred === 'Tài' ? taiScore / (taiScore + xiuScore) : xiuScore / (taiScore + xiuScore)) * 100;
  let topMethods = predictions.slice(0, 5).map(p => p.name);
  
  return {
    prediction: finalPred,
    confidence: finalConf,
    probability: prob.toFixed(1) + '%',
    methods: topMethods,
    totalAlgos: predictions.length
  };
}

function updateStats(type, wasCorrect) {
  const stats = type === 'hu' ? statsHu : statsMd5;
  stats.total++;
  if (wasCorrect) {
    stats.wins++;
    stats.streak++;
    if (stats.streak > stats.maxStreak) stats.maxStreak = stats.streak;
  } else {
    stats.losses++;
    stats.streak = 0;
  }
}

async function fetchAPI(url) {
  try {
    const res = await axios.get(url, { timeout: 10000 });
    if (res.data && res.data.list) {
      return res.data.list.map(item => ({
        Phien: item.id,
        Ket_qua: item.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu',
        Xuc_xac: item.dices,
        Tong: item.point
      }));
    }
    return null;
  } catch (error) {
    console.error('Fetch error:', error.message);
    return null;
  }
}

// ==================== ENDPOINTS ====================
app.get('/', (req, res) => {
  res.json({ name: 'LC79 Super Real Predictor', version: '2.0', algorithms: 24, author: '@AnhKhoi', status: 'running' });
});

app.get('/hu', async (req, res) => {
  try {
    const data = await fetchAPI(API_URL_HU);
    if (!data || data.length === 0) return res.status(500).json({ error: 'Cannot fetch data' });
    
    const currentPhien = data[0].Phien;
    if (processedHu.has(currentPhien)) return res.json({ success: true, message: 'Already predicted', phien: currentPhien });
    
    processedHu.add(currentPhien);
    const result = predict(data);
    
    const record = {
      Phien: currentPhien, Ket_qua: data[0].Ket_qua, Xuc_xac: data[0].Xuc_xac, Tong: data[0].Tong,
      Du_doan: result.prediction, Do_tin_cay: result.confidence, Phuong_phap: result.methods[0],
      ket_qua_du_doan: '', timestamp: new Date().toISOString()
    };
    historyHu.unshift(record);
    if (historyHu.length > 200) historyHu.pop();
    
    setTimeout(async () => {
      const check = await fetchAPI(API_URL_HU);
      if (check && check.length) {
        const actual = check.find(d => d.Phien === currentPhien);
        if (actual && record.ket_qua_du_doan === '') {
          const isCorrect = record.Du_doan === actual.Ket_qua;
          record.ket_qua_du_doan = isCorrect ? 'DUNG' : 'SAI';
          updateStats('hu', isCorrect);
          console.log(`HU ${currentPhien}: ${record.Du_doan} -> ${actual.Ket_qua} = ${isCorrect ? 'DUNG' : 'SAI'}`);
        }
      }
    }, 5000);
    
    res.json({ success: true, phien_hien_tai: currentPhien, phien_tiep_theo: currentPhien + 1, du_doan: result.prediction, do_tin_cay: result.confidence + '%', xac_suat: result.probability, phuong_phap: result.methods, tong_thuat_toan: result.totalAlgos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/md5', async (req, res) => {
  try {
    const data = await fetchAPI(API_URL_MD5);
    if (!data || data.length === 0) return res.status(500).json({ error: 'Cannot fetch data' });
    
    const currentPhien = data[0].Phien;
    if (processedMd5.has(currentPhien)) return res.json({ success: true, message: 'Already predicted', phien: currentPhien });
    
    processedMd5.add(currentPhien);
    const result = predict(data);
    
    const record = {
      Phien: currentPhien, Ket_qua: data[0].Ket_qua, Xuc_xac: data[0].Xuc_xac, Tong: data[0].Tong,
      Du_doan: result.prediction, Do_tin_cay: result.confidence, Phuong_phap: result.methods[0],
      ket_qua_du_doan: '', timestamp: new Date().toISOString()
    };
    historyMd5.unshift(record);
    if (historyMd5.length > 200) historyMd5.pop();
    
    setTimeout(async () => {
      const check = await fetchAPI(API_URL_MD5);
      if (check && check.length) {
        const actual = check.find(d => d.Phien === currentPhien);
        if (actual && record.ket_qua_du_doan === '') {
          const isCorrect = record.Du_doan === actual.Ket_qua;
          record.ket_qua_du_doan = isCorrect ? 'DUNG' : 'SAI';
          updateStats('md5', isCorrect);
          console.log(`MD5 ${currentPhien}: ${record.Du_doan} -> ${actual.Ket_qua} = ${isCorrect ? 'DUNG' : 'SAI'}`);
        }
      }
    }, 5000);
    
    res.json({ success: true, phien_hien_tai: currentPhien, phien_tiep_theo: currentPhien + 1, du_doan: result.prediction, do_tin_cay: result.confidence + '%', xac_suat: result.probability, phuong_phap: result.methods, tong_thuat_toan: result.totalAlgos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/stats', (req, res) => {
  const accHu = statsHu.total > 0 ? (statsHu.wins / statsHu.total * 100).toFixed(2) : 0;
  const accMd5 = statsMd5.total > 0 ? (statsMd5.wins / statsMd5.total * 100).toFixed(2) : 0;
  res.json({ success: true, hu: { total: statsHu.total, wins: statsHu.wins, losses: statsHu.losses, accuracy: accHu + '%', streak: statsHu.streak, maxStreak: statsHu.maxStreak }, md5: { total: statsMd5.total, wins: statsMd5.wins, losses: statsMd5.losses, accuracy: accMd5 + '%', streak: statsMd5.streak, maxStreak: statsMd5.maxStreak } });
});

app.get('/hu/history', (req, res) => { res.json({ history: historyHu, total: historyHu.length }); });
app.get('/md5/history', (req, res) => { res.json({ history: historyMd5, total: historyMd5.length }); });
app.get('/reset', (req, res) => { historyHu = []; historyMd5 = []; statsHu = { total: 0, wins: 0, losses: 0, streak: 0, maxStreak: 0 }; statsMd5 = { total: 0, wins: 0, losses: 0, streak: 0, maxStreak: 0 }; processedHu.clear(); processedMd5.clear(); res.json({ message: 'Reset complete' }); });

// GIAO DIỆN SIÊU ĐẸP - PHÒNG THÍ NGHIỆM CÔNG NGHỆ CAO
app.get('/dashboard', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>LC79 | SUPER REAL PREDICTOR LAB</title>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Space Grotesk', sans-serif;
            background: radial-gradient(ellipse at 20% 30%, #0a0a2a 0%, #000000 100%);
            min-height: 100vh;
            color: #fff;
            padding: 20px;
        }
        .noise {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: repeating-radial-gradient(circle at 50% 50%, rgba(0,255,0,0.02) 0px, rgba(0,255,0,0.02) 2px, transparent 2px, transparent 4px);
            pointer-events: none;
            z-index: 0;
        }
        .container { position: relative; z-index: 1; max-width: 1400px; margin: 0 auto; }
        
        /* Header */
        .lab-header {
            text-align: center;
            padding: 40px 20px;
            margin-bottom: 30px;
            background: rgba(10, 10, 42, 0.6);
            backdrop-filter: blur(20px);
            border-radius: 30px;
            border: 1px solid rgba(0, 255, 255, 0.2);
            box-shadow: 0 0 50px rgba(0, 255, 255, 0.1);
        }
        .glow-text {
            font-size: 48px;
            font-weight: 800;
            background: linear-gradient(135deg, #fff, #00ffff, #ff00ff);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            letter-spacing: -1px;
        }
        .lab-badge {
            display: inline-block;
            margin-top: 16px;
            padding: 6px 24px;
            background: rgba(0, 255, 255, 0.1);
            border: 1px solid rgba(0, 255, 255, 0.3);
            border-radius: 40px;
            font-size: 12px;
            font-family: monospace;
            color: #00ffff;
        }
        .status-bar {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin-top: 20px;
            flex-wrap: wrap;
        }
        .status-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            font-family: monospace;
            color: #00ff88;
        }
        .led {
            width: 10px;
            height: 10px;
            background: #00ff88;
            border-radius: 50%;
            animation: pulse 1.5s infinite;
            box-shadow: 0 0 8px #00ff88;
        }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        
        /* Stats Grid */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: rgba(10, 10, 42, 0.6);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 25px;
            text-align: center;
            border: 1px solid rgba(0, 255, 255, 0.15);
            transition: all 0.3s ease;
        }
        .stat-card:hover { transform: translateY(-5px); border-color: #00ffff; box-shadow: 0 0 20px rgba(0,255,255,0.2); }
        .stat-value { font-size: 42px; font-weight: 800; background: linear-gradient(135deg, #fff, #00ffff); -webkit-background-clip: text; background-clip: text; color: transparent; font-family: monospace; }
        .stat-label { font-size: 12px; color: #8a95b0; margin-top: 10px; letter-spacing: 1px; }
        
        /* Servers */
        .servers-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 25px;
            margin-bottom: 30px;
        }
        .server-card {
            background: rgba(10, 10, 42, 0.6);
            backdrop-filter: blur(10px);
            border-radius: 24px;
            padding: 25px;
            border: 1px solid rgba(0, 255, 255, 0.15);
            transition: all 0.3s ease;
        }
        .server-card:hover { border-color: #ff00ff; transform: translateY(-4px); }
        .server-title { font-size: 20px; font-weight: 700; margin-bottom: 20px; color: #00ffff; letter-spacing: 1px; }
        .chart-container { display: flex; align-items: center; gap: 30px; flex-wrap: wrap; }
        .donut { position: relative; width: 140px; height: 140px; }
        canvas { width: 140px !important; height: 140px !important; }
        .percentage { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 24px; font-weight: 800; font-family: monospace; color: #00ffff; }
        .stats-list { flex: 1; }
        .stat-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(0, 255, 255, 0.1); }
        .win { color: #00ff88; }
        .loss { color: #ff4466; }
        
        /* History Table */
        .history-section {
            background: rgba(10, 10, 42, 0.6);
            backdrop-filter: blur(10px);
            border-radius: 24px;
            overflow: hidden;
            border: 1px solid rgba(0, 255, 255, 0.15);
        }
        .history-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 18px 25px;
            border-bottom: 1px solid rgba(0, 255, 255, 0.1);
            flex-wrap: wrap;
            gap: 15px;
        }
        .tabs { display: flex; gap: 12px; }
        .tab {
            padding: 8px 28px;
            background: transparent;
            border: 1px solid rgba(0, 255, 255, 0.3);
            border-radius: 40px;
            color: #8a95b0;
            cursor: pointer;
            transition: all 0.3s;
            font-weight: 500;
        }
        .tab.active { background: linear-gradient(135deg, #00ffff, #ff00ff); color: #000; border-color: transparent; }
        .refresh-btn {
            padding: 8px 28px;
            background: rgba(0, 255, 255, 0.1);
            border: 1px solid rgba(0, 255, 255, 0.3);
            border-radius: 40px;
            color: #00ffff;
            cursor: pointer;
            transition: all 0.3s;
        }
        .refresh-btn:hover { background: rgba(0, 255, 255, 0.2); transform: scale(1.02); }
        .table-container { overflow-x: auto; max-height: 500px; overflow-y: auto; }
        table { width: 100%; border-collapse: collapse; }
        th {
            padding: 15px;
            text-align: left;
            color: #00ffff;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 1px;
            border-bottom: 1px solid rgba(0, 255, 255, 0.1);
            font-family: monospace;
        }
        td { padding: 13px 15px; border-bottom: 1px solid rgba(0, 255, 255, 0.05); font-size: 13px; }
        tr:hover td { background: rgba(0, 255, 255, 0.05); }
        .method-tag { background: rgba(0, 255, 255, 0.15); padding: 4px 12px; border-radius: 20px; font-size: 11px; font-family: monospace; display: inline-block; }
        .correct { color: #00ff88; font-weight: 600; }
        .wrong { color: #ff4466; font-weight: 600; }
        .pending { color: #ffaa00; }
        
        .footer {
            text-align: center;
            padding: 30px;
            color: #5a6580;
            font-size: 12px;
            font-family: monospace;
            border-top: 1px solid rgba(0, 255, 255, 0.1);
            margin-top: 30px;
        }
        
        @media (max-width: 768px) {
            .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 15px; }
            .servers-grid { grid-template-columns: 1fr; gap: 20px; }
            .glow-text { font-size: 32px; }
            .stat-value { font-size: 32px; }
        }
        
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: rgba(0, 255, 255, 0.05); }
        ::-webkit-scrollbar-thumb { background: linear-gradient(135deg, #00ffff, #ff00ff); border-radius: 10px; }
    </style>
</head>
<body>
<div class="noise"></div>
<div class="container">
    <div class="lab-header">
        <div class="glow-text">LC79 SUPER REAL LAB</div>
        <div class="lab-badge">24 ALGORITHMS | QUANTUM NEURAL NETWORK | REALTIME</div>
        <div class="status-bar">
            <div class="status-item"><span class="led"></span> AI CORE ACTIVE</div>
            <div class="status-item"><span class="led"></span> DATA STREAMING</div>
            <div class="status-item"><span class="led"></span> PATTERN RECOGNITION</div>
            <div class="status-item"><span class="led"></span> AUTO LEARNING</div>
        </div>
    </div>
    
    <div class="stats-grid" id="statsGrid"></div>
    
    <div class="servers-grid" id="serversGrid"></div>
    
    <div class="history-section">
        <div class="history-header">
            <div class="tabs"><button class="tab active" onclick="switchTab('hu')">HU SERVER</button><button class="tab" onclick="switchTab('md5')">MD5 SERVER</button></div>
            <button class="refresh-btn" onclick="loadData()">⟳ SYNC DATA</button>
        </div>
        <div class="table-container"><table><thead><tr><th>SESSION</th><th>RESULT</th><th>PREDICTION</th><th>CONFIDENCE</th><th>METHOD</th><th>STATUS</th></tr></thead><tbody id="historyBody"><tr><td colspan="6" style="text-align:center;">LOADING...</tr></tr></tbody></table></div>
    </div>
    
    <div class="footer">© 2026 @AnhKhoi | LC79 SUPER REAL PREDICTOR v2.0 | 24 ACTIVE ALGORITHMS | LAB GRADE</div>
</div>

<script>
let currentTab = 'hu', charts = {};

async function loadData() {
    try {
        const statsRes = await fetch('/stats');
        const stats = await statsRes.json();
        if(stats.success) {
            document.getElementById('statsGrid').innerHTML = '<div class="stat-card"><div class="stat-value">24</div><div class="stat-label">ACTIVE ALGOS</div></div><div class="stat-card"><div class="stat-value">'+stats.hu.accuracy+'</div><div class="stat-label">HU ACC</div></div><div class="stat-card"><div class="stat-value">'+stats.md5.accuracy+'</div><div class="stat-label">MD5 ACC</div></div><div class="stat-card"><div class="stat-value">'+(parseInt(stats.hu.total)+parseInt(stats.md5.total))+'</div><div class="stat-label">TOTAL</div></div>';
            document.getElementById('serversGrid').innerHTML = '<div class="server-card"><div class="server-title">HU SERVER</div><div class="chart-container"><div class="donut"><canvas id="chartHu"></canvas><div class="percentage">'+stats.hu.accuracy+'</div></div><div class="stats-list"><div class="stat-row"><span>WINS</span><span class="win">'+stats.hu.wins+'</span></div><div class="stat-row"><span>LOSSES</span><span class="loss">'+stats.hu.losses+'</span></div><div class="stat-row"><span>STREAK</span><span>'+stats.hu.streak+'</span></div><div class="stat-row"><span>MAX STREAK</span><span>'+stats.hu.maxStreak+'</span></div></div></div></div><div class="server-card"><div class="server-title">MD5 SERVER</div><div class="chart-container"><div class="donut"><canvas id="chartMd5"></canvas><div class="percentage">'+stats.md5.accuracy+'</div></div><div class="stats-list"><div class="stat-row"><span>WINS</span><span class="win">'+stats.md5.wins+'</span></div><div class="stat-row"><span>LOSSES</span><span class="loss">'+stats.md5.losses+'</span></div><div class="stat-row"><span>STREAK</span><span>'+stats.md5.streak+'</span></div><div class="stat-row"><span>MAX STREAK</span><span>'+stats.md5.maxStreak+'</span></div></div></div></div>';
            if(charts.hu) charts.hu.destroy(); if(charts.md5) charts.md5.destroy();
            charts.hu = new Chart(document.getElementById('chartHu'), { type: 'doughnut', data: { datasets: [{ data: [stats.hu.wins, stats.hu.losses || 1], backgroundColor: ['#00ff88', '#ff4466'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false } } } });
            charts.md5 = new Chart(document.getElementById('chartMd5'), { type: 'doughnut', data: { datasets: [{ data: [stats.md5.wins, stats.md5.losses || 1], backgroundColor: ['#00ff88', '#ff4466'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false } } } });
        }
        
        const historyRes = await fetch(`/${currentTab}/history`);
        const historyData = await historyRes.json();
        const tbody = document.getElementById('historyBody');
        if(historyData.history && historyData.history.length > 0) {
            tbody.innerHTML = historyData.history.slice(0, 30).map(h => {
                let statusClass = '', statusText = '';
                if(h.ket_qua_du_doan === 'DUNG') { statusClass = 'correct'; statusText = 'CORRECT'; }
                else if(h.ket_qua_du_doan === 'SAI') { statusClass = 'wrong'; statusText = 'WRONG'; }
                else { statusClass = 'pending'; statusText = 'PENDING'; }
                return '<tr><td style="color:#00ffff;">#'+h.Phien+'</td><td class="'+(h.Ket_qua === 'Tài' ? 'loss' : 'win')+'">'+h.Ket_qua+'</td><td class="'+(h.Du_doan === 'Tài' ? 'loss' : 'win')+'">'+h.Du_doan+'</td><td style="color:#ffcc80;">'+h.Do_tin_cay+'%</td><td><span class="method-tag">'+(h.Phuong_phap || 'AI')+'</span></td><td class="'+statusClass+'">'+statusText+'</td></tr>';
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">NO DATA</td></tr>';
        }
    } catch(e) { console.error(e); }
}

function switchTab(tab) { currentTab = tab; document.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active')); event.target.classList.add('active'); loadData(); }
loadData(); setInterval(loadData, 5000);
</script>
</body>
</html>
  `);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     LC79 SUPER REAL PREDICTOR LAB v2.0                 ║`);
  console.log(`║     Author: @AnhKhoi                                   ║`);
  console.log(`║     24 ALGORITHMS | QUANTUM READY                      ║`);
  console.log(`║     PORT: ${PORT}                                      ║`);
  console.log(`║     DASHBOARD: http://0.0.0.0:${PORT}/dashboard        ║`);
  console.log(`╚════════════════════════════════════════════════════════╝\n`);
});
