-- HKM-030: جزء تركيب من ملاحظة هيئة الخبراء المخزنة في boe.amendment_note (لا نسخ للنص عبر الأدوات).
-- ["boe", note_id, موضع يبدأ من 0, طول, md5 الجزء الخام, "clean"?] — "clean" = توحيد المسافات فقط
-- (غير المنقسمة مسافة، وطيّ المسافات داخل السطر وحذفها من طرفيه، وطيّ 3 أسطر فارغة فأكثر)، مطابق لـ clean() في build_stale.py.
CREATE OR REPLACE FUNCTION uqn_fix.hkm30_clean(s text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$
  SELECT btrim(regexp_replace(regexp_replace(regexp_replace(replace(s, chr(160), ' '), '[ \t]+', ' ', 'g'), ' ?\n ?', E'\n', 'g'), '\n{3,}', E'\n\n', 'g'), E' \n')
$f$;
CREATE OR REPLACE FUNCTION uqn_fix.hkm30_part(p jsonb) RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE x jsonb; r text := ''; t text;
BEGIN
  IF jsonb_typeof(p) = 'string' THEN RETURN replace(p #>> '{}', chr(9085), chr(160)); END IF;  -- chr(9085) marks NBSP
  IF jsonb_typeof(p) = 'array' AND p ->> 0 = '@' THEN
    SELECT substr(body, (p ->> 2)::int + 1, (p ->> 3)::int) INTO t FROM uqn_fix.source_snapshot WHERE url = p ->> 1;
    IF t IS NULL OR md5(t) <> p ->> 4 THEN RAISE EXCEPTION 'hkm30: snapshot fragment mismatch %', p; END IF;
    RETURN t;
  END IF;
  IF jsonb_typeof(p) = 'array' AND p ->> 0 = 'boe' THEN
    SELECT substr(note_text, (p ->> 2)::int + 1, (p ->> 3)::int) INTO t FROM boe.amendment_note WHERE id = p ->> 1;
    IF t IS NULL OR md5(t) <> p ->> 4 THEN RAISE EXCEPTION 'hkm30: boe note fragment mismatch %', p; END IF;
    IF p ->> 5 = 'clean' THEN t := uqn_fix.hkm30_clean(t); END IF;
    RETURN t;
  END IF;
  FOR x IN SELECT * FROM jsonb_array_elements(p) LOOP r := r || uqn_fix.hkm30_part(x); END LOOP;
  RETURN r;
END $$;
