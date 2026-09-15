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
  var REVISED   = '2026-09-13';
  var PROSE_SHA = '28922f8d';   /* recomputed by tests/docs-check.js check 26(e); there is no generator script */

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
    button:  'Data documentation',
    stand:   'Below, we’ve outlined some of the important facets of Justice Connection’s five dashboards and discrepancies or details to keep in mind as you review the dashboard',
    scope:   'All below note analysis apply to national data and subcategories, regardless of the dashboard selected.',
    expand:  'Expand all',
    collapse: 'Collapse all',
    stamp:   'Last published update ',
    stamp2:  'Dashboard numbers cited in this documentation update in real-time, reflecting the most recent data available.',
    applies: 'Applies to: ',
    /* the surface filter */
    filterLbl: 'Notes that affect',
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
  { id: 'g1', title: 'Data Organization', entries: [

    { id: 'e-dc-only', surfaces: ['index', 'agency'],
      title: 'Criminal case exclusions',
      body: [
        'A criminal case reaches this dashboard only if it has a filing date recorded for a U.S. District Court. Some prosecutions handled entirely in a magistrate court may have dates that appear “late” or “misdated.” These cases are excluded from dashboard charts but will appear in the Case Look-Up feature. Any analysis or chart built on the dashboard should not be categorized as reflective of all federal criminal prosecutions, given these differences.',
        '[[In fiscal year {{crim_fy}} there are approximately {{mag_excl}} prosecutions excluded from the visualization, {{mag_1325}} of which are illegal entry cases under 8 U.S.C. 1325(a)(1), many in the southern and western districts of Texas, in Arizona and in New Mexico.]]',
        '[[There’s over {{no_dc_d}} criminal case records in this dataset but {{no_dc_n}} (or {{no_dc_pct}}), have no U.S. District Court filing and therefore are not visualized on the dashboard. In fiscal year {{crim_fy}} this dashboard counts {{crim_fy_cases}} criminal cases filed and {{crim_fy_defs}} defendants.]]',
        'Declined matters and matters that never went to court are, similarly, not visualized. Declined matters have their own dashboard.',
        'By counting only district court filings, this dashboard is comparable with the figures that DOJ publishes at the end of the year. [[Using this smaller case count, our dashboard visualizes {{crim_case_pct}} of DOJ’s published count of criminal cases filed and {{crim_def_pct}} of its published defendants.]] The wider count, taking in magistrate court prosecutions, matches no published DOJ table at all, making data validation nearly impossible.',
      ] },

    { id: 'e-filed-two', surfaces: ['index', 'lookup'],
      title: 'Definition of filed',
      body: [
        'The word "filed" has different meanings on the dashboard versus the Case Look-Up function.',
        'The dashboard dates a case by its earliest filing in a U.S. District Court across cases that reached that court. Case Look-Up dates a case by its earliest filing in any court, across every record with a court proceeding, which includes magistrate court prosecutions and proceedings that happen after a case has been decided. Therefore Case Look-Up always returns a larger number. Both are accurate.',
        '[[For example, if you filter for criminal cases filed in fiscal year {{crim_fy}}, the dashboard shows {{crim_fy_cases}} and Case Look-Up shows {{cl_fy_cases}}.]] Because the two count different populations, a Case Look-Up search is not the detail behind a dashboard figure and the two will not reconcile. For more detailed breakdowns of the dashboard, use the table feature at the bottom of that page.',
      ] },

    { id: 'e-matter-case', surfaces: ['civil', 'agency'],
      title: 'Civil case data',
      body: [
        'A civil matter and a civil case are two stages of the same work. DOJ’s definition, as outlined in the annual report, is that matters are “proceedings not yet in court.” The dashboard splits cases and matters similarly. A civil record counts as a matter until a court appears on it, meaning the same issue can be counted as a matter received in one month and as a case filed in a later one. The two data points are not alternatives and they should not be added together.',
      ] },

    { id: 'e-usao-only', surfaces: ['index', 'civil', 'agency', 'declinations', 'lookup'],
      title: 'Data is limited to USAO work',
      body: [
        'LIONS is the case management system used by the United States Attorneys’ offices, which means wrk handled by other parts of the Department of Justice, namely Main Justice, is not included in this data.',
        'There are 94 U.S. Attorney’s offices. Our dataset does not specify cases filed in the Northern Mariana Islands, which shares a U.S. Attorney with Guam.',
      ] }
  ] },

  { id: 'g2', title: 'Data validation', entries: [

    { id: 'e-doj-identity', surfaces: ['index', 'civil', 'agency'],
      title: 'DOJ’s annual reports are not consistent',
      body: [
        'In the process of completing data validation, it became clear that the DOJ’s annual reports do not always align with their own data from one year to the next.',
        '[[In each of the five annual reports for fiscal years 2021 to 2025, the civil caseload table gives a caseload pending at the start of the year, the cases filed, the cases terminated and the caseload pending at the end. However, the four figures do not agree with one another: the published end of year figure is between {{doj_gap_lo}} and {{doj_gap_hi}} smaller than the other three imply. The criminal tables in the same five reports are inconsistent in the same way. The reports do not say why and it’s not clear if the discrepancy is due to a reporting error, a change in methodology or some other reason.]]',
        'Nothing here connects this to anything else in these notes. It is a separate observation. No part of the difference between this site’s figures and DOJ’s published figures is explained by it, and nothing set out here claims that it is.',
      ] },
    { id: 'e-doj-3b', surfaces: ['index'],
      title: 'Criminal cases and defendants filed',
      body: [
        'DOJ publishes a comparable count once a year in its annual report; the criminal case dashboard does not reproduce it exactly.',
        '[[For fiscal year {{crim_fy}} this dashboard counts {{crim_fy_cases}} criminal cases filed, compared to {{doj_3b_cases}} that DOJ reports, or {{crim_case_pct}} of DOJ’s figure. Regarding the number of defendants, the dashboard counts {{crim_fy_defs}} against DOJ’s {{doj_3b_defs}}, which is {{crim_def_pct}}.]]',
        { table: 'crim-flow' },
        'Note this analysis is not replicable across other years. Data validation shows our dashboard matches, on average, 98% of the DOJ’s total reported criminal cases and 103% of their total defendants.',
      ] },

    { id: 'e-doj-t4', surfaces: ['civil', 'agency'],
      title: 'Civil cases filed and terminated',
      body: [
        'DOJ publishes the civil caseload once a year. Compared against its five annual reports for fiscal years 2021 to 2025, this site’s counts differ from DOJ’s in every one of the five years, on both counts.',
        { table: 'civ-flow' },
        'The reason has not been identified, and the difference is not the same size in each year, so it is not a fixed amount that can be added to or taken off. Part of it is that our most recent years are still being reported and will move; that cannot be the whole of it, because the oldest years here have long since settled and still differ.',
      ] },

    { id: 'e-doj-t5-cases', surfaces: ['civil', 'agency'], needsColumn: 'cases_pending',
      title: 'Civil cases pending',
      body: [
        'The total dashboard count differs from DOJ’s published count, sometimes due to a greater number of cases, sometimes fewer.',
        'Cases pending is a count taken at the end of each month of the civil cases that had a court record by that date and no recorded ending. It is not a running balance of arrivals minus departures, and it does not include events that happened after the published date.',
        { table: 'pending-cases' },
        'Part of the discrepancies can be accounted for by later data that will retroactively change the count of cases pending at the end of a given month. One trend we’ve noticed is the U.S. as a plaintiff accounts for almost none of the difference; why is not clear.',
      ] },

    { id: 'e-pending-entry-date', surfaces: ['civil', 'agency'], needsColumn: 'matters_pending',
      title: 'Civil matters pending',
      body: [
        'Our dashboard count for civil matters pending varies from the DOJ published figures to a greater extent than cases. The variance is not normalized nor directional. Matters, similar to cases, is a count taken at the end of each month of all civil matters that have not reached court and have no recorded closure. We caution against using a single month’s matters pending to signify events in that month.',
        { table: 'pending-matters' },
      ] },

    { id: 'e-two-crim', surfaces: ['index', 'agency'],
      title: 'Differences between Criminal Cases and Cases by Referring Agency',
      body: [
        'The Criminal Cases dashboard and the Referring Agency dashboard are built from the same records by two different builds, and their criminal totals differ by a handful of cases.',
        '[[For fiscal year {{crim_fy}} the Referring Agency dashboard counts {{ag_fy_cases}} criminal cases filed.]]',
        'We have yet to establish a cause but the difference is small enough that it will not change any reading of a trend, and large enough that two figures quoted side by side will not match.'
      ] }
  ] },

  { id: 'g3', title: 'Explaining settled versus provisional data', entries: [

    { id: 'e-provisional', surfaces: ['index', 'civil', 'agency', 'declinations', 'lookup'],
      title: 'The newest months are always incomplete',
      body: [
        'The most recent months in each data update from LIONS are always incomplete but the variance is not steady. Every monthly data upload is re-reported more completely in later updates, which we are referring to as “settling” the data. The most recent months on any chart are the least complete, and they are marked on the chart, in the table and in the download as "provisional.',
        'The scope of missing data is not a constant factor, so we can’t provide an estimation of what’s missing. For example, between the May and June 2026 updates, the newest month of criminal terminations grew by a factor of 2.9. Between the June and July 2026 updates the same measurement gave 5.4. Critically, we still do not believe that this is the final figure, just one step closer.',
        'Users should note that a sharp decline at the most recent month on the chart is not evidence of a decline, but rather another indicator of incomplete filing data.',
      ] },

    { id: 'e-not-final', surfaces: ['index', 'civil', 'agency', 'declinations'],
      title: 'Incomplete data',
      body: [
        'All provisional data is shaded on charts, denoting that they are incomplete. The scope of provisional data depends on the dataset: three months for criminal filings, four for civil filings and six for anything related to terminations, dispositions, declinations or pending issues. Note that figures still move outside of the provisional range, but this is smaller and smaller as the months pass. We’ve noticed that civil caseload data continues to move for cases two years or older, but by smaller than 1 percentage point.',
      ] },

    { id: 'e-revision', surfaces: ['index', 'civil', 'agency', 'declinations', 'lookup'],
      title: 'Changes over months',
      body: [
        'Each monthly update does not simply add new figures for the most recent month, but reports the data from all previous months more completely, so a figure for a month years in the past can still change. If you use a figure from this dashboard, include the dashboard visit date.',
      ] }
  ] },

  { id: 'g4', title: 'Additional user notes', entries: [

    { id: 'e-cat-overlap', surfaces: ['index'],
      title: 'Criminal program categories overlap',
      body: [
        'A criminal case can carry several program category codes and is counted under every one of them, so adding all categories will result in an overinflated total. To see total cases over a period of time, see the "all categories" figure.',
        '[[Over the whole period, adding the umbrella categories together gives {{oc_umb_all_parts}} criminal cases filed against a true total of {{oc_umb_all_total}}, which is {{oc_umb_all_pct}} too many. Within fiscal year {{crim_fy}} the same sum is {{oc_umb_fy_pct}} too many. Expanding every umbrella and adding all of the specific categories instead gives {{oc_spec_all_pct}} too many over the whole period and {{oc_spec_fy_pct}} within fiscal year {{crim_fy}}.]]',
        'Another option is to filter by "Primary only", which counts each case once under its first entered code.'
      ] },

    { id: 'e-ag-overlap', surfaces: ['agency'],
      title: 'Referring agencies overlap',
      body: [
        'Similarly, there may be multiple referring agencies for a single case, so agencies should not be added up to reach a total. Instead, use "All agencies," or filter by "Lead agency," to see a reflective sum.',
      ] },

    { id: 'e-zero-months', surfaces: ['civil', 'agency'],
      title: 'Occasional zero months',
      body: [
        'It is possible for the dashboard to return no data if you filter for one district, one cause of action and one role in the Civil Matters and Cases dashboard or the Cases by Referring Agency dashboard.',
        'These months are not errors, even if its pending cases, it just shows that a caseload was empty, not that a month is empty. The one exception is for provisional data, which may be empty because they’re incomplete. For more information about provisional data, read below.',
      ] },

    { id: 'e-ratio', surfaces: ['index', 'civil', 'agency', 'declinations'],
      title: 'Topline percentage calculations',
      body: [
        'The four dashboards provide some general topline calculations based on the filtered data. All displayed percentages are analyzed from the whole sample, even if data is visualized in quarters or years, never averaging the monthly data.'
      ] },

    { id: 'e-selection', surfaces: ['index', 'civil', 'agency', 'declinations'],
      title: 'Table functionality',
      body: [
        'The data table and the CSV download have fixed columns that are not affected by the filters you select. The table and download will always show the same columns, even if you have filtered for a single district or cause of action. However, the data you download will be filtered, so there may be empty columns in the table.',
        'Additionally, the total number displayed is only the total of the filtered data, not the entire dataset, unless you have selected all districts, causes of action, and roles.',
      ] }
  ] },

  { id: 'g5', title: 'Case Look-Up', entries: [

    { id: 'e-cl-imputed', surfaces: ['lookup'],
      title: 'Filed dates',
      body: [
        'As noted above, Case Look-Up data is organized by the earliest filing date in any real court, so there may be cases that date earlier than the dashboard dates or outside of your filtered range.',
        'Another discrepancy is the court type; court type is the first court that a record appeared in. For example, a case might show Magistrate Court but still have a U.S. District court filing date later',
        '[[In the most recent full fiscal year that affects about {{cl_imputed}} of the criminal cases a search returns.]]',
      ] },

    { id: 'e-cl-court', surfaces: ['lookup'],
      title: 'Declinations in Case Look-Up',
      body: [
        'In Case Look-Up, the disposition column is only recorded for matters that reached a court and were declined. However, it is not representative of all declined cases, because many of them do not reach a court. In addition, some matters are declined and later prosecuted, and these would not be visible in the data.',
        'To see declined matters only, you can filter by "declination" and set "declined matters only." To visualize and filter immediate case declinations terminated by U.S. Attorney’s Offices, visit our declination dashboard.',
      ] },
  ] },
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
    'e-doj-3b':             ['lions_cube'],
    'e-doj-t4':             ['civil_cube'],
    'e-doj-t5-cases':       ['civil_pending_cube'],
    'e-pending-entry-date': [],
    'e-two-crim':           ['lions_cube', 'agency_cube'],
    'e-cat-overlap':        ['lions_cube'],
    'e-ag-overlap':         ['agency_cube']
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
    'e-dc-only', 'e-filed-two', 'e-matter-case', 'e-usao-only',
    'e-doj-identity',
    'e-doj-3b', 'e-doj-t4', 'e-doj-t5-cases', 'e-pending-entry-date', 'e-two-crim',
    'e-provisional', 'e-not-final', 'e-revision',
    'e-cat-overlap', 'e-ag-overlap', 'e-zero-months', 'e-ratio', 'e-selection',
    'e-cl-imputed', 'e-cl-court'
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
      '<p class="doc-stand">' + esc(HEAD.scope) + '</p>' 
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
    return p[1] + '-' + p[2] + '-' + p[0];
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
