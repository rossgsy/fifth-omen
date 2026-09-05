import { Folio1 } from "../game";
import { createMemo, Match, Switch, useContext } from "solid-js";
import { AppContext } from "../data/app";
import EntitySheet from "../components/Entity";

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
                    <EntitySheet entity={entity()} />
                </Match>
            </Switch>
        </div>
    );
};

export default GrimoireEntryRoute;