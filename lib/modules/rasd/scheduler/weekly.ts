import { DEFAULT_RASD_TZ, DEFAULT_RASD_WEEKLY_CRON, RASD_SCHEDULER_ENABLED, RASD_TZ, RASD_WEEKLY_CRON, envBool } from "../flags";
import { buildWeeklyDigest } from "../notify/digest";
import { runWeeklyScan } from "../scan/weekly";

function parts(cron: string): string[] {
  return cron.trim().split(/\s+/);
}

function matchesField(value: number, expression: string): boolean {
  if (expression === "*") return true;
  return expression.split(",").some((part) => {
    if (part.includes("-")) {
      const [startRaw, endRaw] = part.split("-");
      const start = Number(startRaw);
      const end = Number(endRaw);
      return Number.isInteger(start) && Number.isInteger(end) && value >= start && value <= end;
    }
    return Number(part) === value;
  });
}

function zonedDateParts(now: Date, timeZone: string): { minute: number; hour: number; day: number; month: number; weekday: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    minute: "numeric",
    hour: "numeric",
    day: "numeric",
    month: "numeric",
    weekday: "short",
    hourCycle: "h23"
  });
  const values = new Map(formatter.formatToParts(now).map((part) => [part.type, part.value]));
  const weekdayName = values.get("weekday") ?? "Sun";
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    minute: Number(values.get("minute") ?? 0),
    hour: Number(values.get("hour") ?? 0),
    day: Number(values.get("day") ?? 1),
    month: Number(values.get("month") ?? 1),
    weekday: weekdayMap[weekdayName] ?? now.getUTCDay()
  };
}

export function shouldRunWeekly(now = new Date(), cron = RASD_WEEKLY_CRON || DEFAULT_RASD_WEEKLY_CRON, tz = RASD_TZ || DEFAULT_RASD_TZ): boolean {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts(cron);
  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) return false;
  const zoned = zonedDateParts(now, tz);
  return (
    matchesField(zoned.minute, minute) &&
    matchesField(zoned.hour, hour) &&
    matchesField(zoned.day, dayOfMonth) &&
    matchesField(zoned.month, month) &&
    matchesField(zoned.weekday, dayOfWeek)
  );
}

export async function runScheduledWeeklyIfDue(now = new Date()): Promise<{ ran: boolean; reason?: string; result?: unknown }> {
  if (!envBool("RASD_SCHEDULER_ENABLED", RASD_SCHEDULER_ENABLED)) {
    return { ran: false, reason: "RASD_SCHEDULER_ENABLED=false" };
  }
  if (!shouldRunWeekly(now, process.env.RASD_WEEKLY_CRON || RASD_WEEKLY_CRON, process.env.RASD_TZ || RASD_TZ)) {
    return { ran: false, reason: "not_due" };
  }
  const result = await runWeeklyScan({
    dryRun: true,
    fixturesOnly: envBool("RASD_FIXTURES_ONLY", false)
  });
  await buildWeeklyDigest(result.deep ?? result.quick);
  return { ran: true, result };
}
