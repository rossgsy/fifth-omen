import { MajorArcana } from "../game";
import { AppContext } from "../data/app";
import { createMemo, Match, Switch, useContext } from "solid-js";
import { Icon } from "@iconify-icon/solid";
import { Page, Panel } from "../components/ui";

interface CardButtonProps {
    title: string;
    cardType: "Entity" | "Encounter";
    tarotNumber: number | null;
    slot: number;
}

const CardButton = (props: CardButtonProps) => {
    const tarotName = createMemo(() => {
        if (props.tarotNumber == null) return null;
        return MajorArcana[props.tarotNumber];
    }, [props.tarotNumber]);

    return (
        <Switch>
            <Match when={props.tarotNumber == null}>
                <Panel as="div" class="p-0">
                    <a href={`/tarot/slots/${props.slot}`} class="flex flex-row items-center justify-between p-2">
                        <div class="flex flex-col">
                            <span>{props.title}</span>
                            <div class="text-sm text-gray-500">{props.cardType}</div>
                        </div>
                        <Icon icon="game-icons:card-play" class="text-2xl" />
                    </a>
                </Panel>
            </Match>
            <Match when={props.tarotNumber !== null}>
                <Panel as="div" class="p-0">
                    <a href={`/tarot/slots/${props.slot}`} class="flex flex-row items-center justify-between p-2">
                        <div class="flex flex-col">
                            <span>{tarotName()}</span>
                            <div class="text-sm text-gray-500">{props.cardType}</div>
                        </div>
                        <Icon icon="game-icons:card-discard" class="text-2xl" />
                    </a>
                </Panel>
            </Match>
        </Switch>
    );
};

const TarotRoute = () => {
    const appContext = useContext(AppContext);

    return <Page class="items-stretch justify-start min-h-100">
        {appContext?.contextValue().tarotSlots.map((slot) => (
            <CardButton
                slot={slot.slotId}
                title={slot.title}
                cardType={slot.slotType}
                tarotNumber={slot.tarotNumber}
            />
        ))}
    </Page>
}

export default TarotRoute;
