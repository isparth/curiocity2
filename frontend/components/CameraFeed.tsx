"use client";

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";

interface CameraFeedProps {
  capturedPhoto: string | null;
  showLiveCamera: boolean;
}

export interface CameraFeedHandle {
  capturePhoto: () => string | null;
}

const CameraFeed = forwardRef<CameraFeedHandle, CameraFeedProps>(
  function CameraFeed({ capturedPhoto, showLiveCamera }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Start/stop camera based on showLiveCamera
    useEffect(() => {
      if (!showLiveCamera) {
        // Stop the stream when not needed
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        return;
      }

      let cancelled = false;

      async function startCamera() {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch {
          // Camera not available — leave the fallback gradient visible
        }
      }

      startCamera();

      return () => {
        cancelled = true;
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      };
    }, [showLiveCamera]);

    // Expose capture method to parent
    useImperativeHandle(ref, () => ({
      capturePhoto: () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return null;

        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", 0.85);
      },
    }));

    return (
      <div className="fixed inset-0">
        {/* Fallback gradient (always behind) */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, #1a2a4a 0%, #0d3b2e 30%, #1a3a2a 60%, #2a1a3a 100%)",
          }}
        />

        {/* Live camera video */}
        {showLiveCamera && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Captured photo (frozen frame) */}
        {capturedPhoto && (
          <img
            src={capturedPhoto}
            alt="Captured"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Aim helper circle — only when live camera is on */}
        {showLiveCamera && !capturedPhoto && (
          <div
            className="absolute left-1/2 top-1/2 animate-aim-pulse"
            style={{ width: 160, height: 160 }}
          >
            <svg width="160" height="160" viewBox="0 0 160 160" fill="none">
              <circle
                cx="80"
                cy="80"
                r="76"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1.5"
                strokeDasharray="12 8"
              />
              <path d="M40 20 H20 V40" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" />
              <path d="M120 20 H140 V40" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" />
              <path d="M40 140 H20 V120" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" />
              <path d="M120 140 H140 V120" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" />
              <circle cx="80" cy="80" r="3" fill="rgba(255,255,255,0.5)" />
            </svg>
          </div>
        )}

        {/* Slight dim overlay when chatting over the photo */}
        {capturedPhoto && (
          <div className="absolute inset-0 bg-black/20" />
        )}
      </div>
    );
  }
);

export default CameraFeed;
