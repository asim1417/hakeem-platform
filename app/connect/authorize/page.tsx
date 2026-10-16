/**
 * شاشة موافقة ربط موصل حكيم (MCP) بحساب المستخدم.
 * يصلها المستخدم من /oauth/authorize ومعه طلب معلّق موقّع في كوكي؛ بلا جلسة يُحوَّل للدخول ثم يعود هنا.
 * القرار نموذج HTML عادي إلى /api/connections/authorize (لا JavaScript).
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { accountLinkingEnabled, mcpTokenSecret } from "@/lib/mcp/config";
import { CONSENT_PATH, PENDING_COOKIE } from "@/lib/mcp/grants/pending-cookie";
import { clientDisplayName } from "@/lib/mcp/grants/service";
import { readPending } from "@/lib/mcp/grants/tokens";
import { LegalAlert, LegalCard } from "@/components/ui/legal";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ربط تطبيق بحسابك — حكيم",
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main dir="rtl" className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-4 py-10">
      {children}
    </main>
  );
}

export default async function ConnectAuthorizePage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(CONSENT_PATH)}`);

  const secret = mcpTokenSecret();
  const pending = secret && accountLinkingEnabled() ? readPending(secret, cookies().get(PENDING_COOKIE)?.value) : null;

  if (!pending) {
    return (
      <Shell>
        <LegalCard title="لا يوجد طلب ربط صالح" eyebrow="ربط تطبيق">
          <LegalAlert tone="warning">
            انتهت مهلة طلب الربط أو لم يبدأ من تطبيق. ارجع إلى Claude أو ChatGPT واضغط «Connect» على موصل حكيم مرة أخرى.
          </LegalAlert>
        </LegalCard>
      </Shell>
    );
  }

  const app = clientDisplayName(pending.ru);
  const returnHost = new URL(pending.ru).host;

  return (
    <Shell>
      <LegalCard title={`${app} يطلب الوصول إلى حكيم باسمك`} eyebrow="ربط تطبيق">
        <p className="leading-8 text-[var(--ink-70)]">
          الحساب: <b dir="ltr" className="font-mono-legal text-[var(--navy)]">{user.email}</b>
        </p>

        <ul className="mt-4 list-disc space-y-2 pr-5 leading-8 text-[var(--ink)]">
          <li>قراءة الأنظمة والمواد والأحكام في حكيم. قراءة فقط، لا يعدّل التطبيق شيئًا في حسابك.</li>
          <li>البحث والحصر يُحسبان من حصّتك أو رصيدك في حكيم، وبعض الأدوات للمشتركين فقط.</li>
          <li>يصل إلى حكيم ما يرسله {app} من عبارات البحث فقط، ولا يُحفظ نصها في سجلاتنا.</li>
          <li>تستطيع إلغاء الربط في أي وقت من صفحة «التطبيقات المرتبطة» في لوحتك.</li>
        </ul>

        <form method="post" action="/api/connections/authorize" className="mt-6 flex flex-wrap gap-3">
          <input type="hidden" name="nonce" value={pending.n} />
          <button type="submit" name="decision" value="approve" className="btn btn-gold">
            موافق
          </button>
          <button type="submit" name="decision" value="deny" className="btn btn-primary">
            رفض
          </button>
        </form>

        <p className="mt-4 text-sm leading-7 text-[var(--ink-60)]">
          بعد قرارك تعود تلقائيًا إلى <span dir="ltr" className="font-mono-legal">{returnHost}</span>.
        </p>
      </LegalCard>
    </Shell>
  );
}
