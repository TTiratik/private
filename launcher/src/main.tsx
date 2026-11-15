import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { installTauriBridge } from "./tauriBridge";
import { installDevBridge } from "./devBridge";
import "./index.css";

async function boot() {
  const native = await installTauriBridge(); // real backend when running in Tauri
  if (!native) installDevBridge();            // browser preview / screenshots fallback
  createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
boot();
