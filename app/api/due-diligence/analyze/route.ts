import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { runDueDiligence } from "@/lib/modules/due-diligence/core";
import {
  buildConfiguredConnectors,
  dueDiligenceSourceCatalog,
} from "@/lib/modules/due-diligence/connectors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const entitySchema = z
  .object({
    name: z.string().trim().min(2).max(240),
    unifiedNumber: z.string().trim().min(4).max(32).optional(),
    commercialRegistration: z.string().trim().min(4).max(32).optional(),
    city: z.string().trim().min(2).max(120).optional(),
  })
  .strict();

/**
 * GET — exposes source readiness without exposing endpoint URLs or credentials.
 */
export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });

  const configured = new Set(buildConfiguredConnectors().map((connector) => connector.source.key));
  return NextResponse.json({
    sources: dueDiligenceSourceCatalog().map((source) => ({
      key: source.key,
      nameAr: source.nameAr,
      authority: source.authority,
      accessType: source.accessType,
      configured: configured.has(source.key),
    })),
  });
}

/**
 * POST — runs entity due diligence against server-configured, approved sources only.
 * The request can never supply a source URL; this intentionally prevents SSRF and
 * ensures source access remains governed by Hakeem configuration.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });

  let entity: z.infer<typeof entitySchema>;
  try {
    entity = entitySchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        message: "بيانات الكيان غير صالحة.",
        details: error instanceof z.ZodError ? error.flatten() : undefined,
      },
      { status: 400 }
    );
  }

  const connectors = buildConfiguredConnectors();
  if (!connectors.length) {
    return NextResponse.json(
      {
        message: "محرك العناية الواجبة جاهز، لكن لم يتم تهيئة أي مصدر بيانات بعد.",
        setupRequired: true,
        sources: dueDiligenceSourceCatalog().map(({ key, nameAr, authority, accessType }) => ({
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
  return NextResponse.json({ report });
}
