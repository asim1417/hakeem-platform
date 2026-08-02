// مهمة الفوترة الدورية — HKM-BILLING-UX-001 (§18/§8).
// تشغّل المصالحة + التجديد. تُجدوَل يوميًا (cron) أو تُشغَّل يدويًا: npm run billing:cron
import { ensureBillingSchema } from "@/lib/modules/billing/ensure-billing-schema";
import { runReconciliation } from "@/lib/modules/billing/reconciliation";
import { runRenewals } from "@/lib/modules/billing/renewal";

async function main(): Promise<void> {
  await ensureBillingSchema();
  const now = new Date();
  console.log(`[billing:cron] بدء @ ${now.toISOString()}`);

  const recon = await runReconciliation(now);
  console.log("[billing:cron] المصالحة:", JSON.stringify(recon));

  const renew = await runRenewals(now);
  console.log("[billing:cron] التجديد:", JSON.stringify(renew));

  console.log("[billing:cron] تمّ.");
}

main()
  .then(async () => {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("[billing:cron] فشل:", e);
    process.exit(1);
  });
