import { For, Match, Show, Switch, createMemo, createSignal, useContext } from "solid-js";
import { Icon } from "@iconify-icon/solid";
import { AppContext } from "../data/app";
import { Playbook, Action, ProgressionStep } from "../game";
import { Button, ConfirmDialog, Page, Panel, SectionHeading } from "./ui";

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

type HealthTrackerProps = {
    max: number;
    onChange?: (value: number) => void;
};

export function HealthTracker(props: HealthTrackerProps) {
    const appContext = useContext(AppContext);
    const value = () => appContext?.contextValue()?.playerHealth ?? 0;

    const update = (value: number) => {
        const next = Math.max(0, Math.min(props.max, value));
        appContext?.setContextValue({ ...appContext.contextValue(), playerHealth: next });
        props.onChange?.(next);
    };

    return (
        <div class="flex flex-col gap-2 text-center">
            <p class="text-xs uppercase tracking-[0.18em] text-zinc-600">
                Health
            </p>
            <div class="grid grid-cols-[2.75rem_4rem_2.75rem] items-center justify-center gap-2">
                <Button
                    class="flex h-11 w-11 items-center justify-center p-0 text-3xl leading-none"
                    disabled={value() <= 0}
                    onClick={() => update(clamp(value() - 1, props.max))}
                >
                    -
                </Button>
                <div class="text-center text-3xl tabular-nums leading-none text-zinc-100">
                    {value()}
                </div>
                <Button
                    class="flex h-11 w-11 items-center justify-center p-0 text-3xl leading-none"
                    disabled={value() >= props.max}
                    onClick={() => update(clamp(value() + 1, props.max))}
                >
                    +
                </Button>
            </div>
            <div class="flex min-h-8 flex-wrap justify-center gap-0.5 text-base text-zinc-200">
                <For each={Array.from({ length: props.max }, (_, i) => i + 1)}>
                    {(hp) => {
                        const filled = () => hp <= value();
                        return (
                            <button
                                type="button"
                                aria-label={`Set health to ${hp}`}
                                onClick={() => update(hp === value() ? hp - 1 : hp)}
                                class={filled() ? "h-6 w-6 opacity-100" : "h-6 w-6 opacity-30"}
                            >
                                {filled() ? "●" : "○"}
                            </button>
                        );
                    }}
                </For>
            </div>
        </div>
    );
}


const PlaybookActionComponent = (props: { action: Action; locked?: boolean }) => {
    return <div class={props.locked
        ? "grid grid-cols-[4rem_1fr] gap-2 border-t border-zinc-800 pt-2 opacity-40 first:border-t-0 first:pt-0"
        : "grid grid-cols-[4rem_1fr] gap-2 border-t border-zinc-800 pt-2 first:border-t-0 first:pt-0"}
    >
        <div class="gothic-sub-heading text-center text-base tabular-nums text-zinc-100">{props.action.diceRule}</div>
        <div class="min-w-0">
            <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <p class="text-sm font-bold text-zinc-100">{props.action.name}</p>
                <Show when={props.action.requirement}>
                    <p class="text-[0.65rem] uppercase tracking-[0.16em] text-zinc-600">{props.action.requirement}</p>
                </Show>
            </div>
            <p class="mt-1 text-sm leading-snug text-zinc-300">{props.action.description}</p>
        </div>
    </div>;
};

const TabButton = (props: {
    label: string;
    active: boolean;
    onClick: () => void;
}) => (
    <button
        type="button"
        onClick={props.onClick}
        class={props.active
            ? "min-h-11 border border-zinc-500 bg-zinc-900 px-3 text-xs uppercase tracking-[0.14em] text-zinc-100"
            : "min-h-11 border border-zinc-800 bg-zinc-950 px-3 text-xs uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-200"}
    >
        {props.label}
    </button>
);

const ProgressionChoice = (props: {
    step: ProgressionStep;
    side: "left" | "right";
    selected: boolean;
    locked: boolean;
    onSelect: () => void;
}) => (
    <button
        type="button"
        disabled={props.locked}
        onClick={props.onSelect}
        class={props.selected
            ? "min-h-24 border border-zinc-300 bg-zinc-100 p-3 text-left text-zinc-950"
            : props.locked
                ? "min-h-24 border border-zinc-900 bg-zinc-950 p-3 text-left text-zinc-700"
                : "min-h-24 border border-zinc-800 bg-zinc-950 p-3 text-left text-zinc-300 transition-colors hover:border-zinc-500 hover:bg-zinc-900"}
    >
        <p class={props.selected
            ? "text-xs uppercase tracking-[0.18em] text-zinc-600"
            : "text-xs uppercase tracking-[0.18em] text-zinc-600"}
        >
            {props.side}
        </p>
        <p class="mt-2 text-sm leading-snug">
            {props.step[props.side].trim() || "Unavailable"}
        </p>
    </button>
);

type PlayerSheetTab = "actions" | "draft" | "progression";
type ProgressionSide = "left" | "right";

const hasProgressionOption = (step: ProgressionStep, side: ProgressionSide) => (
    step[side].trim().length > 0
);

const RULE_KEY = [
    { symbol: "○", meaning: "An even die." },
    { symbol: "●", meaning: "An odd die." },
    { symbol: "L", meaning: "Your left drafted die." },
    { symbol: "R", meaning: "Your right drafted die." },
    { symbol: "Σ", meaning: "The total of your drafted dice." },
    { symbol: "< > =", meaning: "Compare the listed dice or totals." },
    { symbol: "≤ ≥", meaning: "Less than or equal to / greater than or equal to." },
    { symbol: "↻", meaning: "Action may not be used two turns in a row." },
];

const RuleKeyModal = (props: { onClose: () => void }) => (
    <div
        class="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6 backdrop-blur-sm"
        onClick={props.onClose}
    >
        <Panel
            class="w-full max-w-md p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
        >
            <div class="flex items-start justify-between gap-4">
                <SectionHeading
                    eyebrow="Actions"
                    title="Rule Key"
                    titleClass="text-2xl tracking-wide"
                    class="items-start text-left"
                />
                <button
                    type="button"
                    aria-label="Close rule key"
                    title="Close"
                    onClick={props.onClose}
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-zinc-800 text-xl text-zinc-100 transition-colors hover:bg-zinc-700"
                >
                    <Icon icon="mdi:close" />
                </button>
            </div>

            <div class="mt-5 grid gap-2">
                <For each={RULE_KEY}>
                    {(item) => (
                        <div class="grid grid-cols-[4rem_1fr] gap-3 border-t border-zinc-800 pt-2 first:border-t-0 first:pt-0">
                            <div class="gothic-sub-heading text-center text-base tabular-nums text-zinc-100">
                                {item.symbol}
                            </div>
                            <p class="text-sm leading-snug text-zinc-300">
                                {item.meaning}
                            </p>
                        </div>
                    )}
                </For>
            </div>
        </Panel>
    </div>
);

export interface PlaybookComponentProps {
    playbook: Playbook;
}

const PlaybookComponent = (props: PlaybookComponentProps) => {
    const appContext = useContext(AppContext);
    const [activeTab, setActiveTab] = createSignal<PlayerSheetTab>("actions");
    const [isRuleKeyOpen, setIsRuleKeyOpen] = createSignal(false);
    const [pendingProgressionChoice, setPendingProgressionChoice] = createSignal<{
        tierIndex: number;
        choice: "left" | "right";
    } | null>(null);
    const progressionChoices = createMemo(() => appContext?.contextValue().playerProgressionChoices ?? [null, null, null]);
    const currentTierIndex = createMemo(() => {
        const nextOpen = progressionChoices().findIndex(choice => choice === null);
        return nextOpen === -1 ? props.playbook.progression.length - 1 : nextOpen;
    });
    const completedTiers = createMemo(() => progressionChoices().filter(Boolean).length);

    const queueProgressionChoice = (tierIndex: number, choice: ProgressionSide) => {
        const step = props.playbook.progression[tierIndex];
        if (!step || !hasProgressionOption(step, choice)) return;

        setPendingProgressionChoice({ tierIndex, choice });
    };

    const setProgressionChoice = (tierIndex: number, choice: ProgressionSide) => {
        if (!appContext || tierIndex !== currentTierIndex()) return;
        const step = props.playbook.progression[tierIndex];
        if (!step || !hasProgressionOption(step, choice)) return;

        const nextChoices = [...progressionChoices()];
        nextChoices[tierIndex] = choice;

        appContext.setContextValue({
            ...appContext.contextValue(),
            playerProgressionChoices: nextChoices,
        });
    };

    const confirmProgressionChoice = () => {
        const pendingChoice = pendingProgressionChoice();
        if (!pendingChoice) return;

        setProgressionChoice(pendingChoice.tierIndex, pendingChoice.choice);
        setPendingProgressionChoice(null);
    };

    const pendingProgressionStep = createMemo(() => {
        const pendingChoice = pendingProgressionChoice();
        return pendingChoice ? props.playbook.progression[pendingChoice.tierIndex] ?? null : null;
    });

    const pendingProgressionText = createMemo(() => {
        const pendingChoice = pendingProgressionChoice();
        const step = pendingProgressionStep();
        return pendingChoice && step ? step[pendingChoice.choice] : "";
    });

    return <Page class="gap-2 p-2">
        <section class="grid gap-2 border border-zinc-800 p-2 md:grid-cols-[minmax(0,1fr)_14rem] md:items-center">
            <SectionHeading
                eyebrow="Player"
                title={props.playbook.name}
                subtitle={props.playbook.description}
                titleClass="text-2xl tracking-wide"
            />
            <div class="border-t border-zinc-800 pt-2 md:border-l md:border-t-0 md:pl-2 md:pt-0">
                <HealthTracker max={props.playbook.health} />
            </div>
        </section>

        <div class="grid grid-cols-3 gap-2">
            <TabButton label="Actions" active={activeTab() === "actions"} onClick={() => setActiveTab("actions")} />
            <TabButton label="Draft" active={activeTab() === "draft"} onClick={() => setActiveTab("draft")} />
            <TabButton label="Progress" active={activeTab() === "progression"} onClick={() => setActiveTab("progression")} />
        </div>

        <Panel as="section" class="min-h-0 grow overflow-auto p-3">
            <Switch>
                <Match when={activeTab() === "actions"}>
                    <div class="grid gap-4 md:grid-cols-2">
                        <div class="flex items-center justify-end md:col-span-2">
                            <button
                                type="button"
                                aria-label="Open rule key"
                                title="Rule key"
                                onClick={() => setIsRuleKeyOpen(true)}
                                class="flex h-10 w-10 items-center justify-center rounded bg-zinc-800 text-xl text-zinc-100 transition-colors hover:bg-zinc-700"
                            >
                                <Icon icon="mdi:help" />
                            </button>
                        </div>

                        <section class="md:col-span-2">
                            <p class="mb-2 text-center text-xs uppercase tracking-[0.18em] text-zinc-600">
                                Progression Choices
                            </p>
                            <div class="grid gap-2 md:grid-cols-3">
                                <For each={props.playbook.progression}>
                                    {(step, index) => {
                                        const choice = () => progressionChoices()[index()] ?? null;
                                        const selectedText = () => choice() && hasProgressionOption(step, choice()!) ? step[choice()!] : "Not chosen";

                                        return (
                                            <div class={choice()
                                                ? "border border-zinc-800 bg-zinc-950 p-2"
                                                : "border border-zinc-900 bg-zinc-950/60 p-2 opacity-60"}
                                            >
                                                <div class="flex items-baseline justify-between gap-2">
                                                    <p class="text-xs uppercase tracking-[0.18em] text-zinc-600">
                                                        Tier {step.tier}
                                                    </p>
                                                    <p class="text-[0.65rem] uppercase tracking-[0.16em] text-zinc-600">
                                                        {choice() ?? "Open"}
                                                    </p>
                                                </div>
                                                <p class="mt-2 text-sm leading-snug text-zinc-300">
                                                    {selectedText()}
                                                </p>
                                            </div>
                                        );
                                    }}
                                </For>
                            </div>
                        </section>

                        <section>
                            <p class="mb-2 text-center text-xs uppercase tracking-[0.18em] text-zinc-600">
                               Base Actions
                            </p>
                            <div class="grid gap-2">
                                <For each={props.playbook.actions}>
                                    {(action) => <PlaybookActionComponent action={action} />}
                                </For>
                            </div>
                        </section>

                        <section>
                            <p class="mb-2 text-center text-xs uppercase tracking-[0.18em] text-zinc-600">
                                Tier Actions
                            </p>
                            <div class="grid gap-2">
                                <For each={props.playbook.progressionActions}>
                                    {(action, index) => (
                                        <PlaybookActionComponent
                                            action={action}
                                            locked={completedTiers() <= index()}
                                        />
                                    )}
                                </For>
                            </div>
                        </section>


                    </div>
                </Match>

                <Match when={activeTab() === "draft"}>
                    <div class="grid min-h-full place-items-center">
                        <div class="w-full max-w-2xl text-center">
                            <p class="text-xs uppercase tracking-[0.18em] text-zinc-600">
                                Draft Ability
                            </p>
                            <p class="mt-3 text-base leading-relaxed text-zinc-300">
                                {props.playbook.draftAbility}
                            </p>
                        </div>
                    </div>
                </Match>

                <Match when={activeTab() === "progression"}>
                    <div class="grid gap-2">
                        <For each={props.playbook.progression}>
                            {(step, index) => {
                                const choice = () => progressionChoices()[index()] ?? null;
                                const isCurrent = () => index() === currentTierIndex();
                                const locked = () => index() > currentTierIndex() || choice() !== null;
                                const choiceLocked = (side: ProgressionSide) => locked() || !hasProgressionOption(step, side);

                                return (
                                    <section class={isCurrent()
                                        ? "grid gap-2 border border-zinc-500 p-2 md:grid-cols-[5rem_1fr_1fr]"
                                        : "grid gap-2 border border-zinc-800 p-2 md:grid-cols-[5rem_1fr_1fr]"}
                                    >
                                        <div class="flex flex-row items-center justify-between gap-2 md:flex-col md:justify-center">
                                            <p class="text-xs uppercase tracking-[0.18em] text-zinc-600">
                                                Tier
                                            </p>
                                            <p class="gothic-sub-heading text-2xl leading-none text-zinc-100">
                                                {step.tier}
                                            </p>
                                        </div>
                                        <ProgressionChoice
                                            step={step}
                                            side="left"
                                            selected={choice() === "left"}
                                            locked={choiceLocked("left")}
                                            onSelect={() => queueProgressionChoice(index(), "left")}
                                        />
                                        <ProgressionChoice
                                            step={step}
                                            side="right"
                                            selected={choice() === "right"}
                                            locked={choiceLocked("right")}
                                            onSelect={() => queueProgressionChoice(index(), "right")}
                                        />
                                    </section>
                                );
                            }}
                        </For>
                    </div>
                </Match>
            </Switch>
        </Panel>

        <Show when={pendingProgressionChoice() && pendingProgressionStep()}>
            <ConfirmDialog
                eyebrow={`Tier ${pendingProgressionStep()!.tier} Progression`}
                title={`Choose ${pendingProgressionChoice()!.choice}?`}
                message={pendingProgressionText()}
                confirmLabel="Choose"
                onCancel={() => setPendingProgressionChoice(null)}
                onConfirm={confirmProgressionChoice}
            />
        </Show>

        <Show when={isRuleKeyOpen()}>
            <RuleKeyModal onClose={() => setIsRuleKeyOpen(false)} />
        </Show>
    </Page>;
};

export default PlaybookComponent;
