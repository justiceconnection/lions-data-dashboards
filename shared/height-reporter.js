// LIONS dashboards — Framer iframe auto-height reporter (shared).
(function () {
  var last = 0;
  function measure() {
    // Measure the ACTUAL content height from the .wrap container.
    // Why not documentElement.scrollHeight/offsetHeight: once Framer grows the iframe,
    // the documentElement fills the iframe's viewport, so those values get pinned to the
    // grown height and never shrink back when the user collapses graphs/table/filters.
    // The .wrap box reflects real content and shrinks correctly.
    var wrap = document.querySelector(".wrap");
    if (wrap) {
      var r = wrap.getBoundingClientRect();
      return Math.ceil(r.bottom + (window.scrollY || window.pageYOffset || 0));
    }
    return document.body ? document.body.scrollHeight : 0;
  }
  function postHeight() {
    var h = measure();
    if (h && h !== last) { last = h; parent.postMessage({ type: "lions-dashboard-height", height: h }, "*"); }
  }
  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () { scheduled = false; postHeight(); });
  }
  window.addEventListener("load", schedule);
  window.addEventListener("resize", schedule);
  document.addEventListener("DOMContentLoaded", schedule);
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(schedule);
    ro.observe(document.documentElement);
    if (document.body) ro.observe(document.body);
    var w = document.querySelector(".wrap"); if (w) ro.observe(w);   // catch content grow/shrink directly
  }
  if (window.MutationObserver) { new MutationObserver(schedule).observe(document.documentElement, { subtree: true, childList: true, attributes: true }); }
  setInterval(schedule, 1000);
  schedule();
})();
