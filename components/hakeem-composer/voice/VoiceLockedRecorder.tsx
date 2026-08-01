"use client";
// HKM-VOICE-NOTE-SA-007 §6/§7 — التسجيل المقفل: يستمرّ دون ضغط + إيقاف مؤقّت/استئناف/إنهاء/حذف.
import { Pause, Play, Square, Trash2 } from "lucide-react";
import { VoiceWaveform } from "./VoiceWaveform";

export function VoiceLockedRecorder({
  stream,
  paused,
  elapsedMs,
  onPause,
  onResume,
  onStop,
  onDelete,
}: {
  stream: MediaStream | null;
  paused: boolean;
  elapsedMs: number;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onDelete: () => void;
}) {
  const secs = Math.floor(elapsedMs / 1000);
  const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  return (
    <div className="hkm-voice__locked" role="group" aria-label="تسجيل مقفل">
      <span className={`hkm-voice__rec-dot ${paused ? "is-paused" : ""}`} aria-hidden />
      <span className="hkm-voice__bar-time">{time}</span>
      <VoiceWaveform stream={stream} active={!paused} />
      <div className="hkm-voice__locked-actions">
        <button type="button" className="hkm-voice__icon-btn" onClick={onDelete} aria-label="حذف">
          <Trash2 size={16} aria-hidden />
        </button>
        {paused ? (
          <button type="button" className="hkm-voice__icon-btn" onClick={onResume} aria-label="استئناف">
            <Play size={16} aria-hidden />
          </button>
        ) : (
          <button type="button" className="hkm-voice__icon-btn" onClick={onPause} aria-label="إيقاف مؤقّت">
            <Pause size={16} aria-hidden />
          </button>
        )}
        <button type="button" className="hkm-voice__icon-btn hkm-voice__icon-btn--stop" onClick={onStop} aria-label="إنهاء">
          <Square size={15} aria-hidden />
        </button>
      </div>
    </div>
  );
}
