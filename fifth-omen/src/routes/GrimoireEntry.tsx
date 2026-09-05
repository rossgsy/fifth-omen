import { useParams } from "@solidjs/router";
import { Folio1 } from "../game";

const GrimoireEntryRoute = () => {
    const params = useParams();
    let id = (Number)(params.id);

    const entity = Folio1.entities[id]

    return (
        <div class="flex flex-col gap-2 items-stretch p-4">
            <h2 class="gothic-sub-heading text-2xl text-center">{entity?.name}</h2>
        </div>
    );
};

export default GrimoireEntryRoute;