export default function Loading() {
  return (
    <div dir="rtl" className="grid min-h-[60vh] place-items-center p-6">
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--gold-ghost)] border-t-[var(--gold)]"
          role="status"
          aria-label="جارٍ التحميل"
        />
        <p className="text-sm text-[var(--ink-60)]">جارٍ التحميل…</p>
      </div>
    </div>
  );
}
