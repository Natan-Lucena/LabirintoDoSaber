import { describe, it, expect } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import {
  Appointment,
  AppointmentStatus,
} from "../../entities/appointment";

const makeProps = (overrides: Partial<Parameters<typeof Appointment.create>[0]> = {}) => ({
  educatorId: Uuid.random(),
  studentId: Uuid.random(),
  scheduledAt: new Date("2026-07-01T10:00:00Z"),
  ...overrides,
});

const updateOk = (
  appt: Appointment,
  props: Parameters<Appointment["update"]>[0]
): Appointment => {
  const result = appt.update(props);
  if (!result.ok) throw new Error(`unexpected failure: ${result.error}`);
  return result.value;
};

describe("Appointment Entity", () => {
  describe("create", () => {
    it("should create an appointment with required props", () => {
      const educatorId = Uuid.random();
      const studentId = Uuid.random();
      const scheduledAt = new Date("2026-07-01T10:00:00Z");

      const appt = Appointment.create({ educatorId, studentId, scheduledAt });

      expect(appt.educatorId).toBe(educatorId);
      expect(appt.studentId).toBe(studentId);
      expect(appt.scheduledAt).toEqual(scheduledAt);
    });

    it("should assign a random id when none is provided", () => {
      const appt = Appointment.create(makeProps());

      expect(appt.id).toBeInstanceOf(Uuid);
    });

    it("should use the provided id when one is given", () => {
      const id = Uuid.random();
      const appt = Appointment.create(makeProps({ id }));

      expect(appt.id).toBe(id);
    });

    it("should default status to PENDING when not specified", () => {
      const appt = Appointment.create(makeProps());

      expect(appt.status).toBe(AppointmentStatus.PENDING);
    });

    it("should accept an explicit status", () => {
      const appt = Appointment.create(
        makeProps({ status: AppointmentStatus.COMPLETED })
      );

      expect(appt.status).toBe(AppointmentStatus.COMPLETED);
    });

    it("should set observation when provided", () => {
      const appt = Appointment.create(makeProps({ observation: "Bring records" }));

      expect(appt.observation).toBe("Bring records");
    });

    it("should leave observation undefined when not provided", () => {
      const appt = Appointment.create(makeProps());

      expect(appt.observation).toBeUndefined();
    });

    it("should set notifiedAt when provided", () => {
      const notifiedAt = new Date("2026-06-30T09:00:00Z");
      const appt = Appointment.create(makeProps({ notifiedAt }));

      expect(appt.notifiedAt).toEqual(notifiedAt);
    });

    it("should leave notifiedAt undefined when not provided", () => {
      const appt = Appointment.create(makeProps());

      expect(appt.notifiedAt).toBeUndefined();
    });

    it("should set metadata when provided", () => {
      const metadata = { key: "value" };
      const appt = Appointment.create(makeProps({ metadata }));

      expect(appt.metadata).toEqual(metadata);
    });

    it("should set createdAt when provided", () => {
      const createdAt = new Date("2026-01-01T00:00:00Z");
      const appt = Appointment.create(makeProps({ createdAt }));

      expect(appt.createdAt).toEqual(createdAt);
    });

    it("should assign a createdAt date automatically when not provided", () => {
      const appt = Appointment.create(makeProps());

      expect(appt.createdAt).toBeInstanceOf(Date);
    });
  });

  describe("update", () => {
    it("should return a new Appointment instance", () => {
      const appt = Appointment.create(makeProps());
      const updated = updateOk(appt, { scheduledAt: new Date("2026-08-01T10:00:00Z") });

      expect(updated).not.toBe(appt);
      expect(updated).toBeInstanceOf(Appointment);
    });

    it("should update scheduledAt", () => {
      const newDate = new Date("2026-08-01T10:00:00Z");
      const appt = Appointment.create(makeProps());
      const updated = updateOk(appt, { scheduledAt: newDate });

      expect(updated.scheduledAt).toEqual(newDate);
    });

    it("should update observation", () => {
      const appt = Appointment.create(makeProps({ observation: "Old note" }));
      const updated = updateOk(appt, { observation: "New note" });

      expect(updated.observation).toBe("New note");
    });

    it("should allow clearing observation by setting it to null", () => {
      const appt = Appointment.create(makeProps({ observation: "Old note" }));
      const updated = updateOk(appt, { observation: null });

      expect(updated.observation).toBeUndefined();
    });

    it("should preserve unchanged fields", () => {
      const educatorId = Uuid.random();
      const studentId = Uuid.random();
      const appt = Appointment.create({ educatorId, studentId, scheduledAt: new Date("2026-07-01T10:00:00Z") });
      const updated = updateOk(appt, { scheduledAt: new Date("2026-08-01T10:00:00Z") });

      expect(updated.educatorId).toBe(educatorId);
      expect(updated.studentId).toBe(studentId);
      expect(updated.id).toBe(appt.id);
    });

    it("should not mutate the original appointment", () => {
      const original = new Date("2026-07-01T10:00:00Z");
      const appt = Appointment.create(makeProps({ scheduledAt: original }));
      updateOk(appt, { scheduledAt: new Date("2026-08-01T10:00:00Z") });

      expect(appt.scheduledAt).toEqual(original);
    });
  });

  describe("cancel", () => {
    it("should return a new Appointment instance", () => {
      const appt = Appointment.create(makeProps());
      const cancelled = appt.cancel();

      expect(cancelled).not.toBe(appt);
      expect(cancelled).toBeInstanceOf(Appointment);
    });

    it("should set status to CANCELLED", () => {
      const appt = Appointment.create(makeProps());
      const cancelled = appt.cancel();

      expect(cancelled.status).toBe(AppointmentStatus.CANCELLED);
    });

    it("should not mutate the original appointment", () => {
      const appt = Appointment.create(makeProps());
      appt.cancel();

      expect(appt.status).toBe(AppointmentStatus.PENDING);
    });
  });

  describe("markAsNotified", () => {
    it("should return a new Appointment instance", () => {
      const appt = Appointment.create(makeProps());
      const notified = appt.markAsNotified(new Date());

      expect(notified).not.toBe(appt);
      expect(notified).toBeInstanceOf(Appointment);
    });

    it("should set notifiedAt to the provided date", () => {
      const at = new Date("2026-06-11T08:00:00Z");
      const appt = Appointment.create(makeProps());
      const notified = appt.markAsNotified(at);

      expect(notified.notifiedAt).toEqual(at);
    });

    it("should not mutate the original appointment", () => {
      const appt = Appointment.create(makeProps());
      appt.markAsNotified(new Date());

      expect(appt.notifiedAt).toBeUndefined();
    });
  });

  describe("withMetadata", () => {
    it("should return a new Appointment instance", () => {
      const appt = Appointment.create(makeProps());
      const updated = appt.withMetadata("key", "value");

      expect(updated).not.toBe(appt);
      expect(updated).toBeInstanceOf(Appointment);
    });

    it("should add the given key/value to metadata", () => {
      const appt = Appointment.create(makeProps());
      const updated = appt.withMetadata("source", "app");

      expect(updated.metadata["source"]).toBe("app");
    });

    it("should accept a Date as metadata value", () => {
      const date = new Date("2026-01-01T00:00:00Z");
      const appt = Appointment.create(makeProps());
      const updated = appt.withMetadata("confirmedAt", date);

      expect(updated.metadata["confirmedAt"]).toEqual(date);
    });

    it("should accept null as metadata value", () => {
      const appt = Appointment.create(makeProps());
      const updated = appt.withMetadata("removedField", null);

      expect(updated.metadata["removedField"]).toBeNull();
    });

    it("should preserve existing metadata keys", () => {
      const appt = Appointment.create(makeProps({ metadata: { existing: "yes" } }));
      const updated = appt.withMetadata("newKey", "newVal");

      expect(updated.metadata["existing"]).toBe("yes");
      expect(updated.metadata["newKey"]).toBe("newVal");
    });

    it("should not mutate the original metadata", () => {
      const appt = Appointment.create(makeProps());
      appt.withMetadata("key", "value");

      expect(appt.metadata["key"]).toBeUndefined();
    });
  });
  describe("type and durationMinutes", () => {
    it("should default durationMinutes to 50 when not provided (legacy records)", () => {
      const appt = Appointment.create(makeProps());

      expect(appt.durationMinutes).toBe(50);
      expect(appt.type).toBeUndefined();
    });

    it("should keep the provided type and durationMinutes", () => {
      const appt = Appointment.create(makeProps({ type: "Avaliação", durationMinutes: 90 }));

      expect(appt.type).toBe("Avaliação");
      expect(appt.durationMinutes).toBe(90);
    });

    it("should update type and durationMinutes while PENDING", () => {
      const appt = Appointment.create(makeProps());
      const updated = updateOk(appt, { type: "Sessão", durationMinutes: 30 });

      expect(updated.type).toBe("Sessão");
      expect(updated.durationMinutes).toBe(30);
    });
  });

  describe("update when not PENDING", () => {
    const cancelledAppt = () => Appointment.create(makeProps({ status: AppointmentStatus.CANCELLED }));
    const completedAppt = () => Appointment.create(makeProps({ status: AppointmentStatus.COMPLETED }));

    it("should block scheduledAt change on a CANCELLED appointment", () => {
      const result = cancelledAppt().update({ scheduledAt: new Date("2026-08-01T10:00:00Z") });

      expect(result).toEqual({ ok: false, error: "APPOINTMENT_NOT_EDITABLE" });
    });

    it("should block type change on a CANCELLED appointment", () => {
      const result = cancelledAppt().update({ type: "Sessão" });

      expect(result).toEqual({ ok: false, error: "APPOINTMENT_NOT_EDITABLE" });
    });

    it("should block durationMinutes change on a COMPLETED appointment", () => {
      const result = completedAppt().update({ durationMinutes: 30 });

      expect(result).toEqual({ ok: false, error: "APPOINTMENT_NOT_EDITABLE" });
    });

    it("should allow observation change on a CANCELLED appointment", () => {
      const updated = updateOk(cancelledAppt(), { observation: "Remarcar depois" });

      expect(updated.observation).toBe("Remarcar depois");
      expect(updated.status).toBe(AppointmentStatus.CANCELLED);
    });

    it("should accept unchanged schedule values on a CANCELLED appointment", () => {
      const appt = cancelledAppt();
      const result = appt.update({ scheduledAt: new Date(appt.scheduledAt), durationMinutes: 50 });

      expect(result.ok).toBe(true);
    });
  });

  describe("changeStatus", () => {
    const withStatus = (status: AppointmentStatus) => Appointment.create(makeProps({ status }));

    it.each([
      [AppointmentStatus.PENDING, AppointmentStatus.COMPLETED],
      [AppointmentStatus.PENDING, AppointmentStatus.CANCELLED],
      [AppointmentStatus.CANCELLED, AppointmentStatus.PENDING],
    ])("should allow %s -> %s", (from, to) => {
      const appt = withStatus(from);
      const result = appt.changeStatus(to);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.status).toBe(to);
      expect(result.value).not.toBe(appt);
      expect(appt.status).toBe(from);
    });

    it.each([
      [AppointmentStatus.COMPLETED, AppointmentStatus.PENDING],
      [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED],
      [AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED],
    ])("should reject %s -> %s", (from, to) => {
      const result = withStatus(from).changeStatus(to);

      expect(result).toEqual({ ok: false, error: "INVALID_STATUS_TRANSITION" });
    });

    it.each([AppointmentStatus.PENDING, AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED])(
      "should treat %s -> same status as a no-op",
      (status) => {
        const appt = withStatus(status);
        const result = appt.changeStatus(status);

        expect(result).toEqual({ ok: true, value: appt });
      }
    );
  });

  describe("overlaps", () => {
    const at = (iso: string, durationMinutes?: number) =>
      Appointment.create(makeProps({ scheduledAt: new Date(iso), durationMinutes }));

    it("should detect partial overlap", () => {
      const a = at("2026-07-01T10:00:00Z", 60);
      const b = at("2026-07-01T10:30:00Z", 60);

      expect(a.overlaps(b)).toBe(true);
      expect(b.overlaps(a)).toBe(true);
    });

    it("should detect an interval contained in another", () => {
      const outer = at("2026-07-01T10:00:00Z", 120);
      const inner = at("2026-07-01T10:30:00Z", 30);

      expect(outer.overlaps(inner)).toBe(true);
      expect(inner.overlaps(outer)).toBe(true);
    });

    it("should not consider touching intervals (end = start) as overlapping", () => {
      const a = at("2026-07-01T10:00:00Z", 60);
      const b = at("2026-07-01T11:00:00Z", 60);

      expect(a.overlaps(b)).toBe(false);
      expect(b.overlaps(a)).toBe(false);
    });

    it("should not consider disjoint intervals as overlapping", () => {
      const a = at("2026-07-01T10:00:00Z", 30);
      const b = at("2026-07-01T14:00:00Z", 30);

      expect(a.overlaps(b)).toBe(false);
    });

    it("should use the 50-minute default duration for legacy records", () => {
      const legacy = at("2026-07-01T10:00:00Z");

      expect(legacy.overlaps(at("2026-07-01T10:49:00Z", 15))).toBe(true);
      expect(legacy.overlaps(at("2026-07-01T10:50:00Z", 15))).toBe(false);
    });
  });
});
