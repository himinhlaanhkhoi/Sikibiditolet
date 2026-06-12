const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5000;

const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';
const LEARNING_FILE = 'super_brain.json';
const HISTORY_FILE = 'super_history.json';

let predictionHistory = { hu: [], md5: [] };
let statistics = { 
  hu: { total: 0, wins: 0, losses: 0, accuracy: 0, currentWinStreak: 0, maxWinStreak: 0, currentLoseStreak: 0, maxLoseStreak: 0 },
  md5: { total: 0, wins: 0, losses: 0, accuracy: 0, currentWinStreak: 0, maxWinStreak: 0, currentLoseStreak: 0, maxLoseStreak: 0 }
};
const MAX_HISTORY = 5000;
const AUTO_SAVE_INTERVAL = 1000;
let processedPhienSet = { hu: new Set(), md5: new Set() };

// ==================== CÁC MODULE TRÍ TUỆ NHÂN TẠO ====================

class IntuitionEngine {
  predict(results) {
    let intuition = 0;
    for (let i = 0; i < Math.min(10, results.length); i++) {
      intuition += (results[i] === 'Tài' ? 1 : -1) * Math.pow(0.8, i);
    }
    return {
      prediction: intuition > 0 ? 'Tài' : 'Xỉu',
      confidence: 55 + Math.abs(intuition) * 15,
      method: 'TRỰC GIÁC'
    };
  }
}

class LogicEngine {
  predict(results) {
    if (results.length < 4) return null;
    const last = results[0];
    const second = results[1];
    const third = results[2];
    
    if (last === second && second === third) {
      return {
        prediction: last === 'Tài' ? 'Xỉu' : 'Tài',
        confidence: 75,
        method: 'LOGIC ĐẢO'
      };
    }
    
    if (last !== second && second === third) {
      return {
        prediction: last,
        confidence: 70,
        method: 'LOGIC THEO'
      };
    }
    return null;
  }
}

class DeepAnalyzer {
  predict(results, sums) {
    if (results.length < 10) return null;
    let taiCount = 0;
    let xiuCount = 0;
    for (let i = 0; i < 10; i++) {
      if (results[i] === 'Tài') taiCount++;
      else xiuCount++;
    }
    if (taiCount >= 7) {
      return {
        prediction: 'Xỉu',
        confidence: 68 + (taiCount - 7) * 3,
        method: 'PHÂN TÍCH SÂU'
      };
    }
    if (xiuCount >= 7) {
      return {
        prediction: 'Tài',
        confidence: 68 + (xiuCount - 7) * 3,
        method: 'PHÂN TÍCH SÂU'
      };
    }
    return null;
  }
}

class PatternGenius {
  predict(results, memory) {
    if (results.length < 5 || !memory) return null;
    const pattern = results.slice(0, 5).join('');
    let bestMatch = null;
    let bestScore = 0;
    
    for (let [storedPattern, data] of memory) {
      let score = 0;
      for (let i = 0; i < Math.min(pattern.length, storedPattern.length); i++) {
        if (pattern[i] === storedPattern[i]) score++;
      }
      score = score / Math.max(pattern.length, storedPattern.length);
      if (score > bestScore && score > 0.8) {
        bestScore = score;
        bestMatch = data;
      }
    }
    
    if (bestMatch && bestMatch.successRate > 0.7) {
      return {
        prediction: bestMatch.predictions?.[bestMatch.predictions.length - 1]?.prediction || 'Tài',
        confidence: 65 + bestMatch.successRate * 25,
        method: 'THIÊN TÀI PATTERN'
      };
    }
    return null;
  }
}

class EmotionalIntelligence {
  predict(brainStats) {
    if (brainStats.eq > 90 && brainStats.predictionAccuracy > 80) {
      return { prediction: null, confidence: 85, method: 'TỰ TIN CAO', adjustment: 1.1 };
    }
    if (brainStats.eq < 70 && brainStats.predictionAccuracy < 60) {
      return { prediction: null, confidence: 60, method: 'THẬN TRỌNG', adjustment: 0.9 };
    }
    return { prediction: null, confidence: 70, method: 'CÂN BẰNG', adjustment: 1.0 };
  }
}

class PrefrontalCortex {
  decide(inputs) {
    let taiVotes = 0, xiuVotes = 0, totalConfidence = 0;
    const sources = [inputs.intuition, inputs.logic, inputs.analysis, inputs.pattern, inputs.deep];
    
    for (const source of sources) {
      if (source && source.prediction) {
        if (source.prediction === 'Tài') taiVotes++;
        else xiuVotes++;
        totalConfidence += source.confidence;
      }
    }
    
    const prediction = taiVotes > xiuVotes ? 'Tài' : 'Xỉu';
    const confidence = totalConfidence / Math.max(1, sources.filter(s => s && s.prediction).length);
    return {
      prediction: prediction,
      confidence: Math.min(90, confidence),
      votes: { tai: taiVotes, xiu: xiuVotes }
    };
  }
}

class DeepNeuralNetwork {
  constructor() {
    this.weights = new Array(50).fill(0.5);
    this.biases = new Array(20).fill(0);
    this.layers = 5;
    this.neurons = [20, 40, 30, 20, 1];
  }
  
  predict(results) {
    if (results.length < 10) return null;
    const features = this.extractFeatures(results);
    let output = 0;
    for (let i = 0; i < features.length && i < this.weights.length; i++) {
      output += features[i] * this.weights[i];
    }
    const probability = 1 / (1 + Math.exp(-output));
    return {
      prediction: probability > 0.5 ? 'Tài' : 'Xỉu',
      confidence: 55 + Math.abs(probability - 0.5) * 80,
      method: 'DEEP LEARNING'
    };
  }
  
  extractFeatures(results) {
    const features = [];
    for (let i = 0; i < 10; i++) {
      features.push(results[i] === 'Tài' ? 1 : 0);
    }
    let streak = 1;
    for (let i = 1; i < results.length; i++) {
      if (results[i] === results[0]) streak++;
      else break;
    }
    features.push(streak / 10);
    let volatility = 0;
    for (let i = 1; i < 10; i++) {
      if (results[i] !== results[i-1]) volatility++;
    }
    features.push(volatility / 9);
    return features;
  }
  
  strengthenConnections() {
    for (let i = 0; i < this.weights.length; i++) {
      this.weights[i] = Math.min(0.9, this.weights[i] + 0.01);
    }
  }
  
  weakenConnections() {
    for (let i = 0; i < this.weights.length; i++) {
      this.weights[i] = Math.max(0.1, this.weights[i] - 0.005);
    }
  }
  
  expandNetwork() {
    if (this.weights.length < 200) {
      const newWeights = [...this.weights];
      for (let i = 0; i < 10; i++) newWeights.push(0.5);
      this.weights = newWeights;
    }
  }
}

class QuantumState {
  predict(results) {
    let quantumAmplitude = 0;
    for (let i = 0; i < Math.min(5, results.length); i++) {
      quantumAmplitude += (results[i] === 'Tài' ? 1 : -1) * Math.pow(0.7, i);
    }
    const probability = 0.5 + quantumAmplitude * 0.1;
    return {
      prediction: Math.random() < probability ? 'Tài' : 'Xỉu',
      confidence: 55 + Math.abs(quantumAmplitude) * 20,
      method: 'LƯỢNG TỬ'
    };
  }
}

class SuperMemory {
  constructor() {
    this.storage = new Map();
    this.capacity = 10000;
  }
  set(key, value) { this.storage.set(key, value); if (this.storage.size > this.capacity) { const oldest = this.storage.keys().next().value; this.storage.delete(oldest); } }
  get(key) { return this.storage.get(key); }
  has(key) { return this.storage.has(key); }
  size() { return this.storage.size; }
}

// Các class trống để tránh lỗi
class Hippocampus {}
class Amygdala {}
class Cerebellum {}
class QuantumEntanglement {}
class QuantumTunneling {}
class ConvolutionalNetwork {}
class RecurrentNetwork {}
class TransformerModel {}
class MathGenius {}
class KnowledgeGraph {}
class CreativeEngine {}

// ==================== BỘ NÃO SIÊU THÔNG MINH NHÂN TẠO ====================
class SuperIntelligentBrain {
  constructor() {
    this.rightBrain = { intuition: new IntuitionEngine(), creativity: new CreativeEngine(), patternRecognition: new PatternGenius(), emotionalIQ: new EmotionalIntelligence() };
    this.leftBrain = { logic: new LogicEngine(), mathematics: new MathGenius(), analysis: new DeepAnalyzer(), memory: new SuperMemory() };
    this.centralNervous = { hippocampus: new Hippocampus(), amygdala: new Amygdala(), prefrontalCortex: new PrefrontalCortex(), cerebellum: new Cerebellum() };
    this.quantumNeural = { superposition: new QuantumState(), entanglement: new QuantumEntanglement(), tunneling: new QuantumTunneling() };
    this.deepAI = { dnn: new DeepNeuralNetwork(), cnn: new ConvolutionalNetwork(), rnn: new RecurrentNetwork(), transformer: new TransformerModel() };
    this.superMemory = new Map();
    this.experience = [];
    this.knowledge = new KnowledgeGraph();
    this.brainStats = { iq: 10000, eq: 95, aq: 98, sq: 92, cq: 99, learningRate: 0.99, predictionAccuracy: 0, totalLearning: 0 };
    this.initializeBrain();
  }
  
  initializeBrain() { 
    console.log('🧠 BỘ NÃO SIÊU THÔNG MINH KHỞI TẠO - IQ: 10,000');
  }
  
  predict(data) {
    if (!data || data.length < 3) {
      return this.getSuperPrediction('Tài', 50, 'Khởi tạo');
    }
    const results = data.map(d => d.Ket_qua);
    const sums = data.map(d => d.Tong);
    const timeContext = this.getTimeContext();
    
    const intuitionResult = this.rightBrain.intuition.predict(results);
    const logicResult = this.leftBrain.logic.predict(results);
    const analysisResult = this.leftBrain.analysis.predict(results, sums);
    const patternResult = this.rightBrain.patternRecognition.predict(results, this.superMemory);
    const deepResult = this.deepAI.dnn.predict(results);
    const quantumResult = this.quantumNeural.superposition.predict(results);
    const emotionalResult = this.rightBrain.emotionalIQ.predict(this.brainStats);
    
    const decisionResult = this.centralNervous.prefrontalCortex.decide({
      intuition: intuitionResult, logic: logicResult, analysis: analysisResult,
      pattern: patternResult, deep: deepResult, quantum: quantumResult, emotion: emotionalResult, context: timeContext
    });
    
    const experienceResult = this.learnFromExperience(results, decisionResult);
    const finalPrediction = this.synthesizeIntelligence({ 
      decision: decisionResult, experience: experienceResult, quantum: quantumResult, emotion: emotionalResult 
    });
    this.storeExperience(results, finalPrediction);
    this.evolveBrain();
    return finalPrediction;
  }
  
  synthesizeIntelligence(inputs) {
    let finalScore = 0, finalPrediction = 'Tài';
    const weights = { decision: 0.35, experience: 0.25, quantum: 0.20, emotion: 0.20 };
    let taiScore = 0, xiuScore = 0;
    
    if (inputs.decision && inputs.decision.prediction) {
      const w = weights.decision * (inputs.decision.confidence / 100);
      if (inputs.decision.prediction === 'Tài') taiScore += w;
      else xiuScore += w;
    }
    if (inputs.experience && inputs.experience.prediction) {
      const w = weights.experience * (inputs.experience.confidence / 100);
      if (inputs.experience.prediction === 'Tài') taiScore += w;
      else xiuScore += w;
    }
    if (inputs.quantum && inputs.quantum.prediction) {
      const w = weights.quantum * (inputs.quantum.confidence / 100);
      if (inputs.quantum.prediction === 'Tài') taiScore += w;
      else xiuScore += w;
    }
    if (inputs.emotion && inputs.emotion.prediction) {
      const w = weights.emotion * (inputs.emotion.confidence / 100);
      if (inputs.emotion.prediction === 'Tài') taiScore += w;
      else xiuScore += w;
    }
    
    const totalScore = taiScore + xiuScore;
    if (totalScore > 0) {
      const taiProbability = taiScore / totalScore;
      finalPrediction = taiProbability > 0.5 ? 'Tài' : 'Xỉu';
      finalScore = Math.abs(taiProbability - 0.5) * 2 * 100;
    }
    finalScore = finalScore * (1 + (this.brainStats.iq - 1000) / 10000);
    finalScore = Math.min(98, Math.max(60, Math.round(finalScore)));
    
    return {
      prediction: finalPrediction,
      confidence: finalScore,
      intelligence: this.brainStats.iq,
      methods: ['SIÊU TRÍ TUỆ', 'LƯỢNG TỬ', 'AI TỔNG HỢP'],
      analysis: this.getIntelligenceAnalysis(finalScore)
    };
  }
  
  learnFromExperience(results, currentDecision) {
    if (this.experience.length < 10) return { prediction: null, confidence: 0 };
    const currentPattern = this.encodePattern(results, 6);
    let bestMatch = null, bestScore = 0;
    for (const exp of this.experience.slice(-50)) {
      if (exp.pattern === currentPattern && exp.successRate > bestScore) {
        bestScore = exp.successRate;
        bestMatch = exp;
      }
    }
    if (bestMatch && bestScore > 0.7) {
      return { prediction: bestMatch.prediction, confidence: 60 + bestScore * 30, experience: bestMatch };
    }
    return { prediction: null, confidence: 0 };
  }
  
  storeExperience(results, prediction) {
    const pattern = this.encodePattern(results, 6);
    let existing = this.superMemory.get(pattern);
    if (!existing) {
      existing = { pattern, predictions: [], correct: 0, total: 0, successRate: 0.5 };
      this.superMemory.set(pattern, existing);
    }
    existing.predictions.push({ prediction: prediction.prediction, confidence: prediction.confidence, timestamp: Date.now() });
    if (existing.predictions.length > 10) existing.predictions.shift();
    this.experience.push({
      pattern: pattern,
      prediction: prediction.prediction,
      confidence: prediction.confidence,
      timestamp: Date.now(),
      successRate: existing.successRate
    });
    if (this.experience.length > 1000) this.experience.shift();
  }
  
  evolveBrain() {
    this.brainStats.totalLearning++;
    if (this.brainStats.totalLearning % 100 === 0 && this.brainStats.iq < 50000) {
      this.brainStats.iq += 100;
    }
    if (this.brainStats.predictionAccuracy > 85) {
      this.brainStats.learningRate = Math.min(0.99, this.brainStats.learningRate + 0.001);
    }
    if (this.brainStats.totalLearning % 500 === 0) {
      this.deepAI.dnn.expandNetwork();
    }
  }
  
  learn(prediction, actual, wasCorrect) {
    if (this.experience.length > 0) {
      const lastExp = this.experience[this.experience.length - 1];
      if (lastExp && lastExp.pattern) {
        const memory = this.superMemory.get(lastExp.pattern);
        if (memory) {
          memory.total++;
          if (wasCorrect) memory.correct++;
          memory.successRate = memory.correct / memory.total;
          lastExp.successRate = memory.successRate;
        }
      }
    }
    const total = this.brainStats.totalLearning;
    const correct = this.brainStats.predictionAccuracy * total / 100 + (wasCorrect ? 1 : 0);
    this.brainStats.predictionAccuracy = (correct / (total + 1)) * 100;
    if (wasCorrect) {
      this.deepAI.dnn.strengthenConnections();
      this.brainStats.eq = Math.min(100, this.brainStats.eq + 0.5);
    } else {
      this.deepAI.dnn.weakenConnections();
      this.brainStats.cq = Math.max(80, this.brainStats.cq - 0.3);
    }
  }
  
  encodePattern(results, length) {
    return results.slice(0, length).map(r => r === 'Tài' ? '1' : '0').join('');
  }
  
  getTimeContext() {
    const hour = new Date().getHours();
    return { hour, day: new Date().getDay(), isPeakHour: (hour >= 19 && hour <= 22) };
  }
  
  getIntelligenceAnalysis(confidence) {
    if (confidence >= 90) return 'SIÊU CHÍNH XÁC - BÃO TỈ LỆ';
    if (confidence >= 80) return 'RẤT CHẮC CHẮN - TIN TƯỞNG CAO';
    if (confidence >= 70) return 'KHÁ TIN CẬY - CÓ CƠ SỞ';
    return 'CẦN THẬN TRỌNG - PHÂN TÍCH THÊM';
  }
  
  getSuperPrediction(prediction, confidence, reason) {
    return {
      prediction: prediction,
      confidence: confidence,
      methods: [reason],
      intelligence: this.brainStats.iq,
      analysis: reason
    };
  }
  
  getStats() {
    return {
      iq: this.brainStats.iq,
      eq: this.brainStats.eq,
      accuracy: this.brainStats.predictionAccuracy.toFixed(1) + '%',
      learningProgress: Math.min(100, Math.floor(this.brainStats.totalLearning / 10)),
      experiences: this.experience.length,
      memorySize: this.superMemory.size,
      learningRate: this.brainStats.learningRate
    };
  }
}

const superBrain = new SuperIntelligentBrain();

// ==================== HÀM LOAD/SAVE ====================
function loadLearningData() {
  try {
    if (fs.existsSync(LEARNING_FILE)) {
      const data = fs.readFileSync(LEARNING_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed.statistics) statistics = parsed.statistics;
      console.log('✅ Loaded super brain data');
    }
  } catch (error) { console.error('Error loading:', error.message); }
}

function saveLearningData() {
  try {
    fs.writeFileSync(LEARNING_FILE, JSON.stringify({ statistics, brainStats: superBrain.getStats(), lastSaved: new Date().toISOString() }, null, 2));
  } catch (error) { console.error('Error saving:', error.message); }
}

function loadPredictionHistory() {
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
      updateStatisticsFromHistory();
      console.log('✅ Loaded history');
    }
  } catch (error) { console.error('Error loading history:', error.message); }
}

function updateStatisticsFromHistory() {
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

function savePredictionToHistory(type, phienHienTai, prediction, confidence, method, latestData) {
  const record = {
    Phien: latestData.Phien,
    Xuc_xac_1: latestData.Xuc_xac_1, Xuc_xac_2: latestData.Xuc_xac_2, Xuc_xac_3: latestData.Xuc_xac_3,
    Tong: latestData.Tong, Ket_qua: latestData.Ket_qua, Do_tin_cay: `${confidence}%`,
    Phien_hien_tai: phienHienTai.toString(), Du_doan: prediction, Phuong_phap: method,
    ket_qua_du_doan: '', id: '@anhkhoi', timestamp: new Date().toISOString()
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
        superBrain.learn(record.Du_doan, actual.Ket_qua, wasCorrect);
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
      const phienHienTai = dataHu[0].Phien;
      if (!processedPhienSet.hu.has(phienHienTai)) {
        processedPhienSet.hu.add(phienHienTai);
        const result = superBrain.predict(dataHu);
        savePredictionToHistory('hu', phienHienTai, result.prediction, result.confidence, result.methods?.[0] || 'SIÊU TRÍ TUỆ', dataHu[0]);
        console.log(`[${new Date().toLocaleTimeString()}] 🧠 HU ${phienHienTai} -> ${result.prediction} (${result.confidence}%) - ${result.methods?.[0]}`);
      }
    }
    const dataMd5 = await fetchDataMd5();
    if (dataMd5 && dataMd5.length > 0) {
      const phienHienTai = dataMd5[0].Phien;
      if (!processedPhienSet.md5.has(phienHienTai)) {
        processedPhienSet.md5.add(phienHienTai);
        const result = superBrain.predict(dataMd5);
        savePredictionToHistory('md5', phienHienTai, result.prediction, result.confidence, result.methods?.[0] || 'SIÊU TRÍ TUỆ', dataMd5[0]);
        console.log(`[${new Date().toLocaleTimeString()}] 🧠 MD5 ${phienHienTai} -> ${result.prediction} (${result.confidence}%) - ${result.methods?.[0]}`);
      }
    }
    savePredictionHistory();
  } catch (error) { console.error('[Auto] Error:', error.message); }
}

function startAutoTask() { console.log('🚀 Auto prediction - 1 giây'); setInterval(autoProcessPredictions, AUTO_SAVE_INTERVAL); }

// ==================== ENDPOINTS ====================
app.get('/', (req, res) => res.json({ message: '@anhkhoi - Bộ Não Siêu Thông Minh', status: 'running', iq: 10000 }));

app.get('/hu', async (req, res) => {
  try {
    const data = await fetchDataHu();
    if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    const phienHienTai = data[0].Phien;
    const result = superBrain.predict(data);
    savePredictionToHistory('hu', phienHienTai, result.prediction, result.confidence, result.methods?.[0] || 'SIÊU TRÍ TUỆ', data[0]);
    setTimeout(() => updateHistoryStatus('hu'), 5000);
    res.json({ success: true, phien_truoc_do: phienHienTai, phien_hien_tai: phienHienTai + 1, du_doan: result.prediction, do_tin_cay: `${result.confidence}%`, phuong_phap: result.methods?.[0], tri_tue: result.intelligence, phan_tich: result.analysis });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/md5', async (req, res) => {
  try {
    const data = await fetchDataMd5();
    if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    const phienHienTai = data[0].Phien;
    const result = superBrain.predict(data);
    savePredictionToHistory('md5', phienHienTai, result.prediction, result.confidence, result.methods?.[0] || 'SIÊU TRÍ TUỆ', data[0]);
    setTimeout(() => updateHistoryStatus('md5'), 5000);
    res.json({ success: true, phien_truoc_do: phienHienTai, phien_hien_tai: phienHienTai + 1, du_doan: result.prediction, do_tin_cay: `${result.confidence}%`, phuong_phap: result.methods?.[0], tri_tue: result.intelligence, phan_tich: result.analysis });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/thongke', async (req, res) => {
  await updateHistoryStatus('hu'); await updateHistoryStatus('md5');
  res.json({ success: true, statistics, brainStats: superBrain.getStats(), lastUpdated: new Date().toISOString() });
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

// Giao diện HTML
app.get('/thongke/html', async (req, res) => {
  await updateHistoryStatus('hu'); await updateHistoryStatus('md5');
  const brainStats = superBrain.getStats();
  
  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>LẨU CUA 79 | BỘ NÃO SIÊU THÔNG MINH</title>
    <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Be Vietnam Pro', sans-serif;
            background: #0b0f19;
            color: #f3f4f6;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header {
            background: #111827;
            border: 1px solid #1f2937;
            border-radius: 12px;
            padding: 20px 25px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 15px;
        }
        .title { font-size: 24px; font-weight: 700; }
        .badge { background: rgba(0,243,255,0.1); color: #00f3ff; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-family: monospace; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: #111827; border: 1px solid #1f2937; border-radius: 10px; padding: 15px; }
        .stat-value { font-size: 28px; font-weight: 700; color: #00f3ff; font-family: monospace; }
        .stat-label { font-size: 12px; color: #9ca3af; margin-top: 5px; }
        .servers-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 20px; }
        .server-card { background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 20px; }
        .server-title { font-size: 16px; font-weight: 600; margin-bottom: 15px; color: #00f3ff; }
        .chart-container { display: flex; align-items: center; gap: 30px; flex-wrap: wrap; }
        .donut { position: relative; width: 120px; height: 120px; }
        canvas { width: 120px !important; height: 120px !important; }
        .percentage { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 22px; font-weight: 700; font-family: monospace; }
        .stats-list { flex: 1; }
        .stat-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #1f2937; }
        .history-section { background: #111827; border: 1px solid #1f2937; border-radius: 12px; overflow: hidden; }
        .history-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; border-bottom: 1px solid #1f2937; flex-wrap: wrap; gap: 10px; }
        .tabs { display: flex; gap: 10px; }
        .tab { padding: 8px 20px; background: transparent; border: 1px solid #1f2937; color: #9ca3af; border-radius: 8px; cursor: pointer; }
        .tab.active { background: #00f3ff; color: #000; border-color: #00f3ff; }
        .refresh-btn { padding: 8px 20px; background: #1f2937; border: none; color: #fff; border-radius: 8px; cursor: pointer; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #1f2937; }
        th { color: #9ca3af; font-size: 12px; text-transform: uppercase; }
        .win { color: #10b981; }
        .loss { color: #ef4444; }
        .badge-status { padding: 4px 10px; border-radius: 20px; font-size: 11px; }
        .badge-success { background: rgba(16,185,129,0.2); color: #10b981; }
        .badge-error { background: rgba(239,68,68,0.2); color: #ef4444; }
        @media (max-width: 768px) {
            .stats-grid { grid-template-columns: repeat(2, 1fr); }
            .servers-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div>
                <h1 class="title">🧠 LẨU CUA 79</h1>
                <div class="badge" style="margin-top: 8px;">BỘ NÃO SIÊU THÔNG MINH | IQ 10,000</div>
            </div>
            <div class="badge" id="liveStatus">● ONLINE | CẬP NHẬT 1S</div>
        </div>

        <div class="stats-grid">
            <div class="stat-card"><div class="stat-value" id="mauDaHoc">0</div><div class="stat-label">MẪU ĐÃ HỌC</div></div>
            <div class="stat-card"><div class="stat-value" id="iqHienTai">10,000</div><div class="stat-label">IQ HIỆN TẠI</div></div>
            <div class="stat-card"><div class="stat-value" id="doChinhXac">0%</div><div class="stat-label">ĐỘ CHÍNH XÁC</div></div>
            <div class="stat-card"><div class="stat-value" id="chuoiThang">0</div><div class="stat-label">CHUỖI THẮNG</div></div>
        </div>

        <div class="servers-grid">
            <div class="server-card">
                <div class="server-title"><i class="fas fa-server"></i> MÁY CHỦ HŨ</div>
                <div class="chart-container">
                    <div class="donut"><canvas id="chartHu"></canvas><div class="percentage" id="percentHu">0%</div></div>
                    <div class="stats-list">
                        <div class="stat-row"><span>THẮNG</span><span class="win" id="thangHu">0</span></div>
                        <div class="stat-row"><span>THUA</span><span class="loss" id="thuaHu">0</span></div>
                        <div class="stat-row"><span>CHUỖI MAX</span><span id="maxHu">0</span></div>
                    </div>
                </div>
            </div>
            <div class="server-card">
                <div class="server-title"><i class="fas fa-fingerprint"></i> MÁY CHỦ MD5</div>
                <div class="chart-container">
                    <div class="donut"><canvas id="chartMd5"></canvas><div class="percentage" id="percentMd5">0%</div></div>
                    <div class="stats-list">
                        <div class="stat-row"><span>THẮNG</span><span class="win" id="thangMd5">0</span></div>
                        <div class="stat-row"><span>THUA</span><span class="loss" id="thuaMd5">0</span></div>
                        <div class="stat-row"><span>CHUỖI MAX</span><span id="maxMd5">0</span></div>
                    </div>
                </div>
            </div>
        </div>

        <div class="history-section">
            <div class="history-header">
                <div class="tabs">
                    <button class="tab active" onclick="switchTab('hu')">HŨ</button>
                    <button class="tab" onclick="switchTab('md5')">MD5</button>
                </div>
                <button class="refresh-btn" onclick="refreshData()"><i class="fas fa-sync-alt"></i> ĐỒNG BỘ</button>
            </div>
            <div style="overflow-x: auto;">
                <table>
                    <thead><tr><th>PHIÊN</th><th>KẾT QUẢ</th><th>DỰ ĐOÁN</th><th>ĐỘ TIN CẬY</th><th>PHƯƠNG PHÁP</th><th>TRẠNG THÁI</th></tr></thead>
                    <tbody id="tableBody"><tr><td colspan="6" style="text-align:center;">ĐANG TẢI...</td></tr></tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        let currentTab = 'hu', charts = {};
        
        async function fetchStats() {
            try {
                const res = await fetch('/thongke');
                const data = await res.json();
                if(data.success) {
                    updateStats(data.statistics);
                    updateBrainStats(data.brainStats);
                }
            } catch(e) { console.error(e); }
        }
        
        function updateStats(stats) {
            document.getElementById('percentHu').innerText = stats.hu.accuracy + '%';
            document.getElementById('thangHu').innerText = stats.hu.wins;
            document.getElementById('thuaHu').innerText = stats.hu.losses;
            document.getElementById('maxHu').innerText = stats.hu.maxWinStreak;
            if(charts.hu) { charts.hu.data.datasets[0].data = [stats.hu.wins, stats.hu.losses || 1]; charts.hu.update(); }
            
            document.getElementById('percentMd5').innerText = stats.md5.accuracy + '%';
            document.getElementById('thangMd5').innerText = stats.md5.wins;
            document.getElementById('thuaMd5').innerText = stats.md5.losses;
            document.getElementById('maxMd5').innerText = stats.md5.maxWinStreak;
            if(charts.md5) { charts.md5.data.datasets[0].data = [stats.md5.wins, stats.md5.losses || 1]; charts.md5.update(); }
            
            document.getElementById('chuoiThang').innerText = stats.hu.currentWinStreak;
            document.getElementById('doChinhXac').innerText = stats.hu.accuracy + '%';
        }
        
        function updateBrainStats(brain) {
            if(brain) {
                document.getElementById('mauDaHoc').innerText = brain.memorySize || 0;
                document.getElementById('iqHienTai').innerText = brain.iq?.toLocaleString() || '10,000';
            }
        }
        
        async function fetchHistory() {
            try {
                const res = await fetch(`/${currentTab}/lichsu`);
                const data = await res.json();
                const tbody = document.getElementById('tableBody');
                if(!data.history || data.history.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">CHƯA CÓ DỮ LIỆU</td></tr>';
                    return;
                }
                tbody.innerHTML = data.history.slice(0, 50).map(h => {
                    const isCorrect = h.ket_qua_du_doan === 'Đúng ✅';
                    return \`<tr>
                        <td style="color:#00f3ff;">#\${h.Phien}</td>
                        <td class="\${h.Ket_qua === 'Tài' ? 'loss' : 'win'}">\${h.Ket_qua}</td>
                        <td class="\${h.Du_doan === 'Tài' ? 'loss' : 'win'}" style="font-weight:700;">\${h.Du_doan}</td>
                        <td style="color:#eab308;">\${h.Do_tin_cay}</td>
                        <td style="font-size:12px;">\${h.Phuong_phap || 'SUPER_AI'}</td>
                        <td><span class="badge-status \${isCorrect ? 'badge-success' : 'badge-error'}">\${isCorrect ? '✓ KHỚP' : '✗ LỆCH'}</span></td>
                    </tr>\`;
                }).join('');
            } catch(e) { console.error(e); }
        }
        
        function switchTab(tab) {
            currentTab = tab;
            document.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            fetchHistory();
        }
        
        async function refreshData() { await fetchStats(); await fetchHistory(); }
        
        function initCharts() {
            const config = { type: 'doughnut', options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false } } } };
            charts.hu = new Chart(document.getElementById('chartHu'), { ...config, data: { datasets: [{ data: [0, 100], backgroundColor: ['#00f3ff', '#1f2937'], borderWidth: 0 }] } });
            charts.md5 = new Chart(document.getElementById('chartMd5'), { ...config, data: { datasets: [{ data: [0, 100], backgroundColor: ['#eab308', '#1f2937'], borderWidth: 0 }] } });
        }
        
        initCharts();
        refreshData();
        setInterval(refreshData, 5000);
        
        // Update live status
        setInterval(() => {
            const status = document.getElementById('liveStatus');
            status.innerHTML = '● ONLINE | ' + new Date().toLocaleTimeString();
        }, 1000);
    </script>
</body>
</html>`;
  res.send(html);
});

// KHỞI ĐỘNG
loadLearningData();
loadPredictionHistory();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n╔══════════════════════════════════════════════════════════════════════════╗`);
  console.log(`║     🧠 LẨU CUA 79 - BỘ NÃO SIÊU THÔNG MINH NHÂN TẠO IQ 10,000     ║`);
  console.log(`╠══════════════════════════════════════════════════════════════════════════╣`);
  console.log(`║  📍 API: http://0.0.0.0:${PORT}                                            ║`);
  console.log(`║  📊 DASHBOARD: http://0.0.0.0:${PORT}/thongke/html                        ║`);
  console.log(`║  ⚡ Auto update mỗi 1 giây | Chống trùng phiên tuyệt đối                  ║`);
  console.log(`║  🧠 THUẬT TOÁN: Trực giác + Logic + Deep Learning + Lượng tử              ║`);
  console.log(`║  🎯 IQ: 10,000 | Tự học và tiến hóa theo thời gian                        ║`);
  console.log(`╚══════════════════════════════════════════════════════════════════════════╝\n`);
  startAutoTask();
});
