const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5000;

const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';
const LEARNING_FILE = 'anhkhoi.json';
const HISTORY_FILE = 'anhkhoi1.json';

let predictionHistory = { hu: [], md5: [] };
const MAX_HISTORY = 100;
const AUTO_SAVE_INTERVAL = 1000; // Chạy mỗi 1 giây
let lastProcessedPhien = { hu: null, md5: null };

// ==================== CÁC HÀM PHÂN TÍCH CẦU ====================
function analyzeCauBet(results) {
  if (!results || results.length < 3) return null;
  let streakType = results[0];
  let streakLength = 1;
  for (let i = 1; i < results.length; i++) {
    if (results[i] === streakType) streakLength++;
    else break;
  }
  if (streakLength >= 3) {
    let shouldBreak = streakLength >= 5;
    let confidence = streakLength >= 7 ? 85 : (streakLength >= 5 ? 75 : 68);
    return {
      prediction: shouldBreak ? (streakType === 'Tài' ? 'Xỉu' : 'Tài') : streakType,
      confidence: confidence,
      name: `Cầu Bệt ${streakLength} phiên`
    };
  }
  return null;
}

function analyzeCauDao11(results) {
  if (!results || results.length < 4) return null;
  let alternatingLength = 1;
  for (let i = 1; i < Math.min(results.length, 10); i++) {
    if (results[i] !== results[i - 1]) alternatingLength++;
    else break;
  }
  if (alternatingLength >= 4) {
    let confidence = Math.min(80, 65 + alternatingLength * 2);
    return {
      prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài',
      confidence: confidence,
      name: `Cầu Đảo 1-1 (${alternatingLength} phiên)`
    };
  }
  return null;
}

function analyzeCau22(results) {
  if (!results || results.length < 6) return null;
  let pairCount = 0, i = 0, pattern = [];
  while (i < results.length - 1 && pairCount < 4) {
    if (results[i] === results[i + 1]) {
      pattern.push(results[i]);
      pairCount++;
      i += 2;
    } else break;
  }
  if (pairCount >= 2) {
    let isAlternating = true;
    for (let j = 1; j < pattern.length; j++) {
      if (pattern[j] === pattern[j - 1]) isAlternating = false;
    }
    if (isAlternating) {
      const lastPairType = pattern[pattern.length - 1];
      return {
        prediction: lastPairType === 'Tài' ? 'Xỉu' : 'Tài',
        confidence: Math.min(78, 65 + pairCount * 3),
        name: `Cầu 2-2 (${pairCount} cặp)`
      };
    }
  }
  return null;
}

function analyzeCau33(results) {
  if (!results || results.length < 6) return null;
  let tripleCount = 0, i = 0, pattern = [];
  while (i < results.length - 2) {
    if (results[i] === results[i + 1] && results[i + 1] === results[i + 2]) {
      pattern.push(results[i]);
      tripleCount++;
      i += 3;
    } else break;
  }
  if (tripleCount >= 1) {
    const currentPosition = results.length % 3;
    const lastTripleType = pattern[pattern.length - 1];
    let prediction;
    if (currentPosition === 0) prediction = lastTripleType === 'Tài' ? 'Xỉu' : 'Tài';
    else prediction = lastTripleType;
    return {
      prediction: prediction,
      confidence: Math.min(80, 68 + tripleCount * 4),
      name: `Cầu 3-3 (${tripleCount} bộ ba)`
    };
  }
  return null;
}

function analyzeCau121(results) {
  if (!results || results.length < 4) return null;
  const pattern1 = results.slice(0, 4);
  if (pattern1[0] !== pattern1[1] && pattern1[1] === pattern1[2] && pattern1[2] !== pattern1[3] && pattern1[0] === pattern1[3]) {
    return { prediction: pattern1[0], confidence: 72, name: 'Cầu 1-2-1' };
  }
  return null;
}

function analyzeCau123(results) {
  if (!results || results.length < 6) return null;
  const first = results[5];
  const nextTwo = results.slice(3, 5);
  const lastThree = results.slice(0, 3);
  if (nextTwo[0] === nextTwo[1] && nextTwo[0] !== first) {
    const allSame = lastThree.every(r => r === lastThree[0]);
    if (allSame && lastThree[0] !== nextTwo[0]) {
      return { prediction: first, confidence: 74, name: 'Cầu 1-2-3' };
    }
  }
  return null;
}

function analyzeCau321(results) {
  if (!results || results.length < 6) return null;
  const first3 = results.slice(3, 6);
  const next2 = results.slice(1, 3);
  const last1 = results[0];
  const first3Same = first3.every(r => r === first3[0]);
  const next2Same = next2.every(r => r === next2[0]);
  if (first3Same && next2Same && first3[0] !== next2[0] && last1 !== next2[0]) {
    return { prediction: next2[0], confidence: 76, name: 'Cầu 3-2-1' };
  }
  return null;
}

function analyzeCauNhayCoc(results) {
  if (!results || results.length < 6) return null;
  const skipPattern = [];
  for (let i = 0; i < Math.min(results.length, 12); i += 2) skipPattern.push(results[i]);
  if (skipPattern.length >= 3) {
    const allSame = skipPattern.slice(0, 3).every(r => r === skipPattern[0]);
    if (allSame) return { prediction: skipPattern[0], confidence: 68, name: 'Cầu Nhảy Cóc' };
    let alternating = true;
    for (let i = 1; i < skipPattern.length - 1; i++) {
      if (skipPattern[i] === skipPattern[i - 1]) alternating = false;
    }
    if (alternating && skipPattern.length >= 3) {
      return { prediction: skipPattern[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 66, name: 'Cầu Nhảy Cóc Đảo' };
    }
  }
  return null;
}

function analyzeCauNhipNghieng(results) {
  if (!results || results.length < 5) return null;
  const last5 = results.slice(0, 5);
  const taiCount5 = last5.filter(r => r === 'Tài').length;
  if (taiCount5 >= 4) {
    return { prediction: 'Tài', confidence: 70, name: `Cầu Nhịp Nghiêng (${taiCount5}/5 Tài)` };
  } else if (taiCount5 <= 1) {
    return { prediction: 'Xỉu', confidence: 70, name: `Cầu Nhịp Nghiêng (${5 - taiCount5}/5 Xỉu)` };
  }
  return null;
}

function analyzeCau3Van1(results) {
  if (!results || results.length < 4) return null;
  const last4 = results.slice(0, 4);
  const taiCount = last4.filter(r => r === 'Tài').length;
  if (taiCount === 3) return { prediction: 'Xỉu', confidence: 68, name: 'Cầu 3 Ván 1 (3T-1X) → Xỉu' };
  if (taiCount === 1) return { prediction: 'Tài', confidence: 68, name: 'Cầu 3 Ván 1 (3X-1T) → Tài' };
  return null;
}

function analyzeSmartBet(results) {
  if (!results || results.length < 10) return null;
  const last10 = results.slice(0, 10);
  const last5 = results.slice(0, 5);
  const prev5 = results.slice(5, 10);
  const taiLast5 = last5.filter(r => r === 'Tài').length;
  const taiPrev5 = prev5.filter(r => r === 'Tài').length;
  const trendChanging = (taiLast5 >= 4 && taiPrev5 <= 1) || (taiLast5 <= 1 && taiPrev5 >= 4);
  if (trendChanging) {
    const currentDominant = taiLast5 >= 4 ? 'Tài' : 'Xỉu';
    return { prediction: currentDominant === 'Tài' ? 'Xỉu' : 'Tài', confidence: 78, name: `Đảo Xu Hướng` };
  }
  const taiLast10 = last10.filter(r => r === 'Tài').length;
  if (taiLast10 >= 8 || taiLast10 <= 2) {
    const dominant = taiLast10 >= 8 ? 'Tài' : 'Xỉu';
    return { prediction: dominant === 'Tài' ? 'Xỉu' : 'Tài', confidence: 82, name: `Xu Hướng Cực → Đảo` };
  }
  return null;
}

function analyzeBreakStreak(results) {
  if (!results || results.length < 5) return null;
  let streakType = results[0];
  let streakLength = 1;
  for (let i = 1; i < results.length; i++) {
    if (results[i] === streakType) streakLength++;
    else break;
  }
  if (streakLength >= 5) {
    const prediction = streakType === 'Tài' ? 'Xỉu' : 'Tài';
    return { prediction: prediction, confidence: Math.min(85, 70 + streakLength), name: `Bẻ Chuỗi ${streakLength}` };
  }
  return null;
}

function analyzeTriplePattern(results) {
  if (!results || results.length < 9) return null;
  const isTriple1 = results[0] === results[1] && results[1] === results[2];
  const isTriple2 = results[3] === results[4] && results[4] === results[5];
  const isTriple3 = results[6] === results[7] && results[7] === results[8];
  if (isTriple1 && isTriple2 && isTriple3) {
    const tripleType1 = results[0];
    const tripleType2 = results[3];
    const tripleType3 = results[6];
    if (tripleType1 === tripleType2 && tripleType2 === tripleType3) {
      const prediction = tripleType1 === 'Tài' ? 'Xỉu' : 'Tài';
      return { prediction: prediction, confidence: 88, name: `3 Bộ Ba Cùng → Bẻ` };
    }
  }
  return null;
}

function analyzeTongPhanTich(data) {
  if (!data || data.length < 10) return null;
  const recent10 = data.slice(0, 10);
  const sums = recent10.map(d => d.Tong);
  const results = recent10.map(d => d.Ket_qua);
  const taiCount = results.filter(r => r === 'Tài').length;
  const xiuCount = results.filter(r => r === 'Xỉu').length;
  const first5Sum = sums.slice(5, 10).reduce((a, b) => a + b, 0) / 5;
  const last5Sum = sums.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
  const sumTrend = last5Sum - first5Sum;
  if (sumTrend > 1.5) return { prediction: 'Xỉu', confidence: 75, name: `Tổng Phân Tích (Tổng tăng → Xỉu)` };
  if (sumTrend < -1.5) return { prediction: 'Tài', confidence: 75, name: `Tổng Phân Tích (Tổng giảm → Tài)` };
  if (Math.abs(taiCount - xiuCount) >= 3) {
    const lech = taiCount > xiuCount ? 'Tài' : 'Xỉu';
    const prediction = lech === 'Tài' ? 'Xỉu' : 'Tài';
    return { prediction: prediction, confidence: 70, name: `Tổng Phân Tích (Lệch ${Math.abs(taiCount - xiuCount)} → ${prediction})` };
  }
  return null;
}

function analyzeXuHuongManh(results) {
  if (!results || results.length < 8) return null;
  const recent8 = results.slice(0, 8);
  const taiCount = recent8.filter(r => r === 'Tài').length;
  if (taiCount >= 6) return { prediction: 'Xỉu', confidence: 80, name: `Xu Hướng Mạnh (${taiCount}/8 Tài → Đảo Xỉu)` };
  if (taiCount <= 2) return { prediction: 'Tài', confidence: 80, name: `Xu Hướng Mạnh (${8 - taiCount}/8 Xỉu → Đảo Tài)` };
  return null;
}

function analyzeDaoChieu(results) {
  if (!results || results.length < 5) return null;
  const recent5 = results.slice(0, 5);
  let isAlternating = true;
  for (let i = 0; i < recent5.length - 1; i++) {
    if (recent5[i] === recent5[i + 1]) { isAlternating = false; break; }
  }
  if (isAlternating) {
    const prediction = recent5[0] === 'Tài' ? 'Xỉu' : 'Tài';
    return { prediction: prediction, confidence: 75, name: `Đảo Chiều (Chuỗi ${recent5.join('-')} → ${prediction})` };
  }
  return null;
}

function analyzeMarkovChain(results) {
  if (!results || results.length < 10) return null;
  
  let tt = 0, tx = 0, xt = 0, xx = 0;
  for (let i = 0; i < results.length - 1; i++) {
    if (results[i] === 'Tài' && results[i + 1] === 'Tài') tt++;
    else if (results[i] === 'Tài' && results[i + 1] === 'Xỉu') tx++;
    else if (results[i] === 'Xỉu' && results[i + 1] === 'Tài') xt++;
    else if (results[i] === 'Xỉu' && results[i + 1] === 'Xỉu') xx++;
  }
  
  const total = tt + tx + xt + xx;
  if (total > 0) {
    const lastResult = results[0];
    let probTai = (lastResult === 'Tài') ? tt / total : xt / total;
    let confidence = 55 + probTai * 30;
    
    if (probTai > 0.6) {
      return { prediction: 'Tài', confidence: Math.min(85, confidence), name: 'Markov Chain → Tài' };
    } else if (probTai < 0.4) {
      return { prediction: 'Xỉu', confidence: Math.min(85, 100 - confidence), name: 'Markov Chain → Xỉu' };
    }
  }
  return null;
}

function analyzeWMA(results) {
  if (!results || results.length < 5) return null;
  
  const weights = [0.3, 0.25, 0.2, 0.15, 0.1];
  let taiScore = 0;
  
  for (let i = 0; i < Math.min(5, results.length); i++) {
    if (results[i] === 'Tài') taiScore += weights[i];
    else taiScore -= weights[i];
  }
  
  let confidence = 60 + Math.abs(taiScore) * 25;
  let prediction = taiScore > 0 ? 'Tài' : 'Xỉu';
  
  return { prediction, confidence: Math.min(88, confidence), name: 'WMA Analysis' };
}

// === HÀM DỰ ĐOÁN CHÍNH ===
function calculateAdvancedPrediction(data, type) {
  try {
    if (!data || data.length === 0) {
      return {
        prediction: 'Tài',
        confidence: 50,
        factors: ['Không có dữ liệu'],
        allPatterns: []
      };
    }
    
    const results = data.map(d => d.Ket_qua);
    const sums = data.map(d => d.Tong);
    
    if (results.length < 3) {
      return {
        prediction: 'Tài',
        confidence: 55,
        factors: [`Chưa đủ dữ liệu (chỉ có ${results.length}/3 phiên)`],
        allPatterns: []
      };
    }
    
    const predictions = [];
    const factors = [];
    
    // Thu thập tất cả các dự đoán từ các mô hình
    const analysisFunctions = [
      { fn: analyzeCauBet, needsData: false },
      { fn: analyzeCauDao11, needsData: false },
      { fn: analyzeCau22, needsData: false },
      { fn: analyzeCau33, needsData: false },
      { fn: analyzeCau121, needsData: false },
      { fn: analyzeCau123, needsData: false },
      { fn: analyzeCau321, needsData: false },
      { fn: analyzeCauNhayCoc, needsData: false },
      { fn: analyzeCauNhipNghieng, needsData: false },
      { fn: analyzeCau3Van1, needsData: false },
      { fn: analyzeSmartBet, needsData: false },
      { fn: analyzeBreakStreak, needsData: false },
      { fn: analyzeTriplePattern, needsData: false },
      { fn: analyzeXuHuongManh, needsData: false },
      { fn: analyzeDaoChieu, needsData: false },
      { fn: analyzeMarkovChain, needsData: false },
      { fn: analyzeWMA, needsData: false }
    ];
    
    for (let item of analysisFunctions) {
      try {
        let result = item.fn(results);
        if (result) {
          predictions.push(result);
          factors.push(result.name);
        }
      } catch (err) {
        // Bỏ qua lỗi của từng hàm
      }
    }
    
    // Thêm phân tích tổng
    try {
      const tongResult = analyzeTongPhanTich(data);
      if (tongResult) {
        predictions.push(tongResult);
        factors.push(tongResult.name);
      }
    } catch (err) {}
    
    if (predictions.length === 0) {
      // Fallback: dự đoán dựa trên xu hướng đơn giản
      const taiCount = results.slice(0, Math.min(5, results.length)).filter(r => r === 'Tài').length;
      const fallbackPrediction = taiCount >= Math.ceil(Math.min(5, results.length) / 2) ? 'Tài' : 'Xỉu';
      const fallbackConfidence = 55 + Math.abs(taiCount - 2.5) * 10;
      return {
        prediction: fallbackPrediction,
        confidence: Math.min(75, fallbackConfidence),
        factors: ['Dự đoán cơ bản (theo xu hướng)'],
        allPatterns: []
      };
    }
    
    // Tính điểm ensemble
    let taiScore = 0, xiuScore = 0;
    for (const pred of predictions) {
      if (pred.prediction === 'Tài') {
        taiScore += pred.confidence;
      } else {
        xiuScore += pred.confidence;
      }
    }
    
    let finalPrediction = taiScore >= xiuScore ? 'Tài' : 'Xỉu';
    let totalScore = Math.max(taiScore, xiuScore);
    let totalPredictions = predictions.length;
    
    // Tính confidence cuối cùng
    let baseConfidence = (totalScore / totalPredictions);
    if (finalPrediction === 'Tài') {
      baseConfidence = (taiScore / totalPredictions);
    } else {
      baseConfidence = (xiuScore / totalPredictions);
    }
    
    // Điều chỉnh confidence dựa trên streak
    let streak = 1;
    for (let i = 1; i < results.length; i++) {
      if (results[i] === results[0]) streak++;
      else break;
    }
    
    if (streak >= 5 && finalPrediction !== results[0]) {
      baseConfidence += 8;
    } else if (streak >= 5 && finalPrediction === results[0]) {
      baseConfidence -= 5;
    }
    
    let finalConfidence = Math.min(94, Math.max(58, Math.round(baseConfidence)));
    
    // Lấy top 3 patterns
    const topPatterns = predictions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)
      .map(p => p.name);
    
    return {
      prediction: finalPrediction,
      confidence: finalConfidence,
      factors: factors.slice(0, 8),
      allPatterns: topPatterns,
      detailedAnalysis: {
        totalPatterns: predictions.length,
        taiVotes: predictions.filter(p => p.prediction === 'Tài').length,
        xiuVotes: predictions.filter(p => p.prediction === 'Xỉu').length,
        topPattern: topPatterns[0] || 'N/A',
        streak: streak
      }
    };
  } catch (error) {
    console.error('Error in calculateAdvancedPrediction:', error);
    return {
      prediction: 'Tài',
      confidence: 50,
      factors: ['Lỗi tính toán, dùng dự đoán mặc định'],
      allPatterns: []
    };
  }
}

// === HÀM LOAD/SAVE ===
function loadLearningData() {
  try {
    if (fs.existsSync(LEARNING_FILE)) {
      const data = fs.readFileSync(LEARNING_FILE, 'utf8');
      JSON.parse(data);
      console.log('✅ Loaded learning data from', LEARNING_FILE);
    }
  } catch (error) {
    console.error('Error loading learning data:', error.message);
  }
}

function saveLearningData() {
  try {
    const state = {
      lastSaved: new Date().toISOString(),
      version: '2.0'
    };
    fs.writeFileSync(LEARNING_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('Error saving learning data:', error.message);
  }
}

function loadPredictionHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      const parsed = JSON.parse(data);
      predictionHistory = parsed.history || { hu: [], md5: [] };
      lastProcessedPhien = parsed.lastProcessedPhien || { hu: null, md5: null };
      console.log('✅ Loaded prediction history from', HISTORY_FILE);
    }
  } catch (error) {
    console.error('Error loading prediction history:', error.message);
  }
}

function savePredictionHistory() {
  try {
    const dataToSave = {
      history: predictionHistory,
      lastProcessedPhien,
      lastSaved: new Date().toISOString()
    };
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(dataToSave, null, 2));
  } catch (error) {
    console.error('Error saving prediction history:', error.message);
  }
}

// === HÀM LẤY DỮ LIỆU API ===
function transformApiData(apiData) {
  if (!apiData || !apiData.list || !Array.isArray(apiData.list)) return null;
  return apiData.list.map(item => ({
    Phien: item.id,
    Ket_qua: item.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu',
    Xuc_xac_1: item.dices[0],
    Xuc_xac_2: item.dices[1],
    Xuc_xac_3: item.dices[2],
    Tong: item.point
  }));
}

async function fetchDataHu() {
  try {
    const response = await axios.get(API_URL_HU, { timeout: 10000 });
    return transformApiData(response.data);
  } catch (error) {
    console.error('Error fetching HU data:', error.message);
    return null;
  }
}

async function fetchDataMd5() {
  try {
    const response = await axios.get(API_URL_MD5, { timeout: 10000 });
    return transformApiData(response.data);
  } catch (error) {
    console.error('Error fetching MD5 data:', error.message);
    return null;
  }
}

function savePredictionToHistory(type, phien, prediction, confidence, latestData) {
  try {
    const record = {
      Phien: latestData.Phien,
      Xuc_xac_1: latestData.Xuc_xac_1,
      Xuc_xac_2: latestData.Xuc_xac_2,
      Xuc_xac_3: latestData.Xuc_xac_3,
      Tong: latestData.Tong,
      Ket_qua: latestData.Ket_qua,
      Do_tin_cay: `${confidence}%`,
      Phien_hien_tai: phien.toString(),
      Du_doan: prediction,
      ket_qua_du_doan: '',
      id: '@anhkhoi',
      timestamp: new Date().toISOString()
    };
    predictionHistory[type].unshift(record);
    if (predictionHistory[type].length > MAX_HISTORY) predictionHistory[type].pop();
    return record;
  } catch (error) {
    console.error('Error saving prediction to history:', error);
    return null;
  }
}

async function updateHistoryStatus(type) {
  try {
    let data = (type === 'hu') ? await fetchDataHu() : await fetchDataMd5();
    if (!data) return;
    for (let record of predictionHistory[type]) {
      if (record.ket_qua_du_doan && record.ket_qua_du_doan !== '') continue;
      const actual = data.find(d => d.Phien.toString() === record.Phien_hien_tai);
      if (actual) {
        record.ket_qua_du_doan = (record.Du_doan === actual.Ket_qua) ? 'Đúng ✅' : 'Sai ❌';
      }
    }
    savePredictionHistory();
  } catch (error) {
    console.error('Error updating history status:', error);
  }
}

async function autoProcessPredictions() {
  try {
    // Xử lý HU
    const dataHu = await fetchDataHu();
    if (dataHu && dataHu.length > 0) {
      const nextPhien = dataHu[0].Phien + 1;
      if (lastProcessedPhien.hu !== nextPhien) {
        const result = calculateAdvancedPrediction(dataHu, 'hu');
        savePredictionToHistory('hu', nextPhien, result.prediction, result.confidence, dataHu[0]);
        lastProcessedPhien.hu = nextPhien;
        console.log(`[${new Date().toLocaleTimeString()}] [Auto] HU phiên ${nextPhien}: ${result.prediction} (${result.confidence}%) - Cầu: ${result.allPatterns.slice(0, 3).join(', ')}`);
      }
    }
    
    // Xử lý MD5
    const dataMd5 = await fetchDataMd5();
    if (dataMd5 && dataMd5.length > 0) {
      const nextPhien = dataMd5[0].Phien + 1;
      if (lastProcessedPhien.md5 !== nextPhien) {
        const result = calculateAdvancedPrediction(dataMd5, 'md5');
        savePredictionToHistory('md5', nextPhien, result.prediction, result.confidence, dataMd5[0]);
        lastProcessedPhien.md5 = nextPhien;
        console.log(`[${new Date().toLocaleTimeString()}] [Auto] MD5 phiên ${nextPhien}: ${result.prediction} (${result.confidence}%) - Cầu: ${result.allPatterns.slice(0, 3).join(', ')}`);
      }
    }
    
    savePredictionHistory();
  } catch (error) {
    console.error('[Auto] Error:', error.message);
  }
}

function startAutoSaveTask() {
  console.log('🚀 Auto prediction started - checking every 1 second');
  setInterval(autoProcessPredictions, AUTO_SAVE_INTERVAL);
}

// ==================== ENDPOINTS ====================
app.get('/', (req, res) => {
  res.json({ 
    message: 't.me/anhkhoi - Tài Xỉu Prediction API', 
    status: 'running',
    auto_update: '1 giây',
    endpoints: ['/hu', '/md5', '/hu/lichsu', '/md5/lichsu', '/hu/thamso', '/md5/thamso']
  });
});

app.get('/hu', async (req, res) => {
  try {
    const data = await fetchDataHu();
    if (!data) {
      return res.status(500).json({ error: 'Không thể lấy dữ liệu từ API' });
    }
    const nextPhien = data[0].Phien + 1;
    const result = calculateAdvancedPrediction(data, 'hu');
    const record = savePredictionToHistory('hu', nextPhien, result.prediction, result.confidence, data[0]);
    setTimeout(() => updateHistoryStatus('hu'), 5000);
    res.json({
      success: true,
      phien_hien_tai: data[0].Phien,
      phien_du_doan: nextPhien,
      du_doan: result.prediction,
      do_tin_cay: `${result.confidence}%`,
      cac_cau: result.allPatterns,
      phan_tich: result.detailedAnalysis,
      yeu_to: result.factors
    });
  } catch (error) {
    console.error('Error in /hu:', error);
    res.status(500).json({ error: 'Lỗi server: ' + error.message });
  }
});

app.get('/md5', async (req, res) => {
  try {
    const data = await fetchDataMd5();
    if (!data) {
      return res.status(500).json({ error: 'Không thể lấy dữ liệu từ API' });
    }
    const nextPhien = data[0].Phien + 1;
    const result = calculateAdvancedPrediction(data, 'md5');
    const record = savePredictionToHistory('md5', nextPhien, result.prediction, result.confidence, data[0]);
    setTimeout(() => updateHistoryStatus('md5'), 5000);
    res.json({
      success: true,
      phien_hien_tai: data[0].Phien,
      phien_du_doan: nextPhien,
      du_doan: result.prediction,
      do_tin_cay: `${result.confidence}%`,
      cac_cau: result.allPatterns,
      phan_tich: result.detailedAnalysis,
      yeu_to: result.factors
    });
  } catch (error) {
    console.error('Error in /md5:', error);
    res.status(500).json({ error: 'Lỗi server: ' + error.message });
  }
});

app.get('/hu/lichsu', async (req, res) => {
  try {
    await updateHistoryStatus('hu');
    res.json({ 
      type: 'Lẩu Cua 79 - Tài Xỉu Hũ', 
      history: predictionHistory.hu, 
      total: predictionHistory.hu.length, 
      id: '@anhkhoi' 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/md5/lichsu', async (req, res) => {
  try {
    await updateHistoryStatus('md5');
    res.json({ 
      type: 'Lẩu Cua 79 - Tài Xỉu MD5', 
      history: predictionHistory.md5, 
      total: predictionHistory.md5.length, 
      id: '@anhkhoi' 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/hu/thamso', async (req, res) => {
  try {
    const data = await fetchDataHu();
    if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    const result = calculateAdvancedPrediction(data, 'hu');
    res.json({ 
      success: true,
      prediction: result.prediction, 
      confidence: result.confidence, 
      factors: result.factors,
      patterns: result.allPatterns,
      analysis: result.detailedAnalysis 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/md5/thamso', async (req, res) => {
  try {
    const data = await fetchDataMd5();
    if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    const result = calculateAdvancedPrediction(data, 'md5');
    res.json({ 
      success: true,
      prediction: result.prediction, 
      confidence: result.confidence, 
      factors: result.factors,
      patterns: result.allPatterns,
      analysis: result.detailedAnalysis 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/hu/hochoi', (req, res) => {
  res.json({ type: 'HU Learning', status: 'active', version: '2.0', id: '@anhkhoi' });
});

app.get('/md5/hochoi', (req, res) => {
  res.json({ type: 'MD5 Learning', status: 'active', version: '2.0', id: '@anhkhoi' });
});

app.get('/resetdata', (req, res) => {
  predictionHistory = { hu: [], md5: [] };
  lastProcessedPhien = { hu: null, md5: null };
  savePredictionHistory();
  res.json({ message: 'Đã reset lịch sử dự đoán', id: '@anhkhoi' });
});

// KHỞI ĐỘNG
loadLearningData();
loadPredictionHistory();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================`);
  console.log(`🚀 Server @anhkhoi running on http://0.0.0.0:${PORT}`);
  console.log(`✅ Đã fix lỗi - Hệ thống dự đoán đã sẵn sàng!`);
  console.log(`⏱️  Auto prediction: Mỗi 1 giây`);
  console.log(`📊 Các mô hình: Cầu Bệt, Đảo 1-1, 2-2, 3-3, 1-2-1, 1-2-3, 3-2-1, Nhảy Cóc, Nhịp Nghiêng, 3 Ván 1, SmartBet, Bẻ Chuỗi, 3 Bộ Ba, Xu Hướng Mạnh, Đảo Chiều, Markov Chain, WMA, Tổng Phân Tích`);
  console.log(`========================================\n`);
  startAutoSaveTask();
});
