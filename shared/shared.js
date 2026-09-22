// LIONS dashboards - shared helpers used by every dashboard.


function applyAdmins(){ const idx=[...state.admins].map(k=>ADMIN_SEQ.indexOf(k)).sort((a,b)=>a-b);
  document.querySelectorAll('#presets button').forEach(x=>x.classList.toggle('on', state.admins.has(x.dataset.p)));
  if(idx.length){ state.from=PRESETS[ADMIN_SEQ[idx[0]]][0]; state.to=PRESETS[ADMIN_SEQ[idx[idx.length-1]]][1]; }
  else { state.from=PRESETS.all[0]; state.to=PRESETS.all[1]; }
  const f=document.getElementById('from'),t=document.getElementById('to'); if(f)f.value=state.from; if(t)t.value=state.to; }
function extTooltip(context){ const {chart,tooltip}=context; let el=document.getElementById('chtt');
  if(!el){ el=document.createElement('div'); el.id='chtt'; document.body.appendChild(el);
    el.style.cssText='position:fixed;pointer-events:none;z-index:9999;background:rgba(20,20,22,.95);color:#fff;font:11px/1.45 -apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;padding:8px 10px;border-radius:8px;max-width:340px;box-shadow:0 6px 20px rgba(0,0,0,.32);opacity:0;transition:opacity .08s'; }
  if(!tooltip||tooltip.opacity===0){ el.style.opacity='0'; return; }
  const title=tooltip.title&&tooltip.title.length?fmtMMYYYY(tooltip.title[0]):'';
  let h=title?`<div style="font-weight:600;margin-bottom:4px">${title}</div>`:'';
  (function(){var __d=(tooltip.dataPoints||[]);try{if(chart&&chart.options&&chart.options.scales&&chart.options.scales.y&&chart.options.scales.y.stacked)__d=__d.slice().reverse();}catch(e){}return __d;})().forEach(dp=>{ const ds=dp.dataset; const c=ds._col||ds.borderColor||'#fff';
    const y=dp.parsed.y; const val=y==null?'-':(ds._pct?(+y).toFixed(1)+'%':Math.round(y).toLocaleString());
    h+=`<div style="display:flex;align-items:center;gap:6px;white-space:nowrap"><span style="width:9px;height:9px;border-radius:2px;background:${c};display:inline-block;flex:none"></span><span style="flex:1;overflow:hidden;text-overflow:ellipsis">${ds.label}</span><span style="font-variant-numeric:tabular-nums;padding-left:8px">${val}</span></div>`; });
  // Provisional: one extra line on any point inside the provisional zone.
  // chart.data._prov carries the bucket flags - the same smuggle-on-data convention
  // already used for chart.data._ym. extTooltip serves all four dashboards, so this
  // is the single edit that covers every chart.
  try{ const pf=chart&&chart.data&&chart.data._prov; const dp=(tooltip.dataPoints||[])[0];
    if(pf&&dp&&pf[dp.dataIndex]){ const t=(window.LIONS_PROV?window.LIONS_PROV.tooltipLine():'Provisional - incomplete reporting');
      h+=`<div style="margin-top:5px;padding-top:4px;border-top:1px solid rgba(255,255,255,.2);opacity:.85">${t}</div>`; } }catch(e){}
  el.innerHTML=h; el.style.opacity='1';
  const r=chart.canvas.getBoundingClientRect(), w=el.offsetWidth, ht=el.offsetHeight;
  let x=r.left+tooltip.caretX+14, y=r.top+tooltip.caretY-ht/2;
  if(x+w>window.innerWidth-8) x=r.left+tooltip.caretX-w-14;
  if(x<8)x=8; if(y<8)y=8; if(y+ht>window.innerHeight-8)y=window.innerHeight-ht-8;
  el.style.left=x+'px'; el.style.top=y+'px'; }
// The provisional caveat line that used to sit under a KPI value went with the four KPI cards, and the topline section's own eight provisional strings went with them: the section now carries ONE mark, built by the engine at the foot of this file. The rule they were all written under still binds anything flex or grid: BUILD AND REMOVE the element rather than toggling [hidden], because an author display rule beats the browser's [hidden]{display:none}. The mark's own bubble is the exception that proves it - it is never display:none at all, because it is an aria-describedby target.
function fmtDist(c){ if(c&&c.length===3&&'NSEWMC'.includes(c[2])){ const P={N:'Northern',S:'Southern',E:'Eastern',W:'Western',M:'Middle',C:'Central'}; return c.slice(0,2)+'-'+P[c[2]]; } return c; }
// The district clause of the topline caption, in one place because all four dashboards carry the same 'National' sentinel and the same fmtDist labels. An EMPTY array means the national read - the page fetches the national cube rather than summing 93 districts, and the engine prints 'National' for it, never nothing.
function distClause(dists){ return (dists.has('National')||dists.size===0) ? [] : [...dists].map(fmtDist); }
function fmtMMYYYY(x){ const p=(x||'').split('-'); return p.length===2?p[1]+'-'+p[0]:x; }
function months(a,b){ const r=[]; let [y,m]=a.split("-").map(Number); const [Y,M]=b.split("-").map(Number);
  while(y<Y||(y===Y&&m<=M)){ r.push(y+"-"+String(m).padStart(2,"0")); m++; if(m>12){m=1;y++;} } return r; }
function renderNav(){ const nav=document.getElementById('dashnav'), sel=document.getElementById('dashsel');
  if(nav) nav.innerHTML=DASHBOARDS.map(d=>`<a href="./${d.file}"${d.file===CURRENT?' class="on" aria-current="page"':''}>${d.name}</a>`).join("");
  if(sel){ sel.innerHTML=DASHBOARDS.map(d=>`<option value="${d.file}"${d.file===CURRENT?' selected':''}>${d.name}</option>`).join(""); sel.onchange=()=>{ if(sel.value!==CURRENT) location.href='./'+sel.value; }; } }
/* ── THE STATUS LINE
 * One live region per dashboard - <span id="status" aria-live="polite">, the last child of .sub. It has exactly two jobs: a load in progress and a load that failed.
 *
 * A live region that is out of the accessibility tree when its text is written is never announced, and shared.css's [hidden]{display:none!important} beats any display a component sets - so a builder who leaves the attribute on and adds CSS gets a silent no-op. The element is always in the tree, always empty at rest, and only its textContent changes.
 *
 * Precedence, highest first: an unresolved FAILURE, a load IN PROGRESS, empty. A failure is cleared by the next successful load of ANY resource - not only by the resource that failed - and NEVER by a render. On these pages render() runs immediately after an awaited fetch, so a failure written by that fetch's catch and not protected by the render half of this rule is gone within one tick.
 *
 * THE "ANY RESOURCE" HALF IS A RETREAT, NOT THE DESIGN, and a later reader must not take it for the intended behaviour. This block used to assert that a failure is cleared only by a later successful load of the failing resource itself, and no such behaviour ships: ST below is ONE untagged error slot, clearLoadError() clears it unconditionally, and it has sixteen call sites across the four page scripts (twelve ensureX() success paths plus each page's boot path), so a message about one cube is wiped by a different cube arriving. The same-resource rule was stated in prose and contradicted twenty lines below it in the code that shipped; the prose was corrected rather than the behaviour.
 *
 * THE REAL FIX IS TWO HALVES, NOT ONE: key the slot by resource, AND settle the relevance rule - whether a message that is still true but no longer describes what the reader is looking at should be shown at all. Keying alone would not discharge it, because the mirror of the defect is this same one slot in the other direction: on declinations.html a failure message sticks in bold over a correctly drawn view for the rest of the session, and a resource-keyed message whose resource never reloads sticks exactly as long. Build both halves, not this paragraph.
 *
 * Every string below is settled copy. Do not write a new one, and do not add a glyph: textContent only, so there is no escaping discipline to get wrong.
 */
(function (g) {
  'use strict';
  var COPY = {
    /* progress - muted, weight 400 */
    loadInitial: {
      'index.html':        'Loading criminal case data…',
      'civil.html':        'Loading civil case data…',
      'agency.html':       'Loading referring-agency data…',
      'declinations.html': 'Loading declinations data…'
    },
    loadDistrict:        'Loading district detail…',
    loadPending:         'Loading pending caseload…',
    loadDistrictPending: 'Loading district pending caseload…',
    loadCivil:           'Loading civil data…',
    loadAgency:          'Loading referring-agency data…',
    /* failure - ink, weight 600. Names what failed and one true next step, claims
       nothing about what the charts are currently showing, promises no fix. */
    errInitial:  'This dashboard\'s data could not be loaded. Please refresh the page.',
    errDistrict: 'District detail could not be loaded. Please refresh the page.',
    errPending:  'Pending caseload data could not be loaded. Please refresh the page.',
    errCivil:    'Civil data could not be loaded. Please refresh the page.',
    errAgency:   'Referring-agency data could not be loaded. Please refresh the page.'
  };
  var ST = { err: null, loading: null };
  function paint() {
    var e = document.getElementById('status'); if (!e) return;
    var text = ST.err || ST.loading || '';
    if (e.textContent !== text) e.textContent = text;
    e.classList.toggle('st-err', !!ST.err);
  }
  g.LIONS_STATUS = {
    COPY: COPY,
    setLoading: function (t) { ST.loading = t || null; paint(); },
    setLoadError: function (t) { ST.err = t || null; ST.loading = null; paint(); },
    clearLoadError: function () { ST.err = null; paint(); }
  };
})(typeof window !== 'undefined' ? window : globalThis);

function visIdx(){ const r=[]; for(let i=0;i<SPINE.length;i++){ const ym=SPINE[i]; if(ym>=state.from&&ym<=state.to) r.push(i);} return r; }
// Chart factory: every dashboard chart is created through this so a page can adjust the config just before render (used by the Design-2 lab via window.LIONS_CHART_TWEAK). With no tweak installed it is a passthrough - identical to `new window.Chart(ctx,cfg)`.
function mkChart(ctx,cfg){ if(window.LIONS_CHART_TWEAK){ try{ window.LIONS_CHART_TWEAK(cfg); }catch(e){} } return new window.Chart(ctx,cfg); }

// ── Time-grain grouping: Month (default) / Calendar Quarter / Fiscal Quarter / Fiscal Year ── Purely a re-bucketing of the monthly data - no new cubes. Counts SUM within a bucket; percentages are recomputed by summing the component counts first (ratio-of-sums), so callers bucket the component arrays (bucketComp) and then run their existing metric formula on them. FY convention: FY2025 = Oct 2024 .. Sep 2025 (labeled by the year it ENDS). grain: 'month' | 'cq' (calendar qtr) | 'fq' (fiscal qtr) | 'fy' (fiscal year).
function grainBuckets(spine, idxs, grain){
  if(!grain || grain==='month') return idxs.map(i=>({label:spine[i],idxs:[i],size:1,months:1,partial:false}));
  const info=(ym)=>{ const p=ym.split('-'); const y=+p[0], m=+p[1];
    if(grain==='cq'){ const q=Math.floor((m-1)/3)+1; return {k:y*10+q, label:'Q'+q+' '+y, size:3}; }
    if(grain==='fq'){ const fy=(m>=10)?y+1:y, fm=(m>=10)?m-9:m+3, q=Math.floor((fm-1)/3)+1; return {k:fy*10+q, label:'FY'+fy+' Q'+q, size:3}; }
    const fy=(m>=10)?y+1:y; return {k:fy, label:'FY'+fy, size:12}; };   // fiscal year
  const map=new Map(), out=[];
  for(const i of idxs){ const d=info(spine[i]); let b=map.get(d.k); if(!b){ b={label:d.label,idxs:[],size:d.size}; map.set(d.k,b); out.push(b); } b.idxs.push(i); }
  for(const b of out){ b.months=b.idxs.length; b.partial=b.months<b.size; }   // fewer months than the period holds
  return out;
}
function bucketSum(arr,B){ return B.map(b=>{ let s=0; for(const i of b.idxs){ const v=arr&&arr[i]; if(v!=null) s+=v; } return s; }); }
function bucketComp(R,B){ const o={}; for(const k in R){ if(Array.isArray(R[k])) o[k]=bucketSum(R[k],B); } return o; }
// A STOCK must never be summed across a bucket. A pending caseload is a level measured at a month end, so a quarter's value is the level at the quarter's LAST month, not the sum of its three months and not the net change across them. Pass the full-spine metric array through this instead of running the metric formula over bucketComp'd components. Which metrics are stocks is PV.family(m)==='stock' (shared/provisional.js), which is already the authority for the provisional window and the down-direction copy; do not invent a second predicate. Trailing nulls inside a bucket fall back to the last non-null month in it, so a partial bucket still reports a real level.
function bucketEnd(arr,B){ return B.map(b=>{ for(let k=b.idxs.length-1;k>=0;k--){ const v=arr&&arr[b.idxs[k]]; if(v!=null) return v; } return null; }); }
function grainLabels(B){ return B.map(b=>b.label+(b.partial?'*':'')); }   // "*" flags an incomplete period
function grainAnyPartial(B){ return B.some(b=>b.partial); }
// grain-aware x-axis tick label: month keeps the "year at January" behavior; coarser grains show every label.
function grainTick(grain){ return function(v,index){ const l=this.getLabelForValue(v); if(!l) return '';
  if(grain && grain!=='month') return l; const s=String(l).split('-'); return (s[1]==='01'||index===0)?s[0]:''; }; }

// ── Chart → SVG export (vector download of any dashboard chart) ──
// Reads Chart.js computed geometry (chartArea, scales, element x/y/base). Supports bar + line.
function chartToSVG(chart, opts){
  opts = opts || {};
  const W = chart.width, H = chart.height, A = chart.chartArea;
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const gp = (el,props) => { try{ return el.getProps(props,true); }catch(e){ const o={}; props.forEach(p=>o[p]=el[p]); return o; } };
  const FONT = "Roboto,Helvetica,Arial,sans-serif";
  const scales = chart.scales||{};
  const allS = Object.keys(scales).map(k=>scales[k]);
  const yScales = allS.filter(s=>s.axis==='y');
  const xScale  = allS.find(s=>s.axis==='x');
  const yMain   = yScales.find(s=>s.position==='left') || yScales[0];
  const datasets = chart.data.datasets||[];
  // ── Provisional zone ─────────────────────────────────────────────────────── chartToSVG re-emits geometry by hand and runs no Chart.js plugins, so every mark the treatment makes has to be rebuilt here or the export silently drops the caveat. The numbers come from LIONS_PROV.TILES / .STYLE via svgPattern(), so the canvas and the SVG cannot drift apart.
  const PV_ = (typeof window!=='undefined' && window.LIONS_PROV) ? window.LIONS_PROV : null;
  const PVS = (PV_ && PV_.STYLE) || {rule:'#9a9b96',gutter:'rgba(33,33,35,0.72)',gutterH:3,gutterGap:1,
    label:'Provisional',labelInk:'#3f4043',labelHalo:'rgba(251,251,251,0.92)',labelPad:14,labelTop:24};
  const provFlags = (chart.data && chart.data._prov) || null;
  const provFade = c => (PV_ ? PV_.fade(c) : c);
  const firstProv = f => { if(!f) return -1; for(let k=0;k<f.length;k++) if(f[k]) return k; return -1; };
  let provStacked = false;
  try{ provStacked = !!(chart.options&&chart.options.scales&&chart.options.scales.y&&chart.options.scales.y.stacked); }catch(e){}
  let provX0 = null;
  { const i0 = firstProv(provFlags);
    if(i0>=0 && xScale){
      const half = provFlags.length>1 ? Math.abs(xScale.getPixelForValue(1)-xScale.getPixelForValue(0))/2 : 10;
      provX0 = Math.max(A.left, xScale.getPixelForValue(i0)-half); } }
  // Emits the hatch <rect> for one tile kind. Called before the datasets for 'flat and after them for 'stacked' - the stacking order IS the fix for the hatch being erased.
  const provHatchRect = kind => {
    const pat = PV_ ? PV_.svgPattern(kind)
      : '<pattern id="lionsProvHatch-flat" patternUnits="userSpaceOnUse" width="8" height="8">'
        +'<path d="M-1,1 L1,-1 M0,8 L8,0 M-8,16 L0,8" stroke="rgba(33,33,35,0.13)" stroke-width="1" fill="none"/></pattern>';
    const id = PV_ ? PV_.svgPatternId(kind) : 'lionsProvHatch-flat';
    out.push('<defs>'+pat+'</defs>');
    out.push('<rect x="'+provX0.toFixed(1)+'" y="'+A.top.toFixed(1)+'" width="'+(A.right-provX0).toFixed(1)
      +'" height="'+(A.bottom-A.top).toFixed(1)+'" fill="url(#'+id+')"/>'); };
  const pad = A.left;
  const items = [];
  datasets.forEach((ds,i)=>{ const m=chart.getDatasetMeta(i); if(m&&m.hidden) return;
    const col = ds._col || ds.borderColor || (Array.isArray(ds.backgroundColor)?ds.backgroundColor[0]:ds.backgroundColor) || '#333';
    items.push({label: ds.label||('Series '+(i+1)), col: typeof col==='string'?col:'#333'}); });
  let rows=1, lx=pad;
  items.forEach(it=>{ const w=it.label.length*6.2+22; if(lx+w>W-8 && lx>pad){ rows++; lx=pad; } it._x=lx; it._row=rows; lx+=w; });
  const titleH = opts.title ? 20 : 0, legendH = items.length ? rows*16+8 : 0, top = titleH+legendH, totalH = H+top;
  const out = [];
  out.push('<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+totalH+'" viewBox="0 0 '+W+' '+totalH+'" font-family="'+FONT+'">');
  out.push('<rect x="0" y="0" width="'+W+'" height="'+totalH+'" fill="#ffffff"/>');
  if(opts.title) out.push('<text x="'+pad+'" y="14" font-size="13" font-weight="600" fill="#212123">'+esc(opts.title)+'</text>');
  items.forEach(it=>{ const y=titleH + it._row*16 - 4;
    out.push('<rect x="'+it._x+'" y="'+(y-8).toFixed(1)+'" width="9" height="9" rx="2" fill="'+it.col+'"/>');
    out.push('<text x="'+(it._x+13).toFixed(1)+'" y="'+y.toFixed(1)+'" font-size="10.5" fill="#212123">'+esc(it.label)+'</text>'); });
  out.push('<g transform="translate(0,'+top+')">');
  if(yMain && yMain.ticks){ yMain.ticks.forEach((t,i)=>{ const y=yMain.getPixelForTick(i);
    out.push('<line x1="'+A.left+'" y1="'+y.toFixed(1)+'" x2="'+A.right+'" y2="'+y.toFixed(1)+'" stroke="#e4e4e1" stroke-width="1"/>'); }); }
  yScales.forEach(s=>{ if(!s.ticks) return; const left = s.position!=='right';
    s.ticks.forEach((t,i)=>{ const lab=t.label!=null?t.label:''; if(lab==='') return; const y=s.getPixelForTick(i);
      const x = left ? s.right-6 : s.left+6;
      out.push('<text x="'+x.toFixed(1)+'" y="'+(y+3).toFixed(1)+'" text-anchor="'+(left?'end':'start')+'" font-size="10" fill="#6b6c68">'+esc(lab)+'</text>'); }); });
  if(xScale && xScale.ticks){ const rot=(xScale.options&&xScale.options.ticks&&xScale.options.ticks.maxRotation)||0;
    xScale.ticks.forEach((t,i)=>{ const lab=t.label!=null?t.label:''; if(lab==='') return; const x=xScale.getPixelForTick(i); const y=A.bottom+13;
      if(rot>10) out.push('<text x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" transform="rotate('+rot+' '+x.toFixed(1)+' '+y.toFixed(1)+')" text-anchor="end" font-size="9" fill="#6b6c68">'+esc(lab)+'</text>');
      else out.push('<text x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" text-anchor="middle" font-size="9" fill="#6b6c68">'+esc(lab)+'</text>'); }); }
  out.push('<line x1="'+A.left+'" y1="'+A.top+'" x2="'+A.left+'" y2="'+A.bottom+'" stroke="#c9c9c4"/>');
  out.push('<line x1="'+A.left+'" y1="'+A.bottom+'" x2="'+A.right+'" y2="'+A.bottom+'" stroke="#c9c9c4"/>');
  // Unstacked only: the flat hatch goes UNDER the data. On a stacked chart the fills would erase it (measured: a 3/255 modulation), so there is no "under" and the stacked tile is emitted after the datasets instead.
  if(provX0!=null && !provStacked) provHatchRect('flat');
  for(let i=0;i<datasets.length;i++){ const meta=chart.getDatasetMeta(i); if(!meta||meta.hidden) continue;
    const els=meta.data||[]; const type=meta.type||chart.config.type;
    if(type==='bar'){
      for(const el of els){ if(!el) continue; const p=gp(el,['x','y','base','width','height']);
        const w=p.width||1, x=p.x-w/2, yTop=Math.min(p.y,p.base), h=Math.abs(p.base-p.y);
        if(h<=0.2) continue; const fill=(el.options&&el.options.backgroundColor)||'#888';
        out.push('<rect x="'+x.toFixed(1)+'" y="'+yTop.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+h.toFixed(1)+'" fill="'+fill+'"/>'); }
    } else {
      const dopt=(meta.dataset&&meta.dataset.options)||{};
      const col=dopt.borderColor||datasets[i].borderColor||'#333';
      const bw=dopt.borderWidth!=null?dopt.borderWidth:2;
      const dash=dopt.borderDash||datasets[i].borderDash||[];   // [5,4] means "right axis"
      const stroke=typeof col==='string'?col:'#333';
      const emit=(d,c)=>{ if(!d) return; out.push('<path d="'+d+'" fill="none" stroke="'+c+'" stroke-width="'+bw
        +'"'+(dash.length?' stroke-dasharray="'+dash.join(' ')+'"':'')+' stroke-linejoin="round" stroke-linecap="round"/>'); };
      const pts=[];
      for(const el of els){ if(!el||el.skip){ pts.push(null); continue; } const p=gp(el,['x','y']);
        pts.push((p.x==null||p.y==null||isNaN(p.x)||isNaN(p.y))?null:p); }
      const seg=(from,to)=>{ let d='',on=false;
        for(let k=Math.max(0,from);k<=to&&k<pts.length;k++){ const p=pts[k]; if(!p){ on=false; continue; }
          d+=(on?'L':'M')+p.x.toFixed(1)+','+p.y.toFixed(1)+' '; on=true; }
        return d.trim(); };
      // Each dataset fades on its OWN window (ds._prov, set by LIONS_PROV.decorateLine); chart.data._prov is the chart-wide envelope and is only the fallback. The segment ENTERING the first provisional bucket is faded too, so the faded run starts one point earlier.
      // A stacked chart is never faded. Fading a stacked fill moves the apparent colour, and on a stacked chart the colour is the series identity - the scrim defect by another route.
      const dsFlags=provStacked?null:((datasets[i]&&datasets[i]._prov)||provFlags);
      const i0=firstProv(dsFlags);
      if(i0<0){ emit(seg(0,pts.length-1),stroke); }
      else { emit(seg(0,i0-1),stroke); emit(seg(Math.max(0,i0-1),pts.length-1),provFade(stroke)); }
    }
  }
  if(provX0!=null){
    // Stacked only: the two-tone hatch, OVER the fills.
    if(provStacked) provHatchRect('stacked');
    // Boundary rule (both families) and, on a stacked chart, the open right edge - the stacked stand-in for the line family's hollow terminal point.
    out.push('<line x1="'+(provX0+0.5).toFixed(1)+'" y1="'+A.top.toFixed(1)+'" x2="'+(provX0+0.5).toFixed(1)
      +'" y2="'+A.bottom.toFixed(1)+'" stroke="'+PVS.rule+'" stroke-width="1" stroke-dasharray="3 3"/>');
    if(provStacked)
      out.push('<line x1="'+(A.right-0.5).toFixed(1)+'" y1="'+A.top.toFixed(1)+'" x2="'+(A.right-0.5).toFixed(1)
        +'" y2="'+A.bottom.toFixed(1)+'" stroke="'+PVS.rule+'" stroke-width="1" stroke-dasharray="3 3"/>');
    // The gutter bar - identical on every family, and the only mark outside the plot area. In the export it sits in the same place the canvas puts it.
    out.push('<rect x="'+provX0.toFixed(1)+'" y="'+(A.bottom+PVS.gutterGap).toFixed(1)+'" width="'+(A.right-provX0).toFixed(1)
      +'" height="'+PVS.gutterH+'" fill="'+PVS.gutter+'"/>');
    // The haloed label. NO WIDTH GUARD - an earlier `>64` is what made it absent at the default range; it must not come back here either. There is no measureText in the exporter, so the width is estimated at ~5.8px/char for 10.5px/600, the same figure the check harness stubs; the placement rule itself is LIONS_PROV.labelPlacement so the two cannot disagree about which side wins.
    const zSVG = {x0:provX0, x1:A.right, area:A};
    const twSVG = PVS.label.length*5.8;
    const plSVG = PV_ ? PV_.labelPlacement(zSVG, twSVG)
      : ((A.right-provX0 >= twSVG+PVS.labelPad) ? {x:A.right-7} : {x:provX0-6});
    if(plSVG){
      const lx=plSVG.x.toFixed(1), ly=(A.top+PVS.labelTop).toFixed(1);
      // Two elements rather than paint-order:stroke, so the halo renders in every
      // SVG consumer, not only SVG2-complete ones. Halo first, exactly as on canvas.
      out.push('<text x="'+lx+'" y="'+ly+'" text-anchor="end" font-size="10.5" font-weight="600" fill="none" stroke="'
        +PVS.labelHalo+'" stroke-width="3" stroke-linejoin="round">'+esc(PVS.label)+'</text>');
      out.push('<text x="'+lx+'" y="'+ly+'" text-anchor="end" font-size="10.5" font-weight="600" fill="'
        +PVS.labelInk+'">'+esc(PVS.label)+'</text>');
    }
  }
  out.push('</g></svg>');
  return out.join('');
}
function downloadChartSVG(chart, filename, title){
  try{
    const svg=chartToSVG(chart,{title:title});
    const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
    const a=document.createElement('a'); a.href=url; a.download=filename||'chart.svg';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){ console.error('SVG export failed',e); alert('SVG export failed: '+(e&&e.message||e)); }
}


function docMetricLabel(surface,key,label){
 if(typeof REFERENCES==='undefined') return label;
 return label;
}
function mountDocMarkers(surface,root,labelToKey,base){
  // Marker rendering removed: no-op to avoid inserting glyph markers into headers.
  return;
}

/* ══════════════════════════════════════════════════════════════════════════════════
   THE TOPLINE SECTION. The copy in it is settled: do not reword a string in passing.

   THREE JOBS, THREE SHAPES: a permanent glance strip, a look-up answer and a comparison answer, with ONE ask line covering the last two.

   THE SECTION ROOT KEEPS class="kpis". shell2.js finds the topline by wrap.querySelector('.kpis') and hangs its own "Topline metrics" header and collapse caret off it, so renaming the container would silently remove both and collapsing would stop taking the controls with the figures. The page adds no title of its own.

   NO VINTAGE-DEPENDENT CONSTANT IN ANY COPY STRING. Every number a user reads - the year ranges, the "data runs to" month, every provisional count, the jackknife percentage, the mean-to-median gap, the bucket count, the length of  the current administration - is computed here from the loaded cube at render time. The only digits allowed inside a string are fixed historical dates.

   House style: no em dashes, in the copy and in these comments.═════════════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';

  /* ══ COPY═══════ */
  var COPY = {
    /* ONE caption, true on every state. */
    captionTpl: 'Viewing: {metric}, {range}{filters}.',
     /* Range convention is computed from the months (not from a look-up heading). buildPeriods() calls the same function, so the section must not read "fiscal" on one line and "calendar" on the next. */
    capConvCal: 'calendar months',
    capConvFy: 'FY{a} to FY{b}',
    capConvFy1: 'FY{a}',
    /* the filter clauses. */
    capNational: 'National',
    capMany: '{n} {noun}',
    capRole: 'U.S. as {role}',
    capModeCrim: 'criminal',
    capModeCiv: 'civil',
    capByCat: 'by program category',
    capByAgency: 'by referring agency',
    /* the four occurrence-basis clauses, lower-cased from the basis sentences the model already carries */
    capOccAll: 'measured against all-occurrences',
    capOccPrimary: 'filtered by primary category filing',
    capOccLead: 'organized by lead agency',
    capOccClient: 'organized by client agency',
    /* the four selection nouns, one per dashboard, used when more than one is picked */
    capNounCats: 'categories',
    capNounCauses: 'causes of action',
    capNounAgencies: 'agencies',
    capNounReasons: 'reasons',
    capNounDistricts: 'districts',
     /* The section's single provisional mark replaces eight per-figure provisional strings and the footer's second sentence. The footer retains the page's caption only. There are two strings (name and body) because the icon needs an accessible name (announced by screen readers) in addition to the explanatory body text. The body is direction-neutral: it covers flows (which may rise), stocks (which may fall),and shares (whose composition changes). It carries `Data runs to {month}`, the one item the removed footer uniquely supplied. The {n} value is computed (model.provN,  LIONS_PROV.n()) for the selected metric so it follows metric changes. */
    provMarkName: 'Why recent months are incomplete',
    provMarkBody: 'Data runs to {month}. The most recent {n} months are still being reported, so figures may change.',

    /* controls */
    askLead: 'Calculate',
    askCompare: 'Compare with a second period',
    jobCompare: 'Compare two periods',
    measureLabel: 'Figure',
    /* the ONLY period label left: form 5's second period. There is no first-period
       control to label. */
    windowBLabel: 'Second period',
    windowBLabelStock: 'Second date',
    formLabel: 'Comparison',
    eraLabel: 'Administration',
     /* NO TRAILING COLON. The render appends its own colon, so this string must not carry one. A stray colon here produced `Calculation:: ...` on every comparison card across all dashboards and grains, a long-standing issue found by driving the comparison card in a real browser. The fix removes the colon from the string and leaves the render to append it. Do not revert this by adding the colon here and removing it from the render - that would reintroduce the defect. This label has exactly one consumer. */
    basisLabel: 'Calculation',
    alsoHead: 'Other topline calculations',

    /* DEFINITIONS - FIVE, and only in the look-up answer. A definition appears only where the label is not already the definition: Middle month, Overall rate, Share of the total, and the average and middle month-end readings on a stock. Each of those five denies a specific wrong  reading its own label invites, which is the test for a sixth. Seven were struck with their figures - total, average per month, the highest month, the lowest month, the first and last month, the reading at a date and the highest month-end reading - and  their text is NOT quoted here, because copy left in the source is how a later reader restores it word for word.
     /* A BASIS IS NOT A DEFINITION and is not cut: the two rules that a total is the cube's own ALL row and that a ratio is a ratio of sums both live in the basis, so a share keeps its denominator sentence and a rate keeps what divides what, on the glance strip as well as in the answer. The settled-months half of three struck definitions survives as COPY.noteSettledOnly, which still prints on all three. */
    /* THE NOUN SLOTS: every one of them renders the SETTLED SENTENCE BACK CHARACTER FOR CHARACTER at Group by = Month. {bucket} / {buckets} / {perBucket} / {bucketEnd} fill from GRAIN below: month / months / monthly / month-end at the default grain, and the calendar-quarter, fiscal-quarter and fiscal-year forms otherwise. */
    defMedian: 'The middle value of {n} {perBucket} totals.',
    defMedianFew: 'The middle value of {n} {perBucket} totals. Note, few {buckets} are selected making trend analysis difficult.',
    defShare: 'Note this figure is calculated as a share of the total of the selected time period.',
    defStockAvg: 'The average of the {n} {bucketEnd} readings in the period. Not the same as the year-end reading.',
    defStockMedian: 'The middle value of {n} {bucketEnd} readings.',

    /* PERCENT METRICS. The figure menus originally covered flows and stocks only, and clearance, guilty and dismissed are selectable on Criminal and Agency. A rate carries EXACTLY THREE figures - Overall rate, Middle month, Share of the total. No Total (adding percentages is not a quantity), no Average per month (a mean of ratios, which is never the right answer: 100.52% correct against 102.60% averaged), and no extremum or first-and-last, because an extremum of a ratio series is set by its denominator and a single month at district-and-category grain can carry a handful of cases. */
    mRate: 'Overall rate',
    defRate: 'The period\'s component totals divided one by the other, not the average of the monthly percentages.',
    defMedianRate: 'The middle value of {n} {perBucket} percentages. It is not the period\'s overall rate, which divides the totals.',
    /* the glance's second slot on a rate is the total the rate divides BY, labelled with that series' own metric name. Without this clause the strip reads as two unrelated figures side by side, which is what the 1200px shot showed before it was written. */
    basisRateDen: 'The total this rate divides by.',

    /* notes that qualify a figure */
    noteBestCause: 'Note a single {bucket} may reflect a court closure or a one-off batch, not a spike at that period of time.',
    noteSettledOnly: 'Analyzed over settled {buckets} only, so provisional {buckets} are not included.',
    noteMeanMedian: 'The average and the middle {bucket} differ by {gap}% here. District-level averages are more uneven than nationally.',
    /* `is an signal` -> `is a signal`. This is the ONE string in the section that does NOT render character for character as it did before the noun slots landed, at Group by = Month, and it is a deliberate copy change rather than a slip: nothing else in the sentence moves. */
    noteStockPeakEdge: 'Over all {buckets} the peak is the newest {bucket}, {edge}, which, due to incomplete reporting, is not necessarily a new high.',
    noteStockSelected: 'Pending is a sum of cases. A total over a period adds up month-end balances which is not how pending cases are reported, so this section offers pending cases at a specific date instead.',
    noteStockNoPrior: 'Pending cases cannot be compared over a prior period, only a figure at one date versus another.',
    noteShareWhole: '',
    /* THE {bucketEnd} SLOT HERE IS DELIBERATE. The sentence renders byte-identical at Month grain. It takes the slot because it prints on the SAME CARD as basisFigStockHalves below, about the SAME figure: without it, fiscal-year grain gave a basis line saying `fiscal-year-end` and a note beside it saying `month-end`. See the form 2 stock branch in buildPair() for the half of this the comment there used to argue against. */
    noteStockHalves: 'Pending cases has no half total. Each half is read as its average {bucketEnd} level over that half.',

    /* ══ THE SIX GRAIN STRINGS, and EVERY ONE IS SILENT AT GROUP BY = MONTH.
    ═══════════════════════ */
    /* the divisor, on the period line, beside the figure that divides by it. */
    bucketCount: '{n} {buckets}',
    bucketCountPart1: '{n} {buckets}, one of them a partial period',
    bucketCountPartN: '{n} {buckets}, {p} of them partial periods',
    /* the "*" key. VERBATIM the string the four page scripts already print under their charts (web/scripts/index.page.js:475 and its three siblings), so the mark a reader meets under the chart means the same thing above it. The data table prints a DIFFERENT sentence for the same mark; unifying the three is an open question, not this change. */
    partKey: '* partial period (fewer months than the full period)',
    /* on the highest and the lowest figure, and only where a part period was actually dropped. Measured: `Lowest fiscal year` over the default Criminal range is 48,427(FY2023) with the exclusion and 45,682 (FY2013*) without - a different year, 5.7% low, on nine months. */
    notePartExcluded: 'Partial periods are excluded.',
    /* the ratio-of-sums rule said out loud on the one figure a coarse grain makes newly misreadable: a reader who sees `Middle calendar quarter 95.03%` can assume the quarter is the average of its three monthly percentages. It is not. */
    defBucketRate: 'Each {bucket}\'s percentage is the share of {bucket} totals, not the average across months.',
    /* forms 3, 4 and 5 on a stock. STRUCK with it: 'This comparison starts from the current administration, so the period above does not apply.' Forms 3 and 4 printed it beside a period select they had disabled, and there is no period select to disable. */
    basisStockPeriod: 'The average open caseload over each period. This period should be read as average {bucketEnd} level rather than as a sum.',

    /* ══ THE COMPARISON BASIS IS A FIGURE CLAUSE AND THEN A PERIOD CLAUSE. The figure drives the comparison, so the basis is a function of (figure, form, lengths) and it is COMPOSED rather than written out sixty times. `Total` is not in this block: it keeps the length rule and its whole settled sentence, built per form in buildPair() and rendered character for character as before. Every other figure reuses that sentence's second half - the PERIOD clause, also built per form - after its own first half, below. Nine of these are new wording; the three stock sentences above and beside them are MOVED from "the form's basis" to "this figure's clause" with no word changed. */
    basisFigAvg: 'Per {bucket}, each period\'s total divided by {perBucket} count.',
    basisFigMedian: 'The middle {bucket} of each period.',
    basisFigBest: 'The highest single {bucket} in each period, settled {buckets} only.',
    basisFigWorst: 'The lowest single {bucket} in each period, settled {buckets} only.',
    basisFigFirstLast: 'The first and last {bucket} of each period, with their dates.',
    basisFigRate: 'Each period\'s totals divided one by the other.',
    basisFigMedianRate: 'The middle of each period\'s {perBucket} percentages.',
    basisFigStockMedian: 'The middle {bucketEnd} reading in each period.',
    basisFigStockPeak: 'The highest {bucketEnd} reading in each period, settled {buckets} only.',
    /* MOVED, not new: form 1's stock sentence and form 2's stock sentence were the FORM's basis and are now the clause of the figure the form used to choose on the user's behalf. Not one word of either changes. The third, basisStockPeriod above, moves the same way and is the `Average month-end reading` clause on forms 3, 4 and 5. */
    basisFigStockRead: 'Two readings, one date each. Both dates are settled. Pending cases have no prior period of the same length, so this form reads the same date a period earlier.',
    basisFigStockHalves: 'The average {bucketEnd} open caseload over each half. Pending cases have no half total, so a half is read as its average {bucketEnd} level rather than as a sum.',
    /* THE SHARE CLAUSE IS THE ONE AMENDED STRING. It was form 4's basis, so it named an administration and unequal lengths; it now prints on every form including form 1 where both periods are the same length and neither is an administration. Two words:`Each administration's` -> `Each period's`, `the unequal lengths` -> `the periods' lengths`. Nothing else in the sentence moves. It is built rather than stored because it carries the page's own selection name and occurrence basis. */
    /* a middle month over few values moves on any one of them. On a PAIR the span is computed over the two periods ACTUALLY compared and the wider is printed. */
    /* THE {buckets} SLOT AND THE BUCKET TRIGGER ARE DELIBERATE. The sentence renders byte-identical at Month grain. Both halves moved together and the trigger is the half that mattered: the look-up's own few-values caveat now counts BUCKETS, so a five-fiscal-year range at Fiscal Year grain fired it on the look-up (5 buckets) and stayed silent on a comparison of the same metric (form 2's halves are 30 months each) - the caveat went  missing exactly where a reader needs it. Wording it alone would have left that. */
    notePairMedianFew: 'Note this analysis contains few {buckets}, so read this comparison as an indication rather than a settled figure.',
    /* THERE IS NO SETTLED-ONLY BASIS SENTENCE. The five that existed went with the settled-months control: a comparison that reaches into provisional months now computes over ALL months, which is what the default always did. The two stock basis lines are NOT struck and not amended - a stock's truncation inside a comparison is a COMPUTATION rule and never was that control, and each side's label names the months actually read, which is the standing "say which date it is" rule. THERE IS NO PROVISIONAL STRING HERE EITHER. The eight that were - the flow flag, the share flag, the stock flag, the "how much of the face" line, the two comparison direction lines, form 2's second-half line and the footer's second sentence - are replaced by the one section mark above. They are removed rather than left unreachable: copy sitting in the source is how a later reader restores it word for word. What the section no longer tells the reader was weighed and accepted. */

    /* THREE refusals. None carries a measured figure. */
    refuseNoEarlier: 'The data begins in October 1994, so there is no earlier period of the same length as this one. Choose a second period instead.',
    refuseShortHalves: 'This period is shorter than two years, so each half would cover less than a full year. The comparison is not offered below two years. Choose a longer period, or compare with a second period instead.',
    /* form 3 takes the FIRST N months of the chosen administration, N being the chart range's own length. When the administration is shorter there are not N months to take, and the form REFUSES rather than capping: capping answers form 4's question under a label that says "the same months", and form 4 is the next line of the same menu. */
    refuseEraShort: '{name} covers {m} months of this data and the chart\'s date range is {n} months, making an unequal comparison. Choose the whole of an earlier administration instead, or shorten the chart\'s date range.',

    /* declinations */
    armD: '',
    scheme: 'The declination reason scheme changed in fiscal year 2015. Reasons recorded before October 2014 are approximate, so this comparison is not like for like.',
    declTrend: 'This series now reads as falling over three decades. Whether that is a change in prosecution practice or in recording behaviour has not been established.',

    /* states */
    unavailable: 'Not available for this period.',
    /* appended to the line above when matters_pending is selected. Section 3 asks the partial-data state for the sentence AND one clause naming what is missing; the signed block carried only the first, and this is the second (9e delta, gap 3). */
    notOfferedMatters: 'Matters pending is not published as a single figure, only as a running total since October 1994, so this section does not put a number on it.',
    zero: 'None in this period.',
    loading: 'Still loading.'
  };

  /* ══ THE FIVE COMPARISON FORMS, in this order. A developer may not add a sixth, reorder them, or change a basis. The set is closed, not a starting point: a sixth has to be agreed outside the code, not decided in it. ═══════════════════════════════════════════════ */
  var FORMS = [
    { k: 'prev',     label: 'The previous period, same length' },
    { k: 'halves',   label: 'First half against second half' },
    { k: 'eraLike',  label: 'The same months of another administration' },
    { k: 'eraWhole', label: 'The whole of another administration' },
    { k: 'free',     label: 'A second period I choose' }
  ];

  /* ══ small helpers ══════════════════════════════════════════════════════════════ */
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                'August', 'September', 'October', 'November', 'December'];
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function monthName(ym) {
    if (!ym) return '';
    var p = String(ym).split('-');
    return MONTHS[(+p[1] || 1) - 1] + ' ' + p[0];
  }
  function fyOf(ym) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7); return m >= 10 ? y + 1 : y; }
  function fyStart(y) { return (y - 1) + '-10'; }
  function fyEnd(y) { return y + '-09'; }
  function addMonths(ym, k) {
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + k;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + '-' + (m + 1 < 10 ? '0' : '') + (m + 1);
  }
  var nInt = function (x) { return x == null ? '-' : Math.round(x).toLocaleString(); };
  var n1 = function (x) { return x == null ? '-' : x.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }); };
  var n2 = function (x) { return x == null ? '-' : x.toFixed(2); };
  function signed(x, unit) { return x == null ? '-' : (x >= 0 ? '+' : '') + x.toFixed(2) + unit; }
  function median(vals) {
    var a = vals.filter(function (v) { return v != null; }).sort(function (x, y) { return x - y; });
    if (!a.length) return null;
    var m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  /* ══ GROUP BY - the section's period figures follow the page's grain ═════════════ The section has NO period control of its own and gains none here: Group by sits in the page's own .controls bar with From, To and Administration, and this section follows it exactly as it follows those. The engine did not always read it, so the chart re-bucketed and the figures above it went on saying `Average per month` off the same control. grainBuckets() and bucketEnd() are at file scope, shared/shared.js:61-83, and the charts and the data table already use them. NO ASSET IS ADDED, so every page's fixed load order is unchanged. ═══════════════════════════════════════════════════════════════════ */
  var GRAIN = {
    month: { one: 'month',            many: 'months',            adj: 'monthly',          end: 'month-end' },
    cq:    { one: 'calendar quarter', many: 'calendar quarters', adj: 'calendar-quarter', end: 'calendar-quarter-end' },
    fq:    { one: 'fiscal quarter',   many: 'fiscal quarters',   adj: 'fiscal-quarter',   end: 'fiscal-quarter-end' },
    fy:    { one: 'fiscal year',      many: 'fiscal years',      adj: 'fiscal-year',      end: 'fiscal-year-end' }
  };
  /* an unknown grain falls back to month, so a bad state cannot print an empty noun */
  function gnoun(grain) { return GRAIN[grain] || GRAIN.month; }
  function gfill(tpl, grain) {
    var G = gnoun(grain);
    return String(tpl)
      .replace(/\{bucket\}/g, G.one)
      .replace(/\{buckets\}/g, G.many)
      .replace(/\{perBucket\}/g, G.adj)
      .replace(/\{bucketEnd\}/g, G.end);
  }
  /* A NULLABLE bucket sum, and it is deliberately NOT the file-scope bucketSum() at :73. That one returns 0 for a bucket whose every month is null, which is right for a chart - a plotted 0 sits among its neighbours and reads as a gap - and wrong here, where one bucket becomes a headline `Lowest calendar quarter` with nothing beside it. A series that ends before the vintage edge would win every lowest reading with a zero it never recorded, and 1,364 of 3,726 civil-grain series and 4,712 of 9,306 agency-grain series do end early (web/scripts/civil.page.js:21). figureFor() already skips nulls at month grain, so returning null PRESERVES the section's behaviour rather than adding one. */
  function bucketVals(arr, B) {
    return B.map(function (b) {
      var s = 0, any = false;
      for (var k = 0; k < b.idxs.length; k++) {
        var v = arr && arr[b.idxs[k]];
        if (v != null) { s += v; any = true; }
      }
      return any ? s : null;
    });
  }
  /* ONE re-bucketing of ONE period. Called per period and never once per model: the chart's range, each of buildPeriods()'s presets and each SIDE of a comparison have different months and different edges, and grainBuckets() takes an index list for exactly that reason. */
  function periodGrain(M, idxs, grain) {
    var B = grainBuckets(M.spine, idxs, grain), vals, i;
    if (M.kind === 'rate') {
      /* THE RATIO RULE, and this is the whole of it: sum the NUMERATOR and the DENOMINATOR inside the bucket and divide ONCE. Never the mean of the monthly percentages. Measured on the shipped district cube: VT guilty disposition %, Q4 2022, is 78.79% done this way against 87.04% done as the mean of its three monthly rates - 10.47% relative, 8.25 percentage points. At month grain the two coincide exactly, which is why the error is invisible until the grain changes. */
      var num = bucketVals(M.rate.num, B), den = bucketVals(M.rate.den, B);
      vals = num.map(function (n, j) { return (den[j] > 0) ? 100 * n / den[j] : null; });
    } else if (M.kind === 'stock') {
      /* A STOCK IS NEVER SUMMED ACROSS A BUCKET. A pending caseload is a level at a month end, so a quarter reads the level at the quarter's LAST month. */
      vals = bucketEnd(M.series, B);
    } else {
      vals = bucketVals(M.series, B);
    }
    /* A BUCKET IS PROVISIONAL IF ANY MONTH IN IT IS - shared/provisional.js:136's own rule, which the four charts already use. At a coarse grain that is strictly MORE conservative, and it is the same boundary the chart band draws. */
    var prov = B.map(function (b) {
      return b.idxs.some(function (j) { return j > M.cut; });
    });
    var eligible = [], nPart = 0;
    for (i = 0; i < B.length; i++) {
      if (B[i].partial) nPart++;
      /* whole AND settled, in that order of reasons: a part period would be highest or lowest on its LENGTH and a provisional one on its REPORTING. Neither is about the caseload. The table MARKS a short bucket and prints it among its neighbours; the topline prints one bucket as a headline with nothing to compare it to, so it excludes instead. Measured: `Lowest fiscal year` over the default Criminal range is 48,427 (FY2023) with the exclusion and 45,682 (FY2013*) without. */
      if (!B[i].partial && !prov[i]) eligible.push(i);
    }
    return {
      B: B, vals: vals, prov: prov, eligible: eligible, nPartial: nPart,
      /* the bucket's own label, carrying the SAME trailing "*" grainLabels() puts on the chart axis and the data table puts in its Period column. */
      labels: B.map(function (b) {
        return ((!grain || grain === 'month') ? monthName(b.label) : b.label) + (b.partial ? '*' : '');
      }),
      /* the month a bucket ENDS on, which is the date a stock reading puts on its face */
      endMonth: B.map(function (b) { return M.spine[b.idxs[b.idxs.length - 1]]; })
    };
  }
  /* the LAST SETTLED bucket, which is the same rule one level up: a settled bucket has every month settled, so its end month is a real settled month. Part periods are NOT excluded here - a part period's end is still a real month-end level and the figure names the month, which is that rule's own instruction. */
  function lastSettledBucket(P) {
    for (var i = P.B.length - 1; i >= 0; i--) if (!P.prov[i]) return i;
    return P.B.length ? P.B.length - 1 : -1;
  }

  /* ══ THE MODEL. Each page builds one of these per render and hands it over. Nothing in here is a cube read: the page has already fetched and filtered, and this module only ever does a second pass over the monthly series it is given. ═════════════ */
  function levelOver(M, idxs) {
    if (!idxs.length) return null;
    if (M.kind === 'rate') {                       /* sum the numerator and the denominator across the period, then divide - never average the per-month rates */
      var n = 0, d = 0;
      for (var i = 0; i < idxs.length; i++) { n += M.rate.num[idxs[i]] || 0; d += M.rate.den[idxs[i]] || 0; }
      return d > 0 ? 100 * n / d : null;
    }
    if (M.kind === 'stock') return M.series[idxs[idxs.length - 1]];
    var s = 0, any = false;
    for (var j = 0; j < idxs.length; j++) { var v = M.series[idxs[j]]; if (v != null) { s += v; any = true; } }
    return any ? s : null;
  }
  function sumOf(arr, idxs) {
    var s = 0; for (var i = 0; i < idxs.length; i++) s += (arr[idxs[i]] || 0); return s;
  }
  function shareOver(M, idxs) {
    if (!M.share || !idxs.length) return null;
    var t = sumOf(M.share.tot, idxs);
    return t > 0 ? 100 * sumOf(M.share.sel, idxs) / t : null;
  }
  function fmtLevel(M, v) {
    if (v == null) return '-';
    return M.kind === 'rate' ? n2(v) + '%' : nInt(v);
  }
  function fmtRate(M, v) { return M.kind === 'rate' ? n2(v) + '%' : n1(v); }

  /* ══ THE RANGE LABEL AND THE CAPTION ═══════════════════════════════════════════ ONE function labels a range, and it is used by the caption AND by the chart period every glance figure and every look-up heading prints. That is not a tidiness point: with two of them the section reads "(FY2016 to FY2025)" in its caption and "(calendar months)" for the same months three lines below. A range from an October to a September is exactly a whole number of fiscal years - the FY convention at shared.js:55, labelled by the year it ENDS - and nothing else is. There is no window, no tolerance and no judgement in the test, and a user who types those months into From and To gets the same label as one who clicks the FY preset, which is the point of computing it. NAMED labelRange and not rangeLabel because rangeLabel(M, idxs) already exists lower down, for a COMPARISON's two sides; a second `function rangeLabel` here hoists over it and every comparison label goes undefined. */
  function labelRange(a, b) {
    var conv;
    /* the first render happens before the cube has arrived, and the page's view indices can point past an empty spine. monthName() has always returned '' for a missing month; this keeps that exact behaviour rather than throwing inside the caption. */
    if (!a || !b) return monthName(a) + ' to ' + monthName(b) + ' (' + COPY.capConvCal + ')';
    if (a.slice(5, 7) === '10' && b.slice(5, 7) === '09') {
      var fa = fyOf(a), fb = fyOf(b);
      conv = fa === fb ? COPY.capConvFy1.replace('{a}', String(fa))
                       : COPY.capConvFy.replace('{a}', String(fa)).replace('{b}', String(fb));
    } else conv = COPY.capConvCal;
    return monthName(a) + ' to ' + monthName(b) + ' (' + conv + ')';
  }
  function rangeIsFy(a, b) { return a.slice(5, 7) === '10' && b.slice(5, 7) === '09'; }

  /* ONE selection clause, and the rule is: name it when the user picked exactly one, count it when they picked more. Naming five is unbounded width - the longest specific category in the July cube is 56 characters - and the caption sits ABOVE the figures, so every line it gains pushes the chart down. The cost is that the caption says how many and not which; the picker that set it is one click away. */
  function listClause(items, noun) {
    return items.length === 1 ? String(items[0])
      : COPY.capMany.replace('{n}', String(items.length)).replace('{noun}', noun);
  }

  /* THE CAPTION. One sentence, built in one place, from the chart state and nothing else, and not four times in four page scripts. Clause order is fixed on every dashboard, so a reader who learns it on one page keeps it on the next: what is counted (mode, breakdown), where (district), for whom (role), which parts(selection), how counted (occurrence basis). It reads NO data - only the user's own filter state and the loaded spine. */
  function captionFor(M) {
    var f = M.filters || {}, cl = [];
    if (f.mode) cl.push(f.mode);
    if (f.breakdown) cl.push(f.breakdown);
    var ds = f.districts || [];
    cl.push(ds.length ? listClause(ds, COPY.capNounDistricts) : COPY.capNational);
    if (f.role) cl.push(COPY.capRole.replace('{role}', f.role));
    if (f.selection && f.selection.items && f.selection.items.length)
      cl.push(listClause(f.selection.items, f.selection.noun));
    if (f.occ) cl.push(f.occ);
    var sp = M.spine || [], v = M.view || [];
    var range = v.length ? labelRange(sp[v[0]], sp[v[v.length - 1]]) : '';
    return COPY.captionTpl
      .replace('{metric}', M.metricLabel || '')
      .replace('{range}', range)
      .replace('{filters}', cl.length ? ', ' + cl.join(', ') : '');
  }

  /* ══ PERIODS. Every one is computed from the loaded spine; no window is a constant and no label carries a figure written into a string. ═══════── */
  function buildPeriods(M) {
    var sp = M.spine, edge = sp[sp.length - 1], out = [];
    function idxsFor(a, b) {
      var r = [];
      for (var i = 0; i < sp.length; i++) if (sp[i] >= a && sp[i] <= b) r.push(i);
      return r;
    }
    function push(k, label, a, b, conv) {
      if (a < sp[0] || b > edge) return;            /* never a partly covered preset */
      var ix = idxsFor(a, b); if (!ix.length) return;
      out.push({ k: k, label: label, idxs: ix, conv: conv });
    }
    /* the chart's own range is the default and is always first */
    if (M.view.length) {
      /* the chart's own period is labelled by labelRange(), the same function the caption uses, so the two can never disagree about the convention. */
      var ca = sp[M.view[0]], cb = sp[M.view[M.view.length - 1]];
      out.push({
        k: 'chart', idxs: M.view.slice(), conv: (ca && cb && rangeIsFy(ca, cb)) ? 'fy' : 'cal',
        label: labelRange(ca, cb)
      });
    }
    /* FY presets run to the last CLOSED fiscal year, computed from the vintage edge */
    var fyc = fyOf(edge); if (edge < fyEnd(fyc)) fyc -= 1;
    push('fy10', 'Last 10 fiscal years (FY' + (fyc - 9) + '-FY' + fyc + ')', fyStart(fyc - 9), fyEnd(fyc), 'fy');
    push('fy0615', 'The 10 fiscal years before that (FY' + (fyc - 19) + '-FY' + (fyc - 10) + ')', fyStart(fyc - 19), fyEnd(fyc - 10), 'fy');
    push('fyLast', 'Fiscal year ' + fyc + ' (FY' + fyc + ')', fyStart(fyc), fyEnd(fyc), 'fy');
    push('last120', 'Last 120 months (to ' + monthName(edge) + ')', addMonths(edge, -119), edge, 'cal');
    push('last12', 'Last 12 months (to ' + monthName(edge) + ')', addMonths(edge, -11), edge, 'cal');
    for (var e = 0; e < ADMINS.length; e++) {
      var ad = ADMINS[e], b = addMonths(ad.b, -1); if (b > edge) b = edge;
      if (ad.a > edge) continue;
      push('adm:' + e, 'Administration: ' + ad.name + ' (' + monthName(ad.a) + ' to ' + monthName(b) + ')', ad.a, b, 'cal');
    }
    push('all', 'All time (October 1994 to ' + monthName(edge) + ')', sp[0], edge, 'cal');
    return out;
  }
  function periodBy(P, k) {
    for (var i = 0; i < P.length; i++) if (P[i].k === k) return P[i];
    return P[0] || null;
  }
  /* the administration bands, as index runs on the spine. ADMINS in shared/config.js is the one place the administration bands are defined - change it there, not once per page - and this module reads it rather than restating it. */
  function eraRuns(M) {
    var sp = M.spine, edge = sp[sp.length - 1], out = [];
    for (var e = 0; e < ADMINS.length; e++) {
      var ad = ADMINS[e]; if (ad.a > edge) continue;
      var b = addMonths(ad.b, -1); if (b > edge) b = edge;
      var ix = []; for (var i = 0; i < sp.length; i++) if (sp[i] >= ad.a && sp[i] <= b) ix.push(i);
      if (ix.length) out.push({ i: e, name: ad.name, idxs: ix });
    }
    return out;
  }

  /* ══ COMPUTED QUANTITIES THAT REACH COPY. Every one is a pass over the loaded series, never a written constant. ══════════════════════════ */
  /* the jackknife a median on few values owes: how far leaving out one month moves it */
  function jackknife(vals) {
    var a = vals.filter(function (v) { return v != null; });
    var m0 = median(a); if (m0 == null || !m0) return null;
    var worst = 0;
    for (var i = 0; i < a.length; i++) {
      var b = a.slice(); b.splice(i, 1);
      var m = median(b); if (m == null) continue;
      worst = Math.max(worst, Math.abs(m - m0) / Math.abs(m0) * 100);
    }
    return worst;
  }
  /* seasonalAmp() STOOD HERE AND IS REMOVED. It averaged the settled months of each calendar month and took the peak-to-trough spread, which is a mean of ratios on a rate metric and so gives the wrong answer. Its only caller was the seasonal note in figureFor(), since struck; removing the call orphaned it and it goes with the call rather than sitting unreferenced with a known defect in it. R.seasonal and COPY.noteHalfSeasonal were a DIFFERENT thing, on form 2 only, and they are GONE TOO. They went for a different reason from this one: no averaged ratio and no computed figure at all, but a test of the period's LENGTH printing a claim about the SERIES. The claim was false on two shipped metrics whose peak-to-trough calendar swing is about 1% and about 4%. The 24-month bar in buildPair() survives and only its wording changed. */

  /* ══ RENDER HELPERS ═════════════════════════════════════════════════════════════ */
  function defLine(t) { return '<div class="tf-def">' + esc(t) + '</div>'; }
  /* An EMPTY string renders NOTHING. `.tf-flag` carries a 4px charcoal rule and a #fff9c4
     fill and the glyph is written by this function rather than by the copy, so a blanked
     flag string would otherwise paint a full-width yellow warning box containing a ⚠ and
     no warning - measured at 1030x28 on declinations.html when COPY.armD was blanked.
     This is the general fix rather than restoring that
     one string: the next blanked flag string would do the same thing. This changes no
     copy - no string is added, removed or reworded - and a flag with text is unaffected. */
  function flagLine(t) {
    if (!t) return '';
    return '<div class="tf-flag"><span aria-hidden="true">⚠</span> ' + esc(t) + '</div>';
  }


  /* ══ THE SECTION'S ONE PROVISIONAL MARK ═══════════════════════════════════════════
     A <button>, not a bare glyph, and that is about the mark reaching the reader rather than taste: a phone has  no hover, so a hover-only mark is hidden on touch, which is most of the traffic to a  dashboard embedded in a Framer page. It opens three ways - hover and keyboard focus in CSS, tap or click here - and the bubble is the button's aria-describedby target   and is NEVER `hidden` and never display:none, so a screen-reader user has the
     sentence without opening anything. The visible mark is the provisional HATCH, the  same texture LIONS_PROV draws on a right-censored chart band, plus the accessible  name: texture and text, never colour alone. It is 26x26, which clears WCAG 2.5.8's 24x24 target size and matches shell2's own caret. It is the SECOND child of the  caption row inside .kpis, so collapsing the section takes the mark with the figures  and shell2's caret - which sits on the LEFT of its own header, outside .kpis - is nowhere near it. ══════════════════════════════════════════════════════════════ */
  function provMarkHTML(month, n) {
    var body = COPY.provMarkBody.replace('{month}', month).replace('{n}', String(n));
    return '<span class="tf-provwrap">' +
      '<button type="button" class="tf-prov" id="tfprov" aria-expanded="false" ' +
        'aria-describedby="tfprovtip" aria-label="' + esc(COPY.provMarkName) + '">' +
        '<span class="sw sw-prov" aria-hidden="true"></span>' +
      '</button>' +
      '<span class="tf-tip" id="tfprovtip">' + esc(body) + '</span></span>';
  }
  var markDismissBound = false;
  function wireMark(cap) {
    var b = cap.querySelector('#tfprov'); if (!b) return;
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      b.setAttribute('aria-expanded', b.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
    });
    b.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') b.setAttribute('aria-expanded', 'false');
    });
    /* Escape and a click elsewhere close it, so a tapped bubble is not stuck open over the strip. The caption row is rebuilt on every paint, so the button is new each time and the document listener is bound once rather than once per paint. */
    if (markDismissBound) return;
    markDismissBound = true;
    document.addEventListener('click', function () {
      var cur = document.getElementById('tfprov');
      if (cur) cur.setAttribute('aria-expanded', 'false');
    });
  }

  /* ══ MEASURES ═══════════════════════════════════════════════════════════════════
     One record per measure: its menu label, and a function that turns a period into
     a value, a sub-line, a definition and the notes it owes. Every figure carries its value, label, period, definition, basis and flag. ═══════════ */
  function measureList(M) {
    var out = [];
    if (M.kind === 'stock') {
      out.push('read', 'avg', 'median', 'peak');
    } else if (M.kind === 'rate') {
      /* three and no more: Overall rate, Middle month, Share of the total. See COPY.mRate for why a rate carries no total, no average per month and no extremum. */
      out.push('rate', 'median');
    } else {
      out.push('total', 'avg', 'median', 'best', 'worst', 'firstlast');
    }
    if (M.share && M.kind !== 'stock') out.push('share');
    return out;
  }
  /* EIGHT of these labels carry a noun slot and follow Group by; THREE do not, and that is the point rather than an omission. `Total`, `Overall rate` and the share name no period, and `Reading at a date` is a date at every grain - what moves is WHICH date, and the figure prints it on its sub-line. */
  function measureLabel(M, k) {
    var gr = M && M.grain;
    switch (k) {
      case 'total': return 'Total';
      case 'rate': return COPY.mRate;
      case 'avg': return gfill(M.kind === 'stock' ? 'Average {bucketEnd} reading' : 'Average per {bucket}', gr);
      case 'median': return gfill(M.kind === 'stock' ? 'Middle {bucketEnd} reading' : 'Middle {bucket}', gr);
      case 'best': return gfill('Highest {bucket}', gr);
      case 'worst': return gfill('Lowest {bucket}', gr);
      case 'peak': return gfill('Highest {bucketEnd} reading', gr);
      case 'firstlast': return gfill('First and last {bucket}', gr);
      case 'read': return 'Reading at a date';
      case 'share': return M.share.label;
      /* the glance-only denominator slot on a rate: the series' own metric name, which the page already has, so the slot costs no new name. */
      case 'den': return (M.rate && M.rate.denLabel) || 'Total';
    }
    return k;
  }
  /* the settled subset of a period. Extrema and stock readings truncate; everything else flags. The newest months are incomplete: mark them, never hide them. */
  function settledOf(M, idxs) {
    return idxs.filter(function (i) { return i <= M.cut; });
  }
  function provCount(M, idxs) {
    var n = 0; for (var i = 0; i < idxs.length; i++) if (idxs[i] > M.cut) n++;
    return n;
  }

  /* the period line's SECOND line, coarse grain only, and only on a figure that reads EVERY bucket in the period: the average, the middle one and a stock's reading. It is the divisor, on the face, beside the figure that divides by it. It is NOT printed beside Total, Overall rate, Share or the rate's denominator slot, which are grain-invariant and divide by nothing; NOT on the two extrema, which are computed over a SUBSET and would contradict the exclusion note directly underneath; and NOT on first-and-last, which names its two buckets on its own face. Empty at month grain, which is what keeps the strip identical to the state the copy was signed for. */
  var READS_EVERY_BUCKET = { avg: 1, median: 1, read: 1 };
  function bucketCountLine(P, grain, k) {
    if (!grain || grain === 'month') return '';
    if (!READS_EVERY_BUCKET[k]) return '';
    var tpl = P.nPartial === 0 ? COPY.bucketCount
            : P.nPartial === 1 ? COPY.bucketCountPart1 : COPY.bucketCountPartN;
    return gfill(tpl, grain).replace('{n}', String(P.B.length)).replace('{p}', String(P.nPartial));
  }

  function figureFor(M, k, per) {
    var idxs = per.idxs, grain = M.grain;
    /* THE ONE RE-BUCKETING. P.vals are the bucket values, already computed the way each kind requires: a count sums, a rate is a ratio of its summed components, a stock reads its last month. At month grain every bucket is one month and P.vals is M.series over the period, so every figure below is arithmetically what it was before the grain slots landed. */
    var P = periodGrain(M, idxs, grain);
    var f = { key: k, label: measureLabel(M, k), period: per.label, notes: [],
              countLine: bucketCountLine(P, grain, k) };
    var i, best, bi, v;
    switch (k) {
      /* ── GRAIN-INVARIANT. Not one of these four reads P, and none of them may be made to: a sum of sums is the same sum, and a ratio of two whole-period sums has no bucket in it. Measured identical at all four grains on the default Criminal range: 770,057 and 94.9604%. ─────────────────────────────────────────────── */
      case 'total':
        f.v = fmtLevel(M, levelOver(M, idxs));
        break;
      case 'rate':
        f.v = fmtLevel(M, levelOver(M, idxs));
        f.def = COPY.defRate;
        break;
      /* ── RE-BUCKETED ──────────────────────────────────────────────────────────── */
      case 'avg':
        if (M.kind === 'stock') {
          /* the mean of the BUCKET-END readings, not of the months inside them */
          var s = 0, c = 0;
          for (i = 0; i < P.vals.length; i++) if (P.vals[i] != null) { s += P.vals[i]; c++; }
          f.v = c ? nInt(s / c) : '-';
          f.def = gfill(COPY.defStockAvg, grain).replace('{n}', String(P.B.length));
        } else {
          /* the period total divided by the NUMBER OF BUCKETS, which is the mean of the bucket values and so the mean of what the chart plots. A part period is one bucket and counts as one; the divisor is on the face in f.countLine */
          var t = levelOver(M, idxs);
          f.v = t == null ? '-' : n1(t / P.B.length);
        }
        break;
      case 'median':
        var md = median(P.vals);
        f.v = M.kind === 'stock' ? nInt(md) : fmtRate(M, md);
        /* THE FEW-VALUES THRESHOLD IS NOW A COUNT OF BUCKETS, not of months. The caveat exists because a median over few values moves on any one of them, and the values medianed here are the buckets. At month grain the two readings coincide, which is why 12 is unchanged. It is the one number here that is inherited rather than measured. */
        f.def = M.kind === 'stock' ? gfill(COPY.defStockMedian, grain).replace('{n}', String(P.B.length))
              : M.kind === 'rate' ? gfill(COPY.defMedianRate, grain).replace('{n}', String(P.B.length))
              : (P.B.length <= 12
                  ? gfill(COPY.defMedianFew, grain).replace('{n}', String(P.B.length)).replace('{jack}', n2(jackknife(P.vals) || 0))
                  : gfill(COPY.defMedian, grain).replace('{n}', String(P.B.length)));
        /* the ratio-of-sums rule said out loud on the one figure a coarse grain makes newly misreadable. Silent at month grain, where there is nothing new to misread. */
        if (M.kind === 'rate' && grain && grain !== 'month') f.def2 = gfill(COPY.defBucketRate, grain);
        break;
      case 'best': case 'worst': case 'peak':
        best = null; bi = null;
        /* WHOLE AND SETTLED. P.eligible is the settled buckets that are not part periods; at month grain nothing is ever a part period, so this is settledOf() exactly. */
        for (i = 0; i < P.eligible.length; i++) {
          v = P.vals[P.eligible[i]]; if (v == null) continue;
          if (best == null || (k === 'worst' ? v < best : v > best)) { best = v; bi = P.eligible[i]; }
        }
        f.v = nInt(best);              /* never a rate: a rate offers no extremum */
        f.sub = bi == null ? '' : P.labels[bi];
        /* the DEFINITION is struck (the label says what it is) and the settled-months half of it is not lost with it: it is COPY.noteSettledOnly, its own line, and it still prints on all three. The extremum is the one place this section
           truncates, and it says so exactly as before. */
        f.notes.push(gfill(COPY.noteSettledOnly, grain));
        /* the second truncation, printed only where a part period was actually there to drop. It is never there at month grain. */
        if (P.nPartial > 0) f.notes.push(gfill(COPY.notePartExcluded, grain));
        if (k !== 'peak') f.notes.push(gfill(COPY.noteBestCause, grain));
        /* on a stock, say when the UNTRUNCATED peak would have been the vintage edge */
        if (k === 'peak') {
          var top = null, ti = null;
          for (i = 0; i < P.vals.length; i++) {
            v = P.vals[i]; if (v == null) continue;
            if (top == null || v > top) { top = v; ti = i; }
          }
          if (ti != null && P.prov[ti]) f.notes.push(gfill(COPY.noteStockPeakEdge, grain).replace('{edge}', P.labels[ti]));
        }
        /* a coarse grain can leave NOTHING both whole and settled - Last 12 months at fiscal-year grain is two part periods, one of them provisional. The section already owns a sentence for "there is no figure here" and it is reused, with the two notes above saying which exclusion emptied the set. No new refusal string is spent. */
        if (bi == null) { f.unavailable = true; f.def = COPY.unavailable; }
        break;
      case 'firstlast':
        f.v = nInt(P.vals[0]) + ' and ' + nInt(P.vals[P.vals.length - 1]);   /* never a rate: see measureList */
        f.sub = P.labels[0] + ' and ' + P.labels[P.labels.length - 1];
        if (P.B[0].partial || P.B[P.B.length - 1].partial) f.notes.push(COPY.partKey);
        break;
      case 'read':
        /* THE LAST SETTLED MONTH IN THE CHART'S RANGE, with its date on its face. An earlier design read the NEWEST month and flagged it; every provisional string in the section was then struck, so the flag that design rested on no longer exists, and the one stated truncation exception applies - the civil pending stock rises 67.7% in ten months into the vintage edge and peaks there at 148,696 against a settled high of 110,090 in 2015-01. The date names which month it is, which is that rule's own instruction. Inside a COMPARISON the truncation is unchanged. AT A COARSE GRAIN this is the last settled BUCKET, read at the month it ends on, and the label stays `Reading at a date` because a date is a date at every grain - what moves is which date, and it is on the face. A part period is not excluded: its end is a real month-end level and the sub-line names the bucket so the reader can see it is short. */
        var ri = lastSettledBucket(P);
        f.v = nInt(P.vals[ri]);
        f.sub = monthName(P.endMonth[ri]) + (P.B[ri].partial ? ' (' + P.labels[ri] + ')' : '');
        if (P.B[ri].partial) f.notes.push(COPY.partKey);
        break;
      case 'share':
        f.v = n2(shareOver(M, idxs)) + '%';
        f.def = COPY.defShare;
        if (M.share.basis) f.basis = M.share.basis;
        break;
      case 'den':
        /* a rate alone answers "how well" and never "how big", so the glance's second slot on a percent metric is the total the rate divides by. */
        f.v = nInt(sumOf(M.rate.den, idxs));
        f.basis = COPY.basisRateDen;
        break;
    }
    /* at district level the average and the middle month are genuinely far apart.BOTH SIDES MOVE TOGETHER OR THE GAP IS NONSENSE: a monthly mean against a quarterly median prints a gap near 200% and reads as a data finding. Both are bucket quantities here, and at month grain both are what they were. */
    if (M.districtSel && (k === 'avg' || k === 'median') && M.kind === 'count') {
      var tot = levelOver(M, idxs), mm = median(P.vals);
      if (tot != null && mm) {
        f.notes.push(gfill(COPY.noteMeanMedian, grain).replace('{gap}', n1(Math.abs(tot / P.B.length - mm) / Math.abs(mm) * 100)));
      }
    }
    /* NO PER-FIGURE PROVISIONAL LINE. The obligation to mark the incomplete newest months is discharged by the ONE section mark, which paintChrome() puts at the top right of the box and which is reachable on hover, on focus, on tap and from the accessibility tree without opening anything. */
    return f;
  }

  /* ══ THE GLANCE STRIP - three statistics plus the section footer line ═══════════
     the measured recommended sets: the level, the rate, and the selection's share of the total row. When the selection IS the whole total the share would read 100% and say nothing, so that slot becomes the middle month and says why. */
  function glanceKeys(M) {
    if (M.kind === 'stock') return ['read', 'avg', 'median'];
    if (M.kind === 'rate') {
      /* the rate, the total it divides BY, and the share. A rate has no honest "average per month": that is a mean of ratios, and the right answer sums the components and divides once. */
      return ['rate', 'den', (M.share && !M.allSelected) ? 'share' : 'median'];
    }
    return ['total', 'avg', (M.share && !M.allSelected) ? 'share' : 'median'];
  }
  function renderGlance(host, M, per) {
    var keys = glanceKeys(M), h = '';
    for (var i = 0; i < keys.length; i++) {
      var f = figureFor(M, keys[i], per);
      h += '<div class="tf-stat">';
      if (M.loading || M.empty) {
        h += '<div class="tf-v muted-v">-</div><div class="tf-k">' + esc(f.label) + '</div>' +
             '<div class="tf-win">' + esc(per.label) + '</div>' +
             defLine(M.loading ? COPY.loading : COPY.zero);
      } else {
        h += '<div class="tf-v">' + esc(f.v) + '</div>';
        if (f.sub) h += '<div class="tf-sub">' + esc(f.sub) + '</div>';
        h += '<div class="tf-k">' + esc(f.label) + '</div>';
        h += '<div class="tf-win">' + esc(per.label) + '</div>';
        /* THE ONE GRAIN ADDITION TO THE STRIP: the divisor, and how many of its buckets are part periods. Empty at month grain, so the strip is byte-identical there. */
        if (f.countLine) h += '<div class="tf-win">' + esc(f.countLine) + '</div>';
        /* NO DEFINITION ON THE STRIP, at any width, in any context. The BASIS stays: the total rule and the ratio-of-sums rule live in it, and without `The total this rate divides by.` the rate strip reads as two unrelated figures side by side. */
        if (f.basis) h += defLine(f.basis);
        if (keys[i] === 'median' && M.share && M.allSelected && M.kind !== 'stock') h += defLine(COPY.noteShareWhole);
        /* THE GLANCE CARRIES SECTION 3'S SIX ELEMENTS AND NOT THE QUALIFYING NOTES. Value, label, period, definition, basis and flag are owed on every figure in every shape; the qualifying notes in section 9 - the seasonal balance of the period, the district mean-to-median gap, the no-cause sentence - answer "what else should I know about THIS figure" and belong on the look-up, where the user asked for that figure. Rendered here they are identical on all three columns and add 72px at 1200 and 232px at 390, measured in Chromium. */
        if (M.flags && M.flags.armD && (keys[i] === 'total' || keys[i] === 'avg')) h += flagLine(COPY.armD);
      }
      h += '</div>';
    }
    host.innerHTML = h;
  }

  /* ══ THE LOOK-UP ANSWER ═════════════════════════════════════════════════════════ */
  function renderLookup(host, M, per, measure) {
    var f = figureFor(M, measure, per);
    var h = '<div class="tf-answer">';
    h += '<div class="tf-q">' + esc(f.label + ', ' + M.metricLabel.toLowerCase() + ', ' + per.label) + '</div>';
    if (M.loading) {
      h += '<div class="tf-v big muted-v">-</div>' + defLine(COPY.loading) + '</div>';
      host.innerHTML = h; return;
    }
    if (M.empty) {
      h += '<div class="tf-v big muted-v">-</div>' + defLine(COPY.zero) + '</div>';
      host.innerHTML = h; return;
    }
    h += '<div class="tf-v big">' + esc(f.v) + '</div>';
    if (f.sub) h += '<div class="tf-sub">' + esc(f.sub) + '</div>';
    if (f.countLine) h += '<div class="tf-win">' + esc(f.countLine) + '</div>';
    /* THE ONLY PLACE A DEFINITION APPEARS, and only on the five figures whose label is not already their definition: Middle month, Overall rate, Share of the total, and the average and middle month-end readings. figureFor() sets f.def on those five and on nothing else, so this is the whole of the rule. */
    if (f.def) h += defLine(f.def);
    /* the ratio-of-sums rule, on `Middle {bucket}` on a percent metric at a coarse grain only */
    if (f.def2) h += defLine(f.def2);
    if (f.basis) h += defLine(f.basis);
    for (var j = 0; j < f.notes.length; j++) h += defLine(f.notes[j]);
    if (M.kind === 'stock') h += defLine(COPY.noteStockSelected);
    if (M.flags && M.flags.armD) h += flagLine(COPY.armD);

    /* produces other topline calculations */
    var keys = measureList(M).filter(function (k) { return k !== measure; }), list = '';
    for (var i = 0; i < keys.length; i++) {
      var o = figureFor(M, keys[i], per);
      list += '<div class="tf-other"><span class="ok">' + esc(o.label) + '</span><b><span class="tf-val">' + esc(o.v) + '</span>' +
        (o.sub ? ' <span class="os">' + esc(o.sub) + '</span>' : '') + '</b></div>';
    }
    if (list) h += '<div class="tf-also"><div class="tf-alsohd">' + esc(COPY.alsoHead) + '</div>' + list + '</div>';
    host.innerHTML = h + '</div>';
  }

  /* ══ THE COMPARISON ═════════════════════════════════════════════════════════════ Every form names itself on the page and carries its basis on its face. THE FIGURE DRIVES THE COMPARISON: every look-up figure applies to both periods, the FORM decides which two sets of months, and the two lengths decide ONE thing only - whether `Total` may be differenced. Equal length compares totals; unequal length compares per month and never differences the two totals, and that rule is now `Total`'s alone. ══════════════════════════════════════════════════════════════════════════ */
  /* WHAT EACH SIDE READS IS THE FIGURE'S JOB. The `measure` argument used to be read for the share and then never again, so the form decided every other figure and the figure select was inert in compare mode. `mode` survives for `Total` and for nothing else, which is where the length rule lives. `pts` says the figure is a percentage and is compared in percentage POINTS, never as a percent change of a percent; a missing `v` says there is no single change to print at all, which is `First and last month`. */
  /* EACH SIDE RE-BUCKETS OVER ITS OWN MONTHS. The FORMS still choose MONTHS - not a line of buildPair()'s month arithmetic moves, all three refusals stay month tests, and `Total`'s five settled basis sentences and every period clause still count months and stay true. What follows the grain is each side's own figure VALUE, because the figure label is shared between the look-up and the comparison and a monthly number under a quarterly label is a wrong figure rather than an inconsistency. */
  function sideValue(M, idxs, mode, measure) {
    var i, s, c, t, P;
    if (measure === 'share') return { v: shareOver(M, idxs), fmt: n2(shareOver(M, idxs)) + '%', pts: true };
    P = periodGrain(M, idxs, M.grain);
    if (measure === 'best' || measure === 'worst' || measure === 'peak') {
      /* over WHOLE AND SETTLED buckets, on a flow as well as a stock: an extremum would otherwise be won by a bucket whose reporting is not yet complete, or by one that is short. At month grain nothing is ever a part period, so this is the settled-months rule exactly as before. */
      var best = null, bi = null;
      for (i = 0; i < P.eligible.length; i++) {
        var ev = P.vals[P.eligible[i]]; if (ev == null) continue;
        if (best == null || (measure === 'worst' ? ev < best : ev > best)) { best = ev; bi = P.eligible[i]; }
      }
      return { v: best, fmt: nInt(best), sub: bi == null ? '' : P.labels[bi] };
    }
    if (measure === 'firstlast') {
      return { v: null, fmt: nInt(P.vals[0]) + ' and ' + nInt(P.vals[P.vals.length - 1]),
               sub: P.labels[0] + ' and ' + P.labels[P.labels.length - 1] };
    }
    if (measure === 'median') {
      var md = median(P.vals);
      return { v: md, fmt: M.kind === 'stock' ? nInt(md) : fmtRate(M, md), pts: M.kind === 'rate' };
    }
    if (M.kind === 'stock') {
      /* both sides are already truncated to settled months by buildPair(), on every form and every figure, and each side's LABEL names the months actually read, which is the standing "say which date it is" rule. */
      if (measure === 'avg' || mode === 'avg') {
        s = 0; c = 0;
        for (i = 0; i < P.vals.length; i++) if (P.vals[i] != null) { s += P.vals[i]; c++; }
        return { v: c ? s / c : null, fmt: c ? nInt(s / c) : '-' };
      }
      var ri = P.vals.length - 1;
      return { v: P.vals[ri], fmt: nInt(P.vals[ri]), sub: monthName(P.endMonth[ri]) };
    }
    t = levelOver(M, idxs);
    if (measure === 'rate') return { v: t, fmt: fmtLevel(M, t), pts: true };
    /* `Average per {bucket}` prints the bare per-bucket figure and carries no `in total` sub-line: that sub-line is `Total`'s, and on the two forms that read per month by rule it is the only arithmetic difference between the two figures (spec 5.2f n.1). */
    if (measure === 'avg') return { v: t == null ? null : t / P.B.length, fmt: t == null ? '-' : n1(t / P.B.length) };
    /* `Total`'s own per-month reading on the unequal-length forms stays PER MONTH, because the length rule and the settled sentences that state it count months. This is the one divisor in the section that does not follow the grain. */
    if (mode === 'perMonth') return { v: t == null ? null : t / idxs.length, fmt: (t == null ? '-' : n1(t / idxs.length) + ' per month'), total: nInt(t) };
    return { v: t, fmt: fmtLevel(M, t) };
  }

  /* THE FIGURE MENU IN COMPARE MODE. It is the look-up menu with ONE subtraction, on one kind, on four of the five forms: a stock's `Reading at a date` is offered on form 1 only. Form 1 on a stock IS a date against a date; forms 2 to 5 compare two SPANS, and a span on a stock is read as its average month-end level. Leaving the entry on those forms would offer a second reading of the same pair that disagrees in SIGN with the settled one, measured at -17.46% against +11.43% on one real window. It is not offered rather than refused, so no string is spent, and a user who was on it when they change the form is moved to `Average month-end reading` visibly, in the select they are looking at. Nothing else is subtracted: a developer may not add a figure to this menu that the look-up menu does not offer. */
  function measuresForCompare(M, form) {
    var keys = measureList(M);
    if (M.kind === 'stock' && form !== 'prev') keys = keys.filter(function (k) { return k !== 'read'; });
    return keys;
  }

  /* ── THE BASIS, COMPOSED: a figure clause and then a period clause (spec 5.2e, 9g). `Total` returns its whole signed sentence untouched, so it renders character for character as before on all five forms. Every other figure takes its own clause and then the form's period clause, which is the second half of that same sentence. A stock's clauses are whole sentences and take no period clause, because each side's label already names the months read. ─────────────────────────────────────────── */
  function figureClause(M, measure, form) {
    if (measure === 'share') {
      /* THE ONE AMENDED STRING (9g): `Each administration's` -> `Each period's` and `the unequal lengths` -> `the periods' lengths`, because this sentence was form 4's and now prints on every form. It is built rather than stored because it carries the page's own selection name and occurrence basis. */
      return 'Each period\'s ' + ((M.share && M.share.selName) || 'selection') + ' share of its own total row' +
        (M.share && M.share.occ ? ', ' + M.share.occ + ' basis' : '') +
        '. A share is a ratio within each period, so the periods\' lengths do not distort it.';
    }
    if (M.kind === 'stock') {
      switch (measure) {
        case 'read': return COPY.basisFigStockRead;
        case 'avg': return form === 'halves' ? COPY.basisFigStockHalves : COPY.basisStockPeriod;
        case 'median': return COPY.basisFigStockMedian;
        case 'peak': return COPY.basisFigStockPeak;
      }
      return null;
    }
    switch (measure) {
      case 'avg': return COPY.basisFigAvg;
      case 'median': return M.kind === 'rate' ? COPY.basisFigMedianRate : COPY.basisFigMedian;
      case 'best': return COPY.basisFigBest;
      case 'worst': return COPY.basisFigWorst;
      case 'firstlast': return COPY.basisFigFirstLast;
      case 'rate': return COPY.basisFigRate;
    }
    return null;
  }
  function composeBasis(M, R, measure) {
    /* `Total` keeps its WHOLE settled sentence, character for character, on all five forms: it counts months and the forms still choose months. Every other figure's clause takes the noun slot and then the form's own period clause, which is untouched and still counts months. */
    if (measure === 'total') return R.totalBasis;
    var c = figureClause(M, measure, R.form);
    if (!c) return R.totalBasis;
    c = gfill(c, M.grain);
    return R.periods ? c + ' ' + R.periods : c;
  }
  function rangeLabel(M, idxs) {
    return monthName(M.spine[idxs[0]]) + ' to ' + monthName(M.spine[idxs[idxs.length - 1]]);
  }

  /* WHICH OF THE TWO PERIODS IS THE LATER ONE IS COMPUTED FROM THE MONTHS, never assumed. Forms 3 and 4 used to hard-code the chart side as the later one, which was true while their first period was always the current administration and which an arbitrary chart range makes false: set the range to Trump I, pick Trump II, and the administration is the later period. The pair is shown later-side-first so that the two provisional strings, which open "The first period" and "The second period", name the slots they are actually on. */
  function orderPair(M, R, s1, s2) {
    var aIsLater = M.spine[s1.ix[s1.ix.length - 1]] >= M.spine[s2.ix[s2.ix.length - 1]];
    R.a = aIsLater ? s1 : s2;
    R.b = aIsLater ? s2 : s1;
    R.laterIsA = true;
    R.ix = [R.a.ix, R.b.ix];
  }
  /* THE PAIR FLAG AND ITS DIRECTION ARE STRUCK. pairProv() chose between the two direction strings and both are gone, so it is removed rather than left with no caller. This is the costliest of the three subtractions and it was taken knowingly: the direction of the bias on a pair is a real question and the section no longer prints it. orderPair() below is NOT removed - its other job, the display ORDER, survives. */
  /* the administration band whose months ARE these months, if there is one. Two uses: it is the one band excluded from forms 3 and 4's menu, because comparing a period with itself says nothing; and it names the chart's side of the pair when the two coincide, which is how those forms collapse to their original wording. */
  function eraMatching(M, idxs) {
    var runs = eraRuns(M), r;
    for (var i = 0; i < runs.length; i++) {
      r = runs[i].idxs;
      if (r.length === idxs.length && r[0] === idxs[0] && r[r.length - 1] === idxs[idxs.length - 1]) return runs[i];
    }
    return null;
  }
  /* the administrations a comparison may be made against: every band except that one. */
  function eraChoices(M, idxs) {
    var self = eraMatching(M, idxs);
    return eraRuns(M).filter(function (r) { return !self || r.i !== self.i; });
  }

  /* Build the comparison. Returns either { refusal } or a full record.
     buildPair() decides the two sets of MONTHS and builds `Total`'s signed sentence(`totalBasis`) and the form's own period clause (`periods`); buildCompare() then composes the basis for the figure the user picked. The split is the rule: the form chooses the months, the figure chooses what each side reads (spec 5.2e). */
  function buildCompare(M, per, o) {
    var R = buildPair(M, per, o);
    if (R && !R.refusal && !R.unavailable) R.basis = composeBasis(M, R, o.measure);
    return R;
  }
  function buildPair(M, per, o) {
    var sp = M.spine, F = o.form, measure = o.measure, R = { form: F };
    var idxs = per.idxs, L = idxs.length, p0 = idxs[0], p1 = idxs[idxs.length - 1];
    var runs, era, k;

    if (F === 'prev') {
      /* REFUSED, not truncated, where the earlier period would begin before the data does, including the partly covered case (spec 5.2a). A shorter or renormalised earlier period answers a question the user did not ask. */
      /* THERE IS NO SETTLED-MONTHS ALTERNATIVE. A comparison reaching into provisional months computes over all months, which is what this branch always did by default. */
      var A = idxs.slice();
      if (!A.length || A[0] < 0) return { refusal: COPY.refuseNoEarlier };
      var B = []; for (k = A[0] - A.length; k < A[0]; k++) B.push(k);
      if (B[0] < 0) return { refusal: COPY.refuseNoEarlier };
      if (M.kind === 'stock') {
        var As = settledOf(M, A);
        if (!As.length) return { unavailable: true };
        var Bs = []; for (k = As[0] - As.length; k < As[0]; k++) Bs.push(k);
        if (Bs[0] < 0) return { refusal: COPY.refuseNoEarlier };
        A = As; B = Bs;
        /* THE SIDE LABEL IS THE SPAN AND THE DATE IS THE FIGURE'S SUB-LINE. It used to be the date, which was true while form 1 on a stock could only be read as two readings; the three span figures now apply here too and each side's label has to name the months actually read. `Reading at a date` puts its own date on its face, in the sub-line, exactly as an extremum does. */
        R.a = { label: rangeLabel(M, A), val: sideValue(M, A, 'read', measure) };
        R.b = { label: rangeLabel(M, B), val: sideValue(M, B, 'read', measure) };
        R.totalBasis = COPY.basisFigStockRead;
        /* narrowed to the figure it describes, the same way spec 5.2g narrows form 2's stock note: its second sentence is about the reading, not about the form. */
        if (measure === 'read') R.note = COPY.noteStockNoPrior;
      } else {
        R.a = { label: rangeLabel(M, A), val: sideValue(M, A, 'total', measure) };
        R.b = { label: rangeLabel(M, B), val: sideValue(M, B, 'total', measure) };
        R.periods = provCount(M, A) ? 'Both periods are ' + A.length + ' months.'
                                    : 'Both periods are ' + A.length + ' months and both are settled.';
        R.totalBasis = 'Totals. ' + R.periods;
      }
      R.laterIsA = true;
      R.ix = [A, B];
      return R;
    }

    if (F === 'halves') {
      /* on a stock the provisional treatment is a TRUNCATION, not a flag - the one stated exception to marking rather than cutting - so the halves are cut at the settled edge and the card prints that date in its ranges. */
      var H = M.kind === 'stock' ? settledOf(M, idxs) : idxs.slice();
      if (H.length < 24) return { refusal: COPY.refuseShortHalves };
      var cut = H.length >> 1;                       /* the extra month goes to the LATER half */
      var h1 = H.slice(0, cut), h2 = H.slice(cut);
      var mode = M.kind === 'stock' ? 'avg' : 'perMonth';
      R.a = { label: rangeLabel(M, h1) + ', ' + h1.length + ' months', val: sideValue(M, h1, mode, measure) };
      R.b = { label: rangeLabel(M, h2) + ', ' + h2.length + ' months', val: sideValue(M, h2, mode, measure) };
      R.laterIsA = false;
      R.ix = [h1, h2];
      if (M.kind === 'stock') {
        R.totalBasis = COPY.basisFigStockHalves;
        /* NARROWED TO THE FIGURE IT DESCRIBES. Its trigger was "form 2  on a stock", when a stock half had one reading; a stock half has three now and the sentence is true of one of them. One word does: `month-end` is now `{bucketEnd}`. */
        if (measure === 'avg') R.note = COPY.noteStockHalves;
      } else {
        R.periods = 'The period is ' + H.length + ' months, split at the midpoint into ' +
          h1.length + ' and ' + h2.length +
          '; on an odd number of months the extra month goes to the later half.';
        R.totalBasis = 'Per month, each half. ' + R.periods +
          ' The two half totals are shown with their month counts and are not differenced.';
      }
      return R;
    }

    if (F === 'eraLike' || F === 'eraWhole') {
      /* The first period of both forms is THE CHART'S RANGE, as it is on the other three. Form 3 takes the FIRST N months of the chosen administration, N being the chart range's own length; form 4 takes the whole of it, per month. */
      runs = eraRuns(M);
      era = null;
      for (k = 0; k < runs.length; k++) if (String(runs[k].i) === String(o.detail)) era = runs[k];
      if (!era) return { unavailable: true };
      var aIdx = idxs.slice();
      if (M.kind === 'stock') aIdx = settledOf(M, aIdx);
      if (!aIdx.length) return { unavailable: true };
      var bIdx;
      if (F === 'eraLike') {
        /* REFUSED, NEVER CAPPED. Capping at the administration's own length answers form 4's question  under a label that says "the same months", and form 4 is one line down the same menu. The test is on the chart range's own length, which is the number the refusal prints. */
        if (era.idxs.length < L) {
          return { refusal: COPY.refuseEraShort
            .replace('{name}', era.name)
            .replace('{m}', String(era.idxs.length))
            .replace(/\{n\}/g, String(L)) };
        }
        bIdx = era.idxs.slice(0, aIdx.length);
      } else {
        bIdx = era.idxs.slice();
      }
      if (M.kind === 'stock') { bIdx = settledOf(M, bIdx); if (!bIdx.length) return { unavailable: true }; }
      var m2 = M.kind === 'stock' ? 'avg' : 'perMonth';
      var aEra = eraMatching(M, idxs);
      var aName = aEra ? aEra.name : rangeLabel(M, aIdx);
      var aSide = { label: aName + ', ' + aIdx.length + ' months', val: sideValue(M, aIdx, m2, measure), ix: aIdx };
      var bSide = { label: era.name + (F === 'eraLike' ? ', first ' : ', ') + bIdx.length + ' months',
                    val: sideValue(M, bIdx, m2, measure), ix: bIdx };
      orderPair(M, R, aSide, bSide);
      /* THE SHARE BRANCH IS GONE FROM HERE AND THAT IS THE STRUCTURAL HALF OF THE FIX.  The share sentence was reachable only inside this era branch, so a share compared on forms 1, 2 and 5 printed `Total`'s basis instead. It is a figure clause now, in figureClause(), and so it prints on every form. */
      if (M.kind === 'stock') {
        R.totalBasis = COPY.basisStockPeriod;
      } else if (F === 'eraLike') {
        /* the period clause is this sentence's second half, and the ONE difference is one letter: the signed sentence reads `Per month, the chart's range ...`, so lifting the tail out capitalises the `t` (spec 9g). Written from one fragment so the two cannot drift apart. */
        var p3 = 'he chart\'s range is ' + aIdx.length + ' months, against the first ' +
          bIdx.length + ' months of ' + era.name + '. Taking the same number of months from each is the like-for-like comparison.';
        R.periods = 'T' + p3;
        R.totalBasis = 'Per month, t' + p3;
      } else {
        R.periods = 'The chart\'s range is ' + aIdx.length + ' months and ' + era.name + ' is ' +
          bIdx.length + ' months.';
        /* the `not differenced` clause is true of `Total` and of no other figure, because no other figure shows a total at all, so it does not travel (spec 9g). */
        R.totalBasis = 'Per month, all months in each period. The chart\'s range is ' + aIdx.length + ' months and ' +
          era.name + ' is ' + bIdx.length + ' months, so the totals, ' + nInt(levelOver(M, aIdx)) + ' and ' +
          nInt(levelOver(M, bIdx)) + ', are not differenced.';
      }
      return R;
    }

    /* form 5: any second period the user picks, from the menu the section's own period select used to carry minus the chart's own range - the chart's range is the FIRST period of every comparison now and cannot also be the second. Totals when the two are equal length, per month with the basis named when they are not. */
    var other = periodBy(M.periods, o.detail);
    if (!other || other.k === 'chart') return { unavailable: true };
    var X = idxs.slice(), Y = other.idxs.slice();
    if (M.kind === 'stock') { X = settledOf(M, X); Y = settledOf(M, Y); }
    if (!X.length || !Y.length) return { unavailable: true };
    var eq = X.length === Y.length;
    var m3 = M.kind === 'stock' ? 'avg' : (eq ? 'total' : 'perMonth');
    var xSide = { label: per.label, val: sideValue(M, X, m3, measure), ix: X };
    var ySide = { label: other.label, val: sideValue(M, Y, m3, measure), ix: Y };
    orderPair(M, R, xSide, ySide);
    if (M.kind === 'stock') {
      R.totalBasis = COPY.basisStockPeriod;
    } else if (eq) {
      R.periods = provCount(M, X) || provCount(M, Y) ? 'Both periods are ' + X.length + ' months.'
        : 'Both periods are ' + X.length + ' months and both are settled.';
      R.totalBasis = 'Totals. ' + R.periods;
    } else {
      var p5 = 'They are ' + X.length + ' and ' + Y.length + ' months long';
      R.periods = p5 + '.';
      R.totalBasis = 'Per month, because the two periods are different lengths. ' + p5 +
        ', so the totals, ' + nInt(levelOver(M, X)) + ' and ' + nInt(levelOver(M, Y)) +
        ', are not differenced.';
    }
    return R;
  }

  function formLabel(k) {
    for (var i = 0; i < FORMS.length; i++) if (FORMS[i].k === k) return FORMS[i].label;
    return k;
  }

  function renderCompare(host, M, per, o) {
    var R = buildCompare(M, per, o);
    var h = '<div class="tf-answer">';
    if (R.refusal || R.unavailable || M.loading || M.empty) {
      h += '<div class="tf-q">' + esc(M.metricLabel + ': ' + formLabel(o.form) + ', ' + per.label) + '</div>';
      if (M.loading) h += '<div class="tf-v big muted-v">-</div>' + defLine(COPY.loading);
      else if (M.empty) h += '<div class="tf-v big muted-v">-</div>' + defLine(COPY.zero);
      else if (R.refusal) h += '<div class="tf-refusal">' + esc(R.refusal) + '</div>';
      else h += '<div class="tf-v big muted-v">-</div>' + defLine(COPY.unavailable);
      host.innerHTML = h + '</div>';
      return R;
    }
    /* the change is always the later side against the earlier one */
    var later = R.laterIsA ? R.a : R.b, earlier = R.laterIsA ? R.b : R.a;
    var pct = null, pts = null;
    /* A PERCENTAGE IS COMPARED IN PERCENTAGE POINTS ON EVERY FORM, never as a percent change of a percent (spec 5.2f note 3): the share, the overall rate and a middle month of monthly percentages. The figure says which it is - sideValue() sets `pts`- so this is one rule and not three special cases. */
    if (later.val.pts) {
      if (later.val.v != null && earlier.val.v != null) pts = later.val.v - earlier.val.v;
    } else if (later.val.v != null && earlier.val.v != null && earlier.val.v !== 0) {
      pct = 100 * (later.val.v - earlier.val.v) / Math.abs(earlier.val.v);
    }
    h += '<div class="tf-q">' + esc(M.metricLabel + ': ' + R.a.label + ' against ' + R.b.label) + '</div>';
    /* EACH SIDE CARRIES THE FIGURE'S OWN LABEL. Two periods and two numbers do not say what was measured, and on the two forms that read per month by rule - halves and the same months of another administration - `Total` and `Averageper month` are the same two numbers, so the label is the only thing on the face that answers "which figure is this". It goes on BOTH sides rather than once in the heading */
    var figLabel = measureLabel(M, o.measure);
    function side(x) {
      return '<div class="tf-side"><div class="tf-k">' + esc(x.label) + '</div><div class="tf-v">' +
        esc(x.val.fmt) + '</div>' +
        (x.val.total ? '<div class="tf-sub">' + esc(x.val.total) + ' in total</div>' : '') +
        (x.val.sub ? '<div class="tf-sub">' + esc(x.val.sub) + '</div>' : '') +
        '<div class="tf-fig">' + esc(figLabel) + '</div></div>';
    }
    /* NO CHANGE CELL AT ALL ON `First and last month`. There is no single change between two pairs of endpoints. The cell is ABSENT rather than blank or dashed - a blank cell invites a reading - and auto-fit collapses the empty track, so the grid re-columns with no media query. The basis line says why there is none. */
    var noChange = o.measure === 'firstlast';
    h += '<div class="tf-pair">' + side(R.a) + side(R.b) +
      (noChange ? '' :
       '<div class="tf-side tf-delta"><div class="tf-k">Change</div><div class="tf-v big">' +
       esc(pts != null ? signed(pts, ' pts') : (pct != null ? signed(pct, '%') : '-')) +
       '</div></div>') + '</div>';
    h += '<div class="tf-basis"><b>' + esc(COPY.basisLabel) + ':</b> ' + esc(R.basis) + '</div>';
    /* gfill'd at the render rather than at either assignment, so one point covers both of them: noteStockNoPrior carries no slot and is unaffected, noteStockHalves carries {bucketEnd}. */
    if (R.note) h += defLine(gfill(R.note, M.grain));
    /* THE EXTREMUM KEEPS ITS NO-CAUSE NOTE ON A COMPARISON AND EARNS IT: the lowest month of any period containing 2020 is 2020-04 or 2020-05 on four of  seven series, so the pairing invites a cause more strongly than a look-up does. The settled-months truncation is disclosed in the basis clause itself and is not printed  twice. `peak` is excluded here for the same reason figureFor() excludes it. */
    if (o.measure === 'best' || o.measure === 'worst') h += defLine(gfill(COPY.noteBestCause, M.grain));
    /* NO PAIR FLAG AND NO DIRECTION LINE. THERE IS NO SEASONAL FLAG ON THIS FORM EITHER, and its absence is deliberate: the only thing testable here without reading the series is whether the period divides evenly into 24 months, which is a property of the period's LENGTH, and a length cannot support a claim about the SERIES. Measured peak-to-trough swing across the series this form serves runs from about 1% to over 100%, so one fixed sentence was true of one of them and false of two. The 24-month bar in buildPair() is a DIFFERENT thing and is sound: it withholds a comparison whose two halves cannot each cover a full year. The arm-D flag below is not a provisional string and stays. */
    if (M.flags && M.flags.armD) h += flagLine(COPY.armD);
    /* both of these read the periods ACTUALLY compared rather than the chart's range: every form has a second period, and forms 2 to 5 can put months on the card that the chart's range does not contain. */
    var ixA = (R.ix && R.ix[0]) || per.idxs, ixB = (R.ix && R.ix[1]) || per.idxs;
    var firstMonth = M.spine[Math.min(ixA[0], ixB[0])];
    var longest = Math.max(ixA.length, ixB.length);
    /* THE FEW-VALUES CAVEAT IS A PROPERTY OF THE PAIR (spec 5.2f, Middle month row). If EITHER side has twelve values or fewer, the leave-one-out span is computed over the  two periods ACTUALLY compared and the WIDER of the two is printed - the pair is only as settled as its less settled side. Count metrics only.
       A MEDIAN IS TAKEN OVER THE BUCKETS, so "few values" is a count of buckets on both sides. At Month grain a bucket is a month and this is the test it always was. */
    var nbA = periodGrain(M, ixA, M.grain).B.length, nbB = periodGrain(M, ixB, M.grain).B.length;
    if (o.measure === 'median' && M.kind === 'count' && Math.min(nbA, nbB) <= 12) {
      var jk = Math.max(jackknife(ixA.map(function (i) { return M.series[i]; })) || 0,
                        jackknife(ixB.map(function (i) { return M.series[i]; })) || 0);
      h += defLine(gfill(COPY.notePairMedianFew, M.grain).replace('{jack}', n2(jk)));
    }
    if (M.flags && M.flags.scheme && o.measure === 'share' && firstMonth < '2014-10') h += flagLine(COPY.scheme);
    if (M.flags && M.flags.declTrend && o.measure !== 'share' && longest >= 120) h += defLine(COPY.declTrend);
    host.innerHTML = h + '</div>';
    return R;
  }

  /* ══ THE SECTION - state, ask line, caption, footer ══════════════════════════════ One state object per page load. The user's ask survives a filter change, which is what makes the "follows the chart's filters" caption meaningful. ══════════════ */
  /* NO `period` IN THE STATE. The section has no period control of its own: its glance, its look-up and the first period of all five comparison forms are the chart's range, always. `detail` is the one period a user still picks, and it is a comparison's SECOND one. */
  var S = { mode: 'lookup', asked: false, measure: null,
            form: 'prev', detail: null };

  function optTag(k, label, cur) {
    return '<option value="' + esc(k) + '"' + (k === cur ? ' selected' : '') + '>' + esc(label) + '</option>';
  }
  function eraForm(f) { return f === 'eraLike' || f === 'eraWhole'; }

  function defaultDetail(M, form) {
    if (eraForm(form)) {
      var runs = eraChoices(M, M.periods[0].idxs);
      return runs.length ? String(runs[0].i) : null;
    }
    if (form === 'free') {
      for (var i = 0; i < M.periods.length; i++) if (M.periods[i].k !== 'chart') return M.periods[i].k;
    }
    return null;
  }


  /* ── the ask line. FIGURE plus COMPARISON, and nothing else.
     There is no period select, no date input and no preset menu: the only <select>s in this section are the figure, the comparison form and the form's own second choice. The figure select STAYS on the line in compare mode, because an era comparison of a share is a different and sounder question from an era comparison of a level. ─────────────────────────────────────────────────────────────── */
  function buildAsk(M, per, host) {
    /* the compare menu is the look-up menu minus a stock's `Reading at a date` off form 1. paint() picks the same list, so a user on that entry who changes the form is moved to `Average month-end reading` visibly, in the select they are looking at. */
    var keys = S.mode === 'compare' ? measuresForCompare(M, S.form) : measureList(M), i, h = '';
    var msel = '<select id="tfm" aria-label="' + esc(COPY.measureLabel) + '">';
    for (i = 0; i < keys.length; i++) msel += optTag(keys[i], measureLabel(M, keys[i]), S.measure);
    msel += '</select>';

    if (S.mode === 'compare') {
      var era = eraForm(S.form), runs = eraChoices(M, per.idxs);
      h += '<span class="lead">' + esc(COPY.jobCompare) + '</span>' + msel +
           '<span class="lead">' + esc(COPY.formLabel) + '</span>' +
           '<select id="tff" aria-label="' + esc(COPY.formLabel) + '">';
      for (i = 0; i < FORMS.length; i++) h += optTag(FORMS[i].k, FORMS[i].label, S.form);
      h += '</select>';
      if (era) {
        h += '<select id="tfd" aria-label="' + esc(COPY.eraLabel) + '">';
        for (i = 0; i < runs.length; i++) h += optTag(String(runs[i].i), runs[i].name, S.detail);
        h += '</select>';
      } else if (S.form === 'free') {
        h += '<select id="tfd" aria-label="' +
             esc(M.kind === 'stock' ? COPY.windowBLabelStock : COPY.windowBLabel) + '">';
        for (i = 0; i < M.periods.length; i++) {
          if (M.periods[i].k === 'chart') continue;
          h += optTag(M.periods[i].k, M.periods[i].label, S.detail);
        }
        h += '</select>';
      }
      /* THERE IS NO SETTLED-MONTHS CONTROL. Its two labels are struck with it and are not quoted here, and a comparison reaching into provisional months computes over all months */
      if (M.kind === 'stock' && S.form === 'prev') h += '<span class="tf-def tf-askline">' + esc(COPY.noteStockNoPrior) + '</span>';
    } else {
      h += '<span class="lead">' + esc(COPY.askLead) + '</span>' + msel;
      if (M.kind === 'stock') h += '<span class="tf-def tf-askline">' + esc(COPY.noteStockSelected) + '</span>';
    }

    /* the one control that turns a look-up into a comparison. A pressed toggle keeps its own label: the fill and aria-pressed carry the state, and relabelling it to the reverse action makes the two channels disagree. */
    var on = S.mode === 'compare';
    h += '<button type="button" id="tfcmp" class="tf-addcmp' + (on ? ' on' : '') +
         '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(COPY.askCompare) + '</button>';
    host.innerHTML = h;

    function bind(id, ev, fn) { var el = host.querySelector('#' + id); if (el) el.addEventListener(ev, fn); }
    bind('tfm', 'change', function (e) { S.asked = true; S.measure = e.target.value; paint(M); });
    bind('tff', 'change', function (e) {
      /* the second choice SURVIVES a move between the two era forms, because form 3's refusal names form 4 as the route out and silently changing the administration under the user on that move would answer a different question from the one the refusal sent them to. Any other move resets it: the two kinds of second choice are not interchangeable. */
      var was = S.form;
      S.asked = true; S.form = e.target.value;
      if (!(eraForm(was) && eraForm(S.form))) S.detail = defaultDetail(M, S.form);
      paint(M);
    });
    bind('tfd', 'change', function (e) { S.asked = true; S.detail = e.target.value; paint(M); });
    bind('tfcmp', 'click', function () {
      S.mode = on ? 'lookup' : 'compare'; S.asked = true;
      if (!on) { S.form = 'prev'; S.detail = defaultDetail(M, 'prev'); }
      paint(M);
    });
  }

  function cmpOpts() {
    return { form: S.form, detail: S.detail, measure: S.measure };
  }

  /* ── the caption and the footer. THERE IS NO TWO-TRUTHS MARKER AND NO RETURN CONTROL. They fired whenever a shown period was not the chart's; with no period control of its own the section can never be on another period, so the marker has no true trigger and the control has nothing to return from. They are REMOVED rather than disabled: a marker sitting in the code with no trigger is the thing a later reader restores by accident. `shownPeriods` went with them. The caption is now unconditional, which is what makes it true on every state, and it also STATES that state: captionFor() substitutes the metric, the chart's range with its convention and every narrowed filter into one template. It is the same sentence shape on loading, on zero, on partial data and on a refusal, because the chart's state is known before the cube arrives; only the figures wait.

  /* THE CAPTION ROW carries the caption on the left and the section's ONE provisional mark on the right: a flex row rather than an absolutely positioned icon, so the caption wraps into the space the mark leaves instead of running under it. The mark is built here rather than in the four shells so one edit covers all four. THE FOOTER IS THE PAGE'S OWN CAPTION AND NOTHING ELSE. Its provisional sentence and the hatch swatch beside it went with the eight struck strings; `Data runs to {month}` lives on inside the mark's body, which is the only place it now appears. ────────── */
  function paintChrome(M, els) {
    els.cap.className = 'tf-cap';
    els.cap.innerHTML = '<span class="tf-captxt">' + esc(captionFor(M)) + '</span>' +
      provMarkHTML(monthName(M.spine[M.spine.length - 1]), M.provN);
    wireMark(els.cap);
    els.foot.textContent = M.caption || '';
  }

  /* ── one paint of the whole section ────────────────────────────────────────────── */
  function paint(M) {
    var root = M.root; if (!root) return;
    var els = {
      cap: root.querySelector('#tfcap'), strip: root.querySelector('#tfstrip'),
      ask: root.querySelector('#tfask'),
      body: root.querySelector('#tfbody'), foot: root.querySelector('#tffoot')
    };
    if (!els.cap || !els.strip || !els.ask || !els.body || !els.foot) return;

    M.periods = buildPeriods(M);
    if (!M.periods.length) { els.strip.innerHTML = ''; els.body.innerHTML = ''; return; }
    /* THE PERIOD IS THE CHART'S RANGE AND THE USER DOES NOT PICK IT (spec 4). The rest of M.periods is form 5's second-period menu and nothing else reads it. */
    var per = M.periods[0];
    var keys = S.mode === 'compare' ? measuresForCompare(M, S.form) : measureList(M);
    if (keys.indexOf(S.measure) < 0) S.measure = keys[0];
    if (S.mode === 'compare' && S.detail == null) S.detail = defaultDetail(M, S.form);

    /* THE METRIC THIS SECTION DOES NOT READ. matters_pending is a cumulative running balance this project does not publish a level for, so no figure is offered on it. It shows the partial-data state rather than a number. */
    if (M.notOffered) {
      els.strip.innerHTML = '<div class="tf-stat"><div class="tf-v muted-v">-</div>' +
        '<div class="tf-k">' + esc(M.metricLabel) + '</div>' +
        '<div class="tf-win">' + esc(per.label) + '</div>' +
        defLine(COPY.unavailable + ' ' + COPY.notOfferedMatters) + '</div>';
      els.ask.innerHTML = ''; els.body.innerHTML = '';
      paintChrome(M, els);
      return;
    }

    /* region 1: the glance strip, permanent, on the chart's own period */
    renderGlance(els.strip, M, per);
    /* region 2: one ask line and one answer, held back until the user has asked. With the answer open on load the section was 608px against 318px at 1200px, measured in a real browser, and everything here pushes the chart down. */
    buildAsk(M, per, els.ask);
    if (!S.asked) els.body.innerHTML = '';
    else if (S.mode === 'compare') renderCompare(els.body, M, per, cmpOpts());
    else renderLookup(els.body, M, per, S.measure);
    paintChrome(M, els);
  }

  /* ── what a page calls, once per render ────────────────────────────────────────── */
  function render(model) {
    var root = document.querySelector('.kpis'); if (!root) return;
    model.root = root;
    /* the page's Group by state, one of the four keys on #grain's buttons. Normalised here so gnoun() and grainBuckets() cannot disagree about an unrecognised value:   gnoun() falls back to month and grainBuckets() would fall through to fiscal year. A page that hands over nothing gets month, which is the default and the state all the signed copy was signed for. */
    model.grain = GRAIN[model.grain] ? model.grain : 'month';
    if (!model.flags) model.flags = {};
    if (model.kind !== 'rate') model.rate = null;
    model.cut = model.spine && model.spine.length
      ? (window.LIONS_PROV ? window.LIONS_PROV.cutIndex(model.spine, model.provN) : model.spine.length - 1)
      : -1;
    paint(model);
  }

  g.LIONS_TOPLINE = {
    render: render, COPY: COPY, FORMS: FORMS,
    /* exported for the check harness, which asserts the arithmetic against the cubes rather than against the rendered strings */
    _internals: { buildPeriods: buildPeriods, buildCompare: buildCompare, figureFor: figureFor,
                  levelOver: levelOver, shareOver: shareOver, eraRuns: eraRuns, state: S,
                  /* the check harness asserts the noun slots and the bucketing against the cubes rather than against the rendered strings */
                  gfill: gfill, periodGrain: periodGrain }
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* ══════════════════════════════════════════════════════════════════════════════════
   THE DATA TABLE AND ITS CSV - ONE ENGINE, FOUR DESCRIPTORS.
   It was built on index.html first and then generalised to civil.html,
   agency.html and declinations.html.

   WHY IT LIVES HERE AND NOT IN FOUR PAGE SCRIPTS.
   1. The fixed load order is unchanged on all four dashboards: shared/shared.js is already in every one of them, so no script and no stylesheet is added, removed or reordered anywhere.
   2. The settled strings exist in ONE place and cannot drift four ways. The shared ones are in COPY below; a page's own words are in its descriptor's `copy`.
   3. The defences against summing overlapping parts instead of reading the cube's own
      ALL row are the same code, written once and controlled once.

   WHAT A DESCRIPTOR OWES THE ENGINE. Everything page-shaped:
     spine(), visIdx()        the month axis and the window the page is showing
     cols(state)              the column list, each {k,g,h,t,w,fold,cls}
     dimKey, dimNounPlural    the second key column's field name and the refusal's noun
     hasBasisCol              whether a Counting basis key column is printed
     stockKeys                columns that take the bucket's LAST month, never a sum
     extraKeyCsv              machine columns that ride beside the dimension key
     pv, defaultWindowKey     the LIONS_PROV options and the fallback window metric
     aggregate(state,dists,target)   the cube read; target.kind is 'all' or 'keys'
     dimSlots(state)          the dimension slots, where the total-row rule lands
     derive(row,state)        every ratio, applied to BUCKETED components and never
                              to a mean of the monthly percentages
     rowExtras(row,state)     per-page machine columns, e.g. us_role
     basisLine(state)         the one sentence above the table
     emptyState(state)        optional; a string when the table has no measure at all
     copy                     the page's own settled strings
     hasEdge                  whether this page carries tr.edge (two of the four do)
     afterHead(thead)         optional hook, e.g. index.html's doc markers
     csvLine(state,nExtra)    optional; pages whose machine-column count varies
════════════════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';

  /* A RENDERING budget, not a property of the data. Re-measured at 22 columns and it still sits inside the same band. */
  var ROW_CAP = 8000;

  /* The strings that are identical on all four dashboards. */
  var COPY = {
    rowsLabel: 'Break rows out by',
    rowsDistrict: 'District',
    colsLabel: 'Columns',
    distSum: function (n) { return n + ' districts, added together'; },
    addsTotal: 'is the total', addsYes: 'yes', addsNo: 'no - overlaps',
    /* The signed criminal refusal ends "select fewer districts or categories". Only the final noun is per page, because "categories" names nothing on agency.html and  names the wrong axis on declinations.html, where the categories are rows and the reasons are columns. */
    refusal: function (n, cap, noun) {
      return 'This selection would create ' + n.toLocaleString() + ' rows and the table builds up to ' +
        cap.toLocaleString() + '. Narrow the date range, choose a coarser Group by, or select fewer districts or ' + noun + '.';
    },
    /*The placeholder between the panel opening and the table landing. It names the ACT and never a duration: the duration is a property of the reader's device. */
    pending: 'Building the table…',
    footProvUp: function (n) {
      return 'Rows marked † are provisional: the most recent ' + n + ' months are still being reported so these numbers are expected to be higher.';
    },
    /* A net stock is OVERSTATED at the vintage edge and will FALL, so the flows caveat is wrong in the dangerous direction for a pending column. Chosen by LIONS_PROV.dirAll() over the window keys the active columns carry. */
    footProvDown: function (n) {
      return 'Rows marked † are provisional: the most recent ' + n + ' months are still being reported. In general, pending caseloads are overstated at the final month, because terminations are reported more slowly than filings.';
    },
    partialNote: '* partial period.',
    scrollHint: function (n) { return 'Scroll the table sideways to see all ' + n + ' columns.'; },
    csvLine: function (n) {
      return 'The CSV has the same rows and the same figures as the table, plus ' + n +
        ' columns that outline table notes: reporting period, whether it is a partial period, whether data is provisional and how many months that includes, and what each key cell is.';
    }
  };

  var GRAIN_NOUN = { month: 'month', cq: 'calendar quarter', fq: 'fiscal quarter', fy: 'fiscal year' };
  var GRAIN_KEY = { month: 'month', cq: 'cal_quarter', fq: 'fiscal_quarter', fy: 'fiscal_year' };
  function grainNoun(x) { return GRAIN_NOUN[x]; }
  function grainKey(x) { return GRAIN_KEY[x]; }

  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var rint = function (x) { return x == null ? '-' : Math.round(x).toLocaleString(); };
  var p1 = function (x) { return x == null ? '-' : x.toFixed(1); };
  /* The Summable cell, one renderer for the column and for its phone fold.
     `additive_bool` is true or false on the rows that answer the column's yes/no question
     and NULL on the two that do not - the cube-total row and the single-dimension row.
     Those two are DIFFERENT answers, so they print their own words rather than sharing a
     bare `-`, which made "is the total" and its opposite identical on screen. The hidden
     copy is emitted only where the visible cell is True or False, so nothing is read twice.
     This column is in words, never a glyph. */
  var summableCell = function (r) {
    if (r.additive_bool == null) return esc(r.additive || '-');
    return (r.additive_bool ? 'True' : 'False') +
      (r.additive ? ' <span class="sr-only">(' + esc(r.additive) + ')</span>' : '');
  };

  /* District slots are IDENTICAL on all four dashboards. Three levels, and the national row is never called a sum: the national cube file is its own read, not a sum over the 93 districts, and the table must not imply otherwise even though the two agree exactly. */
  function districtSlots(state) {
    var sel = (state.dists.has('National') || state.dists.size === 0) ? [] : Array.from(state.dists);
    if (!sel.length) return [{ label: 'National', level: 'national', set: new Set(['National']) }];
    if (state.rowsBy.district) return sel.slice().sort().map(function (d) {
      return { label: fmtDist(d), level: 'district', set: new Set([d]) };
    });
    if (sel.length === 1) return [{ label: fmtDist(sel[0]), level: 'district', set: new Set(sel) }];
    return [{ label: COPY.distSum(sel.length), level: 'selection_sum', set: new Set(sel) }];
  }

  /* The dimension-slot builder for every axis whose parts PARTITION their cube's own total row exactly: civil causes, civil client agencies, declination program categories and declination referring agencies. Measured on the published cubes, per axis, rather than inherited from Criminal, where the answer is different and depends on the occurrence axis. Because the parts partition exactly and no cell in these cubes is negative, the complement row is non-negative BY CONSTRUCTION rather than by measurement. */
  function partitioningSlots(desc, state) {
    var c = desc.copy, sel = desc.selectedDims(state);
    var total = { label: c.totalLabel, level: 'cube_total', target: { kind: 'all' }, additive: COPY.addsTotal };
    var member = function (m) {
      return { label: m, level: 'member', target: { kind: 'keys', keys: new Set([m]) }, additive: COPY.addsYes };
    };
    if (!sel.length) {
      if (!state.rowsBy.dim) return [total];
      var all = desc.dimList();
      return [total].concat(all.map(member)).concat([
        { label: c.complementLabel, level: 'complement', complementOf: all, additive: COPY.addsYes }]);
    }
    if (!state.rowsBy.dim) {
      /* The fourth Adds up? value. One row and no total row means there is no sum in the table and no second row to overlap with, so the column answers what the row IS rather than a yes/no question with no subject. */
      if (sel.length === 1) return [{ label: sel[0], level: 'member', target: { kind: 'keys', keys: new Set(sel) }, additive: c.addsOne }];
      return [{ label: c.dimSum(sel.length), level: 'selection_sum', target: { kind: 'keys', keys: new Set(sel) }, additive: COPY.addsYes }];
    }
    return [total].concat(sel.map(member)).concat([
      { label: c.complementLabel, level: 'complement', complementOf: sel, additive: COPY.addsYes }]);
  }

  function make(desc) {
    var PV = function () { return window.LIONS_PROV; };

    function activeCols(state) {
      return desc.cols(state).filter(function (c) { return c.g === 'key' || state.tblCols[c.g] !== false; });
    }
    /* The envelope rule: the table's own provisional mark is the WIDEST window across the columns it is CURRENTLY printing, so the chart and the table can legitimately mark different spans. Never hard-coded, always computed from the active set. */
    function windowKeys(state) {
      return activeCols(state).filter(function (c) { return c.w; }).map(function (c) { return c.w; });
    }
    function provWindow(state) {
      var k = windowKeys(state);
      return k.length ? PV().nMax(k, desc.pv) : PV().n(desc.defaultWindowKey, desc.pv);
    }
    function provDirection(state) {
      var k = windowKeys(state);
      return k.length ? PV().dirAll(k) : 'up';
    }
    function rowCount(state) {
      return grainBuckets(desc.spine(), desc.visIdx(), state.grain).length
        * districtSlots(state).length * desc.dimSlots(state).length;
    }
    /* The ratio-of-sums rule, structurally: the COMPONENT counts are bucketed first and every ratio formula runs on the bucketed components afterwards, in desc.derive(). Never a mean of monthly percentages. A STOCK is a level, so it takes the bucket's LAST month instead - summing one is what made civil.html's chart disagree with its own table by a constant 38,768. */
    function bucketComponents(R, B) {
      var o = {};
      for (var k in R) o[k] = desc.stockKeys.indexOf(k) >= 0 ? bucketEnd(R[k], B) : bucketSum(R[k], B);
      return o;
    }
    function buildRows(state) {
      var B = grainBuckets(desc.spine(), desc.visIdx(), state.grain);
      var ds = districtSlots(state), cs = desc.dimSlots(state);
      var nProv = provWindow(state);
      var flags = PV().bucketFlags(desc.spine(), B, nProv);
      var out = [];
      ds.forEach(function (d) {
        var cache = new Map();
        var comp = function (slot) {
          if (slot.complementOf) {
            if (!cache.has('__all')) cache.set('__all', bucketComponents(desc.aggregate(state, d.set, { kind: 'all' }), B));
            var tot = cache.get('__all');
            var part = bucketComponents(desc.aggregate(state, d.set, { kind: 'keys', keys: new Set(slot.complementOf) }), B);
            var o = {};
            for (var k in tot) o[k] = tot[k].map(function (v, i) { return v - part[k][i]; });
            return o;
          }
          var key = slot.level === 'cube_total' ? '__all' : slot.label;
          if (!cache.has(key)) cache.set(key, bucketComponents(desc.aggregate(state, d.set, slot.target), B));
          return cache.get(key);
        };
        cs.forEach(function (c) {
          var R = comp(c);
          for (var i = 0; i < B.length; i++) {
            var r = {
              period: B[i].label + (B[i].partial ? '*' : ''),
              period_grain: grainKey(state.grain), period_partial: B[i].partial ? 'yes' : '',
              provisional: flags[i] ? 'yes' : '', provisional_window_months: nProv,
              district: d.label, district_level: d.level,
              _prov: !!flags[i], _order: i
            };
            r[desc.dimKey] = c.label; r[desc.dimKey + '_level'] = c.level;
            if (desc.hasBasisCol) r.counting_basis = c.basis;
            r.additive = c.additive;
            // canonical machine flag for whether this slot's rows sum to the total
            if (c.additive === COPY.addsYes) r.additive_bool = true;
            else if (c.additive === COPY.addsNo) r.additive_bool = false;
            else r.additive_bool = null; // totals / not-applicable
            for (var k in R) r[k] = R[k][i];
            desc.derive(r, state);
            desc.rowExtras(r, state);
            out.push(r);
          }
        });
      });
      /* period-major: the time series stays the primary reading, as it is on the chart */
      out.sort(function (a, b) { return a._order - b._order; });
      return { rows: out, provN: nProv };
    }

    /* The CSV MIRRORS the table: same rows, same order, same figures, same metric
       columns, plus the machine columns that carry the marks the screen draws each one placed next to the column it qualifies. Headers are field names, not display labels. A percentage is emitted at 2dp where the screen rounds to 1dp: that is presentation, not identity. THE PROVISIONAL MARK survives the export boundary as THREE columns and may not be collapsed to one: `provisional` is the flag, `provisional_window_months` is what makes it interpretable away from this page, and `period_partial` is a DIFFERENT fact. */
    function csvColumns(state, cols) {
      var out = [];
      cols.forEach(function (c) {
        out.push(c.k);
        if (c.k === 'additive') out.push('additive_bool');
        if (c.k === 'period') out.push('period_grain', 'period_partial', 'provisional', 'provisional_window_months');
        if (c.k === 'district') out.push('district_level');
        if (c.k === desc.dimKey) {
          out.push(desc.dimKey + '_level');
          desc.extraKeyCsv.forEach(function (x) { out.push(x); });
        }
      });
      return out;
    }
    function csvText(state, LAST) {
      var keys = csvColumns(state, LAST.cols.length ? LAST.cols : activeCols(state));
      var L = [keys.join(',')];
      var q = function (v) { var s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
      LAST.rows.forEach(function (r) {
        L.push(keys.map(function (k) {
          var v = r[k];
          if (k.slice(-4) === '_pct') return v == null ? '' : v.toFixed(2);
          if (k === 'period') return r.period.replace('*', '');   /* the "*" is carried by period_partial */
          return q(v);
        }).join(','));
      });
      return L.join('\n');
    }

    function el(id) { return document.getElementById(id); }
    function clear(state, text) {
      /* NO SILENT TRUNCATION, ever: a truncated table that still offers a download is how a user gets a file quietly missing half its rows. The basis line stays, because it still describes what the rows would be; the summary line, the scroll hint and the caveats go, because a caveat about rows that were not drawn is noise. The CSV mirrors the table, so the download refuses with it. */
      el('refusal').textContent = text; el('refusal').hidden = false;
      el('tblwrap').hidden = true; el('dl').disabled = true;
      if (el('dl2')) el('dl2').disabled = true;
      el('summary').textContent = ''; el('tblnotes').hidden = true; el('scrollhint').hidden = true;
      el('thead').innerHTML = ''; el('tbody').innerHTML = '';
    }

    function render(state) {
      var n = rowCount(state);
      el('basisline').textContent = desc.basisLine(state);
      /* The empty state reuses the refusal's container and idiom - one vocabulary for "here is why there is no table" - and it is checked BEFORE the budget, because a  table with no measure has no row count worth reporting. */
      var empty = desc.emptyState ? desc.emptyState(state) : null;
      if (empty) { clear(state, empty); return { rows: [], cols: [], provN: provWindow(state) }; }
      if (n > ROW_CAP) {
        clear(state, COPY.refusal(n, ROW_CAP, desc.dimNounPlural));
        return { rows: [], cols: activeCols(state), provN: provWindow(state) };
      }
      el('refusal').hidden = true; el('tblwrap').hidden = false;
      el('dl').disabled = false; if (el('dl2')) el('dl2').disabled = false;
      el('tblnotes').hidden = false; el('scrollhint').hidden = false;
      var built = buildRows(state), cols = activeCols(state);
      el('thead').innerHTML = '<tr>' + cols.map(function (c) {
        return '<th class="' + (c.g === 'key' ? 'k' : 'm') + (c.fold ? ' b' : '') + (c.cls ? ' ' + c.cls : '') + '" scope="col">' + esc(c.h) + '</th>';
      }).join('') + '</tr>';
      el('tbody').innerHTML = built.rows.map(function (r) {
        var cls = [];
        /* `edge` is CARRIED FORWARD UNCHANGED on the pages that already have it, hard-coded date and all. Its threshold is undocumented and its styling fails WCAG 1.4.1 and 1.4.3. It is carried forward exactly as it is, deliberately, and both defects are recorded and open. declinations.html has never had the class and does not gain one here. */
        if (desc.hasEdge && r.period_grain === 'month' && r.period.slice(0, 7) <= '1996-09') cls.push('edge');
        if (r._prov) cls.push('recent');
        if (r[desc.dimKey + '_level'] === 'cube_total') cls.push('rowtotal');
        return '<tr' + (cls.length ? ' class="' + cls.join(' ') + '"' : '') + '>' + cols.map(function (c) {
          if (c.k === 'period') return '<td class="k">' + esc(r.period) + (r._prov ? PV().tableMark() : '') + '</td>';
          /* The trap columns FOLD INTO the dimension cell below 560px rather than being dropped: their value differs between the total row and the member rows, and that difference is the whole point of not summing overlapping parts. The meta span is display:none at desktop width, so it is out of the accessibility tree there and nothing is  read twice. */
          if (c.k === desc.dimKey) {
            return '<td class="k">' + esc(r[c.k]) + '<span class="kmeta">' +
              (desc.hasBasisCol ? esc(r.counting_basis) + ' &middot; ' : '') + 'Summable: ' + summableCell(r) + '</span></td>';
          }
          if (c.g === 'key') {
            if (c.k === 'additive') {
              return '<td class="k' + (c.fold ? ' b' : '') + '">' + summableCell(r) + '</td>';
            }
            return '<td class="k' + (c.fold ? ' b' : '') + '">' + esc(r[c.k]) + '</td>';
          }
          if (c.cls) return '<td class="' + c.cls + '">' + (c.t === 'pct' ? p1(r[c.k]) : rint(r[c.k])) + '</td>';
          return '<td>' + (c.t === 'pct' ? p1(r[c.k]) : rint(r[c.k])) + '</td>';
        }).join('') + '</tr>';
      }).join('');
      if (desc.afterHead) desc.afterHead(el('thead'));
      var csvCols = csvColumns(state, cols);
      el('summary').innerHTML = '<b>' + built.rows.length.toLocaleString() + '</b> rows &middot; <b>' +
        csvCols.length + '</b> columns in the CSV';
      el('scrollhint').textContent = COPY.scrollHint(cols.length - cols.filter(function (c) { return c.fold; }).length);
      el('notesprov').textContent = (provDirection(state) === 'down' ? COPY.footProvDown : COPY.footProvUp)(built.provN);
      el('notespartial').textContent = COPY.partialNote;
      if (el('notesextra')) el('notesextra').textContent = desc.copy.notesExtra || '';
      if (desc.csvLine && el('csvline')) el('csvline').textContent = desc.csvLine(state, csvCols.length - cols.length);
      return { rows: built.rows, cols: cols, provN: built.provN };
    }

    return {
      activeCols: activeCols, provWindow: provWindow, provDirection: provDirection,
      rowCount: rowCount, buildRows: buildRows, csvColumns: csvColumns, csvText: csvText,
      render: render, desc: desc
    };
  }

  g.LIONS_TABLE = {
    COPY: COPY, ROW_CAP: ROW_CAP, make: make,
    districtSlots: districtSlots, partitioningSlots: partitioningSlots,
    grainNoun: grainNoun, grainKey: grainKey
  };
})(typeof window !== 'undefined' ? window : globalThis);
