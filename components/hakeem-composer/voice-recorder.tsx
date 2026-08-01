"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function VoiceButton({
  disabled,
  onTranscript,
}: {
  disabled?: boolean;
  onTranscript: (text: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const finalRef = useRef("");

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognition()));
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  function stop() {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setRecording(false);
  }

  function start() {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setError("المتصفح لا يدعم الإدخال الصوتي.");
      return;
    }
    setError(null);
    finalRef.current = "";
    const rec = new Ctor();
    rec.lang = "ar-SA";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (ev) => {
      let interim = "";
      let finalText = finalRef.current;
      for (let i = 0; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      finalRef.current = finalText;
      const combined = `${finalText}${interim}`.trim();
      if (combined) onTranscript(combined);
    };
    rec.onerror = (ev) => {
      setRecording(false);
      if (ev.error === "not-allowed") setError("يلزم إذن الميكروفون للتسجيل.");
      else if (ev.error !== "aborted") setError("تعذّر التسجيل الصوتي.");
    };
    rec.onend = () => setRecording(false);
    recRef.current = rec;
    try {
      rec.start();
      setRecording(true);
    } catch {
      setError("تعذّر بدء التسجيل.");
      setRecording(false);
    }
  }

  if (!supported) {
    return (
      <button
        type="button"
        className="hkm-composer__tool-btn focus-ring"
        disabled
        title="الإدخال الصوتي غير مدعوم في هذا المتصفح"
        aria-label="الإدخال الصوتي غير مدعوم"
      >
        <Mic size={15} aria-hidden />
      </button>
    );
  }

  return (
    <div className="hkm-composer__voice">
      <button
        type="button"
        className={`hkm-composer__tool-btn focus-ring ${recording ? "is-recording" : ""}`}
        disabled={disabled}
        aria-pressed={recording}
        aria-label={recording ? "إيقاف التسجيل" : "تسجيل صوتي"}
        title={recording ? "إيقاف ومراجعة النص" : "سجّل سؤالك صوتيًا (عربي)"}
        onClick={() => (recording ? stop() : start())}
      >
        {recording ? <Square size={14} aria-hidden /> : <Mic size={15} aria-hidden />}
        <span className="hkm-composer__tool-label">{recording ? "إيقاف" : "صوت"}</span>
      </button>
      {error ? (
        <span className="hkm-composer__voice-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
