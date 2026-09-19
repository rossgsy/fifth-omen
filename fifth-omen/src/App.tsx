import { Match, Show, Switch, createEffect, createSignal, onCleanup, onMount, useContext, type Component } from 'solid-js';
import AppContextProvider, { AppContext } from './data/app';
import type { AppContextStore, GameScreenConnection, PlayerConnection, RoomState } from './data/app';
import { Route, Router } from "@solidjs/router";
import PlaybookRoute from './routes/Playbook';
import GameSheetRoute from './routes/GameSheet';
import { ActionCard, Button, ConfirmDialog } from './components/ui';
import { Icon } from '@iconify-icon/solid';
import QRCode from 'qrcode';
import { gameWsUrl } from './config/server';
import { playbooks } from './game';

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  webkitRequestFullScreen?: () => Promise<void> | void;
};

const SHARE_URL = "https://fifth-omen.lab-2.paleglyph.com/";
const JOIN_TIMEOUT_MS = 8000;
const UPDATE_GLOBAL_STATE_EVENT = "fifth-omen:update-global-state";

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

const DeviceMenu: Component = () => {
  const appContext = useContext(AppContext);
  const canRejoin = () => Boolean(
    appContext?.contextValue().playerConnection.roomCode &&
    appContext?.contextValue().playerConnection.reconnectToken
  );
  const rejoinLabel = () => {
    const connection = appContext?.contextValue().playerConnection;
    const name = connection?.name?.trim() || "Player";
    const seat = typeof connection?.seat === "number" ? `Seat ${connection.seat + 1}` : "Choose a seat";
    return `${name} / ${seat}`;
  };

  const rejoinLastGame = () => {
    if (!appContext || !canRejoin()) return;
    const current = appContext.contextValue();
    appContext.setContextValue({
      ...clearedPlayerState(current),
      roomState: null,
      deviceMode: "player",
      playerConnection: {
        ...current.playerConnection,
        endpointUrl: current.playerConnection.endpointUrl || gameWsUrl(),
        pin: "",
        status: "disconnected",
        error: null,
      },
    });
  };

  const startPlayerJoin = () => {
    if (!appContext) return;
    clearRoomFromUrl();
    appContext.setContextValue({
      ...clearedPlayerState(appContext.contextValue()),
      roomState: null,
      deviceMode: "player",
      playerConnection: {
        ...appContext.contextValue().playerConnection,
        roomCode: "",
        pin: "",
        reconnectToken: "",
        seat: null,
        classId: null,
        status: "idle",
        error: null,
      },
    });
  };

  const startGameScreenJoin = () => {
    if (!appContext) return;
    appContext.setContextValue({
      ...appContext.contextValue(),
      roomState: null,
      deviceMode: "gamesheet",
      gameScreenConnection: {
        ...appContext.contextValue().gameScreenConnection,
        roomCode: "",
        pin: "",
        reconnectToken: "",
        status: "idle",
        error: null,
      },
    });
  };

  return <div class="flex flex-col min-h-100 grow p-4 justify-center gap-3">
    <Show when={canRejoin()}>
      <ActionCard
        eyebrow="Last Game"
        title="Rejoin"
        onClick={rejoinLastGame}
      >
        <p class="mt-2 text-sm uppercase tracking-[0.18em] text-zinc-600">
          {rejoinLabel()}
        </p>
      </ActionCard>
    </Show>
    <ActionCard
      eyebrow="Personal"
      title="Player Sheet"
      onClick={startPlayerJoin}
    />
    <ActionCard
      eyebrow="Shared"
      title="Game Sheet"
      onClick={startGameScreenJoin}
    />
  </div>
};

const DeviceBootstrap: Component = () => {
  const appContext = useContext(AppContext);

  onMount(() => {
    const room = roomCodeFromUrl();
    if (!appContext || !room) return;
    const current = appContext.contextValue();
    const isNewRoom = current.playerConnection.roomCode !== room;
    if (current.deviceMode && !isNewRoom) return;

    const baseValue = isNewRoom ? clearedPlayerState(current) : current;
    appContext.setContextValue({
      ...baseValue,
      roomState: null,
      deviceMode: "player",
      playerConnection: {
        ...baseValue.playerConnection,
        roomCode: room,
        pin: "",
        seat: null,
        classId: null,
        status: "idle",
        error: null,
        endpointUrl: baseValue.playerConnection.endpointUrl || gameWsUrl(),
      },
    });
  });

  return null;
};

const PreventAccidentalRefresh: Component = () => {
  const appContext = useContext(AppContext);

  const shouldWarn = () => {
    const value = appContext?.contextValue();
    if (!value?.deviceMode) return false;
    return Boolean(
      value.gameScreenConnection.roomCode ||
      value.playerConnection.roomCode ||
      value.selectedPlaybook !== null ||
      value.currentPhase > 0 ||
      value.drawnTarotCards.some((card) => card !== null)
    );
  };

  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!shouldWarn()) return;
    event.preventDefault();
    event.returnValue = "";
  };

  onMount(() => {
    window.addEventListener("beforeunload", handleBeforeUnload);
  });

  onCleanup(() => {
    window.removeEventListener("beforeunload", handleBeforeUnload);
  });

  return null;
};

const AppInner: Component = () => {
  const appContext = useContext(AppContext);
  const playerConnected = () => appContext?.contextValue().playerConnection.status === "connected";
  const gameScreenConnected = () => appContext?.contextValue().gameScreenConnection.status === "connected";

  return <Switch fallback={<DeviceMenu />}>
    <Match when={appContext?.contextValue().deviceMode === "player"}>
      <PlayerConnectionManager />
      <Show when={playerConnected()}>
        <Router>
          <Route path="/" component={PlaybookRoute} />
        </Router>
      </Show>
    </Match>
    <Match when={appContext?.contextValue().deviceMode === "gamesheet"}>
      <GameScreenConnectionManager />
      <Show when={gameScreenConnected()}>
        <Router>
          <Route path="/" component={GameSheetRoute} />
        </Router>
      </Show>
    </Match>
  </Switch>
};

const updateRoomState = (appContext: AppContextStore | undefined, roomState: RoomState | null) => {
  if (!appContext) return;

  const global = roomState?.global;
  appContext.setContextValue({
    ...appContext.contextValue(),
    roomState,
    globalDoom: typeof global?.doom === "number" ? global.doom : appContext.contextValue().globalDoom,
    globalWard: typeof global?.ward === "number" ? global.ward : appContext.contextValue().globalWard,
  });
};

const updateGameScreenConnection = (
  appContext: AppContextStore | undefined,
  value: Partial<GameScreenConnection>,
) => {
  if (!appContext) return;

  appContext.setContextValue({
    ...appContext.contextValue(),
    gameScreenConnection: {
      ...appContext.contextValue().gameScreenConnection,
      ...value,
    },
  });
};

const updatePlayerConnection = (
  appContext: AppContextStore | undefined,
  value: Partial<PlayerConnection>,
) => {
  if (!appContext) return;

  appContext.setContextValue({
    ...appContext.contextValue(),
    playerConnection: {
      ...appContext.contextValue().playerConnection,
      ...value,
    },
  });
};

const leaveRoom = (appContext: AppContextStore | undefined) => {
  if (!appContext) return;

  window.dispatchEvent(new Event("fifth-omen:leave-room"));
  closeConnectionPrompt(appContext);
};

const closeConnectionPrompt = (appContext: AppContextStore | undefined) => {
  if (!appContext) return;

  clearRoomFromUrl();
  const mode = appContext.contextValue().deviceMode;
  const baseValue = mode === "player" ? clearedPlayerState(appContext.contextValue()) : appContext.contextValue();

  appContext.setContextValue({
    ...baseValue,
    deviceMode: null,
    roomState: null,
    gameScreenConnection: {
      endpointUrl: baseValue.gameScreenConnection.endpointUrl,
      roomCode: "",
      pin: "",
      reconnectToken: "",
      status: "idle",
      error: null,
    },
    playerConnection: {
      endpointUrl: baseValue.playerConnection.endpointUrl,
      roomCode: "",
      pin: "",
      name: baseValue.playerConnection.name,
      reconnectToken: baseValue.playerConnection.reconnectToken,
      seat: null,
      classId: null,
      status: "idle",
      error: null,
    },
  });
};

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

  switch (event.code) {
    case 1006:
      return "Could not reach the game server.";
    case 1008:
      return "The room code, PIN, or class was rejected.";
    case 1013:
      return "The room is full or temporarily unavailable.";
    default:
      return "Failed to connect to the room.";
  }
};

const GameScreenConnectionManager: Component = () => {
  const appContext = useContext(AppContext);
  const [roomCodeInput, setRoomCodeInput] = createSignal("");
  const [pinInput, setPinInput] = createSignal("");
  let socket: WebSocket | null = null;
  let reconnectTimer: number | undefined;
  let joinTimer: number | undefined;
  let joined = false;
  let manuallyClosed = false;

  const connection = () => appContext?.contextValue().gameScreenConnection;
  const hasCredentials = () => Boolean(connection()?.roomCode && connection()?.pin);
  const shouldPrompt = () => {
    const current = connection();
    return !current?.roomCode || !current.pin || current.status === "error";
  };

  const setConnection = (value: Partial<GameScreenConnection>) => {
    updateGameScreenConnection(appContext, value);
  };

  const closeSocket = () => {
    manuallyClosed = true;
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    if (joinTimer) window.clearTimeout(joinTimer);
    reconnectTimer = undefined;
    joinTimer = undefined;
    socket?.close();
    socket = null;
  };

  const connect = () => {
    const current = connection();
    if (!current?.roomCode || !current.pin) return;

    closeSocket();
    manuallyClosed = false;
    joined = false;

    const endpointUrl = current.endpointUrl || gameWsUrl();
    const url = normalizeWsUrl(endpointUrl);
    url.searchParams.set("room", current.roomCode);
    url.searchParams.set("pin", current.pin);
    url.searchParams.set("role", "gamescreen");
    if (current.reconnectToken) {
      url.searchParams.set("reconnect_token", current.reconnectToken);
    }

    setConnection({
      endpointUrl,
      status: "connecting",
      error: null,
    });

    const nextSocket = new WebSocket(url);
    socket = nextSocket;
    joinTimer = window.setTimeout(() => {
      if (socket !== nextSocket || joined) return;
      setConnection({
        status: "error",
        error: "Failed to connect to the room.",
        reconnectToken: "",
      });
      closeSocket();
    }, JOIN_TIMEOUT_MS);
    nextSocket.addEventListener("message", (event) => {
      if (socket !== nextSocket) return;

      let message: { type?: string; room?: unknown; data?: { session?: { reconnectToken?: unknown }; room?: unknown; message?: string } };
      try {
        message = JSON.parse(event.data);
      } catch (error) {
        console.warn("Could not parse websocket message", error);
        return;
      }

      if (message.type === "room_state") {
        updateRoomState(appContext, parseRoomState(message.room ?? message.data?.room));
        return;
      }

      if (message.type === "error") {
        setConnection({
          status: joined ? connection()?.status ?? "connected" : "error",
          error: message.data?.message || "The server rejected the connection.",
          reconnectToken: joined ? connection()?.reconnectToken ?? "" : "",
        });
        if (!joined) closeSocket();
        return;
      }

      if (message.type !== "joined") return;

      joined = true;
      if (joinTimer) window.clearTimeout(joinTimer);
      joinTimer = undefined;
      const reconnectToken = message.data?.session?.reconnectToken;
      updateRoomState(appContext, parseRoomState(message.data?.room));
      setConnection({
        reconnectToken: typeof reconnectToken === "string" ? reconnectToken : current.reconnectToken,
        status: "connected",
        error: null,
      });
    });
    nextSocket.addEventListener("close", (event) => {
      if (socket !== nextSocket) return;

      socket = null;
      if (manuallyClosed) return;
      if (joinTimer) window.clearTimeout(joinTimer);
      joinTimer = undefined;

      if (!joined || event.code === 1008 || event.code === 1003 || event.code === 1013) {
        setConnection({
          status: "error",
          error: connectionFailureMessage(event),
          reconnectToken: "",
        });
        return;
      }

      setConnection({
        status: "disconnected",
        error: "Connection lost. Reconnecting...",
      });
      reconnectTimer = window.setTimeout(connect, 2000);
    });
    nextSocket.addEventListener("error", () => {
      if (socket !== nextSocket) return;
      if (joined) return;
      setConnection({
        status: "error",
        error: "Could not connect to the game server.",
      });
    });
  };

  createEffect(() => {
    if (!hasCredentials()) {
      closeSocket();
      return;
    }

    const current = connection();
    if (!current || current.status !== "disconnected") return;

    connect();
  });

  createEffect(() => {
    if (!appContext) return;
    const current = connection();
    setRoomCodeInput(current?.roomCode ?? "");
    setPinInput(current?.pin ?? "");
  });

  onCleanup(() => {
    closeSocket();
  });

  const handleLeaveRoom = () => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "leave_room" }));
    }
    closeSocket();
  };

  const handleGlobalStateUpdate = (event: Event) => {
    if (socket?.readyState !== WebSocket.OPEN) return;
    const detail = (event as CustomEvent<{ doom?: number; ward?: number }>).detail;
    if (!detail) return;
    socket.send(JSON.stringify({ type: "set_global_state", ...detail }));
  };

  onMount(() => {
    window.addEventListener("fifth-omen:leave-room", handleLeaveRoom);
    window.addEventListener(UPDATE_GLOBAL_STATE_EVENT, handleGlobalStateUpdate);
  });

  onCleanup(() => {
    window.removeEventListener("fifth-omen:leave-room", handleLeaveRoom);
    window.removeEventListener(UPDATE_GLOBAL_STATE_EVENT, handleGlobalStateUpdate);
  });

  const submitConnection = (event: SubmitEvent) => {
    event.preventDefault();
    const roomCode = roomCodeInput().trim().toUpperCase();
    const pin = pinInput().trim();
    const endpointUrl = gameWsUrl();

    setConnection({
      endpointUrl,
      roomCode,
      pin,
      reconnectToken: "",
      status: "disconnected",
      error: null,
    });
  };

  return (
    <Show when={shouldPrompt()}>
      <div class="fixed inset-0 z-40 grid place-items-center bg-black/80 p-6 backdrop-blur-sm">
        <form
          class="relative w-full max-w-sm border border-zinc-700 bg-zinc-950 p-5 shadow-2xl"
          onSubmit={submitConnection}
        >
          <button
            type="button"
            aria-label="Close join dialog"
            title="Close"
            class="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded bg-zinc-900 text-xl text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
            onClick={() => closeConnectionPrompt(appContext)}
          >
            <Icon icon="mdi:close" />
          </button>
          <p class="text-xs uppercase tracking-[0.18em] text-zinc-600">
            Game Screen
          </p>
          <h2 class="gothic-sub-heading mt-1 text-2xl text-zinc-100">
            Join Room
          </h2>
          <Show when={connection()?.error}>
            <p class="mt-3 border border-red-900 bg-red-950 p-3 text-sm text-red-100">
              {connection()?.error}
            </p>
          </Show>
          <label class="mt-4 block text-sm font-semibold text-zinc-300">
            Room Code
            <input
              class="mt-2 h-11 w-full rounded border border-zinc-700 bg-zinc-900 px-3 text-lg uppercase tracking-[0.18em] text-zinc-100"
              value={roomCodeInput()}
              maxlength={5}
              pattern="[A-Za-z0-9]{5}"
              required
              onInput={(event) => setRoomCodeInput(event.currentTarget.value.toUpperCase())}
            />
          </label>
          <label class="mt-4 block text-sm font-semibold text-zinc-300">
            PIN
            <input
              class="mt-2 h-11 w-full rounded border border-zinc-700 bg-zinc-900 px-3 text-lg tracking-[0.18em] text-zinc-100"
              value={pinInput()}
              inputmode="numeric"
              maxlength={6}
              pattern="[0-9]{6}"
              required
              onInput={(event) => setPinInput(event.currentTarget.value)}
            />
          </label>
          <Button
            type="submit"
            class="mt-5 min-h-12 w-full bg-zinc-100 uppercase tracking-[0.14em] text-zinc-950 hover:bg-zinc-300"
          >
            Connect
          </Button>
        </form>
      </div>
    </Show>
  );
};

const PlayerConnectionManager: Component = () => {
  const appContext = useContext(AppContext);
  const [roomCodeInput, setRoomCodeInput] = createSignal("");
  const [pinInput, setPinInput] = createSignal("");
  const [nameInput, setNameInput] = createSignal("");
  let socket: WebSocket | null = null;
  let reconnectTimer: number | undefined;
  let joinTimer: number | undefined;
  let joined = false;
  let manuallyClosed = false;

  const connection = () => appContext?.contextValue().playerConnection;
  const roomFromUrl = roomCodeFromUrl;
  const roomCode = () => connection()?.roomCode || roomFromUrl();
  const selectedClass = () => appContext?.contextValue().selectedPlaybook ?? connection()?.classId ?? null;
  const hasCredentials = () => Boolean(roomCode() && (connection()?.pin || connection()?.reconnectToken));
  const shouldPrompt = () => {
    const current = connection();
    return !roomCode() || (!current?.pin && !current?.reconnectToken) || current.status === "error";
  };

  const setConnection = (value: Partial<PlayerConnection>) => {
    updatePlayerConnection(appContext, value);
  };

  const closeSocket = () => {
    manuallyClosed = true;
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    if (joinTimer) window.clearTimeout(joinTimer);
    reconnectTimer = undefined;
    joinTimer = undefined;
    socket?.close();
    socket = null;
  };

  const connect = () => {
    const current = connection();
    const currentRoom = roomCode();
    if (!currentRoom || (!current?.pin && !current?.reconnectToken)) return;

    closeSocket();
    manuallyClosed = false;
    joined = false;

    const endpointUrl = current.endpointUrl || gameWsUrl();
    const url = normalizeWsUrl(endpointUrl);
    url.searchParams.set("room", currentRoom);
    if (current.pin) {
      url.searchParams.set("pin", current.pin);
    }
    url.searchParams.set("role", "player");
    const playerName = current.name.trim();
    if (playerName) {
      url.searchParams.set("name", playerName);
    }
    if (current.reconnectToken) {
      url.searchParams.set("reconnect_token", current.reconnectToken);
    }
    if (current.seat !== null) {
      url.searchParams.set("seat", String(current.seat));
    }

    setConnection({
      endpointUrl,
      roomCode: currentRoom,
      status: "connecting",
      error: null,
    });

    const nextSocket = new WebSocket(url);
    socket = nextSocket;
    joinTimer = window.setTimeout(() => {
      if (socket !== nextSocket || joined) return;
      setConnection({
        status: "error",
        error: "Failed to connect to the room.",
      });
      closeSocket();
    }, JOIN_TIMEOUT_MS);
    nextSocket.addEventListener("message", (event) => {
      if (socket !== nextSocket) return;

      let message: { type?: string; room?: unknown; data?: any };
      try {
        message = JSON.parse(event.data);
      } catch (error) {
        console.warn("Could not parse websocket message", error);
        return;
      }

      if (message.type === "room_state") {
        updateRoomState(appContext, parseRoomState(message.room ?? message.data?.room));
        return;
      }
      if (message.type === "seat_selected") {
        const seat = typeof message.data?.seat === "number" ? message.data.seat : null;
        const reconnectToken = typeof message.data?.reconnectToken === "string"
          ? message.data.reconnectToken
          : connection()?.reconnectToken ?? "";
        const room = parseRoomState(message.data?.room);
        updateRoomState(appContext, room);
        const slot = seat !== null ? room?.players.find((player) => player.seat === seat) : null;
        const classId = typeof slot?.classId === "number" ? slot.classId : null;
        if (classId !== null && appContext) {
          const playbook = playbooks[classId];
          appContext.setContextValue({
            ...appContext.contextValue(),
            selectedPlaybook: classId,
            playerHealth: playbook?.health ?? appContext.contextValue().playerHealth,
            playerConnection: {
              ...appContext.contextValue().playerConnection,
              reconnectToken,
              seat,
              classId,
              error: null,
            },
          });
        } else {
          setConnection({ reconnectToken, seat, classId: null, error: null });
        }
        return;
      }
      if (message.type === "class_selected") {
        const classId = typeof message.data?.classId === "number" ? message.data.classId : selectedClass();
        updateRoomState(appContext, parseRoomState(message.data?.room));
        setConnection({ classId, error: null });
        return;
      }
      if (message.type === "error") {
        const code = message.data?.code;
        if (code === "seat_occupied" || code === "invalid_seat") {
          setConnection({
            seat: null,
            error: message.data?.message || "That seat is not available.",
          });
          return;
        }
        if (code === "class_taken" || code === "invalid_class") {
          setConnection({
            error: message.data?.message || "That class is not available.",
          });
          return;
        }
        setConnection({
          status: "error",
          error: message.data?.message || "The server rejected the connection.",
        });
        if (!joined) closeSocket();
        return;
      }
      if (message.type !== "joined") return;

      joined = true;
      if (joinTimer) window.clearTimeout(joinTimer);
      joinTimer = undefined;
      const room = parseRoomState(message.data?.room);
      updateRoomState(appContext, room);
      const session = message.data?.session;
      const seat = typeof session?.seat === "number" ? session.seat : null;
      const classId = typeof session?.classId === "number" ? session.classId : null;
      const reconnectToken = typeof session?.reconnectToken === "string" ? session.reconnectToken : current.reconnectToken;
      if (classId !== null && appContext) {
        const playbook = playbooks[classId];
        appContext.setContextValue({
          ...appContext.contextValue(),
          selectedPlaybook: classId,
          playerHealth: playbook?.health ?? appContext.contextValue().playerHealth,
          playerConnection: {
            ...appContext.contextValue().playerConnection,
            reconnectToken,
            seat,
            classId,
            status: "connected",
            error: null,
          },
        });
        return;
      }
      setConnection({
        reconnectToken,
        seat,
        classId,
        status: "connected",
        error: null,
      });
    });
    nextSocket.addEventListener("close", (event) => {
      if (socket !== nextSocket) return;

      socket = null;
      if (manuallyClosed) return;
      if (joinTimer) window.clearTimeout(joinTimer);
      joinTimer = undefined;

      if (!joined || event.code === 1008 || event.code === 1003 || event.code === 1013) {
        setConnection({
          status: "error",
          error: connectionFailureMessage(event),
          pin: "",
        });
        return;
      }

      setConnection({
        status: "disconnected",
        error: "Connection lost. Reconnecting...",
      });
      reconnectTimer = window.setTimeout(connect, 2000);
    });
    nextSocket.addEventListener("error", () => {
      if (socket !== nextSocket) return;
      if (joined) return;
      setConnection({
        status: "error",
        error: "Could not connect to the game server.",
      });
    });
  };

  createEffect(() => {
    const currentRoom = roomFromUrl();
    if (!appContext || !currentRoom || appContext.contextValue().playerConnection.roomCode) return;
    updatePlayerConnection(appContext, { roomCode: currentRoom, endpointUrl: gameWsUrl() });
  });

  createEffect(() => {
    if (!hasCredentials()) {
      closeSocket();
      return;
    }

    const current = connection();
    if (!current || current.status !== "disconnected") return;
    connect();
  });

  createEffect(() => {
    const current = connection();
    setRoomCodeInput(roomCode());
    setPinInput(current?.pin ?? "");
    setNameInput(current?.name ?? "");
  });

  const handleClassSelect = (event: Event) => {
    const classId = (event as CustomEvent<{ classId: number }>).detail?.classId;
    if (typeof classId !== "number") return;
    setConnection({ classId });
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "select_class", classId }));
    }
  };

  const handleSeatSelect = (event: Event) => {
    const seat = (event as CustomEvent<{ seat: number }>).detail?.seat;
    if (typeof seat !== "number") return;
    setConnection({ seat });
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "select_seat", seat }));
    }
  };

  onMount(() => {
    window.addEventListener("fifth-omen:select-class", handleClassSelect);
    window.addEventListener("fifth-omen:select-seat", handleSeatSelect);
  });

  onCleanup(() => {
    window.removeEventListener("fifth-omen:select-class", handleClassSelect);
    window.removeEventListener("fifth-omen:select-seat", handleSeatSelect);
    closeSocket();
  });

  const handleLeaveRoom = () => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "leave_room" }));
    }
    closeSocket();
  };

  onMount(() => {
    window.addEventListener("fifth-omen:leave-room", handleLeaveRoom);
  });

  onCleanup(() => {
    window.removeEventListener("fifth-omen:leave-room", handleLeaveRoom);
  });

  const submitConnection = (event: SubmitEvent) => {
    event.preventDefault();
    const currentRoom = (roomCodeInput() || roomCode()).trim().toUpperCase();
    const pin = pinInput().trim();
    const name = nameInput().trim();
    const endpointUrl = gameWsUrl();

    setConnection({
      endpointUrl,
      roomCode: currentRoom,
      pin,
      name,
      reconnectToken: "",
      seat: null,
      classId: selectedClass(),
      status: "disconnected",
      error: null,
    });
  };

  return (
    <Show when={shouldPrompt()}>
      <div class="fixed inset-0 z-40 grid place-items-center bg-black/80 p-6 backdrop-blur-sm">
        <form
          class="relative w-full max-w-sm border border-zinc-700 bg-zinc-950 p-5 shadow-2xl"
          onSubmit={submitConnection}
        >
          <button
            type="button"
            aria-label="Close join dialog"
            title="Close"
            class="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded bg-zinc-900 text-xl text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
            onClick={() => closeConnectionPrompt(appContext)}
          >
            <Icon icon="mdi:close" />
          </button>
          <p class="text-xs uppercase tracking-[0.18em] text-zinc-600">
            Player Device
          </p>
          <h2 class="gothic-sub-heading mt-1 text-2xl text-zinc-100">
            Join Room
          </h2>
          <Show when={connection()?.error}>
            <p class="mt-3 border border-red-900 bg-red-950 p-3 text-sm text-red-100">
              {connection()?.error}
            </p>
          </Show>
          <label class="mt-4 block text-sm font-semibold text-zinc-300">
            Name
            <input
              class="mt-2 h-11 w-full rounded border border-zinc-700 bg-zinc-900 px-3 text-zinc-100"
              value={nameInput()}
              maxlength={40}
              autocomplete="name"
              onInput={(event) => {
                const name = event.currentTarget.value;
                setNameInput(name);
                setConnection({ name });
              }}
            />
          </label>
          <label class="mt-4 block text-sm font-semibold text-zinc-300">
            Room Code
            <input
              class="mt-2 h-11 w-full rounded border border-zinc-700 bg-zinc-900 px-3 text-lg uppercase tracking-[0.18em] text-zinc-100"
              value={roomCodeInput()}
              maxlength={5}
              pattern="[A-Za-z0-9]{5}"
              required
              onInput={(event) => setRoomCodeInput(event.currentTarget.value.toUpperCase())}
            />
          </label>
          <label class="mt-4 block text-sm font-semibold text-zinc-300">
            PIN
            <input
              class="mt-2 h-11 w-full rounded border border-zinc-700 bg-zinc-900 px-3 text-lg tracking-[0.18em] text-zinc-100"
              value={pinInput()}
              inputmode="numeric"
              maxlength={6}
              pattern="[0-9]{6}"
              required
              autofocus
              onInput={(event) => setPinInput(event.currentTarget.value)}
            />
          </label>
          <Button
            type="submit"
            class="mt-5 min-h-12 w-full bg-zinc-100 uppercase tracking-[0.14em] text-zinc-950 hover:bg-zinc-300"
          >
            Connect
          </Button>
        </form>
      </div>
    </Show>
  );
};

const FullscreenButton: Component = () => {
  const [isFullscreen, setIsFullscreen] = createSignal(false);

  const fullscreenElement = () => {
    const fullscreenDocument = document as FullscreenDocument;
    return document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement ?? null;
  };

  const updateFullscreenState = () => {
    setIsFullscreen(fullscreenElement() !== null);
  };

  onMount(() => {
    updateFullscreenState();
    document.addEventListener("fullscreenchange", updateFullscreenState);
    document.addEventListener("webkitfullscreenchange", updateFullscreenState);
  });

  onCleanup(() => {
    document.removeEventListener("fullscreenchange", updateFullscreenState);
    document.removeEventListener("webkitfullscreenchange", updateFullscreenState);
  });

  const toggleFullscreen = async () => {
    const fullscreenDocument = document as FullscreenDocument;

    try {
      if (fullscreenElement()) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          return;
        }
        await fullscreenDocument.webkitExitFullscreen?.();
        return;
      }

      const target = document.documentElement as FullscreenElement;
      if (target.requestFullscreen) {
        await target.requestFullscreen();
        return;
      }
      if (target.webkitRequestFullscreen) {
        await target.webkitRequestFullscreen();
        return;
      }
      if (target.webkitRequestFullScreen) {
        await target.webkitRequestFullScreen();
        return;
      }

      window.alert("Fullscreen is not available in this browser.");
    } catch (error) {
      console.warn("Fullscreen request failed", error);
      window.alert("Fullscreen could not be started from this browser.");
    }
  };

  return (
    <button
      type="button"
      aria-label={isFullscreen() ? "Exit fullscreen" : "Enter fullscreen"}
      title={isFullscreen() ? "Exit fullscreen" : "Enter fullscreen"}
      onClick={toggleFullscreen}
      class="flex h-10 w-10 items-center justify-center rounded bg-zinc-800 text-2xl text-white transition-colors hover:bg-zinc-700"
    >
      <Icon icon={isFullscreen() ? "mdi:fullscreen-exit" : "mdi:fullscreen"} />
    </button>
  );
};

const QrShareButton: Component = () => {
  const appContext = useContext(AppContext);
  const [isOpen, setIsOpen] = createSignal(false);
  const [qrSvg, setQrSvg] = createSignal("");
  const shareUrl = () => {
    const url = new URL(SHARE_URL);
    const room = appContext?.contextValue().gameScreenConnection.roomCode || appContext?.contextValue().roomState?.code;
    if (appContext?.contextValue().deviceMode === "gamesheet" && room) {
      url.searchParams.set("room", room);
    }
    return url.toString();
  };

  createEffect(() => {
    if (!isOpen()) return;

    QRCode.toString(shareUrl(), {
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
      margin: 2,
      type: "svg",
      width: 320,
    }).then(setQrSvg).catch((error) => {
      console.warn("QR code generation failed", error);
    });
  });

  return (
    <>
      <button
        type="button"
        aria-label="Show app QR code"
        title="Show app QR code"
        onClick={() => setIsOpen(true)}
        class="flex h-10 w-10 items-center justify-center rounded bg-zinc-800 text-2xl text-white transition-colors hover:bg-zinc-700"
      >
        <Icon icon="mdi:qrcode" />
      </button>

      <Show when={isOpen()}>
        <div
          class="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div
            class="w-full max-w-sm border border-zinc-700 bg-zinc-950 p-5 text-center shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p class="text-xs uppercase tracking-[0.18em] text-zinc-600">
              Join Game
            </p>
            <div
              role="img"
              aria-label={`QR code for ${shareUrl()}`}
              innerHTML={qrSvg()}
              class="mx-auto mt-4 grid h-72 w-72 place-items-center bg-white p-3 text-zinc-950 [&_svg]:h-full [&_svg]:w-full"
            />
            <a
              href={shareUrl()}
              class="mt-4 block break-all text-sm text-zinc-400 underline"
            >
              {shareUrl()}
            </a>
            <Button
              class="mt-5 min-h-12 w-full bg-zinc-800 uppercase tracking-[0.14em] hover:bg-zinc-700"
              onClick={() => setIsOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </Show>
    </>
  );
};

const ConnectionStatusButton: Component = () => {
  const appContext = useContext(AppContext);
  const connection = () => {
    const mode = appContext?.contextValue().deviceMode;
    if (mode === "player") return appContext?.contextValue().playerConnection;
    if (mode === "gamesheet") return appContext?.contextValue().gameScreenConnection;
    return null;
  };
  const status = () => connection()?.status ?? "idle";
  const hasStatus = () => appContext?.contextValue().deviceMode === "gamesheet" || appContext?.contextValue().deviceMode === "player";

  const icon = () => {
    switch (status()) {
      case "connected":
        return "mdi:wifi";
      case "connecting":
        return "mdi:wifi-sync";
      case "error":
        return "mdi:wifi-alert";
      case "disconnected":
        return "mdi:wifi-off";
      default:
        return "mdi:wifi-strength-outline";
    }
  };

  const title = () => {
    const room = connection()?.roomCode;
    const suffix = room ? ` (${room})` : "";
    switch (status()) {
      case "connected":
        return `Connected${suffix}`;
      case "connecting":
        return `Connecting${suffix}`;
      case "error":
        return connection()?.error || "Connection error";
      case "disconnected":
        return `Disconnected${suffix}`;
      default:
        return "Not connected";
    }
  };

  const tone = () => {
    switch (status()) {
      case "connected":
        return "bg-emerald-800 hover:bg-emerald-700";
      case "connecting":
        return "bg-amber-700 hover:bg-amber-600";
      case "error":
      case "disconnected":
        return "bg-red-900 hover:bg-red-800";
      default:
        return "bg-zinc-800 hover:bg-zinc-700";
    }
  };

  const reconnect = () => {
    if (!appContext || !hasStatus()) return;
    const mode = appContext.contextValue().deviceMode;
    if (mode === "gamesheet") {
      appContext.setContextValue({
        ...appContext.contextValue(),
        gameScreenConnection: {
          ...appContext.contextValue().gameScreenConnection,
          status: "disconnected",
          error: null,
        },
      });
      return;
    }
    if (mode === "player") {
      appContext.setContextValue({
        ...appContext.contextValue(),
        playerConnection: {
          ...appContext.contextValue().playerConnection,
          status: "disconnected",
          error: null,
        },
      });
    }
  };

  return (
    <Show when={hasStatus()}>
      <button
        type="button"
        aria-label={title()}
        title={title()}
        onClick={reconnect}
        class={`flex h-10 w-10 items-center justify-center rounded text-2xl text-white transition-colors ${tone()}`}
      >
        <Icon icon={icon()} />
      </button>
    </Show>
  );
};

const HeaderControls: Component = () => {
  const appContext = useContext(AppContext);
  const [confirmingLeave, setConfirmingLeave] = createSignal(false);
  const deviceMode = () => appContext?.contextValue().deviceMode;
  const roomCode = () => (
    deviceMode() === "player"
      ? appContext?.contextValue().playerConnection.roomCode
      : appContext?.contextValue().gameScreenConnection.roomCode
  );

  return (
    <>
      <Switch>
        <Match when={deviceMode() !== null}>
          <div class="flex gap-2">
            <Show when={roomCode()}>
              <Button
                class="min-h-10 bg-zinc-800 px-3 text-xs uppercase tracking-[0.14em] hover:bg-zinc-700 disabled:hover:bg-zinc-800"
                onClick={() => setConfirmingLeave(true)}
              >
                Leave
              </Button>
            </Show>
          </div>
        </Match>
      </Switch>

      <Show when={confirmingLeave()}>
        <ConfirmDialog
          eyebrow="Room"
          title="Leave Room?"
          message="This device will disconnect and release its room claim."
          confirmLabel="Leave"
          destructive
          onCancel={() => setConfirmingLeave(false)}
          onConfirm={() => {
            leaveRoom(appContext);
            setConfirmingLeave(false);
          }}
        />
      </Show>
    </>
  );
};

const App: Component = () => {
  return (
    <div class="flex h-screen flex-col items-stretch justify-between bg-zinc-900">
      <AppContextProvider>
        <DeviceBootstrap />
        <PreventAccidentalRefresh />
        <div class="grid grid-cols-[auto_1fr_auto] items-center gap-2 border-b-1 border-b-white p-2">
          <div class="min-w-0">
            <HeaderControls />
          </div>
          <a href="/" class="block min-w-0 truncate text-center gothic-heading text-3xl text-white sm:text-4xl md:text-5xl">Fifth Omen</a>
          <div class="flex gap-2">
            <ConnectionStatusButton />
            <QrShareButton />
            <FullscreenButton />
          </div>
        </div>
        <div class="text-white grow flex overflow-auto items-stretch flex-col">
          <AppInner />
        </div>
      </AppContextProvider>
    </div >
  );
};

export default App;
