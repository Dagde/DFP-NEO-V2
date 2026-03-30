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

  // Validate required fields
  if (!trainee.name && !trainee.fullName) {
    errors.push(`Trainee at index ${index}: Missing both name and fullName`);
    cleanedTrainee.name = 'Unknown Trainee';
    cleanedTrainee.fullName = 'Unknown Trainee';
  } else {
    cleanedTrainee.name = trainee.name ?? trainee.fullName ?? 'Unknown';
    cleanedTrainee.fullName = trainee.fullName ?? trainee.name ?? 'Unknown';
  }

  // Validate course
  if (!trainee.course) {
    errors.push(`Trainee ${cleanedTrainee.name}: Missing course`);
    cleanedTrainee.course = 'No Course';
  }

  // Validate other fields with safe defaults
  cleanedTrainee.class = trainee.class ?? 'No Class';
  cleanedTrainee.squadron = trainee.squadron ?? 'No Squadron';
  cleanedTrainee.status = trainee.status ?? 'Active';
  cleanedTrainee.rank = trainee.rank ?? 'Trainee';
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
    if (result.cleanedTrainee.course === 'No Course') {
      warnings.push(`Trainee ${result.cleanedTrainee.name} has no course assigned`);
    }
    const primArr = Array.isArray(result.cleanedTrainee.primaryInstructor) ? result.cleanedTrainee.primaryInstructor : result.cleanedTrainee.primaryInstructor ? [result.cleanedTrainee.primaryInstructor] : [];
    if (primArr.length === 0) {
      warnings.push(`Trainee ${result.cleanedTrainee.name} has no primary instructor`);
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
  console.log('🟡 ========== DATA VALIDATION START ==========');
  console.log('🟡 Input trainees count:', trainees.length);
  console.log('🟡 Input trainees sample:', trainees.slice(0, 3));
  
  try {
    const result = validateTraineeData(trainees);
    
    console.log('🟡 Validation complete:');
    console.log('🟡 - Cleaned data count:', result.cleanedData.length);
    console.log('🟡 - Warnings count:', result.warnings.length);
    console.log('🟡 - Errors count:', result.errors.length);
    console.log('🟡 - Cleaned data sample:', result.cleanedData.slice(0, 3));
    
    // Log warnings and errors to console for debugging
    if (result.warnings.length > 0) {
      console.warn('🟡 Trainee data warnings:', result.warnings);
    }
    if (result.errors.length > 0) {
      console.error('🟡 Trainee data errors:', result.errors);
    }

    console.log('🟡 ========== DATA VALIDATION END ==========');
    return result.cleanedData;
  } catch (error) {
    console.error('🟡 Error processing trainee data:', error);
    const fallbackData = trainees.filter(t => t != null).map(t => ({
      ...t,
      name: t?.name ?? t?.fullName ?? 'Unknown',
      fullName: t?.fullName ?? t?.name ?? 'Unknown',
      course: t?.course ?? 'No Course'
    }));
    console.log('🟡 Fallback data count:', fallbackData.length);
    console.log('🟡 ========== DATA VALIDATION END ==========');
    return fallbackData;
  }
}