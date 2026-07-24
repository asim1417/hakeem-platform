/**
 * اسأل حكيم أولاً — مساحة كاملة في /dashboard بدون تحويل إلى /dashboard/ask.
 * npx tsx scripts/test-ask-first-home.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  ASK_FIRST_SUGGESTIONS,
  ASK_TO_CASE_HANDOFF_KEY,
  HOME_ASK_PENDING_RUN_KEY,
  isAskFirstHomeEnabled,
} from "../lib/modules/config/ask-first-home";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

assert.equal(isAskFirstHomeEnabled(), true);
process.env.NEXT_PUBLIC_ASK_FIRST_HOME = "0";
assert.equal(isAskFirstHomeEnabled(), false);
delete process.env.NEXT_PUBLIC_ASK_FIRST_HOME;
assert.equal(isAskFirstHomeEnabled(), true);

assert.ok(ASK_FIRST_SUGGESTIONS.length >= 4 && ASK_FIRST_SUGGESTIONS.length <= 6);
assert.equal(HOME_ASK_PENDING_RUN_KEY, "hakeem-home-ask-pending-run");
assert.equal(ASK_TO_CASE_HANDOFF_KEY, "hakeem-ask-to-case");

const workspace = read("components/ask/HakeemAskWorkspace.tsx");
assert.ok(workspace.includes("export function HakeemAskWorkspace"));
assert.ok(workspace.includes('variant?: "home" | "page"'));
assert.ok(workspace.includes("/api/ai/agent-search"));
assert.ok(workspace.includes("extractFile"));
assert.ok(workspace.includes("إضافة مستند"));
assert.ok(workspace.includes("اسأل حكيم"));
assert.ok(workspace.includes("اسأل عن نقطة أخرى في السياق نفسه"));
assert.ok(workspace.includes("HOME_ASK_PENDING_RUN_KEY"));
assert.ok(workspace.includes("requestTokenRef"));
assert.ok(workspace.includes("busyRef"));
assert.ok(workspace.includes("تحويل إلى قضية"));
assert.ok(workspace.includes("محادثة جديدة"));
assert.doesNotMatch(workspace, /location\.assign\([^)]*\/dashboard\/ask/);
assert.doesNotMatch(workspace, /router\.push/);
assert.doesNotMatch(workspace, /router\.replace/);

const panel = read("components/agent/AgentSearchPanel.tsx");
assert.ok(panel.includes("HakeemAskWorkspace as AgentSearchPanel"));

const askPage = read("app/dashboard/ask/page.tsx");
assert.ok(askPage.includes("HakeemAskWorkspace"));
assert.ok(askPage.includes('variant="page"'));

const wb = read("components/dashboard/DashboardWorkbench.tsx");
assert.ok(wb.includes("isAskFirstHomeEnabled"));
assert.ok(wb.includes("HakeemAskWorkspace"));
assert.ok(wb.includes('variant="home"'));
assert.ok(wb.includes("أدوات أعمق عندما تحتاجها"));
// لا يفرض التحويل أثناء الاستخدام الطبيعي عند ask-first
assert.ok(!wb.includes("مساحة العمل الكاملة") || wb.includes("HomeAskSurface"));

const guest = read("components/home/GuestAskComposer.tsx");
assert.ok(guest.includes("HOME_ASK_PENDING_RUN_KEY"));
assert.ok(guest.includes("signInWithNext"));
assert.doesNotMatch(guest, /encodeURIComponent\(q\)/);

const hero = read("components/home/HomeHero.tsx");
assert.ok(hero.includes("GuestAskComposer"));
assert.ok(hero.includes("isAskFirstHomeEnabled"));

const caseForm = read("components/judicial-assistant/CreateCaseForm.tsx");
assert.ok(caseForm.includes("ASK_TO_CASE_HANDOFF_KEY"));

const shell = read("components/AppShell.tsx");
assert.ok(shell.includes("askFirstNavItems") || shell.includes('key: "nav.ask"'));
assert.ok(shell.includes('href: "/dashboard"'));
assert.ok(shell.includes('href: "/dashboard/ask"'));

console.log("test-ask-first-home: OK");
