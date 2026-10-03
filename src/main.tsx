import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { I18nProvider } from "./lib/i18n";
import { AuthProvider } from "./lib/auth";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeSync } from "./components/ThemeSync";
import { applyTheme, readStoredTheme } from "./lib/theme";
import "./index.css";

// Pre-paint the theme this browser last used, before React mounts, so a dark-
// mode user doesn't get a white flash on every load while their profile is
// fetched. ThemeSync corrects it from the server value once auth resolves.
applyTheme(readStoredTheme() ?? "light");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <I18nProvider>
          <AuthProvider>
            <ThemeSync />
            <App />
          </AuthProvider>
        </I18nProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
