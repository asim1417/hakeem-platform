// اختبار حساب التناسب (المرحلة D) — نقيّ بلا قاعدة.
import { prorateUpgrade, proratePoints, daysBetween } from "@/lib/modules/billing/proration";

let pass = 0,
  fail = 0;
const T = (name: string, cond: boolean) => {
  console.log((cond ? "PASS" : "FAIL") + " :: " + name);
  cond ? pass++ : fail++;
};

// ترقية من 49 إلى 149 ر.س، نصف الدورة متبقٍّ → فرق 100 × 0.5 = 50 ر.س = 5000 هللة
const p1 = prorateUpgrade({ fromTotalHalalas: 4900, toTotalHalalas: 14900, daysRemaining: 15, daysInPeriod: 30 });
T("ترقية منتصف الدورة: 5000 هللة", p1.amountDueHalalas === 5000 && p1.isUpgrade);

// ترقية كامل الدورة متبقٍّ → الفرق كامل 10000
const p2 = prorateUpgrade({ fromTotalHalalas: 4900, toTotalHalalas: 14900, daysRemaining: 30, daysInPeriod: 30 });
T("ترقية بداية الدورة: 10000 هللة", p2.amountDueHalalas === 10000);

// تخفيض → لا مبلغ مستحق
const p3 = prorateUpgrade({ fromTotalHalalas: 14900, toTotalHalalas: 4900, daysRemaining: 15, daysInPeriod: 30 });
T("تخفيض: 0 مستحق وليس ترقية", p3.amountDueHalalas === 0 && !p3.isUpgrade);

// أيام متبقية 0 → 0
const p4 = prorateUpgrade({ fromTotalHalalas: 4900, toTotalHalalas: 14900, daysRemaining: 0, daysInPeriod: 30 });
T("لا أيام متبقية: 0", p4.amountDueHalalas === 0);

// حماية daysRemaining > daysInPeriod
const p5 = prorateUpgrade({ fromTotalHalalas: 4900, toTotalHalalas: 14900, daysRemaining: 99, daysInPeriod: 30 });
T("أيام متبقية > الدورة تُقصّ", p5.amountDueHalalas === 10000);

// نقاط متناسبة: من 500 إلى 2200، نصف الدورة → 1700×0.5 = 850
T("نقاط ترقية منتصف: 850", proratePoints(500, 2200, 15, 30) === 850);
T("نقاط تخفيض: 0", proratePoints(2200, 500, 15, 30) === 0);

// daysBetween
T("daysBetween يوم واحد", daysBetween(new Date("2026-08-01T00:00:00Z"), new Date("2026-08-02T00:00:00Z")) === 1);
T("daysBetween ماضٍ = 0", daysBetween(new Date("2026-08-10"), new Date("2026-08-01")) === 0);

console.log(`\n${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
