import { Trainee } from '../types';

/**
 * Comprehensive trainee data validation and cleaning utilities
 */

export interface ValidationResult {
  isValid: boolean;
  cleanedData: Trainee[];
  errors: string[];
  warnings: string[];
}

/**
 * Validates and cleans a single trainee record
 */
export function validateTraineeRecord(trainee: any, index: number): { isValid: boolean; cleanedTrainee: Trainee; errors: string[] } {
  const errors: string[] = [];
  const cleanedTrainee: any = { ...trainee };
  const cleanText = (value: any): string => {
    const text = String(value ?? '').trim();
    return text === 'undefined' || text === 'null' ? '' : text;
  };
  const name = cleanText(trainee.name);
  const fullName = cleanText(trainee.fullName);

  // Validate required fields
  if (!name && !fullName) {
    errors.push(`Trainee at index ${index}: Missing both name and fullName`);
  }
  cleanedTrainee.name = name || fullName;
  cleanedTrainee.fullName = fullName || name;

  // Validate course
  cleanedTrainee.course = cleanText(trainee.course);
  if (!cleanedTrainee.course) {
    errors.push(`Trainee ${cleanedTrainee.name || `at index ${index}`}: Missing course`);
  }

  // Preserve missing configured fields as blank data instead of writing demo placeholders.
  cleanedTrainee.class = cleanText(trainee.class);
  cleanedTrainee.squadron = cleanText(trainee.squadron);
  cleanedTrainee.status = trainee.status ?? 'Active';
  cleanedTrainee.rank = cleanText(trainee.rank);
  // Normalize instructor fields to arrays
  const normInstr = (val: any): string[] => {
    if (!val || val === 'Unassigned') return [];
    if (Array.isArray(val)) return val.filter(Boolean);
    return [val];
  };
  cleanedTrainee.primaryInstructor = normInstr(trainee.primaryInstructor);
  cleanedTrainee.secondaryInstructor = normInstr(trainee.secondaryInstructor);
  cleanedTrainee.lastEventDate = trainee.lastEventDate ?? null;
  cleanedTrainee.lastFlightDate = trainee.lastFlightDate ?? null;

  // Ensure boolean fields are actually boolean
  cleanedTrainee.isPaused = Boolean(trainee.isPaused);
  cleanedTrainee.isCompleted = Boolean(trainee.isCompleted);

  return {
    isValid: errors.length === 0,
    cleanedTrainee,
    errors
  };
}

/**
 * Validates and cleans an array of trainee records
 */
export function validateTraineeData(trainees: any[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const cleanedData: Trainee[] = [];

  trainees.forEach((trainee, index) => {
    // Skip completely empty records
    if (!trainee || (typeof trainee === 'object' && Object.keys(trainee).length === 0)) {
      warnings.push(`Skipping completely empty record at index ${index}`);
      return;
    }

    const result = validateTraineeRecord(trainee, index);
    cleanedData.push(result.cleanedTrainee);
    errors.push(...result.errors);

    // Add warnings for potential data issues
    if (!result.cleanedTrainee.course) {
      warnings.push(`Trainee ${result.cleanedTrainee.name || `at index ${index}`} has no course assigned`);
    }
    const primArr = Array.isArray(result.cleanedTrainee.primaryInstructor) ? result.cleanedTrainee.primaryInstructor : result.cleanedTrainee.primaryInstructor ? [result.cleanedTrainee.primaryInstructor] : [];
    if (primArr.length === 0) {
      warnings.push(`Trainee ${result.cleanedTrainee.name || `at index ${index}`} has no primary instructor`);
    }
  });

  // Remove duplicates based on name
  const uniqueTrainees = cleanedData.filter((trainee, index, arr) => 
    arr.findIndex(t => t.name === trainee.name || t.fullName === trainee.fullName) === index
  );

  if (uniqueTrainees.length < cleanedData.length) {
    warnings.push(`Removed ${cleanedData.length - uniqueTrainees.length} duplicate trainee records`);
  }

  return {
    isValid: errors.length === 0,
    cleanedData: uniqueTrainees,
    errors,
    warnings
  };
}

/**
 * Safe wrapper to process trainee data for display
 */
export function safeProcessTrainees(trainees: any[]): Trainee[] {
  try {
    const result = validateTraineeData(trainees);

    if (result.warnings.length > 0) {
      console.warn('🟡 Trainee data warnings:', result.warnings);
    }
    if (result.errors.length > 0) {
      console.error('🟡 Trainee data errors:', result.errors);
    }

    return result.cleanedData;
  } catch (error) {
    console.error('🟡 Error processing trainee data:', error);
    const fallbackData = trainees.filter(t => t != null).map(t => ({
      ...t,
      name: t?.name ?? t?.fullName ?? '',
      fullName: t?.fullName ?? t?.name ?? '',
      course: t?.course ?? ''
    }));
    return fallbackData;
  }
}
