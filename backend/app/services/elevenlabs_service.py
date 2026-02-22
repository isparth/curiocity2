import asyncio
import hashlib
import logging
from collections import OrderedDict

import httpx

from app.config import settings

ELEVENLABS_BASE = "https://api.elevenlabs.io/v1"
logger = logging.getLogger(__name__)
_HTTP_TIMEOUT = httpx.Timeout(30.0, connect=10.0)
_HTTP_LIMITS = httpx.Limits(max_keepalive_connections=20, max_connections=100)
_http_client: httpx.AsyncClient | None = None
_http_client_lock = asyncio.Lock()
_voice_cache_lock = asyncio.Lock()
_voice_id_cache: OrderedDict[str, str] = OrderedDict()
_VOICE_CACHE_SIZE = 128


async def _get_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is not None:
        return _http_client

    async with _http_client_lock:
        if _http_client is None:
            _http_client = httpx.AsyncClient(
                timeout=_HTTP_TIMEOUT,
                limits=_HTTP_LIMITS,
                headers={"xi-api-key": settings.elevenlabs_api_key},
            )
        return _http_client


async def close_http_client() -> None:
    global _http_client
    if _http_client is None:
        return
    await _http_client.aclose()
    _http_client = None


def _build_voice_cache_key(voice_description: str, preview_text: str) -> str:
    raw = f"{voice_description.strip()}||{preview_text.strip()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def _get_cached_voice_id(cache_key: str) -> str | None:
    async with _voice_cache_lock:
        voice_id = _voice_id_cache.get(cache_key)
        if voice_id:
            _voice_id_cache.move_to_end(cache_key)
        return voice_id


async def _set_cached_voice_id(cache_key: str, voice_id: str) -> None:
    async with _voice_cache_lock:
        _voice_id_cache[cache_key] = voice_id
        _voice_id_cache.move_to_end(cache_key)
        if len(_voice_id_cache) > _VOICE_CACHE_SIZE:
            _voice_id_cache.popitem(last=False)


async def design_voice(voice_description: str, preview_text: str) -> str:
    """Call ElevenLabs Voice Design API and return a saved, reusable voice_id."""
    # Clamp voice_description to 20-1000 chars
    desc = voice_description[:1000]
    if len(desc) < 20:
        desc = desc + " " + "A friendly, expressive voice."
    preview = preview_text[:1000] if preview_text else "Hello there, young explorer!"

    cache_key = _build_voice_cache_key(desc, preview)
    cached_voice_id = await _get_cached_voice_id(cache_key)
    if cached_voice_id:
        return cached_voice_id

    url = f"{ELEVENLABS_BASE}/text-to-voice/create-previews"
    client = await _get_client()
    response = await client.post(
        url,
        json={
            "voice_description": desc,
            "text": preview,
        },
    )
    response.raise_for_status()
    data = response.json()
    generated_voice_id = data["previews"][0]["generated_voice_id"]

    save_url = f"{ELEVENLABS_BASE}/text-to-voice/create-voice-from-preview"
    save_response = await client.post(
        save_url,
        json={
            "voice_name": "CurioCity Character",
            "voice_description": desc,
            "generated_voice_id": generated_voice_id,
        },
    )
    save_response.raise_for_status()
    save_data = save_response.json()
    voice_id = save_data["voice_id"]
    await _set_cached_voice_id(cache_key, voice_id)
    return voice_id


async def generate_speech(text: str, voice_id: str | None = None) -> bytes:
    """Generate speech using a specific voice_id, falling back to default."""
    async def _request_tts(target_voice_id: str) -> bytes:
        url = f"{ELEVENLABS_BASE}/text-to-speech/{target_voice_id}"
        client = await _get_client()
        response = await client.post(
            url,
            json={
                "text": text,
                "model_id": "eleven_turbo_v2",
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.75,
                },
            },
        )
        response.raise_for_status()
        return response.content

    requested_voice_id = voice_id or settings.elevenlabs_voice_id
    fallback_voice_id = settings.elevenlabs_voice_id

    try:
        return await _request_tts(requested_voice_id)
    except httpx.HTTPError as err:
        if requested_voice_id == fallback_voice_id:
            raise
        logger.warning(
            "TTS failed for voice_id=%s (%s). Retrying with fallback voice.",
            requested_voice_id,
            str(err),
        )
        return await _request_tts(fallback_voice_id)
