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
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter basename="/acs-dashboard">
      <App />
    </BrowserRouter>
  </StrictMode>
);
