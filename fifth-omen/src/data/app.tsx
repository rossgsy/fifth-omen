import { createContext, createSignal, JSX, Accessor } from "solid-js";

export interface AppContextStore {
    contextValue: Accessor<AppContextValue>;
    setContextValue: (value: AppContextValue) => void;
    setSlotCard: (slotId: number, tarotNumber: number | null) => void;
}

export const AppContext = createContext<AppContextStore>();

export interface AppContextValue {
    selectedPlaybook: number | null;
    playerHealth: number;
    playerProgressionChoices: Array<"left" | "right" | null>;
    entityPresence: number;
    entityResource: number;
    globalDoom: number;
    globalWard: number;
    activeArcanaCards: Array<number | null>;
    activeEntityCard: number | null;
    activeEntity: number | null;
    drawnTarotCards: Array<number | null>;
    currentPhase: number;
    tarotSlots: TarotSlot[];
    deviceMode: "player" | "gamesheet" | null;
    gameScreenConnection: GameScreenConnection;
    playerConnection: PlayerConnection;
    roomState: RoomState | null;
}

export type GameScreenConnectionStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

export interface GameScreenConnection {
    endpointUrl: string;
    roomCode: string;
    pin: string;
    reconnectToken: string;
    status: GameScreenConnectionStatus;
    error: string | null;
}

export interface PlayerConnection {
    endpointUrl: string;
    roomCode: string;
    pin: string;
    name: string;
    reconnectToken: string;
    seat: number | null;
    classId: number | null;
    status: GameScreenConnectionStatus;
    error: string | null;
}

export interface RoomState {
    code: string;
    maxSeats: number;
    phase?: "setup" | "playing";
    ritual?: RitualState;
    gameScreens: number;
    global: {
        doom: number;
        ward: number;
    };
    players: Array<{
        seat: number;
        deviceId: string;
        name: string;
        classId?: number;
        playbookId?: number;
        connected: boolean;
    }>;
}

export interface RitualState {
    phase: "ritual" | "entity" | "encounter" | "complete";
    currentStep: number;
    currentPlayerSeat?: number;
    steps: Array<{
        title: string;
        kind: "Entity" | "Encounter";
    }>;
    drawnCards: Array<{
        step: number;
        tarotNumber: number | null;
        resolved: boolean;
        kind: "Entity" | "Encounter";
    }>;
}

export interface TarotSlot {
    title: string;
    slotId: number;
    slotType: "Encounter" | "Entity" ;
    tarotNumber: number | null;
}

export interface AppContextProviderProps {
    children: JSX.Element | JSX.Element[];
}

const ROOM_ID_STORAGE_KEY = "room_id";
const PLAYER_NAME_STORAGE_KEY = "player_name";
const PLAYER_RECONNECT_TOKEN_STORAGE_KEY = "player_reconnect_token";
const PLAYER_SEAT_STORAGE_KEY = "player_seat";
const GAME_SCREEN_RECONNECT_TOKEN_STORAGE_KEY = "game_screen_reconnect_token";

const readRoomID = () => window.localStorage.getItem(ROOM_ID_STORAGE_KEY) ?? "";
const readPlayerName = () => window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY) ?? "";
const readPlayerReconnectToken = () => window.localStorage.getItem(PLAYER_RECONNECT_TOKEN_STORAGE_KEY) ?? "";
const readGameScreenReconnectToken = () => window.localStorage.getItem(GAME_SCREEN_RECONNECT_TOKEN_STORAGE_KEY) ?? "";
const readPlayerSeat = () => {
    const value = window.localStorage.getItem(PLAYER_SEAT_STORAGE_KEY);
    if (value === null) return null;
    const seat = Number(value);
    return Number.isInteger(seat) && seat >= 0 ? seat : null;
};

const persistAllowedState = (value: AppContextValue) => {
    window.localStorage.removeItem("appContext");
    window.localStorage.removeItem("selected_sheet");

    const roomID = value.playerConnection.roomCode || value.gameScreenConnection.roomCode || value.roomState?.code || "";
    if (roomID) {
        window.localStorage.setItem(ROOM_ID_STORAGE_KEY, roomID);
    } else {
        window.localStorage.removeItem(ROOM_ID_STORAGE_KEY);
    }

    const playerName = value.playerConnection.name.trim();
    if (playerName) {
        window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, playerName);
    } else {
        window.localStorage.removeItem(PLAYER_NAME_STORAGE_KEY);
    }

    const playerReconnectToken = value.playerConnection.reconnectToken.trim();
    if (playerReconnectToken) {
        window.localStorage.setItem(PLAYER_RECONNECT_TOKEN_STORAGE_KEY, playerReconnectToken);
    } else {
        window.localStorage.removeItem(PLAYER_RECONNECT_TOKEN_STORAGE_KEY);
    }

    if (typeof value.playerConnection.seat === "number") {
        window.localStorage.setItem(PLAYER_SEAT_STORAGE_KEY, String(value.playerConnection.seat));
    } else {
        window.localStorage.removeItem(PLAYER_SEAT_STORAGE_KEY);
    }

    const gameScreenReconnectToken = value.gameScreenConnection.reconnectToken.trim();
    if (gameScreenReconnectToken) {
        window.localStorage.setItem(GAME_SCREEN_RECONNECT_TOKEN_STORAGE_KEY, gameScreenReconnectToken);
    } else {
        window.localStorage.removeItem(GAME_SCREEN_RECONNECT_TOKEN_STORAGE_KEY);
    }
};

const AppContextProvider = (props: AppContextProviderProps) => {
    window.localStorage.removeItem("appContext");
    window.localStorage.removeItem("selected_sheet");
    const storedRoomID = readRoomID();
    const storedPlayerName = readPlayerName();
    const storedPlayerReconnectToken = readPlayerReconnectToken();
    const storedPlayerSeat = readPlayerSeat();
    const storedGameScreenReconnectToken = readGameScreenReconnectToken();
    let initialContext: AppContextValue = {
        selectedPlaybook: null,
        playerHealth: 0,
        playerProgressionChoices: [null, null, null],
        entityPresence: 0,
        entityResource: 0,
        globalDoom: 0,
        globalWard: 0,
        activeArcanaCards: [null, null],
        activeEntityCard: null,
        activeEntity: null,
        drawnTarotCards: [null, null, null, null, null],
        currentPhase: 0,
        deviceMode: null,
        gameScreenConnection: {
            endpointUrl: "",
            roomCode: storedRoomID,
            pin: "",
            reconnectToken: storedGameScreenReconnectToken,
            status: "idle",
            error: null,
        },
        playerConnection: {
            endpointUrl: "",
            roomCode: storedRoomID,
            pin: "",
            name: storedPlayerName,
            reconnectToken: storedPlayerReconnectToken,
            seat: storedPlayerSeat,
            classId: null,
            status: "idle",
            error: null,
        },
        roomState: null,
        tarotSlots: [
            {
                slotId: 0,
                title: "First Card",
                slotType: "Entity",
                tarotNumber: null
            },
            {
                slotId: 1,
                title: "Second Card",
                slotType: "Encounter",
                tarotNumber: null
            },
            {
                slotId: 2,
                title: "Third Card",
                slotType: "Entity",
                tarotNumber: null
            },
            {
                slotId: 3,
                title: "Fourth Card",
                slotType: "Encounter",
                tarotNumber: null
            },
            {
                slotId: 4,
                title: "Final Card",
                slotType: "Entity",
                tarotNumber: null
            }
        ]
    };

    const [contextValue, setContextValue] = createSignal<AppContextValue>(initialContext);

    return <AppContext.Provider value={{
        contextValue: contextValue,
        setContextValue: (value) => {
            persistAllowedState(value);
            setContextValue(value);
        },
        setSlotCard: (slotId, tarotNumber) => {
            const newValue = {
                ...contextValue(),
                tarotSlots: contextValue().tarotSlots.map(slot => slot.slotId === slotId ? { ...slot, tarotNumber } : slot)
            };
            persistAllowedState(newValue);
            setContextValue(newValue);
        }
    }}>{props.children}</AppContext.Provider>
};

export default AppContextProvider;
