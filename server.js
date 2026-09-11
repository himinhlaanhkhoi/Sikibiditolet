import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AnhKhoiEngineV21 } from './seiu-engine-v18.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const API_URL = process.env.SICBO_API_URL || 'https://api.wsktnus8.net/v2/history/getLastResult?gameId=ktrng_3979&size=100&tableId=39791215743193&curPage=1';
const FETCH_TIMEOUT_MS = 6500;
const engine = new AnhKhoiEngineV21();

let dashboardHTML = '';
let history = [];
let currentSessionId = null;
let prediction = null;
let fetchInFlight = false;
let lastFetchStarted = 0;
let dataStatus = { ok: false, lastSuccess: 0, error: null, source: 'UPSTREAM' };

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function loadDashboard() {
  dashboardHTML = await fs.readFile(path.join(__dirname, 'dashboard.html'), 'utf8');
  if (!dashboardHTML.includes('ANH KHÔI')) throw new Error('dashboard.html không hợp lệ');
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json', 'user-agent': 'ANH-KHOI-CORE/21' },
    });
    if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function rebuildFromParsed(parsed) {
  const normalized = parsed.slice(-500);
  history = normalized;
  engine.reset();
  for (const row of history) engine.updateStats(row);
  engine.fitInitial(history);
  currentSessionId = history.at(-1)?.session ?? null;
  prediction = history.length ? engine.predict(history) : null;
}

async function fetchAndUpdate() {
  if (fetchInFlight) return;
  const now = Date.now();
  if (now - lastFetchStarted < 850) return;
  fetchInFlight = true;
  lastFetchStarted = now;
  try {
    const raw = await fetchJson(API_URL, FETCH_TIMEOUT_MS);
    const parsed = engine.parseLines(raw);
    if (!parsed.length) throw new Error('Nguồn dữ liệu không có phiên hợp lệ');

    const newest = parsed.at(-1);
    if (currentSessionId === null) {
      rebuildFromParsed(parsed);
      console.log(`[DATA] loaded ${history.length} sessions; latest=${currentSessionId}`);
    } else if (newest.session > currentSessionId) {
      const incoming = parsed.filter(row => row.session > currentSessionId);
      for (const row of incoming) {
        const prefix = history.slice();
        history.push(row);
        engine.updateStats(row);
        engine.updateOutcome(prefix, row.tx);
      }
      history = history.slice(-500);
      currentSessionId = history.at(-1)?.session ?? currentSessionId;
      prediction = engine.predict(history);
      console.log(`[DATA] +${incoming.length} session(s); latest=${currentSessionId}`);
    }
    if (history.length && !prediction) prediction = engine.predict(history);
    dataStatus = { ok: true, lastSuccess: Date.now(), error: null, source: 'UPSTREAM' };
  } catch (error) {
    dataStatus = { ...dataStatus, ok: false, error: String(error?.message || error), source: 'UPSTREAM' };
    console.error(`[DATA] ${dataStatus.error}`);
  } finally {
    fetchInFlight = false;
  }
}

function apiPayload() {
  const last = history.at(-1);
  const prev = history.at(-2);
  const p = prediction;
  return {
    ok: Boolean(last),
    id: 'ANH KHÔI',
    mode: 'LIVE',
    sourceStatus: dataStatus,
    phien_hien_tai: last ? { session: last.session, dice: last.dice, total: last.total, result: last.result, tx: last.tx } : null,
    phien_truoc: prev ? { session: prev.session, dice: prev.dice, total: prev.total, result: prev.result, tx: prev.tx } : null,
    du_doan: p?.prediction || 'CHƯA ĐỦ TÍN HIỆU',
    do_tin_cay: Math.round((p?.confidence ?? 0.5) * 100),
    du_doan_vi: p?.scorePrediction || [],
    regime: p?.meta?.regime || '--',
    voted_by: p?.meta?.votedBy || 0,
    meta: p?.meta || {},
  };
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
  });
  res.end(payload);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,OPTIONS', 'access-control-allow-headers': 'content-type' });
    return res.end();
  }
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'Method Not Allowed' });
  if (url.pathname === '/health') return sendJson(res, 200, { ok: true, service: 'ANH KHÔI CORE v21', uptime: process.uptime(), data: dataStatus });
  if (url.pathname === '/api/sicbo/sunwin') return sendJson(res, 200, apiPayload());
  if (url.pathname === '/api/sicsun/history') {
    return sendJson(res, 200, { ok: true, data: [...history].reverse().slice(0, 100).map((h, idx) => ({ idx: idx + 1, session: h.session, dice: h.dice, total: h.total, result: h.result, tx: h.tx })) });
  }
  if (url.pathname === '/' || url.pathname === '/dashboard.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(dashboardHTML);
  }
  sendJson(res, 404, { ok: false, error: 'Not Found' });
});

async function start() {
  await loadDashboard();
  let listening = false;
  while (!listening) {
    try {
      await new Promise((resolve, reject) => {
        const onError = error => { server.off('listening', onListening); reject(error); };
        const onListening = () => { server.off('error', onError); resolve(); };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(PORT, '0.0.0.0');
      });
      listening = true;
    } catch (error) {
      console.error(`[SERVER] listen retry: ${error?.message || error}`);
      await sleep(1000);
    }
  }
  console.log(`ANH KHÔI CORE v21 running on port ${PORT}`);
  fetchAndUpdate();
  setInterval(fetchAndUpdate, 1000).unref();
  setInterval(() => { if (history.length) prediction = engine.predict(history); }, 1000).unref();
}

process.on('unhandledRejection', error => console.error('[PROCESS] unhandledRejection:', error));
process.on('uncaughtException', error => console.error('[PROCESS] uncaughtException:', error));

start().catch(error => {
  console.error('[BOOT]', error);
  // Keep the process alive so Render can show the actual boot error instead of an intentional hard exit.
  setTimeout(() => {}, 2147483647).unref?.();
});
