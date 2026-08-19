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
   var panel=document.createElement('div'); panel.className='dw-panel';
   wrap.insertBefore(stick, anchor);                                                             // insert wrapper BEFORE moving tools
   stick.appendChild(bar); stick.appendChild(panel);
   blocks.forEach(function(b){ panel.appendChild(b); });                                         // move tools into the dropdown
   var phead=document.createElement('div'); phead.className='dw-phead';                          // collapse control at BOTTOM of panel
   phead.innerHTML='<span class="dw-ptitle">'+gear+'<span>Filters</span></span><button type="button" class="dw-close">Collapse <span class="dw-cchev">▴</span></button>';
   panel.appendChild(phead);
   function setOpen(o){ panel.classList.toggle('open',o); btn.classList.toggle('on',o); try{window.dispatchEvent(new Event('resize'));}catch(e){} }
   function isOpen(){ return panel.classList.contains('open'); }
   btn.addEventListener('click',function(){ setOpen(!isOpen()); });
   phead.querySelector('.dw-close').addEventListener('click',function(){ setOpen(false); });
   document.addEventListener('click',function(e){                                                // click-outside collapses (ignores pickers)
     if(!isOpen()) return; var t=e.target;
     if(t && t.closest && t.closest('.dw-stick, .ms-panel, .ms, .dw-btn')) return;
     if(stick.contains(t)) return;
     setOpen(false);
   });
   setOpen(window.matchMedia? window.matchMedia('(min-width:760px)').matches : true);            // open desktop, collapsed mobile
   } }
   collapsibles(wrap);                                                                           // note 1
 }catch(e){ console.error('[shell2] non-fatal:',e); } }
 if(document.readyState!=='loading') run(); else document.addEventListener('DOMContentLoaded',run);
})();
