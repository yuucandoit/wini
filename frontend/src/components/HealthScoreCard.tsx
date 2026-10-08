'use client';

import React from 'react';
import type { HealthScore } from '@/lib/types';

interface HealthScoreCardProps {
  healthScore: HealthScore;
}

export default function HealthScoreCard({ healthScore }: HealthScoreCardProps) {
  const { symbol, name, score, category, label } = healthScore;
  
  let colorClasses = '';
  let barColorClass = '';
  
  const cat = (category || '').toUpperCase();
  if (cat.includes('SANGAT SEHAT') || score >= 85) {
    colorClasses = 'text-emerald-300 bg-emerald-950/70 border-emerald-400/60 shadow-sm shadow-emerald-500/20';
    barColorClass = 'bg-emerald-400';
  } else if (cat.includes('SEHAT') || score >= 70) {
    colorClasses = 'text-teal-300 bg-teal-950/70 border-teal-400/50';
    barColorClass = 'bg-teal-400';
  } else if (cat.includes('WASPADA') || score >= 50) {
    colorClasses = 'text-amber-300 bg-amber-950/70 border-amber-400/50';
    barColorClass = 'bg-amber-400';
  } else {
    colorClasses = 'text-rose-300 bg-rose-950/70 border-rose-500/50';
    barColorClass = 'bg-rose-500';
  }

  const ariaLabelText = `Skor kesehatan ${symbol}: ${score} dari 100, kategori ${category}. ${label || ''}`;

  return (
    <div 
      className="bg-surface rounded-xl p-6 animate-fade-in flex flex-col items-center w-full max-w-sm mx-auto shadow-sm border border-surface-light"
      aria-live="polite"
      aria-label={ariaLabelText}
      role="region"
    >
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-foreground">{symbol}</h3>
        <p className="text-muted text-sm mt-1">{name}</p>
      </div>

      <div className="flex flex-col items-center justify-center mb-6">
        <div className="flex items-baseline">
          <span className="text-6xl font-bold text-foreground">{score}</span>
          <span className="text-xl text-muted ml-1">/100</span>
        </div>
      </div>

      <div className="w-full h-3 bg-background rounded-full overflow-hidden mb-6" aria-hidden="true">
        <div 
          className={`h-full rounded-full ${barColorClass} transition-all duration-1000 ease-out`}
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>

      <div className={`px-4 py-3 rounded-lg font-semibold flex items-center justify-center w-full border ${colorClasses}`}>
        [ {category} - Skor {score}/100 ]
      </div>
      
      {label && (
        <p className="text-center text-sm text-muted mt-4 leading-relaxed">
          {label}
        </p>
      )}
    </div>
  );
}
