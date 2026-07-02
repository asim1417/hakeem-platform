import Link from "next/link";
import type { ReactNode } from "react";
import { sanitizeDisplayText } from "@/lib/modules/legal-core/display-text";

/**
 * يعرض نصّ الحكم مع إبراز إشارات المواد تلقائياً:
 *  - المواد المرتبطة فعلاً (في articleLinks) → قابلة للنقر تفتح المادة في النواة،
 *    وبلون حسب حالة التوثيق (موثّق = أخضر، يحتاج مراجعة = ذهبي).
 *  - الإشارات غير المرتبطة (رقم مادة مذكور بلا رابط) → إبراز بصري فقط (دون رابط).
 * مكوّن عرض صِرف — لا يعدّل النص المخزَّن.
 */

type ArticleLink = {
  articleId: string;
  lawName: string;
  articleNumber: number;
  reviewStatus?: string;
};

function toInt(ar: string): number {
  return parseInt(ar.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString()), 10);
}

// يطابق: المادة/المادتين/المواد مع رقم قد يكون مركّباً «فقرة/مادة» مثل (١/١٢٠)
const REF_RE = /(الماد(?:ة|تين|تان|ت)|المو?اد)\s*(?:رقم\s*)?\(?\s*([0-9٠-٩]+(?:\s*\/\s*[0-9٠-٩]+)*)\s*\)?/g;

/**
 * يستخرج رقم المادة الصحيح من مجموعة أرقام قد تكون «فقرة/مادة».
 * الأولوية: الرقم المرتبط فعلاً بهذا الحكم؛ وإلا الأكبر (المادة أكبر من رقم الفقرة).
 */
function pickArticleNumber(group: string, linked: Map<number, { link: ArticleLink; count: number }>): number {
  const nums = group.split("/").map((p) => toInt(p)).filter((n) => Number.isFinite(n) && n > 0);
  if (!nums.length) return NaN;
  const inLinks = nums.filter((n) => linked.has(n));
  if (inLinks.length === 1) return inLinks[0];
  if (inLinks.length > 1) return Math.max(...inLinks);
  return Math.max(...nums);
}

export function JudgmentText({ text: rawText, links, className = "" }: { text: string; links: ArticleLink[]; className?: string }) {
  const text = sanitizeDisplayText(rawText); // تنقية عرض غير مُتلِفة (لا تمسّ الكلمات)
  if (!text) return null;

  // خريطة رقم المادة → الرابط (قابل للنقر فقط إن كان الرقم غير ملتبس داخل هذا الحكم)
  const byNumber = new Map<number, { link: ArticleLink; count: number }>();
  for (const l of links) {
    const e = byNumber.get(l.articleNumber);
    if (e) e.count += 1;
    else byNumber.set(l.articleNumber, { link: l, count: 1 });
  }

  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  REF_RE.lastIndex = 0;
  while ((m = REF_RE.exec(text))) {
    const start = m.index;
    const matched = m[0];
    const num = pickArticleNumber(m[2], byNumber);
    if (start > last) nodes.push(text.slice(last, start));
    last = start + matched.length;

    const entry = byNumber.get(num);
    if (entry && entry.count === 1) {
      const verified = entry.link.reviewStatus === "verified";
      const color = verified ? "var(--emerald)" : "var(--gold-dark)";
      const bg = verified ? "var(--emerald-soft)" : "var(--gold-ghost)";
      nodes.push(
        <Link
          key={key++}
          href={`/dashboard/legal-core/articles/${entry.link.articleId}`}
          title={`${entry.link.lawName} — ${verified ? "موثّق رسميًا" : "مسترجع آليًا — يحتاج مراجعة"}`}
          className="rounded px-1 font-semibold underline-offset-4 hover:underline"
          style={{ color, background: bg }}
        >
          {matched}
        </Link>
      );
    } else {
      // مذكورة في المتن لكن غير مرتبطة (أو ملتبسة) → إبراز بصري فقط
      nodes.push(
        <span key={key++} className="rounded px-1 font-semibold" style={{ color: "var(--navy)", background: "var(--ink-04)" }}>
          {matched}
        </span>
      );
    }
  }
  if (last < text.length) nodes.push(text.slice(last));

  return <span className={className}>{nodes}</span>;
}
