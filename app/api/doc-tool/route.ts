import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getOrCreateWorkspace,
  getWorkspace,
  isMissingTableError,
  MISSING_TABLE_MESSAGE
} from "@/lib/modules/doc-platform/workspace";
import { auditDocToolOp, summarizeDocDelta } from "@/lib/modules/doc-tool/audit-log";
import { archiveSnapshot } from "@/lib/modules/doc-tool/snapshots";
import { getApiUser } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

// إلزام تسجيل الدخول لاستخدام أداة الوثائق — مطفأ افتراضيًا (تغيير سياسة وصولٍ كاسر
// يُفعَّل عمدًا لا تلقائيًّا). للتفعيل: HAKEEM_DOC_TOOL_REQUIRE_AUTH_V1=1.
function requireAuthEnabled(): boolean {
  const v = (process.env.HAKEEM_DOC_TOOL_REQUIRE_AUTH_V1 ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

const UNAUTH = { error: "يلزم تسجيل الدخول لاستخدام أداة الوثائق" };

// وثائق أداة معالجة الوثائق تُحفَظ كسجل DocCase واحد بعنوان حارس لكل مساحة عمل —
// إعادة استخدام لجداول منصة الوثائق القائمة (doc_workspaces/doc_cases) بلا migration.
const CASE_MARKER = "__hakeem_doc_tool__";
const MAX_DOCS = 500;
const MAX_TEXT_CHARS = 400_000;

export interface ToolDoc {
  title: string;
  kind: string;
  rawText: string;
  /** ترويسات/تذييلات متكررة مفصولة كبيانات وصفية */
  running?: string;
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
    const running = typeof o.running === "string" && o.running.trim() ? o.running.slice(0, 5000) : undefined;
    docs.push({ title, kind, rawText: o.rawText.slice(0, MAX_TEXT_CHARS), ...(running ? { running } : {}) });
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
export async function GET(request: NextRequest) {
  try {
    if (requireAuthEnabled() && !(await getApiUser(request).catch(() => null))) {
      return NextResponse.json(UNAUTH, { status: 401 });
    }
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
    const user = await getApiUser(request).catch(() => null);
    if (requireAuthEnabled() && !user) {
      return NextResponse.json(UNAUTH, { status: 401 });
    }
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
    // تدقيقٌ لعمليّة الحفظ (بيانات وصفيّة) + أرشفةُ لقطةٍ كاملة (المحتوى، تاريخٌ لا
    // يُستبدَل). كلاهما fail-open ولا يعطّل الحفظ. نمرّر هويّة المستخدم المُستخرَجة مرّةً.
    await auditDocToolOp({
      action: "DOC_TOOL_SAVE",
      actorId: user?.id,
      workspaceId: ws.id,
      request,
      metadata: summarizeDocDelta(existing?.docs, docs)
    });
    await archiveSnapshot({ workspaceId: ws.id, actorId: user?.id, docs, docCount: docs.length });
    return NextResponse.json({ ok: true, count: docs.length });
  } catch (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: "تعذّر حفظ الوثائق" }, { status: 500 });
  }
}

/** مسح كل الوثائق المحفوظة لمساحة العمل */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getApiUser(request).catch(() => null);
    if (requireAuthEnabled() && !user) {
      return NextResponse.json(UNAUTH, { status: 401 });
    }
    const ws = await getWorkspace();
    if (ws) {
      const existing = await findToolCase(ws.id);
      await prisma.docCase.deleteMany({ where: { workspaceId: ws.id, title: CASE_MARKER } });
      await auditDocToolOp({
        action: "DOC_TOOL_CLEAR",
        actorId: user?.id,
        workspaceId: ws.id,
        request,
        metadata: { removed: summarizeDocDelta(existing?.docs, []).removed }
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: "تعذّر المسح" }, { status: 500 });
  }
}
