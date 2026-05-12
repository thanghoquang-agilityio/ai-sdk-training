"use client";

import type { UIMessage } from "ai";
import { useEffect, useRef, type RefObject } from "react";

const BOTTOM_THRESHOLD_PX = 100;

export function useChatAutoScroll(
  containerRef: RefObject<HTMLElement | null>,
  messages: UIMessage[],
  isLoading: boolean,
) {
  const isNearBottomRef = useRef(true);
  const scheduledRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < BOTTOM_THRESHOLD_PX;
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isNearBottomRef.current) return;

    // Skip when a user message was just appended — the user triggered the action
    // and is already positioned there. Resume scrolling once the agent responds.
    const lastMessage = messages.at(-1);
    if (!isLoading && lastMessage?.role === "user") return;

    // Batch rapid updates into one scroll per animation frame
    if (scheduledRef.current !== null) return;

    scheduledRef.current = requestAnimationFrame(() => {
      scheduledRef.current = null;
      const c = containerRef.current;
      if (!c || !isNearBottomRef.current) return;
      c.scrollTo({ top: c.scrollHeight, behavior: "smooth" });
    });
  }, [containerRef, messages, isLoading]);

  // Cleanup any pending frame on unmount
  useEffect(() => {
    return () => {
      if (scheduledRef.current !== null) {
        cancelAnimationFrame(scheduledRef.current);
      }
    };
  }, []);
}
