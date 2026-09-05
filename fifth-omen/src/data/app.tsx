import { createContext, createSignal, JSX, Accessor } from "solid-js";

export const AppContext = createContext<{
    contextValue: Accessor<AppContextValue>;
    setContextValue: (value: AppContextValue) => void;
}>();

export interface AppContextValue {
    selectedPlaybook: number | null;
    playerHealth: number;
}

export interface AppContextProviderProps {
    children: JSX.Element | JSX.Element[];
}

const AppContextProvider = (props: AppContextProviderProps) => {
    let storedContext = window.localStorage.getItem('appContext');
    let initialContext = storedContext ? JSON.parse(storedContext) : { selectedPlaybook: 0, playerHealth: 8 };

    const [contextValue, setContextValue] = createSignal<AppContextValue>(initialContext);

    return <AppContext.Provider value={{
        contextValue: contextValue,
        setContextValue: (value) => {
            window.localStorage.setItem('appContext', JSON.stringify(value));
            setContextValue(value);
        }
    }}>{props.children}</AppContext.Provider>
};

export default AppContextProvider;