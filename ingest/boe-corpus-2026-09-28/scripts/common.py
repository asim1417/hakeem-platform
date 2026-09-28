"""أدوات مشتركة: الاتصال المحروس، والحراس، والتطبيع (مطابق لـ normalizeSystemName في TypeScript)."""
import hashlib
import os
import re
import unicodedata

import psycopg

GUARD = {
    ("نظام التنفيذ", 1): "0c1443e1dcdf68c655856daa5d4188b5",
    ("نظام المعاملات المدنية", 1): "bb195018b612438b9d03d9c2b2ef80c4",
}
MIXED_COUNTS = {"نظام التنفيذ": 98, "نظام السجل التجاري": 29, "نظام الأسماء التجارية": 23}
WATCH = ("legal_systems", "legal_articles", "verification")


def sid(prefix: str, *parts: str) -> str:
    return prefix + hashlib.sha256("|".join(parts).encode()).hexdigest()[:24]


def host(url: str) -> str:
    return url.split("@")[-1].split("/")[0].split("?")[0]


def connect(target: str) -> psycopg.Connection:
    """staging = 127.0.0.1 فقط؛ branch = فرع Neon غير الإنتاج؛ production = ep-icy-rice مع HAKEEM_INJECT=yes."""
    if target == "production":
        if os.environ.get("HAKEEM_INJECT") != "yes":
            raise SystemExit("مرفوض: الإنتاج يحتاج HAKEEM_INJECT=yes بعد كلمة المالك «احقن»")
        url = os.environ.get("DATABASE_UR", "")
        h = host(url).split(":")[0]
        if "ep-icy-rice" not in h or not h.endswith(".neon.tech"):
            raise SystemExit("مرفوض: الهدف ليس مضيف الإنتاج المعروف")
    else:
        url = os.environ.get("DATABASE_URL", "")
        h = host(url).split(":")[0]
        if target == "staging" and h not in ("127.0.0.1", "localhost"):
            raise SystemExit("مرفوض: staging يقبل 127.0.0.1 أو localhost فقط")
        if target == "branch" and (not h.endswith(".neon.tech") or "ep-icy-rice" in h):
            raise SystemExit("مرفوض: branch يقبل فرع Neon غير الإنتاج فقط")
    print("target", target, "host_prefix", h.split(".")[0][:10])
    con = psycopg.connect(url, connect_timeout=30)
    con.execute("SET statement_timeout = '600s'")
    return con


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
    for law, n in MIXED_COUNTS.items():
        cur.execute('SELECT count(*) FROM legal_articles WHERE "lawName"=%s', (law,))
        out["count:" + law] = cur.fetchone()[0]
        if strict and out["count:" + law] != n:
            raise SystemExit(f"عدد السجل المخلوط غير المتوقع: {law}")
    return out


def totals(cur) -> dict:
    t = {}
    for k in ("legal_systems", "legal_articles", "verification"):
        cur.execute(f"SELECT count(*) FROM {k}")
        t[k] = cur.fetchone()[0]
    return t


# ── التطبيع: نسخة حرفية من lib/modules/legal-core/arabic-morphology.ts وsystems-registry.ts ──
_DIAC = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭ]")


def normalize_arabic_text(text: str) -> str:
    t = _DIAC.sub("", text or "").replace("ـ", "")
    t = re.sub(r"[أإآٱ]", "ا", t).replace("ؤ", "و").replace("ئ", "ي")
    t = t.replace("ة", "ه").replace("ى", "ي")
    t = "".join(ch if (unicodedata.category(ch)[0] in ("L", "N") or ch.isspace()) else " " for ch in t)
    return re.sub(r"\s+", " ", t).strip()


_PREFIXES = [normalize_arabic_text(x) for x in ["نظام", "لائحة", "اللائحة التنفيذية", "اللائحة", "تنظيم", "قواعد", "ضوابط", "دليل", "الدليل", "آلية", "قرار"]]


def normalize_system_name(name: str) -> str:
    n = normalize_arabic_text(name or "")
    for p in _PREFIXES:
        if n.startswith(p + " "):
            n = n[len(p):].strip()
            break
    n = re.sub(r"^التنفيذيه?\s+ل", "", n).strip()
    n = re.sub(r"\s+الصادر[ةه]?\s+(?:بال|ب)(?:مرسوم|امر|قرار).*$", "", n).strip()
    return n


def ws(s: str) -> str:
    return re.sub(r"\s+", "", s or "")


def require_approval(target: str, rows: int, preview: bool) -> None:
    """أي دفعة إنتاج > 100 صف: معاينة أولًا ثم موافقة المالك بعدد الصفوف نفسه في HAKEEM_APPROVED_ROWS."""
    if target != "production" or preview or rows <= 100:
        return
    if os.environ.get("HAKEEM_APPROVED_ROWS") != str(rows):
        raise SystemExit(f"دفعة {rows} صفًا > 100: شغّل --preview وأرسل الأرقام للمالك، ثم أعد مع HAKEEM_APPROVED_ROWS={rows} بعد موافقته")
