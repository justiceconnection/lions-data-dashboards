// LIONS dashboards - shared site configuration (nav + administration eras).
// Single source of truth; edit here, every dashboard picks it up.
const DASHBOARDS=[{name:"Criminal Cases",file:"index.html"},{name:"Civil Matters and Cases",file:"civil.html"},{name:"Cases by Referring Agency",file:"agency.html"},{name:"Criminal Matter Declinations",file:"declinations.html"},{name:"Case Look-Up",file:"case-lookup/index.html"}];
const ADMINS=[{name:"Obama II",a:"2013-01",b:"2017-01",c:"rgba(33,33,35,0.05)"},{name:"Trump I",a:"2017-01",b:"2021-01",c:"rgba(33,33,35,0.12)"},{name:"Biden",a:"2021-01",b:"2025-01",c:"rgba(33,33,35,0.05)"},{name:"Trump II",a:"2025-01",b:"9999-12",c:"rgba(33,33,35,0.12)"}];
const ADMIN_SEQ=['obama2','trump1','biden','trump2'];

// ── "Reading the data" - the reference page every surface links to (L-144) ──────
// ONE constant, two render sites, six surfaces. `shell2.js` renders the bar control on
// the four dashboards; `case-lookup/index.html` renders its own header link. Markers are
// rendered by each `scripts/<page>.page.js`.
//
// It is deliberately NOT in DASHBOARDS. Two reasons, both checked rather than assumed:
// DASHBOARDS is the dashboard nav, and putting a reference page in it asserts that the
// page is a dashboard; and `lab.js` folds `#dashnav` into a `.nv-acc` accordion inserted
// WITHOUT the `open` class, so anything rendered inside `.dashnav` is one click away on
// every dashboard at every width. The control stays visible in the bar.
//
// FLAGS is the marker rule, and the rule is: a metric carries the glyph if, and only if,
// an entry names THAT metric. A caveat that applies to every metric on a surface is
// carried by the one link, not by a glyph on every metric. The glyph is an index into the
// notes; it is NOT a severity signal and no copy may imply that it is.
// `declinations` deliberately flags nothing - the definition change applies to every
// series on it, so it is the link's job.
// `matters_pending` is listed and points at a HELD entry (L-149). `markerFor()` is asked
// for a marker only where the page has the series, so the held entry never gets a marker
// pointing at an anchor the page does not render.
const REFERENCES={
  page:"reading-the-data.html",
  label:"Reading the data",              // must equal LIONS_DOC.HEAD.button; docs-check asserts it
  glyph:"⚠",
  arrow:"→",
  // surface key -> the dashboard it names. `name` must match LIONS_DOC.SURFACES exactly
  // (docs-check asserts it); `file` is what the Back control on the notes page links to.
  surfaces:{
    index:{name:"Criminal Cases",file:"index.html"},
    civil:{name:"Civil Matters and Cases",file:"civil.html"},
    agency:{name:"Cases by Referring Agency",file:"agency.html"},
    declinations:{name:"Criminal Matter Declinations",file:"declinations.html"},
    lookup:{name:"Case Look-Up",file:"case-lookup/index.html"}
  },
  // A "mode" is a flag set. Four of the six are a surface; `agencyCivil` is
  // `agency.html` with its Criminal/Civil toggle on Civil, and it is a DIFFERENT flag set
  // over the SAME surface, so `?from=` must resolve back to `agency`.
  modes:{index:"index",civil:"civil",agency:"agency",agencyCivil:"agency",declinations:"declinations",lookup:"lookup"},
  flags:{
    index:{cases_filed:"e-doj-3b",defendants_filed:"e-doj-3b"},
    civil:{cases_filed:"e-doj-t4",cases_terminated:"e-doj-t4",cases_pending:"e-doj-t5-cases",matters_pending:"e-doj-t5-matters"},
    agency:{cases_filed:"e-two-crim",defendants_filed:"e-two-crim"},
    agencyCivil:{cases_filed:"e-doj-t4",cases_terminated:"e-doj-t4",cases_pending:"e-doj-t5-cases",matters_pending:"e-doj-t5-matters"},
    declinations:{},
    lookup:{filed_date:"e-filed-two"}
  },
  // `base` is "" from the site root and "../" from case-lookup/. No `target`: every link
  // on this site navigates inside the Framer embed, and one that did not would be the odd
  // one out (`shared/shared.js` renderNav, and Case Look-Up's own pathFor replica).
  surfaceOf(mode){ return this.modes[mode]||null; },
  href(mode,entryId,base){
    const s=this.surfaceOf(mode);
    return (base||"")+this.page+(s?"?from="+s:"")+(entryId?"#"+entryId:"");
  },
  // Entries whose copy is signed but which the notes page does not render yet, because
  // the series they describe is not in the promoted cube. `matters_pending` is held on
  // L-149. entryFor() returns null for a held entry, so a marker can never point at an
  // anchor the page does not publish - and the held set is stated once, here, rather
  // than re-derived in each page script.
  held:["e-doj-t5-matters"],
  entryFor(mode,key){
    const id=(this.flags[mode]||{})[key]||null;
    return (id&&this.held.indexOf(id)<0)?id:null;
  },
  // A link carrying the glyph. `srText` is the screen-reader sentence: the glyph itself is
  // aria-hidden, so the warning has to be carried in words here or it is vision-only.
  markerFor(mode,key,srText,base){
    const id=this.entryFor(mode,key); if(!id) return null;
    const a=document.createElement('a');
    a.className='docmark'; a.href=this.href(mode,id,base);
    a.setAttribute('aria-label',srText);
    a.innerHTML='<span aria-hidden="true">'+this.glyph+'</span>';
    return a;
  },
  markerLabel(name){ return name+': read the note on how this figure compares and what it leaves out'; }
};
