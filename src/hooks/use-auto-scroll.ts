"use client";

import type { UIMessage } from "ai";
import { useEffect, type RefObject } from "react";

export function useChatAutoScroll(
  containerRef: RefObject<HTMLElement | null>,
  messages: UIMessage[],
  isStreaming: boolean,
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: isStreaming ? "auto" : "smooth",
    });
  }, [containerRef, isStreaming, messages]);
}
