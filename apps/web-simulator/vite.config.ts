import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@vision-web-workspace/contracts": fileURLToPath(
        new URL("../../packages/contracts/src/index.ts", import.meta.url)
      ),
      "@vision-web-workspace/window-manager": fileURLToPath(
        new URL("../../packages/window-manager/src/index.ts", import.meta.url)
      )
    }
  }
});
