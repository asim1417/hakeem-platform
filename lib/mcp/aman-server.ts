/**
 * أدوات «أمان الامتثال» المشتركة بين خادم حكيم الداخلي ونقطة ChatGPT العامة.
 *
 * هذه الأدوات تقبل تصنيفات عامة فقط؛ لا تقبل سرد وقائع أو ملفات أو هويات.
 */
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zodv4";
import {
  AMAN_CONTACT_CHANNELS,
  AMAN_LEGAL_AREAS,
  AMAN_URGENCY_LEVELS,
  buildAmanServiceCard,
  getAmanConsultationLink,
} from "@/lib/mcp/tools/aman-triage";
import { AMAN_TRIAGE_WIDGET_HTML, AMAN_TRIAGE_WIDGET_URI } from "@/lib/mcp/aman-widget";

export const AMAN_MCP_SERVER_INFO = {
  name: "aman-legal-services",
  version: "1.0.0",
};

/** يسجّل أدوات أمان الآمنة للقراءة فقط في أي خادم MCP. */
export function registerAmanTools(server: McpServer) {
  // واجهة أمان التفاعلية: مستقلة عن أدوات البحث حتى يبقى الخادم مفيداً دون UI.
  server.registerResource("aman-triage-card", AMAN_TRIAGE_WIDGET_URI, {}, async () => ({
    contents: [
      {
        uri: AMAN_TRIAGE_WIDGET_URI,
        mimeType: "text/html;profile=mcp-app",
        text: AMAN_TRIAGE_WIDGET_HTML,
        _meta: {
          ui: {
            prefersBorder: true,
            csp: { connectDomains: [], resourceDomains: [] },
          },
        },
      },
    ],
  }));

  // لا تقبل الأداة أسماء الخصوم أو الهويات أو رقم القضية أو المستندات.
  server.registerTool(
    "aman_triage_case",
    {
      title: "فرز خدمة أمان القانونية",
      description:
        "استخدمها فقط إذا طلب المستخدم صراحةً فرز خدمته لدى أمان الامتثال أو أراد التواصل مع محامٍ سعودي. لا تمرّر إليها سرد الوقائع ولا أسماء الخصوم ولا أرقام الهوية أو القضايا أو الملفات؛ مرّر المجال القانوني ومستوى الاستعجال فقط.",
      inputSchema: z.object({
        legal_area: z.enum(AMAN_LEGAL_AREAS).describe("أقرب مجال قانوني للمسألة"),
        urgency: z
          .enum(AMAN_URGENCY_LEVELS)
          .default("normal")
          .describe("عاجل أو اعتيادي أو تخطيط وقائي"),
        contact_preference: z
          .enum(AMAN_CONTACT_CHANNELS)
          .default("website")
          .describe("قناة التواصل التي يفضّلها المستخدم"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ legal_area, urgency, contact_preference }) =>
      structuredJson(buildAmanServiceCard({ legal_area, urgency, contact_preference }))
  );

  // أداة العرض وحدها تحمل قالب الواجهة؛ يفصل ذلك بين الفرز والـ UI.
  server.registerTool(
    "aman_render_service_card",
    {
      title: "عرض بطاقة خدمة أمان",
      description:
        "اعرض بطاقة أمان التفاعلية بعد aman_triage_case، مستخدماً المجال القانوني والاستعجال فقط. لا تستخدمها للترويج غير المطلوب ولا ترسل أي بيانات شخصية.",
      inputSchema: z.object({
        legal_area: z.enum(AMAN_LEGAL_AREAS),
        urgency: z.enum(AMAN_URGENCY_LEVELS),
        contact_preference: z.enum(AMAN_CONTACT_CHANNELS).default("website"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        ui: { resourceUri: AMAN_TRIAGE_WIDGET_URI },
        "openai/outputTemplate": AMAN_TRIAGE_WIDGET_URI,
      },
    },
    async ({ legal_area, urgency, contact_preference }) =>
      structuredJson(buildAmanServiceCard({ legal_area, urgency, contact_preference }))
  );

  server.registerTool(
    "aman_get_consultation_link",
    {
      title: "فتح قناة تواصل أمان",
      description:
        "استخدمها فقط بعد أن يطلب المستخدم صراحةً التواصل مع أمان. تعيد رابطاً أو رقماً عاماً فقط ولا ترسل رسالة أو تنشئ طلباً أو تجمع بيانات.",
      inputSchema: z.object({
        channel: z.enum(AMAN_CONTACT_CHANNELS).describe("القناة التي طلبها المستخدم صراحةً"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ channel }) => structuredJson(getAmanConsultationLink(channel))
  );
}

/** مخرجات منظمة يفهمها النموذج وواجهة MCP Apps معاً. */
function structuredJson<T extends object>(data: T) {
  return {
    structuredContent: data,
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 1) }],
  };
}
