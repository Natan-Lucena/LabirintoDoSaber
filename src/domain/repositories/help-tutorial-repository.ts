import { Uuid } from "@wave-telecom/framework/core";
import { HelpTutorial } from "../entities/help-tutorial";

export interface HelpTutorialRepository {
  // Ordenado por order.
  listAll(): Promise<HelpTutorial[]>;
  save(tutorial: HelpTutorial): Promise<void>;
  deleteByIds(ids: Uuid[]): Promise<void>;
}
