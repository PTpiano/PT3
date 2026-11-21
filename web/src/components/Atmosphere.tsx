import { useEffect, useRef } from "react";
import { atmo, prefersReduced, type Mood } from "@/motion";

const PALETTES: Record<Mood, number[][]> = {
  amber: [[255, 150, 40], [200, 90, 20], [120, 50, 10], [255, 200, 120]],
  indigo: [[70, 80, 210], [30, 30, 120], [210, 120, 50], [100, 110, 230]],
  green: [[30, 130, 90], [15, 75, 55], [220, 160, 60], [70, 160, 110]],
  copper: [[235, 105, 40], [175, 60, 25], [255, 175, 85], [95, 42, 20]],
};

/** Fixed multi-layer smoke + dust, tinted by the section "mood" and pulsing with the music. */
export default function Atmosphere() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current!;
    const c = cv.getContext("2d")!;
    const S = 0.28;
    let W = 0,
      H = 0;
    const resize = () => {
      W = cv.width = Math.ceil(innerWidth * S);
      H = cv.height = Math.ceil(innerHeight * S);
    };
    resize();
    window.addEventListener("resize", resize);

    const blobs = Array.from({ length: 9 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.22 + Math.random() * 0.3,
      vx: (Math.random() - 0.5) * 0.012,
      vy: (Math.random() - 0.5) * 0.01,
      ph: Math.random() * 6.28,
      ci: i % 4,
      depth: 0.15 + Math.random() * 0.6,
    }));
    const dust = Array.from({ length: 46 }, () => ({
      x: Math.random(),
      y: Math.random(),
      s: 0.4 + Math.random() * 1.4,
      d: 0.1 + Math.random() * 1.1,
      ph: Math.random() * 6.28,
    }));
    const cur = PALETTES.amber.map((c) => [...c]);
    let last = performance.now();
    let lastY = scrollY;
    let vel = 0;
    let raf = 0;
    const still = prefersReduced();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const dy = scrollY - lastY;
      lastY = scrollY;
      vel += (Math.min(60, Math.abs(dy)) - vel) * 0.08;
      const target = PALETTES[atmo.mood];
      for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) cur[i][k] += (target[i][k] - cur[i][k]) * 0.02;

      c.globalCompositeOperation = "source-over";
      c.fillStyle = "#0a0705";
      c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = "lighter";
      const t = now / 1000;
      const pulse = 1 + atmo.energy * 0.5;
      for (const b of blobs) {
        if (!still) {
          b.x += b.vx * dt * (1 + vel * 0.12);
          b.y += b.vy * dt * (1 + vel * 0.12);
        }
        if (b.x < -0.2) b.x = 1.2;
        if (b.x > 1.2) b.x = -0.2;
        if (b.y < -0.2) b.y = 1.2;
        if (b.y > 1.2) b.y = -0.2;
        const px = (b.x + Math.sin(t * 0.15 + b.ph) * 0.05) * W;
        const py = (b.y + Math.cos(t * 0.12 + b.ph) * 0.05) * H - ((scrollY * b.depth * 0.0004) % 1) * H * 0.2;
        const r = b.r * Math.max(W, H) * pulse * (1 + Math.sin(t * 0.3 + b.ph) * 0.08);
        const col = cur[b.ci];
        const a = (0.085 + atmo.energy * 0.1) * (b.ci === 2 || b.ci === 3 ? 0.8 : 1);
        const g = c.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${a})`);
        g.addColorStop(1, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},0)`);
        c.fillStyle = g;
        c.fillRect(px - r, py - r, r * 2, r * 2);
      }
      // dust motes, parallax with scroll
      for (const p of dust) {
        const yy = (((p.y - scrollY * 0.00018 * p.d - t * 0.004 * p.d) % 1) + 1) % 1;
        const xx = p.x + Math.sin(t * 0.3 + p.ph) * 0.01;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.6 + p.ph));
        c.fillStyle = `rgba(255,214,150,${0.25 * tw * p.d})`;
        c.fillRect(xx * W, yy * H, p.s * S * 3, p.s * S * 3);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="fixed inset-0 w-full h-full z-0 pointer-events-none" style={{ imageRendering: "auto" }} aria-hidden />;
}
