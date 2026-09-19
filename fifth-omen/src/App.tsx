import type { Component } from "solid-js";
import AppContextProvider from "./data/app";
import { NetworkProvider } from "./data/network";
import { DeviceBootstrap, PreventAccidentalRefresh } from "./components/Device";
import { AppInner } from "./components/AppBody";
import {
  ConnectionStatusButton,
  FullscreenButton,
  HeaderControls,
  QrShareButton,
} from "./components/AppControls";

const App: Component = () => (
  <div class="flex h-screen flex-col items-stretch justify-between bg-zinc-900">
    <AppContextProvider>
      <NetworkProvider>
        <DeviceBootstrap />
        <PreventAccidentalRefresh />
        <header class="grid grid-cols-[auto_1fr_auto] items-center gap-2 border-b-1 border-b-white p-2">
          <div class="min-w-0">
            <HeaderControls />
          </div>
          <a href="/" class="block min-w-0 truncate text-center gothic-heading text-3xl text-white sm:text-4xl md:text-5xl">
            Fifth Omen
          </a>
          <div class="flex gap-2">
            <ConnectionStatusButton />
            <QrShareButton />
            <FullscreenButton />
          </div>
        </header>
        <main class="flex grow flex-col items-stretch overflow-auto text-white">
          <AppInner />
        </main>
      </NetworkProvider>
    </AppContextProvider>
  </div>
);

export default App;
