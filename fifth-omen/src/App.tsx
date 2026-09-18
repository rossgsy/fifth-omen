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

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  webkitRequestFullScreen?: () => Promise<void> | void;
};

const SHARE_URL = "https://fifth-omen.lab-2.paleglyph.com/";

const roomCodeFromUrl = () => new URLSearchParams(window.location.search).get("room")?.trim().toUpperCase() ?? "";

const clearRoomFromUrl = () => {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("room")) return;
  url.searchParams.delete("room");
  window.history.replaceState({}, "", url);
};

const DeviceMenu: Component = () => {
  const appContext = useContext(AppContext);

  return <div class="flex flex-col min-h-100 grow p-4 justify-center gap-3">
    <ActionCard
      eyebrow="Personal"
      title="Player Sheet"
      onClick={() => appContext?.setDeviceMode("player")}
    />
    <ActionCard
      eyebrow="Shared"
      title="Game Sheet"
      onClick={() => appContext?.setDeviceMode("gamesheet")}
    />
  </div>
};

const DeviceBootstrap: Component = () => {
  const appContext = useContext(AppContext);

  onMount(() => {
    const room = roomCodeFromUrl();
    if (!appContext || !room || appContext.contextValue().deviceMode) return;
    appContext.setContextValue({
      ...appContext.contextValue(),
      deviceMode: "player",
      playerConnection: {
        ...appContext.contextValue().playerConnection,
        roomCode: room,
        endpointUrl: appContext.contextValue().playerConnection.endpointUrl || gameWsUrl(),
      },
    });
  });

  return null;
};

const AppInner: Component = () => {
  const appContext = useContext(AppContext);

  return <Switch fallback={<DeviceMenu />}>
    <Match when={appContext?.contextValue().deviceMode === "player"}>
      <PlayerConnectionManager />
      <Router>
        <Route path="/" component={PlaybookRoute} />
      </Router>
    </Match>
    <Match when={appContext?.contextValue().deviceMode === "gamesheet"}>
      <GameScreenConnectionManager />
      <Router>
        <Route path="/" component={GameSheetRoute} />
      </Router>
    </Match>
  </Switch>
};

const updateRoomState = (appContext: AppContextStore | undefined, roomState: RoomState | null) => {
  if (!appContext) return;
  appContext.setContextValue({
    ...appContext.contextValue(),
    roomState,
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
  clearRoomFromUrl();
  appContext.setContextValue({
    ...appContext.contextValue(),
    roomState: null,
    gameScreenConnection: {
      endpointUrl: appContext.contextValue().gameScreenConnection.endpointUrl,
      roomCode: "",
      pin: "",
      reconnectToken: "",
      status: "idle",
      error: null,
    },
    playerConnection: {
      endpointUrl: appContext.contextValue().playerConnection.endpointUrl,
      roomCode: "",
      pin: "",
      classId: appContext.contextValue().selectedPlaybook,
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

const GameScreenConnectionManager: Component = () => {
  const appContext = useContext(AppContext);
  const [roomCodeInput, setRoomCodeInput] = createSignal("");
  const [pinInput, setPinInput] = createSignal("");
  const [endpointInput, setEndpointInput] = createSignal("");
  let socket: WebSocket | null = null;
  let reconnectTimer: number | undefined;
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
    reconnectTimer = undefined;
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
    nextSocket.addEventListener("message", (event) => {
      if (socket !== nextSocket) return;

      let message: { type?: string; room?: unknown; data?: { session?: { reconnectToken?: unknown }; room?: unknown } };
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

      if (message.type !== "joined") return;

      joined = true;
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

      if (!joined || event.code === 1008 || event.code === 1003 || event.code === 1013) {
        setConnection({
          status: "error",
          error: event.reason || "Could not join the room.",
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
    if (!current || current.status === "connected" || current.status === "connecting") return;

    connect();
  });

  createEffect(() => {
    if (!appContext) return;
    const current = connection();
    setRoomCodeInput(current?.roomCode ?? "");
    setPinInput(current?.pin ?? "");
    setEndpointInput(current?.endpointUrl || gameWsUrl());
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

  onMount(() => {
    window.addEventListener("fifth-omen:leave-room", handleLeaveRoom);
  });

  onCleanup(() => {
    window.removeEventListener("fifth-omen:leave-room", handleLeaveRoom);
  });

  const submitConnection = (event: SubmitEvent) => {
    event.preventDefault();
    const roomCode = roomCodeInput().trim().toUpperCase();
    const pin = pinInput().trim();
    const endpointUrl = endpointInput().trim() || gameWsUrl();

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
          class="w-full max-w-sm border border-zinc-700 bg-zinc-950 p-5 shadow-2xl"
          onSubmit={submitConnection}
        >
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
          <label class="mt-4 block text-sm font-semibold text-zinc-300">
            Server
            <input
              class="mt-2 h-11 w-full rounded border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
              value={endpointInput()}
              required
              onInput={(event) => setEndpointInput(event.currentTarget.value)}
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
  const [pinInput, setPinInput] = createSignal("");
  const [endpointInput, setEndpointInput] = createSignal("");
  let socket: WebSocket | null = null;
  let reconnectTimer: number | undefined;
  let joined = false;
  let manuallyClosed = false;

  const connection = () => appContext?.contextValue().playerConnection;
  const roomFromUrl = roomCodeFromUrl;
  const roomCode = () => connection()?.roomCode || roomFromUrl();
  const selectedClass = () => appContext?.contextValue().selectedPlaybook ?? connection()?.classId ?? null;
  const hasCredentials = () => Boolean(roomCode() && connection()?.pin);
  const shouldPrompt = () => {
    const current = connection();
    return Boolean(roomCode()) && (!current?.pin || current.status === "error");
  };

  const setConnection = (value: Partial<PlayerConnection>) => {
    updatePlayerConnection(appContext, value);
  };

  const closeSocket = () => {
    manuallyClosed = true;
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
    socket?.close();
    socket = null;
  };

  const connect = () => {
    const current = connection();
    const currentRoom = roomCode();
    if (!currentRoom || !current?.pin) return;

    closeSocket();
    manuallyClosed = false;
    joined = false;

    const endpointUrl = current.endpointUrl || gameWsUrl();
    const url = normalizeWsUrl(endpointUrl);
    url.searchParams.set("room", currentRoom);
    url.searchParams.set("pin", current.pin);
    url.searchParams.set("role", "player");
    const classID = selectedClass();
    if (classID !== null) {
      url.searchParams.set("class", String(classID));
    }

    setConnection({
      endpointUrl,
      roomCode: currentRoom,
      classId: classID,
      status: "connecting",
      error: null,
    });

    const nextSocket = new WebSocket(url);
    socket = nextSocket;
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
      if (message.type === "class_selected") {
        const classId = typeof message.data?.classId === "number" ? message.data.classId : selectedClass();
        updateRoomState(appContext, parseRoomState(message.data?.room));
        setConnection({ classId, error: null });
        return;
      }
      if (message.type === "error") {
        const code = message.data?.code;
        if (code === "class_taken" || code === "invalid_class") {
          setConnection({
            error: message.data?.message || "That class is not available.",
          });
          return;
        }
        setConnection({
          status: "error",
          error: message.data?.message || "The server rejected that request.",
        });
        return;
      }
      if (message.type !== "joined") return;

      joined = true;
      updateRoomState(appContext, parseRoomState(message.data?.room));
      setConnection({
        status: "connected",
        error: null,
      });
    });
    nextSocket.addEventListener("close", (event) => {
      if (socket !== nextSocket) return;

      socket = null;
      if (manuallyClosed) return;

      if (!joined || event.code === 1008 || event.code === 1003 || event.code === 1013) {
        setConnection({
          status: "error",
          error: event.reason || "Could not join the room.",
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
    if (!current || current.status === "connected" || current.status === "connecting") return;
    connect();
  });

  createEffect(() => {
    const current = connection();
    setPinInput(current?.pin ?? "");
    setEndpointInput(current?.endpointUrl || gameWsUrl());
  });

  const handleClassSelect = (event: Event) => {
    const classId = (event as CustomEvent<{ classId: number }>).detail?.classId;
    if (typeof classId !== "number") return;
    setConnection({ classId });
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "select_class", classId }));
    }
  };

  onMount(() => {
    window.addEventListener("fifth-omen:select-class", handleClassSelect);
  });

  onCleanup(() => {
    window.removeEventListener("fifth-omen:select-class", handleClassSelect);
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
    const currentRoom = roomCode().trim().toUpperCase();
    const pin = pinInput().trim();
    const endpointUrl = endpointInput().trim() || gameWsUrl();

    setConnection({
      endpointUrl,
      roomCode: currentRoom,
      pin,
      classId: selectedClass(),
      status: "disconnected",
      error: null,
    });
  };

  return (
    <Show when={shouldPrompt()}>
      <div class="fixed inset-0 z-40 grid place-items-center bg-black/80 p-6 backdrop-blur-sm">
        <form
          class="w-full max-w-sm border border-zinc-700 bg-zinc-950 p-5 shadow-2xl"
          onSubmit={submitConnection}
        >
          <p class="text-xs uppercase tracking-[0.18em] text-zinc-600">
            Player Device
          </p>
          <h2 class="gothic-sub-heading mt-1 text-2xl text-zinc-100">
            Join {roomCode()}
          </h2>
          <Show when={connection()?.error}>
            <p class="mt-3 border border-red-900 bg-red-950 p-3 text-sm text-red-100">
              {connection()?.error}
            </p>
          </Show>
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
          <label class="mt-4 block text-sm font-semibold text-zinc-300">
            Server
            <input
              class="mt-2 h-11 w-full rounded border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
              value={endpointInput()}
              required
              onInput={(event) => setEndpointInput(event.currentTarget.value)}
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
  const [pendingAction, setPendingAction] = createSignal<"reset" | "device" | "leave" | null>(null);
  const deviceMode = () => appContext?.contextValue().deviceMode;
  const roomCode = () => (
    deviceMode() === "player"
      ? appContext?.contextValue().playerConnection.roomCode
      : appContext?.contextValue().gameScreenConnection.roomCode
  );

  const resetDevice = () => {
    if (!appContext) return;

    if (deviceMode() === "player") {
      appContext.setContextValue({
        ...appContext.contextValue(),
        selectedPlaybook: null,
        playerHealth: 0,
        playerProgressionChoices: [null, null, null],
      });
      return;
    }

    if (deviceMode() === "gamesheet") {
      appContext.setContextValue({
        ...appContext.contextValue(),
        entityPresence: 0,
        entityResource: 0,
        globalDoom: 0,
        activeArcanaCards: [null, null],
        activeEntityCard: null,
        activeEntity: null,
        drawnTarotCards: [null, null, null, null, null],
        currentPhase: 0,
      });
    }
  };

  const changeDeviceType = () => {
    if (!appContext) return;

    appContext.setDeviceMode(null);
  };

  const confirmPendingAction = () => {
    if (pendingAction() === "reset") resetDevice();
    if (pendingAction() === "device") changeDeviceType();
    if (pendingAction() === "leave") leaveRoom(appContext);
    setPendingAction(null);
  };

  const resetMessage = () => (
    deviceMode() === "player"
      ? "The selected playbook, health, and progression choices will be cleared."
      : "Drawn cards, Presence, resources, Doom, and active arcana will be cleared."
  );

  return (
    <>
      <Switch>
        <Match when={deviceMode() !== null}>
          <div class="flex gap-2">
            <Button
              class="min-h-10 bg-red-900 px-3 text-xs uppercase tracking-[0.14em] hover:bg-red-800 disabled:hover:bg-red-900"
              onClick={() => setPendingAction("reset")}
            >
              Reset
            </Button>
            <Button
              class="min-h-10 bg-zinc-800 px-3 text-xs uppercase tracking-[0.14em] hover:bg-zinc-700 disabled:hover:bg-zinc-800"
              onClick={() => setPendingAction("device")}
            >
              Device
            </Button>
            <Show when={roomCode()}>
              <Button
                class="min-h-10 bg-zinc-800 px-3 text-xs uppercase tracking-[0.14em] hover:bg-zinc-700 disabled:hover:bg-zinc-800"
                onClick={() => setPendingAction("leave")}
              >
                Leave
              </Button>
            </Show>
          </div>
        </Match>
      </Switch>

      <Show when={pendingAction() === "reset"}>
        <ConfirmDialog
          eyebrow="Reset Sheet"
          title={deviceMode() === "player" ? "Reset Player Sheet?" : "Reset Game Sheet?"}
          message={resetMessage()}
          confirmLabel="Reset"
          destructive
          onCancel={() => setPendingAction(null)}
          onConfirm={confirmPendingAction}
        />
      </Show>

      <Show when={pendingAction() === "device"}>
        <ConfirmDialog
          eyebrow="Device"
          title="Return to Device Selection?"
          message="Current sheet values will be kept."
          confirmLabel="Continue"
          onCancel={() => setPendingAction(null)}
          onConfirm={confirmPendingAction}
        />
      </Show>

      <Show when={pendingAction() === "leave"}>
        <ConfirmDialog
          eyebrow="Room"
          title="Leave Room?"
          message="This device will disconnect and release its room claim."
          confirmLabel="Leave"
          destructive
          onCancel={() => setPendingAction(null)}
          onConfirm={confirmPendingAction}
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
