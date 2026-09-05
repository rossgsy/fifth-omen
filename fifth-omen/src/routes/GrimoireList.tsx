import { createSignal } from "solid-js";
import { Folio1 } from "../game";

const GrimoireListRoute = () => {
    const [folio, setFolio] = createSignal(Folio1);

    return (
        <div class="flex flex-col gap-4 items-stretch p-4">
            {Object.keys(folio().entities).map((_, key: number) => {
                const entity = folio().entities[key];
                return (
                    <a href={`/grimoire/${key}`} class="gothic-sub-heading text-xl text-center p-4 border rounded-md text-center">{entity?.name}</a>
                );
            })}
        </div>
    );
};

export default GrimoireListRoute;