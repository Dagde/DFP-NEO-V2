import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function fixBifFtdDependencies() {
  try {
    console.log('🚀 Starting BIF FTD dependency fix...');

    // Get all trainees on BPC+IPC course
    const trainees = await prisma.trainee.findMany({
      where: {
        isActive: true,
        course: {
          startsWith: 'ADF'
        }
      },
      include: {
        individualLMP: true
      }
    });

    console.log(`📊 Found ${trainees.length} active trainees on ADF courses (BPC+IPC)`);

    let ftd1Fixed = 0;
    let ftd3Fixed = 0;
    let errors = 0;

    for (const trainee of trainees) {
      try {
        if (!trainee.individualLMP) {
          console.log(`⚠️  ${trainee.fullName}: No Individual LMP found, skipping`);
          continue;
        }

        const completedEventIds = trainee.individualLMP.completedEventIds || [];
        const newCompletedIds = [...completedEventIds];
        let changed = false;

        // Rule 1: If BIF FTD2 is complete, mark BIF FTD1 complete
        if (completedEventIds.includes('BIF FTD2') && !completedEventIds.includes('BIF FTD1')) {
          newCompletedIds.push('BIF FTD1');
          changed = true;
          console.log(`✅ ${trainee.fullName}: Marking BIF FTD1 complete (BIF FTD2 is complete)`);
          ftd1Fixed++;
        }

        // Rule 2: If BIF1 is complete, mark BIF FTD3 complete
        if (completedEventIds.includes('BIF1') && !completedEventIds.includes('BIF FTD3')) {
          newCompletedIds.push('BIF FTD3');
          changed = true;
          console.log(`✅ ${trainee.fullName}: Marking BIF FTD3 complete (BIF1 is complete)`);
          ftd3Fixed++;
        }

        if (changed) {
          // Update the Individual LMP in the database
          await prisma.individualLMP.update({
            where: {
              traineeId: trainee.id
            },
            data: {
              completedEventIds: newCompletedIds,
              updatedAt: new Date()
            }
          });
        }
      } catch (err) {
        console.error(`❌ Error processing ${trainee.fullName}:`, err.message);
        errors++;
      }
    }

    console.log('\n📈 Summary:');
    console.log(`   - BIF FTD1 marked complete: ${ftd1Fixed} trainees`);
    console.log(`   - BIF FTD3 marked complete: ${ftd3Fixed} trainees`);
    console.log(`   - Errors encountered: ${errors}`);
    console.log('\n✅ Fix complete!');
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixBifFtdDependencies();