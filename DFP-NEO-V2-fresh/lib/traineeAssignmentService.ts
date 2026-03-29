// Trainee Assignment Service
// Provides logic for assigning trainees to instructors based on unit-based constraints
// Ensures all instructors have minimum 2 primary and 2 secondary trainees

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

/**
 * Assigns trainees to instructors based on the following rules:
 * 1. Each instructor gets minimum 2 primary trainees from their own unit
 * 2. Each instructor gets minimum 2 secondary trainees from their own unit
 * 3. Ensure all trainees have at least one primary and one secondary
 * 4. Third trainees may be added if necessary to ensure coverage
 * 5. Trainees assigned to instructors from their own unit only
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
  const eligibleTrainees = trainees.filter(t => !t.course.includes('FIC'));
  const ficTrainees = trainees.filter(t => t.course.includes('FIC'));
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

  // Track workload for each instructor
  const workload = new Map<string, { primary: Trainee[]; secondary: Trainee[] }>();
  allocatableInstructors.forEach(i => 
    workload.set(i.name, { primary: [], secondary: [] })
  );

  // Helper: Shuffle array randomly
  const shuffle = <T,>(arr: T[]): T[] => 
    [...arr].sort(() => Math.random() - 0.5);

  // Helper: Get instructors from the same unit as the trainee
  const getInstructorsByUnit = (traineeUnit: string): Instructor[] => {
    if (!traineeUnit) return [];
    return allocatableInstructors.filter(i => i.unit === traineeUnit);
  };

  // Helper: Check if instructor needs more assignments
  const needsMorePrimaries = (instructor: Instructor): boolean => {
    const load = workload.get(instructor.name);
    return load ? load.primary.length < 2 : true;
  };

  const needsMoreSecondaries = (instructor: Instructor): boolean => {
    const load = workload.get(instructor.name);
    return load ? load.secondary.length < 2 : true;
  };

  // Helper: Check if trainee is already assigned to instructor
  const isAssigned = (trainee: Trainee, instructorName: string): boolean => {
    const load = workload.get(instructorName);
    if (!load) return false;
    return load.primary.includes(trainee) || load.secondary.includes(trainee);
  };

  // Phase 1: Assign each instructor minimum 2 primary trainees from their own unit
  console.log('\n📋 Phase 1: Assigning minimum 2 primary trainees per instructor...');
  for (const instructor of allocatableInstructors) {
    if (!instructor.unit) {
      console.log(`  ⚠️ Skipping ${instructor.name} - no unit assigned`);
      continue;
    }

    const unitTrainees = traineesWithAssignments.filter(t => 
      t.unit === instructor.unit && 
      !trainee.primaryInstructor &&
      !isAssigned(t, instructor.name)
    );

    // Assign up to 2 primary trainees from same unit
    for (let i = 0; i < Math.min(2, unitTrainees.length); i++) {
      const trainee = unitTrainees[i];
      if (!trainee.primaryInstructor) {
        trainee.primaryInstructor = instructor.name;
        workload.get(instructor.name)!.primary.push(trainee);
        console.log(`  ✅ Primary: ${trainee.name} → ${instructor.name} (${trainee.unit})`);
      }
    }
  }

  // Phase 2: Assign each instructor minimum 2 secondary trainees from their own unit
  console.log('\n📋 Phase 2: Assigning minimum 2 secondary trainees per instructor...');
  for (const instructor of allocatableInstructors) {
    if (!instructor.unit) {
      console.log(`  ⚠️ Skipping ${instructor.name} - no unit assigned`);
      continue;
    }

    const unitTrainees = traineesWithAssignments.filter(t => 
      t.unit === instructor.unit && 
      t.primaryInstructor !== instructor.name &&
      !trainee.secondaryInstructor &&
      !isAssigned(t, instructor.name)
    );

    // Assign up to 2 secondary trainees from same unit
    for (let i = 0; i < Math.min(2, unitTrainees.length); i++) {
      const trainee = unitTrainees[i];
      if (!trainee.secondaryInstructor) {
        trainee.secondaryInstructor = instructor.name;
        workload.get(instructor.name)!.secondary.push(trainee);
        console.log(`  ✅ Secondary: ${trainee.name} → ${instructor.name} (${trainee.unit})`);
      }
    }
  }

  // Phase 3: Ensure all trainees have at least one primary and one secondary
  console.log('\n📋 Phase 3: Ensuring all trainees have at least one primary and one secondary...');
  for (const trainee of traineesWithAssignments) {
    // Assign primary if missing
    if (!trainee.primaryInstructor && trainee.unit) {
      const unitInstructors = getInstructorsByUnit(trainee.unit);
      const sortedInstructors = shuffle(unitInstructors).sort((a, b) => {
        const loadA = workload.get(a.name)?.primary.length || 0;
        const loadB = workload.get(b.name)?.primary.length || 0;
        return loadA - loadB;
      });

      if (sortedInstructors.length > 0) {
        const instructor = sortedInstructors[0];
        trainee.primaryInstructor = instructor.name;
        workload.get(instructor.name)!.primary.push(trainee);
        console.log(`  ✅ Primary (catch-up): ${trainee.name} → ${instructor.name} (${trainee.unit})`);
      } else {
        console.warn(`  ⚠️ Cannot assign primary for ${trainee.name} - no instructors in unit ${trainee.unit}`);
      }
    }

    // Assign secondary if missing
    if (!trainee.secondaryInstructor && trainee.unit) {
      const unitInstructors = getInstructorsByUnit(trainee.unit);
      const sortedInstructors = shuffle(unitInstructors).sort((a, b) => {
        const loadA = workload.get(a.name)?.secondary.length || 0;
        const loadB = workload.get(b.name)?.secondary.length || 0;
        return loadA - loadB;
      });

      // Prefer different instructor from primary
      const differentInstructors = sortedInstructors.filter(i => i.name !== trainee.primaryInstructor);
      const instructorToUse = differentInstructors.length > 0 ? differentInstructors[0] : sortedInstructors[0];

      if (instructorToUse) {
        trainee.secondaryInstructor = instructorToUse.name;
        workload.get(instructorToUse.name)!.secondary.push(trainee);
        console.log(`  ✅ Secondary (catch-up): ${trainee.name} → ${instructorToUse.name} (${trainee.unit})`);
      } else {
        console.warn(`  ⚠️ Cannot assign secondary for ${trainee.name} - no instructors in unit ${trainee.unit}`);
      }
    }
  }

  // Phase 4: Add third trainees to instructors who still need more (round-robin distribution)
  console.log('\n📋 Phase 4: Adding third trainees to balance workload...');
  for (const instructor of allocatableInstructors) {
    if (!instructor.unit) continue;

    let progressMade = true;
    let maxIterations = 10; // Prevent infinite loops

    while ((needsMorePrimaries(instructor) || needsMoreSecondaries(instructor)) && progressMade && maxIterations > 0) {
      progressMade = false;
      maxIterations--;

      // Assign as primary if needed
      if (needsMorePrimaries(instructor)) {
        const unitTrainees = traineesWithAssignments.filter(t => 
          t.unit === instructor.unit &&
          t.primaryInstructor !== instructor.name &&
          t.secondaryInstructor !== instructor.name &&
          !isAssigned(t, instructor.name)
        );

        if (unitTrainees.length > 0) {
          const trainee = unitTrainees[0];
          if (!trainee.primaryInstructor) {
            trainee.primaryInstructor = instructor.name;
            workload.get(instructor.name)!.primary.push(trainee);
            console.log(`  ✅ Primary (extra): ${trainee.name} → ${instructor.name} (${trainee.unit})`);
            progressMade = true;
          }
        }
      }

      // Assign as secondary if needed
      if (needsMoreSecondaries(instructor)) {
        const availableForSecondary = traineesWithAssignments.filter(t => 
          t.unit === instructor.unit &&
          t.secondaryInstructor !== instructor.name &&
          t.primaryInstructor !== instructor.name &&
          !isAssigned(t, instructor.name)
        );

        if (availableForSecondary.length > 0) {
          const trainee = availableForSecondary[0];
          if (!trainee.secondaryInstructor) {
            trainee.secondaryInstructor = instructor.name;
            workload.get(instructor.name)!.secondary.push(trainee);
            console.log(`  ✅ Secondary (extra): ${trainee.name} → ${instructor.name} (${trainee.unit})`);
            progressMade = true;
          }
        }
      }
    }
  }

  // Calculate summary statistics
  let assignmentsMade = 0;
  let instructorsWith2Primaries = 0;
  let instructorsWith2Secondaries = 0;
  let traineesWithPrimary = 0;
  let traineesWithSecondary = 0;

  for (const instructor of allocatableInstructors) {
    const load = workload.get(instructor.name);
    if (load) {
      assignmentsMade += load.primary.length + load.secondary.length;
      if (load.primary.length >= 2) instructorsWith2Primaries++;
      if (load.secondary.length >= 2) instructorsWith2Secondaries++;
    }
  }

  for (const trainee of traineesWithAssignments) {
    if (trainee.primaryInstructor) traineesWithPrimary++;
    if (trainee.secondaryInstructor) traineesWithSecondary++;
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