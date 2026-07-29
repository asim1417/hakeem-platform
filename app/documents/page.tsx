import type { Metadata } from "next";
import Link from "next/link";
import styles from "./landing.module.css";
import {
  AlertIcon,
  DocScaleIcon,
  DriveIcon,
  EyeIcon,
  ExportIcon,
  FolderIcon,
  LockIcon,
  QuoteIcon,
  SaveIcon,
  ScanIcon,
  SearchIcon,
  ShieldIcon,
  TableIcon,
  TagIcon,
  UploadIcon
} from "@/components/ui/HakeemIcons";

export const metadata: Metadata = {
  title: "منصة الوثائق — قراءة وفحص المستندات القانونية",
  description:
    "ارفع وثائقك القانونية (PDF/Word/نص) وتصفّحها مقروءةً ومصنّفةً ومرمّزة: بحث اشتقاقي، تلوين كيانات، جداول مشتقة، مقتطفات، تصدير، وقفل مشفّر — التحليل كله في متصفحك."
};

// أيقونات خطية موحّدة (HakeemIcons) بدل الإيموجي — وفق دليل الهوية البصرية
const FEATURES = [
  { ic: UploadIcon, t: "رفع مباشر", d: "PDF نصّي وWord وTXT وJSON — يُستخرج النص في متصفحك دون أن يغادر الملف جهازك.", soon: false },
  { ic: ScanIcon, t: "قراءة ضوئية", d: "الصور والوثائق الممسوحة ضوئياً تُقرأ عربياً داخل متصفحك — الصورة لا تُرفع لأي خادم أثناء القراءة المحلية.", soon: false },
  { ic: DriveIcon, t: "استيراد من Drive", d: "اربط حساب التخزين السحابي واستورد مستنداتك مباشرةً — قراءة فقط للملفات التي تختارها.", soon: true },
  { ic: TagIcon, t: "تصنيف وترميز آلي", d: "نوع الوثيقة والجهة المُصدِرة والسنة، ورمز أرشيفي قابل للمراجعة وفق مرجع تشغيلي.", soon: false },
  { ic: SearchIcon, t: "بحث بمستوى المحترفين", d: "عبارة دقيقة، استبعاد، «أو»، اشتقاق صرفي، وترتيب بالصلة مع تنقّل بين المطابقات.", soon: false },
  { ic: EyeIcon, t: "قراءة مريحة", d: "تلوين الأطراف والمبالغ والتواريخ والأنظمة، خطوط وأحجام وسمات (فاتح/ليلي/ورقي)، ووضع قراءة صافٍ.", soon: false },
  { ic: TableIcon, t: "جداول تُبنى وحدها", d: "الخط الزمني، الصكوك، المبالغ، الأنظمة، المحطات الإجرائية، الإحصاءات، المصطلحات، والأكثر تكراراً — كلها من وثائقك.", soon: false },
  { ic: AlertIcon, t: "كشف غير الواضح", d: "الكلمات المشوّهة من المسح الضوئي تُعلَّم بتسطير متموّج ومؤشر جودة لكل وثيقة.", soon: false },
  { ic: QuoteIcon, t: "مقتطفات وملاحظات", d: "ظلّل أي نص واحفظه كمقتطف مسنَد لمصدره، وعلّم الوثائق (مهم/روجع/يحتاج مراجعة).", soon: false },
  { ic: SaveIcon, t: "قضاياك محفوظة", d: "احفظ مجموعة الوثائق بملاحظاتها في حسابك وافتحها لاحقاً — أو صدّرها نسخة مقفلة مشفّرة.", soon: false },
  { ic: ExportIcon, t: "تصدير احترافي", d: "Word وطباعة/PDF وHTML وبطاقات CSV والمقتطفات — بنطاق تختاره (المحدد/المطابق/الكل).", soon: false }
];

const STEPS = [
  { t: "ارفع أو الصق", d: "ملف PDF/Word أو نص منسوخ — الاستخراج يتم محلياً في متصفحك." },
  { t: "افحص فوراً", d: "تصنيف، رمز، كيانات مظللة، جودة قراءة، ومصطلحات — في أقل من ثانية." },
  { t: "اعمل على الملف", d: "ابحث، قارن، اقتطف، علّم، وتنقّل بين الجداول المشتقة." },
  { t: "احفظ وصدّر", d: "احفظ القضية في حسابك أو صدّرها Word/PDF/CSV أو نسخة مقفلة." }
];

// بنود الخصوصية بأيقونات جانبية (تحسين المسح البصري — ملحوظة التقرير #7)
const PRIVACY = [
  { ic: ShieldIcon, t: "استخراج النص والتصنيف والكيانات والبحث: كلها تُحسب داخل متصفحك — لا يُرسل نص الوثيقة لأي خادم أثناء الفحص." },
  { ic: SaveIcon, t: "«حفظ القضية» اختياري بالكامل: إن اخترته تُحفظ الوثائق في قاعدة بيانات المنصة مرتبطةً بمتصفحك." },
  { ic: LockIcon, t: "النسخة المقفلة تُشفَّر على جهازك بكلمة مرورك قبل أن تُنزَّل — المفتاح لا يُرسل للخادم." },
  { ic: ScanIcon, t: "الوثائق الممسوحة ضوئياً (صور بلا نص) تُكتشف ويُقترح لها قراءة ضوئية — لا نُخمّن نصاً غير موجود." }
];

export default function DocumentsLandingPage() {
  return (
    <div className={styles.root} dir="rtl">
      <div className={styles.topbar}>
        <div className={styles.topbarIn}>
          <span className={styles.seal} aria-hidden="true">
            <DocScaleIcon size={20} />
          </span>
          <span className={styles.brand}>
            منصة الوثائق<span>· قراءة وفحص المستندات القانونية</span>
          </span>
          <Link href="/documents/tool" className={styles.topGhost}>
            البحث السريع
          </Link>
          <Link href="/documents/app" className={styles.topCta}>
            محطة العمل — ابدأ الآن
          </Link>
        </div>
      </div>

      <header className={styles.hero}>
        <div className={styles.heroIn}>
          <span className={styles.eyebrow}>مخرج آلي يحتاج مراجعة بشرية — وخصوصية بلا مساومة</span>
          <h1>
            وثيقتك القانونية،
            <br />
            مقروءةً ومُفهرسةً ومُرمَّزة
          </h1>
          <p className={styles.lede}>
            ارفع الصك أو العقد أو المذكرة وشاهدها خلال ثوانٍ: مصنّفةً بنوعها وجهتها، مرمّزةً برمز أرشيفي هرمي،
            بكياناتها مظلّلة (أطراف، مبالغ، تواريخ، أنظمة)، وبمؤشر جودةٍ يكشف ما يحتاج مراجعة — والتحليل كله
            يجري داخل متصفحك.
          </p>
          <div className={styles.ctas}>
            <Link href="/documents/app" className={styles.primary}>
              افتح محطة العمل ←
            </Link>
            <Link href="/documents/tool" className={styles.secondary}>
              البحث السريع
            </Link>
            <span className={styles.privacyChip}>
              <ShieldIcon size={16} /> نص وثيقتك لا يغادر متصفحك أثناء الفحص
            </span>
          </div>
        </div>
      </header>

      <main className={styles.wrap}>
        <h2 className={styles.sectionTitle}>قسمان لمهمتين</h2>
        <div className={styles.grid}>
          <Link href="/documents/tool" className={styles.card} style={{ textDecoration: "none" }}>
            <span className={styles.ic} aria-hidden="true">
              <SearchIcon size={26} />
            </span>
            <h3>البحث السريع</h3>
            <p>
              ارفع أي صيغة (نص/Word/PDF/صور بـ OCR) وابحث فوراً ببحث مطبَّع يتجاهل التشكيل
              وفروق الهمزات مع تظليل المطابقات — وثائقك تُحفَظ وتعود إليها متى شئت.
            </p>
          </Link>
          <Link href="/documents/app" className={styles.card} style={{ textDecoration: "none" }}>
            <span className={styles.ic} aria-hidden="true">
              <FolderIcon size={26} />
            </span>
            <h3>محطة العمل — الفحص المتقدم</h3>
            <p>
              فحص ملف القضية كاملاً: تصنيف وترميز أرشيفي، كيانات مظلَّلة، جداول مشتقة، مقتطفات
              وملاحظات، وتصدير احترافي — لكل وثائق القضية معاً.
            </p>
          </Link>
        </div>

        <h2 className={styles.sectionTitle}>ماذا تفعل المنصة؟</h2>
        <div className={styles.grid}>
          {FEATURES.map((f) => (
            <div key={f.t} className={styles.card} style={f.soon ? { opacity: 0.88 } : undefined}>
              <span className={styles.ic} aria-hidden="true">
                <f.ic size={26} />
              </span>
              <h3>
                {f.t}
                {f.soon ? (
                  <span className="ms-2 inline-flex rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 align-middle">
                    قريبًا
                  </span>
                ) : null}
              </h3>
              <p>{f.d}</p>
            </div>
          ))}
        </div>

        <h2 className={styles.sectionTitle}>كيف تعمل؟ أربع خطوات</h2>
        <div className={styles.steps}>
          {STEPS.map((s) => (
            <div key={s.t} className={styles.step}>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
          ))}
        </div>

        <section className={styles.privacy}>
          <h2>الخصوصية أولاً</h2>
          <ul>
            {PRIVACY.map((item) => (
              <li key={item.t}>
                <span className={styles.privacyIc} aria-hidden="true">
                  <item.ic size={18} />
                </span>
                <span>{item.t}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className={styles.footer}>
        <div>
          <b>منصة الوثائق</b> — قراءة وفحص المستندات القانونية
        </div>
        <p className={styles.legal}>كل مخرجات المنصة «مساعدة آلية تحتاج مراجعة المحامي»، وليست رأياً قانونياً نهائياً.</p>
      </footer>
    </div>
  );
}
