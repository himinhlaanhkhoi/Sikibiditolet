/**
 * server.js — Công Nghệ Vip PAK 2026
 * Dice Signal Analyzer — Multi-Cầu Adaptive
 * Developer: Anh Khôi
 *
 * API: https://sunwin-taixiu-dulieu.onrender.com/data
 *
 * Lưu ý: Xúc xắc độc lập. Engine tổng hợp nhiều loại cầu + weighted vote.
 * Không cam kết thắng tuyệt đối.
 */

'use strict';

const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = process.env.API_URL || 'https://sunwin-taixiu-dulieu.onrender.com/data';

const HISTORY_LIMIT = 500;
const FETCH_INTERVAL_MS = 20000;
const FETCH_TIMEOUT_MS = 12000;
const PREDICTION_TTL_MS = 6 * 60 * 1000;
const LOG_LIMIT = 150;

/* ---------- Time ---------- */
const VN_FMT = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
});
function vnNow() {
  return VN_FMT.format(new Date()).replace('T', ' ');
}

/* ---------- Normalize ---------- */
function normalizeSide(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toUpperCase();
  if (s === 'TÀI' || s === 'TAI') return 'TAI';
  if (s === 'XỈU' || s === 'XIU') return 'XIU';
  return null;
}

function parseRecord(r) {
  if (!r || typeof r !== 'object') return null;
  const phien = Number(r.phien);
  if (!Number.isFinite(phien) || phien <= 0) return null;
  const side = normalizeSide(r.ket_qua);
  if (!side) return null;

  const x1 = Number(r.xuc_xac_1);
  const x2 = Number(r.xuc_xac_2);
  const x3 = Number(r.xuc_xac_3);
  let tong = Number(r.tong);
  if (!Number.isFinite(tong)) tong = x1 + x2 + x3;

  return {
    phien, x1, x2, x3, tong, side,
    time: typeof r.thoi_gian === 'string' ? r.thoi_gian : vnNow(),
  };
}

/* ============================================================
 * PHÂN LOẠI CẦU CHI TIẾT (dựa trên thống kê thật từ API)
 * ============================================================ */

function getStreak(arr) {
  if (!arr.length) return { side: null, len: 0 };
  const head = arr[0];
  let len = 1;
  while (len < arr.length && arr[len] === head) len++;
  return { side: head, len };
}

/** Bệt 3-4 → theo */
function sigBetNgan(arr) {
  const { side, len } = getStreak(arr);
  if (len < 3 || len > 4) return null;
  return { side, w: 0.52 - (len - 3) * 0.03, tag: `Bệt ${len}`, info: `${len} phiên ${side}` };
}

/** Bệt 5-7 → theo (weight thấp hơn) */
function sigBetTrung(arr) {
  const { side, len } = getStreak(arr);
  if (len < 5 || len > 7) return null;
  return { side, w: 0.46 - (len - 5) * 0.025, tag: `Bệt ${len}`, info: `${len} phiên ${side}` };
}

/** Bệt ≥ 8 → bẻ nhẹ */
function sigBetDai(arr) {
  const { side, len } = getStreak(arr);
  if (len < 8) return null;
  const opp = side === 'TAI' ? 'XIU' : 'TAI';
  return { side: opp, w: Math.min(0.42, 0.34 + (len - 8) * 0.02), tag: `Bẻ bệt ${len}`, info: `Bệt ${len} → ${opp}` };
}

/** Cầu 1-1 */
function sigCau11(arr) {
  if (arr.length < 6) return null;
  for (let i = 0; i < 5; i++) if (arr[i] === arr[i + 1]) return null;
  return { side: arr[0], w: 0.40, tag: 'Cầu 1-1', info: 'TXTXTX' };
}

/** Cầu 2-2 */
function sigCau22(arr) {
  if (arr.length < 4) return null;
  if (arr[0] === arr[1] && arr[2] === arr[3] && arr[0] !== arr[2]) {
    return { side: arr[2], w: 0.43, tag: 'Cầu 2-2', info: 'AABB → B' };
  }
  if (arr.length >= 6 &&
      arr[0] === arr[1] && arr[2] === arr[3] && arr[4] === arr[5] &&
      arr[0] !== arr[2] && arr[2] !== arr[4]) {
    return { side: arr[0], w: 0.44, tag: 'Cầu 2-2 dài', info: 'TTXXTT' };
  }
  return null;
}

/** Cầu 3-3 */
function sigCau33(arr) {
  if (arr.length < 6) return null;
  if (arr[0] === arr[1] && arr[1] === arr[2] &&
      arr[3] === arr[4] && arr[4] === arr[5] && arr[0] !== arr[3]) {
    return { side: arr[3], w: 0.42, tag: 'Cầu 3-3', info: 'AAABBB → B' };
  }
  return null;
}

/** Cầu 2-1 */
function sigCau21(arr) {
  if (arr.length < 6) return null;
  if (arr[0] === arr[1] && arr[0] !== arr[2] &&
      arr[3] === arr[4] && arr[3] !== arr[5] &&
      arr[0] === arr[3] && arr[2] === arr[5]) {
    return { side: arr[0], w: 0.41, tag: 'Cầu 2-1', info: 'TTXTTX' };
  }
  return null;
}

/** Cầu 1-2 */
function sigCau12(arr) {
  if (arr.length < 6) return null;
  if (arr[0] !== arr[1] && arr[1] === arr[2] &&
      arr[3] !== arr[4] && arr[4] === arr[5] &&
      arr[0] === arr[3] && arr[1] === arr[4]) {
    return { side: arr[0], w: 0.41, tag: 'Cầu 1-2', info: 'TXXTXX' };
  }
  return null;
}

/** Gãy 3-2 */
function sigGay32(arr) {
  if (arr.length < 5) return null;
  if (arr[0] === arr[1] && arr[1] === arr[2] && arr[2] !== arr[3] && arr[3] === arr[4]) {
    return { side: arr[3], w: 0.43, tag: 'Gãy 3-2', info: 'AAABB → B' };
  }
  return null;
}

/** Gãy 2-3 */
function sigGay23(arr) {
  if (arr.length < 5) return null;
  if (arr[0] === arr[1] && arr[1] !== arr[2] && arr[2] === arr[3] && arr[3] === arr[4]) {
    return { side: arr[2], w: 0.42, tag: 'Gãy 2-3', info: 'AABBB → B' };
  }
  return null;
}

/** Cầu 2-1-2 */
function sigCau212(arr) {
  if (arr.length < 5) return null;
  if (arr[0] === arr[1] && arr[0] !== arr[2] && arr[2] !== arr[3] && arr[3] === arr[4] && arr[0] === arr[3]) {
    return { side: arr[0], w: 0.39, tag: 'Cầu 2-1-2', info: 'TTXTT' };
  }
  return null;
}

/** Cầu 1-2-1 */
function sigCau121(arr) {
  if (arr.length < 5) return null;
  if (arr[0] !== arr[1] && arr[1] === arr[2] && arr[2] !== arr[3] && arr[3] === arr[0]) {
    return { side: arr[1], w: 0.38, tag: 'Cầu 1-2-1', info: 'TXXTX' };
  }
  return null;
}

/** Cầu 1-2-3 (edge khá tốt theo thống kê) */
function sigCau123(arr) {
  if (arr.length < 6) return null;
  if (arr[0] !== arr[1] && arr[1] === arr[2] &&
      arr[3] === arr[4] && arr[4] === arr[5] && arr[0] !== arr[3]) {
    return { side: arr[3], w: 0.44, tag: 'Cầu 1-2-3', info: 'TXXTTT' };
  }
  return null;
}

/** Cầu 3-2-1 */
function sigCau321(arr) {
  if (arr.length < 6) return null;
  if (arr[0] === arr[1] && arr[1] === arr[2] &&
      arr[3] === arr[4] && arr[2] !== arr[3] && arr[4] !== arr[5]) {
    return { side: arr[5], w: 0.38, tag: 'Cầu 3-2-1', info: 'TTTXXT' };
  }
  return null;
}

/** Cầu kẹp */
function sigKep(arr) {
  if (arr.length < 5) return null;
  if (arr[0] !== arr[1] && arr[1] === arr[2] && arr[2] !== arr[3] && arr[3] === arr[0]) {
    return { side: arr[1], w: 0.37, tag: 'Cầu kẹp', info: 'TXTTX' };
  }
  return null;
}

/** Vị cực trị */
function sigViCucTri(history) {
  if (!history.length) return null;
  const t = history[0].tong;
  if (t >= 16) return { side: 'XIU', w: 0.44, tag: 'Vị cao', info: `Tổng ${t}` };
  if (t <= 5)  return { side: 'TAI', w: 0.44, tag: 'Vị thấp', info: `Tổng ${t}` };
  return null;
}

/** Mean revert */
function sigMeanRevert(history) {
  if (history.length < 10) return null;
  const avg = history.slice(0, 10).reduce((s, h) => s + h.tong, 0) / 10;
  if (avg >= 11.8) return { side: 'XIU', w: 0.30, tag: 'Mean revert', info: `AVG=${avg.toFixed(2)}` };
  if (avg <= 9.2)  return { side: 'TAI', w: 0.30, tag: 'Mean revert', info: `AVG=${avg.toFixed(2)}` };
  return null;
}

/** Pattern Repeat L=3..7 */
function sigPatternRepeat(arr) {
  if (arr.length < 16) return null;
  const W = arr.slice(0, 45);
  for (let L = 7; L >= 3; L--) {
    if (W.length < L * 2 + 1) continue;
    const head = W.slice(0, L).join('');
    for (let i = 1; i <= W.length - L - 1; i++) {
      if (W.slice(i, i + L).join('') === head) {
        const next = W[i - 1];
        if (!next) continue;
        return {
          side: next,
          w: 0.32 + Math.min(L, 7) * 0.018,
          tag: `Pattern L${L}`,
          info: `offset ${i}`,
        };
      }
    }
  }
  return null;
}

/** Bias 20 phiên */
function sigBias20(arr) {
  if (arr.length < 16) return null;
  const win = arr.slice(0, 20);
  let tai = 0, xiu = 0;
  for (const s of win) s === 'TAI' ? tai++ : xiu++;
  const total = tai + xiu;
  const ratio = Math.max(tai, xiu) / total;
  if (ratio < 0.60) return null;
  const side = tai > xiu ? 'TAI' : 'XIU';
  return {
    side,
    w: 0.28 + (ratio - 0.60) * 0.6,
    tag: 'Bias 20',
    info: `T${tai}-X${xiu}`,
  };
}

const SIGNALS = [
  { fn: sigBetNgan,       needs: 'arr' },
  { fn: sigBetTrung,      needs: 'arr' },
  { fn: sigBetDai,        needs: 'arr' },
  { fn: sigCau11,         needs: 'arr' },
  { fn: sigCau22,         needs: 'arr' },
  { fn: sigCau33,         needs: 'arr' },
  { fn: sigCau21,         needs: 'arr' },
  { fn: sigCau12,         needs: 'arr' },
  { fn: sigGay32,         needs: 'arr' },
  { fn: sigGay23,         needs: 'arr' },
  { fn: sigCau212,        needs: 'arr' },
  { fn: sigCau121,        needs: 'arr' },
  { fn: sigCau123,        needs: 'arr' },
  { fn: sigCau321,        needs: 'arr' },
  { fn: sigKep,           needs: 'arr' },
  { fn: sigViCucTri,      needs: 'hist' },
  { fn: sigMeanRevert,    needs: 'hist' },
  { fn: sigPatternRepeat, needs: 'arr' },
  { fn: sigBias20,        needs: 'arr' },
];

/* ============================================================
 * ENGINE
 * ============================================================ */
class PAKEngine {
  constructor() {
    this.history = [];
    this.errorStreak = 0;
    this.correctStreak = 0;
  }

  load(records) {
    this.history = [...records].sort((a, b) => b.phien - a.phien);
  }

  get arr() {
    return this.history.map(h => h.side);
  }

  decide() {
    const arr = this.arr;
    if (arr.length < 4) return null;

    const fired = [];
    for (const s of SIGNALS) {
      const input = s.needs === 'hist' ? this.history : arr;
      const out = s.fn(input);
      if (out) fired.push(out);
    }

    if (fired.length === 0) {
      return {
        side: arr[0],
        confidence: 53,
        tag: 'Bám phiên',
        info: 'Không có cầu rõ',
        fallback: true,
        votes: [],
      };
    }

    let taiW = 0, xiuW = 0;
    for (const f of fired) {
      if (f.side === 'TAI') taiW += f.w;
      else xiuW += f.w;
    }
    const total = taiW + xiuW;
    const side = taiW >= xiuW ? 'TAI' : 'XIU';
    const winW = Math.max(taiW, xiuW);
    const agree = total > 0 ? winW / total : 0.5;

    const signalFactor = Math.min(fired.length / 8, 1);
    let conf = Math.round(50 + agree * 36 + signalFactor * 10);
    conf = Math.max(53, Math.min(90, conf));

    return {
      side,
      confidence: conf,
      tag: fired.map(f => f.tag).join(' + '),
      info: fired.map(f => `${f.tag}:${f.side}(${f.w.toFixed(2)})`).join(' · '),
      fallback: false,
      votes: fired,
    };
  }

  applyContrarian(decision) {
    if (!decision || decision.fallback) return decision;
    if (this.errorStreak < 2) return decision;
    const opp = decision.side === 'TAI' ? 'XIU' : 'TAI';
    return {
      ...decision,
      side: opp,
      confidence: Math.min(90, decision.confidence + 6),
      tag: '[CONTRA] ' + decision.tag,
      info: `Sai liên tiếp ${this.errorStreak} → đảo | ${decision.info}`,
    };
  }

  onResolved(correct) {
    if (correct) {
      this.correctStreak++;
      this.errorStreak = 0;
    } else {
      this.errorStreak++;
      this.correctStreak = 0;
    }
  }
}

const engine = new PAKEngine();

/* ============================================================
 * STATE
 * ============================================================ */
const stats = {
  total: 0,
  correct: 0,
  wrong: 0,
  fallback_total: 0,
  fallback_correct: 0,
  start_time: vnNow(),
};

let lastData = [];
let lastPrediction = null;
let predictionLog = [];
let isFetching = false;

/* ============================================================
 * FETCH
 * ============================================================ */
async function fetchAndAnalyze() {
  if (isFetching) return;
  isFetching = true;
  try {
    const res = await axios.get(API_URL, { timeout: FETCH_TIMEOUT_MS });
    const raw = res.data;
    if (!raw || !Array.isArray(raw.data)) {
      console.warn('[WARN] Payload không hợp lệ');
      return;
    }

    const parsed = [];
    for (const r of raw.data) {
      const v = parseRecord(r);
      if (v) parsed.push(v);
    }

    const data = parsed
      .sort((a, b) => b.phien - a.phien)
      .slice(0, HISTORY_LIMIT);

    lastData = data;

    // Resolve
    if (lastPrediction) {
      const match = data.find(d => d.phien === lastPrediction.phienDuDoan);
      if (match) {
        const actual = match.side;
        const isCorrect = lastPrediction.side === actual;
        engine.onResolved(isCorrect);

        predictionLog.unshift({
          phien: match.phien,
          predict: lastPrediction.side,
          actual,
          confidence: lastPrediction.confidence,
          tag: lastPrediction.tag,
          correct: isCorrect,
          fallback: lastPrediction.fallback,
          time: match.time,
        });
        if (predictionLog.length > LOG_LIMIT) predictionLog.pop();

        stats.total++;
        if (isCorrect) stats.correct++;
        else stats.wrong++;
        if (lastPrediction.fallback) {
          stats.fallback_total++;
          if (isCorrect) stats.fallback_correct++;
        }

        console.log(`[RESOLVED] #${match.phien} | ${lastPrediction.side} → ${actual} | ${isCorrect ? 'ĐÚNG' : 'SAI'}`);
        lastPrediction = null;
      } else {
        const age = Date.now() - new Date(lastPrediction.iso).getTime();
        if (age > PREDICTION_TTL_MS) {
          predictionLog.unshift({
            phien: lastPrediction.phienDuDoan,
            predict: lastPrediction.side,
            actual: null,
            confidence: lastPrediction.confidence,
            tag: lastPrediction.tag,
            correct: false,
            fallback: lastPrediction.fallback,
            miss: true,
            time: vnNow(),
          });
          if (predictionLog.length > LOG_LIMIT) predictionLog.pop();
          lastPrediction = null;
        }
      }
    }

    // Predict
    if (!lastPrediction && data.length >= 12) {
      engine.load(data);
      let d = engine.decide();
      d = engine.applyContrarian(d);

      const nextPhien = data[0].phien + 1;
      lastPrediction = {
        phienDuDoan: nextPhien,
        side: d.side,
        confidence: d.confidence,
        tag: d.tag,
        info: d.info,
        fallback: !!d.fallback,
        timestamp: vnNow(),
        iso: new Date().toISOString(),
      };
      console.log(`[PREDICT] #${nextPhien} → ${d.side} (${d.confidence}%) | ${d.tag}`);
    }
  } catch (err) {
    console.error('[FETCH ERROR]', err.message);
  } finally {
    isFetching = false;
  }
}

process.on('unhandledRejection', r => console.error('[UNHANDLED]', r));
process.on('uncaughtException', e => console.error('[UNCAUGHT]', e));

/* ============================================================
 * UI HOÀN TOÀN MỚI — 2026 Tech Style
 * ============================================================ */
const HTML = String.raw`<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>PAK 2026 — Signal Engine</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #030712;
  --panel: rgba(8, 15, 35, 0.82);
  --panel2: rgba(12, 25, 55, 0.7);
  --border: rgba(56, 189, 248, 0.15);
  --border2: rgba(56, 189, 248, 0.28);
  --text: #e2e8f0;
  --dim: #94a3b8;
  --mute: #64748b;
  --cyan: #22d3ee;
  --blue: #38bdf8;
  --indigo: #818cf8;
  --ok: #4ade80;
  --bad: #f87171;
  --glow: 0 0 40px rgba(34, 211, 238, 0.15);
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  background-image:
    radial-gradient(ellipse 100% 80% at 0% -30%, rgba(14, 165, 233, 0.18), transparent 50%),
    radial-gradient(ellipse 80% 60% at 100% 0%, rgba(99, 102, 241, 0.12), transparent 45%),
    radial-gradient(ellipse 60% 40% at 50% 100%, rgba(6, 182, 212, 0.08), transparent);
}
.shell { max-width: 1100px; margin: 0 auto; padding: 24px 16px 50px; }

/* Header */
.top {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-wrap: wrap;
  margin-bottom: 28px; padding-bottom: 20px;
  border-bottom: 1px solid var(--border);
}
.brand { display: flex; align-items: center; gap: 14px; }
.mark {
  width: 46px; height: 46px; border-radius: 12px;
  background: linear-gradient(135deg, #0ea5e9, #22d3ee 60%, #a5f3fc);
  display: grid; place-items: center;
  font-family: 'Syne', sans-serif; font-weight: 800; font-size: 14px; color: #020617;
  box-shadow: 0 0 30px rgba(34, 211, 238, 0.45);
}
.brand h1 {
  font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800;
  letter-spacing: -0.03em;
  background: linear-gradient(90deg, #f0f9ff, #67e8f9, #22d3ee);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.brand p {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px; color: var(--mute); letter-spacing: 0.12em; margin-top: 2px;
}
.live {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 14px; border-radius: 100px;
  background: var(--panel); border: 1px solid var(--border2);
  font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--dim);
}
.live i {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--ok); box-shadow: 0 0 8px var(--ok);
  animation: blink 1.8s infinite;
}
.live.off i { background: var(--bad); box-shadow: 0 0 8px var(--bad); animation: none; }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.4} }

/* Main grid */
.main {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}
@media (max-width: 860px) { .main { grid-template-columns: 1fr; } }

.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 22px;
  backdrop-filter: blur(20px);
  box-shadow: var(--glow);
  position: relative;
}
.panel::after {
  content: '';
  position: absolute; inset: 0; border-radius: 18px;
  padding: 1px;
  background: linear-gradient(135deg, rgba(34,211,238,0.25), transparent 40%, transparent 60%, rgba(129,140,248,0.15));
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
  pointer-events: none;
}
.label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px; color: var(--cyan);
  letter-spacing: 0.18em; text-transform: uppercase;
  margin-bottom: 14px;
}

/* Prediction */
.side {
  font-family: 'Syne', sans-serif;
  font-size: 64px; font-weight: 800; line-height: 1;
  letter-spacing: -0.04em; margin-bottom: 10px;
}
.side.tai { color: var(--cyan); text-shadow: 0 0 50px rgba(34,211,238,0.5); }
.side.xiu { color: var(--indigo); text-shadow: 0 0 50px rgba(129,140,248,0.5); }
.side.none { color: var(--mute); font-size: 42px; text-shadow: none; }

.meta {
  display: flex; gap: 16px; flex-wrap: wrap;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px; color: var(--dim); margin-bottom: 12px;
}
.meta b { color: var(--text); font-weight: 600; }

.tag {
  display: inline-block;
  padding: 5px 12px; border-radius: 8px;
  background: rgba(34, 211, 238, 0.08);
  border: 1px solid rgba(34, 211, 238, 0.22);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px; color: var(--cyan); margin-bottom: 10px;
}
.info {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11.5px; color: var(--mute); line-height: 1.65;
}

/* Stats */
.stats {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
}
.stat {
  background: var(--panel2);
  border: 1px solid var(--border);
  border-radius: 12px; padding: 12px 14px;
}
.stat .n {
  font-family: 'JetBrains Mono', monospace;
  font-size: 22px; font-weight: 600;
}
.stat .n.ok { color: var(--ok); }
.stat .n.bad { color: var(--bad); }
.stat .n.acc { color: var(--blue); }
.stat .k {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px; color: var(--mute);
  letter-spacing: 0.14em; text-transform: uppercase; margin-top: 2px;
}
.streak-box {
  margin-top: 12px;
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px; border-radius: 10px;
  background: rgba(129, 140, 248, 0.07);
  border: 1px solid rgba(129, 140, 248, 0.18);
  font-family: 'JetBrains Mono', monospace; font-size: 12px;
}
.streak-box span:last-child { color: var(--indigo); font-weight: 600; font-size: 15px; }
.note {
  margin-top: 11px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px; color: var(--mute); line-height: 1.55;
}

/* Table */
.table-panel { margin-top: 4px; }
.table-wrap {
  overflow-x: auto; border-radius: 12px;
  border: 1px solid var(--border); background: var(--panel2);
}
table { width: 100%; border-collapse: collapse; }
th {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--cyan); font-weight: 500;
  text-align: left; padding: 11px 13px;
  background: rgba(8, 15, 35, 0.6);
  border-bottom: 1px solid var(--border);
}
td {
  padding: 10px 13px; border-bottom: 1px solid var(--border);
  font-family: 'JetBrains Mono', monospace; font-size: 12px;
}
tr:last-child td { border-bottom: none; }
tr:hover td { background: rgba(34, 211, 238, 0.03); }
.pill {
  display: inline-block; padding: 2px 8px; border-radius: 5px;
  font-size: 11px; font-weight: 600;
}
.pill.tai { color: var(--cyan); background: rgba(34,211,238,0.1); border: 1px solid rgba(34,211,238,0.2); }
.pill.xiu { color: var(--indigo); background: rgba(129,140,248,0.1); border: 1px solid rgba(129,140,248,0.2); }
.pill.miss { color: var(--mute); background: rgba(100,116,139,0.12); }
.ok { color: var(--ok); font-weight: 600; }
.bad { color: var(--bad); font-weight: 600; }
.miss { color: var(--mute); }
.empty {
  text-align: center; padding: 28px; color: var(--mute);
  font-family: 'JetBrains Mono', monospace; font-size: 12px;
}

.foot {
  margin-top: 28px; padding-top: 16px;
  border-top: 1px solid var(--border);
  display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;
  font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--mute);
}
.foot b { color: var(--cyan); }
</style>
</head>
<body>
<div class="shell">
  <div class="top">
    <div class="brand">
      <div class="mark">PAK</div>
      <div>
        <h1>Signal Engine</h1>
        <p>MULTI-CẦU · 2026</p>
      </div>
    </div>
    <div id="live" class="live"><i></i><span id="liveText">Connecting</span></div>
  </div>

  <div class="main">
    <div class="panel">
      <div class="label">Next Session</div>
      <div id="pSide" class="side none">--</div>
      <div class="meta">
        <span>Confidence <b id="pConf">--%</b></span>
        <span>Phiên <b id="pPhien">#--</b></span>
      </div>
      <div id="pTag" class="tag">--</div>
      <div id="pInfo" class="info">Waiting for data stream...</div>
    </div>

    <div class="panel">
      <div class="label">Performance</div>
      <div class="stats">
        <div class="stat"><div id="sTotal" class="n">0</div><div class="k">Total</div></div>
        <div class="stat"><div id="sCorrect" class="n ok">0</div><div class="k">Hit</div></div>
        <div class="stat"><div id="sWrong" class="n bad">0</div><div class="k">Miss</div></div>
        <div class="stat"><div id="sAcc" class="n acc">0%</div><div class="k">Accuracy</div></div>
      </div>
      <div class="streak-box">
        <span style="color:var(--mute)">ERROR STREAK</span>
        <span id="sStreak">0</span>
      </div>
      <div class="note" id="footNote">--</div>
    </div>
  </div>

  <div class="panel table-panel">
    <div class="label">Prediction Log</div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Phiên</th><th>Predict</th><th>Actual</th><th>Conf</th><th>Cầu</th><th>Result</th>
          </tr>
        </thead>
        <tbody id="tbody">
          <tr><td colspan="6" class="empty">No resolved predictions yet.</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="foot">
    <div>Developer <b>Anh Khôi</b> · PAK 2026</div>
    <div id="footTime">--</div>
  </div>
</div>

<script>
const $ = id => document.getElementById(id);
const set = (id, v) => { const el = $(id); if (el) el.textContent = v == null ? '' : String(v); };

function setSide(el, side) {
  el.classList.remove('tai', 'xiu', 'none');
  if (side === 'TAI') { el.classList.add('tai'); el.textContent = 'TÀI'; }
  else if (side === 'XIU') { el.classList.add('xiu'); el.textContent = 'XỈU'; }
  else { el.classList.add('none'); el.textContent = '--'; }
}

function renderLog(rows) {
  const tb = $('tbody');
  while (tb.firstChild) tb.removeChild(tb.firstChild);
  if (!rows || !rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6; td.className = 'empty';
    td.textContent = 'No resolved predictions yet.';
    tr.appendChild(td); tb.appendChild(tr);
    return;
  }
  for (const r of rows) {
    const tr = document.createElement('tr');
    const cells = [
      '#' + r.phien,
      null, // predict
      null, // actual
      (r.confidence != null ? r.confidence : '--') + '%',
      r.tag || '',
      null  // result
    ];
    // phien
    let td = document.createElement('td'); td.textContent = cells[0]; tr.appendChild(td);
    // predict
    td = document.createElement('td');
    let sp = document.createElement('span');
    sp.className = 'pill ' + (r.predict === 'TAI' ? 'tai' : 'xiu');
    sp.textContent = r.predict === 'TAI' ? 'TÀI' : 'XỈU';
    td.appendChild(sp); tr.appendChild(td);
    // actual
    td = document.createElement('td');
    if (r.actual) {
      sp = document.createElement('span');
      sp.className = 'pill ' + (r.actual === 'TAI' ? 'tai' : 'xiu');
      sp.textContent = r.actual === 'TAI' ? 'TÀI' : 'XỈU';
      td.appendChild(sp);
    } else {
      sp = document.createElement('span'); sp.className = 'pill miss'; sp.textContent = 'MISS';
      td.appendChild(sp);
    }
    tr.appendChild(td);
    // conf
    td = document.createElement('td'); td.textContent = cells[3]; tr.appendChild(td);
    // tag
    td = document.createElement('td');
    td.textContent = cells[4];
    td.style.color = 'var(--dim)';
    td.style.maxWidth = '200px';
    td.style.overflow = 'hidden';
    td.style.textOverflow = 'ellipsis';
    td.style.whiteSpace = 'nowrap';
    tr.appendChild(td);
    // result
    td = document.createElement('td');
    if (r.miss) { td.className = 'miss'; td.textContent = 'MISS'; }
    else if (r.correct) { td.className = 'ok'; td.textContent = 'HIT'; }
    else { td.className = 'bad'; td.textContent = 'MISS'; }
    tr.appendChild(td);
    tb.appendChild(tr);
  }
}

async function pull() {
  try {
    const res = await fetch('/api/dashboard', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const d = await res.json();

    if (d.prediction) {
      setSide($('pSide'), d.prediction.side);
      set('pConf', d.prediction.confidence + '%');
      set('pPhien', '#' + d.prediction.phienDuDoan);
      set('pTag', d.prediction.tag || '--');
      set('pInfo', d.prediction.info || '');
    } else {
      setSide($('pSide'), null);
      set('pConf', '--%');
      set('pPhien', '#--');
      set('pTag', '--');
      set('pInfo', 'Need at least 12 sessions to analyze.');
    }

    set('sTotal', d.stats.total);
    set('sCorrect', d.stats.correct);
    set('sWrong', d.stats.wrong);
    const acc = d.stats.total > 0 ? ((d.stats.correct / d.stats.total) * 100).toFixed(1) : '0.0';
    set('sAcc', acc + '%');
    set('sStreak', d.error_streak);
    set('footNote', 'Fallback ' + d.stats.fallback_correct + '/' + d.stats.fallback_total + ' · Data ' + d.dataCount + ' sessions');
    set('footTime', 'Updated ' + d.lastUpdate);

    renderLog(d.log);

    const live = $('live');
    live.classList.remove('off');
    set('liveText', 'Live');
  } catch (e) {
    $('live').classList.add('off');
    set('liveText', 'Offline');
    console.error(e);
  }
}

pull();
setInterval(pull, 7000);
</script>
</body>
</html>`;

app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(HTML);
});

app.get('/api/dashboard', (req, res) => {
  res.json({
    prediction: lastPrediction,
    stats,
    log: predictionLog.slice(0, 60),
    error_streak: engine.errorStreak,
    lastUpdate: vnNow(),
    dataCount: lastData.length,
  });
});

app.get('/api/raw', (req, res) => {
  res.json({ data: lastData.slice(0, 80) });
});

app.listen(PORT, () => {
  console.log('[PAK] Công Nghệ Vip PAK 2026 — Multi-Cầu Signal Engine');
  console.log('[PAK] http://localhost:' + PORT);
  console.log('[PAK] Developer: Anh Khôi');
});

fetchAndAnalyze();
setInterval(fetchAndAnalyze, FETCH_INTERVAL_MS);
