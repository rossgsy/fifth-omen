import { Match, Switch, useContext, type Component } from 'solid-js';
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
