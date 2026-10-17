// HKM-012: مطابقة متن الحكم والاستئناف على المحتوى المنقّح داخل القاعدة.
// أنماط redactPII نفسها بتعابير PostgreSQL (تدعم النظر للخلف)، فلا يُعثر على حكم بهوية أو جوال
// أو آيبان أو بريد، ولا بجزء منها. النص المخزَّن لا يُمس: الحجب في تعبير الاستعلام فقط.
// بلا درع «المادة/صك»: كل سلسلة بشكل هوية تُحجب هنا ولو سُبقت بهما، فلا يُتجاوز الحجب بإضافتهما.

const D = "[0-9٠-٩]";
const G = "[[:space:] ‌]*";

/** علامة الحجب في التعبير؛ تُزال من الاستعلام فلا يطابقها. */
export const REDACTION_MARK = "█";

// [النمط، الأعلام] بترتيب redactPII: البريد، الهوية، الجوال (محلي ودولي)، الآيبان.
const PII_SQL_PATTERNS: Array<[string, string]> = [
  ["[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}", "g"],
  [`(?<!${D})[12١٢](${G}${D}){9}(?!${D})`, "g"],
  [`((?<!${D})(\\+|00|٠٠)?${G}[9٩]${G}[6٦]${G}[6٦]${G}[0٠]?|[0٠])${G}[5٥](${G}${D}){8}(?!${D})`, "g"],
  [`\\ySA(${G}${D}){22}\\y`, "gi"],
];

/** تعبير SQL لنص العمود بعد الحجب. الأنماط ثابتة (لا مدخل من المستخدم). */
export function redactedSqlExpr(col: string): string {
  return PII_SQL_PATTERNS.reduce((expr, [p, f]) => `regexp_replace(${expr}, '${p}', '${REDACTION_MARK}', '${f}')`, `coalesce(${col}, '')`);
}

export const toLatinDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
const toIndicDigits = (s: string) => s.replace(/[0-9]/g, (d) => String.fromCharCode(0x0660 + Number(d)));

/** الصيغتان اللاتينية والهندية: رقم القضية مخزَّن بالهندية غالبًا، والاستعلام يأتي بأيّهما. */
export function digitVariants(s: string): string[] {
  const latin = toLatinDigits(s);
  return [...new Set([latin, toIndicDigits(latin)])];
}

const escapeLike = (s: string) => s.replace(/[%_\\]/g, "\\$&");

/** كل رقم طويل يُطابَق في رقم القضية أو القرار فقط (شرط لكل رقم، تُضاف معاملاته إلى params). */
export function rulingNumbersSql(numbers: string[], params: unknown[], alias = ""): string[] {
  return numbers.map((n) => {
    const ors = digitVariants(n).map((v) => {
      params.push(`%${escapeLike(v)}%`);
      return `${alias}"caseNo" LIKE $${params.length} OR ${alias}"decisionNo" LIKE $${params.length}`;
    });
    return `(${ors.join(" OR ")})`;
  });
}

/**
 * النص في العنوان أو المتن (أو الاستئناف) بعد الحجب، أو في حقلي رقم القضية والقرار.
 * كل عمود في استعلام فرعي مستقل يجمعها UNION، فيستعمل كلٌّ فهرسه (trgm للعنوان والمتن)؛
 * الشرط الخام أولًا ثم المنقّح على المرشحين فقط. مع OR في استعلام واحد يقع المخطِّط في مسح كامل.
 */
export function rulingRedactedTextSql(text: string, params: unknown[], alias = "", opts: { appeal?: boolean } = {}): string {
  const cols = opts.appeal === false ? ["judgmentTitle", "judgmentText"] : ["judgmentTitle", "judgmentText", "appealText"];
  const subs: string[] = [];
  for (const v of digitVariants(text)) {
    params.push(`%${escapeLike(v)}%`);
    const p = `$${params.length}`;
    for (const col of cols) {
      subs.push(`SELECT "id" FROM "judicial_cases" WHERE "${col}" ILIKE ${p} AND ${redactedSqlExpr(`"${col}"`)} ILIKE ${p}`);
    }
    subs.push(`SELECT "id" FROM "judicial_cases" WHERE "caseNo" ILIKE ${p} OR "decisionNo" ILIKE ${p}`);
  }
  return `${alias}"id" IN (${subs.join(" UNION ")})`;
}
