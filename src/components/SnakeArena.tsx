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

    // Everything is drawn as ASCII glyphs on a monospace character grid.
    const MONO = `${CELL - 3}px "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace`;
    ctx.font = MONO;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const glyph = (ch: string, x: number, y: number) => {
      ctx.fillText(ch, x * CELL + CELL / 2, y * CELL + CELL / 2);
    };

    // Faint dot lattice stands in for the empty board.
    ctx.fillStyle = grid;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) glyph("·", x, y);
    }

    ctx.fillStyle = food;
    ctx.shadowColor = food;
    ctx.shadowBlur = 8;
    for (const f of state.food) glyph("*", f.x, f.y);
    ctx.shadowBlur = 0;

    // Corpses fade out from the head, so draw them dimmer than live snakes.
    for (const corpse of state.corpses) {
      const color = SNAKE_COLORS[corpse.colorIndex % SNAKE_COLORS.length]!;
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = color;
      for (const c of corpse.cells) glyph("+", c.x, c.y);
      ctx.globalAlpha = 1;
    }

    const HEAD: Record<string, string> = { up: "^", down: "v", left: "<", right: ">" };

    for (const p of state.players) {
      if (p.body.length === 0) continue;
      const color = SNAKE_COLORS[p.colorIndex % SNAKE_COLORS.length]!;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      p.body.forEach((c, i) => {
        ctx.shadowBlur = i === 0 ? 12 : 5;
        glyph(i === 0 ? (HEAD[p.dir] ?? "@") : "o", c.x, c.y);
      });
      ctx.shadowBlur = 0;

      const head = p.body[0];
      if (head) {
        ctx.font = `600 10px "JetBrains Mono", Menlo, Consolas, monospace`;
        ctx.fillStyle = color;
        ctx.fillText(
          p.id === myId ? "you" : p.name,
          head.x * CELL + CELL / 2,
          head.y * CELL - 5,
        );
        ctx.font = MONO;
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