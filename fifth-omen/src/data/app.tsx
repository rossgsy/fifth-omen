import { createContext, createSignal, JSX } from "solid-js";

export const AppContext = createContext<{
    contextValue: AppContextValue;
    setContextValue: (value: AppContextValue) => void;
}>();

export interface AppContextValue {
    selectedPlaybook: number | null;
}

export interface AppContextProviderProps {
    children: JSX.Element | JSX.Element[];
}

const AppContextProvider = (props: AppContextProviderProps) => {
    const [contextValue, setContextValue] = createSignal<AppContextValue>({
        selectedPlaybook: null
    });

    return <AppContext.Provider value={{
        contextValue: contextValue(),
        setContextValue
    }}>{props.children}</AppContext.Provider>
};

export default AppContextProvider;