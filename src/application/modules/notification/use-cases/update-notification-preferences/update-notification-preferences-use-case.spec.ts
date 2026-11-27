import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { GetNotificationPreferencesUseCase } from "../get-notification-preferences/get-notification-preferences-use-case";
import { UpdateNotificationPreferencesUseCase } from "./update-notification-preferences-use-case";
import { makePreferencesRepository } from "../push-fixtures";

const allOn = {
  APPOINTMENTS_TODAY: true,
  EVOLUTION_PENDING: true,
  PLAN_REVIEW_DUE: true,
  SCALE_DRAFT_STALE: true,
};

describe("Notification preferences (PU-06)", () => {
  const educator = Uuid.random();
  let repository: ReturnType<typeof makePreferencesRepository>;
  let getUseCase: GetNotificationPreferencesUseCase;
  let updateUseCase: UpdateNotificationPreferencesUseCase;

  beforeEach(() => {
    repository = makePreferencesRepository();
    getUseCase = new GetNotificationPreferencesUseCase(repository);
    updateUseCase = new UpdateNotificationPreferencesUseCase(repository);
  });

  it("should return the defaults when nothing was saved, without writing", async () => {
    const result = await getUseCase.execute({ educatorId: educator });

    expect(result).toEqual({ ok: true, value: { pushEnabled: true, kinds: allOn } });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("should apply a partial update over the defaults", async () => {
    const result = await updateUseCase.execute({
      educatorId: educator,
      kinds: { SCALE_DRAFT_STALE: false },
    });

    expect(result).toEqual({
      ok: true,
      value: { pushEnabled: true, kinds: { ...allOn, SCALE_DRAFT_STALE: false } },
    });
    expect(repository.store).toHaveLength(1);
  });

  it("should keep the previous values not sent in the update", async () => {
    await updateUseCase.execute({ educatorId: educator, kinds: { SCALE_DRAFT_STALE: false } });
    await updateUseCase.execute({ educatorId: educator, pushEnabled: false });
    const result = await updateUseCase.execute({
      educatorId: educator,
      kinds: { PLAN_REVIEW_DUE: false },
    });

    expect(result).toEqual({
      ok: true,
      value: {
        pushEnabled: false,
        kinds: { ...allOn, SCALE_DRAFT_STALE: false, PLAN_REVIEW_DUE: false },
      },
    });
    expect(repository.store).toHaveLength(1);
    expect(await getUseCase.execute({ educatorId: educator })).toEqual(result);
  });

  it("should keep the preferences of each educator apart", async () => {
    await updateUseCase.execute({ educatorId: educator, pushEnabled: false });

    const other = await getUseCase.execute({ educatorId: Uuid.random() });

    expect(other).toEqual({ ok: true, value: { pushEnabled: true, kinds: allOn } });
  });
});
