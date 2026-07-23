import { defineConfig, configDefaults } from "vitest/config";

// Config padrão: roda os testes unitários e EXCLUI os de integração
// (que batem em serviços externos, ex.: API do Gemini).
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "**/*.integration.spec.ts"],
  },
});
