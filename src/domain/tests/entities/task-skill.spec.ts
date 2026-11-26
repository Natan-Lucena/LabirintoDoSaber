import { describe, it, expect } from "vitest";
import { TaskSkill } from "../../entities/task-skill";

const skill = (learningTopics: string[]) => {
  const created = TaskSkill.create({ code: "LEITURA", label: "Leitura", learningTopics, order: 1 });
  if (!created.ok) throw new Error("fixture");
  return created.value;
};

describe("TaskSkill.matchesAnyTopic", () => {
  it("casa o tema inteiro sem acento e maiúscula", () => {
    expect(skill(["alfabetização"]).matchesAnyTopic(["ALFABETIZACAO"])).toBe(true);
  });

  it("casa quando o tópico aparece como palavra(s) no tema do aluno", () => {
    expect(skill(["leitura"]).matchesAnyTopic(["Dificuldade de leitura"])).toBe(true);
    expect(skill(["compreensão de texto"]).matchesAnyTopic(["Baixa compreensão de texto."])).toBe(
      true
    );
    expect(skill(["TDAH"]).matchesAnyTopic(["Suspeita de TDAH (em avaliação)"])).toBe(true);
  });

  it("não casa pedaço de palavra nem tema sem o tópico", () => {
    expect(skill(["leitura"]).matchesAnyTopic(["Releitura de textos"])).toBe(false);
    expect(skill(["cores"]).matchesAnyTopic(["Escrita"])).toBe(false);
    expect(skill(["leitura"]).matchesAnyTopic([])).toBe(false);
  });
});
