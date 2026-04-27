const fs = require('fs');

// Read the file
let content = fs.readFileSync('server.js', 'utf8');

// Find and replace the mobile login response with the correct format
const oldPattern = /res\.json\(\{\s*accessToken: accessToken,\s*refreshToken: refreshToken,\s*user: \{\s*id: String\(user\.id\),\s*userId: user\.userId,\s*displayName: user\.firstName \+ " " \+ user\.lastName,\s*email: user\.email,\s*status: user\.isActive \? "active" : "inactive",\s*permissionsRole: \{\s*id: String\(user\.id\),\s*name: mappedRole\s*\},\s*mustChangePassword: false\s*\},\s*expiresIn: 3600 \/\/ 1 hour in seconds\s*\}\);/;

const newResponse = `res.json({
           success: true,
           message: "Login successful",
           data: {
                 accessToken: accessToken,
                 refreshToken: refreshToken,
                 user: {
                 id: String(user.id),
                 userId: user.userId,
                 displayName: user.firstName + " " + user.lastName,
                 email: user.email,
                 isActive: user.isActive,
                 role: mappedRole,
                 firstName: user.firstName,
                 lastName: user.lastName
                 }
           }
       });`;

if (oldPattern.test(content)) {
  content = content.replace(oldPattern, newResponse);
  fs.writeFileSync('server.js', content, 'utf8');
  console.log('✅ Successfully updated DFP-NEO-V2-fresh mobile API response format');
} else {
  console.log('❌ Could not find the pattern in DFP-NEO-V2-fresh/server.js');
  
  // Try to find it with more context
  const mobileLoginIndex = content.indexOf('POST /api/mobile/auth/login');
  if (mobileLoginIndex !== -1) {
    const responseJsonIndex = content.indexOf('res.json({', mobileLoginIndex);
    if (responseJsonIndex !== -1) {
      const surroundingText = content.substring(responseJsonIndex - 100, responseJsonIndex + 500);
      console.log('Found res.json nearby. Context:');
      console.log(surroundingText);
    }
  }
}