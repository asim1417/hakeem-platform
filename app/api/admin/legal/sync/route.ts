import { NextRequest } from "next/server";
import { gate, response, failure } from "@/lib/modules/editorial/access";
import { demand } from "@/lib/modules/editorial/contracts";
import { runSync } from "@/lib/modules/editorial/sync";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  try {
    const { actor, config } = await gate(request, true);
    demand(actor, config.data, "LEGAL_PUBLISHER");
    return response(await runSync(actor.id));
  } catch (e) {
    return failure(e);
  }
}
