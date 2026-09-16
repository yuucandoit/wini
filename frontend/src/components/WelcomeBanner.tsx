'use client';

import React, { useEffect, useRef, useState } from 'react';

interface WelcomeBannerProps {
  onActivate: () => void;
  onReplayAudio?: () => void;
  isSpeaking?: boolean;
}

export default function WelcomeBanner({
  onActivate,
  onReplayAudio,
  isSpeaking = false,
}: WelcomeBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastKeyTimeRef = useRef<number>(0);
  const lastPointerTimeRef = useRef<number>(0);
  const [keyPressCount, setKeyPressCount] = useState<number>(0);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Listen for ANY key pressed twice, or double-click anywhere
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid if user somehow focused another control
      const now = Date.now();
      const diff = now - lastKeyTimeRef.current;

      if (diff > 50 && diff < 800) {
        // Any key pressed twice in quick succession!
        e.preventDefault();
        lastKeyTimeRef.current = 0;
        setKeyPressCount(2);
        onActivate();
      } else {
        lastKeyTimeRef.current = now;
        setKeyPressCount(1);
        // Reset counter after timeout
        setTimeout(() => {
          if (Date.now() - lastKeyTimeRef.current >= 750) {
            setKeyPressCount(0);
          }
        }, 800);
      }
    };

    const handlePointerUp = (e: MouseEvent | TouchEvent) => {
      // Ignore if clicking explicitly on a sub-button
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "BUTTON" && !target.classList.contains("main-card")) {
        return;
      }

      const now = Date.now();
      const diff = now - lastPointerTimeRef.current;

      if (diff > 50 && diff < 500) {
        // Double click / tap detected!
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
  }, [onActivate]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Layar Sambutan WINI AI"
      tabIndex={0}
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-brand-bg text-slate-100 p-6 md:p-12 animate-fade-in select-none focus:outline-none overflow-y-auto"
    >
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
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-cyan-500/20 blur-2xl scale-150 animate-pulse-slow pointer-events-none"
          ></div>
          <div
            aria-hidden="true"
            className="absolute -inset-6 rounded-full border-2 border-cyan-500/30 mic-glow-ring pointer-events-none"
          ></div>

          <div
            className="relative z-10 w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-gradient-to-b from-cyan-500 to-cyan-700 text-slate-950 flex flex-col items-center justify-center shadow-2xl shadow-cyan-500/50 ring-4 ring-cyan-300/40"
            aria-hidden="true"
          >
            <svg className="w-14 h-14 sm:w-16 sm:h-16 text-slate-950" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"></path>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"></path>
            </svg>
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
            <p className="text-lg sm:text-2xl font-bold text-white leading-relaxed">
              🔊 Untuk mengaktifkan mikrofon:
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-base sm:text-lg font-semibold text-cyan-300">
              <span className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 shadow-inner">
                Pencet Keyboard 2x <kbd className="text-amber-300 font-mono text-sm">(Tombol Apa Saja)</kbd>
              </span>
              <span className="text-slate-400 font-normal">atau</span>
              <span className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 shadow-inner">
                Klik / Ketuk 2x di Mana Saja
              </span>
            </div>

            {keyPressCount === 1 && (
              <p className="text-sm font-semibold text-amber-300 animate-pulse pt-2">
                ⚡ Tombol terdeteksi 1x! Tekan 1 kali lagi untuk langsung mengaktifkan mikrofon...
              </p>
            )}

            {isSpeaking && (
              <div className="flex items-center justify-center gap-2 pt-2 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                <span>Asisten sedang membacakan panduan audio...</span>
              </div>
            )}
          </div>
        </div>

        {/* Giant Clickable Trigger Card */}
        <button
          onClick={onActivate}
          type="button"
          aria-label="Aktifkan mikrofon sekarang"
          className="focus-accessible main-card w-full max-w-md py-4 px-8 rounded-2xl bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 active:scale-95 text-slate-950 font-extrabold text-base sm:text-lg shadow-xl shadow-cyan-600/30 transition-all flex items-center justify-center gap-3 cursor-pointer"
        >
          <span className="text-xl">🎙️</span>
          <span>Aktifkan Mikrofon Sekarang</span>
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
