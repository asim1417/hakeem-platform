-- ═══════════════════════════════════════════════════════════════════════════
-- content-anomalies.sql — شذوذ النصوص القانونية (للقراءة فقط)
-- الغرض: كشف نصوص فارغة/قصيرة/مبتورة/برموز غريبة/بأرقام غير موحّدة.
-- المتوقّع الصحّي: أعداد منخفضة جدًّا؛ أي ارتفاع = مشكلة استيراد/OCR.
-- ═══════════════════════════════════════════════════════════════════════════

SELECT
  count(*)                                                                    AS total,
  -- فراغ / قِصَر غير منطقي
  count(*) FILTER (WHERE content IS NULL OR btrim(content)='')                 AS empty,
  count(*) FILTER (WHERE length(btrim(content)) < 15)                          AS too_short,
  -- عنوان فقط (المحتوى ≈ العنوان)
  count(*) FILTER (WHERE btrim(content) = btrim(title))                        AS content_equals_title,
  -- رموز ترميز مكسورة (replacement char U+FFFD)
  count(*) FILTER (WHERE content LIKE '%' || U&'\FFFD' || '%')                 AS replacement_char,
  -- أحرف فارسية بدل العربية (پ چ ژ گ)
  count(*) FILTER (WHERE content ~ '[پچژگ]')                                   AS persian_letters,
  -- أرقام لاتينية وعربية-هندية مختلطة في نفس النصّ
  count(*) FILTER (WHERE content ~ '[0-9]' AND content ~ '[٠-٩]')              AS mixed_digits,
  -- بقايا HTML / وسوم
  count(*) FILTER (WHERE content ~* '<[a-z/][^>]*>' OR content LIKE '%&nbsp;%') AS html_remnants,
  -- بقايا ترقيم صفحات / نقاط قيادة
  count(*) FILTER (WHERE content ~ 'صفحة\s*[0-9٠-٩]+' OR content ~ '\.{6,}')    AS page_artifacts,
  -- أحرف تحكّم (تلف ترميز)
  count(*) FILTER (WHERE content ~ '[\x00-\x08\x0B\x0C\x0E-\x1F]')             AS control_chars,
  -- بداية/نهاية مبتورة (يبدأ بحرف صغير لاتيني أو ينتهي بفاصلة/واو معلّقة)
  count(*) FILTER (WHERE btrim(content) ~ '(^[،,]|[،,و]$)')                    AS truncated_edges,
  -- تطويل (كشيدة) — تجميلي، منخفض الخطورة
  count(*) FILTER (WHERE content LIKE '%ـ%')                                   AS tatweel
FROM legal_articles;

-- عيّنات لكل شذوذ خطير (للمراجعة اليدوية) ──────────────────────────────────
-- نصوص قصيرة جدًّا
SELECT id, "lawName", "articleNumber", content
FROM legal_articles
WHERE length(btrim(content)) < 15 AND btrim(content) <> ''
ORDER BY length(content)
LIMIT 50;

-- محتوى = عنوان (مادة بلا نصّ فعلي)
SELECT id, "lawName", "articleNumber", title
FROM legal_articles
WHERE btrim(content) = btrim(title)
LIMIT 50;

-- ترميز مكسور
SELECT id, "lawName", "articleNumber", left(content, 120) AS snippet
FROM legal_articles
WHERE content LIKE '%' || U&'\FFFD' || '%'
LIMIT 50;

-- أرقام مختلطة (يؤثّر على البحث برقم المادة)
SELECT id, "lawName", "articleNumber", left(content, 120) AS snippet
FROM legal_articles
WHERE content ~ '[0-9]' AND content ~ '[٠-٩]'
LIMIT 50;
