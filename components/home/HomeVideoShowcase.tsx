import { BookOpenCheck, FileText, PlayCircle, Scale } from "lucide-react";

const VIDEO_URL = process.env.NEXT_PUBLIC_HOME_VIDEO_URL?.trim();
const VIDEO_POSTER_URL = process.env.NEXT_PUBLIC_HOME_VIDEO_POSTER_URL?.trim();
const VIDEO_CAPTIONS_URL = process.env.NEXT_PUBLIC_HOME_VIDEO_CAPTIONS_URL?.trim();

const TOUR_STEPS = [
  {
    title: "أدخل الوقائع",
    description: "اكتب المسألة أو ارفع المستند دون الحاجة إلى معرفة المصطلح النظامي مسبقًا.",
    icon: FileText,
  },
  {
    title: "راجع السند",
    description: "انتقل من التحليل إلى النصوص والأحكام التي استند إليها المخرج.",
    icon: BookOpenCheck,
  },
  {
    title: "أكمل ملف القضية",
    description: "احفظ الجلسة والمستندات والدفوع والمخرجات في سياق واحد.",
    icon: Scale,
  },
];

/**
 * مساحة الجولة المرئية في الصفحة العامة.
 * لا يُعرض الفيديو الفعلي إلا عند توفير ملف ترجمة نصية، التزامًا بإتاحة المحتوى.
 */
export function HomeVideoShowcase() {
  const canRenderVideo = Boolean(VIDEO_URL && VIDEO_CAPTIONS_URL);

  return (
    <section id="tour" className="scroll-mt-24 border-b border-[var(--ink-08)] bg-[var(--paper)] px-4 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="text-start">
          <p className="text-sm font-semibold text-[var(--gold-dark)]">جولة مرئية</p>
          <h2 className="mt-2 font-display text-3xl font-bold leading-tight text-[var(--navy)] sm:text-4xl">
            شاهد مسار العمل داخل حكيم
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-60)] sm:text-base">
            مقطع قصير يوضح انتقال المسألة من الوقائع إلى البحث والسند وملف القضية.
          </p>

          <ol className="mt-7 grid gap-3">
            {TOUR_STEPS.map(({ title, description, icon: Icon }, index) => (
              <li key={title} className="flex gap-4 rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-[var(--hakeem-bg)] p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--r-md)] bg-[var(--navy)] text-[var(--gold-pale)]">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-bold text-[var(--navy)]">
                    <span className="me-2 font-mono text-[var(--gold-dark)]">{index + 1}</span>
                    {title}
                  </p>
                  <p className="mt-1 text-xs leading-6 text-[var(--ink-60)]">{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="overflow-hidden rounded-[var(--r-2xl)] border border-[var(--gold-border)] bg-[var(--navy)] shadow-[var(--sh-md)]">
          <div className="aspect-video">
            {canRenderVideo ? (
              <video
                controls
                playsInline
                preload="metadata"
                poster={VIDEO_POSTER_URL || undefined}
                className="h-full w-full object-cover"
                aria-label="جولة تعريفية في منصة حكيم"
              >
                <source src={VIDEO_URL} />
                <track
                  kind="captions"
                  src={VIDEO_CAPTIONS_URL}
                  srcLang="ar"
                  label="العربية"
                  default
                />
                متصفحك لا يدعم تشغيل الفيديو. يمكنك متابعة شرح القدرات من النص المجاور.
              </video>
            ) : (
              <div
                className="flex h-full flex-col items-center justify-center px-6 text-center text-white"
                role="img"
                aria-label="مساحة مهيأة لمقطع ترويجي يشرح رحلة العمل داخل حكيم"
              >
                <span className="grid h-16 w-16 place-items-center rounded-full border border-white/15 bg-white/10 text-[var(--gold-bright)]">
                  <PlayCircle className="h-8 w-8" aria-hidden />
                </span>
                <p className="mt-5 font-display text-xl font-bold">جولة تعريفية في حكيم</p>
                <p className="mt-2 max-w-md text-sm leading-7 text-white/65">
                  المساحة جاهزة لإضافة مقطع ترويجي قصير مع صورة غلاف وترجمة نصية عربية.
                </p>
                <span className="mt-5 rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">
                  دون تشغيل تلقائي
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
