const fs = require('fs');
const content = fs.readFileSync('/workspace/App.tsx', 'utf8');

// Find the problematic section and fix it
const oldSection = `   ): Omit<ScheduleEvent, 'date'>[] {
       // DEBUG: Check what we're getting from the API
       console.log(\`🎯 CONFIG DEBUG:\`);
       console.log(\`  - originalInstructors: \${originalInstructors.length}\`);
       console.log(\`  - trainees: \${trainees.length}\`);
       console.log(\`  - syllabusDetails: \${syllabusDetails.length}\`);
       console.log(\`  - scores: \${scores.size} entries\`);
       console.log(\`  - availableAircraftCount: \${availableAircraftCount}\`);
       console.log(\`  - ftdCount: \${ftdCount}\`);
       console.log(\`  - cptCount: \${cptCount}\`);
       
       const {`;

const newSection = `   ): Omit<ScheduleEvent, 'date'>[] {
       const {`;

const newContent = content.replace(oldSection, newSection);

if (newContent !== content) {
    fs.writeFileSync('/workspace/App.tsx', newContent);
    console.log('✅ Fixed temporal dead zone error in generateDfpInternal');
} else {
    console.log('❌ Could not find the exact section to replace');
}