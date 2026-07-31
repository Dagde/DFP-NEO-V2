import { Trainee } from '../types';
import { safeProcessTrainees } from './traineeDataValidator';

/**
 * Data repair utilities for fixing corrupted trainee data
 */

/**
 * Attempts to repair existing corrupted trainee data
 */
export function repairTraineeData(trainees: any[]): Trainee[] {
  const cleanText = (value: any): string => {
    const text = String(value ?? '').trim();
    return text === 'undefined' || text === 'null' ? '' : text;
  };

  return trainees.map(trainee => {
    if (!trainee) return null;

    // Basic repair for missing critical fields
    const repaired = { ...trainee };

    // Repair mirrored fields without inventing placeholder trainee/course data.
    const name = cleanText(trainee.name);
    const fullName = cleanText(trainee.fullName);
    repaired.name = name || fullName;
    repaired.fullName = fullName || name;
    repaired.course = cleanText(trainee.course);

    // Repair other critical string fields
    const stringFields = ['class', 'squadron', 'rank'];
    stringFields.forEach(field => {
      repaired[field] = cleanText(trainee[field]);
    });
    // Repair instructor fields - normalize to arrays
    ['primaryInstructor', 'secondaryInstructor'].forEach(field => {
      const val = trainee[field];
      if (!val || val === 'undefined' || val === 'null' || val === 'Unassigned') {
        repaired[field] = [];
      } else if (Array.isArray(val)) {
        repaired[field] = val.filter(Boolean);
      } else {
        repaired[field] = [val];
      }
    });

    // Repair boolean fields
    repaired.isPaused = Boolean(trainee.isPaused);
    repaired.isCompleted = Boolean(trainee.isCompleted);

    return repaired;
  }).filter(Boolean);
}

/**
 * One-time data repair function that can be called to fix existing data
 */
export function performDataRepair(): Trainee[] {
  try {
    // Get current data from localStorage (if it exists)
    const storedData = localStorage.getItem('traineesData');
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      const repairedData = repairTraineeData(parsedData);
      const validatedData = safeProcessTrainees(repairedData);
      
      // Store the repaired data back
      localStorage.setItem('traineesData', JSON.stringify(validatedData));

      return validatedData;
    }
  } catch (error) {
    console.error('Error during data repair:', error);
  }
  
  return [];
}

/**
 * Creates a data validation report
 */
export function createDataValidationReport(trainees: any[]): {
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  issues: string[];
} {
  const issues: string[] = [];
  let invalidRecords = 0;

  trainees.forEach((trainee, index) => {
    if (!trainee) {
      issues.push(`Record ${index}: Completely empty`);
      invalidRecords++;
      return;
    }

    if (!trainee.name && !trainee.fullName) {
      issues.push(`Record ${index}: Missing name and fullName`);
      invalidRecords++;
    }

    if (!trainee.course || trainee.course === 'undefined' || trainee.course === 'null') {
      issues.push(`Record ${index}: Invalid course: ${trainee.course}`);
      invalidRecords++;
    }

    // Check for undefined string values
    Object.keys(trainee).forEach(key => {
      if (typeof trainee[key] === 'string' && (trainee[key] === 'undefined' || trainee[key] === 'null')) {
        issues.push(`Record ${index}: Field ${key} has invalid value: ${trainee[key]}`);
      }
    });
  });

  return {
    totalRecords: trainees.length,
    validRecords: trainees.length - invalidRecords,
    invalidRecords,
    issues
  };
}
