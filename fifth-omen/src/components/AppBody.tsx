import { Match, Show, Switch, useContext, type Component } from "solid-js";
import { Route, Router } from "@solidjs/router";
import { AppContext } from "../data/app";
import PlaybookRoute from "../routes/Playbook";
import GameSheetRoute from "../routes/GameSheet";
import { DeviceMenu } from "./Device";
import { GameScreenConnectionPrompt, PlayerConnectionPrompt } from "./ConnectionPrompt";

export const AppInner: Component = () => {
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

