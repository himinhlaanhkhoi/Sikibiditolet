/**
 * server.js - Sunwin Tài Xỉu Analyzer (TX_GlassCore_V6)
 * Giao diện Glassmorphism đa phong cách (Dark Glass, Neon Glass, Aurora, Holographic, Minimal)
 * Tự động đồng bộ API: https://sunwin-taixiu-dulieu.onrender.com/data
 * Developer: Anh Khôi
 */

const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = 'https://sunwin-taixiu-dulieu.onrender.com/data';
const HISTORY_LIMIT = 500;

const vnNow = () => {
    const d = new Date();
    return new Date(d.getTime() + (7 * 60 * 60 * 1000)).toISOString();
};

let stats = {
    total: 0,
    correct: 0,
    wrong: 0,
    last_prediction: null,
    start_time: vnNow(),
    history: [],
    total_predictions_made: 0,
    prediction_started: false
};

class TX_GlassCore_V6 {
    constructor() {
        this.error_streak = 0;
        this.last_prediction = null;
        this.history = [];
    }

    loadData(data) {
        this.history = [...data].sort((a, b) => (b.phien || 0) - (a.phien || 0));
    }

    _arr() {
        return this.history.map(s =>
            (s.ket_qua || '').toUpperCase().replace('XỈU', 'XIU').replace('TÀI', 'TAI')
        );
    }

    _points() {
        return this.history
            .filter(s => s.tong !== undefined && s.tong !== null)
            .map(s => Number(s.tong));
    }

    // 1. Phân tích chuỗi kết quả (Cầu bệt & Bẻ cầu)
    phanTichCauBet(arr) {
        if (arr.length < 2) return null;
        let length = 1;
        for (let i = 1; i < arr.length; i++) {
            if (arr[i] === arr[0]) length++;
            else break;
        }
        if (length >= 2 && length <= 4) {
            return { pred: arr[0], conf: 78, loai: "Đu Cầu Bệt", lyDo: `Chuỗi ${arr[0] === 'TAI' ? 'Tài' : 'Xỉu'} đang duy trì ${length} phiên` };
        }
        if (length >= 5) {
            const nextPred = arr[0] === "TAI" ? "XIU" : "TAI";
            return { pred: nextPred, conf: 82, loai: "Bẻ Cầu Bệt", lyDo: `Chuỗi bệt dài ${length} phiên → Xác suất bẻ sang ${nextPred === 'TAI' ? 'Tài' : 'Xỉu'}` };
        }
        return null;
    }

    // 2. Phân tích chuỗi xen kẽ (1-1, 2-2, 3-3)
    phanTichXenKe(arr) {
        if (arr.length < 4) return null;
        
        // Nhịp 1-1
        let is11 = true;
        for (let i = 0; i < Math.min(5, arr.length - 1); i++) {
            if (arr[i] === arr[i + 1]) { is11 = false; break; }
        }
        if (is11 && arr.length >= 4) {
            const nextPred = arr[0] === "TAI" ? "XIU" : "TAI";
            return { pred: nextPred, conf: 84, loai: "Cầu Nối 1-1", lyDo: "Nhịp đảo 1-1 liên tiếp ổn định" };
        }

        // Nhịp 2-2 (AABB)
        if (arr.length >= 4 && arr[0] === arr[1] && arr[2] === arr[3] && arr[0] !== arr[2]) {
            return { pred: arr[2], conf: 80, loai: "Cầu Nhịp 2-2", lyDo: "Mô hình AABB → Báo tín hiệu nối nhịp" };
        }

        // Nhịp 3-3 (AAABBB)
        if (arr.length >= 6 && arr[0] === arr[1] && arr[1] === arr[2] && arr[3] === arr[4] && arr[4] === arr[5] && arr[0] !== arr[3]) {
            return { pred: arr[3], conf: 83, loai: "Cầu Nhịp 3-3", lyDo: "Mô hình AAABBB → Tiếp diễn nhịp đôi" };
        }

        return null;
    }

    // 3. Nhận diện mẫu lặp chuỗi (Pattern Matching)
    phanTichMauLap(arr) {
        if (arr.length < 8) return null;
        for (let len = 2; len <= 4; len++) {
            const pattern = arr.slice(0, len);
            for (let i = len; i <= arr.length - len - 1; i++) {
                const sub = arr.slice(i, i + len);
                if (JSON.stringify(sub) === JSON.stringify(pattern)) {
                    const historicalNext = arr[i - 1];
                    if (historicalNext) {
                        return { pred: historicalNext, conf: 86, loai: "Mẫu Lặp Thuật Toán", lyDo: `Khớp mẫu lịch sử [${pattern.join('-')}] → Tiếp theo thường về ${historicalNext === 'TAI' ? 'Tài' : 'Xỉu'}` };
                    }
                }
            }
        }
        return null;
    }

    // 4. Phân tích điểm xúc xắc (Thống kê & Trung bình động SMA)
    phanTichXucXac() {
        const points = this._points();
        if (points.length < 5) return null;
        const last = points[0];
        const recentSlice = points.slice(0, 5);
        const avg = recentSlice.reduce((a, b) => a + b, 0) / recentSlice.length;

        // Điểm cực trị (Mean Reversion)
        if (last >= 16) {
            return { pred: "XIU", conf: 85, loai: "Hồi Điểm Cực Đại", lyDo: `Tổng điểm ${last} quá cao → Lực kéo về Xỉu rất lớn` };
        }
        if (last <= 5) {
            return { pred: "TAI", conf: 85, loai: "Hồi Điểm Cực Tiểu", lyDo: `Tổng điểm ${last} quá thấp → Lực kéo về Tài rất lớn` };
        }

        // Động lượng điểm số
        if (avg >= 11.8) {
            return { pred: "XIU", conf: 72, loai: "Cân Bằng Biên Độ", lyDo: `Trung bình 5 phiên (${avg.toFixed(1)}) lệch cao nghiêng Tài` };
        }
        if (avg <= 9.2) {
            return { pred: "TAI", conf: 72, loai: "Cân Bằng Biên Độ", lyDo: `Trung bình 5 phiên (${avg.toFixed(1)}) lệch thấp nghiêng Xỉu` };
        }

        return null;
    }

    // Tổng hợp thuật toán thực tế (KHÔNG tự đảo ngược khi thua)
    tongHopDuDoan() {
        const arr = this._arr();
        if (arr.length < 2) return null;

        // Ưu tiên thuật toán có độ chính xác cao nhất
        return this.phanTichMauLap(arr) ||
               this.phanTichXenKe(arr) ||
               this.phanTichCauBet(arr) ||
               this.phanTichXucXac() ||
               { pred: arr[0], conf: 60, loai: "Theo Xu Hướng", lyDo: "Đi theo kết quả của phiên gần nhất" };
    }

    predict(data) {
        this.loadData(data);
        const result = this.tongHopDuDoan() || { pred: this._arr()[0] || "TAI", conf: 50, loai: "Phân Tích Cơ Bản", lyDo: "Đang nạp dữ liệu phiên" };
        this.last_prediction = result.pred;
        return result;
    }

    updateStatus(actual) {
        if (this.last_prediction) {
            const a = actual.toUpperCase().replace('XỈU', 'XIU').replace('TÀI', 'TAI');
            if (this.last_prediction === a) {
                this.error_streak = 0;
            } else {
                this.error_streak++;
            }
        }
    }
}

const engine = new TX_GlassCore_V6();

let lastData = [];
let lastPrediction = null;
let predictionLog = [];

async function fetchAndAnalyze() {
    try {
        const res = await axios.get(API_URL, { timeout: 12000 });
        const raw = res.data;

        if (!raw || !raw.data || !Array.isArray(raw.data)) {
            console.log('API trả dữ liệu không hợp lệ');
            return;
        }

        const data = raw.data
            .filter(i => i.phien && i.ket_qua)
            .sort((a, b) => b.phien - a.phien)
            .slice(0, HISTORY_LIMIT);

        lastData = data;

        if (lastPrediction && data.length > 0) {
            const newest = data[0];
            if (newest.phien === lastPrediction.phienDuDoan) {
                const actualRaw = newest.ket_qua;
                const actual = actualRaw.toUpperCase().replace('XỈU', 'XIU').replace('TÀI', 'TAI');
                const isCorrect = lastPrediction.pred === actual;

                engine.updateStatus(actualRaw);

                predictionLog.unshift({
                    phien: newest.phien,
                    predict: lastPrediction.pred,
                    actual: actual,
                    confidence: lastPrediction.conf,
                    loai: lastPrediction.loai,
                    correct: isCorrect,
                    time: newest.thoi_gian || vnNow()
                });
                if (predictionLog.length > 100) predictionLog.pop();

                stats.total++;
                if (isCorrect) stats.correct++;
                else stats.wrong++;
                stats.total_predictions_made++;
                stats.last_prediction = lastPrediction.pred;

                console.log(`[Phiên #${newest.phien}] Dự đoán: ${lastPrediction.pred} | Thực tế: ${actual} | Kết quả: ${isCorrect ? 'ĐÚNG' : 'SAI'} | Streak sai: ${engine.error_streak}`);
                lastPrediction = null;
            }
        }

        if (data.length >= 5) {
            const result = engine.predict(data);
            const nextPhien = data[0].phien + 1;
            const displayPred = result.pred === 'TAI' ? 'Tài' : 'Xỉu';

            lastPrediction = {
                phienDuDoan: nextPhien,
                pred: result.pred,
                display: displayPred,
                conf: result.conf,
                loai: result.loai,
                lyDo: result.lyDo,
                timestamp: vnNow()
            };

            stats.prediction_started = true;
            console.log(`[Dự đoán mới] #${nextPhien} -> ${displayPred} (${result.conf}%) | ${result.loai}`);
        }
    } catch (err) {
        console.error('Lỗi fetch API:', err.message);
    }
}

fetchAndAnalyze();
setInterval(fetchAndAnalyze, 18000);

// ====================== UI GLASSMORPHISM MODERN ======================
app.get('/', (req, res) => {
    const html = `
<!DOCTYPE html>
<html lang="vi" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sunwin Glassmorphic Analyzer V6</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    /* Theme Variables - Dynamic Glassmorphism */
    :root[data-theme="dark"] {
      --bg-gradient: radial-gradient(circle at 50% 0%, #181d28 0%, #080a0f 100%);
      --glass-bg: rgba(20, 26, 38, 0.55);
      --glass-border: rgba(255, 255, 255, 0.12);
      --glass-highlight: rgba(255, 255, 255, 0.05);
      --glass-glow: rgba(0, 0, 0, 0.5);
      --accent: #3b82f6;
      --text-main: #f8fafc;
      --text-sub: #94a3b8;
      --theme-name: "Dark Glass";
    }

    :root[data-theme="neon"] {
      --bg-gradient: radial-gradient(circle at 20% 20%, #15002b 0%, #030008 100%);
      --glass-bg: rgba(25, 10, 40, 0.6);
      --glass-border: rgba(0, 240, 255, 0.3);
      --glass-highlight: rgba(0, 240, 255, 0.1);
      --glass-glow: rgba(0, 240, 255, 0.25);
      --accent: #00f0ff;
      --text-main: #ffffff;
      --text-sub: #c084fc;
      --theme-name: "Neon Cyber Glass";
    }

    :root[data-theme="aurora"] {
      --bg-gradient: radial-gradient(circle at 80% 20%, #0d302a 0%, #020b0a 100%);
      --glass-bg: rgba(12, 38, 34, 0.55);
      --glass-border: rgba(52, 211, 153, 0.25);
      --glass-highlight: rgba(52, 211, 153, 0.1);
      --glass-glow: rgba(16, 185, 129, 0.2);
      --accent: #10b981;
      --text-main: #ecfdf5;
      --text-sub: #6ee7b7;
      --theme-name: "Aurora Glass";
    }

    :root[data-theme="holo"] {
      --bg-gradient: radial-gradient(circle at 50% 30%, #320a40 0%, #09020f 100%);
      --glass-bg: rgba(45, 15, 60, 0.55);
      --glass-border: rgba(244, 114, 182, 0.3);
      --glass-highlight: rgba(244, 114, 182, 0.12);
      --glass-glow: rgba(236, 72, 153, 0.25);
      --accent: #f472b6;
      --text-main: #fdf2f8;
      --text-sub: #fbcfe8;
      --theme-name: "Holographic UI";
    }

    :root[data-theme="minimal"] {
      --bg-gradient: radial-gradient(circle at 50% 0%, #1e293b 0%, #0f172a 100%);
      --glass-bg: rgba(255, 255, 255, 0.05);
      --glass-border: rgba(255, 255, 255, 0.15);
      --glass-highlight: rgba(255, 255, 255, 0.08);
      --glass-glow: rgba(0, 0, 0, 0.2);
      --accent: #e2e8f0;
      --text-main: #ffffff;
      --text-sub: #cbd5e1;
      --theme-name: "Minimal Frosted";
    }

    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }

    body {
      background: var(--bg-gradient);
      color: var(--text-main);
      min-height: 100vh;
      padding: 30px 16px 60px;
      overflow-x: hidden;
      transition: background 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .container {
      max-width: 1060px;
      margin: 0 auto;
    }

    /* Floating Color Switcher Bubble (Cục đổi màu nhỏ ở góc phải) */
    .color-switcher-bubble {
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 9999;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--glass-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border);
      box-shadow: 0 10px 25px var(--glass-glow), inset 0 1px 1px var(--glass-highlight);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .color-switcher-bubble:hover {
      transform: scale(1.12) rotate(15deg);
    }

    .color-switcher-bubble:active {
      transform: scale(0.95);
    }

    .bubble-dot {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: linear-gradient(135deg, #00f0ff 0%, #f472b6 50%, #10b981 100%);
      box-shadow: 0 0 12px rgba(255, 255, 255, 0.6);
    }

    /* Card Wrapper với Glassmorphism Premium */
    .glass-panel {
      background: var(--glass-bg);
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      border: 1px solid var(--glass-border);
      border-radius: 24px;
      padding: 26px;
      margin-bottom: 22px;
      box-shadow: 0 20px 40px var(--glass-glow), inset 0 1px 0 var(--glass-highlight);
      transition: background 0.5s ease, border 0.5s ease;
      position: relative;
      overflow: hidden;
    }

    /* Top Section / Header */
    .header-panel {
      text-align: center;
      padding: 28px 20px;
    }

    .app-title {
      font-size: 2.1rem;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #ffffff 30%, var(--text-sub) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .developer-tag {
      font-size: 0.95rem;
      color: var(--text-sub);
      font-weight: 500;
      margin-bottom: 14px;
    }

    .developer-tag strong {
      color: var(--text-main);
      font-weight: 700;
    }

    .disclaimer-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: #fbbf24;
      padding: 6px 16px;
      border-radius: 999px;
      font-size: 0.82rem;
      font-weight: 500;
    }

    /* Bố cục Grid 2 cột */
    .grid-2 {
      display: grid;
      grid-template-columns: 1.25fr 1fr;
      gap: 22px;
    }

    @media (max-width: 820px) {
      .grid-2 { grid-template-columns: 1fr; }
      .color-switcher-bubble { top: 16px; right: 16px; }
    }

    .section-title {
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 1.2px;
      color: var(--text-sub);
      text-transform: uppercase;
      margin-bottom: 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    /* Thẻ Dự Đoán */
    .pred-value {
      font-size: 3.5rem;
      font-weight: 800;
      line-height: 1;
      margin-bottom: 6px;
      letter-spacing: -1px;
    }

    .tai-color { color: #34d399; text-shadow: 0 0 35px rgba(52, 211, 153, 0.4); }
    .xiu-color { color: #f87171; text-shadow: 0 0 35px rgba(248, 113, 113, 0.4); }

    .pred-confidence {
      font-size: 1.35rem;
      font-weight: 700;
      color: #fbbf24;
      margin-bottom: 16px;
    }

    .pred-info-list {
      font-size: 0.92rem;
      color: var(--text-sub);
      line-height: 1.6;
    }

    .pred-info-list div span {
      color: var(--text-main);
      font-weight: 600;
    }

    /* Bảng Thống Kê Hiệu Suất */
    .stats-matrix {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }

    .stat-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--glass-border);
      border-radius: 16px;
      padding: 14px;
      text-align: center;
    }

    .stat-num {
      font-size: 1.6rem;
      font-weight: 700;
      margin-bottom: 2px;
    }

    .stat-lbl {
      font-size: 0.75rem;
      color: var(--text-sub);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .num-ok { color: #34d399; }
    .num-err { color: #f87171; }
    .num-acc { color: #60a5fa; }

    .streak-container {
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: 14px;
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.88rem;
    }

    /* Bảng Lịch Sử */
    .table-responsive {
      width: 100%;
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.88rem;
    }

    th {
      text-align: left;
      font-size: 0.74rem;
      color: var(--text-sub);
      text-transform: uppercase;
      padding: 12px 10px;
      border-bottom: 1px solid var(--glass-border);
      letter-spacing: 0.8px;
    }

    td {
      padding: 12px 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      color: var(--text-main);
    }

    tr:hover td {
      background: rgba(255, 255, 255, 0.03);
    }

    .pill-badge {
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 0.75rem;
      font-weight: 700;
      display: inline-block;
    }

    .pill-tai { background: rgba(52, 211, 153, 0.15); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3); }
    .pill-xiu { background: rgba(248, 113, 113, 0.15); color: #f87171; border: 1px solid rgba(248, 113, 113, 0.3); }

    .res-ok { color: #34d399; font-weight: 700; }
    .res-err { color: #f87171; font-weight: 700; }

    footer {
      text-align: center;
      margin-top: 24px;
      font-size: 0.82rem;
      color: var(--text-sub);
    }
  </style>
</head>
<body>

  <!-- Nút tròn đổi màu giao diện ở góc -->
  <button class="color-switcher-bubble" onclick="switchGlassTheme()" title="Nhấp để đổi giao diện Glassmorphism">
    <div class="bubble-dot"></div>
  </button>

  <div class="container">
    <!-- Header Section -->
    <div class="glass-panel header-panel">
      <div class="app-title">Sunwin Phân Tích Thuật Toán</div>
      <div class="developer-tag">Phát triển bởi Developer <strong>Anh Khôi</strong></div>
      <div class="disclaimer-pill">
        <span>⚠️ Chỉ có tính chất mang số liệu tham khảo, không nên tin 100%</span>
      </div>
    </div>

    <!-- Main Grid Content -->
    <div class="grid-2">
      <!-- Card Dự Đoán -->
      <div class="glass-panel">
        <div class="section-title">
          <span>Dự Đoán Phiên Tiếp Theo</span>
          <span id="themeBadge" style="font-size:0.7rem; color:var(--text-sub);">Theme: Dark Glass</span>
        </div>
        <div id="pred" class="pred-value">---</div>
        <div id="conf" class="pred-confidence">--% độ tin cậy</div>
        <div class="pred-info-list">
          <div>Phiên dự đoán: <span id="phien">#---</span></div>
          <div>Dạng cầu: <span id="loai">Đang phân tích dữ liệu...</span></div>
          <div style="margin-top: 6px;" id="lyDo">Đang kết nối luồng dữ liệu API...</div>
        </div>
      </div>

      <!-- Card Hiệu Suất -->
      <div class="glass-panel">
        <div class="section-title">Thống Kê Thuật Toán</div>
        <div class="stats-matrix">
          <div class="stat-card">
            <div class="stat-num" id="total">0</div>
            <div class="stat-lbl">Tổng phiên</div>
          </div>
          <div class="stat-card">
            <div class="stat-num num-ok" id="correct">0</div>
            <div class="stat-lbl">Phiên Đúng</div>
          </div>
          <div class="stat-card">
            <div class="stat-num num-err" id="wrong">0</div>
            <div class="stat-lbl">Phiên Sai</div>
          </div>
          <div class="stat-card">
            <div class="stat-num num-acc" id="acc">0%</div>
            <div class="stat-lbl">Chính Xác</div>
          </div>
        </div>
        <div class="streak-container">
          <span style="color:var(--text-sub)">Chuỗi phiên chưa chính xác</span>
          <span id="streak" style="font-weight:800; color:#f87171">0</span>
        </div>
      </div>
    </div>

    <!-- Card Lịch Sử -->
    <div class="glass-panel">
      <div class="section-title">Nhật Ký Phiên Thời Gian Thực</div>
      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Phiên</th>
              <th>Dự đoán</th>
              <th>Thực tế</th>
              <th>Độ tin cậy</th>
              <th>Thuật toán áp dụng</th>
              <th>Kết quả</th>
            </tr>
          </thead>
          <tbody id="tbody">
            <tr><td colspan="6" style="text-align:center; color:var(--text-sub); padding: 20px;">Đang tải danh sách...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <footer>
      Hệ Thống Phân Tích Dữ Liệu Sunwin Glassmorphism UI · 2026
    </footer>
  </div>

  <script>
    // Danh sách 5 Style Glassmorphism
    const themes = ['dark', 'neon', 'aurora', 'holo', 'minimal'];
    let currentThemeIdx = 0;

    function switchGlassTheme() {
      currentThemeIdx = (currentThemeIdx + 1) % themes.length;
      const theme = themes[currentThemeIdx];
      document.documentElement.setAttribute('data-theme', theme);
      
      const themeNames = {
        'dark': 'Dark Glass',
        'neon': 'Neon Cyber Glass',
        'aurora': 'Aurora Glass',
        'holo': 'Holographic UI',
        'minimal': 'Minimal Frosted'
      };
      document.getElementById('themeBadge').textContent = 'Theme: ' + themeNames[theme];
    }

    async function loadDashboard() {
      try {
        const response = await fetch('/api/dashboard');
        const data = await response.json();

        if (data.prediction) {
          const p = data.prediction;
          const predEl = document.getElementById('pred');
          predEl.textContent = p.display;
          predEl.className = 'pred-value ' + (p.display === 'Tài' ? 'tai-color' : 'xiu-color');

          document.getElementById('conf').textContent = p.conf + '% độ tin cậy';
          document.getElementById('phien').textContent = '#' + p.phienDuDoan;
          document.getElementById('loai').textContent = p.loai || '---';
          document.getElementById('lyDo').textContent = p.lyDo || '';
        }

        document.getElementById('total').textContent = data.stats.total;
        document.getElementById('correct').textContent = data.stats.correct;
        document.getElementById('wrong').textContent = data.stats.wrong;

        const accuracy = data.stats.total > 0 ? ((data.stats.correct / data.stats.total) * 100).toFixed(1) : 0;
        document.getElementById('acc').textContent = accuracy + '%';
        document.getElementById('streak').textContent = data.error_streak || 0;

        const tbody = document.getElementById('tbody');
        if (data.log && data.log.length > 0) {
          tbody.innerHTML = data.log.map(i => \`
            <tr>
              <td>#\${i.phien}</td>
              <td><span class="pill-badge \${i.predict==='TAI'?'pill-tai':'pill-xiu'}">\${i.predict==='TAI'?'TÀI':'XỈU'}</span></td>
              <td><span class="pill-badge \${i.actual==='TAI'?'pill-tai':'pill-xiu'}">\${i.actual==='TAI'?'TÀI':'XỈU'}</span></td>
              <td>\${i.confidence}%</td>
              <td style="color:var(--text-sub)">\${i.loai||''}</td>
              <td class="\${i.correct?'res-ok':'res-err'}">\${i.correct?'ĐÚNG':'SAI'}</td>
            </tr>
          \`).join('');
        }
      } catch (err) {
        console.error('Lỗi nạp bảng thông tin:', err);
      }
    }

    loadDashboard();
    setInterval(loadDashboard, 6000);
  </script>
</body>
</html>`;
    res.send(html);
});

app.get('/api/dashboard', (req, res) => {
    res.json({
        prediction: lastPrediction,
        stats,
        log: predictionLog.slice(0, 30),
        error_streak: engine.error_streak,
        lastUpdate: vnNow(),
        totalRecords: lastData.length
    });
});

app.listen(PORT, () => {
    console.log(`Server Glassmorphism đang chạy tại http://localhost:${PORT}`);
});
