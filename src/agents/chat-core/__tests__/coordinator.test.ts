import assert from "node:assert/strict";
import test from "node:test";
import { MockLanguageModelV3 } from "ai/test";
import { routeConversation } from "@/agents/chat-core/services/coordinator";
import type { MockAuthSession } from "@/lib/auth/session";

function createSession(role: MockAuthSession["role"]): MockAuthSession {
  return {
    sessionId: `${role}-session`,
    role,
    roleLabel: role === "manager" ? "Manager mode" : "User mode",
    employeeId: "EMP-1001",
    name: "Thang Ho Quang",
    email: "thang.hoquang@asnet.com.vn",
    avatar:
      "https://api.dicebear.com/7.x/adventurer/svg?seed=thang.hoquang%40asnet.com.vn",
    team: "Platform",
    manager: "Linh Tran",
    timeZone: "Asia/Ho_Chi_Minh",
    entitlements: {
      annual: 14,
      sick: 5,
      personal: 2,
    },
    managedEmployeeIds: role === "manager" ? ["EMP-1007"] : [],
    managedEmployees:
      role === "manager"
        ? [
            {
              employeeId: "EMP-1007",
              name: "Mia Nguyen",
              email: "mia.nguyen@asnet.com.vn",
              avatar:
                "https://api.dicebear.com/7.x/adventurer/svg?seed=mia.nguyen%40asnet.com.vn",
              team: "Platform",
              manager: "Linh Tran",
              timeZone: "Asia/Ho_Chi_Minh",
              entitlements: {
                annual: 12,
                sick: 4,
                personal: 2,
              },
            },
          ]
        : [],
  };
}

function mockModel(specialist: "employee" | "manager" | "out_of_scope") {
  return new MockLanguageModelV3({
    doGenerate: {
      content: [{ type: "text", text: JSON.stringify({ specialist }) }],
      finishReason: { unified: "stop" as const, raw: "stop" },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 5, text: 5, reasoning: undefined },
      },
      warnings: [],
    },
  });
}

test("routes personal request to employee specialist", async () => {
  const decision = await routeConversation({
    model: mockModel("employee"),
    session: createSession("user"),
    messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "check my balance" }] }],
  });

  assert.deepEqual(decision, { type: "delegate", specialist: "employee" });
});

test("denies manager intent in user mode", async () => {
  const decision = await routeConversation({
    model: mockModel("manager"),
    session: createSession("user"),
    messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "approve Mia request" }] }],
  });

  assert.equal(decision.type, "deny");
});

test("denies out-of-scope request", async () => {
  const decision = await routeConversation({
    model: mockModel("out_of_scope"),
    session: createSession("user"),
    messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "book a room for me" }] }],
  });

  assert.equal(decision.type, "deny");
  assert.ok(decision.message.includes("book a room for me"));
});

test("routes manager intent to manager specialist in manager mode", async () => {
  const decision = await routeConversation({
    model: mockModel("manager"),
    session: createSession("manager"),
    messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "approve Mia request" }] }],
  });

  assert.deepEqual(decision, { type: "delegate", specialist: "manager" });
});

test("routes employee intent to employee specialist in manager mode", async () => {
  const decision = await routeConversation({
    model: mockModel("employee"),
    session: createSession("manager"),
    messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "check my balance" }] }],
  });

  assert.deepEqual(decision, { type: "delegate", specialist: "employee" });
});
