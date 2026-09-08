import { createContext, createSignal, JSX, Accessor } from "solid-js";

export const AppContext = createContext<{
    contextValue: Accessor<AppContextValue>;
    setContextValue: (value: AppContextValue) => void;
    setSlotCard: (slotId: number, tarotNumber: number | null) => void;
    setDeviceMode: (mode: "player" | "gamesheet" | null) => void;
}>();

export interface AppContextValue {
    selectedPlaybook: number | null;
    playerHealth: number;
    activeEntity: number | null;
    tarotSlots: TarotSlot[];
    deviceMode: "player" | "gamesheet" | null;
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
    let initialContext = storedContext ? JSON.parse(storedContext) : {
        selectedPlaybook: 0,
        playerHealth: 8,
        deviceMode: null,
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