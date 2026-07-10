// /llms.txt — دليل موجز لأنظمة الذكاء الاصطناعي (اتفاقية llms.txt) يشرح ما تقدّمه
// منصّة حكيم وأين توثيق الواجهات وكيفية التكامل. نصّ عام بلا أسرار.
export const dynamic = "force-static";

const BASE = "https://hakeem-platform.vercel.app";

const BODY = `# حكيم — منصّة المعرفة القضائية السعودية (Hakeem)

> منصّة قانونية سعودية توفّر بحثًا في الأنظمة والمواد والمبادئ القضائية والأحكام،
> مع استناد رسمي إلى المصدر داخل قاعدة بيانات موثّقة (بلا اختلاق أو هلوسة).
> متاحة للتكامل الخارجي عبر API بمفتاح، بنطاق legal:read.

## للمطوّرين وأنظمة الذكاء
- دليل المطوّرين: ${BASE}/developers
- التوثيق التفاعلي (OpenAPI): ${BASE}/api-docs
- مواصفة OpenAPI (JSON): ${BASE}/api/openapi

## واجهات البحث القانوني (تتطلّب مفتاح API: Authorization: Bearer hk_live_...)
- بحث قانوني: GET ${BASE}/api/legal/search?q={عبارة}&limit={1..50}
- قائمة الأنظمة: GET ${BASE}/api/legal/systems
- تفاصيل نظام: GET ${BASE}/api/legal/systems/{id}
- تفاصيل مادة (+ استناد + ELI): GET ${BASE}/api/legal/articles/{id}
- مواد ذات صلة: GET ${BASE}/api/legal/articles/{id}/related
- مواءمة فقهية (غير مُلزِمة): GET ${BASE}/api/legal/articles/{id}/fiqh

## كيفية الحصول على مفتاح
اطلب مفتاح API من مسؤول منصّة حكيم عبر صفحة المطوّرين (${BASE}/developers).
لكل مفتاح نطاق وحدّ معدّل. الوصول للقراءة فقط.

## ملاحظات حوكمة
- كل استشهاد بمادة أو حكم يأتي حصرًا من النواة القانونية الرسمية.
- المواءمة الفقهية مساندة وغير مُلزِمة، ومُعلّمة صراحةً في الاستجابة.
- المخرجات مرجعية للبحث والتكامل، وليست رأيًا قانونيًا نهائيًا أو حكمًا.
`;

export async function GET() {
  return new Response(BODY, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
    },
  });
}
