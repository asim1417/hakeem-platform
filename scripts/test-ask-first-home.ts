/**
 * اسأل حكيم أولاً — جوهر الصفحة الرئيسية.
 * npx tsx scripts/test-ask-first-home.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  ASK_FIRST_SUGGESTIONS,
  ASK_TO_CASE_HANDOFF_KEY,
  HOME_ASK_PENDING_RUN_KEY,
  HOME_ASK_SESSION_KEY,
  isAskFirstHomeEnabled,
} from "../lib/modules/config/ask-first-home";
import { suggestAskNextActions } from "../lib/modules/ask/next-actions";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

assert.equal(isAskFirstHomeEnabled(), true);
process.env.NEXT_PUBLIC_ASK_FIRST_HOME = "0";
assert.equal(isAskFirstHomeEnabled(), false);
delete process.env.NEXT_PUBLIC_ASK_FIRST_HOME;
assert.equal(isAskFirstHomeEnabled(), true);

assert.ok(ASK_FIRST_SUGGESTIONS.length >= 4 && ASK_FIRST_SUGGESTIONS.length <= 6);
assert.equal(HOME_ASK_PENDING_RUN_KEY, "hakeem-home-ask-pending-run");
assert.equal(HOME_ASK_SESSION_KEY, "hakeem-home-ask-session");
assert.equal(ASK_TO_CASE_HANDOFF_KEY, "hakeem-ask-to-case");

const actions = suggestAskNextActions("ابحث عن مادة نظامية", "إليك المواد");
assert.ok(actions.some((a) => a.kind === "library" || a.id === "library"));
assert.ok(actions.some((a) => a.kind === "case"));
assert.ok(actions.length <= 4);

const wb = read("components/dashboard/DashboardWorkbench.tsx");
assert.ok(wb.includes("isAskFirstHomeEnabled"));
assert.ok(wb.includes("ابدأ بسؤالك القانوني"));
assert.ok(wb.includes("أدوات أعمق عندما تحتاجها"));
assert.ok(wb.includes("HomeAskSurface"));
assert.ok(wb.includes("/dashboard/ask"));
assert.ok(wb.includes("ماذا تعمل الآن") || wb.includes("ابدأ من الواقعة"));

const inline = read("components/home/HomeInlineAsk.tsx");
assert.ok(inline.includes("اسأل حكيم"));
assert.ok(inline.includes("اكتب الواقعة أو السؤال القانوني بتفاصيله"));
assert.ok(inline.includes("ASK_FIRST_SUGGESTIONS"));
assert.ok(inline.includes("تحويل إلى قضية"));
assert.ok(inline.includes("حفظ المحادثة"));
assert.ok(inline.includes("محادثة جديدة"));
assert.ok(inline.includes("useHakeemAsk"));
assert.doesNotMatch(inline, /router\.push/);
assert.doesNotMatch(inline, /fetch\(\s*[`'"]\/api\/ai\/agent-search/);

const hook = read("components/hooks/useHakeemAsk.ts");
assert.ok(hook.includes("HOME_ASK_PENDING_RUN_KEY"));
assert.ok(hook.includes("HOME_ASK_SESSION_KEY"));
assert.ok(hook.includes("runAgentSearch"));
assert.ok(hook.includes("busyRef"));

const guest = read("components/home/GuestAskComposer.tsx");
assert.ok(guest.includes("HOME_ASK_PENDING_RUN_KEY"));
assert.ok(guest.includes("signInWithNext"));
assert.ok(guest.includes("/dashboard"));
assert.doesNotMatch(guest, /encodeURIComponent\(q\)/);

const hero = read("components/home/HomeHero.tsx");
assert.ok(hero.includes("GuestAskComposer"));
assert.ok(hero.includes("isAskFirstHomeEnabled"));
assert.ok(hero.includes("ابدأ بسؤالك القانوني"));

const caseForm = read("components/judicial-assistant/CreateCaseForm.tsx");
assert.ok(caseForm.includes("ASK_TO_CASE_HANDOFF_KEY"));

const shell = read("components/AppShell.tsx");
assert.ok(shell.includes('key: "nav.ask"'));
assert.ok(shell.includes('href: "/dashboard"'));
assert.ok(shell.includes('href: "/dashboard/ask"'));

const askPage = read("app/dashboard/ask/page.tsx");
assert.ok(askPage.includes("AgentSearchPanel"));

const surface = read("components/home/HomeAskSurface.tsx");
assert.ok(surface.includes("isAskFirstHomeEnabled"));
assert.ok(surface.includes("isHomeInlineAskEnabled"));

console.log("test-ask-first-home: OK");
