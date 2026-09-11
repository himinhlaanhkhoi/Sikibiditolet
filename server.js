import fastify from 'fastify';
import cors from '@fastify/cors';
import fetch from 'node-fetch';
import { SeiuEngineV18 } from './seiu-engine-v18.js';

const PORT = process.env.PORT || 3000;
const API_URL = 'https://api.wsktnus8.net/v2/history/getLastResult?gameId=ktrng_3979&size=100&tableId=39791215743193&curPage=1';

let history = [];
let currentSessionId = null;
let prediction = null;
let lastFetchTime = 0;

const engine = new SeiuEngineV18();

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
      for (const r of history) engine.updateStats(r);
      engine.fitInitial(history);
      currentSessionId = last.session;
      prediction = engine.predict(history);
      console.log(`✅ Loaded ${history.length} sessions`);
    } else if (last.session > currentSessionId) {
      const newRecords = parsed.filter(r => r.session > currentSessionId);
      for (const r of newRecords) {
        history.push(r);
        engine.updateStats(r);
        engine.updateOutcome(history.slice(0, -1), r.tx);
      }
      if (history.length > 500) history = history.slice(-500);
      currentSessionId = last.session;
    }
  } catch (e) {
    console.error(`Fetch: ${e.message}`);
  }
}

function updatePrediction() {
  if (history.length > 0) prediction = engine.predict(history);
}

const app = fastify({ logger: false });
await app.register(cors, { origin: '*' });

app.get('/api/sicbo/sunwin', async () => {
  const last = history.at(-1);
  const prev = history.at(-2);
  if (!last || !prediction) {
    return {
      id: '@toilabeak',
      phien_hien_tai: null,
      phien_truoc: null,
      du_doan: 'CHƯA DỮ LIỆU',
      do_tin_cay: 0,
      du_doan_vi: []
    };
  }
  return {
    id: '@toilabeak',
    phien_hien_tai: { session: last.session, dice: last.dice, total: last.total, result: last.result },
    phien_truoc: prev ? { session: prev.session, dice: prev.dice, total: prev.total, result: prev.result } : null,
    du_doan: prediction.prediction,
    do_tin_cay: Math.round(prediction.confidence * 100),
    du_doan_vi: prediction.scorePrediction,
    regime: prediction.meta.regime,
    voted_by: prediction.meta.votedBy
  };
});

app.get('/api/sicsun/history', async () => {
  if (!history.length) return { data: [] };
  return {
    data: [...history].reverse().slice(0, 50).map((h, idx) => ({
      idx: idx + 1,
      session: h.session,
      dice: h.dice,
      total: h.total,
      result: h.result,
      tx: h.tx
    }))
  };
});

app.get('/', async (req, reply) => {
  reply.type('text/html').send(getDashboardHTML());
});

function getDashboardHTML() {
  const last = history.at(-1);
  const prev = history.at(-2);
  const current = prediction || {};
  
  const prevHtml = prev ? `
    <div class="phase-box">
      <div class="phase-label">PHIÊN TRƯỚC</div>
      <div class="phase-session">#${prev.session}</div>
      <div class="phase-dice">${prev.dice.join(' • ')}</div>
      <div class="phase-result" style="color:${prev.tx === 'T' ? '#00c8ff' : '#ff9d5c'}">${prev.result}</div>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>@toilabeak • ANH KHÔI</title>
<style>
:root{--bg:#05070d;--acc:#3b8cff;--acc2:#00c8ff;--good:#43e0a2;--text:#eef4ff;--line:rgba(125,155,205,.16)}
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;color:var(--text);
background:radial-gradient(circle at 15%,rgba(59,140,255,.12),transparent 35%),radial-gradient(circle at 90% 15%,rgba(0,200,255,.08),transparent 30%),
linear-gradient(145deg,#03050a,#07101d,#04060c);min-height:100vh;overflow-x:hidden}
.wrap{max-width:1200px;margin:auto;padding:20px}
.top{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border:1px solid var(--line);border-radius:18px;
background:rgba(8,12,21,.7);backdrop-filter:blur(16px);margin-bottom:20px;position:sticky;top:10px;z-index:50}
.brand{font-weight:900;font-size:14px;letter-spacing:.1em}.brand span{color:var(--acc2)}.live{display:flex;align-items:center;gap:6px;
font-size:9px;font-weight:800}.dot{width:6px;height:6px;border-radius:50%;background:var(--good);box-shadow:0 0 10px var(--good);animation:pulse 1.5s infinite}
@keyframes pulse{50%{opacity:.3}}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:900px){.grid{grid-template-columns:1fr}}
.card{border:1px solid var(--line);border-radius:20px;background:linear-gradient(145deg,rgba(17,24,40,.78),rgba(8,12,21,.85));
padding:18px;backdrop-filter:blur(16px);position:relative;overflow:hidden}
.card:after{content:"";position:absolute;left:8%;right:8%;top:-1px;height:1px;background:linear-gradient(90deg,transparent,var(--acc),var(--acc2),transparent);opacity:.6}
.kicker{font-size:8px;letter-spacing:.16em;color:#76839a;font-weight:800;text-transform:uppercase}
.title{font-size:15px;font-weight:800;margin-top:4px}
.phase-box{padding:12px;border:1px solid rgba(59,140,255,.2);border-radius:12px;background:rgba(59,140,255,.05);margin-top:8px}
.phase-label{font-size:7px;color:#7d8aa0;letter-spacing:.12em;font-weight:800}.phase-session{font-size:16px;font-weight:800;margin-top:4px}
.phase-dice{font-size:10px;color:#aebbd0;margin-top:2px}.phase-result{font-size:12px;font-weight:800;margin-top:4px}
.metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
.metric{padding:8px;border:1px solid rgba(255,255,255,.07);border-radius:12px;background:rgba(255,255,255,.02)}
.metric label{font-size:7px;color:#748197;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px;display:block}
.metric b{font-size:16px}.dice{display:flex;gap:6px;margin-top:10px}.die{width:32px;height:32px;display:grid;place-items:center;
border-radius:8px;background:linear-gradient(145deg,#eff5ff,#aebbd0);color:#101827;font-weight:900;font-size:13px}
.ring{width:140px;height:140px;border-radius:50%;margin:8px auto;display:grid;place-items:center;border:1px solid rgba(59,140,255,.3);
box-shadow:0 0 40px rgba(59,140,255,.15),inset 0 0 30px rgba(59,140,255,.06)}
.ring-core{width:105px;height:105px;border-radius:50%;background:rgba(7,12,21,.9);border:1px solid rgba(255,255,255,.08);
display:grid;place-items:center;text-align:center}
.ring-core small{font-size:7px;color:#748198;letter-spacing:.16em;font-weight:800;display:block}
.ring-core strong{font-size:20px;background:linear-gradient(120deg,#fff,var(--acc2));-webkit-background-clip:text;color:transparent}
.conf-bar{height:6px;border-radius:99px;background:rgba(255,255,255,.06);overflow:hidden;margin-top:8px}
.conf-bar i{display:block;height:100%;background:linear-gradient(90deg,var(--acc),var(--acc2));transition:width .4s}
.tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:10px;font-size:7px;font-weight:800}.tag{padding:4px 7px;border-radius:99px;
border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);color:#b7c3d6;letter-spacing:.08em}
.history{margin-top:10px}table{width:100%;border-collapse:collapse;font-size:9px}th{text-align:left;color:#68758a;font-size:7px;
letter-spacing:.1em;text-transform:uppercase;padding:0 6px 6px;border-bottom:1px solid var(--line)}td{padding:6px;border-top:1px solid rgba(255,255,255,.05)}
.tai{color:#00c8ff}.xiu{color:#ff9d5c}.foot{text-align:center;margin-top:20px;font-size:7px;color:#5e6a7e;letter-spacing:.14em;font-weight:800}
</style></head><body>
<div class="wrap">
  <div class="top">
    <div class="brand">ANH <span>KHÔI</span> • @toilabeak</div>
    <div class="live"><i class="dot"></i>LIVE</div>
  </div>
  <div class="grid">
    <div class="card">
      <div class="kicker">Live Data</div>
      <div class="title" id="sessionTitle">${last ? `Phiên #${last.session}` : 'Chưa có dữ liệu'}</div>
      <div class="metrics">
        <div class="metric"><label>Tổng</label><b id="total">${last ? last.total : '--'}</b></div>
        <div class="metric"><label>KQ</label><b id="result" class="${last?.tx === 'T' ? 'tai' : 'xiu'}">${last ? last.result : '--'}</b></div>
      </div>
      ${last ? `<div class="dice" id="dice">${last.dice.map(d => `<div class="die">${d}</div>`).join('')}</div>` : ''}
      <div class="kicker" style="margin-top:12px">Phiên Trước</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${prevHtml}<div class="phase-box"><div class="phase-label">PHIÊN HIỆN TẠI</div><div class="phase-session">#${last ? last.session + 1 : '--'}</div></div></div>
      <div class="kicker" style="margin-top:12px">Lịch Sử</div>
      <div class="history"><table>
        <thead><tr><th>#</th><th>Phiên</th><th>Xúc xắc</th><th>Tổng</th><th>KQ</th></tr></thead>
        <tbody id="histBody"></tbody>
      </table></div>
    </div>
    <div class="card" style="text-align:center">
      <div class="kicker">Next Signal</div>
      <div class="title">Nhận Định Phiên Tiếp</div>
      <div class="ring"><div class="ring-core"><small>DỰ ĐOÁN</small><strong id="pred">${current.prediction || '--'}</strong></div></div>
      <div style="display:flex;justify-content:space-between;font-size:8px;color:#8491a7;font-weight:800;padding:0 8px">
        <span>ĐỘ TIN CẬY</span><b id="conf">${Math.round((current.confidence || 0) * 100)}%</b>
      </div>
      <div class="conf-bar"><i id="confBar" style="width:${Math.round((current.confidence || 0) * 100)}%"></i></div>
      <div class="kicker" style="margin-top:12px">Dự Đoán Vị</div>
      <div class="title" id="scorePred" style="font-size:18px">${current.scorePrediction ? current.scorePrediction.join(' • ') : '--'}</div>
      <div class="tags">
        <span class="tag">REGIME: <b id="regimeTag">${current.meta?.regime || '--'}</b></span>
        <span class="tag">VOTES: <b id="votedTag">${current.meta?.votedBy || 0}</b></span>
      </div>
    </div>
  </div>
  <div class="foot">ANH KHÔI • REAL-TIME PREDICTION • NO RANDOM</div>
</div>
<script>
async function refresh(){
  try{
    const r=await fetch('/api/sicbo/sunwin');const d=await r.json();
    const h=await fetch('/api/sicsun/history');const hl=await h.json();
    if(d.phien_hien_tai){
      document.getElementById('sessionTitle').textContent='Phiên #'+d.phien_hien_tai.session;
      document.getElementById('total').textContent=d.phien_hien_tai.total;
      document.getElementById('result').textContent=d.phien_hien_tai.result;
      document.getElementById('result').className=d.phien_hien_tai.tx==='T'?'tai':'xiu';
      document.getElementById('dice').innerHTML=d.phien_hien_tai.dice.map(x=>'<div class="die">'+x+'</div>').join('');
    }
    document.getElementById('pred').textContent=d.du_doan||'--';
    document.getElementById('conf').textContent=d.do_tin_cay+'%';
    document.getElementById('confBar').style.width=d.do_tin_cay+'%';
    document.getElementById('scorePred').textContent=d.du_doan_vi.join(' • ')||'--';
    document.getElementById('regimeTag').textContent=d.regime||'--';
    document.getElementById('votedTag').textContent=d.voted_by||0;
    if(hl.data)document.getElementById('histBody').innerHTML=hl.data.slice(0,12).map(x=>'<tr><td>'+x.idx+'</td><td>#'+x.session+'</td><td>'+x.dice.join('·')+'</td><td>'+x.total+'</td><td class="'+(x.tx==='t'?'tai':'xiu')+'">'+x.result+'</td></tr>').join('');
  }catch(e){console.error(e)}
}
refresh();setInterval(refresh,1000);
</script>
</body></html>`;
}

await fetchAndUpdate();
setInterval(fetchAndUpdate, 1000);
setInterval(updatePrediction, 100);

const start = async () => {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 SEIU AI v18 [@toilabeak] running on port ${PORT}`);
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
};

start();
