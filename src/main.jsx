import React from "react";
import { createRoot } from "react-dom/client";
import RapLife from "./RapLife.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RapLife />
  </React.StrictMode>
);
