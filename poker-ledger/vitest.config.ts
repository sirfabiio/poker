import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  // Testes de componentes (.tsx): o tsconfig usa jsx "preserve" para o Next; aqui transforma-se para o runtime do React.
  oxc: { jsx: { runtime: "automatic" } },
  test: { environment: "node", include: ["tests/**/*.test.{ts,tsx}"] },
});
