
const DEFAULT_AGS_R=['CBP','ICE','HSI','Secret Service','Coast Guard','FBI','DEA','ATF','USMS','Other DOJ'];
const DEFAULT_AGS_V=['SSA','HUD','IRS','Bureau of Prisons','ICE','HSI','FBI','DEA','Education','Veterans Affairs'];
const state={cls:'R',dists:new Set(['National']),
  ags:new Set(DEFAULT_AGS_R),occ:'lead',metric:'cases_filed',
  agsC:new Set(DEFAULT_AGS_V),role:'Defendant',basis:'cases',metricC:'cases_filed',
  mixMode:'stacked',admins:new Set(),from:'2013-01',to:'2026-06',grain:'month'};
let NAT=null,FULL=null,CNAT=null,CFULL=null,SPINE=[],fullLoading=false,cfullLoading=false,civilLoading=false;
let dMS=null,chart=null,chart2=null,chart3=null;
let AGLIST_R=[],AGLIST_V=[],DEPTS_R=[],DEPTS_V=[];
const NUM_R=["cases_filed","defendants_filed","cases_terminated","defendants_terminated","guilty","not_guilty","dismissed","rule_20_21","other"];
const NUM_C=["matters_received","cases_filed","matters_terminated","cases_terminated","d_judg_us","d_settle","d_against","d_dismissed","d_other"];
const PALETTE=["#212123","#2a78d6","#d9622b","#1d9e75","#7a4fc0","#c02d5a","#0e8a8a","#b8860b","#5a6acf","#c23b8a","#7a7b76","#2f9e44","#e06a2b","#3b6fd4"];
const CATPAL=(window.LIONS_PAL||PALETTE);
const DISP=[["ju","Judgment For U.S.","#1d9e75"],["st","Settlements","#2a78d6"],["ag","Judgment Against U.S.","#d9622b"],["dm","Dismissed","#7a4fc0"],["ot","Other","#8a8b86"]];
const METRICS_R=[["cases_filed","Cases filed"],["cases_terminated","Cases terminated"],["clearance","Clearance %"],["defendants_filed","Defendants filed"],["defendants_terminated","Defendants terminated"],["guilty_pct","Guilty disposition %"],["dismissed_pct","Dismissed disposition %"]];
const METRICS_CASES=[["cases_filed","Cases filed"],["cases_pending","Cases pending"],["cases_terminated","Cases terminated"]];
const METRICS_MATTERS=[["matters_received","Matters received"],["matters_pending","Matters pending"],["matters_terminated","Matters terminated"]];
const PRESETS={obama2:["2013-01","2017-01"],trump1:["2017-01","2021-01"],biden:["2021-01","2025-01"],trump2:["2025-01","2026-06"],all:["2013-01","2026-06"]};
const DEPT_ORDER_R=["DOJ","DHS","Treasury","Defense","Interior","USPS","State","HHS","Agriculture","Labor","HUD","Veterans Affairs","Education","Energy/Environment","Commerce","State/Local & Other"];
const SUB_ORDER_R={"DOJ":["FBI","DEA","ATF","USMS","INS (legacy)","Other DOJ"],"DHS":["CBP","ICE","HSI","Secret Service","Coast Guard","TSA","DHS-OIG","Other DHS"]};
const DEPT_ORDER_V=["Social Security Admin","DOJ","DHS","Treasury","HUD","HHS","Education","Veterans Affairs","Small Business Admin","Agriculture","Defense","Labor","Interior","State","EPA","OPM","Energy","Commerce","USPS","Other"];
const SUB_ORDER_V={"DOJ":["Bureau of Prisons","FBI","DEA","ATF","USMS","Other DOJ"],"DHS":["ICE","HSI","CBP","Secret Service","Other DHS"],"Treasury":["IRS","Other Treasury"],"Defense":["Army","Navy","Air Force","Army Corps of Engineers","Other Defense"],"HHS":["FDA","HHS-OIG","Other HHS"]};
const CURRENT="agency.html";
// Provisional (right-censored) data - L-014, revised to rev B in L-021.
// Spec: ops/handoffs/L-003-design-spec.md (revision B).
// All the logic lives in shared/provisional.js; this page only makes calls.
// Two things this page owns for rev B, neither of them logic:
//   scales.x.ticks.padding:6 on every chart carrying the treatment - a LAYOUT
//     PRECONDITION of the gutter bar (spec §3.6/§6.9), not a style choice. The
//     bar lives in that space; Chart.js defaults to 3 and the bar would touch
//     the tick labels.
//   _stacked:true on datasets built for a stacked render - the input to
//     LIONS_PROV.decorateLine's refusal to fade a stacked fill (spec §6.7).
//     Set per render, because the mix charts flip family at runtime.
// This page is dual-mode, so the window set follows the mode: criminal 3/6, civil 4/6.
const PV=window.LIONS_PROV;
const pvopt=()=>({civil:isCiv()});
// The share chart normalises on the mode's inflow; the table prints every metric and
// so takes the widest window across its own columns (spec §3.5).
const TBL_METRICS_R=["cases_filed","cases_terminated","clearance","defendants_filed","defendants_terminated","guilty_pct","dismissed_pct"];
function mixMetric(){ return isCiv()?(state.basis==='cases'?'cases_filed':'matters_received'):'cases_filed'; }

// mode helpers
const isCiv=()=>state.cls==='V';
function metricsList(){ return !isCiv()?METRICS_R:(state.basis==='cases'?METRICS_CASES:METRICS_MATTERS); }
function curMetric(){ return isCiv()?state.metricC:state.metric; }
function setMetric(m){ if(isCiv()) state.metricC=m; else state.metric=m; }
function curAgs(){ return isCiv()?state.agsC:state.ags; }
function curDepts(){ return isCiv()?DEPTS_V:DEPTS_R; }
function curAglist(){ return isCiv()?AGLIST_V:AGLIST_R; }
function primaryFlow(){ return state.basis==='cases'?'cf':'mr'; }
function primaryLabel(){ return state.basis==='cases'?'cases filed':'matters received'; }
function metricLabel(m){ const e=metricsList().find(x=>x[0]===m); return e?e[1]:m; }
const isPctR=m=> m==='clearance'||m==='clearance_3mo'||m==='guilty_pct'||m==='dismissed_pct';
function isPct(){ return !isCiv() && isPctR(curMetric()); }

function parseCSV_R(t){ const L=t.trim().split(/\r?\n/), H=L[0].split(","), I=Object.fromEntries(H.map((h,i)=>[h,i]));
  const out=new Array(L.length-1);
  for(let i=1;i<L.length;i++){ const c=L[i].split(",");
    const o={ym:c[I.ym],grp:c[I.subagency],dept:c[I.department],occ:c[I.occ],district:I.district!==undefined?c[I.district]:"National"};
    for(const k of NUM_R) o[k]=+c[I[k]]||0; out[i-1]=o; } return out; }
function parseCSV_C(t){ const L=t.trim().split(/\r?\n/), H=L[0].split(","), I=Object.fromEntries(H.map((h,i)=>[h,i]));
  const out=new Array(L.length-1);
  for(let i=1;i<L.length;i++){ const c=L[i].split(",");
    const o={ym:c[I.ym],grp:c[I.subagency],dept:c[I.department],role:c[I.role],district:I.district!==undefined?c[I.district]:"National"};
    for(const k of NUM_C) o[k]=+c[I[k]]||0; out[i-1]=o; } return out; }

// ---- criminal aggregation ----
function aggR(dists, ags){
  const useNat=dists.has('National')||dists.size===0, agAll=ags.has('ALL'), occ=state.occ;
  const idx=new Map();
  const add=r=>{ if(agAll?(r.grp!=='ALL'):(r.grp==='ALL'||!ags.has(r.grp)||r.occ!==occ)) return; let o=idx.get(r.ym);
    if(!o){o={filed:0,term:0,df:0,dt:0,guilty:0,dismissed:0}; idx.set(r.ym,o);}
    o.filed+=r.cases_filed;o.term+=r.cases_terminated;o.df+=r.defendants_filed;o.dt+=r.defendants_terminated;o.guilty+=r.guilty;o.dismissed+=r.dismissed; };
  if(useNat){ for(const r of NAT) add(r); } else { for(const r of FULL) if(dists.has(r.district)) add(r); }
  const R={filed:[],term:[],df:[],dt:[],guilty:[],dismissed:[]};
  for(const ym of SPINE){ const o=idx.get(ym); R.filed.push(o?o.filed:0);R.term.push(o?o.term:0);R.df.push(o?o.df:0);R.dt.push(o?o.dt:0);R.guilty.push(o?o.guilty:0);R.dismissed.push(o?o.dismissed:0); }
  return R;
}
// ---- civil aggregation ----
function aggC(dists, ags, role){
  const useNat=dists.has('National')||dists.size===0, agAll=ags.has('ALL');
  const idx=new Map();
  const add=r=>{ if(r.role!==role) return; if(agAll?(r.grp!=='ALL'):(r.grp==='ALL'||!ags.has(r.grp))) return; let o=idx.get(r.ym);
    if(!o){o={mr:0,cf:0,mt:0,ct:0,ju:0,st:0,ag:0,dm:0,ot:0}; idx.set(r.ym,o);}
    o.mr+=r.matters_received;o.cf+=r.cases_filed;o.mt+=r.matters_terminated;o.ct+=r.cases_terminated;
    o.ju+=r.d_judg_us;o.st+=r.d_settle;o.ag+=r.d_against;o.dm+=r.d_dismissed;o.ot+=r.d_other; };
  if(useNat){ for(const r of CNAT) add(r); } else { for(const r of CFULL) if(dists.has(r.district)) add(r); }
  const R={mr:[],cf:[],mt:[],ct:[],ju:[],st:[],ag:[],dm:[],ot:[]};
  for(const ym of SPINE){ const o=idx.get(ym); for(const k in R) R[k].push(o?o[k]:0); }
  return R;
}
const mean3=(a,i)=> i<2?null:(a[i]+a[i-1]+a[i-2])/3;
const ratio3=(num,den,i)=>{ if(i<2)return null; const D=den[i]+den[i-1]+den[i-2],N=num[i]+num[i-1]+num[i-2]; return D>0?100*N/D:null; };
function cumsum(a){ let acc=0; return a.map(v=>acc+=v); }
function pendingSeries(R,kind){ const delta=kind==='matters'?R.mr.map((v,i)=>v-R.cf[i]-R.mt[i]):R.cf.map((v,i)=>v-R.ct[i]); return cumsum(delta); }
function metricArrR(R,m){ switch(m){
  case 'cases_filed': return R.filed.slice();
  case 'cases_filed_3mo': return R.filed.map((_,i)=>mean3(R.filed,i));
  case 'cases_terminated': return R.term.slice();
  case 'cases_terminated_3mo': return R.term.map((_,i)=>mean3(R.term,i));
  case 'clearance': return R.filed.map((f,i)=> f>0?100*R.term[i]/f:null);
  case 'clearance_3mo': return R.filed.map((_,i)=>ratio3(R.term,R.filed,i));
  case 'defendants_filed': return R.df.slice();
  case 'defendants_terminated': return R.dt.slice();
  case 'guilty_pct': return R.dt.map((d,i)=> d>0?100*R.guilty[i]/d:null);
  case 'dismissed_pct': return R.dt.map((d,i)=> d>0?100*R.dismissed[i]/d:null);
  } return R.filed.slice(); }
function metricArrC(R,m){ switch(m){
  case 'cases_filed': return R.cf.slice();
  case 'cases_filed_3mo': return R.cf.map((_,i)=>mean3(R.cf,i));
  case 'cases_terminated': return R.ct.slice();
  case 'cases_terminated_3mo': return R.ct.map((_,i)=>mean3(R.ct,i));
  case 'cases_pending': return pendingSeries(R,'cases');
  case 'cases_pending_3mo': { const p=pendingSeries(R,'cases'); return p.map((_,i)=>mean3(p,i)); }
  case 'matters_received': return R.mr.slice();
  case 'matters_received_3mo': return R.mr.map((_,i)=>mean3(R.mr,i));
  case 'matters_terminated': return R.mt.slice();
  case 'matters_terminated_3mo': return R.mt.map((_,i)=>mean3(R.mt,i));
  case 'matters_pending': return pendingSeries(R,'matters');
  case 'matters_pending_3mo': { const p=pendingSeries(R,'matters'); return p.map((_,i)=>mean3(p,i)); }
  } return R.cf.slice(); }
// unified accessors
function aggregate(dists,ags){ return isCiv()?aggC(dists,ags,state.role):aggR(dists,ags); }
function metricArray(R,m){ return isCiv()?metricArrC(R,m):metricArrR(R,m); }
function shareFlow(R){ return isCiv()?R[primaryFlow()]:R.filed; }

function agColor(ag){ const i=curAglist().indexOf(ag); return CATPAL[(i<0?0:i)%CATPAL.length]; }
function selAgs(){ return [...curAgs()]; }
const r1=x=>x==null?"-":x.toLocaleString(undefined,{maximumFractionDigits:1});
const rint=x=>x==null?"-":Math.round(x).toLocaleString();
const p1=x=>x==null?"-":x.toFixed(1);
let lastRows=[], lastCols=[];

function renderKPIs(){
  const R=aggregate(state.dists,curAgs());
  const arr=metricArray(R,curMetric()); const idxs=visIdx(); if(!idxs.length) return;
  const pct=isPct(); const isLevel=curMetric().includes('pending');
  const set=(id,v)=>document.getElementById(id).textContent=v;
  const fmtVal=v=> v==null?'-':(pct?v.toFixed(1)+'%':Math.round(v).toLocaleString());
  const S=(a,ix)=>{ let s=0,any=false; for(const i of ix){ const v=a[i]; if(v!=null){s+=v;any=true;} } return any?s:null; };
  const avgOver=(ix)=>{ let s=0,n=0; for(const i of ix){ const v=arr[i]; if(v!=null){s+=v;n++;} } return n?s/n:null; };
  const rateOver=(ix)=>{ const m=curMetric();
    if(m==='clearance'){ const f=S(R.filed,ix),t=S(R.term,ix); return (f&&f>0)?100*t/f:null; }
    if(m==='guilty_pct'){ const d=S(R.dt,ix),g=S(R.guilty,ix); return (d&&d>0)?100*g/d:null; }
    if(m==='dismissed_pct'){ const d=S(R.dt,ix),x=S(R.dismissed,ix); return (d&&d>0)?100*x/d:null; }
    return null; };
  const e=idxs[idxs.length-1]; const last12=idxs.slice(-12);
  // KPI 1 & 2: totals (flows) / blended rate (%) / ending level & recent avg (pending)
  set('kpi1', fmtVal(pct?rateOver(idxs):(isLevel?arr[e]:S(arr,idxs))));
  set('kpi2', fmtVal(pct?rateOver(last12):(isLevel?avgOver(last12):S(arr,last12))));
  // KPI 3: year-over-year change (kept)
  const avg3at=(i)=>{ if(i<2) return null; let s=0,n=0; for(let k=0;k<3;k++){ const v=arr[i-k]; if(v!=null){s+=v;n++;} } return n?s/n:null; };
  const chg=(a,b)=> (a==null||b==null||b===0)?null:100*(a-b)/Math.abs(b);
  const yoy=chg(avg3at(e),avg3at(e-12));
  set('kpi3', yoy==null?'-':((yoy>=0?'+':'')+yoy.toFixed(1)+'%'));
  // KPI 4: agency share change (kept)
  const sel=shareFlow(R), tot=shareFlow(aggregate(state.dists,new Set(['ALL'])));
  const sum3=(a,i)=> i<2?null:(a[i]+a[i-1]+a[i-2]);
  const shr=(i)=>{ const su=sum3(sel,i),t=sum3(tot,i); return (su!=null&&t)?100*su/t:null; };
  const comp=(shr(e)!=null&&shr(e-12)!=null)?shr(e)-shr(e-12):null;
  set('kpi4',comp==null?'-':(comp>=0?'+':'')+comp.toFixed(1)+' pts');
  // Provisional caveats (spec §7). No arithmetic changes.
  const pcut=PV.cutIndex(SPINE,PV.n(curMetric(),pvopt()));
  const provIn=ix=>ix.some(i=>i>pcut);
  const w3=i=>[i,i-1,i-2].filter(k=>k>=0);
  const yoyProv=provIn(w3(e))&&!provIn(w3(e-12));
  setKpiNote('kpi1',isLevel?(e>pcut):provIn(idxs),KPI_NOTE_INCLUDES);
  setKpiNote('kpi2',provIn(last12),KPI_NOTE_INCLUDES);
  setKpiNote('kpi3',yoy!=null&&yoyProv,KPI_NOTE_COMPARES);
  setKpiNote('kpi4',comp!=null&&yoyProv,KPI_NOTE_COMPARES);
  document.getElementById('kpiMetric').textContent=metricLabel(curMetric());
  document.getElementById('kpi1lab').textContent=pct?'Overall rate, selected range':(isLevel?'Latest (end of range)':'Total, selected range');
  document.getElementById('kpi2lab').textContent=pct?'Overall rate, last 12 mo':(isLevel?'Avg, last 12 months':'Total, last 12 months');
  document.getElementById('kpi1ym').textContent = idxs.length ? ('(' + fmtMMYYYY(SPINE[idxs[0]]) + ' – ' + fmtMMYYYY(SPINE[e]) + ')') : '';
  document.getElementById('kpi2ym').textContent = last12.length ? ('(ending ' + fmtMMYYYY(SPINE[e]) + ')') : '';
  const dtxt=(state.dists.has('National')||state.dists.size===0?'National':state.dists.size+' districts');
  document.getElementById('kpiScope').textContent=(isCiv()?'U.S. as '+state.role+' · ':'')+dtxt+' · '+curAgs().size+' agenc'+(curAgs().size===1?'y':'ies');
}

const adminBands={id:'admin',beforeDraw(ch){ const labels=ch.data._ym||ch.data.labels; if(!labels||!labels.length)return;
  const x=ch.scales.x,area=ch.chartArea,ctx=ch.ctx; const half=labels.length>1?Math.abs(x.getPixelForValue(1)-x.getPixelForValue(0))/2:10;
  for(const ad of ADMINS){ let s=-1,e=-1; for(let i=0;i<labels.length;i++){ if(labels[i]>=ad.a&&labels[i]<ad.b){ if(s<0)s=i; e=i; } }
    if(s<0)continue; const x0=x.getPixelForValue(s)-half,x1=x.getPixelForValue(e)+half;
    ctx.save(); ctx.fillStyle=ad.c; ctx.fillRect(x0,area.top,x1-x0,area.bottom-area.top);
    ctx.fillStyle='rgba(70,70,66,0.7)'; ctx.font='11px sans-serif'; ctx.textAlign='center';
    if(x1-x0>44) ctx.fillText(ad.name,(x0+x1)/2,area.top+11); ctx.restore(); }
}};

const TT={enabled:false,external:extTooltip};
function renderChart(){
  const idxs=visIdx(); const B=grainBuckets(SPINE,idxs,state.grain);
  const labels=grainLabels(B), ymAxis=B.map(b=>SPINE[b.idxs[0]]);
  const pr=B.map(b=>b.partial?3.2:0), anyPartial=grainAnyPartial(B);
  const pct=isPct();
  const ags=selAgs();
  // Provisional: this chart plots one metric across agencies, so the zone and every
  // series share the same window. Anchored to the vintage edge, never to state.to.
  const nOwn=PV.n(curMetric(),pvopt()), flagsOwn=PV.bucketFlags(SPINE,B,nOwn);
  const datasets=ags.map((ag)=>{ const arr=metricArray(bucketComp(aggregate(state.dists,new Set([ag])),B),curMetric()); const col=agColor(ag);
    return PV.decorateLine({label:ag,data:arr,borderColor:col,backgroundColor:col,tension:.25,pointRadius:pr,pointStyle:'circle',pointBackgroundColor:'#fff',pointBorderColor:col,pointBorderWidth:1.4,pointHoverRadius:4,borderWidth:2,spanGaps:true,_col:col,_pct:pct},flagsOwn,pr); });
  document.getElementById("legend").innerHTML=datasets.map(ds=>`<span class="lg"><span class="sw" style="background:${ds._col}"></span>${ds.label}</span>`).join("")
     + (anyPartial?'<span class="lg" style="color:var(--mut)">* partial period (fewer months than the full period)</span>':'')
     + (PV.anyProv(flagsOwn)?PV.legendChip(nOwn,PV.dir(curMetric())):'');   // separate marker from "*" - two different facts
  document.getElementById("chartTitle").textContent=metricLabel(curMetric())+(isCiv()?" - "+state.role:"")+" - by "+(isCiv()?"client":"referring")+" agency";
  if(typeof window==='undefined'||!window.Chart){ return; }
  const yfmt=pct?(v=>v+'%'):(v=>v.toLocaleString());
  if(chart) chart.destroy();
  chart=mkChart(document.getElementById('chart').getContext('2d'),{type:'line',data:{labels,datasets,_ym:ymAxis,_prov:PV.anyProv(flagsOwn)?flagsOwn:null},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:TT},
      scales:{x:{grid:{display:false,drawTicks:false},ticks:{color:'#6b6c68',font:{size:11},autoSkip:state.grain!=='month',maxRotation:0,padding:6,callback:grainTick(state.grain)}},
        y:{position:'left',beginAtZero:!pct,title:{display:true,text:metricLabel(curMetric()),color:'#6b6c68',font:{size:11}},ticks:{color:'#6b6c68',font:{size:11},callback:yfmt},grid:{color:'#e6e6e3'}}}},
    plugins:[adminBands,PV.plugin]});
}

function renderChart2(){
  const idxs=visIdx(); const B=grainBuckets(SPINE,idxs,state.grain);
  const labels=grainLabels(B), ymAxis=B.map(b=>SPINE[b.idxs[0]]);
  const ags=selAgs();
  const totB=bucketSum(shareFlow(aggregate(state.dists,new Set(['ALL']))),B);
  const aB={}; for(const a of ags) aB[a]=bucketSum(shareFlow(aggregate(state.dists,new Set([a]))),B);
  // Normalised on the mode's inflow -> inflow window. Under-reporting distorts the MIX.
  const nMix=PV.n(mixMetric(),pvopt()), flagsMix=PV.bucketFlags(SPINE,B,nMix);
  let datasets;
  if(state.mixMode==='sum'){
    const data=totB.map((t,bi)=>{ if(!t)return null; let s=0; for(const a of ags) s+=aB[a][bi]; return 100*s/t; });
    datasets=[{label:ags.length+' agenc'+(ags.length===1?'y':'ies')+' share',data,borderColor:'#212123',backgroundColor:'rgba(33,33,35,.10)',fill:true,tension:.25,pointRadius:0,borderWidth:2,_pct:true,_col:'#212123'}];
  } else {
    datasets=ags.map(a=>{ const col=agColor(a); return {label:a,data:totB.map((t,bi)=>t?100*aB[a][bi]/t:null),borderColor:col,backgroundColor:col+'cc',fill:true,tension:.2,pointRadius:0,borderWidth:0.8,_pct:true,_col:col,_stacked:true}; });
  }
  document.getElementById("legend2").innerHTML=(state.mixMode==='stacked'?datasets:[{label:datasets[0].label,borderColor:'#212123'}]).map(ds=>`<span class="lg"><span class="sw" style="background:${ds.borderColor}"></span>${ds.label}</span>`).join("")
    + (PV.anyProv(flagsMix)?PV.legendChip(nMix,'mix'):'');
  const denom=isCiv()?primaryLabel():'referred cases filed';
  document.getElementById("chart2Title").textContent="Share of "+denom+" - % of total"+(state.mixMode==='stacked'?" (stacked)":" (combined)");
  if(typeof window==='undefined'||!window.Chart){ return; }
  datasets=datasets.slice().reverse();
  if(chart2) chart2.destroy();
  chart2=mkChart(document.getElementById('chart2').getContext('2d'),{type:'line',data:{labels,datasets,_ym:ymAxis,_prov:PV.anyProv(flagsMix)?flagsMix:null},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:TT},
      scales:{x:{grid:{display:false,drawTicks:false},ticks:{color:'#6b6c68',font:{size:11},autoSkip:state.grain!=='month',maxRotation:0,padding:6,callback:grainTick(state.grain)}},
        y:{stacked:state.mixMode==='stacked',beginAtZero:true,title:{display:true,text:'% of '+denom,color:'#6b6c68',font:{size:11}},ticks:{color:'#6b6c68',font:{size:11},callback:v=>v+'%'},grid:{color:'#e6e6e3'}}}},
    plugins:[adminBands,PV.plugin]});
}

function renderChart3(){
  const card=document.getElementById('card3');
  if(!isCiv()){ card.hidden=true; if(chart3){chart3.destroy();chart3=null;} return; }
  card.hidden=false;
  const box=document.getElementById('chart3box'), msg=document.getElementById('chart3msg');
  if(state.basis!=='cases'){ box.style.display='none'; msg.style.display='block'; msg.textContent='No disposition data for Matters - court dispositions apply to Cases only. Switch the basis toggle to Cases.'; document.getElementById('legend3').innerHTML=''; if(chart3){chart3.destroy();chart3=null;} return; }
  box.style.display=''; msg.style.display='none';
  const idxs=visIdx(); const B=grainBuckets(SPINE,idxs,state.grain);
  const labels=grainLabels(B), ymAxis=B.map(b=>SPINE[b.idxs[0]]);
  const R=aggregate(state.dists,curAgs());
  const ctB=bucketSum(R.ct,B);
  const datasets=DISP.map(([key,name,col])=>{ const kB=bucketSum(R[key],B); return {label:name,data:ctB.map((t,bi)=>t?100*kB[bi]/t:null),borderColor:col,backgroundColor:col+'cc',fill:true,tension:.2,pointRadius:0,borderWidth:0.8,_pct:true,_col:col,_stacked:true}; });
  // Disposition mix is normalised on cases terminated -> outflow window (6).
  const nDisp=PV.n('cases_terminated',pvopt()), flagsDisp=PV.bucketFlags(SPINE,B,nDisp);
  document.getElementById("legend3").innerHTML=DISP.map(([k,name,col])=>`<span class="lg"><span class="sw" style="background:${col}"></span>${name}</span>`).join("")
    + (PV.anyProv(flagsDisp)?PV.legendChip(nDisp,'mix'):'');
  if(typeof window==='undefined'||!window.Chart) return;
  if(chart3) chart3.destroy();
  chart3=mkChart(document.getElementById('chart3').getContext('2d'),{type:'line',data:{labels,datasets:datasets.slice().reverse(),_ym:ymAxis,_prov:PV.anyProv(flagsDisp)?flagsDisp:null},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:TT},
      scales:{x:{grid:{display:false,drawTicks:false},ticks:{color:'#6b6c68',font:{size:11},autoSkip:state.grain!=='month',maxRotation:0,padding:6,callback:grainTick(state.grain)}},y:{stacked:true,beginAtZero:true,title:{display:true,text:'% of cases terminated',color:'#6b6c68',font:{size:11}},ticks:{color:'#6b6c68',font:{size:11},callback:v=>v+'%'},grid:{color:'#e6e6e3'}}}},plugins:[adminBands,PV.plugin]});
}

function updateChartAccessibility(){
  const chartEl=document.getElementById('chart');
  const chart2El=document.getElementById('chart2');
  const chart3El=document.getElementById('chart3');
  if(!chartEl||!chart2El||!chart3El) return;

  const distText=(state.dists.has('National')||state.dists.size===0)
    ?'National'
    :[...state.dists].map(fmtDist).join(', ');
  const agText=curAgs().size===curAglist().length
    ?'all agencies'
    :`${curAgs().size} selected agencies`;
  const modeText=isCiv()?'civil':'criminal';

  // The provisional treatment must not be vision-only. Appended only when the visible
  // range actually reaches the zone (spec §4).
  const reaches=n=>{ const c=PV.cutIndex(SPINE,n); return visIdx().some(i=>i>c); };
  const nA=PV.n(curMetric(),pvopt());
  const provA=reaches(nA)?(' '+PV.noteText(nA,PV.dir(curMetric()))):'';
  const nA2=PV.n(mixMetric(),pvopt());
  const provA2=reaches(nA2)?(' '+PV.noteText(nA2,'mix')):'';
  const nA3=PV.n('cases_terminated',pvopt());
  const provA3=reaches(nA3)?(' '+PV.noteText(nA3,'mix')):'';
  chartEl.setAttribute('aria-label',
    `${metricLabel(curMetric())} trend over time by ${isCiv()?'client':'referring'} agency. Mode: ${modeText}. Filters: ${distText}; ${agText}; ${state.from} to ${state.to}${isCiv()?`; U.S. as ${state.role}; basis ${state.basis}`:''}.${provA}`
  );

  chart2El.setAttribute('aria-label',
    `Agency share over time as percent of total ${isCiv()?primaryLabel():'referred cases filed'}, ${state.mixMode==='stacked'?'stacked view':'combined view'}. Filters: ${distText}; ${agText}; ${state.from} to ${state.to}${isCiv()?`; U.S. as ${state.role}; basis ${state.basis}`:''}.${provA2}`
  );

  if(!isCiv()){
    chart3El.setAttribute('aria-label','Disposition mix chart is shown in civil mode only.');
    return;
  }
  if(state.basis!=='cases'){
    chart3El.setAttribute('aria-label','Disposition mix chart unavailable for matters basis; switch basis to cases to view disposition percentages.');
    return;
  }
  chart3El.setAttribute('aria-label',
    `Disposition mix over time as percent of cases terminated. Filters: ${distText}; ${agText}; ${state.from} to ${state.to}; U.S. as ${state.role}; basis ${state.basis}.${provA3}`
  );
}

function renderTable(){
  const R=aggregate(state.dists,curAgs());
  // Computed from the vintage edge, replacing a hardcoded `ym>="2026-03"` that would
  // have meant the wrong thing the moment the next vintage promoted. Colour alone is a
  // WCAG 1.4.1 failure, so provisional rows also carry a dagger.
  const provM=PV.monthFlags(SPINE,PV.nMax(isCiv()?metricsList().map(m=>m[0]):TBL_METRICS_R,pvopt()));
  if(!isCiv()){
    const rows=[]; let sf=0,stt=0;
    for(const i of visIdx()){ const ym=SPINE[i]; const filed=R.filed[i],term=R.term[i],dt=R.dt[i];
      const row={ym,filed,term,df:R.df[i],dt,filed3:mean3(R.filed,i),term3:mean3(R.term,i),
        clr:filed>0?100*term/filed:null,clr3:ratio3(R.term,R.filed,i),
        gpct:dt>0?100*R.guilty[i]/dt:null,dpct:dt>0?100*R.dismissed[i]/dt:null,
        prov:!!provM[i],
        tag:ym<="1996-09"?"edge":(provM[i]?"recent prov":"")};
      rows.push(row); sf+=filed; stt+=term; }
    lastRows=rows; lastCols=null;
    document.getElementById("thead").innerHTML="<tr><th>Month</th><th>Cases filed</th><th>Cases term.</th><th>Clearance %</th><th>Def. filed</th><th>Def. term.</th><th>Guilty %</th><th>Dismissed %</th></tr>";
    document.getElementById("tbody").innerHTML=rows.map(r=>{ const cls=r.tag?` class="${r.tag}"`:'';
      return `<tr${cls}><td>${r.ym}${r.prov?PV.tableMark():''}</td><td>${rint(r.filed)}</td><td>${rint(r.term)}</td><td>${p1(r.clr)}</td><td>${rint(r.df)}</td><td>${rint(r.dt)}</td><td>${p1(r.gpct)}</td><td>${p1(r.dpct)}</td></tr>`;
    }).join("");
    const ocl=sf>0?(100*stt/sf).toFixed(1)+"%":"-";
    document.getElementById("summary").innerHTML=`<b>${rows.length}</b> months · filed <b>${sf.toLocaleString()}</b> · terminated <b>${stt.toLocaleString()}</b> · clearance <b>${ocl}</b>`;
    document.getElementById("note").textContent=(state.occ==='all'&&curAgs().size>1)?"Note: “All agencies” basis - a case referred by several selected agencies is counted more than once.":"";
  } else {
    const cols=metricsList().map(m=>m[0]); const arrs=cols.map(m=>metricArray(R,m));
    const rows=[];
    for(const i of visIdx()){ const ym=SPINE[i]; rows.push({ym,vals:arrs.map(a=>a[i]),prov:!!provM[i],tag:ym<="1996-09"?"edge":(provM[i]?"recent prov":"")}); }
    lastRows=rows; lastCols=cols;
    document.getElementById("thead").innerHTML="<tr><th>Month</th>"+metricsList().map(m=>`<th>${m[1]}</th>`).join("")+"</tr>";
    document.getElementById("tbody").innerHTML=rows.map(r=>{ const cls=r.tag?` class="${r.tag}"`:'';
      return `<tr${cls}><td>${r.ym}${r.prov?PV.tableMark():''}</td>`+r.vals.map(v=>`<td>${v==null?"-":(Number.isInteger(v)?rint(v):r1(v))}</td>`).join("")+`</tr>`;
    }).join("");
    const tot=metricArray(R, state.basis==='cases'?'cases_filed':'matters_received');
    const s=visIdx().reduce((a,i)=>a+tot[i],0);
    document.getElementById("summary").innerHTML=`<b>${rows.length}</b> months · ${primaryLabel()} <b>${Math.round(s).toLocaleString()}</b> · U.S. as ${state.role} · ${curAgs().size} agencies`;
    document.getElementById("note").textContent="";
  }
}

function buildCSV(){
  const L=[];
  if(!isCiv()){
    L.push(["month","cases_filed","cases_terminated","clearance_pct","defendants_filed","defendants_terminated","guilty_pct","dismissed_pct","provisional"].join(","));
    for(const r of lastRows) L.push([r.ym,r.filed,r.term,r.clr==null?"":r.clr.toFixed(2),r.df,r.dt,r.gpct==null?"":r.gpct.toFixed(2),r.dpct==null?"":r.dpct.toFixed(2),r.prov?"yes":""].join(","));
  } else {
    L.push(["month",...lastCols,"provisional"].join(","));
    for(const r of lastRows) L.push([r.ym,...r.vals.map(v=>v==null?"":(Number.isInteger(v)?v:v.toFixed(2))),r.prov?"yes":""].join(","));
  }
  const blob=new Blob([L.join("\n")],{type:"text/csv"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  const dt=(state.dists.has('National')||state.dists.size===0)?'National':state.dists.size+'dists';
  a.download=`lions_agency_${isCiv()?'civil_'+state.role+'_'+state.basis:'criminal'}_${dt}_${state.from}_${state.to}.csv`; a.click();
}

// flat multi-select (districts)
function multiSelect(mountId,opts){
  const wrap=document.getElementById(mountId); wrap.classList.add('ms'); wrap.innerHTML='';
  const btn=document.createElement('button'); btn.type='button'; btn.className='ms-btn';
  const panel=document.createElement('div'); panel.className='ms-panel'; panel.hidden=true;
  const bar=document.createElement('div'); bar.className='ms-bar';
  const bAll=document.createElement('a'); bAll.textContent='Select all'; bAll.href='#';
  const bClr=document.createElement('a'); bClr.textContent='Clear all'; bClr.href='#';
  bar.append(bAll,bClr); let searchEl=null; const list=document.createElement('div'); list.className='ms-list'; const sel=opts.initial; const F=opts.fmt||(v=>v);
  const label=()=> (sel.has(opts.allValue)||sel.size===0)?opts.allLabel:(sel.size===1?F([...sel][0]):sel.size+' selected');
  function renderList(){ const q=searchEl?searchEl.value.toLowerCase():''; list.innerHTML='';
    const items=[{v:opts.allValue,t:opts.allLabel}].concat(opts.items.map(v=>({v,t:v})));
    for(const it of items){ if(q&&it.v!==opts.allValue&&!it.t.toLowerCase().includes(q)) continue;
      const lab=document.createElement('label'); const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=sel.has(it.v);
      cb.addEventListener('change',()=>{ if(it.v===opts.allValue){ sel.clear(); sel.add(opts.allValue); }
        else { sel.delete(opts.allValue); if(cb.checked)sel.add(it.v); else sel.delete(it.v); if(sel.size===0)sel.add(opts.allValue); }
        btn.textContent=label(); renderList(); opts.onChange([...sel]); }); lab.append(cb,document.createTextNode(' '+(it.v===opts.allValue?it.t:F(it.v)))); list.append(lab); } }
  bAll.addEventListener('click',e=>{ e.preventDefault(); sel.clear(); for(const v of opts.items) sel.add(v); btn.textContent=label(); renderList(); opts.onChange([...sel]); });
  bClr.addEventListener('click',e=>{ e.preventDefault(); sel.clear(); sel.add(opts.allValue); btn.textContent=label(); renderList(); opts.onChange([...sel]); });
  if(opts.searchable){ searchEl=document.createElement('input'); searchEl.className='ms-search'; searchEl.placeholder='Filter…'; searchEl.addEventListener('input',renderList); panel.append(searchEl); }
  panel.append(bar,list); wrap.append(btn,panel); btn.textContent=label(); renderList();
  btn.addEventListener('click',e=>{ e.stopPropagation(); panel.hidden=!panel.hidden; });
  document.addEventListener('click',e=>{ if(!wrap.contains(e.target)) panel.hidden=true; });
  return { setItems(items){ opts.items=items; renderList(); } };
}

// grouped multi-select (agencies): departments with nested subagencies
function groupedSelect(mountId,groups,sel,onChange){
  const wrap=document.getElementById(mountId); wrap.classList.add('ms'); wrap.innerHTML='';
  const btn=document.createElement('button'); btn.type='button'; btn.className='ms-btn';
  const panel=document.createElement('div'); panel.className='ms-panel'; panel.hidden=true;
  const bar=document.createElement('div'); bar.className='ms-bar';
  const bAll=document.createElement('a'); bAll.textContent='Select all'; bAll.href='#';
  const bClr=document.createElement('a'); bClr.textContent='Clear all'; bClr.href='#';
  bar.append(bAll,bClr);
  const search=document.createElement('input'); search.className='ms-search'; search.placeholder='Filter agencies…';
  const list=document.createElement('div'); list.className='ms-list';
  const allSubs=()=>groups.flatMap(g=>g.subs);
  const label=()=>{ const n=sel.size, tot=allSubs().length; return n===0?'None':(n===tot?'All agencies':n+' agencies'); };
  function renderList(){ const q=search.value.toLowerCase(); list.innerHTML='';
    for(const g of groups){ const subs=g.subs.filter(s=>!q||s.toLowerCase().includes(q)||g.dept.toLowerCase().includes(q)); if(!subs.length) continue;
      const drow=document.createElement('label'); drow.className='ms-dept'; const dcb=document.createElement('input'); dcb.type='checkbox';
      const inN=g.subs.filter(s=>sel.has(s)).length; dcb.checked=inN===g.subs.length; dcb.indeterminate=inN>0&&inN<g.subs.length;
      dcb.addEventListener('change',()=>{ if(dcb.checked){ for(const s of g.subs) sel.add(s); } else { for(const s of g.subs) sel.delete(s); }
        btn.textContent=label(); renderList(); onChange([...sel]); });
      drow.append(dcb,document.createTextNode(' '+g.dept)); list.append(drow);
      const box=document.createElement('div'); box.className='ms-sub';
      for(const s of subs){ const lab=document.createElement('label'); const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=sel.has(s);
        cb.addEventListener('change',()=>{ if(cb.checked)sel.add(s); else sel.delete(s); btn.textContent=label(); renderList(); onChange([...sel]); });
        lab.append(cb,document.createTextNode(' '+s)); box.append(lab); }
      list.append(box);
    } }
  bAll.addEventListener('click',e=>{ e.preventDefault(); for(const s of allSubs()) sel.add(s); btn.textContent=label(); renderList(); onChange([...sel]); });
  bClr.addEventListener('click',e=>{ e.preventDefault(); sel.clear(); btn.textContent=label(); renderList(); onChange([...sel]); });
  search.addEventListener('input',renderList);
  panel.append(search,bar,list); wrap.append(btn,panel); btn.textContent=label(); renderList();
  btn.addEventListener('click',e=>{ e.stopPropagation(); panel.hidden=!panel.hidden; });
  document.addEventListener('click',e=>{ if(!wrap.contains(e.target)) panel.hidden=true; });
}

function buildDepts(rows,order,suborder){
  const m=new Map();
  for(const r of rows){ if(r.grp==='ALL') continue; if(!m.has(r.dept)) m.set(r.dept,new Set()); m.get(r.dept).add(r.grp); }
  const ordered=[]; const seen=new Set();
  for(const d of order){ if(m.has(d)){ ordered.push(d); seen.add(d); } }
  for(const d of [...m.keys()].sort()){ if(!seen.has(d)) ordered.push(d); }
  const DEPTS=ordered.map(d=>{ const subs=[...m.get(d)]; const so=suborder[d];
    subs.sort((a,b)=>{ if(so){ const ia=so.indexOf(a),ib=so.indexOf(b); if(ia>=0||ib>=0) return (ia<0?99:ia)-(ib<0?99:ib); }
      const oa=a.startsWith('Other')?1:0, ob=b.startsWith('Other')?1:0; if(oa!==ob) return oa-ob; return a.localeCompare(b); });
    return {dept:d, subs}; });
  return {DEPTS, AGLIST:DEPTS.flatMap(g=>g.subs)};
}
function districtList(){ const src=FULL||CFULL; return src?[...new Set(src.map(r=>r.district))].sort():[]; }

async function ensureFull(){ if(FULL||fullLoading) return; fullLoading=true; document.getElementById("status").textContent="loading district detail…";
  try{ const r=await fetch("./data/agency_cube.csv",{cache:"reload"}); FULL=parseCSV_R(await r.text()); if(dMS) dMS.setItems(districtList()); }catch(e){ console.error(e); } fullLoading=false; }
async function ensureFullC(){ if(CFULL||cfullLoading) return; cfullLoading=true; document.getElementById("status").textContent="loading district detail…";
  try{ const r=await fetch("./data/civil_agency_cube.csv",{cache:"reload"}); CFULL=parseCSV_C(await r.text()); if(dMS) dMS.setItems(districtList()); }catch(e){ console.error(e); } cfullLoading=false; }
async function ensureCivil(){ if(CNAT||civilLoading) return; civilLoading=true; document.getElementById("status").textContent="loading civil data…";
  try{ const r=await fetch("./data/civil_agency_cube_national.csv",{cache:"reload"}); CNAT=parseCSV_C(await r.text());
    const b=buildDepts(CNAT,DEPT_ORDER_V,SUB_ORDER_V); DEPTS_V=b.DEPTS; AGLIST_V=b.AGLIST; }catch(e){ console.error(e); } civilLoading=false; }

function buildAgencyPicker(){
  document.getElementById('agencyLabel').textContent=isCiv()?'Client agency (grouped)':'Referring agency (grouped)';
  groupedSelect("agency",curDepts(),curAgs(),v=>{ if(isCiv()) state.agsC=new Set(v); else state.ags=new Set(v); render(); });
}
function populateMetric(){ const sel=document.getElementById("metric"); sel.innerHTML=metricsList().map(m=>`<option value="${m[0]}">${m[1]}</option>`).join("");
  if(!metricsList().some(m=>m[0]===curMetric())) setMetric(metricsList()[0][0]); sel.value=curMetric(); }

async function render(){ const st=document.getElementById("status");
  // toggle mode-specific controls
  document.getElementById('occbar').hidden=isCiv();
  document.getElementById('civMasters').hidden=!isCiv();
  const needFull=!(state.dists.has('National')||state.dists.size===0);
  if(needFull){ if(isCiv()) await ensureFullC(); else await ensureFull(); }
  st.textContent=(isCiv()?'Civil · U.S. as '+state.role+' · '+state.basis+' · ':'Criminal · ')+(state.dists.has('National')||state.dists.size===0?"National":[...state.dists].map(fmtDist).join(', '))+" · "+curAgs().size+" agencies";
  renderKPIs(); renderChart(); renderChart2(); renderChart3(); updateChartAccessibility(); renderTable();
}

async function switchClass(cls){
  state.cls=cls;
  if(isCiv()){ await ensureCivil(); if(!(state.dists.has('National')||state.dists.size===0)) await ensureFullC(); }
  populateMetric(); buildAgencyPicker(); render();
}

async function init(){ renderNav();
  try{ const r=await fetch("./data/agency_cube_national.csv",{cache:"reload"}); NAT=parseCSV_R(await r.text()); }
  catch(e){ document.getElementById("status").textContent="could not load agency_cube_national.csv - serve this folder over http"; return; }
  const ms=[...new Set(NAT.map(r=>r.ym))].sort(); SPINE=months(ms[0],ms[ms.length-1]);
  const b=buildDepts(NAT,DEPT_ORDER_R,SUB_ORDER_R); DEPTS_R=b.DEPTS; AGLIST_R=b.AGLIST;
  populateMetric();
  dMS=multiSelect("district",{items:[],allValue:"National",allLabel:"National (all)",initial:state.dists,searchable:true,fmt:fmtDist,
    onChange:async v=>{ state.dists=new Set(v); render(); }});
  buildAgencyPicker();
  document.getElementById("metric").addEventListener("change",e=>{ setMetric(e.target.value); render(); });
  document.querySelectorAll('#classSeg button').forEach(x=>x.addEventListener('click',()=>{ document.querySelectorAll('#classSeg button').forEach(y=>y.classList.remove('on')); x.classList.add('on'); switchClass(x.dataset.v); }));
  document.querySelectorAll('#occ button').forEach(x=>x.addEventListener('click',()=>{ document.querySelectorAll('#occ button').forEach(y=>y.classList.remove('on')); x.classList.add('on'); state.occ=x.dataset.v; render(); }));
  document.querySelectorAll('#role button').forEach(x=>x.addEventListener('click',()=>{ document.querySelectorAll('#role button').forEach(y=>y.classList.remove('on')); x.classList.add('on'); state.role=x.dataset.v; render(); }));
  document.querySelectorAll('#basis button').forEach(x=>x.addEventListener('click',()=>{ document.querySelectorAll('#basis button').forEach(y=>y.classList.remove('on')); x.classList.add('on'); state.basis=x.dataset.v; populateMetric(); render(); }));
  document.querySelectorAll('#mixMode button').forEach(x=>x.addEventListener('click',()=>{ document.querySelectorAll('#mixMode button').forEach(y=>y.classList.remove('on')); x.classList.add('on'); state.mixMode=x.dataset.v; renderChart2(); updateChartAccessibility(); }));
  document.querySelectorAll('#grain button').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('#grain button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); state.grain=b.dataset.v; renderChart(); renderChart2(); renderChart3(); }));
  document.querySelectorAll('#presets button').forEach(btn=>btn.addEventListener('click',()=>{ const k=btn.dataset.p;
    if(k==='all'){ state.admins.clear(); applyAdmins(); render(); return; }
    const ns=new Set(state.admins); ns.has(k)?ns.delete(k):ns.add(k);
    const idx=[...ns].map(x=>ADMIN_SEQ.indexOf(x)).sort((a,b)=>a-b);
    const contig=idx.length===0||(idx[idx.length-1]-idx[0]+1===idx.length);
    state.admins=contig?ns:new Set([k]); applyAdmins(); render(); }));
  for(const id of ["from","to"]){ const el=document.getElementById(id); el.min=ms[0]; el.max=ms[ms.length-1]; }
  state.to=ms[ms.length-1];PRESETS.trump2[1]=state.to;PRESETS.all[1]=state.to;document.getElementById("from").value=state.from; document.getElementById("to").value=state.to;
  document.getElementById("from").addEventListener("change",e=>{ state.admins.clear(); document.querySelectorAll('#presets button').forEach(y=>y.classList.remove('on')); state.from=e.target.value; render(); });
  document.getElementById("to").addEventListener("change",e=>{ state.admins.clear(); document.querySelectorAll('#presets button').forEach(y=>y.classList.remove('on')); state.to=e.target.value; render(); });
  document.getElementById("dl").addEventListener("click",buildCSV);
  document.getElementById('tblToggle').addEventListener('click',()=>{ const p=document.getElementById('tablePanel'); const willOpen=p.hidden; p.hidden=!willOpen; const b=document.getElementById('tblToggle'); b.textContent=(willOpen?'▾ Hide data table':'▸ Show data table'); b.setAttribute('aria-expanded',willOpen?'true':'false'); window.dispatchEvent(new Event('resize')); });
  // ── Deliberate prefetch. Do not "optimise" this into a lazy load. ──────────────
  // The district cube (agency_cube.csv, ~40 MB) is fetched on EVERY page load,
  // not on district selection. It is intentionally un-awaited, so it never blocks
  // first paint: the national view renders immediately and this streams in behind it.
  // The point is that opening the district filter and switching districts is instant,
  // rather than making the user wait on a multi-megabyte download mid-interaction.
  // Cary's call, 31 Aug 2026 - responsiveness over bytes. It is the dominant share of
  // this site's bandwidth, so read ops/DECISIONS.md D-016 before changing it.
  ensureFull(); render();
}
if(typeof document!=='undefined') init();
if(typeof module!=='undefined') module.exports={aggR,aggC,metricArrR,metricArrC,buildDepts};
