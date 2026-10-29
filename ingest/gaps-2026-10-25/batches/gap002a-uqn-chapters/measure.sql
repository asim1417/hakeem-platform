SELECT count(*) n, count(DISTINCT sid) systems, count(DISTINCT heading) headings, md5(string_agg(tid||'|'||heading, '|' ORDER BY tid)) fp FROM (WITH us AS (SELECT DISTINCT p.entity_id sid, p.source_id FROM legal_text_provenance p WHERE p.source='uqn' AND p.entity_type='system'),
t AS (SELECT us.*, s.name FROM us JOIN legal_systems s ON s.id=us.sid
  WHERE NOT EXISTS (SELECT 1 FROM legal_articles z WHERE z."legalSystemId"=us.sid AND coalesce(z.chapter,'')<>'')
    AND (SELECT count(*) FROM us u2 WHERE u2.sid=us.sid)=1
    AND s.name !~ '(حقوق المؤلف|الإحصاء|الخطوط الحديدية|الأسماء التجارية|السجل التجاري|الاستثمار الأجنبي)' AND s.name <> ALL (ARRAY[$hk$ضوابط المنشآت الواقعة بأسواق النفع العام للخضار والفواكه واللحوم والبيض والأسماك$hk$])
    AND NOT EXISTS (SELECT 1 FROM uqn_stage.unit u WHERE u.source_id=us.source_id AND u.unit_type='article' AND u.body ~ '(^|\n)\s*(الباب|الفصل|القسم|الجزء|الفرع)\s+\S+')),
un AS (SELECT u.source_id, u.number, count(*) c FROM uqn_stage.unit u JOIN t ON t.source_id=u.source_id WHERE u.unit_type='article' AND u.number IS NOT NULL GROUP BY 1,2),
c AS (SELECT a.id tid, t.sid, t.source_id, u.seq,
   btrim(regexp_replace(regexp_replace(CASE WHEN coalesce(u.chapter,'')<>'' AND coalesce(u.section,'')<>'' THEN u.chapter||' › '||u.section ELSE coalesce(nullif(u.chapter,''),u.section,'') END, '\s*\n\s*', ' — ', 'g'), '\s+', ' ', 'g')) heading,
   uqn_fix.hkm30_norm(regexp_replace(u.body, '(\s*(تنزيل الملف|تم نسخ الرابط))*\s*جميع الحقوق محفوظة لجريدة أم القرى © \d{4}\s*$', '')) ub, uqn_fix.hkm30_norm(a.content) ac, uqn_fix.hkm30_norm(coalesce(a.title||' ','')||a.content) atc
 FROM t JOIN legal_articles a ON a."legalSystemId"=t.sid AND a."articleBis"=0 AND coalesce(a.chapter,'')=''
 JOIN uqn_stage.unit u ON u.source_id=t.source_id AND u.unit_type='article' AND u.number=a."articleNumber"
 JOIN un ON un.source_id=u.source_id AND un.number=u.number AND un.c=1)
SELECT tid, sid, source_id, seq, heading FROM c
WHERE (ub=ac OR ub=atc OR greatest(similarity(ub,ac),similarity(ub,atc))>=0.9)
  AND heading ~ '^(الباب|الفصل|القسم|الجزء|الفرع)\s' AND length(heading) BETWEEN 3 AND 200 AND heading !~ 'المادة' AND heading !~ '[*#_|<>]'
  AND length(regexp_replace(heading,'[^(]','','g'))=length(regexp_replace(heading,'[^)]','','g'))) x
