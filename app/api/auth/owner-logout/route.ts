import { NextResponse } from "next/server";
import { clearLoginSession } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

export async function POST() {
  clearLoginSession();
  return NextResponse.json({ ok: true });
}
