"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEventHandler,
  type KeyboardEvent,
} from "react";
import { Text } from "@/components/ui/text";
import { CHAT_COMPOSER_COPY } from "@/constants/chat";
import { cn } from "@/utils/class-name";

type ChatComposerProps = {
  input: string;
  canSend: boolean;
  isLoading: boolean;
  isProviderReady: boolean;
  pendingApproval?: boolean;
  inputTooltip?: string;
  helperText?: string;
  errorMessage?: string | null;
  onInputChange: (value: string) => void;
  onSubmitAction: FormEventHandler<HTMLFormElement>;
};

export function ChatComposer({
  input,
  canSend,
  isLoading,
  isProviderReady,
  pendingApproval = false,
  inputTooltip,
  helperText,
  errorMessage,
  onInputChange,
  onSubmitAction,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const isInputBlocked = !isProviderReady || pendingApproval;
  const activeTooltip = pendingApproval
    ? CHAT_COMPOSER_COPY.pendingApprovalTooltip
    : inputTooltip;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  }, [input]);

  const IME_COMPOSING_KEYCODE = 229;

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const isComposing =
      event.nativeEvent.isComposing ||
      event.nativeEvent.keyCode === IME_COMPOSING_KEYCODE;
    if (isComposing) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <div className="border-t border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.06))] backdrop-blur-[1.75rem] px-4 py-3 sm:px-6 lg:px-8 shadow-[0_-1px_0_rgba(255,255,255,0.04),0_-10px_34px_rgba(0,0,0,0.2)]">
      <div className="mx-auto w-full max-w-3xl flex flex-col gap-2">
        {errorMessage ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            <Text variant="error">{errorMessage}</Text>
          </div>
        ) : null}

        <div
          className="relative"
          onMouseEnter={() => isInputBlocked && setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={() => isInputBlocked && setShowTooltip(true)}
        >
          {showTooltip && isInputBlocked && activeTooltip && (
            <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 max-w-xs rounded-lg bg-slate-800 px-3 py-1.5 font-dm-sans text-xs text-white shadow-lg text-center">
              {activeTooltip}
              <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
            </div>
          )}
        <form
          onSubmit={onSubmitAction}
          className="flex w-full items-center gap-3 rounded-[1.125rem] border border-white/13 bg-[linear-gradient(165deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] px-4 py-2.5 shadow-[0_8px_26px_rgba(7,12,30,0.2),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl transition-all duration-200 focus-within:border-violet-400/55"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={pendingApproval ? CHAT_COMPOSER_COPY.pendingApprovalPlaceholder : CHAT_COMPOSER_COPY.placeholder}
            aria-label={CHAT_COMPOSER_COPY.ariaLabel}
            disabled={isInputBlocked}
            rows={1}
            className="max-h-[9.375rem] flex-1 resize-none overflow-y-auto border-none bg-transparent font-dm-sans text-sm leading-[1.55] text-white/90 caret-violet-400/90 outline-none placeholder:text-white/46 disabled:cursor-not-allowed disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={!canSend || pendingApproval}
            aria-label={CHAT_COMPOSER_COPY.sendButtonLabel}
            className={cn(
              "self-end grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-all duration-200",
              "disabled:opacity-30 disabled:cursor-not-allowed",
              "hover:scale-[1.04] hover:shadow-[0_6px_20px_rgba(99,60,220,0.4)]",
              canSend
                ? "bg-[linear-gradient(135deg,#8b5cf6,#6366f1,#0ea5e9)] text-white"
                : "bg-white/18 text-white/75",
            )}
          >
            {isLoading ? (
              <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            )}
          </button>
        </form>
        </div>

        <Text variant="helper" className="px-1 text-center text-white/55">
          {helperText ?? CHAT_COMPOSER_COPY.defaultHelperText}
        </Text>
      </div>
    </div>
  );
}
