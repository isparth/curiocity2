import asyncio

from deepgram import DeepgramClient, PrerecordedOptions

from app.config import settings
from app.models.schemas import SpeechToTextResponse

_client: DeepgramClient | None = None


def _get_client() -> DeepgramClient:
    global _client
    if _client is None:
        _client = DeepgramClient(settings.deepgram_api_key)
    return _client


def _transcribe_sync(audio_bytes: bytes) -> SpeechToTextResponse:
    client = _get_client()

    payload = {"buffer": audio_bytes}
    options = PrerecordedOptions(
        model="nova-2",
        smart_format=True,
        profanity_filter=True,
    )

    response = client.listen.rest.v("1").transcribe_file(payload, options)
    channel = response.results.channels[0]
    alternative = channel.alternatives[0]

    return SpeechToTextResponse(
        transcript=alternative.transcript,
        confidence=alternative.confidence,
    )


async def transcribe(audio_bytes: bytes) -> SpeechToTextResponse:
    return await asyncio.to_thread(_transcribe_sync, audio_bytes)
