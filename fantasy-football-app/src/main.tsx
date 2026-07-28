import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { ScoringProvider } from "./lib/ScoringContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ScoringProvider>
        <App />
      </ScoringProvider>
    </BrowserRouter>
  </StrictMode>
);
