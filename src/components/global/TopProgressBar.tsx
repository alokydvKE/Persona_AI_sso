import { useIsFetching } from "@tanstack/react-query";

/**
 * Thin brand-gradient bar pinned to the top of the viewport, shown while any
 * React Query request (query or mutation) is in flight. Pure-CSS indeterminate
 * sweep — no dependencies.
 */
function TopProgressBar() {
  const active = useIsFetching();
  if (!active) return null;

  return (
    <div
      role="progressbar"
      aria-busy="true"
      aria-label="Loading"
      className="fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden duration-200 animate-in fade-in"
    >
      <div className="absolute top-0 h-full rounded-full bg-gradient-to-r from-[#6338F6] to-[#8B5CF6] shadow-[0_0_8px_rgba(99,56,246,0.6)] animate-[progress-slide_1.1s_ease-in-out_infinite]" />
    </div>
  );
}

export default TopProgressBar;
