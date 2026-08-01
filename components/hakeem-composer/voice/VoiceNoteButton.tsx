"use client";
// ─────────────────────────────────────────────────────────────────────────────
// HKM-VOICE-NOTE-SA-007 — المتحكّم: يربط الخطّاف + الإيماءات بالواجهات، ويرفع عند الموافقة
// فقط ثمّ يُدرِج النصّ (لا إرسال تلقائيّ، لا مسح للنصّ السابق). خلف علم NEXT_PUBLIC_… (§17).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { useVoiceRecorder } from "./useVoiceRecorder";
import { useVoiceGestures } from "./useVoiceGestures";
import { VoiceRecordingBar } from "./VoiceRecordingBar";
import { VoiceLockedRecorder } from "./VoiceLockedRecorder";
import { VoicePreview } from "./VoicePreview";
import { VoicePermissionHelp } from "./VoicePermissionHelp";
import type { TranscribeApiResponse } from "@/lib/modules/voice/contracts";

export function VoiceNoteButton({
  disabled,
  onInsertTranscript,
}: {
  disabled?: boolean;
  /** يُدرِج النصّ المفرَّغ عند المؤشّر دون مسح النصّ السابق ولا إرسال (§16). */
  onInsertTranscript: (text: string) => void;
}) {
  const rec = useVoiceRecorder();
  const [cancelP, setCancelP] = useState(0);
  const [lockP, setLockP] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const startRef = useRef(0);

  const capturing = rec.state === "PRESS_RECORDING" || rec.state === "LOCKED_RECORDING";
  const paused = rec.state === "PAUSED";

  // مؤقّت المدّة (عرض فقط).
  useEffect(() => {
    if (rec.state === "PRESS_RECORDING" && !startRef.current) startRef.current = Date.now();
    if (rec.state === "IDLE" || rec.state === "TRANSCRIBED" || rec.state === "CANCELLED") {
      startRef.current = 0;
      setElapsed(0);
    }
    if (!capturing && !paused) return;
    const id = setInterval(() => setElapsed(startRef.current ? Date.now() - startRef.current : 0), 200);
    return () => clearInterval(id);
  }, [rec.state, capturing, paused]);

  const gestures = useVoiceGestures({
    enabled: !disabled,
    onStart: () => {
      setUploadErr(null);
      void rec.requestAndStart();
    },
    onCancelProgress: setCancelP,
    onLockProgress: setLockP,
    onLock: () => rec.lock(),
    onCancel: () => {
      setCancelP(0);
      setLockP(0);
      rec.cancel();
    },
    onStopRelease: () => {
      setCancelP(0);
      setLockP(0);
      rec.stop();
    },
  });

  async function transcribe() {
    if (!rec.recording) return;
    setUploadErr(null);
    rec.markUploading();
    try {
      const fd = new FormData();
      const ext = rec.recording.meta.extension || "webm";
      fd.append("audio", rec.recording.blob, `voice.${ext}`);
      fd.append("locale", "ar-SA");
      fd.append("mode", "voice-note");
      fd.append("contextType", "ask");
      const res = await fetch("/api/voice/transcribe", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as TranscribeApiResponse;
      if (!res.ok || !data.ok || !data.normalizedTranscript) {
        setUploadErr(data.error || "تعذّر تحويل الصوت إلى نص الآن.");
        rec.reset();
        return;
      }
      onInsertTranscript(data.normalizedTranscript); // إدراجٌ لا إرسال (§16)
      rec.markTranscribed();
      rec.reset();
    } catch {
      setUploadErr("انقطع الاتصال أثناء التحويل. أعد المحاولة.");
      rec.reset();
    }
  }

  // ── الحالة المرئيّة ──
  if (rec.state === "PERMISSION_DENIED" || rec.state === "DEVICE_NOT_FOUND" || rec.state === "UNSUPPORTED") {
    return <VoicePermissionHelp state={rec.state} onRetry={() => void rec.requestAndStart()} onDismiss={() => rec.reset()} />;
  }
  if (rec.state === "RECORDED" || rec.state === "PLAYING" || rec.state === "UPLOADING" || rec.state === "TRANSCRIBING") {
    if (!rec.recording) return null;
    return (
      <VoicePreview
        recording={rec.recording}
        busy={rec.state === "UPLOADING" || rec.state === "TRANSCRIBING"}
        onDelete={() => rec.deleteRecording()}
        onReRecord={() => {
          rec.deleteRecording();
          void rec.requestAndStart();
        }}
        onTranscribe={() => void transcribe()}
      />
    );
  }
  if (rec.state === "LOCKED_RECORDING" || rec.state === "PAUSED") {
    return (
      <VoiceLockedRecorder
        stream={rec.stream}
        paused={paused}
        elapsedMs={elapsed}
        onPause={() => rec.pause()}
        onResume={() => rec.resume()}
        onStop={() => rec.stop()}
        onDelete={() => rec.deleteRecording()}
      />
    );
  }
  if (rec.state === "PRESS_RECORDING" || rec.state === "REQUESTING_PERMISSION") {
    return <VoiceRecordingBar stream={rec.stream} elapsedMs={elapsed} cancelProgress={cancelP} lockProgress={lockP} />;
  }

  // IDLE — زرّ الميكروفون (ضغطٌ مستمرّ للتسجيل).
  return (
    <div className="hkm-voice__idle">
      <button
        type="button"
        className="hkm-composer__tool-btn hkm-voice__mic focus-ring"
        disabled={disabled}
        aria-label="سجّل سؤالك صوتيًّا — اضغط مطوّلًا"
        title="سجّل صوتيًّا: اضغط مطوّلًا · اسحب للأعلى للقفل · اسحب جانبًا للإلغاء"
        onPointerDown={gestures.onPointerDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Mic size={15} aria-hidden />
      </button>
      {uploadErr ? (
        <span className="hkm-composer__voice-error" role="alert">
          {uploadErr}
        </span>
      ) : null}
    </div>
  );
}
