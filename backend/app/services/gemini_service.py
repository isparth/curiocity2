import asyncio
import json
import logging
import re
from functools import partial
from typing import Any

from google import genai
from google.genai import types
from google.genai.errors import ClientError

from app.config import settings
from app.models.schemas import IdentifyResponse, CharacterProfile, ConversationMessage
from app.prompts.identify_prompt import (
    IDENTIFY_PROMPT,
    IDENTIFY_DISAMBIGUATE_PROMPT_TEMPLATE,
    RESEARCH_PROMPT_TEMPLATE,
    CHARACTER_CREATION_PROMPT_TEMPLATE,
)
from app.prompts.chat_prompt import CHAT_SYSTEM_PROMPT_TEMPLATE
from app.services.elevenlabs_service import design_voice

logger = logging.getLogger(__name__)
_client: genai.Client | None = None

MODEL = settings.gemini_model.strip() or "gemini-3.1-pro-preview"
RESEARCH_MODEL = (
    settings.gemini_research_model.strip()
    or "gemini-3.1-pro-preview"
)
MODEL_FALLBACKS = [
    MODEL,
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-1.5-flash",
]

DEPICTION_PREFIX_RE = re.compile(
    r"^(?:the\s+)?(?:(?:marble|bronze|stone|wooden)\s+)?"
    r"(?:bust|portrait|painting|sculpture|carving|engraving|relief|fresco|mosaic|drawing)"
    r"\s+of\s+(.+)$",
    re.IGNORECASE,
)
DEPICTION_LOCATION_SUFFIX_RE = re.compile(r"^(.+?)\s+(?:at|in)\s+.+$", re.IGNORECASE)
DEPICTION_PAREN_SUFFIX_RE = re.compile(
    r"^(.+?)\s+\((?:marble|bronze|stone|wooden|bust|portrait|painting|sculpture|carving).*\)$",
    re.IGNORECASE,
)


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def _decode_data_uri(data_uri: str) -> tuple[str, str]:
    """Extract mime type and base64 payload from a data URI."""
    header, b64_data = data_uri.split(",", 1)
    mime_type = header.split(":")[1].split(";")[0]
    return mime_type, b64_data


def _parse_json_response(text: str) -> dict:
    """Parse JSON from Gemini response, stripping markdown fences if present."""
    raw = text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
    return json.loads(raw)


def _clean_label(value: str) -> str:
    return value.strip().strip('"').strip("'").strip().strip(".")


def _normalize_character_entity_label(value: str) -> str:
    """
    Normalize depiction labels so character identity is the depicted character/person,
    not the medium or display context.
    """
    label = _clean_label(value)
    if not label:
        return label

    match = DEPICTION_PREFIX_RE.match(label)
    if not match:
        return label

    normalized = _clean_label(match.group(1))

    location_match = DEPICTION_LOCATION_SUFFIX_RE.match(normalized)
    if location_match:
        normalized = _clean_label(location_match.group(1))

    paren_match = DEPICTION_PAREN_SUFFIX_RE.match(normalized)
    if paren_match:
        normalized = _clean_label(paren_match.group(1))

    return normalized or label


def _extract_identify_data(text: str) -> tuple[str, list[str], str, float]:
    """
    Parse identify model output.
    Returns: (entity, alternatives, specificity, confidence)
    """
    try:
        data = _parse_json_response(text)
        entity = _normalize_character_entity_label(str(data.get("entity", "")))
        alternatives_raw = data.get("alternatives", [])
        alternatives = []
        if isinstance(alternatives_raw, list):
            for item in alternatives_raw:
                if isinstance(item, str):
                    label = _normalize_character_entity_label(item)
                    if label:
                        alternatives.append(label)

        specificity = str(data.get("specificity", "")).strip().lower()
        confidence_value = data.get("confidence", 0.0)
        try:
            confidence = float(confidence_value)
        except (TypeError, ValueError):
            confidence = 0.0
        return entity, alternatives, specificity, confidence
    except Exception:
        # Backward-compatible fallback if model returns plain text.
        return _normalize_character_entity_label(text), [], "", 0.0


def _build_voice_design_description(
    profile: CharacterProfile, entity: str
) -> str:
    traits = ", ".join(profile.personality_traits[:5])
    return (
        f"{profile.voice_description}. Character name: {profile.name}. "
        f"Entity: {entity}. Speaking style: {profile.speaking_style}. "
        f"Personality traits: {traits}. The generated voice must strongly match "
        "the described gender presentation, accent/region, age, tone, pacing, and energy."
    )


def _build_identify_contents(
    mime_type: str, image_b64: str, prompt: str
) -> list[dict]:
    return [
        {
            "role": "user",
            "parts": [
                {"text": prompt},
                {
                    "inline_data": {
                        "mime_type": mime_type,
                        "data": image_b64,
                    }
                },
            ],
        }
    ]


def _model_candidates(preferred_models: list[str] | None = None) -> list[str]:
    # Keep order but drop duplicates/empties.
    seen = set()
    ordered = []
    all_models = (preferred_models or []) + MODEL_FALLBACKS
    for model in all_models:
        model = (model or "").strip()
        if model and model not in seen:
            ordered.append(model)
            seen.add(model)
    return ordered


def _merge_generate_config(config: dict | None = None, use_google_search: bool = False):
    if isinstance(config, types.GenerateContentConfig):
        merged = config.model_dump(exclude_none=True)
    else:
        merged = dict(config or {})

    if use_google_search:
        tools = list(merged.get("tools", []))
        has_google_search_tool = any(
            isinstance(tool, dict) and "google_search" in tool
            for tool in tools
        )
        if not has_google_search_tool:
            tools.append({"google_search": {}})
        merged["tools"] = tools

    return merged or None


async def _generate_with_fallback(
    client: genai.Client,
    contents: Any,
    config: dict | None = None,
    preferred_models: list[str] | None = None,
    use_google_search: bool = False,
):
    merged_config = _merge_generate_config(
        config=config,
        use_google_search=use_google_search,
    )
    last_error = None
    for model in _model_candidates(preferred_models):
        try:
            return await asyncio.to_thread(
                partial(
                    client.models.generate_content,
                    model=model,
                    contents=contents,
                    config=merged_config,
                ),
            )
        except ClientError as err:
            last_error = err
            # Retry only when model is unavailable/invalid for this account.
            if err.code in (400, 404):
                logger.warning(
                    "Gemini model %s unavailable (%s). Trying next fallback.",
                    model,
                    err.message,
                )
                continue
            raise

    if last_error:
        if use_google_search:
            logger.warning(
                "Google Search tool path failed (%s). Retrying without search tool.",
                last_error.message,
            )
            return await _generate_with_fallback(
                client=client,
                contents=contents,
                config=config,
                preferred_models=preferred_models,
                use_google_search=False,
            )
        raise last_error
    raise RuntimeError("No Gemini model candidates configured")


async def identify_research_and_create(image_data_uri: str) -> IdentifyResponse:
    client = _get_client()
    mime_type, image_b64 = _decode_data_uri(image_data_uri)

    # --- STEP 1: Identify the object ---
    identify_response = await _generate_with_fallback(
        client=client,
        contents=_build_identify_contents(
            mime_type=mime_type,
            image_b64=image_b64,
            prompt=IDENTIFY_PROMPT,
        ),
        use_google_search=True,
    )
    entity, alternatives, specificity, confidence = _extract_identify_data(
        identify_response.text
    )

    # If the first pass is ambiguous, run a second disambiguation pass.
    if alternatives and (specificity != "exact" or confidence < 0.75):
        candidates = [entity] + alternatives
        deduped_candidates = []
        seen = set()
        for candidate in candidates:
            label = _clean_label(candidate)
            if label and label not in seen:
                deduped_candidates.append(label)
                seen.add(label)

        if deduped_candidates:
            disambiguate_prompt = IDENTIFY_DISAMBIGUATE_PROMPT_TEMPLATE.format(
                candidates="\n".join(f"- {c}" for c in deduped_candidates[:6])
            )
            disambiguate_response = await _generate_with_fallback(
                client=client,
                contents=_build_identify_contents(
                    mime_type=mime_type,
                    image_b64=image_b64,
                    prompt=disambiguate_prompt,
                ),
                use_google_search=True,
            )
            disambiguated = _normalize_character_entity_label(
                disambiguate_response.text
            )
            if disambiguated:
                entity = disambiguated

    entity = _normalize_character_entity_label(entity)
    if not entity:
        entity = "Unknown object"

    # --- STEP 2: Research the entity ---
    research_response = await _generate_with_fallback(
        client=client,
        contents=RESEARCH_PROMPT_TEMPLATE.format(entity=entity),
        preferred_models=[RESEARCH_MODEL],
        use_google_search=True,
    )
    research = research_response.text.strip()

    # --- STEP 3: Create character profile ---
    character_response = await _generate_with_fallback(
        client=client,
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
            voice_description=_build_voice_design_description(profile, entity),
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
        research_model=RESEARCH_MODEL,
        personification_model=MODEL,
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

    response = await _generate_with_fallback(
        client=client,
        contents=contents,
        config={"system_instruction": system_prompt},
        use_google_search=False,
    )
    return response.text.strip()
