/**
 * render-source.mjs — يُصيّر صفحة المصدر (SPA) بمتصفّح حقيقي (Playwright/Chromium) ويستخرج
 * نصّها، لقراءة الكلمات الملتصقة من المصدر الأصلي (وزارة العدل). يقرأ JSONL من stdin:
 *   {"id":"…","url":"https://sjp.moj.gov.sa/Filter/AhkamDetails/…","glued":"…"}
 * يطبع لكل حكم: هل ظهر نصّ عربي، ومقتطف حوله، وهل التوكن الملتصق ما زال ملتصقًا في المصدر.
 * لا كتابة. للتشغيل داخل CI بعد: npm i --no-save playwright && npx playwright install chromium
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

const LONG_AR = /[ء-غف-يٮ-ۓەۺ-ۿ]{29,}/;

for (const it of items) {
  console.log("=".repeat(80));
  console.log(`• ${it.id}\n  ${it.url}\n  الملتصق في قاعدتنا: «${it.glued}»`);
  const page = await ctx.newPage();
  try {
    await page.goto(it.url, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(3500); // مهلة لتحميل المحتوى الديناميكي
    const text = (await page.evaluate(() => document.body?.innerText || "")).replace(/\s+/g, " ").trim();
    const arLen = (text.match(/[؀-ۿ]/g) || []).length;
    console.log(`  المصدر: طول=${text.length} · حروف عربية=${arLen}`);
    if (arLen > 60) {
      // ابحث عن جذر الكلمة الملتصقة (أوّل 8 محارف) في نصّ المصدر
      const stem = (it.glued || "").slice(0, 8);
      const idx = stem ? text.indexOf(stem) : -1;
      if (idx >= 0) {
        const around = text.slice(Math.max(0, idx - 40), idx + 90);
        const stillGlued = LONG_AR.test(around);
        console.log(`  حول الكلمة في المصدر: «…${around}…»`);
        console.log(`  الحكم: ${stillGlued ? "ما زالت ملتصقة في المصدر (تلف أصليّ)" : "المصدر يفصلها ✓ (يمكن التقييد بإسناد)"}`);
      } else {
        console.log(`  لم أجد جذر الكلمة في نصّ المصدر — مقتطف: «${text.slice(0, 160)}…»`);
      }
    } else {
      console.log(`  المصدر ما زال بلا نصّ كافٍ بعد التصيير (قد يحتاج تفاعلاً/تحقّق بشري). مقتطف: «${text.slice(0, 120)}»`);
    }
  } catch (e) {
    console.log(`  تعذّر التصيير: ${e?.message?.slice(0, 120) || e}`);
  } finally {
    await page.close();
  }
}
await browser.close();
