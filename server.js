import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DEFAULT_API = 'https://api.wsktnus8.net/v2/history/getLastResult?gameId=ktrng_3979&size=100&tableId=39791215743193&curPage=1';
const API_URLS = (process.env.SICBO_API_URLS || process.env.SICBO_API_URL || DEFAULT_API)
  .split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
const FETCH_TIMEOUT_MS = 7000;
const MAX_HISTORY = 500;

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const std=a=>{if(!a.length)return 0;const m=avg(a);return Math.sqrt(avg(a.map(v=>(v-m)**2)))};
const entropy=a=>{if(!a.length)return 0;const f={};for(const v of a)f[v]=(f[v]||0)+1;return Object.values(f).reduce((e,n)=>{const p=n/a.length;return e-p*Math.log2(p)},0)};
const opposite=v=>v==='T'?'X':'T';

class AnhKhoiSicboEngineV23 {
  constructor(){this.reset()}
  reset(){
    this.learning=.075; this.minWeight=.03;
    this.weights={}; this.reliability={};
    this.signals=[
      ['bayes_global',1.00,h=>this.bayesGlobal(h)],
      ['recency_bayes',1.08,h=>this.recencyBayes(h)],
      ['transition_1',1.02,h=>this.transition1(h)],
      ['markov_2',1.12,h=>this.markov2(h)],
      ['markov_3',1.16,h=>this.markov3(h)],
      ['pattern_bridge',1.18,h=>this.patternBridge(h)],
      ['run_regime',1.05,h=>this.runRegime(h)],
      ['score_regime',.92,h=>this.scoreRegime(h)],
      ['dice_context',.72,h=>this.diceContext(h)]
    ];
    for(const [id] of this.signals){this.weights[id]=1;this.reliability[id]=.5;}
  }
  valid(v){return v==='T'||v==='X'}
  rows(h){return(h||[]).filter(r=>this.valid(r?.tx)&&Array.isArray(r?.dice)&&r.dice.length===3&&r.dice.every(Number.isInteger)&&r.dice.every(d=>d>=1&&d<=6)&&Number.isInteger(r.total))}
  tx(h){return this.rows(h).map(r=>r.tx)}
  totals(h){return this.rows(h).map(r=>r.total)}
  counts(a){let t=0,x=0;for(const v of a)v==='T'?t++:x++;return{t,x,n:t+x}}
  bayesP(a,prior=3){const c=this.counts(a);return(c.t+prior)/(c.n+2*prior)}
  sideFromP(p,edge=.08){return Math.abs(p-.5)>=edge?(p>.5?'T':'X'):null}
  runs(a){const out=[];if(!a.length)return out;let v=a[0],n=1;for(let i=1;i<a.length;i++){if(a[i]===v)n++;else{out.push({v,n});v=a[i];n=1}}out.push({v,n});return out}
  transitionCounts(a, order=1){const out={T:{T:0,X:0},X:{T:0,X:0}};for(let i=order;i<a.length;i++){const k=a[i-order];if(order===1)out[k][a[i]]++;}return out}

  normalize(item){
    const raw=String(item?.gameNum??item?.session??item?.issue??item?.roundId??item?.id??'');
    const session=Number(raw.replace(/\D/g,''));
    let dice=[];
    const rawFaces=item?.facesList??item?.dice??item?.diceList;
    if(Array.isArray(rawFaces)) dice=rawFaces.map(d=>Number(d?.value??d?.point??d?.face??d));
    else if(typeof item?.keyR==='string') dice=item.keyR.trim().replace(/[\[\]"']/g,'').split(/[-,|\s]+/).map(Number);
    else if(typeof item?.result==='string') dice=item.result.replace(/[\[\]"']/g,'').split(/[-,|\s]+/).map(Number);
    if(!Number.isSafeInteger(session)||dice.length!==3||dice.some(d=>!Number.isInteger(d)||d<1||d>6))return null;
    const total=dice[0]+dice[1]+dice[2];
    return{session,dice,total,result:total>=11?'TAI':'XIU',tx:total>=11?'T':'X'};
  }
  parse(data){
    const arrays=[];
    const walk=(v,depth=0)=>{
      if(depth>6||v==null)return;
      if(Array.isArray(v)){if(v.length)arrays.push(v);for(const x of v.slice(0,250))walk(x,depth+1);return;}
      if(typeof v==='object')for(const val of Object.values(v))walk(val,depth+1);
    };
    walk(data);
    const candidates=[];
    for(const arr of arrays){let ok=0;for(const item of arr){if(item&&typeof item==='object'&&('gameNum'in item||'facesList'in item||'keyR'in item||'dice'in item||'issue'in item))ok++;}if(ok>=1)candidates.push(arr)}
    const source=candidates.sort((a,b)=>b.length-a.length)[0]||[];
    const seen=new Set(),out=[];
    for(const item of source){const r=this.normalize(item);if(r&&!seen.has(r.session)){seen.add(r.session);out.push(r)}}
    out.sort((a,b)=>a.session-b.session);return out;
  }

  bayesGlobal(h){const a=this.tx(h);if(a.length<25)return null;return this.sideFromP(this.bayesP(a,5),.07)}
  recencyBayes(h){const a=this.tx(h);if(a.length<20)return null;const windows=[12,24,48].filter(w=>a.length>=w),ps=[];for(const w of windows){const p=this.bayesP(a.slice(-w),w===12?1.5:2.5);ps.push([p,w===12?1.45:w===24?1:.65])}const den=ps.reduce((s,x)=>s+x[1],0);const p=ps.reduce((s,x)=>s+x[0]*x[1],0)/den;return this.sideFromP(p,.075)}
  transition1(h){const a=this.tx(h);if(a.length<30)return null;const last=a.at(-1),c=this.transitionCounts(a);const p=(c[last].T+2)/(c[last].T+c[last].X+4);return this.sideFromP(p,.09)}
  markov2(h){const a=this.tx(h);if(a.length<40)return null;const key=a.slice(-2).join(''),c={T:0,X:0};for(let i=0;i+2<a.length;i++)if(a[i]+a[i+1]===key)c[a[i+2]]++;if(c.T+c.X<7)return null;return this.sideFromP((c.T+2)/(c.T+c.X+4),.10)}
  markov3(h){const a=this.tx(h);if(a.length<55)return null;const key=a.slice(-3).join(''),c={T:0,X:0};for(let i=0;i+3<a.length;i++)if(a[i]+a[i+1]+a[i+2]===key)c[a[i+3]]++;if(c.T+c.X<6)return null;return this.sideFromP((c.T+1.75)/(c.T+c.X+3.5),.12)}
  patternBridge(h){const a=this.tx(h);if(a.length<55)return null;let best={T:0,X:0,score:0,matches:0};for(const k of [3,4,5,6]){const target=a.slice(-k);for(let i=0;i+k<a.length;i++){let same=0;for(let j=0;j<k;j++)if(a[i+j]===target[j])same++;const sim=same/k;if(sim<.75)continue;const age=a.length-(i+k),w=(sim**3)/Math.sqrt(age+1);best[a[i+k]]+=w;best.score+=w;best.matches++}}if(best.matches<4||best.score<1.2)return null;return this.sideFromP((best.T+1.2)/(best.T+best.X+2.4),.11)}
  runRegime(h){const a=this.tx(h);if(a.length<30)return null;const rs=this.runs(a),last=rs.at(-1),recent=rs.slice(-10),lens=recent.map(r=>r.n),m=avg(lens),s=std(lens);if(last.n>=Math.max(3,m+s*1.15))return last.v;if(last.n<=2&&recent.length>=7){const alt=recent.slice(-6);let alternating=true;for(let i=1;i<alt.length;i++)if(alt[i].v===alt[i-1].v)alternating=false;if(alternating)return opposite(last.v)}return null}
  scoreRegime(h){const a=this.totals(h);if(a.length<35)return null;const r=a.slice(-36),m=avg(r),s=std(r);if(s<1.55&&m>=12)return'T';if(s<1.55&&m<=9)return'X';const high=r.filter(v=>v>=11).length/r.length;return this.sideFromP(high,.12)}
  diceContext(h){const rs=this.rows(h);if(rs.length<55)return null;const recent=rs.slice(-30),mean=avg(recent.map(r=>r.total)),high=recent.filter(r=>r.total>=11).length/recent.length;const last=recent.at(-1);let faceBias=0;for(const d of last.dice){if(d>=4)faceBias+=1;else if(d<=2)faceBias-=1}const p=.58*high+.25*(mean-3)/15+.17*(faceBias/3+.5);return this.sideFromP(p,.13)}

  signal(id,h){const s=this.signals.find(x=>x[0]===id);return s?s[2](h):null}
  fitInitial(h){const rs=this.rows(h);if(rs.length<70)return;for(const [id] of this.signals){let hit=0,n=0;for(let i=45;i<rs.length;i++){const p=this.signal(id,rs.slice(0,i));if(!p)continue;n++;if(p===rs[i].tx)hit++}const acc=n?(hit+3)/(n+6):.5;this.reliability[id]=clamp(acc,.40,.70);this.weights[id]=clamp(.60+(acc-.5)*3.5,.30,1.50)}this.normalizeWeights()}
  normalizeWeights(){const ids=Object.keys(this.weights),sum=ids.reduce((a,id)=>a+this.weights[id],0)||1;for(const id of ids)this.weights[id]=Math.max(this.minWeight,this.weights[id]/sum*ids.length)}
  updateOutcome(prefix,actual){if(!this.valid(actual))return;for(const [id] of this.signals){const p=this.signal(id,prefix);if(!p)continue;const correct=p===actual,r=this.reliability[id]??.5;this.reliability[id]=clamp(r+(correct?.012:-.009),.35,.74);const w=this.weights[id]||this.minWeight;this.weights[id]=clamp(w*(correct?1+this.learning:1-this.learning*.55),this.minWeight,2)}this.normalizeWeights()}

  predict(h){
    const rs=this.rows(h),a=rs.map(r=>r.tx);if(a.length<35)return this.abstain(a.length,'INSUFFICIENT_DATA','Chưa đủ lịch sử hợp lệ để hiệu chỉnh cầu');
    const votes={T:0,X:0},details=[];for(const [id,prior] of this.signals){const p=this.signal(id,rs);if(!p)continue;const rel=this.reliability[id]??.5,w=(this.weights[id]||this.minWeight)*prior*(.72+rel);votes[p]+=w;details.push({id,side:p,weight:Number(w.toFixed(4)),reliability:Number(rel.toFixed(3))})}
    const total=votes.T+votes.X;if(!total)return this.abstain(a.length,'NO_SIGNAL','Không có tín hiệu đủ mạnh');
    const side=votes.T>=votes.X?'T':'X',edge=Math.abs(votes.T-votes.X)/total,active=details.length,agreement=details.filter(x=>x.side===side).length/active;
    const recent=a.slice(-36),e=entropy(recent),runs=this.runs(recent),runEntropy=entropy(runs.map(r=>r.n>=2?'R':'S'));
    const regime=e>.985?'RANDOM_LIKE':(e<.82||runEntropy<.72)?'STRUCTURED':'MIXED';
    const reliability=avg(details.map(x=>x.reliability));
    const sample=clamp((a.length-35)/165,0,1);
    const independent=details.filter(x=>['markov_2','markov_3','pattern_bridge','transition_1'].includes(x.id)&&x.side===side).length;
    let confidence=.50+edge*.34+agreement*.10+sample*.035+(reliability-.5)*.16;
    if(regime==='RANDOM_LIKE')confidence-=.055;
    if(independent<1)confidence-=.025;
    confidence=clamp(confidence,.50,.82);
    const strong=edge>=.145&&active>=3&&agreement>=.62&&independent>=1&&confidence>=.565&&regime!=='RANDOM_LIKE';
    const reason=strong?`CORE ${active} tín hiệu • đồng thuận ${(agreement*100).toFixed(0)}% • cầu độc lập ${independent} • edge ${(edge*100).toFixed(1)}% • ${regime}`:'Tín hiệu chưa đủ đồng thuận; hệ thống tự động đứng ngoài';
    return{prediction:strong?(side==='T'?'TÀI':'XỈU'):'CHƯA ĐỦ TÍN HIỆU',confidence:strong?confidence:Math.min(confidence,.55),scorePrediction:strong?this.scorePrediction(rs,side):[],meta:{regime,votedBy:active,agreement:Number(agreement.toFixed(3)),edge:Number(edge.toFixed(4)),sampleSize:a.length,independent,abstained:!strong,reason,signals:details,method:'adaptive walk-forward + Bayesian recency + Markov 1/2/3 + pattern bridge + run regime + dice context'}}
  }
  abstain(n,regime,reason){return{prediction:'CHƯA ĐỦ TÍN HIỆU',confidence:.5,scorePrediction:[],meta:{regime,votedBy:0,agreement:0,edge:0,sampleSize:n,abstained:true,reason,signals:[]}}}
  scorePrediction(rs,side){const range=side==='T'?[11,12,13,14,15,16,17,18]:[3,4,5,6,7,8,9,10],sc=Object.fromEntries(range.map(x=>[x,1]));for(let i=0;i<rs.length-1;i++){if(rs[i].tx!==side)continue;const age=rs.length-1-i,w=1/Math.sqrt(age+1);if(sc[rs[i+1].total]!=null)sc[rs[i+1].total]+=w}return range.sort((a,b)=>sc[b]-sc[a]).slice(0,3)}
}

const engine=new AnhKhoiSicboEngineV23();
let history=[],currentSessionId=null,prediction=null,fetchInFlight=false,lastFetchStarted=0;
let dataStatus={ok:false,lastSuccess:0,error:null,source:'UPSTREAM',attempt:0,urlIndex:0,parsed:0};
let dashboardHTML='';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function loadDashboard(){dashboardHTML=await fs.readFile(path.join(__dirname,'dashboard.html'),'utf8');if(!dashboardHTML.includes('ANH KHÔI'))throw new Error('dashboard.html missing ANH KHÔI branding')}
async function fetchJson(url,timeout){const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{signal:c.signal,headers:{accept:'application/json, text/plain, */*','user-agent':'Mozilla/5.0 ANH-KHOI-CORE/23','cache-control':'no-cache'}});const text=await r.text();if(!r.ok)throw new Error(`Upstream HTTP ${r.status}`);try{return JSON.parse(text)}catch{throw new Error(`Upstream trả về không phải JSON (${text.slice(0,100)})`)}}finally{clearTimeout(timer)}}
function rebuild(parsed){history=parsed.slice(-MAX_HISTORY);engine.reset();currentSessionId=history.at(-1)?.session??null;prediction=history.length?engine.predict(history):null;engine.fitInitial(history);for(const r of history){} }
async function fetchAndUpdate(){if(fetchInFlight)return;const now=Date.now();if(now-lastFetchStarted<850)return;fetchInFlight=true;lastFetchStarted=now;let lastErr=null;try{for(let attempt=0;attempt<API_URLS.length;attempt++){const idx=(dataStatus.urlIndex+attempt)%API_URLS.length;try{const raw=await fetchJson(API_URLS[idx],FETCH_TIMEOUT_MS);const parsed=engine.parse(raw);if(!parsed.length)throw new Error('API trả dữ liệu nhưng không nhận diện được phiên Sicbo');const newest=parsed.at(-1);if(currentSessionId===null)rebuild(parsed);else if(newest.session>currentSessionId){const incoming=parsed.filter(r=>r.session>currentSessionId);for(const r of incoming){const prefix=history.slice();history.push(r);engine.updateOutcome(prefix,r.tx)}history=history.slice(-MAX_HISTORY);currentSessionId=history.at(-1)?.session??currentSessionId;prediction=engine.predict(history)}else if(!prediction)prediction=engine.predict(history);dataStatus={ok:true,lastSuccess:Date.now(),error:null,source:'UPSTREAM',attempt:attempt+1,urlIndex:idx,parsed:history.length};return}catch(e){lastErr=e;}}
throw lastErr||new Error('Không có API nguồn hoạt động')}catch(e){dataStatus={...dataStatus,ok:false,error:String(e?.message||e),source:'UPSTREAM',attempt:dataStatus.attempt+1};console.error('[DATA]',dataStatus.error)}finally{fetchInFlight=false}}
function json(res,status,obj){const b=JSON.stringify(obj);res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'content-type'});res.end(b)}
function payload(){const last=history.at(-1),prev=history.at(-2),p=prediction;return{ok:Boolean(last),id:'ANH KHÔI',mode:'LIVE',sourceStatus:dataStatus,phien_hien_tai:last?{session:last.session,dice:last.dice,total:last.total,result:last.result,tx:last.tx}:null,phien_truoc:prev?{session:prev.session,dice:prev.dice,total:prev.total,result:prev.result,tx:prev.tx}:null,du_doan:p?.prediction||'CHƯA ĐỦ TÍN HIỆU',do_tin_cay:Math.round((p?.confidence??.5)*100),du_doan_vi:p?.scorePrediction||[],regime:p?.meta?.regime||'--',voted_by:p?.meta?.votedBy||0,meta:p?.meta||{}}}
const server=http.createServer((req,res)=>{const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'content-type'});return res.end()}if(req.method!=='GET')return json(res,405,{ok:false,error:'Method Not Allowed'});if(u.pathname==='/health')return json(res,200,{ok:true,service:'ANH KHÔI CORE v23',uptime:process.uptime(),data:dataStatus,history:history.length});if(u.pathname==='/api/sicbo/sunwin')return json(res,200,payload());if(u.pathname==='/api/sicsun/history')return json(res,200,{ok:true,data:[...history].reverse().slice(0,100).map((h,i)=>({idx:i+1,session:h.session,dice:h.dice,total:h.total,result:h.result,tx:h.tx}))});if(u.pathname==='/api/debug/source')return json(res,200,{ok:dataStatus.ok,configuredSources:API_URLS.length,data:dataStatus,history:history.length,latest:history.at(-1)||null});if(u.pathname==='/'||u.pathname==='/dashboard.html'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});return res.end(dashboardHTML)}return json(res,404,{ok:false,error:'Not Found'})});

async function start(){await loadDashboard();server.on('error',e=>console.error('[SERVER]',e));server.listen(PORT,'0.0.0.0',()=>{console.log(`ANH KHÔI CORE v23 running on port ${PORT}`);void fetchAndUpdate();setInterval(()=>void fetchAndUpdate(),1000);setInterval(()=>{if(history.length)prediction=engine.predict(history)},1500)})}
process.on('unhandledRejection',e=>console.error('[PROCESS] unhandledRejection',e));process.on('uncaughtException',e=>console.error('[PROCESS] uncaughtException',e));
start().catch(e=>{console.error('[BOOT]',e);setTimeout(()=>start().catch(x=>console.error('[BOOT-RETRY]',x)),2500)});
