const fs = require('fs');

// Read the file
let content = fs.readFileSync('server.js', 'utf8');

// Find the old response pattern (using regex to handle template literals)
const oldResponsePattern = /res\.json\(\{\s*accessToken,\s*refreshToken,\s*user: \{\s*id: user\.userId,\s*userId: user\.userId,\s*displayName: `\$\{user\.firstName \|\| ''\} \$\{user\.lastName \|\| ''\}`\.trim\(\),\s*email: user\.email,\s*isActive: user\.isActive,\s*role: iOSRole\s*\}\s*\}\);/;

// New response format (as a string)
const newResponse = `res.json({
           success: true,
           message: "Login successful",
           data: {
             accessToken,
             refreshToken,
             user: {
               id: user.userId,
               userId: user.userId,
               displayName: \`\${user.firstName || ''} \${user.lastName || ''}\`.trim(),
               email: user.email,
               isActive: user.isActive,
               role: iOSRole,
               firstName: user.firstName,
               lastName: user.lastName
             }
           }
         });`;

// Replace
if (oldResponsePattern.test(content)) {
  content = content.replace(oldResponsePattern, newResponse);
  fs.writeFileSync('server.js', content, 'utf8');
  console.log('✅ Successfully updated login response format');
} else {
  console.log('❌ Could not find the old response pattern');
  // Try to find it with debug
  const mobileLoginIndex = content.indexOf('POST /api/mobile/auth/login');
  if (mobileLoginIndex !== -1) {
    const surroundingText = content.substring(mobileLoginIndex, mobileLoginIndex + 2000);
    console.log('Found mobile login endpoint. Surrounding text:');
    console.log(surroundingText.substring(surroundingText.length - 500));
  }
}