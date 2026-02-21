# CurioCity Frontend

A Next.js app where kids point their camera at objects and landmarks, then have spoken conversations with them.

## Tech Stack

- Next.js 14 (App Router)
- React 18
- TypeScript
- TailwindCSS

## Getting Started

```bash
npm install
npm run dev
```

Opens on [http://localhost:3000](http://localhost:3000).

## Environment Variables

Create a `.env.local` file:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## How It Works

1. **Camera** — The app opens the device camera
2. **Capture** — Kid taps the shutter button to photograph an object or landmark
3. **Identify** — The backend identifies the object, researches it, and creates a character with a custom voice
4. **Chat** — The kid talks to the object via voice (mic button) or text (keyboard button)
5. **Listen** — The object responds in character with text and spoken audio

## Project Structure

```
app/              Next.js app directory (layout, page, globals.css)
components/       UI components
  CameraChat.tsx    Main orchestrator (state machine, API calls)
  CameraFeed.tsx    Camera stream and photo capture
  ChatPane.tsx      Chat messages, mic/keyboard/retake buttons
  LoadingOverlay.tsx  3-step loading animation
  MicButton.tsx     Mic button with listening animation
  TopBar.tsx        Entity name and restart button
lib/              Utilities
  api.ts            Backend API client
  types.ts          TypeScript types
  useAudioRecorder.ts  MediaRecorder hook
  useAudioPlayer.ts    Audio playback hook
```

## Requirements

- The backend must be running on port 8000 (see `backend/README.md`)
- Browser with camera and microphone permissions
