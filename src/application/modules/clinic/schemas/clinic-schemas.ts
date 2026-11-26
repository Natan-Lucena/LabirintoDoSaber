import z from "zod";
import { CLINIC_NAME_MAX, CLINIC_NAME_MIN } from "../../../../domain/entities/clinic";

const teamRole = z.enum(["ADMIN", "PROFESSIONAL"]);
const clinicName = z.string().trim().min(CLINIC_NAME_MIN).max(CLINIC_NAME_MAX);

export const createClinicSchema = z.object({ name: clinicName });

export const updateClinicSchema = z.object({ name: clinicName });

export const createClinicInviteSchema = z.object({ role: teamRole });

export const acceptClinicInviteSchema = z.object({ code: z.string().trim().min(1).max(32) });

export const updateClinicMemberRoleSchema = z.object({ role: teamRole });
