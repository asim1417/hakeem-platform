import { redirect } from "next/navigation";
import { AuthJourneyShell } from "@/components/auth/AuthJourneyShell";
import { AuthIdentifierFlow } from "@/components/auth/AuthIdentifierFlow";
import { ClerkRoot } from "@/components/providers/ClerkRoot";
import { isIdentifierFormEnabled } from "@/lib/modules/auth/auth-providers";
import { resolvePostAuthNext } from "@/lib/modules/auth/safe-next";
import { hydrateEnvFromSettings } from "@/lib/modules/settings/settings-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "الدخول بالبريد أو الجوال — حكيم",
};

/**
 * /auth/identifier — نموذج الدخول العربي بالبريد أو الجوال (رمز تحقق + تحقق ثنائي).
 * معطّل ما لم يُفعَّل AUTH_IDENTIFIER_FORM_ENABLED؛ عندها يعود للبوابة المستضافة.
 */
export default async function IdentifierAuthPage({
  searchParams,
}: {
  searchParams?: { next?: string; returnUrl?: string; mode?: string };
}) {
  await hydrateEnvFromSettings().catch(() => 0);

  const mode = searchParams?.mode === "sign-up" ? "sign-up" : "sign-in";
  const nextUrl = resolvePostAuthNext(searchParams);

  if (!isIdentifierFormEnabled()) {
    redirect(`/api/auth/oauth/start?provider=email&mode=${mode}&next=${encodeURIComponent(nextUrl)}`);
  }

  const q = new URLSearchParams({ provider: "email", mode, next: nextUrl });
  const portalFallbackHref = `/api/auth/oauth/start?${q}&portal=1`;

  return (
    <ClerkRoot>
      <AuthJourneyShell
        compact
        tagline={
          mode === "sign-up"
            ? "أنشئ حسابك وابدأ تجربتك المجانية في دقائق"
            : "تابع أعمالك القانونية وتقاريرك وخدماتك الذكية من مكان واحد"
        }
      >
        <AuthIdentifierFlow mode={mode} nextUrl={nextUrl} portalFallbackHref={portalFallbackHref} />
      </AuthJourneyShell>
    </ClerkRoot>
  );
}
