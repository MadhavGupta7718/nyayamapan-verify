export const DEFAULT_SLOT = "09:00-11:00";

/** Application statuses in which the visit hasn't started, so the task can still move to another officer. */
export const REASSIGNABLE = ["SCHEDULED", "ASSIGNED"];

/** Application statuses during which an assignment counts towards an officer's open workload. */
export const OPEN_TASK_STATUSES = ["SCHEDULED", "ASSIGNED", "FIELD_VERIFICATION", "INSPECTION_COMPLETED", "PASS", "STAMPING"] as const;

/** The officer with the fewest open tasks; ties go to the name that sorts first so the choice is repeatable. */
export function pickLeastLoaded<T extends { id: string; name: string; openTasks: number }>(officers: T[]): T | null {
  return [...officers].sort((a, b) => a.openTasks - b.openTasks || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))[0] ?? null;
}

const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

/** The first Monday–Friday strictly after `from`, at local midnight. */
export function nextWorkingDay(from: Date): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  do d.setDate(d.getDate() + 1);
  while (isWeekend(d));
  return d;
}

/** The applicant's preferred date when it is a future working day, otherwise the next working day. */
export function visitDate(preferred: Date | null | undefined, now = new Date()): Date {
  const earliest = nextWorkingDay(now);
  if (preferred) {
    const p = new Date(preferred);
    p.setHours(0, 0, 0, 0);
    if (p >= earliest && !isWeekend(p)) return p;
  }
  return earliest;
}
