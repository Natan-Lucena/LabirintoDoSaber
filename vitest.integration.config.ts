import { defineConfig } from "vitest/config";

// Config exclusiva dos testes de integração (batem em serviços externos reais).
// Rode com: pnpm test:integration
export default defineConfig({
  test: {
    include: ["**/*.integration.spec.ts"],
  },
});
