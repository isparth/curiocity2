import io
import re

import httpx

from app.config import settings

ELEVENLABS_BASE = "https://api.elevenlabs.io/v1"


def _normalize_preview_text(preview_text: str | None) -> str:
    base = (preview_text or "").strip()
    if len(base) < 100:
        base = (
            f"{base} Hello there, young explorer. I love sharing history, stories, "
            "and fun facts in a warm and expressive way."
        ).strip()
    return base[:1000]


def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-z]{3,}", (text or "").lower()))


def _score_voice(voice: dict, voice_description: str) -> int:
    labels = voice.get("labels") or {}
    blob = " ".join(
        [
            voice.get("name", ""),
            voice.get("description", ""),
            str(labels),
            voice.get("category", ""),
        ]
    ).lower()

    wanted = _tokenize(voice_description)
    score = 0
    for token in wanted:
        if token in blob:
            score += 2

    # Strong boosts for key traits.
    accent = str(labels.get("accent", "")).lower()
    gender = str(labels.get("gender", "")).lower()
    age = str(labels.get("age", "")).lower()
    use_case = str(labels.get("use_case", "")).lower()
    if "irish" in voice_description.lower() and "irish" in accent:
        score += 20
    if "male" in voice_description.lower() and "male" in gender:
        score += 12
    if "female" in voice_description.lower() and "female" in gender:
        score += 12
    if "older" in voice_description.lower() and ("old" in age or "middle" in age):
        score += 6
    if "story" in voice_description.lower() and ("narration" in use_case or "audiobook" in use_case):
        score += 6
    return score


async def _choose_best_existing_voice(voice_description: str) -> str:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{ELEVENLABS_BASE}/voices",
            headers={"xi-api-key": settings.elevenlabs_api_key},
            timeout=30.0,
        )
        if not response.is_success:
            return settings.elevenlabs_voice_id

        voices = response.json().get("voices", [])
        if not voices:
            return settings.elevenlabs_voice_id

        best = max(voices, key=lambda v: _score_voice(v, voice_description))
        return best.get("voice_id", settings.elevenlabs_voice_id)


async def design_voice(voice_description: str, preview_text: str) -> str:
    """Create a persistent ElevenLabs voice from description and return voice_id."""
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
                "text": _normalize_preview_text(preview_text),
            },
            timeout=30.0,
        )
        response.raise_for_status()
        data = response.json()
        generated_voice_id = data["previews"][0]["generated_voice_id"]

        finalize_response = await client.post(
            f"{ELEVENLABS_BASE}/text-to-voice/create-voice-from-preview",
            headers={
                "xi-api-key": settings.elevenlabs_api_key,
                "Content-Type": "application/json",
            },
            json={
                "voice_name": f"curiocity-{generated_voice_id[:8]}",
                "voice_description": desc,
                "generated_voice_id": generated_voice_id,
            },
            timeout=30.0,
        )
        if finalize_response.status_code == 400:
            detail = finalize_response.json().get("detail", {})
            if isinstance(detail, dict) and detail.get("status") == "voice_limit_reached":
                return await _choose_best_existing_voice(desc)
        finalize_response.raise_for_status()
        voice_data = finalize_response.json()
        return voice_data["voice_id"]


async def generate_speech(text: str, voice_id: str | None = None) -> io.BytesIO:
    """Generate speech using voice_id and retry with default voice if needed."""
    voices = [voice_id, settings.elevenlabs_voice_id]
    tried: set[str] = set()

    async with httpx.AsyncClient() as client:
        for vid in voices:
            if not vid or vid in tried:
                continue
            tried.add(vid)
            url = f"{ELEVENLABS_BASE}/text-to-speech/{vid}"
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
            if response.is_success:
                return io.BytesIO(response.content)

        response.raise_for_status()
        return io.BytesIO(response.content)
