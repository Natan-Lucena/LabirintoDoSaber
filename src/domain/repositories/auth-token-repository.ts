import { Uuid } from "@wave-telecom/framework/core";
import { AuthToken } from "../entities/auth-token";

// Os métodos que contam ou consomem são atômicos e condicionais: com
// requisições em paralelo, cada uma conta, e o limite vale para todas.
export interface AuthTokenRepository {
  findByUserId(userId: Uuid): Promise<AuthToken | null>;

  // Primeiro código do educador (ainda sem registro).
  create(authToken: AuthToken): Promise<void>;

  // Grava o código novo (hash, validade, tentativas zeradas) no registro
  // existente, contando o envio: incrementa se a janela de 15 min está aberta
  // e tem menos de 3 envios, ou reinicia a janela se ela já fechou. Devolve
  // false, sem gravar nada, quando o limite da janela foi atingido.
  saveIssued(authToken: AuthToken, now: Date): Promise<boolean>;

  // Conta uma tentativa se o código não foi usado e ainda tem tentativas.
  // Devolve false quando não contou.
  registerAttempt(id: Uuid): Promise<boolean>;

  // Marca o código como usado se ainda não foi. Devolve false quando outro
  // uso chegou antes.
  consume(id: Uuid, consumedAt: Date): Promise<boolean>;
}
