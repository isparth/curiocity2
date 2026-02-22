"use client";

import { useState, useCallback, useRef } from "react";
import type { AppState, ChatMessage } from "@/lib/types";
import {
  identifyObject,
  recharacterize,
  chat,
  speechToText,
  textToSpeech,
  type CharacterProfile,
} from "@/lib/api";
import { useAudioRecorder } from "@/lib/useAudioRecorder";
import { useAudioPlayer } from "@/lib/useAudioPlayer";
import CameraFeed, { type CameraFeedHandle } from "./CameraFeed";
import TopBar from "./TopBar";
import LoadingOverlay from "./LoadingOverlay";
import ChatPane from "./ChatPane";

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

export default function CameraChat() {
  const [state, setState] = useState<AppState>("CAMERA_READY");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [entityName, setEntityName] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [characterProfile, setCharacterProfile] =
    useState<CharacterProfile | null>(null);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const cameraRef = useRef<CameraFeedHandle>(null);
  const loadingOverlayDoneRef = useRef(false);
  const identifyDoneRef = useRef(false);
  const processingMessageRef = useRef(false);

  // Ref to hold the identify result while the loading overlay animates
  const identifyResultRef = useRef<{
    entity: string;
    greeting: string;
    character_profile: CharacterProfile;
    voice_id: string;
  } | null>(null);

  const { startRecording, stopRecording } = useAudioRecorder();
  const { play } = useAudioPlayer();

  const speakWithBrowserVoice = useCallback(
    (text: string, voiceDescription?: string): Promise<void> => {
      return new Promise((resolve) => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
          resolve();
          return;
        }

        const desc = (voiceDescription || "").toLowerCase();
        let lang = "en-US";
        if (desc.includes("irish")) lang = "en-IE";
        else if (desc.includes("british")) lang = "en-GB";
        else if (desc.includes("australian")) lang = "en-AU";
        else if (desc.includes("indian")) lang = "en-IN";
        else if (desc.includes("french")) lang = "fr-FR";

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = desc.includes("slow") ? 0.88 : 0.95;
        utterance.pitch = desc.includes("deep") ? 0.9 : 1.0;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      });
    },
    []
  );

  const resetAll = useCallback(() => {
    setState("CAMERA_READY");
    setMessages([]);
    setEntityName(null);
    setCapturedPhoto(null);
    setCharacterProfile(null);
    setVoiceId(null);
    identifyResultRef.current = null;
    loadingOverlayDoneRef.current = false;
    identifyDoneRef.current = false;
    processingMessageRef.current = false;
  }, []);

  const maybeEnterTalkingState = useCallback(() => {
    if (!loadingOverlayDoneRef.current || !identifyDoneRef.current) return;

    const result = identifyResultRef.current;
    if (result) {
      setEntityName(result.entity);
      setCharacterProfile(result.character_profile);
      setVoiceId(result.voice_id);
      setMessages([{ id: "welcome", role: "assistant", text: result.greeting }]);
    } else {
      setEntityName("Mystery Thing");
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          text: "Hi! I'm a Mystery Thing! 🤔 Ask me anything!",
        },
      ]);
    }
    setState("TALKING_READY");
  }, []);

  const handleShutterTap = () => {
    if (state !== "CAMERA_READY") return;

    const photo = cameraRef.current?.capturePhoto() ?? null;
    setCapturedPhoto(photo);
    setState("CAPTURED_LOADING");
    loadingOverlayDoneRef.current = false;
    identifyDoneRef.current = false;
    identifyResultRef.current = null;

    // Fire off the identify call immediately (runs behind loading overlay)
    if (photo) {
      identifyObject(photo)
        .then((result) => {
          identifyResultRef.current = result;
          identifyDoneRef.current = true;
          maybeEnterTalkingState();
        })
        .catch(() => {
          identifyResultRef.current = null;
          identifyDoneRef.current = true;
          maybeEnterTalkingState();
        });
    } else {
      identifyDoneRef.current = true;
    }
  };

  const handleLoadingComplete = useCallback(() => {
    loadingOverlayDoneRef.current = true;
    maybeEnterTalkingState();
  }, [maybeEnterTalkingState]);

  const handleRenameEntity = useCallback(async () => {
    if (state === "CAPTURED_LOADING") return;
    const current = entityName || "";
    const replacement = window.prompt("Who is this really?", current);
    if (!replacement || !replacement.trim()) return;

    setState("SPEAKING");
    try {
      const result = await recharacterize(replacement.trim());
      setEntityName(result.entity);
      setCharacterProfile(result.character_profile);
      setVoiceId(result.voice_id);
      setMessages([{ id: `welcome-${Date.now()}`, role: "assistant", text: result.greeting }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: "I couldn't update my identity right now. Please try again.",
        },
      ]);
    } finally {
      setState("TALKING_READY");
    }
  }, [entityName, state]);

  // Shared pipeline: take user text, get AI reply, play TTS
  const processUserMessage = useCallback(
    async (userText: string) => {
      if (processingMessageRef.current) return;
      processingMessageRef.current = true;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        text: userText,
      };

      const entity = entityName || "Mystery Thing";
      const profile = characterProfile;
      const vid = voiceId;

      setMessages((prev) => [...prev, userMsg]);
      setState("SPEAKING");

      if (!profile) {
        setState("TALKING_READY");
        processingMessageRef.current = false;
        return;
      }

      try {
        const history = [...messages, userMsg].map((m) => ({
          role: m.role,
          text: m.text,
        }));
        const { response } = await chat(entity, profile, history);

        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: response,
        };
        setMessages((p) => [...p, assistantMsg]);

        if (vid) {
          const shouldPreferBrowserAccent =
            vid === DEFAULT_VOICE_ID &&
            /irish|british|australian|indian|french/.test(
              (profile.voice_description || "").toLowerCase()
            );

          if (shouldPreferBrowserAccent) {
            await speakWithBrowserVoice(response, profile.voice_description);
          } else {
            try {
              const audioBlob = await textToSpeech(response, entity, vid);
              await play(audioBlob);
            } catch {
              await speakWithBrowserVoice(response, profile.voice_description);
            }
          }
        }
      } catch {
        const fallback: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: "Hmm, I got confused! Can you try again?",
        };
        setMessages((p) => [...p, fallback]);
      } finally {
        setState("TALKING_READY");
        processingMessageRef.current = false;
      }
    },
    [entityName, characterProfile, voiceId, play, messages, speakWithBrowserVoice]
  );

  const handleMicTap = async () => {
    if (state === "LISTENING") {
      // Stop recording and process
      const blob = await stopRecording();
      setState("SPEAKING");

      try {
        const { transcript } = await speechToText(blob);
        if (transcript) {
          await processUserMessage(transcript);
        } else {
          setState("TALKING_READY");
        }
      } catch {
        setState("TALKING_READY");
      }
    } else if (state === "TALKING_READY") {
      // Start recording
      try {
        await startRecording();
        setState("LISTENING");
      } catch {
        // Mic permission denied or unavailable
      }
    }
  };

  const handleTextSubmit = useCallback(
    async (text: string) => {
      if (state !== "TALKING_READY" || !text.trim()) return;
      await processUserMessage(text.trim());
    },
    [state, processUserMessage]
  );

  const showLiveCamera = state === "CAMERA_READY";
  const showLoading = state === "CAPTURED_LOADING";
  const showChat =
    state === "TALKING_READY" ||
    state === "LISTENING" ||
    state === "SPEAKING";

  return (
    <div className="fixed inset-0 bg-navy font-nunito overflow-hidden">
      <CameraFeed
        ref={cameraRef}
        showLiveCamera={showLiveCamera}
        capturedPhoto={capturedPhoto}
      />

      <TopBar
        entityName={entityName}
        onRestart={resetAll}
        onRename={showChat ? handleRenameEntity : undefined}
        showRestart={!showLiveCamera}
      />

      {state === "CAMERA_READY" && (
        <div className="fixed inset-0 z-10 flex items-end justify-center pb-16">
          <button
            onClick={handleShutterTap}
            className="w-20 h-20 rounded-full border-4 border-white/80 flex items-center justify-center active:scale-90 transition-transform"
            aria-label="Take photo"
          >
            <span className="w-16 h-16 rounded-full bg-white/90 block" />
          </button>
        </div>
      )}

      {showLoading && <LoadingOverlay onComplete={handleLoadingComplete} />}

      {showChat && (
        <ChatPane
          messages={messages}
          state={state}
          onMicTap={handleMicTap}
          onRetake={resetAll}
          onTextSubmit={handleTextSubmit}
        />
      )}
    </div>
  );
}
