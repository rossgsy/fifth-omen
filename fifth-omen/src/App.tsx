import { Match, Show, Switch, createEffect, createSignal, onCleanup, onMount, useContext, type Component } from 'solid-js';
import AppContextProvider, { AppContext } from './data/app';
import type { AppContextStore } from './data/app';
import { Route, Router } from "@solidjs/router";
import PlaybookRoute from './routes/Playbook';
import GameSheetRoute from './routes/GameSheet';
import { ActionCard, Button, ConfirmDialog } from './components/ui';
import { Icon } from '@iconify-icon/solid';
import QRCode from 'qrcode';
import { gameWsUrl } from './config/server';
import { NetworkProvider, useNetwork } from './data/network';
import { GameScreenConnectionPrompt, PlayerConnectionPrompt } from './components/ConnectionPrompt';

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

const clearedPlayerState = (value: ReturnType<AppContextStore["contextValue"]>) => ({
  ...value,
  selectedPlaybook: null,
  playerHealth: 0,
  playerProgressionChoices: [null, null, null] as Array<"left" | "right" | null>,
});

const DeviceMenu: Component = () => {
  const appContext = useContext(AppContext);
  const canRejoinPlayer = () => Boolean(
    appContext?.contextValue().playerConnection.roomCode &&
    appContext?.contextValue().playerConnection.reconnectToken
  );
  const canRejoinGameScreen = () => Boolean(
    appContext?.contextValue().gameScreenConnection.roomCode &&
    appContext?.contextValue().gameScreenConnection.reconnectToken
  );
  const playerRejoinLabel = () => {
    const connection = appContext?.contextValue().playerConnection;
    const name = connection?.name?.trim() || "Player";
    const seat = typeof connection?.seat === "number" ? `Seat ${connection.seat + 1}` : "Choose a seat";
    return `${name} / ${seat}`;
  };
  const gameScreenRejoinLabel = () => {
    const roomCode = appContext?.contextValue().gameScreenConnection.roomCode || "Last room";
    return `Game Screen / ${roomCode}`;
  };

  const rejoinPlayer = () => {
    if (!appContext || !canRejoinPlayer()) return;
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

  const rejoinGameScreen = () => {
    if (!appContext || !canRejoinGameScreen()) return;
    const current = appContext.contextValue();
    appContext.setContextValue({
      ...current,
      roomState: null,
      deviceMode: "gamesheet",
      gameScreenConnection: {
        ...current.gameScreenConnection,
        endpointUrl: current.gameScreenConnection.endpointUrl || gameWsUrl(),
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
    <Show when={canRejoinPlayer()}>
      <ActionCard
        eyebrow="Last Player"
        title="Rejoin Player"
        onClick={rejoinPlayer}
      >
        <p class="mt-2 text-sm uppercase tracking-[0.18em] text-zinc-600">
          {playerRejoinLabel()}
        </p>
      </ActionCard>
    </Show>
    <Show when={canRejoinGameScreen()}>
      <ActionCard
        eyebrow="Last Screen"
        title="Rejoin Game Screen"
        onClick={rejoinGameScreen}
      >
        <p class="mt-2 text-sm uppercase tracking-[0.18em] text-zinc-600">
          {gameScreenRejoinLabel()}
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
      <PlayerConnectionPrompt />
      <Show when={playerConnected()}>
        <Router>
          <Route path="/" component={PlaybookRoute} />
        </Router>
      </Show>
    </Match>
    <Match when={appContext?.contextValue().deviceMode === "gamesheet"}>
      <GameScreenConnectionPrompt />
      <Show when={gameScreenConnected()}>
        <Router>
          <Route path="/" component={GameSheetRoute} />
        </Router>
      </Show>
    </Match>
  </Switch>;
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
  const network = useNetwork();
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
            network?.leaveRoom();
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
        <NetworkProvider>
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
        </NetworkProvider>
      </AppContextProvider>
    </div >
  );
};

export default App;
