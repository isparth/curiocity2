IDENTIFY_PROMPT = """You are an expert visual identifier.
Identify the SINGLE main subject in this image with the highest possible specificity.

Rules:
- FIRST, analyze the image in the "visual_analysis" field. Describe the subject, clothing/era cues, facial features, context, and READ any visible text/inscriptions.
- REQUIRED: use Google Search tool on every request to validate likely identities from visual clues.
- Prefer exact proper names for famous people, statues, landmarks, monuments, artworks, logos, and products.
- If the image shows a statue/portrait of a known person, include the person name plus medium when relevant.
- Do not invent details that are not visually supported.

Respond as STRICT JSON (no markdown):
{
  "visual_analysis": "Detailed description of the subject, era, clothing, and any visible text...",
  "web_check": "Short summary of what search evidence supported the final identity",
  "entity": "best single label",
  "entity_type": "person|statue|landmark|monument|artwork|animal|plant|building|vehicle|logo|product|food|object|other",
  "specificity": "exact|specific|generic",
  "confidence": 0.0,
  "alternatives": ["alt1", "alt2"]
}"""

IDENTIFY_DISAMBIGUATE_PROMPT_TEMPLATE = """You are resolving the most accurate label for the main subject in an image.

Candidate labels:
{candidates}

Rules:
- REQUIRED: use Google Search tool to cross-check the candidates.
- Choose the best label that matches the visible subject.
- Prefer exact proper names for people/statues/landmarks/artworks when justified by visual evidence.
- If none are fully correct, output a better, more specific label.
- Output ONLY the final label, no explanation."""

RESEARCH_PROMPT_TEMPLATE = """You are a deep web researcher. The subject identified in a photo is: {entity}

REQUIRED:
- Use Google Search tool to gather current web-grounded information before writing.
- Resolve ambiguity if multiple similarly named subjects exist.
- Prefer high-quality sources (museums, encyclopedias, official sites, reputable publications).

Produce a detailed research brief. Include:
1. What it is (physical description, category)
2. Historical background (when created/discovered, by whom, why)
3. Cultural significance and symbolism
4. Interesting facts and lesser-known details
5. Where it is located (if applicable)
6. Any famous stories, legends, or anecdotes associated with it
7. If this is a person/statue/portrait, clearly explain who the person is and why they are important

Write 4-7 factual paragraphs, then end with:
Sources:
- source 1
- source 2
- source 3"""

CHARACTER_CREATION_PROMPT_TEMPLATE = """You are a character designer for a children's educational app.
Based on the following research about "{entity}", create a vivid first-person character.

RESEARCH:
{research}

Respond in EXACTLY this JSON format (no markdown, no code fences, no extra text):
{{
  "name": "A fun, memorable name for this character (e.g. 'Lady Liberty' for Statue of Liberty)",
  "backstory": "A 2-3 paragraph first-person backstory. Rich, emotional, historically grounded. Written as if the entity is telling its own life story to a child.",
  "personality_traits": ["trait1", "trait2", "trait3", "trait4", "trait5"],
  "speaking_style": "A 2-3 sentence description of how this character speaks. Include tone, vocabulary level, verbal quirks, catchphrases.",
  "voice_description": "A 80-260 character description of the ideal speaking voice for this character. MUST include likely age range, gender presentation, accent/region, tone, pacing, and energy. Example: 'A warm, wise elderly woman with a gentle French accent, speaking slowly and grandly'",
  "fun_facts": ["fact1", "fact2", "fact3"],
  "greeting": "A 1-2 sentence excited greeting in character, introducing themselves to a curious child. Include an emoji."
}}

Make the character age-appropriate for children 4-10. Be creative and educational.
Ensure voice traits are clearly inferable and consistent with the research."""
