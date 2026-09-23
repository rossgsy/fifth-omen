import { SectionHeading } from "../../ui";
import { For, useContext, createSignal } from "solid-js";
import { TarotDeck, number_to_numeral } from "../../../game";
import { AppContext } from "../../../data/app";
import { Button } from "../../ui";
import { useNetwork } from "../../../data/network";

const PickRitualCard = () => {
    const appContext = useContext(AppContext);
    const network = useNetwork();

    const ritual = () => appContext?.contextValue().roomState?.ritual ?? null;
    const currentRitualStep = () => {
        const state = ritual();
        if (!state) return null;
        return state.steps[state.currentStep] ?? null;
    };

    const [selectedCard, setSelectedCard] = createSignal<number | null>(null);


    return <div class="grid max-w-md gap-5">
        <SectionHeading
            eyebrow="The Omen Turns to You"
            title={`Reveal ${currentRitualStep()?.title ?? "the Next Card"}`}
            subtitle={`Draw for the ${currentRitualStep()?.kind?.toLowerCase() ?? "ritual"} step, then tell the table what fate has shown.`}
            titleClass="text-3xl tracking-wide sm:text-4xl"
        />
        <select
            value=""
            onChange={(event) => {
                const value = event.currentTarget.value;
                setSelectedCard(value === "" ? null : Number(value));
            }}
            class="min-h-12 w-full border border-zinc-700 bg-zinc-950 px-4 text-lg text-zinc-100 outline-none focus:border-zinc-300"
        >
            <option value="">Select drawn card</option>
            <For each={TarotDeck}>
                {(cardName, tarotNumber) => (
                    <option value={tarotNumber()}>
                        {tarotNumber() <= 21 ? `${number_to_numeral(tarotNumber())} - ` : ""}{cardName}
                    </option>
                )}
            </For>
        </select>
        <Button
            class="min-h-12 bg-zinc-100 uppercase tracking-[0.16em] text-zinc-950 hover:bg-zinc-300"
            disabled={selectedCard() === null}
            onClick={() => {
                if (selectedCard() === null) return;
                network?.revealRitualCard(selectedCard()!);
                setSelectedCard(null);
            }}
        >
            Reveal Card
        </Button>
    </div>
};

export default PickRitualCard;
