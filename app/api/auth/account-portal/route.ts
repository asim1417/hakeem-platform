import { NextRequest, NextResponse } from "next/server";
import { getAccountSecurityFeatures } from "@/lib/modules/auth/auth-providers";
import { buildClerkPortalPageUrl, type ClerkPortalPage } from "@/lib/modules/auth/clerk-oauth-start";
import { continueUrl, safeDashboardNext } from "@/lib/modules/auth/safe-next";
import { hydrateEnvFromSettings } from "@/lib/modules/settings/settings-service";

export const dynamic = "force-dynamic";

type Section = "security" | "organization" | "create-organization";

const PAGE_FOR: Record<Section, ClerkPortalPage> = {
  security: "user",
  organization: "organization",
  "create-organization": "create-organization",
};

function parseSection(raw: string | null): Section | null {
  if (raw === "security" || raw === "organization" || raw === "create-organization") return raw;
  return null;
}

/**
 * GET /api/auth/account-portal?section=security|organization|create-organization&next=/dashboard
 *
 * يفتح صفحة إدارة الحساب في بوابة حسابات Clerk (بلا Clerk JS داخل المنصة):
 * - security: الملف الشخصي والأمان — تفعيل التحقق الثنائي، ربط Google/Microsoft/Apple، الأجهزة.
 * - organization / create-organization: حساب المكتب ودعوة الأعضاء وأدوارهم.
 * الميزة غير المفعّلة بعلمها تعود إلى لوحة التحكم.
 */
export async function GET(request: NextRequest) {
  await hydrateEnvFromSettings().catch(() => 0);

  const nextSafe = safeDashboardNext(request.nextUrl.searchParams.get("next"), "/dashboard");
  const fallback = NextResponse.redirect(new URL(nextSafe, request.url));

  const section = parseSection(request.nextUrl.searchParams.get("section"));
  if (!section) return fallback;

  const features = getAccountSecurityFeatures();
  const allowed = section === "security" ? features.mfa : features.organizations;
  if (!allowed) return fallback;

  const portalUrl = buildClerkPortalPageUrl({
    page: PAGE_FOR[section],
    redirectUrl: `${request.nextUrl.origin}${continueUrl(nextSafe)}`,
  });
  return portalUrl ? NextResponse.redirect(portalUrl) : fallback;
}
