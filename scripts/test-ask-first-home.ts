/**
 * اسأل حكيم أولاً — بدون رابط قائمة مكرر «مساحة العمل المتقدمة».
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
assert.ok(workspace.includes("كيف يساعدك حكيم اليوم؟"));
assert.ok(workspace.includes("/api/ai/agent-search"));
assert.ok(workspace.includes("extractFile"));
assert.ok(workspace.includes("إضافة مستند") || workspace.includes("إرفاق"));
assert.ok(workspace.includes("اسأل حكيم"));
assert.ok(workspace.includes("اسأل عن نقطة أخرى في السياق نفسه"));
assert.ok(workspace.includes("HOME_ASK_PENDING_RUN_KEY"));
assert.ok(workspace.includes("requestTokenRef"));
assert.ok(workspace.includes("busyRef"));
assert.doesNotMatch(workspace, /location\.assign\([^)]*\/dashboard\/ask/);
assert.doesNotMatch(workspace, /router\.push/);

const panel = read("components/agent/AgentSearchPanel.tsx");
assert.ok(panel.includes("HakeemAskWorkspace as AgentSearchPanel"));

const askPage = read("app/dashboard/ask/page.tsx");
assert.ok(askPage.includes("HakeemAskWorkspace"));
assert.ok(askPage.includes("isAskFirstHomeEnabled"));
assert.ok(askPage.includes('variant={askFirst ? "home" : "page"}'));

const wb = read("components/dashboard/DashboardWorkbench.tsx");
assert.ok(wb.includes("isAskFirstHomeEnabled"));
assert.ok(wb.includes("HakeemAskWorkspace"));
assert.ok(wb.includes('variant="home"'));

const shell = read("components/AppShell.tsx");
assert.ok(shell.includes("askFirstNavItems"));
assert.ok(shell.includes('href: "/dashboard"'));
assert.ok(shell.includes('key: "nav.ask"'));
// لا يظهر رابط مساحة العمل المتقدمة في قائمة ask-first
const askFirstBlock = shell.slice(shell.indexOf("askFirstNavItems"), shell.indexOf("adminNavItem"));
assert.equal(askFirstBlock.includes("/dashboard/ask"), false, "ask-first nav must not duplicate /dashboard/ask");
assert.equal(askFirstBlock.includes("nav.workspace"), false);
assert.ok(askFirstBlock.includes("/dashboard/cases"));

const hero = read("components/home/HomeHero.tsx");
assert.equal(hero.includes("مساحة العمل الكاملة"), false);
assert.ok(hero.includes('href="/dashboard"'));

const crumb = read("components/TopbarBreadcrumb.tsx");
assert.ok(crumb.includes('{ prefix: "/dashboard", label: "اسأل حكيم" }'));

console.log("test-ask-first-home: OK");
