"use client";

import { useEffect, useRef, useState } from "react";
import type { AppState, ChatMessage } from "@/lib/types";
import MicButton from "./MicButton";

interface ChatPaneProps {
  messages: ChatMessage[];
  state: AppState;
  onMicTap: () => void;
  onRetake: () => void;
  onTextSubmit: (text: string) => void;
}

export default function ChatPane({
  messages,
  state,
  onMicTap,
  onRetake,
  onTextSubmit,
}: ChatPaneProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [inputText, setInputText] = useState("");

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = () => {
    if (!inputText.trim()) return;
    onTextSubmit(inputText);
    setInputText("");
    setShowTextInput(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 animate-slide-up">
      {/* Chat messages area */}
      <div
        ref={scrollRef}
        className="px-4 pb-2 max-h-[35vh] overflow-y-auto"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0%, black 16px)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, black 16px)",
        }}
      >
        <div className="space-y-3 py-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl font-nunito text-sm ${
                  msg.role === "user"
                    ? "bg-teal/20 border border-teal/30 text-white"
                    : "glass text-white/90"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {/* Speaking indicator */}
          {state === "SPEAKING" && (
            <div className="flex justify-start">
              <div className="glass px-4 py-3 rounded-2xl">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-teal rounded-full animate-bounce" />
                  <span
                    className="w-2 h-2 bg-teal rounded-full animate-bounce"
                    style={{ animationDelay: "0.15s" }}
                  />
                  <span
                    className="w-2 h-2 bg-teal rounded-full animate-bounce"
                    style={{ animationDelay: "0.3s" }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Text input bar (slide up when active) */}
      {showTextInput && (
        <div className="px-4 pb-2 animate-slide-up">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="glass flex items-center gap-2 px-4 py-2 rounded-full"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-transparent text-white font-nunito text-sm outline-none placeholder:text-white/40"
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowTextInput(false);
              }}
              autoFocus
            />
            <button
              type="submit"
              disabled={!inputText.trim() || state !== "TALKING_READY"}
              className="text-teal text-sm px-2 font-semibold disabled:opacity-40"
            >
              Send
            </button>
            <button
              type="button"
              onClick={() => setShowTextInput(false)}
              className="text-white/50 text-sm px-2"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Bottom dock */}
      <div className="glass-heavy rounded-t-2xl rounded-b-none border-b-0 px-6 py-4 pb-8">
        <div className="flex items-center justify-between">
          {/* Retake button */}
          <button
            onClick={onRetake}
            className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            aria-label="Retake photo"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-70"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>

          {/* Mic button */}
          <MicButton
            listening={state === "LISTENING"}
            disabled={state === "SPEAKING"}
            onClick={onMicTap}
          />

          {/* Keyboard button */}
          <button
            onClick={() => setShowTextInput(!showTextInput)}
            className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            aria-label="Type a message"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-70"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <line x1="6" y1="8" x2="6" y2="8" />
              <line x1="10" y1="8" x2="10" y2="8" />
              <line x1="14" y1="8" x2="14" y2="8" />
              <line x1="18" y1="8" x2="18" y2="8" />
              <line x1="6" y1="12" x2="6" y2="12" />
              <line x1="10" y1="12" x2="10" y2="12" />
              <line x1="14" y1="12" x2="14" y2="12" />
              <line x1="18" y1="12" x2="18" y2="12" />
              <line x1="7" y1="16" x2="17" y2="16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
