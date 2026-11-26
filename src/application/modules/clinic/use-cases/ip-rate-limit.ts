import crypto from "crypto";
import net from "net";
import { RateLimitRepository } from "../../../../domain/repositories/rate-limit-repository";

// Prévia (EQ-07) e resgate do código (aceite e cadastro com convite): 10
// requisições por IP a cada 15 minutos, cada escopo com a própria cota.
export const IP_RATE_LIMIT = 10;
export const IP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export type IpRateLimitScope = "invite-preview" | "invite-redeem";

// Expande um IPv6 válido para os 8 grupos de 16 bits.
function ipv6Groups(ip: string): string[] {
  const [head, tail] = ip.split("::");
  const parse = (part: string | undefined) => (part ? part.split(":") : []);
  const left = parse(head);
  const right = parse(tail);
  const missing = 8 - left.length - right.length;
  const groups = tail === undefined ? left : [...left, ...Array(missing).fill("0"), ...right];
  return groups.map((group) => parseInt(group, 16).toString(16));
}

// Quem tem um IPv6 costuma controlar o /64 inteiro: a cota vale para o
// prefixo. IPv4 mapeado em IPv6 (::ffff:a.b.c.d) volta a ser o IPv4.
export function normalizeClientIp(ip: string): string {
  const withoutZone = ip.split("%")[0];
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(withoutZone);
  if (mapped) return mapped[1];
  if (!net.isIPv6(withoutZone) || withoutZone.includes(".")) return ip;
  return `${ipv6Groups(withoutZone).slice(0, 4).join(":")}::/64`;
}

// Janela fixa. O IP vai para a chave só como hash.
export function ipRateLimitKey(scope: IpRateLimitScope, ip: string, now: Date): string {
  const windowIndex = Math.floor(now.getTime() / IP_RATE_LIMIT_WINDOW_MS);
  const ipHash = crypto.createHash("sha256").update(normalizeClientIp(ip)).digest("hex");
  return `${scope}:${ipHash}:${windowIndex}`;
}

// Conta a requisição na cota do IP. Devolve false quando a cota da janela acabou.
export function consumeIpQuota(
  repository: RateLimitRepository,
  scope: IpRateLimitScope,
  ip: string,
  now: Date
): Promise<boolean> {
  const windowIndex = Math.floor(now.getTime() / IP_RATE_LIMIT_WINDOW_MS);
  return repository.tryConsume(
    ipRateLimitKey(scope, ip, now),
    IP_RATE_LIMIT,
    new Date((windowIndex + 1) * IP_RATE_LIMIT_WINDOW_MS)
  );
}
