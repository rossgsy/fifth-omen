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

export interface EntityAction {
    diceRule: string;
    description: string;
}

export interface Entity {
    name: string;
    quote: string;
    presenceRule: string;
    uniqueResource?: string;
    first_draft_actions: EntityAction[];
    second_draft_actions: EntityAction[];
    doom_rule: string;
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
            name: "The Hollow Saint",
            quote: "Blessed are the hollow.",
            presenceRule: "10 + 2 per Player",
            first_draft_actions: [
                {
                    diceRule: "1-2",
                    description: "Action deals +1 damage"
                },
                {
                    diceRule: "3-4",
                    description: "If any Ward was generated this round, recover 1 Presence."
                },
                {   
                    diceRule: "5-6",
                    description: "Action also adds 1 Doom."
                }
            ],
            second_draft_actions: [
                {
                    diceRule: "1",
                    description: "2 Damage to first player."
                },
                {
                    diceRule: "2",
                    description: "Deal 3 Damage to the first player who generated Ward this round. If none did, add 1 Doom."
                },
                {
                    diceRule: "3",
                    description: "Recover 1 presence for each Ward generated this round to a maximum of 3. then add 1 Doom."
                },
                {
                    diceRule: "4",
                    description: "Recover 2 Presence and add 1 Doom."
                },
                {
                    diceRule: "5",
                    description: "Deal 3 Damage to the first player who generated no Ward this round."
                },
                {
                    diceRule: "6",
                    description: "Deal 1 Damage to every player, ignoring Ward."
                }
            ],
            doom_rule: "When Doom fills, deal 2 Damage to every player."
        },
        1: {
            name: "The Pale Mourner",
            quote: "Mourning never ends.",
            presenceRule: "10 + 2 per Player",
            first_draft_actions: [],
            second_draft_actions: [],
            doom_rule: ""
        },
        2: {
            name: "The Crooked King",
            quote: "A Twisted Monarch",
            presenceRule: "12 + 2 per Player",
            first_draft_actions: [],
            second_draft_actions: [],
            doom_rule: ""
        }
    },
    encounters: {
        0: {
            name: "The Black Well",
            rule: "Each player may choose to Take 1 Damage to heal another player 1HP AND remove 1 Doom.",
            tarot_cards: [0, 3, 5, 9, 10, 17, 18, 19, 20]
        },
        1: {
            name: "The Blood Offering",
            rule: "One player loses 2 HP. Remove 3 Doom.",
            tarot_cards: [1, 2, 4, 11, 12, 16, 21]
        },
        2: {
            name: "The Wayside Altar",
            rule: "Choose one: remove 2 Doom or each player recovers 1 HP.",
            tarot_cards: [6, 7, 8, 13, 14, 15, 22]
        }
    },
    arcanas: {
        0: {
            rule_face_up: "After the first draft pass each round, reroll the remaining dice",
            rule_face_down: "Once per round, one player may treat one drafted die as ±1 for their action only",
            tarot_cards: [12, 18]
        },
        1: {
            rule_face_up: "Two-die actions deal +1 damage",
            rule_face_down: "Single-die actions deal +1 damage",
            tarot_cards: [10]
        },
        2: {
            rule_face_up: "At the end of each round, if no player took Damage, add 1 Doom",
            rule_face_down: "At the end of each round, if at least one player took Damage, remove 1 Doom",
            tarot_cards: [19]
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
