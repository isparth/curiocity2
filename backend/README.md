# CurioCity Backend

A FastAPI backend that identifies objects from photos, researches them, creates rich characters, designs custom voices, and powers kid-friendly conversations.

## Tech Stack

- Python + FastAPI
- Google Gemini (vision + chat)
- Deepgram (speech-to-text)
- ElevenLabs (text-to-speech + voice design)

## Getting Started

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill in your API keys
uvicorn app.main:app --reload
```

Runs on [http://localhost:8000](http://localhost:8000).

## Environment Variables

Create a `.env` file with:

```
GEMINI_API_KEY=        # Google AI Studio (https://aistudio.google.com/apikey)
GEMINI_MODEL=gemini-3.1-pro-preview  # optional; default is gemini-3.1-pro-preview
GEMINI_RESEARCH_MODEL=gemini-3.1-pro-preview  # optional; used for step 2 research
GEMINI_ENABLE_GOOGLE_SEARCH=true  # optional; lets identify step use Gemini Google Search tool
DEEPGRAM_API_KEY=      # Deepgram (https://console.deepgram.com)
ELEVENLABS_API_KEY=    # ElevenLabs (https://elevenlabs.io)
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM   # fallback voice
```

## API Endpoints

### `GET /health`
Health check. Returns `{"status": "ok"}`.

### `POST /api/identify`
Takes a photo, runs a 4-step agentic pipeline:
1. **Identify** — Gemini Vision identifies the object/landmark
2. **Research** — Gemini researches its history, facts, and significance
3. **Character Creation** — Gemini builds a full character profile (name, backstory, personality, speaking style, fun facts)
4. **Voice Design** — ElevenLabs creates a custom voice matching the character

**Request:** `{ "image": "data:image/jpeg;base64,..." }`

**Response:** `{ "entity", "greeting", "character_profile", "voice_id" }`

### `POST /api/chat`
Generates an in-character response using the full character profile.

**Request:** `{ "entity", "character_profile", "conversation_history": [{role, text}...] }`

**Response:** `{ "response": "..." }`

### `POST /api/speech-to-text`
Transcribes audio using Deepgram.

**Request:** `multipart/form-data` with `audio` file

**Response:** `{ "transcript", "confidence" }`

### `POST /api/text-to-speech`
Generates spoken audio using the character's custom voice.

**Request:** `{ "text", "entity", "voice_id" }`

**Response:** `audio/mpeg` binary stream

## Project Structure

```
app/
  main.py               FastAPI app, CORS, endpoints
  config.py             Settings from .env
  models/
    schemas.py          Pydantic request/response models
  services/
    gemini_service.py   Vision + research + character creation
    deepgram_service.py Audio transcription
    elevenlabs_service.py Voice design + speech generation
  prompts/
    identify_prompt.py  Identify, research, character prompts
    chat_prompt.py      In-character chat system prompt
```
