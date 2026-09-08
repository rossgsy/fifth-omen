import { ActionCard, Page } from "../components/ui";

const HomeRoute = () => {
    return <Page class="justify-center">
        <ActionCard href="/playbook" title="Playbook" class="text-center" />
        <ActionCard href="/game-sheet" title="Game Sheet" class="text-center" />
    </Page>;
}

export default HomeRoute;
