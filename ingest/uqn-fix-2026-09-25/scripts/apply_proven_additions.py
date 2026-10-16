"""إضافة سجلات التحقق المثبتة وأداة الإصدار تُقرأ من uqn_fix. لا UPDATE ولا DELETE على سجل قائم.

التشغيل:
  DATABASE_URL=... python scripts/apply_proven_additions.py          # خطة فقط
  DATABASE_URL=... python scripts/apply_proven_additions.py --apply  # إدراج
"""
import hashlib, json, os, pathlib, re, sys, unicodedata
import psycopg

ROOT = pathlib.Path(__file__).resolve().parent.parent
APPLY = "--apply" in sys.argv

WORK_STATUS = {
    "replace": "مستبدل",
    "repeal": "ملغى",
    "repeal_with_saving": "ملغى مع بقاء أحكام محددة مؤقتًا",
}
ARTICLE_STATUS = {
    "replace": "مستبدل",
    "repeal": "ملغاة",
}
# النص المخزّن هو النظام الجديد، لا القديم. لا يُوسَم مستبدلًا.
NEW_TEXT = {
    "نظام التنفيذ": ("صادر لم يسرِ بعد", "%م/237%"),
    "نظام السجل التجاري": ("ساري", "%م/83%"),
    "نظام الأسماء التجارية": ("ساري", "%م/83%"),
}


def law_slug(name: str) -> str:
    name = unicodedata.normalize("NFKC", name)
    name = re.sub(r"[ً-ْٰـ]", "", name)
    name = re.sub(r"[إأآا]", "ا", name).replace("ى", "ي").replace("ة", "ه")
    name = re.sub(r"[^\u0600-\u06FF0-9]+", "-", name)
    return name.strip("-").lower()


def sid(*parts: str) -> str:
    return "fix25-" + hashlib.sha256("|".join(parts).encode()).hexdigest()[:24]


def main() -> None:
    url = os.environ["DATABASE_URL"]
    sup = [json.loads(l) for l in open(ROOT / "data" / "supersessions_verified.jsonl", encoding="utf-8") if l.strip()]
    con = psycopg.connect(url, connect_timeout=30)
    con.execute("SET statement_timeout = '120s'")
    cur = con.cursor()
    if APPLY:
        migration = (ROOT.parents[1] / "prisma" / "migrations" / "20260925140000_verification_layer" / "migration.sql").read_text(encoding="utf-8")
        cur.execute(migration)
        con.commit()
        print("migration=applied")

    cur.execute("SELECT to_regclass('public.verification') IS NOT NULL")
    has_verification = cur.fetchone()[0]
    cur.execute("SELECT to_regclass('uqn_fix.supersession_evidence') IS NOT NULL")
    has_fix = cur.fetchone()[0]
    print(f"verification_table={has_verification} uqn_fix={has_fix} mode={'apply' if APPLY else 'plan'}")
    if APPLY and (not has_verification or not has_fix):
        raise SystemExit("الجداول المطلوبة غير موجودة بعد التحميل")

    cur.execute('SELECT name, id FROM legal_systems')
    by_name = {n: i for n, i in cur.fetchall()}

    plan = []
    if "نظام تأديب الموظفين" not in by_name:
        plan.append(("system", "نظام تأديب الموظفين", "نص غير متاح"))

    for row in sup:
        title = row["old_title"]
        if row["status"] != "proven":
            plan.append(("skip", title, row["status"]))
            continue
        if title in NEW_TEXT:
            status, decree_like = NEW_TEXT[title]
            cur.execute(
                'SELECT count(*) FROM legal_articles WHERE "lawName"=%s AND coalesce("royalDecree",\'\') LIKE %s',
                (title, decree_like),
            )
            n = cur.fetchone()[0]
            plan.append(("new_text_work", title, status))
            plan.append(("new_text_articles", title, f"{status} x{n}"))
            continue
        if title not in by_name and title != "نظام تأديب الموظفين":
            plan.append(("missing", title, "no system"))
            continue
        cur.execute('SELECT count(*) FROM legal_articles WHERE "lawName"=%s', (title,))
        n = cur.fetchone()[0]
        plan.append(("old_work", title, WORK_STATUS[row["relation"]]))
        if row["relation"] in ARTICLE_STATUS:
            plan.append(("old_articles", title, f"{ARTICLE_STATUS[row['relation']]} x{n}"))
        new_id = by_name.get(row["new_title"])
        old_id = by_name.get(title)
        if new_id and old_id and new_id != old_id:
            plan.append(("relation", f"{row['new_title']} -> {title}", "SUPERSEDES"))
        elif title == "نظام تأديب الموظفين":
            plan.append(("relation", f"{row['new_title']} -> {title}", "SUPERSEDES"))

    for kind, a, b in plan:
        print(f"{kind}\t{b}\t{a}")
    if not APPLY:
        con.rollback()
        con.close()
        return

    before = stat(cur)
    inserted = {"verification": 0, "relation": 0, "system": 0}

    def add_verification(object_type, object_id, status, instrument, url_ev, quote):
        vid = sid(object_type, object_id, status, url_ev or "")
        cur.execute(
            """INSERT INTO verification
               (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by)
               VALUES (%s,%s,%s,%s,%s,%s,%s,'manual','fix-2026-09-25')
               ON CONFLICT (id) DO NOTHING""",
            (vid, object_type, object_id, status, instrument, url_ev, quote),
        )
        inserted["verification"] += cur.rowcount

    if "نظام تأديب الموظفين" not in by_name:
        new_sys = sid("system", "نظام تأديب الموظفين")
        slug = law_slug("نظام تأديب الموظفين")
        cur.execute(
            """INSERT INTO legal_systems (id, name, "articleCount", preamble, eli_slug, "createdAt", "updatedAt")
               VALUES (%s, %s, 0, 'نص غير متاح', %s, NOW(), NOW())
               ON CONFLICT (name) DO NOTHING""",
            (new_sys, "نظام تأديب الموظفين", slug),
        )
        inserted["system"] += cur.rowcount
        cur.execute("SELECT id FROM legal_systems WHERE name=%s", ("نظام تأديب الموظفين",))
        by_name["نظام تأديب الموظفين"] = cur.fetchone()[0]

    for row in sup:
        title = row["old_title"]
        if row["status"] != "proven":
            continue
        instrument = f"{row.get('old_instrument') or ''} — من {row.get('effective_from_gregorian') or 'غير محدد'}"
        quote = row.get("evidence_quote")
        ev_url = row.get("evidence_url")
        if title in NEW_TEXT:
            status, decree_like = NEW_TEXT[title]
            cur.execute('SELECT preamble_royal_decree FROM legal_systems WHERE name=%s', (title,))
            preamble = cur.fetchone()[0] or instrument
            instrument = f"{preamble} — من {row.get('effective_from_gregorian')}"
            add_verification("work", by_name[title], status, instrument, ev_url, quote)
            cur.execute(
                'SELECT id FROM legal_articles WHERE "lawName"=%s AND coalesce("royalDecree",\'\') LIKE %s',
                (title, decree_like),
            )
            for (aid,) in cur.fetchall():
                add_verification("unit", aid, status, instrument, ev_url, quote)
            continue
        old_id = by_name[title]
        status = WORK_STATUS[row["relation"]]
        add_verification("work", old_id, status, instrument, ev_url, quote)
        article_status = ARTICLE_STATUS.get(row["relation"])
        if article_status:
            cur.execute('SELECT id FROM legal_articles WHERE "lawName"=%s', (title,))
            for (aid,) in cur.fetchall():
                add_verification("unit", aid, article_status, instrument, ev_url, quote)
        new_id = by_name.get(row["new_title"])
        if new_id and new_id != old_id:
            rid = sid("rel", new_id, old_id)
            cur.execute(
                """INSERT INTO legal_relations
                   (id, source_type, source_id, target_type, target_id, relation, description, status)
                   VALUES (%s,'system',%s,'system',%s,'SUPERSEDES','REPLACES fix-2026-09-25','VERIFIED')
                   ON CONFLICT (id) DO NOTHING""",
                (rid, new_id, old_id),
            )
            inserted["relation"] += cur.rowcount

    # ممنوعات
    cur.execute(
        """SELECT count(*) FROM verification v
           JOIN legal_systems s ON s.id=v.object_id
           WHERE v.object_type='work' AND s.name='نظام مدينة الملك عبدالله للطاقة الذرية والمتجددة'"""
    )
    banned = cur.fetchone()[0]
    cur.execute(
        """SELECT count(*) FROM verification v
           JOIN legal_systems s ON s.id=v.object_id
           WHERE v.object_type='work' AND v.verified_status='مستبدل'
             AND s.name IN ('نظام التنفيذ','نظام السجل التجاري','نظام الأسماء التجارية')"""
    )
    wrong = cur.fetchone()[0]
    if banned or wrong:
        con.rollback()
        raise SystemExit(f"أُلغي الإدراج: king_abdullah={banned} wrong_replaced={wrong}")
    con.commit()
    after = stat(cur)
    print("inserted", inserted)
    print("public_deltas")
    for key in sorted(set(before) | set(after)):
        b = before.get(key, (0, 0, 0))
        a = after.get(key, (0, 0, 0))
        ins, upd, dele = a[0] - b[0], a[1] - b[1], a[2] - b[2]
        if ins or upd or dele:
            print(f"  {key} ins={ins} upd={upd} del={dele}")
    con.close()


def stat(cur):
    cur.execute(
        """SELECT schemaname||'.'||relname, n_tup_ins, n_tup_upd, n_tup_del
           FROM pg_stat_user_tables
           WHERE schemaname IN ('public','uqn_fix')"""
    )
    return {n: (i, u, d) for n, i, u, d in cur.fetchall()}


if __name__ == "__main__":
    main()
