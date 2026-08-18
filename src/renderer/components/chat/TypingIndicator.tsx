export function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 py-1 text-content-muted text-xs">
      <span className="flex gap-1">
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-current"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-current"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-current"
          style={{ animationDelay: '300ms' }}
        />
      </span>
      <span>typing…</span>
    </div>
  );
}
