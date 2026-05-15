"use client";

import { useRenderTool } from "@copilotkit/react-core/v2";
import type { ReactElement } from "react";

/** Discriminated-union status from useRenderTool (v2). */
export type ToolCallStatus = "inProgress" | "executing" | "complete";

export type ToolCallRenderProps = {
  name: string;
  toolCallId: string;
  status: ToolCallStatus;
  parameters: Record<string, unknown>;
  result: string | undefined;
};

type UseRenderToolCallOptions = {
  name: string;
  agentId?: string;
  render: (props: ToolCallRenderProps) => ReactElement;
};

/**
 * Registers a custom renderer for a named tool call using the v2 useRenderTool API.
 * Provides a discriminated-union status: "inProgress" | "executing" | "complete".
 */
export function useRenderToolCall(
  options: UseRenderToolCallOptions,
  deps?: ReadonlyArray<unknown>,
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (useRenderTool as any)(
    {
      name: options.name,
      ...(options.agentId ? { agentId: options.agentId } : {}),
      render: (props: {
        name: string;
        toolCallId: string;
        status: string;
        parameters: Record<string, unknown> | undefined;
        result: string | undefined;
      }) =>
        options.render({
          name: props.name,
          toolCallId: props.toolCallId,
          status: props.status as ToolCallStatus,
          parameters: props.parameters ?? {},
          result: props.result,
        }),
    },
    deps,
  );
}
