import { PrismaClient } from '../dfp-neo-platform/node_modules/@prisma/client/index.js';

const prisma = new PrismaClient();

// Import the mock data generators
import { ESL_DATA, PEA_DATA } from '../mockData.js';

async function migratePersonnelAndTrainees() {
  try {
    console.log('Starting Personnel and Trainee migration...\n');
    
    // Get the data from mockData
    const eslData = ESL_DATA;
    const peaData = PEA_DATA;
    
    console.log(`ESL Instructors: ${eslData.instructors.length}`);
    console.log(`ESL Trainees: ${eslData.trainees.length}`);
    console.log(`PEA Instructors: ${peaData.instructors.length}`);
    console.log(`PEA Trainees: ${peaData.trainees.length}\n`);
    
    // Combine all instructors
    const allInstructors = [...eslData.instructors, ...peaData.instructors];
    
    // Combine all trainees
    const allTrainees = [...eslData.trainees, ...peaData.trainees];
    
    console.log('=== MIGRATING PERSONNEL (INSTRUCTORS) ===\n');
    
    // First, clear existing Personnel records
    const deletedPersonnel = await prisma.personnel.deleteMany({});
    console.log(`✓ Cleared ${deletedPersonnel.count} existing Personnel records\n`);
    
    let personnelCreated = 0;
    
    for (const instructor of allInstructors) {
      try {
        await prisma.personnel.create({
          data: {
            idNumber: instructor.idNumber,
            name: instructor.name,
            rank: instructor.rank,
            service: instructor.service,
            role: instructor.role,
            callsignNumber: instructor.callsignNumber,
            category: instructor.category,
            seatConfig: instructor.seatConfig,
            isTestingOfficer: instructor.isTestingOfficer || false,
            isExecutive: instructor.isExecutive || false,
            isFlyingSupervisor: instructor.isFlyingSupervisor || false,
            isIRE: instructor.isIRE || false,
            isCommandingOfficer: instructor.isCommandingOfficer || false,
            isCFI: instructor.isCFI || false,
            isDeputyFlightCommander: instructor.isDeputyFlightCommander || false,
            isContractor: instructor.isContractor || false,
            isAdminStaff: instructor.isAdminStaff || false,
            isQFI: instructor.role === 'QFI',
            isOFI: false, // Not in mock data
            location: instructor.location,
            unit: instructor.unit,
            flight: instructor.flight,
            phoneNumber: instructor.phoneNumber,
            email: instructor.email,
            permissions: instructor.permissions || [],
            unavailability: instructor.unavailability || [],
            priorExperience: instructor.priorExperience || null,
            isActive: true,
          },
        });
        personnelCreated++;
        
        if (personnelCreated % 20 === 0) {
          console.log(`  Created ${personnelCreated} Personnel records...`);
        }
      } catch (error: any) {
        console.error(`  ✗ Error creating Personnel for ${instructor.name}:`, error.message);
      }
    }
    
    console.log(`\n✓ Created ${personnelCreated} Personnel records\n`);
    
    console.log('=== MIGRATING TRAINEES ===\n');
    
    // Clear existing Trainee records
    const deletedTrainees = await prisma.trainee.deleteMany({});
    console.log(`✓ Cleared ${deletedTrainees.count} existing Trainee records\n`);
    
    let traineesCreated = 0;
    
    for (const trainee of allTrainees) {
      try {
        await prisma.trainee.create({
          data: {
            idNumber: trainee.idNumber,
            name: trainee.name,
            fullName: trainee.fullName,
            rank: trainee.rank,
            service: trainee.service,
            course: trainee.course,
            lmpType: 'BPC+IPC', // Default for now
            traineeCallsign: trainee.traineeCallsign,
            seatConfig: trainee.seatConfig,
            isPaused: trainee.isPaused || false,
            unavailability: trainee.unavailability || [],
            unit: trainee.unit,
            flight: trainee.flight,
            location: trainee.location,
            phoneNumber: trainee.phoneNumber,
            email: trainee.email,
            primaryInstructor: trainee.primaryInstructor,
            secondaryInstructor: trainee.secondaryInstructor,
            lastEventDate: trainee.lastEventDate ? new Date(trainee.lastEventDate) : null,
            lastFlightDate: trainee.lastFlightDate ? new Date(trainee.lastFlightDate) : null,
            currencyStatus: trainee.currencyStatus || null,
            permissions: trainee.permissions || [],
            priorExperience: null, // Not in mock data
            isActive: true,
          },
        });
        traineesCreated++;
        
        if (traineesCreated % 20 === 0) {
          console.log(`  Created ${traineesCreated} Trainee records...`);
        }
      } catch (error: any) {
        console.error(`  ✗ Error creating Trainee for ${trainee.name}:`, error.message);
      }
    }
    
    console.log(`\n✓ Created ${traineesCreated} Trainee records\n`);
    
    // Summary
    console.log('=== MIGRATION SUMMARY ===');
    console.log(`Personnel (Instructors): ${personnelCreated} created`);
    console.log(`Trainees: ${traineesCreated} created`);
    console.log(`Total records: ${personnelCreated + traineesCreated}`);
    
    // Verify counts
    const finalPersonnelCount = await prisma.personnel.count();
    const finalTraineeCount = await prisma.trainee.count();
    
    console.log('\n=== DATABASE VERIFICATION ===');
    console.log(`Personnel in database: ${finalPersonnelCount}`);
    console.log(`Trainees in database: ${finalTraineeCount}`);
    
    if (finalPersonnelCount === personnelCreated && finalTraineeCount === traineesCreated) {
      console.log('\n✓ Migration completed successfully!');
    } else {
      console.log('\n⚠ Warning: Record counts do not match!');
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migratePersonnelAndTrainees();