import { memo, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/utils/class-name";

type MessageBubbleProps = {
  isUser: boolean;
  text?: string;
  placeholder?: string;
  fullWidth?: boolean;
  children?: ReactNode;
};

export const MessageBubble = memo(function MessageBubble({
  isUser,
  text,
  placeholder,
  fullWidth = false,
  children,
}: MessageBubbleProps) {
  if (isUser) {
    return (
      <div className="ml-auto max-w-full rounded-[1.125rem_0.375rem_1.125rem_1.125rem] border border-violet-300/28 bg-[linear-gradient(135deg,rgba(124,58,237,0.5),rgba(79,70,229,0.44),rgba(14,165,233,0.22))] px-[0.9375rem] py-2.5 font-dm-sans text-sm leading-relaxed break-words text-white/90 shadow-[0_8px_26px_rgba(56,32,140,0.34)] backdrop-blur-lg">
        <span className="whitespace-pre-wrap">{text ?? placeholder}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/11 bg-[linear-gradient(165deg,rgba(255,255,255,0.09),rgba(255,255,255,0.06))] px-4 py-2.5 font-dm-sans text-sm leading-relaxed text-white/88 shadow-[0_8px_24px_rgba(6,10,30,0.24)] backdrop-blur-md",
        fullWidth ? "max-w-full" : "max-w-[72%]",
      )}
    >
      {text ? <span className="whitespace-pre-wrap">{text}</span> : null}
      {!text && placeholder ? (
        <span className="text-white/40">{placeholder}</span>
      ) : null}
      {children ? (
        <div className={cn(text || placeholder ? "mt-3" : undefined)}>
          {children}
        </div>
      ) : null}
    </div>
  );
});

type MessageAvatarProps = {
  initials: string;
  isUser: boolean;
  avatarUrl?: string;
  avatarLabel?: string;
  size?: "sm" | "md" | "lg";
  children?: ReactNode;
};

export const MessageAvatar = memo(function MessageAvatar({
  initials,
  isUser,
  avatarUrl,
  avatarLabel = "User avatar",
  size = "sm",
}: MessageAvatarProps) {
  if (isUser) {
    return (
      <Avatar
        variant="user"
        src={avatarUrl}
        alt={avatarLabel}
        initials={initials}
        size={size}
        className="mt-1"
      />
    );
  }

  return <Avatar variant="assistant" size="sm" className="mt-1" />;
});
