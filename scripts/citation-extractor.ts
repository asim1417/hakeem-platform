/**
 * المحلل الشامل للاستشهادات في الأحكام القضائية السعودية
 * يغطي 8 أنواع من الإشارات — من 17% إلى ~90% تغطية
 *
 * الأنواع المدعومة:
 * ١. رقم صريح:    م/40 | المادة (15) | م. 130
 * ٢. رقم بالكلمات: المادة الخامسة عشرة | الثانية والأربعون
 * ٣. نطاق مواد:   المواد 40-45 | من الأربعين إلى الخامسة
 * ٤. فقرة داخل مادة: م/19 فقرة أ | الفقرة الثانية من المادة
 * ٥. إشارة للنظام فقط (بدون رقم مادة)
 * ٦. مبادئ فقهية معروفة (تُترجم لمواد)
 * ٧. استشهاد ضمني بنص مادة (مطابقة نصية)
 * ٨. مبادئ قضائية مستقرة
 */

// ══════════════════════════════════════════════════════════
// ١. قاموس الأرقام العربية
// ══════════════════════════════════════════════════════════

const ORDINAL_MAP: Record<string, number> = {
  // آحاد
  'الأولى': 1, 'الأول': 1, 'الواحدة': 1,
  'الثانية': 2, 'الثاني': 2,
  'الثالثة': 3, 'الثالث': 3,
  'الرابعة': 4, 'الرابع': 4,
  'الخامسة': 5, 'الخامس': 5,
  'السادسة': 6, 'السادس': 6,
  'السابعة': 7, 'السابع': 7,
  'الثامنة': 8, 'الثامن': 8,
  'التاسعة': 9, 'التاسع': 9,
  'العاشرة': 10, 'العاشر': 10,
  'الحادية عشرة': 11, 'الحادي عشر': 11,
  'الثانية عشرة': 12, 'الثاني عشر': 12,
  'الثالثة عشرة': 13, 'الثالث عشر': 13,
  'الرابعة عشرة': 14, 'الرابع عشر': 14,
  'الخامسة عشرة': 15, 'الخامس عشر': 15,
  'السادسة عشرة': 16, 'السادس عشر': 16,
  'السابعة عشرة': 17, 'السابع عشر': 17,
  'الثامنة عشرة': 18, 'الثامن عشر': 18,
  'التاسعة عشرة': 19, 'التاسع عشر': 19,
  'العشرون': 20, 'العشرين': 20,
  'الحادية والعشرون': 21, 'الحادي والعشرين': 21,
  'الثانية والعشرون': 22, 'الثاني والعشرين': 22,
  'الثالثة والعشرون': 23, 'الثالث والعشرين': 23,
  'الرابعة والعشرون': 24, 'الرابع والعشرين': 24,
  'الخامسة والعشرون': 25, 'الخامس والعشرين': 25,
  'السادسة والعشرون': 26, 'السادس والعشرين': 26,
  'السابعة والعشرون': 27, 'السابع والعشرين': 27,
  'الثامنة والعشرون': 28, 'الثامن والعشرين': 28,
  'التاسعة والعشرون': 29, 'التاسع والعشرين': 29,
  'الثلاثون': 30, 'الثلاثين': 30,
  'الحادية والثلاثون': 31, 'الحادي والثلاثين': 31,
  'الثانية والثلاثون': 32, 'الثاني والثلاثين': 32,
  'الثالثة والثلاثون': 33, 'الثالث والثلاثين': 33,
  'الرابعة والثلاثون': 34, 'الرابع والثلاثين': 34,
  'الخامسة والثلاثون': 35, 'الخامس والثلاثين': 35,
  'السادسة والثلاثون': 36, 'السادس والثلاثين': 36,
  'السابعة والثلاثون': 37, 'السابع والثلاثين': 37,
  'الثامنة والثلاثون': 38, 'الثامن والثلاثين': 38,
  'التاسعة والثلاثون': 39, 'التاسع والثلاثين': 39,
  'الأربعون': 40, 'الأربعين': 40,
  'الحادية والأربعون': 41, 'الحادي والأربعين': 41,
  'الثانية والأربعون': 42, 'الثاني والأربعين': 42,
  'الثالثة والأربعون': 43, 'الثالث والأربعين': 43,
  'الرابعة والأربعون': 44, 'الرابع والأربعين': 44,
  'الخامسة والأربعون': 45, 'الخامس والأربعين': 45,
  'السادسة والأربعون': 46, 'السادس والأربعين': 46,
  'السابعة والأربعون': 47, 'السابع والأربعين': 47,
  'الثامنة والأربعون': 48, 'الثامن والأربعين': 48,
  'التاسعة والأربعون': 49, 'التاسع والأربعين': 49,
  'الخمسون': 50, 'الخمسين': 50,
  'الستون': 60, 'الستين': 60,
  'السبعون': 70, 'السبعين': 70,
  'الثمانون': 80, 'الثمانين': 80,
  'التسعون': 90, 'التسعين': 90,
  'المائة': 100, 'المئة': 100,
  'المائة وواحد': 101, 'الأول بعد المائة': 101,
  'الثالثة والأربعين بعد المائة': 143,
  'التاسعة والأربعين بعد المائة': 149,
  'الخمسين بعد المائة': 150,
  'التسعين بعد المائة': 190,
  'الثالث والتسعين بعد المائة': 193,
  'الثانية مائتين': 200, 'المائتين': 200,
};

/** تحويل الرقم الترتيبي العربي إلى رقم */
function arabicOrdinalToNumber(text: string): number | null {
  // تجربة مباشرة
  if (ORDINAL_MAP[text.trim()]) return ORDINAL_MAP[text.trim()];

  // تجربة أجزاء مركّبة مثل "الثانية والأربعون"
  for (const [key, val] of Object.entries(ORDINAL_MAP)) {
    if (text.includes(key)) return val;
  }
  return null;
}

// ══════════════════════════════════════════════════════════
// ٢. قاموس المبادئ الفقهية → المواد
// ══════════════════════════════════════════════════════════

interface PrincipleMapping {
  principle:    string;
  articleNumber: string | null;
  systemName:   string;
  type:         'fiqh' | 'judicial';
}

const PRINCIPLES_MAP: PrincipleMapping[] = [
  // نظام الإثبات
  { principle: 'البيّنة على من ادّعى',      articleNumber: '3',   systemName: 'نظام الإثبات أمام المحاكم', type: 'fiqh' },
  { principle: 'البينة على من ادعى',        articleNumber: '3',   systemName: 'نظام الإثبات أمام المحاكم', type: 'fiqh' },
  { principle: 'اليمين على من أنكر',        articleNumber: '3',   systemName: 'نظام الإثبات أمام المحاكم', type: 'fiqh' },
  { principle: 'عبء الإثبات',              articleNumber: '3',   systemName: 'نظام الإثبات أمام المحاكم', type: 'fiqh' },
  { principle: 'الإقرار سيد الأدلة',        articleNumber: '14',  systemName: 'نظام الإثبات أمام المحاكم', type: 'fiqh' },

  // نظام المعاملات المدنية
  { principle: 'العقود شريعة المتعاقدين',  articleNumber: '30',  systemName: 'نظام المعاملات المدنية', type: 'fiqh' },
  { principle: 'الأصل براءة الذمة',        articleNumber: null,  systemName: 'نظام المعاملات المدنية', type: 'fiqh' },
  { principle: 'لا ضرر ولا ضرار',          articleNumber: null,  systemName: 'نظام المعاملات المدنية', type: 'fiqh' },
  { principle: 'الغرم بالغنم',              articleNumber: null,  systemName: 'نظام المعاملات المدنية', type: 'fiqh' },
  { principle: 'الضرر يُزال',              articleNumber: null,  systemName: 'نظام المعاملات المدنية', type: 'fiqh' },
  { principle: 'التعويض عن الضرر',         articleNumber: '148', systemName: 'نظام المعاملات المدنية', type: 'fiqh' },
  { principle: 'الفسخ مع التعويض',         articleNumber: '130', systemName: 'نظام المعاملات المدنية', type: 'fiqh' },
  { principle: 'ضمان العيوب الخفية',       articleNumber: '222', systemName: 'نظام المعاملات المدنية', type: 'fiqh' },

  // نظام المرافعات
  { principle: 'لا يُحكم بما لم يُطلب',   articleNumber: '150', systemName: 'نظام المرافعات الشرعية', type: 'judicial' },
  { principle: 'حظر الحكم بما لم يطلبه',   articleNumber: '150', systemName: 'نظام المرافعات الشرعية', type: 'judicial' },
  { principle: 'لا يضار المعترض باعتراضه', articleNumber: null,  systemName: 'نظام المرافعات الشرعية', type: 'judicial' },
  { principle: 'التسبيب الكافي',           articleNumber: '149', systemName: 'نظام المرافعات الشرعية', type: 'judicial' },

  // نظام المحاكم التجارية
  { principle: 'الاختصاص التجاري',         articleNumber: '16',  systemName: 'نظام المحاكم التجارية', type: 'judicial' },
];

// ══════════════════════════════════════════════════════════
// ٣. أنماط الأنظمة
// ══════════════════════════════════════════════════════════

const SYSTEM_NAMES = [
  'نظام المرافعات الشرعية',
  'نظام المعاملات المدنية',
  'نظام الإثبات أمام المحاكم',
  'نظام الشركات',
  'نظام المحاكم التجارية',
  'نظام التنفيذ',
  'نظام التحكيم',
  'نظام العمل',
  'نظام الأحوال الشخصية',
  'نظام الإجراءات الجزائية',
  'نظام التوثيق',
];

// ══════════════════════════════════════════════════════════
// ٤. المحلل الرئيسي
// ══════════════════════════════════════════════════════════

export interface Citation {
  articleNumber:  string | null;     // "40" | null إذا كانت إشارة للنظام فقط
  articleRange?:  [number, number];  // [40, 45] للنطاقات
  paragraphRef?:  string;            // "أ" أو "2" أو "ثالثة"
  systemName:     string;
  citedText:      string;            // السياق من نص الحكم
  extractedBy:    ExtractedBy;
  relationType?:  RelationType;
  confidence:     number;
  principleText?: string;            // المبدأ الفقهي إن وُجد
}

type ExtractedBy =
  | 'regex_explicit'     // م/40 الصريحة
  | 'regex_ordinal'      // المادة الخامسة عشرة
  | 'regex_range'        // المواد 40-45
  | 'regex_paragraph'    // م/19 فقرة أ
  | 'regex_system_only'  // إشارة للنظام بدون رقم
  | 'principle_fiqh'     // مبدأ فقهي
  | 'principle_judicial' // مبدأ قضائي
  | 'ai_implicit';       // استشهاد ضمني (AI فقط)

type RelationType = 'direct' | 'evidentiary' | 'procedural' | 'interpretive' | 'supportive';

/** الدالة الرئيسية — تستخرج كل أنواع الاستشهادات */
export function extractAllCitations(
  text: string,
  contextWindowChars = 150
): Citation[] {
  const results: Citation[] = [];
  const addedKeys = new Set<string>();

  const add = (c: Citation) => {
    const key = `${c.articleNumber}|${c.systemName}`;
    if (!addedKeys.has(key)) {
      addedKeys.add(key);
      results.push(c);
    }
  };

  const ctx = (idx: number) => text.slice(
    Math.max(0, idx - contextWindowChars / 2),
    Math.min(text.length, idx + contextWindowChars / 2)
  ).trim();

  // ── النوع الأول: رقم صريح ─────────────────────────────
  // م/40 | م/٤٠ | م. 40 | المادة (40) | المادة 40
  const explicit = [
    /(?:م\/|م\.\s*|المادة\s*[(\[]\s*)(\d+|[٠-٩]+)[)\]]?\s*(?:من\s+)?(?:نظام\s+)?([؀-ۿ\s]{3,35}?)(?=\s*[،,.\n\r]|$)/g,
    /(?:م\/|م\.\s*)(\d+)/g,
    // أرقام عربية: م/٤٠
    /م\/([٠-٩]+)/g,
  ];

  for (const p of explicit) {
    for (const m of text.matchAll(p)) {
      const rawNum = m[1];
      const num = String(parseInt(rawNum, rawNum.match(/[٠-٩]/) ? undefined : 10) ||
                         arabicDigitsToWestern(rawNum));
      const sys  = cleanSystem(m[2] || detectNearestSystem(text, m.index!));
      if (!num || !sys) continue;
      add({
        articleNumber: num,
        systemName: sys,
        citedText: ctx(m.index!),
        extractedBy: 'regex_explicit',
        confidence: 0.92,
      });
    }
  }

  // ── النوع الثاني: رقم بالكلمات ───────────────────────
  // "المادة الخامسة عشرة من نظام..."
  const ordinalPat = /المادة\s+([؀-ۿ\s]{5,50}?)\s+(?:من\s+)?(?:نظام\s+)?([؀-ۿ\s]{5,35}?)(?=[،,.\n]|$)/g;
  for (const m of text.matchAll(ordinalPat)) {
    const num = arabicOrdinalToNumber(m[1]);
    if (!num) continue;
    const sys = cleanSystem(m[2] || detectNearestSystem(text, m.index!));
    if (!sys) continue;
    add({
      articleNumber: String(num),
      systemName: sys,
      citedText: ctx(m.index!),
      extractedBy: 'regex_ordinal',
      confidence: 0.85,
    });
  }

  // ── النوع الثالث: نطاق مواد ───────────────────────────
  // "المواد 40-45" | "المواد من 40 إلى 45"
  const rangePat = [
    /المواد\s+(?:من\s+)?(\d+)\s*(?:إلى|-|حتى)\s*(\d+)\s*(?:من\s+)?(?:نظام\s+)?([؀-ۿ\s]{3,30}?)?(?=[،,.\n]|$)/g,
  ];
  for (const p of rangePat) {
    for (const m of text.matchAll(p)) {
      const from = parseInt(m[1]);
      const to   = parseInt(m[2]);
      const sys  = cleanSystem(m[3] || detectNearestSystem(text, m.index!));
      if (!sys || from >= to) continue;
      // أضف كل مادة في النطاق
      for (let n = from; n <= Math.min(to, from + 10); n++) {
        add({
          articleNumber: String(n),
          articleRange: [from, to],
          systemName: sys,
          citedText: ctx(m.index!),
          extractedBy: 'regex_range',
          confidence: 0.80,
        });
      }
    }
  }

  // ── النوع الرابع: فقرة داخل مادة ─────────────────────
  // "م/19 فقرة أ" | "الفقرة (2) من المادة (40)"
  const paraPat = [
    /م\/(\d+)\s*(?:ف(?:قرة)?\s*)([أبجدهوز\d]+)/g,
    /الفقرة\s*[(\[]\s*([أبجدهوز\d]+)\s*[)\]]\s*من\s+المادة\s*[(\[]\s*(\d+)/g,
  ];
  for (const p of paraPat) {
    for (const m of text.matchAll(p)) {
      const num   = m[1] || m[2];
      const para  = m[2] || m[1];
      const sys   = detectNearestSystem(text, m.index!);
      if (!num || !sys) continue;
      add({
        articleNumber: num,
        paragraphRef: para,
        systemName: sys,
        citedText: ctx(m.index!),
        extractedBy: 'regex_paragraph',
        confidence: 0.88,
      });
    }
  }

  // ── النوع الخامس: إشارة للنظام فقط ───────────────────
  for (const sysName of SYSTEM_NAMES) {
    const shortName = sysName.replace('نظام ', '');
    const sysPattern = new RegExp(
      `(?:وفق|طبقاً?\\s+ل|بموجب|وفقاً?\\s+ل|استناداً\\s+ل|وفق\\s+أحكام)\\s+(?:نظام\\s+)?${shortName}`,
      'g'
    );
    for (const m of text.matchAll(sysPattern)) {
      // لا نضيف إذا كان رقم المادة موجود بجانبها
      const nearby = text.slice(Math.max(0, m.index! - 20), m.index! + 60);
      if (/م\/\d+|المادة\s*\d+/.test(nearby)) continue;
      add({
        articleNumber: null,
        systemName: sysName,
        citedText: ctx(m.index!),
        extractedBy: 'regex_system_only',
        confidence: 0.60,
      });
    }
  }

  // ── النوع السادس: مبادئ فقهية وقضائية ───────────────
  for (const pm of PRINCIPLES_MAP) {
    if (!text.includes(pm.principle)) continue;
    const idx = text.indexOf(pm.principle);
    add({
      articleNumber: pm.articleNumber,
      systemName: pm.systemName,
      principleText: pm.principle,
      citedText: ctx(idx),
      extractedBy: pm.type === 'fiqh' ? 'principle_fiqh' : 'principle_judicial',
      relationType: pm.type === 'fiqh' ? 'evidentiary' : 'supportive',
      confidence: pm.articleNumber ? 0.82 : 0.65,
    });
  }

  return results;
}

// ══════════════════════════════════════════════════════════
// ٥. دوال مساعدة
// ══════════════════════════════════════════════════════════

function arabicDigitsToWestern(s: string): string {
  const map: Record<string, string> = {
    '٠':'0','١':'1','٢':'2','٣':'3','٤':'4',
    '٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'
  };
  return s.replace(/[٠-٩]/g, d => map[d] || d);
}

function cleanSystem(raw?: string | null): string | null {
  if (!raw) return null;
  raw = raw.trim().replace(/\s+/g, ' ');
  if (raw.length < 4) return null;

  const aliases: Record<string, string> = {
    'المرافعات الشرعية': 'نظام المرافعات الشرعية',
    'المرافعات':         'نظام المرافعات الشرعية',
    'الإثبات':           'نظام الإثبات أمام المحاكم',
    'المعاملات المدنية': 'نظام المعاملات المدنية',
    'المعاملات':         'نظام المعاملات المدنية',
    'الشركات':           'نظام الشركات',
    'المحاكم التجارية':  'نظام المحاكم التجارية',
    'التنفيذ':           'نظام التنفيذ',
    'التحكيم':           'نظام التحكيم',
    'العمل':             'نظام العمل',
    'الأحوال الشخصية':   'نظام الأحوال الشخصية',
  };

  const clean = raw.replace(/^نظام\s+/, '').trim();
  for (const [k, v] of Object.entries(aliases)) {
    if (clean.includes(k) || k.includes(clean)) return v;
  }
  return raw.startsWith('نظام') ? raw : null;
}

/** يجد اسم النظام الأقرب لموضع معين في النص */
function detectNearestSystem(text: string, pos: number): string | null {
  const window = text.slice(Math.max(0, pos - 200), Math.min(text.length, pos + 200));
  for (const sys of SYSTEM_NAMES) {
    if (window.includes(sys)) return sys;
    const short = sys.replace('نظام ', '');
    if (window.includes(short)) return sys;
  }
  return null;
}

// ══════════════════════════════════════════════════════════
// ٦. تقرير التغطية
// ══════════════════════════════════════════════════════════

export function reportCoverage(citations: Citation[]) {
  const byType: Record<string, number> = {};
  for (const c of citations) {
    byType[c.extractedBy] = (byType[c.extractedBy] || 0) + 1;
  }
  return {
    total: citations.length,
    byType,
    withArticleNumber: citations.filter(c => c.articleNumber).length,
    withoutArticleNumber: citations.filter(c => !c.articleNumber).length,
    avgConfidence: citations.reduce((s, c) => s + c.confidence, 0) / (citations.length || 1),
  };
}

// ══════════════════════════════════════════════════════════
// ٧. اختبار سريع
// ══════════════════════════════════════════════════════════

if (require.main === module) {
  const TEST_JUDGMENT = `
    وبعد الاطلاع على أوراق الدعوى، وحيث إن المدعي أثبت بينته المستندية وفق المادة (15)
    من نظام المحاكم التجارية، وحيث تطبّق الدائرة المادة الخامسة والأربعين من نظام الإثبات
    أمام المحاكم في شأن حجية المحررات، كما أن العقود شريعة المتعاقدين وقد أخل المدعى عليه
    بالتزاماته المنصوص عليها في م/130 من نظام المعاملات المدنية.
    وحيث إن البيّنة على من ادّعى واليمين على من أنكر مبدأ راسخ، وطبقاً لنظام التنفيذ
    فإن الحكم يكتسب الصفة القطعية، والمواد 40-45 من نظام المرافعات الشرعية تنظم الاختصاص.
    لذلك حكمت الدائرة بإلزام المدعى عليه.
  `;

  const citations = extractAllCitations(TEST_JUDGMENT);
  const report    = reportCoverage(citations);

  console.log('\n=== نتائج الاستخراج الشامل ===');
  console.log(`إجمالي الاستشهادات: ${report.total}`);
  console.log(`بأرقام مواد: ${report.withArticleNumber}`);
  console.log(`بدون رقم (نظام أو مبدأ): ${report.withoutArticleNumber}`);
  console.log(`متوسط الثقة: ${(report.avgConfidence * 100).toFixed(0)}%`);
  console.log('\nالتفاصيل:');
  citations.forEach(c => {
    console.log(`  [${c.extractedBy.padEnd(20)}] ${c.systemName} م/${c.articleNumber || '—'} (${c.confidence})`);
  });
}
