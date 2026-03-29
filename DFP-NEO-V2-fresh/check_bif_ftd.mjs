import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkBifFtd() {
  try {
    const trainees = await prisma.individualLMP.findMany({
      where: {
        completedEventIds: {
          hasSome: ['BIF FTD1*', 'BIF FTD3*']
        }
      },
      select: {
        id: true,
        traineeName: true,
        courseName: true,
        completedEventIds: true
      }
    });

    console.log(`Found ${trainees.length} trainees with asterisk versions:`);
    trainees.forEach(trainee => {
      const hasBifFtd1Star = trainee.completedEventIds.includes('BIF FTD1*');
      const hasBifFtd1 = trainee.completedEventIds.includes('BIF FTD1');
      const hasBifFtd3Star = trainee.completedEventIds.includes('BIF FTD3*');
      const hasBifFtd3 = trainee.completedEventIds.includes('BIF FTD3');
      
      console.log(`\nTrainee: ${trainee.traineeName}`);
      console.log(`  Course: ${trainee.courseName}`);
      console.log(`  BIF FTD1*: ${hasBifFtd1Star}, BIF FTD1: ${hasBifFtd1}`);
      console.log(`  BIF FTD3*: ${hasBifFtd3Star}, BIF FTD3: ${hasBifFtd3}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBifFtd();