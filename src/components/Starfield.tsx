import { useEffect, useRef } from "react";

type Intensity = "off" | "low" | "normal" | "high";

// A lightweight animated starfield with twinkling and subtle parallax.
export default function Starfield({ intensity = "normal" }: { intensity?: Intensity }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
  const container = containerRef.current!;
  // Intensity presets for density, sizes, durations, and spawn rates
  const presets: Record<Intensity, {
    starScale: number;
    meteorSize: number; // px
    alphaSingle: number;
    alphaShower: number;
    singleInterval: number; // ms
    singleProb: number;
    showerInterval: number; // ms
    showerProb: number;
    singleDur: [number, number]; // [min,max] ms
    showerDur: [number, number];
  }> = {
    off:    { starScale: 0,   meteorSize: 0,   alphaSingle: 0,    alphaShower: 0,    singleInterval: 999999, singleProb: 0,   showerInterval: 999999, showerProb: 0,   singleDur: [0,0],    showerDur: [0,0] },
    low:    { starScale: 0.5, meteorSize: 3.4, alphaSingle: 0.70, alphaShower: 0.65, singleInterval: 9000,  singleProb: 0.45, showerInterval: 28000,  showerProb: 0.12, singleDur: [20000, 30000], showerDur: [26000, 36000] },
    normal: { starScale: 0.9, meteorSize: 4.2, alphaSingle: 0.85, alphaShower: 0.75, singleInterval: 6500,  singleProb: 0.7,  showerInterval: 20000,  showerProb: 0.25, singleDur: [14000, 20000], showerDur: [20000, 28000] },
    high:   { starScale: 1.2, meteorSize: 4.8, alphaSingle: 0.90, alphaShower: 0.82, singleInterval: 5000,  singleProb: 0.85, showerInterval: 16000,  showerProb: 0.35, singleDur: [12000, 18000], showerDur: [18000, 24000] },
  };
  const cfg = presets[intensity];

  // Slightly reduce star density and rebalance per layer, scaled by intensity
  const starsCountBase = Math.min(200, Math.floor(window.innerWidth / 9));
  const starsCount = Math.floor(starsCountBase * cfg.starScale);

    const layers = [
      { className: "stars slow", count: Math.floor(starsCount * 0.35) },
      { className: "stars mid", count: Math.floor(starsCount * 0.35) },
      { className: "stars fast", count: Math.floor(starsCount * 0.3) },
    ];

    const created: HTMLElement[] = [];
    if (intensity !== "off") {
      layers.forEach(({ className, count }) => {
      for (let i = 0; i < count; i++) {
        const star = document.createElement("span");
        star.className = className;
        // random position
        star.style.left = Math.random() * 100 + "%";
        star.style.top = Math.random() * 100 + "%";
        // random size and twinkle delay
  const size = Math.random() * 1.5 + 1; // 1-2.5px
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.animationDelay = `${Math.random() * 5}s`;
        container.appendChild(star);
        created.push(star);
      }
      });
    }

    // Parallax: combine gentle auto drift with mouse target
    const state = { mx: 0, my: 0, tx: 0, ty: 0 };
    const onMove = (e: MouseEvent) => {
      const { innerWidth: w, innerHeight: h } = window;
      state.tx = (e.clientX / w - 0.5) * 2; // -1..1
      state.ty = (e.clientY / h - 0.5) * 2; // -1..1
    };
  if (intensity !== "off") window.addEventListener("mousemove", onMove);

    let raf = 0;
    const tick = (ts: number) => {
  // faster/larger drifting movement (sin/cos waves)
  const driftX = Math.sin(ts / 1400) * 0.6; // -0.6..0.6
  const driftY = Math.cos(ts / 1600) * 0.6;
      // ease mouse target a bit quicker
  state.mx += (state.tx - state.mx) * 0.15;
  state.my += (state.ty - state.my) * 0.15;
  const x = driftX + state.mx * 1.0;
  const y = driftY + state.my * 1.0;
      container.style.setProperty("--parallax-x", String(x));
      container.style.setProperty("--parallax-y", String(y));
      raf = requestAnimationFrame(tick);
    };
  if (intensity !== "off") raf = requestAnimationFrame(tick);

    // Spawn additional meteors in different directions
    // Restrict directions to feel like natural showers: mostly shallow diagonals downward
    const dirs = [
      { dx: 100, dy: 70 },   // down-right (shallow)
      { dx: -100, dy: 70 },  // down-left (shallow)
      { dx: 70, dy: 90 },    // down-right (steeper)
      { dx: -70, dy: 90 },   // down-left (steeper)
    ];

    // Define a central no-spawn zone where the timer likely sits (percentages)
    const AVOID = {
      left: 35,  // 35%
      right: 65, // 65%
      top: 30,   // 30%
      bottom: 72 // 72%
    };

    const isInAvoid = (l: number, t: number) =>
      l >= AVOID.left && l <= AVOID.right && t >= AVOID.top && t <= AVOID.bottom;

    function generateStart(
      dir: { dx: number; dy: number },
      preferMid: boolean
    ): { left: number; top: number } {
      const edgePad = 10;
      if (preferMid) {
        // Try mid-adjacent bands that avoid the avoid-rectangle
        for (let i = 0; i < 8; i++) {
          const bands = [
            { l: [10, 30], t: [35, 65] }, // left mid band
            { l: [70, 90], t: [35, 65] }, // right mid band
            { l: [35, 65], t: [8, 25] },  // upper mid band
            { l: [35, 65], t: [75, 92] }, // lower mid band
            { l: [15, 30], t: [15, 30] }, // upper-left close
            { l: [70, 85], t: [70, 85] }, // lower-right close
          ];
          const b = bands[Math.floor(Math.random() * bands.length)];
          const left = b.l[0] + Math.random() * (b.l[1] - b.l[0]);
          const top = b.t[0] + Math.random() * (b.t[1] - b.t[0]);
          if (!isInAvoid(left, top)) return { left, top };
        }
      }
      // Edge-based start biased opposite travel direction
      let left = Math.random() * (100 - edgePad * 2) + edgePad;
      let top = Math.random() * (100 - edgePad * 2) + edgePad;
      if (dir.dx > 0) left = Math.random() * 25; // left side
      if (dir.dx < 0) left = 75 + Math.random() * 25; // right side
      if (dir.dy > 0) top = Math.random() * 25; // top
      if (dir.dy < 0) top = 75 + Math.random() * 25; // bottom
      if (isInAvoid(left, top)) {
        // Nudge outward away from center if it falls inside avoid
        left = left > 50 ? 90 : 10;
        top = top > 50 ? 90 : 10;
      }
      return { left, top };
    }

  const spawnMeteor = () => {
      const meteor = document.createElement("span");
      meteor.className = "meteor";

      // pick random direction
      const v = dirs[Math.floor(Math.random() * dirs.length)];
  // slow travel so it's not distracting
  const dur = cfg.singleDur[0] + Math.random() * (cfg.singleDur[1] - cfg.singleDur[0]);
      meteor.style.setProperty("--dur", `${dur}ms`);
      meteor.style.setProperty("--mx", `${v.dx}vw`);
      meteor.style.setProperty("--my", `${v.dy}vh`);
  const angle = Math.atan2(v.dy, v.dx) * (180 / Math.PI);
  meteor.style.setProperty("--angle", `${angle}deg`);

  // calm brightness for general meteors
  meteor.style.setProperty("--alpha", `${cfg.alphaSingle}`);
  meteor.style.setProperty("--size", `${cfg.meteorSize}px`);

  // choose start position, sometimes preferring mid-adjacent bands, but avoiding the center
  const midStart = Math.random() < 0.15;
  const { left, top } = generateStart(v, midStart);
      meteor.style.left = `${left}%`;
      meteor.style.top = `${top}%`;

      container.appendChild(meteor);
      // cleanup after animation
      const remove = () => meteor.remove();
      meteor.addEventListener("animationend", remove, { once: true });
      // fallback cleanup
      setTimeout(remove, dur + 200);
    };

    // Calm ‘shower’ mode: aligned bursts occasionally
    const spawnShower = () => {
  const container = containerRef.current;
      if (!container) return;
      // pick a single direction for the shower
      const showerDirs = [
        { dx: 120, dy: 60 }, // down-right
        { dx: -120, dy: 60 }, // down-left
      ];
      const dir = showerDirs[Math.floor(Math.random() * showerDirs.length)];
    const count = 3 + Math.floor(Math.random() * 2); // 3-4 meteors
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          const m = document.createElement("span");
          m.className = "meteor";
          // slightly dimmer for shower
      m.style.setProperty("--alpha", `${cfg.alphaShower}`);
      m.style.setProperty("--size", `${cfg.meteorSize}px`);
      const dur = cfg.showerDur[0] + Math.random() * (cfg.showerDur[1] - cfg.showerDur[0]);
          m.style.setProperty("--dur", `${dur}ms`);
          m.style.setProperty("--mx", `${dir.dx}vw`);
          m.style.setProperty("--my", `${dir.dy}vh`);
          const angle = Math.atan2(dir.dy, dir.dx) * (180 / Math.PI);
          m.style.setProperty("--angle", `${angle}deg`);
          // sometimes start showers in mid-adjacent bands, but avoid center
          const midStart = Math.random() < 0.3;
          const { left, top } = generateStart(dir, midStart);
          m.style.left = `${left}%`;
          m.style.top = `${top}%`;
          container.appendChild(m);
          const remove = () => m.remove();
          m.addEventListener("animationend", remove, { once: true });
          setTimeout(remove, dur + 200);
        }, i * 300 + Math.random() * 200);
      }
    };

  // Base singles: slightly more frequent but still calm
    const meteorTimer = setInterval(() => {
      if (intensity === "off") return;
      if (Math.random() < cfg.singleProb) spawnMeteor();
    }, cfg.singleInterval);

    // Occasional calm showers: a bit more often, still gentle
    const showerTimer = setInterval(() => {
      if (intensity === "off") return;
      if (Math.random() < cfg.showerProb) spawnShower();
    }, cfg.showerInterval);

  // Kickstart visibility on load (skipped when off)
  if (intensity !== "off") {
    setTimeout(spawnMeteor, 600);
    if (intensity !== "low") setTimeout(spawnMeteor, 1400);
    if (intensity === "high") setTimeout(spawnMeteor, 2200);
    setTimeout(() => { if (Math.random() < cfg.showerProb + 0.1) spawnShower(); }, 3000);
  }

    return () => {
      if (intensity !== "off") window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
  clearInterval(meteorTimer);
  clearInterval(showerTimer);
      created.forEach((el) => el.remove());
    };
  }, [intensity]);

  return <div ref={containerRef} className="starfield" aria-hidden="true" />;
}
