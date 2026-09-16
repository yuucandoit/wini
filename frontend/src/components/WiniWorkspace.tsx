'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { AnalysisResult } from "@/lib/types";
import { analyzeStock } from "@/lib/api";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useAudioSpectrum } from "@/hooks/useAudioSpectrum";

import WelcomeBanner from "@/components/WelcomeBanner";
import ResultWorkspace from "@/components/ResultWorkspace";

const GREETING_SPOKEN =
  "Selamat datang di WINI AI. Untuk mengaktifkan mikrofon, silakan pencet keyboard dua kali tombol apa saja, atau klik di mana saja dua kali.";

const MIC_ACTIVE_ANNOUNCEMENT =
  "Mikrofon sudah aktif. Silakan sebutkan saham atau pertanyaan Anda.";

const QUICK_PROMPTS = [
  { label: "📊 Bandingkan TLKM vs ISAT", query: "Bandingkan fundamental saham TLKM dan ISAT" },
  { label: "💰 Top 5 Saham Sehat", query: "Tampilkan top 5 saham paling sehat di BEI" },
  { label: "📈 Cek Valuasi ASII", query: "Cek valuasi dan kesehatan saham ASII" },
  { label: "🔍 Saham Murah PER < 10", query: "Cari saham murah dengan PER di bawah 10" },
];

export default function WiniWorkspace() {
  const [phase, setPhase] = useState<"greeting" | "dashboard" | "processing" | "results">("greeting");
  const [currentQuery, setCurrentQuery] = useState<string>("");
  const [textInput, setTextInput] = useState<string>("");
  const [captionText, setCaptionText] = useState<string>(
    "“Selamat datang di WINI AI. Pencet keyboard 2x (tombol apa saja) atau klik 2x di mana saja untuk mengaktifkan mikrofon.”"
  );
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMicActive, setIsMicActive] = useState<boolean>(false);

  const textInputRef = useRef<HTMLInputElement>(null);
  const lastKeyTimeRef = useRef<number>(0);
  const lastPointerTimeRef = useRef<number>(0);
  const isMicActiveRef = useRef<boolean>(false);
  const phaseRef = useRef<string>("greeting");

  isMicActiveRef.current = isMicActive;
  phaseRef.current = phase;

  // Speech synthesis hook with natural Indonesian voice
  const {
    isSupported: isTtsSupported,
    isSpeaking,
    isMuted,
    toggleMute,
    speak,
    cancel: cancelSpeech,
    playChime,
  } = useSpeechSynthesis({
    lang: "id-ID",
    rate: 0.98,
    pitch: 1.02,
  });

  // Handle final recognized speech
  const handleFinalSpeech = useCallback((spokenText: string) => {
    const clean = spokenText.trim();
    if (!clean) return;

    // Filter out assistant's own activation announcement if captured
    if (clean.toLowerCase().includes("mikrofon sudah aktif")) {
      return;
    }

    setCaptionText(`"${clean}"`);
    handleSubmitQuery(clean);
  }, []);

  // Handle interim live transcript
  const handleInterimSpeech = useCallback((interimText: string) => {
    const clean = interimText.trim();
    if (!clean) return;
    setCaptionText(`Mendengarkan: "${clean}"`);
  }, []);

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

  // Real-time microphone spectrum analyser (8 bars)
  const { barHeights, startSpectrum, stopSpectrum } = useAudioSpectrum({ bars: 8 });

  // Initial greeting audio playback
  const triggerGreeting = useCallback(() => {
    playChime("start");
    speak(GREETING_SPOKEN);
  }, [playChime, speak]);

  useEffect(() => {
    // Speak greeting audio when landing on greeting screen
    const timer = setTimeout(() => {
      triggerGreeting();
    }, 600);

    return () => clearTimeout(timer);
  }, [triggerGreeting]);

  // Activate microphone with voice confirmation
  const activateMicrophone = useCallback(() => {
    cancelSpeech();
    playChime("start");
    setIsMicActive(true);
    setCaptionText("🎙️ Mikrofon sudah aktif! Silakan sebutkan saham atau pertanyaan Anda...");

    // Voice announcement: "Mikrofon sudah aktif. Silakan sebutkan saham atau pertanyaan Anda."
    speak(MIC_ACTIVE_ANNOUNCEMENT);

    resetTranscript();
    setTimeout(() => {
      startListening();
      startSpectrum(); // Start real-time spectrum capture
    }, 1200);
  }, [cancelSpeech, playChime, resetTranscript, speak, startListening, startSpectrum]);

  // Deactivate microphone
  const deactivateMicrophone = useCallback(() => {
    cancelSpeech();
    playChime("stop");
    stopListening();
    stopSpectrum(); // Release mic from spectrum analyser too
    setIsMicActive(false);
    setCaptionText("Mikrofon dinonaktifkan. Pencet tombol apa saja 2x atau klik 2x untuk membuka mic.");
  }, [cancelSpeech, playChime, stopListening, stopSpectrum]);

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
    const cleanQuery = queryToAnalyze.trim();
    if (!cleanQuery) return;

    cancelSpeech();
    stopListening();
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
      playChime("success");
      setResult(analysisData);
      lastKeyTimeRef.current = 0;
      lastPointerTimeRef.current = 0;
      setPhase("results");

      // Announce result narrative with natural speech
      if (analysisData.summary) {
        speak(analysisData.summary);
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
    stopListening();
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
              </div>
              <p className="text-xs text-slate-400 font-medium tracking-wide">
                Analis Investasi Saham Cerdas &amp; Ramah Tunanetra
              </p>
            </div>
          </div>

          {/* Right Accessibility Utilities Bar */}
          <nav aria-label="Alat Aksesibilitas Cepat" className="flex items-center space-x-2 sm:space-x-3">
            {/* Activation Helper Badge */}
            <span
              className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                isMicActive
                  ? "bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/20"
                  : "bg-slate-900 border-slate-700 text-slate-300"
              }`}
            >
              <span
                aria-hidden="true"
                className={`w-2 h-2 rounded-full mr-2 ${
                  isMicActive ? "bg-emerald-400 animate-ping" : "bg-cyan-400 animate-pulse"
                }`}
              ></span>
              {isMicActive ? "Mikrofon Aktif!" : "Tekan Keyboard 2x / Klik 2x: Buka Mic"}
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
              {/* Visual Ping Ripple Rings */}
              <div
                aria-hidden="true"
                className={`absolute inset-0 rounded-full bg-cyan-500/20 blur-xl scale-125 pointer-events-none ${
                  isMicActive || isListening ? "animate-pulse" : "animate-pulse-slow"
                }`}
              ></div>

              <div
                aria-hidden="true"
                className={`absolute -inset-4 rounded-full border-2 mic-glow-ring pointer-events-none ${
                  isMicActive
                    ? "border-emerald-400/80 shadow-emerald-500/40"
                    : "border-cyan-500/30"
                }`}
              ></div>

              {/* Main Button */}
              <button
                id="voice-mic-trigger"
                onClick={() => {
                  if (isMicActive) {
                    deactivateMicrophone();
                  } else {
                    activateMicrophone();
                  }
                }}
                aria-label={
                  isMicActive
                    ? "Mikrofon Aktif: Sedang mendengarkan suara Anda. Tekan untuk berhenti."
                    : "Mikrofon Siaga: Pencet keyboard 2x atau klik 2x untuk mulai berbicara."
                }
                aria-pressed={isMicActive}
                className={`focus-accessible relative z-10 w-28 h-28 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center shadow-2xl hover:brightness-110 active:scale-95 transition-all duration-200 ring-4 ${
                  isMicActive
                    ? "bg-gradient-to-b from-emerald-400 to-emerald-600 text-slate-950 ring-emerald-300/80 shadow-emerald-500/50 animate-pulse"
                    : "bg-gradient-to-b from-cyan-500 to-cyan-700 text-slate-950 ring-cyan-300/40 shadow-cyan-500/50"
                }`}
                type="button"
              >
                <svg aria-hidden="true" className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"></path>
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"></path>
                </svg>
              </button>
            </div>

            {/* Action Indicator Text */}
            <div className="text-center mt-3 space-y-1.5">
              <p
                className={`font-bold text-lg sm:text-xl flex items-center justify-center gap-2 ${
                  isMicActive ? "text-emerald-400" : isSpeaking ? "text-amber-300" : "text-cyan-400"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block w-2.5 h-2.5 rounded-full ${
                    isMicActive
                      ? "bg-emerald-400 animate-ping"
                      : isSpeaking
                      ? "bg-amber-400 animate-pulse"
                      : "bg-cyan-400 animate-ping"
                  }`}
                ></span>
                <span>
                  {isMicActive
                    ? "Mikrofon Aktif: Sedang Mendengarkan Suara Anda..."
                    : isSpeaking
                    ? "Asisten Sedang Berbicara..."
                    : "Pencet Keyboard 2x / Klik 2x di Mana Saja"}
                </span>
              </p>
              <p className="text-xs sm:text-sm text-slate-400 font-medium">
                Pencet tombol keyboard <span className="text-cyan-300 font-bold">2 kali</span> (apa saja) atau klik layar 2 kali
              </p>
            </div>

            {/* CENTER LIVE CAPTIONS CARD */}
            <div
              className={`w-full max-w-2xl mt-6 rounded-2xl bg-brand-card border-2 p-5 sm:p-6 shadow-2xl transition-all relative overflow-hidden ${
                isMicActive
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
                        isMicActive ? "bg-emerald-400" : "bg-cyan-400"
                      }`}
                    ></span>
                    <span
                      className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                        isMicActive ? "bg-emerald-500" : "bg-cyan-500"
                      }`}
                    ></span>
                  </span>
                  <span className="text-xs uppercase tracking-wider font-extrabold text-cyan-300">
                    PANDUAN SUARA &amp; TAKARIR WAKTU-NYATA (LIVE CAPTIONS)
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
                  const heightPx = isMicActive
                    ? Math.max(MIN_PX, Math.round(h * MAX_PX))
                    : MAX_PX * 0.15; // ~6px idle

                  return (
                    <span
                      key={i}
                      aria-hidden="true"
                      className={`w-1.5 rounded-full transition-all duration-75 ${
                        isMicActive
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

          <ResultWorkspace result={result} onNewQuery={handleResetToDashboard} />
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
                    isMicActive ? "bg-emerald-400" : "bg-cyan-400"
                  }`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isMicActive ? "bg-emerald-500" : "bg-cyan-500"
                  }`}
                ></span>
              </span>
              <span>
                {isMicActive
                  ? "Mikrofon Aktif: Sedang Mendengarkan Suara Anda..."
                  : isSpeaking
                  ? "Audio Sintesis: Sedang Membacakan Teks..."
                  : "Akses Tunanetra: Pencet Keyboard 2x (Apa Saja) atau Klik 2x"}
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
