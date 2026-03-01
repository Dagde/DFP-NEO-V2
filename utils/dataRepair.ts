import { Trainee } from '../types';
import { safeProcessTrainees } from './traineeDataValidator';

/**
 * Data repair utilities for fixing corrupted trainee data
 */

/**
 * Attempts to repair existing corrupted trainee data
 */
export function repairTraineeData(trainees: any[]): Trainee[] {
  return trainees.map(trainee => {
    if (!trainee) return null;

    // Basic repair for missing critical fields
    const repaired = { ...trainee };

    // Repair name fields
    if (!trainee.name && !trainee.fullName) {
      repaired.name = 'Unknown Trainee';
      repaired.fullName = 'Unknown Trainee';
    } else if (!trainee.name) {
      repaired.name = trainee.fullName;
    } else if (!trainee.fullName) {
      repaired.fullName = trainee.name;
    }

    // Repair course field
    if (!trainee.course || trainee.course === 'undefined' || trainee.course === 'null') {
      repaired.course = 'No Course';
    }

    // Repair other critical string fields
    const stringFields = ['class', 'squadron', 'rank', 'primaryInstructor', 'secondaryInstructor'];
    stringFields.forEach(field => {
      if (!trainee[field] || trainee[field] === 'undefined' || trainee[field] === 'null') {
        repaired[field] = field.includes('instructor') ? 'Unassigned' : 'Unknown';
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
      
      console.log(`Repaired ${validatedData.length} trainee records`);
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