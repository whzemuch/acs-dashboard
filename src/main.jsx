import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";

// createRoot(document.getElementById('root')).render(
//   <StrictMode>
//     <App />
//   </StrictMode>,
// )
const rawBase = import.meta.env.BASE_URL || "/";

let normalizedBase = rawBase.replace(/\/$/, "");
if (!normalizedBase || normalizedBase === ".") {
  normalizedBase = "/";
}
// Vite can emit "./" when using a relative base; treat that the same as root
if (normalizedBase.startsWith(".")) {
  normalizedBase = "/";
}

const basename = normalizedBase === "/" ? undefined : normalizedBase;

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
