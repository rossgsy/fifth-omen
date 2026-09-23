import { For, Match, Show, Switch, createEffect, createMemo, createSignal, useContext } from "solid-js";
import { Icon } from "@iconify-icon/solid";
import { AppContext } from "../data/app";
import PlaybookComponent from "../components/Playbook";
import { MajorArcana, number_to_numeral, playbooks } from "../game";
import { Button, Page, Panel, SectionHeading } from "../components/ui";
import PlayerHeader from "../components/playbook/PlayerHeader";
import PickRitualCard from "../components/playbook/Step/PickRitualCard";
import WaitingForOthers from "../components/playbook/Step/WaitingForOthers";
import { useNetwork } from "../data/network";

const clampTracker = (value: number) => Math.max(0, Math.min(10, value));

const TrackerControl = (props: {
    label: string;
    value: number;
    onChange: (value: number) => void;
}) => (
    <div class="grid grid-cols-[1fr_auto] items-center gap-3 border border-zinc-800 bg-zinc-950/70 p-3">
        <div>
            <p class="text-xs uppercase tracking-[0.18em] text-zinc-600">
                {props.label}
            </p>
            <p class="mt-1 text-3xl tabular-nums leading-none text-zinc-100">
                {props.value}
            </p>
        </div>
        <div class="grid grid-cols-2 gap-2">
            <Button
                class="flex h-10 w-10 items-center justify-center p-0 text-2xl leading-none"
                disabled={props.value <= 0}
                onClick={() => props.onChange(clampTracker(props.value - 1))}
            >
                -
            </Button>
            <Button
                class="flex h-10 w-10 items-center justify-center p-0 text-2xl leading-none"
                disabled={props.value >= 10}
                onClick={() => props.onChange(clampTracker(props.value + 1))}
            >
                +
            </Button>
        </div>
    </div>
);

const PlaybookRoute = () => {
    const appContext = useContext(AppContext);
    const network = useNetwork();
    const [pendingPlaybook, setPendingPlaybook] = createSignal<number | null>(null);
    const [pendingRitualCard, setPendingRitualCard] = createSignal<number | null>(null);
    const selectedSeat = () => appContext?.contextValue().playerConnection.seat ?? null;
    const isSetup = () => (appContext?.contextValue().roomState?.phase ?? "setup") === "setup";
    const ritual = () => appContext?.contextValue().roomState?.ritual ?? null;
    const isCurrentRitualPlayer = () => (
        appContext?.contextValue().roomState?.phase === "playing"
        && ritual()?.phase === "ritual"
        && selectedSeat() !== null
        && ritual()?.currentPlayerSeat === selectedSeat()
    );
    const isResolvingRitualPlayer = () => (
        appContext?.contextValue().roomState?.phase === "playing"
        && ritual()?.phase === "encounter"
        && selectedSeat() !== null
        && ritual()?.currentPlayerSeat === selectedSeat()
    );
    const entityMode = () => appContext?.contextValue().roomState?.entity ?? null;
    const isCurrentEntityPlayer = () => selectedSeat() !== null && entityMode()?.currentPlayerSeat === selectedSeat();
    const ownEntityHand = () => entityMode()?.hands.find((hand) => hand.seat === selectedSeat()) ?? null;
    const currentRitualStep = () => {
        const state = ritual();
        if (!state) return null;
        return state.steps[state.currentStep] ?? null;
    };
    const updateGlobalTracker = (key: "doom" | "ward", value: number) => {
        network?.setGlobalState({ [key]: value });
    };
    const GlobalTrackerControls = () => (
        <div class="grid gap-2 sm:grid-cols-2">
            <TrackerControl
                label="Doom"
                value={appContext?.contextValue().globalDoom ?? 0}
                onChange={(doom) => updateGlobalTracker("doom", doom)}
            />
            <TrackerControl
                label="Ward"
                value={appContext?.contextValue().globalWard ?? 0}
                onChange={(ward) => updateGlobalTracker("ward", ward)}
            />
        </div>
    );
    const players = () => appContext?.contextValue().roomState?.players ?? [];
    const selectedSeatSlot = createMemo(() => (
        selectedSeat() === null ? null : players().find((player) => player.seat === selectedSeat()) ?? null
    ));
    const roomSeats = createMemo(() => {
        const maxSeats = appContext?.contextValue().roomState?.maxSeats ?? 6;
        return Array.from({ length: maxSeats }, (_, seat) => {
            const slot = players().find((player) => player.seat === seat) ?? null;
            const classId = slot?.classId;
            const playbook = typeof classId === "number" ? playbooks[classId] ?? null : null;
            return {
                seat,
                slot,
                playbook,
                occupied: slot?.connected ?? false,
                label: `Seat ${seat + 1}`,
            };
        });
    });
    const claimedPlaybooks = () => new Set(
        players()
            .filter((player) => player.seat !== selectedSeat())
            .map((player) => player.classId)
            .filter((classId): classId is number => typeof classId === "number") ?? []
    );
    const isClaimedByOtherDevice = (playbookIndex: number) => (
        claimedPlaybooks().has(playbookIndex) && appContext?.contextValue().selectedPlaybook !== playbookIndex
    );

    const selectPlaybook = () => {
        if (!appContext || pendingPlaybook() === null) return;
        const playbook = playbooks[pendingPlaybook()!];
        if (!playbook) return;
        if (isClaimedByOtherDevice(pendingPlaybook()!)) return;
        network?.selectClass(pendingPlaybook()!);
        setPendingPlaybook(null);
    };

    const selectSeat = (seat: number) => {
        if (!appContext) return;
        network?.selectSeat(seat);
    };

    createEffect(() => {
        const slot = selectedSeatSlot();
        const classId = slot?.classId;
        if (!appContext || typeof classId !== "number") return;
        if (appContext.contextValue().selectedPlaybook === classId) return;
        const playbook = playbooks[classId];
        appContext.setContextValue({
            ...appContext.contextValue(),
            selectedPlaybook: classId,
            playerHealth: playbook?.health ?? appContext.contextValue().playerHealth,
            playerConnection: {
                ...appContext.contextValue().playerConnection,
                classId,
                error: null,
            },
        });
    });

    return (
        <Switch>
            <Match when={selectedSeat() === null}>
                <Page class="items-stretch justify-start gap-4">
                    <div class="grid w-full gap-4">
                        <SectionHeading
                            eyebrow="Player"
                            title="Choose a Seat"
                            subtitle="Connected seats are occupied. Open seats can be claimed."
                            titleClass="text-3xl tracking-wide sm:text-4xl"
                        />

                        <Show when={appContext?.contextValue().playerConnection.error}>
                            <p class="border border-red-900 bg-red-950 p-3 text-sm text-red-100">
                                {appContext?.contextValue().playerConnection.error}
                            </p>
                        </Show>

                        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            <For each={roomSeats()}>
                                {(seat) => (
                                    <Panel
                                        interactive={!seat.occupied}
                                        class={seat.occupied ? "aspect-square p-4 text-center opacity-40" : "aspect-square p-4 text-center"}
                                        onClick={() => {
                                            if (seat.occupied) return;
                                            selectSeat(seat.seat);
                                        }}
                                    >
                                        <div class="grid h-full content-center justify-items-center gap-2">
                                            <Icon
                                                icon={seat.playbook?.icon ?? "mdi:seat"}
                                                class="text-4xl text-zinc-100"
                                            />
                                            <p class="text-xs uppercase tracking-[0.18em] text-zinc-600">
                                                {seat.label}
                                            </p>
                                            <p class="gothic-sub-heading text-lg leading-tight text-zinc-100">
                                                {seat.playbook?.name ?? "Open"}
                                            </p>
                                            <p class="text-xs uppercase tracking-[0.16em] text-zinc-500">
                                                {seat.occupied ? "Occupied" : seat.playbook ? "Class Locked" : "Available"}
                                            </p>
                                        </div>
                                    </Panel>
                                )}
                            </For>
                        </div>
                    </div>
                </Page>
            </Match>
            <Match when={isSetup() && appContext?.contextValue()?.selectedPlaybook !== null}>
                <Page class="items-stretch justify-start gap-4">
                    <PlayerHeader
                        playbook={playbooks[appContext?.contextValue()?.selectedPlaybook!]}
                    />
                    <Show when={selectedSeat() === 0} fallback={
                        <WaitingForOthers
                            title="The Circle Gathers"
                            subtitle="Seat 1 opens the rite when the table is ready."
                            isSilent={true}
                        />
                    }>
                        <Panel as="section" class="grid min-h-[18rem] place-items-center p-6 text-center">
                            <div class="grid max-w-md gap-5">
                                <SectionHeading
                                    eyebrow="Seat 1"
                                    title="Open the Rite"
                                    subtitle="You are the active player. Begin the game, then report the card you drew."
                                    titleClass="text-3xl tracking-wide sm:text-4xl"
                                />
                                <Button
                                    class="min-h-12 bg-zinc-100 uppercase tracking-[0.16em] text-zinc-950 hover:bg-zinc-300"
                                    onClick={() => network?.beginGame()}
                                >
                                    Begin Game
                                </Button>
                            </div>
                        </Panel>
                    </Show>
                </Page>
            </Match>
            <Match when={isCurrentRitualPlayer() && appContext?.contextValue()?.selectedPlaybook !== null}>
                <Page class="items-stretch justify-center gap-4">
                    <Panel as="section" class="grid min-h-[26rem] place-items-center p-6 text-center">
                        <PlayerHeader
                            playbook={playbooks[appContext?.contextValue()?.selectedPlaybook!]}
                        />
                        <PickRitualCard />
                    </Panel>
                </Page>
            </Match>
            <Match when={ritual()?.phase === "entity" && entityMode() && appContext?.contextValue()?.selectedPlaybook !== null}>
                <Page class="items-stretch justify-center gap-4">
                    <Panel as="section" class="grid min-h-[26rem] place-items-center p-6 text-center">
                        <div class="grid w-full max-w-md gap-5">
                            <SectionHeading
                                eyebrow={`Entity turn ${entityMode()!.currentTurn}`}
                                title={entityMode()!.complete ? "Entity Defeated" : entityMode()!.phase === "drafting" ? `Draft ${entityMode()!.draftPass === 1 ? "Left Hand" : "Right Hand"}` : entityMode()!.phase === "actions" ? "Resolve Actions" : "Entity Phase"}
                                subtitle={`Presence ${entityMode()!.presence}/${entityMode()!.maxPresence}`}
                                titleClass="text-3xl tracking-wide sm:text-4xl"
                            />
                            <Show when={entityMode()!.phase === "drafting" && isCurrentEntityPlayer()} fallback={<WaitingForOthers title="Silent Draft" subtitle="Another player is choosing a die." isSilent={true} />}>
                                <div class="grid gap-2">
                                    <p class="text-sm text-zinc-400">{entityMode()!.draftingEntity ? "You are last in order: record the entity's die." : "Enter the face on the physical die you chose."} Your hand: L {ownEntityHand()?.left ?? "-"} / R {ownEntityHand()?.right ?? "-"}</p>
                                    <div class="grid grid-cols-3 gap-2">
                                        <For each={[1, 2, 3, 4, 5, 6]}>{(die) => <Button onClick={() => entityMode()!.draftingEntity ? network?.draftEntityDieForEntity(die) : network?.draftEntityDie(die)}>{die}</Button>}</For>
                                    </div>
                                </div>
                            </Show>
                            <Show when={entityMode()!.phase === "actions" && isCurrentEntityPlayer()}>
                                <div class="grid gap-2">
                                    <p class="text-sm text-zinc-400">Resolve your action, then report the Presence damage it dealt.</p>
                                    <div class="grid grid-cols-4 gap-2">
                                        <For each={[0, 1, 2, 3, 4, 5, 6]}>{(damage) => <Button disabled={damage > entityMode()!.presence} onClick={() => network?.resolveEntityPlayerAction(damage)}>{damage}</Button>}</For>
                                    </div>
                                </div>
                            </Show>
                            <Show when={entityMode()!.phase === "entity" && isCurrentEntityPlayer()}>
                                <Button onClick={() => network?.resolveEntityAction()}>Resolve Entity Action</Button>
                            </Show>
                            <Show when={entityMode()!.complete && isCurrentEntityPlayer()}>
                                <Button onClick={() => network?.resolveRitualPhase()}>Close Entity Mode</Button>
                            </Show>
                            <Show when={entityMode()!.phase !== "drafting" && !isCurrentEntityPlayer() && !entityMode()!.complete}>
                                <WaitingForOthers title="Await the Turn" subtitle="Another player is resolving the phase." isSilent={true} />
                            </Show>
                        </div>
                    </Panel>
                </Page>
            </Match>
            <Match when={isResolvingRitualPlayer() && appContext?.contextValue()?.selectedPlaybook !== null}>
                <Page class="items-stretch justify-center gap-4">
                    <Panel as="section" class="grid min-h-[26rem] place-items-center p-6 text-center">
                        <div class="grid max-w-md gap-5">
                            <SectionHeading
                                eyebrow={currentRitualStep()?.kind ?? "Ritual"}
                                title={`Resolve ${currentRitualStep()?.title ?? "the Card"}`}
                                subtitle="When the table has settled the revealed card, close this phase and pass the thread onward."
                                titleClass="text-3xl tracking-wide sm:text-4xl"
                            />
                            <Button
                                class="min-h-12 bg-zinc-100 uppercase tracking-[0.16em] text-zinc-950 hover:bg-zinc-300"
                                onClick={() => network?.resolveRitualPhase()}
                            >
                                Complete {currentRitualStep()?.kind ?? "Phase"}
                            </Button>
                            <GlobalTrackerControls />
                        </div>
                    </Panel>
                </Page>
            </Match>
            <Match when={appContext?.contextValue().roomState?.phase === "playing" && appContext?.contextValue()?.selectedPlaybook !== null && ritual()?.phase !== "complete"}>
                <WaitingForOthers 
                    title="Await the Draw"
                    subtitle="Another player is taking their turn."
                    isSilent={true}
                />
            </Match>
            <Match when={appContext?.contextValue().roomState?.phase === "playing" && appContext?.contextValue()?.selectedPlaybook !== null && ritual()?.phase === "complete"}>
                <Page class="items-stretch justify-center gap-4">
                    <Panel as="section" class="grid min-h-[26rem] place-items-center p-6 text-center">
                        <SectionHeading
                            eyebrow="Complete"
                            title="The Omen Is Set"
                            subtitle="The five cards have spoken."
                            titleClass="text-3xl tracking-wide sm:text-4xl"
                        />
                    </Panel>
                </Page>
            </Match>
            <Match when={appContext?.contextValue()?.selectedPlaybook !== null}>
                <PlaybookComponent playbook={playbooks[appContext?.contextValue()?.selectedPlaybook!]} />
            </Match>
            <Match when={appContext?.contextValue()?.selectedPlaybook === null}>
                <Page class="items-stretch justify-start gap-4">
                    <div class="grid w-full gap-4">
                        <SectionHeading
                            eyebrow="Player"
                            title="Choose a Playbook"
                            subtitle={`This choice locks Seat ${(selectedSeat() ?? 0) + 1}.`}
                            titleClass="text-3xl tracking-wide sm:text-4xl"
                        />

                        <Show when={appContext?.contextValue().playerConnection.error}>
                            <p class="border border-red-900 bg-red-950 p-3 text-sm text-red-100">
                                {appContext?.contextValue().playerConnection.error}
                            </p>
                        </Show>

                        <div class="grid gap-3">
                            <For each={playbooks}>
                                {(playbook, index) => (
                                    <Panel
                                        interactive={!isClaimedByOtherDevice(index())}
                                        class={isClaimedByOtherDevice(index()) ? "p-4 text-left opacity-40" : "p-4 text-left"}
                                        onClick={() => {
                                            if (isClaimedByOtherDevice(index())) return;
                                            setPendingPlaybook(index());
                                        }}
                                    >
                                        <div class="flex flex-wrap items-start justify-between gap-3">
                                            <p class="gothic-sub-heading text-2xl text-zinc-100">
                                                {playbook.name}
                                            </p>
                                            <Show when={isClaimedByOtherDevice(index())}>
                                                <span class="border border-zinc-800 px-2 py-1 text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
                                                    Taken
                                                </span>
                                            </Show>
                                        </div>
                                        <p class="mt-2 text-sm uppercase tracking-[0.18em] text-zinc-600">
                                            Health {playbook.health}
                                        </p>
                                        <p class="mt-3 line-clamp-4 text-sm leading-relaxed text-zinc-400">
                                            {playbook.description}
                                        </p>
                                    </Panel>
                                )}
                            </For>
                        </div>
                    </div>

                    <Show when={pendingPlaybook() !== null}>
                        <div class="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6 backdrop-blur-sm">
                            <Panel class="w-full max-w-md p-6 text-center shadow-2xl">
                                <SectionHeading
                                    eyebrow="Confirm Playbook"
                                    title={playbooks[pendingPlaybook()!]?.name}
                                    subtitle="This playbook cannot be changed without resetting this player sheet."
                                    titleClass="text-2xl tracking-wide"
                                />

                                <div class="mt-6 grid grid-cols-2 gap-3">
                                    <Button
                                        class="min-h-12 bg-zinc-800 uppercase tracking-[0.14em] hover:bg-zinc-700"
                                        onClick={() => setPendingPlaybook(null)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        class="min-h-12 bg-zinc-100 uppercase tracking-[0.14em] text-zinc-950 hover:bg-zinc-300"
                                        onClick={selectPlaybook}
                                    >
                                        Confirm
                                    </Button>
                                </div>
                            </Panel>
                        </div>
                    </Show>
                </Page>
            </Match>
        </Switch>
    );
};

export default PlaybookRoute;
