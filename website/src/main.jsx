import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./style.css";
import "./refinement.css";
const root = document.getElementById("root");
const app = (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);
