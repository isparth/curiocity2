import base64
import json

from google import genai

from app.config import settings
from app.models.schemas import IdentifyResponse, CharacterProfile, ConversationMessage
from app.prompts.identify_prompt import (
    IDENTIFY_PROMPT,
    RESEARCH_PROMPT_TEMPLATE,
    CHARACTER_CREATION_PROMPT_TEMPLATE,
)
from app.prompts.chat_prompt import CHAT_SYSTEM_PROMPT_TEMPLATE
from app.services.elevenlabs_service import design_voice

MODEL = "gemini-2.0-flash"


def _get_client() -> genai.Client:
    return genai.Client(api_key=settings.gemini_api_key)


def _decode_data_uri(data_uri: str) -> tuple[str, bytes]:
    """Extract mime type and raw bytes from a data URI."""
    header, b64_data = data_uri.split(",", 1)
    mime_type = header.split(":")[1].split(";")[0]
    return mime_type, base64.b64decode(b64_data)


def _parse_json_response(text: str) -> dict:
    """Parse JSON from Gemini response, stripping markdown fences if present."""
    raw = text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
    return json.loads(raw)


async def identify_research_and_create(image_data_uri: str) -> IdentifyResponse:
    client = _get_client()
    mime_type, image_bytes = _decode_data_uri(image_data_uri)

    # --- STEP 1: Identify the object ---
    identify_response = client.models.generate_content(
        model=MODEL,
        contents=[
            {
                "role": "user",
                "parts": [
                    {"text": IDENTIFY_PROMPT},
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": base64.b64encode(image_bytes).decode(),
                        }
                    },
                ],
            }
        ],
    )
    entity = identify_response.text.strip().strip('"').strip(".")

    # --- STEP 2: Research the entity ---
    research_response = client.models.generate_content(
        model=MODEL,
        contents=RESEARCH_PROMPT_TEMPLATE.format(entity=entity),
    )
    research = research_response.text.strip()

    # --- STEP 3: Create character profile ---
    character_response = client.models.generate_content(
        model=MODEL,
        contents=CHARACTER_CREATION_PROMPT_TEMPLATE.format(
            entity=entity, research=research
        ),
    )
    character_data = _parse_json_response(character_response.text)

    profile = CharacterProfile(
        name=character_data["name"],
        backstory=character_data["backstory"],
        personality_traits=character_data["personality_traits"],
        speaking_style=character_data["speaking_style"],
        voice_description=character_data["voice_description"],
        fun_facts=character_data["fun_facts"],
    )
    greeting = character_data["greeting"]

    # --- STEP 4: Design a custom voice ---
    try:
        voice_id = await design_voice(
            voice_description=profile.voice_description,
            preview_text=greeting,
        )
    except Exception:
        # Fall back to default voice if voice design fails
        voice_id = settings.elevenlabs_voice_id

    return IdentifyResponse(
        entity=entity,
        greeting=greeting,
        character_profile=profile,
        voice_id=voice_id,
    )


async def generate_chat_response(
    character_profile: CharacterProfile,
    conversation_history: list[ConversationMessage],
) -> str:
    client = _get_client()
    system_prompt = CHAT_SYSTEM_PROMPT_TEMPLATE.format(
        name=character_profile.name,
        backstory=character_profile.backstory,
        traits=", ".join(character_profile.personality_traits),
        speaking_style=character_profile.speaking_style,
        fun_facts="\n".join(f"- {f}" for f in character_profile.fun_facts),
    )

    contents = []
    for msg in conversation_history:
        role = "user" if msg.role == "user" else "model"
        contents.append({"role": role, "parts": [{"text": msg.text}]})

    response = client.models.generate_content(
        model=MODEL,
        contents=contents,
        config={"system_instruction": system_prompt},
    )
    return response.text.strip()
