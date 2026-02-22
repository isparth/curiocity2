"use client";

import { useRef, useState, useCallback, useEffect } from "react";

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const releaseTimerRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const releaseStream = useCallback(() => {
    if (releaseTimerRef.current !== null) {
      window.clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const scheduleStreamRelease = useCallback(() => {
    if (releaseTimerRef.current !== null) {
      window.clearTimeout(releaseTimerRef.current);
    }
    releaseTimerRef.current = window.setTimeout(() => {
      releaseStream();
    }, 10000);
  }, [releaseStream]);

  useEffect(() => {
    return () => {
      releaseStream();
    };
  }, [releaseStream]);

  const ensureStream = useCallback(async () => {
    if (streamRef.current && streamRef.current.active) {
      return streamRef.current;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    return stream;
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording) return;
    if (releaseTimerRef.current !== null) {
      window.clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }

    const stream = await ensureStream();
    const preferredMimeType = "audio/webm;codecs=opus";
    const mediaRecorder = MediaRecorder.isTypeSupported(preferredMimeType)
      ? new MediaRecorder(stream, { mimeType: preferredMimeType })
      : new MediaRecorder(stream);

    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.start();
    setIsRecording(true);
  }, [ensureStream, isRecording]);

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state === "inactive") {
        resolve(new Blob());
        return;
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        mediaRecorderRef.current = null;
        scheduleStreamRelease();
        resolve(blob);
      };

      mediaRecorder.stop();
      setIsRecording(false);
    });
  }, [scheduleStreamRelease]);

  return { isRecording, startRecording, stopRecording };
}
