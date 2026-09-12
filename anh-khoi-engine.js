/**
 * ANH KHÔI CORE ENGINE v19
 * High-quality ensemble predictor for Tài/Xỉu (Sicbo 3-dice)
 * Focus: robust signals, calibrated confidence, online learning, abstain on weak edge.
 * No random, pure statistical + sequential models.
 */

const sum = (a) => a.reduce((x, y) => x + y, 0);
const avg = (a) => (a.length ? sum(a) / a.length : 0);
const med = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const std = (a) => {
  if (a.length < 2) return 0;
  const m = avg(a);
  return Math.sqrt(avg(a.map((v) => (v - m) ** 2)));
};
const entropy = (arr) => {
  if (!arr.length) return 0;
  const f = Object.create(null);
  for (const v of arr) f[v] = (f[v] || 0) + 1;
  let e = 0;
  const n = arr.length;
  for (const k in f) {
    const p = f[k] / n;
    e -= p * Math.log2(p);
  }
  return e;
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lastN = (a, n) => a.slice(Math.max(0, a.length - n));
const majority = (obj) => {
  let best = null,
    val = -Infinity;
  for (const k in obj) {
    if (obj[k] > val) {
      val = obj[k];
      best = k;
    }
  }
  return { key: best, val };
};
const similarity = (a, b) => {
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  let m = 0;
  for (let i = 0; i < n; i++) if (a[i] === b[i]) m++;
  return m / n;
};

export class AnhKhoiEngine {
  constructor() {
    this.emaAlpha = 0.18;
    this.minWeight = 0.02;
    this.learningRate = 0.012;
    this.abstainThreshold = 0.545;

    this.stats = {
      totalCount: 0,
      taiCount: 0,
      xiuCount: 0,
      scores: Object.fromEntries([...Array(16)].map((_, i) => [i + 3, 0])),
      dicePos: [{}, {}, {}],
      pairs: {},
      triples: {},
      recentHits: [],
    };

    // Algorithm registry: id, baseWeight, fn
    this.algs = [
      { id: "streak_regime", base: 1.25, fn: this.streakRegime.bind(this) },
      { id: "markov1_smooth", base: 1.05, fn: this.markov1.bind(this) },
      { id: "markov2_smooth", base: 1.2, fn: this.markov2.bind(this) },
      { id: "markov3_smooth", base: 1.15, fn: this.markov3.bind(this) },
      { id: "rolling_imbalance", base: 1.1, fn: this.rollingImbalance.bind(this) },
      { id: "ewma_trend", base: 1.0, fn: this.ewmaTrend.bind(this) },
      { id: "sum_vol_regime", base: 1.18, fn: this.sumVolRegime.bind(this) },
      { id: "pattern_weighted", base: 1.12, fn: this.patternWeighted.bind(this) },
      { id: "bayes_seq", base: 1.22, fn: this.bayesSeq.bind(this) },
      { id: "transition_matrix", base: 1.08, fn: this.transitionMatrix.bind(this) },
      { id: "mean_reversion", base: 1.05, fn: this.meanReversion.bind(this) },
      { id: "momentum_switch", base: 0.98, fn: this.momentumSwitch.bind(this) },
      { id: "dice_bias", base: 0.95, fn: this.diceBias.bind(this) },
      { id: "entropy_gate", base: 0.9, fn: this.entropyGate.bind(this) },
      { id: "break_detector", base: 1.0, fn: this.breakDetector.bind(this) },
      { id: "score_cond", base: 1.1, fn: this.scoreCond.bind(this) },
      { id: "ngram_hit", base: 1.05, fn: this.ngramHit.bind(this) },
      { id: "run_length_dist", base: 1.15, fn: this.runLengthDist.bind(this) },
    ];

    this.weights = Object.create(null);
    this.perf = Object.create(null);
    for (const a of this.algs) {
      this.weights[a.id] = 1.0;
      this.perf[a.id] = [];
    }
  }

  // ---------- Parse external API ----------
  parseLines(data) {
    if (!data?.data?.resultList?.length) return [];
    const list = [...data.data.resultList];
    list.sort((a, b) => parseInt(String(b.gameNum).slice(1), 10) - parseInt(String(a.gameNum).slice(1), 10));
    const out = list
      .map((item) => {
        const total = Number(item.score ?? 0);
        let tx, result;
        if (total >= 3 && total <= 10) {
          tx = "X";
          result = "XỈU";
        } else if (total >= 11 && total <= 18) {
          tx = "T";
          result = "TÀI";
        } else {
          tx = "B";
          result = "BÃO";
        }
        let dice = [0, 0, 0];
        if (Array.isArray(item.facesList) && item.facesList.length >= 3) {
          dice = item.facesList.slice(0, 3).map(Number);
        } else if (typeof item.keyR === "string") {
          dice = item.keyR.split("-").map(Number);
        }
        const session = parseInt(String(item.gameNum).slice(1), 10);
        return { session, dice, total, result, tx };
      })
      .filter((r) => Number.isFinite(r.session) && r.session > 0)
      .sort((a, b) => a.session - b.session);
    return out;
  }

  updateStats(r) {
    if (!r || r.tx === "B") return;
    this.stats.totalCount++;
    if (r.tx === "T") this.stats.taiCount++;
    else this.stats.xiuCount++;
    this.stats.scores[r.total] = (this.stats.scores[r.total] || 0) + 1;
    for (let i = 0; i < 3; i++) {
      const d = r.dice[i];
      this.stats.dicePos[i][d] = (this.stats.dicePos[i][d] || 0) + 1;
    }
    const pk = `${r.dice[0]}-${r.dice[1]}`;
    this.stats.pairs[pk] = (this.stats.pairs[pk] || 0) + 1;
    const tk = r.dice.join("-");
    this.stats.triples[tk] = (this.stats.triples[tk] || 0) + 1;
  }

  extractTx(hist) {
    return hist.filter((h) => h.tx === "T" || h.tx === "X").map((h) => h.tx);
  }

  extractTotals(hist) {
    return hist.filter((h) => h.tx === "T" || h.tx === "X").map((h) => h.total);
  }

  // ---------- Individual models (return 'T' | 'X' | null) ----------

  streakRegime(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 12) return null;
    let runs = [];
    let cur = tx[0],
      len = 1;
    for (let i = 1; i < tx.length; i++) {
      if (tx[i] === cur) len++;
      else {
        runs.push({ val: cur, len });
        cur = tx[i];
        len = 1;
      }
    }
    runs.push({ val: cur, len });
    const last = runs.at(-1);
    const recentLens = runs.slice(-12).map((r) => r.len);
    const meanL = avg(recentLens);
    const sdL = std(recentLens) || 1;
    if (last.len >= meanL + 1.6 * sdL && last.len >= 5) return last.val === "T" ? "X" : "T";
    if (last.len >= 4 && last.len <= meanL + 0.4 * sdL) return last.val;
    if (last.len === 1 && runs.length >= 5) {
      const alt = runs.slice(-7).filter((r, i, arr) => i === 0 || r.val !== arr[i - 1].val).length;
      if (alt >= 5) return last.val === "T" ? "X" : "T";
    }
    return null;
  }

  markov1(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 20) return null;
    const trans = { T: { T: 1, X: 1 }, X: { T: 1, X: 1 } };
    for (let i = 0; i < tx.length - 1; i++) {
      trans[tx[i]][tx[i + 1]]++;
    }
    const last = tx.at(-1);
    const c = trans[last];
    const total = c.T + c.X;
    if (Math.abs(c.T - c.X) / total < 0.08) return null;
    return c.T > c.X ? "T" : "X";
  }

  markov2(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 30) return null;
    const trans = Object.create(null);
    for (let i = 0; i <= tx.length - 3; i++) {
      const key = tx[i] + tx[i + 1];
      if (!trans[key]) trans[key] = { T: 1, X: 1 };
      trans[key][tx[i + 2]]++;
    }
    const key = tx.at(-2) + tx.at(-1);
    const c = trans[key];
    if (!c) return null;
    const total = c.T + c.X;
    if (Math.abs(c.T - c.X) / total < 0.1) return null;
    return c.T > c.X ? "T" : "X";
  }

  markov3(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 45) return null;
    const trans = Object.create(null);
    for (let i = 0; i <= tx.length - 4; i++) {
      const key = tx[i] + tx[i + 1] + tx[i + 2];
      if (!trans[key]) trans[key] = { T: 1, X: 1 };
      trans[key][tx[i + 3]]++;
    }
    const key = tx.at(-3) + tx.at(-2) + tx.at(-1);
    const c = trans[key];
    if (!c) return null;
    const total = c.T + c.X;
    if (total < 4 || Math.abs(c.T - c.X) / total < 0.12) return null;
    return c.T > c.X ? "T" : "X";
  }

  rollingImbalance(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 25) return null;
    const windows = [8, 15, 25];
    let scoreT = 0,
      scoreX = 0,
      wsum = 0;
    for (const w of windows) {
      if (tx.length < w) continue;
      const slice = tx.slice(-w);
      const t = slice.filter((x) => x === "T").length;
      const x = w - t;
      const edge = (t - x) / w;
      const weight = Math.sqrt(w);
      if (edge > 0.18) {
        scoreX += weight * Math.abs(edge);
      } else if (edge < -0.18) {
        scoreT += weight * Math.abs(edge);
      } else if (Math.abs(edge) > 0.08) {
        if (edge > 0) scoreT += weight * 0.35 * Math.abs(edge);
        else scoreX += weight * 0.35 * Math.abs(edge);
      }
      wsum += weight;
    }
    if (wsum === 0) return null;
    if (Math.abs(scoreT - scoreX) < 0.15) return null;
    return scoreT > scoreX ? "T" : "X";
  }

  ewmaTrend(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 20) return null;
    let ewma = 0.5;
    const alpha = 0.12;
    for (const v of tx) {
      const x = v === "T" ? 1 : 0;
      ewma = alpha * x + (1 - alpha) * ewma;
    }
    if (ewma > 0.58) return "T";
    if (ewma < 0.42) return "X";
    return null;
  }

  sumVolRegime(hist) {
    const totals = this.extractTotals(hist);
    if (totals.length < 35) return null;
    const recent = totals.slice(-28);
    const m = avg(recent);
    const s = std(recent);
    if (s < 1.7 && m >= 12.2) return "T";
    if (s < 1.7 && m <= 8.8) return "X";
    if (s > 3.1) return null;
    if (m >= 11.8) return "T";
    if (m <= 9.2) return "X";
    return null;
  }

  patternWeighted(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 40) return null;
    const target = tx.slice(-6);
    let votes = { T: 0, X: 0 };
    let hits = 0;
    for (let len = 4; len <= 7; len++) {
      if (tx.length < len + 2) continue;
      const pat = target.slice(-len).join("");
      for (let i = 0; i <= tx.length - len - 1; i++) {
        const s = similarity(tx.slice(i, i + len).join(""), pat);
        if (s >= 0.7) {
          const next = tx[i + len];
          const ageW = 0.4 + 0.6 * (i / tx.length);
          votes[next] += s * ageW;
          hits++;
        }
      }
    }
    if (hits < 3 || Math.abs(votes.T - votes.X) < 0.4) return null;
    return votes.T > votes.X ? "T" : "X";
  }

  bayesSeq(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 30) return null;
    const priorT = this.stats.taiCount / Math.max(1, this.stats.totalCount);
    const priorX = 1 - priorT;
    const recent = tx.slice(-12);
    const likT = (recent.filter((v) => v === "T").length + 1) / (recent.length + 2);
    const likX = (recent.filter((v) => v === "X").length + 1) / (recent.length + 2);
    const postT = (likT * priorT) / (likT * priorT + likX * priorX || 1);
    if (Math.abs(postT - 0.5) < 0.09) return null;
    return postT > 0.5 ? "T" : "X";
  }

  transitionMatrix(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 40) return null;
    const m = {
      TT: 1,
      TX: 1,
      XT: 1,
      XX: 1,
    };
    for (let i = 0; i < tx.length - 1; i++) {
      m[tx[i] + tx[i + 1]]++;
    }
    const last = tx.at(-1);
    const toT = last === "T" ? m.TT : m.XT;
    const toX = last === "T" ? m.TX : m.XX;
    const total = toT + toX;
    if (Math.abs(toT - toX) / total < 0.09) return null;
    return toT > toX ? "T" : "X";
  }

  meanReversion(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 30) return null;
    const last8 = tx.slice(-8);
    const t = last8.filter((v) => v === "T").length;
    if (t >= 6) return "X";
    if (t <= 2) return "T";
    return null;
  }

  momentumSwitch(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 40) return null;
    const a = tx.slice(-40, -20);
    const b = tx.slice(-20);
    const ma = a.filter((v) => v === "T").length - a.filter((v) => v === "X").length;
    const mb = b.filter((v) => v === "T").length - b.filter((v) => v === "X").length;
    if (ma !== 0 && mb !== 0 && Math.sign(ma) === Math.sign(mb) && Math.abs(mb) > Math.abs(ma) * 0.7) {
      return mb > 0 ? "T" : "X";
    }
    return null;
  }

  diceBias(hist) {
    if (this.stats.totalCount < 40) return null;
    let expected = 0;
    for (let i = 0; i < 3; i++) {
      const dist = this.stats.dicePos[i];
      let s = 0,
        c = 0;
      for (const k in dist) {
        s += Number(k) * dist[k];
        c += dist[k];
      }
      expected += c ? s / c : 3.5;
    }
    if (expected >= 11.4) return "T";
    if (expected <= 9.6) return "X";
    return null;
  }

  entropyGate(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 50) return null;
    const full = entropy(tx);
    const recent = entropy(tx.slice(-20));
    const ratio = recent / (full || 1);
    const last = tx.at(-1);
    if (ratio > 1.22) return last === "T" ? "X" : "T";
    if (ratio < 0.72) return last;
    return null;
  }

  breakDetector(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 25) return null;
    let runs = [];
    let cur = tx[0],
      len = 1;
    for (let i = 1; i < tx.length; i++) {
      if (tx[i] === cur) len++;
      else {
        runs.push({ val: cur, len });
        cur = tx[i];
        len = 1;
      }
    }
    runs.push({ val: cur, len });
    const last = runs.at(-1);
    const lens = runs.slice(-10).map((r) => r.len);
    const mean = avg(lens);
    if (last.len < mean * 0.35 && lens.length >= 5 && std(lens) > 1.2) {
      return last.val === "T" ? "X" : "T";
    }
    return null;
  }

  scoreCond(hist) {
    const totals = this.extractTotals(hist);
    if (totals.length < 40) return null;
    const recent = totals.slice(-30);
    const m = avg(recent);
    const trend = med(recent.slice(-12)) - med(recent.slice(0, 12));
    const target = m * 0.55 + med(recent) * 0.35 + trend * 0.25;
    if (target >= 11.6) return "T";
    if (target <= 9.4) return "X";
    return null;
  }

  ngramHit(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 35) return null;
    for (const k of [3, 4, 5]) {
      if (tx.length < k + 3) continue;
      const target = tx.slice(-k).join("");
      let c = { T: 0, X: 0 },
        m = 0;
      for (let i = 0; i <= tx.length - k - 1; i++) {
        if (tx.slice(i, i + k).join("") === target) {
          c[tx[i + k]]++;
          m++;
        }
      }
      if (m >= 2 && c.T !== c.X) return c.T > c.X ? "T" : "X";
    }
    return null;
  }

  runLengthDist(hist) {
    const tx = this.extractTx(hist);
    if (tx.length < 30) return null;
    let runs = [];
    let cur = tx[0],
      len = 1;
    for (let i = 1; i < tx.length; i++) {
      if (tx[i] === cur) len++;
      else {
        runs.push({ val: cur, len });
        cur = tx[i];
        len = 1;
      }
    }
    runs.push({ val: cur, len });
    const last = runs.at(-1);
    const same = runs.filter((r) => r.val === last.val).map((r) => r.len);
    if (same.length < 4) return null;
    const pContinue = same.filter((l) => l > last.len).length / same.length;
    if (pContinue > 0.62 && last.len >= 2) return last.val;
    if (pContinue < 0.28 && last.len >= 3) return last.val === "T" ? "X" : "T";
    return null;
  }

  // ---------- Learning ----------
  fitInitial(hist) {
    const clean = hist.filter((h) => h.tx === "T" || h.tx === "X");
    const window = lastN(clean, 400);
    if (window.length < 20) return;
    const scores = Object.create(null);
    for (const a of this.algs) scores[a.id] = 0;
    const step = Math.max(1, Math.floor(window.length / 80));
    for (let i = 15; i < window.length; i += step) {
      const prefix = window.slice(0, i);
      const actual = window[i].tx;
      for (const a of this.algs) {
        try {
          if (a.fn(prefix) === actual) scores[a.id]++;
        } catch {
          /* ignore single alg failure */
        }
      }
    }
    let total = 0;
    for (const id in scores) {
      const w = (scores[id] || 0) + 2.0;
      this.weights[id] = w;
      total += w;
    }
    for (const id in this.weights) {
      this.weights[id] = Math.max(this.minWeight, this.weights[id] / (total || 1));
    }
  }

  updateOutcome(prefix, actual) {
    if (actual !== "T" && actual !== "X") return;
    for (const a of this.algs) {
      let correct = 0;
      try {
        correct = a.fn(prefix) === actual ? 1 : 0;
      } catch {
        correct = 0;
      }
      const curr = this.weights[a.id] || this.minWeight;
      const reward = correct ? 1 + this.learningRate * 6 : 1 - this.learningRate * 2.5;
      const newW = this.emaAlpha * (curr * reward) + (1 - this.emaAlpha) * curr;
      this.weights[a.id] = Math.max(this.minWeight, newW);
      this.perf[a.id].push(correct);
      if (this.perf[a.id].length > 250) this.perf[a.id].shift();
    }
    const s = Object.values(this.weights).reduce((a, b) => a + b, 0) || 1;
    for (const id in this.weights) this.weights[id] /= s;
  }

  // ---------- Score prediction (top totals given TX) ----------
  predictScores(hist, tx) {
    const side = tx === "T" ? "T" : "X";
    const allowed = side === "T" ? [11, 12, 13, 14, 15, 16, 17, 18] : [3, 4, 5, 6, 7, 8, 9, 10];
    if (hist.length < 30) return side === "T" ? [13, 14, 12] : [7, 8, 6];
    const counts = Object.create(null);
    const lookback = Math.min(hist.length, 180);
    let match = 0;
    for (let i = hist.length - 2; i >= hist.length - lookback && i >= 0; i--) {
      if (hist[i].tx === side && allowed.includes(hist[i + 1]?.total)) {
        const age = hist.length - 1 - i;
        const decay = Math.pow(1 - age / (lookback + 1), 1.25);
        counts[hist[i + 1].total] = (counts[hist[i + 1].total] || 0) + decay;
        match++;
      }
    }
    if (match < 4) {
      const c = avg(allowed);
      return [...allowed].sort((a, b) => Math.abs(a - c) - Math.abs(b - c)).slice(0, 3);
    }
    const sorted = Object.keys(counts)
      .map(Number)
      .sort((a, b) => counts[b] - counts[a])
      .slice(0, 3);
    while (sorted.length < 3) {
      const used = new Set(sorted);
      const rem = allowed.filter((s) => !used.has(s));
      if (!rem.length) break;
      const c = avg(allowed);
      rem.sort((a, b) => Math.abs(a - c) - Math.abs(b - c));
      sorted.push(rem.shift());
    }
    return sorted;
  }

  // ---------- Main predict ----------
  predict(hist) {
    if (!hist || hist.length < 5) {
      return {
        prediction: "CHƯA ĐỦ DỮ LIỆU",
        confidence: 0,
        scorePrediction: [],
        meta: { regime: "cold", votedBy: 0, abstained: true, reason: "history too short" },
      };
    }

    const votes = Object.create(null);
    const votedBy = [];
    let totalWeight = 0;

    for (const a of this.algs) {
      let p = null;
      try {
        p = a.fn(hist);
      } catch {
        p = null;
      }
      if (p === "T" || p === "X") {
        const w = (this.weights[a.id] || this.minWeight) * a.base;
        votes[p] = (votes[p] || 0) + w;
        totalWeight += w;
        votedBy.push(a.id);
      }
    }

    const txSeq = this.extractTx(hist);
    const ent = entropy(txSeq);
    const regime = ent > 0.97 ? "high_entropy" : ent < 0.38 ? "low_entropy" : "neutral";

    let best, conf, abstained = false, reason = "";

    if (!votes.T && !votes.X) {
      const recent = lastN(txSeq, 20);
      const t = recent.filter((v) => v === "T").length;
      best = t >= recent.length / 2 ? "T" : "X";
      conf = 0.48;
      abstained = true;
      reason = "no model consensus — low confidence fallback";
    } else {
      const res = majority(votes);
      best = res.key;
      conf = clamp(totalWeight > 0 ? res.val / totalWeight : 0.5, 0.42, 0.96);
      const agreement = votedBy.length / this.algs.length;
      conf = clamp(conf * (0.75 + 0.25 * agreement), 0.42, 0.96);
      if (regime === "high_entropy") conf *= 0.92;
      if (votedBy.length < 3) {
        conf *= 0.88;
        reason = "few models fired";
      }
      if (conf < this.abstainThreshold) {
        abstained = true;
        reason = reason || `confidence ${Math.round(conf * 100)}% below threshold`;
      }
    }

    return {
      prediction: best === "T" ? "TÀI" : "XỈU",
      confidence: conf,
      scorePrediction: this.predictScores(hist, best),
      meta: {
        regime,
        votedBy: [...new Set(votedBy)].length,
        abstained,
        reason: reason || `ensemble ${votedBy.length} models • ${regime}`,
        rawVotes: { T: +(votes.T || 0).toFixed(3), X: +(votes.X || 0).toFixed(3) },
      },
    };
  }
}
