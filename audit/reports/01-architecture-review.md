# 01 — مراجعة المعمارية

## خريطة المشروع (مؤكَّدة من الملفّات)
```
Frontend (Next.js 14 App Router, RTL)   app/*  (dashboard, search, legal, admin, developers, eli…)
        │  POST
API layer (27 مجموعة)                    app/api/*
   ├─ خارجي (بوابة مفاتيح)               app/api/legal/*, app/api/openapi
   └─ داخلي (جلسة + RBAC)                app/api/legal-core|legal-search|legal-chat|ai|admin|cases…
        │
Service/domain (25 وحدة)                 lib/modules/*
        │
DB (Prisma singleton)                    lib/prisma.ts  → PostgreSQL/Neon (49 نموذجًا)
Search (4 مزوّدات + RRF)                 lib/modules/legal-search/*  + legal-core (BM25)
AI (fetch مباشر، متعدّد المزوّدين)       lib/modules/ai/*  → Anthropic|OpenAI|Gemini|Custom
Ingestion (سكربتات + doc-node)           scripts/*  + services/doc-node
Auth/RBAC/Audit                          lib/modules/auth/*, audit/*
```

## المكوّنات — أدلّة
- **الإطار:** Next `^14.2.18`، React `^18.3.1`، Prisma `^5.22.0`، zod، Tailwind (`package.json`). [مفحوص]
- **الطبقة الخادميّة للبحث:** `hybrid-search.ts:17-22` تسجّل `[postgres, vector, knowledge_graph, opensearch]`
  وتدمجها بـRRF (`hybrid-search.ts:148-200`). [مفحوص]
- **الذكاء الاصطناعي:** لا SDK في الحزم — كل الاستدعاءات `fetch` خام إلى
  `api.anthropic.com` / `api.openai.com` / Gemini / Custom (`ai/ai-config.ts:257,268`). المزوّد الافتراضي
  `mock`/offline. [مفحوص]
- **تدفّق استعلام قانوني (شات):** UI → `app/api/legal-chat/route.ts` (`requireApiPermission` + zod) →
  `chat-orchestrator.ts` → `policy-gate` → `anti-hallucination.groundQuery` → `case-analysis-engine` →
  `legal-rag-service` → `hybridSearch` → `citation-engine.verifyCitations` → حفظ + `auditEvent`. [مفحوص، سلسلة ملفّات]

## نقاط الضعف المعماريّة (مع أدلّة)
| الرمز | الضعف | الدليل |
|---|---|---|
| ARCH-001 | **Repository Pattern غائب** رغم إلزام CLAUDE.md به (`lib/db/repository/`) — كل وحدة تنادي `prisma.*` مباشرة | لا مجلّد repository؛ `lib/prisma.ts` singleton فقط |
| ARCH-002 | **مخالفة «Claude حصريًّا»:** مزوّدو OpenAI/Gemini/Custom مدعومون بالتساوي، والمتجهات من OpenAI | `ai/ai-config.ts:241-286`، `ai/embeddings.ts:12-17` |
| ARCH-003 | **قصّة النشر مجزّأة:** لا تهيئة نشر للتطبيق نفسه (Vercel مُستنتج من تعليقات)؛ railway/render ينشران أدوات الوثائق فقط، وRender يكرّر doc-tool مرّتين | `railway.json`, `render.yaml`, `next.config.mjs` تعليقات |
| ARCH-004 | **محرّكا بحث متوازيان:** `hybridSearch` (RRF) مقابل `searchLegalCore` (تسجيل مختلف) لنفس الاستعلام | `legal-search/hybrid-search.ts` مقابل `legal-core/legal-retrieval.ts:754-837` |
| ARCH-005 | **ادّعاءات CLAUDE.md غير محقّقة:** لا LangChain، لا WhatsApp، لا pgvector-driver (SQL خام)، الـembedding `ivfflat` في الوثيقة لكن الفعلي HNSW في سكربت يدوي | حزم `package.json`؛ `scripts/sql/neon-retrieval-hnsw.sql` |

## التكاملات الخارجية (أسماء متغيّرات فقط، بلا قيم)
Anthropic/OpenAI/Gemini/Custom (ذكاء) · OpenSearch · Azure Blob · SharePoint/MS Graph · Google Drive OAuth ·
Turath.io · أداة الوثائق (FastAPI). لا WhatsApp/Intercom/Analytics في الكود.

## ما تعذّر فحصه
- المزوّد المُفعَّل فعليًّا وقت التشغيل (يعتمد env/app_settings لم تُقرأ).
- سلوك ~123 سكربتًا بالكامل (فُحصت رؤوسها والحرجة منها).
