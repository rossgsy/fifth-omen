import { Match, Switch, useContext, type Component } from 'solid-js';
import AppContextProvider, { AppContext } from './data/app';
import { Route, Router } from "@solidjs/router";
import PlaybookRoute from './routes/Playbook';
import TarotRoute from './routes/Tarot';
import TarotCardRoute from './routes/TarotCard';
import HomeRoute from './routes/Home';
import GrimoireEntryRoute from './routes/GrimoireEntry';
import { Icon } from '@iconify-icon/solid';
import TarotSlotsRoute from './routes/TarotSlots';
import GameSheetRoute from './routes/GameSheet';

const DeviceMenu: Component = () => {
  const appContext = useContext(AppContext);

  return <div class="flex flex-col min-h-100 grow p-4 justify-center gap-3">
    <div
      onClick={() => appContext?.setDeviceMode("player")}
      class="
      cursor-pointer border border-zinc-700 bg-zinc-950 p-5
      transition-all hover:border-zinc-500 hover:bg-zinc-900
    "
    >
      <p class="text-xs uppercase tracking-[0.22em] text-zinc-600">
        Personal
      </p>
      <p class="mt-1 text-xl text-zinc-100">
        Player Sheet
      </p>
    </div>
    <div
      onClick={() => appContext?.setDeviceMode("gamesheet")}
      class="
      cursor-pointer border border-zinc-700 bg-zinc-950 p-5
      transition-all hover:border-zinc-500 hover:bg-zinc-900
    "
    >
      <p class="text-xs uppercase tracking-[0.22em] text-zinc-600">
        Shared
      </p>
      <p class="mt-1 text-xl text-zinc-100">
        Game Sheet
      </p>
    </div>
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
      <div>
        <div class="flex flex-row p-4 gap-4 content-end justify-end">
          <a href="/" class="bg-red-800 text-white p-4 rounded-full flex">
            <Icon icon="game-icons:character" class="text-4xl" />
          </a>
          <a href="/tarot" class="bg-purple-800 text-white p-4 rounded-full flex">
            <Icon icon="game-icons:poker-hand" class="text-4xl" />
          </a>
          <a href="/grimoire" class="bg-teal-800 text-white p-4 rounded-full flex">
            <Icon icon="game-icons:tentacles-skull" class="text-4xl" />
          </a>
        </div>
      </div>
    </Match>
  </Switch>
}

const App: Component = () => {
  return (
    <div class="flex justify-between items-stretch h-screen flex-col bg-zinc-900">
      <AppContextProvider>
        <div class="p-4 border-b-1 border-b-white">
          <a href="/" class="block gothic-heading text-6xl text-center text-white">Fifth Omen</a>
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
