export const COLS = 32;
export const ROWS = 32;
export const TICK_MS = 120;
export const SNAKE_COLORS = [
  "oklch(0.82 0.21 145)",
  "oklch(0.75 0.19 320)",
  "oklch(0.8 0.17 235)",
  "oklch(0.85 0.18 90)",
  "oklch(0.75 0.2 25)",
  "oklch(0.85 0.15 190)",
];

export type Cell = { x: number; y: number };
export type Dir = "up" | "down" | "left" | "right";

export type Player = {
  id: string;
  name: string;
  colorIndex: number;
  body: Cell[];
  dir: Dir;
  alive: boolean;
  score: number;
  respawnAt: number;
};

export type GameState = {
  players: Player[];
  food: Cell[];
};

const DELTA: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export function randomCell(): Cell {
  return {
    x: Math.floor(Math.random() * COLS),
    y: Math.floor(Math.random() * ROWS),
  };
}

export function spawnPlayer(id: string, name: string, colorIndex: number): Player {
  const head = {
    x: 4 + Math.floor(Math.random() * (COLS - 8)),
    y: 4 + Math.floor(Math.random() * (ROWS - 8)),
  };
  return {
    id,
    name,
    colorIndex,
    body: [head, { x: head.x - 1, y: head.y }, { x: head.x - 2, y: head.y }],
    dir: "right",
    alive: true,
    score: 0,
    respawnAt: 0,
  };
}

export function applyInput(player: Player, dir: Dir) {
  if (OPPOSITE[player.dir] === dir) return;
  player.dir = dir;
}

/** Advances the world one tick. Mutates the given state (host-authoritative). */
export function step(state: GameState) {
  const now = Date.now();

  while (state.food.length < 5) state.food.push(randomCell());

  const occupied = new Set<string>();
  for (const p of state.players) {
    if (!p.alive) continue;
    for (const c of p.body) occupied.add(`${c.x},${c.y}`);
  }

  for (const p of state.players) {
    if (!p.alive) {
      if (now >= p.respawnAt) {
        const fresh = spawnPlayer(p.id, p.name, p.colorIndex);
        p.body = fresh.body;
        p.dir = fresh.dir;
        p.alive = true;
      }
      continue;
    }

    const d = DELTA[p.dir];
    const head = { x: p.body[0]!.x + d.x, y: p.body[0]!.y + d.y };

    const hitWall = head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS;
    if (hitWall || occupied.has(`${head.x},${head.y}`)) {
      p.alive = false;
      p.score = 0;
      p.body = [];
      p.respawnAt = now + 1500;
      continue;
    }

    p.body.unshift(head);
    occupied.add(`${head.x},${head.y}`);

    const foodIndex = state.food.findIndex((f) => f.x === head.x && f.y === head.y);
    if (foodIndex >= 0) {
      state.food.splice(foodIndex, 1);
      state.food.push(randomCell());
      p.score += 1;
    } else {
      const tail = p.body.pop();
      if (tail) occupied.delete(`${tail.x},${tail.y}`);
    }
  }
}