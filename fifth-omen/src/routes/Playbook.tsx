import { Match, Switch, useContext } from "solid-js";
import { AppContext } from "../data/app";
import PlaybookComponent from "../Playbook";
import { playbooks } from "../game";

const PlaybookRoute = () => {
    const appContext = useContext(AppContext);

    return <Switch fallback={<div>Select a playbook</div>}>
        <Match when={appContext?.contextValue()?.selectedPlaybook !== null}>
            <PlaybookComponent playbook={playbooks[appContext?.contextValue()?.selectedPlaybook!]} />
        </Match>
    </Switch>;
};

export default PlaybookRoute;