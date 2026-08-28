(function(){ try{ var nav=document.getElementById('dashnav'), CUR='case_lookup.html';
  if(nav && typeof DASHBOARDS!=='undefined') nav.innerHTML=DASHBOARDS.map(function(d){return '<a href="./'+d.file+'"'+(d.file===CUR?' class="on"':'')+'>'+d.name+'</a>';}).join('');
}catch(e){} })();

let duckdb; const BUILD='prod2';
const ASSET='case-lookup/';
const SHARDS=[ASSET+'cases_a_m.parquet', ASSET+'cases_n_z.parquet'];
const SRC="read_parquet(['"+SHARDS.join("','")+"'])";
const EXPORT_CAP=500000;
const DATE_COLS=new Set(['received_date','filed_date','terminated_date']);

const COLUMNS=[
  ['district','District',true],['district_code','District code',false],
  ['case_id','Case ID',true],['case_name','Case name',false],
  ['case_type','Case type',true],['record_type','Record type',false],
  ['category_primary','Category',true],['category_all','All categories',false],['sub_category','Sub-category code',false],
  ['us_role','U.S. role',true],['received_date','Received',false],['filed_date','Filed',true],['terminated_date','Terminated',true],
  ['court_type','Court type',false],['disposition','Disposition',true],
  ['lead_agency','Lead agency',false],['all_agencies','All agencies',false],
  ['litigating_responsibility','Litigating responsibility',false],['lead_charge','Lead charge (criminal)',false],
  ['national_priority','National priority',false],['victim_witness','Victim/witness',false],
  ['drug_related','Drug-related',false],['drug_top_type','Top drug type',false],['collections','Collections',false],
  ['qui_tam','Qui tam',false],['doj_division','DOJ division',false],['special_project','Special project',false],
  ['domestic_terrorism','Domestic terrorism',false],['num_defendants','# Defendants',false],['num_charges','# Charges',false],
  ['status','Status',false],['fiscal_year','Fiscal year',false],
];
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];

const $=id=>document.getElementById(id);
let db, conn, sortState={col:null,dir:1}, facets={};
let msDist, msCat, msRole, msCourt, msDisp;
function sqlLit(s){ return "'"+String(s).replaceAll("'","''")+"'"; }
function log(m){ const s=$('status'); s.style.display=''; s.insertAdjacentHTML('beforeend','<div>'+m+'</div>'); }
window.addEventListener('error', e=> log('⚠️ error: '+(e.message||e.filename||e)));
window.addEventListener('unhandledrejection', e=> log('⚠️ '+((e.reason&&e.reason.message)||e.reason||e)));
async function qy(sql){ return (await conn.query(sql)).toArray().map(r=>r.toJSON()); }

class MS{
  constructor(mount){
    this.m=mount; this.sel=new Set(); this.opts=[]; this.hier=null;
    mount.classList.add('ms');
    mount.innerHTML='<button type="button" class="ms-btn">All</button><div class="ms-panel" hidden><input class="ms-search" placeholder="Filter…"><div class="ms-tools"><a data-a="all">Select all</a><a data-a="clear">Clear</a></div><div class="ms-list"></div></div>';
    this.btn=mount.querySelector('.ms-btn'); this.panel=mount.querySelector('.ms-panel');
    this.list=mount.querySelector('.ms-list'); this.search=mount.querySelector('.ms-search');
    this.btn.onclick=e=>{ e.stopPropagation(); const open=!this.panel.hidden; document.querySelectorAll('.ms-panel').forEach(p=>p.hidden=true); this.panel.hidden=open; if(!open) this.search.focus(); };
    this.panel.onclick=e=>e.stopPropagation();
    this.search.oninput=()=>this.render();
    this.panel.querySelectorAll('[data-a]').forEach(a=>a.onclick=()=>{ if(a.dataset.a==='all') this.opts.forEach(o=>this.sel.add(o)); else this.sel.clear(); this.render(); this.updateBtn(); });
  }
  setOptions(arr,{keep=false}={}){ this.hier=null; this.opts=arr; if(!keep) this.sel.clear(); else [...this.sel].forEach(v=>{ if(!arr.includes(v)) this.sel.delete(v); }); this.render(); this.updateBtn(); }
  setHierarchy(groups){ this.hier=groups; this.opts=groups.flatMap(g=>g.items); this.sel.clear(); this.render(); this.updateBtn(); }
  render(){ this.hier ? this.renderHier() : this.renderFlat(); }
  renderFlat(){
    const f=this.search.value.toLowerCase(); this.list.innerHTML='';
    this.opts.filter(o=>o.toLowerCase().includes(f)).forEach(o=>this.list.appendChild(this.leaf(o,0)));
  }
  renderHier(){
    const f=this.search.value.toLowerCase(); this.list.innerHTML='';
    this.hier.forEach(g=>{
      const items=g.items.filter(o=>o.toLowerCase().includes(f)||g.group.toLowerCase().includes(f));
      if(!items.length) return;
      const grow=document.createElement('label'); grow.className='grp';
      const gcb=document.createElement('input'); gcb.type='checkbox';
      const all=items.every(o=>this.sel.has(o)), some=items.some(o=>this.sel.has(o));
      gcb.checked=all; gcb.indeterminate=some&&!all;
      gcb.onchange=()=>{ if(gcb.checked) items.forEach(o=>this.sel.add(o)); else items.forEach(o=>this.sel.delete(o)); this.render(); this.updateBtn(); };
      grow.appendChild(gcb); grow.appendChild(document.createTextNode(' '+g.group+' ('+g.items.length+')'));
      this.list.appendChild(grow);
      items.forEach(o=>this.list.appendChild(this.leaf(o,24)));
    });
  }
  leaf(o,pad){
    const lab=document.createElement('label'); if(pad) lab.style.paddingLeft=pad+'px';
    const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=this.sel.has(o);
    cb.onchange=()=>{ cb.checked?this.sel.add(o):this.sel.delete(o); this.updateBtn(); if(this.hier) this.render(); };
    lab.appendChild(cb); lab.appendChild(document.createTextNode(' '+o)); return lab;
  }
  updateBtn(){ const n=this.sel.size; this.btn.textContent = n===0?'All' : n===1?[...this.sel][0] : n+' selected'; }
  values(){ return [...this.sel]; }
}
document.addEventListener('click',()=>document.querySelectorAll('.ms-panel').forEach(p=>p.hidden=true));

async function init(){
  const base=location.href.replace(/[^/]*$/,'');
  log('Starting…');
  try{
    duckdb=await import(base+ASSET+'duckdb-wasm/duckdb-bundled.js?'+BUILD);
    const worker=new Worker(base+ASSET+'duckdb-wasm/duckdb-browser-eh.worker.js');
    db=new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker);
    log('Loading search engine (~36 MB, first load takes a few seconds)…');
    await db.instantiate(base+ASSET+'duckdb-wasm/duckdb-eh.wasm');
    for(const sh of SHARDS){ await db.registerFileURL(sh, new URL(sh, base).href, duckdb.DuckDBDataProtocol.HTTP, false); }
    conn=await db.connect();
    facets=await (await fetch(base+ASSET+'facets.json?'+BUILD)).json();
  }catch(e){ log('❌ FAILED to load: '+(e&&(e.message||e.name||String(e)))); log(String(e&&e.stack||e).slice(0,300)); throw e; }

  // dynamic header: "Case Look-Up Tool - 7.5M cases (from 1994 to 2026)"
  const m=(facets.nCases/1e6).toFixed(1);
  $('hdrTitle').textContent=`Case Look-Up Tool — ${m}M cases (from ${facets.yrFrom} to ${facets.yrTo})`;

  msDist=new MS($('ms_dist')); msCat=new MS($('ms_cat')); msRole=new MS($('ms_role')); msCourt=new MS($('ms_court')); msDisp=new MS($('ms_disp'));
  msDist.setOptions(facets.districts||[]);
  refreshCategory();
  msRole.setOptions(facets.roles||[]); msCourt.setOptions(facets.courts||[]); msDisp.setOptions(facets.disps||[]);
  (facets.statuses||[]).forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; $('f_status').appendChild(o); });
  buildDatePickers(Math.max(1994, facets.yrFrom||1994), facets.yrTo||2026);

  const cc=$('colChooser');
  COLUMNS.forEach(([k,lab,def])=> cc.insertAdjacentHTML('beforeend', `<label><input type="checkbox" id="col_${k}" ${def?'checked':''}> ${lab}</label>`));
  $('f_type').onchange=refreshCategory;
  $('searchBtn').onclick=runSearch; $('csvBtn').onclick=downloadCSV; $('capClose').onclick=()=>$('capDialog').close();
  $('status').style.display='none'; $('filterPanel').style.display='';
}

function refreshCategory(){
  const t=$('f_type').value;
  if(t==='Criminal') msCat.setHierarchy(facets.crimHier||[]);
  else if(t==='Civil') msCat.setOptions(facets.catCivil||[]);
  else msCat.setOptions(Array.from(new Set([...(facets.catCivil||[]),...(facets.catCriminal||[])])).sort());
}

const opt=(v,l)=>`<option value="${v}">${l}</option>`;
function buildDatePickers(minY,maxY){
  const years=[]; for(let y=maxY;y>=minY;y--) years.push(y);
  const yOpts='<option value="">Year</option>'+years.map(y=>opt(y,y)).join('');
  const mOpts='<option value="">Month</option>'+MONTHS.map((m,i)=>opt(String(i+1).padStart(2,'0'),m)).join('');
  ['from','to'].forEach(p=>{ $(p+'_y').innerHTML=yOpts; $(p+'_m').innerHTML=mOpts; updateDays(p); $(p+'_y').onchange=()=>updateDays(p); $(p+'_m').onchange=()=>updateDays(p); });
}
function daysInMonth(y,m){ if(!m) return 31; return new Date(y?Number(y):2000, Number(m), 0).getDate(); }
function updateDays(p){
  const y=$(p+'_y').value, m=$(p+'_m').value, prev=$(p+'_d').value; const n=daysInMonth(y,m);
  $(p+'_d').innerHTML='<option value="">Day</option>'+Array.from({length:n},(_,i)=>opt(String(i+1).padStart(2,'0'),i+1)).join('');
  if(prev && Number(prev)<=n) $(p+'_d').value=prev;
}
function readBound(p,name){
  const y=$(p+'_y').value, m=$(p+'_m').value, d=$(p+'_d').value;
  if(!y && !m && !d) return {date:null,dt:null,error:null};
  if(!y || !m || !d) return {error:'Please fully specify the '+name+' date (year, month, and day).'};
  const dt=new Date(Number(y),Number(m)-1,Number(d));
  if(dt.getFullYear()!=Number(y)||dt.getMonth()!=Number(m)-1||dt.getDate()!=Number(d)) return {error:'The '+name+' date is not a real calendar date.'};
  return {date:`${y}-${m}-${d}`, dt, error:null};
}
function inList(col, vals){ return vals.length? col+' IN ('+vals.map(sqlLit).join(',')+')' : null; }

function currentFilter(){
  const c=[];
  const dist=inList('district', msDist.values()); if(dist) c.push(dist);
  const t=$('f_type').value; if(t) c.push('case_type='+sqlLit(t));
  const rec=$('f_record').value; if(rec) c.push('record_type='+sqlLit(rec));
  const cats=msCat.values();
  if(cats.length) c.push('('+cats.map(x=>'(category_primary='+sqlLit(x)+' OR category_all LIKE '+sqlLit('%'+x+'%')+')').join(' OR ')+')');
  const r=inList('us_role', msRole.values()); if(r) c.push(r);
  const ct=inList('court_type', msCourt.values()); if(ct) c.push(ct);
  const dp=inList('disposition', msDisp.values()); if(dp) c.push(dp);
  const st=$('f_status').value; if(st) c.push('status='+sqlLit(st));
  const fb=readBound('from','From'), tb=readBound('to','To');
  if(fb.error) return {error:fb.error};
  if(tb.error) return {error:tb.error};
  const today=new Date(); today.setHours(0,0,0,0);
  if(fb.dt && fb.dt>today) return {error:'The From date cannot be in the future.'};
  if(tb.dt && tb.dt>today) return {error:'The To date cannot be in the future.'};
  if(fb.dt && tb.dt && fb.dt>tb.dt) return {error:'The From date must be on or before the To date.'};
  const basis=$('f_basis').value;
  if(fb.date) c.push(basis+' >= DATE '+sqlLit(fb.date));
  if(tb.date) c.push(basis+' <= DATE '+sqlLit(tb.date));
  return {where: c.length?' WHERE '+c.join(' AND '):''};
}
function selectedCols(){ const cs=COLUMNS.filter(([k])=>$('col_'+k).checked).map(([k])=>k); return cs.length?cs:['case_id']; }

async function runSearch(){
  $('filterErr').textContent='';
  const f=currentFilter(); if(f.error){ $('filterErr').textContent=f.error; return; }
  $('searchBtn').disabled=true; $('count').textContent='Searching…';
  try{
    const n=Number((await qy("SELECT count(*) n FROM "+SRC+f.where))[0].n);
    $('count').textContent=n.toLocaleString()+' cases matched'; $('csvBtn').disabled=n===0;
    const cols=selectedCols();
    let order=''; if(sortState.col && cols.includes(sortState.col)) order=' ORDER BY '+sortState.col+(sortState.dir<0?' DESC':'');
    const rows=await qy("SELECT "+cols.join(',')+" FROM "+SRC+f.where+order+" LIMIT 100");
    renderTable(cols, rows); $('resultArea').style.display=n?'':'none';
  }catch(e){ $('count').textContent='Error: '+e.message; console.error(e); }
  $('searchBtn').disabled=false;
}
function toDate(v){ if(v instanceof Date) return v; const n=typeof v==='bigint'?Number(v):v; if(typeof n==='number'&&isFinite(n)) return new Date(n); return null; }
function fmtCell(v,key){
  if(v==null||v==='') return '';
  if(DATE_COLS.has(key)){ const d=toDate(v); if(d&&!isNaN(d)){ const p=x=>String(x).padStart(2,'0'); return `${p(d.getUTCMonth()+1)}/${p(d.getUTCDate())}/${d.getUTCFullYear()}`; } }
  if(typeof v==='bigint') return v.toString();
  return String(v);
}
function renderTable(cols, rows){
  const labels=Object.fromEntries(COLUMNS.map(([k,l])=>[k,l]));
  const thead=$('tbl').querySelector('thead'), tbody=$('tbl').querySelector('tbody');
  thead.innerHTML='<tr>'+cols.map(k=>`<th data-c="${k}">${labels[k]}${sortState.col===k?(sortState.dir<0?' ▼':' ▲'):''}</th>`).join('')+'</tr>';
  thead.querySelectorAll('th').forEach(th=>th.onclick=()=>{ const c=th.dataset.c; sortState={col:c,dir:sortState.col===c?-sortState.dir:1}; runSearch(); });
  tbody.innerHTML=rows.map(r=>'<tr>'+cols.map(k=>`<td>${fmtCell(r[k],k)}</td>`).join('')+'</tr>').join('');
}
async function downloadCSV(){
  $('filterErr').textContent='';
  const f=currentFilter(); if(f.error){ $('filterErr').textContent=f.error; return; }
  $('csvBtn').disabled=true;
  try{
    const n=Number((await qy("SELECT count(*) n FROM "+SRC+f.where))[0].n);
    if(n>EXPORT_CAP){ $('capMsg').textContent=`Your search matches ${n.toLocaleString()} cases, above the ${EXPORT_CAP.toLocaleString()}-row download limit for this tool. Please narrow your filters, or reach out to Justice Connection for a full file transfer.`; $('capDialog').showModal(); $('csvBtn').disabled=false; return; }
    const cols=selectedCols();
    try{ await db.dropFile('export.csv'); }catch(_){}
    await conn.query("COPY (SELECT "+cols.join(',')+" FROM "+SRC+f.where+") TO 'export.csv' (FORMAT CSV, HEADER)");
    const buf=await db.copyFileToBuffer('export.csv');
    const url=URL.createObjectURL(new Blob([buf],{type:'text/csv'}));
    const a=document.createElement('a'); a.href=url; a.download='case_lookup_export.csv'; a.click(); URL.revokeObjectURL(url);
  }catch(e){ alert('Export failed: '+e.message); console.error(e); }
  $('csvBtn').disabled=false;
}
init().catch(e=>console.error(e));
