// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// // https://vite.dev/config/
// export default defineConfig({
//   plugins: [react()],
// })

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  return {
    plugins: [react()],
    //  no leading slash, just relative
    base: "./",

    server: {
      port: 5173,
      open: true,
      historyApiFallback: true,
    },

    test: {
      environment: "jsdom",
      globals: true,
    },
  };
});
