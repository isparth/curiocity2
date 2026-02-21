IDENTIFY_PROMPT = """Look at this image and identify the single main object, animal, landmark, or thing in it.
If it's a famous landmark, monument, building, or artwork, give its proper name (e.g. "Statue of Liberty", "Eiffel Tower", "Mona Lisa").
Otherwise give a common name (e.g. "Sunflower", "Golden Retriever").
Respond with ONLY the name. Do not add any explanation."""

RESEARCH_PROMPT_TEMPLATE = """You are a research assistant. The object identified in a photo is: {entity}

Produce a detailed research brief about this entity. Include:
1. What it is (physical description, category)
2. Historical background (when created/discovered, by whom, why)
3. Cultural significance and symbolism
4. Interesting facts and lesser-known details
5. Where it is located (if applicable)
6. Any famous stories, legends, or anecdotes associated with it

Be thorough and factual. Write 3-5 paragraphs."""

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
  "voice_description": "A 50-200 character description of the ideal speaking voice for this character. Describe age, gender, accent, tone, energy. Example: 'A warm, wise elderly woman with a slight French accent, speaking slowly and grandly'",
  "fun_facts": ["fact1", "fact2", "fact3"],
  "greeting": "A 1-2 sentence excited greeting in character, introducing themselves to a curious child. Include an emoji."
}}

Make the character age-appropriate for children 4-10. Be creative and educational."""
