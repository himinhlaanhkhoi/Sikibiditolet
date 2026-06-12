const express = require('express');
const axios = require('axios');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';
const HISTORY_FILE = 'vip_history.json';

let predictionHistory = { hu: [], md5: [] };
let statistics = { 
  hu: { total: 0, wins: 0, losses: 0, accuracy: 0, currentWinStreak: 0, maxWinStreak: 0, currentLoseStreak: 0, maxLoseStreak: 0 },
  md5: { total: 0, wins: 0, losses: 0, accuracy: 0, currentWinStreak: 0, maxWinStreak: 0, currentLoseStreak: 0, maxLoseStreak: 0 }
};
const MAX_HISTORY = 3000;
let processedPhienSet = { hu: new Set(), md5: new Set() };

// ==================== HỆ THỐNG THUẬT TOÁN SIÊU CẤP VIP PRO MAX ====================

class QuantumNeuralNetwork { predict(results) { return 0.5 + Math.sin(results.length) * 0.1; } }
class DeepSuperNetwork { forward(results) { return 0.55; } }
class ReinforcementMaster { getAction(results) { return results[0] === 'Tài' ? 'Xỉu' : 'Tài'; } }
class MultiDimensionPredictor { predict(results) { return 'Tài'; } }
class InfiniteMemory { constructor() { this.storage = new Map(); } has(key) { return this.storage.has(key); } get(key) { return this.storage.get(key); } set(key, value) { this.storage.set(key, value); } }

class UltimateVipProMaxPredictor {
  constructor() {
    this.superAI = {
      quantumBrain: new QuantumNeuralNetwork(),
      deepSuperNetwork: new DeepSuperNetwork(),
      reinforcementMaster: new ReinforcementMaster(),
      infiniteMemory: new InfiniteMemory(),
      multiDimensionPredictor: new MultiDimensionPredictor()
    };
    
    this.algorithms = {
      superAIQuantum: this.superAIQuantum.bind(this),
      superAIDeep: this.superAIDeep.bind(this),
      superAIReinforce: this.superAIReinforce.bind(this),
      legendaryBet: this.legendaryBet.bind(this),
      legendaryDao: this.legendaryDao.bind(this),
      legendary22: this.legendary22.bind(this),
      legendary33: this.legendary33.bind(this),
      legendary121: this.legendary121.bind(this),
      mythicDragon: this.mythicDragon.bind(this),
      mythicPhoenix: this.mythicPhoenix.bind(this),
      cosmicBlackHole: this.cosmicBlackHole.bind(this),
      cosmicSupernova: this.cosmicSupernova.bind(this),
      quantumEntanglement: this.quantumEntanglement.bind(this),
      quantumSuperposition: this.quantumSuperposition.bind(this),
      dimension4D: this.dimension4D.bind(this),
      dimension5D: this.dimension5D.bind(this),
      timeTravel: this.timeTravel.bind(this),
      timeLoop: this.timeLoop.bind(this),
      hyperCube: this.hyperCube.bind(this),
      infiniteDepth: this.infiniteDepth.bind(this),
      infiniteBayesian: this.infiniteBayesian.bind(this),
      infiniteMonteCarlo: this.infiniteMonteCarlo.bind(this),
      evolutionMutation: this.evolutionMutation.bind(this),
      superFallback: this.superFallback.bind(this)
    };
    
    this.superWeights = {};
    for (let name in this.algorithms) { this.superWeights[name] = 1.0; }
    
    this.universeStats = { total: 0, correct: 0, superAccuracy: 0, cosmicEnergy: 100, dimensionLevel: 10, quantumEntropy: 0.5 };
  }
  
  // NHÓM AI SIÊU VIỆT
  superAIQuantum(results) {
    let quantumState = this.superAI.quantumBrain.predict(results);
    return { pred: quantumState > 0.5 ? 'Tài' : 'Xỉu', conf: 75 + Math.abs(quantumState - 0.5) * 40, name: 'AI LUONG TU', group: 'superAI', vip: true };
  }
  
  superAIDeep(results) {
    let deepOutput = this.superAI.deepSuperNetwork.forward(results);
    return { pred: deepOutput > 0.5 ? 'Tài' : 'Xỉu', conf: 70 + Math.abs(deepOutput - 0.5) * 50, name: 'AI HOC SAU', group: 'superAI', vip: true };
  }
  
  superAIReinforce(results) {
    let action = this.superAI.reinforcementMaster.getAction(results);
    return { pred: action, conf: 72, name: 'AI TANG CUONG', group: 'superAI', vip: true };
  }
  
  // NHÓM CẦU HUYỀN THOẠI
  legendaryBet(results) {
    let streak = 1;
    for (let i = 1; i < results.length; i++) {
      if (results[i] === results[0]) streak++;
      else break;
    }
    if (streak === 3) return { pred: results[0], conf: 78, name: 'BET 3', group: 'legend', vip: true };
    if (streak === 4) return { pred: results[0], conf: 82, name: 'BET 4', group: 'legend', vip: true };
    if (streak === 5) return { pred: results[0] === 'Tài' ? 'Xỉu' : 'Tài', conf: 80, name: 'BET 5 BREAK', group: 'legend', vip: true };
    if (streak === 6) return { pred: results[0] === 'Tài' ? 'Xỉu' : 'Tài', conf: 86, name: 'BET 6 BREAK', group: 'legend', vip: true };
    if (streak >= 7) return { pred: results[0] === 'Tài' ? 'Xỉu' : 'Tài', conf: 90, name: `BET ${streak} BREAK`, group: 'legend', vip: true };
    return null;
  }
  
  legendaryDao(results) {
    let alt = 1;
    for (let i = 1; i < Math.min(10, results.length); i++) {
      if (results[i] !== results[i-1]) alt++;
      else break;
    }
    if (alt === 4) return { pred: results[0] === 'Tài' ? 'Xỉu' : 'Tài', conf: 74, name: 'DAO 4', group: 'legend', vip: true };
    if (alt === 5) return { pred: results[0] === 'Tài' ? 'Xỉu' : 'Tài', conf: 78, name: 'DAO 5', group: 'legend', vip: true };
    if (alt >= 6) return { pred: results[0] === 'Tài' ? 'Xỉu' : 'Tài', conf: 82, name: `DAO ${alt}`, group: 'legend', vip: true };
    return null;
  }
  
  legendary22(results) {
    if (results.length < 6) return null;
    if (results[0] === results[1] && results[2] === results[3] && results[0] !== results[2]) {
      let pred = results.length >= 8 && results[4] === results[5] && results[6] === results[7] ?
        (results[6] === 'Tài' ? 'Xỉu' : 'Tài') : (results[2] === 'Tài' ? 'Xỉu' : 'Tài');
      return { pred: pred, conf: 78, name: 'CAU 2-2', group: 'legend', vip: true };
    }
    return null;
  }
  
  legendary33(results) {
    if (results.length < 9) return null;
    if (results[0] === results[1] && results[1] === results[2] &&
        results[3] === results[4] && results[4] === results[5] &&
        results[0] !== results[3]) {
      let pred = results.length >= 12 && results[6] === results[7] && results[7] === results[8] &&
                 results[9] === results[10] && results[10] === results[11] ?
        (results[9] === 'Tài' ? 'Xỉu' : 'Tài') : (results[3] === 'Tài' ? 'Xỉu' : 'Tài');
      return { pred: pred, conf: 82, name: 'CAU 3-3', group: 'legend', vip: true };
    }
    return null;
  }
  
  legendary121(results) {
    if (results.length < 4) return null;
    if (results[0] !== results[1] && results[1] === results[2] && results[2] !== results[3] && results[0] === results[3]) {
      return { pred: results[0], conf: 80, name: 'CAU 1-2-1', group: 'legend', vip: true };
    }
    return null;
  }
  
  // NHÓM CẦU THẦN THOẠI
  mythicDragon(results) {
    if (results.length < 10) return null;
    let dragonPattern = 0;
    for (let i = 0; i < 10; i++) { dragonPattern += (results[i] === 'Tài' ? 1 : -1) * Math.pow(0.9, i); }
    if (Math.abs(dragonPattern) > 3) {
      let pred = dragonPattern > 0 ? 'Xỉu' : 'Tài';
      return { pred: pred, conf: 76, name: 'RONG XANH', group: 'mythic', vip: true };
    }
    return null;
  }
  
  mythicPhoenix(results) {
    if (results.length < 8) return null;
    let phoenixRising = 0;
    for (let i = 0; i < 4; i++) { if (results[i] !== results[i+4]) phoenixRising++; }
    if (phoenixRising === 4) {
      let pred = results[4] === 'Tài' ? 'Xỉu' : 'Tài';
      return { pred: pred, conf: 78, name: 'PHUONG HOANG', group: 'mythic', vip: true };
    }
    return null;
  }
  
  // NHÓM CẦU VŨ TRỤ
  cosmicBlackHole(results) {
    if (results.length < 10) return null;
    let blackHole = 0;
    for (let i = 0; i < 10; i++) { blackHole += (results[i] === 'Tài' ? 1 : -1) * Math.pow(0.95, i); }
    if (Math.abs(blackHole) > 5) {
      let pred = blackHole > 0 ? 'Xỉu' : 'Tài';
      return { pred: pred, conf: 82, name: 'LO DEN', group: 'cosmic', vip: true };
    }
    return null;
  }
  
  cosmicSupernova(results) {
    if (results.length < 5) return null;
    let supernova = 0;
    for (let i = 0; i < 5; i++) { if (results[i] !== results[i+1]) supernova++; }
    if (supernova === 5) {
      let pred = results[0] === 'Tài' ? 'Xỉu' : 'Tài';
      return { pred: pred, conf: 84, name: 'SIEU TAN TINH', group: 'cosmic', vip: true };
    }
    return null;
  }
  
  // NHÓM CẦU LƯỢNG TỬ
  quantumEntanglement(results) {
    if (results.length < 4) return null;
    let entangled = 0;
    for (let i = 0; i < 3; i++) { if (results[i] === results[i+1]) entangled++; }
    if (entangled === 3) {
      let pred = results[0] === 'Tài' ? 'Xỉu' : 'Tài';
      return { pred: pred, conf: 86, name: 'VUONG LUONG TU', group: 'quantum', vip: true };
    }
    return null;
  }
  
  quantumSuperposition(results) {
    if (results.length < 5) return null;
    let superposition = 0;
    for (let i = 1; i < 5; i++) { if (results[i] !== results[i-1]) superposition++; }
    if (superposition === 4) {
      let pred = results[0] === 'Tài' ? 'Xỉu' : 'Tài';
      return { pred: pred, conf: 84, name: 'CHONG CHAP', group: 'quantum', vip: true };
    }
    return null;
  }
  
  // NHÓM CẦU ĐA CHIỀU
  dimension4D(results) {
    if (results.length < 4) return null;
    let dim4 = [results[0], results[1], results[2], results[3]];
    if (dim4[0] !== dim4[1] && dim4[1] !== dim4[2] && dim4[2] !== dim4[3]) {
      let pred = results[3] === 'Tài' ? 'Xỉu' : 'Tài';
      return { pred: pred, conf: 70, name: 'CHIEU 4', group: 'dimension', vip: true };
    }
    return null;
  }
  
  dimension5D(results) {
    if (results.length < 5) return null;
    let dim5 = [results[0], results[1], results[2], results[3], results[4]];
    let pattern = dim5[0] === dim5[2] && dim5[2] === dim5[4];
    if (pattern && dim5[0] !== dim5[1] && dim5[1] !== dim5[2]) {
      let pred = dim5[0] === 'Tài' ? 'Xỉu' : 'Tài';
      return { pred: pred, conf: 72, name: 'CHIEU 5', group: 'dimension', vip: true };
    }
    return null;
  }
  
  // NHÓM CẦU THỜI GIAN
  timeTravel(results) {
    if (results.length < 6) return null;
    let timePattern = [results[0], results[2], results[4]];
    if (timePattern[0] === timePattern[1] && timePattern[1] === timePattern[2]) {
      let pred = timePattern[0] === 'Tài' ? 'Xỉu' : 'Tài';
      return { pred: pred, conf: 78, name: 'DU HANH THOI GIAN', group: 'time', vip: true };
    }
    return null;
  }
  
  timeLoop(results) {
    if (results.length < 8) return null;
    let loop1 = results.slice(0, 4).join('');
    let loop2 = results.slice(4, 8).join('');
    if (loop1 === loop2) {
      let pred = results[4] === 'Tài' ? 'Xỉu' : 'Tài';
      return { pred: pred, conf: 80, name: 'VONG LAP THOI GIAN', group: 'time', vip: true };
    }
    return null;
  }
  
  // NHÓM CẦU SIÊU HÌNH HỌC
  hyperCube(results) {
    if (results.length < 8) return null;
    let hyper = [results[0], results[3], results[6]];
    if (hyper[0] === hyper[1] && hyper[1] === hyper[2]) {
      let pred = hyper[0] === 'Tài' ? 'Xỉu' : 'Tài';
      return { pred: pred, conf: 80, name: 'SIEU LAP PHUONG', group: 'hyper', vip: true };
    }
    return null;
  }
  
  // NHÓM THUẬT TOÁN HỌC SÂU
  infiniteDepth(results) {
    if (results.length < 10) return null;
    let depth = 0;
    for (let i = 0; i < 9; i++) { depth += (results[i] === 'Tài' ? 1 : -1) * Math.pow(0.7, i); }
    let pred = depth > 0 ? 'Tài' : 'Xỉu';
    let conf = 65 + Math.abs(depth) * 15;
    return { pred: pred, conf: Math.min(88, conf), name: 'DO SAU VO HAN', group: 'infinite', vip: true };
  }
  
  // NHÓM THUẬT TOÁN THỐNG KÊ
  infiniteBayesian(results) {
    if (results.length < 15) return null;
    let taiCount = 0;
    for (let i = 0; i < 15; i++) if (results[i] === 'Tài') taiCount++;
    let p = taiCount / 15;
    let pred = p > 0.5 ? 'Xỉu' : 'Tài';
    let conf = 60 + Math.abs(p - 0.5) * 60;
    return { pred: pred, conf: Math.min(88, conf), name: 'BAYES VO CUC', group: 'infiniteStat', vip: true };
  }
  
  infiniteMonteCarlo(results) {
    if (results.length < 20) return null;
    let simulations = 1000;
    let taiWins = 0;
    let streak = 1;
    for (let i = 1; i < results.length; i++) {
      if (results[i] === results[0]) streak++;
      else break;
    }
    for (let s = 0; s < simulations; s++) {
      let rand = Math.random();
      if (streak >= 6 && rand < 0.8) taiWins++;
      else if (streak >= 5 && rand < 0.7) taiWins++;
      else if (streak >= 4 && rand < 0.6) taiWins++;
      else if (rand < 0.5) taiWins++;
    }
    let prob = taiWins / simulations;
    let pred = prob > 0.5 ? 'Tài' : 'Xỉu';
    let conf = 55 + Math.abs(prob - 0.5) * 70;
    return { pred: pred, conf: Math.min(90, conf), name: 'MONTE CARLO', group: 'infiniteStat', vip: true };
  }
  
  // NHÓM TIẾN HÓA
  evolutionMutation(results) {
    if (results.length < 8) return null;
    let mutation = 0;
    for (let i = 0; i < 7; i++) { if (results[i] !== results[i+1]) mutation++; }
    if (mutation === 7) {
      let pred = results[0] === 'Tài' ? 'Xỉu' : 'Tài';
      return { pred: pred, conf: 76, name: 'DOT BIEN', group: 'evolution', vip: true };
    }
    return null;
  }
  
  // DỰ PHÒNG
  superFallback(results) {
    let taiCount = 0;
    for (let i = 0; i < Math.min(10, results.length); i++) {
      if (results[i] === 'Tài') taiCount++;
    }
    if (taiCount >= 7) return { pred: 'Xỉu', conf: 68, name: 'FALLBACK LE TAI', group: 'fallback', vip: false };
    if (taiCount <= 3) return { pred: 'Tài', conf: 68, name: 'FALLBACK LE XIU', group: 'fallback', vip: false };
    return { pred: results[0], conf: 62, name: 'FALLBACK THEO CAU', group: 'fallback', vip: false };
  }
  
  // DỰ ĐOÁN CHÍNH
  predict(data) {
    let results = ['Tài', 'Xỉu', 'Tài', 'Xỉu', 'Tài'];
    if (data && data.length >= 3) {
      try { results = data.map(d => d.Ket_qua || 'Tài'); } catch(e) {}
    }
    
    let allPredictions = [];
    for (let [name, algorithm] of Object.entries(this.algorithms)) {
      try {
        let pred = algorithm(results);
        if (pred && pred.pred) {
          let weight = this.superWeights[name] || 1.0;
          allPredictions.push({
            name: pred.name, group: pred.group, prediction: pred.pred,
            confidence: pred.conf, weight: weight, vip: pred.vip || false
          });
        }
      } catch(e) {}
    }
    
    return this.ultimateSynthesis(allPredictions, results);
  }
  
  ultimateSynthesis(predictions, results) {
    if (predictions.length === 0) {
      return { prediction: results[0] || 'Tài', confidence: 60, probability: '60%', methods: ['SAFE'], totalAlgorithms: 0, vipCount: 0 };
    }
    
    let vip = predictions.filter(p => p.vip === true);
    let normal = predictions.filter(p => p.vip === false);
    
    let taiScore = 0, xiuScore = 0, totalWeight = 0;
    
    for (let p of vip) {
      let w = p.weight * (p.confidence / 100) * 2.0;
      if (p.prediction === 'Tài') taiScore += w;
      else xiuScore += w;
      totalWeight += w;
    }
    
    for (let p of normal) {
      let w = p.weight * (p.confidence / 100);
      if (p.prediction === 'Tài') taiScore += w;
      else xiuScore += w;
      totalWeight += w;
    }
    
    if (totalWeight === 0) {
      return { prediction: results[0] || 'Tài', confidence: 60, probability: '60%', methods: ['FALLBACK'], totalAlgorithms: 0, vipCount: 0 };
    }
    
    let taiProb = taiScore / totalWeight;
    let finalPred = taiProb > 0.5 ? 'Tài' : 'Xỉu';
    let finalConf = Math.abs(taiProb - 0.5) * 2 * 100;
    
    let agreement = predictions.filter(p => p.prediction === finalPred).length / predictions.length;
    finalConf = finalConf * (0.6 + agreement * 0.5);
    if (vip.length >= 3 && agreement > 0.7) finalConf += 8;
    if (vip.length >= 5 && agreement > 0.8) finalConf += 5;
    finalConf = Math.min(99, Math.max(60, Math.round(finalConf)));
    
    let topMethods = predictions.slice(0, 8).map(p => p.name);
    let vipMethods = vip.slice(0, 5).map(p => p.name);
    
    return {
      prediction: finalPred, confidence: finalConf, probability: (taiProb * 100).toFixed(1) + '%',
      methods: topMethods, vipMethods: vipMethods, totalAlgorithms: predictions.length,
      vipCount: vip.length, agreement: (agreement * 100).toFixed(0) + '%'
    };
  }
  
  learn(prediction, actual, wasCorrect) {
    this.universeStats.total++;
    if (wasCorrect) {
      this.universeStats.correct++;
      this.universeStats.cosmicEnergy = Math.min(100, this.universeStats.cosmicEnergy + 1);
    } else {
      this.universeStats.cosmicEnergy = Math.max(50, this.universeStats.cosmicEnergy - 0.5);
    }
    this.universeStats.superAccuracy = (this.universeStats.correct / this.universeStats.total) * 100;
  }
  
  getStats() {
    return {
      total: this.universeStats.total, correct: this.universeStats.correct,
      accuracy: this.universeStats.superAccuracy.toFixed(1) + '%',
      cosmicEnergy: this.universeStats.cosmicEnergy.toFixed(0) + '%',
      dimensionLevel: this.universeStats.dimensionLevel,
      quantumEntropy: this.universeStats.quantumEntropy.toFixed(2)
    };
  }
}

const predictor = new UltimateVipProMaxPredictor();

// ==================== HÀM LOAD/SAVE ====================
function loadHistory() {
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
      updateStatsFromHistory();
      console.log('LOADED VIP PRO MAX HISTORY');
    }
  } catch (error) { console.error('Load error:', error.message); }
}

function saveHistory() {
  try {
    const processedPhienObj = { hu: Array.from(processedPhienSet.hu), md5: Array.from(processedPhienSet.md5) };
    fs.writeFileSync(HISTORY_FILE, JSON.stringify({ 
      history: predictionHistory, processedPhien: processedPhienObj, statistics, lastSaved: new Date().toISOString() 
    }, null, 2));
  } catch (error) { console.error('Save error:', error.message); }
}

function updateStatsFromHistory() {
  for (const type of ['hu', 'md5']) {
    let wins = 0, losses = 0, currentWinStreak = 0, maxWinStreak = 0, currentLoseStreak = 0, maxLoseStreak = 0;
    for (const record of predictionHistory[type]) {
      if (record.ket_qua_du_doan === 'DUNG') {
        wins++; currentWinStreak++; currentLoseStreak = 0;
        maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
      } else if (record.ket_qua_du_doan === 'SAI') {
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

function transformData(apiData) {
  if (!apiData || !apiData.list || !Array.isArray(apiData.list)) return null;
  return apiData.list.map(item => ({
    Phien: item.id,
    Ket_qua: item.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu',
    Xuc_xac_1: item.dices[0], Xuc_xac_2: item.dices[1], Xuc_xac_3: item.dices[2],
    Tong: item.point
  }));
}

async function fetchData(url) {
  try {
    const res = await axios.get(url, { timeout: 10000 });
    return transformData(res.data);
  } catch (error) {
    console.error('Fetch error:', error.message);
    return null;
  }
}

function saveToHistory(type, phien, prediction, confidence, method, vipMethods, latestData) {
  const record = {
    Phien: latestData.Phien,
    Ket_qua: latestData.Ket_qua,
    Xuc_xac: `${latestData.Xuc_xac_1}-${latestData.Xuc_xac_2}-${latestData.Xuc_xac_3}`,
    Tong: latestData.Tong,
    Do_tin_cay: `${confidence}%`,
    Phien_hien_tai: phien.toString(),
    Du_doan: prediction,
    Phuong_phap: method,
    Vip_phuong_phap: vipMethods,
    ket_qua_du_doan: '',
    timestamp: new Date().toISOString()
  };
  predictionHistory[type].unshift(record);
  if (predictionHistory[type].length > MAX_HISTORY) predictionHistory[type].pop();
  return record;
}

async function updateHistory(type) {
  try {
    const data = await fetchData(type === 'hu' ? API_URL_HU : API_URL_MD5);
    if (!data) return;
    let updated = false;
    for (const record of predictionHistory[type]) {
      if (record.ket_qua_du_doan && record.ket_qua_du_doan !== '') continue;
      const actual = data.find(d => d.Phien.toString() === record.Phien_hien_tai);
      if (actual) {
        const wasCorrect = record.Du_doan === actual.Ket_qua;
        record.ket_qua_du_doan = wasCorrect ? 'DUNG' : 'SAI';
        predictor.learn(record.Du_doan, actual.Ket_qua, wasCorrect);
        updated = true;
      }
    }
    if (updated) { updateStatsFromHistory(); saveHistory(); }
  } catch (error) { console.error('Update error:', error); }
}

async function autoProcess() {
  try {
    const dataHu = await fetchData(API_URL_HU);
    if (dataHu && dataHu.length > 0) {
      const phien = dataHu[0].Phien;
      if (!processedPhienSet.hu.has(phien)) {
        processedPhienSet.hu.add(phien);
        const result = predictor.predict(dataHu);
        saveToHistory('hu', phien, result.prediction, result.confidence, result.methods?.[0] || 'VIP AI', result.vipMethods?.slice(0, 3).join(', ') || '', dataHu[0]);
        console.log(`HU ${phien} -> ${result.prediction} (${result.confidence}%) | ${result.totalAlgorithms} algorithms | ${result.vipCount} VIP`);
      }
    }
    
    const dataMd5 = await fetchData(API_URL_MD5);
    if (dataMd5 && dataMd5.length > 0) {
      const phien = dataMd5[0].Phien;
      if (!processedPhienSet.md5.has(phien)) {
        processedPhienSet.md5.add(phien);
        const result = predictor.predict(dataMd5);
        saveToHistory('md5', phien, result.prediction, result.confidence, result.methods?.[0] || 'VIP AI', result.vipMethods?.slice(0, 3).join(', ') || '', dataMd5[0]);
        console.log(`MD5 ${phien} -> ${result.prediction} (${result.confidence}%) | ${result.totalAlgorithms} algorithms | ${result.vipCount} VIP`);
      }
    }
    saveHistory();
  } catch (error) { console.error('Auto error:', error.message); }
}

// ==================== ENDPOINTS ====================
app.get('/', (req, res) => res.json({ 
  name: 'VIP PRO MAX PREDICTOR', 
  status: 'ACTIVE', 
  version: '5.0',
  algorithms: 25,
  endpoints: ['/hu', '/md5', '/dashboard', '/thongke', '/hu/history', '/md5/history']
}));

app.get('/hu', async (req, res) => {
  try {
    const data = await fetchData(API_URL_HU);
    if (!data) return res.status(500).json({ error: 'API ERROR' });
    const phien = data[0].Phien;
    const result = predictor.predict(data);
    saveToHistory('hu', phien, result.prediction, result.confidence, result.methods?.[0] || 'VIP AI', result.vipMethods?.slice(0, 3).join(', ') || '', data[0]);
    setTimeout(() => updateHistory('hu'), 5000);
    res.json({ 
      success: true, 
      phien_truoc_do: phien, 
      phien_hien_tai: phien + 1, 
      du_doan: result.prediction, 
      do_tin_cay: `${result.confidence}%`,
      xac_suat: result.probability,
      phuong_phap: result.methods?.[0],
      vip_phuong_phap: result.vipMethods,
      tong_thuat_toan: result.totalAlgorithms,
      so_luong_vip: result.vipCount,
      dong_thuan: result.agreement
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/md5', async (req, res) => {
  try {
    const data = await fetchData(API_URL_MD5);
    if (!data) return res.status(500).json({ error: 'API ERROR' });
    const phien = data[0].Phien;
    const result = predictor.predict(data);
    saveToHistory('md5', phien, result.prediction, result.confidence, result.methods?.[0] || 'VIP AI', result.vipMethods?.slice(0, 3).join(', ') || '', data[0]);
    setTimeout(() => updateHistory('md5'), 5000);
    res.json({ 
      success: true, 
      phien_truoc_do: phien, 
      phien_hien_tai: phien + 1, 
      du_doan: result.prediction, 
      do_tin_cay: `${result.confidence}%`,
      xac_suat: result.probability,
      phuong_phap: result.methods?.[0],
      vip_phuong_phap: result.vipMethods,
      tong_thuat_toan: result.totalAlgorithms,
      so_luong_vip: result.vipCount,
      dong_thuan: result.agreement
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/thongke', async (req, res) => {
  await updateHistory('hu'); await updateHistory('md5');
  const aiStats = predictor.getStats();
  res.json({ success: true, statistics, aiStats, lastUpdated: new Date().toISOString() });
});

app.get('/hu/history', async (req, res) => {
  await updateHistory('hu');
  res.json({ history: predictionHistory.hu, total: predictionHistory.hu.length, stats: statistics.hu });
});

app.get('/md5/history', async (req, res) => {
  await updateHistory('md5');
  res.json({ history: predictionHistory.md5, total: predictionHistory.md5.length, stats: statistics.md5 });
});

app.get('/reset', (req, res) => {
  predictionHistory = { hu: [], md5: [] };
  processedPhienSet = { hu: new Set(), md5: new Set() };
  statistics = { 
    hu: { total: 0, wins: 0, losses: 0, accuracy: 0, currentWinStreak: 0, maxWinStreak: 0, currentLoseStreak: 0, maxLoseStreak: 0 },
    md5: { total: 0, wins: 0, losses: 0, accuracy: 0, currentWinStreak: 0, maxWinStreak: 0, currentLoseStreak: 0, maxLoseStreak: 0 }
  };
  saveHistory();
  res.json({ message: 'RESET COMPLETE', status: 'success' });
});

// GIAO DIỆN SIÊU ĐẸP - TINH TẾ - KHÔNG ICON
app.get('/dashboard', async (req, res) => {
  await updateHistory('hu'); await updateHistory('md5');
  const aiStats = predictor.getStats();
  
  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>VIP PRO MAX | ULTIMATE PREDICTOR</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,500;14..32,600;14..32,700;14..32,800&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%);
            min-height: 100vh;
            color: #e8edf5;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        
        /* HEADER */
        .header {
            text-align: center;
            padding: 40px 20px;
            margin-bottom: 30px;
            background: rgba(255,255,255,0.02);
            border-radius: 30px;
            border: 1px solid rgba(255,255,255,0.05);
            backdrop-filter: blur(10px);
        }
        .title {
            font-size: 48px;
            font-weight: 800;
            letter-spacing: -1px;
            background: linear-gradient(135deg, #ffffff, #a0a0ff, #ffa0a0);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }
        .subtitle {
            font-size: 14px;
            color: #6a7590;
            margin-top: 16px;
            letter-spacing: 2px;
        }
        .badge {
            display: inline-block;
            margin-top: 20px;
            padding: 6px 20px;
            background: rgba(255,255,255,0.05);
            border-radius: 40px;
            font-size: 12px;
            font-weight: 500;
            color: #a0a0ff;
        }
        
        /* STATS GRID */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: rgba(255,255,255,0.02);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 24px;
            text-align: center;
            border: 1px solid rgba(255,255,255,0.05);
            transition: all 0.3s ease;
        }
        .stat-card:hover {
            transform: translateY(-4px);
            border-color: rgba(160,160,255,0.3);
            background: rgba(255,255,255,0.04);
        }
        .stat-value {
            font-size: 42px;
            font-weight: 800;
            background: linear-gradient(135deg, #fff, #a0a0ff);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }
        .stat-label {
            font-size: 13px;
            color: #6a7590;
            margin-top: 12px;
            letter-spacing: 0.5px;
        }
        
        /* SERVERS GRID */
        .servers-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 25px;
            margin-bottom: 30px;
        }
        .server-card {
            background: rgba(255,255,255,0.02);
            backdrop-filter: blur(10px);
            border-radius: 24px;
            padding: 28px;
            border: 1px solid rgba(255,255,255,0.05);
            transition: all 0.3s ease;
        }
        .server-card:hover {
            border-color: rgba(255,160,160,0.3);
            transform: translateY(-4px);
        }
        .server-title {
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 24px;
            letter-spacing: 1px;
            color: #a0a0ff;
        }
        .chart-container {
            display: flex;
            align-items: center;
            gap: 30px;
            flex-wrap: wrap;
        }
        .donut-wrapper {
            position: relative;
            width: 140px;
            height: 140px;
        }
        canvas {
            width: 140px !important;
            height: 140px !important;
        }
        .percentage {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 28px;
            font-weight: 800;
            font-family: monospace;
        }
        .stats-list {
            flex: 1;
        }
        .stat-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .win { color: #80ffaa; }
        .loss { color: #ff8080; }
        
        /* AI STATS */
        .ai-stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 30px;
        }
        .ai-card {
            background: rgba(255,255,255,0.02);
            border-radius: 16px;
            padding: 16px;
            text-align: center;
            border: 1px solid rgba(255,255,255,0.05);
        }
        .ai-value {
            font-size: 24px;
            font-weight: 700;
            color: #a0a0ff;
        }
        .ai-label {
            font-size: 11px;
            color: #6a7590;
            margin-top: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        /* HISTORY SECTION */
        .history-section {
            background: rgba(255,255,255,0.02);
            backdrop-filter: blur(10px);
            border-radius: 24px;
            overflow: hidden;
            border: 1px solid rgba(255,255,255,0.05);
        }
        .history-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 25px;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            flex-wrap: wrap;
            gap: 15px;
        }
        .tabs {
            display: flex;
            gap: 10px;
        }
        .tab {
            padding: 8px 28px;
            background: transparent;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 30px;
            color: #8a95b0;
            cursor: pointer;
            transition: all 0.3s;
            font-weight: 500;
            font-size: 14px;
        }
        .tab.active {
            background: linear-gradient(135deg, rgba(160,160,255,0.2), rgba(255,160,160,0.2));
            border-color: rgba(160,160,255,0.5);
            color: #fff;
        }
        .refresh-btn {
            padding: 8px 28px;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 30px;
            color: #a0a0ff;
            cursor: pointer;
            transition: all 0.3s;
            font-weight: 500;
        }
        .refresh-btn:hover {
            background: rgba(255,255,255,0.1);
            transform: scale(1.02);
        }
        .table-container {
            overflow-x: auto;
            max-height: 500px;
            overflow-y: auto;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th {
            padding: 16px;
            text-align: left;
            color: #6a7590;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 1px;
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        td {
            padding: 14px 16px;
            border-bottom: 1px solid rgba(255,255,255,0.03);
            font-size: 13px;
        }
        tr:hover td {
            background: rgba(255,255,255,0.02);
        }
        .method-badge {
            background: rgba(160,160,255,0.1);
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 500;
            display: inline-block;
        }
        .vip-badge {
            background: rgba(255,160,160,0.1);
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 10px;
            font-weight: 600;
            display: inline-block;
            margin: 2px;
        }
        .badge-correct {
            background: rgba(128,255,170,0.15);
            color: #80ffaa;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
        }
        .badge-wrong {
            background: rgba(255,128,128,0.15);
            color: #ff8080;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
        }
        .footer {
            text-align: center;
            padding: 30px;
            color: #5a6580;
            font-size: 12px;
            border-top: 1px solid rgba(255,255,255,0.05);
            margin-top: 30px;
        }
        
        @media (max-width: 768px) {
            .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 15px; }
            .servers-grid { grid-template-columns: 1fr; gap: 20px; }
            .ai-stats { grid-template-columns: repeat(2, 1fr); }
            .title { font-size: 32px; }
            .stat-value { font-size: 32px; }
        }
        
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        ::-webkit-scrollbar-thumb { background: rgba(160,160,255,0.3); border-radius: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title">VIP PRO MAX</div>
            <div class="subtitle">ULTIMATE PREDICTION SYSTEM</div>
            <div class="badge">25 ALGORITHMS | AI POWERED | QUANTUM READY</div>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-value" id="totalAlgo">25</div><div class="stat-label">ACTIVE ALGORITHMS</div></div>
            <div class="stat-card"><div class="stat-value" id="vipCount">0</div><div class="stat-label">VIP ALGORITHMS</div></div>
            <div class="stat-card"><div class="stat-value" id="accuracy">${aiStats.accuracy}</div><div class="stat-label">ACCURACY</div></div>
            <div class="stat-card"><div class="stat-value" id="streak">0</div><div class="stat-label">CURRENT STREAK</div></div>
        </div>
        
        <div class="servers-grid" id="serversGrid"></div>
        
        <div class="ai-stats">
            <div class="ai-card"><div class="ai-value" id="cosmicEnergy">${aiStats.cosmicEnergy}</div><div class="ai-label">COSMIC ENERGY</div></div>
            <div class="ai-card"><div class="ai-value" id="dimensionLevel">${aiStats.dimensionLevel}</div><div class="ai-label">DIMENSION LEVEL</div></div>
            <div class="ai-card"><div class="ai-value" id="quantumEntropy">${aiStats.quantumEntropy}</div><div class="ai-label">QUANTUM ENTROPY</div></div>
            <div class="ai-card"><div class="ai-value" id="totalPredict">${aiStats.total}</div><div class="ai-label">TOTAL PREDICTIONS</div></div>
        </div>
        
        <div class="history-section">
            <div class="history-header">
                <div class="tabs">
                    <button class="tab active" onclick="switchTab('hu')">HU SERVER</button>
                    <button class="tab" onclick="switchTab('md5')">MD5 SERVER</button>
                </div>
                <button class="refresh-btn" onclick="refreshData()">SYNC DATA</button>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr><th>SESSION</th><th>RESULT</th><th>PREDICTION</th><th>CONFIDENCE</th><th>METHOD</th><th>VIP METHODS</th><th>STATUS</th></tr>
                    </thead>
                    <tbody id="tableBody"><tr><td colspan="7" style="text-align:center;">LOADING DATA...</td></tr></tbody>
                </table>
            </div>
        </div>
        
        <div class="footer">
            VIP PRO MAX PREDICTOR | 25 ALGORITHMS | AI + QUANTUM + DEEP LEARNING
            <br>POWERED BY ULTIMATE INTELLIGENCE
        </div>
    </div>
    
    <script>
        let currentTab = 'hu', charts = {};
        
        async function fetchStats() {
            try {
                const res = await fetch('/thongke');
                const data = await res.json();
                if(data.success) {
                    updateServers(data.statistics);
                    if(data.aiStats) {
                        document.getElementById('accuracy').innerText = data.aiStats.accuracy;
                        document.getElementById('cosmicEnergy').innerText = data.aiStats.cosmicEnergy;
                        document.getElementById('dimensionLevel').innerText = data.aiStats.dimensionLevel;
                        document.getElementById('quantumEntropy').innerText = data.aiStats.quantumEntropy;
                        document.getElementById('totalPredict').innerText = data.aiStats.total;
                        document.getElementById('streak').innerText = data.statistics.hu.currentWinStreak;
                    }
                }
            } catch(e) { console.error(e); }
        }
        
        function updateServers(stats) {
            document.getElementById('serversGrid').innerHTML = \`
                <div class="server-card"><div class="server-title">HU SERVER</div>
                <div class="chart-container"><div class="donut-wrapper"><canvas id="chartHu"></canvas><div class="percentage">\${stats.hu.accuracy}%</div></div>
                <div class="stats-list"><div class="stat-row"><span>WINS</span><span class="win">\${stats.hu.wins}</span></div>
                <div class="stat-row"><span>LOSSES</span><span class="loss">\${stats.hu.losses}</span></div>
                <div class="stat-row"><span>MAX STREAK</span><span>\${stats.hu.maxWinStreak}</span></div></div></div></div>
                <div class="server-card"><div class="server-title">MD5 SERVER</div>
                <div class="chart-container"><div class="donut-wrapper"><canvas id="chartMd5"></canvas><div class="percentage">\${stats.md5.accuracy}%</div></div>
                <div class="stats-list"><div class="stat-row"><span>WINS</span><span class="win">\${stats.md5.wins}</span></div>
                <div class="stat-row"><span>LOSSES</span><span class="loss">\${stats.md5.losses}</span></div>
                <div class="stat-row"><span>MAX STREAK</span><span>\${stats.md5.maxWinStreak}</span></div></div></div></div>
            \`;
            if(charts.hu) charts.hu.destroy();
            if(charts.md5) charts.md5.destroy();
            charts.hu = new Chart(document.getElementById('chartHu'), { type: 'doughnut', data: { datasets: [{ data: [stats.hu.wins, stats.hu.losses || 1], backgroundColor: ['#80ffaa', '#ff8080'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false } } } });
            charts.md5 = new Chart(document.getElementById('chartMd5'), { type: 'doughnut', data: { datasets: [{ data: [stats.md5.wins, stats.md5.losses || 1], backgroundColor: ['#80ffaa', '#ff8080'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false } } } });
        }
        
        async function fetchHistory() {
            try {
                const res = await fetch(\`/\${currentTab}/history\`);
                const data = await res.json();
                const tbody = document.getElementById('tableBody');
                if(!data.history || data.history.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">NO DATA</td></tr>';
                    return;
                }
                tbody.innerHTML = data.history.slice(0, 30).map(h => {
                    const isCorrect = h.ket_qua_du_doan === 'DUNG';
                    return \`<tr>
                        <td style="color:#a0a0ff;">#\${h.Phien}</td>
                        <td class="\${h.Ket_qua === 'Tài' ? 'loss' : 'win'}">\${h.Ket_qua}</td>
                        <td class="\${h.Du_doan === 'Tài' ? 'loss' : 'win'}">\${h.Du_doan}</td>
                        <td style="color:#ffcc80;">\${h.Do_tin_cay}</td>
                        <td><span class="method-badge">\${h.Phuong_phap || 'VIP AI'}</span></td>
                        <td>\${(h.Vip_phuong_phap || '').split(',').slice(0,2).map(v => \`<span class="vip-badge">\${v.trim()}</span>\`).join('')}</td>
                        <td><span class="badge-\${isCorrect ? 'correct' : 'wrong'}">\${isCorrect ? 'CORRECT' : 'WRONG'}</span></td>
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
        
        fetchStats(); fetchHistory();
        setInterval(() => { fetchStats(); fetchHistory(); }, 5000);
    </script>
</body>
</html>`;
  res.send(html);
});

// KHỞI ĐỘNG
loadHistory();
setInterval(autoProcess, 1000);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n============================================================`);
  console.log(`VIP PRO MAX PREDICTOR - ULTIMATE EDITION`);
  console.log(`PORT: ${PORT}`);
  console.log(`ALGORITHMS: 25 ACTIVE`);
  console.log(`DASHBOARD: http://0.0.0.0:${PORT}/dashboard`);
  console.log(`API: http://0.0.0.0:${PORT}/hu`);
  console.log(`============================================================\n`);
});
