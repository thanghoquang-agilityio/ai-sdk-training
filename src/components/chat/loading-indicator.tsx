import { APP_NAME } from "@/constants/app";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/utils/class-name";

const SKELETON_WIDTHS = ["w-full", "w-4/5", "w-3/5"] as const;
const DOT_DELAYS = ["0ms", "150ms", "300ms"] as const;

type LoadingIndicatorProps = {
  showAvatar?: boolean;
  label?: string;
  className?: string;
};

export function LoadingIndicator({
  showAvatar = true,
  label,
  className,
}: LoadingIndicatorProps) {
  const headerLabel = label?.trim() || "Thinking";

  return (
    <article
      className={cn(
        "flex items-start gap-2.5 py-1",
        !showAvatar && "gap-0 py-0",
        className,
      )}
    >
      {showAvatar ? (
        <Avatar variant="assistant" size="sm" className="mt-0.5" />
      ) : null}

      <Card
        variant="glass"
        className="w-[18.75rem] max-w-full border-white/10 bg-[linear-gradient(165deg,rgba(255,255,255,0.09),rgba(255,255,255,0.05))] px-4 py-3.5 shadow-[0_10px_28px_rgba(7,12,30,0.28)]"
      >
        <div className="mb-2.5">
          <span className="font-syne text-sm font-semibold tracking-wide text-white/82">
            {APP_NAME}
          </span>
        </div>

        <div className="mb-3 flex items-center gap-1">
          <span className="font-dm-sans text-sm font-medium text-white/68">
            {headerLabel}
          </span>
          <span className="ml-0.5 flex gap-0.5">
            {DOT_DELAYS.map((delay, i) => (
              <span
                key={i}
                className="h-1 w-1 rounded-full bg-white/40 animate-pulse"
                style={{ animationDelay: delay, animationDuration: "1200ms" }}
              />
            ))}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {SKELETON_WIDTHS.map((width, i) => (
            <Skeleton key={i} className={`h-2.5 rounded-full bg-white/9 ${width}`} />
          ))}
        </div>
      </Card>
    </article>
  );
}
