export const COLS = 32;
export const ROWS = 32;
export const LOOP_MS = 10;
export const START_TICK_MS = 115;
export const MIN_TICK_MS = 50;
export const SPEEDUP_EVERY_TICKS = 25;
export const SPEEDUP_STEP_MS = 5;
export const MAX_FOOD = 10;
/** Every snake loses one tail segment this often — eat to stay ahead of it. */
export const STARVE_MS = 20000;
export const START_LENGTH = 3;
export const ROUND_BREAK_MS = 4000;
export const SNAKE_COLORS = [
  "oklch(0.82 0.21 145)",
  "oklch(0.75 0.19 320)",
  "oklch(0.8 0.17 235)",
  "oklch(0.85 0.18 90)",
  "oklch(0.75 0.2 25)",
  "oklch(0.85 0.15 190)",
  "oklch(0.8 0.2 60)",
  "oklch(0.78 0.18 285)",
];

export type Cell = { x: number; y: number };
export type Dir = "up" | "down" | "left" | "right";
export type Phase = "waiting" | "playing" | "ended";

export type Player = {
  id: string;
  name: string;
  colorIndex: number;
  body: Cell[];
  dir: Dir;
  alive: boolean;
  score: number;
  wins: number;
  /** Timestamp of the next hunger shrink. */
  starveAt: number;
};

export type Corpse = { cells: Cell[]; colorIndex: number };

export type GameState = {
  phase: Phase;
  players: Player[];
  food: Cell[];
  corpses: Corpse[];
  tick: number;
  tickMs: number;
  winnerName: string | null;
  nextRoundAt: number;
};

export function emptyState(): GameState {
  return {
    phase: "waiting",
    players: [],
    food: [],
    corpses: [],
    tick: 0,
    tickMs: START_TICK_MS,
    winnerName: null,
    nextRoundAt: 0,
  };
}

const DELTA: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const OPPOSITE: Record<Dir, Dir> = {
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

/** Food must never land under a snake, a corpse or another dot. */
export function freeCell(state: GameState): Cell {
  const taken = new Set<string>();
  for (const p of state.players) for (const c of p.body) taken.add(`${c.x},${c.y}`);
  for (const corpse of state.corpses) for (const c of corpse.cells) taken.add(`${c.x},${c.y}`);
  for (const f of state.food) taken.add(`${f.x},${f.y}`);
  for (let i = 0; i < 200; i++) {
    const cell = randomCell();
    if (!taken.has(`${cell.x},${cell.y}`)) return cell;
  }
  return randomCell();
}

export function makePlayer(id: string, name: string, colorIndex: number): Player {
  return {
    id,
    name,
    colorIndex,
    body: [],
    dir: "right",
    alive: false,
    score: 0,
    wins: 0,
    starveAt: 0,
  };
}

/**
 * Each snake gets its own horizontal lane, alternating sides and travelling
 * outward-to-inward, so nobody starts pointed straight at another snake.
 */
function respawn(player: Player, index: number) {
  const lane = 3 + (index % 6) * 5;
  const fromLeft = index % 2 === 0;
  const head = { x: fromLeft ? 4 : COLS - 5, y: Math.min(ROWS - 3, lane) };
  const dir: Dir = fromLeft ? "right" : "left";
  const back = fromLeft ? -1 : 1;
  player.body = Array.from({ length: START_LENGTH }, (_, i) => ({
    x: head.x + back * i,
    y: head.y,
  }));
  player.dir = dir;
  player.alive = true;
  player.score = 0;
  player.starveAt = Date.now() + STARVE_MS;
}

export function startRound(state: GameState) {
  const roster = state.players;
  roster.forEach((p, i) => respawn(p, i));
  state.phase = "playing";
  state.corpses = [];
  state.food = [];
  for (let i = 0; i < 6; i++) state.food.push(freeCell(state));
  state.tick = 0;
  state.tickMs = START_TICK_MS;
  state.winnerName = null;
}

export function applyInput(player: Player, dir: Dir) {
  if (OPPOSITE[player.dir] === dir) return;
  player.dir = dir;
}

/** Corpses fade away one cell per tick, starting at the head. */
function decayCorpses(state: GameState) {
  for (const corpse of state.corpses) corpse.cells.shift();
  state.corpses = state.corpses.filter((c) => c.cells.length > 0);
}

/**
 * Advances the world one tick. Mutates the given state (host-authoritative).
 * All snakes move simultaneously, so head-on crashes kill both players.
 */
export function step(state: GameState) {
  const now = Date.now();
  decayCorpses(state);

  if (state.phase === "waiting") {
    // Solo practice is allowed: one player is enough to start a round.
    if (state.players.length >= 1) startRound(state);
    return;
  }

  if (state.phase === "ended") {
    if (now >= state.nextRoundAt) {
      if (state.players.length >= 1) startRound(state);
      else state.phase = "waiting";
    }
    return;
  }

  state.tick += 1;
  if (state.tick % SPEEDUP_EVERY_TICKS === 0) {
    state.tickMs = Math.max(MIN_TICK_MS, state.tickMs - SPEEDUP_STEP_MS);
  }

  // Occasional extra food so the board keeps filling up over time.
  if (state.tick % 30 === 0 && state.food.length < MAX_FOOD) {
    state.food.push(freeCell(state));
  }

  const living = state.players.filter((p) => p.alive);

  // Cells that are solid this tick: every body segment except each tail tip,
  // which vacates as the snake moves.
  const blocked = new Set<string>();
  for (const p of living) {
    p.body.slice(0, -1).forEach((c) => blocked.add(`${c.x},${c.y}`));
  }

  const nextHeads = new Map<string, Cell>();
  for (const p of living) {
    const d = DELTA[p.dir];
    nextHeads.set(p.id, { x: p.body[0]!.x + d.x, y: p.body[0]!.y + d.y });
  }

  const doomed = new Set<string>();
  for (const p of living) {
    const head = nextHeads.get(p.id)!;
    const outOfBounds = head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS;
    if (outOfBounds || blocked.has(`${head.x},${head.y}`)) {
      doomed.add(p.id);
      continue;
    }
    // Two heads entering the same cell: both die.
    for (const other of living) {
      if (other.id === p.id) continue;
      const otherHead = nextHeads.get(other.id)!;
      if (otherHead.x === head.x && otherHead.y === head.y) {
        doomed.add(p.id);
        doomed.add(other.id);
      }
    }
  }

  for (const p of living) {
    if (doomed.has(p.id)) {
      state.corpses.push({ cells: p.body, colorIndex: p.colorIndex });
      p.body = [];
      p.alive = false;
      continue;
    }

    const head = nextHeads.get(p.id)!;
    p.body.unshift(head);

    const foodIndex = state.food.findIndex((f) => f.x === head.x && f.y === head.y);
    if (foodIndex >= 0) {
      state.food.splice(foodIndex, 1);
      state.food.push(freeCell(state));
      p.score += 1;
    } else {
      p.body.pop();
    }

    // Hunger: bodies always decay, so you have to keep eating.
    if (now >= p.starveAt) {
      p.starveAt = now + STARVE_MS;
      p.body.pop();
      if (p.body.length === 0) {
        p.alive = false;
        continue;
      }
    }
  }

  const survivors = state.players.filter((p) => p.alive);
  // Solo: the round runs until you crash. Multiplayer: last snake standing wins.
  const roundOver = state.players.length === 1 ? survivors.length === 0 : survivors.length <= 1;
  if (roundOver) {
    state.phase = "ended";
    state.nextRoundAt = now + ROUND_BREAK_MS;
    const winner = survivors[0];
    state.winnerName = winner ? winner.name : null;
    if (winner) winner.wins += 1;
  }
}