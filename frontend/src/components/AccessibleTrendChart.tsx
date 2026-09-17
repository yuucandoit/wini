'use client';

import React, { useState, useCallback } from 'react';
import type { HistoricalTrend, QuarterlyPoint } from '@/lib/types';

interface AccessibleTrendChartProps {
  trend: HistoricalTrend;
  onSpeak?: (text: string) => void;
}

/**
 * Play an audio sonification melody representing the health score graph.
 * Frequency in Hz scales linearly with the score (220 Hz for 0 to 620 Hz for 100).
 * Ascending pitch = Improving, Descending pitch = Deteriorating.
 */
function playGraphSonification(points: QuarterlyPoint[]) {
  if (typeof window === 'undefined') return;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const noteDuration = 0.32;
    const gap = 0.04;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.12, now);
    masterGain.connect(ctx.destination);

    points.forEach((pt, i) => {
      const startTime = now + i * (noteDuration + gap);
      // Map score 0-100 to frequency 220Hz - 620Hz (musical A3 to D5)
      const freq = 220 + (Math.max(0, Math.min(100, pt.score)) / 100) * 400;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      // Smooth attack and decay
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.15, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + noteDuration);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(startTime);
      osc.stop(startTime + noteDuration + 0.01);
    });
  } catch {
    // Ignore audio context autoplay restriction
  }
}

/**
 * Play a single note for an individual quarter point
 */
function playQuarterTone(score: number) {
  if (typeof window === 'undefined') return;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const freq = 220 + (Math.max(0, Math.min(100, score)) / 100) * 400;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.36);
  } catch {
    // Ignore
  }
}

export default function AccessibleTrendChart({ trend, onSpeak }: AccessibleTrendChartProps) {
  const { symbol, companyName, points, direction, delta, earlyWarning, summary } = trend;
  const [selectedQuarter, setSelectedQuarter] = useState<number | null>(null);
  const [isPlayingSonification, setIsPlayingSonification] = useState(false);

  const handlePlaySonification = useCallback(() => {
    setIsPlayingSonification(true);
    playGraphSonification(points);
    setTimeout(() => setIsPlayingSonification(false), points.length * 380);
  }, [points]);

  const handleSelectQuarter = (idx: number) => {
    setSelectedQuarter(idx);
    const pt = points[idx];
    playQuarterTone(pt.score);
    if (onSpeak) {
      const msg = `${pt.quarter}: Skor ${pt.score} dari 100, status ${pt.status}. ${
        pt.der ? `DER ${pt.der.toFixed(2)} kali, ` : ''
      }${pt.roe ? `ROE ${(pt.roe * 100).toFixed(1)} persen` : ''}`;
      onSpeak(msg);
    }
  };

  // Direction badge styling
  let directionBadge = '';
  let directionIcon = '→';
  if (direction === 'MEMBAIK') {
    directionBadge = 'bg-emerald-950/70 border-emerald-500 text-emerald-300';
    directionIcon = '↗';
  } else if (direction === 'MEMBURUK') {
    directionBadge = 'bg-rose-950/70 border-rose-500 text-rose-300';
    directionIcon = '↘';
  } else {
    directionBadge = 'bg-amber-950/70 border-amber-500 text-amber-300';
    directionIcon = '→';
  }

  // SVG dimensions for chart
  const svgWidth = 540;
  const svgHeight = 180;
  const paddingX = 50;
  const paddingY = 30;

  const getCoordinates = (i: number, score: number) => {
    const x = paddingX + (i * (svgWidth - 2 * paddingX)) / Math.max(1, points.length - 1);
    // Y inverted: 100 score = top (paddingY), 0 score = bottom (svgHeight - paddingY)
    const y = svgHeight - paddingY - (score / 100) * (svgHeight - 2 * paddingY);
    return { x, y };
  };

  // Polyline points
  const polylineStr = points
    .map((p, i) => {
      const { x, y } = getCoordinates(i, p.score);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <section
      aria-labelledby="trend-chart-heading"
      className="w-full bg-brand-card border border-brand-border rounded-2xl p-5 sm:p-7 shadow-xl space-y-6 animate-fade-in"
    >
      {/* Header with Title and Direction Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-brand-border">
        <div>
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="text-xl">🗓️</span>
            <h3 id="trend-chart-heading" className="text-lg sm:text-xl font-bold text-white tracking-wide">
              Tren Kesehatan Historis (4 Kuartal)
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {symbol} — {companyName}
          </p>
        </div>

        {/* Direction Badge */}
        <div className="flex items-center gap-3">
          <div
            className={`px-3 py-1.5 rounded-xl border font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md ${directionBadge}`}
            role="status"
            aria-label={`Status tren: ${direction}, perubahan ${delta >= 0 ? '+' : ''}${delta} poin`}
          >
            <span aria-hidden="true" className="text-base font-extrabold">{directionIcon}</span>
            <span>{direction}</span>
            <span className="text-xs opacity-80">({delta >= 0 ? `+${delta}` : delta} Poin)</span>
          </div>

          {/* Audio Sonification Player Button */}
          <button
            onClick={handlePlaySonification}
            disabled={isPlayingSonification}
            aria-label="Dengarkan grafik suara nada kuartal untuk tunanetra"
            className="focus-accessible flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 active:scale-95 transition"
            type="button"
          >
            <span aria-hidden="true">{isPlayingSonification ? '🔊' : '🎵'}</span>
            <span>{isPlayingSonification ? 'Memainkan...' : 'Grafik Suara'}</span>
          </button>
        </div>
      </div>

      {/* Early Warning Banner */}
      {earlyWarning && (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-rose-950/60 border-2 border-rose-500/70 rounded-xl p-4 flex items-start gap-3 shadow-lg"
        >
          <span aria-hidden="true" className="text-2xl mt-0.5">⚠️</span>
          <div>
            <h4 className="text-rose-300 font-bold text-sm uppercase tracking-wide">
              Peringatan Dini Pelemahan Fundamental
            </h4>
            <p className="text-xs sm:text-sm text-rose-100 mt-1 leading-relaxed">
              {earlyWarning}
            </p>
          </div>
        </div>
      )}

      {/* VISUAL SVG CHART (Accessible with glowing dots and interactive points) */}
      <div className="relative bg-slate-950/80 rounded-2xl p-4 border border-slate-800/80 overflow-hidden">
        <p className="sr-only">
          Grafik visual perkembangan 4 kuartal. Gunakan tombol kuartal di bawah atau navigasikan tabel semantik untuk membaca data dengan screen reader.
        </p>

        <div className="w-full flex justify-center">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full max-w-xl h-auto overflow-visible select-none"
            aria-hidden="true"
          >
            <defs>
              {/* Gradient for the line */}
              <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
              {/* Subtle fill gradient under curve */}
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            {[25, 50, 75, 100].map((val) => {
              const y = svgHeight - paddingY - (val / 100) * (svgHeight - 2 * paddingY);
              return (
                <g key={val}>
                  <line
                    x1={paddingX - 10}
                    y1={y}
                    x2={svgWidth - paddingX + 10}
                    y2={y}
                    stroke="#334155"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <text x={paddingX - 18} y={y + 3} fill="#64748b" fontSize="9" textAnchor="end">
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Area Fill */}
            {points.length > 1 && (
              <polygon
                points={`${getCoordinates(0, 0).x},${svgHeight - paddingY} ${polylineStr} ${
                  getCoordinates(points.length - 1, 0).x
                },${svgHeight - paddingY}`}
                fill="url(#areaGrad)"
              />
            )}

            {/* Line Plot */}
            <polyline
              fill="none"
              stroke="url(#lineGrad)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polylineStr}
            />

            {/* Interactive Data Dots */}
            {points.map((pt, idx) => {
              const { x, y } = getCoordinates(idx, pt.score);
              const isSelected = selectedQuarter === idx;
              return (
                <g key={idx} className="cursor-pointer" onClick={() => handleSelectQuarter(idx)}>
                  {/* Outer pulse circle if selected */}
                  {isSelected && (
                    <circle cx={x} cy={y} r="14" fill="#34d399" opacity="0.3" className="animate-ping" />
                  )}
                  {/* Outer ring */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isSelected ? '8' : '6'}
                    fill="#0f172a"
                    stroke={pt.score >= 85 ? '#34d399' : pt.score >= 70 ? '#22d3ee' : '#f59e0b'}
                    strokeWidth="3"
                  />
                  {/* Inner dot */}
                  <circle
                    cx={x}
                    cy={y}
                    r="3"
                    fill={pt.score >= 85 ? '#34d399' : pt.score >= 70 ? '#22d3ee' : '#f59e0b'}
                  />
                  {/* Score Label Above Dot */}
                  <text
                    x={x}
                    y={y - 12}
                    fill="#f8fafc"
                    fontSize="11"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {pt.score}
                  </text>
                  {/* Quarter Label Below Line */}
                  <text
                    x={x}
                    y={svgHeight - 10}
                    fill={isSelected ? '#38bdf8' : '#94a3b8'}
                    fontSize="11"
                    fontWeight={isSelected ? 'bold' : 'normal'}
                    textAnchor="middle"
                  >
                    {pt.quarter}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Per-Quarter Interactive Audio Keyboard Buttons */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
            Pilih Kuartal (Dengarkan):
          </span>
          {points.map((pt, idx) => {
            const isSelected = selectedQuarter === idx;
            return (
              <button
                key={idx}
                onClick={() => handleSelectQuarter(idx)}
                aria-pressed={isSelected}
                aria-label={`Kuartal ${pt.quarter}, skor ${pt.score}, kategori ${pt.status}`}
                className={`focus-accessible px-3 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/30 scale-105'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
                }`}
                type="button"
              >
                <span>{pt.quarter}</span>
                <span className="opacity-80 text-[10px]">({pt.score} pt)</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SEMANTIC ACCESSIBLE DATA TABLE (WCAG 2.2 AAA standard for Screen Readers) */}
      <div className="overflow-x-auto">
        <table
          className="w-full text-left text-xs sm:text-sm text-slate-200 border-collapse"
          aria-label={`Rincian metrik tren 4 kuartal untuk saham ${symbol}`}
        >
          <caption className="sr-only">
            Tabel rincian skor kesehatan fundamental dan rasio keuangan kuartalan saham {symbol}
          </caption>
          <thead>
            <tr className="border-b border-brand-border bg-slate-900/60">
              <th scope="col" className="py-2.5 px-3 font-semibold text-cyan-300">Kuartal</th>
              <th scope="col" className="py-2.5 px-3 font-semibold text-cyan-300">Skor</th>
              <th scope="col" className="py-2.5 px-3 font-semibold text-cyan-300">Kategori</th>
              <th scope="col" className="py-2.5 px-3 font-semibold text-cyan-300">DER (Utang)</th>
              <th scope="col" className="py-2.5 px-3 font-semibold text-cyan-300">ROE (Laba)</th>
              <th scope="col" className="py-2.5 px-3 font-semibold text-cyan-300">P/E Valuasi</th>
            </tr>
          </thead>
          <tbody>
            {points.map((pt, idx) => (
              <tr
                key={idx}
                className={`border-b border-slate-800/80 transition ${
                  selectedQuarter === idx ? 'bg-cyan-950/40 font-semibold' : 'hover:bg-slate-900/40'
                }`}
              >
                <th scope="row" className="py-2.5 px-3 text-white font-medium">
                  {pt.quarter}
                </th>
                <td className="py-2.5 px-3 font-bold text-white">
                  {pt.score}/100
                </td>
                <td className="py-2.5 px-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                      pt.status === 'SANGAT SEHAT'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : pt.status === 'SEHAT'
                        ? 'bg-teal-950 text-teal-300 border border-teal-800'
                        : pt.status === 'WASPADA'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}
                  >
                    {pt.status}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-slate-300">
                  {pt.der != null ? `${pt.der.toFixed(2)}x` : '-'}
                </td>
                <td className="py-2.5 px-3 text-slate-300">
                  {pt.roe != null ? `${(pt.roe * 100).toFixed(1)}%` : '-'}
                </td>
                <td className="py-2.5 px-3 text-slate-300">
                  {pt.pe != null ? `${pt.pe.toFixed(2)}x` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Verbal Summary Note */}
      <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 flex items-start gap-3">
        <span aria-hidden="true" className="text-cyan-400 text-lg">💡</span>
        <div className="space-y-1">
          <p className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
            Kesimpulan Tren Kuartal
          </p>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {summary}
          </p>
        </div>
      </div>
    </section>
  );
}
