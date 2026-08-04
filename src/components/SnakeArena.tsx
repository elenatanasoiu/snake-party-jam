import { useEffect, useRef } from "react";
import { COLS, ROWS, SNAKE_COLORS, type GameState } from "@/lib/snake-engine";

const CELL = 18;

export function SnakeArena({ state, myId }: { state: GameState; myId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const styles = getComputedStyle(canvas);
    const arena = styles.getPropertyValue("--arena").trim() || "#111";
    const grid = styles.getPropertyValue("--grid").trim() || "#222";
    const food = styles.getPropertyValue("--food").trim() || "orange";

    const dpr = window.devicePixelRatio || 1;
    canvas.width = COLS * CELL * dpr;
    canvas.height = ROWS * CELL * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = arena;
    ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);

    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL + 0.5, 0);
      ctx.lineTo(x * CELL + 0.5, ROWS * CELL);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL + 0.5);
      ctx.lineTo(COLS * CELL, y * CELL + 0.5);
      ctx.stroke();
    }

    ctx.fillStyle = food;
    for (const f of state.food) {
      ctx.beginPath();
      ctx.arc(f.x * CELL + CELL / 2, f.y * CELL + CELL / 2, CELL * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }

    // Corpses fade out from the head, so draw them dimmer than live snakes.
    for (const corpse of state.corpses) {
      const color = SNAKE_COLORS[corpse.colorIndex % SNAKE_COLORS.length]!;
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = color;
      for (const c of corpse.cells) {
        ctx.fillRect(c.x * CELL + 4, c.y * CELL + 4, CELL - 8, CELL - 8);
      }
      ctx.globalAlpha = 1;
    }

    for (const p of state.players) {
      if (p.body.length === 0) continue;
      const color = SNAKE_COLORS[p.colorIndex % SNAKE_COLORS.length]!;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      p.body.forEach((c, i) => {
        ctx.shadowBlur = i === 0 ? 14 : 6;
        const pad = i === 0 ? 1 : 2.5;
        ctx.fillRect(c.x * CELL + pad, c.y * CELL + pad, CELL - pad * 2, CELL - pad * 2);
      });
      ctx.shadowBlur = 0;

      const head = p.body[0];
      if (head) {
        ctx.font = "600 10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = color;
        ctx.fillText(
          p.id === myId ? "you" : p.name,
          head.x * CELL + CELL / 2,
          head.y * CELL - 4,
        );
      }
    }
  }, [state, myId]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full max-w-[576px] rounded-xl border border-border shadow-2xl"
      style={{ aspectRatio: "1 / 1", backgroundColor: "var(--arena)" }}
    />
  );
}