// اختبارات أساس الفوترة النقيّة (بلا قاعدة بيانات) — HKM-BILLING-UX-001 (المرحلة 0).
// تُثبت: تحويل النقاط، حساب الضريبة، تحقق webhook (HMAC/سرّ)، وسلامة كتالوج البذر.
import crypto from "crypto";
import {
  pointsToMilli,
  milliToPoints,
  milliToWholePoints,
  milliPerPoint,
  sarToHalalas,
  splitVatInclusive,
  addVatToSubtotal,
} from "@/lib/modules/credits/points";
import {
  SEED_PLANS,
  SEED_PACKAGES,
  SEED_SERVICE_RATES,
  SEED_MODEL_PRICES,
} from "@/config/billing-plans";
import { MoyasarProvider } from "@/lib/payments/providers/moyasar";

let pass = 0,
  fail = 0;
const T = (name: string, cond: boolean) => {
  console.log((cond ? "PASS" : "FAIL") + " :: " + name);
  cond ? pass++ : fail++;
};

// ── تحويل النقاط ──
T("milliPerPoint افتراضي = 1000", milliPerPoint() === 1000);
T("pointsToMilli(5) = 5000n", pointsToMilli(5) === 5000n);
T("pointsToMilli(0.5) = 500n", pointsToMilli(0.5) === 500n);
T("milliToPoints(5000) = 5", milliToPoints(5000) === 5);
T("milliToPoints(2500) = 2.5", milliToPoints(2500) === 2.5);
T("milliToWholePoints(2500) = 2 (نزولًا)", milliToWholePoints(2500) === 2);
T("roundtrip نقاط↔milli", milliToPoints(Number(pointsToMilli(2200))) === 2200);

// ── الأموال بالهللات ──
T("sarToHalalas(49) = 4900", sarToHalalas(49) === 4900);
T("sarToHalalas(149) = 14900", sarToHalalas(149) === 14900);
T("sarToHalalas(0.1) = 10", sarToHalalas(0.1) === 10);

// ── تقسيم الضريبة (شامل → صافٍ + ضريبة) ──
const v49 = splitVatInclusive(4900, 1500);
T("VAT 49ر.س: المجموع محفوظ", v49.subtotalHalalas + v49.vatHalalas === 4900);
T("VAT 49ر.س: صافٍ = 4261", v49.subtotalHalalas === 4261);
T("VAT 49ر.س: ضريبة = 639", v49.vatHalalas === 639);
const v149 = splitVatInclusive(14900, 1500);
T("VAT 149ر.س: المجموع محفوظ", v149.subtotalHalalas + v149.vatHalalas === 14900);
T("VAT 149ر.س: صافٍ = 12957", v149.subtotalHalalas === 12957);
const v499 = splitVatInclusive(49900, 1500);
T("VAT 499ر.س: المجموع محفوظ", v499.subtotalHalalas + v499.vatHalalas === 49900);
T("VAT صفر: كله أصفار", (() => { const z = splitVatInclusive(0, 1500); return z.subtotalHalalas === 0 && z.vatHalalas === 0; })());
// addVatToSubtotal: بناء من الصافي
const add = addVatToSubtotal(4261, 1500);
T("addVatToSubtotal(4261,1500).total = 4900", add.totalHalalas === 4900);

// ── تحقق webhook (HMAC + سرّ مشترك) ──
process.env.MOYASAR_WEBHOOK_SECRET = "test_secret_123";
const provider = new MoyasarProvider();
const rawPaid = JSON.stringify({ id: "evt_1", type: "payment_paid", data: { id: "pay_1", status: "paid", amount: 4900, currency: "SAR", metadata: { orderId: "ord_1" } } });

// سرّ مشترك صحيح في الجسم
const rawWithToken = JSON.stringify({ id: "evt_2", secret_token: "test_secret_123", data: { id: "pay_2", status: "paid" } });
T("webhook: سرّ مشترك صحيح → valid", provider.verifyWebhook(rawWithToken, {}).valid === true);
const rawWrongToken = JSON.stringify({ id: "evt_3", secret_token: "wrong", data: { id: "pay_3" } });
T("webhook: سرّ مشترك خاطئ → invalid", provider.verifyWebhook(rawWrongToken, {}).valid === false);

// HMAC صحيح عبر الترويسة
const hmac = crypto.createHmac("sha256", "test_secret_123").update(rawPaid, "utf8").digest("hex");
T("webhook: HMAC صحيح → valid", provider.verifyWebhook(rawPaid, { "x-moyasar-signature": hmac }).valid === true);
T("webhook: HMAC صحيح مع بادئة sha256= → valid", provider.verifyWebhook(rawPaid, { "x-moyasar-signature": "sha256=" + hmac }).valid === true);
T("webhook: HMAC خاطئ → invalid", provider.verifyWebhook(rawPaid, { "x-moyasar-signature": "deadbeef" }).valid === false);
T("webhook: طريقة hmac عند وجود ترويسة", provider.verifyWebhook(rawPaid, { "x-moyasar-signature": hmac }).method === "hmac");

// بلا سرّ مضبوط → غير مُنفَّذ (enforced=false)
delete process.env.MOYASAR_WEBHOOK_SECRET;
const noSecret = provider.verifyWebhook(rawPaid, {});
T("webhook: بلا سرّ → enforced=false, valid=false", noSecret.enforced === false && noSecret.valid === false);

// ── parseWebhook ──
const parsed = provider.parseWebhook(rawPaid);
T("parseWebhook: paymentId من data.id", parsed?.paymentId === "pay_1");
T("parseWebhook: status = paid", parsed?.status === "paid");
T("parseWebhook: amount = 4900", parsed?.amountHalalas === 4900);
T("parseWebhook: metadata.orderId", (parsed?.metadata as { orderId?: string })?.orderId === "ord_1");
T("parseWebhook: جسم غير صالح → null", provider.parseWebhook("{not json") === null);

// ── سلامة كتالوج البذر ──
T("خطط: 5", SEED_PLANS.length === 5);
T("خطط: أكواد فريدة", new Set(SEED_PLANS.map((p) => p.code)).size === 5);
T("خطط: FREE موجودة بـ100 نقطة", SEED_PLANS.some((p) => p.code === "FREE" && p.monthlyPoints === 100));
T("خطط: INDIVIDUAL 500 نقطة / 4900 هللة", SEED_PLANS.some((p) => p.code === "INDIVIDUAL" && p.monthlyPoints === 500 && p.monthlyTotalHalalas === 4900));
T("خطط: PROFESSIONAL 2200 / 14900", SEED_PLANS.some((p) => p.code === "PROFESSIONAL" && p.monthlyPoints === 2200 && p.monthlyTotalHalalas === 14900));
T("خطط: OFFICE 9000 / 49900 / 5 مقاعد", SEED_PLANS.some((p) => p.code === "OFFICE" && p.monthlyPoints === 9000 && p.monthlyTotalHalalas === 49900 && p.includedSeats === 5));
T("خطط: ENTERPRISE عرض سعر (total=null)", SEED_PLANS.some((p) => p.code === "ENTERPRISE" && p.monthlyTotalHalalas === null && p.isQuoteOnly === true));

T("حزم: 3", SEED_PACKAGES.length === 3);
T("حزم: 250@2900 · 700@6900 · 1600@13900", (() => {
  const byCode = Object.fromEntries(SEED_PACKAGES.map((p) => [p.code, p]));
  return byCode.PACK_250.points === 250 && byCode.PACK_250.priceHalalas === 2900 &&
    byCode.PACK_700.points === 700 && byCode.PACK_700.priceHalalas === 6900 &&
    byCode.PACK_1600.points === 1600 && byCode.PACK_1600.priceHalalas === 13900;
})());

T("خدمات: 12 سعرًا", SEED_SERVICE_RATES.length === 12);
T("خدمات: ASK_QUICK=5", SEED_SERVICE_RATES.some((s) => s.serviceCode === "ASK_QUICK" && s.points === 5));
T("خدمات: JUDGE_SIMULATION=40", SEED_SERVICE_RATES.some((s) => s.serviceCode === "JUDGE_SIMULATION" && s.points === 40));
T("خدمات: OPUS_SURCHARGE=25 (SURCHARGE)", SEED_SERVICE_RATES.some((s) => s.serviceCode === "OPUS_SURCHARGE" && s.points === 25 && s.pricingMode === "SURCHARGE"));
T("خدمات: كل النقاط موجبة", SEED_SERVICE_RATES.every((s) => s.points > 0));
T("خدمات: milliUnits = نقاط×1000", SEED_SERVICE_RATES.every((s) => Number(pointsToMilli(s.points)) === s.points * 1000));

T("نماذج: تشمل sonnet/opus/haiku", (() => {
  const models = SEED_MODEL_PRICES.map((m) => m.model);
  return models.some((m) => m.includes("sonnet")) && models.some((m) => m.includes("opus")) && models.some((m) => m.includes("haiku"));
})());
T("نماذج: opus أغلى من haiku (input)", (() => {
  const opus = SEED_MODEL_PRICES.find((m) => m.model.includes("opus"));
  const haiku = SEED_MODEL_PRICES.find((m) => m.model.includes("haiku"));
  return !!opus && !!haiku && opus.inputUsdPerMillion > haiku.inputUsdPerMillion;
})());

console.log(`\n${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
