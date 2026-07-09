// حذف أرقام هامش الأسطر — نواة نقيّة محايدة البيئة (متصفح + خادم).
//
// كثير من المدوّنات والكتب المحققة القضائية تطبع ترقيماً متسلسلاً للأسطر في الهامش
// (218، 219، 220…)، فيلتقطه محرّك الرؤية (Gemini) في بداية كل سطر. هذا الترقيم ليس
// من المتن — لكن حذفه في وثيقةٍ قانونية حسّاس: يجب ألّا نمسّ رقماً من المحتوى (مادة،
// مبلغ، رقم صكّ، إحالة كـ«٧٣/٦»).
//
// الأمان: لا نحذف رقماً إلا إن أثبت أنه جزءٌ من «تسلسل هامشي» — أي أنّ الأسطر التي
// تبدأ برقمٍ معزول تُكوّن تتابعاً تصاعدياً بخطوةٍ ~1. رقمٌ منفردٌ لا تسلسل له يبقى.
// وأي رقمٍ داخل السطر (لا في أوّله) لا يُمسّ إطلاقاً.

// أرقام عربية-هندية (٠-٩) ولاتينية معاً — نطبّع للفحص فقط، لا نغيّر النصّ إلا بالحذف.
const AR_DIGITS: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9"
};

function toInt(s: string): number | null {
  let out = "";
  for (const ch of s) {
    if (ch >= "0" && ch <= "9") out += ch;
    else if (AR_DIGITS[ch]) out += AR_DIGITS[ch];
    else return null; // ليس رقماً خالصاً
  }
  return out.length ? Number(out) : null;
}

// يلتقط «رقم هامشٍ محتمل» في بداية السطر: رقمٌ خالص (عربي/لاتيني) يليه مسافةٌ أو
// حدُّ كلمةٍ عربية، ثمّ بقية السطر. لا يلتقط رقماً متبوعاً بـ «/» أو «-» أو «.» أو «)»
// (فتلك صيغُ محتوى: تواريخ، إحالات، ترقيم بنود «1)»، مبالغ).
const LEADING_NUM = /^(\s*)([0-9٠-٩]{1,4})(\s+)(?=[^\s0-9٠-٩])/;

interface LineNum {
  index: number; // ترتيب السطر
  value: number; // قيمة الرقم البادئ
  numText: string; // نصّ الرقم كما ورد
  prefixLen: number; // طول (المسافة+الرقم+المسافة) لحذفه
}

/**
 * يحذف أرقام هامش الأسطر المتسلسلة فقط. يعيد النصّ منظَّفاً وعدد ما حُذف.
 * محافظ: يُبقي أي رقمٍ لا يثبت أنه ضمن تسلسلٍ هامشي (خطوة ~1 مع جارٍ له).
 */
export function stripMarginLineNumbers(text: string): { text: string; removed: number } {
  if (!text) return { text: text ?? "", removed: 0 };
  const lines = text.split("\n");

  // 1) استخرج الأسطر التي تبدأ برقمٍ معزولٍ مرشَّح (مع تجاهل علامات الصفحات [صفحة N]).
  const candidates: LineNum[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*\[صفحة \d+\]/.test(line)) continue; // علامة صفحة — ليست رقم هامش
    const m = LEADING_NUM.exec(line);
    if (!m) continue;
    const value = toInt(m[2]);
    if (value === null) continue;
    candidates.push({ index: i, value, numText: m[2], prefixLen: m[0].length });
  }
  if (candidates.length < 3) return { text, removed: 0 }; // لا تسلسل يُعتدّ به

  // 2) علّم المرشَّح «هامشياً» فقط إن كان له جارٌ (سابقٌ أو لاحق ضمن نافذةٍ قريبة)
  //    قيمتُه أكبر/أصغر بمقدار 1–3 — أي جزءٌ من تتابعٍ تصاعدي حقيقي، لا رقمٌ منفرد.
  const isSeq = new Set<number>();
  for (let a = 0; a < candidates.length; a += 1) {
    for (let b = a + 1; b < candidates.length && b <= a + 3; b += 1) {
      const diff = candidates[b].value - candidates[a].value;
      const gap = candidates[b].index - candidates[a].index;
      // تصاعدٌ بخطوةٍ صغيرة موجبة عبر أسطرٍ متقاربة = ترقيم هامش
      if (diff >= 1 && diff <= 3 && gap >= 1 && gap <= 6) {
        isSeq.add(candidates[a].index);
        isSeq.add(candidates[b].index);
      }
    }
  }
  if (isSeq.size < 3) return { text, removed: 0 }; // لم يثبت تسلسل كافٍ

  // 3) احذف البادئة الرقمية من الأسطر المؤكَّدة هامشياً فقط.
  let removed = 0;
  const byIndex = new Map(candidates.map((c) => [c.index, c] as const));
  const out = lines.map((line, i) => {
    if (!isSeq.has(i)) return line;
    const c = byIndex.get(i);
    if (!c) return line;
    removed += 1;
    return line.slice(c.prefixLen); // يحذف البادئة «المسافة+الرقم+المسافة» فقط
  });

  return { text: out.join("\n"), removed };
}
