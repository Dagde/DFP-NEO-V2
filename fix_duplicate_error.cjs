const fs = require('fs');
const path = require('path');

const serverJsPath = path.join(__dirname, 'server.js');
let content = fs.readFileSync(serverJsPath, 'utf8');

// Remove the duplicate error handler (lines after the first closing brace)
content = content.replace(
  /(\s+}\s*}\);\s*)\s+}\s*catch\s*\(error\)\s*{\s*console\.error\('❌ GET \/api\/mobile\/schedule error:', error\);[\s\S]*?}\s*}\);/,
  '$1'
);

fs.writeFileSync(serverJsPath, content);
console.log('Fixed duplicate error handler in server.js');