// اختبار نافذة تحديد المعدّل (نقيّ) — HKM-BILLING-UX-001 (§14).
import { rateLimitWindowStart } from "@/lib/modules/billing/rate-window";

let pass = 0,
  fail = 0;
const T = (name: string, cond: boolean) => {
  console.log((cond ? "PASS" : "FAIL") + " :: " + name);
  cond ? pass++ : fail++;
};

T("نافذة 60ث: 125 → 120", rateLimitWindowStart(125, 60) === 120);
T("نافذة 60ث: 179 → 120", rateLimitWindowStart(179, 60) === 120);
T("نافذة 60ث: 180 → 180", rateLimitWindowStart(180, 60) === 180);
T("نافذة 1ث: أي ثانية = نفسها", rateLimitWindowStart(12345, 1) === 12345);
T("نافذة 0 تُعامل كـ1", rateLimitWindowStart(999, 0) === 999);
T("نفس النافذة لطلبين متقاربين", rateLimitWindowStart(121, 60) === rateLimitWindowStart(155, 60));
T("نافذتان مختلفتان عبر الحدّ", rateLimitWindowStart(119, 60) !== rateLimitWindowStart(121, 60));

console.log(`\n${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
