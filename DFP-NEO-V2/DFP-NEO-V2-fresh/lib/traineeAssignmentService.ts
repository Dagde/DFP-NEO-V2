// Trainee Assignment Service
// Provides logic for assigning trainees to instructors based on unit-based constraints
// Supports multiple primary and secondary instructors per trainee (stored as arrays)

import { Trainee, Instructor } from '../types';

export interface AssignmentResult {
  trainees: Trainee[];
  summary: {
    totalInstructors: number;
    totalTrainees: number;
    assignmentsMade: number;
    instructorsWith2Primaries: number;
    instructorsWith2Secondaries: number;
    traineesWithPrimary: number;
    traineesWithSecondary: number;
  };
}

// Helper: normalize instructor field to string array
export function toInstructorArray(val: string | string[] | undefined | null): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return val ? [val] : [];
}

/**
 * Assigns trainees to instructors based on the following rules:
 * 1. Each trainee gets minimum 2 primary instructors from their own unit
 * 2. Each trainee gets minimum 2 secondary instructors from their own unit
 * 3. Each instructor handles max 3 primary and max 3 secondary trainees
 * 4. Trainees assigned to instructors from their own unit only
 * 5. Primary and secondary instructors should differ where possible
 */
export function assignTraineesToInstructors(
  trainees: Trainee[],
  instructors: Instructor[]
): AssignmentResult {
  console.log('🎓 Starting trainee assignment...');
  console.log(`  Instructors: ${instructors.length}`);
  console.log(`  Trainees: ${trainees.length}`);

  // Filter for allocatable instructors (QFIs only)
  const allocatableInstructors = instructors.filter(i => i.role === 'QFI');
  console.log(`  Allocatable (QFI) instructors: ${allocatableInstructors.length}`);

  if (!allocatableInstructors.length) {
    console.warn('⚠️ No QFI instructors found - no assignments made');
    return {
      trainees,
      summary: {
        totalInstructors: instructors.length,
        totalTrainees: trainees.length,
        assignmentsMade: 0,
        instructorsWith2Primaries: 0,
        instructorsWith2Secondaries: 0,
        traineesWithPrimary: 0,
        traineesWithSecondary: 0,
      },
    };
  }

  // Filter eligible trainees (exclude FIC courses)
  const eligibleTrainees = trainees.filter(t => !t.course?.includes('FIC'));
  const ficTrainees = trainees.filter(t => t.course?.includes('FIC'));
  console.log(`  Eligible trainees (non-FIC): ${eligibleTrainees.length}`);
  console.log(`  FIC trainees (excluded from assignment): ${ficTrainees.length}`);

  if (!eligibleTrainees.length) {
    console.warn('⚠️ No eligible trainees found - no assignments made');
    return {
      trainees,
      summary: {
        totalInstructors: instructors.length,
        totalTrainees: trainees.length,
        assignmentsMade: 0,
        instructorsWith2Primaries: 0,
        instructorsWith2Secondaries: 0,
        traineesWithPrimary: 0,
        traineesWithSecondary: 0,
      },
    };
  }

  // Create deep copy to avoid mutating original data
  const traineesWithAssignments: Trainee[] = JSON.parse(JSON.stringify(eligibleTrainees));

  // Normalize all existing instructor arrays
  traineesWithAssignments.forEach(t => {
    t.primaryInstructor = toInstructorArray(t.primaryInstructor as any);
    t.secondaryInstructor = toInstructorArray(t.secondaryInstructor as any);
  });

  // Track workload for each instructor
  const primaryLoad = new Map<string, number>();
  const secondaryLoad = new Map<string, number>();
  allocatableInstructors.forEach(i => {
    primaryLoad.set(i.name, 0);
    secondaryLoad.set(i.name, 0);
  });

  const MAX_PER_INSTRUCTOR = 3;

  // Helper: Get instructors from the same unit as the trainee, sorted by load
  const getUnitInstructors = (unit: string, loadMap: Map<string, number>): Instructor[] => {
    return allocatableInstructors
      .filter(i => i.unit === unit && (loadMap.get(i.name) ?? 0) < MAX_PER_INSTRUCTOR)
      .sort((a, b) => (loadMap.get(a.name) ?? 0) - (loadMap.get(b.name) ?? 0));
  };

  // Allocate in two rounds for primary assignments
  console.log('\n📋 Allocating PRIMARY instructors...');
  for (let round = 0; round < 2; round++) {
    for (const trainee of traineesWithAssignments) {
      const primaries = toInstructorArray(trainee.primaryInstructor as any);
      if (primaries.length > round) continue; // already has enough for this round
      if (!trainee.unit) continue;

      const candidates = getUnitInstructors(trainee.unit, primaryLoad)
        .filter(i => !primaries.includes(i.name));

      if (candidates.length === 0) {
        console.log(`  ⚠️ No available primary instructor for ${trainee.name} in round ${round + 1}`);
        continue;
      }

      const chosen = candidates[0];
      (trainee.primaryInstructor as string[]).push(chosen.name);
      primaryLoad.set(chosen.name, (primaryLoad.get(chosen.name) ?? 0) + 1);
    }
  }

  // Allocate in two rounds for secondary assignments
  console.log('\n📋 Allocating SECONDARY instructors...');
  for (let round = 0; round < 2; round++) {
    for (const trainee of traineesWithAssignments) {
      const primaries = toInstructorArray(trainee.primaryInstructor as any);
      const secondaries = toInstructorArray(trainee.secondaryInstructor as any);
      if (secondaries.length > round) continue;
      if (!trainee.unit) continue;

      // Prefer instructors not already primary for this trainee
      const candidates = getUnitInstructors(trainee.unit, secondaryLoad)
        .filter(i => !secondaries.includes(i.name) && !primaries.includes(i.name));

      // Fallback: allow primary overlap if no other options
      const fallbackCandidates = candidates.length > 0
        ? candidates
        : getUnitInstructors(trainee.unit, secondaryLoad).filter(i => !secondaries.includes(i.name));

      if (fallbackCandidates.length === 0) {
        console.log(`  ⚠️ No available secondary instructor for ${trainee.name} in round ${round + 1}`);
        continue;
      }

      const chosen = fallbackCandidates[0];
      (trainee.secondaryInstructor as string[]).push(chosen.name);
      secondaryLoad.set(chosen.name, (secondaryLoad.get(chosen.name) ?? 0) + 1);
    }
  }

  // Calculate summary statistics
  let assignmentsMade = 0;
  let instructorsWith2Primaries = 0;
  let instructorsWith2Secondaries = 0;
  let traineesWithPrimary = 0;
  let traineesWithSecondary = 0;

  for (const instructor of allocatableInstructors) {
    const pLoad = primaryLoad.get(instructor.name) ?? 0;
    const sLoad = secondaryLoad.get(instructor.name) ?? 0;
    assignmentsMade += pLoad + sLoad;
    if (pLoad >= 2) instructorsWith2Primaries++;
    if (sLoad >= 2) instructorsWith2Secondaries++;
  }

  for (const trainee of traineesWithAssignments) {
    if (toInstructorArray(trainee.primaryInstructor as any).length > 0) traineesWithPrimary++;
    if (toInstructorArray(trainee.secondaryInstructor as any).length > 0) traineesWithSecondary++;
  }

  const summary = {
    totalInstructors: allocatableInstructors.length,
    totalTrainees: eligibleTrainees.length,
    assignmentsMade,
    instructorsWith2Primaries,
    instructorsWith2Secondaries,
    traineesWithPrimary,
    traineesWithSecondary,
  };

  console.log('\n📊 Assignment Summary:');
  console.log(`  Total instructors: ${summary.totalInstructors}`);
  console.log(`  Total trainees: ${summary.totalTrainees}`);
  console.log(`  Assignments made: ${summary.assignmentsMade}`);
  console.log(`  Instructors with 2+ primaries: ${summary.instructorsWith2Primaries}/${summary.totalInstructors}`);
  console.log(`  Instructors with 2+ secondaries: ${summary.instructorsWith2Secondaries}/${summary.totalInstructors}`);
  console.log(`  Trainees with primary: ${summary.traineesWithPrimary}/${summary.totalTrainees}`);
  console.log(`  Trainees with secondary: ${summary.traineesWithSecondary}/${summary.totalTrainees}`);

  return {
    trainees: [...traineesWithAssignments, ...ficTrainees],
    summary,
  };
}