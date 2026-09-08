import type { Entity } from "../game";
import { Divider, SectionHeading } from "./ui";

export interface EntitySheetProps {
    entity: Entity | null
}

const EntitySheet = (props: EntitySheetProps) => {
    return <div class="flex flex-col gap-4">
        <SectionHeading title={props.entity?.name} />
        <div class="flex flex-row items-center gap-4 justify-center">
            <strong>PRESENCE</strong> <span>{props.entity?.presenceRule}</span>
        </div>
        <Divider />
        <div class="flex flex-col gap-2">
            <h3 class="gothic-sub-heading">FIRST DRAFT</h3>
            {props.entity?.first_draft_actions.map((action, index) => (
                <div class="flex flex-row gap-2">
                    <div class="w-8 shrink-0 tabular-nums">{action.diceRule}</div>
                    <div class="flex flex-col">
                        <p>{action.description}</p>
                    </div>
                </div>
            ))}
        </div>
        <Divider />
        <div class="flex flex-col gap-2">
            <h3 class="gothic-sub-heading">SECOND DRAFT</h3>
            {props.entity?.second_draft_actions.map((action, index) => (
                <div class="flex flex-row gap-2">
                    <div class="w-8 shrink-0 tabular-nums">{action.diceRule}</div>
                    <div class="flex flex-col">
                        <p>{action.description}</p>
                    </div>
                </div>
            ))}
        </div>
        <Divider />
        <div class="flex flex-col gap-2">
            <h3 class="gothic-sub-heading">DOOM</h3>
            <p>{props.entity?.doom_rule}</p>
        </div>
    </div>
}

export default EntitySheet;
