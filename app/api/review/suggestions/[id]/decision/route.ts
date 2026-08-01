import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { decideSuggestion } from "@/lib/modules/review/service";
import type { SuggestionStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const DECISIONS: SuggestionStatus[] = ["ACCEPTED", "REJECTED", "DEFERRED"];

/** POST /api/review/suggestions/[id]/decision — قرار بشريّ صريح (§12: لا تعديل صامت). */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("REVIEW_USE", request);
  if (gate.response) return gate.response;
  const body = await request.json().catch(() => ({}));
  const decision = body?.decision as SuggestionStatus;
  if (!DECISIONS.includes(decision)) {
    return NextResponse.json({ message: "قرار غير صالح." }, { status: 400 });
  }
  try {
    const suggestion = await decideSuggestion({
      suggestionId: params.id,
      ownerId: gate.user!.id,
      decision,
      note: body?.note ? String(body.note) : undefined,
      decidedAt: new Date().toISOString(),
    });
    return NextResponse.json({ suggestion });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "تعذّر تنفيذ القرار." },
      { status: 400 }
    );
  }
}
