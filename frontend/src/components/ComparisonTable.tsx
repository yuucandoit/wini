'use client';

import React from 'react';
import type { ComparisonResult } from '@/lib/types';

interface ComparisonTableProps {
  comparison: ComparisonResult;
}

export default function ComparisonTable({ comparison }: ComparisonTableProps) {
  const { symbols, names, healthScores, metrics } = comparison;

  return (
    <section className="w-full animate-fade-in space-y-6">
      <h2 className="text-xl font-semibold text-foreground">📊 Perbandingan Emiten</h2>
      
      <div className="w-full overflow-x-auto bg-surface rounded-xl shadow-sm border border-surface-light">
        <table 
          className="w-full min-w-full text-left border-collapse" 
          aria-label="Tabel perbandingan emiten"
        >
          <thead className="bg-surface-light text-foreground text-sm uppercase tracking-wider">
            <tr>
              <th scope="col" className="px-6 py-4 font-semibold border-b border-surface-light min-w-48">
                Metrik
              </th>
              {symbols.map(symbol => (
                <th key={symbol} scope="col" className="px-6 py-4 font-semibold border-b border-surface-light min-w-48">
                  <div className="flex flex-col">
                    <span className="text-lg">{symbol}</span>
                    <span className="text-xs text-muted font-normal capitalize mt-1">{names[symbol]}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-base text-foreground">
            {metrics.map((metric, index) => (
              <tr 
                key={index} 
                className={index % 2 === 0 ? 'bg-surface' : 'bg-surface-light/30 hover:bg-surface-light/50 transition-colors'}
              >
                <th scope="row" className="px-6 py-4 font-medium border-b border-surface-light text-muted">
                  {metric.metric}
                </th>
                {symbols.map(symbol => (
                  <td key={`${index}-${symbol}`} className="px-6 py-4 border-b border-surface-light">
                    {metric.values[symbol] || '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-surface">
            <tr>
              <th scope="row" className="px-6 py-5 font-semibold text-foreground">
                Status Kesehatan
              </th>
              {symbols.map(symbol => {
                const score = healthScores[symbol];
                if (!score) return <td key={symbol} className="px-6 py-5">-</td>;
                
                const cat = (score.category || '').toUpperCase();
                let badgeStyle = '';
                if (cat.includes('SANGAT SEHAT') || score.score >= 85) {
                  badgeStyle = 'bg-emerald-950/80 text-emerald-300 border-emerald-400/60 shadow-sm shadow-emerald-500/20';
                } else if (cat.includes('SEHAT') || score.score >= 70) {
                  badgeStyle = 'bg-teal-950/80 text-teal-300 border-teal-400/50';
                } else if (cat.includes('WASPADA') || score.score >= 50) {
                  badgeStyle = 'bg-amber-950/80 text-amber-300 border-amber-400/50';
                } else {
                  badgeStyle = 'bg-rose-950/80 text-rose-300 border-rose-500/50';
                }
                
                return (
                  <td key={symbol} className="px-6 py-5">
                    <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold border ${badgeStyle}`}>
                      {score.category} ({score.score})
                    </span>
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
