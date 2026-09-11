import Fastify from 'fastify';
import cors from '@fastify/cors';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fetch from 'node-fetch';
import { SeiuEngineV18 } from './seiu-engine-v18.js';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||3000);
const API_URL='https://api.wsktnus8.net/v2/history/getLastResult?gameId=ktrng_3979&size=100&tableId=39791215743193&curPage=1';
const engine=new SeiuEngineV18();
const app=Fastify({logger:false,bodyLimit:1024*1024});

let dashboardHTML='';
let history=[];
let currentSessionId=null;
let prediction=null;
let lastFetchTime=0;
let fetchInFlight=false;
let dataStatus={ok:false,lastSuccess:0,error:null};

const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function loadDashboard(){
  dashboardHTML=await fs.readFile(path.join(__dirname,'dashboard.html'),'utf8');
  if(!dashboardHTML.includes('ANH KHÔI')) throw new Error('dashboard.html không hợp lệ');
}

async function fetchAndUpdate(){
  if(fetchInFlight)return;
  const now=Date.now();
  if(now-lastFetchTime<900)return;
  fetchInFlight=true;lastFetchTime=now;
  const ctrl=new AbortController();const timeout=setTimeout(()=>ctrl.abort(),7000);
  try{
    const res=await fetch(API_URL,{signal:ctrl.signal,headers:{accept:'application/json'}});
    if(!res.ok)throw new Error(`Upstream HTTP ${res.status}`);
    const data=await res.json();
    const parsed=engine.parseLines(data);
    if(!parsed.length)throw new Error('Upstream không trả về dữ liệu hợp lệ');
    const last=parsed.at(-1);
    if(currentSessionId===null){
      history=parsed.slice(-500);
      for(const r of history)engine.updateStats(r);
      engine.fitInitial(history);
      currentSessionId=last.session;
      prediction=engine.predict(history);
    }else if(last.session>currentSessionId){
      const newRecords=parsed.filter(r=>r.session>currentSessionId);
      for(const r of newRecords){
        const prefix=history.slice();
        history.push(r);
        engine.updateStats(r);
        engine.updateOutcome(prefix,r.tx);
      }
      history=history.slice(-500);
      currentSessionId=last.session;
      prediction=engine.predict(history);
    }
    if(!prediction&&history.length)prediction=engine.predict(history);
    dataStatus={ok:true,lastSuccess:Date.now(),error:null};
  }catch(e){
    dataStatus={...dataStatus,ok:false,error:String(e?.message||e)};
    console.error(`[DATA] ${dataStatus.error}`);
  }finally{
    clearTimeout(timeout);fetchInFlight=false;
  }
}

function apiPayload(){
  const last=history.at(-1),prev=history.at(-2),p=prediction;
  return{
    ok:Boolean(last&&p),
    id:'ANH KHÔI',
    mode:'LIVE',
    sourceStatus:dataStatus,
    phien_hien_tai:last?{session:last.session,dice:last.dice,total:last.total,result:last.result,tx:last.tx}:null,
    phien_truoc:prev?{session:prev.session,dice:prev.dice,total:prev.total,result:prev.result,tx:prev.tx}:null,
    du_doan:p?.prediction||'CHƯA ĐỦ TÍN HIỆU',
    do_tin_cay:Math.round((p?.confidence||.5)*100),
    du_doan_vi:p?.scorePrediction||[],
    regime:p?.meta?.regime||'--',
    voted_by:p?.meta?.votedBy||0,
    meta:p?.meta||{}
  };
}

app.register(cors,{origin:true});
app.get('/health',async()=>({ok:true,service:'ANH KHÔI CORE',uptime:process.uptime(),data:dataStatus}));
app.get('/api/sicbo/sunwin',async()=>apiPayload());
app.get('/api/sicsun/history',async()=>({ok:true,data:[...history].reverse().slice(0,100).map((h,idx)=>({idx:idx+1,session:h.session,dice:h.dice,total:h.total,result:h.result,tx:h.tx}))}));
app.get('/',async(req,reply)=>reply.type('text/html; charset=utf-8').send(dashboardHTML));
app.get('/dashboard.html',async(req,reply)=>reply.type('text/html; charset=utf-8').send(dashboardHTML));

async function start(){
  await loadDashboard();
  // Listen first so a slow/dead upstream API can never block page startup.
  let attempt=0;
  while(true){
    try{
      await app.listen({port:PORT,host:'0.0.0.0'});
      console.log(`ANH KHÔI CORE running on ${PORT}`);
      break;
    }catch(err){
      attempt++;
      console.error(`[SERVER] listen attempt ${attempt} failed: ${err?.message||err}`);
      await sleep(Math.min(5000,500+attempt*500));
    }
  }
  fetchAndUpdate();
  setInterval(fetchAndUpdate,1000).unref?.();
  setInterval(()=>{if(history.length)prediction=engine.predict(history)},1000).unref?.();
}

process.on('unhandledRejection',err=>console.error('[PROCESS] unhandledRejection:',err));
process.on('uncaughtException',err=>console.error('[PROCESS] uncaughtException:',err));

start().catch(err=>{console.error('[BOOT]',err);/* Deliberately no process.exit(1). */});
