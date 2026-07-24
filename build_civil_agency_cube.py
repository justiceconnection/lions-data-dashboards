#!/usr/bin/env python3
# build_civil_agency_cube.py - PII-free CIVIL cube by CLIENT/REFERRING AGENCY (Annual Report Table 6).
# Civil "agency" = the federal client agency the U.S. represents/opposes = gs_participant role='CL'
#   (present on ~100% of civil cases; the criminal 'IN' investigative field is empty for civil).
# Grain: month(ym) x district x department x subagency x us_role(Plaintiff/Defendant/Other).
#   Lead client agency = first-entered CL code (arg_min by id); mapped via civil_agency_xwalk.csv.
# Flows mirror the Civil-by-Cause cube:
#   matters_received (recvd_date), cases_filed (real-court filing), matters_terminated (closed, never filed),
#   cases_terminated (real-court disposition/close) + 5 disposition buckets.
# subagency='ALL',department='ALL' rows = distinct total per (ym,district,role) for share denominators.
import duckdb, os, pathlib
PUB='/sessions/vibrant-friendly-brown/mnt/lions/publish'
DB='/sessions/vibrant-friendly-brown/mnt/lions/lions_202605.duckdb'
os.makedirs('/tmp/duckdb_cagency', exist_ok=True)
con=duckdb.connect(DB, read_only=True)
con.execute("PRAGMA temp_directory='/tmp/duckdb_cagency'")
con.execute("SET memory_limit='2500MB'"); con.execute("SET threads=2"); con.execute("SET preserve_insertion_order=false")

con.execute(f"CREATE OR REPLACE TEMP TABLE xw AS SELECT code,department,subagency FROM read_csv('{PUB}/civil_agency_xwalk.csv',header=true);")

# base: one row per civil case with role, lead client agency (dept/sub), dates, is_case, disp
con.execute("""
CREATE OR REPLACE TEMP TABLE civ AS
  SELECT district, caseid,
    CASE WHEN us_role='P' THEN 'Plaintiff' WHEN us_role='D' THEN 'Defendant' ELSE 'Other' END AS role,
    recvd_date, close_date
  FROM gs_case WHERE class='V';""")
con.execute("""
CREATE OR REPLACE TEMP TABLE cl AS
  SELECT DISTINCT p.district,p.caseid,p.agency,p.id
  FROM gs_participant p JOIN civ USING(district,caseid)
  WHERE p.role='CL' AND p.agency IS NOT NULL;""")
con.execute("""CREATE OR REPLACE TEMP TABLE lead AS
  SELECT district,caseid,arg_min(agency,id) code FROM cl GROUP BY 1,2;""")
con.execute("""
CREATE OR REPLACE TEMP TABLE casefile AS
  SELECT district,caseid,min(filing_date) filing_date,count(*) ncourt
  FROM gs_court_hist WHERE court NOT IN ('NC','MM','MD','PN') GROUP BY 1,2;""")
con.execute("""
CREATE OR REPLACE TEMP TABLE caseterm AS
  SELECT district,caseid,arg_max(disposition,disp_date) disp,max(disp_date) tdate
  FROM gs_court_hist WHERE court NOT IN ('NC','MM','MD','PN')
    AND disposition NOT IN ('PC','NW','OE') AND disp_date>=DATE '1950-01-01' GROUP BY 1,2;""")
con.execute("""
CREATE OR REPLACE TEMP TABLE base AS
SELECT c.district,c.caseid,c.role,
  coalesce(x.department,'Other') department, coalesce(x.subagency,'Other') subagency,
  c.recvd_date,c.close_date,
  (cf.ncourt IS NOT NULL) is_case,
  CASE WHEN cf.ncourt IS NOT NULL THEN coalesce(cf.filing_date,c.recvd_date) END filed_date,
  CASE WHEN cf.ncourt IS NOT NULL THEN coalesce(ct.tdate,c.close_date) END term_date,
  ct.disp
FROM civ c
LEFT JOIN lead l USING(district,caseid)
LEFT JOIN xw x ON x.code=l.code
LEFT JOIN casefile cf USING(district,caseid)
LEFT JOIN caseterm ct USING(district,caseid);""")

con.execute("""
CREATE OR REPLACE TEMP TABLE flows AS
SELECT strftime(recvd_date,'%Y-%m') ym,district,department,subagency,role,1 m_recv,0 c_filed,0 m_term,0 c_term,NULL::VARCHAR db
  FROM base WHERE recvd_date>=DATE '1994-10-01' AND recvd_date<DATE '2026-06-01'
UNION ALL
SELECT strftime(filed_date,'%Y-%m'),district,department,subagency,role,0,1,0,0,NULL
  FROM base WHERE is_case AND filed_date>=DATE '1994-10-01' AND filed_date<DATE '2026-06-01'
UNION ALL
SELECT strftime(close_date,'%Y-%m'),district,department,subagency,role,0,0,1,0,NULL
  FROM base WHERE (NOT is_case) AND close_date IS NOT NULL AND close_date>=DATE '1994-10-01' AND close_date<DATE '2026-06-01'
UNION ALL
SELECT strftime(term_date,'%Y-%m'),district,department,subagency,role,0,0,0,1,
  CASE WHEN disp IN ('JU','JX','JJ') THEN 'Judgment For U.S.'
       WHEN disp IN ('JO','JY','JT') THEN 'Judgment Against U.S.'
       WHEN disp IN ('SA','SB')      THEN 'Settlements'
       WHEN disp='VD'                THEN 'Dismissed'
       ELSE 'Other' END
  FROM base WHERE is_case AND term_date IS NOT NULL AND term_date>=DATE '1994-10-01' AND term_date<DATE '2026-06-01';""")

con.execute("""
CREATE OR REPLACE TEMP TABLE cube AS
WITH per AS (
  SELECT ym,district,department,subagency,role,
    sum(m_recv) matters_received,sum(c_filed) cases_filed,sum(m_term) matters_terminated,sum(c_term) cases_terminated,
    sum(c_term) FILTER (WHERE db='Judgment For U.S.') d_judg_us,
    sum(c_term) FILTER (WHERE db='Settlements') d_settle,
    sum(c_term) FILTER (WHERE db='Judgment Against U.S.') d_against,
    sum(c_term) FILTER (WHERE db='Dismissed') d_dismissed,
    sum(c_term) FILTER (WHERE db='Other') d_other
  FROM flows GROUP BY 1,2,3,4,5),
allc AS (
  SELECT ym,district,'ALL' department,'ALL' subagency,role,
    sum(m_recv),sum(c_filed),sum(m_term),sum(c_term),
    sum(c_term) FILTER (WHERE db='Judgment For U.S.'),
    sum(c_term) FILTER (WHERE db='Settlements'),
    sum(c_term) FILTER (WHERE db='Judgment Against U.S.'),
    sum(c_term) FILTER (WHERE db='Dismissed'),
    sum(c_term) FILTER (WHERE db='Other')
  FROM flows GROUP BY 1,2,5)
SELECT * FROM per UNION ALL SELECT * FROM allc;""")

pathlib.Path(PUB).mkdir(exist_ok=True)
con.execute(f"""COPY (SELECT * FROM cube ORDER BY district,role,department,subagency,ym)
  TO '{PUB}/civil_agency_cube.csv' (FORMAT CSV,HEADER);""")
con.execute(f"""COPY (SELECT * FROM cube ORDER BY district,role,department,subagency,ym)
  TO '{PUB}/civil_agency_cube.parquet' (FORMAT PARQUET,COMPRESSION ZSTD);""")
con.execute(f"""COPY (
  SELECT ym,department,subagency,role,
    sum(matters_received) matters_received,sum(cases_filed) cases_filed,
    sum(matters_terminated) matters_terminated,sum(cases_terminated) cases_terminated,
    sum(d_judg_us) d_judg_us,sum(d_settle) d_settle,sum(d_against) d_against,
    sum(d_dismissed) d_dismissed,sum(d_other) d_other
  FROM cube GROUP BY 1,2,3,4 ORDER BY role,department,subagency,ym
) TO '{PUB}/civil_agency_cube_national.csv' (FORMAT CSV,HEADER);""")
print("cube rows:",con.execute("SELECT count(*) FROM cube").fetchone()[0])
print("distinct subagencies:",con.execute("SELECT count(DISTINCT subagency) FROM cube").fetchone()[0])
print("DONE")
