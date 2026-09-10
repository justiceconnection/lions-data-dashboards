/* LIONS - "Reading the data": the content module behind web/reading-the-data.html.
 *
 * ONE source for all 26 entries. Loaded by that page and by NOTHING else - the four
 * dashboards and Case Look-Up get their link and their marker targets from
 * `shared/config.js`'s REFERENCES, which they already load, so nothing here is on any
 * dashboard's load chain (invariant 9).
 *
 * NOTHING IS FETCHED AT PAGE LOAD except one range request. Every entry declares the
 * national cubes it needs; an entry that needs none renders instantly, an entry that needs
 * one fetches it on first open and every later entry that needs the same cube renders
 * immediately. See ENTRY_CUBES.
 *
 * Templating, deliberately tiny so a check can reason about it:
 *   {{key}}      a figure. Must sit inside a [[ ]] clause.
 *   [[ ... ]]    a droppable clause. Dropped whole if any figure inside is absent.
 * Anything outside a clause is standing prose and must read as a complete sentence with
 * no numbers in it. tests/docs-check.js asserts that, and asserts that no live value is
 * written into a copy string.
 *
 * D-042: no em dashes anywhere in this file, including in user-facing copy.
 *
 * Spec: ops/handoffs/L-144-design-spec.md (revision C, copy and placement signed by Cary
 * 4 September 2026). Do not edit a copy string without moving DOC_REVISED and the hash.
 */
(function () {
  "use strict";

  /* ── the stamp. Covers WORDING only. ─────────────────────────────────────
     PROSE_SHA is a hash over every copy string below, normalised. tests/docs-check.js
     recomputes it; a prose edit that does not touch this line goes red. It cannot
     force REVISED to be right - it can only make a silent prose edit impossible.  */
  var REVISED   = '2026-09-04';
  var PROSE_SHA = '66601e76';   /* filled by design-lab/l144-prose-sha.js */

  /* ── surfaces ─────────────────────────────────────────────────────────── */
  var SURFACES = {
    index:        'Criminal Cases',
    civil:        'Civil Matters and Cases',
    agency:       'Cases by Referring Agency',
    declinations: 'Criminal Matter Declinations',
    lookup:       'Case Look-Up'
  };

  /* ── supplied data ────────────────────────────────────────────────────── */
  var DATA = {};                       /* cubeName -> rows */
  function has(n) { return !!DATA[n]; }
  function rows(n) { return DATA[n] || []; }

  /* ── helpers ──────────────────────────────────────────────────────────── */
  function num(r, k) { var v = +r[k]; return isFinite(v) ? v : 0; }
  function edge(n) { var m = ''; rows(n).forEach(function (r) { if (r.ym > m) m = r.ym; }); return m; }
  function lastFullFY(n) {            /* largest Y whose 30 Sep is at or before the edge */
    var e = edge(n); if (!e) return null;
    var y = +e.slice(0, 4); return (e.slice(5) >= '09') ? y : y - 1;
  }
  function fyWin(y) { return [(y - 1) + '-10', y + '-09']; }
  function inWin(ym, w) { return !w || (ym >= w[0] && ym <= w[1]); }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function pct(x, dp) { return (x * 100).toFixed(dp == null ? 1 : dp) + '%'; }
  function over(ratio) { return ((ratio - 1) * 100).toFixed(1) + '%'; }

  /* ── QUOTED figures. Tier B = printed elsewhere. Tier C = measured by us. ──
     Every one carries the exact source string that must appear in the same entry. */
  var DOJ_FY25 = 'United States Attorneys’ Annual Statistical Report, Fiscal Year 2025, ' +
                 'Executive Office for United States Attorneys, retrieved 3 September 2026.';
  var DOJ_5YR  = 'Five editions of the United States Attorneys’ Annual Statistical Report, ' +
                 'fiscal years 2021 to 2025, Table 4, "United States Attorneys’ Offices’ Civil ' +
                 'Caseload", printed pages 17 to 19, each as of 30 September. All five retrieved ' +
                 '3 September 2026.';
  var DOJ_T5_CITE = 'Five editions of the United States Attorneys’ Annual Statistical Report, ' +
                 'fiscal years 2021 to 2025, Table 5, "Civil Matters and Cases by Cause of Action", ' +
                 'printed pages 20 and 21, each as of 30 September. All five retrieved 3 September 2026.';
  var OURS_JUL = 'Measured on this site’s July 2026 data.';

  var QUOTED = {
    doj_3b_cases: { v: '63,954',  src: DOJ_FY25 },
    doj_3b_defs:  { v: '76,409',  src: DOJ_FY25 },
    cl_fy_cases:  { v: '101,284', src: OURS_JUL },
    decl_old_all: { v: '658,958', src: OURS_JUL },
    decl_old_fy:  { v: '25,855',  src: OURS_JUL },
    dev_lo:       { v: '2.9',     src: OURS_JUL },
    dev_hi:       { v: '5.4',     src: OURS_JUL },
    rev_22mo:     { v: '0.5%',    src: OURS_JUL },
    rev_34mo:     { v: '0.2%',    src: OURS_JUL },
    cl_imputed:   { v: '2%',      src: OURS_JUL },
    cl_mag_dc:    { v: '58,379',  src: OURS_JUL },
    doj_gap_lo:   { v: '3.5%',    src: DOJ_5YR },
    doj_gap_hi:   { v: '7.6%',    src: DOJ_5YR },
    /* L-047, Cary's ruling of 3 September 2026 */
    mag_excl:     { v: '23,283',    src: OURS_JUL },
    mag_1325:     { v: '15,117',    src: OURS_JUL },
    no_dc_n:      { v: '2,687,790', src: OURS_JUL },
    no_dc_d:      { v: '4,461,215', src: OURS_JUL },
    no_dc_pct:    { v: '60.2%',     src: OURS_JUL },
    /* the received-date entry, both halves quoted from ONE measurement: a rebuild
       moves a live denominator and not a quoted numerator, so they are never mixed */
    pend_imp_n:   { v: '225,697',   src: OURS_JUL },
    pend_imp_pct: { v: '7.79%',     src: OURS_JUL },
    pend_sep_n:   { v: '21,765',    src: OURS_JUL },
    pend_sep_d:   { v: '105,463',   src: OURS_JUL }
  };

  /* ── LIVE figures. Each names the cube it needs; absent cube, absent figure. ── */
  var LIVE = {
    crim_fy: { needs: 'lions_cube', fn: function () { return lastFullFY('lions_cube'); } },

    crim_fy_cases: { needs: 'lions_cube', fn: function () {
      var w = fyWin(lastFullFY('lions_cube')), t = 0;
      rows('lions_cube').forEach(function (r) {
        if (r.grp === 'ALL' && r.subcat === 'ALL' && r.occ === 'all' && inWin(r.ym, w)) t += num(r, 'cases_filed');
      });
      return fmt(t);
    } },

    crim_fy_defs: { needs: 'lions_cube', fn: function () {
      var w = fyWin(lastFullFY('lions_cube')), t = 0;
      rows('lions_cube').forEach(function (r) {
        if (r.grp === 'ALL' && r.subcat === 'ALL' && r.occ === 'all' && inWin(r.ym, w)) t += num(r, 'defendants_filed');
      });
      return fmt(t);
    } },

    crim_case_pct: { needs: 'lions_cube', fn: function () {
      return pct(rawCrim('cases_filed') / 63954);
    } },
    crim_def_pct: { needs: 'lions_cube', fn: function () {
      return pct(rawCrim('defendants_filed') / 76409);
    } },

    /* over-count: numerator is a SUM OF PARTS, denominator is the cube's own total row
       grp='ALL' AND subcat='ALL'. That row exists only at occ='all' (382 rows, verified
       3 Sep 2026), which is why occ is pinned here and not taken from the page. */
    oc_umb_all_parts: { needs: 'lions_cube', fn: function () { return fmt(oc(null, 'umb', 'cases_filed').parts); } },
    oc_umb_all_total: { needs: 'lions_cube', fn: function () { return fmt(oc(null, 'umb', 'cases_filed').total); } },
    oc_umb_all_pct:   { needs: 'lions_cube', fn: function () { return over(oc(null, 'umb', 'cases_filed').ratio); } },
    oc_umb_fy_pct:    { needs: 'lions_cube', fn: function () { return over(oc('fy', 'umb', 'cases_filed').ratio); } },
    oc_spec_all_pct:  { needs: 'lions_cube', fn: function () { return over(oc(null, 'spec', 'cases_filed').ratio); } },
    oc_spec_fy_pct:   { needs: 'lions_cube', fn: function () { return over(oc('fy', 'spec', 'cases_filed').ratio); } },

    decl_all: { needs: 'decl_cat_cube', fn: function () {
      var t = 0; rows('decl_cat_cube').forEach(function (r) { if (r.category === 'ALL') t += num(r, 'declined'); });
      return fmt(t);
    } },
    decl_fy: { needs: 'decl_cat_cube', fn: function () {
      var w = fyWin(lastFullFY('decl_cat_cube')), t = 0;
      rows('decl_cat_cube').forEach(function (r) { if (r.category === 'ALL' && inWin(r.ym, w)) t += num(r, 'declined'); });
      return fmt(t);
    } },
    decl_fy_year:  { needs: 'decl_cat_cube', fn: function () { return lastFullFY('decl_cat_cube'); } },
    decl_reasons:  { needs: 'decl_cat_cube', fn: function () {
      var s = {}; rows('decl_cat_cube').forEach(function (r) { s[r.reason] = 1; });
      return String(Object.keys(s).length);
    } },

    civ_causes: { needs: 'civil_cube', fn: function () {
      var s = {}; rows('civil_cube').forEach(function (r) { if (r.category !== 'ALL') s[r.category] = 1; });
      return String(Object.keys(s).length);
    } },

    ag_all_pct: { needs: 'agency_cube', fn: function () {
      var tot = 0, parts = 0;
      rows('agency_cube').forEach(function (r) {
        var isAll = r.department === 'ALL' && r.subagency === 'ALL';
        if (isAll && r.occ === 'lead') tot += num(r, 'cases_filed');
        if (!isAll && r.occ === 'all') parts += num(r, 'cases_filed');
      });
      return tot ? over(parts / tot) : null;
    } },

    ag_fy_cases: { needs: 'agency_cube', fn: function () {
      var w = fyWin(lastFullFY('agency_cube')), t = 0;
      rows('agency_cube').forEach(function (r) {
        if (r.department === 'ALL' && r.subagency === 'ALL' && r.occ === 'lead' && inWin(r.ym, w)) t += num(r, 'cases_filed');
      });
      return fmt(t);
    } },

    ca_min_pct: { needs: 'civil_agency_cube+civil_cube', fn: function () { var r = caRange(); return r && (r.lo).toFixed(2) + '%'; } },
    ca_max_pct: { needs: 'civil_agency_cube+civil_cube', fn: function () { var r = caRange(); return r && (r.hi).toFixed(2) + '%'; } }
  };

  function rawCrim(metric) {
    var w = fyWin(lastFullFY('lions_cube')), t = 0;
    rows('lions_cube').forEach(function (r) {
      if (r.grp === 'ALL' && r.subcat === 'ALL' && r.occ === 'all' && inWin(r.ym, w)) t += num(r, metric);
    });
    return t;
  }
  function oc(win, mode, metric) {
    var w = win === 'fy' ? fyWin(lastFullFY('lions_cube')) : null, total = 0, parts = 0;
    rows('lions_cube').forEach(function (r) {
      if (r.occ !== 'all' || !inWin(r.ym, w)) return;
      if (r.grp === 'ALL' && r.subcat === 'ALL') { total += num(r, metric); return; }
      if (r.grp === 'ALL') return;
      if (mode === 'umb' ? r.subcat === 'ALL' : r.subcat !== 'ALL') parts += num(r, metric);
    });
    return { parts: parts, total: total, ratio: total ? parts / total : 0 };
  }
  var CA_COLS = ['matters_received', 'cases_filed', 'matters_terminated', 'cases_terminated',
                 'd_judg_us', 'd_settle', 'd_against', 'd_dismissed', 'd_other'];
  function caRange() {
    if (!has('civil_agency_cube') || !has('civil_cube')) return null;
    var a = {}, b = {}, out = [];
    rows('civil_agency_cube').forEach(function (r) {
      if (r.department !== 'ALL' || r.subagency !== 'ALL') return;
      CA_COLS.forEach(function (c) { var k = r.role + '|' + c; a[k] = (a[k] || 0) + num(r, c); });
    });
    rows('civil_cube').forEach(function (r) {
      if (r.category !== 'ALL') return;
      CA_COLS.forEach(function (c) { var k = r.role + '|' + c; b[k] = (b[k] || 0) + num(r, c); });
    });
    Object.keys(a).forEach(function (k) { if (b[k]) out.push(100 * (a[k] / b[k] - 1)); });
    if (!out.length) return null;
    out.sort(function (x, y) { return x - y; });
    return { lo: out[0], hi: out[out.length - 1] };
  }

  /* ── the five-year civil flow table, computed live against printed DOJ figures ── */
  var DOJ_T4 = { 2021: [62789, 65931], 2022: [57313, 63419], 2023: [69588, 65224],
                 2024: [81763, 72272], 2025: [82261, 67578] };
  function civFlowTable() {
    if (!has('civil_cube')) return null;
    var out = [];
    Object.keys(DOJ_T4).sort().forEach(function (y) {
      var w = fyWin(+y);
      if (w[1] > edge('civil_cube')) return;                 /* never show a year the data has not reached */
      var f = 0, t = 0;
      rows('civil_cube').forEach(function (r) {
        if (r.category !== 'ALL' || !inWin(r.ym, w)) return;
        f += num(r, 'cases_filed'); t += num(r, 'cases_terminated');
      });
      out.push({ fy: +y, ourF: f, dojF: DOJ_T4[y][0], ourT: t, dojT: DOJ_T4[y][1] });
    });
    return out.length ? out : null;
  }

  /* ── the "filed" decomposition. Quoted whole; every row is a measurement. ── */
  var FILED_STEPS = [
    ['Prosecutions handled only in a magistrate court, with no district court record at all', '-23,283'],
    ['Proceedings that happen after a case has been decided', '-14,076'],
    ['Cases whose district court filing falls after the fiscal year ends', '-3,600'],
    ['Cases with a district court record but no usable filing date', '-1,442'],
    ['Cases first filed in another kind of court', '-504'],
    ['Cases brought back in at the start of the fiscal year', '+3,292']
  ];

  /* ══════════════════════════════════════════════════════════════════════════
     THE COPY. Everything a user can read is in this block and nowhere else.
     ══════════════════════════════════════════════════════════════════════════ */
  var HEAD = {
    button:  'Reading the data',
    title:   'Reading the data: what could make a number on this site mean something else',
    stand:   'These notes set out every reason we know of that a figure on this site could be read to mean something it does not. They cover all five dashboards. Each note says which of them it affects, and you can narrow the list below.',
    scope:   'The figures in these notes are always for the whole country and every category, whatever you had selected on the dashboard you came from.',
    where:   'Each dashboard also carries a User guide, for how to work its controls, and an About this data note at the foot of the page, for where the data comes from and who publishes it.',
    expand:  'Expand all',
    collapse: 'Collapse all',
    stamp:   'Wording last reviewed ',
    stamp2:  'Counts drawn from this site’s own data are worked out afresh when you open the note that uses them. Any figure quoted from somewhere else carries its source and its date in the same note.',
    applies: 'Applies to: ',
    /* the surface filter */
    filterLbl: 'Show notes that affect',
    filterAll: 'Every dashboard',
    filterCount: function (n, t, name) { return 'Showing ' + n + ' of ' + t + ' notes, the ones that affect ' + name + '.'; },
    filterClear: 'Show all ' ,
    /* lazy figure loading */
    figLoading: 'working out the figures',
    /* returning to where you came from */
    backTo:  'Back to ',
    backGeneric: 'Back',
    /* a citation that no longer resolves */
    retired: function (id) { return 'The note you followed a link to has been retired and is no longer on this page. Nothing else has moved. The reference was ' + id + '.'; }
  };

  var GROUPS = [
  { id: 'g1', title: 'What these figures count', entries: [

    { id: 'e-dc-only', surfaces: ['index', 'agency'],
      title: 'The Criminal Cases dashboard counts filings in United States District Court and nothing else',
      body: [
        'A criminal case reaches this dashboard only if it has a recorded filing date in a United States District Court. Prosecutions handled entirely in a magistrate court are not late and not mis-dated. They are absent from every month of every chart.',
        '[[In fiscal year {{crim_fy}} that leaves out {{mag_excl}} prosecutions, of which {{mag_1325}} are illegal entry cases under 8 U.S.C. 1325(a)(1). They are concentrated in the southern and western districts of Texas, in Arizona and in New Mexico, so those four districts are affected far more than the rest.]]',
        '[[Across the whole record it is larger still: {{no_dc_n}} of {{no_dc_d}} criminal case records, {{no_dc_pct}}, have no United States District Court filing and appear in no month of this dashboard at all.]]',
        'Declined matters and matters that never went to court are not here either. Declined matters have their own dashboard.',
        'This is a deliberate choice and the reason is worth knowing, because the alternative would give a larger number. Counting only district court filings is what makes this dashboard comparable with the figures DOJ itself publishes. [[It comes to {{crim_case_pct}} of DOJ’s published count of criminal cases filed and {{crim_def_pct}} of its published defendants.]] The wider count, taking in magistrate court prosecutions, matches no published DOJ table at all, so there would be nothing to check it against.',
        'Do not describe a chart built on this data as covering all federal criminal prosecutions.',
        '[[In fiscal year {{crim_fy}} this dashboard counts {{crim_fy_cases}} criminal cases filed and {{crim_fy_defs}} defendants.]]',
        { src: OURS_JUL + ' The two percentages in this entry are worked out live and are shown with DOJ’s own figures in the entry on DOJ’s published table.' }
      ] },

    { id: 'e-filed-two', surfaces: ['index', 'lookup'],
      title: 'The word "filed" means one thing on the dashboards and a wider thing in Case Look-Up',
      body: [
        'The Criminal Cases dashboard and Case Look-Up answer different questions with the same word, and Case Look-Up always returns the larger number. Neither is wrong about the question it answers.',
        'The dashboard dates a case by its earliest filing in a United States District Court, across cases that reached that court. Case Look-Up dates a case by its earliest filing in any real court, across every record with a real court proceeding, which brings in magistrate court prosecutions and proceedings that happen after a case has been decided.',
        '[[Asked for criminal cases filed in fiscal year {{crim_fy}}, the dashboard answers {{crim_fy_cases}} and Case Look-Up answers {{cl_fy_cases}}.]]',
        { table: 'filed-steps' },
        'Because the two count different populations, a Case Look-Up search is not the detail behind a dashboard figure and the two will not reconcile. The fiscal year boundary alone moves a few thousand cases in each direction.',
        { src: OURS_JUL + ' The steps above are a full reconciliation with nothing left over.' }
      ] },

    { id: 'e-matter-case', surfaces: ['civil', 'agency'],
      title: 'A civil matter and a civil case are two stages of the same work, not two words for it',
      body: [
        'DOJ’s own definition, printed in its annual report, is that matters are proceedings not yet in court. This site splits them on exactly that: a civil record counts as a matter until a court appears on it and as a case afterwards.',
        'So the two are not alternatives and they must not be added together. The same piece of work can be counted as a matter received in one month and as a case filed in a later one.',
        { src: DOJ_FY25 + ' Table 5, footnote 1.' }
      ] },

    { id: 'e-decl-def', surfaces: ['declinations', 'lookup'],
      title: 'What counts as a declined matter changed on 2 September 2026, and every figure on the declinations dashboard moved with it',
      body: [
        'Until that date this site counted only matters recorded with a later declination. It now also counts immediate declinations, which is what DOJ’s own table title covers, and it leaves out any matter that reached a real court.',
        'The effect is not even across time. Older years grew far more than recent ones, so the shape of the series changed as well as its level: it now falls across the three decades where before it read as broadly flat.',
        '[[The all time total went from {{decl_old_all}} to {{decl_all}}. The figure for fiscal year {{decl_fy_year}} went from {{decl_old_fy}} to {{decl_fy}}.]]',
        'Whether that fall reflects a change in prosecution practice or a change in how declinations were recorded has not been established, and nobody has looked.',
        'A chart or a figure taken from this dashboard before 2 September 2026 is not comparable with what is here now.',
        'The reason categories are a scheme introduced after fiscal year 2014. Figures before then are approximate.',
        { src: OURS_JUL + ' The two earlier figures are the totals this site published until 2 September 2026.' }
      ] },

    { id: 'e-usao-only', surfaces: ['index', 'civil', 'agency', 'declinations', 'lookup'],
      title: 'This is the work of United States Attorneys’ offices only',
      body: [
        'LIONS is the case management system used by the United States Attorneys’ offices. Work handled by other parts of the Department of Justice is not in it. Inquiries a U.S. Attorney’s office judged obviously trivial were never logged at all.',
        'The data carries 93 district codes. DOJ names 94 offices. The difference has never been reconciled and we do not know what causes it.',
        'Most of what is recorded is entered when a case is taken in and screened. Anything after that is added as the matter moves along, which is why the recent months are the thin ones.',
        { src: OURS_JUL + ' The count of 93 is the number of district codes present in the published data.' }
      ] }
  ] },

  { id: 'g2', title: 'How these figures compare with DOJ’s published reports', entries: [

    { id: 'e-doj-3b', surfaces: ['index'],
      title: 'Criminal cases and defendants filed, against DOJ’s published table',
      body: [
        'DOJ publishes a comparable count once a year. This dashboard does not reproduce it exactly.',
        '[[For fiscal year {{crim_fy}} this dashboard counts {{crim_fy_cases}} criminal cases filed against the {{doj_3b_cases}} DOJ prints, which is {{crim_case_pct}} of DOJ’s figure. On defendants it counts {{crim_fy_defs}} against DOJ’s {{doj_3b_defs}}, which is {{crim_def_pct}}.]]',
        'That is one year. One table for one year has been read, so nothing here shows whether the relationship holds in any other year. Do not treat either percentage as a correction to apply elsewhere.',
        { src: DOJ_FY25 + ' Table 3B.' }
      ] },

    { id: 'e-doj-t4', surfaces: ['civil', 'agency'],
      title: 'Civil cases filed and terminated, against DOJ’s published civil caseload',
      body: [
        'DOJ publishes the civil caseload once a year. Compared against its five annual reports for fiscal years 2021 to 2025, this site’s counts differ from DOJ’s in every one of the five years, on both counts.',
        { table: 'civ-flow' },
        'The reason has not been identified, and the difference is not the same size in each year, so it is not a fixed amount that can be added to or taken off. Part of it is that our most recent years are still being reported and will move; that cannot be the whole of it, because the oldest years here have long since settled and still differ.',
        { src: DOJ_5YR }
      ] },

    { id: 'e-doj-t5-cases', surfaces: ['civil', 'agency'], needsColumn: 'cases_pending',
      title: 'Civil cases pending, against DOJ’s published figures',
      body: [
        'This count differs from the figure DOJ publishes, and the direction is not the same for every role or in every year.',
        'Cases pending here is a count, taken at the end of each month, of the civil cases that had a court record by that date and no recorded ending. It is not a running balance of arrivals minus departures, and it uses nothing that happened after the date it is counting.',
        { table: 'pending-cases' },
        'Our own count for a past date does not stand still. Later data keeps arriving and a counted caseload keeps falling as it does, which is why the two most recent years read higher than they eventually will. That accounts for part of the difference in the recent years and not all of it, and for cases where the United States is the plaintiff it accounts for almost none. We cannot say why.',
        'There is no single figure for the difference and none is given here. Do not take a percentage from one row and apply it to another.',
        'The figures above are read from the breakdown this page uses. The Civil dashboard and the Referring Agency dashboard hold the civil caseload in two separate files, and on pending they do not always agree, so the same entry can show slightly different numbers on those two pages.',
        'The date a case joins this count is not always the date it reached court. See the entry on that, above.',
        { src: DOJ_T5_CITE }
      ] },

    { id: 'e-pending-entry-date', surfaces: ['civil', 'agency'], needsColumn: 'cases_pending',
      title: 'The date a civil case joins the pending count is not always the date it reached court',
      body: [
        'A civil case joins this count on the earliest filing date recorded against one of its court records. Where a case has court records but none of them carries a filing date, it joins on the date the matter was received instead.',
        '[[That is {{pend_imp_n}} civil cases, {{pend_imp_pct}} of them. At the end of September 2025 it was {{pend_sep_n}} of the {{pend_sep_d}} cases counted as pending, close to a fifth.]]',
        'A matter is usually received before it reaches court, so those cases join the count earlier than they otherwise would, and every month in between is counted one higher. It is not one wrong cell in a table; it moves the level of a run of months.',
        'The same substitution is visible in Case Look-Up, in its Filed column. This is a limitation of how the underlying records are read, not of the records themselves.',
        { src: OURS_JUL }
      ] },

    { id: 'e-doj-t5-matters', surfaces: ['civil', 'agency'], needsColumn: 'matters_pending',
      title: 'Civil matters pending, against DOJ’s published figures',
      body: [
        'This count differs from the figure DOJ publishes, by more than the cases count does, and the direction is not the same for every role or in every year.',
        'Matters pending here is a count, taken at the end of each month, of the civil matters that had been received, had not reached court, and had no recorded closure.',
        { table: 'pending-matters' },
        'Do not read the level in any single month as a count of the matters actually pending.',
        'There is no single figure for the difference and none is given here.',
        { src: DOJ_T5_CITE }
      ] },

    { id: 'e-two-crim', surfaces: ['index', 'agency'],
      title: 'The two criminal dashboards do not give quite the same total',
      body: [
        'The Criminal Cases dashboard and the Referring Agency dashboard are built from the same records by two different builds, and their criminal totals differ by a handful of cases.',
        '[[For fiscal year {{crim_fy}} the Referring Agency dashboard counts {{ag_fy_cases}} criminal cases filed.]]',
        'The cause has not been established. The difference is small enough that it will not change any reading of a trend, and large enough that two figures quoted side by side will not match.'
      ] }
  ] },

  { id: 'g3', title: 'Why the most recent months are not final', entries: [

    { id: 'e-provisional', surfaces: ['index', 'civil', 'agency', 'declinations', 'lookup'],
      title: 'The newest months are always incomplete, by an amount that is not steady',
      body: [
        'Every month of this data is re-reported more completely in later updates. The most recent months on any chart are the least complete, and they are marked on the chart, in the table and in the download.',
        'The size of what is missing is not a constant and cannot be corrected for. Between the May and June 2026 updates the newest month of criminal terminations grew by a factor of 2.9. Between the June and July 2026 updates the same measurement gave 5.4. Each of those measures one step of re-reporting, not the distance to a final figure.',
        'A fall at the right hand edge of a chart is not evidence that anything fell.',
        { src: OURS_JUL + ' The two factors are measured between named pairs of monthly updates and are not a completion multiplier.' }
      ] },

    { id: 'e-not-final', surfaces: ['index', 'civil', 'agency', 'declinations'],
      title: 'Marked provisional is not the same as unmarked and final',
      body: [
        'The shaded band marks the months that are materially incomplete. How wide it is depends on the metric: three months for criminal filings, four for civil filings, and six for anything to do with terminations, dispositions, declinations or a pending stock.',
        'Outside that band the figures still move, by smaller and smaller amounts, for years. The counted civil caseload still moved by about 0.5% over two months at nearly two years of age, and about 0.2% at nearly three years.',
        'The direction differs by what is being counted. A flow, such as cases filed, is understated at the edge and will rise. A stock, such as cases pending, is overstated at the edge and will fall, because endings are reported later than beginnings.',
        { src: OURS_JUL }
      ] },

    { id: 'e-revision', surfaces: ['index', 'civil', 'agency', 'declinations', 'lookup'],
      title: 'A figure you took from this site last month may not be the same figure this month',
      body: [
        'Each monthly update is not new rows added to the end. It is the same history reported more completely, so a figure for a month years in the past can still change.',
        'If you quote a figure from this site, quote the date you took it.'
      ] }
  ] },

  { id: 'g4', title: 'How the parts add up', entries: [

    { id: 'e-cat-overlap', surfaces: ['index'],
      title: 'Criminal program categories overlap, so adding them up over-counts',
      body: [
        'A criminal case can carry several program category codes and is counted under every one of them. The categories therefore do not add up to the total, by design. The total is a separate row in the data and that is what the "All categories" figure reads.',
        '[[Over the whole period, adding the umbrella categories together gives {{oc_umb_all_parts}} criminal cases filed against a true total of {{oc_umb_all_total}}, which is {{oc_umb_all_pct}} too many. Within fiscal year {{crim_fy}} the same sum is {{oc_umb_fy_pct}} too many. Expanding every umbrella and adding all of the specific categories instead gives {{oc_spec_all_pct}} too many over the whole period and {{oc_spec_fy_pct}} within fiscal year {{crim_fy}}.]]',
        'There is no single figure for this. It depends on the period you have chosen, on whether you are adding umbrellas or specifics, and on whether you are counting cases or defendants.',
        'The "Primary only" setting counts each case once, under its first entered code. That is a different question, not a corrected version of the same one.'
      ] },

    { id: 'e-ag-overlap', surfaces: ['agency'],
      title: 'Referring agencies overlap in the same way, and the two settings behave differently',
      body: [
        'A criminal case can name more than one investigative agency. On the "All agencies" setting it is counted under each of them, so the agencies add up to more than the total.',
        '[[Over the whole period, adding the agencies together on that setting gives {{ag_all_pct}} more criminal cases filed than the true total.]]',
        'On the "Lead agency" setting the agencies add up to the total exactly. The total itself is only recorded on that setting, which is why switching to "All agencies" changes what a total means as well as what the parts sum to.'
      ] },

    { id: 'e-partition', surfaces: ['civil', 'agency', 'declinations'],
      title: 'Civil causes of action and declination reasons do not overlap',
      body: [
        'Every civil record carries one cause of action and every declined matter carries one reason, so on those dashboards the parts do add up to the total exactly.',
        '[[There are {{civ_causes}} civil causes of action.]] [[There are {{decl_reasons}} declination reasons, including an explicit "Other" that is a real category and not a rounding residual.]]',
        'This is not true of the criminal program categories or the criminal referring agencies. Do not carry the assumption from one dashboard to another.'
      ] },

    { id: 'e-two-civil', surfaces: ['civil', 'agency'],
      title: 'The two civil breakdowns do not reach quite the same totals',
      body: [
        'The Civil dashboard breaks the civil caseload down by cause of action. The Referring Agency dashboard breaks the same caseload down by federal client agency. The two are built as separate files and they do not arrive at identical totals.',
        '[[Over the whole period the client agency totals run between {{ca_min_pct}} and {{ca_max_pct}} above the cause of action totals, depending on the United States role and on which count you take. The widest gaps are on matters terminated.]]',
        'The cause has not been established. Within each dashboard the parts do add up to that dashboard’s own total, so this is a difference between the two files and not a difference between a total and its parts.',
        'If you have a figure from each of those two dashboards for the same thing, expect them to be close rather than equal, and say which one you took.'
      ] },

    { id: 'e-zero-months', surfaces: ['civil', 'agency'],
      title: 'A month with no bar or no point is a month with none, not a month with no data',
      body: [
        'Narrow the selection far enough, to one district and one cause of action and one role, and some months will have nothing in them at all. Those months are counted as zero, and the chart draws them as zero.',
        'This matters most on a pending count, where a series can fall to zero, stay there for years, and come back. A line that touches the bottom of the chart and runs along it is telling you the caseload was empty, not that the month is missing.',
        'The months at the right hand edge are the exception, and they are marked. Those are incomplete, not empty.'
      ] },

    { id: 'e-ratio', surfaces: ['index', 'civil', 'agency', 'declinations'],
      title: 'Percentages are worked out from the counts, never averaged',
      body: [
        'When you group by quarter or by fiscal year, a percentage on this site is worked out by adding up the counts for the whole period and then dividing. It is never the average of the monthly percentages. The two give different answers, and the second one weights a quiet month the same as a busy one.'
      ] },

    { id: 'e-selection', surfaces: ['index', 'civil', 'agency', 'declinations'],
      title: 'A table shows the rows you have selected',
      body: [
        'The data table and the CSV download always print every metric as a column, whatever the chart happens to be showing. So a column can carry a caveat that has nothing to do with the chart in front of you.',
        'A total column in a table is the total of the rows you have selected. It is not the total of everything in the data, and it will not match the "all" figure unless you have everything selected.'
      ] }
  ] },

  { id: 'g5', title: 'Case Look-Up', entries: [

    { id: 'e-cl-imputed', surfaces: ['lookup'],
      title: 'The Filed date is sometimes the date the matter was received',
      body: [
        'Where a record reached a real court but has no filing date recorded, Case Look-Up puts the date the matter was received into the Filed column, with nothing to tell you which is which.',
        '[[In the most recent full fiscal year that affects about {{cl_imputed}} of the criminal cases a search returns.]]',
        'This is a limitation of how the search file is built, not of the underlying records.',
        { src: OURS_JUL }
      ] },

    { id: 'e-cl-court', surfaces: ['lookup'],
      title: 'Court type is the first court, not the only one',
      body: [
        'The court type shown is the first court a record reached. A record can show Magistrate Court and still have a United States District Court filing later.',
        '[[In the criminal cases filed in the most recent full fiscal year, most records show Magistrate Court even though {{cl_mag_dc}} of them also have a district court filing.]]',
        'So a search filtered on court type is not a filter on where the case ended up.',
        { src: OURS_JUL }
      ] },

    { id: 'e-cl-disp', surfaces: ['lookup'],
      title: 'The Disposition value "Declination or Referral" does not find declined matters',
      body: [
        'Almost all declined matters never reach a court, and the Disposition column is only recorded for records that did. The value is real and the records that carry it really carry it, but it finds a tiny fraction of the declined matters in the data.',
        'The control that does find them is Declination, set to "Declined matters only". The page says so beside the Disposition filter as well.',
        'Disposition also shows the latest outcome, so a matter that was declined and later prosecuted reads as its later outcome.'
      ] },

    { id: 'e-cl-order', surfaces: ['lookup'],
      title: 'Two columns list their values in an order that can change between updates',
      body: [
        'The agencies column and the special project column list their values in an order that is not fixed. The set of values does not change and no value is added or lost. Only the order can move.',
        'If you are comparing two downloads taken at different times, compare the values and not the text of the cell.'
      ] }
  ] },

  { id: 'g6', title: 'DOJ’s published tables are not consistent with themselves', entries: [

    { id: 'e-doj-identity', surfaces: ['index', 'civil', 'agency'],
      title: 'DOJ’s published tables are not consistent with themselves',
      body: [
        'This is an observation about DOJ’s own reports. It is set out here because anyone comparing this site against those reports should know it is there.',
        '[[In each of the five annual reports for fiscal years 2021 to 2025, the civil caseload table gives a caseload pending at the start of the year, the cases filed, the cases terminated and the caseload pending at the end. The four figures do not agree with one another: the published end of year figure is between {{doj_gap_lo}} and {{doj_gap_hi}} smaller than the other three imply. The criminal tables in the same five reports are inconsistent in the same way. The reports do not say why.]]',
        'Nothing here connects this to anything else in these notes. It is a separate observation. No part of the difference between this site’s figures and DOJ’s published figures is explained by it, and nothing set out here claims that it is.',
        { src: DOJ_5YR }
      ] }
  ] }
  ];
  /* ═══════════════════════════ END OF COPY ═══════════════════════════════ */

  /* ── figure resolution ────────────────────────────────────────────────── */
  function figure(key) {
    if (QUOTED[key]) return { v: QUOTED[key].v, src: QUOTED[key].src, quoted: true };
    var d = LIVE[key];
    if (!d) return null;
    var need = d.needs.split('+');
    for (var i = 0; i < need.length; i++) if (!has(need[i])) return null;
    var v;
    try { v = d.fn(); } catch (e) { return null; }
    if (v === null || v === undefined || v === '' || v === 'NaN') return null;
    return { v: String(v), quoted: false };
  }

  /* ── template ─────────────────────────────────────────────────────────── */
  function renderText(s) {
    var out = '', used = [];
    s.split(/(\[\[[\s\S]*?\]\])/).forEach(function (part) {
      if (part.slice(0, 2) !== '[[') { out += esc(part); return; }
      var inner = part.slice(2, -2), keys = [], ok = true;
      inner.replace(/\{\{(\w+)\}\}/g, function (_, k) { keys.push(k); return ''; });
      var vals = {};
      keys.forEach(function (k) { var f = figure(k); if (!f) ok = false; else { vals[k] = f; } });
      if (!ok) return;                                     /* fail-safe: drop the clause whole */
      out += esc(inner).replace(/\{\{(\w+)\}\}/g, function (_, k) {
        used.push(k);
        return '<span class="doc-fig' + (vals[k].quoted ? ' doc-q' : '') + '">' + esc(vals[k].v) + '</span>';
      });
    });
    return { html: out, used: used };
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ── the pending comparison. DOJ's side is printed and cited. OUR side is read
        live from the cube, never supplied and never written down: the matters
        definition is still open and every one of these figures may move (L-138).
        A row renders only when both halves are available.                         ── */
  var DOJ_T5 = {
    /* metric, fiscal year, role -> DOJ's printed figure, Table 5 Totals rows */
    cases_pending: {
      2021: { Plaintiff: 9563, Defendant: 79847, Other: 7722 },
      2022: { Plaintiff: 8716, Defendant: 70642, Other: 6622 },
      2023: { Plaintiff: 7390, Defendant: 70616, Other: 6814 },
      2024: { Plaintiff: 7004, Defendant: 73778, Other: 6864 },
      2025: { Plaintiff: 7104, Defendant: 83887, Other: 7837 }
    },
    matters_pending: {
      2021: { Plaintiff: 7945, Defendant: 860, Other: 4293 },
      2022: { Plaintiff: 7437, Defendant: 902, Other: 4111 },
      2023: { Plaintiff: 7136, Defendant: 936, Other: 4092 },
      2024: { Plaintiff: 7204, Defendant: 862, Other: 4030 },
      2025: { Plaintiff: 4925, Defendant: 892, Other: 3027 }
    }
  };
  var ROLE_WORDS = { Plaintiff: 'U.S. as plaintiff', Defendant: 'U.S. as defendant',
                     Other: 'all other designations' };
  var METRIC_WORDS = { cases_pending: 'Cases pending', matters_pending: 'Matters pending' };

  /* The pending series live in their OWN cubes, not as a column on civil_cube:
     civil_pending_cube (ym, [district,] category, role, cases_pending) and
     civil_agency_pending_cube. Whichever the page loaded is the one read here.
     matters_pending is not in either cube today (held, L-149), so the matters
     entry cannot render and its copy is kept rather than deleted.

     ZERO SUPPRESSION. These cubes omit zero rows: a missing month inside the
     cube's own spine is a ZERO, not a gap. Reading them row by row would make a
     real zero indistinguishable from an absent one, so every read goes through
     pendingAt(), which reconstructs against the spine. */
  function pendingCube() {
    if (has('civil_pending_cube')) return 'civil_pending_cube';
    if (has('civil_agency_pending_cube')) return 'civil_agency_pending_cube';
    return null;
  }
  function pendingHas(metric) {
    var c = pendingCube(); if (!c) return false;
    var r = rows(c)[0];
    return !!(r && Object.prototype.hasOwnProperty.call(r, metric));
  }
  function isTotalRow(r) {
    return (r.category === 'ALL') || (r.department === 'ALL' && r.subagency === 'ALL');
  }
  /* a value at a month, with the suppression contract applied */
  function pendingAt(metric, ym, role) {
    var c = pendingCube(); if (!c) return null;
    var lo = null, hi = null, v = null;
    rows(c).forEach(function (r) {
      if (r.district !== undefined && r.district !== 'National') return;   /* national grain only */
      if (lo === null || r.ym < lo) lo = r.ym;
      if (hi === null || r.ym > hi) hi = r.ym;
      if (isTotalRow(r) && r.role === role && r.ym === ym) v = num(r, metric);
    });
    if (v !== null) return v;
    if (lo === null || ym < lo || ym > hi) return null;   /* outside the spine: absent, not zero */
    return 0;                                             /* inside the spine: a suppressed zero */
  }
  function pendingRows() {
    var c = pendingCube(); if (!c) return null;
    var e = edge(c), out = [];
    ['cases_pending', 'matters_pending'].forEach(function (m) {
      if (!pendingHas(m)) return;                        /* the release guard, per metric */
      Object.keys(DOJ_T5[m]).sort().forEach(function (y) {
        var asOf = y + '-09';
        if (asOf > e) return;                            /* never a year the data has not reached */
        ['Plaintiff', 'Defendant', 'Other'].forEach(function (role) {
          var ours = pendingAt(m, asOf, role);
          /* a reconstructed zero RENDERS. Hiding a fault is worse than showing an
             absurd number: style guide 5c's fourth outcome, do not guess and do
             not hide. Only a genuinely unavailable figure drops the clause. */
          if (ours === null) return;
          out.push([METRIC_WORDS[m], 'FY' + y, ROLE_WORDS[role], ours, DOJ_T5[m][y][role]]);
        });
      });
    });
    return out.length ? out : null;
  }
  function wrapTable(html, label) {
    if (!html) return '';
    return '<div class="doc-tblwrap" role="region" tabindex="0" aria-label="' + esc(label) + '">' + html + '</div>';
  }
  function table(kind) {
    if (kind === 'filed-steps') {
      return '<table class="doc-tbl"><caption>Where the difference comes from, case by case</caption>' +
        '<thead><tr><th scope="col">Reason</th><th scope="col">Cases</th></tr></thead><tbody>' +
        FILED_STEPS.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td class="n">' + esc(r[1]) + '</td></tr>'; }).join('') +
        '<tr class="tot"><td>Total difference</td><td class="n">-39,613</td></tr></tbody></table>';
    }
    if (kind === 'civ-flow') {
      var d = civFlowTable(); if (!d) return '';
      return '<table class="doc-tbl"><caption>Civil cases, this site against DOJ’s published table, all districts and all causes</caption>' +
        '<thead><tr><th scope="col">Fiscal year</th><th scope="col">Filed here</th><th scope="col">Filed, DOJ</th>' +
        '<th scope="col">Difference</th><th scope="col">Terminated here</th><th scope="col">Terminated, DOJ</th>' +
        '<th scope="col">Difference</th></tr></thead><tbody>' +
        d.map(function (r) {
          return '<tr><td>' + r.fy + '</td><td class="n">' + fmt(r.ourF) + '</td><td class="n">' + fmt(r.dojF) + '</td>' +
            '<td class="n">' + word(r.ourF / r.dojF) + '</td><td class="n">' + fmt(r.ourT) + '</td>' +
            '<td class="n">' + fmt(r.dojT) + '</td><td class="n">' + word(r.ourT / r.dojT) + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
    if (kind === 'pending-cases' || kind === 'pending-matters') {
      var want = kind === 'pending-cases' ? 'Cases pending' : 'Matters pending';
      var PR = (pendingRows() || []).filter(function (r) { return r[0] === want; });
      if (!PR.length) return '';
      return '<table class="doc-tbl"><caption>' + esc(want) + ', this site against DOJ’s published table, all districts and all causes, each as at 30 September</caption>' +
        '<thead><tr><th scope="col">Fiscal year</th><th scope="col">United States role</th>' +
        '<th scope="col">Here</th><th scope="col">DOJ published</th><th scope="col">Difference</th></tr></thead><tbody>' +
        PR.map(function (r) {
          return '<tr><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td>' +
            '<td class="n">' + fmt(r[3]) + '</td><td class="n">' + fmt(r[4]) + '</td>' +
            '<td class="n">' + word(r[3] / r[4]) + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
    return '';
  }
  /* direction is carried by a WORD, never by a sign or a colour */
  function word(ratio) {
    var d = Math.abs(ratio - 1) * 100;
    if (d < 0.05) return 'the same';
    return d.toFixed(1) + '% ' + (ratio > 1 ? 'above' : 'below');
  }

  /* ── which national cube each entry needs, and nothing more. This IS the lazy
        fetch plan: an entry that needs nothing renders instantly, and an entry that
        needs a cube fetches it on first open and never again in the session.
        Raw / gzipped, measured on the promoted files 4 Sep 2026:
          lions_cube 5.37 / 0.65 · civil_cube 0.79 / 0.19 · agency_cube 1.48 / 0.27
          civil_agency_cube 1.92 / 0.39 · decl_cat_cube 2.06 / 0.17
          civil_pending_cube 0.56 / 0.08 · civil_agency_pending_cube 1.41 / 0.18 MiB
        Nothing is fetched at page load. See the spec, section 6.                   */
  var ENTRY_CUBES = {
    'e-dc-only':            ['lions_cube'],
    'e-filed-two':          ['lions_cube'],
    'e-decl-def':           ['decl_cat_cube'],
    'e-doj-3b':             ['lions_cube'],
    'e-doj-t4':             ['civil_cube'],
    'e-doj-t5-cases':       ['civil_pending_cube'],
    'e-doj-t5-matters':     ['civil_pending_cube'],
    'e-pending-entry-date': [],
    'e-two-crim':           ['lions_cube', 'agency_cube'],
    'e-cat-overlap':        ['lions_cube'],
    'e-ag-overlap':         ['agency_cube'],
    'e-partition':          ['civil_cube', 'decl_cat_cube'],
    'e-two-civil':          ['civil_agency_cube', 'civil_cube']
  };
  var CUBE_BASE = './data/';   /* the page sits at web/ root, beside data/ */
  var inflight = {};
  function fetchCube(name) {
    if (DATA[name]) return Promise.resolve(true);
    if (inflight[name]) return inflight[name];
    inflight[name] = fetch(CUBE_BASE + name + '_national.csv', { cache: 'reload' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (t) { DATA[name] = parseCube(t); return true; })
      .catch(function () { return false; });   /* fail-safe: no clause, no error text */
    return inflight[name];
  }
  function parseCube(t) {
    var L = t.trim().split(/\r?\n/), H = L[0].split(','), out = new Array(L.length - 1);
    for (var i = 1; i < L.length; i++) {
      var c = L[i].split(','), o = {};
      for (var j = 0; j < H.length; j++) { var v = c[j]; o[H[j]] = /^-?\d+$/.test(v) ? +v : v; }
      out[i - 1] = o;
    }
    return out;
  }

  /* ── which metrics carry the inline marker ─────────────────────────────
     The marker rule lives in `shared/config.js` as REFERENCES.flags, NOT here: the four
     dashboards and Case Look-Up render the markers and none of them loads this file, so a
     copy here would be a second source that could drift. tests/docs-check.js asserts that
     every entry id named in REFERENCES.flags is in ENTRY_IDS below, so a marker can never
     point at an anchor this page does not publish.
     The rule itself, for the reader of this file: a metric carries the glyph if, and only
     if, an entry names THAT metric. It is an index into these notes, not a severity
     signal, and no copy may imply that it is.                                          */

  /* ── THE ANCHOR CONTRACT. These ids are published: a marker on a dashboard and a
        citation in someone else's document both point at them, so an id is never
        renamed and never reused. An entry that is retired keeps its id here, in
        RETIRED, and the page tells a reader who follows an old link what happened
        rather than scrolling to nothing. tests/docs-check.js asserts the rendered
        set equals ENTRY_IDS exactly.                                              */
  var ENTRY_IDS = [
    'e-dc-only', 'e-filed-two', 'e-matter-case', 'e-decl-def', 'e-usao-only',
    'e-doj-3b', 'e-doj-t4', 'e-doj-t5-cases', 'e-pending-entry-date', 'e-doj-t5-matters', 'e-two-crim',
    'e-provisional', 'e-not-final', 'e-revision',
    'e-cat-overlap', 'e-ag-overlap', 'e-partition', 'e-two-civil', 'e-zero-months', 'e-ratio', 'e-selection',
    'e-cl-imputed', 'e-cl-court', 'e-cl-disp', 'e-cl-order',
    'e-doj-identity'
  ];
  var RETIRED = [];   /* ids that once existed. Never remove one from this list. */

  /* ── runtime guard: an entry that needs a cube column that is not there ── */
  function columnPresent(col) {
    var r = rows('civil_cube')[0];
    return !!(r && Object.prototype.hasOwnProperty.call(r, col));
  }
  /* ── THE GUARD, and revision C had to change how it is answered ────────────
     A gated entry must not render when the series it describes does not exist.
     On a dashboard the page had already loaded the cube, so the guard was free.
     On a standalone page with lazy fetching the cube is never loaded until an
     entry is opened, so the guard would have answered "absent" forever and the
     entry could never have appeared. Found by running it, not by reading it.

     The question is only "does this cube have this column", so it is answered by
     a RANGE request for the first kilobyte, which is the header line. That is the
     same capability Case Look-Up already depends on for its Parquets. If the host
     ignores the Range header it returns the whole file instead, which is 0.56 MiB
     and still correct, so this degrades to slow rather than to wrong. If the
     request fails outright the column is treated as ABSENT, which is the
     conservative direction: no claim about data we cannot see. */
  var PROBED = {};
  function probeHeader(name) {
    if (PROBED[name]) return PROBED[name];
    PROBED[name] = fetch(CUBE_BASE + name + '_national.csv', { headers: { Range: 'bytes=0-1023' } })
      .then(function (r) { if (!r.ok && r.status !== 206) throw new Error(r.status); return r.text(); })
      .then(function (t) { return t.split(/\r?\n/)[0].split(','); })
      .catch(function () { return []; });
    return PROBED[name];
  }
  function entryLive(e) {
    if (!e.needsColumn) return true;
    if (pendingCube()) return pendingHas(e.needsColumn);   /* cube already in hand */
    return null;                                           /* unknown: resolved by the probe */
  }

  /* ── render: the page, not a panel ───────────────────────────────────────── */
  var MOUNT = null, FILTER = null, XB = null;

  function mountPage(el, opts) {
    opts = opts || {};
    MOUNT = el; el.innerHTML = ''; el.className = 'doc-page';

    var head = document.createElement('div');
    head.className = 'doc-head';
    head.innerHTML =
      '<p class="doc-stand">' + esc(HEAD.stand) + '</p>' +
      '<p class="doc-stand">' + esc(HEAD.scope) + '</p>' +
      '<p class="doc-where">' + esc(HEAD.where) + '</p>';
    el.appendChild(head);

    /* the surface filter. Six chips plus "every dashboard". Client side, hides
       nothing a citation points at: a hash always wins (see applyHash). */
    var bar = document.createElement('div');
    bar.className = 'doc-filter';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', HEAD.filterLbl);
    var chips = [['', HEAD.filterAll]].concat(Object.keys(SURFACES).map(function (k) { return [k, SURFACES[k]]; }));
    bar.innerHTML = '<span class="doc-filter-lbl">' + esc(HEAD.filterLbl) + '</span>' +
      chips.map(function (c) {
        return '<button type="button" class="doc-chip" data-s="' + c[0] + '" aria-pressed="false">' + esc(c[1]) + '</button>';
      }).join('');
    el.appendChild(bar);

    var note = document.createElement('p');
    note.className = 'doc-filter-note'; note.setAttribute('role', 'status');
    el.appendChild(note);

    XB = document.createElement('button');
    XB.type = 'button'; XB.className = 'doc-expand'; XB.textContent = HEAD.expand;
    XB.setAttribute('aria-expanded', 'false');
    el.appendChild(XB);

    var body = document.createElement('div');
    body.className = 'doc-body';
    GROUPS.forEach(function (g) {
      var live = g.entries.filter(function (e) { return entryLive(e) !== false; });
      if (!live.length) return;
      var sec = document.createElement('section');
      sec.className = 'doc-grpsec'; sec.dataset.g = g.id;
      var h = document.createElement('h2'); h.className = 'doc-grp'; h.textContent = g.title;
      sec.appendChild(h);
      live.forEach(function (e) {
        var d = entryEl(e);
        if (entryLive(e) === null) { d.dataset.gated = e.needsColumn; d.hidden = true; }
        sec.appendChild(d);
      });
      body.appendChild(sec);
    });
    el.appendChild(body);

    var st = document.createElement('p');
    st.className = 'doc-stamp';
    st.innerHTML = '<b>' + esc(HEAD.stamp) + stampDate() + '.</b> ' + esc(HEAD.stamp2);
    el.appendChild(st);

    XB.addEventListener('click', function () {
      var opening = XB.getAttribute('aria-expanded') !== 'true';
      visibleEntries().forEach(function (d) { d.open = opening; if (opening) hydrate(d); });
      XB.setAttribute('aria-expanded', opening ? 'true' : 'false');
      XB.textContent = opening ? HEAD.collapse : HEAD.expand;
      ping();
    });
    bar.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('.doc-chip') : null;
      if (!b) return;
      setFilter(b.dataset.s || null);
    });
    note.addEventListener('click', function (ev) {
      if (ev.target.tagName === 'BUTTON') setFilter(null);
    });
    el.addEventListener('toggle', function (ev) {
      var d = ev.target;
      if (d && d.classList && d.classList.contains('doc-entry') && d.open) hydrate(d);
      ping();
    }, true);

    resolveGated().then(function () { setFilter(FILTER); applyHash(); });
    setFilter(opts.from && SURFACES[opts.from] ? opts.from : null);
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return el;
  }

  /* one probe per cube, then every gated entry is either revealed or removed.
     Removed, not left hidden: a hidden entry is still in the anchor namespace and
     a citation to it would resolve to something invisible. */
  function resolveGated() {
    var gated = [].slice.call(MOUNT.querySelectorAll('details.doc-entry[data-gated]'));
    if (!gated.length) return Promise.resolve();
    return probeHeader('civil_pending_cube').then(function (cols) {
      gated.forEach(function (d) {
        if (cols.indexOf(d.dataset.gated) >= 0) { d.hidden = false; delete d.dataset.gated; }
        else { d.parentNode.removeChild(d); }
      });
      ping();
    });
  }

  function visibleEntries() {
    return [].slice.call(MOUNT.querySelectorAll('details.doc-entry')).filter(function (d) {
      return d.style.display !== 'none' && !d.hidden;
    });
  }

  function setFilter(surface) {
    FILTER = surface || null;
    var all = [].slice.call(MOUNT.querySelectorAll('details.doc-entry')).filter(function (d) { return !d.hidden; });
    var shown = 0;
    all.forEach(function (d) {
      var on = !FILTER || (d.dataset.surfaces || '').split(' ').indexOf(FILTER) >= 0;
      d.style.display = on ? '' : 'none';
      if (on) shown++;
    });
    [].slice.call(MOUNT.querySelectorAll('.doc-grpsec')).forEach(function (sec) {
      var any = [].slice.call(sec.querySelectorAll('details.doc-entry')).some(function (d) { return d.style.display !== 'none' && !d.hidden; });
      sec.style.display = any ? '' : 'none';
    });
    [].slice.call(MOUNT.querySelectorAll('.doc-chip')).forEach(function (b) {
      b.setAttribute('aria-pressed', (b.dataset.s || null) === FILTER ? 'true' : 'false');
      b.classList.toggle('on', (b.dataset.s || null) === FILTER);
    });
    var note = MOUNT.querySelector('.doc-filter-note');
    if (FILTER) {
      note.textContent = HEAD.filterCount(shown, all.length, SURFACES[FILTER]) + ' ';
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'doc-linkish';
      b.textContent = HEAD.filterClear + all.length + '.';
      note.appendChild(b);
    } else { note.textContent = ''; }
    ping();
  }

  /* a citation always wins over a filter, and a retired one is answered rather
     than scrolled to nothing */
  function applyHash() {
    var id = (location.hash || '').replace(/^#/, '');
    if (!id) return;
    if (RETIRED.indexOf(id) >= 0) { retiredNotice(id); return; }
    var d = MOUNT.querySelector('#' + id.replace(/[^a-zA-Z0-9_-]/g, ''));
    if (!d) { if (/^e-/.test(id)) retiredNotice(id); return; }
    if (FILTER && (d.dataset.surfaces || '').split(' ').indexOf(FILTER) < 0) setFilter(null);
    d.open = true; hydrate(d);
    var sum = d.querySelector('summary');
    if (sum) { try { sum.focus(); } catch (x) {} }
    ping();
  }
  function retiredNotice(id) {
    var n = MOUNT.querySelector('.doc-retired') || document.createElement('p');
    n.className = 'doc-retired'; n.setAttribute('role', 'status');
    n.textContent = HEAD.retired(id);
    if (!n.parentNode) MOUNT.insertBefore(n, MOUNT.firstChild);
    ping();
  }

  /* ── lazy figures: nothing is fetched until an entry that needs one is opened ── */
  function rerender(d) {
    var e = entryById(d.id), b = d.querySelector('.doc-ebody');
    if (e && b) b.innerHTML = entryBody(e);
  }
  function hydrate(d) {
    if (d.dataset.hydrated === '1' || d.dataset.hydrating === '1') return;
    var cubes = ENTRY_CUBES[d.id] || [];
    if (!cubes.length) { d.dataset.hydrated = '1'; return; }
    var need = cubes.filter(function (n) { return !has(n); });
    /* the cube may already be in hand, fetched for another entry, so an entry with
       no outstanding need still re-renders once: its clauses were built empty. */
    if (!need.length) { d.dataset.hydrated = '1'; rerender(d); ping(); return; }
    d.dataset.hydrating = '1';
    var b = d.querySelector('.doc-ebody');
    var ld = document.createElement('p');
    ld.className = 'doc-loading'; ld.setAttribute('role', 'status'); ld.textContent = HEAD.figLoading;
    b.appendChild(ld);
    Promise.all(need.map(fetchCube)).then(function () {
      d.dataset.hydrating = ''; d.dataset.hydrated = '1';
      rerender(d);                            /* clauses appear, or stay absent */
      ping();
    });
  }
  function entryById(id) {
    var f = null;
    GROUPS.forEach(function (g) { g.entries.forEach(function (e) { if (e.id === id) f = e; }); });
    return f;
  }

  function stampDate() {
    var p = REVISED.split('-');
    return p[1] + '.' + p[2] + '.' + p[0].slice(2);
  }

  function entryBody(e) {
    var html = '<p class="doc-applies">' + esc(HEAD.applies) +
      esc(e.surfaces.map(function (k) { return SURFACES[k]; }).join(' \u00b7 ')) + '</p>';
    e.body.forEach(function (blk) {
      if (typeof blk === 'string') {
        var r = renderText(blk);
        if (r.html.trim()) html += '<p>' + r.html + '</p>';
      } else if (blk.table) {
        html += wrapTable(table(blk.table), e.title + ', table, scrollable sideways');
      } else if (blk.src) {
        html += '<p class="doc-src">' + esc(blk.src) + '</p>';
      }
    });
    return html;
  }

  function entryEl(e) {
    var d = document.createElement('details');
    d.className = 'doc-entry'; d.id = e.id;
    d.dataset.surfaces = e.surfaces.join(' ');
    var s = document.createElement('summary');
    s.className = 'doc-esum'; s.id = e.id + '-sum';
    s.textContent = e.title;
    d.appendChild(s);
    var b = document.createElement('div');
    b.className = 'doc-ebody';
    b.innerHTML = entryBody(e);
    d.appendChild(b);
    return d;
  }

  function ping() { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }

  /* ── entry points: a plain link, on every surface ─────────────────────────
     Revision B needed a scroll, a focus move and a transient "it moved" line,
     because the notes were elsewhere on the same page and a Framer auto-height
     iframe cannot scroll itself. A standalone page needs none of it: the browser
     navigates and resolves the fragment. That machinery is deleted, not carried. */
  var PAGE = 'reading-the-data.html';
  function href(entryId, base) {
    return (base || '') + PAGE + (entryId ? '#' + entryId : '');
  }

  window.LIONS_DOC = {
    REVISED: REVISED, PROSE_SHA: PROSE_SHA,
    HEAD: HEAD, GROUPS: GROUPS, SURFACES: SURFACES,
    QUOTED: QUOTED, LIVE: LIVE,
    ENTRY_IDS: ENTRY_IDS, RETIRED: RETIRED, ENTRY_CUBES: ENTRY_CUBES, PAGE: PAGE,
    supply: function (n, r) { DATA[n] = r; },
    setBase: function (b) { CUBE_BASE = b; },
    mountPage: mountPage, setFilter: setFilter, href: href, _probe: probeHeader,
    figure: figure, _table: table, _civFlow: civFlowTable, _caRange: caRange,
    _pending: pendingRows, _pendingAt: pendingAt, _pendingHas: pendingHas, DOJ_T5: DOJ_T5,
    _has: has
  };
})();
