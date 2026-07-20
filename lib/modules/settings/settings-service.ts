// ─────────────────────────────────────────────────────────────────────────────
// settings-service — إعدادات التشغيل المُدارة من الموقع (بدل تعديل Vercel).
//
// المبدأ: تُخزَّن المفاتيح في جدول app_settings (الحسّاسة مُشفّرة AES-256-GCM)، وتُحمَّل
// إلى process.env عند إقلاع الخادم (instrumentation) — فتعمل كل قرّاء process.env الحاليين
// دون تعديل. إضافيّ وآمن: إن غاب الجدول/المفتاح يبقى متغيّر البيئة (Vercel) هو المصدر.
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from "@/lib/prisma";

// node:crypto محمّل بكسلٍ ومُخفى عمدًا عن مُحلِّل الحزم (webpack): هذه الوحدة Node-only
// (تشفير AES-256-GCM) لكن instrumentation.ts يسحبها إلى رسم حزمة Edge أيضًا؛ والإخفاء
// يمنع دخول node:crypto رسمَ Edge (حيث لا يتوفّر) — دون أي تغيير في منطق التشفير.
// آمن: حارس NEXT_RUNTIME في instrumentation يمنع Edge من استدعاء أي دالّة هنا أصلاً،
// وفي وقت Node يعيد require الحقيقيّ وحدةَ التشفير كاملةً.
type NodeCrypto = typeof import("node:crypto");
let _nodeCrypto: NodeCrypto | null = null;
function nodeCrypto(): NodeCrypto {
  // eslint-disable-next-line no-eval — indirect eval لجلب require الحقيقي بعيدًا عن التحزيم
  if (!_nodeCrypto) _nodeCrypto = (0, eval)("require")("node:crypto") as NodeCrypto;
  return _nodeCrypto;
}

// سجلّ المفاتيح التي تُدار من اللوحة (المجموعة + الوصف + هل هي سرّ).
export type ManagedKey = { key: string; label: string; secret: boolean; group: string; placeholder?: string };

export const MANAGED_KEYS: ManagedKey[] = [
  { key: "ANTHROPIC_API_KEY", label: "مفتاح Claude (Anthropic)", secret: true, group: "الذكاء الاصطناعي", placeholder: "sk-ant-..." },
  { key: "EMBEDDING_API_KEY", label: "مفتاح التضمين الدلالي (Embeddings)", secret: true, group: "الذكاء الاصطناعي", placeholder: "sk-..." },
  { key: "OPENSEARCH_URL", label: "رابط عنقود OpenSearch", secret: false, group: "البحث (OpenSearch)", placeholder: "https://...bonsaisearch.net" },
  { key: "OPENSEARCH_USERNAME", label: "اسم مستخدم OpenSearch", secret: true, group: "البحث (OpenSearch)" },
  { key: "OPENSEARCH_PASSWORD", label: "كلمة مرور OpenSearch", secret: true, group: "البحث (OpenSearch)" },
  { key: "GOOGLE_CLIENT_ID", label: "Google Client ID", secret: false, group: "دخول Google", placeholder: "...apps.googleusercontent.com" },
  { key: "GOOGLE_CLIENT_SECRET", label: "Google Client Secret", secret: true, group: "دخول Google" },
  { key: "AZURE_AD_CLIENT_ID", label: "Microsoft Entra Client ID", secret: false, group: "بوابة الدخول (Microsoft)", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
  { key: "AZURE_AD_CLIENT_SECRET", label: "Microsoft Entra Client Secret", secret: true, group: "بوابة الدخول (Microsoft)" },
  { key: "AZURE_AD_TENANT_ID", label: "Microsoft Entra Tenant ID", secret: false, group: "بوابة الدخول (Microsoft)", placeholder: "common أو معرف المستأجر" },
  {
    key: "OAUTH_ADMIN_EMAILS",
    label: "بُرد مدراء OAuth (بفواصل)",
    secret: false,
    group: "الدخول الموحّد",
    placeholder: "aasemalfarsi@gmail.com",
  },
  // ── Clerk (المصادقة الوحيدة) — المفتاح العلني يُفضَّل في Vercel كـ NEXT_PUBLIC_ ──
  { key: "CLERK_SECRET_KEY", label: "Clerk Secret Key", secret: true, group: "المصادقة (Clerk)", placeholder: "sk_live_..." },
  {
    key: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    label: "Clerk Publishable Key",
    secret: false,
    group: "المصادقة (Clerk)",
    placeholder: "pk_live_...",
  },
  { key: "CLERK_WEBHOOK_SECRET", label: "Clerk Webhook Secret (Svix)", secret: true, group: "المصادقة (Clerk)", placeholder: "whsec_..." },
  // ── الدفع والبريد والـ OTP — تُلصق هنا بدل Vercel ──
  { key: "MOYASAR_SECRET_KEY", label: "Moyasar Secret Key", secret: true, group: "الدفع (Moyasar)", placeholder: "sk_live_..." },
  { key: "MOYASAR_PUBLISHABLE_KEY", label: "Moyasar Publishable Key", secret: false, group: "الدفع (Moyasar)", placeholder: "pk_live_..." },
  { key: "RESEND_API_KEY", label: "Resend API Key (بريد الترحيب)", secret: true, group: "البريد", placeholder: "re_..." },
  { key: "RESEND_FROM", label: "عنوان المُرسِل", secret: false, group: "البريد", placeholder: "حكيم <onboarding@hakeem.sa>" },
  { key: "TWILIO_ACCOUNT_SID", label: "Twilio Account SID", secret: true, group: "OTP الجوال (Twilio)", placeholder: "AC..." },
  { key: "TWILIO_AUTH_TOKEN", label: "Twilio Auth Token", secret: true, group: "OTP الجوال (Twilio)" },
  { key: "TWILIO_FROM_NUMBER", label: "رقم الإرسال Twilio", secret: false, group: "OTP الجوال (Twilio)", placeholder: "+9665..." },
  { key: "OTP_DEV_REVEAL", label: "كشف رمز OTP للتطوير (true/false)", secret: false, group: "OTP الجوال (Twilio)", placeholder: "true" },
  { key: "FREE_QUOTA", label: "حصّة الاستخدام المجانية", secret: false, group: "الاشتراك والحصّة", placeholder: "20" },
  { key: "WARN_AT", label: "عتبة تنبيه نفاد الحصّة", secret: false, group: "الاشتراك والحصّة", placeholder: "3" },
];

const MANAGED_SET = new Set(MANAGED_KEYS.map((k) => k.key));
const SECRET_SET = new Set(MANAGED_KEYS.filter((k) => k.secret).map((k) => k.key));

// ── التشفير ──
function encKey(): Buffer {
  const secret = process.env.SETTINGS_SECRET || process.env.AUTH_SECRET || "hakeem-settings-dev-only";
  return nodeCrypto().scryptSync(secret, "hakeem-app-settings-salt", 32);
}

export function encryptValue(plain: string): string {
  const { createCipheriv, randomBytes } = nodeCrypto();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptValue(stored: string): string | null {
  try {
    const [ivB, tagB, ctB] = stored.split(":");
    if (!ivB || !tagB || !ctB) return null;
    const decipher = nodeCrypto().createDecipheriv("aes-256-gcm", encKey(), Buffer.from(ivB, "base64"));
    decipher.setAuthTag(Buffer.from(tagB, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ctB, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// ── القراءة/الكتابة ──
/** يجلب الإعدادات المُدارة مفكوكة التشفير (خريطة key→value). سقوط آمن إلى فارغ. */
export async function getAllSettings(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    // مقصور على المفاتيح المُدارة فقط — كي لا يتداخل مع إعدادات أخرى في app_settings.
    const rows = await prisma.appSetting.findMany({ where: { key: { in: MANAGED_KEYS.map((k) => k.key) } } });
    for (const r of rows) {
      const raw = typeof r.value === "string" ? r.value : String(r.value ?? "");
      const val = SECRET_SET.has(r.key) ? decryptValue(raw) : raw;
      if (val != null && val !== "") out.set(r.key, val);
    }
  } catch {
    // الجدول غير متاح → لا إعدادات، تبقى متغيّرات البيئة هي المصدر.
  }
  return out;
}

/** يحفظ مفتاحًا (يُشفّر إن كان سرًّا). قيمة فارغة = حذف المفتاح (رجوع لمتغيّر البيئة). */
export async function setSetting(key: string, rawValue: string, _updatedBy?: string): Promise<void> {
  if (!MANAGED_SET.has(key)) throw new Error(`مفتاح غير مُدار: ${key}`);
  const value = rawValue.trim();
  if (!value) {
    await prisma.appSetting.delete({ where: { key } }).catch(() => undefined);
    delete process.env[key];
    return;
  }
  const stored = SECRET_SET.has(key) ? encryptValue(value) : value;
  await prisma.appSetting.upsert({
    where: { key },
    update: { value: stored },
    create: { key, value: stored },
  });
  // تطبيق فوري على العملية الحالية (بقية النُّسخ تلتقطه عند إقلاعها).
  process.env[key] = value;
}

/** حالة العرض للّوحة: هل لكل مفتاح قيمة (من القاعدة أو البيئة)؟ لا نكشف قيم الأسرار. */
export async function getSettingsStatus(): Promise<Array<ManagedKey & { hasValue: boolean; source: "db" | "env" | "none"; preview?: string }>> {
  const db = await getAllSettings();
  return MANAGED_KEYS.map((mk) => {
    const inDb = db.has(mk.key);
    const envVal = process.env[mk.key];
    const source: "db" | "env" | "none" = inDb ? "db" : envVal ? "env" : "none";
    const value = inDb ? db.get(mk.key)! : envVal || "";
    const hasValue = Boolean(value);
    // معاينة غير حسّاسة فقط؛ الأسرار تُقنَّع.
    const preview = hasValue ? (mk.secret ? maskSecret(value) : value) : undefined;
    return { ...mk, hasValue, source, preview };
  });
}

function maskSecret(v: string): string {
  if (v.length <= 6) return "••••";
  return `${v.slice(0, 3)}••••${v.slice(-2)}`;
}

/** يُحمّل إعدادات القاعدة إلى process.env (تجاوز متغيّرات البيئة للمفاتيح المُدارة). يُستدعى عند الإقلاع. */
export async function hydrateEnvFromSettings(): Promise<number> {
  const db = await getAllSettings();
  let n = 0;
  for (const [key, value] of db) {
    if (MANAGED_SET.has(key) && value) {
      process.env[key] = value;
      n += 1;
    }
  }
  return n;
}
