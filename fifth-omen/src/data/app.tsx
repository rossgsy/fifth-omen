import { createContext, createSignal, JSX, Accessor } from "solid-js";

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

const AppContextProvider = (props: AppContextProviderProps) => {
    let storedContext = window.localStorage.getItem('appContext');
    const savedContext = storedContext ? JSON.parse(storedContext) : {};
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
            roomCode: "",
            pin: "",
            reconnectToken: "",
            status: "idle",
            error: null,
        },
        playerConnection: {
            endpointUrl: "",
            roomCode: "",
            pin: "",
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

    initialContext = {
        ...initialContext,
        ...savedContext,
        entityPresence: savedContext.entityPresence ?? savedContext.entityHealth ?? initialContext.entityPresence,
        activeArcanaCards: [
            savedContext.activeArcanaCards?.[0] ?? null,
            savedContext.activeArcanaCards?.[1] ?? null,
        ],
        drawnTarotCards: [
            savedContext.drawnTarotCards?.[0] ?? null,
            savedContext.drawnTarotCards?.[1] ?? null,
            savedContext.drawnTarotCards?.[2] ?? null,
            savedContext.drawnTarotCards?.[3] ?? null,
            savedContext.drawnTarotCards?.[4] ?? null,
        ],
        currentPhase: savedContext.currentPhase ?? initialContext.currentPhase,
        playerProgressionChoices: [
            savedContext.playerProgressionChoices?.[0] ?? null,
            savedContext.playerProgressionChoices?.[1] ?? null,
            savedContext.playerProgressionChoices?.[2] ?? null,
        ],
        gameScreenConnection: {
            endpointUrl: savedContext.gameScreenConnection?.endpointUrl ?? "",
            roomCode: savedContext.gameScreenConnection?.roomCode ?? "",
            pin: savedContext.gameScreenConnection?.pin ?? "",
            reconnectToken: savedContext.gameScreenConnection?.reconnectToken ?? "",
            status: "idle",
            error: null,
        },
        playerConnection: {
            endpointUrl: savedContext.playerConnection?.endpointUrl ?? "",
            roomCode: savedContext.playerConnection?.roomCode ?? "",
            pin: savedContext.playerConnection?.pin ?? "",
            classId: savedContext.playerConnection?.classId ?? savedContext.selectedPlaybook ?? null,
            status: "idle",
            error: null,
        },
        roomState: null,
        tarotSlots: savedContext.tarotSlots ?? initialContext.tarotSlots,
    };

    const [contextValue, setContextValue] = createSignal<AppContextValue>(initialContext);

    return <AppContext.Provider value={{
        contextValue: contextValue,
        setContextValue: (value) => {
            window.localStorage.setItem('appContext', JSON.stringify(value));
            setContextValue(value);
        },
        setSlotCard: (slotId, tarotNumber) => {
            const newValue = {
                ...contextValue(),
                tarotSlots: contextValue().tarotSlots.map(slot => slot.slotId === slotId ? { ...slot, tarotNumber } : slot)
            };
            window.localStorage.setItem('appContext', JSON.stringify(newValue));
            setContextValue(newValue);
        },
        setDeviceMode: (mode) => {
            console.log("Setting device mode to", mode);
            const newValue = {
                ...contextValue(),
                deviceMode: mode
            };
            window.localStorage.setItem('appContext', JSON.stringify(newValue));
            setContextValue(newValue);
        }
    }}>{props.children}</AppContext.Provider>
};

export default AppContextProvider;
