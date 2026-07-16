"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AnswerRenderer — تصيير إجابة «اسأل حكيم» (Markdown) عرضًا احترافيًّا يوازي المنصّات
// القانونية: عناوين، جداول، فواصل، غامق، ومراجع مواد **قابلة للنقر** («م/٣٩» تُبرز بطاقة
// المادة في لوحة الأساس). عرض فقط — لا يمسّ المحرّك ولا البحث ولا الوكلاء ولا المصادقة.
// أمان: لا نُفعّل تصيير HTML الخام (react-markdown يهرّب أي HTML)، ومعالجة [n] عبر رابط آمن.
// ─────────────────────────────────────────────────────────────────────────────
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AnchorHTMLAttributes } from "react";

export interface AnswerSource {
  articleNumber?: number | string;
  systemName?: string;
}

/** يحوّل مراجع «[24]» إلى روابط Markdown آمنة «[24](#cite-24)» لتُعالَج كمرجع مادة قابل للنقر. */
function linkifyRefs(md: string): string {
  return (md || "").replace(/(!?)\[(\d{1,3})\](?!\()/g, (m, bang, n) => (bang ? m : `[${n}](#cite-${n})`));
}

/**
 * @param content نصّ الإجابة (Markdown).
 * @param basis مصادر الإجابة بالترتيب — يُطابَق مرجع [n] بـ basis[n-1] لعرض رقم المادة والربط.
 * @param anchorPrefix بادئة مرساة بطاقات الأساس لهذا الدور (تفرّد عبر الأدوار) — مثل "t2-src-".
 */
export function AnswerRenderer({
  content,
  basis = [],
  anchorPrefix = "",
  id,
}: {
  content: string;
  basis?: AnswerSource[];
  anchorPrefix?: string;
  id?: string;
}) {
  return (
    <div className="answer-prose" dir="rtl" id={id}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="ans-h1">{children}</h1>,
          h2: ({ children }) => <h2 className="ans-h2">{children}</h2>,
          h3: ({ children }) => <h3 className="ans-h3">{children}</h3>,
          table: ({ children }) => (
            <div className="ans-table-wrap">
              <table className="ans-table">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="ans-th">{children}</th>,
          td: ({ children }) => <td className="ans-td">{children}</td>,
          hr: () => <hr className="ans-hr" />,
          strong: ({ children }) => <strong className="ans-strong">{children}</strong>,
          p: ({ children }) => <p className="ans-p">{children}</p>,
          ul: ({ children }) => <ul className="ans-ul">{children}</ul>,
          ol: ({ children }) => <ol className="ans-ol">{children}</ol>,
          li: ({ children }) => <li className="ans-li">{children}</li>,
          blockquote: ({ children }) => <blockquote className="ans-quote">{children}</blockquote>,
          code: ({ children }) => <code className="ans-code">{children}</code>,
          a: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href?: string }) => {
            // مرجع مادة [n] → «م/رقم المادة» قابل للنقر يُبرز بطاقة المصدر في لوحة الأساس.
            if (href?.startsWith("#cite-")) {
              const n = Number(href.slice("#cite-".length));
              const src = Number.isFinite(n) && n > 0 ? basis[n - 1] : undefined;
              const num = src?.articleNumber;
              const target = anchorPrefix ? `#${anchorPrefix}${n}` : undefined;
              // نعرض «م/رقم المادة» فقط حين نعرف رقم المادة الحقيقيّ (تفادي إيهام رقم غير صحيح).
              if (num !== undefined && num !== "") {
                const label = typeof num === "number" ? num.toLocaleString("ar-SA") : String(num);
                return (
                  <a
                    className="cite-ref"
                    href={target}
                    title={src?.systemName ? `${src.systemName} · المادة ${label}` : `المادة ${label}`}
                    aria-label={`المادة ${label} — اعرض المصدر`}
                  >
                    {label}
                  </a>
                );
              }
              // لا رقم مادة معروف → رقم علويّ محايد (بلا «م/» كي لا نُوهم).
              return <sup className="ans-ref">{children}</sup>;
            }
            const internal = href?.startsWith("/") || href?.startsWith("#");
            return (
              <a className="ans-link" href={href} {...(internal ? {} : { target: "_blank", rel: "noreferrer" })} {...rest}>
                {children}
              </a>
            );
          },
        }}
      >
        {linkifyRefs(content)}
      </ReactMarkdown>
    </div>
  );
}
