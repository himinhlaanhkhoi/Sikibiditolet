import fastify from 'fastify';
import cors from '@fastify/cors';
import fetch from 'node-fetch';
import { SeiuEngine } from './seiu-engine.js';

const PORT = process.env.PORT || 3000;
const API_URL = 'https://api.wsktnus8.net/v2/history/getLastResult?gameId=ktrng_3979&size=100&tableId=39791215743193&curPage=1';

let history = [];
let currentSessionId = null;
let prediction = null;
let lastFetchTime = 0;

const engine = new SeiuEngine();

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
      console.log(`✅ Loaded ${history.length} sessions`);
    } else if (last.session > currentSessionId) {
      const newRecords = parsed.filter(r => r.session > currentSessionId);
      for (const r of newRecords) {
        history.push(r);
        engine.updateOutcome(history.slice(0, -1), r.tx);
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
      id: '@seiu_ai',
      phien: null,
      xuc_xac1: null,
      xuc_xac2: null,
      xuc_xac3: null,
      tong: null,
      ket_qua: 'chờ dữ liệu',
      phien_hien_tai: null,
      du_doan: 'chưa có',
      du_doan_vi: 'chưa có',
      do_tin_cay: '0%'
    };
  }

  const scorePred = prediction.scorePrediction.join('-');
  return {
    id: '@seiu_ai_v15',
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
    voted_by: prediction.meta.votedBy.length
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
  history_len: history.length
}));

app.get('/', async () => ({ status: 'ok', system: 'seiu v15' }));

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
    const r = await fetch('https://ifconfig.me/ip', { 
      signal: AbortSignal.timeout(5000) 
    });
    ip = (await r.text()).trim();
  } catch {}

  console.log(`\n🚀 SEIU AI v15 Online`);
  console.log(`   Local: http://localhost:${PORT}/`);
  console.log(`   Web: http://${ip}:${PORT}/\n`);
};

start();
