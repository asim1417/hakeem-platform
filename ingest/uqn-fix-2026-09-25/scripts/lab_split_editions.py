"""ينسخ النصوص المسترجعة إلى القاعدة المحلية 127.0.0.1 فقط.

القراءة من الإنتاج للقراءة فقط. أي عنوان كتابة غير 127.0.0.1 يوقف التنفيذ.
لا يُحدَّث صف قائم: الأنظمة الجديدة بأسماء مستقلة، والتحقق والإصدارات إدراج.
"""
import hashlib, json, os, pathlib, sys
import psycopg
from hijri_converter import Hijri

LAB = "postgresql://hakeem:hakeem_password@127.0.0.1:5432/hakeem"
ROOT = pathlib.Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]


def host(url: str) -> str:
    return url.split("@")[-1].split("/")[0]


def sid(*parts: str) -> str:
    return "ed25-" + hashlib.sha256("|".join(parts).encode()).hexdigest()[:24]


def gdate(hijri: str) -> str:
    y, m, d = map(int, hijri.split("-"))
    g = Hijri(y, m, d).to_gregorian()
    return f"{g.year:04d}-{g.month:02d}-{g.day:02d}"


def law_slug(name: str) -> str:
    import re, unicodedata
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


def ensure_lab_schema(cur) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS verification (
          id TEXT PRIMARY KEY,
          object_type TEXT NOT NULL CHECK (object_type IN ('work', 'unit', 'effect', 'relation')),
          object_id TEXT NOT NULL,
          verified_status TEXT NOT NULL CHECK (verified_status IN (
            'ساري','صادر لم يسرِ بعد','ملغى','مستبدل',
            'ملغى مع بقاء أحكام محددة مؤقتًا','إلغاء جزئي معلّق على شرط',
            'ملغاة','مضافة','سجل مخلوط — لا يُعرض')),
          evidence_instrument TEXT,
          evidence_url TEXT,
          evidence_quote TEXT,
          method TEXT NOT NULL CHECK (method IN ('rule', 'manual')),
          verified_by TEXT,
          verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          supersedes_verification_id TEXT
        )
        """
    )
    cur.execute((ROOT / "schema" / "work_edition.sql").read_text(encoding="utf-8"))


def fetch_articles(src, law: str):
    cur = src.cursor()
    cur.execute(
        """
        SELECT a."articleNumber", a.title, a.content, a.status,
               am."changeType", am."previousText"
        FROM legal_articles a
        LEFT JOIN article_amendments am ON am."articleId" = a.id
        WHERE a."lawName" = %s
        ORDER BY a."articleNumber", am."createdAt"
        """,
        (law,),
    )
    arts = {}
    for num, title, content, status, change, prev in cur.fetchall():
        rec = arts.setdefault(num, {"title": title, "content": content, "status": status, "prev": None})
        if change == "amended" and prev:
            rec["prev"] = prev
    cur.execute(
        """
        SELECT previous_text FROM legal_text_provenance
        WHERE law_name=%s AND entity_type='system_preamble' AND action='versioned_replace'
        ORDER BY created_at DESC LIMIT 1
        """,
        (law,),
    )
    row = cur.fetchone()
    old_preamble = row[0] if row else None
    cur.execute('SELECT preamble FROM legal_systems WHERE name=%s', (law,))
    prow = cur.fetchone()
    new_preamble = prow[0] if prow else None
    return arts, old_preamble, new_preamble


def insert_system(cur, name, count, preamble, instrument) -> str:
    cur.execute("SELECT id FROM legal_systems WHERE name=%s", (name,))
    found = cur.fetchone()
    if found:
        return found[0]
    new_id = sid("system", name)
    cur.execute(
        """
        INSERT INTO legal_systems (id, name, "articleCount", preamble, preamble_royal_decree, eli_slug, "createdAt", "updatedAt")
        VALUES (%s,%s,%s,%s,%s,%s,NOW(),NOW())
        """,
        (new_id, name, count, preamble, instrument, law_slug(name)),
    )
    return new_id


def insert_articles(cur, system_id, law_name, rows) -> int:
    n = 0
    for num, title, content, decree in rows:
        cur.execute(
            """
            INSERT INTO legal_articles
              (id, "legalSystemId", "lawName", "articleNumber", title, content, "royalDecree", status, "createdAt", "updatedAt")
            VALUES (%s,%s,%s,%s,%s,%s,%s,'سارية',NOW(),NOW())
            ON CONFLICT ("lawName", "articleNumber") DO NOTHING
            """,
            (sid("art", law_name, str(num)), system_id, law_name, num, title or f"المادة {num}", content, decree),
        )
        n += cur.rowcount
    return n


def add_verification(cur, object_id, status, instrument, url, quote) -> None:
    cur.execute(
        """
        INSERT INTO verification
          (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote, method, verified_by)
        VALUES (%s,'work',%s,%s,%s,%s,%s,'manual','lab-split-2026-09-25')
        ON CONFLICT (id) DO NOTHING
        """,
        (sid("vfy", object_id, status), object_id, status, instrument, url, quote),
    )


def main() -> None:
    if host(LAB) != "127.0.0.1:5432":
        raise SystemExit("الكتابة مسموحة على 127.0.0.1 فقط")
    src_url = os.environ["DATABASE_UR"]
    if host(src_url).startswith("127.0.0.1"):
        raise SystemExit("مصدر القراءة ليس الإنتاج")
    print("read_host", host(src_url).split(".")[0][:8], "write_host", host(LAB))
    quotes = {}
    for line in open(ROOT / "data" / "supersessions_verified.jsonl", encoding="utf-8"):
        if line.strip():
            row = json.loads(line)
            quotes[row["old_title"]] = row
    src = psycopg.connect(src_url, connect_timeout=30)
    src.execute("SET default_transaction_read_only = on")
    src.execute("SET statement_timeout = '120s'")
    lab = psycopg.connect(LAB, connect_timeout=20)
    lab.execute("SET statement_timeout = '120s'")
    with lab.cursor() as cur:
        ensure_lab_schema(cur)
    lab.commit()
    inserted = {"systems": 0, "articles": 0, "verification": 0, "editions": 0}
    for spec in SPECS:
        arts, old_preamble, new_preamble = fetch_articles(src, spec["mixed"])
        old_rows = []
        new_rows = []
        for num in range(1, spec["old_count"] + 1):
            rec = arts.get(num)
            if not rec:
                raise SystemExit(f"نقص مادة قديمة {spec['mixed']} {num}")
            text = rec["prev"] if rec["prev"] else rec["content"]
            if not text or len(text) < 15:
                raise SystemExit(f"نص قديم ناقص {spec['mixed']} {num}")
            old_rows.append((num, rec["title"], text, spec["old_instrument"]))
        for num in range(1, spec["new_count"] + 1):
            rec = arts[num]
            new_rows.append((num, rec["title"], rec["content"], spec["new_instrument"]))
        ev = quotes.get(spec["mixed"], {})
        with lab.cursor() as cur:
            before = cur.rowcount
            old_id = insert_system(cur, spec["old_name"], spec["old_count"], old_preamble, spec["old_instrument"])
            new_id = insert_system(cur, spec["new_name"], spec["new_count"], new_preamble, spec["new_instrument"])
            cur.execute("SELECT id FROM legal_systems WHERE name=%s", (spec["mixed"],))
            mixed = cur.fetchone()
            if not mixed:
                raise SystemExit(f"السجل المخلوط غير موجود محليًا: {spec['mixed']}")
            mixed_id = mixed[0]
            inserted["articles"] += insert_articles(cur, old_id, spec["old_name"], old_rows)
            inserted["articles"] += insert_articles(cur, new_id, spec["new_name"], new_rows)
            add_verification(cur, mixed_id, "سجل مخلوط — لا يُعرض", spec["old_instrument"], ev.get("evidence_url"), ev.get("evidence_quote"))
            today = "2026-09-25"
            old_status = "ساري" if today < spec["old_to"] else "مستبدل"
            new_status = "صادر لم يسرِ بعد" if today < spec["new_from"] else "ساري"
            add_verification(cur, old_id, old_status, spec["old_instrument"], ev.get("evidence_url"), ev.get("evidence_quote"))
            add_verification(cur, new_id, new_status, spec["new_instrument"], ev.get("evidence_url"), ev.get("evidence_quote"))
            for role, eid, start, end, instrument in (
                ("old", old_id, spec["old_from"], spec["old_to"], spec["old_instrument"]),
                ("new", new_id, spec["new_from"], None, spec["new_instrument"]),
            ):
                cur.execute(
                    """
                    INSERT INTO work_edition (id, mixed_system_id, edition_system_id, instrument, role, valid_from, valid_to)
                    VALUES (%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (mixed_system_id, edition_system_id) DO NOTHING
                    """,
                    (sid("win", mixed_id, eid), mixed_id, eid, instrument, role, start, end),
                )
                inserted["editions"] += cur.rowcount
            cur.execute('SELECT count(*) FROM legal_articles WHERE "lawName"=%s', (spec["old_name"],))
            old_n = cur.fetchone()[0]
            cur.execute('SELECT count(*) FROM legal_articles WHERE "lawName"=%s', (spec["new_name"],))
            new_n = cur.fetchone()[0]
            cur.execute('SELECT md5(content) FROM legal_articles WHERE "lawName"=%s AND "articleNumber"=1', (spec["old_name"],))
            old_md5 = cur.fetchone()[0]
            cur.execute('SELECT md5(content) FROM legal_articles WHERE "lawName"=%s AND "articleNumber"=1', (spec["new_name"],))
            new_md5 = cur.fetchone()[0]
            print(f"{spec['mixed']} old={old_n} new={new_n} old_md5={old_md5} new_md5={new_md5} distinct={old_md5 != new_md5}")
            _ = before
    lab.commit()
    with lab.cursor() as cur:
        cur.execute("SELECT n_tup_upd, n_tup_del FROM pg_stat_user_tables WHERE relname IN ('legal_articles','legal_systems')")
        print("note stat counters are cumulative, not this transaction")
        cur.execute("SELECT count(*) FROM verification WHERE verified_status='سجل مخلوط — لا يُعرض'")
        print("mixed_gates", cur.fetchone()[0])
        cur.execute("SELECT count(*) FROM work_edition")
        print("windows", cur.fetchone()[0])
    src.close()
    lab.close()
    print("lab_only_done", inserted)


if __name__ == "__main__":
    main()
