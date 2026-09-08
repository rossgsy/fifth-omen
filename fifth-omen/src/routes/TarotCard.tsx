import { useParams } from "@solidjs/router";
import { Folio1, MajorArcana, lookup_arcana_for_card, lookup_encounter_for_card, lookup_entity_key_for_card } from "../game";
import { Match, Switch, useContext } from "solid-js";
import { AppContext } from "../data/app";
import { Divider, IconButton, Page, SectionHeading } from "../components/ui";

const TarotCardRoute = () => {
    const appContext = useContext(AppContext);

    const params = useParams();
    let id = (Number)(params.id);

    let folio = Folio1;
    let associatedKey = lookup_entity_key_for_card(id);

    let arcana = lookup_arcana_for_card(id);
    let encounter = lookup_encounter_for_card(id);
    let entity = associatedKey !== null ? folio.entities[associatedKey] : null;

    const selectEntity = () => {
        appContext?.setContextValue({
            ...appContext.contextValue(),
            activeEntity: associatedKey,
            activeEntityCard: id,
        });
    };

    return <Page class="items-stretch justify-start min-h-100">
        <SectionHeading title={MajorArcana[id] ?? "No major arcana"} />
        <Divider />
        <div class="flex flex-row justify-between items-center">
            <div class="flex flex-col">
                <h3 class="gothic-sub-heading">Entity</h3>
                <p>{entity?.name ?? "No entity"}</p>
            </div>
            <IconButton
                label="Select entity"
                icon="game-icons:tentacles-skull"
                tone="orange"
                onClick={selectEntity}
            />
        </div>
        <Divider />
        <div>
            <h3 class="gothic-sub-heading">Encounter - {encounter?.name ?? "No encounter"}</h3>
            <p>{encounter?.rule ?? "No rule"}</p>
        </div>
        <Divider />
        <div class="flex flex-col gap-2">
            <div class="flex flex-row justify-between items-center gap-4">
                <div class="flex flex-col gap-2">
                    <h4 class="gothic-sub-heading">Arcana - Face Up</h4>
                    <p>{arcana?.rule_face_up ?? "No effect"}</p>
                </div>
                <Switch>
                    <Match when={arcana?.rule_face_up}>
                        <IconButton
                            label="Use face up arcana"
                            icon="game-icons:card-play"
                            tone="orange"
                            onClick={selectEntity}
                        />
                    </Match>
                </Switch>
            </div>
            <div class="flex flex-row justify-between items-center gap-4">
                <div class="flex flex-col gap-2">
                    <h4 class="gothic-sub-heading">Arcana - Face Down</h4>
                    <p>{arcana?.rule_face_down ?? "No effect"}</p>
                </div>
                <Switch>
                    <Match when={arcana?.rule_face_down}>
                        <IconButton
                            label="Use face down arcana"
                            icon="game-icons:card-play"
                            tone="orange"
                            onClick={selectEntity}
                        />
                    </Match>
                </Switch>
            </div>
        </div>
        <Divider />
    </Page>
}

export default TarotCardRoute;
