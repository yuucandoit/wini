'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { AnalysisResult } from "@/lib/types";
import { analyzeStock, isMockModeActive, setMockModeActive } from "@/lib/api";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useAudioSpectrum } from "@/hooks/useAudioSpectrum";

import WelcomeBanner from "@/components/WelcomeBanner";
import ResultWorkspace from "@/components/ResultWorkspace";
import GlossaryCard from "@/components/GlossaryCard";
import { findGlossaryEntry, isGlossaryQuery } from "@/lib/glossary";
import type { GlossaryEntry } from "@/lib/glossary";

const GREETING_SPOKEN =
  "Selamat datang di WINI AI. Tekan tombol Mulai atau ucapkan Let's go WINI untuk memulai.";

const MIC_ACTIVE_ANNOUNCEMENT =
  "Mikrofon sudah aktif. Silakan sebutkan saham atau pertanyaan Anda.";

const QUICK_PROMPTS = [
  { label: "📊 Bandingkan TLKM vs ISAT", query: "Bandingkan fundamental saham TLKM dan ISAT" },
  { label: "🗓️ Tren 4 Kuartal ADRO", query: "Bagaimana tren kesehatan ADRO dalam 4 kuartal terakhir?" },
  { label: "📦 Simulasi Portofolio 10 Juta", query: "Kalau saya taruh 10 juta di BBCA, TLKM, dan ASII masing-masing sama rata, seberapa sehat portofolio saya?" },
  { label: "💰 Top 5 Saham Sehat", query: "Tampilkan top 5 saham paling sehat di BEI" },
  { label: "🏦 Top Saham Perbankan", query: "Rekomendasi top saham perbankan yang sehat" },
  { label: "📖 Apa itu DER?", query: "Apa itu DER?" },
];

function sanitizeSpokenQuery(text: string): string {
  let clean = text.trim();
  const echoPatterns = [
    /^.*?(?:mikrofon\s+sudah\s+aktif|silakan\s+sebutkan\s+saham\s+atau\s+pertanyaan\s+anda|sebutkan\s+saham\s+atau\s+pertanyaan\s+anda|pertanyaan\s+anda)\s*[,.:;]?\s*/i,
    /^.*?(?:silakan\s+sebutkan|sebutkan\s+saham)\s*[,.:;]?\s*/i,
  ];
  for (const pat of echoPatterns) {
    clean = clean.replace(pat, "").trim();
  }
  return clean;
}

function isWakeWordOrGreetingOnly(text: string): boolean {
  const t = text.toLowerCase().trim().replace(/['’]/g, "");
  return /^(halo(\s*wini)?|hai(\s*wini)?|hei(\s*wini)?|lets\s*go(\s*wini)?|mulai(\s*wini)?|tes(\s*mic)?|selamat\s*(pagi|siang|sore|malam)|assalamualaikum|wini)$/i.test(t);
}

function stripWakeWordPrefix(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^(?:halo|hai|hei|lets\s*go|let'?s\s*go|mulai)\s*(?:wini)?\s*[,.:;!-]?\s*/i, "");
  cleaned = cleaned.replace(/^wini\s*[,.:;!-]?\s*/i, "");
  return cleaned.trim();
}

export default function WiniWorkspace() {
  const [phase, setPhase] = useState<"greeting" | "dashboard" | "processing" | "results">("greeting");
  const [currentQuery, setCurrentQuery] = useState<string>("");
  const [textInput, setTextInput] = useState<string>("");
  const [captionText, setCaptionText] = useState<string>(
    "“Selamat datang di WINI AI. Tekan tombol Mulai atau ucapkan 'Let's go WINI' untuk memulai.”"
  );
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [glossaryEntry, setGlossaryEntry] = useState<GlossaryEntry | null>(null);
  const [isMockMode, setIsMockMode] = useState<boolean>(true);

  const textInputRef = useRef<HTMLInputElement>(null);
  const lastKeyTimeRef = useRef<number>(0);
  const lastPointerTimeRef = useRef<number>(0);
  const isMicActiveRef = useRef<boolean>(false);
  const phaseRef = useRef<string>("greeting");
  const isSpeakingRef = useRef<boolean>(false);
  const lastWakeWordHandledTimeRef = useRef<number>(0);
  const hasGreetingSpokenRef = useRef<boolean>(false);
  const startListeningRef = useRef<() => void>(() => {});
  const stopListeningRef = useRef<() => void>(() => {});
  const resetTranscriptRef = useRef<() => void>(() => {});

  // Speech synthesis hook with natural Indonesian voice
  const {
    isSupported: isTtsSupported,
    isSpeaking,
    isMuted,
    toggleMute,
    ttsRate,
    setTtsRate,
    speak,
    cancel: cancelSpeech,
    playChime,
    playStatusEarcon,
    unlockAudio,
  } = useSpeechSynthesis({
    lang: "id-ID",
    rate: 1.0,
    pitch: 1.02,
  });

  // Synchronize mock mode state from localStorage/env
  useEffect(() => {
    setIsMockMode(isMockModeActive());
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      setIsMockMode(customEvent.detail);
    };
    window.addEventListener("wini_mock_mode_changed", handler);
    return () => window.removeEventListener("wini_mock_mode_changed", handler);
  }, []);

  const handleToggleMockMode = useCallback(() => {
    const next = !isMockMode;
    setIsMockMode(next);
    setMockModeActive(next);
    const msg = next
      ? "Mode Mock Data aktif. Kuota API Sectors dihemat seratus persen."
      : "Mode API Nyata aktif. Menggunakan koneksi backend dan Sectors API.";
    setCaptionText(msg);
    speak(msg);
  }, [isMockMode, speak]);

  // Keep refs updated for event listeners & closures
  useEffect(() => {
    isMicActiveRef.current = isMicActive;
    phaseRef.current = phase;
    isSpeakingRef.current = isSpeaking;
  }, [isMicActive, phase, isSpeaking]);

  // Keep a ref to the latest result for use inside voice command handler closure
  const resultRef = useRef<typeof result>(null);
  resultRef.current = result;

  // Real-time microphone spectrum analyser (8 bars)
  const { barHeights, startSpectrum, stopSpectrum } = useAudioSpectrum({ bars: 8 });

  // Resume microphone listening safely after speech finishes
  const resumeListeningAfterSpeak = useCallback(() => {
    setTimeout(() => {
      if (phaseRef.current === "results" || phaseRef.current === "dashboard") {
        resetTranscriptRef.current();
        startListeningRef.current();
        startSpectrum();
        setIsMicActive(true);
      }
    }, 200);
  }, [startSpectrum]);

  // Voice command parser for the results page
  const handleVoiceCommandOnResults = useCallback((text: string) => {
    const cleanText = sanitizeSpokenQuery(text);
    const t = cleanText.toLowerCase().trim();

    // "ulangi" / "ulang lagi" / "baca ulang" → re-speak summary
    if (t.match(/\b(ulangi|ulang|baca ulang|repeat|ulangi lagi)\b/)) {
      cancelSpeech();
      const summary = resultRef.current?.summary;
      if (summary) {
        setCaptionText("🔁 Mengulangi ringkasan analisis...");
        stopListeningRef.current();
        stopSpectrum();
        setIsMicActive(false);
        speak(summary, resumeListeningAfterSpeak);
      }
      return;
    }

    // "utang" / "DER" / "DAR" / "berapa utang" → speak debt metrics
    if (t.match(/\b(utang|hutang|der|dar|berapa utang|liabilitas|leverage)\b/)) {
      cancelSpeech();
      const hs = resultRef.current?.healthScore;
      if (hs) {
        const msg = `Skor kesehatan ${hs.symbol}: ${hs.score} dari 100, status ${hs.category}.`;
        setCaptionText("📊 Membacakan skor kesehatan...");
        stopListeningRef.current();
        stopSpectrum();
        setIsMicActive(false);
        speak(msg, resumeListeningAfterSpeak);
      }
      return;
    }

    // "kembali" / "baru" / "analisis baru" / "selesai" → back to dashboard
    if (t.match(/\b(kembali|back|baru|analisis baru|selesai|reset|home|beranda)\b/)) {
      setCaptionText("↩️ Kembali ke dasbor...");
      // handleResetToDashboard will be called after this callback returns
      setTimeout(() => handleResetToDashboard(), 300);
      return;
    }

    // "rebalance" / "rebalancing" / "saran alokasi" → speak portfolio rebalancing advice
    if (t.match(/\b(rebalance|rebalancing|saran alokasi|alokasi|portofolio)\b/)) {
      const port = resultRef.current?.portfolio;
      if (port) {
        cancelSpeech();
        setCaptionText("⚖️ Membacakan saran rebalancing...");
        stopListeningRef.current();
        stopSpectrum();
        setIsMicActive(false);
        speak(port.rebalancingAdvice, resumeListeningAfterSpeak);
        return;
      }
    }

    // "tren" / "kuartal" / "grafik" → speak trend summary
    if (t.match(/\b(tren|kuartal|quarter|grafik|perkembangan)\b/)) {
      const tr = resultRef.current?.historicalTrend;
      if (tr) {
        cancelSpeech();
        setCaptionText("🗓️ Membacakan ringkasan tren...");
        stopListeningRef.current();
        stopSpectrum();
        setIsMicActive(false);
        speak(tr.summary, resumeListeningAfterSpeak);
        return;
      }
    }

    // --- Glossary intercept (also works from results page) ---
    if (isGlossaryQuery(cleanText)) {
      const entry = findGlossaryEntry(cleanText);
      if (entry) {
        cancelSpeech();
        stopListeningRef.current();
        stopSpectrum();
        setIsMicActive(false);
        setGlossaryEntry(entry);
        setCaptionText(`📖 ${entry.term}`);
        speak(`${entry.term}. ${entry.definition} Analogi: ${entry.analogy}`, resumeListeningAfterSpeak);
        return;
      }
    }

    // Any other utterance → treat as new query
    setCaptionText(`🔍 Menganalisis: "${cleanText}"`);
    handleSubmitQuery(cleanText);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelSpeech, speak, resumeListeningAfterSpeak, stopSpectrum]);

  // Handle final recognized speech — routes differently by phase
  const handleFinalSpeech = useCallback((spokenText: string) => {
    // If assistant is actively speaking, discard speech input to avoid audio echo bleed
    if (isSpeakingRef.current) return;

    const rawClean = sanitizeSpokenQuery(spokenText);
    if (!rawClean) return;

    // 1. Guard against wake word / greeting being treated as a stock query
    const isWakeOnly = isWakeWordOrGreetingOnly(rawClean);
    const now = Date.now();

    if (isWakeOnly) {
      // If we just handled this wake word via interim within 2.5 seconds, safely ignore duplicate final event
      if (now - lastWakeWordHandledTimeRef.current < 2500) {
        return;
      }
      lastWakeWordHandledTimeRef.current = now;

      if (phaseRef.current === "greeting") {
        cancelSpeech();
        stopListeningRef.current();
        stopSpectrum();
        setIsMicActive(false);
        playChime("success");
        setPhase("dashboard");
        setCaptionText("🎙️ Halo! Mau cek saham apa hari ini?");
        speak("Halo! Mau cek saham apa hari ini?", () => {
          setTimeout(() => {
            resetTranscriptRef.current();
            startListeningRef.current();
            startSpectrum();
            setIsMicActive(true);
          }, 200);
        });
        return;
      }

      if (phaseRef.current === "dashboard") {
        cancelSpeech();
        playChime("start");
        setCaptionText("🎙️ Halo! Silakan sebutkan saham yang ingin Anda analisis (contoh: BBCA atau TLKM)...");
        speak("Halo! Silakan sebutkan kode saham yang ingin Anda analisis, misalnya BBCA atau TLKM.", () => {
          setTimeout(() => {
            resetTranscriptRef.current();
            startListeningRef.current();
            startSpectrum();
            setIsMicActive(true);
          }, 200);
        });
        return;
      }

      if (phaseRef.current === "results") {
        cancelSpeech();
        playChime("start");
        setCaptionText("🎙️ Halo! Katakan 'ulangi', 'tren', atau sebutkan saham baru...");
        speak("Halo! Mau analisis saham apa lagi?", () => {
          setTimeout(() => {
            resetTranscriptRef.current();
            startListeningRef.current();
            startSpectrum();
            setIsMicActive(true);
          }, 200);
        });
        return;
      }
      return;
    }

    // 2. Strip wake word prefix if user said "Halo WINI, bagaimana fundamental BBRI?"
    const clean = stripWakeWordPrefix(rawClean);
    if (!clean) {
      // Nothing left after stripping prefix
      return;
    }

    // If user asked a real stock question while on the greeting screen, transition to dashboard
    if (phaseRef.current === "greeting") {
      setPhase("dashboard");
    }

    if (phaseRef.current === "results") {
      // Route to voice command parser instead of starting a brand-new query
      handleVoiceCommandOnResults(clean);
      return;
    }

    // --- Glossary intercept: "apa itu DER?", "jelaskan ROE", etc. ---
    if (isGlossaryQuery(clean)) {
      const entry = findGlossaryEntry(clean);
      if (entry) {
        cancelSpeech();
        stopListeningRef.current();
        stopSpectrum();
        setIsMicActive(false);
        setGlossaryEntry(entry);
        setCaptionText(`📖 ${entry.term}`);
        speak(`${entry.term}. ${entry.definition} Analogi: ${entry.analogy}`, resumeListeningAfterSpeak);
        return;
      }
    }

    setCaptionText(`"${clean}"`);
    handleSubmitQuery(clean);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleVoiceCommandOnResults, cancelSpeech, speak, playChime, resumeListeningAfterSpeak, stopSpectrum, startSpectrum]);

  // Handle interim live transcript
  const handleInterimSpeech = useCallback((interimText: string) => {
    // Prevent mic echo from assistant speech
    if (isSpeakingRef.current) return;

    const clean = sanitizeSpokenQuery(interimText);
    if (!clean) return;

    // Wake word immediate trigger on interim speech during greeting!
    if (phaseRef.current === "greeting") {
      if (isWakeWordOrGreetingOnly(clean)) {
        lastWakeWordHandledTimeRef.current = Date.now();
        cancelSpeech();
        stopListeningRef.current();
        stopSpectrum();
        setIsMicActive(false);
        playChime("success");
        setPhase("dashboard");
        setCaptionText("🎙️ Halo! Mau cek saham apa hari ini?");
        speak("Halo! Mau cek saham apa hari ini?", () => {
          setTimeout(() => {
            resetTranscriptRef.current();
            startListeningRef.current();
            startSpectrum();
            setIsMicActive(true);
          }, 200);
        });
        return;
      }
      return;
    }

    setCaptionText(`Mendengarkan: "${clean}"`);
  }, [cancelSpeech, playChime, speak, startSpectrum, stopSpectrum]);

  // Speech recognition hook
  const {
    isSupported: isSttSupported,
    isListening,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({
    lang: "id-ID",
    continuous: true,
    interimResults: true,
    autoRestart: false,
    confidenceThreshold: 0.60,
    onResult: handleFinalSpeech,
    onInterim: handleInterimSpeech,
  });

  // Keep STT ref proxies synced
  startListeningRef.current = startListening;
  stopListeningRef.current = stopListening;
  resetTranscriptRef.current = resetTranscript;

  // Effective mic state: only truly active when recording AND assistant is NOT speaking
  const isEffectiveMicActive = (isMicActive || isListening) && !isSpeaking;

  // Initial greeting audio playback
  const triggerGreeting = useCallback(() => {
    unlockAudio();
    playChime("start");
    stopListeningRef.current();
    stopSpectrum();
    setIsMicActive(false);
    hasGreetingSpokenRef.current = true;

    speak(GREETING_SPOKEN, () => {
      // Once assistant completes greeting speech, open mic in greeting phase to listen for wake word
      setTimeout(() => {
        if (phaseRef.current === "greeting") {
          resetTranscriptRef.current();
          startListeningRef.current();
          startSpectrum();
          setIsMicActive(true);
        }
      }, 200);
    });
  }, [playChime, speak, stopSpectrum, startSpectrum, unlockAudio]);

  useEffect(() => {
    // 1. Attempt autoplay greeting after a short delay (works if browser allows autoplay)
    const timer = setTimeout(() => {
      if (!hasGreetingSpokenRef.current) {
        triggerGreeting();
      }
    }, 400);

    // 2. Autoplay Policy Fallback for Blind Users:
    // If the browser blocks automatic audio before user interaction, the very first user gesture
    // (pressing ANY key, clicking, or tapping the screen anywhere) immediately unlocks audio & triggers greeting!
    const handleFirstGesture = () => {
      if (!hasGreetingSpokenRef.current) {
        unlockAudio();
        triggerGreeting();
      }
    };

    window.addEventListener("keydown", handleFirstGesture, { passive: true });
    window.addEventListener("pointerdown", handleFirstGesture, { passive: true });
    window.addEventListener("touchstart", handleFirstGesture, { passive: true });
    window.addEventListener("click", handleFirstGesture, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleFirstGesture);
      window.removeEventListener("pointerdown", handleFirstGesture);
      window.removeEventListener("touchstart", handleFirstGesture);
      window.removeEventListener("click", handleFirstGesture);
    };
  }, [triggerGreeting, unlockAudio]);

  // Activate microphone with immediate chime feedback
  const activateMicrophone = useCallback(() => {
    cancelSpeech();
    playChime("start");
    setIsMicActive(true);
    setCaptionText("🎙️ Mikrofon aktif! Silakan sebutkan saham atau pertanyaan Anda...");

    resetTranscriptRef.current();
    startListeningRef.current();
    startSpectrum();
  }, [cancelSpeech, playChime, startSpectrum]);

  // Deactivate microphone
  const deactivateMicrophone = useCallback(() => {
    cancelSpeech();
    playChime("stop");
    stopListeningRef.current();
    stopSpectrum(); // Release mic from spectrum analyser too
    setIsMicActive(false);
    setCaptionText("Mikrofon dinonaktifkan. Ucapkan 'Let's go WINI' atau klik tombol untuk membuka mic.");
  }, [cancelSpeech, playChime, stopSpectrum]);

  // Transition from greeting screen to active dashboard
  const handleActivateFromGreeting = useCallback(() => {
    setPhase("dashboard");
    activateMicrophone();
  }, [activateMicrophone]);

  const handleResetToDashboard = useCallback(() => {
    cancelSpeech();
    stopListening();
    stopSpectrum();
    setIsMicActive(false);
    setPhase("dashboard");
    setError(null);
    setResult(null);
    setTextInput("");
    setGlossaryEntry(null);
    setCaptionText("Pencet tombol apa saja 2x atau klik 2x untuk membuka mikrofon.");
  }, [cancelSpeech, stopListening, stopSpectrum]);

  // Global double-keypress (ANY key) and double-click listener
  useEffect(() => {
    const handleGlobalTrigger = () => {
      const currentP = phaseRef.current;
      if (currentP === "greeting") {
        handleActivateFromGreeting();
      } else if (currentP === "dashboard") {
        if (isMicActiveRef.current) {
          deactivateMicrophone();
        } else {
          activateMicrophone();
        }
      }
      // On 'results' or 'processing': NEVER auto-close or jump to mic on accidental double clicks
    };

    // 1. Any key pressed twice within 750ms (for greeting & dashboard)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing inside text input
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      // On results page: Escape key allows returning to dashboard deliberately
      if (phaseRef.current === "results") {
        if (e.key === "Escape") {
          e.preventDefault();
          handleResetToDashboard();
        }
        return;
      }

      // On processing: do not trigger anything
      if (phaseRef.current === "processing") {
        return;
      }

      const now = Date.now();
      const diff = now - lastKeyTimeRef.current;

      if (diff > 50 && diff < 800) {
        // Any key pressed twice!
        e.preventDefault();
        lastKeyTimeRef.current = 0;
        handleGlobalTrigger();
      } else {
        lastKeyTimeRef.current = now;
      }
    };

    // 2. Click or tap twice anywhere (for greeting & dashboard)
    const handlePointerUp = (e: MouseEvent | TouchEvent) => {
      // Protect results and processing pages from accidental dismissals
      if (phaseRef.current === "results" || phaseRef.current === "processing") {
        return;
      }

      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "BUTTON" ||
        target?.closest("button") ||
        target?.closest("form")
      ) {
        return;
      }

      const now = Date.now();
      const diff = now - lastPointerTimeRef.current;

      if (diff > 50 && diff < 500) {
        e.preventDefault();
        lastPointerTimeRef.current = 0;
        handleGlobalTrigger();
      } else {
        lastPointerTimeRef.current = now;
      }
    };

    const handleDblClick = (e: MouseEvent) => {
      // Protect results and processing pages from accidental dismissals
      if (phaseRef.current === "results" || phaseRef.current === "processing") {
        return;
      }

      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "BUTTON" ||
        target?.closest("button") ||
        target?.closest("form")
      ) {
        return;
      }
      e.preventDefault();
      handleGlobalTrigger();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchend", handlePointerUp);
    window.addEventListener("dblclick", handleDblClick);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchend", handlePointerUp);
      window.removeEventListener("dblclick", handleDblClick);
    };
  }, [handleActivateFromGreeting, activateMicrophone, deactivateMicrophone, handleResetToDashboard]);

  // Submit query for analysis
  const handleSubmitQuery = async (queryToAnalyze: string) => {
    const cleanQuery = sanitizeSpokenQuery(queryToAnalyze);
    if (!cleanQuery) return;

    cancelSpeech();
    stopListeningRef.current();
    stopSpectrum();
    setIsMicActive(false);

    lastKeyTimeRef.current = 0;
    lastPointerTimeRef.current = 0;

    setCurrentQuery(cleanQuery);
    setPhase("processing");
    setError(null);
    setCaptionText(`Sedang menganalisis: "${cleanQuery}"... Mohon tunggu sebentar.`);

    try {
      const analysisData = await analyzeStock(cleanQuery);

      // --- EARCON: play status-specific melody before reading summary ---
      const earconStatus = analysisData.healthScore?.category ?? "SEHAT";
      playChime("success");
      setTimeout(() => playStatusEarcon(earconStatus), 400);

      setResult(analysisData);
      lastKeyTimeRef.current = 0;
      lastPointerTimeRef.current = 0;
      setPhase("results");

      // Announce result narrative with natural speech (after earcon finishes ~700ms)
      if (analysisData.summary) {
        setTimeout(() => {
          speak(analysisData.summary, () => {
            // Auto-start mic in command-listening mode only after speech is complete
            if (phaseRef.current === "results") {
              resetTranscriptRef.current();
              startListeningRef.current();
              startSpectrum();
              setIsMicActive(true);
              setCaptionText("🎙️ Mikrofon aktif! Katakan 'ulangi', 'tren', 'portofolio', atau sebutkan pertanyaan lain...");
            }
          });
        }, 700);
      } else {
        resetTranscriptRef.current();
        startListeningRef.current();
        startSpectrum();
        setIsMicActive(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Terjadi kendala saat menganalisis emiten.";
      setError(msg);
      setPhase("dashboard");
      setCaptionText(`Maaf, terjadi kesalahan: ${msg}`);
      speak("Maaf, terjadi kendala saat memproses analisis. Silakan coba kembali.");
    }
  };

  const handleReturnToGreeting = () => {
    cancelSpeech();
    stopListeningRef.current();
    stopSpectrum();
    setIsMicActive(false);
    setPhase("greeting");
    setError(null);
    setResult(null);
    setTextInput("");
    triggerGreeting();
  };

  return (
    <div className="bg-brand-bg text-slate-100 min-h-screen flex flex-col font-sans antialiased selection:bg-cyan-500 selection:text-black overflow-x-hidden select-none">
      {/* ============================================================
          PHASE 1: GREETING SCREEN (WELCOME BANNER)
          ============================================================ */}
      {phase === "greeting" && (
        <WelcomeBanner
          onActivate={handleActivateFromGreeting}
          onReplayAudio={triggerGreeting}
          isSpeaking={isSpeaking}
          isListeningWakeWord={isEffectiveMicActive && phase === "greeting"}
        />
      )}

      {/* ============================================================
          TOP ACCESSIBILITY HEADER (ACTIVE IN DASHBOARD / RESULTS)
          ============================================================ */}
      {phase !== "greeting" && (
        <header
          className="w-full border-b border-brand-border/80 bg-brand-bg/95 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-50"
          role="banner"
        >
          {/* Left Logo Section */}
          <div className="flex items-center space-x-3.5 cursor-pointer" onClick={handleReturnToGreeting}>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-white/20">
              <span aria-hidden="true" className="text-slate-950 font-black text-xl tracking-tight">
                W
              </span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-extrabold tracking-wide text-white uppercase">WINI AI</h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-700/50">
                  Aksesibel Inklusif
                </span>
                {isMockMode && (
                  <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-700/50">
                    ⚡ Mock Data
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium tracking-wide">
                Analis Investasi Saham Cerdas &amp; Ramah Tunanetra
              </p>
            </div>
          </div>

          {/* Right Accessibility Utilities Bar */}
          <nav aria-label="Alat Aksesibilitas Cepat" className="flex items-center space-x-2 sm:space-x-3">
            {/* Interactive Data Source Switch Button (Mock vs Real API) */}
            <button
              type="button"
              role="switch"
              aria-checked={isMockMode}
              onClick={handleToggleMockMode}
              aria-label={`Alihkan sumber data: saat ini ${
                isMockMode ? "Mode Mock Data aktif, kuota API 100% hemat" : "Mode API Nyata aktif"
              }. Tekan tombol ini untuk beralih.`}
              title={isMockMode ? "Klik untuk beralih ke Mode API Nyata" : "Klik untuk beralih ke Mode Mock Data (Hemat Kuota)"}
              className={`focus-accessible px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm ${
                isMockMode
                  ? "bg-amber-950/80 border-amber-500/70 text-amber-300 hover:bg-amber-900/90"
                  : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <span
                aria-hidden="true"
                className={`w-2 h-2 rounded-full ${
                  isMockMode ? "bg-amber-400 animate-pulse" : "bg-cyan-400"
                }`}
              />
              <span className="font-mono text-[11px]">
                {isMockMode ? "⚡ Mock (0 Quota)" : "🌐 API Nyata"}
              </span>
            </button>

            {/* Activation Helper Badge */}
            <span
              className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                isEffectiveMicActive
                  ? "bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/20"
                  : "bg-slate-900 border-slate-700 text-slate-300"
              }`}
            >
              <span
                aria-hidden="true"
                className={`w-2 h-2 rounded-full mr-2 ${
                  isEffectiveMicActive ? "bg-emerald-400 animate-ping" : "bg-cyan-400 animate-pulse"
                }`}
              ></span>
              {isEffectiveMicActive ? "Mikrofon Aktif!" : "Tekan Keyboard 2x / Klik 2x: Buka Mic"}
            </span>

            {/* Re-play Greeting Audio Button */}
            <button
              onClick={handleReturnToGreeting}
              aria-label="Kembali ke layar sambutan awal"
              className="focus-accessible px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900 text-cyan-300 border border-slate-700 hover:bg-slate-800 transition flex items-center gap-1.5"
              type="button"
            >
              <span aria-hidden="true">🏠</span>
              <span className="hidden sm:inline">Layar</span> Sambutan
            </button>

            {/* TTS Speed Control */}
            <div
              className="hidden sm:flex items-center gap-0.5 bg-slate-900 border border-slate-700 rounded-lg overflow-hidden"
              role="group"
              aria-label="Kecepatan suara asisten"
            >
              {([1, 1.25, 1.5, 2] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setTtsRate(r)}
                  aria-label={`Kecepatan suara ${r}x`}
                  aria-pressed={ttsRate === r}
                  className={`px-2 py-1 text-[11px] font-bold transition ${
                    ttsRate === r
                      ? "bg-cyan-600 text-white"
                      : "text-slate-400 hover:text-cyan-300 hover:bg-slate-800"
                  }`}
                  type="button"
                >
                  {r}×
                </button>
              ))}
            </div>

            {/* Audio Output State Toggle */}
            <button
              onClick={toggleMute}
              aria-label={`Status Audio dan Pembacaan Suara: ${isMuted ? "Bisu" : "Aktif"}`}
              className={`focus-accessible px-2.5 py-1 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 ${
                isMuted
                  ? "bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800"
                  : "bg-cyan-950/70 text-cyan-300 border-cyan-800/80 hover:bg-cyan-900/60"
              }`}
              type="button"
            >
              <span aria-hidden="true">{isMuted ? "🔇" : "🔊"}</span>
              <span className="hidden sm:inline">Suara:</span> {isMuted ? "Bisu" : "Aktif"}
            </button>
          </nav>
        </header>
      )}

      {/* ============================================================
          PHASE 2: ACTIVE DASHBOARD VIEW
          ============================================================ */}
      {phase === "dashboard" && (
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 md:py-10 flex flex-col items-center justify-between gap-8 animate-fade-in">
          {/* Hero Title Header */}
          <div className="text-center space-y-3 pt-2">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
              Apa yang ingin Anda analisis hari ini?
            </h2>
            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto font-normal">
              Pencet tombol keyboard <strong className="text-cyan-400 font-semibold">2 kali apa saja</strong> atau klik 2 kali di mana saja untuk mengaktifkan mikrofon.
            </p>
          </div>

          {/* Error Banner if any */}
          {error && (
            <div
              role="alert"
              className="w-full max-w-2xl bg-danger/10 border border-danger/40 text-danger rounded-xl p-4 text-center text-sm font-medium flex items-center justify-between gap-3"
            >
              <span>⚠️ {error}</span>
              <button
                onClick={() => setError(null)}
                className="text-xs underline hover:text-white"
                type="button"
              >
                Tutup
              </button>
            </div>
          )}

          {/* DUAL SENSORY MIC INTERACTION SECTION */}
          <section aria-labelledby="voice-control-heading" className="w-full flex flex-col items-center justify-center my-1">
            <h3 className="sr-only" id="voice-control-heading">
              Kendali Suara Mikrofon Inklusif
            </h3>

            {/* Giant Interactive Glowing Mic Button */}
            <div className="relative flex items-center justify-center my-3">

              {/* Outer ambient glow — only shown when mic active */}
              {isEffectiveMicActive && (
                <>
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-emerald-500/30 blur-2xl scale-150 pointer-events-none animate-pulse"
                  />
                  {/* Ripple ring 1 */}
                  <span
                    aria-hidden="true"
                    className="absolute rounded-full border-2 border-emerald-400/70 pointer-events-none animate-ping"
                    style={{ inset: "-12px" }}
                  />
                  {/* Ripple ring 2 — slower */}
                  <span
                    aria-hidden="true"
                    className="absolute rounded-full border border-emerald-300/40 pointer-events-none animate-ping"
                    style={{ inset: "-24px", animationDuration: "1.4s" }}
                  />
                </>
              )}

              {/* Idle glow ring */}
              {!isEffectiveMicActive && (
                <div
                  aria-hidden="true"
                  className="absolute -inset-4 rounded-full border border-cyan-500/30 mic-glow-ring pointer-events-none"
                />
              )}

              {/* Main Button */}
              <button
                id="voice-mic-trigger"
                onClick={() => {
                  if (isEffectiveMicActive) {
                    deactivateMicrophone();
                  } else {
                    activateMicrophone();
                  }
                }}
                aria-label={
                  isEffectiveMicActive
                    ? "Mikrofon Aktif: Sedang mendengarkan suara Anda. Tekan untuk berhenti."
                    : "Mikrofon Siaga: Ucapkan Let's go WINI, pencet keyboard 2x, atau klik untuk mulai berbicara."
                }
                aria-pressed={isEffectiveMicActive}
                className={`focus-accessible relative z-10 w-28 h-28 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center shadow-2xl hover:brightness-110 active:scale-95 transition-all duration-300 ring-4 ${
                  isEffectiveMicActive
                    ? "bg-gradient-to-b from-emerald-300 to-emerald-600 text-slate-950 ring-emerald-300 shadow-[0_0_40px_8px_rgba(52,211,153,0.6)]"
                    : "bg-gradient-to-b from-cyan-500 to-cyan-700 text-slate-950 ring-cyan-300/40 shadow-cyan-500/30"
                }`}
                type="button"
              >
                <svg aria-hidden="true" className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"></path>
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"></path>
                </svg>
                {/* "● REC AKTIF" badge inside button — only visible when mic is on */}
                {isEffectiveMicActive && (
                  <span className="mt-1 flex items-center gap-1 text-[10px] font-extrabold tracking-widest text-slate-900 uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping inline-block" />
                    REC
                  </span>
                )}
              </button>
            </div>


            {/* Action Indicator Text */}
            <div className="text-center mt-3 space-y-1.5">
              <p
                className={`font-bold text-lg sm:text-xl flex items-center justify-center gap-2 ${
                  isEffectiveMicActive ? "text-emerald-400" : isSpeaking ? "text-amber-300" : "text-cyan-400"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block w-2.5 h-2.5 rounded-full ${
                    isEffectiveMicActive
                      ? "bg-emerald-400 animate-ping"
                      : isSpeaking
                      ? "bg-amber-400 animate-pulse"
                      : "bg-cyan-400 animate-ping"
                  }`}
                ></span>
                <span>
                  {isEffectiveMicActive
                    ? "Mikrofon Aktif: Sedang Mendengarkan Suara Anda..."
                    : isSpeaking
                    ? "Asisten Sedang Berbicara..."
                    : "Ucapkan \"Let's go WINI\" / Tekan Tombol / Klik Layar"}
                </span>
              </p>
              <p className="text-xs sm:text-sm text-slate-400 font-medium">
                Ucapkan <span className="text-emerald-400 font-bold">&quot;Let&apos;s go WINI&quot;</span> atau tekan tombol mikrofon untuk berbicara
              </p>
            </div>

            {/* CENTER LIVE CAPTIONS CARD */}
            <div
              className={`w-full max-w-2xl mt-6 rounded-2xl bg-brand-card border-2 p-5 sm:p-6 shadow-2xl transition-all relative overflow-hidden ${
                isEffectiveMicActive
                  ? "border-emerald-500/80 shadow-emerald-950/60 ring-2 ring-emerald-500/30"
                  : "border-cyan-600/60 shadow-cyan-950/60"
              }`}
              data-purpose="live-captions-display"
            >
              {/* Top Status Header */}
              <div className="flex items-center justify-between border-b border-brand-border pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        isEffectiveMicActive ? "bg-emerald-400" : "bg-cyan-400"
                      }`}
                    ></span>
                    <span
                      className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                        isEffectiveMicActive ? "bg-emerald-500" : "bg-cyan-500"
                      }`}
                    ></span>
                  </span>
                  <span className={`text-xs uppercase tracking-wider font-extrabold ${
                    isEffectiveMicActive ? "text-emerald-300" : "text-cyan-300"
                  }`}>
                    {isEffectiveMicActive ? "● MIKROFON MENDENGARKAN (LIVE)" : "PANDUAN SUARA & TAKARIR WAKTU-NYATA (LIVE CAPTIONS)"}
                  </span>
                </div>
                <span className="text-[11px] font-semibold bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                  Bahasa Indonesia
                </span>
              </div>

              {/* Spoken Words / Live Subtitles */}
              <div aria-atomic="true" aria-live="polite" className="min-h-[72px] flex items-center justify-center text-center px-2">
                <p className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-100 leading-relaxed">
                  {captionText}
                </p>
              </div>

              {/* Audio Waveform Live Spectrum Animation */}
              <div className="mt-5 pt-3 border-t border-brand-border/60 flex flex-col items-center gap-2">
                <div
                  aria-hidden="true"
                  className="flex items-center justify-center gap-1.5 h-10 w-full max-w-xs"
                  title="Spektrum Suara Masukan"
                >
                {/* Real-time amplitude bars driven by useAudioSpectrum */}
                {barHeights.map((h, i) => {
                  // When mic is active: use real amplitude (min 4px to stay visible)
                  // When idle / TTS speaking: gentle pulse CSS fallback
                  const MIN_PX = 4;
                  const MAX_PX = 40; // h-10 container = 40px
                  const heightPx = isEffectiveMicActive
                    ? Math.max(MIN_PX, Math.round(h * MAX_PX))
                    : MAX_PX * 0.15; // ~6px idle

                  return (
                    <span
                      key={i}
                      aria-hidden="true"
                      className={`w-1.5 rounded-full transition-all duration-75 ${
                        isEffectiveMicActive
                          ? h > 0.5
                            ? "bg-emerald-300"
                            : h > 0.2
                            ? "bg-emerald-400"
                            : "bg-emerald-600"
                          : isSpeaking
                          ? "bg-amber-400 animate-pulse"
                          : "bg-cyan-800"
                      }`}
                      style={{ height: `${heightPx}px` }}
                    />
                  );
                })}
                </div>

                {/* Dual Sensory Feature Pills */}
                <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] sm:text-xs text-slate-400 font-medium mt-1">
                  <span className="flex items-center gap-1 text-cyan-300">
                    <span aria-hidden="true">🔊</span> Suara Sintesis Aktif (Tunanetra)
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="flex items-center gap-1 text-emerald-300">
                    <span aria-hidden="true">📝</span> Teks Tertulis Lengkap (Tunarungu)
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ALTERNATIVE TEXT INPUT SECTION */}
          {/* Glossary Card — shown when user asks "apa itu DER?" etc. */}
          {glossaryEntry && (
            <div className="w-full max-w-2xl">
              <GlossaryCard
                entry={glossaryEntry}
                onSpeak={speak}
                onDismiss={() => setGlossaryEntry(null)}
              />
            </div>
          )}

          {/* ALTERNATIVE TEXT INPUT SECTION */}
          <section aria-labelledby="text-input-heading" className="w-full max-w-2xl flex flex-col items-center">
            <div aria-hidden="true" className="w-full flex items-center justify-center space-x-3 my-2">
              <div className="h-px bg-slate-800 flex-1"></div>
              <span className="text-xs font-bold tracking-widest text-slate-400 uppercase" id="text-input-heading">
                Atau Ketik Pertanyaan Anda
              </span>
              <div className="h-px bg-slate-800 flex-1"></div>
            </div>

            {/* Text Query Bar Form */}
            <form
              className="w-full mt-3 flex items-stretch gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmitQuery(textInput);
              }}
              role="search"
            >
              <div className="relative flex-1">
                <label className="sr-only" htmlFor="stock-query-input">
                  Ketik pertanyaan atau kode saham
                </label>
                <input
                  ref={textInputRef}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  className="focus-accessible w-full h-14 pl-4 pr-12 rounded-xl bg-brand-card/90 border-2 border-slate-700 text-slate-100 placeholder-slate-400 text-sm sm:text-base focus:border-cyan-400 focus:bg-slate-900/90 transition shadow-inner"
                  id="stock-query-input"
                  name="query"
                  placeholder="Ketik kode saham atau pertanyaan Anda di sini... (contoh: Analisis top 5 saham sehat BEI)"
                  type="text"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none hidden sm:inline-block text-xs font-mono border border-slate-700 px-1.5 py-0.5 rounded">
                  Enter ↵
                </span>
              </div>

              <button
                aria-label="Kirim pertanyaan saham"
                className="focus-accessible h-14 px-6 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-slate-950 font-bold transition flex items-center justify-center shadow-lg shadow-cyan-600/30 flex-shrink-0"
                type="submit"
              >
                <svg
                  aria-hidden="true"
                  className="w-5 h-5 sm:mr-1.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                </svg>
                <span className="hidden sm:inline">Kirim</span>
              </button>
            </form>

            {/* Quick Accessibility Suggestion Chips */}
            <div aria-label="Pertanyaan Cepat Rekomendasi" className="w-full mt-3.5 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-slate-400 font-medium mr-1">Rekomendasi Cepat:</span>
              {QUICK_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setTextInput(prompt.query);
                    handleSubmitQuery(prompt.query);
                  }}
                  className="focus-accessible px-3 py-1.5 rounded-full bg-slate-900 border border-slate-700 hover:border-cyan-500/70 text-xs text-slate-300 hover:text-cyan-300 transition"
                  type="button"
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          </section>
        </main>
      )}

      {/* ============================================================
          PHASE 3: PROCESSING VIEW
          ============================================================ */}
      {phase === "processing" && (
        <main className="flex-1 max-w-4xl mx-auto w-full px-4 flex flex-col items-center justify-center py-16 animate-fade-in text-center">
          <div className="relative w-24 h-24 mb-8">
            <div className="absolute inset-0 border-4 border-cyan-900/40 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-4 bg-cyan-500/20 rounded-full animate-pulse"></div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Menganalisis Data Emiten...
          </h2>
          <p className="text-cyan-300 text-lg max-w-md font-medium">
            "{currentQuery}"
          </p>
          <p className="text-slate-400 text-xs mt-4">
            Mengambil data fundamental kuartalan Sectors API (DER, ROE, ROA, DAR) &amp; sintesis naratif...
          </p>
        </main>
      )}

      {/* ============================================================
          PHASE 4: RESULTS VIEW
          ============================================================ */}
      {phase === "results" && result && (
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 animate-fade-in space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-brand-border">
            <button
              onClick={handleResetToDashboard}
              className="focus-accessible inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300 hover:bg-slate-800 text-sm font-semibold transition"
              type="button"
            >
              ← Kembali ke Dasbor Suara
            </button>

            <button
              onClick={handleReturnToGreeting}
              className="focus-accessible inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-white text-xs transition"
              type="button"
            >
              🏠 Layar Sambutan Awal
            </button>
          </div>

          {/* ── Voice Command Hint Card (results page) ── */}
          <div
            role="region"
            aria-label="Perintah suara tersedia"
            className="w-full bg-slate-900/80 border border-emerald-800/60 rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4"
          >
            {/* Live mic indicator */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <span className="text-emerald-300 text-xs font-bold uppercase tracking-widest whitespace-nowrap">
                🎙️ Mic Aktif — Perintah Suara
              </span>
            </div>
            {/* Command chips */}
            <div className="flex flex-wrap gap-2 text-[11px]">
              {[
                { cmd: "Ulangi", desc: "Bacakan ulang ringkasan" },
                { cmd: "Berapa utangnya?", desc: "Bacakan skor utang" },
                { cmd: "Rebalancing", desc: "Saran alokasi portofolio" },
                { cmd: "Tren kuartal", desc: "Ringkasan tren historis" },
                { cmd: "Kembali", desc: "Ke dasbor suara" },
              ].map(({ cmd, desc }) => (
                <span
                  key={cmd}
                  className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1"
                  title={desc}
                >
                  <span className="text-cyan-300 font-semibold">"{cmd}"</span>
                  <span className="text-slate-500">— {desc}</span>
                </span>
              ))}
            </div>
          </div>

          <ResultWorkspace
            result={result}
            onNewQuery={handleResetToDashboard}
            onSpeak={speak}
          />
        </main>
      )}

      {/* ============================================================
          BOTTOM ACCESSIBILITY STATUS BAR
          ============================================================ */}
      {phase !== "greeting" && (
        <footer
          className="w-full border-t border-brand-border bg-slate-950/90 backdrop-blur-md px-4 sm:px-8 py-3 mt-auto"
          role="contentinfo"
        >
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            {/* Live Sensor Status */}
            <div className="flex items-center space-x-2 text-slate-300 font-medium">
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isEffectiveMicActive ? "bg-emerald-400" : "bg-cyan-400"
                  }`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isEffectiveMicActive ? "bg-emerald-500" : "bg-cyan-500"
                  }`}
                ></span>
              </span>
              <span>
                {isEffectiveMicActive
                  ? "Mikrofon Aktif: Sedang Mendengarkan Suara Anda..."
                  : isSpeaking
                  ? "Audio Sintesis: Sedang Membacakan Teks..."
                  : "Akses Tunanetra: Ucapkan \"Let's go WINI\" / Tekan Tombol"}
              </span>
            </div>

            {/* Compliance Statement */}
            <div className="flex items-center space-x-2 text-slate-400 text-center">
              <span aria-hidden="true" className="text-cyan-400 font-semibold">♿</span>
              <span>Aksesibilitas 100% WCAG 2.2 AAA (Ramah Tunanetra &amp; Tunarungu)</span>
            </div>

            {/* Keyboard Nav Shortcut Legends */}
            <div className="flex items-center space-x-3 text-[11px] text-slate-400">
              <span>
                <kbd className="bg-slate-800 text-cyan-300 px-1.5 py-0.5 rounded border border-slate-700 font-mono">
                  Keyboard 2x
                </kbd>{" "}
                Buka Mic
              </span>
              <span>
                <kbd className="bg-slate-800 text-cyan-300 px-1.5 py-0.5 rounded border border-slate-700 font-mono">
                  Klik 2x
                </kbd>{" "}
                Buka Mic
              </span>
              <span>
                <kbd className="bg-slate-800 text-cyan-300 px-1.5 py-0.5 rounded border border-slate-700 font-mono">
                  Tab
                </kbd>{" "}
                Pindah
              </span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
