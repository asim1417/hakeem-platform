import { assertOfficialSourceUrl, type OfficialLegalSource } from "./official-source-policy";

export type CollectableSource = Exclude<OfficialLegalSource, "UQN">;
export type OfficialCandidate = { source: CollectableSource; url: string; title?: string; id?: string };

export function explicitCandidates(source: CollectableSource, urls: string[]): OfficialCandidate[] {
  const candidates = new Map<string, OfficialCandidate>();
  for (const raw of urls) {
    const url = assertOfficialSourceUrl(source, raw);
    url.hash = "";
    candidates.set(url.href, { source, url: url.href });
  }
  return [...candidates.values()];
}

export function discoverOfficialLinks(source: CollectableSource, html: string, baseUrl: string): OfficialCandidate[] {
  const out = new Map<string, OfficialCandidate>();
  const base = new URL(baseUrl);
  base.hash = "";
  for (const m of html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/giu)) {
    let url: URL;
    try {
      url = assertOfficialSourceUrl(source, new URL(m[1].replace(/&amp;/gi, "&"), base).href);
    } catch { continue; }
    url.hash = "";
    if (url.href === base.href) continue;
    // Navigation/category pages are not documents. Pagination remains unverified.
    const relevant = source === "BOE"
      ? /\/BoeLaws\/Laws\/(?:LawDetails|Viewer)\/[^/]+/i.test(url.pathname)
      : /\/(?:document-details|legislation|regulation)\/[^/]+/i.test(url.pathname);
    if (!relevant) continue;
    const title = m[2].replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
    out.set(url.href, { source, url: url.href, title: title || undefined });
  }
  return [...out.values()];
}

export function requireDiscoveredDocuments(candidates: OfficialCandidate[]): void {
  if (!candidates.length) {
    throw new Error("OFFICIAL_DISCOVERY_EMPTY: لم تظهر روابط وثائق؛ قد تتطلب الصفحة JavaScript. لم يُثبت جمع أي نظام. استخدم رابط بيانات منشورًا أو --url لرابط وثيقة رسمي معلوم.");
  }
}
