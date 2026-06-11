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
const AUTO_SAVE_INTERVAL = 30000;
let lastProcessedPhien = { hu: null, md5: null };

// ==================== HỆ THỐNG DỰ ĐOÁN THẾ HỆ MỚI ====================

// 1. DEEP BELIEF NETWORK (DBN) - Mạng niềm tin sâu với Restricted Boltzmann Machines
class DeepBeliefNetwork {
  constructor(layers = [5, 8, 5, 3]) {
    this.layers = layers;
    this.rbms = [];
    this.weights = [];
    this.biasesVisible = [];
    this.biasesHidden = [];
    this.initializeNetwork();
  }

  initializeNetwork() {
    for (let i = 0; i < this.layers.length - 1; i++) {
      const visibleSize = this.layers[i];
      const hiddenSize = this.layers[i + 1];
      
      const weights = Array(visibleSize).fill().map(() => 
        Array(hiddenSize).fill().map(() => (Math.random() - 0.5) * 0.1)
      );
      
      this.weights.push(weights);
      this.biasesVisible.push(Array(visibleSize).fill(0));
      this.biasesHidden.push(Array(hiddenSize).fill(0));
      this.rbms.push({ weights, visibleBias: Array(visibleSize).fill(0), hiddenBias: Array(hiddenSize).fill(0) });
    }
  }

  sigmoid(x) { return 1 / (1 + Math.exp(-Math.max(-50, Math.min(50, x)))); }
  
  sampleProbability(prob) { return Math.random() < prob ? 1 : 0; }

  contrastiveDivergence(rbmIndex, data, learningRate = 0.01, k = 1) {
    const rbm = this.rbms[rbmIndex];
    const visibleSize = this.layers[rbmIndex];
    const hiddenSize = this.layers[rbmIndex + 1];
    
    const hiddenProb = Array(hiddenSize).fill();
    for (let j = 0; j < hiddenSize; j++) {
      let sum = rbm.hiddenBias[j];
      for (let i = 0; i < visibleSize; i++) {
        sum += data[i] * rbm.weights[i][j];
      }
      hiddenProb[j] = this.sigmoid(sum);
    }
    
    const hiddenState = hiddenProb.map(p => this.sampleProbability(p));
    
    let visibleProb = [...data];
    let currentHidden = [...hiddenState];
    
    for (let step = 0; step < k; step++) {
      for (let i = 0; i < visibleSize; i++) {
        let sum = rbm.visibleBias[i];
        for (let j = 0; j < hiddenSize; j++) {
          sum += currentHidden[j] * rbm.weights[i][j];
        }
        visibleProb[i] = this.sigmoid(sum);
      }
      
      for (let j = 0; j < hiddenSize; j++) {
        let sum = rbm.hiddenBias[j];
        for (let i = 0; i < visibleSize; i++) {
          sum += visibleProb[i] * rbm.weights[i][j];
        }
        currentHidden[j] = this.sigmoid(sum);
      }
    }
    
    for (let i = 0; i < visibleSize; i++) {
      for (let j = 0; j < hiddenSize; j++) {
        const gradient = data[i] * hiddenProb[j] - visibleProb[i] * currentHidden[j];
        rbm.weights[i][j] += learningRate * gradient;
      }
      rbm.visibleBias[i] += learningRate * (data[i] - visibleProb[i]);
    }
    
    for (let j = 0; j < hiddenSize; j++) {
      rbm.hiddenBias[j] += learningRate * (hiddenProb[j] - currentHidden[j]);
    }
  }

  pretrain(patterns, epochs = 10) {
    for (let epoch = 0; epoch < epochs; epoch++) {
      for (const pattern of patterns) {
        let currentData = pattern;
        for (let i = 0; i < this.rbms.length; i++) {
          this.contrastiveDivergence(i, currentData, 0.01, 1);
          
          const nextData = [];
          const rbm = this.rbms[i];
          const hiddenSize = this.layers[i + 1];
          for (let j = 0; j < hiddenSize; j++) {
            let sum = rbm.hiddenBias[j];
            for (let k = 0; k < currentData.length; k++) {
              sum += currentData[k] * rbm.weights[k][j];
            }
            nextData.push(this.sigmoid(sum));
          }
          currentData = nextData;
        }
      }
    }
  }

  fineTune(patterns, labels, learningRate = 0.005, epochs = 20) {
    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalError = 0;
      
      for (let idx = 0; idx < patterns.length; idx++) {
        const activations = [patterns[idx]];
        let currentData = patterns[idx];
        
        for (let i = 0; i < this.rbms.length; i++) {
          const nextData = [];
          const rbm = this.rbms[i];
          const hiddenSize = this.layers[i + 1];
          
          for (let j = 0; j < hiddenSize; j++) {
            let sum = rbm.hiddenBias[j];
            for (let k = 0; k < currentData.length; k++) {
              sum += currentData[k] * rbm.weights[k][j];
            }
            nextData.push(this.sigmoid(sum));
          }
          activations.push(nextData);
          currentData = nextData;
        }
        
        const output = activations[activations.length - 1];
        const target = labels[idx];
        let error = target - output[0];
        totalError += Math.abs(error);
        
        let deltas = [error * output[0] * (1 - output[0])];
        
        for (let i = this.rbms.length - 1; i >= 0; i--) {
          const newDeltas = [];
          const rbm = this.rbms[i];
          const currentActivations = activations[i];
          const nextDeltas = deltas[0];
          
          for (let j = 0; j < currentActivations.length; j++) {
            let delta = 0;
            for (let k = 0; k < nextDeltas.length; k++) {
              delta += nextDeltas[k] * rbm.weights[j][k];
            }
            delta *= currentActivations[j] * (1 - currentActivations[j]);
            newDeltas.push(delta);
            
            for (let k = 0; k < nextDeltas.length; k++) {
              rbm.weights[j][k] += learningRate * nextDeltas[k] * currentActivations[j];
            }
          }
          deltas = newDeltas;
        }
      }
      
      if (epoch % 5 === 0 && totalError / patterns.length < 0.1) break;
    }
  }

  predict(features) {
    let currentData = features;
    
    for (let i = 0; i < this.rbms.length; i++) {
      const nextData = [];
      const rbm = this.rbms[i];
      const hiddenSize = this.layers[i + 1];
      
      for (let j = 0; j < hiddenSize; j++) {
        let sum = rbm.hiddenBias[j];
        for (let k = 0; k < currentData.length; k++) {
          sum += currentData[k] * rbm.weights[k][j];
        }
        nextData.push(this.sigmoid(sum));
      }
      currentData = nextData;
    }
    
    const prediction = currentData[0] > 0.5 ? 'Tài' : 'Xỉu';
    const confidence = 50 + Math.abs(currentData[0] - 0.5) * 90;
    
    return { prediction, confidence: Math.min(95, confidence), name: 'DeepBelief' };
  }
}

// 2. ADAPTIVE NEURO-FUZZY INFERENCE SYSTEM (ANFIS)
class NeuroFuzzySystem {
  constructor(nRules = 5) {
    this.nRules = nRules;
    this.membershipParams = [];
    this.consequentParams = [];
    this.learningRate = 0.01;
    this.momentum = 0.9;
    this.prevGradients = {};
    this.initializeParameters();
  }

  initializeParameters() {
    for (let i = 0; i < this.nRules; i++) {
      this.membershipParams.push({
        mean: 0.2 + i * 0.15,
        sigma: 0.2 + Math.random() * 0.1
      });
      this.consequentParams.push({
        p0: Math.random() - 0.5,
        p1: Math.random() - 0.5,
        p2: Math.random() - 0.5
      });
    }
  }

  gaussianMembership(x, mean, sigma) {
    return Math.exp(-Math.pow(x - mean, 2) / (2 * Math.pow(sigma, 2)));
  }

  forwardPass(inputs) {
    const ruleFiringStrengths = [];
    
    for (let i = 0; i < this.nRules; i++) {
      let firingStrength = 1;
      for (let j = 0; j < inputs.length; j++) {
        const mu = this.gaussianMembership(inputs[j], this.membershipParams[i].mean, this.membershipParams[i].sigma);
        firingStrength *= mu;
      }
      ruleFiringStrengths.push(firingStrength);
    }
    
    const totalStrength = ruleFiringStrengths.reduce((a,b) => a+b, 1e-10);
    const normalizedStrengths = ruleFiringStrengths.map(s => s / totalStrength);
    
    let output = 0;
    for (let i = 0; i < this.nRules; i++) {
      const consequent = this.consequentParams[i].p0 + 
                         this.consequentParams[i].p1 * inputs[0] + 
                         this.consequentParams[i].p2 * inputs[1];
      output += normalizedStrengths[i] * consequent;
    }
    
    return { output, firingStrengths: ruleFiringStrengths, normalizedStrengths };
  }

  backwardPass(inputs, target, forwardResults) {
    const error = target - forwardResults.output;
    const gradients = { membership: [], consequent: [] };
    
    for (let i = 0; i < this.nRules; i++) {
      const consequentGrad = forwardResults.normalizedStrengths[i] * error;
      gradients.consequent.push({
        p0: consequentGrad,
        p1: consequentGrad * inputs[0],
        p2: consequentGrad * inputs[1]
      });
      
      let sumNormalized = 0;
      for (let j = 0; j < this.nRules; j++) {
        sumNormalized += forwardResults.firingStrengths[j];
      }
      
      const membershipGradBase = error * (this.consequentParams[i].p0 + 
        this.consequentParams[i].p1 * inputs[0] + 
        this.consequentParams[i].p2 * inputs[1] - forwardResults.output) / (sumNormalized * sumNormalized);
      
      for (let j = 0; j < inputs.length; j++) {
        const mu = this.gaussianMembership(inputs[j], this.membershipParams[i].mean, this.membershipParams[i].sigma);
        const gradMean = membershipGradBase * forwardResults.firingStrengths[i] * mu * (inputs[j] - this.membershipParams[i].mean) / Math.pow(this.membershipParams[i].sigma, 2);
        const gradSigma = membershipGradBase * forwardResults.firingStrengths[i] * mu * Math.pow(inputs[j] - this.membershipParams[i].mean, 2) / Math.pow(this.membershipParams[i].sigma, 3);
        
        gradients.membership.push({ i, j, gradMean, gradSigma });
      }
    }
    
    for (let i = 0; i < this.nRules; i++) {
      const gradKey = `c_${i}`;
      const prevGrad = this.prevGradients[gradKey] || 0;
      const update = this.momentum * prevGrad - this.learningRate * gradients.consequent[i].p0;
      this.prevGradients[gradKey] = update;
      this.consequentParams[i].p0 += update;
      
      this.consequentParams[i].p1 -= this.learningRate * gradients.consequent[i].p1;
      this.consequentParams[i].p2 -= this.learningRate * gradients.consequent[i].p2;
    }
    
    for (const grad of gradients.membership) {
      const gradKey = `m_${grad.i}_${grad.j}`;
      const prevGrad = this.prevGradients[gradKey] || 0;
      const updateMean = this.momentum * prevGrad - this.learningRate * grad.gradMean;
      const updateSigma = this.momentum * prevGrad - this.learningRate * grad.gradSigma;
      this.prevGradients[gradKey] = updateMean;
      
      this.membershipParams[grad.i].mean += updateMean;
      this.membershipParams[grad.i].sigma += updateSigma;
      this.membershipParams[grad.i].sigma = Math.max(0.05, this.membershipParams[grad.i].sigma);
    }
    
    return error;
  }

  train(patterns, targets, epochs = 30) {
    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalError = 0;
      
      for (let i = 0; i < patterns.length; i++) {
        const forward = this.forwardPass(patterns[i]);
        const error = this.backwardPass(patterns[i], targets[i], forward);
        totalError += Math.abs(error);
      }
      
      if (epoch > 10 && totalError / patterns.length < 0.05) break;
    }
  }

  predict(inputs) {
    const forward = this.forwardPass(inputs);
    const prediction = forward.output > 0.5 ? 'Tài' : 'Xỉu';
    const confidence = 50 + Math.abs(forward.output - 0.5) * 92;
    
    return { prediction, confidence: Math.min(96, confidence), name: 'ANFIS' };
  }
}

// 3. ONLINE SEQUENTIAL EXTREME LEARNING MACHINE (OS-ELM)
class OnlineExtremeLearningMachine {
  constructor(nHidden = 50) {
    this.nHidden = nHidden;
    this.inputWeights = null;
    this.hiddenBiases = null;
    this.outputWeights = null;
    this.covarianceMatrix = null;
    this.initialized = false;
  }

  activationFunction(x) {
    return Math.tanh(x);
  }

  initialize(inputDim, initialData, initialTargets) {
    this.inputWeights = Array(this.nHidden).fill().map(() => 
      Array(inputDim).fill().map(() => (Math.random() - 0.5) * 2)
    );
    this.hiddenBiases = Array(this.nHidden).fill().map(() => (Math.random() - 0.5) * 2);
    
    const H = this.calculateHiddenOutput(initialData);
    const Ht = this.transpose(H);
    
    this.covarianceMatrix = this.inverseMatrix(this.multiplyMatrices(Ht, H));
    this.outputWeights = this.multiplyMatrices(
      this.multiplyMatrices(this.covarianceMatrix, Ht),
      initialTargets
    );
    
    this.initialized = true;
  }

  transpose(matrix) {
    return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
  }

  multiplyMatrices(A, B) {
    const result = Array(A.length).fill().map(() => Array(B[0].length).fill(0));
    for (let i = 0; i < A.length; i++) {
      for (let j = 0; j < B[0].length; j++) {
        let sum = 0;
        for (let k = 0; k < A[0].length; k++) {
          sum += A[i][k] * B[k][j];
        }
        result[i][j] = sum;
      }
    }
    return result;
  }

  inverseMatrix(matrix) {
    const n = matrix.length;
    const augmented = matrix.map((row, i) => [...row, ...Array(n).fill().map((_, j) => i === j ? 1 : 0)]);
    
    for (let i = 0; i < n; i++) {
      let maxRow = i;
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(augmented[j][i]) > Math.abs(augmented[maxRow][i])) maxRow = j;
      }
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
      
      const pivot = augmented[i][i];
      for (let j = i; j < 2 * n; j++) {
        augmented[i][j] /= pivot;
      }
      
      for (let j = 0; j < n; j++) {
        if (j !== i) {
          const factor = augmented[j][i];
          for (let k = i; k < 2 * n; k++) {
            augmented[j][k] -= factor * augmented[i][k];
          }
        }
      }
    }
    
    return augmented.map(row => row.slice(n));
  }

  calculateHiddenOutput(data) {
    const H = Array(data.length).fill().map(() => Array(this.nHidden).fill(0));
    
    for (let i = 0; i < data.length; i++) {
      for (let j = 0; j < this.nHidden; j++) {
        let sum = this.hiddenBiases[j];
        for (let k = 0; k < data[i].length; k++) {
          sum += this.inputWeights[j][k] * data[i][k];
        }
        H[i][j] = this.activationFunction(sum);
      }
    }
    
    return H;
  }

  update(newData, newTargets) {
    if (!this.initialized) {
      this.initialize(newData[0].length, newData, newTargets);
      return;
    }
    
    const Hnew = this.calculateHiddenOutput(newData);
    const HnewT = this.transpose(Hnew);
    
    const temp = this.multiplyMatrices(this.covarianceMatrix, HnewT);
    const denominator = this.addMatrices(
      this.identityMatrix(Hnew.length),
      this.multiplyMatrices(Hnew, temp)
    );
    const gain = this.multiplyMatrices(temp, this.inverseMatrix(denominator));
    
    const error = this.subtractMatrices(
      newTargets,
      this.multiplyMatrices(Hnew, this.outputWeights)
    );
    
    this.outputWeights = this.addMatrices(
      this.outputWeights,
      this.multiplyMatrices(gain, error)
    );
    
    const I = this.identityMatrix(this.covarianceMatrix.length);
    const KH = this.multiplyMatrices(gain, Hnew);
    this.covarianceMatrix = this.subtractMatrices(
      this.covarianceMatrix,
      this.multiplyMatrices(this.covarianceMatrix, KH)
    );
  }

  identityMatrix(n) {
    return Array(n).fill().map((_, i) => Array(n).fill().map((_, j) => i === j ? 1 : 0));
  }

  addMatrices(A, B) {
    return A.map((row, i) => row.map((val, j) => val + B[i][j]));
  }

  subtractMatrices(A, B) {
    return A.map((row, i) => row.map((val, j) => val - B[i][j]));
  }

  predict(features) {
    if (!this.initialized) return null;
    
    const H = Array(1).fill().map(() => Array(this.nHidden).fill(0));
    for (let j = 0; j < this.nHidden; j++) {
      let sum = this.hiddenBiases[j];
      for (let k = 0; k < features.length; k++) {
        sum += this.inputWeights[j][k] * features[k];
      }
      H[0][j] = this.activationFunction(sum);
    }
    
    const output = this.multiplyMatrices(H, this.outputWeights)[0][0];
    const prediction = output > 0.5 ? 'Tài' : 'Xỉu';
    const confidence = 50 + Math.abs(output - 0.5) * 94;
    
    return { prediction, confidence: Math.min(97, confidence), name: 'OSELM' };
  }
}

// 4. WAVELET NEURAL NETWORK (WNN)
class WaveletNeuralNetwork {
  constructor(nWavelets = 8) {
    this.nWavelets = nWavelets;
    this.translations = [];
    this.dilations = [];
    this.weights = [];
    this.learningRate = 0.01;
    this.momentum = 0.9;
    this.prevGradients = {};
  }

  morletWavelet(x) {
    return Math.cos(5 * x) * Math.exp(-Math.pow(x, 2) / 2);
  }

  derivativeMorlet(x) {
    return -Math.sin(5 * x) * 5 * Math.exp(-Math.pow(x, 2) / 2) - 
           Math.cos(5 * x) * Math.exp(-Math.pow(x, 2) / 2) * x;
  }

  initialize(inputDim) {
    for (let i = 0; i < this.nWavelets; i++) {
      this.translations.push(Array(inputDim).fill().map(() => Math.random() * 2 - 1));
      this.dilations.push(Array(inputDim).fill().map(() => Math.abs(Math.random() * 2 + 0.5)));
      this.weights.push(Math.random() * 2 - 1);
    }
    this.bias = Math.random() * 2 - 1;
  }

  forward(inputs) {
    const waveletOutputs = [];
    
    for (let i = 0; i < this.nWavelets; i++) {
      let sum = 0;
      for (let j = 0; j < inputs.length; j++) {
        const z = (inputs[j] - this.translations[i][j]) / this.dilations[i][j];
        sum += this.morletWavelet(z);
      }
      waveletOutputs.push(sum / inputs.length);
    }
    
    let output = this.bias;
    for (let i = 0; i < this.nWavelets; i++) {
      output += this.weights[i] * waveletOutputs[i];
    }
    
    const activation = 1 / (1 + Math.exp(-output));
    return { output: activation, waveletOutputs };
  }

  backward(inputs, target, forwardResults) {
    const error = target - forwardResults.output;
    const delta = error * forwardResults.output * (1 - forwardResults.output);
    
    for (let i = 0; i < this.nWavelets; i++) {
      const gradWeight = delta * forwardResults.waveletOutputs[i];
      const weightKey = `w_${i}`;
      const prevGrad = this.prevGradients[weightKey] || 0;
      const weightUpdate = this.momentum * prevGrad - this.learningRate * gradWeight;
      this.prevGradients[weightKey] = weightUpdate;
      this.weights[i] += weightUpdate;
      
      for (let j = 0; j < inputs.length; j++) {
        const z = (inputs[j] - this.translations[i][j]) / this.dilations[i][j];
        const psiPrime = this.derivativeMorlet(z);
        
        const gradTranslation = -delta * this.weights[i] * psiPrime / this.dilations[i][j];
        const transKey = `t_${i}_${j}`;
        const prevTransGrad = this.prevGradients[transKey] || 0;
        const transUpdate = this.momentum * prevTransGrad - this.learningRate * gradTranslation;
        this.prevGradients[transKey] = transUpdate;
        this.translations[i][j] += transUpdate;
        
        const gradDilation = -delta * this.weights[i] * psiPrime * z / this.dilations[i][j];
        const dilKey = `d_${i}_${j}`;
        const prevDilGrad = this.prevGradients[dilKey] || 0;
        const dilUpdate = this.momentum * prevDilGrad - this.learningRate * gradDilation;
        this.prevGradients[dilKey] = dilUpdate;
        this.dilations[i][j] += dilUpdate;
        this.dilations[i][j] = Math.max(0.1, this.dilations[i][j]);
      }
    }
    
    const gradBias = delta;
    const biasKey = 'bias';
    const prevBiasGrad = this.prevGradients[biasKey] || 0;
    const biasUpdate = this.momentum * prevBiasGrad - this.learningRate * gradBias;
    this.prevGradients[biasKey] = biasUpdate;
    this.bias += biasUpdate;
    
    return Math.abs(error);
  }

  train(patterns, targets, epochs = 25) {
    if (patterns.length === 0) return;
    
    if (this.weights.length === 0) {
      this.initialize(patterns[0].length);
    }
    
    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalError = 0;
      
      for (let i = 0; i < patterns.length; i++) {
        const forward = this.forward(patterns[i]);
        const error = this.backward(patterns[i], targets[i], forward);
        totalError += error;
      }
      
      if (epoch > 10 && totalError / patterns.length < 0.03) break;
    }
  }

  predict(inputs) {
    const forward = this.forward(inputs);
    const prediction = forward.output > 0.5 ? 'Tài' : 'Xỉu';
    const confidence = 50 + Math.abs(forward.output - 0.5) * 96;
    
    return { prediction, confidence: Math.min(98, confidence), name: 'WaveletNN' };
  }
}

// 5. HIERARCHICAL TEMPORAL MEMORY (HTM)
class HierarchicalTemporalMemory {
  constructor(nColumns = 100, nCellsPerColumn = 4) {
    this.nColumns = nColumns;
    this.nCellsPerColumn = nCellsPerColumn;
    this.activeColumns = [];
    this.activeCells = [];
    this.predictiveCells = [];
    this.connections = [];
    this.permanences = [];
    this.prevActiveColumns = [];
    this.initializeNetwork();
  }

  initializeNetwork() {
    for (let i = 0; i < this.nColumns; i++) {
      this.connections[i] = [];
      this.permanences[i] = [];
      for (let j = 0; j < this.nColumns; j++) {
        if (Math.random() < 0.1) {
          this.connections[i].push(j);
          this.permanences[i].push(Math.random());
        }
      }
    }
  }

  adaptPermanences(activeColumn, prevActiveColumn, learningRate = 0.1) {
    const connections = this.connections[activeColumn];
    for (let idx = 0; idx < connections.length; idx++) {
      const conn = connections[idx];
      if (conn === prevActiveColumn) {
        this.permanences[activeColumn][idx] += learningRate;
      } else {
        this.permanences[activeColumn][idx] -= learningRate * 0.5;
      }
      this.permanences[activeColumn][idx] = Math.max(0, Math.min(1, this.permanences[activeColumn][idx]));
    }
  }

  spatialPooling(input) {
    const overlaps = Array(this.nColumns).fill(0);
    
    for (let i = 0; i < this.nColumns; i++) {
      let overlap = 0;
      for (let j = 0; j < this.connections[i].length; j++) {
        if (input[this.connections[i][j]]) {
          overlap += this.permanences[i][j];
        }
      }
      overlaps[i] = overlap;
    }
    
    const nActive = Math.max(5, Math.floor(this.nColumns * 0.02));
    const activeColumns = overlaps
      .map((val, idx) => ({ val, idx }))
      .sort((a, b) => b.val - a.val)
      .slice(0, nActive)
      .map(item => item.idx);
    
    return activeColumns;
  }

  temporalPooling(activeColumns, learn = true) {
    const activeCells = [];
    const predictiveCells = [];
    
    for (const col of activeColumns) {
      const colStart = col * this.nCellsPerColumn;
      const colCells = [];
      for (let c = 0; c < this.nCellsPerColumn; c++) {
        colCells.push(colStart + c);
      }
      activeCells.push(...colCells);
    }
    
    if (learn && this.prevActiveColumns) {
      for (const col of activeColumns) {
        for (const prevCol of this.prevActiveColumns) {
          this.adaptPermanences(col, prevCol, 0.1);
        }
      }
    }
    
    this.prevActiveColumns = activeColumns;
    this.activeColumns = activeColumns;
    this.activeCells = activeCells;
    
    return { activeCells, predictiveCells };
  }

  compute(input, learn = true) {
    const activeColumns = this.spatialPooling(input);
    const temporalResult = this.temporalPooling(activeColumns, learn);
    return temporalResult;
  }

  predictNext(input) {
    const activeColumns = this.spatialPooling(input);
    const predictions = new Set();
    
    for (const col of activeColumns) {
      const connections = this.connections[col];
      for (let idx = 0; idx < connections.length; idx++) {
        if (this.permanences[col][idx] > 0.5) {
          predictions.add(connections[idx]);
        }
      }
    }
    
    const predictedColumn = predictions.size > 0 ? Array.from(predictions)[0] : null;
    if (predictedColumn !== null) {
      const prediction = predictedColumn > this.nColumns / 2 ? 'Tài' : 'Xỉu';
      const confidence = 50 + (predictions.size / this.nColumns) * 40;
      return { prediction, confidence: Math.min(85, confidence), name: 'HTM' };
    }
    
    return null;
  }
}

// 6. RESERVOIR COMPUTING WITH ECHO STATE NETWORK (ESN)
class EchoStateNetwork {
  constructor(nReservoir = 200, spectralRadius = 0.9, leakingRate = 0.3) {
    this.nReservoir = nReservoir;
    this.spectralRadius = spectralRadius;
    this.leakingRate = leakingRate;
    this.inputWeights = [];
    this.reservoirWeights = [];
    this.outputWeights = null;
    this.state = Array(nReservoir).fill(0);
    this.ridgeParameter = 1e-8;
    this.initializeNetwork();
  }

  initializeNetwork() {
    for (let i = 0; i < this.nReservoir; i++) {
      this.inputWeights.push((Math.random() - 0.5) * 2);
    }
    
    let reservoir = Array(this.nReservoir).fill().map(() => 
      Array(this.nReservoir).fill().map(() => (Math.random() - 0.5) * 2)
    );
    
    const eigenvalues = this.computeSpectralRadius(reservoir);
    const scaling = this.spectralRadius / eigenvalues;
    for (let i = 0; i < this.nReservoir; i++) {
      for (let j = 0; j < this.nReservoir; j++) {
        reservoir[i][j] *= scaling;
      }
    }
    this.reservoirWeights = reservoir;
  }

  computeSpectralRadius(matrix) {
    let vector = Array(matrix.length).fill(1);
    for (let iter = 0; iter < 50; iter++) {
      const newVector = Array(matrix.length).fill(0);
      for (let i = 0; i < matrix.length; i++) {
        for (let j = 0; j < matrix.length; j++) {
          newVector[i] += matrix[i][j] * vector[j];
        }
      }
      let norm = 0;
      for (let i = 0; i < newVector.length; i++) {
        norm += newVector[i] * newVector[i];
      }
      norm = Math.sqrt(norm);
      for (let i = 0; i < newVector.length; i++) {
        newVector[i] /= norm;
      }
      vector = newVector;
    }
    
    let eigenvalue = 0;
    for (let i = 0; i < matrix.length; i++) {
      let sum = 0;
      for (let j = 0; j < matrix.length; j++) {
        sum += matrix[i][j] * vector[j];
      }
      eigenvalue += sum * vector[i];
    }
    return Math.abs(eigenvalue);
  }

  updateState(input) {
    const newState = Array(this.nReservoir).fill(0);
    
    for (let i = 0; i < this.nReservoir; i++) {
      let sum = this.inputWeights[i] * input;
      for (let j = 0; j < this.nReservoir; j++) {
        sum += this.reservoirWeights[i][j] * this.state[j];
      }
      newState[i] = (1 - this.leakingRate) * this.state[i] + this.leakingRate * Math.tanh(sum);
    }
    
    this.state = newState;
    return this.state;
  }

  train(patterns, targets) {
    const stateCollection = [];
    
    for (let i = 0; i < patterns.length; i++) {
      this.updateState(patterns[i]);
      stateCollection.push([...this.state]);
    }
    
    const R = stateCollection;
    const Rtranspose = this.transpose(R);
    const RTR = this.multiplyMatrices(Rtranspose, R);
    
    for (let i = 0; i < RTR.length; i++) {
      RTR[i][i] += this.ridgeParameter;
    }
    
    const RTRinv = this.inverseMatrix(RTR);
    const RTRinvRT = this.multiplyMatrices(RTRinv, Rtranspose);
    const targetMatrix = targets.map(t => [t]);
    this.outputWeights = this.multiplyMatrices(RTRinvRT, targetMatrix);
  }

  transpose(matrix) {
    return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
  }

  multiplyMatrices(A, B) {
    const result = Array(A.length).fill().map(() => Array(B[0].length).fill(0));
    for (let i = 0; i < A.length; i++) {
      for (let j = 0; j < B[0].length; j++) {
        let sum = 0;
        for (let k = 0; k < A[0].length; k++) {
          sum += A[i][k] * B[k][j];
        }
        result[i][j] = sum;
      }
    }
    return result;
  }

  inverseMatrix(matrix) {
    const n = matrix.length;
    const augmented = matrix.map((row, i) => [...row, ...Array(n).fill().map((_, j) => i === j ? 1 : 0)]);
    
    for (let i = 0; i < n; i++) {
      let maxRow = i;
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(augmented[j][i]) > Math.abs(augmented[maxRow][i])) maxRow = j;
      }
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
      
      const pivot = augmented[i][i];
      for (let j = i; j < 2 * n; j++) {
        augmented[i][j] /= pivot;
      }
      
      for (let j = 0; j < n; j++) {
        if (j !== i) {
          const factor = augmented[j][i];
          for (let k = i; k < 2 * n; k++) {
            augmented[j][k] -= factor * augmented[i][k];
          }
        }
      }
    }
    
    return augmented.map(row => row.slice(n));
  }

  predict(input) {
    this.updateState(input);
    let output = 0;
    for (let i = 0; i < this.outputWeights.length; i++) {
      output += this.outputWeights[i][0] * this.state[i];
    }
    
    const prediction = output > 0.5 ? 'Tài' : 'Xỉu';
    const confidence = 50 + Math.abs(output - 0.5) * 90;
    
    return { prediction, confidence: Math.min(94, confidence), name: 'EchoState' };
  }
}

// 7. QUANTUM INSPIRED NEURAL NETWORK (QINN)
class QuantumInspiredNeuralNetwork {
  constructor(nQubits = 8) {
    this.nQubits = nQubits;
    this.quantumStates = Array(nQubits).fill().map(() => ({ alpha: 1/Math.sqrt(2), beta: 1/Math.sqrt(2) }));
    this.rotationAngles = Array(nQubits).fill().map(() => Math.random() * Math.PI * 2);
    this.measurements = Array(nQubits).fill(0);
  }

  quantumGate(state, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const newAlpha = state.alpha * cos - state.beta * sin;
    const newBeta = state.alpha * sin + state.beta * cos;
    return { alpha: newAlpha, beta: newBeta };
  }

  measure(probabilities) {
    const r = Math.random();
    let sum = 0;
    for (let i = 0; i < probabilities.length; i++) {
      sum += probabilities[i];
      if (r <= sum) return i;
    }
    return probabilities.length - 1;
  }

  encodeInput(input) {
    const features = input.map(f => f);
    for (let i = 0; i < this.nQubits && i < features.length; i++) {
      const rotationAngle = features[i] * Math.PI;
      this.quantumStates[i] = this.quantumGate(this.quantumStates[i], rotationAngle);
    }
    return this.quantumStates;
  }

  applyQuantumLayer() {
    for (let i = 0; i < this.nQubits; i++) {
      this.quantumStates[i] = this.quantumGate(this.quantumStates[i], this.rotationAngles[i]);
      
      if (i > 0) {
        const phase = Math.atan2(this.quantumStates[i].beta, this.quantumStates[i].alpha);
        this.quantumStates[i-1] = this.quantumGate(this.quantumStates[i-1], phase * 0.5);
      }
    }
  }

  measureStates() {
    const probabilities = [];
    for (let i = 0; i < this.nQubits; i++) {
      const probZero = Math.pow(this.quantumStates[i].alpha, 2);
      probabilities.push(probZero);
    }
    return probabilities;
  }

  updateAngles(gradient, learningRate = 0.01) {
    for (let i = 0; i < this.nQubits; i++) {
      const angleUpdate = learningRate * gradient[i];
      this.rotationAngles[i] += angleUpdate;
      this.rotationAngles[i] = ((this.rotationAngles[i] % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    }
  }

  train(patterns, targets, epochs = 20) {
    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalError = 0;
      
      for (let i = 0; i < patterns.length; i++) {
        this.quantumStates = Array(this.nQubits).fill().map(() => ({ alpha: 1/Math.sqrt(2), beta: 1/Math.sqrt(2) }));
        this.encodeInput(patterns[i]);
        this.applyQuantumLayer();
        
        const probabilities = this.measureStates();
        const prediction = probabilities.reduce((a,b) => a+b, 0) / this.nQubits;
        const error = targets[i] - prediction;
        totalError += Math.abs(error);
        
        const gradients = probabilities.map(p => error * (p - 0.5));
        this.updateAngles(gradients, 0.01 / (1 + epoch * 0.1));
      }
      
      if (epoch > 10 && totalError / patterns.length < 0.05) break;
    }
  }

  predict(features) {
    this.quantumStates = Array(this.nQubits).fill().map(() => ({ alpha: 1/Math.sqrt(2), beta: 1/Math.sqrt(2) }));
    this.encodeInput(features);
    this.applyQuantumLayer();
    
    const probabilities = this.measureStates();
    const output = probabilities.reduce((a,b) => a+b, 0) / this.nQubits;
    
    const prediction = output > 0.5 ? 'Tài' : 'Xỉu';
    const confidence = 50 + Math.abs(output - 0.5) * 98;
    
    return { prediction, confidence: Math.min(99, confidence), name: 'QuantumNN' };
  }
}

// 8. SUPRA ADAPTIVE HYPER ENSEMBLE
class SupraAdaptiveEnsemble {
  constructor() {
    this.models = {};
    this.performance = {};
    this.adaptiveWeights = {};
    this.contextualWeights = {};
    this.contextHistory = [];
    this.optimalWeights = null;
    this.learningRate = 0.05;
    this.explorationRate = 0.1;
    this.rewardDecay = 0.95;
  }

  registerModel(name, model, initialWeight = 1.0) {
    this.models[name] = model;
    this.adaptiveWeights[name] = initialWeight;
    this.performance[name] = {
      correct: 0,
      total: 0,
      recentAccuracy: [],
      contextAccuracy: {},
      rewardHistory: []
    };
  }

  extractContext(results, sums) {
    const context = {
      volatility: 0,
      trendStrength: 0,
      patternComplexity: 0,
      noiseLevel: 0,
      streakLength: 1
    };
    
    for (let i = 1; i < Math.min(20, results.length); i++) {
      if (results[i] !== results[i-1]) context.volatility++;
    }
    context.volatility = context.volatility / Math.min(19, results.length - 1);
    
    for (let i = 1; i < Math.min(10, results.length); i++) {
      if (results[i] === results[0]) context.streakLength++;
      else break;
    }
    context.trendStrength = context.streakLength / 10;
    
    let complexity = 0;
    for (let i = 3; i < Math.min(15, results.length); i++) {
      const pattern = results.slice(i-3, i).join('');
      complexity += Math.abs(results[i-3] === results[i-1] ? 1 : 0);
    }
    context.patternComplexity = complexity / Math.min(12, results.length - 3);
    
    if (sums && sums.length >= 5) {
      let sumChanges = 0;
      for (let i = 1; i < Math.min(10, sums.length); i++) {
        sumChanges += Math.abs(sums[i-1] - sums[i]);
      }
      context.noiseLevel = sumChanges / Math.min(9, sums.length - 1) / 10;
    }
    
    return context;
  }

  getContextKey(context) {
    const volBucket = Math.floor(context.volatility * 4);
    const trendBucket = Math.floor(context.trendStrength * 4);
    const noiseBucket = Math.floor(context.noiseLevel * 4);
    return `${volBucket}_${trendBucket}_${noiseBucket}`;
  }

  updateContextualWeight(name, contextKey, success, confidence) {
    if (!this.performance[name].contextAccuracy[contextKey]) {
      this.performance[name].contextAccuracy[contextKey] = { correct: 0, total: 0 };
    }
    
    const contextPerf = this.performance[name].contextAccuracy[contextKey];
    contextPerf.total++;
    if (success) contextPerf.correct++;
    
    const contextAccuracy = contextPerf.correct / contextPerf.total;
    const targetWeight = 0.5 + contextAccuracy * 0.8;
    
    if (!this.contextualWeights[name]) this.contextualWeights[name] = {};
    this.contextualWeights[name][contextKey] = targetWeight;
  }

  getAdaptiveWeight(name, contextKey) {
    const baseWeight = this.adaptiveWeights[name] || 0.5;
    const contextWeight = this.contextualWeights[name]?.[contextKey] || 0.5;
    const recentAccuracy = this.getRecentAccuracy(name);
    
    let weight = baseWeight * 0.4 + contextWeight * 0.4 + recentAccuracy * 0.2;
    
    if (this.performance[name].total > 100) weight *= 1.1;
    if (this.performance[name].total > 500) weight *= 1.05;
    
    return Math.max(0.2, Math.min(2.0, weight));
  }

  getRecentAccuracy(name, windowSize = 20) {
    const recent = this.performance[name].recentAccuracy;
    if (recent.length === 0) return 0.5;
    const window = recent.slice(-windowSize);
    return window.reduce((a,b) => a+b, 0) / window.length;
  }

  updateWeight(name, success, confidence) {
    const reward = success ? confidence / 100 : -0.3;
    
    this.performance[name].recentAccuracy.push(success ? 1 : 0);
    if (this.performance[name].recentAccuracy.length > 50) {
      this.performance[name].recentAccuracy.shift();
    }
    
    this.performance[name].rewardHistory.push(reward);
    if (this.performance[name].rewardHistory.length > 30) {
      this.performance[name].rewardHistory.shift();
    }
    
    const avgReward = this.performance[name].rewardHistory.reduce((a,b) => a+b, 0) / 
                      this.performance[name].rewardHistory.length;
    
    const adjustment = this.learningRate * avgReward;
    this.adaptiveWeights[name] = Math.max(0.3, Math.min(2.0, this.adaptiveWeights[name] + adjustment));
  }

  getWeightedPredictions(predictions, context) {
    const contextKey = this.getContextKey(context);
    const weightedVotes = { Tai: 0, Xiu: 0 };
    let totalWeight = 0;
    const validPredictions = [];
    
    for (const pred of predictions) {
      const weight = this.getAdaptiveWeight(pred.model, contextKey);
      const confidenceWeight = pred.confidence / 100;
      const finalWeight = weight * confidenceWeight;
      
      if (pred.prediction === 'Tài') {
        weightedVotes.Tai += finalWeight;
      } else {
        weightedVotes.Xiu += finalWeight;
      }
      totalWeight += finalWeight;
      validPredictions.push(pred);
    }
    
    if (totalWeight === 0) return { prediction: 'Tài', confidence: 50, validPredictions };
    
    const taiProbability = weightedVotes.Tai / totalWeight;
    let confidence = taiProbability > 0.5 ? taiProbability * 100 : (1 - taiProbability) * 100;
    
    const diversity = validPredictions.length / Object.keys(this.models).length;
    confidence *= (0.8 + diversity * 0.3);
    
    const prediction = taiProbability > 0.5 ? 'Tài' : 'Xỉu';
    confidence = Math.min(96, Math.max(62, confidence));
    
    return { prediction, confidence, validPredictions };
  }
}

// Các lớp model bổ sung đơn giản hóa
class HiddenMarkovModel {
  constructor(nStates) {
    this.nStates = nStates;
    this.transitionMatrix = Array(nStates).fill().map(() => Array(nStates).fill(1/nStates));
    this.emissionMatrix = Array(nStates).fill().map(() => [0.5, 0.5]);
    this.currentState = 0;
  }

  predictNext() {
    let nextState = 0;
    let maxProb = 0;
    for (let i = 0; i < this.nStates; i++) {
      if (this.transitionMatrix[this.currentState][i] > maxProb) {
        maxProb = this.transitionMatrix[this.currentState][i];
        nextState = i;
      }
    }
    const prediction = this.emissionMatrix[nextState][0] > 0.5 ? 'Tài' : 'Xỉu';
    return { prediction, confidence: 55 + maxProb * 30, name: 'HMM' };
  }
}

class LSTMSimulator {
  constructor() {
    this.hiddenState = 0;
    this.cellState = 0;
  }

  predict(results) {
    const input = results[0] === 'Tài' ? 1 : 0;
    const forgetGate = 0.8;
    const inputGate = 0.2;
    const outputGate = 0.9;
    
    this.cellState = forgetGate * this.cellState + inputGate * input;
    this.hiddenState = outputGate * Math.tanh(this.cellState);
    
    const output = this.hiddenState > 0 ? 'Tài' : 'Xỉu';
    const confidence = 50 + Math.abs(this.hiddenState) * 40;
    return { prediction: output, confidence: Math.min(90, confidence), name: 'LSTM' };
  }
}

// Hàm phân tích cầu truyền thống (giữ lại)
function analyzeCauBet(results, type) {
  if (results.length < 3) return { detected: false };
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
      detected: true,
      prediction: shouldBreak ? (streakType === 'Tài' ? 'Xỉu' : 'Tài') : streakType,
      confidence: confidence,
      name: `Cầu Bệt ${streakLength} phiên`,
      priority: 9
    };
  }
  return { detected: false };
}

function analyzeCauDao11(results, type) {
  if (results.length < 4) return { detected: false };
  let alternatingLength = 1;
  for (let i = 1; i < Math.min(results.length, 10); i++) {
    if (results[i] !== results[i - 1]) alternatingLength++;
    else break;
  }
  if (alternatingLength >= 4) {
    let confidence = Math.min(80, 65 + alternatingLength * 2);
    return {
      detected: true,
      prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài',
      confidence: confidence,
      name: `Cầu Đảo 1-1 (${alternatingLength} phiên)`,
      priority: 8
    };
  }
  return { detected: false };
}

function analyzeCau22(results, type) {
  if (results.length < 6) return { detected: false };
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
    for (let j = 1; j < pattern.length; j++) if (pattern[j] === pattern[j - 1]) isAlternating = false;
    if (isAlternating) {
      const lastPairType = pattern[pattern.length - 1];
      return {
        detected: true,
        prediction: lastPairType === 'Tài' ? 'Xỉu' : 'Tài',
        confidence: Math.min(78, 65 + pairCount * 3),
        name: `Cầu 2-2 (${pairCount} cặp)`,
        priority: 7
      };
    }
  }
  return { detected: false };
}

function analyzeCau33(results, type) {
  if (results.length < 6) return { detected: false };
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
      detected: true,
      prediction: prediction,
      confidence: Math.min(80, 68 + tripleCount * 4),
      name: `Cầu 3-3 (${tripleCount} bộ ba)`,
      priority: 7
    };
  }
  return { detected: false };
}

function analyzeCau121(results, type) {
  if (results.length < 4) return { detected: false };
  const pattern1 = results.slice(0, 4);
  if (pattern1[0] !== pattern1[1] && pattern1[1] === pattern1[2] && pattern1[2] !== pattern1[3] && pattern1[0] === pattern1[3]) {
    return { detected: true, prediction: pattern1[0], confidence: 72, name: 'Cầu 1-2-1', priority: 6 };
  }
  return { detected: false };
}

function analyzeCau123(results, type) {
  if (results.length < 6) return { detected: false };
  const first = results[5];
  const nextTwo = results.slice(3, 5);
  const lastThree = results.slice(0, 3);
  if (nextTwo[0] === nextTwo[1] && nextTwo[0] !== first) {
    const allSame = lastThree.every(r => r === lastThree[0]);
    if (allSame && lastThree[0] !== nextTwo[0]) {
      return { detected: true, prediction: first, confidence: 74, name: 'Cầu 1-2-3', priority: 6 };
    }
  }
  return { detected: false };
}

function analyzeCau321(results, type) {
  if (results.length < 6) return { detected: false };
  const first3 = results.slice(3, 6);
  const next2 = results.slice(1, 3);
  const last1 = results[0];
  const first3Same = first3.every(r => r === first3[0]);
  const next2Same = next2.every(r => r === next2[0]);
  if (first3Same && next2Same && first3[0] !== next2[0] && last1 !== next2[0]) {
    return { detected: true, prediction: next2[0], confidence: 76, name: 'Cầu 3-2-1', priority: 6 };
  }
  return { detected: false };
}

function analyzeCauNhayCoc(results, type) {
  if (results.length < 6) return { detected: false };
  const skipPattern = [];
  for (let i = 0; i < Math.min(results.length, 12); i += 2) skipPattern.push(results[i]);
  if (skipPattern.length >= 3) {
    const allSame = skipPattern.slice(0, 3).every(r => r === skipPattern[0]);
    if (allSame) return { detected: true, prediction: skipPattern[0], confidence: 68, name: 'Cầu Nhảy Cóc', priority: 5 };
    let alternating = true;
    for (let i = 1; i < skipPattern.length - 1; i++) if (skipPattern[i] === skipPattern[i - 1]) alternating = false;
    if (alternating && skipPattern.length >= 3) {
      return { detected: true, prediction: skipPattern[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 66, name: 'Cầu Nhảy Cóc Đảo', priority: 5 };
    }
  }
  return { detected: false };
}

function analyzeCauNhipNghieng(results, type) {
  if (results.length < 5) return { detected: false };
  const last5 = results.slice(0, 5);
  const taiCount5 = last5.filter(r => r === 'Tài').length;
  if (taiCount5 >= 4) {
    return { detected: true, prediction: 'Tài', confidence: 70, name: `Cầu Nhịp Nghiêng (${taiCount5}/5 Tài)`, priority: 5 };
  } else if (taiCount5 <= 1) {
    return { detected: true, prediction: 'Xỉu', confidence: 70, name: `Cầu Nhịp Nghiêng (${5 - taiCount5}/5 Xỉu)`, priority: 5 };
  }
  return { detected: false };
}

function analyzeCau3Van1(results, type) {
  if (results.length < 4) return { detected: false };
  const last4 = results.slice(0, 4);
  const taiCount = last4.filter(r => r === 'Tài').length;
  if (taiCount === 3) return { detected: true, prediction: 'Xỉu', confidence: 68, name: 'Cầu 3 Ván 1 (3T-1X) → Xỉu', priority: 5 };
  if (taiCount === 1) return { detected: true, prediction: 'Tài', confidence: 68, name: 'Cầu 3 Ván 1 (3X-1T) → Tài', priority: 5 };
  return { detected: false };
}

function analyzeSmartBet(results, type) {
  if (results.length < 10) return { detected: false };
  const last10 = results.slice(0, 10);
  const last5 = results.slice(0, 5);
  const prev5 = results.slice(5, 10);
  const taiLast5 = last5.filter(r => r === 'Tài').length;
  const taiPrev5 = prev5.filter(r => r === 'Tài').length;
  const trendChanging = (taiLast5 >= 4 && taiPrev5 <= 1) || (taiLast5 <= 1 && taiPrev5 >= 4);
  if (trendChanging) {
    const currentDominant = taiLast5 >= 4 ? 'Tài' : 'Xỉu';
    return { detected: true, prediction: currentDominant === 'Tài' ? 'Xỉu' : 'Tài', confidence: 78, name: `Đảo Xu Hướng (${taiLast5}T-${5-taiLast5}X → ${taiPrev5}T-${5-taiPrev5}X)`, priority: 8 };
  }
  const taiLast10 = last10.filter(r => r === 'Tài').length;
  if (taiLast10 >= 8 || taiLast10 <= 2) {
    const dominant = taiLast10 >= 8 ? 'Tài' : 'Xỉu';
    return { detected: true, prediction: dominant === 'Tài' ? 'Xỉu' : 'Tài', confidence: 82, name: `Xu Hướng Cực (${taiLast10}T-${10-taiLast10}X) → Đảo`, priority: 8 };
  }
  return { detected: false };
}

function analyzeBreakStreak(results, type) {
  if (results.length < 5) return { detected: false };
  let streakType = results[0];
  let streakLength = 1;
  for (let i = 1; i < results.length; i++) {
    if (results[i] === streakType) streakLength++;
    else break;
  }
  if (streakLength >= 5) {
    const prediction = streakType === 'Tài' ? 'Xỉu' : 'Tài';
    return { detected: true, prediction: prediction, confidence: Math.min(85, 70 + streakLength), name: `Bẻ Chuỗi ${streakLength} (${streakType} → ${prediction})`, priority: 10 };
  }
  return { detected: false };
}

function analyzeTriplePattern(results, type) {
  if (results.length < 9) return { detected: false };
  const isTriple1 = results[0] === results[1] && results[1] === results[2];
  const isTriple2 = results[3] === results[4] && results[4] === results[5];
  const isTriple3 = results[6] === results[7] && results[7] === results[8];
  if (isTriple1 && isTriple2 && isTriple3) {
    const tripleType1 = results[0];
    const tripleType2 = results[3];
    const tripleType3 = results[6];
    if (tripleType1 === tripleType2 && tripleType2 === tripleType3) {
      const prediction = tripleType1 === 'Tài' ? 'Xỉu' : 'Tài';
      return { detected: true, prediction: prediction, confidence: 88, name: `3 Bộ Ba Cùng ${tripleType1} → Bẻ ${prediction}`, priority: 10 };
    }
    if (tripleType1 !== tripleType2 && tripleType2 !== tripleType3) {
      return { detected: true, prediction: tripleType1, confidence: 80, name: `Bộ Ba Đảo → Theo ${tripleType1}`, priority: 10 };
    }
  }
  return { detected: false };
}

function analyzeTongPhanTich(data, type) {
  if (data.length < 10) return { detected: false };
  const recent10 = data.slice(0, 10);
  const sums = recent10.map(d => d.Tong);
  const results = recent10.map(d => d.Ket_qua);
  const taiCount = results.filter(r => r === 'Tài').length;
  const xiuCount = results.filter(r => r === 'Xỉu').length;
  const first5Sum = sums.slice(5, 10).reduce((a, b) => a + b, 0) / 5;
  const last5Sum = sums.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
  const sumTrend = last5Sum - first5Sum;
  if (sumTrend > 1.5) return { detected: true, prediction: 'Xỉu', confidence: 75, name: `Tổng Phân Tích (Tổng tăng ${sumTrend.toFixed(1)} → Xỉu)`, priority: 12 };
  if (sumTrend < -1.5) return { detected: true, prediction: 'Tài', confidence: 75, name: `Tổng Phân Tích (Tổng giảm ${Math.abs(sumTrend).toFixed(1)} → Tài)`, priority: 12 };
  if (Math.abs(taiCount - xiuCount) >= 3) {
    const lech = taiCount > xiuCount ? 'Tài' : 'Xỉu';
    const prediction = lech === 'Tài' ? 'Xỉu' : 'Tài';
    return { detected: true, prediction: prediction, confidence: 70, name: `Tổng Phân Tích (Lệch ${Math.abs(taiCount - xiuCount)} về ${lech} → ${prediction})`, priority: 11 };
  }
  return { detected: false };
}

function analyzeXuHuongManh(results, type) {
  if (results.length < 8) return { detected: false };
  const recent8 = results.slice(0, 8);
  const taiCount = recent8.filter(r => r === 'Tài').length;
  if (taiCount >= 6) return { detected: true, prediction: 'Xỉu', confidence: 80, name: `Xu Hướng Mạnh (${taiCount}/8 Tài → Đảo Xỉu)`, priority: 11 };
  if (taiCount <= 2) return { detected: true, prediction: 'Tài', confidence: 80, name: `Xu Hướng Mạnh (${8 - taiCount}/8 Xỉu → Đảo Tài)`, priority: 11 };
  return { detected: false };
}

function analyzeDaoChieu(results, type) {
  if (results.length < 5) return { detected: false };
  const recent5 = results.slice(0, 5);
  let isAlternating = true;
  for (let i = 0; i < recent5.length - 1; i++) {
    if (recent5[i] === recent5[i + 1]) { isAlternating = false; break; }
  }
  if (isAlternating) {
    const prediction = recent5[0] === 'Tài' ? 'Xỉu' : 'Tài';
    return { detected: true, prediction: prediction, confidence: 75, name: `Đảo Chiều (Chuỗi ${recent5.join('-')} → ${prediction})`, priority: 10 };
  }
  return { detected: false };
}

// ULTIMATE PREDICTOR V4.0 - TÍCH HỢP TOÀN BỘ
class UltimatePredictorV4 {
  constructor() {
    this.dbNetwork = new DeepBeliefNetwork([10, 20, 15, 8, 3]);
    this.anfisSystem = new NeuroFuzzySystem(7);
    this.oselmModel = new OnlineExtremeLearningMachine(60);
    this.waveletNN = new WaveletNeuralNetwork(12);
    this.htmModel = new HierarchicalTemporalMemory(150, 6);
    this.esnModel = new EchoStateNetwork(250, 0.95, 0.4);
    this.qinnModel = new QuantumInspiredNeuralNetwork(12);
    this.supraEnsemble = new SupraAdaptiveEnsemble();
    this.hmmModel = new HiddenMarkovModel(4);
    this.lstmModel = new LSTMSimulator();
    
    this.registerAllModels();
    this.trainingBuffer = [];
    this.predictionCache = [];
  }

  registerAllModels() {
    this.supraEnsemble.registerModel('dbn', this.dbNetwork, 1.0);
    this.supraEnsemble.registerModel('anfis', this.anfisSystem, 0.9);
    this.supraEnsemble.registerModel('oselm', this.oselmModel, 1.1);
    this.supraEnsemble.registerModel('wnn', this.waveletNN, 1.0);
    this.supraEnsemble.registerModel('htm', this.htmModel, 0.8);
    this.supraEnsemble.registerModel('esn', this.esnModel, 1.0);
    this.supraEnsemble.registerModel('qinn', this.qinnModel, 0.9);
    this.supraEnsemble.registerModel('hmm', this.hmmModel, 0.9);
    this.supraEnsemble.registerModel('lstm', this.lstmModel, 1.0);
  }

  extractUltraFeatures(results, sums) {
    const features = [];
    
    const numerical = results.map(r => r === 'Tài' ? 1 : 0);
    const mean = numerical.reduce((a,b) => a+b, 0) / numerical.length;
    const variance = numerical.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / numerical.length;
    features.push(mean, variance);
    
    let streak = 1, maxStreak = 1;
    for (let i = 1; i < results.length; i++) {
      if (results[i] === results[i-1]) streak++;
      else {
        maxStreak = Math.max(maxStreak, streak);
        streak = 1;
      }
    }
    features.push(streak / 10, maxStreak / 10);
    
    let changes = 0;
    for (let i = 1; i < Math.min(30, results.length); i++) {
      if (results[i] !== results[i-1]) changes++;
    }
    features.push(changes / 29);
    
    const taiRatio = numerical.filter(v => v === 1).length / numerical.length;
    features.push(taiRatio);
    
    let complexity = 0;
    for (let i = 3; i < Math.min(20, results.length); i++) {
      const pattern = results.slice(i-3, i).join('');
      const next = results[i];
      complexity += pattern === `${next}${next}${next}` ? 1 : 0;
    }
    features.push(complexity / 17);
    
    if (sums && sums.length >= 10) {
      const sumMean = sums.slice(0, 10).reduce((a,b) => a+b, 0) / 10;
      const sumVar = sums.slice(0, 10).reduce((a,b) => a + Math.pow(b - sumMean, 2), 0) / 10;
      features.push(sumMean / 18, sumVar / 100);
    } else {
      features.push(0.5, 0.1);
    }
    
    for (let lag = 1; lag <= 5; lag++) {
      let acf = 0;
      for (let i = 0; i < numerical.length - lag; i++) {
        acf += (numerical[i] - mean) * (numerical[i + lag] - mean);
      }
      acf = acf / ((numerical.length - lag) * variance + 1e-10);
      features.push(acf);
    }
    
    return features;
  }

  async predict(data, type) {
    const results = data.map(d => d.Ket_qua);
    const sums = data.map(d => d.Tong);
    
    if (results.length < 5) {
      return { prediction: 'Tài', confidence: 55, factors: ['Insufficient data for prediction'] };
    }
    
    const features = this.extractUltraFeatures(results, sums);
    const context = this.supraEnsemble.extractContext(results, sums);
    
    const allPredictions = [];
    
    const modelPredictions = [
      this.dbNetwork.predict(features),
      this.anfisSystem.predict(features.slice(0, 2)),
      this.oselmModel.predict(features),
      this.waveletNN.predict(features.slice(0, 3)),
      this.htmModel.predictNext(this.encodeForHTM(results)),
      this.esnModel.predict(features[0]),
      this.qinnModel.predict(features.slice(0, 4)),
      this.hmmModel.predictNext(),
      this.lstmModel.predict(results)
    ];
    
    const patternFunctions = [
      analyzeCauBet, analyzeCauDao11, analyzeCau22, analyzeCau33, analyzeCau121, analyzeCau123,
      analyzeCau321, analyzeCauNhayCoc, analyzeCauNhipNghieng, analyzeCau3Van1, analyzeSmartBet,
      analyzeBreakStreak, analyzeTriplePattern, analyzeTongPhanTich, analyzeXuHuongManh, analyzeDaoChieu
    ];
    
    for (let fn of patternFunctions) {
      let p = fn(results, type);
      if (p && p.detected) {
        allPredictions.push({ ...p, model: 'pattern_traditional' });
      }
    }
    
    for (let i = 0; i < modelPredictions.length; i++) {
      if (modelPredictions[i]) {
        const modelName = Object.keys(this.supraEnsemble.models)[i];
        allPredictions.push({ ...modelPredictions[i], model: modelName });
      }
    }
    
    const finalResult = this.supraEnsemble.getWeightedPredictions(allPredictions, context);
    
    const topModels = Object.entries(this.supraEnsemble.adaptiveWeights)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, weight]) => `${name}(${weight.toFixed(2)})`);
    
    const factors = [
      `Ensemble: ${allPredictions.length} models active`,
      `Top performers: ${topModels.join(', ')}`,
      `Context: vol=${context.volatility.toFixed(2)}, streak=${context.streakLength}`,
      `Confidence: ${finalResult.confidence.toFixed(0)}%`,
      `Adaptive weights online`
    ];
    
    this.predictionCache.push({
      timestamp: Date.now(),
      prediction: finalResult.prediction,
      confidence: finalResult.confidence,
      context: context,
      wasCorrect: null
    });
    
    if (this.predictionCache.length > 200) this.predictionCache.shift();
    
    return {
      prediction: finalResult.prediction,
      confidence: Math.round(finalResult.confidence),
      factors: factors,
      allPatterns: allPredictions.slice(0, 10).map(p => (p.name || p.model).substring(0, 20)),
      detailedAnalysis: {
        totalModels: allPredictions.length,
        activeModels: Object.keys(this.supraEnsemble.models).length,
        topModels: topModels.slice(0, 3),
        context: {
          volatility: (context.volatility * 100).toFixed(1) + '%',
          trendStrength: (context.trendStrength * 100).toFixed(1) + '%',
          streakLength: context.streakLength
        }
      }
    };
  }

  encodeForHTM(results) {
    const encoding = Array(150).fill(0);
    for (let i = 0; i < Math.min(10, results.length); i++) {
      const idx = (results[i] === 'Tài' ? 0 : 75) + i * 5;
      if (idx < 150) encoding[idx] = 1;
    }
    return encoding;
  }

  updateResult(prediction, actual, wasCorrect, type) {
    for (const [modelName, model] of Object.entries(this.supraEnsemble.models)) {
      let modelCorrect = false;
      if (modelName === 'pattern_traditional') {
        modelCorrect = wasCorrect;
      } else if (model.predict) {
        modelCorrect = wasCorrect;
      }
      this.supraEnsemble.updateWeight(modelName, modelCorrect, 70);
    }
    
    if (this.predictionCache.length > 0) {
      this.predictionCache[this.predictionCache.length - 1].wasCorrect = wasCorrect;
    }
  }
}

// Khởi tạo global predictor
const ultimatePredictorV4 = new UltimatePredictorV4();

// === HÀM LOAD/SAVE ===
function loadLearningData() {
  try {
    if (fs.existsSync(LEARNING_FILE)) {
      const data = fs.readFileSync(LEARNING_FILE, 'utf8');
      const parsed = JSON.parse(data);
      console.log('✅ Loaded learning data from', LEARNING_FILE);
    }
  } catch (error) {
    console.error('Error loading learning data:', error.message);
  }
}

function saveLearningData() {
  try {
    const state = {
      adaptiveWeights: ultimatePredictorV4.supraEnsemble.adaptiveWeights,
      performance: ultimatePredictorV4.supraEnsemble.performance,
      timestamp: Date.now(),
      version: '4.0'
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

// === HÀM DỰ ĐOÁN ===
async function calculatePrediction(data, type) {
  return await ultimatePredictorV4.predict(data, type);
}

function savePredictionToHistory(type, phien, prediction, confidence, latestData) {
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
}

async function updateHistoryStatus(type) {
  let data = (type === 'hu') ? await fetchDataHu() : await fetchDataMd5();
  if (!data) return;
  for (let record of predictionHistory[type]) {
    if (record.ket_qua_du_doan && record.ket_qua_du_doan !== '') continue;
    const actual = data.find(d => d.Phien.toString() === record.Phien_hien_tai);
    if (actual) {
      const wasCorrect = record.Du_doan === actual.Ket_qua;
      record.ket_qua_du_doan = wasCorrect ? 'Đúng ✅' : 'Sai ❌';
      ultimatePredictorV4.updateResult(record.Du_doan, actual.Ket_qua, wasCorrect, type);
    }
  }
  savePredictionHistory();
  saveLearningData();
}

async function autoProcessPredictions() {
  try {
    const dataHu = await fetchDataHu();
    if (dataHu && dataHu.length > 0) {
      const nextPhien = dataHu[0].Phien + 1;
      if (lastProcessedPhien.hu !== nextPhien) {
        const result = await calculatePrediction(dataHu, 'hu');
        savePredictionToHistory('hu', nextPhien, result.prediction, result.confidence, dataHu[0]);
        lastProcessedPhien.hu = nextPhien;
        console.log(`[Auto] Hu phiên ${nextPhien}: ${result.prediction} (${result.confidence}%)`);
      }
    }
    const dataMd5 = await fetchDataMd5();
    if (dataMd5 && dataMd5.length > 0) {
      const nextPhien = dataMd5[0].Phien + 1;
      if (lastProcessedPhien.md5 !== nextPhien) {
        const result = await calculatePrediction(dataMd5, 'md5');
        savePredictionToHistory('md5', nextPhien, result.prediction, result.confidence, dataMd5[0]);
        lastProcessedPhien.md5 = nextPhien;
        console.log(`[Auto] MD5 phiên ${nextPhien}: ${result.prediction} (${result.confidence}%)`);
      }
    }
    savePredictionHistory();
  } catch (error) {
    console.error('[Auto] Error:', error.message);
  }
}

function startAutoSaveTask() {
  setTimeout(autoProcessPredictions, 5000);
  setInterval(autoProcessPredictions, AUTO_SAVE_INTERVAL);
}

// ==================== ENDPOINTS ====================
app.get('/', (req, res) => res.send('t.me/anhkhoi'));

app.get('/hu', async (req, res) => {
  try {
    const data = await fetchDataHu();
    if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    const nextPhien = data[0].Phien + 1;
    const result = await calculatePrediction(data, 'hu');
    const record = savePredictionToHistory('hu', nextPhien, result.prediction, result.confidence, data[0]);
    setTimeout(() => updateHistoryStatus('hu'), 5000);
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

app.get('/md5', async (req, res) => {
  try {
    const data = await fetchDataMd5();
    if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    const nextPhien = data[0].Phien + 1;
    const result = await calculatePrediction(data, 'md5');
    const record = savePredictionToHistory('md5', nextPhien, result.prediction, result.confidence, data[0]);
    setTimeout(() => updateHistoryStatus('md5'), 5000);
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

app.get('/hu/lichsu', async (req, res) => {
  await updateHistoryStatus('hu');
  res.json({ type: 'Lẩu Cua 79 - Tài Xỉu Hũ', history: predictionHistory.hu, total: predictionHistory.hu.length, id: '@anhkhoi' });
});

app.get('/md5/lichsu', async (req, res) => {
  await updateHistoryStatus('md5');
  res.json({ type: 'Lẩu Cua 79 - Tài Xỉu MD5', history: predictionHistory.md5, total: predictionHistory.md5.length, id: '@anhkhoi' });
});

app.get('/hu/thamso', async (req, res) => {
  const data = await fetchDataHu();
  if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
  const result = await calculatePrediction(data, 'hu');
  res.json({ prediction: result.prediction, confidence: result.confidence, factors: result.factors, analysis: result.detailedAnalysis });
});

app.get('/md5/thamso', async (req, res) => {
  const data = await fetchDataMd5();
  if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
  const result = await calculatePrediction(data, 'md5');
  res.json({ prediction: result.prediction, confidence: result.confidence, factors: result.factors, analysis: result.detailedAnalysis });
});

app.get('/hu/hochoi', (req, res) => {
  const weights = ultimatePredictorV4.supraEnsemble.adaptiveWeights;
  res.json({ type: 'HU Learning - Ultimate V4', adaptiveWeights: weights, id: '@anhkhoi' });
});

app.get('/md5/hochoi', (req, res) => {
  const weights = ultimatePredictorV4.supraEnsemble.adaptiveWeights;
  res.json({ type: 'MD5 Learning - Ultimate V4', adaptiveWeights: weights, id: '@anhkhoi' });
});

app.get('/resetdata', (req, res) => {
  // Reset sẽ được thực hiện khi restart server
  res.json({ message: 'Vui lòng restart server để reset learning data', id: '@anhkhoi' });
});

// KHỞI ĐỘNG
loadLearningData();
loadPredictionHistory();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server @anhkhoi running on http://0.0.0.0:${PORT}`);
  console.log('✅ Ultimate Predictor V4.0 - Deep Belief Network + ANFIS + OSELM + WaveletNN + HTM + ESN + QuantumNN + Ensemble');
  startAutoSaveTask();
});
