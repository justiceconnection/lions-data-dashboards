// LIONS dashboards — Framer iframe auto-height reporter (shared).
(function () {
  var last = 0;
  function measure() {
    var b = document.body, d = document.documentElement;
    return Math.max(b ? b.scrollHeight : 0, b ? b.offsetHeight : 0, d.scrollHeight, d.offsetHeight);
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
  if (window.ResizeObserver) { var ro = new ResizeObserver(schedule); ro.observe(document.documentElement); if (document.body) ro.observe(document.body); }
  if (window.MutationObserver) { new MutationObserver(schedule).observe(document.documentElement, { subtree: true, childList: true, attributes: true }); }
  setInterval(schedule, 1000);
  schedule();
})();
