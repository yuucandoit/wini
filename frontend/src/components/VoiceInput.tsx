'use client';

interface VoiceInputProps {
  isListening: boolean;
  isSupported: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
}

export default function VoiceInput({
  isListening,
  isSupported,
  onStartListening,
  onStopListening
}: VoiceInputProps) {
  if (!isSupported) {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <button
        onClick={isListening ? onStopListening : onStartListening}
        aria-label={isListening ? "Hentikan mendengarkan" : "Mulai mendengarkan"}
        className={`w-24 h-24 min-w-12 min-h-12 rounded-full flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-background ${
          isListening
            ? 'bg-danger text-white animate-recording-pulse'
            : 'bg-surface border-4 border-accent text-accent hover:bg-accent/10'
        }`}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="currentColor" 
          className="w-10 h-10"
          aria-hidden="true"
        >
          <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
          <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
        </svg>
      </button>
      
      <span className={`text-lg font-medium ${isListening ? 'text-danger' : 'text-accent'}`}>
        {isListening ? 'Mendengarkan...' : 'Tekan untuk Berbicara'}
      </span>
    </div>
  );
}
