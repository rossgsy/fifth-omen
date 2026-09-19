import { For, useContext } from "solid-js";
import { AppContext } from "../../data/app";
import { Button } from "../ui";

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
            <div class="flex min-h-6 flex-wrap justify-center gap-0.5 text-base text-zinc-200">
                <For each={Array.from({ length: props.max }, (_, i) => i + 1)}>
                    {(hp) => {
                        const filled = () => hp <= value();
                        return (
                            <div
                                aria-label={`Set health to ${hp}`}
                                class={filled() ? "h-6 w-6 opacity-100" : "h-6 w-6 opacity-30"}
                            >
                                {filled() ? "●" : "○"}
                            </div>
                        );
                    }}
                </For>
            </div>
        </div>
    );
}