import { Icon } from "@iconify-icon/solid";
import { SectionHeading } from "../ui";
import { HealthTracker } from "./HealthTracker";
import { Playbook } from "../../game";

export interface PlayerHeaderProps {
    playbook?: Playbook;
}

const PlayerHeader = (props: PlayerHeaderProps) => {
    return (
        <section class="grid gap-2 border border-zinc-800 p-2 md:grid-cols-[minmax(0,1fr)_14rem] md:items-center">
            <div class="flex flex-col items-center justify-center gap-2 text-center">
                <div class="flex flex-row items-center gap-2">
                    <Icon icon={props.playbook?.icon ?? ""} class="text-4xl text-zinc-100" />
                    <h2 class="gothic-sub-heading text-2xl text-zinc-100">
                        {props.playbook?.name ?? ""}
                    </h2>
                </div>
                {props.playbook?.description && (
                    <p class="text-zinc-500">
                        {props.playbook?.description ?? ""}
                    </p>
                )}
            </div>

            <div class="border-t border-zinc-800 pt-2 md:border-l md:border-t-0 md:pl-2 md:pt-0">
                <HealthTracker max={props.playbook?.health ?? 0} />
            </div>
        </section>
    );
};

export default PlayerHeader;