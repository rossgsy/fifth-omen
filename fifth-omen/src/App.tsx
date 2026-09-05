import type { Component } from 'solid-js';
import AppContextProvider from './data/app';
import { Route, Router } from "@solidjs/router";
import PlaybookRoute from './routes/Playbook';
import HomeRoute from './routes/Home';

const App: Component = () => {

  return (
    <div class="flex justify-between items-center  min-h-screen flex-col bg-zinc-900">
      <div class="p-4">
        <h1 class="gothic-heading text-6xl text-white">Fifth Omen</h1>
      </div>
      <div class="text-white grow flex">
        <AppContextProvider>
          <Router>
            <Route path="/" component={HomeRoute} />
            <Route path="/playbook" component={PlaybookRoute} />
          </Router>
        </AppContextProvider>
      </div>
      <div>
      </div>
    </div >
  );
};

export default App;
