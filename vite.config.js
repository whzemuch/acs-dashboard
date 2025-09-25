// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// // https://vite.dev/config/
// export default defineConfig({
//   plugins: [react()],
// })

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Map vite mode to base path
  const base =
    mode === "staging" ? "/acs-dashboard/preview/" : "/acs-dashboard/";

  return {
    plugins: [react()],
    base,

    server: {
      port: 5173,
      open: true,
      historyApiFallback: true, // allows SPA routing
    },

    test: {
      environment: "jsdom", // gives document/window in tests
      globals: true,
    },
  };
});
