import logging

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.config import settings
from app.models.schemas import (
    CharacterProfile,
    IdentifyRequest,
    IdentifyResponse,
    RecharacterizeRequest,
    ChatRequest,
    ChatResponse,
    SpeechToTextResponse,
    TextToSpeechRequest,
)
from app.services.gemini_service import (
    identify_research_and_create,
    create_character_from_entity,
    generate_chat_response,
)
from app.services.deepgram_service import transcribe
from app.services.elevenlabs_service import generate_speech

app = FastAPI(title="CurioCity API")
logger = logging.getLogger(__name__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/identify", response_model=IdentifyResponse)
async def identify(req: IdentifyRequest):
    try:
        result = await identify_research_and_create(req.image)
        return result
    except Exception:
        logger.exception("Identify pipeline failed; returning fallback profile")
        fallback_profile = CharacterProfile(
            name="Mystery Thing",
            backstory="I'm a mystery! Nobody knows where I came from, but I love making new friends and learning about the world.",
            personality_traits=["curious", "friendly", "silly", "adventurous", "kind"],
            speaking_style="Speaks with wonder and excitement, asks lots of questions back.",
            voice_description="A friendly, curious young voice full of energy and wonder",
            fun_facts=["I love surprises!", "Everything is an adventure!", "I make friends everywhere I go!"],
            research_summary="A mystery object with unknown origins, designed to keep kids curious and exploring.",
            canonical_facts=["Its exact identity is unknown.", "It loves curiosity and questions."],
            source_urls=[],
        )
        return IdentifyResponse(
            entity="Mystery Thing",
            greeting="Hi! I'm a Mystery Thing! 🤔 Ask me anything!",
            character_profile=fallback_profile,
            voice_id=settings.elevenlabs_voice_id,
        )


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    response = await generate_chat_response(
        req.character_profile, req.conversation_history[-10:]
    )
    return ChatResponse(response=response)


@app.post("/api/recharacterize", response_model=IdentifyResponse)
async def recharacterize(req: RecharacterizeRequest):
    try:
        entity = req.entity.strip()
        if not entity:
            raise ValueError("entity is required")
        return await create_character_from_entity(entity)
    except Exception:
        logger.exception("Recharacterize failed; returning fallback profile")
        fallback_profile = CharacterProfile(
            name=req.entity.strip() or "Mystery Thing",
            backstory="I'm a mystery! Nobody knows where I came from, but I love making new friends and learning about the world.",
            personality_traits=["curious", "friendly", "silly", "adventurous", "kind"],
            speaking_style="Speaks with wonder and excitement, asks lots of questions back.",
            voice_description="A friendly, curious young voice full of energy and wonder",
            fun_facts=["I love surprises!", "Everything is an adventure!", "I make friends everywhere I go!"],
            research_summary="A mystery object with unknown origins, designed to keep kids curious and exploring.",
            canonical_facts=["Its exact identity is unknown.", "It loves curiosity and questions."],
            source_urls=[],
        )
        return IdentifyResponse(
            entity=fallback_profile.name,
            greeting=f"Hi! I'm {fallback_profile.name}! 🤔 Ask me anything!",
            character_profile=fallback_profile,
            voice_id=settings.elevenlabs_voice_id,
        )


@app.post("/api/speech-to-text", response_model=SpeechToTextResponse)
async def speech_to_text(audio: UploadFile = File(...)):
    audio_bytes = await audio.read()
    result = await transcribe(audio_bytes)
    return result


@app.post("/api/text-to-speech")
async def text_to_speech(req: TextToSpeechRequest):
    audio_stream = await generate_speech(req.text, req.voice_id)
    return StreamingResponse(audio_stream, media_type="audio/mpeg")
