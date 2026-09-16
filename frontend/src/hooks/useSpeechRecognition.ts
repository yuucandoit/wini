"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Browser type for SpeechRecognition instance
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

export interface UseSpeechRecognitionOptions {
  /** BCP-47 language tag. Defaults to "id-ID" */
  lang?: string;
  /** Enable continuous recognition. Defaults to true */
  continuous?: boolean;
  /** Return interim (partial) results. Defaults to true */
  interimResults?: boolean;
  /** Automatically restart on silence/disconnect (wake-word listening mode) */
  autoRestart?: boolean;
  /**
   * Minimum confidence [0-1] for a final result to be accepted.
   * Results below this threshold (mumbling, noise) are silently discarded.
   * Defaults to 0.60. Set to 0 to disable filtering.
   */
  confidenceThreshold?: number;
  /** Called with the final transcript when recognition ends */
  onResult?: (transcript: string) => void;
  /** Called with interim transcript for live display */
  onInterim?: (transcript: string) => void;
}

export interface UseSpeechRecognitionReturn {
  /** Whether the browser supports SpeechRecognition */
  isSupported: boolean;
  /** Whether recognition is actively listening */
  isListening: boolean;
  /** The current (final + interim) transcript */
  transcript: string;
  /** Start listening */
  startListening: () => void;
  /** Stop listening */
  stopListening: () => void;
  /** Temporarily pause listening (e.g. while TTS is speaking) */
  pauseListening: () => void;
  /** Resume listening after pause */
  resumeListening: () => void;
  /** Reset transcript */
  resetTranscript: () => void;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const {
    lang = "id-ID",
    continuous = true,
    interimResults = true,
    autoRestart = false,
    confidenceThreshold = 0.60,
    onResult,
    onInterim,
  } = options;

  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onResultRef = useRef(onResult);
  const onInterimRef = useRef(onInterim);
  const shouldKeepListeningRef = useRef(false);
  const isPausedRef = useRef(false);

  onResultRef.current = onResult;
  onInterimRef.current = onInterim;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognitionAPI =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const recognition = new SpeechRecognitionAPI() as SpeechRecognitionInstance;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const confidence = result[0].confidence ?? 1; // default 1 if browser omits it
          if (confidence >= confidenceThreshold) {
            finalTranscript += result[0].transcript;
          } else {
            // Quietly discard low-confidence result (noise / mumbling)
            console.debug(
              `[STT] Discarded low-confidence result (${(confidence * 100).toFixed(0)}%): "${result[0].transcript}"`
            );
          }
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) {
        setTranscript(finalTranscript);
        onResultRef.current?.(finalTranscript);
      }

      if (interimTranscript) {
        onInterimRef.current?.(interimTranscript);
      }
    };

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);

      // Auto-restart if autoRestart is enabled and not paused or explicitly stopped
      if (shouldKeepListeningRef.current && !isPausedRef.current) {
        try {
          recognition.start();
        } catch {
          // May throttle slightly on rapid reconnects
          setTimeout(() => {
            if (shouldKeepListeningRef.current && !isPausedRef.current) {
              try {
                recognition.start();
              } catch {}
            }
          }, 300);
        }
      }
    };

    recognition.onerror = (event: { error: string }) => {
      if (event.error !== "no-speech") {
        console.warn("SpeechRecognition notice:", event.error);
      }
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      shouldKeepListeningRef.current = false;
      recognition.abort();
    };
  }, [lang, continuous, interimResults, autoRestart, confidenceThreshold]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    shouldKeepListeningRef.current = true;
    isPausedRef.current = false;
    try {
      setTranscript("");
      recognitionRef.current.start();
    } catch {
      // Already running or starting
    }
  }, []);

  const stopListening = useCallback(() => {
    shouldKeepListeningRef.current = false;
    isPausedRef.current = false;
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      // Already stopped
    }
  }, []);

  const pauseListening = useCallback(() => {
    isPausedRef.current = true;
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {}
  }, []);

  const resumeListening = useCallback(() => {
    isPausedRef.current = false;
    if (!recognitionRef.current || !shouldKeepListeningRef.current) return;
    try {
      recognitionRef.current.start();
    } catch {}
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    startListening,
    stopListening,
    pauseListening,
    resumeListening,
    resetTranscript,
  };
}
