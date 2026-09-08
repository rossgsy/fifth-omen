import { For, Show, createMemo, createSignal, useContext } from "solid-js";
import { Button, Page, Panel, SectionHeading } from "../components/ui";
import { AppContext } from "../data/app";
import {
    Folio1,
    MajorArcana,
    lookup_arcana_for_card,
    lookup_encounter_for_card,
    lookup_entity_key_for_card,
    number_to_numeral,
} from "../game";

const DRAW_STEPS: Array<{ title: string; kind: "Entity" | "Encounter" }> = [
    { title: "First Card", kind: "Entity" },
    { title: "Second Card", kind: "Encounter" },
    { title: "Third Card", kind: "Entity" },
    { title: "Fourth Card", kind: "Encounter" },
    { title: "Final Card", kind: "Entity" },
];

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

const StepperTracker = (props: {
    label: string;
    value: number;
    max: number;
    onChange: (value: number) => void;
}) => (
    <div class="flex flex-col gap-3 text-center">
        <p class="text-xs uppercase tracking-[0.18em] text-zinc-600">
            {props.label}
        </p>
        <div class="grid grid-cols-[3rem_4.5rem_3rem] items-center justify-center gap-2">
            <Button
                class="flex h-12 w-12 items-center justify-center p-0 text-3xl leading-none"
                disabled={props.value <= 0}
                onClick={() => props.onChange(clamp(props.value - 1, props.max))}
            >
                -
            </Button>
            <div class="text-center text-4xl tabular-nums leading-none text-zinc-100">
                {props.value}
            </div>
            <Button
                class="flex h-12 w-12 items-center justify-center p-0 text-3xl leading-none"
                disabled={props.value >= props.max}
                onClick={() => props.onChange(clamp(props.value + 1, props.max))}
            >
                +
            </Button>
        </div>
        <div class="flex min-h-8 flex-wrap justify-center gap-0.5 text-base text-zinc-200">
            <For each={Array.from({ length: props.max }, (_, index) => index)}>
                {(index) => (
                    <button
                        type="button"
                        aria-label={`Set ${props.label} to ${index + 1}`}
                        class={index < props.value ? "h-6 w-6 opacity-100" : "h-6 w-6 opacity-30"}
                        onClick={() => props.onChange(index + 1 === props.value ? index : index + 1)}
                    >
                        {index < props.value ? "●" : "○"}
                    </button>
                )}
            </For>
        </div>
    </div>
);

const RuleCard = (props: { label: string; children: string | undefined }) => (
    <div class="border border-zinc-800 bg-zinc-950/70 p-3">
        <p class="text-xs uppercase tracking-[0.18em] text-zinc-600">
            {props.label}
        </p>
        <p class="mt-2 text-sm leading-relaxed text-zinc-300">
            {props.children || "No rule set."}
        </p>
    </div>
);

const EntityReferenceList = (props: {
    title: string;
    items: Array<{ diceRule: string; description: string }>;
}) => (
    <Panel as="section" class="p-3">
        <p class="mb-3 text-center text-xs uppercase tracking-[0.18em] text-zinc-600">
            {props.title}
        </p>
        <div class="grid gap-2">
            <For each={props.items}>
                {(item) => (
                    <div class="grid grid-cols-[3rem_1fr] gap-3 border-t border-zinc-800 pt-2 first:border-t-0 first:pt-0">
                        <div class="gothic-sub-heading text-center text-base tabular-nums text-zinc-100">
                            {item.diceRule}
                        </div>
                        <p class="text-sm leading-relaxed text-zinc-300">
                            {item.description}
                        </p>
                    </div>
                )}
            </For>
        </div>
    </Panel>
);

const GameSheetRoute = () => {
    const appContext = useContext(AppContext);
    const [pendingCard, setPendingCard] = createSignal<number | null>(null);

    const updateGameSheetValue = (value: Partial<{
        entityPresence: number;
        entityResource: number;
        globalDoom: number;
        activeArcanaCards: Array<number | null>;
        activeEntityCard: number | null;
        activeEntity: number | null;
        drawnTarotCards: Array<number | null>;
        currentPhase: number;
    }>) => {
        if (!appContext) return;

        appContext.setContextValue({
            ...appContext.contextValue(),
            ...value,
        });
    };

    const cardOptions = createMemo(() => (
        MajorArcana.map((cardName, tarotNumber) => ({
            cardName,
            tarotNumber,
            numeral: number_to_numeral(tarotNumber),
        }))
    ));

    const drawnCards = createMemo(() => appContext?.contextValue().drawnTarotCards ?? [null, null, null, null, null]);
    const currentPhase = createMemo(() => Math.min(appContext?.contextValue().currentPhase ?? 0, DRAW_STEPS.length));
    const isComplete = createMemo(() => currentPhase() >= DRAW_STEPS.length);
    const currentStep = createMemo(() => DRAW_STEPS[clamp(currentPhase(), DRAW_STEPS.length - 1)]);
    const currentCard = createMemo(() => isComplete() ? null : drawnCards()[currentPhase()] ?? null);
    const isDrawPhase = createMemo(() => !isComplete() && currentCard() === null);

    const entityForCard = (tarotNumber: number | null) => {
        if (tarotNumber === null) return null;
        const entityKey = lookup_entity_key_for_card(tarotNumber);
        return entityKey !== null ? Folio1.entities[entityKey] ?? null : null;
    };

    const currentEntity = createMemo(() => (
        currentStep().kind === "Entity" ? entityForCard(currentCard()) : null
    ));

    const currentEncounter = createMemo(() => (
        currentStep().kind === "Encounter" && currentCard() !== null
            ? lookup_encounter_for_card(currentCard()!)
            : null
    ));

    const activeArcana = createMemo(() => (
        [drawnCards()[1], drawnCards()[3]].map((tarotNumber, index) => {
            if (tarotNumber === null) return null;
            const arcana = lookup_arcana_for_card(tarotNumber);

            return {
                slotTitle: index === 0 ? "Second Card" : "Fourth Card",
                numeral: number_to_numeral(tarotNumber),
                cardName: MajorArcana[tarotNumber],
                rule: arcana?.rule_face_up || arcana?.rule_face_down || "No arcana rule set for this card.",
            };
        }).filter((arcana): arcana is NonNullable<typeof arcana> => arcana !== null)
    ));

    const commitPendingCard = () => {
        if (pendingCard() === null || isComplete()) return;

        const tarotNumber = pendingCard()!;
        const phase = currentPhase();
        const nextDrawnCards = [...drawnCards()];
        nextDrawnCards[phase] = tarotNumber;

        updateGameSheetValue({
            drawnTarotCards: nextDrawnCards,
            activeArcanaCards: [nextDrawnCards[1], nextDrawnCards[3]],
            activeEntityCard: currentStep().kind === "Entity" ? tarotNumber : appContext?.contextValue().activeEntityCard ?? null,
            activeEntity: currentStep().kind === "Entity" ? lookup_entity_key_for_card(tarotNumber) : appContext?.contextValue().activeEntity ?? null,
            entityPresence: currentStep().kind === "Entity" ? 0 : appContext?.contextValue().entityPresence ?? 0,
            entityResource: currentStep().kind === "Entity" ? 0 : appContext?.contextValue().entityResource ?? 0,
        });
        setPendingCard(null);
    };

    const completePhase = () => {
        if (isComplete()) return;
        updateGameSheetValue({
            currentPhase: currentPhase() + 1,
        });
    };

    const resetSheet = () => {
        if (!appContext) return;
        if (!window.confirm("Reset the game sheet? Drawn cards, Presence, resources, doom, and active arcana will be cleared.")) return;

        appContext.setContextValue({
            ...appContext.contextValue(),
            entityPresence: 0,
            entityResource: 0,
            globalDoom: 0,
            activeArcanaCards: [null, null],
            activeEntityCard: null,
            activeEntity: null,
            drawnTarotCards: [null, null, null, null, null],
            currentPhase: 0,
        });
        setPendingCard(null);
    };

    const changeDeviceType = () => {
        if (!appContext) return;
        if (!window.confirm("Return to device selection? Current sheet values will be kept.")) return;

        appContext.setDeviceMode(null);
    };

    return (
        <Page class="gap-3 p-3">
            <div class="grid gap-3 lg:grid-cols-[18rem_minmax(0,1fr)_auto] lg:items-stretch">
                <Panel class="p-3">
                    <StepperTracker
                        label="Global Doom"
                        value={appContext?.contextValue().globalDoom ?? 0}
                        max={10}
                        onChange={(globalDoom) => updateGameSheetValue({ globalDoom })}
                    />
                </Panel>

                <Panel as="section" class="border-zinc-800 bg-zinc-950/60 p-3">
                    <p class="mb-3 text-center text-xs uppercase tracking-[0.18em] text-zinc-600">
                        Active Arcana
                    </p>

                    <div class="grid gap-3 md:grid-cols-2">
                        <For each={activeArcana()} fallback={
                            <p class="text-center text-zinc-500">
                                The second and fourth cards become active arcana.
                            </p>
                        }>
                            {(arcana) => (
                                <div class="border border-zinc-800 bg-zinc-950 p-3">
                                    <p class="text-xs uppercase tracking-[0.18em] text-zinc-600">
                                        {arcana.slotTitle} / {arcana.numeral}
                                    </p>
                                    <h3 class="mt-2 gothic-sub-heading text-lg text-zinc-100">
                                        {arcana.cardName}
                                    </h3>
                                    <p class="mt-2 text-sm leading-relaxed text-zinc-400">
                                        {arcana.rule}
                                    </p>
                                </div>
                            )}
                        </For>
                    </div>
                </Panel>

                <div class="grid grid-cols-2 gap-2 lg:grid-cols-1">
                    <Button
                        class="min-h-12 bg-red-900 text-xs uppercase tracking-[0.14em] hover:bg-red-800 disabled:hover:bg-red-900"
                        onClick={resetSheet}
                    >
                        Reset
                    </Button>
                    <Button
                        class="min-h-12 bg-zinc-800 text-xs uppercase tracking-[0.14em] hover:bg-zinc-700 disabled:hover:bg-zinc-800"
                        onClick={changeDeviceType}
                    >
                        Device
                    </Button>
                </div>
            </div>

            <Show when={isDrawPhase()}>
                <Panel as="section" class="grid min-h-[28rem] place-items-center p-6">
                    <div class="grid w-full max-w-5xl gap-6">
                        <SectionHeading
                            eyebrow={currentStep().kind}
                            title={`Draw ${currentStep().title}`}
                            subtitle="Choose the physical tarot card drawn, then lock it in."
                            titleClass="text-4xl tracking-wide"
                        />

                        <div class="grid gap-3 md:grid-cols-5">
                            <For each={DRAW_STEPS}>
                                {(step, index) => (
                                    <div class={index() === currentPhase()
                                        ? "border border-zinc-400 bg-zinc-900 p-3 text-center"
                                        : "border border-zinc-800 bg-zinc-950/70 p-3 text-center opacity-50"}
                                    >
                                        <p class="text-xs uppercase tracking-[0.18em] text-zinc-600">
                                            {step.title}
                                        </p>
                                        <p class="mt-1 text-sm text-zinc-400">
                                            {step.kind}
                                        </p>
                                        <p class="mt-3 gothic-sub-heading text-xl text-zinc-100">
                                            {drawnCards()[index()] !== null ? number_to_numeral(drawnCards()[index()]!) : "-"}
                                        </p>
                                    </div>
                                )}
                            </For>
                        </div>

                        <select
                            value=""
                            onChange={(event) => {
                                const value = event.currentTarget.value;
                                if (value !== "") setPendingCard(Number(value));
                                event.currentTarget.value = "";
                            }}
                            class="mx-auto min-h-14 w-full max-w-xl border border-zinc-700 bg-zinc-950 px-4 text-xl text-zinc-100 outline-none focus:border-zinc-300"
                        >
                            <option value="">Select drawn card</option>
                            <For each={cardOptions()}>
                                {(option) => (
                                    <option value={option.tarotNumber}>
                                        {option.numeral} - {option.cardName}
                                    </option>
                                )}
                            </For>
                        </select>
                    </div>
                </Panel>
            </Show>

            <Show when={!isDrawPhase() && !isComplete()}>
                <div class="flex min-h-0 flex-col gap-3">
                    <Panel as="section" class="p-3">
                        <SectionHeading
                            eyebrow={currentStep().kind}
                            title={`${number_to_numeral(currentCard()!)} - ${MajorArcana[currentCard()!]}`}
                            subtitle={currentStep().title}
                            titleClass="text-2xl tracking-wide"
                        />
                    </Panel>

                    <Show when={currentStep().kind === "Entity"}>
                        <Show
                            when={currentEntity()}
                            fallback={
                                <Panel as="section" class="p-6 text-center text-zinc-500">
                                    No entity is mapped to this card.
                                </Panel>
                            }
                        >
                            {(entity) => (
                                <>
                                    <Panel as="section" class="flex flex-col gap-3 p-3">
                                        <SectionHeading
                                            eyebrow="Entity"
                                            title={entity().name}
                                            subtitle={entity().quote ? `"${entity().quote}"` : undefined}
                                            titleClass="text-2xl tracking-wide"
                                        />

                                        <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                            <Panel class="p-3">
                                                <StepperTracker
                                                    label="Presence"
                                                    value={appContext?.contextValue().entityPresence ?? 0}
                                                    max={20}
                                                    onChange={(entityPresence) => updateGameSheetValue({ entityPresence })}
                                                />
                                                <div class="mt-3 border-t border-zinc-800 pt-3 text-center">
                                                    <p class="text-xs uppercase tracking-[0.18em] text-zinc-600">
                                                        Starting Value
                                                    </p>
                                                    <p class="mt-2 text-sm leading-relaxed text-zinc-300">
                                                        {entity().presenceRule}
                                                    </p>
                                                </div>
                                            </Panel>

                                            <Show when={entity().uniqueResource}>
                                                {(uniqueResource) => (
                                                    <Panel class="p-3">
                                                        <StepperTracker
                                                            label={uniqueResource()}
                                                            value={appContext?.contextValue().entityResource ?? 0}
                                                            max={20}
                                                            onChange={(entityResource) => updateGameSheetValue({ entityResource })}
                                                        />
                                                    </Panel>
                                                )}
                                            </Show>
                                        </div>

                                        <RuleCard label="Doom Rule">
                                            {entity().doom_rule}
                                        </RuleCard>
                                    </Panel>

                                    <div class="grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)]">
                                        <EntityReferenceList
                                            title="Modifiers"
                                            items={entity().first_draft_actions}
                                        />
                                        <EntityReferenceList
                                            title="Moves"
                                            items={entity().second_draft_actions}
                                        />
                                    </div>
                                </>
                            )}
                        </Show>
                    </Show>

                    <Show when={currentStep().kind === "Encounter"}>
                        <Panel as="section" class="grid gap-3 p-3">
                            <RuleCard label={`Encounter - ${currentEncounter()?.name ?? "Unknown Encounter"}`}>
                                {currentEncounter()?.rule}
                            </RuleCard>
                            <RuleCard label="Arcana">
                                {lookup_arcana_for_card(currentCard()!)?.rule_face_up || lookup_arcana_for_card(currentCard()!)?.rule_face_down || "No arcana rule set for this card."}
                            </RuleCard>
                        </Panel>
                    </Show>

                    <Button
                        class="min-h-14 bg-zinc-100 text-lg uppercase tracking-[0.16em] text-zinc-950 hover:bg-zinc-300 disabled:hover:bg-zinc-100"
                        onClick={completePhase}
                    >
                        Complete {currentStep().kind}
                    </Button>
                </div>
            </Show>

            <Show when={isComplete()}>
                <Panel as="section" class="grid min-h-[24rem] place-items-center p-6 text-center">
                    <SectionHeading
                        eyebrow="Complete"
                        title="The Omen Is Set"
                        subtitle="Reset the sheet to begin another five-card draw."
                        titleClass="text-4xl tracking-wide"
                    />
                </Panel>
            </Show>

            <Show when={pendingCard() !== null}>
                <div class="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6 backdrop-blur-sm">
                    <Panel class="w-full max-w-md p-6 text-center shadow-2xl">
                        <SectionHeading
                            eyebrow={currentStep().kind}
                            title={`${number_to_numeral(pendingCard()!)} - ${MajorArcana[pendingCard()!]}`}
                            subtitle={`Confirm this as ${currentStep().title}. This cannot be changed later.`}
                            titleClass="text-2xl tracking-wide"
                        />

                        <div class="mt-6 grid grid-cols-2 gap-3">
                            <Button
                                class="min-h-12 bg-zinc-800 uppercase tracking-[0.14em] hover:bg-zinc-700"
                                onClick={() => setPendingCard(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                class="min-h-12 bg-zinc-100 uppercase tracking-[0.14em] text-zinc-950 hover:bg-zinc-300"
                                onClick={commitPendingCard}
                            >
                                Confirm
                            </Button>
                        </div>
                    </Panel>
                </div>
            </Show>
        </Page>
    );
};

export default GameSheetRoute;
