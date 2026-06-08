import Link from "next/link";
import type { ReactNode } from "react";

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

// يطابق: المادة/المادتين/المواد (رقم) أو المادة 111 أو المادة (١١١)
const REF_RE = /(الماد(?:ة|تين|تان|ت)|المو?اد)\s*(?:رقم\s*)?\(?\s*([0-9٠-٩]+)\s*\)?/g;

export function JudgmentText({ text, links, className = "" }: { text: string; links: ArticleLink[]; className?: string }) {
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
    const num = toInt(m[2]);
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
