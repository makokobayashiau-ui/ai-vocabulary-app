"use client";

import { useEffect, useMemo, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

type Accent = "en-US" | "en-GB";

function pickVoice(voices: SpeechSynthesisVoice[], accent: Accent) {
  return (
    voices.find((voice) => voice.lang === accent)
    ?? voices.find((voice) => voice.lang.toLowerCase().startsWith(accent.toLowerCase()))
    ?? voices.find((voice) => voice.lang.toLowerCase().startsWith("en"))
    ?? null
  );
}

export function PronunciationButton({ text }: { text: string }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [accent, setAccent] = useState<Accent>("en-US");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const canSpeak = supported === true;

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      const unsupportedTimer = globalThis.setTimeout(() => setSupported(false), 0);
      return () => globalThis.clearTimeout(unsupportedTimer);
    }

    const supportTimer = globalThis.setTimeout(() => {
      setSupported(true);
      setVoices(window.speechSynthesis.getVoices());
    }, 0);

    const loadVoices = () => {
      setSupported(true);
      setVoices(window.speechSynthesis.getVoices());
    };

    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);

    return () => {
      globalThis.clearTimeout(supportTimer);
      window.speechSynthesis.cancel();
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  const voice = useMemo(() => pickVoice(voices, accent), [voices, accent]);

  function speak() {
    if (!canSpeak || typeof window === "undefined") return;

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = accent;
    if (voice) utterance.voice = voice;
    utterance.rate = 0.86;
    utterance.pitch = 1;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="pronunciation-control">
      <div className="pronunciation-accent" aria-label="Accent">
        <button
          type="button"
          className="accent-pill"
          data-active={accent === "en-US" ? "true" : undefined}
          onClick={() => setAccent("en-US")}
          disabled={!canSpeak}
        >
          US
        </button>
        <button
          type="button"
          className="accent-pill"
          data-active={accent === "en-GB" ? "true" : undefined}
          onClick={() => setAccent("en-GB")}
          disabled={!canSpeak}
        >
          UK
        </button>
      </div>
      <button
        type="button"
        className="btn btn-soft pronunciation-button"
        onClick={speak}
        disabled={!canSpeak}
        aria-label={canSpeak ? `Listen to ${text}` : "This browser cannot play speech"}
        aria-pressed={speaking}
      >
        {canSpeak ? <Volume2 size={16} /> : <VolumeX size={16} />}
        {canSpeak ? (speaking ? "Stop" : "Listen") : "Not supported"}
      </button>
    </div>
  );
}
