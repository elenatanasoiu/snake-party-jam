import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLobby } from "@/hooks/useLobby";
import { getPlayerId, getPlayerName, setPlayerName, slugifyRoom } from "@/lib/player-identity";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Neon Snake Arena — Multiplayer Snake Rooms" },
      {
        name: "description",
        content:
          "Create or join a live snake room and play against friends in the browser. Last snake standing wins the round. No signup, just a name.",
      },
      { property: "og:title", content: "Neon Snake Arena — Multiplayer Snake Rooms" },
      {
        property: "og:description",
        content:
          "Browse live rooms or start your own and share the link. Last snake standing wins the round.",
      },
    ],
  }),
  component: Lobby,
});

function Lobby() {
  const navigate = useNavigate();
  const myId = useMemo(getPlayerId, []);
  const [name, setName] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const rooms = useLobby(myId, null, null);

  useEffect(() => {
    setName(getPlayerName());
  }, []);

  const enterRoom = (roomId: string) => {
    const trimmed = name.trim().slice(0, 12);
    if (trimmed) setPlayerName(trimmed);
    navigate({ to: "/room/$roomId", params: { roomId } });
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="text-center">
          <h1 className="text-4xl font-black tracking-tight text-primary uppercase drop-shadow-[0_0_18px_var(--primary)]">
            Neon Snake Arena
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Multiplayer snake in the browser. Last snake standing wins the round, the board speeds up
            as you go, and dead snakes decay away from head to tail.
          </p>
        </header>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-card-foreground uppercase">Start playing</h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={12}
              aria-label="Your name"
            />
            <Input
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              placeholder="Room name"
              maxLength={24}
              aria-label="Room name"
            />
            <Button
              className="shrink-0"
              disabled={!name.trim()}
              onClick={() => enterRoom(slugifyRoom(roomInput))}
            >
              Create / join room
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Once you're in, hit “Copy invite link” and send it to anyone you want in the round.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-card-foreground uppercase">Live rooms</h2>
          {rooms.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No rooms running right now — create one above and share the link.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-border">
              {rooms.map((room) => (
                <li key={room.roomId} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-card-foreground">{room.roomId}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {room.players.join(", ")}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {room.players.length} player{room.players.length === 1 ? "" : "s"}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={!name.trim()}
                    onClick={() => enterRoom(room.roomId)}
                  >
                    Join
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
