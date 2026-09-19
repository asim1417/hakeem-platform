import { createHash } from "node:crypto";

export type OfficialLegalSource = "NCAR" | "BOE" | "UQN";

const ALLOWED_HOSTS: Record<OfficialLegalSource, readonly string[]> = {
  NCAR: ["ncar.gov.sa", "www.ncar.gov.sa"],
  BOE: ["laws.boe.gov.sa", "boe.gov.sa", "www.boe.gov.sa"],
  UQN: ["uqn.gov.sa", "www.uqn.gov.sa"],
};

export const OFFICIAL_SOURCE_POLICY = {
  NCAR: {
    role: "primary-corpus",
    automatedCollection: true,
    notes: "يفضّل رابط البيانات المفتوحة المقروء آلياً متى كان منشوراً؛ وإلا يقتصر الجمع على صفحات الفهرس/التفاصيل الرسمية.",
  },
  BOE: {
    role: "consolidated-verification",
    automatedCollection: true,
    notes: "مصدر تحقق للنصوص المجمعة وحالة النظام والتحديثات؛ لا يُفترض مسار API غير معلن.",
  },
  UQN: {
    role: "publication-evidence",
    automatedCollection: false,
    notes: "لا كشط شامل. يسمح فقط بمدخل صريح منشور للاستهلاك الآلي (مثل RSS) أو موافقة/واجهة رسمية مخصصة.",
  },
} as const;

function hostMatches(host: string, allowed: readonly string[]): boolean {
  const normalized = host.toLowerCase().replace(/\.$/, "");
  return allowed.some((item) => normalized === item || normalized.endsWith("." + item));
}

export function assertOfficialSourceUrl(source: OfficialLegalSource, raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("OFFICIAL_SOURCE_INVALID_URL");
  }
  if (url.protocol !== "https:") throw new Error("OFFICIAL_SOURCE_HTTPS_REQUIRED");
  if (url.username || url.password) throw new Error("OFFICIAL_SOURCE_USERINFO_FORBIDDEN");
  if (url.port && url.port !== "443") throw new Error("OFFICIAL_SOURCE_PORT_FORBIDDEN");
  if (!hostMatches(url.hostname, ALLOWED_HOSTS[source])) {
    throw new Error(`OFFICIAL_SOURCE_HOST_FORBIDDEN:${url.hostname}`);
  }
  return url;
}

export function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function mayAutomateSource(source: OfficialLegalSource, explicitMachineReadableEntry = false): boolean {
  if (source === "UQN") return explicitMachineReadableEntry;
  return true;
}

export function sanitizeOfficialRequestHeaders(input?: Record<string, string>): Record<string, string> {
  const blocked = new Set(["authorization", "cookie", "proxy-authorization", "x-api-key"]);
  return Object.fromEntries(
    Object.entries(input ?? {}).filter(([key]) => !blocked.has(key.toLowerCase())),
  );
}
