// ─────────────────────────────────────────────────────────────────────────────
// HKM-VOICE-NOTE-SA-007 §14 — POST /api/voice/transcribe
// الترتيب: مصادقة → علم → Rate limit → حجم/MIME/Magic → مزوّد → تفريغ → تطبيع →
// Audit وصفيّ (لا صوت) → حذف المؤقّت. لا يُعيد مفاتيح ولا endpoints. Local-First (§15).
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { consumeDirectUrlRateLimit } from "@/lib/modules/documents/rate-limit";
import { isVoiceTranscriptionV2Enabled, VOICE_MAX_BYTES } from "@/lib/modules/config/voice";
import { validateAudioBytes } from "@/lib/modules/voice/audio-validation";
import { selectAvailableProvider } from "@/lib/modules/voice/provider-registry";
import { normalizeTranscript } from "@/lib/modules/voice/transcript-normalizer";
import { buildLegalHints } from "@/lib/modules/voice/legal-phrase-list";
import type { TranscribeApiResponse } from "@/lib/modules/voice/contracts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function json(body: TranscribeApiResponse, status = 200) {
  return NextResponse.json(body, { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}

export async function POST(request: NextRequest) {
  // ٢ — العلم (مطفأ افتراضيًّا ⇒ الميزة غير متاحة).
  if (!isVoiceTranscriptionV2Enabled()) {
    return json({ ok: false, error: "تحويل الصوت غير متاح حاليًّا.", code: "DISABLED" }, 503);
  }
  // ١ — المصادقة.
  const user = await getCurrentUser().catch(() => null);
  if (!user) return json({ ok: false, error: "يلزم تسجيل الدخول.", code: "UNAUTHENTICATED" }, 401);

  // ٣ — Rate limit (خفيف في العملية؛ الإنتاج متعدّد النسخ يوصَل بـRedis — موثَّق).
  const rl = consumeDirectUrlRateLimit(`voice:${user.id}`, 20, 60_000);
  if (!rl.allowed) {
    return json({ ok: false, error: "طلباتٌ كثيرة. حاول بعد قليل.", code: "RATE_LIMITED" }, 429);
  }

  // ٤/٥/٦ — multipart، ملفٌّ واحد.
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "طلبٌ غير صالح.", code: "BAD_REQUEST" }, 400);
  }
  const files = form.getAll("audio").filter((v): v is File => v instanceof File);
  if (files.length !== 1) return json({ ok: false, error: "يلزم ملفٌّ صوتيٌّ واحد.", code: "ONE_FILE" }, 400);
  const file = files[0];
  const locale = "ar-SA" as const;

  // ٧/٨/٩ — MIME + Magic Bytes + الحجم.
  const declaredMime = file.type || "application/octet-stream";
  const arrBuf = await file.arrayBuffer();
  const bytes = new Uint8Array(arrBuf);
  const check = validateAudioBytes({ bytes, declaredMimeType: declaredMime, maxBytes: VOICE_MAX_BYTES });
  if (!check.ok) {
    return json({ ok: false, error: check.message ?? "ملفٌّ غير صالح.", code: check.code }, 400);
  }

  // ١١ — اختيار مزوّدٍ متاحٍ فعليًّا (لا رأي).
  const provider = await selectAvailableProvider();
  if (!provider) {
    return json({ ok: false, error: "لا يوجد مزوّد تفريغٍ متاح حاليًّا.", code: "NO_PROVIDER" }, 503);
  }

  // ١٢ — التفريغ (بيانات وصفيّة فقط للـAudit؛ لا صوت، لا نصّ).
  const started = Date.now();
  let status = "ok";
  let errorCode: string | undefined;
  try {
    const result = await provider.transcribe({
      bytes: Buffer.from(bytes),
      mimeType: declaredMime,
      locale,
      hints: buildLegalHints(),
      punctuation: true,
    });
    // ١٣ — التطبيع (raw + normalized؛ raw لا يُخزَّن).
    const norm = normalizeTranscript(result.text);
    const durationMs = Date.now() - started;

    // ١٤ — Audit وصفيّ فقط (§15).
    void auditEvent({
      actorId: user.id,
      subject: "AI_GATEWAY",
      action: "VOICE_TRANSCRIPTION_USE",
      metadata: {
        durationMs,
        byteSize: bytes.length,
        mimeType: declaredMime,
        container: check.container,
        provider: result.provider,
        model: result.model,
        status,
      },
    }).catch(() => undefined);

    return json({
      ok: true,
      rawTranscript: norm.rawTranscript,
      normalizedTranscript: norm.normalizedTranscript,
      locale,
      durationMs,
      provider: result.provider,
      model: result.model,
      confidence: result.confidence,
      warnings: result.warnings,
    });
  } catch (e) {
    status = "error";
    errorCode = e instanceof Error ? e.message : "error";
    void auditEvent({
      actorId: user.id,
      subject: "AI_GATEWAY",
      action: "VOICE_TRANSCRIPTION_USE",
      metadata: { byteSize: bytes.length, mimeType: declaredMime, provider: provider.id, status, errorCode },
    }).catch(() => undefined);
    return json({ ok: false, error: "تعذّر تحويل الصوت إلى نص الآن.", code: "PROVIDER_ERROR" }, 502);
  }
  // ١٥ — لا حفظ للبايتات؛ arrBuf/bytes يُجمَعان تلقائيًّا بعد انتهاء الطلب.
}
