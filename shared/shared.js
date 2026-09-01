// LIONS dashboards — shared helpers used by every dashboard.


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
    const y=dp.parsed.y; const val=y==null?'—':(ds._pct?(+y).toFixed(1)+'%':Math.round(y).toLocaleString());
    h+=`<div style="display:flex;align-items:center;gap:6px;white-space:nowrap"><span style="width:9px;height:9px;border-radius:2px;background:${c};display:inline-block;flex:none"></span><span style="flex:1;overflow:hidden;text-overflow:ellipsis">${ds.label}</span><span style="font-variant-numeric:tabular-nums;padding-left:8px">${val}</span></div>`; });
  // Provisional (L-014): one extra line on any point inside the provisional zone.
  // chart.data._prov carries the bucket flags — the same smuggle-on-data convention
  // already used for chart.data._ym. extTooltip serves all four dashboards, so this
  // is the single edit that covers every chart.
  try{ const pf=chart&&chart.data&&chart.data._prov; const dp=(tooltip.dataPoints||[])[0];
    if(pf&&dp&&pf[dp.dataIndex]){ const t=(window.LIONS_PROV?window.LIONS_PROV.tooltipLine():'Provisional — incomplete reporting');
      h+=`<div style="margin-top:5px;padding-top:4px;border-top:1px solid rgba(255,255,255,.2);opacity:.85">${t}</div>`; } }catch(e){}
  el.innerHTML=h; el.style.opacity='1';
  const r=chart.canvas.getBoundingClientRect(), w=el.offsetWidth, ht=el.offsetHeight;
  let x=r.left+tooltip.caretX+14, y=r.top+tooltip.caretY-ht/2;
  if(x+w>window.innerWidth-8) x=r.left+tooltip.caretX-w-14;
  if(x<8)x=8; if(y<8)y=8; if(y+ht>window.innerHeight-8)y=window.innerHeight-ht-8;
  el.style.left=x+'px'; el.style.top=y+'px'; }
// Provisional caveat line under a KPI value (spec §7). The NUMBER is unchanged —
// this only says the window it covers reaches into provisional months. Elements are
// created/removed rather than toggled with [hidden], because .provnote is display:flex
// and an author display rule beats the browser's [hidden]{display:none} (see the
// front-end notes; shared.css does carry the !important guard, but not relying on it
// keeps this safe if the card is ever restyled).
function setKpiNote(valueId, on, text){
  const v=document.getElementById(valueId); if(!v) return;
  const card=v.closest ? v.closest('.kpi') : null; if(!card) return;
  let n=card.querySelector('.provnote');
  if(!on){ if(n) n.remove(); return; }
  if(!n){ n=document.createElement('div'); n.className='provnote'; card.appendChild(n); }
  n.innerHTML='<span class="sw sw-prov"></span><span>'+text+'</span>';
}
const KPI_NOTE_INCLUDES='Includes provisional months';
const KPI_NOTE_COMPARES='Compares a provisional window with a settled one';
function fmtDist(c){ if(c&&c.length===3&&'NSEWMC'.includes(c[2])){ const P={N:'Northern',S:'Southern',E:'Eastern',W:'Western',M:'Middle',C:'Central'}; return c.slice(0,2)+'-'+P[c[2]]; } return c; }
function fmtMMYYYY(x){ const p=(x||'').split('-'); return p.length===2?p[1]+'-'+p[0]:x; }
function months(a,b){ const r=[]; let [y,m]=a.split("-").map(Number); const [Y,M]=b.split("-").map(Number);
  while(y<Y||(y===Y&&m<=M)){ r.push(y+"-"+String(m).padStart(2,"0")); m++; if(m>12){m=1;y++;} } return r; }
function renderNav(){ const nav=document.getElementById('dashnav'), sel=document.getElementById('dashsel');
  if(nav) nav.innerHTML=DASHBOARDS.map(d=>`<a href="./${d.file}"${d.file===CURRENT?' class="on"':''}>${d.name}</a>`).join("");
  if(sel){ sel.innerHTML=DASHBOARDS.map(d=>`<option value="${d.file}"${d.file===CURRENT?' selected':''}>${d.name}</option>`).join(""); sel.onchange=()=>{ if(sel.value!==CURRENT) location.href='./'+sel.value; }; } }
function visIdx(){ const r=[]; for(let i=0;i<SPINE.length;i++){ const ym=SPINE[i]; if(ym>=state.from&&ym<=state.to) r.push(i);} return r; }
// Chart factory: every dashboard chart is created through this so a page can adjust the
// config just before render (used by the Design-2 lab via window.LIONS_CHART_TWEAK).
// With no tweak installed it is a passthrough — identical to `new window.Chart(ctx,cfg)`.
function mkChart(ctx,cfg){ if(window.LIONS_CHART_TWEAK){ try{ window.LIONS_CHART_TWEAK(cfg); }catch(e){} } return new window.Chart(ctx,cfg); }

// ── Time-grain grouping: Month (default) / Calendar Quarter / Fiscal Quarter / Fiscal Year ──
// Purely a re-bucketing of the monthly data — no new cubes. Counts SUM within a bucket;
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
  // caveat — and an export travels, which is why that is worse than never having had
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
  // and after them for 'stacked' — the stacking order IS the fix for QA's D1.
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
  // would erase it (measured: a 3/255 modulation — that is D1), so there is no "under"
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
      // apparent colour, and on a stacked chart the colour is the series identity —
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
    // Boundary rule (both families) and, on a stacked chart, the open right edge —
    // the stacked stand-in for the line family's hollow terminal point.
    out.push('<line x1="'+(provX0+0.5).toFixed(1)+'" y1="'+A.top.toFixed(1)+'" x2="'+(provX0+0.5).toFixed(1)
      +'" y2="'+A.bottom.toFixed(1)+'" stroke="'+PVS.rule+'" stroke-width="1" stroke-dasharray="3 3"/>');
    if(provStacked)
      out.push('<line x1="'+(A.right-0.5).toFixed(1)+'" y1="'+A.top.toFixed(1)+'" x2="'+(A.right-0.5).toFixed(1)
        +'" y2="'+A.bottom.toFixed(1)+'" stroke="'+PVS.rule+'" stroke-width="1" stroke-dasharray="3 3"/>');
    // The gutter bar — identical on every family, and the only mark outside the plot
    // area. In the export it sits in the same place the canvas puts it.
    out.push('<rect x="'+provX0.toFixed(1)+'" y="'+(A.bottom+PVS.gutterGap).toFixed(1)+'" width="'+(A.right-provX0).toFixed(1)
      +'" height="'+PVS.gutterH+'" fill="'+PVS.gutter+'"/>');
    // The haloed label. NO WIDTH GUARD — rev A's `>64` is what made it absent at the
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
