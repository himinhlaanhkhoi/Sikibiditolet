const sum = a => a.reduce((x, y) => x + y, 0);
const avg = a => a.length ? sum(a) / a.length : 0;
const med = a => a.length ? (a.sort((x, y) => x - y)[Math.floor(a.length / 2)]) : 0;
const std = a => a.length ? Math.sqrt(avg(a.map(v => (v - avg(a)) ** 2))) : 0;
const variance = a => a.length ? avg(a.map(v => (v - avg(a)) ** 2)) : 0;
const entropy = a => {
  if (!a.length) return 0;
  const f = a.reduce((o, v) => ((o[v] = (o[v] || 0) + 1), o), {});
  let e = 0;
  for (const k in f) {
    const p = f[k] / a.length;
    e -= p * Math.log2(p);
  }
  return e;
};
const majority = o => {
  let k = null, v = -Infinity;
  for (const key in o) if (o[key] > v) { v = o[key]; k = key; }
  return { key: k, val: v };
};
const similarity = (a, b) => {
  if (a.length !== b.length) return 0;
  let m = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) m++;
  return m / a.length;
};
const lastN = (a, n) => a.slice(Math.max(0, a.length - n));
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

export class SeiuEngineV18 {
  constructor() {
    this.weights = {};
    this.perfHistory = {};
    this.emaAlpha = 0.12;
    this.minWeight = 0.0001;
    this.learningRate = 0.0015;
    
    this.stats = {
      dicePos: [{}, {}, {}],
      pairs: {},
      triples: {},
      scores: { 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0, 15: 0, 16: 0, 17: 0, 18: 0 },
      totalCount: 0,
      taiCount: 0,
      xiuCount: 0
    };

    this.algs = [
      { id: 'freq_basic', fn: this.freq.bind(this), weight: 0.8 },
      { id: 'markov_2order', fn: this.markov2.bind(this), weight: 1.0 },
      { id: 'markov_3order', fn: this.markov3.bind(this), weight: 1.2 },
      { id: 'ngram_similarity', fn: this.ngramSim.bind(this), weight: 0.9 },
      { id: 'pattern_match', fn: this.patternMatch.bind(this), weight: 1.1 },
      { id: 'entropy_analysis', fn: this.entropyAnalysis.bind(this), weight: 0.95 },
      { id: 'transformer_seq', fn: this.transformer.bind(this), weight: 1.05 },
      { id: 'run_detect', fn: this.runDetect.bind(this), weight: 0.85 },
      { id: 'bayesian_inference', fn: this.bayesian.bind(this), weight: 1.15 },
      { id: 'dice_sum_model', fn: this.diceSumModel.bind(this), weight: 1.1 },
      { id: 'dice_dist_learning', fn: this.diceDistLearning.bind(this), weight: 1.0 },
      { id: 'bridge_adaptive', fn: this.bridgeAdaptive.bind(this), weight: 1.2 },
      { id: 'regime_shift', fn: this.regimeShift.bind(this), weight: 0.9 },
      { id: 'momentum_trend', fn: this.momentumTrend.bind(this), weight: 0.95 },
      { id: 'quantum_ensemble', fn: this.quantumEnsemble.bind(this), weight: 1.05 },
      { id: 'phase_detector', fn: this.phaseDetector.bind(this), weight: 0.85 },
      { id: 'decay_weighted', fn: this.decayWeighted.bind(this), weight: 1.0 },
      { id: 'volatility_model', fn: this.volatilityModel.bind(this), weight: 0.9 },
      { id: 'score_regression', fn: this.scoreRegression.bind(this), weight: 1.08 },
      { id: 'break_detector', fn: this.breakDetector.bind(this), weight: 1.02 }
    ];

    for (const a of this.algs) {
      this.weights[a.id] = 1.0;
      this.perfHistory[a.id] = [];
    }
  }

  parseLines(data) {
    if (!data?.data?.resultList?.length) return [];
    const sorted = [...data.data.resultList].sort((a, b) => parseInt(b.gameNum.slice(1)) - parseInt(a.gameNum.slice(1)));
    return sorted.map(item => {
      const total = item.score ?? 0;
      let tx, result;
      if (total >= 3 && total <= 10) { tx = 'X'; result = 'XIU'; }
      else if (total >= 11 && total <= 18) { tx = 'T'; result = 'TAI'; }
      else { tx = 'B'; result = 'BAO'; }
      const dice = Array.isArray(item.facesList) ? item.facesList :
        (typeof item.keyR === 'string' ? item.keyR.split('-').map(Number) : [0, 0, 0]);
      return { session: parseInt(item.gameNum.slice(1)), dice, total, result, tx };
    }).sort((a, b) => a.session - b.session);
  }

  updateStats(r) {
    if (r.tx === 'B') return;
    this.stats.totalCount++;
    r.tx === 'T' ? this.stats.taiCount++ : this.stats.xiuCount++;
    this.stats.scores[r.total]++;
    for (let i = 0; i < 3; i++) this.stats.dicePos[i][r.dice[i]] = (this.stats.dicePos[i][r.dice[i]] || 0) + 1;
    const pk = `${r.dice[0]}-${r.dice[1]}`;
    this.stats.pairs[pk] = (this.stats.pairs[pk] || 0) + 1;
    const tk = r.dice.join('-');
    this.stats.triples[tk] = (this.stats.triples[tk] || 0) + 1;
  }

  extractTx(hist) {
    return hist.filter(h => h.tx !== 'B').map(h => h.tx);
  }

  extractTotals(hist) {
    return hist.filter(h => h.tx !== 'B').map(h => h.total);
  }

  freq(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 5) return null;
    const f = tx.reduce((o, v) => ((o[v] = (o[v] || 0) + 1), o), {});
    if ((f['T'] || 0) > (f['X'] || 0) + 3) return 'X';
    if ((f['X'] || 0) > (f['T'] || 0) + 3) return 'T';
    return null;
  }

  markov2(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 3) return null;
    const trans = {};
    for (let i = 0; i <= tx.length - 3; i++) {
      const key = tx[i] + tx[i + 1];
      trans[key] = trans[key] || { t: 0, x: 0 };
      trans[key][tx[i + 2].toLowerCase()]++;
    }
    const lastKey = tx.at(-2) + tx.at(-1);
    const c = trans[lastKey];
    return c && (c.t || c.x) ? (c.t > c.x ? 'T' : 'X') : null;
  }

  markov3(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 4) return null;
    const trans = {};
    for (let i = 0; i <= tx.length - 4; i++) {
      const key = tx[i] + tx[i + 1] + tx[i + 2];
      trans[key] = trans[key] || { t: 0, x: 0 };
      trans[key][tx[i + 3].toLowerCase()]++;
    }
    const lastKey = tx.at(-3) + tx.at(-2) + tx.at(-1);
    const c = trans[lastKey];
    return c && (c.t || c.x) ? (c.t > c.x ? 'T' : 'X') : null;
  }

  ngramSim(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 6) return null;
    for (const k of [3, 4, 5, 6]) {
      if (tx.length < k + 1) continue;
      const target = tx.slice(-k).join('');
      let c = { t: 0, x: 0 }, m = 0;
      for (let i = 0; i <= tx.length - k - 1; i++) {
        const s = similarity(tx.slice(i, i + k).join(''), target);
        if (s >= 0.75) { c[tx[i + k].toLowerCase()] += s; m++; }
      }
      if (m >= 2 && c.t !== c.x) return c.t > c.x ? 'T' : 'X';
    }
    return null;
  }

  patternMatch(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 15) return null;
    const patterns = {};
    for (let len = 4; len <= 8; len++) {
      for (let i = 0; i <= tx.length - len - 1; i++) {
        const pat = tx.slice(i, i + len).join('');
        const next = tx[i + len];
        patterns[pat] = patterns[pat] || { t: 0, x: 0 };
        patterns[pat][next.toLowerCase()]++;
      }
    }
    const recent = tx.slice(-6).join('');
    let best = null, bestScore = 0;
    for (const pat in patterns) {
      const s = similarity(pat, recent);
      if (s > 0.6) {
        const score = patterns[pat].t + patterns[pat].x;
        if (score > bestScore) {
          bestScore = score;
          best = patterns[pat].t > patterns[pat].x ? 'T' : 'X';
        }
      }
    }
    return best;
  }

  entropyAnalysis(hist) {
    if (hist.length < 40) return null;
    const tx = this.extractTx(hist);
    const ent = entropy(tx);
    const recent20 = entropy(tx.slice(-20));
    const ratio = recent20 / (ent || 1);
    if (ratio > 1.2 && tx.at(-1) === 'T') return 'X';
    if (ratio > 1.2 && tx.at(-1) === 'X') return 'T';
    if (ratio < 0.8 && tx.at(-1) === 'T') return 'T';
    if (ratio < 0.8 && tx.at(-1) === 'X') return 'X';
    return null;
  }

  transformer(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 80) return null;
    const target = tx.slice(-15).join('');
    let c = { t: 0, x: 0 }, w = 0;
    for (let i = 0; i <= tx.length - 16; i++) {
      const s = similarity(tx.slice(i, i + 15).join(''), target);
      if (s > 0.65) {
        const ww = s * (i + 1) / tx.length;
        c[tx[i + 15].toLowerCase()] = (c[tx[i + 15].toLowerCase()] || 0) + ww;
        w += ww;
      }
    }
    return w > 0 && c.t !== c.x ? (c.t > c.x ? 'T' : 'X') : null;
  }

  runDetect(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 15) return null;
    let runs = [], cur = tx[0], len = 1;
    for (let i = 1; i < tx.length; i++) {
      if (tx[i] === cur) len++; else { runs.push({ val: cur, len }); cur = tx[i]; len = 1; }
    }
    if (tx.length) runs.push({ val: cur, len });
    const last = runs.at(-1);
    const recent = runs.slice(-8).map(r => r.len);
    const avgLen = avg(recent), stdLen = std(recent);
    if (last.len >= avgLen + stdLen) return last.val;
    if (last.len === 1 && runs.length >= 4) {
      const alt = runs.slice(-6).filter((r, i) => i === 0 || r.val !== runs[runs.length - 6 + i - 1].val).length;
      if (alt >= 4) return last.val === 'T' ? 'X' : 'T';
    }
    return null;
  }

  bayesian(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 25) return null;
    const priorT = this.stats.taiCount / (this.stats.totalCount || 1);
    const priorX = this.stats.xiuCount / (this.stats.totalCount || 1);
    const recent10 = tx.slice(-10);
    const freqRecent = recent10.reduce((o, v) => ((o[v] = (o[v] || 0) + 1), o), {});
    const likelihoodT = (freqRecent['T'] || 0) / 10;
    const likelihoodX = (freqRecent['X'] || 0) / 10;
    const denom = likelihoodT * priorT + likelihoodX * priorX || 1;
    const posteriorT = (likelihoodT * priorT) / denom;
    const posteriorX = (likelihoodX * priorX) / denom;
    if (Math.abs(posteriorT - posteriorX) > 0.12) return posteriorT > posteriorX ? 'T' : 'X';
    return null;
  }

  diceSumModel(hist) {
    if (hist.length < 50) return null;
    const filtered = hist.filter(h => h.tx !== 'B');
    const recent = filtered.slice(-30);
    const meanSum = avg(recent.map(r => r.total));
    const stdSum = std(recent.map(r => r.total));
    if (meanSum > 12.5 && stdSum < 2.8) return 'T';
    if (meanSum < 8.5 && stdSum < 2.8) return 'X';
    return null;
  }

  diceDistLearning(hist) {
    if (hist.length < 60 || this.stats.totalCount < 30) return null;
    let sumPos = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      const dist = this.stats.dicePos[i];
      let totalVal = 0, totalCount = 0;
      for (const d in dist) {
        totalVal += parseInt(d) * dist[d];
        totalCount += dist[d];
      }
      sumPos[i] = totalCount ? totalVal / totalCount : 3.5;
    }
    const predictedSum = sumPos[0] + sumPos[1] + sumPos[2];
    if (predictedSum <= 8.5) return 'X';
    if (predictedSum >= 11.5) return 'T';
    return null;
  }

  bridgeAdaptive(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 20) return null;
    let runs = [], cur = tx[0], len = 1;
    for (let i = 1; i < tx.length; i++) {
      if (tx[i] === cur) len++; else { runs.push({ val: cur, len }); cur = tx[i]; len = 1; }
    }
    if (tx.length) runs.push({ val: cur, len });
    if (runs.length < 3) return null;
    const last = runs.at(-1), prev = runs.at(-2);
    const recent = runs.slice(-7);
    const lengths = recent.map(r => r.len);
    const avgLen = avg(lengths), maxLen = Math.max(...lengths);
    if (last.len > maxLen && last.len >= 4) return last.val;
    if (last.len === 1 && prev?.len >= 3 && runs.length >= 5) {
      const alt = recent.filter((r, i) => i === 0 || r.val !== recent[i - 1].val).length;
      if (alt >= 5) return last.val === 'T' ? 'X' : 'T';
    }
    if (last.len < avgLen * 0.4 && prev?.len > avgLen * 1.8 && runs.length >= 4) return prev.val;
    return null;
  }

  regimeShift(hist) {
    if (hist.length < 50) return null;
    const tx = this.extractTx(hist);
    const ent = entropy(tx);
    const recent30 = entropy(tx.slice(-30));
    const ratio = recent30 / (ent || 1);
    const vol = std(this.extractTotals(hist).slice(-30));
    if (ratio > 1.25 && vol < 1.8) return tx.at(-1) === 'T' ? 'X' : 'T';
    if (ratio < 0.75 && vol > 2.5) return tx.at(-1);
    return null;
  }

  momentumTrend(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 40) return null;
    const seg1 = tx.slice(-40, -20), seg2 = tx.slice(-20);
    const m1 = seg1.filter(v => v === 'T').length - seg1.filter(v => v === 'X').length;
    const m2 = seg2.filter(v => v === 'T').length - seg2.filter(v => v === 'X').length;
    if (m1 !== 0 && m2 !== 0 && Math.sign(m1) === Math.sign(m2)) {
      if (Math.abs(m2) > Math.abs(m1)) return m2 > 0 ? 'T' : 'X';
    }
    return null;
  }

  quantumEnsemble(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 50) return null;
    const recent = tx.slice(-25);
    const votes = [];
    votes.push(recent.filter(v => v === 'T').length > 12 ? 'X' : 'T');
    const cycle = 5;
    if (tx.length > cycle * 4) {
      const outcomes = [];
      for (let i = (tx.length - 1) % cycle; i < tx.length; i += cycle) {
        if (i + 1 < tx.length) outcomes.push(tx[i + 1]);
      }
      if (outcomes.length >= 2) {
        const f = outcomes.reduce((o, v) => ((o[v] = (o[v] || 0) + 1), o), {});
        votes.push((f['T'] || 0) > (f['X'] || 0) ? 'T' : 'X');
      }
    }
    const f = votes.reduce((o, v) => ((o[v] = (o[v] || 0) + 1), o), {});
    return (f['T'] || 0) > (f['X'] || 0) ? 'T' : 'X';
  }

  phaseDetector(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 35) return null;
    let runs = [], cur = tx[0], len = 1;
    for (let i = 1; i < tx.length; i++) {
      if (tx[i] === cur) len++; else { runs.push({ val: cur, len }); cur = tx[i]; len = 1; }
    }
    if (tx.length) runs.push({ val: cur, len });
    const lens = runs.map(r => r.len);
    const period = Math.round(avg(lens));
    if (period < 2 || period > 12) return null;
    const phase = runs.length % period;
    return phase === 0 ? runs.at(-1)?.val : (runs.at(-2)?.val || null);
  }

  decayWeighted(hist) {
    if (hist.length < 30) return null;
    const tx = this.extractTx(hist);
    let c = { t: 0, x: 0 };
    const window = Math.min(tx.length, 100);
    for (let i = tx.length - window; i < tx.length; i++) {
      const age = tx.length - i;
      const decay = 1 - (age / (window + 1));
      c[tx[i].toLowerCase()] = (c[tx[i].toLowerCase()] || 0) + decay;
    }
    if (c.t === c.x) return null;
    return c.t > c.x ? 'T' : 'X';
  }

  volatilityModel(hist) {
    const totals = this.extractTotals(hist);
    if (totals.length < 50) return null;
    const recent = totals.slice(-35);
    const vol = std(recent);
    const mean = avg(recent);
    if (vol < 1.6 && mean > 13) return 'T';
    if (vol < 1.6 && mean < 8) return 'X';
    if (vol > 3.2) return null;
    return null;
  }

  scoreRegression(hist) {
    const totals = this.extractTotals(hist);
    if (totals.length < 60) return null;
    const recent40 = totals.slice(-40);
    const mean = avg(recent40);
    const trend = med(recent40.slice(-20)) - med(recent40.slice(0, 20));
    const target = mean * 0.5 + med(recent40) * 0.5 + trend * 0.2;
    if (target <= 9) return 'X';
    if (target >= 12) return 'T';
    return null;
  }

  breakDetector(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 30) return null;
    let runs = [], cur = tx[0], len = 1;
    for (let i = 1; i < tx.length; i++) {
      if (tx[i] === cur) len++; else { runs.push({ val: cur, len }); cur = tx[i]; len = 1; }
    }
    if (tx.length) runs.push({ val: cur, len });
    const recent = runs.slice(-10);
    const lens = recent.map(r => r.len);
    const mean = avg(lens), std_val = std(lens);
    const last = runs.at(-1);
    if (last.len < mean * 0.3 && std_val > 1.5) return last.val === 'T' ? 'X' : 'T';
    return null;
  }

  fitInitial(hist) {
    const window = lastN(hist.filter(h => h.tx !== 'B'), 500);
    if (window.length < 12) return;
    const scores = {};
    for (const a of this.algs) scores[a.id] = 0;
    for (let i = 4; i < window.length; i++) {
      const prefix = window.slice(0, i);
      const actual = window[i].tx;
      for (const a of this.algs) if (a.fn(prefix) === actual) scores[a.id]++;
    }
    let total = 0;
    for (const id in scores) {
      const w = (scores[id] || 0) + 1.5;
      this.weights[id] = w;
      total += w;
    }
    for (const id in this.weights) this.weights[id] = Math.max(this.minWeight, this.weights[id] / total);
  }

  updateOutcome(prefix, actual) {
    if (actual === 'B') return;
    for (const a of this.algs) {
      const correct = a.fn(prefix) === actual ? 1 : 0;
      const curr = this.weights[a.id] || this.minWeight;
      const reward = correct ? (1 + this.learningRate * 8) : (1 - this.learningRate * 3);
      const newW = this.emaAlpha * (curr * reward) + (1 - this.emaAlpha) * curr;
      this.weights[a.id] = Math.max(this.minWeight, newW);
      this.perfHistory[a.id].push(correct);
      if (this.perfHistory[a.id].length > 300) this.perfHistory[a.id].shift();
    }
    const s = Object.values(this.weights).reduce((a, b) => a + b, 0) || 1;
    for (const id in this.weights) this.weights[id] /= s;
  }

  predictScores(hist, tx) {
    if (hist.length < 40) return tx === 'T' ? [13, 14, 15] : [6, 7, 8];
    const scores = tx === 'T' ? [11, 12, 13, 14, 15, 16, 17, 18] : [3, 4, 5, 6, 7, 8, 9, 10];
    let counts = {}, match = 0;
    const lookback = Math.min(hist.length, 200);
    for (let i = hist.length - 2; i >= hist.length - lookback && i >= 0; i--) {
      if (hist[i].tx === tx && scores.includes(hist[i + 1].total)) {
        const age = hist.length - 1 - i;
        const decay = 1 - (age / (lookback + 1)) ** 1.3;
        counts[hist[i + 1].total] = (counts[hist[i + 1].total] || 0) + decay;
        match++;
      }
    }
    if (match < 5) {
      const c = avg(scores);
      return scores.slice(0, 3).sort((a, b) => Math.abs(a - c) - Math.abs(b - c));
    }
    const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).map(Number).slice(0, 3);
    while (sorted.length < 3) {
      const used = new Set(sorted);
      const rem = scores.filter(s => !used.has(s));
      const c = avg(scores);
      rem.sort((a, b) => Math.abs(a - c) - Math.abs(b - c));
      if (rem.length) sorted.push(rem.shift());
      else break;
    }
    return sorted.length >= 3 ? sorted : scores.slice(0, 3);
  }

  predict(hist) {
    if (hist.length < 4) return { prediction: 'chưa có dữ liệu', confidence: 0, scorePrediction: [], meta: {} };
    const votes = {}, votedBy = [];
    for (const a of this.algs) {
      const p = a.fn(hist);
      if (p) {
        votes[p] = (votes[p] || 0) + (this.weights[a.id] || 0) * a.weight;
        votedBy.push(a.id);
      }
    }
    let best, conf;
    if (!votes['T'] && !votes['X']) {
      best = this.freq(hist) || 'T';
      conf = 0.45;
    } else {
      const res = majority(votes);
      best = res.key;
      const total = Object.values(votes).reduce((a, b) => a + b, 0);
      conf = clamp(total > 0 ? res.val / total : 0.5, 0.45, 0.99);
    }
    const tx = this.extractTx(hist);
    const ent = entropy(tx);
    const regime = ent > 0.95 ? 'high_entropy' : ent < 0.35 ? 'low_entropy' : 'neutral';
    return {
      prediction: best === 'T' ? 'TÀI' : 'XỈU',
      confidence: conf,
      scorePrediction: this.predictScores(hist, best),
      meta: { regime, votedBy: [...new Set(votedBy)].length }
    };
  }
}
