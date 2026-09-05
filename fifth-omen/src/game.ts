const MajorArcana = {
    0: "The Fool",
    1: "The Magician",
    2: "The High Priestess",
    3: "The Empress",
    4: "The Emperor",
    5: "The Hierophant",
    6: "The Lovers",
    7: "The Chariot",
    8: "Strength",
    9: "The Hermit",
    10: "Wheel of Fortune",
    11: "Justice",
    12: "The Hanged Man",
    13: "Death",
    14: "Temperance",
    15: "The Devil",
    16: "The Tower",
    17: "The Star",
    18: "The Moon",
    19: "The Sun",
    20: "Judgement",
    21: "The World",
}

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