// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// // https://vite.dev/config/
// export default defineConfig({
//   plugins: [react()],
// })

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/acs-dashboard/",

  server: {
    port: 5173,
    open: true,
    // 👇 SPA fallback so /test, /charts, etc. work
    historyApiFallback: true,
  },

  test: {
    environment: "jsdom", // 👈 gives you document/window in tests
    globals: true, // 👈 optional: lets you use describe/it/expect without imports
    // setupFiles: "./src/setupTests.js", // 👈 optional: if you need global setup
  },
});
