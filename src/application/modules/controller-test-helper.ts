// Specs de controller: executa com req/res simulados e devolve o status e o
// corpo já serializado em JSON.
import { vi } from "vitest";
import { Request, Response } from "express";
import { Uuid } from "@wave-telecom/framework/core";
import { BaseController } from "@wave-telecom/framework/controllers";

export async function runController(
  controller: BaseController,
  input: { params?: object; body?: object; query?: object; user?: object } = {}
) {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    type: vi.fn().mockReturnThis(),
    sendStatus: vi.fn().mockReturnThis(),
  };
  const req = {
    params: {},
    body: {},
    query: {},
    user: { id: Uuid.random(), email: "edu@mail.com" },
    ...input,
  } as unknown as Request;
  await controller.execute(req, res as unknown as Response);
  const body = res.json.mock.calls[0]?.[0];
  return {
    status: res.status.mock.calls[0]?.[0],
    body: body === undefined ? undefined : JSON.parse(JSON.stringify(body)),
  };
}
