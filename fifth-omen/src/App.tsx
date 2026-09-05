import type { Component } from 'solid-js';
import AppContextProvider from './data/app';
import { Route, Router } from "@solidjs/router";
import PlaybookRoute from './routes/Playbook';
import TarotRoute from './routes/Tarot';
import TarotCardRoute from './routes/TarotCard';
import HomeRoute from './routes/Home';
import GrimoireListRoute from './routes/GrimoireList';
import GrimoireEntryRoute from './routes/GrimoireEntry';
import { Icon } from '@iconify-icon/solid';

const App: Component = () => {

  return (
    <div class="flex justify-between items-stretch h-screen flex-col bg-zinc-900">
      <div class="p-4 border-b-1 border-b-white">
        <a href="/" class="block gothic-heading text-6xl text-center text-white">Fifth Omen</a>
      </div>
      <div class="text-white grow flex overflow-auto items-stretch flex-col">
        <AppContextProvider>
          <Router>
            <Route path="/" component={HomeRoute} />
            <Route path="/playbook" component={PlaybookRoute} />
            <Route path="/grimoire" component={GrimoireEntryRoute} />
            <Route path="/tarot" component={TarotRoute} />
            <Route path="/tarot/:id" component={TarotCardRoute} />
          </Router>
        </AppContextProvider>
      </div>
      <div>
        <div class="flex flex-row p-4 gap-4 content-end justify-end">
          <a href="/playbook" class="bg-red-800 text-white p-4 rounded-full flex">
            <Icon icon="material-symbols:person" class="text-4xl" />
          </a>
          <a href="/tarot" class="bg-purple-800 text-white p-4 rounded-full flex">
            <Icon icon="material-symbols:playing-cards" class="text-4xl" />
          </a>
          <a href="/grimoire" class="bg-teal-800 text-white p-4 rounded-full flex">
            <Icon icon="mdi:book-open" class="text-4xl" />
          </a>
        </div>
      </div>
    </div >
  );
};

export default App;
