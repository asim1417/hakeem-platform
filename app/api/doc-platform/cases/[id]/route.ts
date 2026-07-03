import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWorkspace, isMissingTableError, MISSING_TABLE_MESSAGE } from "@/lib/modules/doc-platform/workspace";

export const dynamic = "force-dynamic";

/** تحميل قضية محفوظة كاملة */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const ws = await getWorkspace();
    if (!ws) return NextResponse.json({ error: "لا مساحة عمل" }, { status: 404 });
    const item = await prisma.docCase.findFirst({ where: { id: params.id, workspaceId: ws.id } });
    if (!item) return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
    return NextResponse.json({
      id: item.id,
      title: item.title,
      docs: item.docs,
      annotations: item.annotations,
      updatedAt: item.updatedAt.toISOString()
    });
  } catch (error) {
    if (isMissingTableError(error)) return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 503 });
    return NextResponse.json({ error: "تعذّر التحميل" }, { status: 500 });
  }
}

/** حذف قضية محفوظة */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const ws = await getWorkspace();
    if (!ws) return NextResponse.json({ error: "لا مساحة عمل" }, { status: 404 });
    const owned = await prisma.docCase.findFirst({ where: { id: params.id, workspaceId: ws.id }, select: { id: true } });
    if (!owned) return NextResponse.json({ error: "القضية غير موجودة" }, { status: 404 });
    await prisma.docCase.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isMissingTableError(error)) return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 503 });
    return NextResponse.json({ error: "تعذّر الحذف" }, { status: 500 });
  }
}
