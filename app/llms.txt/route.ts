// /llms.txt — دليل موجز لأنظمة الذكاء الاصطناعي (اتفاقية llms.txt) يشرح ما تقدّمه
// منصّة حكيم وأين توثيق الواجهات وكيفية التكامل. نصّ عام بلا أسرار.
// force-static: تُخبز قيمة NEXT_PUBLIC_SITE_URL وقت البناء (انظر تقرير الهجرة).
export const dynamic = "force-static";

import { getSiteUrl } from "@/lib/modules/config/site-url";

function buildBody(base: string): string {
  return `# حكيم — منصّة المعرفة القضائية السعودية (Hakeem)

> منصّة قانونية سعودية توفّر بحثًا في الأنظمة والمواد والمبادئ القضائية والأحكام،
> مع استناد رسمي إلى المصدر داخل قاعدة بيانات موثّقة (بلا اختلاق أو هلوسة).
> متاحة للتكامل الخارجي عبر API بمفتاح، بنطاق legal:read.

## للمطوّرين وأنظمة الذكاء
- دليل المطوّرين: ${base}/developers
- التوثيق التفاعلي (OpenAPI): ${base}/api-docs
- مواصفة OpenAPI (JSON): ${base}/api/openapi

## واجهات البحث القانوني (تتطلّب مفتاح API: Authorization: Bearer hk_live_...)
- بحث قانوني: GET ${base}/api/legal/search?q={عبارة}&limit={1..50}
- قائمة الأنظمة: GET ${base}/api/legal/systems
- تفاصيل نظام: GET ${base}/api/legal/systems/{id}
- تفاصيل مادة (+ استناد + ELI): GET ${base}/api/legal/articles/{id}
- مواد ذات صلة: GET ${base}/api/legal/articles/{id}/related
- مواءمة فقهية (غير مُلزِمة): GET ${base}/api/legal/articles/{id}/fiqh

## كيفية الحصول على مفتاح
اطلب مفتاح API من مسؤول منصّة حكيم عبر صفحة المطوّرين (${base}/developers).
لكل مفتاح نطاق وحدّ معدّل. الوصول للقراءة فقط.

## ملاحظات حوكمة
- كل استشهاد بمادة أو حكم يأتي حصرًا من النواة القانونية الرسمية.
- المواءمة الفقهية مساندة وغير مُلزِمة، ومُعلّمة صراحةً في الاستجابة.
- المخرجات مرجعية للبحث والتكامل، وليست رأيًا قانونيًا نهائيًا أو حكمًا.
`;
}

export async function GET() {
  const body = buildBody(getSiteUrl());
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
    },
  });
}
