-- قراءة فقط بعد التطبيق.
SELECT s.id, s.name, (SELECT count(*) FROM legal_articles a WHERE a."legalSystemId" = s.id) AS articles,
       (SELECT md5(string_agg(content, '|' ORDER BY "articleNumber")) FROM legal_articles a WHERE a."legalSystemId" = s.id) AS content_md5,
       (SELECT verified_status FROM verification v WHERE v.object_type = 'work' AND v.object_id = s.id ORDER BY verified_at DESC, id DESC LIMIT 1) AS status
FROM legal_systems s WHERE s.id IN ($hk$boe26-46303ce06a82154ff9f839bf$hk$, $hk$cmpz5rt6500d5cwg25ey9d89j$hk$, $hk$boe26-6d0e7bc2e6cae54816b24981$hk$, $hk$cmpz5pfqt002lcwg2y1viv8vw$hk$, $hk$boe26-fc756d56e044a8c0d2272c52$hk$, $hk$cmpz5r6zj00bbcwg225jusnib$hk$) ORDER BY s.name, s.id;
