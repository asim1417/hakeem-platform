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
  ],
  paths: {
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
    },
  },
  security: [{ sessionCookie: [] }],
} as const;

export type OpenApiSpec = typeof openApiSpec;
