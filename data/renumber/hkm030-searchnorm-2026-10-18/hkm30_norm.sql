-- HKM-030: نظير SQL لـ normalizeArabicText (lib/modules/legal-core/arabic-morphology.ts)
-- مطابق لـ search_norm القائم في 28,736 مادة (عدا صفّي الاسمين المحدّثين مسبقًا) على فرع بروفة.
CREATE OR REPLACE FUNCTION uqn_fix.hkm30_norm(t text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $f$
  SELECT btrim(
    regexp_replace(
      regexp_replace(
        translate(regexp_replace(t, '[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]', '', 'g'), 'أإآٱؤئةى', 'ااااويهي'),
        '[^[:alpha:][:digit:][:space:]\u0660-\u0669\u06F0-\u06F9\u00B2\u00B3\u00B9\u00BC-\u00BE\u2070-\u2079\u2080-\u2089\u2150-\u2189\u2460-\u249B\u24EA-\u24FF\u2776-\u2793]', ' ', 'g'),
      '[[:space:]\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+', ' ', 'g'),
    E' \t\n\r')
$f$;
-- تركيب buildSearchNorm (lib/modules/legal-core/search-norm.ts) بمتن بديل
CREATE OR REPLACE FUNCTION uqn_fix.hkm30_search_norm(law text, title text, body text, keywords text[], classification text, chapter text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $f$
  SELECT uqn_fix.hkm30_norm(concat_ws(E'\n', nullif(law,''), nullif(title,''), nullif(body,''), nullif(array_to_string(keywords,' '),''), nullif(classification,''), nullif(chapter,'')))
$f$;
