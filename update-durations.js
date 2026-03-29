import { PrismaClient } from '@prisma/client';

async function updateDurations() {
  const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:WxMnHCNEfpTRYbVOTgOXjMykwHNhCqFw@caboose.proxy.rlwy.net:15652/railway';
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: DATABASE_URL
      }
    }
  });

  try {
    console.log('Starting duration updates...\n');
    
    // Get all trainees in BPC+IPC and FIC courses
    const trainees = await prisma.trainee.findMany({
      where: {
        course: {
          in: ['BPC+IPC', 'FIC']
        }
      },
      select: {
        idNumber: true,
        name: true,
        course: true
      }
    });
    
    console.log(`Found ${trainees.length} trainees in BPC+IPC and FIC courses`);
    
    // Group by course
    const bpcTrainees = trainees.filter(t => t.course === 'BPC+IPC');
    const ficTrainees = trainees.filter(t => t.course === 'FIC');
    
    console.log(`BPC+IPC trainees: ${bpcTrainees.length}`);
    console.log(`FIC trainees: ${ficTrainees.length}\n`);
    
    let totalFlightUpdates = 0;
    let totalFtdUpdates = 0;
    const details = [];
    
    // Update events for each trainee
    for (const trainee of trainees) {
      const traineeId = trainee.idNumber;
      
      // Update flight events (type: 'flight') to 1.2hrs
      const flightUpdate = await prisma.scheduleEvent.updateMany({
        where: {
          traineeId: traineeId,
          type: 'flight'
        },
        data: {
          duration: 1.2
        }
      });
      
      // Update FTD events (type: 'ftd') to 2.0hrs
      const ftdUpdate = await prisma.scheduleEvent.updateMany({
        where: {
          traineeId: traineeId,
          type: 'ftd'
        },
        data: {
          duration: 2.0
        }
      });
      
      totalFlightUpdates += flightUpdate.count;
      totalFtdUpdates += ftdUpdate.count;
      
      if (flightUpdate.count > 0 || ftdUpdate.count > 0) {
        details.push({
          traineeName: trainee.name,
          course: trainee.course,
          flightUpdates: flightUpdate.count,
          ftdUpdates: ftdUpdate.count
        });
        console.log(`[Trainee ${trainee.name} (${trainee.course})]: Updated ${flightUpdate.count} flight events to 1.2hrs and ${ftdUpdate.count} FTD events to 2.0hrs`);
      }
    }
    
    console.log('\n✅ Duration updates completed successfully!');
    console.log(`Total: ${totalFlightUpdates} flight events updated to 1.2hrs`);
    console.log(`Total: ${totalFtdUpdates} FTD events updated to 2.0hrs`);
    
    console.log('\nDetails by trainee:');
    details.forEach(d => {
      console.log(`  ${d.traineeName} (${d.course}): ${d.flightUpdates} flights, ${d.ftdUpdates} FTDs`);
    });
    
  } catch (error) {
    console.error('Error updating durations:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateDurations();