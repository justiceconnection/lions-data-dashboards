/* LIONS dashboards — provisional (right-censored) data treatment.
 * Ledger L-021 (revision B), implementing ops/handoffs/L-003-design-spec.md rev B.
 * Ported from the reference implementation at design-lab/shared/provisional.js.
 *
 * What this is: every LIONS vintage under-reports its most recent months. This module
 * decides WHICH buckets are provisional and paints a consistent marker on them. It does
 * NOT estimate what the true value will be — no projection, no multiplier applied to any
 * plotted number. Marking uncertainty, not estimating through it.
 *
 * Pure client-side. The only new input is a month's age relative to the vintage edge,
 * and the vintage edge is max(ym) in the cube the page has already fetched
 * (SPINE[SPINE.length-1]). No new cube column, no rebuild.
 *
 * Load order (invariant 9): body end, between shared/config.js and shared/shared.js.
 * It has no dependency on shared.js and must exist before scripts/<page>.page.js runs.
 * Revision B adds and removes no asset, so invariant 9 is UNCHANGED by this change —
 * stated explicitly because the invariant carries its own amendment rule and "nothing
 * to do" is a conclusion, not an assumption.
 *
 * ── REVISION B — 31 Aug 2026, ledger L-019 (design) / L-021 (implementation) ────────
 * Rev A shipped and FAILED QA on 100%-stacked charts (L-003 test report, D1-D3).
 * The governing rule of this revision:
 *
 *   ON A STACKED CHART THE MARKER IS INK LAID OVER THE DATA, NEVER A TRANSFORM
 *   APPLIED TO IT.
 *
 * A stacked chart encodes value as area extent and identity as fill hue, and has no
 * spare surface. A line chart encodes value as the position of a thin stroke over empty
 * ground. Channels do not transfer between the two at any strength — that was the one
 * defect behind all three symptoms. What changed, and nothing else did:
 *   - the white scrim is DELETED, not softened. It moved a dark fill 63/255 toward
 *     white (worst case 85/255) on a chart where hue IS the series identity.
 *   - stacked charts get a TWO-TONE hatch drawn OVER the fills instead of a flat hatch
 *     under them. Worst-case mean-luminance shift 17/255; worst-case local contrast
 *     41/255, against the 3/255 the under-hatch actually achieved through an 80%-alpha
 *     fill (that arithmetic is D1 — no alpha tuning could have fixed it, because the
 *     fill was over it; only a change of stacking order could).
 *   - stacked charts get an OPEN RIGHT EDGE — the stacked stand-in for the line
 *     family's hollow terminal point. The zone reads as a bracketed interval.
 *   - a GUTTER BAR under the plot area: the one channel identical on every family, and
 *     the only mark outside the plot area, where nothing it covers is data. Requires
 *     scales.x.ticks.padding >= 6 on every chart carrying the treatment.
 *   - the label gets a halo, a darker ink (#3f4043) and an outside-the-zone fallback,
 *     so it draws at EVERY zone width. The rev-A `w > 64` guard is gone and must not
 *     come back: at the default 13-year range the zone is ~43px, so the label never
 *     drew — on the family where it was the only surviving non-colour channel (D3).
 * Line-chart behaviour (fade, hollow endpoints, flat hatch) is UNCHANGED — it passed.
 *
 * Channel count after this revision: line family 6 chart channels (4 non-colour);
 * stacked family 4, ALL of them non-colour. Three are shared, and the strongest one —
 * the gutter bar — is the shared one.
 */
(function (global) {
  'use strict';

  /* ── 1. How wide is the provisional window? ─────────────────────────────────
   * Months back from the vintage edge that are still materially incomplete.
   * Derived from the calibrated completion curve in
   *   docs/Vintage_Revision_Analysis_MayJunJul_2026.md §3
   *
   * RULE: mark every month whose calibrated completion factor is > 1.05 (more than
   * ~5% of its eventual total still missing), then
   *   FLOOR 3  - never narrower than the 3-month lag the public footnote already
   *              claims, and never too thin to see at quarter/FY grain;
   *   CAP   6  - the published table only runs to age 6, so 6 is the largest window
   *              the evidence actually supports. The two outflow windows are
   *              LOWER BOUNDS, not measurements (see the spec).
   *
   *   criminal filed   x1.29 1.08 1.04                     -> >1.05 at ages 0-1  -> 2, floored to 3
   *   civil    filed   x1.64 1.18 1.09 1.06 1.05           -> >1.05 at ages 0-3  -> 4
   *   criminal termin. x4.07 2.49 1.84 1.49 1.30 1.21 1.16 -> >1.05 at ages 0-6+ -> capped 6
   *   civil    termin. x2.04 1.47 1.29 1.21 1.16 1.10 1.07 -> >1.05 at ages 0-6+ -> capped 6
   *
   * These are CONSTANTS, not data, and they are used only to place a BOUNDARY --
   * never multiplied into a plotted number. That is why they survive the accuracy
   * objection that killed the prediction lines in Aug 2026: the age-0 criminal
   * termination factor moved from x2.9 to x5.4 between two vintage pairs, and the
   * boundary did not move at all. Re-deriving them when a new vintage lands is a
   * Data Analyst / Knowledge Steward job — it is not a cube rebuild.
   * UNCHANGED IN REVISION B — QA confirmed the widths are right.
   */
  var WINDOWS = { crim_in: 3, crim_out: 6, civ_in: 4, civ_out: 6, civ_stock: 6 };

  /* ── 2. Which window does a metric take? ────────────────────────────────────
   * 'in'    inflow  — filings, receipts. Under-reported; the number RISES.
   * 'out'   outflow — terminations, dispositions, declinations. Under-reported far
   *                   more and for far longer; the number RISES.
   * 'stock' net running balance (civil pending = received - terminated). Because
   *                   outflow lags much more than inflow, pending is OVERSTATED at
   *                   the edge; the number FALLS. Direction matters in the copy.
   *
   * A derived / ratio series is provisional wherever ANY of its inputs is, so it
   * takes the widest input window. clearance = terminated/filed -> 'out'.
   */
  var FAMILY = {
    cases_filed: 'in', defendants_filed: 'in', matters_received: 'in',
    cases_terminated: 'out', defendants_terminated: 'out', matters_terminated: 'out',
    guilty: 'out', dismissed: 'out', guilty_pct: 'out', dismissed_pct: 'out',
    clearance: 'out', declined: 'out',
    cases_pending: 'stock', matters_pending: 'stock'
  };

  function family(metric) { return FAMILY[metric] || 'out'; }   /* unknown -> widest */

  /* n(metric, {civil}) -> window length in months */
  function n(metric, opts) {
    var civil = !!(opts && opts.civil), f = family(metric);
    if (f === 'stock') return WINDOWS.civ_stock;
    if (civil) return f === 'in' ? WINDOWS.civ_in : WINDOWS.civ_out;
    return f === 'in' ? WINDOWS.crim_in : WINDOWS.crim_out;
  }
  /* Widest window across several plotted metrics (2nd-y-axis case). */
  function nMax(metrics, opts) {
    var m = 0; (metrics || []).forEach(function (k) { m = Math.max(m, n(k, opts)); }); return m || WINDOWS.crim_out;
  }
  /* 'up' = will rise, 'down' = will fall. Share/mix charts pass 'mix' explicitly. */
  function dir(metric) { return family(metric) === 'stock' ? 'down' : 'up'; }
  /* Direction for a set of plotted metrics: 'down' only when every one of them is a
     net stock, because that is the only case where the whole zone reads "will fall". */
  function dirAll(metrics) {
    var ms = (metrics || []).filter(Boolean);
    if (!ms.length) return 'up';
    return ms.every(function (k) { return family(k) === 'stock'; }) ? 'down' : 'up';
  }

  /* ── 3. Which buckets are provisional? ──────────────────────────────────────
   * Anchored to the VINTAGE EDGE (last month in the loaded cube), never to
   * state.to. Narrowing the visible window must not move the boundary.
   * A coarse bucket is provisional if ANY month inside it is.
   */
  function cutIndex(spine, nMonths) { return spine.length - 1 - nMonths; }  /* last MATURE index */
  function monthFlags(spine, nMonths) {
    var c = cutIndex(spine, nMonths);
    return spine.map(function (_, i) { return i > c; });
  }
  function bucketFlags(spine, B, nMonths) {
    var c = cutIndex(spine, nMonths);
    return B.map(function (b) { return b.idxs.some(function (i) { return i > c; }); });
  }
  function firstIdx(flags) { for (var i = 0; i < flags.length; i++) if (flags[i]) return i; return -1; }
  function anyProv(flags) { return !!flags && flags.some(Boolean); }

  /* ── 4. Colour helpers ──────────────────────────────────────────────────────
   * FADE is the provisional channel ON LINE CHARTS ONLY. DASH is already taken: the
   * style guide uses borderDash [5,4] to mean "right axis". Never overload it.
   * Fade is NOT used on stacked charts — see §4a and decorateLine below.
   */
  var FADE_ALPHA = 0.45;
  function fade(col, a) {
    a = (a == null) ? FADE_ALPHA : a;
    if (typeof col !== 'string') return 'rgba(33,33,35,' + a + ')';
    var m = col.trim();
    if (m[0] === '#') {
      var h = m.slice(1);
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      if (h.length === 8) h = h.slice(0, 6);
      var v = parseInt(h, 16);
      return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + a + ')';
    }
    if (m.indexOf('rgb(') === 0) return m.replace('rgb(', 'rgba(').replace(')', ',' + a + ')');
    if (m.indexOf('rgba(') === 0) return m.replace(/,\s*[\d.]+\s*\)$/, ',' + a + ')');
    return m;
  }

  /* ── 4a. The zone texture — the heart of revision B ─────────────────────────
   * TILES is DATA, not code, so the spec, this module, the SVG exporter and the check
   * harness all read the same numbers. Each tile is an 8x8 canvas carrying 45-degree
   * strokes. Because the strokes run at 45 degrees, ANY axis-aligned run of 8 pixels
   * crosses each stroke exactly once — which is what makes the arithmetic below exact.
   *
   *   'flat'    one charcoal stroke. For UNSTACKED charts, drawn UNDER the data.
   *             Passed QA on the line charts; unchanged from rev A.
   *
   *   'stacked' one WHITE stroke and one CHARCOAL stroke. For stacked charts, drawn
   *             OVER the data, because on a stacked chart there is no "under" — the
   *             fills (col+'cc', 80% alpha) erase anything beneath them.
   *
   * WHY TWO TONES. A single-tone hatch has to choose a polarity, and a stacked chart
   * carries fills from #212123 (L~33) to pale. A dark hatch vanishes on the dark
   * fills; a light hatch vanishes on the pale ones. Pairing opposite polarities means
   * one stroke always contrasts, AND the two nearly cancel in the mean — so the
   * region gains texture WITHOUT ITS COLOUR MOVING. That is the whole fix for D2: on
   * a 100%-stacked chart colour IS the data.
   *
   * Both properties are computed by meanShift()/localContrast() below and asserted in
   * design-lab/prov-lab.check.js §15:
   *   MEAN SHIFT     worst case 16.9/255 over the whole luminance range.
   *                  The deleted scrim's worst case was 85.3/255 — 5x heavier.
   *   LOCAL CONTRAST worst case 41/255, at L=169, which is exactly the luminance
   *                  where the mean shift is zero.
   * Change an alpha here and both re-derive themselves. Do not hardcode either.
   */
  var TILES = {
    flat:    { size: 8, lines: [ { rgb: [33, 33, 35],    a: 0.13 } ] },
    stacked: { size: 8, lines: [ { rgb: [251, 251, 251], a: 0.50 },
                                 { rgb: [33, 33, 35],    a: 0.30 } ] }
  };
  function _lum(rgb) { return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]; }
  /* Mean luminance shift the tile imposes on a base of luminance L (0-255).
   * out = a*src + (1-a)*L per stroked pixel; one pixel per stroke per 8. */
  function meanShift(kind, L) {
    var t = TILES[kind], s = 0;
    t.lines.forEach(function (ln) { s += ln.a * (_lum(ln.rgb) - L); });
    return s / t.size;
  }
  /* The strongest single-stroke contrast against a base of luminance L — what makes
   * the texture visible at all. */
  function localContrast(kind, L) {
    var t = TILES[kind], m = 0;
    t.lines.forEach(function (ln) { m = Math.max(m, ln.a * Math.abs(_lum(ln.rgb) - L)); });
    return m;
  }
  function worstMeanShift(kind) {
    var m = 0; for (var L = 0; L <= 255; L++) m = Math.max(m, Math.abs(meanShift(kind, L))); return m;
  }
  function worstLocalContrast(kind) {          /* the WEAKEST the texture ever gets */
    var m = 1e9; for (var L = 0; L <= 255; L++) m = Math.min(m, localContrast(kind, L)); return m;
  }
  function rgba(ln) { return 'rgba(' + ln.rgb[0] + ',' + ln.rgb[1] + ',' + ln.rgb[2] + ',' + ln.a + ')'; }

  /* Cached PER 2d CONTEXT AND PER KIND: the dashboards draw two or three canvases per
   * page, and a single module-level cache would hand one context's CanvasPattern to
   * another. (The design-lab reference caches by kind alone; this is the only
   * behavioural difference between the two files, and it is the same difference the
   * rev-A port made.) */
  var _hatch = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;
  var _hatchFallback = {};
  function hatch(ctx2d, kind) {
    kind = kind || 'flat';
    var bag = _hatch ? _hatch.get(ctx2d) : _hatchFallback;
    if (bag && bag[kind]) return bag[kind];
    var t = TILES[kind] || TILES.flat, S = t.size;
    var c = document.createElement('canvas'); c.width = S; c.height = S;
    var g = c.getContext('2d');
    g.lineWidth = 1;
    /* strokes evenly spaced along the tile diagonal: line k sits at offset k*S/nLines */
    t.lines.forEach(function (ln, k) {
      var o = k * S / t.lines.length;
      g.strokeStyle = rgba(ln);
      g.beginPath();
      g.moveTo(o - 1, 1);         g.lineTo(o + 1, -1);        /* the wrap at the corner */
      g.moveTo(o, S);             g.lineTo(o + S, 0);
      g.moveTo(o - S, S + S);     g.lineTo(o, S);
      g.stroke();
    });
    var p = ctx2d.createPattern(c, 'repeat');
    if (!bag) { bag = {}; if (_hatch) _hatch.set(ctx2d, bag); }
    bag[kind] = p;
    return p;
  }

  /* ── 5. Series decoration (LINE / UNSTACKED charts only) ────────────────────
   * Fades only the stroke inside the zone, via Chart.js segment callbacks.
   * The segment ENTERING the first provisional bucket is faded (it is the
   * transition and is itself uncertain). Keeps whatever borderDash the dataset
   * already carries, so "dashed = right axis" survives intact.
   * Point radii: union with whatever the caller already set for partial periods.
   *
   * REVISION B: a stacked dataset is REFUSED, not merely discouraged. Fading a
   * stacked area fill is the scrim defect by another route — it moves the colour, and
   * on a stacked chart the colour is the series identity (spec §6.7). Callers mark
   * stacked datasets with `_stacked:true`, per render, from the Sum/Stacked toggle.
   */
  function decorateLine(ds, flags, basePR) {
    if (!ds || !flags || !flags.length) return ds;
    if (ds.fill && ds._stacked) return ds;          /* refuse: see the note above */
    var col = ds.borderColor, f = fade(col);
    ds.segment = Object.assign({}, ds.segment, {
      borderColor: function (c) { return flags[c.p1DataIndex] ? f : undefined; }
    });
    var last = flags.length - 1;
    ds.pointRadius = flags.map(function (p, i) {
      var b = Array.isArray(basePR) ? (basePR[i] || 0) : (basePR || 0);
      if (i === last && p) return 4.5;      /* open endpoint: the terminus */
      return p ? Math.max(b, 3.2) : b;
    });
    ds.pointStyle = 'circle';
    ds.pointBackgroundColor = '#fff';       /* hollow = not closed yet */
    ds.pointBorderColor = col;
    ds.pointBorderWidth = 1.4;
    ds.pointHoverRadius = 4.5;
    ds._prov = flags;
    return ds;
  }

  /* ── 6. The Chart.js plugin ─────────────────────────────────────────────────
   * Reads chart.data._prov (bucket flags), the same smuggle-on-data convention the
   * codebase already uses for chart.data._ym.
   *
   *   beforeDatasetsDraw   UNSTACKED only: the flat hatch, under the data and over
   *                        the era band.
   *   afterDatasetsDraw    STACKED only: the two-tone hatch, over the fills, and the
   *                        open right edge.
   *                        BOTH families: the boundary rule, the gutter bar and the
   *                        haloed label, always on top so no fill can bury them.
   *
   * The family is decided PER RENDER from scales.y.stacked, never cached: the mix
   * charts carry a Sum/Stacked toggle, so the same canvas is a line chart in one
   * state and a stacked chart in the next.
   *
   * Zone geometry uses the same half-step idiom as the adminBands plugin, so the
   * two align exactly.
   */
  var STYLE = {
    rule:      '#9a9b96',                  /* boundary + open edge, 1px [3,3]        */
    gutter:    'rgba(33,33,35,0.72)',      /* 6.2:1 on #fbfbfb — passes WCAG 1.4.11  */
    gutterH:   3,                          /* px, sits in the x-axis tick padding    */
    gutterGap: 1,                          /* px below chartArea.bottom              */
    label:     'Provisional',
    labelInk:  '#3f4043',                  /* 9.3:1 against its own halo             */
    labelHalo: 'rgba(251,251,251,0.92)',
    labelFont: '600 10.5px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    labelPad:  14,                         /* px of slack the label needs to fit     */
    labelTop:  24                          /* one line under the era-band label (11) */
  };

  function zone(ch) {
    var flags = ch.data._prov; if (!flags || !flags.length) return null;
    var i0 = firstIdx(flags); if (i0 < 0) return null;
    var x = ch.scales.x, area = ch.chartArea;
    var half = flags.length > 1 ? Math.abs(x.getPixelForValue(1) - x.getPixelForValue(0)) / 2 : 10;
    var x0 = Math.max(area.left, x.getPixelForValue(i0) - half);
    return { x0: x0, x1: area.right, area: area, i0: i0 };
  }
  function isStacked(ch) {
    try { return !!(ch.options.scales && ch.options.scales.y && ch.options.scales.y.stacked); }
    catch (e) { return false; }
  }

  /* Where does the label go? Rev A suppressed it below a 64px zone, which at the
   * DEFAULT 13-year range meant it never drew at all — and on a stacked chart it was
   * the only surviving non-colour channel (QA D3). D-017 settled that the ZONE has no
   * minimum rendered width; it said nothing about whether the zone is LABELLED. So:
   * inside the zone when it fits, otherwise immediately LEFT of the boundary rule,
   * which always has room on a long range. Omitted only when the whole plot is
   * narrower than the word — so in practice the label always draws.
   * Do not reintroduce a width guard here or anywhere else (spec §6.8). */
  function labelPlacement(z, textW) {
    var need = textW + STYLE.labelPad;
    if (z.x1 - z.x0 >= need) return { x: z.x1 - 7, align: 'right', where: 'inside' };
    if (z.x0 - z.area.left >= need) return { x: z.x0 - 6, align: 'right', where: 'outside' };
    return null;
  }

  var plugin = {
    id: 'provisional',
    beforeDatasetsDraw: function (ch) {
      if (isStacked(ch)) return;                     /* stacked hatch goes on top */
      var z = zone(ch); if (!z) return;
      var ctx = ch.ctx; ctx.save();
      ctx.fillStyle = hatch(ctx, 'flat');
      ctx.fillRect(z.x0, z.area.top, z.x1 - z.x0, z.area.bottom - z.area.top);
      ctx.restore();
    },
    afterDatasetsDraw: function (ch) {
      var z = zone(ch); if (!z) return;
      var ctx = ch.ctx, st = isStacked(ch);
      var w = z.x1 - z.x0, h = z.area.bottom - z.area.top;
      ctx.save();

      /* 1. zone texture — over the fills, and ONLY on stacked charts. No wash, no
       *    tint, no scrim: ink laid over the data, never a transform applied to it. */
      if (st) {
        ctx.fillStyle = hatch(ctx, 'stacked');
        ctx.fillRect(z.x0, z.area.top, w, h);
      }

      /* 2. boundary rule, and on stacked charts the open right edge — the stacked
       *    stand-in for the line family's hollow terminal point. */
      ctx.strokeStyle = STYLE.rule; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(z.x0 + 0.5, z.area.top); ctx.lineTo(z.x0 + 0.5, z.area.bottom); ctx.stroke();
      if (st) {
        ctx.beginPath(); ctx.moveTo(z.x1 - 0.5, z.area.top); ctx.lineTo(z.x1 - 0.5, z.area.bottom); ctx.stroke();
      }
      ctx.setLineDash([]);

      /* 3. the gutter bar — the ONE channel identical on every chart family, and the
       *    only one drawn OUTSIDE the plot area, where nothing it sits on is data.
       *    Needs scales.x.ticks.padding >= 6 on the chart config, or it touches the
       *    tick labels (spec §3.6 / §6.9). */
      ctx.fillStyle = STYLE.gutter;
      ctx.fillRect(z.x0, z.area.bottom + STYLE.gutterGap, w, STYLE.gutterH);

      /* 4. the label, haloed so it is legible over a #212123 fill, a pale fill or the
       *    page ground alike, and placed outside the zone when it will not fit in. */
      ctx.font = STYLE.labelFont;
      var tw = (ctx.measureText(STYLE.label) || { width: 55 }).width || 55;
      var pl = labelPlacement(z, tw);
      if (pl) {
        ctx.textAlign = pl.align; ctx.textBaseline = 'alphabetic';
        ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
        ctx.strokeStyle = STYLE.labelHalo;
        ctx.strokeText(STYLE.label, pl.x, z.area.top + STYLE.labelTop);
        ctx.fillStyle = STYLE.labelInk;
        ctx.fillText(STYLE.label, pl.x, z.area.top + STYLE.labelTop);
      }
      ctx.restore();
    }
  };

  /* ── 6a. SVG helpers, for chartToSVG in shared.js ───────────────────────────
   * chartToSVG re-emits geometry by hand and runs no Chart.js plugins, so the export
   * has to build the same marks from the same numbers. These read TILES and STYLE so
   * the canvas and the SVG cannot drift (spec §6.12, §8.2).
   */
  function svgPatternId(kind) { return 'lionsProvHatch-' + kind; }
  function svgPattern(kind) {
    var t = TILES[kind] || TILES.flat, S = t.size, paths = '';
    t.lines.forEach(function (ln, k) {
      var o = k * S / t.lines.length;
      paths += '<path d="M' + (o - 1) + ',1 L' + (o + 1) + ',-1 M' + o + ',' + S + ' L' + (o + S) + ',0'
             + ' M' + (o - S) + ',' + (S + S) + ' L' + o + ',' + S + '"'
             + ' stroke="' + rgba(ln) + '" stroke-width="1" fill="none"/>';
    });
    return '<pattern id="' + svgPatternId(kind) + '" patternUnits="userSpaceOnUse" width="' + S
         + '" height="' + S + '">' + paths + '</pattern>';
  }

  /* ── 7. Copy. One wording, everywhere. ──────────────────────────────────────
   * d: 'up' (understated, will rise) | 'down' (net stock, overstated, will fall)
   *    | 'mix' (100%-stacked share: under-reporting distorts the MIX, because
   *             categories mature at very different rates — it does not simply
   *             make the edge lower).
   */
  function phrase(nMonths, d) {
    if (d === 'down') return 'the most recent ' + nMonths + ' months are still being reported; these figures are overstated and will fall';
    if (d === 'mix')  return 'the most recent ' + nMonths + ' months are still being reported; the mix is distorted, not just low';
    return 'the most recent ' + nMonths + ' months are still being reported; these figures will rise';
  }
  function legendChip(nMonths, d) {
    return '<span class="lg" style="color:var(--mut)">' +
      '<span class="sw sw-prov"></span>Provisional — ' + phrase(nMonths, d) + '</span>';
  }
  function noteText(nMonths, d) { return 'Provisional: ' + phrase(nMonths, d) + '.'; }
  function tooltipLine() { return 'Provisional — incomplete reporting'; }
  /* Table marker. Colour alone is a WCAG 1.4.1 failure, so provisional rows also
     carry a glyph with a title attribute. */
  function tableMark() {
    return '<span class="provmark" title="Provisional — incomplete reporting">†</span>';
  }

  global.LIONS_PROV = {
    WINDOWS: WINDOWS, FAMILY: FAMILY, FADE_ALPHA: FADE_ALPHA, TILES: TILES, STYLE: STYLE,
    family: family, n: n, nMax: nMax, dir: dir, dirAll: dirAll,
    cutIndex: cutIndex, monthFlags: monthFlags, bucketFlags: bucketFlags,
    firstIdx: firstIdx, anyProv: anyProv,
    fade: fade, hatch: hatch, decorateLine: decorateLine,
    meanShift: meanShift, localContrast: localContrast,
    worstMeanShift: worstMeanShift, worstLocalContrast: worstLocalContrast,
    plugin: plugin, zone: zone, isStacked: isStacked, labelPlacement: labelPlacement,
    svgPattern: svgPattern, svgPatternId: svgPatternId,
    phrase: phrase, legendChip: legendChip, noteText: noteText,
    tooltipLine: tooltipLine, tableMark: tableMark
  };
})(typeof window !== 'undefined' ? window : globalThis);
