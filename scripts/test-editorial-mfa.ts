/**
 * اختبار سلوكي لـ accountMfaStatus (مراجعة الجودة خ٦-ج على 4f67df4): السؤال الطازج، والمخزن، وتمييز الخطأ،
 * وترتيب مفاتيح Clerk. بلا شبكة ولا قاعدة: Prisma وfetch بديلان محليان، والمفاتيح وهمية لا تُطبع.
 * التشغيل: npx tsx scripts/test-editorial-mfa.ts (ويستدعيه test-editorial-desk.ts).
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const Module = require("node:module") as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
const path = require("node:path") as typeof import("node:path");

const fixtures = path.join(__dirname, "editorial", "fixtures");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (this: unknown, request: string, ...rest: unknown[]) {
  if (request === "server-only") return path.join(fixtures, "stub-server-only.js");
  if (request === "@/lib/prisma") return path.join(fixtures, "stub-prisma.js");
  return origResolve.call(this, request, ...rest);
};

let passed = 0;
let failed = 0;
function ok(cond: unknown, msg: string) {
  if (cond) {
    passed++;
    console.log(`✓ ${msg}`);
  } else {
    failed++;
    console.log(`✗ ${msg}`);
  }
}

// مفاتيح وهمية: نسختا live وواحدة test؛ المفتاح العام live.
const KEY_LIVE_A = ["sk", "live", "TESTONLYAAAA"].join("_");
const KEY_LIVE_B = ["sk", "live", "TESTONLYBBBB"].join("_");
const KEY_TEST = ["sk", "test", "TESTONLYCCCC"].join("_");
const PK_LIVE = ["pk", "live", "TESTONLYPK"].join("_");
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = PK_LIVE;
process.env.CLERK_SECRET_KEY = KEY_LIVE_A;

// ── Prisma بديل ──
let dbDown = false;
const users: Record<string, { clerkId: string | null }> = { "u-nolink": { clerkId: null }, "u-linked": { clerkId: "user_abc" } };
let userLookups = 0;
(globalThis as unknown as { __editorialTestPrisma: unknown }).__editorialTestPrisma = {
  user: {
    findUnique: async ({ where }: { where: { id: string } }) => {
      userLookups++;
      if (dbDown) throw new Error("db down (test)");
      return users[where.id] ?? null;
    },
  },
  appSetting: { findMany: async () => [] },
};

// ── fetch بديل (Clerk) ──
type Mode = "2fa" | "no2fa" | "throw" | "401";
let modeByKey: Record<string, Mode> = {};
let defaultMode: Mode = "2fa";
const calls: string[] = [];
const keyLabel = (k: string) => (k === KEY_LIVE_A ? "A" : k === KEY_LIVE_B ? "B" : k === KEY_TEST ? "C" : "?");
globalThis.fetch = (async (input: unknown, init?: { headers?: unknown }) => {
  const req = input instanceof Request ? input : null;
  const url = String(req?.url ?? input);
  const hdrs = new Headers((req?.headers ?? init?.headers ?? {}) as HeadersInit);
  const key = (hdrs.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!url.startsWith("https://api.clerk.com/")) throw new Error("unexpected host (test)");
  calls.push(keyLabel(key));
  const mode = modeByKey[key] ?? defaultMode;
  if (mode === "throw") throw new Error("network blocked (test)");
  if (mode === "401") {
    return new Response(JSON.stringify({ errors: [{ code: "authentication_invalid", message: "x" }] }), { status: 401, headers: { "content-type": "application/json" } });
  }
  const body = {
    object: "user",
    id: "user_abc",
    two_factor_enabled: mode === "2fa",
    totp_enabled: mode === "2fa",
    backup_code_enabled: false,
    email_addresses: [],
    phone_numbers: [],
    web3_wallets: [],
    external_accounts: [],
    saml_accounts: [],
    passkeys: [],
    enterprise_accounts: [],
    public_metadata: {},
    private_metadata: {},
    unsafe_metadata: {},
    created_at: 0,
    updated_at: 0,
  };
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}) as typeof fetch;

async function main() {
  const { accountMfaStatus, orderClerkSecretKeys } = require("../lib/modules/editorial/mfa") as typeof import("../lib/modules/editorial/mfa");
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

  // ترتيب المفاتيح: ما يطابق المفتاح العام أولًا، بلا تكرار ولا فراغ.
  ok(same(orderClerkSecretKeys([KEY_TEST, KEY_LIVE_A], PK_LIVE), [KEY_LIVE_A, KEY_TEST]), "MFA-1 المفتاح المطابق للمفتاح العام يُجرَّب أولًا");
  ok(same(orderClerkSecretKeys([KEY_LIVE_A, " ", undefined, KEY_LIVE_A], PK_LIVE), [KEY_LIVE_A]), "MFA-1 بلا تكرار ولا فراغ");

  // غير المرتبط: لا سؤال لـ Clerk.
  calls.length = 0;
  ok(same(await accountMfaStatus("u-nolink", { fresh: true }), { enabled: false, linked: false }) && calls.length === 0, "MFA-2 حساب بلا ربط Clerk = غير متحقق بلا سؤال");

  // المرتبط المفعّل: سؤال واحد، ثم المخزن للعرض، والطازج يسأل.
  calls.length = 0;
  defaultMode = "2fa";
  ok(same(await accountMfaStatus("u-linked"), { enabled: true, linked: true }) && calls.length === 1, "MFA-3 مفعّل: سؤال واحد");
  await accountMfaStatus("u-linked");
  ok(calls.length === 1, "MFA-3 العرض يقبل المخزن خلال 30 ثانية");
  defaultMode = "no2fa";
  const fresh = await accountMfaStatus("u-linked", { fresh: true });
  ok(calls.length === 2 && fresh.enabled === false, "MFA-4 الطازج يسأل ويرى إلغاء التحقق فورًا (أفعال الكتابة)");
  ok((await accountMfaStatus("u-linked")).enabled === false && calls.length === 2, "MFA-4 الطازج يحدّث المخزن");

  // الخطأ: لا يُخزَّن، ويُميَّز، ويُجرَّب المفتاح التالي.
  calls.length = 0;
  defaultMode = "throw";
  const err = await accountMfaStatus("u-linked", { fresh: true });
  ok(same(err, { enabled: false, linked: true, error: true }), "MFA-5 تعذّر Clerk = غير متحقق مع error");
  defaultMode = "2fa";
  ok((await accountMfaStatus("u-linked")).enabled === true && calls.length === 2, "MFA-5 الخطأ لا يُخزَّن (السؤال التالي يذهب إلى Clerk)");

  // القاعدة متعذرة: error، بلا سؤال لـ Clerk.
  calls.length = 0;
  dbDown = true;
  ok(same(await accountMfaStatus("u-linked", { fresh: true }), { enabled: false, linked: false, error: true }) && calls.length === 0, "MFA-6 تعذّر القاعدة = error لا «غير مرتبط»");
  dbDown = false;

  // مفتاحان: الأول 401 فيُجرَّب الثاني.
  calls.length = 0;
  process.env.CLERK_SECRET_KEY = KEY_TEST; // المُدار من نسخة أخرى
  modeByKey = { [KEY_TEST]: "401" };
  const r = await accountMfaStatus("u-linked", { fresh: true });
  ok(r.error === true && same(calls, ["C"]), "MFA-7 مفتاح واحد مرفوض = error");
  modeByKey = {};
  process.env.CLERK_SECRET_KEY = KEY_LIVE_A;

  ok(userLookups > 0, "MFA-8 المسار الحقيقي استُعمل (بديل Prisma)");
  console.log(`\n${passed} نجح، ${failed} فشل`);
  process.exitCode = failed ? 1 : 0;
}

void main();

// وحدة لا سكربت عام، كي لا تتصادم أسماؤها مع سكربتات scripts/ الأخرى في فحص الأنواع.
export {};
