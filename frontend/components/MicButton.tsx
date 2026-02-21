"use client";

interface MicButtonProps {
  listening: boolean;
  disabled: boolean;
  onClick: () => void;
}

export default function MicButton({ listening, disabled, onClick }: MicButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="relative w-20 h-20 flex items-center justify-center rounded-full flex-shrink-0"
      aria-label={listening ? "Listening..." : "Start talking"}
    >
      {/* Pulse rings when listening */}
      {listening && (
        <>
          <span className="absolute inset-0 rounded-full bg-teal/30 animate-pulse-ring" />
          <span
            className="absolute inset-0 rounded-full bg-teal/20 animate-pulse-ring"
            style={{ animationDelay: "0.5s" }}
          />
        </>
      )}

      {/* Main button */}
      <span
        className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
          listening
            ? "bg-teal shadow-[0_0_30px_rgba(0,212,170,0.5)]"
            : "bg-gradient-to-br from-teal to-emerald-600 shadow-lg"
        } ${disabled ? "opacity-50" : "active:scale-95"}`}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="1" width="6" height="12" rx="3" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </span>
    </button>
  );
}
