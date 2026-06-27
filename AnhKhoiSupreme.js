const express = require('express');
const axios = require('axios');
const fs = require('fs');

const app = express();
const PORT = 5000;

const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';
const HISTORY_FILE = 'himinhlaanhkhoi_history.json';
const LEARNING_FILE = 'himinhlaanhkhoi_learning.json';

// ============================================================
// 📊 DỮ LIỆU
// ============================================================
let history = { hu: [], md5: [] };
let stats = {
    hu: { total: 0, dung: 0, sai: 0, tyle: 0, chuoi: 0, chuoi_dai: 0 },
    md5: { total: 0, dung: 0, sai: 0, tyle: 0, chuoi: 0, chuoi_dai: 0 }
};
let lastPhien = { hu: null, md5: null };
let lastPred = { hu: null, md5: null };

// ============================================================
// 🤖 THUẬT TOÁN HIỆN ĐẠI - ML & DEEP LEARNING
// ============================================================

// ===== 1. NEURAL NETWORK - MẠNG NƠ-RON NHÂN TẠO =====
class NeuralNetwork {
    constructor(inputSize, hiddenSize, outputSize) {
        this.inputSize = inputSize;
        this.hiddenSize = hiddenSize;
        this.outputSize = outputSize;
        
        // Khởi tạo trọng số
        this.W1 = Array.from({ length: inputSize }, () => 
            Array.from({ length: hiddenSize }, () => Math.random() * 0.2 - 0.1)
        );
        this.b1 = new Array(hiddenSize).fill(0);
        this.W2 = Array.from({ length: hiddenSize }, () => 
            Array.from({ length: outputSize }, () => Math.random() * 0.2 - 0.1)
        );
        this.b2 = new Array(outputSize).fill(0);
        
        this.learningRate = 0.01;
        this.trained = false;
    }
    
    sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
    sigmoidDerivative(x) { return x * (1 - x); }
    
    train(data, epochs = 200) {
        const features = data.map(d => d.dacTrung);
        const labels = data.map(d => d.nhan === 'T' ? [1, 0] : [0, 1]);
        
        for (let epoch = 0; epoch < epochs; epoch++) {
            for (let i = 0; i < features.length; i++) {
                // Forward propagation
                const hidden = this.forward(features[i]);
                const output = this.sigmoid(
                    hidden.reduce((sum, h, j) => sum + h * this.W2[j][0], this.b2[0])
                );
                
                // Backward propagation
                const outputError = labels[i][0] - output;
                const outputDelta = outputError * this.sigmoidDerivative(output);
                
                const hiddenErrors = this.W2.map((w, j) => w[0] * outputDelta);
                const hiddenDeltas = hidden.map((h, j) => hiddenErrors[j] * this.sigmoidDerivative(h));
                
                // Cập nhật trọng số
                for (let j = 0; j < this.hiddenSize; j++) {
                    this.W2[j][0] += this.learningRate * outputDelta * hidden[j];
                    for (let k = 0; k < this.inputSize; k++) {
                        this.W1[k][j] += this.learningRate * hiddenDeltas[j] * features[i][k];
                    }
                    this.b1[j] += this.learningRate * hiddenDeltas[j];
                }
                this.b2[0] += this.learningRate * outputDelta;
            }
        }
        this.trained = true;
    }
    
    forward(input) {
        const hidden = new Array(this.hiddenSize);
        for (let j = 0; j < this.hiddenSize; j++) {
            let sum = this.b1[j];
            for (let k = 0; k < this.inputSize; k++) {
                sum += input[k] * this.W1[k][j];
            }
            hidden[j] = this.sigmoid(sum);
        }
        return hidden;
    }
    
    predict(input) {
        if (!this.trained) return null;
        const hidden = this.forward(input);
        const output = this.sigmoid(
            hidden.reduce((sum, h, j) => sum + h * this.W2[j][0], this.b2[0])
        );
        return output > 0.5 ? 'T' : 'X';
    }
}

// ===== 2. DEEP NEURAL NETWORK - MẠNG NƠ-RON SÂU =====
class DeepNeuralNetwork {
    constructor(layers) {
        this.layers = layers;
        this.weights = [];
        this.biases = [];
        
        for (let i = 0; i < layers.length - 1; i++) {
            this.weights.push(
                Array.from({ length: layers[i] }, () => 
                    Array.from({ length: layers[i+1] }, () => Math.random() * 0.2 - 0.1)
                )
            );
            this.biases.push(new Array(layers[i+1]).fill(0));
        }
        
        this.learningRate = 0.005;
        this.trained = false;
    }
    
    sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
    sigmoidDerivative(x) { return x * (1 - x); }
    
    forward(input) {
        let current = input;
        const activations = [current];
        
        for (let layer = 0; layer < this.weights.length; layer++) {
            const next = new Array(this.weights[layer][0].length);
            for (let j = 0; j < this.weights[layer][0].length; j++) {
                let sum = this.biases[layer][j];
                for (let k = 0; k < current.length; k++) {
                    sum += current[k] * this.weights[layer][k][j];
                }
                next[j] = this.sigmoid(sum);
            }
            current = next;
            activations.push(current);
        }
        
        return { output: current, activations };
    }
    
    train(data, epochs = 300) {
        const features = data.map(d => d.dacTrung);
        const labels = data.map(d => d.nhan === 'T' ? [1, 0] : [0, 1]);
        
        for (let epoch = 0; epoch < epochs; epoch++) {
            for (let i = 0; i < features.length; i++) {
                const { output, activations } = this.forward(features[i]);
                
                // Backward propagation
                const errors = [];
                const outputError = labels[i].map((l, j) => (l - output[j]) * this.sigmoidDerivative(output[j]));
                errors.push(outputError);
                
                for (let layer = this.weights.length - 2; layer >= 0; layer--) {
                    const layerError = new Array(this.weights[layer][0].length);
                    for (let j = 0; j < this.weights[layer][0].length; j++) {
                        let sum = 0;
                        for (let k = 0; k < this.weights[layer+1][0].length; k++) {
                            sum += errors[0][k] * this.weights[layer+1][j][k];
                        }
                        layerError[j] = sum * this.sigmoidDerivative(activations[layer+1][j]);
                    }
                    errors.unshift(layerError);
                }
                
                // Cập nhật trọng số
                for (let layer = 0; layer < this.weights.length; layer++) {
                    for (let j = 0; j < this.weights[layer][0].length; j++) {
                        for (let k = 0; k < this.weights[layer].length; k++) {
                            this.weights[layer][k][j] += this.learningRate * errors[layer][j] * activations[layer][k];
                        }
                        this.biases[layer][j] += this.learningRate * errors[layer][j];
                    }
                }
            }
        }
        this.trained = true;
    }
    
    predict(input) {
        if (!this.trained) return null;
        const { output } = this.forward(input);
        return output[0] > output[1] ? 'T' : 'X';
    }
}

// ===== 3. RANDOM FOREST - RỪNG NGẪU NHIÊN NÂNG CAO =====
class RandomForestAdvanced {
    constructor(nTrees = 20, maxDepth = 8) {
        this.nTrees = nTrees;
        this.maxDepth = maxDepth;
        this.trees = [];
        this.featureSubset = Math.floor(Math.sqrt(8));
    }
    
    train(data) {
        for (let i = 0; i < this.nTrees; i++) {
            const bootstrap = this.bootstrapSample(data);
            const tree = this.buildTree(bootstrap, 0);
            this.trees.push(tree);
        }
    }
    
    bootstrapSample(data) {
        const sample = [];
        for (let i = 0; i < data.length; i++) {
            sample.push(data[Math.floor(Math.random() * data.length)]);
        }
        return sample;
    }
    
    buildTree(data, depth) {
        if (depth >= this.maxDepth || data.length < 5) {
            return this.majorityVote(data);
        }
        
        const labels = data.map(d => d.nhan);
        const unique = [...new Set(labels)];
        if (unique.length === 1) return unique[0];
        
        const bestSplit = this.findBestSplit(data);
        if (!bestSplit) return this.majorityVote(data);
        
        return {
            feature: bestSplit.feature,
            threshold: bestSplit.threshold,
            left: this.buildTree(bestSplit.left, depth + 1),
            right: this.buildTree(bestSplit.right, depth + 1)
        };
    }
    
    findBestSplit(data) {
        const numFeatures = data[0].dacTrung.length;
        const features = this.getRandomFeatures(numFeatures);
        let bestGain = -1;
        let bestSplit = null;
        
        for (const f of features) {
            const values = data.map(d => d.dacTrung[f]);
            const sorted = [...new Set(values)].sort((a, b) => a - b);
            
            for (let i = 0; i < sorted.length - 1; i++) {
                const threshold = (sorted[i] + sorted[i + 1]) / 2;
                const left = data.filter(d => d.dacTrung[f] <= threshold);
                const right = data.filter(d => d.dacTrung[f] > threshold);
                
                if (left.length === 0 || right.length === 0) continue;
                
                const gain = this.informationGain(data, left, right);
                if (gain > bestGain) {
                    bestGain = gain;
                    bestSplit = { feature: f, threshold, left, right };
                }
            }
        }
        
        return bestSplit;
    }
    
    getRandomFeatures(numFeatures) {
        const features = [];
        const indices = Array.from({ length: numFeatures }, (_, i) => i);
        for (let i = 0; i < this.featureSubset && indices.length > 0; i++) {
            const idx = Math.floor(Math.random() * indices.length);
            features.push(indices[idx]);
            indices.splice(idx, 1);
        }
        return features;
    }
    
    informationGain(parent, left, right) {
        const entropy = (data) => {
            const labels = data.map(d => d.nhan);
            const counts = {};
            for (const l of labels) counts[l] = (counts[l] || 0) + 1;
            let e = 0;
            const total = labels.length;
            for (const l in counts) {
                const p = counts[l] / total;
                e -= p * Math.log2(p || 1);
            }
            return e;
        };
        
        const pe = entropy(parent);
        const le = entropy(left);
        const re = entropy(right);
        const total = parent.length;
        return pe - (left.length / total * le + right.length / total * re);
    }
    
    majorityVote(data) {
        const labels = data.map(d => d.nhan);
        const counts = {};
        for (const l of labels) counts[l] = (counts[l] || 0) + 1;
        let best = null, bestCount = -1;
        for (const l in counts) {
            if (counts[l] > bestCount) { bestCount = counts[l]; best = l; }
        }
        return best;
    }
    
    predict(features) {
        const votes = { T: 0, X: 0 };
        for (const tree of this.trees) {
            const pred = this.predictTree(tree, features);
            votes[pred] = (votes[pred] || 0) + 1;
        }
        return votes.T > votes.X ? 'T' : 'X';
    }
    
    predictTree(node, features) {
        if (typeof node === 'string') return node;
        if (features[node.feature] <= node.threshold) {
            return this.predictTree(node.left, features);
        } else {
            return this.predictTree(node.right, features);
        }
    }
}

// ===== 4. GRADIENT BOOSTING - TĂNG CƯỜNG GRADIENT =====
class GradientBoostingAdvanced {
    constructor(nEstimators = 50, learningRate = 0.1, maxDepth = 4) {
        this.nEstimators = nEstimators;
        this.learningRate = learningRate;
        this.maxDepth = maxDepth;
        this.models = [];
        this.initialPred = 0.5;
    }
    
    train(data) {
        const features = data.map(d => d.dacTrung);
        const labels = data.map(d => d.nhan === 'T' ? 1 : 0);
        const n = features.length;
        
        this.initialPred = labels.reduce((a, b) => a + b, 0) / n;
        let residuals = labels.map(l => l - this.initialPred);
        
        for (let i = 0; i < this.nEstimators; i++) {
            const tree = this.buildTree(features, residuals, 0);
            this.models.push(tree);
            
            for (let j = 0; j < n; j++) {
                const pred = this.predictTree(tree, features[j]);
                residuals[j] -= this.learningRate * pred;
            }
        }
    }
    
    buildTree(features, residuals, depth) {
        if (depth >= this.maxDepth || features.length < 5) {
            return residuals.reduce((a, b) => a + b, 0) / residuals.length;
        }
        
        let bestFeature = 0, bestThreshold = 0, bestError = Infinity;
        
        for (let f = 0; f < features[0].length; f++) {
            const values = features.map(row => row[f]);
            const sorted = [...new Set(values)].sort((a, b) => a - b);
            
            for (let i = 0; i < sorted.length - 1; i++) {
                const threshold = (sorted[i] + sorted[i + 1]) / 2;
                const leftIndices = features.map((row, idx) => row[f] <= threshold ? idx : -1).filter(idx => idx !== -1);
                const rightIndices = features.map((row, idx) => row[f] > threshold ? idx : -1).filter(idx => idx !== -1);
                
                if (leftIndices.length === 0 || rightIndices.length === 0) continue;
                
                const leftResiduals = leftIndices.map(idx => residuals[idx]);
                const rightResiduals = rightIndices.map(idx => residuals[idx]);
                
                const leftMean = leftResiduals.reduce((a, b) => a + b, 0) / leftResiduals.length;
                const rightMean = rightResiduals.reduce((a, b) => a + b, 0) / rightResiduals.length;
                
                let error = 0;
                for (const idx of leftIndices) {
                    error += Math.pow(residuals[idx] - leftMean, 2);
                }
                for (const idx of rightIndices) {
                    error += Math.pow(residuals[idx] - rightMean, 2);
                }
                
                if (error < bestError) {
                    bestError = error;
                    bestFeature = f;
                    bestThreshold = threshold;
                }
            }
        }
        
        const leftIndices = features.map((row, idx) => row[bestFeature] <= bestThreshold ? idx : -1).filter(idx => idx !== -1);
        const rightIndices = features.map((row, idx) => row[bestFeature] > bestThreshold ? idx : -1).filter(idx => idx !== -1);
        
        const leftFeatures = leftIndices.map(idx => features[idx]);
        const rightFeatures = rightIndices.map(idx => features[idx]);
        const leftResiduals = leftIndices.map(idx => residuals[idx]);
        const rightResiduals = rightIndices.map(idx => residuals[idx]);
        
        return {
            feature: bestFeature,
            threshold: bestThreshold,
            left: this.buildTree(leftFeatures, leftResiduals, depth + 1),
            right: this.buildTree(rightFeatures, rightResiduals, depth + 1)
        };
    }
    
    predictTree(node, features) {
        if (typeof node === 'number') return node;
        if (features[node.feature] <= node.threshold) {
            return this.predictTree(node.left, features);
        } else {
            return this.predictTree(node.right, features);
        }
    }
    
    predict(features) {
        let sum = this.initialPred;
        for (const tree of this.models) {
            sum += this.learningRate * this.predictTree(tree, features);
        }
        return sum > 0.5 ? 'T' : 'X';
    }
}

// ===== 5. SUPPORT VECTOR MACHINE - MÁY HỖ TRỢ VECTOR =====
class SVMAdvanced {
    constructor(C = 1.0, learningRate = 0.001, epochs = 200) {
        this.C = C;
        this.learningRate = learningRate;
        this.epochs = epochs;
        this.weights = [];
        this.bias = 0;
        this.trained = false;
    }
    
    train(data) {
        const features = data.map(d => d.dacTrung);
        const labels = data.map(d => d.nhan === 'T' ? 1 : -1);
        const n = features.length;
        const m = features[0].length;
        
        this.weights = new Array(m).fill(0);
        this.bias = 0;
        
        for (let epoch = 0; epoch < this.epochs; epoch++) {
            for (let i = 0; i < n; i++) {
                const decision = this.bias + features[i].reduce((sum, f, j) => sum + f * this.weights[j], 0);
                
                if (labels[i] * decision < 1) {
                    for (let j = 0; j < m; j++) {
                        this.weights[j] += this.learningRate * (labels[i] * features[i][j] - (1/this.epochs) * this.weights[j]);
                    }
                    this.bias += this.learningRate * labels[i];
                } else {
                    for (let j = 0; j < m; j++) {
                        this.weights[j] -= this.learningRate * (1/this.epochs) * this.weights[j];
                    }
                }
            }
        }
        this.trained = true;
    }
    
    predict(features) {
        if (!this.trained) return null;
        const decision = this.bias + features.reduce((sum, f, j) => sum + f * this.weights[j], 0);
        return decision > 0 ? 'T' : 'X';
    }
}

// ===== 6. K-MEANS CLUSTERING - PHÂN CỤM =====
class KMeansClustering {
    constructor(k = 3) {
        this.k = k;
        this.centroids = [];
        this.clusters = [];
        this.trained = false;
    }
    
    train(data, maxIterations = 100) {
        const features = data.map(d => d.dacTrung);
        const n = features.length;
        const m = features[0].length;
        
        // Khởi tạo centroids ngẫu nhiên
        this.centroids = [];
        for (let i = 0; i < this.k; i++) {
            this.centroids.push(features[Math.floor(Math.random() * n)]);
        }
        
        for (let iter = 0; iter < maxIterations; iter++) {
            // Gán cụm
            this.clusters = Array.from({ length: this.k }, () => []);
            for (let i = 0; i < n; i++) {
                let minDist = Infinity;
                let bestCluster = 0;
                for (let j = 0; j < this.k; j++) {
                    const dist = this.euclideanDistance(features[i], this.centroids[j]);
                    if (dist < minDist) {
                        minDist = dist;
                        bestCluster = j;
                    }
                }
                this.clusters[bestCluster].push(i);
            }
            
            // Cập nhật centroids
            const newCentroids = [];
            for (let j = 0; j < this.k; j++) {
                if (this.clusters[j].length === 0) {
                    newCentroids.push(this.centroids[j]);
                } else {
                    const clusterFeatures = this.clusters[j].map(idx => features[idx]);
                    const centroid = clusterFeatures[0].map((_, dim) => 
                        clusterFeatures.reduce((sum, f) => sum + f[dim], 0) / clusterFeatures.length
                    );
                    newCentroids.push(centroid);
                }
            }
            
            if (this.centroids.every((c, i) => this.euclideanDistance(c, newCentroids[i]) < 0.001)) {
                break;
            }
            this.centroids = newCentroids;
        }
        this.trained = true;
    }
    
    euclideanDistance(a, b) {
        return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
    }
    
    predict(features) {
        if (!this.trained) return null;
        let minDist = Infinity;
        let bestCluster = 0;
        for (let j = 0; j < this.k; j++) {
            const dist = this.euclideanDistance(features, this.centroids[j]);
            if (dist < minDist) {
                minDist = dist;
                bestCluster = j;
            }
        }
        return bestCluster;
    }
}

// ===== 7. ENSEMBLE VOTING - BỎ PHIẾU TỔNG HỢP =====
class EnsembleVoting {
    constructor() {
        this.models = [];
        this.weights = [];
    }
    
    addModel(model, weight = 1) {
        this.models.push(model);
        this.weights.push(weight);
    }
    
    train(data) {
        for (const model of this.models) {
            if (model.train) {
                model.train(data);
            }
        }
    }
    
    predict(features) {
        let tVotes = 0, xVotes = 0;
        for (let i = 0; i < this.models.length; i++) {
            const pred = this.models[i].predict(features);
            if (pred === 'T') tVotes += this.weights[i];
            else if (pred === 'X') xVotes += this.weights[i];
        }
        return tVotes > xVotes ? 'T' : 'X';
    }
}

// ===== 8. ADABOOST - TĂNG CƯỜNG THÍCH ỨNG =====
class AdaBoostAdvanced {
    constructor(nEstimators = 30) {
        this.nEstimators = nEstimators;
        this.models = [];
        this.alphas = [];
        this.trained = false;
    }
    
    train(data) {
        const features = data.map(d => d.dacTrung);
        const labels = data.map(d => d.nhan === 'T' ? 1 : -1);
        const n = features.length;
        let weights = new Array(n).fill(1 / n);
        
        for (let i = 0; i < this.nEstimators; i++) {
            const model = this.trainStump(features, labels, weights);
            let error = 0;
            for (let j = 0; j < n; j++) {
                const pred = this.predictStump(model, features[j]);
                if (pred !== labels[j]) error += weights[j];
            }
            
            if (error > 0.5) break;
            
            const alpha = 0.5 * Math.log((1 - error) / (error + 1e-10));
            let totalWeight = 0;
            for (let j = 0; j < n; j++) {
                const pred = this.predictStump(model, features[j]);
                weights[j] *= Math.exp(-alpha * labels[j] * pred);
                totalWeight += weights[j];
            }
            for (let j = 0; j < n; j++) {
                weights[j] /= totalWeight;
            }
            
            this.models.push(model);
            this.alphas.push(alpha);
        }
        this.trained = true;
    }
    
    trainStump(features, labels, weights) {
        let bestFeature = 0, bestThreshold = 0, bestError = Infinity;
        for (let f = 0; f < features[0].length; f++) {
            const values = features.map(row => row[f]);
            const sorted = [...new Set(values)].sort((a, b) => a - b);
            for (let i = 0; i < sorted.length - 1; i++) {
                const threshold = (sorted[i] + sorted[i + 1]) / 2;
                let error = 0;
                for (let j = 0; j < features.length; j++) {
                    const pred = features[j][f] <= threshold ? 1 : -1;
                    if (pred !== labels[j]) error += weights[j];
                }
                if (error < bestError) {
                    bestError = error;
                    bestFeature = f;
                    bestThreshold = threshold;
                }
            }
        }
        return { feature: bestFeature, threshold: bestThreshold };
    }
    
    predictStump(model, features) {
        return features[model.feature] <= model.threshold ? 1 : -1;
    }
    
    predict(features) {
        if (!this.trained) return null;
        let sum = 0;
        for (let i = 0; i < this.models.length; i++) {
            sum += this.alphas[i] * this.predictStump(this.models[i], features);
        }
        return sum > 0 ? 'T' : 'X';
    }
}

// ============================================================
// 🧠 HỆ THỐNG DỰ ĐOÁN TÍCH HỢP
// ============================================================
class HeThongDuDoan {
    constructor() {
        this.boNhoChuoi = new Map();
        this.boNhoBet = new Map();
        this.daHuan = { hu: false, md5: false };
        
        // Khởi tạo các model hiện đại
        this.nn = new NeuralNetwork(8, 16, 2);
        this.dnn = new DeepNeuralNetwork([8, 16, 12, 2]);
        this.rf = new RandomForestAdvanced(20, 8);
        this.gb = new GradientBoostingAdvanced(50, 0.1, 4);
        this.svm = new SVMAdvanced(1.0, 0.001, 200);
        this.kmeans = new KMeansClustering(3);
        this.ensemble = new EnsembleVoting();
        this.adaboost = new AdaBoostAdvanced(30);
        
        // Thêm các model vào ensemble
        this.ensemble.addModel(this.nn, 1.0);
        this.ensemble.addModel(this.dnn, 1.2);
        this.ensemble.addModel(this.rf, 1.1);
        this.ensemble.addModel(this.gb, 1.0);
        this.ensemble.addModel(this.svm, 0.9);
        this.ensemble.addModel(this.adaboost, 0.9);
        
        this.taiDuLieu();
    }

    chuanBiDuLieu(data) {
        const dacTrung = [];
        const nhan = [];
        for (let i = 8; i < data.length; i++) {
            const cuaSo = data.slice(i - 8, i);
            const mucTieu = data[i];
            
            const demT = cuaSo.filter(r => r === 'T').length;
            const thayDoi = cuaSo.filter((r, idx) => idx > 0 && r !== cuaSo[idx-1]).length;
            let daoDai = 0;
            for (let j = 0; j < cuaSo.length - 1; j++) {
                if (cuaSo[j] !== cuaSo[j+1]) daoDai++;
                else break;
            }
            let chuKy = 0;
            for (let c = 2; c <= 4; c++) {
                if (cuaSo.length >= c * 2) {
                    let match = true;
                    for (let j = 0; j < c; j++) {
                        if (cuaSo[j] !== cuaSo[j + c]) { match = false; break; }
                    }
                    if (match) { chuKy = c; break; }
                }
            }
            const xuHuong = Math.round(demT / cuaSo.length * 10);
            const doLech = Math.abs(demT - (cuaSo.length - demT));
            const da = (cuaSo.slice(0, 3).filter(r => r === 'T').length / 3) - 0.5;
            const bienDong = thayDoi / cuaSo.length;
            
            dacTrung.push([demT, thayDoi, daoDai, chuKy, xuHuong, doLech, da, bienDong]);
            nhan.push(mucTieu);
        }
        return { dacTrung, nhan };
    }

    huanLuyen(game, data) {
        if (data.length < 25) return;
        const { dacTrung, nhan } = this.chuanBiDuLieu(data);
        if (dacTrung.length < 15) return;
        
        const duLieuHuan = dacTrung.map((f, idx) => ({
            dacTrung: f,
            nhan: nhan[idx]
        }));
        
        try {
            // Huấn luyện các model hiện đại
            this.nn.train(duLieuHuan, 200);
            this.dnn.train(duLieuHuan, 300);
            this.rf.train(duLieuHuan);
            this.gb.train(duLieuHuan);
            this.svm.train(duLieuHuan);
            this.kmeans.train(duLieuHuan);
            this.adaboost.train(duLieuHuan);
            this.ensemble.train(duLieuHuan);
            
            this.daHuan[game] = true;
            console.log(`🧠 Đã huấn luyện 8 thuật toán hiện đại cho ${game}`);
        } catch (e) {
            console.log(`⚠️ Lỗi huấn luyện: ${e.message}`);
        }
    }

    duDoan(game, data) {
        if (!data || data.length < 2) {
            return this.fallback(game);
        }

        const lichSu = data.map(d => d === 'T' ? 'T' : 'X');
        let T = 0, X = 0;
        const mau = [];

        // Phân tích bệt trực tiếp
        const bet = this.phanTichBetTrucTiep(lichSu);
        if (bet) { 
            mau.push(bet); 
            if (bet.duDoan === 'T') T += bet.diem; 
            else X += bet.diem; 
        }

        // Phân tích zigzag
        let thayDoi = 0;
        for (let i = 1; i < Math.min(lichSu.length, 10); i++) {
            if (lichSu[i-1] !== lichSu[i]) thayDoi++;
        }
        if (thayDoi >= 7) {
            mau.push({ ten: `⚡ Zigzag ${thayDoi} → Bẻ`, duDoan: lichSu[0] === 'T' ? 'X' : 'T', diem: 40 });
            if (lichSu[0] === 'T') T += 40; else X += 40;
        } else if (thayDoi >= 4) {
            mau.push({ ten: `🌀 Zigzag ${thayDoi} → Bẻ`, duDoan: lichSu[0] === 'T' ? 'X' : 'T', diem: 25 });
            if (lichSu[0] === 'T') T += 25; else X += 25;
        }

        // Phân tích đảo
        if (lichSu.length >= 4) {
            let dao = true;
            for (let i = 0; i < 3; i++) {
                if (lichSu[i] === lichSu[i+1]) { dao = false; break; }
            }
            if (dao) {
                mau.push({ ten: `🔄 Đảo 1-1 → Bẻ`, duDoan: lichSu[0] === 'T' ? 'X' : 'T', diem: 30 });
                if (lichSu[0] === 'T') T += 30; else X += 30;
            }
        }

        // Các thuật toán hiện đại
        if (lichSu.length >= 8) {
            const demT = lichSu.slice(0, 8).filter(r => r === 'T').length;
            const thayDoi2 = lichSu.slice(0, 8).filter((r, i) => i > 0 && r !== lichSu[i-1]).length;
            let daoDai = 0;
            for (let j = 0; j < lichSu.length - 1; j++) {
                if (lichSu[j] !== lichSu[j+1]) daoDai++;
                else break;
            }
            let chuKy = 0;
            for (let c = 2; c <= 4; c++) {
                if (lichSu.length >= c * 2) {
                    let match = true;
                    for (let j = 0; j < c; j++) {
                        if (lichSu[j] !== lichSu[j + c]) { match = false; break; }
                    }
                    if (match) { chuKy = c; break; }
                }
            }
            const xuHuong = Math.round(demT / 8 * 10);
            const doLech = Math.abs(demT - (lichSu.length - demT));
            const da = (lichSu.slice(0, 3).filter(r => r === 'T').length / 3) - 0.5;
            const bienDong = thayDoi2 / lichSu.length;
            
            const dacTrung = [demT, thayDoi2, daoDai, chuKy, xuHuong, doLech, da, bienDong];
            
            // Dự đoán bằng Neural Network
            const nnPred = this.nn.predict(dacTrung);
            if (nnPred) {
                mau.push({ ten: `🧠 Neural Network → ${nnPred === 'T' ? 'Tài' : 'Xỉu'}`, duDoan: nnPred, diem: 20 });
                if (nnPred === 'T') T += 20; else X += 20;
            }
            
            // Dự đoán bằng Deep Neural Network
            const dnnPred = this.dnn.predict(dacTrung);
            if (dnnPred) {
                mau.push({ ten: `🧠 Deep NN → ${dnnPred === 'T' ? 'Tài' : 'Xỉu'}`, duDoan: dnnPred, diem: 22 });
                if (dnnPred === 'T') T += 22; else X += 22;
            }
            
            // Dự đoán bằng Random Forest
            const rfPred = this.rf.predict(dacTrung);
            if (rfPred) {
                mau.push({ ten: `🌲 Random Forest → ${rfPred === 'T' ? 'Tài' : 'Xỉu'}`, duDoan: rfPred, diem: 18 });
                if (rfPred === 'T') T += 18; else X += 18;
            }
            
            // Dự đoán bằng Gradient Boosting
            const gbPred = this.gb.predict(dacTrung);
            if (gbPred) {
                mau.push({ ten: `📈 Gradient Boosting → ${gbPred === 'T' ? 'Tài' : 'Xỉu'}`, duDoan: gbPred, diem: 18 });
                if (gbPred === 'T') T += 18; else X += 18;
            }
            
            // Dự đoán bằng SVM
            const svmPred = this.svm.predict(dacTrung);
            if (svmPred) {
                mau.push({ ten: `🎯 SVM → ${svmPred === 'T' ? 'Tài' : 'Xỉu'}`, duDoan: svmPred, diem: 16 });
                if (svmPred === 'T') T += 16; else X += 16;
            }
            
            // Dự đoán bằng AdaBoost
            const adaPred = this.adaboost.predict(dacTrung);
            if (adaPred) {
                mau.push({ ten: `⚡ AdaBoost → ${adaPred === 'T' ? 'Tài' : 'Xỉu'}`, duDoan: adaPred, diem: 16 });
                if (adaPred === 'T') T += 16; else X += 16;
            }
            
            // Dự đoán bằng Ensemble
            const ensPred = this.ensemble.predict(dacTrung);
            if (ensPred) {
                mau.push({ ten: `🤖 Ensemble (${this.ensemble.models.length} models) → ${ensPred === 'T' ? 'Tài' : 'Xỉu'}`, duDoan: ensPred, diem: 25 });
                if (ensPred === 'T') T += 25; else X += 25;
            }
        }

        // Điều chỉnh theo chuỗi
        const s = this.boNhoChuoi.get(game);
        if (s) {
            if (s.last5.length >= 5) {
                const demT = s.last5.filter(r => r === 'T').length;
                if (demT >= 4) { X *= 1.5; mau.push({ ten: '📊 Last5 Tài→Bẻ Xỉu', duDoan: 'X', diem: 20 }); }
                else if (demT <= 1) { T *= 1.5; mau.push({ ten: '📊 Last5 Xỉu→Bẻ Tài', duDoan: 'T', diem: 20 }); }
            }
            if (s.chuoi >= 5) {
                T *= 1.3; X *= 1.3;
                mau.push({ ten: '🔥 Bám bệt cực dài', duDoan: 'T', diem: 18 });
            } else if (s.chuoi >= 3) {
                T *= 1.15; X *= 1.15;
                mau.push({ ten: '🔥 Bám bệt dài', duDoan: 'T', diem: 12 });
            }
            if (s.chuoi <= -4) {
                const temp = T; T = X * 1.8; X = temp * 1.8;
                mau.push({ ten: '🔄 Bẻ bệt siêu mạnh', duDoan: 'T', diem: 25 });
            } else if (s.chuoi <= -3) {
                const temp = T; T = X * 1.5; X = temp * 1.5;
                mau.push({ ten: '🔄 Bẻ bệt mạnh', duDoan: 'T', diem: 18 });
            } else if (s.chuoi <= -2) {
                const temp = T; T = X * 1.2; X = temp * 1.2;
                mau.push({ ten: '🔄 Bẻ bệt', duDoan: 'T', diem: 10 });
            }
        }

        const tong = T + X;
        if (tong === 0) return this.fallback(game);

        const duDoan = T > X ? 'TÀI' : 'XỈU';
        let doTinCay = Math.round(Math.max(T, X) / tong * 100);
        if (mau.length >= 10) doTinCay = Math.min(99, doTinCay + 10);
        else if (mau.length >= 7) doTinCay = Math.min(99, doTinCay + 6);
        else if (mau.length >= 4) doTinCay = Math.min(99, doTinCay + 3);
        doTinCay = Math.min(99, Math.max(50, doTinCay));

        const ketQua = duDoan === 'TÀI' ? 'T' : 'X';
        const thongTinBet = this.layThongTinBet(lichSu);
        this.hoc(game, ketQua, doTinCay, thongTinBet.doDai);

        const chiTiet = mau.map(p => p.ten).slice(0, 4).join(' • ');

        return {
            duDoan: duDoan,
            doTinCay: doTinCay,
            chiTiet: chiTiet || 'Phân tích siêu chính xác',
            soMau: mau.length,
            doDaiBet: thongTinBet.doDai || 0
        };
    }

    phanTichBetTrucTiep(data) {
        if (data.length < 2) return null;
        const cuoi = data[0];
        let dem = 1;
        for (let i = 1; i < data.length; i++) {
            if (data[i] === cuoi) dem++;
            else break;
        }

        if (dem >= 8) {
            return { ten: `🔥 Bệt cực dài ${dem} → BẺ`, duDoan: cuoi === 'T' ? 'X' : 'T', diem: 60 };
        }
        if (dem >= 6) {
            return { ten: `⚡ Bệt dài ${dem} → BẺ`, duDoan: cuoi === 'T' ? 'X' : 'T', diem: 45 };
        }
        if (dem >= 4) {
            return { ten: `📈 Bệt vừa ${dem} → Theo`, duDoan: cuoi, diem: 28 };
        }
        if (dem >= 3) {
            return { ten: `📊 Bệt ngắn ${dem} → Theo`, duDoan: cuoi, diem: 16 };
        }
        if (dem >= 2) {
            return { ten: `📊 Bệt 2 → Theo`, duDoan: cuoi, diem: 8 };
        }
        return null;
    }

    hoc(game, ketQua, doTinCay, doDaiBet) {
        if (!this.boNhoChuoi.has(game)) {
            this.boNhoChuoi.set(game, {
                chuoi: 0, totNhat: 0, teNhat: 0,
                last5: [], last10: [], last20: [], last50: [], last100: [],
                tai: 0, xiu: 0, tong: 0,
                betThanhCong: 0, betThatBai: 0
            });
        }
        const s = this.boNhoChuoi.get(game);
        s.tong++;
        if (ketQua === 'T') {
            s.tai++;
            s.chuoi = s.chuoi >= 0 ? s.chuoi + 1 : 1;
        } else {
            s.xiu++;
            s.chuoi = s.chuoi <= 0 ? s.chuoi - 1 : -1;
        }
        if (s.chuoi > s.totNhat) s.totNhat = s.chuoi;
        if (s.chuoi < s.teNhat) s.teNhat = s.chuoi;
        
        s.last5.push(ketQua);
        s.last10.push(ketQua);
        s.last20.push(ketQua);
        s.last50.push(ketQua);
        s.last100.push(ketQua);
        if (s.last5.length > 5) s.last5.shift();
        if (s.last10.length > 10) s.last10.shift();
        if (s.last20.length > 20) s.last20.shift();
        if (s.last50.length > 50) s.last50.shift();
        if (s.last100.length > 100) s.last100.shift();

        if (doDaiBet > 0) {
            if (ketQua === 'T') s.betThanhCong++;
            else s.betThatBai++;
        }

        this.luuDuLieu();
    }

    layThongTinBet(data) {
        if (data.length < 2) return { doDai: 0, loai: null };
        const cuoi = data[0];
        let dem = 1;
        for (let i = 1; i < data.length; i++) {
            if (data[i] === cuoi) dem++;
            else break;
        }
        return { doDai: dem, loai: cuoi };
    }

    fallback(game) {
        const s = this.boNhoChuoi.get(game);
        if (s && s.chuoi >= 4) return { duDoan: 'TÀI', doTinCay: 60, chiTiet: '🔥 Bám bệt dài' };
        if (s && s.chuoi <= -3) return { duDoan: 'TÀI', doTinCay: 60, chiTiet: '🔄 Bẻ bệt mạnh' };
        if (s && s.last5.length >= 5) {
            const demT = s.last5.filter(r => r === 'T').length;
            if (demT >= 4) return { duDoan: 'XỈU', doTinCay: 56, chiTiet: '📊 Last5 Tài→Xỉu' };
            if (demT <= 1) return { duDoan: 'TÀI', doTinCay: 56, chiTiet: '📊 Last5 Xỉu→Tài' };
        }
        const seed = Date.now() % 3;
        const cacDuDoan = ['TÀI', 'XỈU', 'TÀI'];
        return { duDoan: cacDuDoan[seed], doTinCay: 50, chiTiet: '📊 Phân tích cơ bản' };
    }

    luuDuLieu() {
        try {
            const data = {
                chuoi: Object.fromEntries(this.boNhoChuoi),
                daHuan: this.daHuan
            };
            fs.writeFileSync(LEARNING_FILE, JSON.stringify(data, null, 2));
        } catch (e) {}
    }

    taiDuLieu() {
        try {
            if (fs.existsSync(LEARNING_FILE)) {
                const data = JSON.parse(fs.readFileSync(LEARNING_FILE, 'utf8'));
                if (data.chuoi) {
                    for (const [k, v] of Object.entries(data.chuoi)) {
                        this.boNhoChuoi.set(k, v);
                    }
                }
                if (data.daHuan) {
                    this.daHuan = data.daHuan;
                }
            }
        } catch (e) {}
    }

    layThongKe(game) {
        const s = this.boNhoChuoi.get(game);
        return {
            chuoi: s ? s.chuoi : 0,
            chuoi_dai: s ? s.totNhat : 0,
            tong: s ? s.tong : 0,
            tai: s ? s.tai : 0,
            xiu: s ? s.xiu : 0,
            betThanhCong: s ? s.betThanhCong : 0,
            betThatBai: s ? s.betThatBai : 0,
            daHuan: this.daHuan[game] || false,
            soModel: this.ensemble.models.length
        };
    }
}

const predictor = new HeThongDuDoan();

// ============================================================
// 📊 QUẢN LÝ LỊCH SỬ
// ============================================================

function transformData(apiData) {
    if (!apiData || !apiData.list) return null;
    return apiData.list.map(item => ({
        phien: item.id,
        result: item.resultTruyenThong === 'TAI' ? 'TÀI' : 'XỈU',
        dice1: item.dices[0],
        dice2: item.dices[1],
        dice3: item.dices[2],
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
        fs.writeFileSync(HISTORY_FILE, JSON.stringify({ history, stats, lastPhien, updated: new Date().toISOString() }, null, 2));
    } catch (e) {}
}

function updateStats(type, dung) {
    const s = stats[type];
    s.total++;
    if (dung) {
        s.dung++;
        s.chuoi = s.chuoi >= 0 ? s.chuoi + 1 : 1;
        if (s.chuoi > s.chuoi_dai) s.chuoi_dai = s.chuoi;
    } else {
        s.sai++;
        s.chuoi = s.chuoi <= 0 ? s.chuoi - 1 : -1;
    }
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
// ⚡ TỰ ĐỘNG
// ============================================================

async function autoProcess() {
    try {
        const dHu = await fetchData('hu');
        if (dHu && dHu.length > 0) {
            const cur = dHu[0].phien;
            if (lastPhien.hu !== cur) {
                verifyAndUpdate('hu', dHu);
                const exist = history.hu.find(h => h.phien_hien_tai === (cur + 1).toString());
                if (!exist) {
                    const data = dHu.map(d => d.result === 'TÀI' ? 'T' : 'X');
                    if (history.hu.length > 20) {
                        const trainData = history.hu.map(r => r.actual === 'TÀI' ? 'T' : 'X');
                        predictor.huanLuyen('hu', trainData);
                    }
                    const result = predictor.duDoan('hu', data);
                    const record = {
                        phien: dHu[0].phien,
                        phien_hien_tai: (dHu[0].phien + 1).toString(),
                        dice: `${dHu[0].dice1}-${dHu[0].dice2}-${dHu[0].dice3}`,
                        total: dHu[0].total,
                        actual: dHu[0].result,
                        prediction: result.duDoan,
                        confidence: result.doTinCay,
                        detail: result.chiTiet,
                        status: '',
                        timestamp: new Date().toISOString(),
                        betLength: result.doDaiBet || 0
                    };
                    history.hu.unshift(record);
                    if (history.hu.length > 1000) history.hu = history.hu.slice(0, 1000);
                    lastPhien.hu = cur;
                    lastPred.hu = result;
                    console.log(`[HU] ${result.duDoan} (${result.doTinCay}%) - ML:✅ - ${result.soMau||0} patterns`);
                }
            }
        }

        const dMd5 = await fetchData('md5');
        if (dMd5 && dMd5.length > 0) {
            const cur = dMd5[0].phien;
            if (lastPhien.md5 !== cur) {
                verifyAndUpdate('md5', dMd5);
                const exist = history.md5.find(h => h.phien_hien_tai === (cur + 1).toString());
                if (!exist) {
                    const data = dMd5.map(d => d.result === 'TÀI' ? 'T' : 'X');
                    if (history.md5.length > 20) {
                        const trainData = history.md5.map(r => r.actual === 'TÀI' ? 'T' : 'X');
                        predictor.huanLuyen('md5', trainData);
                    }
                    const result = predictor.duDoan('md5', data);
                    const record = {
                        phien: dMd5[0].phien,
                        phien_hien_tai: (dMd5[0].phien + 1).toString(),
                        dice: `${dMd5[0].dice1}-${dMd5[0].dice2}-${dMd5[0].dice3}`,
                        total: dMd5[0].total,
                        actual: dMd5[0].result,
                        prediction: result.duDoan,
                        confidence: result.doTinCay,
                        detail: result.chiTiet,
                        status: '',
                        timestamp: new Date().toISOString(),
                        betLength: result.doDaiBet || 0
                    };
                    history.md5.unshift(record);
                    if (history.md5.length > 1000) history.md5 = history.md5.slice(0, 1000);
                    lastPhien.md5 = cur;
                    lastPred.md5 = result;
                    console.log(`[MD5] ${result.duDoan} (${result.doTinCay}%) - ML:✅ - ${result.soMau||0} patterns`);
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
// 🌐 GIAO DIỆN
// ============================================================

function generateHTML(type) {
    const s = stats[type];
    const h = history[type] || [];
    const recent = h.slice(0, 25);
    const learning = predictor.layThongKe(type);
    
    let rows = '';
    for (const r of recent) {
        const status = r.status || '⏳';
        const cls = status === '✅' ? 'dung' : status === '❌' ? 'sai' : 'cho';
        const txt = status === '✅' ? 'ĐÚNG' : status === '❌' ? 'SAI' : 'CHỜ';
        const betTag = r.betLength && r.betLength >= 3 ? '🔥' : '';
        rows += `
            <tr>
                <td><span class="phien">#${r.phien_hien_tai || '-'}</span></td>
                <td><span class="du-doan ${r.prediction === 'TÀI' ? 'tai' : 'xiu'}">${r.prediction || '-'}</span></td>
                <td><span class="do-tin">${r.confidence || 0}%</span></td>
                <td><span class="trang-thai ${cls}">${txt}</span></td>
                <td>${r.actual || '-'}</td>
                <td class="chi-tiet">${r.detail ? r.detail.substring(0, 20) + (r.detail.length > 20 ? '...' : '') : '-'} ${betTag}</td>
            </tr>
        `;
    }

    return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🌌 TX PRO - ANH KHÔI</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;600;700;800;900&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        :root {
            --primary: #ff6b35;
            --secondary: #00d4ff;
            --success: #4ade80;
            --danger: #ff4757;
            --warning: #ffa502;
            --bg: #0a0a1a;
            --card: rgba(255,255,255,0.03);
            --border: rgba(255,255,255,0.06);
            --text: #f0f0f0;
            --text-secondary: #8899bb;
            --text-muted: #445566;
        }
        
        body {
            font-family: 'Inter', sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            overflow-x: hidden;
        }
        
        .bg-pro {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 0;
            background: 
                radial-gradient(ellipse at 10% 30%, rgba(255, 107, 53, 0.08) 0%, transparent 50%),
                radial-gradient(ellipse at 90% 70%, rgba(0, 212, 255, 0.06) 0%, transparent 50%),
                radial-gradient(ellipse at 50% 100%, rgba(255, 107, 53, 0.04) 0%, transparent 30%);
            overflow: hidden;
        }
        
        .bg-pro::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: 
                radial-gradient(1px 1px at 10px 20px, rgba(255,255,255,0.06), transparent),
                radial-gradient(1px 1px at 30px 60px, rgba(255,255,255,0.05), transparent),
                radial-gradient(1px 1px at 50px 140px, rgba(255,255,255,0.06), transparent),
                radial-gradient(1px 1px at 80px 30px, rgba(255,255,255,0.05), transparent),
                radial-gradient(1px 1px at 120px 90px, rgba(255,255,255,0.06), transparent),
                radial-gradient(1px 1px at 180px 50px, rgba(255,255,255,0.04), transparent),
                radial-gradient(1px 1px at 250px 110px, rgba(255,255,255,0.05), transparent);
            background-size: 300px 300px;
            animation: starFloat 50s linear infinite;
        }
        
        @keyframes starFloat {
            0% { transform: translate(0, 0); }
            100% { transform: translate(-40px, -20px); }
        }
        
        .container {
            position: relative;
            z-index: 1;
            max-width: 1200px;
            margin: 0 auto;
            padding: 12px;
        }
        
        .header-pro {
            background: linear-gradient(135deg, rgba(255, 107, 53, 0.08), rgba(0, 212, 255, 0.04));
            border-radius: 20px;
            padding: 18px 28px;
            margin-bottom: 16px;
            border: 1px solid rgba(255, 107, 53, 0.1);
            backdrop-filter: blur(30px);
            position: relative;
            overflow: hidden;
        }
        
        .header-pro::before {
            content: '';
            position: absolute;
            top: -60%;
            left: -60%;
            width: 220%;
            height: 220%;
            background: conic-gradient(from 0deg, transparent, rgba(255, 107, 53, 0.03), transparent, rgba(0, 212, 255, 0.03), transparent);
            animation: spinSlow 30s linear infinite;
        }
        
        @keyframes spinSlow {
            100% { transform: rotate(360deg); }
        }
        
        .header-pro .content {
            position: relative;
            z-index: 1;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
        }
        
        .logo-pro {
            display: flex;
            align-items: center;
            gap: 14px;
        }
        
        .logo-pro .icon {
            font-size: 32px;
            animation: pulseGlow 2s ease-in-out infinite;
            filter: drop-shadow(0 0 30px rgba(255, 107, 53, 0.15));
        }
        
        @keyframes pulseGlow {
            0%, 100% { transform: scale(1); filter: drop-shadow(0 0 30px rgba(255, 107, 53, 0.15)); }
            50% { transform: scale(1.05); filter: drop-shadow(0 0 60px rgba(255, 107, 53, 0.3)); }
        }
        
        .logo-pro .ten {
            font-family: 'Orbitron', monospace;
            font-size: 22px;
            font-weight: 900;
            background: linear-gradient(135deg, #ff6b35, #ff9a44, #ff6b35);
            background-size: 200% 200%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: shimmerGrad 3s ease-in-out infinite;
        }
        
        @keyframes shimmerGrad {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }
        
        .logo-pro .sub {
            font-size: 10px;
            color: var(--text-secondary);
            letter-spacing: 2px;
            font-weight: 300;
        }
        
        .header-pro .info {
            text-align: right;
        }
        
        .badge-pro {
            display: inline-block;
            padding: 4px 18px;
            border-radius: 30px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2px;
            background: linear-gradient(135deg, rgba(255, 107, 53, 0.12), rgba(0, 212, 255, 0.06));
            border: 1px solid rgba(255, 107, 53, 0.12);
            color: #ff9a44;
            backdrop-filter: blur(10px);
        }
        
        .badge-pro .live {
            display: inline-block;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--success);
            margin-right: 6px;
            animation: livePulse 0.8s ease-in-out infinite;
            box-shadow: 0 0 20px rgba(74, 222, 128, 0.15);
        }
        
        @keyframes livePulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.3; transform: scale(0.6); }
        }
        
        .badge-pro .version {
            color: var(--text-muted);
            font-weight: 400;
            letter-spacing: 1px;
        }
        
        .stats-pro {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
            gap: 8px;
            margin-bottom: 16px;
        }
        
        .stat-pro {
            background: var(--card);
            border-radius: 14px;
            padding: 10px 14px;
            border: 1px solid var(--border);
            backdrop-filter: blur(15px);
            transition: all 0.3s ease;
            text-align: center;
        }
        
        .stat-pro:hover {
            transform: translateY(-2px);
            border-color: rgba(255, 107, 53, 0.15);
            box-shadow: 0 8px 30px rgba(255, 107, 53, 0.04);
        }
        
        .stat-pro .label {
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--text-muted);
            font-weight: 700;
        }
        
        .stat-pro .value {
            font-size: 18px;
            font-weight: 800;
            margin-top: 2px;
            font-family: 'Orbitron', monospace;
        }
        
        .stat-pro .value.xanh { color: var(--success); }
        .stat-pro .value.do { color: var(--danger); }
        .stat-pro .value.cam { color: var(--warning); }
        .stat-pro .value.xanh-duong { color: #60a5fa; }
        .stat-pro .value.tim { color: #a78bfa; }
        .stat-pro .value.cyan { color: #22d3ee; }
        .stat-pro .value.cam-dao { color: #ff6b35; }
        
        .stat-pro .sub {
            font-size: 8px;
            color: var(--text-muted);
            margin-top: 2px;
        }
        
        .table-pro {
            background: var(--card);
            border-radius: 14px;
            overflow: hidden;
            border: 1px solid var(--border);
            backdrop-filter: blur(15px);
        }
        
        .table-pro .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 16px;
            border-bottom: 1px solid var(--border);
            flex-wrap: wrap;
            gap: 6px;
        }
        
        .table-pro .header h3 {
            font-size: 13px;
            font-weight: 700;
            color: #d0d0d0;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .table-pro .header .count {
            font-size: 10px;
            color: var(--text-muted);
        }
        
        .table-pro .header .algo-badge {
            font-size: 9px;
            color: #ff9a44;
            background: rgba(255, 107, 53, 0.08);
            padding: 2px 10px;
            border-radius: 12px;
            border: 1px solid rgba(255, 107, 53, 0.08);
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
        }
        
        th {
            background: rgba(255,255,255,0.02);
            padding: 7px 10px;
            text-align: left;
            font-weight: 700;
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--text-muted);
        }
        
        td {
            padding: 6px 10px;
            border-bottom: 1px solid rgba(255,255,255,0.02);
        }
        
        tr:hover td {
            background: rgba(255,255,255,0.015);
        }
        
        .phien {
            font-family: 'Orbitron', monospace;
            font-size: 10px;
            color: var(--text-secondary);
        }
        
        .du-doan {
            display: inline-block;
            padding: 2px 10px;
            border-radius: 8px;
            font-weight: 700;
            font-size: 10px;
        }
        
        .du-doan.tai {
            background: rgba(74, 222, 128, 0.08);
            color: var(--success);
        }
        
        .du-doan.xiu {
            background: rgba(255, 71, 87, 0.08);
            color: var(--danger);
        }
        
        .do-tin {
            font-weight: 700;
            color: #60a5fa;
        }
        
        .trang-thai {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 8px;
            font-size: 8px;
            font-weight: 700;
            letter-spacing: 0.5px;
        }
        
        .trang-thai.dung {
            background: rgba(74, 222, 128, 0.08);
            color: var(--success);
        }
        
        .trang-thai.sai {
            background: rgba(255, 71, 87, 0.08);
            color: var(--danger);
        }
        
        .trang-thai.cho {
            background: rgba(255, 165, 2, 0.08);
            color: var(--warning);
        }
        
        .chi-tiet {
            font-size: 9px;
            color: var(--text-muted);
            max-width: 150px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .footer-pro {
            text-align: center;
            padding: 12px;
            color: var(--text-muted);
            font-size: 9px;
            border-top: 1px solid var(--border);
            margin-top: 14px;
        }
        
        .footer-pro .highlight {
            color: #ff9a44;
        }
        
        .footer-pro .heart {
            color: var(--danger);
            animation: heartBeat 1.5s ease-in-out infinite;
            display: inline-block;
        }
        
        @keyframes heartBeat {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.2); }
        }
        
        .footer-pro .algo-tag {
            color: #22d3ee;
        }
        
        @media (max-width: 768px) {
            .header-pro { padding: 14px; }
            .header-pro .content { flex-direction: column; align-items: flex-start; }
            .header-pro .info { text-align: left; width: 100%; }
            .stats-pro { grid-template-columns: repeat(3, 1fr); gap: 6px; }
            .stat-pro .value { font-size: 15px; }
            .logo-pro .ten { font-size: 18px; }
            table { font-size: 10px; }
            th, td { padding: 4px 6px; }
            .chi-tiet { max-width: 50px; }
        }
        
        @media (max-width: 480px) {
            .stats-pro { grid-template-columns: repeat(2, 1fr); }
            .container { padding: 6px; }
            th, td { padding: 3px 4px; font-size: 9px; }
            .logo-pro .ten { font-size: 14px; }
            .logo-pro .icon { font-size: 22px; }
            .du-doan { font-size: 8px; padding: 1px 6px; }
            .trang-thai { font-size: 7px; padding: 1px 4px; }
        }
        
        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.01); }
        ::-webkit-scrollbar-thumb { background: rgba(255, 107, 53, 0.15); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255, 107, 53, 0.3); }
    </style>
</head>
<body>
    <div class="bg-pro"></div>
    
    <div class="container">
        <div class="header-pro">
            <div class="content">
                <div class="logo-pro">
                    <span class="icon">🌌</span>
                    <div>
                        <div class="ten">TX PRO</div>
                        <div class="sub">ANH KHÔI • ${type.toUpperCase()}</div>
                    </div>
                </div>
                <div class="info">
                    <div class="badge-pro">
                        <span class="live"></span>
                        ${type.toUpperCase()} • LIVE
                        <span class="version">v17.0</span>
                    </div>
                    <div style="font-size:8px;color:var(--text-muted);margin-top:2px;">
                        ${new Date().toLocaleString('vi-VN')} • 8 ML Models
                    </div>
                </div>
            </div>
        </div>
        
        <div class="stats-pro">
            <div class="stat-pro">
                <div class="label">Tổng</div>
                <div class="value xanh-duong">${s.total}</div>
                <div class="sub">Dự Đoán</div>
            </div>
            <div class="stat-pro">
                <div class="label">✅ Đúng</div>
                <div class="value xanh">${s.dung}</div>
                <div class="sub">${s.tyle}%</div>
            </div>
            <div class="stat-pro">
                <div class="label">❌ Sai</div>
                <div class="value do">${s.sai}</div>
                <div class="sub">${100 - s.tyle}%</div>
            </div>
            <div class="stat-pro">
                <div class="label">📊 Tỷ Lệ</div>
                <div class="value ${s.tyle >= 65 ? 'xanh' : s.tyle >= 55 ? 'cam' : 'do'}">${s.tyle}%</div>
                <div class="sub">${s.tyle >= 65 ? '🌟 Xuất sắc' : s.tyle >= 55 ? '📈 Tốt' : '📉 Cần cải thiện'}</div>
            </div>
            <div class="stat-pro">
                <div class="label">⚡ Chuỗi</div>
                <div class="value ${s.chuoi > 0 ? 'xanh' : s.chuoi < 0 ? 'do' : 'cam'}">${s.chuoi > 0 ? '✅ +' + s.chuoi : s.chuoi < 0 ? '❌ ' + s.chuoi : '0'}</div>
                <div class="sub">${s.chuoi > 0 ? '🔥 Đang thắng' : s.chuoi < 0 ? '💪 Cố lên' : '⚖️ Cân bằng'}</div>
            </div>
            <div class="stat-pro">
                <div class="label">🏆 Dài Nhất</div>
                <div class="value cam-dao">${s.chuoi_dai}</div>
                <div class="sub">${s.chuoi_dai >= 5 ? '🚀 Siêu chuỗi' : '📈 Đang tiến'}</div>
            </div>
        </div>
        
        <div class="table-pro">
            <div class="header">
                <h3>📋 LỊCH SỬ DỰ ĐOÁN</h3>
                <span class="count">${h.length} phiên • ${Math.min(25, h.length)} gần nhất</span>
                <span class="algo-badge">🤖 8 ML Models</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Phiên</th>
                        <th>Dự Đoán</th>
                        <th>Độ Tin</th>
                        <th>KQ</th>
                        <th>Thực Tế</th>
                        <th>Phân Tích</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);">⏳ Đang chờ dữ liệu...</td></tr>'}
                </tbody>
            </table>
        </div>
        
        <div class="footer-pro">
            <span style="color:var(--text-muted);">🌌 TX Pro Predictor</span> • 
            <span class="highlight">Anh Khôi</span> • 
            Phiên bản 17.0 • 
            <span class="algo-tag">🤖 8 ML Models</span> • 
            Tự động cập nhật 5s
            <br>
            <span style="font-size:7px;color:var(--text-muted);">
                <span class="heart">❤️</span> Neural Network • Deep NN • Random Forest • Gradient Boosting • SVM • K-Means • AdaBoost • Ensemble Voting
            </span>
        </div>
    </div>
    
    <script>
        setTimeout(() => location.reload(), 5000);
    </script>
</body>
</html>
    `;
}

// ============================================================
// 🔌 API
// ============================================================

app.get('/', (req, res) => res.json({ name: 'TX Pro', version: '17.0', author: 'Anh Khôi' }));

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
        if (history.hu.length > 20) {
            const trainData = history.hu.map(r => r.actual === 'TÀI' ? 'T' : 'X');
            predictor.huanLuyen('hu', trainData);
        }
        const result = predictor.duDoan('hu', historyData);
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
            betLength: result.doDaiBet || 0
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
        if (history.md5.length > 20) {
            const trainData = history.md5.map(r => r.actual === 'TÀI' ? 'T' : 'X');
            predictor.huanLuyen('md5', trainData);
        }
        const result = predictor.duDoan('md5', historyData);
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
            betLength: result.doDaiBet || 0
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
    res.json({
        hu: stats.hu,
        md5: stats.md5,
        total: { total, dung, sai: total - dung, tyle: total > 0 ? Math.round((dung / total) * 100) : 0 },
        learning: {
            hu: predictor.layThongKe('hu'),
            md5: predictor.layThongKe('md5')
        },
        lastPred
    });
});

app.get('/reset', (req, res) => {
    history = { hu: [], md5: [] };
    stats = {
        hu: { total: 0, dung: 0, sai: 0, tyle: 0, chuoi: 0, chuoi_dai: 0 },
        md5: { total: 0, dung: 0, sai: 0, tyle: 0, chuoi: 0, chuoi_dai: 0 }
    };
    lastPhien = { hu: null, md5: null };
    lastPred = { hu: null, md5: null };
    saveHistory();
    res.json({ message: '✅ Reset' });
});

// ============================================================
// 🚀 KHỞI ĐỘNG
// ============================================================

loadHistory();

app.listen(PORT, '0.0.0.0', () => {
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                                                               ║');
    console.log('║   🌌  TX PRO v17.0 - ANH KHÔI                               ║');
    console.log('║                                                               ║');
    console.log('║   🤖 8 THUẬT TOÁN MACHINE LEARNING HIỆN ĐẠI                 ║');
    console.log('║                                                               ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log('║                                                               ║');
    console.log(`║   📡 Server: http://0.0.0.0:${PORT}                            ║`);
    console.log('║                                                               ║');
    console.log('║   🤖 8 ML MODELS:                                            ║');
    console.log('║   1. Neural Network - Mạng Nơ-ron Nhân Tạo                   ║');
    console.log('║   2. Deep Neural Network - Mạng Nơ-ron Sâu                   ║');
    console.log('║   3. Random Forest - Rừng Ngẫu Nhiên Nâng Cao                ║');
    console.log('║   4. Gradient Boosting - Tăng Cường Gradient                 ║');
    console.log('║   5. SVM - Máy Hỗ Trợ Vector Nâng Cao                        ║');
    console.log('║   6. K-Means - Phân Cụm                                     ║');
    console.log('║   7. AdaBoost - Tăng Cường Thích Ứng                        ║');
    console.log('║   8. Ensemble Voting - Bỏ Phiếu Tổng Hợp                    ║');
    console.log('║                                                               ║');
    console.log('║   📁 himinhlaanhkhoi_history.json                            ║');
    console.log('║   📁 himinhlaanhkhoi_learning.json                           ║');
    console.log('║                                                               ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
    startAuto();
});
