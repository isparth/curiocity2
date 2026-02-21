from deepgram import DeepgramClient, PrerecordedOptions

from app.config import settings
from app.models.schemas import SpeechToTextResponse


async def transcribe(audio_bytes: bytes) -> SpeechToTextResponse:
    client = DeepgramClient(settings.deepgram_api_key)

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
