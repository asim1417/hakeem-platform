-- يتحقق من المجموعة الذهبية مقابل uqn_stage — يجب أن يعيد صفر صفوف
\set ON_ERROR_STOP off
SELECT 'uqn:4000869' AS source_id, w.title FROM uqn_stage.work w WHERE w.batch_id=:'batch' AND w.source_id='uqn:4000869' AND (coalesce(w.royal_decree_no,'')<>'م/237' OR w.article_count<>65);
SELECT 'uqn:4001869' AS source_id, w.title FROM uqn_stage.work w WHERE w.batch_id=:'batch' AND w.source_id='uqn:4001869' AND (coalesce(w.royal_decree_no,'')<>'م/96' OR w.article_count<>49);
SELECT 'uqn:26565' AS source_id, w.title FROM uqn_stage.work w WHERE w.batch_id=:'batch' AND w.source_id='uqn:26565' AND (coalesce(w.royal_decree_no,'')<>'م/83' OR w.article_count<>29);
SELECT 'uqn:26566' AS source_id, w.title FROM uqn_stage.work w WHERE w.batch_id=:'batch' AND w.source_id='uqn:26566' AND (coalesce(w.royal_decree_no,'')<>'م/83' OR w.article_count<>23);
SELECT 'uqn:25337' AS source_id, w.title FROM uqn_stage.work w WHERE w.batch_id=:'batch' AND w.source_id='uqn:25337' AND (coalesce(w.royal_decree_no,'')<>'م/19' OR w.article_count<>16);
SELECT 'uqn:4001465' AS source_id, w.title FROM uqn_stage.work w WHERE w.batch_id=:'batch' AND w.source_id='uqn:4001465' AND (coalesce(w.royal_decree_no,'')<>'م/36' OR w.article_count<>68);
SELECT 'uqn:24689' AS source_id, w.title FROM uqn_stage.work w WHERE w.batch_id=:'batch' AND w.source_id='uqn:24689' AND (coalesce(w.royal_decree_no,'')<>'م/159' OR w.article_count<>50);
SELECT 'uqn:25318' AS source_id, w.title FROM uqn_stage.work w WHERE w.batch_id=:'batch' AND w.source_id='uqn:25318' AND (coalesce(w.royal_decree_no,'')<>'م/25' OR w.article_count<>24);
SELECT 'uqn:27461' AS source_id, w.title FROM uqn_stage.work w WHERE w.batch_id=:'batch' AND w.source_id='uqn:27461' AND (coalesce(w.royal_decree_no,'')<>'م/56' OR w.article_count<>38);
SELECT 'uqn:27293' AS source_id, w.title FROM uqn_stage.work w WHERE w.batch_id=:'batch' AND w.source_id='uqn:27293' AND (coalesce(w.royal_decree_no,'')<>'م/14' OR w.article_count<>15);
SELECT 'uqn:28662' AS source_id, w.title FROM uqn_stage.work w WHERE w.batch_id=:'batch' AND w.source_id='uqn:28662' AND (coalesce(w.royal_decree_no,'')<>'م/102' OR w.article_count<>27);
SELECT 'uqn:27037' AS source_id, w.title FROM uqn_stage.work w WHERE w.batch_id=:'batch' AND w.source_id='uqn:27037' AND (coalesce(w.royal_decree_no,'')<>'م/188' OR w.article_count<>34);
SELECT 'uqn:26600' AS source_id, w.title FROM uqn_stage.work w WHERE w.batch_id=:'batch' AND w.source_id='uqn:26600' AND (coalesce(w.royal_decree_no,'')<>'م/84' OR w.article_count<>20);
SELECT 'uqn:4001278' AS source_id, w.title FROM uqn_stage.work w WHERE w.batch_id=:'batch' AND w.source_id='uqn:4001278' AND (coalesce(w.royal_decree_no,'')<>'م/12' OR w.article_count<>16);
SELECT 'uqn:4001669' AS source_id, w.title FROM uqn_stage.work w WHERE w.batch_id=:'batch' AND w.source_id='uqn:4001669' AND (w.article_count<>15);
SELECT 'uqn:4000954' AS source_id, w.title FROM uqn_stage.work w WHERE w.batch_id=:'batch' AND w.source_id='uqn:4000954' AND (w.article_count<>17);
SELECT 'uqn:27339' AS source_id, w.title FROM uqn_stage.work w WHERE w.batch_id=:'batch' AND w.source_id='uqn:27339' AND (coalesce(w.royal_decree_no,'')<>'م/29' OR w.article_count<>22);
SELECT 'uqn:25376' AS source_id, w.title FROM uqn_stage.work w WHERE w.batch_id=:'batch' AND w.source_id='uqn:25376' AND (coalesce(w.royal_decree_no,'')<>'م/43' OR w.article_count<>23);
SELECT 'uqn:25125' AS source_id, w.title FROM uqn_stage.work w WHERE w.batch_id=:'batch' AND w.source_id='uqn:25125' AND (w.article_count<>12);
SELECT 'uqn:4000299' AS source_id, w.title FROM uqn_stage.work w WHERE w.batch_id=:'batch' AND w.source_id='uqn:4000299' AND (w.article_count<>61);
