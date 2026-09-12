/**
 * ANH KHÔI CORE — Production Server v21 — SEIU full + lag+1 (zero external runtime deps beyond Node 18+)
 * - Exact dashboard UI served from public/index.html
 * - Live API matching dashboard contract
 * - Prediction memory + win/loss settle (persisted)
 * - Process never exits with status 1
 */

import { createServer } from "http";
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, extname } from "path";
import { AnhKhoiEngine } from "./anh-khoi-engine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const API_URL =
  process.env.API_URL ||
  "https://api.wsktnus8.net/v2/history/getLastResult?gameId=ktrng_3979&size=100&tableId=39791215743193&curPage=1";

const DATA_DIR = join(__dirname, "data");
const PRED_FILE = join(DATA_DIR, "predictions.json");
const PUBLIC = join(__dirname, "public");

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

// ---------- Never die ----------
process.on("uncaughtException", (err) => {
  console.error("[SAFE] uncaughtException:", err?.stack || err?.message || err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[SAFE] unhandledRejection:", reason?.stack || reason?.message || reason);
});

// ---------- State ----------
let history = [];
let currentSessionId = null;
let prediction = null;
let lastFetchTime = 0;
let sourceOk = false;
let lastError = null;
const engine = new AnhKhoiEngine();

/** @type {Map<number, object>} */
const predStore = new Map();

function loadPredictions() {
  try {
    if (!existsSync(PRED_FILE)) return;
    const arr = JSON.parse(readFileSync(PRED_FILE, "utf8"));
    if (!Array.isArray(arr)) return;
    for (const p of arr) {
      if (p && Number.isFinite(Number(p.target))) {
        predStore.set(Number(p.target), {
          target: Number(p.target),
          prediction: String(p.prediction || ""),
          confidence: Number(p.confidence) || 0,
          checked: Boolean(p.checked),
          correct: p.correct == null ? null : Boolean(p.correct),
          createdAt: p.createdAt || Date.now(),
          checkedAt: p.checkedAt || null,
        });
      }
    }
    console.log(`[ANH KHÔI] Loaded ${predStore.size} predictions from disk`);
  } catch (e) {
    console.error("[ANH KHÔI] loadPredictions fail:", e.message);
  }
}

function savePredictions() {
  try {
    const arr = [...predStore.values()].sort((a, b) => b.target - a.target).slice(0, 500);
    writeFileSync(PRED_FILE, JSON.stringify(arr), "utf8");
  } catch (e) {
    console.error("[ANH KHÔI] savePredictions fail:", e.message);
  }
}

loadPredictions();

// ---------- Fetch + engine update ----------
async function fetchAndUpdate() {
  const now = Date.now();
  if (now - lastFetchTime < 1000) return;
  lastFetchTime = now;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);

  try {
    const res = await fetch(API_URL, {
      signal: ctrl.signal,
      headers: { "User-Agent": "AnhKhoiCore/19", Accept: "application/json" },
    });
    clearTimeout(timer);

    if (!res.ok) {
      sourceOk = false;
      lastError = `HTTP ${res.status}`;
      return;
    }

    const data = await res.json();
    const parsed = engine.parseLines(data);
    if (!parsed.length) {
      sourceOk = false;
      lastError = "empty resultList";
      return;
    }

    sourceOk = true;
    lastError = null;
    const last = parsed.at(-1);

    if (!currentSessionId) {
      history = parsed;
      for (const r of history) engine.updateStats(r);
      engine.fitInitial(history);
      currentSessionId = last.session;
      prediction = engine.predict(history);
      ensurePredictionStored(last.session + 1, prediction);
      console.log(`[ANH KHÔI] Boot ${history.length} sessions • target #${last.session + 1}`);
    } else if (last.session > currentSessionId) {
      const news = parsed.filter((r) => r.session > currentSessionId);
      for (const r of news) {
        settlePrediction(r.session, r.tx, r.result);
        history.push(r);
        engine.updateStats(r);
        const prefix = history.slice(0, -1);
        engine.updateOutcome(prefix, r.tx);
        if (typeof engine.updateOnline === "function") {
          try { engine.updateOnline(prefix, r.tx, r.dice); } catch (e) { console.error("[updateOnline]", e.message); }
        }
      }
      if (history.length > 600) history = history.slice(-600);
      currentSessionId = last.session;
      prediction = engine.predict(history);
      ensurePredictionStored(last.session + 1, prediction);
      console.log(`[ANH KHÔI] #${last.session} settled • next pred ${prediction?.prediction}`);
    } else {
      prediction = engine.predict(history);
      ensurePredictionStored(last.session + 1, prediction);
    }
  } catch (e) {
    clearTimeout(timer);
    sourceOk = false;
    lastError = e?.name === "AbortError" ? "timeout" : String(e?.message || e);
    console.error(`[ANH KHÔI] Fetch error: ${lastError}`);
  }
}

function ensurePredictionStored(targetSession, predObj) {
  if (!predObj || !Number.isFinite(targetSession)) return;
  if (predStore.has(targetSession)) return; // no overwrite, no duplicate
  predStore.set(targetSession, {
    target: targetSession,
    prediction: predObj.prediction,
    confidence: Math.round((predObj.confidence || 0) * 1000) / 1000,
    checked: false,
    correct: null,
    createdAt: Date.now(),
    checkedAt: null,
  });
  savePredictions();
}

function settlePrediction(session, tx, resultLabel) {
  const p = predStore.get(session);
  if (!p || p.checked) return;
  const actual = tx === "T" ? "TÀI" : tx === "X" ? "XỈU" : String(resultLabel || "");
  const correct = p.prediction === actual;
  p.checked = true;
  p.correct = correct;
  p.checkedAt = Date.now();
  predStore.set(session, p);
  savePredictions();
  console.log(`[ANH KHÔI] #${session} ${p.prediction} vs ${actual} → ${correct ? "WIN" : "LOSS"}`);
}

function updatePredictionOnly() {
  try {
    if (history.length) {
      prediction = engine.predict(history);
      const last = history.at(-1);
      if (last) ensurePredictionStored(last.session + 1, prediction);
    }
  } catch (e) {
    console.error("[ANH KHÔI] re-predict:", e.message);
  }
}

// ---------- HTTP helpers ----------
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

function sendFile(res, filePath) {
  try {
    const data = readFileSync(filePath);
    const ext = extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
}

// ---------- API handlers ----------
function handleSicboSunwin(res) {
  try {
    const last = history.at(-1);
    if (!last) {
      return sendJson(res, 200, {
        id: "ANH KHÔI",
        phien_hien_tai: null,
        phien_truoc: null,
        phien_muc_tieu: null,
        du_doan: "CHƯA DỮ LIỆU",
        do_tin_cay: 0,
        du_doan_vi: [],
        sourceStatus: { ok: false },
        meta: { abstained: true, reason: "no history yet" },
      });
    }
    const pred = prediction || engine.predict(history);
    const targetSession = last.session + 1;
    const prev = history.at(-2);
    const stored = predStore.get(targetSession);

    sendJson(res, 200, {
      id: "ANH KHÔI",
      phien_hien_tai: {
        session: last.session,
        dice: last.dice,
        total: last.total,
        result: last.result,
        tx: last.tx,
      },
      phien_truoc: prev
        ? {
            session: prev.session,
            dice: prev.dice,
            total: prev.total,
            result: prev.result,
            tx: prev.tx,
          }
        : null,
      phien_muc_tieu: { session: targetSession },
      du_doan: pred.prediction || "CHƯA ĐỦ TÍN HIỆU",
      do_tin_cay: Math.round((pred.confidence || 0) * 100),
      du_doan_vi: Array.isArray(pred.scorePrediction) ? pred.scorePrediction : [],
      regime: pred.meta?.regime || "neutral",
      voted_by: pred.meta?.votedBy || 0,
      sourceStatus: { ok: sourceOk },
      meta: {
        abstained: Boolean(pred.meta?.abstained),
        reason: pred.meta?.reason || "",
        regime: pred.meta?.regime,
        votedBy: pred.meta?.votedBy,
        lag: 1,
        targetSession: targetSession,
        storedPrediction: stored?.prediction || null,
      },
    });
  } catch (e) {
    console.error("[API sicbo]", e.message);
    sendJson(res, 200, {
      id: "ANH KHÔI",
      phien_hien_tai: null,
      du_doan: "LỖI NỘI BỘ",
      do_tin_cay: 0,
      sourceStatus: { ok: false },
      meta: { abstained: true, reason: e.message },
    });
  }
}

function handleHistory(res) {
  try {
    if (!history.length) return sendJson(res, 200, { data: [] });
    const rows = [...history]
      .reverse()
      .slice(0, 80)
      .map((h, idx) => ({
        idx: idx + 1,
        session: h.session,
        dice: h.dice,
        total: h.total,
        result: h.result,
        tx: h.tx,
      }));
    sendJson(res, 200, { data: rows });
  } catch (e) {
    console.error("[API history]", e.message);
    sendJson(res, 200, { data: [] });
  }
}

function handlePredictionsHistory(res) {
  try {
    const arr = [...predStore.values()]
      .sort((a, b) => b.target - a.target)
      .slice(0, 120)
      .map((p) => ({
        target: p.target,
        prediction: p.prediction,
        confidence: p.confidence,
        checked: p.checked,
        correct: p.correct,
        createdAt: p.createdAt,
        checkedAt: p.checkedAt,
      }));
    sendJson(res, 200, { data: arr });
  } catch (e) {
    console.error("[API predictions]", e.message);
    sendJson(res, 200, { data: [] });
  }
}

function handleHealth(res) {
  sendJson(res, 200, {
    ok: true,
    brand: "ANH KHÔI CORE",
    version: "21.0.0",
    sessions: history.length,
    sourceOk,
    lastError,
    predsStored: predStore.size,
    currentSession: currentSessionId,
  });
}

// ---------- Server ----------
const server = createServer((req, res) => {
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      return res.end();
    }

    const url = (req.url || "/").split("?")[0];

    if (url === "/api/sicbo/sunwin") return handleSicboSunwin(res);
    if (url === "/api/sicsun/history") return handleHistory(res);
    if (url === "/api/predictions/history") return handlePredictionsHistory(res);
    if (url === "/api/health") return handleHealth(res);

    let filePath = join(PUBLIC, url === "/" ? "index.html" : url);
    if (!filePath.startsWith(PUBLIC)) {
      res.writeHead(403);
      return res.end("Forbidden");
    }
    if (existsSync(filePath) && statSync(filePath).isFile()) {
      return sendFile(res, filePath);
    }
    const index = join(PUBLIC, "index.html");
    if (existsSync(index)) return sendFile(res, index);
    res.writeHead(404);
    res.end("Not found");
  } catch (e) {
    console.error("[HTTP]", e.message);
    try {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("ANH KHÔI CORE protected error");
    } catch {
      /* ignore */
    }
  }
});

server.on("error", (err) => {
  console.error("[SERVER ERROR]", err.message);
});

// ---------- Boot ----------
async function boot() {
  try {
    await fetchAndUpdate();
  } catch (e) {
    console.error("[BOOT fetch]", e.message);
  }

  setInterval(() => {
    fetchAndUpdate().catch((e) => console.error("[tick fetch]", e.message));
  }, 1200);

  setInterval(updatePredictionOnly, 400);

  setInterval(savePredictions, 25000);

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 ANH KHÔI CORE v21 → http://0.0.0.0:${PORT}`);
  });
}

boot().catch((e) => {
  console.error("[BOOT FATAL-SAFE]", e.message);
  try {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 ANH KHÔI CORE (degraded) → :${PORT}`);
    });
  } catch {
    /* keep process alive */
  }
});
