import { Match, Show, Switch, createEffect, createSignal, onCleanup, onMount, useContext, type Component } from "solid-js";
import { Icon } from "@iconify-icon/solid";
import QRCode from "qrcode";
import { AppContext } from "../data/app";
import { useNetwork } from "../data/network";
import { Button, ConfirmDialog } from "./ui";

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  webkitRequestFullScreen?: () => Promise<void> | void;
};
const SHARE_URL = "https://fifth-omen.lab-2.paleglyph.com/";

export const FullscreenButton: Component = () => {
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

export const QrShareButton: Component = () => {
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

export const ConnectionStatusButton: Component = () => {
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

export const HeaderControls: Component = () => {
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
      <Show when={deviceMode() !== null && roomCode()}>
        <Button
          class="min-h-10 bg-zinc-800 px-3 text-xs uppercase tracking-[0.14em] hover:bg-zinc-700 disabled:hover:bg-zinc-800"
          onClick={() => setConfirmingLeave(true)}
        >
          Leave
        </Button>
      </Show>
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
