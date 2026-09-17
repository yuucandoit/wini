'use client';

import React, { useState } from 'react';
import type { PortfolioSimulation } from '@/lib/types';

interface PortfolioSimulatorCardProps {
  portfolio: PortfolioSimulation;
  onSpeak?: (text: string) => void;
}

function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function PortfolioSimulatorCard({ portfolio, onSpeak }: PortfolioSimulatorCardProps) {
  const {
    totalCapital,
    weightedScore,
    status,
    allocations,
    weakestStock,
    strongestStock,
    rebalancingAdvice,
    projectedScoreAfterRebalance,
  } = portfolio;

  const [showRebalance, setShowRebalance] = useState(false);

  // Status color classes
  let statusBadge = 'bg-emerald-950/80 border-emerald-500 text-emerald-300';
  let barColor = 'bg-emerald-400';
  if (status === 'SANGAT SEHAT') {
    statusBadge = 'bg-emerald-950/80 border-emerald-400 text-emerald-300 shadow-md shadow-emerald-500/20';
    barColor = 'bg-emerald-400';
  } else if (status === 'SEHAT') {
    statusBadge = 'bg-teal-950/80 border-teal-500 text-teal-300';
    barColor = 'bg-teal-400';
  } else if (status === 'WASPADA') {
    statusBadge = 'bg-amber-950/80 border-amber-500 text-amber-300';
    barColor = 'bg-amber-400';
  } else {
    statusBadge = 'bg-rose-950/80 border-rose-500 text-rose-300';
    barColor = 'bg-rose-400';
  }

  const handleSpeakSummary = () => {
    if (!onSpeak) return;
    const msg =
      `Simulasi portofolio dengan modal total ${formatIDR(totalCapital)}. ` +
      `Skor kesehatan portofolio terbobot adalah ${weightedScore} dari 100, berstatus ${status}. ` +
      `Saham paling lemah adalah ${weakestStock.symbol} dengan alasan ${weakestStock.reason}. ` +
      `Saham terkuat adalah ${strongestStock.symbol}. ` +
      `${rebalancingAdvice}`;
    onSpeak(msg);
  };

  return (
    <section
      aria-labelledby="portfolio-sim-heading"
      className="w-full bg-brand-card border border-brand-border rounded-2xl p-5 sm:p-7 shadow-xl space-y-6 animate-fade-in"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-brand-border">
        <div>
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="text-2xl">📦</span>
            <h3 id="portfolio-sim-heading" className="text-lg sm:text-xl font-bold text-white tracking-wide">
              Simulasi Kesehatan Portofolio
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Total Modal Investasi: <strong className="text-cyan-300">{formatIDR(totalCapital)}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`px-3.5 py-1.5 rounded-xl border font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md ${statusBadge}`}
            role="status"
            aria-label={`Skor gabungan portofolio: ${weightedScore} dari 100, status ${status}`}
          >
            <span>[ {status} ]</span>
            <span className="text-sm font-extrabold">{weightedScore}/100</span>
          </div>

          <button
            onClick={handleSpeakSummary}
            aria-label="Bacakan ringkasan analisis portofolio dan rekomendasi rebalancing"
            className="focus-accessible flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 active:scale-95 transition"
            type="button"
          >
            <span aria-hidden="true">🔊</span>
            <span>Bacakan</span>
          </button>
        </div>
      </div>

      {/* Weighted Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-semibold text-slate-300">
          <span>Skor Portofolio Terbobot</span>
          <span>{weightedScore}%</span>
        </div>
        <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800" aria-hidden="true">
          <div
            className={`h-full rounded-full ${barColor} transition-all duration-1000 ease-out`}
            style={{ width: `${Math.max(0, Math.min(100, weightedScore))}%` }}
          />
        </div>
      </div>

      {/* Weakest & Strongest Stock Callouts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Weakest Link */}
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 flex items-start gap-3">
          <span aria-hidden="true" className="text-xl mt-0.5">⚠️</span>
          <div>
            <p className="text-[11px] font-bold text-rose-300 uppercase tracking-wide">
              Saham Paling Berisiko (Weakest Link)
            </p>
            <h4 className="text-sm font-bold text-white mt-0.5">
              {weakestStock.symbol}
            </h4>
            <p className="text-xs text-rose-200 mt-1 leading-relaxed">
              {weakestStock.reason}
            </p>
          </div>
        </div>

        {/* Strongest Stock */}
        <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-4 flex items-start gap-3">
          <span aria-hidden="true" className="text-xl mt-0.5">⚓</span>
          <div>
            <p className="text-[11px] font-bold text-emerald-300 uppercase tracking-wide">
              Saham Jangkar Stabilitas (Anchor)
            </p>
            <h4 className="text-sm font-bold text-white mt-0.5">
              {strongestStock.symbol}
            </h4>
            <p className="text-xs text-emerald-200 mt-1 leading-relaxed">
              {strongestStock.reason}
            </p>
          </div>
        </div>
      </div>

      {/* Allocations Table */}
      <div className="overflow-x-auto">
        <table
          className="w-full text-left text-xs sm:text-sm text-slate-200 border-collapse"
          aria-label="Tabel rincian alokasi modal saham dalam portofolio"
        >
          <caption className="sr-only">
            Rincian bobot dan nominal modal yang diinvestasikan pada masing-masing emiten
          </caption>
          <thead>
            <tr className="border-b border-brand-border bg-slate-900/60">
              <th scope="col" className="py-2.5 px-3 font-semibold text-cyan-300">Emiten</th>
              <th scope="col" className="py-2.5 px-3 font-semibold text-cyan-300">Bobot Awal</th>
              <th scope="col" className="py-2.5 px-3 font-semibold text-cyan-300">Nominal Awal</th>
              <th scope="col" className="py-2.5 px-3 font-semibold text-cyan-300">Skor</th>
              <th scope="col" className="py-2.5 px-3 font-semibold text-cyan-300">Status</th>
              {showRebalance && (
                <>
                  <th scope="col" className="py-2.5 px-3 font-semibold text-emerald-400">Bobot Saran</th>
                  <th scope="col" className="py-2.5 px-3 font-semibold text-emerald-400">Nominal Saran</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {allocations.map((item) => (
              <tr
                key={item.symbol}
                className={`border-b border-slate-800/80 transition hover:bg-slate-900/40 ${
                  item.symbol === weakestStock.symbol ? 'bg-rose-950/10' : ''
                }`}
              >
                <th scope="row" className="py-3 px-3 font-bold text-white">
                  <div>{item.symbol}</div>
                  <div className="text-[11px] font-normal text-slate-400">{item.name}</div>
                </th>
                <td className="py-3 px-3 text-slate-200 font-medium">
                  {(item.weight * 100).toFixed(1)}%
                </td>
                <td className="py-3 px-3 font-semibold text-slate-100">
                  {formatIDR(item.nominal)}
                </td>
                <td className="py-3 px-3 font-bold text-white">
                  {item.score}/100
                </td>
                <td className="py-3 px-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                      item.status === 'SANGAT SEHAT'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : item.status === 'SEHAT'
                        ? 'bg-teal-950 text-teal-300 border border-teal-800'
                        : item.status === 'WASPADA'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}
                  >
                    {item.status}
                  </span>
                </td>
                {showRebalance && (
                  <>
                    <td className="py-3 px-3 font-bold text-emerald-300">
                      {item.suggested_weight != null ? `${(item.suggested_weight * 100).toFixed(1)}%` : '-'}
                    </td>
                    <td className="py-3 px-3 font-semibold text-emerald-300">
                      {item.suggested_nominal != null ? formatIDR(item.suggested_nominal) : '-'}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rebalancing Interactive Section */}
      <div className="bg-slate-900/70 border border-slate-700/80 rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="text-lg">⚖️</span>
            <h4 className="text-sm font-bold text-cyan-300">
              Rekomendasi Rebalancing Portofolio
            </h4>
          </div>

          <button
            onClick={() => setShowRebalance((prev) => !prev)}
            aria-expanded={showRebalance}
            className="focus-accessible px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-semibold text-slate-200 transition self-start sm:self-auto"
            type="button"
          >
            {showRebalance ? '✕ Sembunyikan Detail Rebalance' : '💡 Tampilkan Saran Rebalancing'}
          </button>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          {rebalancingAdvice}
        </p>

        {projectedScoreAfterRebalance != null && projectedScoreAfterRebalance > weightedScore && (
          <div className="pt-2 flex items-center gap-2 text-xs font-bold text-emerald-400">
            <span aria-hidden="true">📈</span>
            <span>
              Proyeksi Skor Setelah Rebalance: <strong className="underline">{projectedScoreAfterRebalance}/100</strong> (+{projectedScoreAfterRebalance - weightedScore} poin)
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
