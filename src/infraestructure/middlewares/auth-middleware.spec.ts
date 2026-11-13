import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Request, Response } from "express";
import { makeAuthMiddleware } from "./index";
import { JwtAuthService } from "../services/auth-service-impl";
import { Educator } from "../../domain/entities/educator";
import { EducatorRepository } from "../../domain/repositories/educator-repository";

const CHANGED_AT = new Date("2026-11-12T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;

async function tokenIssuedAt(educator: Educator, issuedAt: Date) {
  vi.setSystemTime(issuedAt);
  const { token } = await new JwtAuthService().generateToken(educator);
  return token;
}

function makeRes() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

describe("authMiddleware: invalidação depois da troca de senha", () => {
  let educator: Educator;
  let educatorRepository: EducatorRepository;

  beforeEach(() => {
    vi.useFakeTimers();
    educator = Educator.create({
      name: "Maria",
      email: "maria@example.com",
      password: "hash",
      passwordChangedAt: CHANGED_AT,
    });
    educatorRepository = {
      search: vi.fn().mockResolvedValue([educator]),
    } as unknown as EducatorRepository;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function run(token: string, now: Date) {
    vi.setSystemTime(now);
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const res = makeRes();
    const next = vi.fn();
    await makeAuthMiddleware(educatorRepository)(
      req,
      res as unknown as Response,
      next
    );
    return { req, res, next };
  }

  it("token emitido antes da troca responde 401", async () => {
    const token = await tokenIssuedAt(
      educator,
      new Date(CHANGED_AT.getTime() - HOUR)
    );

    const { res, next } = await run(token, new Date(CHANGED_AT.getTime() + HOUR));

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid or expired token",
    });
  });

  it("token emitido depois da troca passa", async () => {
    const token = await tokenIssuedAt(
      educator,
      new Date(CHANGED_AT.getTime() + 1000)
    );

    const { req, next } = await run(token, new Date(CHANGED_AT.getTime() + HOUR));

    expect(next).toHaveBeenCalled();
    expect(req.user).toBe(educator);
  });

  it("token emitido no segundo anterior ao da troca responde 401", async () => {
    const token = await tokenIssuedAt(
      educator,
      new Date(CHANGED_AT.getTime() - 300)
    );

    const { res, next } = await run(token, new Date(CHANGED_AT.getTime() + HOUR));

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("token emitido no mesmo segundo da troca passa, mesmo que antes dela", async () => {
    educator = Educator.create({
      name: "Maria",
      email: "maria@example.com",
      password: "hash",
      passwordChangedAt: new Date(CHANGED_AT.getTime() + 700),
    });
    vi.mocked(educatorRepository.search).mockResolvedValue([educator]);
    const token = await tokenIssuedAt(
      educator,
      new Date(CHANGED_AT.getTime() + 200)
    );

    const { next } = await run(token, new Date(CHANGED_AT.getTime() + HOUR));

    expect(next).toHaveBeenCalled();
  });

  it("educador que nunca trocou a senha não tem token recusado", async () => {
    educator = Educator.create({
      name: "Maria",
      email: "maria@example.com",
      password: "hash",
    });
    vi.mocked(educatorRepository.search).mockResolvedValue([educator]);
    const token = await tokenIssuedAt(
      educator,
      new Date(CHANGED_AT.getTime() - HOUR)
    );

    const { next } = await run(token, CHANGED_AT);

    expect(next).toHaveBeenCalled();
  });
});
