
const DEFAULT_AGS_R=['CBP','ICE','HSI','Secret Service','Coast Guard','FBI','DEA','ATF','USMS','Other DOJ'];
const DEFAULT_AGS_V=['SSA','HUD','IRS','Bureau of Prisons','ICE','HSI','FBI','DEA','Education','Veterans Affairs'];
const state={cls:'R',dists:new Set(['National']),
  ags:new Set(DEFAULT_AGS_R),occ:'lead',metric:'cases_filed',
  agsC:new Set(DEFAULT_AGS_V),role:'Defendant',basis:'cases',metricC:'cases_filed',
  mixMode:'stacked',admins:new Set(),from:'2013-01',to:'2026-06',grain:'month',
  rowsBy:{district:false,dim:false},
  /* every group either mode can show, so switching mode and back does not lose a
     reader's choice. `pending` is the one group off by default (spec C8). */
  tblCols:{cases:true,defendants:true,dispositions:true,rates:true,matters:true,pending:false}};
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
// Each band's `to` is its LAST month, not the next administration's first. `b` in ADMINS
// (shared/config.js) is an EXCLUSIVE end, and visIdx() filters from <= ym <= to, so a `to`
// of "2021-01" put 2021-01, the next administration's first month, inside the Trump I
// range and made it 49 months against the band's 48.
const PRESETS={obama2:["2013-01","2016-12"],trump1:["2017-01","2020-12"],biden:["2021-01","2024-12"],trump2:["2025-01","2026-06"],all:["2013-01","2026-06"]};
const DEPT_ORDER_R=["DOJ","DHS","Treasury","Defense","Interior","USPS","State","HHS","Agriculture","Labor","HUD","Veterans Affairs","Education","Energy/Environment","Commerce","State/Local & Other"];
const SUB_ORDER_R={"DOJ":["FBI","DEA","ATF","USMS","INS (legacy)","Other DOJ"],"DHS":["CBP","ICE","HSI","Secret Service","Coast Guard","TSA","DHS-OIG","Other DHS"]};
const DEPT_ORDER_V=["Social Security Admin","DOJ","DHS","Treasury","HUD","HHS","Education","Veterans Affairs","Small Business Admin","Agriculture","Defense","Labor","Interior","State","EPA","OPM","Energy","Commerce","USPS","Other"];
const SUB_ORDER_V={"DOJ":["Bureau of Prisons","FBI","DEA","ATF","USMS","Other DOJ"],"DHS":["ICE","HSI","CBP","Secret Service","Other DHS"],"Treasury":["IRS","Other Treasury"],"Defense":["Army","Navy","Air Force","Army Corps of Engineers","Other Defense"],"HHS":["FDA","HHS-OIG","Other HHS"]};
const CURRENT="agency.html";
// This page is TWO flag sets over one surface. `agencyCivil` is the Civil mode of
// the same page, so REFERENCES.modes maps it back to `agency` for `?from=`.
const docMode=()=>isCiv()?'agencyCivil':'agency';

// ── `cases_pending` is a COUNTED column, read from its own cube ─────────────────
// `civil_agency_pending_cube_national.csv` / `civil_agency_pending_cube.csv`:
//   ym [, district], department, subagency, role, cases_pending.
// Not a column on `civil_agency_cube`, and not accumulated in the browser any more: the
// old running net plotted Bureau of Prisons at -368 where this page's own table said
// 5,955. A caseload cannot be negative.
//
// THE ZERO-SUPPRESSION CONTRACT, AND IT RUNS THE WHOLE SPINE. The cube omits zero rows -
// the full-spine build measured 127.55 MiB, over GitHub's per-file block - so a month
// with no row ANYWHERE INSIDE THE LOADED CUBE'S OWN min(ym)..max(ym) is a zero. Interior
// gaps are only half of it: 4,712 of 9,306 agency-grain series END BEFORE THE VINTAGE
// EDGE, so an interior-only fill would leave half of them simply stopping, and a line
// that ends in 2019 reads as "no data after 2019" rather than "none after 2019". Outside
// the spine there is nothing, so the value is null and nothing is drawn. Every read goes
// through pendingArrC().
let PCNAT=null,PCFULL=null,PSP_N=null,PSP_F=null,pcnatLoading=false,pcfullLoading=false;
// Provisional (right-censored) data.
// All the logic lives in shared/provisional.js; this page only makes calls.
// Two things this page owns, neither of them logic:
//   scales.x.ticks.padding:6 on every chart carrying the treatment - a LAYOUT
//     PRECONDITION of the gutter bar, not a style choice. The
//     bar lives in that space; Chart.js defaults to 3 and the bar would touch
//     the tick labels.
//   _stacked:true on datasets built for a stacked render - the input to
//     LIONS_PROV.decorateLine's refusal to fade a stacked fill (spec §6.7).
//     Set per render, because the mix charts flip family at runtime.
// This page is dual-mode, so the window set follows the mode: criminal 3/6, civil 4/6.
const PV=window.LIONS_PROV;
const SL=window.LIONS_STATUS;
const pvopt=()=>({civil:isCiv()});
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
function parsePendC(t){ const L=t.trim().split(/\r?\n/), H=L[0].split(","), I=Object.fromEntries(H.map((h,i)=>[h,i]));
  const rows=new Array(L.length-1); let lo=null,hi=null;
  for(let i=1;i<L.length;i++){ const c=L[i].split(","); const ym=c[I.ym];
    if(lo===null||ym<lo) lo=ym; if(hi===null||ym>hi) hi=ym;
    rows[i-1]={ym,grp:c[I.subagency],dept:c[I.department],role:c[I.role],district:I.district!==undefined?c[I.district]:"National",v:+c[I.cases_pending]||0}; }
  return {rows,spine:{lo,hi}}; }
// All agencies selected reads the cube's own `department='ALL' AND subagency='ALL'` total
// row, never a sum of the parts: the parts overlap, so summing them double-counts.
// Only that one key carries subagency='ALL', verified on the published cube, so the same
// filter shape as aggC is correct here.
function pendingArrC(dists,ags,role){
  const useNat=dists.has('National')||dists.size===0;
  const src=useNat?PCNAT:PCFULL, sp=useNat?PSP_N:PSP_F;
  if(!src||!sp) return SPINE.map(()=>null);            // not loaded yet, or the fetch failed
  const agAll=ags.has('ALL'), idx=new Map();
  for(const r of src){
    if(r.role!==role) continue;
    if(!useNat&&!dists.has(r.district)) continue;
    if(agAll?(r.grp!=='ALL'):(r.grp==='ALL'||!ags.has(r.grp))) continue;
    idx.set(r.ym,(idx.get(r.ym)||0)+r.v); }
  return SPINE.map(ym=> (ym>=sp.lo&&ym<=sp.hi) ? (idx.get(ym)||0) : null);
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
// THE CASES BRANCH OF THIS FUNCTION IS DELETED: cases_pending reads the counted
// column. What is left is matters only, and it is still a running net because
// `matters_pending` is NOT in the published pending cube and is deliberately held. Do not add
// a cases-shaped branch back here.
function mattersPendingSeries(R){ return cumsum(R.mr.map((v,i)=>v-R.cf[i]-R.mt[i])); }
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
  case 'cases_pending': return R.cp?R.cp.slice():SPINE.map(()=>null);
  case 'cases_pending_3mo': { const p=R.cp||SPINE.map(()=>null); return p.map((_,i)=>mean3(p,i)); }
  case 'matters_received': return R.mr.slice();
  case 'matters_received_3mo': return R.mr.map((_,i)=>mean3(R.mr,i));
  case 'matters_terminated': return R.mt.slice();
  case 'matters_terminated_3mo': return R.mt.map((_,i)=>mean3(R.mt,i));
  case 'matters_pending': return mattersPendingSeries(R);
  case 'matters_pending_3mo': { const p=mattersPendingSeries(R); return p.map((_,i)=>mean3(p,i)); }
  } return R.cf.slice(); }
// unified accessors
// aggC and aggR are left pure and are still what the module exports; the counted pending
// series is attached here, in the one place every render path goes through.
function aggregate(dists,ags){ if(!isCiv()) return aggR(dists,ags);
  const R=aggC(dists,ags,state.role); R.cp=pendingArrC(dists,ags,state.role); return R; }
function metricArray(R,m){ return isCiv()?metricArrC(R,m):metricArrR(R,m); }
function shareFlow(R){ return isCiv()?R[primaryFlow()]:R.filed; }

function agColor(ag){ const i=curAglist().indexOf(ag); return CATPAL[(i<0?0:i)%CATPAL.length]; }
function selAgs(){ return [...curAgs()]; }
const rint=x=>x==null?"-":Math.round(x).toLocaleString();
const p1=x=>x==null?"-":x.toFixed(1);

// ── THE TOPLINE SECTION ─────────────────────────────────────────────────────────
// The four KPI cards and their renderKPIs() are retired.
// The share denominator is agency_cube's own ALL total row - the parts overlap, so summing
// them double-counts - and that row exists
// ONLY at occ='lead' - aggregate() with ags={'ALL'} takes grp='ALL' and does not filter
// on occ, so the total is found whichever occurrence axis the page is on. The share
// figure names its basis, because the same share at occ='all' is a different and larger
// number.
// A percent metric is handed over as its two component series, so the
// engine computes a ratio of sums and never an average of monthly percentages.
// One crosswalk per context: this page is two cubes and two crosswalks, the same raw
// agency code means different things in the two, and the model is built from
// whichever one the Criminal/Civil toggle is on, and never mixed.
function renderTopline(){
  const R=aggregate(state.dists,curAgs());
  const TOT=aggregate(state.dists,new Set(['ALL']));
  const m=curMetric(), pct=isPct(), stock=PV.family(m)==='stock';
  // denLabel names the series the rate divides BY, for the glance's second slot: the
  // page already has the name, so the slot costs no new string.
  const rate = !isCiv() && m==='clearance' ? {num:R.term,den:R.filed,denLabel:metricLabel('cases_filed')}
             : !isCiv() && m==='guilty_pct' ? {num:R.guilty,den:R.dt,denLabel:metricLabel('defendants_terminated')}
             : !isCiv() && m==='dismissed_pct' ? {num:R.dismissed,den:R.dt,denLabel:metricLabel('defendants_terminated')} : null;
  const ags=curAgs(), all=ags.has('ALL');
  const selName = all ? 'all agencies' : (ags.size===1 ? [...ags][0] : 'the selected agencies');
  const series=metricArray(R,m);
  // The topline engine is ADDITIVE: it decorates what the page has already rendered, and
  // a failure in it must still leave a readable dashboard. A browser holding an old cached
  // shared/shared.js against this page script has no LIONS_TOPLINE, so a missing or
  // throwing engine logs and leaves the chart to render.
  if(!window.LIONS_TOPLINE){ console.warn('LIONS_TOPLINE unavailable - topline section skipped'); return; }
  // Facts here, sentence in the engine. See index.page.js.
  const C=window.LIONS_TOPLINE.COPY;
  try{ window.LIONS_TOPLINE.render({
    spine:SPINE, view:visIdx(), metricKey:m, metricLabel:metricLabel(m),
    // The section's period figures follow the page's Group by control, exactly
    // as the chart and the data table do. No control is added inside the section.
    grain:state.grain,
    kind: pct?'rate':(stock?'stock':'count'), series, rate,
    share:{ sel:shareFlow(R), tot:shareFlow(TOT),
            label:'Share of all referrals', selName,
            occ: isCiv()?'client agency':(state.occ==='lead'?'lead agency':'all occurrences'),
            basis: isCiv()?'Client agency basis.'
                 :(state.occ==='lead'?'Lead agency basis.'
                   :'All-occurrences basis: a case referred by several agencies is counted under each.') },
    allSelected:all,
    districtSel:!(state.dists.has('National')||state.dists.size===0),
    filters:{ mode: isCiv()?C.capModeCiv:C.capModeCrim, districts:distClause(state.dists),
              role: isCiv()?state.role:null,
              selection: all?null:{items:[...ags], noun:C.capNounAgencies},
              occ: isCiv()?C.capOccClient:(state.occ==='lead'?C.capOccLead:C.capOccAll) },
    provN:PV.n(m,pvopt()),
    caption: isCiv()?'U.S. as '+state.role+'.':'Counts U.S. District Court filings only.',
    notOffered: m==='matters_pending',
    loading: isCiv()?!CNAT:!NAT,
    empty: !series.some(v=>v)
  }); }catch(e){ console.warn('LIONS_TOPLINE.render failed - topline section skipped', e); }
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
// A STOCK is a level, so a quarter or a fiscal year takes the level at the
// bucket's LAST month. Summing a stock across a bucket, or cumulating one from the
// window's first month, is what made this chart show Bureau of Prisons at -368 against
// its own table's 5,955. A flow or a ratio is unchanged: bucket the component counts
// first, then run the metric formula - never the mean of the per-month rates.
function seriesFor(dists,ags,metric,B){ const R=aggregate(dists,ags);
  return PV.family(metric)==='stock' ? bucketEnd(metricArray(R,metric),B)
                                     : metricArray(bucketComp(R,B),metric); }
function renderChart(){
  const idxs=visIdx(); const B=grainBuckets(SPINE,idxs,state.grain);
  const labels=grainLabels(B), ymAxis=B.map(b=>SPINE[b.idxs[0]]);
  const pr=B.map(b=>b.partial?3.2:0), anyPartial=grainAnyPartial(B);
  const pct=isPct();
  const ags=selAgs();
  // Provisional: this chart plots one metric across agencies, so the zone and every
  // series share the same window. Anchored to the vintage edge, never to state.to.
  const nOwn=PV.n(curMetric(),pvopt()), flagsOwn=PV.bucketFlags(SPINE,B,nOwn);
  const datasets=ags.map((ag)=>{ const arr=seriesFor(state.dists,new Set([ag]),curMetric(),B); const col=agColor(ag);
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

/* ══════════════════════════════════════════════════════════════════════════════════
   THE DATA TABLE AND ITS CSV
   The engine is LIONS_TABLE in shared/shared.js, which this page already loads, so
   THE PAGE'S FIXED LOAD ORDER IS UNCHANGED: no script and no stylesheet was added to,
   removed from or reordered in this page's list. Everything below is this page's descriptor.

   ONE CROSSWALK PER CONTEXT, AND THIS IS WHERE IT BITES. Two cubes, two crosswalks - agency_cube in
   criminal mode, civil_agency_cube in civil mode - and the descriptor switches whole
   rather than mixing: its columns, its cube read, its slot builder, its provisional
   options and its copy all follow isCiv(). Nothing is shared across the two but the
   engine itself. The same raw agency code means different things in the two contexts, so
   reusing one crosswalk renders a chart that validates and is wrong.

   THE MIRROR TRAP, and it is the reason this page is not a port of index.html.
   lions_cube's total row exists ONLY at occ='all'. agency_cube's exists ONLY at
   occ='lead' - 382 of 382 national rows - and at occ='all' there is no total row at
   all. THE OCCURRENCE AXIS IS THEREFORE NOT FILTERED ON THE TOTAL-ROW BRANCH of
   aggregateTable() below, deliberately: honouring an occ='all' selection there would
   match no row, and the table would read zero or fall through to summing the agencies,
   which is exactly the double-count the cube's own total row exists to prevent. Measured,
   both directions, rather than assumed.
   ══════════════════════════════════════════════════════════════════════════════════ */
const ROW_CAP=window.LIONS_TABLE.ROW_CAP;
const TCOPY=window.LIONS_TABLE.COPY;
/* `g` is the column group a user can switch off; 'key' is never switchable. `w` is the
   provisional-window metric key the column takes - the table's mark is the WIDEST across
   the columns it is currently printing. `fold` marks the columns
   that fold INTO the agency cell below 560px. `cls` carries the stock hairline. */
const TBL_COLS_R=[
  {k:'period',g:'key',h:'Period'},
  {k:'district',g:'key',h:'District'},
  {k:'agency',g:'key',h:'Referring agency'},
  {k:'counting_basis',g:'key',h:'Filtering',fold:true},
  {k:'additive',g:'key',h:'Summable',fold:true},
  {k:'cases_filed',g:'cases',h:'Cases filed',t:'int',w:'cases_filed'},
  {k:'cases_terminated',g:'cases',h:'Cases terminated',t:'int',w:'cases_terminated'},
  {k:'defendants_filed',g:'defendants',h:'Defendants, filed',t:'int',w:'defendants_filed'},
  {k:'defendants_terminated',g:'defendants',h:'Defendants, terminated',t:'int',w:'defendants_terminated'},
  {k:'guilty',g:'dispositions',h:'Guilty verdict',t:'int',w:'guilty'},
  {k:'not_guilty',g:'dispositions',h:'Not guilty verdict',t:'int',w:'guilty'},
  {k:'dismissed',g:'dispositions',h:'Dismissed verdict',t:'int',w:'dismissed'},
  {k:'rule_20_21',g:'dispositions',h:'Rule 20/21 disposition',t:'int',w:'guilty'},
  {k:'other',g:'dispositions',h:'Other disposition',t:'int',w:'guilty'},
  {k:'clearance_pct',g:'rates',h:'Clearance rate',t:'pct',w:'clearance'},
  {k:'guilty_pct',g:'rates',h:'Guilty share',t:'pct',w:'guilty_pct'},
  {k:'not_guilty_pct',g:'rates',h:'Not guilty share',t:'pct',w:'guilty_pct'},
  {k:'dismissed_pct',g:'rates',h:'Dismissed share',t:'pct',w:'dismissed_pct'},
  {k:'rule_20_21_pct',g:'rates',h:'Rule 20/21 share',t:'pct',w:'guilty_pct'},
  {k:'other_pct',g:'rates',h:'Other disposition share',t:'pct',w:'guilty_pct'}
];
const TBL_COLS_V=[
  {k:'period',g:'key',h:'Period'},
  {k:'district',g:'key',h:'District'},
  {k:'agency',g:'key',h:'Client agency'},
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
  {k:'d_judg_us_pct',g:'rates',h:'Judgment for U.S. share',t:'pct',w:'cases_terminated'},
  {k:'d_settle_pct',g:'rates',h:'Settlements share',t:'pct',w:'cases_terminated'},
  {k:'d_against_pct',g:'rates',h:'Judgment against U.S. share',t:'pct',w:'cases_terminated'},
  {k:'d_dismissed_pct',g:'rates',h:'Dismissed share',t:'pct',w:'cases_terminated'},
  {k:'d_other_pct',g:'rates',h:'Other disposition share',t:'pct',w:'cases_terminated'}
];
const TBL_GROUPS_R=[['cases','Cases'],['defendants','Defendants'],['dispositions','Dispositions'],['rates','Rates']];
const TBL_GROUPS_V=[['matters','Matters'],['cases','Cases'],['pending','Pending'],['dispositions','Dispositions'],['rates','Rates']];
/* Every user-facing string this table puts on the page that is not already in
   LIONS_TABLE.COPY, one object per mode. The wording here is settled: do not reword it in
   passing. Never an em dash. */
const TBL_COPY_R={
  totalLabel:'All referring agencies',
  complementLabel:'Other referring agencies, added together',
  dimSum:n=>n+' referring agencies, added together',
  distSum:TCOPY.distSum,
  addsTotal:TCOPY.addsTotal, addsYes:TCOPY.addsYes, addsNo:TCOPY.addsNo,
  addsOne:'is one referring agency',
  /* Two of Criminal's three signed basis values are reused character for character.
     `Primary category` becomes `Lead agency`, which is both the axis agency_cube carries
     and the exact word on this page's own toggle. `All agencies` is deliberately NOT
     reused for the other value: on a row that already names one agency, a cell reading
     `All agencies` reads as a SELECTION rather than as a basis. */
  basisDistinct:'Distinct total', basisLead:'Lead agency', basisAll:'All occurrences',
  lineAll:p=>'One row per '+p+'.',
  lineOne:(p,occ)=>'One row per '+p+'. Figures show each referring agency, counted '+(occ==='lead'?' only once under the lead agency':'under every agency that referred the case')+'.',
  lineSumLead:(p,n)=>'One row per '+p+'. Figures show '+n+' referring agencies added together. Each case is counted once, under the lead agency.',
  lineSumAll:(p,n)=>'One row per '+p+'. Figures show '+n+' referring agencies added together. A case referred by more than one agency is shown in multiple rows.',
  lineBreakoutLead:'Agency rows add up to the total row once "Other referring agencies" is included.',
  lineBreakoutAll:'Agency rows do not add up to the total row, because cases will be included under every agency that referred it. Instead, use the "total" row to see all cases for the selected period.',
  notesExtra:'',
  refusal:(n,cap)=>TCOPY.refusal(n,cap,'referring agencies'),
  pending:TCOPY.pending
};
const TBL_COPY_V={
  totalLabel:'All client agencies',
  complementLabel:'Other client agencies',
  dimSum:n=>n+' client agencies, added together',
  distSum:TCOPY.distSum,
  addsTotal:TCOPY.addsTotal, addsYes:TCOPY.addsYes, addsNo:TCOPY.addsNo,
  addsOne:'is one client agency',
  lineAll:(p,role)=>'One row per '+p+', U.S. as '+role+'. The figures are the dataset\'s total row for all client agencies.',
  lineOne:(p,role)=>'One row per '+p+', U.S. as '+role+'. The figures are one client agency.',
  lineSum:(p,n,role)=>'One row per '+p+', U.S. as '+role+'. The figures are '+n+' client agencies added together, and each case is counted once.',
  lineBreakout:(p,role)=>'One row per '+p+' per client agency, U.S. as '+role+'. The agency rows add up to the total row once "Other client agencies" is included.',
  notesExtra:'Cases pending is a single figure reported at the end of the period, not cases for the period. Do not sum that column.',
  refusal:(n,cap)=>TCOPY.refusal(n,cap,'client agencies'),
  pending:TCOPY.pending
};
const tblCopy=()=>isCiv()?TBL_COPY_V:TBL_COPY_R;
let LAST={rows:[],cols:[],provN:6};
let BYDIST_R=null,BYDIST_V=null;   // district -> its own rows; built once the cube is in

/* The district cubes are 820,160 and 1,014,877 rows, and a cross-tab asks for them once per district slot per agency slot. Indexing once turns each of those scans into the rows that district actually has. Neither cube is mutated after assignment, so the index cannot go stale; it is built lazily so a national-only session never pays. */
function tblDistRows(d){
  const src=isCiv()?CFULL:FULL;
  if(!src) return [];
  if(isCiv()){ if(!BYDIST_V){ BYDIST_V=new Map(); for(const r of src){ let a=BYDIST_V.get(r.district); if(!a){a=[];BYDIST_V.set(r.district,a);} a.push(r); } } return BYDIST_V.get(d)||[]; }
  if(!BYDIST_R){ BYDIST_R=new Map(); for(const r of src){ let a=BYDIST_R.get(r.district); if(!a){a=[];BYDIST_R.set(r.district,a);} a.push(r); } }
  return BYDIST_R.get(d)||[];
}
/* The table needs all NINE numeric columns the mode's cube carries; aggR() and aggC()
   carry six and nine under short field names for the charts. Kept separate rather than
   widened, because the chart path is the hot one.
     target.kind 'all'  - the cube's OWN total row, department='ALL' AND subagency='ALL'.
                          THE OCCURRENCE AXIS IS NOT FILTERED HERE. See the header above.
     target.kind 'keys' - one or more named subagencies AT the selected occurrence axis
                          (criminal) or at the selected role (civil). */
function aggregateTable(dists,target){
  const civ=isCiv(), NUMS=civ?NUM_C:NUM_R;
  const useNat=dists.has('National')||dists.size===0;
  const idx=new Map();
  const add=r=>{
    if(civ && r.role!==state.role) return;
    if(target.kind==='all'){ if(!(r.dept==='ALL'&&r.grp==='ALL')) return; }
    else { if(r.dept==='ALL'||r.grp==='ALL'||!target.keys.has(r.grp)) return;
           if(!civ && r.occ!==state.occ) return; }
    let o=idx.get(r.ym);
    if(!o){ o={}; for(const k of NUMS) o[k]=0; idx.set(r.ym,o); }
    for(const k of NUMS) o[k]+=r[k]; };
  const nat=civ?CNAT:NAT;
  if(useNat){ if(nat) for(const r of nat) add(r); }
  else { for(const d of dists) for(const r of tblDistRows(d)) add(r); }
  const R={}; for(const k of NUMS) R[k]=[];
  for(const ym of SPINE){ const o=idx.get(ym); for(const k of NUMS) R[k].push(o?o[k]:0); }
  /* cases_pending is a COUNTED column in a SECOND cube, read through pendingArrC(),
     which is the only place that knows the zero-suppression contract. It is a STOCK, so
     the engine takes the bucket's LAST month and never a sum. Civil mode only. */
  if(civ) R.cases_pending=pendingArrC(dists,target.kind==='all'?new Set(['ALL']):target.keys,state.role);
  return R;
}
const tblSelAgs=()=>{ const a=curAgs(); return (a.has('ALL')||a.size===0)?[]:[...a]; };

/* agency.html's CRIMINAL slot builder. Additivity here is PER AXIS and is the mirror of
   index.html's: at occ='lead' the department x subagency rows reproduce the total row
   EXACTLY on all 382 months and all nine columns, so the complement row is honest and
   non-negative by construction; at occ='all' they over-count and THERE IS NO TOTAL ROW
   AT ALL, so there is no complement row and there must not be one - total minus a sum of
   overlapping parts can go negative, and a negative "other" row is worse than no row. */
function agencyCrimSlots(st){
  const c=TBL_COPY_R, sel=tblSelAgs(), lead=st.occ==='lead';
  const basis=lead?c.basisLead:c.basisAll;
  const total={label:c.totalLabel,level:'cube_total',target:{kind:'all'},basis:c.basisDistinct,additive:c.addsTotal};
  const member=m=>({label:m,level:'member',target:{kind:'keys',keys:new Set([m])},basis,additive:lead?c.addsYes:c.addsNo});
  if(!sel.length){
    if(!st.rowsBy.dim) return [total];
    const all=AGLIST_R, rows=[total].concat(all.map(member));
    if(lead) rows.push({label:c.complementLabel,level:'complement',complementOf:all,basis,additive:c.addsYes});
    return rows;
  }
  if(!st.rowsBy.dim){
    if(sel.length===1) return [{label:sel[0],level:'member',target:{kind:'keys',keys:new Set(sel)},basis,additive:c.addsOne}];
    return [{label:c.dimSum(sel.length),level:'selection_sum',target:{kind:'keys',keys:new Set(sel)},basis,additive:lead?c.addsYes:c.addsNo}];
  }
  const rows=[total].concat(sel.map(member));
  if(lead) rows.push({label:c.complementLabel,level:'complement',complementOf:sel,basis,additive:c.addsYes});
  return rows;
}

const TBL_DESC={
  spine:()=>SPINE, visIdx:()=>visIdx(),
  cols:()=>isCiv()?TBL_COLS_V:TBL_COLS_R,
  dimKey:'agency',
  get dimNounPlural(){ return isCiv()?'client agencies':'referring agencies'; },
  get hasBasisCol(){ return !isCiv(); },
  hasEdge:true,
  get stockKeys(){ return isCiv()?['cases_pending']:[]; },
  /* The U.S. role is a page filter in civil mode, not a third breakout axis: there is no
     role='ALL' row in civil_agency_cube to check a three-role sum against. It is stated
     in the basis line and rides the CSV as a machine column. Criminal mode has no role. */
  get extraKeyCsv(){ return isCiv()?['us_role']:[]; },
  get pv(){ return pvopt(); },
  defaultWindowKey:'cases_filed',
  aggregate:(st,dists,target)=>aggregateTable(dists,target),
  dimSlots:st=>isCiv()?window.LIONS_TABLE.partitioningSlots(TBL_DESC,st):agencyCrimSlots(st),
  selectedDims:()=>tblSelAgs(),
  dimList:()=>AGLIST_V,
  /* Every ratio runs on components the engine has ALREADY bucketed, so a
     fiscal-year guilty share is the year's guilty dispositions over the year's terminated
     defendants and never the mean of twelve monthly rates. The five criminal disposition
     shares total 100.0% of defendants terminated and the five civil ones total 100.0% of
     cases terminated, because both sets partition their denominator exactly (measured). */
  derive:r=>{
    if(isCiv()){ const ct=r.cases_terminated;
      for(const k of ['d_judg_us','d_settle','d_against','d_dismissed','d_other'])
        r[k+'_pct']=ct>0?100*r[k]/ct:null;
      return; }
    const dt=r.defendants_terminated;
    r.clearance_pct=r.cases_filed>0?100*r.cases_terminated/r.cases_filed:null;
    for(const k of ['guilty','not_guilty','dismissed','rule_20_21','other'])
      r[k+'_pct']=dt>0?100*r[k]/dt:null; },
  rowExtras:r=>{ if(isCiv()) r.us_role=state.role; },
  basisLine:st=>tblBasisLine(st),
  csvLine:(st,n)=>TCOPY.csvLine(n),
  get copy(){ return tblCopy(); }
};
const TBL=window.LIONS_TABLE.make(TBL_DESC);
const activeTblCols=()=>TBL.activeCols(state);
function tblRowCount(){ return TBL.rowCount(state); }
/* SIX STATES in criminal mode and FOUR in civil, counted before the branch was written.
   Seven criminal lines for six states: 2/3 and 4/5 are
   one state each with the occurrence axis choosing the clause, and 6/7 likewise. A state
   missing from the enumeration does not fall through to a neighbour. */
function tblBasisLine(st){
  const p=window.LIONS_TABLE.grainNoun(st.grain), sel=tblSelAgs();
  if(isCiv()){ const c=TBL_COPY_V;
    if(st.rowsBy.dim) return c.lineBreakout(p,st.role);
    if(sel.length>1) return c.lineSum(p,sel.length,st.role);
    if(sel.length===1) return c.lineOne(p,st.role);
    return c.lineAll(p,st.role); }
  const c=TBL_COPY_R, lead=st.occ==='lead';
  if(st.rowsBy.dim) return lead?c.lineBreakoutLead:c.lineBreakoutAll;
  if(sel.length>1) return lead?c.lineSumLead(p,sel.length):c.lineSumAll(p,sel.length);
  if(sel.length===1) return c.lineOne(p,st.occ);
  return c.lineAll(p);
}
function renderTable(){ LAST=TBL.render(state); }

/* The column-group buttons follow the mode, because the two cubes carry different
   columns. Rebuilt by switchClass(); the state map holds every group either mode can
   show, so switching back and forth does not lose a reader's choice. */
function tblGroups(){ return isCiv()?TBL_GROUPS_V:TBL_GROUPS_R; }
function buildColGroups(){
  const host=document.getElementById('colgroups');
  host.innerHTML=tblGroups().map(([g,lbl])=>
    `<button type="button" data-v="${g}" class="${state.tblCols[g]?'on':''}" aria-pressed="${state.tblCols[g]?'true':'false'}">${lbl}</button>`).join('');
  host.querySelectorAll('button').forEach(b=>b.addEventListener('click',async()=>{
    const g=b.dataset.v, on=!state.tblCols[g];
    /* never zero metric columns: a table with only key columns answers nothing */
    if(!on && activeTblCols().filter(c=>c.g!=='key').length<=TBL_DESC.cols(state).filter(c=>c.g===g).length) return;
    state.tblCols[g]=on; b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false');
    /* the ONE column group that costs a fetch - 1.41 MiB national, 66.11 MiB district -
       and the reason it is the one group off by default (spec C8) */
    if(on && g==='pending') await ensurePending(true);
    tblBuild(); }));
}

/* ── The lazy build: the table is not drawn until the panel is opened ──────────────
 * The table is built on the FIRST OPEN of the disclosure and marked stale by any filter,
 * date, preset, mode, occurrence-axis, role, column-group or grain change. TWO THINGS
 * STAY EAGER, and both are state-derived and build no rows: tblRowCount() is three cheap
 * counts, so an over-cap selection disables Download CSV at the moment it goes over
 * budget, panel open or shut; and tblBasisLine() reads state only, so the basis line is
 * on screen in the same paint in which the panel opens. */
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

function buildCSV(){
  /* #dl sits OUTSIDE the panel and is live with the table never built, so the download
     does the build itself rather than going silently dead on the empty LAST below. Same
     button, same rows, same cap, so an over-cap selection still
     refuses, because tblBuild() runs the same refusal branch the table does. */
  if(tblDirty) tblBuild();
  if(LAST.rows.length===0) return;   /* if the table refuses to draw, the download refuses too */
  const blob=new Blob([TBL.csvText(state,LAST)],{type:"text/csv"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  const dt=(state.dists.has('National')||state.dists.size===0)?'National':(state.dists.size===1?[...state.dists][0]:state.dists.size+'dists');
  a.download=`lions_agency_${isCiv()?'civil_'+state.role:'criminal_'+state.occ}_${dt}_${state.grain}_${state.from}_${state.to}.csv`; a.click();
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

/* Both of these used to leave "loading district detail" standing after the load
   had already FAILED - the catch only logged - so the line said, indefinitely, something
   that was not true. The failure message is now written where the failure happens. */
async function ensureFull(){ if(FULL||fullLoading) return; fullLoading=true; SL.setLoading(SL.COPY.loadDistrict);
  try{ const r=await fetch("./data/agency_cube.csv",{cache:"reload"}); FULL=parseCSV_R(await r.text()); if(dMS) dMS.setItems(districtList());
    SL.setLoading(null); SL.clearLoadError(); }catch(e){ console.error(e); SL.setLoadError(SL.COPY.errDistrict); } fullLoading=false; }
async function ensureFullC(){ if(CFULL||cfullLoading) return; cfullLoading=true; SL.setLoading(SL.COPY.loadDistrict);
  try{ const r=await fetch("./data/civil_agency_cube.csv",{cache:"reload"}); CFULL=parseCSV_C(await r.text()); if(dMS) dMS.setItems(districtList());
    SL.setLoading(null); SL.clearLoadError(); }catch(e){ console.error(e); SL.setLoadError(SL.COPY.errDistrict); } cfullLoading=false; }
// ── The pending cubes are fetched LAZILY, never at page load ───────────────────
// `cases_pending` is the only metric that needs them; `matters_pending` does not, because
// it is not in the cube. The district file is 66.11 MiB - the third file on this
// site over GitHub's 50 MiB warning - and is fetched only when a district selection
// actually needs it.
const NEEDS_PEND=m=>m==='cases_pending';
function pendWanted(){ return isCiv()&&NEEDS_PEND(curMetric()); }
async function ensurePendNat(){ if(PCNAT||pcnatLoading) return; pcnatLoading=true;
  SL.setLoading(SL.COPY.loadPending);
  try{ const r=await fetch("./data/civil_agency_pending_cube_national.csv",{cache:"reload"}); const p=parsePendC(await r.text()); PCNAT=p.rows; PSP_N=p.spine;
    SL.setLoading(null); SL.clearLoadError(); }
  catch(e){ console.error(e); SL.setLoadError(SL.COPY.errPending); } pcnatLoading=false; }
async function ensurePendFull(){ if(PCFULL||pcfullLoading) return; pcfullLoading=true;
  SL.setLoading(SL.COPY.loadDistrictPending);
  try{ const r=await fetch("./data/civil_agency_pending_cube.csv",{cache:"reload"}); const p=parsePendC(await r.text()); PCFULL=p.rows; PSP_F=p.spine;
    SL.setLoading(null); SL.clearLoadError(); }
  catch(e){ console.error(e); SL.setLoadError(SL.COPY.errPending); } pcfullLoading=false; }
// `force` is the data table and the CSV. Both print EVERY metric as a column whatever the
// chart happens to be showing, so the pending column has to be real whenever a user can
// actually see it - not only when pending is the selected metric.
async function ensurePending(force){ if(!isCiv()) return; if(!(force||pendWanted())) return;
  await ensurePendNat();
  if(!(state.dists.has('National')||state.dists.size===0)) await ensurePendFull(); }
async function ensureCivil(){ if(CNAT||civilLoading) return; civilLoading=true; SL.setLoading(SL.COPY.loadCivil);
  try{ const r=await fetch("./data/civil_agency_cube_national.csv",{cache:"reload"}); CNAT=parseCSV_C(await r.text());
    const b=buildDepts(CNAT,DEPT_ORDER_V,SUB_ORDER_V); DEPTS_V=b.DEPTS; AGLIST_V=b.AGLIST;
    SL.setLoading(null); SL.clearLoadError(); }catch(e){ console.error(e); SL.setLoadError(SL.COPY.errCivil); } civilLoading=false; }

function buildAgencyPicker(){
  document.getElementById('agencyLabel').textContent=isCiv()?'Client agency (grouped)':'Referring agency (grouped)';
  groupedSelect("agency",curDepts(),curAgs(),v=>{ if(isCiv()) state.agsC=new Set(v); else state.ags=new Set(v); render(); });
}
function populateMetric(){ const sel=document.getElementById("metric");
  // The glyph is an INDEX into "Reading the data", not a severity signal. Which
  // metrics carry it is REFERENCES.flags in shared/config.js, per mode, and a held entry
  // (matters_pending) resolves to no marker at all.
  sel.innerHTML=metricsList().map(m=>`<option value="${m[0]}">${docMetricLabel(docMode(),m[0],m[1])}</option>`).join("");
  if(!metricsList().some(m=>m[0]===curMetric())) setMetric(metricsList()[0][0]); sel.value=curMetric(); }

async function render(){
  // toggle mode-specific controls
  document.getElementById('occbar').hidden=isCiv();
  document.getElementById('civMasters').hidden=!isCiv();
  const needFull=!(state.dists.has('National')||state.dists.size===0);
  if(needFull){ if(isCiv()) await ensureFullC(); else await ensureFull(); }
  /* The ensure above can finish and FAIL, leaving FULL (or CFULL) null. Without this the
     run fell into aggR()/aggC(), which threw `FULL is not iterable` / `CFULL is not
     iterable` on a null and left the page dead. This page has no loading branch
     to fall back on because render() awaits the fetch rather than racing it, so the only
     state to guard is "asked for a district and did not get one". It deliberately does
     not fall back to the national rows, which would print national figures under a
     district label, and it does not overwrite the message ensureFull()/ensureFullC()'s
     catch wrote - both only logged when this guard was written, and both write the
     failure string now. */
  if(needFull && !(isCiv()?CFULL:FULL)) return;
  await ensurePending();
  /* render() writes NOTHING to #status. The filter-state line this used to
     print is deleted - the topline caption is a superset of it - and the progress and
     failure messages belong to the ensure functions, which are the only things that know
     which one is true. A render that wrote here would wipe a failure within one tick. */
  renderTopline(); renderChart(); renderChart2(); renderChart3(); updateChartAccessibility(); tblInvalidate();
}

async function switchClass(cls){
  state.cls=cls;
  if(isCiv()){ await ensureCivil(); if(!(state.dists.has('National')||state.dists.size===0)) await ensureFullC(); }
  populateMetric(); buildAgencyPicker(); buildColGroups(); render();
}

async function init(){ renderNav();
  /* The national cube is 1.5-3 MB and until it lands the page is a blank chart
     with no explanation. The message is cleared by the same resource arriving, below;
     the setup between here and the first render() is synchronous, so no paint happens
     in between and clearing here is clearing at the first render. */
  SL.setLoading(SL.COPY.loadInitial[CURRENT]);
  try{ const r=await fetch("./data/agency_cube_national.csv",{cache:"reload"}); NAT=parseCSV_R(await r.text()); }
  catch(e){ SL.setLoadError(SL.COPY.errInitial); return; }
  SL.setLoading(null); SL.clearLoadError();
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
  document.querySelectorAll('#grain button').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('#grain button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); state.grain=b.dataset.v; renderTopline(); renderChart(); renderChart2(); renderChart3(); tblInvalidate(); }));
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
  /* Opening the panel used to call ensurePending(true) unconditionally, so a reader who
     never wanted the pending column paid up to 66.11 MiB for it anyway. Now the Pending
     column-group button is where the reader asks, and it is off by default (spec C8). */
  document.getElementById("dl").addEventListener("click",buildCSV);
  document.getElementById("dl2").addEventListener("click",buildCSV);
  document.querySelectorAll('#rowsby button').forEach(b=>b.addEventListener('click',()=>{
    const on=!state.rowsBy[b.dataset.v]; state.rowsBy[b.dataset.v]=on;
    b.classList.toggle('on',on); b.setAttribute('aria-pressed',on?'true':'false'); tblBuild(); }));
  buildColGroups();
  document.getElementById('tblToggle').addEventListener('click',()=>{ const p=document.getElementById('tablePanel'); const willOpen=p.hidden; p.hidden=!willOpen; const b=document.getElementById('tblToggle'); b.textContent=(willOpen?'▾ Hide data table':'▸ Show data table'); b.setAttribute('aria-expanded',willOpen?'true':'false'); window.dispatchEvent(new Event('resize'));
    if(!willOpen||!tblDirty) return;
    /* Over cap there is nothing to build and no wait to explain, so the refusal shows at
       once and WITHOUT the placeholder. renderTable()
       returns straight out of its refusal branch, so this is cheap enough to run inline. */
    if(tblRowCount()>ROW_CAP){ tblBuild(); return; }
    /* ORDER MATTERS. The panel is already unhidden above, so this mutation lands in a
       live region that is already visible: a role="status" that gains its text in the
       same paint in which it appears is not reliably announced. */
    document.getElementById('tblpending').textContent=tblCopy().pending;
    /* NEVER synchronous in the handler. The browser paints nothing until a task returns,
       so a build in here would leave the panel unopened and the disclosure looking dead
       for the whole build. The first requestAnimationFrame callback still runs before the
       frame's paint, so the work hangs off the second. */
    requestAnimationFrame(()=>requestAnimationFrame(tblBuild));
  });
  // ── Deliberate prefetch. Do not "optimise" this into a lazy load. ──────────────
  // The district cube (agency_cube.csv, ~40 MB) is fetched on EVERY page load,
  // not on district selection. It is intentionally un-awaited, so it never blocks
  // first paint: the national view renders immediately and this streams in behind it.
  // The point is that opening the district filter and switching districts is instant,
  // rather than making the user wait on a multi-megabyte download mid-interaction.
  // Responsiveness over bytes, deliberately. It is the dominant share of
  // this site's bandwidth: do not change it to a lazy load without measuring first.
  ensureFull(); render();
}
if(typeof document!=='undefined') init();
if(typeof module!=='undefined') module.exports={aggR,aggC,metricArrR,metricArrC,buildDepts,mattersPendingSeries,pendingArrC,parsePendC};
