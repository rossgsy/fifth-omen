/* @refresh reload */
import './index.css';
import { render } from 'solid-js/web';
import 'solid-devtools';

import App from './App';
import { loadGameRules } from './game';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  );
}

loadGameRules()
  .then(() => render(() => <App />, root!))
  .catch((error: unknown) => {
    console.error(error);
    if (!root) return;
    root.textContent = error instanceof Error ? error.message : "Could not load game rules.";
  });
