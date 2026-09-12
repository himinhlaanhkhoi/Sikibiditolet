/**
 * ANH KHÔI CORE ENGINE v21
 * Tích hợp full SEIU ensemble (T/X + dice dist + online learning)
 * Luôn dự đoán cho PHIÊN TIẾP THEO (lag +1)
 */

// ==================== UTILS ====================
function safeParseDiceFaces(facesList, keyR) {
  if (Array.isArray(facesList) && facesList.length === 3) {
    const nums = facesList.map((v) =>
      typeof v === "number" && Number.isFinite(v) ? Math.round(v) : NaN
    );
    if (nums.every((n) => Number.isFinite(n) && n >= 1 && n <= 6)) return nums;
  }
  if (typeof keyR === "string") {
    const parts = keyR.split("-").map((v) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.round(n) : NaN;
    });
    if (parts.length === 3 && parts.every((n) => Number.isFinite(n) && n >= 1 && n <= 6))
      return parts;
  }
  return [1, 1, 1];
}

function classifyTx(total) {
  if (!Number.isFinite(total)) return { tx: "N", result: "UNKNOWN" };
  if (total === 3 || total === 18) return { tx: "B", result: "BÃO" };
  if (total >= 4 && total <= 10) return { tx: "X", result: "XỈU" };
  if (total >= 11 && total <= 17) return { tx: "T", result: "TÀI" };
  return { tx: "N", result: "UNKNOWN" };
}

function safeSessionFromGameNum(gameNum) {
  if (typeof gameNum !== "string" || gameNum.length < 2) return NaN;
  const n = Number(gameNum.slice(1));
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

function processHistory(sorted_list) {
  if (!Array.isArray(sorted_list)) return [];
  const arr = sorted_list
    .filter((item) => item != null)
    .map((item) => {
      const rawTotal =
        typeof item.score === "number" && Number.isFinite(item.score)
          ? Math.round(item.score)
          : NaN;
      const { tx, result } = classifyTx(rawTotal);
      const dice = safeParseDiceFaces(item.facesList, item.keyR);
      const session = safeSessionFromGameNum(item.gameNum);
      return { session, dice, total: rawTotal, result, tx };
    });
  arr.sort((a, b) => {
    const aValid = Number.isFinite(a.session);
    const bValid = Number.isFinite(b.session);
    if (aValid && bValid) return a.session - b.session;
    if (aValid) return -1;
    if (bValid) return 1;
    return 0;
  });
  return arr;
}

function last_n(arr, n) {
  if (!Array.isArray(arr) || !Number.isFinite(n) || n <= 0) return [];
  return arr.slice(Math.max(0, arr.length - n));
}

function majority(obj) {
  if (obj == null || typeof obj !== "object") return { key: null, val: -Infinity };
  let max_k = null, max_v = -Infinity;
  for (const k in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
    const v = obj[k];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    if (v > max_v) { max_v = v; max_k = k; }
  }
  return { key: max_k, val: max_v };
}

function sum(nums) {
  if (!Array.isArray(nums)) return 0;
  return nums.reduce((a, b) => (typeof b === "number" && Number.isFinite(b) ? a + b : a), 0);
}

function avg(nums) {
  if (!Array.isArray(nums) || nums.length === 0) return 0;
  const valid = nums.filter((n) => typeof n === "number" && Number.isFinite(n));
  return valid.length ? sum(valid) / valid.length : 0;
}

function entropy(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  const freq = {};
  for (const v of arr) {
    if (v == null) continue;
    const key = String(v);
    freq[key] = (freq[key] || 0) + 1;
  }
  const n = Object.values(freq).reduce((a, b) => a + b, 0);
  if (n === 0) return 0;
  let e = 0;
  for (const k in freq) {
    const p = freq[k] / n;
    if (p > 0) e -= p * Math.log2(p);
  }
  return e;
}

function similarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  let m = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) m++;
  return m / a.length;
}

function extract_features(history) {
  if (!Array.isArray(history)) {
    return {
      tx: [], totals: [], freq: {}, runs: [], max_run: 0,
      mean_total: 0, std_total: 0, entropy: 0, dice_history: [],
      face_counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    };
  }
  const tx_filtered = history.filter((h) => h && h.tx !== "B");
  const tx = tx_filtered.map((h) => h.tx).filter((v) => v === "T" || v === "X" || v === "N");
  const totals = tx_filtered.map((h) => h.total).filter((t) => typeof t === "number" && Number.isFinite(t));
  const freq = tx.reduce((a, v) => { a[v] = (a[v] || 0) + 1; return a; }, {});

  let runs = [];
  if (tx.length > 0) {
    let cur = tx[0], len = 1;
    for (let i = 1; i < tx.length; i++) {
      if (tx[i] === cur) len++;
      else { runs.push({ val: cur, len }); cur = tx[i]; len = 1; }
    }
    runs.push({ val: cur, len });
  }
  const max_run = runs.length ? runs.reduce((m, r) => Math.max(m, r.len), 0) : 0;
  const mean_total = avg(totals);
  let std_total = 0;
  if (totals.length > 0) {
    const variance = avg(totals.map((t) => Math.pow(t - mean_total, 2)));
    std_total = Math.sqrt(variance);
    if (!Number.isFinite(std_total)) std_total = 0;
  }
  const ent = entropy(tx);

  const dice_history = history
    .filter((h) => h && Array.isArray(h.dice) && h.dice.length === 3)
    .map((h) => {
      const [a, b, c] = h.dice.map((x) => {
        const n = Math.round(Number(x));
        return Number.isFinite(n) && n >= 1 && n <= 6 ? n : null;
      });
      if (a == null || b == null || c == null) return null;
      return [a, b, c];
    })
    .filter((x) => x != null);

  const face_counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const [a, b, c] of dice_history) {
    face_counts[a]++; face_counts[b]++; face_counts[c]++;
  }

  return { tx, totals, freq, runs, max_run, mean_total, std_total, entropy: ent, dice_history, face_counts };
}

// ==================== T/X ALGORITHMS ====================
function algo5_freq_rebalance(history) {
  const tx = extract_features(history).tx;
  const freq = tx.reduce((a, v) => { a[v] = (a[v] || 0) + 1; return a; }, {});
  if ((freq["T"] || 0) > (freq["X"] || 0) + 2) return "X";
  if ((freq["X"] || 0) > (freq["T"] || 0) + 2) return "T";
  return null;
}

function algoa_markov(history) {
  const tx = extract_features(history).tx;
  const order = 3;
  if (tx.length < order + 1) return null;
  const transitions = {};
  for (let i = 0; i <= tx.length - order - 1; i++) {
    const key = tx.slice(i, i + order).join("");
    const next = tx[i + order];
    transitions[key] = transitions[key] || { t: 0, x: 0 };
    transitions[key][next.toLowerCase()]++;
  }
  const last_key = tx.slice(-order).join("");
  const counts = transitions[last_key];
  if (!counts) return null;
  return counts.t > counts.x ? "T" : "X";
}

function algob_ngram(history) {
  const tx = extract_features(history).tx;
  const k = 4;
  if (tx.length < k + 1) return null;
  const last_gram = tx.slice(-k).join("");
  let counts = { t: 0, x: 0 };
  for (let i = 0; i <= tx.length - k - 1; i++) {
    const gram = tx.slice(i, i + k).join("");
    if (gram === last_gram) counts[tx[i + k].toLowerCase()]++;
  }
  if (counts.t === counts.x) return null;
  return counts.t > counts.x ? "T" : "X";
}

function algos_neo_pattern(history) {
  const tx = extract_features(history).tx;
  const len = tx.length;
  if (len < 20) return null;
  const pattern_lengths = [4, 6];
  let best_pred = null, max_matches = -1;
  for (const pat_len of pattern_lengths) {
    if (len < pat_len * 2 + 1) continue;
    const target_pattern = tx.slice(-pat_len).join("");
    let counts = { t: 0, x: 0 };
    for (let i = 0; i <= len - pat_len - 1; i++) {
      const history_pattern = tx.slice(i, i + pat_len).join("");
      if (similarity([...history_pattern], [...target_pattern]) >= 0.75) {
        counts[tx[i + pat_len].toLowerCase()]++;
      }
    }
    if (counts.t !== counts.x) {
      const current_matches = counts.t + counts.x;
      if (current_matches > max_matches) {
        max_matches = current_matches;
        best_pred = counts.t > counts.x ? "T" : "X";
      }
    }
  }
  return best_pred;
}

function algof_super_deep_analysis(history) {
  if (history.length < 70) return null;
  const features = extract_features(history);
  const tx = features.tx;
  const mean_total = features.mean_total;
  const recent_avg = avg(features.totals.slice(-20));
  if (recent_avg > 13.0 && mean_total > 11.5) return "X";
  if (recent_avg < 8.0 && mean_total < 10.5) return "T";
  if (features.entropy > 0.98) return tx.at(-1) === "T" ? "X" : "T";
  return null;
}

function algoe_transformer(history) {
  const tx = extract_features(history).tx;
  const len = tx.length;
  if (len < 100) return null;
  const target_seq = tx.slice(-10).join("");
  let counts = { t: 0, x: 0 }, total_weight = 0;
  for (let i = 0; i <= len - 11; i++) {
    const history_seq = tx.slice(i, i + 10).join("");
    const score = similarity([...history_seq], [...target_seq]);
    if (score > 0.6) {
      const next_result = tx[i + 10];
      const weight = score * (1 / (len - i));
      counts[next_result.toLowerCase()] = (counts[next_result.toLowerCase()] || 0) + weight;
      total_weight += weight;
    }
  }
  if (total_weight > 0 && counts.t !== counts.x) return counts.t > counts.x ? "T" : "X";
  return null;
}

function algog_super_bridge_predictor(history) {
  const runs = extract_features(history).runs;
  if (runs.length < 2) return null;
  const last_run = runs.at(-1);
  if (last_run.len >= 4) return last_run.val;
  if (runs.length >= 4) {
    const last_4 = runs.slice(-4);
    if (last_4.length === 4 && last_4.every((r) => r.len === 1))
      return last_run.val === "T" ? "X" : "T";
    if (last_run.len >= 6) return last_run.val === "T" ? "X" : "T";
  }
  return null;
}

function algo_h_adaptive_markov(history) {
  const tx = extract_features(history).tx;
  if (tx.length < 20) return null;
  let best_pred = null, max_confidence = -1;
  for (let order = 2; order <= 4; order++) {
    if (tx.length < order + 1) continue;
    const transitions = {};
    for (let i = 0; i <= tx.length - order - 1; i++) {
      const key = tx.slice(i, i + order).join("");
      const next = tx[i + order];
      transitions[key] = transitions[key] || { t: 0, x: 0 };
      transitions[key][next.toLowerCase()]++;
    }
    const last_key = tx.slice(-order).join("");
    const counts = transitions[last_key];
    if (counts && counts.t !== counts.x) {
      const total = counts.t + counts.x;
      const pred = counts.t > counts.x ? "T" : "X";
      const confidence = Math.abs(counts.t - counts.x) / total;
      if (confidence > max_confidence) {
        max_confidence = confidence;
        best_pred = pred;
      }
    }
  }
  return best_pred;
}

function algo_i_cau_reader(history) {
  const features = extract_features(history);
  const runs = features.runs;
  const tx = features.tx;
  if (runs.length < 3 || tx.length < 10) return null;
  const last_run = runs.at(-1);
  const prev_run = runs.at(-2);
  if (last_run.len >= 3 && prev_run && prev_run.len >= 2) return last_run.val;
  const last_4 = runs.slice(-4);
  if (last_4.length === 4 && last_4.every((r) => r.len === 1))
    return last_run.val === "T" ? "X" : "T";
  if (
    last_4.length === 4 &&
    last_4.every((r) => r.len === 2) &&
    last_4[0].val !== last_4[1].val &&
    last_4[1].val !== last_4[2].val &&
    last_4[2].val !== last_4[3].val
  )
    return last_run.val === "T" ? "X" : "T";
  return null;
}

function algo_j_dynamic_cau(history) {
  const features = extract_features(history);
  const runs = features.runs;
  const tx = features.tx;
  if (runs.length < 4 || tx.length < 12) return null;
  const recent_runs = runs.slice(-8);
  const lengths = recent_runs.map((r) => r.len);
  const avg_len = avg(lengths);
  const variance = avg(lengths.map((l) => Math.pow(l - avg_len, 2))) || 0;
  const last_4 = recent_runs.slice(-4);
  const is_alternating =
    last_4.length === 4 && last_4.every((r) => r.len === 1) && new Set(last_4.map((r) => r.val)).size === 2;
  const is_2_2 =
    last_4.length === 4 && last_4.every((r) => r.len === 2) && new Set(last_4.map((r) => r.val)).size === 2;
  let state = "noisy";
  if (avg_len >= 2.2 && variance < 1.0) state = "long";
  else if (is_alternating) state = "alternating";
  else if (is_2_2) state = "2-2";
  const last_run = recent_runs.at(-1);
  if (state === "long" && last_run.len >= 2) return last_run.val;
  if (state === "alternating" || state === "2-2") return last_run.val === "T" ? "X" : "T";
  return null;
}

function algod_score_predictor(history, tx_constraint) {
  const xiu_scores = [4, 5, 6, 7, 8, 9, 10];
  const tai_scores = [11, 12, 13, 14, 15, 16, 17];
  const available_scores = tx_constraint === "T" ? tai_scores : xiu_scores;
  if (available_scores.length < 3) return [null, null, null];
  let score_weighted_counts = {};
  const lookback = Math.min(history.length, 100);
  for (let i = history.length - 2; i >= history.length - lookback && i >= 0; i--) {
    const previous_result = history[i].tx;
    const current_score = history[i + 1].total;
    if (typeof current_score !== "number" || !Number.isFinite(current_score)) continue;
    const age = history.length - 1 - i;
    const decay_factor = 1.0 - age / lookback;
    if (previous_result === tx_constraint && available_scores.includes(current_score)) {
      score_weighted_counts[current_score] = (score_weighted_counts[current_score] || 0) + decay_factor;
    }
  }
  const sorted_scores = Object.keys(score_weighted_counts)
    .sort((a, b) => score_weighted_counts[b] - score_weighted_counts[a])
    .map((s) => parseInt(s, 10));
  let final_scores = sorted_scores.slice(0, 3);
  let used = new Set(final_scores);
  let remaining = available_scores.filter((s) => !used.has(s));
  remaining.sort((a, b) => {
    const center = (available_scores[0] + available_scores.at(-1)) / 2;
    return Math.abs(a - center) - Math.abs(b - center);
  });
  while (final_scores.length < 3 && remaining.length > 0) final_scores.push(remaining.shift());
  if (final_scores.length < 3) return available_scores.slice(0, 3);
  return final_scores;
}

const all_algs = [
  { id: "algo5_freq_rebalance", fn: algo5_freq_rebalance },
  { id: "a_markov", fn: algoa_markov },
  { id: "b_ngram", fn: algob_ngram },
  { id: "s_neo_pattern", fn: algos_neo_pattern },
  { id: "f_super_deep_analysis", fn: algof_super_deep_analysis },
  { id: "e_transformer", fn: algoe_transformer },
  { id: "g_super_bridge_predictor", fn: algog_super_bridge_predictor },
  { id: "h_adaptive_markov", fn: algo_h_adaptive_markov },
  { id: "i_cau_reader", fn: algo_i_cau_reader },
  { id: "j_dynamic_cau", fn: algo_j_dynamic_cau },
];

// ==================== DICE DIST ALGORITHMS ====================
function uniformDist() {
  return { 1: 1 / 6, 2: 1 / 6, 3: 1 / 6, 4: 1 / 6, 5: 1 / 6, 6: 1 / 6 };
}

function algo_d1_freq_dice_dist(history, tx_constraint) {
  const features = extract_features(history);
  const dice_history = features.dice_history;
  if (dice_history.length < 5) return null;
  const allowed = tx_constraint === "T" ? [11, 12, 13, 14, 15, 16, 17] : [4, 5, 6, 7, 8, 9, 10];
  const lookback = Math.min(dice_history.length, 100);
  const pos_weights = [
    { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
  ];
  for (let i = dice_history.length - 1; i >= dice_history.length - lookback && i >= 0; i--) {
    const [a, b, c] = dice_history[i];
    const total = a + b + c;
    if (!allowed.includes(total)) continue;
    const age = dice_history.length - 1 - i;
    const w = 1.0 - age / lookback;
    pos_weights[0][a] += w;
    pos_weights[1][b] += w;
    pos_weights[2][c] += w;
  }
  const dist = pos_weights.map((weights) => {
    const s = Object.values(weights).reduce((a, b) => a + b, 0);
    if (s === 0) return uniformDist();
    const d = {};
    for (let f = 1; f <= 6; f++) d[f] = weights[f] / s;
    return d;
  });
  return { dist, confidence: 0.7, source: "d1_freq_dice_dist" };
}

function algo_d2_pattern_dice_dist(history, tx_constraint) {
  const features = extract_features(history);
  const dice_history = features.dice_history;
  if (dice_history.length < 10) return null;
  const allowed = tx_constraint === "T" ? [11, 12, 13, 14, 15, 16, 17] : [4, 5, 6, 7, 8, 9, 10];
  const recent = dice_history.filter(([a, b, c]) => allowed.includes(a + b + c)).slice(-20);
  if (recent.length < 5) return null;
  const pos_counts = [
    { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
  ];
  for (const [a, b, c] of recent) {
    pos_counts[0][a]++; pos_counts[1][b]++; pos_counts[2][c]++;
  }
  const dist = pos_counts.map((counts) => {
    const s = Object.values(counts).reduce((a, b) => a + b, 0);
    if (s === 0) return uniformDist();
    const d = {};
    for (let f = 1; f <= 6; f++) d[f] = counts[f] / s;
    return d;
  });
  return { dist, confidence: 0.6, source: "d2_pattern_dice_dist" };
}

function algo_d3_conditional_dice_dist(history, tx_constraint) {
  const features = extract_features(history);
  const dice_history = features.dice_history;
  if (dice_history.length < 20) return null;
  const allowed = tx_constraint === "T" ? [11, 12, 13, 14, 15, 16, 17] : [4, 5, 6, 7, 8, 9, 10];
  const valid_dice = dice_history.filter(([a, b, c]) => allowed.includes(a + b + c));
  if (valid_dice.length < 10) return null;
  const pos_counts = [
    { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
  ];
  for (const [a, b, c] of valid_dice) {
    pos_counts[0][a]++; pos_counts[1][b]++; pos_counts[2][c]++;
  }
  const dist = pos_counts.map((counts) => {
    const s = Object.values(counts).reduce((a, b) => a + b, 0);
    if (s === 0) return uniformDist();
    const d = {};
    for (let f = 1; f <= 6; f++) d[f] = counts[f] / s;
    return d;
  });
  return { dist, confidence: 0.65, source: "d3_conditional_dice_dist" };
}

function algo_d4_cau_dice_dist(history, tx_constraint) {
  return algo_d3_conditional_dice_dist(history, tx_constraint);
}

const dice_algos = [
  { id: "d1_freq_dice_dist", fn: algo_d1_freq_dice_dist },
  { id: "d2_pattern_dice_dist", fn: algo_d2_pattern_dice_dist },
  { id: "d3_conditional_dice_dist", fn: algo_d3_conditional_dice_dist },
  { id: "d4_cau_dice_dist", fn: algo_d4_cau_dice_dist },
];

function select_best_dice_from_dist(distList, tx_constraint) {
  if (!Array.isArray(distList) || distList.length === 0) return null;
  const combined = [
    { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
  ];
  let total_weight = 0;
  for (const item of distList) {
    const w = (item.confidence || 0.5) * (item.weight || 0);
    if (w <= 0) continue;
    total_weight += w;
    for (let pos = 0; pos < 3; pos++) {
      const d = item.dist[pos];
      for (let f = 1; f <= 6; f++) combined[pos][f] += w * (d[f] || 0);
    }
  }
  if (total_weight === 0) return null;
  for (let pos = 0; pos < 3; pos++) {
    const s = Object.values(combined[pos]).reduce((a, b) => a + b, 0);
    if (s > 0) for (let f = 1; f <= 6; f++) combined[pos][f] /= s;
  }
  const allowed = tx_constraint === "T" ? [11, 12, 13, 14, 15, 16, 17] : [4, 5, 6, 7, 8, 9, 10];
  let best = null, best_score = -1;
  for (let a = 1; a <= 6; a++)
    for (let b = 1; b <= 6; b++)
      for (let c = 1; c <= 6; c++) {
        const total = a + b + c;
        if (!allowed.includes(total)) continue;
        const prob = combined[0][a] * combined[1][b] * combined[2][c];
        if (prob > best_score) { best_score = prob; best = [a, b, c]; }
      }
  if (!best) {
    const faces = combined.map((d) => {
      const sorted = Object.keys(d).map(Number).sort((f1, f2) => d[f2] - d[f1]);
      return sorted[0] || 1;
    });
    return { faces, confidence: 0.4, source: "combined_dist_fallback" };
  }
  return { faces: best, confidence: 0.75, source: "combined_dist" };
}

// ==================== ONLINE ENSEMBLE ====================
class SeiuOnlineEnsemble {
  constructor(algorithms, diceAlgorithms, opts = {}) {
    this.algs = algorithms;
    this.dice_algos = diceAlgorithms;
    this.weights = {};
    this.dice_weights = {};
    this.ema_alpha = opts.ema_alpha ?? 0.1;
    this.min_weight = opts.min_weight ?? 0.001;
    this.history_window = opts.history_window ?? 500;
    this.online_window_size = opts.online_window_size ?? 40;
    this.alg_stats = {};
    this.dice_alg_stats = {};
    for (const a of algorithms) {
      this.weights[a.id] = 1;
      this.alg_stats[a.id] = { recent: [], long: [] };
    }
    for (const d of diceAlgorithms) {
      this.dice_weights[d.id] = 1;
      this.dice_alg_stats[d.id] = { recent: [], long: [] };
    }
    this.last_prediction = null;
  }

  fit_initial(history) {
    const window = last_n(history.filter((h) => h && h.tx !== "B"), this.history_window);
    if (window.length < 10) return;
    const alg_scores = {};
    for (const a of this.algs) alg_scores[a.id] = 0;
    for (let i = 3; i < window.length; i++) {
      const prefix = window.slice(0, i);
      const actual = window[i].tx;
      for (const a of this.algs) {
        try {
          const pred = a.fn(prefix);
          if (pred && pred === actual) alg_scores[a.id]++;
        } catch { /* skip */ }
      }
    }
    let total = 0;
    for (const id in alg_scores) {
      const w = (alg_scores[id] || 0) + 1;
      this.weights[id] = w;
      total += w;
    }
    for (const id in this.weights) {
      this.weights[id] = Math.max(this.min_weight, this.weights[id] / (total || 1));
    }
  }

  update_with_outcome(history_prefix, actual_tx) {
    if (actual_tx === "B") return;
    for (const a of this.algs) {
      let pred = null;
      try { pred = a.fn(history_prefix); } catch { pred = null; }
      const correct = pred === actual_tx ? 1 : 0;
      const current_weight = this.weights[a.id] || this.min_weight;
      const reward = correct ? 1.05 : 0.95;
      const target_weight = current_weight * reward;
      const nw = this.ema_alpha * target_weight + (1 - this.ema_alpha) * current_weight;
      this.weights[a.id] = Math.max(this.min_weight, nw);
    }
    const s = Object.values(this.weights).reduce((a, b) => a + b, 0) || 1;
    for (const id in this.weights) this.weights[id] /= s;
  }

  update_online(history_prefix, actual_tx, actual_dice) {
    const actual_tx_norm =
      actual_tx === "T" || actual_tx === "tài" || actual_tx === "TÀI" ? "T" :
      actual_tx === "X" || actual_tx === "xỉu" || actual_tx === "XỈU" ? "X" : actual_tx;

    for (const a of this.algs) {
      let pred = null;
      try { pred = a.fn(history_prefix); } catch { pred = null; }
      if (!pred || pred === "N" || pred === "B") continue;
      const correct = pred === actual_tx_norm ? 1 : 0;
      const stats = this.alg_stats[a.id];
      stats.recent.push(correct);
      stats.long.push(correct);
      if (stats.recent.length > this.online_window_size) stats.recent.shift();
      if (stats.long.length > this.history_window) stats.long.shift();
      const acc_recent = avg(stats.recent);
      const acc_long = avg(stats.long);
      let reward;
      if (stats.long.length >= 10 && acc_recent < acc_long * 0.7) reward = 0.8;
      else reward = correct ? 1.05 : 0.95;
      const current_weight = this.weights[a.id] || this.min_weight;
      const target_weight = current_weight * reward;
      const nw = this.ema_alpha * target_weight + (1 - this.ema_alpha) * current_weight;
      this.weights[a.id] = Math.max(this.min_weight, nw);
    }
    const s = Object.values(this.weights).reduce((a, b) => a + b, 0) || 1;
    for (const id in this.weights) this.weights[id] /= s;

    if (!Array.isArray(actual_dice) || actual_dice.length !== 3) return;
    for (const d of this.dice_algos) {
      const tx_constraint = this.last_prediction?.raw || "T";
      let p = null;
      try { p = d.fn(history_prefix, tx_constraint); } catch { p = null; }
      if (!p || !Array.isArray(p.dist) || p.dist.length !== 3) continue;
      const pred_faces = p.dist.map((distObj) => {
        const sorted = Object.keys(distObj).map(Number).sort((f1, f2) => distObj[f2] - distObj[f1]);
        return sorted[0] || 1;
      });
      const actual_faces = actual_dice.map((x) => Math.round(Number(x)));
      const pred_count = {}, actual_count = {};
      for (const f of pred_faces) pred_count[f] = (pred_count[f] || 0) + 1;
      for (const f of actual_faces) actual_count[f] = (actual_count[f] || 0) + 1;
      let match = 0;
      for (const f of Object.keys(pred_count)) {
        if (actual_count[f]) match += Math.min(pred_count[f], actual_count[f]);
      }
      let score = 0;
      if (match === 3) score = 1;
      else if (match === 2) score = 0.5;
      else if (match === 1) score = 0.2;
      const stats = this.dice_alg_stats[d.id];
      stats.recent.push(score);
      stats.long.push(score);
      if (stats.recent.length > this.online_window_size) stats.recent.shift();
      if (stats.long.length > this.history_window) stats.long.shift();
      const acc_recent = avg(stats.recent);
      const acc_long = avg(stats.long);
      let reward;
      if (stats.long.length >= 10 && acc_recent < acc_long * 0.7) reward = 0.8;
      else reward = 0.95 + 0.1 * score;
      const current_weight = this.dice_weights[d.id] || this.min_weight;
      const target_weight = current_weight * reward;
      const nw = this.ema_alpha * target_weight + (1 - this.ema_alpha) * current_weight;
      this.dice_weights[d.id] = Math.max(this.min_weight, nw);
    }
    const sd = Object.values(this.dice_weights).reduce((a, b) => a + b, 0) || 1;
    for (const id in this.dice_weights) this.dice_weights[id] /= sd;
  }

  predict(history) {
    const votes = {};
    let voted = 0;
    for (const a of this.algs) {
      let pred = null;
      try { pred = a.fn(history); } catch { pred = null; }
      if (!pred) continue;
      votes[pred] = (votes[pred] || 0) + (this.weights[a.id] || 0);
      voted++;
    }
    let best, confidence;
    if (!votes["T"] && !votes["X"]) {
      best = algo5_freq_rebalance(history) || "T";
      confidence = 0.5;
    } else {
      const result = majority(votes);
      best = result.key;
      const total = Object.values(votes).reduce((a, b) => a + b, 0);
      confidence = Math.min(0.99, Math.max(0.51, total > 0 ? result.val / total : 0.51));
    }
    const score_prediction = algod_score_predictor(history, best);
    const tx_constraint = best;
    const dist_items = [];
    for (const da of this.dice_algos) {
      let p = null;
      try { p = da.fn(history, tx_constraint); } catch { p = null; }
      if (p && Array.isArray(p.dist) && p.dist.length === 3) {
        dist_items.push({
          dist: p.dist,
          confidence: p.confidence ?? 0.5,
          source: p.source ?? da.id,
          weight: this.dice_weights[da.id] || 0,
        });
      }
    }
    let dice_prediction = null;
    if (dist_items.length > 0) {
      dice_prediction = select_best_dice_from_dist(dist_items, tx_constraint);
    }
    this.last_prediction = { raw: best, dice: dice_prediction };
    return {
      prediction: best === "T" ? "TÀI" : "XỈU",
      confidence,
      raw_prediction: best,
      scorePrediction: score_prediction,
      dice_prediction,
      meta: {
        votedBy: voted,
        regime: entropy(extract_features(history).tx) > 0.95 ? "high_entropy" : "neutral",
        lag: 1,
      },
    };
  }
}

// ==================== WRAPPER CHO SERVER (lag +1) ====================
export class AnhKhoiEngine {
  constructor() {
    this.version = "21.0.0-SEIU";
    this.ensemble = new SeiuOnlineEnsemble(all_algs, dice_algos, {
      ema_alpha: 0.12,
      min_weight: 0.001,
      history_window: 500,
      online_window_size: 40,
    });
    this._fitted = false;
  }

  /** Parse raw API → history chuẩn */
  parseLines(data) {
    if (!data?.data?.resultList?.length) return [];
    // API trả mới nhất trước → reverse để processHistory sort tăng
    const list = [...data.data.resultList];
    return processHistory(list);
  }

  updateStats(/* r */) {
    // stats nằm trong extract_features / ensemble
  }

  fitInitial(hist) {
    if (!hist || hist.length < 10) return;
    this.ensemble.fit_initial(hist);
    this._fitted = true;
  }

  updateOutcome(prefix, actual_tx) {
    this.ensemble.update_with_outcome(prefix, actual_tx);
  }

  /** Gọi khi có kết quả thật + dice để học online */
  updateOnline(prefix, actual_tx, actual_dice) {
    this.ensemble.update_online(prefix, actual_tx, actual_dice);
  }

  /**
   * Dự đoán cho PHIÊN TIẾP THEO (lag +1)
   * history = các phiên đã có kết quả (đến current)
   * output.meta.targetSession = current.session + 1
   */
  predict(hist) {
    if (!hist || hist.length < 5) {
      return {
        prediction: "CHƯA ĐỦ DỮ LIỆU",
        confidence: 0,
        scorePrediction: [],
        meta: { lag: 1, abstained: true, reason: "history too short", votedBy: 0 },
      };
    }
    if (!this._fitted && hist.length >= 10) {
      this.fitInitial(hist);
    }
    const out = this.ensemble.predict(hist);
    const last = hist.at(-1);
    const targetSession = last && Number.isFinite(last.session) ? last.session + 1 : null;
    return {
      prediction: out.prediction,
      confidence: out.confidence,
      scorePrediction: Array.isArray(out.scorePrediction)
        ? out.scorePrediction.filter((x) => x != null)
        : [],
      dicePrediction: out.dice_prediction || null,
      meta: {
        ...(out.meta || {}),
        lag: 1,
        targetSession,
        abstained: out.confidence < 0.53,
        reason: out.confidence < 0.53 ? "low confidence" : `SEIU ensemble • lag+1 → #${targetSession}`,
      },
    };
  }
}
