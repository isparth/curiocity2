import logging

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from app.config import settings
from app.models.schemas import (
    CharacterProfile,
    IdentifyRequest,
    IdentifyResponse,
    ChatRequest,
    ChatResponse,
    SpeechToTextResponse,
    TextToSpeechRequest,
)
from app.services.gemini_service import identify_research_and_create, generate_chat_response
from app.services.deepgram_service import transcribe
from app.services.elevenlabs_service import close_http_client, generate_speech

app = FastAPI(title="CurioCity API")
logger = logging.getLogger(__name__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.on_event("shutdown")
async def shutdown():
    await close_http_client()


@app.post("/api/identify", response_model=IdentifyResponse)
async def identify(req: IdentifyRequest):
    fallback_profile = CharacterProfile(
        name="Mystery Thing",
        backstory="I'm a mystery! Nobody knows where I came from, but I love making new friends and learning about the world.",
        personality_traits=["curious", "friendly", "silly", "adventurous", "kind"],
        speaking_style="Speaks with wonder and excitement, asks lots of questions back.",
        voice_description="A friendly, curious young voice full of energy and wonder",
        fun_facts=["I love surprises!", "Everything is an adventure!", "I make friends everywhere I go!"],
    )

    try:
        result = await identify_research_and_create(req.image)
        return result
    except Exception:
        logger.exception("/api/identify failed; returning fallback character")

    return IdentifyResponse(
        entity="Mystery Thing",
        greeting="Hi! I'm a Mystery Thing! 🤔 Ask me anything!",
        character_profile=fallback_profile,
        voice_id=settings.elevenlabs_voice_id,
        research_model="fallback",
        personification_model="fallback",
    )


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    response = await generate_chat_response(
        req.character_profile, req.conversation_history[-10:]
    )
    return ChatResponse(response=response)


@app.post("/api/speech-to-text", response_model=SpeechToTextResponse)
async def speech_to_text(audio: UploadFile = File(...)):
    audio_bytes = await audio.read()
    result = await transcribe(audio_bytes)
    return result


@app.post("/api/text-to-speech")
async def text_to_speech(req: TextToSpeechRequest):
    try:
        audio_bytes = await generate_speech(req.text, req.voice_id)
        return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as err:
        logger.warning("/api/text-to-speech failed: %s", str(err))
        raise HTTPException(status_code=503, detail="Text-to-speech unavailable")
