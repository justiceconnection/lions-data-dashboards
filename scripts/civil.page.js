const state={dists:new Set(['National']),cats:new Set(['ALL']),role:'Defendant',basis:'cases',metric:'cases_filed',seriesBy:'category',ax2:false,ax2by:'series',ax2sel:new Set(),kpiCat:'Immigration',mixMode:'stacked',admins:new Set(),from:'2013-01',to:'2026-06'};
let NAT=null, FULL=null, SPINE=[], fullLoading=false, dMS=null, cMS=null, ax2MS=null, chart=null, chart2=null, chart3=null, CATLIST=[];
const NUM=["matters_received","cases_filed","matters_terminated","cases_terminated","d_judg_us","d_settle","d_against","d_dismissed","d_other"];
const PALETTE=["#212123","#2a78d6","#d9622b","#1d9e75","#7a4fc0","#c02d5a","#0e8a8a","#b8860b","#5a6acf","#c23b8a","#7a7b76","#2f9e44","#e06a2b","#3b6fd4"];
const CATPAL=(window.LIONS_PAL||PALETTE);
const RPAL=["#2a78d6","#c02d5a","#1d9e75","#7a4fc0","#0e8a8a","#d9622b"];
const MULT=(window.LIONS_MULT&&window.LIONS_MULT.civil)||{cases_filed:[1.6598,1.1815,1.0872,1.0611,1.0438,1.0358,1.0313,1.0273],cases_terminated:[1.7179,1.2881,1.1729,1.1248,1.0884,1.0563,1.0393,1.0305]};
function hasPred(m){ return !!MULT[m]; }
function predOf(arr, metric){ const mm=MULT[metric]; if(!mm) return null; const last=SPINE.length-1;
  return arr.map((v,i)=>{ if(v==null) return null; const age=last-i; return v*(age>=0&&age<mm.length?mm[age]:1); }); }
const DISP=[["d_judg_us","Judgment For U.S.","#1d9e75"],["d_settle","Settlements","#2a78d6"],["d_against","Judgment Against U.S.","#d9622b"],["d_dismissed","Dismissed","#7a4fc0"],["d_other","Other","#8a8b86"]];
const METRICS_CASES=[["cases_filed","Cases filed"],["cases_pending","Cases pending"],["cases_terminated","Cases terminated"]];
const METRICS_MATTERS=[["matters_received","Matters received"],["matters_pending","Matters pending"],["matters_terminated","Matters terminated"]];
const PRESETS={obama2:["2013-01","2017-01"],trump1:["2017-01","2021-01"],biden:["2021-01","2025-01"],trump2:["2025-01","2026-06"],all:["2013-01","2026-06"]};
const CURRENT="civil.html";
function metricsList(){ return state.basis==='cases'?METRICS_CASES:METRICS_MATTERS; }
function primaryFlow(){ return state.basis==='cases'?'cf':'mr'; }
function primaryLabel(){ return state.basis==='cases'?'cases filed':'matters received'; }

function parseCSV(t){ const L=t.trim().split(/\r?\n/), H=L[0].split(","), I=Object.fromEntries(H.map((h,i)=>[h,i]));
  const out=new Array(L.length-1);
  for(let i=1;i<L.length;i++){ const c=L[i].split(","); const o={ym:c[I.ym],grp:c[I.category],role:c[I.role],district:I.district!==undefined?c[I.district]:"National"};
    for(const k of NUM) o[k]=+c[I[k]]||0; out[i-1]=o; } return out; }

function aggregateRaw(nat, full, spine, dists, cats, role){
  const useNat = dists.has('National') || dists.size===0;
  const catAll = cats.has('ALL') || cats.size===0;
  const want = catAll ? new Set(['ALL']) : cats;
  const idx=new Map();
  const add=r=>{ if(r.role!==role) return; if(catAll?(r.grp!=='ALL'):(r.grp==='ALL'||!want.has(r.grp))) return;
    let o=idx.get(r.ym); if(!o){o={mr:0,cf:0,mt:0,ct:0,ju:0,st:0,ag:0,dm:0,ot:0}; idx.set(r.ym,o);}
    o.mr+=r.matters_received; o.cf+=r.cases_filed; o.mt+=r.matters_terminated; o.ct+=r.cases_terminated;
    o.ju+=r.d_judg_us; o.st+=r.d_settle; o.ag+=r.d_against; o.dm+=r.d_dismissed; o.ot+=r.d_other; };
  if(useNat){ for(const r of nat) add(r); } else { for(const r of full) if(dists.has(r.district)) add(r); }
  const R={mr:[],cf:[],mt:[],ct:[],ju:[],st:[],ag:[],dm:[],ot:[]};
  for(const ym of spine){ const o=idx.get(ym); for(const k in R) R[k].push(o?o[k]:0); }
  return R;
}
const mean3=(a,i)=> i<2?null:(a[i]+a[i-1]+a[i-2])/3;
function cumsum(arr){ let acc=0; return arr.map(v=>acc+=v); }
function pendingSeries(R,kind){ // kind: 'matters' or 'cases'
  const delta = kind==='matters' ? R.mr.map((v,i)=>v-R.cf[i]-R.mt[i]) : R.cf.map((v,i)=>v-R.ct[i]);
  return cumsum(delta);
}
function metricArray(R, metric){ switch(metric){
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
function metricLabel(m){ const e=metricsList().find(x=>x[0]===m); return e?e[1]:m; }

function buildSeries(items, axis){
  const dsel=(state.dists.has('National')||state.dists.size===0)?['National']:[...state.dists];
  const csel=(state.cats.has('ALL')||state.cats.size===0)?['ALL']:[...state.cats];
  const out=[];
  if(state.seriesBy==='category'){ const ds=new Set(dsel);
    for(const cat of items) out.push({key:axis+':c:'+cat,label:(cat==='ALL'?'All causes':cat),dists:ds,cats:new Set([cat]),axis});
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
let lastRows=[];

function renderKPIs(){
  const R=aggregateRaw(NAT,FULL,SPINE,state.dists,state.cats,state.role);
  const arr=metricArray(R,state.metric); const idxs=visIdx(); if(!idxs.length) return;
  const isLevel=state.metric.includes('pending');
  const set=(id,v)=>document.getElementById(id).textContent=v;
  const fmtVal=v=> v==null?'—':Math.round(v).toLocaleString();
  const S=(a,ix)=>{ let s=0,any=false; for(const i of ix){ const v=a[i]; if(v!=null){s+=v;any=true;} } return any?s:null; };
  const avgOver=(ix)=>{ let s=0,n=0; for(const i of ix){ const v=arr[i]; if(v!=null){s+=v;n++;} } return n?s/n:null; };
  const e=idxs[idxs.length-1]; const last12=idxs.slice(-12);
  // KPI 1 & 2: flows -> totals; stocks (pending) -> ending level / recent-average level
  set('kpi1', fmtVal(isLevel?arr[e]:S(arr,idxs)));
  set('kpi2', fmtVal(isLevel?avgOver(last12):S(arr,last12)));
  // KPI 3: year-over-year change (kept)
  const avg3at=(i)=>{ if(i<2) return null; let s=0,n=0; for(let k=0;k<3;k++){ const v=arr[i-k]; if(v!=null){s+=v;n++;} } return n?s/n:null; };
  const chg=(a,b)=> (a==null||b==null||b===0)?null:100*(a-b)/Math.abs(b);
  const yoy=chg(avg3at(e),avg3at(e-12));
  set('kpi3', yoy==null?'—':((yoy>=0?'+':'')+yoy.toFixed(1)+'%'));
  // KPI 4: cause share change (kept)
  const sel=R[primaryFlow()], tot=aggregateRaw(NAT,FULL,SPINE,state.dists,new Set(['ALL']),state.role)[primaryFlow()];
  const sum3=(a,i)=> i<2?null:(a[i]+a[i-1]+a[i-2]);
  const shr=(i)=>{ const su=sum3(sel,i),t=sum3(tot,i); return (su!=null&&t)?100*su/t:null; };
  const comp=(shr(e)!=null&&shr(e-12)!=null)?shr(e)-shr(e-12):null;
  set('kpi4',comp==null?'—':(comp>=0?'+':'')+comp.toFixed(1)+' pts');
  document.getElementById('kpiMetric').textContent=metricLabel(state.metric);
  document.getElementById('kpi1lab').textContent=isLevel?'Latest (end of range)':'Total, selected range';
  document.getElementById('kpi2lab').textContent=isLevel?'Avg, last 12 months':'Total, last 12 months';
  document.getElementById('kpi1ym').textContent=idxs.length?('('+SPINE[idxs[0]]+' – '+SPINE[e]+')'):'';
  document.getElementById('kpi2ym').textContent=last12.length?('(ending '+SPINE[e]+')'):'';
  document.getElementById('kpiScope').textContent='U.S. as '+state.role+' · '+(state.dists.has('National')||state.dists.size===0?'National':state.dists.size+' districts')+' · '+(state.cats.has('ALL')||state.cats.size===0?'all causes':state.cats.size+' selected');
}

function renderTable(){
  const R=aggregateRaw(NAT,FULL,SPINE,state.dists,state.cats,state.role);
  const cols=[]; for(const [k,lbl] of metricsList()){ cols.push({key:k,label:lbl,pred:false}); if(hasPred(k)) cols.push({key:k,label:lbl+' (pred)',pred:true}); }
  const arrs=cols.map(c=>{ const a=metricArray(R,c.key); return c.pred?predOf(a,c.key).map(v=>v==null?null:Math.round(v)):a; });
  const rows=[];
  for(const i of visIdx()){ const ym=SPINE[i];
    rows.push({ym, vals:arrs.map(a=>a[i]), tag:ym<="1996-09"?"edge":(ym>="2026-03"?"recent":"")}); }
  lastRows={head:cols.map(c=>c.pred?c.key+'_pred':c.key),rows};
  document.getElementById("thead").innerHTML="<tr><th>Month</th>"+cols.map(c=>`<th>${c.label}</th>`).join("")+"</tr>";
  document.getElementById("tbody").innerHTML=rows.map(r=>{ const cls=r.tag?` class="${r.tag}"`:'';
    return `<tr${cls}><td>${r.ym}</td>`+r.vals.map(v=>`<td>${v==null?"—":(Number.isInteger(v)?rint(v):r1(v))}</td>`).join("")+`</tr>`;
  }).join("");
  const pf=primaryFlow(); const tot=metricArray(R, state.basis==='cases'?'cases_filed':'matters_received');
  const s=visIdx().reduce((a,i)=>a+tot[i],0);
  document.getElementById("summary").innerHTML=`<b>${rows.length}</b> months · ${primaryLabel()} <b>${Math.round(s).toLocaleString()}</b> · ${state.role} · ${state.cats.has('ALL')||state.cats.size===0?'all causes':[...state.cats].join(', ')}`;
}

const adminBands={id:'admin',beforeDraw(ch){ const labels=ch.data.labels; if(!labels||!labels.length)return;
  const x=ch.scales.x,area=ch.chartArea,ctx=ch.ctx; const half=labels.length>1?Math.abs(x.getPixelForValue(1)-x.getPixelForValue(0))/2:10;
  for(const ad of ADMINS){ let s=-1,e=-1; for(let i=0;i<labels.length;i++){ if(labels[i]>=ad.a&&labels[i]<ad.b){ if(s<0)s=i; e=i; } }
    if(s<0)continue; const x0=x.getPixelForValue(s)-half,x1=x.getPixelForValue(e)+half;
    ctx.save(); ctx.fillStyle=ad.c; ctx.fillRect(x0,area.top,x1-x0,area.bottom-area.top);
    ctx.fillStyle='rgba(70,70,66,0.7)'; ctx.font='11px sans-serif'; ctx.textAlign='center';
    if(x1-x0>44) ctx.fillText(ad.name,(x0+x1)/2,area.top+11); ctx.restore(); }
}};
function baseScales(pct,rightTitle,anyR){ return {x:{grid:{display:false,drawTicks:false},ticks:{color:'#6b6c68',font:{size:11},autoSkip:false,maxRotation:0,callback:function(v,index){const l=this.getLabelForValue(v);if(!l)return '';const s=String(l).split('-');return (s[1]==='01'||index===0)?s[0]:'';}}},
  y:{position:'left',beginAtZero:!pct,title:{display:true,text:metricLabel(state.metric),color:'#6b6c68',font:{size:11}},ticks:{color:'#6b6c68',font:{size:11},callback:pct?(v=>v+'%'):(v=>v.toLocaleString())},grid:{color:'#e6e6e3'}},
  y1:{position:'right',display:anyR,beginAtZero:!pct,title:{display:anyR,text:rightTitle,color:'#212123',font:{size:11}},ticks:{color:'#6b6c68',font:{size:11},callback:pct?(v=>v+'%'):(v=>v.toLocaleString())},grid:{drawOnChartArea:false}}}; }

const TT={enabled:false,external:extTooltip};
function renderChart(){
  const idxs=visIdx(), labels=idxs.map(i=>SPINE[i]); const pct=false;
  const left=buildSeries(leftItems(),'y');
  const metricMode=state.ax2by==='metric' && state.ax2sel.size>0;
  const right=(state.ax2by!=='metric' && state.ax2sel.size)?buildSeries([...state.ax2sel],'y1'):[];
  const mk=(s,j,pal,dash)=>{ const arr=metricArray(aggregateRaw(NAT,FULL,SPINE,s.dists,s.cats,state.role),state.metric); const col=pal[j%pal.length];
    return {label:s.label+(s.axis==='y1'?' (R)':''),data:idxs.map(i=>arr[i]),borderColor:col,backgroundColor:col,tension:.25,pointRadius:0,borderWidth:2,spanGaps:true,borderDash:dash?[5,4]:[],yAxisID:s.axis,_col:col}; };
  const leftDs=left.map((s,j)=>mk(s,j,PALETTE,false));
  const datasets=[...leftDs, ...right.map((s,j)=>mk(s,j,RPAL,true))];
  const rMetrics=metricMode?[...state.ax2sel]:[];
  rMetrics.forEach((m2,j)=>{ const arr=metricArray(aggregateRaw(NAT,FULL,SPINE,state.dists,state.cats,state.role),m2); const col=RPAL[j%RPAL.length];
    datasets.push({label:metricLabel(m2)+' (R)',data:idxs.map(i=>arr[i]),borderColor:col,backgroundColor:col,tension:.25,pointRadius:0,borderWidth:2,spanGaps:true,borderDash:[5,4],yAxisID:'y1',_col:col}); });
  const showPred=hasPred(state.metric);
  if(showPred){ left.forEach((s,ai)=>{ const arr=metricArray(aggregateRaw(NAT,FULL,SPINE,s.dists,s.cats,state.role),state.metric); const parr=predOf(arr,state.metric); const col=PALETTE[ai%PALETTE.length];
    datasets.push({label:s.label+' (est. final)',data:idxs.map(i=>parr[i]),borderColor:col,backgroundColor:col+'40',borderDash:[3,3],borderWidth:2,pointRadius:idxs.map(i=>((SPINE.length-1-i)<8)?2.4:0),pointBackgroundColor:col,pointBorderColor:col,spanGaps:true,tension:.25,yAxisID:'y',fill:{target:ai,above:col+'40',below:'transparent'},_col:col,_pred:true}); }); }
  const anyR=right.length>0||rMetrics.length>0;
  const rAxisTitle=(metricMode?(rMetrics.map(metricLabel).slice(0,3).join(', ')+(rMetrics.length>3?'…':'')):metricLabel(state.metric))+' (Right)';
  document.getElementById("legend").innerHTML=datasets.filter(ds=>!ds._pred).map(ds=>`<span class="lg"><span class="sw" style="background:${ds._col}"></span>${ds.label}</span>`).join("")
     + (anyR?'<span class="lg" style="color:var(--mut)">— dashed = right axis</span>':'')
     + (showPred?'<span class="lg" style="color:var(--mut)">┈ dotted = estimated final (reporting-lag adjusted)</span>':'');
  document.getElementById("chartTitle").textContent=metricLabel(state.metric)+" — "+state.role+" — by "+(state.seriesBy==='category'?'cause of action':'district');
  if(typeof window==='undefined'||!window.Chart){ return; }
  if(chart) chart.destroy();
  chart=mkChart(document.getElementById('chart').getContext('2d'),{type:'line',data:{labels,datasets},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:TT},
      scales:baseScales(false,rAxisTitle,anyR)},plugins:[adminBands]});
}

function renderChart2(){
  const idxs=visIdx(), labels=idxs.map(i=>SPINE[i]); const pf=primaryFlow();
  const allSel=(state.cats.has('ALL')||state.cats.size===0); const cats=allSel?CATLIST:[...state.cats];
  const tot=aggregateRaw(NAT,FULL,SPINE,state.dists,new Set(['ALL']),state.role)[pf];
  const cA={}; for(const c2 of cats) cA[c2]=aggregateRaw(NAT,FULL,SPINE,state.dists,new Set([c2]),state.role)[pf];
  let datasets;
  if(state.mixMode==='sum'){ const data=idxs.map(i=>{const t=tot[i];if(!t)return null;let s=0;for(const c2 of cats)s+=cA[c2][i];return 100*s/t;});
    datasets=[{label:(allSel?'All causes':cats.join(', ')),data,borderColor:'#212123',backgroundColor:'rgba(33,33,35,.10)',fill:true,tension:.25,pointRadius:0,borderWidth:2,_pct:true,_col:'#212123'}];
  } else { datasets=cats.map((c2,j)=>{const col=CATPAL[(CATLIST.indexOf(c2)+1)%CATPAL.length];return {label:c2,data:idxs.map(i=>{const t=tot[i];return t?100*cA[c2][i]/t:null;}),borderColor:col,backgroundColor:col+'cc',fill:true,tension:.2,pointRadius:0,borderWidth:0.8,_pct:true,_col:col};}); }
  document.getElementById("legend2").innerHTML=(state.mixMode==='stacked'?datasets:[{label:datasets[0].label,borderColor:'#212123'}]).map(ds=>`<span class="lg"><span class="sw" style="background:${ds.borderColor}"></span>${ds.label}</span>`).join("");
  document.getElementById("chart2Title").textContent="Cause of action mix — % of "+primaryLabel()+(state.mixMode==='stacked'?" (stacked)":" (combined)");
  if(typeof window==='undefined'||!window.Chart) return;
  datasets=datasets.slice().reverse();
  if(chart2) chart2.destroy();
  chart2=mkChart(document.getElementById('chart2').getContext('2d'),{type:'line',data:{labels,datasets},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:TT},
      scales:{x:{grid:{display:false,drawTicks:false},ticks:{color:'#6b6c68',font:{size:11},autoSkip:false,maxRotation:0,callback:function(v,index){const l=this.getLabelForValue(v);if(!l)return '';const s=String(l).split('-');return (s[1]==='01'||index===0)?s[0]:'';}}},y:{stacked:state.mixMode==='stacked',beginAtZero:true,title:{display:true,text:'% of '+primaryLabel(),color:'#6b6c68',font:{size:11}},ticks:{color:'#6b6c68',font:{size:11},callback:v=>v+'%'},grid:{color:'#e6e6e3'}}}},plugins:[adminBands]});
}

function renderChart3(){
  const box=document.getElementById('chart3box'), msg=document.getElementById('chart3msg');
  if(state.basis!=='cases'){ box.style.display='none'; msg.style.display='block'; msg.textContent='No disposition data for Matters — court dispositions apply to Cases only. Switch the basis toggle to Cases.'; document.getElementById('legend3').innerHTML=''; if(chart3){chart3.destroy();chart3=null;} return; }
  box.style.display=''; msg.style.display='none';
  const idxs=visIdx(), labels=idxs.map(i=>SPINE[i]);
  const R=aggregateRaw(NAT,FULL,SPINE,state.dists,state.cats,state.role);
  const datasets=DISP.map(([k,name,col],j)=>{ const key={d_judg_us:'ju',d_settle:'st',d_against:'ag',d_dismissed:'dm',d_other:'ot'}[k];
    return {label:name,data:idxs.map(i=>{const t=R.ct[i];return t?100*R[key][i]/t:null;}),borderColor:col,backgroundColor:col+'cc',fill:true,tension:.2,pointRadius:0,borderWidth:0.8,_pct:true,_col:col}; });
  document.getElementById("legend3").innerHTML=DISP.map(([k,name,col])=>`<span class="lg"><span class="sw" style="background:${col}"></span>${name}</span>`).join("");
  if(typeof window==='undefined'||!window.Chart) return;
  if(chart3) chart3.destroy();
  chart3=mkChart(document.getElementById('chart3').getContext('2d'),{type:'line',data:{labels,datasets:datasets.slice().reverse()},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:TT},
      scales:{x:{grid:{display:false,drawTicks:false},ticks:{color:'#6b6c68',font:{size:11},autoSkip:false,maxRotation:0,callback:function(v,index){const l=this.getLabelForValue(v);if(!l)return '';const s=String(l).split('-');return (s[1]==='01'||index===0)?s[0]:'';}}},y:{stacked:true,beginAtZero:true,title:{display:true,text:'% of cases terminated',color:'#6b6c68',font:{size:11}},ticks:{color:'#6b6c68',font:{size:11},callback:v=>v+'%'},grid:{color:'#e6e6e3'}}}},plugins:[adminBands]});
}

function updateChartAccessibility(){
  const chartEl=document.getElementById('chart');
  const chart2El=document.getElementById('chart2');
  const chart3El=document.getElementById('chart3');
  if(!chartEl||!chart2El||!chart3El) return;

  const distText=(state.dists.has('National')||state.dists.size===0)
    ?'National'
    :[...state.dists].map(fmtDist).join(', ');
  const catText=(state.cats.has('ALL')||state.cats.size===0)
    ?'all causes of action'
    :[...state.cats].join(', ');

  chartEl.setAttribute('aria-label',
    `${metricLabel(state.metric)} trend over time by ${state.seriesBy==='category'?'cause of action':'district'}. Filters: ${distText}; ${catText}; ${state.from} to ${state.to}; U.S. as ${state.role}; basis ${state.basis}.`
  );
  chart2El.setAttribute('aria-label',
    `Cause of action share over time as percent of ${primaryLabel()}, ${state.mixMode==='stacked'?'stacked view':'combined view'}. Filters: ${distText}; ${catText}; ${state.from} to ${state.to}; U.S. as ${state.role}; basis ${state.basis}.`
  );

  if(state.basis!=='cases'){
    chart3El.setAttribute('aria-label','Disposition mix chart unavailable for matters basis; switch basis to cases to view disposition percentages.');
    return;
  }
  chart3El.setAttribute('aria-label',
    `Disposition mix over time as percent of cases terminated. Filters: ${distText}; ${catText}; ${state.from} to ${state.to}; U.S. as ${state.role}; basis ${state.basis}.`
  );
}

function render(){ const st=document.getElementById("status");
  const needFull=!(state.dists.has('National')||state.dists.size===0)||state.seriesBy==='district';
  if(needFull && !FULL && fullLoading){ st.textContent="loading district detail…"; return; }
  st.textContent=(state.dists.has('National')||state.dists.size===0?"National":[...state.dists].map(fmtDist).join(', '))+" · U.S. as "+state.role+" · "+state.basis;
  renderKPIs(); renderChart(); renderChart2(); renderChart3(); updateChartAccessibility(); renderTable(); }

function buildCSV(){
  const head=["month",...lastRows.head];
  const L=[head.join(",")];
  for(const r of lastRows.rows) L.push([r.ym,...r.vals.map(v=>v==null?"":(Number.isInteger(v)?v:v.toFixed(2)))].join(","));
  const blob=new Blob([L.join("\n")],{type:"text/csv"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download=`civil_${state.role}_${state.basis}_${state.from}_${state.to}.csv`; a.click();
}

function multiSelect(mountId,opts){
  const wrap=document.getElementById(mountId); wrap.classList.add('ms'); wrap.innerHTML='';
  const btn=document.createElement('button'); btn.type='button'; btn.className='ms-btn';
  const panel=document.createElement('div'); panel.className='ms-panel'; panel.hidden=true;
  const bar=document.createElement('div'); bar.className='ms-bar';
  const bAll=document.createElement('a'); bAll.textContent='Select all'; bAll.href='#';
  const bClr=document.createElement('a'); bClr.textContent='Clear all'; bClr.href='#'; bar.append(bAll,bClr);
  let searchEl=null; const list=document.createElement('div'); list.className='ms-list'; const sel=opts.initial; const F=opts.fmt||(v=>v);
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
    const sel=document.createElement('select'); sel.innerHTML='<option value="">— pick a metric —</option>'+metricsList().map(m=>`<option value="${m[0]}">${m[1]}</option>`).join('');
    sel.addEventListener('change',()=>{ state.ax2sel=sel.value?new Set([sel.value]):new Set(); renderChart(); }); mount.append(sel);
  } else {
    ax2MS=multiSelect('ax2sel',{items:(state.seriesBy==='category'?CATLIST:districtList()),plain:true,emptyLabel:'pick series…',initial:state.ax2sel,searchable:state.seriesBy==='district',
      fmt:state.seriesBy==='district'?fmtDist:undefined, onChange:v=>{ state.ax2sel=new Set(v); renderChart(); }}); } }
async function ensureFull(){ if(FULL||fullLoading) return; fullLoading=true; document.getElementById("status").textContent="loading district detail…";
  try{ const r=await fetch("./data/civil_cube.csv",{cache:"reload"}); FULL=parseCSV(await r.text()); if(dMS) dMS.setItems(districtList()); }
  catch(e){ console.error(e); } fullLoading=false; }
function populateMetric(){ const sel=document.getElementById("metric"); sel.innerHTML=metricsList().map(m=>`<option value="${m[0]}">${m[1]}</option>`).join(""); state.metric=metricsList()[0][0]; sel.value=state.metric; }

async function init(){ renderNav();
  try{ const r=await fetch("./data/civil_cube_national.csv",{cache:"reload"}); NAT=parseCSV(await r.text()); }
  catch(e){ document.getElementById("status").textContent="could not load civil_cube_national.csv — serve this folder over http"; return; }
  const ms=[...new Set(NAT.map(r=>r.ym))].sort(); SPINE=months(ms[0],ms[ms.length-1]);
  CATLIST=[...new Set(NAT.map(r=>r.grp))].filter(g=>g!=="ALL").sort();
  populateMetric();
  dMS=multiSelect("district",{items:[],allValue:"National",allLabel:"National (all)",initial:state.dists,searchable:true,fmt:fmtDist,
    onChange:async v=>{ state.dists=new Set(v); if(!(state.dists.has('National')||state.dists.size===0)) await ensureFull(); render(); }});
  cMS=multiSelect("category",{items:CATLIST,allValue:"ALL",allLabel:"All causes",initial:state.cats,searchable:false,
    onChange:v=>{ state.cats=new Set(v); render(); }});
  buildAx2Picker();
  document.getElementById("metric").addEventListener("change",e=>{ state.metric=e.target.value; render(); });
  document.querySelectorAll('#role button').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('#role button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); state.role=b.dataset.v; render(); }));
  document.querySelectorAll('#basis button').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('#basis button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); state.basis=b.dataset.v; populateMetric(); if(state.ax2&&state.ax2by==='metric') buildAx2Picker(); render(); }));
  document.querySelectorAll('#seriesBy button').forEach(b=>b.addEventListener('click',async()=>{ document.querySelectorAll('#seriesBy button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); state.seriesBy=b.dataset.v; if(state.seriesBy==='district') await ensureFull(); if(state.ax2by==='series') buildAx2Picker(); render(); }));
  document.querySelectorAll('#mixMode button').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('#mixMode button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); state.mixMode=b.dataset.v; renderChart2(); updateChartAccessibility(); }));
  document.querySelectorAll('#ax2by button').forEach(b=>b.addEventListener('click',async()=>{ document.querySelectorAll('#ax2by button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); state.ax2by=b.dataset.v; if(state.ax2by!=='metric'&&state.seriesBy==='district') await ensureFull(); buildAx2Picker(); renderChart(); }));
  document.querySelectorAll('#presets button').forEach(b=>b.addEventListener('click',()=>{ const k=b.dataset.p;
    if(k==='all'){ state.admins.clear(); applyAdmins(); render(); return; }
    const ns=new Set(state.admins); ns.has(k)?ns.delete(k):ns.add(k);
    const idx=[...ns].map(x=>ADMIN_SEQ.indexOf(x)).sort((a,b)=>a-b);
    const contig=idx.length===0||(idx[idx.length-1]-idx[0]+1===idx.length);
    state.admins=contig?ns:new Set([k]); applyAdmins(); render(); }));
  for(const id of ["from","to"]){ const el=document.getElementById(id); el.min=ms[0]; el.max=ms[ms.length-1]; }
  document.getElementById("from").value=state.from; document.getElementById("to").value=state.to;
  document.getElementById("from").addEventListener("change",e=>{ state.admins.clear(); document.querySelectorAll('#presets button').forEach(x=>x.classList.remove('on')); state.from=e.target.value; render(); });
  document.getElementById("to").addEventListener("change",e=>{ state.admins.clear(); document.querySelectorAll('#presets button').forEach(x=>x.classList.remove('on')); state.to=e.target.value; render(); });
  document.getElementById("dl").addEventListener("click",buildCSV);
  document.getElementById('tblToggle').addEventListener('click',()=>{ const p=document.getElementById('tablePanel'); const willOpen=p.hidden; p.hidden=!willOpen; const b=document.getElementById('tblToggle'); b.textContent=(willOpen?'▾ Hide data table':'▸ Show data table'); b.setAttribute('aria-expanded',willOpen?'true':'false'); window.dispatchEvent(new Event('resize')); });
  ensureFull(); render();
}
if(typeof document!=='undefined') init();
if(typeof module!=='undefined') module.exports={aggregateRaw,metricArray,pendingSeries};
