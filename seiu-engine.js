const sum = a => a.reduce((x, y) => x + y, 0);
const avg = a => a.length ? sum(a) / a.length : 0;
const std = a => { if (!a.length) return 0; const m = avg(a); return Math.sqrt(avg(a.map(v => (v - m) ** 2))); };
const entropy = a => {
  if (!a.length) return 0;
  const f = a.reduce((o, v) => ((o[v] = (o[v] || 0) + 1), o), {});
  let e = 0;
  for (const k in f) { const p = f[k] / a.length; e -= p * Math.log2(p); }
  return e;
};
const majority = o => { let k = null, v = -Infinity; for (const key in o) if (o[key] > v) { v = o[key]; k = key; } return { key: k, val: v }; };
const similarity = (a, b) => { if (a.length !== b.length) return 0; let m = 0; for (let i = 0; i < a.length; i++) if (a[i] === b[i]) m++; return m / a.length; };
const lastN = (a, n) => a.slice(Math.max(0, a.length - n));

export class SeiuEngineV17 {
  constructor() {
    this.weights = {};
    this.emaAlpha = 0.08;
    this.minWeight = 0.0001;
    this.diceStats = { pos: [{}, {}, {}], pairs: {}, triples: {}, totalCount: 0 };

    this.algs = [
      { id: 'freq_rebalance', fn: this.a1.bind(this) },
      { id: 'markov_adaptive', fn: this.a2.bind(this) },
      { id: 'ngram_weighted', fn: this.a3.bind(this) },
      { id: 'neo_pattern', fn: this.a4.bind(this) },
      { id: 'entropy_deep', fn: this.a5.bind(this) },
      { id: 'transformer', fn: this.a6.bind(this) },
      { id: 'run_length', fn: this.a7.bind(this) },
      { id: 'bayesian', fn: this.a8.bind(this) },
      { id: 'dice_pattern_learning', fn: this.aDice.bind(this) },
      { id: 'adaptive_bridge', fn: this.aBridge.bind(this) },
      { id: 'regime_detector', fn: this.a10.bind(this) },
      { id: 'gradient_cascade', fn: this.a11.bind(this) },
      { id: 'quantum_vote', fn: this.a12.bind(this) },
      { id: 'phase_lock', fn: this.a13.bind(this) },
      { id: 'momentum', fn: this.a14.bind(this) },
      { id: 'dice_sum_regression', fn: this.aDiceSum.bind(this) },
      { id: 'bridge_break_detector', fn: this.aBridgeBreak.bind(this) }
    ];
    for (const a of this.algs) this.weights[a.id] = 1;
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

  updateDiceStats(r) {
    if (r.tx === 'B') return;
    this.diceStats.totalCount++;
    for (let i = 0; i < 3; i++) this.diceStats.pos[i][r.dice[i]] = (this.diceStats.pos[i][r.dice[i]] || 0) + 1;
    const pk = `${r.dice[0]}-${r.dice[1]}`;
    this.diceStats.pairs[pk] = (this.diceStats.pairs[pk] || 0) + 1;
    const tk = r.dice.join('-');
    this.diceStats.triples[tk] = (this.diceStats.triples[tk] || 0) + 1;
  }

  getDiceStats() {
    const out = {};
    for (let i = 0; i < 3; i++) {
      const dist = this.diceStats.pos[i];
      const vals = Object.values(dist);
      out[`pos_${i}`] = { entropy: entropy(vals), samples: sum(vals) };
    }
    return out;
  }

  extractFeatures(hist) {
    const filtered = hist.filter(h => h.tx !== 'B');
    const tx = filtered.map(h => h.tx);
    const totals = filtered.map(h => h.total);
    let runs = [], cur = tx[0], len = 1;
    for (let i = 1; i < tx.length; i++) {
      if (tx[i] === cur) len++; else { runs.push({ val: cur, len }); cur = tx[i]; len = 1; }
    }
    if (tx.length) runs.push({ val: cur, len });
    return {
      tx, totals, runs,
      maxRun: runs.reduce((m, r) => Math.max(m, r.len), 0) || 0,
      meanTotal: avg(totals), stdTotal: std(totals), entropy: entropy(tx)
    };
  }

  // ---- Xúc xắc: học phân phối thật từ API, không random ----
  aDice(hist) {
    if (hist.length < 40) return null;
    const filtered = hist.filter(h => h.tx !== 'B');
    const recent = filtered.slice(-25);
    let s = [0, 0, 0];
    for (const r of recent) for (let i = 0; i < 3; i++) s[i] += r.dice[i];
    const avgDice = s.map(v => v / recent.length);
    const predictedTotal = sum(avgDice);
    const vol = std(filtered.slice(-30).map(r => r.total));
    if (predictedTotal < 9 && vol < 3) return 'X';
    if (predictedTotal > 12.5 && vol < 3) return 'T';
    return null;
  }

  aDiceSum(hist) {
    if (hist.length < 60) return null;
    const filtered = hist.filter(h => h.tx !== 'B');
    const totals = filtered.slice(-40).map(r => r.total);
    const mean = avg(totals);
    const recent5 = avg(totals.slice(-5));
    const regressionTarget = mean * 0.6 + recent5 * 0.4;
    if (regressionTarget <= 9.5) return 'X';
    if (regressionTarget >= 11.5) return 'T';
    return null;
  }

  // ---- Cầu thích nghi ----
  aBridge(hist) {
    if (hist.length < 20) return null;
    const { runs } = this.extractFeatures(hist);
    if (runs.length < 2) return null;
    const last = runs.at(-1), prev = runs.at(-2);
    const recent = runs.slice(-6);
    const avgLen = avg(recent.map(r => r.len));
    const maxLen = Math.max(...recent.map(r => r.len));
    if (last.len >= maxLen && last.len >= 3) return last.val;
    if (last.len === 1 && prev?.len >= 2) {
      const alt = recent.filter((r, i) => i === 0 || r.val !== recent[i - 1].val).length;
      if (alt >= 4) return last.val === 'T' ? 'X' : 'T';
    }
    if (last.len < avgLen * 0.5 && prev?.len > avgLen * 1.5) return prev.val;
    return null;
  }

  aBridgeBreak(hist) {
    if (hist.length < 30) return null;
    const { runs } = this.extractFeatures(hist);
    if (runs.length < 5) return null;
    const lens = runs.slice(-8).map(r => r.len);
    const meanLen = avg(lens), stdLen = std(lens);
    const last = runs.at(-1);
    // cầu đang bị "bẻ" liên tục (nhiều run ngắn bất thường) => dự đoán đảo chiều
    if (last.len === 1 && stdLen > 1.4 && meanLen < 2.4) {
      return last.val === 'T' ? 'X' : 'T';
    }
    // cầu bệt dài bất thường so với lịch sử => tiếp tục theo cầu
    if (last.len > meanLen + stdLen * 1.5) return last.val;
    return null;
  }

  a1(hist) {
    const { tx } = this.extractFeatures(hist);
    const f = tx.reduce((o, v) => ((o[v] = (o[v] || 0) + 1), o), {});
    if ((f['T'] || 0) > (f['X'] || 0) + 2) return 'X';
    if ((f['X'] || 0) > (f['T'] || 0) + 2) return 'T';
    return null;
  }

  a2(hist) {
    const { tx } = this.extractFeatures(hist);
    for (let order = 3; order >= 2; order--) {
      if (tx.length < order + 1) continue;
      const trans = {};
      for (let i = 0; i <= tx.length - order - 1; i++) {
        const key = tx.slice(i, i + order).join('');
        trans[key] = trans[key] || { t: 0, x: 0 };
        trans[key][tx[i + order].toLowerCase()]++;
      }
      const c = trans[tx.slice(-order).join('')];
      if (c && (c.t || c.x)) return c.t > c.x ? 'T' : 'X';
    }
    return null;
  }

  a3(hist) {
    const { tx } = this.extractFeatures(hist);
    if (tx.length < 5) return null;
    for (const k of [3, 4, 5]) {
      if (tx.length < k + 1) continue;
      const target = tx.slice(-k).join('');
      let c = { t: 0, x: 0 }, m = 0;
      for (let i = 0; i <= tx.length - k - 1; i++) {
        if (similarity(tx.slice(i, i + k).join(''), target) >= 0.8) { c[tx[i + k].toLowerCase()]++; m++; }
      }
      if (m > 2 && c.t !== c.x) return c.t > c.x ? 'T' : 'X';
    }
    return null;
  }

  a4(hist) {
    const { tx } = this.extractFeatures(hist);
    if (tx.length < 20) return null;
    for (const p of [4, 6, 8]) {
      if (tx.length < p * 2 + 1) continue;
      const target = tx.slice(-p).join('');
      let c = { t: 0, x: 0 }, m = 0;
      for (let i = 0; i <= tx.length - p - 1; i++) {
        const sc = similarity(tx.slice(i, i + p).join(''), target);
        if (sc >= 0.75) { c[tx[i + p].toLowerCase()] += sc; m++; }
      }
      if (m > 0 && c.t !== c.x) return c.t > c.x ? 'T' : 'X';
    }
    return null;
  }

  a5(hist) {
    if (hist.length < 70) return null;
    const f = this.extractFeatures(hist);
    const recent = avg(f.totals.slice(-30));
    if (recent > 14 && f.meanTotal > 11.5) return 'X';
    if (recent < 7 && f.meanTotal < 10.5) return 'T';
    if (f.entropy > 0.99) return f.tx.at(-1) === 'T' ? 'X' : 'T';
    if (f.entropy < 0.3) return f.tx.at(-1) === 'T' ? 'T' : 'X';
    return null;
  }

  a6(hist) {
    const { tx } = this.extractFeatures(hist);
    if (tx.length < 100) return null;
    const target = tx.slice(-10).join('');
    let c = { t: 0, x: 0 }, w = 0;
    for (let i = 0; i <= tx.length - 11; i++) {
      const sc = similarity(tx.slice(i, i + 10).join(''), target);
      if (sc > 0.6) { const ww = sc * (i + 1) / tx.length; c[tx[i + 10].toLowerCase()] = (c[tx[i + 10].toLowerCase()] || 0) + ww; w += ww; }
    }
    return w > 0 && c.t !== c.x ? (c.t > c.x ? 'T' : 'X') : null;
  }

  a7(hist) {
    const { runs } = this.extractFeatures(hist);
    if (runs.length < 2) return null;
    const last = runs.at(-1);
    const recent = runs.slice(-5).map(r => r.len);
    if (last.len > avg(recent) + std(recent)) return last.val;
    if (last.len === 1 && runs.length >= 3) {
      const alt = runs.slice(-5).filter((r, i) => i === 0 || r.val !== runs[runs.length - 5 + i - 1].val).length;
      if (alt >= 3) return last.val === 'T' ? 'X' : 'T';
    }
    return null;
  }

  a8(hist) {
    const { tx } = this.extractFeatures(hist);
    if (tx.length < 20) return null;
    const r = tx.slice(-10).reduce((o, v) => ((o[v] = (o[v] || 0) + 1), o), {});
    const pt = (r['T'] || 0) / 10, px = (r['X'] || 0) / 10;
    return Math.abs(pt - px) > 0.1 ? (pt > px ? 'T' : 'X') : null;
  }

  a10(hist) {
    const f = this.extractFeatures(hist);
    if (f.tx.length < 30) return null;
    const ratio = entropy(f.tx.slice(-30)) / (f.entropy || 1);
    if (ratio > 1.15 && f.maxRun < 4) return f.tx.at(-1) === 'T' ? 'X' : 'T';
    if (ratio < 0.85 && f.maxRun >= 3) return f.runs.at(-1)?.val || null;
    return null;
  }

  a11(hist) {
    const { tx } = this.extractFeatures(hist);
    if (tx.length < 40) return null;
    const seg = Math.floor(tx.length / 5);
    const first = tx.slice(0, seg), last = tx.slice(-seg);
    const rf = first.filter(v => v === 'T').length / first.length;
    const rl = last.filter(v => v === 'T').length / last.length;
    const trend = rl - rf;
    if (trend > 0.15) return 'X';
    if (trend < -0.15) return 'T';
    return null;
  }

  a12(hist) {
    const { tx } = this.extractFeatures(hist);
    if (tx.length < 50) return null;
    const recent = tx.slice(-20);
    const tCount = recent.filter(x => x === 'T').length;
    const votes = [tCount > 10 ? 'X' : 'T'];
    const cyc = 4;
    if (tx.length > cyc * 3) {
      const out = [];
      for (let i = (tx.length - 1) % cyc; i < tx.length; i += cyc) if (i + 1 < tx.length) out.push(tx[i + 1]);
      if (out.length) {
        const f = out.reduce((o, v) => ((o[v] = (o[v] || 0) + 1), o), {});
        votes.push((f['T'] || 0) > (f['X'] || 0) ? 'T' : 'X');
      }
    }
    const f = votes.reduce((o, v) => ((o[v] = (o[v] || 0) + 1), o), {});
    return (f['T'] || 0) > (f['X'] || 0) ? 'T' : 'X';
  }

  a13(hist) {
    const { runs } = this.extractFeatures(hist);
    if (runs.length < 3) return null;
    const period = Math.round(avg(runs.map(r => r.len)));
    if (period < 2 || period > 10) return null;
    return (runs.length % period === 0) ? runs.at(-1).val : (runs.at(-2)?.val || null);
  }

  a14(hist) {
    const { tx } = this.extractFeatures(hist);
    if (tx.length < 40) return null;
    const s1 = tx.slice(-40, -20), s2 = tx.slice(-20);
    const m1 = s1.filter(v => v === 'T').length - s1.filter(v => v === 'X').length;
    const m2 = s2.filter(v => v === 'T').length - s2.filter(v => v === 'X').length;
    return (Math.sign(m1) === Math.sign(m2) && m2 !== 0) ? (m2 > 0 ? 'T' : 'X') : null;
  }

  fitInitial(hist) {
    const window = lastN(hist.filter(h => h.tx !== 'B'), 500);
    if (window.length < 10) return;
    const scores = {};
    for (const a of this.algs) scores[a.id] = 0;
    for (let i = 3; i < window.length; i++) {
      const prefix = window.slice(0, i);
      const actual = window[i].tx;
      for (const a of this.algs) if (a.fn(prefix) === actual) scores[a.id]++;
    }
    let total = 0;
    for (const id in scores) { const w = (scores[id] || 0) + 0.5; this.weights[id] = w; total += w; }
    for (const id in this.weights) this.weights[id] = Math.max(this.minWeight, this.weights[id] / total);
  }

  updateOutcome(prefix, actual) {
    if (actual === 'B') return;
    for (const a of this.algs) {
      const correct = a.fn(prefix) === actual ? 1 : 0;
      const curr = this.weights[a.id] || this.minWeight;
      const reward = correct ? 1.08 : 0.92;
      this.weights[a.id] = Math.max(this.minWeight, this.emaAlpha * (curr * reward) + (1 - this.emaAlpha) * curr);
    }
    const s = Object.values(this.weights).reduce((a, b) => a + b, 0) || 1;
    for (const id in this.weights) this.weights[id] /= s;
  }

  predictScores(hist, tx) {
    if (hist.length < 30) return tx === 'T' ? [13, 14, 15] : [6, 7, 8];
    const scores = tx === 'T' ? [11, 12, 13, 14, 15, 16, 17, 18] : [3, 4, 5, 6, 7, 8, 9, 10];
    let counts = {}, matchCount = 0;
    const lookback = Math.min(hist.length, 150);
    for (let i = hist.length - 2; i >= hist.length - lookback && i >= 0; i--) {
      if (hist[i].tx === tx && scores.includes(hist[i + 1].total)) {
        const age = hist.length - 1 - i;
        const decay = 1.0 - age / (lookback + 1);
        counts[hist[i + 1].total] = (counts[hist[i + 1].total] || 0) + decay;
        matchCount++;
      }
    }
    if (matchCount < 3) {
      const c = avg(scores);
      return scores.slice(0, 3).sort((a, b) => Math.abs(a - c) - Math.abs(b - c));
    }
    const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).map(Number).slice(0, 3);
    while (sorted.length < 3) {
      const used = new Set(sorted);
      const rem = scores.filter(s => !used.has(s));
      const c = avg(scores);
      rem.sort((a, b) => Math.abs(a - c) - Math.abs(b - c));
      if (rem.length) sorted.push(rem.shift()); else break;
    }
    return sorted.length >= 3 ? sorted : scores.slice(0, 3);
  }

  predict(hist) {
    const votes = {}, votedBy = [];
    for (const a of this.algs) {
      const p = a.fn(hist);
      if (p) { votes[p] = (votes[p] || 0) + (this.weights[a.id] || 0); votedBy.push(a.id); }
    }
    let best, confidence;
    if (!votes['T'] && !votes['X']) { best = this.a1(hist) || 'T'; confidence = 0.5; }
    else {
      const res = majority(votes);
      best = res.key;
      const total = Object.values(votes).reduce((a, b) => a + b, 0);
      confidence = Math.min(0.99, Math.max(0.51, total > 0 ? res.val / total : 0.51));
    }
    const feat = this.extractFeatures(hist);
    const regime = feat.entropy > 0.98 ? 'high_entropy' : feat.entropy < 0.4 ? 'low_entropy' : 'neutral';
    const diceTrend = this.aDice(hist) || 'neutral';
    const bridgeStatus = this.aBridge(hist) ? 'active' : 'idle';
    return {
      prediction: best === 'T' ? 'tài' : 'xỉu',
      confidence,
      scorePrediction: this.predictScores(hist, best),
      meta: { regime, votedBy: [...new Set(votedBy)], diceTrend, bridgeStatus }
    };
  }
}
