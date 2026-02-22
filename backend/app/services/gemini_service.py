import base64
import json
import logging
from typing import Any

from google import genai
from google.genai import types

from app.config import settings
from app.models.schemas import IdentifyResponse, CharacterProfile, ConversationMessage
from app.prompts.identify_prompt import (
    IDENTIFY_PROMPT,
    RESEARCH_PROMPT_TEMPLATE,
    CHARACTER_CREATION_PROMPT_TEMPLATE,
)
from app.prompts.chat_prompt import CHAT_SYSTEM_PROMPT_TEMPLATE
from app.services.elevenlabs_service import design_voice

logger = logging.getLogger(__name__)


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
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(raw[start : end + 1])
        raise


def _google_search_tool_config() -> Any:
    try:
        return types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())]
        )
    except Exception:
        return {}


def _extract_grounded_urls(response: Any) -> list[str]:
    urls: list[str] = []
    try:
        candidates = getattr(response, "candidates", []) or []
        for candidate in candidates:
            metadata = getattr(candidate, "grounding_metadata", None)
            chunks = getattr(metadata, "grounding_chunks", []) if metadata else []
            for chunk in chunks:
                web = getattr(chunk, "web", None)
                uri = getattr(web, "uri", None) if web else None
                if isinstance(uri, str) and uri.startswith(("http://", "https://")):
                    urls.append(uri)
    except Exception:
        return []

    seen = set()
    deduped = []
    for url in urls:
        if url not in seen:
            seen.add(url)
            deduped.append(url)
    return deduped[:8]


async def identify_research_and_create(image_data_uri: str) -> IdentifyResponse:
    mime_type, image_bytes = _decode_data_uri(image_data_uri)
    entity = await identify_entity_from_image(mime_type, image_bytes)
    return await create_character_from_entity(entity)


async def identify_entity_from_image(mime_type: str, image_bytes: bytes) -> str:
    client = _get_client()
    entity = "Unknown Object"
    try:
        identify_response = client.models.generate_content(
            model=settings.gemini_model,
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
        identify_text = (identify_response.text or "").strip().strip('"').strip(".")
        if identify_text:
            entity = identify_text
    except Exception:
        logger.exception("Identify step failed; continuing with generic entity")
    return entity


async def create_character_from_entity(entity: str) -> IdentifyResponse:
    client = _get_client()
    research_summary = ""
    canonical_facts: list[str] = []
    source_urls: list[str] = []
    try:
        research_response = client.models.generate_content(
            model=settings.gemini_model,
            contents=RESEARCH_PROMPT_TEMPLATE.format(entity=entity),
            config=_google_search_tool_config(),
        )
        research_data = _parse_json_response(research_response.text or "{}")
        grounded_urls = _extract_grounded_urls(research_response)
        source_urls = research_data.get("source_urls", []) or []
        source_urls = [u for u in source_urls if isinstance(u, str)]
        if grounded_urls:
            source_urls = grounded_urls + [u for u in source_urls if u not in grounded_urls]
        source_urls = source_urls[:8]
        research_summary = str(research_data.get("research_summary", "")).strip()
        canonical_facts = [
            str(f).strip()
            for f in (research_data.get("canonical_facts", []) or [])
            if str(f).strip()
        ][:8]
    except Exception:
        logger.exception("Research step failed for entity: %s", entity)
        research_summary = (
            f"{entity} is an interesting subject with history and stories to explore."
        )

    if not canonical_facts:
        canonical_facts = [f"I am known as {entity}.", "I have a story worth exploring."]

    research = json.dumps(
        {
            "research_summary": research_summary,
            "canonical_facts": canonical_facts,
            "source_urls": source_urls,
        },
        ensure_ascii=True,
    )

    # --- STEP 3: Create character profile ---
    try:
        character_response = client.models.generate_content(
            model=settings.gemini_model,
            contents=CHARACTER_CREATION_PROMPT_TEMPLATE.format(
                entity=entity, research=research
            ),
            config={"response_mime_type": "application/json"},
        )
        character_data = _parse_json_response(character_response.text or "{}")
        profile = CharacterProfile(
            name=character_data.get("name", entity),
            backstory=character_data.get(
                "backstory",
                f"I am {entity}, and I love sharing my story with curious kids.",
            ),
            personality_traits=character_data.get(
                "personality_traits",
                ["curious", "friendly", "kind", "playful", "thoughtful"],
            ),
            speaking_style=character_data.get(
                "speaking_style",
                "Warm, simple, and playful with short kid-friendly sentences.",
            ),
            voice_description=character_data.get(
                "voice_description",
                "A warm, expressive, friendly storyteller voice with gentle energy.",
            ),
            fun_facts=character_data.get("fun_facts", canonical_facts[:3]),
            research_summary=research_summary,
            canonical_facts=character_data.get("canonical_facts", canonical_facts)
            or canonical_facts,
            source_urls=source_urls,
        )
        greeting = character_data.get(
            "greeting", f"Hi! I am {profile.name}! Want to hear my story? 🌟"
        )
    except Exception:
        logger.exception("Character creation failed for entity: %s", entity)
        profile = CharacterProfile(
            name=entity,
            backstory=f"I am {entity}, and I love sharing my story with curious kids.",
            personality_traits=["curious", "friendly", "kind", "playful", "thoughtful"],
            speaking_style="Warm, simple, and playful with short kid-friendly sentences.",
            voice_description="A warm, expressive, friendly storyteller voice with gentle energy.",
            fun_facts=canonical_facts[:3],
            research_summary=research_summary,
            canonical_facts=canonical_facts,
            source_urls=source_urls,
        )
        greeting = f"Hi! I am {entity}! Ask me anything about me 🌟"

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
        canonical_facts="\n".join(f"- {f}" for f in character_profile.canonical_facts),
        source_urls="\n".join(f"- {u}" for u in character_profile.source_urls),
    )

    contents = []
    for msg in conversation_history:
        role = "user" if msg.role == "user" else "model"
        contents.append({"role": role, "parts": [{"text": msg.text}]})

    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=contents,
        config={"system_instruction": system_prompt},
    )
    return response.text.strip()
