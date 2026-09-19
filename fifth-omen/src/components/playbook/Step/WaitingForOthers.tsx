import { Icon } from "@iconify-icon/solid";
import { Page, Panel, SectionHeading } from "../../ui";

export interface WaitingForOthersProps {
    title: string;
    subtitle: string;
    isSilent: boolean;
}

const WaitingForOthers = (props: WaitingForOthersProps) => {
    return (
        <Page class="items-stretch justify-center gap-4">
            <Panel as="section" class="grid min-h-[26rem] place-items-center p-6 text-center">
                <div class="grid max-w-md gap-4">
                    <SectionHeading
                        eyebrow="The Rite Is In Motion"
                        title={props.title}
                        subtitle={props.subtitle}
                        titleClass="text-3xl tracking-wide sm:text-4xl"
                    />
                    {props.isSilent && (
                        <div class="flex flex-col gap-2">
                            <Icon icon="game-icons:silenced" class="text-4xl text-zinc-600" />
                            <p class="text-sm uppercase tracking-[0.18em] text-zinc-600">
                                You must remain silent at this time
                            </p>
                        </div>
                    )}
                </div>
            </Panel>
        </Page>
    );
};

export default WaitingForOthers;