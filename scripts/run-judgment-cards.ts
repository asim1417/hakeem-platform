/**
 * run-judgment-cards.ts — التشغيل الليلي: استخراج بطاقات ١٠٠٠ حكم تجاري + تدقيق + اتساق + فهرس.
 *
 * الجدول المعتمد للأحكام = judicial_cases (لا يُمَسّ). الكتابة في جداول المخرجات فقط:
 *   judgment_cards · judgment_article_links · extraction_runs.
 *
 * الوضعان:
 *   بلا --apply           ⇒ تشخيص جافّ: عدّ التجاري المتاح + خطة الاختيار (بلا نموذج، بلا كتابة).
 *   --apply (+ البوّابة)  ⇒ تشغيل فعليّ. الكتابة مقفولة خلف CONFIRM_RUNTIME_DB_ALIGNMENT + حارس Neon.
 *
 * الاختيار حتميّ (seed ثابت) ⇒ نفس الـ١٠٠٠ ونفس عيّنة المعايرة (١٠٠) في كل تشغيل ⇒ استئناف نظيف.
 * الاستئناف: يتخطّى أيّ حكم له بطاقة سابقة. دفعات ٥٠ مع checkpoint بعد كل دفعة. مهلة + إعادتان ثم failed.
 *
 * الأعلام:  --apply  --limit N (افتراضي 1000)  --calibration K (افتراضي 100)  --batch B (افتراضي 50)
 */
import { prisma } from "@/lib/prisma";
import { callCentralProvider } from "@/lib/modules/ai/ai-gateway";
import { resolveAiConfig, getAiStatus } from "@/lib/modules/ai/ai-config";
import { buildExtractPrompt, buildVerifyPrompt, parseVerify } from "@/lib/modules/judgment-cards/prompts";
import { parseCard, normalizeAr, toWesternDigits, EXTRACTOR_VERSION, type JudgmentCard } from "@/lib/modules/judgment-cards/card-schema";
import { checkConsistency, decideReviewStatus } from "@/lib/modules/judgment-cards/consistency";

const APPLY = process.argv.includes("--apply");
const arg = (flag: string, def: number) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? Number(process.argv[i + 1]) : def;
};
const TARGET = arg("--limit", 1000);
const CALIBRATION = arg("--calibration", 100);
const BATCH = arg("--batch", 50);
const MIN_TEXT = 200; // نصّ أقصر من هذا = مبتور ⇒ failed/تخطّي (لا استخراج من ناقص)

function safeHost(raw?: string): string {
  try { return raw ? new URL(raw).hostname : "غير مضبوط"; } catch { return "unparseable"; }
}

function assertGate() {
  if (process.env.CONFIRM_RUNTIME_DB_ALIGNMENT !== "NEON_RUNTIME_CONFIRMED") {
    console.error("✗ الكتابة مقفولة. اضبط CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED مع --apply.");
    process.exit(1);
  }
}

// ── PRNG حتميّ (mulberry32) لاختيار قابل لإعادة الإنتاج ──
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const SEED = 20260717;

type Candidate = { id: string; court: string | null; courtOfAppeal: string | null; decisionDate: Date | null; decisionDateText: string | null; caseDateText: string | null };

function yearOf(c: Candidate): string {
  if (c.decisionDate) return String(c.decisionDate.getFullYear());
  // تواريخ الأحكام السعودية غالبًا هجرية بأرقام عربية-هندية (١٤٤٠) — نحوّلها قبل الالتقاط.
  const m = toWesternDigits(`${c.decisionDateText || ""} ${c.caseDateText || ""}`).match(/1[34]\d{2}|20\d{2}|19\d{2}/);
  return m ? m[0] : "غير معروف";
}
function courtGroup(c: Candidate): string {
  return normalizeAr(c.court || c.courtOfAppeal || "غير معروف").slice(0, 40) || "غير معروف";
}

/** اختيار متنوّع حتميّ: تجميع بـ(سنة|دائرة) ثم round-robin عبر السلال (كلٌّ مبعثرة بالبذرة). */
function diverseSelect(cands: Candidate[], target: number): Candidate[] {
  const rng = mulberry32(SEED);
  const buckets = new Map<string, Candidate[]>();
  for (const c of cands) {
    const key = `${yearOf(c)}|${courtGroup(c)}`;
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(c);
  }
  const keys = [...buckets.keys()].sort();
  for (const k of keys) buckets.set(k, seededShuffle(buckets.get(k)!, rng));
  const picked: Candidate[] = [];
  let progress = true;
  while (picked.length < target && progress) {
    progress = false;
    for (const k of keys) {
      const b = buckets.get(k)!;
      if (b.length) { picked.push(b.shift()!); progress = true; if (picked.length >= target) break; }
    }
  }
  return picked;
}

// ── نموذج مع مهلة + إعادة ──
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}
async function llm(system: string, user: string, maxTokens: number, tries = 3): Promise<string | null> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await withTimeout(callCentralProvider({ systemPrompt: system, userPrompt: user, maxTokens }), 60000);
      if (r.ok && r.content) return r.content;
    } catch { /* مهلة/شبكة — أعد المحاولة */ }
    await sleep(600 * (i + 1));
  }
  return null;
}

// ── مطابقة المادة بالنظام/السجلّ ──
type SysRow = { id: string; name: string; norm: string };
type ArtKey = Map<string, string>; // `${normLaw}|${num}` → articleId

async function loadSystems(): Promise<SysRow[]> {
  const rows = await prisma.legalSystem.findMany({ select: { id: true, name: true } });
  return rows.map((r) => ({ id: r.id, name: r.name, norm: normalizeAr(r.name) }));
}
async function loadArticleIndex(): Promise<ArtKey> {
  const rows = await prisma.legalArticle.findMany({ select: { id: true, lawName: true, articleNumber: true } });
  const m: ArtKey = new Map();
  for (const r of rows) m.set(`${normalizeAr(r.lawName)}|${r.articleNumber}`, r.id);
  return m;
}
function matchSystem(systems: SysRow[], sysNameRaw: string | null): SysRow | null {
  if (!sysNameRaw) return null;
  const n = normalizeAr(sysNameRaw).replace(/^نظام\s+/, "");
  return systems.find((s) => s.norm.includes(n) || n.includes(s.norm.replace(/^نظام\s+/, ""))) ?? null;
}

async function main() {
  console.log("═".repeat(96));
  console.log(`تشغيل بطاقات الأحكام — الوضع: ${APPLY ? "تطبيق فعليّ" : "تشخيص جافّ"} · المضيف: ${safeHost(process.env.DATABASE_URL)}`);
  console.log("═".repeat(96));

  // ① الأحكام التجارية المتاحة (نصّ غير فارغ + المحكمة تجارية)
  const whereCommercial = { judgmentText: { not: "" }, court: { contains: "تجاري" } };
  const available = await prisma.judicialCase.count({ where: whereCommercial });
  console.log(`أحكام تجارية متاحة (court~تجاري، نصّ غير فارغ): ${available}`);
  if (available === 0) {
    console.log("لا أحكام تجارية — تأكّد من قيمة court في judicial_cases. توقّف.");
    await prisma.$disconnect();
    return;
  }

  // ② مرشّحون + اختيار متنوّع حتميّ
  const cands = (await prisma.judicialCase.findMany({
    where: whereCommercial,
    select: { id: true, court: true, courtOfAppeal: true, decisionDate: true, decisionDateText: true, caseDateText: true },
  })) as Candidate[];
  const selected = diverseSelect(cands, Math.min(TARGET, cands.length));
  if (selected.length < TARGET) console.log(`⚠ المتاح ${selected.length} < الهدف ${TARGET} — سنعالج المتاح كاملاً (لا سقف صامت).`);

  // عيّنة المعايرة: K حتميّة من المختار
  const calibIds = new Set(seededShuffle(selected.map((s) => s.id), mulberry32(SEED ^ 0x9e3779b9)).slice(0, Math.min(CALIBRATION, selected.length)));

  // توزيع الاختيار (شفافية التنوّع)
  const byYear = new Map<string, number>();
  for (const c of selected) byYear.set(yearOf(c), (byYear.get(yearOf(c)) ?? 0) + 1);
  console.log(`مختار: ${selected.length} · معايرة محجوزة: ${calibIds.size}`);
  console.log(`توزيع سنوات المختار: ${[...byYear.entries()].sort().map(([y, n]) => `${y}:${n}`).join(" · ")}`);

  // ③ استئناف: تخطّي ما له بطاقة
  const existing = new Set(
    (await prisma.judgmentCard.findMany({ where: { judgmentId: { in: selected.map((s) => s.id) } }, select: { judgmentId: true } })).map((r) => r.judgmentId)
  );
  const todo = selected.filter((s) => !existing.has(s.id));
  console.log(`بطاقات موجودة (استئناف): ${existing.size} · متبقٍّ: ${todo.length}`);

  if (!APPLY) {
    console.log("\n(تشخيص جافّ — لا نموذج ولا كتابة. للتشغيل: --apply مع البوّابة والمفتاح.)");
    // معاينة نصّ أول مرشّح للتأكّد من توفّر النصّ الكامل
    const sample = await prisma.judicialCase.findUnique({ where: { id: selected[0].id }, select: { judgmentText: true, court: true } });
    console.log(`عيّنة نصّ (طول): ${sample?.judgmentText?.length ?? 0} حرف · المحكمة: ${sample?.court ?? "∅"}`);
    // فحص مسبق لمزوّد الذكاء (دون كشف المفتاح) — يحدّد هل يمكن تشغيل run فعليًّا
    const ai = await getAiStatus().catch(() => null);
    console.log(`فحص الذكاء المسبق: مزوّد=${ai?.provider ?? "?"} · مصدر=${ai?.source ?? "?"} · مضبوط=${ai?.configured ? "نعم ✅" : "لا ❌ (run سيتوقّف بأمان)"}`);
    await prisma.$disconnect();
    return;
  }

  // ── تطبيق فعليّ ──
  assertGate();
  const cfg = await resolveAiConfig();
  if (cfg.provider === "offline" || !cfg.apiKey) {
    console.error("✗ مزوّد الذكاء غير مضبوط (offline). اضبط AI_PROVIDER + مفتاحه (أو إعداد app_settings) قبل التشغيل الفعليّ.");
    process.exit(1);
  }
  console.log(`مزوّد الذكاء: ${cfg.provider} · النموذج: ${cfg.model ?? "(افتراضي)"} · المصدر: ${cfg.source}`);

  const systems = await loadSystems();
  const artIndex = await loadArticleIndex();
  console.log(`فهرس: أنظمة=${systems.length} · مواد=${artIndex.size}`);

  const run = await prisma.extractionRun.create({ data: { notes: `hosts=${safeHost(process.env.DATABASE_URL)} target=${selected.length} provider=${cfg.provider}` } });
  let processed = 0, failed = 0;
  const confidences: number[] = [];
  const failReasons: Record<string, number> = {};
  const noteFail = (why: string) => { failReasons[why] = (failReasons[why] ?? 0) + 1; };

  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    for (const cand of batch) {
      const jc = await prisma.judicialCase.findUnique({ where: { id: cand.id }, select: { judgmentText: true, caseNo: true, decisionNo: true } });
      const text = jc?.judgmentText ?? "";
      const ref = jc?.decisionNo || jc?.caseNo || cand.id;
      if (text.length < MIN_TEXT) { failed++; noteFail("نصّ مبتور/ناقص"); continue; }

      // استخراج
      const exSys = buildExtractPrompt(text, ref);
      const exRaw = await llm(exSys.system, exSys.user, 1600);
      if (!exRaw) { failed++; noteFail("تعذّر الاستخراج (نموذج)"); continue; }
      const parsed = parseCard(exRaw);
      if (!parsed.ok) { failed++; noteFail("JSON بطاقة غير صالح"); continue; }
      const card: JudgmentCard = parsed.card;

      // تدقيق مستقلّ
      const vp = buildVerifyPrompt(text, JSON.stringify(card));
      const vRaw = await llm(vp.system, vp.user, 700);
      const verify = vRaw ? parseVerify(vRaw) : { agreed: false, disagreements: [{ field: "_verify", reason: "لا ردّ" }] };

      // اتساق آليّ
      const cons = checkConsistency(card, text);
      const reasons = [...cons.reasons, ...(verify.agreed ? [] : verify.disagreements.map((d) => `مدقّق: ${d.field} — ${d.reason}`))];
      const status = decideReviewStatus({ verifierAgreed: verify.agreed, confidence: card.confidence, consistencyReasons: cons.reasons });

      // روابط المواد (خام) — نظام مُطبَّع + سجلّ إن أمكن + verified من الاتساق
      const links = card.appliedArticles.map((a, idx) => {
        const sys = matchSystem(systems, a.system);
        const digits = (a.article || "").match(/\d+/)?.[0] || (a.article ? "" : "");
        const articleId = sys && digits ? artIndex.get(`${sys.norm}|${Number(digits)}`) ?? null : null;
        return {
          judgmentId: cand.id,
          legalSystemId: sys?.id ?? null,
          articleNumber: (a.article ?? "").slice(0, 60) || "غير محدد",
          articleId,
          context: (a.quote ?? "").slice(0, 2000),
          verified: cons.articleChecks[idx]?.verified ?? false,
        };
      });

      // كتابة ذرّية للحكم الواحد
      await prisma.$transaction([
        prisma.judgmentCard.upsert({
          where: { judgmentId: cand.id },
          create: { judgmentId: cand.id, card: card as object, confidence: card.confidence, extractorVersion: EXTRACTOR_VERSION, verifierAgreed: verify.agreed, reviewStatus: status, calibration: calibIds.has(cand.id), runId: run.id },
          update: { card: card as object, confidence: card.confidence, verifierAgreed: verify.agreed, reviewStatus: status, runId: run.id },
        }),
        prisma.judgmentArticleLink.deleteMany({ where: { judgmentId: cand.id } }),
        ...(links.length ? [prisma.judgmentArticleLink.createMany({ data: links })] : []),
      ]);
      processed++;
      confidences.push(card.confidence);
      if (reasons.length && status === "needs_review") { /* أسباب محفوظة ضمنيًّا في العدّ */ }
    }

    // checkpoint بعد كل دفعة
    const avg = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null;
    await prisma.extractionRun.update({ where: { id: run.id }, data: { processed, failed, avgConfidence: avg } });
    console.log(`  … دفعة ${Math.floor(i / BATCH) + 1}: معالَج=${processed} فاشل=${failed} متوسط الثقة=${avg?.toFixed(3) ?? "—"}`);
  }

  const avg = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null;
  await prisma.extractionRun.update({
    where: { id: run.id },
    data: { processed, failed, avgConfidence: avg, finishedAt: new Date(), notes: `${JSON.stringify(failReasons)} | target=${selected.length} done=${existing.size + processed}` },
  });

  console.log("\n" + "─".repeat(96));
  console.log(`اكتملت التشغيلة ${run.id}: معالَج=${processed} · فاشل=${failed} · متوسط الثقة=${avg?.toFixed(3) ?? "—"}`);
  console.log(`أسباب الفشل: ${JSON.stringify(failReasons)}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("✗ فشل run-judgment-cards:", e instanceof Error ? e.stack || e.message : e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
