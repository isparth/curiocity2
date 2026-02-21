import io

import httpx

from app.config import settings

ELEVENLABS_BASE = "https://api.elevenlabs.io/v1"


async def design_voice(voice_description: str, preview_text: str) -> str:
    """Call ElevenLabs Voice Design API, return generated_voice_id."""
    # Clamp voice_description to 20-1000 chars
    desc = voice_description[:1000]
    if len(desc) < 20:
        desc = desc + " " + "A friendly, expressive voice."

    url = f"{ELEVENLABS_BASE}/text-to-voice/create-previews"
    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            headers={
                "xi-api-key": settings.elevenlabs_api_key,
                "Content-Type": "application/json",
            },
            json={
                "voice_description": desc,
                "text": preview_text[:1000] if preview_text else "Hello there, young explorer!",
            },
            timeout=30.0,
        )
        response.raise_for_status()
        data = response.json()
        return data["previews"][0]["generated_voice_id"]


async def generate_speech(text: str, voice_id: str | None = None) -> io.BytesIO:
    """Generate speech using a specific voice_id, falling back to default."""
    vid = voice_id or settings.elevenlabs_voice_id
    url = f"{ELEVENLABS_BASE}/text-to-speech/{vid}"

    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            headers={
                "xi-api-key": settings.elevenlabs_api_key,
                "Content-Type": "application/json",
            },
            json={
                "text": text,
                "model_id": "eleven_turbo_v2",
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.75,
                },
            },
            timeout=30.0,
        )
        response.raise_for_status()
        return io.BytesIO(response.content)
