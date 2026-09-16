'use client';

import { useState } from 'react';

interface TextInputProps {
  onSubmit: (query: string) => void;
  disabled?: boolean;
}

export default function TextInput({ onSubmit, disabled = false }: TextInputProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (value.trim() && !disabled) {
      onSubmit(value.trim());
      setValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form 
      onSubmit={handleSubmit}
      className="flex flex-row items-center gap-2 w-full max-w-4xl"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Ketik pertanyaan Anda di sini... (contoh: analisis BBCA)"
        aria-label="Kotak input teks untuk pertanyaan"
        className="flex-1 min-h-12 min-w-12 bg-surface border-2 border-surface-light rounded-xl px-4 py-3 text-lg text-foreground placeholder:text-muted focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      />
      
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        aria-label="Kirim pertanyaan"
        className="min-h-12 min-w-12 px-6 flex items-center justify-center bg-accent text-white rounded-xl hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="currentColor" 
          className="w-6 h-6"
          aria-hidden="true"
        >
          <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
        </svg>
      </button>
    </form>
  );
}
