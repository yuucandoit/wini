'use client';

import React from 'react';
import type { GlossaryEntry } from '@/lib/glossary';

interface GlossaryCardProps {
  entry: GlossaryEntry;
  onSpeak: (text: string) => void;
  onDismiss: () => void;
}

export default function GlossaryCard({ entry, onSpeak, onDismiss }: GlossaryCardProps) {
  return (
    <div
      role="dialog"
      aria-label={`Penjelasan: ${entry.term}`}
      aria-modal="false"
      className="w-full max-w-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-cyan-700/60 rounded-2xl p-6 shadow-2xl shadow-cyan-950/50 animate-fade-in"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="text-2xl">📖</span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-cyan-400 mb-0.5">
              Kamus Jargon — WINI AI
            </p>
            <h3 className="text-lg font-extrabold text-white leading-tight">{entry.term}</h3>
          </div>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Tutup penjelasan"
          className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition flex items-center justify-center text-sm"
          type="button"
        >
          ✕
        </button>
      </div>

      {/* Definition */}
      <div className="mb-4 bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Definisi</p>
        <p className="text-sm sm:text-base text-slate-100 leading-relaxed">{entry.definition}</p>
      </div>

      {/* Analogy */}
      <div className="mb-5 bg-cyan-950/40 rounded-xl p-4 border border-cyan-800/40">
        <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1.5">
          💡 Analogi Sehari-hari
        </p>
        <p className="text-sm sm:text-base text-slate-200 leading-relaxed italic">
          &ldquo;{entry.analogy}&rdquo;
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() =>
            onSpeak(`${entry.term}. ${entry.definition} Analogi sehari-hari: ${entry.analogy}`)
          }
          aria-label={`Bacakan penjelasan ${entry.term}`}
          className="focus-accessible flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-bold transition"
          type="button"
        >
          <span aria-hidden="true">🔊</span>
          Bacakan
        </button>
        <button
          onClick={onDismiss}
          aria-label="Tutup kamus jargon"
          className="focus-accessible flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          type="button"
        >
          Tutup
        </button>
        <span className="ml-auto text-[11px] text-slate-500 italic">
          Ucapkan &ldquo;apa itu DER?&rdquo; untuk jargon lainnya
        </span>
      </div>
    </div>
  );
}
