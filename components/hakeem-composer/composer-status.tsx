"use client";

export function ComposerStatus({
  message,
  error,
}: {
  message?: string | null;
  error?: string | null;
}) {
  if (!message && !error) return null;
  return (
    <div className="hkm-composer__status" aria-live="polite">
      {error ? (
        <p className="hkm-composer__status-error" role="alert">
          {error}
        </p>
      ) : (
        <p className="hkm-composer__status-info">{message}</p>
      )}
    </div>
  );
}
