import { Request } from "express";

// IP do cliente. Na Vercel, x-forwarded-for é preenchido pela plataforma (o
// primeiro valor é o cliente); localmente, cai no socket.
export function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  return first || req.socket.remoteAddress || "unknown";
}
