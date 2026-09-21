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
  reasons:new Set(DEFAULT_REASONS),admins:new Set(),from:'2014-10',to:'2026-06',grain:'month',
  rowsBy:{district:false,dim:false},tblCols:{reasons:true,shares:true,totals:true}};
let CAT_NAT=null,CAT_FULL=null,AG_NAT=null,AG_FULL=null,SPINE=[],
  catFullLoading=false,agLoading=false,agFullLoading=false,dMS=null,chart=null,chart2=null;
let CATLIST=[],DEPTS_AG=[],AGLIST=[];
// Each band's `to` is its LAST month, not the next administration's first. `b` in ADMINS
// (shared/config.js) is an EXCLUSIVE end, and visIdx() filters from <= ym <= to, so a `to`
// of "2021-01" put January 2021 - Biden's first month - inside the Trump I range and made
// it 49 months against the band's 48 (L-221).
const PRESETS={obama2:["2013-01","2016-12"],trump1:["2017-01","2020-12"],biden:["2021-01","2024-12"],trump2:["2025-01","2026-06"],all:["2013-01","2026-06"]};
const DEPT_ORDER=["DOJ","DHS","Treasury","Defense","Interior","USPS","State","HHS","Agriculture","Labor","HUD","Veterans Affairs","Education","Energy/Environment","Commerce","State/Local & Other"];
const SUB_ORDER={"DOJ":["FBI","DEA","ATF","USMS","INS (legacy)","Other DOJ"],"DHS":["CBP","ICE","HSI","Secret Service","Coast Guard","TSA","DHS-OIG","Other DHS"]};
const CURRENT="declinations.html";
// Provisional (right-censored) data - L-014, revised to rev B in L-021.
// Spec: ops/handoffs/L-003-design-spec.md (revision B).
// All the logic lives in shared/provisional.js; this page only makes calls.
// Two things this page owns for rev B, neither of them logic:
//   scales.x.ticks.padding:6 on every chart carrying the treatment - a LAYOUT
//     PRECONDITION of the gutter bar (spec §3.6/§6.9), not a style choice. The bar lives in that space; Chart.js defaults to 3 and the bar would touch the tick labels.
//   _stacked:true on datasets built for a stacked render - the input to LIONS_PROV.decorateLine's refusal to fade a stacked fill (spec §6.7).
//     Set per render, because the mix charts flip family at runtime.
// A declination is a disposition event on a criminal matter, so `declined` is criminal
// OUTFLOW: window 6 months, on both charts, the table and the CSV.
const PV=window.LIONS_PROV;
const SL=window.LIONS_STATUS;
const PVOPT={civil:false};
const PROV_METRIC='declined';

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
// `reasons` defaults to the page's own selection; the topline section passes all eight in
// to build the share denominator without disturbing state (L-204).
function seriesByReason(reasons){
  const want=reasons||state.reasons;
  const useNat=state.dists.has('National')||state.dists.size===0;
  const rows=isAg()?(useNat?AG_NAT:AG_FULL):(useNat?CAT_NAT:CAT_FULL);
  const idxOf=new Map(SPINE.map((ym,i)=>[ym,i]));
  const out={}; for(const r of want) out[r]=new Array(SPINE.length).fill(0);
  if(!rows) return out;
  const catAll=!isAg() && (state.cats.has('ALL')||state.cats.size===0);
  const wantVals=isAg()?state.ags:state.cats;
  for(const row of rows){
    if(!useNat && !state.dists.has(row.district)) continue;
    if(catAll){ if(row.grp!=='ALL') continue; }
    else { if(row.grp==='ALL'||!wantVals.has(row.grp)) continue; }
    if(!want.has(row.reason)) continue;
    const i=idxOf.get(row.ym); if(i==null) continue;
    out[row.reason][i]+=row.declined;
  }
  return out;
}
function selReasons(){ return REASON_ORDER.filter(r=>state.reasons.has(r)); }

// Every reason under the SAME district and category/agency selection, whatever the
// reason filter is. This is the share denominator for the topline section: invariant 3
// says the total is the cube's own total row, and on the declination cubes the eight
// reasons partition category='ALL' exactly (ratio 1.000000, D-039/D-040), so summing
// all eight of them under one selection IS that row rather than an over-count.
function allReasonTotal(){
  const S=seriesByReason(new Set(REASON_ORDER)), out=new Array(SPINE.length).fill(0);
  for(const r of REASON_ORDER){ const a=S[r]; if(!a) continue;
    for(let i=0;i<out.length;i++) out[i]+=a[i]; }
  return out;
}

const adminBands={id:'admin',beforeDraw(ch){ const labels=ch.data._ym||ch.data.labels; if(!labels||!labels.length)return;
  const x=ch.scales.x,area=ch.chartArea,ctx=ch.ctx; const half=labels.length>1?Math.abs(x.getPixelForValue(1)-x.getPixelForValue(0))/2:10;
  for(const ad of ADMINS){ let s=-1,e=-1; for(let i=0;i<labels.length;i++){ if(labels[i]>=ad.a&&labels[i]<ad.b){ if(s<0)s=i; e=i; } }
    if(s<0)continue; const x0=x.getPixelForValue(s)-half,x1=x.getPixelForValue(e)+half;
    ctx.save(); ctx.fillStyle=ad.c; ctx.fillRect(x0,area.top,x1-x0,area.bottom-area.top);
    ctx.fillStyle='rgba(70,70,66,0.7)'; ctx.font='11px sans-serif'; ctx.textAlign='center';
    if(x1-x0>44) ctx.fillText(ad.name,(x0+x1)/2,area.top+11); ctx.restore(); }
}};

let SER={};
function scopeText(){ const dt=(state.dists.has('National')||state.dists.size===0)?'National':state.dists.size+' districts';
  const gv=isAg()?(state.ags&&state.ags.size===AGLIST.length?'all agencies':(state.ags?state.ags.size:0)+' agencies')
                 :((state.cats.has('ALL')||state.cats.size===0)?'all categories':state.cats.size+' categories');
  return dt+' · '+gv; }

const TT={enabled:false,external:extTooltip};
function renderChart(){
  const idxs=visIdx(); const B=grainBuckets(SPINE,idxs,state.grain);
  const labels=grainLabels(B), ymAxis=B.map(b=>SPINE[b.idxs[0]]);
  const rs=selReasons();
  // ratio-of-sums: bucket each reason's monthly series, then normalize by the bucketed total of selected reasons
  const rB={}; for(const r of rs) rB[r]=bucketSum(SER[r],B);
  const totals=B.map((b,bi)=>rs.reduce((a,r)=>a+rB[r][bi],0));   // 100%-stacked: normalize to selected reasons
  // Provisional: a normalised share chart, so under-reporting distorts the MIX (reasons
  // mature at different rates) rather than simply lowering the edge - 'mix' wording.
  const nProv=PV.n(PROV_METRIC,PVOPT), flagsProv=PV.bucketFlags(SPINE,B,nProv);
  const datasets=rs.map(r=>{ const col=RCOLOR[r]; return {label:r,data:totals.map((t,bi)=>t?100*rB[r][bi]/t:null),borderColor:col,backgroundColor:col+'cc',fill:true,tension:.2,pointRadius:0,borderWidth:0.8,_pct:true,_col:col,_stacked:true}; });
  document.getElementById("legend").innerHTML=rs.map(r=>`<span class="lg"><span class="sw" style="background:${RCOLOR[r]}"></span>${r}</span>`).join("")
    + (PV.anyProv(flagsProv)?PV.legendChip(nProv,'mix'):'');
  document.getElementById("chart1Title").textContent="Matters declined by reason - % share (stacked) - "+scopeText();
  if(typeof window==='undefined'||!window.Chart) return;
  if(chart) chart.destroy();
  chart=mkChart(document.getElementById('chart').getContext('2d'),{type:'line',data:{labels,datasets:datasets.slice().reverse(),_ym:ymAxis,_prov:PV.anyProv(flagsProv)?flagsProv:null},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:TT},
      scales:{x:{grid:{display:false,drawTicks:false},ticks:{color:'#6b6c68',font:{size:11},autoSkip:state.grain!=='month',maxRotation:0,padding:6,callback:grainTick(state.grain)}},
        y:{stacked:true,beginAtZero:true,max:100,title:{display:true,text:'% of declined matters (selected reasons)',color:'#6b6c68',font:{size:11}},ticks:{color:'#6b6c68',font:{size:11},callback:v=>v+'%'},grid:{color:'#e6e6e3'}}}},
    plugins:[adminBands,PV.plugin]});
}
function renderChart2(){
  const idxs=visIdx(); const B=grainBuckets(SPINE,idxs,state.grain);
  const labels=grainLabels(B), ymAxis=B.map(b=>SPINE[b.idxs[0]]), pr=B.map(b=>b.partial?3.2:0), anyPartial=grainAnyPartial(B);
  const rs=selReasons();
  const totalArr=SPINE.map((_,i)=>rs.reduce((a,r)=>a+SER[r][i],0));
  const data=bucketSum(totalArr,B);
  const nProv=PV.n(PROV_METRIC,PVOPT), flagsProv=PV.bucketFlags(SPINE,B,nProv);
  const datasets=[PV.decorateLine({label:'Total declined (selected reasons)',data,borderColor:'#212123',backgroundColor:'rgba(33,33,35,.10)',fill:true,tension:.25,pointRadius:pr,pointStyle:'circle',pointBackgroundColor:'#fff',pointBorderColor:'#212123',pointBorderWidth:1.4,pointHoverRadius:4,borderWidth:2,spanGaps:true,_col:'#212123'},flagsProv,pr)];
  document.getElementById("legend2").innerHTML=`<span class="lg"><span class="sw" style="background:#212123"></span>Total of selected reasons</span>`
    +(anyPartial?'<span class="lg" style="color:var(--mut)">* partial period (fewer months than the full period)</span>':'')
    +(PV.anyProv(flagsProv)?PV.legendChip(nProv,PV.dir(PROV_METRIC)):'');   // separate marker from "*" - two different facts
  document.getElementById("chart2Title").textContent="Matters declined - total of selected reasons";
  if(typeof window==='undefined'||!window.Chart) return;
  if(chart2) chart2.destroy();
  chart2=mkChart(document.getElementById('chart2').getContext('2d'),{type:'line',data:{labels,datasets,_ym:ymAxis,_prov:PV.anyProv(flagsProv)?flagsProv:null},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:TT},
      scales:{x:{grid:{display:false,drawTicks:false},ticks:{color:'#6b6c68',font:{size:11},autoSkip:state.grain!=='month',maxRotation:0,padding:6,callback:grainTick(state.grain)}},
        y:{beginAtZero:true,title:{display:true,text:'Matters declined',color:'#6b6c68',font:{size:11}},ticks:{color:'#6b6c68',font:{size:11},callback:v=>v.toLocaleString()},grid:{color:'#e6e6e3'}}}},
    plugins:[adminBands,PV.plugin]});
}
/* ══════════════════════════════════════════════════════════════════════════════════
   THE DATA TABLE AND ITS CSV - L-258, built under L-301.
   The engine is LIONS_TABLE in shared/shared.js, which this page already loads, so
   INVARIANT 9 IS UNCHANGED: no script and no stylesheet was added to or removed from
   this page's chain.

   THIS PAGE IS THE ASYMMETRICAL ONE, deliberately (spec C5). Its series ARE the reasons,
   so THE EIGHT REASONS STAY COLUMNS - they are this page's measure, exactly as the five
   disposition columns are the criminal table's - and the row slots are district x
   (program category | referring agency), which is what the page's own Break down by
   toggle already switches. Each declination carries exactly one reason, measured at
   ratio 1.000000 both ways, so the reason columns partition the row's own total and the
   shares total 100.0% of the selected reasons.

   L-139 LANDS HERE. The column headed a bare `Total` was the total of the SELECTED reasons - 1,847 against the cube's 1,872 at 2014-10 - which is a labelling defect and
   not a wrong number. It becomes TWO columns that each name their parts, so the difference is on the face of the table instead of hidden in a heading. THERE IS NO
   reason='ALL' ROW IN EITHER DECLINATION CUBE to read instead - 0 such rows in all four files, checked rather than assumed (design-la l258-cube-measure.js, L-281) - so the all-reasons figure is a CHECKED SUM and the label says so rather than calling it the cube's total.

   THE (ym, reason) GRID IS ZERO-SUPPRESSED: 133 of 3,056 keys at category='ALL' carry no row, and an absent key is a TRUE ZERO, not a gap. aggregateTable() fills the grid by initialising every reason across the whole spine before it adds anything, so nothing  downstream can read a measured zero as unknown.
   Spec: ops/handoffs/L-258-design-spec.md, copy signed by Cary 19 September 2026. ══════════════════════════════════════════════════════════════════════════════════ */
const ROW_CAP=window.LIONS_TABLE.ROW_CAP;
const TCOPY=window.LIONS_TABLE.COPY;
const rkey=r=>'r_'+r.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
const RKEYS=REASON_ORDER.map(rkey);
/* Every user-facing string this table puts on the page that is not already in LIONS_TABLE.COPY. */
const TBL_COPY={
  totalLabelCat:'All program categories',
  totalLabelAg:'All referring agencies',
  complementLabelCat:'Other program categories, summed',
  complementLabelAg:'Other referring agencies, summed',
  dimSumCat:n=>n+' program categories, summed',
  dimSumAg:n=>n+' referring agencies, summed',
  addsOneCat:'is one program category',
  addsOneAg:'is one referring agency',
  distSum:TCOPY.distSum,
  addsTotal:TCOPY.addsTotal, addsYes:TCOPY.addsYes, addsNo:TCOPY.addsNo,
  selTotal:n=>n+' of 8 reasons, summed',
  allTotal:'All 8 reasons, summed',
  lineAllCat:p=>'One row per '+p+'. Figures show the database\'s total row for all program categories.',
  lineOneCat:p=>'One row per '+p+'. Figures show one program category.',
  lineSumCat:(p,n)=>'One row per '+p+'. Figures show '+n+' program categories summed, and each declined matter is counted once.',
  lineBreakoutCat:'The category rows add up to the total row once "Other program categories, summed" is included.',
  lineAllAg:p=>'One row per '+p+'. Figures show cases from all referring agencies.',
  lineOneAg:p=>'One row per '+p+'. Figures show cases from one referring agency.',
  lineSumAg:(p,n)=>'One row per '+p+'. Figures shown are cases from '+n+' referring agencies summed; each declined matter is counted once.',
  lineBreakoutAg:'Agency rows add up to the total row once "Other referring agencies, summed" is included.',
  /* appended in EVERY state, because the reason selection is a second axis and L-139 is exactly what happens when it goes unstated */
  reasonClause:n=>' Reason columns reflect '+n+' of the eight possible reasons, and each share is of those '+n+'.',
  reasonClauseAll:' Reason columns show all eight reasons, each share is divided by the total.',
  notesExtra:'Each declined matter only has one reason, so reason columns can be summed to match the "summed" column beside them.',
  /* THE ONE EMPTY STATE ANY OF THESE FOUR PAGES HAS. Every other control defaults back
     to a selection - no district means National, no category means the cube's total row
     - but the reason multi-select is `plain` (no ALL sentinel) and can genuinely hold
     nothing, and with nothing selected the table has no measure at all. This sentence is
     this page's own, unchanged character for character, moved out of #note. */
  empty:'Select at least one declination reason.',
  refusalCat:(n,cap)=>TCOPY.refusal(n,cap,'program categories'),
  refusalAg:(n,cap)=>TCOPY.refusal(n,cap,'referring agencies'),
  pending:TCOPY.pending
};
let LAST={rows:[],cols:[],provN:6};
let BYDIST_CAT=null,BYDIST_AG=null;   // district -> its own rows; built once the cube is in

function tblDistRows(d){
  const src=isAg()?AG_FULL:CAT_FULL;
  if(!src) return [];
  if(isAg()){ if(!BYDIST_AG){ BYDIST_AG=new Map(); for(const r of src){ let a=BYDIST_AG.get(r.district); if(!a){a=[];BYDIST_AG.set(r.district,a);} a.push(r); } } return BYDIST_AG.get(d)||[]; }
  if(!BYDIST_CAT){ BYDIST_CAT=new Map(); for(const r of src){ let a=BYDIST_CAT.get(r.district); if(!a){a=[];BYDIST_CAT.set(r.district,a);} a.push(r); } }
  return BYDIST_CAT.get(d)||[];
}
/* The cube is LONG on reason and the table is WIDE on it, so the pivot happens here: one
   component array per reason, over the whole spine, filled with zeros first. The grid is
   zero-suppressed (133 of 3,056 keys at category='ALL'), and an absent key is a measured
   zero rather than a gap - see the header above. target.kind 'all'  - the cube's OWN total row: category='ALL', or department='ALL' AND subagency='ALL' on the agency cube. target.kind 'keys' - one or more named categories or subagencies. */
function aggregateTable(dists,target){
  const ag=isAg();
  const useNat=dists.has('National')||dists.size===0;
  const R={}; for(const k of RKEYS) R[k]=new Array(SPINE.length).fill(0);
  const idxOf=new Map(SPINE.map((ym,i)=>[ym,i]));
  const add=row=>{
    if(target.kind==='all'){ if(ag?!(row.dept==='ALL'&&row.grp==='ALL'):row.grp!=='ALL') return; }
    else { if(row.grp==='ALL'||(ag&&row.dept==='ALL')||!target.keys.has(row.grp)) return; }
    const i=idxOf.get(row.ym); if(i==null) return;
    const k=rkey(row.reason); if(R[k]) R[k][i]+=row.declined; };
  if(useNat){ const nat=ag?AG_NAT:CAT_NAT; if(nat) for(const r of nat) add(r); }
  else { for(const d of dists) for(const r of tblDistRows(d)) add(r); }
  return R;
}
const tblSelDims=()=>{ const s=isAg()?state.ags:state.cats;
  if(!s) return [];
  return (s.has('ALL')||s.size===0)?[]:[...s]; };

const TBL_DESC={
  spine:()=>SPINE, visIdx:()=>visIdx(),
  cols:st=>{
    const sel=REASON_ORDER.filter(r=>st.reasons.has(r));
    const c=[
      {k:'period',g:'key',h:'Period'},
      {k:'district',g:'key',h:'District'},
      {k:isAg()?'agency':'category',g:'key',h:isAg()?'Referring agency':'Program category'},
      {k:'additive',g:'key',h:'Summable',fold:true}
    ];
    /* the reason names are UNCHANGED, character for character, from the columns this
       table printed before L-258 */
    for(const r of sel) c.push({k:rkey(r),g:'reasons',h:r,t:'int',w:PROV_METRIC});
    for(const r of sel) c.push({k:rkey(r)+'_pct',g:'shares',h:r+' %',t:'pct',w:PROV_METRIC});
    c.push({k:'selected_reasons_total',g:'totals',h:TBL_COPY.selTotal(sel.length),t:'int',w:PROV_METRIC,cls:'tot'});
    c.push({k:'all_reasons_total',g:'totals',h:TBL_COPY.allTotal,t:'int',w:PROV_METRIC});
    return c; },
  get dimKey(){ return isAg()?'agency':'category'; },
  get dimNounPlural(){ return isAg()?'referring agencies':'program categories'; },
  hasBasisCol:false,
  /* declinations.page.js has never carried tr.edge and does not gain it here - a reading
     of the three page scripts, not an assumption (spec section 5.5) */
  hasEdge:false,
  stockKeys:[], extraKeyCsv:[],
  pv:PVOPT, defaultWindowKey:PROV_METRIC,
  aggregate:(st,dists,target)=>aggregateTable(dists,target),
  dimSlots:st=>window.LIONS_TABLE.partitioningSlots(TBL_DESC,st),
  selectedDims:()=>tblSelDims(),
  dimList:()=>isAg()?AGLIST:CATLIST,
  /* The share denominator is the SELECTED reasons, not all eight, so the table and the
     page's own 100%-stacked chart agree: that chart normalises on the selected reasons
     and its axis says so. The all-eight figure is beside it as its own column, which is
     what makes an incomplete selection VISIBLE instead of implied. That is L-139.
     Invariant 4: both totals and every share run on components the engine has ALREADY
     bucketed, never on a mean of monthly percentages. */
  derive:(r,st)=>{
    let sel=0,all=0;
    for(const x of REASON_ORDER){ const v=r[rkey(x)]||0; all+=v; if(st.reasons.has(x)) sel+=v; }
    r.selected_reasons_total=sel; r.all_reasons_total=all;
    for(const x of REASON_ORDER) r[rkey(x)+'_pct']=sel>0?100*(r[rkey(x)]||0)/sel:null; },
  rowExtras:()=>{},
  basisLine:st=>tblBasisLine(st),
  emptyState:st=>st.reasons.size?null:TBL_COPY.empty,
  csvLine:(st,n)=>TCOPY.csvLine(n),
  get copy(){ return {
    totalLabel:isAg()?TBL_COPY.totalLabelAg:TBL_COPY.totalLabelCat,
    complementLabel:isAg()?TBL_COPY.complementLabelAg:TBL_COPY.complementLabelCat,
    dimSum:isAg()?TBL_COPY.dimSumAg:TBL_COPY.dimSumCat,
    addsOne:isAg()?TBL_COPY.addsOneAg:TBL_COPY.addsOneCat,
    notesExtra:TBL_COPY.notesExtra }; }
};
const TBL=window.LIONS_TABLE.make(TBL_DESC);
const activeTblCols=()=>TBL.activeCols(state);
function tblRowCount(){ return TBL.rowCount(state); }
/* FOUR STATES plus a clause appended in every one of them, counted before the branch was
   written (style guide 5g, after L-249 D-C). A state missing from the enumeration does
   not fall through to a neighbour. */
function tblBasisLine(st){
  const p=window.LIONS_TABLE.grainNoun(st.grain), sel=tblSelDims(), ag=isAg();
  const n=REASON_ORDER.filter(r=>st.reasons.has(r)).length;
  const clause=n===8?TBL_COPY.reasonClauseAll:TBL_COPY.reasonClause(n);
  if(st.rowsBy.dim) return (ag?TBL_COPY.lineBreakoutAg:TBL_COPY.lineBreakoutCat)+clause;
  if(sel.length>1) return (ag?TBL_COPY.lineSumAg:TBL_COPY.lineSumCat)(p,sel.length)+clause;
  if(sel.length===1) return (ag?TBL_COPY.lineOneAg:TBL_COPY.lineOneCat)(p)+clause;
  return (ag?TBL_COPY.lineAllAg:TBL_COPY.lineAllCat)(p)+clause;
}
function renderTable(){ LAST=TBL.render(state); }
/* The breakout button names the page's own Break down by axis, so the two controls agree */
function syncRowsByLabel(){ const b=document.getElementById('rowsbydim');
  if(b) b.textContent=isAg()?'Referring agency':'Program category'; }

/* ── L-257's lazy build, inherited exactly (spec C7) ──────────────────────────────── */
let tblDirty=true;
const tblPanelOpen=()=>!document.getElementById('tablePanel').hidden;
function tblBuild(){ document.getElementById('tblpending').textContent=''; renderTable(); tblDirty=false; }
function tblInvalidate(){
  tblDirty=true;
  if(tblPanelOpen()){ tblBuild(); return; }
  document.getElementById('basisline').textContent=tblBasisLine(state);
  const over=tblRowCount()>ROW_CAP;
  document.getElementById('dl').disabled=over; document.getElementById('dl2').disabled=over;
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

  // The provisional treatment must not be vision-only. Appended only when the visible
  // range actually reaches the zone (spec §4).
  const nA=PV.n(PROV_METRIC,PVOPT), aCut=PV.cutIndex(SPINE,nA);
  const reaches=visIdx().some(i=>i>aCut);
  const provA=reaches?(' '+PV.noteText(nA,PV.dir(PROV_METRIC))):'';
  const provA1=reaches?(' '+PV.noteText(nA,'mix')):'';
  chartEl.setAttribute('aria-label',
    `Declinations by reason over time as percent share. Breakdown mode: ${dimText}. Filters: ${distText}; ${groupText}; reasons: ${reasonText}; ${state.from} to ${state.to}.${provA1}`
  );
  chart2El.setAttribute('aria-label',
    `Total declined matters over time for selected declination reasons. Breakdown mode: ${dimText}. Filters: ${distText}; ${groupText}; reasons: ${reasonText}; ${state.from} to ${state.to}.${provA}`
  );
}

async function render(){
  document.getElementById('dimLabel').textContent=isAg()?'Referring agency (multi)':'Program category (multi)';
  const useNat=state.dists.has('National')||state.dists.size===0;
  const needFull=!useNat;
  if(isAg()){ if(!AG_NAT) await ensureAgency(); if(needFull) await ensureAgFull(); }
  else if(needFull){ await ensureCatFull(); }
  /* L-283: seriesByReason()'s `if(!rows) return out;` is NOT a guard - `out` is already  zero-filled, so a missing cube is ANSWERED with zero under a district label: the topline reads "None in this period." and the table prints 1,136 cells of 0 where the cube has 2,702. Refuse instead, the way index.html and civil.html do (L-275): hold
     the previous view and leave the message the failed ensure wrote. Falling back to the
     national rows is not an option either - that prints national figures under a
     district label.
     L-224: render() writes NOTHING to #status. The filter-state line this used to print
     is deleted, the topline caption being a superset of it, and a render that wrote here
     would wipe a failure within one tick. */
  if(!(isAg()?(useNat?AG_NAT:AG_FULL):(useNat?CAT_NAT:CAT_FULL))) return;
  SER=seriesByReason();
  renderTopline(); renderChart(); renderChart2(); updateChartAccessibility(); tblInvalidate();
}

// ── THE TOPLINE SECTION (L-199 direction B, L-204) ───────────────────────────────
// THIS PAGE HAD NO TOPLINE AT ALL until now, and it gains one with three figures:
// the total declined, the average per month, and the selected reasons' share of all
// eight. Two flags ride on it and neither is optional: the arm-D definition note on any
// total or change (D-039/D-040), and the reason-scheme note on a share comparison that
// reaches before October 2014.
function renderTopline(){
  const sel=selReasons();
  const series=new Array(SPINE.length).fill(0);
  for(const r of sel){ const a=SER[r]; if(!a) continue;
    for(let i=0;i<series.length;i++) series[i]+=a[i]; }
  const tot=allReasonTotal();
  const all=sel.length===REASON_ORDER.length;
  const selName = all ? 'all reasons' : (sel.length===1 ? sel[0] : 'the selected reasons');
  // Invariant 7: the topline engine is additive. A browser holding an old cached
  // shared/shared.js against this page script has no LIONS_TOPLINE, so a missing or
  // throwing engine logs and leaves the chart to render.
  if(!window.LIONS_TOPLINE){ console.warn('LIONS_TOPLINE unavailable - topline section skipped'); return; }
  // L-222: facts here, sentence in the engine. See index.page.js.
  const C=window.LIONS_TOPLINE.COPY;
  try{ window.LIONS_TOPLINE.render({
    spine:SPINE, view:visIdx(), metricKey:PROV_METRIC, metricLabel:'Matters declined',
    // L-250: the section's period figures follow the page's Group by control, exactly
    // as the charts do. No control is added inside the section.
    grain:state.grain,
    kind:'count', series, rate:null,
    share:{ sel:series, tot, label:(sel.length===1?sel[0]+' share':'Selected reasons\' share'),
            selName, basis:'Share of all eight declination reasons in the same period.' },
    allSelected:all,
    districtSel:!(state.dists.has('National')||state.dists.size===0),
    filters:{ breakdown: isAg()?C.capByAgency:C.capByCat, districts:distClause(state.dists),
              selection: all?null:{items:sel, noun:C.capNounReasons} },
    provN:PV.n(PROV_METRIC,PVOPT),
    caption:'Counts criminal matters declined by U.S. Attorney offices.',
    flags:{armD:true, scheme:true, declTrend:true},
    loading:!(isAg()?AG_NAT:CAT_NAT),
    empty:!series.some(v=>v)
  }); }catch(e){ console.warn('LIONS_TOPLINE.render failed - topline section skipped', e); }
}

function buildCSV(){
  /* #dl sits OUTSIDE the panel and is live with the table never built, so the download
     does the build itself rather than going silently dead on the empty LAST below. Same
     rows, same cap: D-1 is not re-opened, and an over-cap selection or an empty reason
     selection still refuses, because tblBuild() runs the same branches the table does. */
  if(tblDirty) tblBuild();
  if(LAST.rows.length===0) return;   /* D-1: if the table refuses to draw, the download refuses too */
  const blob=new Blob([TBL.csvText(state,LAST)],{type:"text/csv"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  const dt=(state.dists.has('National')||state.dists.size===0)?'National':(state.dists.size===1?[...state.dists][0]:state.dists.size+'dists');
  a.download=`lions_declinations_${state.dim}_${dt}_${state.grain}_${state.from}_${state.to}.csv`; a.click();
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
async function ensureCatFull(){ if(CAT_FULL||catFullLoading) return; catFullLoading=true; SL.setLoading(SL.COPY.loadDistrict);
  try{ const r=await fetch("./data/decl_cat_cube.csv",{cache:"reload"}); CAT_FULL=parseCat(await r.text()); if(dMS) dMS.setItems(districtList());
    SL.setLoading(null); SL.clearLoadError(); }catch(e){ console.error(e); SL.setLoadError(SL.COPY.errDistrict); } catFullLoading=false; }
async function ensureAgency(){ if(AG_NAT||agLoading) return; agLoading=true; SL.setLoading(SL.COPY.loadAgency);
  try{ const r=await fetch("./data/decl_agency_cube_national.csv",{cache:"reload"}); AG_NAT=parseAg(await r.text()); buildDepts(AG_NAT); if(!state.ags) state.ags=new Set(AGLIST);
    SL.setLoading(null); SL.clearLoadError(); }catch(e){ console.error(e); SL.setLoadError(SL.COPY.errAgency); } agLoading=false; }
async function ensureAgFull(){ if(AG_FULL||agFullLoading) return; agFullLoading=true; SL.setLoading(SL.COPY.loadDistrict);
  try{ const r=await fetch("./data/decl_agency_cube.csv",{cache:"reload"}); AG_FULL=parseAg(await r.text()); if(dMS) dMS.setItems(districtList());
    SL.setLoading(null); SL.clearLoadError(); }catch(e){ console.error(e); SL.setLoadError(SL.COPY.errAgency); } agFullLoading=false; }

function buildDimPicker(){
  if(!isAg()){ multiSelect("dimpick",{items:CATLIST,allValue:"ALL",allLabel:"All categories",initial:state.cats,searchable:false,
      onChange:v=>{ state.cats=new Set(v); render(); }}); }
  else { if(!state.ags) state.ags=new Set(AGLIST); groupedSelect("dimpick",DEPTS_AG,state.ags,v=>{ state.ags=new Set(v); render(); }); }
}

async function init(){ renderNav();
  /* L-224: the national cube is 1.5-3 MB and until it lands the page is a blank chart
     with no explanation. The message is cleared by the same resource arriving, below;
     the setup between here and the first render() is synchronous, so no paint happens
     in between and clearing here is clearing at the first render. */
  SL.setLoading(SL.COPY.loadInitial[CURRENT]);
  try{ const r=await fetch("./data/decl_cat_cube_national.csv",{cache:"reload"}); CAT_NAT=parseCat(await r.text()); }
  catch(e){ SL.setLoadError(SL.COPY.errInitial); return; }
  SL.setLoading(null); SL.clearLoadError();
  const ms=[...new Set(CAT_NAT.map(r=>r.ym))].sort(); SPINE=months(ms[0],ms[ms.length-1]);
  CATLIST=[...new Set(CAT_NAT.map(r=>r.grp))].filter(g=>g!=="ALL").sort();
  dMS=multiSelect("district",{items:[],allValue:"National",allLabel:"National (all)",initial:state.dists,searchable:true,fmt:fmtDist,
    onChange:v=>{ state.dists=new Set(v); render(); }});
  buildDimPicker();
  multiSelect("reason",{items:REASON_ORDER,plain:true,allLabel:"All reasons",emptyLabel:"pick reasons…",initial:state.reasons,searchable:false,
    onChange:v=>{ state.reasons=new Set(v); render(); }});
  document.querySelectorAll('#dimSeg button').forEach(x=>x.addEventListener('click',async()=>{ document.querySelectorAll('#dimSeg button').forEach(y=>y.classList.remove('on')); x.classList.add('on'); state.dim=x.dataset.v;
    if(isAg()) await ensureAgency(); buildDimPicker(); syncRowsByLabel(); render(); }));
  document.querySelectorAll('#grain button').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('#grain button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); state.grain=b.dataset.v; renderTopline(); renderChart(); renderChart2(); tblInvalidate(); }));
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
  document.getElementById("dl2").addEventListener("click",buildCSV);
  syncRowsByLabel();
  document.querySelectorAll('#rowsby button').forEach(b=>b.addEventListener('click',()=>{
    const on=!state.rowsBy[b.dataset.v]; state.rowsBy[b.dataset.v]=on;
    b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false'); tblBuild(); }));
  document.querySelectorAll('#colgroups button').forEach(b=>b.addEventListener('click',()=>{
    const g=b.dataset.v, on=!state.tblCols[g];
    /* never zero metric columns: a table with only key columns answers nothing */
    if(!on && activeTblCols().filter(c=>c.g!=='key').length<=TBL_DESC.cols(state).filter(c=>c.g===g).length) return;
    state.tblCols[g]=on; b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false');
    tblBuild(); }));
  document.getElementById('tblToggle').addEventListener('click',()=>{ const p=document.getElementById('tablePanel'); const willOpen=p.hidden; p.hidden=!willOpen; const b=document.getElementById('tblToggle'); b.textContent=(willOpen?'▾ Hide data table':'▸ Show data table'); b.setAttribute('aria-expanded',willOpen?'true':'false'); window.dispatchEvent(new Event('resize'));
    if(!willOpen||!tblDirty) return;
    /* Over cap there is nothing to build and no wait to explain, so the refusal shows at
       once and WITHOUT the placeholder (L-257 design note section 5). renderTable()
       returns straight out of its refusal branch, so this is cheap enough to run inline. */
    if(tblRowCount()>ROW_CAP){ tblBuild(); return; }
    /* ORDER MATTERS. The panel is already unhidden above, so this mutation lands in a
       live region that is already visible: a role="status" that gains its text in the
       same paint in which it appears is not reliably announced. */
    document.getElementById('tblpending').textContent=TBL_COPY.pending;
    /* NEVER synchronous in the handler. The browser paints nothing until a task returns,
       so a build in here would leave the panel unopened and the disclosure looking dead
       for the whole build. The first requestAnimationFrame callback still runs before the
       frame's paint, so the work hangs off the second. */
    requestAnimationFrame(()=>requestAnimationFrame(tblBuild));
  });
  // ── Deliberate prefetch. Do not "optimise" this into a lazy load. ──────────────
  // The district cube (decl_cat_cube.csv, ~23 MB) is fetched on EVERY page load,
  // not on district selection. It is intentionally un-awaited, so it never blocks
  // first paint: the national view renders immediately and this streams in behind it.
  // The point is that opening the district filter and switching districts is instant,
  // rather than making the user wait on a multi-megabyte download mid-interaction.
  // Cary's call, 31 Aug 2026 - responsiveness over bytes. It is the dominant share of
  // this site's bandwidth, so read ops/DECISIONS.md D-016 before changing it.
  ensureCatFull(); render();
}
if(typeof document!=='undefined') init();
if(typeof module!=='undefined') module.exports={seriesByReason,buildDepts};
