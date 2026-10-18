-- HKM-030 المرحلة 5: دالة تركيب نص النسخة داخل القاعدة (مخطط العمل uqn_fix، لا تمس جداول المنتج).
-- spec: مصفوفة JSON من عمليات التحرير بالترتيب؛ كل «جزء» نص حرفي أو مصفوفة أجزاء، والجزء المقتطع من لقطة الأداة
-- يكتب ["@", url, موضع يبدأ من 0, طول, md5] ويُتحقق من بصمته. أي عدم تطابق يرفع استثناءً يلغي المعاملة.
-- في النص الحرفي تُكتب المسافة غير المنقسمة ⍽ (الهروب \u00a0 قد يُفك مرتين في النقل فتختل البصمة).
--   ["whole", P] | ["sub", OLD, NEW] (OLD موجود مرة واحدة بالضبط) | ["suball", OLD, NEW] («أينما ورد»: مرة على الأقل) | ["append", P]
--   ["span", A, Z, NEW] (يستبدل من A حتى ما قبل Z) | ["from", A, NEW] (من A حتى آخر النص)
--   ["re", PATTERN, REPLACEMENT] (مطابقة واحدة بالضبط)
CREATE OR REPLACE FUNCTION uqn_fix.hkm30_part(p jsonb) RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE x jsonb; r text := ''; t text;
BEGIN
  IF jsonb_typeof(p) = 'string' THEN RETURN replace(p #>> '{}', '⍽', chr(160)); END IF;  -- ⍽ = مسافة غير منقسمة
  IF jsonb_typeof(p) = 'array' AND p ->> 0 = '@' THEN
    SELECT substr(body, (p ->> 2)::int + 1, (p ->> 3)::int) INTO t FROM uqn_fix.source_snapshot WHERE url = p ->> 1;
    IF t IS NULL OR md5(t) <> p ->> 4 THEN RAISE EXCEPTION 'hkm30: snapshot fragment mismatch %', p; END IF;
    RETURN t;
  END IF;
  FOR x IN SELECT * FROM jsonb_array_elements(p) LOOP r := r || uqn_fix.hkm30_part(x); END LOOP;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION uqn_fix.hkm30_compose(base text, spec text, spec_md5 text) RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE e jsonb; b text := base; a text; z text; n int; k int := 0;
BEGIN
  IF base IS NULL THEN RAISE EXCEPTION 'hkm30: base missing or md5 mismatch'; END IF;
  IF md5(spec) <> spec_md5 THEN RAISE EXCEPTION 'hkm30: spec md5 mismatch'; END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(spec::jsonb) LOOP
    k := k + 1;
    CASE e ->> 0
      WHEN 'whole' THEN b := uqn_fix.hkm30_part(e -> 1);
      WHEN 'append' THEN b := b || uqn_fix.hkm30_part(e -> 1);
      WHEN 'sub' THEN
        a := uqn_fix.hkm30_part(e -> 1);
        n := (length(b) - length(replace(b, a, ''))) / length(a);
        IF n <> 1 THEN RAISE EXCEPTION 'hkm30: edit % sub found % times: %', k, n, left(a, 80); END IF;
        b := replace(b, a, uqn_fix.hkm30_part(e -> 2));
      WHEN 'suball' THEN
        a := uqn_fix.hkm30_part(e -> 1);
        n := (length(b) - length(replace(b, a, ''))) / length(a);
        IF n < 1 THEN RAISE EXCEPTION 'hkm30: edit % suball found none: %', k, left(a, 80); END IF;
        b := replace(b, a, uqn_fix.hkm30_part(e -> 2));
      WHEN 'span' THEN
        a := uqn_fix.hkm30_part(e -> 1); z := uqn_fix.hkm30_part(e -> 2);
        IF (length(b) - length(replace(b, a, ''))) / length(a) <> 1 OR (length(b) - length(replace(b, z, ''))) / length(z) <> 1
           OR strpos(b, a) >= strpos(b, z) THEN RAISE EXCEPTION 'hkm30: edit % span anchors: % / %', k, left(a, 60), left(z, 60); END IF;
        b := left(b, strpos(b, a) - 1) || uqn_fix.hkm30_part(e -> 3) || substr(b, strpos(b, z));
      WHEN 'from' THEN
        a := uqn_fix.hkm30_part(e -> 1);
        IF (length(b) - length(replace(b, a, ''))) / length(a) <> 1 THEN RAISE EXCEPTION 'hkm30: edit % from-anchor: %', k, left(a, 60); END IF;
        b := left(b, strpos(b, a) - 1) || uqn_fix.hkm30_part(e -> 2);
      WHEN 're' THEN
        a := uqn_fix.hkm30_part(e -> 1);
        SELECT count(*) INTO n FROM regexp_matches(b, a, 'g');
        IF n <> 1 THEN RAISE EXCEPTION 'hkm30: edit % regex matched % times: %', k, n, a; END IF;
        b := regexp_replace(b, a, uqn_fix.hkm30_part(e -> 2));
      ELSE RAISE EXCEPTION 'hkm30: unknown op %', e ->> 0;
    END CASE;
  END LOOP;
  RETURN normalize(b, NFC);
END $$;
