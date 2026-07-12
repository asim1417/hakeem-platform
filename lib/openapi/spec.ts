/**
 * spec.ts — وصف OpenAPI 3.1 لواجهات حكيم البرمجية الأساسية (التشغيل البيني / DGA).
 *
 * يغطّي الواجهات المعرفية القانونية الأكثر ثباتًا وفائدةً. مكتوب يدويًا
 * ومطابق للمسارات الفعلية. قابل للتوسعة بإضافة مسارات إلى paths.
 * يُقدَّم خامًا على /api/openapi ويُعرض على /api-docs.
 */

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "واجهات منصة حكيم — API",
    version: "1.0.0",
    description:
      "واجهات المعرفة القضائية في منصة حكيم: البحث الموحّد، الاقتراحات، مكتبة تراث، المبادئ القضائية، والمعرّف التشريعي (ELI). تتطلّب معظم الواجهات جلسة مصادقة وصلاحية مناسبة.",
    "x-notice": "توثيق لمجموعة أساسية مختارة من الواجهات؛ ليست كل واجهات المنصّة.",
  },
  servers: [{ url: "/", description: "الخادم الحالي" }],
  tags: [
    { name: "البحث", description: "البحث الموحّد والاقتراحات" },
    { name: "النواة القانونية", description: "المواد والمبادئ والمعرّفات" },
    { name: "تراث", description: "مكتبة التراث الإسلامي مفتوحة المصدر" },
    { name: "المصادقة", description: "تسجيل الدخول والخروج" },
    { name: "البوابة الخارجية", description: "واجهات /api/legal/* للتكامل الخارجي بمفتاح API (نطاق legal:read)" },
  ],
  paths: {
    "/api/legal/search": {
      get: {
        tags: ["البوابة الخارجية"],
        summary: "بحث قانوني (بوابة خارجية)",
        description: "بحث هجين في النواة القانونية. متاح بمفتاح API خارجي (Bearer/x-api-key، نطاق legal:read) أو جلسة داخلية.",
        security: [{ apiKeyAuth: [] }, { apiKeyHeader: [] }, { sessionCookie: [] }],
        parameters: [
          { name: "q", in: "query", required: true, schema: { type: "string", minLength: 2 } },
          { name: "limit", in: "query", required: false, schema: { type: "integer", default: 20, maximum: 50 } },
        ],
        responses: {
          "200": { description: "نتائج البحث" },
          "400": { description: "عبارة قصيرة" },
          "401": { description: "مفتاح مفقود/غير صالح" },
          "403": { description: "المفتاح لا يملك النطاق" },
          "429": { description: "تجاوز حدّ المعدّل" },
        },
      },
    },
    "/api/legal/systems": {
      get: {
        tags: ["البوابة الخارجية"],
        summary: "قائمة الأنظمة (بوابة خارجية)",
        security: [{ apiKeyAuth: [] }, { apiKeyHeader: [] }, { sessionCookie: [] }],
        parameters: [
          { name: "q", in: "query", required: false, schema: { type: "string" } },
          { name: "classification", in: "query", required: false, schema: { type: "string" } },
          { name: "page", in: "query", required: false, schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", required: false, schema: { type: "integer", default: 24 } },
        ],
        responses: { "200": { description: "أنظمة مع ترقيم" }, "401": { description: "غير مصادق" }, "429": { description: "تجاوز الحدّ" } },
      },
    },
    "/api/legal/systems/{id}": {
      get: {
        tags: ["البوابة الخارجية"],
        summary: "تفاصيل نظام (بوابة خارجية)",
        security: [{ apiKeyAuth: [] }, { apiKeyHeader: [] }, { sessionCookie: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "معرّف النظام أو اسمه" }],
        responses: { "200": { description: "النظام ومواده بالفصول" }, "404": { description: "غير موجود" } },
      },
    },
    "/api/legal/articles": {
      get: {
        tags: ["البوابة الخارجية"],
        summary: "سحب جماعي + تغذية تغييرات للمواد (مزامنة خارجية)",
        description: "للمزامنة التزايدية: مرّر قيمة syncCursor العائدة كـ updatedSince في الطلب التالي.",
        security: [{ apiKeyAuth: [] }, { apiKeyHeader: [] }, { sessionCookie: [] }],
        parameters: [
          { name: "updatedSince", in: "query", required: false, schema: { type: "string", format: "date-time" }, description: "أعِد فقط ما تغيّر بعد هذا الوقت (ISO 8601)" },
          { name: "systemId", in: "query", required: false, schema: { type: "string" } },
          { name: "page", in: "query", required: false, schema: { type: "integer", default: 1 } },
          { name: "pageSize", in: "query", required: false, schema: { type: "integer", default: 50, maximum: 100 } },
        ],
        responses: { "200": { description: "مواد + total + hasMore + syncCursor" }, "401": { description: "غير مصادق" }, "429": { description: "تجاوز الحدّ" } },
      },
    },
    "/api/legal/articles/{id}": {
      get: {
        tags: ["البوابة الخارجية"],
        summary: "مادة مع الاستناد والمعرّف التشريعي (بوابة خارجية)",
        security: [{ apiKeyAuth: [] }, { apiKeyHeader: [] }, { sessionCookie: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "المادة + citation + eli" }, "404": { description: "غير موجودة" } },
      },
    },
    "/api/legal/articles/{id}/related": {
      get: {
        tags: ["البوابة الخارجية"],
        summary: "مواد ذات صلة وإحالات داخلية (بوابة خارجية)",
        security: [{ apiKeyAuth: [] }, { apiKeyHeader: [] }, { sessionCookie: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "related + crossReferences" }, "404": { description: "غير موجودة" } },
      },
    },
    "/api/legal/articles/{id}/fiqh": {
      get: {
        tags: ["البوابة الخارجية"],
        summary: "المواءمة الفقهية المساندة (غير ملزمة) (بوابة خارجية)",
        security: [{ apiKeyAuth: [] }, { apiKeyHeader: [] }, { sessionCookie: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "fiqh مع تنبيه عدم الإلزام" }, "404": { description: "غير موجودة" } },
      },
    },
    "/api/legal-search": {
      get: {
        tags: ["البحث"],
        summary: "بحث هجين موحّد",
        description: "بحث نصّي + دلالي + رسم معرفي عبر المواد والأحكام والمبادئ.",
        parameters: [
          { name: "q", in: "query", required: true, schema: { type: "string", minLength: 2 }, description: "عبارة البحث" },
          { name: "limit", in: "query", required: false, schema: { type: "integer", default: 10, maximum: 30 } },
        ],
        responses: {
          "200": { description: "نتائج مجمّعة حسب النوع", content: { "application/json": { schema: { $ref: "#/components/schemas/SearchResponse" } } } },
          "400": { description: "عبارة بحث قصيرة" },
          "401": { description: "غير مصادق" },
          "403": { description: "لا صلاحية" },
        },
      },
    },
    "/api/legal-search/suggest": {
      get: {
        tags: ["البحث"],
        summary: "اقتراحات إكمال تلقائي",
        parameters: [{ name: "q", in: "query", required: true, schema: { type: "string", minLength: 2 } }],
        responses: {
          "200": {
            description: "قائمة اقتراحات",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    suggestions: { type: "array", items: { $ref: "#/components/schemas/Suggestion" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/turath/search": {
      get: {
        tags: ["تراث"],
        summary: "بحث في مكتبة تراث",
        description: "بحث حيّ في المصادر الفقهية مفتوحة المصدر مع الإسناد والترقيم.",
        parameters: [
          { name: "q", in: "query", required: true, schema: { type: "string", minLength: 2 } },
          { name: "limit", in: "query", required: false, schema: { type: "integer", default: 20, maximum: 50 } },
          { name: "page", in: "query", required: false, schema: { type: "integer", default: 1 } },
        ],
        responses: { "200": { description: "نتائج تراث مع البيانات الوصفية والإجمالي" }, "401": { description: "غير مصادق" } },
      },
    },
    "/api/legal-core/principles/{id}": {
      patch: {
        tags: ["النواة القانونية"],
        summary: "مراجعة مبدأ قضائي",
        description: "اعتماد/رفض/إعادة مبدأ مستخرَج. تتطلّب صلاحية LEGAL_CORE_EDIT.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["decision"], properties: { decision: { type: "string", enum: ["approve", "reject", "reset"] } } },
            },
          },
        },
        responses: {
          "200": { description: "تم التحديث" },
          "403": { description: "لا صلاحية تعديل" },
          "404": { description: "المبدأ غير موجود" },
        },
      },
    },
    "/eli/sa/{system}/art/{number}": {
      get: {
        tags: ["النواة القانونية"],
        summary: "محلّل المعرّف التشريعي (ELI)",
        description: "معرّف ثابت بنمط ELI يحوّل إلى صفحة المادة المطابقة.",
        parameters: [
          { name: "system", in: "path", required: true, schema: { type: "string" }, description: "slug اسم النظام (مطبّع)" },
          { name: "number", in: "path", required: true, schema: { type: "integer" }, description: "رقم المادة" },
        ],
        responses: { "307": { description: "تحويل إلى صفحة المادة" }, "404": { description: "لا مادة مطابقة" } },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["المصادقة"],
        summary: "تسجيل الدخول",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string" } } },
            },
          },
        },
        responses: { "200": { description: "جلسة مفعّلة (كوكي)" }, "401": { description: "بيانات غير صحيحة" } },
      },
    },
    "/api/auth/logout": {
      post: { tags: ["المصادقة"], summary: "تسجيل الخروج", responses: { "200": { description: "أُنهيت الجلسة" } } },
    },
  },
  components: {
    schemas: {
      Suggestion: {
        type: "object",
        properties: {
          value: { type: "string" },
          kind: { type: "string", enum: ["system", "popular"] },
          hint: { type: "string" },
        },
      },
      SearchResult: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["article", "ruling", "principle"] },
          id: { type: "string" },
          title: { type: "string" },
          snippet: { type: "string" },
          confidence: { type: "number" },
          sources: { type: "array", items: { type: "string" } },
        },
      },
      SearchResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          query: { type: "string" },
          counts: { type: "object", additionalProperties: { type: "integer" } },
          articles: { type: "array", items: { $ref: "#/components/schemas/SearchResult" } },
          rulings: { type: "array", items: { $ref: "#/components/schemas/SearchResult" } },
          principles: { type: "array", items: { $ref: "#/components/schemas/SearchResult" } },
        },
      },
    },
    securitySchemes: {
      sessionCookie: { type: "apiKey", in: "cookie", name: "hakeem_session", description: "جلسة موقّعة (HMAC) عبر تسجيل الدخول" },
      apiKeyAuth: { type: "http", scheme: "bearer", description: "مفتاح بوابة API الخارجية: Authorization: Bearer hk_live_… (نطاق legal:read، خاضع لحدّ معدّل)" },
      apiKeyHeader: { type: "apiKey", in: "header", name: "x-api-key", description: "بديل: تمرير المفتاح في ترويسة x-api-key" },
    },
  },
  security: [{ sessionCookie: [] }],
} as const;

export type OpenApiSpec = typeof openApiSpec;
