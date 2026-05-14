import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Modular CSS imports (split from monolithic App.css)
import "./styles/base.css";
import "./styles/auth.css";
import "./styles/layout.css";
import "./styles/feed.css";
import "./styles/profile.css";
import "./styles/modals.css";
import "./styles/components.css";
import "./styles/mobile.css";
import "./styles/responsive.css";

const rootElement = document.getElementById("root");

// If prerendered HTML exists → hydrate it
if (rootElement.hasChildNodes()) {
  ReactDOM.hydrateRoot(
    rootElement,
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} 
// Otherwise → normal render
else {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
