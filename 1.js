/**
 * server.js - Sunwin Tài Xỉu Analyzer (TX_SmartEngine_V5)
 * Giao diện iOS 27.0 Glassmorphic Translucent
 * API: https://sunwin-taixiu-dulieu.onrender.com/data[span_1](start_span)[span_1](end_span)
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

class TX_SmartEngine_V5 {
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
            .map(s => s.tong);
    }

    // Thuật toán nhận diện cầu bệt & bẻ bệt thông minh
    phanTichCauBet(arr) {
        if (arr.length < 2) return null;
        let length = 1;
        for (let i = 1; i < arr.length; i++) {
            if (arr[i] === arr[0]) length++;
            else break;
        }
        if (length >= 2 && length <= 4) {
            return { pred: arr[0], conf: 76, loai: "Cầu Bệt", lyDo: `Đang bệt ${length} phiên liên tiếp` };
        }
        if (length >= 5) {
            return { pred: arr[0] === "TAI" ? "XIU" : "TAI", conf: 84, loai: "Bẻ Cầu Rồng", reason: `Bệt dài ${length} phiên → Xác suất cao đảo chiều` };
        }
        return null;
    }

    // Nhận diện cầu 1-1
    phanTichCauDienKe(arr) {
        if (arr.length < 6) return null;
        let is11 = true;
        for (let i = 0; i < 5; i++) {
            if (arr[i] === arr[i + 1]) {
                is11 = false;
                break;
            }
        }
        if (is11) {
            return { pred: arr[0] === "TAI" ? "XIU" : "TAI", conf: 85, loai: "Cầu 1-1 Đảo", lyDo: "Nhịp cầu 1-1 đang chạy ổn định" };
        }
        return null;
    }

    // Nhận diện cầu đối xứng (2-2, 3-3)
    phanTichDoiXung(arr) {
        if (arr.length < 4) return null;
        if (arr[0] === arr[1] && arr[2] === arr[3] && arr[0] !== arr[2]) {
            return { pred: arr[2], conf: 80, loai: "Cầu 2-2", lyDo: "Mô hình nhịp đôi AABB" };
        }
        return null;
    }

    // Phân tích thống kê điểm xúc xắc (Dice Distribution & Moving Average)
    phanTichDiemXucXac() {
        const points = this._points();
        if (points.length < 10) return null;
        const recent = points.slice(0, 5);
        const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
        const lastPoint = points[0];

        if (lastPoint >= 16) return { pred: "XIU", conf: 78, loai: "Hồi Điểm Cực Đại", lyDo: `Tổng điểm ${lastPoint} quá cao → Xu hướng giảm` };
        if (lastPoint <= 5) return { pred: "TAI", conf: 78, loai: "Hồi Điểm Cực Tiểu", lyDo: `Tổng điểm ${lastPoint} quá thấp → Xu hướng tăng` };
        
        if (avgRecent > 11.5) {
            return { pred: "XIU", conf: 70, loai: "Cân Bằng Tần Suất", lyDo: "Trung bình 5 phiên gần nhất nghiêng Tài nặng" };
        }
        if (avgRecent < 9.5) {
            return { pred: "TAI", conf: 70, loai: "Cân Bằng Tần Suất", lyDo: "Trung bình 5 phiên gần nhất nghiêng Xỉu nặng" };
        }
        return null;
    }

    tongHopDuDoan() {
        const arr = this._arr();
        if (arr.length < 2) return null;
        return this.phanTichCauDienKe(arr) || 
               this.phanTichCauBet(arr) || 
               this.phanTichDoiXung(arr) || 
               this.phanTichDiemXucXac(arr) ||
               { pred: arr[0], conf: 60, loai: "Theo Dòng Tiền", lyDo: "Bám theo kết quả phiên gần nhất" };
    }

    xuLyChieuDaiSaiSot(p) {
        if (!p || this.history.length < 1) return p;
        const currentResult = this._arr()[0];
        if (this.error_streak >= 2 && this.last_prediction && this.last_prediction !== currentResult) {
            return {
                ...p,
                pred: p.pred === "TAI" ? "XIU" : "TAI",
                conf: Math.min(90, p.conf + 12),
                lyDo: `🔄 Kích hoạt chiến lược đảo chiều thông minh (${this.error_streak} lỗi liên tiếp)`
            };
        }
        return p;
    }

    predict(data) {
        this.loadData(data);
        let result = this.tongHopDuDoan();
        if (result) result = this.xuLyChieuDaiSaiSot(result);
        else result = { pred: this._arr()[0] || "TAI", conf: 50, loai: "Mặc định", lyDo: "Đang thu thập mẫu dữ liệu" };

        this.last_prediction = result.pred;
        return result;
    }

    updateStatus(actual) {
        if (this.last_prediction) {
            const a = actual.toUpperCase().replace('XỈU', 'XIU').replace('TÀI', 'TAI');
            if (this.last_prediction === a) this.error_streak = 0;
            else this.error_streak++;
        }
    }
}

const engine = new TX_SmartEngine_V5();

let lastData = [];
let lastPrediction = null;
let predictionLog = [];

async function fetchAndAnalyze() {
    try {
        const res = await axios.get(API_URL, { timeout: 12000 });
        const raw = res.data;

        if (!raw || !raw.data || !Array.isArray(raw.data)) {
            console.log('Dữ liệu API không hợp lệ');
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

                console.log(`[Thống kê] #${newest.phien} | Dự đoán: ${lastPrediction.pred} - Thực tế: ${actual} - ${isCorrect ? 'ĐÚNG' : 'SAI'} | Chuỗi lỗi: ${engine.error_streak}`);
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
        console.error('Lỗi kết nối dữ liệu:', err.message);
    }
}

fetchAndAnalyze();
setInterval(fetchAndAnalyze, 20000);

// ====================== GIAO DIỆN iOS 27.0 GLASS ======================
app.get('/', (req, res) => {
    const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sunwin Phân Tích Thông Minh - iOS 27</title>
  <link href="https://fonts.googleapis.com/css2?family=SF+Pro+Display:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-gradient: radial-gradient(circle at 50% 0%, #1a1c29 0%, #08090e 100%);
      --glass-bg: rgba(255, 255, 255, 0.04);
      --glass-border: rgba(255, 255, 255, 0.08);
      --glass-card: rgba(22, 24, 35, 0.65);
      --text-main: #f5f5f7;
      --text-sub: #86868b;
      --accent-tai: #34c759;
      --accent-xiu: #ff3b30;
      --accent-glow: rgba(0, 122, 255, 0.3);
      --primary-hue: 210;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', 'SF Pro Display', system-ui, sans-serif; }

    body {
      background: var(--bg-gradient);
      color: var(--text-main);
      min-height: 100vh;
      padding: 24px 16px 48px;
      overflow-x: hidden;
      transition: background 0.5s ease;
    }

    .container {
      max-width: 1000px;
      margin: 0 auto;
    }

    /* Header & Author Section */
    .header-card {
      background: var(--glass-card);
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      border: 1px solid var(--glass-border);
      border-radius: 24px;
      padding: 24px;
      text-align: center;
      margin-bottom: 20px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.4);
    }

    .app-title {
      font-size: 1.8rem;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin-bottom: 6px;
      background: linear-gradient(135deg, #ffffff 30%, #a1a1a6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .dev-credit {
      font-size: 0.9rem;
      color: var(--text-sub);
      margin-bottom: 12px;
    }

    .dev-credit span {
      color: #0a84ff;
      font-weight: 600;
    }

    .disclaimer-badge {
      display: inline-block;
      background: rgba(255, 159, 10, 0.12);
      border: 1px solid rgba(255, 159, 10, 0.3);
      color: #ff9f0a;
      padding: 6px 14px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 500;
      margin-top: 4px;
    }

    /* Interactive iOS Slider Control (Nút tròn kéo qua kéo lại) */
    .control-panel {
      background: var(--glass-card);
      backdrop-filter: blur(20px);
      border: 1px solid var(--glass-border);
      border-radius: 20px;
      padding: 16px 24px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .control-label {
      font-size: 0.85rem;
      color: var(--text-sub);
      font-weight: 500;
      white-space: nowrap;
    }

    .slider-container {
      flex: 1;
      display: flex;
      align-items: center;
      position: relative;
    }

    .ios-slider {
      -webkit-appearance: none;
      width: 100%;
      height: 6px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 3px;
      outline: none;
      transition: 0.3s;
    }

    .ios-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #ffffff;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5), 0 0 10px rgba(0, 122, 255, 0.5);
      transition: transform 0.2s, background 0.2s;
    }

    .ios-slider::-webkit-slider-thumb:hover {
      transform: scale(1.15);
    }

    /* Layout Grid */
    .grid-layout {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }

    @media(max-width: 768px) {
      .grid-layout { grid-template-columns: 1fr; }
    }

    .glass-card {
      background: var(--glass-card);
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      border: 1px solid var(--glass-border);
      border-radius: 24px;
      padding: 24px;
      box-shadow: 0 16px 32px rgba(0,0,0,0.3);
    }

    .card-heading {
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 1px;
      color: var(--text-sub);
      text-transform: uppercase;
      margin-bottom: 16px;
    }

    /* Prediction Box */
    .pred-display {
      font-size: 3rem;
      font-weight: 800;
      letter-spacing: -1px;
      margin-bottom: 4px;
      line-height: 1.1;
    }

    .is-tai { color: var(--accent-tai); text-shadow: 0 0 30px rgba(52, 199, 89, 0.3); }
    .is-xiu { color: var(--accent-xiu); text-shadow: 0 0 30px rgba(255, 59, 48, 0.3); }

    .confidence-text {
      font-size: 1.2rem;
      font-weight: 600;
      color: #ff9f0a;
      margin-bottom: 14px;
    }

    .meta-details {
      font-size: 0.9rem;
      color: var(--text-sub);
      line-height: 1.5;
    }

    .meta-details span {
      color: var(--text-main);
      font-weight: 500;
    }

    /* Stats Matrix */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }

    .stat-box {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 14px;
      text-align: center;
    }

    .stat-value {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 2px;
    }

    .stat-label {
      font-size: 0.75rem;
      color: var(--text-sub);
      text-transform: uppercase;
    }

    .val-ok { color: var(--accent-tai); }
    .val-err { color: var(--accent-xiu); }
    .val-acc { color: #0a84ff; }

    .error-streak-box {
      background: rgba(255, 59, 48, 0.08);
      border: 1px solid rgba(255, 59, 48, 0.2);
      border-radius: 14px;
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;
    }

    /* History Table Section */
    .table-container {
      width: 100%;
      overflow-x: auto;
      margin-top: 8px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.88rem;
    }

    th {
      text-align: left;
      font-size: 0.75rem;
      color: var(--text-sub);
      text-transform: uppercase;
      padding: 10px 12px;
      border-bottom: 1px solid var(--glass-border);
      letter-spacing: 0.5px;
    }

    td {
      padding: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
      color: var(--text-main);
    }

    tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    .badge {
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .badge-tai { background: rgba(52, 199, 89, 0.15); color: var(--accent-tai); border: 1px solid rgba(52, 199, 89, 0.3); }
    .badge-xiu { background: rgba(255, 59, 48, 0.15); color: var(--accent-xiu); border: 1px solid rgba(255, 59, 48, 0.3); }

    .res-dung { color: var(--accent-tai); font-weight: 600; }
    .res-sai { color: var(--accent-xiu); font-weight: 600; }

    footer {
      text-align: center;
      margin-top: 32px;
      font-size: 0.8rem;
      color: var(--text-sub);
    }
  </style>
</head>
<body>

  <div class="container">
    <!-- Header & Author -->
    <div class="header-card">
      <div class="app-title">Sunwin Phân Tích Thông Minh</div>
      <div class="dev-credit">Được phát triển bởi Developer <span>Anh Khôi</span></div>
      <div class="disclaimer-badge">⚠️ Chỉ mang tính chất tham khảo số liệu, không nên tin tuyệt đối 100%</div>
    </div>

    <!-- Interactive Slider Control (Nút tròn kéo qua kéo lại chỉnh sắc thái) -->
    <div class="control-panel">
      <div class="control-label">Sắc thái giao diện</div>
      <div class="slider-container">
        <input type="range" id="themeSlider" min="0" max="360" value="210" class="ios-slider" oninput="changeTheme(this.value)">
      </div>
      <div id="sliderVal" style="font-size:0.8rem; color:var(--text-sub); width:40px; text-align:right;">210°</div>
    </div>

    <!-- Main Grid Layout -->
    <div class="grid-layout">
      <!-- Prediction Card -->
      <div class="glass-card">
        <div class="card-heading">Dự Đoán Phiên Tiếp Theo</div>
        <div id="pred" class="pred-display">---</div>
        <div id="conf" class="confidence-text">--% độ tin cậy</div>
        <div class="meta-details">
          <div>Phiên số: <span id="phien">#---</span></div>
          <div>Dạng cầu: <span id="loai">Đang đồng bộ...</span></div>
          <div style="margin-top: 6px;" id="lyDo">Hệ thống đang quét toàn bộ dữ liệu lịch sử từ API...</div>
        </div>
      </div>

      <!-- Performance Matrix Card -->
      <div class="glass-card">
        <div class="card-heading">Bảng Thống Kê Hiệu Suất</div>
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-value" id="total">0</div>
            <div class="stat-label">Tổng số</div>
          </div>
          <div class="stat-box">
            <div class="stat-value val-ok" id="correct">0</div>
            <div class="stat-label">Đúng</div>
          </div>
          <div class="stat-box">
            <div class="stat-value val-err" id="wrong">0</div>
            <div class="stat-label">Sai</div>
          </div>
          <div class="stat-box">
            <div class="stat-value val-acc" id="acc">0%</div>
            <div class="stat-label">Chính xác</div>
          </div>
        </div>
        <div class="error-streak-box">
          <span style="color:var(--text-sub)">Chuỗi sai liên tiếp (Error Streak)</span>
          <span id="streak" style="font-weight:700; color:var(--accent-xiu)">0</span>
        </div>
      </div>
    </div>

    <!-- History Log Card -->
    <div class="glass-card">
      <div class="card-heading">Lịch Sử Dự Đoán Thời Gian Thực</div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Phiên</th>
              <th>Dự đoán</th>
              <th>Thực tế</th>
              <th>Độ tin cậy</th>
              <th>Kiểu cầu</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody id="tbody">
            <tr><td colspan="6" style="text-align:center; color:var(--text-sub); padding: 24px;">Đang kết nối luồng dữ liệu...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <footer>
      Hệ thống phân tích tự động chuẩn hóa iOS 27.0 · Cập nhật liên tục từ cơ sở dữ liệu
    </footer>
  </div>

  <script>
    function changeTheme(val) {
      document.body.style.setProperty('--bg-gradient', \`radial-gradient(circle at 50% 0%, hsl(\${val}, 40%, 15%) 0%, #08090e 100%)\`);
      document.getElementById('sliderVal').textContent = val + '°';
    }

    async function loadDashboard() {
      try {
        const response = await fetch('/api/dashboard');
        const data = await response.json();

        if (data.prediction) {
          const p = data.prediction;
          const predEl = document.getElementById('pred');
          predEl.textContent = p.display;
          predEl.className = 'pred-display ' + (p.display === 'Tài' ? 'is-tai' : 'is-xiu');
          
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
              <td><span class="badge \${i.predict==='TAI'?'badge-tai':'badge-xiu'}">\${i.predict==='TAI'?'TÀI':'XỈU'}</span></td>
              <td><span class="badge \${i.actual==='TAI'?'badge-tai':'badge-xiu'}">\${i.actual==='TAI'?'TÀI':'XỈU'}</span></td>
              <td>\${i.confidence}%</td>
              <td style="color:var(--text-sub)">\${i.loai||''}</td>
              <td class="\${i.correct?'res-dung':'res-sai'}">\${i.correct?'ĐÚNG':'SAI'}</td>
            </tr>
          \`).join('');
        }
      } catch (err) {
        console.error('Lỗi tải dữ liệu dashboard:', err);
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
        totalRecordsLoaded: lastData.length
    });
});

app.listen(PORT, () => {
    console.log(`Hệ thống đang chạy tại cổng http://localhost:${PORT}`);
});
