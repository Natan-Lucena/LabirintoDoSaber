import { describe, it, expect, vi } from "vitest";
import {
  TaskNotebookSession,
  TaskAnswer,
} from "../../entities/task-notebook-session";
import { Uuid, failure, success } from "@wave-telecom/framework/core";

describe("TaskNotebookSession Entity", () => {
  it("should start a new session successfully", () => {
    const studentId = Uuid.random();
    const notebookId = Uuid.random();

    const result = TaskNotebookSession.start(studentId, "name", Uuid.random());

    expect(result.ok).toBe(true);
    const session = result.ok && "value" in result ? result.value : undefined;

    expect(session?.studentId).toBe(studentId);
    expect(session?.name).toBe("name");
    expect(session?.answers.length).toBe(0);
    expect(session?.startedAt).toBeInstanceOf(Date);
    expect(session?.finishedAt).toBeUndefined();
  });

  it("should answer a task successfully", () => {
    const studentId = Uuid.random();
    const notebookId = Uuid.random();

    const startResult = TaskNotebookSession.start(
      studentId,
      "name",
      Uuid.random()
    );
    const session =
      startResult.ok && "value" in startResult ? startResult.value : undefined;

    const answer: TaskAnswer = {
      taskId: Uuid.random(),
      selectedAlternativeId: Uuid.random(),
      isCorrect: true,
      timeToAnswer: 5,
      answeredAt: new Date(),
    };

    const result = session!.answerTask(answer);

    expect(result.ok).toBe(true);

    const updatedSession =
      result.ok && "value" in result ? result.value : undefined;

    expect(updatedSession?.answers.length).toBe(1);
    expect(updatedSession?.answers[0]).toEqual(answer);
  });

  it("should fail when answering the same task twice", () => {
    const studentId = Uuid.random();
    const notebookId = Uuid.random();

    const startResult = TaskNotebookSession.start(
      studentId,
      "name",
      Uuid.random()
    );
    const session =
      startResult.ok && "value" in startResult ? startResult.value : undefined;

    const taskId = Uuid.random();

    const answer: TaskAnswer = {
      taskId,
      selectedAlternativeId: Uuid.random(),
      isCorrect: false,
      timeToAnswer: 4,
      answeredAt: new Date(),
    };

    const first = session!.answerTask(answer);
    expect(first.ok).toBe(true);

    const second = (
      first.ok && "value" in first ? first.value : undefined
    )!.answerTask(answer);

    expect(second).toEqual(failure("TASK_ALREADY_ANSWERED"));
  });

  it("should finish a session successfully", () => {
    const studentId = Uuid.random();

    const startResult = TaskNotebookSession.start(
      studentId,
      "name",
      Uuid.random()
    );
    const session =
      startResult.ok && "value" in startResult ? startResult.value : undefined;

    const result = session!.finish();

    expect(result.ok).toBe(true);

    const finishedSession =
      result.ok && "value" in result ? result.value : undefined;

    expect(finishedSession?.finishedAt).toBeInstanceOf(Date);
    expect(finishedSession?.startedAt).toEqual(session?.startedAt);
  });

  it("should keep existing answers when finishing", () => {
    const studentId = Uuid.random();
    const notebookId = Uuid.random();

    const startResult = TaskNotebookSession.start(
      studentId,
      "name",
      Uuid.random()
    );
    const session =
      startResult.ok && "value" in startResult ? startResult.value : undefined;

    const answer: TaskAnswer = {
      taskId: Uuid.random(),
      selectedAlternativeId: Uuid.random(),
      isCorrect: true,
      timeToAnswer: 10,
      answeredAt: new Date(),
    };

    const updated = session!.answerTask(answer);
    const withAnswer =
      updated.ok && "value" in updated ? updated.value : undefined;

    const finishResult = withAnswer!.finish();
    const finishedSession =
      finishResult.ok && "value" in finishResult
        ? finishResult.value
        : undefined;

    expect(finishedSession?.answers.length).toBe(1);
    expect(finishedSession?.answers[0]).toEqual(answer);
  });

  describe("notebook and appointment link", () => {
    const makeAnswer = (taskId: Uuid = Uuid.random()): TaskAnswer => ({
      taskId,
      selectedAlternativeId: Uuid.random(),
      isCorrect: true,
      timeToAnswer: 3,
      answeredAt: new Date(),
    });

    const startLinked = () => {
      const notebookId = Uuid.random();
      const appointmentId = Uuid.random();
      const result = TaskNotebookSession.start(
        Uuid.random(),
        "name",
        Uuid.random(),
        notebookId,
        appointmentId
      );
      if (!result.ok) throw new Error("start failed");
      return { session: result.value, notebookId, appointmentId };
    };

    it("should keep taskNotebookId and appointmentId through answerTask, finish and addObservation", () => {
      const { session, notebookId, appointmentId } = startLinked();
      expect(session.taskNotebookId).toBe(notebookId);
      expect(session.appointmentId).toBe(appointmentId);

      const answered = session.answerTask(makeAnswer());
      if (!answered.ok) throw new Error("answer failed");
      expect(answered.value.taskNotebookId).toBe(notebookId);
      expect(answered.value.appointmentId).toBe(appointmentId);

      const finished = answered.value.finish();
      if (!finished.ok) throw new Error("finish failed");
      expect(finished.value.taskNotebookId).toBe(notebookId);
      expect(finished.value.appointmentId).toBe(appointmentId);

      const observed = finished.value.addObservation("obs");
      if (!observed.ok) throw new Error("observation failed");
      expect(observed.value.taskNotebookId).toBe(notebookId);
      expect(observed.value.appointmentId).toBe(appointmentId);
    });

    it("should leave both fields undefined when started without them", () => {
      const result = TaskNotebookSession.start(Uuid.random(), "name", Uuid.random());
      if (!result.ok) throw new Error("start failed");
      expect(result.value.taskNotebookId).toBeUndefined();
      expect(result.value.appointmentId).toBeUndefined();
    });

    it("should block a duplicate answer even when the taskId is a different Uuid instance", () => {
      const { session } = startLinked();
      const taskId = Uuid.random();

      const first = session.answerTask(makeAnswer(taskId));
      if (!first.ok) throw new Error("answer failed");

      const second = first.value.answerTask(makeAnswer(new Uuid(taskId.value)));

      expect(second).toEqual(failure("TASK_ALREADY_ANSWERED"));
    });
  });
});
