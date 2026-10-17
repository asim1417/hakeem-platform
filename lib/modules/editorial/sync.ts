import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { normalizeArabicText } from "../legal-core/arabic-morphology";
import { redactPII } from "../legal-core/rulings-search";
import {
  getOpenSearchConfig,
  openSearchHeaders,
} from "../legal-search/providers/search-provider";
import { targetSchema, allowed, assertWriteEnabled } from "./contracts";
import { transaction } from "./repository";

export async function sendIndexDocuments(
  docs: Array<{ index: string; id: string; body: object }>,
  request: typeof fetch = fetch,
) {
  if (!docs.length) return;
  const config = getOpenSearchConfig();
  if (!config) throw new Error("OpenSearch غير مهيأ؛ لم تكتمل خطوة الفهرسة.");
  const body =
    docs
      .flatMap((d) => [
        JSON.stringify({ index: { _index: d.index, _id: d.id } }),
        JSON.stringify(d.body),
      ])
      .join("\n") + "\n";
  const result = await request(`${config.url}/_bulk?refresh=wait_for`, {
    method: "POST",
    headers: {
      ...openSearchHeaders(config),
      "Content-Type": "application/x-ndjson",
    },
    body,
    signal: AbortSignal.timeout(20000),
  });
  if (!result.ok) throw new Error(`OpenSearch HTTP ${result.status}`);
  const data: unknown = await result.json();
  if (
    !data ||
    typeof data !== "object" ||
    !("errors" in data) ||
    data.errors !== false
  )
    throw new Error("OpenSearch رفض عنصرًا أو أعاد استجابة غير مكتملة.");
}
/** One durable leased job. Caller/scheduler must invoke at least every 5 minutes after activation. */
export async function runSync(
  userId: string,
  dependencies: { request?: typeof fetch; revalidate?: () => void } = {},
) {
  assertWriteEnabled();
  const token = randomUUID();
  const job = await transaction(userId, async (tx, actor, c) => {
    const candidates = await tx.editorialIndexSync.findMany({
      where: {
        completedAt: null,
        nextAttemptAt: { lte: new Date() },
        OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }],
      },
      include: { changeSet: { include: { changes: true } } },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
    const next = candidates.find((j) =>
      j.changeSet.changes.every((ch) =>
        allowed(actor, c.data, "LEGAL_PUBLISHER", {
          target: targetSchema.parse(ch.targetType),
          domain: ch.domain,
        }),
      ),
    );
    if (!next) return null;
    return tx.editorialIndexSync.update({
      where: { id: next.id },
      data: {
        lockToken: token,
        lockedUntil: new Date(Date.now() + 180000),
        attempts: { increment: 1 },
      },
    });
  });
  if (!job)
    return { processed: false, message: "لا توجد مهمة جاهزة ضمن صلاحياتك." };
  try {
    const errors: string[] = [];
    const articles =
      job.targetType === "work" || job.targetType === "unit"
        ? await prisma.legalArticle.findMany({
            where:
              job.targetType === "work"
                ? { legalSystemId: job.targetId }
                : { id: job.targetId },
          })
        : [];
    const bodies = new Map<string, string>();
    const versions = articles.length
      ? await prisma.unitVersion.findMany({
          where: {
            unitId: { in: articles.map((a) => a.id) },
            validFrom: { lte: new Date() },
          },
          orderBy: [
            { validFrom: "desc" },
            { createdAt: "desc" },
            { id: "desc" },
          ],
        })
      : [];
    for (const version of versions)
      if (!bodies.has(version.unitId)) bodies.set(version.unitId, version.body);
    for (const article of articles)
      if (!bodies.has(article.id)) bodies.set(article.id, article.content);
    const workIds = [
      ...new Set(
        articles.map((a) => a.legalSystemId).filter((id): id is string => !!id),
      ),
    ];
    const workVersions = await prisma.editorialWorkVersion.findMany({
      where: { workId: { in: workIds } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const aliases = new Map<string, string>();
    for (const version of workVersions)
      if (
        !aliases.has(version.workId) &&
        version.data &&
        typeof version.data === "object" &&
        !Array.isArray(version.data)
      )
        aliases.set(
          version.workId,
          [
            version.data.officialName,
            ...(Array.isArray(version.data.aliases)
              ? version.data.aliases
              : []),
          ].join(" "),
        );
    const checkpoint = async (data: object) =>
      prisma.editorialIndexSync.updateMany({
        where: { id: job.id, lockToken: token },
        data,
      });
    if (!job.searchNormAt)
      try {
        const normalized = articles.map((a) => ({
          id: a.id,
          value: normalizeArabicText(
            [
              a.lawName,
              aliases.get(a.legalSystemId ?? ""),
              a.title,
              bodies.get(a.id),
              a.keywords.join(" "),
              a.classification ?? "",
              a.chapter ?? "",
            ].join("\n"),
          ),
        }));
        if (normalized.length)
          await prisma.$executeRaw`UPDATE legal_articles a SET search_norm=u.value FROM jsonb_to_recordset(${JSON.stringify(normalized)}::jsonb) AS u(id text,value text) WHERE a.id=u.id`;
        await checkpoint({ searchNormAt: new Date() });
      } catch {
        errors.push("تعذر تحديث النص المطبع للبحث.");
      }
    if (!job.opensearchAt)
      try {
        const cfg = getOpenSearchConfig();
        const docs: Array<{ index: string; id: string; body: object }> =
          articles.map((a) => ({
            index: cfg?.indexArticles ?? "legal_articles",
            id: `article:${a.id}`,
            body: {
              id:a.id,
              type: "article",
              articleId: a.id,
              title:a.title,lawName:a.lawName,articleNumber:a.articleNumber,classification:a.classification,status:a.status,
              content: bodies.get(a.id),
            },
          }));
        if (job.targetType === "ruling") {
          const r = await prisma.judicialCase.findUniqueOrThrow({
            where: { id: job.targetId },
          });
          docs.push({
            index: cfg?.indexCases ?? "judicial_cases",
            id: `ruling:${r.id}`,
            body: { id:r.id,type: "ruling",judgmentTitle:redactPII(r.judgmentTitle??r.decisionNo??r.caseNo??""),judgmentText:redactPII(r.judgmentText).slice(0,20000),court:r.court,status:r.reviewStatus },
          });
        }
        if (job.targetType === "principle") {
          const r = await prisma.judicialPrinciple.findUniqueOrThrow({
            where: { id: job.targetId },
          });
          await sendIndexDocuments(
            [
              {
                index: cfg?.indexCases ?? "judicial_cases",
                id: `principle:${r.id}`,
                body: { id:r.id,type: "principle",title:redactPII(r.title),principleText:redactPII(r.principleText),status:r.reviewStatus },
              },
            ],
            dependencies.request,
          );
        }
        await sendIndexDocuments(docs, dependencies.request);
        await checkpoint({ opensearchAt: new Date() });
      } catch (e) {
        errors.push(e instanceof Error ? e.message : "تعذرت فهرسة البحث.");
      }
    if (!job.revalidatedAt)
      try {
        if (dependencies.revalidate) dependencies.revalidate();
        else {
          revalidatePath("/legal", "layout");
          revalidatePath("/rulings", "layout");
        }
        const { invalidateSearchSurface } =
          await import("../legal-core/search-surface");
        invalidateSearchSurface();
        await checkpoint({ revalidatedAt: new Date() });
      } catch {
        errors.push("تعذر تحديث ذاكرة الصفحات.");
      }
    const fresh = await prisma.editorialIndexSync.findUniqueOrThrow({
      where: { id: job.id },
    });
    const complete =
      !!fresh.searchNormAt && !!fresh.opensearchAt && !!fresh.revalidatedAt;
    await checkpoint({
      completedAt: complete ? new Date() : null,
      lastError: errors.length ? errors.join("؛ ").slice(0, 1500) : null,
      lockedUntil: null,
      lockToken: null,
      nextAttemptAt: new Date(
        Date.now() + Math.min(300000, 1000 * 2 ** Math.min(job.attempts, 8)),
      ),
    });
    return {
      processed: true,
      complete,
      message: complete ? "اكتملت مزامنة العنصر." : errors.join("؛ "),
    };
  } catch {
    const message =
      "تعذر تحميل بيانات المزامنة أو حفظ تقدمها؛ ستُعاد المحاولة.";
    await prisma.editorialIndexSync.updateMany({
      where: { id: job.id, lockToken: token },
      data: {
        lastError: message,
        lockedUntil: null,
        lockToken: null,
        nextAttemptAt: new Date(Date.now() + 60000),
      },
    });
    return { processed: true, complete: false, message };
  }
}
