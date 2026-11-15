import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { installDevBridge } from "./devBridge";
import "./index.css";

installDevBridge(); // no-op inside Electron (preload already set window.launcher)

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
