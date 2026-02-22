from pydantic import BaseModel


class CharacterProfile(BaseModel):
    name: str
    backstory: str
    personality_traits: list[str]
    speaking_style: str
    voice_description: str
    fun_facts: list[str]


class IdentifyRequest(BaseModel):
    image: str  # data:image/jpeg;base64,...


class IdentifyResponse(BaseModel):
    entity: str
    greeting: str
    character_profile: CharacterProfile
    voice_id: str
    research_model: str | None = None
    personification_model: str | None = None


class ConversationMessage(BaseModel):
    role: str  # "user" or "assistant"
    text: str


class ChatRequest(BaseModel):
    entity: str
    character_profile: CharacterProfile
    conversation_history: list[ConversationMessage]


class ChatResponse(BaseModel):
    response: str


class SpeechToTextResponse(BaseModel):
    transcript: str
    confidence: float


class TextToSpeechRequest(BaseModel):
    text: str
    entity: str
    voice_id: str
