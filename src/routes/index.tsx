import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SnakeArena } from "@/components/SnakeArena";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSnakeRoom } from "@/hooks/useSnakeRoom";
import { SNAKE_COLORS, type Dir } from "@/lib/snake-engine";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Neon Snake Arena — Multiplayer Snake in One Room" },
      {
        name: "description",
        content:
          "Jump into a shared arena and play snake live against everyone else online. No signup, just pick a name and grab the arrow keys.",
      },
      { property: "og:title", content: "Neon Snake Arena — Multiplayer Snake" },
      {
        property: "og:description",
        content: "Live multiplayer snake in a single shared room. Pick a name and play instantly.",
      },
    ],
  }),
  component: Index,
});

const KEY_MAP: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

function Index() {
  const myId = useMemo(() => Math.random().toString(36).slice(2, 10), []);
  const [draft, setDraft] = useState("");
  const [name, setName] = useState<string | null>(null);
  const { state, members, connected, isHost, sendDir } = useSnakeRoom(myId, name);

  useEffect(() => {
    if (!name) return;
    const onKey = (e: KeyboardEvent) => {
      const dir = KEY_MAP[e.key];
      if (!dir) return;
      e.preventDefault();
      sendDir(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [name, sendDir]);

  const leaderboard = [...state.players].sort((a, b) => b.score - a.score);

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="text-center">
          <h1 className="text-4xl font-black tracking-tight text-primary uppercase drop-shadow-[0_0_18px_var(--primary)]">
            Neon Snake Arena
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            One room, everyone at once. Arrow keys or WASD. Hit a wall or a snake and you respawn.
          </p>
        </header>

        {!name ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = draft.trim().slice(0, 12);
              if (trimmed) setName(trimmed);
            }}
            className="mx-auto flex w-full max-w-sm flex-col gap-3 rounded-xl border border-border bg-card p-6"
          >
            <label htmlFor="name" className="text-sm font-medium text-card-foreground">
              Pick a name to join
            </label>
            <Input
              id="name"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Slitherbot"
              maxLength={12}
              autoFocus
            />
            <Button type="submit" disabled={!draft.trim()}>
              Join the arena
            </Button>
          </form>
        ) : (
          <div className="flex flex-col items-center gap-6 md:flex-row md:items-start md:justify-center">
            <SnakeArena state={state} myId={myId} />

            <aside className="w-full max-w-xs rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{connected ? "Connected" : "Connecting…"}</span>
                <span>
                  {members.length} player{members.length === 1 ? "" : "s"}
                  {isHost ? " · hosting" : ""}
                </span>
              </div>
              <h2 className="mt-3 mb-2 text-sm font-semibold text-card-foreground uppercase">
                Leaderboard
              </h2>
              <ul className="flex flex-col gap-2">
                {leaderboard.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <span
                      className="size-3 rounded-sm"
                      style={{ backgroundColor: SNAKE_COLORS[p.colorIndex % SNAKE_COLORS.length] }}
                    />
                    <span className="flex-1 truncate text-card-foreground">
                      {p.name}
                      {p.id === myId ? " (you)" : ""}
                    </span>
                    <span className="text-muted-foreground">
                      {p.alive ? p.score : "respawning"}
                    </span>
                  </li>
                ))}
                {leaderboard.length === 0 && (
                  <li className="text-sm text-muted-foreground">Waiting for the first tick…</li>
                )}
              </ul>

              <div className="mt-5 grid grid-cols-3 gap-2 md:hidden">
                <span />
                <Button variant="secondary" onClick={() => sendDir("up")}>
                  ↑
                </Button>
                <span />
                <Button variant="secondary" onClick={() => sendDir("left")}>
                  ←
                </Button>
                <Button variant="secondary" onClick={() => sendDir("down")}>
                  ↓
                </Button>
                <Button variant="secondary" onClick={() => sendDir("right")}>
                  →
                </Button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
