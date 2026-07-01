import React from "react";
import { createRoot } from "react-dom/client";
import { AppRoot } from "@telegram-apps/telegram-ui";
import "@telegram-apps/telegram-ui/dist/styles.css";
import "./styles.css";
import { App } from "./App";
import { tg, isDark, tgPlatform } from "./telegram";

// Tell Telegram we're ready and take the full height.
tg?.ready();
tg?.expand();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppRoot appearance={isDark ? "dark" : "light"} platform={tgPlatform}>
      <App />
    </AppRoot>
  </React.StrictMode>,
);
