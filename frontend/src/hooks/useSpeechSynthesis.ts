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
  /** Current TTS playback rate (1 | 1.25 | 1.5 | 2) */
  ttsRate: number;
  /** Update TTS playback rate */
  setTtsRate: (rate: number) => void;
  /** Speak the given text with optional onDone completion callback */
  speak: (text: string, onDone?: () => void) => void;
  /** Pause current speech */
  pause: () => void;
  /** Resume paused speech */
  resume: () => void;
  /** Cancel all speech */
  cancel: () => void;
  /** Play pleasant soft chime earcon */
  playChime: (type?: "start" | "success" | "stop") => void;
  /** Play status-specific earcon melody based on health score tier */
  playStatusEarcon: (status: string) => void;
  /** Manually unlock and resume AudioContext and SpeechSynthesis on user gesture */
  unlockAudio: () => void;
}

/**
 * Play a soothing, harmonic Web Audio API chime (Earcon).
 * Avoids harsh beeps and produces a warm, accessible auditory cue.
 */
let _sharedAudioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!_sharedAudioCtx || _sharedAudioCtx.state === "closed") {
    try {
      _sharedAudioCtx = new AudioContextClass();
    } catch {
      return null;
    }
  }
  if (_sharedAudioCtx.state === "suspended") {
    _sharedAudioCtx.resume().catch(() => {});
  }
  return _sharedAudioCtx;
}

export function unlockAudio(): void {
  if (typeof window === "undefined") return;
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  if ("speechSynthesis" in window) {
    try {
      window.speechSynthesis.resume();
    } catch {}
  }
}

/**
 * Play a soothing, harmonic Web Audio API chime (Earcon).
 * Avoids harsh beeps and produces a warm, accessible auditory cue.
 */
function playToneChime(type: "start" | "success" | "stop" = "start") {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
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

/**
 * Play a status-specific earcon melody based on health score tier.
 * Uses Web Audio API to generate tones — no external audio files needed.
 *
 * SANGAT SEHAT : C5→E5→G5→C6  (ascending major arpeggio, bright & ceria)
 * SEHAT        : C5→E5→G5      (3-note major triad, pleasant)
 * WASPADA      : E4→D4→C4      (descending minor, cautionary)
 * BERISIKO TINGGI: C4→B3→A3    (descending chromatic, somber/dramatic)
 */
function playStatusEarconTone(status: string) {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Note frequencies (Hz)
  const NOTE: Record<string, number> = {
    A3: 220.00, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63,
    G4: 392.00, A4: 440.00, C5: 523.25, E5: 659.25, G5: 783.99,
    A5: 880.00, C6: 1046.50,
  };

  // [freq, startOffset, duration]
  type NoteSeq = [number, number, number][];

  let sequence: NoteSeq;
  const normalized = status.toUpperCase().trim();

  if (normalized === "SANGAT SEHAT") {
    // Bright ascending arpeggio — ceria, uplifting
    sequence = [
      [NOTE.C5, 0.00, 0.12],
      [NOTE.E5, 0.13, 0.12],
      [NOTE.G5, 0.26, 0.12],
      [NOTE.C6, 0.39, 0.22],
    ];
  } else if (normalized === "SEHAT") {
    // Pleasant 3-note major
    sequence = [
      [NOTE.C5, 0.00, 0.12],
      [NOTE.E5, 0.14, 0.12],
      [NOTE.G5, 0.28, 0.18],
    ];
  } else if (normalized === "WASPADA") {
    // Descending cautionary — minor feel
    sequence = [
      [NOTE.E4, 0.00, 0.14],
      [NOTE.D4, 0.16, 0.14],
      [NOTE.C4, 0.32, 0.22],
    ];
  } else {
    // BERISIKO TINGGI — somber descending
    sequence = [
      [NOTE.C4, 0.00, 0.16],
      [NOTE.B3, 0.18, 0.16],
      [NOTE.A3, 0.36, 0.26],
    ];
  }

  try {
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.10, now);
    masterGain.connect(ctx.destination);

    sequence.forEach(([freq, offset, dur]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + offset);
      gain.gain.setValueAtTime(0.12, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + dur);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now + offset);
      osc.stop(now + offset + dur + 0.01);
    });
  } catch {
    // AudioContext restricted before user gesture — gracefully ignore
  }
}

export function useSpeechSynthesis(
  options: UseSpeechSynthesisOptions = {}
): UseSpeechSynthesisReturn {
  const { lang = "id-ID", rate = 1.0, pitch = 1.02, onBoundary, onEnd } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>("");

  // TTS speed — persisted to localStorage so it survives page reload
  const [ttsRate, setTtsRateState] = useState<number>(() => {
    if (typeof window === "undefined") return rate;
    const saved = localStorage.getItem("wini_tts_rate");
    return saved ? parseFloat(saved) : rate;
  });
  // Ref so speak() always sees the latest rate without recreating the callback
  const rateRef = useRef<number>(ttsRate);
  rateRef.current = ttsRate;

  const setTtsRate = useCallback((newRate: number) => {
    setTtsRateState(newRate);
    rateRef.current = newRate;
    if (typeof window !== "undefined") {
      localStorage.setItem("wini_tts_rate", String(newRate));
    }
  }, []);

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
    (text: string, onDone?: () => void) => {
      if (!isSupported || isMuted || !text.trim()) {
        onDone?.();
        return;
      }

      const spokenText = cleanTextForSpeech(text);
      if (!spokenText) {
        onDone?.();
        return;
      }

      try {
        if (utteranceRef.current) {
          utteranceRef.current.onstart = null;
          utteranceRef.current.onend = null;
          utteranceRef.current.onerror = null;
          utteranceRef.current.onboundary = null;
        }
        window.speechSynthesis.cancel();
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }

        const utterance = new SpeechSynthesisUtterance(spokenText);
        utterance.lang = lang;
        utterance.rate = rateRef.current;  // always use current speed
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
          onDone?.();
        };
        utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
          setIsSpeaking(false);
          if (e.error !== "canceled" && e.error !== "interrupted") {
            onDone?.();
          }
        };
        utterance.onboundary = (e) => {
          onBoundaryRef.current?.(e);
        };

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch {
        setIsSpeaking(false);
        onDone?.();
      }
    },
    [isSupported, isMuted, lang, pitch, pickBestIndonesianVoice]
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
    if (utteranceRef.current) {
      utteranceRef.current.onstart = null;
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
      utteranceRef.current.onboundary = null;
    }
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

  const playStatusEarcon = useCallback((status: string) => {
    if (!isMuted) {
      playStatusEarconTone(status);
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
    ttsRate,
    setTtsRate,
    speak,
    pause,
    resume,
    cancel,
    playChime,
    playStatusEarcon,
    unlockAudio,
  };
}
