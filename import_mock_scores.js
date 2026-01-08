import fetch from 'node-fetch';
import fs from 'fs';

// Database API endpoint
const API_BASE = 'https://dfp-neo.com/api';

// Master syllabus (simplified version - in production this would come from INITIAL_SYLLABUS_DETAILS)
const masterSyllabus = [
  'BGF MB1', 'BGF MB2', 'BGF CPT1', 'BGF TUT1A', 'BGF TUT1B', 'BGF TUT2',
  'BGF MB3', 'BGF MB4', 'BGF MB5', 'BGF MB6', 'BGF CPT2', 'BGF FTD1',
  'BGF MB7', 'BGF1', 'BGF FTD2', 'BGF2', 'BGF MB8', 'BGF CPT3',
  'BGF MB9', 'BGF TUT3', 'BGF FTD3', 'BGF3', 'BGF FTD4', 'BGF4',
  'BGF5', 'BGF MB10', 'BGF MB11', 'BGF MB12', 'BGF CPT4', 'BGF6'
];

// Course progress ranges (simulated progress)
const courseProgressRanges = {
  'ADF301': { start: 0, end: 15 },
  'ADF302': { start: 5, end: 20 },
  'ADF303': { start: 10, end: 25 },
  'ADF304': { start: 15, end: 30 },
  'ADF305': { start: 0, end: 12 },
  'FIC211': { start: 20, end: 25 }
};

async function generateScores() {
  console.log('🎯 Generating mock scores for database trainees...\n');
  
  // Fetch all trainees
  const response = await fetch(`${API_BASE}/personnel?role=TRAINEE`);
  const data = await response.json();
  const trainees = data.personnel;
  
  console.log(`📊 Found ${trainees.length} trainees in database\n`);
  
  // Generate scores for each trainee
  const allScores = [];
  
  trainees.forEach((trainee, index) => {
    const course = trainee.course;
    const fullName = trainee.fullName;
    const range = courseProgressRanges[course] || { start: 0, end: 5 };
    
    // Calculate progress
    const progressIndex = Math.floor(Math.random() * (range.end - range.start + 1)) + range.start;
    const completedEvents = masterSyllabus.slice(0, progressIndex);
    
    if (completedEvents.length > 0) {
      // Generate a date for the scores (last 6 months)
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 180);
      
      completedEvents.forEach((eventCode, eventIndex) => {
        // Generate score between 3 and 5 (passing grades)
        const scoreValue = Math.floor(Math.random() * 3) + 3;
        
        // Generate date
        const daysToAdd = Math.floor(Math.random() * 3) + 1;
        startDate.setDate(startDate.getDate() + daysToAdd);
        const scoreDate = new Date(startDate);
        
        const score = {
          event: eventCode,
          score: scoreValue,
          date: scoreDate.toISOString().split('T')[0],
          instructor: trainee.primaryInstructor || 'Unknown Instructor',
          notes: `Simulated score for ${eventCode}`,
          details: [
            {
              criteria: 'General Handling',
              score: scoreValue,
              comment: 'Auto-generated score from mock data import'
            }
          ]
        };
        
        allScores.push({
          traineeFullName: fullName,
          score: score
        });
      });
    }
    
    if ((index + 1) % 10 === 0) {
      console.log(`✅ Generated scores for ${index + 1}/${trainees.length} trainees`);
    }
  });
  
  console.log(`\n📈 Total scores generated: ${allScores.length}\n`);
  
  // Save to JSON file
  fs.writeFileSync('/workspace/generated_scores.json', JSON.stringify(allScores, null, 2));
  console.log('💾 Saved scores to /workspace/generated_scores.json\n');
  
  // Print sample
  console.log('📋 Sample scores (first 5):');
  console.log(JSON.stringify(allScores.slice(0, 5), null, 2));
  
  return allScores;
}

generateScores().catch(console.error);