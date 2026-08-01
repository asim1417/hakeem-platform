"use client";
// ─────────────────────────────────────────────────────────────────────────────
// HKM-VOICE-NOTE-SA-007 §5/§9/§10 — خطّاف التسجيل: getUserMedia + MediaRecorder + آلة
// الحالات + حدود المدّة/الحجم + تنظيفٌ صارمٌ لدورة الحياة. لا رفع (Local-First §15).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { INITIAL_VOICE_STATE, voiceReducer } from "@/lib/modules/voice/recording-state";
import type { VoiceEvent, VoiceState, RecordingMeta } from "@/lib/modules/voice/contracts";
import { VOICE_THRESHOLDS } from "@/lib/modules/voice/contracts";
import {
  chooseSupportedAudioMimeType,
  extensionForMime,
  codecFromMime,
  browserFamily,
} from "@/lib/modules/voice/mime-negotiation";

export interface VoiceRecording {
  blob: Blob;
  url: string;
  meta: RecordingMeta;
}

export interface UseVoiceRecorder {
  state: VoiceState;
  recording: VoiceRecording | null;
  errorMessage: string | null;
  /** المسار الحيّ (لرسم الموجة عبر AnalyserNode). */
  stream: MediaStream | null;
  requestAndStart: () => Promise<void>;
  lock: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  cancel: () => void;
  deleteRecording: () => void;
  markUploading: () => void;
  markTranscribed: () => void;
  reset: () => void;
}

const MAX_MS = VOICE_THRESHOLDS.VOICE_MAX_DURATION_SECONDS * 1000;

export function useVoiceRecorder(maxBytes = VOICE_THRESHOLDS.VOICE_MAX_BYTES): UseVoiceRecorder {
  const [state, dispatch] = useReducer(
    (s: VoiceState, e: VoiceEvent) => voiceReducer(s, e),
    INITIAL_VOICE_STATE,
  );
  const [recording, setRecording] = useState<VoiceRecording | null>(null);
  const [errorMessage, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number>(0);
  const pausedMsRef = useRef<number>(0);
  const lastPauseRef = useRef<number>(0);
  const mimeRef = useRef<string>("");
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── تنظيفٌ صارم (§10): يوقف المسارات ويلغي المؤقّتات. لا يمسّ الـblob المحفوظ. ──
  const teardownCapture = useCallback(() => {
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    } catch {
      /* تجاهل */
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const disposeRecording = useCallback(() => {
    setRecording((prev) => {
      if (prev?.url) {
        try {
          URL.revokeObjectURL(prev.url);
        } catch {
          /* تجاهل */
        }
      }
      return null;
    });
    chunksRef.current = [];
  }, []);

  const durationMs = useCallback(() => {
    const active = startedAtRef.current ? Date.now() - startedAtRef.current - pausedMsRef.current : 0;
    return Math.max(0, active);
  }, []);

  const finalize = useCallback(() => {
    const parts = chunksRef.current;
    const mimeType = mimeRef.current || "audio/webm";
    const blob = new Blob(parts, { type: mimeType });
    const dur = durationMs();
    // التسجيل القصير جدًّا لا يُرسَل (§6).
    if (dur < VOICE_THRESHOLDS.VOICE_MIN_RECORDING_MS || blob.size === 0) {
      disposeRecording();
      dispatch({ type: "TOO_SHORT" });
      teardownCapture();
      return;
    }
    if (blob.size > maxBytes) {
      setError("حجم التسجيل يتجاوز الحدّ المسموح.");
      disposeRecording();
      dispatch({ type: "ERROR" });
      teardownCapture();
      return;
    }
    const url = URL.createObjectURL(blob);
    const meta: RecordingMeta = {
      mimeType,
      extension: extensionForMime(mimeType),
      codec: codecFromMime(mimeType),
      browserFamily: typeof navigator !== "undefined" ? browserFamily(navigator.userAgent) : undefined,
      durationMs: dur,
      byteSize: blob.size,
    };
    setRecording({ blob, url, meta });
    dispatch({ type: "STOPPED" });
    teardownCapture();
  }, [durationMs, disposeRecording, teardownCapture, maxBytes]);

  const requestAndStart = useCallback(async () => {
    setError(null);
    disposeRecording();
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      dispatch({ type: "UNSUPPORTED" });
      setError("المتصفّح لا يدعم التسجيل الصوتي.");
      return;
    }
    dispatch({ type: "REQUEST_PERMISSION" });
    let s: MediaStream;
    try {
      s = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        dispatch({ type: "PERMISSION_DENIED" });
        setError("يلزم إذن الميكروفون للتسجيل.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        dispatch({ type: "DEVICE_NOT_FOUND" });
        setError("لا يوجد ميكروفون متاح.");
      } else {
        dispatch({ type: "ERROR" });
        setError("تعذّر بدء التسجيل.");
      }
      return;
    }
    const mimeType = chooseSupportedAudioMimeType((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    let rec: MediaRecorder;
    try {
      rec = mimeType ? new MediaRecorder(s, { mimeType }) : new MediaRecorder(s);
    } catch {
      s.getTracks().forEach((t) => t.stop());
      dispatch({ type: "ERROR" });
      setError("صيغة تسجيلٍ غير مدعومة على هذا الجهاز.");
      return;
    }
    mimeRef.current = rec.mimeType || mimeType || "audio/webm";
    chunksRef.current = [];
    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    rec.onstop = finalize;
    rec.onerror = () => {
      dispatch({ type: "ERROR" });
      setError("خطأ أثناء التسجيل.");
      teardownCapture();
    };
    recorderRef.current = rec;
    streamRef.current = s;
    setStream(s);
    startedAtRef.current = Date.now();
    pausedMsRef.current = 0;
    try {
      rec.start(100); // شرائح صغيرة لتدفّق البيانات + موجةٍ حيّة
    } catch {
      teardownCapture();
      dispatch({ type: "ERROR" });
      setError("تعذّر بدء التسجيل.");
      return;
    }
    dispatch({ type: "PERMISSION_GRANTED" });
    // إيقافٌ تلقائيّ عند الحدّ الأقصى (§9).
    maxTimerRef.current = setTimeout(() => {
      setError("بلغ التسجيل الحدّ الأقصى للمدّة.");
      try {
        recorderRef.current?.stop();
      } catch {
        /* تجاهل */
      }
    }, MAX_MS);
  }, [disposeRecording, finalize, teardownCapture]);

  const lock = useCallback(() => dispatch({ type: "LOCK" }), []);
  const pause = useCallback(() => {
    try {
      recorderRef.current?.pause();
      lastPauseRef.current = Date.now();
      dispatch({ type: "PAUSE" });
    } catch {
      /* تجاهل */
    }
  }, []);
  const resume = useCallback(() => {
    try {
      recorderRef.current?.resume();
      if (lastPauseRef.current) pausedMsRef.current += Date.now() - lastPauseRef.current;
      lastPauseRef.current = 0;
      dispatch({ type: "RESUME" });
    } catch {
      /* تجاهل */
    }
  }, []);
  const stop = useCallback(() => {
    dispatch({ type: "STOP" });
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      else finalize();
    } catch {
      finalize();
    }
  }, [finalize]);
  const cancel = useCallback(() => {
    dispatch({ type: "CANCEL" });
    disposeRecording();
    teardownCapture();
  }, [disposeRecording, teardownCapture]);
  const deleteRecording = useCallback(() => {
    dispatch({ type: "DELETE" });
    disposeRecording();
    teardownCapture();
  }, [disposeRecording, teardownCapture]);
  const markUploading = useCallback(() => dispatch({ type: "TRANSCRIBE" }), []);
  const markTranscribed = useCallback(() => dispatch({ type: "TRANSCRIBED" }), []);
  const reset = useCallback(() => {
    disposeRecording();
    teardownCapture();
    dispatch({ type: "RESET" });
  }, [disposeRecording, teardownCapture]);

  // ── خروج الصفحة/الخلفية: لا تُبقِ الميكروفون نشطًا (§10). ──
  useEffect(() => {
    const onHide = () => {
      if (recorderRef.current && recorderRef.current.state === "recording") {
        try {
          recorderRef.current.stop();
        } catch {
          /* تجاهل */
        }
      }
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onHide();
    });
    return () => {
      window.removeEventListener("pagehide", onHide);
      teardownCapture();
    };
  }, [teardownCapture]);

  return {
    state,
    recording,
    errorMessage,
    stream,
    requestAndStart,
    lock,
    pause,
    resume,
    stop,
    cancel,
    deleteRecording,
    markUploading,
    markTranscribed,
    reset,
  };
}
