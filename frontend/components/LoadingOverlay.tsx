"use client";

import { useEffect, useState } from "react";

interface LoadingOverlayProps {
  onComplete: () => void | Promise<void>;
}

const STEPS = [
  {
    label: "Looking...",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      </svg>
    ),
  },
  {
    label: "Finding my name...",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
      </svg>
    ),
  },
  {
    label: "Getting my voice ready...",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      </svg>
    ),
  },
];

function Spinner() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" className="animate-spin-slow">
      <circle cx="10" cy="10" r="8" stroke="rgba(255,255,255,0.2)" strokeWidth="2" fill="none" />
      <path d="M10 2a8 8 0 0 1 8 8" stroke="#00d4aa" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function Checkmark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" fill="#00d4aa" />
      <path d="M6 10l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function LoadingOverlay({ onComplete }: LoadingOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStep((step) => Math.min(step + 1, STEPS.length - 1));
    }, 700);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    void Promise.resolve(onComplete()).catch(() => {
      // Parent handles fallback state transitions.
    });
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center px-6 animate-fade-in">
      <div className="glass-heavy relative overflow-hidden p-8 w-full max-w-xs rounded-2xl">
        {/* Scanning pulse background */}
        <div className="absolute inset-0 bg-teal/5 animate-scanning-pulse rounded-2xl" />

        <div className="relative">
          <h2 className="text-white text-xl font-nunito font-bold text-center mb-6">
            Who am I?
          </h2>

          <div className="space-y-4">
            {STEPS.map((step, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 transition-opacity duration-300 ${
                  i > currentStep ? "opacity-30" : "opacity-100"
                }`}
              >
                <span className="text-white/70 flex-shrink-0">{step.icon}</span>
                <span className="text-white/90 font-nunito text-sm flex-1">
                  {step.label}
                </span>
                <span className="flex-shrink-0">
                  {i < currentStep ? (
                    <Checkmark />
                  ) : i === currentStep ? (
                    <Spinner />
                  ) : (
                    <div className="w-5 h-5" />
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
