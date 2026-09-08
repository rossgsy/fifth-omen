import { For, useContext } from "solid-js";
import { AppContext } from "../data/app";
import { Playbook, Action } from "../game";
import { Divider, SectionHeading } from "./ui";

type HealthTrackerProps = {
    max: number;
    initial?: number;
    onChange?: (value: number) => void;
};

export function HealthTracker(props: HealthTrackerProps) {
    const appContext = useContext(AppContext);

    const update = (value: number) => {
        const next = Math.max(0, Math.min(props.max, value));
        appContext?.setContextValue({ ...appContext.contextValue(), playerHealth: next });
        props.onChange?.(next);
    };

    return (
        <div class="flex flex-col gap-2">
            <h3 class="gothic-sub-heading">Health</h3>
            <div class="flex flex-wrap gap-2">
                <For each={Array.from({ length: props.max }, (_, i) => i + 1)}>
                    {(hp) => {
                        const filled = () => hp <= (appContext?.contextValue()?.playerHealth ?? 0);
                        return (
                            <button
                                type="button"
                                aria-label={`Set health to ${hp}`}
                                onClick={() => update(hp === appContext?.contextValue()?.playerHealth ? hp - 1 : hp)}
                                class="
                                flex h-9 w-9 items-center justify-center
                                rounded-md border
                                text-xl leading-none
                                transition
                                active:scale-95
                                "
                                classList={{
                                    "border-current opacity-100": filled(),
                                    "border-current/30 opacity-30": !filled(),
                                }}
                            >
                                {filled() ? "♥" : "♡"}
                            </button>
                        );
                    }}
                </For>
            </div>
        </div>
    );
}


const PlaybookActionComponent = (props: { action: Action }) => {
    return <div class="flex flex-row gap-2">
        <div class="w-16 shrink-0 tabular-nums">{props.action.diceRule}</div>
        <div class="flex flex-col">
            <p><strong>{props.action.name}</strong></p>
            <p>{props.action.description}</p>
        </div>
    </div>;
};


export interface PlaybookComponentProps {
    playbook: Playbook;
}

const PlaybookComponent = (props: PlaybookComponentProps) => {
    return <div class="flex flex-col gap-4 justify-items-stretch p-4 max-w-lg">
        <SectionHeading title={props.playbook.name} />
        <Divider />
        <HealthTracker
            max={props.playbook.health}
        />
        <Divider />
        <div class="flex gap-2 flex-col">
            <h3 class="gothic-sub-heading">Draft Ability</h3>
            <p>{props.playbook.draftAbility}</p>
        </div>
        <Divider />
        <div class="flex gap-2 flex-col">
            <h3 class="gothic-sub-heading">Actions</h3>
            {props.playbook.actions.map(action => (
                <PlaybookActionComponent action={action} />
            ))}
        </div>
        <Divider />
    </div>;
};

export default PlaybookComponent;
