/**
 * Filters out invalid date strings from installment_dates arrays.
 * Prevents RangeError: Invalid time value when calling format() on invalid dates.
 */
export const safeDates = (dates: unknown): string[] => {
  if (!Array.isArray(dates)) return [];
  return (dates as string[]).filter(d => typeof d === 'string' && d.trim().length >= 10);
};

/**
 * Gets safe installment dates from a loan object.
 */
export const getSafeDates = (loan: { installment_dates?: unknown }): string[] => {
  return safeDates(loan.installment_dates);
};
