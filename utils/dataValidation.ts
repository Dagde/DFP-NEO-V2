/**
 * Data validation and safety utilities for handling undefined/null data
 */

/**
 * Safely gets a string value, providing fallback for undefined/null
 */
export function safeString(value: string | undefined | null, fallback: string = ''): string {
  return value ?? fallback;
}

/**
 * Safely performs locale comparison with fallback values
 */
export function safeLocaleCompare(a: string | undefined | null, b: string | undefined | null, fallback: string = ''): number {
  const safeA = safeString(a, fallback);
  const safeB = safeString(b, fallback);
  return safeA.localeCompare(safeB);
}

/**
 * Safe sorting function for trainee data
 */
export function safeSortByString<T>(
  array: T[], 
  getString: (item: T) => string | undefined | null,
  fallback: string = ''
): T[] {
  return [...array].sort((a, b) => {
    const valueA = getString(a);
    const valueB = getString(b);
    return safeLocaleCompare(valueA, valueB, fallback);
  });
}

/**
 * Validates trainee object and provides safe defaults
 */
export function validateTrainee(trainee: any) {
  const cleanText = (value: any): string => {
    const text = String(value ?? '').trim();
    return text === 'undefined' || text === 'null' ? '' : text;
  };
  const name = cleanText(trainee?.name);
  const fullName = cleanText(trainee?.fullName);

  return {
    ...trainee,
    name: name || fullName,
    fullName: fullName || name,
    course: cleanText(trainee?.course),
  };
}

/**
 * Filters out invalid trainee records
 */
export function filterValidTrainees(trainees: any[]): any[] {
  return trainees.filter(trainee => {
    // Keep records that have at least some identifying information
    return trainee && (
      trainee.name || 
      trainee.fullName || 
      trainee.course ||
      trainee.id ||
      trainee._id
    );
  });
}

/**
 * Comprehensive trainee data cleaning
 */
export function cleanTraineeData(trainees: any[]): any[] {
  return filterValidTrainees(trainees).map(validateTrainee);
}
