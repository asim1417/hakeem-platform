// ─────────────────────────────────────────────────────────────────────────────
// credentials — توليد اسم مستخدم وكلمة مرور سهلة القراءة للمالك/الإدارة.
// ─────────────────────────────────────────────────────────────────────────────

const EASY_WORDS = [
  "Najm",
  "Qalam",
  "Diwan",
  "Hukm",
  "Adl",
  "Bayt",
  "Noor",
  "Sakr",
  "Fajr",
  "Rawd",
  "Amid",
  "Wathiq",
];

/** يحوّل الاسم إلى مقطع لاتيني بسيط صالح كاسم مستخدم. */
export function slugifyUsername(input: string): string {
  const arabicMap: Record<string, string> = {
    ا: "a",
    أ: "a",
    إ: "i",
    آ: "a",
    ب: "b",
    ت: "t",
    ث: "th",
    ج: "j",
    ح: "h",
    خ: "kh",
    د: "d",
    ذ: "dh",
    ر: "r",
    ز: "z",
    س: "s",
    ش: "sh",
    ص: "s",
    ض: "d",
    ط: "t",
    ظ: "z",
    ع: "a",
    غ: "gh",
    ف: "f",
    ق: "q",
    ك: "k",
    ل: "l",
    م: "m",
    ن: "n",
    ه: "h",
    و: "w",
    ي: "y",
    ى: "a",
    ة: "a",
    ء: "",
    ئ: "e",
    ؤ: "o",
  };

  let out = "";
  for (const ch of input.trim().toLowerCase()) {
    if (/[a-z0-9]/.test(ch)) {
      out += ch;
      continue;
    }
    if (ch === " " || ch === "-" || ch === "_" || ch === ".") {
      out += ".";
      continue;
    }
    if (arabicMap[ch] !== undefined) {
      out += arabicMap[ch];
      continue;
    }
  }
  out = out.replace(/\.+/g, ".").replace(/^\.+|\.+$/g, "").replace(/[^a-z0-9.]/g, "");
  if (out.length < 3) out = `user.${out}`.replace(/\.$/, "");
  return out.slice(0, 24) || "user";
}

/** يولّد اسم مستخدم سهل من الاسم أو عشوائيًا. */
export function generateUsername(name?: string): string {
  const base = name?.trim() ? slugifyUsername(name) : EASY_WORDS[Math.floor(Math.random() * EASY_WORDS.length)].toLowerCase();
  const suffix = String(1000 + Math.floor(Math.random() * 9000));
  return `${base}.${suffix}`.replace(/\.\./g, ".").slice(0, 32);
}

/**
 * كلمة مرور سهلة التذكر: كلمة + ٤ أرقام + رمز.
 * مثال: Najm-4821!
 */
export function generateEasyPassword(): string {
  const word = EASY_WORDS[Math.floor(Math.random() * EASY_WORDS.length)];
  const digits = String(1000 + Math.floor(Math.random() * 9000));
  return `${word}-${digits}!`;
}

/** يبني بريدًا داخليًا من اسم المستخدم إن لم يُمرَّر بريد. */
export function emailFromUsername(username: string, domain = "hakeem.local"): string {
  const local = slugifyUsername(username).replace(/\./g, ".") || "user";
  return `${local}@${domain}`;
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{2,31}$/i.test(username.trim());
}
