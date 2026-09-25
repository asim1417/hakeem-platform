/**
 * uqn-rss.ts — قراءة تغذية «قرارات وأنظمة» من جريدة أم القرى (RSS).
 * تحليل خفيف بلا مكتبات: يستخرج عناصر <item> وحقولها (guid ثابت، pubDate،
 * title، description بالنصّ الكامل). نقيّ وقابل للاختبار (لا شبكة هنا).
 */
export interface UqnItem {
  guid: string;
  title: string;
  description: string; // النصّ الكامل (رابعًا يعمل عليه)
  pubDate?: string;
  link?: string;
}

function pick(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  if (!m) return null;
  const v = m[1].trim();
  const cdata = v.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return (cdata ? cdata[1] : v).trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** يحوّل XML التغذية إلى عناصر. يتجاهل ما لا guid له. */
export function parseUqnRss(xml: string): UqnItem[] {
  const items: UqnItem[] = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml))) {
    const block = m[1];
    const guid = pick(block, "guid");
    if (!guid) continue;
    items.push({
      guid,
      title: decodeEntities(pick(block, "title") ?? ""),
      description: decodeEntities(pick(block, "description") ?? ""),
      pubDate: pick(block, "pubDate") ?? undefined,
      link: pick(block, "link") ?? undefined,
    });
  }
  return items;
}
