# LIONS caseload analytics

Four dashboards, a case search and a reference page over the **LIONS** caseload extract -
the case-management data of the 94 United States Attorneys' offices, released publicly by
the Department of Justice. Published by **Justice Connection**.

**Live site:** [https://justiceconnection.github.io/lions-data-dashboards/](https://www.thejusticeconnection.org/accountability/doj-data-dashboard)

Everything here runs in the browser. There is no server, no database behind the site and no
analytics: the pages fetch static files from this repository and compute in the page.

---

## What is on the site

| page | what it answers |
|---|---|
| `index.html` | **Criminal cases.** Cases and defendants filed and terminated, by program category, with dispositions. Categories expand from broad umbrellas to the specific Appendix A codes. |
| `civil.html` | **Civil matters and cases.** Split by the government's role - plaintiff, defendant or other - and by cause of action, with how cases ended. |
| `agency.html` | **Cases by agency.** Criminal cases by the investigative agency that referred them; civil cases by the client agency represented. Two different mappings on one page, because the same agency code means different things on each side. |
| `declinations.html` | **Criminal matters declined.** Counts and reasons, broken down by program category or by referring agency. |
| `case-lookup/index.html` | **Case Look-Up.** Record-level search over **7,509,380** case records across **93** district codes, with CSV export. |
| `reading-the-data.html` | **Documentation.** Every figure on the site that can be read wrongly, and why. Read this before quoting a number. |

The aggregate pages read the small pre-computed CSV summaries in `data/`. Case Look-Up
range-reads two columnar `.parquet` files in `case-lookup/` through a copy of DuckDB
compiled to WebAssembly, so the search runs entirely on the reader's machine and no query
leaves the browser.

---

## Where the data comes from

The source is **LIONS**, the Legal Information Office Network System, released in periodic
public extracts by the **Executive Office for United States Attorneys (EOUSA)**. This
project uses the extract as released: not scraped, not obtained under any restricted
agreement, and not joined to any non-public source.

Each extract is a **cumulative snapshot rather than an increment**. A later release
re-reports the same history more completely instead of adding rows to the previous one.

| | |
|---|---|
| coverage | **1994-10 to 2026-07**, 382 months |
| districts | 93 district codes |
| case records in the search | 7,509,380 |
| columns in the search | 36 |

**On 93 against 94:** there are 94 United States Attorneys' offices, and the extract carries
93 district codes. The difference has not been reconciled here and is not corrected for. The
figures on this site are what the data carries, so treat 93 as the count that applies to
them.

### Why record-level data is publishable at all

EOUSA's release is accompanied by a **Vaughn Index** - the document a federal agency
produces to justify, field by field, what it has withheld from a disclosure and under which
exemption. The relevant one is Exhibit E, C-LIONS, revised **2024-08-26**, 86 pages. Every
column published in the search has been checked against it, field by field, before it
shipped.

Two things about that are worth stating plainly, because both are easy to overstate.

**The index has four outcomes, not two.** A field can be released unconditionally, released
*on a condition*, withheld outright, or - for a field this project computes itself - have no
entry at all. Collapsing "conditional" into "released" is how a first reading of it went
wrong. A conditional field is published here as conditional, meaning the claim is that
EOUSA's own filter held on these rows. For most of them that has not been verified
empirically, and the verification available is one-directional: the marker that can be
checked against is EOUSA's own *pre-public and/or under seal* label, which is a **superset**
of under seal, so a check can confirm that a condition held and cannot by itself show that
one failed.

**A Vaughn Index justifies withholding; it is not on its face a licence to republish.** What
it gives this project is a field-level map of what the Department itself considered
releasable. The republication rests separately on EOUSA's affirmative public release of the
data and on the absence of any stated terms of use attached to it. Both supports are needed
and neither substitutes for the other.

Three fields the index withholds outright - a seal marker, a case-restriction flag and a
grand-jury number - are empty in the extract **because EOUSA redacted them**, not because
the system never held them.

Clearing a field is not the same as clearing a *combination* of fields. A field-level
analysis says what may be published; it does not establish that the whole published set is
safe in every combination.

### Which columns are EOUSA's, and which are ours

Of the 36 columns in the case search, **eight are computed by this project and are not EOUSA
fields**:

| column | what it is |
|---|---|
| `record_type` | whether a record is a case, a matter, or a post-disposition proceeding |
| `num_defendants` | a count of defendant participants |
| `num_charges` | a count of charges |
| `fiscal_year` | the federal fiscal year, derived from a date |
| `dc_filed_date` | the earliest U.S. District Court filing date |
| `declined_date` | the declination date, under the declination definition this site uses |
| `drug_related` | whether any controlled substance is recorded against the case |
| `drug_types` | the distinct substances recorded against the case |

Both `.parquet` files name these eight in their own file-level metadata, under the key
`derived_columns`, so anyone reading the files without the site can tell them apart too.

A computed column is **this project's** statement about the data, not the Department's. It
inherits whatever the field it was computed from exposes, and it should be judged on its own
terms rather than on a disclosure determination it can never carry.

**One caveat belongs here rather than in a footnote.** The `filed_date` column substitutes
the *received* date where a record has no real filing date - about 1,853 rows of a single
fiscal year of criminal results - and the interface does not yet distinguish the two. If the
distinction matters to you, use `dc_filed_date`, which is never substituted.

---

## Three things that will make you misread a figure

**1. The most recent months are always incomplete.** Filings finish developing at about
three months old; terminations take six or more. The newest month in any release is a
partial count and **will grow** in the next one. **A fall at the right-hand edge of any chart
on this site is the reporting lag, not a decline.** Every surface marks provisional periods;
the documentation page explains each case.

**2. Criminal program categories overlap, so never add them up.** A single case can carry
several program codes. Each summary file carries an explicit total row, and that row **is**
the total. Summing the categories double-counts - by between 6% and 24% depending on the
window, the metric and whether you sum the umbrellas or the specific codes. The same is true
of criminal referring agencies. Civil causes of action and declination reasons do partition
exactly, and the documentation page says which axis behaves which way.

**3. "Filed" means two different things on two different pages.** The criminal dashboard
counts cases that reached **U.S. District Court**, which is what the Department's own
published tables count. Case Look-Up dates a case by its earliest filing in **any** real
court, over a wider population that includes magistrate-court-only prosecutions and
post-disposition proceedings. Both are correct for the question each answers; they are not
comparable to each other, and the gap between them is structural rather than an error. Do
not build a click-through from a chart to "the matching records" and expect the counts to
agree.

---

## What is in this repository

```
index.html  civil.html  agency.html  declinations.html   the four dashboards
reading-the-data.html                                    the documentation page
case-lookup/index.html                                   the record-level search
case-lookup/*.parquet                                    the searchable case records
case-lookup/facets.json                                  the values behind every filter
case-lookup/duckdb-wasm/                                 third-party query engine
data/*.csv, data/*.csv.gz                                the pre-computed summaries
data/*_xwalk.csv                                         agency code to agency name
scripts/                                                 per-page chart and table logic
shared/                                                  navigation, shared rendering, config
styles/  lab.css  shell2.js                              presentation and page furniture
```

Two things worth knowing before you read the code. Scripts and stylesheets are requested
with a `?v=` query string that changes whenever the file does; the data files deliberately
carry none, because they are fetched with revalidation forced. And the district-level
summaries are fetched up front rather than on demand, so that changing a district filter is
instant - a deliberate trade of bandwidth for responsiveness, not an oversight.

---

## License

**The code in this repository is licensed under Apache-2.0.** See `LICENSE`. That covers the
HTML, CSS and JavaScript - everything that renders and computes.

**The data is not covered by it, and could not be.** The caseload figures are United States
federal government records released publicly by the Department of Justice. They are not this
project's to license, and asserting a copyright license over them would be claiming a right
this project does not hold. No additional restriction is placed on them here: they carry no
stated terms of use, and none is added.

**The aggregation layer is dedicated to the public domain.** The summary files are not the
raw extract - the aggregation, the crosswalks, the category mappings, the declination
definition and the computed columns are this project's editorial work, and a reuser is
entitled to know where they stand. To the extent that any copyright or database right
subsists in it, Justice Connection dedicates that layer to the public domain under
[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/). No permission is
needed and no conditions attach.

**`case-lookup/duckdb-wasm/` is third-party code** from the DuckDB-WASM project, carried
here so that the search works without a server. It is distributed under the MIT license, and
the dependencies built into it carry Apache-2.0 and 0BSD. The license texts and the full
attribution notices are in that directory. Neither of the terms above applies to it.

### Attribution is requested, not required

If you use these figures, crediting *Justice Connection, DOJ Data Dashboard* and
linking back gives your readers a route to the caveats - which matter here more than usual,
since several of these figures are genuinely easy to misread and every one of them has a
window, an axis and a definition attached. That is a request, not a license condition, and
nothing in CC0 makes it one.

---

## Reusing the data

The summary files in `data/` are plain CSV and are the easiest place to start. Each one has
a national file and a district-level file with the same columns plus a `district` column
second, immediately after the month. Before you compute anything from them, read the
documentation page and the three warnings above - in particular, take a total from the
explicit total row rather than by adding up the parts.

The two `.parquet` files in `case-lookup/` are the record-level data and can be opened
directly by DuckDB, pandas, Polars or anything else that reads Parquet. They are split
alphabetically **by district** - `cases_a_m` holds `AK` to `MT` and `cases_n_z` holds
`NC-Eastern` to `WY` - and are meant to be read together as one table. Both carry the same
36 columns, and both name the eight computed columns in their file-level metadata under the
key `derived_columns`.
