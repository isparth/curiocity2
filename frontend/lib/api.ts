const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface CharacterProfile {
  name: string;
  backstory: string;
  personality_traits: string[];
  speaking_style: string;
  voice_description: string;
  fun_facts: string[];
  research_summary?: string;
  canonical_facts?: string[];
  source_urls?: string[];
}

export interface IdentifyResult {
  entity: string;
  greeting: string;
  character_profile: CharacterProfile;
  voice_id: string;
}

export async function identifyObject(
  imageDataUri: string
): Promise<IdentifyResult> {
  const res = await fetch(`${API_URL}/api/identify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: imageDataUri }),
  });
  if (!res.ok) throw new Error("Failed to identify object");
  return res.json();
}

export async function chat(
  entity: string,
  characterProfile: CharacterProfile,
  conversationHistory: { role: string; text: string }[]
) {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entity,
      character_profile: characterProfile,
      conversation_history: conversationHistory,
    }),
  });
  if (!res.ok) throw new Error("Failed to get chat response");
  return res.json() as Promise<{ response: string }>;
}

export async function recharacterize(entity: string): Promise<IdentifyResult> {
  const res = await fetch(`${API_URL}/api/recharacterize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entity }),
  });
  if (!res.ok) throw new Error("Failed to regenerate character");
  return res.json();
}

export async function speechToText(audioBlob: Blob) {
  const form = new FormData();
  form.append("audio", audioBlob, "recording.webm");
  const res = await fetch(`${API_URL}/api/speech-to-text`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Failed to transcribe audio");
  return res.json() as Promise<{ transcript: string; confidence: number }>;
}

export async function textToSpeech(
  text: string,
  entity: string,
  voiceId: string
) {
  const res = await fetch(`${API_URL}/api/text-to-speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, entity, voice_id: voiceId }),
  });
  if (!res.ok) throw new Error("Failed to generate speech");
  return res.blob();
}
