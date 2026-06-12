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
      const updated = appt.update({ scheduledAt: new Date("2026-08-01T10:00:00Z") });

      expect(updated).not.toBe(appt);
      expect(updated).toBeInstanceOf(Appointment);
    });

    it("should update scheduledAt", () => {
      const newDate = new Date("2026-08-01T10:00:00Z");
      const appt = Appointment.create(makeProps());
      const updated = appt.update({ scheduledAt: newDate });

      expect(updated.scheduledAt).toEqual(newDate);
    });

    it("should update observation", () => {
      const appt = Appointment.create(makeProps({ observation: "Old note" }));
      const updated = appt.update({ observation: "New note" });

      expect(updated.observation).toBe("New note");
    });

    it("should allow clearing observation by setting it to null", () => {
      const appt = Appointment.create(makeProps({ observation: "Old note" }));
      const updated = appt.update({ observation: null });

      expect(updated.observation).toBeUndefined();
    });

    it("should preserve unchanged fields", () => {
      const educatorId = Uuid.random();
      const studentId = Uuid.random();
      const appt = Appointment.create({ educatorId, studentId, scheduledAt: new Date("2026-07-01T10:00:00Z") });
      const updated = appt.update({ scheduledAt: new Date("2026-08-01T10:00:00Z") });

      expect(updated.educatorId).toBe(educatorId);
      expect(updated.studentId).toBe(studentId);
      expect(updated.id).toBe(appt.id);
    });

    it("should not mutate the original appointment", () => {
      const original = new Date("2026-07-01T10:00:00Z");
      const appt = Appointment.create(makeProps({ scheduledAt: original }));
      appt.update({ scheduledAt: new Date("2026-08-01T10:00:00Z") });

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
});
