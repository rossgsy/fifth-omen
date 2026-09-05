import { Folio1 } from "../game";
import { createMemo, Match, Switch, useContext } from "solid-js";
import { AppContext } from "../data/app";

const GrimoireEntryRoute = () => {
    const appContext = useContext(AppContext);
    const entity = createMemo(() => {
        const id = appContext?.contextValue().activeEntity;
        if (id === null) {
            return null;
        }

        return id !== undefined ? Folio1.entities[id] : null;
    });

    return (
        <div class="flex flex-col gap-2 items-stretch p-4">
            <Switch fallback={<div class="text-center">Nothing Selected</div>}>
                <Match when={entity()}>
                    <div class="gothic-sub-heading text-2xl text-center">{entity()?.name}</div>
                </Match>
            </Switch>
        </div>
    );
};

export default GrimoireEntryRoute;