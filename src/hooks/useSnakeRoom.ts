import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  applyInput,
  emptyState,
  LOOP_MS,
  makePlayer,
  SNAKE_COLORS,
  step,
  type Corpse,
  type Dir,
  type GameState,
} from "@/lib/snake-engine";

type Member = { id: string; name: string; joinedAt: number };

export function useSnakeRoom(roomId: string, myId: string, myName: string | null) {
  const [state, setState] = useState<GameState>(emptyState);
  const [members, setMembers] = useState<Member[]>([]);
  const [connected, setConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const worldRef = useRef<GameState>(emptyState());
  const membersRef = useRef<Member[]>([]);
  const isHostRef = useRef(false);
  const pendingRef = useRef<Record<string, Dir>>({});

  useEffect(() => {
    if (!myName) return;
    const joinedAt = Date.now();
    let lastTickAt = 0;

    const channel = supabase.channel(`snake:${roomId}`, {
      config: { presence: { key: myId } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const raw = channel.presenceState<Member>();
        const list = Object.values(raw)
          .map((entries) => entries[0])
          .filter((m): m is Member & { presence_ref: string } => Boolean(m))
          .map((m) => ({ id: m.id, name: m.name, joinedAt: m.joinedAt }))
          .sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
        membersRef.current = list;
        setMembers(list);
        const host = list[0]?.id === myId;
        isHostRef.current = host;
        setIsHost(host);
      })
      .on("broadcast", { event: "state" }, ({ payload }) => {
        if (isHostRef.current) return;
        setState(payload as GameState);
      })
      .on("broadcast", { event: "input" }, ({ payload }) => {
        const { id, dir } = payload as { id: string; dir: Dir };
        pendingRef.current[id] = dir;
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true);
          await channel.track({ id: myId, name: myName, joinedAt });
        }
      });

    const timer = setInterval(() => {
      const world = worldRef.current;
      if (!isHostRef.current) {
        pendingRef.current = {};
        return;
      }

      const roster = membersRef.current;
      // Add joiners, drop leavers.
      world.players = world.players.filter((p) => roster.some((m) => m.id === p.id));
      // Give each joiner the lowest colour index nobody in the room is using,
      // so two snakes never share a colour while the palette has room.
      roster.forEach((m) => {
        if (world.players.some((p) => p.id === m.id)) return;
        const taken = new Set(world.players.map((p) => p.colorIndex));
        let colorIndex = 0;
        while (colorIndex < SNAKE_COLORS.length && taken.has(colorIndex)) colorIndex += 1;
        world.players.push(
          makePlayer(m.id, m.name, colorIndex % SNAKE_COLORS.length),
        );
      });

      // The board runs faster as the round goes on, so gate on elapsed time.
      const now = Date.now();
      if (world.phase === "playing" && now - lastTickAt < world.tickMs) return;
      lastTickAt = now;

      // Apply queued inputs for everyone (host authoritative).
      for (const [id, dir] of Object.entries(pendingRef.current)) {
        const player = world.players.find((p) => p.id === id);
        if (player && player.alive) applyInput(player, dir);
      }
      pendingRef.current = {};

      step(world);
      const snapshot: GameState = {
        ...world,
        players: world.players.map((p) => ({ ...p, body: p.body.map((c) => ({ ...c })) })),
        food: world.food.map((c) => ({ ...c })),
        corpses: world.corpses.map(
          (c): Corpse => ({ colorIndex: c.colorIndex, cells: c.cells.map((cell) => ({ ...cell })) }),
        ),
      };
      setState(snapshot);
      channel.send({ type: "broadcast", event: "state", payload: snapshot });
    }, LOOP_MS);

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
      channelRef.current = null;
      setConnected(false);
    };
  }, [roomId, myId, myName]);

  const sendDir = useCallback(
    (dir: Dir) => {
      if (isHostRef.current) {
        pendingRef.current[myId] = dir;
        return;
      }
      channelRef.current?.send({
        type: "broadcast",
        event: "input",
        payload: { id: myId, dir },
      });
    },
    [myId],
  );

  return { state, members, connected, isHost, sendDir };
}