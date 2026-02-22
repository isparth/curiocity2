"use client";

import { useRef, useState, useCallback } from "react";

export function useAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const clearSpeechSynthesis = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
  }, []);

  const play = useCallback((blob: Blob): Promise<void> => {
    return new Promise((resolve) => {
      clearSpeechSynthesis();

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      setIsPlaying(true);

      audio.onended = () => {
        URL.revokeObjectURL(url);
        objectUrlRef.current = null;
        setIsPlaying(false);
        resolve();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        objectUrlRef.current = null;
        setIsPlaying(false);
        resolve();
      };

      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          URL.revokeObjectURL(url);
          objectUrlRef.current = null;
          setIsPlaying(false);
          resolve();
        });
      }
    });
  }, [clearSpeechSynthesis]);

  const speakText = useCallback(
    (text: string): Promise<void> => {
      return new Promise((resolve) => {
        const message = text.trim();
        if (!message) {
          resolve();
          return;
        }
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
          resolve();
          return;
        }

        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current = null;
        }
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = null;
        }

        clearSpeechSynthesis();

        const utterance = new SpeechSynthesisUtterance(message);
        utteranceRef.current = utterance;
        setIsPlaying(true);

        utterance.onend = () => {
          if (utteranceRef.current === utterance) {
            utteranceRef.current = null;
          }
          setIsPlaying(false);
          resolve();
        };
        utterance.onerror = () => {
          if (utteranceRef.current === utterance) {
            utteranceRef.current = null;
          }
          setIsPlaying(false);
          resolve();
        };

        window.speechSynthesis.speak(utterance);
      });
    },
    [clearSpeechSynthesis]
  );

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    clearSpeechSynthesis();
    setIsPlaying(false);
  }, [clearSpeechSynthesis]);

  return { isPlaying, play, speakText, stop };
}
