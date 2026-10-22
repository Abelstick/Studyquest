import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/tokens.css';
import './styles/worlds.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/components.css';
import './styles/screens.css';
import './styles/features.css';
import './styles/agenda.css';
import './styles/today.css';
import './styles/plan.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
