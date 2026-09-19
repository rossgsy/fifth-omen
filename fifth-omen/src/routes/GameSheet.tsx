import { For, Show, createMemo, useContext } from "solid-js";
import { Icon } from "@iconify-icon/solid";
import { Page, Panel, SectionHeading } from "../components/ui";
import { AppContext } from "../data/app";
import {
    EntityResource,
    Folio1,
    MajorArcana,
    lookup_arcana_for_card,
    lookup_encounter_for_card,
    lookup_entity_key_for_card,
    number_to_numeral,
    playbooks,
} from "../game";

const DRAW_STEPS: Array<{ title: string; kind: "Entity" | "Encounter" }> = [
    { title: "First Card", kind: "Entity" },
    { title: "Second Card", kind: "Encounter" },
    { title: "Third Card", kind: "Entity" },
    { title: "Fourth Card", kind: "Encounter" },
    { title: "Final Card", kind: "Entity" },
];

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

const DisplayTracker = (props: {
    label: string;
    value: number;
    max: number;
    showDots?: boolean;
}) => (
    <div class="flex flex-col gap-2 text-center">
        <p class="text-xs uppercase tracking-[0.18em] text-zinc-600">
            {props.label}
        </p>
        <div class="text-center text-3xl tabular-nums leading-none text-zinc-100">
            {props.value}
        </div>
        <Show when={props.showDots ?? true}>
            <div class="flex min-h-8 flex-wrap justify-center gap-0.5 text-base text-zinc-200">
                <For each={Array.from({ length: props.max }, (_, index) => index)}>
                    {(index) => (
                        <span class={index < props.value ? "h-6 w-6 opacity-100" : "h-6 w-6 opacity-30"}>
                            {index < props.value ? "●" : "○"}
                        </span>
                    )}
                </For>
            </div>
        </Show>
    </div>
);

const CompactDisplayTracker = (props: {
    label: string;
    value: number;
}) => (
    <div>
        <p class="text-xs uppercase tracking-[0.18em] text-zinc-600">
            {props.label}
        </p>
        <p class="mt-1 text-4xl tabular-nums leading-none text-zinc-100">
            {props.value}
        </p>
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
}) => (
    <div class="border-l border-zinc-800 pl-2">
        <DisplayTracker
            label={props.resource.name}
            value={props.value}
            max={20}
            showDots={false}
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

const PlayerRoster = () => {
    const appContext = useContext(AppContext);
    const players = createMemo(() => appContext?.contextValue().roomState?.players ?? []);
    const currentRitualPlayerSeat = createMemo(() => appContext?.contextValue().roomState?.ritual?.currentPlayerSeat ?? null);
    const seats = createMemo(() => {
        const maxSeats = appContext?.contextValue().roomState?.maxSeats ?? 6;
        return Array.from({ length: maxSeats }, (_, seat) => {
            const player = players().find((item) => item.seat === seat) ?? null;
            const playbookId = player?.playbookId ?? player?.classId;
            const playbook = typeof playbookId === "number" ? playbooks[playbookId] ?? null : null;
            return { seat, player, playbook };
        });
    });

    return (
        <aside class="grid content-start gap-2 border border-zinc-800 p-2">
            <p class="text-center text-xs uppercase tracking-[0.18em] text-zinc-600">
                Seats
            </p>
            <div class="grid gap-2">
                <For each={seats()}>
                    {(seat) => {
                        const player = () => seat.player;
                        const playbook = () => seat.playbook;
                        const seatLabel = () => `Seat ${seat.seat + 1}`;
                        const icon = () => playbook()?.icon || "mdi:seat";
                        const subtext = () => {
                            const playerName = player()?.name?.trim();
                            if (playerName) return `${playerName}`;
                            return seatLabel();
                        };

                        return (
                            <div class={currentRitualPlayerSeat() === seat.seat
                                ? "grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-2 border border-zinc-300 bg-zinc-900 p-2"
                                : player()?.connected
                                    ? "grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-2 border border-zinc-700 bg-zinc-950 p-2"
                                    : "grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-2 border border-zinc-800 bg-zinc-950/70 p-2 opacity-60"}
                            >
                                <Icon icon={icon()} class="text-xl text-zinc-100" />
                                <div class="min-w-0">
                                    <div class="flex min-w-0 items-baseline justify-between gap-2">
                                        <p class="min-w-0 truncate text-xs font-semibold leading-tight text-zinc-100">
                                            {playbook()?.name ?? "Open"}
                                        </p>
                                    </div>
                                    <p class="mt-0.5 truncate text-[0.6rem] uppercase leading-tight tracking-[0.08em] text-zinc-600">
                                        {subtext()}
                                    </p>
                                </div>
                            </div>
                        );
                    }}
                </For>
            </div>
        </aside>
    );
};

const GameSheetRoute = () => {
    const appContext = useContext(AppContext);
    const phase = createMemo(() => appContext?.contextValue().roomState?.phase ?? "setup");

    const drawnCards = createMemo(() => appContext?.contextValue().drawnTarotCards ?? [null, null, null, null, null]);
    const ritual = createMemo(() => appContext?.contextValue().roomState?.ritual ?? null);
    const ritualSteps = createMemo(() => ritual()?.steps?.length ? ritual()!.steps : DRAW_STEPS);
    const currentRitualPlayer = createMemo(() => {
        const seat = ritual()?.currentPlayerSeat;
        if (typeof seat !== "number") return null;
        return appContext?.contextValue().roomState?.players.find((player) => player.seat === seat) ?? null;
    });
    const currentPhase = createMemo(() => Math.min(ritual()?.currentStep ?? appContext?.contextValue().currentPhase ?? 0, ritualSteps().length));
    const isComplete = createMemo(() => (ritual()?.phase === "complete") || currentPhase() >= ritualSteps().length);
    const currentStep = createMemo(() => ritualSteps()[clamp(currentPhase(), ritualSteps().length - 1)]);
    const currentCard = createMemo(() => isComplete() ? null : drawnCards()[currentPhase()] ?? null);
    const isDrawPhase = createMemo(() => !isComplete() && (ritual()?.phase ?? "ritual") === "ritual" && currentCard() === null);

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

    return (
        <Page class="gap-2 p-2">
            <div class="grid min-h-0 grow gap-2 md:grid-cols-[9.5rem_minmax(0,1fr)]">
                <PlayerRoster />
                <div class="flex min-h-0 flex-col gap-2">
                    <Show when={phase() === "setup"}>
                        <Panel as="section" class="grid min-h-[28rem] grow place-items-center p-6 text-center">
                            <div class="grid max-w-2xl gap-5">
                                <SectionHeading
                                    eyebrow="The Table Is Veiled"
                                    title="Waiting to Begin"
                                    subtitle="The circle is not yet sealed. Let each vessel take a seat, then the first candle may open the omen."
                                    titleClass="text-4xl tracking-wide sm:text-5xl"
                                />
                                <div class="mx-auto flex items-center gap-3 text-zinc-700">
                                    <div class="h-px w-16 bg-zinc-800" />
                                    <span class="text-xl">✦</span>
                                    <div class="h-px w-16 bg-zinc-800" />
                                </div>
                            </div>
                        </Panel>
                    </Show>
                    <Show when={phase() !== "setup"}>
                    <div class="grid gap-2 md:grid-cols-[14rem_14rem_minmax(0,1fr)] md:items-stretch">
                <section class="border border-zinc-800 p-2">
                    <CompactDisplayTracker
                        label="Doom"
                        value={appContext?.contextValue().globalDoom ?? 0}
                    />
                </section>
                <section class="border border-zinc-800 p-2">
                    <CompactDisplayTracker
                        label="Ward"
                        value={appContext?.contextValue().globalWard ?? 0}
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
                            subtitle={`${currentRitualPlayer()?.name || `Seat ${(ritual()?.currentPlayerSeat ?? 0) + 1}`} reveals the next card from their device.`}
                            titleClass="text-2xl tracking-wide"
                        />

                        <div class="grid gap-2 md:grid-cols-5">
                            <For each={ritualSteps()}>
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

                        <p class="text-center text-sm uppercase tracking-[0.18em] text-zinc-600">
                            Awaiting player input
                        </p>
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
                                                <DisplayTracker
                                                    label="Presence"
                                                    value={appContext?.contextValue().entityPresence ?? 0}
                                                    max={20}
                                                    showDots={false}
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

                    <Panel as="section" class="p-3 text-center text-sm uppercase tracking-[0.18em] text-zinc-600">
                        Awaiting player resolution
                    </Panel>
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
                    </Show>
                </div>
            </div>
        </Page>
    );
};

export default GameSheetRoute;
