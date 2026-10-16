"""تحميل حزمة الإصلاح إلى uqn_fix — إضافة فقط (ON CONFLICT DO NOTHING). لا UPDATE ولا DELETE.
الاستخدام: DATABASE_URL=... python scripts/load_fix.py [--dry-run]"""
import json, os, sys, hashlib, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent; D = ROOT / 'data'
jl = lambda p: [json.loads(l) for l in open(p, encoding='utf-8') if l.strip()]
snap = json.load(open(D / 'source_snapshots.json', encoding='utf-8'))
sup = jl(D / 'supersessions_verified.jsonl'); iss = jl(D / 'issuance_instruments_16.jsonl')
ops = jl(D / 'amendment_operations.jsonl'); man = jl(D / 'amendment_manual_queue.jsonl')
print(f'snapshots={len(snap)} supersessions={len(sup)} issuance={len(iss)} ops={len(ops)} manual={len(man)}')
if '--dry-run' in sys.argv: sys.exit(0)
import psycopg
from psycopg.types.json import Jsonb
with psycopg.connect(os.environ['DATABASE_URL']) as con, con.cursor() as cur:
    cur.execute((ROOT / 'schema' / 'fix_stage.sql').read_text(encoding='utf-8'))
    cur.executemany("INSERT INTO uqn_fix.source_snapshot VALUES (%s,%s,%s,'2026-09-25') ON CONFLICT DO NOTHING",
                    [(u, t, hashlib.sha256(t.encode()).hexdigest()) for u, t in snap.items()])
    cur.executemany("""INSERT INTO uqn_fix.supersession_evidence(old_title,old_hakeem_code,old_instrument,new_title,new_source_url,relation,
        evidence_quote,evidence_url,evidence_location,published_hijri,effective_from_hijri,effective_from_gregorian,effective_rule,status,notes)
        VALUES (%(old_title)s,%(old_hakeem_code)s,%(old_instrument)s,%(new_title)s,%(new_source_url)s,%(relation)s,%(evidence_quote)s,%(evidence_url)s,
        %(evidence_location)s,%(published_hijri)s,%(effective_from_hijri)s,%(effective_from_gregorian)s,%(effective_rule)s,%(status)s,%(notes)s)
        ON CONFLICT DO NOTHING""", sup)
    cur.executemany("""INSERT INTO uqn_fix.issuance_instrument(law_title,instrument_kind,instrument_no,instrument_date_hijri,instrument_title,source_url,approving_clause,status)
        VALUES (%(law_title)s,%(instrument_kind)s,%(instrument_no)s,%(instrument_date_hijri)s,%(instrument_title)s,%(source_url)s,%(approving_clause)s,%(status)s)
        ON CONFLICT DO NOTHING""", iss)
    cols = ['op_id','effect_id','instrument_kind','instrument_no','instrument_date_hijri','published_hijri','source_url','target_law_title','target_hakeem_code',
            'target_resolution','op_type','article_number','paragraph_label','term','new_text','old_phrase','new_phrase','scope','renumber',
            'effective_from_hijri','effective_from_gregorian','effective_rule','effective_clauses_in_instrument','risks','confidence','verbatim_in_source',
            'evidence_quote','also_in','raw']
    def row(o):
        r = {c: o.get(c) for c in cols}
        r['risks'] = o.get('risks', []); r['also_in'] = o.get('also_in', []); r['raw'] = Jsonb(o)
        r['effective_clauses_in_instrument'] = Jsonb(o.get('effective_clauses_in_instrument')) if o.get('effective_clauses_in_instrument') else None
        r['target_law_title'] = o.get('target_law_title') or ''
        return r
    cur.executemany(f"INSERT INTO uqn_fix.amendment_op({','.join(cols)}) VALUES ({','.join('%('+c+')s' for c in cols)}) ON CONFLICT DO NOTHING", [row(o) for o in ops])
    cur.executemany("""INSERT INTO uqn_fix.amendment_manual VALUES (%(effect_id)s,%(effect_type)s,%(instrument_kind)s,%(instrument_no)s,%(instrument_date_hijri)s,
        %(source_url)s,%(target_title_as_cited)s,%(unparsed)s,%(ops_extracted)s) ON CONFLICT DO NOTHING""",
        [dict(m, unparsed=Jsonb(m['unparsed_items'])) for m in man])
    con.commit()
print('تم التحميل (إضافة فقط)')
