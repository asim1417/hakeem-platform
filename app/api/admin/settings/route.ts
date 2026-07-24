import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/modules/auth/super-admin";
import { auditEvent } from "@/lib/modules/audit/audit";
import { getSettingsStatus, setSetting, MANAGED_KEYS } from "@/lib/modules/settings/settings-service";

export const dynamic = "force-dynamic";

const MANAGED = new Set(MANAGED_KEYS.map((k) => k.key));

// GET — حالة المفاتيح (بلا كشف قيم الأسرار). سوبر أدمن فقط.
export async function GET(request: NextRequest) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;
  const status = await getSettingsStatus();
  return NextResponse.json({ ok: true, settings: status });
}

const saveSchema = z.object({
  updates: z.record(z.string(), z.string()),
});

// POST — حفظ مفاتيح (قيمة فارغة = حذف/رجوع لمتغيّر البيئة). سوبر أدمن فقط.
export async function POST(request: NextRequest) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;

  const body = saveSchema.parse(await request.json());
  const keys = Object.keys(body.updates).filter((k) => MANAGED.has(k));
  for (const key of keys) {
    await setSetting(key, body.updates[key], gate.user?.email ?? undefined);
  }
  await auditEvent({
    actorId: gate.user?.id,
    subject: "ADMIN",
    action: "SETTINGS_UPDATED",
    // لا نُسجّل القيم — فقط أسماء المفاتيح المُعدَّلة.
    metadata: { keys },
  }).catch(() => undefined);

  const status = await getSettingsStatus();
  return NextResponse.json({ ok: true, updated: keys.length, settings: status });
}
