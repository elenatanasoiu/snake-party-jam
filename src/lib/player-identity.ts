const ID_KEY = "snake.playerId";
const NAME_KEY = "snake.playerName";

export function getPlayerId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = window.localStorage.getItem(ID_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2, 10);
    window.localStorage.setItem(ID_KEY, id);
  }
  return id;
}

export function getPlayerName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(NAME_KEY) ?? "";
}

export function setPlayerName(name: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NAME_KEY, name);
}

export function slugifyRoom(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return slug || `room-${Math.random().toString(36).slice(2, 6)}`;
}