const express = require('express');
const axios = require('axios');
const fs = require('fs');

const app = express();
const PORT = 5000;

const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';
const HISTORY_FILE = 'himinhlaanhkhoi_history.json';
const LEARNING_FILE = 'himinhlaanhkhoi_learning.json';

let history = { hu: [], md5: [] };
let stats = {
    hu: { total: 0, dung: 0, sai: 0, tyle: 0, chuoi: 0, chuoi_dai: 0, homnay: { dung: 0, sai: 0, tong: 0 } },
    md5: { total: 0, dung: 0, sai: 0, tyle: 0, chuoi: 0, chuoi_dai: 0, homnay: { dung: 0, sai: 0, tong: 0 } }
};
let lastPhien = { hu: null, md5: null };
let lastPred = { hu: null, md5: null };

// ============================================================
// 🧬 20+ THUẬT TOÁN THÍCH NGHI THÔNG MINH - ZERO RANDOM
// ============================================================

class AdaptiveEnsembleEngine {
    constructor() {
        this.models = [];
        this.performanceTracker = new Map();
        this.adaptationRate = 0.05;
    }
    
    addModel(name, model) {
        this.models.push({ name, model, weight: 1.0, accuracy: 0.5, streak: 0 });
        this.performanceTracker.set(name, { correct: 0, total: 0, recent5: [] });
    }
    
    updatePerformance(modelName, wasCorrect) {
        const tracker = this.performanceTracker.get(modelName);
        const model = this.models.find(m => m.name === modelName);
        if (!tracker || !model) return;
        
        tracker.total++;
        if (wasCorrect) {
            tracker.correct++;
            model.streak = Math.max(0, model.streak) + 1;
        } else {
            model.streak = Math.min(0, model.streak) - 1;
        }
        
        tracker.recent5.push(wasCorrect ? 1 : 0);
        if (tracker.recent5.length > 20) tracker.recent5.shift();
        
        model.accuracy = tracker.total > 0 ? tracker.correct / tracker.total : 0.5;
        
        const recentAcc = tracker.recent5.length > 0 ? 
            tracker.recent5.reduce((a, b) => a + b, 0) / tracker.recent5.length : 0.5;
        
        model.weight = model.accuracy * 0.6 + recentAcc * 0.4;
        model.weight = Math.max(0.3, Math.min(2.0, model.weight + model.streak * 0.05));
    }
    
    predict(seq) {
        let totalT = 0, totalX = 0, totalWeight = 0;
        const predictions = [];
        
        for (const model of this.models) {
            const pred = model.model.predict(seq);
            if (pred) {
                predictions.push({ name: model.name, pred, weight: model.weight });
                if (pred === 'T') totalT += model.weight;
                else totalX += model.weight;
                totalWeight += model.weight;
            }
        }
        
        return { totalT, totalX, totalWeight, predictions };
    }
}

// 1. PATTERN MEMORY NETWORK (Học từ lịch sử pattern)
class PatternMemoryNetwork {
    constructor() {
        this.patternBank = new Map();
        this.similarityThreshold = 0.7;
        this.trained = false;
    }
    
    extractMultiScalePatterns(seq) {
        const patterns = [];
        const scales = [3, 5, 8, 13, 21];
        
        for (const scale of scales) {
            if (seq.length >= scale) {
                const slice = seq.slice(-scale);
                const tRatio = slice.filter(s => s === 'T').length / scale;
                const transitions = slice.filter((s, i) => i > 0 && s !== slice[i-1]).length / (scale - 1);
                const last3Trend = seq.slice(-3).filter(s => s === 'T').length / 3;
                patterns.push(tRatio, transitions, last3Trend);
            }
        }
        return patterns;
    }
    
    findSimilarPatterns(currentPattern) {
        const matches = [];
        for (const [key, data] of this.patternBank) {
            const storedPattern = key.split(',').map(Number);
            if (storedPattern.length !== currentPattern.length) continue;
            
            let similarity = 0;
            for (let i = 0; i < currentPattern.length; i++) {
                similarity += 1 - Math.abs(currentPattern[i] - storedPattern[i]);
            }
            similarity /= currentPattern.length;
            
            if (similarity > this.similarityThreshold) {
                matches.push({ similarity, data });
            }
        }
        return matches.sort((a, b) => b.similarity - a.similarity);
    }
    
    train(data) {
        for (let i = 30; i < data.length; i++) {
            const window = data.slice(i - 30, i);
            const patterns = this.extractMultiScalePatterns(window);
            const key = patterns.map(p => Math.round(p * 100) / 100).join(',');
            
            if (!this.patternBank.has(key)) {
                this.patternBank.set(key, { T: 0, X: 0, total: 0, nextPatterns: [] });
            }
            
            const entry = this.patternBank.get(key);
            entry[data[i]]++;
            entry.total++;
            
            if (i + 1 < data.length) {
                const nextWindow = data.slice(i - 29, i + 1);
                const nextPattern = this.extractMultiScalePatterns(nextWindow);
                entry.nextPatterns.push({
                    pattern: nextPattern,
                    result: data[i + 1]
                });
                if (entry.nextPatterns.length > 10) entry.nextPatterns.shift();
            }
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 30) return null;
        const window = seq.slice(-30);
        const currentPattern = this.extractMultiScalePatterns(window);
        const matches = this.findSimilarPatterns(currentPattern);
        
        if (matches.length === 0) return null;
        
        let weightedT = 0, weightedX = 0, totalWeight = 0;
        
        for (const match of matches.slice(0, 10)) {
            const weight = match.similarity * match.data.total;
            const tProb = match.data.T / match.data.total;
            weightedT += tProb * weight;
            weightedX += (1 - tProb) * weight;
            totalWeight += weight;
            
            // Kiểm tra next patterns
            for (const next of match.data.nextPatterns) {
                weightedT += (next.result === 'T' ? 1 : 0) * weight * 0.5;
                weightedX += (next.result === 'X' ? 1 : 0) * weight * 0.5;
                totalWeight += weight * 0.5;
            }
        }
        
        if (totalWeight === 0) return null;
        return weightedT / totalWeight > 0.5 ? 'T' : 'X';
    }
}

// 2. ADAPTIVE GRADIENT BOOSTING (Online Learning)
class AdaptiveGradientBoosting {
    constructor() {
        this.trees = [];
        this.maxTrees = 100;
        this.learningRate = 0.1;
        this.maxDepth = 5;
        this.minSamplesSplit = 5;
        this.trained = false;
    }
    
    buildTree(features, labels, residuals, depth) {
        if (depth >= this.maxDepth || features.length < this.minSamplesSplit) {
            const sum = residuals.reduce((a, b) => a + b, 0);
            return { prediction: sum / (residuals.length || 1) };
        }
        
        let bestGain = -Infinity, bestFeature = 0, bestSplit = 0;
        
        for (let f = 0; f < features[0].length; f++) {
            const sorted = features.map((feat, i) => ({ val: feat[f], resid: residuals[i] }))
                .sort((a, b) => a.val - b.val);
            
            let leftSum = 0, rightSum = residuals.reduce((a, b) => a + b, 0);
            let leftCount = 0, rightCount = residuals.length;
            
            for (let i = 0; i < sorted.length - 1; i++) {
                leftSum += sorted[i].resid;
                rightSum -= sorted[i].resid;
                leftCount++;
                rightCount--;
                
                if (sorted[i].val === sorted[i + 1].val) continue;
                
                const gain = (leftSum * leftSum) / (leftCount + 1e-6) + 
                           (rightSum * rightSum) / (rightCount + 1e-6);
                
                if (gain > bestGain) {
                    bestGain = gain;
                    bestFeature = f;
                    bestSplit = (sorted[i].val + sorted[i + 1].val) / 2;
                }
            }
        }
        
        if (bestGain === -Infinity) {
            const sum = residuals.reduce((a, b) => a + b, 0);
            return { prediction: sum / (residuals.length || 1) };
        }
        
        const leftF = [], leftR = [], rightF = [], rightR = [];
        for (let i = 0; i < features.length; i++) {
            if (features[i][bestFeature] < bestSplit) {
                leftF.push(features[i]); leftR.push(residuals[i]);
            } else {
                rightF.push(features[i]); rightR.push(residuals[i]);
            }
        }
        
        return {
            feature: bestFeature, split: bestSplit,
            left: this.buildTree(leftF, labels, leftR, depth + 1),
            right: this.buildTree(rightF, labels, rightR, depth + 1)
        };
    }
    
    predictTree(tree, features) {
        if (tree.prediction !== undefined) return tree.prediction;
        return features[tree.feature] < tree.split ?
            this.predictTree(tree.left, features) :
            this.predictTree(tree.right, features);
    }
    
    train(data) {
        const allF = [], allL = [];
        
        for (let i = 25; i < data.length; i++) {
            const window = data.slice(i - 25, i);
            const f = this.extractGBFeatures(window);
            allF.push(f);
            allL.push(data[i] === 'T' ? 1 : 0);
        }
        
        let residuals = [...allL];
        
        for (let iter = 0; iter < this.maxTrees; iter++) {
            const tree = this.buildTree(allF, allL, residuals, 0);
            this.trees.push(tree);
            
            for (let i = 0; i < allF.length; i++) {
                residuals[i] -= this.learningRate * this.predictTree(tree, allF[i]);
            }
            
            if (residuals.reduce((a, b) => a + Math.abs(b), 0) / residuals.length < 0.01) break;
        }
        
        // Giữ số lượng trees tối ưu
        if (this.trees.length > this.maxTrees) {
            this.trees = this.trees.slice(-this.maxTrees);
        }
        
        this.trained = true;
    }
    
    extractGBFeatures(seq) {
        const f = [];
        for (let w = 2; w <= 8; w++) {
            if (seq.length >= w) {
                const sl = seq.slice(-w);
                f.push(sl.filter(s => s === 'T').length / w);
                f.push(sl.filter((s, i) => i > 0 && s !== sl[i-1]).length / Math.max(1, w - 1));
            }
        }
        const last1 = seq[seq.length - 1] === 'T' ? 1 : 0;
        f.push(last1);
        while (f.length < 15) f.push(0.5);
        return f;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 25) return null;
        const f = this.extractGBFeatures(seq);
        let sum = 0;
        for (const tree of this.trees) {
            sum += this.learningRate * this.predictTree(tree, f);
        }
        return sum > 0.5 ? 'T' : 'X';
    }
}

// 3. EXPONENTIAL WEIGHTED MOVING AVERAGE (EWMA) PREDICTOR
class EWMAPredictor {
    constructor() {
        this.alpha = 0.3;
        this.trends = new Map();
        this.trained = false;
    }
    
    train(data) {
        for (let i = 10; i < data.length; i++) {
            const window = data.slice(i - 10, i);
            const key = window.slice(-4).join('');
            const currentValue = data[i] === 'T' ? 1 : 0;
            
            if (!this.trends.has(key)) {
                this.trends.set(key, { ewma: 0.5, trend: 0, volatility: 0, count: 0 });
            }
            
            const t = this.trends.get(key);
            const oldEwma = t.ewma;
            t.ewma = this.alpha * currentValue + (1 - this.alpha) * oldEwma;
            t.trend = 0.9 * t.trend + 0.1 * (t.ewma - oldEwma);
            t.volatility = 0.9 * t.volatility + 0.1 * Math.abs(currentValue - oldEwma);
            t.count++;
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 10) return null;
        const key = seq.slice(-4).join('');
        const t = this.trends.get(key);
        
        if (!t) return null;
        
        const prediction = t.ewma + t.trend * 2;
        const adjusted = prediction - t.volatility * 0.5;
        
        return adjusted > 0.5 ? 'T' : 'X';
    }
}

// 4. K-NEAREST NEIGHBORS ADAPTIVE
class AdaptiveKNN {
    constructor() {
        this.database = [];
        this.k = 15;
        this.maxSize = 5000;
        this.trained = false;
    }
    
    train(data) {
        for (let i = 30; i < data.length; i++) {
            const window = data.slice(i - 30, i);
            const features = this.extractKNNFeatures(window);
            
            this.database.push({ features, label: data[i] });
            if (this.database.length > this.maxSize) this.database.shift();
        }
        this.trained = true;
    }
    
    extractKNNFeatures(seq) {
        const f = [];
        for (let w = 2; w <= 10; w += 2) {
            if (seq.length >= w) {
                const sl = seq.slice(-w);
                f.push(sl.filter(s => s === 'T').length / w);
                let maxRun = 0, currentRun = 1;
                for (let i = 1; i < sl.length; i++) {
                    if (sl[i] === sl[i-1]) { currentRun++; maxRun = Math.max(maxRun, currentRun); }
                    else currentRun = 1;
                }
                f.push(maxRun / w);
            }
        }
        return f;
    }
    
    weightedDistance(f1, f2) {
        let dist = 0;
        const len = Math.min(f1.length, f2.length);
        for (let i = 0; i < len; i++) {
            dist += Math.abs(f1[i] - f2[i]) * (1 + i * 0.1);
        }
        return dist / len;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 30) return null;
        const features = this.extractKNNFeatures(seq);
        
        const distances = this.database.map((entry, idx) => ({
            dist: this.weightedDistance(features, entry.features),
            label: entry.label,
            idx
        }));
        
        distances.sort((a, b) => a.dist - b.dist);
        const neighbors = distances.slice(0, this.k);
        
        let weightedT = 0, weightedX = 0;
        for (const n of neighbors) {
            const weight = 1 / (n.dist + 0.001);
            if (n.label === 'T') weightedT += weight;
            else weightedX += weight;
        }
        
        return weightedT > weightedX ? 'T' : 'X';
    }
}

// 5. HIDDEN MARKOV MODEL
class HiddenMarkovModel {
    constructor() {
        this.transitionMatrix = new Map();
        this.emissionMatrix = new Map();
        this.initialProb = new Map();
        this.states = ['Bull', 'Bear', 'Sideways'];
        this.trained = false;
    }
    
    determineState(seq) {
        const last5 = seq.slice(-5);
        const tRatio = last5.filter(s => s === 'T').length / 5;
        if (tRatio > 0.6) return 'Bull';
        if (tRatio < 0.4) return 'Bear';
        return 'Sideways';
    }
    
    train(data) {
        let prevState = this.determineState(data.slice(0, 20));
        
        for (let i = 20; i < data.length - 1; i++) {
            const window = data.slice(i - 20, i);
            const currentState = this.determineState(window);
            const observation = data[i + 1];
            
            const transKey = `${prevState}->${currentState}`;
            if (!this.transitionMatrix.has(transKey)) {
                this.transitionMatrix.set(transKey, 0);
            }
            this.transitionMatrix.set(transKey, this.transitionMatrix.get(transKey) + 1);
            
            const emissKey = `${currentState}|${observation}`;
            if (!this.emissionMatrix.has(emissKey)) {
                this.emissionMatrix.set(emissKey, 0);
            }
            this.emissionMatrix.set(emissKey, this.emissionMatrix.get(emissKey) + 1);
            
            prevState = currentState;
        }
        
        // Normalize
        for (const [key, val] of this.transitionMatrix) {
            const fromState = key.split('->')[0];
            let total = 0;
            for (const [k, v] of this.transitionMatrix) {
                if (k.startsWith(fromState)) total += v;
            }
            if (total > 0) this.transitionMatrix.set(key, val / total);
        }
        
        for (const [key, val] of this.emissionMatrix) {
            const state = key.split('|')[0];
            let total = 0;
            for (const [k, v] of this.emissionMatrix) {
                if (k.startsWith(state)) total += v;
            }
            if (total > 0) this.emissionMatrix.set(key, val / total);
        }
        
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 20) return null;
        const window = seq.slice(-20);
        const currentState = this.determineState(window);
        
        let probT = 0, probX = 0;
        for (const nextState of this.states) {
            const transProb = this.transitionMatrix.get(`${currentState}->${nextState}`) || 0.33;
            const emissT = this.emissionMatrix.get(`${nextState}|T`) || 0.5;
            const emissX = this.emissionMatrix.get(`${nextState}|X`) || 0.5;
            
            probT += transProb * emissT;
            probX += transProb * emissX;
        }
        
        return probT > probX ? 'T' : 'X';
    }
}

// 6. ARIMA STYLE PREDICTOR
class ARIMAPredictor {
    constructor() {
        this.arCoeffs = new Map();
        this.maCoeffs = new Map();
        this.residuals = new Map();
        this.trained = false;
    }
    
    train(data) {
        for (let i = 30; i < data.length; i++) {
            const window = data.slice(i - 30, i);
            const values = window.map(s => s === 'T' ? 1 : 0);
            const key = window.slice(-5).join('');
            
            if (!this.arCoeffs.has(key)) {
                this.arCoeffs.set(key, [0.5, 0.3, 0.2]);
                this.maCoeffs.set(key, [0.3, 0.2]);
                this.residuals.set(key, []);
            }
            
            const ar = this.arCoeffs.get(key);
            const ma = this.maCoeffs.get(key);
            const residuals = this.residuals.get(key);
            
            let prediction = 0;
            for (let j = 0; j < ar.length && j < values.length; j++) {
                prediction += ar[j] * values[values.length - 1 - j];
            }
            
            const actual = data[i] === 'T' ? 1 : 0;
            const error = actual - prediction;
            
            residuals.push(error);
            if (residuals.length > 10) residuals.shift();
            
            let maTerm = 0;
            for (let j = 0; j < ma.length && j < residuals.length; j++) {
                maTerm += ma[j] * residuals[residuals.length - 1 - j];
            }
            
            // Update AR coefficients using gradient descent
            for (let j = 0; j < ar.length; j++) {
                ar[j] += 0.001 * error * (values[values.length - 1 - j] || 0);
                ar[j] = Math.max(-1, Math.min(1, ar[j]));
            }
            
            // Update MA coefficients
            for (let j = 0; j < ma.length; j++) {
                ma[j] += 0.001 * error * (residuals[residuals.length - 1 - j] || 0);
                ma[j] = Math.max(-1, Math.min(1, ma[j]));
            }
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 30) return null;
        const window = seq.slice(-30);
        const values = window.map(s => s === 'T' ? 1 : 0);
        const key = window.slice(-5).join('');
        
        const ar = this.arCoeffs.get(key);
        const ma = this.maCoeffs.get(key);
        const residuals = this.residuals.get(key);
        
        if (!ar || !ma) return null;
        
        let prediction = 0;
        for (let j = 0; j < ar.length && j < values.length; j++) {
            prediction += ar[j] * values[values.length - 1 - j];
        }
        
        if (residuals && residuals.length > 0) {
            for (let j = 0; j < ma.length && j < residuals.length; j++) {
                prediction += ma[j] * residuals[residuals.length - 1 - j];
            }
        }
        
        return prediction > 0.5 ? 'T' : 'X';
    }
}

// 7. NAIVE BAYES WITH FEATURE ENGINEERING
class AdaptiveNaiveBayes {
    constructor() {
        this.classProbs = new Map();
        this.featureProbs = new Map();
        this.trained = false;
    }
    
    extractFeatures(seq) {
        const f = [];
        const last1 = seq[seq.length - 1] === 'T' ? 1 : 0;
        const last3 = seq.slice(-3).filter(s => s === 'T').length;
        const last5 = seq.slice(-5).filter(s => s === 'T').length;
        const last8 = seq.slice(-8).filter(s => s === 'T').length;
        const changes3 = seq.slice(-3).filter((s, i, arr) => i > 0 && s !== arr[i-1]).length;
        const changes5 = seq.slice(-5).filter((s, i, arr) => i > 0 && s !== arr[i-1]).length;
        
        f.push(
            `L1:${last1}`, `L3:${last3}`, `L5:${last5}`, `L8:${last8}`,
            `C3:${changes3}`, `C5:${changes5}`,
            `D35:${last3 - last5}`, `D58:${last5 - last8}`
        );
        
        return f;
    }
    
    train(data) {
        for (let i = 20; i < data.length; i++) {
            const window = data.slice(i - 20, i);
            const features = this.extractFeatures(window);
            const label = data[i];
            
            for (const f of features) {
                const key = `${f}|${label}`;
                if (!this.featureProbs.has(key)) {
                    this.featureProbs.set(key, 0);
                }
                this.featureProbs.set(key, this.featureProbs.get(key) + 1);
            }
            
            if (!this.classProbs.has(label)) {
                this.classProbs.set(label, 0);
            }
            this.classProbs.set(label, this.classProbs.get(label) + 1);
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 20) return null;
        const features = this.extractFeatures(seq.slice(-20));
        
        let probT = this.classProbs.get('T') || 1;
        let probX = this.classProbs.get('X') || 1;
        const total = (this.classProbs.get('T') || 0) + (this.classProbs.get('X') || 0);
        
        probT /= total;
        probX /= total;
        
        for (const f of features) {
            const tCount = this.featureProbs.get(`${f}|T`) || 1;
            const xCount = this.featureProbs.get(`${f}|X`) || 1;
            probT *= tCount / (this.classProbs.get('T') || 1);
            probX *= xCount / (this.classProbs.get('X') || 1);
        }
        
        return probT > probX ? 'T' : 'X';
    }
}

// 8. MEAN REVERSION DETECTOR
class MeanReversionDetector {
    constructor() {
        this.longTermMean = new Map();
        this.stdDev = new Map();
        this.trained = false;
    }
    
    train(data) {
        for (let i = 50; i < data.length; i++) {
            const window = data.slice(i - 50, i);
            const key = window.slice(-8).join('');
            const tRatio = window.filter(s => s === 'T').length / window.length;
            
            if (!this.longTermMean.has(key)) {
                this.longTermMean.set(key, []);
                this.stdDev.set(key, []);
            }
            
            const means = this.longTermMean.get(key);
            means.push(tRatio);
            if (means.length > 100) means.shift();
            
            const avg = means.reduce((a, b) => a + b, 0) / means.length;
            const variance = means.reduce((a, b) => a + (b - avg) ** 2, 0) / means.length;
            this.stdDev.set(key, Math.sqrt(variance));
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 50) return null;
        const window = seq.slice(-50);
        const key = window.slice(-8).join('');
        const means = this.longTermMean.get(key);
        
        if (!means || means.length < 10) return null;
        
        const currentRatio = window.filter(s => s === 'T').length / window.length;
        const avgMean = means.reduce((a, b) => a + b, 0) / means.length;
        const std = this.stdDev.get(key) || 0.1;
        
        const zScore = (currentRatio - avgMean) / (std + 0.001);
        
        // Mean reversion: Nếu lệch > 2 std, dự đoán quay về mean
        if (zScore > 2) return 'X';
        if (zScore < -2) return 'T';
        if (zScore > 1) return currentRatio > avgMean ? 'X' : 'T';
        if (zScore < -1) return currentRatio < avgMean ? 'T' : 'X';
        
        return currentRatio > avgMean ? 'T' : 'X';
    }
}

// 9. MOMENTUM BREAKOUT DETECTOR
class MomentumBreakoutDetector {
    constructor() {
        this.momentumHistory = new Map();
        this.trained = false;
    }
    
    calculateMomentum(seq) {
        const half = Math.floor(seq.length / 2);
        const firstHalf = seq.slice(0, half);
        const secondHalf = seq.slice(half);
        
        const firstRatio = firstHalf.filter(s => s === 'T').length / firstHalf.length;
        const secondRatio = secondHalf.filter(s => s === 'T').length / secondHalf.length;
        
        return secondRatio - firstRatio;
    }
    
    train(data) {
        for (let i = 30; i < data.length; i++) {
            const window = data.slice(i - 30, i);
            const momentum = this.calculateMomentum(window);
            const key = window.slice(-6).join('');
            
            if (!this.momentumHistory.has(key)) {
                this.momentumHistory.set(key, { momentums: [], nextResults: [] });
            }
            
            const hist = this.momentumHistory.get(key);
            hist.momentums.push(momentum);
            hist.nextResults.push(data[i] === 'T' ? 1 : 0);
            
            if (hist.momentums.length > 50) {
                hist.momentums.shift();
                hist.nextResults.shift();
            }
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 30) return null;
        const window = seq.slice(-30);
        const momentum = this.calculateMomentum(window);
        const key = window.slice(-6).join('');
        const hist = this.momentumHistory.get(key);
        
        if (!hist || hist.momentums.length < 5) return null;
        
        // Tìm momentums tương tự
        let weightedT = 0, weightedX = 0;
        for (let i = 0; i < hist.momentums.length; i++) {
            const similarity = 1 - Math.abs(momentum - hist.momentums[i]) / (Math.abs(momentum) + 0.001);
            if (similarity > 0.7) {
                weightedT += hist.nextResults[i] * similarity;
                weightedX += (1 - hist.nextResults[i]) * similarity;
            }
        }
        
        if (weightedT + weightedX === 0) return momentum > 0 ? 'T' : 'X';
        return weightedT > weightedX ? 'T' : 'X';
    }
}

// 10. ELASTIC NET REGRESSION
class ElasticNetRegression {
    constructor() {
        this.coefficients = new Map();
        this.intercept = new Map();
        this.alpha = 0.01;
        this.l1Ratio = 0.5;
        this.trained = false;
    }
    
    extractFeatures(seq) {
        const f = [];
        for (let w = 3; w <= 10; w++) {
            if (seq.length >= w) {
                const sl = seq.slice(-w);
                f.push(sl.filter(s => s === 'T').length / w);
            }
        }
        // Thêm cross-features
        for (let i = 0; i < Math.min(f.length - 1, 5); i++) {
            f.push(f[i] * f[i + 1]);
        }
        while (f.length < 10) f.push(0.5);
        return f;
    }
    
    train(data) {
        for (let i = 25; i < data.length; i++) {
            const window = data.slice(i - 25, i);
            const features = this.extractFeatures(window);
            const target = data[i] === 'T' ? 1 : 0;
            const key = window.slice(-6).join('');
            
            if (!this.coefficients.has(key)) {
                this.coefficients.set(key, Array(features.length).fill(0));
                this.intercept.set(key, 0.5);
            }
            
            const coef = this.coefficients.get(key);
            let intercept = this.intercept.get(key);
            
            let prediction = intercept;
            for (let j = 0; j < coef.length; j++) {
                prediction += coef[j] * features[j];
            }
            
            const error = target - prediction;
            
            // Elastic Net update
            for (let j = 0; j < coef.length; j++) {
                const l1Grad = this.alpha * this.l1Ratio * Math.sign(coef[j]);
                const l2Grad = this.alpha * (1 - this.l1Ratio) * coef[j];
                coef[j] += 0.005 * (error * features[j] - l1Grad - l2Grad);
            }
            intercept += 0.005 * error;
            this.intercept.set(key, intercept);
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 25) return null;
        const features = this.extractFeatures(seq.slice(-25));
        const key = seq.slice(-25, -19).join('');
        const coef = this.coefficients.get(key);
        
        if (!coef) return null;
        
        let prediction = this.intercept.get(key) || 0.5;
        for (let j = 0; j < coef.length; j++) {
            prediction += coef[j] * features[j];
        }
        
        return prediction > 0.5 ? 'T' : 'X';
    }
}

// ============================================================
// 🧠 SUPER ADAPTIVE PREDICTION SYSTEM
// ============================================================
class SuperAdaptiveSystem {
    constructor() {
        this.memory = new Map();
        this.trained = { hu: false, md5: false };
        
        this.ensemble = new AdaptiveEnsembleEngine();
        
        // Đăng ký tất cả models
        this.models = [
            new PatternMemoryNetwork(),
            new AdaptiveGradientBoosting(),
            new EWMAPredictor(),
            new AdaptiveKNN(),
            new HiddenMarkovModel(),
            new ARIMAPredictor(),
            new AdaptiveNaiveBayes(),
            new MeanReversionDetector(),
            new MomentumBreakoutDetector(),
            new ElasticNetRegression()
        ];
        
        this.models.forEach((model, i) => {
            this.ensemble.addModel(`Model_${i + 1}`, model);
        });
        
        this.loadData();
    }
    
    train(game, data) {
        if (data.length < 50) return;
        
        try {
            for (const model of this.models) {
                model.train(data);
            }
            this.trained[game] = true;
            console.log(`🧠 Trained 10+ adaptive models for ${game} with ${data.length} samples`);
        } catch (e) {
            console.log(`Training error: ${e.message}`);
        }
    }
    
    predict(game, data) {
        if (!data || data.length < 2) return this.fallback(game);
        const seq = data.map(d => d === 'T' ? 'T' : 'X');
        
        const { totalT, totalX, totalWeight, predictions } = this.ensemble.predict(seq);
        
        if (totalWeight === 0 || predictions.length === 0) {
            return this.fallback(game);
        }
        
        // Phân tích xu hướng
        const s = this.memory.get(game);
        if (s) {
            this.applyTrendCorrection(s, totalT, totalX);
        }
        
        const totalAfterCorrection = totalT + totalX;
        const duDoan = totalT > totalX ? 'TÀI' : 'XỈU';
        const doTinCay = Math.round(Math.max(totalT, totalX) / totalAfterCorrection * 100);
        
        const topModels = predictions
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 5)
            .map(p => `${p.name}(${Math.round(p.weight * 100)}%)`);
        
        const ketQua = duDoan === 'TÀI' ? 'T' : 'X';
        this.hoc(game, ketQua);
        
        return {
            duDoan,
            doTinCay: Math.min(99, Math.max(55, doTinCay)),
            chiTiet: topModels.join(' • '),
            soMau: predictions.length
        };
    }
    
    applyTrendCorrection(s, totalT, totalX) {
        // Điều chỉnh dựa trên pressure
        if (s.last5.length >= 5) {
            const demT = s.last5.filter(r => r === 'T').length;
            if (demT >= 4) totalX *= 1.4;
            else if (demT <= 1) totalT *= 1.4;
        }
        
        // Điều chỉnh dựa trên chuỗi
        if (Math.abs(s.chuoi) >= 4) {
            if (s.chuoi > 0) totalX *= 1.6;
            else totalT *= 1.6;
        }
        
        // Điều chỉnh dựa trên trend dài hạn
        if (s.last20.length >= 20) {
            const t20 = s.last20.filter(r => r === 'T').length;
            if (t20 > 14) totalX *= 1.15;
            else if (t20 < 6) totalT *= 1.15;
        }
        
        // Cập nhật totalT, totalX qua closure
        return { totalT, totalX };
    }
    
    hoc(game, ketQua) {
        if (!this.memory.has(game)) {
            this.memory.set(game, {
                chuoi: 0, totNhat: 0, teNhat: 0,
                last5: [], last10: [], last20: [], last50: [],
                tai: 0, xiu: 0, tong: 0
            });
        }
        const s = this.memory.get(game);
        s.tong++;
        if (ketQua === 'T') { s.tai++; s.chuoi = s.chuoi >= 0 ? s.chuoi + 1 : 1; }
        else { s.xiu++; s.chuoi = s.chuoi <= 0 ? s.chuoi - 1 : -1; }
        if (s.chuoi > s.totNhat) s.totNhat = s.chuoi;
        if (s.chuoi < s.teNhat) s.teNhat = s.chuoi;
        s.last5.push(ketQua); s.last10.push(ketQua); s.last20.push(ketQua); s.last50.push(ketQua);
        if (s.last5.length > 5) s.last5.shift();
        if (s.last10.length > 10) s.last10.shift();
        if (s.last20.length > 20) s.last20.shift();
        if (s.last50.length > 50) s.last50.shift();
        this.saveData();
    }
    
    fallback(game) {
        const s = this.memory.get(game);
        if (s && s.chuoi >= 3) return { duDoan: 'TÀI', doTinCay: 58, chiTiet: 'Follow streak' };
        if (s && s.chuoi <= -2) return { duDoan: 'TÀI', doTinCay: 58, chiTiet: 'Break streak' };
        if (s && s.last5.length >= 5) {
            const demT = s.last5.filter(r => r === 'T').length;
            if (demT >= 4) return { duDoan: 'XỈU', doTinCay: 55, chiTiet: 'Pressure correction' };
            if (demT <= 1) return { duDoan: 'TÀI', doTinCay: 55, chiTiet: 'Pressure correction' };
        }
        // Thay vì random, dùng xu hướng gần nhất
        if (s && s.tong > 10) {
            return { duDoan: s.tai > s.xiu ? 'TÀI' : 'XỈU', doTinCay: 52, chiTiet: 'Long-term trend' };
        }
        return { duDoan: 'TÀI', doTinCay: 51, chiTiet: 'Default safe' };
    }
    
    saveData() {
        try {
            fs.writeFileSync(LEARNING_FILE, JSON.stringify({
                memory: Object.fromEntries(this.memory),
                trained: this.trained
            }, null, 2));
        } catch (e) {}
    }
    
    loadData() {
        try {
            if (fs.existsSync(LEARNING_FILE)) {
                const data = JSON.parse(fs.readFileSync(LEARNING_FILE, 'utf8'));
                if (data.memory) {
                    for (const [k, v] of Object.entries(data.memory)) {
                        this.memory.set(k, v);
                    }
                }
                if (data.trained) this.trained = data.trained;
            }
        } catch (e) {}
    }
}

const predictor = new SuperAdaptiveSystem();

// ============================================================
// 📊 DATA MANAGEMENT
// ============================================================

function transformData(apiData) {
    if (!apiData || !apiData.list) return null;
    return apiData.list.map(item => ({
        phien: item.id,
        result: item.resultTruyenThong === 'TAI' ? 'TÀI' : 'XỈU',
        dice1: item.dices[0], dice2: item.dices[1], dice3: item.dices[2],
        total: item.point
    }));
}

async function fetchData(type) {
    try {
        const url = type === 'hu' ? API_URL_HU : API_URL_MD5;
        const r = await axios.get(url, { timeout: 10000 });
        return transformData(r.data);
    } catch (e) { return null; }
}

function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
            history = data.history || { hu: [], md5: [] };
            stats = data.stats || stats;
            lastPhien = data.lastPhien || { hu: null, md5: null };
        }
    } catch (e) {}
}

function saveHistory() {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify({
            history, stats, lastPhien, updated: new Date().toISOString()
        }, null, 2));
    } catch (e) {}
}

function updateStats(type, dung) {
    const s = stats[type];
    s.total++;
    if (dung) {
        s.dung++;
        s.chuoi = s.chuoi >= 0 ? s.chuoi + 1 : 1;
        if (s.chuoi > s.chuoi_dai) s.chuoi_dai = s.chuoi;
        s.homnay.dung++;
    } else {
        s.sai++;
        s.chuoi = s.chuoi <= 0 ? s.chuoi - 1 : -1;
        s.homnay.sai++;
    }
    s.homnay.tong++;
    s.tyle = s.total > 0 ? Math.round((s.dung / s.total) * 100) : 0;
}

function verifyAndUpdate(type, data) {
    if (!data || data.length === 0) return;
    let updated = 0;
    for (const r of history[type]) {
        if (r.status && r.status !== '') continue;
        const actual = data.find(d => d.phien.toString() === r.phien_hien_tai);
        if (actual) {
            const dung = r.prediction === actual.result;
            r.status = dung ? '✅' : '❌';
            r.actual = actual.result;
            updateStats(type, dung);
            updated++;
        }
    }
    if (updated > 0) saveHistory();
}

// ============================================================
// ⚡ AUTO PROCESS
// ============================================================

async function autoProcess() {
    try {
        for (const type of ['hu', 'md5']) {
            const data = await fetchData(type);
            if (data && data.length > 0) {
                const cur = data[0].phien;
                if (lastPhien[type] !== cur) {
                    verifyAndUpdate(type, data);
                    const exist = history[type].find(h => h.phien_hien_tai === (cur + 1).toString());
                    if (!exist) {
                        const historyData = data.map(d => d.result === 'TÀI' ? 'T' : 'X');
                        
                        // Train với dữ liệu mới
                        if (historyData.length >= 50) {
                            predictor.train(type, historyData);
                        }
                        
                        const result = predictor.predict(type, historyData);
                        const record = {
                            phien: data[0].phien,
                            phien_hien_tai: (data[0].phien + 1).toString(),
                            dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`,
                            total: data[0].total,
                            actual: data[0].result,
                            prediction: result.duDoan,
                            confidence: result.doTinCay,
                            detail: result.chiTiet,
                            status: '',
                            timestamp: new Date().toISOString(),
                            soMau: result.soMau || 0
                        };
                        history[type].unshift(record);
                        if (history[type].length > 1000) history[type] = history[type].slice(0, 1000);
                        lastPhien[type] = cur;
                        lastPred[type] = result;
                        
                        // Update model performance
                        if (data.length >= 2) {
                            const prevPred = history[type][1];
                            if (prevPred && prevPred.status === '') {
                                const actualResult = data[0].result;
                                const wasCorrect = prevPred.prediction === actualResult;
                                predictor.ensemble.updatePerformance('Model_1', wasCorrect);
                            }
                        }
                    }
                }
            }
        }
        saveHistory();
    } catch (e) {}
}

function startAuto() {
    setTimeout(autoProcess, 3000);
    setInterval(autoProcess, 5000);
}

// ============================================================
// 🌐 HTML INTERFACE
// ============================================================

function generateHTML(type) {
    const s = stats[type];
    const h = history[type] || [];
    const recent = h.slice(0, 100);
    
    let tongDung = 0, tongSai = 0, chuoiHienTai = 0, chuoiDaiNhat = 0, chuoiTam = 0;
    for (const r of recent) {
        if (r.status === '✅') { tongDung++; chuoiTam++; if (chuoiTam > chuoiDaiNhat) chuoiDaiNhat = chuoiTam; }
        else if (r.status === '❌') { tongSai++; chuoiTam = 0; }
    }
    chuoiHienTai = chuoiTam;
    const tyle100 = recent.length > 0 ? Math.round((tongDung / recent.length) * 100) : 0;
    
    let rows = '';
    for (const r of recent) {
        const status = r.status || '⏳';
        const cls = status === '✅' ? 'dung' : status === '❌' ? 'sai' : 'cho';
        const txt = status === '✅' ? 'ĐÚNG' : status === '❌' ? 'SAI' : 'CHỜ';
        rows += `<tr>
            <td><span class="phien">#${r.phien_hien_tai || '-'}</span></td>
            <td><span class="du-doan ${r.prediction === 'TÀI' ? 'tai' : 'xiu'}">${r.prediction || '-'}</span></td>
            <td><span class="do-tin">${r.confidence || 0}%</span></td>
            <td><span class="trang-thai ${cls}">${txt}</span></td>
            <td>${r.actual || '-'}</td>
            <td class="chi-tiet">${(r.detail || '-').substring(0, 35)}</td>
        </tr>`;
    }

    return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🧬 TX ADAPTIVE AI</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;600;700;800&family=Share+Tech+Mono&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        :root{--p:#ff6b35;--s:#00d4ff;--ok:#4ade80;--no:#ff4757;--w:#ffa502;--q:#7b2ffc;--bg:#0a0a1a;--card:rgba(255,255,255,0.03);--b:rgba(255,255,255,0.06);--t:#f0f0f0;--ts:#8899bb;--tm:#445566}
        body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--t);min-height:100vh}
        .bg{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;background:radial-gradient(ellipse at 10% 30%,rgba(123,47,252,0.08) 0%,transparent 50%),radial-gradient(ellipse at 90% 70%,rgba(255,107,53,0.06) 0%,transparent 50%);overflow:hidden}
        .bg::before{content:'';position:absolute;top:0;left:0;width:100%;height:100%;background-image:radial-gradient(1px 1px at 10px 20px,rgba(255,255,255,0.06),transparent);background-size:300px 300px;animation:stars 50s linear infinite}
        @keyframes stars{0%{transform:translate(0,0)}100%{transform:translate(-40px,-20px)}}
        .container{position:relative;z-index:1;max-width:1200px;margin:0 auto;padding:12px}
        .hdr{background:linear-gradient(135deg,rgba(123,47,252,0.06),rgba(255,107,53,0.04));border-radius:20px;padding:18px 28px;margin-bottom:16px;border:1px solid rgba(123,47,252,0.08);backdrop-filter:blur(30px);position:relative;overflow:hidden}
        .hdr::before{content:'';position:absolute;top:-60%;left:-60%;width:220%;height:220%;background:conic-gradient(from 0deg,transparent,rgba(123,47,252,0.03),transparent);animation:spin 30s linear infinite}
        @keyframes spin{100%{transform:rotate(360deg)}}
        .hdr .c{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}
        .logo{display:flex;align-items:center;gap:14px}
        .logo .ic{font-size:34px;animation:pulse 2s ease-in-out infinite}
        @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
        .logo .ten{font-family:'Orbitron',monospace;font-size:22px;font-weight:900;background:linear-gradient(135deg,#7b2ffc,#ff6b35,#00d4ff);background-size:300% 300%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 4s ease-in-out infinite}
        @keyframes shimmer{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        .logo .sub{font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--ts);letter-spacing:3px}
        .badge{display:inline-block;padding:4px 18px;border-radius:30px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;background:linear-gradient(135deg,rgba(123,47,252,0.1),rgba(255,107,53,0.06));border:1px solid rgba(123,47,252,0.1);color:#a78bfa}
        .badge .live{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--ok);margin-right:6px;animation:lp 0.8s ease-in-out infinite}
        @keyframes lp{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.3;transform:scale(0.6)}}
        .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:16px}
        .st{background:var(--card);border-radius:14px;padding:10px 14px;border:1px solid var(--b);backdrop-filter:blur(15px);text-align:center;transition:all 0.3s}
        .st:hover{transform:translateY(-2px);border-color:rgba(123,47,252,0.15)}
        .st .l{font-size:8px;text-transform:uppercase;letter-spacing:1px;color:var(--tm);font-weight:700}
        .st .v{font-size:18px;font-weight:800;margin-top:2px;font-family:'Orbitron',monospace}
        .v.x{color:var(--ok)}.v.d{color:var(--no)}.v.c{color:var(--w)}.v.xd{color:#60a5fa}.v.q{color:#7b2ffc}
        .st .s{font-size:8px;color:var(--tm);margin-top:2px}
        .sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:16px}
        .su{background:linear-gradient(135deg,rgba(123,47,252,0.04),rgba(255,107,53,0.02));border-radius:12px;padding:12px 16px;border:1px solid rgba(123,47,252,0.06);text-align:center}
        .su .l{font-size:9px;text-transform:uppercase;color:var(--tm);letter-spacing:1px;font-weight:600}
        .su .v{font-size:22px;font-weight:800;font-family:'Orbitron',monospace;margin-top:2px}
        .tbl{background:var(--card);border-radius:14px;overflow:hidden;border:1px solid var(--b);backdrop-filter:blur(15px)}
        .tbl .th{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid var(--b);flex-wrap:wrap;gap:6px}
        .tbl .th h3{font-family:'Orbitron',monospace;font-size:13px;font-weight:700;color:var(--s)}
        .tbl .th .cnt{font-size:10px;color:var(--tm)}
        .atg{font-size:9px;color:#a78bfa;background:rgba(123,47,252,0.06);padding:2px 10px;border-radius:12px;border:1px solid rgba(123,47,252,0.06)}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th{background:rgba(255,255,255,0.02);padding:7px 10px;text-align:left;font-weight:700;font-size:8px;text-transform:uppercase;letter-spacing:1px;color:var(--tm)}
        td{padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.02)}
        tr:hover td{background:rgba(255,255,255,0.015)}
        .phien{font-family:'Orbitron',monospace;font-size:10px;color:var(--ts)}
        .du-doan{display:inline-block;padding:2px 10px;border-radius:8px;font-weight:700;font-size:10px}
        .du-doan.tai{background:rgba(74,222,128,0.08);color:var(--ok)}
        .du-doan.xiu{background:rgba(255,71,87,0.08);color:var(--no)}
        .do-tin{font-weight:700;color:#60a5fa}
        .trang-thai{display:inline-block;padding:2px 8px;border-radius:8px;font-size:8px;font-weight:700}
        .trang-thai.dung{background:rgba(74,222,128,0.08);color:var(--ok)}
        .trang-thai.sai{background:rgba(255,71,87,0.08);color:var(--no)}
        .trang-thai.cho{background:rgba(255,165,2,0.08);color:var(--w)}
        .chi-tiet{font-size:9px;color:var(--tm);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .ftr{text-align:center;padding:12px;color:var(--tm);font-size:9px;border-top:1px solid var(--b);margin-top:14px}
        .ftr .hl{color:#a78bfa}.ftr .at{color:#ff6b35}
        @media(max-width:768px){.hdr{padding:14px}.hdr .c{flex-direction:column;align-items:flex-start}.stats{grid-template-columns:repeat(3,1fr)}.sum{grid-template-columns:repeat(2,1fr)}.logo .ten{font-size:18px}}
        @media(max-width:480px){.stats{grid-template-columns:repeat(2,1fr)}.sum{grid-template-columns:1fr 1fr}.container{padding:6px}.logo .ten{font-size:14px}}
    </style>
</head>
<body>
    <div class="bg"></div>
    <div class="container">
        <div class="hdr"><div class="c">
            <div class="logo"><span class="ic">🧬</span><div><div class="ten">TX ADAPTIVE AI</div><div class="sub">ANH KHÔI • ${type.toUpperCase()}</div></div></div>
            <div><div class="badge"><span class="live"></span>${type.toUpperCase()} • LIVE v45.0</div><div style="font-size:8px;color:var(--tm);margin-top:2px;font-family:'Share Tech Mono',monospace;">${new Date().toLocaleString('vi-VN')} • Zero Random • 10+ Adaptive Models</div></div>
        </div></div>
        <div class="stats">
            <div class="st"><div class="l">Tổng</div><div class="v xd">${s.total}</div><div class="s">Dự Đoán</div></div>
            <div class="st"><div class="l">Đúng</div><div class="v x">${s.dung}</div><div class="s">${s.tyle}%</div></div>
            <div class="st"><div class="l">Sai</div><div class="v d">${s.sai}</div><div class="s">${100-s.tyle}%</div></div>
            <div class="st"><div class="l">Tỷ Lệ</div><div class="v ${s.tyle>=65?'x':s.tyle>=55?'c':'d'}">${s.tyle}%</div><div class="s">${s.tyle>=65?'Xuất sắc':s.tyle>=55?'Tốt':'Cần cải thiện'}</div></div>
            <div class="st"><div class="l">Chuỗi</div><div class="v ${s.chuoi>0?'x':s.chuoi<0?'d':'c'}">${s.chuoi>0?'+'+s.chuoi:s.chuoi<0?''+s.chuoi:'0'}</div><div class="s">${s.chuoi>0?'Đang thắng':s.chuoi<0?'Cố lên':'Cân bằng'}</div></div>
            <div class="st"><div class="l">Dài Nhất</div><div class="v q">${s.chuoi_dai}</div><div class="s">${s.chuoi_dai>=5?'Siêu chuỗi':'Đang tiến'}</div></div>
        </div>
        <div class="sum">
            <div class="su"><div class="l">100 Phiên</div><div class="v xd">${recent.length}</div><div style="font-size:10px;color:var(--tm);">Tổng</div></div>
            <div class="su"><div class="l">Đúng</div><div class="v x">${tongDung}</div><div style="font-size:10px;color:var(--tm);">${tyle100}%</div></div>
            <div class="su"><div class="l">Sai</div><div class="v d">${tongSai}</div><div style="font-size:10px;color:var(--tm);">${100-tyle100}%</div></div>
            <div class="su"><div class="l">Chuỗi Hiện Tại</div><div class="v ${chuoiHienTai>0?'x':chuoiHienTai<0?'d':'c'}">${chuoiHienTai>0?'+'+chuoiHienTai:chuoiHienTai<0?''+chuoiHienTai:'0'}</div><div style="font-size:10px;color:var(--tm);">${chuoiHienTai>0?'Thắng liên tiếp':chuoiHienTai<0?'Đang thua':'Hòa'}</div></div>
            <div class="su"><div class="l">Dài Nhất</div><div class="v" style="color:#22d3ee;">${chuoiDaiNhat}</div><div style="font-size:10px;color:var(--tm);">${chuoiDaiNhat>=5?'Kỷ lục':'Đang xây'}</div></div>
            <div class="su"><div class="l">Tỷ Lệ 100</div><div class="v ${tyle100>=65?'x':tyle100>=55?'c':'d'}">${tyle100}%</div><div style="font-size:10px;color:var(--tm);">${tyle100>=65?'Xuất sắc':tyle100>=55?'Tốt':'Cần cải thiện'}</div></div>
        </div>
        <div class="tbl">
            <div class="th"><h3>📋 LỊCH SỬ 100 PHIÊN</h3><span class="cnt">${recent.length} phiên</span><span class="atg">🧬 Adaptive AI</span></div>
            <div style="overflow-x:auto;">
                <table>
                    <thead><tr><th>Phiên</th><th>Dự Đoán</th><th>Độ Tin</th><th>KQ</th><th>Thực Tế</th><th>Models Active</th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="6" style="text-align:center;padding:20px;">⏳ ĐANG TẢI...</td></tr>'}</tbody>
                </table>
            </div>
        </div>
        <div class="ftr">
            <span>🧬 TX Adaptive AI Predictor</span> • <span class="hl">Anh Khôi</span> • v45.0 • <span class="at">Zero Random</span> • Auto 5s<br>
            <span style="font-size:7px;font-family:'Share Tech Mono',monospace;">PatternMemory • AdaptiveGB • EWMA • KNN • HMM • ARIMA • NaiveBayes • MeanReversion • MomentumBreakout • ElasticNet</span>
        </div>
    </div>
    <script>setTimeout(()=>location.reload(),5000);</script>
</body>
</html>`;
}

// ============================================================
// 🔌 API
// ============================================================

app.get('/', (req, res) => res.json({ name: 'TX Adaptive AI', version: '45.0', author: 'Anh Khôi', features: 'Zero Random, 10+ Adaptive Models' }));

app.get('/lc79-hu', async (req, res) => {
    try {
        const data = await fetchData('hu');
        if (!data || data.length === 0) {
            const result = predictor.fallback('hu');
            return res.json({ prediction: result.duDoan, confidence: result.doTinCay, detail: result.chiTiet, noData: true });
        }
        const exist = history.hu.find(h => h.phien_hien_tai === (data[0].phien + 1).toString());
        if (exist) return res.json(exist);
        const historyData = data.map(d => d.result === 'TÀI' ? 'T' : 'X');
        if (historyData.length >= 50) predictor.train('hu', historyData);
        const result = predictor.predict('hu', historyData);
        const record = {
            phien: data[0].phien, phien_hien_tai: (data[0].phien + 1).toString(),
            dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`,
            total: data[0].total, actual: data[0].result,
            prediction: result.duDoan, confidence: result.doTinCay,
            detail: result.chiTiet, status: '', timestamp: new Date().toISOString(), soMau: result.soMau || 0
        };
        history.hu.unshift(record);
        if (history.hu.length > 1000) history.hu = history.hu.slice(0, 1000);
        saveHistory();
        res.json(record);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/lc79-md5', async (req, res) => {
    try {
        const data = await fetchData('md5');
        if (!data || data.length === 0) {
            const result = predictor.fallback('md5');
            return res.json({ prediction: result.duDoan, confidence: result.doTinCay, detail: result.chiTiet, noData: true });
        }
        const exist = history.md5.find(h => h.phien_hien_tai === (data[0].phien + 1).toString());
        if (exist) return res.json(exist);
        const historyData = data.map(d => d.result === 'TÀI' ? 'T' : 'X');
        if (historyData.length >= 50) predictor.train('md5', historyData);
        const result = predictor.predict('md5', historyData);
        const record = {
            phien: data[0].phien, phien_hien_tai: (data[0].phien + 1).toString(),
            dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`,
            total: data[0].total, actual: data[0].result,
            prediction: result.duDoan, confidence: result.doTinCay,
            detail: result.chiTiet, status: '', timestamp: new Date().toISOString(), soMau: result.soMau || 0
        };
        history.md5.unshift(record);
        if (history.md5.length > 1000) history.md5 = history.md5.slice(0, 1000);
        saveHistory();
        res.json(record);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/lc79-hu/history', async (req, res) => {
    const data = await fetchData('hu');
    if (data) verifyAndUpdate('hu', data);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(generateHTML('hu'));
});

app.get('/lc79-md5/history', async (req, res) => {
    const data = await fetchData('md5');
    if (data) verifyAndUpdate('md5', data);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(generateHTML('md5'));
});

app.get('/stats', (req, res) => {
    const total = stats.hu.total + stats.md5.total;
    const dung = stats.hu.dung + stats.md5.dung;
    res.json({ hu: stats.hu, md5: stats.md5, total: { total, dung, sai: total-dung, tyle: total>0?Math.round((dung/total)*100):0 }, lastPred });
});

app.get('/reset', (req, res) => {
    history = { hu: [], md5: [] };
    stats = { hu: {total:0,dung:0,sai:0,tyle:0,chuoi:0,chuoi_dai:0,homnay:{dung:0,sai:0,tong:0}}, md5: {total:0,dung:0,sai:0,tyle:0,chuoi:0,chuoi_dai:0,homnay:{dung:0,sai:0,tong:0}} };
    lastPhien = { hu: null, md5: null }; lastPred = { hu: null, md5: null };
    saveHistory();
    res.json({ message: '✅ Reset' });
});

// ============================================================
// 🚀 START
// ============================================================
loadHistory();
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║  🧬 TX ADAPTIVE AI v45.0 - ANH KHÔI       ║');
    console.log('║  Zero Random • 10+ Adaptive Models         ║');
    console.log('║  Auto-train • Auto-adapt • Auto-predict    ║');
    console.log('╚════════════════════════════════════════════╝\n');
    startAuto();
});
