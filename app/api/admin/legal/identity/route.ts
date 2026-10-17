import { NextRequest } from "next/server";
import { gate, response, failure } from "@/lib/modules/editorial/access";
import {
  identitySchema,
  resolveIdentity,
} from "@/lib/modules/editorial/identity";
export async function POST(request: NextRequest) {
  try {
    await gate(request);
    return response(
      await resolveIdentity(identitySchema.parse(await request.json())),
    );
  } catch (e) {
    return failure(e);
  }
}
