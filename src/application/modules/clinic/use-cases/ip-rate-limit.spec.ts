import { describe, expect, it } from "vitest";
import { ipRateLimitKey, normalizeClientIp } from "./ip-rate-limit";

describe("normalizeClientIp", () => {
  it("mantém o IPv4", () => {
    expect(normalizeClientIp("200.1.2.3")).toBe("200.1.2.3");
  });

  it("IPv4 mapeado em IPv6 volta a ser o IPv4", () => {
    expect(normalizeClientIp("::ffff:200.1.2.3")).toBe("200.1.2.3");
  });

  it("reduz o IPv6 ao prefixo /64, com ou sem abreviação", () => {
    const a = normalizeClientIp("2001:db8:abcd:12:1111:2222:3333:4444");
    const b = normalizeClientIp("2001:0db8:abcd:0012::1");
    const c = normalizeClientIp("2001:DB8:ABCD:12:ffff::");
    expect(a).toBe("2001:db8:abcd:12::/64");
    expect(b).toBe(a);
    expect(c).toBe(a);
    expect(normalizeClientIp("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(normalizeClientIp("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
  });

  it("devolve como veio o que não é IP", () => {
    expect(normalizeClientIp("unknown")).toBe("unknown");
  });
});

describe("ipRateLimitKey", () => {
  const now = new Date("2026-11-26T12:07:00Z");

  it("IPs do mesmo /64 dividem a chave; escopos não", () => {
    const a = ipRateLimitKey("invite-redeem", "2001:db8:abcd:12::1", now);
    const b = ipRateLimitKey("invite-redeem", "2001:db8:abcd:12::2", now);
    const other = ipRateLimitKey("invite-redeem", "2001:db8:abcd:13::1", now);
    expect(a).toBe(b);
    expect(other).not.toBe(a);
    expect(ipRateLimitKey("invite-preview", "2001:db8:abcd:12::1", now)).not.toBe(a);
  });

  it("não guarda o IP em claro", () => {
    const key = ipRateLimitKey("invite-preview", "200.1.2.3", now);
    expect(key).toMatch(/^invite-preview:[0-9a-f]{64}:\d+$/);
  });
});
