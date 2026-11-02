import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Settings from './settings/Settings';
import Onboarding from './onboarding/Onboarding';
import './App.css';

const ROUTES = { '#settings': Settings, '#onboarding': Onboarding };
const Root = ROUTES[window.location.hash] || App;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
