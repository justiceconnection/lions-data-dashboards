#!/usr/bin/env python3
# build_agency_cube.py - PII-free CRIMINAL cube: cases by referring (investigative) agency.
# Grain: month(ym) x district x department x subagency x occ('lead'/'all').
#   occ='lead' -> case counted once, under its lead (first-entered) referring agency.
#   occ='all'  -> case counted under EVERY referring agency it names (~2% of cases multi-agency).
#   department='ALL',subagency='ALL' rows = distinct total REFERRED cases (has >=1 agency),
#     emitted for BOTH occ values (same numbers) so the dashboard can filter uniformly.
# Referring agency = gs_participant.role='IN'; codes mapped to Table 3D-style groups via agency_xwalk.csv.
# Civil (class='V') has ~no IN-agency data (132 cases) -> not built here; civil tab shows a no-data state.
import duckdb, pathlib
PUB='/sessions/vibrant-friendly-brown/mnt/lions/publish'
DB='/sessions/vibrant-friendly-brown/mnt/lions/lions_202605.duckdb'
con=duckdb.connect(DB, read_only=True)
import os as _os; _os.makedirs('/tmp/duckdb_agency', exist_ok=True)
con.execute("PRAGMA temp_directory='/tmp/duckdb_agency'")
con.execute("SET memory_limit='2500MB'")
con.execute("SET threads=2")
con.execute("SET preserve_insertion_order=false")

con.execute(f"""
CREATE OR REPLACE TEMP TABLE xw AS
  SELECT code, department, subagency FROM read_csv('{PUB}/agency_xwalk.csv', header=true);
""")

# ---- materialize intermediates on disk to cap peak memory ----
con.execute("""CREATE OR REPLACE TEMP TABLE crim AS SELECT district,caseid FROM gs_case WHERE class='R';""")
con.execute("""CREATE OR REPLACE TEMP TABLE filed AS
  SELECT cf.district, cf.caseid, strftime(cf.first_filing,'%Y-%m') ym
  FROM case_filing cf JOIN crim USING(district,caseid)
  WHERE cf.first_filing >= DATE '1994-10-01' AND cf.first_filing < DATE '2026-06-01';""")
con.execute("""CREATE OR REPLACE TEMP TABLE inn AS
  SELECT DISTINCT p.district, p.caseid, p.agency, p.id
  FROM gs_participant p JOIN crim USING(district,caseid)
  WHERE p.role='IN' AND p.agency IS NOT NULL;""")
con.execute("""CREATE OR REPLACE TEMP TABLE lead AS
  SELECT district, caseid, arg_min(agency,id) code FROM inn GROUP BY 1,2;""")
# case -> (department, subagency, occ)
con.execute("""CREATE OR REPLACE TEMP TABLE cg AS
  SELECT l.district, l.caseid, x.department, x.subagency, 'lead' occ
    FROM lead l JOIN xw x ON x.code=l.code
  UNION ALL
  SELECT DISTINCT i.district, i.caseid, x.department, x.subagency, 'all' occ
    FROM inn i JOIN xw x ON x.code=i.agency;""")
con.execute("""CREATE OR REPLACE TEMP TABLE has_ag AS SELECT DISTINCT district,caseid FROM lead;""")
con.execute("""CREATE OR REPLACE TEMP TABLE dterm AS
  SELECT strftime(ct.term_date,'%Y-%m') ym, ct.district, ct.caseid, d.id,
    CASE WHEN ct.term_disposition IN ('GT','NC','GD') THEN 'guilty'
         WHEN ct.term_disposition = 'NG'             THEN 'not_guilty'
         WHEN ct.term_disposition IN ('DM','DJ')     THEN 'dismissed'
         WHEN ct.term_disposition IN ('TR','RE')     THEN 'rule_20_21'
         ELSE 'other' END bucket
  FROM case_termination ct JOIN crim USING(district,caseid) JOIN defendant d USING(district,caseid)
  WHERE ct.term_date >= DATE '1994-10-01' AND ct.term_date < DATE '2026-06-01';""")

con.execute("""
CREATE OR REPLACE TEMP TABLE cube AS
WITH
fg AS (SELECT f.ym,f.district,cg.department,cg.subagency,cg.occ,
         count(DISTINCT f.caseid) cases_filed
       FROM filed f JOIN cg USING(district,caseid) GROUP BY 1,2,3,4,5),
dfg AS (SELECT f.ym,f.district,cg.department,cg.subagency,cg.occ,
         count(DISTINCT d.caseid||'|'||d.id) defendants_filed
       FROM filed f JOIN cg USING(district,caseid) JOIN defendant d USING(district,caseid) GROUP BY 1,2,3,4,5),
tg AS (SELECT dt.ym,dt.district,cg.department,cg.subagency,cg.occ,
         count(DISTINCT dt.caseid) cases_terminated,
         count(*) defendants_terminated,
         count(*) FILTER (WHERE bucket='guilty') guilty,
         count(*) FILTER (WHERE bucket='not_guilty') not_guilty,
         count(*) FILTER (WHERE bucket='dismissed') dismissed,
         count(*) FILTER (WHERE bucket='rule_20_21') rule_20_21,
         count(*) FILTER (WHERE bucket='other') other
       FROM dterm dt JOIN cg USING(district,caseid) GROUP BY 1,2,3,4,5),
per_group AS (
  SELECT coalesce(fg.ym,dfg.ym,tg.ym) ym,
         coalesce(fg.district,dfg.district,tg.district) district,
         coalesce(fg.department,dfg.department,tg.department) department,
         coalesce(fg.subagency,dfg.subagency,tg.subagency) subagency,
         coalesce(fg.occ,dfg.occ,tg.occ) occ,
         coalesce(fg.cases_filed,0) cases_filed,
         coalesce(dfg.defendants_filed,0) defendants_filed,
         coalesce(tg.cases_terminated,0) cases_terminated,
         coalesce(tg.defendants_terminated,0) defendants_terminated,
         coalesce(tg.guilty,0) guilty, coalesce(tg.not_guilty,0) not_guilty,
         coalesce(tg.dismissed,0) dismissed, coalesce(tg.rule_20_21,0) rule_20_21,
         coalesce(tg.other,0) other
  FROM fg FULL JOIN dfg USING(ym,district,department,subagency,occ)
          FULL JOIN tg USING(ym,district,department,subagency,occ)),
fa AS (SELECT f.ym,f.district, count(DISTINCT f.caseid) cases_filed
       FROM filed f JOIN has_ag USING(district,caseid) GROUP BY 1,2),
dfa AS (SELECT f.ym,f.district, count(DISTINCT d.caseid||'|'||d.id) defendants_filed
       FROM filed f JOIN has_ag USING(district,caseid) JOIN defendant d USING(district,caseid) GROUP BY 1,2),
ta AS (SELECT dt.ym,dt.district,
         count(DISTINCT dt.caseid) cases_terminated,
         count(*) defendants_terminated,
         count(*) FILTER (WHERE bucket='guilty') guilty,
         count(*) FILTER (WHERE bucket='not_guilty') not_guilty,
         count(*) FILTER (WHERE bucket='dismissed') dismissed,
         count(*) FILTER (WHERE bucket='rule_20_21') rule_20_21,
         count(*) FILTER (WHERE bucket='other') other
       FROM dterm dt JOIN has_ag USING(district,caseid) GROUP BY 1,2),
all_base AS (
  SELECT coalesce(fa.ym,dfa.ym,ta.ym) ym,
         coalesce(fa.district,dfa.district,ta.district) district,
         'ALL' department,'ALL' subagency,
         coalesce(fa.cases_filed,0) cases_filed,
         coalesce(dfa.defendants_filed,0) defendants_filed,
         coalesce(ta.cases_terminated,0) cases_terminated,
         coalesce(ta.defendants_terminated,0) defendants_terminated,
         coalesce(ta.guilty,0) guilty, coalesce(ta.not_guilty,0) not_guilty,
         coalesce(ta.dismissed,0) dismissed, coalesce(ta.rule_20_21,0) rule_20_21,
         coalesce(ta.other,0) other
  FROM fa FULL JOIN dfa USING(ym,district) FULL JOIN ta USING(ym,district)),
all_group AS (
  SELECT ym,district,department,subagency,'lead' occ,   -- ALL is occ-independent; emit once
    cases_filed,defendants_filed,cases_terminated,defendants_terminated,
    guilty,not_guilty,dismissed,rule_20_21,other
  FROM all_base)
SELECT * FROM per_group UNION ALL SELECT * FROM all_group;
""")

pathlib.Path(PUB).mkdir(exist_ok=True)
con.execute(f"""COPY (SELECT * FROM cube ORDER BY district,department,subagency,occ,ym)
  TO '{PUB}/agency_cube.csv' (FORMAT CSV, HEADER);""")
con.execute(f"""COPY (SELECT * FROM cube ORDER BY district,department,subagency,occ,ym)
  TO '{PUB}/agency_cube.parquet' (FORMAT PARQUET, COMPRESSION ZSTD);""")
con.execute(f"""COPY (
  SELECT ym, department, subagency, occ,
    sum(cases_filed) cases_filed, sum(defendants_filed) defendants_filed,
    sum(cases_terminated) cases_terminated, sum(defendants_terminated) defendants_terminated,
    sum(guilty) guilty, sum(not_guilty) not_guilty, sum(dismissed) dismissed,
    sum(rule_20_21) rule_20_21, sum(other) other
  FROM cube GROUP BY 1,2,3,4 ORDER BY department,subagency,occ,ym
) TO '{PUB}/agency_cube_national.csv' (FORMAT CSV, HEADER);""")
print("cube rows:", con.execute("SELECT count(*) FROM cube").fetchone()[0])
print("national csv distinct subagencies:", con.execute("SELECT count(DISTINCT subagency) FROM cube").fetchone()[0])
print("DONE")
