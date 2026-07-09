// سجلّ محرّكات القراءة على الخادم (Node) — نظير engines.py، لكن يعيد استخدام
// الدماغ الموحّد (processExtractedText) فيصبح مخرَج الخادم بجودة المتصفح تماماً.
//
// المحرّكات: local (استخراج محلّي: نص/Word/PDF نصّي) · gemini (رؤية سحابية عبر
// GEMINI_API_KEY) · qari (مقبس GPU عبر QARI_ENDPOINT). إضافة محرّكٍ = register() واحدة.

import { processExtractedText } from "@/lib/modules/document-inspection";
import { extractLocal, RemoteNeeded, type ExtractOut } from "./extract";

export interface Engine {
  name: string;
  label: string;
  available: () => boolean;
  needsGpu: boolean;
  remote: boolean;
  run: (name: string, data: Uint8Array, model: string) => Promise<ExtractOut>;
}

const REGISTRY = new Map<string, Engine>();
export function register(e: Engine): void {
  REGISTRY.set(e.name, e);
}
export function getEngine(name: string): Engine | undefined {
  return REGISTRY.get(name);
}
export function providersStatus(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [n, e] of REGISTRY) out[n] = e.available();
  return out;
}
export function providersDetail() {
  return Array.from(REGISTRY.values()).map((e) => ({
    name: e.name,
    label: e.label,
    available: e.available(),
    needs_gpu: e.needsGpu,
    remote: e.remote
  }));
}

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf"
};
function mimeFor(name: string): string | null {
  const m = name.toLowerCase().match(/\.[^.]+$/);
  return m ? MIME[m[0]] ?? null : null;
}

// ── local ──
register({
  name: "local",
  label: "محلّي (Node + النواة المشتركة)",
  available: () => true,
  needsGpu: false,
  remote: false,
  run: (name, data) => extractLocal(name, data)
});

// ── gemini (بيئي، اختياري) ──
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const OCR_PROMPT =
  "أنت محرّك OCR احترافي للمستندات الرسمية والقانونية العربية. استخرج كل النصوص كنصّ خام " +
  "بأعلى دقة، محافظاً على ترتيب الأسطر والفقرات والجداول. تنبيه حاسم (وثيقة قانونية): لا " +
  "تُصحِّح ولا تُخمِّن الأرقامَ والمبالغَ والتواريخَ الهجرية وأرقامَ الصكوك والأعلامَ وأسماءَ " +
  "الأطراف — انقلها حرفياً كما تراها؛ إن تعذّرت قراءة رقم فاكتب [غير واضح] بدل تخمينه. " +
  "أخرِج النص مباشرة دون مقدمات أو تعليقات.";

function geminiConfig(model: string) {
  const base: Record<string, unknown> = { temperature: 0.1, topP: 0.95, maxOutputTokens: 16384 };
  if (model !== "pro") base.thinkingConfig = { thinkingBudget: 0 };
  return base;
}

async function runGemini(name: string, data: Uint8Array, model: string): Promise<ExtractOut> {
  const key = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!key) throw new Error("GEMINI_API_KEY غير مضبوط");
  const mime = mimeFor(name);
  if (!mime) throw new Error("Gemini يقبل PNG/JPG/PDF فقط");
  const modelId = model === "pro" ? "gemini-2.5-pro" : "gemini-2.5-flash";
  const b64 = Buffer.from(data).toString("base64");
  const res = await fetch(`${GEMINI_BASE}/${modelId}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ inline_data: { data: b64, mime_type: mime } }, { text: OCR_PROMPT }] }],
      generationConfig: geminiConfig(model)
    })
  });
  const json: any = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `Gemini أعاد ${res.status}`);
  const text: string = (json?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("").trim();
  if (!text) throw new Error("لم يُعِد Gemini نصاً");
  // نصّ رؤية → مرّره عبر الدماغ (فصل ترويسات) بمصدر cloud
  const processed = processExtractedText(text, { source: "cloud" });
  return { text: processed.body, kind: `Gemini ${model === "pro" ? "pro" : "flash"}` };
}

register({
  name: "gemini",
  label: "Gemini (رؤية سحابية)",
  available: () => Boolean((process.env.GEMINI_API_KEY ?? "").trim()),
  needsGpu: false,
  remote: true,
  run: runGemini
});

// ── qari (مقبس GPU) ──
async function runQari(name: string, data: Uint8Array, model: string): Promise<ExtractOut> {
  const endpoint = (process.env.QARI_ENDPOINT ?? "").trim();
  if (!endpoint) throw new Error("QARI_ENDPOINT غير مضبوط");
  const mime = mimeFor(name);
  if (!mime) throw new Error("QARI يقبل PNG/JPG/PDF فقط");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = (process.env.QARI_TOKEN ?? "").trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ file_b64: Buffer.from(data).toString("base64"), mime, model: model || "v0.3" })
  });
  const json: any = await res.json();
  if (!res.ok) throw new Error(`QARI أعاد ${res.status}`);
  const text: string = (json?.text ?? "").trim();
  if (!text) throw new Error("لم يُعِد QARI نصاً");
  const processed = processExtractedText(text, { source: "cloud" });
  return { text: processed.body, kind: `QARI-OCR ${model || "v0.3"}` };
}

register({
  name: "qari",
  label: "QARI-OCR (عربي دقيق — GPU)",
  available: () => Boolean((process.env.QARI_ENDPOINT ?? "").trim()),
  needsGpu: true,
  remote: true,
  run: runQari
});

// ── المُوزّع الموحّد مع التراجع ──
export async function runEngine(provider: string, model: string, name: string, data: Uint8Array): Promise<ExtractOut> {
  const eng = getEngine(provider);
  // مزوّد بعيد مطلوب ومتاح → جرّبه، وتراجع للمحلّي عند الفشل
  if (eng && eng.name !== "local") {
    if (!eng.available()) {
      return localWithNote(name, data, `المزوّد ${eng.name} غير مُفعّل`);
    }
    try {
      return await eng.run(name, data, model);
    } catch (e) {
      return localWithNote(name, data, `تعذّر ${eng.name}: ${errMsg(e)}`);
    }
  }
  // المحلّي: قد يطلب محرّكاً بعيداً (ممسوح/صورة) → جرّب gemini ثم qari تلقائياً
  try {
    return await extractLocal(name, data);
  } catch (e) {
    if (e instanceof RemoteNeeded) {
      for (const fallback of ["gemini", "qari"]) {
        const fe = getEngine(fallback);
        if (fe && fe.available()) {
          try {
            return await fe.run(name, data, model);
          } catch {
            /* جرّب التالي */
          }
        }
      }
      return { text: "", kind: "ممسوح/صورة — فعّل Gemini أو QARI لقراءته" };
    }
    return { text: "", kind: `تعذّر: ${errMsg(e)}` };
  }
}

async function localWithNote(name: string, data: Uint8Array, note: string): Promise<ExtractOut> {
  try {
    const out = await extractLocal(name, data);
    return { text: out.text, kind: `${out.kind} (${note} — استُعمل المحلّي)` };
  } catch (e) {
    if (e instanceof RemoteNeeded) return { text: "", kind: `${note} — والمحلّي لا يقرأ الممسوح` };
    return { text: "", kind: `تعذّر: ${errMsg(e)}` };
  }
}

function errMsg(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).slice(0, 80);
}
