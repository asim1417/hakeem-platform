"use client";
// ─────────────────────────────────────────────────────────────────────────────
// HKM-VOICE-NOTE-SA-007 §7 — معاينة نمط Voice Memos: موجةٌ كاملة + تشغيل/seek + مدّة +
// حذف/إعادة تسجيل/تحويل إلى نص. حالة «محليّ — لم يُرفع بعد». يستعمل wavesurfer.js.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { Play, Pause, Trash2, RotateCcw, FileText } from "lucide-react";
import type { VoiceRecording } from "./useVoiceRecorder";

function fmt(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function VoicePreview({
  recording,
  busy,
  onDelete,
  onReRecord,
  onTranscribe,
}: {
  recording: VoiceRecording;
  busy: boolean;
  onDelete: () => void;
  onReRecord: () => void;
  onTranscribe: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<{ destroy: () => void; playPause: () => void; on: (e: string, cb: () => void) => void } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);

  useEffect(() => {
    let disposed = false;
    let ws: { destroy: () => void; playPause: () => void; on: (e: string, cb: (t?: number) => void) => void } | null = null;
    (async () => {
      const mod = await import("wavesurfer.js");
      if (disposed || !containerRef.current) return;
      const WaveSurfer = mod.default;
      ws = WaveSurfer.create({
        container: containerRef.current,
        height: 40,
        waveColor: "#cdb38a",
        progressColor: "#c69763",
        cursorColor: "#1a5c41",
        barWidth: 2,
        barGap: 2,
        barRadius: 2,
        url: recording.url,
      }) as unknown as typeof ws;
      wsRef.current = ws as unknown as typeof wsRef.current;
      ws!.on("play", () => setPlaying(true));
      ws!.on("pause", () => setPlaying(false));
      ws!.on("finish", () => setPlaying(false));
      ws!.on("timeupdate", (t?: number) => setPos((t ?? 0) * 1000));
    })();
    return () => {
      disposed = true;
      try {
        ws?.destroy();
      } catch {
        /* تجاهل */
      }
      wsRef.current = null;
    };
  }, [recording.url]);

  return (
    <div className="hkm-voice__preview" role="group" aria-label="تسجيل صوتي">
      <div className="hkm-voice__preview-head">
        <span className="hkm-voice__preview-title">تسجيل صوتي</span>
        <span className="hkm-voice__preview-local">محليّ — لم يُرفع بعد</span>
      </div>
      <div className="hkm-voice__preview-row">
        <button
          type="button"
          className="hkm-voice__icon-btn"
          onClick={() => wsRef.current?.playPause()}
          aria-label={playing ? "إيقاف مؤقّت" : "تشغيل"}
          disabled={busy}
        >
          {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
        </button>
        <div ref={containerRef} className="hkm-voice__preview-wave" />
        <span className="hkm-voice__preview-time" aria-live="off">
          {fmt(pos)} / {fmt(recording.meta.durationMs)}
        </span>
      </div>
      <div className="hkm-voice__preview-actions">
        <button type="button" className="hkm-voice__pill hkm-voice__pill--primary" onClick={onTranscribe} disabled={busy}>
          <FileText size={15} aria-hidden /> تحويل إلى نص
        </button>
        <button type="button" className="hkm-voice__pill" onClick={onReRecord} disabled={busy}>
          <RotateCcw size={15} aria-hidden /> إعادة التسجيل
        </button>
        <button type="button" className="hkm-voice__pill hkm-voice__pill--danger" onClick={onDelete} disabled={busy}>
          <Trash2 size={15} aria-hidden /> حذف
        </button>
      </div>
    </div>
  );
}
