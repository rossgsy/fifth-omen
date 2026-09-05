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
    health: number;
    draftAbility: string;
    actions: Action[];
    progressionActions: Action[];
}

export interface ProgressionStep {
    left: string;
    right: string;
}

export interface Entity {
    name: string;
}

export interface Folio {
    name: string;
    entities: {
        [key: number]: Entity;
    }
}

export const playbooks: Playbook[] = [
    {
        name: "The Warden",
        health: 8,
        draftAbility: "immediately after another player makes their first draft, you may choose a die from the pool as that player's second die. That player may accept or refuse it. If accepted, they take it immediately and are skipped during the second draft pass.",
        actions: [
            {
                diceRule: "○",
                name: "Strike",
                description: "Deal 1 Damage."
            },
            {
                diceRule: "L ●",
                name: "Ward",
                description: "Add 2 Ward."
            },
            {
                diceRule: "R < L",
                name: "Heal",
                description: "Heal 2 Total HP."
            },
            {
                diceRule: "L = R",
                name: "Cleanse",
                description: "Remove 1 Doom."
            },
            {
                diceRule: "L > R",
                name: "Interpose ↻",
                description: "You become the target of the Entity's action if it targets a single player. Gain 1 Ward."
            },
            {
                diceRule: "Σ ≤ 6",
                name: "Bastion ↻",
                description: "Add 3 Ward."
            }
        ],
        progressionActions: []
    }
];

export const Folio1: Folio = {
    name: "The Black Parish",
    entities: {
        0: {
            name: "The Drowned Bishop"
        },
        1: {
            name: "The Salt Widow"
        },
        2: {
            name: "The Glass Prophet"
        },
        3: {
            name: "The Hollow Saint"
        },
        4: {
            name: "The Crooked King"
        },
        5: {
            name: "The Silent Child"
        }
    }
}

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