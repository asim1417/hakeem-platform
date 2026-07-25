/**
 * المرحلة 3A — ربط اسأل بمحرك الجلسات دون تغيير منطق الذكاء.
 * npx tsx scripts/test-ask-sessions-3a.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

const ws = read("components/ask/HakeemAskWorkspace.tsx");
const api = read("components/ask/ask-session-api.ts");
const side = read("components/ask/AskSessionSidebar.tsx");
const layout = read("components/ask/AskSessionsLayout.tsx");
const agent = read("app/api/ai/agent-search/route.ts");
const modes = read("lib/modules/agents/modes.ts");

assert.ok(ws.includes("persistAskTurn"), "يحفظ الدور بعد الاكتمال");
assert.ok(ws.includes("getAskSession"), "يستعيد الجلسة");
assert.ok(ws.includes("/api/ai/agent-search"), "ما زال يستدعي agent-search");
assert.ok(ws.includes("router.replace"), "يحدّث الرابط الدائم");
assert.ok(api.includes('service: "ask"'), "عميل الجلسات مثبت على ask");
assert.ok(side.includes("جلسة جديدة"), "شريط أساسي");
assert.ok(side.includes("/dashboard/ask/c/"), "روابط دائمة في القائمة");
assert.ok(!side.includes("تثبيت") && !side.includes("أرشفة") && !side.includes("تفريع"), "بلا إدارة متقدمة في 3A");
assert.ok(layout.includes("AskSessionSidebar"), "تخطيط الجلسات");
assert.ok(!agent.includes("persistAskTurn") && !agent.includes("conversations/engine"), "agent-search غير معدّل بمنطق الجلسات");
assert.ok(modes.includes('id: "consultation"') && modes.includes("systemPrompt"), "الأوضاع/الموجهات لم تُمس");

const page = read("app/dashboard/ask/c/[conversationId]/page.tsx");
assert.ok(page.includes("/dashboard/ask/c/") || page.includes("conversationId"));

// لا ربط معاون في 3A
assert.ok(!api.includes("judicial-assistant"));
assert.ok(!side.includes("judicial-assistant"));

console.log("test-ask-sessions-3a: OK");
