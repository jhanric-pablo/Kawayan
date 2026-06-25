import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Buffer } from 'buffer';
import 'temporal-polyfill/global';
import App from './App';
import OrganicDialogProvider from './components/OrganicDialog';

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
      </OrganicDialogProvider>
    </BrowserRouter>
  </React.StrictMode>
);