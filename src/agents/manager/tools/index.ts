import type { MockAuthSession } from "@/lib/auth/session";
import { createManagerReadTools } from "./read";
import { createManagerMutationTools } from "./mutation";

/**
 * Creates manager tools.
 * @param {MockAuthSession} session
 */
export function createManagerTools(session: MockAuthSession) {
  return {
    ...createManagerReadTools(session),
    ...createManagerMutationTools(session),
  };
}
