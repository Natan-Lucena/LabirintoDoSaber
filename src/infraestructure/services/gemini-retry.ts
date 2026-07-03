// Erros transitórios da API do Gemini que valem retry (sobrecarga/limite).
const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504]);

const isTransient = (err: unknown): boolean => {
  const status = (err as { status?: number })?.status;
  if (status && TRANSIENT_STATUS.has(status)) return true;

  const message = String((err as { message?: string })?.message ?? "");
  return /\b(429|500|502|503|504)\b|UNAVAILABLE|overloaded|high demand|rate limit/i.test(
    message
  );
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  label?: string;
}

/**
 * Executa `fn` com retry e backoff exponencial apenas para erros transitórios
 * do Gemini (ex.: 503 "high demand"). Erros não-transitórios sobem de imediato.
 */
export async function withGeminiRetry<T>(
  fn: () => Promise<T>,
  { attempts = 4, baseDelayMs = 500, label = "gemini" }: RetryOptions = {}
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (!isTransient(err) || attempt === attempts) {
        break;
      }

      const delay = baseDelayMs * 2 ** (attempt - 1);
      console.warn(
        `[${label}] erro transitório (tentativa ${attempt}/${attempts}); nova tentativa em ${delay}ms`
      );
      await sleep(delay);
    }
  }

  throw lastError;
}
