import assert from "node:assert/strict";
import test from "node:test";
import { routeConversation } from "@/agents/chat-core/services/coordinator";
import type { MockAuthSession } from "@/lib/auth/session";

/**
 * Creates session.
 * @param {MockAuthSession["role"]} role
 * @returns {MockAuthSession}
 */
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

test("routes regular personal request to employee specialist", () => {
  const decision = routeConversation({
    session: createSession("user"),
    messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "check my balance" }] }],
  });

  assert.deepEqual(decision, { type: "delegate", specialist: "employee" });
});

test("denies manager intent in user mode", () => {
  const decision = routeConversation({
    session: createSession("user"),
    messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "approve Mia request" }] }],
  });

  assert.equal(decision.type, "deny");
});

test("routes manager intent to manager specialist in manager mode", () => {
  const decision = routeConversation({
    session: createSession("manager"),
    messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "approve Mia request" }] }],
  });

  assert.deepEqual(decision, { type: "delegate", specialist: "manager" });
});
