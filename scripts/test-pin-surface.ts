/**
 * HKM-062 (مراجعة الجودة الرابعة على #984، N1) — اختبار وحدة: تثبيت مطابقة المادة التامة يفشل مغلقًا.
 *
 * عميل Prisma مزيّف عبر globalThis.prisma (lib/prisma.ts يعيد استعماله خارج الإنتاج)، فلا قاعدة ولا شبكة:
 * لائحة مستبدلة (حالة عملها «مستبدل» في verification) ولائحة سارية، وأعطال مُحقنة في قراءة الوجه وسجل الإلغاء وصف المادة.
 * articleInSurfaceStrict يعيد false في كل عطل وللمادة المستبدلة؛ وfilterArticleIdsToSurface (البحث العام) يبقى مفتوحًا.
 * التشغيل: npm run test:pin-surface
 */
import assert from "node:assert/strict";

const OLD_SYS = "SYS_OLD_DOMESTIC";
const NEW_SYS = "SYS_NEW_DOMESTIC";
const OLD_ART = "ART_OLD_7";
const NEW_ART = "ART_NEW_7";
type Row = { id: string; legalSystemId: string; lawName: string; articleNumber: number };
const articles: Record<string, Row> = {
  [OLD_ART]: { id: OLD_ART, legalSystemId: OLD_SYS, lawName: "لائحة عمال الخدمة المنزلية ومن في حكمهم", articleNumber: 7 },
  [NEW_ART]: { id: NEW_ART, legalSystemId: NEW_SYS, lawName: "لائحة العمالة المنزلية", articleNumber: 7 },
};
type Mode = { surface: "ok" | "error" | "missing"; verification: "ok" | "error"; findUnique: "ok" | "error"; replaced: boolean };
let mode: Mode = { surface: "ok", verification: "ok", findUnique: "ok", replaced: true };
const fake = {
  legalArticle: {
    findUnique: async ({ where }: { where: { id: string } }) => {
      if (mode.findUnique === "error") throw new Error("Connection terminated unexpectedly");
      return articles[where.id] ?? null;
    },
    findMany: async ({ where }: { where?: { id?: { in?: string[] } } }) => (where?.id?.in ?? []).map((id) => articles[id]).filter(Boolean),
  },
  $queryRawUnsafe: async (sql: string) => {
    if (/search_surface/.test(sql)) {
      if (mode.surface === "error") throw new Error("Connection terminated unexpectedly (timeout)");
      if (mode.surface === "missing") throw new Error('relation "search_surface" does not exist (42P01)');
      return [];
    }
    if (/FROM verification/.test(sql)) {
      if (mode.verification === "error") throw new Error("canceling statement due to statement timeout");
      return mode.replaced ? [{ object_id: OLD_SYS, verified_status: "مستبدل" }] : [];
    }
    return [];
  },
  $disconnect: async () => undefined,
};
(globalThis as unknown as { prisma: unknown }).prisma = fake;

let failures = 0;
async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    failures++;
    console.error(`✗ ${name}\n   ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main() {
  const ss = await import("../lib/modules/legal-core/search-surface");
  const hs = await import("../lib/modules/legal-search/hybrid-search");
  const fusion = await import("../lib/mcp/search-fusion");
  const run = async (m: Mode) => {
    mode = m;
    ss.__resetSurfaceCache();
    const oldOk = await hs.articleInSurfaceStrict(OLD_ART);
    ss.__resetSurfaceCache();
    const newOk = await hs.articleInSurfaceStrict(NEW_ART);
    ss.__resetSurfaceCache();
    const general = await hs.filterArticleIdsToSurface([OLD_ART, NEW_ART]);
    return { oldOk, newOk, general };
  };
  const base: Mode = { surface: "ok", verification: "ok", findUnique: "ok", replaced: true };

  for (const [label, m] of [
    ["عطل قراءة جدولي الوجه", { ...base, surface: "error" }],
    ["عطل قراءة سجل الإلغاء", { ...base, verification: "error" }],
    ["عطل الاثنين", { ...base, surface: "error", verification: "error" }],
    ["عطل قراءة صف المادة", { ...base, findUnique: "error" }],
  ] as Array<[string, Mode]>) {
    await check(`يفشل مغلقًا: ${label} ← لا تثبيت للمادتين`, async () => {
      const r = await run(m);
      assert.equal(r.oldOk, false);
      assert.equal(r.newOk, false);
      assert.equal(fusion.pinnableExact({ id: OLD_ART }, r.oldOk), null);
    });
  }
  await check("سليم: مادة اللائحة المستبدلة لا تُثبَّت، ومادة السارية تُثبَّت", async () => {
    const r = await run(base);
    assert.equal(r.oldOk, false);
    assert.equal(r.newOk, true);
    assert.deepEqual(fusion.pinnableExact({ id: NEW_ART }, r.newOk), { id: NEW_ART });
  });
  await check("جدول الوجه غائب (42P01، حالة دائمة) والسجل سليم: المستبدلة مخفية بسجل الإلغاء", async () => {
    const r = await run({ ...base, surface: "missing" });
    assert.equal(r.oldOk, false);
    assert.equal(r.newOk, true);
  });
  await check("سليم بلا إلغاء: المادتان في الوجه", async () => {
    const r = await run({ ...base, replaced: false });
    assert.equal(r.oldOk, true);
    assert.equal(r.newOk, true);
  });
  await check("البحث العام كما كان: يفشل مفتوحًا عند العطل، ويخفي المستبدلة حين يقرأ السجل", async () => {
    const outage = await run({ ...base, surface: "error", verification: "error" });
    assert.deepEqual([...outage.general].sort(), [NEW_ART, OLD_ART].sort());
    const healthy = await run(base);
    assert.deepEqual([...healthy.general], [NEW_ART]);
  });
  await check("لا يُذكَّر وجه من قراءة فاشلة: عطل ثم سلامة ← قراءة جديدة", async () => {
    mode = { ...base, surface: "error", verification: "error" };
    ss.__resetSurfaceCache();
    assert.equal(await hs.articleInSurfaceStrict(NEW_ART), false);
    mode = base;
    assert.equal(await hs.articleInSurfaceStrict(NEW_ART), true);
    assert.equal(await hs.articleInSurfaceStrict(OLD_ART), false);
  });

  if (failures) {
    console.error(`\n${failures} اختبار فشل`);
    process.exit(1);
  }
  console.log("\nكل اختبارات تثبيت المطابقة داخل الوجه ناجحة");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
