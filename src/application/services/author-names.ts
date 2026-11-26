import { Uuid } from "@wave-telecom/framework/core";
import { EducatorRepository } from "../../domain/repositories/educator-repository";

// EQ-12: nome do autor dos registros que não são de quem lê, numa consulta
// só. O mapa traz só os autores diferentes do leitor; quem não está nele não
// ganha authorName na resposta.
export async function loadAuthorNames(
  educatorRepository: EducatorRepository,
  authorIds: Uuid[],
  readerId: Uuid
): Promise<Map<string, string>> {
  const others = [...new Set(authorIds.map((id) => id.value))].filter(
    (id) => id !== readerId.value
  );
  if (others.length === 0) return new Map();

  const educators = await educatorRepository.getByIds(others.map((id) => new Uuid(id)));
  return new Map(educators.map((educator) => [educator.id.value, educator.name]));
}
