const envWsUrl = import.meta.env.VITE_GAME_WS_URL as string | undefined;

const sameOriginWsUrl = () => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws`;
};

export const gameWsUrl = () => envWsUrl || sameOriginWsUrl();
