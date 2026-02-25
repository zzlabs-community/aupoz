"use client";
import { useEffect, useRef } from "react";

type Star = { x: number; y: number; r: number; tw: number; a: number; vx: number; vy: number };
type Meteor = { x: number; y: number; vx: number; vy: number; life: number; max: number };

export default function SpaceBackground() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let rid = 0;
    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

    const stars: Star[] = [];
    const meteors: Meteor[] = [];

    function resize() {
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
    }

    function seed() {
      stars.length = 0;
      const count = Math.floor((w * h) / 7000); // density
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.2 + 0.3,
          tw: Math.random() * 0.02 + 0.005,
          a: Math.random(),
          vx: (Math.random() - 0.5) * 0.02, // slow drift
          vy: (Math.random() - 0.5) * 0.02,
        });
      }
    }

    function spawnMeteor() {
      // from random top/left edges into screen
      const fromTop = Math.random() < 0.5;
      const x = fromTop ? Math.random() * w : -50;
      const y = fromTop ? -50 : Math.random() * h * 0.6;
      const speed = 3 + Math.random() * 3;
      const angle = (Math.PI / 4) + Math.random() * (Math.PI / 8); // down-right
      meteors.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0, max: 90 + Math.random() * 60 });
    }

    let lastMeteor = 0;

    function frame(t: number) {
      rid = requestAnimationFrame(frame);
      // bg
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#05070b"; // matte black-blue
      ctx.fillRect(0, 0, w, h);

      // subtle vignette
      const g = ctx.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.2, w * 0.5, h * 0.5, Math.max(w, h));
      g.addColorStop(0, "rgba(40,40,60,0.15)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

      // stars
      ctx.save();
      for (const s of stars) {
        s.a += s.tw;
        s.x += s.vx; s.y += s.vy;
        if (s.x < 0) s.x = w; if (s.x > w) s.x = 0; if (s.y < 0) s.y = h; if (s.y > h) s.y = 0;
        const alpha = 0.5 + Math.sin(s.a) * 0.5;
        ctx.globalAlpha = 0.3 + 0.7 * alpha;
        ctx.fillStyle = "#cfe3ff";
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      // spawn meteors every ~2–4s
      if (t - lastMeteor > 2000 + Math.random() * 2000) {
        spawnMeteor();
        lastMeteor = t;
      }

      // draw meteors
      ctx.save();
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.x += m.vx; m.y += m.vy; m.life++;
        // trail
        const len = 80;
        const nx = m.x - m.vx * 8, ny = m.y - m.vy * 8;
        const grad = ctx.createLinearGradient(m.x, m.y, nx, ny);
        grad.addColorStop(0, "rgba(255,255,255,0.9)");
        grad.addColorStop(1, "rgba(100,160,255,0)");
        ctx.strokeStyle = grad; ctx.lineWidth = 2; ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(m.x, m.y); ctx.stroke();

        // head
        ctx.globalAlpha = 1; ctx.fillStyle = "#e6f0ff";
        ctx.beginPath(); ctx.arc(m.x, m.y, 1.5, 0, Math.PI * 2); ctx.fill();

        if (m.life > m.max || m.x > w + 100 || m.y > h + 100) {
          meteors.splice(i, 1);
        }
      }
      ctx.restore();
    }

    resize(); seed();
    window.addEventListener("resize", () => { resize(); seed(); });
    rid = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(rid); };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none" }}
    />
  );
}

