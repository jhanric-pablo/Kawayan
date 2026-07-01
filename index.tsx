import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Buffer } from 'buffer';
import 'temporal-polyfill/global';
import './styles/accessibility.css';
import App from './App';
import OrganicDialogProvider from './components/OrganicDialog';
import AccessibilityWidget from './components/AccessibilityWidget';
import { initAccessibility } from './utils/accessibility';

// Apply saved accessibility preferences before first paint
initAccessibility();

// Define Buffer globally for simple-peer
if (typeof window !== 'undefined' && typeof (window as any).Buffer === 'undefined') {
  (window as any).Buffer = Buffer;
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <OrganicDialogProvider>
        <App />
        <AccessibilityWidget />
      </OrganicDialogProvider>
    </BrowserRouter>
  </React.StrictMode>
);