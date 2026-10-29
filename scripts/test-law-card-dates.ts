/**
 * HKM-063: اختبارات نقية لتواريخ بطاقة النظام (law-card-dates) وقاعدة الحكم الباقي (verified-status).
 * الحالات من قراءة الإنتاج 29/10/2026 (قراءة فقط): نظام الشركات، تنظيم المجلس الأعلى لشؤون البترول والمعادن،
 * نظام صندوق الاستثمارات العامة (م/24) طبعته القديمة، نظام مكافحة التستر (1 محرم حقيقي)، ونظام نقابة السيارات.
 */
import {
  cardDatePlaceholders,
  hijriParts,
  isMuharramFirst,
  isPlaceholderEffectiveDate,
  isPlausibleGregorian,
  pickEffectiveDate,
  type CardDates,
} from "../lib/modules/legal-core/law-card-dates";
import { isRetainedProvision, RETAINED_PROVISIONS_STATUS } from "../lib/modules/legal-core/verified-status";

let failed = 0;
let passed = 0;
const ok = (c: boolean, m: string) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  if (c) passed++;
  else failed++;
};
const card = (ih: string | null, ig: string | null, ph: string | null, pg: string | null): CardDates => ({ issuedHijri: ih, issuedGregorian: ig, publishedHijri: ph, publishedGregorian: pg });

// ── أدوات ──
ok(isMuharramFirst("1420/01/01") && isMuharramFirst("1372/1/1") && isMuharramFirst("1391/01/01هـ"), "D-1 1 محرم بصيغه (01/01، 1/1، مع هـ)");
ok(!isMuharramFirst("1420/01/11") && !isMuharramFirst("1420/10/01") && !isMuharramFirst(null) && !isMuharramFirst(""), "D-1 غير 1 محرم (11 محرم، 1 شوال، فارغ)");
ok(JSON.stringify(hijriParts("1443/5/26")) === "[1443,5,26]" && hijriParts("2022-01-07") === null && hijriParts(null) === null, "D-1 تفكيك التاريخ الهجري");
ok(isPlausibleGregorian("2023-01-19") && isPlausibleGregorian("1900-01-01"), "D-2 ميلادي معقول");
ok(!isPlausibleGregorian("1391-06-25") && !isPlausibleGregorian("1899-12-31") && !isPlausibleGregorian("2023-1-19") && !isPlausibleGregorian(null), "D-2 سنة < 1900 (هجري في عمود ميلادي) أو صيغة خاطئة: غير معقول");

// ── تواريخ البطاقة النائبة ──
const companies = card("1443/12/01", "2022-06-30", "1443/12/23", "2022-07-22");
ok(JSON.stringify(cardDatePlaceholders(companies)) === '{"issued":false,"published":false}', "P-1 نظام الشركات: تاريخان حقيقيان");
const pair = card("1372/01/01", "1952-09-20", "1372/01/01", "1952-09-20");
ok(JSON.stringify(cardDatePlaceholders(pair)) === '{"issued":true,"published":true}', "P-2 (أ) الإصدار والنشر 1 محرم من سنة واحدة: كلاهما مجهول (نظام نقابة السيارات)");
ok(cardDatePlaceholders(card("1372/1/1", null, "1372/01/01", null)).issued, "P-2 (أ) بصيغة 1/1 أيضًا");
ok(!cardDatePlaceholders(card("1371/01/01", null, "1372/01/01", null)).issued, "P-2 (أ) سنتان مختلفتان: ليس الزوج النائب");
const petroleum = card("1420/09/27", "2000-01-04", "1420/01/01", "1999-04-17");
ok(JSON.stringify(cardDatePlaceholders(petroleum)) === '{"issued":false,"published":true}', "P-3 (ب) البترول والمعادن: نشر 1420/01/01 يسبق الإصدار 1420/09/27 ← النشر مجهول والإصدار باقٍ");
const pif = card("1391/06/25", "1971-08-17", "1391/01/01", "1971-02-26");
ok(JSON.stringify(cardDatePlaceholders(pif)) === '{"issued":false,"published":true}', "P-3 (ب) صندوق الاستثمارات العامة (م/24): النشر مجهول");
ok(!cardDatePlaceholders(card("1419/12/20", null, "1420/01/01", null)).published, "P-3 (ب) نشر 1 محرم بعد الإصدار: يبقى");
const tasattur = card("1442/01/01", "2020-08-20", "1442/01/09", "2020-08-28");
ok(JSON.stringify(cardDatePlaceholders(tasattur)) === '{"issued":false,"published":false}', "P-4 مكافحة التستر: إصدار 1 محرم حقيقي ونشر بعده — لا يُمس");
const upload = card("1409/08/20", "1989-03-27", "1440/03/21", "2018-11-29");
ok(JSON.stringify(cardDatePlaceholders(upload)) === '{"issued":false,"published":true}', "P-5 (ج) نشر 1440/03/21 (رفع الهيئة) لنظام صدر 1409: النشر مجهول");
ok(!cardDatePlaceholders(card("1440/03/10", null, "1440/03/21", null)).published && !cardDatePlaceholders(card(null, null, "1440/03/21", null)).published, "P-5 (ج) صدر في 1440 أو بلا تاريخ إصدار: يبقى");
ok(JSON.stringify(cardDatePlaceholders(null)) === '{"issued":false,"published":false}' && !cardDatePlaceholders(card(null, null, null, null)).published, "P-6 بلا بطاقة أو بلا تواريخ: لا نائب");

// ── تاريخ النفاذ ──
ok(isPlaceholderEffectiveDate("1952-09-20", pair), "E-1 النفاذ المخزّن = الإصدار الميلادي وإصداره 1 محرم: نائب");
ok(isPlaceholderEffectiveDate("1999-04-17", petroleum), "E-1 النفاذ المخزّن = نشر نائب (البترول 1999-04-17): نائب");
ok(!isPlaceholderEffectiveDate("1971-08-20", pif) && !isPlaceholderEffectiveDate("2023-01-19", companies), "E-1 النفاذ المصحّح (الصندوق 1971-08-20، الشركات 2023-01-19): ليس نائبًا");
ok(!isPlaceholderEffectiveDate("2021-02-24", tasattur), "E-1 التستر: إصداره 1 محرم لكن النفاذ المخزّن غيره: ليس نائبًا");
ok(isPlaceholderEffectiveDate("2020-08-20", tasattur), "E-1 قاعدة الأمر حرفيًا: إصدار 1 محرم والنفاذ = الإصدار الميلادي ← نائب");
ok(isPlaceholderEffectiveDate("2018-11-29", upload) && !isPlaceholderEffectiveDate("1989-08-17", upload), "E-1 النفاذ = تاريخ الرفع: نائب؛ وغيره باقٍ");
ok(!isPlaceholderEffectiveDate("1952-09-20", null) && !isPlaceholderEffectiveDate(null, pair), "E-1 بلا بطاقة أو بلا نفاذ: ليس نائبًا");

const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
ok(eq(pickEffectiveDate({ stored: "2023-01-19", surfaceFrom: null, card: companies }), { gregorian: "2023-01-19", source: "legal_systems" }), "E-2 الشركات بلا وجه بحث: 2023-01-19 من legal_systems");
ok(eq(pickEffectiveDate({ stored: "2023-01-19", surfaceFrom: "2022-07-08", card: companies }), { gregorian: "2023-01-19", source: "legal_systems" }), "E-2 legal_systems مقدَّم على وجه البحث");
ok(eq(pickEffectiveDate({ stored: "1971-08-20", surfaceFrom: "1391-06-25", card: pif }), { gregorian: "1971-08-20", source: "legal_systems" }), "E-2 الصندوق (م/24): 1971-08-20 لا 1391-06-25");
ok(eq(pickEffectiveDate({ stored: null, surfaceFrom: "1422-08-06", card: null }), { gregorian: null, source: null }), "E-3 بلا مخزّن ووجه البحث هجري في عمود ميلادي (1422-08-06): فارغ");
ok(eq(pickEffectiveDate({ stored: null, surfaceFrom: "2022-07-08", card: null }), { gregorian: "2022-07-08", source: "search_surface" }), "E-3 بلا مخزّن: وجه البحث المعقول كما كان");
ok(eq(pickEffectiveDate({ stored: "1999-04-17", surfaceFrom: null, card: petroleum }), { gregorian: null, source: null }), "E-4 البترول: النفاذ المخزّن نائب ولا وجه بحث ← فارغ");
ok(eq(pickEffectiveDate({ stored: "1952-09-20", surfaceFrom: "1990-01-01", card: pair }), { gregorian: "1990-01-01", source: "search_surface" }), "E-4 المخزّن نائب ← وجه البحث المعقول");
ok(eq(pickEffectiveDate({ stored: "1391-06-25", surfaceFrom: null, card: null }), { gregorian: null, source: null }), "E-4 المخزّن نفسه بسنة < 1900: لا يُعرض");
ok(eq(pickEffectiveDate({ stored: "2023-01-19 00:00:00", surfaceFrom: null, card: null }), { gregorian: "2023-01-19", source: "legal_systems" }), "E-4 طابع زمني يُقصّ إلى اليوم");
ok(eq(pickEffectiveDate({ stored: null, surfaceFrom: null, card: null }), { gregorian: null, source: null }), "E-5 لا مصدر: فارغ");

// ── الحكم الباقي ──
ok(isRetainedProvision(RETAINED_PROVISIONS_STATUS, "ساري"), "R-1 «ملغى مع بقاء أحكام محددة مؤقتًا» + سجل المادة «ساري»: سارية");
ok(!isRetainedProvision(RETAINED_PROVISIONS_STATUS, null) && !isRetainedProvision(RETAINED_PROVISIONS_STATUS, "مضافة") && !isRetainedProvision(RETAINED_PROVISIONS_STATUS, "ملغاة"), "R-1 بلا سجل أو بسجل غير «ساري»: ملغاة بالتبعية كما كانت");
ok(!isRetainedProvision("ملغى", "ساري") && !isRetainedProvision("مستبدل", "ساري") && !isRetainedProvision(null, "ساري"), "R-1 نظام «ملغى» أو «مستبدل»: القاعدة لا تنطبق");

console.log(`\n${passed} نجح، ${failed} فشل`);
if (failed) process.exit(1);
