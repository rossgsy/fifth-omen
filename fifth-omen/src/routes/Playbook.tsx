import { Match, onMount, Switch, createSignal, useContext } from "solid-js";
import { AppContext } from "../data/app";
import PlaybookComponent from "../Playbook";
import { Playbook, playbooks } from "../game";

const PlaybookRoute = () => {
    const appContext = useContext(AppContext);

    return <Switch>
        <Match when={appContext?.contextValue.selectedPlaybook !== null}>
            <PlaybookComponent playbook={playbooks[appContext?.contextValue.selectedPlaybook!]} />
        </Match>
    </Switch>;
};

export default PlaybookRoute;