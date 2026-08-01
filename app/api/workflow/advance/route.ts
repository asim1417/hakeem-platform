import { NextRequest, NextResponse } from "next/server";
import {
  BLUEPRINT_WORKFLOW,
  SIMULATION_WORKFLOW,
  validateAdvance,
} from "@/lib/modules/workflow/state-machine";

export const dynamic = "force-dynamic";

const DEFS = {
  "blueprint.lifecycle": BLUEPRINT_WORKFLOW,
  "judicial.simulation": SIMULATION_WORKFLOW,
} as const;

/**
 * POST /api/workflow/advance — يتحقّق من انتقال مقترح (§14) دون تنفيذه.
 * طبقة تحقّق opt-in: لا تكتب حالة المحاكاة القائمة. body: { workflow, from, to }.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const def = DEFS[body?.workflow as keyof typeof DEFS];
  if (!def) {
    return NextResponse.json({ message: "workflow غير معروف." }, { status: 400 });
  }
  const decision = validateAdvance(def as never, String(body?.from), String(body?.to));
  return NextResponse.json({ decision });
}
