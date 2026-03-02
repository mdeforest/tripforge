/**
 * Root-level loading UI — shown by Next.js during page navigation
 * before the page component suspends/resolves.
 */
export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-cream">
      <div className="flex flex-col items-center gap-3">
        {/* Animated parchment dots */}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-rust opacity-0 animate-fade-in"
              style={{ animationDelay: `${i * 150}ms`, animationIterationCount: "infinite" }}
            />
          ))}
        </div>
        <p className="text-sm text-muted">Loading…</p>
      </div>
    </div>
  );
}
