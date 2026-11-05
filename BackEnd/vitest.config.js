import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Mostra o nome de cada teste, não só o total.
    reporters: ["verbose"],
    include: ["src/**/*.test.js"],
  },
});
