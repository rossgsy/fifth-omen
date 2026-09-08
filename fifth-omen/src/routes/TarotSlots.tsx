import { useParams } from "@solidjs/router";
import { createMemo, createSignal, Match, Switch } from "solid-js";
import { useContext } from "solid-js";
import { AppContext } from "../data/app";
import { Icon } from "@iconify-icon/solid";
import { Folio1, lookup_encounter_for_card, lookup_entity_for_card, MajorArcana, numeral_to_number } from "../game";

interface CardPickerModalProps {
    isOpen: boolean;
    onPick: (tarotNumber: number) => void;
    onClose: () => void;
}

const CardPickerModal = (props: CardPickerModalProps) => {
    const [cardNumeral, setCardNumeral] = createSignal<string>("");

    const cardDetails = createMemo(() => {
        const number = numeral_to_number(cardNumeral());
        if (isNaN(number) || number < 0 || number > 21) return null;
        return MajorArcana[number] ?? null;
    });

    return <Switch>
        <Match when={props.isOpen}>
            <div
                onClick={props.onClose}
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
            >
                <div
                    onClick={(e) => e.stopPropagation()}
                    class="
      w-full max-w-md
      border border-zinc-700
      bg-zinc-950
      p-6
      shadow-2xl
    "
                >
                    <input
                        value={cardNumeral() ?? ""}
                        onInput={(e) => setCardNumeral(e.currentTarget.value)}
                        class="
        w-full
        border-b border-zinc-700
        bg-transparent
        px-1 py-3
        text-center
        text-4xl
        tracking-[0.25em]
        text-zinc-100
        outline-none
        transition-colors
        focus:border-zinc-300
      "
                    />

                    <div class="my-5 flex items-center gap-3">
                        <div class="h-px flex-1 bg-zinc-800" />
                        <span class="text-xs text-zinc-600">◆</span>
                        <div class="h-px flex-1 bg-zinc-800" />
                    </div>

                    <p class="text-center leading-relaxed text-zinc-400">
                        {cardDetails() ?? ""}
                    </p>
                    <div class="mt-5 flex justify-center">
                        <button
                            onClick={() => props.onPick(numeral_to_number(cardNumeral()))}
                            class="px-4 py-2 bg-zinc-700 text-zinc-100 rounded hover:bg-zinc-600 transition-colors"
                            disabled={cardDetails() === null}
                        >
                            Pick Card
                        </button>
                    </div>
                </div>
            </div>
        </Match>
    </Switch>
};

interface PickCardProps {
    onClick: () => void;
}

const PickCard = (props: PickCardProps) => {
    return (
        <div
            onClick={props.onClick}
            class="
      flex min-h-100 grow cursor-pointer flex-col
      items-center justify-center gap-4
      border border-dashed border-zinc-700
      bg-zinc-950/40
      p-4
      text-zinc-500
      transition-all
      hover:border-zinc-500
      hover:bg-zinc-900/60
      hover:text-zinc-300
    "
        >
            <Icon
                icon="game-icons:abstract-066"
                class="text-6xl opacity-60"
            />

            <div class="flex items-center gap-3">
                <div class="h-px w-8 bg-zinc-800" />
                <span class="text-xs text-zinc-700">◆</span>
                <div class="h-px w-8 bg-zinc-800" />
            </div>

            <p class="text-center text-sm uppercase tracking-[0.2em]">
                Pick a Card
            </p>
        </div>
    );
};

interface CardProps {
    tarotNumber: number | null;
    title: string | null;
    type: "Encounter" | "Entity";
}

const Card = (props: CardProps) => {
    const encounter = createMemo(() => {
        if (props.tarotNumber === null) return null;
        return lookup_encounter_for_card(props.tarotNumber);
    });

    const entity = createMemo(() => {
        if (props.tarotNumber === null) return null;
        return lookup_entity_for_card(props.tarotNumber);
    });

    return (
        <div
            class="
      flex min-h-100 grow flex-col items-center gap-4
      border border-zinc-700
      bg-zinc-950
      p-5
      text-zinc-100
      shadow-lg
    "
        >
            <div class="flex w-full items-center gap-3">
                <div class="h-px flex-1 bg-zinc-800" />
                <span class="text-xs text-zinc-600">◆</span>
                <div class="h-px flex-1 bg-zinc-800" />
            </div>

            <p class="text-center text-2xl font-semibold tracking-wide">
                {props.title ?? "Unknown Card"}
            </p>

            <div class="flex w-full items-center gap-3">
                <div class="h-px flex-1 bg-zinc-800" />
                <span class="text-xs text-zinc-600">◆</span>
                <div class="h-px flex-1 bg-zinc-800" />
            </div>
            <Switch>
                <Match when={props.type === "Encounter"}>
                    <div class="flex flex-col gap-2 items-center justify-center">
                        <p class="text-lg font-semibold">{
                            encounter()?.name ?? "Unknown Encounter"
                        }</p>
                        <p class="text-left text-gray-500 italic">{
                            (encounter()?.rule ?? "")
                        }</p>
                    </div>
                </Match>
                <Match when={props.type === "Entity"}>
                    <div class="flex flex-col gap-2 items-center justify-center">
                        <p class="text-lg font-semibold">{
                            entity()?.name ?? "Unknown Entity"
                        }</p>
                        <p class="text-center text-gray-500 italic">{
                            "'" + (entity()?.quote ?? "") + "'"
                        }</p>
                    </div>
                </Match>
            </Switch>
        </div>
    );
};

const TarotSlotsRoute = () => {

    const appContext = useContext(AppContext);
    const params = useParams();
    const [pickerModalOpen, setPickerModalOpen] = createSignal(false);

    const slot = createMemo(() => {
        if (!params.id) return null;

        return appContext?.contextValue().tarotSlots.find(slot => slot.slotId === parseInt(params.id ?? ""));

    });

    return <div class="flex flex-col p-4 gap-4 items-stretch justify-start min-h-100 grow">
        <div class="flex flex-col gap-2 items-center justify-center">
            <h1 class="gothic-sub-heading text-2xl text-center">{slot()?.title}</h1>
            <p class="text-center text-gray-500">{slot()?.slotType}</p>
        </div>
        <div>
            <Switch fallback={<PickCard onClick={() => setPickerModalOpen(true)} />}>
                <Match when={slot()?.tarotNumber != null}>
                    <Card
                        tarotNumber={slot()?.tarotNumber ?? null}
                        title={MajorArcana[slot()?.tarotNumber ?? 0] ?? null}
                        type={slot()?.slotType ?? "Encounter"}
                    />
                </Match>
            </Switch>
        </div>
        <CardPickerModal isOpen={pickerModalOpen()}
            onClose={() => setPickerModalOpen(false)}
            onPick={(tarotNumber) => {
                if (slot()) {
                    appContext?.setSlotCard(slot()!.slotId, tarotNumber);
                }
                setPickerModalOpen(false);
            }} />
    </div>
}

export default TarotSlotsRoute;