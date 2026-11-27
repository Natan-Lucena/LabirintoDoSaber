// Partículas que não contam como sobrenome ("Ana de Souza" → "Ana S.").
const NAME_PARTICLES = new Set(["de", "da", "do", "dos", "das"]);

// Primeiro nome + inicial do primeiro sobrenome com ponto ("Ana Souza Lima" →
// "Ana S."). Nome único fica como está. Usado no relatório para a escola (RP-02).
export function shortDisplayName(fullName: string): string {
  const [first = "", ...rest] = fullName.trim().split(/\s+/);
  const surname = rest.find((part) => !NAME_PARTICLES.has(part.toLowerCase()));
  if (!surname) return first;
  return `${first} ${surname.charAt(0).toUpperCase()}.`;
}
