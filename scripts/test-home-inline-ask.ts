/**
 * اسأل حكيم داخل الرئيسية — بدون تحويل إلى /dashboard/ask.
 * npx tsx scripts/test-home-inline-ask.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { isHomeInlineAskEnabled, HAKEEM_ASK_MAX_CHARS } from "../lib/modules/config/home-inline-ask";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

assert.equal(HAKEEM_ASK_MAX_CHARS, 8000);
assert.equal(isHomeInlineAskEnabled(), true);
process.env.NEXT_PUBLIC_HOME_INLINE_ASK = "0";
assert.equal(isHomeInlineAskEnabled(), false);
delete process.env.NEXT_PUBLIC_HOME_INLINE_ASK;
assert.equal(isHomeInlineAskEnabled(), true);

const surface = read("components/home/HomeAskSurface.tsx");
assert.ok(surface.includes("isHomeInlineAskEnabled"));
assert.ok(surface.includes("HomeInlineAsk"));
assert.ok(surface.includes("CenterSearch"));

const inline = read("components/home/HomeInlineAsk.tsx");
assert.ok(inline.includes("useHakeemAsk"));
assert.ok(inline.includes("preventDefault"));
assert.ok(inline.includes("Enter للإرسال"));
assert.doesNotMatch(inline, /router\.push/);
assert.doesNotMatch(inline, /location\.href\s*=\s*[`'"]\/dashboard\/ask/);
assert.ok(
  inline.includes("فتح في مساحة العمل") ||
    inline.includes("فتح مساحة العمل الكاملة") ||
    inline.includes("محادثة جديدة")
);
assert.ok(
  inline.includes("اسأل سؤالًا متابعًا") ||
    inline.includes("إرسال متابعة") ||
    inline.includes("إرسال")
);
assert.ok(inline.includes("محادثة جديدة") || inline.includes("ابدأ سؤالًا جديدًا"));

const hook = read("components/hooks/useHakeemAsk.ts");
assert.ok(hook.includes("runAgentSearch"));
assert.ok(hook.includes("requestTokenRef"));
assert.ok(hook.includes("busyRef"));
assert.ok(hook.includes("اكتب سؤالك أو وقائعك أولًا"));
assert.doesNotMatch(hook, /useEffect\(\s*\(\)\s*=>\s*\{\s*void ask/);

const client = read("lib/modules/ask/run-agent-search.ts");
assert.ok(client.includes("/api/ai/agent-search"));
assert.ok(client.includes("onEvent"));

const wb = read("components/dashboard/DashboardWorkbench.tsx");
assert.ok(wb.includes("HomeAskSurface"));
assert.ok(wb.includes("isHomeInlineAskEnabled"));
assert.ok(wb.includes("فتح قضية"));
assert.ok(wb.includes("مساحة العمل الكاملة") || wb.includes("wb-cta__hint"));

const center = read("components/CenterSearch.tsx");
assert.ok(center.includes("/dashboard/ask"));
assert.ok(center.includes("HOME_INLINE_ASK") || center.includes("احتياطي"));

const panel = read("components/agent/AgentSearchPanel.tsx");
assert.ok(panel.includes("hakeem-home-ask-handoff"));

const api = read("app/api/ai/agent-search/route.ts");
assert.ok(api.includes("gateAdvancedUse"));
assert.ok(api.includes("orchestrate"));

console.log("test-home-inline-ask: OK");
