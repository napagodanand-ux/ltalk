import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import { installElectronBridge } from './lib/electronBridge';
import './styles/themes.css';
import './styles/globals.css';

installElectronBridge();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
