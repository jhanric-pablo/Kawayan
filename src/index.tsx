import './styles/theme.css'; // first: tokens and Tailwind sit before component CSS
// Self-hosted fonts: Geist (everything), Geist Mono (labels, numbers, dates), Fraunces 900 (Why Kawayan word only)
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist/600.css';
import '@fontsource/geist/700.css';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import '@fontsource/fraunces/900.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'temporal-polyfill/global';
import './styles/accessibility.css';
import App from './App';
import OrganicDialogProvider from './components/OrganicDialog';
import { ToastProvider } from './components/ui/Toast';
import { initAccessibility } from './utils/accessibility';

// Apply saved accessibility preferences before first paint
initAccessibility();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <OrganicDialogProvider>
          <App />
        </OrganicDialogProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);