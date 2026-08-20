#!/usr/bin/env python3
# build_declinations_cube.py - PII-free cube of CRIMINAL MATTERS DECLINED (Annual Report Tables 14 & 15).
# Declined matter = a criminal (class='R') matter with a gs_court_hist disposition='DE' record;
#   attributed to its FIRST declination (earliest disp_date) and that record's disp_reason1.
# Two breakdown dimensions, each its own cube pair (national + district):
#   * by PROGRAM CATEGORY  (primary/first-entered prog code -> broad group via prog_cat_label)   [Table 14]
#   * by REFERRING AGENCY  (lead IN investigative agency -> Table 3D groups via agency_xwalk.csv) [Table 15]
# Reason = disp_reason1 mapped to the 7 EOUSA reasons + Other (modern codes definitive; high-confidence
#   legacy codes folded so the series is continuous; reason detail is a post-FY2014 scheme).
import duckdb, os, pathlib
PUB='/sessions/vibrant-friendly-brown/mnt/lions/publish'
DB='/sessions/vibrant-friendly-brown/mnt/lions/lions_202605.duckdb'
os.makedirs('/tmp/duckdb_decl', exist_ok=True)
con=duckdb.connect(DB, read_only=True)
con.execute("PRAGMA temp_directory='/tmp/duckdb_decl'"); con.execute("SET memory_limit='2500MB'")
con.execute("SET threads=2"); con.execute("SET preserve_insertion_order=false")

# ---- reason crosswalk (disp_reason1 -> 7 reasons + Other) ----
REASON=[
 # Legally Barred
 ('LEBA','Legally Barred'),('STAL','Legally Barred'),('STLM','Legally Barred'),
 # Insufficient Evidence
 ('EVID','Insufficient Evidence'),('WKEV','Insufficient Evidence'),('LECI','Insufficient Evidence'),
 ('WTPR','Insufficient Evidence'),('NFOE','Insufficient Evidence'),
 # Defendant Unavailable
 ('DEUN','Defendant Unavailable'),('SPOA','Defendant Unavailable'),('NKSU','Defendant Unavailable'),
 ('DEPO','Defendant Unavailable'),('EXTR','Defendant Unavailable'),('SSSE','Defendant Unavailable'),
 ('SUDC','Defendant Unavailable'),('SUCO','Defendant Unavailable'),('SUFU','Defendant Unavailable'),('SUDP','Defendant Unavailable'),
 # Matter Referred to Other Jurisdiction
 ('REFM','Matter Referred to Other Jurisdiction'),('OFPO','Matter Referred to Other Jurisdiction'),
 ('AHPR','Matter Referred to Other Jurisdiction'),
 # Alternative to Federal Prosecution Appropriate
 ('ALTP','Alternative to Federal Prosecution'),('PTDR','Alternative to Federal Prosecution'),
 ('PEPO','Alternative to Federal Prosecution'),('REST','Alternative to Federal Prosecution'),
 # Prioritization of Federal Resources and Interests
 ('RESO','Prioritization of Federal Resources and Interests'),('MFIN','Prioritization of Federal Resources and Interests'),
 ('LKIR','Prioritization of Federal Resources and Interests'),('LKPR','Prioritization of Federal Resources and Interests'),
 # Non-Prosecution Agreement
 ('NPAG','Non-Prosecution Agreement'),('AGRE','Non-Prosecution Agreement'),
]
con.execute("CREATE OR REPLACE TEMP TABLE rmap(code VARCHAR, reason VARCHAR)")
con.executemany("INSERT INTO rmap VALUES (?,?)", REASON)
con.execute(f"CREATE OR REPLACE TEMP TABLE axw AS SELECT code,subagency,department FROM read_csv('{PUB}/agency_xwalk.csv',header=true);")

# ---- declined matters: one row per matter (first DE), with reason, primary prog group, lead agency ----
con.execute("""
CREATE OR REPLACE TEMP TABLE de AS
WITH crim AS (SELECT district,caseid FROM gs_case WHERE class='R'),
d AS (SELECT h.district,h.caseid, arg_min(h.disp_reason1,h.disp_date) code, min(h.disp_date) dt
      FROM gs_court_hist h JOIN crim USING(district,caseid)
      WHERE h.disposition='DE' AND h.disp_date>=DATE '1994-10-01' AND h.disp_date<DATE '2026-06-01'
      GROUP BY 1,2)
SELECT district,caseid, strftime(dt,'%Y-%m') ym, coalesce(r.reason,'Other') reason
FROM d LEFT JOIN rmap r ON r.code=d.code;""")
con.execute("""CREATE OR REPLACE TEMP TABLE prim AS
  SELECT district,caseid, arg_min(prog_cat,id) pcat FROM gs_case_prog_cat GROUP BY 1,2;""")
con.execute("""CREATE OR REPLACE TEMP TABLE decl_cat AS
  SELECT de.district,de.ym,de.reason, coalesce(l.grp,'Other') category
  FROM de LEFT JOIN prim p USING(district,caseid) LEFT JOIN prog_cat_label l ON l.code=p.pcat;""")
con.execute("""CREATE OR REPLACE TEMP TABLE inn AS
  SELECT DISTINCT district,caseid,agency,id FROM gs_participant WHERE role='IN' AND agency IS NOT NULL;""")
con.execute("""CREATE OR REPLACE TEMP TABLE leadag AS
  SELECT district,caseid, arg_min(agency,id) code FROM inn GROUP BY 1,2;""")
con.execute("""CREATE OR REPLACE TEMP TABLE decl_ag AS
  SELECT de.district,de.ym,de.reason,
    coalesce(x.department,'State/Local & Other') department,
    coalesce(x.subagency,'State/Local & Other') subagency
  FROM de LEFT JOIN leadag la USING(district,caseid) LEFT JOIN axw x ON x.code=la.code;""")

# ---- CATEGORY cube (per-category + ALL) ----
con.execute("""CREATE OR REPLACE TEMP TABLE cube_cat AS
  SELECT ym,district,category,reason,count(*) declined FROM decl_cat GROUP BY 1,2,3,4
  UNION ALL SELECT ym,district,'ALL' category,reason,count(*) FROM decl_cat GROUP BY 1,2,4;""")
# ---- AGENCY cube (per-subagency + ALL) ----
con.execute("""CREATE OR REPLACE TEMP TABLE cube_ag AS
  SELECT ym,district,department,subagency,reason,count(*) declined FROM decl_ag GROUP BY 1,2,3,4,5
  UNION ALL SELECT ym,district,'ALL' department,'ALL' subagency,reason,count(*) FROM decl_ag GROUP BY 1,2,5;""")

pathlib.Path(PUB).mkdir(exist_ok=True)
con.execute(f"COPY (SELECT * FROM cube_cat ORDER BY district,category,reason,ym) TO '{PUB}/decl_cat_cube.csv' (FORMAT CSV,HEADER);")
con.execute(f"COPY (SELECT ym,category,reason,sum(declined) declined FROM cube_cat GROUP BY 1,2,3 ORDER BY category,reason,ym) TO '{PUB}/decl_cat_cube_national.csv' (FORMAT CSV,HEADER);")
con.execute(f"COPY (SELECT * FROM cube_ag ORDER BY district,department,subagency,reason,ym) TO '{PUB}/decl_agency_cube.csv' (FORMAT CSV,HEADER);")
con.execute(f"COPY (SELECT ym,department,subagency,reason,sum(declined) declined FROM cube_ag GROUP BY 1,2,3,4 ORDER BY department,subagency,reason,ym) TO '{PUB}/decl_agency_cube_national.csv' (FORMAT CSV,HEADER);")
print("cat cube rows:",con.execute("SELECT count(*) FROM cube_cat").fetchone()[0])
print("agency cube rows:",con.execute("SELECT count(*) FROM cube_ag").fetchone()[0])
print("DONE")
