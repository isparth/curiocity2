from pydantic import BaseModel, Field


class CharacterProfile(BaseModel):
    name: str
    backstory: str
    personality_traits: list[str]
    speaking_style: str
    voice_description: str
    fun_facts: list[str]
    research_summary: str = ""
    canonical_facts: list[str] = Field(default_factory=list)
    source_urls: list[str] = Field(default_factory=list)


class IdentifyRequest(BaseModel):
    image: str  # data:image/jpeg;base64,...


class IdentifyResponse(BaseModel):
    entity: str
    greeting: str
    character_profile: CharacterProfile
    voice_id: str


class RecharacterizeRequest(BaseModel):
    entity: str


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
