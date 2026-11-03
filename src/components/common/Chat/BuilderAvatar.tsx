import { cn } from "@/lib/utils";

/**
 * The persona builder's avatar: a friendly bot face in a soft lavender circle.
 * While `active` (a reply being written, or the builder getting ready) it
 * blinks now and then; otherwise it rests.
 */
function BuilderAvatar({ active = false, className }: { active?: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-[18px]">
        {/* Antenna */}
        <line x1="12" y1="4.5" x2="12" y2="7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="3.4" r="1.6" fill="currentColor" />
        {/* Ears */}
        <rect x="2.2" y="11" width="2.3" height="4.5" rx="1.15" fill="currentColor" />
        <rect x="19.5" y="11" width="2.3" height="4.5" rx="1.15" fill="currentColor" />
        {/* Head */}
        <rect x="4.5" y="7" width="15" height="12.5" rx="4" fill="currentColor" />
        {/* Eyes */}
        <g
          data-testid="builder-avatar-eyes"
          className={cn(
            "origin-center [transform-box:fill-box]",
            active && "animate-[bot-blink_2.6s_ease-in-out_infinite] motion-reduce:animate-none",
          )}
        >
          <circle cx="9.3" cy="13.2" r="1.6" fill="white" />
          <circle cx="14.7" cy="13.2" r="1.6" fill="white" />
        </g>
      </svg>
    </span>
  );
}

export default BuilderAvatar;
