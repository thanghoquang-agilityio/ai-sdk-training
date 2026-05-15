# 📘 Tài liệu Chi tiết Kiến trúc Hệ thống Agent & UI

Tài liệu này tổng hợp **toàn bộ** cấu trúc, cách hoạt động và kỹ thuật đã áp dụng trong hệ thống AI Agent, bao gồm tích hợp CopilotKit, AG-UI, Vercel AI SDK, và toàn bộ lớp UI phản ứng theo agent state.

---

## 1. Tổng quan kiến trúc & Luồng dữ liệu

```
╔══════════════════════════════════════════════════════════════════════════╗
║  BROWSER (React / Next.js Client)                                        ║
║                                                                          ║
║  <CopilotKit runtimeUrl="/api/copilotkit" agent="leaveAssistant">        ║
║  │                                                                       ║
║  │  useWorkspaceApp()                                                    ║
║  │  ├── useAgentContext()       → gửi config lên server mỗi run         ║
║  │  ├── useAgent()             → đọc messages / isRunning / state       ║
║  │  │    └── agent.messages    → CopilotKit tự cập nhật qua SSE         ║
║  │  │    └── agent.state       → STATE_SNAPSHOT event → phase label     ║
║  │  ├── useFrontendTool()      → xử lý collect_date_range ở client      ║
║  │  ├── useCoAgentStateRender() → bind state cho CopilotKit chat UI     ║
║  │  └── useInterrupt()         → nhận on_interrupt → ConfirmActionCard  ║
║  │                                                                       ║
║  │  WorkspaceApp                                                         ║
║  │  ├── ChatTranscript → ChatMessage (per UIMessage)                    ║
║  │  │    ├── text parts → MessageBubble                                 ║
║  │  │    ├── tool parts → ToolOutputTable / MutationSuccessCard         ║
║  │  │    └── loading state → LoadingIndicator (phase-aware label)       ║
║  │  ├── ChatComposer → gửi text → agent.addMessage + runAgent()         ║
║  │  ├── DateRangePickerCard → render khi phase = awaiting_dates         ║
║  │  └── ConfirmActionCard   → render khi useInterrupt nhận event        ║
║  │                                                                       ║
╚══════════════════════════════════════════════════════════════════════════╝
                          │  POST /api/copilotkit (SSE)
                          ▼
╔══════════════════════════════════════════════════════════════════════════╗
║  SERVER (Next.js Route Handler)                                          ║
║                                                                          ║
║  CopilotRuntime                                                          ║
║  └── agents: { leaveAssistant: new LeaveAssistantAgent() }              ║
║       └── LeaveAssistantAgent.run(input) → Observable<BaseEvent>        ║
║            │                                                             ║
║            ├── parseAgentConfig()   → provider, API key, authRole       ║
║            ├── HITL resume check   → pendingTool + approved flag        ║
║            ├── agUIMessagesToUIMessages() → AG-UI → Vercel format       ║
║            ├── STATE_SNAPSHOT: "routing"                                 ║
║            ├── routeConversation()  → employee | manager | deny         ║
║            │                                                             ║
║            ├── runEmployeeFlow()                                         ║
║            │    ├── tryExtractIsoDatesDirect() / tryExtractDuration()   ║
║            │    ├── invokeDateAgent() (Date Specialist LLM)             ║
║            │    ├── pre-verify server-side (dryRun: true)               ║
║            │    ├── inject synthetic verify message                     ║
║            │    └── streamSpecialistEvents()                            ║
║            │                                                             ║
║            ├── runManagerFlow()                                          ║
║            │    ├── tryParseDirectMutationPrompt() → bypass LLM        ║
║            │    └── streamSpecialistEvents()                            ║
║            │                                                             ║
║            └── streamSpecialistEvents() → loop fullStream → BaseEvents  ║
║                 ├── text-delta         → TEXT_MESSAGE_CONTENT           ║
║                 ├── tool-input-*       → TOOL_CALL_START/ARGS/END       ║
║                 ├── [interrupt tool]   → CUSTOM(on_interrupt) + return  ║
║                 ├── [frontend tool]    → no TOOL_CALL_RESULT emitted    ║
║                 └── tool-result        → TOOL_CALL_RESULT               ║
╚══════════════════════════════════════════════════════════════════════════╝
```

**Nguyên tắc cốt lõi**:
- Server phát `BaseEvent` qua `Observable` → CopilotRuntime forward qua SSE stream → CopilotKit client nhận → `agent.messages` và `agent.state` tự cập nhật.
- Client **không cần** parse stream, manage message state, hay track tool calls thủ công.
- Mọi re-render đều driven by `agent.messages` (memoized qua `agUIMessagesToUIMessages`) và `agent.state`.

---

## 2. Dependencies chính

| Package | Version | Vai trò |
|---|---|---|
| `@copilotkit/react-core` | ^1.57.1 | Provider + tất cả hooks client-side |
| `@copilotkit/runtime` | ^1.57.1 | CopilotRuntime + AbstractAgent server-side |
| `@ag-ui/core` | ^0.0.53 | Định nghĩa EventType, BaseEvent, Message |
| `@ag-ui/client` | ^0.0.53 | AbstractAgent base class |
| `ai` (Vercel AI SDK) | ^6.0.81 | streamText, generateObject, smoothStream, UIMessage |
| `@ai-sdk/openai` | ^3.0.27 | OpenAI provider adapter |
| `rxjs` | ^7.8.1 | Observable — transport layer của LeaveAssistantAgent |
| `zod` | ^4.3.6 | Schema validation cho tools và useFrontendTool |
| `next` | 16.1.6 | App Router, Route Handlers (nodejs runtime) |

---

## 3. Provider — CopilotKit Setup

### 3.1 Client Provider

**File**: `src/components/workspace/app.tsx:65`

```tsx
// WorkspaceAppClient — wrapped inside WorkspaceApp (hydration guard)
<CopilotKit runtimeUrl="/api/copilotkit" agent="leaveAssistant">
  <WorkspaceContent ... />
</CopilotKit>
```

- `runtimeUrl`: Next.js Route Handler endpoint.
- `agent`: tên định danh. Phải khớp với key trong `CopilotRuntime.agents`.
- Tất cả hooks bên dưới đều đọc context từ đây qua React context — không cần prop-drilling.
- `WorkspaceApp` bọc `useSyncExternalStore` để guard SSR hydration mismatch, chỉ render client component sau khi hydrated.

### 3.2 Server Runtime

**File**: `src/app/api/copilotkit/route.ts`

```ts
const copilotRuntime = new CopilotRuntime({
  agents: {
    leaveAssistant: new LeaveAssistantAgent(),  // extends AbstractAgent
  },
});

const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
  runtime: copilotRuntime,
  endpoint: "/api/copilotkit",
});

export const GET = handleRequest;
export const POST = handleRequest;
export const runtime = "nodejs";  // Required: LanceDB, file I/O không chạy được trong edge
```

**CopilotRuntime** là message broker:
1. Nhận HTTP POST từ client (chứa messages, forwardedProps, context).
2. Tìm agent theo tên.
3. Gọi `agent.run(input)` → nhận `Observable<BaseEvent>`.
4. Subscribe Observable → forward từng event xuống SSE stream.
5. Client CopilotKit nhận SSE → parse events → cập nhật `agent.messages` và `agent.state`.

---

## 4. State — LeaveAssistantState & AgentPhase

**File**: `src/agents/chat-core/services/ag-ui-types.ts`

### 4.1 Định nghĩa State

```ts
type AgentPhase =
  | "routing"             // Coordinator đang phân loại → "Routing" label
  | "resolving_dates"     // Date specialist đang xử lý → "Resolving dates" label
  | "executing"           // Specialist chính đang chạy → "Processing" label
  | "awaiting_dates"      // Đợi user chọn ngày qua DateRangePickerCard
  | "awaiting_confirmation"; // Đợi user confirm/cancel qua ConfirmActionCard (HITL)

type PendingToolCall = {
  name: string;                        // VD: "submit_my_time_off_request"
  args: Record<string, unknown>;       // Args LLM đã chuẩn bị
  specialist: "employee" | "manager";  // Để biết dùng tools nào khi resume
  label: string;                       // VD: "Submit time-off request" (hiển thị trên card)
};

type LeaveAssistantState = {
  phase: AgentPhase;
  specialist?: "employee" | "manager";
  collectDateRangeLeaveType?: string;  // Khi awaiting_dates: pre-fill leave type cho DatePicker
  pendingTool?: PendingToolCall;        // Khi awaiting_confirmation: toàn bộ tool info để resume
};
```

### 4.2 Cách phát State từ server

```ts
// ag-ui-types.ts
export function emitState(observer: Observer<BaseEvent>, state: LeaveAssistantState) {
  observer.next({ type: EventType.STATE_SNAPSHOT, snapshot: state });
}
```

Mỗi lần phase thay đổi, server gọi `emitState()`. CopilotKit client nhận `STATE_SNAPSHOT` → cập nhật `agent.state` → React tự re-render (không cần `useState` thủ công).

### 4.3 State transitions theo lifecycle

```
User sends message
      │
      ▼
"routing" ──────────────────────── deny → emit error text → RUN_FINISHED
      │
      ▼ (employee | manager)
"resolving_dates"  ←── chỉ khi có date mention và cần Date Specialist
      │
      ▼
"executing"  ←── luôn luôn khi specialist chạy
      │
      ├──→ "awaiting_dates"         ←── past-date error hoặc no-date fallback
      │
      └──→ "awaiting_confirmation"  ←── mutation tool intercept (HITL)
                  │
                  ▼ (user confirm/cancel)
           resume → "executing" → RUN_FINISHED
```

---

## 5. Lifecycle — Toàn bộ vòng đời một lượt chat

### Bước 1: User gửi tin nhắn

**File**: `src/hooks/use-workspace-app.ts:192`

```ts
async function submitTextMessage(text: string) {
  const userMsg: Message = {
    id: crypto.randomUUID(),
    role: "user",
    content: messageText,
  };
  agent.addMessage(userMsg);           // Thêm vào agent.messages (UI update ngay lập tức)
  await copilotkit.runAgent({ agent }); // POST /api/copilotkit với toàn bộ messages + context
}
```

`copilotkit.runAgent()` serialize toàn bộ `agent.messages` + context từ `useAgentContext` → gửi POST.

### Bước 2: Server nhận, LeaveAssistantAgent.run() bắt đầu

**File**: `src/agents/chat-core/services/ag-ui-adapter.ts:176`

```ts
run(input: RunAgentInput): Observable<BaseEvent> {
  return new Observable((observer) => {
    observer.next({ type: EventType.RUN_STARTED, threadId: input.threadId, runId: input.runId });

    (async () => {
      // 1. Parse config từ input.context (provider, API key, authRole)
      const config = parseAgentConfig(input);

      // 2. Resolve auth session (employee / manager)
      const session = await getMockAuthSession(isAppRole(rawRole) ? rawRole : "user");

      // 3. Resolve model (OpenAI hoặc Ollama)
      const candidates = getChatModelCandidates({ provider, openaiApiKey, baseUrl });
      const { model } = candidates[0];

      // 4. Kiểm tra HITL resume signal
      const resume = forwardedProps?.command?.resume;  // { approved: boolean }
      const prevState = input.state as LeaveAssistantState;

      if (resume !== undefined && prevState?.pendingTool) {
        await handleResumedAction(observer, runId, prevState.pendingTool, resume.approved, ...);
        // → RUN_FINISHED → complete
        return;
      }

      // 5. Convert messages: AG-UI Message[] → Vercel UIMessage[]
      const uiMessages = agUIMessagesToUIMessages(input.messages);

      // 6. Routing
      emitState(observer, { phase: "routing" });
      const decision = await routeConversation({ model, messages: uiMessages, session });

      if (decision.type === "deny") { /* emit text + RUN_FINISHED */ return; }

      // 7. Dispatch tới specialist
      if (decision.specialist === "manager") {
        await runManagerFlow(observer, runId, uiMessages, session, model);
      } else {
        await runEmployeeFlow(observer, runId, uiMessages, session, model);
      }

      observer.next({ type: EventType.RUN_FINISHED, ... });
      observer.complete();

    })().catch((error) => {
      observer.next({ type: EventType.RUN_ERROR, message: getErrorMessage(error) });
      observer.error(error);
    });
  });
}
```

### Bước 3: parseAgentConfig — Đọc context từ client

**File**: `src/agents/chat-core/services/ag-ui-adapter.ts:33`

```ts
function parseAgentConfig(input: RunAgentInput): AgentConfig {
  // Tìm trong input.context (array of { description, value })
  const contextEntry = input.context.find((c) =>
    c.description.startsWith("Leave assistant configuration"),
  );
  if (contextEntry) {
    return JSON.parse(contextEntry.value) as AgentConfig;
  }
  // Fallback: forwardedProps (cũ)
  return (input.forwardedProps ?? {}) as AgentConfig;
}
```

Context được gửi lên bởi `useAgentContext` hook ở client (xem mục 7.2).

### Bước 4: Model Selection

**File**: `src/lib/ai-provider.ts`

```ts
const candidates = getChatModelCandidates({
  provider: providerOverride,   // "openai" | "ollama" | undefined
  openaiApiKey: config.openaiApiKey,
  baseUrl: providerOverride === "ollama" ? normalizedOllamaBaseUrl : undefined,
});
const { model } = candidates[0];
```

`getChatModelCandidates` build priority list:
- Nếu `provider` được chỉ định → dùng ngay, throw nếu fail.
- Nếu không → `AI_PROVIDER` env var → default (`openai` trên prod, `ollama` trên dev).
- OpenAI: `gpt-4o-mini` (mặc định), override bằng `OPENAI_MODEL` env.
- Ollama: `qwen2.5:3b` (mặc định), kết nối qua OpenAI-compatible endpoint `http://localhost:11434/v1`.

### Bước 5: Coordinator Routing

**File**: `src/agents/chat-core/services/coordinator.ts`

```ts
const { object } = await generateObject({
  model,
  schema: z.object({
    specialist: z.enum(["employee", "manager", "out_of_scope"])
  }),
  system: buildRoutingSystemPrompt(session),  // Bao gồm danh sách direct reports nếu là manager
  prompt: latestUserText,
});
```

`generateObject` (không phải `streamText`) — dùng JSON mode để đảm bảo output schema.

- `out_of_scope` → emit deny message, kết thúc.
- `manager` nhưng session.role !== "manager" → emit deny "Switch to Manager mode".
- Còn lại → delegate.

Routing prompt bao gồm danh sách `session.managedEmployees` → LLM route đúng khi user nhắc tên nhân viên trong context quản lý.

---

## 6. Employee Flow — Chi tiết

**File**: `src/agents/chat-core/services/ag-ui-employee.ts`

`runEmployeeFlow()` là luồng phức tạp nhất, có nhiều preprocessing trước khi gọi LLM.

### 6.1 Date Extraction — 3 tầng

```
Tầng 1: Regex ISO trực tiếp  (tryExtractIsoDatesDirect)
  ├── ISO range: "2026-05-20 to 2026-05-21"
  ├── ISO single: "2026-05-20"
  ├── Human range: "May 20, 2026 to June 5, 2026"
  └── Human single: "May 20, 2026"

Tầng 2: Duration pattern  (tryExtractDurationDates)
  └── "3 days starting from May 20" → startDate=2026-05-20, endDate=2026-05-23

Tầng 3: Date Specialist LLM  (invokeDateAgent)
  └── Kích hoạt khi DATE_MENTION_REGEX match nhưng Regex không parse được
  └── Xử lý: "next Monday", "tomorrow", "this Friday", relative dates
```

`DATE_MENTION_REGEX`: detect bất kỳ mention nào về ngày — ISO dates, tháng bằng chữ, thứ trong tuần, "tomorrow", "today", "next X", "N days from".

### 6.2 Validation ngày trong quá khứ

```ts
if (preResolvedDates && isStartDateInPast(preResolvedDates.startDate, session.timeZone)) {
  // Emit error message
  observer.next({ type: TEXT_MESSAGE_START, ... });
  observer.next({ type: TEXT_MESSAGE_CONTENT, delta: `The dates (${start} to ${end}) are in the past...` });
  observer.next({ type: TEXT_MESSAGE_END, ... });
  // Emit phase: awaiting_dates → DateRangePickerCard tự xuất hiện
  emitState(observer, { phase: "awaiting_dates", specialist: "employee", collectDateRangeLeaveType: leaveType });
  return;  // Kết thúc sớm, không gọi LLM
}
```

`isStartDateInPast` convert cả `startDate` và `today` thành UTC day numbers để so sánh timezone-safe.

### 6.3 History Fallback cho Dates & Context

```ts
// Khi user nhắn tin "because of a family event" (không có ngày) sau khi đã nói ngày trước:
if (!preResolvedDates) {
  preResolvedDates = extractDatesFromHistory(uiMessages.slice(0, -1));
  // Scan toàn bộ user messages ngược từ cuối để tìm date mention gần nhất
}
```

Tương tự cho `leaveType` và `reason`: `extractLeaveContextFromHistory` scan cả user text lẫn `dynamic-tool.input` của assistant.

**Kỹ thuật phát hiện reason không cần trigger phrase**:
```ts
// Nếu assistant vừa hỏi reason (pattern matching), và user reply không phải date hay leave type
if (!reason && lastAssistantAskedForReason(messages)) {
  const latestUserText = getLatestUserText(messages);
  if (latestUserText.length >= 2 && latestUserText.length <= 200 && !DATE_MENTION_REGEX.test(latestUserText)) {
    reason = latestUserText;  // User's reply IS the reason
  }
}
```

### 6.4 Server-side Pre-verify + Synthetic Message (kỹ thuật quan trọng)

```ts
// Khi có đủ leaveType + dates + reason → verify trước khi gọi LLM
if (preResolvedDates && extractedCtx?.leaveType && extractedCtx.reason) {
  const verifyResult = await submitMyTimeOffRequest(session, {
    leaveType, startDate, endDate, reason,
    dryRun: true,  // Không thực sự submit, chỉ validate
  });

  if (verifyResult.ok) {
    preVerified = { leaveType, startDate, endDate, reason };
  }
}
```

Sau đó **inject synthetic message** vào history:

```ts
const streamMessages = preVerified
  ? [
      ...uiMessages,
      {
        id: `synth-verify-${runId}`,
        role: "assistant",
        parts: [{
          type: "dynamic-tool",
          toolName: "verify_my_time_off_request",
          toolCallId: `synth-vc-${runId}`,
          state: "output-available",
          input: { leaveType, startDate, endDate, reason },
          output: { ok: true, message: "Leave request is valid. Ready to submit." },
        }],
      },
    ]
  : uiMessages;
```

**Tại sao**: LLM (đặc biệt Ollama) có xu hướng tính lại ngày hoặc hỏi thêm thông tin nếu không thấy verify result trong history. Bằng cách inject synthetic message, LLM "tin" rằng verify đã xong → gọi thẳng `submit_my_time_off_request` với đúng args.

System prompt cũng thay đổi theo:
```
### Server-side pre-verification complete
Your ONLY action is to call submit_my_time_off_request with the EXACT SAME arguments
from the verify call shown in the conversation history above.
Do NOT recalculate dates. Do NOT write any text. Do NOT call verify again. Just call submit immediately.
```

### 6.5 Prompt Engineering theo context

`buildEmployeeConversationPrompt` có 4 output path khác nhau dựa trên state:

| Condition | System Prompt thêm |
|---|---|
| `preVerified` | "ONLY call submit with exact args from verify. Stop." |
| No dates, có context | "dates still needed → call collect_date_range immediately" |
| No dates, no context | Base prompt |
| Dates có, thiếu fields | "Missing: leaveType / reason → ask ONE question, nothing else" |
| Dates có, tất cả đủ | "Context Complete → call verify immediately" |

### 6.6 Fallback: LLM hỏi ngày bằng text

```ts
if (!collectDateRangeCalled && modelAskedForDatesInText(capturedText)) {
  // LLM wrote "please provide start and end dates" instead of calling collect_date_range
  emitState(observer, { phase: "awaiting_dates", ... });
}
```

`DATE_REQUEST_PATTERNS` detect: "start and end date", "provide ... date", "YYYY-MM-DD", "when ... leave/vacation", "what date", "select dates".

---

## 7. Manager Flow — Chi tiết

**File**: `src/agents/chat-core/services/ag-ui-manager.ts`

### 7.1 Direct Mutation Bypass (không cần LLM)

Khi user click "Approve"/"Reject" trên bảng trong UI, `buildTeamActionPrompt` tạo message theo format chuẩn:
```
"Approve Mia Nguyen Annual leave 2026-05-12 to 2026-05-13. Comment: Approved."
"Reject John Doe Sick leave 2026-05-15 to 2026-05-16. Reason: Not approved."
```

Server detect format này:
```ts
const directMutation = tryParseDirectMutationPrompt(lastUserText);
if (directMutation) {
  emitMutationInterrupt(observer, directMutation);
  return;  // Bypass LLM hoàn toàn
}
```

Regex: `/^(Approve|Reject)\s+(.+?)\.\s*(?:Reason|Comment):\s*(.+?)\.?\s*$/i`

Kết quả: `{ name, args: { requestQuery, comment, showTeamPending: true }, label }` → emit interrupt ngay.

### 7.2 Post-stream Fallback

```ts
// Sau khi stream xong, nếu LLM đã tự "approve/reject" trong text mà không call tool
if (!interruptFired && hasMutationInResponse(accumulatedText)) {
  const fallbackMutation = tryParseDirectMutationPrompt(lastUserText);
  if (fallbackMutation) emitMutationInterrupt(observer, fallbackMutation);
}
```

`MUTATION_RESPONSE_PATTERNS` detect: "I've approved", "I've rejected", "approved the request", "rejected the leave"...

---

## 8. Stream Pipeline — streamSpecialistEvents

**File**: `src/agents/chat-core/services/ag-ui-stream.ts`

Đây là core bridge giữa Vercel AI SDK và AG-UI event system.

### 8.1 Setup

```ts
export async function streamSpecialistEvents(
  observer: Observer<BaseEvent>,
  opts: StreamSpecialistOptions,
): Promise<void> {
  const runPolicy = resolveAgentRunPolicy();

  // Compaction
  const conversation = buildConversationRuntimeContext({
    messages: opts.uiMessages,
    messageWindow: runPolicy.messageWindow,  // Default 14
  });

  // Inject runtime notes vào system prompt
  const systemPrompt = buildRuntimeSystemPrompt({
    baseSystemPrompt: opts.baseSystemPrompt,
    latestUserText: conversation.latestUserText,
    olderContextSummary: conversation.olderContextSummary,  // Nếu có
    hasCompactedHistory: conversation.hasCompactedHistory,
  });

  // Convert UIMessage[] → ModelMessage[] cho AI SDK
  const modelMessages = await convertToModelMessages(conversation.recentMessages);

  // Wrap interrupt tools: thay execute bằng () => ({ __pending: true })
  const wrappedTools = wrapInterruptTools(opts.tools);

  const result = streamText({
    model: opts.model,
    system: systemPrompt,
    messages: modelMessages,
    tools: wrappedTools,
    stopWhen: [
      stepCountIs(runPolicy.stopStepCount),   // Tối đa 6 steps (configurable)
      hasCalledTerminalTool,                  // Dừng ngay nếu collect_date_range được gọi
    ],
    temperature: runPolicy.temperature,       // 0.2
    maxRetries: runPolicy.maxRetries,         // 2
    maxOutputTokens: runPolicy.maxOutputTokens,
    experimental_transform: smoothStream({
      delayInMs: runPolicy.streamChunkDelayMs,  // 30ms
      chunking: /[\s\S]/,                        // Per-character chunking
    }),
  });
  ...
}
```

### 8.2 Event Loop — Chi tiết từng loại event

```ts
let currentTextMsgId: string | null = opts.initialMessageId ?? null;
let interceptingToolId: string | null = null;  // ID của interrupt tool đang bị suppress
let interceptingArgsBuf = "";                   // Buffer args của interrupt tool

for await (const part of result.fullStream) {

  if (part.type === "text-delta") {
    // Lazy init: tạo TEXT_MESSAGE_START lần đầu tiên có text
    if (!currentTextMsgId) {
      currentTextMsgId = `text-${opts.runId}-${seq++}`;
      observer.next({ type: TEXT_MESSAGE_START, messageId, role: "assistant" });
    }
    observer.next({ type: TEXT_MESSAGE_CONTENT, messageId: currentTextMsgId, delta: part.text });
    opts.onTextDelta?.(part.text);  // Capture cho fallback detection

  } else if (part.type === "tool-input-start") {

    if (INTERRUPT_TOOL_NAMES.has(part.toolName) && !interceptingToolId) {
      // INTERRUPT PATH: suppress event, buffer args silently
      interceptingToolId = part.id;
      interceptingToolName = part.toolName;
      interceptingArgsBuf = "";

    } else if (!interceptingToolId) {
      // NORMAL PATH hoặc FRONTEND TOOL PATH

      // Đảm bảo có message container trước khi emit tool call
      if (!currentTextMsgId) {
        currentTextMsgId = `text-${runId}-${seq++}`;
        observer.next({ type: TEXT_MESSAGE_START, messageId: currentTextMsgId, ... });

        // Frontend tools: inject fallback text vào assistant bubble
        // (ví dụ: collect_date_range không có text trước → "Select dates for your time-off request.")
        const fallback = FRONTEND_TOOL_FALLBACK_TEXT[part.toolName];
        if (fallback && FRONTEND_TOOL_NAMES.has(part.toolName)) {
          observer.next({ type: TEXT_MESSAGE_CONTENT, delta: fallback, ... });
        }
      }

      observer.next({ type: TOOL_CALL_START, toolCallId: part.id, toolCallName: part.toolName, parentMessageId: currentTextMsgId });
    }

  } else if (part.type === "tool-input-delta") {
    if (part.id === interceptingToolId) {
      interceptingArgsBuf += part.delta;  // Buffer silently
    } else {
      observer.next({ type: TOOL_CALL_ARGS, toolCallId: part.id, delta: part.delta });
    }

  } else if (part.type === "tool-input-end") {
    if (part.id === interceptingToolId) {
      // Args hoàn chỉnh → parse JSON → fire interrupt → RETURN sớm
      if (currentTextMsgId) {
        observer.next({ type: TEXT_MESSAGE_END, messageId: currentTextMsgId });
      }
      const args = JSON.parse(interceptingArgsBuf);
      opts.onInterrupt?.({ name: interceptingToolName!, args, label: INTERRUPT_TOOL_LABELS[interceptingToolName!] });
      return;  // Kết thúc stream ngay lập tức

    } else {
      observer.next({ type: TOOL_CALL_END, toolCallId: part.id });
      const completedToolName = toolCallNames.get(part.id);
      if (completedToolName && FRONTEND_TOOL_NAMES.has(completedToolName)) {
        opts.onFrontendTool?.(completedToolName);  // Notify: date picker tool đã gọi
      }
    }

  } else if (part.type === "tool-result") {
    const toolName = toolCallNames.get(part.toolCallId);
    if (!FRONTEND_TOOL_NAMES.has(toolName ?? "")) {
      // Backend tools: emit result về client
      observer.next({ type: TOOL_CALL_RESULT, toolCallId, content: JSON.stringify(output) });
    }
    // Frontend tools: KHÔNG emit TOOL_CALL_RESULT
    // CopilotKit phát hiện unresolved tool call → gọi useFrontendTool handler

  } else if (part.type === "finish-step") {
    // Kết thúc 1 step (multi-step agent turn)
    if (currentTextMsgId && !hasToolCallInCurrentStep) {
      observer.next({ type: TEXT_MESSAGE_END, messageId: currentTextMsgId });
      currentTextMsgId = null;
    }
    hasToolCallInCurrentStep = false;
  }
}
```

### 8.3 Tool Categories — 3 loại tool

| Category | Tools | Behavior |
|---|---|---|
| **Terminal tools** | `collect_date_range` | `stopWhen: hasCalledTerminalTool` → dừng toàn bộ stream sau khi tool được gọi |
| **Frontend tools** | `collect_date_range` | Server emit `TOOL_CALL_START/ARGS/END` nhưng KHÔNG emit `TOOL_CALL_RESULT` → CopilotKit gọi `useFrontendTool` handler |
| **Interrupt tools** | `submit/cancel/approve/reject_*` | `wrapInterruptTools()` thay `execute` bằng `() => ({ __pending: true })` → stream bị suppress → `onInterrupt` callback → CUSTOM event |
| **Backend tools** | Tất cả còn lại | Execute bình thường → emit `TOOL_CALL_RESULT` |

`collect_date_range` vừa là terminal vừa là frontend tool (cả hai set đều chứa nó).

### 8.4 wrapInterruptTools — Cơ chế intercept

```ts
function wrapInterruptTools(tools: ToolSet): ToolSet {
  const result: ToolSet = {};
  for (const [name, t] of Object.entries(tools)) {
    if (INTERRUPT_TOOL_NAMES.has(name)) {
      // Override execute: không thực thi thật, chỉ return pending marker
      result[name] = { ...t, execute: async () => ({ __pending: true }) };
    } else {
      result[name] = t;
    }
  }
  return result;
}
```

Nhờ đó, khi LLM quyết định gọi `submit_my_time_off_request`:
1. AI SDK nhận tool call → gọi `execute()` → nhận `{ __pending: true }` (không phải kết quả thật).
2. Trong `fullStream`, khi `tool-input-end` → `onInterrupt` callback được gọi.
3. Observer emit `STATE_SNAPSHOT(awaiting_confirmation)` + `CUSTOM(on_interrupt)`.
4. `return` ngay → stream kết thúc mà không tiếp tục.

---

## 9. Hooks — Hướng dẫn sử dụng chi tiết

**File**: `src/hooks/use-workspace-app.ts`

### 9.1 `useAgent` — Đọc toàn bộ agent state

```ts
const { agent } = useAgent({ agentId: "leaveAssistant" });

// Các fields quan trọng:
const agentMessages = agent.messages as Message[];        // AG-UI Message[] (flat)
const isLoading = agent.isRunning;                        // true khi đang stream
const agentState = agent.state as LeaveAssistantState;   // Latest STATE_SNAPSHOT

// Các actions:
agent.addMessage(msg);      // Thêm message vào local state (UI update ngay)
agent.setMessages(msgs);    // Replace toàn bộ messages (dùng khi switch thread)
```

CopilotKit update `agent.messages` realtime khi nhận:
- `TEXT_MESSAGE_START` → tạo assistant message mới
- `TEXT_MESSAGE_CONTENT` → append delta vào message content
- `TEXT_MESSAGE_END` → finalize message
- `TOOL_CALL_START/ARGS/END` → attach tool call vào assistant message
- `TOOL_CALL_RESULT` → attach result vào tool call

### 9.2 `useAgentContext` — Gửi config lên server

```ts
useAgentContext({
  description: "Leave assistant configuration: provider type, API key, Ollama URL, and current user auth role",
  value: {
    provider: provider.requestBody.provider,      // "openai" | "ollama"
    openaiApiKey: provider.requestBody.openaiApiKey ?? null,
    ollamaBaseUrl: provider.requestBody.ollamaBaseUrl ?? null,
    authRole: selectedRole,                        // "user" | "manager"
  },
});
```

Context này được serialize vào mỗi request dưới dạng:
```json
{ "description": "Leave assistant configuration...", "value": "{...JSON...}" }
```

Server đọc bằng `parseAgentConfig(input)`. Đây là cách client truyền config động (thay đổi provider, role) mà không cần restart server hay dùng URL params.

### 9.3 `useCopilotKit` — Trigger agent run

```ts
const { copilotkit } = useCopilotKit();

// Gọi sau agent.addMessage()
await copilotkit.runAgent({ agent });
```

`runAgent` thực hiện:
1. Serialize `agent.messages` + context.
2. POST tới `/api/copilotkit`.
3. Parse SSE stream → update `agent.messages` và `agent.state` realtime.
4. `isRunning` = true trong suốt quá trình.

### 9.4 `useFrontendTool` — Tool chạy ở client

```ts
useFrontendTool(
  {
    name: "collect_date_range",
    description: "Shows a date range picker to collect leave dates...",
    parameters: z.object({
      leaveType: z.enum(["annual", "sick", "personal", "unpaid"]).optional(),
      reason: z.string().optional(),
    }),
    handler: async ({ leaveType }) => {
      setLocalLeaveType(leaveType);   // Pre-fill DateRangePickerCard
      setFrontendDatePicker(true);    // Trigger date picker render
      return {
        ok: true,
        message: "Date picker displayed. Waiting for user to select a date range.",
      };
    },
    followUp: false,  // CopilotKit sẽ KHÔNG gọi LLM follow-up sau tool này
  },
  [],  // Dependencies
);
```

**Cơ chế**: Server emit `TOOL_CALL_START` cho `collect_date_range` nhưng không emit `TOOL_CALL_RESULT`. CopilotKit phát hiện tool call "unresolved" → tìm registered frontend tool → gọi `handler` ở client.

`followUp: false` quan trọng: nếu không set, CopilotKit có thể gọi lại LLM sau khi handler return — điều này không mong muốn vì date picker đang chờ user.

### 9.5 `useCoAgentStateRender` — Bind state cho built-in chat UI

```ts
useCoAgentStateRender<LeaveAssistantState>({
  name: "leaveAssistant",
  render: ({ state, status }) => {
    if (status !== "inProgress") return null;
    if (state?.phase === "routing") return "Routing";
    if (state?.phase === "resolving_dates") return "Resolving dates";
    if (state?.phase === "executing") return "Processing";
    return null;
  },
});
```

Hook này phục vụ CopilotKit's built-in chat UI (nếu dùng). Trong custom UI của project, label được derive trực tiếp từ `agentState.phase`:

```ts
const thinkingLabel = useMemo(() => {
  if (agentState?.phase === "routing") return "Routing";
  if (agentState?.phase === "resolving_dates") return "Resolving dates";
  if (agentState?.phase === "executing") return "Processing";
  return "Thinking";  // Fallback
}, [agentState?.phase]);
```

### 9.6 `useInterrupt` — Human-in-the-Loop confirmation

```ts
// app.tsx
const interruptCard = useInterrupt({
  agentId: "leaveAssistant",
  renderInChat: false,  // Không auto-inject vào chat — ta tự render
  render: ({ event, resolve }) => (
    <ConfirmActionCard
      toolName={(event.value as { toolName: string }).toolName}
      label={(event.value as { label: string }).label}
      args={(event.value as { args: Record<string, unknown> }).args}
      employeeEmail={(event.value as { args: { employeeEmail?: string } }).args.employeeEmail}
      employeeAvatar={(event.value as { args: { employeeAvatar?: string } }).args.employeeAvatar}
      disabled={isLoading}
      userAvatarUrl={auth.session.avatar}
      userInitials={getInitialsFromName(auth.session.name)}
      onApproveAction={() => resolve({ approved: true })}
      onRejectAction={() => resolve({ approved: false })}
    />
  ),
});

// Guard: ẩn card stale khi thread switch/delete
const confirmCard = messages.length > 0 ? interruptCard : null;
```

`event.value` là payload từ `CUSTOM(on_interrupt)` event — chứa `{ toolName, args, label }` từ server.

`resolve(data)` gọi với `{ approved: boolean }`:
- CopilotKit serialize `data` thành `forwardedProps.command.resume = { approved }`.
- Re-run agent với state còn nguyên (bao gồm `pendingTool`).
- Server nhận → `handleResumedAction()`.

---

## 10. HITL Resume — Tiếp tục sau confirmation

**File**: `src/agents/chat-core/services/ag-ui-adapter.ts:94`

```ts
async function handleResumedAction(
  observer, runId, pendingTool, approved, session, model, inputMessages
) {
  emitState(observer, { phase: "executing", specialist: pendingTool.specialist });

  if (!approved) {
    // Emit "Action cancelled." message → kết thúc
    return;
  }

  // Resolve tools cho đúng specialist
  const tools = resolveAgentTools(pendingTool.specialist, session, {}, model);
  const toolDef = tools[pendingTool.name];

  // 1. Emit tool call events (visible trong UI)
  const msgId = `resume-msg-${runId}`;
  const toolCallId = `resume-tc-${runId}`;
  observer.next({ type: TEXT_MESSAGE_START, messageId: msgId, ... });
  observer.next({ type: TOOL_CALL_START, toolCallId, toolCallName: pendingTool.name, parentMessageId: msgId });
  observer.next({ type: TOOL_CALL_ARGS, toolCallId, delta: JSON.stringify(pendingTool.args) });
  observer.next({ type: TOOL_CALL_END, toolCallId });

  // 2. Thực thi tool THẬT SỰ với args đã được LLM chuẩn bị
  const result = await toolDef.execute(pendingTool.args, { messages: [], toolCallId, ... });

  // 3. Emit result
  observer.next({ type: TOOL_CALL_RESULT, toolCallId, content: JSON.stringify(result) });

  // 4. Stream follow-up response (giải thích kết quả) trong CÙNG message bubble
  // — truyền initialMessageId: msgId để text và table xuất hiện cùng 1 bubble
  const existingUIMessages = agUIMessagesToUIMessages(inputMessages);
  const toolUIMessage = { ... };  // Synthetic message chứa tool result

  await streamSpecialistEvents(observer, {
    ...
    uiMessages: [...existingUIMessages, toolUIMessage],
    initialMessageId: msgId,  // Tiếp tục stream trong message đã mở
  });
}
```

`initialMessageId` là kỹ thuật để tool call, tool result và follow-up text nằm trong **cùng 1 message bubble** trên UI.

---

## 11. Message Conversion — AG-UI ↔ Vercel UIMessage

**File**: `src/utils/message-adapter.ts` (client) và `src/agents/chat-core/services/ag-ui-adapter.ts` (server)

### 11.1 AG-UI format vs Vercel UIMessage format

**AG-UI (flat)**:
```
[
  { id, role: "user",      content: "I want sick leave" },
  { id, role: "assistant", content: "...", toolCalls: [{ id, function: { name, arguments } }] },
  { id, role: "tool",      toolCallId, content: "{result JSON}" },
]
```

**Vercel UIMessage (nested)**:
```
[
  { id, role: "user",      parts: [{ type: "text", text: "I want sick leave" }] },
  { id, role: "assistant", parts: [
    { type: "text", text: "..." },
    { type: "dynamic-tool", toolCallId, toolName, state: "output-available", input: {...}, output: {...} }
  ]},
]
```

### 11.2 Conversion Process — 3 pass

**Pass 1**: Build UIMessage[], index `toolCallLocation`:
```ts
for (const msg of messages) {
  if (msg.role === "user") → push text UIMessage
  if (msg.role === "assistant") → push UIMessage với text parts + dynamic-tool parts (state: "input-available")
  if (msg.role === "tool") → needsToolResultPass = true
}
```

**Pass 2**: Apply tool results:
```ts
for (const msg of messages) {
  if (msg.role !== "tool") continue;
  const location = toolCallLocation.get(msg.toolCallId);
  // Patch dynamic-tool part: state → "output-available", output → parsed result
  targetMsg.parts[location.partIndex] = { ...targetPart, state: "output-available", output };
}
```

**Pass 3**: Cache cho React.memo:
```ts
for (let i = 0; i < result.length; i++) {
  const hash = JSON.stringify(fresh);
  const cached = uiMessageCache.get(fresh.id);
  if (cached?.hash === hash) {
    result[i] = cached.ui;  // Reuse same object reference → React.memo hiệu quả
  }
}
```

Cache cleanup: khi `uiMessageCache.size > result.length + 20`, xóa IDs không còn trong messages.

---

## 12. Components — Chi tiết từng component

### 12.1 WorkspaceApp / WorkspaceAppClient

**File**: `src/components/workspace/app.tsx`

```
WorkspaceApp
├── useSyncExternalStore  → hydration guard (server renders skeleton, client renders full)
│    └── isHydrated = false → render skeleton divs (tránh hydration mismatch)
└── WorkspaceAppClient    → chỉ render sau hydration
     └── <CopilotKit>
          └── WorkspaceContent
               ├── useWorkspaceApp()  → toàn bộ state + handlers
               ├── useInterrupt()     → ConfirmActionCard renderer
               └── Layout: ThreadSidebar | header | ChatTranscript | ChatComposer
```

### 12.2 ChatTranscript

**File**: `src/components/transcript/index.tsx`

- `containerRef`: dùng bởi `useChatAutoScroll` để auto-scroll khi có messages mới.
- `stableOnSelectPrompt`: ref-wrapped callback để `React.memo` trên `ChatMessage` không bị invalidate.
- Render order: messages → LoadingIndicator (khi `isLoading && lastMessage.role === "user"`) → datePicker → confirmCard.
- `datePicker` và `confirmCard` nhận dưới dạng `ReactNode` → `WorkspaceContent` quyết định khi nào render.

### 12.3 ChatMessage

**File**: `src/components/transcript/message.tsx`

Đây là component phức tạp nhất, xử lý tất cả visual rendering.

**Input pipeline**:
```
UIMessage
├── getTextParts()     → rawText
├── getToolParts()     → toolParts[]
│    ├── getToolOutputTables()    → visibleOutputTables[]
│    ├── getMutationSuccessCard() → mutationSuccessCards[]
│    ├── getToolStepText()        → currentToolStep (loading label)
│    └── getToolStatusCopy()      → statusParts[] (error/success card)
└── readMessageMeta()  → agentLabel (for loading indicator)
```

**Deferred rendering logic** (tránh flash):
```ts
// shouldDeferOutputTables: ẩn bảng trong khi tool vẫn đang chạy
const shouldDeferOutputTables = isLastMessage && isLoading && loadingStartRawTextRef.current === 0;

// shouldDeferSuccessCards: ẩn success card cho đến khi text bắt đầu stream
const shouldDeferSuccessCards = isLastMessage && isLoading && text.length === 0;

// shouldShowThinkingSkeleton: hiển thị loading khi chưa có text
const shouldShowThinkingSkeleton = isLastMessage && isLoading && text.length === 0;
```

`loadingStartRawTextRef` capture `rawText.length` tại thời điểm message bắt đầu loading. Kỹ thuật này phân biệt "fresh generation" (length=0) với "completed message re-appearing as last" (length>0).

**Layout mode**:
- `embedOutputTablesInBubble = true`: khi có tables → render tables bên trong `MessageBubble` (full-width).
- `useTableLeadInLayout`: khi có nhiều tables → mỗi table có lead-in sentence từ model text.
- `shouldSplitMessage`: khi có `mutationSuccessCards` VÀ có text/tables → render 2 `<article>` riêng biệt với cùng avatar.

**Text processing**:
- `stripRedundantStructuredListText()`: loại bỏ text khi LLM lặp lại thông tin đã có trong table.
- `splitTextBeforeAndAfterTables()`: tách text thành phần trước bảng và sau bảng.
- `formatIsoDateMessage()`: convert ISO dates trong user message sang human-readable.

### 12.4 ConfirmActionCard

**File**: `src/components/chat/confirm-action-card.tsx`

**Tool metadata** (`TOOL_META`):

| Tool | Icon | Hint | Màu badge |
|---|---|---|---|
| `submit_my_time_off_request` | ↑ | "Ready to go! Your manager will review." | violet |
| `cancel_my_time_off_request` | ✕ | "Heads up — this can't be undone." | amber |
| `approve_team_time_off_request` | ✓ | "The employee will be notified." | emerald |
| `reject_team_time_off_request` | ✕ | "The employee will be notified." | red |

**Arg rendering** (`buildArgRows`):
- Hidden: `dryRun`, `showTeamPending`, `requestQuery`, `employeeEmail`, `employeeAvatar`.
- `startDate` + `endDate` → merge thành `dateRange` row.
- `requestQuery` → parse ra `employeeName`, `leaveType`, `dateRange` riêng biệt.
- `leaveType` → capitalize + map: "annual" → "Annual", etc.
- ISO dates trong string values → format sang "May 20, 2026".
- `employee` row → hiển thị Avatar + tên (kèm email/avatar từ tool args).

User avatar của người đang dùng (manager) được hiển thị ở góc trên phải card.

### 12.5 DateRangePickerCard

**File**: `src/components/chat/date-range-picker-card.tsx`

Hiển thị khi `showDatePicker = true`. Điều kiện:
```ts
const showDatePicker =
  agentMessages.length > 0 &&
  !isLoading &&
  (frontendDatePicker || agentState?.phase === "awaiting_dates");
```

- `frontendDatePicker`: set bởi `useFrontendTool` handler (normal collect path).
- `agentState?.phase === "awaiting_dates"`: set bởi server emit khi past-date validation fail.

Khi user submit date range → gọi `handlePromptSelect(dateText)` → `submitTextMessage(dateText)` → agent run mới với date text trong user message.

`resetDatePickerState()` được gọi khi: switch thread, create thread, delete thread, role change, handleSubmit.

---

## 13. Tool System — Agent Config Registry (Dynamic Configuration)

**Files**: `src/agents/config/types.ts`, `registry.ts`, `resolvers.ts`, `index.ts`

### 13.1 Type System — Kiến trúc extensible

```ts
// types.ts
type PromptVersion = "v1";  // Maps to file: system-v1.ts, system-v2.ts, ...

type AgentToolCategory = "read" | "mutation";  // Có thể thêm "background" | "admin" etc.

type ToolFactory = (
  session: MockAuthSession,
  options?: Record<string, unknown>,
  model?: LanguageModel,   // Một số tools cần model (date resolution tool)
) => ToolSet;

type AgentToolFactoryMap = Partial<Record<AgentToolCategory, ToolFactory>>;

type AgentConfig = {
  promptVersion: PromptVersion;              // Chọn system prompt version
  tools: Partial<Record<AgentToolCategory, string[]>>;  // Whitelist tools active
  flow?: string[];                           // Dynamic behavior rules → inject vào prompt
  label: string;                             // Human-readable agent label
};

type AgentConfigRegistry = Record<SpecialistAgentName, AgentConfig>;
// SpecialistAgentName = "employee" | "manager" | "date"
```

### 13.2 AGENT_CONFIG — Single Source of Truth

```ts
// registry.ts
export const AGENT_CONFIG: AgentConfigRegistry = {
  employee: {
    promptVersion: "v1",
    tools: {
      read: [
        "get_my_time_off_balance",       // Đọc balance
        "list_my_time_off_requests",     // List requests
        "consult_date_agent",            // Sub-agent date resolution
        "collect_date_range",            // Frontend tool: date picker
        "search_leave_policy",           // RAG policy search
      ],
      mutation: [
        "verify_my_time_off_request",   // Dry-run validation
        "submit_my_time_off_request",   // INTERRUPT: tạo request
        "cancel_my_time_off_request",   // INTERRUPT: hủy request
      ],
    },
    flow: [
      // Rules inject vào "## Core behavior" section của system prompt
      "### Leave Policy Questions",
      "RULE: If user asks HOW ... ALWAYS call search_leave_policy FIRST.",
      "FORBIDDEN: Telling user to 'ask your manager'...",
      "",
      "### Leave Request Workflow",
      "FORBIDDEN: mentioning any date format to user (YYYY-MM-DD, etc.)",
      "FORBIDDEN: recapping known fields. Ask only for what is missing.",
      "1. If leave type is missing, ask for it.",
      "2. If dates missing, CALL collect_date_range IMMEDIATELY with NO text before it.",
      "3. If reason missing, ask ONE short question only.",
      "4. If date mentioned, call consult_date_agent.",
      "5. Call verify_my_time_off_request.",
      "6. If verify ok:true, IMMEDIATELY call submit. Do NOT ask user permission.",
      // ... scenarios A, B, C
    ],
    label: "Employee Assistant",
  },

  manager: {
    promptVersion: "v1",
    tools: {
      read: [
        "list_employees",
        "list_team_members",
        "list_team_time_off_requests",
        "consult_date_agent",
        "search_leave_policy",
      ],
      mutation: [
        "approve_team_time_off_request",  // INTERRUPT
        "reject_team_time_off_request",   // INTERRUPT
      ],
    },
    flow: [
      "1. Tool-first: call tool before writing any response involving team data.",
      "2. Read-first: prefer reviewing pending requests first.",
      "3. Rejection: ask for reason before calling reject.",
      "4. After mutation: go straight to showing remaining pending requests.",
      "5. For policy questions: ALWAYS call search_leave_policy first.",
      "6. For approval/rejection: ALWAYS include employeeEmail and employeeAvatar.",
    ],
    label: "Manager Assistant",
  },

  date: {
    promptVersion: "v1",
    tools: {
      read: ["collect_date_range"],  // Date agent có thể gọi collect_date_range nếu ambiguous
    },
    // Không có flow — date agent dùng system-v1.ts trực tiếp
    label: "Date Specialist",
  },
};
```

### 13.3 TOOL_FACTORIES — Map Factory functions

```ts
// registry.ts
export const TOOL_FACTORIES: Record<SpecialistAgentName, AgentToolFactoryMap> = {
  employee: employeeToolFactories,
  // employeeToolFactories = {
  //   read:     createEmployeeReadTools(session, options, model),
  //   mutation: createEmployeeMutationTools(session),
  // }

  manager: managerToolFactories,
  // managerToolFactories = {
  //   read:     createManagerReadTools(session, options, model),
  //   mutation: createManagerMutationTools(session),
  // }

  date: dateToolFactories,
  // dateToolFactories = {
  //   read: createDateReadTools(session, options, model),
  // }
};
```

### 13.4 resolveAgentTools — Dynamic ToolSet Composition

```ts
// resolvers.ts
export function resolveAgentTools(
  agent: SpecialistAgentName,
  session: MockAuthSession,
  options?: Record<string, unknown>,
  model?: LanguageModel,
): ToolSet {
  const config = AGENT_CONFIG[agent];            // { tools: { read: [...], mutation: [...] } }
  const factories = TOOL_FACTORIES[agent];        // { read: fn, mutation: fn }

  return Object.entries(config.tools).reduce<ToolSet>(
    (acc, [category, activeNames]) => {
      const factory = factories[category as AgentToolCategory];
      if (factory && activeNames) {
        const categoryTools = factory(session, options, model);
        // FILTER: chỉ include tools có tên trong whitelist
        Object.keys(categoryTools).forEach((name) => {
          if (activeNames.includes(name)) {
            acc[name] = categoryTools[name];
          }
        });
      }
      return acc;
    },
    {} as ToolSet,
  );
}
```

**Ý nghĩa**: `TOOL_FACTORIES` tạo ra **tất cả** tools trong category, nhưng `AGENT_CONFIG.tools` chỉ **whitelist** những tool nào được active. Điều này cho phép:
- Factory có 10 tools, nhưng agent chỉ dùng 5 — không cần sửa factory.
- Thêm tool mới: tạo trong factory, thêm tên vào whitelist.
- Disable tool: xóa tên khỏi whitelist.

### 13.5 Dynamic System Prompt Assembly

```ts
// resolvers.ts
export function resolveSystemPrompt(agent): string {
  const config = AGENT_CONFIG[agent];
  return PROMPT_VERSIONS[agent][config.promptVersion];  // EMPLOYEE_SYSTEM_PROMPT_V1
}

export function resolveRoutingHints(agent): string {
  const config = AGENT_CONFIG[agent];
  const hints = ["## Routing"];
  Object.values(config.tools).forEach((names) => {
    names?.forEach((name) => {
      const description = DESCRIPTIONS[name];  // Từ EMPLOYEE_TOOL_DESCRIPTION, MANAGER_TOOL_DESCRIPTION
      if (description) hints.push(`- ${description} -> ${name}`);
    });
  });
  return hints.join("\n");
}

export function resolveAgentFlow(agent): string {
  const config = AGENT_CONFIG[agent];
  if (!config.flow?.length) return "";
  const lines = ["## Core behavior"];
  config.flow.forEach((instruction) => {
    lines.push(instruction.startsWith(" ") ? instruction : `- ${instruction}`);
  });
  return lines.join("\n");
}
```

**Final system prompt** = `resolveSystemPrompt` + `resolveAgentFlow` + `resolveRoutingHints` + context/dates inject:

```
[EMPLOYEE_SYSTEM_PROMPT_V1]    ← static personality & style rules

## Core behavior               ← từ AGENT_CONFIG.flow
- RULE: If user asks HOW ...
- 1. If leave type is missing ...
- ...

## Routing                     ← auto-generated từ active tool descriptions
- Get leave balance → get_my_time_off_balance
- List requests → list_my_time_off_requests
- ...

Today's date: 2026-05-15       ← runtime inject
Current user: ...              ← session inject

## Runtime execution notes     ← buildRuntimeSystemPrompt inject
- Latest user intent: ...
- Older conversation summary: ...
```

### 13.6 Cách thêm Agent mới (ví dụ: HR Agent)

**Bước 1**: Tạo system prompt
```ts
// src/agents/hr/prompt/system-v1.ts
export const HR_SYSTEM_PROMPT_V1 = `You are an HR assistant...`.trim();
export const hrPromptVersions = { v1: HR_SYSTEM_PROMPT_V1 };
```

**Bước 2**: Tạo tools
```ts
// src/agents/hr/tools/read/index.ts
export function createHRReadTools(session, options, model) {
  return {
    get_org_chart: tool({ ... }),
    search_hr_policies: tool({ ... }),
  };
}
// src/agents/hr/tools/index.ts
export const hrToolFactories: AgentToolFactoryMap = {
  read: createHRReadTools,
};
```

**Bước 3**: Thêm tool definitions
```ts
// src/agents/hr/tools/common/definitions.ts
export const HR_TOOL_NAME = { GET_ORG_CHART: "get_org_chart", ... };
export const HR_TOOL_DESCRIPTION = { GET_ORG_CHART: "Get the company org chart.", ... };
```

**Bước 4**: Đăng ký trong registry
```ts
// registry.ts — thêm vào AGENT_CONFIG
hr: {
  promptVersion: "v1",
  tools: {
    read: ["get_org_chart", "search_hr_policies"],
  },
  flow: ["1. Always call get_org_chart before answering structure questions."],
  label: "HR Assistant",
},
// thêm vào PROMPT_VERSIONS
hr: hrPromptVersions,
// thêm vào TOOL_FACTORIES
hr: hrToolFactories,
// thêm vào DESCRIPTIONS
...HR_TOOL_DESCRIPTION,
```

**Bước 5**: Thêm vào AgentName type
```ts
// src/agents/chat-core/types/index.ts
export type AgentName = "coordinator" | "employee" | "manager" | "date" | "hr";
```

**Bước 6**: Update coordinator routing để route tới "hr".

### 13.7 Cách thêm Tool mới vào Agent có sẵn

**Ví dụ**: Thêm `swap_leave_request` cho employee.

```ts
// 1. Thêm tên vào definitions
export const EMPLOYEE_TOOL_NAME = {
  ...existing,
  SWAP_LEAVE_REQUEST: "swap_leave_request",
} as const;
export const EMPLOYEE_TOOL_DESCRIPTION = {
  ...existing,
  SWAP_LEAVE_REQUEST: "Swap two leave requests between dates.",
} as const;

// 2. Implement tool trong factory
export function createEmployeeMutationTools(session) {
  return {
    ...existingTools,
    [EMPLOYEE_TOOL_NAME.SWAP_LEAVE_REQUEST]: tool({
      description: EMPLOYEE_TOOL_DESCRIPTION.SWAP_LEAVE_REQUEST,
      needsApproval: true,          // Documentation marker
      inputSchema: z.object({ ... }),
      execute: async ({ ... }) => swapLeaveRequest(session, { ... }),
    }),
  };
}

// 3. Whitelist trong AGENT_CONFIG (registry.ts)
employee: {
  tools: {
    mutation: [
      ...existingMutations,
      EMPLOYEE_TOOL_NAME.SWAP_LEAVE_REQUEST,  // ← thêm dòng này
    ],
  },
},

// 4. Nếu là interrupt tool: thêm vào INTERRUPT_TOOL_NAMES (ag-ui-stream.ts)
const INTERRUPT_TOOL_NAMES = new Set([
  ...existing,
  "swap_leave_request",
]);
const INTERRUPT_TOOL_LABELS: Record<string, string> = {
  ...existing,
  swap_leave_request: "Swap leave request",
};

// 5. Thêm tool meta vào ConfirmActionCard (confirm-action-card.tsx)
const TOOL_META: Record<string, ActionMeta> = {
  ...existing,
  swap_leave_request: { verb: "Swap leave request", icon: "⇄", hint: "...", ... },
};
```

### 13.8 Employee Tools — Chi tiết Schema

**Read tools**:

```ts
// get_my_time_off_balance
inputSchema: z.object({})  // No input needed — session provides employee context

// list_my_time_off_requests
inputSchema: z.object({
  status: z.enum(["all","upcoming","pending","approved","cancelled","rejected"]).nullish(),
  query: z.string().min(1).nullish(),  // Free-text: "annual", "2026-05-08", "family trip"
})

// collect_date_range
inputSchema: z.object({
  leaveType: z.enum(["annual","sick","personal","unpaid"]).optional(),
  reason: z.string().optional(),
})
execute: async () => ({ ok: true, message: "Date picker displayed." })
// execute ngay lập tức — server không cần làm gì, client useFrontendTool xử lý

// consult_date_agent
inputSchema: z.object({
  query: z.string()  // User's exact date text
})
execute: async ({ query }) => invokeDateAgent(query, session, model)
```

**Mutation tools**:

```ts
// verify_my_time_off_request
inputSchema: z.object({
  leaveType: z.enum(["annual","sick","personal","unpaid"]),
  startDate: z.string().trim().min(1),  // YYYY-MM-DD
  endDate: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  note: OPTIONAL_NOTE_SCHEMA,  // z.preprocess: null/undefined/empty → undefined
})
execute: async (args) => submitMyTimeOffRequest(session, { ...args, dryRun: true })

// submit_my_time_off_request (cùng schema với verify)
execute: async (args) => submitMyTimeOffRequest(session, { ...args, dryRun: false })
// Thực sự persist, return updated balance

// cancel_my_time_off_request
inputSchema: z.object({
  requestQuery: z.string().trim().min(1),
  // "latest pending request", "annual leave on 2026-06-15", "family trip request"
})
```

### 13.9 Manager Tools — Chi tiết Schema

```ts
// approve_team_time_off_request
inputSchema: z.object({
  requestQuery: z.string(),   // Mô tả request cần approve
  comment: z.string().optional(),
  showTeamPending: z.boolean().optional(),   // true → return pending list sau khi approve
  employeeEmail: z.string().optional(),      // Cho UI: avatar trong ConfirmActionCard
  employeeAvatar: z.string().optional(),
})

// reject_team_time_off_request (cùng structure)
// comment là required về logic (enforce trong mutations.ts, không enforce ở schema)
```

`parseMutationRequestInput` trong mutations.ts xử lý:
- Loại bỏ: "ask for confirmation before running", "please confirm", "before running".
- Extract comment embedded: `requestQuery = "Approve X annual leave. Comment: Looks good."` → comment = "Looks good".
- Strip: `"Please approve this pending request: <description>"` → `"<description>"`.

---

---

## 14. Date Specialist Sub-Agent

**File**: `src/agents/handlers/common/date-specialist.ts`

```ts
export async function invokeDateAgent(
  query: string,
  session: MockAuthSession,
  model: LanguageModel,
) {
  const { object } = await generateObject({
    model,
    schema: z.object({
      resolvedDates: z.object({
        startDate: z.string(),            // YYYY-MM-DD
        endDate: z.string(),              // YYYY-MM-DD
        isAmbiguous: z.boolean(),         // true nếu cần user clarify
        clarificationMessage: z.string().optional(),
        suggestions: z.array(z.string()).optional(),
      }),
    }),
    system: `${DATE_AGENT_SYSTEM_PROMPT_V1}\nToday: ${today}\nTimezone: ${session.timeZone}`,
    prompt: `Resolve the following date query: "${query}"`,
  });

  return object.resolvedDates;
}
```

Dùng `generateObject` (structured output) thay vì `streamText` để đảm bảo luôn nhận đúng schema.

**Được gọi từ 2 nơi**:
1. `runEmployeeFlow()` — pre-processing trước khi gọi LLM specialist.
2. `createDateResolutionTool()` — như 1 tool mà LLM có thể gọi trực tiếp.

Kết quả `isAmbiguous = true` → không set `preResolvedDates` → LLM tự xử lý (có thể gọi `collect_date_range`).

---

## 15. Conversation Compaction — Token Management

**File**: `src/agents/chat-core/prompt/builder.ts`

### 15.1 buildConversationRuntimeContext

```ts
export function buildConversationRuntimeContext({ messages, messageWindow }) {
  const hasCompactedHistory = messages.length > messageWindow;  // Default: 14

  const recentMessages = hasCompactedHistory
    ? messages.slice(-messageWindow)   // 14 messages cuối → gửi nguyên vẹn cho LLM
    : messages;

  const olderMessages = hasCompactedHistory
    ? messages.slice(0, -messageWindow)  // Messages cũ hơn → nén thành summary
    : [];

  return {
    latestUserText: getLatestUserText(messages),  // Cho runtime notes
    recentMessages,
    olderContextSummary: buildOlderContextSummary(olderMessages),
    hasCompactedHistory,
  };
}
```

### 15.2 buildOlderContextSummary

```ts
function buildOlderContextSummary(messages: UIMessage[]): string | null {
  const lines = messages
    .map(msg => `${toRoleLabel(msg.role)}: ${compactText(extractMessageText(msg), 220)}`)
    .filter(Boolean);

  // Chỉ lấy 10 lines gần nhất trong phần "cũ"
  const recentLines = lines.slice(-10);
  const summary = recentLines.join("\n");

  // Nếu vượt 1400 chars → truncate từ đầu
  return summary.length <= 1400 ? summary : `...${summary.slice(-1397)}`;
}
```

### 15.3 buildRuntimeSystemPrompt

```ts
export function buildRuntimeSystemPrompt({ baseSystemPrompt, latestUserText, olderContextSummary, hasCompactedHistory }) {
  const runtimeNotes = [
    "## Runtime execution notes",
    `- Latest user intent: ${latestUserText}`,
  ];

  if (hasCompactedHistory && olderContextSummary) {
    runtimeNotes.push(
      "- Older conversation was compacted for token efficiency. Use this summary for continuity:",
      olderContextSummary,
    );
  }

  return `${baseSystemPrompt}\n\n${runtimeNotes.join("\n")}`;
}
```

Runtime notes luôn có `latestUserText` — giúp LLM không mất context user đang muốn gì kể cả khi window bắt đầu từ giữa conversation.

---

## 16. Tool Output Rendering — ToolOutputTable Pipeline

**File**: `src/components/transcript/tool-output.tsx`, `named-tables.tsx`, `cells.tsx`

### 16.1 Routing trong getToolOutputTables

```ts
switch (toolName) {
  case "get_my_time_off_balance":
    → getBalanceTableModel (balances) + getRequestTableModel (upcoming)

  case "list_my_time_off_requests":
    → getRequestTableModel (showEmployee: false) + getSelfRequestRowActions

  case "list_team_time_off_requests":
    → getRequestTableModel (showEmployee: true) + getTeamRequestRowActions

  case "list_employees":
    → buildMembersTableModel ("Project members")

  case "list_team_members":
    → buildMembersTableModel ("Team members")

  case "submit_my_time_off_request":
    → getBalanceTableModel (updated) + getRequestTableModel (upcoming)

  case "approve/reject_team_time_off_request":
    → getRequestTableModel (reviewed employee) + getRequestTableModel (pending team)

  case "search_leave_policy":
    → [] (no table, text only)

  default:
    → getDynamicToolOutputTables (generic table detection)
}
```

### 16.2 Row Actions — Inline action buttons

`cells.tsx` định nghĩa action buttons cho từng row type:

```
getSelfRequestRowActions(request)
  → status === "approved" | "pending" VÀ startDate trong tương lai
  → ["Cancel request"] với prompt: "I'd like to cancel my Annual leave May 20-21, 2026."

getTeamRequestRowActions(request)
  → status === "pending" → ["Approve", "Reject"]
  → status === "approved" (future) → ["Reject"]
  → status === "rejected" (future) → ["Approve"]
  → Action prompts theo format: "Approve Mia Nguyen Annual leave 2026-05-12 to 2026-05-13. Comment: Approved."
  → Server detect format này → bypass LLM → immediate HITL

getBalanceRowActions(balance)
  → ["Request this type"] → "I want to submit a sick time-off request."

getMemberRowActions(member)
  → pendingCount > 0 → ["View pending"] + ["View all"]
```

Khi user click row action → `onSelectPrompt(prompt)` → `handlePromptSelect(prompt)` → `submitTextMessage(prompt)` → agent run mới.

---

## 17. RAG System — Policy Search (Chi tiết đầy đủ)

**Files**: `src/lib/rag/policy-index.ts`, `policy-chunks.ts`, `embed.ts`, `src/agents/handlers/policy/tool.ts`

### 17.1 Kiến trúc tổng quan

```
server/db/policy/*.md           ← 14 Markdown files (policy chunks)
        │
        ▼ loadPolicyChunks() — đọc khi Next.js start, parse frontmatter
POLICY_CHUNKS: PolicyChunk[]    ← In-memory, loaded once per process
        │
        ▼ getOrBuildTable() — lần đầu gọi searchPolicy()
LanceDB (disk: server/db/lancedb/)
  └── table: "policy_chunks"
       ├── id       (string)
       ├── title    (string)
       ├── body     (string)
       └── vector   (float32[]) ← embedding của "title\n\nbody"
        │
        ▼ searchPolicy(query, topK=3)
   embed(query) → queryVector
   vectorSearch(cosine) → top-K rows
   filter score >= 0.5
        │
        ▼ Fallback nếu embedding fail
   keywordSearch(query, topK)
```

### 17.2 Policy Chunks — Định dạng Markdown

**Thư mục**: `server/db/policy/`

14 files hiện tại:
```
annual-entitlement.md     sick-entitlement.md       personal-entitlement.md
carryover.md              medical-certificate.md     notice-period.md
approval-process.md       cancellation.md            overlap-coverage.md
half-day.md               emergency-compassionate.md probation.md
public-holidays.md        unpaid-leave.md
```

Mỗi file theo format:
```markdown
---
id: annual-entitlement
title: Annual Leave Entitlement
---

Full-time employees accrue 15 working days of annual leave per calendar year.
New employees receive a pro-rated allocation based on their start date.
...
```

`loadPolicyChunks()` parse frontmatter, load tất cả files alphabetically (đảm bảo thứ tự deterministic cho hash).

### 17.3 Content-based Invalidation — Smart Index Rebuild

```ts
// policy-index.ts
const HASH_FILE = path.join(DB_PATH, ".policy-hash");

function computeChunksHash(): string {
  // SHA-256 của id + title + body của tất cả chunks
  const content = POLICY_CHUNKS.map((c) => `${c.id}\x00${c.title}\x00${c.body}`).join("\n");
  return createHash("sha256").update(content).digest("hex");
}

async function getOrBuildTable(): Promise<Table> {
  const currentHash = computeChunksHash();
  const storedHash = readStoredHash();  // Đọc từ .policy-hash file
  const tableExists = existingTables.includes(TABLE_NAME);

  // Reuse nếu content không đổi — không rebuild mỗi lần restart
  if (tableExists && storedHash === currentHash) {
    console.log("[RAG] Reusing persisted LanceDB index (content unchanged).");
    return db.openTable(TABLE_NAME);
  }

  // Rebuild: drop table cũ, embed lại tất cả, write new hash
  if (tableExists) await db.dropTable(TABLE_NAME);

  const model = getEmbeddingModel();
  const texts = POLICY_CHUNKS.map((c) => `${c.title}\n\n${c.body}`);  // title+body → embed cùng
  const { embeddings } = await embedMany({ model, values: texts });

  const rows = POLICY_CHUNKS.map((chunk, i) => ({
    id: chunk.id, title: chunk.title, body: chunk.body,
    vector: embeddings[i],
  }));

  await db.createTable(TABLE_NAME, rows);
  writeStoredHash(currentHash);  // Lưu hash để lần sau compare
}
```

**Điều này có nghĩa**: chỉnh sửa bất kỳ `.md` file nào → `computeChunksHash()` khác → index tự rebuild lần kế tiếp có query. Không cần script migrate thủ công.

### 17.4 Singleton Pattern — Table Promise

```ts
let tablePromise: Promise<Table> | null = null;

export async function searchPolicy(query, topK = 3) {
  if (!tablePromise) {
    tablePromise = getOrBuildTable().catch((err) => {
      tablePromise = null;  // Reset để lần sau retry
      throw err;
    });
  }
  // Tất cả requests đều await cùng 1 promise — không build table 2 lần
  const table = await tablePromise;
  ...
}
```

Lần đầu gọi `searchPolicy` → build table (có thể mất vài giây nếu cần embed). Các lần sau → ngay lập tức.

### 17.5 Embedding Model Configuration

**File**: `src/lib/rag/embed.ts`

```ts
let cachedModel: EmbeddingModel | null = null;

export function getEmbeddingModel(): EmbeddingModel {
  if (cachedModel) return cachedModel;  // Process-level cache

  const provider = process.env.AI_PROVIDER ?? "ollama";

  if (provider === "openai") {
    // OPENAI_EMBED_MODEL default: "text-embedding-3-small"
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY, ... });
    cachedModel = openai.embedding(process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small");
  } else {
    // Ollama: cần pull model trước: ollama pull nomic-embed-text
    // OLLAMA_EMBED_MODEL default: "nomic-embed-text"
    const openaiCompat = createOpenAI({ baseURL: ollamaBaseUrl, apiKey: "ollama" });
    cachedModel = openaiCompat.embedding(process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text");
  }

  return cachedModel;
}
```

**Quan trọng**: Model được cache process-level (`cachedModel`). Một khi index đã được build với `nomic-embed-text`, **không được thay đổi sang model khác** mà không rebuild — vì vector space khác nhau → similarity scores sai hoàn toàn.

**Environment variables cho RAG**:

| Env Var | Default | Ý nghĩa |
|---|---|---|
| `AI_PROVIDER` | `"ollama"` | `"openai"` hoặc `"ollama"` |
| `OPENAI_API_KEY` | — | Required nếu `AI_PROVIDER=openai` |
| `OPENAI_EMBED_MODEL` | `"text-embedding-3-small"` | OpenAI embedding model |
| `OLLAMA_BASE_URL` | `"http://localhost:11434/v1"` | Ollama endpoint |
| `OLLAMA_EMBED_MODEL` | `"nomic-embed-text"` | Ollama embedding model |

### 17.6 Semantic Search — Cosine Similarity

```ts
const { embedding: queryEmbedding } = await embed({ model, value: query });

const rows = await table
  .vectorSearch(queryEmbedding)
  .distanceType("cosine")     // Cosine distance (0 = identical, 1 = orthogonal)
  .limit(topK)                 // Default: 3
  .toArray();

// Convert: distance → similarity score
return rows.map((row) => ({
  score: 1 - Number(row._distance),  // 1.0 = perfect match, 0.0 = unrelated
}));
```

### 17.7 Keyword Search Fallback — TF-weighted Scoring

```ts
function keywordSearch(query: string, topK: number): PolicySearchResult[] {
  const stopWords = new Set(["a","an","the","is","are","do","i","my","can","how","many","much"]);
  const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 1 && !stopWords.has(w));

  const scored = POLICY_CHUNKS.map((chunk) => {
    const title = chunk.title.toLowerCase();
    const body = chunk.body.toLowerCase();
    let score = 0;
    for (const word of words) {
      score += (title.match(new RegExp(word, "g"))?.length ?? 0) * 3;  // Title = 3x weight
      score += body.match(new RegExp(word, "g"))?.length ?? 0;         // Body = 1x weight
    }
    return { ...chunk, score };
  });

  const hits = scored.filter((c) => c.score > 0).sort((a, b) => b.score - a.score);
  return (hits.length > 0 ? hits : scored).slice(0, topK);  // Fallback: return top nếu không có hits
}
```

Fallback kích hoạt khi: Ollama không có `nomic-embed-text`, hoặc OpenAI key không hợp lệ, hoặc network error. App không crash — vẫn trả về results (có thể kém chính xác hơn).

### 17.8 Tool Integration — search_leave_policy

**File**: `src/agents/handlers/policy/tool.ts`

```ts
execute: async ({ query }) => {
  try {
    const MIN_SCORE = 0.5;
    const allResults = await searchPolicy(query, 3);      // Top 3 semantic results
    const results = allResults.filter((r) => r.score >= MIN_SCORE);  // Filter low-relevance

    if (results.length === 0) {
      return { ok: false, message: "No relevant policy sections found for this query." };
    }

    return {
      ok: true,
      results: results.map((r) => ({
        section: r.title,  // Section title (VD: "Annual Leave Entitlement")
        content: r.body,   // Full policy text
      })),
    };
  } catch (error) {
    return { ok: false, message: `Policy search unavailable: ${error.message}` };
  }
}
```

Tool này **không render table** — `getToolOutputTables()` return `[]` cho `search_leave_policy`. LLM đọc `results` array và compose câu trả lời bằng text.

### 17.9 Cách thêm Policy mới

**Thêm file** `server/db/policy/overtime-leave.md`:
```markdown
---
id: overtime-leave
title: Overtime Leave Compensation
---

Employees who work more than 40 hours per week are eligible for compensatory leave.
For every 8 hours of overtime, 1 day of compensatory leave is accrued.
Compensatory leave must be used within 3 months of accrual.
```

Lần kế tiếp `searchPolicy` được gọi:
1. `computeChunksHash()` khác hash cũ (có file mới).
2. LanceDB index tự rebuild.
3. File mới được embed và index.

Không cần restart server, không cần migration script.

### 17.10 Cách thay đổi Embedding Model

1. Chỉnh `OLLAMA_EMBED_MODEL` hoặc `OPENAI_EMBED_MODEL` trong `.env`.
2. **Xóa** `server/db/lancedb/` directory (hoặc xóa `.policy-hash` file).
3. Lần request tiếp theo → rebuild toàn bộ index với model mới.

Nếu không xóa directory: hash mismatch sẽ detect content change nếu policy files thay đổi, nhưng nếu chỉ đổi model mà policy không đổi → **index cũ vẫn được dùng với model mới** → kết quả sai. Do đó cần xóa thủ công khi đổi model.

---

---

## 18. Thread Management

**File**: `src/hooks/use-threads.ts`

### 18.1 Data Structure

```ts
type ChatThread = {
  id: string;
  title: string;            // Derived từ first user message
  preview: string;          // Derived từ last user/assistant message
  createdAt: string;        // ISO timestamp
  updatedAt: string;
  provider: AIProviderName;
  messages: Message[];      // AG-UI Message[] — serialized to localStorage
};

type StoredData = Record<AppRole, { threads: ChatThread[]; activeId: string }>;
```

### 18.2 Persistence

- `localStorage` key: `CHAT_STORAGE_KEYS.threadsByRole`.
- Tổ chức theo role: `{ user: { threads, activeId }, manager: { threads, activeId } }`.
- Auto-save khi `data` state thay đổi (useEffect).

### 18.3 Thread Sync với Agent

```ts
// Sync messages từ agent → active thread (khi agent update messages)
useEffect(() => {
  if (isInternalChangeRef.current) return;  // Bỏ qua nếu đang internal change
  setData(prev => {
    const nextThread = {
      ...activeThread,
      messages,
      title: messages.length > 0 ? deriveTitle(messages) : activeThread.title,
      preview: messages.length > 0 ? derivePreview(messages) : activeThread.preview,
    };
    // Skip nếu không thay đổi (JSON.stringify comparison)
    if (JSON.stringify(activeThread.messages) === JSON.stringify(messages)) return prev;
    return updateThreadInList(prev, activeThread.id, nextThread);
  });
}, [messages, provider, role]);
```

`isInternalChangeRef` tránh vòng lặp: khi `setMessages()` được gọi (internal change) → effect kích hoạt nhưng guard check ngăn lại.

### 18.4 Role Switching

```ts
useEffect(() => {
  if (previousRoleRef.current === role) return;
  previousRoleRef.current = role;

  // Load active thread của role mới vào agent
  isInternalChangeRef.current = true;
  setMessages(nextActiveThread.messages);
  setTimeout(() => { isInternalChangeRef.current = false; }, 0);  // Reset sau microtask
}, [role]);
```

`setTimeout(..., 0)` cần thiết để reset flag sau khi effect đã chạy xong.

---

## 19. Observability — Token Metrics

**File**: `src/agents/chat-core/observers/metrics.ts`, `token-math.ts`

### 19.1 AgentLogger

```ts
type AgentLogger = {
  agent: AgentName;               // "employee" | "manager" | "date"
  provider: string | null;
  modelId: string | null;
  toolNames: string[];            // Tất cả tools được gọi trong lượt này
  systemPromptTokensEstimate: number;   // Estimated từ char count
  messageCount: number;
  userInputTokensEstimate: number;
  toolExchangeTokensEstimate: number;  // Tool calls + results JSON size
  inputTokensReported: number;         // Từ AI SDK usage
  outputTokensReported: number;
  totalTokensReported: number;
  cachedInputTokensReported: number;
  reasoningTokensReported: number;
};
```

### 19.2 Token Estimation

```ts
// token-math.ts: rough estimate 4 chars ≈ 1 token
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

// Tool exchange = JSON.stringify(toolCalls) + JSON.stringify(toolResults) / 4
function estimateToolExchangeTokens(steps): number {
  return steps.reduce((sum, step) => {
    const toolCalls = JSON.stringify(step.toolCalls ?? []);
    const toolResults = JSON.stringify(step.toolResults ?? []);
    return sum + estimateTokenCountFromCharLength(toolCalls.length + toolResults.length);
  }, 0);
}
```

`onRunStats` callback trong `streamText.onFinish` — fired sau khi toàn bộ stream hoàn tất.

---

## 20. Tóm tắt: Tại sao không cần viết lại bất cứ gì về streaming

| Vấn đề thường gặp | Cách CopilotKit + AG-UI giải quyết |
|---|---|
| Parse SSE stream thủ công | `CopilotRuntime` forward `Observable<BaseEvent>` qua SSE, CopilotKit client parse tự động |
| Manage message state (`useState`) | `agent.messages` tự update, expose qua `useAgent()` |
| Text streaming delta accumulation | `TEXT_MESSAGE_CONTENT` events → CopilotKit ghép delta vào message content |
| Tool call / result pairing | `TOOL_CALL_START` + `TOOL_CALL_RESULT` → `dynamic-tool` part trong UIMessage |
| Loading state | `agent.isRunning` → `isLoading` boolean |
| Agent state / phase | `STATE_SNAPSHOT` event → `agent.state` |
| Frontend tool execution | `TOOL_CALL_START` không có result → CopilotKit gọi `useFrontendTool` handler |
| Human-in-the-loop interrupts | `CUSTOM(on_interrupt)` → `useInterrupt` → `render()` + `resolve()` |
| Resume sau HITL | `resolve(data)` → CopilotKit re-run với `forwardedProps.command.resume` |
| Context truyền từ client | `useAgentContext` → serialized vào `input.context` của mỗi run |
| Multi-thread messages | `agent.setMessages(msgs)` → switch thread không cần reset hook |
