import { useParams } from "@solidjs/router";
import { Folio1, MajorArcana, lookup_arcana_for_card, lookup_encounter_for_card } from "../game";
import { Match, Switch, useContext } from "solid-js";
import { AppContext } from "../data/app";
import { Icon } from "@iconify-icon/solid";

const TarotCardRoute = () => {
    const appContext = useContext(AppContext);

    const params = useParams();
    let id = (Number)(params.id);

    let folio = Folio1;
    let creatureCount = Object.keys(folio.entities).length;
    let associatedKey = (Number)(Object.keys(folio.entities)[id % creatureCount]);

    let arcana = lookup_arcana_for_card(id);
    let encounter = lookup_encounter_for_card(id);
    let entity = folio.entities[associatedKey];

    return <div class="flex flex-col items-stretch justify-start min-h-100 gap-4 grow p-4">
        <h2 class="gothic-sub-heading text-2xl text-center">{MajorArcana[id] ?? "No major arcana"}</h2>
        <hr />
        <div class="flex flex-row justify-between items-center">
            <div class="flex flex-col">
                <h3 class="gothic-sub-heading">Entity</h3>
                <p>{entity?.name ?? "No entity"}</p>
            </div>
            <div class="bg-orange-800 text-white p-4 rounded-full flex">
                <Icon icon="material-symbols:target" class="text-2xl"
                    onClick={() => {
                        appContext?.setContextValue({
                            ...appContext.contextValue(),
                            activeEntity: associatedKey
                        });
                    }}
                />
            </div>
        </div>
        <hr />
        <div>
            <h3 class="gothic-sub-heading">Encounter - {encounter?.name ?? "No encounter"}</h3>
            <p>{encounter?.rule ?? "No rule"}</p>
        </div>
        <hr />
        <div class="flex flex-col gap-2">
            <div class="flex flex-row justify-between items-center gap-4">
                <div class="flex flex-col gap-2">
                    <h4 class="gothic-sub-heading">Arcana - Face Up</h4>
                    <p>{arcana?.rule_face_up ?? "No effect"}</p>
                </div>
                <Switch>
                    <Match when={arcana?.rule_face_up}>
                        <div class="bg-orange-800 text-white p-4 rounded-full flex">
                            <Icon icon="material-symbols:keep" class="text-2xl"
                                onClick={() => {
                                    appContext?.setContextValue({
                                        ...appContext.contextValue(),
                                        activeEntity: associatedKey
                                    });
                                }}
                            />
                        </div>
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
                        <div class="bg-orange-800 text-white p-4 rounded-full flex">
                            <Icon icon="material-symbols:keep" class="text-2xl"
                                onClick={() => {
                                    appContext?.setContextValue({
                                        ...appContext.contextValue(),
                                        activeEntity: associatedKey
                                    });
                                }}
                            />
                        </div>
                    </Match>
                </Switch>
            </div>
        </div>
        <hr />
    </div>
}

export default TarotCardRoute;