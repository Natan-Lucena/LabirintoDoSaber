import { AnamneseResponse } from "../../domain/entities/anamnese-response";

// Mesmo formato que a entidade já tinha no JSON, mais a síntese (AS-02).
export function mapAnamneseResponse(response: AnamneseResponse) {
  return {
    id: response.id.value,
    templateId: response.templateId.value,
    educatorId: response.educatorId.value,
    studentId: response.studentId.value,
    answers: response.answers.map((answer) => ({
      questionId: answer.questionId,
      questionType: answer.questionType,
      textValue: answer.textValue,
      selectedOptionId: answer.selectedOptionId,
      selectedOptionIds: answer.selectedOptionIds,
      fileUrl: answer.fileUrl,
    })),
    answeredAt: response.answeredAt,
    updatedAt: response.updatedAt,
    summary: response.summary
      ? { text: response.summary.text, generatedAt: response.summary.generatedAt }
      : undefined,
    summaryOutdated: response.summaryOutdated,
  };
}
