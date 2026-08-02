// اختبار تجزئة هوية التجربة (المرحلة E) — نقيّ.
import { trialIdentityHash } from "@/lib/modules/billing/trial-identity";

let pass = 0,
  fail = 0;
const T = (name: string, cond: boolean) => {
  console.log((cond ? "PASS" : "FAIL") + " :: " + name);
  cond ? pass++ : fail++;
};

T("نفس البريد → نفس التجزئة", trialIdentityHash("A@X.com") === trialIdentityHash("a@x.com"));
T("مسافات تُقصّ", trialIdentityHash("  a@x.com  ") === trialIdentityHash("a@x.com"));
T("بريدان مختلفان → تجزئتان مختلفتان", trialIdentityHash("a@x.com") !== trialIdentityHash("b@x.com"));
T("جوال بصيغ مختلفة → نفس التجزئة", trialIdentityHash(null, "+966 50 123 4567") === trialIdentityHash(null, "0501234567".replace(/^0/, "966")));
T("جوال منسّق = أرقامه", trialIdentityHash(null, "966-50-123-4567") === trialIdentityHash(null, "966501234567"));
T("البريد له أولوية على الجوال", trialIdentityHash("a@x.com", "966501234567") === trialIdentityHash("a@x.com", "966999999999"));
T("تجزئة ثابتة الطول (64 hex)", /^[0-9a-f]{64}$/.test(trialIdentityHash("a@x.com")));

console.log(`\n${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
