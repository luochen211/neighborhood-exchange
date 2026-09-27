import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../..", "");
  const port = process.env.PORT ?? env.PORT ?? "3000";
  const host = process.env.HOST ?? env.HOST ?? "127.0.0.1";
  const targetHost = ["0.0.0.0", "::"].includes(host) ? "127.0.0.1" : host;
  return {
    envDir: "../..",
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      proxy: { "/api": { target: `http://${targetHost}:${port}` } },
    },
  };
});
