/**
 * تنزيل SharePoint آمن — Graph content endpoint أو allowlist صارمة.
 *
 * القاعدة الحرجة:
 * - الطلب الأول إلى graph.microsoft.com فقط يحمل Authorization.
 * - عند 302/303 إلى رابط تنزيل مؤقت (*.sharepoint.com): اتبع بلا Authorization.
 * - لا ترسل Graph bearer إلى sharepoint.com أبدًا.
 */

const GRAPH_HOST = "graph.microsoft.com";

export type SharePointDownloadDecision =
  | { allow: true; mode: "graph-content"; url: string }
  | { allow: true; mode: "allowlisted"; url: string }
  | { allow: false; reason: string };

export type FetchAuthTrace = {
  url: string;
  sentAuthorization: boolean;
  status: number;
};

/**
 * يبني رابط Graph content من storageKey بالشكل sharepoint/{pathKey}.
 */
export function buildGraphDriveContentUrl(storageKey: string, driveId?: string | null): string | null {
  const drive = (driveId || process.env.SHAREPOINT_DRIVE_ID || "").trim();
  if (!drive) return null;
  if (!storageKey.startsWith("sharepoint/")) return null;
  const pathKey = storageKey.slice("sharepoint/".length);
  if (!pathKey || pathKey.includes("..")) return null;
  const encodedPath = pathKey
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return `https://${GRAPH_HOST}/v1.0/drives/${encodeURIComponent(drive)}/root:/${encodedPath}:/content`;
}

export function isGraphHost(hostname: string): boolean {
  return hostname.toLowerCase() === GRAPH_HOST;
}

export function isSharePointTempHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h.endsWith(".sharepoint.com")) return true;
  const extra = (process.env.SHAREPOINT_DOWNLOAD_ALLOWLIST || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return extra.includes(h);
}

function hostAllowedForRedirect(hostname: string): boolean {
  return isGraphHost(hostname) || isSharePointTempHost(hostname);
}

/**
 * يقرر رابط Graph الأول (مع Auth). لا يعتمد على webUrl العام.
 */
export function decideSharePointDownloadUrl(input: {
  storageKey: string;
  metadataUrl?: string | null;
  driveId?: string | null;
}): SharePointDownloadDecision {
  const graphUrl = buildGraphDriveContentUrl(input.storageKey, input.driveId);
  if (graphUrl) {
    return { allow: true, mode: "graph-content", url: graphUrl };
  }

  const raw = String(input.metadataUrl ?? "").trim();
  if (!raw) {
    return { allow: false, reason: "NO_SAFE_SHAREPOINT_URL" };
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { allow: false, reason: "INVALID_URL" };
  }

  if (parsed.protocol !== "https:") {
    return { allow: false, reason: "NON_HTTPS" };
  }

  const isGraphContent =
    isGraphHost(parsed.hostname) && /\/content\/?$/i.test(parsed.pathname);

  if (!isGraphContent) {
    return { allow: false, reason: "WEBURL_NOT_ALLOWED_WITH_AUTH" };
  }

  return { allow: true, mode: "allowlisted", url: parsed.toString() };
}

/**
 * هل يُرسل Authorization لهذا الرابط؟
 * فقط graph.microsoft.com في الطلب الأول / قفزات Graph.
 */
export function shouldSendGraphAuthorization(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && isGraphHost(u.hostname);
  } catch {
    return false;
  }
}

export type ManualFetch = (
  url: string,
  init: RequestInit
) => Promise<{ status: number; headers: { get(name: string): string | null }; ok: boolean; arrayBuffer?: () => Promise<ArrayBuffer> }>;

/**
 * fetch يدوي:
 * 1) Graph + Authorization
 * 2) redirect إلى SharePoint مؤقت → بلا Authorization
 * 3) رفض خارجي / http downgrade / حلقات
 */
export async function fetchGraphContentFollowingRedirects(
  url: string,
  token: string,
  opts?: {
    timeoutMs?: number;
    maxRedirects?: number;
    fetchImpl?: ManualFetch;
    onTrace?: (t: FetchAuthTrace) => void;
  }
): Promise<{ ok: true; body: Uint8Array; traces: FetchAuthTrace[] } | { ok: false; reason: string; traces: FetchAuthTrace[] }> {
  const timeoutMs = opts?.timeoutMs ?? 120_000;
  const maxRedirects = opts?.maxRedirects ?? 5;
  const doFetch: ManualFetch =
    opts?.fetchImpl ??
    (async (u, init) => {
      const res = await fetch(u, init);
      return {
        status: res.status,
        headers: res.headers,
        ok: res.ok,
        arrayBuffer: () => res.arrayBuffer(),
      };
    });

  const traces: FetchAuthTrace[] = [];
  let current = url;
  const seen = new Set<string>();

  for (let i = 0; i <= maxRedirects; i++) {
    if (seen.has(current)) {
      return { ok: false, reason: "REDIRECT_LOOP", traces };
    }
    seen.add(current);

    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      return { ok: false, reason: "INVALID_URL", traces };
    }
    if (parsed.protocol !== "https:") {
      return { ok: false, reason: "NON_HTTPS", traces };
    }

    const sendAuth = shouldSendGraphAuthorization(current);
    // الطلب الأول يجب أن يكون Graph إن كنا نرسل Auth
    if (i === 0 && !isGraphHost(parsed.hostname)) {
      return { ok: false, reason: "FIRST_HOP_NOT_GRAPH", traces };
    }
    if (sendAuth === false && isGraphHost(parsed.hostname) === false) {
      // مسموح لـ sharepoint temp بلا token
      if (!isSharePointTempHost(parsed.hostname)) {
        return { ok: false, reason: "HOST_NOT_ALLOWLISTED", traces };
      }
    }

    const headers: Record<string, string> = {};
    if (sendAuth) headers.Authorization = `Bearer ${token}`;

    const res = await doFetch(current, {
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });

    const trace: FetchAuthTrace = {
      url: current,
      sentAuthorization: sendAuth,
      status: res.status,
    };
    traces.push(trace);
    opts?.onTrace?.(trace);

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { ok: false, reason: "REDIRECT_WITHOUT_LOCATION", traces };
      let next: URL;
      try {
        next = new URL(loc, current);
      } catch {
        return { ok: false, reason: "INVALID_REDIRECT", traces };
      }
      if (next.protocol !== "https:") {
        return { ok: false, reason: "HTTPS_DOWNGRADE", traces };
      }
      if (!hostAllowedForRedirect(next.hostname)) {
        return { ok: false, reason: "EXTERNAL_REDIRECT_REJECTED", traces };
      }
      // لا نرسل Auth في الخطوة التالية إن لم يكن Graph — يُحسب في الحلقة
      current = next.toString();
      continue;
    }

    if (!res.ok) {
      return { ok: false, reason: `HTTP_${res.status}`, traces };
    }
    const buf = res.arrayBuffer ? new Uint8Array(await res.arrayBuffer()) : new Uint8Array();
    return { ok: true, body: buf, traces };
  }

  return { ok: false, reason: "TOO_MANY_REDIRECTS", traces };
}

/** @deprecated استخدم fetchGraphContentFollowingRedirects */
export async function fetchWithAuthNoExternalRedirect(
  url: string,
  token: string,
  opts?: { timeoutMs?: number; maxRedirects?: number }
): Promise<Response | null> {
  const result = await fetchGraphContentFollowingRedirects(url, token, opts);
  if (!result.ok) return null;
  return new Response(Buffer.from(result.body));
}
