/**
 * Lista de Feriados Nacionais Brasileiros
 * 9 feriados fixos + 4 feriados móveis = 13 feriados por ano
 */

// Feriados FIXOS por lei federal (mês é 1-indexed: janeiro = 1)
const FIXED_HOLIDAYS = [
  { month: 1, day: 1, name: "Confraternização Universal" },
  { month: 4, day: 21, name: "Tiradentes" },
  { month: 5, day: 1, name: "Dia do Trabalho" },
  { month: 9, day: 7, name: "Independência do Brasil" },
  { month: 10, day: 12, name: "Nossa Senhora Aparecida" },
  { month: 11, day: 2, name: "Finados" },
  { month: 11, day: 15, name: "Proclamação da República" },
  { month: 11, day: 20, name: "Consciência Negra" }, // Lei 14.759/2023
  { month: 12, day: 25, name: "Natal" },
];

/**
 * Calcula a data da Páscoa para um determinado ano
 * Usando o algoritmo de Meeus/Jones/Butcher
 */
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 12, 0, 0);
}

/**
 * Adiciona dias a uma data
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Gera os feriados móveis para um determinado ano
 * Baseados na data da Páscoa:
 * - Carnaval Segunda: 48 dias antes da Páscoa
 * - Carnaval Terça: 47 dias antes da Páscoa
 * - Sexta-feira Santa: 2 dias antes da Páscoa
 * - Corpus Christi: 60 dias após a Páscoa
 */
function getMovableHolidays(year: number): { date: Date; name: string }[] {
  const easter = getEasterDate(year);
  
  return [
    { date: addDays(easter, -48), name: "Carnaval (Segunda)" },
    { date: addDays(easter, -47), name: "Carnaval (Terça)" },
    { date: addDays(easter, -2), name: "Sexta-feira Santa" },
    { date: addDays(easter, 60), name: "Corpus Christi" },
  ];
}

/**
 * Verifica se uma data é feriado nacional brasileiro
 * @param date Data a ser verificada
 * @returns true se for feriado, false caso contrário
 */
export function isHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // getMonth retorna 0-11
  const day = date.getDate();
  
  // Verificar feriados fixos
  const isFixed = FIXED_HOLIDAYS.some(h => h.month === month && h.day === day);
  if (isFixed) return true;
  
  // Verificar feriados móveis
  const movableHolidays = getMovableHolidays(year);
  return movableHolidays.some(holiday => 
    holiday.date.getFullYear() === year &&
    holiday.date.getMonth() === date.getMonth() &&
    holiday.date.getDate() === day
  );
}

/**
 * Obtém todos os feriados de um determinado ano
 * @param year Ano para buscar os feriados
 * @returns Array de objetos com data e nome do feriado
 */
export function getHolidaysForYear(year: number): { date: Date; name: string }[] {
  const holidays: { date: Date; name: string }[] = [];
  
  // Adicionar feriados fixos
  for (const h of FIXED_HOLIDAYS) {
    holidays.push({
      date: new Date(year, h.month - 1, h.day, 12, 0, 0),
      name: h.name
    });
  }
  
  // Adicionar feriados móveis
  const movable = getMovableHolidays(year);
  holidays.push(...movable);
  
  // Ordenar por data
  holidays.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  return holidays;
}

/**
 * Obtém o nome do feriado se a data for um feriado
 * @param date Data a ser verificada
 * @returns Nome do feriado ou null se não for feriado
 */
export function getHolidayName(date: Date): string | null {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  // Verificar feriados fixos
  const fixedHoliday = FIXED_HOLIDAYS.find(h => h.month === month && h.day === day);
  if (fixedHoliday) return fixedHoliday.name;
  
  // Verificar feriados móveis
  const movableHolidays = getMovableHolidays(year);
  const movableHoliday = movableHolidays.find(holiday => 
    holiday.date.getFullYear() === year &&
    holiday.date.getMonth() === date.getMonth() &&
    holiday.date.getDate() === day
  );
  
  return movableHoliday?.name || null;
}
