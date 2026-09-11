import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const GAME_ID = process.env.SICBO_GAME_ID || 'ktrng_3979';
const TABLE_ID = process.env.SICBO_TABLE_ID || '39791215743193';
const API_BASE = process.env.SICBO_API_BASE || 'https://api.wsktnus8.net/v2/history/getLastResult';
const API_SIZE = Math.max(50, Number(process.env.SICBO_API_SIZE || 500));
const API_URLS = (process.env.SICBO_API_URLS || `${API_BASE}?gameId=${encodeURIComponent(GAME_ID)}&size=${API_SIZE}&tableId=${encodeURIComponent(TABLE_ID)}&curPage=1`)
  .split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
const FETCH_TIMEOUT_MS = 1000;
const MAX_HISTORY = 1000;
const STATE_FILE = path.join(__dirname, '.anh-khoi-state.json');
const TARGET_MEMORY = 250;
const PERSISTED_ENGINE_KEYS = ['reliability','weights'];

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const entropy=a=>{if(!a.length)return 0;const f={};for(const v of a)f[v]=(f[v]||0)+1;return Object.values(f).reduce((e,n)=>{const p=n/a.length;return e-p*Math.log2(p)},0)};
const opposite=v=>v==='T'?'X':'T';
const sideName=v=>v==='T'?'TÀI':'XỈU';

class AnhKhoiAdaptiveEngine {
  constructor(){ this.reset(); }
  reset(){
    this.learning=0.035;
    this.reliability={}; this.weights={};
    this.signals=[
      ['bayes_ewma',1.00,h=>this.bayesEwma(h)],
      ['window_10',1.18,h=>this.window10(h)],
      ['transition_1',1.06,h=>this.transition1(h)],
      ['markov_2',1.20,h=>this.markov2(h)],
      ['markov_3',1.25,h=>this.markov3(h)],
      ['bridge_10',1.28,h=>this.bridge10(h)],
      ['run_break',1.08,h=>this.runBreak(h)],
      ['alternation',.92,h=>this.alternation(h)],
      ['score_regime',.76,h=>this.scoreRegime(h)],
      ['dice_faces_10',.82,h=>this.diceFaces10(h)],
      ['dice_transition',.86,h=>this.diceTransition(h)]
    ];
    for(const [id] of this.signals){this.reliability[id]=.5;this.weights[id]=1;}
  }
  valid(v){return v==='T'||v==='X'}
  rows(h){return(h||[]).filter(r=>this.valid(r?.tx)&&Array.isArray(r?.dice)&&r.dice.length===3&&r.dice.every(Number.isInteger)&&r.dice.every(d=>d>=1&&d<=6)&&Number.isInteger(r.total)&&r.total>=3&&r.total<=18&&Number.isSafeInteger(r.session));}
  tx(h){return this.rows(h).map(r=>r.tx)}
  totals(h){return this.rows(h).map(r=>r.total)}
  runs(a){const out=[];if(!a.length)return out;let v=a[0],n=1;for(let i=1;i<a.length;i++){if(a[i]===v)n++;else{out.push({v,n});v=a[i];n=1}}out.push({v,n});return out}
  prob(a,prior=2,decay=.965){let t=prior,x=prior,w=1;for(let i=a.length-1;i>=0;i--){if(a[i]==='T')t+=w;else x+=w;w*=decay}return t/(t+x)}
  side(p,edge=.06){return Math.abs(p-.5)>=edge?(p>.5?'T':'X'):null}
  normalize(item){
    const raw=String(item?.gameNum??item?.session??item?.issue??item?.roundId??item?.id??'');
    const m=raw.match(/\d+/); const session=m?Number(m[0]):NaN;
    const rawFaces=item?.facesList??item?.dice??item?.diceList;
    let dice=Array.isArray(rawFaces)?rawFaces.map(d=>Number(d?.value??d?.point??d?.face??d)):[];
    if(!dice.length&&typeof item?.keyR==='string')dice=item.keyR.replace(/[\[\]"']/g,'').split(/[-,|\s]+/).map(Number);
    if(!Number.isSafeInteger(session)||dice.length!==3||dice.some(d=>!Number.isInteger(d)||d<1||d>6))return null;
    const total=dice.reduce((a,b)=>a+b,0);
    const apiScore=Number(item?.score);
    return {session,dice,total,result:total>=11?'TAI':'XIU',tx:total>=11?'T':'X',apiScore:Number.isFinite(apiScore)?apiScore:null};
  }
  parse(data){
    const arrays=[];
    const walk=(v,d=0)=>{if(v==null||d>8)return;if(Array.isArray(v)){if(v.length)arrays.push(v);for(const x of v.slice(0,1200))walk(x,d+1);return}if(typeof v==='object')for(const x of Object.values(v))walk(x,d+1)};
    walk(data);
    const scored=arrays.map(arr=>{let ok=0;for(const x of arr)if(x&&typeof x==='object'&&('gameNum'in x||'facesList'in x||'score'in x))ok++;return {arr,ok}}).filter(x=>x.ok>0).sort((a,b)=>b.ok-a.ok||b.arr.length-a.arr.length);
    const source=scored[0]?.arr||[]; const seen=new Set(),out=[];
    for(const item of source){const r=this.normalize(item);if(r&&!seen.has(r.session)){seen.add(r.session);out.push(r)}}
    out.sort((a,b)=>a.session-b.session);return out;
  }
  bayesEwma(h){const a=this.tx(h);if(a.length<25)return null;return this.side(this.prob(a,2.5,.972),.055)}
  window10(h){const a=this.tx(h);if(a.length<10)return null;return this.side(this.prob(a.slice(-10),1.5,.86),.10)}
  transition1(h){const a=this.tx(h);if(a.length<25)return null;const last=a.at(-1),c={T:1.5,X:1.5};for(let i=0;i<a.length-1;i++)if(a[i]===last)c[a[i+1]]+=Math.pow(.985,a.length-2-i);return this.side(c.T/(c.T+c.X),.095)}
  markov2(h){const a=this.tx(h);if(a.length<40)return null;const key=a.slice(-2).join(''),c={T:1.5,X:1.5};let n=0;for(let i=0;i+2<a.length;i++)if(a[i]+a[i+1]===key){c[a[i+2]]+=Math.pow(.98,a.length-3-i);n++}return n<5?null:this.side(c.T/(c.T+c.X),.09)}
  markov3(h){const a=this.tx(h);if(a.length<55)return null;const key=a.slice(-3).join(''),c={T:1.5,X:1.5};let n=0;for(let i=0;i+3<a.length;i++)if(a[i]+a[i+1]+a[i+2]===key){c[a[i+3]]+=Math.pow(.985,a.length-4-i);n++}return n<4?null:this.side(c.T/(c.T+c.X),.105)}
  bridge10(h){const a=this.tx(h);if(a.length<18)return null;const target=a.slice(-10);let vT=0,vX=0,matches=0;for(let i=0;i+10<a.length;i++){let same=0;for(let j=0;j<10;j++)if(a[i+j]===target[j])same++;const sim=same/10;if(sim<.70)continue;const age=a.length-(i+10);const w=(sim**4)/(1+Math.sqrt(age));if(a[i+10]==='T')vT+=w;else vX+=w;matches++}if(matches<2)return null;return this.side((vT+1)/(vT+vX+2),.075)}
  runBreak(h){const a=this.tx(h);if(a.length<18)return null;const rs=this.runs(a),last=rs.at(-1);if(last.n>=4)return last.v;if(last.n>=3&&rs.length>=3&&rs.at(-2).n<=2)return last.v;if(last.n===1&&rs.length>=4){const prev=rs.at(-2);if(prev.n>=3)return opposite(last.v)}return null}
  alternation(h){const a=this.tx(h);if(a.length<10)return null;const r=a.slice(-10);let alt=0;for(let i=1;i<r.length;i++)if(r[i]!==r[i-1])alt++;if(alt>=8)return opposite(a.at(-1));if(alt<=2&&a.at(-1))return a.at(-1);return null}
  scoreRegime(h){const a=this.totals(h);if(a.length<25)return null;const r=a.slice(-24),high=r.filter(v=>v>=11).length/r.length;return this.side(high,.11)}
  diceFaces10(h){const rs=this.rows(h);if(rs.length<10)return null;const r=rs.slice(-10),face={1:0,2:0,3:0,4:0,5:0,6:0};for(const x of r)for(const d of x.dice)face[d]++;const mean=(face[4]+face[5]+face[6])/(face[1]+face[2]+face[3]+face[4]+face[5]+face[6]);const recent=rs.at(-1).dice.reduce((s,d)=>s+d,0);const p=clamp(.5+(mean-.5)*.28+(recent-10.5)/30,.08,.92);return this.side(p,.13)}
  diceTransition(h){const rs=this.rows(h);if(rs.length<18)return null;const last=rs.at(-1).dice.join('');let t=0,x=0,n=0;for(let i=0;i+1<rs.length;i++){if(rs[i].dice.join('')===last){const next=rs[i+1];next.tx==='T'?t++:x++;n++}}if(n<2)return null;return this.side((t+1)/(t+x+2),.16)}
  signal(id,h){const s=this.signals.find(x=>x[0]===id);return s?s[2](h):null}
  fit(h){const rs=this.rows(h);if(rs.length<60)return;for(const [id] of this.signals){let hit=0,n=0;for(let i=35;i<rs.length;i++){const p=this.signal(id,rs.slice(0,i));if(!p)continue;n++;if(p===rs[i].tx)hit++}const acc=n?(hit+2)/(n+4):.5;this.reliability[id]=clamp(acc,.38,.72);this.weights[id]=clamp(.65+(acc-.5)*4,.25,1.8)}this.normalizeWeights()}
  normalizeWeights(){const ids=Object.keys(this.weights),s=ids.reduce((a,id)=>a+this.weights[id],0)||1;for(const id of ids)this.weights[id]=Math.max(.02,this.weights[id]/s*ids.length)}
  update(hBefore,actual){if(!this.valid(actual))return;for(const [id] of this.signals){const p=this.signal(id,hBefore);if(!p)continue;const ok=p===actual;const r=this.reliability[id]??.5;this.reliability[id]=clamp(r+(ok?this.learning:-this.learning*.72),.35,.76);const w=this.weights[id]||.5;this.weights[id]=clamp(w*(ok?1.018:.988),.02,2.5)}this.normalizeWeights()}
  predict(h){
    const rs=this.rows(h),a=rs.map(r=>r.tx);if(a.length<18)return this.stop(a.length,'INSUFFICIENT_DATA','Cần tối thiểu 18 phiên hợp lệ');
    const votes={T:0,X:0},details=[];
    for(const [id,prior] of this.signals){const p=this.signal(id,rs);if(!p)continue;const rel=this.reliability[id]??.5,w=(this.weights[id]||.02)*prior*(.55+rel);votes[p]+=w;details.push({id,side:p,weight:+w.toFixed(4),reliability:+rel.toFixed(3)})}
    const total=votes.T+votes.X;if(!total)return this.stop(a.length,'NO_SIGNAL','Không có tín hiệu hợp lệ');
    const side=votes.T>=votes.X?'T':'X',edge=Math.abs(votes.T-votes.X)/total,active=details.length,agree=details.filter(x=>x.side===side).length/active;
    const recent=a.slice(-10),e=entropy(recent),run=this.runs(recent);const structured=(e<.88||run.length<=4);const regime=e>.995?'RANDOM_LIKE':structured?'STRUCTURED':'MIXED';
    const independent=details.filter(x=>['window_10','markov_2','markov_3','bridge_10','run_break'].includes(x.id)&&x.side===side).length;
    const rel=avg(details.map(x=>x.reliability));
    const sampleFactor=clamp((a.length-18)/182,0,1);
    let confidence=.50+edge*.34+agree*.12+(rel-.5)*.14+sampleFactor*.025;
    if(regime==='RANDOM_LIKE')confidence-=.07;
    if(independent<2)confidence-=.035;
    if(active<5)confidence-=.025;
    confidence=clamp(confidence,.50,.82);
    const strong=edge>=.09&&active>=4&&agree>=.58&&independent>=1&&confidence>=.55&&(regime!=='RANDOM_LIKE'||edge>=.20);
    const reason=strong?`ADAPTIVE CORE • ${active} tín hiệu • đồng thuận ${(agree*100).toFixed(0)}% • cầu độc lập ${independent} • edge ${(edge*100).toFixed(1)}% • ${regime}`:`Tín hiệu chưa đủ mạnh • ${active} tín hiệu • đồng thuận ${(agree*100).toFixed(0)}% • ${regime}`;
    return {prediction:strong?sideName(side):'CHƯA ĐỦ TÍN HIỆU',confidence:strong?confidence:Math.min(confidence,.55),scorePrediction:strong?this.scorePrediction(rs,side):[],meta:{regime,votedBy:active,agreement:+agree.toFixed(3),edge:+edge.toFixed(4),sampleSize:a.length,window10:recent.join(''),independent,abstained:!strong,reason,signals:details,method:'Adaptive Contextual Ensemble v24 • walk-forward reliability • 10-session bridge • Markov 1/2/3 • run/alternation • dice-face context'}};
  }
  stop(n,regime,reason){return{prediction:'CHƯA ĐỦ TÍN HIỆU',confidence:.5,scorePrediction:[],meta:{regime,votedBy:0,agreement:0,edge:0,sampleSize:n,abstained:true,reason,signals:[]}}}
  scorePrediction(rs,side){const range=side==='T'?[11,12,13,14,15,16,17,18]:[3,4,5,6,7,8,9,10],s=Object.fromEntries(range.map(v=>[v,1]));for(let i=0;i<rs.length-1;i++){if(rs[i].tx!==side)continue;const age=rs.length-1-i,w=1/Math.sqrt(age+1);if(s[rs[i+1].total]!=null)s[rs[i+1].total]+=w}return range.sort((a,b)=>s[b]-s[a]).slice(0,3)}
}

const engine=new AnhKhoiAdaptiveEngine();
let history=[],targetPredictions=[],currentTarget=null,prediction=null,fetchInFlight=false,lastFetchStarted=0,dashboardHTML='';
let dataStatus={ok:false,lastSuccess:0,error:null,source:'UPSTREAM',attempt:0,urlIndex:0,parsed:0,latestSession:null,targetSession:null};
async function loadDashboard(){dashboardHTML=await fs.readFile(path.join(__dirname,'dashboard.html'),'utf8');}
async function fetchJson(url,timeout){const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{signal:c.signal,headers:{accept:'application/json, text/plain, */*','user-agent':'Mozilla/5.0 ANH-KHOI-CORE/24','cache-control':'no-cache'} });const text=await r.text();if(!r.ok)throw new Error(`Upstream HTTP ${r.status}`);try{return JSON.parse(text)}catch{throw new Error(`API không trả JSON: ${text.slice(0,120)}`)}}finally{clearTimeout(timer)}}
async function loadState(){try{const raw=await fs.readFile(STATE_FILE,'utf8');const s=JSON.parse(raw);if(Array.isArray(s.targetPredictions))targetPredictions=s.targetPredictions.slice(-TARGET_MEMORY);if(Number.isSafeInteger(s.currentTarget))currentTarget=s.currentTarget;if(s.engine&&typeof s.engine==='object'){engine._persisted=s.engine}}catch{}}
let saveTimer=null;
function saveState(){clearTimeout(saveTimer);saveTimer=setTimeout(async()=>{try{await fs.writeFile(STATE_FILE,JSON.stringify({targetPredictions:targetPredictions.slice(-TARGET_MEMORY),currentTarget,engine:{reliability:engine.reliability,weights:engine.weights}},null,2))}catch(e){console.error('[STATE]',e.message)}},80)}
function rebuild(parsed){
  history=parsed.slice(-MAX_HISTORY);engine.reset();engine.fit(history);applyPersistedEngine();
  const latest=history.at(-1)?.session??null; currentTarget=latest?latest+1:null;
  targetPredictions=targetPredictions.filter(x=>x&&Number.isSafeInteger(x.target));
  prediction=currentTarget?engine.predict(history):null; if(currentTarget&&prediction)storeTarget(currentTarget,prediction);
}
function applyPersistedEngine(){const p=engine._persisted;if(!p)return;for(const id of Object.keys(engine.weights)){if(Number.isFinite(p.weights?.[id]))engine.weights[id]=clamp(Number(p.weights[id]),.02,2.5);if(Number.isFinite(p.reliability?.[id]))engine.reliability[id]=clamp(Number(p.reliability[id]),.35,.76)}engine.normalizeWeights()}
function storeTarget(target,p){
  if(!Number.isSafeInteger(target)||!p)return;
  const existing=targetPredictions.find(x=>x.target===target);
  if(existing){prediction=existing.predictionObj||p;return}
  const rec={target,createdAt:Date.now(),prediction:p.prediction,confidence:p.confidence,position:p.meta?.abstained?'DỪNG':'LIVE',predictionObj:p};
  targetPredictions.push(rec);targetPredictions=targetPredictions.slice(-TARGET_MEMORY);prediction=p;saveState();
}
function resolveTargets(){
  const actualMap=new Map(history.map(r=>[r.session,r]));
  let changed=false;
  for(const rec of targetPredictions){if(rec.checked)continue;const actual=actualMap.get(rec.target);if(!actual)continue;rec.actual=actual.tx;rec.actualName=sideName(actual.tx);rec.correct=rec.prediction===rec.actualName;rec.checkedAt=Date.now();rec.checked=true;changed=true;engine.update(history.filter(r=>r.session<actual.session),actual.tx)}
  if(changed)saveState();
}
async function fetchAndUpdate(){
  if(fetchInFlight)return;const now=Date.now();if(now-lastFetchStarted<850)return;fetchInFlight=true;lastFetchStarted=now;
  try{let lastErr=null;
    for(let attempt=0;attempt<API_URLS.length;attempt++){const idx=(dataStatus.urlIndex+attempt)%API_URLS.length;try{
      const raw=await fetchJson(API_URLS[idx],FETCH_TIMEOUT_MS);const parsed=engine.parse(raw);if(!parsed.length)throw new Error('API có dữ liệu nhưng parser không tìm thấy phiên gameNum/facesList');
      const oldLatest=history.at(-1)?.session??0;const newest=parsed.at(-1);
      if(!history.length){history=parsed.slice(-MAX_HISTORY);engine.reset();engine.fit(history);applyPersistedEngine();}
      else if(newest.session>oldLatest){const incoming=parsed.filter(r=>r.session>oldLatest).sort((a,b)=>a.session-b.session);for(const r of incoming){const before=history.slice();history.push(r);history=history.slice(-MAX_HISTORY);engine.update(before,r.tx);saveState()}}
      else { // refresh full history from API without creating duplicates
        const by=new Map(history.map(r=>[r.session,r]));for(const r of parsed)by.set(r.session,r);history=[...by.values()].sort((a,b)=>a.session-b.session).slice(-MAX_HISTORY);
      }
      resolveTargets();
      currentTarget=(history.at(-1)?.session??0)+1;
      const existing=targetPredictions.find(x=>x.target===currentTarget&&!x.checked);
      if(existing)prediction=existing.predictionObj||engine.predict(history);else{prediction=engine.predict(history);storeTarget(currentTarget,prediction)}
      dataStatus={ok:true,lastSuccess:Date.now(),error:null,source:'UPSTREAM',attempt:attempt+1,urlIndex:idx,parsed:history.length,latestSession:history.at(-1)?.session??null,targetSession:currentTarget};return;
    }catch(e){lastErr=e}}
    throw lastErr||new Error('Không có nguồn API hoạt động');
  }catch(e){dataStatus={...dataStatus,ok:false,error:String(e?.message||e),source:'UPSTREAM',attempt:dataStatus.attempt+1};console.error('[DATA]',dataStatus.error)}finally{fetchInFlight=false}}
function json(res,status,obj){const b=JSON.stringify(obj);res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'content-type'});res.end(b)}
function publicTarget(){const t=currentTarget??(history.at(-1)?.session??0)+1;const p=prediction;return{session:t,prediction:p?.prediction||'CHƯA ĐỦ TÍN HIỆU',confidence:Math.round((p?.confidence??.5)*100),position:p?.meta?.abstained?'DỪNG':'LIVE',meta:p?.meta||{}}}
function payload(){const last=history.at(-1),prev=history.at(-2),tar=publicTarget();return{ok:Boolean(last),id:'ANH KHÔI',mode:'LIVE',sourceStatus:dataStatus,phien_hien_tai:last?{session:last.session,dice:last.dice,total:last.total,result:last.result,tx:last.tx}:null,phien_muc_tieu:tar,phien_truoc:prev?{session:prev.session,dice:prev.dice,total:prev.total,result:prev.result,tx:prev.tx}:null,du_doan:tar.prediction,do_tin_cay:tar.confidence,du_doan_vi:tar.meta?.abstained?[]:(tar.meta?.scorePrediction||[]),regime:tar.meta?.regime||'--',voted_by:tar.meta?.votedBy||0,meta:tar.meta||{}}}
function predictionHistory(){return targetPredictions.slice().sort((a,b)=>b.target-a.target).slice(0,100).map(r=>({target:r.target,prediction:r.prediction,confidence:Math.round((r.confidence??.5)*100),checked:Boolean(r.checked),actual:r.actualName||null,correct:r.checked?Boolean(r.correct):null,createdAt:r.createdAt}))}
const server=http.createServer((req,res)=>{const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'content-type'});return res.end()}if(req.method!=='GET')return json(res,405,{ok:false,error:'Method Not Allowed'});
  if(u.pathname==='/health')return json(res,200,{ok:true,service:'ANH KHÔI CORE v24',uptime:process.uptime(),data:dataStatus,history:history.length,target:currentTarget,storedPredictions:targetPredictions.length});
  if(u.pathname==='/api/sicbo/sunwin')return json(res,200,payload());
  if(u.pathname==='/api/sicsun/history')return json(res,200,{ok:true,data:[...history].reverse().slice(0,100).map((h,i)=>({idx:i+1,session:h.session,dice:h.dice,total:h.total,result:h.result,tx:h.tx}))});
  if(u.pathname==='/api/predictions/history')return json(res,200,{ok:true,data:predictionHistory()});
  if(u.pathname==='/api/debug/source')return json(res,200,{ok:dataStatus.ok,configuredSources:API_URLS.length,data:dataStatus,history:history.length,latest:history.at(-1)||null,target:publicTarget(),recent10:history.slice(-10)});
  if(u.pathname==='/'||u.pathname==='/dashboard.html'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});return res.end(dashboardHTML)}
  return json(res,404,{ok:false,error:'Not Found'});
});

async function start(){await loadState();await loadDashboard();server.on('error',e=>console.error('[SERVER]',e));server.listen(PORT,'0.0.0.0',()=>{console.log(`ANH KHÔI CORE v24 running on port ${PORT}`);void fetchAndUpdate();setInterval(()=>void fetchAndUpdate(),1200);setInterval(()=>{if(history.length&&currentTarget&&!targetPredictions.find(x=>x.target===currentTarget&&!x.checked)){prediction=engine.predict(history);storeTarget(currentTarget,prediction)}},1800)})}
process.on('unhandledRejection',e=>console.error('[PROCESS] unhandledRejection',e));process.on('uncaughtException',e=>console.error('[PROCESS] uncaughtException',e));
start().catch(e=>{console.error('[BOOT]',e);setTimeout(()=>start().catch(x=>console.error('[BOOT-RETRY]',x)),2500)});
