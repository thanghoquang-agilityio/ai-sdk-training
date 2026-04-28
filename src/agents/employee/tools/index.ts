import type { MockAuthSession } from "@/lib/auth/session";
import { createEmployeeReadTools } from "./read";
import { createEmployeeMutationTools } from "./mutation";

export type EmployeeToolOptions = {
  /** Omit collect_date_range when the latest message already contains date hints. */
  skipDatePicker?: boolean;
};

/**
 * Creates employee tools.
 * @param {MockAuthSession} session
 * @param {EmployeeToolOptions} options
 */
export function createEmployeeTools(
  session: MockAuthSession,
  options?: EmployeeToolOptions,
) {
  return {
    ...createEmployeeReadTools(session, options),
    ...createEmployeeMutationTools(session),
  };
}
