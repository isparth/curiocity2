export type AppState =
  | "CAMERA_READY"
  | "CAPTURED_LOADING"
  | "TALKING_READY"
  | "LISTENING"
  | "SPEAKING";

export type MessageRole = "assistant" | "user";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
}
