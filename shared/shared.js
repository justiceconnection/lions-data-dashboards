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
function fmtDist(c){ return (c&&c.length===3 && 'NSEWMC'.includes(c[2])) ? c.slice(0,2)+'-'+c[2] : c; }
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
