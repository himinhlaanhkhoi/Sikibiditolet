import fastify from 'fastify';
import cors from '@fastify/cors';
import fetch from 'node-fetch';
import { SeiuEngineV16 } from './seiu-engine-v16.js';

const PORT = process.env.PORT || 3000;
const API_URL = 'https://api.wsktnus8.net/v2/history/getLastResult?gameId=ktrng_3979&size=100&tableId=39791215743193&curPage=1';

let history = [];
let currentSessionId = null;
let prediction = null;
let lastFetchTime = 0;

const engine = new SeiuEngineV16();

async function fetchAndUpdate() {
  try {
    const now = Date.now();
    if (now - lastFetchTime < 1000) return;
    lastFetchTime = now;

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(API_URL, { signal: ctrl.signal });
    clearTimeout(timeout);

    if (!res.ok) return;
    const data = await res.json();
    if (!data?.data?.resultList?.length) return;

    const parsed = engine.parseLines(data);
    if (!parsed.length) return;

    const last = parsed.at(-1);
    if (!currentSessionId) {
      history = parsed;
      engine.fitInitial(history);
      currentSessionId = last.session;
      prediction = engine.predict(history);
      console.log(`✅ Loaded ${history.length} sessions | Xỉu: 3-10, Tài: 11-18`);
    } else if (last.session > currentSessionId) {
      const newRecords = parsed.filter(r => r.session > currentSessionId);
      for (const r of newRecords) {
        history.push(r);
        engine.updateOutcome(history.slice(0, -1), r.tx);
        engine.updateDiceStats(r);
      }
      if (history.length > 500) history = history.slice(-500);
      currentSessionId = last.session;
    }
  } catch (e) {
    console.error(`❌ Fetch: ${e.message}`);
  }
}

function updatePrediction() {
  if (history.length > 0) {
    prediction = engine.predict(history);
  }
}

const app = fastify({ logger: false });
await app.register(cors, { origin: '*' });

app.get('/api/sicbo/sunwin', async () => {
  const last = history.at(-1);
  if (!last || !prediction) {
    return {
      id: '@toilabeak',
      phien: null,
      xuc_xac1: null,
      xuc_xac2: null,
      xuc_xac3: null,
      tong: null,
      ket_qua: 'chờ dữ liệu',
      phien_hien_tai: null,
      du_doan: 'chưa có',
      du_doan_vi: 'chưa có',
      do_tin_cay: '0%',
      trang_thai: 'initializing'
    };
  }

  const scorePred = prediction.scorePrediction.join('-');
  return {
    id: '@toilabeak',
    phien: last.session,
    xuc_xac1: last.dice[0],
    xuc_xac2: last.dice[1],
    xuc_xac3: last.dice[2],
    tong: last.total,
    ket_qua: last.result.toLowerCase(),
    phien_hien_tai: last.session + 1,
    du_doan: prediction.prediction,
    du_doan_vi: scorePred,
    do_tin_cay: `${(prediction.confidence * 100).toFixed(0)}%`,
    regime: prediction.meta.regime,
    voted_by: prediction.meta.votedBy.length,
    dice_trend: prediction.meta.diceTrend,
    bridge_status: prediction.meta.bridgeStatus
  };
});

app.get('/api/sicsun/history', async () => {
  if (!history.length) return { message: 'không có dữ liệu' };
  return [...history].reverse().map(h => ({
    session: h.session,
    dice: h.dice,
    total: h.total,
    result: h.result.toLowerCase(),
    tx: h.tx.toLowerCase()
  }));
});

app.get('/api/seiu/weights', async () => ({
  weights: engine.weights,
  algo_count: engine.algs.length,
  history_len: history.length,
  dice_stats: engine.getDiceStats()
}));

app.get('/', async () => ({ status: 'ok', system: 'seiu v16', id: '@toilabeak' }));

await fetchAndUpdate();
setInterval(fetchAndUpdate, 1000);
setInterval(updatePrediction, 100);

const start = async () => {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }

  let ip = '0.0.0.0';
  try {
    const r = await fetch('https://ifconfig.me/ip', { signal: AbortSignal.timeout(5000) });
    ip = (await r.text()).trim();
  } catch {}

  console.log(`\n🚀 SEIU AI v16 [@toilabeak]`);
  console.log(`   Local: http://localhost:${PORT}/`);
  console.log(`   Web: http://${ip}:${PORT}/\n`);
};

start();
