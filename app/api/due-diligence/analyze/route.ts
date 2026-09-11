import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { runDueDiligence } from "@/lib/modules/due-diligence/core";
import { buildDemoConnectors } from "@/lib/modules/due-diligence/demo";
import {
  buildDueDiligenceSnapshotMeta,
  compareDueDiligenceSnapshots,
  parseDueDiligenceSnapshotMeta,
  type DueDiligenceChangeSummary,
} from "@/lib/modules/due-diligence/changes";
import {
  getLatestDueDiligenceSnapshot,
  persistDueDiligenceSnapshot,
} from "@/lib/modules/due-diligence/history";
import {
  buildPhase3Connectors,
  phase3SourceCatalog,
} from "@/lib/modules/due-diligence/phase3";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const entitySchema = z
  .object({
    name: z.string().trim().min(2).max(240),
    unifiedNumber: z.string().trim().min(4).max(32).optional(),
    commercialRegistration: z.string().trim().min(4).max(32).optional(),
    city: z.string().trim().min(2).max(120).optional(),
    mode: z.enum(["LIVE", "DEMO"]).default("LIVE"),
  })
  .strict();

/** GET — source readiness without endpoint URLs or secrets. */
export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });

  const configured = new Set(buildPhase3Connectors().map((connector) => connector.source.key));
  return NextResponse.json({
    demoAvailable: true,
    changeDetection: true,
    sources: phase3SourceCatalog().map((source) => ({
      key: source.key,
      nameAr: source.nameAr,
      authority: source.authority,
      accessType: source.accessType,
      configured: configured.has(source.key),
    })),
  });
}

/**
 * POST — LIVE runs approved server-configured and Hakim-native public sources only.
 * DEMO runs clearly labelled synthetic fixtures. The request can never supply a source URL.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });

  let payload: z.infer<typeof entitySchema>;
  try {
    payload = entitySchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        message: "بيانات الكيان غير صالحة.",
        details: error instanceof z.ZodError ? error.flatten() : undefined,
      },
      { status: 400 }
    );
  }

  const { mode, ...entity } = payload;
  const connectors = mode === "DEMO" ? buildDemoConnectors(entity) : buildPhase3Connectors();

  if (!connectors.length) {
    return NextResponse.json(
      {
        message: "محرك العناية الواجبة جاهز، لكن لم يتم تهيئة أي مصدر حي بعد. يمكنك تجربة وضع العرض التجريبي.",
        setupRequired: true,
        demoAvailable: true,
        sources: phase3SourceCatalog().map(({ key, nameAr, authority, accessType }) => ({
          key,
          nameAr,
          authority,
          accessType,
        })),
      },
      { status: 503 }
    );
  }

  const report = await runDueDiligence(entity, connectors);
  let snapshotId: string | undefined;
  let persistenceWarning: string | undefined;
  let changes: DueDiligenceChangeSummary | undefined;

  if (mode === "LIVE") {
    try {
      const previous = await getLatestDueDiligenceSnapshot(user.id, report);
      const previousMeta = parseDueDiligenceSnapshotMeta(previous?.metadata ?? null);
      const currentMeta = buildDueDiligenceSnapshotMeta(report);
      changes = compareDueDiligenceSnapshots(currentMeta, previousMeta);

      const snapshot = await persistDueDiligenceSnapshot(user.id, report, changes);
      snapshotId = snapshot.id;
    } catch {
      persistenceWarning =
        "تم إنشاء التقرير، لكن تعذر حفظ نسخته التاريخية أو مقارنة التغييرات هذه المرة. لا يؤثر ذلك في نتائج الفحص الحالية.";
    }
  }

  return NextResponse.json({
    mode,
    demo: mode === "DEMO",
    snapshotId,
    changes,
    persistenceWarning,
    demoNotice:
      mode === "DEMO"
        ? "جميع الوقائع والنتائج في هذا التقرير بيانات صناعية لأغراض العرض ولا تخص أي كيان حقيقي."
        : undefined,
    report,
  });
}
