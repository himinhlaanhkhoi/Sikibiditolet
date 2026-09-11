import fastify from 'fastify';
import cors from '@fastify/cors';
import fetch from 'node-fetch';
import { SeiuEngineV17 } from './seiu-engine.js';

const PORT = process.env.PORT || 3000;
const API_URL = 'https://api.wsktnus8.net/v2/history/getLastResult?gameId=ktrng_3979&size=100&tableId=39791215743193&curPage=1';

let history = [];
let currentSessionId = null;
let prediction = null;
let lastFetchTime = 0;

const engine = new SeiuEngineV17();

async function fetchAndUpdate() {
  try {
    const now = Date.now();
    if (now - lastFetchTime < 900) return;
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
  if (history.length > 0) prediction = engine.predict(history);
}

const app = fastify({ logger: false });
await app.register(cors, { origin: '*' });

function buildResponse() {
  const last = history.at(-1);
  if (!last || !prediction) {
    return {
      id: '@toilabeak', phien: null, xuc_xac1: null, xuc_xac2: null, xuc_xac3: null,
      tong: null, ket_qua: 'chờ dữ liệu', phien_hien_tai: null,
      du_doan: 'chưa có', du_doan_vi: 'chưa có', do_tin_cay: '0%',
      regime: 'unknown', dice_trend: 'unknown', bridge_status: 'unknown', voted_by: 0
    };
  }
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
    du_doan_vi: prediction.scorePrediction.join('-'),
    do_tin_cay: `${(prediction.confidence * 100).toFixed(0)}%`,
    regime: prediction.meta.regime,
    dice_trend: prediction.meta.diceTrend,
    bridge_status: prediction.meta.bridgeStatus,
    voted_by: prediction.meta.votedBy.length
  };
}

app.get('/api/sicbo/sunwin', async () => buildResponse());

app.get('/api/sicsun/history', async () => {
  if (!history.length) return { message: 'không có dữ liệu' };
  return [...history].reverse().slice(0, 100).map(h => ({
    session: h.session, dice: h.dice, total: h.total,
    result: h.result.toLowerCase(), tx: h.tx.toLowerCase()
  }));
});

app.get('/api/seiu/weights', async () => ({
  weights: engine.weights,
  algo_count: engine.algs.length,
  history_len: history.length,
  dice_stats: engine.getDiceStats()
}));

// ================== DASHBOARD (giao diện thật, đọc dữ liệu API) ==================
app.get('/', async (req, reply) => {
  reply.type('text/html').send(DASHBOARD_HTML);
});

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover">
<title>@toilabeak • SEIU AI PREDICTION</title>
<style>
:root{--bg:#05070d;--accent:#3b8cff;--accent2:#00c8ff;--good:#43e0a2;--danger:#ff607d;--line:rgba(125,155,205,.16);--text:#eef4ff;--muted:#8995aa}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;font-family:Inter,system-ui,sans-serif;color:var(--text);
background:radial-gradient(circle at 15% 0%,rgba(59,140,255,.14),transparent 35%),radial-gradient(circle at 90% 15%,rgba(0,200,255,.09),transparent 30%),linear-gradient(145deg,#03050a,#07101d,#04060c);}
.wrap{max-width:920px;margin:auto;padding:24px 16px 60px}
.top{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border:1px solid var(--line);border-radius:20px;background:rgba(8,12,21,.7);backdrop-filter:blur(16px);margin-bottom:18px}
.brand{font-weight:900;letter-spacing:.1em;font-size:15px}
.brand span{color:var(--accent2)}
.live{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:800;letter-spacing:.1em;color:#bdf7df}
.dot{width:7px;height:7px;border-radius:50%;background:var(--good);box-shadow:0 0 10px var(--good);animation:pulse 2s infinite}
@keyframes pulse{50%{opacity:.4}}
.grid{display:grid;grid-template-columns:1.1fr .9fr;gap:14px}
@media(max-width:760px){.grid{grid-template-columns:1fr}}
.card{border:1px solid var(--line);border-radius:22px;background:linear-gradient(145deg,rgba(17,24,40,.78),rgba(8,12,21,.85));padding:20px;position:relative;overflow:hidden}
.card:after{content:"";position:absolute;left:8%;right:8%;top:-1px;height:1px;background:linear-gradient(90deg,transparent,var(--accent),var(--accent2),transparent);opacity:.6}
.kicker{font-size:9px;letter-spacing:.16em;color:#76839a;font-weight:800;text-transform:uppercase}
.title{font-size:15px;font-weight:800;margin-top:5px}
.metrics{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:16px}
.metric{padding:12px;border:1px solid rgba(255,255,255,.07);border-radius:14px;background:rgba(255,255,255,.02)}
.metric label{display:block;font-size:8px;color:#748197;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px}
.metric b{font-size:17px}
.dice-row{display:flex;gap:8px;margin-top:14px}
.die{width:36px;height:36px;display:grid;place-items:center;border-radius:10px;background:linear-gradient(145deg,#eff5ff,#aebbd0);color:#101827;font-weight:900;font-size:14px}
.predict-ring{width:150px;height:150px;border-radius:50%;margin:10px auto;display:grid;place-items:center;border:1px solid rgba(59,140,255,.3);box-shadow:0 0 45px rgba(59,140,255,.15),inset 0 0 35px rgba(59,140,255,.06)}
.predict-core{width:112px;height:112px;border-radius:50%;background:rgba(7,12,21,.9);border:1px solid rgba(255,255,255,.08);display:grid;place-items:center;text-align:center}
.predict-core small{display:block;font-size:8px;color:#748198;letter-spacing:.16em;font-weight:800}
.predict-core strong{font-size:24px;background:linear-gradient(120deg,#fff,var(--accent2));-webkit-background-clip:text;color:transparent}
.confbar{height:7px;border-radius:99px;background:rgba(255,255,255,.06);overflow:hidden;margin-top:10px}
.confbar i{display:block;height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2));transition:width .4s}
.tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;justify-content:center}
.tag{font-size:8px;font-weight:800;letter-spacing:.08em;padding:6px 9px;border-radius:99px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);color:#b7c3d6}
table{width:100%;border-collapse:collapse;margin-top:10px}
th{text-align:left;color:#68758a;font-size:8px;letter-spacing:.1em;text-transform:uppercase;padding:0 8px 8px}
td{padding:9px 8px;border-top:1px solid rgba(255,255,255,.05);font-size:11px;color:#b9c5d8}
.tai{color:#8bd7ff}.xiu{color:#d6b5ff}
.footer{text-align:center;color:#5e6a7e;font-size:8px;letter-spacing:.14em;font-weight:800;margin-top:28px}
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <div class="brand">SEIU <span>AI</span> · @toilabeak</div>
    <div class="live"><i class="dot"></i>LIVE</div>
  </div>
  <div class="grid">
    <div class="card">
      <div class="kicker">Live data</div>
      <div class="title" id="sessionTitle">Phiên #--</div>
      <div class="metrics">
        <div class="metric"><label>Tổng điểm</label><b id="total">--</b></div>
        <div class="metric"><label>Kết quả</label><b id="result">--</b></div>
        <div class="metric"><label>Phiên tiếp</label><b id="nextSession">--</b></div>
        <div class="metric"><label>Trạng thái</label><b id="status" style="color:var(--good)">LOADING</b></div>
      </div>
      <div class="kicker" style="margin-top:16px">Dice vector</div>
      <div class="dice-row" id="dice"></div>
      <div class="kicker" style="margin-top:18px">Lịch sử gần nhất</div>
      <table>
        <thead><tr><th>Phiên</th><th>Xúc xắc</th><th>Tổng</th><th>KQ</th></tr></thead>
        <tbody id="historyBody"></tbody>
      </table>
    </div>
    <div class="card" style="text-align:center">
      <div class="kicker">Next signal</div>
      <div class="title">Nhận định phiên tiếp</div>
      <div class="predict-ring"><div class="predict-core"><div><small>ĐOÁN</small><strong id="prediction">--</strong></div></div></div>
      <div style="display:flex;justify-content:space-between;font-size:9px;color:#8491a7;font-weight:800;padding:0 8px"><span>ĐỘ TIN CẬY</span><b id="confidence">0%</b></div>
      <div class="confbar"><i id="confidenceBar" style="width:0%"></i></div>
      <div class="kicker" style="margin-top:16px">Dự đoán vị (tổng điểm)</div>
      <div class="title" id="scorePred" style="font-size:20px">--</div>
      <div class="tags">
        <span class="tag" id="regimeTag">REGIME: --</span>
        <span class="tag" id="diceTag">DICE: --</span>
        <span class="tag" id="bridgeTag">BRIDGE: --</span>
        <span class="tag" id="votedTag">VOTES: --</span>
      </div>
    </div>
  </div>
  <div class="footer">SEIU AI ENGINE v17 · REAL-TIME DATA · NO RANDOM</div>
</div>
<script>
async function refresh(){
  try{
    const [pRes,hRes]=await Promise.all([fetch('/api/sicbo/sunwin'),fetch('/api/sicsun/history')]);
    const p=await pRes.json();
    const h=await hRes.json();
    document.getElementById('sessionTitle').textContent='Phiên #'+(p.phien??'--');
    document.getElementById('total').textContent=p.tong??'--';
    document.getElementById('result').textContent=(p.ket_qua||'--').toUpperCase();
    document.getElementById('nextSession').textContent='#'+(p.phien_hien_tai??'--');
    document.getElementById('status').textContent=p.phien?'READY':'LOADING';
    document.getElementById('prediction').textContent=(p.du_doan||'--').toUpperCase();
    document.getElementById('confidence').textContent=p.do_tin_cay||'0%';
    document.getElementById('confidenceBar').style.width=p.do_tin_cay||'0%';
    document.getElementById('scorePred').textContent=p.du_doan_vi||'--';
    document.getElementById('regimeTag').textContent='REGIME: '+(p.regime||'--').toUpperCase();
    document.getElementById('diceTag').textContent='DICE: '+(p.dice_trend||'--').toUpperCase();
    document.getElementById('bridgeTag').textContent='BRIDGE: '+(p.bridge_status||'--').toUpperCase();
    document.getElementById('votedTag').textContent='VOTES: '+(p.voted_by??0);
    if(p.xuc_xac1!=null){
      document.getElementById('dice').innerHTML=[p.xuc_xac1,p.xuc_xac2,p.xuc_xac3].map(d=>'<div class="die">'+d+'</div>').join('');
    }
    if(Array.isArray(h)){
      document.getElementById('historyBody').innerHTML=h.slice(0,12).map(x=>
        '<tr><td><b>#'+x.session+'</b></td><td>'+x.dice.join(' · ')+'</td><td>'+x.total+'</td><td class="'+(x.tx==='tai'?'tai':'xiu')+'">'+x.result.toUpperCase()+'</td></tr>'
      ).join('');
    }
  }catch(e){ console.error(e); }
}
refresh();
setInterval(refresh,1000);
</script>
</body>
</html>`;

// ================== POLLING ENGINE ==================
await fetchAndUpdate();
setInterval(fetchAndUpdate, 1000);
setInterval(updatePrediction, 100);

const start = async () => {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 SEIU AI [@toilabeak] running on port ${PORT}`);
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
};

start();
