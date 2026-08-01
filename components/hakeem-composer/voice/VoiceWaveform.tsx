"use client";
// ─────────────────────────────────────────────────────────────────────────────
// HKM-VOICE-NOTE-SA-007 §6 — الموجة الحيّة أثناء التسجيل عبر Web Audio AnalyserNode.
// نتحكّم بدورة حياة AudioContext (§10) بأنفسنا؛ wavesurfer يُستعمل للمعاينة (VoicePreview).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react";

export function VoiceWaveform({ stream, active }: { stream: MediaStream | null; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!stream || !active || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const g = canvas.getContext("2d");
    if (!g) return;

    const AudioCtx =
      (window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!AudioCtx) return;
    const audioCtx = new AudioCtx();
    ctxRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const bins = analyser.frequencyBinCount;
    const data = new Uint8Array(bins);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(data);
      const w = canvas.width;
      const h = canvas.height;
      g.clearRect(0, 0, w, h);
      const bars = 32;
      const step = Math.floor(bins / bars);
      const bw = w / bars;
      g.fillStyle = "#c69763";
      for (let i = 0; i < bars; i++) {
        const v = data[i * step] / 255;
        const bh = Math.max(2, v * h);
        g.fillRect(i * bw + 1, (h - bh) / 2, bw - 2, bh);
      }
    };
    draw();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      try {
        source.disconnect();
      } catch {
        /* تجاهل */
      }
      audioCtx.close().catch(() => undefined);
      ctxRef.current = null;
    };
  }, [stream, active]);

  return <canvas ref={canvasRef} width={220} height={36} className="hkm-voice__wave" aria-hidden />;
}
