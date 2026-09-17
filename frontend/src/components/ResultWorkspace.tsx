'use client';

import React from 'react';
import type { AnalysisResult } from "@/lib/types";
import AudioPlayer from "@/components/AudioPlayer";
import HealthScoreCard from "@/components/HealthScoreCard";
import ComparisonTable from "@/components/ComparisonTable";
import FormattedMarkdown from "@/components/FormattedMarkdown";
import AccessibleTrendChart from "@/components/AccessibleTrendChart";
import PortfolioSimulatorCard from "@/components/PortfolioSimulatorCard";

interface ResultWorkspaceProps {
  result: AnalysisResult;
  onNewQuery: () => void;
  onSpeak?: (text: string) => void;
}

export default function ResultWorkspace({ result, onNewQuery, onSpeak }: ResultWorkspaceProps) {
  return (
    <section aria-label="Hasil analisis emiten" className="flex flex-col gap-8 w-full max-w-4xl mx-auto animate-fade-in">
      <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">📋 Hasil Analisis Otonom</h2>
        </div>
        <p className="text-slate-300 text-sm sm:text-base">
          Pertanyaan: <strong className="text-cyan-300 font-semibold">"{result.query}"</strong>
        </p>
      </div>

      <AudioPlayer text={result.summary} />

      {/* Historical Quarterly Trend Chart */}
      {result.historicalTrend && (
        <AccessibleTrendChart trend={result.historicalTrend} onSpeak={onSpeak} />
      )}

      {/* Portfolio Simulation Card */}
      {result.portfolio && (
        <PortfolioSimulatorCard portfolio={result.portfolio} onSpeak={onSpeak} />
      )}

      {result.healthScore && !result.historicalTrend && !result.portfolio && (
        <HealthScoreCard healthScore={result.healthScore} />
      )}

      {result.comparison && !result.portfolio && (
        <ComparisonTable comparison={result.comparison} />
      )}

      <div className="bg-brand-card border border-brand-border rounded-2xl p-6 shadow-xl">
        <h3 className="text-lg font-bold text-cyan-300 mb-4 flex items-center gap-2">
          <span>📝</span> Narasi Analisis &amp; Catatan Kepatuhan
        </h3>
        <FormattedMarkdown content={result.transcript} />
      </div>

      <div className="flex flex-col items-center gap-2 self-center w-full sm:w-auto">
        <button
          onClick={onNewQuery}
          className="focus-accessible w-full sm:w-auto bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-slate-950 font-bold py-3.5 px-8 rounded-full min-h-12 shadow-lg shadow-cyan-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
          type="button"
        >
          <span>←</span>
          <span>Analisis Baru / Kembali ke Dasbor Suara</span>
        </button>
        <p className="text-center text-xs text-slate-400">
          Klik tombol di atas atau tekan <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-mono text-[11px]">Escape</kbd> untuk kembali ke mikrofon.
        </p>
      </div>
    </section>
  );
}
