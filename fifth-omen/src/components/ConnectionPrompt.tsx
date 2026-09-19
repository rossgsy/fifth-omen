import { Show, createEffect, createSignal, useContext, type Component, type JSX } from "solid-js";
import { Icon } from "@iconify-icon/solid";
import { AppContext } from "../data/app";
import { useNetwork } from "../data/network";
import { Button } from "./ui";

const Dialog = (props: { children: JSX.Element }) => (
  <div class="fixed inset-0 z-40 grid place-items-center bg-black/80 p-6 backdrop-blur-sm">
    <div class="relative w-full max-w-sm border border-zinc-700 bg-zinc-950 p-5 shadow-2xl">{props.children}</div>
  </div>
);

export const GameScreenConnectionPrompt: Component = () => {
  const app = useContext(AppContext); const network = useNetwork();
  const [room, setRoom] = createSignal(""); const [pin, setPin] = createSignal("");
  const connection = () => app?.contextValue().gameScreenConnection;
  createEffect(() => { setRoom(connection()?.roomCode ?? ""); setPin(connection()?.pin ?? ""); });
  const shouldPrompt = () => !connection()?.roomCode || (!connection()?.pin && !connection()?.reconnectToken) || connection()?.status === "error";
  return <Show when={shouldPrompt()}><Dialog>
    <button type="button" aria-label="Close join dialog" title="Close" class="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded bg-zinc-900 text-xl text-zinc-300 hover:bg-zinc-800 hover:text-white" onClick={() => network?.closeConnectionPrompt()}><Icon icon="mdi:close" /></button>
    <p class="text-xs uppercase tracking-[0.18em] text-zinc-600">Game Screen</p><h2 class="gothic-sub-heading mt-1 text-2xl text-zinc-100">Join Room</h2>
    <Show when={connection()?.error}><p class="mt-3 border border-red-900 bg-red-950 p-3 text-sm text-red-100">{connection()?.error}</p></Show>
    <form onSubmit={(event) => { event.preventDefault(); network?.joinGameScreen(room(), pin()); }}>
      <label class="mt-4 block text-sm font-semibold text-zinc-300">Room Code<input class="mt-2 h-11 w-full rounded border border-zinc-700 bg-zinc-900 px-3 text-lg uppercase tracking-[0.18em] text-zinc-100" value={room()} maxlength={5} pattern="[A-Za-z0-9]{5}" required onInput={(event) => setRoom(event.currentTarget.value.toUpperCase())} /></label>
      <label class="mt-4 block text-sm font-semibold text-zinc-300">PIN<input class="mt-2 h-11 w-full rounded border border-zinc-700 bg-zinc-900 px-3 text-lg tracking-[0.18em] text-zinc-100" value={pin()} inputmode="numeric" maxlength={6} pattern="[0-9]{6}" required onInput={(event) => setPin(event.currentTarget.value)} /></label>
      <Button type="submit" class="mt-5 min-h-12 w-full bg-zinc-100 uppercase tracking-[0.14em] text-zinc-950 hover:bg-zinc-300">Connect</Button>
    </form>
  </Dialog></Show>;
};

export const PlayerConnectionPrompt: Component = () => {
  const app = useContext(AppContext); const network = useNetwork();
  const [room, setRoom] = createSignal(""); const [pin, setPin] = createSignal(""); const [name, setName] = createSignal("");
  const connection = () => app?.contextValue().playerConnection;
  createEffect(() => { setRoom(connection()?.roomCode ?? ""); setPin(connection()?.pin ?? ""); setName(connection()?.name ?? ""); });
  const shouldPrompt = () => !connection()?.roomCode || (!connection()?.pin && !connection()?.reconnectToken) || connection()?.status === "error";
  return <Show when={shouldPrompt()}><Dialog>
    <button type="button" aria-label="Close join dialog" title="Close" class="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded bg-zinc-900 text-xl text-zinc-300 hover:bg-zinc-800 hover:text-white" onClick={() => network?.closeConnectionPrompt()}><Icon icon="mdi:close" /></button>
    <p class="text-xs uppercase tracking-[0.18em] text-zinc-600">Player Device</p><h2 class="gothic-sub-heading mt-1 text-2xl text-zinc-100">Join Room</h2>
    <Show when={connection()?.error}><p class="mt-3 border border-red-900 bg-red-950 p-3 text-sm text-red-100">{connection()?.error}</p></Show>
    <form onSubmit={(event) => { event.preventDefault(); network?.joinPlayer(room(), pin(), name()); }}>
      <label class="mt-4 block text-sm font-semibold text-zinc-300">Name<input class="mt-2 h-11 w-full rounded border border-zinc-700 bg-zinc-900 px-3 text-zinc-100" value={name()} maxlength={40} autocomplete="name" onInput={(event) => setName(event.currentTarget.value)} /></label>
      <label class="mt-4 block text-sm font-semibold text-zinc-300">Room Code<input class="mt-2 h-11 w-full rounded border border-zinc-700 bg-zinc-900 px-3 text-lg uppercase tracking-[0.18em] text-zinc-100" value={room()} maxlength={5} pattern="[A-Za-z0-9]{5}" required onInput={(event) => setRoom(event.currentTarget.value.toUpperCase())} /></label>
      <label class="mt-4 block text-sm font-semibold text-zinc-300">PIN<input class="mt-2 h-11 w-full rounded border border-zinc-700 bg-zinc-900 px-3 text-lg tracking-[0.18em] text-zinc-100" value={pin()} inputmode="numeric" maxlength={6} pattern="[0-9]{6}" required autofocus onInput={(event) => setPin(event.currentTarget.value)} /></label>
      <Button type="submit" class="mt-5 min-h-12 w-full bg-zinc-100 uppercase tracking-[0.14em] text-zinc-950 hover:bg-zinc-300">Connect</Button>
    </form>
  </Dialog></Show>;
};
