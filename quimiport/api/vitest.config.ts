import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // graphql-http é CommonJS: força a mesma cópia (CJS) do graphql para evitar
    // o erro "Cannot use GraphQLSchema from another module or realm" no Vitest.
    alias: { graphql: "graphql/index.js" },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/main.ts", "src/interfaces/http/docs/**"],
      reporter: ["text", "html", "lcov"],
    },
  },
});
