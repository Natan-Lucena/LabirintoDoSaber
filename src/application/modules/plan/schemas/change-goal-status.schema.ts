import { z } from "zod";
import { GoalStatus } from "../../../../domain/entities/plan";

export const changeGoalStatusSchema = z.object({
  status: z.nativeEnum(GoalStatus),
});
