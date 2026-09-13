import { useEffect, useRef, useState, type RefObject } from "react";

const THRESHOLD = 68;
const MAX_PULL = 96;

function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 1023px)").matches && "ontouchstart" in window;
}

function scrollTopOf(el: HTMLElement) {
  return el.scrollTop;
}

/**
 * Pull-down refresh for nested mobile scroll shells (native PTR blocked by overscroll-contain).
 */
export function usePullToRefresh(
  scrollRef: RefObject<HTMLElement | null>,
  onRefresh: () => void | Promise<void>,
  enabled = true,
) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !enabled) return;
    if (!isMobileViewport()) return;

    const setPullBoth = (v: number) => {
      pullRef.current = v;
      setPull(v);
    };

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (scrollTopOf(el) > 1) {
        tracking.current = false;
        return;
      }
      startY.current = e.touches[0]?.clientY ?? 0;
      tracking.current = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking.current || refreshingRef.current) return;
      if (scrollTopOf(el) > 1) {
        tracking.current = false;
        setPullBoth(0);
        return;
      }
      const y = e.touches[0]?.clientY ?? 0;
      const dy = y - startY.current;
      if (dy <= 0) {
        setPullBoth(0);
        return;
      }
      // Resist rubber-band; block scroll bounce while pulling
      e.preventDefault();
      setPullBoth(Math.min(dy * 0.42, MAX_PULL));
    };

    const onEnd = () => {
      if (!tracking.current) return;
      tracking.current = false;
      const dist = pullRef.current;
      if (dist >= THRESHOLD && !refreshingRef.current) {
        setRefreshing(true);
        setPullBoth(THRESHOLD * 0.75);
        void Promise.resolve(onRefreshRef.current())
          .catch(() => undefined)
          .finally(() => {
            setRefreshing(false);
            setPullBoth(0);
          });
        return;
      }
      setPullBoth(0);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);

    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [scrollRef, enabled]);

  return { pullDistance: pull, refreshing, threshold: THRESHOLD };
}
