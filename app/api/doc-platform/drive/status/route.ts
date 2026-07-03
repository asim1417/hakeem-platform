import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isDriveConfigured } from "@/lib/modules/doc-platform/google-drive";

export const dynamic = "force-dynamic";

/** حالة تكامل Drive: هل هو مُهيَّأ (مفاتيح موجودة)؟ وهل المستخدم مربوط؟ */
export async function GET() {
  const configured = isDriveConfigured();
  const connected = Boolean(cookies().get("docplatform_gdrive")?.value);
  return NextResponse.json({ configured, connected });
}
