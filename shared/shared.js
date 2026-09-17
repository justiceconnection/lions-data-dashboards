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
  // Provisional (L-014): one extra line on any point inside the provisional zone.
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
// The provisional caveat line that used to sit under a KPI value went with the four KPI
// cards (L-204), and the topline section's own eight provisional strings went with L-207:
// the section now carries ONE mark, built by the engine at the foot of this file. The
// rule they were all written under still binds anything flex or grid: BUILD AND REMOVE
// the element rather than toggling [hidden], because an author display rule beats the
// browser's [hidden]{display:none}. The mark's own bubble is the exception that proves
// it - it is never display:none at all, because it is an aria-describedby target.
function fmtDist(c){ if(c&&c.length===3&&'NSEWMC'.includes(c[2])){ const P={N:'Northern',S:'Southern',E:'Eastern',W:'Western',M:'Middle',C:'Central'}; return c.slice(0,2)+'-'+P[c[2]]; } return c; }
// L-222: the district clause of the topline caption, in one place because all four
// dashboards carry the same 'National' sentinel and the same fmtDist labels. An EMPTY
// array means the national read - the page fetches the national cube rather than summing
// 93 districts, and the engine prints 'National' for it, never nothing.
function distClause(dists){ return (dists.has('National')||dists.size===0) ? [] : [...dists].map(fmtDist); }
function fmtMMYYYY(x){ const p=(x||'').split('-'); return p.length===2?p[1]+'-'+p[0]:x; }
function months(a,b){ const r=[]; let [y,m]=a.split("-").map(Number); const [Y,M]=b.split("-").map(Number);
  while(y<Y||(y===Y&&m<=M)){ r.push(y+"-"+String(m).padStart(2,"0")); m++; if(m>12){m=1;y++;} } return r; }
function renderNav(){ const nav=document.getElementById('dashnav'), sel=document.getElementById('dashsel');
  if(nav) nav.innerHTML=DASHBOARDS.map(d=>`<a href="./${d.file}"${d.file===CURRENT?' class="on"':''}>${d.name}</a>`).join("");
  if(sel){ sel.innerHTML=DASHBOARDS.map(d=>`<option value="${d.file}"${d.file===CURRENT?' selected':''}>${d.name}</option>`).join(""); sel.onchange=()=>{ if(sel.value!==CURRENT) location.href='./'+sel.value; }; } }
function visIdx(){ const r=[]; for(let i=0;i<SPINE.length;i++){ const ym=SPINE[i]; if(ym>=state.from&&ym<=state.to) r.push(i);} return r; }
// Chart factory: every dashboard chart is created through this so a page can adjust the
// config just before render (used by the Design-2 lab via window.LIONS_CHART_TWEAK).
// With no tweak installed it is a passthrough - identical to `new window.Chart(ctx,cfg)`.
function mkChart(ctx,cfg){ if(window.LIONS_CHART_TWEAK){ try{ window.LIONS_CHART_TWEAK(cfg); }catch(e){} } return new window.Chart(ctx,cfg); }

// ── Time-grain grouping: Month (default) / Calendar Quarter / Fiscal Quarter / Fiscal Year ──
// Purely a re-bucketing of the monthly data - no new cubes. Counts SUM within a bucket;
// percentages are recomputed by summing the component counts first (ratio-of-sums), so callers
// bucket the component arrays (bucketComp) and then run their existing metric formula on them.
// FY convention: FY2025 = Oct 2024 .. Sep 2025 (labeled by the year it ENDS).
// grain: 'month' | 'cq' (calendar qtr) | 'fq' (fiscal qtr) | 'fy' (fiscal year).
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
// A STOCK must never be summed across a bucket - L-126. A pending caseload is a level
// measured at a month end, so a quarter's value is the level at the quarter's LAST month,
// not the sum of its three months and not the net change across them. Pass the full-spine
// metric array through this instead of running the metric formula over bucketComp'd
// components. Which metrics are stocks is PV.family(m)==='stock' (shared/provisional.js),
// which is already the authority for the provisional window and the down-direction copy;
// do not invent a second predicate. Trailing nulls inside a bucket fall back to the last
// non-null month in it, so a partial bucket still reports a real level.
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
  const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const scales = chart.scales||{};
  const allS = Object.keys(scales).map(k=>scales[k]);
  const yScales = allS.filter(s=>s.axis==='y');
  const xScale  = allS.find(s=>s.axis==='x');
  const yMain   = yScales.find(s=>s.position==='left') || yScales[0];
  const datasets = chart.data.datasets||[];
  // ── Provisional zone (L-021, revision B) ────────────────────────────────────
  // chartToSVG re-emits geometry by hand and runs no Chart.js plugins, so every mark
  // the treatment makes has to be rebuilt here or the export silently drops the
  // caveat - and an export travels, which is why that is worse than never having had
  // the marker. The numbers come from LIONS_PROV.TILES / .STYLE via svgPattern(), so
  // the canvas and the SVG cannot drift apart. (The administration bands are still
  // missing from every export; pre-existing, logged as L-012, not fixed here.)
  //
  // Revision B forks by chart family exactly as the plugin does, and for the same
  // reason: on a stacked chart the marker is ink laid OVER the data, never a
  // transform applied TO it. So the flat hatch goes under the data on an unstacked
  // chart, the two-tone hatch goes over the fills on a stacked one, and a stacked
  // chart's strokes are NOT faded.
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
  // Emits the hatch <rect> for one tile kind. Called before the datasets for 'flat'
  // and after them for 'stacked' - the stacking order IS the fix for QA's D1.
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
  // Unstacked only: the flat hatch goes UNDER the data. On a stacked chart the fills
  // would erase it (measured: a 3/255 modulation - that is D1), so there is no "under"
  // and the stacked tile is emitted after the datasets instead.
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
      // Each dataset fades on its OWN window (ds._prov, set by LIONS_PROV.decorateLine);
      // chart.data._prov is the chart-wide envelope and is only the fallback. The
      // segment ENTERING the first provisional bucket is faded too, so the faded run
      // starts one point earlier.
      // Revision B: a stacked chart is never faded. Fading a stacked fill moves the
      // apparent colour, and on a stacked chart the colour is the series identity -
      // the scrim defect by another route (spec §3.4, §6.7).
      const dsFlags=provStacked?null:((datasets[i]&&datasets[i]._prov)||provFlags);
      const i0=firstProv(dsFlags);
      if(i0<0){ emit(seg(0,pts.length-1),stroke); }
      else { emit(seg(0,i0-1),stroke); emit(seg(Math.max(0,i0-1),pts.length-1),provFade(stroke)); }
    }
  }
  if(provX0!=null){
    // Stacked only: the two-tone hatch, OVER the fills.
    if(provStacked) provHatchRect('stacked');
    // Boundary rule (both families) and, on a stacked chart, the open right edge -
    // the stacked stand-in for the line family's hollow terminal point.
    out.push('<line x1="'+(provX0+0.5).toFixed(1)+'" y1="'+A.top.toFixed(1)+'" x2="'+(provX0+0.5).toFixed(1)
      +'" y2="'+A.bottom.toFixed(1)+'" stroke="'+PVS.rule+'" stroke-width="1" stroke-dasharray="3 3"/>');
    if(provStacked)
      out.push('<line x1="'+(A.right-0.5).toFixed(1)+'" y1="'+A.top.toFixed(1)+'" x2="'+(A.right-0.5).toFixed(1)
        +'" y2="'+A.bottom.toFixed(1)+'" stroke="'+PVS.rule+'" stroke-width="1" stroke-dasharray="3 3"/>');
    // The gutter bar - identical on every family, and the only mark outside the plot
    // area. In the export it sits in the same place the canvas puts it.
    out.push('<rect x="'+provX0.toFixed(1)+'" y="'+(A.bottom+PVS.gutterGap).toFixed(1)+'" width="'+(A.right-provX0).toFixed(1)
      +'" height="'+PVS.gutterH+'" fill="'+PVS.gutter+'"/>');
    // The haloed label. NO WIDTH GUARD - rev A's `>64` is what made it absent at the
    // default range (QA D3); it must not come back here either. There is no
    // measureText in the exporter, so the width is estimated at ~5.8px/char for
    // 10.5px/600, the same figure the check harness stubs; the placement rule itself
    // is LIONS_PROV.labelPlacement so the two cannot disagree about which side wins.
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
   THE TOPLINE SECTION - L-199 direction B, built under L-204, 15 September 2026.
   Spec: ops/handoffs/L-199-spec-draft.md (copy signed by Cary, section 9).
   Reference implementation: design-lab/l199-b.html + l199-common.js + l199-shell.js.

   THREE JOBS, THREE SHAPES (spec section 1): a permanent glance strip, a look-up
   answer and a comparison answer, with ONE ask line covering the last two.

   THE SECTION ROOT KEEPS class="kpis". shell2.js finds the topline by
   wrap.querySelector('.kpis') and hangs its own "Topline metrics" header and collapse
   caret off it, so renaming the container would silently remove both and collapsing
   would stop taking the controls with the figures. The page adds no title of its own.

   NO VINTAGE-DEPENDENT CONSTANT IN ANY COPY STRING (spec section 6). Every number a
   user reads - the year ranges, the "data runs to" month, every provisional count, the
   jackknife percentage, the seasonal amplitude, the mean-to-median gap, the length of
   the current administration - is computed here from the loaded cube at render time.
   The only digits allowed inside a string are fixed historical dates.

   House style D-042: no em dashes, in the copy and in these comments.
   ══════════════════════════════════════════════════════════════════════════════════ */
(function (g) {
  'use strict';

  /* ══ COPY═══════ */
  var COPY = {
    /* ONE caption, true on every state. */
    captionTpl: 'Viewing: {metric}, {range}{filters}.',
    /* the range's convention, computed from the months rather than written
       look-up heading, because buildPeriods() calls the same function, so the section
       cannot read "fiscal" in one line and "calendar" in the next. */
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
    /* the four occurrence-basis clauses, lower-cased from the basis sentences the model
       already carries */
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
    /* THE SECTION'S ONE PROVISIONAL MARK 
       It replaces EIGHT per-figure provisional strings and the section footer's second
       sentence; the footer keeps the page's own caption and nothing else. Two strings and
       not one, because an icon needs an accessible NAME as well as a body: the name is
       what a screen reader announces for the control, the body is what the control
       reveals. The body is direction-neutral - one mark now covers a flow, which rises, a
       stock, which falls, and a share, whose mix shifts - and it carries `Data runs to
       {month}`, which is the only thing the struck footer said that nothing else did.
       {n} is COMPUTED, never written: it is model.provN, LIONS_PROV.n() for the page's
       SELECTED metric, so it follows a metric change (spec section 6, section 8 item 28). */
    provMarkName: 'Why recent months are incomplete',
    provMarkBody: 'Data runs to {month}. The most recent {n} months are still being reported, so figures may change.',

    /* controls */
    askLead: 'Calculate',
    askCompare: 'Compare with a second period',
    jobCompare: 'Compare two periods',
    measureLabel: 'Figure',
    /* the ONLY period label left: form 5's second period. There is no first-period
       control to label (spec 4, Cary, 15 September 2026). */
    windowBLabel: 'Second period',
    windowBLabelStock: 'Second date',
    formLabel: 'Comparison',
    eraLabel: 'Administration',
    basisLabel: 'Calculation:',
    alsoHead: 'Other topline calculations',

    /* DEFINITIONS - FIVE, and only in the look-up answer (Cary, 15 September 2026,
       spec section 3). A definition appears only where the label is not already the
       definition: Middle month, Overall rate, Share of the total, and the average and
       middle month-end readings on a stock. Each of those five denies a specific wrong
       reading its own label invites, which is the test for a sixth. Seven were struck with
       their figures - total, average per month, the highest month, the lowest month, the
       first and last month, the reading at a date and the highest month-end reading - and
       their text is NOT quoted here, because copy left in the source is how a later
       reader restores it word for word (spec 4.1).
       A BASIS IS NOT A DEFINITION and is not cut: invariants 3 and 4 live in the basis,
       so a share keeps its denominator sentence and a rate keeps what divides what, on
       the glance strip as well as in the answer. The settled-months half of three struck
       definitions survives as COPY.noteSettledOnly, which still prints on all three. */
    defMedian: 'The middle value of {n} monthly totals.',
    defMedianFew: 'The middle value of {n} monthly totals. Note, few months are selected making trend analysis difficult.',
    defShare: 'Note this figure is calculated as a share of the total of the selected time period.',
    defStockAvg: 'The average of the {n} month-end readings in the period. Not the same as the year-end reading.',
    defStockMedian: 'The middle value of {n} month-end readings.',

    /* PERCENT METRICS. Signed 15 September 2026 in the section 9e delta, which closed
       the first of the five gaps L-204 found: section 9's figure menus covered flows and
       stocks only, and clearance, guilty and dismissed are selectable on Criminal and
       Agency. A rate carries EXACTLY THREE figures - Overall rate, Middle month, Share of
       the total. No Total (adding percentages is not a quantity), no Average per month
       (mean-of-ratios, which invariant 4 forbids: 100.52% correct against 102.60%
       averaged, L-198 1.5), and no extremum or first-and-last, because an extremum of a
       ratio series is set by its denominator and a single month at district-and-category
       grain can carry a handful of cases. */
    mRate: 'Overall rate',
    defRate: 'The period\'s component totals divided one by the other, not the average of the monthly percentages.',
    defMedianRate: 'The middle value of {n} monthly percentages. It is not the period\'s overall rate, which divides the totals.',
    /* the glance's second slot on a rate is the total the rate divides BY, labelled with
       that series' own metric name. Without this clause the strip reads as two unrelated
       figures side by side, which is what the 1200px shot showed before it was written. */
    basisRateDen: 'The total this rate divides by.',

    /* notes that qualify a figure */
    noteBestCause: 'Note a single month may reflect a court closure or a one-off batch, not a spike at that period of time.',
    noteSettledOnly: 'Analyzed over settled months only, so provisional months are not included.',
    noteSeasonal: '',
    noteMeanMedian: 'The average and the middle month differ by {gap}% here. District-level averages are more uneven than nationally.',
    noteStockPeakEdge: 'Over all months the peak is the newest month, {edge}, which is an signal of incomplete reporting instead of a new high.',
    noteStockSelected: 'Pending is a sum of cases. A total over a period adds up month-end balances and counts nothing, so this section offers a reading at a date instead.',
    noteStockNoPrior: 'Pending cases cannot be compared over a prior period, only a figure at one date versus another.',
    noteShareWhole: '',
    noteHalfSeasonal: 'This series has a strong seasonal cycle, which may not be accounted for in raw computation. For richer analysis, compare similar calendar months.',
    noteStockHalves: 'A sum, like pending cases, has no half total. Each half is read as its average month-end level over that half.',
    /* forms 3, 4 and 5 on a stock. Signed in the 9e delta (gap 4). STRUCK in the same
       delta: 'This comparison starts from the current administration, so the period above
       does not apply.' Forms 3 and 4 printed it beside a period select they had disabled,
       and there is no period select to disable. */
    basisStockPeriod: 'The average open caseload over each period. This period should be read as average month-end level rather than as a sum.',

    /* ══ THE COMPARISON BASIS IS A FIGURE CLAUSE AND THEN A PERIOD CLAUSE (L-214, Cary's
       option A, 15 September 2026, spec 5.2e and the 9g delta). The figure drives the
       comparison, so the basis is a function of (figure, form, lengths) and it is COMPOSED
       rather than written out sixty times. `Total` is not in this block: it keeps the
       length rule and its whole SIGNED sentence, built per form in buildPair() and rendered
       character for character as before. Every other figure reuses that sentence's second
       half - the PERIOD clause, also built per form - after its own first half, below.
       Nine of these are new wording; the three stock sentences above and beside them are
       MOVED from "the form's basis" to "this figure's clause" with no word changed. */
    basisFigAvg: 'Per month, each period\'s total divided by monthly count.',
    basisFigMedian: 'The middle month of each period.',
    basisFigBest: 'The highest single month in each period, settled months only.',
    basisFigWorst: 'The lowest single month in each period, settled months only.',
    basisFigFirstLast: 'The first and last month of each period, with their dates.',
    basisFigRate: 'Each period\'s totals divided one by the other.',
    basisFigMedianRate: 'The middle of each period\'s monthly percentages.',
    basisFigStockMedian: 'The middle month-end reading in each period.',
    basisFigStockPeak: 'The highest month-end reading in each period, settled months only.',
    /* MOVED, not new: form 1's stock sentence and form 2's stock sentence were the FORM's
       basis and are now the clause of the figure the form used to choose on the user's
       behalf. Not one word of either changes. The third, basisStockPeriod above, moves the
       same way and is the `Average month-end reading` clause on forms 3, 4 and 5. */
    basisFigStockRead: 'Two readings, one date each. Both dates are settled. Pending cases have no prior period of the same length, so this form reads the same date a period earlier.',
    basisFigStockHalves: 'The average month-end open caseload over each half. Pending cases have no half total, so a half is read as its average month-end level rather than as a sum.',
    /* THE SHARE CLAUSE IS THE ONE AMENDED STRING (9g). It was form 4's basis, so it named
       an administration and unequal lengths; it now prints on every form, including form 1
       where both periods are the same length and neither is an administration. Two words:
       `Each administration's` -> `Each period's`, `the unequal lengths` -> `the periods'
       lengths`. Nothing else in the sentence moves. It is built rather than stored because
       it carries the page's own selection name and occurrence basis. */
    /* a middle month over few values moves on any one of them (L-198 1.2). On a PAIR the
       span is computed over the two periods ACTUALLY compared and the wider is printed. */
    notePairMedianFew: 'Note this analysis contains few months, so read this comparison as an indication rather than a settled figure.',
    /* THERE IS NO SETTLED-ONLY BASIS SENTENCE (L-207, spec section 8 item 30). The five
       that existed went with the settled-months control: a comparison that reaches into
       provisional months now computes over ALL months, which is what the default always
       did. The two stock basis lines are NOT struck and not amended - a stock's
       truncation inside a comparison is a COMPUTATION rule and never was that control,
       and each side's label names the months actually read, which is L-193 section 2.4's
       own "say which date it is".
       THERE IS NO PROVISIONAL STRING HERE EITHER. The eight that were - the flow flag,
       the share flag, the stock flag, the "how much of the face" line, the two comparison
       direction lines, form 2's second-half line and the footer's second sentence - are
       replaced by the one section mark above (spec section 8 item 26). They are removed
       rather than left unreachable: copy sitting in the source is how a later reader
       restores it word for word. What the section no longer tells the reader is spec
       section 5.3a, and Cary signed knowing it. */

    /* THREE refusals. None carries a measured figure: section 6. */
    refuseNoEarlier: 'The data begins in October 1994, so there is no earlier period of the same length as this one. Choose a second period instead.',
    refuseShortHalves: 'This period is shorter than two years, which could produce wonky data due to the seasonal cycle of case data. Therefore the comparison is not offered below two years. Choose a longer period, or compare with a second period instead.',
    /* form 3 takes the FIRST N months of the chosen administration, N being the chart
       range's own length. When the administration is shorter there are not N months to
       take, and the form REFUSES rather than capping (spec 5.2d, Cary 15 September 2026,
       carve-out 10.6): capping answers form 4's question under a label that says "the
       same months", and form 4 is the next line of the same menu. */
    refuseEraShort: '{name} covers {m} months of this data and the chart\'s date range is {n} months, making an unequal comparison. Choose the whole of an earlier administration instead, or shorten the chart\'s date range.',

    /* declinations */
    armD: '',
    scheme: 'The declination reason scheme changed in fiscal year 2015. Reasons recorded before October 2014 are approximate, so this comparison is not like for like.',
    declTrend: 'This series now reads as falling over three decades. Whether that is a change in prosecution practice or in recording behaviour has not been established.',

    /* states */
    unavailable: 'Not available for this period.',
    /* appended to the line above when matters_pending is selected. Section 3 asks the
       partial-data state for the sentence AND one clause naming what is missing; the
       signed block carried only the first, and this is the second (9e delta, gap 3). */
    notOfferedMatters: 'Matters pending is not published as a single figure, only as a running total since October 1994, so this section does not put a number on it.',
    zero: 'None in this period.',
    loading: 'Still loading.'
  };

  /* ══ THE FIVE COMPARISON FORMS. Cary, 15 September 2026, in this order. A developer
     may not add a sixth, reorder them, or change a basis (spec section 8 item 12).
     Every one is taken from ops/handoffs/L-198-data-note.md and the citation rides on
     the record. ════════════════════════════════════════════════════════════════════ */
  var FORMS = [
    { k: 'prev',     label: 'The previous period, same length',        cite: 'L-198 §2.1' },
    { k: 'halves',   label: 'First half against second half',          cite: 'L-198 §2.7' },
    { k: 'eraLike',  label: 'The same months of another administration', cite: 'L-198 §2.2 third basis, §2.4' },
    { k: 'eraWhole', label: 'The whole of another administration',   cite: 'L-198 §2.2 first basis' },
    { k: 'free',     label: 'A second period I choose',                cite: 'L-198 §2.1 when equal length, §2.2 when not' }
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

  /* ══ THE MODEL. Each page builds one of these per render and hands it over. Nothing
     in here is a cube read: the page has already fetched and filtered, and this module
     only ever does a second pass over the monthly series it is given. ═════════════ */
  function levelOver(M, idxs) {
    if (!idxs.length) return null;
    if (M.kind === 'rate') {                       /* invariant 4: ratio of sums */
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

  /* ══ THE RANGE LABEL AND THE CAPTION (L-222) ════════════════════════════════════
     ONE function labels a range, and it is used by the caption AND by the chart period
     every glance figure and every look-up heading prints. That is not a tidiness point:
     with two of them the section reads "(FY2016 to FY2025)" in its caption and
     "(calendar months)" for the same months three lines below (spec section 2).
     A range from an October to a September is exactly a whole number of fiscal years -
     the FY convention at shared.js:55, labelled by the year it ENDS - and nothing else
     is. There is no window, no tolerance and no judgement in the test, and a user who
     types those months into From and To gets the same label as one who clicks the FY
     preset, which is the point of computing it.
     NAMED labelRange and not rangeLabel because rangeLabel(M, idxs) already exists lower
     down, for a COMPARISON's two sides; a second `function rangeLabel` here hoists over it
     and every comparison label goes undefined. */
  function labelRange(a, b) {
    var conv;
    /* the first render happens before the cube has arrived, and the page's view indices
       can point past an empty spine. monthName() has always returned '' for a missing
       month; this keeps that exact behaviour rather than throwing inside the caption. */
    if (!a || !b) return monthName(a) + ' to ' + monthName(b) + ' (' + COPY.capConvCal + ')';
    if (a.slice(5, 7) === '10' && b.slice(5, 7) === '09') {
      var fa = fyOf(a), fb = fyOf(b);
      conv = fa === fb ? COPY.capConvFy1.replace('{a}', String(fa))
                       : COPY.capConvFy.replace('{a}', String(fa)).replace('{b}', String(fb));
    } else conv = COPY.capConvCal;
    return monthName(a) + ' to ' + monthName(b) + ' (' + conv + ')';
  }
  function rangeIsFy(a, b) { return a.slice(5, 7) === '10' && b.slice(5, 7) === '09'; }

  /* ONE selection clause, and the rule is: name it when the user picked exactly one,
     count it when they picked more. Naming five is unbounded width - the longest specific
     category in the July cube is 56 characters - and the caption sits ABOVE the figures,
     so every line it gains pushes the chart down. The cost is that the caption says how
     many and not which; the picker that set it is one click away. */
  function listClause(items, noun) {
    return items.length === 1 ? String(items[0])
      : COPY.capMany.replace('{n}', String(items.length)).replace('{noun}', noun);
  }

  /* THE CAPTION. One sentence, built in one place, from the chart state and nothing else
     (spec section 8 item 3: not four times in four page scripts). Clause order is fixed
     on every dashboard, so a reader who learns it on one page keeps it on the next: what
     is counted (mode, breakdown), where (district), for whom (role), which parts
     (selection), how counted (occurrence basis). It reads NO data - only the user's own
     filter state and the loaded spine. */
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

  /* ══ PERIODS. Every one is computed from the loaded spine; no window is a constant
     and no label carries a figure written into a string (spec section 6). ═══════── */
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
      /* L-222: the chart's own period is labelled by labelRange(), the same function the
         caption uses, so the two can never disagree about the convention. This label was
         a hard-coded '(calendar months)' and printed three times on the glance strip and
         once in every look-up heading. */
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
  /* the administration bands, as index runs on the spine. Invariant 8: ADMINS is the
     single source of truth and this module reads it rather than restating it. */
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

  /* ══ COMPUTED QUANTITIES THAT REACH COPY. Every one is a pass over the loaded
     series, never a written constant (spec section 6). ══════════════════════════ */
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
  /* the seasonal peak-to-trough of this series, over its settled months, by calendar
     month. It is the {seas} a period that is not a whole number of years owes. */
  function seasonalAmp(M) {
    var by = [], cnt = [], i;
    for (i = 0; i < 12; i++) { by.push(0); cnt.push(0); }
    for (i = 0; i <= M.cut && i < M.spine.length; i++) {
      var v = M.series[i]; if (v == null) continue;
      var m = (+M.spine[i].slice(5, 7)) - 1;
      by[m] += v; cnt[m]++;
    }
    var lo = null, hi = null;
    for (i = 0; i < 12; i++) {
      if (!cnt[i]) continue;
      var a = by[i] / cnt[i];
      if (lo == null || a < lo) lo = a;
      if (hi == null || a > hi) hi = a;
    }
    return (hi && lo != null && hi > 0) ? 100 * (hi - lo) / hi : null;
  }

  /* ══ RENDER HELPERS ═════════════════════════════════════════════════════════════ */
  function defLine(t) { return '<div class="tf-def">' + esc(t) + '</div>'; }
  /* An EMPTY string renders NOTHING. `.tf-flag` carries a 4px charcoal rule and a #fff9c4
     fill and the glyph is written by this function rather than by the copy, so a blanked
     flag string would otherwise paint a full-width yellow warning box containing a ⚠ and
     no warning - measured at 1030x28 on declinations.html when COPY.armD was blanked.
     Ruled by Cary 17 September 2026 (L-246) as the general fix rather than restoring that
     one string: the next blanked flag string would do the same thing. This changes no
     copy - no string is added, removed or reworded - and a flag with text is unaffected. */
  function flagLine(t) {
    if (!t) return '';
    return '<div class="tf-flag"><span aria-hidden="true">⚠</span> ' + esc(t) + '</div>';
  }

  /* ══ THE SECTION'S ONE PROVISIONAL MARK (L-207) ═════════════════════════════════
     A <button>, not a bare glyph, and that is invariant 6 rather than taste: a phone has
     no hover, so a hover-only mark is hidden on touch, which is most of the traffic to a
     dashboard embedded in a Framer page. It opens three ways - hover and keyboard focus
     in CSS, tap or click here - and the bubble is the button's aria-describedby target
     and is NEVER `hidden` and never display:none, so a screen-reader user has the
     sentence without opening anything. The visible mark is the provisional HATCH, the
     same texture LIONS_PROV draws on a right-censored chart band, plus the accessible
     name: texture and text, never colour alone. It is 26x26, which clears WCAG 2.5.8's
     24x24 target size and matches shell2's own caret. It is the SECOND child of the
     caption row inside .kpis, so collapsing the section takes the mark with the figures
     and shell2's caret - which sits on the LEFT of its own header, outside .kpis - is
     nowhere near it. ══════════════════════════════════════════════════════════════ */
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
    /* Escape and a click elsewhere close it, so a tapped bubble is not stuck open over
       the strip. The caption row is rebuilt on every paint, so the button is new each
       time and the document listener is bound once rather than once per paint. */
    if (markDismissBound) return;
    markDismissBound = true;
    document.addEventListener('click', function () {
      var cur = document.getElementById('tfprov');
      if (cur) cur.setAttribute('aria-expanded', 'false');
    });
  }

  /* ══ MEASURES ═══════════════════════════════════════════════════════════════════
     One record per measure: its menu label, and a function that turns a period into
     a value, a sub-line, a definition and the notes it owes. Every figure carries its
     value, label, period, definition, basis and flag (spec section 3). ═══════════ */
  function measureList(M) {
    var out = [];
    if (M.kind === 'stock') {
      out.push('read', 'avg', 'median', 'peak');
    } else if (M.kind === 'rate') {
      /* three and no more: Overall rate, Middle month, Share of the total. See COPY.mRate
         for why a rate carries no total, no average per month and no extremum. */
      out.push('rate', 'median');
    } else {
      out.push('total', 'avg', 'median', 'best', 'worst', 'firstlast');
    }
    if (M.share && M.kind !== 'stock') out.push('share');
    return out;
  }
  function measureLabel(M, k) {
    switch (k) {
      case 'total': return 'Total';
      case 'rate': return COPY.mRate;
      case 'avg': return M.kind === 'stock' ? 'Average month-end reading' : 'Average per month';
      case 'median': return M.kind === 'stock' ? 'Middle month-end reading' : 'Middle month';
      case 'best': return 'Highest month';
      case 'worst': return 'Lowest month';
      case 'peak': return 'Highest month-end reading';
      case 'firstlast': return 'First and last month';
      case 'read': return 'Reading at a date';
      case 'share': return M.share.label;
      /* the glance-only denominator slot on a rate: the series' own metric name, which
         the page already has, so the slot costs no new name. */
      case 'den': return (M.rate && M.rate.denLabel) || 'Total';
    }
    return k;
  }
  /* the settled subset of a period. Extrema and stock readings truncate; everything
     else flags (invariant 6, spec sections 5.1 and 5.3). */
  function settledOf(M, idxs) {
    return idxs.filter(function (i) { return i <= M.cut; });
  }
  function provCount(M, idxs) {
    var n = 0; for (var i = 0; i < idxs.length; i++) if (idxs[i] > M.cut) n++;
    return n;
  }

  function figureFor(M, k, per) {
    var idxs = per.idxs, vals = idxs.map(function (i) { return M.series[i]; });
    var f = { key: k, label: measureLabel(M, k), period: per.label, notes: [] };
    var sIdx, i, best, bi, v;
    switch (k) {
      case 'total':
        f.v = fmtLevel(M, levelOver(M, idxs));
        break;
      case 'rate':
        f.v = fmtLevel(M, levelOver(M, idxs));
        f.def = COPY.defRate;
        break;
      case 'avg':
        if (M.kind === 'stock') {
          var s = 0, c = 0;
          for (i = 0; i < idxs.length; i++) if (M.series[idxs[i]] != null) { s += M.series[idxs[i]]; c++; }
          f.v = c ? nInt(s / c) : '-';
          f.def = COPY.defStockAvg.replace('{n}', String(idxs.length));
        } else {
          var t = levelOver(M, idxs);
          f.v = t == null ? '-' : n1(t / idxs.length);
        }
        break;
      case 'median':
        var md = median(vals);
        f.v = M.kind === 'stock' ? nInt(md) : fmtRate(M, md);
        f.def = M.kind === 'stock' ? COPY.defStockMedian.replace('{n}', String(idxs.length))
              : M.kind === 'rate' ? COPY.defMedianRate.replace('{n}', String(idxs.length))
              : (idxs.length <= 12
                  ? COPY.defMedianFew.replace('{n}', String(idxs.length)).replace('{jack}', n2(jackknife(vals) || 0))
                  : COPY.defMedian.replace('{n}', String(idxs.length)));
        break;
      case 'best': case 'worst': case 'peak':
        sIdx = settledOf(M, idxs);
        best = null; bi = null;
        for (i = 0; i < sIdx.length; i++) {
          v = M.series[sIdx[i]]; if (v == null) continue;
          if (best == null || (k === 'worst' ? v < best : v > best)) { best = v; bi = sIdx[i]; }
        }
        f.v = nInt(best);              /* never a rate: a rate offers no extremum */
        f.sub = bi == null ? '' : monthName(M.spine[bi]);
        /* the DEFINITION is struck (the label says what it is) and the settled-months
           half of it is not lost with it: it is COPY.noteSettledOnly, its own line, and
           it still prints on all three. The extremum is the one place this section
           truncates, and it says so exactly as before (invariant 6). */
        f.notes.push(COPY.noteSettledOnly);
        if (k !== 'peak') f.notes.push(COPY.noteBestCause);
        /* on a stock, say when the UNTRUNCATED peak would have been the vintage edge */
        if (k === 'peak') {
          var top = null, ti = null;
          for (i = 0; i < idxs.length; i++) {
            v = M.series[idxs[i]]; if (v == null) continue;
            if (top == null || v > top) { top = v; ti = idxs[i]; }
          }
          if (ti != null && ti > M.cut) f.notes.push(COPY.noteStockPeakEdge.replace('{edge}', monthName(M.spine[ti])));
        }
        break;
      case 'firstlast':
        var a0 = M.series[idxs[0]], b0 = M.series[idxs[idxs.length - 1]];
        f.v = nInt(a0) + ' and ' + nInt(b0);   /* never a rate: see measureList */
        f.sub = monthName(M.spine[idxs[0]]) + ' and ' + monthName(M.spine[idxs[idxs.length - 1]]);
        break;
      case 'read':
        /* THE LAST SETTLED MONTH IN THE CHART'S RANGE, with its date on its face (Cary,
           15 September 2026, carve-out 10.10 = A). This supersedes ruling 3 of the same
           morning, which read the NEWEST month and flagged it: L-207 struck every
           provisional string in the section, so the flag that ruling rested on no longer
           exists, and L-193 section 2.4's one stated truncation exception applies -
           the civil pending stock rises 67.7% in ten months into the vintage edge and
           peaks there at 148,696 against a settled high of 110,090 in January 2015
           (L-198 section 1.4). The date names which month it is, which is that rule's own
           instruction. Inside a COMPARISON the truncation is unchanged (spec 5.2). */
        sIdx = settledOf(M, idxs);
        var ri = sIdx.length ? sIdx[sIdx.length - 1] : idxs[idxs.length - 1];
        f.v = nInt(M.series[ri]);
        f.sub = monthName(M.spine[ri]);
        break;
      case 'share':
        f.v = n2(shareOver(M, idxs)) + '%';
        f.def = COPY.defShare;
        if (M.share.basis) f.basis = M.share.basis;
        break;
      case 'den':
        /* a rate alone answers "how well" and never "how big" (L-198 section 3), so the
           glance's second slot on a percent metric is the total the rate divides by. */
        f.v = nInt(sumOf(M.rate.den, idxs));
        f.basis = COPY.basisRateDen;
        break;
    }
    /* the period is not a whole number of years, so the calendar months are unbalanced */
    if (M.kind !== 'stock' && idxs.length % 12 !== 0 && k !== 'best' && k !== 'worst') {
      var seas = seasonalAmp(M);
      if (seas != null) f.notes.push(COPY.noteSeasonal.replace('{seas}', n1(seas)));
    }
    /* at district level the average and the middle month are genuinely far apart */
    if (M.districtSel && (k === 'avg' || k === 'median') && M.kind === 'count') {
      var tot = levelOver(M, idxs), mm = median(vals);
      if (tot != null && mm) {
        f.notes.push(COPY.noteMeanMedian.replace('{gap}', n1(Math.abs(tot / idxs.length - mm) / Math.abs(mm) * 100)));
      }
    }
    /* NO PER-FIGURE PROVISIONAL LINE (L-207, spec section 8 item 26). Invariant 6 is
       discharged by the ONE section mark, which paintChrome() puts at the top right of
       the box and which is reachable on hover, on focus, on tap and from the
       accessibility tree without opening anything. */
    return f;
  }

  /* ══ THE GLANCE STRIP - three statistics plus the section footer line ═══════════
     L-198 section 3's recommended sets: the level, the rate, and the selection's share
     of the total row. When the selection IS the whole total the share would read 100%
     and say nothing, so that slot becomes the middle month and says why (spec 10.3). */
  function glanceKeys(M) {
    if (M.kind === 'stock') return ['read', 'avg', 'median'];
    if (M.kind === 'rate') {
      /* the rate, the total it divides BY, and the share. A rate has no honest "average
         per month": that is mean-of-ratios, invariant 4. */
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
        /* NO DEFINITION ON THE STRIP, at any width, in any context (Cary, 15 September
           2026, spec section 3). The BASIS stays: invariants 3 and 4 live in it, and
           without `The total this rate divides by.` the rate strip reads as two
           unrelated figures side by side (carve-out 10.9, ruled to stay). */
        if (f.basis) h += defLine(f.basis);
        if (keys[i] === 'median' && M.share && M.allSelected && M.kind !== 'stock') h += defLine(COPY.noteShareWhole);
        /* THE GLANCE CARRIES SECTION 3'S SIX ELEMENTS AND NOT THE QUALIFYING NOTES.
           Value, label, period, definition, basis and flag are owed on every figure in
           every shape; the qualifying notes in section 9 - the seasonal balance of the
           period, the district mean-to-median gap, the no-cause sentence - answer "what
           else should I know about THIS figure" and belong on the look-up, where the user
           asked for that figure. Rendered here they are identical on all three columns
           and add 72px at 1200 and 232px at 390, measured in Chromium. */
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
    /* THE ONLY PLACE A DEFINITION APPEARS, and only on the five figures whose label is
       not already their definition: Middle month, Overall rate, Share of the total, and
       the average and middle month-end readings (spec section 3). figureFor() sets f.def
       on those five and on nothing else, so this is the whole of the rule. */
    if (f.def) h += defLine(f.def);
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

  /* ══ THE COMPARISON ═════════════════════════════════════════════════════════════
     Every form names itself on the page and carries its basis on its face.
     THE FIGURE DRIVES THE COMPARISON (L-214, Cary's option A, 15 September 2026, spec
     5.2e): every look-up figure applies to both periods, the FORM decides which two sets
     of months, and the two lengths decide ONE thing only - whether `Total` may be
     differenced. Equal length compares totals; unequal length compares per month and never
     differences the two totals (L-198 sections 2.1 and 2.2), and that rule is now `Total`'s
     alone. ══════════════════════════════════════════════════════════════════════════ */
  /* WHAT EACH SIDE READS IS THE FIGURE'S JOB. Until L-214 the `measure` argument was read
     for the share and then never again, so the form decided every other figure and the
     figure select was inert in compare mode - L-211, `sideValue()` line 2. `mode` survives
     for `Total` and for nothing else, which is where the length rule lives.
     `pts` says the figure is a percentage and is compared in percentage POINTS, never as a
     percent change of a percent (spec 5.2f note 3); a missing `v` says there is no single
     change to print at all, which is `First and last month` (Cary, 15 September 2026). */
  function sideValue(M, idxs, mode, measure) {
    var i, s, c, t, v;
    if (measure === 'share') return { v: shareOver(M, idxs), fmt: n2(shareOver(M, idxs)) + '%', pts: true };
    if (measure === 'best' || measure === 'worst' || measure === 'peak') {
      /* over SETTLED MONTHS ONLY, on a flow as well as a stock: an extremum would
         otherwise be won by a month whose reporting is not yet complete (invariant 6). */
      var sIdx = settledOf(M, idxs), best = null, bi = null;
      for (i = 0; i < sIdx.length; i++) {
        v = M.series[sIdx[i]]; if (v == null) continue;
        if (best == null || (measure === 'worst' ? v < best : v > best)) { best = v; bi = sIdx[i]; }
      }
      return { v: best, fmt: nInt(best), sub: bi == null ? '' : monthName(M.spine[bi]) };
    }
    if (measure === 'firstlast') {
      return { v: null, fmt: nInt(M.series[idxs[0]]) + ' and ' + nInt(M.series[idxs[idxs.length - 1]]),
               sub: monthName(M.spine[idxs[0]]) + ' and ' + monthName(M.spine[idxs[idxs.length - 1]]) };
    }
    if (measure === 'median') {
      var md = median(idxs.map(function (j) { return M.series[j]; }));
      return { v: md, fmt: M.kind === 'stock' ? nInt(md) : fmtRate(M, md), pts: M.kind === 'rate' };
    }
    if (M.kind === 'stock') {
      /* both sides are already truncated to settled months by buildPair(), on every form
         and every figure (L-198 2.3, spec 10.5), and each side's LABEL names the months
         actually read - L-193 2.4's own "say which date it is". */
      if (measure === 'avg' || mode === 'avg') {
        s = 0; c = 0;
        for (i = 0; i < idxs.length; i++) if (M.series[idxs[i]] != null) { s += M.series[idxs[i]]; c++; }
        return { v: c ? s / c : null, fmt: c ? nInt(s / c) : '-' };
      }
      var ri = idxs[idxs.length - 1];
      return { v: M.series[ri], fmt: nInt(M.series[ri]), sub: monthName(M.spine[ri]) };
    }
    t = levelOver(M, idxs);
    if (measure === 'rate') return { v: t, fmt: fmtLevel(M, t), pts: true };
    /* `Average per month` prints the bare per-month figure and carries no `in total`
       sub-line: that sub-line is `Total`'s, and on the two forms that read per month by
       rule it is the only arithmetic difference between the two figures (spec 5.2f n.1). */
    if (measure === 'avg') return { v: t == null ? null : t / idxs.length, fmt: t == null ? '-' : n1(t / idxs.length) };
    if (mode === 'perMonth') return { v: t == null ? null : t / idxs.length, fmt: (t == null ? '-' : n1(t / idxs.length) + ' per month'), total: nInt(t) };
    return { v: t, fmt: fmtLevel(M, t) };
  }

  /* THE FIGURE MENU IN COMPARE MODE (L-214, spec 5.2f note 4 and carve-out 10.11). It is
     the look-up menu with ONE subtraction, on one kind, on four of the five forms: a
     stock's `Reading at a date` is offered on form 1 only. Form 1 on a stock IS a date
     against a date (L-198 2.3); forms 2 to 5 compare two SPANS, and spec 10.5 ruled that a
     span on a stock is read as its average month-end level. Leaving the entry on those
     forms would offer a second reading of the same pair that disagrees in SIGN with the
     ruled one (L-198 2.7d: -17.46% against +11.43% on one real window). It is not offered
     rather than refused, so no string is spent, and a user who was on it when they change
     the form is moved to `Average month-end reading` visibly, in the select they are
     looking at. Nothing else is subtracted: a developer may not add a figure to this menu
     that the look-up menu does not offer (spec 5.2h). */
  function measuresForCompare(M, form) {
    var keys = measureList(M);
    if (M.kind === 'stock' && form !== 'prev') keys = keys.filter(function (k) { return k !== 'read'; });
    return keys;
  }

  /* ── THE BASIS, COMPOSED: a figure clause and then a period clause (spec 5.2e, 9g).
     `Total` returns its whole signed sentence untouched, so it renders character for
     character as before on all five forms. Every other figure takes its own clause and
     then the form's period clause, which is the second half of that same sentence. A
     stock's clauses are whole sentences and take no period clause, because each side's
     label already names the months read. ─────────────────────────────────────────── */
  function figureClause(M, measure, form) {
    if (measure === 'share') {
      /* THE ONE AMENDED STRING (9g): `Each administration's` -> `Each period's` and
         `the unequal lengths` -> `the periods' lengths`, because this sentence was form
         4's and now prints on every form. It is built rather than stored because it
         carries the page's own selection name and occurrence basis. */
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
    if (measure === 'total') return R.totalBasis;
    var c = figureClause(M, measure, R.form);
    if (!c) return R.totalBasis;
    return R.periods ? c + ' ' + R.periods : c;
  }
  function rangeLabel(M, idxs) {
    return monthName(M.spine[idxs[0]]) + ' to ' + monthName(M.spine[idxs[idxs.length - 1]]);
  }

  /* WHICH OF THE TWO PERIODS IS THE LATER ONE IS COMPUTED FROM THE MONTHS, never assumed
     (spec 5.3, section 8 item 23). Before L-205 forms 3 and 4 hard-coded the chart side as
     the later one, which was true while their first period was always the current
     administration and which an arbitrary chart range makes false: set the range to
     Trump I, pick Trump II, and the administration is the later period. The pair is shown
     later-side-first so that the two signed provisional strings, which open "The first
     period" and "The second period", name the slots they are actually on. */
  function orderPair(M, R, s1, s2) {
    var aIsLater = M.spine[s1.ix[s1.ix.length - 1]] >= M.spine[s2.ix[s2.ix.length - 1]];
    R.a = aIsLater ? s1 : s2;
    R.b = aIsLater ? s2 : s1;
    R.laterIsA = true;
    R.ix = [R.a.ix, R.b.ix];
  }
  /* THE PAIR FLAG AND ITS DIRECTION ARE STRUCK (L-207). pairProv() chose between the
     two direction strings and both are gone, so it is removed rather than left with no
     caller. This is the costliest of the three subtractions and the spec says so where
     Cary read it: L-198 2.6 asks in terms for the direction of the bias on a pair, and
     the section no longer prints it (spec 5.3a, first item). orderPair() below is NOT
     removed - its other job, the display ORDER, survives and is section 8 item 23. */
  /* the administration band whose months ARE these months, if there is one. Two uses: it
     is the one band excluded from forms 3 and 4's menu, because comparing a period with
     itself says nothing; and it names the chart's side of the pair when the two coincide,
     which is how those forms collapse to their original wording. */
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
     buildPair() decides the two sets of MONTHS and builds `Total`'s signed sentence
     (`totalBasis`) and the form's own period clause (`periods`); buildCompare() then
     composes the basis for the figure the user picked. The split is the rule: the form
     chooses the months, the figure chooses what each side reads (spec 5.2e). */
  function buildCompare(M, per, o) {
    var R = buildPair(M, per, o);
    if (R && !R.refusal && !R.unavailable) R.basis = composeBasis(M, R, o.measure);
    return R;
  }
  function buildPair(M, per, o) {
    var sp = M.spine, F = o.form, measure = o.measure, R = { form: F, cite: null };
    for (var i = 0; i < FORMS.length; i++) if (FORMS[i].k === F) R.cite = FORMS[i].cite;
    var idxs = per.idxs, L = idxs.length, p0 = idxs[0], p1 = idxs[idxs.length - 1];
    var runs, era, k;

    if (F === 'prev') {
      /* REFUSED, not truncated, where the earlier period would begin before the data
         does, including the partly covered case (spec 5.2a). A shorter or renormalised
         earlier period answers a question the user did not ask. */
      /* THERE IS NO SETTLED-MONTHS ALTERNATIVE (L-207, spec section 8 item 30). A
         comparison reaching into provisional months computes over all months, which is
         what this branch always did by default. */
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
        /* THE SIDE LABEL IS THE SPAN AND THE DATE IS THE FIGURE'S SUB-LINE (L-214).
           It was the date, which was true while form 1 on a stock could only be read as
           two readings; the three span figures now apply here too and each side's label
           has to name the months actually read. `Reading at a date` puts its own date on
           its face, in the sub-line, exactly as an extremum does (spec 3a). */
        R.a = { label: rangeLabel(M, A), val: sideValue(M, A, 'read', measure) };
        R.b = { label: rangeLabel(M, B), val: sideValue(M, B, 'read', measure) };
        R.totalBasis = COPY.basisFigStockRead;
        /* narrowed to the figure it describes, the same way spec 5.2g narrows form 2's
           stock note: its second sentence is about the reading, not about the form. */
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
      /* on a stock the provisional treatment is a TRUNCATION, not a flag (L-193 2.4's
         one stated exception, L-198 2.7d), so the halves are cut at the settled edge
         and the card prints that date in its ranges. */
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
        /* NARROWED TO THE FIGURE IT DESCRIBES (L-214, spec 5.2g). Its trigger was "form 2
           on a stock", when a stock half had one reading; a stock half has three now and
           the sentence is true of one of them. Not one word of it changes. */
        if (measure === 'avg') R.note = COPY.noteStockHalves;
      } else {
        R.periods = 'The period is ' + H.length + ' months, split at the midpoint into ' +
          h1.length + ' and ' + h2.length +
          '; on an odd number of months the extra month goes to the later half.';
        R.totalBasis = 'Per month, each half. ' + R.periods +
          ' The two half totals are shown with their month counts and are not differenced.';
      }
      /* seasonally honest with no flag ONLY when the period is a multiple of 24 months.
         A whole number of fiscal years is NOT sufficient (L-198 2.7b). */
      R.seasonal = (H.length % 24) !== 0;
      return R;
    }

    if (F === 'eraLike' || F === 'eraWhole') {
      /* RE-READ BY CARY, 15 September 2026 (spec 5.2). The first period of both forms is
         THE CHART'S RANGE, as it is on the other three; it used to be the current
         administration to date, which is why these two disabled the period control and
         printed a sentence saying so. There is no period control and that sentence is
         struck. Form 3 takes the FIRST N months of the chosen administration, N being the
         chart range's own length; form 4 takes the whole of it, per month. */
      runs = eraRuns(M);
      era = null;
      for (k = 0; k < runs.length; k++) if (String(runs[k].i) === String(o.detail)) era = runs[k];
      if (!era) return { unavailable: true };
      var aIdx = idxs.slice();
      if (M.kind === 'stock') aIdx = settledOf(M, aIdx);
      if (!aIdx.length) return { unavailable: true };
      var bIdx;
      if (F === 'eraLike') {
        /* REFUSED, NEVER CAPPED (spec 5.2d, carve-out 10.6 ruled by Cary on 15 September
           2026). Capping at the administration's own length answers form 4's question
           under a label that says "the same months", and form 4 is one line down the same
           menu. The test is on the chart range's own length, which is the number the
           refusal prints. */
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
      /* THE SHARE BRANCH IS GONE FROM HERE AND THAT IS THE STRUCTURAL HALF OF THE FIX.
         The share sentence was reachable only inside this era branch, so a share compared
         on forms 1, 2 and 5 printed `Total`'s basis instead (L-214's finding). It is a
         figure clause now, in figureClause(), and so it prints on every form. */
      if (M.kind === 'stock') {
        R.totalBasis = COPY.basisStockPeriod;
      } else if (F === 'eraLike') {
        /* the period clause is this sentence's second half, and the ONE difference is one
           letter: the signed sentence reads `Per month, the chart's range ...`, so lifting
           the tail out capitalises the `t` (spec 9g). Written from one fragment so the two
           cannot drift apart. */
        var p3 = 'he chart\'s range is ' + aIdx.length + ' months, against the first ' +
          bIdx.length + ' months of ' + era.name + '. Taking the same number of months from each is the like-for-like comparison.';
        R.periods = 'T' + p3;
        R.totalBasis = 'Per month, t' + p3;
      } else {
        R.periods = 'The chart\'s range is ' + aIdx.length + ' months and ' + era.name + ' is ' +
          bIdx.length + ' months.';
        /* the `not differenced` clause is true of `Total` and of no other figure, because
           no other figure shows a total at all, so it does not travel (spec 9g). */
        R.totalBasis = 'Per month, all months in each period. The chart\'s range is ' + aIdx.length + ' months and ' +
          era.name + ' is ' + bIdx.length + ' months, so the totals, ' + nInt(levelOver(M, aIdx)) + ' and ' +
          nInt(levelOver(M, bIdx)) + ', are not differenced.';
      }
      return R;
    }

    /* form 5: any second period the user picks, from the menu the section's own period
       select used to carry minus the chart's own range - the chart's range is the FIRST
       period of every comparison now and cannot also be the second. Totals when the two
       are equal length, per month with the basis named when they are not. */
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
    /* A PERCENTAGE IS COMPARED IN PERCENTAGE POINTS ON EVERY FORM, never as a percent
       change of a percent (spec 5.2f note 3): the share, the overall rate and a middle
       month of monthly percentages. The figure says which it is - sideValue() sets `pts`
       - so this is one rule and not three special cases. */
    if (later.val.pts) {
      if (later.val.v != null && earlier.val.v != null) pts = later.val.v - earlier.val.v;
    } else if (later.val.v != null && earlier.val.v != null && earlier.val.v !== 0) {
      pct = 100 * (later.val.v - earlier.val.v) / Math.abs(earlier.val.v);
    }
    h += '<div class="tf-q">' + esc(M.metricLabel + ': ' + R.a.label + ' against ' + R.b.label) + '</div>';
    /* EACH SIDE CARRIES THE FIGURE'S OWN LABEL (L-214, spec 3a). Two periods and two
       numbers do not say what was measured, and on the two forms that read per month by
       rule - halves and the same months of another administration - `Total` and `Average
       per month` are the same two numbers, so the label is the only thing on the face that
       answers "which figure is this". It is the figure select's own menu label: no new
       string. It goes on BOTH sides rather than once in the heading, because at 390px the
       two sides stack a screen-height apart. */
    var figLabel = measureLabel(M, o.measure);
    function side(x) {
      return '<div class="tf-side"><div class="tf-k">' + esc(x.label) + '</div><div class="tf-v">' +
        esc(x.val.fmt) + '</div>' +
        (x.val.total ? '<div class="tf-sub">' + esc(x.val.total) + ' in total</div>' : '') +
        (x.val.sub ? '<div class="tf-sub">' + esc(x.val.sub) + '</div>' : '') +
        '<div class="tf-fig">' + esc(figLabel) + '</div></div>';
    }
    /* NO CHANGE CELL AT ALL ON `First and last month` (Cary, 15 September 2026, spec 3a
       item 3). There is no single change between two pairs of endpoints. The cell is
       ABSENT rather than blank or dashed - a blank cell invites a reading - and auto-fit
       collapses the empty track, so the grid re-columns with no media query. The basis
       line says why there is none. */
    var noChange = o.measure === 'firstlast';
    h += '<div class="tf-pair">' + side(R.a) + side(R.b) +
      (noChange ? '' :
       '<div class="tf-side tf-delta"><div class="tf-k">Change</div><div class="tf-v big">' +
       esc(pts != null ? signed(pts, ' pts') : (pct != null ? signed(pct, '%') : '-')) +
       '</div></div>') + '</div>';
    h += '<div class="tf-basis"><b>' + esc(COPY.basisLabel) + ':</b> ' + esc(R.basis) + '</div>';
    if (R.note) h += defLine(R.note);
    /* THE EXTREMUM KEEPS ITS NO-CAUSE NOTE ON A COMPARISON AND EARNS IT (spec 5.2f note
       5): the lowest month of any period containing 2020 is April or May 2020 on four of
       seven series, so the pairing invites a cause more strongly than a look-up does. The
       settled-months truncation is disclosed in the basis clause itself and is not printed
       twice. `peak` is excluded here for the same reason figureFor() excludes it. */
    if (o.measure === 'best' || o.measure === 'worst') h += defLine(COPY.noteBestCause);
    /* NO PAIR FLAG AND NO DIRECTION LINE (L-207). The seasonal flag and the arm-D flag
       below are not provisional strings and stay. */
    if (R.seasonal) h += flagLine(COPY.noteHalfSeasonal);
    if (M.flags && M.flags.armD) h += flagLine(COPY.armD);
    /* both of these read the periods ACTUALLY compared rather than the chart's range:
       every form has a second period, and forms 2 to 5 can put months on the card that
       the chart's range does not contain. */
    var ixA = (R.ix && R.ix[0]) || per.idxs, ixB = (R.ix && R.ix[1]) || per.idxs;
    var firstMonth = M.spine[Math.min(ixA[0], ixB[0])];
    var longest = Math.max(ixA.length, ixB.length);
    /* THE FEW-VALUES CAVEAT IS A PROPERTY OF THE PAIR (spec 5.2f, Middle month row). If
       EITHER side has twelve months or fewer, the leave-one-out span is computed over the
       two periods ACTUALLY compared and the WIDER of the two is printed - the pair is only
       as settled as its less settled side. Count metrics only, which is where the look-up
       answer carries the same caveat: a stock has its own definition and a rate's middle
       month is a median of percentages. */
    if (o.measure === 'median' && M.kind === 'count' && Math.min(ixA.length, ixB.length) <= 12) {
      var jk = Math.max(jackknife(ixA.map(function (i) { return M.series[i]; })) || 0,
                        jackknife(ixB.map(function (i) { return M.series[i]; })) || 0);
      h += defLine(COPY.notePairMedianFew.replace('{jack}', n2(jk)));
    }
    if (M.flags && M.flags.scheme && o.measure === 'share' && firstMonth < '2014-10') h += flagLine(COPY.scheme);
    if (M.flags && M.flags.declTrend && o.measure !== 'share' && longest >= 120) h += defLine(COPY.declTrend);
    host.innerHTML = h + '</div>';
    return R;
  }

  /* ══ THE SECTION - state, ask line, caption, footer ══════════════════════════════
     One state object per page load. The user's ask survives a filter change, which is
     what makes the "follows the chart's filters" caption meaningful. ══════════════ */
  /* NO `period` IN THE STATE. The section has no period control of its own (spec 4,
     Cary, 15 September 2026): its glance, its look-up and the first period of all five
     comparison forms are the chart's range, always. `detail` is the one period a user
     still picks, and it is a comparison's SECOND one. */
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


  /* ── the ask line. FIGURE plus COMPARISON, and nothing else (spec 4 item 1, Cary,
     15 September 2026). There is no period select, no date input and no preset menu: the
     only <select>s in this section are the figure, the comparison form and the form's own
     second choice. The figure select STAYS on the line in compare mode, because an era
     comparison of a share is a different and sounder question from an era comparison of a
     level (L-198 2.4). ─────────────────────────────────────────────────────────────── */
  function buildAsk(M, per, host) {
    /* the compare menu is the look-up menu minus a stock's `Reading at a date` off form 1
       (L-214). paint() picks the same list, so a user on that entry who changes the form
       is moved to `Average month-end reading` visibly, in the select they are looking at. */
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
      /* THERE IS NO SETTLED-MONTHS CONTROL (L-207, Cary 15 September 2026, spec section
         8 item 30). Its two labels are struck with it and are not quoted here, and a
         comparison reaching into provisional months computes over all months - which is
         what the default always did. */
      if (M.kind === 'stock' && S.form === 'prev') h += '<span class="tf-def tf-askline">' + esc(COPY.noteStockNoPrior) + '</span>';
    } else {
      h += '<span class="lead">' + esc(COPY.askLead) + '</span>' + msel;
      if (M.kind === 'stock') h += '<span class="tf-def tf-askline">' + esc(COPY.noteStockSelected) + '</span>';
    }

    /* the one control that turns a look-up into a comparison. A pressed toggle keeps its
       own label: the fill and aria-pressed carry the state, and relabelling it to the
       reverse action makes the two channels disagree. */
    var on = S.mode === 'compare';
    h += '<button type="button" id="tfcmp" class="tf-addcmp' + (on ? ' on' : '') +
         '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(COPY.askCompare) + '</button>';
    host.innerHTML = h;

    function bind(id, ev, fn) { var el = host.querySelector('#' + id); if (el) el.addEventListener(ev, fn); }
    bind('tfm', 'change', function (e) { S.asked = true; S.measure = e.target.value; paint(M); });
    bind('tff', 'change', function (e) {
      /* the second choice SURVIVES a move between the two era forms, because form 3's
         refusal names form 4 as the route out and silently changing the administration
         under the user on that move would answer a different question from the one the
         refusal sent them to. Any other move resets it: the two kinds of second choice
         are not interchangeable. */
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

  /* ── the caption and the footer. THERE IS NO TWO-TRUTHS MARKER AND NO RETURN CONTROL
     (spec 4.1, Cary, 15 September 2026). They fired whenever a shown period was not the
     chart's; with no period control of its own the section can never be on another period,
     so the marker has no true trigger and the control has nothing to return from. They are
     REMOVED rather than disabled: a marker sitting in the code with no trigger is the thing
     a later reader restores by accident. `shownPeriods` went with them.
     The caption is now unconditional, which is what makes it true on every state, and
     since L-222 it also STATES that state: captionFor() substitutes the metric, the
     chart's range with its convention and every narrowed filter into one template. It is
     the same sentence shape on loading, on zero, on partial data and on a refusal,
     because the chart's state is known before the cube arrives; only the figures wait.
     THE CAPTION ROW carries the caption on the left and the section's ONE provisional
     mark on the right (L-207): a flex row rather than an absolutely positioned icon, so
     the caption wraps into the space the mark leaves instead of running under it. The
     mark is built here rather than in the four shells so one edit covers all four.
     THE FOOTER IS THE PAGE'S OWN CAPTION AND NOTHING ELSE. Its provisional sentence and
     the hatch swatch beside it went with the eight struck strings; `Data runs to {month}`
     lives on inside the mark's body, which is the only place it now appears. ────────── */
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
    /* THE PERIOD IS THE CHART'S RANGE AND THE USER DOES NOT PICK IT (spec 4). The rest of
       M.periods is form 5's second-period menu and nothing else reads it. */
    var per = M.periods[0];
    var keys = S.mode === 'compare' ? measuresForCompare(M, S.form) : measureList(M);
    if (keys.indexOf(S.measure) < 0) S.measure = keys[0];
    if (S.mode === 'compare' && S.detail == null) S.detail = defaultDetail(M, S.form);

    /* THE METRIC THIS SECTION DOES NOT READ. matters_pending is a cumulative running
       balance this project does not publish a level for, so no figure is offered on it
       (spec section 8 item 8). It shows the partial-data state rather than a number. */
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
    /* region 2: one ask line and one answer, held back until the user has asked. With
       the answer open on load the section was 608px against 318px at 1200px, measured
       in Chromium (design-lab/l199-shots.js), and everything here pushes the chart down. */
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
    if (!model.flags) model.flags = {};
    if (model.kind !== 'rate') model.rate = null;
    model.cut = model.spine && model.spine.length
      ? (window.LIONS_PROV ? window.LIONS_PROV.cutIndex(model.spine, model.provN) : model.spine.length - 1)
      : -1;
    paint(model);
  }

  g.LIONS_TOPLINE = {
    render: render, COPY: COPY, FORMS: FORMS,
    /* exported for the L-204 ported check, which asserts the arithmetic against the
       cubes rather than against the rendered strings */
    _internals: { buildPeriods: buildPeriods, buildCompare: buildCompare, figureFor: figureFor,
                  levelOver: levelOver, shareOver: shareOver, eraRuns: eraRuns, state: S }
  };
})(typeof window !== 'undefined' ? window : globalThis);
