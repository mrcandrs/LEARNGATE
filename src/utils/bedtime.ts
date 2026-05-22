/** Normalize Postgres `time` or `HH:mm` input to minutes since midnight. */
export function parseTimeToMinutes(value: string): number {
  const part = value.trim().slice(0, 5);
  const [h, m] = part.split(":").map((x) => Number.parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return 0;
  }
  return Math.max(0, Math.min(23, h)) * 60 + Math.max(0, Math.min(59, m));
}

/** True when `now` falls inside the bedtime window (supports overnight e.g. 20:00–07:00). */
export function isInBedtimeWindow(now: Date, bedtimeStart: string, bedtimeEnd: string): boolean {
  const nowM = now.getHours() * 60 + now.getMinutes();
  const startM = parseTimeToMinutes(bedtimeStart);
  const endM = parseTimeToMinutes(bedtimeEnd);

  if (startM === endM) {
    return false;
  }
  if (startM < endM) {
    return nowM >= startM && nowM < endM;
  }
  return nowM >= startM || nowM < endM;
}

export function formatTimeLabel(value: string): string {
  const part = value.trim().slice(0, 5);
  const [h, m] = part.split(":");
  if (!h || !m) {
    return value;
  }
  const hour = Number.parseInt(h, 10);
  const min = m.padStart(2, "0");
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${min} ${suffix}`;
}
