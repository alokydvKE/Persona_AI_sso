import { cn } from "@/lib/utils";

/**
 * Subtle animated aurora/mesh background: a few large blurred gradient blobs
 * that slowly drift. Purely decorative — render as an absolutely-positioned
 * layer behind content (`pointer-events-none`, sits at the back). CSS only.
 */
function AuroraBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        className,
      )}
    >
      <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#6338F6]/25 blur-3xl animate-[aurora-1_16s_ease-in-out_infinite]" />
      <div className="absolute -right-20 top-10 h-96 w-96 rounded-full bg-[#8B5CF6]/20 blur-3xl animate-[aurora-2_20s_ease-in-out_infinite]" />
      <div className="absolute bottom-[-6rem] left-1/3 h-80 w-80 rounded-full bg-[#5f6fff]/20 blur-3xl animate-[aurora-3_18s_ease-in-out_infinite]" />
    </div>
  );
}

export default AuroraBackground;
