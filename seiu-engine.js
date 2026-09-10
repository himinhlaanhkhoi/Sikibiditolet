const lastN = (arr, n) => arr.slice(Math.max(0, arr.length - n));
const sum = (nums) => nums.reduce((a, b) => a + b, 0);
const avg = (nums) => nums.length ? sum(nums) / nums.length : 0;
const std = (nums) => {
  if (!nums.length) return 0;
  const m = avg(nums);
  return Math.sqrt(avg(nums.map(n => (n - m) ** 2)));
};

const entropy = (arr) => {
  if (!arr.length) return 0;
  const freq = arr.reduce((a, v) => ({ ...a, [v]: (a[v] || 0) + 1 }), {});
  let e = 0;
  for (const k in freq) {
    const p = freq[k] / arr.length;
    e -= p * Math.log2(p);
  }
  return e;
};

const majority = (obj) => {
  let maxK = null, maxV = -Infinity;
  for (const k in obj) if (obj[k] > maxV) { maxV = obj[k]; maxK = k; }
  return { key: maxK, val: maxV };
};

const similarity = (a, b) => {
  if (a.length !== b.length) return 0;
  let m = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) m++;
  return m / a.length;
};

export class SeiuEngineV16 {
  constructor() {
    this.weights = {};
    this.perfHistory = {};
    this.emaAlpha = 0.08;
    this.minWeight = 0.0001;
    
    this.diceStats = { 
      pos: [{}, {}, {}],
      pairs: {},
      triples: {},
      totalCount: 0
    };
    
    this.algs = [
      { id: 'freq_rebalance', fn: this.algo1.bind(this) },
      { id: 'markov_adaptive', fn: this.algo2.bind(this) },
      { id: 'ngram_weighted', fn: this.algo3.bind(this) },
      { id: 'neo_pattern', fn: this.algo4.bind(this) },
      { id: 'entropy_deep', fn: this.algo5.bind(this) },
      { id: 'transformer', fn: this.algo6.bind(this) },
      { id: 'run_length', fn: this.algo7.bind(this) },
      { id: 'bayesian', fn: this.algo8.bind(this) },
      { id: 'dice_pattern_learning', fn: this.algoDicePattern.bind(this) },
      { id: 'adaptive_bridge', fn: this.algoBridge.bind(this) },
      { id: 'regime_detector', fn: this.algo10.bind(this) },
      { id: 'gradient_cascade', fn: this.algo11.bind(this) },
      { id: 'quantum_superposition', fn: this.algo12.bind(this) },
      { id: 'phase_lock', fn: this.algo13.bind(this) },
      { id: 'vector_momentum', fn: this.algo14.bind(this) }
    ];

    for (const a of this.algs) {
      this.weights[a.id] = 1;
      this.perfHistory[a.id] = [];
    }
  }

  parseLines(data) {
    if (!data?.data?.resultList?.length) return [];
    const sorted = data.data.resultList.sort((a, b) => 
      parseInt(b.gameNum.slice(1)) - parseInt(a.gameNum.slice(1))
    );

    return sorted.map(item => {
      const total = item.score ?? 0;
      let tx, result;
      
      if (total >= 3 && total <= 10) {
        tx = 'X';
        result = 'XIU';
      } else if (total >= 11 && total <= 18) {
        tx = 'T';
        result = 'TAI';
      } else {
        tx = 'B';
        result = 'BAO';
      }
      
      const dice = Array.isArray(item.facesList) ? item.facesList : 
                   (typeof item.keyR === 'string' ? item.keyR.split('-').map(Number) : [0, 0, 0]);

      return { session: parseInt(item.gameNum.slice(1)), dice, total, result, tx };
    }).sort((a, b) => a.session - b.session);
  }

  updateDiceStats(record) {
    if (record.tx === 'B') return;
    
    this.diceStats.totalCount++;
    
    for (let i = 0; i < 3; i++) {
      const d = record.dice[i];
      this.diceStats.pos[i][d] = (this.diceStats.pos[i][d] || 0) + 1;
    }

    const pairKey = `${record.dice[0]}-${record.dice[1]}`;
    this.diceStats.pairs[pairKey] = (this.diceStats.pairs[pairKey] || 0) + 1;

    const tripleKey = record.dice.join('-');
    this.diceStats.triples[tripleKey] = (this.diceStats.triples[tripleKey] || 0) + 1;
  }

  getDiceStats() {
    const stats = {};
    for (let i = 0; i < 3; i++) {
      const dist = this.diceStats.pos[i];
      const freq = Object.values(dist);
      stats[`pos_${i}`] = {
        mean: avg(freq.map((f, idx) => (idx + 1) * f / sum(freq))),
        entropy: entropy(freq)
      };
    }
    return stats;
  }

  extractFeatures(hist) {
    const filtered = hist.filter(h => h.tx !== 'B');
    const tx = filtered.map(h => h.tx);
    const totals = filtered.map(h => h.total);
    const freq = tx.reduce((a, v) => ({ ...a, [v]: (a[v] || 0) + 1 }), {});

    let runs = [], cur = tx[0], len = 1;
    for (let i = 1; i < tx.length; i++) {
      if (tx[i] === cur) len++;
      else { runs.push({ val: cur, len }); cur = tx[i]; len = 1; }
    }
    if (tx.length) runs.push({ val: cur, len });

    return {
      tx, totals, freq, runs,
      maxRun: runs.reduce((m, r) => Math.max(m, r.len), 0) || 0,
      meanTotal: avg(totals),
      stdTotal: std(totals),
      entropy: entropy(tx)
    };
  }

  algoDicePattern(hist) {
    if (hist.length < 50) return null;
    
    const filtered = hist.filter(h => h.tx !== 'B');
    const recent = filtered.slice(-20);
    
    let sumDice = [0, 0, 0];
    for (const r of recent) {
      for (let i = 0; i < 3; i++) {
        sumDice[i] += r.dice[i];
      }
    }
    
    const avgDice = sumDice.map(s => s / recent.length);
    const predictedTotal = avg(avgDice) * 3;
    
    if (predictedTotal < 7) return 'X';
    if (predictedTotal > 14) return 'T';
    
    const histTotals = filtered.slice(-30).map(r => r.total);
    const volTotal = std(histTotals);
    
    if (volTotal < 2 && predictedTotal < 10.5) return 'X';
    if (volTotal < 2 && predictedTotal > 11.5) return 'T';
    
    return null;
  }

  algoBridge(hist) {
    if (hist.length < 20) return null;
    
    const filtered = hist.filter(h => h.tx !== 'B');
    const tx = filtered.map(h => h.tx);
    
    let runs = [], cur = tx[0], len = 1;
    for (let i = 1; i < tx.length; i++) {
      if (tx[i] === cur) len++;
      else { runs.push({ val: cur, len }); cur = tx[i]; len = 1; }
    }
    if (tx.length) runs.push({ val: cur, len });
    
    if (runs.length < 2) return null;
    
    const last = runs.at(-1);
    const prev = runs.at(-2);
    const recent = runs.slice(-5);
    
    const avgLen = avg(recent.map(r => r.len));
    const maxLen = Math.max(...recent.map(r => r.len));
    
    if (last.len >= maxLen && last.len >= 3) {
      return last.val;
    }
    
    if (last.len === 1 && prev?.len >= 2) {
      const alternation = recent.filter((r, i) => i === 0 || r.val !== recent[i - 1].val).length;
      if (alternation >= 4) {
        return last.val === 'T' ? 'X' : 'T';
      }
    }
    
    if (last.len < avgLen * 0.5 && prev?.len > avgLen * 1.5) {
      return prev.val;
    }
    
    return null;
  }

  algo1(hist) {
    const { tx } = this.extractFeatures(hist);
    const freq = tx.reduce((a, v) => ({ ...a, [v]: (a[v] || 0) + 1 }), {});
    if ((freq['T'] || 0) > (freq['X'] || 0) + 2) return 'X';
    if ((freq['X'] || 0) > (freq['T'] || 0) + 2) return 'T';
    return null;
  }

  algo2(hist) {
    const { tx } = this.extractFeatures(hist);
    for (let order = 3; order >= 2; order--) {
      if (tx.length < order + 1) continue;
      const trans = {};
      for (let i = 0; i <= tx.length - order - 1; i++) {
        const key = tx.slice(i, i + order).join('');
        const next = tx[i + order];
        trans[key] = trans[key] || { t: 0, x: 0 };
        trans[key][next.toLowerCase()]++;
      }
      const lastKey = tx.slice(-order).join('');
      const counts = trans[lastKey];
      if (counts && (counts.t || counts.x)) return counts.t > counts.x ? 'T' : 'X';
    }
    return null;
  }

  algo3(hist) {
    const { tx } = this.extractFeatures(hist);
    if (tx.length < 5) return null;
    for (const k of [3, 4, 5]) {
      if (tx.length < k + 1) continue;
      const lastGram = tx.slice(-k).join('');
      let counts = { t: 0, x: 0 }, matches = 0;
      for (let i = 0; i <= tx.length - k - 1; i++) {
        const gram = tx.slice(i, i + k).join('');
        if (similarity(gram, lastGram) >= 0.8) {
          counts[tx[i + k].toLowerCase()]++;
          matches++;
        }
      }
      if (matches > 2 && counts.t !== counts.x) return counts.t > counts.x ? 'T' : 'X';
    }
    return null;
  }

  algo4(hist) {
    const { tx } = this.extractFeatures(hist);
    if (tx.length < 20) return null;
    for (const patLen of [4, 6, 8]) {
      if (tx.length < patLen * 2 + 1) continue;
      const target = tx.slice(-patLen).join('');
      let counts = { t: 0, x: 0 }, matches = 0;
      for (let i = 0; i <= tx.length - patLen - 1; i++) {
        const hist_pat = tx.slice(i, i + patLen).join('');
        const score = similarity(hist_pat, target);
        if (score >= 0.75 && i + patLen < tx.length) {
          counts[tx[i + patLen].toLowerCase()] += score;
          matches++;
        }
      }
      if (matches > 0 && counts.t !== counts.x) return counts.t > counts.x ? 'T' : 'X';
    }
    return null;
  }

  algo5(hist) {
    if (hist.length < 70) return null;
    const feat = this.extractFeatures(hist);
    const { totals, meanTotal, entropy: ent } = feat;
    const recent = avg(totals.slice(-30));
    if (recent > 14 && meanTotal > 11.5) return 'X';
    if (recent < 7 && meanTotal < 10.5) return 'T';
    if (ent > 0.99) return feat.tx.at(-1) === 'T' ? 'X' : 'T';
    if (ent < 0.3) return feat.tx.at(-1) === 'T' ? 'T' : 'X';
    return null;
  }

  algo6(hist) {
    const { tx } = this.extractFeatures(hist);
    if (tx.length < 100) return null;
    const target = tx.slice(-10).join('');
    let counts = { t: 0, x: 0 }, weight = 0;
    for (let i = 0; i <= tx.length - 11; i++) {
      const seq = tx.slice(i, i + 10).join('');
      const score = similarity(seq, target);
      if (score > 0.6) {
        const w = score * (i + 1) / tx.length;
        counts[tx[i + 10].toLowerCase()] = (counts[tx[i + 10].toLowerCase()] || 0) + w;
        weight += w;
      }
    }
    return weight > 0 && counts.t !== counts.x ? (counts.t > counts.x ? 'T' : 'X') : null;
  }

  algo7(hist) {
    const { runs } = this.extractFeatures(hist);
    if (runs.length < 2) return null;
    const last = runs.at(-1);
    const recent = runs.slice(-5).map(r => r.len);
    const avgRun = avg(recent);
    const stdRun = std(recent);
    if (last.len > avgRun + stdRun) return last.val;
    if (last.len === 1 && runs.length >= 3) {
      const alt = runs.slice(-5).filter((r, i) => i === 0 || r.val !== runs[runs.length - 5 + i - 1].val).length;
      if (alt >= 3) return last.val === 'T' ? 'X' : 'T';
    }
    return null;
  }

  algo8(hist) {
    const { tx } = this.extractFeatures(hist);
    if (tx.length < 20) return null;
    const recent = tx.slice(-10);
    const freqRecent = recent.reduce((a, v) => ({ ...a, [v]: (a[v] || 0) + 1 }), {});
    const posteriorT = (freqRecent['T'] || 0) / 10;
    const posteriorX = (freqRecent['X'] || 0) / 10;
    if (Math.abs(posteriorT - posteriorX) > 0.1) return posteriorT > posteriorX ? 'T' : 'X';
    return null;
  }

  algo10(hist) {
    const feat = this.extractFeatures(hist);
    const { tx, entropy: ent } = feat;
    if (tx.length < 30) return null;
    const recent30 = entropy(tx.slice(-30));
    const ratio = recent30 / (ent || 1);
    if (ratio > 1.15 && feat.maxRun < 4) return tx.at(-1) === 'T' ? 'X' : 'T';
    if (ratio < 0.85 && feat.maxRun >= 3) return feat.runs.at(-1)?.val || null;
    return null;
  }

  algo11(hist) {
    const { tx } = this.extractFeatures(hist);
    if (tx.length < 40) return null;
    const segSize = Math.floor(tx.length / 5);
    let trend = 0;
    for (let i = 0; i < 5; i++) {
      const start = i * segSize;
      const end = i === 4 ? tx.length : (i + 1) * segSize;
      const seg = tx.slice(start, end);
      const freq = seg.reduce((a, v) => ({ ...a, [v]: (a[v] || 0) + 1 }), {});
      const ratio = (freq['T'] || 0) / seg.length;
      if (i === 4) trend = ratio - (seg.slice(0, 1).reduce((a, v) => a + (v === 'T' ? 1 : 0), 0) / 1);
    }
    if (trend > 0.15) return 'X';
    if (trend < -0.15) return 'T';
    return null;
  }

  algo12(hist) {
    const { tx } = this.extractFeatures(hist);
    if (tx.length < 50) return null;
    const recent = tx.slice(-20);
    const tCount = recent.filter(x => x === 'T').length;
    const votes = [tCount > 10 ? 'X' : 'T'];
    const cycles = 4;
    if (tx.length > cycles * 3) {
      const outcomes = [];
      for (let i = (tx.length - 1) % cycles; i < tx.length; i += cycles) {
        if (i + 1 < tx.length) outcomes.push(tx[i + 1]);
      }
      if (outcomes.length > 0) {
        const freq = outcomes.reduce((a, v) => ({ ...a, [v]: (a[v] || 0) + 1 }), {});
        votes.push((freq['T'] || 0) > (freq['X'] || 0) ? 'T' : 'X');
      }
    }
    const freq = votes.reduce((a, v) => ({ ...a, [v]: (a[v] || 0) + 1 }), {});
    return (freq['T'] || 0) > (freq['X'] || 0) ? 'T' : 'X';
  }

  algo13(hist) {
    const { runs, tx } = this.extractFeatures(hist);
    if (runs.length < 3) return null;
    const len = runs.map(r => r.len);
    const period = Math.round(avg(len));
    if (period < 2 || period > 10) return null;
    const phase = runs.length % period;
    if (phase === 0) return runs.at(-1).val;
    return runs.at(-2)?.val || null;
  }

  algo14(hist) {
    const { tx } = this.extractFeatures(hist);
    if (tx.length < 40) return null;
    const slices = [tx.slice(-40, -20), tx.slice(-20)];
    const moms = slices.map(s => {
      const freq = s.reduce((a, v) => ({ ...a, [v]: (a[v] || 0) + 1 }), {});
      return (freq['T'] || 0) - (freq['X'] || 0);
    });
    if (Math.sign(moms[0]) === Math.sign(moms[1]) && moms[1] !== 0) {
      return moms[1] > 0 ? 'T' : 'X';
    }
    return null;
  }

  fitInitial(hist) {
    const window = lastN(hist.filter(h => h.tx !== 'B'), 500);
    if (window.length < 10) return;

    const scores = {};
    for (const a of this.algs) scores[a.id] = 0;

    for (let i = 3; i < window.length; i++) {
      const prefix = window.slice(0, i);
      const actual = window[i].tx;
      for (const a of this.algs) {
        const pred = a.fn(prefix);
        if (pred === actual) scores[a.id]++;
        this.perfHistory[a.id].push(pred === actual ? 1 : 0);
      }
    }

    let total = 0;
    for (const id in scores) {
      const w = (scores[id] || 0) + 0.5;
      this.weights[id] = w;
      total += w;
    }
    for (const id in this.weights) {
      this.weights[id] = Math.max(this.minWeight, this.weights[id] / total);
    }
  }

  updateOutcome(prefix, actual) {
    if (actual === 'B') return;
    for (const a of this.algs) {
      const pred = a.fn(prefix);
      const correct = pred === actual ? 1 : 0;
      const curr = this.weights[a.id] || this.minWeight;
      const reward = correct ? 1.08 : 0.92;
      const nw = this.emaAlpha * (curr * reward) + (1 - this.emaAlpha) * curr;
      this.weights[a.id] = Math.max(this.minWeight, nw);
      this.perfHistory[a.id].push(correct);
      if (this.perfHistory[a.id].length > 200) this.perfHistory[a.id].shift();
    }
    const s = Object.values(this.weights).reduce((a, b) => a + b, 0) || 1;
    for (const id in this.weights) this.weights[id] /= s;
  }

  predictScores(hist, tx) {
    if (hist.length < 30) return tx === 'T' ? [13, 14, 15] : [6, 7, 8];
    
    const scores = tx === 'T' ? [11, 12, 13, 14, 15, 16, 17, 18] : [3, 4, 5, 6, 7, 8, 9, 10];
    let counts = {};
    let matchCount = 0;
    const lookback = Math.min(hist.length, 150);

    for (let i = hist.length - 2; i >= hist.length - lookback && i >= 0; i--) {
      if (hist[i].tx === tx && scores.includes(hist[i + 1].total)) {
        const age = hist.length - 1 - i;
        const decay = 1.0 - (age / (lookback + 1));
        counts[hist[i + 1].total] = (counts[hist[i + 1].total] || 0) + decay;
        matchCount++;
      }
    }

    if (matchCount < 3) {
      const center = avg(scores);
      return scores.slice(0, 3).sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
    }

    const sorted = Object.keys(counts)
      .sort((a, b) => counts[b] - counts[a])
      .map(Number)
      .slice(0, 3);

    while (sorted.length < 3) {
      const used = new Set(sorted);
      const remaining = scores.filter(s => !used.has(s));
      const center = avg(scores);
      remaining.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
      if (remaining.length) sorted.push(remaining.shift());
      else break;
    }

    return sorted.length >= 3 ? sorted : scores.slice(0, 3);
  }

  predict(hist) {
    const votes = {}, votedBy = [];
    for (const a of this.algs) {
      const pred = a.fn(hist);
      if (pred) { 
        votes[pred] = (votes[pred] || 0) + (this.weights[a.id] || 0); 
        votedBy.push(a.id); 
      }
    }

    let best, confidence;
    if (!votes['T'] && !votes['X']) {
      best = this.algo1(hist) || 'T';
      confidence = 0.50;
    } else {
      const res = majority(votes);
      best = res.key;
      const total = Object.values(votes).reduce((a, b) => a + b, 0);
      confidence = Math.min(0.99, Math.max(0.51, total > 0 ? res.val / total : 0.51));
    }

    const feat = this.extractFeatures(hist);
    const regime = feat.entropy > 0.98 ? 'high_entropy' : feat.entropy < 0.4 ? 'low_entropy' : 'neutral';
    
    const diceTrend = this.algoDicePattern(hist) || 'neutral';
    const bridgeStatus = this.algoBridge(hist) ? 'active' : 'idle';
    
    const scorePred = this.predictScores(hist, best);

    return {
      prediction: best === 'T' ? 'tài' : 'xỉu',
      confidence,
      scorePrediction: scorePred,
      meta: { 
        regime, 
        votedBy: [...new Set(votedBy)],
        diceTrend,
        bridgeStatus
      }
    };
  }
}
