import { envBool } from "../flags";

/**
 * Simple per-source circuit breaker for Rasd connectors.
 * OPEN after consecutive failures; HALF_OPEN after cooldown; CLOSED on success.
 */
export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitSnapshot {
  sourceCode: string;
  state: CircuitState;
  failures: number;
  successes: number;
  openedAt: string | null;
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_COOLDOWN_MS = 15 * 60 * 1000;

interface CircuitInternal extends CircuitSnapshot {
  openedAtMs: number | null;
}

const circuits = new Map<string, CircuitInternal>();

function threshold(): number {
  return Number(process.env.RASD_CIRCUIT_FAILURE_THRESHOLD || DEFAULT_FAILURE_THRESHOLD);
}

function cooldownMs(): number {
  return Number(process.env.RASD_CIRCUIT_COOLDOWN_MS || DEFAULT_COOLDOWN_MS);
}

function getOrCreate(sourceCode: string): CircuitInternal {
  const existing = circuits.get(sourceCode);
  if (existing) return existing;
  const created: CircuitInternal = {
    sourceCode,
    state: "CLOSED",
    failures: 0,
    successes: 0,
    openedAt: null,
    openedAtMs: null,
    lastFailureAt: null,
    lastSuccessAt: null,
    lastError: null
  };
  circuits.set(sourceCode, created);
  return created;
}

export function getCircuit(sourceCode: string): CircuitSnapshot {
  const circuit = getOrCreate(sourceCode);
  maybeTransition(circuit);
  const { openedAtMs: _ignored, ...snapshot } = circuit;
  return snapshot;
}

function maybeTransition(circuit: CircuitInternal): void {
  if (circuit.state !== "OPEN" || circuit.openedAtMs == null) return;
  if (Date.now() - circuit.openedAtMs >= cooldownMs()) {
    circuit.state = "HALF_OPEN";
  }
}

export function canAttemptSource(sourceCode: string): boolean {
  if (!envBool("RASD_CIRCUIT_BREAKER_ENABLED", true)) return true;
  const circuit = getOrCreate(sourceCode);
  maybeTransition(circuit);
  return circuit.state !== "OPEN";
}

export function recordSourceSuccess(sourceCode: string): CircuitSnapshot {
  const circuit = getOrCreate(sourceCode);
  circuit.failures = 0;
  circuit.successes += 1;
  circuit.state = "CLOSED";
  circuit.openedAt = null;
  circuit.openedAtMs = null;
  circuit.lastSuccessAt = new Date().toISOString();
  circuit.lastError = null;
  return getCircuit(sourceCode);
}

export function recordSourceFailure(sourceCode: string, error?: string): CircuitSnapshot {
  const circuit = getOrCreate(sourceCode);
  circuit.failures += 1;
  circuit.lastFailureAt = new Date().toISOString();
  circuit.lastError = error?.slice(0, 1000) ?? circuit.lastError;
  if (circuit.state === "HALF_OPEN" || circuit.failures >= threshold()) {
    circuit.state = "OPEN";
    circuit.openedAtMs = Date.now();
    circuit.openedAt = new Date(circuit.openedAtMs).toISOString();
  }
  return getCircuit(sourceCode);
}

export function listCircuits(): CircuitSnapshot[] {
  return [...circuits.keys()].map((code) => getCircuit(code));
}

export function resetCircuit(sourceCode: string): void {
  circuits.delete(sourceCode);
}

export function resetAllCircuits(): void {
  circuits.clear();
}

/** Jittered exponential backoff delay in ms. */
export function computeBackoffMs(attempt: number, baseMs = 500, maxMs = 30_000): number {
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt));
  const jitter = Math.floor(Math.random() * Math.min(250, exp * 0.2));
  return exp + jitter;
}
