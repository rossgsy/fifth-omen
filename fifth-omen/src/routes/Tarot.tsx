import { useNavigate } from "@solidjs/router";
import { MajorArcana, numeral_to_number } from "../game";
import { createSignal } from "solid-js";

const TarotRoute = () => {
    const nav = useNavigate();
    const [input, setInput] = createSignal("");

    let inputTimer: number = 0;

    const handleInput = () => {
        clearTimeout(inputTimer);
        inputTimer = window.setTimeout(() => {
            let value = numeral_to_number(input());
            if (!isNaN(value) && value >= 0 && value < MajorArcana.length) {
                nav(`/tarot/${value}`);
            }
        }, 300);
    };

    return <div class="flex flex-col items-stretch justify-center min-h-100 grow ">
        <input type="text" placeholder="Enter card numeral" class="p-2 m-4 border rounded" value={input()} onInput={(e) => setInput(e.currentTarget.value)} />
        <button class="p-2 m-4 border rounded" onClick={handleInput}>Go</button>
    </div>
}

export default TarotRoute;