-- كل استعلام يجب أن يعيد صفر صفوف
\echo 'F1 إحلال مثبت دليله غير موجود حرفيًّا في لقطة المصدر'
SELECT s.id, s.old_title FROM uqn_fix.supersession_evidence s JOIN uqn_fix.source_snapshot p ON p.url = s.evidence_url
WHERE s.status='proven' AND position(regexp_replace(s.evidence_quote,'\s+',' ','g') in regexp_replace(p.body,'\s+',' ','g')) = 0;
\echo 'F2 إحلال مثبت بلا لقطة مصدر'
SELECT id, old_title FROM uqn_fix.supersession_evidence s WHERE status='proven' AND NOT EXISTS (SELECT 1 FROM uqn_fix.source_snapshot p WHERE p.url=s.evidence_url);
\echo 'F3 أداة إصدار بندها المعتمِد غير موجود في لقطتها'
SELECT i.id, i.law_title FROM uqn_fix.issuance_instrument i JOIN uqn_fix.source_snapshot p ON p.url=i.source_url
WHERE position(regexp_replace(left(i.approving_clause,300),'\s+',' ','g') in regexp_replace(p.body,'\s+',' ','g')) = 0;
\echo 'F4 عملية بنص جديد غير موجود حرفيًّا في مصدرها وموسومة rule_exact'
SELECT o.op_id FROM uqn_fix.amendment_op o JOIN uqn_fix.source_snapshot p ON p.url=o.source_url
WHERE o.confidence='rule_exact' AND o.new_text IS NOT NULL
  AND position(regexp_replace(left(o.new_text,400),'\s+',' ','g') in regexp_replace(p.body,'\s+',' ','g')) = 0;
\echo 'F5 عملية rule_exact عليها مخاطرة (يجب أن تكون needs_review)'
SELECT op_id, risks FROM uqn_fix.amendment_op WHERE confidence='rule_exact' AND cardinality(risks) > 0;
\echo 'F6 عملية معتمدة بلا تاريخ سريان'
SELECT d.op_id FROM uqn_fix.amendment_decision d JOIN uqn_fix.amendment_op o USING (op_id)
WHERE d.decision IN ('approved','approved_with_edit') AND coalesce(d.corrected->>'effective_from_gregorian', o.effective_from_gregorian::text) IS NULL;
\echo 'F7 عمليتان معتمدتان تستبدلان نص المادة نفسها بتاريخ السريان نفسه بنصين مختلفين'
SELECT o1.target_law_title, o1.article_number, o1.effective_from_gregorian FROM uqn_fix.amendment_decision d1 JOIN uqn_fix.amendment_op o1 USING (op_id)
JOIN uqn_fix.amendment_decision d2 ON d2.op_id > d1.op_id JOIN uqn_fix.amendment_op o2 ON o2.op_id = d2.op_id
WHERE d1.decision<>'rejected' AND d2.decision<>'rejected' AND o1.op_type='replace_article_text' AND o2.op_type='replace_article_text'
  AND o1.target_law_title=o2.target_law_title AND o1.article_number=o2.article_number
  AND o1.effective_from_gregorian=o2.effective_from_gregorian AND o1.new_text<>o2.new_text;
\echo 'F8 محاولة تعديل أو حذف مرفوضة (يجب أن تفشل) — اختبار الحارس'
DO $$ BEGIN
  BEGIN UPDATE uqn_fix.amendment_op SET confidence='rule_exact' WHERE false OR op_id = (SELECT min(op_id) FROM uqn_fix.amendment_op);
        RAISE EXCEPTION 'GUARD FAILED: update allowed';
  EXCEPTION WHEN raise_exception THEN
        IF SQLERRM LIKE 'GUARD FAILED%' THEN RAISE; END IF; END;
END $$;
\echo 'F9 مؤشرات'
SELECT confidence, count(*) FROM uqn_fix.amendment_op GROUP BY 1;
SELECT status, relation, count(*) FROM uqn_fix.supersession_evidence GROUP BY 1,2;
