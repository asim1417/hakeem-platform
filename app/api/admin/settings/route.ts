import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/modules/auth/super-admin";
import { auditEvent } from "@/lib/modules/audit/audit";
import {
  ensureAppSettingsTable,
  getSettingsStatus,
  setSetting,
  MANAGED_KEYS,
} from "@/lib/modules/settings/settings-service";

export const dynamic = "force-dynamic";

const MANAGED = new Set(MANAGED_KEYS.map((k) => k.key));

// GET — حالة المفاتيح (بلا كشف قيم الأسرار). سوبر أدمن فقط.
export async function GET(request: NextRequest) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;
  try {
    const status = await getSettingsStatus();
    return NextResponse.json({ ok: true, settings: status });
  } catch (err) {
    console.error("[admin/settings:GET]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { ok: false, message: "تعذّر قراءة الإعدادات." },
      { status: 500 }
    );
  }
}

const saveSchema = z.object({
  updates: z.record(z.string(), z.string()),
});

// POST — حفظ مفاتيح (قيمة فارغة = حذف/رجوع لمتغيّر البيئة). سوبر أدمن فقط.
export async function POST(request: NextRequest) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;

  try {
    const json = await request.json().catch(() => null);
    const parsed = saveSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: "بيانات الحفظ غير صالحة." },
        { status: 400 }
      );
    }

    await ensureAppSettingsTable();

    const keys = Object.keys(parsed.data.updates).filter((k) => MANAGED.has(k));
    if (keys.length === 0) {
      return NextResponse.json(
        { ok: false, message: "لا مفاتيح صالحة للحفظ." },
        { status: 400 }
      );
    }

    for (const key of keys) {
      await setSetting(key, parsed.data.updates[key], gate.user?.email ?? undefined);
    }

    await auditEvent({
      actorId: gate.user?.id,
      subject: "ADMIN",
      action: "SETTINGS_UPDATED",
      metadata: { keys },
    }).catch(() => undefined);

    const status = await getSettingsStatus();
    return NextResponse.json({ ok: true, updated: keys.length, settings: status });
  } catch (err) {
    console.error("[admin/settings:POST]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      {
        ok: false,
        message:
          err instanceof Error && err.message
            ? `تعذّر الحفظ: ${err.message}`
            : "تعذّر حفظ الإعدادات. تحقق من قاعدة البيانات ثم أعد المحاولة.",
      },
      { status: 500 }
    );
  }
}
