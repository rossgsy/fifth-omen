import { For, Show, createMemo, createSignal, useContext } from "solid-js";
import { Button, Divider, Page, Panel, SectionHeading } from "../components/ui";
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
    const [drawWorkflowOpen, setDrawWorkflowOpen] = createSignal(true);

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
    const currentPhase = createMemo(() => clamp(appContext?.contextValue().currentPhase ?? 0, DRAW_STEPS.length - 1));
    const currentStep = createMemo(() => DRAW_STEPS[currentPhase()]);
    const currentCard = createMemo(() => drawnCards()[currentPhase()] ?? null);

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

    const setCurrentPhase = (phase: number) => {
        const tarotNumber = drawnCards()[phase] ?? null;
        const step = DRAW_STEPS[phase];

        updateGameSheetValue({
            currentPhase: phase,
            activeEntityCard: step.kind === "Entity" ? tarotNumber : appContext?.contextValue().activeEntityCard ?? null,
            activeEntity: step.kind === "Entity" && tarotNumber !== null ? lookup_entity_key_for_card(tarotNumber) : appContext?.contextValue().activeEntity ?? null,
        });
    };

    const setDrawnCard = (index: number, tarotNumber: number | null) => {
        const nextDrawnCards = [...drawnCards()];
        nextDrawnCards[index] = tarotNumber;

        const nextValue = {
            drawnTarotCards: nextDrawnCards,
            activeArcanaCards: [nextDrawnCards[1], nextDrawnCards[3]],
        };

        if (index === currentPhase() && DRAW_STEPS[index].kind === "Entity") {
            updateGameSheetValue({
                ...nextValue,
                activeEntityCard: tarotNumber,
                activeEntity: tarotNumber !== null ? lookup_entity_key_for_card(tarotNumber) : null,
                entityPresence: 0,
                entityResource: 0,
            });
            if (tarotNumber !== null) setDrawWorkflowOpen(false);
            return;
        }

        updateGameSheetValue(nextValue);
        if (index === currentPhase() && tarotNumber !== null) setDrawWorkflowOpen(false);
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
                                Set the second and fourth cards to reveal active arcana.
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

                <div class="grid grid-cols-3 gap-2 lg:grid-cols-1">
                    <Button
                        class="min-h-12 bg-zinc-800 text-xs uppercase tracking-[0.14em] hover:bg-zinc-700 disabled:hover:bg-zinc-800"
                        onClick={() => setDrawWorkflowOpen(true)}
                    >
                        Edit Draw
                    </Button>
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

            <Show when={drawWorkflowOpen() || currentCard() === null}>
                <Panel as="section" class="grid gap-3 p-3">
                    <SectionHeading
                        eyebrow="Draw"
                        title="Five Cards"
                        subtitle="Entity / Encounter / Entity / Encounter / Entity"
                        titleClass="text-2xl tracking-wide"
                    />

                    <div class="grid gap-2 md:grid-cols-5">
                        <For each={DRAW_STEPS}>
                            {(step, index) => (
                                <div class={index() === currentPhase()
                                    ? "grid gap-2 border border-zinc-500 bg-zinc-900 p-2"
                                    : "grid gap-2 border border-zinc-800 bg-zinc-950/70 p-2"}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setCurrentPhase(index())}
                                        class="min-h-16 text-left"
                                    >
                                        <span class="block text-xs uppercase tracking-[0.18em] text-zinc-600">
                                            {step.title}
                                        </span>
                                        <span class="block text-sm text-zinc-300">
                                            {step.kind}
                                        </span>
                                        <span class="mt-2 block gothic-sub-heading text-lg text-zinc-100">
                                            {drawnCards()[index()] !== null ? number_to_numeral(drawnCards()[index()]!) : "-"}
                                        </span>
                                    </button>

                                    <select
                                        value={drawnCards()[index()] ?? ""}
                                        onChange={(event) => {
                                            const value = event.currentTarget.value;
                                            setDrawnCard(index(), value === "" ? null : Number(value));
                                        }}
                                        class="min-h-11 min-w-0 border border-zinc-700 bg-zinc-950 px-2 text-sm text-zinc-100 outline-none focus:border-zinc-300"
                                    >
                                        <option value="">No card</option>
                                        <For each={cardOptions()}>
                                            {(option) => (
                                                <option value={option.tarotNumber}>
                                                    {option.numeral} - {option.cardName}
                                                </option>
                                            )}
                                        </For>
                                    </select>
                                </div>
                            )}
                        </For>
                    </div>
                </Panel>
            </Show>

            <div class="flex min-h-0 flex-col gap-3">
                <Panel as="section" class="p-3">
                    <SectionHeading
                        eyebrow={currentStep().kind}
                        title={currentCard() !== null ? `${number_to_numeral(currentCard()!)} - ${MajorArcana[currentCard()!]}` : currentStep().title}
                        subtitle={currentCard() === null ? "Set this physical card in the draw workflow." : undefined}
                        titleClass="text-2xl tracking-wide"
                    />
                </Panel>

                <Show when={currentStep().kind === "Entity"}>
                    <Show
                        when={currentEntity()}
                        fallback={
                            <Panel as="section" class="p-6 text-center text-zinc-500">
                                No entity card selected for this phase.
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
                    <Show
                        when={currentCard() !== null}
                        fallback={
                            <Panel as="section" class="p-6 text-center text-zinc-500">
                                No encounter card selected for this phase.
                            </Panel>
                        }
                    >
                        <Panel as="section" class="grid gap-3 p-3">
                            <RuleCard label={`Encounter - ${currentEncounter()?.name ?? "Unknown Encounter"}`}>
                                {currentEncounter()?.rule}
                            </RuleCard>
                            <RuleCard label="Arcana">
                                {lookup_arcana_for_card(currentCard()!)?.rule_face_up || lookup_arcana_for_card(currentCard()!)?.rule_face_down || "No arcana rule set for this card."}
                            </RuleCard>
                        </Panel>
                    </Show>
                </Show>
            </div>
        </Page>
    );
};

export default GameSheetRoute;
