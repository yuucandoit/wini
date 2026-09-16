'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';

interface AudioPlayerProps {
  text: string;
  onSpeakingChange?: (isSpeaking: boolean) => void;
}

export default function AudioPlayer({ text, onSpeakingChange }: AudioPlayerProps) {
  const {
    isSupported,
    isSpeaking,
    speak,
    cancel
  } = useSpeechSynthesis({
    lang: 'id-ID',
    onEnd: () => {
      onSpeakingChange?.(false);
    }
  });

  const containerRef = useRef<HTMLElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setIsPlaying(isSpeaking);
    onSpeakingChange?.(isSpeaking);
  }, [isSpeaking, onSpeakingChange]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      cancel();
      setIsPlaying(false);
    } else {
      speak(text);
      setIsPlaying(true);
    }
  }, [isPlaying, cancel, speak, text]);

  const handleReplay = useCallback(() => {
    cancel();
    setIsPlaying(false);
    // Small delay to ensure cancel finishes before speaking again
    setTimeout(() => {
      speak(text);
      setIsPlaying(true);
    }, 100);
  }, [cancel, speak, text]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      togglePlayPause();
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      handleReplay();
    }
  };

  if (!isSupported) {
    return (
      <section 
        role="region" 
        aria-label="Pemutar audio hasil analisis"
        className="bg-surface rounded-xl p-6"
      >
        <p className="text-muted text-center font-medium">Text-to-Speech tidak tersedia di browser ini</p>
      </section>
    );
  }

  return (
    <section 
      ref={containerRef}
      role="region" 
      aria-label="Pemutar audio hasil analisis"
      className="bg-surface rounded-xl p-6 flex flex-col items-center gap-4 animate-fade-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <h3 className="text-lg font-semibold text-foreground">🔊 Dengarkan Rangkuman</h3>
      
      <div className="flex flex-row items-center justify-center gap-4">
        <button 
          onClick={togglePlayPause}
          className="min-h-12 min-w-12 px-6 flex items-center justify-center bg-accent text-white rounded-full hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent transition-all text-xl"
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button 
          onClick={handleReplay}
          className="min-h-12 min-w-12 px-6 flex items-center justify-center bg-surface text-foreground border-2 border-accent rounded-full hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent transition-all text-xl"
          aria-label="Replay audio dari awal"
        >
          🔄
        </button>
      </div>
      
      <p className="text-muted text-sm mt-2 text-center">
        Spasi = Play/Pause, R = Replay
      </p>
    </section>
  );
}
