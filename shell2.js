/* Design B — Filter top-dropdown + Design-2 chart/section polish. Additive; never rewrites
   dashboard logic. Wrapped in try/catch so any failure here can't break the dashboard. */
(function(){ "use strict";

 /* notes 2 & 3 (grid color + x-axis year ticks) are handled by window.LIONS_CHART_TWEAK,
    injected in the page <head> for Design-2 pages and applied inside shared.js's mkChart()
    — deterministic (runs before the first render), unlike wrapping the constructor here. */

 /* ── note 1: collapse toggles for the KPI row and for each graph card ──
    Defaults to expanded; a caret in each header collapses/expands its section.  */
 function caret(){ var b=document.createElement('button'); b.type='button'; b.className='d2-caret'; b.setAttribute('aria-label','Collapse / expand'); b.innerHTML='<span class="d2-cv">▾</span>'; return b; }
 function collapsibles(wrap){
   // KPI row → give it a small header with a collapse caret
   var kpis=wrap.querySelector('.kpis');
   if(kpis && !kpis.__d2){ kpis.__d2=true;
     var hd=document.createElement('div'); hd.className='d2-sechd';
     hd.innerHTML='<span class="d2-secttl">Topline metrics</span>';
     var c=caret(); hd.appendChild(c); wrap.insertBefore(hd,kpis);
     hd.addEventListener('click',function(){ var open=!kpis.classList.contains('d2-hide'); kpis.classList.toggle('d2-hide',open); hd.classList.toggle('d2-collapsed',open); });
   }
   // each graph card (a .card containing a .chartbox) → caret in its <h3>
   [].slice.call(wrap.querySelectorAll('.card')).forEach(function(card){
     if(card.__d2 || !card.querySelector('.chartbox')) return; card.__d2=true;
     var h=card.querySelector('h3'); if(!h) return;
     var c=caret(); c.classList.add('d2-caret-h'); h.appendChild(c);
     c.addEventListener('click',function(e){ e.stopPropagation();
       var open=!card.classList.contains('d2-collapsed'); card.classList.toggle('d2-collapsed',open);
       if(!open){ try{window.dispatchEvent(new Event('resize'));}catch(err){} }   // re-fit chart on expand
     });
   });
 }

 function run(){ try{
   var wrap=document.querySelector('.wrap'); if(!wrap) return;
   if(!wrap.querySelector('.dw-stick')){
   var toolSel=['occbar','masters','master','controls'];
   var blocks=[].slice.call(wrap.children).filter(function(el){return toolSel.some(function(c){return el.classList.contains(c);});});
   if(blocks.length){
   var anchor=blocks[0];
   var stick=document.createElement('div'); stick.className='dw-stick';                          // sticky wrapper (floats on scroll)
   var bar=document.createElement('div'); bar.className='dw-bar';
   var navacc=document.querySelector('.nv-acc'); if(navacc) bar.appendChild(navacc);             // fold nav into the bar
   var btn=document.createElement('button'); btn.type='button'; btn.className='dw-btn';
   var gear='<svg class="dw-gear" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>';
   btn.innerHTML=gear+'<span>Filters</span> <span class="dw-chev">▾</span>';
   bar.appendChild(btn);
  // small "User guide" button (toggles a separate guide panel; content kept empty for user input)
  var book='<svg class="dw-book" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20"></path><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 1 4 17.5z"></path></svg>';
  var gbtn=document.createElement('button'); gbtn.type='button'; gbtn.className='dw-btn dw-guide-btn';
  gbtn.setAttribute('aria-expanded','false'); gbtn.innerHTML=book+'<span>User guide</span> <span class="dw-chev">▾</span>';
  bar.appendChild(gbtn);
   var panel=document.createElement('div'); panel.className='dw-panel';
  var gpanel=document.createElement('div'); gpanel.className='dw-guide-panel';
   wrap.insertBefore(stick, anchor);                                                             // insert wrapper BEFORE moving tools
   stick.appendChild(bar); stick.appendChild(panel);
  stick.appendChild(gpanel);
   blocks.forEach(function(b){ panel.appendChild(b); });                                         // move tools into the dropdown
   var phead=document.createElement('div'); phead.className='dw-phead';                          // collapse control at BOTTOM of panel
   phead.innerHTML='<span class="dw-ptitle">'+gear+'<span>Filters</span></span><button type="button" class="dw-close">Collapse <span class="dw-cchev">▴</span></button>';
   panel.appendChild(phead);
  // guide panel header + empty content container — DO NOT populate text here (user will provide)
  var ghead=document.createElement('div'); ghead.className='dw-phead';
  ghead.innerHTML='<span class="dw-ptitle"><span>User guide</span></span><button type="button" class="dw-close">Collapse <span class="dw-cchev">▴</span></button>';
  var gcontent=document.createElement('div'); gcontent.className='dw-guide-content';
  gcontent.innerHTML = '<p class="dw-guide-hed">How to Use This Dashboard</p><p class="dw-guide-par">This dashboard collects data published from the Department of Justice’s Legal Information Office Network System (LIONS). For more information about data collection, verification, categorization and timing, please see the About this Data note below. <p class="dw-guide-par">Data can be filtered on a time basis by calendar date, presidential administration (starting from Obama’s second term to present), and the federal fiscal year. The federal government’s fiscal calendar runs from October 1 to September 30 of the next year. Fiscal quarters, therefore are Oct. 1 to Dec. 31; Jan. 1 to March 31; April 1 to June 30 and July 1 to Sept. 30.</p><p class="dw-guide-par">Please note that complete monthly data lags by about 90 days due to DOJ processing, therefore the most accurate data will be three months old or older.For more detailed information by states, users can select their state(s) district using the district filter.</p><p class="dw-guide-par">Additional DOJ resources for district breakdowns can be found in About This Data. To see case issues, filter by program categories, which includes a list of sub-categories or more specific legal concerns. Program categories can also be filtered to only see “primary” concerns, or the attorney’s first-ranked case law concern. Filtered data can be viewed as a table (collapsed below) or downloaded as a CSV (comma-separated value) file to be analyzed further.</p>;</p>';
  gpanel.appendChild(ghead); gpanel.appendChild(gcontent);
   function setOpen(o){ panel.classList.toggle('open',o); btn.classList.toggle('on',o); try{window.dispatchEvent(new Event('resize'));}catch(e){} }
   function isOpen(){ return panel.classList.contains('open'); }
   btn.addEventListener('click',function(){ setOpen(!isOpen()); });
   phead.querySelector('.dw-close').addEventListener('click',function(){ setOpen(false); });
  // guide panel toggle
  function setGuideOpen(o){ gpanel.classList.toggle('open',o); gbtn.classList.toggle('on',o); gbtn.setAttribute('aria-expanded', o?'true':'false'); try{window.dispatchEvent(new Event('resize'));}catch(e){} }
  function isGuideOpen(){ return gpanel.classList.contains('open'); }
  gbtn.addEventListener('click',function(e){ setGuideOpen(!isGuideOpen()); });
  ghead.querySelector('.dw-close').addEventListener('click',function(){ setGuideOpen(false); });
   // (click-outside-to-collapse removed by request — the "Filters" button and the in-panel
   //  "Collapse" button are the only ways to open/close the panel.)
   setOpen(window.matchMedia? window.matchMedia('(min-width:760px)').matches : true);            // open desktop, collapsed mobile
   } }
   collapsibles(wrap);                                                                           // note 1
   // ── SVG download button on every chart card (resolves the live chart via Chart.getChart) ──
   [].slice.call(wrap.querySelectorAll('.card')).forEach(function(card){
     var cv=card.querySelector('canvas'), h3=card.querySelector('h3');
     if(!cv||!h3||h3.querySelector('.dlsvg')) return;
     var b=document.createElement('button'); b.type='button'; b.className='dlsvg'; b.title='Download this chart as an SVG'; b.textContent='SVG';
     h3.appendChild(b);
     b.addEventListener('click',function(e){ e.stopPropagation();
       try{ var C=window.Chart, ch=(C&&C.getChart)?C.getChart(cv):null; if(!ch) return;
         var ttl=(h3.querySelector('span')||{}).textContent||'chart';
         var page=(document.title.split('—')[0]||'lions').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'lions';
         var name=(cv.id||'chart')+'-'+page+'.svg';
         if(typeof downloadChartSVG==='function') downloadChartSVG(ch, name, ttl);
       }catch(err){ console.error('[shell2 svg]',err); }
     });
   });
 }catch(e){ console.error('[shell2] non-fatal:',e); } }
 if(document.readyState!=='loading') run(); else document.addEventListener('DOMContentLoaded',run);
})();
