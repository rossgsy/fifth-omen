import { Match, Show, Switch, createEffect, createSignal, onCleanup, onMount, useContext, type Component } from 'solid-js';
import AppContextProvider, { AppContext } from './data/app';
import { Route, Router } from "@solidjs/router";
import PlaybookRoute from './routes/Playbook';
import TarotRoute from './routes/Tarot';
import TarotCardRoute from './routes/TarotCard';
import HomeRoute from './routes/Home';
import GrimoireEntryRoute from './routes/GrimoireEntry';
import TarotSlotsRoute from './routes/TarotSlots';
import GameSheetRoute from './routes/GameSheet';
import { ActionCard, Button, IconButton } from './components/ui';
import { Icon } from '@iconify-icon/solid';
import QRCode from 'qrcode';

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  webkitRequestFullScreen?: () => Promise<void> | void;
};

const SHARE_URL = "https://fifth-omen.lab-2.paleglyph.com/";

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

const AppInner: Component = () => {
  const appContext = useContext(AppContext);

  return <Switch fallback={<DeviceMenu />}>
    <Match when={appContext?.contextValue().deviceMode === "player"}>
      <Router>
        <Route path="/" component={PlaybookRoute} />
        <Route path="/grimoire" component={GrimoireEntryRoute} />
        <Route path="/tarot" component={TarotRoute} />
        <Route path="/tarot/:id" component={TarotCardRoute} />
        <Route path="/tarot/slots/:id" component={TarotSlotsRoute} />
      </Router>
    </Match>
    <Match when={appContext?.contextValue().deviceMode === "gamesheet"}>
      <Router>
        <Route path="/" component={GameSheetRoute} />
      </Router>
    </Match>
  </Switch>
};

const NavBar = () => {
  const appContext = useContext(AppContext);

  return <Switch>
    <Match when={appContext?.contextValue().deviceMode === "player"}>
      <div class="flex flex-row p-4 gap-4 content-end justify-end">
        <IconButton href="/" label="Playbook" icon="game-icons:character" tone="red" iconClass="text-4xl" />
        <IconButton href="/tarot" label="Tarot" icon="game-icons:poker-hand" tone="purple" iconClass="text-4xl" />
        <IconButton href="/grimoire" label="Grimoire" icon="game-icons:tentacles-skull" tone="teal" iconClass="text-4xl" />
      </div>
    </Match>
  </Switch>
}

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
      class="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded bg-zinc-800 text-2xl text-white transition-colors hover:bg-zinc-700"
    >
      <Icon icon={isFullscreen() ? "mdi:fullscreen-exit" : "mdi:fullscreen"} />
    </button>
  );
};

const QrShareButton: Component = () => {
  const [isOpen, setIsOpen] = createSignal(false);
  const [qrSvg, setQrSvg] = createSignal("");

  createEffect(() => {
    if (!isOpen() || qrSvg()) return;

    QRCode.toString(SHARE_URL, {
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
        class="absolute right-14 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded bg-zinc-800 text-2xl text-white transition-colors hover:bg-zinc-700"
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
              aria-label={`QR code for ${SHARE_URL}`}
              innerHTML={qrSvg()}
              class="mx-auto mt-4 grid h-72 w-72 place-items-center bg-white p-3 text-zinc-950 [&_svg]:h-full [&_svg]:w-full"
            />
            <a
              href={SHARE_URL}
              class="mt-4 block break-all text-sm text-zinc-400 underline"
            >
              {SHARE_URL}
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

const HeaderControls: Component = () => {
  const appContext = useContext(AppContext);

  const resetSheet = () => {
    if (!appContext) return;
    if (!window.confirm("Reset the game sheet? Drawn cards, Presence, resources, doom, and active arcana will be cleared.")) return;

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
  };

  const changeDeviceType = () => {
    if (!appContext) return;
    if (!window.confirm("Return to device selection? Current sheet values will be kept.")) return;

    appContext.setDeviceMode(null);
  };

  return (
    <Switch>
      <Match when={appContext?.contextValue().deviceMode === "gamesheet"}>
        <div class="absolute left-2 top-1/2 flex -translate-y-1/2 gap-2">
          <Button
            class="min-h-10 bg-red-900 px-3 text-xs uppercase tracking-[0.14em] hover:bg-red-800 disabled:hover:bg-red-900"
            onClick={resetSheet}
          >
            Reset
          </Button>
          <Button
            class="min-h-10 bg-zinc-800 px-3 text-xs uppercase tracking-[0.14em] hover:bg-zinc-700 disabled:hover:bg-zinc-800"
            onClick={changeDeviceType}
          >
            Device
          </Button>
        </div>
      </Match>
    </Switch>
  );
};

const App: Component = () => {
  return (
    <div class="flex h-screen flex-col items-stretch justify-between bg-zinc-900">
      <AppContextProvider>
        <div class="relative border-b-1 border-b-white p-2 px-36">
          <HeaderControls />
          <a href="/" class="block gothic-heading text-4xl text-center text-white md:text-5xl">Fifth Omen</a>
          <QrShareButton />
          <FullscreenButton />
        </div>
        <div class="text-white grow flex overflow-auto items-stretch flex-col">
          <AppInner />
        </div>
        <NavBar />
      </AppContextProvider>
    </div >
  );
};

export default App;
