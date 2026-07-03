import type { Metadata } from "next";
import Link from "next/link";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "منصة الوثائق — قراءة وفحص المستندات القانونية",
  description:
    "ارفع وثائقك القانونية (PDF/Word/نص) وتصفّحها مقروءةً ومصنّفةً ومرمّزة: بحث اشتقاقي، تلوين كيانات، جداول مشتقة، مقتطفات، تصدير، وقفل مشفّر — التحليل كله في متصفحك."
};

const FEATURES = [
  { ic: "📂", t: "رفع مباشر", d: "PDF نصّي وWord وTXT وJSON — يُستخرج النص في متصفحك دون أن يغادر الملف جهازك." },
  { ic: "🏷️", t: "تصنيف وترميز آلي", d: "نوع الوثيقة والجهة المُصدِرة والسنة، ورمز هرمي أرشيفي مثل HKM.TIJ.1446.001 — وفق مرجع تشغيلي قابل للمراجعة." },
  { ic: "🔎", t: "بحث بمستوى المحترفين", d: "عبارة دقيقة، استبعاد، «أو»، اشتقاق صرفي، وترتيب بالصلة BM25 مع تنقّل بين المطابقات كبرنامج وورد." },
  { ic: "🎨", t: "قراءة مريحة", d: "تلوين الأطراف والمبالغ والتواريخ والأنظمة، خطوط وأحجام وسمات (فاتح/ليلي/ورقي)، ووضع قراءة صافٍ." },
  { ic: "📊", t: "جداول تُبنى وحدها", d: "الخط الزمني، الصكوك، المبالغ، الأنظمة، المحطات الإجرائية، الإحصاءات، المصطلحات، والأكثر تكراراً — كلها من وثائقك." },
  { ic: "⚠️", t: "كشف غير الواضح", d: "الكلمات المشوّهة من المسح الضوئي تُعلَّم بتسطير متموّج ومؤشر جودة لكل وثيقة." },
  { ic: "✂️", t: "مقتطفات وملاحظات", d: "ظلّل أي نص واحفظه كمقتطف مسنَد لمصدره، وعلّم الوثائق (مهم/روجع/يحتاج مراجعة)." },
  { ic: "💾", t: "قضاياك محفوظة", d: "احفظ مجموعة الوثائق بملاحظاتها في حسابك وافتحها من أي وقت — أو صدّرها نسخة مقفلة مشفّرة AES-GCM." },
  { ic: "📤", t: "تصدير احترافي", d: "Word وطباعة/PDF وHTML وبطاقات CSV والمقتطفات — بنطاق تختاره (المحدد/المطابق/الكل)." }
];

const STEPS = [
  { t: "ارفع أو الصق", d: "ملف PDF/Word أو نص منسوخ — الاستخراج يتم محلياً في متصفحك." },
  { t: "افحص فوراً", d: "تصنيف، رمز، كيانات مظللة، جودة قراءة، ومصطلحات — في أقل من ثانية." },
  { t: "اعمل على الملف", d: "ابحث، قارن، اقتطف، علّم، وتنقّل بين الجداول المشتقة." },
  { t: "احفظ وصدّر", d: "احفظ القضية في حسابك أو صدّرها Word/PDF/CSV أو نسخة مقفلة." }
];

export default function DocumentsLandingPage() {
  return (
    <div className={styles.root} dir="rtl">
      <div className={styles.topbar}>
        <div className={styles.topbarIn}>
          <span className={styles.seal} aria-hidden="true">
            و
          </span>
          <span className={styles.brand}>
            منصة الوثائق<span>· قراءة وفحص المستندات القانونية</span>
          </span>
          <Link href="/documents/app" className={styles.topCta}>
            ابدأ الآن
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
            <span className={styles.privacyChip}>🔒 نص وثيقتك لا يغادر متصفحك أثناء الفحص</span>
          </div>
        </div>
      </header>

      <main className={styles.wrap}>
        <h2 className={styles.sectionTitle}>ماذا تفعل المنصة؟</h2>
        <div className={styles.grid}>
          {FEATURES.map((f) => (
            <div key={f.t} className={styles.card}>
              <span className={styles.ic} aria-hidden="true">
                {f.ic}
              </span>
              <h3>{f.t}</h3>
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
            <li>استخراج النص والتصنيف والكيانات والبحث: كلها تُحسب داخل متصفحك — لا يُرسل نص الوثيقة لأي خادم أثناء الفحص.</li>
            <li>«حفظ القضية» اختياري بالكامل: إن اخترته تُحفظ الوثائق في قاعدة بيانات المنصة مرتبطةً بمتصفحك.</li>
            <li>النسخة المقفلة تُشفَّر على جهازك بمعيار AES-GCM (مفتاح مشتق بكلمة مرورك، PBKDF2 ×150 ألف) قبل أن تُنزَّل.</li>
            <li>الوثائق الممسوحة ضوئياً (صور بلا نص) تُكتشف ويُطلب لها OCR خارجي — لا نُخمّن نصاً غير موجود.</li>
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
