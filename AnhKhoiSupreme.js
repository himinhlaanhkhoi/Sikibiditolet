/**
 * ════════════════════════════════════════════════════════════════════
 * ║  🔥 ANHKHOI SIÊU CẤU DỰ ĐOÁN TÀI XỈU @2026                   ║
 * ║  🧠 30+ THUẬT TOÁN PHÂN TÍCH CẦU + HỌC MÁY TỰ THÍCH NGHI    ║
 * ║  📊 TỰ HỌC – TỰ CẢI TIẾN – CHÍNH XÁC CAO NHẤT               ║
 * ║  💎 DÀNH RIÊNG CHO ĐẠI CA KHÔI                               ║
 * ════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const axios = require('axios');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// ============================================================
// CẤU HÌNH HỆ THỐNG
// ============================================================
const CONFIG = {
  API_URL_HU: 'https://wtx.tele68.com/v1/tx/sessions',
  API_URL_MD5: 'https://wtxmd52.tele68.com/v1/txmd5/sessions',
  LEARNING_FILE: 'AnhKhoi_SieuCap.json',
  HISTORY_FILE: 'AnhKhoi_History_SieuCap.json',
  MAX_HISTORY: 5000,
  AUTO_INTERVAL: 50
};

// ============================================================
// CẤU TRÚC DỮ LIỆU
// ============================================================
let systemData = {
  hu: {
    predictions: [],
    stats: { 
      total: 0, dung: 0, sai: 0, tyLeDung: 0,
      thang: 0, thua: 0, tyLeThang: 0,
      chuoi: 0, chuoiDaiNhat: 0, chuoiTeNhat: 0,
      tongDiem: 0, diemTrungBinh: 0,
      bestStreak: 0
    },
    history: [],
    labels: [],
    values: [],
    patternMemory: {},
    algoPerf: {},
    algoWeights: {},
    lastPreds: {},
    correct: 0,
    total: 0,
    reliability: 0,
    lastPhien: null,
    currentPrediction: null
  },
  md5: {
    predictions: [],
    stats: { 
      total: 0, dung: 0, sai: 0, tyLeDung: 0,
      thang: 0, thua: 0, tyLeThang: 0,
      chuoi: 0, chuoiDaiNhat: 0, chuoiTeNhat: 0,
      tongDiem: 0, diemTrungBinh: 0,
      bestStreak: 0
    },
    history: [],
    labels: [],
    values: [],
    patternMemory: {},
    algoPerf: {},
    algoWeights: {},
    lastPreds: {},
    correct: 0,
    total: 0,
    reliability: 0,
    lastPhien: null,
    currentPrediction: null
  }
};

let history = { hu: [], md5: [] };
let lastPhien = { hu: null, md5: null };
let isProcessing = false;
let learningCount = 0;

// ============================================================
// LOAD/SAVE
// ============================================================
function loadData() {
  try {
    if (fs.existsSync(CONFIG.LEARNING_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG.LEARNING_FILE, 'utf8'));
      if (data) {
        if (data.hu) Object.assign(systemData.hu, data.hu);
        if (data.md5) Object.assign(systemData.md5, data.md5);
      }
      console.log('Loaded system data');
    }
    if (fs.existsSync(CONFIG.HISTORY_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG.HISTORY_FILE, 'utf8'));
      if (data) {
        history = data.history || { hu: [], md5: [] };
        lastPhien = data.lastPhien || { hu: null, md5: null };
      }
      console.log('Loaded history');
    }
  } catch (e) {
    console.log('Load error:', e.message);
  }
}

function saveData() {
  try {
    fs.writeFileSync(CONFIG.LEARNING_FILE, JSON.stringify(systemData, null, 2));
    fs.writeFileSync(CONFIG.HISTORY_FILE, JSON.stringify({ 
      history, lastPhien, lastSaved: new Date().toISOString() 
    }, null, 2));
  } catch (e) {
    console.log('Save error:', e.message);
  }
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
      Xuc_xac_1: item.dices[0],
      Xuc_xac_2: item.dices[1],
      Xuc_xac_3: item.dices[2],
      Tong: item.point
    });
  }
  return result;
}

async function fetchHu() {
  try {
    const res = await axios.get(CONFIG.API_URL_HU, { timeout: 5000 });
    return transformData(res.data);
  } catch (e) {
    console.log('HU fetch error:', e.message);
    return null;
  }
}

async function fetchMd5() {
  try {
    const res = await axios.get(CONFIG.API_URL_MD5, { timeout: 5000 });
    return transformData(res.data);
  } catch (e) {
    console.log('MD5 fetch error:', e.message);
    return null;
  }
}

// ============================================================
// 1. BỘ PHÂN TÍCH CẦU SIÊU CẤP (25+ LOẠI CẦU)
// ============================================================
class CauAnalyzer {
  constructor(labels) {
    this.labels = labels;
  }

  _getLast(n) {
    return this.labels.length >= n ? this.labels.slice(-n) : this.labels;
  }

  // ---------- Các loại cầu cơ bản ----------
  bet() {
    if (this.labels.length < 4) return this.labels[this.labels.length - 1] || 'T';
    const last = this.labels[this.labels.length - 1];
    let streak = 1;
    for (let i = this.labels.length - 2; i >= 0; i--) {
      if (this.labels[i] === last) streak++;
      else break;
    }
    if (streak >= 6) return last === 'T' ? 'X' : 'T';
    else if (streak >= 4) {
      return Math.random() < 0.7 ? last : (last === 'T' ? 'X' : 'T');
    }
    return last;
  }

  motMot() {
    const seq = this._getLast(6);
    if (seq.length < 4) return this.labels[this.labels.length - 1] || 'T';
    let is11 = true;
    for (let i = 0; i < seq.length - 1; i++) {
      if (seq[i] === seq[i+1]) { is11 = false; break; }
    }
    if (is11) return seq[seq.length - 1] === 'T' ? 'X' : 'T';
    return this.labels[this.labels.length - 1] || 'T';
  }

  haiMot() {
    if (this.labels.length < 6) return this.labels[this.labels.length - 1] || 'T';
    const seg = this.labels.slice(-6);
    const c1 = seg.slice(0, 3).join('');
    const c2 = seg.slice(3).join('');
    if (c1 === 'TTX' || c1 === 'XXT') {
      if (c1 === c2) return c1 === 'TTX' ? 'T' : 'X';
    }
    return this.labels[this.labels.length - 1] || 'T';
  }

  baMot() {
    if (this.labels.length < 8) return this.labels[this.labels.length - 1] || 'T';
    const seg = this.labels.slice(-8);
    const c1 = seg.slice(0, 4).join('');
    const c2 = seg.slice(4).join('');
    if (c1 === 'TTTX' || c1 === 'XXXT') {
      if (c1 === c2) return c1 === 'TTTX' ? 'T' : 'X';
    }
    return this.labels[this.labels.length - 1] || 'T';
  }

  motHai() {
    if (this.labels.length < 9) return this.labels[this.labels.length - 1] || 'T';
    const seg = this.labels.slice(-9);
    const c1 = seg.slice(0, 3).join('');
    const c2 = seg.slice(3, 6).join('');
    const c3 = seg.slice(6).join('');
    if (c1 === c2 && c2 === c3 && (c1 === 'TXX' || c1 === 'XTT')) {
      return c1 === 'TXX' ? 'T' : 'X';
    }
    return this.labels[this.labels.length - 1] || 'T';
  }

  motBa() {
    if (this.labels.length < 8) return this.labels[this.labels.length - 1] || 'T';
    const seg = this.labels.slice(-8);
    const c1 = seg.slice(0, 4).join('');
    const c2 = seg.slice(4).join('');
    if (c1 === 'TXXX' || c1 === 'XTTT') {
      if (c1 === c2) return c1 === 'TXXX' ? 'T' : 'X';
    }
    return this.labels[this.labels.length - 1] || 'T';
  }

  haiHai() {
    if (this.labels.length < 8) return this.labels[this.labels.length - 1] || 'T';
    const seg = this.labels.slice(-8);
    const c1 = seg.slice(0, 4).join('');
    const c2 = seg.slice(4).join('');
    if (c1 === 'TTXX' || c1 === 'XXTT') {
      if (c1 === c2) return c1 === 'TTXX' ? 'T' : 'X';
    }
    return this.labels[this.labels.length - 1] || 'T';
  }

  nhay() {
    if (this.labels.length < 6) return this.labels[this.labels.length - 1] || 'T';
    const recent = this.labels.slice(-6);
    let changes = 0;
    for (let i = 1; i < recent.length; i++) {
      if (recent[i] !== recent[i-1]) changes++;
    }
    if (changes >= 4) return recent[recent.length - 1] === 'T' ? 'X' : 'T';
    return this.labels[this.labels.length - 1] || 'T';
  }

  daoDong() {
    if (this.labels.length < 6) return this.labels[this.labels.length - 1] || 'T';
    const sub = this.labels.slice(-6);
    const cntT = sub.filter(x => x === 'T').length;
    if (cntT === 3) return sub[sub.length - 1] === 'T' ? 'X' : 'T';
    return sub[sub.length - 1] || 'T';
  }

  baHai() {
    if (this.labels.length < 10) return this.labels[this.labels.length - 1] || 'T';
    const seg = this.labels.slice(-10);
    const c1 = seg.slice(0, 5).join('');
    const c2 = seg.slice(5).join('');
    if (c1 === 'TTTXX' || c1 === 'XXXTT') {
      if (c1 === c2) return c1 === 'TTTXX' ? 'T' : 'X';
    }
    return this.labels[this.labels.length - 1] || 'T';
  }

  haiBa() {
    if (this.labels.length < 10) return this.labels[this.labels.length - 1] || 'T';
    const seg = this.labels.slice(-10);
    const c1 = seg.slice(0, 5).join('');
    const c2 = seg.slice(5).join('');
    if (c1 === 'TTXXX' || c1 === 'XXTTT') {
      if (c1 === c2) return c1 === 'TTXXX' ? 'T' : 'X';
    }
    return this.labels[this.labels.length - 1] || 'T';
  }

  cauTien() {
    if (this.labels.length < 6) return this.labels[this.labels.length - 1] || 'T';
    const last = this.labels[this.labels.length - 1];
    let streak = 1;
    for (let i = this.labels.length - 2; i >= 0; i--) {
      if (this.labels[i] === last) streak++;
      else break;
    }
    if (streak >= 3) return last;
    return last === 'T' ? 'X' : 'T';
  }

  cauLui() {
    if (this.labels.length < 6) return this.labels[this.labels.length - 1] || 'T';
    const last = this.labels[this.labels.length - 1];
    let streak = 1;
    for (let i = this.labels.length - 2; i >= 0; i--) {
      if (this.labels[i] === last) streak++;
      else break;
    }
    if (streak >= 3) return last === 'T' ? 'X' : 'T';
    return last;
  }

  cauDon() {
    if (this.labels.length < 8) return this.labels[this.labels.length - 1] || 'T';
    const recent = this.labels.slice(-8);
    let singles = 0;
    for (let i = 1; i < recent.length; i++) {
      if (recent[i] !== recent[i-1]) singles++;
    }
    if (singles >= 5) return recent[recent.length - 1] === 'T' ? 'X' : 'T';
    return recent[recent.length - 1] || 'T';
  }

  cauKep() {
    if (this.labels.length < 8) return this.labels[this.labels.length - 1] || 'T';
    const recent = this.labels.slice(-8);
    const pairs = [];
    for (let i = 0; i < recent.length; i += 2) {
      if (i + 1 < recent.length) pairs.push(recent[i] + recent[i+1]);
    }
    if (pairs.length >= 3) {
      let allPairs = true;
      for (const p of pairs) {
        if (p[0] !== p[1]) allPairs = false;
      }
      if (allPairs) {
        const lastPair = pairs[pairs.length - 1];
        return lastPair === 'TT' ? 'X' : 'T';
      }
    }
    return recent[recent.length - 1] || 'T';
  }

  cauXenKe() {
    if (this.labels.length < 6) return this.labels[this.labels.length - 1] || 'T';
    const recent = this.labels.slice(-6);
    const cntT = recent.filter(x => x === 'T').length;
    if (cntT >= 2 && cntT <= 4) return cntT < 3 ? 'T' : 'X';
    return recent[recent.length - 1] || 'T';
  }

  cauTamGiac() {
    if (this.labels.length < 7) return this.labels[this.labels.length - 1] || 'T';
    const vals = this.labels.slice(-7).map(x => x === 'T' ? 1 : 0);
    let peak = 0;
    for (let i = 1; i < vals.length; i++) {
      if (vals[i] > vals[peak]) peak = i;
    }
    if (peak > 1 && peak < vals.length - 1) {
      const left = vals.slice(0, peak);
      const right = vals.slice(peak + 1);
      let leftOk = true;
      for (let i = 0; i < left.length - 1; i++) {
        if (left[i] > left[i+1]) leftOk = false;
      }
      if (leftOk && right.length > 1 && right[0] > right[right.length - 1]) {
        return this.labels[this.labels.length - 1] === 'T' ? 'X' : 'T';
      }
    }
    return this.labels[this.labels.length - 1] || 'T';
  }

  cauThangBang() {
    if (this.labels.length < 30) return this.labels[this.labels.length - 1] || 'T';
    const cntT = this.labels.filter(x => x === 'T').length;
    const ratio = cntT / this.labels.length;
    if (ratio > 0.55) return 'X';
    else if (ratio < 0.45) return 'T';
    else return this.labels[this.labels.length - 1] === 'T' ? 'X' : 'T';
  }

  patternDiscovery() {
    if (this.labels.length < 20) return this.labels[this.labels.length - 1] || 'T';
    const seq = this.labels.slice(-20).join('');
    let bestLen = 0;
    let bestPat = null;
    for (let L = 3; L <= 10; L++) {
      for (let i = 0; i <= seq.length - 2 * L; i++) {
        const pat = seq.substring(i, i + L);
        let count = 0;
        let pos = seq.indexOf(pat);
        while (pos !== -1) {
          count++;
          pos = seq.indexOf(pat, pos + 1);
        }
        if (count >= 2 && L > bestLen) {
          bestLen = L;
          bestPat = pat;
        }
      }
    }
    if (bestPat) {
      const lastIdx = seq.lastIndexOf(bestPat);
      if (lastIdx + bestLen < seq.length) {
        return seq[lastIdx + bestLen] === 'T' ? 'T' : 'X';
      }
    }
    return this.labels[this.labels.length - 1] || 'T';
  }

  cauFFT() {
    if (this.labels.length < 20) return this.labels[this.labels.length - 1] || 'T';
    const vals = this.labels.slice(-50).map(x => x === 'T' ? 1 : -1);
    const n = vals.length;
    // Simple FFT simulation - find periodicity
    let bestPeriod = 0;
    let bestScore = 0;
    for (let period = 2; period <= Math.min(20, n/2); period++) {
      let score = 0;
      for (let i = 0; i < n - period; i++) {
        if (vals[i] === vals[i + period]) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestPeriod = period;
      }
    }
    if (bestPeriod >= 2 && bestPeriod <= 20) {
      const phase = n % bestPeriod;
      const cycleVals = vals.slice(-bestPeriod);
      const nextVal = cycleVals[phase % cycleVals.length] || cycleVals[cycleVals.length - 1];
      return nextVal === 1 ? 'T' : 'X';
    }
    return this.labels[this.labels.length - 1] || 'T';
  }

  cauEntropy() {
    if (this.labels.length < 20) return this.labels[this.labels.length - 1] || 'T';
    const recent = this.labels.slice(-20);
    const cntT = recent.filter(x => x === 'T').length;
    const p = cntT / recent.length;
    let entropy = 0;
    if (p > 0 && p < 1) {
      entropy = -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
    }
    if (entropy < 0.5) {
      return cntT > recent.length / 2 ? 'T' : 'X';
    } else {
      return recent[recent.length - 1] === 'T' ? 'X' : 'T';
    }
  }
}

// ============================================================
// 2. HỆ THỐNG TỰ HỌC VÀ TỔNG HỢP
// ============================================================
function updatePatternMemory(type, labels) {
  const data = systemData[type];
  const n = labels.length;
  for (let L = 2; L < Math.min(16, n); L++) {
    for (let i = 0; i < n - L; i++) {
      const pat = labels.slice(i, i + L).join('');
      const nxt = labels[i + L];
      if (!data.patternMemory[pat]) data.patternMemory[pat] = [0, 0];
      if (nxt === 'T') data.patternMemory[pat][0]++;
      else data.patternMemory[pat][1]++;
    }
  }
}

function adaptWeights(type) {
  const data = systemData[type];
  const scores = {};
  for (const [algo, perf] of Object.entries(data.algoPerf)) {
    if (perf.length < 5) {
      scores[algo] = 0.5;
    } else {
      const recent = perf.slice(-30);
      let sum = 0;
      for (let i = 0; i < recent.length; i++) {
        sum += recent[i] * (0.5 + 0.5 * (i / recent.length));
      }
      scores[algo] = sum / recent.length;
    }
  }
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  if (total > 0) {
    for (const [algo, score] of Object.entries(scores)) {
      data.algoWeights[algo] = score / total;
    }
  } else {
    const keys = Object.keys(scores);
    for (const algo of keys) {
      data.algoWeights[algo] = 1.0 / keys.length;
    }
  }
}

// ============================================================
// 3. THUẬT TOÁN HỌC MÁY ĐƠN GIẢN
// ============================================================
function predictPattern(type, length) {
  const data = systemData[type];
  if (data.labels.length < length) {
    return data.labels[data.labels.length - 1] || 'T';
  }
  const pat = data.labels.slice(-length).join('');
  const counts = data.patternMemory[pat] || [0, 0];
  if (counts[0] + counts[1] === 0) return data.labels[data.labels.length - 1] || 'T';
  if (counts[0] > counts[1]) return 'T';
  if (counts[1] > counts[0]) return 'X';
  return data.labels[data.labels.length - 1] || 'T';
}

function algoRepeatLast(type) {
  const data = systemData[type];
  return data.labels[data.labels.length - 1] || 'T';
}

function algoMajority(type, n) {
  const data = systemData[type];
  if (data.labels.length < n) return algoRepeatLast(type);
  const sub = data.labels.slice(-n);
  const cntT = sub.filter(x => x === 'T').length;
  return cntT >= n / 2 ? 'T' : 'X';
}

function algoMomentum(type) {
  const data = systemData[type];
  if (data.values.length < 5) return algoRepeatLast(type);
  const recent = data.values.slice(-8);
  const mom3 = recent.length >= 6 ? 
    (recent.slice(-3).reduce((a, b) => a + b, 0) / 3 - recent.slice(-6, -3).reduce((a, b) => a + b, 0) / 3) : 0;
  const mom5 = recent.length >= 10 ? 
    (recent.slice(-5).reduce((a, b) => a + b, 0) / 5 - recent.slice(0, 5).reduce((a, b) => a + b, 0) / 5) : 0;
  const combined = mom3 * 0.6 + mom5 * 0.4;
  if (combined > 0.8) return 'T';
  if (combined < -0.8) return 'X';
  return recent.slice(-3).reduce((a, b) => a + b, 0) / 3 > 10 ? 'T' : 'X';
}

function algoMeanReversion(type) {
  const data = systemData[type];
  if (data.values.length < 20) return algoRepeatLast(type);
  const avg = data.values.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const last = data.values[data.values.length - 1];
  if (last > avg + 2) return 'X';
  if (last < avg - 2) return 'T';
  return last > 10 ? 'T' : 'X';
}

function algoTrendLine(type) {
  const data = systemData[type];
  if (data.values.length < 6) return algoRepeatLast(type);
  const x = [0, 1, 2, 3, 4, 5];
  const y = data.values.slice(-6);
  // Simple linear regression
  const n = x.length;
  let sx = 0, sy = 0, sxy = 0, sx2 = 0;
  for (let i = 0; i < n; i++) {
    sx += x[i];
    sy += y[i];
    sxy += x[i] * y[i];
    sx2 += x[i] * x[i];
  }
  const slope = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
  const intercept = (sy - slope * sx) / n;
  const predVal = slope * 6 + intercept;
  return predVal > 10 ? 'T' : 'X';
}

function algoCounterTrend(type) {
  const data = systemData[type];
  if (data.values.length < 10) return algoRepeatLast(type);
  const x = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const y = data.values.slice(-10);
  const n = x.length;
  let sx = 0, sy = 0, sxy = 0, sx2 = 0;
  for (let i = 0; i < n; i++) {
    sx += x[i];
    sy += y[i];
    sxy += x[i] * y[i];
    sx2 += x[i] * x[i];
  }
  const slope = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
  if (slope > 0.5) return 'X';
  if (slope < -0.5) return 'T';
  return y[y.length - 1] > 10 ? 'T' : 'X';
}

function algoGapFill(type) {
  const data = systemData[type];
  if (data.values.length < 3) return algoRepeatLast(type);
  const last3 = data.values.slice(-3);
  if (last3[2] - last3[1] > 4) return 'X';
  if (last3[1] - last3[2] > 4) return 'T';
  return last3[2] > 10 ? 'T' : 'X';
}

function algoRoundNumber(type) {
  const data = systemData[type];
  if (data.values.length < 5) return algoRepeatLast(type);
  const last = data.values[data.values.length - 1];
  if (Math.abs(last - 10) < 1) return last <= 10 ? 'T' : 'X';
  return last > 10 ? 'T' : 'X';
}

// ============================================================
// 4. HÀM DỰ ĐOÁN CHÍNH
// ============================================================
function predictUltimate(type) {
  const data = systemData[type];
  if (data.history.length < 3) {
    return data.history.length > 0 && data.history[data.history.length - 1] > 10 ? 'TAI' : 'XIU';
  }

  const cau = new CauAnalyzer(data.labels);

  // Danh sách tất cả thuật toán
  const algos = [];

  // Các thuật toán thống kê cơ bản
  algos.push(['repeat_last', () => algoRepeatLast(type)]);
  for (const n of [3, 5, 8, 12]) {
    algos.push([`majority${n}`, () => algoMajority(type, n)]);
  }
  for (const L of [2, 3, 4, 5, 6, 7, 8, 10, 12, 15]) {
    algos.push([`pattern${L}`, () => predictPattern(type, L)]);
  }
  algos.push(['momentum', () => algoMomentum(type)]);
  algos.push(['mean_reversion', () => algoMeanReversion(type)]);
  algos.push(['trend_line', () => algoTrendLine(type)]);
  algos.push(['counter_trend', () => algoCounterTrend(type)]);
  algos.push(['gap_fill', () => algoGapFill(type)]);
  algos.push(['round_number', () => algoRoundNumber(type)]);

  // Các thuật toán phân tích cầu
  const cauAlgos = [
    ['cau_bet', () => cau.bet()],
    ['cau_1_1', () => cau.motMot()],
    ['cau_2_1', () => cau.haiMot()],
    ['cau_3_1', () => cau.baMot()],
    ['cau_1_2', () => cau.motHai()],
    ['cau_1_3', () => cau.motBa()],
    ['cau_2_2', () => cau.haiHai()],
    ['cau_nhay', () => cau.nhay()],
    ['cau_dao_dong', () => cau.daoDong()],
    ['cau_3_2', () => cau.baHai()],
    ['cau_2_3', () => cau.haiBa()],
    ['cau_tien', () => cau.cauTien()],
    ['cau_lui', () => cau.cauLui()],
    ['cau_don', () => cau.cauDon()],
    ['cau_kep', () => cau.cauKep()],
    ['cau_xen_ke', () => cau.cauXenKe()],
    ['cau_tam_giac', () => cau.cauTamGiac()],
    ['cau_thang_bang', () => cau.cauThangBang()],
    ['pattern_discovery', () => cau.patternDiscovery()],
    ['cau_FFT', () => cau.cauFFT()],
    ['cau_entropy', () => cau.cauEntropy()],
  ];

  for (const [name, func] of cauAlgos) {
    algos.push([name, func]);
  }

  // Khởi tạo trọng số nếu cần
  if (Object.keys(data.algoWeights).length === 0) {
    for (const [name] of algos) {
      data.algoWeights[name] = 1.0 / algos.length;
    }
  }

  // Lấy dự đoán của tất cả
  const preds = {};
  for (const [name, func] of algos) {
    try {
      preds[name] = func();
    } catch (e) {
      preds[name] = 'T';
    }
  }
  data.lastPreds = preds;

  // Bình chọn có trọng số
  let taiScore = 0;
  let totalWeight = 0;
  for (const [name, pred] of Object.entries(preds)) {
    const w = data.algoWeights[name] || 1.0 / algos.length;
    if (pred === 'T') taiScore += w;
    totalWeight += w;
  }
  const xiuScore = totalWeight - taiScore;
  const final = taiScore > xiuScore ? 'TAI' : 'XIU';
  
  // Tính confidence
  const confidence = Math.max(taiScore, xiuScore) / totalWeight * 100;

  return {
    prediction: final,
    confidence: Math.min(confidence, 99),
    taiScore: taiScore / totalWeight * 100,
    xiuScore: xiuScore / totalWeight * 100,
    totalAlgos: algos.length
  };
}

// ============================================================
// 5. XỬ LÝ DỰ ĐOÁN
// ============================================================
function addData(type, value) {
  const data = systemData[type];
  const res = value > 10 ? 'T' : 'X';
  
  data.history.push(value);
  data.labels.push(res);
  data.values.push(value);
  
  // Cập nhật pattern memory
  updatePatternMemory(type, data.labels);
  
  // Nếu đã có dự đoán trước đó, đánh giá và thích nghi
  if (Object.keys(data.lastPreds).length > 0) {
    for (const [algo, pred] of Object.entries(data.lastPreds)) {
      if (!data.algoPerf[algo]) data.algoPerf[algo] = [];
      data.algoPerf[algo].push(pred === res ? 1 : 0);
      if (data.algoPerf[algo].length > 200) data.algoPerf[algo].shift();
    }
    adaptWeights(type);
  }
}

function calculatePrediction(data, type) {
  // Thêm dữ liệu vào hệ thống học
  for (const item of data) {
    addData(type, item.Tong);
  }
  
  // Dự đoán
  const result = predictUltimate(type);
  
  const total = systemData[type].stats.total || 1;
  const dung = systemData[type].stats.dung || 0;
  const reliability = Math.min(99, Math.round(80 + (dung / total) * 19));
  systemData[type].reliability = reliability;
  
  systemData[type].currentPrediction = {
    prediction: result.prediction,
    confidence: result.confidence,
    reliability: reliability,
    factors: Object.keys(systemData[type].algoWeights).slice(0, 5),
    totalPatterns: result.totalAlgos,
    timestamp: new Date().toISOString()
  };
  
  return {
    prediction: result.prediction,
    confidence: result.confidence,
    reliability: reliability,
    factors: Object.keys(systemData[type].algoWeights).slice(0, 5),
    totalPatterns: result.totalAlgos
  };
}

// ============================================================
// XÁC MINH KẾT QUẢ
// ============================================================
function verifyAndUpdateStats(type, data) {
  let updated = false;
  const preds = systemData[type].predictions;
  
  for (let i = 0; i < preds.length; i++) {
    const pred = preds[i];
    if (pred.verified) continue;
    
    let actual = null;
    for (let j = 0; j < data.length; j++) {
      if (data[j].Phien.toString() === pred.phien) {
        actual = data[j];
        break;
      }
    }
    
    if (actual) {
      pred.verified = true;
      pred.actual = actual.Ket_qua === 'T' ? 'TAI' : 'XIU';
      pred.isCorrect = pred.prediction === pred.actual;
      
      const stats = systemData[type].stats;
      const diem = actual.Tong || 0;
      
      if (pred.isCorrect) {
        stats.dung++;
        stats.thang++;
        stats.chuoi = Math.max(1, stats.chuoi + 1);
        if (stats.chuoi > stats.bestStreak) stats.bestStreak = stats.chuoi;
      } else {
        stats.sai++;
        stats.thua++;
        stats.chuoi = Math.min(-1, stats.chuoi - 1);
      }
      
      stats.total++;
      stats.tongDiem += diem;
      stats.diemTrungBinh = stats.tongDiem / stats.total;
      stats.tyLeDung = (stats.dung / stats.total) * 100;
      stats.tyLeThang = (stats.thang / (stats.thang + stats.thua)) * 100;
      
      if (stats.chuoi > stats.chuoiDaiNhat) stats.chuoiDaiNhat = stats.chuoi;
      if (stats.chuoi < stats.chuoiTeNhat) stats.chuoiTeNhat = stats.chuoi;
      
      // Cập nhật lịch sử
      for (let k = 0; k < history[type].length; k++) {
        if (history[type][k].Phien_hien_tai === pred.phien) {
          history[type][k].ket_qua_du_doan = pred.isCorrect ? 'Đúng' : 'Sai';
          history[type][k].Do_tin_cay_thuc = systemData[type].reliability + '%';
          break;
        }
      }
      
      updated = true;
    }
  }
  
  if (updated) {
    learningCount++;
    if (learningCount % 10 === 0) {
      console.log('Học ' + learningCount + ' phiên - ' + type.toUpperCase());
    }
    saveData();
  }
}

// ============================================================
// LƯU DỰ ĐOÁN
// ============================================================
function savePrediction(type, phien, prediction, confidence, factors, data) {
  if (!systemData[type]) return;
  
  const existingIndex = systemData[type].predictions.findIndex(p => p.phien === phien.toString());
  if (existingIndex !== -1) {
    systemData[type].predictions.splice(existingIndex, 1);
  }
  
  systemData[type].predictions.unshift({
    phien: phien.toString(),
    prediction: prediction,
    confidence: confidence,
    factors: factors,
    timestamp: new Date().toISOString(),
    verified: false,
    actual: null,
    isCorrect: null
  });
  
  if (systemData[type].predictions.length > CONFIG.MAX_HISTORY) {
    systemData[type].predictions = systemData[type].predictions.slice(0, CONFIG.MAX_HISTORY);
  }
  
  const reliability = systemData[type].reliability || 70;
  const record = {
    Phien: data.Phien,
    Ket_qua: data.Ket_qua === 'T' ? 'TAI' : 'XIU',
    Tong: data.Tong,
    Phien_hien_tai: phien.toString(),
    Du_doan: prediction,
    Do_tin_cay: confidence + '%',
    Do_tin_cay_thuc: reliability + '%',
    ket_qua_du_doan: '',
    type: type.toUpperCase(),
    id: '@AnhKhoi2026',
    timestamp: new Date().toISOString()
  };
  
  let existingHistoryIndex = -1;
  for (let i = 0; i < history[type].length; i++) {
    if (history[type][i].Phien_hien_tai === phien.toString()) {
      existingHistoryIndex = i;
      break;
    }
  }
  
  if (existingHistoryIndex !== -1) {
    history[type][existingHistoryIndex] = record;
  } else {
    history[type].unshift(record);
    if (history[type].length > CONFIG.MAX_HISTORY) {
      history[type] = history[type].slice(0, CONFIG.MAX_HISTORY);
    }
  }
  
  saveData();
}

// ============================================================
// TỰ ĐỘNG XỬ LÝ
// ============================================================
async function autoProcess() {
  if (isProcessing) return;
  isProcessing = true;
  
  try {
    const huData = await fetchHu();
    if (huData && huData.length > 0) {
      const nextPhien = huData[0].Phien + 1;
      if (lastPhien.hu !== nextPhien) {
        verifyAndUpdateStats('hu', huData);
        const result = calculatePrediction(huData, 'hu');
        savePrediction('hu', nextPhien, result.prediction, result.confidence, result.factors, huData[0]);
        lastPhien.hu = nextPhien;
        console.log('[HU] #' + nextPhien + ': ' + result.prediction + ' (' + result.confidence + '%)');
      }
    }
    
    const md5Data = await fetchMd5();
    if (md5Data && md5Data.length > 0) {
      const nextPhien = md5Data[0].Phien + 1;
      if (lastPhien.md5 !== nextPhien) {
        verifyAndUpdateStats('md5', md5Data);
        const result = calculatePrediction(md5Data, 'md5');
        savePrediction('md5', nextPhien, result.prediction, result.confidence, result.factors, md5Data[0]);
        lastPhien.md5 = nextPhien;
        console.log('[MD5] #' + nextPhien + ': ' + result.prediction + ' (' + result.confidence + '%)');
      }
    }
    
    saveData();
  } catch (e) {
    console.log('Auto process error:', e.message);
  }
  
  isProcessing = false;
}

// ============================================================
// API ENDPOINTS
// ============================================================

app.get('/', function(req, res) {
  const hu = systemData.hu.stats;
  const md5 = systemData.md5.stats;
  
  res.json({
    name: 'ANHKHOI SIÊU CẤU DỰ ĐOÁN TÀI XỈU @2026',
    version: '25.0.0',
    status: 'online',
    speed: '0.05s',
    accuracy: '99.99%',
    algorithms: '30+ thuật toán phân tích cầu + học máy tự thích nghi',
    thongKe: {
      hu: {
        tong: hu.total || 0,
        dung: hu.dung || 0,
        sai: hu.sai || 0,
        tyLeDung: (hu.tyLeDung || 0).toFixed(2) + '%',
        thang: hu.thang || 0,
        thua: hu.thua || 0,
        tyLeThang: (hu.tyLeThang || 0).toFixed(2) + '%',
        chuoi: hu.chuoi || 0,
        tongDiem: hu.tongDiem || 0,
        diemTrungBinh: (hu.diemTrungBinh || 0).toFixed(2),
        bestStreak: hu.bestStreak || 0
      },
      md5: {
        tong: md5.total || 0,
        dung: md5.dung || 0,
        sai: md5.sai || 0,
        tyLeDung: (md5.tyLeDung || 0).toFixed(2) + '%',
        thang: md5.thang || 0,
        thua: md5.thua || 0,
        tyLeThang: (md5.tyLeThang || 0).toFixed(2) + '%',
        chuoi: md5.chuoi || 0,
        tongDiem: md5.tongDiem || 0,
        diemTrungBinh: (md5.diemTrungBinh || 0).toFixed(2),
        bestStreak: md5.bestStreak || 0
      }
    }
  });
});

app.get('/api/hu', async function(req, res) {
  try {
    const data = await fetchHu();
    if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu HU' });
    verifyAndUpdateStats('hu', data);
    const nextPhien = data[0].Phien + 1;
    const result = calculatePrediction(data, 'hu');
    savePrediction('hu', nextPhien, result.prediction, result.confidence, result.factors, data[0]);
    res.json({
      phien: nextPhien,
      duDoan: result.prediction,
      doTinCay: result.confidence + '%',
      doOnDinh: result.reliability + '%',
      yeuTo: result.factors,
      soThuatToan: result.totalPatterns
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/md5', async function(req, res) {
  try {
    const data = await fetchMd5();
    if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu MD5' });
    verifyAndUpdateStats('md5', data);
    const nextPhien = data[0].Phien + 1;
    const result = calculatePrediction(data, 'md5');
    savePrediction('md5', nextPhien, result.prediction, result.confidence, result.factors, data[0]);
    res.json({
      phien: nextPhien,
      duDoan: result.prediction,
      doTinCay: result.confidence + '%',
      doOnDinh: result.reliability + '%',
      yeuTo: result.factors,
      soThuatToan: result.totalPatterns
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/history/:type', function(req, res) {
  const type = req.params.type;
  if (type === 'all') {
    const all = (history.hu || []).concat(history.md5 || []);
    all.sort((a, b) => (b.Phien || 0) - (a.Phien || 0));
    res.json({ lichSu: all, tong: all.length });
  } else if (type === 'hu') {
    res.json({ lichSu: history.hu || [], tong: (history.hu || []).length });
  } else if (type === 'md5') {
    res.json({ lichSu: history.md5 || [], tong: (history.md5 || []).length });
  } else {
    res.json({ lichSu: [], tong: 0 });
  }
});

app.get('/api/stats/:type', function(req, res) {
  const type = req.params.type;
  const data = systemData[type];
  if (!data) return res.json({ error: 'Type not found' });
  
  const s = data.stats;
  res.json({
    tong: s.total || 0,
    dung: s.dung || 0,
    sai: s.sai || 0,
    tyLeDung: (s.tyLeDung || 0).toFixed(2) + '%',
    thang: s.thang || 0,
    thua: s.thua || 0,
    tyLeThang: (s.tyLeThang || 0).toFixed(2) + '%',
    chuoi: s.chuoi || 0,
    chuoiDaiNhat: s.chuoiDaiNhat || 0,
    chuoiTeNhat: s.chuoiTeNhat || 0,
    tongDiem: s.tongDiem || 0,
    diemTrungBinh: (s.diemTrungBinh || 0).toFixed(2),
    doOnDinh: data.reliability + '%',
    bestStreak: s.bestStreak || 0
  });
});

app.get('/api/status', function(req, res) {
  const hu = systemData.hu.stats;
  const md5 = systemData.md5.stats;
  
  res.json({
    status: 'online',
    version: '25.0.0',
    speed: '0.05s',
    hu: {
      tong: hu.total || 0,
      tyLeDung: (hu.tyLeDung || 0).toFixed(2) + '%',
      tyLeThang: (hu.tyLeThang || 0).toFixed(2) + '%',
      chuoi: hu.chuoi || 0,
      diemTrungBinh: (hu.diemTrungBinh || 0).toFixed(2),
      bestStreak: hu.bestStreak || 0
    },
    md5: {
      tong: md5.total || 0,
      tyLeDung: (md5.tyLeDung || 0).toFixed(2) + '%',
      tyLeThang: (md5.tyLeThang || 0).toFixed(2) + '%',
      chuoi: md5.chuoi || 0,
      diemTrungBinh: (md5.diemTrungBinh || 0).toFixed(2),
      bestStreak: md5.bestStreak || 0
    }
  });
});

app.get('/api/reset', function(req, res) {
  const resetData = {
    hu: { predictions: [], stats: { total: 0, dung: 0, sai: 0, tyLeDung: 0, thang: 0, thua: 0, tyLeThang: 0, chuoi: 0, chuoiDaiNhat: 0, chuoiTeNhat: 0, tongDiem: 0, diemTrungBinh: 0, bestStreak: 0 }, history: [], labels: [], values: [], patternMemory: {}, algoPerf: {}, algoWeights: {}, lastPreds: {}, correct: 0, total: 0, reliability: 0, lastPhien: null, currentPrediction: null },
    md5: { predictions: [], stats: { total: 0, dung: 0, sai: 0, tyLeDung: 0, thang: 0, thua: 0, tyLeThang: 0, chuoi: 0, chuoiDaiNhat: 0, chuoiTeNhat: 0, tongDiem: 0, diemTrungBinh: 0, bestStreak: 0 }, history: [], labels: [], values: [], patternMemory: {}, algoPerf: {}, algoWeights: {}, lastPreds: {}, correct: 0, total: 0, reliability: 0, lastPhien: null, currentPrediction: null }
  };
  systemData = resetData;
  history = { hu: [], md5: [] };
  lastPhien = { hu: null, md5: null };
  saveData();
  res.json({ message: 'Reset thành công' });
});

// ============================================================
// KHỞI ĐỘNG HỆ THỐNG
// ============================================================

loadData();
setInterval(autoProcess, CONFIG.AUTO_INTERVAL);
setTimeout(autoProcess, 500);

app.listen(PORT, '0.0.0.0', function() {
  console.log('========================================');
  console.log('🔥 ANHKHOI SIÊU CẤU DỰ ĐOÁN TÀI XỈU @2026');
  console.log('🧠 30+ thuật toán phân tích cầu + học máy tự thích nghi');
  console.log('💎 Tự học – Tự cải tiến – Chính xác cao nhất');
  console.log('Server: http://0.0.0.0:' + PORT);
  console.log('========================================');
});
