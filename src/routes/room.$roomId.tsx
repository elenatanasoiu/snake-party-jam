import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { SnakeArena } from "@/components/SnakeArena";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLobby } from "@/hooks/useLobby";
import { useSnakeRoom } from "@/hooks/useSnakeRoom";
import { getPlayerId, getPlayerName, setPlayerName } from "@/lib/player-identity";
import { SNAKE_COLORS, type Dir } from "@/lib/snake-engine";

export const Route = createFileRoute("/room/$roomId")({
  head: () => ({
    meta: [
      { title: "Snake Room — Neon Snake Arena" },
      {
        name: "description",
        content:
          "You've been invited to a live snake round. Pick a name, grab WASD and be the last snake standing.",
      },
      { property: "og:title", content: "Join my snake room" },
      {
        property: "og:description",
        content: "Last snake standing wins. Jump into the round — no signup needed.",
      },
    ],
  }),
  component: RoomPage,
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

function RoomPage() {
  const { roomId } = Route.useParams();
  const navigate = useNavigate();
  const myId = useMemo(getPlayerId, []);
  const [draft, setDraft] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const stored = getPlayerName();
    if (stored) setName(stored);
    else setDraft("");
  }, []);

  const { state, members, connected, isHost, sendDir } = useSnakeRoom(roomId, myId, name);
  useLobby(myId, name, name ? roomId : null);

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

  const leaderboard = [...state.players].sort(
    (a, b) => b.wins - a.wins || b.score - a.score || a.name.localeCompare(b.name),
  );
  const me = state.players.find((p) => p.id === myId);

  let banner = "Getting your snake ready…";
  if (state.phase === "playing") {
    banner =
      state.players.length === 1
        ? me?.alive
          ? "Solo run — share the invite link to add players."
          : "You crashed. Next run starting…"
        : me?.alive
          ? "Round live — stay alive."
          : "You're out. Watching until the next round.";
  } else if (state.phase === "ended") {
    banner = state.winnerName
      ? `${state.winnerName} wins the round! Next round starting…`
      : "Everyone crashed. Next round starting…";
  }

  if (!name) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = draft.trim().slice(0, 12);
            if (!trimmed) return;
            setPlayerName(trimmed);
            setName(trimmed);
          }}
          className="flex w-full max-w-sm flex-col gap-3 rounded-xl border border-border bg-card p-6"
        >
          <h1 className="text-2xl font-black tracking-tight text-primary uppercase">
            Join “{roomId}”
          </h1>
          <label htmlFor="name" className="text-sm text-muted-foreground">
            Your name shows above your snake.
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
            Enter the arena
          </Button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-primary uppercase">
              Room “{roomId}”
            </h1>
            <p className="text-sm text-muted-foreground">{banner}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                void navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Link copied" : "Copy invite link"}
            </Button>
            <Button variant="ghost" onClick={() => navigate({ to: "/" })}>
              Leave
            </Button>
          </div>
        </header>

        <div className="flex flex-col items-center gap-5 md:flex-row md:items-start md:justify-center">
          <div
            className="touch-none"
            onTouchStart={(e) => {
              const t = e.touches[0];
              touchStart.current = { x: t.clientX, y: t.clientY };
            }}
            onTouchEnd={(e) => {
              const start = touchStart.current;
              touchStart.current = null;
              if (!start) return;
              const t = e.changedTouches[0];
              const dx = t.clientX - start.x;
              const dy = t.clientY - start.y;
              if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
              if (Math.abs(dx) > Math.abs(dy)) sendDir(dx > 0 ? "right" : "left");
              else sendDir(dy > 0 ? "down" : "up");
            }}
          >
            <SnakeArena state={state} myId={myId} />
          </div>

          <aside className="w-full max-w-xs rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{connected ? "Connected" : "Connecting…"}</span>
              <span>
                {members.length} player{members.length === 1 ? "" : "s"}
                {isHost ? " · hosting" : ""}
              </span>
            </div>

            <h2 className="mt-3 mb-2 text-sm font-semibold text-card-foreground uppercase">
              Scoreboard
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
                    {p.wins}W · {p.alive ? `${p.score}` : "out"}
                  </span>
                </li>
              ))}
              {leaderboard.length === 0 && (
                <li className="text-sm text-muted-foreground">Nobody here yet.</li>
              )}
            </ul>

            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              WASD or arrow keys — on a phone, swipe the board or use the pad below. Eat dots to
              grow, and the board speeds up as the round goes on. Hit a wall, yourself or another
              snake and you're out — heads colliding kills both.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2 md:hidden">
              <span />
              <Button variant="secondary" className="touch-none" onPointerDown={() => sendDir("up")}>
                ↑
              </Button>
              <span />
              <Button
                variant="secondary"
                className="touch-none"
                onPointerDown={() => sendDir("left")}
              >
                ←
              </Button>
              <Button
                variant="secondary"
                className="touch-none"
                onPointerDown={() => sendDir("down")}
              >
                ↓
              </Button>
              <Button
                variant="secondary"
                className="touch-none"
                onPointerDown={() => sendDir("right")}
              >
                →
              </Button>
            </div>

            <Link
              to="/"
              className="mt-4 block text-xs text-muted-foreground underline hover:text-foreground"
            >
              Back to the lobby
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}