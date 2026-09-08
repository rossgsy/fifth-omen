import { Folio1 } from "../game";
import { createMemo, Match, Switch, useContext } from "solid-js";
import { AppContext } from "../data/app";
import EntitySheet from "../components/Entity";
import { Page } from "../components/ui";

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
        <Page class="gap-2 items-stretch">
            <Switch fallback={<div class="text-center">Nothing Selected</div>}>
                <Match when={entity()}>
                    <EntitySheet entity={entity()} />
                </Match>
            </Switch>
        </Page>
    );
};

export default GrimoireEntryRoute;
