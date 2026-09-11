/* ANH KHÔI CORE ENGINE v21 — deterministic Sic Bo signal engine.
   No algorithm can make a random dice game "extremely accurate" or guarantee wins.
   The engine therefore scores evidence, validates signals walk-forward, and abstains
   when the evidence is weak instead of manufacturing confidence.
*/
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const std = a => { if (!a.length) return 0; const m = avg(a); return Math.sqrt(avg(a.map(v => (v - m) ** 2))); };
const entropy = a => { if (!a.length) return 0; const f = {}; for (const v of a) f[v] = (f[v] || 0) + 1; return Object.values(f).reduce((e, n) => { const p = n / a.length; return e - p * Math.log2(p); }, 0); };
const opposite = v => v === 'T' ? 'X' : 'T';

export class AnhKhoiEngineV21 {
  constructor() { this.reset(); }
  reset() {
    this.minWeight = 0.03;
    this.learningRate = 0.12;
    this.weights = {};
    this.perfHistory = {};
    this.stats = { totalCount: 0, taiCount: 0, xiuCount: 0, scores: Object.fromEntries(Array.from({ length: 16 }, (_, i) => [i + 3, 0])), dicePos: [{}, {}, {}] };
    this.algs = [
      { id: 'base_rate', prior: 0.85, fn: h => this.baseRate(h) },
      { id: 'recent_rate', prior: 0.95, fn: h => this.recentRate(h) },
      { id: 'markov2', prior: 1.00, fn: h => this.markov2(h) },
      { id: 'bridge_pattern', prior: 1.05, fn: h => this.bridgePattern(h) },
      { id: 'run_break', prior: 0.95, fn: h => this.runBreak(h) },
      { id: 'score_regime', prior: 1.00, fn: h => this.scoreRegime(h) },
      { id: 'dice_structure', prior: 0.80, fn: h => this.diceStructure(h) },
    ];
    for (const a of this.algs) { this.weights[a.id] = 1; this.perfHistory[a.id] = []; }
  }
  validTx(v) { return v === 'T' || v === 'X'; }
  normalizeRow(item) {
    const raw = String(item?.gameNum ?? item?.session ?? '');
    const digits = raw.replace(/\D/g, '');
    const session = Number(digits);
    const dice = Array.isArray(item?.facesList) ? item.facesList.map(Number) : (typeof item?.keyR === 'string' ? item.keyR.split(/[-,|\s]+/).map(Number) : Array.isArray(item?.dice) ? item.dice.map(Number) : []);
    if (!Number.isFinite(session) || dice.length !== 3 || dice.some(d => !Number.isInteger(d) || d < 1 || d > 6)) return null;
    const total = dice.reduce((a, b) => a + b, 0);
    const reported = Number(item?.score ?? item?.total);
    const finalTotal = Number.isInteger(reported) && reported >= 3 && reported <= 18 ? reported : total;
    if (finalTotal !== total) return null;
    const tx = finalTotal >= 11 ? 'T' : 'X';
    return { session, dice, total: finalTotal, result: tx === 'T' ? 'TAI' : 'XIU', tx };
  }
  parseLines(data) {
    const list = data?.data?.resultList ?? data?.resultList ?? data?.data ?? [];
    if (!Array.isArray(list)) return [];
    const out = []; const seen = new Set();
    for (const item of list) { const row = this.normalizeRow(item); if (row && !seen.has(row.session)) { seen.add(row.session); out.push(row); } }
    out.sort((a, b) => a.session - b.session);
    return out;
  }
  updateStats(r) {
    if (!r || !this.validTx(r.tx)) return;
    this.stats.totalCount++; r.tx === 'T' ? this.stats.taiCount++ : this.stats.xiuCount++;
    this.stats.scores[r.total] = (this.stats.scores[r.total] || 0) + 1;
    for (let i = 0; i < 3; i++) this.stats.dicePos[i][r.dice[i]] = (this.stats.dicePos[i][r.dice[i]] || 0) + 1;
  }
  tx(hist) { return (hist || []).filter(h => this.validTx(h?.tx)).map(h => h.tx); }
  rows(hist) { return (hist || []).filter(h => this.validTx(h?.tx) && Array.isArray(h.dice) && Number.isFinite(h.total)); }
  counts(a) { let t = 0, x = 0; for (const v of a) v === 'T' ? t++ : x++; return { t, x, n: t + x }; }
  pT(a, smooth = 3) { const c = this.counts(a); return (c.t + smooth) / (c.n + smooth * 2); }
  sideStrength(a, smooth = 3) { return Math.abs(this.pT(a, smooth) - 0.5) * 2; }

  baseRate(hist) {
    const a = this.tx(hist); if (a.length < 18) return null;
    const p = this.pT(a, 5); return Math.abs(p - 0.5) >= 0.07 ? (p > 0.5 ? 'T' : 'X') : null;
  }
  recentRate(hist) {
    const a = this.tx(hist); if (a.length < 12) return null;
    const w = a.slice(-24); const p = this.pT(w, 3); return Math.abs(p - 0.5) >= 0.09 ? (p > 0.5 ? 'T' : 'X') : null;
  }
  markov2(hist) {
    const a = this.tx(hist); if (a.length < 28) return null;
    const key = a.slice(-2).join(''); const c = { T: 0, X: 0 };
    for (let i = 0; i < a.length - 2; i++) if (a[i] + a[i + 1] === key) c[a[i + 2]]++;
    return c.T + c.X >= 5 && Math.abs(c.T - c.X) >= 2 ? (c.T > c.X ? 'T' : 'X') : null;
  }
  bridgePattern(hist) {
    const a = this.tx(hist); if (a.length < 32) return null;
    const target = a.slice(-4); const candidates = [];
    for (let i = 0; i <= a.length - 5; i++) {
      let matches = 0; for (let j = 0; j < 4; j++) if (a[i + j] === target[j]) matches++;
      if (matches >= 3 && i + 4 < a.length) candidates.push({ next: a[i + 4], sim: matches / 4, age: a.length - i });
    }
    if (candidates.length < 3) return null;
    let t = 0, x = 0; for (const c of candidates) { const w = c.sim * (1 / Math.sqrt(Math.max(1, c.age))); c.next === 'T' ? t += w : x += w; }
    return Math.abs(t - x) / (t + x) >= 0.18 ? (t > x ? 'T' : 'X') : null;
  }
  runBreak(hist) {
    const a = this.tx(hist); if (a.length < 24) return null;
    const runs = []; let cur = a[0], n = 1;
    for (let i = 1; i < a.length; i++) { if (a[i] === cur) n++; else { runs.push({ v: cur, n }); cur = a[i]; n = 1; } }
    runs.push({ v: cur, n });
    const last = runs.at(-1), recent = runs.slice(-9), mean = avg(recent.map(r => r.n)), deviation = std(recent.map(r => r.n));
    if (last.n >= Math.max(4, mean + deviation * 1.25)) return last.v;
    if (last.n === 1 && recent.length >= 5 && recent.slice(-5).every((r, i, ar) => i === 0 || r.v !== ar[i - 1].v)) return opposite(last.v);
    return null;
  }
  scoreRegime(hist) {
    const totals = this.rows(hist).map(r => r.total); if (totals.length < 30) return null;
    const r = totals.slice(-36), m = avg(r), s = std(r); const p = this.pT(r, 4);
    if (s < 1.55 && m >= 12.0) return 'T';
    if (s < 1.55 && m <= 9.0) return 'X';
    return Math.abs(p - 0.5) >= 0.13 ? (p > 0.5 ? 'T' : 'X') : null;
  }
  diceStructure(hist) {
    const rows = this.rows(hist); if (rows.length < 40) return null;
    const recent = rows.slice(-18); const scores = recent.map(r => r.total); const mean = avg(scores);
    // Dice-position frequencies are used only as a weak structural signal.
    let expected = 0;
    for (let pos = 0; pos < 3; pos++) {
      const f = this.stats.dicePos[pos]; const n = Object.values(f).reduce((a, b) => a + b, 0) || 1;
      let e = 0; for (let d = 1; d <= 6; d++) e += d * ((f[d] || 0) / n); expected += e;
    }
    const blended = mean * 0.72 + expected * 0.28;
    return blended >= 11.25 ? 'T' : blended <= 9.75 ? 'X' : null;
  }

  fitInitial(hist) {
    const rows = this.rows(hist); if (rows.length < 35) return;
    const score = Object.fromEntries(this.algs.map(a => [a.id, { hit: 0, miss: 0 }]));
    for (let i = 25; i < rows.length; i++) {
      const prefix = rows.slice(0, i), actual = rows[i].tx;
      for (const a of this.algs) { const p = a.fn(prefix); if (!p) continue; p === actual ? score[a.id].hit++ : score[a.id].miss++; }
    }
    let total = 0;
    for (const a of this.algs) {
      const s = score[a.id], n = s.hit + s.miss; const acc = n ? (s.hit + 1) / (n + 2) : 0.5;
      this.weights[a.id] = a.prior * clamp(0.45 + (acc - 0.5) * 2.0, 0.20, 1.35);
      this.perfHistory[a.id] = [];
      total += this.weights[a.id];
    }
    for (const a of this.algs) this.weights[a.id] /= total || 1;
  }
  updateOutcome(prefix, actual) {
    if (!this.validTx(actual)) return;
    for (const a of this.algs) {
      const p = a.fn(prefix); if (!p) continue;
      const correct = p === actual; const w = this.weights[a.id] || this.minWeight;
      this.weights[a.id] = clamp(w * (correct ? 1 + this.learningRate : 1 - this.learningRate * 0.70), this.minWeight, 0.45);
      const h = this.perfHistory[a.id]; h.push(correct ? 1 : 0); if (h.length > 100) h.shift();
    }
    const total = Object.values(this.weights).reduce((a, b) => a + b, 0) || 1;
    for (const id of Object.keys(this.weights)) this.weights[id] /= total;
  }
  scorePrediction(hist, side) {
    const rows = this.rows(hist), range = side === 'T' ? [11,12,13,14,15,16,17,18] : [3,4,5,6,7,8,9,10];
    const score = Object.fromEntries(range.map(s => [s, 1]));
    for (let i = 0; i < rows.length - 1; i++) if (rows[i].tx === side && score[rows[i + 1].total] !== undefined) score[rows[i + 1].total] += 1 / Math.sqrt(rows.length - i);
    return [...range].sort((a,b) => score[b] - score[a] || Math.abs(a - 10) - Math.abs(b - 10)).slice(0,3);
  }
  predict(hist) {
    const a = this.tx(hist); if (a.length < 18) return { prediction:'CHƯA ĐỦ TÍN HIỆU', confidence:.50, scorePrediction:[], meta:{regime:'insufficient_data',votedBy:0,abstained:true,edge:0,sampleSize:a.length,reason:'Cần thêm dữ liệu lịch sử'} };
    const votes = { T:0, X:0 }, voters = [];
    for (const alg of this.algs) { const p = alg.fn(hist); if (!p) continue; const w = (this.weights[alg.id] || this.minWeight) * alg.prior; votes[p] += w; voters.push({ id:alg.id, side:p, weight:w }); }
    const total = votes.T + votes.X; if (!total) return { prediction:'CHƯA ĐỦ TÍN HIỆU', confidence:.50, scorePrediction:[], meta:{regime:'no_consensus',votedBy:0,abstained:true,edge:0,sampleSize:a.length,reason:'Không có tín hiệu đủ mạnh'} };
    const side = votes.T >= votes.X ? 'T' : 'X'; const edge = Math.abs(votes.T - votes.X) / total;
    const active = voters.length; const recent = a.slice(-30); const balance = this.sideStrength(recent, 3);
    const ent = entropy(recent); const regime = ent > .97 ? 'BALANCED' : ent < .76 ? 'STRUCTURED' : 'NEUTRAL';
    const support = clamp(active / this.algs.length, 0, 1); const sample = clamp((a.length - 18) / 82, 0, 1);
    let confidence = 0.50 + edge * 0.28 + support * 0.06 + sample * 0.05 + balance * 0.04;
    if (regime === 'BALANCED') confidence -= 0.025;
    confidence = clamp(confidence, 0.50, 0.78);
    const strong = edge >= 0.15 && active >= 2 && confidence >= 0.56;
    const reason = strong ? `${active} tín hiệu hợp lệ • edge ${(edge*100).toFixed(1)}% • regime ${regime}` : 'Biên tín hiệu thấp — hệ thống chủ động dừng, không ép cầu';
    return { prediction: strong ? (side === 'T' ? 'TÀI' : 'XỈU') : 'CHƯA ĐỦ TÍN HIỆU', confidence: strong ? confidence : Math.min(confidence, .55), scorePrediction: strong ? this.scorePrediction(hist, side) : [], meta:{regime,votedBy:active,abstained:!strong,edge:Number(edge.toFixed(4)),sampleSize:a.length,reason,signals:voters.map(v=>v.id)} };
  }
}

// Backward compatibility for existing server/imports that still use the old class name.
export const SeiuEngineV18 = AnhKhoiEngineV21;
