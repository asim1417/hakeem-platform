/**
 * render-source.mjs — يقرأ نصّ الحكم من المصدر الأصلي (SPA لوزارة العدل) عبر متصفّح حقيقي،
 * **ويلتقط نداءات الشبكة** (XHR/fetch) لاكتشاف الـAPI الذي يحمل النصّ — أوثق من نصّ الصفحة.
 * يقرأ JSONL من stdin: {"id","url","glued"}. لا كتابة. يُشغَّل في CI بعد تثبيت playwright.
 */
import { createInterface } from "node:readline";

const items = [];
const rl = createInterface({ input: process.stdin });
for await (const line of rl) { const t = line.trim(); if (t.startsWith("{")) { try { items.push(JSON.parse(t)); } catch { /* */ } } }

const { chromium } = await import("playwright");
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
  locale: "ar-SA",
});
const arCount = (s) => (s.match(/[؀-ۿ]/g) || []).length;

for (const it of items) {
  console.log("=".repeat(80));
  console.log(`• ${it.id}\n  ${it.url}\n  الملتصق في قاعدتنا: «${it.glued}»`);
  const page = await ctx.newPage();
  const apiHits = [];
  page.on("response", async (res) => {
    try {
      const ct = (res.headers()["content-type"] || "").toLowerCase();
      if (!/json|text|html/.test(ct)) return;
      const body = await res.text();
      const ar = arCount(body);
      if (ar > 150) apiHits.push({ url: res.url(), ar, body });
    } catch { /* */ }
  });
  try {
    await page.goto(it.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(5000);
    console.log(`  الرابط النهائي بعد التحميل: ${page.url()}`);
    // رتّب الاستجابات بحسب كثافة العربية
    apiHits.sort((a, b) => b.ar - a.ar);
    const uniq = [...new Map(apiHits.map((h) => [h.url, h])).values()].slice(0, 6);
    console.log(`  استجابات فيها عربية (أعلى 6):`);
    for (const h of uniq) console.log(`     [${h.ar}] ${h.url.slice(0, 110)}`);
    // أفضل استجابة (غالبًا JSON نصّ الحكم) — اطبع نصًّا مقروءًا منها
    const top = uniq.find((h) => !/\.js($|\?)/.test(h.url)) || uniq[0];
    if (top) {
      let txt = top.body;
      // إن كانت JSON، حاول انتزاع قيَم نصّية طويلة
      try {
        const j = JSON.parse(top.body);
        const vals = [];
        const walk = (o) => { if (typeof o === "string") { if (arCount(o) > 40) vals.push(o); } else if (o && typeof o === "object") Object.values(o).forEach(walk); };
        walk(j);
        if (vals.length) txt = vals.sort((a, b) => b.length - a.length)[0];
      } catch { /* نصّ خام */ }
      txt = txt.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      console.log(`  📄 نصّ من المصدر (أفضل استجابة، ${top.url.slice(0, 80)}):`);
      console.log(`     «${txt.slice(0, 700)}»`);
    } else {
      console.log(`  لم تُلتقَط استجابة تحمل نصًّا عربيًا كافيًا (قد يكون الرابط العميق غير مدعوم مباشرةً).`);
    }
  } catch (e) {
    console.log(`  تعذّر: ${e?.message?.slice(0, 140) || e}`);
  } finally {
    await page.close();
  }
}
await browser.close();
