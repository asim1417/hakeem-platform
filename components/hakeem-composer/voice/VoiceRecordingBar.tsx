"use client";
// HKM-VOICE-NOTE-SA-007 §6 — شريط التسجيل بالضغط: موجةٌ حيّة + مؤشّرات «اسحب للإلغاء/للقفل».
import { Mic, ChevronRight, Lock } from "lucide-react";
import { VoiceWaveform } from "./VoiceWaveform";

export function VoiceRecordingBar({
  stream,
  elapsedMs,
  cancelProgress,
  lockProgress,
}: {
  stream: MediaStream | null;
  elapsedMs: number;
  cancelProgress: number;
  lockProgress: number;
}) {
  const secs = Math.floor(elapsedMs / 1000);
  const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  return (
    <div className="hkm-voice__bar" role="status" aria-label="جارٍ التسجيل">
      <span className="hkm-voice__rec-dot" aria-hidden />
      <span className="hkm-voice__bar-time">{time}</span>
      <VoiceWaveform stream={stream} active />
      <span className="hkm-voice__hint" style={{ opacity: 1 - cancelProgress }}>
        <ChevronRight size={14} aria-hidden /> اسحب للإلغاء
      </span>
      <span className="hkm-voice__hint hkm-voice__hint--lock" style={{ opacity: 0.5 + lockProgress * 0.5 }}>
        <Lock size={14} aria-hidden /> اسحب للأعلى للقفل
      </span>
      <Mic size={16} aria-hidden className="hkm-voice__bar-mic" />
    </div>
  );
}
