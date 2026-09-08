import { For, Show, createMemo, createSignal, useContext } from "solid-js";
import { Button, ConfirmDialog, Page, Panel, SectionHeading } from "../components/ui";
import { AppContext } from "../data/app";
import {
    EntityResource,
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
    showDots?: boolean;
    onChange: (value: number) => void;
}) => (
    <div class="flex flex-col gap-2 text-center">
        <p class="text-xs uppercase tracking-[0.18em] text-zinc-600">
            {props.label}
        </p>
        <div class="grid grid-cols-[2.75rem_4rem_2.75rem] items-center justify-center gap-2">
            <Button
                class="flex h-11 w-11 items-center justify-center p-0 text-3xl leading-none"
                disabled={props.value <= 0}
                onClick={() => props.onChange(clamp(props.value - 1, props.max))}
            >
                -
            </Button>
            <div class="text-center text-3xl tabular-nums leading-none text-zinc-100">
                {props.value}
            </div>
            <Button
                class="flex h-11 w-11 items-center justify-center p-0 text-3xl leading-none"
                disabled={props.value >= props.max}
                onClick={() => props.onChange(clamp(props.value + 1, props.max))}
            >
                +
            </Button>
        </div>
        <Show when={props.showDots ?? true}>
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
        </Show>
    </div>
);

const CompactStepperTracker = (props: {
    label: string;
    value: number;
    max: number;
    onChange: (value: number) => void;
}) => (
    <div class="grid grid-cols-[1fr_auto] items-center gap-3">
        <div>
            <p class="text-xs uppercase tracking-[0.18em] text-zinc-600">
                {props.label}
            </p>
            <p class="mt-1 text-4xl tabular-nums leading-none text-zinc-100">
                {props.value}
            </p>
        </div>
        <div class="grid grid-cols-2 gap-2">
            <Button
                class="flex h-11 w-11 items-center justify-center p-0 text-2xl leading-none"
                disabled={props.value <= 0}
                onClick={() => props.onChange(clamp(props.value - 1, props.max))}
            >
                -
            </Button>
            <Button
                class="flex h-11 w-11 items-center justify-center p-0 text-2xl leading-none"
                disabled={props.value >= props.max}
                onClick={() => props.onChange(clamp(props.value + 1, props.max))}
            >
                +
            </Button>
        </div>
    </div>
);

const RuleCard = (props: { label: string; children: string | undefined }) => (
    <div class="border-t border-zinc-800 pt-2 first:border-t-0 first:pt-0">
        <p class="text-xs uppercase tracking-[0.18em] text-zinc-600">
            {props.label}
        </p>
        <p class="mt-1 text-sm leading-snug text-zinc-300">
            {props.children || "No rule set."}
        </p>
    </div>
);

const ArcanaRule = (props: { isStricture?: boolean; rule: string }) => (
    <div>
        <div class="flex flex-wrap items-center gap-2">
            <Show when={props.isStricture}>
                <span class="border border-red-900 bg-red-950 px-2 py-1 text-[0.65rem] uppercase tracking-[0.16em] text-red-200">
                    Stricture
                </span>
            </Show>
            <Show when={props.isStricture}>
                <span class="text-xs leading-snug text-red-300">
                    +1 Doom when broken
                </span>
            </Show>
        </div>
        <p class={props.isStricture
            ? "mt-1 text-xs leading-relaxed text-zinc-300"
            : "mt-1 text-xs leading-relaxed text-zinc-400"}
        >
            {props.rule}
        </p>
    </div>
);

const EntityResourcePanel = (props: {
    resource: EntityResource;
    value: number;
    onChange: (value: number) => void;
}) => (
    <div class="border-l border-zinc-800 pl-2">
        <StepperTracker
            label={props.resource.name}
            value={props.value}
            max={20}
            showDots={false}
            onChange={props.onChange}
        />
        <div class="mt-2 grid gap-2 border-t border-zinc-800 pt-2">
            <div class="grid grid-cols-2 gap-2 text-center">
                <div>
                    <p class="text-xs uppercase tracking-[0.18em] text-zinc-600">
                        Starting
                    </p>
                    <p class="mt-1 text-sm leading-snug text-zinc-300">
                        {props.resource.starting || "Not set."}
                    </p>
                </div>
                <div>
                    <p class="text-xs uppercase tracking-[0.18em] text-zinc-600">
                        Max
                    </p>
                    <p class="mt-1 text-sm leading-snug text-zinc-300">
                        {props.resource.max || "Not set."}
                    </p>
                </div>
            </div>
            <RuleCard label={`${props.resource.name} Rule`}>
                {props.resource.rule}
            </RuleCard>
        </div>
    </div>
);

const EntityReferenceList = (props: {
    title: string;
    items: Array<{ diceRule: string; description: string }>;
}) => (
    <section class="border border-zinc-800 p-2">
        <p class="mb-2 text-center text-xs uppercase tracking-[0.18em] text-zinc-600">
            {props.title}
        </p>
        <div class="grid gap-2">
            <For each={props.items}>
                {(item) => (
                    <div class="grid grid-cols-[3rem_1fr] gap-2 border-t border-zinc-800 pt-2 first:border-t-0 first:pt-0">
                        <div class="gothic-sub-heading text-center text-base tabular-nums text-zinc-100">
                            {item.diceRule}
                        </div>
                        <p class="text-sm leading-snug text-zinc-300">
                            {item.description}
                        </p>
                    </div>
                )}
            </For>
        </div>
    </section>
);

const GameSheetRoute = () => {
    const appContext = useContext(AppContext);
    const [pendingCard, setPendingCard] = createSignal<number | null>(null);
    const [isCompletePhasePending, setIsCompletePhasePending] = createSignal(false);

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

    const resourceForEntity = (entity: {
        resource?: EntityResource;
        uniqueResource?: string;
    }): EntityResource | null => {
        if (entity.resource) return entity.resource;
        if (!entity.uniqueResource) return null;

        return {
            name: entity.uniqueResource,
            max: "20",
            starting: "0",
            rule: "",
        };
    };

    const activeArcana = createMemo(() => (
        [drawnCards()[1], drawnCards()[3]].map((tarotNumber, index) => {
            if (tarotNumber === null) return null;
            const arcana = lookup_arcana_for_card(tarotNumber);

            return {
                slotTitle: index === 0 ? "Second Card" : "Fourth Card",
                numeral: number_to_numeral(tarotNumber),
                cardName: MajorArcana[tarotNumber],
                isStricture: arcana?.is_stricture ?? false,
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
        setIsCompletePhasePending(false);
    };

    return (
        <Page class="gap-2 p-2">
            <div class="grid gap-2 md:grid-cols-[14rem_minmax(0,1fr)] md:items-stretch">
                <section class="border border-zinc-800 p-2">
                    <CompactStepperTracker
                        label="Global Doom"
                        value={appContext?.contextValue().globalDoom ?? 0}
                        max={10}
                        onChange={(globalDoom) => updateGameSheetValue({ globalDoom })}
                    />
                </section>

                <section class="border border-zinc-800 p-2">
                    <p class="mb-2 text-center text-xs uppercase tracking-[0.18em] text-zinc-600">
                        Active Arcana
                    </p>

                    <div class="grid gap-2 md:grid-cols-2">
                        <For each={activeArcana()} fallback={
                            <p class="self-center text-center text-sm leading-none text-zinc-500">
                                The second and fourth cards become active arcana.
                            </p>
                        }>
                            {(arcana) => (
                                <div>
                                    <p class="text-xs uppercase tracking-[0.18em] text-zinc-600">
                                        {arcana.slotTitle} / {arcana.numeral}
                                    </p>
                                    <h3 class="mt-1 gothic-sub-heading text-base text-zinc-100">
                                        {arcana.cardName}
                                    </h3>
                                    <ArcanaRule
                                        isStricture={arcana.isStricture}
                                        rule={arcana.rule}
                                    />
                                </div>
                            )}
                        </For>
                    </div>
                </section>
            </div>

            <Show when={isDrawPhase()}>
                <Panel as="section" class="grid place-items-center p-4">
                    <div class="grid w-full max-w-5xl gap-3">
                        <SectionHeading
                            eyebrow={currentStep().kind}
                            title={`Draw ${currentStep().title}`}
                            subtitle="Choose the physical tarot card drawn, then lock it in."
                            titleClass="text-2xl tracking-wide"
                        />

                        <div class="grid gap-2 md:grid-cols-5">
                            <For each={DRAW_STEPS}>
                                {(step, index) => (
                                    <div class={index() === currentPhase()
                                        ? "border border-zinc-400 bg-zinc-900 p-2 text-center"
                                        : "border border-zinc-800 bg-zinc-950/70 p-2 text-center opacity-50"}
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
                            class="mx-auto min-h-12 w-full max-w-xl border border-zinc-700 bg-zinc-950 px-4 text-lg text-zinc-100 outline-none focus:border-zinc-300"
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
                <div class="flex min-h-0 flex-col gap-2">
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
                                    <section class="grid gap-2 border border-zinc-800 p-2 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-start">
                                        <div>
                                            <SectionHeading
                                                eyebrow="Entity"
                                                title={entity().name}
                                                subtitle={entity().quote}
                                                titleClass="text-xl tracking-wide"
                                            />
                                            <RuleCard label="Doom Rule">
                                                {entity().doom_rule}
                                            </RuleCard>
                                        </div>

                                        <div class="grid gap-2">
                                            <div class="border-l border-zinc-800 pl-2">
                                                <StepperTracker
                                                    label="Presence"
                                                    value={appContext?.contextValue().entityPresence ?? 0}
                                                    max={20}
                                                    showDots={false}
                                                    onChange={(entityPresence) => updateGameSheetValue({ entityPresence })}
                                                />
                                                <div class="mt-2 border-t border-zinc-800 pt-2 text-center">
                                                    <p class="text-xs uppercase tracking-[0.18em] text-zinc-600">
                                                        Starting Value
                                                    </p>
                                                    <p class="mt-1 text-sm leading-snug text-zinc-300">
                                                        {entity().presenceRule}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <Show when={resourceForEntity(entity())}>
                                            {(resource) => (
                                                <EntityResourcePanel
                                                    resource={resource()}
                                                    value={appContext?.contextValue().entityResource ?? 0}
                                                    onChange={(entityResource) => updateGameSheetValue({ entityResource })}
                                                />
                                            )}
                                        </Show>
                                    </section>

                                    <div class="grid gap-2 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)]">
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
                        <section class="grid gap-2 border border-zinc-800 p-2">
                            <RuleCard label={`Encounter - ${currentEncounter()?.name ?? "Unknown Encounter"}`}>
                                {currentEncounter()?.rule}
                            </RuleCard>
                            <div class="border-t border-zinc-800 pt-2 first:border-t-0 first:pt-0">
                                <p class="text-xs uppercase tracking-[0.18em] text-zinc-600">
                                    Arcana
                                </p>
                                <ArcanaRule
                                    isStricture={lookup_arcana_for_card(currentCard()!)?.is_stricture}
                                    rule={lookup_arcana_for_card(currentCard()!)?.rule_face_up || lookup_arcana_for_card(currentCard()!)?.rule_face_down || "No arcana rule set for this card."}
                                />
                            </div>
                        </section>
                    </Show>

                    <Button
                        class="min-h-12 bg-zinc-100 text-base uppercase tracking-[0.16em] text-zinc-950 hover:bg-zinc-300 disabled:hover:bg-zinc-100"
                        onClick={() => setIsCompletePhasePending(true)}
                    >
                        Complete {currentStep().kind}
                    </Button>
                </div>
            </Show>

            <Show when={isComplete()}>
                <Panel as="section" class="grid min-h-[16rem] place-items-center p-4 text-center">
                    <SectionHeading
                        eyebrow="Complete"
                        title="The Omen Is Set"
                        subtitle="Reset the sheet to begin another five-card draw."
                        titleClass="text-3xl tracking-wide"
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

            <Show when={isCompletePhasePending()}>
                <ConfirmDialog
                    eyebrow={currentStep().kind}
                    title={`Complete ${currentStep().kind}?`}
                    message={`Advance past this ${currentStep().kind.toLowerCase()} and continue to the next draw step.`}
                    confirmLabel="Complete"
                    onCancel={() => setIsCompletePhasePending(false)}
                    onConfirm={completePhase}
                />
            </Show>
        </Page>
    );
};

export default GameSheetRoute;
