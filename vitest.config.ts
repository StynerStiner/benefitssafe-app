import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sharedResolve = {
  alias: {
    "@": __dirname,
  },
};

// Vitest v4 `projects` API — two isolated environments so the existing
// Node-only API/schema tests keep their fast `environment: "node"` setup
// while component tests get a jsdom DOM + @testing-library/jest-dom matchers.
export default defineConfig({
  resolve: sharedResolve,
  test: {
    projects: [
      {
        resolve: sharedResolve,
        test: {
          name: "node",
          globals: true,
          environment: "node",
          root: __dirname,
          include: ["__tests__/**/*.test.ts"],
          exclude: ["__tests__/components/**", "node_modules/**"],
        },
      },
      {
        plugins: [react()],
        resolve: sharedResolve,
        test: {
          name: "jsdom",
          globals: true,
          environment: "jsdom",
          root: __dirname,
          include: ["__tests__/components/**/*.test.tsx"],
          setupFiles: ["./__tests__/setup-jsdom.ts"],
        },
      },
    ],
  },
});
