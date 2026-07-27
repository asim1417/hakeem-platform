export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries: number; baseMs: number; label?: string }
): Promise<T> {
  let lastError: unknown;
  const attempts = Math.max(0, options.retries) + 1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts - 1) break;
      const jitter = Math.floor(Math.random() * options.baseMs);
      const delay = options.baseMs * 2 ** attempt + jitter;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  const label = options.label ? ` (${options.label})` : "";
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Rasd retry exhausted${label}: ${message}`);
}
