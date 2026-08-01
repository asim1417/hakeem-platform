/**
 * تنزيل SharePoint آمن — Graph content endpoint أو allowlist صارمة.
 * لا يُرسل Authorization إلى URL عام/غير موثوق (SSRF / redirect).
 */

const GRAPH_HOST = "graph.microsoft.com";

export type SharePointDownloadDecision =
  | { allow: true; mode: "graph-content"; url: string }
  | { allow: true; mode: "allowlisted"; url: string }
  | { allow: false; reason: string };

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

function hostAllowed(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === GRAPH_HOST) return true;
  // نطاقات SharePoint المعتادة فقط عند السماح بروابط content معروفة
  if (h.endsWith(".sharepoint.com")) return true;
  const extra = (process.env.SHAREPOINT_DOWNLOAD_ALLOWLIST || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return extra.includes(h);
}

/**
 * يقرر هل يُسمح بجلب البايتات مع Authorization.
 * يفضّل دائمًا Graph drive content من storageKey.
 * لا يعتمد على webUrl العام كممر آمن للتوكين.
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

  // رفض الروابط التي تبدو webUrl عامة (ليست Graph content)
  const isGraphContent =
    parsed.hostname.toLowerCase() === GRAPH_HOST &&
    /\/content\/?$/i.test(parsed.pathname);

  if (!isGraphContent) {
    // لا نرسل التوكين إلى webUrl — منع SSRF عبر metadata.storageUrl
    return { allow: false, reason: "WEBURL_NOT_ALLOWED_WITH_AUTH" };
  }

  if (!hostAllowed(parsed.hostname)) {
    return { allow: false, reason: "HOST_NOT_ALLOWLISTED" };
  }

  return { allow: true, mode: "allowlisted", url: parsed.toString() };
}

/**
 * fetch مع منع اتباع redirect إلى مضيف خارج allowlist مع Authorization.
 */
export async function fetchWithAuthNoExternalRedirect(
  url: string,
  token: string,
  opts?: { timeoutMs?: number; maxRedirects?: number }
): Promise<Response | null> {
  const timeoutMs = opts?.timeoutMs ?? 120_000;
  const maxRedirects = opts?.maxRedirects ?? 3;
  let current = url;
  for (let i = 0; i <= maxRedirects; i++) {
    const res = await fetch(current, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      let next: URL;
      try {
        next = new URL(loc, current);
      } catch {
        return null;
      }
      if (next.protocol !== "https:" || !hostAllowed(next.hostname)) {
        return null; // منع redirect خارجي مع Authorization
      }
      current = next.toString();
      continue;
    }
    return res;
  }
  return null;
}
