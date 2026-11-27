import { HelpTutorial } from "../../domain/entities/help-tutorial";

// Opcionais ausentes ficam fora do JSON.
export const mapHelpTutorialToResponse = (tutorial: HelpTutorial, featured: boolean) => ({
  id: tutorial.id.value,
  order: tutorial.order,
  title: tutorial.title,
  description: tutorial.description,
  durationSeconds: tutorial.durationSeconds,
  featured,
  ...(tutorial.videoUrl !== undefined && { videoUrl: tutorial.videoUrl }),
  ...(tutorial.thumbnailUrl !== undefined && { thumbnailUrl: tutorial.thumbnailUrl }),
  ...(tutorial.steps !== undefined && { steps: tutorial.steps }),
});
