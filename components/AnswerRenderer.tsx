"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AnswerRenderer — تصيير إجابة «اسأل حكيم» (Markdown) عرضًا احترافيًّا يوازي المنصّات
// القانونية: عناوين، جداول، فواصل، غامق، ومراجع [n] مميّزة بصريًّا (رقم علويّ ذهبيّ).
// عرض فقط — لا يمسّ المحرّك ولا البحث ولا الوكلاء ولا المصادقة.
// أمان: لا نُفعّل تصيير HTML الخام (سلوك react-markdown الافتراضي يهرّب أي HTML في نصّ
// النموذج)، ومعالجة [n] عبر تحويل رابط Markdown آمن — لا حقن HTML.
// ─────────────────────────────────────────────────────────────────────────────
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AnchorHTMLAttributes } from "react";

/**
 * يحوّل مراجع «[24]» إلى روابط Markdown آمنة «[24](#ref-24)» فتُصيَّر رقمًا علويًّا ذهبيًّا
 * (مرساة #ref-n جاهزة لربطها لاحقًا ببطاقة الأساس). يتجاوز روابط Markdown القائمة.
 */
function linkifyRefs(md: string): string {
  return (md || "").replace(/(!?)\[(\d{1,3})\](?!\()/g, (m, bang, n) => (bang ? m : `[${n}](#ref-${n})`));
}

export function AnswerRenderer({ content }: { content: string }) {
  return (
    <div className="answer-prose" dir="rtl">
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
            // مرجع [n] → رقم علويّ ذهبيّ مميّز (مرساة داخلية).
            if (href?.startsWith("#ref-")) {
              return (
                <sup className="ans-ref">
                  <a href={href} aria-label={`المرجع ${children}`}>
                    {children}
                  </a>
                </sup>
              );
            }
            // رابط داخليّ (النواة) يُفتح في مكانه؛ الخارجيّ في تبويب جديد.
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
