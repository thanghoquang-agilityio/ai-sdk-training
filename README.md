# Employee Assistant

A focused Next.js chat application for personal time-off management. Employees can check balances, list requests, submit new requests, and cancel existing ones — all through a conversational UI backed by role-aware AI agents.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router) |
| Language | TypeScript 5 |
| React | 19.2.3 |
| Package manager | pnpm 10 |
| AI SDK | Vercel AI SDK v6 (`ai`, `@ai-sdk/react`) |
| LLM providers | OpenAI (`@ai-sdk/openai`) / Ollama (OpenAI-compatible) |
| Validation | Zod v4 |
| Styling | Tailwind CSS v4 |
| Mock REST API | json-server v1 (flat JSON file) |

---

## Project Structure

```
src/
├── app/                        # Next.js App Router pages and API routes
│   └── api/
│       ├── chat/               # Main agent chat endpoint (POST)
│       ├── validate-openai-key/
│       └── validate-ollama-url/
│
├── agents/
│   ├── chat-core/              # Shared agent runtime (provider-agnostic)
│   │   ├── index.ts            # Public barrel — all external imports go here
│   │   ├── types/              # Shared TypeScript types
│   │   ├── logger/             # Agent run-stats logging
│   │   ├── services/
│   │   │   ├── coordinator.ts  # Routes message to employee or manager agent
│   │   │   ├── runner.ts       # Dispatches AgentRunInput → streamAgent
│   │   │   └── streaming.ts    # Core LLM streaming pipeline (streamText)
│   │   ├── utils/
│   │   │   └── response.ts     # HTTP response builders (static + streamed)
│   │   ├── observers/
│   │   │   ├── policy.ts       # Runtime config from AGENT_* env vars
│   │   │   ├── metrics.ts      # Token usage accounting
│   │   │   └── token-math.ts   # Token count estimation (~4 chars/token)
│   │   └── prompt/
│   │       └── builder.ts      # Context windowing + system prompt assembly
│   │
│   ├── employee/               # Employee specialist agent
│   │   ├── run.ts              # Entry point — builds prompt + tools, calls runAgent
│   │   ├── prompt/             # Static system prompt + runtime conversation builder
│   │   └── tools/              # read (balance, list, date-picker) + mutation (submit, cancel)
│   │
│   ├── manager/                # Manager specialist agent
│   │   ├── run.ts
│   │   ├── prompt/
│   │   └── tools/              # read (team list, requests) + mutation (approve, reject)
│   │
│   └── handlers/               # Business logic called by tools
│       ├── time-off/           # balance, queries, mutations, payload builders
│       └── common/             # date utilities
│
├── components/
│   ├── chat/                   # ChatComposer, ProviderSelector, tool cards
│   ├── transcript/             # Message rendering, tool output tables
│   ├── workspace/              # App shell, sidebar, auth panel
│   └── ui/                     # Primitives: Button, Input, Card, Badge, etc.
│
├── hooks/                      # useWorkspaceApp, useProvider, useThreads, etc.
├── constants/                  # All copy, config, and magic strings
├── lib/                        # ai-provider, auth, db, runtime-env
├── services/company-system/    # HTTP client for json-server CRUD
├── types/                      # Shared API and domain types
└── utils/                      # className, error, avatar, message helpers

server/
├── db/
│   ├── company-system.json     # Live database (mutated at runtime)
│   └── company-system.seed.json
└── scripts/
    └── company-system-server.mjs  # Starts json-server on port 4100

docs/
└── mermaid/                    # Architecture and flow diagrams
```

---

## How It Works

```
User message
    │
    ▼
POST /api/chat
    │
    ├─ coordinator.ts  ← regex routing, no LLM call
    │       │
    │       ├──► employee agent  (personal leave, balance)
    │       └──► manager agent   (team approvals, reports)
    │
    └─ streaming.ts  ← streamText → toUIMessageStreamResponse
                           ↑
                    observers/ (policy, metrics, token-math)
                    prompt/builder (context windowing)
```

The UI uses `useChat` from `@ai-sdk/react` with a custom transport. The protocol is the **Vercel AI SDK UI Message Stream** — not raw SSE or WebSocket. Tool results are returned as structured JSON and rendered as cards/tables by the FE; the LLM never exposes raw JSON to the user.

---

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env template
cp .env.example .env.local

# 3. Start everything (Next.js + json-server + Ollama if installed)
pnpm dev
```

Open `http://localhost:3000`

---

## Environment Variables

### Ollama (local, default in development)

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
OLLAMA_MODEL=qwen2.5:3b
```

> The `/v1` suffix is required. The app normalises it automatically but being explicit avoids surprises.

### OpenAI (required in production)

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
NEXT_PUBLIC_OPENAI_SERVER_READY=true   # skips UI key-entry when key is set server-side
```

### Agent tuning (optional)

```env
AGENT_STOP_STEP_COUNT=6       # max tool-use steps per turn
AGENT_TEMPERATURE=0.2
AGENT_MESSAGE_WINDOW=14       # messages kept in full before compaction
AGENT_MAX_RETRIES=2
AGENT_MAX_OUTPUT_TOKENS=1200
AGENT_RUN_STATS_LOG=1         # enable token/tool logging in production
```

### Company system server (optional overrides)

```env
COMPANY_SYSTEM_BASE_URL=http://127.0.0.1:4100
COMPANY_SYSTEM_HOST=127.0.0.1
COMPANY_SYSTEM_PORT=4100
```

---

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Start Next.js + json-server + Ollama concurrently |
| `pnpm dev:web` | Next.js only |
| `pnpm dev:company-system` | json-server on port 4100 |
| `pnpm dev:ollama` | Start Ollama if installed and not already running |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | ESLint |
| `pnpm company-system:reset` | Restore `company-system.json` from seed |
| `pnpm ollama:pull` | Pull default chat model (`qwen2.5:3b`) |
| `pnpm ollama:pull:vision` | Pull vision model (`gemma3:4b`) |

---

## Provider Behaviour

| Environment | Allowed providers | Key entry |
|---|---|---|
| Development | OpenAI + Ollama | Via sidebar UI or env |
| Production (`NODE_ENV=production`) | OpenAI only | Via sidebar UI or `OPENAI_API_KEY` env |

In production the provider selector is hidden (single option = no dropdown). If `NEXT_PUBLIC_OPENAI_SERVER_READY=true`, the UI skips manual key entry and uses the server-configured key directly.

---

## Database

All data lives in `server/db/company-system.json` and is served by json-server at `http://127.0.0.1:4100`.

Collections: `teams`, `employees`, `leave-entitlements`, `role-profiles`, `time-off-requests`.

To reset to seed state:

```bash
pnpm company-system:reset
```

---

## Notes

- If Next.js shows stale Turbopack cache errors, delete `.next/` and rerun `pnpm dev`.
- Slack webhook and token env vars are optional — only needed for the `createSlackReminder` tool.
- `NEXT_PUBLIC_MOCK_PRODUCTION=true` simulates production mode locally (useful for testing the OpenAI-only provider restriction).
