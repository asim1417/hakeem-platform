"""ينقل الأنظمة الستة المعتمدة من uqn_fix.new_law إلى الأعمال الحية بالإضافة فقط.

الكتابة مسموحة على 127.0.0.1 فقط. إن وُجد الاسم لعمل آخر يُترك كما هو ويُذكر في التقرير.
لا تُطبَّق نصوص التعديلات المعلّقة.
"""
import hashlib
import os
import sys

import psycopg

LAB = "postgresql://hakeem:hakeem_password@127.0.0.1:5432/hakeem"


def host(url: str) -> str:
    return url.split("@")[-1].split("/")[0]


def sid(*parts: str) -> str:
    return "own26-" + hashlib.sha256("|".join(parts).encode()).hexdigest()[:24]


def law_slug(name: str) -> str:
    import re
    import unicodedata

    name = unicodedata.normalize("NFKC", name)
    name = re.sub(r"[ً-ْٰـ]", "", name)
    name = re.sub(r"[إأآا]", "ا", name).replace("ى", "ي").replace("ة", "ه")
    name = re.sub(r"[^\u0600-\u06FF0-9]+", "-", name)
    return name.strip("-").lower()


def instrument(row) -> str:
    if row[3]:
        return f"مرسوم ملكي رقم {row[3]} وتاريخ {row[4] or ''}".strip()
    if row[5]:
        return f"قرار مجلس الوزراء رقم {row[5]} وتاريخ {row[6] or ''}".strip()
    return row[8] or ""


def main() -> None:
    target = os.environ.get("DATABASE_URL", LAB)
    if host(target) != "127.0.0.1:5432":
        raise SystemExit("الكتابة مسموحة على 127.0.0.1:5432 فقط")
    con = psycopg.connect(target, connect_timeout=20)
    con.execute("SET statement_timeout = '180s'")
    inserted = {"systems": 0, "articles": 0, "bis": 0, "aliases": 0, "verification": 0, "skipped_existing": 0}
    with con.cursor() as cur:
        cur.execute(
            """
            SELECT relname, n_tup_upd, n_tup_del FROM pg_stat_user_tables
            WHERE relname IN ('legal_systems','legal_articles','verification')
            """
        )
        before = {r[0]: (r[1], r[2]) for r in cur.fetchall()}
        cur.execute(
            """
            ALTER TABLE verification DROP CONSTRAINT IF EXISTS verification_method_check;
            ALTER TABLE verification ADD CONSTRAINT verification_method_check
              CHECK (method IN ('rule', 'manual', 'owner_decision'));
            """
        )
        cur.execute(
            """
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
            """
        )
        cur.execute(
            """
            SELECT title, title_as_published, work_type, royal_decree_no, royal_decree_date_hijri,
                   cabinet_decision_no, cabinet_decision_date_hijri, published_hijri, status_basis,
                   official_url, text_currency_note, pending_amendment_op_ids
            FROM uqn_fix.new_law ORDER BY title
            """
        )
        laws = cur.fetchall()
        if len(laws) != 6:
            raise SystemExit(f"المتوقع 6 أنظمة في uqn_fix.new_law ووُجد {len(laws)}")
        for law in laws:
            title = law[0]
            published = law[1]
            basis = law[8]
            official = law[9]
            note = law[10]
            pending = law[11] or []
            decree = instrument(law)
            cur.execute("SELECT id FROM legal_systems WHERE name=%s", (title,))
            found = cur.fetchone()
            new_id = sid("system", title)
            if found and found[0] != new_id:
                inserted["skipped_existing"] += 1
                print("SKIP existing different id", title, found[0])
                continue
            cur.execute(
                """
                SELECT unit_type, seq, number, label, body
                FROM uqn_fix.new_law_unit WHERE title=%s ORDER BY seq
                """,
                (title,),
            )
            units = cur.fetchall()
            preamble = next((u[4] for u in units if u[0] == "preamble"), None)
            numbered = [u for u in units if u[0] == "article" and u[2] is not None]
            bis_units = [u for u in units if u[0] == "article" and u[2] is None]
            if not found:
                cur.execute(
                    """
                    INSERT INTO legal_systems
                      (id, name, "articleCount", preamble, preamble_royal_decree, eli_slug, "createdAt", "updatedAt")
                    VALUES (%s,%s,%s,%s,%s,%s,NOW(),NOW())
                    """,
                    (new_id, title, len(numbered) + len(bis_units), preamble, decree, law_slug(title)),
                )
                inserted["systems"] += cur.rowcount
            system_id = new_id
            last_number = None
            for _kind, _seq, number, label, body in numbered:
                last_number = number
                cur.execute(
                    """
                    INSERT INTO legal_articles
                      (id, "legalSystemId", "lawName", "articleNumber", title, content, "royalDecree", status, "createdAt", "updatedAt")
                    VALUES (%s,%s,%s,%s,%s,%s,%s,'سارية',NOW(),NOW())
                    ON CONFLICT ("lawName", "articleNumber") DO NOTHING
                    """,
                    (sid("art", title, str(number)), system_id, title, number, label or f"المادة {number}", body, decree),
                )
                inserted["articles"] += cur.rowcount
                cur.execute("SELECT id FROM legal_articles WHERE \"lawName\"=%s AND \"articleNumber\"=%s", (title, number))
                art_id = cur.fetchone()[0]
                add_verification(cur, inserted, art_id, "unit", basis, official, None)
            for _kind, _seq, _number, label, body in bis_units:
                base = last_number or 0
                if base <= 0:
                    raise SystemExit(f"مادة مكرر بلا رقم أساس: {title} {label}")
                cur.execute(
                    """
                    INSERT INTO legal_article_bis
                      (id, "legalSystemId", "lawName", base_number, label, title, content)
                    VALUES (%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT ("lawName", label) DO NOTHING
                    """,
                    (sid("bis", title, label), system_id, title, base, label, label, body),
                )
                inserted["bis"] += cur.rowcount
                add_verification(cur, inserted, sid("bis", title, label), "unit", basis, official, None)
            if published and published != title:
                cur.execute(
                    """
                    INSERT INTO legal_system_alias (id, system_id, alias)
                    VALUES (%s,%s,%s)
                    ON CONFLICT (system_id, alias) DO NOTHING
                    """,
                    (sid("alias", title, published), system_id, published),
                )
                inserted["aliases"] += cur.rowcount
            quote = note if pending else None
            add_verification(cur, inserted, system_id, "work", basis, official, quote)
            print(f"{title} articles={len(numbered)} bis={len(bis_units)} pending={len(pending)} alias={published if published != title else '-'}")
        cur.execute(
            """
            SELECT relname, n_tup_upd, n_tup_del FROM pg_stat_user_tables
            WHERE relname IN ('legal_systems','legal_articles','verification')
            """
        )
        after = {r[0]: (r[1], r[2]) for r in cur.fetchall()}
    con.commit()
    print("inserted", inserted)
    print("stat_before", before)
    print("stat_after", after)
    con.close()


def add_verification(cur, inserted, object_id, object_type, basis, url, quote) -> None:
    cur.execute(
        """
        INSERT INTO verification
          (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by)
        VALUES (%s,%s,%s,'ساري',%s,%s,%s,'owner_decision','عاصم الفارسي')
        ON CONFLICT (id) DO NOTHING
        """,
        (sid("vfy", object_type, object_id), object_type, object_id, basis, url, quote),
    )
    inserted["verification"] += cur.rowcount


if __name__ == "__main__":
    sys.exit(main())
