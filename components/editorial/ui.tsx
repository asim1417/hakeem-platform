// عناصر المكتب المشتركة برموز desk.css (لا لون حرفي هنا). صالحة للخادم والعميل.
import Link from "next/link";
import type { ReactNode } from "react";
import { Check, CircleAlert, CircleMinus, ExternalLink, Info, Lock, TriangleAlert, Users, type LucideIcon } from "lucide-react";
import type { BadgeTone } from "./labels";
import { safeSourceHref } from "./logic";

export type BtnVariant = "approve" | "correct" | "reject" | "primary" | "destructive" | "undo" | "text" | "text-danger";

/** صنف الزر: base + النوع، و«lg» لأزرار صف القرار والشرائط والحوارات (48). */
export function btnClass(variant: BtnVariant, opts: { lg?: boolean; block?: boolean } = {}): string {
  const v = variant === "text-danger" ? "dk-btn--text dk-btn--text-danger" : `dk-btn--${variant}`;
  return ["dk-btn", v, opts.lg ? "dk-btn--lg" : "", opts.block ? "dk-btn--block" : ""].filter(Boolean).join(" ");
}

/** جذر محتوى المكتب: يطبّق رموز desk.css داخل غلاف الإدارة دون مسّه. */
export function DeskRoot({ children }: { children: ReactNode }) {
  return (
    <div data-desk="" className="pb-10">
      {children}
    </div>
  );
}

/** رمز لاتيني (معرّف، رابط، بصمة) معزول الاتجاه بلغته (ق١٧-٣). */
export function Ltr({ children, plain = false }: { children: ReactNode; plain?: boolean }) {
  return (
    <bdi dir="ltr" lang="en" className={plain ? undefined : "dk-code"}>
      {children}
    </bdi>
  );
}

const CODE_TOKEN = /([A-Za-z0-9][A-Za-z0-9_\-./:]*[A-Za-z0-9]|[A-Za-z])/;

/**
 * نص عربي من الخادم فيه رموز لاتينية (OP-…، uqn-fix، S03): كل رمز فيه حرف لاتيني يُعزل باتجاهه ولغته (ق١٧-٣)،
 * والأرقام المجردة تبقى كما هي.
 */
export function WithCodes({ text }: { text: string }) {
  const parts = text.split(CODE_TOKEN);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 && /[A-Za-z]/.test(part) ? (
          <bdi key={i} dir="ltr" lang="en">
            {part}
          </bdi>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** التاريخ الهجري: اللاحقة خارج العزل فتظهر بعد الرقم (ح٢٢). */
export function HijriDate({ value }: { value: string }) {
  return (
    <span className="dk-nowrap">
      <bdi dir="ltr">{value.replace(/-/g, "/")}</bdi>هـ
    </span>
  );
}

const TONE_ICON: Record<BadgeTone, LucideIcon | null> = {
  neutral: Check,
  info: Users,
  success: Check,
  danger: CircleAlert,
  risk: TriangleAlert,
  destructive: CircleMinus,
};

export function Badge({ tone = "neutral", icon, children }: { tone?: BadgeTone; icon?: LucideIcon | null; children: ReactNode }) {
  const Icon = icon === undefined ? TONE_ICON[tone] : icon;
  return (
    <span className={`dk-badge dk-badge--${tone}`}>
      {Icon ? <Icon size={16} aria-hidden /> : null}
      <span>{children}</span>
    </span>
  );
}

/** صفحة إعداد التحقق الثنائي في بوابة الحساب (قائمة الحساب ← الأمان والتحقق الثنائي). */
export const MFA_SETUP_HREF = "/api/auth/account-portal?section=security";

/** إرشاد حين لا يظهر رابط إعداد التحقق الثنائي (الراية AUTH_MFA_ENABLED مطفأة في إعدادات النظام). */
export function MfaSetupHint({ available, isOwner }: { available: boolean; isOwner: boolean }) {
  if (available) {
    return (
      <>
        فعّله لحسابك من <a href={MFA_SETUP_HREF}>الأمان والتحقق الثنائي</a> ثم أعد تحميل الصفحة.
      </>
    );
  }
  return isOwner ? (
    <>
      إعداده غير ظاهر بعد: شغّل «إظهار إعداد التحقق الثنائي» من <Link href="/admin/settings">إعدادات النظام</Link>، ثم فعّله لحسابك.
    </>
  ) : (
    <>إعداده غير متاح في حسابك بعد؛ اطلب من المالك إظهاره.</>
  );
}

/**
 * لافتة حالة الكتابة: مقفلة (بمفتاح اللوحة، أو بمفتاح الطوارئ، أو لأنها نسخة معاينة، أو لتعذّر قراءة الإعدادات)،
 * أو مفتوحة وحساب المستخدم بلا تحقق ثنائي مشروط. المالك يرى رابط المفتاح في الإعدادات.
 */
export function ReadOnlyBanner({
  writeEnabled,
  killed = false,
  lock = null,
  loadFailed = false,
  isOwner = false,
  mfaMissing = false,
  mfaError = false,
  mfaSetupAvailable = true,
}: {
  writeEnabled: boolean;
  killed?: boolean;
  lock?: "env_zero" | "preview" | null;
  loadFailed?: boolean;
  isOwner?: boolean;
  mfaMissing?: boolean;
  mfaError?: boolean;
  mfaSetupAvailable?: boolean;
}) {
  if (writeEnabled && !mfaMissing) return null;
  if (writeEnabled) {
    return (
      <p className="dk-banner">
        <Lock size={18} aria-hidden />
        <span>
          {mfaError ? (
            <>
              <strong>تعذّر التحقق من التحقق الثنائي لحسابك الآن.</strong> الكتابة موقوفة لحسابك احتياطًا؛ أعد تحميل الصفحة بعد قليل.
            </>
          ) : (
            <>
              <strong>التحقق الثنائي مطلوب للكتابة.</strong> <MfaSetupHint available={mfaSetupAvailable} isOwner={isOwner} />
            </>
          )}
        </span>
      </p>
    );
  }
  return (
    <p className="dk-banner">
      <Lock size={18} aria-hidden />
      <span>
        <strong>اللوحة للقراءة فقط.</strong>{" "}
        {loadFailed ? (
          "تعذّرت قراءة إعدادات المكتب، فالكتابة مقفلة احتياطًا. أعد تحميل الصفحة بعد قليل."
        ) : killed && lock === "preview" ? (
          "هذه نسخة معاينة تشارك قاعدة الإنتاج، فالكتابة فيها مقفلة. اكتب من الموقع الأساسي."
        ) : killed ? (
          "الكتابة مقفلة بمفتاح الطوارئ في إعدادات النشر."
        ) : isOwner ? (
          <>
            شغّل الكتابة من <Link href="/admin/legal/settings#desk-switch">الإعدادات</Link>.
          </>
        ) : (
          "الكتابة مقفلة حتى يشغّلها المالك."
        )}
      </span>
    </p>
  );
}

export type MessageTone = "info" | "error" | "warn" | "lock" | "success";
const MESSAGE_ICON: Record<MessageTone, LucideIcon> = { info: Info, error: CircleAlert, warn: TriangleAlert, lock: Lock, success: Check };

export function Message({
  tone = "info",
  title,
  children,
  actions,
  role,
  id,
  className,
}: {
  tone?: MessageTone;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  role?: "alert" | "status";
  id?: string;
  className?: string;
}) {
  const Icon = MESSAGE_ICON[tone];
  return (
    <div id={id} role={role} className={`dk-msg dk-msg--${tone}${className ? ` ${className}` : ""}`}>
      <Icon size={20} aria-hidden />
      <div className="dk-msg__body">
        {title ? <p className="dk-msg__title">{title}</p> : null}
        {children ? <div>{children}</div> : null}
        {actions ? <div className="dk-msg__actions">{actions}</div> : null}
      </div>
    </div>
  );
}

/** رابط المصدر: هدف 44، نصه في span واحد، ويفتح في لسان جديد. رابط غير https يُعرض نصًّا بلا رابط. */
export function SourceLink({ href: rawHref, children }: { href: string; children: ReactNode }) {
  const href = safeSourceHref(rawHref);
  if (!href) {
    return (
      <span className="dk-source" title="رابط المصدر غير آمن أو غير صالح، فلا يُفتح.">
        <span>{children}</span>
      </span>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="dk-source">
      <ExternalLink size={16} aria-hidden className="rtl:-scale-x-100" />
      <span>
        {children}
        <span className="dk-sr"> (يفتح في لسان جديد)</span>
      </span>
    </a>
  );
}

/** الصلاحية المرفوضة داخل الصفحة بلا تحويل (ق١٥-٢). */
export function PageDenied({ title, body = "اطلبها من المالك." }: { title: string; body?: string }) {
  return (
    <div className="mt-6">
      <Message tone="lock" title={title} actions={<Link href="/admin/legal" className={btnClass("correct")}>العودة إلى لوحة الحالة</Link>}>
        {body}
      </Message>
    </div>
  );
}

/** قاعدة بلا ترحيل: منفصلة نصًّا وشكلًا عن «تعذّر الاتصال» (ق١٤-٣). */
export function NotMigrated({ what = "جداول مكتب التحرير غير موجودة" }: { what?: string }) {
  return (
    <Message tone="info" title="الترحيل غير مطبّق.">
      {what} على هذه القاعدة؛ تُطبَّق بملف الترحيل وباعتماد المالك.
    </Message>
  );
}

export function LoadFailed({ what, retryHref }: { what: string; retryHref: string }) {
  return (
    <Message
      tone="error"
      role="alert"
      title={`تعذّر ${what}.`}
      actions={
        <a href={retryHref} className={btnClass("text")}>
          إعادة المحاولة
        </a>
      }
    >
      تعذّر الاتصال بقاعدة البيانات. لم يتغير شيء.
    </Message>
  );
}

/** رمز خطأ قاعدة البيانات: جدول أو مخطط غير موجود = الترحيل غير مطبّق. */
export function isMissingRelation(code: string | null | undefined): boolean {
  return code === "42P01" || code === "3F000";
}
