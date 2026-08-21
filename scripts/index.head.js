// Shared <head> globals for the LIONS dashboards: Design-2 stacked palette + chart-axis tweak.
window.LIONS_PAL = ["#EAF54C","#231820","#6B6C68","#193B79","#53A33B","#B197DA","#DA7921","#f1f889","#6e676c","#9d9e9b","#677ea7","#8dc27e","#ccbae7","#e7a76c","#a4ac35","#181116","#4b4c49","#122955","#3a7229","#7c6a99","#995517","#f7fbb7","#a7a3a6","#c4c4c3","#a3b1c9","#badab1","#e0d5f0","#f0c9a6"];
window.LIONS_CHART_TWEAK = function(cfg){
  if(!cfg || !cfg.options || !cfg.options.scales) return;
  var sc = cfg.options.scales;
  if(sc.y){ sc.y.grid = sc.y.grid || {}; sc.y.grid.color = 'rgba(33,33,35,0.10)'; sc.y.grid.drawTicks = false; sc.y.border = sc.y.border || {}; sc.y.border.display = false; }
  if(sc.y1){ sc.y1.grid = sc.y1.grid || {}; sc.y1.grid.drawOnChartArea = false; }
  if(sc.x){
    sc.x.grid = sc.x.grid || {};
    sc.x.grid.display = true; sc.x.grid.drawOnChartArea = false; sc.x.grid.drawTicks = true; sc.x.grid.tickLength = 6; sc.x.grid.tickWidth = 1;
    var labels = (cfg.data && cfg.data.labels) || [];
    // Draw a tick mark at each SHOWN label: on the monthly axis that's the year marks (January);
    // on the coarser grains (quarter / fiscal year) every bucket gets its own tick.
    sc.x.grid.tickColor = function(c){ var L = String(labels[c.index] || '');
      if(/^\d{4}-\d{2}/.test(L)) return (/-01$/.test(L) || c.index === 0) ? 'rgba(33,33,35,0.45)' : 'rgba(0,0,0,0)';
      return 'rgba(33,33,35,0.45)'; };
    sc.x.border = sc.x.border || {}; sc.x.border.display = true; sc.x.border.color = 'rgba(33,33,35,0.22)';
    // Slight label tilt so labels/ticks stay legible on narrow screens. Chart.js rotates only as
    // much as it needs to (0° when there's room, up to 40° when cramped).
    sc.x.ticks = sc.x.ticks || {};
    sc.x.ticks.maxRotation = 40; sc.x.ticks.minRotation = 0; sc.x.ticks.autoSkipPadding = 6;
  }
};
