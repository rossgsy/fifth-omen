import type { Component } from 'solid-js';
import { createSignal, Match, Switch, onMount } from 'solid-js';
import PlaybookComponent, { Playbook } from './Playbook';


const App: Component = () => {
  const [playbook, setPlaybook] = createSignal<Playbook | null>(null);

  onMount(() => {
    // Initialize the playbook here, for example:
    setPlaybook({
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
    });
  });

  return (
    <div class="flex justify-between items-center h-screen flex-col bg-zinc-900">
      <div class="p-4">
        <h1 class="gothic-heading text-6xl text-white">Fifth Omen</h1>
      </div>
      <div class="text-white grow flex">
        <Switch>
          <Match when={playbook() !== null}>
            <PlaybookComponent playbook={playbook()!} />
          </Match>
        </Switch>
      </div>
      <div>
      </div>
    </div>
  );
};

export default App;
