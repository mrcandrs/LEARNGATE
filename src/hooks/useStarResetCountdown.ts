import { useEffect, useState } from "react";
import { formatStarResetCountdown, getStarResetCountdownMs } from "@/utils/starResetSchedule";

/** Live countdown to the next weekly star reset (Manila Monday midnight). Updates every second. */
export function useStarResetCountdown(tickMs = 1000): string {
  const [label, setLabel] = useState(() => formatStarResetCountdown(getStarResetCountdownMs()));

  useEffect(() => {
    const tick = () => setLabel(formatStarResetCountdown(getStarResetCountdownMs()));
    tick();
    const id = setInterval(tick, tickMs);
    return () => clearInterval(id);
  }, [tickMs]);

  return label;
}
