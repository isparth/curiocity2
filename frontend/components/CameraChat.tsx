"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
  research_model?: string;
  personification_model?: string;
};

export default function CameraChat() {
  const [state, setState] = useState<AppState>("CAMERA_READY");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [entityName, setEntityName] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [characterProfile, setCharacterProfile] =
    useState<CharacterProfile | null>(null);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [researchModel, setResearchModel] = useState<string | null>(null);
  const [personificationModel, setPersonificationModel] = useState<string | null>(null);
  const cameraRef = useRef<CameraFeedHandle>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  // Hold the identify request result while loading animation plays.
  const identifyResultRef = useRef<IdentifyResult | null>(null);
  const identifyPromiseRef = useRef<Promise<IdentifyResult | null> | null>(null);
  const loadingCompletionStartedRef = useRef(false);
  const greetingPlaybackSeqRef = useRef(0);

  const { startRecording, stopRecording } = useAudioRecorder();
  const { play, speakText } = useAudioPlayer();

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const resetAll = useCallback(() => {
    greetingPlaybackSeqRef.current += 1;
    setState("CAMERA_READY");
    setMessages([]);
    setEntityName(null);
    setCapturedPhoto(null);
    setCharacterProfile(null);
    setVoiceId(null);
    setResearchModel(null);
    setPersonificationModel(null);
    messagesRef.current = [];
    identifyResultRef.current = null;
    identifyPromiseRef.current = null;
    loadingCompletionStartedRef.current = false;
  }, []);

  const handleShutterTap = () => {
    if (state !== "CAMERA_READY") return;

    const photo = cameraRef.current?.capturePhoto() ?? null;
    setCapturedPhoto(photo);
    setState("CAPTURED_LOADING");

    identifyResultRef.current = null;
    loadingCompletionStartedRef.current = false;

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
    if (loadingCompletionStartedRef.current) return;
    loadingCompletionStartedRef.current = true;

    const identifyPromise = identifyPromiseRef.current;
    const result = identifyPromise
      ? await identifyPromise
      : identifyResultRef.current;

    identifyPromiseRef.current = null;

    if (result) {
      setEntityName(result.entity);
      setCharacterProfile(result.character_profile);
      setVoiceId(result.voice_id);
      setResearchModel(result.research_model || null);
      setPersonificationModel(result.personification_model || null);
      const welcomeMessages: ChatMessage[] = [
        { id: "welcome", role: "assistant", text: result.greeting },
      ];
      messagesRef.current = welcomeMessages;
      setMessages(welcomeMessages);

      setState("TALKING_READY");

      if (result.greeting.trim()) {
        const playbackSeq = greetingPlaybackSeqRef.current + 1;
        greetingPlaybackSeqRef.current = playbackSeq;

        void (async () => {
          if (greetingPlaybackSeqRef.current !== playbackSeq) return;
          setState("SPEAKING");
          try {
            if (result.voice_id) {
              const greetingAudio = await textToSpeech(
                result.greeting,
                result.entity,
                result.voice_id
              );
              if (greetingPlaybackSeqRef.current !== playbackSeq) return;
              await play(greetingAudio);
            } else {
              await speakText(result.greeting);
            }
          } catch {
            await speakText(result.greeting);
          } finally {
            if (greetingPlaybackSeqRef.current === playbackSeq) {
              setState("TALKING_READY");
            }
          }
        })();
      }
      return;
    } else {
      setEntityName("Mystery Thing");
      setResearchModel("fallback");
      setPersonificationModel("fallback");
      const fallbackMessages: ChatMessage[] = [
        {
          id: "welcome",
          role: "assistant",
          text: "Hi! I'm a Mystery Thing! 🤔 Ask me anything!",
        },
      ];
      messagesRef.current = fallbackMessages;
      setMessages(fallbackMessages);
    }
    setState("TALKING_READY");
  }, [play, speakText]);

  // Shared pipeline: take user text, get AI reply, play TTS
  const processUserMessage = useCallback(
    async (userText: string) => {
      const trimmedUserText = userText.trim();
      if (!trimmedUserText) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        text: trimmedUserText,
      };

      const updatedMessages = [...messagesRef.current, userMsg];
      messagesRef.current = updatedMessages;
      setMessages(updatedMessages);

      const entity = entityName || "Mystery Thing";
      const profile = characterProfile;
      const vid = voiceId;

      setState("SPEAKING");

      if (!profile) {
        setState("TALKING_READY");
        return;
      }

      const history = updatedMessages
        .slice(-12)
        .map((m) => ({ role: m.role, text: m.text }));

      try {
        const { response } = await chat(entity, profile, history);
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: response,
        };
        messagesRef.current = [...messagesRef.current, assistantMsg];
        setMessages(messagesRef.current);

        try {
          if (vid) {
            const audioBlob = await textToSpeech(response, entity, vid);
            await play(audioBlob);
          } else {
            await speakText(response);
          }
        } catch {
          await speakText(response);
        }
      } catch {
        const fallback: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: "Hmm, I got confused! Can you try again?",
        };
        messagesRef.current = [...messagesRef.current, fallback];
        setMessages(messagesRef.current);
      } finally {
        setState("TALKING_READY");
      }
    },
    [entityName, characterProfile, voiceId, play, speakText]
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
      if (state !== "TALKING_READY") return;
      await processUserMessage(text);
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

      {(researchModel || personificationModel) && (
        <div className="fixed right-3 top-3 z-40 pointer-events-none text-[10px] leading-tight text-white/45 text-right">
          <div>research: {researchModel || "n/a"}</div>
          <div>personify: {personificationModel || "n/a"}</div>
        </div>
      )}

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
