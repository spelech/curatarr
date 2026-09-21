import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const rootEl = document.getElementById('root')!;

// React 19 assigns a noop function to container.onclick for iOS delegation.
// Prevent root mount container from being misidentified as an interactive button/click-target.
Object.defineProperty(rootEl, 'onclick', {
  get: () => null,
  set: () => {},
  configurable: true,
});

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
