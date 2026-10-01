"""يحقن على الإنتاج ما وافق عليه المالك: إصدارات السجلات المخلوطة، والأنظمة الأربعة الناقصة.

الإضافة فقط. لا UPDATE ولا DELETE على صف قائم.
يُشغَّل فقط مع HAKEEM_INJECT=yes وعلى مضيف الإنتاج المعروف.
"""
import hashlib
import json
import os
import pathlib
import sys

import psycopg
from hijri_converter import Hijri

ROOT = pathlib.Path(__file__).resolve().parents[1]
TODAY = "2026-09-26"
GUARD = {
    ("نظام التنفيذ", 1): "0c1443e1dcdf68c655856daa5d4188b5",
    ("نظام المعاملات المدنية", 1): "bb195018b612438b9d03d9c2b2ef80c4",
}


def host(url: str) -> str:
    return url.split("@")[-1].split("/")[0]


def sid(prefix: str, *parts: str) -> str:
    return prefix + hashlib.sha256("|".join(parts).encode()).hexdigest()[:24]


def gdate(hijri: str) -> str:
    y, m, d = map(int, hijri.split("-"))
    g = Hijri(y, m, d).to_gregorian()
    return f"{g.year:04d}-{g.month:02d}-{g.day:02d}"


def law_slug(name: str) -> str:
    import re
    import unicodedata

    name = unicodedata.normalize("NFKC", name)
    name = re.sub(r"[ً-ْٰـ]", "", name)
    name = re.sub(r"[إأآا]", "ا", name).replace("ى", "ي").replace("ة", "ه")
    name = re.sub(r"[^\u0600-\u06FF0-9]+", "-", name)
    return name.strip("-").lower()


SPECS = [
    {
        "mixed": "نظام التنفيذ",
        "old_name": "نظام التنفيذ الصادر بالمرسوم الملكي رقم (م/53) وتاريخ 1433/8/13هـ",
        "old_instrument": "م/53 وتاريخ 1433/8/13هـ",
        "old_from": gdate("1433-08-13"),
        "old_to": "2026-10-28",
        "old_count": 98,
        "new_name": "نظام التنفيذ الصادر بالمرسوم الملكي رقم (م/237) وتاريخ 1447/11/03هـ",
        "new_instrument": "مرسوم ملكي رقم م/237 بتاريخ 1447-11-03",
        "new_from": "2026-10-28",
        "new_count": 65,
    },
    {
        "mixed": "نظام السجل التجاري",
        "old_name": "نظام السجل التجاري الصادر بالمرسوم الملكي رقم (م/1) وتاريخ 1416/2/21هـ",
        "old_instrument": "م/1 وتاريخ 1416/2/21هـ",
        "old_from": gdate("1416-02-21"),
        "old_to": "2025-04-02",
        "old_count": 20,
        "new_name": "نظام السجل التجاري الصادر بالمرسوم الملكي رقم (م/83) وتاريخ 1446/03/19هـ",
        "new_instrument": "مرسوم ملكي رقم م/83 بتاريخ 1446-03-19",
        "new_from": "2025-04-02",
        "new_count": 29,
    },
    {
        "mixed": "نظام الأسماء التجارية",
        "old_name": "نظام الأسماء التجارية الصادر بالمرسوم الملكي رقم (م/15) وتاريخ 1420/8/12هـ",
        "old_instrument": "م/15 وتاريخ 1420/8/12هـ",
        "old_from": gdate("1420-08-12"),
        "old_to": "2025-04-02",
        "old_count": 20,
        "new_name": "نظام الأسماء التجارية الصادر بالمرسوم الملكي رقم (م/83) وتاريخ 1446/03/19هـ",
        "new_instrument": "مرسوم ملكي رقم م/83 بتاريخ 1446-03-19",
        "new_from": "2025-04-02",
        "new_count": 23,
    },
]


def instrument_of(row: dict) -> str:
    if row.get("royal_decree_no"):
        return f"مرسوم ملكي رقم {row['royal_decree_no']} وتاريخ {row.get('royal_decree_date_hijri') or ''}".strip()
    if row.get("cabinet_decision_no"):
        return f"قرار مجلس الوزراء رقم {row['cabinet_decision_no']} وتاريخ {row.get('cabinet_decision_date_hijri') or ''}".strip()
    return row.get("status_basis") or ""


def main() -> None:
    if os.environ.get("HAKEEM_INJECT") != "yes":
        raise SystemExit("مرفوض: ضع HAKEEM_INJECT=yes")
    target = os.environ.get("DATABASE_UR", "")
    if "ep-icy-rice" not in host(target) or not host(target).endswith(".neon.tech"):
        raise SystemExit("مرفوض: الهدف ليس مضيف الإنتاج المعروف")
    print("target_host", host(target).split(".")[0][:12])

    laws = [json.loads(line) for line in open(ROOT / "data" / "new_laws_owner_approved.jsonl", encoding="utf-8") if line.strip()]
    if len(laws) != 6:
        raise SystemExit(f"المتوقع 6 أنظمة ووُجد {len(laws)}")
    snaps = json.loads((ROOT / "data" / "source_snapshots.json").read_text(encoding="utf-8"))
    quotes = {}
    for line in open(ROOT / "data" / "supersessions_verified.jsonl", encoding="utf-8"):
        if line.strip():
            row = json.loads(line)
            quotes[row["old_title"]] = row

    con = psycopg.connect(target, connect_timeout=30)
    con.execute("SET statement_timeout = '180s'")
    counts = {"snapshots": 0, "new_law": 0, "units": 0, "systems": 0, "articles": 0, "verification": 0, "editions": 0, "skipped": 0}
    with con.cursor() as cur:
        cur.execute(
            """
            SELECT relname, n_tup_upd, n_tup_del FROM pg_stat_user_tables
            WHERE relname IN ('legal_systems','legal_articles','verification')
            """
        )
        before_stats = {r[0]: (r[1], r[2]) for r in cur.fetchall()}
        guards_before = {}
        for (law, num), expect in GUARD.items():
            cur.execute('SELECT md5(content), count(*) FROM legal_articles WHERE "lawName"=%s AND "articleNumber"=%s GROUP BY content', (law, num))
            row = cur.fetchone()
            if not row or row[0] != expect:
                raise SystemExit(f"حارس ما قبل الكتابة فشل: {law}")
            guards_before[law] = row[0]
        mixed_counts = {}
        for spec in SPECS:
            cur.execute('SELECT count(*) FROM legal_articles WHERE "lawName"=%s', (spec["mixed"],))
            mixed_counts[spec["mixed"]] = cur.fetchone()[0]

        cur.execute(
            """
            ALTER TABLE verification DROP CONSTRAINT IF EXISTS verification_method_check;
            ALTER TABLE verification ADD CONSTRAINT verification_method_check
              CHECK (method IN ('rule', 'manual', 'owner_decision'));
            ALTER TABLE verification DROP CONSTRAINT IF EXISTS verification_verified_status_check;
            ALTER TABLE verification ADD CONSTRAINT verification_verified_status_check CHECK (verified_status IN (
              'ساري','صادر لم يسرِ بعد','ملغى','مستبدل',
              'ملغى مع بقاء أحكام محددة مؤقتًا','إلغاء جزئي معلّق على شرط',
              'ملغاة','مضافة','سجل مخلوط — لا يُعرض'));
            CREATE TABLE IF NOT EXISTS work_edition (
              id text PRIMARY KEY,
              mixed_system_id text NOT NULL,
              edition_system_id text NOT NULL,
              instrument text,
              role text NOT NULL CHECK (role IN ('old', 'new')),
              valid_from date NOT NULL,
              valid_to date,
              created_at timestamptz NOT NULL DEFAULT now()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS work_edition_pair ON work_edition (mixed_system_id, edition_system_id);
            CREATE TABLE IF NOT EXISTS legal_system_alias (
              id text PRIMARY KEY,
              system_id text NOT NULL REFERENCES legal_systems(id),
              alias text NOT NULL,
              created_at timestamptz NOT NULL DEFAULT now(),
              UNIQUE (system_id, alias)
            );
            CREATE TABLE IF NOT EXISTS legal_article_bis (
              id text PRIMARY KEY,
              "legalSystemId" text NOT NULL REFERENCES legal_systems(id),
              "lawName" text NOT NULL,
              base_number int NOT NULL CHECK (base_number > 0),
              label text NOT NULL,
              title text NOT NULL,
              content text NOT NULL,
              created_at timestamptz NOT NULL DEFAULT now(),
              UNIQUE ("lawName", label)
            );
            CREATE TABLE IF NOT EXISTS uqn_fix.new_law (
              title text PRIMARY KEY,
              title_as_published text,
              work_type text,
              royal_decree_no text,
              royal_decree_date_hijri text,
              cabinet_decision_no text,
              cabinet_decision_date_hijri text,
              published_hijri text,
              status text NOT NULL CHECK (status = 'ساري'),
              status_basis text NOT NULL,
              text_source text NOT NULL,
              text_source_url text NOT NULL REFERENCES uqn_fix.source_snapshot(url),
              official_url text NOT NULL,
              text_verification text NOT NULL CHECK (text_verification IN ('pending_official_match','matched_official')),
              text_currency_note text,
              pending_amendment_op_ids text[] NOT NULL DEFAULT '{}'
            );
            CREATE TABLE IF NOT EXISTS uqn_fix.new_law_unit (
              title text NOT NULL REFERENCES uqn_fix.new_law(title),
              seq int NOT NULL,
              unit_type text NOT NULL CHECK (unit_type IN ('preamble','article')),
              number int,
              label text,
              body text NOT NULL,
              PRIMARY KEY (title, seq)
            );
            """
        )

        for law in laws:
            url = law["text_source_url"]
            body = snaps.get(url)
            if not body:
                raise SystemExit(f"لقطة النص غير موجودة: {law['title']}")
            cur.execute(
                """
                INSERT INTO uqn_fix.source_snapshot (url, body, body_sha, retrieved_on)
                VALUES (%s,%s,%s,%s) ON CONFLICT (url) DO NOTHING
                """,
                (url, body, hashlib.sha256(body.encode()).hexdigest(), "2026-09-25"),
            )
            counts["snapshots"] += cur.rowcount
            pending = law.get("pending_amendment_op_ids") or []
            if pending:
                cur.execute("SELECT op_id::text FROM uqn_fix.amendment_op WHERE op_id::text = ANY(%s)", (pending,))
                found = {r[0] for r in cur.fetchall()}
                missing = [x for x in pending if x not in found]
                if missing:
                    print("pending_ops_missing", law["title"], len(missing))
                pending = [x for x in pending if x in found]
            cur.execute(
                """
                INSERT INTO uqn_fix.new_law (
                  title, title_as_published, work_type, royal_decree_no, royal_decree_date_hijri,
                  cabinet_decision_no, cabinet_decision_date_hijri, published_hijri, status, status_basis,
                  text_source, text_source_url, official_url, text_verification, text_currency_note,
                  pending_amendment_op_ids
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'ساري',%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (title) DO NOTHING
                """,
                (
                    law["title"], law.get("title_as_published"), law.get("work_type"),
                    law.get("royal_decree_no"), law.get("royal_decree_date_hijri"),
                    law.get("cabinet_decision_no"), law.get("cabinet_decision_date_hijri"),
                    law.get("published_hijri"), law["status_basis"], law["text_source"],
                    law["text_source_url"], law["official_url"], law["text_verification"],
                    law.get("text_currency_note"), pending,
                ),
            )
            counts["new_law"] += cur.rowcount
            for unit in law["units"]:
                cur.execute(
                    """
                    INSERT INTO uqn_fix.new_law_unit (title, seq, unit_type, number, label, body)
                    VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT (title, seq) DO NOTHING
                    """,
                    (law["title"], unit["seq"], unit["unit_type"], unit.get("number"), unit.get("label"), unit["text"]),
                )
                counts["units"] += cur.rowcount

        def add_v(object_type, object_id, status, instrument, url, quote, method, who) -> None:
            cur.execute(
                """
                INSERT INTO verification
                  (id, object_type, object_id, verified_status, evidence_instrument, evidence_url,
                   evidence_quote, method, verified_by)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (id) DO NOTHING
                """,
                (sid("vf26-", object_type, object_id, status, method), object_type, object_id, status, instrument, url, quote, method, who),
            )
            counts["verification"] += cur.rowcount

        for spec in SPECS:
            cur.execute(
                """
                SELECT a."articleNumber", a.title, a.content, am."changeType", am."previousText"
                FROM legal_articles a
                LEFT JOIN article_amendments am ON am."articleId" = a.id
                WHERE a."lawName" = %s
                ORDER BY a."articleNumber", am."createdAt"
                """,
                (spec["mixed"],),
            )
            arts = {}
            for num, title, content, change, prev in cur.fetchall():
                rec = arts.setdefault(num, {"title": title, "content": content, "prev": None})
                if change == "amended" and prev:
                    rec["prev"] = prev
            cur.execute(
                """
                SELECT previous_text FROM legal_text_provenance
                WHERE law_name=%s AND entity_type='system_preamble' AND action='versioned_replace'
                ORDER BY created_at DESC LIMIT 1
                """,
                (spec["mixed"],),
            )
            old_preamble = (cur.fetchone() or [None])[0]
            cur.execute('SELECT preamble FROM legal_systems WHERE name=%s', (spec["mixed"],))
            new_preamble = (cur.fetchone() or [None])[0]
            ev = quotes.get(spec["mixed"], {})
            old_id = sid("ed25-", "system", spec["old_name"])
            new_id = sid("ed25-", "system", spec["new_name"])
            for name, eid, n, preamble, decree in (
                (spec["old_name"], old_id, spec["old_count"], old_preamble, spec["old_instrument"]),
                (spec["new_name"], new_id, spec["new_count"], new_preamble, spec["new_instrument"]),
            ):
                cur.execute(
                    """
                    INSERT INTO legal_systems (id, name, "articleCount", preamble, preamble_royal_decree, eli_slug, "createdAt", "updatedAt")
                    SELECT %s,%s,%s,%s,%s,%s,NOW(),NOW()
                    WHERE NOT EXISTS (SELECT 1 FROM legal_systems WHERE id=%s OR name=%s)
                    """,
                    (eid, name, n, preamble, decree, law_slug(name), eid, name),
                )
                counts["systems"] += cur.rowcount
            cur.execute("SELECT id FROM legal_systems WHERE name=%s", (spec["mixed"],))
            mixed_id = cur.fetchone()[0]
            for num in range(1, spec["old_count"] + 1):
                rec = arts.get(num)
                text = (rec or {}).get("prev") or (rec or {}).get("content")
                if not rec or not text or len(text) < 15:
                    raise SystemExit(f"نص قديم ناقص {spec['mixed']} {num}")
                aid = sid("ed25-", "art", spec["old_name"], str(num))
                cur.execute(
                    """
                    INSERT INTO legal_articles
                      (id, "legalSystemId", "lawName", "articleNumber", title, content, "royalDecree", status, "createdAt", "updatedAt")
                    SELECT %s,%s,%s,%s,%s,%s,%s,'سارية',NOW(),NOW()
                    WHERE NOT EXISTS (
                      SELECT 1 FROM legal_articles WHERE id=%s OR ("lawName"=%s AND "articleNumber"=%s)
                    )
                    """,
                    (aid, old_id, spec["old_name"], num, rec["title"] or f"المادة {num}", text, spec["old_instrument"], aid, spec["old_name"], num),
                )
                counts["articles"] += cur.rowcount
                status = "ساري" if TODAY < spec["old_to"] else "مستبدل"
                add_v("unit", aid, status, spec["old_instrument"], ev.get("evidence_url"), ev.get("evidence_quote"), "manual", "owner-inject-2026-09-26")
            for num in range(1, spec["new_count"] + 1):
                rec = arts[num]
                aid = sid("ed25-", "art", spec["new_name"], str(num))
                cur.execute(
                    """
                    INSERT INTO legal_articles
                      (id, "legalSystemId", "lawName", "articleNumber", title, content, "royalDecree", status, "createdAt", "updatedAt")
                    SELECT %s,%s,%s,%s,%s,%s,%s,'سارية',NOW(),NOW()
                    WHERE NOT EXISTS (
                      SELECT 1 FROM legal_articles WHERE id=%s OR ("lawName"=%s AND "articleNumber"=%s)
                    )
                    """,
                    (aid, new_id, spec["new_name"], num, rec["title"] or f"المادة {num}", rec["content"], spec["new_instrument"], aid, spec["new_name"], num),
                )
                counts["articles"] += cur.rowcount
                status = "صادر لم يسرِ بعد" if TODAY < spec["new_from"] else "ساري"
                add_v("unit", aid, status, spec["new_instrument"], ev.get("evidence_url"), ev.get("evidence_quote"), "manual", "owner-inject-2026-09-26")
            add_v("work", mixed_id, "سجل مخلوط — لا يُعرض", spec["old_instrument"], ev.get("evidence_url"), ev.get("evidence_quote"), "manual", "owner-inject-2026-09-26")
            old_status = "ساري" if TODAY < spec["old_to"] else "مستبدل"
            new_status = "صادر لم يسرِ بعد" if TODAY < spec["new_from"] else "ساري"
            add_v("work", old_id, old_status, spec["old_instrument"], ev.get("evidence_url"), ev.get("evidence_quote"), "manual", "owner-inject-2026-09-26")
            add_v("work", new_id, new_status, spec["new_instrument"], ev.get("evidence_url"), ev.get("evidence_quote"), "manual", "owner-inject-2026-09-26")
            for role, eid, start, end, decree in (
                ("old", old_id, spec["old_from"], spec["old_to"], spec["old_instrument"]),
                ("new", new_id, spec["new_from"], None, spec["new_instrument"]),
            ):
                cur.execute(
                    """
                    INSERT INTO work_edition (id, mixed_system_id, edition_system_id, instrument, role, valid_from, valid_to)
                    VALUES (%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (mixed_system_id, edition_system_id) DO NOTHING
                    """,
                    (sid("ed25-", "win", mixed_id, eid), mixed_id, eid, decree, role, start, end),
                )
                counts["editions"] += cur.rowcount

        for law in laws:
            title = law["title"]
            cur.execute("SELECT id FROM legal_systems WHERE name=%s", (title,))
            found = cur.fetchone()
            new_id = sid("own26-", "system", title)
            decree = instrument_of(law)
            quote = law.get("text_currency_note") or law["status_basis"]
            if found and found[0] != new_id:
                counts["skipped"] += 1
                print("SKIP_EXISTING", title)
                add_v("work", found[0], "ساري", decree, law["official_url"], quote, "owner_decision", "owner-inject-2026-09-26")
                continue
            articles = [u for u in law["units"] if u["unit_type"] == "article" and u.get("number")]
            preamble = next((u["text"] for u in law["units"] if u["unit_type"] == "preamble"), None)
            cur.execute(
                """
                INSERT INTO legal_systems (id, name, "articleCount", preamble, preamble_royal_decree, eli_slug, "createdAt", "updatedAt")
                SELECT %s,%s,%s,%s,%s,%s,NOW(),NOW()
                WHERE NOT EXISTS (SELECT 1 FROM legal_systems WHERE id=%s OR name=%s)
                """,
                (new_id, title, len(articles), preamble, decree, law_slug(title), new_id, title),
            )
            counts["systems"] += cur.rowcount
            add_v("work", new_id, "ساري", decree, law["official_url"], quote, "owner_decision", "owner-inject-2026-09-26")
            for unit in articles:
                aid = sid("own26-", "art", title, str(unit["number"]))
                cur.execute(
                    """
                    INSERT INTO legal_articles
                      (id, "legalSystemId", "lawName", "articleNumber", title, content, "royalDecree", status, "createdAt", "updatedAt")
                    SELECT %s,%s,%s,%s,%s,%s,%s,'سارية',NOW(),NOW()
                    WHERE NOT EXISTS (
                      SELECT 1 FROM legal_articles WHERE id=%s OR ("lawName"=%s AND "articleNumber"=%s)
                    )
                    """,
                    (aid, new_id, title, unit["number"], unit.get("label") or f"المادة {unit['number']}", unit["text"], decree, aid, title, unit["number"]),
                )
                counts["articles"] += cur.rowcount
                add_v("unit", aid, "ساري", decree, law["official_url"], "النص قيد المطابقة مع هيئة الخبراء", "owner_decision", "owner-inject-2026-09-26")

        for (law, num), expect in GUARD.items():
            cur.execute('SELECT md5(content) FROM legal_articles WHERE "lawName"=%s AND "articleNumber"=%s', (law, num))
            got = cur.fetchone()[0]
            if got != expect:
                raise SystemExit(f"الحارس تغيّر، أُلغي الحقن: {law}")
        for spec in SPECS:
            cur.execute('SELECT count(*) FROM legal_articles WHERE "lawName"=%s', (spec["mixed"],))
            if cur.fetchone()[0] != mixed_counts[spec["mixed"]]:
                raise SystemExit(f"عدد مواد السجل المخلوط تغيّر: {spec['mixed']}")
        cur.execute("SELECT count(*) FROM verification WHERE verified_by='owner-inject-2026-09-26'")
        print("verification_rows_this_run_visible", cur.fetchone()[0])
    con.commit()
    with con.cursor() as cur:
        cur.execute(
            """
            SELECT relname, n_tup_upd, n_tup_del FROM pg_stat_user_tables
            WHERE relname IN ('legal_systems','legal_articles','verification')
            """
        )
        after = {r[0]: (r[1], r[2]) for r in cur.fetchall()}
        for name, (u0, d0) in before_stats.items():
            u1, d1 = after[name]
            if (u1, d1) != (u0, d0):
                print("STAT_DELTA", name, "upd", u1 - u0, "del", d1 - d0)
            else:
                print("STAT_UNCHANGED", name)
        cur.execute("SELECT count(*) FROM work_edition")
        print("work_edition", cur.fetchone()[0])
        cur.execute("SELECT count(*) FROM legal_systems")
        print("systems_total", cur.fetchone()[0])
        cur.execute("SELECT count(*) FROM legal_articles")
        print("articles_total", cur.fetchone()[0])
    con.close()
    print("INJECTED", counts)


if __name__ == "__main__":
    main()
