#!/usr/bin/env python3
"""
ترقية دفعة أم القرى uqn-2026-09-25 من uqn_stage إلى النموذج الحي:

  LegalSystem  = العمل
  LegalArticle = الوحدة المرقّمة (المادة/البند)
  الديباجة    = أداة الإصدار والموافقة على النظام (ليست مادة)
  ArticleVersion = إغلاق النص السابق عند الإحلال المؤكَّد
  ArticleAmendment = سجل الإحلال/الإلغاء دون حذف النص

ما يُرحَّل: أعمال parse_status=complete فقط (أنظمة + لوائح متّصلة).
ما لا يُمس: الآثار المستخرجة تلقائيًا (تبقى pending_review في uqn_stage)،
والأعمال needs_triage / irregular / unstructured / بلا نص.

إحلال الاسم نفسه (3 أنظمة، العدد القديم مؤكَّد قراءةً): لقطة للنص القديم ثم
النص الجديد. أنظمة حلّ محلها نظام باسم مختلف (12): تُدرج الجديدة، ويُعلَّم
القديم «ملغاة» مع بقاء نصه إذا طابق العدد المتوقع.

التشغيل:
  python3 scripts/backfill/promote_uqn_2026_09.py            # جاف
  CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED \\
    TARGET_DATABASE_URL=... python3 scripts/backfill/promote_uqn_2026_09.py --apply

لا يطبع أسرار الاتصال.
"""
from __future__ import annotations

import argparse
import hashlib
import os
import re
import sys
import unicodedata
import uuid
from collections import Counter
from datetime import datetime, timezone

import psycopg
from psycopg.types.json import Json

BATCH = "uqn-2026-09-25"
RETRIEVED = "2026-09-25"
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
STAGING_SQL = os.path.join(ROOT, "ingest", "uqn-2026-09-25", "schema", "staging.sql")

# أسماء طابقت Neon حرفيًا والعدد القديم طابق تلميح الحزمة (قراءة 2026-09-25).
IN_PLACE = {
    "نظام التنفيذ": {"expect": 98, "source_id": "uqn:4000869"},
    "نظام السجل التجاري": {"expect": 20, "source_id": "uqn:26565"},
    "نظام الأسماء التجارية": {"expect": 20, "source_id": "uqn:26566"},
}

# نظام قديم باسم مختلف — يُعلَّم ملغى فقط بعد إدراج الجديد ومطابقة العدد.
REPEAL_OLD = {
    "نظام نزع ملكية العقارات للمنفعة العامة ووضع اليد المؤقت على العقار": {"expect": 27, "by": "uqn:27461"},
    "نظام تملك غير السعوديين للعقار واستثماره": {"expect": 8, "by": "uqn:27293"},
    "نظام الاستثمار الأجنبي": {"expect": 18, "by": "uqn:25337"},
    "نظام حماية حقوق المؤلف": {"expect": 28, "by": "uqn:4000299"},
    "نظام النقل بالخطوط الحديدية": {"expect": 39, "by": "uqn:24689"},
    "تنظيم الهيئة الوطنية لمكافحة الفساد": {"expect": 17, "by": "uqn:25318"},
    "نظام مكتبة الملك فهد الوطنية": {"expect": 12, "by": "uqn:4000670"},
    "نظام مدينة الملك عبدالله للطاقة الذرية والمتجددة": {"expect": 17, "by": "uqn:19805"},
    "الترتيبات التنظيمية للهيئة العامة للطرق": {"expect": 14, "by": "uqn:4001669"},
    "الترتيبات التنظيمية لهيئة الصحة العامة": {"expect": 13, "by": "uqn:24965"},
    "نظام الإحصاءات العامة للدولة": {"expect": 17, "by": "uqn:27339"},
    "الترتيبات التنظيمية للمركز الوطني لسلامة النقل": {"expect": 14, "by": "uqn:27463"},
}

DIACRITICS = re.compile(r"[ً-ْٰـ]")
AR_DIACRITICS = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]")


def norm_name(name: str) -> str:
    s = unicodedata.normalize("NFKC", name or "")
    s = DIACRITICS.sub("", s)
    s = re.sub(r"[إأآا]", "ا", s)
    s = s.replace("ى", "ي").replace("ة", "ه")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def law_slug(name: str) -> str:
    s = unicodedata.normalize("NFKC", name or "")
    s = DIACRITICS.sub("", s)
    s = re.sub(r"[إأآا]", "ا", s)
    s = s.replace("ى", "ي").replace("ة", "ه")
    out = []
    prev_dash = False
    for ch in s:
        cat = unicodedata.category(ch)
        if cat.startswith("L") or cat.startswith("N"):
            out.append(ch.lower())
            prev_dash = False
        else:
            if not prev_dash:
                out.append("-")
                prev_dash = True
    return "".join(out).strip("-")


def normalize_arabic_text(text: str) -> str:
    s = AR_DIACRITICS.sub("", text or "").replace("\u0640", "")
    s = s.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ٱ", "ا")
    s = s.replace("ؤ", "و").replace("ئ", "ي").replace("ة", "ه").replace("ى", "ي")
    kept = []
    for ch in s:
        if ch.isspace() or unicodedata.category(ch).startswith(("L", "N")):
            kept.append(ch)
        else:
            kept.append(" ")
    return re.sub(r"\s+", " ", "".join(kept)).strip()


def sha16(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def new_id() -> str:
    return uuid.uuid4().hex


def search_norm(law: str, title: str, content: str, keywords: list[str], classification: str | None, chapter: str | None) -> str:
    raw = "\n".join(x for x in [law, title, content, " ".join(keywords), classification or "", chapter or ""] if x)
    return normalize_arabic_text(raw)


def decree_label(work: dict) -> str | None:
    no = work.get("royal_decree_no")
    hijri = work.get("royal_decree_date_hijri")
    if no and hijri:
        return f"مرسوم ملكي رقم {no} بتاريخ {hijri}"
    if no:
        return f"مرسوم ملكي رقم {no}"
    kind = work.get("approval_kind")
    ano = work.get("approval_no")
    ah = work.get("approval_date_hijri")
    if kind and ano:
        return f"{kind} رقم {ano}" + (f" بتاريخ {ah}" if ah else "")
    return None


def host_of(url: str) -> str:
    return url.split("@")[-1].split("/")[0] if "@" in url else "local"


def assert_apply_allowed(target_url: str, allow_local: bool) -> None:
    if os.environ.get("CONFIRM_RUNTIME_DB_ALIGNMENT") != "NEON_RUNTIME_CONFIRMED":
        sys.exit("الكتابة مقفولة. اضبط CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED")
    host = host_of(target_url)
    if "neon.tech" in host:
        return
    if allow_local and ("127.0.0.1" in host or "localhost" in host):
        return
    sys.exit(f"الكتابة مرفوضة على المضيف {host}. الإنتاج = Neon، والتجربة المحلية بـ --allow-local")


def load_works(con, statuses: tuple[str, ...] = ("complete",)) -> list[dict]:
    with con.cursor() as cur:
        cur.execute(
            """
            SELECT source_id, dataset, title, work_type, numbering, article_count,
                   source_url, royal_decree_no, royal_decree_date_hijri, approval_kind,
                   approval_no, approval_date_hijri, effective_clause, published_gregorian,
                   published_hijri, raw_sha, parse_status
            FROM uqn_stage.work
            WHERE batch_id=%s AND parse_status = ANY(%s)
            ORDER BY dataset, source_id
            """,
            (BATCH, list(statuses)),
        )
        cols = [d[0] for d in cur.description]
        works = [dict(zip(cols, row)) for row in cur.fetchall()]
        cur.execute(
            """
            SELECT source_id, seq, unit_type, number, body, text_sha, chapter, source_url
            FROM uqn_stage.unit
            WHERE batch_id=%s
            ORDER BY source_id, seq
            """,
            (BATCH,),
        )
        units: dict[str, list] = {}
        for sid, seq, ut, num, body, tsha, chapter, surl in cur.fetchall():
            units.setdefault(sid, []).append(
                {"seq": seq, "unit_type": ut, "number": num, "body": body, "text_sha": tsha, "chapter": chapter or None, "source_url": surl}
            )
    for w in works:
        w["units"] = units.get(w["source_id"], [])
    return works


def copy_stage(src, dst) -> None:
    sql = open(STAGING_SQL, encoding="utf-8").read()
    with src.cursor() as sc, dst.cursor() as dc:
        dc.execute(sql)
        for table in ("rejection", "supersession", "effect", "unit", "work", "batch"):
            dc.execute(f"DELETE FROM uqn_stage.{table} WHERE batch_id=%s", (BATCH,))
        sc.execute("SELECT batch_id, source, retrieved_on, package_sha, notes FROM uqn_stage.batch WHERE batch_id=%s", (BATCH,))
        dc.executemany(
            "INSERT INTO uqn_stage.batch(batch_id,source,retrieved_on,package_sha,notes) VALUES (%s,%s,%s,%s,%s)",
            sc.fetchall(),
        )
        sc.execute(
            """SELECT batch_id,source_id,dataset,title,work_type,category,published_hijri,published_gregorian,
                      source_url,royal_decree_no,royal_decree_date_hijri,approval_kind,approval_no,approval_date_hijri,
                      effective_clause,supersedes_note,parent_law_hint,numbering,parse_status,article_count,
                      sequence_contiguous,flags,quality_note,raw_sha,review_status,review_reason
               FROM uqn_stage.work WHERE batch_id=%s""",
            (BATCH,),
        )
        dc.executemany(
            """INSERT INTO uqn_stage.work(batch_id,source_id,dataset,title,work_type,category,published_hijri,
                 published_gregorian,source_url,royal_decree_no,royal_decree_date_hijri,approval_kind,approval_no,
                 approval_date_hijri,effective_clause,supersedes_note,parent_law_hint,numbering,parse_status,
                 article_count,sequence_contiguous,flags,quality_note,raw_sha,review_status,review_reason)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            sc.fetchall(),
        )
        sc.execute(
            """SELECT batch_id,source_id,seq,unit_type,number,label,heading,chapter,section,body,text_sha,source_url
               FROM uqn_stage.unit WHERE batch_id=%s""",
            (BATCH,),
        )
        dc.executemany("INSERT INTO uqn_stage.unit VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)", sc.fetchall())
        sc.execute(
            """SELECT batch_id,effect_id,effect_type,instrument_kind,instrument_no,instrument_date_hijri,published_hijri,
                      target_title_as_cited,target_citation,target_match_hakeem,target_match_status,operative_text,
                      source_url,also_published_in,extraction,status,resolved_work_id,resolved_unit_refs
               FROM uqn_stage.effect WHERE batch_id=%s""",
            (BATCH,),
        )
        effect_rows = []
        for row in sc.fetchall():
            row = list(row)
            row[13] = Json(row[13] if row[13] is not None else [])
            effect_rows.append(tuple(row))
        dc.executemany(
            """INSERT INTO uqn_stage.effect(batch_id,effect_id,effect_type,instrument_kind,instrument_no,
                 instrument_date_hijri,published_hijri,target_title_as_cited,target_citation,target_match_hakeem,
                 target_match_status,operative_text,source_url,also_published_in,extraction,status,resolved_work_id,
                 resolved_unit_refs)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            effect_rows,
        )
        sc.execute(
            "SELECT batch_id,new_source_url,new_title,published_hijri,hakeem_old_work_hint,status FROM uqn_stage.supersession WHERE batch_id=%s",
            (BATCH,),
        )
        dc.executemany(
            """INSERT INTO uqn_stage.supersession(batch_id,new_source_url,new_title,published_hijri,hakeem_old_work_hint,status)
               VALUES (%s,%s,%s,%s,%s,%s)""",
            sc.fetchall(),
        )
    dst.commit()


def ensure_provenance(con) -> None:
    with con.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS legal_text_provenance (
              id text PRIMARY KEY,
              entity_type text NOT NULL,
              entity_id text NOT NULL,
              law_name text,
              article_number int,
              source text NOT NULL DEFAULT 'uqn',
              source_id text,
              source_url text NOT NULL,
              text_sha text,
              retrieved_on date NOT NULL,
              action text NOT NULL,
              previous_text text,
              created_at timestamptz NOT NULL DEFAULT now()
            )
            """
        )
        cur.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS legal_text_provenance_idem
            ON legal_text_provenance (entity_type, entity_id, source_url, text_sha, action)
            """
        )
    con.commit()


def has_search_norm(con) -> bool:
    with con.cursor() as cur:
        cur.execute(
            """SELECT 1 FROM information_schema.columns
               WHERE table_name='legal_articles' AND column_name='search_norm'"""
        )
        return cur.fetchone() is not None


def load_systems(con) -> dict[str, dict]:
    with con.cursor() as cur:
        cur.execute(
            """
            SELECT s.id, s.name, s.eli_slug, s."articleCount",
                   (SELECT count(*) FROM legal_articles a WHERE a."lawName"=s.name) AS real_count
            FROM legal_systems s
            """
        )
        out = {}
        for sid, name, eli, ac, real in cur.fetchall():
            out[norm_name(name)] = {"id": sid, "name": name, "eli": eli, "article_count": ac, "real_count": int(real)}
        return out


def numbered_units(work: dict, strict: bool = True) -> list[dict]:
    rows = []
    for u in work["units"]:
        if u["unit_type"] not in ("article", "clause"):
            continue
        if not isinstance(u["number"], int) or u["number"] <= 0:
            if strict:
                raise ValueError(f"{work['source_id']} رقم وحدة غير صالح")
            continue
        if sha16(u["body"]) != u["text_sha"]:
            raise ValueError(f"{work['source_id']} بصمة لا تطابق النص seq={u['seq']}")
        if not (u["body"] or "").strip():
            continue
        rows.append(u)
    rows.sort(key=lambda r: (r["number"], r["seq"]))
    nums = [r["number"] for r in rows]
    if len(nums) != len(set(nums)):
        raise ValueError(f"{work['source_id']} رقم مادة مكرر")
    if strict:
        if nums != list(range(1, len(nums) + 1)):
            raise ValueError(f"{work['source_id']} تسلسل غير متصل")
        if len(rows) != work["article_count"]:
            raise ValueError(f"{work['source_id']} العدد {len(rows)} != {work['article_count']}")
    return rows


def preamble_text(work: dict) -> str:
    parts = []
    for u in work["units"]:
        if u["unit_type"] in ("enacting_instrument", "approval_instrument", "preamble", "unstructured_body"):
            parts.append(u["body"].strip())
    clause = (work.get("effective_clause") or "").strip()
    if clause:
        parts.append("النفاذ: " + clause)
    return "\n\n".join(p for p in parts if p)


def article_title(work: dict, number: int) -> str:
    if work.get("numbering") == "clauses":
        return f"البند {number}"
    return f"المادة {number}"


def insert_provenance(cur, **kw) -> None:
    cur.execute(
        """
        INSERT INTO legal_text_provenance
          (id, entity_type, entity_id, law_name, article_number, source, source_id, source_url,
           text_sha, retrieved_on, action, previous_text)
        VALUES (%s,%s,%s,%s,%s,'uqn',%s,%s,%s,%s,%s,%s)
        ON CONFLICT (entity_type, entity_id, source_url, text_sha, action) DO NOTHING
        """,
        (
            new_id(),
            kw["entity_type"],
            kw["entity_id"],
            kw.get("law_name"),
            kw.get("article_number"),
            kw.get("source_id"),
            kw["source_url"],
            kw.get("text_sha") or "",
            RETRIEVED,
            kw["action"],
            kw.get("previous_text"),
        ),
    )


def insert_system(cur, work: dict, preamble: str, decree: str | None, systems: dict) -> str:
    slug = law_slug(work["title"])
    cur.execute("SELECT 1 FROM legal_systems WHERE eli_slug=%s", (slug,))
    if cur.fetchone():
        slug = f"{slug}-{work['source_id'].split(':')[-1]}"
    sid = new_id()
    now = datetime.now(timezone.utc)
    cur.execute(
        """
        INSERT INTO legal_systems
          (id, name, "articleCount", eli_slug, preamble, preamble_royal_decree,
           preamble_updated_at, "createdAt", "updatedAt", sort_order)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,0)
        """,
        (sid, work["title"], work["article_count"], slug, preamble or None, decree, now, now, now),
    )
    insert_provenance(
        cur,
        entity_type="system",
        entity_id=sid,
        law_name=work["title"],
        source_id=work["source_id"],
        source_url=work["source_url"],
        text_sha=work.get("raw_sha") or sha16(work["title"]),
        action="insert",
    )
    systems[norm_name(work["title"])] = {
        "id": sid,
        "name": work["title"],
        "eli": slug,
        "article_count": work["article_count"],
        "real_count": work["article_count"],
    }
    return sid


def insert_articles(cur, work: dict, system_id: str, units: list[dict], decree: str | None, with_norm: bool) -> int:
    now = datetime.now(timezone.utc)
    n = 0
    for u in units:
        title = article_title(work, u["number"])
        keywords = ["source:uqn", f"uqn_id:{work['source_id']}", f"retrieved:{RETRIEVED}"]
        chapter = (u.get("chapter") or "").strip() or None
        aid = new_id()
        norm = search_norm(work["title"], title, u["body"], keywords, None, chapter) if with_norm else None
        if with_norm:
            cur.execute(
                """
                INSERT INTO legal_articles
                  (id, "legalSystemId", "lawName", "articleNumber", title, content, chapter, keywords,
                   "royalDecree", status, search_norm, "createdAt", "updatedAt")
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,'سارية',%s,%s,%s)
                ON CONFLICT ("lawName", "articleNumber") DO NOTHING
                """,
                (aid, system_id, work["title"], u["number"], title, u["body"], chapter, keywords, decree, norm, now, now),
            )
        else:
            cur.execute(
                """
                INSERT INTO legal_articles
                  (id, "legalSystemId", "lawName", "articleNumber", title, content, chapter, keywords,
                   "royalDecree", status, "createdAt", "updatedAt")
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,'سارية',%s,%s)
                ON CONFLICT ("lawName", "articleNumber") DO NOTHING
                """,
                (aid, system_id, work["title"], u["number"], title, u["body"], chapter, keywords, decree, now, now),
            )
        if cur.rowcount:
            n += 1
            cur.execute('SELECT id FROM legal_articles WHERE "lawName"=%s AND "articleNumber"=%s', (work["title"], u["number"]))
            real_id = cur.fetchone()[0]
            insert_provenance(
                cur,
                entity_type="article",
                entity_id=real_id,
                law_name=work["title"],
                article_number=u["number"],
                source_id=work["source_id"],
                source_url=u.get("source_url") or work["source_url"],
                text_sha=u["text_sha"],
                action="insert",
            )
    return n


def next_amendment_version(cur, article_id: str) -> int:
    cur.execute('SELECT coalesce(max(version),0)+1 FROM article_amendments WHERE "articleId"=%s', (article_id,))
    return int(cur.fetchone()[0])


def add_amendment(cur, article_id: str, change: str, decree: str | None, hijri: str | None, summary: str, previous: str | None, new_text: str | None, when) -> None:
    cur.execute(
        'SELECT 1 FROM article_amendments WHERE "articleId"=%s AND source=%s AND summary=%s',
        (article_id, "uqn", summary),
    )
    if cur.fetchone():
        return
    now = datetime.now(timezone.utc)
    cur.execute(
        """
        INSERT INTO article_amendments
          (id, "articleId", version, "changeType", "decreeRef", "effectiveFrom", "hijriDate",
           summary, "previousText", "newText", source, "reviewStatus", "createdAt", "updatedAt")
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'uqn','verified',%s,%s)
        """,
        (new_id(), article_id, next_amendment_version(cur, article_id), change, decree, when, hijri, summary, previous, new_text, now, now),
    )


def close_open_versions(cur, article_id: str, close_on) -> None:
    """الفهرس الفريد يسمح بنسخة واحدة نافذة (effective_to IS NULL) لكل مادة."""
    cur.execute(
        "UPDATE article_versions SET effective_to=%s WHERE article_id=%s AND effective_to IS NULL",
        (close_on, article_id),
    )


def snapshot_version(cur, article_id: str, text: str, decree: str | None, hijri: str | None, close_on, source: str) -> None:
    close_open_versions(cur, article_id, close_on)
    cur.execute(
        "SELECT 1 FROM article_versions WHERE article_id=%s AND version_text=%s",
        (article_id, text),
    )
    if cur.fetchone():
        return
    cur.execute(
        """
        INSERT INTO article_versions
          (id, article_id, version_text, effective_to, royal_decree, hijri_date, source)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
        """,
        (new_id(), article_id, text, close_on, decree, hijri, source),
    )


def replace_in_place(cur, work: dict, system: dict, units: list[dict], decree: str | None, with_norm: bool, stats: Counter) -> None:
    cur.execute(
        """
        SELECT content FROM legal_articles
        WHERE "lawName"=%s AND "articleNumber"=1
        """,
        (work["title"],),
    )
    current_first = cur.fetchone()
    cur.execute(
        """SELECT count(*) FROM legal_articles WHERE "lawName"=%s AND status='سارية'""",
        (work["title"],),
    )
    in_force = int(cur.fetchone()[0])
    if current_first and current_first[0] == units[0]["body"] and in_force == len(units):
        stats["in_place_already"] += 1
        return
    if system["real_count"] != IN_PLACE[work["title"]]["expect"]:
        stats["in_place_blocked_count"] += 1
        print(f"إيقاف إحلال «{work['title']}»: العدد {system['real_count']} != {IN_PLACE[work['title']]['expect']}")
        return
    preamble = preamble_text(work)
    cur.execute("SELECT preamble FROM legal_systems WHERE id=%s", (system["id"],))
    old_preamble = cur.fetchone()[0]
    now = datetime.now(timezone.utc)
    cur.execute(
        """
        UPDATE legal_systems
           SET "articleCount"=%s, preamble=%s, preamble_royal_decree=%s, preamble_updated_at=%s, "updatedAt"=%s
         WHERE id=%s
        """,
        (len(units), preamble or None, decree, now, now, system["id"]),
    )
    insert_provenance(
        cur,
        entity_type="system_preamble",
        entity_id=system["id"],
        law_name=work["title"],
        source_id=work["source_id"],
        source_url=work["source_url"],
        text_sha=sha16(preamble),
        action="versioned_replace",
        previous_text=old_preamble,
    )
    by_num = {u["number"]: u for u in units}
    cur.execute(
        """
        SELECT id, "articleNumber", title, content, status
        FROM legal_articles WHERE "lawName"=%s ORDER BY "articleNumber"
        """,
        (work["title"],),
    )
    existing = cur.fetchall()
    summary_base = f"uqn-2026-09-25:{work['source_id']}"
    for aid, num, title, content, status in existing:
        new_u = by_num.get(num)
        if new_u is None:
            if status != "ملغاة":
                snapshot_version(cur, aid, content, decree, work.get("published_hijri"), work.get("published_gregorian"), "uqn-snapshot")
                cur.execute(
                    """UPDATE legal_articles SET status='ملغاة', "updatedAt"=%s WHERE id=%s""",
                    (now, aid),
                )
                add_amendment(
                    cur, aid, "repealed", decree, work.get("published_hijri"),
                    summary_base + ":repeal-extra", content, None, work.get("published_gregorian"),
                )
                stats["articles_marked_repealed"] += 1
            continue
        if content == new_u["body"] and status == "سارية":
            stats["articles_unchanged"] += 1
            continue
        snapshot_version(cur, aid, content, decree, work.get("published_hijri"), work.get("published_gregorian"), "uqn-snapshot")
        keywords = ["source:uqn", f"uqn_id:{work['source_id']}", f"retrieved:{RETRIEVED}"]
        chapter = (new_u.get("chapter") or "").strip() or None
        new_title = article_title(work, num)
        if with_norm:
            norm = search_norm(work["title"], new_title, new_u["body"], keywords, None, chapter)
            cur.execute(
                """
                UPDATE legal_articles
                   SET content=%s, title=%s, chapter=%s, keywords=%s, "royalDecree"=%s,
                       status='سارية', search_norm=%s, "updatedAt"=%s
                 WHERE id=%s
                """,
                (new_u["body"], new_title, chapter, keywords, decree, norm, now, aid),
            )
        else:
            cur.execute(
                """
                UPDATE legal_articles
                   SET content=%s, title=%s, chapter=%s, keywords=%s, "royalDecree"=%s,
                       status='سارية', "updatedAt"=%s
                 WHERE id=%s
                """,
                (new_u["body"], new_title, chapter, keywords, decree, now, aid),
            )
        close_open_versions(cur, aid, work.get("published_gregorian"))
        cur.execute(
            """
            INSERT INTO article_versions
              (id, article_id, version_text, effective_from, royal_decree, hijri_date, source)
            SELECT %s,%s,%s,%s,%s,%s,'uqn'
            WHERE NOT EXISTS (
              SELECT 1 FROM article_versions WHERE article_id=%s AND source='uqn' AND version_text=%s
            )
            """,
            (new_id(), aid, new_u["body"], work.get("published_gregorian"), decree, work.get("published_hijri"), aid, new_u["body"]),
        )
        add_amendment(
            cur, aid, "amended", decree, work.get("published_hijri"),
            summary_base + ":replace", content, new_u["body"], work.get("published_gregorian"),
        )
        insert_provenance(
            cur,
            entity_type="article",
            entity_id=aid,
            law_name=work["title"],
            article_number=num,
            source_id=work["source_id"],
            source_url=new_u.get("source_url") or work["source_url"],
            text_sha=new_u["text_sha"],
            action="versioned_replace",
        )
        stats["articles_versioned"] += 1
    have = {num for _, num, _, _, _ in existing}
    missing = [u for u in units if u["number"] not in have]
    if missing:
        stats["articles_inserted"] += insert_articles(cur, work, system["id"], missing, decree, with_norm)
    stats["in_place_replaced"] += 1


def repeal_old_system(cur, name: str, spec: dict, new_work: dict | None, stats: Counter) -> None:
    cur.execute(
        """
        SELECT s.id, (SELECT count(*) FROM legal_articles a WHERE a."lawName"=s.name)
        FROM legal_systems s WHERE s.name=%s
        """,
        (name,),
    )
    row = cur.fetchone()
    if not row:
        stats["repeal_missing"] += 1
        print(f"لم يُعثر على النظام القديم «{name}» — لم يُعلَّم")
        return
    sid, real = row
    if int(real) != spec["expect"]:
        stats["repeal_blocked_count"] += 1
        print(f"إيقاف تعليم «{name}»: العدد {real} != {spec['expect']}")
        return
    decree = decree_label(new_work) if new_work else None
    hijri = new_work.get("published_hijri") if new_work else None
    when = new_work.get("published_gregorian") if new_work else None
    summary = f"uqn-2026-09-25:superseded-by:{spec['by']}"
    now = datetime.now(timezone.utc)
    cur.execute(
        """
        SELECT id, content, status FROM legal_articles WHERE "lawName"=%s
        """,
        (name,),
    )
    marked = 0
    for aid, content, status in cur.fetchall():
        if status == "ملغاة":
            continue
        cur.execute('UPDATE legal_articles SET status=%s, "updatedAt"=%s WHERE id=%s', ("ملغاة", now, aid))
        add_amendment(cur, aid, "repealed", decree, hijri, summary, content, None, when)
        marked += 1
    insert_provenance(
        cur,
        entity_type="system",
        entity_id=sid,
        law_name=name,
        source_id=spec["by"],
        source_url=(new_work or {}).get("source_url") or "https://www.uqn.gov.sa",
        text_sha="repeal-status",
        action="repeal_status",
    )
    stats["old_systems_repealed"] += 1
    stats["articles_marked_repealed"] += marked


def promote(con, works: list[dict], apply: bool, strict: bool = True, do_repeal: bool = True) -> Counter:
    stats: Counter = Counter()
    systems = load_systems(con)
    with_norm = has_search_norm(con)
    con.commit()
    by_id = {w["source_id"]: w for w in works}
    ordered = sorted(works, key=lambda w: (0 if w["dataset"] == "laws" else 1, w["source_id"]))
    for i, work in enumerate(ordered, 1):
        try:
            units = numbered_units(work, strict=strict)
        except ValueError as e:
            stats["skipped_invalid"] += 1
            print("تخطي", e)
            continue
        key = norm_name(work["title"])
        existing = systems.get(key)
        decree = decree_label(work)
        if existing and existing["name"] != work["title"]:
            stats["skipped_norm_collision"] += 1
            print(f"تصادم تطبيع: «{work['title']}» ≈ «{existing['name']}»")
            continue
        if existing and work["title"] in IN_PLACE and IN_PLACE[work["title"]]["source_id"] == work["source_id"]:
            stats["in_place_seen"] += 1
            if apply:
                try:
                    with con.cursor() as cur:
                        replace_in_place(cur, work, existing, units, decree, with_norm, stats)
                    con.commit()
                except Exception as e:
                    con.rollback()
                    stats["errors"] += 1
                    print(f"فشل إحلال «{work['title']}»: {e}")
        elif existing:
            stats["skipped_existing_name"] += 1
            print(f"اسم موجود مسبقًا، بلا استبدال: «{work['title']}» ({work['source_id']})")
        elif not units and not preamble_text(work):
            stats["skipped_no_text"] += 1
        else:
            stats["systems_to_insert"] += 1
            stats["articles_to_insert"] += len(units)
            if not apply:
                systems[key] = {"id": "dry", "name": work["title"], "eli": None, "article_count": len(units), "real_count": len(units)}
            else:
                try:
                    with con.cursor() as cur:
                        sid = insert_system(cur, work, preamble_text(work), decree, systems)
                        n = insert_articles(cur, work, sid, units, decree, with_norm)
                        if len(units) != (work.get("article_count") or 0):
                            cur.execute(
                                'UPDATE legal_systems SET "articleCount"=%s, "updatedAt"=%s WHERE id=%s',
                                (len(units), datetime.now(timezone.utc), sid),
                            )
                        stats["articles_inserted"] += n
                        stats["systems_inserted"] += 1
                    con.commit()
                except Exception as e:
                    con.rollback()
                    stats["errors"] += 1
                    systems.pop(key, None)
                    print(f"فشل إدراج «{work['title']}»: {e}")
        if apply and i % 40 == 0:
            print(f"… {i}/{len(ordered)}")
    con.commit()
    if not do_repeal:
        return stats
    for old_name, spec in REPEAL_OLD.items():
        new_work = by_id.get(spec["by"])
        if not new_work or norm_name(new_work["title"]) not in systems:
            stats["repeal_skipped_new_absent"] += 1
            continue
        if not apply:
            stats["old_systems_to_repeal"] += 1
            continue
        try:
            with con.cursor() as cur:
                repeal_old_system(cur, old_name, spec, new_work, stats)
            con.commit()
        except Exception as e:
            con.rollback()
            stats["errors"] += 1
            print(f"فشل تعليم «{old_name}»: {e}")
    return stats


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--allow-local", action="store_true")
    ap.add_argument("--remainder", action="store_true", help="يرحّل غير المكتمل الذي له نص، دون اختلاق")
    args = ap.parse_args()
    staging_url = os.environ.get("STAGING_DATABASE_URL", "postgresql://hakeem:hakeem_password@127.0.0.1:5432/uqn_staging")
    target_url = os.environ.get("TARGET_DATABASE_URL")
    if not target_url:
        sys.exit("TARGET_DATABASE_URL غير مضبوط")
    if args.apply:
        assert_apply_allowed(target_url, args.allow_local)
    print(f"هدف: {host_of(target_url)} · وضع: {'كتابة' if args.apply else 'جاف'}")
    with psycopg.connect(staging_url) as stage, psycopg.connect(target_url) as target:
        if not args.apply:
            target.execute("SET default_transaction_read_only = on")
            statuses = ("irregular_sequence", "needs_triage", "unstructured") if args.remainder else ("complete",)
            works = load_works(stage, statuses)
            stats = promote(target, works, apply=False, strict=not args.remainder, do_repeal=not args.remainder)
        else:
            print("نسخ الوسيط إلى الهدف…")
            copy_stage(stage, target)
            ensure_provenance(target)
            statuses = ("irregular_sequence", "needs_triage", "unstructured") if args.remainder else ("complete",)
            works = load_works(target, statuses)
            stats = promote(target, works, apply=True, strict=not args.remainder, do_repeal=not args.remainder)
    print("— النتيجة —")
    for k in sorted(stats):
        print(f"{k}={stats[k]}")


if __name__ == "__main__":
    assert law_slug("نظام التنفيذ") == "نظام-التنفيذ"
    assert sha16("abc") == hashlib.sha256(b"abc").hexdigest()[:16]
    main()
