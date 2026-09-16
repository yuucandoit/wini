'use client';

import React from 'react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import VoiceInput from '@/components/VoiceInput';
import TextInput from '@/components/TextInput';

interface DualInputProps {
  onSubmit: (query: string) => void;
  disabled?: boolean;
}

export default function DualInput({ onSubmit, disabled = false }: DualInputProps) {
  const {
    isSupported,
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({
    lang: 'id-ID',
    onResult: (resultTranscript: string) => {
      if (resultTranscript.trim()) {
        onSubmit(resultTranscript);
      }
    }
  });

  return (
    <section 
      aria-label="Area input" 
      className="w-full max-w-3xl mx-auto flex flex-col items-center gap-8 animate-fade-in"
    >
      <h2 className="text-2xl font-semibold text-foreground text-center">
        Apa yang ingin Anda analisis?
      </h2>

      <div className="w-full flex flex-col items-center gap-6">
        <VoiceInput 
          isSupported={isSupported}
          isListening={isListening}
          onStartListening={startListening}
          onStopListening={stopListening}
        />
        
        <div className="flex items-center w-full max-w-md gap-4" aria-hidden="true">
          <div className="h-px bg-surface-light flex-1"></div>
          <span className="text-muted text-sm font-medium uppercase tracking-wider">atau</span>
          <div className="h-px bg-surface-light flex-1"></div>
        </div>
        
        <div className="w-full">
          <TextInput 
            onSubmit={onSubmit}
            disabled={disabled || isListening}
          />
        </div>
      </div>
    </section>
  );
}
