/*
 * ANH KHÔI CORE ENGINE v20
 * Conservative, deterministic ensemble for historical Tài/Xỉu data.
 * Historical data cannot guarantee a future random outcome.
 */
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const sum=a=>a.reduce((x,y)=>x+y,0);
const avg=a=>a.length?sum(a)/a.length:0;
const std=a=>{if(!a.length)return 0;const m=avg(a);return Math.sqrt(avg(a.map(v=>(v-m)**2)))};
const entropy=a=>{if(!a.length)return 0;const f={};for(const v of a)f[v]=(f[v]||0)+1;return Object.values(f).reduce((e,n)=>{const p=n/a.length;return e-p*Math.log2(p)},0)};

export class SeiuEngineV18{
  constructor(){
    this.minWeight=.001;this.learningRate=.18;this.weights={};this.perfHistory={};
    this.stats={totalCount:0,taiCount:0,xiuCount:0,scores:Object.fromEntries(Array.from({length:16},(_,i)=>[i+3,0])),dicePos:[{},{},{}]};
    this.algs=[
      {id:'base_rate',fn:this.baseRate.bind(this),prior:1},
      {id:'recent_rate',fn:this.recentRate.bind(this),prior:1},
      {id:'markov2',fn:this.markov2.bind(this),prior:1},
      {id:'pattern',fn:this.pattern.bind(this),prior:.95},
      {id:'run_regime',fn:this.runRegime.bind(this),prior:.9},
      {id:'score_model',fn:this.scoreModel.bind(this),prior:1}
    ];
    for(const a of this.algs){this.weights[a.id]=1;this.perfHistory[a.id]=[]}
  }
  parseLines(data){
    const list=data?.data?.resultList;if(!Array.isArray(list))return[];const out=[];
    for(const item of list){
      const rawId=String(item?.gameNum??'');const session=Number(rawId.replace(/\D/g,''));if(!Number.isFinite(session))continue;
      const dice=Array.isArray(item?.facesList)?item.facesList.map(Number):(typeof item?.keyR==='string'?item.keyR.split('-').map(Number):[]);
      if(dice.length!==3||dice.some(d=>!Number.isInteger(d)||d<1||d>6))continue;
      const calculated=dice.reduce((a,b)=>a+b,0);const reported=Number(item?.score);const total=Number.isInteger(reported)&&reported>=3&&reported<=18?reported:calculated;
      const tx=total>=11?'T':'X';out.push({session,dice,total,result:tx==='T'?'TAI':'XIU',tx});
    }
    out.sort((a,b)=>a.session-b.session);return out;
  }
  updateStats(r){if(!r||(r.tx!=='T'&&r.tx!=='X'))return;this.stats.totalCount++;r.tx==='T'?this.stats.taiCount++:this.stats.xiuCount++;this.stats.scores[r.total]=(this.stats.scores[r.total]||0)+1;for(let i=0;i<3;i++)this.stats.dicePos[i][r.dice[i]]=(this.stats.dicePos[i][r.dice[i]]||0)+1}
  extractTx(hist){return(hist||[]).filter(h=>h&&(h.tx==='T'||h.tx==='X')).map(h=>h.tx)}
  extractTotals(hist){return(hist||[]).filter(h=>h&&Number.isFinite(h.total)).map(h=>h.total)}
  counts(tx){let t=0,x=0;for(const v of tx)v==='T'?t++:x++;return{t,x,n:t+x}}
  sideProb(c,s=1){return(c.t+s)/(c.n+s*2)}
  baseRate(hist){const tx=this.extractTx(hist);if(tx.length<12)return null;const p=this.sideProb(this.counts(tx),4);return Math.abs(p-.5)>=.055?(p>.5?'T':'X'):null}
  recentRate(hist){const tx=this.extractTx(hist);if(tx.length<10)return null;const p=this.sideProb(this.counts(tx.slice(-Math.min(28,tx.length))),3);return Math.abs(p-.5)>=.075?(p>.5?'T':'X'):null}
  markov2(hist){const tx=this.extractTx(hist);if(tx.length<24)return null;const key=tx.at(-2)+tx.at(-1),c={T:0,X:0};for(let i=0;i<tx.length-2;i++)if(tx[i]+tx[i+1]===key)c[tx[i+2]]++;return c.T+c.X>=5&&Math.abs(c.T-c.X)>=2?(c.T>c.X?'T':'X'):null}
  pattern(hist){const tx=this.extractTx(hist);if(tx.length<30)return null;let best=null,n=0,bestSim=0;for(const k of[3,4,5,6]){if(tx.length<=k+4)continue;const target=tx.slice(-k);for(let i=0;i<=tx.length-k-1;i++){let same=0;for(let j=0;j<k;j++)if(tx[i+j]===target[j])same++;const sim=same/k;if(sim<.8)continue;const next=tx[i+k];if(!best||sim>bestSim||Math.abs(sim-bestSim)<.08){if(!best||sim>bestSim){best={T:0,X:0};n=0;bestSim=sim}best[next]++;n++}}}return best&&n>=3&&Math.abs(best.T-best.X)>=1?(best.T>best.X?'T':'X'):null}
  runRegime(hist){const tx=this.extractTx(hist);if(tx.length<24)return null;const runs=[];let cur=tx[0],len=1;for(let i=1;i<tx.length;i++){if(tx[i]===cur)len++;else{runs.push({v:cur,n:len});cur=tx[i];len=1}}runs.push({v:cur,n:len});const recent=runs.slice(-8),last=runs.at(-1),lens=recent.map(r=>r.n),m=avg(lens),s=std(lens);if(last.n>=Math.max(4,m+s*1.2))return last.v;if(last.n===1&&recent.length>=4){const alt=recent.filter((r,i)=>i===0||r.v!==recent[i-1].v).length;if(alt>=recent.length-1&&recent.at(-2).n>=2)return last.v==='T'?'X':'T'}return null}
  scoreModel(hist){const totals=this.extractTotals(hist);if(totals.length<30)return null;const recent=totals.slice(-30),m=avg(recent),s=std(recent);if(s<1.45&&m>=12)return'T';if(s<1.45&&m<=9)return'X';const tail=totals.slice(-60),high=tail.filter(v=>v>=11).length/tail.length;return Math.abs(high-.5)>=.1?(high>.5?'T':'X'):null}
  scorePrediction(hist,side){const tx=this.extractTx(hist),totals=this.extractTotals(hist),range=side==='T'?[11,12,13,14,15,16,17,18]:[3,4,5,6,7,8,9,10];if(!totals.length)return range.slice(0,3);const scores={};for(const s of range)scores[s]=1;for(let i=0;i<tx.length-1;i++)if(tx[i]===side&&scores[totals[i+1]]!==undefined)scores[totals[i+1]]++;return range.sort((a,b)=>scores[b]-scores[a]||Math.abs(a-9.5)-Math.abs(b-9.5)).slice(0,3)}
  fitInitial(hist){const data=this.extractTx(hist);if(data.length<20)return;const scores={};for(const a of this.algs)scores[a.id]=0;let evaluated=0;for(let i=16;i<data.length;i++){const prefix=hist.filter(h=>h.tx==='T'||h.tx==='X').slice(0,i),actual=data[i];for(const a of this.algs){const p=a.fn(prefix);if(p)scores[a.id]+=p===actual?1:0}evaluated++}let total=0;for(const a of this.algs){const acc=evaluated?scores[a.id]/evaluated:.5;this.weights[a.id]=Math.max(this.minWeight,a.prior*(.25+acc));this.perfHistory[a.id]=[];total+=this.weights[a.id]}for(const id in this.weights)this.weights[id]/=total||1}
  updateOutcome(prefix,actual){if(actual!=='T'&&actual!=='X')return;for(const a of this.algs){const p=a.fn(prefix);if(!p)continue;const correct=p===actual,curr=this.weights[a.id]||this.minWeight,factor=correct?1+this.learningRate:1-this.learningRate*.75;this.weights[a.id]=clamp(curr*factor,this.minWeight,.85);const h=this.perfHistory[a.id];h.push(correct?1:0);if(h.length>80)h.shift()}const total=Object.values(this.weights).reduce((a,b)=>a+b,0)||1;for(const id in this.weights)this.weights[id]/=total}
  predict(hist){
    const tx=this.extractTx(hist);if(tx.length<12)return{prediction:'CHƯA ĐỦ TÍN HIỆU',confidence:.5,scorePrediction:[],meta:{regime:'insufficient_data',votedBy:0,abstained:true,edge:0,sampleSize:tx.length,reason:'Cần thêm dữ liệu lịch sử'}};
    const votes={T:0,X:0},voters=[];for(const a of this.algs){const p=a.fn(hist);if(!p)continue;votes[p]+=(this.weights[a.id]||this.minWeight)*a.prior;voters.push(a.id)}const total= votes.T+votes.X;if(!total)return{prediction:'CHƯA ĐỦ TÍN HIỆU',confidence:.5,scorePrediction:[],meta:{regime:'no_consensus',votedBy:0,abstained:true,edge:0,sampleSize:tx.length,reason:'Không có mô hình đạt ngưỡng tín hiệu'}};
    const side=votes.T>=votes.X?'T':'X',edge=Math.abs(votes.T-votes.X)/total,recent=tx.slice(-30),pRecent=this.sideProb(this.counts(recent),3),evidence=Math.min(1,voters.length/4),sampleFactor=clamp((tx.length-12)/48,0,1),penalty=Math.max(0,.08-Math.abs(pRecent-.5))*.35;let confidence=.5+edge*.34+evidence*.06+sampleFactor*.04-penalty;confidence=clamp(confidence,.5,.72);const abstain=edge<.1||(voters.length<2&&edge<.18)||confidence<.55;const regime=entropy(recent)>.97?'balanced':entropy(recent)<.75?'structured':'neutral';
    return{prediction:abstain?'CHƯA ĐỦ TÍN HIỆU':side==='T'?'TÀI':'XỈU',confidence:abstain?Math.min(confidence,.54):confidence,scorePrediction:abstain?[]:this.scorePrediction(hist,side),meta:{regime,votedBy:new Set(voters).size,abstained:abstain,edge:Number(edge.toFixed(4)),sampleSize:tx.length,reason:abstain?'Biên tín hiệu thấp — hệ thống chủ động dừng':`Consensus ${new Set(voters).size} mô hình`}}
  }
}
