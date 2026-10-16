/** POST /api/connections/keys — ينشئ المستخدم مفتاحًا شخصيًا لموصل حكيم (يُعرض مرة واحدة). */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { generateApiKey } from "@/lib/modules/api-gateway/api-keys";
import { accountLinkingEnabled, mcpUserRateLimit } from "@/lib/mcp/config";
import { MCP_SCOPE } from "@/lib/mcp/grants/service";
import { MAX_PERSONAL_KEYS } from "@/lib/mcp/grants/queries";

export const dynamic = "force-dynamic";

const createSchema = z.object({ name: z.string().trim().min(2, "اسم المفتاح مطلوب.").max(80) });

export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return gate.response;
  if (!accountLinkingEnabled()) return NextResponse.json({ ok: false, error: "الربط بالحساب غير مفعّل." }, { status: 503 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة." }, { status: 400 });
  }

  const userId = gate.user.id;
  const active = await prisma.apiKey.count({ where: { userId, active: true, scopes: { has: MCP_SCOPE } } }).catch(() => null);
  if (active === null) return NextResponse.json({ ok: false, error: "تعذّر إنشاء المفتاح الآن." }, { status: 503 });
  if (active >= MAX_PERSONAL_KEYS) {
    return NextResponse.json({ ok: false, error: `الحد الأقصى ${MAX_PERSONAL_KEYS} مفاتيح نشطة. ألغِ مفتاحًا قديمًا أولًا.` }, { status: 400 });
  }

  const gen = generateApiKey();
  const key = await prisma.apiKey.create({
    data: {
      name: parsed.data.name,
      keyPrefix: gen.keyPrefix,
      keyHash: gen.keyHash,
      scopes: [MCP_SCOPE],
      rateLimit: mcpUserRateLimit(),
      userId,
      createdById: userId,
    },
    select: { id: true, name: true, keyPrefix: true, active: true, createdAt: true, lastUsedAt: true },
  });

  await auditEvent({ actorId: userId, subject: "AUTH", action: "MCP_PERSONAL_KEY_CREATED", entityId: key.id, metadata: { keyPrefix: key.keyPrefix } }).catch(
    () => undefined
  );

  return NextResponse.json(
    {
      ok: true,
      apiKey: gen.fullKey,
      key: { ...key, createdAt: key.createdAt.toISOString(), lastUsedAt: null },
      notice: "احفظ المفتاح الآن — لن يُعرض مرة أخرى.",
    },
    { status: 201 }
  );
}
