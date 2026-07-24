import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/modules/auth/super-admin";
import {
  listCustomPages,
  upsertCustomPage,
} from "@/lib/modules/site/site-store";
import { slugifyAr } from "@/lib/modules/site/defaults";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;

  try {
    const pages = await listCustomPages();
    return NextResponse.json({ ok: true, pages });
  } catch (error) {
    console.error("[admin/site/pages] GET failed", error);
    return NextResponse.json(
      { ok: false, error: "تعذّر تحميل الصفحات." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
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

  const raw = body as {
    title?: unknown;
    slug?: unknown;
    body?: unknown;
    enabled?: unknown;
  };

  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) {
    return NextResponse.json(
      { ok: false, error: "عنوان الصفحة مطلوب." },
      { status: 400 },
    );
  }

  const slugRaw =
    typeof raw.slug === "string" && raw.slug.trim()
      ? raw.slug.trim()
      : slugifyAr(title);

  try {
    const page = await upsertCustomPage({
      slug: slugRaw,
      title,
      body: typeof raw.body === "string" ? raw.body : "",
      enabled: raw.enabled !== false,
    });
    if (!page) {
      return NextResponse.json(
        { ok: false, error: "تعذّر إنشاء الصفحة — تحقق من الرابط والعنوان." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, page }, { status: 201 });
  } catch (error) {
    console.error("[admin/site/pages] POST failed", error);
    return NextResponse.json(
      { ok: false, error: "تعذّر إنشاء الصفحة." },
      { status: 500 },
    );
  }
}
