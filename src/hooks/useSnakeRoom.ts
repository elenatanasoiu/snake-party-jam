import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  applyInput,
  spawnPlayer,
  step,
  TICK_MS,
  type Dir,
  type GameState,
} from "@/lib/snake-engine";

const ROOM = "snake-room-1";

type Member = { id: string; name: string; joinedAt: number };

export function useSnakeRoom(myId: string, myName: string | null) {
  const [state, setState] = useState<GameState>({ players: [], food: [] });
  const [members, setMembers] = useState<Member[]>([]);
  const [connected, setConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const worldRef = useRef<GameState>({ players: [], food: [] });
  const membersRef = useRef<Member[]>([]);
  const isHostRef = useRef(false);
  const pendingRef = useRef<Record<string, Dir>>({});

  useEffect(() => {
    if (!myName) return;
    const joinedAt = Date.now();

    const channel = supabase.channel(ROOM, {
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
      // Apply queued inputs for everyone (host authoritative).
      const world = worldRef.current;
      if (!isHostRef.current) {
        pendingRef.current = {};
        return;
      }

      const roster = membersRef.current;
      // Add joiners, drop leavers.
      world.players = world.players.filter((p) => roster.some((m) => m.id === p.id));
      roster.forEach((m, i) => {
        if (!world.players.some((p) => p.id === m.id)) {
          world.players.push(spawnPlayer(m.id, m.name, i % 6));
        }
      });

      for (const [id, dir] of Object.entries(pendingRef.current)) {
        const player = world.players.find((p) => p.id === id);
        if (player && player.alive) applyInput(player, dir);
      }
      pendingRef.current = {};

      step(world);
      const snapshot: GameState = {
        players: world.players.map((p) => ({ ...p, body: p.body.map((c) => ({ ...c })) })),
        food: world.food.map((c) => ({ ...c })),
      };
      setState(snapshot);
      channel.send({ type: "broadcast", event: "state", payload: snapshot });
    }, TICK_MS);

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
      channelRef.current = null;
      setConnected(false);
    };
  }, [myId, myName]);

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