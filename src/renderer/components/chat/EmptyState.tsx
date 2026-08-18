export function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-content-muted">
      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-2xl font-bold text-white">
        L
      </div>
      <div className="text-lg font-semibold text-content">LTalk</div>
      <div className="text-sm">Select a conversation to start messaging</div>
    </div>
  );
}
