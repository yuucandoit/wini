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
                
                let badgeStyle = '';
                if (score.category === 'SEHAT') {
                  badgeStyle = 'bg-success/10 text-success border-success/20';
                } else if (score.category === 'WASPADA') {
                  badgeStyle = 'bg-warning/10 text-warning border-warning/20';
                } else {
                  badgeStyle = 'bg-danger/10 text-danger border-danger/20';
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
