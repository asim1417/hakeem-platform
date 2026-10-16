import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { LIVE_DEMO_ARTICLE, type LiveDemoArticle } from "@/lib/modules/home/live-demo-content";

type ExportedArticle = { article_number?: number | string; law_name?: string; title?: string; content?: string };

let cached: Promise<LiveDemoArticle | null> | null = null;

/**
 * نص المادة بلفظه من مدونة حكيم — لا يُكتب يدويًا.
 * يُقرأ في الخادم فقط (لا يدخل حزمة العميل)، ويُحفظ في الذاكرة بعد أول قراءة.
 */
export function loadLiveDemoArticle(): Promise<LiveDemoArticle | null> {
  cached ??= (async () => {
    try {
      const raw = await fs.readFile(path.join(process.cwd(), "data/legal_articles_export.json"), "utf8");
      const data = JSON.parse(raw) as ExportedArticle[] | { articles?: ExportedArticle[] };
      const list = Array.isArray(data) ? data : data.articles ?? [];
      const hit = list.find(
        (a) => a.law_name === LIVE_DEMO_ARTICLE.lawName && Number(a.article_number) === LIVE_DEMO_ARTICLE.articleNumber
      );
      if (!hit?.content || !hit.title) return null;
      return {
        lawName: LIVE_DEMO_ARTICLE.lawName,
        articleNumber: LIVE_DEMO_ARTICLE.articleNumber,
        title: hit.title,
        content: hit.content,
      };
    } catch {
      return null;
    }
  })();
  return cached;
}
