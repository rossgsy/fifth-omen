import { Show, onCleanup, onMount, useContext, type Component } from "solid-js";
import { ActionCard } from "./ui";
import { AppContext } from "../data/app";
import type { AppContextStore } from "../data/app";
import { gameWsUrl } from "../config/server";

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

export const DeviceMenu: Component = () => {
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

export const DeviceBootstrap: Component = () => {
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

export const PreventAccidentalRefresh: Component = () => {
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
