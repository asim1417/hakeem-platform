"""الموجة ١ — وجه البحث + بطاقات الأنظمة. إضافة فقط.

يكتب صفوفًا جديدة في search_surface وsearch_surface_member وlaw_card فقط.
لا UPDATE ولا DELETE ولا TRUNCATE ولا DROP على أي جدول قائم. لا يمس legal_systems ولا legal_articles ولا verification.

الأهداف:
  --target staging     DATABASE_URL على 127.0.0.1/localhost فقط (المختبر أو فرع تجريبي محلي).
  --target branch      DATABASE_URL على فرع Neon تجريبي (المضيف .neon.tech وليس ep-icy-rice).
  --target production  DATABASE_UR على ep-icy-rice…neon.tech فقط، ومع HAKEEM_INJECT=yes (بعد كلمة المالك: احقن).
  --preview            ينفّذ كل شيء داخل معاملة ثم يتراجع ويطبع الأرقام فقط.

لا يطبع سلسلة الاتصال ولا كلمة مرور.
"""
import argparse
import hashlib
import json
import os
import pathlib
import sys

import psycopg

ROOT = pathlib.Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
MIGRATION = REPO / "prisma" / "migrations" / "20260928120000_search_surface_law_card" / "migration.sql"
BUILD_DATE = "2026-09-28"
BY = "surface-wave1-2026-09-28"
GUARD = {
    ("نظام التنفيذ", 1): "0c1443e1dcdf68c655856daa5d4188b5",
    ("نظام المعاملات المدنية", 1): "bb195018b612438b9d03d9c2b2ef80c4",
}
MIXED_COUNTS = {"نظام التنفيذ": 98, "نظام السجل التجاري": 29, "نظام الأسماء التجارية": 23}
RETIRED = ("ملغى", "مستبدل", "ملغى مع بقاء أحكام محددة مؤقتًا", "سجل مخلوط — لا يُعرض")
WATCH = ("legal_systems", "legal_articles", "verification")


def host(url: str) -> str:
    return url.split("@")[-1].split("/")[0].split("?")[0]


def sid(prefix: str, *parts: str) -> str:
    return prefix + hashlib.sha256("|".join(parts).encode()).hexdigest()[:24]


def connect(target: str) -> psycopg.Connection:
    if target == "production":
        if os.environ.get("HAKEEM_INJECT") != "yes":
            raise SystemExit("مرفوض: الإنتاج يحتاج HAKEEM_INJECT=yes بعد كلمة المالك «احقن»")
        url = os.environ.get("DATABASE_UR", "")
        h = host(url)
        if "ep-icy-rice" not in h or not h.split(":")[0].endswith(".neon.tech"):
            raise SystemExit("مرفوض: الهدف ليس مضيف الإنتاج المعروف")
    else:
        url = os.environ.get("DATABASE_URL", "")
        h = host(url).split(":")[0]
        if target == "staging" and h not in ("127.0.0.1", "localhost"):
            raise SystemExit("مرفوض: staging يقبل 127.0.0.1 أو localhost فقط")
        if target == "branch" and (not h.endswith(".neon.tech") or "ep-icy-rice" in h):
            raise SystemExit("مرفوض: branch يقبل فرع Neon غير الإنتاج فقط")
    print("target", target, "host_prefix", host(url).split(".")[0][:10])
    return psycopg.connect(url, connect_timeout=30)


def stats(cur) -> dict:
    cur.execute("SELECT relname, n_tup_upd, n_tup_del FROM pg_stat_user_tables WHERE relname = ANY(%s)", (list(WATCH),))
    return {r[0]: (r[1], r[2]) for r in cur.fetchall()}


def guards(cur, strict: bool) -> dict:
    out = {}
    for (law, num), expect in GUARD.items():
        cur.execute('SELECT md5(content) FROM legal_articles WHERE "lawName"=%s AND "articleNumber"=%s ORDER BY id', (law, num))
        rows = [r[0] for r in cur.fetchall()]
        out[law] = rows
        if strict and rows != [expect]:
            raise SystemExit(f"حارس md5 فشل: {law}")
    for law in MIXED_COUNTS:
        cur.execute('SELECT count(*) FROM legal_articles WHERE "lawName"=%s', (law,))
        out["count:" + law] = cur.fetchone()[0]
        if strict and out["count:" + law] != MIXED_COUNTS[law]:
            raise SystemExit(f"عدد السجل المخلوط غير المتوقع: {law}")
    return out


def totals(cur) -> dict:
    t = {}
    for q, k in (
        ("SELECT count(*) FROM legal_systems", "systems"),
        ("SELECT count(*) FROM legal_articles", "articles"),
        ("SELECT count(*) FROM verification", "verification"),
        ("SELECT count(*) FROM search_surface", "search_surface"),
        ("SELECT count(*) FROM search_surface_member", "search_surface_member"),
        ("SELECT count(*) FROM law_card", "law_card"),
    ):
        cur.execute(q)
        t[k] = cur.fetchone()[0]
    return t


class Writer:
    def __init__(self, cur):
        self.cur = cur
        self.n = {"member": 0, "surface": 0, "law_card": 0}

    def member(self, work_key: str, system_id: str, role: str) -> None:
        self.cur.execute(
            """INSERT INTO search_surface_member (id, work_key, system_id, role, created_by)
               VALUES (%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING""",
            (sid("sm26-", work_key, system_id), work_key, system_id, role, BY),
        )
        self.n["member"] += self.cur.rowcount

    def latest(self, work_key: str):
        self.cur.execute(
            "SELECT id, surface_system_id, valid_on FROM search_surface WHERE work_key=%s ORDER BY valid_on DESC, created_at DESC, id DESC LIMIT 1",
            (work_key,),
        )
        return self.cur.fetchone()

    def surface(self, work_key: str, surface_id, valid_on: str, reason: str, supersedes) -> str:
        rid = sid("ss26-", work_key, str(surface_id), valid_on, reason)
        self.cur.execute(
            """INSERT INTO search_surface (id, work_key, surface_system_id, valid_on, reason, supersedes_surface_id, created_by)
               SELECT %s,%s,%s,%s,%s,%s,%s WHERE NOT EXISTS (SELECT 1 FROM search_surface WHERE id=%s)""",
            (rid, work_key, surface_id, valid_on, reason, supersedes, BY, rid),
        )
        self.n["surface"] += self.cur.rowcount
        return rid


def build_families(w: Writer) -> list:
    """نوافذ work_edition: صف وجه لكل إصدار يبدأ من valid_from. القراءة تختار الساري لليوم."""
    cur = w.cur
    cur.execute(
        """SELECT mixed_system_id, edition_system_id, role, valid_from, valid_to, coalesce(instrument,'')
           FROM work_edition ORDER BY mixed_system_id, valid_from, edition_system_id"""
    )
    fams: dict = {}
    for mixed, ed, role, vf, vt, ins in cur.fetchall():
        fams.setdefault(mixed, []).append((ed, role, vf.isoformat(), vt.isoformat() if vt else None, ins))
    report = []
    for mixed, eds in fams.items():
        wk = "we:" + mixed
        w.member(wk, mixed, "mixed")
        prev = None
        for ed, role, vf, vt, ins in eds:
            w.member(wk, ed, "edition_old" if role == "old" else "edition_new")
        for ed, role, vf, vt, ins in eds:
            prev = w.surface(wk, ed, vf, f"work_edition:{role} {ins} valid_from={vf}" + (f" valid_to={vt}" if vt else ""), prev)
        # نافذة مقفلة بلا خلف مسجَّل: عند valid_to يخرج العمل من وجه الساري.
        last = eds[-1]
        if last[3]:
            w.surface(wk, None, last[3], f"work_edition:closed valid_to={last[3]}", prev)
        report.append((wk, [(e[0], e[2], e[3]) for e in eds]))
    return report


def family_members(cur) -> set:
    cur.execute("SELECT system_id FROM search_surface_member WHERE work_key LIKE 'we:%%'")
    return {r[0] for r in cur.fetchall()}


def build_retired(w: Writer) -> list:
    """نظام آخر تحققه ملغى/مستبدل/مخلوط، أو كل مواده ملغاة: يخرج من وجه الساري (الأرشيف يبقى)."""
    cur = w.cur
    in_family = family_members(cur)
    cur.execute(
        """SELECT DISTINCT ON (object_id) object_id, verified_status, id
           FROM verification WHERE object_type='work'
           ORDER BY object_id, verified_at DESC, id DESC"""
    )
    latest = {r[0]: (r[1], r[2]) for r in cur.fetchall()}
    cur.execute(
        """SELECT "legalSystemId", count(*) FROM legal_articles
           WHERE "legalSystemId" IS NOT NULL
           GROUP BY 1 HAVING bool_and(status = 'ملغاة')"""
    )
    all_repealed = {r[0]: r[1] for r in cur.fetchall()}
    cur.execute("SELECT id FROM legal_systems")
    existing = {r[0] for r in cur.fetchall()}
    out = []
    candidates = set(all_repealed) | {k for k, (st, _) in latest.items() if st in RETIRED}
    for sys_id in sorted(candidates):
        if sys_id not in existing or sys_id in in_family:
            continue
        st, vid = latest.get(sys_id, (None, None))
        if st in RETIRED:
            reason = f"verification:{st} ({vid})"
        elif st in ("ساري", "مضافة"):
            # تحقق يقول ساري يغلب قاعدة «كل المواد ملغاة»: لا يُخفى، ويُسجَّل للمراجعة فقط.
            out.append((sys_id, "skipped_verified_in_force", all_repealed.get(sys_id)))
            continue
        else:
            reason = f"all_articles_repealed:{all_repealed[sys_id]}"
        wk = "sys:" + sys_id
        w.member(wk, sys_id, "retired")
        cur_row = w.latest(wk)
        if cur_row and cur_row[1] is None:
            out.append((sys_id, "already_retired", reason))
            continue
        w.surface(wk, None, BUILD_DATE, reason, cur_row[0] if cur_row else None)
        out.append((sys_id, "retired", reason))
    # إعادة: عمل مُخرَج سابقًا ثم صار آخر تحققه «ساري» → صف جديد يعيده (لا تعديل للصف القديم).
    cur.execute("SELECT DISTINCT work_key FROM search_surface WHERE work_key LIKE 'sys:%%'")
    for (wk,) in cur.fetchall():
        sys_id = wk[4:]
        row = w.latest(wk)
        st = latest.get(sys_id, (None, None))[0]
        if row and row[1] is None and st in ("ساري", "مضافة") and sys_id not in all_repealed:
            w.surface(wk, sys_id, BUILD_DATE, f"verification:{st} restores", row[0])
            out.append((sys_id, "restored", st))
    return out


def load_law_cards(w: Writer) -> list:
    cur = w.cur
    rows = [json.loads(x) for x in (ROOT / "data" / "law_cards_boe.jsonl").read_text(encoding="utf-8").splitlines() if x.strip()]
    report = []
    for r in rows:
        cur.execute("SELECT id FROM legal_systems WHERE name=%s", (r["hakeem_title"],))
        found = [x[0] for x in cur.fetchall()]
        if len(found) != 1:
            report.append((r["hakeem_title"], "no_unique_system", len(found)))
            continue
        system_id = found[0]
        payload = json.dumps({k: r[k] for k in sorted(r) if k != "hakeem_title"}, ensure_ascii=False, sort_keys=True)
        cid = sid("lc26-", system_id, hashlib.sha256(payload.encode()).hexdigest())
        cur.execute(
            """INSERT INTO law_card (id, system_id, official_name, summary, issued_hijri, issued_gregorian,
                 published_hijri, published_gregorian, status_at_source, category_path, instruments, text_blocks,
                 source_name, source_url, retrieved_on, created_by)
               SELECT %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s::jsonb,%s,%s,%s,%s
               WHERE NOT EXISTS (SELECT 1 FROM law_card WHERE id=%s)""",
            (
                cid, system_id, r["official_name"], r["summary"], r["issued_hijri"], r["issued_gregorian"],
                r["published_hijri"], r["published_gregorian"], r["status_at_source"], r["category_path"],
                json.dumps(r["instruments"], ensure_ascii=False), json.dumps(r["text_blocks"], ensure_ascii=False),
                r["source_name"], r["source_url"], r["retrieved_on"], BY, cid,
            ),
        )
        w.n["law_card"] += cur.rowcount
        report.append((r["hakeem_title"], "card", cur.rowcount))
    return report


def surface_on(cur, as_of: str) -> dict:
    cur.execute(
        """SELECT DISTINCT ON (work_key) work_key, surface_system_id FROM search_surface
           WHERE valid_on <= %s ORDER BY work_key, valid_on DESC, created_at DESC, id DESC""",
        (as_of,),
    )
    return dict(cur.fetchall())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", choices=["staging", "branch", "production"], required=True)
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--no-cards", action="store_true")
    ap.add_argument("--report", default=None, help="مسار JSON لحفظ الأرقام")
    a = ap.parse_args()
    strict = a.target == "production"
    con = connect(a.target)
    con.execute("SET statement_timeout = '180s'")
    rep: dict = {"target": a.target, "preview": a.preview, "build_date": BUILD_DATE}
    with con.cursor() as cur:
        before = stats(cur)
        rep["guards_before"] = guards(cur, strict)
        cur.execute(MIGRATION.read_text(encoding="utf-8"))
        rep["totals_before"] = totals(cur)
        w = Writer(cur)
        rep["families"] = build_families(w)
        rep["retired"] = build_retired(w)
        rep["law_cards"] = [] if a.no_cards else load_law_cards(w)
        rep["inserted"] = dict(w.n)
        rep["guards_after"] = guards(cur, strict)
        if rep["guards_after"] != rep["guards_before"]:
            con.rollback()
            raise SystemExit("الحارس أو عدد المخلوط تغيّر داخل المعاملة — أُلغيت")
        rep["totals_after"] = totals(cur)
        for k in ("systems", "articles", "verification"):
            if rep["totals_after"][k] != rep["totals_before"][k]:
                con.rollback()
                raise SystemExit(f"عدد {k} تغيّر — أُلغيت")
        rep["surface_on"] = {d: surface_on(cur, d) for d in ("2026-09-28", "2026-10-27", "2026-10-28")}
        if a.preview:
            con.rollback()
            rep["committed"] = False
        else:
            con.commit()
            rep["committed"] = True
    with con.cursor() as cur:
        after = stats(cur)
        rep["stat_delta"] = {k: (after[k][0] - before[k][0], after[k][1] - before[k][1]) for k in before if k in after}
    con.close()
    for k, v in rep["stat_delta"].items():
        print("STAT", k, "upd", v[0], "del", v[1])
    print("INSERTED", rep["inserted"], "committed", rep["committed"])
    print("TOTALS_BEFORE", rep["totals_before"])
    print("TOTALS_AFTER ", rep["totals_after"])
    if a.report:
        pathlib.Path(a.report).write_text(json.dumps(rep, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    if any(v != (0, 0) for v in rep["stat_delta"].values()):
        print("تحذير: حركة تحديث/حذف على جدول محروس", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
