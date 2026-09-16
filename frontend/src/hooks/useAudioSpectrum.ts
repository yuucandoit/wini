"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useAudioSpectrum
 *
 * Captures real-time microphone amplitude via Web Audio API (AudioContext +
 * AnalyserNode). Returns a normalized bar-heights array [0..1] that can drive
 * a visual spectrum/equalizer component.
 */

export interface UseAudioSpectrumOptions {
  /** Number of equalizer bars. Defaults to 8 */
  bars?: number;
  /** FFT size (must be power of 2). Defaults to 256 */
  fftSize?: number;
  /** Smoothing time constant 0-1. Defaults to 0.75 */
  smoothingTimeConstant?: number;
}

export interface UseAudioSpectrumReturn {
  /** Normalized bar heights, each in [0, 1] */
  barHeights: number[];
  /** Whether the analyser is currently active */
  isActive: boolean;
  /** Start capturing microphone and updating barHeights */
  startSpectrum: () => Promise<void>;
  /** Stop capturing and release mic */
  stopSpectrum: () => void;
}

export function useAudioSpectrum(
  options: UseAudioSpectrumOptions = {}
): UseAudioSpectrumReturn {
  const { bars = 8, fftSize = 256, smoothingTimeConstant = 0.75 } = options;

  const [isActive, setIsActive] = useState(false);
  const [barHeights, setBarHeights] = useState<number[]>(Array(bars).fill(0));

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try { audioCtxRef.current?.close(); } catch { /* ignore */ }
    };
  }, []);

  const startSpectrum = useCallback(async () => {
    if (isActive) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (!isMountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioContextClass = (window as any).AudioContext ?? (window as any).webkitAudioContext;
      const ctx: AudioContext = new AudioContextClass();
      audioCtxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = fftSize;
      analyser.smoothingTimeConstant = smoothingTimeConstant;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      setIsActive(true);

      const tick = () => {
        if (!isMountedRef.current || !analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        const step = Math.max(1, Math.floor(bufferLength / bars));
        const heights: number[] = [];
        for (let b = 0; b < bars; b++) {
          let sum = 0;
          for (let s = 0; s < step; s++) {
            sum += dataArray[b * step + s] ?? 0;
          }
          // Normalize [0,255] -> [0,1], scale factor 180 for visual comfort
          heights.push(Math.min(1, (sum / step) / 180));
        }
        setBarHeights(heights);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.warn("useAudioSpectrum: getUserMedia failed", err);
    }
  }, [isActive, bars, fftSize, smoothingTimeConstant]);

  const stopSpectrum = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try { sourceRef.current?.disconnect(); } catch { /* ignore */ }
    sourceRef.current = null;
    try { audioCtxRef.current?.close(); } catch { /* ignore */ }
    audioCtxRef.current = null;
    analyserRef.current = null;
    setIsActive(false);
    setBarHeights(Array(bars).fill(0));
  }, [bars]);

  return { barHeights, isActive, startSpectrum, stopSpectrum };
}
