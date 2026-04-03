import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { applyResolvedTheme, getStoredThemePreference, resolveThemePreference } from './lib/theme';
import { AppQueryProvider } from './providers';
import { maybeSeedPlayStoreScreenshots } from './screenshot/playStoreSeed';
import './index.css';

applyResolvedTheme(resolveThemePreference(getStoredThemePreference()));

async function bootstrap() {
  await maybeSeedPlayStoreScreenshots();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <AppQueryProvider>
          <App />
        </AppQueryProvider>
      </BrowserRouter>
    </StrictMode>,
  );
}

void bootstrap();
