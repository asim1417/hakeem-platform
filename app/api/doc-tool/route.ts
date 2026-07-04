import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getOrCreateWorkspace,
  getWorkspace,
  isMissingTableError,
  MISSING_TABLE_MESSAGE
} from "@/lib/modules/doc-platform/workspace";

export const dynamic = "force-dynamic";

// وثائق أداة معالجة الوثائق تُحفَظ كسجل DocCase واحد بعنوان حارس لكل مساحة عمل —
// إعادة استخدام لجداول منصة الوثائق القائمة (doc_workspaces/doc_cases) بلا migration.
const CASE_MARKER = "__hakeem_doc_tool__";
const MAX_DOCS = 500;
const MAX_TEXT_CHARS = 400_000;

export interface ToolDoc {
  title: string;
  kind: string;
  rawText: string;
}

function sanitizeDocs(payload: unknown): ToolDoc[] | null {
  if (!Array.isArray(payload) || payload.length > MAX_DOCS) return null;
  const docs: ToolDoc[] = [];
  for (const item of payload) {
    if (typeof item !== "object" || item === null) return null;
    const o = item as Record<string, unknown>;
    if (typeof o.title !== "string" || typeof o.rawText !== "string") return null;
    const kind = typeof o.kind === "string" ? o.kind.slice(0, 60) : "نص";
    const title = o.title.trim().slice(0, 300);
    if (!title) return null;
    docs.push({ title, kind, rawText: o.rawText.slice(0, MAX_TEXT_CHARS) });
  }
  return docs;
}

async function findToolCase(workspaceId: string) {
  return prisma.docCase.findFirst({
    where: { workspaceId, title: CASE_MARKER },
    select: { id: true, docs: true }
  });
}

/** وثائق المستخدم المحفوظة (مساحة العمل عبر الكوكي) */
export async function GET() {
  try {
    const ws = await getWorkspace();
    if (!ws) return NextResponse.json({ docs: [] });
    const found = await findToolCase(ws.id);
    return NextResponse.json({ docs: (found?.docs as unknown as ToolDoc[]) ?? [] });
  } catch (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: "تعذّر تحميل الوثائق" }, { status: 500 });
  }
}

/** حفظ القائمة الكاملة للوثائق (يستبدل المخزَّن) */
export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as { docs?: unknown };
    const docs = sanitizeDocs(body.docs);
    if (docs === null) {
      return NextResponse.json(
        { error: `مدخل غير صالح — الحد ${MAX_DOCS} وثيقة و${MAX_TEXT_CHARS.toLocaleString("ar-EG")} حرف للوثيقة` },
        { status: 400 }
      );
    }
    const ws = await getOrCreateWorkspace();
    const existing = await findToolCase(ws.id);
    const data = {
      docs: docs as unknown as Prisma.InputJsonValue,
      docCount: docs.length
    };
    if (existing) {
      await prisma.docCase.update({ where: { id: existing.id }, data });
    } else {
      await prisma.docCase.create({
        data: { workspaceId: ws.id, title: CASE_MARKER, ...data }
      });
    }
    return NextResponse.json({ ok: true, count: docs.length });
  } catch (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: "تعذّر حفظ الوثائق" }, { status: 500 });
  }
}

/** مسح كل الوثائق المحفوظة لمساحة العمل */
export async function DELETE() {
  try {
    const ws = await getWorkspace();
    if (ws) {
      await prisma.docCase.deleteMany({ where: { workspaceId: ws.id, title: CASE_MARKER } });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: "تعذّر المسح" }, { status: 500 });
  }
}
