"use client";

// Speaking a question instead of typing it: the browser's own speech recognition (Chrome, Edge, Safari).
// Where the browser cannot do it (e.g. Firefox), the button is not shown.
import { useEffect, useRef, useState } from "react";
import { tr, currentLocale } from "@/i18n";

type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

export default function VoiceButton({ onText, onFinal }: { onText: (text: string) => void; onFinal?: (text: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  const [err, setErr] = useState("");
  const rec = useRef<Rec | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  function toggle() {
    if (on) {
      rec.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const R = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!R) return;
    const r = new R();
    const l = currentLocale();
    r.lang = l === "en" ? "en-US" : l === "zh" ? "zh-CN" : "ru-RU";
    r.interimResults = true;
    r.continuous = false;
    let finalText = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      onText((finalText + interim).trim());
    };
    r.onerror = (e) => setErr(e.error === "not-allowed" ? tr("Разрешите доступ к микрофону в настройках браузера") : e.error === "no-speech" ? tr("Не расслышал, попробуйте ещё раз") : tr("Распознавание речи недоступно"));
    r.onend = () => {
      setOn(false);
      if (finalText.trim()) onFinal?.(finalText.trim());
    };
    setErr("");
    rec.current = r;
    r.start();
    setOn(true);
  }

  if (!supported) return null;
  return (
    <span className="voice">
      <button type="button" className={`voice-btn${on ? " is-on" : ""}`} onClick={toggle} aria-pressed={on} aria-label={on ? tr("Остановить запись") : tr("Сказать голосом")} title={on ? tr("Остановить запись") : tr("Сказать голосом")}>
        {on ? "■" : "🎤"}
      </button>
      {on && <span className="voice-hint">{tr("Говорите…")}</span>}
      {err && !on && <span className="voice-hint is-err">{err}</span>}
    </span>
  );
}
