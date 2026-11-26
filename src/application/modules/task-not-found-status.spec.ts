// PP-11: TASK_NOT_FOUND, TASK_GROUP_NOT_FOUND e TASK_NOTEBOOK_NOT_FOUND são
// 404 em todos os controllers, inclusive com id que não é UUID (nunca 400/500).
import { describe, it, expect, vi } from "vitest";
import { Request, Response } from "express";
import { success, Uuid } from "@wave-telecom/framework/core";
import { BaseController } from "@wave-telecom/framework/controllers";
import { GetTaskByIdController } from "./task/use-cases/get-task-by-id/get-task-by-id-controller";
import { GetTaskByIdUseCase } from "./task/use-cases/get-task-by-id/get-task-by-id-use-case";
import { DeleteTaskController } from "./task/use-cases/delete-task/delete-task-controller";
import { DeleteTaskUseCase } from "./task/use-cases/delete-task/delete-task-use-case";
import { UpdateTaskController } from "./task/use-cases/update-task/update-task-controller";
import { UpdateTaskUseCase } from "./task/use-cases/update-task/update-task-use-case";
import { DuplicateTaskController } from "./task/use-cases/duplicate-task/duplicate-task-controller";
import { DuplicateTaskUseCase } from "./task/use-cases/duplicate-task/duplicate-task-use-case";
import { GetTaskGroupController } from "./task-group/use-cases/get-task-group/get-task-group-controller";
import { GetTaskGroupUseCase } from "./task-group/use-cases/get-task-group/get-task-group-use-case";
import { DeleteTaskGroupController } from "./task-group/use-cases/delete-task-group/delete-task-group-controller";
import { DeleteTaskGroupUseCase } from "./task-group/use-cases/delete-task-group/delete-task-group-use-case";
import { UpdateTaskGroupController } from "./task-group/use-cases/update-task-group/update-task-group-controller";
import { UpdateTaskGroupUseCase } from "./task-group/use-cases/update-task-group/update-task-group-use-case";
import { DeleteTaskNotebookController } from "./task-notebook/use-cases/delete-task-notebook/delete-task-notebook-controller";
import { DeleteTaskNotebookUseCase } from "./task-notebook/use-cases/delete-task-notebook/delete-task-notebook-use-case";
import { UpdateTaskNotebookController } from "./task-notebook/use-cases/update-task-notebook/update-task-notebook-controller";
import { UpdateTaskNotebookUseCase } from "./task-notebook/use-cases/update-task-notebook/update-task-notebook-use-case";
import { AnswerTaskNotebookSessionController } from "./task-notebook-session/use-cases/answer-task-notebook-session/answer-task-notebook-session-controller";
import { AnswerTaskNotebookSessionUseCase } from "./task-notebook-session/use-cases/answer-task-notebook-session/answer-task-notebook-session-use-case";
import { RecordActivityResultController } from "./task-notebook-session/use-cases/record-activity-result/record-activity-result-controller";
import { RecordActivityResultUseCase } from "./task-notebook-session/use-cases/record-activity-result/record-activity-result-use-case";
import { TaskNotebookSession } from "../../domain/entities/task-notebook-session";

const NOT_UUID = "nao-e-uuid";
const user = { id: Uuid.random(), email: "edu@mail.com" };

// Repositório que não encontra nada.
const emptyRepository = () =>
  new Proxy(
    {},
    {
      get: (target: Record<string, unknown>, key: string) =>
        (target[key] ??= vi.fn(async () =>
          /^(getByIds|findByIds|search|list)/.test(key) ? [] : null
        )),
    }
  ) as any;

const run = async (
  controller: BaseController,
  input: { params?: object; body?: object }
) => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    type: vi.fn().mockReturnThis(),
    sendStatus: vi.fn().mockReturnThis(),
  };
  const req = { params: {}, body: {}, query: {}, user, ...input } as unknown as Request;
  await controller.execute(req, res as unknown as Response);
  return { status: res.status.mock.calls[0]?.[0], body: res.json.mock.calls[0]?.[0] };
};

// Sessão aberta e acessível, para chegar à busca da tarefa.
const openSessionDeps = () => {
  const session = new TaskNotebookSession(
    Uuid.random(),
    Uuid.random(),
    user.id,
    "Sessão",
    new Date()
  );
  const sessionRepository = emptyRepository();
  sessionRepository.getById = vi.fn(async () => session);
  const studentAccess = { assertStudentAccess: vi.fn(async () => success({})) } as any;
  return { session, sessionRepository, studentAccess };
};

describe("PP-11: 404 for missing tasks, task groups and task notebooks", () => {
  describe("task", () => {
    const cases = (id: string) => [
      ["GET /task/:id", new GetTaskByIdController(new GetTaskByIdUseCase(emptyRepository())), { params: { id } }],
      ["DELETE /task/delete/:id", new DeleteTaskController(new DeleteTaskUseCase(emptyRepository())), { params: { id } }],
      [
        "PUT /task/update",
        new UpdateTaskController(
          new UpdateTaskUseCase(emptyRepository(), emptyRepository(), emptyRepository())
        ),
        { body: { id, prompt: "Nova" } },
      ],
      ["POST /task/:id/duplicate", new DuplicateTaskController(new DuplicateTaskUseCase(emptyRepository())), { params: { id } }],
    ] as const;

    for (const [label, id] of [
      ["missing", Uuid.random().value],
      ["not a UUID", NOT_UUID],
    ]) {
      it(`should answer 404 TASK_NOT_FOUND when the id is ${label}`, async () => {
        for (const [route, controller, input] of cases(id)) {
          expect([route, await run(controller, input)]).toEqual([
            route,
            { status: 404, body: { message: "TASK_NOT_FOUND" } },
          ]);
        }
      });
    }
  });

  describe("task group", () => {
    const cases = (id: string) => [
      [
        "GET /task-group/:id",
        new GetTaskGroupController(new GetTaskGroupUseCase(emptyRepository(), emptyRepository())),
        { params: { id } },
      ],
      [
        "DELETE /task-group/delete/:taskGroupId",
        new DeleteTaskGroupController(new DeleteTaskGroupUseCase(emptyRepository())),
        { params: { taskGroupId: id } },
      ],
      [
        "PUT /task-group/update",
        new UpdateTaskGroupController(
          new UpdateTaskGroupUseCase(emptyRepository(), emptyRepository())
        ),
        { body: { id, name: "Novo" } },
      ],
    ] as const;

    for (const [label, id] of [
      ["missing", Uuid.random().value],
      ["not a UUID", NOT_UUID],
    ]) {
      it(`should answer 404 TASK_GROUP_NOT_FOUND when the id is ${label}`, async () => {
        for (const [route, controller, input] of cases(id)) {
          expect([route, await run(controller, input)]).toEqual([
            route,
            { status: 404, body: { message: "TASK_GROUP_NOT_FOUND" } },
          ]);
        }
      });
    }
  });

  describe("task notebook", () => {
    const cases = (id: string) => [
      [
        "DELETE /task-notebook/delete/:taskNotebookId",
        new DeleteTaskNotebookController(new DeleteTaskNotebookUseCase(emptyRepository())),
        { params: { taskNotebookId: id } },
      ],
      [
        "PUT /task-notebook/update",
        new UpdateTaskNotebookController(new UpdateTaskNotebookUseCase(emptyRepository())),
        { body: { taskNotebookId: id, description: "Novo" } },
      ],
    ] as const;

    for (const [label, id] of [
      ["missing", Uuid.random().value],
      ["not a UUID", NOT_UUID],
    ]) {
      it(`should answer 404 TASK_NOTEBOOK_NOT_FOUND when the id is ${label}`, async () => {
        for (const [route, controller, input] of cases(id)) {
          expect([route, await run(controller, input)]).toEqual([
            route,
            { status: 404, body: { message: "TASK_NOTEBOOK_NOT_FOUND" } },
          ]);
        }
      });
    }
  });

  describe("session", () => {
    for (const [label, taskId] of [
      ["missing", Uuid.random().value],
      ["not a UUID", NOT_UUID],
    ]) {
      it(`should answer 404 TASK_NOT_FOUND when the answered task is ${label}`, async () => {
        const { session, sessionRepository, studentAccess } = openSessionDeps();
        const controller = new AnswerTaskNotebookSessionController(
          new AnswerTaskNotebookSessionUseCase(
            sessionRepository,
            studentAccess,
            emptyRepository(),
            emptyRepository(),
            emptyRepository()
          )
        );

        const response = await run(controller, {
          body: {
            sessionId: session.id.value,
            taskId,
            selectedAlternativeId: Uuid.random().value,
            timeToAnswer: 1000,
          },
        });

        expect(response).toEqual({ status: 404, body: { message: "TASK_NOT_FOUND" } });
      });

      it(`should answer 404 TASK_NOT_FOUND when the played task is ${label}`, async () => {
        const { session, sessionRepository, studentAccess } = openSessionDeps();
        const controller = new RecordActivityResultController(
          new RecordActivityResultUseCase(
            sessionRepository,
            studentAccess,
            emptyRepository(),
            emptyRepository(),
            emptyRepository(),
            emptyRepository()
          )
        );

        const response = await run(controller, {
          body: {
            sessionId: session.id.value,
            taskId,
            completed: true,
            correct: true,
            attempts: 1,
            errors: 0,
            durationMs: 1000,
          },
        });

        expect(response).toEqual({ status: 404, body: { message: "TASK_NOT_FOUND" } });
      });
    }

    it("should answer 404 SESSION_NOT_FOUND when the session id is not a UUID", async () => {
      const controller = new AnswerTaskNotebookSessionController(
        new AnswerTaskNotebookSessionUseCase(
          emptyRepository(),
          {} as any,
          emptyRepository(),
          emptyRepository(),
          emptyRepository()
        )
      );

      const response = await run(controller, {
        body: {
          sessionId: NOT_UUID,
          taskId: Uuid.random().value,
          selectedAlternativeId: Uuid.random().value,
          timeToAnswer: 1000,
        },
      });

      expect(response).toEqual({ status: 404, body: { message: "SESSION_NOT_FOUND" } });
    });
  });
});
