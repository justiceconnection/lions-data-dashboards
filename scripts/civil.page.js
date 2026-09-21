const state={dists:new Set(['National']),cats:new Set(['ALL']),role:'Defendant',basis:'cases',metric:'cases_filed',seriesBy:'category',ax2:false,ax2by:'series',ax2sel:new Set(),kpiCat:'Immigration',mixMode:'stacked',admins:new Set(),from:'2013-01',to:'2026-06',grain:'month',rowsBy:{district:false,dim:false},tblCols:{matters:true,cases:true,pending:false,dispositions:true,rates:true}};
let NAT=null, FULL=null, SPINE=[], fullLoading=false, dMS=null, cMS=null, ax2MS=null, chart=null, chart2=null, chart3=null, CATLIST=[];
const NUM=["matters_received","cases_filed","matters_terminated","cases_terminated","d_judg_us","d_settle","d_against","d_dismissed","d_other"];
const PALETTE=["#212123","#2a78d6","#d9622b","#1d9e75","#7a4fc0","#c02d5a","#0e8a8a","#b8860b","#5a6acf","#c23b8a","#7a7b76","#2f9e44","#e06a2b","#3b6fd4"];
const CATPAL=(window.LIONS_PAL||PALETTE);
const RPAL=["#2a78d6","#c02d5a","#1d9e75","#7a4fc0","#0e8a8a","#d9622b"];
const DOC_SURFACE='civil';

// ── L-155: `cases_pending` is a COUNTED column, read from its own cube ───────────
// `civil_pending_cube_national.csv` / `civil_pending_cube.csv`:
//   ym [, district], category, role, cases_pending.
// It is NOT a column on `civil_cube` and it is NOT accumulated in the browser any more.
// The old running net (cumulative cases_filed - cases_terminated from 1994-10) was an
// index of net change since October 1994, not a caseload: it went negative in 375 of 382
// months for role Plaintiff, and the chart restarted the sum at the window's first month,
// so it plotted 45,788 where this page's own table said 84,556. L-126.
//
// THE ZERO-SUPPRESSION CONTRACT, AND IT RUNS THE WHOLE SPINE. The cube omits zero rows,
// because the full-spine build measured 127.55 MiB, over GitHub's per-file block. So a
// month with no row, ANYWHERE INSIDE THE LOADED CUBE'S OWN min(ym)..max(ym), is a zero.
// Interior gaps are only half of it: 1,364 of 3,726 civil-grain series and 4,712 of
// 9,306 agency-grain series END BEFORE THE VINTAGE EDGE, and a line that stops in 2019
// reads as "no data after 2019" rather than "none after 2019" - the worse of the two
// wrong readings, because it invites a reader to think the series was discontinued.
// Outside the spine there is genuinely nothing, so the value is null and nothing is
// drawn. Every read goes through pendingArr(), so no call site can get it wrong.
// `docs/DASHBOARD_STYLE_GUIDE.md` section 6a.
let PNAT=null,PFULL=null,PSP_N=null,PSP_F=null,pnatLoading=false,pfullLoading=false;
const MULT=(window.LIONS_MULT&&window.LIONS_MULT.civil)||{cases_filed:[1.6598,1.1815,1.0872,1.0611,1.0438,1.0358,1.0313,1.0273],cases_terminated:[1.7179,1.2881,1.1729,1.1248,1.0884,1.0563,1.0393,1.0305]};
function hasPred(m){ return !!MULT[m]; }
function predOf(arr, metric){ const mm=MULT[metric]; if(!mm) return null; const last=SPINE.length-1;
  return arr.map((v,i)=>{ if(v==null) return null; const age=last-i; return v*(age>=0&&age<mm.length?mm[age]:1); }); }
const DISP=[["d_judg_us","Judgment For U.S.","#1d9e75"],["d_settle","Settlements","#2a78d6"],["d_against","Judgment Against U.S.","#d9622b"],["d_dismissed","Dismissed","#7a4fc0"],["d_other","Other","#8a8b86"]];
const METRICS_CASES=[["cases_filed","Cases filed"],["cases_pending","Cases pending"],["cases_terminated","Cases terminated"]];
const METRICS_MATTERS=[["matters_received","Matters received"],["matters_pending","Matters pending"],["matters_terminated","Matters terminated"]];
// Each band's `to` is its LAST month, not the next administration's first. `b` in ADMINS
// (shared/config.js) is an EXCLUSIVE end, and visIdx() filters from <= ym <= to, so a `to`
// of "2021-01" put January 2021 - Biden's first month - inside the Trump I range and made
// it 49 months against the band's 48 (L-221).
const PRESETS={obama2:["2013-01","2016-12"],trump1:["2017-01","2020-12"],biden:["2021-01","2024-12"],trump2:["2025-01","2026-06"],all:["2013-01","2026-06"]};
const CURRENT="civil.html";
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
// This dashboard is civil throughout: inflow window 4 months, outflow 6, net stock 6.
// It is the only surface with a DOWN-direction metric - pending is a running net
// (received − terminated), and because outflow lags far more than inflow it is
// OVERSTATED at the edge and will fall. Telling a user it will rise is worse than
// saying nothing, so the copy is direction-aware.
const PV=window.LIONS_PROV;
const SL=window.LIONS_STATUS;
const PVOPT={civil:true};
function metricsList(){ return state.basis==='cases'?METRICS_CASES:METRICS_MATTERS; }
function primaryFlow(){ return state.basis==='cases'?'cf':'mr'; }
function primaryLabel(){ return state.basis==='cases'?'cases filed':'matters received'; }

function parseCSV(t){ const L=t.trim().split(/\r?\n/), H=L[0].split(","), I=Object.fromEntries(H.map((h,i)=>[h,i]));
  const out=new Array(L.length-1);
  for(let i=1;i<L.length;i++){ const c=L[i].split(","); const o={ym:c[I.ym],grp:c[I.category],role:c[I.role],district:I.district!==undefined?c[I.district]:"National"};
    for(const k of NUM) o[k]=+c[I[k]]||0; out[i-1]=o; } return out; }

function parsePend(t){ const L=t.trim().split(/\r?\n/), H=L[0].split(","), I=Object.fromEntries(H.map((h,i)=>[h,i]));
  const rows=new Array(L.length-1); let lo=null,hi=null;
  for(let i=1;i<L.length;i++){ const c=L[i].split(","); const ym=c[I.ym];
    if(lo===null||ym<lo) lo=ym; if(hi===null||ym>hi) hi=ym;
    rows[i-1]={ym,grp:c[I.category],role:c[I.role],district:I.district!==undefined?c[I.district]:"National",v:+c[I.cases_pending]||0}; }
  return {rows,spine:{lo,hi}}; }
// All causes selected reads the cube's own `category='ALL'` total row, never a sum of the
// 14 causes (invariant 3). They do partition exactly here, but the total row is still the
// right thing to read.
function pendingArr(dists,cats,role){
  const useNat=dists.has('National')||dists.size===0;
  const src=useNat?PNAT:PFULL, sp=useNat?PSP_N:PSP_F;
  if(!src||!sp) return SPINE.map(()=>null);            // not loaded yet, or the fetch failed
  const catAll=cats.has('ALL')||cats.size===0;
  const idx=new Map();
  for(const r of src){
    if(r.role!==role) continue;
    if(!useNat&&!dists.has(r.district)) continue;
    if(catAll?(r.grp!=='ALL'):(r.grp==='ALL'||!cats.has(r.grp))) continue;
    idx.set(r.ym,(idx.get(r.ym)||0)+r.v); }
  return SPINE.map(ym=> (ym>=sp.lo&&ym<=sp.hi) ? (idx.get(ym)||0) : null);
}
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
// Every aggregation on this page goes through agg(), which is aggregateRaw plus the
// counted pending series. aggregateRaw itself is left pure and is still what the module
// exports, so it can be reasoned about without a second cube.
function agg(dists,cats,role){ const R=aggregateRaw(NAT,FULL,SPINE,dists,cats,role); R.cp=pendingArr(dists,cats,role); return R; }
const mean3=(a,i)=> i<2?null:(a[i]+a[i-1]+a[i-2])/3;
function cumsum(arr){ let acc=0; return arr.map(v=>acc+=v); }
// THE CASES BRANCH OF THIS FUNCTION IS DELETED (L-155): cases_pending reads the counted
// column. What is left is matters only, and it is still a running net because
// `matters_pending` is NOT in the promoted pending cube - it is held on L-149. So that
// series is an index of net change since October 1994 and not a stock; the entry that
// says so on "Reading the data" is written, signed and does not render until the column
// exists, and `matters_pending` carries no marker for the same reason. Do not add a
// cases-shaped branch back here.
function mattersPendingSeries(R){ return cumsum(R.mr.map((v,i)=>v-R.cf[i]-R.mt[i])); }
function metricArray(R, metric){ switch(metric){
    case 'cases_filed': return R.cf.slice();
    case 'cases_filed_3mo': return R.cf.map((_,i)=>mean3(R.cf,i));
    case 'cases_terminated': return R.ct.slice();
    case 'cases_terminated_3mo': return R.ct.map((_,i)=>mean3(R.ct,i));
    case 'cases_pending': return R.cp?R.cp.slice():SPINE.map(()=>null);
    case 'cases_pending_3mo': { const p=R.cp||SPINE.map(()=>null); return p.map((_,i)=>mean3(p,i)); }
    case 'matters_received': return R.mr.slice();
    case 'matters_received_3mo': return R.mr.map((_,i)=>mean3(R.mr,i));
    case 'matters_terminated': return R.mt.slice();
    case 'matters_terminated_3mo': return R.mt.map((_,i)=>mean3(R.mt,i));
    case 'matters_pending': return mattersPendingSeries(R);
    case 'matters_pending_3mo': { const p=mattersPendingSeries(R); return p.map((_,i)=>mean3(p,i)); }
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
const rint=x=>x==null?"-":Math.round(x).toLocaleString();

// ── THE TOPLINE SECTION (L-199 direction B, L-204) ───────────────────────────────
// The four KPI cards and their renderKPIs() are retired. Two rules this page carries
// that the others do not:
//   `cases_pending` is a STOCK - a reading at a date, never a total over a period, and
//   its provisional treatment is a truncation rather than a flag on the extrema.
//   `matters_pending` is NOT offered at all (spec section 8 item 8): it is a running net
//   since October 1994, not a published level, and the section says so rather than
//   printing a number for it.
// Invariant 3: the share denominator is the cube's own ALL total row over the same
// period, never the sum of the selected causes.
function renderTopline(){
  const R=agg(state.dists,state.cats,state.role);
  const TOT=agg(state.dists,new Set(['ALL']),state.role);
  const m=state.metric, stock=PV.family(m)==='stock';
  const all=state.cats.has('ALL')||state.cats.size===0;
  const selName = all ? 'all causes'
                : (state.cats.size===1 ? [...state.cats][0] : 'the selected causes');
  const series=metricArray(R,m);
  // Invariant 7: the topline engine is additive. A browser holding an old cached
  // shared/shared.js against this page script has no LIONS_TOPLINE, so a missing or
  // throwing engine logs and leaves the chart to render.
  if(!window.LIONS_TOPLINE){ console.warn('LIONS_TOPLINE unavailable - topline section skipped'); return; }
  // L-222: facts here, sentence in the engine. See index.page.js.
  const C=window.LIONS_TOPLINE.COPY;
  try{ window.LIONS_TOPLINE.render({
    spine:SPINE, view:visIdx(), metricKey:m, metricLabel:metricLabel(m),
    // L-250: the section's period figures follow the page's Group by control, exactly
    // as the chart and the data table do. No control is added inside the section.
    grain:state.grain,
    kind: stock?'stock':'count', series, rate:null,
    share:{ sel:R[primaryFlow()], tot:TOT[primaryFlow()],
            label:'Share of all civil '+primaryLabel().split(' ')[0], selName },
    allSelected:all,
    districtSel:!(state.dists.has('National')||state.dists.size===0),
    filters:{ districts:distClause(state.dists), role:state.role,
              selection: all?null:{items:[...state.cats], noun:C.capNounCauses} },
    provN:PV.n(m,PVOPT),
    caption: stock?'Pending cases compound over time: it is read at a date, never totalled over a period.'
                  :'U.S. as '+state.role+'.',
    notOffered: m==='matters_pending',
    loading:!NAT,
    empty:!!NAT && !series.some(v=>v)
  }); }catch(e){ console.warn('LIONS_TOPLINE.render failed - topline section skipped', e); }
}

/* ══════════════════════════════════════════════════════════════════════════════════
   THE DATA TABLE AND ITS CSV - L-258, built under L-301.
   The engine is LIONS_TABLE in shared/shared.js, which this page already loads, so
   INVARIANT 9 IS UNCHANGED: no script and no stylesheet was added to or removed from
   this page's chain. Everything below is this page's descriptor: its columns, its cube
   read, its dimension slots, its signed copy.
   Spec: ops/handoffs/L-258-design-spec.md, copy signed by Cary 19 September 2026.
   ══════════════════════════════════════════════════════════════════════════════════ */
const ROW_CAP=window.LIONS_TABLE.ROW_CAP;
const TCOPY=window.LIONS_TABLE.COPY;
/* `g` is the column group a user can switch off; 'key' is never switchable, so a CSV
   consumer parsing by name has a stable key set whatever the user does. `w` is the
   provisional-window metric key the column takes: the table's own mark is the WIDEST
   across the columns it is currently printing (the L-014 envelope rule). `fold` marks
   the column that folds INTO the cause cell below 560px. `cls` carries the stock
   hairline - a level is not something to add down. */
const TBL_COLS=[
  {k:'period',g:'key',h:'Period'},
  {k:'district',g:'key',h:'District'},
  {k:'cause',g:'key',h:'Cause of action'},
  {k:'additive',g:'key',h:'Summable',fold:true},
  {k:'matters_received',g:'matters',h:'Matters received',t:'int',w:'matters_received'},
  {k:'matters_terminated',g:'matters',h:'Matters terminated',t:'int',w:'matters_terminated'},
  {k:'cases_filed',g:'cases',h:'Cases filed',t:'int',w:'cases_filed'},
  {k:'cases_terminated',g:'cases',h:'Cases terminated',t:'int',w:'cases_terminated'},
  {k:'cases_pending',g:'pending',h:'Cases pending (at period end)',t:'int',w:'cases_pending',cls:'stock'},
  {k:'d_judg_us',g:'dispositions',h:'Judgment for U.S.',t:'int',w:'cases_terminated'},
  {k:'d_settle',g:'dispositions',h:'Settlements',t:'int',w:'cases_terminated'},
  {k:'d_against',g:'dispositions',h:'Judgment against U.S.',t:'int',w:'cases_terminated'},
  {k:'d_dismissed',g:'dispositions',h:'Dismissed',t:'int',w:'cases_terminated'},
  {k:'d_other',g:'dispositions',h:'Other disposition',t:'int',w:'cases_terminated'},
  {k:'d_judg_us_pct',g:'rates',h:'Judgment for U.S. %',t:'pct',w:'cases_terminated'},
  {k:'d_settle_pct',g:'rates',h:'Settlements %',t:'pct',w:'cases_terminated'},
  {k:'d_against_pct',g:'rates',h:'Judgment against U.S. %',t:'pct',w:'cases_terminated'},
  {k:'d_dismissed_pct',g:'rates',h:'Dismissed %',t:'pct',w:'cases_terminated'},
  {k:'d_other_pct',g:'rates',h:'Other disposition %',t:'pct',w:'cases_terminated'}
];
/* Every user-facing string this table puts on the page that is not already in
   LIONS_TABLE.COPY. Signed by Cary verbatim on 19 September 2026 (spec section 6).
   Never an em dash (D-042). */
const TBL_COPY={
  totalLabel:'All causes of action',
  /* Criminal's complement reads "Other categories, and cases with none recorded" because
     there really is a residual there. On this cube the 14 causes reach category='ALL'
     EXACTLY - 0 of 1,146 (ym, role) keys disagree on any of 9 columns, measured in
     design-lab/l258-cube-measure.js - so a label claiming uncategorised members would
     assert something false. This one names what the row is. */
  complementLabel:'Other causes of action, summed',
  dimSum:n=>n+'causes of action, summed',
  distSum:TCOPY.distSum,
  addsTotal:TCOPY.addsTotal, addsYes:TCOPY.addsYes, addsNo:TCOPY.addsNo,
  addsOne:'is one cause of action',
  lineAll:(p,role)=>'One row per '+p+', U.S. as '+role+'. Figures show the database\'s total for all causes of action.',
  lineOne:(p,role)=>'One row per '+p+', U.S. as '+role+'. Figures show one cause of action.',
  lineSum:(p,n,role)=>'One row per '+p+', U.S. as '+role+'. Figures show '+n+' causes of action added together, and each case is counted once.',
  lineBreakout:(p,role)=>'One row per '+p+' per cause of action, U.S. as '+role+'. The cause rows add up to the total row once "Other causes of action" is included.',
  notesExtra:'Pending cases is a figure reported at the end of the period, not a reflection of cases during that period. Do not sum that column.',
  refusal:(n,cap)=>TCOPY.refusal(n,cap,'causes of action'),
  pending:TCOPY.pending
};
let LAST={rows:[],cols:[],provN:6};
let BYDIST=null;   // district -> its own rows; built once FULL is in. See tblDistRows().

/* The district cube is 641,931 rows and a cross-tab asks for it once per district slot
   per cause slot. Indexing it once turns each of those scans into the rows that district
   actually has. FULL is assigned once and never mutated, so the index cannot go stale;
   it is built lazily so a national-only session never pays for it. */
function tblDistRows(d){
  if(!FULL) return [];
  if(!BYDIST){ BYDIST=new Map();
    for(const r of FULL){ let a=BYDIST.get(r.district); if(!a){ a=[]; BYDIST.set(r.district,a); } a.push(r); } }
  return BYDIST.get(d)||[];
}
/* The table needs all NINE numeric columns the cube carries; aggregateRaw() carries the
   same nine under short field names for the charts. Kept separate rather than widened,
   because the chart path is the hot one.
     target.kind 'all'  - the cube's OWN total row, category='ALL' at the selected role.
     target.kind 'keys' - one or more named causes.
   THE FIVE d_* COLUMNS CARRY BLANK CELLS, NOT ZEROS, and parseCSV coerces blank to 0
   explicitly with `+c[I[k]]||0`. That the coercion is right rather than convenient is
   measured: read that way the five columns reproduce cases_terminated on every one of
   the 15,643 national and 641,931 district rows, including the 9,483 rows carrying a
   blank cell AND a non-zero cases_terminated (design-lab/l258-cube-measure.js). */
function aggregateTable(dists,target){
  const useNat=dists.has('National')||dists.size===0;
  const idx=new Map();
  const add=r=>{
    if(r.role!==state.role) return;
    if(target.kind==='all'){ if(r.grp!=='ALL') return; }
    else { if(r.grp==='ALL'||!target.keys.has(r.grp)) return; }
    let o=idx.get(r.ym);
    if(!o){ o={}; for(const k of NUM) o[k]=0; idx.set(r.ym,o); }
    for(const k of NUM) o[k]+=r[k]; };
  if(useNat){ for(const r of NAT) add(r); }
  else { for(const d of dists) for(const r of tblDistRows(d)) add(r); }
  const R={}; for(const k of NUM) R[k]=[];
  for(const ym of SPINE){ const o=idx.get(ym); for(const k of NUM) R[k].push(o?o[k]:0); }
  /* cases_pending is a COUNTED column in a SECOND cube and is read through pendingArr(),
     which is the only place that knows the zero-suppression contract: a month with no row
     inside the loaded cube's own min..max is a ZERO, and a month outside it is null and
     prints "-". It is a STOCK, so the engine takes the bucket's LAST month, never a sum. */
  R.cases_pending=pendingArr(dists,target.kind==='all'?new Set(['ALL']):target.keys,state.role);
  return R;
}
const tblSelCauses=()=>(state.cats.has('ALL')||state.cats.size===0)?[]:[...state.cats];

const TBL_DESC={
  spine:()=>SPINE, visIdx:()=>visIdx(),
  cols:()=>TBL_COLS,
  dimKey:'cause', dimNounPlural:'causes of action',
  hasBasisCol:false, hasEdge:true,
  stockKeys:['cases_pending'],
  /* The U.S. role is a page filter, not a third breakout axis: there is no role='ALL'
     row in this cube to check a three-role sum against (1,146 category='ALL' rows, 382
     months x 3 roles, and no others - measured). It is stated in the basis line and it
     rides the CSV as a machine column, so two downloads can be merged by a consumer who
     wants both. */
  extraKeyCsv:['us_role'],
  pv:PVOPT, defaultWindowKey:'cases_filed',
  aggregate:(st,dists,target)=>aggregateTable(dists,target),
  dimSlots:st=>window.LIONS_TABLE.partitioningSlots(TBL_DESC,st),
  selectedDims:()=>tblSelCauses(),
  dimList:()=>CATLIST,
  /* Invariant 4: these run on components the engine has ALREADY bucketed, so a
     fiscal-year settlement share is the year's settlements over the year's terminations
     and never the mean of twelve monthly rates. The five shares total 100.0% on every
     row, because the five d_* columns partition cases_terminated exactly. */
  derive:r=>{ const ct=r.cases_terminated;
    for(const k of ['d_judg_us','d_settle','d_against','d_dismissed','d_other'])
      r[k+'_pct']=ct>0?100*r[k]/ct:null; },
  rowExtras:r=>{ r.us_role=state.role; },
  basisLine:st=>tblBasisLine(st),
  csvLine:(st,n)=>TCOPY.csvLine(n),
  copy:TBL_COPY
};
const TBL=window.LIONS_TABLE.make(TBL_DESC);
const activeTblCols=()=>TBL.activeCols(state);
function tblRowCount(){ return TBL.rowCount(state); }
/* FOUR STATES, counted before the branch was written (style guide 5g, after L-249 D-C).
   A state missing from the enumeration does not fall through to a neighbour. */
function tblBasisLine(st){
  const p=window.LIONS_TABLE.grainNoun(st.grain), sel=tblSelCauses();
  if(st.rowsBy.dim) return TBL_COPY.lineBreakout(p,st.role);
  if(sel.length>1) return TBL_COPY.lineSum(p,sel.length,st.role);
  if(sel.length===1) return TBL_COPY.lineOne(p,st.role);
  return TBL_COPY.lineAll(p,st.role);
}
function renderTable(){ LAST=TBL.render(state); }

/* ── L-257's lazy build, inherited exactly (spec C7) ────────────────────────────────
 * The table is built on the FIRST OPEN of the disclosure and marked stale by any filter,
 * date, preset, role, column-group or grain change. TWO THINGS STAY EAGER, and both are
 * state-derived and build no rows: tblRowCount() is three cheap counts, so an over-cap
 * selection disables Download CSV at the moment it goes over budget, panel open or shut;
 * and tblBasisLine() reads state only, so the basis line is on screen in the same paint
 * in which the panel opens. */
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

const adminBands={id:'admin',beforeDraw(ch){ const labels=ch.data._ym||ch.data.labels; if(!labels||!labels.length)return;
  const x=ch.scales.x,area=ch.chartArea,ctx=ch.ctx; const half=labels.length>1?Math.abs(x.getPixelForValue(1)-x.getPixelForValue(0))/2:10;
  for(const ad of ADMINS){ let s=-1,e=-1; for(let i=0;i<labels.length;i++){ if(labels[i]>=ad.a&&labels[i]<ad.b){ if(s<0)s=i; e=i; } }
    if(s<0)continue; const x0=x.getPixelForValue(s)-half,x1=x.getPixelForValue(e)+half;
    ctx.save(); ctx.fillStyle=ad.c; ctx.fillRect(x0,area.top,x1-x0,area.bottom-area.top);
    ctx.fillStyle='rgba(70,70,66,0.7)'; ctx.font='11px sans-serif'; ctx.textAlign='center';
    if(x1-x0>44) ctx.fillText(ad.name,(x0+x1)/2,area.top+11); ctx.restore(); }
}};
function baseScales(pct,rightTitle,anyR){ return {x:{grid:{display:false,drawTicks:false},ticks:{color:'#6b6c68',font:{size:11},autoSkip:state.grain!=='month',maxRotation:0,padding:6,callback:grainTick(state.grain)}},
  y:{position:'left',beginAtZero:!pct,title:{display:true,text:metricLabel(state.metric),color:'#6b6c68',font:{size:11}},ticks:{color:'#6b6c68',font:{size:11},callback:pct?(v=>v+'%'):(v=>v.toLocaleString())},grid:{color:'#e6e6e3'}},
  y1:{position:'right',display:anyR,beginAtZero:!pct,title:{display:anyR,text:rightTitle,color:'#212123',font:{size:11}},ticks:{color:'#6b6c68',font:{size:11},callback:pct?(v=>v+'%'):(v=>v.toLocaleString())},grid:{drawOnChartArea:false}}}; }

const TT={enabled:false,external:extTooltip};
// L-126 / L-155: a STOCK is a level, so a quarter or a fiscal year takes the level at the
// bucket's LAST month. Summing a stock across a bucket, or cumulating one from the
// window's first month, is exactly what made this chart disagree with its own table by a
// constant 38,768. A flow or a ratio is unchanged: bucket the component counts first,
// then run the metric formula (invariant 4).
function seriesFor(dists,cats,metric,B){ const R=agg(dists,cats,state.role);
  return PV.family(metric)==='stock' ? bucketEnd(metricArray(R,metric),B)
                                     : metricArray(bucketComp(R,B),metric); }
function renderChart(){
  const idxs=visIdx(); const B=grainBuckets(SPINE,idxs,state.grain);
  const labels=grainLabels(B), ymAxis=B.map(b=>SPINE[b.idxs[0]]), pr=B.map(b=>b.partial?3.2:0), anyPartial=grainAnyPartial(B);
  const pct=false;
  const left=buildSeries(leftItems(),'y');
  const metricMode=state.ax2by==='metric' && state.ax2sel.size>0;
  const right=(state.ax2by!=='metric' && state.ax2sel.size)?buildSeries([...state.ax2sel],'y1'):[];
  const rMetrics=metricMode?[...state.ax2sel]:[];
  // Provisional envelope (spec §3.5): the zone takes the widest plotted window; each
  // series fades on its own. Direction is 'down' only when every plotted metric is a
  // net stock - a pending series next to a flow still reads "will rise" overall.
  const plotted=[state.metric,...rMetrics];
  const nZone=PV.nMax(plotted,PVOPT), nOwn=PV.n(state.metric,PVOPT);
  const flagsZone=PV.bucketFlags(SPINE,B,nZone), flagsOwn=PV.bucketFlags(SPINE,B,nOwn);
  const provDir=PV.dirAll(plotted);
  const mk=(s,j,pal,dash)=>{ const arr=seriesFor(s.dists,s.cats,state.metric,B); const col=pal[j%pal.length];
    // borderDash still means "right axis" and is untouched; fade means provisional.
    return PV.decorateLine({label:s.label+(s.axis==='y1'?' (R)':''),data:arr,borderColor:col,backgroundColor:col,tension:.25,pointRadius:pr,pointStyle:'circle',pointBackgroundColor:'#fff',pointBorderColor:col,pointBorderWidth:1.4,pointHoverRadius:4,borderWidth:2,spanGaps:true,borderDash:dash?[5,4]:[],yAxisID:s.axis,_col:col},flagsOwn,pr); };
  const leftDs=left.map((s,j)=>mk(s,j,PALETTE,false));
  const datasets=[...leftDs, ...right.map((s,j)=>mk(s,j,RPAL,true))];
  rMetrics.forEach((m2,j)=>{ const arr=seriesFor(state.dists,state.cats,m2,B); const col=RPAL[j%RPAL.length];
    datasets.push(PV.decorateLine({label:metricLabel(m2)+' (R)',data:arr,borderColor:col,backgroundColor:col,tension:.25,pointRadius:pr,pointStyle:'circle',pointBackgroundColor:'#fff',pointBorderColor:col,pointBorderWidth:1.4,pointHoverRadius:4,borderWidth:2,spanGaps:true,borderDash:[5,4],yAxisID:'y1',_col:col},PV.bucketFlags(SPINE,B,PV.n(m2,PVOPT)),pr)); });
  const anyR=right.length>0||rMetrics.length>0;
  const rAxisTitle=(metricMode?(rMetrics.map(metricLabel).slice(0,3).join(', ')+(rMetrics.length>3?'…':'')):metricLabel(state.metric))+' (Right)';
  document.getElementById("legend").innerHTML=datasets.map(ds=>`<span class="lg"><span class="sw" style="background:${ds._col}"></span>${ds.label}</span>`).join("")
     + (anyR?'<span class="lg" style="color:var(--mut)">- dashed = right axis</span>':'')
     + (anyPartial?'<span class="lg" style="color:var(--mut)">* partial period (fewer months than the full period)</span>':'')
     + (PV.anyProv(flagsZone)?PV.legendChip(nZone,provDir):'');   // separate marker from "*" - two different facts
  document.getElementById("chartTitle").textContent=metricLabel(state.metric)+" - "+state.role+" - by "+(state.seriesBy==='category'?'cause of action':'district');
  if(typeof window==='undefined'||!window.Chart){ return; }
  if(chart) chart.destroy();
  chart=mkChart(document.getElementById('chart').getContext('2d'),{type:'line',data:{labels,datasets,_ym:ymAxis,_prov:PV.anyProv(flagsZone)?flagsZone:null},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:TT},
      scales:baseScales(false,rAxisTitle,anyR)},plugins:[adminBands,PV.plugin]});
}

function renderChart2(){
  const idxs=visIdx(); const B=grainBuckets(SPINE,idxs,state.grain);
  const labels=grainLabels(B), ymAxis=B.map(b=>SPINE[b.idxs[0]]); const pf=primaryFlow();
  const allSel=(state.cats.has('ALL')||state.cats.size===0); const cats=allSel?CATLIST:[...state.cats];
  const totB=bucketSum(agg(state.dists,new Set(['ALL']),state.role)[pf],B);
  const cAB={}; for(const c2 of cats) cAB[c2]=bucketSum(agg(state.dists,new Set([c2]),state.role)[pf],B);
  // Normalised on the primary flow -> inflow window. Under-reporting distorts the MIX.
  const mixMetric=state.basis==='cases'?'cases_filed':'matters_received';
  const nMix=PV.n(mixMetric,PVOPT), flagsMix=PV.bucketFlags(SPINE,B,nMix);
  let datasets;
  if(state.mixMode==='sum'){ const data=totB.map((t,bi)=>{if(!t)return null;let s=0;for(const c2 of cats)s+=cAB[c2][bi];return 100*s/t;});
    datasets=[{label:(allSel?'All causes':cats.join(', ')),data,borderColor:'#212123',backgroundColor:'rgba(33,33,35,.10)',fill:true,tension:.25,pointRadius:0,borderWidth:2,_pct:true,_col:'#212123'}];
  } else { datasets=cats.map((c2,j)=>{const col=CATPAL[(CATLIST.indexOf(c2)+1)%CATPAL.length];return {label:c2,data:totB.map((t,bi)=>t?100*cAB[c2][bi]/t:null),borderColor:col,backgroundColor:col+'cc',fill:true,tension:.2,pointRadius:0,borderWidth:0.8,_pct:true,_col:col,_stacked:true};}); }
  document.getElementById("legend2").innerHTML=(state.mixMode==='stacked'?datasets:[{label:datasets[0].label,borderColor:'#212123'}]).map(ds=>`<span class="lg"><span class="sw" style="background:${ds.borderColor}"></span>${ds.label}</span>`).join("")
    + (PV.anyProv(flagsMix)?PV.legendChip(nMix,'mix'):'');
  document.getElementById("chart2Title").textContent="Cause of action mix - % of "+primaryLabel()+(state.mixMode==='stacked'?" (stacked)":" (combined)");
  if(typeof window==='undefined'||!window.Chart) return;
  datasets=datasets.slice().reverse();
  if(chart2) chart2.destroy();
  chart2=mkChart(document.getElementById('chart2').getContext('2d'),{type:'line',data:{labels,datasets,_ym:ymAxis,_prov:PV.anyProv(flagsMix)?flagsMix:null},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:TT},
      scales:{x:{grid:{display:false,drawTicks:false},ticks:{color:'#6b6c68',font:{size:11},autoSkip:state.grain!=='month',maxRotation:0,padding:6,callback:grainTick(state.grain)}},y:{stacked:state.mixMode==='stacked',beginAtZero:true,title:{display:true,text:'% of '+primaryLabel(),color:'#6b6c68',font:{size:11}},ticks:{color:'#6b6c68',font:{size:11},callback:v=>v+'%'},grid:{color:'#e6e6e3'}}}},plugins:[adminBands,PV.plugin]});
}

function renderChart3(){
  const box=document.getElementById('chart3box'), msg=document.getElementById('chart3msg');
  if(state.basis!=='cases'){ box.style.display='none'; msg.style.display='block'; msg.textContent='No disposition data for Matters - court dispositions apply to Cases only. Switch the basis toggle to Cases.'; document.getElementById('legend3').innerHTML=''; if(chart3){chart3.destroy();chart3=null;} return; }
  box.style.display=''; msg.style.display='none';
  const idxs=visIdx(); const B=grainBuckets(SPINE,idxs,state.grain);
  const labels=grainLabels(B), ymAxis=B.map(b=>SPINE[b.idxs[0]]);
  const R=agg(state.dists,state.cats,state.role);
  const ctB=bucketSum(R.ct,B);
  const datasets=DISP.map(([k,name,col],j)=>{ const key={d_judg_us:'ju',d_settle:'st',d_against:'ag',d_dismissed:'dm',d_other:'ot'}[k];
    const numB=bucketSum(R[key],B);
    return {label:name,data:ctB.map((t,bi)=>t?100*numB[bi]/t:null),borderColor:col,backgroundColor:col+'cc',fill:true,tension:.2,pointRadius:0,borderWidth:0.8,_pct:true,_col:col,_stacked:true}; });
  // Disposition mix is normalised on cases terminated -> outflow window (6).
  const nDisp=PV.n('cases_terminated',PVOPT), flagsDisp=PV.bucketFlags(SPINE,B,nDisp);
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
  const catText=(state.cats.has('ALL')||state.cats.size===0)
    ?'all causes of action'
    :[...state.cats].join(', ');

  // The provisional treatment must not be vision-only. Appended only when the visible
  // range actually reaches the zone (spec §4).
  const reaches=n=>{ const c=PV.cutIndex(SPINE,n); return visIdx().some(i=>i>c); };
  const nA=PV.n(state.metric,PVOPT);
  const provA=reaches(nA)?(' '+PV.noteText(nA,PV.dir(state.metric))):'';
  const nA2=PV.n(state.basis==='cases'?'cases_filed':'matters_received',PVOPT);
  const provA2=reaches(nA2)?(' '+PV.noteText(nA2,'mix')):'';
  const nA3=PV.n('cases_terminated',PVOPT);
  const provA3=reaches(nA3)?(' '+PV.noteText(nA3,'mix')):'';
  chartEl.setAttribute('aria-label',
    `${metricLabel(state.metric)} trend over time by ${state.seriesBy==='category'?'cause of action':'district'}. Filters: ${distText}; ${catText}; ${state.from} to ${state.to}; U.S. as ${state.role}; basis ${state.basis}.${provA}`
  );
  chart2El.setAttribute('aria-label',
    `Cause of action share over time as percent of ${primaryLabel()}, ${state.mixMode==='stacked'?'stacked view':'combined view'}. Filters: ${distText}; ${catText}; ${state.from} to ${state.to}; U.S. as ${state.role}; basis ${state.basis}.${provA2}`
  );

  if(state.basis!=='cases'){
    chart3El.setAttribute('aria-label','Disposition mix chart unavailable for matters basis; switch basis to cases to view disposition percentages.');
    return;
  }
  chart3El.setAttribute('aria-label',
    `Disposition mix over time as percent of cases terminated. Filters: ${distText}; ${catText}; ${state.from} to ${state.to}; U.S. as ${state.role}; basis ${state.basis}.${provA3}`
  );
}

function render(){
  const needFull=!(state.dists.has('National')||state.dists.size===0)||state.seriesBy==='district';
  /* The district cube can also finish and FAIL: FULL stays null with fullLoading back to
     false, and the old `&& fullLoading` guard fell straight through into aggregateRaw(),
     which threw `full is not iterable` on a null and left the page dead (L-275). Return
     on "no FULL" whatever the reason. It deliberately does not fall back to the national
     rows, which would print national figures under a district label. It also does not
     overwrite the message ensureFull()'s catch wrote - that catch only logged when this
     guard was written and writes the failure string as of L-224. */
  /* L-224: render() writes NOTHING to #status. The filter-state line this used to
     print is deleted - the topline caption is a superset of it - and the progress and
     failure messages belong to the ensure functions, which are the only things that know
     which one is true. A render that wrote here would wipe a failure within one tick. */
  if(needFull && !FULL) return;
  /* L-283: the pending cubes are a SECOND source with their own failure, and the guard
     above never reached them. pendingArr() returns a column of nulls when they are
     missing, which the topline draws as "None in this period." under a district label -
     an answer of zero where the cube has 1,081. Refuse the same way. */
  if(pendWanted() && (!PNAT || (needFull && !PFULL))) return;
  renderTopline(); renderChart(); renderChart2(); renderChart3(); updateChartAccessibility(); tblInvalidate(); }

function buildCSV(){
  /* #dl sits OUTSIDE the panel and is live with the table never built, so the download
     does the build itself rather than going silently dead on the empty LAST below. Same
     button, same rows, same cap: D-1 is not re-opened, and an over-cap selection still
     refuses, because tblBuild() runs the same refusal branch the table does. */
  if(tblDirty) tblBuild();
  if(LAST.rows.length===0) return;   /* D-1: if the table refuses to draw, the download refuses too */
  const blob=new Blob([TBL.csvText(state,LAST)],{type:"text/csv"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  const dt=(state.dists.has('National')||state.dists.size===0)?'National':(state.dists.size===1?[...state.dists][0]:state.dists.size+'dists');
  const ct=(state.cats.has('ALL')||state.cats.size===0)?'ALL':(state.cats.size===1?[...state.cats][0].replace(/\W+/g,''):state.cats.size+'causes');
  a.download=`civil_${dt}_${ct}_${state.role}_${state.grain}_${state.from}_${state.to}.csv`; a.click();
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
    const sel=document.createElement('select'); sel.innerHTML='<option value="">- pick a metric -</option>'+metricsList().map(m=>`<option value="${m[0]}">${docMetricLabel(DOC_SURFACE,m[0],m[1])}</option>`).join('');
    sel.addEventListener('change',async()=>{ state.ax2sel=sel.value?new Set([sel.value]):new Set(); await ensurePending(); renderChart(); }); mount.append(sel);
  } else {
    ax2MS=multiSelect('ax2sel',{items:(state.seriesBy==='category'?CATLIST:districtList()),plain:true,emptyLabel:'pick series…',initial:state.ax2sel,searchable:state.seriesBy==='district',
      fmt:state.seriesBy==='district'?fmtDist:undefined, onChange:v=>{ state.ax2sel=new Set(v); renderChart(); }}); } }
// ── L-155: the pending cubes are fetched LAZILY, never at page load ─────────────
// `cases_pending` is the only metric that needs them; `matters_pending` does not, because
// it is not in the cube (L-149). The district file is 33.74 MiB and is fetched only when
// a district selection actually needs it.
const NEEDS_PEND=m=>m==='cases_pending';
function pendWanted(){ if(NEEDS_PEND(state.metric)) return true;
  if(state.ax2by==='metric'){ for(const m of state.ax2sel) if(NEEDS_PEND(m)) return true; } return false; }
async function ensurePendNat(){ if(PNAT||pnatLoading) return; pnatLoading=true;
  SL.setLoading(SL.COPY.loadPending);
  try{ const r=await fetch("./data/civil_pending_cube_national.csv",{cache:"reload"}); const p=parsePend(await r.text()); PNAT=p.rows; PSP_N=p.spine;
    SL.setLoading(null); SL.clearLoadError(); }
  catch(e){ console.error(e); SL.setLoadError(SL.COPY.errPending); } pnatLoading=false; }
async function ensurePendFull(){ if(PFULL||pfullLoading) return; pfullLoading=true;
  SL.setLoading(SL.COPY.loadDistrictPending);
  try{ const r=await fetch("./data/civil_pending_cube.csv",{cache:"reload"}); const p=parsePend(await r.text()); PFULL=p.rows; PSP_F=p.spine;
    SL.setLoading(null); SL.clearLoadError(); }
  catch(e){ console.error(e); SL.setLoadError(SL.COPY.errPending); } pfullLoading=false; }
// `force` is the data table and the CSV. Both print EVERY metric as a column whatever the
// chart happens to be showing, so the pending column has to be real whenever a user can
// actually see it - not only when pending is the selected metric. Nothing is fetched
// until one of those three things happens.
async function ensurePending(force){ if(!(force||pendWanted())) return;
  await ensurePendNat();
  if(!(state.dists.has('National')||state.dists.size===0)||state.seriesBy==='district') await ensurePendFull(); }
async function ensureFull(){ if(FULL||fullLoading) return; fullLoading=true; SL.setLoading(SL.COPY.loadDistrict);
  try{ const r=await fetch("./data/civil_cube.csv",{cache:"reload"}); FULL=parseCSV(await r.text()); if(dMS) dMS.setItems(districtList());
    SL.setLoading(null); SL.clearLoadError(); }
  catch(e){ console.error(e); SL.setLoadError(SL.COPY.errDistrict); } fullLoading=false; }
function populateMetric(){ const sel=document.getElementById("metric");
  // L-144: the glyph is an INDEX into "Reading the data", not a severity signal. Which
  // metrics carry it is REFERENCES.flags in shared/config.js, and a held entry
  // (matters_pending, L-149) resolves to no marker at all.
  sel.innerHTML=metricsList().map(m=>`<option value="${m[0]}">${docMetricLabel(DOC_SURFACE,m[0],m[1])}</option>`).join("");
  state.metric=metricsList()[0][0]; sel.value=state.metric; }

async function init(){ renderNav();
  /* L-224: the national cube is 1.5-3 MB and until it lands the page is a blank chart
     with no explanation. The message is cleared by the same resource arriving, below;
     the setup between here and the first render() is synchronous, so no paint happens
     in between and clearing here is clearing at the first render. */
  SL.setLoading(SL.COPY.loadInitial[CURRENT]);
  try{ const r=await fetch("./data/civil_cube_national.csv",{cache:"reload"}); NAT=parseCSV(await r.text()); }
  catch(e){ SL.setLoadError(SL.COPY.errInitial); return; }
  SL.setLoading(null); SL.clearLoadError();
  const ms=[...new Set(NAT.map(r=>r.ym))].sort(); SPINE=months(ms[0],ms[ms.length-1]);
  CATLIST=[...new Set(NAT.map(r=>r.grp))].filter(g=>g!=="ALL").sort();
  populateMetric();
  dMS=multiSelect("district",{items:[],allValue:"National",allLabel:"National (all)",initial:state.dists,searchable:true,fmt:fmtDist,
    onChange:async v=>{ state.dists=new Set(v); if(!(state.dists.has('National')||state.dists.size===0)) await ensureFull(); await ensurePending(); render(); }});
  cMS=multiSelect("category",{items:CATLIST,allValue:"ALL",allLabel:"All causes",initial:state.cats,searchable:false,
    onChange:v=>{ state.cats=new Set(v); render(); }});
  buildAx2Picker();
  document.getElementById("metric").addEventListener("change",async e=>{ state.metric=e.target.value; await ensurePending(); render(); });
  document.querySelectorAll('#role button').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('#role button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); state.role=b.dataset.v; render(); }));
  document.querySelectorAll('#basis button').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('#basis button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); state.basis=b.dataset.v; populateMetric(); if(state.ax2&&state.ax2by==='metric') buildAx2Picker(); render(); }));
  document.querySelectorAll('#seriesBy button').forEach(b=>b.addEventListener('click',async()=>{ document.querySelectorAll('#seriesBy button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); state.seriesBy=b.dataset.v; if(state.seriesBy==='district') await ensureFull(); await ensurePending(); if(state.ax2by==='series') buildAx2Picker(); render(); }));
  document.querySelectorAll('#mixMode button').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('#mixMode button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); state.mixMode=b.dataset.v; renderChart2(); updateChartAccessibility(); }));
  document.querySelectorAll('#grain button').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('#grain button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); state.grain=b.dataset.v; renderTopline(); renderChart(); renderChart2(); renderChart3(); tblInvalidate(); }));
  document.querySelectorAll('#ax2by button').forEach(b=>b.addEventListener('click',async()=>{ document.querySelectorAll('#ax2by button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); state.ax2by=b.dataset.v; if(state.ax2by!=='metric'&&state.seriesBy==='district') await ensureFull(); await ensurePending(); buildAx2Picker(); renderChart(); }));
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
  /* The Pending column group is the ONE group that is off by default, because it is the
     only one that costs a fetch: 0.56 MiB national and 33.74 MiB district. Opening the
     panel used to call ensurePending(true) unconditionally, so a reader who never wanted
     the column paid for it anyway (spec C8). Now the button is where the reader asks. */
  document.getElementById("dl").addEventListener("click",buildCSV);
  document.getElementById("dl2").addEventListener("click",buildCSV);
  document.querySelectorAll('#rowsby button').forEach(b=>b.addEventListener('click',()=>{
    const on=!state.rowsBy[b.dataset.v]; state.rowsBy[b.dataset.v]=on;
    b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false'); tblBuild(); }));
  document.querySelectorAll('#colgroups button').forEach(b=>b.addEventListener('click',async()=>{
    const g=b.dataset.v, on=!state.tblCols[g];
    /* never zero metric columns: a table with only key columns answers nothing */
    if(!on && activeTblCols().filter(c=>c.g!=='key').length<=TBL_COLS.filter(c=>c.g===g).length) return;
    state.tblCols[g]=on; b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false');
    if(on && g==='pending') await ensurePending(true);
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
  // The district cube (civil_cube.csv, ~31 MB) is fetched on EVERY page load,
  // not on district selection. It is intentionally un-awaited, so it never blocks
  // first paint: the national view renders immediately and this streams in behind it.
  // The point is that opening the district filter and switching districts is instant,
  // rather than making the user wait on a multi-megabyte download mid-interaction.
  // Cary's call, 31 Aug 2026 - responsiveness over bytes. It is the dominant share of
  // this site's bandwidth, so read ops/DECISIONS.md D-016 before changing it.
  ensureFull(); render();
}
if(typeof document!=='undefined') init();
if(typeof module!=='undefined') module.exports={aggregateRaw,metricArray,mattersPendingSeries,pendingArr,parsePend};
