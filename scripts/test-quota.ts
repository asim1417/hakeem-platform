// اختبار منطق الحصّة النقيّ (بلا قاعدة) — يُثبت evaluateQuota قبل ربط الوحدات.
import { evaluateQuota } from "@/lib/modules/billing/quota";
import { PRICING } from "@/config/pricing";

let pass = 0, fail = 0;
const T = (name: string, cond: boolean) => { console.log((cond ? "PASS" : "FAIL") + " :: " + name); cond ? pass++ : fail++; };

// مشترك → بلا حدّ
T("مشترك: مسموح بلا حدّ", (() => { const d = evaluateQuota({ subscriptionStatus: "active", freeQuotaUsed: 999, freeQuotaTotal: 20 }); return d.allowed && d.isSubscribed && d.remaining === -1; })());

// حصّة متبقّية
T("متبقٍّ: مسموح", (() => { const d = evaluateQuota({ subscriptionStatus: "free", freeQuotaUsed: 5, freeQuotaTotal: 20 }); return d.allowed && d.remaining === 15; })());

// نفاد تامّ
T("نفاد: محجوب بسبب exhausted", (() => { const d = evaluateQuota({ subscriptionStatus: "free", freeQuotaUsed: 20, freeQuotaTotal: 20 }); return !d.allowed && d.reason === "exhausted" && d.remaining === 0; })());

// total=null ⟶ الحصّة الافتراضية من الإعداد
T("total=null يستخدم الحصّة الافتراضية", (() => { const d = evaluateQuota({ subscriptionStatus: null, freeQuotaUsed: 0, freeQuotaTotal: null }); return d.allowed && d.remaining === PRICING.freeQuota; })());

// used>total (حماية) ⟶ remaining=0 محجوب
T("used>total: محجوب remaining=0", (() => { const d = evaluateQuota({ subscriptionStatus: "free", freeQuotaUsed: 25, freeQuotaTotal: 20 }); return !d.allowed && d.remaining === 0; })());

console.log(`\n${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
