import { createContext, createSignal, JSX, Accessor } from "solid-js";
import { playbooks } from "../game";

export interface AppContextStore {
    contextValue: Accessor<AppContextValue>;
    setContextValue: (value: AppContextValue) => void;
    setSlotCard: (slotId: number, tarotNumber: number | null) => void;
    setDeviceMode: (mode: "player" | "gamesheet" | null) => void;
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
    classId: number | null;
    status: GameScreenConnectionStatus;
    error: string | null;
}

export interface RoomState {
    code: string;
    maxSeats: number;
    gameScreens: number;
    players: Array<{
        seat: number;
        deviceId: string;
        classId?: number;
        connected: boolean;
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
const SELECTED_SHEET_STORAGE_KEY = "selected_sheet";

const readSelectedSheet = () => {
    const value = window.localStorage.getItem(SELECTED_SHEET_STORAGE_KEY);
    if (value === null || value === "") return null;

    const parsed = Number(value);
    return Number.isInteger(parsed) && playbooks[parsed] ? parsed : null;
};

const readRoomID = () => window.localStorage.getItem(ROOM_ID_STORAGE_KEY) ?? "";

const persistAllowedState = (value: AppContextValue) => {
    window.localStorage.removeItem("appContext");

    const roomID = value.playerConnection.roomCode || value.gameScreenConnection.roomCode || value.roomState?.code || "";
    if (roomID) {
        window.localStorage.setItem(ROOM_ID_STORAGE_KEY, roomID);
    } else {
        window.localStorage.removeItem(ROOM_ID_STORAGE_KEY);
    }

    if (value.selectedPlaybook !== null) {
        window.localStorage.setItem(SELECTED_SHEET_STORAGE_KEY, String(value.selectedPlaybook));
    } else {
        window.localStorage.removeItem(SELECTED_SHEET_STORAGE_KEY);
    }
};

const AppContextProvider = (props: AppContextProviderProps) => {
    window.localStorage.removeItem("appContext");
    const storedRoomID = readRoomID();
    const storedSelectedSheet = readSelectedSheet();
    let initialContext: AppContextValue = {
        selectedPlaybook: storedSelectedSheet,
        playerHealth: storedSelectedSheet !== null ? playbooks[storedSelectedSheet]?.health ?? 0 : 0,
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
            roomCode: "",
            pin: "",
            reconnectToken: "",
            status: "idle",
            error: null,
        },
        playerConnection: {
            endpointUrl: "",
            roomCode: storedRoomID,
            pin: "",
            classId: storedSelectedSheet,
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
        },
        setDeviceMode: (mode) => {
            console.log("Setting device mode to", mode);
            const newValue = {
                ...contextValue(),
                deviceMode: mode
            };
            persistAllowedState(newValue);
            setContextValue(newValue);
        }
    }}>{props.children}</AppContext.Provider>
};

export default AppContextProvider;
