import { NextResponse } from "next/server";
import {
  BLUEPRINT_WORKFLOW,
  SIMULATION_WORKFLOW,
} from "@/lib/modules/workflow/state-machine";

export const dynamic = "force-dynamic";

/**
 * GET /api/workflow/definition — تعريفات سير العمل (§14) للقراءة/العرض.
 * توصيفٌ صريح للانتقالات والبوابات؛ لا يغيّر أي سلوك تشغيليّ.
 */
export function GET() {
  return NextResponse.json({
    workflows: [BLUEPRINT_WORKFLOW, SIMULATION_WORKFLOW],
  });
}
