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
  el.innerHTML=h; el.style.opacity='1';
  const r=chart.canvas.getBoundingClientRect(), w=el.offsetWidth, ht=el.offsetHeight;
  let x=r.left+tooltip.caretX+14, y=r.top+tooltip.caretY-ht/2;
  if(x+w>window.innerWidth-8) x=r.left+tooltip.caretX-w-14;
  if(x<8)x=8; if(y<8)y=8; if(y+ht>window.innerHeight-8)y=window.innerHeight-ht-8;
  el.style.left=x+'px'; el.style.top=y+'px'; }
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
      let d='', started=false;
      for(const el of els){ if(!el||el.skip){ started=false; continue; } const p=gp(el,['x','y']);
        if(p.x==null||p.y==null||isNaN(p.x)||isNaN(p.y)){ started=false; continue; }
        d+=(started?'L':'M')+p.x.toFixed(1)+','+p.y.toFixed(1)+' '; started=true; }
      if(d) out.push('<path d="'+d.trim()+'" fill="none" stroke="'+(typeof col==='string'?col:'#333')+'" stroke-width="'+bw+'" stroke-linejoin="round" stroke-linecap="round"/>');
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
