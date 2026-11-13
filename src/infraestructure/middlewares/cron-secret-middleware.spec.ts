import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Request, Response } from "express";
import { requireCronSecret } from "./index";

function run(authorization?: string) {
  const req = { headers: authorization ? { authorization } : {} } as Request;
  const res = { sendStatus: vi.fn() };
  const next = vi.fn();
  requireCronSecret(req, res as unknown as Response, next);
  return { res, next };
}

describe("requireCronSecret", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "segredo-do-cron");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should let the request through with the Vercel Bearer secret", () => {
    const { res, next } = run("Bearer segredo-do-cron");

    expect(next).toHaveBeenCalled();
    expect(res.sendStatus).not.toHaveBeenCalled();
  });

  it("should answer 401 without the secret", () => {
    const { res, next } = run();

    expect(next).not.toHaveBeenCalled();
    expect(res.sendStatus).toHaveBeenCalledWith(401);
  });

  it("should answer 401 with a wrong secret", () => {
    const { res, next } = run("Bearer outro");

    expect(next).not.toHaveBeenCalled();
    expect(res.sendStatus).toHaveBeenCalledWith(401);
  });

  it("should answer 401 when CRON_SECRET is not configured", () => {
    vi.stubEnv("CRON_SECRET", "");

    const { res, next } = run("Bearer ");

    expect(next).not.toHaveBeenCalled();
    expect(res.sendStatus).toHaveBeenCalledWith(401);
  });
});
