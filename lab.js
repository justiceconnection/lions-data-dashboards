/* item 1 - fold the 4-dashboard nav into a collapsed accordion (all designs). Additive; try/catch. */
(function(){ "use strict";
 function run(){ try{
   var wrap=document.querySelector('.wrap'); if(!wrap||document.querySelector('.nv-acc')) return;
   var nav=document.getElementById('dashnav'); if(!nav) return;
   var sel=document.getElementById('dashsel');
   var cur=(nav.querySelector('a.on')||{}).textContent||'Dashboard';
   var acc=document.createElement('div'); acc.className='nv-acc';
   var head=document.createElement('button'); head.type='button'; head.className='nv-head';
   head.innerHTML='<span class="nv-lbl">Dashboard</span><span class="nv-cur"></span><span class="nv-chev">▾</span>';
   head.querySelector('.nv-cur').textContent=cur;
   var body=document.createElement('div'); body.className='nv-body';
   acc.appendChild(head); acc.appendChild(body); body.appendChild(nav); if(sel) body.appendChild(sel);
   wrap.insertBefore(acc, wrap.firstChild);
   head.addEventListener('click',function(){ acc.classList.toggle('open'); });
 }catch(e){ console.error('[lab-nav] non-fatal:',e); } }
 if(document.readyState!=='loading') run(); else document.addEventListener('DOMContentLoaded',run);
})();
