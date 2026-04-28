/**
 * Safe sorting utilities to prevent crashes from undefined data
 */

/**
 * Safely sorts an array of objects by a string property
 */
export function safeSortByProperty<T>(
  array: T[], 
  getProperty: (item: T) => string | undefined | null,
  fallback: string = ''
): T[] {
  return [...array].sort((a, b) => {
    const valueA = getProperty(a) ?? fallback;
    const valueB = getProperty(b) ?? fallback;
    return valueA.localeCompare(valueB);
  });
}

/**
 * Safe trainee sorting by course then name
 */
export function safeSortTrainees(trainees: any[]): any[] {
  return trainees
    .filter(trainee => trainee != null) // Remove null/undefined
    .sort((a, b) => {
      // First sort by course
      const courseA = a?.course ?? 'No Course';
      const courseB = b?.course ?? 'No Course';
      if (courseA !== courseB) {
        return courseA.localeCompare(courseB);
      }
      // Then sort by name
      const nameA = a?.name ?? a?.fullName ?? 'Unknown';
      const nameB = b?.name ?? b?.fullName ?? 'Unknown';
      return nameA.localeCompare(nameB);
    });
}

/**
 * Safe instructor sorting by name
 */
export function safeSortInstructors(instructors: any[]): any[] {
  return instructors
    .filter(instructor => instructor != null)
    .sort((a, b) => {
      const nameA = a?.name ?? 'Unknown';
      const nameB = b?.name ?? 'Unknown';
      return nameA.localeCompare(nameB);
    });
}

/**
 * Safe locale compare function
 */
export function safeLocaleCompare(a: string | undefined | null, b: string | undefined | null, fallback: string = ''): number {
  const safeA = a ?? fallback;
  const safeB = b ?? fallback;
  return safeA.localeCompare(safeB);
}