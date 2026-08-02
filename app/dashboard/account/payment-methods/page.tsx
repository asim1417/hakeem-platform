import { requirePagePermission, getCurrentUser } from "@/lib/modules/auth/session";
import { Hero } from "@/components/ui/design-system";
import { PaymentMethodsClient, type PaymentMethodView } from "./PaymentMethodsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "وسائل الدفع — حكيم",
};

export default async function PaymentMethodsPage() {
  await requirePagePermission("LEGAL_CORE_VIEW");
  const user = await getCurrentUser();

  const { prisma } = await import("@/lib/prisma");
  const methods: PaymentMethodView[] = user
    ? await prisma.paymentMethod
        .findMany({
          where: { userId: user.id, status: "ACTIVE" },
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            brand: true,
            network: true,
            lastFour: true,
            expiryMonth: true,
            expiryYear: true,
            isDefault: true,
          },
        })
        .catch(() => [])
    : [];

  return (
    <div dir="rtl">
      <Hero
        eyebrow="حسابك"
        title="وسائل الدفع"
        lede="بطاقاتك المحفوظة — عيّن الافتراضية أو احذف ما لا تحتاجه."
      />

      {methods.length === 0 ? (
        <section className="mt-6 rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-ivory p-6 text-center">
          <p className="text-sm leading-7 text-[var(--ink-60)]">
            لا توجد وسائل دفع محفوظة بعد — ستُضاف بطاقتك تلقائيًّا عند أول عملية شراء أو اشتراك.
          </p>
        </section>
      ) : (
        <div className="mt-6">
          <PaymentMethodsClient methods={methods} />
        </div>
      )}
    </div>
  );
}
