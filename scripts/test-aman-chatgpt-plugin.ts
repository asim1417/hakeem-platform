import assert from "node:assert/strict";
import { AMAN_TRIAGE_WIDGET_HTML } from "@/lib/mcp/aman-widget";
import { buildAmanServiceCard, getAmanConsultationLink } from "@/lib/mcp/tools/aman-triage";

process.env.AMAN_CONSULTATION_URL = "https://amanlaws.com/اطلب-استشارة/";
process.env.AMAN_WHATSAPP_URL = "https://wa.me/966500000000";
process.env.AMAN_PHONE = "+966 11 555 0000";
process.env.AMAN_PRIVACY_URL = "https://amanlaws.com/privacy/";
process.env.AMAN_TERMS_URL = "https://amanlaws.com/terms/";

const commercial = buildAmanServiceCard({
  legal_area: "commercial",
  urgency: "urgent",
  contact_preference: "whatsapp",
});

assert.equal(commercial.legal_area_label, "التجاري");
assert.equal(commercial.urgency_label, "عاجل");
assert.equal(commercial.contact_options[0]?.channel, "whatsapp");
assert.match(commercial.contact_options[0]?.href ?? "", /^https:\/\/wa\.me\//);
assert.equal(commercial.policy_links.length, 2);
assert.match(commercial.privacy_notice, /لا تُرسل/);

const phone = getAmanConsultationLink("phone");
assert.equal(phone.href, "tel:+966115550000");

// يمنع المكوّن من تمرير روابط بوابة الاستشارة إلى نطاقات ليست تابعة لأمان.
process.env.AMAN_CONSULTATION_URL = "https://untrusted.example/request";
const safeFallback = getAmanConsultationLink("website");
assert.match(safeFallback.href, /^https:\/\/amanlaws\.com\//);

assert.match(AMAN_TRIAGE_WIDGET_HTML, /ui\/initialize/);
assert.match(AMAN_TRIAGE_WIDGET_HTML, /ui\/notifications\/tool-result/);
assert.match(AMAN_TRIAGE_WIDGET_HTML, /privacy_notice/);

console.log("Aman ChatGPT plugin checks passed.");
