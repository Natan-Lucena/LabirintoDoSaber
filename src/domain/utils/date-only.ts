// Datas sem hora no formato AAAA-MM-DD. Comparar como string respeita a
// ordem cronológica, então não convertemos para Date fora daqui.
const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDateOnly(value: string): boolean {
  const match = DATE_ONLY_REGEX.exec(value);
  if (!match) return false;

  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function dateInSaoPaulo(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

export function todayInSaoPaulo(now: Date = new Date()): string {
  return dateInSaoPaulo(now);
}

export function addMonths(dateOnly: string, months: number): string {
  const [year, month, day] = dateOnly.split("-").map(Number);
  // Limita ao último dia do mês de destino (31/01 + 1 mês = 28 ou 29/02).
  const lastDayOfTarget = new Date(Date.UTC(year, month + months, 0)).getUTCDate();
  const date = new Date(
    Date.UTC(year, month - 1 + months, Math.min(day, lastDayOfTarget))
  );
  return date.toISOString().slice(0, 10);
}

export function addDays(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// Início e fim do dia em America/Sao_Paulo, como instante UTC. O Brasil não
// tem horário de verão desde 2019, então o fuso é fixo em -03:00.
export function startOfDayInSaoPaulo(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000-03:00`);
}

export function endOfDayInSaoPaulo(dateOnly: string): Date {
  return new Date(`${dateOnly}T23:59:59.999-03:00`);
}
