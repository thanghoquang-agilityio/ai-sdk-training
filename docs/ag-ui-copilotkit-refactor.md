# AG-UI + CopilotKit Refactor Plan

## Guiding Constraint

Agents (`streamText`, tools, provider config, coordinator routing) are **not touched**.
Only the transport layer and React subscription layer change.

---

## Architecture Comparison

### Before

```
Browser                              Server (/api/chat)
──────                               ──────────────────
useChat (@ai-sdk/react)              routeConversation   ← coordinator
  DefaultChatTransport   ──POST──►   runManagerAgent     ← streamText
  UIMessage[]            ◄──SSE───   runEmployeeAgent    ← tools
  isToolUIPart                       toUIMessageStreamResponse()
  addToolApprovalResponse
  sendAutomaticallyWhen
ChatTranscript (UIMessage[])
```

### After

```
Browser                              Server (/api/copilotkit)
──────                               ────────────────────────
CopilotKitProvider                   CopilotRuntime
  useCopilotChat         ──POST──►     OurAGUIAgentAdapter (NEW)
  useCopilotAction       ◄──SSE───       routeConversation   (unchanged)
  CoAgentStateRender                     streamAgent         (unchanged)
ChatTranscript (adapted)                 AG-UI event emitter (NEW wrapper)
```

---

## AG-UI Event Sequence

Every request follows this lifecycle:

```
RunStartedEvent          { threadId, runId }
TextMessageChunkEvent    { messageId, delta }   × N     ← text tokens
ToolCallChunkEvent       { toolCallId, toolCallName, delta } × N
ToolCallResultEvent      { toolCallId, content }
RunFinishedEvent         { threadId, runId }            ← normal end
  OR
RunFinishedEvent         { outcome: { type: "interrupt", interrupts: [...] } }  ← HITL
```

---

## Phase 1 — Install Packages

```bash
npm install @copilotkit/react-core @copilotkit/runtime @ag-ui/core @ag-ui/client
```

| Package | Role |
|---|---|
| `@copilotkit/react-core` | `CopilotKitProvider`, `useCopilotChat`, `useCopilotAction` |
| `@copilotkit/runtime` | `CopilotRuntime`, Next.js handler, AI SDK adapter |
| `@ag-ui/core` | Event type definitions and schemas |
| `@ag-ui/client` | `HttpAgent`, Observable stream client |

---

## Phase 2 — Backend: AG-UI Event Adapter

### New file: `src/agents/chat-core/services/ag-ui-adapter.ts`

Extends AG-UI's `AbstractAgent` class. The `run()` method:

1. Receives `RunAgentInput` (messages, threadId, runId, tools)
2. Calls `routeConversation` with the messages (unchanged coordinator logic)
3. Delegates to `runManagerAgent` / `runEmployeeAgent` (unchanged)
4. Consumes the `streamText` result and re-emits as AG-UI events

```typescript
import { AbstractAgent } from "@ag-ui/client";
import { Observable } from "rxjs";
import { EventType } from "@ag-ui/core";
import { routeConversation } from "@/agents/chat-core";
import { runManagerAgent } from "@/agents/manager/run";
import { runEmployeeAgent } from "@/agents/employee/run";

export class OurAGUIAgentAdapter extends AbstractAgent {
  run(input: RunAgentInput) {
    return () =>
      new Observable((observer) => {
        // 1. Emit RunStarted
        observer.next({ type: EventType.RUN_STARTED, threadId: input.threadId, runId: input.runId });

        // 2. routeConversation → pick agent
        // 3. Stream agent output as AG-UI events
        // 4. Emit RunFinished (or RunFinished with interrupt for HITL)
        // 5. observer.complete()
      });
  }
}
```

### Modify `src/agents/chat-core/services/streaming.ts`

Add an `"agui"` output mode alongside the existing AI SDK mode:

- `streamAgent(..., { mode: "agui" })` — returns an AG-UI Observable instead of `toUIMessageStreamResponse()`
- The internal `streamText` call is **identical**; only the output serialization changes

---

## Phase 3 — Backend: New API Route

### New file: `src/app/api/copilotkit/route.ts`

```typescript
import { CopilotRuntime, copilotKitNextJSAppRouterHandler } from "@copilotkit/runtime";
import { OurAGUIAgentAdapter } from "@/agents/chat-core/services/ag-ui-adapter";

const runtime = new CopilotRuntime({
  agents: [new OurAGUIAgentAdapter()],
});

export const POST = copilotKitNextJSAppRouterHandler(runtime, {
  endpoint: "/api/copilotkit",
});
```

The existing `/api/chat` route can remain during transition. Remove it in the final cleanup commit.

---

## Phase 4 — Frontend: CopilotKit Provider

### Modify `src/app/layout.tsx`

Wrap children with `CopilotKit`. Provider/auth config moves here instead of `DefaultChatTransport`.

```tsx
import { CopilotKit } from "@copilotkit/react-core";

// In layout:
<CopilotKit runtimeUrl="/api/copilotkit" headers={...}>
  {children}
</CopilotKit>
```

---

## Phase 5 — Frontend: Replace `useChat`

### Modify `src/hooks/use-workspace-app.ts`

| Remove | Replace with |
|---|---|
| `useChat` from `@ai-sdk/react` | `useCopilotChat` from `@copilotkit/react-core` |
| `DefaultChatTransport` | removed — CopilotKit owns transport |
| `sendMessage({ text })` | `appendMessage({ role: "user", content })` |
| `addToolApprovalResponse(id, approved)` | removed — HITL via AG-UI interrupts |
| `sendAutomaticallyWhen(...)` | removed — CopilotKit handles resume automatically |
| `autoSubmittedApprovalIdsRef` | removed |

The `status === "submitted" | "streaming"` pattern maps to `useCopilotChat`'s `isLoading` flag.

---

## Phase 6 — Frontend: Message Format Adapter

CopilotKit messages differ from AI SDK's `UIMessage[]`. Two options:

**Option A (lower risk):** Write a pure converter.

```typescript
// src/utils/message-adapter.ts
import type { Message } from "@copilotkit/react-core";
import type { UIMessage } from "ai";

export function toUIMessage(msg: Message): UIMessage { ... }
```

Keep all `ChatTranscript` / `ChatMessage` / `cells.tsx` components unchanged.

**Option B:** Update `ChatTranscript` to accept `CopilotKit.Message[]` directly and remap rendering.

**Recommendation:** Option A — less diff, easier to review and roll back.

---

## Phase 7 — HITL Migration (Tool Approval)

### Current flow

```
needsApproval: true (tool def)
  → ToolApprovalCard rendered in transcript
  → user clicks approve/reject
  → addToolApprovalResponse(id, approved)
  → sendAutomaticallyWhen() fires next request
```

### New flow (AG-UI interrupt)

```
Agent emits RunFinishedEvent {
  outcome: { type: "interrupt", interrupts: [{ id, reason: "tool_call", message, toolCallId }] }
}
  → CopilotKit frontend surfaces interrupt
  → useCopilotAction({ name, render: () => <ApprovalCard /> }) handles render + collect response
  → CopilotKit sends RunAgentInput { resume: [{ id, response: { approved: true } }] }
  → Agent continues from where it left off
```

### Files changed for HITL

| File | Change |
|---|---|
| `src/agents/employee/tools/mutation/index.ts` | Remove `needsApproval: true`; ag-ui-adapter emits interrupt instead |
| `src/agents/manager/tools/mutation/index.ts` | Same |
| `src/agents/chat-core/services/ag-ui-adapter.ts` | Detect sensitive tool calls, emit `RunFinishedEvent` with interrupt payload |
| `src/components/transcript/cells.tsx` | Remove `ToolApprovalCard` row; CopilotKit renders approval UI via `useCopilotAction` |
| `src/components/workspace/app.tsx` | Remove `hasPendingApproval` state and `onToolApproval` prop wiring |
| `src/hooks/use-workspace-app.ts` | Remove `handleToolApproval`, `addToolApprovalResponse`, `autoSubmittedApprovalIdsRef` |

---

## Files That Do NOT Change

| Scope | Paths |
|---|---|
| Agent streaming core | `src/agents/chat-core/services/streaming.ts` |
| Employee / Manager / Date agents | `src/agents/*/run.ts` |
| All tool definitions + handlers | `src/agents/*/tools/**`, `src/agents/handlers/**` |
| All prompts | `src/agents/*/prompt/**` |
| Coordinator + routing | `src/agents/chat-core/services/coordinator.ts` |
| Provider / model config | `src/lib/ai-provider.ts` |
| RAG | `src/lib/rag/**` |
| Session / auth | `src/lib/auth/**` |
| All external services | `src/services/**` |

---

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| CopilotKit `Message[]` ≠ AI SDK `UIMessage[]` | Transcript breaks | Write `message-adapter.ts` converter; keep components unchanged |
| Thread management (`useChatThreads` depends on `setMessages`) | Threads break | Sync CopilotKit messages into `useChatThreads` or rewrite to use CopilotKit's thread model |
| Provider / auth body injection | Wrong model used | Pass via `CopilotKit` `headers` prop or custom fetch interceptor |
| Multi-agent routing (coordinator) | Wrong agent called | Coordinator logic moves into `OurAGUIAgentAdapter.run()` — same logic, new entry point |
| `needsApproval` removal | HITL lost during migration | Implement Phase 7 atomically; keep `/api/chat` live until HITL is verified |

---

## Recommended Implementation Order

```
1. npm install packages          → confirm build passes (no logic change)
2. ag-ui-adapter + /api/copilotkit → test with curl, verify AG-UI events stream
3. Add CopilotKitProvider        → no visual change; confirms provider wires up
4. Migrate useWorkspaceApp       → chat works end-to-end, without HITL
5. Write message-adapter         → transcript renders correctly
6. Migrate HITL (Phase 7)        → tool approval works again
7. Delete /api/chat + old useChat code (cleanup commit)
```

---

## Commit Strategy

Each phase = one commit, max 10 files:

| Commit | Message |
|---|---|
| Phase 1 | `chore(deps): add @copilotkit and @ag-ui packages` |
| Phase 2 | `feat(agent): add AG-UI event adapter wrapping streamAgent` |
| Phase 3 | `feat(api): add /api/copilotkit route with CopilotRuntime` |
| Phase 4 | `feat(layout): add CopilotKitProvider` |
| Phase 5 | `refactor(hooks): replace useChat with useCopilotChat` |
| Phase 6 | `feat(transcript): add CopilotKit message adapter` |
| Phase 7 | `feat(hitl): migrate tool approval to AG-UI interrupt/resume` |
| Cleanup | `chore: remove legacy /api/chat and DefaultChatTransport` |
