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

export function todayInSaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(now);
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
