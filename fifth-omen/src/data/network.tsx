import { createContext, createEffect, onCleanup, useContext, type JSX } from "solid-js";
import { AppContext, type AppContextStore, type GameScreenConnection, type PlayerConnection, type RoomState } from "./app";
import { gameWsUrl } from "../config/server";
import { playbooks } from "../game";

const JOIN_TIMEOUT_MS = 8000;
const RECONNECT_DELAY_MS = 2000;

export interface NetworkStore {
  joinGameScreen: (roomCode: string, pin: string) => void;
  joinPlayer: (roomCode: string, pin: string, name: string) => void;
  selectSeat: (seat: number) => void;
  selectClass: (classId: number) => void;
  beginGame: () => void;
  setGlobalState: (value: { doom?: number; ward?: number }) => void;
  revealRitualCard: (tarotNumber: number) => void;
  resolveRitualPhase: () => void;
  draftEntityDie: (dieValue: number) => void;
  draftEntityDieForEntity: (dieValue: number) => void;
  resolveEntityPlayerAction: (presenceDamage: number) => void;
  resolveEntityAction: () => void;
  leaveRoom: () => void;
  closeConnectionPrompt: () => void;
}

export const NetworkContext = createContext<NetworkStore>();
export const useNetwork = () => useContext(NetworkContext);

const roomCodeFromUrl = () => new URLSearchParams(window.location.search).get("room")?.trim().toUpperCase() ?? "";
const clearRoomFromUrl = () => {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("room")) return;
  url.searchParams.delete("room");
  window.history.replaceState({}, "", url);
};
const clearedPlayerState = (value: ReturnType<AppContextStore["contextValue"]>) => ({
  ...value,
  selectedPlaybook: null,
  playerHealth: 0,
  playerProgressionChoices: [null, null, null] as Array<"left" | "right" | null>,
});
const normalizeWsUrl = (endpointUrl: string) => {
  const url = new URL(endpointUrl, window.location.href);
  if (url.protocol === "http:") url.protocol = "ws:";
  if (url.protocol === "https:") url.protocol = "wss:";
  return url;
};
const parseRoomState = (value: unknown): RoomState | null => {
  if (!value || typeof value !== "object") return null;
  const room = value as RoomState;
  return typeof room.code === "string" && Array.isArray(room.players) ? room : null;
};
const connectionFailureMessage = (event: CloseEvent) => {
  if (event.reason) return event.reason;
  if (event.code === 1006) return "Could not reach the game server.";
  if (event.code === 1008) return "The room code, PIN, or class was rejected.";
  if (event.code === 1013) return "The room is full or temporarily unavailable.";
  return "Failed to connect to the room.";
};

export const NetworkProvider = (props: { children: JSX.Element }) => {
  const app = useContext(AppContext);
  let playerSocket: WebSocket | null = null;
  let gameScreenSocket: WebSocket | null = null;
  let playerReconnectTimer: number | undefined;
  let gameScreenReconnectTimer: number | undefined;
  let playerJoinTimer: number | undefined;
  let gameScreenJoinTimer: number | undefined;
  let playerJoined = false;
  let gameScreenJoined = false;
  let playerClosed = false;
  let gameScreenClosed = false;

  const updateRoomState = (roomState: RoomState | null) => {
    if (!app) return;
    const current = app.contextValue();
    const ritual = roomState?.ritual;
    const drawnTarotCards = ritual?.drawnCards.map((card) => typeof card.tarotNumber === "number" ? card.tarotNumber : null);
    const activeArcanaCards = ritual?.drawnCards.filter((card) => card.kind === "Encounter")
      .map((card) => typeof card.tarotNumber === "number" ? card.tarotNumber : null).slice(0, 2);
    const activeEntityCard = ritual?.drawnCards.find((card) => card.kind === "Entity" && typeof card.tarotNumber === "number" && !card.resolved)?.tarotNumber ?? current.activeEntityCard;
    app.setContextValue({
      ...current, roomState,
      globalDoom: typeof roomState?.global.doom === "number" ? roomState.global.doom : current.globalDoom,
      globalWard: typeof roomState?.global.ward === "number" ? roomState.global.ward : current.globalWard,
      drawnTarotCards: drawnTarotCards?.length ? drawnTarotCards : current.drawnTarotCards,
      currentPhase: ritual?.phase === "complete" ? ritual.drawnCards.length : ritual?.currentStep ?? current.currentPhase,
      activeArcanaCards: activeArcanaCards?.length ? activeArcanaCards : current.activeArcanaCards,
      activeEntityCard,
      entityPresence: typeof roomState?.entity?.presence === "number" ? roomState.entity.presence : current.entityPresence,
    });
  };
  const updatePlayer = (value: Partial<PlayerConnection>) => {
    if (!app) return;
    app.setContextValue({ ...app.contextValue(), playerConnection: { ...app.contextValue().playerConnection, ...value } });
  };
  const updateGameScreen = (value: Partial<GameScreenConnection>) => {
    if (!app) return;
    app.setContextValue({ ...app.contextValue(), gameScreenConnection: { ...app.contextValue().gameScreenConnection, ...value } });
  };
  const closePlayer = () => {
    playerClosed = true;
    if (playerReconnectTimer) window.clearTimeout(playerReconnectTimer);
    if (playerJoinTimer) window.clearTimeout(playerJoinTimer);
    playerReconnectTimer = playerJoinTimer = undefined;
    playerSocket?.close(); playerSocket = null;
  };
  const closeGameScreen = () => {
    gameScreenClosed = true;
    if (gameScreenReconnectTimer) window.clearTimeout(gameScreenReconnectTimer);
    if (gameScreenJoinTimer) window.clearTimeout(gameScreenJoinTimer);
    gameScreenReconnectTimer = gameScreenJoinTimer = undefined;
    gameScreenSocket?.close(); gameScreenSocket = null;
  };

  const connectGameScreen = () => {
    const current = app?.contextValue().gameScreenConnection;
    if (!current?.roomCode || (!current.pin && !current.reconnectToken)) return;
    closeGameScreen(); gameScreenClosed = false; gameScreenJoined = false;
    const endpointUrl = current.endpointUrl || gameWsUrl();
    const url = normalizeWsUrl(endpointUrl);
    url.searchParams.set("room", current.roomCode); url.searchParams.set("role", "gamescreen");
    if (current.pin) url.searchParams.set("pin", current.pin);
    if (current.reconnectToken) url.searchParams.set("reconnect_token", current.reconnectToken);
    updateGameScreen({ endpointUrl, status: "connecting", error: null });
    const socket = gameScreenSocket = new WebSocket(url);
    gameScreenJoinTimer = window.setTimeout(() => {
      if (gameScreenSocket !== socket || gameScreenJoined) return;
      updateGameScreen({ status: "error", error: "Failed to connect to the room.", reconnectToken: "" }); closeGameScreen();
    }, JOIN_TIMEOUT_MS);
    socket.addEventListener("message", (event) => {
      if (gameScreenSocket !== socket) return;
      let message: any; try { message = JSON.parse(event.data); } catch { return; }
      if (["room_state", "ritual_updated", "entity_updated", "game_begun"].includes(message.type)) { updateRoomState(parseRoomState(message.room ?? message.data?.room)); return; }
      if (message.type === "error") {
        updateGameScreen({ status: gameScreenJoined ? "connected" : "error", error: message.data?.message || "The server rejected the connection.", reconnectToken: gameScreenJoined ? current.reconnectToken : "" });
        if (!gameScreenJoined) closeGameScreen(); return;
      }
      if (message.type !== "joined") return;
      gameScreenJoined = true; if (gameScreenJoinTimer) window.clearTimeout(gameScreenJoinTimer);
      updateRoomState(parseRoomState(message.data?.room));
      updateGameScreen({ reconnectToken: typeof message.data?.session?.reconnectToken === "string" ? message.data.session.reconnectToken : current.reconnectToken, status: "connected", error: null });
    });
    socket.addEventListener("close", (event) => {
      if (gameScreenSocket !== socket) return; gameScreenSocket = null;
      if (gameScreenClosed) return;
      if (gameScreenJoinTimer) window.clearTimeout(gameScreenJoinTimer);
      if (!gameScreenJoined || [1008, 1003, 1013].includes(event.code)) { updateGameScreen({ status: "error", error: connectionFailureMessage(event), pin: "", reconnectToken: "" }); return; }
      updateGameScreen({ status: "disconnected", error: "Connection lost. Reconnecting..." });
      gameScreenReconnectTimer = window.setTimeout(connectGameScreen, RECONNECT_DELAY_MS);
    });
    socket.addEventListener("error", () => { if (gameScreenSocket === socket && !gameScreenJoined) updateGameScreen({ status: "error", error: "Could not connect to the game server." }); });
  };

  const connectPlayer = () => {
    const current = app?.contextValue().playerConnection;
    const roomCode = current?.roomCode || roomCodeFromUrl();
    if (!current || !roomCode || (!current.pin && !current.reconnectToken)) return;
    closePlayer(); playerClosed = false; playerJoined = false;
    const endpointUrl = current.endpointUrl || gameWsUrl(); const url = normalizeWsUrl(endpointUrl);
    url.searchParams.set("room", roomCode); url.searchParams.set("role", "player");
    if (current.pin) url.searchParams.set("pin", current.pin);
    if (current.name.trim()) url.searchParams.set("name", current.name.trim());
    if (current.reconnectToken) url.searchParams.set("reconnect_token", current.reconnectToken);
    if (current.seat !== null) url.searchParams.set("seat", String(current.seat));
    updatePlayer({ endpointUrl, roomCode, status: "connecting", error: null });
    const socket = playerSocket = new WebSocket(url);
    playerJoinTimer = window.setTimeout(() => { if (playerSocket === socket && !playerJoined) { updatePlayer({ status: "error", error: "Failed to connect to the room." }); closePlayer(); } }, JOIN_TIMEOUT_MS);
    socket.addEventListener("message", (event) => {
      if (playerSocket !== socket) return;
      let message: any; try { message = JSON.parse(event.data); } catch { return; }
      if (["room_state", "game_begun", "ritual_updated", "entity_updated"].includes(message.type)) { updateRoomState(parseRoomState(message.room ?? message.data?.room)); return; }
      if (message.type === "seat_selected" || message.type === "class_selected") {
        const room = parseRoomState(message.data?.room); updateRoomState(room);
        updatePlayer({ seat: typeof message.data?.seat === "number" ? message.data.seat : app?.contextValue().playerConnection.seat, classId: typeof message.data?.classId === "number" ? message.data.classId : app?.contextValue().playerConnection.classId, reconnectToken: typeof message.data?.reconnectToken === "string" ? message.data.reconnectToken : app?.contextValue().playerConnection.reconnectToken, error: null }); return;
      }
      if (message.type === "error") {
        const code = message.data?.code;
        if (code === "seat_occupied" || code === "invalid_seat") { updatePlayer({ seat: null, error: message.data?.message || "That seat is not available." }); return; }
        if (code === "class_taken" || code === "invalid_class") { updatePlayer({ error: message.data?.message || "That class is not available." }); return; }
        updatePlayer({ status: "error", error: message.data?.message || "The server rejected the connection." }); if (!playerJoined) closePlayer(); return;
      }
      if (message.type !== "joined") return;
      playerJoined = true; if (playerJoinTimer) window.clearTimeout(playerJoinTimer);
      const session = message.data?.session ?? {}; const classId = typeof session.classId === "number" ? session.classId : null;
      updateRoomState(parseRoomState(message.data?.room));
      if (classId !== null && app) {
        const playbook = playbooks[classId];
        app.setContextValue({ ...app.contextValue(), selectedPlaybook: classId, playerHealth: playbook?.health ?? app.contextValue().playerHealth, playerConnection: { ...app.contextValue().playerConnection, reconnectToken: typeof session.reconnectToken === "string" ? session.reconnectToken : current.reconnectToken, seat: typeof session.seat === "number" ? session.seat : null, classId, status: "connected", error: null } });
      } else updatePlayer({ reconnectToken: typeof session.reconnectToken === "string" ? session.reconnectToken : current.reconnectToken, seat: typeof session.seat === "number" ? session.seat : null, classId, status: "connected", error: null });
    });
    socket.addEventListener("close", (event) => {
      if (playerSocket !== socket) return; playerSocket = null; if (playerClosed) return;
      if (playerJoinTimer) window.clearTimeout(playerJoinTimer);
      if (!playerJoined || [1008, 1003, 1013].includes(event.code)) { updatePlayer({ status: "error", error: connectionFailureMessage(event), pin: "" }); return; }
      updatePlayer({ status: "disconnected", error: "Connection lost. Reconnecting..." }); playerReconnectTimer = window.setTimeout(connectPlayer, RECONNECT_DELAY_MS);
    });
    socket.addEventListener("error", () => { if (playerSocket === socket && !playerJoined) updatePlayer({ status: "error", error: "Could not connect to the game server." }); });
  };

  const leaveRoom = () => {
    const socket = app?.contextValue().deviceMode === "player" ? playerSocket : gameScreenSocket;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "leave_room" }));
    closePlayer(); closeGameScreen(); closeConnectionPrompt();
  };
  const closeConnectionPrompt = () => {
    if (!app) return; clearRoomFromUrl();
    const current = app.contextValue(); const base = current.deviceMode === "player" ? clearedPlayerState(current) : current;
    app.setContextValue({
      ...base, deviceMode: null, roomState: null,
      gameScreenConnection: { endpointUrl: base.gameScreenConnection.endpointUrl, roomCode: "", pin: "", reconnectToken: "", status: "idle", error: null },
      playerConnection: { endpointUrl: base.playerConnection.endpointUrl, roomCode: "", pin: "", name: base.playerConnection.name, reconnectToken: base.playerConnection.reconnectToken, seat: null, classId: null, status: "idle", error: null },
    });
  };
  const joinPlayer = (roomCode: string, pin: string, name: string) => updatePlayer({ endpointUrl: gameWsUrl(), roomCode: roomCode.trim().toUpperCase(), pin: pin.trim(), name: name.trim(), reconnectToken: "", seat: null, classId: app?.contextValue().selectedPlaybook ?? null, status: "disconnected", error: null });
  const joinGameScreen = (roomCode: string, pin: string) => updateGameScreen({ endpointUrl: gameWsUrl(), roomCode: roomCode.trim().toUpperCase(), pin: pin.trim(), reconnectToken: "", status: "disconnected", error: null });

  createEffect(() => { const current = app?.contextValue(); if (!current) return; if (current.deviceMode === "player" && current.playerConnection.status === "disconnected") connectPlayer(); if (current.deviceMode === "gamesheet" && current.gameScreenConnection.status === "disconnected") connectGameScreen(); });
  const sendPlayer = (type: string, detail?: object) => { if (playerSocket?.readyState === WebSocket.OPEN) playerSocket.send(JSON.stringify({ type, ...detail })); };
  const selectSeat = (seat: number) => {
    if (!app) return;
    app.setContextValue({ ...app.contextValue(), selectedPlaybook: null, playerConnection: { ...app.contextValue().playerConnection, seat, classId: null, error: null } });
    sendPlayer("select_seat", { seat });
  };
  const selectClass = (classId: number) => {
    if (!app) return;
    const playbook = playbooks[classId];
    app.setContextValue({ ...app.contextValue(), selectedPlaybook: classId, playerHealth: playbook?.health ?? app.contextValue().playerHealth, playerProgressionChoices: [null, null, null], playerConnection: { ...app.contextValue().playerConnection, classId, error: null } });
    sendPlayer("select_class", { classId });
  };
  const beginGame = () => sendPlayer("begin_game");
  const setGlobalState = (value: { doom?: number; ward?: number }) => {
    if (app) app.setContextValue({ ...app.contextValue(), globalDoom: value.doom ?? app.contextValue().globalDoom, globalWard: value.ward ?? app.contextValue().globalWard });
    sendPlayer("set_global_state", value);
  };
  const revealRitualCard = (tarotNumber: number) => sendPlayer("reveal_ritual_card", { tarotNumber });
  const resolveRitualPhase = () => sendPlayer("resolve_ritual_phase");
  const draftEntityDie = (dieValue: number) => sendPlayer("draft_entity_die", { dieValue });
  const draftEntityDieForEntity = (dieValue: number) => sendPlayer("draft_entity_die_for_entity", { dieValue });
  const resolveEntityPlayerAction = (presenceDamage: number) => sendPlayer("resolve_entity_player_action", { presenceDamage });
  const resolveEntityAction = () => sendPlayer("resolve_entity_action");
  onCleanup(() => {
    closePlayer(); closeGameScreen();
  });
  return <NetworkContext.Provider value={{ joinPlayer, joinGameScreen, selectSeat, selectClass, beginGame, setGlobalState, revealRitualCard, resolveRitualPhase, draftEntityDie, draftEntityDieForEntity, resolveEntityPlayerAction, resolveEntityAction, leaveRoom, closeConnectionPrompt }}>{props.children}</NetworkContext.Provider>;
};
