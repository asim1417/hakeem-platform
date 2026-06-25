/**
 * إعداد الذكاء الاصطناعي المركزي — مصدر واحد يقرأه كل من البوابة والقاضي.
 *
 * الأولوية: إعداد قاعدة البيانات (قابل للتحرير من الإدارة، المفتاح مشفّر) ثم متغيرات البيئة.
 * كل قراءات القاعدة مغلّفة بـ try/catch: إن لم يُنشأ جدول app_settings بعد (قبل prisma db push)
 * يعود التطبيق لمتغيرات البيئة دون تعطّل.
 *
 * المفتاح يُخزّن مشفّراً (AES-256-GCM) بمفتاح مُشتقّ من AUTH_SECRET، ولا يُعاد للعميل أبداً.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { prisma } from "@/lib/prisma";

const SETTINGS_KEY = "ai_provider";
const ENC_PREFIX = "enc:v1:";

export type AiProvider = "openai" | "anthropic" | "gemini" | "custom" | "offline";

export type EffectiveAiConfig = {
  provider: AiProvider;
  apiKey: string | null;
  model: string | null;
  baseUrl: string | null;
  source: "db" | "env" | "offline";
};

type StoredAiSettings = {
  provider?: AiProvider;
  model?: string;
  baseUrl?: string;
  apiKeyEnc?: string; // مشفّر
};

function encryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "hakeem-dev-fallback-secret";
  return scryptSync(secret, "hakeem-ai-settings", 32);
}

export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENC_PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(stored: string): string | null {
  if (!stored || !stored.startsWith(ENC_PREFIX)) return null;
  try {
    const raw = Buffer.from(stored.slice(ENC_PREFIX.length), "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/**
 * يضمن وجود جدول app_settings (إنشاء idempotent عند أول حفظ) — يلغي الحاجة لتشغيل
 * prisma db push يدوياً. آمن: IF NOT EXISTS، ومغلّف بـ try/catch فإن غابت صلاحية
 * الإنشاء يعود للسلوك السابق (رسالة توجيه لتشغيل db push).
 */
async function ensureSettingsTable(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'CREATE TABLE IF NOT EXISTS "app_settings" ("key" TEXT NOT NULL, "value" JSONB NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key"));'
  );
}

/** يقرأ إعداد القاعدة (إن وُجد الجدول). سقوط آمن إلى null. */
async function readStored(): Promise<StoredAiSettings | null> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
    if (!row || typeof row.value !== "object" || row.value === null) return null;
    return row.value as StoredAiSettings;
  } catch {
    return null; // الجدول غير موجود بعد أو خطأ قراءة → بيئة
  }
}

function envConfig(): EffectiveAiConfig {
  const provider = (process.env.AI_PROVIDER || "offline").toLowerCase() as AiProvider;
  const keyByProvider: Record<string, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    custom: process.env.CUSTOM_AI_API_KEY
  };
  const modelByProvider: Record<string, string | undefined> = {
    openai: process.env.OPENAI_MODEL,
    anthropic: process.env.ANTHROPIC_MODEL,
    gemini: process.env.GEMINI_MODEL,
    custom: process.env.CUSTOM_AI_MODEL
  };
  const apiKey = keyByProvider[provider] || null;
  return {
    provider: apiKey || provider === "offline" ? provider : "offline",
    apiKey,
    model: modelByProvider[provider] || null,
    baseUrl: provider === "custom" ? process.env.CUSTOM_AI_BASE_URL || null : null,
    source: provider !== "offline" && apiKey ? "env" : "offline"
  };
}

/** الإعداد الفعّال: قاعدة البيانات أولاً (إن كان مفتاحها صالحاً) ثم البيئة. */
export async function resolveAiConfig(): Promise<EffectiveAiConfig> {
  const stored = await readStored();
  if (stored?.provider && stored.provider !== "offline" && stored.apiKeyEnc) {
    const apiKey = decryptSecret(stored.apiKeyEnc);
    if (apiKey) {
      return {
        provider: stored.provider,
        apiKey,
        model: stored.model || null,
        baseUrl: stored.baseUrl || null,
        source: "db"
      };
    }
  }
  return envConfig();
}

/** حالة الإعداد للعرض في الإدارة — دون كشف المفتاح. */
export async function getAiStatus(): Promise<{
  provider: AiProvider;
  model: string | null;
  source: "db" | "env" | "offline";
  configured: boolean;
  keyMasked: string | null;
  baseUrl: string | null;
}> {
  const stored = await readStored();
  if (stored?.provider && stored.provider !== "offline" && stored.apiKeyEnc) {
    const key = decryptSecret(stored.apiKeyEnc);
    return {
      provider: stored.provider,
      model: stored.model || null,
      source: "db",
      configured: Boolean(key),
      keyMasked: key ? maskKey(key) : null,
      baseUrl: stored.baseUrl || null
    };
  }
  const env = envConfig();
  return {
    provider: env.provider,
    model: env.model,
    source: env.source,
    configured: Boolean(env.apiKey),
    keyMasked: env.apiKey ? maskKey(env.apiKey) : null,
    baseUrl: env.baseUrl
  };
}

/**
 * كشف المفتاح المحفوظ كاملاً — للمدير فقط وعبر طلب صريح (يُستدعى من مسار محمي
 * بصلاحية USERS_MANAGE مع تسجيل في سجلّ التدقيق). خفضٌ أمني مقصود ومحدود.
 */
export async function revealAiKey(): Promise<{ provider: AiProvider; key: string | null; source: "db" | "env" | "offline" }> {
  const cfg = await resolveAiConfig();
  return { provider: cfg.provider, key: cfg.apiKey ?? null, source: cfg.source };
}

/** يحفظ إعداد الذكاء في القاعدة (يشفّر المفتاح). إن تُرك المفتاح فارغاً يُبقي القديم. */
export async function saveAiSettings(input: {
  provider: AiProvider;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
}): Promise<{ ok: boolean; message?: string }> {
  // إنشاء الجدول تلقائياً إن لم يكن موجوداً (يلغي الحاجة لتشغيل db push يدوياً)
  await ensureSettingsTable().catch(() => undefined);
  try {
    const existing = await readStored();
    let apiKeyEnc = existing?.apiKeyEnc ?? "";
    if (input.apiKey && input.apiKey.trim()) {
      apiKeyEnc = encryptSecret(input.apiKey.trim());
    }
    const value: StoredAiSettings = {
      provider: input.provider,
      model: input.model?.trim() || undefined,
      baseUrl: input.baseUrl?.trim() || undefined,
      apiKeyEnc: apiKeyEnc || undefined
    };
    await prisma.appSetting.upsert({
      where: { key: SETTINGS_KEY },
      create: { key: SETTINGS_KEY, value: value as object },
      update: { value: value as object }
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message:
        "تعذّر حفظ الإعداد. قد لا يملك مستخدم القاعدة صلاحية إنشاء الجداول — شغّل: npm run db:push من Codespace."
    };
  }
}

function maskKey(key: string): string {
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

/** النموذج الافتراضي لكل مزوّد عند غياب تحديد صريح في الإعداد. */
export function defaultModelFor(provider: AiProvider): string {
  switch (provider) {
    case "anthropic":
      return "claude-sonnet-4-6";
    case "openai":
    case "custom":
      return "gpt-4o-mini";
    case "gemini":
      return "gemini-1.5-flash";
    default:
      return "offline";
  }
}

/**
 * نداء إكمال خام موحّد لكل المزوّدين انطلاقاً من الإعداد الفعّال (DB أولاً ثم البيئة).
 * مصدر واحد لمنطق الشبكة يستعمله callCentralProvider وresolveAiProvider معاً.
 * يرمي عند فشل الشبكة/الاستجابة؛ يترك للمستدعي قرار السقوط المنظّم.
 */
export async function completeWithConfig(
  cfg: EffectiveAiConfig,
  system: string,
  user: string,
  maxTokens: number
): Promise<string> {
  if (cfg.provider === "offline" || !cfg.apiKey) return "";
  const model = cfg.model || defaultModelFor(cfg.provider);
  const mt = Math.min(Math.max(maxTokens, 1), 4096);
  const sys = (system ?? "").trim();
  const usr = String(user ?? "");

  if (cfg.provider === "openai" || cfg.provider === "custom") {
    const url =
      cfg.provider === "custom" && cfg.baseUrl
        ? `${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`
        : "https://api.openai.com/v1/chat/completions";
    const messages = [...(sys ? [{ role: "system", content: sys }] : []), { role: "user", content: usr }];
    const resp = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, max_tokens: mt, messages, temperature: 0.2 })
    });
    if (!resp.ok) throw new Error(`provider ${resp.status}`);
    const data = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content || "";
  }

  if (cfg.provider === "anthropic") {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model, max_tokens: mt, ...(sys ? { system: sys } : {}), messages: [{ role: "user", content: usr }] })
    });
    if (!resp.ok) throw new Error(`provider ${resp.status}`);
    const data = (await resp.json()) as { content?: Array<{ text?: string }> };
    return data.content?.map((p) => p.text).filter(Boolean).join("\n") || "";
  }

  if (cfg.provider === "gemini") {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(sys ? { systemInstruction: { parts: [{ text: sys }] } } : {}),
          contents: [{ role: "user", parts: [{ text: usr }] }],
          generationConfig: { maxOutputTokens: mt, temperature: 0.2 }
        })
      }
    );
    if (!resp.ok) throw new Error(`provider ${resp.status}`);
    const data = (await resp.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return data.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("\n") || "";
  }

  return "";
}
