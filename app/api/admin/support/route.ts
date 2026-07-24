import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/modules/auth/super-admin";
import {
  countUnreadForAdmin,
  listThreadsForAdmin,
} from "@/lib/modules/support/support-store";

export const dynamic = "force-dynamic";

/** GET — قائمة خيوط التواصل للسوبر أدمن. */
export async function GET(request: NextRequest) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;

  const [threads, unread] = await Promise.all([
    listThreadsForAdmin(60),
    countUnreadForAdmin(),
  ]);

  return NextResponse.json({ ok: true, threads, unread });
}
