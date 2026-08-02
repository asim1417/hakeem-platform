// بذر الفوترة — HKM-BILLING-UX-001 (المخرج رقم 5).
// idempotent بمعرّفات حتمية (لا تكرار عند إعادة التشغيل). لا يفعّل أي دفع/خصم.
// يشغّل: npm run seed:billing
//
// - الباقات + الأسعار (Prisma): billing_plans / billing_plan_prices
// - أسعار النماذج (Prisma): billing_model_prices
// - أسعار الخدمات + الحزم (v2 خام): usage_service_prices / usage_credit_packages

import { prisma } from "@/lib/prisma";
import { ensureBillingSchema } from "@/lib/modules/billing/ensure-billing-schema";
import { splitVatInclusive, pointsToMilli, vatRateBps } from "@/lib/modules/credits/points";
import {
  SEED_PLANS,
  SEED_PACKAGES,
  SEED_SERVICE_RATES,
  SEED_MODEL_PRICES,
} from "@/config/billing-plans";

async function seedPlans(): Promise<void> {
  const bps = vatRateBps();
  for (const p of SEED_PLANS) {
    const plan = await prisma.plan.upsert({
      where: { code: p.code },
      create: {
        code: p.code,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        description: p.description,
        sortOrder: p.sortOrder,
        monthlyPoints: p.monthlyPoints,
        includedSeats: p.includedSeats,
        entitlements: p.entitlements as unknown as object,
        isActive: true,
      },
      update: {
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        description: p.description,
        sortOrder: p.sortOrder,
        monthlyPoints: p.monthlyPoints,
        includedSeats: p.includedSeats,
        entitlements: p.entitlements as unknown as object,
      },
    });

    // أسعار مؤرّخة بمعرّف حتمي (صف واحد للبذر لكل فترة).
    const periods: Array<{ period: "MONTHLY" | "YEARLY"; total: number | null | undefined }> = [
      { period: "MONTHLY", total: p.monthlyTotalHalalas },
      { period: "YEARLY", total: p.yearlyTotalHalalas },
    ];
    for (const { period, total } of periods) {
      if (total == null) continue; // ENTERPRISE / بلا سعر
      const split = splitVatInclusive(total, bps);
      const id = `seed_${p.code}_${period}`;
      await prisma.planPrice.upsert({
        where: { id },
        create: {
          id,
          planId: plan.id,
          billingPeriod: period,
          currency: "SAR",
          subtotalHalalas: split.subtotalHalalas,
          vatHalalas: split.vatHalalas,
          totalHalalas: split.totalHalalas,
          isActive: true,
        },
        update: {
          subtotalHalalas: split.subtotalHalalas,
          vatHalalas: split.vatHalalas,
          totalHalalas: split.totalHalalas,
          isActive: true,
        },
      });
    }
  }
}

async function seedModelPrices(): Promise<void> {
  for (const m of SEED_MODEL_PRICES) {
    const id = `seed_${m.provider}_${m.model}`;
    await prisma.modelPrice.upsert({
      where: { id },
      create: {
        id,
        provider: m.provider,
        model: m.model,
        inputUsdPerMillion: m.inputUsdPerMillion,
        outputUsdPerMillion: m.outputUsdPerMillion,
        cacheWriteUsdPerMillion: m.cacheWriteUsdPerMillion,
        cacheReadUsdPerMillion: m.cacheReadUsdPerMillion,
        webSearchUsdPerRequest: m.webSearchUsdPerRequest,
        isActive: true,
      },
      update: {
        inputUsdPerMillion: m.inputUsdPerMillion,
        outputUsdPerMillion: m.outputUsdPerMillion,
        cacheWriteUsdPerMillion: m.cacheWriteUsdPerMillion,
        cacheReadUsdPerMillion: m.cacheReadUsdPerMillion,
        webSearchUsdPerRequest: m.webSearchUsdPerRequest,
        isActive: true,
      },
    });
  }
}

async function seedServiceRates(): Promise<void> {
  // usage_service_prices جدول v2 الخام. milliUnits = نقاط × 1000.
  for (const s of SEED_SERVICE_RATES) {
    const milli = Number(pointsToMilli(s.points));
    await prisma.$executeRawUnsafe(
      `INSERT INTO "usage_service_prices"
         ("serviceCode","name","pricingModel","milliUnits","unitSize","active","displayNameAr","displayNameEn","version")
       VALUES ($1,$2,$3,$4,1,true,$5,$6,1)
       ON CONFLICT ("serviceCode") DO UPDATE SET
         "name" = EXCLUDED."name",
         "pricingModel" = EXCLUDED."pricingModel",
         "milliUnits" = EXCLUDED."milliUnits",
         "active" = true,
         "displayNameAr" = EXCLUDED."displayNameAr",
         "displayNameEn" = EXCLUDED."displayNameEn",
         "updatedAt" = NOW()`,
      s.serviceCode,
      s.displayNameAr,
      s.pricingMode,
      milli,
      s.displayNameAr,
      s.displayNameEn
    );
  }
}

async function seedPackages(): Promise<void> {
  // usage_credit_packages جدول v2 الخام. unitsMilli = نقاط × 1000.
  for (const pk of SEED_PACKAGES) {
    const milli = Number(pointsToMilli(pk.points));
    await prisma.$executeRawUnsafe(
      `INSERT INTO "usage_credit_packages"
         ("code","name","unitsMilli","priceHalalas","currency","active","sortOrder")
       VALUES ($1,$2,$3,$4,'SAR',true,$5)
       ON CONFLICT ("code") DO UPDATE SET
         "name" = EXCLUDED."name",
         "unitsMilli" = EXCLUDED."unitsMilli",
         "priceHalalas" = EXCLUDED."priceHalalas",
         "active" = true,
         "sortOrder" = EXCLUDED."sortOrder",
         "updatedAt" = NOW()`,
      pk.code,
      pk.nameAr,
      milli,
      pk.priceHalalas,
      pk.sortOrder
    );
  }
}

async function main(): Promise<void> {
  console.log("[seed:billing] تجهيز المخطط…");
  const ok = await ensureBillingSchema();
  if (!ok) throw new Error("تعذّر تجهيز مخطط الفوترة.");

  console.log("[seed:billing] بذر الباقات والأسعار…");
  await seedPlans();
  console.log("[seed:billing] بذر أسعار النماذج…");
  await seedModelPrices();
  // جداول v2 الخام (usage_service_prices / usage_credit_packages) تُنشأ بهجرة
  // usage_credits_v2. إن لم تُطبَّق بعد، نتخطّى بذرها بتحذير بدل إسقاط البذر كلّه.
  try {
    console.log("[seed:billing] بذر أسعار الخدمات…");
    await seedServiceRates();
    console.log("[seed:billing] بذر حزم النقاط…");
    await seedPackages();
  } catch (e) {
    const msg = (e as Error)?.message || "";
    if (/does not exist|relation .* does not exist|usage_service_prices|usage_credit_packages/i.test(msg)) {
      console.warn(
        "[seed:billing] تخطّي أسعار الخدمات/الحزم — جداول usage_credits_v2 غير مطبَّقة بعد. طبّق هجرة usage_credits_v2 ثم أعد التشغيل."
      );
    } else {
      throw e;
    }
  }

  const [plans, prices, models] = await Promise.all([
    prisma.plan.count(),
    prisma.planPrice.count(),
    prisma.modelPrice.count(),
  ]);
  console.log(
    `[seed:billing] تمّ ✓ — خطط: ${plans} · أسعار خطط: ${prices} · أسعار نماذج: ${models} · خدمات: ${SEED_SERVICE_RATES.length} · حزم: ${SEED_PACKAGES.length}`
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("[seed:billing] فشل:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
