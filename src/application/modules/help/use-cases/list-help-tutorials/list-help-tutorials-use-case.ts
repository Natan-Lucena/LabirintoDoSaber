import { success } from "@wave-telecom/framework/core";
import { HelpTutorialRepository } from "../../../../../domain/repositories/help-tutorial-repository";
import { mapHelpTutorialToResponse } from "../../../../../infraestructure/mappers/map-help-tutorial";

// GET /help/tutorials (BE-AJ-01): por order e no máximo um em destaque. O seed
// já garante isso; a lista também, caso o banco seja editado à mão.
export class ListHelpTutorialsUseCase {
  constructor(private helpTutorialRepository: HelpTutorialRepository) {}

  async execute() {
    const tutorials = (await this.helpTutorialRepository.listAll()).sort(
      (a, b) => a.order - b.order
    );
    const featuredId = tutorials.find((tutorial) => tutorial.featured)?.id.value;

    return success(
      tutorials.map((tutorial) =>
        mapHelpTutorialToResponse(tutorial, tutorial.id.value === featuredId)
      )
    );
  }
}
