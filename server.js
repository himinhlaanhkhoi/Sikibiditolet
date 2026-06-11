const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5000;

const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';
const LEARNING_FILE = 'anhkhoi_system.json';
const HISTORY_FILE = 'anhkhoi_history.json';

let predictionHistory = { hu: [], md5: [] };
let statistics = { 
  hu: { total: 0, wins: 0, losses: 0, accuracy: 0, currentWinStreak: 0, maxWinStreak: 0, currentLoseStreak: 0, maxLoseStreak: 0 },
  md5: { total: 0, wins: 0, losses: 0, accuracy: 0, currentWinStreak: 0, maxWinStreak: 0, currentLoseStreak: 0, maxLoseStreak: 0 }
};
const MAX_HISTORY = 5000;
const AUTO_SAVE_INTERVAL = 1000;
let lastProcessedPhien = { hu: new Set(), md5: new Set() };
let processedPhienSet = { hu: new Set(), md5: new Set() };

// ==================== HỆ THỐNG BẮT CẦU THÔNG MINH NHÂN TẠO ====================

// 1. HỆ THỐNG BỘ NHỚ PHÂN TẦNG
class TieredMemorySystem {
  constructor() {
    this.memories = {
      immediate: [],
      shortTerm: [],
      mediumTerm: [],
      longTerm: [],
      permanent: []
    };
    this.patternLibrary = new Map();
    this.thresholds = { immediate: 10, shortTerm: 50, mediumTerm: 200, longTerm: 1000 };
  }
  
  addToMemory(pattern, outcome, confidence, wasCorrect) {
    const memoryItem = { pattern, outcome, confidence, wasCorrect, timestamp: Date.now(), importance: this.calculateImportance(pattern, wasCorrect) };
    this.memories.immediate.unshift(memoryItem);
    if (this.memories.immediate.length > this.thresholds.immediate) this.memories.shortTerm.unshift(this.memories.immediate.pop());
    if (this.memories.shortTerm.length > this.thresholds.shortTerm) this.memories.mediumTerm.unshift(this.memories.shortTerm.pop());
    if (this.memories.mediumTerm.length > this.thresholds.mediumTerm) this.memories.longTerm.unshift(this.memories.mediumTerm.pop());
    if (this.memories.longTerm.length > this.thresholds.longTerm) this.memories.permanent.unshift(this.memories.longTerm.pop());
    this.updatePatternLibrary(pattern, outcome, wasCorrect);
  }
  
  calculateImportance(pattern, wasCorrect) { return 1.0 + (pattern.length > 8 ? 0.3 : 0) + (!wasCorrect ? 0.5 : 0); }
  
  updatePatternLibrary(pattern, outcome, wasCorrect) {
    if (!this.patternLibrary.has(pattern)) this.patternLibrary.set(pattern, { occurrences: 0, taiOutcomes: 0, xiuOutcomes: 0, correctPredictions: 0, successRate: 0.5 });
    const record = this.patternLibrary.get(pattern);
    record.occurrences++;
    if (outcome === 'Tài') record.taiOutcomes++; else record.xiuOutcomes++;
    if (wasCorrect) record.correctPredictions++;
    record.successRate = record.correctPredictions / record.occurrences;
  }
  
  findMatchingPatterns(currentPattern, maxResults = 10) {
    const matches = [];
    const searchMem = (mem) => {
      for (const item of mem) {
        if (item.pattern === currentPattern) matches.push({ ...item, source: 'exact', similarity: 1.0 });
        else if (item.pattern.length === currentPattern.length) {
          let sim = 0; for (let i = 0; i < currentPattern.length; i++) if (currentPattern[i] === item.pattern[i]) sim++;
          sim /= currentPattern.length;
          if (sim > 0.7) matches.push({ ...item, source: 'similar', similarity: sim });
        }
      }
    };
    searchMem(this.memories.immediate); searchMem(this.memories.shortTerm);
    searchMem(this.memories.mediumTerm); searchMem(this.memories.longTerm); searchMem(this.memories.permanent);
    matches.sort((a, b) => (b.similarity * b.importance) - (a.similarity * a.importance));
    return matches.slice(0, maxResults);
  }
  
  getPatternPrediction(currentPattern) {
    const matches = this.findMatchingPatterns(currentPattern, 20);
    if (matches.length === 0) return null;
    let weightedTai = 0, weightedXiu = 0, totalWeight = 0;
    for (const match of matches) {
      const weight = match.similarity * match.importance;
      if (match.outcome === 'Tài') weightedTai += weight; else weightedXiu += weight;
      totalWeight += weight;
    }
    if (totalWeight === 0) return null;
    const taiProb = weightedTai / totalWeight;
    return { prediction: taiProb > 0.5 ? 'Tài' : 'Xỉu', confidence: Math.min(96, 50 + Math.abs(taiProb - 0.5) * 90), name: 'TieredMemory', matchCount: matches.length };
  }
}

// 2. PHÂN TÍCH XU HƯỚNG
class TrendAnalyzer {
  analyze(results) {
    if (results.length < 5) return null;
    let trendStrength = 0, trendDirection = 0;
    for (let i = 1; i < Math.min(20, results.length); i++) {
      if (results[i] === results[i-1]) { trendStrength++; if (results[i] === 'Tài') trendDirection++; else trendDirection--; }
      else trendStrength -= 0.5;
    }
    const normStrength = (trendStrength + 10) / 20;
    return { prediction: trendDirection > 0 ? 'Tài' : 'Xỉu', confidence: Math.min(90, 55 + normStrength * 35), name: 'TrendAnalyzer' };
  }
}

// 3. PHÁT HIỆN CHU KỲ
class CycleDetector {
  analyze(results) {
    if (results.length < 10) return null;
    let bestCycle = null, bestStrength = 0;
    for (let period = 2; period <= 8; period++) {
      let matches = 0;
      for (let i = period; i < Math.min(results.length, period * 3); i++) if (results[i] === results[i - period]) matches++;
      const strength = matches / Math.min(results.length - period, period * 2);
      if (strength > bestStrength && strength > 0.6) { bestStrength = strength; bestCycle = period; }
    }
    if (!bestCycle) return null;
    return { prediction: results[bestCycle - 1], confidence: Math.min(88, 60 + bestStrength * 30), name: 'CycleDetector' };
  }
}

// 4. PHÂN TÍCH HÀI HÒA FIBONACCI
class HarmonicAnalyzer {
  analyze(results) {
    if (results.length < 10) return null;
    const numerical = results.map(r => r === 'Tài' ? 1 : 0);
    const points = [];
    for (let i = 1; i < numerical.length - 1; i++) {
      if (numerical[i] > numerical[i-1] && numerical[i] > numerical[i+1]) points.push({ value: numerical[i], type: 'peak' });
      else if (numerical[i] < numerical[i-1] && numerical[i] < numerical[i+1]) points.push({ value: numerical[i], type: 'trough' });
    }
    if (points.length < 4) return null;
    const lastPoints = points.slice(-4);
    const ratios = [];
    for (let i = 1; i < lastPoints.length; i++) ratios.push(Math.abs(lastPoints[i].value - lastPoints[i-1].value));
    if (ratios.length >= 2) {
      const ratio = ratios[1] / (ratios[0] + 0.001);
      const fibLevels = [0.382, 0.5, 0.618, 0.786];
      let bestMatch = null, bestDiff = 1;
      for (const level of fibLevels) { const diff = Math.abs(ratio - level); if (diff < bestDiff) { bestDiff = diff; bestMatch = level; } }
      if (bestMatch && bestDiff < 0.1) {
        const lastType = lastPoints[lastPoints.length - 1].type;
        return { prediction: lastType === 'peak' ? 'Xỉu' : 'Tài', confidence: Math.min(92, 65 + (1 - bestDiff) * 25), name: 'HarmonicAnalyzer' };
      }
    }
    return null;
  }
}

// 5. PHÁT HIỆN MẪU TRUYỀN THỐNG
class TraditionalPatternDetector {
  detectLongStreak(results) {
    if (results.length < 3) return null;
    let streak = 1; for (let i = 1; i < results.length; i++) { if (results[i] === results[0]) streak++; else break; }
    if (streak >= 3) return { prediction: streak >= 5 ? (results[0] === 'Tài' ? 'Xỉu' : 'Tài') : results[0], confidence: streak >= 7 ? 84 : (streak >= 5 ? 74 : 66), name: `LongStreak_${streak}` };
    return null;
  }
  
  detectAlternating(results) {
    if (results.length < 4) return null;
    let alt = 1; for (let i = 1; i < results.length; i++) { if (results[i] !== results[i-1]) alt++; else break; }
    if (alt >= 4) return { prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: Math.min(80, 64 + alt * 2), name: `Alternating_${alt}` };
    return null;
  }
  
  detectPairPattern(results) {
    if (results.length < 4) return null;
    const pairs = [];
    for (let i = 0; i < results.length - 1 && pairs.length < 4; i += 2) { if (results[i] === results[i+1]) pairs.push(results[i]); else break; }
    if (pairs.length >= 2) {
      let isAlt = true; for (let i = 1; i < pairs.length; i++) if (pairs[i] === pairs[i-1]) isAlt = false;
      if (isAlt) return { prediction: pairs[pairs.length-1] === 'Tài' ? 'Xỉu' : 'Tài', confidence: Math.min(76, 64 + pairs.length * 3), name: `PairPattern_${pairs.length}` };
    }
    return null;
  }
  
  detectTriplePattern(results) {
    if (results.length < 6) return null;
    const triples = [];
    for (let i = 0; i < results.length - 2 && triples.length < 3; i += 3) { if (results[i] === results[i+1] && results[i+1] === results[i+2]) triples.push(results[i]); else break; }
    if (triples.length >= 1) {
      const pos = results.length % 3;
      let prediction = triples[triples.length-1];
      if (pos === 0) prediction = prediction === 'Tài' ? 'Xỉu' : 'Tài';
      return { prediction: prediction, confidence: 68 + triples.length * 4, name: `TriplePattern_${triples.length}` };
    }
    return null;
  }
  
  detectOneTwoOne(results) {
    if (results.length < 4) return null;
    if (results[0] !== results[1] && results[1] === results[2] && results[2] !== results[3] && results[0] === results[3])
      return { prediction: results[0], confidence: 70, name: 'OneTwoOne' };
    return null;
  }
  
  detectSmartTrend(results) {
    if (results.length < 10) return null;
    const last5 = results.slice(0, 5), prev5 = results.slice(5, 10);
    const taiLast5 = last5.filter(r => r === 'Tài').length, taiPrev5 = prev5.filter(r => r === 'Tài').length;
    if ((taiLast5 >= 4 && taiPrev5 <= 1) || (taiLast5 <= 1 && taiPrev5 >= 4)) {
      const dominant = taiLast5 >= 4 ? 'Tài' : 'Xỉu';
      return { prediction: dominant === 'Tài' ? 'Xỉu' : 'Tài', confidence: 76, name: 'SmartTrend' };
    }
    return null;
  }
  
  detectReversal(results) {
    if (results.length < 5) return null;
    let isAlt = true; for (let i = 0; i < 4; i++) if (results[i] === results[i+1]) isAlt = false;
    if (isAlt) return { prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 72, name: 'ReversalPattern' };
    return null;
  }
  
  detectAll(results) {
    const patterns = [];
    const detectors = [this.detectLongStreak, this.detectAlternating, this.detectPairPattern, this.detectTriplePattern, this.detectOneTwoOne, this.detectSmartTrend, this.detectReversal];
    for (const detector of detectors) { const result = detector(results); if (result) patterns.push(result); }
    return patterns;
  }
}

// 6. HỆ THỐNG DỰ ĐOÁN CHÍNH
class UltimatePredictionSystem {
  constructor() {
    this.memory = new TieredMemorySystem();
    this.trendAnalyzer = new TrendAnalyzer();
    this.cycleDetector = new CycleDetector();
    this.harmonicAnalyzer = new HarmonicAnalyzer();
    this.traditionalDetector = new TraditionalPatternDetector();
    this.predictionHistory = [];
    this.modelWeights = { memory: 1.0, trend: 0.9, cycle: 0.85, harmonic: 0.8, traditional: 0.95 };
    this.learningStats = { totalPredictions: 0, correctPredictions: 0, currentWinStreak: 0, maxWinStreak: 0, currentLoseStreak: 0, maxLoseStreak: 0 };
  }
  
  encodePattern(results) { return results.slice(0, 10).map(r => r === 'Tài' ? 'T' : 'X').join(''); }
  
  async predict(data, type) {
    if (!data || data.length === 0) return { prediction: 'Tài', confidence: 55, factors: ['Không có dữ liệu'], allPatterns: [], detailedAnalysis: {} };
    
    const results = data.map(d => d.Ket_qua);
    if (results.length < 3) return { prediction: 'Tài', confidence: 55, factors: ['Chưa đủ dữ liệu'], allPatterns: [], detailedAnalysis: {} };
    
    const currentPattern = this.encodePattern(results);
    const predictions = [];
    
    const memPred = this.memory.getPatternPrediction(currentPattern);
    if (memPred) predictions.push({ ...memPred, model: 'memory', weight: this.modelWeights.memory });
    
    const trendPred = this.trendAnalyzer.analyze(results);
    if (trendPred) predictions.push({ ...trendPred, model: 'trend', weight: this.modelWeights.trend });
    
    const cyclePred = this.cycleDetector.analyze(results);
    if (cyclePred) predictions.push({ ...cyclePred, model: 'cycle', weight: this.modelWeights.cycle });
    
    const harmonicPred = this.harmonicAnalyzer.analyze(results);
    if (harmonicPred) predictions.push({ ...harmonicPred, model: 'harmonic', weight: this.modelWeights.harmonic });
    
    const traditionalPreds = this.traditionalDetector.detectAll(results);
    for (const pred of traditionalPreds) predictions.push({ ...pred, model: 'traditional', weight: this.modelWeights.traditional });
    
    if (predictions.length === 0) {
      const taiCount = results.slice(0, 5).filter(r => r === 'Tài').length;
      return { prediction: taiCount >= 3 ? 'Tài' : 'Xỉu', confidence: 55, factors: ['Dự đoán cơ bản'], allPatterns: [], detailedAnalysis: {} };
    }
    
    let taiScore = 0, xiuScore = 0, totalWeight = 0;
    for (const pred of predictions) {
      const weight = (pred.weight || 0.7) * (pred.confidence / 100);
      if (pred.prediction === 'Tài') taiScore += weight; else xiuScore += weight;
      totalWeight += weight;
    }
    
    const taiProb = taiScore / totalWeight;
    let finalPrediction = taiProb > 0.5 ? 'Tài' : 'Xỉu';
    let confidence = (Math.max(taiScore, xiuScore) / totalWeight) * 100;
    const agreement = predictions.filter(p => p.prediction === finalPrediction).length / predictions.length;
    confidence *= (0.7 + agreement * 0.4);
    confidence = Math.min(96, Math.max(58, Math.round(confidence)));
    
    const factors = [`${predictions.length} thuật toán`, `Đồng thuận: ${(agreement * 100).toFixed(0)}%`, `Bộ nhớ: ${this.memory.patternLibrary.size} mẫu`];
    const allPatterns = predictions.slice(0, 5).map(p => p.name || p.model);
    
    return { prediction: finalPrediction, confidence, factors, allPatterns, detailedAnalysis: { totalModels: predictions.length, topModels: allPatterns.slice(0, 3) } };
  }
  
  updateResult(prediction, actual, wasCorrect, confidence) {
    this.learningStats.totalPredictions++;
    if (wasCorrect) {
      this.learningStats.correctPredictions++;
      this.learningStats.currentWinStreak++;
      this.learningStats.currentLoseStreak = 0;
      if (this.learningStats.currentWinStreak > this.learningStats.maxWinStreak) this.learningStats.maxWinStreak = this.learningStats.currentWinStreak;
    } else {
      this.learningStats.currentLoseStreak++;
      this.learningStats.currentWinStreak = 0;
      if (this.learningStats.currentLoseStreak > this.learningStats.maxLoseStreak) this.learningStats.maxLoseStreak = this.learningStats.currentLoseStreak;
    }
    
    if (this.predictionHistory.length > 0) {
      const lastPred = this.predictionHistory[this.predictionHistory.length - 1];
      if (lastPred && lastPred.prediction === prediction) {
        this.memory.addToMemory(lastPred.pattern || '', actual, confidence, wasCorrect);
        const delta = wasCorrect ? 0.008 : -0.005;
        for (const key of Object.keys(this.modelWeights)) this.modelWeights[key] = Math.max(0.3, Math.min(2.0, this.modelWeights[key] + (Math.random() * delta * 0.5)));
      }
    }
    this.saveState();
  }
  
  saveState() {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem('ultimate_system', JSON.stringify({ modelWeights: this.modelWeights, learningStats: this.learningStats, timestamp: Date.now() })); } catch(e) {}
  }
  
  loadState() {
    try { if (typeof localStorage !== 'undefined') { const saved = localStorage.getItem('ultimate_system'); if (saved) { const data = JSON.parse(saved); if (data.modelWeights) Object.assign(this.modelWeights, data.modelWeights); if (data.learningStats) Object.assign(this.learningStats, data.learningStats); } } } catch(e) {}
  }
}

const predictionSystem = new UltimatePredictionSystem();
predictionSystem.loadState();

// ==================== HÀM LOAD/SAVE ====================
function loadLearningData() {
  try {
    if (fs.existsSync(LEARNING_FILE)) {
      const data = fs.readFileSync(LEARNING_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed.statistics) statistics = parsed.statistics;
      if (parsed.modelWeights) predictionSystem.modelWeights = parsed.modelWeights;
      console.log('✅ Loaded learning data');
    }
  } catch (error) { console.error('Error loading:', error.message); }
}

function saveLearningData() {
  try {
    fs.writeFileSync(LEARNING_FILE, JSON.stringify({ statistics, modelWeights: predictionSystem.modelWeights, learningStats: predictionSystem.learningStats, lastSaved: new Date().toISOString() }, null, 2));
  } catch (error) { console.error('Error saving:', error.message); }
}

function loadPredictionHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      const parsed = JSON.parse(data);
      predictionHistory = parsed.history || { hu: [], md5: [] };
      if (parsed.processedPhien) {
        for (const type of ['hu', 'md5']) if (parsed.processedPhien[type]) processedPhienSet[type] = new Set(parsed.processedPhien[type]);
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
      if (record.ket_qua_du_doan === 'Đúng ✅') { wins++; currentWinStreak++; currentLoseStreak = 0; maxWinStreak = Math.max(maxWinStreak, currentWinStreak); }
      else if (record.ket_qua_du_doan === 'Sai ❌') { losses++; currentLoseStreak++; currentWinStreak = 0; maxLoseStreak = Math.max(maxLoseStreak, currentLoseStreak); }
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

// === HÀM LẤY DỮ LIỆU API ===
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

function savePredictionToHistory(type, phien, prediction, confidence, latestData) {
  const record = {
    Phien: latestData.Phien, Xuc_xac_1: latestData.Xuc_xac_1, Xuc_xac_2: latestData.Xuc_xac_2, Xuc_xac_3: latestData.Xuc_xac_3,
    Tong: latestData.Tong, Ket_qua: latestData.Ket_qua, Do_tin_cay: `${confidence}%`, Phien_hien_tai: phien.toString(),
    Du_doan: prediction, ket_qua_du_doan: '', id: '@anhkhoi', timestamp: new Date().toISOString()
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
        predictionSystem.updateResult(record.Du_doan, actual.Ket_qua, wasCorrect, parseInt(record.Do_tin_cay));
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
      const currentPhien = dataHu[0].Phien;
      if (!processedPhienSet.hu.has(currentPhien)) {
        processedPhienSet.hu.add(currentPhien);
        const nextPhien = currentPhien + 1;
        const result = await predictionSystem.predict(dataHu, 'hu');
        savePredictionToHistory('hu', nextPhien, result.prediction, result.confidence, dataHu[0]);
        console.log(`[${new Date().toLocaleTimeString()}] HU ${currentPhien} -> dự đoán ${nextPhien}: ${result.prediction} (${result.confidence}%)`);
      }
    }
    
    const dataMd5 = await fetchDataMd5();
    if (dataMd5 && dataMd5.length > 0) {
      const currentPhien = dataMd5[0].Phien;
      if (!processedPhienSet.md5.has(currentPhien)) {
        processedPhienSet.md5.add(currentPhien);
        const nextPhien = currentPhien + 1;
        const result = await predictionSystem.predict(dataMd5, 'md5');
        savePredictionToHistory('md5', nextPhien, result.prediction, result.confidence, dataMd5[0]);
        console.log(`[${new Date().toLocaleTimeString()}] MD5 ${currentPhien} -> dự đoán ${nextPhien}: ${result.prediction} (${result.confidence}%)`);
      }
    }
    savePredictionHistory();
  } catch (error) { console.error('[Auto] Error:', error.message); }
}

function startAutoTask() { console.log('🚀 Auto prediction - 1 giây'); setInterval(autoProcessPredictions, AUTO_SAVE_INTERVAL); }

// ==================== ENDPOINTS ====================
app.get('/', (req, res) => res.json({ message: '@anhkhoi - Tài Xỉu Prediction API', status: 'running', endpoints: ['/hu', '/md5', '/thongke/html'] }));

app.get('/hu', async (req, res) => {
  try {
    const data = await fetchDataHu();
    if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    const currentPhien = data[0].Phien;
    const result = await predictionSystem.predict(data, 'hu');
    const record = savePredictionToHistory('hu', currentPhien + 1, result.prediction, result.confidence, data[0]);
    setTimeout(() => updateHistoryStatus('hu'), 5000);
    res.json({ success: true, phien_hien_tai: currentPhien, phien_du_doan: currentPhien + 1, du_doan: result.prediction, do_tin_cay: `${result.confidence}%`, cac_cau: result.allPatterns, yeu_to: result.factors });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/md5', async (req, res) => {
  try {
    const data = await fetchDataMd5();
    if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    const currentPhien = data[0].Phien;
    const result = await predictionSystem.predict(data, 'md5');
    const record = savePredictionToHistory('md5', currentPhien + 1, result.prediction, result.confidence, data[0]);
    setTimeout(() => updateHistoryStatus('md5'), 5000);
    res.json({ success: true, phien_hien_tai: currentPhien, phien_du_doan: currentPhien + 1, du_doan: result.prediction, do_tin_cay: `${result.confidence}%`, cac_cau: result.allPatterns, yeu_to: result.factors });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/thongke', async (req, res) => {
  await updateHistoryStatus('hu'); await updateHistoryStatus('md5');
  res.json({ success: true, statistics, lastUpdated: new Date().toISOString() });
});

// Giao diện HTML siêu đẹp
app.get('/thongke/html', async (req, res) => {
  await updateHistoryStatus('hu'); await updateHistoryStatus('md5');
  
  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>LẨU CUA 79 - HỆ THỐNG DỰ ĐOÁN TÀI XỈU | @anhkhoi</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700;14..32,800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #0a0f1a 0%, #0d1525 50%, #0a0f1a 100%);
            min-height: 100vh;
            color: #e8edf5;
        }
        .bg-animation { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; overflow: hidden; }
        .bg-animation::before {
            content: '';
            position: absolute;
            width: 200%; height: 200%;
            background: radial-gradient(circle at 20% 40%, rgba(255,107,107,0.08) 0%, transparent 50%),
                        radial-gradient(circle at 80% 60%, rgba(78,205,196,0.08) 0%, transparent 50%);
            animation: rotate 20s linear infinite;
        }
        @keyframes rotate { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .container { position: relative; z-index: 1; max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header {
            text-align: center; padding: 30px 20px; margin-bottom: 30px;
            background: rgba(10, 15, 26, 0.6); backdrop-filter: blur(20px);
            border-radius: 48px; border: 1px solid rgba(255,255,255,0.08);
        }
        .logo { display: inline-flex; align-items: center; gap: 12px; margin-bottom: 16px; }
        .logo-icon {
            width: 48px; height: 48px;
            background: linear-gradient(135deg, #ff6b6b, #ff8e53);
            border-radius: 24px; display: flex; align-items: center; justify-content: center; font-size: 24px;
            box-shadow: 0 8px 32px rgba(255,107,107,0.3);
        }
        .logo h1 { font-size: 32px; font-weight: 800; background: linear-gradient(135deg, #fff, #ffb347); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .badge { display: inline-block; padding: 6px 16px; background: rgba(255,107,107,0.15); border-radius: 40px; font-size: 13px; font-weight: 500; color: #ff8e53; border: 1px solid rgba(255,107,107,0.3); margin-top: 12px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; margin-bottom: 40px; }
        .stat-card {
            background: rgba(15, 25, 45, 0.6); backdrop-filter: blur(10px);
            border-radius: 32px; padding: 24px; border: 1px solid rgba(255,255,255,0.06);
            transition: all 0.3s ease;
        }
        .stat-card:hover { transform: translateY(-4px); border-color: rgba(255,107,107,0.3); box-shadow: 0 20px 40px rgba(0,0,0,0.3); }
        .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .card-title { display: flex; align-items: center; gap: 12px; }
        .card-icon { width: 48px; height: 48px; background: linear-gradient(135deg, #ff6b6b, #ff8e53); border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 22px; }
        .card-title h2 { font-size: 20px; font-weight: 600; }
        .card-title p { font-size: 12px; color: #8a95b0; margin-top: 4px; }
        .stat-value { font-size: 48px; font-weight: 800; background: linear-gradient(135deg, #fff, #ffb347); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .stat-label { font-size: 14px; color: #8a95b0; margin-top: 8px; }
        .stat-detail { display: flex; justify-content: space-between; margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.06); }
        .stat-detail-item { text-align: center; flex: 1; }
        .stat-detail-value { font-size: 24px; font-weight: 700; }
        .stat-detail-label { font-size: 11px; color: #8a95b0; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
        .win { color: #4cd964; } .loss { color: #ff3b30; } .streak { color: #ffcc00; }
        .charts-section { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 40px; }
        .chart-card { background: rgba(15, 25, 45, 0.6); backdrop-filter: blur(10px); border-radius: 32px; padding: 24px; border: 1px solid rgba(255,255,255,0.06); }
        .chart-card h3 { font-size: 18px; font-weight: 600; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
        canvas { max-height: 300px; }
        .history-section { background: rgba(15, 25, 45, 0.6); backdrop-filter: blur(10px); border-radius: 32px; padding: 24px; border: 1px solid rgba(255,255,255,0.06); margin-bottom: 40px; }
        .history-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
        .history-header h3 { font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 10px; }
        .tabs { display: flex; gap: 12px; background: rgba(0,0,0,0.3); padding: 6px; border-radius: 60px; }
        .tab-btn { padding: 8px 24px; border: none; background: transparent; color: #8a95b0; font-family: 'Inter', sans-serif; font-weight: 500; cursor: pointer; border-radius: 40px; transition: all 0.2s ease; }
        .tab-btn.active { background: linear-gradient(135deg, #ff6b6b, #ff8e53); color: white; }
        .history-table-container { overflow-x: auto; max-height: 500px; overflow-y: auto; }
        .history-table { width: 100%; border-collapse: collapse; }
        .history-table th { text-align: left; padding: 16px 12px; background: rgba(0,0,0,0.2); font-weight: 600; font-size: 13px; color: #8a95b0; position: sticky; top: 0; background: #0d1525; }
        .history-table td { padding: 14px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 14px; }
        .history-table tr:hover { background: rgba(255,255,255,0.03); }
        .result-tai { color: #4cd964; font-weight: 600; }
        .result-xiu { color: #ff3b30; font-weight: 600; }
        .pred-correct { color: #4cd964; } .pred-wrong { color: #ff3b30; }
        .confidence-badge { display: inline-block; padding: 4px 10px; background: rgba(255,107,107,0.15); border-radius: 20px; font-size: 12px; font-weight: 500; }
        .footer { text-align: center; padding: 30px; color: #5a6580; font-size: 13px; border-top: 1px solid rgba(255,255,255,0.05); }
        .refresh-btn { background: rgba(255,107,107,0.15); border: 1px solid rgba(255,107,107,0.3); padding: 10px 20px; border-radius: 40px; color: #ff8e53; cursor: pointer; font-family: 'Inter', sans-serif; font-weight: 500; transition: all 0.2s ease; }
        .refresh-btn:hover { background: rgba(255,107,107,0.25); }
        .live-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(76, 217, 100, 0.15); padding: 4px 12px; border-radius: 40px; font-size: 11px; color: #4cd964; }
        .live-dot { width: 8px; height: 8px; background: #4cd964; border-radius: 50%; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.2); } }
        .copyright { font-size: 11px; color: #3a4560; margin-top: 8px; }
        @media (max-width: 768px) { .stats-grid { grid-template-columns: 1fr; } .charts-section { grid-template-columns: 1fr; } .stat-value { font-size: 36px; } .container { padding: 12px; } .logo h1 { font-size: 24px; } }
    </style>
</head>
<body>
    <div class="bg-animation"></div>
    <div class="container">
        <div class="header">
            <div class="logo"><div class="logo-icon"><i class="fas fa-dice-d6"></i></div><h1>LẨU CUA 79</h1></div>
            <div class="badge"><i class="fas fa-chart-line"></i> HỆ THỐNG DỰ ĐOÁN THẾ HỆ MỚI 2026 | CẤP ĐỘ QUỐC GIA</div>
            <div style="margin-top: 20px;"><span class="live-badge"><span class="live-dot"></span> LIVE | Cập nhật tự động 3s</span></div>
        </div>
        
        <div class="stats-grid" id="statsGrid"></div>
        
        <div class="charts-section">
            <div class="chart-card"><h3><i class="fas fa-chart-pie" style="color: #ff8e53;"></i> Tỉ lệ thắng/thua - HŨ</h3><canvas id="chartHu"></canvas></div>
            <div class="chart-card"><h3><i class="fas fa-chart-pie" style="color: #ff8e53;"></i> Tỉ lệ thắng/thua - MD5</h3><canvas id="chartMd5"></canvas></div>
        </div>
        
        <div class="history-section">
            <div class="history-header">
                <h3><i class="fas fa-history"></i> LỊCH SỬ DỰ ĐOÁN</h3>
                <div class="tabs"><button class="tab-btn active" onclick="switchTab('hu')">HŨ</button><button class="tab-btn" onclick="switchTab('md5')">MD5</button></div>
                <button class="refresh-btn" onclick="refreshData()"><i class="fas fa-sync-alt"></i> Làm mới</button>
            </div>
            <div class="history-table-container"><table class="history-table" id="historyTable"><thead><tr><th>Phiên</th><th>Kết quả</th><th>Dự đoán</th><th>Độ tin cậy</th><th>Xúc xắc</th><th>Kết quả</th></tr></thead><tbody id="historyBody"></tbody></table></div>
        </div>
        
        <div class="footer">
            <p>© 2026 @anhkhoi | Hệ thống dự đoán tích hợp AI | Bảo vệ bản quyền cấp quốc gia</p>
            <p class="copyright">⚠️ Dự đoán mang tính tham khảo, không đảm bảo chính xác tuyệt đối</p>
        </div>
    </div>
    
    <script>
        let currentTab = 'hu', charts = {};
        async function fetchStats() {
            try { const res = await fetch('/thongke'); const data = await res.json(); if (data.success) updateStatsUI(data.statistics); }
            catch(e) { console.error(e); }
        }
        async function fetchHistory() {
            try { const res = await fetch(\`/\${currentTab}/lichsu\`); const data = await res.json(); updateHistoryTable(data.history); }
            catch(e) { console.error(e); }
        }
        function updateStatsUI(stats) {
            document.getElementById('statsGrid').innerHTML = \`
                <div class="stat-card"><div class="card-header"><div class="card-title"><div class="card-icon"><i class="fas fa-crown"></i></div><div><h2>HŨ</h2><p>Tài Xỉu Hũ Nổ</p></div></div></div>
                <div class="stat-value">\${stats.hu.accuracy}%</div><div class="stat-label">Tỷ lệ chính xác</div>
                <div class="stat-detail"><div class="stat-detail-item"><div class="stat-detail-value win">\${stats.hu.wins}</div><div class="stat-detail-label">THẮNG</div></div>
                <div class="stat-detail-item"><div class="stat-detail-value loss">\${stats.hu.losses}</div><div class="stat-detail-label">THUA</div></div>
                <div class="stat-detail-item"><div class="stat-detail-value">\${stats.hu.total}</div><div class="stat-detail-label">TỔNG</div></div></div>
                <div class="stat-detail"><div class="stat-detail-item"><div class="stat-detail-value streak">\${stats.hu.currentWinStreak}</div><div class="stat-detail-label">THẮNG HIỆN TẠI</div></div>
                <div class="stat-detail-item"><div class="stat-detail-value streak">\${stats.hu.maxWinStreak}</div><div class="stat-detail-label">THẮNG MAX</div></div>
                <div class="stat-detail-item"><div class="stat-detail-value loss">\${stats.hu.currentLoseStreak}</div><div class="stat-detail-label">THUA HIỆN TẠI</div></div>
                <div class="stat-detail-item"><div class="stat-detail-value loss">\${stats.hu.maxLoseStreak}</div><div class="stat-detail-label">THUA MAX</div></div></div></div>
                <div class="stat-card"><div class="card-header"><div class="card-title"><div class="card-icon"><i class="fas fa-shield-alt"></i></div><div><h2>MD5</h2><p>Tài Xỉu MD5</p></div></div></div>
                <div class="stat-value">\${stats.md5.accuracy}%</div><div class="stat-label">Tỷ lệ chính xác</div>
                <div class="stat-detail"><div class="stat-detail-item"><div class="stat-detail-value win">\${stats.md5.wins}</div><div class="stat-detail-label">THẮNG</div></div>
                <div class="stat-detail-item"><div class="stat-detail-value loss">\${stats.md5.losses}</div><div class="stat-detail-label">THUA</div></div>
                <div class="stat-detail-item"><div class="stat-detail-value">\${stats.md5.total}</div><div class="stat-detail-label">TỔNG</div></div></div>
                <div class="stat-detail"><div class="stat-detail-item"><div class="stat-detail-value streak">\${stats.md5.currentWinStreak}</div><div class="stat-detail-label">THẮNG HIỆN TẠI</div></div>
                <div class="stat-detail-item"><div class="stat-detail-value streak">\${stats.md5.maxWinStreak}</div><div class="stat-detail-label">THẮNG MAX</div></div>
                <div class="stat-detail-item"><div class="stat-detail-value loss">\${stats.md5.currentLoseStreak}</div><div class="stat-detail-label">THUA HIỆN TẠI</div></div>
                <div class="stat-detail-item"><div class="stat-detail-value loss">\${stats.md5.maxLoseStreak}</div><div class="stat-detail-label">THUA MAX</div></div></div></div>
            \`;
            if (charts.hu) charts.hu.destroy(); if (charts.md5) charts.md5.destroy();
            charts.hu = new Chart(document.getElementById('chartHu'), { type: 'doughnut', data: { labels: ['Thắng', 'Thua'], datasets: [{ data: [stats.hu.wins, stats.hu.losses], backgroundColor: ['#4cd964', '#ff3b30'], borderWidth: 0 }] }, options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#e8edf5' } } } } });
            charts.md5 = new Chart(document.getElementById('chartMd5'), { type: 'doughnut', data: { labels: ['Thắng', 'Thua'], datasets: [{ data: [stats.md5.wins, stats.md5.losses], backgroundColor: ['#4cd964', '#ff3b30'], borderWidth: 0 }] }, options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#e8edf5' } } } } });
        }
        function updateHistoryTable(history) {
            const tbody = document.getElementById('historyBody');
            if (!history || history.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Chưa có dữ liệu</td></tr>'; return; }
            tbody.innerHTML = history.slice(0, 100).map(r => \`<tr><td><strong>\${r.Phien}</strong></td><td class="result-\${r.Ket_qua === 'Tài' ? 'tai' : 'xiu'}"><i class="fas fa-arrow-\${r.Ket_qua === 'Tài' ? 'up' : 'down'}"></i> \${r.Ket_qua}</td><td class="result-\${r.Du_doan === 'Tài' ? 'tai' : 'xiu'}"><i class="fas fa-arrow-\${r.Du_doan === 'Tài' ? 'up' : 'down'}"></i> \${r.Du_doan}</td><td><span class="confidence-badge">\${r.Do_tin_cay}</span></td><td>\${r.Xuc_xac_1}-\${r.Xuc_xac_2}-\${r.Xuc_xac_3}</td><td class="\${r.ket_qua_du_doan === 'Đúng ✅' ? 'pred-correct' : 'pred-wrong'}">\${r.ket_qua_du_doan || '⏳ Đang chờ...'}</td></tr>\`).join('');
        }
        function switchTab(tab) { currentTab = tab; document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active')); event.target.classList.add('active'); fetchHistory(); }
        async function refreshData() { await fetchStats(); await fetchHistory(); }
        setInterval(() => { fetchStats(); fetchHistory(); }, 3000);
        fetchStats(); fetchHistory();
    </script>
</body>
</html>`;
  res.send(html);
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

// KHỞI ĐỘNG
loadLearningData();
loadPredictionHistory();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================`);
  console.log(`🚀 SERVER @anhkhoi - SIÊU DỰ ĐOÁN TÀI XỈU`);
  console.log(`📍 http://0.0.0.0:${PORT}`);
  console.log(`📊 THỐNG KÊ: http://0.0.0.0:${PORT}/thongke/html`);
  console.log(`⚡ Auto update mỗi 1 giây | Chống trùng phiên`);
  console.log(`🎯 Thuật toán: TieredMemory + Trend + Cycle + Harmonic + Traditional`);
  console.log(`========================================\n`);
  startAutoTask();
});
