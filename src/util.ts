import type { ScheduleTime } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

/** Format a schedule time as `Y-m-d H:i`. Dates use their local date and time. */
export function formatScheduleTime(value: ScheduleTime | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(
    value.getHours()
  )}:${pad(value.getMinutes())}`;
}

/** Drop undefined values so they are not sent as JSON nulls. */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export const seg = (value: string) => encodeURIComponent(value);
