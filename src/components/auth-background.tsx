import { useEffect, useRef } from "react";
import doodleSvg from "../../svgs/vecteezy_lines-doodle-art-collection-line-art-of-arrows-circles_48682309.svg?raw";

const SVG_NS = "http://www.w3.org/2000/svg";

const FLOAT_OFFSETS = [
  (amp: number) => ({ dx: amp * 0.35, dy: -amp * 0.55 }),
  (amp: number) => ({ dx: -amp * 0.45, dy: amp * 0.4 }),
  (amp: number) => ({ dx: amp * 0.25, dy: amp * 0.35 }),
] as const;

/** One full drift cycle (seconds) — base + per-shape variance. */
const FLOAT_DURATION_BASE = 7;
const FLOAT_DURATION_STEP = 1.2;
const FLOAT_DELAY_STEP = 0.65;

type Mover = {
  motion: SVGGElement;
  dx: number;
  dy: number;
  duration: number;
  delay: number;
};

/** Faded doodle backdrop — each SVG shape drifts on its own. */
export function AuthBackground() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = doodleSvg;
    const svg = host.querySelector("svg");
    if (!svg) return;

    svg.classList.add("auth-bg-doodle-svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("viewBox", "0 0 1920 960");
    svg.setAttribute("preserveAspectRatio", "xMidYMid slice");

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const movers: Mover[] = [];
    const paths = [...svg.querySelectorAll("path")];

    paths.forEach((path, index) => {
      if (index === 0) {
        path.setAttribute("fill", "none");
        return;
      }

      const placement = document.createElementNS(SVG_NS, "g");
      const motion = document.createElementNS(SVG_NS, "g");
      motion.classList.add("auth-doodle-item");

      const baseTransform = path.getAttribute("transform");
      if (baseTransform) {
        placement.setAttribute("transform", baseTransform);
        path.removeAttribute("transform");
      }

      if (!reduceMotion) {
        const amp = 14 + (index % 5) * 5;
        const { dx, dy } = FLOAT_OFFSETS[index % 3]!(amp);
        movers.push({
          motion,
          dx,
          dy,
          duration: FLOAT_DURATION_BASE + (index % 6) * FLOAT_DURATION_STEP,
          delay: (index % 20) * FLOAT_DELAY_STEP,
        });
      }

      path.parentNode?.insertBefore(placement, path);
      placement.appendChild(motion);
      motion.appendChild(path);
    });

    let frame = 0;
    let start: number | null = null;

    const tick = (now: number) => {
      if (start === null) start = now;
      const elapsed = (now - start) / 1000;

      for (const item of movers) {
        const local = Math.max(0, elapsed - item.delay);
        const phase = (local % item.duration) / item.duration;
        const ease = Math.sin(phase * Math.PI);
        item.motion.setAttribute("transform", `translate(${item.dx * ease} ${item.dy * ease})`);
      }

      frame = requestAnimationFrame(tick);
    };

    if (movers.length > 0) {
      frame = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(frame);
      host.innerHTML = "";
    };
  }, []);

  return (
    <div className="auth-bg" aria-hidden>
      <div ref={hostRef} className="auth-bg-doodle" />
      <div className="auth-bg-vignette" />
    </div>
  );
}
