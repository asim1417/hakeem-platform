import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { addFinding, proposeSuggestion } from "@/lib/modules/review/service";
import type { FindingSeverity } from "@prisma/client";

export const dynamic = "force-dynamic";

const SEVERITIES: FindingSeverity[] = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

/**
 * POST /api/review/findings — إضافة ملاحظة (§13 Evidence-First: دليل إلزاميّ)،
 * ويمكن اقتراح إصلاح معها (kind=suggestion).
 */
export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("REVIEW_USE", request);
  if (gate.response) return gate.response;
  const body = await request.json().catch(() => ({}));
  const sessionId = String(body?.sessionId ?? "");
  if (!sessionId) return NextResponse.json({ message: "sessionId مطلوب." }, { status: 400 });

  try {
    if (body?.kind === "suggestion") {
      const suggestion = await proposeSuggestion({
        sessionId,
        ownerId: gate.user!.id,
        findingId: body?.findingId ? String(body.findingId) : undefined,
        title: String(body?.title ?? "").trim(),
        body: String(body?.body ?? "").trim(),
      });
      return NextResponse.json({ suggestion }, { status: 201 });
    }
    const severity = SEVERITIES.includes(body?.severity) ? (body.severity as FindingSeverity) : "MEDIUM";
    const finding = await addFinding({
      sessionId,
      ownerId: gate.user!.id,
      category: String(body?.category ?? "عامّ").trim() || "عامّ",
      severity,
      description: String(body?.description ?? "").trim(),
      evidence: Array.isArray(body?.evidence) ? body.evidence : [],
      confidence: typeof body?.confidence === "number" ? body.confidence : undefined,
      ruleId: body?.ruleId ? String(body.ruleId) : undefined,
    });
    return NextResponse.json({ finding }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "تعذّرت العملية." },
      { status: 400 }
    );
  }
}
