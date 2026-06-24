import { NextResponse } from "next/server";
import { openApiSpec } from "@/lib/openapi/spec";

export const dynamic = "force-dynamic";

// GET /api/openapi — مواصفة OpenAPI 3.1 خامًا (توثيق عام، بلا أسرار).
export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: { "cache-control": "public, max-age=300" },
  });
}
