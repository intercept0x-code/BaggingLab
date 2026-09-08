(()=>{
'use strict';
const boot=document.getElementById('bootState'); if(boot){boot.textContent='App architecture loaded';boot.className='badge good';}
window.addEventListener('error',e=>{const s=document.getElementById('status'); if(s){s.textContent='Runtime error: '+(e.message||'unknown error');s.classList.add('bad');}});

const $=id=>document.getElementById(id), $$=q=>[...document.querySelectorAll(q)];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)), avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0, pct=(k,n)=>n?100*k/n:0, fmt=(x,d=1)=>Number(x).toFixed(d);
const RNG=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const normal=r=>{let u=0,v=0;while(!u)u=r();while(!v)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(6.283185307*v)};
const hash=(a,b)=>(Math.imul(a^((b+1)*374761393),2654435761)>>>0)||1;

const MODEL='MK-DIRS-V2-standalone-full-1.0';
const TRACK={
  balanced:{L:3000,box:185,noise:1,tech:1},
  technical:{L:3000,box:205,noise:.85,tech:1.55},
  item:{L:2920,box:145,noise:1.15,tech:.9},
  straight:{L:3200,box:220,noise:.75,tech:.8},
  pack:{L:2820,box:168,noise:1.05,tech:1}
};
const V1R=[99,99,99,99,14,12,10,8.5,7,6,5,4];
const V2D=[999,999,999,999,430,370,315,265,225,190,160,135];
const COST={Bullet:.25,Lightning:.30,Golden:.18,Star:.12,'Triple Reds':.10,'Triple Mushrooms':.08,Boo:.06,Red:.035,Mushroom:.025,'Bob-omb':.03,Blue:.10};
const STR=['Bagger','Frontrunner','Adaptive','Racer'];
const AIS=['','classic','stop','pulse','late','farmer','opportunistic'];
const ITEMS=['','Bullet','Lightning','Golden','Blue','Triple Reds','Star','Triple Mushrooms','Boo','Red','Mushroom','Green','Banana','Coin','Bob-omb','Triple Greens'];

let archive=null, compactChunks=[], chunkIndex=0;

function cfg(){
  let baggers=clamp(+$('baggers').value||0,0,8), fronts=clamp(+$('fronts').value||0,0,8);
  if(baggers+fronts>10)fronts=10-baggers;
  let capture=$('capture').value, races=clamp(+$('races').value||300,50,3000);
  if(capture==='frame' && races>100){races=100;$('races').value=100;$('status').textContent='Full-frame capture is capped at 100 paired races to protect browser memory.'}
  return {
    races,seed:clamp(+$('seed').value||2408,1,99999999),baggers,fronts,
    track:$('track').value,skill:$('skill').value,bagAI:$('bagAI').value,
    chaos:+$('chaos').value,pack:+$('pack').value,blue:+$('blue').value,
    lapAccel:+$('lapAccel').value,v1Strict:+$('v1Strict').value,
    distanceReq:+$('distanceReq').value,effortSens:+$('effortSens').value,
    creditSpend:+$('creditSpend').value,grace:+$('grace').value,capture
  };
}
function skillValue(r,k,i){
  if(k==='equal')return clamp(.67+normal(r)*.055,.48,.85);
  if(k==='elite')return clamp(.81+normal(r)*.065,.62,.98);
  if(k==='split')return i%2?clamp(.39+normal(r)*.08,.12,.59):clamp(.84+normal(r)*.055,.68,.98);
  return clamp(.56+normal(r)*.18,.10,.98);
}
function makeRoster(seed,c){
  const r=RNG(seed),types=[];
  for(let i=0;i<c.baggers;i++)types.push('Bagger');
  for(let i=0;i<c.fronts;i++)types.push('Frontrunner');
  while(types.length<12)types.push(types.length%3?'Racer':'Adaptive');
  for(let i=11;i>0;i--){let j=Math.floor(r()*(i+1));[types[i],types[j]]=[types[j],types[i]]}
  const hostile=AIS.slice(1);
  return types.map((strategy,i)=>({
    id:i,strategy,
    bagAI:strategy==='Bagger'?(c.bagAI==='mix'?hostile[Math.floor(r()*hostile.length)]:c.bagAI):'',
    skill:skillValue(r,c.skill,i),
    itemSkill:clamp(.52+normal(r)*.18,.08,.98),
    consistency:clamp(.64+normal(r)*.15,.18,.98),
    aggression:clamp(.50+normal(r)*.20,.08,.96),
    risk:clamp(.50+normal(r)*.20,.08,.98)
  }));
}
function bagIntent(p,f,pos,credit,t){
  if(p.strategy!=='Bagger')return 1;
  if(p.bagAI==='stop')return f<.19&&pos<10?.08:f<.28&&pos<11?.48:1.045;
  if(p.bagAI==='pulse')return f<.36&&pos<10?(Math.floor(t/2)%2?1:.46):1.04;
  if(p.bagAI==='late')return f>.28&&f<.52&&pos<10?.58:1.02;
  if(p.bagAI==='farmer'){if(f<.5&&pos<10)return credit>.62?1.02:.68;return 1.045}
  if(p.bagAI==='opportunistic'){if(f<.48&&pos<8&&credit<.45)return .72;if(pos>=10&&credit>.45)return 1.055;return .96}
  return f<.35?(pos<9?.55:pos<11?.72:.84):1.04;
}
function effortCurve(ratio,sensitivity){
  let q=clamp(1-(1-ratio)*sensitivity,0,1.1);
  if(q>=.9)return clamp(.95+(q-.9)*.5,.95,1);
  if(q>=.8)return .75+(q-.8)*2;
  if(q>=.7)return .40+(q-.7)*3.5;
  if(q>=.6)return .10+(q-.6)*3;
  if(q>=.5)return q-.5;
  return 0;
}
const ceiling=pos=>clamp(.10+Math.pow((pos-1)/11,.92)*.90,.10,1);
function openingItem(r){let a=['Mushroom','Triple Mushrooms','Red','Triple Greens','Bob-omb','Banana'];return a[Math.floor(r()*a.length)]}
function itemFor(power,r){
  const x=r();
  if(power>.82){
    if(x<.12)return'Bullet';
    if(x<.27)return'Lightning';
    if(x<.47)return'Golden';
    if(x<.61)return'Blue';
    if(x<.79)return'Triple Reds';
    return'Star';
  }
  if(power>.64){if(x<.23)return'Star';if(x<.48)return'Triple Mushrooms';if(x<.69)return'Triple Reds';return'Boo'}
  if(power>.42){if(x<.30)return'Red';if(x<.58)return'Mushroom';if(x<.78)return'Green';return'Bob-omb'}
  return x<.46?'Coin':x<.74?'Banana':'Green';
}
function snapshotMarks(capture){
  if(capture==='deep')return Array.from({length:51},(_,i)=>i/50);
  return Array.from({length:11},(_,i)=>i/10);
}

function simulate(roster,c,mode,seed,keepDetails=true){
  const r=RNG(seed),T=TRACK[c.track],dt=.5,marks=snapshotMarks(c.capture);
  const P=roster.map(p=>({...p,x:r()*2,finishTime:0,finalPosition:12,position:12,lastPosition:12,
    erp:12,credit:0,gainStreak:0,validatedLossStreak:0,voluntaryLosses:0,slow:0,graceLeft:0,
    effort:1,effortSum:0,effortSamples:0,creditSpent:0,sacrificeSeconds:0,powerSum:0,itemCount:0,
    hitsTaken:0,lastBox:-1,bagged:false,snapshots:[],frames:[]}));
  const events=[],seen=new Set(); let t=0,finishCount=0,firstSet=true;
  const rank=()=>{P.sort((a,b)=>a.finishTime&&b.finishTime?a.finishTime-b.finishTime:a.finishTime?-1:b.finishTime?1:b.x-a.x||a.id-b.id);P.forEach((p,i)=>p.position=i+1)};
  rank();P.forEach(p=>{p.lastPosition=p.position;p.erp=p.position});

  while(t<220&&P.some(p=>!p.finishTime)){
    rank();
    let med=[...P].sort((a,b)=>a.x-b.x)[5].x;
    for(const p of P){
      if(p.finishTime)continue;
      const lap=Math.min(3,Math.floor(p.x/(T.L/3))+1), frac=p.x/T.L, basePace=25.3+4.05*p.skill;
      let intent=bagIntent(p,frac,p.position,p.credit,t);
      if(p.strategy==='Bagger'&&intent<.9){p.bagged=true;p.sacrificeSeconds+=(1-intent)*dt}
      else if(p.strategy==='Frontrunner')intent=1.035;
      else if(p.strategy==='Adaptive'&&frac<.32&&p.position>=9&&p.credit<.28)intent=.92;

      const slowMult=p.slow>0?.43:1;if(p.slow>0)p.slow=Math.max(0,p.slow-dt);
      const rawRatio=intent*slowMult;
      const effort=p.graceLeft>0?1:effortCurve(rawRatio,c.effortSens);
      if(p.graceLeft>0)p.graceLeft=Math.max(0,p.graceLeft-dt);
      p.effort=effort;p.effortSum+=effort;p.effortSamples++;

      const catchup=p.x<med?Math.min(1.5,(med-p.x)/220)*.72*c.pack*(c.track==='pack'?1.35:1):0;
      const noise=normal(r)*(1-p.consistency)*.72*c.chaos*T.noise;
      const speed=Math.max(2,basePace*intent*slowMult+noise+catchup), dx=speed*dt;
      p.x+=dx;

      if(mode==='v1'){
        if(p.position>=5)p.credit=clamp(p.credit+dt*(1+(lap-1)*c.lapAccel)/(V1R[p.position-1]*c.v1Strict),0,1);
        else p.credit=clamp(p.credit-.006,0,1);
      }
      if(mode==='v2'){
        if(p.position<p.erp)p.erp=p.position;
        if(p.position>p.erp){
          const earned=dx*effort*(1+(lap-1)*c.lapAccel);
          const catchRate=earned/(112*c.distanceReq)*(1+.035*Math.max(0,p.position-5));
          p.erp=Math.min(p.position,p.erp+catchRate);
        }
        if(p.position>=5){
          const earned=dx*effort*(1+(lap-1)*c.lapAccel), rp=clamp(Math.round(p.erp),5,12), req=V2D[rp-1]*c.distanceReq;
          p.credit=clamp(p.credit+earned/req,0,1);
        } else p.credit=clamp(p.credit-.004*dt,0,1);
      }

      let box=Math.floor(p.x/T.box);
      if(box>p.lastBox){
        p.lastBox=box;
        const opening=firstSet&&p.x<265;
        let power,item;
        if(opening){power=.54+r()*.16;item=openingItem(r)}
        else{
          power=mode==='instant'?ceiling(p.position):mode==='v1'?clamp(.10+p.credit*(ceiling(p.position)-.10),.08,1):clamp(.10+p.credit*(ceiling(p.erp)-.10),.08,1);
          item=itemFor(power,r);
        }
        p.powerSum+=power;p.itemCount++;
        let creditCost=0;
        if(mode==='v2'&&!opening){creditCost=(COST[item]||0)*c.creditSpend;p.credit=clamp(p.credit-creditCost,0,1);p.creditSpent+=creditCost}
        let boost=(1.4+10.5*power+4.4*p.itemSkill)*(.65+r()*.7);
        if(item==='Bullet')boost+=30;if(item==='Golden')boost+=17;if(item==='Star')boost+=10;if(item==='Triple Mushrooms')boost+=7;
        p.x+=boost;
        if(keepDetails)events.push({time:t,type:'item_draw',player:p.id,item,position:p.position,erp:p.erp,creditAfter:p.credit,effort,power,creditCost,distance:p.x,lap,opening});

        if(item==='Blue'&&c.blue>0&&r()<.55*Math.min(1.5,c.blue)){
          let q=[...P].filter(z=>!z.finishTime).sort((a,b)=>b.x-a.x)[0];
          if(q&&q.id!==p.id){q.x=Math.max(0,q.x-14-10*r());q.hitsTaken++;q.slow=2.4;q.graceLeft=c.grace;
            if(keepDetails)events.push({time:t,type:'hit',attacker:p.id,target:q.id,item:'Blue',attackerPosition:p.position,targetPosition:q.position,targetGrace:c.grace,distance:q.x})}
        }else if(['Red','Triple Reds','Green','Lightning','Bob-omb'].includes(item)&&r()<(.14+.36*power)*p.aggression*c.chaos){
          let q=P.filter(z=>!z.finishTime&&z.x>p.x&&z.x-p.x<175).sort((a,b)=>a.x-b.x)[0];
          if(q){q.x=Math.max(0,q.x-(2.5+10.5*power)*(.72+r()*.7));q.hitsTaken++;q.slow=item==='Lightning'?2.8:1.8;q.graceLeft=c.grace;
            if(keepDetails)events.push({time:t,type:'hit',attacker:p.id,target:q.id,item,attackerPosition:p.position,targetPosition:q.position,targetGrace:c.grace,distance:q.x})}
        }
      }

      if(r()<.00125*T.tech*c.chaos*(1-p.consistency)){
        p.slow=1.5+r()*1.4;p.graceLeft=c.grace;p.x=Math.max(0,p.x-2-r()*5);
        if(keepDetails)events.push({time:t,type:'track_disruption',player:p.id,position:p.position,grace:c.grace,distance:p.x});
      }
      if(p.x>=T.L){p.x=T.L;p.finishTime=t;p.finalPosition=++finishCount;if(keepDetails)events.push({time:t,type:'finish',player:p.id,finalPosition:p.finalPosition})}
    }

    firstSet=false;rank();

    for(const p of P)if(p.lastPosition!==p.position){
      const delta=p.lastPosition-p.position, from=p.lastPosition,to=p.position;
      if(mode==='v1'){
        if(delta>0){p.gainStreak+=delta;p.validatedLossStreak=0;p.credit=clamp(p.credit+.012*delta*(1+.18*Math.min(6,p.gainStreak)),0,1)}
        else{p.validatedLossStreak+=-delta;p.gainStreak=0;p.credit=clamp(p.credit-.055*(-delta)/(1+.28*Math.min(8,p.validatedLossStreak)),0,1)}
      }
      if(mode==='v2'){
        if(delta>0){p.erp=Math.min(p.erp,p.position);p.gainStreak+=delta;p.validatedLossStreak=0}
        else{
          const loss=-delta,validated=p.effort>=.72||p.graceLeft>0||p.slow>0;
          if(validated){p.validatedLossStreak+=loss;p.credit=clamp(p.credit-.032*loss/(1+.24*Math.min(8,p.validatedLossStreak)),0,1)}
          else{p.validatedLossStreak=0;p.voluntaryLosses+=loss;p.credit=clamp(p.credit-.07*loss,0,1)}
          if(keepDetails)events.push({time:t,type:'position_loss_classified',player:p.id,from,to,validated,effort:p.effort,graceLeft:p.graceLeft,creditAfter:p.credit,erp:p.erp});
        }
      }
      p.lastPosition=p.position;
    }

    const lead=Math.max(...P.map(p=>p.x))/T.L;
    for(const m of marks)if(lead>=m&&!seen.has(m)){
      seen.add(m);rank();
      P.forEach(p=>p.snapshots.push({raceProgress:m,position:p.position,erp:p.erp,credit:p.credit,effort:p.effort,distance:p.x,lap:Math.min(3,Math.floor(p.x/(T.L/3))+1),sacrificeSeconds:p.sacrificeSeconds,voluntaryLosses:p.voluntaryLosses,validatedLossStreak:p.validatedLossStreak,creditSpent:p.creditSpent,hitsTaken:p.hitsTaken}));
    }

    if(c.capture==='frame'&&keepDetails){
      rank();
      P.forEach(p=>p.frames.push({time:t,position:p.position,erp:p.erp,credit:p.credit,effort:p.effort,distance:p.x,lap:Math.min(3,Math.floor(p.x/(T.L/3))+1),sacrificeSeconds:p.sacrificeSeconds,voluntaryLosses:p.voluntaryLosses,creditSpent:p.creditSpent,hitsTaken:p.hitsTaken}));
    }

    t+=dt;
  }

  rank();
  P.forEach((p,i)=>{
    if(!p.finalPosition)p.finalPosition=i+1;
    while(p.snapshots.length<marks.length){
      const m=marks[p.snapshots.length];
      p.snapshots.push({raceProgress:m,position:p.finalPosition,erp:p.erp,credit:p.credit,effort:p.effort,distance:p.x,lap:3,sacrificeSeconds:p.sacrificeSeconds,voluntaryLosses:p.voluntaryLosses,validatedLossStreak:p.validatedLossStreak,creditSpent:p.creditSpent,hitsTaken:p.hitsTaken});
    }
  });

  return{
    seed,mode,trackLength:T.L,
    players:P.sort((a,b)=>a.id-b.id).map(p=>({
      id:p.id,strategy:p.strategy,bagAI:p.bagAI,skill:p.skill,itemSkill:p.itemSkill,consistency:p.consistency,aggression:p.aggression,risk:p.risk,
      finalPosition:p.finalPosition,finishTime:p.finishTime,bagged:p.bagged,sacrificeSeconds:p.sacrificeSeconds,voluntaryLosses:p.voluntaryLosses,
      validatedLossStreak:p.validatedLossStreak,creditSpent:p.creditSpent,hitsTaken:p.hitsTaken,
      averageEffort:p.effortSamples?p.effortSum/p.effortSamples:1,averageItemPower:p.itemCount?p.powerSum/p.itemCount:0,itemCount:p.itemCount,
      snapshots:p.snapshots,frames:c.capture==='frame'?p.frames:undefined
    })),events
  };
}

function aggregate(races,mode){
  const S={};STR.forEach(k=>S[k]={n:0,finish:0,wins:0,top3:0,bottom4:0,power:0,items:0,sacrifice:0,skill:0});
  let bN=0,b3=0,bW=0,bB4=0,gN=0,g4=0,fN=0,f3=0,dN=0,disp=0,pairs=[],bagPairs=[];
  for(const z of races)for(const p of z.players){
    const s=S[p.strategy];s.n++;s.finish+=p.finalPosition;s.skill+=p.skill;s.power+=p.averageItemPower*p.itemCount;s.items+=p.itemCount;s.sacrifice+=p.sacrificeSeconds;
    if(p.finalPosition===1)s.wins++;if(p.finalPosition<=3)s.top3++;if(p.finalPosition>=9)s.bottom4++;
    const half=p.snapshots[Math.floor((p.snapshots.length-1)/2)]?.position||p.finalPosition;
    if(p.strategy==='Bagger'&&p.bagged){bN++;if(p.finalPosition<=3)b3++;if(p.finalPosition===1)bW++;if(p.finalPosition>=9)bB4++;bagPairs.push([p.sacrificeSeconds,p.finalPosition])}
    if(p.strategy!=='Bagger'&&half>=9){gN++;if(p.finalPosition<=4)g4++}
    if(p.strategy!=='Bagger'&&half<=3){fN++;if(p.finalPosition<=3)f3++}
    if(p.strategy!=='Bagger'&&half<=6){dN++;if(p.finalPosition>6&&z.players.some(q=>q.strategy==='Bagger'&&q.finalPosition<p.finalPosition))disp++}
    pairs.push([p.skill,13-p.finalPosition]);
  }
  let mx=avg(pairs.map(x=>x[0])),my=avg(pairs.map(x=>x[1])),nu=0,dx=0,dy=0;
  for(const[x,y]of pairs){nu+=(x-mx)*(y-my);dx+=(x-mx)**2;dy+=(y-my)**2}
  let slope=0;
  if(bagPairs.length>5){let sx=avg(bagPairs.map(x=>x[0])),sy=avg(bagPairs.map(x=>x[1])),a=0,b=0;for(const[x,y]of bagPairs){a+=(x-sx)*(y-sy);b+=(x-sx)**2}slope=b?a/b:0}
  return{mode,strategies:S,baggerTrials:bN,baggerTop3:b3,baggerWins:bW,baggerBottom4:bB4,genuineTrials:gN,genuineTop4:g4,frontTrials:fN,frontTop3:f3,displacementTrials:dN,displacement:disp,skillCorrelation:dx&&dy?nu/Math.sqrt(dx*dy):0,sacrificeSlope:slope};
}
function roi(X){
  const b=X.strategies.Bagger,r=X.strategies.Racer;
  if(!b.n||!r.n)return null;
  return(r.finish/r.n-b.finish/b.n)-((b.skill/b.n-r.skill/r.n)*7.2);
}
function wilson(k,n){
  if(!n)return'—';const z=1.96,p=k/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,m=z*Math.sqrt((p*(1-p)+z*z/(4*n))/n)/d;
  return`${(100*p).toFixed(1)}% · 95% CI ${(100*(c-m)).toFixed(1)}–${(100*(c+m)).toFixed(1)}`;
}
function metricCard(name,I,V1,V2,goal,ci){
  const d=V2-I,good=goal==='down'?d<0:goal==='up'?d>0:Math.abs(d)<5;
  return`<div class="stat"><div class="small muted">${name}</div><div class="num">${V2.toFixed(1)}%</div><div class="tiny muted">Instant ${I.toFixed(1)} · V1 ${V1.toFixed(1)} · V2 ${V2.toFixed(1)}</div><div class="tiny ${good?'good':'warn'}" style="margin-top:5px">${good?'Healthy direction':'Inspect'}</div><div class="tiny muted">${ci}</div></div>`;
}
function compareLine(name,I,V1,V2,note){
  return`<div class="metricline"><div class="metrichead"><span>${name}</span><span>${I.toFixed(1)} → ${V1.toFixed(1)} → <b>${V2.toFixed(1)}</b></span></div><div class="tiny muted">${note}</div></div>`;
}
function gate(name,pass,why){
  return`<div class="gate"><div class="metrichead"><b>${name}</b><span class="pill ${pass?'good':'bad'}">${pass?'PASS':'FAIL'}</span></div><div class="tiny muted" style="margin-top:5px">${why}</div></div>`;
}
function renderSummary(){
  const I=archive.summary.instant,V1=archive.summary.v1,V2=archive.summary.v2;
  const ib=pct(I.baggerTop3,I.baggerTrials),b1=pct(V1.baggerTop3,V1.baggerTrials),b2=pct(V2.baggerTop3,V2.baggerTrials);
  const iw=pct(I.baggerWins,I.baggerTrials),w1=pct(V1.baggerWins,V1.baggerTrials),w2=pct(V2.baggerWins,V2.baggerTrials);
  const i4=pct(I.baggerBottom4,I.baggerTrials),q1=pct(V1.baggerBottom4,V1.baggerTrials),q2=pct(V2.baggerBottom4,V2.baggerTrials);
  const ig=pct(I.genuineTop4,I.genuineTrials),g1=pct(V1.genuineTop4,V1.genuineTrials),g2=pct(V2.genuineTop4,V2.genuineTrials);
  const iff=pct(I.frontTop3,I.frontTrials),f1=pct(V1.frontTop3,V1.frontTrials),f2=pct(V2.frontTop3,V2.frontTrials);
  const id=pct(I.displacement,I.displacementTrials),d1=pct(V1.displacement,V1.displacementTrials),d2=pct(V2.displacement,V2.displacementTrials);
  const r2=roi(V2),checks=[b2<=ib-5,w2<=iw-2,g2>=ig-5,Math.abs(f2-iff)<=8,d2<=id+2,r2==null||r2<0],pass=checks.filter(Boolean).length;

  $('verdict').innerHTML=`<span class="badge">V2 ${pass}/6 design gates</span><h2 style="margin-top:8px">${pass>=5?'V2 is behaving like an anti-bagging system.':pass>=3?'V2 is promising, but still leaking advantage somewhere.':'V2 is failing the design goal in this configuration.'}</h2><p class="muted small">V1 bagger top-3 changed ${(b1-ib)>=0?'+':''}${(b1-ib).toFixed(1)} points vs Instant. V2 changed ${(b2-ib)>=0?'+':''}${(b2-ib).toFixed(1)}.</p>`;
  $('gates').innerHTML=
    gate('Bagging top-3',checks[0],`Target ≤ Instant −5 pts · current Δ ${(b2-ib).toFixed(1)}`)+
    gate('Bagging wins',checks[1],`Target ≤ Instant −2 pts · current Δ ${(w2-iw).toFixed(1)}`)+
    gate('Genuine comeback',checks[2],`Cannot fall >5 pts · current Δ ${(g2-ig).toFixed(1)}`)+
    gate('Frontrunner health',checks[3],`Stay within ±8 pts · current Δ ${(f2-iff).toFixed(1)}`)+
    gate('Collateral displacement',checks[4],`Cannot rise >2 pts · current Δ ${(d2-id).toFixed(1)}`)+
    gate('Bagging ROI',checks[5],`Negative is ideal · current ${r2==null?'—':r2.toFixed(2)+' positions'}`);

  $('metricCards').innerHTML=
    metricCard('Bagger top-3',ib,b1,b2,'down',wilson(V2.baggerTop3,V2.baggerTrials))+
    metricCard('Bagger wins',iw,w1,w2,'down',wilson(V2.baggerWins,V2.baggerTrials))+
    metricCard('Bagger bottom-4',i4,q1,q2,'up',wilson(V2.baggerBottom4,V2.baggerTrials))+
    metricCard('Genuine comeback → top 4',ig,g1,g2,'same',wilson(V2.genuineTop4,V2.genuineTrials))+
    metricCard('Halfway top-3 retained',iff,f1,f2,'same',wilson(V2.frontTop3,V2.frontTrials))+
    metricCard('Non-bagger displacement',id,d1,d2,'down',wilson(V2.displacement,V2.displacementTrials));

  $('bagMetrics').innerHTML=
    compareLine('Top-3 success',ib,b1,b2,'lower is better')+
    compareLine('Win rate',iw,w1,w2,'lower is better')+
    compareLine('Bottom-4 risk',i4,q1,q2,'higher makes bagging a gamble')+
    compareLine('Collateral displacement',id,d1,d2,'lower protects normal racers');

  $('healthMetrics').innerHTML=
    compareLine('Genuine comeback',ig,g1,g2,'preserve near control')+
    compareLine('Frontrunner retention',iff,f1,f2,'avoid both collapse and lock-in')+
    compareLine('Skill ↔ result',I.skillCorrelation*100,V1.skillCorrelation*100,V2.skillCorrelation*100,'moderate change only');

  let rows='';
  for(const X of[I,V1,V2])for(const k of STR){
    const s=X.strategies[k];if(!s.n)continue;
    rows+=`<tr><td>${X.mode}</td><td>${k}</td><td>${(s.finish/s.n).toFixed(2)}</td><td>${wilson(s.wins,s.n)}</td><td>${wilson(s.top3,s.n)}</td><td>${wilson(s.bottom4,s.n)}</td><td>${s.items?(100*s.power/s.items).toFixed(0)+'%':'—'}</td><td>${k==='Bagger'?(s.sacrifice/s.n).toFixed(1)+'s':'—'}</td></tr>`;
  }
  $('strategyRows').innerHTML=rows;

  const rI=roi(I),r1=roi(V1);
  $('roiBox').innerHTML=`<div class="stat" style="border:0;padding:0"><div class="num">${r2==null?'—':(r2>=0?'+':'')+r2.toFixed(2)}</div><p class="small muted">Skill-adjusted expected-position advantage for V2 baggers. Negative is ideal.</p><div class="tiny muted">Instant ${rI==null?'—':rI.toFixed(2)} · V1 ${r1==null?'—':r1.toFixed(2)}</div></div>`;
  $('slopeBox').innerHTML=`<div class="stat" style="border:0;padding:0"><div class="num">${V2.sacrificeSlope>=0?'+':''}${V2.sacrificeSlope.toFixed(2)}</div><p class="small muted">Finish-position change per simulated second sacrificed. Positive means more sacrifice tends to hurt.</p><div class="tiny muted">V1 ${V1.sacrificeSlope>=0?'+':''}${V1.sacrificeSlope.toFixed(2)}</div></div>`;
  $('skillBox').innerHTML=`<div class="stat" style="border:0;padding:0"><div class="num">${(V2.skillCorrelation*100).toFixed(1)}%</div><p class="small muted">V2 correlation between driving skill and final result.</p><div class="tiny muted">Instant ${(I.skillCorrelation*100).toFixed(1)}% · V1 ${(V1.skillCorrelation*100).toFixed(1)}%</div></div>`;
}

function lineChart(series,minY,maxY,labels,invert=false){
  const colors=['var(--s1)','var(--s2)','var(--s3)'],w=100,h=28,pad=2;
  const ymap=v=>invert?pad+(h-2*pad)*(v-minY)/(maxY-minY||1):pad+(h-2*pad)*(maxY-v)/(maxY-minY||1);
  let grid='';
  for(let i=0;i<=4;i++){let x=i*25;grid+=`<line x1="${x}" y1="${pad}" x2="${x}" y2="${h-pad}" stroke="var(--border)" stroke-width=".18"/>`}
  let paths=series.map((arr,i)=>`<polyline points="${arr.map(q=>`${q[0]*100},${ymap(q[1])}`).join(' ')}" fill="none" stroke="${colors[i]}" stroke-width=".72" vector-effect="non-scaling-stroke"/>`).join('');
  let legend=labels.map((x,i)=>`<span class="key"><span class="sw" style="background:${colors[i]}"></span>${x}</span>`).join('');
  return`<svg viewBox="0 0 ${w} ${h}" style="width:100%;display:block">${grid}${paths}</svg><div class="chartlegend">${legend}</div>`;
}
function currentRace(){
  if(!archive)return null;
  return archive.races[$('inspectMode').value][+$('racePick').value||0];
}
function initInspector(){
  if(!archive)return;
  $('racePick').innerHTML=archive.races.v2.map((_,i)=>`<option value="${i}">Race ${i+1}</option>`).join('');
  renderRaceInspector();
}
function renderRaceInspector(){
  const z=currentRace();if(!z)return;
  const old=$('playerPick').value;
  $('playerPick').innerHTML=z.players.map(p=>`<option value="${p.id}">P${p.id+1} · ${p.strategy}${p.bagAI?' / '+p.bagAI:''}</option>`).join('');
  if(old&&z.players.some(p=>p.id==old))$('playerPick').value=old;
  renderPlayerInspector();
  renderHeatmap();
}
function renderPlayerInspector(){
  const z=currentRace();if(!z)return;
  const p=z.players.find(x=>x.id==+$('playerPick').value)||z.players[0];
  $('playerFacts').innerHTML=`<h2>Player facts</h2><div class="metricline">Strategy <b style="float:right">${p.strategy}${p.bagAI?' / '+p.bagAI:''}</b></div><div class="metricline">Skill <b style="float:right">${(p.skill*100).toFixed(0)}%</b></div><div class="metricline">Finish <b style="float:right">${p.finalPosition}</b></div><div class="metricline">Average effort <b style="float:right">${(p.averageEffort*100).toFixed(0)}%</b></div><div class="metricline">Sacrifice <b style="float:right">${p.sacrificeSeconds.toFixed(1)}s</b></div><div class="metricline">Voluntary losses <b style="float:right">${p.voluntaryLosses}</b></div><div class="metricline">Credit spent <b style="float:right">${(p.creditSpent*100).toFixed(0)}</b></div><div class="metricline">Hits taken <b style="float:right">${p.hitsTaken}</b></div><div class="metricline">Avg item power <b style="float:right">${(p.averageItemPower*100).toFixed(0)}%</b></div>`;
  $('raceContext').innerHTML=`<div class="metricline">System <b style="float:right">${z.mode}</b></div><div class="metricline">Simulation seed <b style="float:right">${z.seed}</b></div><div class="metricline">Track length <b style="float:right">${z.trackLength}</b></div><div class="metricline">Events in race <b style="float:right">${z.events.length}</b></div><div class="metricline">Snapshots / player <b style="float:right">${p.snapshots.length}</b></div><div class="metricline">Frame trace <b style="float:right">${p.frames?p.frames.length+' frames':'not captured'}</b></div>`;

  const actual=p.snapshots.map(s=>[s.raceProgress,s.position]),erp=p.snapshots.map(s=>[s.raceProgress,s.erp]);
  $('erpChart').innerHTML=lineChart([actual,erp],1,12,['Actual position','Effective reward position'],true);
  const credit=p.snapshots.map(s=>[s.raceProgress,s.credit*100]),eff=p.snapshots.map(s=>[s.raceProgress,s.effort*100]);
  $('creditChart').innerHTML=lineChart([credit,eff],0,100,['Comeback credit','Competitive effort'],false);

  $('snapshotTable').innerHTML=`<table><thead><tr><th>Race</th><th>Pos</th><th>ERP</th><th>Credit</th><th>Effort</th><th>Lap</th><th>Sacrifice</th><th>Vol. losses</th><th>Spent</th><th>Hits</th></tr></thead><tbody>${p.snapshots.map(s=>`<tr><td>${Math.round(s.raceProgress*100)}%</td><td>${s.position}</td><td>${s.erp.toFixed(2)}</td><td>${Math.round(s.credit*100)}%</td><td>${Math.round(s.effort*100)}%</td><td>${s.lap}</td><td>${s.sacrificeSeconds.toFixed(1)}s</td><td>${s.voluntaryLosses}</td><td>${Math.round(s.creditSpent*100)}</td><td>${s.hitsTaken}</td></tr>`).join('')}</tbody></table>`;

  const ev=z.events.filter(e=>e.player===p.id||e.attacker===p.id||e.target===p.id);
  $('eventLog').innerHTML=ev.length?ev.map(e=>`<div class="eventrow"><b>${e.time.toFixed(1)}s · ${e.type}</b><div class="tiny muted">${escapeHtml(JSON.stringify(e))}</div></div>`).join(''):`<div class="eventrow muted">No logged events for this player.</div>`;
}
function renderHeatmap(){
  const z=currentRace();if(!z)return;
  const cols=z.players[0]?.snapshots.length||0;
  let h=`<div class="heat" style="grid-template-columns:110px repeat(${cols},minmax(35px,1fr))"><div></div>${z.players[0].snapshots.map(s=>`<div class="tiny" style="text-align:center">${Math.round(s.raceProgress*100)}%</div>`).join('')}`;
  for(const p of z.players){
    h+=`<div class="tiny">P${p.id+1} ${p.strategy[0]}</div>`;
    h+=p.snapshots.map(s=>`<div class="heatcell" style="background:color-mix(in srgb,var(--s1) ${Math.max(4,Math.round(s.credit*100))}%,var(--panel3))">${Math.round(s.credit*100)}</div>`).join('');
  }
  $('heatmap').innerHTML=h+'</div>';
}
function escapeHtml(s){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

async function runLab(){
  const c=cfg();$('runBtn').disabled=true;$('status').textContent='Running paired Instant, V1, and V2 races…';
  await new Promise(r=>setTimeout(r,20));
  try{
    const raw={instant:[],v1:[],v2:[]},raceSeeds=[];
    for(let i=0;i<c.races;i++){
      const rosterSeed=hash(c.seed,i),simulationSeed=hash(c.seed+7717,i),ro=makeRoster(rosterSeed,c);
      raceSeeds.push({race:i+1,rosterSeed,simulationSeed});
      raw.instant.push(simulate(ro,c,'instant',simulationSeed,true));
      raw.v1.push(simulate(ro,c,'v1',simulationSeed,true));
      raw.v2.push(simulate(ro,c,'v2',simulationSeed,true));
      if(i%100===99){$('status').textContent=`Simulating… ${i+1}/${c.races} paired races`;await new Promise(r=>setTimeout(r,0))}
    }
    archive={modelVersion:MODEL,createdAt:new Date().toISOString(),config:c,raceSeeds,summary:{instant:aggregate(raw.instant,'instant'),v1:aggregate(raw.v1,'v1'),v2:aggregate(raw.v2,'v2')},races:raw,stress:null,exploitHunter:null};
    renderSummary();initInspector();buildExports();
    $('status').textContent=`Complete: ${c.races.toLocaleString()} paired races · ${(c.races*36).toLocaleString()} driver-runs across three systems.`;
  }catch(e){console.error(e);$('status').textContent='Simulation error: '+e.message}
  finally{$('runBtn').disabled=false}
}

async function runStress(){
  if(!archive){$('status').textContent='Run the main lab first.';return}
  const base=archive.config,scenarios=[
    ['Bagging invasion',{baggers:6,fronts:2}],
    ['Elite technical',{skill:'elite',track:'technical',chaos:.75}],
    ['Item storm',{track:'item',chaos:1.65,blue:1.5}],
    ['Compressed pack',{track:'pack',pack:1}],
    ['Stop-and-wait swarm',{bagAI:'stop',baggers:5}],
    ['Pulse-braking swarm',{bagAI:'pulse',baggers:5}],
    ['Credit-farming swarm',{bagAI:'farmer',baggers:5}],
    ['Late-bag lobby',{bagAI:'late',baggers:5}]
  ];
  $('stressOut').textContent='Running hostile scenarios…';$('stressBtn').disabled=true;
  await new Promise(r=>setTimeout(r,20));
  const out=[];
  for(let si=0;si<scenarios.length;si++){
    let [name,patch]=scenarios[si],c={...base,...patch,races:160,capture:'normal'},raw={instant:[],v1:[],v2:[]};
    for(let i=0;i<c.races;i++){
      const ro=makeRoster(hash(c.seed+si*1000,i),c),rs=hash(c.seed+8800+si*500,i);
      raw.instant.push(simulate(ro,c,'instant',rs,false));raw.v1.push(simulate(ro,c,'v1',rs,false));raw.v2.push(simulate(ro,c,'v2',rs,false));
    }
    const I=aggregate(raw.instant,'instant'),V1=aggregate(raw.v1,'v1'),V2=aggregate(raw.v2,'v2'),ib=pct(I.baggerTop3,I.baggerTrials);
    out.push({name,config:c,v1Top3Delta:pct(V1.baggerTop3,V1.baggerTrials)-ib,v2Top3Delta:pct(V2.baggerTop3,V2.baggerTrials)-ib,v2ComebackDelta:pct(V2.genuineTop4,V2.genuineTrials)-pct(I.genuineTop4,I.genuineTrials),v2ROI:roi(V2)});
    $('stressOut').textContent=`Running hostile scenarios… ${si+1}/${scenarios.length}`;await new Promise(r=>setTimeout(r,0));
  }
  archive.stress=out;
  $('stressOut').innerHTML=`<div class="scroll"><table><thead><tr><th>Scenario</th><th>V1 bag top-3 Δ</th><th>V2 bag top-3 Δ</th><th>V2 comeback Δ</th><th>V2 ROI</th><th>Read</th></tr></thead><tbody>${out.map(x=>{let ok=x.v2Top3Delta<=-4&&x.v2ComebackDelta>=-6&&(x.v2ROI==null||x.v2ROI<0);return`<tr><td>${x.name}</td><td>${x.v1Top3Delta.toFixed(1)}</td><td><b>${x.v2Top3Delta.toFixed(1)}</b></td><td>${x.v2ComebackDelta.toFixed(1)}</td><td>${x.v2ROI==null?'—':x.v2ROI.toFixed(2)}</td><td class="${ok?'good':'warn'}">${ok?'PASS':'INSPECT'}</td></tr>`}).join('')}</tbody></table></div>`;
  buildExports();$('stressBtn').disabled=false;
}

async function runHunter(){
  if(!archive){$('status').textContent='Run the main lab first.';return}
  const base=archive.config,tests=[],ais=['classic','stop','pulse','late','farmer','opportunistic'];
  for(const ai of ais)for(const dist of[.75,1,1.3])for(const eff of[.8,1,1.25])for(const spend of[.5,1,1.4])if(tests.length<30)tests.push({ai,dist,eff,spend});
  $('huntOut').textContent='Adversarial search running…';$('huntBtn').disabled=true;
  await new Promise(r=>setTimeout(r,20));
  const out=[];
  for(let ti=0;ti<tests.length;ti++){
    let q=tests[ti],c={...base,bagAI:q.ai,distanceReq:q.dist,effortSens:q.eff,creditSpend:q.spend,baggers:5,races:90,capture:'normal'},ri=[],rv=[];
    for(let i=0;i<c.races;i++){
      const ro=makeRoster(hash(c.seed+ti*731,i),c),rs=hash(c.seed+9999+ti*997,i);
      ri.push(simulate(ro,c,'instant',rs,false));rv.push(simulate(ro,c,'v2',rs,false));
    }
    const I=aggregate(ri,'instant'),V2=aggregate(rv,'v2'),delta=pct(V2.baggerTop3,V2.baggerTrials)-pct(I.baggerTop3,I.baggerTrials),come=pct(V2.genuineTop4,V2.genuineTrials)-pct(I.genuineTop4,I.genuineTrials),rr=roi(V2)||0;
    const risk=delta+Math.max(0,rr)*5+Math.max(0,-come-5)*.8;
    out.push({parameters:q,v2Top3:pct(V2.baggerTop3,V2.baggerTrials),top3Delta:delta,comebackDelta:come,roi:rr,risk});
    $('huntOut').textContent=`Adversarial search running… ${ti+1}/${tests.length}`;await new Promise(r=>setTimeout(r,0));
  }
  out.sort((a,b)=>b.risk-a.risk);archive.exploitHunter=out;
  $('huntOut').innerHTML=`<div class="note"><b>Worst discovered configuration:</b> ${out[0]?`${out[0].parameters.ai}, distance ${out[0].parameters.dist}×, effort ${out[0].parameters.eff}×, spend ${out[0].parameters.spend}×`:'—'}</div><div class="scroll sectiongap"><table><thead><tr><th>AI</th><th>Distance</th><th>Effort</th><th>Spend</th><th>V2 top-3</th><th>vs Instant</th><th>ROI</th><th>Comeback Δ</th><th>Risk</th></tr></thead><tbody>${out.slice(0,15).map(x=>`<tr><td>${x.parameters.ai}</td><td>${x.parameters.dist}</td><td>${x.parameters.eff}</td><td>${x.parameters.spend}</td><td>${x.v2Top3.toFixed(1)}%</td><td>${x.top3Delta.toFixed(1)}</td><td>${x.roi.toFixed(2)}</td><td>${x.comebackDelta.toFixed(1)}</td><td><b>${x.risk.toFixed(1)}</b></td></tr>`).join('')}</tbody></table></div><p class="tiny muted sectiongap">Risk is a heuristic for where to inspect, not proof of an exploit.</p>`;
  buildExports();$('huntBtn').disabled=false;
}

function packStrategy(s){return[s.n,s.finish,s.wins,s.top3,s.bottom4,s.power,s.items,s.sacrifice,s.skill]}
function packSummary(s){return[STR.map(k=>packStrategy(s.strategies[k])),s.baggerTrials,s.baggerTop3,s.baggerWins,s.baggerBottom4,s.genuineTrials,s.genuineTop4,s.frontTrials,s.frontTop3,s.displacementTrials,s.displacement,s.skillCorrelation,s.sacrificeSlope]}
function packSnap(s){return[s.raceProgress,s.position,s.erp,s.credit,s.effort,s.distance,s.lap,s.sacrificeSeconds,s.voluntaryLosses,s.validatedLossStreak,s.creditSpent,s.hitsTaken]}
function packFrame(f){return[f.time,f.position,f.erp,f.credit,f.effort,f.distance,f.lap,f.sacrificeSeconds,f.voluntaryLosses,f.creditSpent,f.hitsTaken]}
function packPlayer(p){return[p.id,STR.indexOf(p.strategy),AIS.indexOf(p.bagAI),p.skill,p.itemSkill,p.consistency,p.aggression,p.risk,p.finalPosition,p.finishTime,p.bagged?1:0,p.sacrificeSeconds,p.voluntaryLosses,p.validatedLossStreak,p.creditSpent,p.hitsTaken,p.averageEffort,p.averageItemPower,p.itemCount,p.snapshots.map(packSnap),p.frames?p.frames.map(packFrame):null]}
function packEvent(e){
  const typeMap={item_draw:0,hit:1,track_disruption:2,position_loss_classified:3,finish:4};
  const t=typeMap[e.type]??9;
  if(t===0)return[0,e.time,e.player,ITEMS.indexOf(e.item),e.position,e.erp,e.creditAfter,e.effort,e.power,e.creditCost,e.distance,e.lap,e.opening?1:0];
  if(t===1)return[1,e.time,e.attacker,e.target,ITEMS.indexOf(e.item),e.attackerPosition,e.targetPosition,e.targetGrace,e.distance];
  if(t===2)return[2,e.time,e.player,e.position,e.grace,e.distance];
  if(t===3)return[3,e.time,e.player,e.from,e.to,e.validated?1:0,e.effort,e.graceLeft,e.creditAfter,e.erp];
  if(t===4)return[4,e.time,e.player,e.finalPosition];
  return[9,e];
}
function packRace(r){return[r.seed,r.trackLength,r.players.map(packPlayer),r.events.map(packEvent)]}
function compactArchive(){
  const c=archive.config;
  return['MKF-C1',MODEL,[c.races,c.seed,c.baggers,c.fronts,c.track,c.skill,c.bagAI,c.chaos,c.pack,c.blue,c.lapAccel,c.v1Strict,c.distanceReq,c.effortSens,c.creditSpend,c.grace,c.capture],
    archive.raceSeeds.map(x=>[x.race,x.rosterSeed,x.simulationSeed]),
    [packSummary(archive.summary.instant),packSummary(archive.summary.v1),packSummary(archive.summary.v2)],
    archive.stress,archive.exploitHunter,
    [archive.races.instant.map(packRace),archive.races.v1.map(packRace),archive.races.v2.map(packRace)]
  ];
}
function downloadFile(name,text,type){
  const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function buildExports(){
  if(!archive)return;
  const full=JSON.stringify(archive,null,2),compact=JSON.stringify(compactArchive());
  const nd=[];
  for(const mode of['instant','v1','v2'])archive.races[mode].forEach((r,i)=>r.events.forEach(e=>nd.push(JSON.stringify({mode,race:i+1,seed:r.seed,...e}))));
  const ndjson=nd.join('\n');
  let eventCount=nd.length,frameCount=0;
  for(const mode of['instant','v1','v2'])for(const r of archive.races[mode])for(const p of r.players)frameCount+=p.frames?.length||0;
  $('exportStats').innerHTML=`<div class="subcard"><div class="tiny muted">System-races</div><b>${(archive.config.races*3).toLocaleString()}</b></div><div class="subcard"><div class="tiny muted">Driver-runs</div><b>${(archive.config.races*36).toLocaleString()}</b></div><div class="subcard"><div class="tiny muted">Logged events</div><b>${eventCount.toLocaleString()}</b></div><div class="subcard"><div class="tiny muted">Frame records</div><b>${frameCount.toLocaleString()}</b></div>`;
  $('downloadJson').disabled=false;$('downloadNdjson').disabled=false;$('downloadCompact').disabled=false;$('selectDigest').disabled=false;
  $('downloadJson').onclick=()=>downloadFile(`mario-kart-forensic-${archive.config.seed}.json`,full,'application/json');
  $('downloadNdjson').onclick=()=>downloadFile(`mario-kart-events-${archive.config.seed}.ndjson`,ndjson,'application/x-ndjson');
  $('downloadCompact').onclick=()=>downloadFile(`mario-kart-MKF-C1-${archive.config.seed}.txt`,`MKF-C1|1/1|${compact}`,'text/plain');

  const size=60000,total=Math.max(1,Math.ceil(compact.length/size));compactChunks=[];
  for(let i=0;i<total;i++)compactChunks.push(`MKF-C1|${i+1}/${total}|`+compact.slice(i*size,(i+1)*size));
  chunkIndex=0;showChunk();
  $('compressionInfo').textContent=`Full JSON: ${full.length.toLocaleString()} chars · MKF-C1: ${compact.length.toLocaleString()} chars · ${Math.max(0,100*(1-compact.length/full.length)).toFixed(1)}% smaller · ${total} copy chunk(s).`;

  const I=archive.summary.instant,V1=archive.summary.v1,V2=archive.summary.v2;
  $('digest').value=[
    `MARIO KART ANTI-BAGGING LAB — ${MODEL}`,
    `Config: ${JSON.stringify(archive.config)}`,
    `Bagger top-3 I/V1/V2: ${pct(I.baggerTop3,I.baggerTrials).toFixed(2)} / ${pct(V1.baggerTop3,V1.baggerTrials).toFixed(2)} / ${pct(V2.baggerTop3,V2.baggerTrials).toFixed(2)}`,
    `Bagger wins I/V1/V2: ${pct(I.baggerWins,I.baggerTrials).toFixed(2)} / ${pct(V1.baggerWins,V1.baggerTrials).toFixed(2)} / ${pct(V2.baggerWins,V2.baggerTrials).toFixed(2)}`,
    `Bagger bottom-4 I/V1/V2: ${pct(I.baggerBottom4,I.baggerTrials).toFixed(2)} / ${pct(V1.baggerBottom4,V1.baggerTrials).toFixed(2)} / ${pct(V2.baggerBottom4,V2.baggerTrials).toFixed(2)}`,
    `Genuine comeback I/V1/V2: ${pct(I.genuineTop4,I.genuineTrials).toFixed(2)} / ${pct(V1.genuineTop4,V1.genuineTrials).toFixed(2)} / ${pct(V2.genuineTop4,V2.genuineTrials).toFixed(2)}`,
    `Frontrunner retention I/V1/V2: ${pct(I.frontTop3,I.frontTrials).toFixed(2)} / ${pct(V1.frontTop3,V1.frontTrials).toFixed(2)} / ${pct(V2.frontTop3,V2.frontTrials).toFixed(2)}`,
    `Non-bagger displacement I/V1/V2: ${pct(I.displacement,I.displacementTrials).toFixed(2)} / ${pct(V1.displacement,V1.displacementTrials).toFixed(2)} / ${pct(V2.displacement,V2.displacementTrials).toFixed(2)}`,
    `Skill correlation I/V1/V2: ${(I.skillCorrelation*100).toFixed(2)} / ${(V1.skillCorrelation*100).toFixed(2)} / ${(V2.skillCorrelation*100).toFixed(2)}`,
    `V2 ROI: ${roi(V2)==null?'n/a':roi(V2).toFixed(3)}`,
    `V2 sacrifice slope: ${V2.sacrificeSlope.toFixed(3)}`,
    `Stress included: ${archive.stress?'yes':'no'}`,
    `Exploit hunter included: ${archive.exploitHunter?'yes':'no'}`,
    `MKF-C1 chunks: ${total}`
  ].join('\n');
}
function showChunk(){
  if(!compactChunks.length)return;
  $('compactText').value=compactChunks[chunkIndex];$('chunkLabel').textContent=`Chunk ${chunkIndex+1} / ${compactChunks.length}`;
  $('prevChunk').disabled=chunkIndex===0;$('nextChunk').disabled=chunkIndex===compactChunks.length-1;$('selectChunk').disabled=false;
}
function syncLabels(){
  $('chaosTxt').textContent=(+$('chaos').value).toFixed(1)+'×';
  $('packTxt').textContent=Math.round(+$('pack').value*100)+'%';
  const b=+$('blue').value;$('blueTxt').textContent=b===0?'Off':b===1?'Normal':b.toFixed(2)+'×';
  $('lapTxt').textContent=Math.round(+$('lapAccel').value*100)+'%';
  $('v1Txt').textContent=(+$('v1Strict').value).toFixed(2)+'×';
  $('distTxt').textContent=(+$('distanceReq').value).toFixed(2)+'×';
  $('effTxt').textContent=(+$('effortSens').value).toFixed(2)+'×';
  $('spendTxt').textContent=(+$('creditSpend').value).toFixed(2)+'×';
  $('graceTxt').textContent=(+$('grace').value).toFixed(1)+'s';
}

$$('input[type=range]').forEach(x=>x.addEventListener('input',syncLabels));
$$('.tab').forEach(b=>b.addEventListener('click',()=>{$$('.tab').forEach(x=>x.classList.toggle('active',x===b));$$('.panel').forEach(p=>p.classList.toggle('active',p.id===b.dataset.panel))}));
$('capture').addEventListener('change',()=>{if($('capture').value==='frame'&&+$('races').value>100){$('races').value=100;$('status').textContent='Full-frame capture selected: race count capped at 100.'}});
$('runBtn').addEventListener('click',runLab);$('stressBtn').addEventListener('click',runStress);$('huntBtn').addEventListener('click',runHunter);
$('inspectMode').addEventListener('change',renderRaceInspector);$('racePick').addEventListener('change',renderRaceInspector);$('playerPick').addEventListener('change',renderPlayerInspector);
$('prevChunk').addEventListener('click',()=>{if(chunkIndex>0){chunkIndex--;showChunk()}});
$('nextChunk').addEventListener('click',()=>{if(chunkIndex<compactChunks.length-1){chunkIndex++;showChunk()}});
$('selectChunk').addEventListener('click',()=>{$('compactText').focus();$('compactText').select()});
$('selectDigest').addEventListener('click',()=>{$('digest').focus();$('digest').select()});

syncLabels();
})();
