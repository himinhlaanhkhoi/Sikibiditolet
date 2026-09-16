/**
 * server.js — Công Nghệ Vip PAK
 * Dice Signal Analyzer
 * Developer: Anh Khôi
 *
 * Nguồn: https://sunwin-taixiu-dulieu.onrender.com/data
 *
 * Lưu ý kỹ thuật: dữ liệu xúc xắc là ngẫu nhiên độc lập.
 * Engine này tổng hợp nhiều heuristic và log hit-rate thật.
 * Không có cam kết thắng.
 */

'use strict';

const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = process.env.API_URL || 'https://sunwin-taixiu-dulieu.onrender.com/data';

const HISTORY_LIMIT = 400;
const FETCH_INTERVAL_MS = 25000;
const FETCH_TIMEOUT_MS = 12000;
const PREDICTION_TTL_MS = 6 * 60 * 1000;
const LOG_LIMIT = 120;

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
        phien,
        x1, x2, x3,
        tong,
        side,
        time: typeof r.thoi_gian === 'string' ? r.thoi_gian : vnNow(),
    };
}

/* ============================================================
 * SIGNALS
 * Mỗi signal trả { side, w, tag, info } hoặc null.
 * w ∈ (0, 1] — độ tin cậy tương đối. Tổng hợp bằng weighted vote.
 * ============================================================ */

/** Bệt ngắn 2–4: theo bệt, weight giảm dần khi bệt dài ra. */
function sigBetNgan(arr) {
    if (arr.length < 2) return null;
    const head = arr[0];
    let len = 1;
    while (len < arr.length && arr[len] === head) len++;
    if (len < 2 || len > 4) return null;
    return {
        side: head,
        w: 0.55 - (len - 2) * 0.05,
        tag: `Bệt ${len}`,
        info: `${len} phiên ${head}`,
    };
}

/** Bệt dài ≥ 6: bẻ sang đối diện, weight tăng nhẹ theo độ dài (mean reversion yếu). */
function sigBeBet(arr) {
    if (arr.length < 6) return null;
    const head = arr[0];
    let len = 1;
    while (len < arr.length && arr[len] === head) len++;
    if (len < 6) return null;
    const opp = head === 'TAI' ? 'XIU' : 'TAI';
    const w = Math.min(0.55, 0.35 + (len - 6) * 0.03);
    return {
        side: opp,
        w,
        tag: `Bẻ bệt ${len}`,
        info: `${len} phiên ${head} → nghiêng ${opp}`,
    };
}

/** Cầu 1-1: 6 phần tử đầu xen kẽ ABABAB → dự A. */
function sigCau11(arr) {
    if (arr.length < 6) return null;
    for (let i = 0; i < 5; i++) if (arr[i] === arr[i + 1]) return null;
    return { side: arr[0], w: 0.42, tag: 'Cầu 1-1', info: 'ABABAB' };
}

/** Cầu 2-2: AABB → dự B. */
function sigCau22(arr) {
    if (arr.length < 4) return null;
    if (arr[0] === arr[1] && arr[2] === arr[3] && arr[0] !== arr[2]) {
        return { side: arr[2], w: 0.42, tag: 'Cầu 2-2', info: 'AABB → B' };
    }
    return null;
}

/** Cầu 3-3: AAABBB → dự B. */
function sigCau33(arr) {
    if (arr.length < 6) return null;
    if (arr[0] === arr[1] && arr[1] === arr[2] &&
        arr[3] === arr[4] && arr[4] === arr[5] &&
        arr[0] !== arr[3]) {
        return { side: arr[3], w: 0.40, tag: 'Cầu 3-3', info: 'AAABBB → B' };
    }
    return null;
}

/** Gãy 3-2: AAABB → dự B. */
function sigGay32(arr) {
    if (arr.length < 5) return null;
    if (arr[0] === arr[1] && arr[1] === arr[2] &&
        arr[2] !== arr[3] && arr[3] === arr[4]) {
        return { side: arr[3], w: 0.40, tag: 'Gãy 3-2', info: 'AAABB → B' };
    }
    return null;
}

/** Vị cực trị: tổng rất cao/rất thấp → hồi. */
function sigViCucTri(history) {
    if (history.length < 2) return null;
    const t = history[0].tong;
    if (t >= 16) return { side: 'XIU', w: 0.45, tag: 'Vị cao', info: `Tổng ${t}` };
    if (t <= 5) return { side: 'TAI', w: 0.45, tag: 'Vị thấp', info: `Tổng ${t}` };
    return null;
}

/** Mean reversion 10 phiên: avg > 11.5 → Xỉu, avg < 9.5 → Tài. */
function sigMeanRevert(history) {
    if (history.length < 10) return null;
    const s = history.slice(0, 10).map(h => h.tong);
    const avg = s.reduce((a, b) => a + b, 0) / s.length;
    if (avg >= 11.6) return { side: 'XIU', w: 0.30, tag: 'Mean revert', info: `AVG10=${avg.toFixed(2)}` };
    if (avg <= 9.4) return { side: 'TAI', w: 0.30, tag: 'Mean revert', info: `AVG10=${avg.toFixed(2)}` };
    return null;
}

/**
 * Pattern repeat: tìm subsequence độ dài L (3..7) ở 40 phiên gần nhất
 * khớp với subsequence mới nhất, dự đoán theo phần tử kế tiếp của lần khớp cũ.
 */
function sigPatternRepeat(arr) {
    if (arr.length < 15) return null;
    const W = arr.slice(0, 40);
    for (let L = 7; L >= 3; L--) {
        if (W.length < L * 2 + 1) continue;
        const head = W.slice(0, L).join('');
        for (let i = 1; i <= W.length - L - 1; i++) {
            const past = W.slice(i, i + L).join('');
            if (past === head) {
                const next = W[i - 1];
                if (!next) continue;
                return {
                    side: next,
                    w: 0.30 + Math.min(L, 7) * 0.025,
                    tag: `Pattern ${L}`,
                    info: `Khớp offset ${i} (L=${L})`,
                };
            }
        }
    }
    return null;
}

const SIGNALS = [
    { fn: sigBetNgan,        needs: 'arr' },
    { fn: sigBeBet,          needs: 'arr' },
    { fn: sigCau11,          needs: 'arr' },
    { fn: sigCau22,          needs: 'arr' },
    { fn: sigCau33,          needs: 'arr' },
    { fn: sigGay32,          needs: 'arr' },
    { fn: sigViCucTri,       needs: 'hist' },
    { fn: sigMeanRevert,     needs: 'hist' },
    { fn: sigPatternRepeat,  needs: 'arr' },
];

/* ============================================================
 * ENGINE — weighted vote, contrarian when streak thua
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
        if (arr.length < 2) return null;

        const fired = [];
        for (const s of SIGNALS) {
            const input = s.needs === 'hist' ? this.history : arr;
            const out = s.fn(input);
            if (out) fired.push(out);
        }

        if (fired.length === 0) {
            return {
                side: arr[0],
                confidence: 50,
                tag: 'Bám phiên',
                info: 'Không signal nào fire',
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

        const signalFactor = Math.min(fired.length / 6, 1);
        let conf = Math.round(45 + agree * 35 + signalFactor * 12);
        conf = Math.max(50, Math.min(88, conf));

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
            confidence: Math.min(88, decision.confidence + 8),
            tag: '[CONTRA] ' + decision.tag,
            info: `Chuỗi ${this.errorStreak} sai → đảo | ${decision.info}`,
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
    last_prediction: null,
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
        let invalid = 0;
        for (const r of raw.data) {
            const v = parseRecord(r);
            if (v) parsed.push(v);
            else invalid++;
        }
        if (invalid > 0) console.warn(`[WARN] ${invalid}/${raw.data.length} record bỏ`);

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
                stats.last_prediction = lastPrediction.side;

                console.log(`[RESOLVED] #${match.phien} | ${lastPrediction.side} → ${actual} | ${isCorrect ? 'ĐÚNG' : 'SAI'} | streak ${engine.errorStreak}`);
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
                    console.warn(`[MISS] #${lastPrediction.phienDuDoan}`);
                    lastPrediction = null;
                }
            }
        }

        // Predict
        if (!lastPrediction && data.length >= 10) {
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

process.on('unhandledRejection', (r) => console.error('[UNHANDLED]', r));
process.on('uncaughtException', (e) => console.error('[UNCAUGHT]', e));

/* ============================================================
 * UI
 * ============================================================ */
const HTML = String.raw`<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Công Nghệ Vip PAK</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #08090f;
    --surface: #0e1018;
    --surface-2: #14161f;
    --line: rgba(255,255,255,0.07);
    --line-2: rgba(255,255,255,0.12);
    --txt: #eef0f6;
    --dim: #8b91a8;
    --mute: #565c72;
    --tai: #22c55e;
    --xiu: #ef4444;
    --acc: #3b82f6;
    --warn: #f59e0b;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', system-ui, sans-serif;
    background: var(--bg);
    color: var(--txt);
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 1160px; margin: 0 auto; padding: 28px 20px 60px; }

  header {
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px; flex-wrap: wrap;
    padding-bottom: 22px; margin-bottom: 24px;
    border-bottom: 1px solid var(--line);
  }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand-logo {
    width: 40px; height: 40px; border-radius: 10px;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    display: grid; place-items: center;
    font-family: 'JetBrains Mono', monospace;
    font-weight: 700; font-size: 13px; color: #fff;
    letter-spacing: -0.5px;
  }
  .brand h1 {
    font-size: 17px; font-weight: 700; letter-spacing: -0.01em;
  }
  .brand small {
    display: block;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px; color: var(--mute);
    letter-spacing: 0.05em; margin-top: 2px;
  }
  .status {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 6px 12px;
    background: var(--surface);
    border: 1px solid var(--line-2);
    border-radius: 999px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px; color: var(--dim);
  }
  .status .dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--tai);
  }
  .status.off .dot { background: var(--xiu); }

  .grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 16px; margin-bottom: 16px; }
  @media (max-width: 860px) { .grid { grid-template-columns: 1fr; } }

  .card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 22px;
  }
  .card-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px; color: var(--mute);
    letter-spacing: 0.14em; text-transform: uppercase;
    margin-bottom: 16px;
  }

  .pred-side {
    font-size: 68px; font-weight: 800; line-height: 1;
    letter-spacing: -0.03em; margin-bottom: 10px;
  }
  .pred-side.tai { color: var(--tai); }
  .pred-side.xiu { color: var(--xiu); }
  .pred-side.none { color: var(--mute); font-size: 42px; }

  .pred-meta {
    display: flex; align-items: center; gap: 14px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px; color: var(--dim);
    margin-bottom: 14px; flex-wrap: wrap;
  }
  .pred-meta strong { color: var(--txt); font-weight: 600; }

  .pred-tag {
    display: inline-block;
    padding: 4px 10px; border-radius: 6px;
    background: var(--surface-2);
    border: 1px solid var(--line-2);
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px; color: var(--dim);
    margin-bottom: 10px;
  }
  .pred-info {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11.5px; color: var(--mute);
    line-height: 1.7; word-break: break-word;
  }

  .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .stat {
    background: var(--surface-2);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 14px;
  }
  .stat-n {
    font-family: 'JetBrains Mono', monospace;
    font-size: 22px; font-weight: 600; letter-spacing: -0.02em;
  }
  .stat-n.ok { color: var(--tai); }
  .stat-n.bad { color: var(--xiu); }
  .stat-n.acc { color: var(--acc); }
  .stat-k {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; color: var(--mute);
    letter-spacing: 0.12em; text-transform: uppercase;
    margin-top: 2px;
  }
  .streak {
    margin-top: 12px; display: flex; justify-content: space-between;
    padding: 11px 14px;
    background: rgba(239,68,68,0.06);
    border: 1px solid rgba(239,68,68,0.18);
    border-radius: 10px;
    font-family: 'JetBrains Mono', monospace; font-size: 12px;
  }
  .streak .k { color: var(--mute); letter-spacing: 0.06em; }
  .streak .v { color: var(--xiu); font-weight: 600; }
  .foot {
    margin-top: 12px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px; color: var(--mute);
    line-height: 1.7;
  }

  .tbl-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--mute); font-weight: 500;
    text-align: left; padding: 11px 14px;
    background: var(--surface-2);
    border-bottom: 1px solid var(--line);
    white-space: nowrap;
  }
  tbody td {
    padding: 11px 14px; border-bottom: 1px solid var(--line);
    font-family: 'JetBrains Mono', monospace; font-size: 12px;
  }
  tbody tr:last-child td { border-bottom: none; }
  .tag {
    display: inline-block; padding: 3px 8px; border-radius: 5px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px; font-weight: 500;
  }
  .tag.tai { color: var(--tai); background: rgba(34,197,94,0.10); }
  .tag.xiu { color: var(--xiu); background: rgba(239,68,68,0.10); }
  .tag.miss { color: var(--mute); background: var(--surface-2); }
  .r-ok { color: var(--tai); font-weight: 600; }
  .r-bad { color: var(--xiu); font-weight: 600; }
  .r-miss { color: var(--mute); }
  .empty {
    text-align: center; padding: 28px 16px; color: var(--mute);
    font-family: 'JetBrains Mono', monospace; font-size: 12px;
  }

  footer {
    margin-top: 32px; padding-top: 20px;
    border-top: 1px solid var(--line);
    display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px; color: var(--mute);
  }
  footer strong { color: var(--dim); font-weight: 600; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="brand">
      <div class="brand-logo">PAK</div>
      <div>
        <h1>Công Nghệ Vip PAK</h1>
        <small>Dice Signal Analyzer</small>
      </div>
    </div>
    <div id="status" class="status"><span class="dot"></span><span id="statusText">Đang kết nối</span></div>
  </header>

  <div class="grid">
    <div class="card">
      <div class="card-title">Dự đoán phiên kế tiếp</div>
      <div id="pSide" class="pred-side none">--</div>
      <div class="pred-meta">
        <span>Độ tin cậy: <strong id="pConf">--%</strong></span>
        <span>Phiên: <strong id="pPhien">#--</strong></span>
      </div>
      <div id="pTag" class="pred-tag">--</div>
      <div id="pInfo" class="pred-info">Đang chờ dữ liệu...</div>
    </div>

    <div class="card">
      <div class="card-title">Thống kê</div>
      <div class="stats">
        <div class="stat"><div id="sTotal" class="stat-n">0</div><div class="stat-k">Tổng</div></div>
        <div class="stat"><div id="sCorrect" class="stat-n ok">0</div><div class="stat-k">Đúng</div></div>
        <div class="stat"><div id="sWrong" class="stat-n bad">0</div><div class="stat-k">Sai</div></div>
        <div class="stat"><div id="sAcc" class="stat-n acc">0%</div><div class="stat-k">Tỷ lệ đúng</div></div>
      </div>
      <div class="streak">
        <span class="k">CHUỖI SAI</span>
        <span id="sStreak" class="v">0</span>
      </div>
      <div class="foot" id="footNote">--</div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">Lịch sử dự đoán</div>
    <div class="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>Phiên</th><th>Dự đoán</th><th>Thực tế</th><th>Tin cậy</th><th>Signal</th><th>Kết quả</th>
          </tr>
        </thead>
        <tbody id="tbody">
          <tr><td colspan="6" class="empty">Chưa có dữ liệu.</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <footer>
    <div>Developer: <strong>Anh Khôi</strong></div>
    <div id="footTime">--</div>
  </footer>
</div>

<script>
  const $ = (id) => document.getElementById(id);
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
    if (!rows || rows.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 6; td.className = 'empty';
      td.textContent = 'Chưa có phiên nào được chốt.';
      tr.appendChild(td); tb.appendChild(tr);
      return;
    }
    for (const r of rows) {
      const tr = document.createElement('tr');

      const tdPhien = document.createElement('td');
      tdPhien.textContent = '#' + r.phien;
      tr.appendChild(tdPhien);

      const tdPred = document.createElement('td');
      const sp = document.createElement('span');
      sp.className = 'tag ' + (r.predict === 'TAI' ? 'tai' : 'xiu');
      sp.textContent = r.predict === 'TAI' ? 'TÀI' : 'XỈU';
      tdPred.appendChild(sp);
      tr.appendChild(tdPred);

      const tdAct = document.createElement('td');
      if (r.actual) {
        const sa = document.createElement('span');
        sa.className = 'tag ' + (r.actual === 'TAI' ? 'tai' : 'xiu');
        sa.textContent = r.actual === 'TAI' ? 'TÀI' : 'XỈU';
        tdAct.appendChild(sa);
      } else {
        const sa = document.createElement('span');
        sa.className = 'tag miss';
        sa.textContent = 'MISS';
        tdAct.appendChild(sa);
      }
      tr.appendChild(tdAct);

      const tdConf = document.createElement('td');
      tdConf.textContent = (r.confidence != null ? r.confidence : '--') + '%';
      tr.appendChild(tdConf);

      const tdTag = document.createElement('td');
      tdTag.textContent = r.tag || '';
      tdTag.style.color = 'var(--dim)';
      tr.appendChild(tdTag);

      const tdRes = document.createElement('td');
      if (r.miss) { tdRes.className = 'r-miss'; tdRes.textContent = 'MISS'; }
      else if (r.correct) { tdRes.className = 'r-ok'; tdRes.textContent = 'ĐÚNG'; }
      else { tdRes.className = 'r-bad'; tdRes.textContent = 'SAI'; }
      tr.appendChild(tdRes);

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
        set('pInfo', 'Cần ít nhất 10 phiên dữ liệu để phân tích.');
      }

      set('sTotal', d.stats.total);
      set('sCorrect', d.stats.correct);
      set('sWrong', d.stats.wrong);
      const acc = d.stats.total > 0 ? ((d.stats.correct / d.stats.total) * 100).toFixed(1) : '0.0';
      set('sAcc', acc + '%');
      set('sStreak', d.error_streak);

      set('footNote',
        'Fallback: ' + d.stats.fallback_correct + '/' + d.stats.fallback_total +
        ' · Dữ liệu: ' + d.dataCount + ' phiên'
      );
      set('footTime', 'Cập nhật: ' + d.lastUpdate);

      renderLog(d.log);

      const st = $('status');
      st.classList.remove('off');
      set('statusText', 'Đang hoạt động');
    } catch (e) {
      const st = $('status');
      st.classList.add('off');
      set('statusText', 'Mất kết nối');
      console.error('[UI]', e);
    }
  }

  pull();
  setInterval(pull, 8000);
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
    res.json({ data: lastData.slice(0, 60) });
});

app.listen(PORT, () => {
    console.log('[PAK] Công Nghệ Vip PAK — Dice Signal Analyzer');
    console.log('[PAK] Server: http://localhost:' + PORT);
    console.log('[PAK] Developer: Anh Khôi');
});

fetchAndAnalyze();
setInterval(fetchAndAnalyze, FETCH_INTERVAL_MS);
