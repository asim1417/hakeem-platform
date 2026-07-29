import { isIP } from "net";
import { lookup } from "dns/promises";

/** النطاقات الرسمية المسموح بها لمحرك رصد فقط. */
export const RASD_ALLOWED_HOSTS = [
  "laws.boe.gov.sa",
  "boe.gov.sa",
  "ncar.gov.sa",
  "www.ncar.gov.sa",
  "uqn.gov.sa",
  "www.uqn.gov.sa"
] as const;

export const RASD_MAX_REDIRECTS = 3;
export const RASD_MAX_RESPONSE_BYTES = 8 * 1024 * 1024; // 8 MiB
export const RASD_DEFAULT_TIMEOUT_MS = 20_000;
export const RASD_ALLOWED_PORTS = new Set([443]);

export type RasdUrlValidationOk = { ok: true; url: URL; host: string };
export type RasdUrlValidationErr = { ok: false; error: string; code: string };
export type RasdUrlValidation = RasdUrlValidationOk | RasdUrlValidationErr;

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, "");
}

function isAllowedHost(host: string): boolean {
  const normalized = normalizeHost(host);
  return RASD_ALLOWED_HOSTS.some((allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`));
}

function isPrivateOrBlockedIp(ip: string): boolean {
  const version = isIP(ip);
  if (!version) return true;

  if (version === 4) {
    const parts = ip.split(".").map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    if (a >= 224) return true; // multicast/reserved
    return false;
  }

  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // ULA
  if (normalized.startsWith("fe80")) return true; // link-local
  if (normalized.startsWith("ff")) return true; // multicast
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    if (isIP(mapped) === 4) return isPrivateOrBlockedIp(mapped);
  }
  return false;
}

/** تحقق تركيبي فقط (بدون DNS) — مناسب للاختبارات الحتمية. */
export function validateRasdUrlSyntax(raw: string): RasdUrlValidation {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, error: "رابط غير صالح.", code: "INVALID_URL" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "يُسمح بـ HTTPS فقط.", code: "PROTOCOL_FORBIDDEN" };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: "يُمنع تضمين اسم مستخدم أو كلمة مرور في الرابط.", code: "USERINFO_FORBIDDEN" };
  }
  if (parsed.port && !RASD_ALLOWED_PORTS.has(Number(parsed.port))) {
    return { ok: false, error: "منفذ غير مسموح.", code: "PORT_FORBIDDEN" };
  }
  const host = normalizeHost(parsed.hostname);
  if (!host) return { ok: false, error: "مضيف فارغ.", code: "HOST_EMPTY" };
  if (isIP(host)) {
    return { ok: false, error: "يُمنع جلب عناوين IP مباشرة.", code: "IP_LITERAL_FORBIDDEN" };
  }
  if (!isAllowedHost(host)) {
    return { ok: false, error: `النطاق غير مسموح: ${host}`, code: "HOST_NOT_ALLOWLISTED" };
  }
  return { ok: true, url: parsed, host };
}

/** تحقق كامل مع DNS لمنع rebinding إلى عناوين داخلية. */
export async function assertSafeRasdUrl(raw: string): Promise<RasdUrlValidation> {
  const syntax = validateRasdUrlSyntax(raw);
  if (!syntax.ok) return syntax;

  try {
    const records = await lookup(syntax.host, { all: true, verbatim: true });
    if (!records.length) {
      return { ok: false, error: "تعذر حل اسم المضيف.", code: "DNS_EMPTY" };
    }
    for (const record of records) {
      if (isPrivateOrBlockedIp(record.address)) {
        return {
          ok: false,
          error: "حلّ DNS يشير إلى عنوان محظور/داخلي.",
          code: "DNS_REBINDING_BLOCKED"
        };
      }
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل DNS",
      code: "DNS_FAILED"
    };
  }

  return syntax;
}

export function sanitizeOutboundHeaders(input?: Record<string, string>): Record<string, string> {
  const blocked = new Set(["authorization", "cookie", "proxy-authorization", "x-api-key"]);
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(input ?? {})) {
    if (blocked.has(key.toLowerCase())) continue;
    output[key] = value;
  }
  return output;
}

export function rasdFetchLogSafe(url: string, status?: number, error?: string): Record<string, unknown> {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      path: parsed.pathname,
      status: status ?? null,
      error: error ?? null
    };
  } catch {
    return { host: null, path: null, status: status ?? null, error: error ?? "invalid_url" };
  }
}
