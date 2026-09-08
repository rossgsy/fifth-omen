import { ActionCard, Page } from "../components/ui";
import { Folio1 } from "../game";

const GrimoireListRoute = () => {
    return (
        <Page class="items-stretch">
            {Object.keys(Folio1.entities).map((_, key: number) => {
                const entity = Folio1.entities[key];
                return (
                    <ActionCard
                        href={`/grimoire/${key}`}
                        title={entity?.name}
                        class="text-center"
                    />
                );
            })}
        </Page>
    );
};

export default GrimoireListRoute;
