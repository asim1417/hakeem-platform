-- فهارس HNSW جزئية لمتجهات المواد والمبادئ — إضافة فقط، لا تمسّ أي صف.
-- السبب: الفهرس العام على embeddings يخلط 50٬273 حكمًا مع 17٬325 مادة و4٬066 مبدأ، فالترشيح
-- بنوع المالك بعد الفهرس يُسقط أغلب المرشّحين (من أقرب 400 متجه لم تبقَ إلا نتيجة واحدة)،
-- فكان البحث الدلالي يمسح 21 ألف متجه كاملة (~9 ث باردة) ويتجاوز ميزانية المزوّد.
-- الاستعلام يطابق الشرط حرفيًّا (owner_type = 'article' / 'principle') ليختار المخطِّط الفهرس الجزئي.
-- متساوية القوة (idempotent).
CREATE INDEX IF NOT EXISTS "idx_embeddings_hnsw_article"
  ON "embeddings" USING hnsw ("embedding" vector_cosine_ops)
  WHERE "owner_type" = 'article';

CREATE INDEX IF NOT EXISTS "idx_embeddings_hnsw_principle"
  ON "embeddings" USING hnsw ("embedding" vector_cosine_ops)
  WHERE "owner_type" = 'principle';
