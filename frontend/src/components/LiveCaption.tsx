'use client';

import { useEffect, useRef } from 'react';

interface LiveCaptionProps {
  text: string;
  isActive: boolean;
}

export default function LiveCaption({ text, isActive }: LiveCaptionProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [text, isActive]);

  if (!isActive && !text) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 p-4 flex justify-center pointer-events-none">
      <div 
        role="log"
        aria-live="polite"
        aria-label="Live caption"
        className="w-full max-w-4xl bg-surface/90 backdrop-blur-sm text-foreground text-lg md:text-xl p-4 md:p-6 rounded-t-2xl shadow-lg border-t-2 border-l-2 border-r-2 border-surface-light max-h-32 overflow-y-auto pointer-events-auto"
      >
        {text ? (
          <p className="leading-relaxed whitespace-pre-wrap">{text}</p>
        ) : (
          <div className="flex items-center gap-2 text-muted">
            <span className="animate-pulse">●</span>
            <span className="animate-pulse delay-75">●</span>
            <span className="animate-pulse delay-150">●</span>
            <span className="ml-2">Mendengarkan...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
