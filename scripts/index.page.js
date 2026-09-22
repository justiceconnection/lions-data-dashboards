const state={dists:new Set(['National']),cats:new Set(['ALL']),metric:'cases_filed',seriesBy:'category',ax2:false,ax2by:'series',ax2sel:new Set(),occ:'all',kpiCat:'Immigration',mixMode:'stacked',admins:new Set(),from:'2013-01',to:'2026-06',grain:'month',rowsBy:{district:false,category:false},tblCols:{cases:true,defendants:true,dispositions:true,rates:true}};
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
// Each band's `to` is its LAST month, not the next administration's first. `b` in ADMINS
// (shared/config.js) is an EXCLUSIVE end, and visIdx() filters from <= ym <= to, so a `to`
// of "2021-01" put 2021-01, the next administration's first month, inside the Trump I
// range and made it 49 months against the band's 48.
const PRESETS={obama2:["2013-01","2016-12"],trump1:["2017-01","2020-12"],biden:["2021-01","2024-12"],trump2:["2025-01","2026-06"],all:["2013-01","2026-06"]};
const CURRENT="index.html";
// Provisional (right-censored) data.
// All the logic lives in shared/provisional.js; this page only makes calls.
// Two things this page owns, neither of them logic:
//   scales.x.ticks.padding:6 on every chart carrying the treatment - a LAYOUT
//     PRECONDITION of the gutter bar (spec §3.6/§6.9), not a style choice. The
//     bar lives in that space; Chart.js defaults to 3 and the bar would touch
//     the tick labels.
//   _stacked:true on datasets built for a stacked render - the input to
//     LIONS_PROV.decorateLine's refusal to fade a stacked fill (spec §6.7).
//     Set per render, because the mix charts flip family at runtime.
// This dashboard is criminal throughout: inflow window 3 months, outflow 6.
const PV=window.LIONS_PROV;
const SL=window.LIONS_STATUS;
const PVOPT={civil:false};
const DOC_SURFACE='index';
// The table header is rebuilt on every render now, so the markers are re-attached after
// each build rather than once at init. The labels are the ones renderTable() prints.
// TBL_METRICS was removed with the fixed seven-column table: the window is computed from
// whichever column groups are actually on, in tblProvWindow().
const DOC_TH_KEYS={'Cases filed':'cases_filed','Defendants filed':'defendants_filed'};

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

const r1=x=>x==null?"-":x.toLocaleString(undefined,{maximumFractionDigits:1});
const rint=x=>x==null?"-":Math.round(x).toLocaleString();
const p1=x=>x==null?"-":x.toFixed(1);

// ── THE TOPLINE SECTION ─────────────────────────────────────────────────────────
// The four KPI cards and their renderKPIs() are retired: this page now hands the
// shared engine in shared/shared.js a model of the series it has already aggregated,
// and the engine does the rest. Nothing here reads a cube a second time.
// The share denominator is the cube's own ALL total row, never the sum of
// the selected categories - aggregateRaw() with cats={'ALL'} takes grp='ALL' AND
// subcat='ALL', which exists only at occ='all'.
// A percent metric is handed over as its two component series, so the
// engine computes a ratio of sums and never an average of monthly percentages.
function renderTopline(){
  const R=aggregateRaw(NAT,FULL,SPINE,state.dists,state.cats);
  const TOT=aggregateRaw(NAT,FULL,SPINE,state.dists,new Set(['ALL']));
  const m=state.metric, pct=isPct(m);
  // denLabel names the series the rate divides BY, for the glance's second slot: the
  // page already has the name, so the slot costs no new string.
  const rate = m==='clearance' ? {num:R.term,den:R.filed,denLabel:metricLabel('cases_filed')}
             : m==='guilty_pct' ? {num:R.guilty,den:R.dt,denLabel:metricLabel('defendants_terminated')}
             : m==='dismissed_pct' ? {num:R.dismissed,den:R.dt,denLabel:metricLabel('defendants_terminated')} : null;
  const all=state.cats.has('ALL')||state.cats.size===0;
  const selName = all ? 'all categories'
                : (state.cats.size===1 ? [...state.cats][0] : 'the selected categories');
  const series=metricArray(R,m);
  // The topline engine is ADDITIVE: it decorates what the page has already rendered, and
  // a failure in it must still leave a readable dashboard. A browser holding an old cached
  // shared/shared.js against this page script has no LIONS_TOPLINE, so a missing or
  // throwing engine logs and leaves the chart to render.
  if(!window.LIONS_TOPLINE){ console.warn('LIONS_TOPLINE unavailable - topline section skipped'); return; }
  // The caption states the chart's state, so the page hands over the FACTS and the
  // engine owns the SENTENCE. Every string below is the engine's own COPY, so the settled
  // wording lives in one place and cannot drift four ways across four page scripts.
  const C=window.LIONS_TOPLINE.COPY;
  try{ window.LIONS_TOPLINE.render({
    spine:SPINE, view:visIdx(), metricKey:m, metricLabel:metricLabel(m),
    // The section's period figures follow the page's Group by control, exactly
    // as the chart and the data table do. No control is added inside the section.
    grain:state.grain,
    kind: pct?'rate':'count', series, rate,
    share:{ sel:R.filed, tot:TOT.filed, label:'Share of all criminal cases',
            selName, occ: state.occ==='primary'?'primary category':'all occurrences',
            basis: state.occ==='primary'
              ? 'Primary category basis: each case counted once, under its first code.'
              : 'All-occurrences basis: a case is counted in every category it touches.' },
    allSelected:all,
    districtSel:!(state.dists.has('National')||state.dists.size===0),
    filters:{ districts:distClause(state.dists), occ: state.occ==='primary'?C.capOccPrimary:C.capOccAll,
              selection: all?null:{items:[...state.cats], noun:C.capNounCats} },
    provN:PV.n(m,PVOPT),
    caption:'Counts U.S. District Court filings only.',
    loading:!NAT,
    empty:!!NAT && !series.some(v=>v)
  }); }catch(e){ console.warn('LIONS_TOPLINE.render failed - topline section skipped', e); }
}

/* ── THE DATA TABLE AND CSV ───────────────────────────────────────────────────────
 *
 * A row is ONE CELL of period x district-slot x category-slot. Every slot always names
 * something: a member, or an aggregate that says what it aggregates. No slot is ever
 * blank and no figure is ever headed a bare "Total".
 *
 * The table follows the page's Group by control and has no period control of its own, so
 * it can never be on a grain the chart is not on.
 *
 * What this replaced: a fixed seven-metric monthly table whose only caveat was one
 * sentence in #note when several categories were selected at occ='all'. That sentence is
 * now basis line state 2, directly above the table, so #note is no longer written to.
 */
/* The table and its CSV are built by LIONS_TABLE in shared/shared.js, which every
   dashboard already loads (the fixed load order is unchanged: no script and no
   stylesheet was added to, removed from or reordered in any page's list). This page
   passes a DESCRIPTOR -
   TBL_DESC below - carrying its own columns, its own cube read, its own dimension slots
   and its own copy. The shared strings are authored once, in LIONS_TABLE.COPY,
   and aliased into TBL_COPY below so they cannot drift four ways.
   */
const ROW_CAP=window.LIONS_TABLE.ROW_CAP;   // a RENDERING budget, not a property of the data
const TCOPY=window.LIONS_TABLE.COPY;
/* `g` is the column group a user can switch off; 'key' is never switchable, so a CSV
   consumer parsing by name has a stable set of five key columns whatever the user does.
   `w` is the provisional-window metric key the column takes: the table's own mark is the
   WIDEST across the columns it is currently printing.
   `fold` marks the two columns that fold INTO the category cell below 560px. */
const TBL_COLS=[
  {k:'period',g:'key',h:'Period'},
  {k:'district',g:'key',h:'District'},
  {k:'category',g:'key',h:'Program category'},
  {k:'counting_basis',g:'key',h:'Counting basis',fold:true},
  {k:'additive',g:'key',h:'Summable',fold:true},
  {k:'cases_filed',g:'cases',h:'Cases filed',t:'int',w:'cases_filed'},
  {k:'cases_terminated',g:'cases',h:'Cases terminated',t:'int',w:'cases_terminated'},
  {k:'defendants_filed',g:'defendants',h:'Defendants filed',t:'int',w:'defendants_filed'},
  {k:'defendants_terminated',g:'defendants',h:'Defendants terminated',t:'int',w:'defendants_terminated'},
  {k:'guilty',g:'dispositions',h:'Guilty',t:'int',w:'guilty'},
  {k:'not_guilty',g:'dispositions',h:'Not guilty',t:'int',w:'guilty'},
  {k:'dismissed',g:'dispositions',h:'Dismissed',t:'int',w:'dismissed'},
  {k:'rule_20_21',g:'dispositions',h:'Rule 20/21',t:'int',w:'guilty'},
  {k:'other',g:'dispositions',h:'Other disposition',t:'int',w:'guilty'},
  {k:'clearance_pct',g:'rates',h:'Clearance %',t:'pct',w:'clearance'},
  {k:'guilty_pct',g:'rates',h:'Guilty %',t:'pct',w:'guilty_pct'},
  {k:'not_guilty_pct',g:'rates',h:'Not guilty %',t:'pct',w:'guilty_pct'},
  {k:'dismissed_pct',g:'rates',h:'Dismissed %',t:'pct',w:'dismissed_pct'},
  {k:'rule_20_21_pct',g:'rates',h:'Rule 20/21 %',t:'pct',w:'guilty_pct'},
  {k:'other_pct',g:'rates',h:'Other disposition %',t:'pct',w:'guilty_pct'}
];
/* The six columns the CSV carries and the screen does not. Each spells out in a word what
   the table shows as a mark or as cell text. Declared to the user in TBL_COPY.csvLine,
   beside the download button, because any surviving
   screen/file difference must be stated there.
   LIONS_TABLE.csvColumns() emits exactly these six, positionally, next to the column
   each one qualifies; this list is the written inventory csvLine counts. */
const CSV_EXTRA=['period_grain','period_partial','provisional','provisional_window_months',
  'district_level','category_level'];
/* Every user-facing string the table and the CSV put on the page. The wording here is
   settled: do not reword it in passing. Never an em dash. */
const TBL_COPY={
  totalLabel:'All categories',
  complementLabel:'Other categories, and cases with none recorded',
  distSum:TCOPY.distSum,
  catSum:n=>n+' categories, added together',
  basisDistinct:'Distinct total', basisAll:'All occurrences', basisPrimary:'Primary category',
  addsTotal:TCOPY.addsTotal, addsYes:TCOPY.addsYes, addsNo:TCOPY.addsNo,
  /* The FOURTH value of the Adds up? column, and the reason it is a fourth rather than a reuse: with breakout off and exactly ONE category selected the table holds one row and no total row, so there is no sum in it and no second row to overlap with. 'yes' would claim the rows reach a total that is not on the table, 'no - overlaps' would claim an overlap between rows that do not exist, and 'is the total' - which is what this state carried before - is flatly false. It parallels addsTotal in grammar for the same reason: both answer what the row IS, because the column's yes/no question has no subject on a one-row table. */
  addsOne:'is one category',
  lineNoBreakoutAll:p=>'One row per '+p+'. Figures show the database\'s total cases for all program categories, counted once per case.',
  lineNoBreakoutSum:(p,n)=>'One row per '+p+'. Figures show '+n+' program categories added together, and a case labeled with more than one category is shown more than once.',
  /* The SIXTH basis-line state: breakout off with exactly ONE category selected. It fell through the sel.length>1 test to lineNoBreakoutAll above, which then told the reader the figures were the cube's own total row for all program categories while the table showed one. Basis line 1 is unchanged - it was right for its own state and the ROUTING was wrong. */
  lineNoBreakoutOne:(p,occ)=>'One row per '+p+'. Figures shown are one program category, counted '+(occ==='primary'?'once by the case\'s primary code':'under every labeled code')+'.',
  lineBreakoutAllOcc:'Program category rows will add up to a number that differs from the total row, because cases may be filed with multiple program categories. The total row is the database\'s own total for all categories, counted once per case.',
  lineBreakoutPrimary:'Program category rows will reach the total row once "Other categories, and cases with none recorded" is included.',
  lineOverlap:'You have selected an umbrella category and one of its own sub-categories, so two of these rows count the same cases. Toggle one of them off.',
  refusal:(n,cap)=>TCOPY.refusal(n,cap,'categories'),
  /* The
     placeholder shown between the panel opening and the table landing. It names the ACT
     and never a duration: the duration is a property of the reader's device and nobody
     has measured a phone. The verb is this page's own - the refusal above says "draw". */
  pending:TCOPY.pending,
  csvLine:'The CSV has the same rows and the same figures as the table, plus six columns that outline table notes: the reporting period, whether it is a partial period, whether data is provisional and how many months that includes, and what each district and category cell is.',
  footProv:TCOPY.footProvUp,
  partialNote:TCOPY.partialNote,
  scrollHint:TCOPY.scrollHint
};
let LAST={rows:[],cols:[],provN:6};
let BYDIST=null;   // district -> its own rows; built once FULL is in. See tblDistRows().

/* The district cube is 1.7M rows and a cross-tab asks for it once per district slot per
   category slot. Indexing it once turns each of those scans from 1,696,968 rows into the
   ~18,000 that district actually has. FULL is assigned once and never mutated, so the
   index cannot go stale; it is built lazily so a national-only session never pays for it. */
function tblDistRows(d){
  if(!FULL) return [];
  if(!BYDIST){ BYDIST=new Map();
    for(const r of FULL){ let a=BYDIST.get(r.district); if(!a){ a=[]; BYDIST.set(r.district,a); } a.push(r); } }
  return BYDIST.get(d)||[];
}

/* The table needs all NINE numeric columns the cube carries; aggregateRaw() carries the
   six the charts and the topline compute with, under its own field names. Kept separate
   rather than widened, because the chart path is the hot one.

   target.kind:
     'all'  - the cube's own total row, grp='ALL' AND subcat='ALL'. THE OCCURRENCE AXIS IS
              NOT FILTERED ON THIS BRANCH, deliberately. That row exists ONLY at occ='all'
              (382 of 382 national rows, 35,523 of 35,523 district rows), so honouring an
              occ='primary' selection here would match no row at all: the table would read
              zero, or fall through to summing the categories, and that fall-through IS
              exactly the double-count the ALL row exists to prevent. aggregateRaw()'s catAll branch is safe for
              the same reason - it tests only grp and subcat - and both must stay that way
              on purpose rather than by inheritance.
     'keys' - one or more grp|subcat targets AT the selected occurrence axis. */
function aggregateTable(dists,target){
  const useNat = dists.has('National') || dists.size===0;
  const occ=state.occ;
  const sub=r=> r.subcat||'ALL';
  const idx=new Map();
  const add=r=>{
    if(target.kind==='all'){ if(!(r.grp==='ALL'&&sub(r)==='ALL')) return; }
    else { if(r.grp==='ALL'||r.occ!==occ) return; if(!target.keys.has(r.grp+''+sub(r))) return; }
    let o=idx.get(r.ym);
    if(!o){ o={}; for(const k of NUM) o[k]=0; idx.set(r.ym,o); }
    for(const k of NUM) o[k]+=r[k]; };
  if(useNat){ for(const r of NAT) add(r); }
  else { for(const d of dists) for(const r of tblDistRows(d)) add(r); }
  const R={}; for(const k of NUM) R[k]=[];
  for(const ym of SPINE){ const o=idx.get(ym); for(const k of NUM) R[k].push(o?o[k]:0); }
  return R;
}

const tblCatKey=name=>{ const t=CATMAP[name]; return t?t.grp+''+t.subcat:null; };
const tblSelCats=()=> (state.cats.has('ALL')||state.cats.size===0)?[]:[...state.cats];
const tblSelDists=()=> (state.dists.has('National')||state.dists.size===0)?[]:[...state.dists];
/* An umbrella selected together with one of its own specifics double-counts even at
   occ='primary', because the specifics partition their umbrella EXACTLY there.
   groupedCatSelect()'s pick() prevents that combination, so no selection made through
   this picker can make the test below
   return true. THAT GUARD IS ONE PICKER ON ONE PAGE AND NOT A PROPERTY OF THE CUBE:
   nothing about lions_cube changed, and an analyst who sums an umbrella row and one of
   its own subcat rows by hand gets the same exact double count. The rule that the cube's
   own ALL row IS the total, and that overlapping parts are never summed to one, governs
   that, not this function. */
function tblSelectionOverlaps(){
  const s=tblSelCats();
  return s.some(a=>s.some(b=>b!==a&&CATMAP[b]&&CATMAP[b].subcat!=='ALL'&&CATMAP[b].grp===a));
}
const grainNoun=()=>window.LIONS_TABLE.grainNoun(state.grain);
function tblCategorySlots(){
  const sel=tblSelCats();
  const total={label:TBL_COPY.totalLabel,level:'cube_total',target:{kind:'all'},basis:TBL_COPY.basisDistinct,additive:TBL_COPY.addsTotal};
  /* A complement row is honest only at occ='primary' with no umbrella-plus-own-specific in
     the selection. At occ='all' the total minus the sum of overlapping parts can go
     NEGATIVE, and a negative "other" row would be worse than no row. */
  const adds=state.occ==='primary'&&!tblSelectionOverlaps();
  const basis=state.occ==='primary'?TBL_COPY.basisPrimary:TBL_COPY.basisAll;
  if(!sel.length){
    if(!state.rowsBy.category) return [total];
    const rows=[total].concat(UMB.map(u=>({label:u,level:'umbrella',target:{kind:'keys',keys:new Set([tblCatKey(u)])},
      basis,additive:adds?TBL_COPY.addsYes:TBL_COPY.addsNo})));
    if(adds) rows.push({label:TBL_COPY.complementLabel,level:'complement',complementOf:UMB.map(tblCatKey),basis,additive:TBL_COPY.addsYes});
    return rows;
  }
  if(!state.rowsBy.category){
    if(sel.length===1) return [{label:sel[0],level:CATMAP[sel[0]].subcat==='ALL'?'umbrella':'specific',
      target:{kind:'keys',keys:new Set([tblCatKey(sel[0])])},basis,additive:TBL_COPY.addsOne}];
    return [{label:TBL_COPY.catSum(sel.length),level:'selection_sum',target:{kind:'keys',keys:new Set(sel.map(tblCatKey))},
      basis,additive:adds?TBL_COPY.addsYes:TBL_COPY.addsNo}];
  }
  const rows=[total].concat(sel.map(c=>({label:c,level:CATMAP[c].subcat==='ALL'?'umbrella':'specific',
    target:{kind:'keys',keys:new Set([tblCatKey(c)])},basis,additive:adds?TBL_COPY.addsYes:TBL_COPY.addsNo})));
  if(adds) rows.push({label:TBL_COPY.complementLabel,level:'complement',complementOf:sel.map(tblCatKey),basis,additive:TBL_COPY.addsYes});
  return rows;
}
/* The descriptor this page hands LIONS_TABLE. Every field is this page's own; the row
   model, the bucketing, the CSV shape, the refusal and the DOM writing are the engine's
   and are identical on all four dashboards. */
const TBL_DESC={
  spine:()=>SPINE, visIdx:()=>visIdx(),
  cols:()=>TBL_COLS,
  dimKey:'category', dimNounPlural:'categories',
  hasBasisCol:true, hasEdge:true,
  stockKeys:[], extraKeyCsv:[],
  pv:PVOPT, defaultWindowKey:'cases_filed',
  aggregate:(st,dists,target)=>aggregateTable(dists,target),
  dimSlots:()=>tblCategorySlots(),
  /* Every one of these runs on components the engine has ALREADY bucketed,
     so a fiscal-year clearance rate is the year's terminations over the year's filings
     and never the mean of twelve monthly rates. */
  derive:r=>{ const dt=r.defendants_terminated;
    r.clearance_pct  = r.cases_filed>0?100*r.cases_terminated/r.cases_filed:null;
    r.guilty_pct     = dt>0?100*r.guilty/dt:null;
    r.not_guilty_pct = dt>0?100*r.not_guilty/dt:null;
    r.dismissed_pct  = dt>0?100*r.dismissed/dt:null;
    r.rule_20_21_pct = dt>0?100*r.rule_20_21/dt:null;
    r.other_pct      = dt>0?100*r.other/dt:null; },
  rowExtras:()=>{},
  basisLine:()=>tblBasisLine(),
  afterHead:thead=>mountDocMarkers(DOC_SURFACE,thead,DOC_TH_KEYS),
  copy:TBL_COPY
};
const TBL=window.LIONS_TABLE.make(TBL_DESC);
const activeTblCols=()=>TBL.activeCols(state);
function tblProvWindow(){ return TBL.provWindow(state); }
function tblRowCount(){ return TBL.rowCount(state); }

function tblBasisLine(){
  if(tblSelectionOverlaps()) return TBL_COPY.lineOverlap;
  if(!state.rowsBy.category){
    const sel=tblSelCats();
    if(sel.length>1) return TBL_COPY.lineNoBreakoutSum(grainNoun(),sel.length);
    /* SIX states, not five. This one used to fall through to the
       all-categories line. The enumeration is the contract: a state missing from it does
       not fall through to a neighbour, it gets its own line. */
    if(sel.length===1) return TBL_COPY.lineNoBreakoutOne(grainNoun(),state.occ);
    return TBL_COPY.lineNoBreakoutAll(grainNoun());
  }
  return state.occ==='primary'?TBL_COPY.lineBreakoutPrimary:TBL_COPY.lineBreakoutAllOcc;
}

function renderTable(){ LAST=TBL.render(state); }

/* ── The table is built on FIRST OPEN, not while the disclosure is shut ───────────
 * renderTable() used to run in the main render path whether or not #tablePanel was
 * hidden, so the full price was paid and nothing was shown: measured at 6,494 rows,
 * 356.7 ms of a 634.6 ms build, on every filter, date, preset, metric, occurrence-axis
 * and grain change while the panel stayed closed. A dirty flag carries the staleness
 * across the shut interval and the next open pays it once.
 * TWO THINGS STAY EAGER, and both are state-derived and build no rows. tblRowCount() is
 * three cheap counts, so an over-cap selection still disables Download CSV at the moment
 * it goes over budget, panel open or shut, exactly as it did before this change; and
 * tblBasisLine() reads state only, so the basis line is right and on screen in the same
 * paint in which the panel opens, rather than arriving with the rows a frame later.
 * #rowsby and #colgroups still build directly: both live INSIDE #tablePanel and are
 * unreachable while it is hidden. */
let tblDirty=true;
const tblPanelOpen=()=>!document.getElementById('tablePanel').hidden;
function tblBuild(){ document.getElementById('tblpending').textContent=''; renderTable(); tblDirty=false; }
function tblInvalidate(){
  tblDirty=true;
  if(tblPanelOpen()){ tblBuild(); return; }
  document.getElementById('basisline').textContent=tblBasisLine();
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

const TT={enabled:false,external:extTooltip};
function renderChart(){
  const idxs=visIdx(); const B=grainBuckets(SPINE,idxs,state.grain);
  const labels=grainLabels(B), ymAxis=B.map(b=>SPINE[b.idxs[0]]), pr=B.map(b=>b.partial?3.2:0), anyPartial=grainAnyPartial(B);
  const pct=isPct(state.metric);
  const left=buildSeries(leftItems(),'y');
  const metricMode = state.ax2by==='metric' && state.ax2sel.size>0;
  const right=(state.ax2by!=='metric' && state.ax2sel.size)?buildSeries([...state.ax2sel],'y1'):[];
  const rMetrics = metricMode?[...state.ax2sel]:[];
  // Provisional envelope (spec §3.5): the shaded zone takes the WIDEST window among the
  // plotted metrics; each series fades on its own window, so the band is a conservative
  // envelope and the fades say which series is actually affected inside it.
  const plotted=[state.metric,...rMetrics];
  const nZone=PV.nMax(plotted,PVOPT), nOwn=PV.n(state.metric,PVOPT);
  const flagsZone=PV.bucketFlags(SPINE,B,nZone), flagsOwn=PV.bucketFlags(SPINE,B,nOwn);
  const provDir=PV.dirAll(plotted);
  const mk=(s,j,pal,dash)=>{ const arr=metricArray(bucketComp(aggregateRaw(NAT,FULL,SPINE,s.dists,s.cats),B),state.metric); const col=pal[j%pal.length];
    // borderDash still means "right axis" and is untouched; fade means provisional.
    return PV.decorateLine({label:s.label+(s.axis==='y1'?' (R)':''),data:arr,borderColor:col,backgroundColor:col,tension:.25,pointRadius:pr,pointStyle:'circle',pointBackgroundColor:'#fff',pointBorderColor:col,pointBorderWidth:1.4,pointHoverRadius:4,borderWidth:2,spanGaps:true,borderDash:dash?[5,4]:[],yAxisID:s.axis,_col:col,_pct:pct},flagsOwn,pr); };
  const leftDs=left.map((s,j)=>mk(s,j,PALETTE,false));
  const datasets=[...leftDs, ...right.map((s,j)=>mk(s,j,RPAL,true))];
  rMetrics.forEach((m2,j)=>{ const arr=metricArray(bucketComp(aggregateRaw(NAT,FULL,SPINE,state.dists,state.cats),B),m2); const col=RPAL[j%RPAL.length];
    datasets.push(PV.decorateLine({label:metricLabel(m2)+' (R)',data:arr,borderColor:col,backgroundColor:col,tension:.25,pointRadius:pr,pointStyle:'circle',pointBackgroundColor:'#fff',pointBorderColor:col,pointBorderWidth:1.4,borderWidth:2,spanGaps:true,borderDash:[5,4],yAxisID:'y1',_col:col,_pct:isPct(m2)},PV.bucketFlags(SPINE,B,PV.n(m2,PVOPT)),pr)); });
  const anyR=right.length>0||rMetrics.length>0;
  const rightPct=metricMode?rMetrics.every(isPct):pct;
  const rAxisTitle=(metricMode?(rMetrics.map(metricLabel).slice(0,3).join(', ')+(rMetrics.length>3?'…':'')):metricLabel(state.metric))+' (Right)';
  document.getElementById("legend").innerHTML=datasets.map(ds=>`<span class="lg"><span class="sw" style="background:${ds._col}"></span>${ds.label}</span>`).join("")
     + (anyR?'<span class="lg" style="color:var(--mut)">- dashed = right axis</span>':'')
     + (anyPartial?'<span class="lg" style="color:var(--mut)">* partial period (fewer months than the full period)</span>':'')
     + (PV.anyProv(flagsZone)?PV.legendChip(nZone,provDir):'');   // separate marker from "*" - two different facts
  document.getElementById("chartTitle").textContent=metricLabel(state.metric)+" - by "+(state.seriesBy==='category'?'program category':'district');
  if(typeof window==='undefined'||!window.Chart){ return; }
  const yfmt=pct?(v=>v+'%'):(v=>v.toLocaleString()); const y1fmt=rightPct?(v=>v+'%'):(v=>v.toLocaleString());
  const cfg={type:'line',data:{labels,datasets,_ym:ymAxis,_prov:PV.anyProv(flagsZone)?flagsZone:null},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:TT},
      scales:{x:{grid:{display:false,drawTicks:false},ticks:{color:'#6b6c68',font:{size:11},autoSkip:state.grain!=='month',maxRotation:0,padding:6,callback:grainTick(state.grain)}},
        y:{position:'left',beginAtZero:!pct,title:{display:true,text:metricLabel(state.metric),color:'#6b6c68',font:{size:11}},ticks:{color:'#6b6c68',font:{size:11},callback:yfmt},grid:{color:'#e6e6e3'}},
        y1:{position:'right',display:anyR,beginAtZero:!rightPct,title:{display:anyR,text:rAxisTitle,color:'#212123',font:{size:11}},ticks:{color:'#6b6c68',font:{size:11},callback:y1fmt},grid:{drawOnChartArea:false}}}},
    plugins:[adminBands,PV.plugin]};
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
  // This chart is normalised on cases filed -> the inflow window. Under-reporting makes
  // the MIX wrong, not simply the edge low, because categories mature at very different
  // rates - so the chip uses the 'mix' wording (spec §3.4).
  const nMix=PV.n('cases_filed',PVOPT), flagsMix=PV.bucketFlags(SPINE,B,nMix);
  let datasets;
  if(state.mixMode==='sum'){
    const data=totB.map((t,bi)=>{ if(!t)return null; let s=0; for(const c of cats) s+=cAB[c][bi]; return 100*s/t; });
    datasets=[{label:(allSel?'All categories':cats.join(', ')),data,borderColor:'#212123',backgroundColor:'rgba(33,33,35,.10)',fill:true,tension:.25,pointRadius:0,borderWidth:2,_pct:true,_col:'#212123'}];
  } else {
    datasets=cats.map(c=>{ const col=catColor(c); return {label:c,data:totB.map((t,bi)=>t?100*cAB[c][bi]/t:null),borderColor:col,backgroundColor:col+'cc',fill:true,tension:.2,pointRadius:0,borderWidth:0.8,_pct:true,_col:col,_stacked:true}; });
  }
  document.getElementById("legend2").innerHTML=(state.mixMode==='stacked'?datasets:[{label:datasets[0].label,borderColor:'#212123'}]).map(ds=>`<span class="lg"><span class="sw" style="background:${ds.borderColor}"></span>${ds.label}</span>`).join("")
    + (PV.anyProv(flagsMix)?PV.legendChip(nMix,'mix'):'');
  document.getElementById("chart2Title").textContent="Program Category Distribution";
  if(typeof window==='undefined'||!window.Chart){ return; }
  const stacked=state.mixMode==='stacked';
  const cfg={type:'line',data:{labels,datasets,_ym:ymAxis,_prov:PV.anyProv(flagsMix)?flagsMix:null},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{display:false},tooltip:TT},
      scales:{x:{grid:{display:false,drawTicks:false},ticks:{color:'#6b6c68',font:{size:11},autoSkip:state.grain!=='month',maxRotation:0,padding:6,callback:grainTick(state.grain)}},
        y:{stacked,beginAtZero:true,title:{display:true,text:'% of cases filed',color:'#6b6c68',font:{size:11}},ticks:{color:'#6b6c68',font:{size:11},callback:v=>v+'%'},grid:{color:'#e6e6e3'}}}},
    plugins:[adminBands,PV.plugin]};
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
  // The provisional treatment must not be vision-only. Only appended when the visible
  // range actually reaches the zone (spec §4: To set before the window -> no marker).
  const nA=PV.n(state.metric,PVOPT), aCut=PV.cutIndex(SPINE,nA);
  const provA=visIdx().some(i=>i>aCut)?(' '+PV.noteText(nA,PV.dir(state.metric))):'';
  const nA2=PV.n('cases_filed',PVOPT), aCut2=PV.cutIndex(SPINE,nA2);
  const provA2=visIdx().some(i=>i>aCut2)?(' '+PV.noteText(nA2,'mix')):'';
  chartEl.setAttribute('aria-label',
    `${metricLabel(state.metric)} trend over time, series by ${seriesByText}. Filters: ${distText}; ${catText}; ${state.from} to ${state.to}; counting basis ${basisText}.${provA}`
  );

  const mixText=state.mixMode==='stacked'
    ?'stacked view by category'
    :'combined category share view';
  chart2El.setAttribute('aria-label',
    `Program category distribution over time as a share of cases filed, ${mixText}. Filters: ${distText}; ${catText}; ${state.from} to ${state.to}; counting basis ${basisText}.${provA2}`
  );
}

function render(){
  const needFull=!(state.dists.has('National')||state.dists.size===0)||state.seriesBy==='district';
  /* The district cube can also finish and FAIL: FULL stays null with fullLoading back to
     false, and the old `&& fullLoading` guard fell straight through into aggregateRaw(),
     which threw `full is not iterable` on a null and left the page dead. Return
     on "no FULL" whatever the reason. Two things this deliberately does NOT do: it does
     not overwrite the message ensureFull()'s catch wrote, and it does not fall back to
     the national rows, which would print national figures under a district label. */
  /* render() writes NOTHING to #status. The filter-state line this used to
     print is deleted - the topline caption is a superset of it - and the progress and
     failure messages belong to ensureFull(), which is the only thing that knows which
     one is true. A render that wrote here would wipe a failure within one tick. */
  if(needFull && !FULL) return;
  renderTopline(); renderChart(); renderChart2(); updateChartAccessibility(); tblInvalidate(); }

/* ── THE CSV ────────────────────────────────────────────────────────────────────────
 * It MIRRORS the table: same rows, same order, same figures, same metric column set,
 * plus the six machine columns that carry the marks the screen draws. Headers are raw
 * field names, not display labels. A percentage is emitted at
 * 2dp where the screen rounds to 1dp - that is presentation, not identity.
 *
 * THE PROVISIONAL MARK survives the export boundary as THREE columns, not one, and may not
 * be collapsed: `provisional` is the flag, `provisional_window_months` is what makes it
 * interpretable away from this page, and `period_partial` is a DIFFERENT fact (a bucket
 * holding fewer months than its period, not a bucket still being reported) and must
 * never be merged with it. The newest months are incomplete: mark them, never hide them,
 * and losing a mark at the export boundary loses them just as surely as dropping it here.
 *
 * ONE mark on the screen is NOT in the file and it is named here rather than left to be
 * found: `tr.edge`, the grey tint at or before 1996-09. The table carries that class forward
 * untouched, so the gap is carried forward with it; closing it means shipping a flag
 * whose meaning nobody has written down. */
function csvColumns(){ return TBL.csvColumns(state,LAST.cols.length?LAST.cols:activeTblCols()); }
function buildCSVText(){ return TBL.csvText(state,LAST); }
function buildCSV(){
  /* #dl sits OUTSIDE the panel and is live with the table never built, so the
     download does the build itself rather than going silently dead on the empty LAST
     below. It costs the row-building share only, about 80 ms at 6,494 rows. Same button,
     same rows, same cap, so an over-cap selection still refuses,
     because tblBuild() runs the same refusal branch the table does. civil.page.js does
     the same thing on its own #dl. */
  if(tblDirty) tblBuild();
  if(LAST.rows.length===0) return;   /* if the table refuses to draw, the download refuses too */
  const blob=new Blob([buildCSVText()],{type:"text/csv"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  const dt=(state.dists.has('National')||state.dists.size===0)?'National':(state.dists.size===1?[...state.dists][0]:state.dists.size+'dists');
  const ct=(state.cats.has('ALL')||state.cats.size===0)?'ALL':(state.cats.size===1?[...state.cats][0].replace(/\W+/g,''):state.cats.size+'cats');
  a.download=`lions_${dt}_${ct}_${state.grain}_${state.from}_${state.to}.csv`; a.click();
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
    const sel=document.createElement('select'); sel.innerHTML='<option value="">- pick a metric -</option>'+METRICS.map(m=>`<option value="${m[0]}">${m[1]}</option>`).join('');
    sel.addEventListener('change',()=>{ state.ax2sel=sel.value?new Set([sel.value]):new Set(); renderChart(); }); mount.append(sel);
  } else {
    ax2MS=multiSelect('ax2sel',{items:(state.seriesBy==='category'?CATLIST:districtList()),plain:true,emptyLabel:'pick series…',initial:state.ax2sel,searchable:state.seriesBy==='district',
      fmt:state.seriesBy==='district'?fmtDist:undefined, onChange:v=>{ state.ax2sel=new Set(v); renderChart(); }}); } }
/* The two forms
   of the auto-deselect note, and there is no third. Every cleared sub-category is named,
   however many there are: replacing the names with a count reproduces in miniature the
   defect this repairs, so there is no threshold anywhere in it. No glyph - this is a
   statement of what the control did, not a caution, and a warning mark would frame a
   correct automatic action as the user's error. No figure from the data, ever. The words
   "umbrella" and "sub-category" are taken from basis line 5. Never an em dash. */
const CAT_COPY={
  noteClearedOne:(child,umb)=>[child+' was turned off. ','It is a sub-category of '+umb+', and counting both would count the same cases twice.'],
  noteClearedMany:(children,umb)=>[children.join(', ')+' were turned off. ','They are sub-categories of '+umb+', and counting them with it would count the same cases twice.']
};
// grouped program-category picker: umbrellas (each selectable as its own total) with
// collapsible specific sub-categories. 'All categories' default; groups collapsed by default.
function groupedCatSelect(mountId,opts){
  const wrap=document.getElementById(mountId); wrap.classList.add('ms'); wrap.innerHTML='';
  /* One class, and it is the whole container decision for the CSS. It scopes every
     new rule to the grouped picker, which exists on index.html alone, so nothing here can
     reach the district picker beside it or the other five surfaces. */
  wrap.classList.add('ms-grouped');
  const sel=opts.initial; const expanded=new Set();
  const btn=document.createElement('button'); btn.type='button'; btn.className='ms-btn';
  const panel=document.createElement('div'); panel.className='ms-panel'; panel.hidden=true;
  const list=document.createElement('div'); list.className='ms-list';
  /* The persistent polite live region. Created ONCE and outside .ms-list, because
     draw() replaces .ms-list's innerHTML wholesale and a live region born with its own
     text is not reliably announced. Only its textContent ever changes. */
  const live=document.createElement('div'); live.className='ms-live'; live.setAttribute('role','status');
  const label=()=> (sel.has('ALL')||sel.size===0)?'All categories':(sel.size===1?[...sel][0]:sel.size+' selected');
  const fire=()=>{ btn.textContent=label(); opts.onChange([...sel]); };
  // An umbrella and one of its own specifics cannot both be selected: the specifics
  // partition their umbrella EXACTLY at
  // occ='primary' - 262,827 keys x 9 columns, 0 mismatches - so selecting both counts
  // those cases PRECISELY twice, not approximately. This picker feeds aggregateRaw(),
  // so the double count reached both charts, the topline section, the table and the CSV.
  // He chose preventing the combination over warning about it, and accepted the cost:
  // an umbrella and one of its own specifics cannot be viewed side by side.
  // parentOf is built from opts.specs, because this component is handed its own
  // hierarchy and reads no page global. It assumes a specific label has ONE parent -
  // the same assumption CATMAP already makes. Checked against web/data/ rather than
  // assumed: 95 specific labels, one parent umbrella each, and no umbrella name is also a
  // specific label.
  const parentOf={}; for(const u of opts.umbrellas) for(const s of (opts.specs[u]||[])) parentOf[s]=u;
  /* Transient, and the ONLY state this component carries beyond the selection.
     { umbrella, cleared:[...] }, or null. Set by pick() in exactly one case; cleared by
     the next interaction of any kind, before that interaction is processed. */
  let notice=null;
  const clearNotice=()=>{ notice=null; live.textContent=''; };
  const pick=(key,on)=>{ sel.delete('ALL');
    if(on){
      if(opts.specs[key]){
        /* Three conditions on top of "the box went on", and all of them are this
           component's own state. (1) the key is an umbrella with specifics, (2) at least
           one of them was actually selected, (3) its group is COLLAPSED, so the boxes
           about to clear are not rendered and the user cannot see them go. With the group
           expanded the user watches them untick and the button label is the only thing
           that could mislead, which it does not - so no note there, on purpose. */
        const cleared=opts.specs[key].filter(s=>sel.has(s));
        for(const s of opts.specs[key]) sel.delete(s);                     // umbrella clears its own specifics
        if(cleared.length && !expanded.has(key)) notice={umbrella:key,cleared};
      }
      else if(parentOf[key]) sel.delete(parentOf[key]);                    // specific clears its parent
      sel.add(key);
    } else { sel.delete(key); if(sel.size===0) sel.add('ALL'); } };
  /* The visible note. aria-hidden, because the live region says the same words and
     a screen-reader user must not hear them twice. */
  function noteEl(){
    const parts = notice.cleared.length===1
      ? CAT_COPY.noteClearedOne(notice.cleared[0],notice.umbrella)
      : CAT_COPY.noteClearedMany(notice.cleared,notice.umbrella);
    const d=document.createElement('div'); d.className='ms-note'; d.setAttribute('aria-hidden','true');
    const b=document.createElement('b'); b.textContent=parts[0];
    d.append(b,document.createTextNode(parts[1]));
    live.textContent=parts[0]+parts[1];
    return d;
  }
  function draw(){ list.innerHTML='';
    const allRow=document.createElement('label'); allRow.className='ms-allrow';
    const acb=document.createElement('input'); acb.type='checkbox'; acb.checked=sel.has('ALL');
    acb.addEventListener('change',()=>{ clearNotice(); sel.clear(); sel.add('ALL'); draw(); fire(); });
    allRow.append(acb,document.createTextNode(' All categories')); list.append(allRow);
    for(const u of opts.umbrellas){ const specs=opts.specs[u]||[];
      const row=document.createElement('div'); row.className='ms-grp';
      const lab=document.createElement('label'); const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=sel.has(u);
      cb.addEventListener('change',()=>{ clearNotice(); pick(u,cb.checked); draw(); fire(); });
      lab.append(cb,document.createTextNode(' '+u));
      if(specs.length){ const cnt=document.createElement('span'); cnt.className='cnt'; cnt.textContent=' ('+specs.length+' categor'+(specs.length===1?'y':'ies')+')'; lab.append(cnt); }
      row.append(lab);
      if(specs.length){ const cv=document.createElement('span'); cv.className='cv'; cv.textContent=expanded.has(u)?'▾':'▸';
        cv.title=expanded.has(u)?'Collapse':'Expand sub-categories';
        /* Expanding the group clears the note - at that moment the unticked boxes
           say it themselves and a note beside them is redundant. */
        cv.addEventListener('click',e=>{ e.stopPropagation(); clearNotice(); expanded.has(u)?expanded.delete(u):expanded.add(u); draw(); });
        row.append(cv); }
      list.append(row);
      /* Directly under the group row that fired, which is the row the user has just
         clicked, so it is on screen by construction, and it stands exactly where the
         sub-list would be if the group were open. */
      if(notice && notice.umbrella===u) list.append(noteEl());
      if(specs.length && expanded.has(u)){ const box=document.createElement('div'); box.className='ms-sub';
        for(const s of specs){ const sl=document.createElement('label'); const scb=document.createElement('input'); scb.type='checkbox'; scb.checked=sel.has(s);
          scb.addEventListener('change',()=>{ clearNotice(); pick(s,scb.checked); draw(); fire(); });
          sl.append(scb,document.createTextNode(' '+s)); box.append(sl); }
        list.append(box); } }
  }
  panel.append(live,list); wrap.append(btn,panel); btn.textContent=label(); draw();
  /* Closing the panel ends the note. It describes one interaction, not a standing
     condition, and a note still sitting there on the next open would be claiming to be one. */
  btn.addEventListener('click',e=>{ e.stopPropagation(); if(!panel.hidden){ clearNotice(); draw(); } panel.hidden=!panel.hidden; });
  document.addEventListener('click',e=>{ if(!wrap.contains(e.target)){ if(!panel.hidden){ clearNotice(); draw(); } panel.hidden=true; } });
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
  fullLoading=true; SL.setLoading(SL.COPY.loadDistrict);
  try{ FULL=parseCSV(await fetchText("./data/lions_cube.csv.gz")); if(dMS) dMS.setItems(districtList());
    SL.setLoading(null); SL.clearLoadError(); }
  catch(e){ console.error(e); SL.setLoadError(SL.COPY.errDistrict); } fullLoading=false; }

/* ── THE HINT BUBBLE'S BEHAVIOUR ─────────────────────────────────────────────
   The same function is written again in web/case-lookup/index.html's inline
   <script>: the two pages share no file - Case Look-Up loads none of this chain
   - so keeping the two copies one component is discipline, not code.

   Four openers. Three of them are CSS (hover, :focus-visible, :focus-within) and
   cost no JS at all, so hover and keyboard still work if this script never runs.
   The fourth is this click, which PINS the bubble by flipping aria-expanded,
   because a phone has no hover.

   `root` is the button, or the <label> that wraps it on Case Look-Up - there is
   no label here, and the guard is kept so the two copies stay one component. */
function wireHint(btnId, tipId){
  var b=document.getElementById(btnId), t=document.getElementById(tipId);
  if(!b||!t) return;
  var root=b.closest('label')||b;
  var close=function(){ b.setAttribute('aria-expanded','false'); };
  b.addEventListener('click',function(e){ e.stopPropagation();
    b.setAttribute('aria-expanded', b.getAttribute('aria-expanded')==='true'?'false':'true'); });
  /* Escape from the button and from inside the bubble; focus returns to the
     button so a keyboard user is not stranded on a link that just vanished. */
  b.addEventListener('keydown',function(e){ if(e.key==='Escape') close(); });
  t.addEventListener('keydown',function(e){ if(e.key==='Escape'){ close(); b.focus(); } });
  document.addEventListener('click',function(e){
    if(!t.contains(e.target) && !root.contains(e.target)) close(); });
}

async function init(){ renderNav();
  /* Wired HERE, above the first await, because the bar and its button are
     static markup that paints before any cube arrives and the bubble reads no
     data - so the pin has to work even on the branch below that returns early
     when the national cube fails. */
  wireHint('hintOcc','tipOcc');
  /* The national cube is 1.5-3 MB and until it lands the page is a blank chart
     with no explanation. The message is cleared by the same resource arriving, below;
     the setup between here and the first render() is synchronous, so no paint happens
     in between and clearing here is clearing at the first render. */
  SL.setLoading(SL.COPY.loadInitial[CURRENT]);
  try{ const r=await fetch("./data/lions_cube_national.csv",{cache:"reload"}); NAT=parseCSV(await r.text()); }
  catch(e){ SL.setLoadError(SL.COPY.errInitial); return; }
  SL.setLoading(null); SL.clearLoadError();
  const ms=[...new Set(NAT.map(r=>r.ym))].sort(); SPINE=months(ms[0],ms[ms.length-1]);
  UMB=[...new Set(NAT.filter(r=>r.grp!=='ALL').map(r=>r.grp))].sort((a,b)=>(a==='All Other')-(b==='All Other')||a.localeCompare(b));
  SPECS={}; for(const u of UMB) SPECS[u]=[];
  for(const r of NAT){ if(r.grp!=='ALL' && r.subcat && r.subcat!=='ALL' && r.subcat!==r.grp && !SPECS[r.grp].includes(r.subcat)) SPECS[r.grp].push(r.subcat); }
  for(const u of UMB) SPECS[u].sort((a,b)=>((a.startsWith('Other')?1:0)-(b.startsWith('Other')?1:0))||a.localeCompare(b));
  CATLIST=UMB.slice();
  CATKEYS=[...UMB]; for(const u of UMB) CATKEYS.push(...SPECS[u]);
  CATMAP={ALL:{grp:'ALL',subcat:'ALL'}};
  for(const u of UMB){ CATMAP[u]={grp:u,subcat:'ALL'}; for(const s of SPECS[u]) CATMAP[s]={grp:u,subcat:s}; }
  // The marker rule is an INDEX into "Reading the data", not a severity signal.
  // On this page it flags `cases_filed` and `defendants_filed` only - the two series the
  // DOJ Table 3B entry names. Not `clearance`, not the termination series: a caveat that
  // covers every metric on a surface is carried by the bar link, not by a glyph on each.
  document.getElementById("metric").innerHTML=METRICS.map(m=>`<option value="${m[0]}">${docMetricLabel(DOC_SURFACE,m[0],m[1])}</option>`).join("");
  dMS=multiSelect("district",{items:[],allValue:"National",allLabel:"National (all)",initial:state.dists,searchable:true,fmt:fmtDist,
    onChange:async v=>{ state.dists=new Set(v); if(!(state.dists.has('National')||state.dists.size===0)) await ensureFull(); render(); }});
  cMS=groupedCatSelect("category",{umbrellas:UMB,specs:SPECS,initial:state.cats,onChange:v=>{ state.cats=new Set(v); render(); }});
  buildAx2Picker();
  document.getElementById("metric").addEventListener("change",e=>{ state.metric=e.target.value; render(); });
  document.querySelectorAll('#seriesBy button').forEach(b=>b.addEventListener('click',async()=>{ document.querySelectorAll('#seriesBy button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); state.seriesBy=b.dataset.v;
    if(state.seriesBy==='district') await ensureFull(); if(state.ax2by==='series') buildAx2Picker(); render(); }));
  document.querySelectorAll('#mixMode button').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('#mixMode button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); state.mixMode=b.dataset.v; renderChart2(); }));
  // The table follows Group by: its period column IS the chart's
  // bucket, so a grain change has to rebuild it as well as the two charts.
  document.querySelectorAll('#grain button').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('#grain button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); state.grain=b.dataset.v; renderTopline(); renderChart(); renderChart2(); tblInvalidate(); }));
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
  /* The screen/file difference line is a CONSTANT and is set once here,
     not from renderTable(). #csvline sits outside the panel, under a download button that
     is live from page load, so writing it from the build would leave it blank until the
     panel was first opened. It also closes a pre-existing defect: the refusal branch
     returned before the line was written, leaving the previous text in place. */
  document.getElementById('csvline').textContent=TBL_COPY.csvLine;
  document.getElementById("dl").addEventListener("click",buildCSV);
  // The phone copy of the download button: SAME handler, same file, no second format.
  document.getElementById("dl2").addEventListener("click",buildCSV);
  document.querySelectorAll('#rowsby button').forEach(b=>b.addEventListener('click',async()=>{
    const on=!state.rowsBy[b.dataset.v]; state.rowsBy[b.dataset.v]=on;
    b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false');
    if(b.dataset.v==='district'&&on) await ensureFull(); tblBuild(); }));
  document.querySelectorAll('#colgroups button').forEach(b=>b.addEventListener('click',()=>{
    const on=!state.tblCols[b.dataset.v];
    // never zero metric columns: a table of five key cells is not a narrower table
    if(!on && activeTblCols().filter(c=>c.g!=='key').length<=TBL_COLS.filter(c=>c.g===b.dataset.v).length) return;
    state.tblCols[b.dataset.v]=on; b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false'); tblBuild(); }));
  document.getElementById('tblToggle').addEventListener('click',()=>{ const p=document.getElementById('tablePanel'); const willOpen=p.hidden; p.hidden=!willOpen; const b=document.getElementById('tblToggle'); b.textContent=(willOpen?'▾ Hide data table':'▸ Show data table'); b.setAttribute('aria-expanded',willOpen?'true':'false'); window.dispatchEvent(new Event('resize'));
    if(!willOpen||!tblDirty) return;
    /* Over cap there is nothing to build and no wait to explain, so the refusal shows at
       once and WITHOUT the placeholder (design note section 5). renderTable() returns
       straight out of its refusal branch, so this is cheap enough to run inline. */
    if(tblRowCount()>ROW_CAP){ tblBuild(); return; }
    /* ORDER MATTERS. The panel is already unhidden above, so this mutation lands in a live region that is already visible: a role="status" that gains its text in the same paint in which it appears is not reliably announced. */
    document.getElementById('tblpending').textContent=TBL_COPY.pending;
    /* NEVER synchronous in the handler. The browser paints nothing until a task returns, so a build in here would leave the panel unopened and the disclosure looking dead for the whole build. The first requestAnimationFrame callback still runs before the frame's paint, so the work hangs off the second. */
    requestAnimationFrame(()=>requestAnimationFrame(tblBuild));
  });
  // ── Deliberate prefetch. Do not "optimise" this into a lazy load. ──────────────
  // The district cube (lions_cube.csv.gz, ~9.8 MB) is fetched on EVERY page load,
  // not on district selection. It is intentionally un-awaited, so it never blocks
  // first paint: the national view renders immediately and this streams in behind it.
  // The point is that opening the district filter and switching districts is instant,
  // rather than making the user wait on a multi-megabyte download mid-interaction.
  // Responsiveness over bytes, deliberately. It is the dominant share of
  // this site's bandwidth: do not change it to a lazy load without measuring first.
  ensureFull(); render();
}
if(typeof document!=='undefined') init();
if(typeof module!=='undefined') module.exports={aggregateRaw,metricArray};
