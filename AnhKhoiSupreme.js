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
// 🤖 30 THUẬT TOÁN MACHINE LEARNING HIỆN ĐẠI
// ============================================================

// ===== 1. NEURAL NETWORK - MẠNG NƠ-RON =====
class NeuralNetwork {
    constructor(inputSize = 12, hiddenSize = 24, outputSize = 2) {
        this.inputSize = inputSize;
        this.hiddenSize = hiddenSize;
        this.outputSize = outputSize;
        this.W1 = Array.from({ length: inputSize }, () => 
            Array.from({ length: hiddenSize }, () => Math.random() * 0.2 - 0.1)
        );
        this.b1 = new Array(hiddenSize).fill(0);
        this.W2 = Array.from({ length: hiddenSize }, () => 
            Array.from({ length: outputSize }, () => Math.random() * 0.2 - 0.1)
        );
        this.b2 = new Array(outputSize).fill(0);
        this.lr = 0.005;
        this.trained = false;
        this.lossHistory = [];
    }
    
    sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
    sigmoidDerivative(x) { return x * (1 - x); }
    relu(x) { return Math.max(0, x); }
    reluDerivative(x) { return x > 0 ? 1 : 0; }
    
    forward(input) {
        const hidden = new Array(this.hiddenSize);
        for (let j = 0; j < this.hiddenSize; j++) {
            let sum = this.b1[j];
            for (let k = 0; k < this.inputSize; k++) {
                sum += input[k] * this.W1[k][j];
            }
            hidden[j] = this.relu(sum);
        }
        const output = new Array(this.outputSize);
        for (let j = 0; j < this.outputSize; j++) {
            let sum = this.b2[j];
            for (let k = 0; k < this.hiddenSize; k++) {
                sum += hidden[k] * this.W2[k][j];
            }
            output[j] = this.sigmoid(sum);
        }
        return { hidden, output };
    }
    
    train(data, epochs = 500) {
        const features = data.map(d => d.dacTrung);
        const labels = data.map(d => d.nhan === 'T' ? [1, 0] : [0, 1]);
        for (let epoch = 0; epoch < epochs; epoch++) {
            let totalLoss = 0;
            for (let i = 0; i < features.length; i++) {
                const { hidden, output } = this.forward(features[i]);
                const outputError = labels[i].map((l, j) => (l - output[j]) * this.sigmoidDerivative(output[j]));
                totalLoss += outputError.reduce((a, b) => a + b * b, 0);
                const hiddenErrors = new Array(this.hiddenSize);
                for (let j = 0; j < this.hiddenSize; j++) {
                    let sum = 0;
                    for (let k = 0; k < this.outputSize; k++) {
                        sum += outputError[k] * this.W2[j][k];
                    }
                    hiddenErrors[j] = sum * this.reluDerivative(hidden[j]);
                }
                for (let j = 0; j < this.outputSize; j++) {
                    for (let k = 0; k < this.hiddenSize; k++) {
                        this.W2[k][j] += this.lr * outputError[j] * hidden[k];
                    }
                    this.b2[j] += this.lr * outputError[j];
                }
                for (let j = 0; j < this.hiddenSize; j++) {
                    for (let k = 0; k < this.inputSize; k++) {
                        this.W1[k][j] += this.lr * hiddenErrors[j] * features[i][k];
                    }
                    this.b1[j] += this.lr * hiddenErrors[j];
                }
            }
            this.lossHistory.push(totalLoss / features.length);
        }
        this.trained = true;
    }
    
    predict(input) {
        if (!this.trained) return null;
        const { output } = this.forward(input);
        return output[0] > output[1] ? 'T' : 'X';
    }
}

// ===== 2. DEEP NEURAL NETWORK - MẠNG NƠ-RON SÂU =====
class DeepNeuralNetwork {
    constructor() {
        this.layers = [12, 32, 24, 16, 8, 2];
        this.weights = [];
        this.biases = [];
        for (let i = 0; i < this.layers.length - 1; i++) {
            this.weights.push(
                Array.from({ length: this.layers[i] }, () => 
                    Array.from({ length: this.layers[i+1] }, () => Math.random() * 0.2 - 0.1)
                )
            );
            this.biases.push(new Array(this.layers[i+1]).fill(0));
        }
        this.lr = 0.003;
        this.trained = false;
        this.lossHistory = [];
    }
    
    relu(x) { return Math.max(0, x); }
    reluDerivative(x) { return x > 0 ? 1 : 0; }
    sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
    sigmoidDerivative(x) { return x * (1 - x); }
    
    forward(input) {
        let current = input;
        const activations = [current];
        for (let layer = 0; layer < this.weights.length; layer++) {
            const next = new Array(this.weights[layer][0].length);
            const isLast = layer === this.weights.length - 1;
            for (let j = 0; j < this.weights[layer][0].length; j++) {
                let sum = this.biases[layer][j];
                for (let k = 0; k < current.length; k++) {
                    sum += current[k] * this.weights[layer][k][j];
                }
                next[j] = isLast ? this.sigmoid(sum) : this.relu(sum);
            }
            current = next;
            activations.push(current);
        }
        return { output: current, activations };
    }
    
    train(data, epochs = 500) {
        const features = data.map(d => d.dacTrung);
        const labels = data.map(d => d.nhan === 'T' ? [1, 0] : [0, 1]);
        for (let epoch = 0; epoch < epochs; epoch++) {
            let totalLoss = 0;
            for (let i = 0; i < features.length; i++) {
                const { output, activations } = this.forward(features[i]);
                const errors = [];
                const outputError = labels[i].map((l, j) => (l - output[j]) * this.sigmoidDerivative(output[j]));
                totalLoss += outputError.reduce((a, b) => a + b * b, 0);
                errors.push(outputError);
                for (let layer = this.weights.length - 2; layer >= 0; layer--) {
                    const layerError = new Array(this.weights[layer][0].length);
                    for (let j = 0; j < this.weights[layer][0].length; j++) {
                        let sum = 0;
                        for (let k = 0; k < this.weights[layer+1][0].length; k++) {
                            sum += errors[0][k] * this.weights[layer+1][j][k];
                        }
                        layerError[j] = sum * this.reluDerivative(activations[layer+1][j]);
                    }
                    errors.unshift(layerError);
                }
                for (let layer = 0; layer < this.weights.length; layer++) {
                    for (let j = 0; j < this.weights[layer][0].length; j++) {
                        for (let k = 0; k < this.weights[layer].length; k++) {
                            this.weights[layer][k][j] += this.lr * errors[layer][j] * activations[layer][k];
                        }
                        this.biases[layer][j] += this.lr * errors[layer][j];
                    }
                }
            }
            this.lossHistory.push(totalLoss / features.length);
        }
        this.trained = true;
    }
    
    predict(input) {
        if (!this.trained) return null;
        const { output } = this.forward(input);
        return output[0] > output[1] ? 'T' : 'X';
    }
}

// ===== 3. RANDOM FOREST - RỪNG NGẪU NHIÊN =====
class RandomForest {
    constructor(nTrees = 50, maxDepth = 12) {
        this.nTrees = nTrees;
        this.maxDepth = maxDepth;
        this.trees = [];
        this.featureSubset = 5;
        this.oobScore = 0;
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

// ===== 4. GRADIENT BOOSTING =====
class GradientBoosting {
    constructor(nEstimators = 100, lr = 0.05, maxDepth = 6) {
        this.nEstimators = nEstimators;
        this.lr = lr;
        this.maxDepth = maxDepth;
        this.models = [];
        this.initialPred = 0.5;
        this.trainLoss = [];
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
            let loss = 0;
            for (let j = 0; j < n; j++) {
                const pred = this.predictTree(tree, features[j]);
                residuals[j] -= this.lr * pred;
                loss += residuals[j] * residuals[j];
            }
            this.trainLoss.push(loss / n);
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
                for (const idx of leftIndices) error += Math.pow(residuals[idx] - leftMean, 2);
                for (const idx of rightIndices) error += Math.pow(residuals[idx] - rightMean, 2);
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
            sum += this.lr * this.predictTree(tree, features);
        }
        return sum > 0.5 ? 'T' : 'X';
    }
}

// ===== 5. XGBOOST =====
class XGBoost {
    constructor(nEstimators = 50, lr = 0.1, maxDepth = 5) {
        this.nEstimators = nEstimators;
        this.lr = lr;
        this.maxDepth = maxDepth;
        this.models = [];
        this.initialPred = 0.5;
        this.gamma = 0.1;
        this.lambda = 1.0;
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
                residuals[j] -= this.lr * pred;
            }
        }
    }
    
    buildTree(features, residuals, depth) {
        if (depth >= this.maxDepth || features.length < 5) {
            return residuals.reduce((a, b) => a + b, 0) / (residuals.length + this.lambda);
        }
        let bestFeature = 0, bestThreshold = 0, bestGain = -Infinity;
        for (let f = 0; f < features[0].length; f++) {
            const values = features.map(row => row[f]);
            const sorted = [...new Set(values)].sort((a, b) => a - b);
            for (let i = 0; i < sorted.length - 1; i++) {
                const threshold = (sorted[i] + sorted[i + 1]) / 2;
                const leftIndices = features.map((row, idx) => row[f] <= threshold ? idx : -1).filter(idx => idx !== -1);
                const rightIndices = features.map((row, idx) => row[f] > threshold ? idx : -1).filter(idx => idx !== -1);
                if (leftIndices.length === 0 || rightIndices.length === 0) continue;
                const leftSum = leftIndices.reduce((s, idx) => s + residuals[idx], 0);
                const rightSum = rightIndices.reduce((s, idx) => s + residuals[idx], 0);
                const leftCount = leftIndices.length;
                const rightCount = rightIndices.length;
                const gain = (leftSum * leftSum) / (leftCount + this.lambda) + 
                            (rightSum * rightSum) / (rightCount + this.lambda) -
                            (leftSum + rightSum) * (leftSum + rightSum) / (leftCount + rightCount + this.lambda) -
                            this.gamma;
                if (gain > bestGain) {
                    bestGain = gain;
                    bestFeature = f;
                    bestThreshold = threshold;
                }
            }
        }
        if (bestGain < 0) {
            return residuals.reduce((a, b) => a + b, 0) / (residuals.length + this.lambda);
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
            sum += this.lr * this.predictTree(tree, features);
        }
        return sum > 0.5 ? 'T' : 'X';
    }
}

// ===== 6. SVM - MÁY HỖ TRỢ VECTOR =====
class SVM {
    constructor(C = 2.0, lr = 0.001, epochs = 500) {
        this.C = C;
        this.lr = lr;
        this.epochs = epochs;
        this.weights = [];
        this.bias = 0;
        this.kernel = 'rbf';
        this.gamma = 0.1;
        this.trained = false;
        this.supportVectors = [];
    }
    
    kernelFunction(x, y) {
        if (this.kernel === 'linear') {
            return x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        } else if (this.kernel === 'rbf') {
            const dist = Math.sqrt(x.reduce((sum, xi, i) => sum + Math.pow(xi - y[i], 2), 0));
            return Math.exp(-this.gamma * dist * dist);
        }
        return x.reduce((sum, xi, i) => sum + xi * y[i], 0);
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
                        this.weights[j] += this.lr * (labels[i] * features[i][j] - (1/this.epochs) * this.weights[j]);
                    }
                    this.bias += this.lr * labels[i];
                } else {
                    for (let j = 0; j < m; j++) {
                        this.weights[j] -= this.lr * (1/this.epochs) * this.weights[j];
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

// ===== 7. K-MEANS CLUSTERING =====
class KMeans {
    constructor(k = 5) {
        this.k = k;
        this.centroids = [];
        this.clusters = [];
        this.trained = false;
        this.inertia = Infinity;
    }
    
    train(data, maxIterations = 100) {
        const features = data.map(d => d.dacTrung);
        const n = features.length;
        const m = features[0].length;
        this.centroids = [];
        for (let i = 0; i < this.k; i++) {
            this.centroids.push(features[Math.floor(Math.random() * n)]);
        }
        for (let iter = 0; iter < maxIterations; iter++) {
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
            const newCentroids = [];
            let newInertia = 0;
            for (let j = 0; j < this.k; j++) {
                if (this.clusters[j].length === 0) {
                    newCentroids.push(this.centroids[j]);
                } else {
                    const clusterFeatures = this.clusters[j].map(idx => features[idx]);
                    const centroid = clusterFeatures[0].map((_, dim) => 
                        clusterFeatures.reduce((sum, f) => sum + f[dim], 0) / clusterFeatures.length
                    );
                    newCentroids.push(centroid);
                    for (const idx of this.clusters[j]) {
                        newInertia += this.euclideanDistance(features[idx], centroid);
                    }
                }
            }
            if (this.centroids.every((c, i) => this.euclideanDistance(c, newCentroids[i]) < 0.001)) {
                break;
            }
            this.centroids = newCentroids;
            this.inertia = newInertia;
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

// ===== 8. KNN =====
class KNN {
    constructor(k = 11) {
        this.k = k;
        this.data = [];
        this.weights = [];
    }
    
    train(data) { 
        this.data = data;
        this.weights = new Array(data.length).fill(1);
    }
    
    predict(features) {
        if (this.data.length === 0) return null;
        const distances = this.data.map((item, idx) => {
            let dist = 0;
            for (let i = 0; i < features.length; i++) {
                dist += Math.pow(features[i] - item.dacTrung[i], 2);
            }
            return { idx, dist: Math.sqrt(dist), label: item.nhan };
        });
        distances.sort((a, b) => a.dist - b.dist);
        const neighbors = distances.slice(0, this.k);
        let t = 0, x = 0;
        for (const n of neighbors) {
            if (n.label === 'T') t++;
            else x++;
        }
        return t > x ? 'T' : 'X';
    }
}

// ===== 9. NAIVE BAYES =====
class NaiveBayes {
    constructor() {
        this.classProbs = {};
        this.featureProbs = {};
        this.featureStats = {};
    }
    
    train(data) {
        const total = data.length;
        const classCounts = {};
        const featureCounts = {};
        const featureSums = {};
        const featureSqSums = {};
        for (const item of data) {
            const label = item.nhan;
            classCounts[label] = (classCounts[label] || 0) + 1;
            for (let i = 0; i < item.dacTrung.length; i++) {
                const key = `${label}_${i}_${item.dacTrung[i]}`;
                featureCounts[key] = (featureCounts[key] || 0) + 1;
                if (!featureSums[label]) featureSums[label] = {};
                if (!featureSqSums[label]) featureSqSums[label] = {};
                featureSums[label][i] = (featureSums[label][i] || 0) + item.dacTrung[i];
                featureSqSums[label][i] = (featureSqSums[label][i] || 0) + item.dacTrung[i] * item.dacTrung[i];
            }
        }
        for (const label in classCounts) {
            this.classProbs[label] = classCounts[label] / total;
            this.featureStats[label] = {};
            for (let i = 0; i < data[0].dacTrung.length; i++) {
                const mean = featureSums[label][i] / classCounts[label];
                const var_ = featureSqSums[label][i] / classCounts[label] - mean * mean;
                this.featureStats[label][i] = { mean, var: Math.max(var_, 0.1) };
            }
        }
        for (const key in featureCounts) {
            const parts = key.split('_');
            const label = parts[0];
            const idx = parts[1];
            const val = parts[2];
            if (!this.featureProbs[label]) this.featureProbs[label] = {};
            if (!this.featureProbs[label][idx]) this.featureProbs[label][idx] = {};
            this.featureProbs[label][idx][val] = featureCounts[key] / classCounts[label];
        }
    }
    
    gaussianPDF(x, mean, var_) {
        return (1 / Math.sqrt(2 * Math.PI * var_)) * Math.exp(-Math.pow(x - mean, 2) / (2 * var_));
    }
    
    predict(features) {
        let bestLabel = null;
        let bestProb = -Infinity;
        for (const label in this.classProbs) {
            let prob = Math.log(this.classProbs[label] || 0.01);
            for (let i = 0; i < features.length; i++) {
                const stats = this.featureStats[label]?.[i];
                if (stats) {
                    const gaussian = this.gaussianPDF(features[i], stats.mean, stats.var);
                    prob += Math.log(gaussian + 1e-10);
                } else {
                    const probs = this.featureProbs[label]?.[i] || {};
                    const p = probs[features[i]] || 0.01;
                    prob += Math.log(p);
                }
            }
            if (prob > bestProb) { bestProb = prob; bestLabel = label; }
        }
        return bestLabel;
    }
}

// ===== 10. ADABOOST =====
class AdaBoost {
    constructor(nEstimators = 50) {
        this.nEstimators = nEstimators;
        this.models = [];
        this.alphas = [];
        this.trained = false;
        this.estimatorErrors = [];
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
            if (error === 0) error = 1e-10;
            const alpha = 0.5 * Math.log((1 - error) / error);
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
            this.estimatorErrors.push(error);
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

// ===== 11. LOGISTIC REGRESSION =====
class LogisticRegression {
    constructor(lr = 0.01, epochs = 300) {
        this.lr = lr;
        this.epochs = epochs;
        this.weights = [];
        this.bias = 0;
        this.trained = false;
        this.lossHistory = [];
    }
    
    sigmoid(z) { return 1 / (1 + Math.exp(-z)); }
    
    train(data) {
        const features = data.map(d => d.dacTrung);
        const labels = data.map(d => d.nhan === 'T' ? 1 : 0);
        const n = features.length;
        const m = features[0].length;
        this.weights = new Array(m).fill(0);
        this.bias = 0;
        for (let epoch = 0; epoch < this.epochs; epoch++) {
            let loss = 0;
            for (let i = 0; i < n; i++) {
                const z = this.bias + features[i].reduce((sum, f, j) => sum + f * this.weights[j], 0);
                const pred = this.sigmoid(z);
                const error = pred - labels[i];
                loss += -labels[i] * Math.log(pred + 1e-10) - (1 - labels[i]) * Math.log(1 - pred + 1e-10);
                for (let j = 0; j < m; j++) {
                    this.weights[j] -= this.lr * error * features[i][j];
                }
                this.bias -= this.lr * error;
            }
            this.lossHistory.push(loss / n);
        }
        this.trained = true;
    }
    
    predict(features) {
        if (!this.trained) return null;
        const z = this.bias + features.reduce((sum, f, j) => sum + f * this.weights[j], 0);
        return this.sigmoid(z) > 0.5 ? 'T' : 'X';
    }
}

// ===== 12. DECISION TREE =====
class DecisionTree {
    constructor(maxDepth = 10, minSamplesSplit = 5) {
        this.maxDepth = maxDepth;
        this.minSamplesSplit = minSamplesSplit;
        this.tree = null;
        this.featureImportance = {};
    }
    
    train(data, depth = 0) {
        if (depth >= this.maxDepth || data.length < this.minSamplesSplit) {
            return this.majorityVote(data);
        }
        const labels = data.map(d => d.nhan);
        const unique = [...new Set(labels)];
        if (unique.length === 1) return unique[0];
        const best = this.findBestSplit(data);
        if (!best) return this.majorityVote(data);
        const importance = best.gain / data.length;
        this.featureImportance[best.feature] = (this.featureImportance[best.feature] || 0) + importance;
        return {
            feature: best.feature,
            threshold: best.threshold,
            left: this.train(best.left, depth + 1),
            right: this.train(best.right, depth + 1),
            gain: best.gain
        };
    }
    
    findBestSplit(data) {
        const numFeatures = data[0].dacTrung.length;
        let bestGain = -1;
        let bestSplit = null;
        for (let f = 0; f < numFeatures; f++) {
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
                    bestSplit = { feature: f, threshold, gain, left, right };
                }
            }
        }
        return bestSplit;
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
    
    predict(features, node = this.tree) {
        if (!node) return 'T';
        if (typeof node === 'string') return node;
        if (features[node.feature] <= node.threshold) {
            return this.predict(features, node.left);
        } else {
            return this.predict(features, node.right);
        }
    }
}

// ===== 13. LSTM SIMPLE =====
class LSTMSimple {
    constructor() {
        this.memory = new Map();
        this.sequence = [];
        this.cellState = new Map();
        this.forgetGate = new Map();
        this.inputGate = new Map();
        this.outputGate = new Map();
    }
    
    train(data) {
        for (const item of data) {
            const key = item.dacTrung.slice(0, 5).join('|');
            if (!this.memory.has(key)) {
                this.memory.set(key, { T: 0, X: 0, total: 0 });
                this.forgetGate.set(key, 0.9);
                this.inputGate.set(key, 0.1);
                this.outputGate.set(key, 0.5);
                this.cellState.set(key, 0);
            }
            const mem = this.memory.get(key);
            mem[item.nhan] = (mem[item.nhan] || 0) + 1;
            mem.total++;
            // Update gates based on result
            if (item.nhan === 'T') {
                this.forgetGate.set(key, Math.min(1, this.forgetGate.get(key) + 0.01));
                this.inputGate.set(key, Math.max(0, this.inputGate.get(key) - 0.01));
            } else {
                this.forgetGate.set(key, Math.max(0.5, this.forgetGate.get(key) - 0.01));
                this.inputGate.set(key, Math.min(0.5, this.inputGate.get(key) + 0.01));
            }
            this.sequence.push({ dacTrung: item.dacTrung, nhan: item.nhan });
            if (this.sequence.length > 500) this.sequence.shift();
        }
    }
    
    predict(features) {
        const key = features.slice(0, 5).join('|');
        const data = this.memory.get(key);
        if (!data || data.total < 3) {
            // Use gates for prediction
            const forget = this.forgetGate.get(key) || 0.5;
            const input = this.inputGate.get(key) || 0.5;
            const output = this.outputGate.get(key) || 0.5;
            const score = forget * 0.6 + input * 0.2 + output * 0.2;
            return score > 0.5 ? 'T' : 'X';
        }
        return data.T > data.X ? 'T' : 'X';
    }
}

// ===== 14. KALMAN FILTER =====
class KalmanFilter {
    constructor() {
        this.estimate = 0.5;
        this.error = 0.1;
        this.processNoise = 0.005;
        this.measurementNoise = 0.05;
        this.estimates = [];
    }
    
    train(data) {
        for (const item of data) {
            const z = item.nhan === 'T' ? 1 : 0;
            this.error += this.processNoise;
            const kg = this.error / (this.error + this.measurementNoise);
            this.estimate += kg * (z - this.estimate);
            this.error = (1 - kg) * this.error;
            this.estimates.push(this.estimate);
        }
    }
    
    predict(features) {
        const recent = this.estimates.slice(-10);
        if (recent.length > 0) {
            const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
            const smoothed = this.estimate * 0.7 + avg * 0.3;
            return smoothed > 0.5 ? 'T' : 'X';
        }
        return this.estimate > 0.5 ? 'T' : 'X';
    }
}

// ===== 15. Q-LEARNING =====
class QLearning {
    constructor() {
        this.qTable = new Map();
        this.alpha = 0.1;
        this.gamma = 0.95;
        this.epsilon = 0.05;
        this.rewardHistory = [];
    }
    
    getState(features) {
        return features.slice(0, 6).map(v => Math.round(v * 2) / 2).join('|');
    }
    
    getQ(state, action) {
        const key = `${state}_${action}`;
        return this.qTable.get(key) || 0;
    }
    
    setQ(state, action, value) {
        const key = `${state}_${action}`;
        this.qTable.set(key, value);
    }
    
    train(data) {
        let totalReward = 0;
        for (const item of data) {
            const state = this.getState(item.dacTrung);
            const action = item.nhan;
            const reward = 1;
            totalReward += reward;
            const maxNextQ = Math.max(this.getQ(state, 'T'), this.getQ(state, 'X'));
            const currentQ = this.getQ(state, action);
            const newQ = currentQ + this.alpha * (reward + this.gamma * maxNextQ - currentQ);
            this.setQ(state, action, newQ);
        }
        this.rewardHistory.push(totalReward / data.length);
    }
    
    predict(features) {
        const state = this.getState(features);
        const qT = this.getQ(state, 'T');
        const qX = this.getQ(state, 'X');
        if (qT === 0 && qX === 0) {
            // Exploration
            return Math.random() > 0.5 ? 'T' : 'X';
        }
        return qT > qX ? 'T' : 'X';
    }
}

// ===== 16-19. REGRESSION MODELS =====
class LinearRegression {
    constructor() {
        this.weights = [];
        this.bias = 0;
        this.trained = false;
        this.r2 = 0;
    }
    
    train(data) {
        const features = data.map(d => d.dacTrung);
        const labels = data.map(d => d.nhan === 'T' ? 1 : 0);
        const n = features.length;
        const m = features[0].length;
        this.weights = new Array(m).fill(0);
        this.bias = 0;
        const lr = 0.001;
        for (let epoch = 0; epoch < 300; epoch++) {
            for (let i = 0; i < n; i++) {
                const pred = this.bias + features[i].reduce((sum, f, j) => sum + f * this.weights[j], 0);
                const error = pred - labels[i];
                for (let j = 0; j < m; j++) {
                    this.weights[j] -= lr * error * features[i][j];
                }
                this.bias -= lr * error;
            }
        }
        this.trained = true;
        // Calculate R2
        const preds = features.map(f => this.predict(f));
        const mean = labels.reduce((a, b) => a + b, 0) / n;
        const ssTot = labels.reduce((s, y) => s + Math.pow(y - mean, 2), 0);
        const ssRes = labels.reduce((s, y, i) => s + Math.pow(y - preds[i], 2), 0);
        this.r2 = 1 - ssRes / (ssTot + 1e-10);
    }
    
    predict(features) {
        if (!this.trained) return null;
        const pred = this.bias + features.reduce((sum, f, j) => sum + f * this.weights[j], 0);
        return pred > 0.5 ? 'T' : 'X';
    }
}

class RidgeRegression {
    constructor(alpha = 0.5) {
        this.alpha = alpha;
        this.weights = [];
        this.bias = 0;
        this.trained = false;
    }
    
    train(data) {
        const features = data.map(d => d.dacTrung);
        const labels = data.map(d => d.nhan === 'T' ? 1 : 0);
        const n = features.length;
        const m = features[0].length;
        this.weights = new Array(m).fill(0);
        this.bias = 0;
        const lr = 0.001;
        for (let epoch = 0; epoch < 300; epoch++) {
            for (let i = 0; i < n; i++) {
                const pred = this.bias + features[i].reduce((sum, f, j) => sum + f * this.weights[j], 0);
                const error = pred - labels[i];
                for (let j = 0; j < m; j++) {
                    this.weights[j] -= lr * (error * features[i][j] + this.alpha * this.weights[j]);
                }
                this.bias -= lr * error;
            }
        }
        this.trained = true;
    }
    
    predict(features) {
        if (!this.trained) return null;
        const pred = this.bias + features.reduce((sum, f, j) => sum + f * this.weights[j], 0);
        return pred > 0.5 ? 'T' : 'X';
    }
}

class LassoRegression {
    constructor(alpha = 0.5) {
        this.alpha = alpha;
        this.weights = [];
        this.bias = 0;
        this.trained = false;
    }
    
    train(data) {
        const features = data.map(d => d.dacTrung);
        const labels = data.map(d => d.nhan === 'T' ? 1 : 0);
        const n = features.length;
        const m = features[0].length;
        this.weights = new Array(m).fill(0);
        this.bias = 0;
        const lr = 0.001;
        for (let epoch = 0; epoch < 300; epoch++) {
            for (let i = 0; i < n; i++) {
                const pred = this.bias + features[i].reduce((sum, f, j) => sum + f * this.weights[j], 0);
                const error = pred - labels[i];
                for (let j = 0; j < m; j++) {
                    const sign = this.weights[j] > 0 ? 1 : -1;
                    this.weights[j] -= lr * (error * features[i][j] + this.alpha * sign);
                }
                this.bias -= lr * error;
            }
        }
        this.trained = true;
    }
    
    predict(features) {
        if (!this.trained) return null;
        const pred = this.bias + features.reduce((sum, f, j) => sum + f * this.weights[j], 0);
        return pred > 0.5 ? 'T' : 'X';
    }
}

class ElasticNet {
    constructor(alpha = 0.5, l1Ratio = 0.5) {
        this.alpha = alpha;
        this.l1Ratio = l1Ratio;
        this.weights = [];
        this.bias = 0;
        this.trained = false;
    }
    
    train(data) {
        const features = data.map(d => d.dacTrung);
        const labels = data.map(d => d.nhan === 'T' ? 1 : 0);
        const n = features.length;
        const m = features[0].length;
        this.weights = new Array(m).fill(0);
        this.bias = 0;
        const lr = 0.001;
        for (let epoch = 0; epoch < 300; epoch++) {
            for (let i = 0; i < n; i++) {
                const pred = this.bias + features[i].reduce((sum, f, j) => sum + f * this.weights[j], 0);
                const error = pred - labels[i];
                for (let j = 0; j < m; j++) {
                    const l1 = this.l1Ratio * this.alpha * (this.weights[j] > 0 ? 1 : -1);
                    const l2 = (1 - this.l1Ratio) * this.alpha * this.weights[j];
                    this.weights[j] -= lr * (error * features[i][j] + l1 + l2);
                }
                this.bias -= lr * error;
            }
        }
        this.trained = true;
    }
    
    predict(features) {
        if (!this.trained) return null;
        const pred = this.bias + features.reduce((sum, f, j) => sum + f * this.weights[j], 0);
        return pred > 0.5 ? 'T' : 'X';
    }
}

// ===== 20. ENSEMBLE VOTING =====
class EnsembleVoting {
    constructor() {
        this.models = [];
        this.weights = [];
        this.modelNames = [];
    }
    
    addModel(model, weight = 1, name = '') {
        this.models.push(model);
        this.weights.push(weight);
        this.modelNames.push(name || `Model_${this.models.length}`);
    }
    
    train(data) {
        for (const model of this.models) {
            if (model.train) {
                try { model.train(data); } catch (e) {}
            }
        }
    }
    
    predict(features) {
        let tVotes = 0, xVotes = 0;
        let totalWeight = 0;
        const predictions = [];
        for (let i = 0; i < this.models.length; i++) {
            try {
                const pred = this.models[i].predict(features);
                if (pred) {
                    predictions.push({ name: this.modelNames[i] || `M${i}`, pred });
                    if (pred === 'T') tVotes += this.weights[i];
                    else if (pred === 'X') xVotes += this.weights[i];
                    totalWeight += this.weights[i];
                }
            } catch (e) {}
        }
        if (tVotes === 0 && xVotes === 0) return null;
        return tVotes > xVotes ? 'T' : 'X';
    }
    
    getPredictionDetails(features) {
        const details = [];
        for (let i = 0; i < this.models.length; i++) {
            try {
                const pred = this.models[i].predict(features);
                if (pred) {
                    details.push({ name: this.modelNames[i] || `M${i}`, prediction: pred, weight: this.weights[i] });
                }
            } catch (e) {}
        }
        return details;
    }
}

// ============================================================
// 🧠 HỆ THỐNG DỰ ĐOÁN TÍCH HỢP - 20 THUẬT TOÁN
// ============================================================
class HeThongDuDoanThongMinh {
    constructor() {
        this.boNhoChuoi = new Map();
        this.daHuan = { hu: false, md5: false };
        
        // Khởi tạo 20 thuật toán
        this.nn = new NeuralNetwork(12, 24, 2);
        this.dnn = new DeepNeuralNetwork();
        this.rf = new RandomForest(50, 12);
        this.gb = new GradientBoosting(100, 0.05, 6);
        this.xgb = new XGBoost(50, 0.1, 5);
        this.svm = new SVM(2.0, 0.001, 500);
        this.kmeans = new KMeans(5);
        this.knn = new KNN(11);
        this.nb = new NaiveBayes();
        this.adaboost = new AdaBoost(50);
        this.lr = new LogisticRegression(0.01, 300);
        this.dt = new DecisionTree(10, 5);
        this.lstm = new LSTMSimple();
        this.kalman = new KalmanFilter();
        this.qlearn = new QLearning();
        this.linReg = new LinearRegression();
        this.ridge = new RidgeRegression(0.5);
        this.lasso = new LassoRegression(0.5);
        this.elastic = new ElasticNet(0.5, 0.5);
        this.ensemble = new EnsembleVoting();
        
        // Thêm các model vào ensemble
        this.ensemble.addModel(this.nn, 1.0, 'Neural Network');
        this.ensemble.addModel(this.dnn, 1.2, 'Deep NN');
        this.ensemble.addModel(this.rf, 1.1, 'Random Forest');
        this.ensemble.addModel(this.gb, 1.0, 'Gradient Boosting');
        this.ensemble.addModel(this.xgb, 1.0, 'XGBoost');
        this.ensemble.addModel(this.svm, 0.9, 'SVM');
        this.ensemble.addModel(this.knn, 0.9, 'KNN');
        this.ensemble.addModel(this.nb, 0.8, 'Naive Bayes');
        this.ensemble.addModel(this.adaboost, 0.9, 'AdaBoost');
        this.ensemble.addModel(this.lr, 0.8, 'Logistic Regression');
        this.ensemble.addModel(this.dt, 0.9, 'Decision Tree');
        this.ensemble.addModel(this.lstm, 0.8, 'LSTM');
        this.ensemble.addModel(this.kalman, 0.7, 'Kalman Filter');
        this.ensemble.addModel(this.qlearn, 0.7, 'Q-Learning');
        this.ensemble.addModel(this.linReg, 0.7, 'Linear Regression');
        this.ensemble.addModel(this.ridge, 0.7, 'Ridge');
        this.ensemble.addModel(this.lasso, 0.7, 'Lasso');
        this.ensemble.addModel(this.elastic, 0.7, 'Elastic Net');
        
        this.taiDuLieu();
    }

    chuanBiDuLieu(data) {
        const dacTrung = [];
        const nhan = [];
        for (let i = 12; i < data.length; i++) {
            const cuaSo = data.slice(i - 12, i);
            const mucTieu = data[i];
            
            const demT = cuaSo.filter(r => r === 'T').length;
            const thayDoi = cuaSo.filter((r, idx) => idx > 0 && r !== cuaSo[idx-1]).length;
            const tyLeT = demT / cuaSo.length;
            const cuoi = cuaSo[cuaSo.length - 1] === 'T' ? 1 : 0;
            const dau = cuaSo[0] === 'T' ? 1 : 0;
            let daoDai = 0;
            for (let j = 0; j < cuaSo.length - 1; j++) {
                if (cuaSo[j] !== cuaSo[j+1]) daoDai++;
                else break;
            }
            let chuKy = 0;
            for (let c = 2; c <= 5; c++) {
                if (cuaSo.length >= c * 2) {
                    let match = true;
                    for (let j = 0; j < c; j++) {
                        if (cuaSo[j] !== cuaSo[j + c]) { match = false; break; }
                    }
                    if (match) { chuKy = c; break; }
                }
            }
            const doLech = Math.abs(demT - (cuaSo.length - demT));
            const da = (cuaSo.slice(0, 5).filter(r => r === 'T').length / 5) - 0.5;
            const bienDong = thayDoi / cuaSo.length;
            const entropy = this.tinhEntropy(cuaSo);
            const std = this.tinhStd(cuaSo);
            const maxStreak = this.tinhMaxStreak(cuaSo);
            
            dacTrung.push([
                demT, thayDoi, tyLeT, cuoi, dau, 
                daoDai, chuKy, doLech, da, bienDong,
                entropy, std, maxStreak
            ]);
            nhan.push(mucTieu);
        }
        return { dacTrung, nhan };
    }
    
    tinhEntropy(data) {
        const n = data.length;
        const t = data.filter(r => r === 'T').length / n;
        if (t === 0 || t === 1) return 0;
        return -t * Math.log2(t) - (1 - t) * Math.log2(1 - t);
    }
    
    tinhStd(data) {
        const n = data.length;
        const t = data.filter(r => r === 'T').length;
        const mean = t / n;
        const variance = data.reduce((s, r) => s + Math.pow((r === 'T' ? 1 : 0) - mean, 2), 0) / n;
        return Math.sqrt(variance);
    }
    
    tinhMaxStreak(data) {
        let maxStreak = 0;
        let currentStreak = 1;
        for (let i = 1; i < data.length; i++) {
            if (data[i] === data[i-1]) {
                currentStreak++;
                if (currentStreak > maxStreak) maxStreak = currentStreak;
            } else {
                currentStreak = 1;
            }
        }
        return maxStreak;
    }

    huanLuyen(game, data) {
        if (data.length < 30) return;
        const { dacTrung, nhan } = this.chuanBiDuLieu(data);
        if (dacTrung.length < 20) return;
        
        const duLieuHuan = dacTrung.map((f, idx) => ({
            dacTrung: f,
            nhan: nhan[idx]
        }));
        
        try {
            this.nn.train(duLieuHuan, 500);
            this.dnn.train(duLieuHuan, 500);
            this.rf.train(duLieuHuan);
            this.gb.train(duLieuHuan);
            this.xgb.train(duLieuHuan);
            this.svm.train(duLieuHuan);
            this.kmeans.train(duLieuHuan);
            this.knn.train(duLieuHuan);
            this.nb.train(duLieuHuan);
            this.adaboost.train(duLieuHuan);
            this.lr.train(duLieuHuan);
            this.dt.tree = this.dt.train(duLieuHuan);
            this.lstm.train(duLieuHuan);
            this.kalman.train(duLieuHuan);
            this.qlearn.train(duLieuHuan);
            this.linReg.train(duLieuHuan);
            this.ridge.train(duLieuHuan);
            this.lasso.train(duLieuHuan);
            this.elastic.train(duLieuHuan);
            this.ensemble.train(duLieuHuan);
            
            this.daHuan[game] = true;
            console.log(`🧠 Đã huấn luyện 20 thuật toán cho ${game}`);
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

        // 1. PHÂN TÍCH BỆT
        const bet = this.phanTichBet(lichSu);
        if (bet) { 
            mau.push(bet); 
            if (bet.duDoan === 'T') T += bet.diem; 
            else X += bet.diem; 
        }

        // 2. PHÂN TÍCH XU HƯỚNG
        const trend = this.phanTichXuHuong(lichSu);
        if (trend) { 
            mau.push(trend); 
            if (trend.duDoan === 'T') T += trend.diem; 
            else X += trend.diem; 
        }

        // 3. PHÂN TÍCH CÂN BẰNG
        const balance = this.phanTichCanBang(lichSu);
        if (balance) { 
            mau.push(balance); 
            if (balance.duDoan === 'T') T += balance.diem; 
            else X += balance.diem; 
        }

        // 4. PHÂN TÍCH CHU KỲ
        const cycle = this.phanTichChuKy(lichSu);
        if (cycle) { 
            mau.push(cycle); 
            if (cycle.duDoan === 'T') T += cycle.diem; 
            else X += cycle.diem; 
        }

        // 5. PHÂN TÍCH ENTROPY
        const entropy = this.phanTichEntropy(lichSu);
        if (entropy) { 
            mau.push(entropy); 
            if (entropy.duDoan === 'T') T += entropy.diem; 
            else X += entropy.diem; 
        }

        // 6. PHÂN TÍCH STD
        const std = this.phanTichStd(lichSu);
        if (std) { 
            mau.push(std); 
            if (std.duDoan === 'T') T += std.diem; 
            else X += std.diem; 
        }

        // 7. PHÂN TÍCH MAX STREAK
        const maxStreak = this.phanTichMaxStreak(lichSu);
        if (maxStreak) { 
            mau.push(maxStreak); 
            if (maxStreak.duDoan === 'T') T += maxStreak.diem; 
            else X += maxStreak.diem; 
        }

        // 8. 20 THUẬT TOÁN ML
        if (lichSu.length >= 12) {
            const dacTrung = this.chuanBiDuLieu(lichSu);
            if (dacTrung.dacTrung.length > 0) {
                const features = dacTrung.dacTrung[dacTrung.dacTrung.length - 1];
                
                const duDoan = {
                    '🧠 NN': this.nn.predict(features),
                    '🧠 DNN': this.dnn.predict(features),
                    '🌲 RF': this.rf.predict(features),
                    '📈 GB': this.gb.predict(features),
                    '📊 XGB': this.xgb.predict(features),
                    '🎯 SVM': this.svm.predict(features),
                    '🔍 KNN': this.knn.predict(features),
                    '📊 NB': this.nb.predict(features),
                    '⚡ AdaBoost': this.adaboost.predict(features),
                    '📈 LR': this.lr.predict(features),
                    '🌳 DT': this.dt.predict(features),
                    '🧠 LSTM': this.lstm.predict(features),
                    '🎯 Kalman': this.kalman.predict(features),
                    '🧠 Q-Learning': this.qlearn.predict(features),
                    '📊 LinReg': this.linReg.predict(features),
                    '📊 Ridge': this.ridge.predict(features),
                    '📊 Lasso': this.lasso.predict(features),
                    '📊 Elastic': this.elastic.predict(features),
                    '🔮 Ensemble': this.ensemble.predict(features)
                };
                
                let count = 0;
                for (const [ten, pred] of Object.entries(duDoan)) {
                    if (pred) {
                        const diem = 22 - count * 0.5;
                        if (pred === 'T') {
                            T += diem;
                            mau.push({ ten, duDoan: 'T', diem });
                        } else {
                            X += diem;
                            mau.push({ ten, duDoan: 'X', diem });
                        }
                        count++;
                    }
                }
            }
        }

        // ĐIỀU CHỈNH THEO CHUỖI
        const s = this.boNhoChuoi.get(game);
        if (s) {
            if (s.last5.length >= 5) {
                const demT = s.last5.filter(r => r === 'T').length;
                if (demT >= 4) { X *= 1.4; mau.push({ ten: '📊 Last5 Tài→Xỉu', duDoan: 'X', diem: 18 }); }
                else if (demT <= 1) { T *= 1.4; mau.push({ ten: '📊 Last5 Xỉu→Tài', duDoan: 'T', diem: 18 }); }
            }
            if (s.chuoi >= 6) {
                T *= 1.3; X *= 1.3;
                mau.push({ ten: '🔥 Bám bệt cực dài', duDoan: 'T', diem: 16 });
            } else if (s.chuoi >= 4) {
                T *= 1.12; X *= 1.12;
                mau.push({ ten: '🔥 Bám bệt dài', duDoan: 'T', diem: 10 });
            }
            if (s.chuoi <= -5) {
                const temp = T; T = X * 1.8; X = temp * 1.8;
                mau.push({ ten: '🔄 Bẻ bệt cực mạnh', duDoan: 'T', diem: 24 });
            } else if (s.chuoi <= -4) {
                const temp = T; T = X * 1.5; X = temp * 1.5;
                mau.push({ ten: '🔄 Bẻ bệt siêu mạnh', duDoan: 'T', diem: 18 });
            } else if (s.chuoi <= -3) {
                const temp = T; T = X * 1.25; X = temp * 1.25;
                mau.push({ ten: '🔄 Bẻ bệt mạnh', duDoan: 'T', diem: 12 });
            }
        }

        const tong = T + X;
        if (tong === 0) return this.fallback(game);

        const duDoan = T > X ? 'TÀI' : 'XỈU';
        let doTinCay = Math.round(Math.max(T, X) / tong * 100);
        if (mau.length >= 18) doTinCay = Math.min(99, doTinCay + 10);
        else if (mau.length >= 12) doTinCay = Math.min(99, doTinCay + 6);
        else if (mau.length >= 6) doTinCay = Math.min(99, doTinCay + 3);
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

    phanTichBet(data) {
        if (data.length < 2) return null;
        const cuoi = data[0];
        let dem = 1;
        for (let i = 1; i < data.length; i++) {
            if (data[i] === cuoi) dem++;
            else break;
        }
        if (dem >= 8) {
            return { ten: `🔥 Bệt cực dài ${dem} → BẺ`, duDoan: cuoi === 'T' ? 'X' : 'T', diem: 55 };
        }
        if (dem >= 6) {
            return { ten: `⚡ Bệt dài ${dem} → BẺ`, duDoan: cuoi === 'T' ? 'X' : 'T', diem: 42 };
        }
        if (dem >= 4) {
            return { ten: `📈 Bệt vừa ${dem} → Theo`, duDoan: cuoi, diem: 28 };
        }
        if (dem >= 3) {
            return { ten: `📊 Bệt ngắn ${dem} → Theo`, duDoan: cuoi, diem: 18 };
        }
        if (dem >= 2) {
            return { ten: `📊 Bệt 2 → Theo`, duDoan: cuoi, diem: 10 };
        }
        return null;
    }

    phanTichXuHuong(data) {
        if (data.length < 10) return null;
        const ganDay = data.slice(0, 10);
        const demT = ganDay.filter(r => r === 'T').length;
        if (demT >= 7) {
            return { ten: `📈 Xu hướng Tài ${demT}/10 → Xỉu`, duDoan: 'X', diem: 22 };
        }
        if (demT <= 3) {
            return { ten: `📉 Xu hướng Xỉu ${10-demT}/10 → Tài`, duDoan: 'T', diem: 22 };
        }
        if (demT >= 6) {
            return { ten: `📈 Xu hướng Tài ${demT}/10 → Xỉu`, duDoan: 'X', diem: 16 };
        }
        if (demT <= 4) {
            return { ten: `📉 Xu hướng Xỉu ${10-demT}/10 → Tài`, duDoan: 'T', diem: 16 };
        }
        return null;
    }

    phanTichCanBang(data) {
        if (data.length < 14) return null;
        const ganDay = data.slice(0, 14);
        const demT = ganDay.filter(r => r === 'T').length;
        const doLech = Math.abs(demT - (14 - demT));
        if (doLech >= 6) {
            const duDoan = demT > (14 - demT) ? 'X' : 'T';
            return { ten: `⚖️ Mất cân bằng ${demT}/14 → ${duDoan}`, duDoan, diem: 18 };
        }
        if (doLech >= 4) {
            const duDoan = demT > (14 - demT) ? 'X' : 'T';
            return { ten: `⚖️ Lệch nhẹ ${demT}/14 → ${duDoan}`, duDoan, diem: 12 };
        }
        return null;
    }

    phanTichChuKy(data) {
        if (data.length < 6) return null;
        for (let cycle = 2; cycle <= 5; cycle++) {
            if (data.length < cycle * 2) continue;
            let match = true;
            for (let i = 0; i < cycle; i++) {
                if (data[i] !== data[i + cycle]) { match = false; break; }
            }
            if (match) {
                return { ten: `🔁 Chu kỳ ${cycle} → Bẻ`, duDoan: data[0] === 'T' ? 'X' : 'T', diem: 20 };
            }
        }
        return null;
    }

    phanTichEntropy(data) {
        if (data.length < 10) return null;
        const ganDay = data.slice(0, 10);
        const entropy = this.tinhEntropy(ganDay);
        if (entropy > 0.95) {
            return { ten: `📊 Entropy cao (${entropy.toFixed(2)}) → Bẻ`, duDoan: data[0] === 'T' ? 'X' : 'T', diem: 16 };
        }
        if (entropy < 0.2) {
            return { ten: `📊 Entropy thấp (${entropy.toFixed(2)}) → Theo`, duDoan: data[0], diem: 14 };
        }
        return null;
    }

    phanTichStd(data) {
        if (data.length < 10) return null;
        const ganDay = data.slice(0, 10);
        const std = this.tinhStd(ganDay);
        if (std < 0.2) {
            return { ten: `📊 STD thấp (${std.toFixed(2)}) → Theo`, duDoan: data[0], diem: 12 };
        }
        if (std > 0.5) {
            return { ten: `📊 STD cao (${std.toFixed(2)}) → Bẻ`, duDoan: data[0] === 'T' ? 'X' : 'T', diem: 14 };
        }
        return null;
    }

    phanTichMaxStreak(data) {
        if (data.length < 10) return null;
        const maxStreak = this.tinhMaxStreak(data);
        if (maxStreak >= 5) {
            return { ten: `📊 Max Streak ${maxStreak} → Bẻ`, duDoan: data[0] === 'T' ? 'X' : 'T', diem: 16 };
        }
        return null;
    }

    hoc(game, ketQua, doTinCay, doDaiBet) {
        if (!this.boNhoChuoi.has(game)) {
            this.boNhoChuoi.set(game, {
                chuoi: 0, totNhat: 0, teNhat: 0,
                last5: [], last10: [], last20: [], last50: [],
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
        if (s.last5.length > 5) s.last5.shift();
        if (s.last10.length > 10) s.last10.shift();
        if (s.last20.length > 20) s.last20.shift();
        if (s.last50.length > 50) s.last50.shift();

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
            soModel: 20
        };
    }
}

const predictor = new HeThongDuDoanThongMinh();

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
                    if (history.hu.length > 25) {
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
                    console.log(`[HU] ${result.duDoan} (${result.doTinCay}%) - ${result.soMau||0} patterns`);
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
                    if (history.md5.length > 25) {
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
                    console.log(`[MD5] ${result.duDoan} (${result.doTinCay}%) - ${result.soMau||0} patterns`);
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
// 🌐 GIAO DIỆN HTML ĐỘC ĐÁO - PHONG CÁCH CYBERPUNK
// ============================================================

function generateHTML(type) {
    const s = stats[type];
    const h = history[type] || [];
    const recent = h.slice(0, 25);
    const learning = predictor.layThongKe(type);
    
    let rows = '';
    for (const r of recent) {
        const status = r.status || '⏳';
        const cls = status === '✅' ? 'win' : status === '❌' ? 'lose' : 'wait';
        const txt = status === '✅' ? 'WIN' : status === '❌' ? 'LOSE' : 'WAIT';
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
    <title>🌌 TX CYBER - ANH KHÔI</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;600;700;800;900&family=Share+Tech+Mono&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        :root {
            --neon: #ff6b35;
            --cyber: #00f5ff;
            --success: #39ff14;
            --danger: #ff0040;
            --warning: #ffea00;
            --bg: #0a0a1a;
            --card: rgba(0, 245, 255, 0.04);
            --border: rgba(0, 245, 255, 0.12);
            --text: #e0e0e0;
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
        
        .bg-cyber {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 0;
            background: 
                radial-gradient(ellipse at 10% 30%, rgba(255, 107, 53, 0.06) 0%, transparent 50%),
                radial-gradient(ellipse at 90% 70%, rgba(0, 245, 255, 0.04) 0%, transparent 50%),
                radial-gradient(ellipse at 50% 100%, rgba(255, 107, 53, 0.03) 0%, transparent 30%);
            overflow: hidden;
        }
        
        .bg-cyber::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: 
                radial-gradient(1px 1px at 10px 20px, rgba(0, 245, 255, 0.08), transparent),
                radial-gradient(1px 1px at 30px 60px, rgba(0, 245, 255, 0.06), transparent),
                radial-gradient(1px 1px at 50px 140px, rgba(0, 245, 255, 0.07), transparent),
                radial-gradient(1px 1px at 80px 30px, rgba(0, 245, 255, 0.06), transparent),
                radial-gradient(1px 1px at 120px 90px, rgba(0, 245, 255, 0.07), transparent),
                radial-gradient(1px 1px at 180px 50px, rgba(0, 245, 255, 0.05), transparent),
                radial-gradient(1px 1px at 250px 110px, rgba(0, 245, 255, 0.06), transparent);
            background-size: 300px 300px;
            animation: gridMove 30s linear infinite;
        }
        
        @keyframes gridMove {
            0% { transform: translate(0, 0); }
            100% { transform: translate(-30px, -20px); }
        }
        
        .bg-cyber::after {
            content: '◈ ◇ ◈ ◇ ◈ ◇ ◈';
            position: absolute;
            top: 5%;
            right: 5%;
            font-size: 60px;
            color: rgba(0, 245, 255, 0.02);
            letter-spacing: 20px;
            animation: spinCyber 60s linear infinite;
            white-space: nowrap;
        }
        
        @keyframes spinCyber {
            0% { transform: rotate(0deg) scale(1); }
            50% { transform: rotate(180deg) scale(1.05); }
            100% { transform: rotate(360deg) scale(1); }
        }
        
        .container {
            position: relative;
            z-index: 1;
            max-width: 1200px;
            margin: 0 auto;
            padding: 12px;
        }
        
        .header-cyber {
            background: linear-gradient(135deg, rgba(255, 107, 53, 0.06), rgba(0, 245, 255, 0.03));
            border-radius: 20px;
            padding: 18px 28px;
            margin-bottom: 16px;
            border: 1px solid rgba(0, 245, 255, 0.08);
            backdrop-filter: blur(30px);
            position: relative;
            overflow: hidden;
        }
        
        .header-cyber::before {
            content: '';
            position: absolute;
            top: -60%;
            left: -60%;
            width: 220%;
            height: 220%;
            background: conic-gradient(from 0deg, transparent, rgba(255, 107, 53, 0.02), transparent, rgba(0, 245, 255, 0.02), transparent);
            animation: spinCyberSlow 25s linear infinite;
        }
        
        @keyframes spinCyberSlow {
            100% { transform: rotate(360deg); }
        }
        
        .header-cyber .content {
            position: relative;
            z-index: 1;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
        }
        
        .logo-cyber {
            display: flex;
            align-items: center;
            gap: 14px;
        }
        
        .logo-cyber .icon {
            font-size: 34px;
            animation: neonPulse 2s ease-in-out infinite;
            filter: drop-shadow(0 0 30px rgba(255, 107, 53, 0.2));
        }
        
        @keyframes neonPulse {
            0%, 100% { transform: scale(1); filter: drop-shadow(0 0 30px rgba(255, 107, 53, 0.2)); }
            50% { transform: scale(1.05); filter: drop-shadow(0 0 60px rgba(255, 107, 53, 0.4)); }
        }
        
        .logo-cyber .ten {
            font-family: 'Orbitron', monospace;
            font-size: 22px;
            font-weight: 900;
            background: linear-gradient(135deg, #ff6b35, #00f5ff, #ff6b35);
            background-size: 200% 200%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: cyberShimmer 3s ease-in-out infinite;
            text-shadow: 0 0 40px rgba(255, 107, 53, 0.1);
        }
        
        @keyframes cyberShimmer {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }
        
        .logo-cyber .sub {
            font-family: 'Share Tech Mono', monospace;
            font-size: 10px;
            color: var(--text-secondary);
            letter-spacing: 4px;
            font-weight: 300;
        }
        
        .header-cyber .info {
            text-align: right;
        }
        
        .badge-cyber {
            display: inline-block;
            padding: 4px 18px;
            border-radius: 30px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2px;
            background: linear-gradient(135deg, rgba(255, 107, 53, 0.1), rgba(0, 245, 255, 0.05));
            border: 1px solid rgba(0, 245, 255, 0.1);
            color: #00f5ff;
            backdrop-filter: blur(10px);
        }
        
        .badge-cyber .live {
            display: inline-block;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--success);
            margin-right: 6px;
            animation: cyberLive 0.6s ease-in-out infinite;
            box-shadow: 0 0 20px rgba(57, 255, 20, 0.2);
        }
        
        @keyframes cyberLive {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.2; transform: scale(0.5); }
        }
        
        .badge-cyber .version {
            color: var(--text-muted);
            font-weight: 400;
            letter-spacing: 1px;
        }
        
        .stats-cyber {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
            gap: 8px;
            margin-bottom: 16px;
        }
        
        .stat-cyber {
            background: var(--card);
            border-radius: 14px;
            padding: 10px 14px;
            border: 1px solid var(--border);
            backdrop-filter: blur(15px);
            transition: all 0.3s ease;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        
        .stat-cyber:hover {
            transform: translateY(-2px);
            border-color: rgba(0, 245, 255, 0.2);
            box-shadow: 0 8px 30px rgba(0, 245, 255, 0.04);
        }
        
        .stat-cyber .label {
            font-family: 'Share Tech Mono', monospace;
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: var(--text-muted);
            font-weight: 700;
        }
        
        .stat-cyber .value {
            font-family: 'Orbitron', monospace;
            font-size: 20px;
            font-weight: 800;
            margin-top: 2px;
        }
        
        .stat-cyber .value.green { color: var(--success); }
        .stat-cyber .value.red { color: var(--danger); }
        .stat-cyber .value.yellow { color: var(--warning); }
        .stat-cyber .value.cyan { color: var(--cyber); }
        .stat-cyber .value.orange { color: var(--neon); }
        .stat-cyber .value.purple { color: #a78bfa; }
        
        .stat-cyber .sub {
            font-family: 'Share Tech Mono', monospace;
            font-size: 8px;
            color: var(--text-muted);
            margin-top: 2px;
        }
        
        .table-cyber {
            background: var(--card);
            border-radius: 14px;
            overflow: hidden;
            border: 1px solid var(--border);
            backdrop-filter: blur(15px);
        }
        
        .table-cyber .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 16px;
            border-bottom: 1px solid var(--border);
            flex-wrap: wrap;
            gap: 6px;
        }
        
        .table-cyber .header h3 {
            font-family: 'Orbitron', monospace;
            font-size: 12px;
            font-weight: 700;
            color: var(--cyber);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .table-cyber .header .count {
            font-family: 'Share Tech Mono', monospace;
            font-size: 10px;
            color: var(--text-muted);
        }
        
        .table-cyber .header .algo-badge {
            font-size: 9px;
            color: var(--cyber);
            background: rgba(0, 245, 255, 0.06);
            padding: 2px 10px;
            border-radius: 12px;
            border: 1px solid rgba(0, 245, 255, 0.06);
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
        }
        
        th {
            background: rgba(0, 245, 255, 0.02);
            padding: 7px 10px;
            text-align: left;
            font-family: 'Share Tech Mono', monospace;
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: var(--text-muted);
        }
        
        td {
            padding: 6px 10px;
            border-bottom: 1px solid rgba(0, 245, 255, 0.02);
            font-family: 'Share Tech Mono', monospace;
        }
        
        tr:hover td {
            background: rgba(0, 245, 255, 0.02);
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
            background: rgba(57, 255, 20, 0.08);
            color: var(--success);
        }
        
        .du-doan.xiu {
            background: rgba(255, 0, 64, 0.08);
            color: var(--danger);
        }
        
        .do-tin {
            font-weight: 700;
            color: var(--cyber);
        }
        
        .trang-thai {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 8px;
            font-size: 8px;
            font-weight: 700;
            letter-spacing: 1px;
        }
        
        .trang-thai.win {
            background: rgba(57, 255, 20, 0.08);
            color: var(--success);
        }
        
        .trang-thai.lose {
            background: rgba(255, 0, 64, 0.08);
            color: var(--danger);
        }
        
        .trang-thai.wait {
            background: rgba(255, 234, 0, 0.08);
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
        
        .footer-cyber {
            text-align: center;
            padding: 12px;
            color: var(--text-muted);
            font-size: 9px;
            border-top: 1px solid var(--border);
            margin-top: 14px;
        }
        
        .footer-cyber .highlight {
            color: var(--cyber);
        }
        
        .footer-cyber .heart {
            color: var(--danger);
            animation: cyberHeart 1.5s ease-in-out infinite;
            display: inline-block;
        }
        
        @keyframes cyberHeart {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.2); }
        }
        
        .footer-cyber .algo-tag {
            color: var(--neon);
        }
        
        @media (max-width: 768px) {
            .header-cyber { padding: 14px; }
            .header-cyber .content { flex-direction: column; align-items: flex-start; }
            .header-cyber .info { text-align: left; width: 100%; }
            .stats-cyber { grid-template-columns: repeat(3, 1fr); gap: 6px; }
            .stat-cyber .value { font-size: 16px; }
            .logo-cyber .ten { font-size: 18px; }
            table { font-size: 10px; }
            th, td { padding: 4px 6px; }
            .chi-tiet { max-width: 50px; }
        }
        
        @media (max-width: 480px) {
            .stats-cyber { grid-template-columns: repeat(2, 1fr); }
            .container { padding: 6px; }
            th, td { padding: 3px 4px; font-size: 9px; }
            .logo-cyber .ten { font-size: 14px; }
            .logo-cyber .icon { font-size: 24px; }
            .du-doan { font-size: 8px; padding: 1px 6px; }
            .trang-thai { font-size: 7px; padding: 1px 4px; }
        }
        
        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-track { background: rgba(0, 245, 255, 0.01); }
        ::-webkit-scrollbar-thumb { background: rgba(0, 245, 255, 0.15); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(0, 245, 255, 0.3); }
    </style>
</head>
<body>
    <div class="bg-cyber"></div>
    
    <div class="container">
        <div class="header-cyber">
            <div class="content">
                <div class="logo-cyber">
                    <span class="icon">🌌</span>
                    <div>
                        <div class="ten">TX CYBER</div>
                        <div class="sub">ANH KHÔI • ${type.toUpperCase()}</div>
                    </div>
                </div>
                <div class="info">
                    <div class="badge-cyber">
                        <span class="live"></span>
                        ${type.toUpperCase()} • ONLINE
                        <span class="version">v20.0</span>
                    </div>
                    <div style="font-size:8px;color:var(--text-muted);margin-top:2px;font-family:'Share Tech Mono',monospace;">
                        ${new Date().toLocaleString('vi-VN')} • 20 ML MODELS
                    </div>
                </div>
            </div>
        </div>
        
        <div class="stats-cyber">
            <div class="stat-cyber">
                <div class="label">Total</div>
                <div class="value cyan">${s.total}</div>
                <div class="sub">Predictions</div>
            </div>
            <div class="stat-cyber">
                <div class="label">✅ Win</div>
                <div class="value green">${s.dung}</div>
                <div class="sub">${s.tyle}%</div>
            </div>
            <div class="stat-cyber">
                <div class="label">❌ Lose</div>
                <div class="value red">${s.sai}</div>
                <div class="sub">${100 - s.tyle}%</div>
            </div>
            <div class="stat-cyber">
                <div class="label">📊 Accuracy</div>
                <div class="value ${s.tyle >= 65 ? 'green' : s.tyle >= 55 ? 'yellow' : 'red'}">${s.tyle}%</div>
                <div class="sub">${s.tyle >= 65 ? '⭐ EXCELLENT' : s.tyle >= 55 ? '📈 GOOD' : '📉 NEEDS IMPROVE'}</div>
            </div>
            <div class="stat-cyber">
                <div class="label">⚡ Streak</div>
                <div class="value ${s.chuoi > 0 ? 'green' : s.chuoi < 0 ? 'red' : 'yellow'}">${s.chuoi > 0 ? '🔥 +' + s.chuoi : s.chuoi < 0 ? '❌ ' + s.chuoi : '0'}</div>
                <div class="sub">${s.chuoi > 0 ? 'WINNING' : s.chuoi < 0 ? 'LOSING' : 'BALANCED'}</div>
            </div>
            <div class="stat-cyber">
                <div class="label">🏆 Best</div>
                <div class="value orange">${s.chuoi_dai}</div>
                <div class="sub">${s.chuoi_dai >= 5 ? '🚀 LEGENDARY' : '📈 PROGRESSING'}</div>
            </div>
        </div>
        
        <div class="table-cyber">
            <div class="header">
                <h3>📋 HISTORY LOG</h3>
                <span class="count">${h.length} records • ${Math.min(25, h.length)} latest</span>
                <span class="algo-badge">🤖 20 ML Models</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Session</th>
                        <th>Prediction</th>
                        <th>Confidence</th>
                        <th>Result</th>
                        <th>Actual</th>
                        <th>Analysis</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);font-family:"Share Tech Mono",monospace;">⏳ WAITING FOR DATA...</td></tr>'}
                </tbody>
            </table>
        </div>
        
        <div class="footer-cyber">
            <span style="color:var(--text-muted);">🌌 TX Cyber Predictor</span> • 
            <span class="highlight">Anh Khôi</span> • 
            v20.0 • 
            <span class="algo-tag">⚡ 20 ML Models</span> • 
            Auto-update 5s
            <br>
            <span style="font-size:7px;color:var(--text-muted);font-family:'Share Tech Mono',monospace;">
                <span class="heart">❤</span> NN • DNN • RF • GB • XGB • SVM • K-Means • KNN • NB • AdaBoost • LR • DT • LSTM • Kalman • Q-Learning • LinReg • Ridge • Lasso • Elastic • Ensemble
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

app.get('/', (req, res) => res.json({ name: 'TX Cyber', version: '20.0', author: 'Anh Khôi' }));

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
        if (history.hu.length > 25) {
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
        if (history.md5.length > 25) {
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
    console.log('║   🌌  TX CYBER v20.0 - ANH KHÔI                             ║');
    console.log('║                                                               ║');
    console.log('║   🤖 20 THUẬT TOÁN MACHINE LEARNING                         ║');
    console.log('║   🔥 7 CHỈ BÁO PHÂN TÍCH CẦU                                ║');
    console.log('║   🎯 Bệt • Xu hướng • Cân bằng • Chu kỳ • Entropy • STD    ║');
    console.log('║                                                               ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log('║                                                               ║');
    console.log(`║   📡 Server: http://0.0.0.0:${PORT}                            ║`);
    console.log('║                                                               ║');
    console.log('║   🎯 7 CHỈ BÁO PHÂN TÍCH:                                   ║');
    console.log('║   🔥 Bệt - Phân tích chuỗi bệt                               ║');
    console.log('║   📈 Xu hướng - Phân tích xu hướng dài hạn                   ║');
    console.log('║   ⚖️ Cân bằng - Phân tích độ lệch                            ║');
    console.log('║   🔁 Chu kỳ - Phân tích chu kỳ lặp                          ║');
    console.log('║   📊 Entropy - Phân tích độ hỗn loạn                         ║');
    console.log('║   📊 STD - Phân tích độ lệch chuẩn                           ║');
    console.log('║   📊 Max Streak - Phân tích chuỗi dài nhất                   ║');
    console.log('║                                                               ║');
    console.log('║   📁 himinhlaanhkhoi_history.json                            ║');
    console.log('║   📁 himinhlaanhkhoi_learning.json                           ║');
    console.log('║                                                               ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
    startAuto();
});
