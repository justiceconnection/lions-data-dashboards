const state={dists:new Set(['National']),cats:new Set(['ALL']),metric:'cases_filed',seriesBy:'category',ax2:false,ax2by:'series',ax2sel:new Set(),occ:'all',kpiCat:'Immigration',mixMode:'stacked',admins:new Set(),from:'2013-01',to:'2026-06',grain:'month'};
let NAT=null, FULL=null, SPINE=[], fullLoading=false, dMS=null, cMS=null, ax2MS=null, chart=null, chart2=null, CATLIST=[];
let UMB=[], SPECS={}, CATMAP={ALL:{grp:'ALL',subcat:'ALL'}}, CATKEYS=[];
const NUM=["cases_filed","defendants_filed","cases_terminated","defendants_terminated","guilty","not_guilty","dismissed","rule_20_21","other"];
const PALETTE=["#212123","#2a78d6","#d9622b","#1d9e75","#7a4fc0","#c02d5a","#0e8a8a","#b8860b","#5a6acf","#c23b8a","#7a7b76","#2f9e44","#e06a2b","#3b6fd4"];
const CATPAL=(window.LIONS_PAL||PALETTE);
const RPAL=["#2a78d6","#c02d5a","#1d9e75","#7a4fc0","#0e8a8a","#d9622b"];
const MULT=(window.LIONS_MULT&&window.LIONS_MULT.criminal)||{cases_filed:[1.3018,1.0759,1.0437,1.0274,1.0227,1.017,1.0131,1.0118],cases_terminated:[2.9339,1.9899,1.6706,1.4302,1.248,1.1781,1.136,1.0995]};
function hasPred(m){ return m==='cases_filed'||m==='cases_terminated'||m==='clearance'; }
function predMetric(R, metric){
  if(metric==='cases_filed') return predOf(R.filed,'cases_filed');
  if(metric==='cases_terminated') return predOf(R.term,'cases_terminated');
  if(metric==='clearance'){ const pf=predOf(R.filed,'cases_filed'), pt=predOf(R.term,'cases_terminated');
    return pf.map((f,i)=> (f!=null&&f>0)?100*pt[i]/f:null); }
  return null; }
function predOf(arr, metric){ const mm=MULT[metric]; if(!mm) return null; const last=SPINE.length-1;
  return arr.map((v,i)=>{ if(v==null) return null; const age=last-i; return v*(age>=0&&age<mm.length?mm[age]:1); }); }
const METRICS=[["cases_filed","Cases filed"],["cases_terminated","Cases terminated"],["clearance","Clearance %"],["defendants_filed","Defendants filed"],["defendants_terminated","Defendants terminated"],["guilty_pct","Guilty disposition %"],["dismissed_pct","Dismissed disposition %"]];
const PRESETS={obama2:["2013-01","2017-01"],trump1:["2017-01","2021-01"],biden:["2021-01","2025-01"],trump2:["2025-01","2026-06"],all:["2013-01","2026-06"]};
const CURRENT="index.html";

function parseCSV(t){ const L=t.trim().split(/\r?\n/), H=L[0].split(","), I=Object.fromEntries(H.map((h,i)=>[h,i]));
  const out=new Array(L.length-1);
  for(let i=1;i<L.length;i++){ const c=L[i].split(","); const o={ym:c[I.ym],grp:c[I.grp],subcat:I.subcat!==undefined?c[I.subcat]:'ALL',occ:I.occ!==undefined?c[I.occ]:'all',district:I.district!==undefined?c[I.district]:"National"};
    for(const k of NUM) o[k]=+c[I[k]]||0; out[i-1]=o; } return out; }

function aggregateRaw(nat, full, spine, dists, cats){
  const useNat = dists.has('National') || dists.size===0;
  const catAll = cats.has('ALL') || cats.size===0;
  const occ=state.occ;
  // resolve selected category keys (umbrella names, specific labels, or ALL) -> grp|subcat targets
  let targets=null;
  if(!catAll){ targets=new Set(); for(const k of cats){ const t=CATMAP[k]; if(t) targets.add(t.grp+'\u0001'+t.subcat); } }
  const sub=r=> r.subcat||'ALL';
  const idx=new Map();
  const add=r=>{
    if(catAll){ if(!(r.grp==='ALL'&&sub(r)==='ALL')) return; }
    else { if(r.grp==='ALL'||r.occ!==occ) return; if(!targets.has(r.grp+'\u0001'+sub(r))) return; }
    let o=idx.get(r.ym);
    if(!o){o={filed:0,term:0,df:0,dt:0,guilty:0,dismissed:0}; idx.set(r.ym,o);}
    o.filed+=r.cases_filed; o.term+=r.cases_terminated; o.df+=r.defendants_filed; o.dt+=r.defendants_terminated; o.guilty+=r.guilty; o.dismissed+=r.dismissed; };
  if(useNat){ for(const r of nat) add(r); } else { for(const r of full) if(dists.has(r.district)) add(r); }
  const R={filed:[],term:[],df:[],dt:[],guilty:[],dismissed:[]};
  for(const ym of spine){ const o=idx.get(ym); R.filed.push(o?o.filed:0); R.term.push(o?o.term:0); R.df.push(o?o.df:0); R.dt.push(o?o.dt:0); R.guilty.push(o?o.guilty:0); R.dismissed.push(o?o.dismissed:0); }
  return R;
}
const mean3=(a,i)=> i<2?null:(a[i]+a[i-1]+a[i-2])/3;
const ratio3=(num,den,i)=>{ if(i<2)return null; const D=den[i]+den[i-1]+den[i-2],N=num[i]+num[i-1]+num[i-2]; return D>0?100*N/D:null; };
function metricArray(R, metric){ switch(metric){
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
const isPct=m=> m==='clearance'||m==='clearance_3mo'||m==='guilty_pct'||m==='dismissed_pct';
function metricLabel(m){ const e=METRICS.find(x=>x[0]===m); return e?e[1]:m; }
function catColor(cat){ const i=CATKEYS.indexOf(cat); return CATPAL[(i<0?0:i)%CATPAL.length]; }

function buildSeries(items, axis){
  const dsel=(state.dists.has('National')||state.dists.size===0)?['National']:[...state.dists];
  const csel=(state.cats.has('ALL')||state.cats.size===0)?['ALL']:[...state.cats];
  const out=[];
  if(state.seriesBy==='category'){ const ds=new Set(dsel);
    for(const cat of items) out.push({key:axis+':c:'+cat,label:(cat==='ALL'?'All categories':cat),dists:ds,cats:new Set([cat]),axis});
  } else { const cs=new Set(csel);
    for(const d of items) out.push({key:axis+':d:'+d,label:fmtDist(d),dists:new Set([d]),cats:cs,axis});
  }
  return out;
}
function leftItems(){ return state.seriesBy==='category'
    ? ((state.cats.has('ALL')||state.cats.size===0)?['ALL']:[...state.cats])
    : ((state.dists.has('National')||state.dists.size===0)?['National']:[...state.dists]); }
function rightLabelText(){ return state.ax2&&state.ax2sel.size?[...state.ax2sel].slice(0,3).join(', ')+(state.ax2sel.size>3?'…':''):''; }

const r1=x=>x==null?"—":x.toLocaleString(undefined,{maximumFractionDigits:1});
const rint=x=>x==null?"—":Math.round(x).toLocaleString();
const p1=x=>x==null?"—":x.toFixed(1);
let lastRows=[];

function renderKPIs(){
  const R=aggregateRaw(NAT,FULL,SPINE,state.dists,state.cats);
  const arr=metricArray(R,state.metric); const idxs=visIdx(); if(!idxs.length) return;
  const pct=isPct(state.metric);
  const set=(id,v)=>document.getElementById(id).textContent=v;
  const fmtVal=v=> v==null?'—':(pct?v.toFixed(1)+'%':Math.round(v).toLocaleString());
  const S=(a,ix)=>{ let s=0,any=false; for(const i of ix){ const v=a[i]; if(v!=null){s+=v;any=true;} } return any?s:null; };
  const rateOver=(ix)=>{ const m=state.metric;
    if(m==='clearance'){ const f=S(R.filed,ix),t=S(R.term,ix); return (f&&f>0)?100*t/f:null; }
    if(m==='guilty_pct'){ const d=S(R.dt,ix),g=S(R.guilty,ix); return (d&&d>0)?100*g/d:null; }
    if(m==='dismissed_pct'){ const d=S(R.dt,ix),x=S(R.dismissed,ix); return (d&&d>0)?100*x/d:null; }
    return null; };
  const aggOver=(ix)=> pct?rateOver(ix):S(arr,ix);
  const e=idxs[idxs.length-1]; const last12=idxs.slice(-12);
  // KPI 1 & 2: total (or blended rate) over the selected range and the last 12 months
  set('kpi1',fmtVal(aggOver(idxs))); set('kpi2',fmtVal(aggOver(last12)));
  // KPI 3: year-over-year change (kept) — 3-mo avg vs the same 3 months a year earlier
  const avg3at=(i)=>{ if(i<2) return null; let s=0,n=0; for(let k=0;k<3;k++){ const v=arr[i-k]; if(v!=null){s+=v;n++;} } return n?s/n:null; };
  const chg=(a,b)=> (a==null||b==null||b===0)?null:100*(a-b)/Math.abs(b);
  const yoy=chg(avg3at(e),avg3at(e-12));
  set('kpi3', yoy==null?'—':((yoy>=0?'+':'')+yoy.toFixed(1)+'%'));
  // KPI 4: category share change (kept)
  const sel=R.filed, tot=aggregateRaw(NAT,FULL,SPINE,state.dists,new Set(['ALL'])).filed;
  const sum3=(a,i)=> i<2?null:(a[i]+a[i-1]+a[i-2]);
  const shr=(i)=>{ const su=sum3(sel,i),t=sum3(tot,i); return (su!=null&&t)?100*su/t:null; };
  const comp=(shr(e)!=null&&shr(e-12)!=null)?shr(e)-shr(e-12):null;
  set('kpi4',comp==null?'—':(comp>=0?'+':'')+comp.toFixed(1)+' pts');
  document.getElementById('kpiMetric').textContent=metricLabel(state.metric);
  document.getElementById('kpi1lab').textContent=pct?'Overall rate, selected range':'Total, selected range';
  document.getElementById('kpi2lab').textContent=pct?'Overall rate, last 12 mo':'Total, last 12 months';
  document.getElementById('kpi1ym').textContent = idxs.length ? ('(' + fmtMMYYYY(SPINE[idxs[0]]) + ' – ' + fmtMMYYYY(SPINE[e]) + ')') : '';
  document.getElementById('kpi2ym').textContent = last12.length ? ('(ending ' + fmtMMYYYY(SPINE[e]) + ')') : '';
  document.getElementById('kpiScope').textContent=(state.dists.has('National')||state.dists.size===0?'National':state.dists.size+' districts')+' · '+(state.cats.has('ALL')||state.cats.size===0?'all categories':state.cats.size+' selected');
}

function renderTable(){
  const R=aggregateRaw(NAT,FULL,SPINE,state.dists,state.cats);
  const rows=[]; let sf=0,stt=0;
  for(const i of visIdx()){ const ym=SPINE[i]; const filed=R.filed[i],term=R.term[i],dt=R.dt[i];
    const row={ym,filed,term,df:R.df[i],dt,
      clr:filed>0?100*term/filed:null,
      gpct:dt>0?100*R.guilty[i]/dt:null,dpct:dt>0?100*R.dismissed[i]/dt:null,
      tag:ym<="1996-09"?"edge":(ym>="2026-03"?"recent":"")};
    rows.push(row); sf+=filed; stt+=term; }
  lastRows=rows;
  document.getElementById("tbody").innerHTML=rows.map(r=>{ const cls=r.tag?` class="${r.tag}"`:'';
    return `<tr${cls}><td>${r.ym}</td><td>${rint(r.filed)}</td><td>${rint(r.term)}</td><td>${p1(r.clr)}</td><td>${rint(r.df)}</td><td>${rint(r.dt)}</td><td>${p1(r.gpct)}</td><td>${p1(r.dpct)}</td></tr>`;
  }).join("");
  const ocl=sf>0?(100*stt/sf).toFixed(1)+"%":"—";
  document.getElementById("summary").innerHTML=`<b>${rows.length}</b> months · filed <b>${sf.toLocaleString()}</b> · terminated <b>${stt.toLocaleString()}</b>`;
  const multiCat=state.occ==='all'&&!(state.cats.has('ALL')||state.cats.size===0)&&state.cats.size>1;
  document.getElementById("note").textContent=multiCat?"Note: multiple categories are summed (all-occurrences) — a case in several selected categories is counted more than once.":"";
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
  const labels=grainLabels(B), ymAxis=B.map(b=>SPINE[b.idxs[0]]), pr=B.map(b=>b.partial?3.2:0), anyPartial=grainAnyPartial(B);
  const pct=isPct(state.metric);
  const left=buildSeries(leftItems(),'y');
  const metricMode = state.ax2by==='metric' && state.ax2sel.size>0;
  const right=(state.ax2by!=='metric' && state.ax2sel.size)?buildSeries([...state.ax2sel],'y1'):[];
  const mk=(s,j,pal,dash)=>{ const arr=metricArray(bucketComp(aggregateRaw(NAT,FULL,SPINE,s.dists,s.cats),B),state.metric); const col=pal[j%pal.length];
    return {label:s.label+(s.axis==='y1'?' (R)':''),data:arr,borderColor:col,backgroundColor:col,tension:.25,pointRadius:pr,pointStyle:'circle',pointBackgroundColor:'#fff',pointBorderColor:col,pointBorderWidth:1.4,pointHoverRadius:4,borderWidth:2,spanGaps:true,borderDash:dash?[5,4]:[],yAxisID:s.axis,_col:col,_pct:pct}; };
  const leftDs=left.map((s,j)=>mk(s,j,PALETTE,false));
  const datasets=[...leftDs, ...right.map((s,j)=>mk(s,j,RPAL,true))];
  const rMetrics = metricMode?[...state.ax2sel]:[];
  rMetrics.forEach((m2,j)=>{ const arr=metricArray(bucketComp(aggregateRaw(NAT,FULL,SPINE,state.dists,state.cats),B),m2); const col=RPAL[j%RPAL.length];
    datasets.push({label:metricLabel(m2)+' (R)',data:arr,borderColor:col,backgroundColor:col,tension:.25,pointRadius:pr,pointStyle:'circle',pointBackgroundColor:'#fff',pointBorderColor:col,pointBorderWidth:1.4,borderWidth:2,spanGaps:true,borderDash:[5,4],yAxisID:'y1',_col:col,_pct:isPct(m2)}); });
  const anyR=right.length>0||rMetrics.length>0;
  const rightPct=metricMode?rMetrics.every(isPct):pct;
  const rAxisTitle=(metricMode?(rMetrics.map(metricLabel).slice(0,3).join(', ')+(rMetrics.length>3?'…':'')):metricLabel(state.metric))+' (Right)';
  document.getElementById("legend").innerHTML=datasets.map(ds=>`<span class="lg"><span class="sw" style="background:${ds._col}"></span>${ds.label}</span>`).join("")
     + (anyR?'<span class="lg" style="color:var(--mut)">— dashed = right axis</span>':'')
     + (anyPartial?'<span class="lg" style="color:var(--mut)">* partial period (fewer months than the full period)</span>':'');
  document.getElementById("chartTitle").textContent=metricLabel(state.metric)+" — by "+(state.seriesBy==='category'?'program category':'district');
  if(typeof window==='undefined'||!window.Chart){ return; }
  const yfmt=pct?(v=>v+'%'):(v=>v.toLocaleString()); const y1fmt=rightPct?(v=>v+'%'):(v=>v.toLocaleString());
  const cfg={type:'line',data:{labels,datasets,_ym:ymAxis},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:TT},
      scales:{x:{grid:{display:false,drawTicks:false},ticks:{color:'#6b6c68',font:{size:11},autoSkip:state.grain!=='month',maxRotation:0,callback:grainTick(state.grain)}},
        y:{position:'left',beginAtZero:!pct,title:{display:true,text:metricLabel(state.metric),color:'#6b6c68',font:{size:11}},ticks:{color:'#6b6c68',font:{size:11},callback:yfmt},grid:{color:'#e6e6e3'}},
        y1:{position:'right',display:anyR,beginAtZero:!rightPct,title:{display:anyR,text:rAxisTitle,color:'#212123',font:{size:11}},ticks:{color:'#6b6c68',font:{size:11},callback:y1fmt},grid:{drawOnChartArea:false}}}},
    plugins:[adminBands]};
  if(chart) chart.destroy();
  chart=mkChart(document.getElementById('chart').getContext('2d'),cfg);
}

function renderChart2(){
  const idxs=visIdx(); const B=grainBuckets(SPINE,idxs,state.grain);
  const labels=grainLabels(B), ymAxis=B.map(b=>SPINE[b.idxs[0]]);
  const allSel=(state.cats.has('ALL')||state.cats.size===0);
  const cats=allSel?CATLIST:[...state.cats];
  const totB=bucketSum(aggregateRaw(NAT,FULL,SPINE,state.dists,new Set(['ALL'])).filed,B);
  const cAB={}; for(const c of cats) cAB[c]=bucketSum(aggregateRaw(NAT,FULL,SPINE,state.dists,new Set([c])).filed,B);
  let datasets;
  if(state.mixMode==='sum'){
    const data=totB.map((t,bi)=>{ if(!t)return null; let s=0; for(const c of cats) s+=cAB[c][bi]; return 100*s/t; });
    datasets=[{label:(allSel?'All categories':cats.join(', ')),data,borderColor:'#212123',backgroundColor:'rgba(33,33,35,.10)',fill:true,tension:.25,pointRadius:0,borderWidth:2,_pct:true,_col:'#212123'}];
  } else {
    datasets=cats.map(c=>{ const col=catColor(c); return {label:c,data:totB.map((t,bi)=>t?100*cAB[c][bi]/t:null),borderColor:col,backgroundColor:col+'cc',fill:true,tension:.2,pointRadius:0,borderWidth:0.8,_pct:true,_col:col}; });
  }
  document.getElementById("legend2").innerHTML=(state.mixMode==='stacked'?datasets:[{label:datasets[0].label,borderColor:'#212123'}]).map(ds=>`<span class="lg"><span class="sw" style="background:${ds.borderColor}"></span>${ds.label}</span>`).join("");
  document.getElementById("chart2Title").textContent="Program Category Distribution";
  if(typeof window==='undefined'||!window.Chart){ return; }
  const stacked=state.mixMode==='stacked';
  const cfg={type:'line',data:{labels,datasets,_ym:ymAxis},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:TT},
      scales:{x:{grid:{display:false,drawTicks:false},ticks:{color:'#6b6c68',font:{size:11},autoSkip:state.grain!=='month',maxRotation:0,callback:grainTick(state.grain)}},
        y:{stacked,beginAtZero:true,title:{display:true,text:'% of cases filed',color:'#6b6c68',font:{size:11}},ticks:{color:'#6b6c68',font:{size:11},callback:v=>v+'%'},grid:{color:'#e6e6e3'}}}},
    plugins:[adminBands]};
  cfg.data.datasets=cfg.data.datasets.slice().reverse();
  if(chart2) chart2.destroy();
  chart2=mkChart(document.getElementById('chart2').getContext('2d'),cfg);
}

function updateChartAccessibility(){
  const chartEl=document.getElementById('chart');
  const chart2El=document.getElementById('chart2');
  if(!chartEl||!chart2El) return;

  const distText=(state.dists.has('National')||state.dists.size===0)
    ?'National'
    :[...state.dists].map(fmtDist).join(', ');
  const catText=(state.cats.has('ALL')||state.cats.size===0)
    ?'all program categories'
    :[...state.cats].join(', ');
  const basisText=state.occ==='primary'
    ?'primary category only'
    :'all category occurrences';

  const seriesByText=state.seriesBy==='category'?'program category':'district';
  chartEl.setAttribute('aria-label',
    `${metricLabel(state.metric)} trend over time, series by ${seriesByText}. Filters: ${distText}; ${catText}; ${state.from} to ${state.to}; counting basis ${basisText}.`
  );

  const mixText=state.mixMode==='stacked'
    ?'stacked view by category'
    :'combined category share view';
  chart2El.setAttribute('aria-label',
    `Program category distribution over time as a share of cases filed, ${mixText}. Filters: ${distText}; ${catText}; ${state.from} to ${state.to}; counting basis ${basisText}.`
  );
}

function render(){ const st=document.getElementById("status");
  const needFull=!(state.dists.has('National')||state.dists.size===0)||state.seriesBy==='district';
  if(needFull && !FULL && fullLoading){ st.textContent="loading district detail…"; return; }
  st.textContent=(state.dists.has('National')||state.dists.size===0?"National":[...state.dists].map(fmtDist).join(', '))+" · "+(state.cats.has('ALL')||state.cats.size===0?"all categories":[...state.cats].join(', '));
  renderKPIs(); renderChart(); renderChart2(); updateChartAccessibility(); renderTable(); }

function buildCSV(){
  const head=["month","cases_filed","cases_terminated","clearance_pct","defendants_filed","defendants_terminated","guilty_pct","dismissed_pct"];
  const L=[head.join(",")];
  for(const r of lastRows) L.push([r.ym,r.filed,r.term,r.clr==null?"":r.clr.toFixed(2),r.df,r.dt,r.gpct==null?"":r.gpct.toFixed(2),r.dpct==null?"":r.dpct.toFixed(2)].join(","));
  const blob=new Blob([L.join("\n")],{type:"text/csv"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  const dt=(state.dists.has('National')||state.dists.size===0)?'National':(state.dists.size===1?[...state.dists][0]:state.dists.size+'dists');
  const ct=(state.cats.has('ALL')||state.cats.size===0)?'ALL':(state.cats.size===1?[...state.cats][0].replace(/\W+/g,''):state.cats.size+'cats');
  a.download=`lions_${dt}_${ct}_${state.from}_${state.to}.csv`; a.click();
}

function multiSelect(mountId,opts){
  const wrap=document.getElementById(mountId); wrap.classList.add('ms'); wrap.innerHTML='';
  const btn=document.createElement('button'); btn.type='button'; btn.className='ms-btn';
  const panel=document.createElement('div'); panel.className='ms-panel'; panel.hidden=true;
  const bar=document.createElement('div'); bar.className='ms-bar';
  const bAll=document.createElement('a'); bAll.textContent='Select all'; bAll.href='#';
  const bClr=document.createElement('a'); bClr.textContent='Clear all'; bClr.href='#';
  bar.append(bAll,bClr); let searchEl=null; const list=document.createElement('div'); list.className='ms-list'; const sel=opts.initial; const F=opts.fmt||(v=>v);
  const label=()=>{ if(opts.plain){ return sel.size===0?(opts.emptyLabel||'None'):(sel.size===1?F([...sel][0]):sel.size+' selected'); }
    return (sel.has(opts.allValue)||sel.size===0)?opts.allLabel:(sel.size===1?F([...sel][0]):sel.size+' selected'); };
  function renderList(){ const q=searchEl?searchEl.value.toLowerCase():''; list.innerHTML='';
    const items=(opts.plain?[]:[{v:opts.allValue,t:opts.allLabel}]).concat(opts.items.map(v=>({v,t:v})));
    for(const it of items){ if(q&&it.v!==opts.allValue&&!it.t.toLowerCase().includes(q)) continue;
      const lab=document.createElement('label'); const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=sel.has(it.v);
      cb.addEventListener('change',()=>{ if(!opts.plain&&it.v===opts.allValue){ sel.clear(); sel.add(opts.allValue); }
        else { if(!opts.plain) sel.delete(opts.allValue); if(cb.checked)sel.add(it.v); else sel.delete(it.v); if(!opts.plain&&sel.size===0)sel.add(opts.allValue); }
        btn.textContent=label(); renderList(); opts.onChange([...sel]); }); lab.append(cb,document.createTextNode(' '+(it.v===opts.allValue?it.t:F(it.v)))); list.append(lab); } }
  bAll.addEventListener('click',e=>{ e.preventDefault(); sel.clear(); for(const v of opts.items) sel.add(v); btn.textContent=label(); renderList(); opts.onChange([...sel]); });
  bClr.addEventListener('click',e=>{ e.preventDefault(); sel.clear(); if(!opts.plain) sel.add(opts.allValue); btn.textContent=label(); renderList(); opts.onChange([...sel]); });
  if(opts.searchable){ searchEl=document.createElement('input'); searchEl.className='ms-search'; searchEl.placeholder='Filter…'; searchEl.addEventListener('input',renderList); panel.append(searchEl); }
  panel.append(bar,list); wrap.append(btn,panel); btn.textContent=label(); renderList();
  btn.addEventListener('click',e=>{ e.stopPropagation(); panel.hidden=!panel.hidden; });
  document.addEventListener('click',e=>{ if(!wrap.contains(e.target)) panel.hidden=true; });
  return { setItems(items){ opts.items=items; renderList(); } };
}
function districtList(){ return FULL?[...new Set(FULL.map(r=>r.district))].sort():[]; }
function buildAx2Picker(){ state.ax2sel=new Set(); const mount=document.getElementById('ax2sel');
  if(state.ax2by==='metric'){ mount.classList.remove('ms'); mount.innerHTML='';
    const sel=document.createElement('select'); sel.innerHTML='<option value="">— pick a metric —</option>'+METRICS.map(m=>`<option value="${m[0]}">${m[1]}</option>`).join('');
    sel.addEventListener('change',()=>{ state.ax2sel=sel.value?new Set([sel.value]):new Set(); renderChart(); }); mount.append(sel);
  } else {
    ax2MS=multiSelect('ax2sel',{items:(state.seriesBy==='category'?CATLIST:districtList()),plain:true,emptyLabel:'pick series…',initial:state.ax2sel,searchable:state.seriesBy==='district',
      fmt:state.seriesBy==='district'?fmtDist:undefined, onChange:v=>{ state.ax2sel=new Set(v); renderChart(); }}); } }
// grouped program-category picker: umbrellas (each selectable as its own total) with
// collapsible specific sub-categories. 'All categories' default; groups collapsed by default.
function groupedCatSelect(mountId,opts){
  const wrap=document.getElementById(mountId); wrap.classList.add('ms'); wrap.innerHTML='';
  const sel=opts.initial; const expanded=new Set();
  const btn=document.createElement('button'); btn.type='button'; btn.className='ms-btn';
  const panel=document.createElement('div'); panel.className='ms-panel'; panel.hidden=true;
  const list=document.createElement('div'); list.className='ms-list';
  const label=()=> (sel.has('ALL')||sel.size===0)?'All categories':(sel.size===1?[...sel][0]:sel.size+' selected');
  const fire=()=>{ btn.textContent=label(); opts.onChange([...sel]); };
  const pick=(key,on)=>{ sel.delete('ALL'); if(on) sel.add(key); else { sel.delete(key); if(sel.size===0) sel.add('ALL'); } };
  function draw(){ list.innerHTML='';
    const allRow=document.createElement('label'); allRow.className='ms-allrow';
    const acb=document.createElement('input'); acb.type='checkbox'; acb.checked=sel.has('ALL');
    acb.addEventListener('change',()=>{ sel.clear(); sel.add('ALL'); draw(); fire(); });
    allRow.append(acb,document.createTextNode(' All categories')); list.append(allRow);
    for(const u of opts.umbrellas){ const specs=opts.specs[u]||[];
      const row=document.createElement('div'); row.className='ms-grp';
      const lab=document.createElement('label'); const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=sel.has(u);
      cb.addEventListener('change',()=>{ pick(u,cb.checked); draw(); fire(); });
      lab.append(cb,document.createTextNode(' '+u));
      if(specs.length){ const cnt=document.createElement('span'); cnt.className='cnt'; cnt.textContent=' ('+specs.length+' categor'+(specs.length===1?'y':'ies')+')'; lab.append(cnt); }
      row.append(lab);
      if(specs.length){ const cv=document.createElement('span'); cv.className='cv'; cv.textContent=expanded.has(u)?'▾':'▸';
        cv.title=expanded.has(u)?'Collapse':'Expand sub-categories';
        cv.addEventListener('click',e=>{ e.stopPropagation(); expanded.has(u)?expanded.delete(u):expanded.add(u); draw(); });
        row.append(cv); }
      list.append(row);
      if(specs.length && expanded.has(u)){ const box=document.createElement('div'); box.className='ms-sub';
        for(const s of specs){ const sl=document.createElement('label'); const scb=document.createElement('input'); scb.type='checkbox'; scb.checked=sel.has(s);
          scb.addEventListener('change',()=>{ pick(s,scb.checked); draw(); fire(); });
          sl.append(scb,document.createTextNode(' '+s)); box.append(sl); }
        list.append(box); } }
  }
  panel.append(list); wrap.append(btn,panel); btn.textContent=label(); draw();
  btn.addEventListener('click',e=>{ e.stopPropagation(); panel.hidden=!panel.hidden; });
  document.addEventListener('click',e=>{ if(!wrap.contains(e.target)) panel.hidden=true; });
  return { setItems(){} };
}
// district cube is served gzip-compressed (specific categories make it large); decompress in-browser.
async function fetchText(url){ const r=await fetch(url,{cache:"reload"});
  if(url.endsWith('.gz')){ const buf=new Uint8Array(await r.arrayBuffer());
    // 0x1f 0x8b = gzip magic. Present -> still compressed (decompress here); absent -> the
    // host already applied Content-Encoding and the browser decompressed it (use as text).
    if(buf.length>1 && buf[0]===0x1f && buf[1]===0x8b && typeof DecompressionStream!=='undefined'){
      return await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text(); }
    return new TextDecoder().decode(buf); }
  return await r.text(); }
async function ensureFull(){ if(FULL||fullLoading) return;
  fullLoading=true; document.getElementById("status").textContent="loading district detail…";
  try{ FULL=parseCSV(await fetchText("./data/lions_cube.csv.gz")); if(dMS) dMS.setItems(districtList()); }
  catch(e){ console.error(e); document.getElementById("status").textContent="could not load district detail"; } fullLoading=false; }

async function init(){ renderNav();
  try{ const r=await fetch("./data/lions_cube_national.csv",{cache:"reload"}); NAT=parseCSV(await r.text()); }
  catch(e){ document.getElementById("status").textContent="could not load lions_cube_national.csv — serve this folder over http"; return; }
  const ms=[...new Set(NAT.map(r=>r.ym))].sort(); SPINE=months(ms[0],ms[ms.length-1]);
  UMB=[...new Set(NAT.filter(r=>r.grp!=='ALL').map(r=>r.grp))].sort((a,b)=>(a==='All Other')-(b==='All Other')||a.localeCompare(b));
  SPECS={}; for(const u of UMB) SPECS[u]=[];
  for(const r of NAT){ if(r.grp!=='ALL' && r.subcat && r.subcat!=='ALL' && r.subcat!==r.grp && !SPECS[r.grp].includes(r.subcat)) SPECS[r.grp].push(r.subcat); }
  for(const u of UMB) SPECS[u].sort((a,b)=>((a.startsWith('Other')?1:0)-(b.startsWith('Other')?1:0))||a.localeCompare(b));
  CATLIST=UMB.slice();
  CATKEYS=[...UMB]; for(const u of UMB) CATKEYS.push(...SPECS[u]);
  CATMAP={ALL:{grp:'ALL',subcat:'ALL'}};
  for(const u of UMB){ CATMAP[u]={grp:u,subcat:'ALL'}; for(const s of SPECS[u]) CATMAP[s]={grp:u,subcat:s}; }
  document.getElementById("metric").innerHTML=METRICS.map(m=>`<option value="${m[0]}">${m[1]}</option>`).join("");
  dMS=multiSelect("district",{items:[],allValue:"National",allLabel:"National (all)",initial:state.dists,searchable:true,fmt:fmtDist,
    onChange:async v=>{ state.dists=new Set(v); if(!(state.dists.has('National')||state.dists.size===0)) await ensureFull(); render(); }});
  cMS=groupedCatSelect("category",{umbrellas:UMB,specs:SPECS,initial:state.cats,onChange:v=>{ state.cats=new Set(v); render(); }});
  buildAx2Picker();
  document.getElementById("metric").addEventListener("change",e=>{ state.metric=e.target.value; render(); });
  document.querySelectorAll('#seriesBy button').forEach(b=>b.addEventListener('click',async()=>{ document.querySelectorAll('#seriesBy button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); state.seriesBy=b.dataset.v;
    if(state.seriesBy==='district') await ensureFull(); if(state.ax2by==='series') buildAx2Picker(); render(); }));
  document.querySelectorAll('#mixMode button').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('#mixMode button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); state.mixMode=b.dataset.v; renderChart2(); }));
  document.querySelectorAll('#grain button').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('#grain button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); state.grain=b.dataset.v; renderChart(); renderChart2(); }));
  document.querySelectorAll('#occ button').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('#occ button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); state.occ=b.dataset.v; render(); }));
  document.querySelectorAll('#ax2by button').forEach(b=>b.addEventListener('click',async()=>{ document.querySelectorAll('#ax2by button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); state.ax2by=b.dataset.v; if(state.ax2by!=='metric'&&state.seriesBy==='district') await ensureFull(); buildAx2Picker(); renderChart(); }));
  document.querySelectorAll('#presets button').forEach(b=>b.addEventListener('click',()=>{ const k=b.dataset.p;
    if(k==='all'){ state.admins.clear(); applyAdmins(); render(); return; }
    const ns=new Set(state.admins); ns.has(k)?ns.delete(k):ns.add(k);
    const idx=[...ns].map(x=>ADMIN_SEQ.indexOf(x)).sort((a,b)=>a-b);
    const contig=idx.length===0||(idx[idx.length-1]-idx[0]+1===idx.length);
    state.admins=contig?ns:new Set([k]); applyAdmins(); render(); }));
  for(const id of ["from","to"]){ const el=document.getElementById(id); el.min=ms[0]; el.max=ms[ms.length-1]; }
  state.to=ms[ms.length-1];PRESETS.trump2[1]=state.to;PRESETS.all[1]=state.to;document.getElementById("from").value=state.from; document.getElementById("to").value=state.to;
  document.getElementById("from").addEventListener("change",e=>{ state.admins.clear(); document.querySelectorAll('#presets button').forEach(x=>x.classList.remove('on')); state.from=e.target.value; render(); });
  document.getElementById("to").addEventListener("change",e=>{ state.admins.clear(); document.querySelectorAll('#presets button').forEach(x=>x.classList.remove('on')); state.to=e.target.value; render(); });
  document.getElementById("dl").addEventListener("click",buildCSV);
  document.getElementById('tblToggle').addEventListener('click',()=>{ const p=document.getElementById('tablePanel'); const willOpen=p.hidden; p.hidden=!willOpen; const b=document.getElementById('tblToggle'); b.textContent=(willOpen?'▾ Hide data table':'▸ Show data table'); b.setAttribute('aria-expanded',willOpen?'true':'false'); window.dispatchEvent(new Event('resize')); });
  ensureFull(); render();
}
if(typeof document!=='undefined') init();
if(typeof module!=='undefined') module.exports={aggregateRaw,metricArray};
