import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type LobbyEntry = { id: string; name: string; roomId: string };
export type RoomSummary = { roomId: string; players: string[] };

/**
 * Shared lobby presence. Everyone sitting in a room announces it here, so the
 * lobby page can list live rooms without any database table.
 */
export function useLobby(myId: string, myName: string | null, roomId: string | null) {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);

  useEffect(() => {
    const channel = supabase.channel("snake:lobby", {
      config: { presence: { key: `${myId}:${roomId ?? "lobby"}` } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const raw = channel.presenceState<LobbyEntry>();
        const byRoom = new Map<string, string[]>();
        for (const entries of Object.values(raw)) {
          const entry = entries[0];
          if (!entry?.roomId) continue;
          const list = byRoom.get(entry.roomId) ?? [];
          list.push(entry.name);
          byRoom.set(entry.roomId, list);
        }
        setRooms(
          [...byRoom.entries()]
            .map(([id, players]) => ({ roomId: id, players }))
            .sort((a, b) => b.players.length - a.players.length || a.roomId.localeCompare(b.roomId)),
        );
      })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        if (roomId && myName) {
          await channel.track({ id: myId, name: myName, roomId });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myId, myName, roomId]);

  return rooms;
}