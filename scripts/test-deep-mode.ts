// اختبار منطق المظانّ (المرحلة ٩) — حتمي خالص، بلا server-only/قاعدة.
import { rankGoverningSystems, inferSpecialization } from "../lib/modules/agents/thinking/mazann";
import type { LegalCoreResult } from "../lib/modules/legal-core/legal-retrieval";
let ok = 0, fail = 0;
const t = (c: boolean, m: string) => { console.log(`${c ? "✓" : "✗"} ${m}`); c ? ok++ : fail++; };

const mk = (systemName: string): LegalCoreResult => ({ systemName } as unknown as LegalCoreResult);
const arts = [mk("نظام المعاملات المدنية"), mk("نظام المعاملات المدنية"), mk("نظام الشركات")];
const gov = rankGoverningSystems(arts, inferSpecialization("نزاع حصص شركة"));

t(inferSpecialization("نزاع حصص شركة") === "commercial", "استنتاج التخصّص التجاري");
t(gov[0].systemName === "نظام الشركات", `الخاصّ (الشركات) يتصدّر العامّ رغم تكراره الأقل: ${gov[0].systemName}`);
t(gov[0].scope === "special" && gov.some((g) => g.scope === "general"), "تصنيف الخاصّ/العامّ صحيح");
t(gov.find((g) => g.systemName.includes("المدنية"))?.scope === "general", "المعاملات المدنية = عامّ");

console.log(`\nنتيجة: ${ok} نجح، ${fail} فشل`);
if (fail) process.exit(1);
