import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { API_SCOPES, generateApiKey, isApiScope } from "@/lib/modules/api-gateway/api-keys";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(2, "اسم المفتاح مطلوب."),
  scopes: z.array(z.string()).optional(),
  rateLimit: z.number().int().min(1).max(10_000).optional(),
  expiresAt: z.string().datetime().optional(),
});

// GET /api/admin/api-keys — قائمة المفاتيح (بلا التجزئة). صلاحية إدارة.
export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("USERS_MANAGE", request);
  if (gate.response) return gate.response;

  const keys = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, name: true, keyPrefix: true, scopes: true, rateLimit: true, active: true, lastUsedAt: true, expiresAt: true, createdAt: true },
  });
  return NextResponse.json({ ok: true, scopes: API_SCOPES, keys });
}

// POST /api/admin/api-keys — إنشاء مفتاح جديد. يعيد المفتاح الخام مرة واحدة فقط.
export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("USERS_MANAGE", request);
  if (gate.response) return gate.response;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة." }, { status: 400 });

  const scopes = (parsed.data.scopes ?? ["legal:read"]).filter(isApiScope);
  if (scopes.length === 0) return NextResponse.json({ ok: false, error: `نطاق غير صالح. المتاح: ${API_SCOPES.join(", ")}.` }, { status: 400 });

  const gen = generateApiKey();
  const key = await prisma.apiKey.create({
    data: {
      name: parsed.data.name,
      keyPrefix: gen.keyPrefix,
      keyHash: gen.keyHash,
      scopes,
      rateLimit: parsed.data.rateLimit ?? 60,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      createdById: gate.user?.id ?? null,
    },
    select: { id: true, name: true, keyPrefix: true, scopes: true, rateLimit: true, expiresAt: true, createdAt: true },
  });

  await auditEvent({
    actorId: gate.user?.id,
    subject: "ADMIN",
    action: "API_KEY_CREATED",
    metadata: { keyId: key.id, keyPrefix: key.keyPrefix, scopes, rateLimit: key.rateLimit },
  }).catch(() => undefined);

  // المفتاح الخام يظهر هنا فقط ولن يُخزَّن أو يُعرض ثانيةً.
  return NextResponse.json({ ok: true, apiKey: gen.fullKey, key, notice: "احفظ المفتاح الآن — لن يُعرض مرة أخرى." }, { status: 201 });
}
