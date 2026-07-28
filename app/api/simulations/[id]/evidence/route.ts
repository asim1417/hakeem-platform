import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { findOwnedSimulation } from "@/lib/modules/auth/ownership";
import { extractPdfText, extractDocxText } from "@/lib/modules/document-inspection/file-extract";

export const dynamic = "force-dynamic";

// رفع مرفقات الأدلّة إلى القاضي (منقولٌ من القاعة الكلاسيكيّة): يُستخرَج نصّ المستند خادِميًّا
// ويُسجَّل بيّنةً منسوبةً للطرف مُقدّمها، فيقرؤها القاضي في دوره التالي ضمن المحضر. الصور
// الممسوحة تُعلَّم بأنّها تحتاج قراءةً ضوئيّة (لا تُرسَل صورةٌ للنموذج). حدٌّ أقصى للطول والحجم.
const PARTY_ROLES = new Set(["المدعي", "وكيل المدعي", "المدعى عليه", "وكيل المدعى عليه"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_TEXT = 4000; // سقفٌ لنصّ البيّنة المحقون في المحضر

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("SIMULATIONS_USE", request);
  if (gate.response) return gate.response;
  const user = gate.user!;

  const session = await findOwnedSimulation(user, params.id, { messages: { orderBy: { createdAt: "asc" } } });
  if (!session) return NextResponse.json({ message: "لم يتم العثور على جلسة المحاكاة." }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const role = String(form?.get("role") || "").trim();
  if (!(file instanceof File)) return NextResponse.json({ message: "اختر ملفًا صالحًا للرفع." }, { status: 400 });
  if (!PARTY_ROLES.has(role)) return NextResponse.json({ message: "صفة مُقدّم البيّنة غير صحيحة." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ message: "حجم الملف يتجاوز الحدّ (10 ميغابايت)." }, { status: 400 });

  const name = file.name || "مستند";
  let extracted = "";
  try {
    const buffer = await file.arrayBuffer();
    if (file.type === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
      const r = await extractPdfText(buffer);
      extracted = r.needsOcr || r.emptyPages === r.pages ? "(المستند صورةٌ ممسوحة بلا طبقة نصّ — يلزم إدخال مضمونه نصًّا.)" : r.text;
    } else if (
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      name.toLowerCase().endsWith(".docx")
    ) {
      extracted = await extractDocxText(buffer);
    } else if (file.type === "text/plain" || name.toLowerCase().endsWith(".txt")) {
      extracted = new TextDecoder("utf-8").decode(buffer);
    } else if (file.type.startsWith("image/")) {
      extracted = "(بيّنةٌ مصوَّرة مُرفَقة — تحتاج قراءةً ضوئيّة أو إدخال مضمونها نصًّا لتُقيَّم.)";
    } else {
      return NextResponse.json({ message: "نوع الملف غير مدعوم. المتاح: PDF, DOCX, TXT, PNG, JPG." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ message: "تعذّر استخراج نصّ المستند. حاول بصيغةٍ أخرى أو أدخِل مضمونه نصًّا." }, { status: 422 });
  }

  const clean = (extracted || "").replace(/\s+\n/g, "\n").trim();
  const body = clean.length > MAX_TEXT ? `${clean.slice(0, MAX_TEXT)}\n… (اختُصر النصّ)` : clean || "(لا نصّ قابل للاستخراج.)";
  const content = `بيّنة مُرفَقة — مستند: ${name}\n${body}`;

  const message = await prisma.simulationMessage.create({
    data: { simulationId: params.id, role, stage: session.stage, content }
  });

  await auditEvent({
    actorId: user.id,
    subject: "SIMULATION",
    action: "SIMULATION_EVIDENCE_ATTACHED",
    entityId: params.id,
    metadata: { description: "رُفعت بيّنةٌ مُرفَقة.", role, fileName: name, messageId: message.id }
  });

  return NextResponse.json({ message }, { status: 201 });
}
