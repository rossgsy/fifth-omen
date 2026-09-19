import { For, Match, Show, Switch, createEffect, createMemo, createSignal, useContext } from "solid-js";
import { Icon } from "@iconify-icon/solid";
import { AppContext } from "../data/app";
import PlaybookComponent from "../components/Playbook";
import { playbooks } from "../game";
import { Button, Page, Panel, SectionHeading } from "../components/ui";

const PlaybookRoute = () => {
    const appContext = useContext(AppContext);
    const [pendingPlaybook, setPendingPlaybook] = createSignal<number | null>(null);
    const selectedSeat = () => appContext?.contextValue().playerConnection.seat ?? null;
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

        appContext.setContextValue({
            ...appContext.contextValue(),
            selectedPlaybook: pendingPlaybook(),
            playerHealth: playbook.health,
            playerProgressionChoices: [null, null, null],
            playerConnection: {
                ...appContext.contextValue().playerConnection,
                classId: pendingPlaybook(),
                error: null,
            },
        });
        window.dispatchEvent(new CustomEvent("fifth-omen:select-class", {
            detail: { classId: pendingPlaybook() },
        }));
        setPendingPlaybook(null);
    };

    const selectSeat = (seat: number) => {
        if (!appContext) return;
        appContext.setContextValue({
            ...appContext.contextValue(),
            selectedPlaybook: null,
            playerConnection: {
                ...appContext.contextValue().playerConnection,
                seat,
                classId: null,
                error: null,
            },
        });
        window.dispatchEvent(new CustomEvent("fifth-omen:select-seat", {
            detail: { seat },
        }));
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
