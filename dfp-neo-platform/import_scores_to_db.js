import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function importScores() {
  console.log('🚀 Importing mock scores to database...\n');
  
  // Load generated scores
  const scoresData = JSON.parse(fs.readFileSync('/workspace/generated_scores.json', 'utf8'));
  console.log(`📊 Loaded ${scoresData.length} scores from file\n`);
  
  // Group scores by trainee
  const scoresByTrainee = new Map();
  scoresData.forEach(item => {
    if (!scoresByTrainee.has(item.traineeFullName)) {
      scoresByTrainee.set(item.traineeFullName, []);
    }
    scoresByTrainee.get(item.traineeFullName).push(item.score);
  });
  
  console.log(`🎓 Found ${scoresByTrainee.size} unique trainees\n`);
  
  // Import scores
  let importedCount = 0;
  let skippedCount = 0;
  
  for (const [fullName, scores] of scoresByTrainee.entries()) {
    // Find trainee by fullName
    const trainee = await prisma.trainee.findFirst({
      where: { fullName }
    });
    
    if (!trainee) {
      console.log(`⚠️  Trainee not found: ${fullName}`);
      skippedCount += scores.length;
      continue;
    }
    
    // Import each score
    for (const score of scores) {
      try {
        await prisma.score.create({
          data: {
            traineeId: trainee.id,
            event: score.event,
            score: score.score,
            date: new Date(score.date),
            instructor: score.instructor,
            notes: score.notes,
            details: score.details
          }
        });
        importedCount++;
      } catch (error) {
        console.error(`❌ Error importing score for ${fullName}: ${error.message}`);
        skippedCount++;
      }
    }
    
    if (importedCount % 100 === 0) {
      console.log(`✅ Imported ${importedCount} scores...`);
    }
  }
  
  console.log(`\n📈 Import complete!`);
  console.log(`✅ Imported: ${importedCount} scores`);
  console.log(`⚠️  Skipped: ${skippedCount} scores`);
  
  await prisma.$disconnect();
}

importScores().catch(console.error);