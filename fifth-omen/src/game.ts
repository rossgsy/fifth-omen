import folioConfig from "./config/folio.json";
import playbookConfig from "./config/playbooks.json";

export const MajorArcana = [
    "The Fool",
    "The Magician",
    "The High Priestess",
    "The Empress",
    "The Emperor",
    "The Hierophant",
    "The Lovers",
    "The Chariot",
    "Strength",
    "The Hermit",
    "Wheel of Fortune",
    "Justice",
    "The Hanged Man",
    "Death",
    "Temperance",
    "The Devil",
    "The Tower",
    "The Star",
    "The Moon",
    "The Sun",
    "Judgement",
    "The World"
]

export interface Action {
    requirement?: string;
    diceRule: string;
    name: string;
    description: string;
}

export interface Playbook {
    name: string;
    description: string;
    health: number;
    draftAbility: string;
    actions: Action[];
    progressionActions: Action[];
    progression: ProgressionStep[];
}

export interface ProgressionStep {
    tier: "I" | "II" | "III";
    left: string;
    right: string;
}

export interface EntityAction {
    diceRule: string;
    description: string;
}

export interface Entity {
    name: string;
    quote: string;
    presenceRule: string;
    resource?: EntityResource;
    uniqueResource?: string;
    first_draft_actions: EntityAction[];
    second_draft_actions: EntityAction[];
    doom_rule: string;
}

export interface EntityResource {
    name: string;
    max: string;
    starting: string;
    rule: string;
}

export interface Encounter {
    name: string;
    rule: string;
    tarot_cards: number[];
}

export interface Arcana {
    rule_face_up: string;
    rule_face_down: string;
    tarot_cards: number[];
}

export interface Folio {
    name: string;
    entities: {
        [key: number]: Entity;
    }
    encounters: {
        [key: number]: Encounter;
    },
    arcanas: {
        [key: number]: Arcana;
    }
}

export const playbooks = playbookConfig as Playbook[];

export const Folio1 = folioConfig as Folio;

// used to lookup the major arcana
export const numeral_to_number: (value: string) => number = (value) => {
    let ucase_value = value.toUpperCase();

    const map: { [key: string]: number } = {
        "0": 0,
        "I": 1,
        "II": 2,
        "III": 3,
        "IV": 4,
        "V": 5,
        "VI": 6,
        "VII": 7,
        "VIII": 8,
        "IX": 9,
        "X": 10,
        "XI": 11,
        "XII": 12,
        "XIII": 13,
        "XIV": 14,
        "XV": 15,
        "XVI": 16,
        "XVII": 17,
        "XVIII": 18,
        "XIX": 19,
        "XX": 20,
        "XXI": 21,
        "XXII": 22
    };
    return map[ucase_value];
};

export const number_to_numeral = (value: number) => {
    const numerals = [
        "0",
        "I",
        "II",
        "III",
        "IV",
        "V",
        "VI",
        "VII",
        "VIII",
        "IX",
        "X",
        "XI",
        "XII",
        "XIII",
        "XIV",
        "XV",
        "XVI",
        "XVII",
        "XVIII",
        "XIX",
        "XX",
        "XXI",
    ];

    return numerals[value] ?? value.toString();
};


export const lookup_arcana_for_card = (id: number) => {
    let values = Object.values(Folio1.arcanas).filter(arcana => arcana.tarot_cards.includes(id));
    return values.length > 0 ? values[0] : null;
}

export const lookup_encounter_for_card = (id: number) : Encounter | null => {
    let values = Object.values(Folio1.encounters).filter(encounter => encounter.tarot_cards.includes(id));
    return values.length > 0 ? values[0] : null;
}

export const lookup_entity_for_card = (id: number) : Entity | null => {
    const entityKey = lookup_entity_key_for_card(id);
    return entityKey !== null ? Folio1.entities[entityKey] : null;
}

export const lookup_entity_key_for_card = (id: number): number | null => {
    const entityKeys = Object.keys(Folio1.entities);
    if (entityKeys.length === 0) return null;

    return Number(entityKeys[id % entityKeys.length]);
}
