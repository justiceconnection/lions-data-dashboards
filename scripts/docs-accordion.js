/* Docs accordion behavior (moved into scripts/ folder) */
(function(){ "use strict";
  function run(){ try{
    var path = location.pathname || location.href;
    if(!/documentation\.html$/.test(path) && document.title.indexOf('Documentation')===-1) return;
    console.debug('[docs-accordion] init', {path: path, title: document.title});
    document.body.classList.add('doc-page');
    var wrap = document.querySelector('.wrap'); if(!wrap) return;
    var sections = wrap.querySelectorAll('section');
    console.debug('[docs-accordion] found sections', sections.length);
    sections.forEach(function(sec, idx){
      var hdr = sec.querySelector('h2') || sec.querySelector('h1');
      if(!hdr){ console.debug('[docs-accordion] section has no h1/h2 header', idx); return; }
      sec.classList.add('accordion');
      sec.classList.remove('open'); // ensure starting closed
      hdr.style.cursor = 'pointer';
      hdr.setAttribute('role','button');
      hdr.setAttribute('aria-expanded','false');
      hdr.addEventListener('click', function(){
        var isOpen = sec.classList.toggle('open');
        hdr.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
      console.debug('[docs-accordion] attached handler', idx, hdr.textContent.trim());
    });
  }catch(e){ console.error('[docs-accordion] non-fatal:', e); } }
  if(document.readyState!=='loading') run(); else document.addEventListener('DOMContentLoaded',run);
})();
