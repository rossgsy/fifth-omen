import { useNavigate } from "@solidjs/router";
import { MajorArcana, numeral_to_number } from "../game";
import { AppContext } from "../data/app";
import { createSignal, Match, Switch, useContext } from "solid-js";
import { Icon } from "@iconify-icon/solid";
import { createMemo } from "solid-js";

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
                <a href={`/tarot/slots/${props.slot}`} class="p-2 border rounded flex flex-row items-center justify-between">
                    <div class="flex flex-col">
                        <span>{props.title}</span>
                        <div class="text-sm text-gray-500">{props.cardType}</div>
                    </div>
                    <Icon icon="game-icons:card-play" class="text-2xl" />
                </a>
            </Match>
            <Match when={props.tarotNumber !== null}>
                <a href={`/tarot/slots/${props.slot}`} class="p-2 border rounded flex flex-row items-center justify-between">
                    <div class="flex flex-col">
                        <span>{tarotName()}</span>
                        <div class="text-sm text-gray-500">{props.cardType}</div>
                    </div>
                    <Icon icon="game-icons:card-discard" class="text-2xl" />
                </a>
            </Match>
        </Switch>
    );
};

const TarotRoute = () => {
    const nav = useNavigate();
    const [input, setInput] = createSignal("");

    const appContext = useContext(AppContext);

    let inputTimer: number = 0;

    const handleInput = () => {
        clearTimeout(inputTimer);
        inputTimer = window.setTimeout(() => {
            let value = numeral_to_number(input());
            if (!isNaN(value) && value >= 0 && value < MajorArcana.length) {
                nav(`/tarot/${value}`);
            }
        }, 300);
    };

    return <div class="flex flex-col p-4 gap-4 items-stretch justify-start min-h-100 grow ">
        {appContext?.contextValue().tarotSlots.map((slot, index) => (
            <CardButton
                slot={slot.slotId}
                title={slot.title}
                cardType={slot.slotType}
                tarotNumber={slot.tarotNumber}
            />
        ))}

        {/* <input type="text" placeholder="Enter card numeral" class="p-2 m-4 border rounded" value={input()} onInput={(e) => setInput(e.currentTarget.value)} />
        <button class="p-2 m-4 border rounded" onClick={handleInput}>Go</button> */}
    </div>
}

export default TarotRoute;