"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cleanTextForSpeech } from "@/lib/speechUtils";

export interface UseSpeechSynthesisOptions {
  /** BCP-47 language tag. Defaults to "id-ID" */
  lang?: string;
  /** Speech rate (0.1 – 10). Defaults to 0.98 */
  rate?: number;
  /** Speech pitch (0 – 2). Defaults to 1.02 */
  pitch?: number;
  /** Called when a word boundary is reached (for caption highlighting) */
  onBoundary?: (event: SpeechSynthesisEvent) => void;
  /** Called when speech finishes */
  onEnd?: () => void;
}

export interface UseSpeechSynthesisReturn {
  /** Whether the browser supports SpeechSynthesis */
  isSupported: boolean;
  /** Whether speech is currently playing */
  isSpeaking: boolean;
  /** Whether audio output is muted */
  isMuted: boolean;
  /** Toggle audio mute state */
  toggleMute: () => void;
  /** Current voice name being used */
  selectedVoiceName: string;
  /** Speak the given text */
  speak: (text: string) => void;
  /** Pause current speech */
  pause: () => void;
  /** Resume paused speech */
  resume: () => void;
  /** Cancel all speech */
  cancel: () => void;
  /** Play pleasant soft chime earcon */
  playChime: (type?: "start" | "success" | "stop") => void;
}

/**
 * Play a soothing, harmonic Web Audio API chime (Earcon).
 * Avoids harsh beeps and produces a warm, accessible auditory cue.
 */
function playToneChime(type: "start" | "success" | "stop" = "start") {
  if (typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    gain.connect(ctx.destination);
    osc.connect(gain);

    if (type === "start") {
      // Warm rising two-tone chime (C5 -> G5)
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.12);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.36);
    } else if (type === "success") {
      // Gentle confirmation triad (F5 -> A5 -> C6)
      osc.frequency.setValueAtTime(698.46, now);
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.16);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.46);
    } else {
      // Soft descending tone (G5 -> E5)
      osc.frequency.setValueAtTime(783.99, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.26);
    }
  } catch {
    // Audio context may be restricted before user gesture; gracefully ignore
  }
}

export function useSpeechSynthesis(
  options: UseSpeechSynthesisOptions = {}
): UseSpeechSynthesisReturn {
  const { lang = "id-ID", rate = 0.98, pitch = 1.02, onBoundary, onEnd } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>("");

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  const onBoundaryRef = useRef(onBoundary);
  const onEndRef = useRef(onEnd);
  onBoundaryRef.current = onBoundary;
  onEndRef.current = onEnd;

  // Find the highest quality Indonesian voice available
  const pickBestIndonesianVoice = useCallback((voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
    if (!voices || voices.length === 0) return null;

    // 1. Check for modern Natural / Online / Google Indonesian voices
    const preferredNames = [
      "gadis",
      "google bahasa indonesia",
      "ardi",
      "siri",
      "natural",
      "indonesian",
      "indonesia",
    ];

    const idVoices = voices.filter(
      (v) => v.lang.toLowerCase().startsWith("id") || v.lang.toLowerCase().startsWith("in")
    );

    if (idVoices.length > 0) {
      for (const pref of preferredNames) {
        const match = idVoices.find((v) => v.name.toLowerCase().includes(pref));
        if (match) return match;
      }
      // Return first Indonesian voice
      return idVoices[0];
    }

    // Fallback: search anywhere in voice names
    const nameMatch = voices.find((v) => v.name.toLowerCase().includes("indonesia"));
    if (nameMatch) return nameMatch;

    // Malay voice fallback (phonetically close to Indonesian)
    const msVoice = voices.find((v) => v.lang.toLowerCase().startsWith("ms"));
    if (msVoice) return msVoice;

    return null;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const updateVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      voicesRef.current = availableVoices;
      const best = pickBestIndonesianVoice(availableVoices);
      if (best) {
        setSelectedVoiceName(best.name);
      }
    };

    updateVoices();

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, [pickBestIndonesianVoice]);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported || isMuted || !text.trim()) return;

      const spokenText = cleanTextForSpeech(text);
      if (!spokenText) return;

      try {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(spokenText);
        utterance.lang = lang;
        utterance.rate = rate;
        utterance.pitch = pitch;

        const availableVoices = voicesRef.current.length > 0 ? voicesRef.current : window.speechSynthesis.getVoices();
        const bestVoice = pickBestIndonesianVoice(availableVoices);
        if (bestVoice) {
          utterance.voice = bestVoice;
          setSelectedVoiceName(bestVoice.name);
        }

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => {
          setIsSpeaking(false);
          onEndRef.current?.();
        };
        utterance.onerror = () => {
          setIsSpeaking(false);
        };
        utterance.onboundary = (e) => {
          onBoundaryRef.current?.(e);
        };

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      } catch {
        setIsSpeaking(false);
      }
    },
    [isSupported, isMuted, lang, rate, pitch, pickBestIndonesianVoice]
  );

  const pause = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.pause();
    setIsSpeaking(false);
  }, [isSupported]);

  const resume = useCallback(() => {
    if (!isSupported || isMuted) return;
    window.speechSynthesis.resume();
    setIsSpeaking(true);
  }, [isSupported, isMuted]);

  const cancel = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next && typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      }
      return next;
    });
  }, []);

  const playChime = useCallback((type?: "start" | "success" | "stop") => {
    if (!isMuted) {
      playToneChime(type);
    }
  }, [isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSupported && typeof window !== "undefined") {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  return {
    isSupported,
    isSpeaking,
    isMuted,
    toggleMute,
    selectedVoiceName,
    speak,
    pause,
    resume,
    cancel,
    playChime,
  };
}
