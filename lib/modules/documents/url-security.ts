import { isIP } from "node:net";
import dns from "node:dns/promises";

export type UrlSecurityReasonCode =
  | "INVALID_URL"
  | "HTTPS_REQUIRED"
  | "URL_CREDENTIALS_NOT_ALLOWED"
  | "DISALLOWED_PORT"
  | "LOCALHOST"
  | "PRIVATE_IP"
  | "LOOPBACK"
  | "LINK_LOCAL"
  | "MULTICAST"
  | "RESERVED_IP"
  | "METADATA_ENDPOINT"
  | "DNS_RESOLUTION_FAILED"
  | "DNS_REBINDING_RISK"
  | "TOO_MANY_REDIRECTS"
  | "HOST_NOT_ALLOWED";

export interface UrlSecurityResult {
  allowed: boolean;
  normalizedUrl?: string;
  reasonCode?: UrlSecurityReasonCode;
  resolvedAddresses?: string[];
}

export type DnsResolver = (hostname: string) => Promise<string[]>;

const METADATA_HOSTS = new Set([
  "metadata.google.internal",
  "metadata.azure.internal",
  "metadata",
  "instance-data"
]);

export const defaultDnsResolver: DnsResolver = async (hostname) => {
  const results = await dns.lookup(hostname, { all: true, verbatim: true });
  return results.map((r) => r.address);
};

function parseIPv4(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums;
}

/** يصنّف عنوان IP ويُرجع سبب الرفض إن كان غير عام. */
export function classifyIpAddress(ip: string): UrlSecurityReasonCode | null {
  const version = isIP(ip);
  if (version === 4) {
    const n = parseIPv4(ip);
    if (!n) return "INVALID_URL";
    const [a, b] = n;
    if (a === 127) return "LOOPBACK";
    if (a === 10) return "PRIVATE_IP";
    if (a === 0) return "RESERVED_IP";
    if (a === 169 && b === 254) {
      if (n[2] === 169 && n[3] === 254) return "METADATA_ENDPOINT";
      return "LINK_LOCAL";
    }
    if (a === 172 && b >= 16 && b <= 31) return "PRIVATE_IP";
    if (a === 192 && b === 168) return "PRIVATE_IP";
    if (a >= 224 && a <= 239) return "MULTICAST";
    if (a >= 240) return "RESERVED_IP";
    return null;
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1") return "LOOPBACK";
    if (lower.startsWith("fe80:")) return "LINK_LOCAL";
    if (lower.startsWith("fc") || lower.startsWith("fd")) return "PRIVATE_IP";
    if (lower.startsWith("ff")) return "MULTICAST";
    if (lower.startsWith("::ffff:")) {
      return classifyIpAddress(lower.slice("::ffff:".length));
    }
    return null;
  }
  return "INVALID_URL";
}

function isLocalhostName(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "localhost" || h.endsWith(".localhost") || h === "0.0.0.0";
}

/** يرفض صيغ IP غير المعيارية (عشري/hex/octal) التي قد يتجاوز بها الفحص. */
function looksLikeNonCanonicalIpHost(hostname: string): boolean {
  if (/^\d+$/.test(hostname)) return true; // 2130706433
  if (/^0x[0-9a-f]+$/i.test(hostname)) return true;
  if (/^(0x[0-9a-f]+\.){1,3}0x[0-9a-f]+$/i.test(hostname)) return true;
  // رباعي يبدو كـ IP لكن ليس IPv4 صالحًا لدى isIP (مثل 0177.0.0.1)
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) && !isIP(hostname)) return true;
  return false;
}

/**
 * يفحص URL قبل أي اتصال شبكة.
 * لا يتبع redirects — يُستدعى مجددًا لكل موقع redirect.
 */
export async function assertUrlSafeForFetch(
  rawUrl: string,
  opts?: { resolver?: DnsResolver }
): Promise<UrlSecurityResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { allowed: false, reasonCode: "INVALID_URL" };
  }

  if (parsed.protocol !== "https:") {
    return { allowed: false, reasonCode: "HTTPS_REQUIRED" };
  }

  if (parsed.username || parsed.password) {
    return { allowed: false, reasonCode: "URL_CREDENTIALS_NOT_ALLOWED" };
  }

  if (parsed.port && parsed.port !== "443") {
    return { allowed: false, reasonCode: "DISALLOWED_PORT" };
  }

  let hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  // طبّع النقطة اللاحقة (DNS absolute)
  while (hostname.endsWith(".")) hostname = hostname.slice(0, -1);
  hostname = hostname.toLowerCase();

  if (!hostname || hostname.includes(" ")) {
    return { allowed: false, reasonCode: "INVALID_URL" };
  }

  if (isLocalhostName(hostname)) {
    return { allowed: false, reasonCode: "LOCALHOST" };
  }

  if (METADATA_HOSTS.has(hostname)) {
    return { allowed: false, reasonCode: "METADATA_ENDPOINT" };
  }

  if (looksLikeNonCanonicalIpHost(hostname)) {
    return { allowed: false, reasonCode: "HOST_NOT_ALLOWED" };
  }

  if (isIP(hostname)) {
    const reason = classifyIpAddress(hostname);
    if (reason) return { allowed: false, reasonCode: reason, resolvedAddresses: [hostname] };
    return {
      allowed: true,
      normalizedUrl: `https://${isIP(hostname) === 6 ? `[${hostname}]` : hostname}${parsed.pathname}${parsed.search}`,
      resolvedAddresses: [hostname]
    };
  }

  if (!hostname.includes(".") || hostname.startsWith(".")) {
    return { allowed: false, reasonCode: "HOST_NOT_ALLOWED" };
  }

  const resolver = opts?.resolver ?? defaultDnsResolver;
  let addresses: string[];
  try {
    addresses = await resolver(hostname);
  } catch {
    return { allowed: false, reasonCode: "DNS_RESOLUTION_FAILED" };
  }
  if (!addresses.length) {
    return { allowed: false, reasonCode: "DNS_RESOLUTION_FAILED" };
  }

  let hasPublic = false;
  let hasPrivate = false;
  for (const addr of addresses) {
    const reason = classifyIpAddress(addr);
    if (reason) {
      hasPrivate = true;
      if (reason === "METADATA_ENDPOINT") {
        return { allowed: false, reasonCode: "METADATA_ENDPOINT", resolvedAddresses: addresses };
      }
    } else {
      hasPublic = true;
    }
  }

  if (hasPrivate && hasPublic) {
    return { allowed: false, reasonCode: "DNS_REBINDING_RISK", resolvedAddresses: addresses };
  }
  if (hasPrivate) {
    const firstBad = addresses.map(classifyIpAddress).find(Boolean) ?? "PRIVATE_IP";
    return { allowed: false, reasonCode: firstBad, resolvedAddresses: addresses };
  }

  // أعِد بناء URL بالـ hostname المطبع (بلا trailing dot)
  const normalized = new URL(parsed.toString());
  normalized.hostname = hostname;
  return {
    allowed: true,
    normalizedUrl: normalized.toString(),
    resolvedAddresses: addresses
  };
}

const SENSITIVE_QUERY_KEYS =
  /^(token|signature|sig|key|auth|access_token|x-amz-signature|x-goog-signature|x-amz-credential|x-amz-security-token|sas|se|sp|sv|sig)$/i;

/**
 * تنقيح موحّد للعرض والسجلات: scheme + host + pathname فقط.
 * يحذف credentials وquery وfragment.
 */
export function redactSensitiveUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    u.username = "";
    u.password = "";
    u.search = "";
    u.hash = "";
    // طبّع trailing dot على الـ host
    let host = u.hostname.replace(/^\[|\]$/g, "");
    while (host.endsWith(".")) host = host.slice(0, -1);
    u.hostname = host;
    return u.toString();
  } catch {
    return "[invalid-url]";
  }
}

/** @deprecated استخدم redactSensitiveUrl */
export function toSafeDisplayUrl(rawUrl: string): string {
  return redactSensitiveUrl(rawUrl);
}

export function urlContainsSensitiveQuery(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    for (const key of u.searchParams.keys()) {
      if (SENSITIVE_QUERY_KEYS.test(key)) return true;
    }
    // أي query يُعامل بحذر في السجلات — لكن الكشف الصريح للمفاتيح الحساسة أعلاه
    return false;
  } catch {
    return false;
  }
}
