# Live Conference Captions

Internal MVP for real-time conference captions using Soniox STT and one-way translation.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS
- Soniox React SDK in the browser
- Soniox Node SDK in a Next.js API route
- Docker single-container production build
- No database, no login system, no OpenAI integration

## Security Model

The browser never receives `SONIOX_API_KEY`. It calls `POST /api/soniox/temporary-key`, and the Next.js server creates a short-lived, single-use Soniox temporary key for `transcribe_websocket`.

Before production deployment, protect the temporary key endpoint. For this MVP, use one of:

- Deployment platform access protection for the whole app.
- A shared access code in front of the API route.
- Network/IP allowlisting if the conference network is predictable.

Do not put `SONIOX_API_KEY` in `NEXT_PUBLIC_*` variables.

## Local Setup

```bash
cp .env.example .env.local
# SONIOX_API_KEY 입력
npm install
npm run dev
npm run lint
npm run build
```

Open http://localhost:3000.

Safari and Chrome require a secure context for microphone capture. `localhost` works for development; remote phones need HTTPS.

## Docker

```bash
docker compose up --build
```

The image does not contain the Soniox API key. `docker-compose.yml` injects it from `.env.local` at runtime.

## Caption Behavior

The UI displays the most recent text instead of rendering an unlimited transcript. Long conference talks can run for a long time, and repeatedly painting a very large text node on an iPhone can degrade readability and responsiveness. `Copy transcript` still copies the current accumulated transcript held by the SDK session.

`Clear` only clears the on-screen transcript state. It does not delete server data and does not affect any Soniox account state.

## Modes

- `EN → KO · Conference`: default mode for English presentation audio translated to Korean.
- `KO → EN · Test`: test mode for Korean speech translated to English.

Changing modes during a session stops the existing stream before the next session starts.
