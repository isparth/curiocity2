"use client";

import { useState, useCallback, useRef } from "react";
import type { AppState, ChatMessage } from "@/lib/types";
import {
  identifyObject,
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

type IdentifyResult = {
  entity: string;
  greeting: string;
  character_profile: CharacterProfile;
  voice_id: string;
};

export default function CameraChat() {
  const [state, setState] = useState<AppState>("CAMERA_READY");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [entityName, setEntityName] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [characterProfile, setCharacterProfile] =
    useState<CharacterProfile | null>(null);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const cameraRef = useRef<CameraFeedHandle>(null);

  // Hold the identify request result while loading animation plays.
  const identifyResultRef = useRef<IdentifyResult | null>(null);
  const identifyPromiseRef = useRef<Promise<IdentifyResult | null> | null>(null);

  const { startRecording, stopRecording } = useAudioRecorder();
  const { play } = useAudioPlayer();

  const resetAll = useCallback(() => {
    setState("CAMERA_READY");
    setMessages([]);
    setEntityName(null);
    setCapturedPhoto(null);
    setCharacterProfile(null);
    setVoiceId(null);
    identifyResultRef.current = null;
    identifyPromiseRef.current = null;
  }, []);

  const handleShutterTap = () => {
    if (state !== "CAMERA_READY") return;

    const photo = cameraRef.current?.capturePhoto() ?? null;
    setCapturedPhoto(photo);
    setState("CAPTURED_LOADING");

    identifyResultRef.current = null;

    // Fire off identify immediately; loading completion waits on this promise.
    if (photo) {
      identifyPromiseRef.current = identifyObject(photo)
        .then((result) => {
          identifyResultRef.current = result;
          return result;
        })
        .catch(() => {
          identifyResultRef.current = null;
          return null;
        });
    } else {
      identifyPromiseRef.current = Promise.resolve(null);
    }
  };

  const handleLoadingComplete = useCallback(async () => {
    const identifyPromise = identifyPromiseRef.current;
    const result = identifyPromise
      ? await identifyPromise
      : identifyResultRef.current;

    identifyPromiseRef.current = null;

    if (result) {
      setEntityName(result.entity);
      setCharacterProfile(result.character_profile);
      setVoiceId(result.voice_id);
      setMessages([
        { id: "welcome", role: "assistant", text: result.greeting },
      ]);
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

  // Shared pipeline: take user text, get AI reply, play TTS
  const processUserMessage = useCallback(
    async (userText: string) => {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        text: userText,
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);

      const entity = entityName || "Mystery Thing";
      const profile = characterProfile;
      const vid = voiceId;

      setState("SPEAKING");

      if (!profile) {
        setState("TALKING_READY");
        return;
      }

      const history = updatedMessages.map((m) => ({ role: m.role, text: m.text }));

      try {
        const { response } = await chat(entity, profile, history);
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: response,
        };
        setMessages((p) => [...p, assistantMsg]);

        if (vid) {
          try {
            const audioBlob = await textToSpeech(response, entity, vid);
            await play(audioBlob);
          } catch {
            // TTS failed — still show the text response
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
      }
    },
    [messages, entityName, characterProfile, voiceId, play]
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
