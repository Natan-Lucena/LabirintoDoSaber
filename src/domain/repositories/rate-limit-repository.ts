// Contadores de limite de requisições, persistidos: a API roda em funções
// serverless, sem memória compartilhada entre instâncias.
export interface RateLimitRepository {
  // Conta uma requisição na janela `key` se ela ainda tem menos de `limit`.
  // Atômico e condicional: com requisições em paralelo, cada uma conta e o
  // limite vale para todas. Devolve false, sem contar, quando o limite da
  // janela foi atingido. `expiresAt` é o fim da janela (limpeza).
  tryConsume(key: string, limit: number, expiresAt: Date): Promise<boolean>;
}
