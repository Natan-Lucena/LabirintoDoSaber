import { z } from "zod";
import { ReportShareChannel } from "../../../../domain/entities/report";

export const shareReportSchema = z.object({
  channel: z.nativeEnum(ReportShareChannel),
});
