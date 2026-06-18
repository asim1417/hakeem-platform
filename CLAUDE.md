# CLAUDE.md — منصة حكيم
## الأمر الموجه الشامل لـ Claude Code
### يُحفظ في جذر المشروع كـ CLAUDE.md

---

أنت المهندس الرئيسي لمنصة **حكيم** — منصة المعرفة القضائية السعودية.
مهمتك: تطوير المنصة وفق المعمارية المحددة أدناه،
مستفيداً من التحليل الاستخباراتي الكامل للمنافس الرئيسي **قانونية**.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
الجزء الأول — هوية المنصة وفلسفتها
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ما هو حكيم؟

حكيم ليس محرك بحث قانوني — هذا ما تفعله قانونية.
حكيم هو **رفيق المحامي في القاعة** — يفهم الوقائع، يحلل القضية،
يقترح الدفوع، ويُحاكي تفكير القاضي.

```
قانونية:  [مستند] ← [باحث] ← الباحث يتصرف بنفسه
حكيم:     [وقائع] → [تحليل] → [محاكاة قضائية] → [استراتيجية]
```

**قانونية تُعطيك القانون. حكيم يُقيّم قضيتك.**

## الجمهور المستهدف
- المحامي المستقل والمكتب الصغير (≤ 10 محامين)
- طلاب القانون والمتدربون
- القضاة المتدربون والمتخصصون
- **ليس**: الإدارة القانونية في أرامكو وPIF (هذا ملعب قانونية)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
الجزء الثاني — المعمارية التقنية الكاملة
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Stack المنصة

```
Frontend:   Next.js 14 / TypeScript / Tailwind CSS
Auth:       Microsoft Entra ID (Azure AD)
Database:   PostgreSQL + Prisma ORM
Vector:     pgvector (داخل PostgreSQL)
Graph:      PostgreSQL مع جداول علاقات (مرحلة أولى)
Search:     pgvector أولاً ← OpenSearch لاحقاً
AI:         Anthropic Claude (claude-sonnet-4-6) — حصري
RAG:        LangChain / custom pipeline
Storage:    Azure Blob / SharePoint
Messaging:  WhatsApp Business API
```

## المعمارية الخماسية لعقل حكيم

### الطبقة 1 — قاعدة البيانات (PostgreSQL)
```sql
-- الجداول الأساسية
systems          (الأنظمة القانونية)
articles         (مواد الأنظمة)
amendments       (التعديلات التاريخية)
judicial_rulings (الأحكام القضائية)
legal_principles (المبادئ القضائية)
users            (المستخدمون)
cases            (ملفات القضايا)
annotations      (الملاحظات والتظليلات)
```

**قاعدة القاعدة:** كل شيء يُبنى فوق PostgreSQL أولاً.
لا تُضيف أداة جديدة حتى يثبت PostgreSQL عجزه.

### الطبقة 2 — Knowledge Graph (العلاقات القانونية)

```
المادة ←→ الحكم القضائي
المادة ←→ المبدأ القانوني
المبدأ ←→ الدفع المقترح
الحكم  ←→ القضية المشابهة
النظام ←→ لائحته التنفيذية
الوقيعة ←→ المواد ذات الصلة
```

**التطبيق:** جداول علاقات في PostgreSQL (مرحلة أولى)،
ثم Neo4j إذا تعقّدت الاستعلامات (مرحلة لاحقة).

```sql
-- مثال schema للعلاقات
CREATE TABLE legal_relations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL, -- 'article' | 'ruling' | 'principle'
  source_id   UUID NOT NULL,
  target_type TEXT NOT NULL,
  target_id   UUID NOT NULL,
  relation    TEXT NOT NULL, -- 'SUPPORTS' | 'CONTRADICTS' | 'INTERPRETS'
  strength    FLOAT DEFAULT 1.0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_relations_source ON legal_relations(source_type, source_id);
CREATE INDEX idx_relations_target ON legal_relations(target_type, target_id);
```

### الطبقة 3 — Vector Search (البحث بالمعنى)

```sql
-- pgvector في PostgreSQL — لا حاجة لأداة خارجية الآن
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE articles  ADD COLUMN embedding vector(1536);
ALTER TABLE rulings   ADD COLUMN embedding vector(1536);
ALTER TABLE principles ADD COLUMN embedding vector(1536);

-- Cosine similarity index
CREATE INDEX idx_articles_embedding
  ON articles USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

**متى ننتقل لـ OpenSearch؟**
فقط عندما يتجاوز عدد المستندات 50,000 أو يصبح وقت الاستجابة > 500ms.

### الطبقة 4 — OpenSearch / Elasticsearch (مرحلة لاحقة)

```yaml
# docker-compose.yml — للتجهيز المستقبلي فقط
opensearch:
  image: opensearchproject/opensearch:2.11.0
  environment:
    - discovery.type=single-node
    - OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m
  ports:
    - "9200:9200"
```

**لا تُشغّل هذا الآن.** ضعه جاهزاً للمستقبل.

### الطبقة 5 — RAG + Legal Agent (الذكاء القانوني)

```typescript
// src/lib/hakeem-agent/pipeline.ts

interface LegalQuery {
  facts: string;        // وقائع القضية
  question: string;     // السؤال القانوني
  context?: {
    caseType: string;   // تجاري | عمالي | مدني | جزائي
    court: string;      // المحكمة
    stage: string;      // ابتدائي | استئناف | تمييز
  };
}

interface LegalAnswer {
  analysis: string;         // التحليل القانوني
  relevantArticles: Article[];  // المواد ذات الصلة
  supportingRulings: Ruling[];  // الأحكام الداعمة
  suggestedDefenses: string[];  // الدفوع المقترحة
  estimatedOutcome: {           // تقدير النتيجة
    probability: number;
    reasoning: string;
  };
  citations: Citation[];    // الاستناد الرسمي
}

// Pipeline: Query → Retrieval → Analysis → Answer
async function hakeem_analyze(query: LegalQuery): Promise<LegalAnswer> {
  // 1. فهم السؤال وتصنيفه
  const classified = await classify_legal_query(query);

  // 2. استرجاع هجين
  const [vectorResults, graphResults] = await Promise.all([
    vector_search(query.facts + ' ' + query.question, 20),
    graph_traverse(classified.entities, 3) // عمق 3 علاقات
  ]);

  // 3. إعادة ترتيب وفلترة
  const context = rerank_and_merge(vectorResults, graphResults, 10);

  // 4. توليد الإجابة القانونية
  const answer = await claude_legal_generate(query, context);

  // 5. التحقق والإسناد
  return attach_citations(answer, context);
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
الجزء الثالث — ما تعلمناه من قانونية (استخبارات تنافسية)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ملخص قانونية التقني (المنافس الرئيسي)

```
الشركة:    عدالة لتقنية نظم المعلومات — الرياض — تأسست فبراير 2022
Stack:     Nuxt.js 2 (EOL⚠️) + Webpack 4 + Vue.js 2
Cloud:     Google Cloud Platform — مدينة الدمام — شريك CNTXT
Storage:   GCS bucket: qanoniahbucket-public
File IDs:  ULID (26-char) — مُرتَّب زمنياً
DB:        PostgreSQL + Elasticsearch (مستنتج)
Auth:      OTP Passwordless
AI:        RAG كامل — نموذج غير مُعلن
SaaS:      Intercom + HubSpot + Rasayel + Hotjar
Payment:   Apple Pay + Visa + Mada + Tamara (BNPL)
Blog:      Webflow — منفصل
Mobile:    iOS id6648785147 + Android com.adalah.qanoniah
```

## المسارات الداخلية لقانونية (مُكتشفة)
```
/Ai/Chat              ← المنتج الرئيسي
/Search               ← بحث متقدم منفصل
/File/{ULID}-{slug}   ← عرض مستند (أنظمة + نماذج حكومية)
/Folders              ← workspace مجلدات
/HighlightsAndNotes   ← تظليلات وملاحظات
/Subscriptions        ← إدارة الاشتراك
/Settings             ← إعدادات الحساب
/landings/lawyers     ← landing للمحامين
/landings/lawfirms    ← landing للمكاتب
/landings/enterprise  ← landing للشركات
/landings/reports/{ID} ← تقارير تشريعية (9 تقارير، lead gen)
```

## نموذج أعمال قانونية (مُحلَّل)
```
Lead (رقم جوال من التقارير)
→ WhatsApp (Rasayel CRM)
→ HubSpot (متابعة + عرض)
→ عقد اشتراك (Tamara للتقسيط)
→ Intercom (دعم داخل المنصة)
→ Hotjar (تتبع السلوك)
```

## العملاء المُعلنون (57 عميلاً)
```
حكومة (20):    ARAMCO ❌ — PIF ❌ — NEOM — GOSI — SNB — SFDA...
               (❌ = غير متاح لحكيم — ملعب قانونية)
شركات (21):    KPMG — TAWUNIYA — MOBILY — NISSAN...
مكاتب (16):    Pinsent Masons — Gibson Dunn — HSF...
```

## ثغرات قانونية = فرص حكيم

| ثغرة قانونية | فرصة حكيم | الأولوية |
|---|---|---|
| لا محاكاة قضائية | Core feature في حكيم | 🔴 الأولى |
| لا تحليل وقائع | تحليل لائحة الدعوى | 🔴 الأولى |
| لا دفوع مقترحة | Legal Agent يقترح | 🔴 الأولى |
| لا تقدير الحكم | نموذج احتمالية | 🟡 الثانية |
| لا خيار فرد | تسجيل للمحامي المستقل | 🔴 الأولى |
| لا بُعد فقهي | ميزة حصرية لحكيم | 🟡 الثانية |
| Nuxt 2 EOL | حكيم على Next.js 14 ✅ | ميزة تقنية |
| تسعير مخفي | سعر معلن للفرد | 🔴 الأولى |
| لا تقارير قضائية | تقارير أحكام + مبادئ | 🟡 الثانية |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
الجزء الرابع — هيكل الكود المطلوب
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## هيكل المشروع المستهدف

```
hakeem-platform/
│
├── CLAUDE.md                    ← هذا الملف
│
├── src/
│   ├── app/                     ← Next.js 14 App Router
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── register/        ← يشمل خيار الفرد + المنشأة
│   │   ├── (dashboard)/
│   │   │   ├── chat/            ← /chat — واجهة AI الرئيسية ⭐
│   │   │   ├── search/          ← /search — بحث متقدم
│   │   │   ├── file/[id]/       ← /file/{id} — عرض مستند
│   │   │   ├── cases/           ← /cases — ملفات القضايا
│   │   │   ├── folders/         ← /folders — مجلدات
│   │   │   ├── notes/           ← /notes — تظليلات وملاحظات
│   │   │   └── settings/        ← /settings
│   │   └── (landing)/
│   │       ├── page.tsx         ← الرئيسية
│   │       ├── lawyers/         ← للمحامين
│   │       └── pricing/         ← سعر معلن (ميزة vs قانونية)
│   │
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts        ← Prisma schema كامل
│   │   │   └── repository/      ← Data Access Layer
│   │   │       ├── systems.ts
│   │   │       ├── articles.ts
│   │   │       ├── rulings.ts
│   │   │       └── relations.ts
│   │   │
│   │   ├── hakeem-agent/        ← عقل حكيم
│   │   │   ├── pipeline.ts      ← RAG Pipeline الرئيسي
│   │   │   ├── retrieval.ts     ← Vector + Graph retrieval
│   │   │   ├── generation.ts    ← Claude API integration
│   │   │   ├── citations.ts     ← نظام الاستناد
│   │   │   └── simulation.ts    ← محاكاة القضاء ⭐
│   │   │
│   │   ├── search/
│   │   │   ├── vector.ts        ← pgvector queries
│   │   │   ├── graph.ts         ← Knowledge Graph traversal
│   │   │   └── hybrid.ts        ← دمج النتيجتين
│   │   │
│   │   └── legal-db/
│   │       ├── types.ts         ← TypeScript types كاملة
│   │       ├── schema-validator.ts ← Zod validation
│   │       └── citation-formatter.ts ← تنسيق الاستناد الرسمي
│   │
│   └── components/
│       ├── chat/                ← واجهة المحادثة
│       ├── document/            ← عارض المستندات
│       ├── simulation/          ← محاكاة القضاء ⭐
│       └── ui/                  ← shadcn/ui components
│
├── prisma/
│   └── schema.prisma            ← Schema قاعدة البيانات
│
└── docker-compose.yml           ← PostgreSQL + pgvector
```

## Schema قاعدة البيانات الكاملة (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [vector, pgcrypto, uuid_ossp]
}

// ── الأنظمة القانونية ──
model LegalSystem {
  id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  nameAr          String    @map("name_ar")
  nameEn          String?   @map("name_en")
  code            String    @unique
  category        String
  domain          LegalDomain
  issuer          String
  royalDecreeNo   String?   @map("royal_decree_no")
  issueDateH      String?   @map("issue_date_h")
  issueDateG      DateTime? @map("issue_date_g")
  effectiveDateG  DateTime? @map("effective_date_g")
  status          SystemStatus @default(ACTIVE)
  articlesCount   Int       @default(0) @map("articles_count")
  sourceUrl       String?   @map("source_url")
  parentSystemId  String?   @map("parent_system_id") @db.Uuid
  lastVerified    DateTime? @map("last_verified")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  // Relations
  articles        Article[]
  amendments      Amendment[]
  parentSystem    LegalSystem?  @relation("SystemHierarchy", fields: [parentSystemId], references: [id])
  childSystems    LegalSystem[] @relation("SystemHierarchy")
  sourceRelations LegalRelation[] @relation("SourceRelations")
  targetRelations LegalRelation[] @relation("TargetRelations")

  @@map("legal_systems")
}

// ── المواد ──
model Article {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  systemId      String   @map("system_id") @db.Uuid
  articleNumber String   @map("article_number")
  textAr        String   @map("text_ar")
  textEn        String?  @map("text_en")
  isAmended     Boolean  @default(false) @map("is_amended")
  amendmentNote String?  @map("amendment_note")
  embedding     Unsupported("vector(1536)")?
  createdAt     DateTime @default(now()) @map("created_at")

  system        LegalSystem @relation(fields: [systemId], references: [id])
  rulingCitations RulingCitation[]

  @@unique([systemId, articleNumber])
  @@map("articles")
}

// ── الأحكام القضائية ──
model JudicialRuling {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  caseNumber     String   @map("case_number")
  courtType      CourtType @map("court_type")
  circuit        String?
  subject        String
  judgmentTextAr String   @map("judgment_text_ar")
  judgmentDate   DateTime @map("judgment_date")
  legalPrinciple String?  @map("legal_principle")
  embedding      Unsupported("vector(1536)")?
  createdAt      DateTime @default(now()) @map("created_at")

  citations      RulingCitation[]
  sourceRelations LegalRelation[] @relation("RulingSourceRelations")
  targetRelations LegalRelation[] @relation("RulingTargetRelations")

  @@map("judicial_rulings")
}

// ── ربط الأحكام بالمواد ──
model RulingCitation {
  id        String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  rulingId  String @map("ruling_id") @db.Uuid
  articleId String @map("article_id") @db.Uuid

  ruling    JudicialRuling @relation(fields: [rulingId], references: [id])
  article   Article @relation(fields: [articleId], references: [id])

  @@unique([rulingId, articleId])
  @@map("ruling_citations")
}

// ── Knowledge Graph — العلاقات القانونية ──
model LegalRelation {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  sourceType   String   @map("source_type") // article | ruling | principle
  sourceId     String   @map("source_id") @db.Uuid
  targetType   String   @map("target_type")
  targetId     String   @map("target_id") @db.Uuid
  relation     RelationType
  strength     Float    @default(1.0)
  description  String?
  createdAt    DateTime @default(now()) @map("created_at")

  systemSource LegalSystem? @relation("SourceRelations", fields: [sourceId], references: [id], map: "source_system_fk")
  systemTarget LegalSystem? @relation("TargetRelations", fields: [targetId], references: [id], map: "target_system_fk")
  rulingSource JudicialRuling? @relation("RulingSourceRelations", fields: [sourceId], references: [id], map: "source_ruling_fk")
  rulingTarget JudicialRuling? @relation("RulingTargetRelations", fields: [targetId], references: [id], map: "target_ruling_fk")

  @@index([sourceType, sourceId])
  @@index([targetType, targetId])
  @@map("legal_relations")
}

// ── ملفات القضايا ──
model LegalCase {
  id          String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId      String     @map("user_id") @db.Uuid
  title       String
  caseType    String     @map("case_type")
  status      CaseStatus @default(ACTIVE)
  facts       String?    // وقائع القضية
  notes       String?
  createdAt   DateTime   @default(now()) @map("created_at")
  updatedAt   DateTime   @updatedAt @map("updated_at")

  user        User       @relation(fields: [userId], references: [id])
  analyses    CaseAnalysis[]
  annotations Annotation[]

  @@map("legal_cases")
}

// ── تحليلات القضايا (مخرجات حكيم) ──
model CaseAnalysis {
  id               String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  caseId           String   @map("case_id") @db.Uuid
  query            String   // السؤال المُدخَل
  analysis         String   // التحليل
  suggestedDefenses Json    @map("suggested_defenses")
  relevantArticles Json     @map("relevant_articles")
  supportingRulings Json    @map("supporting_rulings")
  estimatedOutcome Json?    @map("estimated_outcome")
  citations        Json
  modelUsed        String   @default("claude-sonnet-4-6") @map("model_used")
  createdAt        DateTime @default(now()) @map("created_at")

  case             LegalCase @relation(fields: [caseId], references: [id])

  @@map("case_analyses")
}

// ── المستخدمون ──
model User {
  id           String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email        String     @unique
  nameAr       String     @map("name_ar")
  entityType   EntityType @map("entity_type")
  teamSize     String?    @map("team_size")
  subscription SubscriptionTier @default(FREE)
  azureAdId    String?    @unique @map("azure_ad_id")
  createdAt    DateTime   @default(now()) @map("created_at")

  cases        LegalCase[]
  annotations  Annotation[]
  folders      Folder[]

  @@map("users")
}

// ── التظليلات والملاحظات ──
model Annotation {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId       String   @map("user_id") @db.Uuid
  caseId       String?  @map("case_id") @db.Uuid
  documentType String   @map("document_type")
  documentId   String   @map("document_id") @db.Uuid
  highlightedText String? @map("highlighted_text")
  note         String?
  color        String   @default("#FEF08A")
  createdAt    DateTime @default(now()) @map("created_at")

  user         User      @relation(fields: [userId], references: [id])
  case         LegalCase? @relation(fields: [caseId], references: [id])

  @@map("annotations")
}

// ── المجلدات ──
model Folder {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  name      String
  parentId  String?  @map("parent_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at")

  user      User     @relation(fields: [userId], references: [id])
  parent    Folder?  @relation("FolderHierarchy", fields: [parentId], references: [id])
  children  Folder[] @relation("FolderHierarchy")

  @@map("folders")
}

// ── Enums ──
enum LegalDomain {
  CIVIL
  COMMERCIAL
  PROCEDURAL
  EVIDENCE
  CRIMINAL
  FAMILY
  LABOR
  ADMINISTRATIVE
  FINANCIAL
  INTELLECTUAL
  ARBITRATION
  REAL_ESTATE
  CORPORATE
  AWQAF
  CYBER
}

enum SystemStatus { ACTIVE AMENDED REPEALED SUSPENDED }
enum CourtType    { COMMERCIAL ADMINISTRATIVE LABOR CRIMINAL PERSONAL_STATUS GENERAL }
enum RelationType { SUPPORTS CONTRADICTS INTERPRETS IMPLEMENTS SUPERSEDES RELATED_TO }
enum CaseStatus   { ACTIVE CLOSED ARCHIVED }
enum EntityType   { INDIVIDUAL LAW_FIRM COMPANY GOVERNMENT EDUCATION NON_PROFIT }
enum SubscriptionTier { FREE PRO TEAM ENTERPRISE }
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
الجزء الخامس — تعليمات Claude Code
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## قواعد العمل

### ① قاعدة المعمارية
- **كل تغيير يبدأ من الـ Schema** — لا تعدّل UI قبل أن تُثبّت DB
- **Repository Pattern إلزامي** — لا تكتب SQL مباشرة في الـ components
- **Type Safety** — كل شيء بـ TypeScript، لا `any`، لا `unknown` بدون guard

### ② قاعدة الـ AI
- **Claude فقط** — لا OpenAI، لا Gemini، لا نماذج أخرى
- **Model:** `claude-sonnet-4-6` للمحادثة، `claude-opus-4-6` للتحليل العميق
- **كل استجابة AI** يجب أن تحمل citations مُرتبطة بـ IDs حقيقية في DB
- **لا hallucination** — إذا لم تجد المادة في DB، قل ذلك صراحةً

### ③ قاعدة اللغة
- **العربية أولاً** في كل الواجهات
- **RTL** في كل CSS
- نصوص المواد والأحكام: **لا تُعدّل** — احفظها كما هي من المصدر

### ④ قاعدة الأمان (PDPL)
- **بيانات المستخدم مُشفَّرة** في قاعدة البيانات
- **لا تُرسل** بيانات شخصية لـ Claude API — أرسل وقائع القضية فقط
- **Audit log** لكل استعلام AI مع user_id وتوقيت

### ⑤ قاعدة التطوير
- **اختبار قبل الإنتاج** — لا تُطلق ميزة بدون unit test
- **Migration files** لكل تغيير في DB — لا تُعدّل Schema مباشرة
- **Changelog** في كل commit يمس قاعدة البيانات القانونية

## أولويات التطوير

### المرحلة الأولى — Quick Wins (شهر 1-2)
```
✅ إعداد PostgreSQL + pgvector + Prisma
✅ Schema كامل كما هو أعلاه
✅ Repository layer لكل الجداول
✅ صفحة تسجيل تشمل خيار الفرد (ميزة vs قانونية)
✅ واجهة المحادثة الأساسية /chat
✅ بحث vector بسيط على الأنظمة الموجودة
✅ تنسيق الاستناد الرسمي في المذكرات
```

### المرحلة الثانية — Core Differentiators (شهر 3-4)
```
⬜ Knowledge Graph — علاقات المواد بالأحكام
⬜ محاكاة القضاء — تقدير الحكم ⭐
⬜ تحليل وقائع القضية ⭐
⬜ الدفوع المقترحة ⭐
⬜ نظام المجلدات والتظليلات
⬜ إشعارات تحديثات الأنظمة
```

### المرحلة الثالثة — Growth (شهر 5-6)
```
⬜ تقارير تحليل قضائي (مقابل تقارير قانونية لقانونية)
⬜ سعر معلن للمحامي الفرد
⬜ ربط WhatsApp Business
⬜ OpenSearch عند الحاجة
⬜ تطبيق جوال (PWA أولاً)
```

## مقاييس النجاح

```typescript
// ما تقيسه في كل sprint
const SUCCESS_METRICS = {
  search_relevance:  "أول 3 نتائج صحيحة >= 85% من الوقت",
  citation_accuracy: "100% من الاستناد مرتبط بـ ID حقيقي في DB",
  response_time:     "استجابة AI <= 8 ثوانٍ",
  hallucination:     "0% ادعاء بوجود مادة غير موجودة في DB",
  user_retention:    "المحامي يعود >= 3 مرات في أول أسبوع",
};
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ملاحظة ختامية
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

قانونية تملك 4 سنوات، 57 عميل مؤسسي، وبنية تحتية ضخمة.
حكيم يملك شيئاً لا تملكه قانونية:

**خلفية قضائية حقيقية + فهم التقاضي من الداخل + التخصص.**

قانونية بنت مكتبة. حكيم يبني قاضياً.
لا تنافسها في الحجم — تفوّق عليها في العمق.
