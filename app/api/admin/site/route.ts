import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/modules/auth/super-admin";
import {
  getSiteConfig,
  saveSiteConfig,
} from "@/lib/modules/site/site-store";
import type { SiteConfigPatch } from "@/lib/modules/site/defaults";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;

  try {
    const config = await getSiteConfig();
    return NextResponse.json({ ok: true, config });
  } catch (error) {
    console.error("[admin/site] GET failed", error);
    return NextResponse.json(
      { ok: false, error: "تعذّر تحميل إعدادات الموقع." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "طلب غير صالح." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "بيانات غير صالحة." }, { status: 400 });
  }

  const raw = body as { config?: SiteConfigPatch };
  if (!raw.config || typeof raw.config !== "object") {
    return NextResponse.json(
      { ok: false, error: "الحقل config مطلوب." },
      { status: 400 },
    );
  }

  try {
    const config = await saveSiteConfig(raw.config);
    return NextResponse.json({ ok: true, config });
  } catch (error) {
    console.error("[admin/site] PUT failed", error);
    return NextResponse.json(
      { ok: false, error: "تعذّر حفظ إعدادات الموقع." },
      { status: 500 },
    );
  }
}
