import { useEffect, useState } from "react";

/** Match Tailwind `lg` — sidebar / desktop plan-ride breakpoint. */
const DESKTOP_LG = "(min-width: 1024px)";

export function useIsDesktopLg() {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_LG);
    const sync = () => setDesktop(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  return desktop;
}
