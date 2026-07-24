import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/modules/auth/super-admin";
import {
  deleteCustomPage,
  getCustomPageBySlug,
  listCustomPages,
  upsertCustomPage,
} from "@/lib/modules/site/site-store";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

async function findPageById(id: string) {
  const pages = await listCustomPages();
  return pages.find((p) => p.id === id) || null;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;

  const id = params.id?.trim();
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "معرّف الصفحة مطلوب." },
      { status: 400 },
    );
  }

  const existing = await findPageById(id);
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "الصفحة غير موجودة." },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "طلب غير صالح." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "بيانات غير صالحة." }, { status: 400 });
  }

  const raw = body as {
    title?: unknown;
    slug?: unknown;
    body?: unknown;
    enabled?: unknown;
  };

  try {
    const page = await upsertCustomPage({
      id: existing.id,
      title: typeof raw.title === "string" ? raw.title : existing.title,
      slug: typeof raw.slug === "string" ? raw.slug : existing.slug,
      body: typeof raw.body === "string" ? raw.body : existing.body,
      enabled:
        typeof raw.enabled === "boolean" ? raw.enabled : existing.enabled,
    });
    if (!page) {
      return NextResponse.json(
        { ok: false, error: "تعذّر تحديث الصفحة." },
        { status: 400 },
      );
    }
    // إن تغيّر الـ slug نتحقق من النتيجة عبر الـ slug الجديد
    const verified =
      (await getCustomPageBySlug(page.slug)) || page;
    return NextResponse.json({ ok: true, page: verified });
  } catch (error) {
    console.error("[admin/site/pages] PATCH failed", error);
    return NextResponse.json(
      { ok: false, error: "تعذّر تحديث الصفحة." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;

  const id = params.id?.trim();
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "معرّف الصفحة مطلوب." },
      { status: 400 },
    );
  }

  const existing = await findPageById(id);
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "الصفحة غير موجودة." },
      { status: 404 },
    );
  }

  try {
    const ok = await deleteCustomPage(id);
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "تعذّر حذف الصفحة." },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/site/pages] DELETE failed", error);
    return NextResponse.json(
      { ok: false, error: "تعذّر حذف الصفحة." },
      { status: 500 },
    );
  }
}
