export type UnlockDuration = "1m" | "5m" | "30m" | "rest_of_day" | "week";

export type UnlockPricingMode = "suggested" | "fixed" | "disabled";

export type UnlockPricingEntry = {
  mode: UnlockPricingMode;
  fixed_stars?: number;
};

export type UnlockPricingJson = Record<string, UnlockPricingEntry>;

export type TempUnlockRow = {
  package_name: string;
  unlock_until: string;
  duration?: UnlockDuration | null;
  started_at?: string | null;
  /** When the child actually opened the app and the clock started. NULL = granted but not started. */
  activated_at?: string | null;
};

export type AppUnlockRequestRow = {
  id: string;
  child_id: string;
  package_name: string;
  app_label: string | null;
  duration: UnlockDuration;
  stars_escrowed: number;
  status: "pending" | "approved" | "denied" | "expired" | "cancelled";
  child_message: string | null;
  unlock_until: string | null;
  created_at: string;
  children?: { name: string } | { name: string }[] | null;
};

export type UnlockQuote = {
  ok: boolean;
  disabled?: boolean;
  reason?: string;
  pricing_key?: string;
  mode?: UnlockPricingMode;
  base_stars?: number;
  stars?: number;
  duration?: UnlockDuration;
  child_stars?: number;
  can_afford?: boolean;
};

export const UNLOCK_DURATIONS: readonly {
  id: UnlockDuration;
  label: string;
  shortLabel: string;
  description: string;
}[] = [
  {
    id: "1m",
    label: "1 minute",
    shortLabel: "1 min",
    description: "Quick test unlock",
  },
  {
    id: "5m",
    label: "5 minutes",
    shortLabel: "5 min",
    description: "Very short break",
  },
  {
    id: "30m",
    label: "30 minutes",
    shortLabel: "30 min",
    description: "Short break — low star cost",
  },
  {
    id: "rest_of_day",
    label: "Rest of today",
    shortLabel: "Today",
    description: "Until midnight (Manila time)",
  },
  {
    id: "week",
    label: "Until Monday",
    shortLabel: "This week",
    description: "Until weekly star reset",
  },
] as const;

export function unlockDurationLabel(duration: UnlockDuration): string {
  return UNLOCK_DURATIONS.find((d) => d.id === duration)?.label ?? duration;
}
