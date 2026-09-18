'use client';

import React, { useEffect, useRef, useState } from 'react';

interface WelcomeBannerProps {
  onActivate: () => void;
  onReplayAudio?: () => void;
  isSpeaking?: boolean;
  isListeningWakeWord?: boolean;
}

export default function WelcomeBanner({
  onActivate,
  onReplayAudio,
  isSpeaking = false,
  isListeningWakeWord = false,
}: WelcomeBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastKeyTimeRef = useRef<number>(0);
  const lastPointerTimeRef = useRef<number>(0);
  const [keyPressCount, setKeyPressCount] = useState<number>(0);

  // Listen for ANY key pressed twice, or double-click anywhere
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow Space or Enter on the focused activate button directly
      if (e.key === "Enter" || e.key === " ") {
        return;
      }

      // If assistant is not speaking, any keypress triggers spoken guidance immediately
      if (!isSpeaking && onReplayAudio) {
        onReplayAudio();
      }

      const now = Date.now();
      const diff = now - lastKeyTimeRef.current;

      if (diff > 50 && diff < 800) {
        // Any key pressed twice in quick succession activates directly!
        e.preventDefault();
        lastKeyTimeRef.current = 0;
        setKeyPressCount(2);
        onActivate();
      } else {
        lastKeyTimeRef.current = now;
        setKeyPressCount(1);
        setTimeout(() => {
          if (Date.now() - lastKeyTimeRef.current >= 750) {
            setKeyPressCount(0);
          }
        }, 800);
      }
    };

    const handlePointerUp = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "BUTTON" && !target.classList.contains("main-card")) {
        return;
      }

      // If assistant is not speaking, any screen tap triggers spoken guidance immediately
      if (!isSpeaking && onReplayAudio) {
        onReplayAudio();
      }

      const now = Date.now();
      const diff = now - lastPointerTimeRef.current;

      if (diff > 50 && diff < 500) {
        e.preventDefault();
        lastPointerTimeRef.current = 0;
        onActivate();
      } else {
        lastPointerTimeRef.current = now;
      }
    };

    const handleDblClick = (e: MouseEvent) => {
      e.preventDefault();
      onActivate();
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
  }, [onActivate, onReplayAudio, isSpeaking]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Layar Sambutan WINI AI"
      tabIndex={0}
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-brand-bg text-slate-100 p-6 md:p-12 animate-fade-in select-none focus:outline-none overflow-y-auto"
    >
      {/* Screen Reader Immediate Live Announcement for Blind Users */}
      <div role="status" aria-live="assertive" aria-atomic="true" className="sr-only">
        Selamat datang di WINI AI, asisten investasi saham inklusif. Tekan Spasi, Enter, atau sentuh layar di mana saja untuk mengaktifkan panduan audio dan mikrofon.
      </div>
      {/* Top Brand Bar */}
      <div className="w-full max-w-4xl flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-cyan-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-white/20">
            <span aria-hidden="true" className="text-slate-950 font-black text-2xl tracking-tight">
              W
            </span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-wide text-white uppercase">WINI AI</h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-700/50">
                Aksesibel Inklusif
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">
              Analis Investasi Saham Cerdas &amp; Ramah Tunanetra
            </p>
          </div>
        </div>

        {onReplayAudio && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReplayAudio();
            }}
            aria-label="Putar ulang panduan suara"
            className="focus-accessible px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
            type="button"
          >
            <span aria-hidden="true">🔁</span>
            <span>Ulang Suara</span>
          </button>
        )}
      </div>

      {/* Center Hero Card */}
      <div className="flex flex-col items-center justify-center text-center max-w-3xl my-auto py-8 gap-8">
        {/* Visual Glowing Mic Icon */}
        <div className="relative flex items-center justify-center">
          {/* Emerald glow if wake word listening, cyan otherwise */}
          <div
            aria-hidden="true"
            className={`absolute inset-0 rounded-full blur-2xl scale-150 transition-all duration-700 pointer-events-none ${
              isListeningWakeWord ? "bg-emerald-500/40 animate-pulse" : "bg-cyan-500/20 animate-pulse-slow"
            }`}
          />
          <div
            aria-hidden="true"
            className={`absolute -inset-6 rounded-full border-2 transition-all duration-700 pointer-events-none ${
              isListeningWakeWord ? "border-emerald-400/60 animate-ping" : "border-cyan-500/30 mic-glow-ring"
            }`}
          />

          <div
            className={`relative z-10 w-28 h-28 sm:w-36 sm:h-36 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-500 ring-4 ${
              isListeningWakeWord
                ? "bg-gradient-to-b from-emerald-300 to-emerald-600 text-slate-950 ring-emerald-300 shadow-[0_0_40px_10px_rgba(52,211,153,0.5)] scale-105"
                : "bg-gradient-to-b from-cyan-500 to-cyan-700 text-slate-950 ring-cyan-300/40 shadow-cyan-500/50"
            }`}
            aria-hidden="true"
          >
            <svg className="w-14 h-14 sm:w-16 sm:h-16 text-slate-950" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
            {isListeningWakeWord && (
              <span className="mt-1 flex items-center gap-1 text-[10px] font-extrabold tracking-widest text-slate-950 uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-950 animate-ping inline-block" />
                STANDBY
              </span>
            )}
          </div>
        </div>

        {/* Spoken Guidance Prompt Box */}
        <div className="space-y-4">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
            Selamat Datang di <span className="text-cyan-400">WINI AI</span>
          </h2>

          <div
            role="alert"
            aria-live="polite"
            className="bg-brand-card border-2 border-cyan-600/70 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-cyan-950/60 max-w-2xl mx-auto space-y-4"
          >
            {/* Primary Voice Wake Word Prompt */}
            <div className="space-y-2">
              <p className="text-xl sm:text-2xl font-black text-white leading-relaxed flex items-center justify-center gap-2">
                <span>🗣️</span>
                <span>Ucapkan Kata Pemicu Suara:</span>
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="px-5 py-2.5 rounded-xl bg-emerald-950/80 border-2 border-emerald-400 text-emerald-300 font-extrabold text-lg sm:text-xl shadow-lg shadow-emerald-950/40">
                  "Let's go WINI"
                </span>
                <span className="text-slate-400 font-normal">atau</span>
                <span className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300 font-bold text-base sm:text-lg">
                  "Halo WINI"
                </span>
              </div>
            </div>

            {/* Listening Indicator */}
            {isListeningWakeWord && (
              <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-emerald-950/50 border border-emerald-500/50 text-emerald-300 text-xs sm:text-sm font-semibold animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span>Mikrofon Siaga — Silakan Ucapkan "Let's go WINI"!</span>
              </div>
            )}

            {isSpeaking && (
              <div className="flex items-center justify-center gap-2 pt-2 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span>Asisten sedang membacakan panduan audio...</span>
              </div>
            )}

            {/* Fallback keyboard info */}
            <div className="pt-2 border-t border-slate-800 text-xs text-slate-400">
              Opsi Cadangan: Tekan <kbd className="text-cyan-300 font-mono">Spasi</kbd> / <kbd className="text-cyan-300 font-mono">Enter</kbd> 1x, atau klik 2x di mana saja.
            </div>

            {keyPressCount === 1 && (
              <p className="text-sm font-semibold text-amber-300 animate-pulse pt-1">
                ⚡ Tombol terdeteksi 1x! Tekan 1 kali lagi untuk langsung mengaktifkan...
              </p>
            )}
          </div>
        </div>

        {/* Giant Clickable / Keyboard Accessible Trigger Button */}
        <button
          onClick={onActivate}
          type="button"
          autoFocus
          aria-label="Mulai aplikasi WINI AI. Tekan Spasi atau Enter untuk mengizinkan mikrofon dan memulai."
          className="focus-accessible main-card w-full max-w-md py-4 px-8 rounded-2xl bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 active:scale-95 text-slate-950 font-extrabold text-base sm:text-lg shadow-xl shadow-cyan-600/30 transition-all flex items-center justify-center gap-3 cursor-pointer"
        >
          <span className="text-2xl">🎙️</span>
          <span>Mulai WINI AI (Tekan Spasi / Enter)</span>
        </button>

        <p className="text-xs sm:text-sm text-slate-400 font-medium">
          Didesain ramah aksesibilitas penuh untuk tunanetra (pembaca layar &amp; perintah suara) dan tunarungu (takarir visual waktu-nyata).
        </p>
      </div>

      {/* Bottom Shortcuts Info */}
      <div className="w-full max-w-4xl flex items-center justify-between text-xs text-slate-500 border-t border-brand-border/60 pt-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Siap Menerima Sentuhan / Ketukan Keyboard</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span><kbd className="bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded text-cyan-300">Keyboard 2x</kbd> Buka Mic</span>
          <span><kbd className="bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded text-cyan-300">Klik 2x</kbd> Buka Mic</span>
        </div>
      </div>
    </div>
  );
}
