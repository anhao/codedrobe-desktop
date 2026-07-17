// SPDX-License-Identifier: MPL-2.0

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import './ui/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
