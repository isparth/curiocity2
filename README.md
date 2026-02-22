# CurioCity

CurioCity is a full-stack app where a child points a camera at something, the app identifies it, turns it into a character, and enables a voice/text conversation with that character.

## What It Does

- Captures a photo from the device camera.
- Identifies the main subject in the image (with disambiguation logic for specific people/statues/landmarks).
- Generates a research brief and a kid-friendly character persona.
- Designs a matching voice for the character.
- Supports voice chat (speech-to-text and text-to-speech) and text chat.

## Tech Stack

- Frontend: Next.js 14, React 18, TypeScript, TailwindCSS
- Backend: FastAPI, Pydantic
- AI/Voice APIs:
  - Google Gemini (vision, research, character generation, chat)
  - Deepgram (speech-to-text)
  - ElevenLabs (voice design + text-to-speech)

## Repository Layout

```text
backend/
  app/
    main.py                  FastAPI app and API routes
    config.py                Environment-driven settings
    models/schemas.py        Request/response schemas
    prompts/                 Prompt templates
    services/                Gemini/Deepgram/ElevenLabs integration
  requirements.txt

frontend/
  app/                       Next.js App Router entrypoints
  components/                Camera/chat UI components
  lib/                       API client + audio hooks + app types
  package.json
```

## Architecture

### Frontend

- `CameraChat` is the orchestrator/state machine.
- Camera capture uses `getUserMedia` and draws a frame to canvas.
- After identification, conversation continues via:
  - mic -> STT -> chat -> TTS
  - typed text -> chat -> TTS

### Backend

- `/api/identify` runs a 4-step pipeline:
  1. Identify entity from image
  2. Research entity
  3. Create character profile + greeting
  4. Design/saves a custom voice
- `/api/chat` generates in-character responses.
- `/api/speech-to-text` transcribes audio.
- `/api/text-to-speech` returns MP3 audio bytes.

### External Services

- Gemini API key is required for image understanding + LLM generation.
- Deepgram API key is required for transcription.
- ElevenLabs API key is required for voice generation.

## End-to-End Runtime Flow

1. User captures photo in frontend (`image/jpeg` data URI).
2. Frontend calls `POST /api/identify`.
3. Backend decodes image and calls Gemini with identify prompt.
4. If ambiguous, backend performs a disambiguation pass.
5. Backend generates research and character profile.
6. Backend designs/creates a voice in ElevenLabs.
7. Backend returns:
   - `entity`
   - `greeting`
   - `character_profile`
   - `voice_id`
   - optional `research_model` and `personification_model`
8. Frontend shows greeting and opens chat UI.
9. User speaks or types; backend returns character replies.
10. Frontend requests TTS and plays audio response.

## Prerequisites

- Python 3.11+
- Node.js 18+
- API keys:
  - Gemini
  - Deepgram
  - ElevenLabs

## Quick Start

Open two terminals.

### 1) Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-3.1-pro-preview
GEMINI_RESEARCH_MODEL=gemini-3.1-pro-preview
GEMINI_ENABLE_GOOGLE_SEARCH=true
DEEPGRAM_API_KEY=your_key
ELEVENLABS_API_KEY=your_key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

Run API server:

```bash
uvicorn app.main:app --reload --port 8000
```

### 2) Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Run web app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## API Overview

### `GET /health`

Response:

```json
{ "status": "ok" }
```

### `POST /api/identify`

Request:

```json
{ "image": "data:image/jpeg;base64,..." }
```

Response (shape):

```json
{
  "entity": "Statue of Liberty",
  "greeting": "Hi explorer! ...",
  "character_profile": {
    "name": "Lady Liberty",
    "backstory": "...",
    "personality_traits": ["curious", "friendly", "wise", "playful", "brave"],
    "speaking_style": "...",
    "voice_description": "...",
    "fun_facts": ["...", "...", "..."]
  },
  "voice_id": "voice_xxx",
  "research_model": null,
  "personification_model": null
}
```

### `POST /api/chat`

Request:

```json
{
  "entity": "Statue of Liberty",
  "character_profile": { "...": "..." },
  "conversation_history": [
    { "role": "user", "text": "Hi!" },
    { "role": "assistant", "text": "Hello!" }
  ]
}
```

Response:

```json
{ "response": "In-character reply..." }
```

### `POST /api/speech-to-text`

- `multipart/form-data` with `audio` file.

Response:

```json
{ "transcript": "hello there", "confidence": 0.97 }
```

### `POST /api/text-to-speech`

Request:

```json
{ "text": "Hello!", "entity": "Statue of Liberty", "voice_id": "voice_xxx" }
```

Response:

- `audio/mpeg` bytes

## Current Behavior Notes

- If `/api/identify` fails, backend returns fallback character `"Mystery Thing"`.
- Voice-design failures fall back to `ELEVENLABS_VOICE_ID`.
- Browser autoplay policies can block audio playback; frontend handles this gracefully.
- CORS is currently limited to `http://localhost:3000`.

## Model Notes

- `GEMINI_ENABLE_GOOGLE_SEARCH=true` enables Gemini Google Search tool usage in identify/disambiguation calls.
- Some Gemini models are only available on specific APIs/workflows.
- `deep-research-pro-preview-12-2025` requires Interactions API; this backend currently uses `models.generate_content`.

## Development Commands

Backend (from `backend/`):

```bash
python -m compileall app
```

Frontend (from `frontend/`):

```bash
npm run lint
```

## License

No license file is currently included in this repository.
