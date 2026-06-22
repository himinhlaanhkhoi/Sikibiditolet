/**
 * ════════════════════════════════════════════════════════════════════
 * ║  🚀 TX PREDICTOR v6 - ĐẠI CA KHÔI @2026                      ║
 * ════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const axios = require('axios');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// ============================================================
// CẤU HÌNH
// ============================================================
const CONFIG = {
    API_URL_HU: 'https://wtx.tele68.com/v1/tx/sessions',
    API_URL_MD5: 'https://wtxmd52.tele68.com/v1/txmd5/sessions',
    MAX_HISTORY: 1000
};

// ============================================================
// CẤU TRÚC DỮ LIỆU
// ============================================================
let historyData = { hu: [], md5: [] };
const HISTORY_FILE = './history.json';

// ============================================================
// LƯU LỊCH SỬ
// ============================================================
function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
            historyData = data;
        }
    } catch (e) { console.log('Load history error:', e.message); }
}

function saveHistory() {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(historyData, null, 2));
    } catch (e) { console.log('Save history error:', e.message); }
}

// ============================================================
// LẤY DỮ LIỆU API
// ============================================================
function transformData(apiData) {
    if (!apiData || !apiData.list) return null;
    const result = [];
    for (let i = 0; i < apiData.list.length; i++) {
        const item = apiData.list[i];
        result.push({
            Phien: item.id,
            Ket_qua: item.resultTruyenThong === 'TAI' ? 'T' : 'X',
            d1: item.dices[0],
            d2: item.dices[1],
            d3: item.dices[2],
            Tong: item.point
        });
    }
    return result;
}

async function fetchHu() {
    try {
        const res = await axios.get(CONFIG.API_URL_HU, { timeout: 10000 });
        return transformData(res.data);
    } catch (e) {
        console.log('HU fetch error:', e.message);
        return null;
    }
}

async function fetchMd5() {
    try {
        const res = await axios.get(CONFIG.API_URL_MD5, { timeout: 10000 });
        return transformData(res.data);
    } catch (e) {
        console.log('MD5 fetch error:', e.message);
        return null;
    }
}

// ============================================================
// THUẬT TOÁN DỰ ĐOÁN ĐƠN GIẢN
// ============================================================
function simplePredict(results) {
    const n = results.length;
    if (n < 3) return { prediction: 'TAI', confidence: 50 };
    
    // Đếm Tài
    let taiCount = 0;
    for (let i = 0; i < n; i++) {
        if (results[i] === 'T') taiCount++;
    }
    
    // Kiểm tra bệt
    let streak = 1;
    for (let i = 1; i < n; i++) {
        if (results[i] === results[0]) streak++;
        else break;
    }
    
    let prediction = 'TAI';
    let confidence = 55;
    
    if (streak >= 3 && streak <= 5) {
        prediction = results[0] === 'T' ? 'TAI' : 'XIU';
        confidence = 65 + streak * 3;
    } else if (streak >= 6) {
        prediction = results[0] === 'T' ? 'XIU' : 'TAI';
        confidence = 75 + streak * 2;
    } else if (streak >= 3) {
        prediction = results[0] === 'T' ? 'TAI' : 'XIU';
        confidence = 60 + streak * 2;
    } else {
        prediction = taiCount > n / 2 ? 'TAI' : 'XIU';
        confidence = 55 + Math.abs(taiCount / n - 0.5) * 40;
    }
    
    return { prediction, confidence: Math.min(confidence, 92) };
}

// ============================================================
// HÀM DỰ ĐOÁN
// ============================================================
function calculatePrediction(data, type) {
    const results = data.map(d => d.Ket_qua);
    const result = simplePredict(results);
    
    // Lưu lịch sử
    const record = {
        phien: data[0]?.Phien || 0,
        duDoan: result.prediction,
        doTinCay: result.confidence.toFixed(0) + '%',
        ketQua: data[0]?.Ket_qua === 'T' ? 'TAI' : 'XIU',
        trangThai: 'PENDING',
        loai: type.toUpperCase(),
        thoiGian: new Date().toISOString()
    };
    
    if (data[0]?.Ket_qua) {
        const actual = data[0].Ket_qua === 'T' ? 'TAI' : 'XIU';
        record.ketQua = actual;
        record.trangThai = result.prediction === actual ? 'WIN' : 'LOSE';
    }
    
    historyData[type].unshift(record);
    if (historyData[type].length > CONFIG.MAX_HISTORY) {
        historyData[type] = historyData[type].slice(0, CONFIG.MAX_HISTORY);
    }
    saveHistory();
    
    return {
        prediction: result.prediction,
        confidence: result.confidence,
        phien: data[0]?.Phien || 0
    };
}

// ============================================================
// HÀM RENDER GIAO DIỆN DỰ ĐOÁN
// ============================================================
function renderPredictionPage(title, type, color) {
    return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Dự đoán ${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Roboto', sans-serif;
            background: #0a0a1a;
            color: #fff;
            min-height: 100vh;
            overflow-x: hidden;
            user-select: none;
        }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        ::-webkit-scrollbar-thumb { background: ${color}; border-radius: 10px; }

        .bg-glow {
            position: fixed; top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: 0;
            background: radial-gradient(ellipse at 30% 20%, rgba(124,77,255,0.06), transparent 50%),
                        radial-gradient(ellipse at 70% 80%, rgba(0,245,255,0.04), transparent 50%);
        }

        .container { position: relative; z-index: 1; max-width: 800px; margin: 0 auto; padding: 16px; min-height: 100vh; }

        .header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px 24px;
            background: rgba(255,255,255,0.03);
            backdrop-filter: blur(20px);
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.04);
            margin-bottom: 16px;
            flex-wrap: wrap;
            gap: 10px;
        }
        .logo { display: flex; align-items: center; gap: 12px; }
        .logo-icon {
            width: 44px; height: 44px;
            background: linear-gradient(135deg, ${color}, ${color}cc);
            border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; font-weight: 900; color: #fff;
            font-family: 'Orbitron', sans-serif;
            box-shadow: 0 0 40px rgba(124,77,255,0.15);
        }
        .logo-text {
            font-family: 'Orbitron', sans-serif;
            font-size: 20px; font-weight: 700;
            background: linear-gradient(135deg, ${color}, #7c4dff);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .logo-sub { font-size: 9px; color: rgba(255,255,255,0.3); letter-spacing: 2px; text-transform: uppercase; }
        .header-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .status-badge {
            display: flex; align-items: center; gap: 6px;
            padding: 4px 14px; background: rgba(0,255,136,0.06);
            border-radius: 20px; font-size: 10px; color: rgba(255,255,255,0.5);
            border: 1px solid rgba(0,255,136,0.06);
        }
        .status-dot { width: 7px; height: 7px; border-radius: 50%; background: #00ff88; animation: dotPulse 1.5s ease-in-out infinite; }
        @keyframes dotPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.2; transform: scale(0.6); } }
        .header-time { font-size: 11px; color: rgba(255,255,255,0.3); font-family: 'Orbitron', sans-serif; }

        .nav-links { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 16px; }
        .nav-link {
            padding: 4px 16px; border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.06);
            color: rgba(255,255,255,0.4); font-size: 8px;
            text-decoration: none; font-family: 'Orbitron', sans-serif;
            transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .nav-link:hover { border-color: ${color}; color: ${color}; background: rgba(124,77,255,0.05); }
        .nav-link.active { border-color: ${color}; color: ${color}; background: rgba(124,77,255,0.05); }

        .card {
            background: rgba(255,255,255,0.02);
            border-radius: 16px; border: 1px solid rgba(255,255,255,0.04);
            padding: 24px; transition: all 0.3s ease;
            margin-bottom: 16px;
        }
        .card:hover { border-color: rgba(124,77,255,0.08); box-shadow: 0 0 60px rgba(124,77,255,0.03); }

        .pred-result {
            font-size: 80px; font-weight: 900; font-family: 'Orbitron', sans-serif;
            margin: 0 0 8px; transition: all 0.5s ease; line-height: 1; min-height: 90px;
            letter-spacing: 6px; text-align: center;
        }
        .pred-result.tai { color: #4fc3f7; text-shadow: 0 0 100px rgba(79,195,247,0.2); }
        .pred-result.xiu { color: #ef5350; text-shadow: 0 0 100px rgba(239,83,80,0.2); }
        .pred-result.waiting { color: rgba(255,255,255,0.06); animation: textPulse 1.8s ease-in-out infinite; font-size: 28px; letter-spacing: 8px; }
        @keyframes textPulse { 0%,100% { opacity: 0.2; } 50% { opacity: 0.5; } }

        .pred-meta { display: flex; justify-content: center; gap: 30px; flex-wrap: wrap; margin: 6px 0 8px; }
        .meta-item { display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .meta-item .label { font-size: 8px; color: rgba(255,255,255,0.15); text-transform: uppercase; letter-spacing: 1.5px; }
        .meta-item .value { font-size: 20px; font-weight: 700; font-family: 'Orbitron', sans-serif; }
        .meta-item .value.confidence { color: ${color}; }

        .bar-track { width: 100%; height: 5px; background: rgba(255,255,255,0.03); border-radius: 10px; overflow: hidden; margin-top: 6px; }
        .bar-fill { height: 100%; border-radius: 10px; background: linear-gradient(90deg, #ef5350, #ffd54f, ${color}); transition: width 0.8s ease; width: 0%; }

        .btn-history {
            display: inline-block; padding: 8px 24px; border-radius: 20px;
            border: 1px solid ${color}44; background: rgba(124,77,255,0.05);
            color: ${color}; font-size: 10px; font-weight: 500; cursor: pointer;
            transition: all 0.3s ease; text-decoration: none;
            font-family: 'Orbitron', sans-serif; letter-spacing: 0.5px;
        }
        .btn-history:hover { background: rgba(124,77,255,0.1); border-color: ${color}; }

        .footer { text-align: center; padding: 14px 20px 6px; color: rgba(255,255,255,0.04); font-size: 8px; border-top: 1px solid rgba(255,255,255,0.02); margin-top: 12px; font-family: 'Orbitron', sans-serif; letter-spacing: 1px; }
        .footer strong { color: ${color}; }

        @media (max-width: 768px) {
            .container { padding: 8px; }
            .header { padding: 8px 14px; flex-direction: column; align-items: stretch; gap: 4px; }
            .logo-text { font-size: 16px; }
            .logo-icon { width: 36px; height: 36px; font-size: 16px; }
            .header-right { justify-content: space-between; }
            .pred-result { font-size: 48px; min-height: 54px; }
            .pred-meta { gap: 16px; }
            .meta-item .value { font-size: 16px; }
            .card { padding: 14px; }
        }
        @media (max-width: 480px) {
            .container { padding: 4px; }
            .pred-result { font-size: 36px; min-height: 42px; }
        }
    </style>
</head>
<body>

<div class="bg-glow"></div>

<div class="container">

    <header class="header">
        <div class="logo">
            <div class="logo-icon">TX</div>
            <div>
                <div class="logo-text">PREDICTOR v6</div>
                <div class="logo-sub">ĐẠI CA KHÔI <span style="color:${color};">@2026</span></div>
            </div>
        </div>
        <div class="header-right">
            <span class="status-badge">
                <span class="status-dot"></span>
                <span>Live</span>
            </span>
            <span class="header-time" id="clockDisplay">--:--:--</span>
        </div>
    </header>

    <div class="nav-links">
        <a href="/" class="nav-link">🏠 Trang chủ</a>
        <a href="/hu" class="nav-link ${type === 'hu' ? 'active' : ''}">🎲 HŨ</a>
        <a href="/md5" class="nav-link ${type === 'md5' ? 'active' : ''}">🎲 MD5</a>
        <a href="/lichsu/${type}" class="nav-link">📊 Lịch sử</a>
    </div>

    <div class="card">
        <div style="text-align:center;margin-bottom:12px;">
            <span style="font-family:'Orbitron',sans-serif;font-size:12px;color:rgba(255,255,255,0.2);letter-spacing:2px;">
                🎲 DỰ ĐOÁN ${title}
            </span>
        </div>
        <div class="pred-area">
            <div class="pred-result waiting" id="result">---</div>
            <div class="pred-meta">
                <div class="meta-item">
                    <span class="label">Độ tin cậy</span>
                    <span class="value confidence" id="conf">0%</span>
                </div>
                <div class="meta-item">
                    <span class="label">Phiên</span>
                    <span class="value" id="phien" style="color:rgba(255,255,255,0.3);font-size:16px;">---</span>
                </div>
            </div>
            <div class="bar-track">
                <div class="bar-fill" id="bar"></div>
            </div>
        </div>
    </div>

    <div style="text-align:center;">
        <a href="/lichsu/${type}" class="btn-history"><i class="fas fa-history"></i> Xem lịch sử ${title}</a>
    </div>

    <div class="footer">
        <p>🚀 <strong>TX PREDICTOR v6</strong> © 2026 · ĐẠI CA KHÔI</p>
        <p style="font-size:6px;color:rgba(255,255,255,0.03);margin-top:2px;">30+ Cầu · 18+ Trend · Dice · Ensemble</p>
    </div>

</div>

<script>
document.addEventListener('gesturestart', function(e) { e.preventDefault(); });
document.addEventListener('touchstart', function(e) { if (e.touches.length > 1) e.preventDefault(); });
var lastTouchEnd = 0;
document.addEventListener('touchend', function(e) {
    var now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
}, false);
document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
document.addEventListener('keydown', function(e) {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I','J','C'].indexOf(e.key) > -1) || (e.ctrlKey && e.key === 'U')) {
        e.preventDefault();
        return false;
    }
});

function updateClock() {
    document.getElementById('clockDisplay').textContent = new Date().toLocaleTimeString('vi-VN', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

async function fetchAPI(endpoint) {
    try {
        var res = await fetch(endpoint);
        if (!res.ok) throw new Error('Network error');
        return await res.json();
    } catch (e) {
        console.error('API Error:', e);
        return null;
    }
}

async function fetchPrediction() {
    var data = await fetchAPI('/api/${type}');
    if (data) {
        var resultEl = document.getElementById('result');
        var confEl = document.getElementById('conf');
        var phienEl = document.getElementById('phien');
        var barEl = document.getElementById('bar');

        if (resultEl) {
            resultEl.textContent = data.duDoan || '---';
            resultEl.className = 'pred-result';
            if (data.duDoan === 'TAI') resultEl.classList.add('tai');
            else if (data.duDoan === 'XIU') resultEl.classList.add('xiu');
            else resultEl.classList.add('waiting');
        }

        if (confEl) confEl.textContent = data.doTinCay || '0%';
        if (phienEl) phienEl.textContent = '#' + data.phien || '---';

        var conf = parseInt(data.doTinCay) || 0;
        if (barEl) barEl.style.width = Math.min(100, conf) + '%';
    }
}

var isRefreshing = false;

async function refreshAll() {
    if (isRefreshing) return;
    isRefreshing = true;
    try {
        await fetchPrediction();
    } catch (e) {
        console.error('Refresh error:', e);
    }
    isRefreshing = false;
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 TX PREDICTOR v6 - ${title}');
    refreshAll();
    setInterval(refreshAll, 5000);

    setTimeout(function() {
        var badge = document.querySelector('.status-badge');
        if (badge) badge.innerHTML = '<span class="status-dot"></span><span>Ready</span>';
    }, 1000);
});
</script>
</body>
</html>`;
}

// ============================================================
// HÀM RENDER LỊCH SỬ
// ============================================================
function renderHistoryPage(type, title, color) {
    return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Lịch sử ${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Roboto', sans-serif;
            background: #0a0a1a;
            color: #fff;
            min-height: 100vh;
            overflow-x: hidden;
            user-select: none;
        }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        ::-webkit-scrollbar-thumb { background: ${color}; border-radius: 10px; }

        .bg-glow {
            position: fixed; top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: 0;
            background: radial-gradient(ellipse at 30% 20%, rgba(124,77,255,0.06), transparent 50%),
                        radial-gradient(ellipse at 70% 80%, rgba(0,245,255,0.04), transparent 50%);
        }

        .container { position: relative; z-index: 1; max-width: 1200px; margin: 0 auto; padding: 16px; min-height: 100vh; }

        .header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px 24px;
            background: rgba(255,255,255,0.03);
            backdrop-filter: blur(20px);
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.04);
            margin-bottom: 16px;
            flex-wrap: wrap;
            gap: 10px;
        }
        .logo { display: flex; align-items: center; gap: 12px; }
        .logo-icon {
            width: 44px; height: 44px;
            background: linear-gradient(135deg, ${color}, ${color}cc);
            border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; font-weight: 900; color: #fff;
            font-family: 'Orbitron', sans-serif;
            box-shadow: 0 0 40px rgba(124,77,255,0.15);
        }
        .logo-text {
            font-family: 'Orbitron', sans-serif;
            font-size: 20px; font-weight: 700;
            background: linear-gradient(135deg, ${color}, #7c4dff);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .logo-sub { font-size: 9px; color: rgba(255,255,255,0.3); letter-spacing: 2px; text-transform: uppercase; }
        .header-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .status-badge {
            display: flex; align-items: center; gap: 6px;
            padding: 4px 14px; background: rgba(0,255,136,0.06);
            border-radius: 20px; font-size: 10px; color: rgba(255,255,255,0.5);
            border: 1px solid rgba(0,255,136,0.06);
        }
        .status-dot { width: 7px; height: 7px; border-radius: 50%; background: #00ff88; animation: dotPulse 1.5s ease-in-out infinite; }
        .header-time { font-size: 11px; color: rgba(255,255,255,0.3); font-family: 'Orbitron', sans-serif; }

        .nav-links { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 16px; }
        .nav-link {
            padding: 4px 16px; border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.06);
            color: rgba(255,255,255,0.4); font-size: 8px;
            text-decoration: none; font-family: 'Orbitron', sans-serif;
            transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .nav-link:hover { border-color: ${color}; color: ${color}; background: rgba(124,77,255,0.05); }
        .nav-link.active { border-color: ${color}; color: ${color}; background: rgba(124,77,255,0.05); }

        .page-title {
            font-family: 'Orbitron', sans-serif;
            font-size: 24px; font-weight: 700;
            color: ${color};
            text-align: center;
            margin-bottom: 16px;
            letter-spacing: 2px;
        }

        .card {
            background: rgba(255,255,255,0.02);
            border-radius: 16px; border: 1px solid rgba(255,255,255,0.04);
            padding: 20px; transition: all 0.3s ease;
        }
        .card:hover { border-color: rgba(124,77,255,0.08); box-shadow: 0 0 60px rgba(124,77,255,0.03); }
        .card-title {
            font-family: 'Orbitron', sans-serif;
            font-size: 10px; color: rgba(255,255,255,0.3);
            margin-bottom: 12px; display: flex; align-items: center; gap: 8px;
            letter-spacing: 1px;
        }
        .card-title i { font-size: 13px; color: ${color}; }
        .card-badge {
            margin-left: auto; background: rgba(124,77,255,0.06);
            color: ${color}; padding: 2px 12px; border-radius: 20px;
            font-size: 7px; font-weight: 600; text-transform: uppercase;
        }

        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
        @media (max-width: 600px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
        .stat-card {
            background: rgba(255,255,255,0.01); border-radius: 12px;
            padding: 12px 8px; text-align: center;
            border: 1px solid rgba(255,255,255,0.01);
            transition: all 0.3s ease;
        }
        .stat-card:hover { background: rgba(255,255,255,0.02); border-color: rgba(124,77,255,0.03); }
        .stat-number { font-size: 26px; font-weight: 700; font-family: 'Orbitron', sans-serif; color: ${color}; }
        .stat-number.good { color: #66bb6a; }
        .stat-number.bad { color: #ef5350; }
        .stat-number.winrate { color: #ffd54f; }
        .stat-label { font-size: 8px; color: rgba(255,255,255,0.15); text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }

        .history-container { max-height: 500px; overflow-y: auto; margin-top: 4px; }
        .history-table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .history-table thead { position: sticky; top: 0; z-index: 2; }
        .history-table th {
            text-align: left; padding: 6px 8px;
            color: rgba(255,255,255,0.12); font-size: 8px; text-transform: uppercase;
            letter-spacing: 1px; border-bottom: 1px solid rgba(255,255,255,0.03);
            background: rgba(10,10,26,0.95); backdrop-filter: blur(10px);
            font-weight: 500;
        }
        .history-table td { padding: 5px 8px; border-bottom: 1px solid rgba(255,255,255,0.01); color: rgba(255,255,255,0.35); font-size: 10px; }
        .history-table tr:hover td { background: rgba(255,255,255,0.01); }
        .history-table .phien { color: #fff; font-family: 'Orbitron', sans-serif; font-size: 9px; }
        .history-table .win { color: #66bb6a; font-weight: 600; }
        .history-table .lose { color: #ef5350; font-weight: 600; }
        .history-table .pending { color: #ffd54f; }

        .scroll-hint { text-align: center; padding: 8px; color: rgba(255,255,255,0.04); font-size: 7px; letter-spacing: 1px; }

        .btn-back {
            display: inline-block; padding: 8px 24px; border-radius: 20px;
            border: 1px solid ${color}44; background: rgba(124,77,255,0.05);
            color: ${color}; font-size: 10px; font-weight: 500; cursor: pointer;
            transition: all 0.3s ease; text-decoration: none;
            font-family: 'Orbitron', sans-serif; letter-spacing: 0.5px;
        }
        .btn-back:hover { background: rgba(124,77,255,0.1); border-color: ${color}; }

        .footer { text-align: center; padding: 14px 20px 6px; color: rgba(255,255,255,0.04); font-size: 8px; border-top: 1px solid rgba(255,255,255,0.02); margin-top: 12px; font-family: 'Orbitron', sans-serif; letter-spacing: 1px; }
        .footer strong { color: ${color}; }

        @media (max-width: 768px) {
            .container { padding: 8px; }
            .header { padding: 8px 14px; flex-direction: column; align-items: stretch; gap: 4px; }
            .logo-text { font-size: 16px; }
            .logo-icon { width: 36px; height: 36px; font-size: 16px; }
            .header-right { justify-content: space-between; }
            .page-title { font-size: 18px; }
            .stat-number { font-size: 18px; }
            .history-table { font-size: 9px; }
            .history-table th, .history-table td { padding: 3px 5px; }
        }
        @media (max-width: 480px) {
            .container { padding: 4px; }
            .page-title { font-size: 14px; }
            .stats-grid { gap: 4px; }
            .stat-number { font-size: 14px; }
            .stat-card { padding: 6px 3px; }
            .history-table { font-size: 7px; }
            .history-table th, .history-table td { padding: 2px 4px; }
        }
    </style>
</head>
<body>

<div class="bg-glow"></div>

<div class="container">

    <header class="header">
        <div class="logo">
            <div class="logo-icon">TX</div>
            <div>
                <div class="logo-text">PREDICTOR v6</div>
                <div class="logo-sub">ĐẠI CA KHÔI <span style="color:${color};">@2026</span></div>
            </div>
        </div>
        <div class="header-right">
            <span class="status-badge">
                <span class="status-dot"></span>
                <span>Live</span>
            </span>
            <span class="header-time" id="clockDisplay">--:--:--</span>
            <a href="/${type}" class="btn-back"><i class="fas fa-arrow-left"></i> Dự đoán</a>
        </div>
    </header>

    <div class="nav-links">
        <a href="/" class="nav-link">🏠 Trang chủ</a>
        <a href="/hu" class="nav-link ${type === 'hu' ? 'active' : ''}">🎲 HŨ</a>
        <a href="/md5" class="nav-link ${type === 'md5' ? 'active' : ''}">🎲 MD5</a>
        <a href="/lichsu/${type}" class="nav-link active">📊 Lịch sử</a>
    </div>

    <div class="page-title">
        📊 LỊCH SỬ ${title}
    </div>

    <div class="card" style="margin-bottom:12px;">
        <div class="card-title">
            <i class="fas fa-chart-line"></i> THỐNG KÊ ${title}
            <span class="card-badge">THỰC TẾ</span>
        </div>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number" id="totalPreds">0</div>
                <div class="stat-label">Tổng phiên</div>
            </div>
            <div class="stat-card">
                <div class="stat-number good" id="totalCorrect">0</div>
                <div class="stat-label">Thắng</div>
            </div>
            <div class="stat-card">
                <div class="stat-number bad" id="totalWrong">0</div>
                <div class="stat-label">Thua</div>
            </div>
            <div class="stat-card">
                <div class="stat-number winrate" id="winRate">0%</div>
                <div class="stat-label">Tỷ lệ thắng</div>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="card-title">
            <i class="fas fa-history"></i> CHI TIẾT ${title}
            <span class="card-badge">1000 phiên</span>
        </div>
        <div class="history-container">
            <table class="history-table">
                <thead>
                    <tr>
                        <th>Phiên</th>
                        <th>Dự đoán</th>
                        <th>Kết quả</th>
                        <th>Độ tin cậy</th>
                        <th>Trạng thái</th>
                    </tr>
                </thead>
                <tbody id="historyBody">
                    <tr>
                        <td colspan="5" style="text-align:center;padding:20px;color:rgba(255,255,255,0.06);font-size:10px;">
                            <i class="fas fa-spinner fa-spin"></i> Đang tải...
                        </td>
                    </tr>
                </tbody>
            </table>
            <div class="scroll-hint">↓ Cuộn để xem thêm</div>
        </div>
    </div>

    <div class="footer">
        <p>🚀 <strong>TX PREDICTOR v6</strong> © 2026 · ĐẠI CA KHÔI</p>
        <p style="font-size:6px;color:rgba(255,255,255,0.03);margin-top:2px;">30+ Cầu · 18+ Trend · Dice · Ensemble</p>
    </div>

</div>

<script>
document.addEventListener('gesturestart', function(e) { e.preventDefault(); });
document.addEventListener('touchstart', function(e) { if (e.touches.length > 1) e.preventDefault(); });
var lastTouchEnd = 0;
document.addEventListener('touchend', function(e) {
    var now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
}, false);
document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
document.addEventListener('keydown', function(e) {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I','J','C'].indexOf(e.key) > -1) || (e.ctrlKey && e.key === 'U')) {
        e.preventDefault();
        return false;
    }
});

function updateClock() {
    document.getElementById('clockDisplay').textContent = new Date().toLocaleTimeString('vi-VN', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

async function fetchAPI(endpoint) {
    try {
        var res = await fetch(endpoint);
        if (!res.ok) throw new Error('Network error');
        return await res.json();
    } catch (e) {
        console.error('API Error:', e);
        return null;
    }
}

async function fetchHistory() {
    var data = await fetchAPI('/api/history/${type}');
    if (data) {
        renderHistory(data.history || []);
        updateStats(data.history || []);
    }
}

function renderHistory(history) {
    var tbody = document.getElementById('historyBody');
    if (!history || history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:rgba(255,255,255,0.06);">Chưa có dữ liệu</td></tr>';
        return;
    }

    var rows = '';
    for (var i = 0; i < Math.min(history.length, 100); i++) {
        var r = history[i];
        var statusClass = r.trangThai === 'WIN' ? 'win' : (r.trangThai === 'LOSE' ? 'lose' : 'pending');
        var statusText = r.trangThai === 'WIN' ? '✅ THẮNG' : (r.trangThai === 'LOSE' ? '❌ THUA' : '⏳ CHỜ');
        rows += '<tr>' +
            '<td class="phien">#' + r.phien + '</td>' +
            '<td>' + (r.duDoan || '---') + '</td>' +
            '<td>' + (r.ketQua || '---') + '</td>' +
            '<td>' + (r.do_tin_cay || '0%') + '</td>' +
            '<td class="' + statusClass + '">' + statusText + '</td>' +
            '</tr>';
    }
    tbody.innerHTML = rows;
}

function updateStats(history) {
    if (!history || history.length === 0) {
        document.getElementById('totalPreds').textContent = 0;
        document.getElementById('totalCorrect').textContent = 0;
        document.getElementById('totalWrong').textContent = 0;
        document.getElementById('winRate').textContent = '0%';
        return;
    }

    var total = history.length;
    var wins = 0, loses = 0;
    for (var i = 0; i < history.length; i++) {
        if (history[i].trangThai === 'WIN') wins++;
        else if (history[i].trangThai === 'LOSE') loses++;
    }

    document.getElementById('totalPreds').textContent = total;
    document.getElementById('totalCorrect').textContent = wins;
    document.getElementById('totalWrong').textContent = loses;
    document.getElementById('winRate').textContent = total > 0 ? (wins / total * 100).toFixed(1) + '%' : '0%';
}

var refreshInterval;

function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(function() {
        fetchHistory();
    }, 5000);
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 TX PREDICTOR v6 - LỊCH SỬ ${title}');
    fetchHistory();
    startAutoRefresh();
});
</script>
</body>
</html>`;
}

// ============================================================
// ROUTES
// ============================================================

// Trang chủ
app.get('/', function(req, res) {
    res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>TX PREDICTOR v6 - ĐẠI CA KHÔI</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Roboto', sans-serif;
            background: #0a0a1a;
            color: #fff;
            min-height: 100vh;
            overflow-x: hidden;
            user-select: none;
        }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        ::-webkit-scrollbar-thumb { background: #7c4dff; border-radius: 10px; }

        .bg-glow {
            position: fixed; top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: 0;
            background: radial-gradient(ellipse at 30% 20%, rgba(124,77,255,0.06), transparent 50%),
                        radial-gradient(ellipse at 70% 80%, rgba(0,245,255,0.04), transparent 50%);
        }

        .container { position: relative; z-index: 1; max-width: 1200px; margin: 0 auto; padding: 16px; min-height: 100vh; }

        .header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px 24px;
            background: rgba(255,255,255,0.03);
            backdrop-filter: blur(20px);
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.04);
            margin-bottom: 16px;
            flex-wrap: wrap;
            gap: 10px;
        }
        .logo { display: flex; align-items: center; gap: 12px; }
        .logo-icon {
            width: 44px; height: 44px;
            background: linear-gradient(135deg, #7c4dff, #b388ff);
            border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; font-weight: 900; color: #fff;
            font-family: 'Orbitron', sans-serif;
            box-shadow: 0 0 40px rgba(124,77,255,0.15);
        }
        .logo-text {
            font-family: 'Orbitron', sans-serif;
            font-size: 20px; font-weight: 700;
            background: linear-gradient(135deg, #b388ff, #7c4dff);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .logo-sub { font-size: 9px; color: rgba(255,255,255,0.3); letter-spacing: 2px; text-transform: uppercase; }
        .header-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .status-badge {
            display: flex; align-items: center; gap: 6px;
            padding: 4px 14px; background: rgba(0,255,136,0.06);
            border-radius: 20px; font-size: 10px; color: rgba(255,255,255,0.5);
            border: 1px solid rgba(0,255,136,0.06);
        }
        .status-dot { width: 7px; height: 7px; border-radius: 50%; background: #00ff88; animation: dotPulse 1.5s ease-in-out infinite; }
        .header-time { font-size: 11px; color: rgba(255,255,255,0.3); font-family: 'Orbitron', sans-serif; }

        .nav-links { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 16px; }
        .nav-link {
            padding: 4px 16px; border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.06);
            color: rgba(255,255,255,0.4); font-size: 8px;
            text-decoration: none; font-family: 'Orbitron', sans-serif;
            transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .nav-link:hover { border-color: #b388ff; color: #b388ff; background: rgba(124,77,255,0.05); }
        .nav-link.active { border-color: #b388ff; color: #b388ff; background: rgba(124,77,255,0.05); }

        .welcome {
            text-align: center;
            padding: 40px 20px;
            background: rgba(255,255,255,0.02);
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.04);
            margin-bottom: 16px;
        }
        .welcome h1 {
            font-family: 'Orbitron', sans-serif;
            font-size: 32px;
            font-weight: 900;
            background: linear-gradient(135deg, #b388ff, #7c4dff);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            margin-bottom: 12px;
        }
        .welcome p { color: rgba(255,255,255,0.4); font-size: 14px; letter-spacing: 1px; }
        .welcome .version { color: rgba(255,255,255,0.15); font-size: 10px; margin-top: 8px; font-family: 'Orbitron', sans-serif; letter-spacing: 2px; }

        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        @media (max-width: 992px) { .grid { grid-template-columns: 1fr; } }

        .menu-card {
            background: rgba(255,255,255,0.02);
            border-radius: 16px; border: 1px solid rgba(255,255,255,0.04);
            padding: 30px 20px;
            text-align: center;
            transition: all 0.3s ease;
            text-decoration: none;
            color: #fff;
            display: block;
        }
        .menu-card:hover { border-color: rgba(124,77,255,0.08); box-shadow: 0 0 60px rgba(124,77,255,0.03); transform: translateY(-4px); }
        .menu-card .icon { font-size: 40px; margin-bottom: 12px; display: block; }
        .menu-card .title { font-family: 'Orbitron', sans-serif; font-size: 16px; font-weight: 700; }
        .menu-card .desc { font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 4px; }

        .footer { text-align: center; padding: 14px 20px 6px; color: rgba(255,255,255,0.04); font-size: 8px; border-top: 1px solid rgba(255,255,255,0.02); margin-top: 12px; font-family: 'Orbitron', sans-serif; letter-spacing: 1px; }
        .footer strong { color: #b388ff; }

        @media (max-width: 768px) {
            .container { padding: 8px; }
            .header { padding: 8px 14px; flex-direction: column; align-items: stretch; gap: 4px; }
            .logo-text { font-size: 16px; }
            .logo-icon { width: 36px; height: 36px; font-size: 16px; }
            .header-right { justify-content: space-between; }
            .welcome h1 { font-size: 24px; }
            .grid { gap: 10px; }
            .menu-card { padding: 20px 14px; }
            .menu-card .icon { font-size: 30px; }
        }
        @media (max-width: 480px) {
            .container { padding: 4px; }
            .welcome h1 { font-size: 18px; }
            .menu-card .title { font-size: 13px; }
        }
    </style>
</head>
<body>

<div class="bg-glow"></div>

<div class="container">

    <header class="header">
        <div class="logo">
            <div class="logo-icon">TX</div>
            <div>
                <div class="logo-text">PREDICTOR v6</div>
                <div class="logo-sub">ĐẠI CA KHÔI <span style="color:#b388ff;">@2026</span></div>
            </div>
        </div>
        <div class="header-right">
            <span class="status-badge">
                <span class="status-dot"></span>
                <span>Live</span>
            </span>
            <span class="header-time" id="clockDisplay">--:--:--</span>
        </div>
    </header>

    <div class="nav-links">
        <a href="/" class="nav-link active">🏠 Trang chủ</a>
        <a href="/hu" class="nav-link">🎲 HŨ</a>
        <a href="/md5" class="nav-link">🎲 MD5</a>
        <a href="/lichsu/hu" class="nav-link">📊 Lịch sử HŨ</a>
        <a href="/lichsu/md5" class="nav-link">📊 Lịch sử MD5</a>
    </div>

    <div class="welcome">
        <h1>TX PREDICTOR v6</h1>
        <p>🚀 Hệ thống dự đoán Tài Xỉu siêu chính xác</p>
        <p class="version">🧠 30+ Cầu · 18+ Trend · Dice · Ensemble</p>
    </div>

    <div class="grid">
        <a href="/hu" class="menu-card">
            <span class="icon">🎲</span>
            <div class="title">Dự đoán HŨ</div>
            <div class="desc">Phân tích và dự đoán Tài Xỉu HŨ</div>
        </a>
        <a href="/md5" class="menu-card">
            <span class="icon">🎲</span>
            <div class="title">Dự đoán MD5</div>
            <div class="desc">Phân tích và dự đoán Tài Xỉu MD5</div>
        </a>
        <a href="/lichsu/hu" class="menu-card">
            <span class="icon">📊</span>
            <div class="title">Lịch sử HŨ</div>
            <div class="desc">Thống kê thắng thua HŨ</div>
        </a>
        <a href="/lichsu/md5" class="menu-card">
            <span class="icon">📊</span>
            <div class="title">Lịch sử MD5</div>
            <div class="desc">Thống kê thắng thua MD5</div>
        </a>
    </div>

    <div class="footer">
        <p>🚀 <strong>TX PREDICTOR v6</strong> © 2026 · ĐẠI CA KHÔI</p>
        <p style="font-size:6px;color:rgba(255,255,255,0.03);margin-top:2px;">30+ Cầu · 18+ Trend · Dice · Ensemble</p>
    </div>

</div>

<script>
document.addEventListener('gesturestart', function(e) { e.preventDefault(); });
document.addEventListener('touchstart', function(e) { if (e.touches.length > 1) e.preventDefault(); });
var lastTouchEnd = 0;
document.addEventListener('touchend', function(e) {
    var now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
}, false);
document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
document.addEventListener('keydown', function(e) {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I','J','C'].indexOf(e.key) > -1) || (e.ctrlKey && e.key === 'U')) {
        e.preventDefault();
        return false;
    }
});

function updateClock() {
    document.getElementById('clockDisplay').textContent = new Date().toLocaleTimeString('vi-VN', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();
</script>
</body>
</html>`);
});

// Dự đoán HU
app.get('/hu', function(req, res) {
    res.send(renderPredictionPage('HŨ', 'hu', '#4fc3f7'));
});

// Dự đoán MD5
app.get('/md5', function(req, res) {
    res.send(renderPredictionPage('MD5', 'md5', '#ff6b6b'));
});

// Lịch sử HU
app.get('/lichsu/hu', function(req, res) {
    res.send(renderHistoryPage('hu', 'HŨ', '#4fc3f7'));
});

// Lịch sử MD5
app.get('/lichsu/md5', function(req, res) {
    res.send(renderHistoryPage('md5', 'MD5', '#ff6b6b'));
});

// ============================================================
// API
// ============================================================
app.get('/api/hu', async function(req, res) {
    try {
        var data = await fetchHu();
        if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu HU' });
        var result = calculatePrediction(data, 'hu');
        res.json({
            phien: data[0]?.Phien + 1 || 0,
            duDoan: result.prediction,
            doTinCay: result.confidence.toFixed(0) + '%'
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/md5', async function(req, res) {
    try {
        var data = await fetchMd5();
        if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu MD5' });
        var result = calculatePrediction(data, 'md5');
        res.json({
            phien: data[0]?.Phien + 1 || 0,
            duDoan: result.prediction,
            doTinCay: result.confidence.toFixed(0) + '%'
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/history/:type', function(req, res) {
    var type = req.params.type;
    if (type === 'all') {
        var all = (historyData.hu || []).concat(historyData.md5 || []);
        all.sort(function(a, b) { return (b.phien || 0) - (a.phien || 0); });
        res.json({ history: all, total: all.length });
    } else if (type === 'hu') {
        res.json({ history: historyData.hu || [], total: (historyData.hu || []).length });
    } else if (type === 'md5') {
        res.json({ history: historyData.md5 || [], total: (historyData.md5 || []).length });
    } else {
        res.json({ history: [], total: 0 });
    }
});

app.get('/api/reset', function(req, res) {
    historyData = { hu: [], md5: [] };
    saveHistory();
    res.json({ message: 'Reset thành công' });
});

// ============================================================
// KHỞI ĐỘNG SERVER
// ============================================================
loadHistory();
app.listen(PORT, '0.0.0.0', function() {
    console.log('========================================');
    console.log('🚀 TX PREDICTOR v6 - ĐẠI CA KHÔI');
    console.log('🧠 30+ Cầu · 18+ Trend · Dice · Ensemble');
    console.log('Server: http://0.0.0.0:' + PORT);
    console.log('========================================');
});
