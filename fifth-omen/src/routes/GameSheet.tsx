const GameSheetRoute = () => {
    return (
        <main class="flex min-h-0 grow flex-col gap-4 p-4">

            <section class="flex grow flex-col border border-zinc-700 bg-zinc-950 p-6">
                <p class="text-center text-xs uppercase tracking-[0.25em] text-zinc-600">
                    Entity
                </p>

                <h2 class="mt-2 text-center text-4xl tracking-wide text-zinc-100">
                    The Hollow Saint
                </h2>

                <div class="my-5 h-px bg-zinc-800" />

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
            </section>

            <section class="grid grid-cols-2 gap-4">
                <div class="border border-zinc-700 bg-zinc-950 p-5 text-center">
                    <p class="text-xs uppercase tracking-[0.2em] text-zinc-600">
                        Doom
                    </p>

                    <div class="mt-3 text-2xl tracking-[0.25em] text-zinc-200">
                        ● ● ● ○ ○
                    </div>
                </div>

                <div class="border border-zinc-700 bg-zinc-950 p-5 text-center">
                    <p class="text-xs uppercase tracking-[0.2em] text-zinc-600">
                        Omen
                    </p>

                    <p class="mt-2 text-2xl text-zinc-200">
                        The Tower
                    </p>

                    <p class="mt-2 text-sm text-zinc-500">
                        First player suffers 1 damage each round.
                    </p>
                </div>
            </section>

            <section class="border border-zinc-800 bg-zinc-950/60 p-4">
                <p class="mb-3 text-center text-xs uppercase tracking-[0.2em] text-zinc-600">
                    Active Effects
                </p>

                <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {/* effect cards */}
                </div>
            </section>

        </main>
    );
};

export default GameSheetRoute;