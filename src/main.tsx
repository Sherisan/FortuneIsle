import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/800.css';
import './styles/global.css';
import { useGame } from './store/game.ts';
import { world } from './world/WorldView.tsx';

// Dev only: a handle for scripted checks (tools/shots.mjs).
if (import.meta.env.DEV) Object.assign(window, { __fi: { useGame, world } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
