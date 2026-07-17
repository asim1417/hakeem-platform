import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// نظام التصميم الموحّد — مكوّنات مشتركة مستخرَجة من نمط «منصة الوثائق».
// مكوّنات خادمية نقيّة (بلا حالة) تعتمد أصناف ds-* في globals.css ورموز التطبيق.
// RTL افتراضًا، وصولية (عناوين دلالية، aria حيث يلزم).
// ─────────────────────────────────────────────────────────────────────────────

/** سطر تمهيديّ صغير فوق العنوان. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="ds-eyebrow">{children}</span>;
}

/** عنوان قسم موحّد. */
export function SectionTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="ds-section-title">
      {children}
    </h2>
  );
}

/** شارة صغيرة. */
export function Chip({ children }: { children: ReactNode }) {
  return <span className="ds-chip">{children}</span>;
}

/** ترويسة الصفحة: eyebrow + عنوان + وصف + محتوى إضافيّ (أزرار/صندوق بحث). */
export function Hero({
  title,
  eyebrow,
  lede,
  center = false,
  children,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  lede?: ReactNode;
  center?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className={`ds-hero ${center ? "ds-hero-center" : ""}`}>
      <div className="ds-hero-in">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h1>{title}</h1>
        {lede ? <p className="ds-lede">{lede}</p> : null}
        {children}
      </div>
    </section>
  );
}

/** بطاقة موحّدة: أيقونة + عنوان + وصف. رابط إن مُرّر href. */
export function Card({
  href,
  icon: Icon,
  title,
  description,
  badge,
  children,
}: {
  href?: string;
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  children?: ReactNode;
}) {
  const inner = (
    <>
      <div className="ds-card-head">
        <span className="ds-card-ic">
          <Icon aria-hidden size={20} />
        </span>
        {badge ? <Chip>{badge}</Chip> : null}
      </div>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {children}
    </>
  );
  return href ? (
    <Link href={href} className="ds-card">
      {inner}
    </Link>
  ) : (
    <div className="ds-card">{inner}</div>
  );
}

/** زرّ موحّد بثلاث صيغ (primary/secondary/ghost)، رابط أو زرّ. */
export function Button({
  href,
  variant = "primary",
  icon: Icon,
  children,
  onClick,
  type = "button",
  ariaLabel,
}: {
  href?: string;
  variant?: "primary" | "secondary" | "ghost";
  icon?: LucideIcon;
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  ariaLabel?: string;
}) {
  const cls = `ds-btn ds-btn-${variant}`;
  const body = (
    <>
      {Icon ? <Icon aria-hidden size={16} /> : null}
      {children}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls} aria-label={ariaLabel}>
        {body}
      </Link>
    );
  }
  return (
    <button type={type} className={cls} onClick={onClick} aria-label={ariaLabel}>
      {body}
    </button>
  );
}

/** خطوات مرقّمة (أرقام عربية تلقائية). */
export function Steps({ items }: { items: Array<{ title: ReactNode; description: ReactNode }> }) {
  return (
    <div className="ds-steps">
      {items.map((s, i) => (
        <div key={i} className="ds-step">
          <h3>{s.title}</h3>
          <p>{s.description}</p>
        </div>
      ))}
    </div>
  );
}

/** شبكة بطاقات موحّدة. */
export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="ds-grid">{children}</div>;
}
