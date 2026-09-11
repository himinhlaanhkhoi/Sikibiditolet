import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const API_URL = process.env.SICBO_API_URL || 'https://api.wsktnus8.net/v2/history/getLastResult?gameId=ktrng_3979&size=100&tableId=39791215743193&curPage=1';
const FETCH_TIMEOUT_MS = 6500;
const MAX_HISTORY = 500;

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const std=a=>{if(!a.length)return 0;const m=avg(a);return Math.sqrt(avg(a.map(v=>(v-m)**2)));};
const entropy=a=>{if(!a.length)return 0;const f={};for(const v of a)f[v]=(f[v]||0)+1;return Object.values(f).reduce((e,n)=>{const p=n/a.length;return e-p*Math.log2(p)},0);};
const opposite=v=>v==='T'?'X':'T';

class AnhKhoiSicboEngineV22 {
  constructor(){this.reset()}
  reset(){
    this.minWeight=.025;
    this.learning=.09;
    this.weights={};
    this.reliability={};
    this.stats={n:0,t:0,x:0,score:{},faces:[{}, {}, {}]};
    this.signals=[
      ['bayes_global',1.00,h=>this.bayesGlobal(h)],
      ['multi_window',1.04,h=>this.multiWindow(h)],
      ['markov_2',1.08,h=>this.markov2(h)],
      ['markov_3',1.10,h=>this.markov3(h)],
      ['bridge_4',1.12,h=>this.bridge4(h)],
      ['run_structure',1.00,h=>this.runStructure(h)],
      ['score_regime',1.02,h=>this.scoreRegime(h)],
      ['dice_structure',1.05,h=>this.diceStructure(h)]
    ];
    for(const [id] of this.signals){this.weights[id]=1;this.reliability[id]=.5;}
  }
  valid(v){return v==='T'||v==='X'}
  rows(h){return (h||[]).filter(r=>this.valid(r?.tx)&&Array.isArray(r?.dice)&&r.dice.length===3&&Number.isInteger(r.total))}
  tx(h){return this.rows(h).map(r=>r.tx)}
  counts(a){let t=0,x=0;for(const v of a)v==='T'?t++:x++;return{t,x,n:t+x}}
  pT(a,s=4){const c=this.counts(a);return(c.t+s)/(c.n+2*s)}
  z(a){return Math.abs(this.pT(a)-.5)*2}
  sideFromP(p,edge=.08){return Math.abs(p-.5)>=edge?(p>.5?'T':'X'):null}
  runs(a){const out=[];if(!a.length)return out;let v=a[0],n=1;for(let i=1;i<a.length;i++){if(a[i]===v)n++;else{out.push({v,n});v=a[i];n=1}}out.push({v,n});return out}

  normalize(item){
    const raw=String(item?.gameNum??item?.session??item?.id??'');
    const session=Number(raw.replace(/\D/g,''));
    const dice=Array.isArray(item?.facesList)?item.facesList.map(Number):typeof item?.keyR==='string'?item.keyR.split(/[-,|\s]+/).map(Number):Array.isArray(item?.dice)?item.dice.map(Number):[];
    if(!Number.isSafeInteger(session)||dice.length!==3||dice.some(d=>!Number.isInteger(d)||d<1||d>6))return null;
    const total=dice[0]+dice[1]+dice[2];
    const reported=Number(item?.score??item?.total);
    if(Number.isInteger(reported)&&reported!==total)return null;
    return{session,dice,total,result:total>=11?'TAI':'XIU',tx:total>=11?'T':'X'};
  }
  parse(data){
    const list=data?.data?.resultList??data?.resultList??data?.data??[];if(!Array.isArray(list))return[];
    const seen=new Set(),out=[];for(const item of list){const r=this.normalize(item);if(r&&!seen.has(r.session)){seen.add(r.session);out.push(r)}}
    out.sort((a,b)=>a.session-b.session);return out;
  }
  updateStats(r){if(!r||!this.valid(r.tx))return;this.stats.n++;this.stats[r.tx==='T'?'t':'x']++;this.stats.score[r.total]=(this.stats.score[r.total]||0)+1;for(let i=0;i<3;i++)this.stats.faces[i][r.dice[i]]=(this.stats.faces[i][r.dice[i]]||0)+1}

  bayesGlobal(h){const a=this.tx(h);if(a.length<30)return null;return this.sideFromP(this.pT(a,7),.075)}
  multiWindow(h){const a=this.tx(h);if(a.length<24)return null;const ws=[12,24,48].filter(w=>a.length>=w);let t=0,x=0,tot=0;for(const w of ws){const p=this.pT(a.slice(-w),w<=12?2:3),weight=w===12?1.4:w===24?1.0:.7;t+=Math.max(0,p-.5)*weight;x+=Math.max(0,.5-p)*weight;tot+=weight}if(!tot)return null;const p=.5+(t-x)/tot;return this.sideFromP(p,.085)}
  markov2(h){const a=this.tx(h);if(a.length<35)return null;const key=a.slice(-2).join(''),c={T:0,X:0};for(let i=0;i+2<a.length;i++)if(a[i]+a[i+1]===key)c[a[i+2]]++;if(c.T+c.X<6)return null;const p=(c.T+2)/(c.T+c.X+4);return this.sideFromP(p,.10)}
  markov3(h){const a=this.tx(h);if(a.length<50)return null;const key=a.slice(-3).join(''),c={T:0,X:0};for(let i=0;i+3<a.length;i++)if(a[i]+a[i+1]+a[i+2]===key)c[a[i+3]]++;if(c.T+c.X<5)return null;const p=(c.T+1.5)/(c.T+c.X+3);return this.sideFromP(p,.12)}
  bridge4(h){const a=this.tx(h);if(a.length<45)return null;const target=a.slice(-4),c={T:0,X:0};let matches=0;for(let i=0;i+4<a.length;i++){let m=0;for(let j=0;j<4;j++)if(a[i+j]===target[j])m++;if(m>=3){const age=a.length-(i+4);const w=(m/4)**2/(1+Math.log1p(age));c[a[i+4]]+=w;matches++}}if(matches<3)return null;const p=(c.T+1)/(c.T+c.X+2);return this.sideFromP(p,.13)}
  runStructure(h){const a=this.tx(h);if(a.length<30)return null;const rs=this.runs(a),last=rs.at(-1),recent=rs.slice(-10),lens=recent.map(r=>r.n),m=avg(lens),s=std(lens);if(last.n>=Math.max(3,m+s*.9))return last.v; if(last.n===1&&recent.length>=6){const alt=recent.slice(-6);let alternating=true;for(let i=1;i<alt.length;i++)if(alt[i].v===alt[i-1].v)alternating=false;if(alternating)return opposite(last.v)}return null}
  scoreRegime(h){const a=this.rows(h).map(r=>r.total);if(a.length<35)return null;const r=a.slice(-40),m=avg(r),s=std(r),p=this.pT(r,4);if(s<1.5&&m>=12)return'T';if(s<1.5&&m<=9)return'X';return this.sideFromP(p,.115)}
  diceStructure(h){const rs=this.rows(h);if(rs.length<50)return null;const recent=rs.slice(-25),scoreMean=avg(recent.map(r=>r.total));let expected=0;for(let pos=0;pos<3;pos++){const f=this.stats.faces[pos],n=Object.values(f).reduce((a,b)=>a+b,0)||1;let e=0;for(let d=1;d<=6;d++)e+=d*(f[d]||0)/n;expected+=e}const parity=recent.filter(r=>(r.dice.reduce((a,b)=>a+b,0)%2)===0).length/recent.length;const blended=.68*scoreMean+.32*expected; if(blended>=11.5&&parity>.46)return'T';if(blended<=9.5&&parity<.54)return'X';return null}

  fitInitial(h){const rs=this.rows(h);if(rs.length<60)return;for(const [id] of this.signals){let hit=0,n=0;for(let i=35;i<rs.length;i++){const p=this.signal(id,rs.slice(0,i));if(!p)continue;n++;if(p===rs[i].tx)hit++}const acc=n?(hit+2)/(n+4):.5;this.reliability[id]=clamp(acc,.42,.68);this.weights[id]=clamp(.65+(acc-.5)*3.2,.35,1.45)}this.normalizeWeights()}
  signal(id,h){const s=this.signals.find(x=>x[0]===id);return s?s[2](h):null}
  normalizeWeights(){const sum=Object.values(this.weights).reduce((a,b)=>a+b,0)||1;for(const id of Object.keys(this.weights))this.weights[id]=Math.max(this.minWeight,this.weights[id]/sum*Object.keys(this.weights).length)}
  updateOutcome(prefix,actual){if(!this.valid(actual))return;for(const [id] of this.signals){const p=this.signal(id,prefix);if(!p)continue;const r=this.reliability[id]??.5;const correct=p===actual;this.reliability[id]=clamp(r+(correct?.015:-.011),.35,.72);const w=this.weights[id]||this.minWeight;this.weights[id]=clamp(w*(correct?1+this.learning:1-this.learning*.7),this.minWeight,2)}this.normalizeWeights()}

  predict(h){
    const rs=this.rows(h),a=rs.map(r=>r.tx);if(a.length<35)return this.abstain(a.length,'insufficient_data','Cần tối thiểu khoảng 35 phiên hợp lệ');
    const votes={T:0,X:0},details=[];for(const [id,prior] of this.signals){const p=this.signal(id,rs);if(!p)continue;const w=(this.weights[id]||this.minWeight)*prior*(.75+this.reliability[id]);votes[p]+=w;details.push({id,side:p,weight:Number(w.toFixed(4)),reliability:Number((this.reliability[id]||.5).toFixed(3))})}
    const total=votes.T+votes.X;if(!total)return this.abstain(a.length,'no_signal','Không có tín hiệu đủ mạnh');
    const side=votes.T>=votes.X?'T':'X',edge=Math.abs(votes.T-votes.X)/total,active=details.length;
    const recent=a.slice(-30),ent=entropy(recent),regime=ent>.97?'RANDOM_LIKE':ent<.78?'STRUCTURED':'MIXED';
    const agreement=details.filter(x=>x.side===side).length/Math.max(1,active);
    const sample=clamp((a.length-35)/165,0,1),reliability=details.length?avg(details.map(x=>x.reliability)):.5;
    let confidence=.505+edge*.31+agreement*.075+sample*.035+(reliability-.5)*.18;
    if(regime==='RANDOM_LIKE')confidence-=.035;
    confidence=clamp(confidence,.50,.79);
    // Strict stop: no prediction unless both edge and independent agreement are meaningful.
    const strong=edge>=.155&&active>=3&&agreement>=.60&&confidence>=.57&&regime!=='RANDOM_LIKE';
    const reason=strong?`${active} tín hiệu • đồng thuận ${(agreement*100).toFixed(0)}% • edge ${(edge*100).toFixed(1)}% • ${regime}`:'Tín hiệu chưa đủ đồng thuận — hệ thống chủ động đứng ngoài';
    return{prediction:strong?(side==='T'?'TÀI':'XỈU'):'CHƯA ĐỦ TÍN HIỆU',confidence:strong?confidence:Math.min(confidence,.55),scorePrediction:strong?this.scorePrediction(rs,side):[],meta:{regime,votedBy:active,agreement:Number(agreement.toFixed(3)),edge:Number(edge.toFixed(4)),sampleSize:a.length,abstained:!strong,reason,signals:details,method:'walk-forward + online reliability + cầu 4 + Markov 2/3 + cấu trúc xúc xắc'}}
  }
  abstain(n,regime,reason){return{prediction:'CHƯA ĐỦ TÍN HIỆU',confidence:.5,scorePrediction:[],meta:{regime,votedBy:0,agreement:0,edge:0,sampleSize:n,abstained:true,reason}}}
  scorePrediction(rs,side){const range=side==='T'?[11,12,13,14,15,16,17,18]:[3,4,5,6,7,8,9,10],sc=Object.fromEntries(range.map(x=>[x,1]));for(let i=0;i<rs.length-1;i++){if(rs[i].tx!==side)continue;const age=rs.length-1-i,w=1/Math.sqrt(age+1);if(sc[rs[i+1].total]!=null)sc[rs[i+1].total]+=w}return range.sort((a,b)=>sc[b]-sc[a]).slice(0,3)}
}

const engine=new AnhKhoiSicboEngineV22();
let history=[],currentSessionId=null,prediction=null,fetchInFlight=false,lastFetchStarted=0;
let dataStatus={ok:false,lastSuccess:0,error:null,source:'UPSTREAM'};
let dashboardHTML='';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function loadDashboard(){dashboardHTML=await fs.readFile(path.join(__dirname,'dashboard.html'),'utf8');if(!dashboardHTML.includes('ANH KHÔI'))throw new Error('dashboard.html missing ANH KHÔI branding')}
async function fetchJson(url,timeout){const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{signal:c.signal,headers:{accept:'application/json','user-agent':'ANH-KHOI-SICBO/22'}});if(!r.ok)throw new Error(`Upstream HTTP ${r.status}`);return await r.json()}finally{clearTimeout(timer)}}
function rebuild(parsed){history=parsed.slice(-MAX_HISTORY);engine.reset();for(const r of history)engine.updateStats(r);engine.fitInitial(history);currentSessionId=history.at(-1)?.session??null;prediction=history.length?engine.predict(history):null}
async function fetchAndUpdate(){if(fetchInFlight)return;const now=Date.now();if(now-lastFetchStarted<850)return;fetchInFlight=true;lastFetchStarted=now;try{const raw=await fetchJson(API_URL,FETCH_TIMEOUT_MS),parsed=engine.parse(raw);if(!parsed.length)throw new Error('Nguồn không có phiên hợp lệ');const newest=parsed.at(-1);if(currentSessionId===null)rebuild(parsed);else if(newest.session>currentSessionId){const incoming=parsed.filter(r=>r.session>currentSessionId);for(const r of incoming){const prefix=history.slice();history.push(r);engine.updateStats(r);engine.updateOutcome(prefix,r.tx)}history=history.slice(-MAX_HISTORY);currentSessionId=history.at(-1)?.session??currentSessionId;prediction=engine.predict(history)}else if(!prediction)prediction=engine.predict(history);dataStatus={ok:true,lastSuccess:Date.now(),error:null,source:'UPSTREAM'}}catch(e){dataStatus={...dataStatus,ok:false,error:String(e?.message||e),source:'UPSTREAM'};console.error('[DATA]',dataStatus.error)}finally{fetchInFlight=false}}
function json(res,status,obj){const b=JSON.stringify(obj);res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'content-type'});res.end(b)}
function payload(){const last=history.at(-1),prev=history.at(-2),p=prediction;return{ok:Boolean(last),id:'ANH KHÔI',mode:'LIVE',sourceStatus:dataStatus,phien_hien_tai:last?{session:last.session,dice:last.dice,total:last.total,result:last.result,tx:last.tx}:null,phien_truoc:prev?{session:prev.session,dice:prev.dice,total:prev.total,result:prev.result,tx:prev.tx}:null,du_doan:p?.prediction||'CHƯA ĐỦ TÍN HIỆU',do_tin_cay:Math.round((p?.confidence??.5)*100),du_doan_vi:p?.scorePrediction||[],regime:p?.meta?.regime||'--',voted_by:p?.meta?.votedBy||0,meta:p?.meta||{}}}
const server=http.createServer((req,res)=>{const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'content-type'});return res.end()}if(req.method!=='GET')return json(res,405,{ok:false,error:'Method Not Allowed'});if(u.pathname==='/health')return json(res,200,{ok:true,service:'ANH KHÔI CORE v22',uptime:process.uptime(),data:dataStatus,history:history.length});if(u.pathname==='/api/sicbo/sunwin')return json(res,200,payload());if(u.pathname==='/api/sicsun/history')return json(res,200,{ok:true,data:[...history].reverse().slice(0,100).map((h,i)=>({idx:i+1,session:h.session,dice:h.dice,total:h.total,result:h.result,tx:h.tx}))});if(u.pathname==='/'||u.pathname==='/dashboard.html'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});return res.end(dashboardHTML)}return json(res,404,{ok:false,error:'Not Found'})});

async function start(){await loadDashboard();server.on('error',e=>console.error('[SERVER]',e));server.listen(PORT,'0.0.0.0',()=>{console.log(`ANH KHÔI CORE v22 running on port ${PORT}`);void fetchAndUpdate();setInterval(()=>void fetchAndUpdate(),1000).unref();setInterval(()=>{if(history.length)prediction=engine.predict(history)},1000).unref()})}
process.on('unhandledRejection',e=>console.error('[PROCESS] unhandledRejection',e));
process.on('uncaughtException',e=>console.error('[PROCESS] uncaughtException',e));
start().catch(e=>console.error('[BOOT]',e));
