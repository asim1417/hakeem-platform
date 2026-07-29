export const DEFAULT_RASD_WEEKLY_CRON = "0 3 * * 6";
export const DEFAULT_RASD_TZ = "Asia/Riyadh";
export const DEFAULT_RASD_SNAPSHOT_DIR = "data/rasd/snapshots";
export const DEFAULT_RASD_MATCH_THRESHOLD = 0.85;
export const DEFAULT_RASD_RATE_LIMIT_PER_MINUTE = 20;
export const DEFAULT_RASD_USER_AGENT = "Hakeem-Rasd/1.0 (+https://hakeem.sa)";

const TRUE_VALUES = new Set(["1", "true", "yes", "y", "on", "enabled"]);
const FALSE_VALUES = new Set(["0", "false", "no", "n", "off", "disabled"]);

export function envBool(name: string, defaultValue = false): boolean {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") return defaultValue;

  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;

  return defaultValue;
}

function envNumber(name: string, defaultValue: number, min?: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return defaultValue;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return defaultValue;
  if (min !== undefined && parsed < min) return defaultValue;
  return parsed;
}

function envString(name: string, defaultValue: string): string {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? defaultValue : value.trim();
}

export const RASD_ENABLED = envBool("RASD_ENABLED", false);
export const RASD_SCHEDULER_ENABLED = envBool("RASD_SCHEDULER_ENABLED", false);
export const RASD_BASELINE_ENABLED = envBool("RASD_BASELINE_ENABLED", false);
export const RASD_AUTO_FETCH_ENABLED = envBool("RASD_AUTO_FETCH_ENABLED", false);
/** Never auto-apply legal library writes; default false. */
export const RASD_AUTO_APPLY_ENABLED = envBool("RASD_AUTO_APPLY_ENABLED", false);
export const RASD_REVIEW_REQUIRED = envBool("RASD_REVIEW_REQUIRED", true);
export const RASD_FULL_RESCAN_ALLOWED = envBool("RASD_FULL_RESCAN_ALLOWED", false);
export const RASD_FIXTURES_ONLY = envBool("RASD_FIXTURES_ONLY", false);
/** Per-source switches. BOE/NCAR stay off until live verification succeeds. */
export const RASD_SOURCE_UQN_ENABLED = envBool("RASD_SOURCE_UQN_ENABLED", true);
export const RASD_SOURCE_BOE_ENABLED = envBool("RASD_SOURCE_BOE_ENABLED", false);
export const RASD_SOURCE_NCAR_ENABLED = envBool("RASD_SOURCE_NCAR_ENABLED", false);
export const RASD_USER_AGENT = envString("RASD_USER_AGENT", DEFAULT_RASD_USER_AGENT);
export const RASD_RATE_LIMIT_PER_MINUTE = envNumber(
  "RASD_RATE_LIMIT_PER_MINUTE",
  DEFAULT_RASD_RATE_LIMIT_PER_MINUTE,
  1
);
export const RASD_WEEKLY_CRON = envString("RASD_WEEKLY_CRON", DEFAULT_RASD_WEEKLY_CRON);
export const RASD_TZ = envString("RASD_TZ", DEFAULT_RASD_TZ);
export const RASD_SNAPSHOT_DIR = envString("RASD_SNAPSHOT_DIR", DEFAULT_RASD_SNAPSHOT_DIR);
export const RASD_MATCH_THRESHOLD = envNumber(
  "RASD_MATCH_THRESHOLD",
  DEFAULT_RASD_MATCH_THRESHOLD,
  0
);

export type RasdSourceFlagCode = "UQN" | "BOE" | "NCAR";

const SOURCE_FLAG_DEFAULTS: Record<RasdSourceFlagCode, boolean> = {
  UQN: true,
  BOE: false,
  NCAR: false
};

const SOURCE_FLAG_NAMES: Record<RasdSourceFlagCode, string> = {
  UQN: "RASD_SOURCE_UQN_ENABLED",
  BOE: "RASD_SOURCE_BOE_ENABLED",
  NCAR: "RASD_SOURCE_NCAR_ENABLED"
};

export function isRasdEnabled(): boolean {
  return envBool("RASD_ENABLED", RASD_ENABLED);
}

export function requireRasdEnabled(): void {
  if (!isRasdEnabled()) {
    throw new Error("RASD is disabled. Set RASD_ENABLED=true to run legislative monitoring.");
  }
}

export function isRasdSourceEnabled(code: RasdSourceFlagCode): boolean {
  const name = SOURCE_FLAG_NAMES[code];
  return envBool(name, SOURCE_FLAG_DEFAULTS[code]);
}

export function listEnabledRasdSources(): RasdSourceFlagCode[] {
  return (Object.keys(SOURCE_FLAG_DEFAULTS) as RasdSourceFlagCode[]).filter((code) =>
    isRasdSourceEnabled(code)
  );
}

export function isRasdAutoApplyEnabled(): boolean {
  return envBool("RASD_AUTO_APPLY_ENABLED", RASD_AUTO_APPLY_ENABLED);
}

export function requireNoProductionLibraryWrite(context: string): void {
  if (envBool("RASD_ALLOW_PRODUCTION_LIBRARY_WRITE", false)) {
    throw new Error(
      `Production library writes are forbidden for Rasd (${context}). Unset RASD_ALLOW_PRODUCTION_LIBRARY_WRITE.`
    );
  }
  const url = process.env.DATABASE_URL ?? "";
  if (/[?&](?:sslmode=require)?/i.test(url) && /neon\.tech|prod|production/i.test(url) && envBool("RASD_PRODUCTION_DB_GUARD", true)) {
    // Soft signal only — hard block is via AUTO_APPLY + review gates.
    if (isRasdAutoApplyEnabled()) {
      throw new Error(`Refusing auto-apply against a production-like DATABASE_URL (${context}).`);
    }
  }
}

export function getRasdFeatureFlagSnapshot(): Record<string, boolean | string | number> {
  return {
    RASD_ENABLED: isRasdEnabled(),
    RASD_SOURCE_UQN_ENABLED: isRasdSourceEnabled("UQN"),
    RASD_SOURCE_BOE_ENABLED: isRasdSourceEnabled("BOE"),
    RASD_SOURCE_NCAR_ENABLED: isRasdSourceEnabled("NCAR"),
    RASD_REVIEW_REQUIRED: envBool("RASD_REVIEW_REQUIRED", RASD_REVIEW_REQUIRED),
    RASD_AUTO_APPLY_ENABLED: isRasdAutoApplyEnabled(),
    RASD_SCHEDULER_ENABLED: envBool("RASD_SCHEDULER_ENABLED", RASD_SCHEDULER_ENABLED),
    RASD_BASELINE_ENABLED: envBool("RASD_BASELINE_ENABLED", RASD_BASELINE_ENABLED),
    RASD_AUTO_FETCH_ENABLED: envBool("RASD_AUTO_FETCH_ENABLED", RASD_AUTO_FETCH_ENABLED),
    RASD_FULL_RESCAN_ALLOWED: envBool("RASD_FULL_RESCAN_ALLOWED", RASD_FULL_RESCAN_ALLOWED),
    RASD_FIXTURES_ONLY: envBool("RASD_FIXTURES_ONLY", RASD_FIXTURES_ONLY)
  };
}
