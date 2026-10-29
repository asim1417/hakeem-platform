/**
 * HKM-063: اختبارات نقية لتواريخ بطاقة النظام (law-card-dates) وقاعدة الحكم الباقي (verified-status).
 * الحالات من قراءة الإنتاج 29/10/2026 (قراءة فقط): نظام الشركات، تنظيم المجلس الأعلى لشؤون البترول والمعادن،
 * نظام صندوق الاستثمارات العامة (م/24) طبعته القديمة، نظام مكافحة التستر (1 محرم حقيقي)، ونظام نقابة السيارات.
 * HKM-064: الإصدار بمصادره التالية (pickIssuedDate) في /law وhakeem_get_article وبطاقة /legal، ونفاذ الخلف الموثّق.
 */
import fs from "node:fs";
import {
  backedEffectiveDate,
  cardDatePlaceholders,
  hijriParts,
  issuedDateFallback,
  pickIssuedDate,
  isMuharramFirst,
  isPlaceholderEffectiveDate,
  isPlausibleGregorian,
  pickEffectiveDate,
  type CardDates,
} from "../lib/modules/legal-core/law-card-dates";
import { isRetainedProvision, RETAINED_PROVISIONS_STATUS } from "../lib/modules/legal-core/verified-status";
import { dateLine, lawCardDateLines, needsIssuedFallback } from "../components/legal/law-card-date-lines";
import { articleIssuance, issuanceFromCard } from "../lib/mcp/tools/article-issuance";

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
ok(eq(pickEffectiveDate({ storedBacked: true, stored: "2023-01-19", surfaceFrom: null, card: companies }), { gregorian: "2023-01-19", source: "legal_systems" }), "E-2 الشركات بلا وجه بحث: 2023-01-19 من legal_systems");
ok(eq(pickEffectiveDate({ storedBacked: true, stored: "2023-01-19", surfaceFrom: "2022-07-08", card: companies }), { gregorian: "2023-01-19", source: "legal_systems" }), "E-2 legal_systems مقدَّم على وجه البحث");
ok(eq(pickEffectiveDate({ storedBacked: true, stored: "1971-08-20", surfaceFrom: "1391-06-25", card: pif }), { gregorian: "1971-08-20", source: "legal_systems" }), "E-2 الصندوق (م/24): 1971-08-20 لا 1391-06-25");
ok(eq(pickEffectiveDate({ storedBacked: true, stored: null, surfaceFrom: "1422-08-06", card: null }), { gregorian: null, source: null }), "E-3 بلا مخزّن ووجه البحث هجري في عمود ميلادي (1422-08-06): فارغ");
ok(eq(pickEffectiveDate({ storedBacked: true, stored: null, surfaceFrom: "2022-07-08", card: null }), { gregorian: "2022-07-08", source: "search_surface" }), "E-3 بلا مخزّن: وجه البحث المعقول كما كان");
ok(eq(pickEffectiveDate({ storedBacked: true, stored: "1999-04-17", surfaceFrom: null, card: petroleum }), { gregorian: null, source: null }), "E-4 البترول: النفاذ المخزّن نائب ولا وجه بحث ← فارغ");
ok(eq(pickEffectiveDate({ storedBacked: true, stored: "1952-09-20", surfaceFrom: "1990-01-01", card: pair }), { gregorian: "1990-01-01", source: "search_surface" }), "E-4 المخزّن نائب ← وجه البحث المعقول");
ok(eq(pickEffectiveDate({ storedBacked: true, stored: "1391-06-25", surfaceFrom: null, card: null }), { gregorian: null, source: null }), "E-4 المخزّن نفسه بسنة < 1900: لا يُعرض");
ok(eq(pickEffectiveDate({ storedBacked: true, stored: "2023-01-19 00:00:00", surfaceFrom: null, card: null }), { gregorian: "2023-01-19", source: "legal_systems" }), "E-4 طابع زمني يُقصّ إلى اليوم");
ok(eq(pickEffectiveDate({ storedBacked: true, stored: null, surfaceFrom: null, card: null }), { gregorian: null, source: null }), "E-5 لا مصدر: فارغ");
// قرار #961: المخزّن لا يُعرض إلا بسند provenance.
ok(eq(pickEffectiveDate({ storedBacked: true, stored: "2023-01-19", surfaceFrom: "2022-07-08", card: companies }), { gregorian: "2023-01-19", source: "legal_systems" }), "E-6 مخزّن بسند: يُعرض ويُقدَّم على وجه البحث");
ok(eq(pickEffectiveDate({ storedBacked: false, stored: "2023-01-19", surfaceFrom: "2022-07-08", card: companies }), { gregorian: "2022-07-08", source: "search_surface" }), "E-6 مخزّن بلا سند: لا يُعرض، ويسقط إلى وجه البحث المعقول");
ok(eq(pickEffectiveDate({ storedBacked: false, stored: "2023-06-18", surfaceFrom: null, card: null }), { gregorian: null, source: null }), "E-6 مخزّن بلا سند ولا وجه: فارغ (كالسلوك السابق)");
ok(eq(pickEffectiveDate({ storedBacked: false, stored: "2023-06-18", surfaceFrom: "1391-06-25", card: null }), { gregorian: null, source: null }), "E-6 مخزّن بلا سند ووجه هجري: فارغ");
ok(eq(pickEffectiveDate({ storedBacked: false, stored: "1999-04-17", surfaceFrom: null, card: petroleum }), { gregorian: null, source: null }), "E-6 مخزّن نائب بلا سند (البترول): لا يُعرض");
ok(eq(pickEffectiveDate({ storedBacked: true, stored: "1999-04-17", surfaceFrom: null, card: petroleum }), { gregorian: null, source: null }), "E-6 مخزّن نائب ولو بسند: لا يُعرض");

// ── سطرا البطاقة في صفحة /legal (LawCardPanel) ──
ok(eq(lawCardDateLines(companies), { issued: "1443/12/01 هـ الموافق: 30/06/2022 م", published: "1443/12/23 هـ الموافق: 22/07/2022 م" }), "L-1 الشركات: السطران كما كانا حرفًا");
ok(eq(lawCardDateLines(petroleum), { issued: "1420/09/27 هـ الموافق: 04/01/2000 م", published: null }), "L-2 البترول: صف النشر النائب (1420/01/01) لا يُعرض، والإصدار باقٍ");
ok(eq(lawCardDateLines(pair), { issued: null, published: null }), "L-2 الزوج النائب (1372/01/01): لا صف إصدار ولا نشر");
ok(eq(lawCardDateLines(upload), { issued: "1409/08/20 هـ الموافق: 27/03/1989 م", published: null }), "L-2 نشر 1440/03/21 لنظام 1409: لا صف نشر");
ok(eq(lawCardDateLines(tasattur), { issued: "1442/01/01 هـ الموافق: 20/08/2020 م", published: "1442/01/09 هـ الموافق: 28/08/2020 م" }), "L-3 التستر (1 محرم حقيقي): يُعرض");
ok(eq(lawCardDateLines(null), { issued: null, published: null }) && eq(lawCardDateLines(card(null, null, "1443/12/23", null)), { issued: null, published: "1443/12/23 هـ" }), "L-4 بلا بطاقة: لا صفوف؛ وتاريخ هجري وحده يُعرض بلا «الموافق»");
ok(dateLine(null, null) === null && dateLine(null, "2022-07-22") === "الموافق: 22/07/2022 م", "L-4 dateLine كما كان في المكوّن");

// ── HKM-064: الإصدار بمصادره التالية (ترتيب صفحة /law) ──
const fbPre = { preambleHijri: "1443/5/26", issuanceHijri: "1400/02/02", issuanceGregorian: null };
const fbIss = { preambleHijri: null, issuanceHijri: "1372/03/15", issuanceGregorian: "1952-12-04" };
const fbNone = { preambleHijri: null, issuanceHijri: null, issuanceGregorian: null };
ok(eq(pickIssuedDate(companies, fbPre), { hijri: "1443/12/01", gregorian: "2022-06-30", source: "law_card" }), "I-1 بطاقة حقيقية: من البطاقة ولو وُجدت مصادر تالية");
ok(eq(pickIssuedDate(petroleum, fbIss), { hijri: "1420/09/27", gregorian: "2000-01-04", source: "law_card" }), "I-1 نشر نائب وإصدار حقيقي (البترول): الإصدار من البطاقة");
ok(eq(pickIssuedDate(pair, fbPre), { hijri: "1443/5/26", gregorian: null, source: "preamble_units" }), "I-2 الزوج النائب: وحدات المقدمة أولًا");
ok(eq(pickIssuedDate(pair, fbIss), { hijri: "1372/03/15", gregorian: "1952-12-04", source: "legal_system_issuance" }), "I-2 الزوج النائب بلا مقدمة: legal_system_issuance");
ok(eq(pickIssuedDate(pair, fbNone), { hijri: null, gregorian: null, source: null }) && eq(pickIssuedDate(pair, null), { hijri: null, gregorian: null, source: null }), "I-2 الزوج النائب بلا مصدر تالٍ (نقابة السيارات): فارغ لا 1372/01/01");
ok(eq(pickIssuedDate(null, fbIss), { hijri: "1372/03/15", gregorian: "1952-12-04", source: "legal_system_issuance" }) && eq(pickIssuedDate(card(null, null, "1443/12/23", null), fbPre).source, "preamble_units"), "I-3 بلا بطاقة أو بطاقة بلا تاريخ إصدار: المصادر التالية");
ok(eq(issuedDateFallback({ preambleHijri: null, issuanceHijri: null, issuanceGregorian: "2007-05-27" }), { hijri: null, gregorian: "2007-05-27", source: "legal_system_issuance" }), "I-3 legal_system_issuance بميلادي وحده");
ok(needsIssuedFallback(pair) && needsIssuedFallback(null) && !needsIssuedFallback(companies) && !needsIssuedFallback(tasattur), "I-4 needsIssuedFallback: لا بطاقة أو تاريخها نائب فقط");
// بطاقة /legal: السطر يسقط إلى المصادر التالية بدل الإخفاء.
ok(eq(lawCardDateLines(pair, fbIss), { issued: "1372/03/15 هـ الموافق: 04/12/1952 م", published: null }), "L-5 /legal الزوج النائب: صف الإصدار من legal_system_issuance، والنشر النائب مخفي");
ok(eq(lawCardDateLines(pair, fbPre), { issued: "1443/5/26 هـ", published: null }), "L-5 /legal الزوج النائب ومقدمة: صف الإصدار من وحدات المقدمة");
ok(eq(lawCardDateLines(null, fbIss), { issued: "1372/03/15 هـ الموافق: 04/12/1952 م", published: null }), "L-5 /legal بلا بطاقة: صف الإصدار من legal_system_issuance");
ok(eq(lawCardDateLines(null, { preambleHijri: null, issuanceHijri: "16/3/1444هـ", issuanceGregorian: "2022-10-12" }), { issued: "16/3/1444 هـ الموافق: 12/10/2022 م", published: null }), "L-5 /legal هجري legal_system_issuance بـ«هـ» ملصقة (الأدلة الإجرائية لنظام الإثبات): لا تتكرر «هـ»");
ok(eq(lawCardDateLines(companies, fbIss), lawCardDateLines(companies)) && eq(lawCardDateLines(pair, fbNone), { issued: null, published: null }), "L-5 بطاقة حقيقية لا تتأثر، والنائب بلا مصدر يبقى مخفيًا");
// hakeem_get_article (نقي): البطاقة النائبة كما يقرؤها loadLawCardIssuance.
const naqaba = { issued_hijri: "1372/01/01", issued_gregorian: "1952-09-20", published_hijri: "1372/01/01", published_gregorian: "1952-09-20", instruments: [] };
ok(articleIssuance(null, naqaba).issuedDateH === null, "A-1 نقابة السيارات: issued_date_h = null لا 1372/01/01");
ok(articleIssuance(null, { ...naqaba, fallback: fbIss }).issuedDateH === "1372/03/15" && articleIssuance(null, { ...naqaba, fallback: fbPre }).issuedDateH === "1443/5/26", "A-1 النائب يسقط إلى مصادر الصفحة (المقدمة ← legal_system_issuance)");
ok(issuanceFromCard({ issued_hijri: null, instruments: [], fallback: fbIss }).issuedDateH === "1372/03/15", "A-2 بلا بطاقة (صف المصادر وحدها): legal_system_issuance");
ok(issuanceFromCard({ issued_hijri: "1443/12/01", instruments: [], published_hijri: "1443/12/23", fallback: fbIss }).issuedDateH === "1443/12/01", "A-2 بطاقة حقيقية: تاريخها لا المصادر التالية");
ok(issuanceFromCard({ issued_hijri: null, instruments: [{ text: "مرسوم ملكي رقم (م/43) وتاريخ 1443/5/26هـ" }], fallback: fbIss }).issuedDateH?.includes("1443") === true, "A-2 HKM-053 باقٍ: بطاقة بلا تاريخ إصدار ← من نص أول أداة قبل المصادر التالية");
// النفاذ الموثّق للخلف.
ok(backedEffectiveDate({ stored: "2022-08-11", storedBacked: true, card: card("1443/09/19", "2022-04-20", "1443/10/12", "2022-05-13") }) === "2022-08-11", "B-1 نفاذ الخلف بسند: يُعتمد (التسجيل العيني 2022-08-11)");
ok(backedEffectiveDate({ stored: "2025-09-01", storedBacked: false, card: null }) === null && backedEffectiveDate({ stored: null, storedBacked: true, card: null }) === null, "B-1 بلا سند أو بلا مخزّن: null (لا سقوط إلى وجه البحث)");
ok(backedEffectiveDate({ stored: "1952-09-20", storedBacked: true, card: pair }) === null && backedEffectiveDate({ stored: "1391-06-25", storedBacked: true, card: null }) === null, "B-1 نائب أو سنة < 1900: null");

// ── HKM-064: الربط في الصفحات (مصدر الكود): البطاقة تمرّر المصادر التالية، والشريط يقرأ عنوانه من الدالة النقية ──
const legalPage = fs.readFileSync("app/legal/[slug]/page.tsx", "utf8");
const lawCardTsx = fs.readFileSync("components/legal/LawCard.tsx", "utf8");
const lawDocument = fs.readFileSync("components/law/LawDocument.tsx", "utf8");
ok(/needsIssuedFallback\(card\)/.test(legalPage) && /loadIssuedDateFallbacks\(prismaSqlClient\(prisma\), system\.id\)/.test(legalPage) && /issuedFallbacks=\{issuedFallbacks\}/.test(legalPage), "W-1 /legal/<slug>: يقرأ مصادر الإصدار التالية حين يلزم ويمرّرها إلى البطاقة");
ok(/lawCardDateLines\(card, issuedFallbacks\)/.test(lawCardTsx), "W-1 LawCardPanel: السطر من lawCardDateLines(card, issuedFallbacks)");
ok(/\{repealBannerHeading\(r\)\}/.test(lawDocument) && !/<Ban aria-hidden size=\{20\} \/> هذا النظام لاغٍ/.test(lawDocument), "W-2 شريط /law: العنوان من repealBannerHeading لا «هذا النظام لاغٍ» ثابتًا");

// ── الحكم الباقي ──
ok(isRetainedProvision(RETAINED_PROVISIONS_STATUS, "ساري"), "R-1 «ملغى مع بقاء أحكام محددة مؤقتًا» + سجل المادة «ساري»: سارية");
ok(!isRetainedProvision(RETAINED_PROVISIONS_STATUS, null) && !isRetainedProvision(RETAINED_PROVISIONS_STATUS, "مضافة") && !isRetainedProvision(RETAINED_PROVISIONS_STATUS, "ملغاة"), "R-1 بلا سجل أو بسجل غير «ساري»: ملغاة بالتبعية كما كانت");
ok(!isRetainedProvision("ملغى", "ساري") && !isRetainedProvision("مستبدل", "ساري") && !isRetainedProvision(null, "ساري"), "R-1 نظام «ملغى» أو «مستبدل»: القاعدة لا تنطبق");

console.log(`\n${passed} نجح، ${failed} فشل`);
if (failed) process.exit(1);
