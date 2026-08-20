const REASONS=[
  ["Insufficient Evidence","#212123"],
  ["Prioritization of Federal Resources and Interests","#2a78d6"],
  ["Matter Referred to Other Jurisdiction","#d9622b"],
  ["Alternative to Federal Prosecution","#1d9e75"],
  ["Defendant Unavailable","#7a4fc0"],
  ["Legally Barred","#c02d5a"],
  ["Non-Prosecution Agreement","#0e8a8a"],
  ["Other","#8a8b86"]
];
const REASON_ORDER=REASONS.map(r=>r[0]);
const RCOLOR=Object.fromEntries(REASONS);
const DEFAULT_REASONS=REASON_ORDER.filter(r=>r!=="Other"); // the 7
const state={dim:'category',dists:new Set(['National']),cats:new Set(['ALL']),ags:null,
  reasons:new Set(DEFAULT_REASONS),admins:new Set(),from:'2014-10',to:'2026-06'};
let CAT_NAT=null,CAT_FULL=null,AG_NAT=null,AG_FULL=null,SPINE=[],
  catFullLoading=false,agLoading=false,agFullLoading=false,dMS=null,chart=null,chart2=null;
let CATLIST=[],DEPTS_AG=[],AGLIST=[];
const PRESETS={obama2:["2013-01","2017-01"],trump1:["2017-01","2021-01"],biden:["2021-01","2025-01"],trump2:["2025-01","2026-06"],all:["2013-01","2026-06"]};
const DEPT_ORDER=["DOJ","DHS","Treasury","Defense","Interior","USPS","State","HHS","Agriculture","Labor","HUD","Veterans Affairs","Education","Energy/Environment","Commerce","State/Local & Other"];
const SUB_ORDER={"DOJ":["FBI","DEA","ATF","USMS","INS (legacy)","Other DOJ"],"DHS":["CBP","ICE","HSI","Secret Service","Coast Guard","TSA","DHS-OIG","Other DHS"]};
const CURRENT="declinations.html";

const isAg=()=>state.dim==='agency';
function parseCat(t){ const L=t.trim().split(/\r?\n/), H=L[0].split(","), I=Object.fromEntries(H.map((h,i)=>[h,i]));
  const out=new Array(L.length-1);
  for(let i=1;i<L.length;i++){ const c=L[i].split(",");
    out[i-1]={ym:c[I.ym],grp:c[I.category],reason:c[I.reason],declined:+c[I.declined]||0,district:I.district!==undefined?c[I.district]:"National"}; }
  return out; }
function parseAg(t){ const L=t.trim().split(/\r?\n/), H=L[0].split(","), I=Object.fromEntries(H.map((h,i)=>[h,i]));
  const out=new Array(L.length-1);
  for(let i=1;i<L.length;i++){ const c=L[i].split(",");
    out[i-1]={ym:c[I.ym],grp:c[I.subagency],dept:c[I.department],reason:c[I.reason],declined:+c[I.declined]||0,district:I.district!==undefined?c[I.district]:"National"}; }
  return out; }

// per-reason time series (summed over selected districts + selected categories/agencies)
function seriesByReason(){
  const useNat=state.dists.has('National')||state.dists.size===0;
  const rows=isAg()?(useNat?AG_NAT:AG_FULL):(useNat?CAT_NAT:CAT_FULL);
  const idxOf=new Map(SPINE.map((ym,i)=>[ym,i]));
  const out={}; for(const r of state.reasons) out[r]=new Array(SPINE.length).fill(0);
  if(!rows) return out;
  const catAll=!isAg() && (state.cats.has('ALL')||state.cats.size===0);
  const wantVals=isAg()?state.ags:state.cats;
  for(const row of rows){
    if(!useNat && !state.dists.has(row.district)) continue;
    if(catAll){ if(row.grp!=='ALL') continue; }
    else { if(row.grp==='ALL'||!wantVals.has(row.grp)) continue; }
    if(!state.reasons.has(row.reason)) continue;
    const i=idxOf.get(row.ym); if(i==null) continue;
    out[row.reason][i]+=row.declined;
  }
  return out;
}
function selReasons(){ return REASON_ORDER.filter(r=>state.reasons.has(r)); }

const adminBands={id:'admin',beforeDraw(ch){ const labels=ch.data.labels; if(!labels||!labels.length)return;
  const x=ch.scales.x,area=ch.chartArea,ctx=ch.ctx; const half=labels.length>1?Math.abs(x.getPixelForValue(1)-x.getPixelForValue(0))/2:10;
  for(const ad of ADMINS){ let s=-1,e=-1; for(let i=0;i<labels.length;i++){ if(labels[i]>=ad.a&&labels[i]<ad.b){ if(s<0)s=i; e=i; } }
    if(s<0)continue; const x0=x.getPixelForValue(s)-half,x1=x.getPixelForValue(e)+half;
    ctx.save(); ctx.fillStyle=ad.c; ctx.fillRect(x0,area.top,x1-x0,area.bottom-area.top);
    ctx.fillStyle='rgba(70,70,66,0.7)'; ctx.font='11px sans-serif'; ctx.textAlign='center';
    if(x1-x0>44) ctx.fillText(ad.name,(x0+x1)/2,area.top+11); ctx.restore(); }
}};

let SER={}, lastRows=[];
function scopeText(){ const dt=(state.dists.has('National')||state.dists.size===0)?'National':state.dists.size+' districts';
  const gv=isAg()?(state.ags&&state.ags.size===AGLIST.length?'all agencies':(state.ags?state.ags.size:0)+' agencies')
                 :((state.cats.has('ALL')||state.cats.size===0)?'all categories':state.cats.size+' categories');
  return dt+' · '+gv; }

const TT={enabled:false,external:extTooltip};
function renderChart(){
  const idxs=visIdx(), labels=idxs.map(i=>SPINE[i]); const rs=selReasons();
  const totals=idxs.map(i=>rs.reduce((a,r)=>a+SER[r][i],0));   // 100%-stacked: normalize to selected reasons
  const datasets=rs.map(r=>{ const col=RCOLOR[r]; return {label:r,data:idxs.map((i,j)=>{ const t=totals[j]; return t?100*SER[r][i]/t:null; }),borderColor:col,backgroundColor:col+'cc',fill:true,tension:.2,pointRadius:0,borderWidth:0.8,_pct:true,_col:col}; });
  document.getElementById("legend").innerHTML=rs.map(r=>`<span class="lg"><span class="sw" style="background:${RCOLOR[r]}"></span>${r}</span>`).join("");
  document.getElementById("chart1Title").textContent="Matters declined by reason — % share (stacked) — "+scopeText();
  if(typeof window==='undefined'||!window.Chart) return;
  if(chart) chart.destroy();
  chart=mkChart(document.getElementById('chart').getContext('2d'),{type:'line',data:{labels,datasets:datasets.slice().reverse()},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:TT},
      scales:{x:{grid:{display:false,drawTicks:false},ticks:{color:'#6b6c68',font:{size:11},autoSkip:false,maxRotation:0,callback:function(v,index){const l=this.getLabelForValue(v);if(!l)return '';const s=String(l).split('-');return (s[1]==='01'||index===0)?s[0]:'';}}},
        y:{stacked:true,beginAtZero:true,max:100,title:{display:true,text:'% of declined matters (selected reasons)',color:'#6b6c68',font:{size:11}},ticks:{color:'#6b6c68',font:{size:11},callback:v=>v+'%'},grid:{color:'#e6e6e3'}}}},
    plugins:[adminBands]});
}
function renderChart2(){
  const idxs=visIdx(), labels=idxs.map(i=>SPINE[i]); const rs=selReasons();
  const data=idxs.map(i=>rs.reduce((a,r)=>a+SER[r][i],0));
  const datasets=[{label:'Total declined (selected reasons)',data,borderColor:'#212123',backgroundColor:'rgba(33,33,35,.10)',fill:true,tension:.25,pointRadius:0,borderWidth:2,spanGaps:true,_col:'#212123'}];
  document.getElementById("legend2").innerHTML=`<span class="lg"><span class="sw" style="background:#212123"></span>Total of selected reasons</span>`;
  document.getElementById("chart2Title").textContent="Matters declined — total of selected reasons";
  if(typeof window==='undefined'||!window.Chart) return;
  if(chart2) chart2.destroy();
  chart2=mkChart(document.getElementById('chart2').getContext('2d'),{type:'line',data:{labels,datasets},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:TT},
      scales:{x:{grid:{display:false,drawTicks:false},ticks:{color:'#6b6c68',font:{size:11},autoSkip:false,maxRotation:0,callback:function(v,index){const l=this.getLabelForValue(v);if(!l)return '';const s=String(l).split('-');return (s[1]==='01'||index===0)?s[0]:'';}}},
        y:{beginAtZero:true,title:{display:true,text:'Matters declined',color:'#6b6c68',font:{size:11}},ticks:{color:'#6b6c68',font:{size:11},callback:v=>v.toLocaleString()},grid:{color:'#e6e6e3'}}}},
    plugins:[adminBands]});
}
function renderTable(){
  const rs=selReasons(); const rows=[]; let totAll=0; const totBy={}; for(const r of rs) totBy[r]=0;
  for(const i of visIdx()){ const ym=SPINE[i]; const vals=rs.map(r=>SER[r][i]); const tot=vals.reduce((a,b)=>a+b,0);
    rs.forEach((r,j)=>totBy[r]+=vals[j]); totAll+=tot;
    rows.push({ym,vals,tot,tag:ym>="2026-03"?"recent":""}); }
  lastRows={rs,rows};
  document.getElementById("thead").innerHTML="<tr><th>Month</th>"+rs.map(r=>`<th>${r}</th>`).join("")+"<th>Total</th></tr>";
  document.getElementById("tbody").innerHTML=rows.map(r=>{ const cls=r.tag?` class="${r.tag}"`:'';
    return `<tr${cls}><td>${r.ym}</td>`+r.vals.map(v=>`<td>${Math.round(v).toLocaleString()}</td>`).join("")+`<td>${Math.round(r.tot).toLocaleString()}</td></tr>`;
  }).join("");
  document.getElementById("summary").innerHTML=`<b>${rows.length}</b> months · <b>${Math.round(totAll).toLocaleString()}</b> matters declined · ${scopeText()}`;
  document.getElementById("note").textContent=rs.length===0?"Select at least one declination reason.":"";
}

function updateChartAccessibility(){
  const chartEl=document.getElementById('chart');
  const chart2El=document.getElementById('chart2');
  if(!chartEl||!chart2El) return;

  const distText=(state.dists.has('National')||state.dists.size===0)
    ?'National'
    :[...state.dists].map(fmtDist).join(', ');
  const dimText=isAg()?'referring agency':'program category';
  const groupText=isAg()
    ?((state.ags&&state.ags.size===AGLIST.length)?'all agencies':(state.ags?state.ags.size:0)+' selected agencies')
    :((state.cats.has('ALL')||state.cats.size===0)?'all categories':[...state.cats].join(', '));
  const reasonText=state.reasons.size===REASON_ORDER.length
    ?'all declination reasons'
    :[...state.reasons].join(', ');

  chartEl.setAttribute('aria-label',
    `Declinations by reason over time as stacked percent share. Breakdown mode: ${dimText}. Filters: ${distText}; ${groupText}; reasons: ${reasonText}; ${state.from} to ${state.to}.`
  );
  chart2El.setAttribute('aria-label',
    `Total declined matters over time for selected declination reasons. Breakdown mode: ${dimText}. Filters: ${distText}; ${groupText}; reasons: ${reasonText}; ${state.from} to ${state.to}.`
  );
}

async function render(){ const st=document.getElementById("status");
  document.getElementById('dimLabel').textContent=isAg()?'Referring agency (multi)':'Program category (multi)';
  const needFull=!(state.dists.has('National')||state.dists.size===0);
  if(isAg()){ if(!AG_NAT) await ensureAgency(); if(needFull) await ensureAgFull(); }
  else if(needFull){ await ensureCatFull(); }
  SER=seriesByReason();
  st.textContent=(isAg()?'By referring agency · ':'By program category · ')+scopeText();
  renderChart(); renderChart2(); updateChartAccessibility(); renderTable();
}

function buildCSV(){
  const rs=lastRows.rs, head=["month",...rs,"total"];
  const L=[head.join(",")];
  for(const r of lastRows.rows) L.push([r.ym,...r.vals.map(v=>Math.round(v)),Math.round(r.tot)].join(","));
  const blob=new Blob([L.join("\n")],{type:"text/csv"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  const dt=(state.dists.has('National')||state.dists.size===0)?'National':state.dists.size+'dists';
  a.download=`lions_declinations_${state.dim}_${dt}_${state.from}_${state.to}.csv`; a.click();
}

// flat multi-select; opts.plain => no All sentinel (used for reasons)
function multiSelect(mountId,opts){
  const wrap=document.getElementById(mountId); wrap.classList.add('ms'); wrap.innerHTML='';
  const btn=document.createElement('button'); btn.type='button'; btn.className='ms-btn';
  const panel=document.createElement('div'); panel.className='ms-panel'; panel.hidden=true;
  const bar=document.createElement('div'); bar.className='ms-bar';
  const bAll=document.createElement('a'); bAll.textContent='Select all'; bAll.href='#';
  const bClr=document.createElement('a'); bClr.textContent='Clear all'; bClr.href='#'; bar.append(bAll,bClr);
  let searchEl=null; const list=document.createElement('div'); list.className='ms-list'; const sel=opts.initial; const F=opts.fmt||(v=>v);
  const label=()=>{ if(opts.plain){ return sel.size===0?(opts.emptyLabel||'None'):(sel.size===opts.items.length?(opts.allLabel||'All'):sel.size+' selected'); }
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
  return { setItems(items){ opts.items=items; renderList(); btn.textContent=label(); } };
}
// grouped multi-select (agencies)
function groupedSelect(mountId,groups,sel,onChange){
  const wrap=document.getElementById(mountId); wrap.classList.add('ms'); wrap.innerHTML='';
  const btn=document.createElement('button'); btn.type='button'; btn.className='ms-btn';
  const panel=document.createElement('div'); panel.className='ms-panel'; panel.hidden=true;
  const bar=document.createElement('div'); bar.className='ms-bar';
  const bAll=document.createElement('a'); bAll.textContent='Select all'; bAll.href='#';
  const bClr=document.createElement('a'); bClr.textContent='Clear all'; bClr.href='#'; bar.append(bAll,bClr);
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
function buildDepts(rows){
  const m=new Map();
  for(const r of rows){ if(r.grp==='ALL') continue; if(!m.has(r.dept)) m.set(r.dept,new Set()); m.get(r.dept).add(r.grp); }
  const ordered=[]; const seen=new Set();
  for(const d of DEPT_ORDER){ if(m.has(d)){ ordered.push(d); seen.add(d); } }
  for(const d of [...m.keys()].sort()){ if(!seen.has(d)) ordered.push(d); }
  DEPTS_AG=ordered.map(d=>{ const subs=[...m.get(d)]; const so=SUB_ORDER[d];
    subs.sort((a,b)=>{ if(so){ const ia=so.indexOf(a),ib=so.indexOf(b); if(ia>=0||ib>=0) return (ia<0?99:ia)-(ib<0?99:ib); }
      const oa=a.startsWith('Other')?1:0, ob=b.startsWith('Other')?1:0; if(oa!==ob) return oa-ob; return a.localeCompare(b); });
    return {dept:d, subs}; });
  AGLIST=DEPTS_AG.flatMap(g=>g.subs);
}
function districtList(){ const src=CAT_FULL||AG_FULL; return src?[...new Set(src.map(r=>r.district))].sort():[]; }
async function ensureCatFull(){ if(CAT_FULL||catFullLoading) return; catFullLoading=true; document.getElementById("status").textContent="loading district detail…";
  try{ const r=await fetch("./data/decl_cat_cube.csv",{cache:"reload"}); CAT_FULL=parseCat(await r.text()); if(dMS) dMS.setItems(districtList()); }catch(e){ console.error(e); } catFullLoading=false; }
async function ensureAgency(){ if(AG_NAT||agLoading) return; agLoading=true; document.getElementById("status").textContent="loading agency data…";
  try{ const r=await fetch("./data/decl_agency_cube_national.csv",{cache:"reload"}); AG_NAT=parseAg(await r.text()); buildDepts(AG_NAT); if(!state.ags) state.ags=new Set(AGLIST); }catch(e){ console.error(e); } agLoading=false; }
async function ensureAgFull(){ if(AG_FULL||agFullLoading) return; agFullLoading=true; document.getElementById("status").textContent="loading district detail…";
  try{ const r=await fetch("./data/decl_agency_cube.csv",{cache:"reload"}); AG_FULL=parseAg(await r.text()); if(dMS) dMS.setItems(districtList()); }catch(e){ console.error(e); } agFullLoading=false; }

function buildDimPicker(){
  if(!isAg()){ multiSelect("dimpick",{items:CATLIST,allValue:"ALL",allLabel:"All categories",initial:state.cats,searchable:false,
      onChange:v=>{ state.cats=new Set(v); render(); }}); }
  else { if(!state.ags) state.ags=new Set(AGLIST); groupedSelect("dimpick",DEPTS_AG,state.ags,v=>{ state.ags=new Set(v); render(); }); }
}

async function init(){ renderNav();
  try{ const r=await fetch("./data/decl_cat_cube_national.csv",{cache:"reload"}); CAT_NAT=parseCat(await r.text()); }
  catch(e){ document.getElementById("status").textContent="could not load decl_cat_cube_national.csv — serve this folder over http"; return; }
  const ms=[...new Set(CAT_NAT.map(r=>r.ym))].sort(); SPINE=months(ms[0],ms[ms.length-1]);
  CATLIST=[...new Set(CAT_NAT.map(r=>r.grp))].filter(g=>g!=="ALL").sort();
  dMS=multiSelect("district",{items:[],allValue:"National",allLabel:"National (all)",initial:state.dists,searchable:true,fmt:fmtDist,
    onChange:v=>{ state.dists=new Set(v); render(); }});
  buildDimPicker();
  multiSelect("reason",{items:REASON_ORDER,plain:true,allLabel:"All reasons",emptyLabel:"pick reasons…",initial:state.reasons,searchable:false,
    onChange:v=>{ state.reasons=new Set(v); render(); }});
  document.querySelectorAll('#dimSeg button').forEach(x=>x.addEventListener('click',async()=>{ document.querySelectorAll('#dimSeg button').forEach(y=>y.classList.remove('on')); x.classList.add('on'); state.dim=x.dataset.v;
    if(isAg()) await ensureAgency(); buildDimPicker(); render(); }));
  document.querySelectorAll('#presets button').forEach(btn=>btn.addEventListener('click',()=>{ const k=btn.dataset.p;
    if(k==='all'){ state.admins.clear(); applyAdmins(); render(); return; }
    const ns=new Set(state.admins); ns.has(k)?ns.delete(k):ns.add(k);
    const idx=[...ns].map(x=>ADMIN_SEQ.indexOf(x)).sort((a,b)=>a-b);
    const contig=idx.length===0||(idx[idx.length-1]-idx[0]+1===idx.length);
    state.admins=contig?ns:new Set([k]); applyAdmins(); render(); }));
  for(const id of ["from","to"]){ const el=document.getElementById(id); el.min=ms[0]; el.max=ms[ms.length-1]; }
  document.getElementById("from").value=state.from; document.getElementById("to").value=state.to;
  document.getElementById("from").addEventListener("change",e=>{ state.admins.clear(); document.querySelectorAll('#presets button').forEach(y=>y.classList.remove('on')); state.from=e.target.value; render(); });
  document.getElementById("to").addEventListener("change",e=>{ state.admins.clear(); document.querySelectorAll('#presets button').forEach(y=>y.classList.remove('on')); state.to=e.target.value; render(); });
  document.getElementById("dl").addEventListener("click",buildCSV);
  document.getElementById('tblToggle').addEventListener('click',()=>{ const p=document.getElementById('tablePanel'); const willOpen=p.hidden; p.hidden=!willOpen; const b=document.getElementById('tblToggle'); b.textContent=(willOpen?'▾ Hide data table':'▸ Show data table'); b.setAttribute('aria-expanded',willOpen?'true':'false'); window.dispatchEvent(new Event('resize')); });
  ensureCatFull(); render();
}
if(typeof document!=='undefined') init();
if(typeof module!=='undefined') module.exports={seriesByReason,buildDepts};
