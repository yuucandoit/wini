'use client';

import React from 'react';

interface FormattedMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Helper to parse inline markdown (bold **text**, italic *text*, links) into React elements.
 */
function parseInlineMarkdown(text: string): React.ReactNode[] {
  // Regex to match **bold** or *italic*
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const boldText = part.slice(2, -2);
      return (
        <strong key={idx} className="text-cyan-300 font-semibold tracking-wide">
          {boldText}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      const italicText = part.slice(1, -1);
      return (
        <em key={idx} className="text-slate-100 italic">
          {italicText}
        </em>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

export default function FormattedMarkdown({ content, className = '' }: FormattedMarkdownProps) {
  if (!content) return null;

  // Split by double line breaks into logical paragraphs / blocks
  const blocks = content.split(/\n\s*\n/);

  return (
    <div className={`space-y-4 text-slate-200 text-sm sm:text-base leading-relaxed ${className}`}>
      {blocks.map((block, bIdx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // 1. Disclaimer Block
        if (trimmed.includes('Disclaimer') || trimmed.startsWith('⚠️')) {
          return (
            <div
              key={bIdx}
              role="note"
              aria-label="Catatan Kepatuhan Investasi"
              className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs sm:text-sm flex items-start gap-3"
            >
              <span className="text-lg shrink-0 select-none">⚠️</span>
              <p className="leading-relaxed">
                {parseInlineMarkdown(trimmed.replace(/^⚠️\s*/, ''))}
              </p>
            </div>
          );
        }

        // 2. Headings (e.g. ### Header or **Header**)
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={bIdx} className="text-lg sm:text-xl font-bold text-cyan-400 mt-4 mb-1">
              {parseInlineMarkdown(trimmed.replace(/^###\s+/, ''))}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={bIdx} className="text-xl sm:text-2xl font-bold text-white mt-5 mb-2">
              {parseInlineMarkdown(trimmed.replace(/^##\s+/, ''))}
            </h3>
          );
        }

        // 3. Bullet list block
        const lines = trimmed.split('\n');
        const isBulletList = lines.every((line) => line.trim().startsWith('- ') || line.trim().startsWith('* '));
        if (isBulletList) {
          return (
            <ul key={bIdx} className="space-y-2 my-2 pl-2">
              {lines.map((line, lIdx) => (
                <li key={lIdx} className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 shrink-0"></span>
                  <div>{parseInlineMarkdown(line.replace(/^[-*]\s+/, ''))}</div>
                </li>
              ))}
            </ul>
          );
        }

        // 4. Standard paragraph
        return (
          <p key={bIdx} className="text-slate-200">
            {parseInlineMarkdown(trimmed)}
          </p>
        );
      })}
    </div>
  );
}
