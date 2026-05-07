import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from './context/AppContext.jsx';
import App from './App.jsx';
import './styles/global.css';
import { initCrashReporting } from './utils/crashReporter';
import { registerSW } from './utils/registerSW';

initCrashReporting();
registerSW();

createRoot(document.getElementById('root')).render(
  <BrowserRouter basename="/PerinApp">
    <AppProvider>
      <App />
    </AppProvider>
  </BrowserRouter>
);
