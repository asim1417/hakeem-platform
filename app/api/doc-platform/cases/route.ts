import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getOrCreateWorkspace,
  getWorkspace,
  DOC_TOOL_CASE_MARKER,
  isMissingTableError,
  MISSING_TABLE_MESSAGE
} from "@/lib/modules/doc-platform/workspace";

export const dynamic = "force-dynamic";

const MAX_DOCS = 500;
const MAX_TEXT_CHARS = 400_000;
const MAX_CASES_PER_WORKSPACE = 100;

interface DocInput {
  title: string;
  rawText: string;
}

function sanitizeDocs(payload: unknown): DocInput[] | null {
  if (!Array.isArray(payload) || payload.length === 0 || payload.length > MAX_DOCS) return null;
  const docs: DocInput[] = [];
  for (const item of payload) {
    if (typeof item !== "object" || item === null) return null;
    const o = item as Record<string, unknown>;
    if (typeof o.title !== "string" || typeof o.rawText !== "string") return null;
    const title = o.title.trim().slice(0, 300);
    const rawText = o.rawText.slice(0, MAX_TEXT_CHARS);
    if (!title || rawText.trim().length < 5) return null;
    docs.push({ title, rawText });
  }
  return docs;
}

/** قائمة القضايا المحفوظة لمساحة العمل الحالية */
export async function GET() {
  try {
    const ws = await getWorkspace();
    if (!ws) return NextResponse.json({ cases: [], prefs: null });
    const [cases, workspace] = await Promise.all([
      prisma.docCase.findMany({
        // سجل أداة معالجة الوثائق (/doc-tool) داخلي — لا يظهر بين قضايا المنصة
        where: { workspaceId: ws.id, title: { not: DOC_TOOL_CASE_MARKER } },
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, docCount: true, updatedAt: true }
      }),
      prisma.docWorkspace.findUnique({ where: { id: ws.id }, select: { prefs: true } })
    ]);
    return NextResponse.json({
      cases: cases.map((c) => ({ ...c, updatedAt: c.updatedAt.toISOString() })),
      prefs: workspace?.prefs ?? null
    });
  } catch (error) {
    if (isMissingTableError(error)) return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 503 });
    return NextResponse.json({ error: "تعذّر جلب القضايا" }, { status: 500 });
  }
}

/** حفظ قضية جديدة (أو استبدال واحدة قائمة بنفس المعرف) وحفظ التفضيلات */
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const o = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;

    const ws = await getOrCreateWorkspace();

    // حفظ تفضيلات فقط
    if (o.prefs !== undefined && o.docs === undefined) {
      await prisma.docWorkspace.update({ where: { id: ws.id }, data: { prefs: o.prefs as object } });
      return NextResponse.json({ ok: true });
    }

    const docs = sanitizeDocs(o.docs);
    if (!docs) return NextResponse.json({ error: "وثائق غير صالحة (يُقبل حتى 500 وثيقة نصية)" }, { status: 400 });
    const title = typeof o.title === "string" && o.title.trim() ? o.title.trim().slice(0, 200) : "قضية بلا عنوان";
    const annotations = typeof o.annotations === "object" && o.annotations !== null ? (o.annotations as object) : undefined;
    const caseId = typeof o.caseId === "string" ? o.caseId : null;

    if (caseId) {
      const owned = await prisma.docCase.findFirst({ where: { id: caseId, workspaceId: ws.id }, select: { id: true } });
      if (!owned) return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
      const updated = await prisma.docCase.update({
        where: { id: caseId },
        data: {
          title,
          docs: docs as unknown as Prisma.InputJsonValue,
          annotations: annotations as Prisma.InputJsonValue | undefined,
          docCount: docs.length
        }
      });
      return NextResponse.json({ ok: true, id: updated.id });
    }

    const count = await prisma.docCase.count({ where: { workspaceId: ws.id } });
    if (count >= MAX_CASES_PER_WORKSPACE) {
      return NextResponse.json({ error: "بلغت حدّ القضايا المحفوظة (100) — احذف قديمة أولاً" }, { status: 400 });
    }
    const created = await prisma.docCase.create({
      data: {
        workspaceId: ws.id,
        title,
        docs: docs as unknown as Prisma.InputJsonValue,
        annotations: annotations as Prisma.InputJsonValue | undefined,
        docCount: docs.length
      }
    });
    return NextResponse.json({ ok: true, id: created.id });
  } catch (error) {
    if (isMissingTableError(error)) return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 503 });
    return NextResponse.json({ error: "تعذّر الحفظ" }, { status: 500 });
  }
}
