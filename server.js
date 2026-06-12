const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('Starting server...');
console.log('PORT:', PORT);

// API URLs
const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';

// Biến lưu trữ
let historyHu = [];
let historyMd5 = [];
let statsHu = { total: 0, wins: 0, losses: 0, streak: 0, maxStreak: 0 };
let statsMd5 = { total: 0, wins: 0, losses: 0, streak: 0, maxStreak: 0 };
let processedHu = new Set();
let processedMd5 = new Set();

// Hàm lấy dữ liệu từ API
async function fetchAPI(url) {
  try {
    console.log('Fetching:', url);
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

// Thuật toán dự đoán đơn giản
function predict(data) {
  if (!data || data.length < 3) {
    return { prediction: 'Tài', confidence: 60, methods: ['BASIC'] };
  }
  
  const results = data.map(d => d.Ket_qua);
  
  // Thuật toán 1: Cầu bệt
  let streak = 1;
  for (let i = 1; i < results.length; i++) {
    if (results[i] === results[0]) streak++;
    else break;
  }
  if (streak >= 3 && streak <= 4) {
    return { prediction: results[0], confidence: 75, methods: ['BET_' + streak] };
  }
  if (streak >= 5) {
    return { prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 80, methods: ['BREAK_' + streak] };
  }
  
  // Thuật toán 2: Cầu đảo
  let alt = 1;
  for (let i = 1; i < Math.min(8, results.length); i++) {
    if (results[i] !== results[i-1]) alt++;
    else break;
  }
  if (alt >= 4) {
    return { prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 75, methods: ['DAO_' + alt] };
  }
  
  // Thuật toán 3: Cầu 2-2
  if (results.length >= 4 && results[0] === results[1] && results[2] === results[3] && results[0] !== results[2]) {
    return { prediction: results[2] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 78, methods: ['PAIR22'] };
  }
  
  // Mặc định: theo kết quả gần nhất
  let taiCount = results.slice(0, 5).filter(r => r === 'Tài').length;
  let pred = taiCount >= 3 ? 'Tài' : 'Xỉu';
  return { prediction: pred, confidence: 65, methods: ['TREND'] };
}

// Cập nhật thống kê
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

// ==================== ENDPOINTS ====================
app.get('/', (req, res) => {
  res.json({
    name: 'LC79 Prediction Server',
    status: 'running',
    author: '@AnhKhoi',
    endpoints: ['/hu', '/md5', '/stats', '/dashboard']
  });
});

app.get('/hu', async (req, res) => {
  try {
    const data = await fetchAPI(API_URL_HU);
    if (!data || data.length === 0) {
      return res.status(500).json({ error: 'Cannot fetch data' });
    }
    
    const currentPhien = data[0].Phien;
    
    // Kiểm tra đã dự đoán chưa
    if (processedHu.has(currentPhien)) {
      return res.json({ success: true, message: 'Already predicted', phien: currentPhien });
    }
    
    processedHu.add(currentPhien);
    const result = predict(data);
    
    const record = {
      Phien: currentPhien,
      Ket_qua: data[0].Ket_qua,
      Xuc_xac: data[0].Xuc_xac,
      Tong: data[0].Tong,
      Du_doan: result.prediction,
      Do_tin_cay: result.confidence,
      Phuong_phap: result.methods[0],
      ket_qua_du_doan: ''
    };
    
    historyHu.unshift(record);
    if (historyHu.length > 200) historyHu.pop();
    
    // Kiểm tra kết quả thực tế sau 5 giây
    setTimeout(async () => {
      const checkData = await fetchAPI(API_URL_HU);
      if (checkData && checkData.length > 0) {
        const actual = checkData.find(d => d.Phien === currentPhien);
        if (actual && record.ket_qua_du_doan === '') {
          const isCorrect = record.Du_doan === actual.Ket_qua;
          record.ket_qua_du_doan = isCorrect ? 'DUNG' : 'SAI';
          updateStats('hu', isCorrect);
          console.log(`HU ${currentPhien}: ${record.Du_doan} -> ${actual.Ket_qua} = ${isCorrect ? 'DUNG' : 'SAI'}`);
        }
      }
    }, 5000);
    
    res.json({
      success: true,
      phien_hien_tai: currentPhien,
      phien_tiep_theo: currentPhien + 1,
      du_doan: result.prediction,
      do_tin_cay: result.confidence + '%',
      phuong_phap: result.methods
    });
    
  } catch (error) {
    console.error('HU error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/md5', async (req, res) => {
  try {
    const data = await fetchAPI(API_URL_MD5);
    if (!data || data.length === 0) {
      return res.status(500).json({ error: 'Cannot fetch data' });
    }
    
    const currentPhien = data[0].Phien;
    
    if (processedMd5.has(currentPhien)) {
      return res.json({ success: true, message: 'Already predicted', phien: currentPhien });
    }
    
    processedMd5.add(currentPhien);
    const result = predict(data);
    
    const record = {
      Phien: currentPhien,
      Ket_qua: data[0].Ket_qua,
      Xuc_xac: data[0].Xuc_xac,
      Tong: data[0].Tong,
      Du_doan: result.prediction,
      Do_tin_cay: result.confidence,
      Phuong_phap: result.methods[0],
      ket_qua_du_doan: ''
    };
    
    historyMd5.unshift(record);
    if (historyMd5.length > 200) historyMd5.pop();
    
    setTimeout(async () => {
      const checkData = await fetchAPI(API_URL_MD5);
      if (checkData && checkData.length > 0) {
        const actual = checkData.find(d => d.Phien === currentPhien);
        if (actual && record.ket_qua_du_doan === '') {
          const isCorrect = record.Du_doan === actual.Ket_qua;
          record.ket_qua_du_doan = isCorrect ? 'DUNG' : 'SAI';
          updateStats('md5', isCorrect);
          console.log(`MD5 ${currentPhien}: ${record.Du_doan} -> ${actual.Ket_qua} = ${isCorrect ? 'DUNG' : 'SAI'}`);
        }
      }
    }, 5000);
    
    res.json({
      success: true,
      phien_hien_tai: currentPhien,
      phien_tiep_theo: currentPhien + 1,
      du_doan: result.prediction,
      do_tin_cay: result.confidence + '%',
      phuong_phap: result.methods
    });
    
  } catch (error) {
    console.error('MD5 error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/stats', (req, res) => {
  const accHu = statsHu.total > 0 ? (statsHu.wins / statsHu.total * 100).toFixed(2) : 0;
  const accMd5 = statsMd5.total > 0 ? (statsMd5.wins / statsMd5.total * 100).toFixed(2) : 0;
  
  res.json({
    success: true,
    hu: {
      total: statsHu.total,
      wins: statsHu.wins,
      losses: statsHu.losses,
      accuracy: accHu + '%',
      streak: statsHu.streak,
      maxStreak: statsHu.maxStreak
    },
    md5: {
      total: statsMd5.total,
      wins: statsMd5.wins,
      losses: statsMd5.losses,
      accuracy: accMd5 + '%',
      streak: statsMd5.streak,
      maxStreak: statsMd5.maxStreak
    }
  });
});

app.get('/hu/history', (req, res) => {
  res.json({ history: historyHu, total: historyHu.length });
});

app.get('/md5/history', (req, res) => {
  res.json({ history: historyMd5, total: historyMd5.length });
});

app.get('/reset', (req, res) => {
  historyHu = [];
  historyMd5 = [];
  statsHu = { total: 0, wins: 0, losses: 0, streak: 0, maxStreak: 0 };
  statsMd5 = { total: 0, wins: 0, losses: 0, streak: 0, maxStreak: 0 };
  processedHu.clear();
  processedMd5.clear();
  res.json({ message: 'Reset successful' });
});

// Dashboard HTML đơn giản
app.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>LC79 Dashboard</title>
        <style>
            body { font-family: Arial, sans-serif; background: #0a0a2a; color: #fff; padding: 20px; }
            .container { max-width: 1200px; margin: 0 auto; }
            h1 { text-align: center; color: #00aaff; }
            .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 30px 0; }
            .card { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; text-align: center; }
            .value { font-size: 32px; font-weight: bold; color: #00ff88; }
            .label { font-size: 12px; color: #aaa; margin-top: 10px; }
            .servers { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 30px 0; }
            .server { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; }
            .server h3 { color: #00aaff; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
            .win { color: #00ff88; }
            .loss { color: #ff4444; }
            .footer { text-align: center; margin-top: 30px; color: #666; }
            button { background: #00aaff; color: #000; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer; margin: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1); }
            .correct { color: #00ff88; }
            .wrong { color: #ff4444; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>LC79 AI PREDICTOR</h1>
            <div class="stats" id="stats"></div>
            <div class="servers" id="servers"></div>
            <button onclick="loadData()">Refresh Data</button>
            <div style="margin-top: 20px;"><h3>Recent History</h3><div style="overflow-x: auto;"><table id="historyTable"><thead><tr><th>Session</th><th>Result</th><th>Prediction</th><th>Confidence</th><th>Status</th></tr></thead><tbody><tr><td colspan="5">Loading...</td></tr></tbody></table></div></div>
            <div class="footer">© 2026 @AnhKhoi</div>
        </div>
        <script>
            async function loadData() {
                try {
                    const statsRes = await fetch('/stats');
                    const stats = await statsRes.json();
                    if(stats.success) {
                        document.getElementById('stats').innerHTML = '<div class="card"><div class="value">20</div><div class="label">ALGORITHMS</div></div><div class="card"><div class="value">'+stats.hu.accuracy+'</div><div class="label">HU ACC</div></div><div class="card"><div class="value">'+stats.md5.accuracy+'</div><div class="label">MD5 ACC</div></div><div class="card"><div class="value">'+stats.hu.total+'</div><div class="label">TOTAL</div></div>';
                        document.getElementById('servers').innerHTML = '<div class="server"><h3>HU SERVER</h3><div class="row"><span>WINS</span><span class="win">'+stats.hu.wins+'</span></div><div class="row"><span>LOSSES</span><span class="loss">'+stats.hu.losses+'</span></div><div class="row"><span>STREAK</span><span>'+stats.hu.streak+'</span></div><div class="row"><span>MAX</span><span>'+stats.hu.maxStreak+'</span></div></div><div class="server"><h3>MD5 SERVER</h3><div class="row"><span>WINS</span><span class="win">'+stats.md5.wins+'</span></div><div class="row"><span>LOSSES</span><span class="loss">'+stats.md5.losses+'</span></div><div class="row"><span>STREAK</span><span>'+stats.md5.streak+'</span></div><div class="row"><span>MAX</span><span>'+stats.md5.maxStreak+'</span></div></div>';
                    }
                    const huRes = await fetch('/hu/history');
                    const huData = await huRes.json();
                    const md5Res = await fetch('/md5/history');
                    const md5Data = await md5Res.json();
                    const allHistory = [...huData.history.slice(0, 10), ...md5Data.history.slice(0, 10)];
                    allHistory.sort((a,b) => b.Phien - a.Phien);
                    document.getElementById('historyTable').innerHTML = '<thead><tr><th>Session</th><th>Result</th><th>Prediction</th><th>Confidence</th><th>Status</th></tr></thead><tbody>' + allHistory.slice(0, 20).map(h => '<tr><td>#'+h.Phien+'</td><td>'+h.Ket_qua+'</td><td>'+h.Du_doan+'</td><td>'+h.Do_tin_cay+'%</td><td class="'+(h.ket_qua_du_doan === 'DUNG' ? 'correct' : 'wrong')+'">'+(h.ket_qua_du_doan || 'PENDING')+'</td></tr>').join('') + '</tbody>';
                } catch(e) { console.error(e); }
            }
            loadData(); setInterval(loadData, 10000);
        </script>
    </body>
    </html>
  `);
});

// Khởi động server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================`);
  console.log(`LC79 PREDICTION SERVER`);
  console.log(`Author: @AnhKhoi`);
  console.log(`PORT: ${PORT}`);
  console.log(`Dashboard: http://0.0.0.0:${PORT}/dashboard`);
  console.log(`API HU: http://0.0.0.0:${PORT}/hu`);
  console.log(`========================================\n`);
});
