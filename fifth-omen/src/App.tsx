import { Match, Switch, createSignal, onCleanup, onMount, useContext, type Component } from 'solid-js';
import AppContextProvider, { AppContext } from './data/app';
import { Route, Router } from "@solidjs/router";
import PlaybookRoute from './routes/Playbook';
import TarotRoute from './routes/Tarot';
import TarotCardRoute from './routes/TarotCard';
import HomeRoute from './routes/Home';
import GrimoireEntryRoute from './routes/GrimoireEntry';
import TarotSlotsRoute from './routes/TarotSlots';
import GameSheetRoute from './routes/GameSheet';
import { ActionCard, IconButton } from './components/ui';
import { Icon } from '@iconify-icon/solid';

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  webkitRequestFullScreen?: () => Promise<void> | void;
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

const App: Component = () => {
  return (
    <div class="flex h-screen flex-col items-stretch justify-between bg-zinc-900">
      <AppContextProvider>
        <div class="relative border-b-1 border-b-white p-2 pr-14">
          <a href="/" class="block gothic-heading text-4xl text-center text-white md:text-5xl">Fifth Omen</a>
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
