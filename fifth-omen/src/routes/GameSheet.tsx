import { Divider, Page, Panel, SectionHeading } from "../components/ui";

const GameSheetRoute = () => {
    return (
        <Page>

            <Panel as="section" class="flex grow flex-col p-6">
                <SectionHeading
                    eyebrow="Entity"
                    title="The Hollow Saint"
                    titleClass="mt-0 text-4xl tracking-wide"
                />

                <Divider class="my-5" />

                <div class="flex grow flex-col items-center justify-center gap-6">
                    <div class="text-center">
                        <p class="text-xs uppercase tracking-[0.2em] text-zinc-600">
                            Health
                        </p>

                        <div class="mt-3 text-3xl tracking-[0.3em] text-zinc-200">
                            ● ● ● ● ○
                        </div>
                    </div>

                    <p class="max-w-xl text-center leading-relaxed text-zinc-400">
                        Entity rule or current effect goes here.
                    </p>
                </div>
            </Panel>

            <section class="grid grid-cols-2 gap-4">
                <Panel class="p-5 text-center">
                    <p class="text-xs uppercase tracking-[0.2em] text-zinc-600">
                        Doom
                    </p>

                    <div class="mt-3 text-2xl tracking-[0.25em] text-zinc-200">
                        ● ● ● ○ ○
                    </div>
                </Panel>

                <Panel class="p-5 text-center">
                    <p class="text-xs uppercase tracking-[0.2em] text-zinc-600">
                        Omen
                    </p>

                    <p class="mt-2 text-2xl text-zinc-200">
                        The Tower
                    </p>

                    <p class="mt-2 text-sm text-zinc-500">
                        First player suffers 1 damage each round.
                    </p>
                </Panel>
            </section>

            <Panel as="section" class="border-zinc-800 bg-zinc-950/60 p-4">
                <p class="mb-3 text-center text-xs uppercase tracking-[0.2em] text-zinc-600">
                    Active Effects
                </p>

                <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {/* effect cards */}
                </div>
            </Panel>

        </Page>
    );
};

export default GameSheetRoute;
